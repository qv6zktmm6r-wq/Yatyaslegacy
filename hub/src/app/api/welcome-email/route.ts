import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hubSignupUrl, sendFirstWaveWelcomeEmail } from "@/lib/mail";
import { isVipRole } from "@/lib/types";

/**
 * Board/VIP: send (or dry-run) the First Wave welcome letter.
 * Live Resend send requires RESEND_API_KEY on the project (spend-gated).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!isVipRole(me?.role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    displayName?: string;
    membershipTag?: string;
    dryRun?: boolean;
  };

  const email = String(body.email || "").trim().toLowerCase();
  const displayName = String(body.displayName || "").trim();
  const membershipTag = String(body.membershipTag || "").trim().toUpperCase();

  if (!email || !membershipTag) {
    return NextResponse.json(
      { ok: false, error: "email and membershipTag are required" },
      { status: 400 },
    );
  }

  const result = await sendFirstWaveWelcomeEmail({
    to: email,
    displayName: displayName || email.split("@")[0] || "Member",
    membershipTag,
    hubSignupUrl: hubSignupUrl(),
    forceDryRun: Boolean(body.dryRun),
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json({
    ...result,
    previewPath: `/approvals/letter-preview?tag=${encodeURIComponent(membershipTag)}&name=${encodeURIComponent(displayName || "Member")}`,
  });
}
