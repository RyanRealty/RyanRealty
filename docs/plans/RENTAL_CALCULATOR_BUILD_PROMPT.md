# Build Prompt — Ryan Realty Rental Property Calculator (full project, hand-off)

**Hand this entire file to the implementing agent.** It is self-contained: a fresh agent working in the `RyanRealty` repo can build the whole feature from this alone. Supporting reference (optional depth): the DealCheck teardown in `docs/plans/DEALCHECK_INVESTMENT_ANALYZER_SPEC_2026-06-08.md` and the three real sample reports in `out/dealcheck-recon/{rental,brrrr,flip}-report.pdf`.

---

## 1. What you are building

A free **long-term rental (buy & hold) investment calculator** for Ryan Realty (a Bend, OR brokerage; Next.js 16 + React 19 + Supabase + a shadcn-based design system). Two surfaces, one engine, one component:

1. **Embedded on every listing detail page** (`app/listing/[listingKey]/page.tsx`), pre-filled from that property (price, beds, baths, sqft, taxes, address) plus an estimated rent. **This is the primary goal — "on every listing page."**
2. **Standalone page** at `/tools/rental-property-calculator` for SEO and for investors without a specific property.

The visitor adjusts price, financing, rent, vacancy, and operating expenses and instantly sees **monthly cash flow, cap rate, cash-on-cash return, total cash needed**, a cash-flow breakdown, and a 30-year equity/cash-flow projection. It is **completely free with no gate**; the only optional ask is "email me this analysis (PDF)" / "have a Ryan Realty agent review this deal," which creates a Follow Up Boss lead.

Scope is **long-term rental only**. No BRRRR, no flip, no multi-family rent roll (those are future modes; ignore them).

---

## 2. Current state — a working foundation already exists (BUILD ON THIS)

The following is **already built, verified working in the browser, and passing CI** (but **uncommitted** — see the draft-first rule in §3). If these files are present in your working tree, extend them; if absent, recreate them from the specs below.

| File | What it is | Status |
|---|---|---|
| `lib/rental-analysis.ts` | Pure calculation engine — `analyzeRental(inputs)`, `remainingBalance(...)`, `formatUSD`, `formatPct`. No I/O, no React. | ✅ Done, verified |
| `lib/rental-analysis.test.ts` | 14 Vitest cases. Reproduces DealCheck's published rental-sample numbers exactly. Run with `npm test`. | ✅ Done, passing |
| `components/tools/RentalCalculator.tsx` | The client UI. Already built to be **embeddable** — props: `initialPrice`, `initialRent`, `initialPropertyTaxesYear`, `initialDownPaymentPct`, `initialInterestRate`, `propertyLabel`, `rentEstimate {value, low?, high?, source?}`, `embedded`. Live `useMemo` recompute; 4 KPI tiles; down-payment slider; cash-flow breakdown; collapsible 30-year projection (chart + milestone table); glossary tooltips; CTA buttons; disclaimer. | ✅ Done, verified |
| `components/tools/EquityProjectionChart.client.tsx` | recharts area chart (property value + equity over time), lazy-loaded via `next/dynamic` (ssr:false). | ✅ Done |
| `app/tools/rental-property-calculator/page.tsx` | Standalone page. Mirrors `app/tools/mortgage-calculator/page.tsx`: hero, breadcrumb, metadata/canonical, "how to use" card, and `searchParams` pre-fill (`?price=&rent=&taxes=&down=&rate=`). Carries `// @no-parity` and `// @data-free` markers (required by gates for tool pages). | ✅ Done |
| `app/tools/rental-property-calculator/loading.tsx` | Skeleton. | ✅ Done |

**Verified:** numbers match a hand-calc and DealCheck's sample (e.g. $650k / 25% down / $3,250 rent → cash flow −$1,431/mo, cap rate 3.7%, cash needed $162,500); live reactivity works; chart + table render; no console errors; passes `ci:design-tokens`, `ci:brand-voice`, `ci:heading-display`, `ci:hydration-safety`, `ci:seo-routes`, `ci:nav-reachability`, `ci:internal-links`, `ci:page-dal`, `ci:static-params`, ESLint.

**Your job is the rest of the project** (§6): the listing-page embed, the rent/value estimate, the FUB lead capture, the branded PDF, and discoverability.

---

## 3. Hard rules (non-negotiable — read `CLAUDE.md` for the full text)

1. **§0 Data accuracy (outranks everything; Matt is a licensed principal broker).** Every number shown must be correct and traceable. Any rent/value/comp figure is an **estimate** — label it as such, show a range, never present it as a guarantee. Never fabricate comps. The engine's unit tests must keep passing.
2. **§0.5 Draft-first, commit-last.** Build to the working tree, show Matt the result, and **wait for his explicit approval before committing or pushing.** Do not commit unreviewed work. The existing foundation is intentionally uncommitted for this reason.
3. **Brand voice** (applies to all on-page + PDF copy): no em-dashes, no semicolons, no banned words ("stunning, nestled, robust, seamless, elevate, leverage," etc.), sentence case, "you/your" = the reader, "we/our team" = the brokerage. Phone `541.213.6706`, web `ryan-realty.com`.
4. **Design system only.** Every control is a `@/components/ui/` component (Button, Card, Input, Select, Slider, Tabs, Tooltip, Table, Accordion, Switch, Label, Separator…). Use color **tokens** (`bg-primary`, `text-muted-foreground`, `border-border`, `text-success`, `text-destructive`), never raw hex (recharts is the only place brand hex `#102742` / `rgba(16,39,66,…)` is allowed). Display headings via `H1`/`H2`/`H3` from `components/site/primitives` (Amboqia). Body = Geist.
5. **CI must pass before commit:** `npm run ci:gates`. Notably `ci:mockup-parity` (the listing page is parity-gated — see §6A), `ci:design-tokens`, `ci:brand-voice`, `ci:page-dal`, `ci:hydration-safety`, `ci:heading-display`.
6. **DAL discipline.** No raw Supabase `.from('listings')` outside `lib/data/`. Read `docs/DATABASE_SCHEMA_SNAPSHOT.md` + `docs/DAL_INDEX.md` before writing any query; reuse/extend a DAL function. Never run ad-hoc `information_schema` queries.
7. **Never ask Matt to run terminal/UI steps** — you do all git, builds, migrations. Single checkout, `main` only (after approval).

---

## 4. Codebase patterns to reuse (exact paths)

| Need | Reuse | Notes |
|---|---|---|
| Tool page shell | `app/tools/mortgage-calculator/page.tsx` | Hero (`ContentPageHero`), `BreadcrumbNav`, `Container/H2/Body`, `searchParams` pre-fill, metadata. Tool pages carry `// @no-parity` + `// @data-free`. |
| Pure engine + tests | `lib/mortgage.ts` (+ `.test.ts`) | The rental engine already reuses `monthlyPrincipalAndInterest` from here. |
| **Listing detail page** | `app/listing/[listingKey]/page.tsx` | Parity-gated. **Already embeds a `MortgageCalculator` section** — direct precedent for the rental calculator embed (§6A). |
| Listing data (DAL) | `getListingDetail()` in `lib/data/listings/getListingDetail.ts` → `ListingDetail` (`lib/data/types/listing.ts`) | Fields incl. `ListPrice`, `BedroomsTotal`, `BathroomsTotal`, `TotalLivingAreaSqFt`, `StreetNumber/Name`, `Latitude/Longitude`, `ListAgentName`. Check the type for a property-tax field; if none, default taxes from price (~0.75%). |
| Listing-agent resolution | `lib/data/brokers/resolveListingAgent.ts` | For PDF co-branding (headshot/byline per listing agent). |
| FUB lead capture | `app/lp/seller-home-value/actions.ts` + `@/lib/followupboss` | The canonical server-action → FUB pattern (§6C). |
| Agent attribution | `app/actions/agent-attribution-read.ts` `readAttributedAgentServer()` | Routes `?agent=` shared-link leads to Rebecca/Paul; default Matt (`FUB_USER_MATT = 1`). |
| Branded PDF | `lib/pdf/cma-pdf.tsx` (+ `app/api/pdf/listing/route.ts`) using `@react-pdf/renderer ^4.2.0` | Pattern for §6D. |
| Charts | `components/site/PriceChart.client.tsx` (recharts ^2.15.4, navy tokens) | The rental chart already follows this. |
| Design components | `@/components/ui/*` | All present: slider, input, select, tabs, accordion, table, tooltip, card, switch, badge, separator. |

Stack: **Next 16.1.6, React 19.2.3.** Forms use `useState` + server actions — **no react-hook-form, no zod** in this repo. Tests: **Vitest** (`npm test`).

---

## 5. The calculation engine (already built) — interface + verified formulas

`analyzeRental(inputs: RentalAnalysisInputs): RentalAnalysisResult`.

**Inputs:** `purchasePrice`, `downPaymentPct`, `interestRatePct`, `loanTermYears`, `loanType?` ('amortizing'|'interest-only'), `loanAmount?` (override; else `price*(1−down%)`), `purchaseCostsCash?`, `rehabCost?`, `marketValue?` (defaults to price), `grossRentMonthly`, `vacancyPct?` (5), `otherIncomeMonthly?`, `expenses?` (monthly $: `propertyTaxes, insurance, propertyManagement, maintenance, capitalReserves, hoa, other`), `appreciationPct?` (3), `rentGrowthPct?` (2), `expenseGrowthPct?` (2), `projectionYears?`.

**Result:** down payment, loan amount, total cash needed, monthly/annual debt service, gross/vacancy/operating income, operating expenses, NOI (mo/yr), cash flow (mo/yr), `capRatePurchase`, `capRateMarket`, `cashOnCash`, `returnOnEquityYear1`, `grossRentMultiplier`, `rentToValue`, `dscr`, `operatingExpenseRatio`, and `projection: ProjectionYear[]` (`{year, propertyValue, loanBalance, equity, grossRent, operatingExpenses, noi, cashFlow}`).

**Verified formulas** (reconciled against `out/dealcheck-recon/rental-report.pdf`; keep the tests green if you touch the engine):
- Total Cash Needed = down payment + cash purchase costs + cash rehab.
- Amortizing P&I/mo = `L·c / (1 − (1+c)^−n)`, `c = rate/12`, `n = termMonths`; interest-only = `L·c`.
- Operating Income = gross rent − vacancy + other income; **NOI = Operating Income − Operating Expenses**; **Cash Flow = NOI − annual debt service**.
- Cap rate (purchase) = NOI ÷ price; cap rate (market) = NOI ÷ marketValue.
- Cash-on-cash = annual cash flow ÷ total cash needed. DSCR = NOI ÷ annual debt service. GRM = price ÷ annual gross rent. Rent-to-value = monthly rent ÷ price.
- Projection: `PropertyValue_N = marketValue·(1+appr)^N`; `GrossRent_N = grossRent·(1+rentGrowth)^(N−1)`; `Equity_N = Value_N − LoanBalance_N`; ROE(yr1) = annual cash flow ÷ equity(yr1).

---

## 6. What remains — build these to completion

### 6A. Embed on every listing detail page (PRIMARY)

The listing page `app/listing/[listingKey]/page.tsx` is **server-rendered and parity-gated**. It already renders a `MortgageCalculator` section — mirror that exactly.

1. Create a server-safe section component, e.g. `components/site/listing-detail/RentalAnalysis.tsx`, that:
   - Takes the `ListingDetail` (already fetched on the page via `getListingDetail()` — do **not** add a second fetch).
   - Maps listing → calculator props: `initialPrice = ListPrice`, `initialPropertyTaxesYear` = listing tax field if present (else `round(ListPrice*0.0075)`), `propertyLabel` = street address, and `rentEstimate` from §6B.
   - Renders `<RentalCalculator embedded initialPrice=… initialPropertyTaxesYear=… rentEstimate=… propertyLabel=… />` inside a branded section wrapper (sentence-case `H2` "Could this be a rental?" or similar, per brand voice).
2. Mount it on the listing page near the existing `MortgageCalculator` section.
3. **Update the parity contract:** add a `RentalAnalysis` entry to `requiredComponents` in `design_system/ryan-realty/ui_kits/listing-detail/parity.json`, and add the section to the mockup `design_system/ryan-realty/ui_kits/listing-detail/index.html` so `ci:mockup-parity` + `ci:mockup-coverage` pass. (Match how `MortgageCalculator` is registered there.)
4. Only show it for for-sale residential listings where a rental analysis makes sense (skip land/commercial if appropriate).

**Acceptance:** opening any active listing shows a pre-filled, correct rental analysis; `ci:mockup-parity` passes.

### 6B. Rent + value estimate (RentCast) — required for good listing pre-fill

The repo has **no** rent capability and `listings` is sales-only (no lease comps), so use an external source. **RentCast is the API DealCheck itself uses** (they publish a help doc about it), so our numbers land at parity.

1. `lib/rentcast.ts` — server-only client. Add `RENTCAST_API_KEY` to env.
   - Rent: `GET /avm/rent/long-term` with the listing's address (+ `bedrooms`, `bathrooms`, `squareFootage`, `propertyType`, or `lookupSubjectAttributes=true`). Returns estimated rent, rent range, and comparable rentals.
   - Value (optional, for ARV/market value): `GET /avm/value`.
   - **Verify current endpoints + pricing at `developers.rentcast.io`** (free tier is ~50 calls/mo; paid scales). Don't hardcode pricing.
2. **Cache hard.** Create a Supabase table `rent_estimates` (migration via the Supabase MCP; refresh the schema snapshot after — `npm run ci:data-access -- --refresh`), keyed by `listing_key` or normalized address, ~30-day TTL. Wrap reads in a DAL function `getRentEstimate(...)` in `lib/data/`. **Never call RentCast from the client.** Listings repeat, so caching keeps you well within quota.
3. **Free fallback: HUD Fair Market Rents** for Deschutes County by bedroom count if RentCast is unavailable. Coarse and conservative; label it.
4. Pass the estimate to the calculator as `rentEstimate={{ value, low, high, source: 'RentCast' }}`. The component already renders it as an editable hint with a range and source.

**Acceptance:** an address returns a labeled rent estimate + range, served from cache on repeat, never called client-side; the listing calculator pre-fills it and the user can override.

### 6C. Lead capture → Follow Up Boss

Currently the calculator's CTAs link to `/contact` (which already captures a lead). Upgrade to a richer, optional inline capture that carries the deal context:

1. A server action (model it on `app/lp/seller-home-value/actions.ts`) triggered by "Email me this analysis" / "Have an agent review this deal." It posts a FUB **event** via `@/lib/followupboss` (the lib wraps person create/dedup, tagging, assignment, and the `isHardStopped()` compliance check).
2. **Tags** (namespaced schema per `docs/FUB_SELLER_WORKFLOW_2026-05-17.md`): `audience:investor` + `source:rental-calculator` + `broker:{slug}`.
3. **Custom fields:** analyzed address / MLS#, purchase price, projected monthly cash flow, cap rate, cash-on-cash — so the agent opens the lead knowing the deal.
4. **Routing:** default Matt (`FUB_USER_MATT = 1`); honor the `?agent=` cookie via `readAttributedAgentServer()`.
5. Keep it **optional** — the calculator stays fully usable with no email.

**Acceptance:** an optional email creates a correctly-tagged FUB person/event with the deal context; hard-stopped contacts are skipped.

### 6D. Branded PDF report ("email me this analysis")

1. `lib/pdf/rental-analysis-pdf.tsx` using `@react-pdf/renderer` (model on `lib/pdf/cma-pdf.tsx`), and an API route `app/api/pdf/rental-analysis/route.ts` (model on `app/api/pdf/listing/route.ts`).
2. Sections: cover (property + the 6 summary stats: price, cash needed, cash flow/mo, cap rate, COC, total return) → cash-flow breakdown → 30-year projection table + chart → disclaimer. Co-brand with the **listing agent's headshot/byline** (resolve via `resolveListingAgent.ts`); navy/cream, Amboqia + Geist.
3. The PDF's numbers must equal the on-screen numbers (same engine).

**Acceptance:** "Email me this analysis" produces a branded PDF whose figures match the live calculator.

### 6E. Discoverability + SEO

1. Link `/tools/rental-property-calculator` from the site nav and/or footer (check `ci:nav-reachability` — add it to a "Tools"/"Resources" group if one exists).
2. Add `SoftwareApplication` + `FAQPage` structured data to the standalone page (the glossary tooltips double as FAQ content). Follow the existing structured-data pattern (`ci:ai-structured-data`).
3. Cross-link from listing pages and market/neighborhood pages ("Could this be a rental? Run the numbers →").

**Acceptance:** the page is reachable from nav, has structured data, and passes `ci:seo-routes` + `ci:nav-reachability` + `ci:internal-links`.

---

## 7. Disclaimer & compliance

Every surface (calculator + PDF) carries an estimates/not-advice disclaimer (the component already has one): "Estimates only, not investment advice or a guarantee of rent, value, or return…" Recommend Matt route the final wording through legal review given his license. Never present rent/value/comps as guaranteed.

---

## 8. Final acceptance criteria (whole project)

1. `npm test` green (engine reproduces DealCheck's sample).
2. Standalone `/tools/rental-property-calculator` works and is reachable from nav.
3. **Every active residential listing page shows a pre-filled, correct rental analysis** with a RentCast-backed (cached) rent estimate the user can edit.
4. Optional "email me this analysis" → branded PDF (numbers match) **and** a correctly-tagged FUB investor lead with deal context.
5. All on-screen + PDF numbers trace to `lib/rental-analysis.ts`; rent/value labeled as estimates.
6. `npm run ci:gates` passes (incl. `ci:mockup-parity` for the listing embed).
7. **Draft-first:** show Matt the working result and get explicit approval before committing/pushing to `main`.

---

## 9. DealCheck reference (so you never need a login)

DealCheck is the category-leading rental/BRRRR/flip analysis tool we're adapting (long-term-rental only). Its **rental report structure** (our model, lighter + embedded): cover (6 summary stats + "prepared by" branding) → property description → purchase & returns → monthly cash flow (itemized) → buy-&-hold projections (yrs 1/2/3/5/10/20/30) → cash-flow + equity charts → sales comps & rent comps → disclaimer. Full teardown + pricing + the BRRRR/flip future modes are in `docs/plans/DEALCHECK_INVESTMENT_ANALYZER_SPEC_2026-06-08.md`; the three real sample PDFs are in `out/dealcheck-recon/`. RentCast (rent/value/comps source) docs: `developers.rentcast.io`.
