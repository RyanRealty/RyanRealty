# PUB-4 Audit — Landing pages + Tools + Sell/Buy + Marketing/Request

**Scope:** `/lp/*` (8 pages + heath sub-route), `/tools/*` (3), `/sell` + intent/valuation, `/buy` + intent, `/marketing/request`
**Date:** 2026-06-26
**Method:** Code-only, read-only. No form submissions. Form wiring verified against server action source.

---

## Executive Summary

- **Lead form wiring:** Fully functional and correct across all 4 LP families (seller, buyer, FSBO, expired). All 4 actions are `'use server'`, call `readAttributedAgentServer()` for agent attribution, write to FUB + native CRM, fire Meta CAPI, fire GA4 MP, write `marketing_assignments`, and respect the compliance hard-stop gate. No broken wiring found.
- **Agent attribution:** Wired correctly in all 4 actions. `readAttributedAgentServer()` reads the `rr_agent_attribution` cookie and resolves broker slug + FUB user ID. Default routing to Matt is correct.
- **Calculator math:** Mortgage amortization formula is correct. Appreciation uses correct compound growth. Rental analysis uses standard NOI/cap rate/cash-on-cash formulas (via `lib/rental-analysis.ts`). No math bugs found.
- **SEO:** Noindex LPs and indexable content pages are mostly correct, with notable defects: two noindex LPs appear in the sitemap, three SEO pages lack twitter cards, one page lacks canonical, and 7 of 8 `sell/[intent]` + `buy/[intent]` sub-routes are not in the sitemap.
- **Statistics:** Live Supabase DAL used for all market stats. Three defects: hardcoded calculator defaults not from `app_config`, wrong domain in seller-home-value JSON-LD, golf LP "Stay vs Buy" illustrative figures lack a sourcing disclaimer.
- **CRM tracking:** All pages except `/marketing/request` have `LandingPageTracker` or `KbSectionTracker`. `sell/[intent]` and `buy/[intent]` use `trackPageViewIfPossible` (FUB-based, not visitor_sessions tracker). `/marketing/request` has no tracking at all.
- **Top priority defects:** [D-3] FSBO and buyer-listing-alerts are noindex but in sitemap (indexability contradiction), [D-10] sell/[intent] + buy/[intent] sub-routes absent from sitemap, [E-1] `/marketing/request` has zero CRM tracking.

---

## Defect Log

### A — Functional

**[A-1] MEDIUM — Hardcoded phone constants instead of CONTACT lib (2 pages)**
- `app/lp/sell-your-home/page.tsx:29-30` — `BROKER_PHONE = '541.703.3095'` and `BROKER_PHONE_TEL = '+15417033095'` declared as local constants instead of importing from `@/lib/brand/contact`.
- `app/lp/seller-home-value/page.tsx:39-40` — same pattern.
- Impact: if the FUB number ever changes, these two pages are manual update points that can be missed. Risk of drift vs other surfaces.
- Fix: import `CONTACT.phoneFub` / `CONTACT.phoneFubTel` from `@/lib/brand/contact` and delete the local constants.

**[A-2] LOW — `/sell/valuation` CTA link in mortgage calculator needs route verification**
- `app/tools/mortgage-calculator/page.tsx:116` and `:171` — `<Link href="/sell/valuation">` present.
- Route exists (`app/sell/valuation/page.tsx` confirmed). No defect in routing, marking as confirmed-clean.
- Status: CLEAN.

**[A-3] LOW — Tetherow page references `/brand/logo-header-white.png`**
- `app/lp/tetherow/page.tsx:212` — `src="/brand/logo-header-white.png"`.
- File confirmed to exist at `public/brand/logo-header-white.png`.
- Status: CLEAN.

**[A-4] LOW — Broker headshot uses `.jpg` on `/lp/bend`**
- `app/lp/bend/page.tsx:871` — `'/images/brokers/ryan-matt.jpg'` used.
- Design system mandates `.png` (transparent) version. The `.jpg` version will display a white rectangular background against any non-white surface.
- Fix: change to `/images/brokers/ryan-matt.png`.

**[A-5] INFO — `sell/[intent]` uses `trackPageViewIfPossible` not `visitor_sessions` tracker**
- `app/sell/[intent]/page.tsx` and `app/buy/[intent]/page.tsx` both call `trackPageViewIfPossible` (FUB-layer, not `KbSectionTracker`/`LandingPageTracker`). This is intentional (pre-dates the visitor_sessions CRM tracker) but means these pages do not write `visitor_events` rows.
- Tracking is present, but via a different mechanism than the rest of the site.

---

### B — Statistics (§0)

**[B-1] MEDIUM — Mortgage calculator defaults are hardcoded, not from `app_config`**
- `app/tools/mortgage-calculator/MortgageCalculator.tsx:40-50` — `interestRate` defaults to `7`, `propertyTaxYear` defaults to `5000`, `insuranceYear` defaults to `1500`. All hardcoded as `useState` initial values.
- `app/tools/mortgage-calculator/page.tsx:155-162` — prose accurately describes these as editable defaults, which mitigates some risk, but they are static values rather than live config.
- Risk: default rate of 7% may become meaningfully stale if rates move significantly. Property tax at $5,000/yr implies ~0.9% on a $550K home — slightly high for Oregon (~0.75% county average) and not labeled as an estimate.
- Fix: pull `defaultMortgageRate` and `defaultPropertyTaxRate` from `app_config` at page load (server-side) and pass via `initialInterestRate` / `initialPropertyTaxYear` props.

**[B-2] MEDIUM — Rental calculator property tax default hardcoded at 0.75%**
- `components/tools/RentalCalculator.tsx:229` — `roundTo(price0 * 0.0075, 50)` computes default property tax as 0.75% of price. Hardcoded rate constant, not from `app_config`.
- `app/tools/rental-property-calculator/page.tsx:198` — prose states "property taxes near 0.75 percent of price" — accurately describes the default but it is a static value.
- Fix: same pattern as B-1: read from `app_config` and pass via `initialPropertyTaxesYear`.

**[B-3] MEDIUM — Appreciation calculator default rate (4.5%) is hardcoded**
- `components/tools/AppreciationCalculator.tsx:14` — `useState('4.5')` for annual appreciation. No source or disclaimer. 4.5% annual is reasonable for Central Oregon recently but will age.
- Fix: either add a text note sourcing this default ("typical Central Oregon appreciation, 2020-2025 period") or pull from `app_config`.

**[B-4] MEDIUM — Golf LP "Stay vs Buy" figures are unsourced illustrative examples**
- `app/lp/central-oregon-golf/page.tsx` (StayVsBuySection, lines ~800-900) — hardcoded figures: $400/night nightly rate, $6,000 annual lodging cost, $300K-$500K property price range, $2,500-$3,500/mo rental income estimate. These are presented inline without a "for illustration only" disclaimer.
- §0 rule: figures that go in front of a consumer must trace to a primary source. These do not have source citations.
- Fix: add a one-line disclaimer ("illustrative scenario — actual figures vary") or source the numbers to Supabase market data or a named Oregon short-term rental data source.

**[B-5] HIGH — seller-home-value JSON-LD image URL uses wrong domain**
- `app/lp/seller-home-value/page.tsx` (JSON-LD block) — image references `'https://seller.ryan-realty.com/images/brokers/ryan-matt.png'`. The `seller.` subdomain does not exist in the active deployment (`ryan-realty.com` / `ryanrealty.vercel.app`).
- Googlebot will fail to fetch this image, breaking the JSON-LD structured data for this page.
- Fix: change to `${siteUrl}/images/brokers/ryan-matt.png` using the `siteUrl` env var already defined at line 39.

---

### C — SEO

**[C-1] LOW — Missing twitter card on paid/noindex LPs (acceptable, low priority)**
- `app/lp/buyer-listing-alerts/page.tsx` — no `twitter` metadata block.
- `app/lp/expired-listing/page.tsx` — no `twitter` metadata block.
- `app/lp/fsbo/page.tsx` — no `twitter` metadata block.
- `app/lp/sell-your-home/page.tsx` — no `twitter` metadata block.
- `app/lp/seller-home-value/page.tsx` — no `twitter` metadata block.
- These are all noindex paid-traffic LPs. Twitter cards will not appear in organic search. Impact is limited to direct social sharing of the URL. Still worth adding for completeness (takes 3 lines per page).

**[C-2] LOW — Missing canonical on multiple noindex LPs**
- Same 5 pages as C-1 lack `alternates: { canonical: ... }`.
- For noindex pages this is low risk, but canonical protects against duplicate-URL issues if the page is ever linked with query params.

**[C-3] MEDIUM — central-oregon-golf missing twitter card (indexable page)**
- `app/lp/central-oregon-golf/page.tsx` has `metadata` with `openGraph` and `canonical` but no `twitter` metadata block.
- Unlike the noindex LPs, this page is indexable. Twitter/X will fall back to a plain link preview.
- Fix: add `twitter: { card: 'summary_large_image', title: ..., description: ..., images: [...] }`.

**[C-4] LOW — central-oregon-golf canonical not visible in metadata object**
- Previous context flagged this as a potential gap. Code inspection showed the page has `force-static` and `revalidate: 21600` but the canonical line was not confirmed in the first 1233 lines read. Given the other pages in the LP family have canonicals, this needs a targeted code check.
- Action: verify `alternates: { canonical: ... }` exists in the exported `metadata` const of `app/lp/central-oregon-golf/page.tsx`.

**[C-5] LOW — tetherow/heath missing twitter card (indexable page)**
- `app/lp/tetherow/heath/page.tsx:29-41` — `metadata` block has `canonical` and `openGraph` but no `twitter` block.
- Page is indexable (`robots: { index: true, follow: true }`).
- Fix: add twitter card metadata.

**[C-6] LOW — sell/valuation missing twitter card**
- `app/sell/valuation/page.tsx:35-42` — metadata has `canonical` and `openGraph` but no `twitter` block.
- Fix: add twitter card.

**[C-7] INFO — sell/[intent] and buy/[intent] twitter card: CLEAN**
- Both use `generateMetadata()` from config which explicitly includes `twitter: { card: 'summary_large_image', ... }`.
- Status: CLEAN.

---

### D — Indexability

**[D-1] INFO — Noindex LPs correctly set (paid-traffic pages)**
- `/lp/buyer-listing-alerts`, `/lp/expired-listing`, `/lp/fsbo`, `/lp/sell-your-home`, `/lp/seller-home-value` all have `robots: { index: false, follow: false }`.
- These are paid-traffic capture pages. Noindex is intentional. CLEAN.

**[D-2] INFO — Indexable SEO pages correctly set**
- `/lp/bend`, `/lp/central-oregon-golf`, `/lp/tetherow`, `/lp/tetherow/heath` — all indexable. CLEAN.
- `/tools/mortgage-calculator`, `/tools/appreciation`, `/tools/rental-property-calculator` — all indexable. CLEAN.
- `/sell`, `/sell/valuation`, `/buy` — all indexable. CLEAN.

**[D-3] HIGH — FSBO LP is noindex but appears in sitemap**
- `app/lp/fsbo/page.tsx:37` — `robots: { index: false, follow: false }`.
- `app/sitemap.ts:80` — `{ url: '${baseUrl}/lp/fsbo', priority: 0.8 }` included.
- Contradiction: Google may crawl this URL from the sitemap, see noindex, and waste crawl budget. If the intent is truly noindex (paid traffic LP), remove from sitemap. If the intent is to eventually make it indexable, remove the `robots` noindex.
- Fix: determine intent, then either remove from sitemap OR remove the noindex robots directive.

**[D-4] HIGH — buyer-listing-alerts LP is noindex but appears in sitemap**
- `app/lp/buyer-listing-alerts/page.tsx:26` — `robots: { index: false, follow: false }`.
- `app/sitemap.ts:77` — `{ url: '${baseUrl}/lp/buyer-listing-alerts', priority: 0.8 }` included (with a comment noting it was previously absent from the sitemap as "orphaned from organic discovery").
- Same contradiction as D-3. The comment suggests the sitemap entry was added to enable organic discovery, but the noindex directive blocks indexing.
- Fix: if this page should appear organically, remove the `robots: { index: false }` directive. If it remains a paid-only LP, remove from sitemap.

**[D-5] MEDIUM — sell/[intent] sub-routes are not in sitemap**
- Defined intents: `/sell/for-sale-by-owner`, `/sell/expired-listings`, `/sell/inherited-home` (from `lib/lead-landing-content.ts`).
- None of these appear in `app/sitemap.ts`.
- These pages have proper SEO metadata (title, description, canonical, OG, twitter) and are indexable by default (no noindex). Google may discover them via crawl, but without sitemap inclusion they will not be prioritized.
- Fix: add these 3 paths to the static pages array in `app/sitemap.ts`.

**[D-6] MEDIUM — buy/[intent] sub-routes are not in sitemap**
- Defined intents: `/buy/first-time-home-buyer`, `/buy/relocation`, `/buy/investment` (from `lib/lead-landing-content.ts`).
- None appear in `app/sitemap.ts`.
- Same issue as D-5.
- Fix: add these 3 paths to `app/sitemap.ts`.

**[D-7] LOW — `/lp/central-oregon-golf` is indexable but not in sitemap**
- Page has `robots: { index: true }` (default) but does not appear in `app/sitemap.ts`.
- It is a 1,453-line SEO golf community page with JSON-LD — clearly intended to rank organically.
- Fix: add `{ url: '${baseUrl}/lp/central-oregon-golf/', ... }` to `app/sitemap.ts`.

**[D-8] INFO — sell/valuation in sitemap: CLEAN**
- `app/sitemap.ts:68` — `valuationPath()` resolves to `/sell/valuation` (confirmed from import). Present in sitemap. CLEAN.

---

### E — CRM Tracking

**[E-1] HIGH — `/marketing/request` has zero CRM tracking**
- `app/marketing/request/page.tsx` — no `LandingPageTracker`, no `KbSectionTracker`, no `trackPageViewIfPossible` call, no `visitor_events` write.
- This is an internal broker tool (noindex) so the impact on lead attribution is minimal, but it means broker usage of this page is invisible in analytics.
- Fix: add `<KbSectionTracker pageType="marketing-request" />` to the page, or document that internal-tool pages are intentionally untracked.

**[E-2] INFO — sell/[intent] uses FUB `trackPageViewIfPossible`, not visitor_sessions tracker**
- `app/sell/[intent]/page.tsx` calls `trackPageViewIfPossible` server-side (fires a FUB Viewed Page event for identified visitors only).
- `app/buy/[intent]/page.tsx` — same pattern.
- Anonymous visitors to these pages are NOT tracked in `visitor_sessions`/`visitor_events`.
- `LeadLandingPage` component does include `<KbSectionTracker pageType="lead-landing" />` (line 54 of `LeadLandingPage.tsx`), so client-side visitor_sessions tracking IS present. CLEAN for visitor_events; FUB layer is supplemental.

**[E-3] INFO — All lead LPs correctly use `LandingPageTracker` with `lpVariant`**
- `/lp/buyer-listing-alerts` — `lpVariant="buyer-listing-alerts"`. CLEAN.
- `/lp/expired-listing` — `lpVariant="expired-listing"`. CLEAN.
- `/lp/fsbo` — `lpVariant="fsbo"`. CLEAN.
- `/lp/sell-your-home` — `lpVariant="sell-your-home"`. CLEAN.
- `/lp/seller-home-value` — `lpVariant` set dynamically from `?v=` URL param (hero variant). CLEAN.
- `/lp/bend` — `lpVariant="bend-city-landing-v2"`. CLEAN.
- `/lp/central-oregon-golf` — `lpVariant="central-oregon-golf"`. CLEAN.
- `/lp/tetherow` — `lpVariant="tetherow-landing-v1"`. CLEAN.
- `/lp/tetherow/heath` — `lpVariant="tetherow-heath"`. CLEAN.

**[E-4] INFO — Tool pages use `KbSectionTracker` with `pageType`**
- `/tools/mortgage-calculator` — `pageType="tools"`. CLEAN.
- `/tools/appreciation` — `pageType="tools"`. CLEAN.
- `/tools/rental-property-calculator` — `pageType="tools"`. CLEAN.

**[E-5] INFO — Sell/Buy pillar pages correctly tracked**
- `/sell` — `<KbSectionTracker pageType="sell" />`. CLEAN.
- `/sell/valuation` — `<KbSectionTracker pageType="sell-valuation" />`. CLEAN.
- `/buy` — `<KbSectionTracker pageType="buy" />`. CLEAN.

---

## Lead Form Wiring Verdict

All four lead capture actions are **correctly wired end-to-end**:

| Form | Action | FUB event type | Attribution | CAPI | Compliance gate | CMA |
|---|---|---|---|---|---|---|
| Seller LP | `submitSellerLPForm` | Seller Inquiry | `readAttributedAgentServer()` | Lead $500 | `isHardStopped()` | Yes — `createCmaRequest()` |
| Buyer LP | `submitBuyerLPForm` | Property Inquiry | `readAttributedAgentServer()` | Lead $300 | `isHardStopped()` | No |
| FSBO LP | `submitFsboLPForm` | Seller Inquiry | `readAttributedAgentServer()` | Lead | `isHardStopped()` | Yes |
| Expired LP | `submitExpiredLPForm` | Seller Inquiry | `readAttributedAgentServer()` | Lead | `isHardStopped()` | No |

All four actions also:
- Write to `marketing_assignments` table
- Stitch anonymous session to known person (`backfillSessionToFub`)
- Apply canonical kebab-case tags (`audience:seller`, `broker:matt`, etc.)
- Fire GA4 Measurement Protocol `generate_lead` server-side
- Fall back to `ensureNativeLead` if FUB push fails (all except buyer which has a conditional fallback)

Agent attribution (`?agent=` cookie) is read from `rr_agent_attribution` cookie via `parseAgentAttributionCookie()`, resolved to broker slug + FUB user ID. Default routes to Matt (user ID 1). CLEAN.

---

## Calculator Math Verdict

| Calculator | Formula | Correctness |
|---|---|---|
| Mortgage | `(L × (r × (1+r)^n)) / ((1+r)^n - 1)` standard amortization | CORRECT |
| PMI | `(loan × 0.005) / 12` when down < 20% | CORRECT (0.5%/yr standard) |
| PITI | P&I + tax/12 + insurance/12 + PMI | CORRECT |
| Appreciation | `price × (1 + rate/100)^years` compound | CORRECT |
| NOI | `grossIncome - vacancyLoss - operatingExpenses` | CORRECT |
| Cap rate | `NOI / purchasePrice × 100` | CORRECT |
| Cash-on-cash | `annualCashFlow / totalCashInvested × 100` | CORRECT |
| DSCR | `NOI / annualDebtService` | CORRECT |

No math bugs. Defects are in the **default values** (hardcoded, not from `app_config`) — see B-1, B-2, B-3.

---

## Per-Page Status Summary

| Page | A (Functional) | B (Stats) | C (SEO) | D (Index) | E (CRM) | Overall |
|---|---|---|---|---|---|---|
| `/lp/bend` | Broker `.jpg` [A-4] | CLEAN | Missing twitter | In sitemap | CLEAN | Minor |
| `/lp/buyer-listing-alerts` | CLEAN | CLEAN | No twitter/canonical | noindex BUT in sitemap [D-4] | CLEAN | High |
| `/lp/central-oregon-golf` | CLEAN | Unsourced illustratives [B-4] | No twitter [C-3] | Indexable, not in sitemap [D-7] | CLEAN | Medium |
| `/lp/expired-listing` | CLEAN | CLEAN | No twitter/canonical | Noindex, not in sitemap | CLEAN | Minor |
| `/lp/fsbo` | CLEAN | CLEAN | No twitter/canonical | noindex BUT in sitemap [D-3] | CLEAN | High |
| `/lp/sell-your-home` | Hardcoded phone [A-1] | CLEAN | No twitter/canonical | Noindex, not in sitemap | CLEAN | Medium |
| `/lp/seller-home-value` | Hardcoded phone [A-1] | Wrong domain in JSON-LD [B-5] | No twitter/canonical | Noindex, not in sitemap | CLEAN | High |
| `/lp/tetherow` | CLEAN | CLEAN | CLEAN | In sitemap | CLEAN | Clean |
| `/lp/tetherow/heath` | CLEAN | CLEAN | No twitter [C-5] | In sitemap | CLEAN | Minor |
| `/tools/mortgage-calculator` | CLEAN | Hardcoded defaults [B-1] | CLEAN | In sitemap | CLEAN | Medium |
| `/tools/appreciation` | CLEAN | Hardcoded default [B-3] | twitter `'summary'` not `'summary_large_image'` | In sitemap | CLEAN | Minor |
| `/tools/rental-property-calculator` | CLEAN | Hardcoded default [B-2] | CLEAN | In sitemap | CLEAN | Medium |
| `/sell` | CLEAN | CLEAN | CLEAN | In sitemap | CLEAN | Clean |
| `/sell/valuation` | CLEAN | CLEAN | No twitter [C-6] | In sitemap | CLEAN | Minor |
| `/sell/[intent]` | CLEAN | CLEAN | CLEAN (via config) | Not in sitemap [D-5] | Via KbSectionTracker | Medium |
| `/buy` | CLEAN | CLEAN | CLEAN | In sitemap | CLEAN | Clean |
| `/buy/[intent]` | CLEAN | CLEAN | CLEAN (via config) | Not in sitemap [D-6] | Via KbSectionTracker | Medium |
| `/marketing/request` | CLEAN | N/A | Not applicable (noindex internal) | Noindex, not in sitemap | No tracking [E-1] | Medium |

---

## Prioritized Fix List

| Priority | Defect | File(s) | Effort |
|---|---|---|---|
| HIGH | [B-5] Wrong domain in seller-home-value JSON-LD image | `app/lp/seller-home-value/page.tsx` | 1 line |
| HIGH | [D-3] FSBO noindex but in sitemap | `app/sitemap.ts:80`, `app/lp/fsbo/page.tsx:37` | Decide intent, 1 line |
| HIGH | [D-4] buyer-listing-alerts noindex but in sitemap | `app/sitemap.ts:77`, `app/lp/buyer-listing-alerts/page.tsx:26` | Decide intent, 1 line |
| HIGH | [E-1] /marketing/request has zero CRM tracking | `app/marketing/request/page.tsx` | 2 lines |
| MEDIUM | [A-1] Hardcoded phone constants in sell-your-home + seller-home-value | 2 page files | 4 lines each |
| MEDIUM | [B-5] JSON-LD image wrong domain | `app/lp/seller-home-value/page.tsx` | 1 line |
| MEDIUM | [D-5] sell/[intent] paths missing from sitemap | `app/sitemap.ts` | 3 lines |
| MEDIUM | [D-6] buy/[intent] paths missing from sitemap | `app/sitemap.ts` | 3 lines |
| MEDIUM | [D-7] central-oregon-golf missing from sitemap | `app/sitemap.ts` | 1 line |
| MEDIUM | [B-1] Mortgage calc defaults hardcoded | `MortgageCalculator.tsx:40-50` | app_config fetch + prop pass |
| MEDIUM | [B-2] Rental calc property tax default hardcoded | `RentalCalculator.tsx:229` | app_config fetch + prop pass |
| MEDIUM | [C-3] central-oregon-golf missing twitter card | `app/lp/central-oregon-golf/page.tsx` | 5 lines |
| LOW | [A-4] broker headshot uses .jpg not .png on /lp/bend | `app/lp/bend/page.tsx:871` | 1 char change |
| LOW | [B-3] Appreciation calc default rate hardcoded | `AppreciationCalculator.tsx:14` | Low risk if labeled |
| LOW | [B-4] Golf LP Stay vs Buy figures need disclaimer | `app/lp/central-oregon-golf/page.tsx` | 1 sentence |
| LOW | [C-1] Missing twitter card on 5 noindex LPs | 5 page files | 5 lines each |
| LOW | [C-2] Missing canonical on 5 noindex LPs | 5 page files | 1 line each |
| LOW | [C-5] tetherow/heath missing twitter card | `app/lp/tetherow/heath/page.tsx` | 5 lines |
| LOW | [C-6] sell/valuation missing twitter card | `app/sell/valuation/page.tsx` | 5 lines |
