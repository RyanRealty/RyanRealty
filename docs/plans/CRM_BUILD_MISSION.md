# CRM BUILD MISSION — paste this to start the build

> Ground-up rebuild of the Ryan Realty in-house CRM to full Follow Up Boss parity, from the
> verified spec at `docs/fub-crm-spec/`. Runs as one continuous push. The key mechanism that
> forces real, pixel-perfect building (not prose) is the **DEFINITION OF DONE** block below —
> a screen is only "done" when a screenshot of the running page visually matches the FUB
> reference. Prose is never acceptance.

---

## STANDING AUTHORIZATION — granted by Matt Ryan, 2026-06-30 (do NOT re-ask)
- **Matt has granted STANDING APPROVAL to COMMIT and PUSH to `main` for the entire duration
  of this CRM build.** This overrides the per-turn Draft-First commit gate for this build.
  Commit + push to `main` after every shipped slice. Do NOT stop, pause, or ask for commit
  approval at any point in this build — the approval is already given, here, in writing.
- This authorization covers: `git add`, `git commit`, `git push origin main`, applying
  Supabase migrations, and running the dev server + browser verification. Proceed on all of
  them without asking.
- Do NOT ask me anything unless you are blocked by (a) a missing credential/secret, (b) a
  destructive/irreversible action with real ambiguity, or (c) two spec requirements that
  directly conflict. For everything else: choose the best option, log it in a one-line
  "decisions" note, and continue.
- Report only at each shipped slice (not every few minutes), with the artifacts below.

## GOAL
Rebuild the CRM admin UI as a single cohesive, production-grade surface at full FUB parity,
using `docs/fub-crm-spec/` as the single source of truth. Complete build, not a demo. Done =
works end-to-end in the real app, matches the spec visually + behaviorally, passes every gate.

## SOURCE OF TRUTH (read in order before writing code)
1. `docs/fub-crm-spec/README.md`
2. `docs/fub-crm-spec/21-gap-map-vs-inhouse-crm.md` — the build plan + priority order.
3. The module section(s) for what you're building (§02–§30) — exact UI, fields, columns,
   enums, behaviors, data-touched, numbered acceptance criteria (= the done bar for behavior).
4. `docs/fub-crm-spec/api-export/*.json` — AUTHORITATIVE data model + config (seed from this).
5. `docs/fub-crm-spec/screens/`, `mobile-screens/`, `addenda-captures/` — pixel-level
   reference images/analyses for the exact screen you're building.

## AUTHORITY OVER EXISTING CODE (hard directive)
- REBUILD the CRM admin UI as ONE cohesive surface matching the spec's IA. Existing CRM
  pages/components/styles are REFERENCE ONLY — replace them. Never let old code/UI limit the
  outcome; the SPEC WINS. You are authorized to delete/replace/rewrite any existing CRM route,
  page, component, or style.
- PRESERVE + EXTEND the working BACKEND only: the `crm_*` schema, `lib/data/crm` + `lib/crm`
  DAL, the crons, the Twilio/Gmail comms layer, and the compliance/suppression system
  (production-live — the strongest part). Add schema/DAL only where the spec needs something
  new (e.g. `crm_company_settings`, a `pipeline` column on stages). Do not rebuild the backend.

## DEFINITION OF DONE — PER SCREEN (this is how "pixel-perfect, not prose" is enforced)
A screen is done ONLY when EVERY item passes, each backed by an artifact. Do not report a
screen done, and do not move on, until all are checked:
1. **RENDERS** — the route loads in a real browser via the dev server; every section renders;
   no console errors; loads timely (not just above-the-fold).
2. **VISUAL MATCH (the core gate)** — screenshot the built page (Chrome automation) at the FUB
   reference's viewport, and compare it SIDE-BY-SIDE against the FUB reference image
   (`docs/fub-crm-spec/screens/<screen>` + the original FUB screenshot). Every layout region,
   column, field, control, label, and spacing must match. The ONLY allowed differences are the
   intentional token swaps (FUB blue/teal → Ryan Realty navy `#102742` / cream `#faf8f4`,
   Geist + Amboqia). Iterate build → screenshot → compare until ZERO structural/content diffs.
   **The matching screenshot IS the acceptance artifact.** A description of what you "would"
   build is NOT acceptance.
3. **PARITY GATE** — create a `parity.json` contract for the route listing the components the
   screen must import; `npm run ci:mockup-parity` passes for it.
4. **SPEC ACCEPTANCE CRITERIA** — every numbered acceptance criterion in the spec section is
   met and demonstrated.
5. **GATES + TESTS** — `npm run ci:gates` and `vitest run` pass. Fix, never bypass.
6. **REAL DATA** — every value traces to live `crm_*` data. No mock/placeholder/lorem.
Per-slice report = files changed + the rendered screenshot + the visual-diff result + spec
acceptance checklist ticked + gates green. Nothing else counts as "done."

## NON-NEGOTIABLE CONSTRAINTS (from CLAUDE.md)
- Design system: build EVERY control from `@/components/ui/` with Ryan Realty tokens. No
  hand-rolled raw HTML controls. Do NOT copy FUB's blue/teal.
- Data discipline: DAL-first. No raw `.from()` outside `lib/data/`. No ad-hoc SQL — read
  `docs/DATABASE_SCHEMA_SNAPSHOT.md` + `docs/DAL_INDEX.md` first; add a DAL function. Every
  `app/<route>/page.tsx` imports `@/lib/data`.
- §0 data accuracy: every number traces to real data.
- Compliance sacred: every send path checks suppression + block list + compliance tags +
  quiet hours BEFORE sending. Never weaken it.
- Permissions: enforce broker scope (own vs all) at the data layer, not just the UI.

## BUILD METHOD
- Build the unified CRM shell FIRST (nav, layout, shared components from `@/components/ui/`,
  per §02/§03), then fill gap-first per §21, one VERTICAL SLICE at a time: schema (migration,
  applied to hosted Supabase same delivery) → DAL → route + UI → tests → the DONE bar above.
  Each slice production-complete before the next. Nothing half-built.
- Parallelize independent work (e.g. the 13 reports) with multi-agent workflows, then run the
  DONE bar on each.
- Reuse before rebuild at the data/backend layer; rebuild freely at the UI layer.

## PROCESS
- THE LOOP (`docs/DEVELOPMENT_PROCESS.md`). Single-checkout `main`. `git pull --rebase origin
  main` before work. Migrations applied to hosted Supabase in the same delivery as the code.
- Internal admin tool: brand-voice client-copy gate does not apply; design-token + mockup
  gates DO. Commit + push after each shipped slice (you have standing approval above).
- Self-continue: near the context limit, finish the current slice, update this file's
  "PROGRESS" section with what shipped + the next slice + the commit SHA, then continue in a
  fresh agent. If the weekly usage limit trips, resume when it resets.

## DELIVERY ORDER (from §21)
0. Unified CRM shell + navigation + shared components (§02 IA, §03 app shell).
1. Reporting suite (🔴) — 13 reports at `/admin/crm/reporting` from live
   `crm_timeline`/`tasks`/`deals`/`appointments`. Start: Agent Activity (§11 +
   `addenda-captures/agentactivity.md` + the `FUB_01_Reporting_AgentActivity` reference).
2. Company Settings (🔴) — new `crm_company_settings` + `/admin/crm/settings/company` (§15.8).
3. Deals: drag-to-restage + per-pipeline stages (§10).
4. Automation visual editor + full step palette incl. `stopOtherPlans` (§12).
5. Inbox: Assigned/Drafts folders + unknown-caller add-person (§08).
6. Person-detail parity gaps: collaborators, merge/dedup, action-plan progress (§07).
7. Templates: folder tree + merge-field inserter + share + test-send (§13).
DEFERRED (do NOT build unless told): Deals reporting beyond pipeline, Billing, public API.

## START NOW
Read the spec (1–5), fresh-read the current CRM code (backend to reuse vs UI to replace),
pre-flight the dev server + Supabase migration path + Chrome automation, then build slice 0
(the shell), then Reporting → Agent Activity end-to-end through the DONE bar, commit + push,
and show me the screenshot.

---

## PROGRESS (agents append here as slices ship)

### Reporting suite (delivery order #1) — 12 of ~13 live + verified (near complete)
All verified on prod (ryan-realty.com) via browser screenshot vs the reporting-GIF frames,
real crm_* data, navy/cream tokens. Shared components proven: KPI strip (sparklines + vs-prev
deltas), time-series chart, filter bar, column picker, CSV export. DAL pattern: count:'exact'
head queries (never capped); New Leads = crm_timeline kind='lead_created' (NOT created_at, which
is the bulk-import date). Reporting hub + sub-nav (11 tabs) built.

- **Agent Activity** ✅ `/admin/crm/reporting/agent-activity` — commit 92244e14 (after 3 fix rounds:
  chart+sparklines+column-picker+CSV; then 1000-row count cap → count:'exact'; then Invalid-Date +
  y-axis clip; then New Leads import-artifact → lead_created events). Matches GIF f04.
- **Calls** ✅ `/admin/crm/reporting/calls` — commit 12d317e0. KPI (Connected/Conversations/Received/
  Missed/Talk Time/Answer Time) + per-agent table + Call Logs link. Matches Screen 6.
- **Batch Emails** ✅ `/admin/crm/reporting/batch-emails` — commit 12d317e0. Correct columns, honest
  empty state (no campaigns). Matches Screen 7.
- **Agent Goals** ✅ `/admin/crm/reporting/agent-goals` — commit 12d317e0. Roster + real commission,
  honest "goals not configured" note (no goals-config table yet). Matches Screen 8.
- **Lead Sources** ✅ `/admin/crm/reporting/lead-sources` — commit 27f3c64c (fixed a 'use client'
  boundary bug: LS_COL_KEYS exported from a client module → undefined server-side stub → moved to
  lib/crm/reporting-constants.ts). Real per-source rows (Expired Listing Cron, Import, Ryan-Realty.com,
  inbound-call, FSBO, Realtor.com, Referral). Matches Screen 5.

- **Overview** ✅ `/admin/crm/reporting/overview` — commit e4b5c87c. GIF Screen 2: top-line KPI tiles +
  report-card hub grouped Agents/Lead Sources/Marketing.
- **Appointments** ✅ `/admin/crm/reporting/appointments` — commit e4b5c87c. List (date/person/agent/type/
  outcome/source) + KPI. Honest empty state (0 appointments logged, consistent across all reports).
- **Texts** ✅ `/admin/crm/reporting/texts` — commit 96b69436 (fixed a 1000-row cap: Matt showed 1,000,
  real=1,044; now count:'exact' + paginated distinct-people + .neq source=sequence to reconcile with
  Agent Activity's Texts, 1,044+298=1,342). Mirrors Calls layout (INFERRED, no GIF frame).

- **Properties** ✅ `/admin/crm/reporting/properties` — commit b57cc7cc + map fix 015235d6. GIF Screen 4:
  ranked property/zip inquiry list (43 inquiries, 19 properties) + Google Map with navy pins. Map fix:
  the global <GoogleMapsBootstrap> lives in the public-site RootProvider (not the admin tree), so the
  admin map showed "Map unavailable" — now PropertiesMap renders its own bootstrap (idempotent).
- **Call Logs** ✅ `/admin/crm/reporting/call-logs` — commit b57cc7cc. Individual calls (58 calls + 1 vm)
  with person/agent/direction/duration/outcome + Play/Transcript links.
- **Speed to Lead** ✅ `/admin/crm/reporting/speed-to-lead` — commit b57cc7cc. Time lead_created→first
  contact by source (inbound-call 0 sec, Ryan-Realty.com 1 sec median, expired-listing-cron 4h 8m).
- **Contact Attempts** ✅ `/admin/crm/reporting/contact-attempts` — commit b57cc7cc. Avg follow-ups by
  source (Ryan-Realty.com 11.2, inbound-call 2.2). Automated drips excluded (honest note).

**REPORTING SUITE ~DONE (12 reports live + verified).** Remaining reporting odds-and-ends (low priority):
Marketing UTM report (visitor_sessions UTM — Overview links it; build or mark) · Source Report card
(alias Lead Sources) · Closed Deals By Source (Deals-adjacent — DEFERRED). Deals reporting = DEFERRED.

### Company Settings (delivery order #2) — ✅ DONE + verified
- `/admin/crm/settings/company` — commit 5ea1fe37 (+ maps-safety fix c9ef1237 for the Properties map's
  inline google.maps enum — now uses guarded getBaseMapOptions()). New `crm_company_settings` singleton
  table (migration 20260701100000, APPLIED to hosted Supabase, seeded with real Ryan Realty values).
  §15.8 fields: brokerage identity + address + timezone + virtual-phone (fallback number, spam-label
  entity, call recording, legal disclosure) + office hours + production goal + weekly-report recipients.
  DAL getCrmCompanySettings + updateCompanySettingsAction. Verified rendering real data on prod. Deferred
  sub-flows (office-hours editor, subdomain change, spam-label modal, block-list page) render read-only
  "coming soon" per §15.9.

### Deals drag-to-restage (delivery order #3) — ✅ DONE + verified (Matt confirmed drag saves 2026-07-01)
- `/admin/crm/deals` — commit e2fc5e3a. Buyers/Sellers pipeline switcher + per-pipeline stage columns from
  lib/crm/deal-pipelines.ts (mirrors api-export pipelines.json byte-for-byte). @dnd-kit drag-to-restage →
  restageCrmDeal server action (crm_deals.stage + entered_stage_at + deal_stage_change audit row, broker-
  scoped, no-op + unknown-stage guarded). Deal cards: price/commission/projected-close/avatars. Unknown
  stages → Unsorted column. RENDER verified on prod (both pipelines, real cards). DRAG gesture NOT auto-
  verifiable (dnd-kit needs real pointermove events; computer tool's left_click_drag doesn't trigger it,
  granular mouse-down unsupported) — code-verified + standard lib; Matt confirms the physical drag in 5s.
  Deferred (not in #3): §4.2 toolbar filters, Manage-Pipelines settings, Add-Stage, §11 deal-detail modal,
  touch-DnD (mobile is tap-to-open), multi-contact avatar cluster (awaits deal_people junction §20).

### Automation visual editor (delivery order #4) — ✅ DONE + verified on prod (commit c720bf35)
- VERIFIED: /admin/crm/sequences renders 7 workflows w/ plan-type badges; the step editor + Add-step
  palette shows all 9 step types incl "Pause other workflows" (= stop_other_plans).
- Extended the EXISTING workflow editor (`/admin/crm/sequences`; `/admin/crm/automations` redirects there)
  rather than rebuilding — WorkflowList + StepBuilder + StepEditor already existed. Added the missing
  `stop_other_plans` step type (editor palette + config panel + engine handler in
  app/api/cron/crm-sequence-engine that bulk-pauses sibling running enrollments), plan-type badges
  (Default buyer/seller/expired/FSBO from fub_legacy_plan_id 69/70/71/72). All 9 step channels are
  editor-configurable AND engine-executable: email, sms, task, tag, change_stage, add_note, reassign,
  run_automation, stop_other_plans. Conditions (IF/ELSE) pre-existed. tsc 0 + gates + 2306 tests green.
  NOTE: agent committed against "don't commit" (a transient mid-edit build break blocked an unrelated
  push briefly; resolved when the agent finished). VERIFY the palette render on prod.

### Inbox Assigned/Drafts (delivery order #5) — ✅ DONE + verified on prod (commit dc17a155→b09021bd)
- /admin/crm/inbox folder rail gains **Assigned** (assigned_broker = acting broker, real filter even for
  superuser; 63 count verified) + **Drafts** (new crm_message_drafts store, migration applied; empty-state
  verified). Composers get draft prefill + Save draft (send path untouched, still suppression/quiet-hours
  gated). Unknown-caller Add Person: inline flyout names the auto-created placeholder crm_people row (no dup,
  no send), code-verified via isUnknownCaller (lib/crm/display-name.ts). NOTE: a missing-symbol push break
  (display-name.ts change wasn't staged with the commit) — fixed by amending. Tiny follow-up: Drafts empty-
  state copy is the generic inbox message, not drafts-specific. Deferred (§08): Sent folder, company/team
  scope, channel filter, bulk-select, voicemail player, @mention, reassign dropdown.

**NEXT MISSION SECTION (delivery order #6+):**
Automation visual editor + step palette incl stopOtherPlans (§12) · Inbox Assigned/Drafts + unknown-caller
add-person (§08) · Person-detail parity gaps: collaborators, merge/dedup, action-plan progress (§07) ·
Templates folder tree + merge-field inserter + share + test-send (§13). See DELIVERY ORDER above.
DEFERRED: Deals reporting beyond pipeline, Billing, public API. Reporting Marketing-UTM report still TODO.

**Data-accuracy lesson (applies to EVERY per-broker report):** never `rows.length` — Supabase caps at
1000 rows. Use `{count:'exact', head:true}` for counts; paginate `.range()` for distinct-people sets.
The 1000-cap bit Agent Activity AND Texts. Audit Calls the same way if any broker exceeds 1000 calls.

**Verify cadence:** each slice = build (parallel agents) → commit → push (stash scripts/_fub-full-export.mjs
first, it's a recurring parallel-session dirty file) → Vercel deploy (~3min) → browser screenshot on
ryan-realty.com (Browser 2 = Matt's authed prod session, tab 1863250443) at ?date=this_year for data.
