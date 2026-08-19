# Process: plan-a-sale — Plan a sale

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** (organic + nav + direct entry, 24/7; capture side effects run on
  registered crons — see §3)
- Verdict: **PROPOSAL (not a lock — P3 decides): KEEP** — this is the seller-education spine
  that feeds the program KPI (completed valuations, E2). Its capture chokepoint IS the
  inception of `get-home-value`; killing or merging it would orphan the KPI's top organic
  feeder. Sub-proposal inside the KEEP: the three `/sell/[intent]` situation landers are
  orphaned duplicates of `/lp/*` surfaces and should be re-decided at P5 with GSC evidence
  (fold into the destination or 301).
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

A homeowner weighing a sale learns what listing with Ryan Realty costs, what happens in what
order, and what proof backs it, well enough to decide their next step without talking to
anyone first. Serving that fully makes the written-valuation ask the natural next click, which
advances the valuation-started client step (the E2 KPI): the submit creates the `crm_people`
identity, the `cmas` draft, and the sequence enrollment that begin the client relationship.

## 2. Inception (what starts it)

**Trigger:** a visitor with sell intent (owner, heir, FSBO attempter, expired-listing owner)
opens a seller surface. No preconditions — all entry is anonymous. Optional carried state:
`rr_session_id` in localStorage (read at submit, `app/lp/seller-home-value/SellerLPForm.tsx:145,169`)
and the `rr_agent_attribution` cookie (`app/lp/seller-home-value/actions.ts:18`).

**Entry channels + routes (evidence):**

1. **Organic search** —
   - `/sell` targets sell-intent keywords: `'sell home Bend Oregon'`, `'Central Oregon home
     valuation'`, `'list home Bend'` (`app/sell/page.tsx:73-78`); in sitemap at
     `app/sitemap.ts:124`.
   - `/sell/valuation` targets `'home valuation Bend Oregon'`, `'what is my home worth Bend'`
     (`app/sell/valuation/page.tsx:41-46`); in sitemap via `valuationPath()`
     (`app/sitemap.ts:125`).
   - `/sell/for-sale-by-owner`, `/sell/expired-listings`, `/sell/inherited-home` — the three
     situation landers (`app/sell/[intent]/page.tsx:39-49`; configs at
     `lib/lead-landing-content.ts:30,75,119`). Sitemap-indexed (`app/sitemap.ts:133-135`)
     with **zero internal links** (verified this session: repo-wide grep finds only their own
     config, the sitemap, and a sitemap test `lib/data/sitemap/classify.test.ts:89`) — they
     are organic-entry-only.
2. **Internal navigation** — the global Sell menu (`lib/site-nav.ts:149-157`: `/sell`,
   `/sell#get-value`, `/sell/valuation`, `/our-homes`, `/motivated-sellers`) and the global
   chrome valuation CTA `VALUATION_FORM` → `/sell#get-value` (`lib/site-nav.ts:76-80`).
   Cross-links inside the process: `/sell` hero note → `/sell/valuation#valuation-form`
   (`app/sell/page.tsx:213`); `/sell/valuation` → `/sell#get-value`
   (`app/sell/valuation/page.tsx:127-133`) and its navy close → `/sell`
   (`app/sell/valuation/page.tsx:188`).
3. **Direct** — typed/bookmarked.
4. **NOT this process:** paid/social arrivals route to `/lp/seller-home-value`,
   `/lp/sell-your-home`, `/lp/fsbo`, `/lp/expired-listing` (dirs verified this session:
   `ls app/lp/`) — those belong to `arrive-from-ad`, even though two of them reuse this
   process's exact form component (§9).

## 3. Actors

- **Visitor segment:** Central Oregon homeowners with sell intent. The process's own
  taxonomy of them is the form's situation list — curious, downsizing, more-space,
  relocating, inherited, life-change, sell-soon, investment
  (`app/lp/seller-home-value/SellerLPForm.tsx:76-85`, validated server-side at
  `app/lp/seller-home-value/actions.ts:470-482`). Device reality from GA4: **not pulled this
  session — gap** (§11); mobile is assumed primary (the page ships a mobile-only sticky CTA,
  `app/sell/page.tsx:280-306`).
- **Automated actors:** the instant auto-enroll call at submit
  (`app/lp/seller-home-value/actions.ts:604-609`); sweep + delivery crons registered in
  `vercel.json` — `crm-auto-enroll` (`4,19,34,49 * * * *`, line 25), `crm-scheduled-sends`
  (`*/5 * * * *`, line 53), `crm-sequence-engine` (`13,28,43,58 * * * *`, line 57); the
  marketing-brain dispatcher that picks up the `content:cma` row
  (`app/lp/seller-home-value/actions.ts:591-598`).
- **Accountable for completion:** the assigned broker — default routing to Matt
  (`FUB_USER_MATT = 1`, `app/lp/seller-home-value/actions.ts:31-33`), overridden by the
  agent-attribution cookie (`assignmentReason`, `actions.ts:542-543`). Hot leads create a
  5-minute call task on that broker (`actions.ts:579-589`).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| Lead identity | `public.crm_people` | `DATABASE_SCHEMA_SNAPSHOT.md:2112`; written via `ensureNativeLead`/`enrichNativeLead` (`docs/DAL_INDEX.md:707-709`) |
| Sequence membership | `public.crm_sequence_enrollments` | `DATABASE_SCHEMA_SNAPSHOT.md:2286`; written by `autoEnrollByFubId` (`app/lp/seller-home-value/actions.ts:604-609`) |
| CMA deliverable + comps | `public.cmas` + `public.cma_comps` | `docs/DATABASE_FOR_AI_AGENTS.md:181-182`; draft created by `createCmaRequest` (`actions.ts:611-629`) |
| CMA production queue | `public.marketing_brain_actions` (`content:cma`) | `docs/DATABASE_FOR_AI_AGENTS.md:227`; queued by `createCmaRequest` (`actions.ts:591-598`) |
| Valuation-form submissions | `public.valuation_requests` | `docs/DATABASE_FOR_AI_AGENTS.md:186`; `insertValuationRequest` (`app/home-valuation/actions.ts:101-112`; export listed `docs/DAL_INDEX.md:3155`) |
| Anonymous pre-contact address partials | `visitor_events` via `saveAnonymousPartialAddress` | `docs/DAL_INDEX.md:2271-2273`; called from `actions.ts:118-120` |
| Broker-assignment ledger | `marketing_assignments` via `recordMarketingAssignment` | import `actions.ts:12`; write `actions.ts:569-576` |

**Explicitly NOT a SoR:** the in-house CRM (decommissioned; `sendEvent` from
`@/lib/retiredVendorCrm` is legacy naming over the in-house path — CLAUDE.md §9); the page copy
for fees (the fee decision SoR is `docs/plans/PUBLIC_PRODUCT/decisions.md:63` and today the
copy contradicts it — §10 D1); SkySlope.

## 5. End-to-end path (inception → completion)

Happy path = `/sell` hero form. Branch paths in §9.

1. **Land** · visitor · opens `/sell` · input: URL (+ optional utm/`?agent=`) · output:
   rendered page · system: ISR page, DAL pulls `getMarketPulse`/`getCityMarketDetail`/
   `getBrokerageTrackRecord`/`getSoldStories` under `withTimeoutFallback`
   (`app/sell/page.tsx:136-164`) · failure: a slow DAL degrades to null-stat hero instead of
   blocking · device: both; 390 gets the sticky CTA (`page.tsx:280-306`).
2. **Hero answers the ask** · page · fee + clocks + the form itself in the hero
   (`page.tsx:204-221`: lead copy "2.5% to 3.5%… photos in 48 hours… 5 to 7 business days",
   `SellerLPForm` at `page.tsx:208`, anchor `#get-value` `page.tsx:64`) · failure: the fee
   line contradicts the granted single-plan decision (§10 D1) · device: both.
3. **Educate on scroll** · page · proof → testimonials → value props → situations → process
   → plan → commission → market context → lifestyle → closing CTAs
   (`page.tsx:224-268`: `SellProof:225-229`, `KbTestimonials:231`, `SellValueProps:233`,
   `SellerSituations:235`, `SellProcess:237`, `SellMarketingPlan:239`, `SellCommission:241`,
   `SellMarketContext:243-247`, `CTABar:261-268`) · every internal valuation CTA anchors to
   `#get-value` · failure: section-wall stack of equal-weight sections (the prior program's
   diagnosed defect) · device: both.
4. **Address step** · visitor · enters address (Places autocomplete,
   `SellerLPForm.tsx:13`) and advances · input: address string ≥ 5 chars
   (`SellerLPForm.tsx:136-140`) · output: step → `qualify` · side effect: **partial-lead
   fire** `saveSellerPartialLead` unless `skipPartialLead` (`SellerLPForm.tsx:141-149`) →
   anonymous `visitor_events` row + partial CRM event
   (`app/lp/seller-home-value/actions.ts:104-121`) · failure: `/sell` does not pass
   `skipPartialLead`, so the partial still fires there against the recorded no-orphan-saves
   decision (§10 D3) · device: both.
5. **Qualify step** · visitor · name + email required, phone/timeline/situation/SMS-consent/
   home-details optional (`SellerLPForm.tsx:211-224` validation; timeline options
   `:66-70`; reason options `:76-85`; details state `:109-118`) · known visitor with a
   prefilled email skips this step entirely (`SellerLPForm.tsx:150-154`) · failure:
   validation error strings render inline · device: both.
6. **Submit → capture** · server action `submitSellerLPForm`
   (`SellerLPForm.tsx:161-184` call site) · classifies hot/warm/nurture, sends the Seller
   Inquiry event; on capture failure a native fallback still writes `crm_people`
   (`actions.ts:430-433`) · output: CRM person id · failure: hard error returns
   `{success:false}` and the form shows retry (`SellerLPForm.tsx:185-188`).
7. **Session stitch** · system · if a valid `rr_session_id` was passed, prior anonymous
   browsing is stitched to the person (`actions.ts:435-450`) · failure: non-blocking,
   logged.
8. **Compliance gate + enrichment** · system · hard-stopped people skip all workflow
   enrollment (`actions.ts:452-460`); otherwise tags (audience/tier/source/broker/reason/
   paid-attribution), custom fields, origin note, geocode geo-tags, assignment ledger row
   (`actions.ts:462-576`) · failure: each sub-step is caught and logged, never blocks
   capture.
9. **Hot-lead task** · system · classification `hot` → 5-minute call task on the assigned
   broker in `crm_tasks` (`actions.ts:579-589`) · failure: non-blocking.
10. **Instant sequence enrollment** · system · `autoEnrollByFubId` enrolls the CRM seller
    sequence at submit time, killing the sweep-cron lag (`actions.ts:601-609`); the
    `crm-auto-enroll` cron (vercel.json:25) sweeps misses · failure: caught + logged; the
    cron is the retry.
11. **CMA queue** · system · `createCmaRequest` writes the `public.cmas` draft (broker sees
    it in `/admin/cmas`) + the `marketing_brain_actions` `content:cma` row for the canonical
    CMA producer (`actions.ts:591-629`) · failure: logged warn; lead capture already durable.
12. **Alerts + confirmation** · system · broker notification + always-on Matt alert email
    (`actions.ts:631-649`); visitor sees the success card (variant copy,
    `SellerLPForm.tsx:227-249`); pixels fire (fbq Lead with shared eventID + GA4
    `generate_lead`, `SellerLPForm.tsx:190-205`) · completion state reached (§7).

## 6. Decision points

- **Partial-lead save?** `skipPartialLead` gate (`SellerLPForm.tsx:141-149`). Decision
  recorded (no save until contact exists, `decisions.md:57-59`; prop comment
  `SellerLPForm.tsx:57-61`) but the branch is dead — no caller passes it (§10 D3).
- **Known visitor?** Prefilled email skips the qualify step (`SellerLPForm.tsx:150-154`).
- **Compliance hard-stop:** suppressed people get NO tags/enrollment
  (`app/lp/seller-home-value/actions.ts:452-460`); the valuation path additionally imports
  `isSuppressedByEmail` (`app/home-valuation/actions.ts:16`).
- **Classification:** hot → 5-min call task (`actions.ts:580`); tier tag + `leadTier` custom
  field drive follow-up (`actions.ts:488,510`).
- **Capture-failure fallback:** every branch has a native `ensureNativeLead` fallback so no
  seller lead is dropped (`actions.ts:430-433`; `app/actions/lead-landing.ts:100-124`;
  `app/home-valuation/actions.ts:160-180`).
- **Input hygiene:** situation whitelist blocks tag injection via `?reason=`
  (`actions.ts:466-482`); `pagePath` sanitized (`actions.ts:73-76`); session id must be
  UUID-v4 (`actions.ts:442-443`).
- **§0/voice gates:** every rendered stat is a live DAL value or does not render
  (`app/sell/page.tsx:15-16` contract, `:136-164` pulls); SMS consent is fail-closed
  opt-in (`SellerLPForm.tsx:105`, `SmsConsentDisclosure` `ValuationForm.tsx:113-115`);
  brand-voice + design-token gates run at commit (CLAUDE.md §6).

## 7. Completion

**Done-when (observable):** a `crm_people` row exists (created or reused) carrying
`audience:seller` + a `seller:*` tier tag + `source:*` + `broker:*`
(`app/lp/seller-home-value/actions.ts:486-505`), AND for the CMA paths a `public.cmas`
draft row + a `marketing_brain_actions` `content:cma` row exist (`actions.ts:611-629`), AND
a `crm_sequence_enrollments` row exists (instant enroll `actions.ts:604-609` or the sweep
cron).

**Artifacts at completion:** CRM person (tags, custom fields, origin timeline note,
assignment ledger row), CMA draft + brain action, sequence enrollment, broker + Matt alert
emails, conversion events (Meta CAPI + pixel, GA4).

**Terminal states:** success card (hot vs standard copy, `SellerLPForm.tsx:227-249`);
error state with inline retry (`SellerLPForm.tsx:185-188`). **Secondary completions:**
`/contact?inquiry=Selling` (`app/sell/page.tsx:266`, `app/sell/valuation/page.tsx:191`) and
the tel: links (`app/sell/page.tsx:211,298`). **Boundary:** this completion IS the inception
of `get-home-value` — the valuation submit is the shared chokepoint; the CMA build/delivery
machinery beyond the queue rows belongs to that process (the `/bpo/[slug]` document view is
that machine's delivery leg, not a visitor surface here).

## 8. Time & performance

- **Time-to-answer budget:** the visitor's first question (what does it cost, what do I do)
  is answered in the hero — fee + clocks in the lead line and the form as the hero
  centerpiece (`app/sell/page.tsx:204-221`). Zero scrolls to the ask; the mobile sticky CTA
  keeps it one tap from any depth (`page.tsx:280-306`).
- **Server budgets:** `/sell` ISR `revalidate = 300` (`page.tsx:59`); every DAL pull capped
  by `withTimeoutFallback` at 8000/3500/3000 ms with degraded-not-blocked fallbacks
  (`page.tsx:138-163`). `/sell/valuation` is fully static (no data fetch in the component,
  whole file read this session).
- **Submit latency:** the valuation action documents measured production inline latencies of
  20 s, 77 s, and one >150 s before the fix; the lead insert + CRM capture now run inline
  and CMA build/emails run post-response via `after()`
  (`app/home-valuation/actions.ts:203-222`). "Slow" here is seen by the seller as a hung
  spinner and produced duplicate leads — the defect class to never reintroduce.
- **Core Web Vitals for the entry routes: not measured this session — gap** (§11). Structural
  risk: the kb shell loads Lenis smooth-scroll + client Plan Explorer/Comparison on `/sell`.

## 9. Variants

Split only where the path materially diverges; all converge on `crm_people`.

1. **`/sell` hero form** — `SellerLPForm` variant `home-value`, `pagePath='/sell'`
   (`app/sell/page.tsx:208`). The canonical in-process capture.
2. **`/sell/valuation`** — different form + action: `ValuationForm`
   (`app/sell/valuation/page.tsx:17,120-124`) posts `submitValuationRequest`
   (`app/home-valuation/actions.ts:62`): `valuation_requests` insert, capture with fallback,
   canonical tag `source:cma-request` tier warm (`:188-201`), then post-response auto-CMA
   attempt + ack email. Single-step (address+email on one card), no partial lead.
3. **`/sell/[intent]` ×3** — `LeadLandingForm` (`components/landing/LeadLandingPage.tsx:27,
   135-144`) posts `submitLeadLandingForm` (`app/actions/lead-landing.ts:54`): no address
   field; name/email/timeframe/message; Seller Inquiry event + fallback (`:84-124`), CAPI
   (`:126-149`), canonical tag + session stitch (`:159-189`), GA4 (`:191-202`). No CMA
   queue rows — a materially thinner completion.
4. **Shared-component out-of-process twins** — `/lp/seller-home-value` and
   `/lp/sell-your-home` import the same `SellerLPForm` (grep this session:
   `app/lp/sell-your-home/page.tsx:8`, `app/lp/seller-home-value/page.tsx:16`) with
   source `seller-lp`/`list-now-lp`; they belong to `arrive-from-ad`.
5. **Context handoffs** — `?reason=` from the situations section prefills the form
   (`SellerLPForm.tsx:124-131`; `SellerSituations` gets `valuationHref`
   `app/sell/page.tsx:235`); `?agent=` cookie reroutes broker assignment
   (`actions.ts:542-543`).

## 10. Current implementation map

**Routes:** `/sell` · `/sell/valuation` · `/sell/for-sale-by-owner` · `/sell/expired-listings`
· `/sell/inherited-home` (+ the Sell nav also points at `/our-homes` and `/motivated-sellers`,
`lib/site-nav.ts:155-156`).

**Registers (of the 5 design languages):** `/sell` and `/sell/valuation` are kb-shell pages
that ALSO import `primitives` and shadcn `ui` (`app/sell/page.tsx:39-57`;
`app/sell/valuation/page.tsx:17-28`) — three registers on one surface. `/sell/[intent]`
is kb + landing components (`components/landing/LeadLandingPage.tsx:26-36`) with a page-scoped
`<style>` block (`LeadLandingPage.tsx:205-256`) — effectively a fourth, inline register.

**Actions/crons:** `submitSellerLPForm` + `saveSellerPartialLead`
(`app/lp/seller-home-value/actions.ts`); `submitValuationRequest`
(`app/home-valuation/actions.ts`); `submitLeadLandingForm` (`app/actions/lead-landing.ts`);
crons `crm-auto-enroll`/`crm-scheduled-sends`/`crm-sequence-engine` (`vercel.json:25,53,57`).

**Known defects (each verified this session):**

- **D1 — the banned plan matrix is live.** Granted decision: market ONE plan, 3%; the matrix
  is dead; 2.5%/3.5% off the public site (`docs/plans/PUBLIC_PRODUCT/decisions.md:63`).
  Live today: `SellMarketingPlan.tsx:91` H2 "Three plans: 2.5%, 3%, and 3.5%…";
  `SellPlanExplorer` `:102`; `SellPlanComparison` matrix `:114`
  (`SellPlanComparison.client.tsx:4,131`); `/sell` FAQ three-tier answer
  (`app/sell/page.tsx:89-91`); hero lead + meta description "2.5% to 3.5%"
  (`page.tsx:70,204`); `/sell/valuation` navy close (`app/sell/valuation/page.tsx:185`).
- **D2 — the replacement exists, imported by nothing.** `SellPlanSingle`
  (`components/site/sell/SellPlanSingle.tsx:1-4` header: "No matrix. No 2.5% / 3.5% …
  (Matt 2026-08-11)", export `:74`); repo grep this session finds zero importers. Untracked.
- **D3 — partial-lead save still fires on `/sell`.** The `skipPartialLead` prop exists with
  the decision in its own comment (`SellerLPForm.tsx:57-61`, gate `:141-149`, default false
  `:96`) but no call site passes it (grep this session), and `/sell` renders the form bare
  (`app/sell/page.tsx:208`) — address-only partials still write, against `decisions.md:57-59`.
- **D4 — orphaned duplicate landers.** The three `/sell/[intent]` pages have zero internal
  links (§2) and overlap the standalone `/lp/fsbo` + `/lp/expired-listing` paid/outreach LPs
  (`ls app/lp/` this session). Two parallel FSBO paths and two expired paths should not both
  survive P5.
- **D5 — stock heroes on the landers.** All three intent configs use Unsplash images of
  not-Central-Oregon houses (`lib/lead-landing-content.ts:37,81,125`) on a brand whose
  pillar is local truth; also an external-host dependency.
- **D6 — a buyer surface in the Sell menu.** `/motivated-sellers` ("Sell on a deadline",
  `lib/site-nav.ts:156`) is a buyer-facing price-cut listing grid
  (`app/motivated-sellers/page.tsx` header + metadata: "Price-cut and motivated seller
  homes… ranked by price cuts"). A sell-intent click lands on a find-a-home surface.
- **D7 — untracked WIP riding the surface.** `components/site/sell/spine/*`,
  `SellMobileSticky.client.tsx`, `SellPlanSingle.tsx`, `app/dev/sell-film` (dev-only motion
  prototype) are untracked (git status this session) — unshipped intent living only on one
  machine.
- **D8 — timeline option drift.** The form offers 3 timeline options
  (`SellerLPForm.tsx:66-70`) while the type + server labels support 4 including `next-6-12`
  (`actions.ts:38,518-523`) — the middle band is uncapturable from the UI.
- **D9 — a promise in the ack copy.** The valuation success state promises "a quick call
  from our team" (`app/home-valuation/ValuationForm.tsx:44`) — an ops commitment no system
  enforces; decisions ban promising fixed follow-up counts (`decisions.md:60-61`).

**Duplicate/parallel paths that should die:** D4's lander/LP twins; the two distinct
valuation forms (`SellerLPForm` vs `ValuationForm`) are two capture contracts for one job —
P5 should decide whether `/sell/valuation` remains a distinct node or becomes the
`get-home-value` spine's only home.

## 11. Target shape (process-level, not pixels)

**Should this exist?** Yes. It is the organic feeder of the E2 KPI and the only place the
sell decision is answered without an ad click. Names, groupings, and route shapes below are
NOT inherited — they derive from the job (design amnesia; SEO-load-bearing URLs are data and
get 301s if moved, pending P5 GSC pulls).

**Ideal shape:** one seller destination answering three questions in order — what it costs
(the single 3% plan), what happens when (the schedule), what proof exists (sold receipts) —
with the valuation ask as the destination's one machine step: address → contact, two steps,
no save until contact exists. Situation-specific content (FSBO, expired, inherited) becomes
variants within the destination rather than orphaned sibling routes, unless GSC shows
per-URL equity worth keeping. Mobile 390 is truth.

**Data gaps blocking correctness (✗ statements, not designs):**

- ✗ No GA4 device/traffic split for `/sell*` pulled this session — the §3 device claim is
  assumption, not evidence.
- ✗ No GSC per-route equity for the three landers — the P5 cut/301 decision cannot be made
  without it.
- ✗ No conversion-rate split across the three capture forms (hero form vs ValuationForm vs
  LeadLandingForm) — nothing measured says which contract converts; P5 consolidation needs it.
- ✗ CWV for the entry routes unmeasured this session.

**Destination implication + dual objective stamp:**

- Destination: ONE seller destination (named at P5) carrying plan + proof + process; the
  valuation spine itself is `get-home-value`'s destination — this process hands off at the
  form submit. The `/lp/*` twins stay in `arrive-from-ad`.
- `visitor_objective`: "Decide whether and how to sell this home with Ryan Realty — what it
  costs, what happens when, and what proof backs it."
- `machine_objective`: "Start a written valuation: address + contact captured, CMA queued
  (the E2 KPI step)."
- `exits`: → `get-home-value` (the valuation submit — the chokepoint); → `contact-a-broker`
  (`/contact?inquiry=Selling`, tel:); → `explore-market-knowledge` (the live market-context
  band); → `evaluate-a-place` / `find-a-home` (place + listing doors in nav/footer).

## 12. Acceptance checks

Persist; never delete. (Live-site HTTP checks need a real browser UA — the WAF blocks
curl's default UA.)

1. **Routes serve.** In a browser (or `curl -A "Mozilla/5.0 …"`):
   `https://ryan-realty.com/sell`, `/sell/valuation`, `/sell/for-sale-by-owner`,
   `/sell/expired-listings`, `/sell/inherited-home` → all 200 with canonical self-URLs.
2. **Hero-form E2E (the KPI span).** On 390 viewport: load `/sell`, submit the form with a
   test address + `e2e+plan-a-sale@ryan-realty.com`. Then:
   `SELECT id, tags, assigned_broker FROM crm_people WHERE email='e2e+plan-a-sale@ryan-realty.com';`
   → one row whose tags include `audience:seller`, a `seller:hot|warm|nurture` tier, a
   `source:*`, and a `broker:*`.
3. **CMA queue rows.** `SELECT status FROM cmas WHERE lead_email='e2e+plan-a-sale@ryan-realty.com' ORDER BY created_at DESC LIMIT 1;`
   → `draft`. And `SELECT status FROM marketing_brain_actions WHERE action_type='content:cma' ORDER BY created_at DESC LIMIT 1;`
   → a fresh `pending` row for that address.
4. **Sequence enrollment.** `SELECT * FROM crm_sequence_enrollments WHERE person_id=(SELECT id FROM crm_people WHERE email='e2e+plan-a-sale@ryan-realty.com');`
   → one row (instant enroll; the `crm-auto-enroll` cron is the sweep).
5. **Partial-lead policy.** Enter an address on `/sell`, advance to step 2, abandon.
   Expected AFTER the D3 fix: no partial row for that session. Today this check FAILS by
   design of the defect (a `visitor_events` partial lands) — the check encodes the decided
   behavior, not the current one.
6. **Valuation path.** Submit `/sell/valuation` with a test email:
   `SELECT * FROM valuation_requests WHERE email='<test>';` → one row; ack email received;
   the browser response returns in seconds (the CMA build must be post-response).
7. **Single-plan copy.** `grep -rn "2\.5%\|3\.5%" app/sell components/site/sell` → zero hits
   once D1 ships (today: hits at the D7-enumerated lines, which is the failing baseline).
8. **No orphan landers.** After the P5 decision: either
   `grep -rn "sell/for-sale-by-owner" app components lib --include='*.tsx'` finds real
   internal links, or the route 301s and is out of the sitemap. Today: 0 links + sitemapped
   = failing state.
9. **Crons registered.** `grep -n "crm-auto-enroll\|crm-sequence-engine\|crm-scheduled-sends" vercel.json`
   → all three present (baseline today: lines 25, 53, 57).
10. **Timed mobile span (feeds P8 litmus L1).** Cold `/sell` load on a real phone → success
    card, stopwatch-timed and recorded. A timing not measured in-session is not a timing.
