# Spec 09 — Settings & the Automation Engine

> End-to-end feature specification for the **one Settings home** and the
> **automation engine** beneath it (sequences / workflows / triggers / lead
> routing / CSV import), plus the two daily-driver operational surfaces the audit
> filed under this domain (**Tasks**, **Calendar**) and the **first-touch
> Approvals** queue. Derived from `00-REASONING-AND-ARCHITECTURE.md` (the locked
> architecture) and `audit-reports/crm-settings-automation.md` (the evidence
> base). Every architectural claim ties to a root cause (RC1–RC7) and a
> constraint (C1–C5). A senior engineer should be able to build this with no
> further questions.

**Area:** Settings home · automation authoring + engine · lead routing · triggers · CSV import · Tasks · Calendar · Approvals · broker identity
**Kills:** RC4 (accretion — 4 automation names / 3 broker-mgmt pages / 2 routing pages / 2 market-report surfaces collapse to one each), RC5 (nav ≠ access; scattered guards), **RC6 in full** (7 dead triggers, the condition step-index lie, dead pond routing, never-matching lead-flow conditions, silent group RR, dead Team toggles — every placebo in this domain either becomes real or is removed), RC3 for Tasks + Calendar (forked mobile trees).
**Serves:** C1 (right-size a 3-broker shop — one settings home, no enterprise sprawl), C4 (routing/enrollment numbers are compliance artifacts — a configured automation either fires or is not offered), C5 (send-integrity of the sequence engine is preserved, not touched).
**Depends on Spec 01 (Foundation):** `requireAdmin(capability)` in-body guard (§4.4), the nav-from-capability-map generator (§4.4), the optimistic/idempotent mutation primitive (§4.2), the single responsive shell + container-query tree (§4.3), the cached-DAL + streaming render pattern (§4.6). This spec **consumes** those primitives; it does not re-define them.
**Cross-spec seams:** Spec 02 (Inbox/Conversations — deletes `getGroupReplyParticipants`/`BROKER_LINES`, which this spec's broker-registry consolidation also targets), Spec 03 (Person workspace — the send-path host; automations write into it), Spec 05 (Transactions/TC — owns the `deal_stage_changed` writer), Spec 08 (Consumer funnel — owns the `property_saved` writer), the TODAY surface (shell-ia — aggregates Approvals + tasks-due).

---

## 0. The job this serves

Two jobs, one owner.

**Job A — configure the shop once, correctly, in one place.** Matt (superuser)
sets up stages, tags, templates, who-gets-which-lead, and which automation runs
when. Today that is scattered across a 17-panel hub plus three broker pages plus
an automation surface that exists under **four names** (`/automations` redirect →
`/sequences` titled "Automations", nav-labeled "Workflows" vs `/workflows`
titled "Enrollment board", `crm-settings-automation.md §22:238`). Worse, the
authoring surface **lies**: a broker can configure "when a property is saved,
enroll in X" and it will silently never fire (`§D1`), configure a branching
workflow that executes the wrong steps (`§D2`), route a Lead Flow to a pond and
have every lead silently land on Matt (`§D3`), or flip a broker to "Paused" and
change nothing about lead flow (`§D6`). The job is: **one settings home where
every switch you flip does exactly what it says, or is not offered.**

**Job B — the two daily surfaces a broker actually lives in** (Tasks, Calendar)
work identically on the phone and the desktop. Today each ships **two complete
component trees** (`TasksView`/`MobileTasksScreen`, `CalendarView`/
`MobileCalendarScreen`), both server-rendered every request, the mobile branch
positioned with a negative-margin hack (`tasks/page.tsx:198`,
`calendar/page.tsx:307`) — RC3 verbatim, in this domain.

Both jobs feed the core loop (C2): routing decides **who gets notified**,
automations decide **what auto-response fires**, tasks + calendar track **the deal
to close**. The engine that does the sending is production-grade and **stays**
(arch §3). This spec fixes the **authoring truth** around it and the **surfaces**
on top of it — nothing in the send/claim/suppression core is rewritten.

---

## 1. Keep / Rebuild / Delete (explicit, cited)

### 1.1 KEEP — the wired settings + the compliance-hardened engine (do not touch internals)

The audit is explicit: this is **not a Potemkin settings panel**
(`§Executive summary`). The following write tables the rest of the CRM
demonstrably consumes; the rebuild **re-homes** them into one Settings tree and
gives them the optimistic/idempotent mutation semantics, but does **not** change
what they store or who reads them.

| Kept asset | Evidence it works end-to-end | Role in rebuild |
|---|---|---|
| **Sequence-engine cron** (at-most-once claims, suppression fail-closed, A2P-aware, quiet hours, CMA-link hold, unresolved-merge-token fail-closed, sibling-dup guard, SMS daily cap) | `§Runtime executor inventory`; `app/api/cron/crm-sequence-engine/route.ts` (618 lines); `§What provably works` | **Executor unchanged.** Only its condition-cursor read model changes (§8, a bug fix, not a rewrite) |
| `crm-auto-enroll` cron (tag→sequence sweep + instant broker alert, epoch guard, outreach-list exclusion, hard-stop fail-closed) | `crm-auto-enroll/route.ts:69-178`; `lib/crm/enroll.ts:39-160` | Kept; its evaluator extended to also match `source_is` rules (§7) |
| `crm-scheduled-sends`, `crm-task-reminders`, `crm-market-report-send`, `crm-health-check`, `crm-bulk-worker` | `§Runtime executor inventory` | Unchanged executors |
| Stages CRUD (`crm_stages`, reassign-on-delete) | `§2`; `app/actions/crm-stages.ts:83-120` | Kept; **taxonomy fork fixed** — the `CRM_STAGES` const validator is deleted (§6.2) |
| Tags CRUD (rewrite-across-carriers rename/merge, protected compliance tags) | `§3`; `app/actions/crm-tags.ts:175-257` | Kept as-is |
| Custom fields (`crm_field_definitions`) | `§4` | Kept as-is |
| Templates (folders, channel tabs, merge-field inserter, self-test through real send paths, reference counting) | `§5`; `app/actions/crm-template-test.ts:84-119` | Kept as-is — "the strongest settings page" |
| Newsletter segments, market-report areas (ConfigTable + reassign/scrub-on-delete) | `§6`, `§7` | Kept as-is |
| Suppression (add/lift + audit, owner-only compliance lift, checked at 25+ send boundaries) | `§17`; `app/actions/crm-suppressions.ts` | Kept — the compliance spine, untouched |
| Block list (`crm_blocked_numbers`, enforced uncached at 3 Twilio inbound webhooks) | `§15` | Kept as-is |
| Company settings (office hours enforced by Twilio voice webhook, recording switch, weekly-report recipients, live A2P badge) | `§14`; `app/api/twilio/voice/route.ts:189` | Kept as-is — best-consumed settings page |
| A2P registration status (read-only; same status object gates composer + engine SMS) | `§16` | Kept as-is |
| Appointment types/outcomes lookup (consumed by Calendar AppointmentModal) | `§18` | Kept; **error-swallow fixed** (§12) |
| `crm_assignment_config` strategy (all_to_one / round_robin / by_source, atomic RR RPC honoring `routing_eligible`, fail-safe to matt) | `§11`; `lib/crm/lead-routing.ts:162-176` | Kept as the routing **fallback** layer; unified with Lead Flows under one routing page (§9) |
| Lead Flows source→broker mapping (the one part that works end-to-end) | `§8`; 20+ `ensureNativeLead` call sites | Kept; **conditions/pond/group fixed** (§9) |
| Bulk-job framework (preflight, suppression estimate, chunked worker, progress poller) | arch §3; `lib/crm/bulk-jobs.ts` | Reused by the rebuilt CSV import worker (§11) |
| Tasks module (views, scoping, snooze/reassign/bulk-complete, reminder cron) | `§26` | Kept; **mobile fork deleted** (§13) |
| Calendar module (day/week/month, appointments, tasks, closings, guest chips) | `§27` | Kept; **mobile fork deleted** (§14) |
| First-touch Approvals (`first_touch_override` honored by engine at step 0) | `§24`; `crm-sequence-engine/route.ts:338-340` | Kept; **one queue, error feedback wired** (§15) |
| `isAuthorizedCron` fail-closed pattern | arch §3 | The template for the trigger-cron guard (§7.4) |

### 1.2 REBUILD — the authoring truth, the routing correctness, the render architecture

| Rebuilt | Why (root cause / defect) | Section |
|---|---|---|
| **One Settings home** — tabbed sections generated from the capability map | RC4 (17-panel hub + IA duplication `§1`) + RC5 (nav ≠ access `§11 gate mismatch`, `§13`) | §5 |
| **One automation surface** under one name ("Automations") | RC4 — four names, two surfaces, one engine (`§22:238`) | §6 |
| **Trigger registry** — the authoring palette can only offer trigger types with a registered live dispatcher; a CI gate enforces it | RC6 — 7 of 9 triggers are dead config (`§D1`) | §7 |
| **Wire the real dispatchers** (tag_added-on-any-add, stage_changed, source_is, appointment, deal_stage_changed) + a **time-based trigger cron** (inactivity, calendar_date) | RC6 — `fireTrigger` has one call site (`§D1`) | §7 |
| **Persisted resolved plan** for enrollments — the engine indexes a stable flattened plan, not a re-spliced raw tree per tick | RC6 — condition branches run the wrong steps (`§D2`) | §8 |
| **Thread real lead context** (source, price, area, tags) into routing | RC6 — lead-flow conditions can never match (`§D4`) | §9.3 |
| **Fix pond routing** (never silently misroute) + **group RR eligibility** + **remove the two unbuilt claim-queue placebos** (pond target, group first_to_claim) | RC6 — pond dead (`§D3`), group RR ignores config + eligibility (`§D5`) | §9.4–9.5 |
| **Wire the Team toggles to real consumers** (`can_export` → export route, `pause_leads` → routing eligibility) | RC6 — dead columns (`§D6`) | §10 |
| **Background CSV import worker** (chunk-per-tick, real progress cursor, resume, phone-dedup, stage validation) | `§D7` — 60s cap, stuck 'running', restart-dup | §11 |
| **One responsive tree** for Tasks + Calendar (delete the two mobile forks) | RC3 (`§Mobile divergence`) | §13, §14 |
| **One Approvals queue** with wired error feedback | RC4 (dup approve surface) + `§D8` (silent failure) | §15 |
| **One broker registry** (the `brokers` table + `admin_roles`), all constant maps deleted | RC4/RC5 — broker identity in 5+ maps (`§13`, 45 importers of `CRM_BROKERS`/`CRM_MAILBOXES`) | §16 |

### 1.3 DELETE — the accretion (cite before removing)

| Deleted | Evidence it is dead / duplicate / a placebo |
|---|---|
| `/admin/crm/automations` redirect stub | `§20` — permanent redirect, FUB-parity URL only |
| The name split "Workflows" / "Sequences" / "Enrollment board" | `§22:238` duplication row — one name: **Automations** |
| Second broker-management pages: `/settings/team` **and** `/settings/brokers` **and** `/admin/brokers/edit` as three separate rosters | `§13`, `§Duplication map` — "3 pages for one roster" → one **Brokers** section (§16) |
| `/settings/lead-flows` **and** `/settings/assignment` as two source→broker pages | `§11 Overlap`, `§Duplication map` — collapse to one **Routing** section (§9) |
| `/settings/market-reports` (read-only) as a distinct surface from `/admin/crm/subscriptions` Reports tab | `§19`, `§Duplication map` — one surface (§5.3) |
| `MobileTasksScreen`, `MobileCalendarScreen` + the `-mx-7 -mt-9` negative-margin hacks | `§26`, `§27`, `§Mobile divergence` — RC3 |
| The `first_to_claim` option in `GroupEditor` + the "pond" option in `LeadFlowEditor`'s target picker (the two unbuilt claim-queue placebos) | `§D3`, `§D5` — no claim queue exists; `claimPondLeadAction` has zero UI callers (`§Dead inventory`) |
| The `inquiry` and `property_saved` trigger types from the authoring palette (no live writer today) | `§D1` — offered, never fires; re-add via the registry (§7) when a writer exists |
| The `CRM_STAGES` const validator in `updatePersonStageAction` | `§2`, `crm.ts:1127` — taxonomy fork; the table is the only source (§6.2) |
| Constant broker maps: `CRM_BROKERS` (`lib/crm/constants.ts:11`), `CRM_MAILBOXES` (`lib/crm/gmail.ts:29`), `BROKER_LINES` (`getGroupReplyParticipants.ts:30`), `coerceBroker`/`DEFAULT_BROKER` fallback in `ensureNativeLead.ts:43-45` | 45 importers; `§13`; superseded by the broker registry (§16). *Coordinate with Spec 02, which already deletes `getGroupReplyParticipants`.* |
| `skippedSms` dead counter (`crm-sequence-engine/route.ts:70`) | `§Dead inventory` — hardcoded 0 |
| `error=`/`?boardError=` divergent error channels | `§D8` — replaced by the optimistic failed-affordance + one toast pattern (§4.2 primitive) |

The `admin_roles.can_export` / `pause_leads` columns and the
`crm_groups.distribution_type` / `crm_ponds` tables are **not dropped** — they are
made real or left dormant additively (§10, §9.4). RC6's fix is "wire it or stop
offering it," not "drop the column."

---

## 2. Naming & where things live

Per the new IA (arch §5), Settings drops the `crm/` route prefix (mirrors Spec
02's `crm/inbox` → `inbox`).

- **One UI root:** `app/admin/(protected)/settings/` — a tabbed shell. Sections
  are route segments so each deep-links and streams independently
  (`settings/brokers`, `settings/routing`, `settings/automations`,
  `settings/automations/[id]` (editor), `settings/templates`, `settings/stages`,
  `settings/compliance` (suppression + block list), `settings/company`,
  `settings/fields`, `settings/reports` (areas + subscriptions),
  `settings/appointments`, `settings/account`).
- **Operational surfaces stay at top level** (not under Settings — they are
  daily-driver, not config): `app/admin/(protected)/tasks/`,
  `app/admin/(protected)/calendar/`. The **Approvals** queue and the automation
  **Enrollment board** are operational views of the engine; they surface on
  TODAY (shell-ia) and inside `settings/automations` as read-through tabs, with
  their data + actions specified here.
- **DAL:** `lib/data/crm/settings/` (existing readers kept: `getCrmStages`,
  `getCrmTags`, `getCrmAssignmentConfig`, `getLeadFlow*`, `getBrokerTelephony`,
  …) plus **new** `getBrokerRegistry.ts` (§16), `getTriggerRegistry.ts` (§7),
  `getEnrollmentPlan.ts` (§8). Automation readers: `getWorkflowAnalytics`
  (N+1 fixed, §6.4), `getActiveRulesForTrigger`.
- **Actions (consolidated):** existing `crm-stages.ts` / `crm-tags.ts` /
  `crm-field-definitions.ts` / `crm-suppressions.ts` / `crm-block.ts` /
  `crm-company-settings.ts` / `crm-sequences.ts` / `crm-groups.ts` /
  `crm-import.ts` **kept**. The three broker-management actions
  (`admin-broker-permissions.ts` + the brokers-toggle action + the
  `/admin/brokers/edit` profile action) collapse into **one** `crm-brokers.ts`
  (§16). `crm-ponds.ts` reduced to nothing-user-facing (§9.4).
- **Engine:** `app/api/cron/crm-sequence-engine/route.ts` (unchanged executor,
  cursor read model swapped §8); `lib/crm/lead-routing.ts` +
  `lib/crm/lead-flow-resolver.ts` (context threading §9.3);
  `lib/crm/trigger-dispatch.ts` (registry-driven §7); **new**
  `app/api/cron/crm-automation-triggers/route.ts` (time-based triggers §7.4);
  **new/renamed** `app/api/cron/crm-import-worker/route.ts` (§11).

---

## 3. Data model

All changes are **additive and back-compatible** (arch §4.1 discipline). No
column is dropped in this spec; dead columns are wired or left dormant.

### 3.1 New: `crm_trigger_registry` (source of truth for "which triggers are live")

The RC6-killing spine. One row per trigger type, declaring whether it has a live
dispatcher. The authoring palette reads this; the CI gate asserts it matches the
code (§7.5).

```sql
-- Migration: 2026XXXX_trigger_registry.sql (additive)
create table public.crm_trigger_registry (
  type          text primary key,          -- 'tag_added' | 'stage_changed' | ...
  label         text not null,             -- UI label
  description   text not null,             -- one-line "fires when …"
  status        text not null default 'live',  -- live | disabled (disabled = not offered)
  dispatcher    text not null,             -- code path that fires it (for the gate + docs)
  value_kind    text not null default 'none',   -- none | tag | stage | source | deal_stage | date | appointment_outcome
  created_at    timestamptz not null default now()
);

insert into public.crm_trigger_registry (type,label,description,status,dispatcher,value_kind) values
 ('tag_added','Tag added','Fires whenever a tag is added to a contact (creation OR later).','live','app/actions/crm.ts addPersonTags* + lib/crm/enroll.ts','tag'),
 ('stage_changed','Stage changed','Fires when a contact moves to a stage.','live','app/actions/crm.ts:updatePersonStageAction','stage'),
 ('source_is','Lead source is','Fires at lead creation when the source matches.','live','lib/crm/enroll.ts:autoEnrollPerson','source'),
 ('appointment','Appointment outcome','Fires when an appointment is logged with an outcome.','live','app/actions/crm-appointments.ts','appointment_outcome'),
 ('deal_stage_changed','Deal stage changed','Fires when a deal advances a stage.','live','Spec 05 deal-stage mutation','deal_stage'),
 ('inactivity','No activity for N days','Fires on the daily sweep when a contact has had no activity for N days.','live','app/api/cron/crm-automation-triggers','none'),
 ('calendar_date','On a date','Fires on the daily sweep when a stored date field matches today.','live','app/api/cron/crm-automation-triggers','date'),
 ('inquiry','New inquiry','(no live writer)','disabled','—','none'),
 ('property_saved','Property saved','Fires when a signed-in buyer saves a home (needs Spec 08).','disabled','Spec 08 saved-home→intent hook','none');
```

**Design decision, stated:** `inquiry` is `disabled` because it is redundant with
`source_is` + `tag_added` at creation (`§D1`). `property_saved` is `disabled`
until Spec 08 ships the saved-home→CRM-intent writer — the dispatcher call site is
pre-specified (§7.3) so flipping it to `live` is a one-line change plus the CI
gate re-check. A `disabled` type is **not rendered** in the palette, so it cannot
be configured as a placebo — RC6 made impossible by construction.

### 3.2 New: `crm_sequence_enrollments.resolved_plan` (the D2 fix)

Add one additive jsonb column. The enrollment indexes a **stable, persisted,
flattened plan of leaf steps** rather than re-splicing the raw tree every tick.

```sql
-- Migration: 2026XXXX_enrollment_resolved_plan.sql (additive)
alter table public.crm_sequence_enrollments
  add column resolved_plan jsonb;      -- Step[] (leaf steps only, no condition nodes)
                                       -- null for legacy rows → engine backfills on first touch
```

- `step_index` now indexes into `resolved_plan`, not `crm_sequences.steps`.
- Conditions are resolved **lazily as reached** against live person state and the
  chosen branch's leaf steps are **spliced into `resolved_plan` and persisted**
  (§8). `crm_sequences.steps` (the raw authored tree) stays authoritative for the
  editor; `resolved_plan` is the per-enrollment execution record.
- The enrollment board renders columns from `resolved_plan` (fixing the second
  half of D2, `§D2` — kanban shows wrong columns for branching workflows).

### 3.3 New: `crm_automation_rules` gains a time-trigger config (the inactivity/calendar_date fix)

`crm_automation_rules` already carries `trigger_type` / `trigger_value` /
`action_type` / `action_value` / `position` / `is_active` (schema snapshot
L1489). Time-based triggers need a threshold. Add one additive column:

```sql
alter table public.crm_automation_rules
  add column trigger_config jsonb not null default '{}';  -- { days:30 } for inactivity; { field:'anniversary', offsetDays:0 } for calendar_date
```

No change for event triggers (they leave `trigger_config` empty).

### 3.4 CSV import — real progress cursor (the D7 fix)

No new table. `crm_imports.cursor` (jsonb, schema snapshot L1740) changes shape
from `{ csv_text }` to `{ csv_text, offset, total }` — `offset` is the next
unprocessed row index, persisted after every chunk so a re-claimed run resumes
(§11.3). Additive within an existing jsonb column; legacy rows (offset absent)
default `offset=0`. `processing_started_at` (L1745) already exists for the stale
window.

### 3.5 Source-of-truth ownership (one definition per fact — arch §4.5)

| Fact | Single source | Never re-derived from |
|---|---|---|
| Which triggers can be authored | `crm_trigger_registry.status='live'` | a hardcoded list in a component |
| A contact's stage taxonomy | `crm_stages` table | the `CRM_STAGES` const (deleted §6.2) |
| An enrollment's next step | `resolved_plan[step_index]` | re-splicing `crm_sequences.steps` each tick |
| Who a lead routes to | `pickRoutedBroker(fullContext)` | two disagreeing pages read separately |
| Whether a broker may export | `admin_roles.can_export` (read by the export route §10) | nothing (was dead) |
| Whether the router skips a broker | `admin_roles.pause_leads` (read by routing eligibility §10) | nothing (was dead) |
| Broker identity (slug/name/mailbox/line/flags) | the **broker registry** DAL over `brokers` + `admin_roles` (§16) | `CRM_BROKERS`/`CRM_MAILBOXES`/`BROKER_LINES` consts |

---

## 4. Cross-cutting behavior (inherited from Spec 01)

Every mutation in this spec uses the Spec 01 primitives; they are not re-defined
here, only their per-surface behavior is specified.

### 4.1 Auth (§4.4)
Every server action and route handler in this domain calls
`requireAdmin(capability)` **in-body** (defense in depth — the layout gate is not
enough). Capabilities this spec introduces:
`settings:view`, `settings:manage` (superuser — stages/tags/routing/company/
compliance/automations authoring), `brokers:manage` (superuser), `import:run`
(superuser), `export:run` (gated by `admin_roles.can_export` §10),
`tasks:use` (any broker, scoped), `calendar:use` (any broker, scoped),
`approvals:act` (any broker, own leads only). The **nav + the Settings tab list
are generated from the same map** — a broker without `settings:manage` never sees
the Automations tab **and** the action refuses (§4.4). This kills the audit's
"restricted broker gets a fully interactive surface where every Save errors
'Superuser only'" defect (`§D11`).

### 4.2 Optimistic + idempotent mutations (§4.2)
Every toggle/save/create returns the changed entity and patches local state — no
`router.refresh()`, no full-page reload. This replaces the crude "plain
server-action form → full page reload per toggle" UX the audit flags on
`/settings/brokers` (`§12`) and the swallow-to-console error handling on
Approvals + appointment settings (`§D8`). Failure renders an inline failed state
+ Retry + one toast; the divergent `error=` / `?boardError=` URL channels are
deleted (§1.3). Destructive/routing-mutating actions (import run, broker pause,
suppression add) carry an `idempotency_key` so a double-tap is a DB-level no-op.

### 4.3 Cached reads + streaming (§4.6)
The Settings home streams its chrome instantly and suspends each section's counts.
The current hub fires **10 parallel reads to paint a menu** (`§1`); the rebuilt
home renders the tab list from the (static) capability map immediately and lazy-
loads each section's count badge from a cached, tagged endpoint. A mutation
invalidates only its tag.

---

## 5. Feature — The Settings home

### 5.1 Purpose & job
One destination (arch §5: "SETTINGS — one place — brokers · routing · templates ·
automations · suppression · account") replacing the 17-panel hub + the IA
duplication. Job A's front door.

### 5.2 Layout (one responsive tree)
A left rail (desktop) / top segmented control (phone) of **sections**, each a
route segment. Sections and their capability gate:

| Section | Route | Gate | Contents (kept panels folded in) |
|---|---|---|---|
| Brokers | `settings/brokers` | `brokers:manage` | roster + roles + per-broker flags + broker profile — **one page** (§16), replacing Team + Brokers + `/admin/brokers/edit` |
| Routing | `settings/routing` | `settings:manage` | strategy + per-source rules + Lead Flows + Groups — **one page** (§9), replacing Lead Flows + Assignment |
| Automations | `settings/automations` | `settings:manage` | sequences list + editor + enrollment rules + triggers + enrollment board — **one surface** (§6), replacing the 4 names |
| Templates | `settings/templates` | `settings:manage` (view: any broker, scoped) | kept as-is (`§5`) |
| Stages & Tags & Fields | `settings/stages` | `settings:manage` | kept CRUD (`§2`,`§3`,`§4`); taxonomy fork fixed (§6.2) |
| Reports | `settings/reports` | `settings:manage` | market-report **areas** + **subscriptions** — one surface (§5.3) |
| Appointments | `settings/appointments` | `settings:manage` | kept lookup CRUD; error-swallow fixed (§12) |
| Compliance | `settings/compliance` | `settings:manage` | suppression + block list + A2P registration status — kept, grouped |
| Company | `settings/company` | `settings:manage` | kept as-is (`§14`) |
| Account | `settings/account` | `settings:view` | the signed-in broker's own profile/notification prefs |

Nothing shown ever dead-ends: the section list is the capability map (§4.1), so a
broker who can open a section can act in it.

### 5.3 Kill the market-report double-surface (RC4)
`/settings/market-reports` was **read-only** while `/admin/crm/subscriptions`
Reports tab did full CRUD over the **same** `crm_report_subscriptions` table
(`§19`, `§Duplication map`). The rebuilt `settings/reports` is the **one**
surface: manage areas (kept ConfigTable) + manage subscriptions (edit/assign/
pause/preview — the CRUD from the subscriptions tab, keeping the
`crm-market-report-preview.ts` verification-trace preview). The person-card
`ReportSubscriptionsPanel` (Spec 03) reads/writes the same table — that is the
per-person entry, not a third store.

### 5.4 States
- **Loading:** tab list paints instantly (static); count badges stream in.
- **Empty:** a section with no rows shows a one-line "add your first X" with the
  create affordance — never a dead placeholder link to `/admin/crm`.
- **Permission-denied:** the section is **not in the list** for a broker lacking
  its capability (structural, §4.1) — not a 403 page after a click.
- **Populated / mutation states:** per §4.2 (optimistic, no reload).

### 5.5 Edge cases
- **Broker deep-links a section they lack:** capability guard in-body → a friendly
  "you don't have access to Settings" panel with a back link, not a raw 403 and
  not the current "this account does not have admin access" dead-end (RC5).
- **Count badge read fails:** the badge renders "—" (unavailable), the section
  still opens. A failed count never blanks the menu.

---

## 6. Feature — Automations (one surface, one name)

### 6.1 Purpose & job
Author the auto-responses that run the loop's response half without a human tap.
One surface named **Automations** (`settings/automations`), replacing the four
names (`§22:238`).

### 6.2 Structure (tabs within one surface)
1. **Sequences** — the list (kept 704-line list behaviors: folders, duplicate,
   archive, delete-with-fail-closed-guards `crm-sequences.ts:231-270`), plus a
   real analytics column (N+1 fixed §6.4).
2. **Editor** (`settings/automations/[id]`) — the visual canvas (kept authoring),
   with **conditions that execute correctly** (§8) and a **triggers tab that only
   offers live types** (§7).
3. **Enrollment rules** — the tag→sequence (and now source→sequence,
   inactivity→action, date→action) rule manager (kept `AutomationRulesManager`),
   its palette driven by the trigger registry (§7).
4. **Enrollment board** — live enrollments per sequence (kept kanban), columns
   built from `resolved_plan` so branching workflows show people in the **right**
   column (§8, fixes the D2 second half).

**Taxonomy fork fix (§2 caveat):** delete the `CRM_STAGES` const check in
`updatePersonStageAction` (`crm.ts:1127`). Stage validation everywhere — the
stage-change action, the engine's `change_stage` step (`route.ts:486-494`), the
import wizard — reads the `crm_stages` table (cached DAL). A stage added in
Settings then works in every path; no split source.

### 6.3 Access (fix D11)
The editor and rule manager render only for `settings:manage` (§4.1). A restricted
broker never sees an interactive builder whose every Save errors "Superuser only"
(`§D11`). View-only read of the enrollment board (own leads) is allowed for any
broker via `approvals:act` scope.

### 6.4 Fix the analytics N+1 + rename fragility (D10)
`getWorkflowAnalytics` did one serial `email_events` count per sequence with
`LIKE 'seq:<name>:%'`, keyed on the **sequence name** so a rename orphaned all
engagement (`§D10`; send path stamps `emailKey: seq:${seq.name}:${step}`
`route.ts:297`). Fix: (a) stamp the **sequence id** not the name
(`emailKey: seq:${seq.id}:${step}`) so a rename never orphans history — additive,
new sends key on id, a backfill maps old name-keyed rows; (b) replace the per-
sequence serial counts with one grouped aggregate query behind `unstable_cache`
(tag `workflow-analytics`), invalidated on send. The list stops firing N queries
per cache-miss.

### 6.5 States & edge cases
- **Delete a sequence with live enrollments / a master workflow:** refused,
  fail-closed (kept `crm-sequences.ts:231-270`); the refusal renders inline (§4.2),
  not a swallowed console error.
- **Save an editor with a `templateKey` that no longer exists:** kept validation
  (`crm-sequences.ts:69-78,351`) blocks the save with the offending step named.
- **Author a condition/trigger whose type is `disabled`:** impossible — the
  palette does not offer it (§7).
- **Concurrent editor saves (two brokers):** last-write-wins on
  `crm_sequences.steps` with an `updated_at` optimistic check; the loser gets a
  "someone else changed this workflow, reload" inline error, not a silent clobber.

---

## 7. Feature — Triggers: the registry + real dispatchers (kills D1)

### 7.1 The problem restated
Two UIs offer 9 trigger types; `fireTrigger` has **exactly one caller** (stage
change, `crm.ts:1145`); `autoEnrollPerson` evaluates only `tag_added` and only at
**creation time** (`§D1`, `enroll.ts:76-99`). Seven types are dead config a broker
can set with no warning.

### 7.2 The structural fix: authoring reads the registry
The Triggers tab and the Enrollment-rules manager render their type dropdown from
`getTriggerRegistry()` filtered to `status='live'` (§3.1). A `disabled` type is
never offered. **Adding a trigger type is a registry row + a dispatcher call site,
never just a UI option.** This is the §4.4 nav-from-capability-map pattern applied
to triggers.

### 7.3 Per-trigger decision (implement or remove — stated explicitly)

| Trigger | Decision | Dispatcher (where it fires) |
|---|---|---|
| `tag_added` | **IMPLEMENT (fix scope)** | Today fires only at creation. Fix: every tag-add path (`addPersonTagsDirect`, bulk tag-add, the sequence `tag` step `route.ts:477-482`, person-card tag edit) calls `fireTrigger('tag_added', tag, personId)`. So "tag X → enroll" fires whenever X is added, not just at birth (`§D1` closing note). |
| `stage_changed` | **KEEP** | Already wired (`crm.ts:1145`). |
| `source_is` | **IMPLEMENT** | Evaluated at lead creation in `autoEnrollPerson` alongside `tag_added` (source is present on the row; near-zero cost). |
| `appointment` | **IMPLEMENT** | `fireTrigger('appointment', outcomeKey, personId)` from the appointment create/outcome action (`crm-appointments.ts`, this spec's Calendar domain §14). |
| `deal_stage_changed` | **IMPLEMENT (cross-spec seam)** | One call site in Spec 05's deal-stage mutation: `fireTrigger('deal_stage_changed', newStage, personId)`. Registry row present now; dispatcher lands with Spec 05. Until then the type is `live` only once that call site exists (the CI gate §7.5 enforces this — no orphan). **Open question OQ-3.** |
| `inactivity` | **IMPLEMENT (time-based cron §7.4)** | Daily sweep. |
| `calendar_date` | **IMPLEMENT (time-based cron §7.4)** | Daily sweep. |
| `inquiry` | **REMOVE** | Redundant with `source_is` + `tag_added` at creation (`§D1`). Registry `disabled`; not offered. |
| `property_saved` | **DEFER (registry `disabled`)** | Genuine buyer signal but its writer is Spec 08 (RC7). Pre-specified dispatcher: the saved-home→CRM-intent hook calls `fireTrigger('property_saved', listingKey, personId)`. Flip to `live` when Spec 08 ships. **Open question OQ-4.** |

Net: **7 live, 2 disabled** — every live one has a proven call site; no offered
trigger is dead.

### 7.4 The time-based trigger cron (new)
`app/api/cron/crm-automation-triggers/route.ts`, daily (e.g. `0 14 * * *`),
guarded by `isAuthorizedCron` (fail-closed, arch §3). It:

1. Reads active `crm_automation_rules` where `trigger_type in ('inactivity','calendar_date')`.
2. **inactivity:** for each rule (`trigger_config.days = N`), selects `crm_people`
   whose latest `crm_timeline.ts` (any kind) is older than N days AND who are not
   hard-stopped, batched, then dispatches the rule's action (enroll / tag / stage /
   task) via the same `dispatchRuleAction` path (`trigger-dispatch.ts:113`).
   Idempotency: a `crm_automation_fires` dedupe key `(rule_id, person_id, bucket)`
   (bucket = the N-day window start) prevents re-firing the same rule on the same
   contact every day it stays inactive.
3. **calendar_date:** for each rule (`trigger_config.field`, e.g. a custom-field
   date or `anniversary`), selects contacts whose stored date matches today
   (± `offsetDays`); dispatches; deduped by `(rule_id, person_id, year)`.
4. Writes a run summary to the timeline/audit like the other crons.

New tiny table `crm_automation_fires (rule_id, person_id, dedupe_bucket, fired_at, primary key(rule_id,person_id,dedupe_bucket))` — additive, the at-most-once ledger for time-based fires.

### 7.5 CI gate — `ci:automation-triggers-wired` (kills RC6 recurrence)
A mechanical gate (repo doctrine: "gates not prose", CLAUDE.md) that:
- Reads `crm_trigger_registry` (or a checked-in mirror `data/trigger-registry.json`).
- For every `status='live'` row, asserts the declared `dispatcher` path contains a
  real `fireTrigger('<type>'` call (or, for the time-based types, a handler branch
  in the trigger cron).
- Fails the build if a live type has no dispatcher, **or** if the authoring palette
  component references a type absent from the registry.
This makes "the UI offers a trigger that never fires" a **build failure**, not a
silent lie — the direct structural cure for D1.

### 7.6 States & edge cases
- **A rule references a sequence that was archived/deleted:** dispatch is a no-op
  with a logged reason (kept `manualEnrollPerson` guards `enroll.ts:179-181`); the
  rule shows a "target workflow inactive" badge in the manager.
- **inactivity rule with N days that would sweep the 18K historical book:** the
  enrollment epoch guard (`ENROLLMENT_EPOCH`, `enroll.ts:14`) and outreach-list
  exclusion still apply on the enroll action — a time trigger cannot mass-enroll
  the pre-epoch book.
- **calendar_date field missing on a contact:** no match, no fire (not an error).
- **Cron overlaps a prior slow run:** cron lease (kept pattern) prevents double
  processing; the `crm_automation_fires` dedupe makes a re-run idempotent anyway.
- **Trigger fires but the action's contact is hard-stopped:** `dispatchRuleAction`
  → `manualEnrollPerson`/tag/stage still run their own hard-stop fail-closed
  checks; a send-bearing enroll is refused, a tag/stage may proceed (config, not a
  message).

---

## 8. Feature — Conditions execute correctly (kills D2)

### 8.1 The bug (restated with the walkthrough)
The engine splices the chosen branch **in memory only** each tick and stores
`step_index` in **materialized** coordinates, then next tick rebuilds from the
**raw** tree and only re-splices if the node **at** `step_index` is itself a
condition (`route.ts:164-178`). Walkthrough (`§D2`): steps
`[s0, s1, COND{true:[a,b,c]}, s3]`, enrollment at index 2 → splice → executes `a`,
stores `step_index=3`. Next tick `rawSteps[3]` (raw coords) is `s3` — **`b` and
`c` never run**, `s3` fires with `b`'s delay. Stage/tag changes between ticks can
shift indexes arbitrarily. The kanban (`crm.ts:1875-1881`) counts columns from raw
steps against materialized indexes → wrong columns.

### 8.2 The fix: a persisted, stable resolved plan
Replace the per-tick re-splice with a **persisted flattened plan** on the
enrollment (`resolved_plan`, §3.2):

- **On enrollment:** `resolved_plan` starts as the raw tree with any **leading**
  non-condition steps copied and the first condition left unresolved as a marker
  — or simply `null`, resolved lazily. Simplest deterministic rule: `resolved_plan`
  holds the **resolved prefix + not-yet-reached raw suffix**, where a condition in
  the suffix is resolved and spliced the moment `step_index` reaches it.
- **Engine tick:** read `plan = resolved_plan ?? seq.steps`. Look at
  `plan[step_index]`. If it is a condition node, evaluate it against the live
  person (kept `resolveConditionPath(candidate, person)`), splice the chosen
  branch's leaf steps in place of the node, **persist the new `resolved_plan`**,
  and re-read `plan[step_index]` (loop for nested, kept `condIterations<10`). If it
  is a leaf step, execute it, advance `step_index++`, persist.
- Because `resolved_plan` is persisted and only grows by resolving conditions as
  reached, `step_index` always points at the correct next leaf across ticks —
  `b` and `c` run, `s3` runs after with its own delay. Stage/tag changes between
  ticks no longer shift already-resolved indexes (a resolved branch stays
  resolved; only not-yet-reached conditions read live state, which is the correct
  semantics).

### 8.3 Kanban correctness (D2 second half)
The enrollment board reads `resolved_plan` (via `getEnrollmentPlan.ts`), so each
enrollment's column = its `resolved_plan[step_index]` position. Branching
workflows render people in the right column. For legacy enrollments with
`resolved_plan=null`, the board shows them under a "resolving" bucket until the
next engine tick backfills the plan.

### 8.4 Migration / backfill
Legacy running enrollments have `resolved_plan=null`. The engine backfills on the
next touch: `resolved_plan = materialize(seq.steps up to step_index, resolving
conditions with current person state)`. Because the old code already executed the
*materialized* index, the safest backfill treats the current `step_index` as
already-past and resolves forward from there. A one-time reconciliation report
(arch §8 discipline) lists any enrollment whose raw `step_index` exceeds the raw
tree length (the corrupt tail-jumped ones) for manual review before cutover — no
silent data loss.

### 8.5 States & edge cases
- **Condition evaluates against a person whose stage/tags changed mid-sequence:**
  correct by design — a not-yet-reached condition reads live state when reached.
- **Both branches empty (`truePath:[]`, `falsePath:[]`):** the resolve produces an
  empty splice; `step_index` lands on the step after the condition (or completes).
- **Nested conditions deeper than 10:** kept `condIterations<10` guard stops the
  loop and stops the enrollment with a logged reason (no infinite splice).
- **Editor edits `steps` while enrollments are live:** already-resolved plans are
  unaffected (they carry their own `resolved_plan`); only enrollments that have
  not yet reached the edited region pick up the new raw tree. Documented behavior,
  no clobber.
- **`first_touch_override` at step 0:** kept — the engine honors it at
  `resolved_plan[0]` (`route.ts:338-340` reads step 0 the same way).

---

## 9. Feature — Lead routing (one page; flows + assignment + groups + ponds)

### 9.1 Purpose & job
Decide who gets notified when a lead arrives (loop's top edge, C2). One **Routing**
section replacing the two overlapping pages (`§11 Overlap`, `§Duplication map`).

### 9.2 One surface, layered resolution (kept order)
`pickRoutedBroker` keeps its resolution order: **Lead Flows first, then
`crm_assignment_config` fallback** (`lead-routing.ts:120`). The Routing page shows
both layers on one screen so a broker predicts routing without cross-referencing
two pages: (1) **Flows** (per-source, with conditional rules → broker/group), (2)
**Fallback strategy** (all_to_one / round_robin / by_source + default broker),
(3) **Groups** (named broker sets, round-robin only §9.5). An explicit
`?agent=` attribution still wins over all of it (kept `ensureNativeLead.ts:206`).

### 9.3 Fix: lead-flow conditions can never match → thread real context (kills D4)
The resolver evaluates price/area/tag conditions correctly
(`lead-flow-resolver.ts:38-74`) but the only caller passes `{ source }` alone
(`ensureNativeLead.ts:209`, `canonical-lead-tagger.ts:91`), so every conditional
rule evaluates against empty context (`§D4`). **Fix:** `ensureNativeLead` builds
the full `PickRoutedBrokerInput` from the lead it is creating —
`{ source, price, area, tags, pondResult }` — and passes it. `price`/`area` come
from the incoming lead payload (LP/webhook fields already captured on the person);
`tags` = the tags being applied to this lead. `canonical-lead-tagger.ts` passes the
same. A price/area/tag Lead Flow rule now actually decides routing. Where a lead
has no price/area (a bare sign-in), those conditions evaluate false as designed and
the flow default/fallback applies — no crash, no misroute.

### 9.4 Fix: pond routing silently assigns Matt (kills D3)
Today `pickRoutedBroker` returns `POND_ROUTING_SENTINEL='__pond__'`, the caller
passes no `pondResult` and wraps the result in `coerceBroker`, which sees
`'__pond__'` ∉ `CRM_BROKERS` → `DEFAULT_BROKER (Matt)` with `pond_id=null`
(`ensureNativeLead.ts:209,43-45`; `§D3`). A whole feature (editor, tables,
sentinel, `claimPondLeadAction` with **zero UI callers**) has no working path.

**Decision (default — see OQ-1):** a 3-broker shop (C1) does not need a claim-based
shared lead pool; assignment strategies + groups cover distribution. **Remove
"pond" as a routing target now, non-destructively:**
- `LeadFlowEditor`'s target picker no longer offers "pond" (§1.3).
- The resolver's `pond` branch is treated as `none` → falls through to the
  assignment fallback (a real broker), so **no lead is ever silently misrouted**.
- `crm_ponds` / `crm_pond_members` / `claimPondLeadAction` left dormant (additive,
  reversible). The people-list pond-scope filter (`crm.ts:218-222`) is hidden until
  ponds are real.
- **Regardless of the keep/remove call, the correctness fix is mandatory:**
  `coerceBroker` must never receive the raw sentinel. If OQ-1 comes back "build
  ponds," the alternative fix is the end-to-end wiring — `ensureNativeLead` passes
  `pondResult`, sets `crm_people.pond_id`, assigns the lead to the pond's
  designated owner (`crm_ponds.pond_lead_slug`) as the visible assignee until
  claimed, and a **Pond queue** UI surfaces `claimPondLeadAction`. Either path
  ends the silent-assign-to-Matt bug.

### 9.5 Fix: group "first to claim" is silently round-robin + RR ignores eligibility (kills D5)
Groups can be `round_robin | first_to_claim` (`crm-groups.ts:35`), but the engine
always calls `crm_advance_group_round_robin` and the SQL never reads
`distribution_type` (`§D5`). And the group RR ignores `routing_eligible`/
`crm_active`, so it can rotate to a **disabled broker** (unlike the global RR).

**Decision:** `first_to_claim` is the same unbuilt claim-queue concept as ponds
(§9.4) — **remove it** for now. `GroupEditor` offers round-robin only; existing
`first_to_claim` rows coerce to `round_robin` on read. **Plus a mandatory
correctness fix regardless:** `crm_advance_group_round_robin` filters its member
list by broker eligibility (join `brokers` on `routing_eligible=true AND
crm_active=true`, and — after §10 — exclude `admin_roles.pause_leads=true`), so a
group never rotates to a disabled/paused broker. Migration: `CREATE OR REPLACE
FUNCTION crm_advance_group_round_robin` with the eligibility join (additive, same
signature). **OQ-1** covers whether claim-based distribution is ever wanted.

### 9.6 States & edge cases
- **Flow default is a group with zero eligible members:** RR returns NULL → resolver
  falls through to the assignment fallback → a real broker (fail-safe to matt kept).
- **All brokers paused/ineligible:** every eligibility filter empties → fail-safe
  to `matt` (kept `SAFE_DEFAULT`), and a `crm-health-check` rule (kept cron) pages
  the owner "routing has no eligible broker."
- **Two source→broker systems disagree (Flows vs by_source rules):** Flows win
  (kept order); the Routing page renders them in resolution order so the winner is
  visible, killing "must understand both pages to predict routing" (`§11`).
- **Routing RPC fails mid-intake:** kept fail-safe to matt, never crash/hang the
  lead-capture path (`lead-routing.ts:177-180`).
- **`?agent=` attribution + a conflicting flow:** attribution wins (kept), logged.

---

## 10. Feature — Team toggles become real (kills D6)

`admin_roles.can_export` / `pause_leads` are written by
`admin-broker-permissions.ts` and read by **nobody** (`§D6`). Decision:
**wire the consumers** (both are genuinely useful for a 3-broker shop; removing
them loses a real feature).

- **`can_export`:** the CSV **export** route (`/api/admin/crm/export`) adds an
  in-body check (§4.1, `export:run`): superuser always allowed; a non-superuser
  broker allowed **only if** their `admin_roles.can_export = true`. Today the route
  checks session + scope only (`export/route.ts:14-16`). Now "Export: No" actually
  blocks that broker's export with a clear 403 message; the button is hidden for
  them via the capability map (§4.1) so it is not a click-then-deny.
- **`pause_leads`:** the routing **eligibility** filter used by every path (global
  RR SQL, group RR SQL §9.5, by_source resolution, flow broker targets) excludes a
  broker with `pause_leads = true`. Wire it in the shared eligibility predicate so
  all four paths inherit it. Now "Paused" (vacation/capacity) actually stops that
  broker receiving new leads; unpausing resumes them. Fail-safe: if pausing would
  leave zero eligible brokers, routing still fail-safes to matt and health-check
  pages the owner (§9.6).

Both toggles get optimistic UX (§4.2) — no full-page reload (`§12` fix). A CI
assertion (extend `ci:admin-authz`) that the export route reads `can_export` and
the routing eligibility predicate reads `pause_leads` prevents them silently
un-wiring again.

---

## 11. Feature — CSV import that survives real files (kills D7)

### 11.1 The problems (restated)
Whole import runs synchronously in one POST with `maxDuration=60`, ≥3 serial DB
round-trips per row (`crm-import/route.ts:23,89-182`) — a 10 MB file (tens of
thousands of rows) is guaranteed to exceed 60s. On timeout the job stays
`status='running'` with **no cron to resume** it; the status page polls every 2s
forever with no timeout messaging (`import/[id]/page.tsx:33-42`). Restart-from-zero
reprocesses row 0 (offset not persisted) → **rows without an email re-insert as
duplicates** (dedup is email-only, `route.ts:92-101`; phone-only contacts dup even
on the first run). Imported `stage` is not validated against `crm_stages`
(`route.ts:119,158`).

### 11.2 The fix: a background worker with a real cursor
Move processing out of the request into a cron worker
(`app/api/cron/crm-import-worker/route.ts`, every 1–2 min, guarded by
`isAuthorizedCron`), mirroring the kept `crm-bulk-worker` pattern:

1. The upload action (`crm-import.ts`) creates the `crm_imports` row `status='running'`,
   `cursor={ csv_text, offset:0, total:N }` and returns immediately — the POST no
   longer does the work.
2. The worker claims one due running import (kept TOCTOU-safe `crm_claim_import`
   RPC, stale window 600s), processes a **bounded batch** (e.g. 500 rows) starting
   at `cursor.offset`, persists `cursor.offset += processed` + `counts` after the
   batch, and **returns** (well under any time budget). Next tick resumes from the
   new offset. Marks `status='done'` when `offset >= total`.
3. Because offset is persisted, a re-claim after a crash resumes mid-file — never
   reprocesses row 0.

### 11.3 Dedup + validation fixes
- **Phone dedup:** when a row has no email, look up an existing person by phone via
  `crm_contact_points (kind='phone', value=normalized)` before insert; merge into
  it instead of inserting a duplicate. Kills the phone-only dup on both first run
  and resume (`§D7`).
- **Idempotent resume:** even with offset persistence, each insert is guarded by
  the email-or-phone lookup, so a batch reprocessed after a mid-batch crash
  converges instead of duplicating.
- **Stage validation:** map each row's `stage` against the cached `crm_stages`
  taxonomy; an unknown stage (e.g. `Hot Lead`) is coerced to a safe default
  (`new`) **and** flagged in `error_rows` with a "stage not in taxonomy, defaulted"
  note — never writes an off-taxonomy stage no pipeline column groups (`§D7`).
- **Routing/enroll opt-in:** imports still skip lead-routing + auto-enroll by
  default (kept behavior for outreach lists), but the wizard surfaces a checkbox
  "assign + enroll these contacts" (default off) so the skip is visible, not
  silent (`§25`).

### 11.4 Status page states
- **running (progressing):** progress bar from `counts` + `cursor.offset/total`,
  ETA.
- **running (stalled):** `processing_started_at` older than the stale window with
  no offset progress → a "this import stalled" banner with **Resume** (re-enqueues
  for the worker) and **Cancel** (sets `status='canceled'`). Replaces the infinite
  silent poll.
- **done / error / canceled:** terminal; error rows downloadable.
- **Loading:** streamed shell + suspended progress region (§4.3).

### 11.5 Edge cases
- **Concurrent worker + a manual re-POST:** kept claim RPC serializes; only the
  claimer processes.
- **CSV with duplicate emails within the file:** kept in-file dup warning at
  preview; on run, second occurrence merges into the first-created person (not a
  dup) via the email lookup.
- **10 MB / tens-of-thousands rows:** processed across N worker ticks; no 60s wall.
- **Malformed rows / over the error cap:** kept `MAX_ERROR_ROWS=500`; the run
  completes with `status='error'` only if `imported===0`, else `done` with an error
  list.
- **Worker crashes mid-batch:** stale window re-claim resumes from the last
  persisted offset; the email/phone lookup makes the partially-processed batch
  idempotent.
- **Session expires during a long import:** irrelevant now — the worker (cron auth)
  does the work, not the broker's session.

---

## 12. Feature — Appointment settings (fix the swallow, D8)

Kept CRUD (`crm_appointment_types` / `_outcomes`, consumed by Calendar
AppointmentModal). Fix: toggle/delete no longer swallow errors to nothing
(`AppointmentSettingsClient.tsx:43-52`) — every mutation uses the §4.2 primitive
(optimistic + inline failed state + Retry). A failed toggle no longer silently
reverts on refresh.

---

## 13. Feature — Tasks (one responsive tree, kills RC3 here)

### 13.1 Keep the module, delete the fork
Kept feature set (`§26`): `getTaskQueue` views (today/overdue/upcoming/completed)
with broker scoping at the data layer, counts, snooze/reassign/edit/delete/
bulk-complete/clear-overdue, contact search on create, reminder cron. **Delete**
`MobileTasksScreen` and the `-mx-7 -mt-9` negative-margin hack
(`tasks/page.tsx:198`). `TasksView` becomes **one** container-query tree authored
mobile-first (§4.3): a single stacked list on phone, progressive-enhanced to a
denser multi-column table on desktop — the same component, not two.

### 13.2 Parity (the point)
Every capability exists on both widths because there is one tree: create, snooze,
reassign, bulk-complete, clear-overdue, search-on-create all present on the phone.
No gate guarantees parity today (`§26`); with one tree, parity is structural.

### 13.3 States & edge cases
- **Empty (no tasks in view):** "nothing due" with a create affordance.
- **Overdue default → today fallback:** kept behavior (`tasks/page.tsx:83-87`) but
  the two serial `getTaskQueue` calls collapse to one (cached), no double fetch.
- **Bulk-complete partial failure:** each task result patched individually (§4.2);
  failed ones stay, marked, with Retry — not an all-or-nothing swallow.
- **Reassign to a paused/inactive broker:** allowed (a task is not a lead route),
  but the picker reads the broker registry (§16) and marks inactive brokers.
- **Task created by an engine `task` step:** kept (`route.ts:470-476`); shows with
  its sequence provenance.
- **Reminder cron rollup:** kept per-broker due/overdue text (`crm-task-reminders`).

---

## 14. Feature — Calendar (one responsive tree)

### 14.1 Keep the module, delete the fork
Kept (`§27`): day/week/month grids, appointments (wall-clock-as-UTC),
open tasks, deal closings, guest chips resolved in one read, types/outcomes from
settings, suppression-checked invites. **Delete** `MobileCalendarScreen` + the
negative-margin hack (`calendar/page.tsx:307`). One container-query tree: an
agenda/day list on phone, progressive-enhanced to week/month grids on desktop.

### 14.2 Fixes carried in
- Don't fetch `getCalendarContactOptions()` on desktop where it is unused
  (`calendar/page.tsx:215`) — load it only when the create modal opens (lazy).
- The 7 parallel per-request fetches stream individually (§4.3), chrome first.
- **Fire the `appointment` trigger** (§7.3): create/outcome mutations call
  `fireTrigger('appointment', outcomeKey, personId)` so appointment-based
  automations become real.

### 14.3 States & edge cases
- **Two time systems on one grid** (appointments wall-clock-as-UTC vs tasks
  true-instant LA, `calendar/page.tsx:15-18`): kept, documented; render helpers
  centralized so the convention is applied once, not per-view (the fragility the
  audit flags).
- **Appointment with a guest that is a raw number (later resolves to a contact):**
  the guest chip shows the raw number now and re-resolves when the number is linked
  to a person (consistent with Spec 02's raw-participant handling).
- **Create appointment for a suppressed contact:** the invite send is suppression-
  checked (kept); the appointment record still saves (a calendar entry is not a
  message), but no invite goes out and the UI says so.
- **Empty day/week:** "nothing scheduled" with a create affordance.
- **DST boundary week:** the centralized time helper handles the wall-clock
  convention; appointments render at their stored wall-clock hour.

---

## 15. Feature — Approvals (one queue, wired feedback, kills D8 + the dup surface)

### 15.1 One queue
The first-touch approval lives in two places today: `/admin/crm/approvals` (with
preview/edit) and the `/workflows` board's Approve button (no preview)
(`§Duplication map`). Collapse to **one** Approvals queue (per arch §4.7: "one
queue with typed sub-streams"), surfaced on TODAY (shell-ia) and as a read-through
tab in `settings/automations`. Kept engine contract: approve sets
`first_touch_override`, honored at step 0 (`route.ts:338-340`); kept CMA-hold
awareness; kept per-lead ownership check (`crm.ts:1507-1514`).

### 15.2 Wired error feedback (kills D8)
Approve/edit/skip/dismiss use the §4.2 primitive — on failure (e.g. the ownership
check denies) the card shows an inline reason + Retry, not a page reload with the
card still there and no explanation (`§D8`). The divergent `?boardError=` (workflows)
vs console-only (approvals) channels are both deleted — one pattern.

### 15.3 States & edge cases
- **Two brokers approve the same first touch:** the ownership + status check
  serializes; the loser gets "already handled" inline, no double-send (the engine's
  at-most-once claim is the backstop anyway).
- **Approve a touch whose CMA link isn't built yet:** kept CMA-hold — the send
  parks (`route.ts` CMA-hold) and the queue shows "holding for CMA," not a failure.
- **Skip/dismiss:** removes from queue; the enrollment continues/stops per the
  action's kept semantics.
- **Empty queue:** "nothing awaiting approval."
- **Restricted broker:** sees only their own leads' approvals (`approvals:act`
  scope), not everyone's.

---

## 16. Feature — Broker identity in ONE place (kills the 5+ maps)

### 16.1 The problem
Broker identity is scattered across `CRM_BROKERS` (`constants.ts:11`),
`CRM_MAILBOXES` (`gmail.ts:29`), `BROKER_LINES` (`getGroupReplyParticipants.ts:30`
— 4 hardcoded numbers), the `brokers` table, `admin_roles`, the telephony map,
and `coerceBroker`/`DEFAULT_BROKER` (`ensureNativeLead.ts:43-45`) — **45 files**
import the two consts. Managing one teammate spans 3 pages
(Team → Brokers → `/admin/brokers/edit`, `§13`). This is RC4/RC5 for broker
identity.

### 16.2 The fix: one registry, one page
- **Source of truth:** the `brokers` table (slug, display_name, email, phone,
  photo, `crm_active`, `routing_eligible`, license, …) joined with `admin_roles`
  (role, `can_export`, `pause_leads`, `last_seen_at`). One DAL
  `getBrokerRegistry()` returns the unified `Broker[]` — slug, name, **mailbox**
  (from `brokers.email`), **twilio line** (from telephony/`brokers.phone`),
  headshot, role, and every flag. Cached, tagged `broker-registry`.
- **Every consumer reads the registry:** routing eligibility (§9, §10), mailbox
  resolution in the engine (`CRM_MAILBOXES` → `getBrokerRegistry`), caller-ID /
  group reply participant exclusion (Spec 02 deletes `BROKER_LINES` in favor of
  the registry's line set), merge context sender resolution, every broker picker
  (calendar/tasks/sequences), `coerceBroker` (validates against the registry, not
  a const).
- **Delete the consts** (`CRM_BROKERS`, `CRM_MAILBOXES`, `BROKER_LINES`) and the
  `DEFAULT_BROKER` literal fallback — the registry provides the list and the
  `matt` safe-default. This is a large mechanical refactor across 45 files;
  delegate the sweep to a subagent (Opus orchestrator policy) with the registry
  DAL as the single replacement target.
- **One page:** `settings/brokers` (§5.2) is the single roster — add/change/remove
  roles (kept `upsertAdminRole`/`removeAdminRole`), toggle `crm_active` /
  `routing_eligible` / `can_export` / `pause_leads` (all now real, §10), edit the
  broker **profile** (name/photo/license/bio — folding `/admin/brokers/edit` in),
  last-seen display. Managing a teammate is one page, not three. Also fixes the
  DAL-boundary violation (raw `createServiceClient().from()` inside `team/page.tsx:44-56`,
  `§13`) — all reads go through `getBrokerRegistry`.

### 16.3 States & edge cases
- **A broker in `admin_roles` with no `brokers` row (or vice versa):** the registry
  outer-joins and flags the mismatch in the UI ("role without a broker profile" /
  "broker without a login") so it is visible, not a silent partial identity.
- **Remove the last superuser:** refused, fail-closed (a shop must retain one
  owner).
- **Toggle a broker inactive while they own live leads/tasks:** allowed; their
  leads stay assigned (not auto-reassigned), routing stops sending them new ones,
  pickers mark them inactive.
- **Registry read fails:** consumers fail-safe — routing to `matt`, mailbox to the
  first active broker, pickers to a cached last-good list; never a crash.

---

## 17. Responsive behavior (one tree, cross-cutting)

Per §4.3, every surface here is **one** container-query tree authored mobile-first;
there is no `md:hidden` twin. Concretely:
- **Settings home:** section rail becomes a top segmented control on phone; each
  section is a single-column form on phone, two-column on desktop.
- **Automations list/editor:** the list is a stacked card list on phone, a
  10-column table on desktop (same component). The **visual editor canvas**, which
  has no mobile adaptation today (`§Mobile divergence`, 704+832-line desktop-
  geometry islands), degrades on phone to a **linear step list** (view + reorder +
  edit-step, not free-canvas drag) — authoring the graph is a desktop progressive
  enhancement, viewing/editing steps works on phone. This is the one place desktop
  genuinely affords more; it is the same tree with a canvas layer that only mounts
  at desktop width.
- **Tasks / Calendar:** §13, §14 — stacked list → grid/table progressive
  enhancement.
- **Routing / Brokers / Import:** single-column forms on phone; the import
  history/table stops hiding Rows/Imported/Skipped/Errors below `md`
  (`import/page.tsx:69-76`) — it reflows to stacked rows so phone users see the
  full record, not just Started/Status (`§Mobile divergence`).

Progressive-enhancement-only (desktop): the automation free-canvas, multi-column
task table density, calendar week/month grids. Everything functional exists on the
phone.

---

## 18. Performance

- **Settings home:** tab list from the static capability map (0 queries to paint);
  count badges cached + lazy — replaces 10 synchronous reads to paint a menu (`§1`).
- **Automations list:** `getWorkflowAnalytics` N+1 → one grouped cached aggregate
  (§6.4); 6 parallel fetches stream individually.
- **Sequence engine:** untouched (kept batching-50, per-run template cache, single
  person read, cron lease `route.ts:37,49-55,94-103,145-153`). The `resolved_plan`
  read is one column, no extra query.
- **CSV import:** serial in-request row writes → bounded batches across worker
  ticks (§11); no 60s wall, no page held open.
- **Tasks/Calendar:** two server-rendered trees → one (halves render + JS per
  route, arch §4.3); calendar's unused-on-desktop contact fetch removed (§14.2);
  tasks' double `getTaskQueue` collapsed (§13.3).
- **Mutations:** optimistic + entity-return, no `router.refresh()` full fan-out
  (§4.2) — the `/settings/brokers` per-toggle full reload (`§12`) is gone.
- **Time-trigger cron:** batched selects with dedupe ledger; daily, off the hot
  path.

---

## 19. Error handling & compliance

- **Fail-closed everywhere it matters (kept):** suppression at every send boundary
  (`route.ts:198,312`), hard-stop before any enroll (`enroll.ts:65-73,182-190`),
  A2P gate, quiet hours, unresolved-merge-token refusal, archived-template guard —
  **none touched** by this spec. The trigger cron's enroll actions inherit these.
- **Routing never crashes/hangs a lead-capture path:** kept fail-safe to `matt`
  (`lead-routing.ts:177-180`); the pond/group fixes keep this invariant.
- **Auth (§4.1):** every action + route handler guards in-body; `import:run` and
  `settings:manage`/`brokers:manage` are superuser; `export:run` additionally reads
  `can_export`. `ci:admin-authz` (Spec 01) fails the build on an unguarded mutating
  action in this domain.
- **Data-accuracy (C4):** where numbers show — enrollment counts, workflow
  analytics, import counts, task counts — each traces to one definition (the metric
  layer discipline, arch §4.5): analytics from the cached aggregate (§6.4), import
  counts from `crm_imports.counts`, task counts from `getTaskQueue`. No hand-rolled
  second count.
- **The trigger registry gate (§7.5)** and the **toggle-wired assertions (§10)** are
  the domain's RC6 backstops: a placebo cannot re-enter — either a build fails or
  the surface is not offered.

---

## 20. Acceptance criteria (writer → store → reader → outcome, proven end to end)

Per arch §8, a feature is done only when the round trip is proven with an
acceptance test. The domain-critical ones:

**Triggers (D1):**
- [ ] Configure "tag `audience:seller` added → enroll in Seller sequence." Add that
      tag to an **existing** contact (not at creation) → an enrollment row appears
      within one engine tick. (writer: tag-add action fires `fireTrigger`; store:
      `crm_sequence_enrollments`; reader: enrollment board; outcome: contact enrolled.)
- [ ] The authoring palette offers **exactly** the `status='live'` registry types;
      `inquiry` and `property_saved` are absent. Flip `property_saved` to `live`
      without its dispatcher → `ci:automation-triggers-wired` fails the build.
- [ ] Configure "no activity 30 days → task"; a contact idle 31 days gets exactly
      one task on the daily cron and **not** a second the next day (dedupe ledger).

**Conditions (D2):**
- [ ] A workflow `[s0, s1, COND{true:[a,b,c]}, s3]`, enrollment reaches the
      condition with the true branch → `a`, `b`, `c` all execute in order, then
      `s3` with its own delay. The enrollment board shows the person in the correct
      resolved-plan column at each step. (store: `resolved_plan`; reader: engine +
      board.)

**Routing (D3/D4/D5):**
- [ ] A Lead Flow with a price>750k rule targeting a broker: submit a lead with
      price 800k → routed to that broker (context threaded); submit 400k → flow
      default. (Both previously impossible — every conditional evaluated false.)
- [ ] A Lead Flow whose target was "pond": a new lead routes to a real fallback
      broker with a real assignee (never the silent Matt-with-null-pond_id path);
      "pond" is absent from the target picker.
- [ ] A group with a disabled member never rotates to that member; `first_to_claim`
      is absent from the group editor.

**Team toggles (D6):**
- [ ] Set broker Rebecca `can_export=false` → her export request 403s with a clear
      message and the button is hidden; superuser export still works.
- [ ] Set broker Paul `pause_leads=true` → new leads route around Paul; unset →
      Paul receives again. (reader: routing eligibility predicate.)

**CSV import (D7):**
- [ ] Import a 20k-row file → completes across multiple worker ticks, no timeout;
      re-run the same file → email-and-phone-matched rows merge, zero duplicates
      created (including phone-only rows).
- [ ] Kill the worker mid-import → status page shows "stalled" with Resume; Resume
      finishes from the persisted offset, no row 0 reprocessing, no dups.
- [ ] A row with `stage=Hot Lead` writes `stage=new` and appears in `error_rows`
      with a "defaulted" note — never an off-taxonomy stage.

**Surfaces (RC3/RC4/RC5):**
- [ ] Tasks and Calendar render one component tree; every action available on
      desktop is available on a 375px phone (create, snooze, reassign,
      bulk-complete on Tasks; create/edit appointment on Calendar).
- [ ] Automations is reachable under exactly one name; `/automations`,
      `/sequences`, `/workflows` either redirect to it or no longer exist.
- [ ] A restricted broker sees no Automations/Brokers/Import tab and, on a direct
      deep-link, gets a friendly access panel — never a rendered builder whose
      Saves all error "Superuser only," and never "this account does not have admin
      access."
- [ ] Broker identity resolves from one `getBrokerRegistry()`; `CRM_BROKERS`,
      `CRM_MAILBOXES`, `BROKER_LINES` are deleted (grep returns zero); managing a
      teammate happens on one page.

**Engine preserved (C5):**
- [ ] The sequence engine's send integrity is unchanged: at-most-once claims,
      suppression fail-closed, A2P/quiet-hours, CMA hold, merge-token refusal all
      still pass their existing checks after the `resolved_plan` change (regression
      suite green).

---

## 21. Open questions for Matt

- **OQ-1 — Shared lead ponds / claim-based distribution: build or drop?** Default
  in this spec is **drop** (a 3-broker shop doesn't need a claim queue; strategies +
  groups cover it; §9.4/§9.5 remove the two claim placebos non-destructively). If
  you want a shared pool where the first broker to accept wins, that's a real
  build — the pond queue UI + `claimPondLeadAction` wiring + group `first_to_claim`.
  Your call.
- **OQ-2 — inactivity + calendar_date triggers now, or later?** They're genuinely
  useful (a "no contact in 30 days → task" nudge, a purchase-anniversary touch) but
  they need one new daily cron (§7.4). Ship them in this spec, or defer and ship
  the 5 event triggers first?
- **OQ-3 — `deal_stage_changed` dispatcher lands with Spec 05 (Transactions).**
  Confirm the registry row stays `live` only once that one call site exists — i.e.
  this trigger is offered starting when Deals ships, not before. (The gate enforces
  no-orphan either way.)
- **OQ-4 — `property_saved` waits on Spec 08 (Consumer funnel).** It's the
  strongest buyer signal (RC7) but its writer is the saved-home→CRM-intent hook.
  Confirm we keep it `disabled` until Spec 08, then flip it on.
- **OQ-5 — import auto-enroll default.** Imports currently skip routing + enroll
  (outreach-list intent). The rebuilt wizard surfaces an opt-in checkbox (§11.3,
  default off). Confirm off-by-default is right, or should certain sources
  auto-enroll?
- **OQ-6 — `pause_leads` scope.** Should pausing a broker also pause the group RR
  that includes them (yes, per §9.5/§10), and should it surface a visible "Paused"
  chip on that broker everywhere they appear (tasks/calendar pickers, roster)?
  Default: yes to both.
