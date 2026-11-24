# First Wave Stripe go-live checklist

Use after the corporate bank account is open. Do not put keys in Git or chat.

## Account (hard isolation)

**Never** connect Keystone Group Holdings, Bridgeforge, Bridgevoice, or any other portfolio Stripe account to `yatyas-hub`.

1. Use the **YAT-YAS Association** Stripe business only (`board@yatyasassociation.com`).
2. Stripe CLI: `stripe login --project-name=yatyasassociation` (never `keystone_host`).
3. Keychain secrets: project `yatyasassociation` only (`hub/.dev-secrets.json`).
4. Attach the new corporate bank for payouts (from Keychain `YATYAS_BANK_*` — enter in Stripe UI yourself).
5. Confirm business profile: nonprofit / veterans membership association.

## Keys on Vercel (`yatyas-hub`)

Add for Production (and Preview if desired):

| Name | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` (or `sk_test_…` for a test pass first) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | matching `pk_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the endpoint below |

## Webhook

Endpoint: `https://hub.yatyasassociation.com/api/stripe/webhook`

Subscribe at least:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded` (or `refund.created`)

## Deploy gate

Hub payment routes and VIP `/board` must be deployed from current local `hub/` (middleware already allows `/api/stripe/*` and `/pay` without login). Until that deploy lands, Stripe events hit auth redirect and will fail.

Suggested sequence: **commit/push hub → deploy → add keys → create webhook → one test payment**.

## Products (code already)

- Entrance: **$100** one-time (welcome package)
- Ongoing: **$5/month** subscription

Checkout creates both in one session. After paid, webhook issues the next public FW tag (skips claimed tags and board-held FW-002–007).

## Smoke test

1. Board `/board` → create pay link (or Checkout from First Wave when wired).
2. Pay with Stripe test card (test mode) or $100 live after keys.
3. Confirm: ledger row `entrance`/`paid`, membership tag assigned, welcome email, board@ alert, success page shows tag (does not invent one).
4. Refund once in test: ledger → `refunded`, **tag retained**.
