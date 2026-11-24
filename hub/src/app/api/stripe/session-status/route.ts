import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { retrieveCheckoutSession, stripeMode } from "@/lib/stripe";

/**
 * Success page polls this — never invents a membership tag in the browser.
 * Returns tag only after webhook / ledger has written it.
 */
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "session_id required" },
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

  const { data: payment } = await admin
    .from("membership_payments")
    .select(
      "id, status, membership_tag, email, first_name, last_name, paid_at, kind",
    )
    .eq("stripe_checkout_session_id", sessionId)
    .eq("kind", "entrance")
    .maybeSingle();

  if (payment?.status === "paid" && payment.membership_tag) {
    // Public poll endpoint — return tag only, no email/name PII
    return NextResponse.json({
      ok: true,
      status: "issued",
      membershipTag: payment.membership_tag,
      paidAt: payment.paid_at,
    });
  }

  // Still waiting on webhook — confirm session exists in Stripe when configured
  if (stripeMode() === "ready") {
    const session = await retrieveCheckoutSession(sessionId);
    if (session.ok && session.data) {
      const paymentStatus = (session.data as { payment_status?: string })
        .payment_status;
      if (paymentStatus === "unpaid") {
        return NextResponse.json({
          ok: true,
          status: "unpaid",
          membershipTag: null,
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    status: "pending",
    membershipTag: null,
    note: "Payment received — issuing your membership number…",
  });
}
