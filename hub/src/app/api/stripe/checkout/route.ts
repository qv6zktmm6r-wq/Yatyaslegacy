import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createFirstWaveCheckoutSession,
  stripeMode,
} from "@/lib/stripe";

type Body = {
  email?: string;
  firstName?: string;
  lastName?: string;
  applicationId?: string;
};

const checkoutBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string, limit = 8, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const row = checkoutBuckets.get(ip);
  if (!row || row.resetAt < now) {
    checkoutBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}

export async function POST(request: Request) {
  if (stripeMode() !== "ready") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "YAT-YAS Stripe is not connected yet. Open the corp bank account, then add Stripe keys to yatyas-hub.",
      },
      { status: 503 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many Checkout attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const email = (body.email || "").trim().toLowerCase();
  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const applicationId = body.applicationId?.trim() || null;

  if (!email || !email.includes("@") || !firstName || !lastName) {
    return NextResponse.json(
      { ok: false, error: "email, firstName, and lastName are required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Service role not configured" },
      { status: 503 },
    );
  }

  // Waitlist application must match the paying email (no UUID spoofing)
  if (applicationId) {
    const { data: app, error: appError } = await admin
      .from("first_wave_applications")
      .select("id, email, status")
      .eq("id", applicationId)
      .maybeSingle();
    if (appError || !app) {
      return NextResponse.json(
        { ok: false, error: "Waitlist application not found" },
        { status: 400 },
      );
    }
    if (String(app.email || "").toLowerCase() !== email) {
      return NextResponse.json(
        { ok: false, error: "Application email does not match checkout email" },
        { status: 400 },
      );
    }
    if (app.status !== "pending" && app.status !== "accepted") {
      return NextResponse.json(
        { ok: false, error: "Application is not open for payment" },
        { status: 409 },
      );
    }
  }

  // Soft seat hold before Stripe redirect
  const { data: hold, error: holdError } = await admin.rpc(
    "create_checkout_hold",
    {
      p_email: email,
      p_first_name: firstName,
      p_last_name: lastName,
      p_session_id: null,
      p_application_id: applicationId,
      p_hold_minutes: 30,
    },
  );

  if (holdError) {
    return NextResponse.json(
      { ok: false, error: holdError.message },
      { status: 409 },
    );
  }

  const sessionResult = await createFirstWaveCheckoutSession({
    email,
    firstName,
    lastName,
    applicationId,
  });

  if (!sessionResult.ok) {
    return NextResponse.json(
      { ok: false, error: sessionResult.error },
      { status: sessionResult.status },
    );
  }

  const session = sessionResult.session;
  if (!session.url) {
    return NextResponse.json(
      { ok: false, error: "Stripe did not return a Checkout URL" },
      { status: 502 },
    );
  }

  // Attach session id to hold
  await admin.rpc("create_checkout_hold", {
    p_email: email,
    p_first_name: firstName,
    p_last_name: lastName,
    p_session_id: session.id,
    p_application_id: applicationId,
    p_hold_minutes: 30,
  });

  return NextResponse.json({
    ok: true,
    url: session.url,
    sessionId: session.id,
    hold,
  });
}
