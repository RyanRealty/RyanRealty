# CRM Completion Spec — to Follow Up Boss parity (2026-06-25)

**Status:** live build spec. **Readiness at audit: 26/100.** 113 features across 12 domains
(DONE 1 · PARTIAL 43 · MISSING 69). Derived from a live FUB API parity pull + an 8-area admin audit +
a 12-domain feature spec (workflows wf_a361e730-df2 + wf_e30c6e1f-10f). Bar: a CRM Matt can fully operate,
**everything configurable in the admin UI** (add/edit/delete/assign/bulk from the UI, never code or SQL).

FUB is decommissioned (sendEvent native, getFubApiKey()→undefined). The execution spine works (suppression
chokepoint, sequence engine, send rails, scope RBAC); the authoring / management / configurability surfaces
are what's missing.

## The five cross-cutting foundations (build first — ~70% of features become thin UI once these exist)

1. **Filter-AST resolver** — `lib/crm/segment-ast.ts` + `buildCrmPeopleQuery`: one `compileSegment(ast, brokerScope)`
   that turns a filter tree into a Supabase query + count, applies `scopeBroker` INSIDE the builder (no caller
   can widen past their book), baselines `deleted=false`, removes the 200-id contact-point cap. Extracted from
   the inline logic in `listCrmPeople` (crm.ts:158-208). The list, count badge, bulk mutations, audience picker,
   and saved-view counts must all re-derive the SAME id set or "what you see" diverges from "what you act on".
2. **Bulk-job framework** — `crm_bulk_jobs` table + chunked resumable worker cron + `BulkResult` shape. Durable
   job row (kind, selection-snapshot-or-AST, params, actor, FROZEN scope, processed/skipped/breakdown, status),
   SELECT-FOR-UPDATE-SKIP-LOCKED worker draining ~250/chunk. Required for any action >~500 rows at 18K scale.
3. **Unified `email_events` store** — one normalized row per lifecycle event across BOTH Gmail + Resend rails;
   dual-rail send instrumentation + ingestion; `dedupe_key` unique (idempotent under webhook replay). Single
   source of truth for every email/comms report; kills the permanently-zero `email_campaigns` stats.
4. **Settings/config-table pattern** — one reusable shape (key + label + position + is_active + is_protected),
   one CRUD action group (requireCrmAccess + owner-only), one settings sub-page (Table+Dialog+drag-reorder),
   usage-count + safe-delete-with-reassign. Replicated ~12× (stages, tags, templates, suppression, brokers,
   segments, areas, task-types, call-outcomes, appt-types/outcomes, pipelines/stages, automations).
5. **Custom-field registry** — `crm_field_definitions` over the existing `crm_people.custom` jsonb (no per-field
   columns); typed render/edit on the card; custom fields as filterable AST conditions. 49 live keys / 64 FUB.

## Sequenced backlog (dependency-ordered)

- **P1 — The five foundations.** filter resolver, AST schema+evaluator, crm_bulk_jobs + worker, email_events +
  recordEmailEvent, settings shell + config-table pattern (one reference table), crm_field_definitions + seed.
- **P2 — Configurability layer.** stages, tags taxonomy, email+SMS template CRUD, brokers-from-table (kill
  CRM_BROKERS const), newsletter segments + market-report areas + task types, suppression list admin.
- **P3 — Bulk operations engine.** selection model (row checkboxes + select-all-matching, break the 50 cap),
  bulk assign-broker / add-tag / remove-tag / set-stage, confirm + suppression pre-flight, migrate the 2 legacy
  bulk actions, suppression-gate CI parity (fix admin-email.ts ungated send).
- **P4 — Saved views / smart lists.** visual AST builder + view CRUD/share, port the 12 FUB smart lists as
  seeded protected views, audience bus (resolveSendableAudience), custom-field render + filter + normalization.
- **P5 — Email campaign engine + comms reporting.** compose→send to a cohort (suppression re-check, CAN-SPAM/
  RFC-8058, scheduled, from-identity, template picker, pre-send preview); dual-rail instrumentation + ingestion;
  fix false-zero campaign stats; reports hub (sent-log + per-send/broker/contact/template/campaign engagement).
- **P6 — Workflow authoring.** typed Step schema + Zod, lifecycle CRUD, drag-reorder step builder, branching
  conditions, enroll/stop settings, UI-configurable triggers/automations, bulk enroll, per-workflow analytics.
- **P7 — Lead routing.** assignment_rules config (all-to-one | round-robin | by-source | capacity), atomic
  round-robin pointer, wire pickBroker/ensureNativeLead/inbound-phone, pond + claim + bulk reassign + ledger.
- **P8 — Inbox / conversations.** conversation entity over crm_timeline + state, interactive triage queue +
  unread badges, inline reply (reuse the send chokepoint), bulk conversation actions.
- **P9 — Tasks / appointments / calendar / notifications.** task full lifecycle + queue + reminders cron + bulk;
  call outcome tagging + calls report; appointments + types/outcomes; Google Calendar two-way (BLOCKED on scope);
  notifications + per-broker preferences UI.
- **P10 — Market reports product + deal pipeline + Vault handoff.** report-definition catalog + bulk subscribe +
  send engine/cron (suppression+consent gated) + delivery analytics; deal model + kanban CRUD + pipeline config;
  CRM-deal → Vault/TC one-way handoff boundary.

## LOCKED SCOPE (Matt sign-off 2026-06-25) — core CRM, not FUB parity

Bar: **core features that are useful and 100% bulletproof**, reconciled against the screen-by-screen
`docs/fub-feature-audit/FUB_FEATURE_AUDIT.md` (the authoritative WHAT). This doc is the HOW.

**Decisions locked:**
1. **Lead routing = all-to-Matt, engine dormant.** Build the routing engine (assignment_rules); ship with
   `strategy=all_to_one(matt)`. Round-robin / by-source are switchable later with NO deploy.
2. **Deals = DEFERRED to Vault/TC.** The CRM only flags buyer/seller intent (stage + tag). No in-CRM kanban /
   commissions for v1 — Vault/TC owns the transaction. Clean one-way boundary.
3. **Pulled back in: none.** Calendar/appointments, Files-on-contacts, branching automations, Agent Goals stay
   OUT of v1.

**CUT / DEFERRED (explicit, with rationale):** Ponds (big-team feature; 3 brokers don't claim) · Files (docs
live in SkySlope/Vault/Drive) · Collaborators + @mentions (3-person team) · Branching automation conditions
(linear covers ~90%) · Agent Goals · vCard / hot-sheet / Power-Up flag UI · Import wizard (already migrated) ·
Calendar/appointments native object (lean on Google Calendar) · Block List (folded into the suppression list) ·
IDX marketplace / Pixel (we have first-party tracking) · deal custom fields. None block go-live.

**Bulletproof bar — every feature clears all of these:** (1) suppression chokepoint on every contact/send path,
CI-enforced; (2) scale to 18K via the chunked job worker, never inline; (3) RBAC scope applied inside the query
builder; (4) idempotent writes + fail-closed compliance; (5) unit-tested pure paths; (6) no misleading/no-op
surfaces.

## END-TO-END GOAL + wave plan (execution)

GOAL: ship the locked-scope CRM, production-ready — architecture, implementation, tests, review all meeting the
bulletproof bar, validated on the real end-to-end path. Built in dependency-ordered waves; each wave ships
working + tested + committed before the next.

- **Wave 1 — Foundations (mostly new files, parallelizable):** filter-AST resolver + `buildCrmPeopleQuery`;
  `crm_bulk_jobs` + chunked worker + BulkResult; `email_events` + `recordEmailEvent`; config-table pattern +
  `crm_stages` reference table; `crm_field_definitions` + seed; suppression-send CI gate.
- **Wave 2 — Configurability:** stages/tags/templates/segments/areas/brokers config UIs + suppression-list
  admin (each a config-table copy); brokers-from-table (kill CRM_BROKERS const).
- **Wave 3 — Bulk ops:** selection model (select-all-matching) + bulk assign/tag/stage/enroll/email/export,
  suppression pre-flight; migrate the 2 legacy bulk actions.
- **Wave 4 — Saved views / smart lists:** AST builder UI + view CRUD/share + seed the FUB lists + audience bus;
  custom-field render+filter.
- **Wave 5 — Email engine + comms reporting:** cohort send + templates + scheduling; dual-rail event ingestion;
  fix false-zero campaign stats; reports hub.
- **Wave 6 — Workflow authoring:** linear step builder + lifecycle CRUD + trigger/automation engine + bulk enroll.
- **Wave 7 — Lead Flow / routing (dormant) + inbox triage + tasks lifecycle.**
- **Wave 8 — Market-report send engine.**
- **Wave 9 — Final review + end-to-end validation + go-live checklist.**

Progress tracked in the task list + per-wave commit log appended below.

## Wave progress log

All 8 build waves shipped to `main`, each: built via parallel agents → integrated serially → migrations
applied to hosted Supabase → tsc + full `ci:gates` green → committed + pushed. 2143 tests pass.

- ✅ **Wave 1 — Foundations** (`efe7e3e1`): filter-AST resolver, bulk-job framework + worker, `email_events`,
  config-table pattern + `crm_stages`, custom-field registry, suppression-send CI gate.
- ✅ **Wave 2 — Configurability** (`c4c5c716`): tags/templates/segments/areas/suppression/brokers + `/admin/crm/settings`.
- ✅ **Wave 3 — Bulk operations** (`9c8b044b`): select-all-matching + bulk assign/tag/stage/enroll/report/email-cohort, suppression-safe, 18K-scale.
- ✅ **Wave 4 — Saved views** (`c4c8d8d8`): `crm_saved_views` + 18 smart lists + audience bus + record-card custom fields.
- ✅ **Wave 5 — Email engine + reporting** (`ac9a34bd`): sent log + honest rates, false-zero campaign fix, dual-rail `email_events`, compose-cohort + scheduled sends.
- ✅ **Wave 6 — Workflow authoring** (`ddc9a173`): step schema + lifecycle CRUD + step builder + UI triggers + analytics.
- ✅ **Wave 7 — Routing / inbox / tasks** (`626b4f2f`): dormant routing engine, inbox triage + inline reply, task lifecycle.
- ✅ **Wave 8 — Market-report engine** (`403233d7`): §0 cache-sourced renderer + cadence send engine.
- ⏳ **Wave 9 — Final review + validation**: adversarial review running; then authenticated browser walkthrough
  (needs `claude --chrome` restart) + go-live checklist.
