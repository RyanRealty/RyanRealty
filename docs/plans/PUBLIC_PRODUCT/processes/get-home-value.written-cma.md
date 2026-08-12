# Process: get-home-value.written-cma — Address → contact → written CMA delivered and opened

## 0. Meta

- Status: **deepened**
- Cadence: **event-driven** (form submits; two build-worker ticks per hour; sequence engine 4×/hour)
- Verdict: **PROPOSAL — KEEP.** This is the E2 KPI spine (completed valuations week over
  week, Matt-locked). It is the single most instrumented conversion path on the site and
  the machine objective of nearly every other process. Fold-in candidate: the parallel
  `/sell/valuation` instant-CMA path (see §9/§10) should MERGE into this process, not
  survive beside it. This is a proposal for the P3 package, not a lock.
- Last evidence pass: **2026-08-11** (every file:line below opened this session; working
  tree state — `SellerLPForm.tsx` carries uncommitted edits, noted where relevant)

## 1. Purpose

(a) A Central Oregon homeowner learns what their home is actually worth: a written,
broker-built comparative market analysis with the closed and active comps behind the
number, free and with no listing agreement. (b) This process IS the machine's E2
conversion — serving (a) requires an address and a delivery email, which durably creates
the CRM seller relationship (crm_people + seller sequence + broker assignment), so fully
answering the visitor's question and advancing the client-step are the same act.

## 2. Inception (what starts it)

Trigger: a visitor types their property address into the 2-step `SellerLPForm` and
advances. Entry channels and routes:

| Channel | Route | Evidence |
|---|---|---|
| Organic / direct / internal links | `/sell` — form embedded in the hero `formSlot`, anchor `#get-value`; every on-page CTA and the mobile sticky bar point at the anchor | `app/sell/page.tsx:64` (FORM_ANCHOR), `:206-216` (SellerLPForm in formSlot, `pagePath='/sell'`), `:280-306` (sticky mobile CTA) |
| Paid (Meta) | `/lp/seller-home-value` — `robots: noindex` ad LP; ad-matched hero variants via `?v=` (mountain, oos, nopressure); form rendered twice (hero + closing band `formId="get-value-closing"`) | `app/lp/seller-home-value/page.tsx:29` (noindex), `:56-81` (HERO_VARIANTS), `:278` (hero form), `:562` (closing form) |
| Paid BOFU | `/lp/sell-your-home` — same form, `variant="list-now"` (consultation ask, listing intent) | `app/lp/sell-your-home/page.tsx:20` (noindex), `:495` (variant) |
| Internal handoff | `/sell/valuation` — a DIFFERENT form (`ValuationForm`), a parallel path documented in §9/§10; `/sell` hero links to it | `app/sell/page.tsx:213`, `app/sell/valuation/page.tsx:1-33` |

Pre-contact capture: advancing from step 1 fires `saveSellerPartialLead` before any
contact info exists — an anonymous `visitor_events` row keyed by `rr_session_id`
(`app/lp/seller-home-value/actions.ts:118-122`), plus, for cookie-identified visitors
only, a native Seller Inquiry event tagged `source:seller-lp-partial`
(`actions.ts:126-149`). The working tree adds a `skipPartialLead` prop citing Matt's
2026-08-11 no-save-until-contact rule (`SellerLPForm.tsx:56-62,142`), but no consumer
passes it yet — partial saves still fire from every embed including `/sell` (§10 defect).

Preconditions: JavaScript (client form); email OR a prior identity-bridge cookie —
the server action rejects a submission with neither (`actions.ts:325-330`), which is the
Matt-locked "no orphan address leads" capture contract at the full-submit boundary.
Google Places autocomplete assists but free-form addresses are accepted.

## 3. Actors

- **Visitor segment:** homeowners and owner-curious ("just curious" is an explicit
  timeline option and the nurture tier — `SellerLPForm.tsx:66-70`,
  `actions.ts:181-197`). Sub-segments the form itself distinguishes: ready-now sellers
  (hot), this-year planners (warm), curious owners (nurture), plus the reason taxonomy
  (downsizing, relocating, inherited, …) at `SellerLPForm.tsx:76-85`. Device reality:
  mobile-first is the locked program truth (390 first); both entry surfaces ship sticky
  mobile CTA bars. A GA4 device split for these routes was not queried this pass — listed
  as a gap in §11, not asserted.
- **Automated actors:** the `submitSellerLPForm` server action;
  `cma-build-worker` cron (`vercel.json:17-18`, 14,44 * * * *);
  `crm-auto-enroll` sweep (`vercel.json:25-26`, every 15 min);
  `crm-sequence-engine` (touch delivery, `vercel.json:57-58`, 13,28,43,58);
  `crm-alert-drain` (broker SMS alerts, every minute per `vercel.json:21-22`);
  Meta CAPI + GA4 Measurement Protocol mirrors.
- **Accountable for completion:** the assigned broker (default Matt; `?agent=` attribution
  cookie can route to Rebecca/Paul — `actions.ts:214-220`). The broker must review and
  finalize the draft CMA; nothing ships to the lead without that human step
  (`lib/cma/worker.ts:1-12`).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| The lead (identity, tags, custom fields, assigned broker) | `public.crm_people` (+ `crm_contact_points`, `crm_timeline`) | `actions.ts:376-433`, `:546-552` |
| Sequence membership + state | `crm_sequence_enrollments` | `lib/crm/enroll.ts:154-161` |
| Contactability / consent | `crm_suppressions` (SMS fail-closed on no consent) | `lib/crm/enroll.ts:297-305` |
| The CMA document + its lifecycle (draft → finalized/delivered) | `public.cmas` (`html_content` print artifact + `render_args` for the immersive view — one data source, two presentations) | `lib/cma-request.ts:229-249`, `app/cma/[slug]/route.ts:126-134` |
| The build queue | `marketing_brain_actions` rows with `action_type='content:cma'` | `lib/cma-request.ts:255-327` |
| Broker routing ledger | `marketing_assignments` | `actions.ts:222-241` |
| Hot-lead follow-up | `crm_tasks` | `actions.ts:580-589` |
| Pre-contact partial addresses | `visitor_events` (anonymous, session-keyed) | `actions.ts:118-122` |

Explicitly NOT a SoR: `valuation_requests` is an analytics/auto-CMA mirror, not the lead
record (`actions.ts:338-361` — inserts are best-effort, failure is only warned);
GA4 and Meta CAPI are attribution mirrors; Follow Up Boss is decommissioned (the
`fubPersonId` variable names carry native `crm_people.id` values —
`lib/cma-request.ts:88-103`); the legacy `public/cmas/` static files are served via
redirect for old links only (`app/cma/[slug]/route.ts:200-203`).

## 5. End-to-end path (inception → completion)

1. **Arrive** — visitor · lands on `/sell` or an LP · input: ad click / search / internal
   link · output: form in first viewport · touches: ISR page + `market_pulse_live` stats
   via DAL (`app/sell/page.tsx:136-164`) · failure: slow hero hides the ask below fold ·
   device: mobile-first.
2. **Address step** — visitor · types address (Places-assisted), taps CTA ·
   `SellerLPForm.tsx:133-156` · output: step flips to qualify; partial lead fires
   (fire-and-forget, never blocks — `actions.ts:104-154`) · failure: <5 chars rejected
   client-side; partial capture swallows all errors silently by design.
   Known visitor with a stored email skips step 2 entirely and submits at once
   (`SellerLPForm.tsx:151-154`).
3. **Qualify step** — visitor · name + email required (validated
   `SellerLPForm.tsx:211-224`), phone optional, timeline radio, optional reason,
   optional collapsed "About your home" details (beds/baths/system ages/improvements/
   condition — `:110-118,508-604`), SMS consent checkbox (`:608`) · output: full
   submission payload (`:158-184`).
4. **Server action entry** — machine · `submitSellerLPForm` validates: address present,
   email or identity cookie present (`actions.ts:261-330`) · classifies timeline →
   hot/warm/nurture (`:181-197`) · resolves broker (attribution cookie or Matt —
   `:214-220`).
5. **Analytics mirror insert** — machine · `valuation_requests` row; `address_city`
   defaults to `'Bend'` when the address has no comma-parsed city (`:341-361`, tradeoff
   documented at `:344-349`) · failure: warn-only, lead capture proceeds.
6. **Native lead capture** — machine · `sendEvent('Seller Inquiry')` with UTM-carrying
   sourceUrl → returns native `crm_people` id (`:376-411`) · fallback: direct
   `ensureNativeLead` so a seller lead is NEVER dropped (`:417-433`) · side effect:
   anonymous session backfill replay when `rr_session_id` present (`:442-450`).
7. **Compliance gate + enrichment** — machine · hard-stopped people skip all workflow
   enrichment (`:457-459`) · otherwise `enrichNativeLead`: canonical tags
   (`audience:seller`, `seller:{tier}`, `source:{lp}`, `broker:{slug}`, paid-attribution
   tags — `:486-505`), custom fields (`:508-514`), lead-origin timeline note
   (`:516-552`), fire-and-forget geocode → geo tags (`:557-567`),
   `marketing_assignments` upsert (`:570-576`).
8. **Hot-lead task** — machine · classification `hot` creates a 5-minute call task for
   the assigned broker (`:580-589`).
9. **Instant sequence enrollment** — machine · inline `autoEnrollByFubId`
   (`:604-609`) → resolves native id (`lib/crm/enroll.ts:268-288`), writes the SMS
   consent suppression FAIL-CLOSED (no checkbox = suppressed on sms channel; email never
   gated — `:297-305`), then `autoEnrollPerson`: post-epoch only (`:49-50`),
   outreach-list sources excluded (`:58-61`), referral-geo block (`:71-72`), hard-stop
   check fails closed (`:75-83`), rules table first with `audience:seller` → master
   plan 69 as const fallback (`:27-32`, `:90-134`), one master sequence per person ever
   (`:137-148`), enrollment inserted `status='running'` with first touch auto
   (`:154-169`). Instant broker SMS alert queued (`:309-330`).
   Safety net: the `crm-auto-enroll` cron sweeps every 15 min so no lead ever sits
   outside a workflow regardless of entry door
   (`app/api/cron/crm-auto-enroll/route.ts:1-9`).
10. **CMA request queued** — machine · `createCmaRequest` (`actions.ts:611-629`,
    `lib/cma-request.ts:105`): resolves a writable version-chain slot so a repeat
    request never clobbers a finalized/delivered document (`:193-253`), inserts the
    `cmas` draft row (broker-resolved, `:229-249`) and the `content:cma`
    `marketing_brain_actions` row (`:255-327`); a concurrent open build is attached to,
    not duplicated (`:328-383`); GA4 `valuation_requested` fires for genuine LP sources
    only (`:394-411`); broker notification + lead confirmation emails fire-and-forget
    (`:415-435`); `cmaSlug` stamped on `crm_people.custom` (`:443-458`).
11. **Alerts + ad attribution** — machine · always-on Matt alert email
    (`actions.ts:637-670`); Meta CAPI `Lead` value $500 with shared dedup event id and
    real client IP/UA (`:672-715`); GA4 MP `generate_lead` mirror (`:717-762`); browser
    pixel `Lead` with the same eventID (`SellerLPForm.tsx:190-200`).
12. **Success state** — visitor · sees the confirmation card: CMA in flight, "within one
    business day", direct phone escape hatch (`SellerLPForm.tsx:248-267`).
13. **Draft build** — machine · `cma-build-worker` (14,44 * * * *) drains open
    `content:cma` rows through the deterministic builder, caps 3/run, 3 attempts then
    the action row is killed with reason; BUILD ONLY, never sends
    (`app/api/cron/cma-build-worker/route.ts:1-26`, `lib/cma/worker.ts:1-15`). Output:
    `cmas.html_content` + `render_args`, action row → `ready`, broker review-ready SMS
    for listed notify entries.
14. **Broker review + finalize** — broker · reviews at `/admin/cmas`
    (`app/admin/(protected)/cmas/page.tsx`, draft preview via the same `/cma/[slug]`
    admin bypass) · `finalizeAndDeliverCma` renders/sends the PDF email and stamps
    `crm_people.custom.cmaLink` — the stamp is what releases the sequence engine's
    `%cma_link%` hold-gate so no touch ever sends a dead link
    (`lib/cma-deliver.ts:169`, `:255-284`); an email-suppressed lead blocks delivery
    (`:296-300`).
15. **Lead opens the CMA** — visitor · `/cma/[slug]`: publication gate (only
    `finalized`/`delivered` are public; drafts are admin-only, everyone else 404 —
    `app/cma/[slug]/route.ts:60-73`), then the register + consent door (register shell /
    consent shell / wrong-person 403 — `:79-117`), then the immersive scrollytelling
    view rendered per-request from the same `render_args` as the print artifact
    (`:126-162`), with `rr-doc-tracker.js` injected for open/engagement telemetry
    (`:150-153`, `:180`). `?print=1` serves the print artifact.
16. **Ongoing touches** — machine · `crm-sequence-engine` (13,28,43,58) executes the
    seller sequence: active-only, suppression chokepoint per send, stop-on-reply,
    07:00–19:00 send window (`app/api/cron/crm-sequence-engine/route.ts:1-20`). Note:
    `crm-scheduled-sends` (*/5) is broker cohort-email drain, NOT sequence delivery —
    P1's note conflated them (`app/api/cron/crm-scheduled-sends/route.ts:1-17`).

## 6. Decision points

- **Email or identity, else reject** — the no-orphan-leads contract at full submit
  (`actions.ts:325-330`). Partial address saves before this gate are the live tension
  noted in §2/§10.
- **Timeline → tier** — ready-now=hot, this-year=warm, curious=nurture; unknown falls to
  nurture (`actions.ts:181-197`). Hot adds the 5-minute call task.
- **Broker routing** — attribution cookie else Matt; no round robin (`:200-220`).
- **Compliance: hard stop** — `crm_suppressions` channel=all blocks enrichment and
  enrollment; the check itself fails CLOSED (`actions.ts:457-459`,
  `lib/crm/enroll.ts:75-83`).
- **Compliance: SMS consent fail-closed** — unchecked box = sms suppression written at
  enroll; a later consenting submission removes it (`lib/crm/enroll.ts:290-305`).
- **Enrollment guards** — pre-epoch book never enrolls; outreach-list sources never
  auto-enroll; referral-geo block; one master sequence per person ever
  (`lib/crm/enroll.ts:49-72`, `:137-148`).
- **CMA slot resolution** — open draft refreshed (contact fields only) vs. new version
  slot after a protected document; TOCTOU retried once (`lib/cma-request.ts:193-253`).
- **Duplicate build** — unique open-action index; second request attaches, merges
  contact atomically, joins the notify list (`lib/cma-request.ts:328-383`).
- **Publication gate** — only finalized/delivered CMAs are public; draft = admin-only
  (`app/cma/[slug]/route.ts:60-73`).
- **Register/consent door** — register vs consent vs claim-and-consent vs wrong-person
  403 (`app/cma/[slug]/route.ts:79-117`).
- **§0 data honesty** — LP stat band renders live DAL values or an em-dash placeholder,
  never an invented number (`app/lp/seller-home-value/page.tsx:106-142`); GA4
  `valuation_requested` fires ONLY for genuine visitor submissions after the 2026-07-28
  inflation fix (`lib/cma-request.ts:394-411`).
- **Voice canon** — all four surfaces are public copy under the canon + gates; the
  delivered CMA is client-facing prose under the same law.
- No-public-Coming-Soon and ODS/IDX attribution: n/a — this process renders no MLS
  listings on its entry surfaces (LP sold-proof strip uses our own verified closed
  sales, `app/lp/seller-home-value/page.tsx:156-163`).

## 7. Completion

Done-when (observable): the `cmas` row for the request reaches `finalized` or
`delivered` AND the lead has opened `/cma/[slug]` through the register+consent door
(doc-tracker events on the served page — `app/cma/[slug]/route.ts:150-153`). At that
moment the visitor outcome (a written number with comps, in hand) and the machine
outcome (identified, consented, enrolled seller relationship) are both real.

Artifacts at completion: `crm_people` row with canonical tags + `custom.cmaSlug` +
`custom.cmaLink`; `crm_sequence_enrollments` row (running/awaiting_broker_next);
consent state on the person; `cmas` row with `html_content` + `render_args` +
delivered status; `marketing_brain_actions` row `ready`→`executed`; delivery email;
`marketing_assignments` row; GA4/Meta conversion events.

Terminal states: **delivered+opened** (success) · **delivered, never opened** (sequence
continues; doc-tracker silence is the signal) · **draft killed** after 3 build failures
with reason recorded (`lib/cma/worker.ts:15`, `:1-12`) · **hard-stopped** (captured but
never enrolled/emailed) · **email-suppressed** (finalize blocked —
`lib/cma-deliver.ts:296-300`) · **partial only** (address entered, step 2 abandoned —
lives in `visitor_events`/partial tag for remarketing, not a lead).

## 8. Time & performance

- **Time-to-ask:** the address field is the hero centerpiece on all three entry routes —
  the visitor can start the process in the first viewport with zero scrolling
  (`app/sell/page.tsx:206-216`, `app/lp/seller-home-value/page.tsx:277-279`). The
  visitor's actual question ("what is it worth?") is answered by the delivered CMA, not
  on-page, so the page budget is: ask visible immediately, submit acknowledged fast.
- **Submit latency risk:** `submitSellerLPForm` awaits sendEvent, enrichment,
  auto-enroll, and createCmaRequest sequentially before the visitor sees success
  (`actions.ts:376-629`). The sibling `/sell/valuation` path already hit measured
  20s/77s/hung submits before moving heavy work post-response with `after()`
  (`app/home-valuation/actions.ts:203-222`); the SellerLPForm action has NOT had that
  treatment. No fresh latency measurement was taken this pass — flagged as a §11 gap,
  not asserted.
- **Delivery SLA:** Matt-locked product decision says "written CMA within 24 hours,
  every day including weekends" (decisions.md, absorbed 2026-08-11). Shipped copy says
  "within one business day" (`SellerLPForm.tsx:258`,
  `app/lp/seller-home-value/page.tsx:531`, `lib/cma-request.ts:320-323`). Mechanics:
  drafts build within ~30 min (worker at :14/:44), but delivery waits on human broker
  review with NO timer, breach alert, or SLA measurement anywhere in code. "Slow" here
  is invisible to everyone until a lead complains — the single biggest performance gap
  in the process (§10 D4, §11).
- **Core Web Vitals:** not measured this pass for `/sell` or the LPs — no numbers
  stated (§0). Listed as a §11 data gap; the program's growth telemetry owns the pull.

## 9. Variants

Channel/source variants sharing this one process (attributes, not forks):

- **`seller-lp`** (default) vs **`list-now-lp`** — same form, same action, same
  pipeline; list-now adds `seller:listing-intent`, consultation copy, and its own CAPI
  content name (`actions.ts:66,270-271,486-505,681-684`; `sell-your-home/page.tsx:495`).
- **`?v=` hero variants** — paid message-match, copy/photo only
  (`app/lp/seller-home-value/page.tsx:56-95`).
- **Known visitor** — identity cookie skips step 2 (`SellerLPForm.tsx:151-154`).
- **Agent-attributed** — `?agent=` cookie reroutes broker (`actions.ts:214-220`).
- **`?reason=` handoff** — `/sell` situation cards prefill the reason select
  (`SellerLPForm.tsx:124-131`).

Materially divergent (a real fork, and the argument for MERGE):

- **`/sell/valuation` → `ValuationForm` → `submitValuationRequest`** — one-step form
  (all fields at once), same Seller Inquiry capture + canonical tagging, but its
  follow-up computes an INSTANT algorithmic CMA (`getCachedCMA`/`computeCMA` → PDF
  email) instead of queueing the broker-written draft
  (`app/home-valuation/actions.ts:62-222`, `:267-350`). Two different CMA products
  answer the same visitor question, and the Matt-locked "one spine" decision points the
  global CTA at `/sell#get-value`. §11 treats this as one process with one product.

## 10. Current implementation map

- **Routes:** `/sell` (kb register: KbHero/KbTestimonials/KbFooter + sell/* sections —
  `app/sell/page.tsx:51-57`), `/lp/seller-home-value` + `/lp/sell-your-home` (bespoke
  landing register: `components/landing/*` + hand-built sections),
  `/sell/valuation` (kb register + `primitives`), `/cma/[slug]` (route handler serving
  self-contained HTML), `/admin/cmas` (review surface). The form itself is
  `@/components/ui` primitives (`SellerLPForm.tsx:4-9`). Three design languages touch
  this one process — the exact register sprawl the program exists to end.
- **Actions/API/crons:** `submitSellerLPForm` + `saveSellerPartialLead`
  (`app/lp/seller-home-value/actions.ts`), `createCmaRequest` (`lib/cma-request.ts`),
  `autoEnrollByFubId` (`lib/crm/enroll.ts`), `cma-build-worker` / `crm-auto-enroll` /
  `crm-sequence-engine` / `crm-alert-drain` (vercel.json:17-26,57-58,21-22),
  `finalizeAndDeliverCma` (`lib/cma-deliver.ts`), `/api/meta-capi`, GA4 MP.
- **Known defects (all verified this pass):**
  - **D1 — fee copy contradicts a binding decision.** `/sell` metadata, hero lead, and
    FAQ market three plans at 2.5%–3.5% (`app/sell/page.tsx:68-71`, `:204`, `:90-91`);
    the absorbed Matt decision is ONE plan at 3%, matrix dead, tiers off the public
    site. Untracked `components/site/sell/SellPlanSingle.tsx` suggests an in-flight fix
    that has not landed.
  - **D2 — partial-save contract unenforced.** The no-save-until-contact rule is coded
    as an opt-out prop (`skipPartialLead`, uncommitted) that no embed passes;
    address-only saves still fire everywhere (`SellerLPForm.tsx:56-62,142-149`,
    `app/sell/page.tsx:208`).
  - **D3 — two CMA products, two intakes.** The `/sell/valuation` instant-CMA fork
    (§9) bypasses broker review, the cmas draft chain, and the version-chain clobber
    protection; it also predates the one-spine decision. `/sell` itself advertises it
    (`app/sell/page.tsx:213`).
  - **D4 — no SLA mechanism.** 24h-including-weekends is locked; copy says "one
    business day"; nothing measures or alerts on time-to-deliver (§8).
  - **D5 — analytics city default.** `valuation_requests.address_city` falls back to
    'Bend' for comma-less addresses, mislabeling non-Bend requests in that mirror
    (`actions.ts:344-349`; documented tradeoff, still a §0 smell in downstream ratios).
- **Duplicate/parallel paths that should die:** the `/sell/valuation` +
  `app/home-valuation/*` instant-CMA pipeline (merge into the written-CMA spine or
  delete); the legacy `public/cmas/` static files (already redirect-only, dies by
  attrition).

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes — it is the KPI.** The process is healthy at its core (capture
is genuinely never-drop, consent is fail-closed, the document is real and gated) and
the target shape is a consolidation, not a rebuild:

- **One spine, one product.** A single 2-step intake (address → contact) reachable from
  every node in the exploration graph, producing exactly one CMA product: the
  broker-written document with the immersive web view as its primary form. The instant
  algorithmic fork merges in or dies. Ideal step count for the visitor: 2 (today's form
  already achieves this; the fork's 1-step/4-field form trades friction for orphan
  risk and loses the qualification signal).
- **The delivered CMA is a graph node, not a dead end.** The opened document should
  carry doors back into the graph — the subject's neighborhood/city market node, the
  sell plan, the broker — making completion re-entry, not exit.
- **SLA becomes a mechanism.** The locked 24h/7-day promise needs a measured
  time-to-deliver metric and a breach alert to the accountable broker; copy and
  promise reconcile to whatever Matt re-confirms at P3.
- **The partial-capture policy gets decided once** (P3 question: keep partial saves as
  remarketing signal on paid LPs only, or kill everywhere per the no-save lock) and
  then enforced mechanically, not via an unused prop.
- **Data gaps blocking correctness:** no time-to-deliver telemetry; no measured CWV or
  submit-latency numbers for the entry routes; no GA4 device/channel split pulled for
  these routes this pass; CMA open/engagement events exist (doc-tracker) but roll up to
  no process-health readout.

**Destination implication:** this process does not need a destination of its own beyond
one canonical intake surface (today `/sell#get-value`; P5 may re-home it, not fork it —
locked) plus the private `/cma/[slug]` document node. Its real presence is as the
machine objective stamped on sell-side and market-knowledge pages.

**Dual objective this process stamps on its pages:**

- `visitor_objective`: "Learn what your home is actually worth from a broker who shows
  the comps behind the number."
- `machine_objective`: "Complete a valuation request (address + contact captured,
  seller relationship created and enrolled) — the E2 KPI event."
- `exits`: the confirmation state and the delivered CMA both open onto → `/cma/[slug]`
  (the document) → the subject property's city/neighborhood market node → the sell plan
  node → direct broker contact (phone). The document itself exits back into the graph
  (see above), never to a blank thank-you.

## 12. Acceptance checks

Persist these; never delete. Run against production reads and local/preview writes
(use a clearly-marked test email, e.g. `e2e-cma-test+<date>@ryan-realty.com`, and clean
up the created rows after).

1. **Ask above the fold (390):** open `/sell` and `/lp/seller-home-value` in a 390px
   viewport; the address input and its CTA are fully visible with zero scroll; the
   sticky mobile bar's "Get the valuation" scrolls to `#get-value`.
2. **Partial capture (current behavior):** on `/lp/seller-home-value`, enter an address
   and advance to step 2 with a fresh session; verify
   `SELECT * FROM visitor_events WHERE event_type ILIKE '%partial%' ORDER BY created_at DESC LIMIT 5`
   gains a row carrying the address. (Re-point this check at whatever P3 decides for
   D2.)
3. **Full submit → lead:** submit with the test email, timeline "Ready to sell", SMS
   consent UNCHECKED. Then:
   `SELECT id, tags, custom->>'cmaSlug', assigned_broker FROM crm_people WHERE emails::text ILIKE '%e2e-cma-test%'`
   → one row; tags include `audience:seller`, `seller:hot`, `source:seller-lp`,
   `broker:matt`; `cmaSlug` populated.
4. **Fail-closed SMS consent:**
   `SELECT channel, reason FROM crm_suppressions WHERE person_id = <id>` → an `sms` /
   `no-sms-consent` row exists (because the box was unchecked).
5. **Enrollment:**
   `SELECT status, enrolled_by FROM crm_sequence_enrollments WHERE person_id = <id>`
   → one row, `status='running'`, `enrolled_by='auto-rule'`; and a hot-lead call task in
   `crm_tasks` due ≤5 min after submit.
6. **CMA queue:**
   `SELECT status FROM cmas WHERE slug = '<cmaSlug>'` → `draft`;
   `SELECT status FROM marketing_brain_actions WHERE action_type='content:cma' AND target='cma:<cmaSlug>'`
   → `pending`.
7. **Build:** `curl -H "Authorization: Bearer $CRON_SECRET" https://ryan-realty.com/api/cron/cma-build-worker?limit=1`
   → `{ok:true, built:≥1}`; the cmas row now has non-null `html_content` and
   `render_args`, status still `draft`; the action row is `ready`.
8. **Draft privacy:** logged out, `GET /cma/<cmaSlug>` → 404 while status is draft;
   logged in as admin → the document renders (review iframe path).
9. **Finalize + gate:** finalize from `/admin/cmas` (or POST
   `/api/cma/<slug>/finalize-deliver` with admin auth). Then logged-out
   `GET /cma/<slug>` → 200 register shell (not the document); after registering with
   the WRONG email → 403 wrong-person shell; with the lead's email → consent shell,
   then the immersive document. `?print=1` returns the print artifact.
10. **Hold-gate release:** `SELECT custom->>'cmaLink' FROM crm_people WHERE id=<id>`
    → the live `/cma/<slug>` URL (stamped at finalize, releasing the sequence's
    `%cma_link%` hold).
11. **Attribution mirrors:** GA4 Realtime (or next-day BigQuery/GA4 export) shows one
    `generate_lead` and one `valuation_requested` for the test submit — and exactly
    one (the 2026-07-28 inflation class stays dead); Meta Events Manager shows the
    `Lead` event deduped across pixel + CAPI on the shared event id.
12. **Sweep safety net:** create a `crm_people` row with `audience:seller`, post-epoch,
    no enrollment, via the DAL; within 15 min the `crm-auto-enroll` cron enrolls it
    (or run the cron route directly with `$CRON_SECRET` and verify the enrollment row).
13. **Copy ↔ decision reconciliation (D1/D4):** grep the rendered `/sell` and LP HTML
    for `2.5%` / `3.5%` (must be absent once the one-plan decision ships) and confirm
    the delivery-promise wording matches whatever P3 re-locks for the SLA.
