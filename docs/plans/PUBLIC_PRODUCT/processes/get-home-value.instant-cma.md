> **MERGED -> get-home-value.written-cma (P3 lock, Matt 2026-08-11).** This PDS is evidence for the survivor; do not build surfaces from it directly.

# Process: get-home-value.instant-cma — Get an instant/auto CMA (dedicated valuation form)

## 0. Meta

- Status: deepened
- Cadence: event-driven
- Verdict (PROPOSAL, not a lock): **MERGE→get-home-value.written-cma** — same visitor job
  ("what is my home worth"), same request-of-record (`valuation_requests`), same canonical
  audience (`audience:seller`), and Matt's binding one-spine decision ("Global valuation CTA
  → one spine … P5 may re-home the spine, not fork it" — decisions.md 2026-08-11 absorbed
  block). This path IS the fork: a second capture form with a different step contract and a
  divergent, partially unmechanized fulfillment. The auto-CMA PDF capability is a fulfillment
  VARIANT for P3/P4 to adjudicate inside the merged process, not a separate visitor process.
- Last evidence pass: 2026-08-11 (every file:line below opened this session)

## 1. Purpose

(a) A homeowner learns what their Central Oregon home is worth: they submit an address and
contact info and receive a written comparative market analysis — instantly as a computed PDF
when the address matches a property in the database, otherwise a broker-written number with
an immediate acknowledgment. (b) It advances the capture-a-seller step of the machine — the
E2 KPI event (a completed valuation request with address + contact) plus CRM enrollment of a
warm seller lead — and serving (a) produces it because the written number cannot be delivered
without the address (the subject property) and the email (the delivery channel), so the
visitor hands over exactly the capture contract in exchange for the answer.

## 2. Inception (what starts it)

Trigger: visitor submits the single-step ValuationForm at `/sell/valuation#valuation-form`.
Preconditions: none — anonymous, no auth; the form requires address + email
(app/home-valuation/actions.ts:68-69), name and phone optional (ValuationForm.tsx:66-107).

Entry channels and concrete routes (all opened this run):

- **Organic/direct:** `/sell/valuation` is indexed with full pageMetadata
  (app/sell/valuation/page.tsx:34-48); hero CTA scrolls to `#valuation-form`
  (page.tsx:99-101); mobile sticky re-ask pins the same anchor (page.tsx:202-216);
  `SmoothScrollProvider` deep-links `#valuation-form` on load
  (components/site/kb/SmoothScrollProvider.client.tsx:72).
- **Global chrome:** header CTA (components/site/SiteHeader.tsx:118-120), mobile nav
  (components/site/MobileNav.tsx:193), mega menu (components/site/nav/MegaMenu.tsx:500),
  footer CTA (components/layout/FooterCtaButtons.tsx:30-35), site-nav "Written valuation"
  (lib/site-nav.ts:154), site menu (lib/site-menu.ts:281,300), site search index
  (lib/search/site-pages.ts:27).
- **Internal handoffs:** `/sell` cross-link "What's my home worth" → `#valuation-form`
  (app/sell/page.tsx:213); KbSell address-capture block on city/community/market pages
  pushes `/sell/valuation?address=…&from=<pathname>`
  (components/site/kb/KbSell.client.tsx:47-57, canonical path from lib/slug.ts:98-101);
  place pages' secondary CTA "Value my home" (app/cities/[slug]/page.tsx:482,
  app/cities/[slug]/[neighborhoodSlug]/page.tsx:445, app/communities/page.tsx:477);
  tools pages (app/tools/appreciation/page.tsx:151,
  app/tools/mortgage-calculator/page.tsx:170); AI chat directs valuation intents here
  (app/api/ai/chat/route.ts:36,47).
- **Legacy links:** `/home-valuation` → `/sell/valuation` permanent redirect
  (next.config.ts:217). `app/home-valuation/` has no page.tsx — the directory holds only
  `ValuationForm.tsx` + `actions.ts`, consumed by `/sell/valuation`
  (verified `ls` this run; import at app/sell/valuation/page.tsx:17).

True-source attribution at inception: the server action resolves the ORIGINATING surface
from the referer's `?from=` param (same-host, path-shaped) or the referer path, falling back
to the hardcoded legacy `/home-valuation` constant (app/home-valuation/actions.ts:80-99).

## 3. Actors

- **Visitor segment:** homeowner/prospective seller — tagged `audience:seller`, tier `warm`
  at capture (actions.ts:189-197). Includes owners handed off mid-exploration from place and
  market pages (the `?from=` producers in §2). Device reality: GA4 device split for these
  entry routes was NOT queried this run (recorded as a gap in §11); the binding posture is
  Matt's mobile-first "390 is truth" decision (decisions.md 2026-08-11 absorbed block), and
  the page ships a mobile-only sticky CTA (page.tsx:202-216).
- **Automated actors:** the `after()` post-response runtime (actions.ts:212-221); the
  CMA engine (`getCachedCMA`/`computeCMA`, lib/cma.ts:787,670); Resend email sender
  (actions.ts:247,330,356); Meta CAPI + GA4 MP mirrors (actions.ts:383-418); the
  `crm-auto-enroll` cron at 4,19,34,49 * * * * as enrollment catch-all (vercel.json:25-27).
- **Accountable for completion:** the broker (ADMIN_EMAIL alert, actions.ts:246-259) owns
  the promised hand-built number when no auto-CMA fires — with the defect that nothing
  mechanizes that obligation in this path (§10 D6).

## 4. Systems of record

- **`valuation_requests`** — the request of record: address parts, contact, `source_url`,
  `created_at` (insert at actions.ts:101-112 via DAL `insertValuationRequest`,
  lib/data/sync/syncWrites.ts:778-783; schema at docs/DATABASE_SCHEMA_SNAPSHOT.md §
  `valuation_requests`, 10 columns, no status/fulfillment column).
- **`crm_people`** (+ contact points, tags array) — the person of record, created/reused by
  `sendEvent` → `ensureNativeLead` (actions.ts:131-160; fallback 161-180).
- **`marketing_assignments`** — broker routing of record, written by `recordAssignment`
  inside `canonicallyTagLead` (lib/canonical-lead-tagger.ts:257-264).
- **`valuations`** — the computed CMA of record for the auto branch; only methodology
  ≥ 3.1 rows are served (lib/cma.ts:787-800).
- Explicitly NOT SoR: the in-house CRM (decommissioned 2026-06-24 — `sendEvent` is the
  in-house capture chokepoint); the admin alert inbox (a notification, not a queue); GA4 and
  Meta (mirrors); and — unlike the written-cma sibling — **no `cmas` row and no
  `marketing_brain_actions` row exists in this path** (nothing in actions.ts creates one;
  full file read this run).

## 5. End-to-end path (inception → completion)

1. **Arrive** · visitor · lands on `/sell/valuation` via a §2 channel · input: click/URL ·
   output: hero + form section render · system: static page, KB register
   (app/sell/valuation/page.tsx:68-218) · failure: WAF bot screen on non-browser UAs ·
   device: both; mobile gets the sticky re-ask (page.tsx:202-216).
2. **Reach the form** · visitor · hero CTA or sticky CTA scrolls to `#valuation-form`
   (page.tsx:99-101, 209-215; SmoothScrollProvider.client.tsx:72) · failure: KbSell
   handoffs arrive WITHOUT the hash — anchor absent from the router push
   (KbSell.client.tsx:52-57) — so handed-off visitors land at the hero top and must
   re-find the form · device: both.
3. **Fill the form** · visitor · single-step: address (required), name, email (required),
   phone, SMS-consent checkbox (ValuationForm.tsx:51-129;
   components/site/SmsConsentDisclosure.tsx renders `name="smsConsent"`) · failure: the
   `?address=` a KbSell visitor already typed is NOT prefilled — ValuationForm reads no
   search params and the page passes none (full files read this run) — the visitor types
   their address twice · device: both.
4. **Submit → validate** · client + server · `handleSubmit` posts FormData to
   `submitValuationRequest` (ValuationForm.tsx:16-23); server requires email then address
   (actions.ts:62-69), parses street/city/state/zip best-effort (actions.ts:71-78) ·
   failure: error string returned, form re-renders with `role="alert"`
   (ValuationForm.tsx:108-112).
5. **Resolve true source** · server · `?from=`/referer → `sourcePath`, fallback
   `'/home-valuation'` (actions.ts:80-99) · output: `source_url` for the insert and capture.
6. **Durable insert** · server · `insertValuationRequest` writes `valuation_requests`
   (actions.ts:101-112; lib/data/sync/syncWrites.ts:778-783) · failure: insert error is
   returned to the visitor and the process stops — nothing downstream fires without the row
   (actions.ts:112).
7. **CRM capture** · server · `sendEvent({ type: 'Seller Inquiry', … })` with person,
   property, source, and referer-derived UTM campaign → native `personId`
   (actions.ts:116-160); on failure, direct `ensureNativeLead` fallback with tags
   `audience:seller, source:home-valuation, fub-fallback` (actions.ts:161-180) · failure:
   both may fail — the lead still exists in `valuation_requests` but no person row; the
   response still returns success (capture is not visitor-blocking past the insert).
8. **Canonical tagging (awaited)** · server · `canonicallyTagLead({ audience:'seller',
   source:'cma-request', tier:'warm' })` (actions.ts:189-201) → hard-stop compliance check,
   tags + broker via `enrichNativeLead`, `marketing_assignments` row, then fire-and-forget
   `autoEnrollByFubId(personId)` (lib/canonical-lead-tagger.ts:218-272, enroll call
   :264-271) · failure: caught and logged, non-blocking (actions.ts:199-201). Note:
   `smsConsent` from step 3 is never read by the action nor forwarded to enrollment
   (grep clean this run; lib/crm/enroll.ts:268-271,300 → SMS suppressed fail-closed).
9. **Respond** · server → client · returns `{ success, cmaSent:false, eventId }`;
   `after()` schedules the follow-up work post-flush (actions.ts:203-222). Client fires
   browser `fbq('track','Lead')` with the same `eventID` for CAPI dedup plus GA4
   `generate_lead` (ValuationForm.tsx:24-32); success panel renders the promise copy
   (ValuationForm.tsx:35-48) · device: both.
10. **Broker alert** · after() · plain-text email to ADMIN_EMAIL with name/email/phone/
    address, replyTo the lead (actions.ts:246-259) · failure: `.catch(() => {})` swallows
    errors — a failed alert is invisible (actions.ts:258).
11. **Suppression gate** · after() · `isSuppressedByEmail` (fails closed on empty email —
    lib/crm/suppressions.ts:84-92) gates BOTH lead-facing emails at three chokepoints
    (actions.ts:265, 279, 353); a suppressed lead is still captured and the broker still
    alerted.
12. **Auto-CMA branch** · after() · `findPropertyByAddress` city-filtered DAL lookup +
    street-token match (actions.ts:27-60, 269-271; lib/data/sync/syncWrites.ts:618) →
    `getCachedCMA` (methodology ≥ 3.1 only, lib/cma.ts:787-800) else `computeCMA` (subject
    → comps → filters → `valuations` insert, lib/cma.ts:670-700) → listing enrichment via a
    500-row `getCityListings` fetch (actions.ts:283-308) → `CMAPdfDocument` render +
    `assertPdfPageSafety` page-contract check (actions.ts:310-329) → email with
    `home-valuation.pdf` attached (actions.ts:330-336) · failure: any throw is caught,
    logged, and falls through to step 13 (actions.ts:339-341) · device: n/a (server).
13. **Acknowledgment branch** · after() · when no CMA was sent and not suppressed: immediate
    plain-text email promising the hand-built number, replyTo `matt@ryan-realty.com`
    (actions.ts:350-376) · failure: caught + logged non-blocking (actions.ts:375).
14. **Ad-platform mirrors** · after() · Meta CAPI `Lead`, value 500 USD, `lead_type:
    seller_valuation`, dedup `eventId` (actions.ts:383-403) + GA4 MP `generate_lead`
    `lp_variant:'home-valuation'` (actions.ts:407-418).
15. **Enrollment catch-all** · cron · `crm-auto-enroll` sweeps at 4,19,34,49 * * * *
    (vercel.json:25-27) so a dropped fire-and-forget in step 8 still enrolls.

## 6. Decision points

- **Validation:** email present? address present? (actions.ts:68-69) → error return.
- **Source resolution:** valid same-host `?from=` → its path; else referer path; else the
  legacy `'/home-valuation'` constant (actions.ts:86-99).
- **Capture succeeded?** `fubRes.ok` → personId; else `ensureNativeLead` fallback; else no
  person (actions.ts:160-180).
- **personId resolved?** gates canonical tagging (actions.ts:189).
- **Compliance hard-stop:** `isHardStopped` inside `canonicallyTagLead` skips
  tagging/enrollment for do-not-email/unsubscribed/hard-stop people
  (lib/canonical-lead-tagger.ts:229-234).
- **SMS fail-closed:** enrollment leaves SMS enabled ONLY when the action passes
  `smsConsent:true` — this action never does, so SMS is always suppressed here
  (lib/crm/enroll.ts:300; consent checkbox contract in
  components/site/SmsConsentDisclosure.tsx:8-24).
- **Suppression (email channel):** three fail-closed chokepoints gate the two lead-facing
  sends; capture and broker alert are never gated (actions.ts:262-279, 350-353;
  lib/crm/suppressions.ts:84-92).
- **Property match?** decides auto-CMA vs acknowledgment (actions.ts:269-271, 27-60).
- **Cached CMA fresh + methodology ≥ 3.1?** else recompute (lib/cma.ts:787-800).
- **Comps survive filters?** zero-comp subjects return null → acknowledgment branch
  (lib/cma.ts:686-691).
- **Page contract:** the rendered PDF must pass `assertPdfPageSafety` before send
  (actions.ts:326-329) — a §0-adjacent gate on the artifact a lead opens.
- **§0 trace:** every number in the auto-CMA PDF comes from the `valuations`-backed
  `computeCMA` result, never free text (actions.ts:310-323; lib/cma.ts:670-700).

## 7. Completion

Done when ALL of: (1) `valuation_requests` row inserted; (2) `crm_people` person exists
with `audience:seller` + `source:cma-request` tags, a broker assignment in
`marketing_assignments`, and an enrollment decision recorded (inline fire-and-forget or the
15-min sweep); (3) broker alert email dispatched; (4) exactly one lead-facing email
dispatched — the auto-CMA PDF or the acknowledgment — unless suppressed; (5) Meta CAPI +
GA4 server events fired with the shared dedup `eventId`.

Artifacts at completion: the `valuation_requests` row; the tagged person + assignment; for
the auto branch a methodology-stamped `valuations` row and the emailed
`home-valuation.pdf`; the on-screen success panel (ValuationForm.tsx:35-48).

Terminal states: **success-with-CMA** (cmaSent) · **success-with-ack** (promised hand-built
number) · **success-suppressed** (captured + broker alerted, no lead-facing email —
actions.ts:265-279) · **captured-without-person** (insert ok, both capture paths failed —
lead recoverable only from `valuation_requests`) · **validation-error** (nothing written).

## 8. Time & performance

- **Time-to-answer budget (page):** the visitor's question ("what is my home worth?") is
  answered by an EMAIL, not the page — the page's job is to make the exchange obvious in one
  viewport. The form sits directly under the hero with the promise microcopy "A broker
  emails your written valuation within 24 hours" (ValuationForm.tsx:126-128); the hero CTA
  and mobile sticky both target the form anchor. No numeric budget exists yet; setting one
  is a P5/P6 output.
- **Submit latency:** the inline path is insert + capture + tagging (steps 6-8) before the
  browser gets its answer. The code documents measured production history for the OLD inline
  design: 20s, 77s, and one submit exceeding 150s, producing abandoned/duplicate submissions
  — the reason the `after()` split exists (comment at actions.ts:203-210). Current post-split
  latency was NOT measured this run (gap, §11); "slow" here means the seller stares at
  "Sending…" (ValuationForm.tsx:122) and the visible symptom is duplicate leads.
- **Core Web Vitals:** not measured for `/sell/valuation` this run (gap, §11). The entry
  page is static-rendered with no data fetches (page.tsx:68 — no async work), so its weight
  is the KB register's CSS/JS, not queries.

## 9. Variants

- **Entry-channel variants sharing the identical path:** chrome CTA / mega menu / footer,
  place-page and market-page KbSell handoffs (arriving with `?address=` + `?from=`), tools
  pages, `/sell` cross-link, AI-chat referral, legacy `/home-valuation` 301. Only
  attribution (`source_url`) differs (actions.ts:80-99). No split warranted.
- **Mid-funnel CTA click (`trackHomeValuationCta`)** — signed-in or cookie-identified
  visitors clicking a valuation CTA fire a nurture-tier `Seller Inquiry` +
  `source:home-valuation` tag + session stitch BEFORE any form submit
  (app/actions/lead-capture.ts:76-140, sourceUrl `/sell/valuation` at :91). A
  micro-capture variant of this process's inception, not a separate process.
- **The written-cma sibling** (`get-home-value.written-cma`) is NOT a variant — it is the
  spine this process should merge into: 2-step SellerLPForm, `cmas` draft +
  `content:cma` brain action + broker review + `/cma/[slug]` delivery. The paths
  materially diverge in capture contract and fulfillment today, which is the defect, not a
  reason to keep both (§0 Verdict).

## 10. Current implementation map

**Routes:** `/sell/valuation` (app/sell/valuation/page.tsx — the only page);
`/home-valuation` (redirect-only, next.config.ts:217; directory hosts form + action, no
page.tsx — verified this run).

**Registers used (of the design languages):** KB (kb.css, KbHero, KbBreadcrumb, KbFooter,
KbSectionTracker, SmoothScrollProvider — page.tsx:23-28), `primitives` (H2/H3/Eyebrow/Body/
CTAButton — page.tsx:20), plus `@/components/ui` controls in the form (ValuationForm.tsx:6-8)
and one raw inline-styled sticky bar (page.tsx:202-216).

**Actions/API/crons:** `submitValuationRequest` server action (app/home-valuation/
actions.ts:62); DAL `insertValuationRequest` + `findPropertiesByAddressFilter`
(lib/data/sync/syncWrites.ts:778,618, exported at lib/data/index.ts:476-478); CMA engine
(lib/cma.ts:670,787); `/api/meta-capi` (route exists — app/api/meta-capi/route.ts);
`crm-auto-enroll` cron (vercel.json:25-27). Measurement reads: admin lead-flow report counts
`valuation_requests` rows as "Form submits" (app/admin/(protected)/reports/lead-flow/
page.tsx:269,370); admin analytics reads the same table (app/admin/(protected)/analytics/
_lib/queries.ts:8).

**Known defects (each verified this run):**

- **D1 — capture-contract fork.** Matt's locked contract is step-1 address only, step-2
  email required, one spine (decisions.md 2026-08-11 absorbed block). This form is
  single-step all-fields (ValuationForm.tsx:51-129) and a second capture pipeline in
  parallel with the SellerLPForm spine.
- **D2 — consent collected, then discarded.** The carrier-verified `smsConsent` checkbox
  posts with the form (SmsConsentDisclosure.tsx:19-24) but `submitValuationRequest` never
  reads it and `autoEnrollByFubId` is called without opts, so SMS is suppressed even for
  leads who explicitly opted in (actions.ts:62-66 — no smsConsent read;
  lib/canonical-lead-tagger.ts:264-271; lib/crm/enroll.ts:300). Fail-closed = compliant,
  but given consent is silently thrown away.
- **D3 — address handoff dropped.** KbSell sends the typed address as `?address=`
  (KbSell.client.tsx:52-57) but neither the page nor the form reads search params (both
  files read in full) — the visitor re-types their address. A direct continuity violation
  (decisions.md directive 5).
- **D4 — handoff lands without the anchor.** KbSell pushes `valuationPath()` with no
  `#valuation-form` hash (KbSell.client.tsx:57; lib/slug.ts:98-101), so handed-off visitors
  land at the hero and must re-find the form.
- **D5 — retired URL stamped into live records.** `'/home-valuation'` survives as the
  hardcoded sourcePath fallback (actions.ts:86-87), the admin-alert Source line
  (actions.ts:255), and the CAPI `eventSourceUrl` (actions.ts:399) — attribution and ad
  optimization reference a URL that has been a redirect since the route move.
- **D6 — the promise has no mechanism.** On-page copy promises a broker-written valuation
  within 24 hours (ValuationForm.tsx:126-128; page metadata page.tsx:36-38), but the
  no-auto-CMA branch queues NOTHING — no `cmas` draft, no `content:cma` brain action, no
  task, no SLA timer. Fulfillment rides entirely on one admin email whose failure is
  swallowed (actions.ts:246-259, `.catch(() => {})` at :258). The written-cma sibling has
  `createCmaRequest`; this path does not (full actions.ts read).
- **D7 — success copy promises a call nobody schedules.** The success panel says "expect a
  quick call from our team" (ValuationForm.tsx:44) but no call task is created in this path
  (grep for crm_tasks/hot-lead: zero hits this run; the seller-LP spine creates a 5-minute
  call task).
- **D8 — no fulfillment state.** `valuation_requests` has no status/fulfilled_at column
  (schema snapshot, 10 columns), so the E2 KPI as measured by the lead-flow report counts
  SUBMITS, not completed valuations (lead-flow/page.tsx:269,370). "Completed valuations
  week over week" is not currently measurable from the request table.
- **D9 — heavy enrichment fetch.** The auto-CMA branch pulls up to 500 city listing tiles
  to decorate one PDF (actions.ts:290-295) — part of the documented pre-split latency
  (actions.ts:203-210); now post-response but still the same cost per submit.
- **D10 — duplicated capture plumbing.** Both this path and the seller-LP spine write
  `valuation_requests`, tag `audience:seller`, alert the broker, and mirror to CAPI/GA4
  with near-identical code in two files (this file vs app/lp/seller-home-value/actions.ts
  per the written-cma registry row) — two parallel implementations of one contract.

## 11. Target shape (process-level, not pixels)

**Should this exist?** As a distinct process, no — the JOB ("learn what my home is worth")
is one process, and Matt's one-spine decision binds it. What should survive the merge:

- **One capture contract** (the locked one): step 1 address only, step 2 email required +
  phone optional, no orphan saves. The dedicated valuation surface (whatever P5 names it)
  presents the spine's contract, not a parallel form.
- **The auto-CMA capability is the differentiator candidate worth keeping** — an address
  that matches the database can get a computed, methodology-stamped answer in minutes while
  the broker-written CMA within 24h remains the committed deliverable. Whether the instant
  artifact ships to the lead (current behavior) or becomes broker-reviewed-first (the spine
  behavior) is a P3 product question for Matt; both cannot coexist as unlabelled siblings.
- **Ideal step count:** 2 visitor steps (address → contact), then zero further visitor work
  — every downstream step is machine or broker. Mobile-first per the locked 390 posture.
- **Data gaps blocking correctness** (✗ statements for P4):
  - ✗ No fulfillment state on `valuation_requests` (no status/fulfilled_at/cma_sent), so
    the E2 KPI cannot distinguish a submit from a delivered valuation.
  - ✗ No queued fulfillment artifact in the no-auto-CMA branch (no `cmas` row, no brain
    action) — the 24h promise is unenforceable and unmeasurable.
  - ✗ `smsConsent` is not persisted anywhere on this path — given consent is unrecoverable.
  - ✗ GA4 device split and CWV for the entry route not pulled this run — needed before P5
    sets time budgets.
  - ✗ Post-split submit latency unmeasured — needed to size the inline capture chain.

**Destination implication:** no destination of its own. The merged get-home-value process
stamps ONE valuation destination in the IA (P5 names and homes it; today's equity-bearing
URLs `/sell/valuation` + the `/home-valuation` 301 are SEO facts to preserve via redirects,
per the amnesia carve-out). All global chrome and place-page valuation CTAs point at that
single spine; handed-off context (address, originating place) must survive the edge per the
continuity directive.

**Dual objective this process stamps on its pages:**

- `visitor_objective`: "Learn what your home is worth — a written number with the comps
  behind it, free, with no listing agreement."
- `machine_objective`: "Complete a valuation request (address + contact captured — the E2
  KPI event) and enroll the owner as a warm seller in the CRM spine."
- `exits`: the delivered CMA itself (email/PDF today; the spine's `/cma/[slug]` if merged
  fulfillment wins at P3) · the sell/listing-plan node · the market-knowledge node for the
  owner's geography (the "is now a good time" follow-up question) · contact-a-broker.

## 12. Acceptance checks

Persist; never delete. Run against production unless marked staging.

1. **Legacy redirect holds:** `curl -sI -A "Mozilla/5.0" https://ryan-realty.com/home-valuation | grep -iE "^(HTTP|location)"`
   → 308/301 with `location: /sell/valuation`. (Browser UA required — WAF blocks bare curl.)
2. **Form present at the anchor:** in a real browser, load
   `https://ryan-realty.com/sell/valuation#valuation-form` → viewport lands on the form
   section (`id="valuation-form"`, page.tsx:108); address/email inputs and the SMS consent
   checkbox render.
3. **E2E submit (staging or a flagged internal test email):** submit
   `123 Test St, Bend, OR 97701` + an internal test email → success panel renders
   (ValuationForm.tsx:35-48), then verify rows 4-6 below and delete the test artifacts.
4. **Request of record:**
   `select id, address_city, email, source_url, created_at from valuation_requests order by created_at desc limit 5;`
   → the test row exists with the expected `source_url` (the `?from=` page when handed off,
   not the constant, when the handoff path is under test).
5. **Person + tags:**
   `select id, tags from crm_people where tags @> array['source:cma-request'] order by created_at desc limit 5;`
   → the test person carries `audience:seller`, `seller:warm`, `source:cma-request`, a
   `broker:*` tag.
6. **Routing + enrollment:**
   `select audience, broker, source, tier, assigned_at from marketing_assignments where source = 'cma-request' order by assigned_at desc limit 5;`
   → assignment row present; and within 15 minutes the person has an enrollment decision
   (inline or via the sweep — cron registered at vercel.json:25-27:
   `grep -A1 crm-auto-enroll vercel.json` → `4,19,34,49 * * * *`).
7. **Auto branch integrity (unit-level):** for a known DB-matched address,
   `select property_id, estimated_value, value_low, value_high, comp_count, methodology_version, computed_at from valuations order by computed_at desc limit 5;`
   → served valuation is methodology ≥ 3.1 (getCachedCMA contract, lib/cma.ts:787-800), and
   the emailed PDF passed `assertPdfPageSafety` (a page-contract failure throws and falls to
   the acknowledgment branch — actions.ts:326-341).
8. **Exactly-one lead email:** the test inbox received EITHER the CMA attachment email
   (`subject: Your Home Valuation – …`) OR the acknowledgment
   (`subject: We have your home-value request`), never both, never neither (unsuppressed).
9. **Suppression fail-closed:** submit with an email present in the suppression store →
   rows 4-6 still land, broker alert still sends, NO lead-facing email arrives
   (chokepoints actions.ts:265,279,353).
10. **Pixel dedup:** in Meta Events Manager test events, the browser `Lead` (fbq eventID,
    ValuationForm.tsx:26-30) and the server CAPI `Lead` (actions.ts:383-399) share one
    `eventId` and dedupe to a single event; GA4 shows one `generate_lead` with
    `lp_variant=home-valuation` (actions.ts:407-418).
11. **No orphan-save regression (spine contract):** attempt submit with address but no
    email → server rejects (`Email is required`, actions.ts:68) and
    `select count(*) from valuation_requests where email is null or email = '';` returns 0
    (column is NOT NULL per schema snapshot — this check guards against schema drift).
12. **Gates:** `npm run ci:gates` green on any commit touching these files.
