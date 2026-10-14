# 2026-10-14 (Claude Code cloud, buyer visit attribution, GA4 landing-page audiences, lead-source doors)

Branch `claude/agent-navigation-efficiency-dp5zj5`, PR #566. Main merged in, never rebased. Nobody pushes main. Nothing sent. Prod Supabase read-only (row reads only).

**In #566 (Matt's answers of 2026-10-09 and 2026-10-14)**
- Buyer doors carry the channel, campaign and ad-content tags of the visit the sign-up happens in: the alert signup, guest save, price watch, signed-in saved search, `/buy/<intent>`, `/buy/leverage` and `/buy/concessions`. The rule is `signupAttribution` (`lib/crm/visit-attribution.ts`), which reads `visitor_sessions.landing_page`. The tab-lifetime `rr_lp_context` is gone.
- GA4: `view_landing_page` fires from `components/tracking/LandingPageViewTracker.tsx`, on live landing pages only. "High-intent sellers" is rebuilt as `audiences/16124906126` (`scroll_depth`, `page_type` sell, `depth` > 74), and the old one is renamed "(retired 2026-10-14, never matched)". `scripts/ga4-admin.mjs apply-audiences` runs the audience step alone.
- FUNNEL-4 leftovers: nine site doors wrote the site host as `crm_people.source`, and each now writes its own label:
  - the CMA download (`published-cma`) and the pricing read (`listing-pricing-read`)
  - the signed-in saved search (`idx-registration`)
  - the payment email (`listing-payment-email`)
  - the CMA PDF route (`cma-request`)
  - the `/buy` form (`buyer-lp` / `seller-lp`)
  - the page CTA (`homepage-cta` / `blog-email`)
  - the rental calculator (`rental-calculator`)
  - the Tetherow endpoint (`tetherow-seller-lp` / `tetherow-buyer-lp`)
- `ci:crm-lead-integrity` reads every `sendEvent` / `ensureNativeLead` with the TypeScript checker. `SOURCE_ALLOWED` lists, with reasons, the four writes it cannot read down to a label, and it fails a stale entry.
- Lead-flow report: the wiring table shows all 14 rows (a 12-row cap hid two). Each listing-page ask has its own row, and the alerts row counts `buy-alerts`.
- Response clock (Matt 2026-10-14): the market and FAQ questions (`homepage-cta`) and the listing pricing read (`listing-pricing-read`) are on it. The market-analysis download and the newsletter are not. A listed owner who fills in either form now counts as inbound (`isOutreachListOnly`).

**Next.**
- When CI is green, the PR merges; the auto-merge workflow squash-merges a ready PR.
- Then run `npm run deploy:verify <merge sha>`.
- In a few days, read GA4 for `view_landing_page` on /sell and /buy, and check the LP-visitor audiences are filling.

**Held.** The standing holds in `README.md` here. Leave the full `scripts/ga4-admin.mjs apply` unrun. `apply-audiences` is the audience step alone.

Skills read: built-in `code-review`, `docs/analytics/README.md`, CLAUDE.md §0 §1 §6 §7 §8.
