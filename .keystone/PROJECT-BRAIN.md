# PROJECT BRAIN

> Cache of durable project context. **Code/docs win** if this conflicts with reality.
> Never store credentials, EIN, bank data, DD-214s, or member PII.

## PRODUCT

**YAT-YAS Association, Inc.** — California nonprofit public benefit corporation seeking IRC §501(c)(19) / R&TC §23701w.

Public GitHub: `qv6zktmm6r-wq/Yatyaslegacy` · Domain: **YATYASAssociation.com**  
Local: `/Volumes/KEYSTONE-WORK/01-ACTIVE-PROJECTS/YATYASASSOCIATION`

## LOCKED FACTS

| Item | Value |
|---|---|
| Entity No. | **B20260476255** |
| File date | **2026-11-04** |
| Status | **Active** |
| SI due | **2027-02-02** |
| Address / Agent | 1253 Sunset Avenue, Perris, CA 92571 · Jorge A. Mejia Lozoya |
| Board | 7 seats; Seat 1 Jorge (protected Founder); Seat 2 Jose (protected Co-Founder); Seat 3 Fausto; 4–7 open |
| Officers named | President Jorge; VP Jose; Treasurer Victoria; Events Elvira; Secretary open |
| Fiscal year | Oct 1 – Sep 30 |
| Spend tiers | <$1k / $1k–$5k dual / >$5k board |
| First Wave / dues $ | **$100** entrance → welcome package; ongoing **$5/month** → scholarships, events, programs (2026-11-13). Checkout pending Stripe keys. |

## CURRENT STATE (2026-11-24)

**Phase 1 complete. EIN issued 2026-11-17** — CP575 offline Desktop Business Files only (number never in Git/Brain/chat).
**Official crest (2026-11-24):** Owner shield mark is canonical. Source `site/assets/crest-official.jpg`; web/email `site/assets/crest-transparent.png`; favicons crest-derived on site + hub. Synced to hub/public, letters, correspondence, signing. Prior crest archived as `crest-previous-transparent.png` (do not ship).
**Mailbox:** `board@yatyasassociation.com` live (Namecheap Private Email).
**Site:** production live with premium program pages + `/api/assist` (AI Gateway). First Wave service + waitlist → Hub.
**Member Hub:** Live at https://hub.yatyasassociation.com · Supabase **YATYAS Association** (`tfavgqqqagcqhfeeutzc`). Registration wave lock + reserved FW tags shipped.
**Board payments (2026-11-24):** Ledger + RPCs **applied** on live Supabase; Hub code for `/board`, Checkout, webhook (paid + async), success poll, Board override, refunds-keep-tags. Stripe keys + hub deploy still owner-gated.
**Gear shop:** `/shop` interest page live; catalog shells inactive until Board prices; Stripe not wired.  
Command Deck coin SKUs deactivated on this DB. Shopify never connected.

## NEXT

1. Finish YAT-YAS Stripe account (board@) + attach corp bank from Keychain (not Keystone Stripe)
2. Commit/push hub+site → deploy yatyas-hub → Stripe keys + webhook → First Wave Checkout ($100 + $5/mo)
3. Deploy crest assets to production CDN
4. SI-100 by 02/02/2027
5. Board gear SKU prices + Stripe for shop
6. Later: live Crew Finder search; Form 1024 path

## LAST VERIFIED

- 2026-11-24 payment RPCs + RLS verified on `tfavgqqqagcqhfeeutzc` (issue/board_mark/record_monthly/mark_refunded/holds)
- 2026-11-24 official crest rolled to site/hub/favicons/letters/email URL path (deploy still needed for production CDN)
- 2026-11-17 EIN CP575 on Desktop Business Files (number not recorded here)
- 2026-11-12 via bizfile My Records + stamped Articles
- 2026-11-12 Namecheap Private Email: board@ ON; dig MX → privateemail.com
- 2026-11-12 production program pages HTTP 200 on yatyasassociation.com
