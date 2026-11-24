/**
 * YAT-YAS Association Stripe helpers.
 *
 * HARD ISOLATION: never use Keystone Group Holdings, Bridgeforge, Bridgevoice,
 * or any other portfolio Stripe account. Keys must be from the YAT-YAS
 * Association Stripe business (board@yatyasassociation.com) only.
 * Checkout stays off until those YAT-YAS keys are present on this project.
 */

export type StripeMode = "ready" | "missing";

export function stripeMode(): StripeMode {
  const secret = process.env.STRIPE_SECRET_KEY || "";
  const publishable =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    "";
  if (secret.startsWith("sk_") && publishable.startsWith("pk_")) {
    return "ready";
  }
  return "missing";
}

export function stripeSecretKey(): string | null {
  const secret = process.env.STRIPE_SECRET_KEY || "";
  return secret.startsWith("sk_") ? secret : null;
}

export function stripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  return secret.startsWith("whsec_") ? secret : null;
}

/** First Wave catalog — wire Checkout when stripeMode() === "ready". */
export const FIRST_WAVE_PRODUCTS = {
  entrance: {
    name: "First Wave welcome package",
    amountCents: 10000,
    currency: "usd",
    description:
      "Entrance applied to welcome membership package (coin, box, shirt, card materials, Hub).",
  },
  monthly: {
    name: "Association membership",
    amountCents: 500,
    currency: "usd",
    interval: "month" as const,
    description: "Supports scholarships, events, and Association programs.",
  },
} as const;

export function hubBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_HUB_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://hub.yatyasassociation.com"
  ).replace(/\/$/, "");
}

type StripeForm = Record<string, string | number | undefined | null>;

function encodeForm(data: StripeForm): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export async function stripeRequest<T>(
  path: string,
  init?: { method?: string; form?: StripeForm },
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const key = stripeSecretKey();
  if (!key) {
    return { ok: false, error: "Stripe not configured", status: 503 };
  }

  const method = init?.method || "POST";
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init?.form
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: method === "GET" || !init?.form ? undefined : encodeForm(init.form),
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: data.error?.message || `Stripe HTTP ${res.status}`,
      status: res.status,
    };
  }

  return { ok: true, data };
}

export type CheckoutSession = {
  id: string;
  url: string | null;
  customer?: string | null;
  payment_intent?: string | null;
  subscription?: string | null;
  metadata?: Record<string, string>;
  amount_total?: number | null;
  currency?: string | null;
};

/** Entrance + first month subscription in one Checkout Session. */
export async function createFirstWaveCheckoutSession(input: {
  email: string;
  firstName: string;
  lastName: string;
  applicationId?: string | null;
}): Promise<
  { ok: true; session: CheckoutSession } | { ok: false; error: string; status: number }
> {
  const base = hubBaseUrl();
  const success = `${base}/pay/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancel = `${base}/pay/cancel`;

  const form: StripeForm = {
    mode: "subscription",
    customer_email: input.email.trim().toLowerCase(),
    success_url: success,
    cancel_url: cancel,
    client_reference_id: input.applicationId || undefined,
    "metadata[kind]": "first_wave_entrance",
    "metadata[email]": input.email.trim().toLowerCase(),
    "metadata[first_name]": input.firstName.trim(),
    "metadata[last_name]": input.lastName.trim(),
    "metadata[application_id]": input.applicationId || "",
    "line_items[0][price_data][currency]": FIRST_WAVE_PRODUCTS.entrance.currency,
    "line_items[0][price_data][product_data][name]":
      FIRST_WAVE_PRODUCTS.entrance.name,
    "line_items[0][price_data][product_data][description]":
      FIRST_WAVE_PRODUCTS.entrance.description,
    "line_items[0][price_data][unit_amount]":
      FIRST_WAVE_PRODUCTS.entrance.amountCents,
    "line_items[0][quantity]": 1,
    "line_items[1][price_data][currency]": FIRST_WAVE_PRODUCTS.monthly.currency,
    "line_items[1][price_data][product_data][name]":
      FIRST_WAVE_PRODUCTS.monthly.name,
    "line_items[1][price_data][product_data][description]":
      FIRST_WAVE_PRODUCTS.monthly.description,
    "line_items[1][price_data][unit_amount]":
      FIRST_WAVE_PRODUCTS.monthly.amountCents,
    "line_items[1][price_data][recurring][interval]":
      FIRST_WAVE_PRODUCTS.monthly.interval,
    "line_items[1][quantity]": 1,
    "subscription_data[metadata][kind]": "association_monthly",
    "subscription_data[metadata][email]": input.email.trim().toLowerCase(),
  };

  const result = await stripeRequest<CheckoutSession>("/checkout/sessions", {
    form,
  });
  if (!result.ok) return result;
  return { ok: true, session: result.data };
}

/** One-time Association donation (open amount, capped). */
export async function createDonationCheckoutSession(input: {
  email?: string;
  amountCents: number;
  name?: string;
}): Promise<
  { ok: true; session: CheckoutSession } | { ok: false; error: string; status: number }
> {
  const amount = Math.round(input.amountCents);
  if (!Number.isFinite(amount) || amount < 500 || amount > 500000) {
    return {
      ok: false,
      error: "Choose an amount between $5 and $5,000.",
      status: 400,
    };
  }

  const base = hubBaseUrl();
  const form: StripeForm = {
    mode: "payment",
    success_url: `${base}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/donate`,
    "metadata[kind]": "association_donation",
    "metadata[amount_cents]": String(amount),
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": "YAT-YAS Association donation",
    "line_items[0][price_data][product_data][description]":
      "Supports scholarships, events, and Association programs.",
    "line_items[0][price_data][unit_amount]": amount,
    "line_items[0][quantity]": 1,
    "payment_intent_data[metadata][kind]": "association_donation",
  };

  const email = (input.email || "").trim().toLowerCase();
  if (email) {
    form.customer_email = email;
    form["metadata[email]"] = email;
  }
  const name = (input.name || "").trim();
  if (name) form["metadata[name]"] = name.slice(0, 120);

  const result = await stripeRequest<CheckoutSession>("/checkout/sessions", {
    form,
  });
  if (!result.ok) return result;
  return { ok: true, session: result.data };
}

export async function retrieveCheckoutSession(sessionId: string) {
  return stripeRequest<CheckoutSession>(
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { method: "GET" },
  );
}

/**
 * Verify Stripe-Signature header (whsec_…).
 * Uses Web Crypto — no stripe SDK required.
 */
export async function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<{ ok: true; event: StripeEvent } | { ok: false; error: string }> {
  if (!signatureHeader) {
    return { ok: false, error: "Missing Stripe-Signature" };
  }

  const pairs = signatureHeader.split(",").map((p) => {
    const [k, ...rest] = p.split("=");
    return [k.trim(), rest.join("=")] as const;
  });
  const timestamp = pairs.find(([k]) => k === "t")?.[1];
  const v1List = pairs.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!timestamp || v1List.length === 0) {
    return { ok: false, error: "Invalid Stripe-Signature" };
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) {
    return { ok: false, error: "Webhook timestamp too old" };
  }

  // Stripe signing secret is base64 after the whsec_ prefix
  const secretBytes = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");

  const signed = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signed),
  );
  const digest = Buffer.from(mac).toString("hex");

  if (!v1List.some((v1) => timingSafeEqualHex(digest, v1))) {
    return { ok: false, error: "Invalid signature" };
  }

  try {
    const event = JSON.parse(rawBody) as StripeEvent;
    return { ok: true, event };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};
