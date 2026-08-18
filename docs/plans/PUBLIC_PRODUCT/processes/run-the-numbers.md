# Process: run-the-numbers — self-serve financial calculators (payment, rental underwrite, hold-period value)

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** (anonymous organic + internal + AI-referred traffic, 24/7; no cron
  consumes or produces anything for this process — `grep -n "tools" vercel.json` returned
  zero matches this run)
- Verdict: **PROPOSAL — KEEP.** The three tools are one process (identical shape: land →
  compute client-side → exit into a capture process) serving three audiences, and it is the
  only process on the site that answers a money question with zero ask. P1's "no capture
  contract of its own" claim is CORRECTED below: the rental tool carries a full in-tool lead
  capture (`RentalLeadForm` → `submitRentalLead` → `crm_people`), so the process has one
  direct conversion path, not zero. Not a MERGE: its completion class (anonymous computation
  + intent telemetry, plus one optional in-tool lead) differs from every neighbor, and it is
  entered from the Market nav group, not Buy. Proposal only; the verdict locks at P3 in
  `decisions.md`.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

(a) A visitor gets a trustworthy answer to a specific money question — what a home would
cost per month, whether a rental pencils, what a home held N years could be worth — computed
instantly in the browser, seeded with honest Central Oregon defaults, with nothing asked of
them first. (b) The machine outcome is intent classification plus a warm handoff: running
real numbers is the observable moment of financial seriousness, so serving (a) produces a
CRM-visible intent trail (`section_view`/`scroll_depth` → `visitor_events` → the
'mortgage-calculator user' signal on identified contacts) and places the matching capture
process (payment-bounded browse, the E2 valuation spine, broker/rental-lead contact) one
click away exactly when the numbers make it the obvious next step.

## 2. Inception (what starts it)

Trigger: a visitor opens one of three calculator pages. Preconditions: none — all entries
are anonymous; no sign-in state changes anything on these pages.

| Channel | Entry | Evidence (opened this run) |
|---|---|---|
| Internal nav | The **Market** group (not Buy) in both the top bar and the Menu+ overlay lists all three tools | `lib/site-nav.ts:143-145` (top bar), `:231-233` (Menu+); single public header is PublicNav → KbNav from this file (`app/layout.tsx:144-149`) |
| Internal — site search | Typing "mortgage"/"payment"/"loan" surfaces the mortgage tool. **Only the mortgage tool** — rental + appreciation are absent from the search index | `lib/search/site-pages.ts:40` (sole `/tools/*` row) |
| Internal — content pages | `/resources` links the appreciation tool; the appreciation page cross-links the mortgage tool | `app/resources/page.tsx:61-65`; `app/tools/appreciation/page.tsx:100-105` |
| Organic search | All three in the sitemap (monthly, priority 0.5), each with a self-canonical + OG/Twitter metadata and finance-app structured data: SoftwareApplication JSON-LD (mortgage, rental), WebApplication JSON-LD (appreciation), plus a 4-question FAQPage JSON-LD on rental | `app/sitemap.ts:153-155`; `app/tools/mortgage-calculator/page.tsx:35-49,60-71`; `app/tools/rental-property-calculator/page.tsx:37-51,96-116`; `app/tools/appreciation/page.tsx:36-56,59-66` |
| AI / answer engines | `llms.txt` lists all three under "## Tools"; the site's own AI chat system prompt offers the mortgage tool (**only** the mortgage tool) | `app/llms.txt/route.ts:152-154`; `app/api/ai/chat/route.ts:37` |
| Deep link with pre-fill | Mortgage accepts `?price/down/rate/term`; rental accepts `?price/rent/taxes/down/rate` — URL params override the app_config defaults | `app/tools/mortgage-calculator/page.tsx:51-58,74-79`; `app/tools/rental-property-calculator/page.tsx:53-61,86-93` |

The pre-fill channel is **latent**: repo-wide grep for `mortgage-calculator?` and
`rental-property-calculator?` returned zero in-repo links carrying params this run, and the
rental page header marks MLS pre-fill "a future enhancement"
(`app/tools/rental-property-calculator/page.tsx:2`). The listing-detail mortgage panel does
not deep-link to the tool either (grep of `components/site/listing-detail/*.tsx` for
`tools/mortgage`: zero matches this run).

## 3. Actors

- **Buyer** — the mortgage tool's audience ("Before you offer" eyebrow,
  `app/tools/mortgage-calculator/page.tsx:104`); its exits are buyer exits.
- **Investor** — the rental tool's audience ("Before you buy a rental",
  `app/tools/rental-property-calculator/page.tsx:136`); the in-tool lead is tagged
  `audience: 'buyer'` + `extraTags: ['rental-calculator', 'investor']`
  (`app/actions/lead-capture.ts:434-441`).
- **Owner / seller-curious** — the appreciation tool's audience ("Hold-period math",
  `app/tools/appreciation/page.tsx:85`); both of its capture exits point at the valuation
  path, so this tool serves `get-home-value`/`plan-a-sale` as much as purchase planning.
- **Dreamer** — same surfaces; the anonymous telemetry trail is the only trace.
- **Device reality:** a GA4 device split for `/tools/*` was NOT queried this session and is
  not stated (§0); pulling it is a P4/P8 gap item. Mobile 390 is Matt-locked truth site-wide
  (`decisions.md` 2026-08-11).
- **Automated actors:** none. No cron reads or writes anything for this process
  (`vercel.json` grep, zero matches this run). The visitor-track API and GA4 sinks are
  passive receivers.
- **Accountable for completion:** the visitor — the process completes self-serve in the
  browser. A broker becomes accountable only after the optional rental-lead handoff
  (`submitRentalLead` creates the CRM person/event; no `crm_tasks` reminder is created —
  verified by reading the full action, `app/actions/lead-capture.ts:365-460`).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| Calculator default — 30-yr rate | `public.market_history_weekly` (`geo_type='national'`, `geo_slug='us'`, metric `mortgage_rate_30yr`), ingested every Monday by `/api/cron/market-history-snapshot` from FRED `MORTGAGE30US` / Freddie PMMS. Read through `getCalculatorDefaults`, which takes the newest point of the last 12 weeks. `app_config.mortgage_rate` is the floor beneath it (hand-entered, last written 2026-04-14), then the 7% hardcoded FALLBACK | `lib/data/config.ts:77-91,132-137`; `lib/market-national-series.ts`; `app/api/cron/market-history-snapshot/build-rows.ts` |
| Calculator defaults — tax %, insurance % | `public.app_config` keys `default_tax_rate_pct` / `insurance_rate_pct` (no ingested equivalent exists yet), read through the DAL's `getCalculatorDefaults` (6h `unstable_cache`, tag `app_config`), with hardcoded floor fallbacks and a fraction-vs-percent sanity clamp | `lib/data/config.ts:93-144`; table documented at `docs/DATABASE_FOR_AI_AGENTS.md:301` |
| Behavioral trail | `public.visitor_sessions` + `public.visitor_events` via `POST /api/visitors/track`, dual-sunk with GA4 (`trackEvent`) | `app/api/visitors/track/route.ts:365-367,403-405`; `components/site/kb/KbSectionTracker.client.tsx:7-28,38-77` |
| CRM intent signal | `crm_people` behavior events → derived `'mortgage-calculator user'` flag in the contact behavior summary | `lib/data/crm/getContactBehaviorSummary.ts:133-138,196,208-215` |
| Rental lead (optional path) | `public.crm_people` via `sendEvent` → native lead, + Meta CAPI Lead + GA4 `lead_generated` mirror | `app/actions/lead-capture.ts:407-419,421-427,451-456` |
| Rental PDF report | none — generated on demand, re-computed server-side, streamed to the browser, never stored | `app/api/pdf/rental/route.ts:9-13` |
| **NOT a SoR** | The computed estimate itself (exists only in client component state — no server write anywhere: all three pages are `@data-free`, `app/tools/mortgage-calculator/page.tsx:1`, `app/tools/rental-property-calculator/page.tsx:2`, `app/tools/appreciation/page.tsx:1`); the URL pre-fill params (ephemeral seed); GA4 (mirror, never the record); the hardcoded copy percentages in the explainer prose (see §10 defect 7) | pages cited; `components/tools/RentalCalculator.tsx:286` (`useMemo` compute) |

## 5. End-to-end path (inception → completion)

1. **Land** · visitor · arrives via a §2 channel · URL (+ optional pre-fill params) · KB-shell
   page renders (KbBreadcrumb → KbHero → calculator section → guide section → KbFooter) ·
   mortgage + rental are request-rendered (they await `searchParams` +
   `getCalculatorDefaults`, `app/tools/mortgage-calculator/page.tsx:74`,
   `app/tools/rental-property-calculator/page.tsx:87`); appreciation is a static sync
   component with zero fetches (`app/tools/appreciation/page.tsx:58`) · failure: DB
   unreachable → `getCalculatorDefaults` returns hardcoded fallbacks, the page still renders
   (`lib/data/config.ts:44-46`); a skeleton `loading.tsx` covers the mortgage render
   (`app/tools/mortgage-calculator/loading.tsx`) · both devices.
2. **Seed** · system · URL params take precedence over app_config; server derives
   dollar-amount tax/insurance defaults from the config rates against the (param or $500K)
   price, rounded to $50 · params + `app_config` · a calculator pre-loaded with honest
   local defaults · `app/tools/mortgage-calculator/page.tsx:75-85`;
   `app/tools/rental-property-calculator/page.tsx:88-93` · failure: unparseable params fall
   through to defaults (`parseInt`/`parseFloat` guards) · both.
3. **Telemetry mount** · system · `KbSectionTracker pageType="tools"` observes every
   `section[id]` (55% visibility → one `section_view` each) + 25/50/75/100 scroll depth,
   dual-sinking GA4 and `/api/visitors/track`; sitewide `VisitTracker` categorizes the
   page_view · page load · `visitor_events` rows + GA4 events ·
   `components/site/kb/KbSectionTracker.client.tsx:38-77`; mounted at
   `app/tools/mortgage-calculator/page.tsx:89`,
   `app/tools/rental-property-calculator/page.tsx:120`, `app/tools/appreciation/page.tsx:70` ·
   failure: fire-and-forget, never blocks the page (`:7-28`) · both.
4. **Compute** · visitor · edits inputs; results recompute synchronously in the client — no
   server round-trip, no capture gate · keystrokes/sliders · the answer (monthly payment
   breakdown / cash flow + cap rate + cash-on-cash + verdict sentence / future value + gain) ·
   pure client components: `app/tools/mortgage-calculator/MortgageCalculator.tsx:1` (`'use
   client'`, zero fetch), `components/tools/AppreciationCalculator.tsx:1` (same),
   `components/tools/RentalCalculator.tsx:286` (`analyzeRental` in `useMemo`, engine at
   `lib/rental-analysis`) · failure: none possible server-side; bad inputs clamp in-component ·
   both.
5. **Deepen (rental only)** · visitor · opens the 30-year projection accordion; optionally
   downloads a branded PDF — the client POSTs its inputs and the server **re-computes** the
   analysis via the same engine before rendering (§0: never trust the client's numbers),
   behind a strict rate limit · inputs JSON · streamed PDF ·
   `components/tools/RentalCalculator.tsx:289-310`; `app/api/pdf/rental/route.ts:9-13,22-24` ·
   failure: non-OK response silently no-ops the download (`RentalCalculator.tsx:297`) · both.
6. **Read guidance** · visitor · the "How to use this calculator" explainer states the
   assumptions and the disclaimer (estimate, not a lender quote / not investment advice / not
   an appraisal) · scroll · informed interpretation ·
   `app/tools/mortgage-calculator/page.tsx:141-164`;
   `app/tools/rental-property-calculator/page.tsx:188-220` (+ visible FAQ `:224-260`);
   `app/tools/appreciation/page.tsx:130-156` · failure: n/a — static prose · both.
7. **Exit — the handoff that is the point** · visitor · each tool offers the next step its
   audience's numbers imply: **mortgage** → `/homes-for-sale` ("Browse homes in this range")
   + `/sell/valuation` (`app/tools/mortgage-calculator/page.tsx:165-176`); **rental** →
   `/contact` twice (`app/tools/rental-property-calculator/page.tsx:148-158,214-218`) +
   `/homes-for-sale` (`:148-150`); **appreciation** → `/sell/valuation` twice
   (`app/tools/appreciation/page.tsx:150-154` and the `HomeValuationCta` card `:168-172`,
   which fires `trackHomeValuationCta` with LP-context attribution on click before routing,
   `components/HomeValuationCta.tsx:42-48`) + `/homes-for-sale` and the mortgage tool
   (`:94-108`) · click · the visitor enters `find-a-home`, `get-home-value`, or
   `contact-a-broker` carrying fresh financial context · failure: none — plain links · both.
8. **Convert in-tool (rental only, optional)** · visitor · expands `RentalLeadForm` under the
   results ("ask a broker to pull real rent comps"), submits name + email/phone; the server
   action creates the CRM person/event with the analysis context in the message ("Rental
   calculator lead. $650K · cash flow …"), tags `rental-calculator`/`investor`, fires Meta
   CAPI + GA4 `lead_generated` (server) + a client `generate_lead` mirror ·
   contact fields + computed context · `crm_people` row ·
   `components/tools/RentalCalculator.tsx:12,510-513`;
   `components/tools/RentalLeadForm.tsx:36-62`; `app/actions/lead-capture.ts:365-460` ·
   failure: email-or-phone required client- AND server-side
   (`RentalLeadForm.tsx:36-39`; `lead-capture.ts:377-381`); canonical tagging failure is
   non-blocking (`:445-447`) · both.
9. **Machine consumption (later, out-of-band)** · system · when the visitor later identifies
   (any capture path), their stitched event trail derives the `'mortgage-calculator user'`
   intent signal a broker sees on the contact · `visitor_events`/behavior events · CRM signal ·
   `lib/data/crm/getContactBehaviorSummary.ts:133-138,196,213` · failure: **only the mortgage
   tool's URLs ever match** — see §6/§10 · n/a.

## 6. Decision points

- **Param vs config precedence**: URL pre-fill beats `app_config`; `app_config` beats the
  hardcoded floor (`app/tools/mortgage-calculator/page.tsx:77-79`;
  `app/tools/rental-property-calculator/page.tsx:92-93`; `lib/data/config.ts:44-46`).
- **§0 sanity clamp on stored rates**: values below the fraction ceiling are treated as
  stored decimals and ×100'd, then range-clamped (a sub-1% "30-yr rate" once rendered
  $1,126/mo on a $400K loan — ~2.8x under honest) (`lib/data/config.ts:60-76`).
- **PMI branch**: applies automatically under 20% down at 0.5%/yr of loan (stated in copy,
  `app/tools/mortgage-calculator/page.tsx:151-154`).
- **Rental verdict branch**: the summary sentence flips on cash-flow sign
  (`components/tools/RentalCalculator.tsx:316-329`).
- **PDF trust boundary**: the server re-computes from raw inputs and never renders
  client-computed figures (`app/api/pdf/rental/route.ts:9-13`); strict rate limit first
  (`:22-24`); price ≤ 0 → 400 (`:33-35`).
- **Lead validation**: email-or-phone required; email format checked server-side
  (`app/actions/lead-capture.ts:377-381`).
- **Consent gates**: the appreciation page's `AdUnit` renders null without marketing consent
  (`app/tools/appreciation/page.tsx:158-164`); visitor tracking stores only the minimal
  functional record before a banner answer (`components/VisitTracker.tsx:92-100`); the rental
  lead form carries `SmsConsentDisclosure` (`components/tools/RentalLeadForm.tsx:10`).
- **Compliance gates in-path**: every output is labeled an estimate — "not a lender quote"
  (`app/tools/mortgage-calculator/page.tsx:156-159`), "not investment advice or a guarantee"
  (`app/tools/rental-property-calculator/page.tsx:208-212`, FAQ `:81-84`,
  `components/tools/RentalCalculator.tsx:529-531`), "math, not an appraisal"
  (`app/tools/appreciation/page.tsx:88,141-145`). No MLS data renders, so ODS/IDX and
  Coming-Soon gates are not in-path. Voice canon applies to all page copy (§2 triggers).

## 7. Completion

Done when the visitor has a computed estimate on screen — observable machine done-state:
the `section_view` (`section: 'calculator'`) + scroll-depth events recorded to
`visitor_events` and GA4 for that page view
(`components/site/kb/KbSectionTracker.client.tsx:46-50`; sink
`app/api/visitors/track/route.ts:403-405`).

Terminal states, in ascending value:

1. **Computed-and-left** — telemetry trail only; still valuable: on later identification it
   becomes the CRM intent signal (`lib/data/crm/getContactBehaviorSummary.ts:213`).
2. **Handed off** — exited into `find-a-home` / `get-home-value` / `contact-a-broker` via a
   §5-step-7 link; completion then belongs to the receiving process.
3. **Report taken** (rental) — a branded PDF left with the visitor
   (`app/api/pdf/rental/route.ts`).
4. **Converted in-tool** (rental) — a `crm_people` row with `rental-calculator`/`investor`
   tags and the analysis context (`app/actions/lead-capture.ts:407-441`).

Artifacts at completion: `visitor_events` rows; possibly one CRM person + tags + CAPI/GA4
lead mirrors; possibly a downloaded PDF. The computation itself is deliberately artifact-free
(§4) — no orphan address/price leads exist because nothing is captured without the visitor
choosing a capture exit.

## 8. Time & performance

- **Time-to-answer budget**: the answer is on screen at first paint of the calculator card —
  all three tools render pre-seeded with defaults, so "what would I pay" is answered with
  zero input and any refinement recomputes synchronously in-client (§5 step 4; no fetch on
  keystroke anywhere — `MortgageCalculator.tsx:1-16`, `AppreciationCalculator.tsx:1-9`,
  `RentalCalculator.tsx:286`). The only server dependency is `getCalculatorDefaults`: 6-hour
  cache, hardcoded-fallback on error, so a DB stall can never block the render
  (`lib/data/config.ts:44-46,79-83`).
- **Render class**: appreciation is fully static; mortgage + rental are dynamic per-request
  (they await `searchParams`) — the cost of the latent pre-fill channel that nothing links to
  yet (§2), a fact for the P5 call on whether pre-fill earns its render cost.
- **What "slow" means and who sees it**: with compute client-side, slow means slow first
  paint. Each tool sits below a full KbHero, so the calculator card is below the fold at 390 —
  a shape observation for P6, not a measured stat.
- **Core Web Vitals reality**: field CWV is collected sitewide (`WebVitalsReporter`,
  `app/layout.tsx:150-151`) but no `/tools/*` CWV number was queried this session and none is
  stated (§0). Pulling field CWV + GA4 engagement per tool is a P4/P8 gap item.

## 9. Variants

Three audience variants of one job ("run the numbers before you act"), confirmed as one
process — identical path shape (land → seeded compute → guided exit) and identical
completion class:

- **Payment** (`/tools/mortgage-calculator`) — buyer; exits to browse + valuation.
- **Underwrite** (`/tools/rental-property-calculator`) — investor; the deepest variant
  (projection, PDF, in-tool lead); exits to broker contact.
- **Hold math** (`/tools/appreciation`) — owner; both capture exits point at valuation, so
  this variant serves the seller pillar.

Embedded siblings that belong to **find-a-home**, not here (same engines, different
process): listing detail's own `MortgageCalculator` section
(`components/site/listing-detail/MortgageCalculator.tsx:1-20`, mounted at
`app/listing/[listingKey]/page.tsx:38,417`) and `RentalAnalysis`, which embeds the very same
`RentalCalculator` with listing context (`components/site/listing-detail/RentalAnalysis.tsx:1,69`;
mounted `app/listing/[listingKey]/page.tsx:40,421`). The URL-pre-fill variant (§2) exists in
code but has zero senders. No variant materially diverges in path or completion; none
warrants a split.

## 10. Current implementation map

- **Routes**: `/tools/mortgage-calculator`, `/tools/rental-property-calculator`,
  `/tools/appreciation`. **No `/tools` index route exists** — `app/tools/` holds exactly the
  three page dirs (`ls` this run), so the breadcrumb's middle crumb "Tools" is a dead label
  with no href (`app/tools/mortgage-calculator/page.tsx:91-97`).
- **Design registers (of the 4 surviving languages)**: all three pages wear the **kb** shell
  (`kb.css`, KbBreadcrumb/KbHero/KbFooter/SmoothScrollProvider,
  `app/tools/mortgage-calculator/page.tsx:25-30`) while the calculator islands inside them
  are shadcn/ui primitives (`components/tools/RentalCalculator.tsx:6-11`;
  `app/tools/mortgage-calculator/MortgageCalculator.tsx:4-7`) and `HomeValuationCta` pulls
  the **primitives** register (`components/HomeValuationCta.tsx:7`) — register mixing inside
  one page, the P9-ratchet defect class.
- **Actions/API/DAL**: `getCalculatorDefaults` (`lib/data/config.ts:79-83`, exported
  `lib/data/index.ts:762`); `POST /api/pdf/rental`; `submitRentalLead`
  (`app/actions/lead-capture.ts:365-460`); `trackHomeValuationCta`
  (`app/actions/lead-capture.ts:76-110`); `POST /api/visitors/track` sink
  (`app/api/visitors/track/route.ts:403-405`). No crons.
- **Known defects / observations (P3/P4/P5 input)**:
  1. **Intent-signal blindness for two of three tools.** `VisitTracker`'s categorizer maps
     only `/mortgage|affordability/` to `financial_tools`
     (`components/VisitTracker.tsx:84`), and the CRM's URL fallback matches only
     `mortgage-calculator`/`/tools/mortgage`
     (`lib/data/crm/getContactBehaviorSummary.ts:133-138`) — so rental and appreciation use
     is categorized `other` and never produces the `'mortgage-calculator user'` signal. The
     investor and owner variants are invisible to the machine objective they exist to serve.
  2. **P1 registry correction:** the rental tool DOES have a capture contract of its own —
     `RentalLeadForm` (`components/tools/RentalCalculator.tsx:510-513`) →
     `submitRentalLead` → `crm_people` + `rental-calculator`/`investor` tags
     (`app/actions/lead-capture.ts:407-441`). The P1 row's "no capture contract" claim is
     wrong for one of the three tools.
  3. **Valuation exit vs the locked spine.** Tool exits target `/sell/valuation`
     (`app/tools/mortgage-calculator/page.tsx:169-176`;
     `app/tools/appreciation/page.tsx:151-153`; `components/HomeValuationCta.tsx:47`) while
     the absorbed Matt decision names ONE global valuation spine ("`/sell#get-value` today;
     P5 may re-home the spine, not fork it", `decisions.md` 2026-08-11). Whether
     `/sell/valuation` is the spine or a fork is a P5 reconciliation item.
  4. **Discovery asymmetry:** site search indexes only the mortgage tool
     (`lib/search/site-pages.ts:40`); the AI chat prompt offers only the mortgage tool
     (`app/api/ai/chat/route.ts:37`); `/resources` lists only the appreciation tool
     (`app/resources/page.tsx:61-65`); the retired SiteHeader/MegaMenu projection
     (`lib/site-menu.ts:260-261`) lists mortgage + appreciation but not rental. Four
     different partial menus of the same three tools.
  5. **Orphan duplicate capability:** `components/listing/ListingEstimatedMonthlyCost.tsx`
     (an inline estimated-monthly-cost + mortgage panel) has ZERO importers — repo-wide grep
     this run returned only its own file. The live listing-detail panel is the separate
     `components/site/listing-detail/MortgageCalculator.tsx`. The orphan should die.
  6. **Hero stat band renders nothing:** all three pages pass `KbHero` all-null stats
     (`app/tools/mortgage-calculator/page.tsx:103`,
     `app/tools/rental-property-calculator/page.tsx:135`,
     `app/tools/appreciation/page.tsx:84`) — the same null-stat-band pattern flagged on
     `/activity` in find-a-home §10.
  7. **Copy/data drift risk:** explainer prose hardcodes "property taxes near 0.75 percent"
     (`app/tools/rental-property-calculator/page.tsx:198-199`) and "PMI … 0.5 percent"
     (`app/tools/mortgage-calculator/page.tsx:151-154`) while the actual defaults come from
     `app_config` — an edit to the config row silently falsifies the prose.
  8. **Ad slot on a brand surface:** the appreciation page is the only tool page carrying an
     `AdUnit` (slot 1001003001, consent-gated, `app/tools/appreciation/page.tsx:158-164`) —
     whether a third-party ad belongs on a trust-engine tool is a P5 product call.
  9. **Latent pre-fill costs a render class:** mortgage + rental are dynamic-per-request
     solely to read `searchParams` that nothing in-repo ever sends (§2, §8).

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes.** Free, no-ask calculators are the cheapest honest trust move the
site has: they answer a real money question with §0-grade inputs and mark financial
seriousness for the machine. The shape derives from the job — *answer the money question
where it arises, then offer the numbers' natural consequence* — not from today's three
routes (route names, the "Tools" grouping, and the Market-nav placement are shape, not
facts; P5 re-derives them under amnesia, with the SEO carve-out: all three URLs are
sitemapped with canonicals and structured data, so GSC evidence per URL is mandatory before
any rename/cut, and cuts get 301s).

- **Ideal step count**: 1 — land with the answer already computed from honest defaults;
  refinement is optional depth, capture is never a gate. (Today matches this; keep it.)
- **Device**: mobile 390 first (Matt-locked); the answer must be visible without the
  full-viewport-hero scroll the current shell forces (§8).
- **In-context first**: the job arises mid-exploration (on a listing, a place page, the sell
  spine), so the capability should be embeddable at those nodes — the listing-detail
  embeds prove the pattern (§9) — with the standalone pages kept as the SEO/answer-engine
  doors. One engine per question; the orphan duplicate dies (§10 defect 5).
- **Machine plumbing to fix (data gaps blocking correctness)**: (1) classify ALL three tools
  as financial-tool intent, split by audience (buyer/investor/owner), so the CRM signal
  matches the segment — today two of three are invisible (§10 defect 1); (2) GA4 usage +
  exit-click conversion per tool not queried this session — needed before P5 decides how
  much surface each tool earns; (3) field CWV per tool (§8); (4) resolve the valuation-spine
  fork (§10 defect 3).
- **Continuity (binding decision #5)**: numbers a visitor establishes here should follow
  them — a payment bound carried into browse, a listing's price carried into the tool. The
  param plumbing already exists receiver-side (§2); the graph just never sends it. Whether
  that wiring ships is a P5 edge-contract decision.

**Dual objective this process stamps on its pages:**

- `visitor_objective`: "Get a straight answer to my money question — monthly payment, rental
  cash flow, or hold-period value — instantly, with local defaults, without giving anything."
- `machine_objective`: "Mark the visitor's financial seriousness and segment
  (buyer/investor/owner) in the intent trail, and hand them into the matching capture
  process the moment their numbers make it the obvious next step."
- `exits`: payment tool → price-bounded browse (`find-a-home`) + valuation spine
  (`get-home-value`); underwrite tool → broker contact / in-tool rental lead
  (`contact-a-broker`) + investment browse (`find-a-home`); hold-math tool → valuation spine
  (`get-home-value`) + payment tool (in-process) + browse. Exact routes are P5 output; these
  are the graph edges the process requires.

**Destination implication (proposal, not a lock):** no standalone "Tools" destination. The
three calculators are utility nodes attached to their parent pillars — payment with the
buyer/browse destination, underwrite with the investor lens of browse + contact, hold math
with the valuation spine — each embeddable in-context, each keeping one canonical
SEO-door URL (301-preserved if re-homed). A `/tools` index page should NOT be created; the
grouping is a nav-shape choice P5 makes from the process graph, not from today's directory.

## 12. Acceptance checks

Prove the process end-to-end. Persist; never delete.

1. **Entries live + canonical**: for each of
   `/tools/mortgage-calculator`, `/tools/rental-property-calculator`, `/tools/appreciation`:
   `curl -s -o /dev/null -w '%{http_code}' https://ryan-realty.com<route>` → 200, and
   `curl -s https://ryan-realty.com<route> | grep -o '<link rel="canonical"[^>]*>'` → the
   self-canonical (`page.tsx` metadata: mortgage `:39`, rental `:41`, appreciation `:40`).
2. **Organic surface**: `curl -s https://ryan-realty.com/sitemap.xml | grep -c '/tools/'` →
   3 (`app/sitemap.ts:153-155`); `curl -s https://ryan-realty.com/llms.txt | grep -c '/tools/'`
   → 3 (`app/llms.txt/route.ts:152-154`).
3. **Structured data**: page source contains `"@type":"SoftwareApplication"` on mortgage +
   rental, `"@type":"WebApplication"` on appreciation, and `"@type":"FAQPage"` on rental
   (`app/tools/rental-property-calculator/page.tsx:108-116`).
4. **Pre-fill contract**: open
   `/tools/mortgage-calculator?price=750000&down=25&rate=6.5&term=15` in a browser → the four
   inputs render seeded with exactly those values
   (`app/tools/mortgage-calculator/page.tsx:74-79,126-134`).
5. **Defaults trace to their source (§0)** — the rate and the other two defaults come from
   different places, so check them separately.
   - Rate: `select week_start, value, source, observation_date from market_history_weekly
     where geo_type='national' and geo_slug='us' and metric='mortgage_rate_30yr'
     order by week_start desc limit 1;` (drop `observation_date` if migration
     `20260817120000` is not applied yet) → the newest value must equal the rate the calculator
     renders by default. `app_config.mortgage_rate` is only the floor and is expected to
     disagree (it is hand-entered and has no writer) — a mismatch there is not a defect.
   - Tax + insurance: `select key, value from app_config where key in
     ('default_tax_rate_pct','insurance_rate_pct');` → must agree with the rendered defaults
     after the percent normalization in `lib/data/config.ts:123-126`.
   - With the series dark AND the rows absent, the rendered defaults must equal the documented
     fallbacks (7 / 0.75 / 0.30, `lib/data/config.ts:66-70`).
6. **Completion telemetry**: load a tool page, scroll past the calculator, then:
   `select event_type, page_url, created_at from visitor_events where page_url like '%/tools/%' order by created_at desc limit 5;`
   → fresh `section_view` + `scroll_depth` rows (sink `app/api/visitors/track/route.ts:403-405`).
7. **Intent signal (and the blindness defect, until fixed)**: for an identified test contact
   whose trail includes a `/tools/mortgage-calculator` page_view, the contact behavior
   summary lists `'mortgage-calculator user'`
   (`lib/data/crm/getContactBehaviorSummary.ts:213`); a trail with ONLY
   `/tools/rental-property-calculator` does NOT produce it — this second assertion FLIPS
   when §10 defect 1 is fixed, and this check must be updated in the same commit.
8. **Rental lead completion**: submit `RentalLeadForm` with a test email, then:
   `select id, email from crm_people where email = '<test>';` → row exists; and the person's
   tags include `rental-calculator` and `investor`
   (`app/actions/lead-capture.ts:434-441`).
9. **Rental lead validation**: submit with neither email nor phone → inline "Add an email or
   phone" error, no server call (`components/tools/RentalLeadForm.tsx:36-39`).
10. **PDF trust boundary**:
    `curl -s -X POST https://ryan-realty.com/api/pdf/rental -H 'Content-Type: application/json' -d '{"purchasePrice":650000,"grossRentMonthly":2800}' -o /tmp/r.pdf -w '%{content_type}'`
    → `application/pdf`; same call with `{"purchasePrice":0}` → 400
    (`app/api/pdf/rental/route.ts:33-35`).
11. **Consent gate**: with no marketing consent, the appreciation page's `#sponsored`
    section contains no ad iframe (`AdUnit` renders null,
    `app/tools/appreciation/page.tsx:158-164`).
12. **Exit edges are real**: on each rendered page, every §5-step-7 exit link resolves 200
    (`/homes-for-sale`, `/sell/valuation`, `/contact`, `/tools/mortgage-calculator`).
13. **Timed span (P8 input)**: on a real phone, cold-load `/tools/mortgage-calculator` →
    seconds until the default payment figure is readable — record it; a timing not measured
    this session is not a timing.
