# CRM Settings + Automation Machinery — Ground-Truth Audit

Auditor domain: `app/admin/(protected)/crm/settings/**` (17 pages + hub), `crm/automations`, `crm/workflows`, `crm/sequences` (+ `[id]/edit`), `crm/import/**`, `crm/calendar`, `crm/tasks`, `crm/approvals`, the settings/automation/task/calendar/subscription component trees, and the cron executors (`crm-sequence-engine`, `crm-auto-enroll`, `crm-scheduled-sends`, `crm-task-reminders`, `crm-market-report-send`, `crm-health-check`, `crm-bulk-worker` dispatch surface).

Method: every page read end-to-end (page.tsx → components → server actions → lib → Supabase → cron executors). Every claim below carries file + line evidence. Assumed broken until proven otherwise.

---

## Executive summary

The settings layer is **largely real**: stages, tags, custom fields, templates, suppression, block list, company settings, office hours, and market-report subscriptions all write tables that the rest of the CRM demonstrably consumes (pipeline, composers, sequence engine, Twilio webhooks, digest cron). This is NOT a Potemkin settings panel.

The **automation layer is half real**. The sequence engine cron is a robust, production-grade executor (suppression-gated, at-most-once send claims, A2P-aware, quiet hours, merge-token fail-closed). But the *authoring surface promises far more than the runtime delivers*:

1. **7 of 9 trigger types offered in two different UIs never fire anywhere** — `fireTrigger` has exactly one call site (stage change).
2. **Condition/branch nodes in the visual editor are executed incorrectly across cron ticks** — any branch with ≥2 steps silently skips its tail and jumps to the wrong step.
3. **Pond routing configured in Lead Flows silently assigns to Matt** — the sentinel is swallowed by `coerceBroker` at the only production call site, and `pond_id` is never set.
4. **Lead-flow conditional rules (price/area/tag) can never match** — the only caller passes `source` alone.
5. **Group "first to claim" distribution is silently round-robined** — the SQL function ignores `distribution_type`.
6. **The Team page's Export and Pause toggles write columns nothing reads** — decorative compliance/permission switches.

Naming chaos compounds it: `/admin/crm/automations` (redirect) → `/admin/crm/sequences` (titled "Automations", nav-labeled "Workflows") vs `/admin/crm/workflows` (titled "Enrollment board") vs "Sequences" in code. Four names, two surfaces, one engine.

---

## Runtime executor inventory (what actually runs)

| Cron | Schedule (vercel.json) | Real? | Evidence |
|---|---|---|---|
| `crm-sequence-engine` | every 15 min (`13,28,43,58 * * * *`) | **REAL** — executes email/sms/task/tag/change_stage/add_note/reassign/run_automation/stop_other_plans steps | `app/api/cron/crm-sequence-engine/route.ts` (618 lines) |
| `crm-auto-enroll` | every 15 min | **REAL** — sweep-enrolls new leads into 4 master sequences via `tag_added` rules + hardcoded fallback | `app/api/cron/crm-auto-enroll/route.ts:69-178`, `lib/crm/enroll.ts:26-31` |
| `crm-scheduled-sends` | every 5 min | **REAL** — claims due `crm_scheduled_sends` rows, enqueues into the bulk worker | `app/api/cron/crm-scheduled-sends/route.ts:74-110` |
| `crm-task-reminders` | daily 13:00 UTC | **REAL** — rolled-up due/overdue text per broker via `queueBrokerAlert` | `app/api/cron/crm-task-reminders/route.ts:65-124` |
| `crm-market-report-send` | 4×/day | **REAL** — cadence-aware per-subscription send, suppression chokepoint | `app/api/cron/crm-market-report-send/route.ts:52`, `lib/crm/market-report-send.ts` |
| `crm-health-check` | every 30 min | **REAL** — vitals → `evaluateHealthRules` → deduped broker pages | `app/api/cron/crm-health-check/route.ts` |
| `crm-bulk-worker` | every 2 min | (adjacent domain) drains `crm_bulk_jobs`, target of scheduled sends | referenced `lib/crm/bulk-jobs.ts` |

**Trigger dispatch runtime**: `lib/crm/trigger-dispatch.ts` (`fireTrigger`) handles `crm_automation_rules` rows AND `crm_sequences.triggers` jsonb. **It has exactly one caller in the entire codebase**: the stage-change action (`app/actions/crm.ts:1145`). Verified by exhaustive grep.

---

## CRITICAL / HIGH defects (cross-cutting)

### D1 — HIGH: 7 of 9 automation trigger types are dead config
- The Enrollment-rules manager offers 9 trigger types (`components/admin/crm/workflows/AutomationRulesManager.tsx:81-91`): tag_added, stage_changed, source_is, inactivity, deal_stage_changed, inquiry, property_saved, calendar_date, appointment.
- The sequence editor's Triggers tab offers 8 (`lib/crm/sequence-step-schema.ts:260-269`, rendered in `components/admin/crm/automations/StepConfigPanel.tsx:489`).
- Reality: `fireTrigger` is called only from the stage-update action (`app/actions/crm.ts:1143-1148`). `autoEnrollPerson` evaluates only `tag_added` rules, and only against tags present **at lead-creation time** (`lib/crm/enroll.ts:76-99`). No cron, webhook, or action fires `source_is`, `inactivity`, `deal_stage_changed`, `inquiry`, `property_saved`, `calendar_date`, or `appointment` (grep across `app/`, `lib/` — zero call sites).
- Consequence: a broker can configure "when a property is saved, enroll in X" or "inactive 30 days → task" and it will never run, with no warning. Even `tag_added` does not fire when a tag is added to an *existing* contact (person-card tag edit, bulk tag add, sequence `tag` step at `crm-sequence-engine/route.ts:477-482` — none dispatch triggers).
- The UI even admits it in fine print ("Only the tag-added to enroll-in-workflow path runs in the engine" — `AutomationRulesManager.tsx:361`, sequences page line 243-245) while still offering all 9 options.

### D2 — HIGH: condition branches execute the wrong steps across cron ticks
- The editor authors recursive condition nodes with multi-step `truePath`/`falsePath` (`lib/crm/sequence-step-schema.ts:155-162`; branch editing UI `components/admin/crm/automations/StepConfigPanel.tsx:606-611` with `BranchPathEditor` allowing N steps per branch).
- The engine materializes the chosen path **in memory only** ("the steps column stays authoritative" — `crm-sequence-engine/route.ts:164-178`), then persists `step_index` in *materialized* coordinates (`route.ts:585-601`).
- On the next tick the engine rebuilds `rawSteps` from the RAW tree and only re-splices when the node **at** `step_index` is a condition (`route.ts:166-167`). Walkthrough: steps `[s0, s1, COND{true:[a,b,c]}, s3]`, enrollment at index 2 → splice → executes `a`, stores `step_index=3`. Next tick: `rawSteps[3]` in raw coordinates is `s3` — **branch steps `b` and `c` never execute**, and `s3` fires with `b`'s delay. If the person's stage/tags changed between ticks, re-evaluation can shift indexes arbitrarily.
- Also: the enrollment board columns are built from RAW steps (`app/actions/crm.ts:1875-1881` — condition nodes label as "N. step") against materialized `step_index` values, so the kanban shows people in the wrong column for any branching workflow.

### D3 — HIGH: pond routing is dead at the only production call site
- `pickRoutedBroker` returns `POND_ROUTING_SENTINEL = '__pond__'` and expects the caller to pass `pondResult` and set `crm_people.pond_id` (`lib/crm/lead-routing.ts:41-55, 148-153`).
- The only lead-intake caller does neither: `lib/data/crm/ensureNativeLead.ts:209` — `coerceBroker(await pickRoutedBroker({ source: input.source }))`. `coerceBroker('__pond__')` → not in `CRM_BROKERS` → **DEFAULT_BROKER (Matt)** (`ensureNativeLead.ts:43-45`). `pondResult` is never passed.
- Consequence: a Lead Flow targeting a pond silently assigns every lead to Matt with `pond_id = null`. The Ponds settings page, `PondEditor`, `crm_ponds`/`crm_pond_members` tables, and `claimPondLeadAction` (`app/actions/crm-ponds.ts:116-165` — which itself has **zero UI callers**, grep-verified) form a complete feature with no working entry path. The people-list pond scope filter (`app/actions/crm.ts:218-222`) filters on a column that intake never populates.

### D4 — HIGH: lead-flow conditional rules can never match
- The Lead Flows editor builds price/area/tag conditions (`components/admin/crm/settings/LeadFlowEditor.tsx:87, 137-160`). The resolver evaluates them (`lib/crm/lead-flow-resolver.ts:38-74`) — price with null ctx returns `false`, area/tag against empty values effectively false.
- `ensureNativeLead.ts:209` passes only `{ source }` — no `price`, `area`, `tags` — so **every conditional rule evaluates against empty context**. Only unconditional rules (or the flow default) ever apply. The second caller (`lib/canonical-lead-tagger.ts:91`) also passes source only.

### D5 — MEDIUM-HIGH: "First to claim" group distribution is silently round-robin
- Groups can be configured `round_robin | first_to_claim` (`app/actions/crm-groups.ts:35`, `GroupEditor.tsx:126,253`).
- The routing engine unconditionally calls `crm_advance_group_round_robin` for any group target (`lib/crm/lead-routing.ts:136-146`), and the SQL function never reads `distribution_type` (`supabase/migrations/20260626100000_crm_groups.sql`, function body — rotates `crm_group_members` regardless). No claim queue exists for group-routed leads. The group RR also ignores `brokers.routing_eligible`/`crm_active` (unlike the global RR at `20260625211000_crm_assignment_config.sql:67`), so a group can rotate to a disabled broker.

### D6 — MEDIUM-HIGH: Team page toggles (`can_export`, `pause_leads`) write columns nothing consumes
- Toggles live at `app/admin/(protected)/crm/settings/team/page.tsx:99-106, 192-222`, writing `admin_roles.can_export` / `admin_roles.pause_leads` via `app/actions/admin-broker-permissions.ts`.
- Exhaustive grep: **zero consumers**. The CSV export route checks session + scope only (`app/api/admin/crm/export/route.ts:14-16, GET body` — never reads `can_export`). Lead routing (`lib/crm/lead-routing.ts`, both RR SQL functions) never reads `pause_leads`. Toggling "Paused" changes nothing about lead flow; toggling Export "No" blocks nothing.

### D7 — MEDIUM: CSV import dies silently on large files and cannot resume
- The whole import processes synchronously inside one POST with `maxDuration = 60` (`app/api/admin/crm-import/route.ts:23`) doing ≥3 serial DB round-trips per row (`route.ts:89-182`). A 10 MB file (limit at `app/actions/crm-import.ts:46`) is tens of thousands of rows — guaranteed to exceed 60s.
- On timeout the job stays `status='running'`; no cron resumes `crm_imports` (grep: only `crm-portal-lead-intake` touches the table, for its own rows). The status page polls every 2s forever (`app/admin/(protected)/crm/import/[id]/page.tsx:33-42`) with no timeout messaging. The claim RPC allows re-claim after 600s but nothing re-POSTs.
- Restart-from-zero: progress offset is not persisted (`cursor` holds only `csv_text`), so a re-claimed run reprocesses from row 0 — email-matched rows converge, but **rows without an email are re-inserted as duplicates** (insert path `route.ts:143-166`; dedup is email-only, `route.ts:92-101`; phone-only contacts always dup even on first run).
- Imported `stage` values are not validated against `crm_stages` (`route.ts:119,158`; `lib/crm/import.ts:127-170` maps raw strings) — a CSV with `stage=Hot Lead` writes an off-taxonomy stage that no pipeline column groups.

### D8 — MEDIUM: silent failures on approvals actions
- `/admin/crm/approvals` server-action forms swallow errors to `console.error` only (`approvals/page.tsx:20-47`). If approve/skip/dismiss fails (e.g. ownership check `app/actions/crm.ts:1507-1514`), the broker gets a page reload with the card still there and no explanation. Contrast the same actions on `/admin/crm/workflows`, which round-trip a `?boardError=` param (`workflows/page.tsx:23-56`) — two different error UX patterns for the same mutations.
- Same class: appointment-settings toggle/delete swallow errors entirely (`AppointmentSettingsClient.tsx:43-52` — only `onCreate` has a catch; a failed toggle silently reverts on refresh).

### D9 — MEDIUM: duplicate/competing surfaces for the same jobs (full list in Duplication section)

### D10 — LOW-MEDIUM: `getWorkflowAnalytics` N+1 + rename-fragile engagement
- Per-sequence serial `email_events` count with `LIKE 'seq:<name>:%'` (`lib/data/crm/getWorkflowAnalytics.ts:211-226`) — one query per sequence per cache-miss, and engagement is keyed on the sequence **name**, so renaming a workflow orphans all historical engaged counts (send path stamps `emailKey: seq:${seq.name}:${step}` — `crm-sequence-engine/route.ts:297`).

### D11 — LOW: sequences visible to restricted brokers, every mutation superuser-only
- `/admin/crm/sequences` renders the full builder for any CRM role (`sequences/page.tsx:148-149`), but every action behind it is `requireSuperuser` (`app/actions/crm-sequences.ts:114-466`). A restricted broker gets a fully interactive surface where every Save/Create errors "Superuser only".

---

## Page-by-page record

### 1. `/admin/crm/settings` (hub) — `settings/page.tsx` (333 lines)
- **Purpose**: superuser-only catalog of 17 setting panels with live counts, grouped Customize / Follow Up / Lead Distribution / Account / Compliance.
- **Data path**: 10 parallel DAL reads on every request (`page.tsx:47-59`), `force-dynamic`. Each reader is cached (`unstable_cache` tags), so cost is bounded; still 10 fetches to paint a menu.
- **Mutations**: none (links only).
- **Defects**: two cards for broker management ("Team", "Brokers") and two for routing ("Lead Flows", "Lead routing") with overlapping claims; description text asserts things that are false downstream (e.g. Ponds card sells a feature that D3 kills). Copy "The live default routes every lead to Matt" is accurate.
- **Mobile**: responsive card grid, fine.
- **Verdict**: works as a menu; IA duplication.

### 2. `/settings/stages` — REAL and consumed
- CRUD via `makeConfigTable('crm_stages')` factory (`app/actions/crm-stages.ts:24-27`); mutations superuser-gated in the factory (`lib/crm/config-table.ts:125-133`); delete reassigns every `crm_people.stage` first and aborts on failure (`crm-stages.ts:83-120`).
- **Consumed by**: people list pipeline (`app/admin/(protected)/crm/page.tsx` imports `getCrmStages`), sequence editor stage pickers, engine `change_stage` steps. Stages defined here genuinely drive the pipeline.
- Caveat: `deleteCrmStageAction` re-checks superuser explicitly; create/rename rely on factory guard — consistent.
- Note: the engine's `change_stage` step and the import wizard write `crm_people.stage` **without** validating against `crm_stages` (engine takes `step.value` as-is, `route.ts:486-494`), and the stage-change *action* validates against a hardcoded `CRM_STAGES` const (`app/actions/crm.ts:1127`) — not the table. So the "settings drive the pipeline" story has a fork: UI stage-change validates against a **constant**, settings CRUD edits a **table**. A stage added in settings may not pass the `CRM_STAGES` const check in `updatePersonStageAction`. (Evidence: `crm.ts:1127` `if (!(CRM_STAGES as readonly string[]).includes(stage))`.)
- **Verdict**: works; taxonomy source-of-truth is split between table and constant — real drift hazard.

### 3. `/settings/tags` — REAL and consumed
- Rename rewrites `crm_people.tags` across every carrier before touching taxonomy (`app/actions/crm-tags.ts:175-229`); merge rewrites then deletes (`231-257`); protected compliance tags refuse.
- Usage counts merged from `getCrmTags` (page lines 27-38). Consumed by people list filters, sequence tag steps, enrollment rules.
- **Verdict**: works.

### 4. `/settings/custom-fields` — REAL and consumed
- CRUD `crm_field_definitions` (`app/actions/crm-field-definitions.ts`); consumed by contact card Details (`components/admin/crm/CustomFieldsPanel.tsx`), person page, templates merge-field pickers (`settings/templates/page.tsx:161-163`).
- **Verdict**: works.

### 5. `/settings/templates` — REAL and consumed; the strongest settings page
- Two-level folder UI over `crm_templates` (`templates/page.tsx:105-140`), channel tabs via `?t=`, search, per-broker visibility scoping at the data edge (lines 98-100). Modals: rich-text email editor, SMS editor, merge-field inserter with real merge context (`buildMergeContext`, line 89), self-test send through the REAL send paths (`app/actions/crm-template-test.ts:84-119` uses `sendCrmEmail`/`sendSms`).
- **Consumed by**: composer TemplatePicker, sequence engine (`loadTemplate`, `crm-sequence-engine/route.ts:96-103`), bulk email cohorts (`lib/crm/bulk-handlers/email-cohort.ts`), inbox. Templates genuinely feed the machine.
- "Used by Automations" folder counts `usage > 0` from `lib/crm/templateReferences.ts` — real reference counting.
- Access asymmetry: this page allows any CRM broker while the hub linking to it is superuser-only; nav exposes "Templates" directly (`app/components/admin/admin-nav.ts:184`).
- **Verdict**: works.

### 6. `/settings/segments` (newsletter) — REAL
- ConfigTable CRUD on newsletter segments with reassign-on-delete. Linked from the People sidebar (`PeopleSidebar.tsx:141`). Consumed by newsletter machinery (adjacent domain).
- **Verdict**: works (consumption verified only to the sidebar + actions; newsletter cron is another auditor's domain).

### 7. `/settings/areas` (market-report areas) — REAL
- ConfigTable CRUD with `scrub` delete mode (strips slug from every subscription). Consumed by `crm_report_subscriptions.areas` and the send cron's data pull.
- **Verdict**: works.

### 8. `/settings/lead-flows` — UI real, executor partially dead
- Full CRUD editor (`LeadFlowEditor.tsx`, 525 lines): per-source flow, default target broker/group/pond, ordered conditional rules.
- Executor: `pickRoutedBroker` step 1 (`lib/crm/lead-routing.ts:120-160`) — **broker targets work; group targets round-robin (even when "first to claim"); pond targets are swallowed (D3); conditions never match (D4)**.
- Wired into every LP/webhook intake via `ensureNativeLead` (20+ call sites: `app/lp/*/actions.ts`, `app/api/meta/lead-webhook`, etc.).
- **Verdict**: partial — source→broker mapping works end-to-end; everything else on this page is decorative.

### 9. `/settings/groups` — UI real; executor ignores half the config (D5)
### 10. `/settings/ponds` — UI real; feature dead end-to-end (D3; claim action has no UI caller)

### 11. `/settings/assignment` (Lead routing) — REAL
- Strategy (`all_to_one`/`round_robin`/`by_source`) + default broker + per-source rules in `crm_assignment_config`; executor is step 2 of `pickRoutedBroker` (`lead-routing.ts:162-176`) with atomic RR RPC honoring `routing_eligible`. Fail-safe to 'matt' everywhere.
- Overlap: by_source rules here vs Lead Flows per-source flows — **two systems that both map source→broker**, evaluated flows-first (`lead-routing.ts:120`). A broker must understand both pages to predict routing.
- **Verdict**: works; duplicated concept.

### 12. `/settings/brokers` — REAL
- Toggles `brokers.crm_active` + `brokers.routing_eligible` via owner-guarded actions. `routing_eligible` IS consumed by the global RR SQL (`20260625211000:67`); `crm_active` gates pickers (calendar/tasks/sequences filter on `b.crmActive`). Plain server-action forms — full page reload per toggle, no pending state.
- **Verdict**: works; crude UX.

### 13. `/settings/team` — half real
- The single `admin_roles` surface: add/change/remove roles (real — reuses `upsertAdminRole`/`removeAdminRole`), last-seen display, read-only mirrors of broker flags.
- **Defects**: D6 (dead toggles); raw `createServiceClient().from()` inside a page.tsx (`team/page.tsx:44-56`) violating the repo's own DAL boundary; broker identity editing punted to a third surface (`/admin/brokers/edit`). Managing one teammate spans 3 pages (Team → Brokers → broker profile).
- **Verdict**: partial.

### 14. `/settings/company` — REAL, best-consumed settings page
- Form writes `crm_company_settings` (`app/actions/crm-company-settings.ts:34-96`); office hours enforced live by the Twilio voice webhook (`app/api/twilio/voice/route.ts:189`); recording master switch enforced in voice routes; weekly report recipients consumed by the Monday digest (`app/api/cron/weekly-pipeline-digest/route.ts:120-124`); A2P badge is live Twilio status. Client form has proper pending/saved/error states (`CompanySettingsForm.tsx:119-121, 456-469`).
- **Verdict**: works.

### 15. `/settings/company/block-list` — REAL and enforced
- `crm_blocked_numbers` add/remove (`app/actions/crm-block.ts:20-47`); enforced uncached at all three Twilio inbound webhooks (`inbound-sms/route.ts:82-83`, `voice/route.ts:82`, `conversations-events/route.ts:83-84`). Email blocking correctly delegated to suppressions instead of a second store.
- **Verdict**: works.

### 16. `/settings/company/registration` — REAL (read-only status page)
- Live A2P campaign status + registered lines from `getBrokerTelephony`. Same status object gates the composer and engine SMS sends (`crm-sequence-engine/route.ts:75, 389`).
- **Verdict**: works.

### 17. `/settings/suppression` — REAL and enforced (the compliance spine)
- Add/lift with audit + owner-only compliance lifts (`app/actions/crm-suppressions.ts`); server-side channel/q filtering. `isSuppressed` is checked at 25+ send boundaries including the sequence engine email (`route.ts:198`) and SMS (`route.ts:312`) paths, bulk sends, CMA delivery, market-report send, expired outreach.
- **Verdict**: works.

### 18. `/settings/appointments` — REAL, minor UX gaps
- CRUD `appointment types/outcomes` lookup tables; consumed by the calendar's AppointmentModal (types/outcomes passed from `getAppointmentTypes/Outcomes`, `calendar/page.tsx:209-217`). Toggle/delete errors swallowed (D8-class).
- **Verdict**: works.

### 19. `/settings/market-reports` — REAL, read-only duplicate
- Roster of `crm_report_subscriptions` with per-subscriber preview dialog (verification-trace preview via `crm-market-report-preview.ts`). Send executor real (cron above).
- **Duplication**: the same subscriptions are fully manageable in `/admin/crm/subscriptions` (Reports tab, edit/assign/pause with `ReportEditDialog` + `criteria/ReportCriteriaEditor`). This page can only look; that page can act. Two surfaces, one table.
- Also gate mismatch: this page allows any broker (scoped) though it lives under the superuser-only hub.
- **Verdict**: works; redundant.

### 20. `/admin/crm/automations` — pure redirect to `/sequences` (`automations/page.tsx:18`). Route exists solely for FUB-parity URLs.

### 21. `/admin/crm/sequences` — the builder list. REAL UI, real list, real folders, real analytics (with caveats)
- 6 parallel fetches incl. `getWorkflowAnalytics` (N+1 inside, D10). 704-line `AutomationsListView` island (folders, 10-col table, create/duplicate/archive/delete). Delete semantics careful: refuses master workflows and live enrollments, fail-closed (`crm-sequences.ts:231-270`).
- Enrollment-rules manager beneath (D1 applies).
- **Verdict**: partial — authoring works; the trigger半 of what it advertises does not run.

### 22. `/admin/crm/sequences/[id]/edit` — the visual editor. REAL authoring, broken semantics at the edges
- Canvas + palette + step config; saves validate through `parseSteps` and check `templateKey` existence (`crm-sequences.ts:69-78, 351`). Funnel column from real per-step analytics.
- Conditions (D2), triggers (D1) as above. `stop_on_reply`, `confirm` (broker-gated steps), SMS email-fallback all real in the engine.
- **Verdict**: partial.

### 23. `/admin/crm/workflows` — enrollment board. REAL
- Kanban of live enrollments per active sequence; approve/pause/resume/advance/stop wired to `setEnrollment` with per-lead ownership checks (`crm.ts:1497-1522`). Errors surface via `?boardError` param. Mobile: stacked cards (good).
- **Defects**: step columns misplace enrollments in branching workflows (D2 tail); duplicated approve surface vs `/approvals`; "Run next now" and board labels built from raw channel strings.
- **Verdict**: works for linear sequences.

### 24. `/admin/crm/approvals` — first-touch queue. REAL, silent-failure UX
- `getAwaitingApprovals` + approve/edit/skip/dismiss; approve sets `first_touch_override` which the engine honors at step 0 (`crm-sequence-engine/route.ts:338-340`). CMA-hold awareness. In the nav ("Today" group, `admin-nav.ts:48`).
- Defect D8 (no error feedback). Overlaps the workflows board's awaiting_broker column.
- **Verdict**: works.

### 25. `/admin/crm/import/**` — wizard. Works for small clean files; D7 for real ones
- Upload (client-side parse → `createImportJobAction`, CSV stored in `crm_imports.cursor.csv_text`) → map (re-parses stored CSV; auto-mapping via header synonyms `lib/crm/import.ts:127`) → preview (first 10 + in-file dup warnings) → run (POST, TOCTOU-safe claim RPC `crm_claim_import`) → status page (2s poll, progress bar).
- End-to-end verified for the happy path: rows land in `crm_people` + `crm_contact_points`, email-matched updates merge tags and never blank fields (`api/admin/crm-import/route.ts:104-142`).
- Gaps: D7 (timeout/no-resume/dup-on-retry/phone-dedup-missing/stage-unvalidated). Also imports skip lead routing and auto-enroll entirely (no `assigned_broker` mapping — imported contacts are unassigned; intentional for outreach lists but not surfaced in UI).
- **Verdict**: partial.

### 26. `/admin/crm/tasks` — REAL, feature-complete for daily broker use
- `getTaskQueue` views (today/overdue/upcoming/completed) with broker scoping at the data layer, counts, snooze/reassign/edit/delete/bulk-complete/clear-overdue, contact search on create. Reminder cron real (task-reminders). Consumed origin: engine `task` steps insert `crm_tasks` (`crm-sequence-engine/route.ts:470-476`).
- **Mobile**: total fork — `TasksView` (desktop) vs `MobileTasksScreen` (separate tree), both always server-rendered, mobile mounted via negative-margin hack `-mx-7 -mt-9` to defeat shell padding (`tasks/page.tsx:198`). Feature parity between forks not guaranteed by any gate.
- **Verdict**: works.

### 27. `/admin/crm/calendar` — REAL
- Day/week/month grids, appointments (wall-clock-as-UTC convention), open tasks, deal closings; guest chips resolved in one read. Types/outcomes from settings. Create/edit/delete appointments with suppression-checked... (appointments actions include `isSuppressed` reference for invites).
- **Costs**: 7 parallel fetches per request; `getCalendarContactOptions()` fetched even on desktop where unused (`calendar/page.tsx:215`); desktop + mobile trees BOTH server-rendered on every hit; mobile is again a separate component universe (`MobileCalendarScreen`) with the same negative-margin hack (line 307).
- Timezone: appointments "wall-clock stored as UTC" vs tasks true-instant LA — two time systems on one grid, documented but fragile (`calendar/page.tsx:15-18`).
- **Verdict**: works.

### 28. `/admin/crm/subscriptions` (components in-domain) — REAL hub
- Alerts (guest+user `listing_alerts`), report subscriptions, delivery tab; first page server-fetched, client refetch actions. Criteria editors (`components/admin/crm/criteria/*`) power the edit dialogs.
- Duplicates `/settings/market-reports` (see §19) and the person-card `ReportSubscriptionsPanel`.
- **Verdict**: works.

---

## Duplication map

| What | Surfaces | Evidence |
|---|---|---|
| Source→broker routing config | `/settings/assignment` (by_source rules) AND `/settings/lead-flows` (per-source flows) | `lead-routing.ts:120-176` evaluates both |
| Broker management | `/settings/team` + `/settings/brokers` + `/admin/brokers/edit` (3 pages for one roster) | `team/page.tsx:35-37, 250-259` |
| Market-report subscriber management | `/settings/market-reports` (read-only) vs `/admin/crm/subscriptions` Reports tab (full CRUD) vs person-card panel | subscriptions/page.tsx, settings/market-reports/page.tsx |
| Enrollment approval | `/admin/crm/approvals` (with preview/edit) vs `/admin/crm/workflows` board Approve button (no preview) | approvals/page.tsx:133-145, workflows/page.tsx:137-156 |
| Automation naming | `/automations` (redirect) vs `/sequences` (title "Automations", nav label "Workflows") vs `/workflows` ("Enrollment board") | automations/page.tsx, sequences/page.tsx:41, workflows/page.tsx:205, admin-nav.ts:185 |
| Stage taxonomy | `crm_stages` table (settings CRUD) vs hardcoded `CRM_STAGES` const validated in `updatePersonStageAction` | `crm.ts:1127` vs `crm-stages.ts` |
| Error-feedback patterns for identical actions | workflows (`?boardError`) vs approvals (console.error only) | cited above |

## Mobile divergence

- Tasks and Calendar each ship two complete component trees (desktop + `mobile/`), both rendered server-side on every request, mobile branch positioned with negative-margin hacks (`tasks/page.tsx:198`, `calendar/page.tsx:307`).
- The 5-tab mobile bottom bar covers Home/Inbox/People/Deals/Activity only (`components/console/CrmMobileTabBar.tsx:30-36`); Calendar, Tasks, Approvals, Workflows, Settings, Import are hamburger-menu-only on phones, and the tab bar deliberately lights nothing while on Calendar/Tasks (line 44).
- Settings pages themselves are desktop tables squeezed by `overflow-x-auto`; Team/Brokers/Import tables hide most columns below `md` (e.g. import history hides Rows/Imported/Skipped/Errors — `import/page.tsx:69-76` — leaving mobile users only Started/Status).
- The workflows kanban degrades to stacked cards on mobile (good); the sequences editor canvas has no mobile adaptation (704 + 832-line islands, desktop-geometry).

## Performance notes

- Every page in the domain is `force-dynamic`; the hub fires 10 reads, sequences 6, calendar 7 (+1 unused-on-desktop), tasks up to 2 serial `getTaskQueue` calls when defaulting from overdue→today (`tasks/page.tsx:83-87`).
- `getWorkflowAnalytics` N+1 per sequence on cache miss (D10).
- Sequence engine batches 50, per-run template cache, single person read per enrollment, cron lease against overlap — well optimized (`crm-sequence-engine/route.ts:37, 49-55, 94-103, 145-153`).
- Import: serial row-by-row DB writes, ~3 queries/row (D7).

## Dead / orphaned inventory

- `claimPondLeadAction` (`app/actions/crm-ponds.ts:116+`) — no UI caller.
- Pond routing pipeline end-to-end (D3) — table, editor, sentinel, claim action all present; no working path.
- 7 trigger types in 2 UIs (D1) — config rows will persist and never fire.
- `admin_roles.can_export`, `admin_roles.pause_leads` — written, never read (D6).
- `crm_groups.distribution_type='first_to_claim'` — stored, ignored (D5).
- `skippedSms` counter in the engine is a hardcoded 0 reserved variable (`route.ts:70`).
- `/admin/crm/automations` route — permanent redirect only (intentional alias).

## What provably works end-to-end (for the rebuild's keep-list)

- Sequence engine execution semantics for LINEAR sequences: suppression fail-closed, at-most-once claims (`crm_sequence_sends` unique), archived-template guard, CMA-link hold, unresolved-merge-token fail-closed, quiet hours/send windows, A2P queue-visible fallback, per-broker Twilio caller ID, SMS daily cap, sibling-person duplicate-email guard.
- Auto-enroll sweep + instant broker alert with batch pre-filters and outreach-list exclusions.
- Templates system (authoring → composer → engine → bulk → analytics usage counts).
- Suppression + block list enforcement chains.
- Company settings → Twilio office hours/recording, weekly digest recipients.
- Stage/tag taxonomy CRUD with people-rewrite semantics.
- Tasks module + reminder cron; calendar module; scheduled sends → bulk worker.
- Market-report subscription→send loop with cadence gating.
