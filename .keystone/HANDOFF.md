# HANDOFF — YAT-YAS Phase 2 + site

Updated: 2026-11-24 (Board dashboard + payment ledger applied)

## Goal

Bank + Stripe after EIN. Board dashboard tracks paid + numbers automatically once Stripe is live.

## Done

- Entity **B20260476255** Active; SI due **2027-02-02**.
- Mailbox `board@yatyasassociation.com` live.
- **Official crest locked 2026-11-24:** `site/assets/crest-official.jpg` → web/email `crest-20261124.png` (cache-bust; prior `crest-transparent.png` kept as copy). Favicons crest-derived on site + hub. Prior crest archived as `crest-previous-transparent.png` (do not ship).
- **Board Dashboard `/board` (2026-11-24):** VIP cockpit for seats, waitlist, roster, entrance paid, dues, unclaimed Hub. Ledger + RPCs applied on Supabase `tfavgqqqagcqhfeeutzc`. Checkout + webhook auto-issue next public FW tag after paid (incl. async); success poll capped; soft 30m holds; audited override; refunds keep tags. **Public `/pay`**, site First Wave pay CTA, waitlist **Invite to pay** (preferred) vs roster-without-payment exception; Board unpaid-row pay links; checkout validates waitlist `applicationId`↔email.
- **Stripe LIVE (2026-11-24):** Isolated YAT-YAS account `acct_1UfNVKENhdhgrESP` (not Keystone). Live `sk`/`pk` + webhook secret in Keychain (`yatyasassociation`) + Vercel `yatyas-hub`. Live webhook → `https://hub.yatyasassociation.com/api/stripe/webhook`. Smoke: `cs_live_…` Checkout create PASS. Hub prod redeployed.
- Site live with premium hero photography (PD USMC/USN via Commons; see `site/assets/heroes/CREDITS.md`).
- Program intakes + assist API (`/api/assist` via Vercel AI Gateway, model `openai/gpt-4.1-mini`, key capped ~$10/mo):
  - `/first-wave` — service-only waitlist; **price blank**
  - `/crew-finder` — tell story → we structure → board follow-up
  - `/legacy-registry` — story → draft profile
  - `/oral-history` — notes → tags/questions
  - `/final-splash` — remembrance draft assist
  - `/scholarships` — eligibility Q&A + interest form
  - Contact routing on homepage form
- Public copy softens “AI”; structuring still runs server-side.

## Remaining

1. **EIN issued 2026-11-17** — CP575 offline in Desktop Business Files only (never commit/paste number).
1b. **Stripe ISOLATION (hard):** YAT-YAS payments use **only** the Association Stripe business (`board@` / `acct_1UfNVKENhdhgrESP`). **Forbidden:** Keystone Group Holdings, Bridgeforge, Bridgevoice, `keystone_host` CLI profile, or any other portfolio keys. CLI/Keychain project: `yatyasassociation`. Vercel: `yatyas-hub`. Live keys + webhook already on Keychain/Vercel. Dashboard may still show “Action required” for extra account docs; charges enabled. Checklist: `docs/formation/stripe-go-live-checklist.md`.
1e. **Bank:** corp account open (2026-11-24). Routing + account number in macOS Keychain only (`YATYAS_BANK_*`, restricted) — never in Git/chat notes.
1c. **Welcome letter / Resend LIVE (2026-11-13):** Domain `yatyasassociation.com` verified on Resend. `RESEND_API_KEY` + `RESEND_FROM_EMAIL` on `yatyas-hub` (prod/preview/dev). From: `YAT-YAS Association <board@yatyasassociation.com>`. Smoke send to board@ OK. DNS: Custom MX keeps Private Email `@` MX + Resend `send` return-path MX.
1d. **Hub custom domain (2026-11-13):** **https://hub.yatyasassociation.com** live (DNS CNAME + Vercel verified). `yatyas-hub.vercel.app` **308** → hub custom domain. Welcome links use association host.
2. Confirm FormSubmit activation email to `board@` if not already.
3. Bank after EIN; SI-100 by **02/02/2027**.
4. Owner: after this commit/push, keep `site/.env.local` / `hub/.env.local` out of Git.
5. **Member Hub:** Live at **https://hub.yatyasassociation.com**. **Verified roster first** (email + first/last + tag on Approvals/Roster). Signup claims match → membership number on profile. Cover photo editable. President FW-001. **Shipped 2026-11-13:** Events/RSVP, DMs, directory, notifications, `/card`, announcements, albums, polls, @mentions, checklist, VIP reports, digest dry-run. **Registration lock (2026-11-13):** sequential tags across profiles+roster; First Wave cap **100**; auto-close when public seats fill; Board Roster panel can pause/resume or **open a different wave**. **Reserved (not auto-issued):** FW-001–010 + FW-013 (001 Jorge; 002 Jose; 003 Fausto held — assign manually on roster). Next public auto-tag **FW-011**. Password reset → `/auth/update-password`. **Waitlist (2026-11-13):** site `/first-wave` posts to Hub `/api/first-wave-waitlist` (live seat count); Board Approvals shows queue → Accept issues next public tag + roster + welcome letter (live Resend). **Board `/board` + live Stripe Checkout shipped 2026-11-24.**
6. **Association Gear shop:** Catalog shells in Supabase (crest tee, tracks cap, sticker pack, association coin) — all inactive, $0 placeholders until Board sets prices. Public page `/shop` interest form live. First Wave entrance Checkout is live; gear SKUs still inactive placeholders.
7. Later: live Crew Finder matching; Board First Wave + gear pricing; people photos with permission.
8. Optional: top up AI Gateway credits if free/paid tier limits bite.

## Do not

- Invent Secretary, Second Events Director, or First Wave pricing.
- Put family/supporter into First Wave (FW-001–100).
- Commit EIN, card receipts, or `site/.env.local`.
- Collect DD-214 / SSN on public forms.
- Put founder/director name roll call back on the homepage unless owner asks.
