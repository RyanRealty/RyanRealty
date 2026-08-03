# DSCR deal finder — mission goal

**Status:** live · opened 2026-08-03 · owner: codebase agent
**Surface:** `/admin/dscr` · DAL `lib/data/dscr/screen.ts` · table `public.dscr_rent_estimates`

## What exists when this is finished

1. **Discoverable.** `/admin/dscr` is reachable from the admin navigation, not
   only by typing the URL.
2. **Ranked by one number.** A composite **Deal Score** answers "which of these
   is the best investment" in a single sortable column, and its formula is
   printed on the page so nobody has to trust a black box.
3. **Emailable.** Matt can select properties and produce an email of the list to
   a named recipient. The email is **staged as a draft for his approval and is
   never sent by an agent** (CLAUDE.md §1 — outbound messages to real people are
   per-action approval).
4. **Accurate to the person receiving it.** Every figure in the email traces to a
   named source with a fetch date. Assumptions (rate, down payment, operating
   costs) are stated in the email itself, not buried.

## What a real user does

Matt opens admin → clicks **DSCR deals** → sees Central Oregon inventory ranked
by Deal Score, best first → filters by county/price/DSCR → selects the ones worth
sending → previews the email → approves → it sends.

## The bar

- Full `npm run ci:gates` chain passes.
- The page is rendered and verified in a real browser, logged in, not assumed.
- Numbers on the rendered page match a direct database query.
- No email leaves the system without Matt's explicit per-action approval.
- Manufactured-home rent estimates carry their known weakness on the surface.

## Deal Score definition

Percentile-ranked within currently-scored inventory, so the score answers "best
among what is actually buyable right now" rather than against an absolute scale
that drifts with the market. Components and weights:

| Component | Weight | Why |
|---|---|---|
| Cash-on-cash return | 40% | The investor's actual return on cash in. |
| DSCR headroom over 1.00 | 25% | Financeability plus margin before it stops covering debt. |
| Monthly cash flow (absolute $) | 20% | A 30% return on $20K is not the same deal as on $200K. |
| Price margin (buy-at vs asking) | 15% | How much room before the deal stops working. |

Properties with no rent estimate are unscored, never scored as zero — an unknown
is not a bad deal, and scoring it zero would bury it silently.

## Known data caveats carried to the surface

- Winners skew to `Manufactured On Land`, which is where Zillow rentZestimate is
  weakest (thin rental comp sets). Flagged per row.
- The DSCR rate is an assumption pending a lender term sheet. Market is
  6.125–7.5% (Aug 2026); the model runs 6.875%.
- DSCR 1.00 is the lender's test, not profitability. True break-even lands near
  **1.30** once vacancy, management, maintenance and reserves are paid.

## Progress log

- 2026-08-03 — screen shipped (`ac1a6cac`), scoped to Central Oregon (`71d34642`).
  2,037 of 2,313 priced; 221 clear DSCR 1.00, 27 clear 1.25, 19 cash flow.
