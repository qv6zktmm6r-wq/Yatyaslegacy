import { NextResponse } from "next/server";
import { createDonationCheckoutSession, stripeMode } from "@/lib/stripe";

type Body = {
  email?: string;
  name?: string;
  amountCents?: number;
  amountDollars?: number;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string, limit = 12, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const row = buckets.get(ip);
  if (!row || row.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}

export async function POST(request: Request) {
  if (stripeMode() !== "ready") {
    return NextResponse.json(
      { ok: false, error: "Donations are not available yet." },
      { status: 503 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many donation attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const amountCents =
    typeof body.amountCents === "number"
      ? body.amountCents
      : typeof body.amountDollars === "number"
        ? Math.round(body.amountDollars * 100)
        : NaN;

  const result = await createDonationCheckoutSession({
    email: body.email,
    name: body.name,
    amountCents,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    url: result.session.url,
    sessionId: result.session.id,
  });
}
