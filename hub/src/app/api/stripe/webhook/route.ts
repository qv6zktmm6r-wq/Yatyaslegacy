import { NextResponse } from "next/server";
import {
  sendBoardPaidMemberAlert,
  sendFirstWaveWelcomeEmail,
} from "@/lib/mail";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FIRST_WAVE_PRODUCTS,
  stripeMode,
  stripeWebhookSecret,
  verifyStripeWebhook,
  type StripeEvent,
} from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (stripeMode() !== "ready") {
    return NextResponse.json(
      { ok: false, error: "Stripe not configured" },
      { status: 503 },
    );
  }

  const secret = stripeWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "STRIPE_WEBHOOK_SECRET not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const verified = await verifyStripeWebhook(
    rawBody,
    request.headers.get("stripe-signature"),
    secret,
  );

  if (!verified.ok) {
    return NextResponse.json(
      { ok: false, error: verified.error },
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

  try {
    await handleEvent(admin, verified.event);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    console.error("[stripe/webhook]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, received: true });
}

async function handleEvent(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  event: StripeEvent,
) {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    await onCheckoutCompleted(admin, event.data.object);
    return;
  }

  if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await onSubscriptionish(admin, event);
    return;
  }

  if (event.type === "charge.refunded" || event.type === "refund.created") {
    await onRefund(admin, event.data.object);
  }
}

async function onCheckoutCompleted(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  obj: Record<string, unknown>,
) {
  const metadata = (obj.metadata || {}) as Record<string, string>;
  if (metadata.kind && metadata.kind !== "first_wave_entrance") {
    return;
  }

  // Never issue a number until Stripe reports payment cleared
  if (obj.payment_status !== "paid") {
    return;
  }

  const email = String(
    metadata.email || obj.customer_email || obj.customer_details_email || "",
  ).toLowerCase();
  const firstName = String(metadata.first_name || "").trim();
  const lastName = String(metadata.last_name || "").trim();
  const applicationId = metadata.application_id || null;
  const sessionId = String(obj.id || "");
  const customerId = obj.customer ? String(obj.customer) : null;
  const subscriptionId = obj.subscription ? String(obj.subscription) : null;
  const paymentIntent = obj.payment_intent
    ? String(obj.payment_intent)
    : null;
  const amountTotal =
    typeof obj.amount_total === "number"
      ? obj.amount_total
      : FIRST_WAVE_PRODUCTS.entrance.amountCents;
  const currency = String(obj.currency || "usd");

  if (!email || !firstName || !lastName || !sessionId) {
    throw new Error("Checkout session missing email/name/id metadata");
  }

  const { data, error } = await admin.rpc(
    "issue_membership_after_entrance_payment",
    {
      p_email: email,
      p_first_name: firstName,
      p_last_name: lastName,
      p_amount_cents: amountTotal,
      p_currency: currency,
      p_stripe_checkout_session_id: sessionId,
      p_stripe_payment_intent_id: paymentIntent,
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: subscriptionId,
      p_application_id: applicationId || null,
    },
  );

  if (error) throw new Error(error.message);

  const result = data as {
    ok?: boolean;
    membership_tag?: string;
    idempotent?: boolean;
  };

  const tag = result?.membership_tag;
  if (!tag) return;

  const displayName = `${firstName} ${lastName}`.trim();

  // Welcome + board alert (best effort; payment/tag already committed)
  if (!result.idempotent) {
    await sendFirstWaveWelcomeEmail({
      to: email,
      displayName,
      membershipTag: tag,
    });
    await sendBoardPaidMemberAlert({
      displayName,
      email,
      membershipTag: tag,
      amountCents: amountTotal,
      currency,
    });
  }
}

async function onSubscriptionish(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  event: StripeEvent,
) {
  const obj = event.data.object;
  const email = String(
    (obj.customer_email as string) ||
      ((obj.metadata as Record<string, string> | undefined)?.email || ""),
  ).toLowerCase();
  if (!email) return;

  let status = "paid";
  if (
    event.type === "invoice.payment_failed" ||
    (obj.status === "past_due" || obj.status === "unpaid")
  ) {
    status = "past_due";
  }
  if (event.type === "customer.subscription.deleted") {
    status = "failed";
  }

  const amount =
    typeof obj.amount_paid === "number"
      ? obj.amount_paid
      : FIRST_WAVE_PRODUCTS.monthly.amountCents;

  await admin.rpc("record_monthly_payment", {
    p_email: email,
    p_amount_cents: amount,
    p_currency: String(obj.currency || "usd"),
    p_status: status,
    p_stripe_invoice_id: obj.object === "invoice" ? String(obj.id) : null,
    p_stripe_customer_id: obj.customer ? String(obj.customer) : null,
    p_stripe_subscription_id:
      obj.object === "subscription"
        ? String(obj.id)
        : obj.subscription
          ? String(obj.subscription)
          : null,
  });
}

async function onRefund(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  obj: Record<string, unknown>,
) {
  const sessionId =
    (obj.checkout_session as string) ||
    ((obj.metadata as Record<string, string> | undefined)
      ?.checkout_session_id ??
      null);
  const paymentIntent = obj.payment_intent
    ? String(obj.payment_intent)
    : null;

  if (sessionId) {
    await admin.rpc("mark_entrance_refunded", {
      p_stripe_checkout_session_id: String(sessionId),
      p_payment_id: null,
    });
    return;
  }

  if (paymentIntent) {
    const { data: pay } = await admin
      .from("membership_payments")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntent)
      .maybeSingle();
    if (pay?.id) {
      await admin.rpc("mark_entrance_refunded", {
        p_stripe_checkout_session_id: null,
        p_payment_id: pay.id,
      });
    }
  }
}
