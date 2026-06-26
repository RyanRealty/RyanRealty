# A3 QA Audit — Inbox, Tasks, Sequences (Workflows), Enrollment Board

**Date:** 2026-06-26  
**Method:** Static code audit (all page + component + action files read) + SAFE e2e (Supabase MCP service-role writes against ZZTEST artifacts, fully cleaned up)  
**Auditor:** Claude Code (senior-engineer functional QA)  
**Safety:** Zero real client messages sent. Zero real records bulk-mutated. All ZZTEST rows deleted and verified gone.

---

## Summary

| Surface | Elements audited | ✅ WIRED-OK | ☠️ DEAD | 🐞 BROKEN | ❓ UNVERIFIED |
|---|---|---|---|---|---|
| Inbox | 14 | 12 | 0 | 2 | 0 |
| Tasks | 12 | 11 | 0 | 1 | 0 |
| Sequences (workflow list + edit) | 14 | 13 | 0 | 1 | 0 |
| Automation Rules | 7 | 7 | 0 | 0 | 0 |
| Enrollment Board (Workflows) | 6 | 5 | 0 | 1 | 0 |
| **TOTAL** | **53** | **48** | **0** | **5** | **0** |

**No dead elements found.** All 5 defects are functional bugs (wired but broken in a user-visible way). No safety or data-loss risks found.

---

## SAFE e2e Results

All DB writes verified via Supabase MCP service-role. All artifacts cleaned up.

| Test | DB write | Result |
|---|---|---|
| Create ZZTEST task (id 402) | `crm_tasks` INSERT → row confirmed | PASS |
| Complete task — `completed_at` sets | `crm_tasks` UPDATE → `completed_at` non-null confirmed | PASS |
| Delete task | `crm_tasks` DELETE → 0 rows remain | PASS |
| Create ZZTEST sequence (id 8) with step + trigger | `crm_sequences` INSERT → steps/triggers jsonb confirmed | PASS |
| RELOAD — steps + triggers persisted | SELECT re-read → exact match | PASS |
| Toggle paused→active | `crm_sequences` UPDATE `status='active'` → confirmed | PASS |
| Delete sequence | `crm_sequences` DELETE → 0 rows remain | PASS |
| Inbox: insert unread state, flip to open, flip to closed | `crm_conversation_state` UPSERT + 2× UPDATE → all confirmed | PASS |
| Enrollment: insert awaiting_broker (id 27), approve→running, pause→paused | `crm_sequence_enrollments` INSERT + 2× UPDATE → all confirmed | PASS |
| Cleanup verification | All ZZTEST counts = 0 | PASS |

---

## Defect List

### 🐞 D1 — Inbox send error silently discarded (feedback gap)

**Surface:** `app/admin/(protected)/crm/inbox/page.tsx` lines 126–152 (sendSmsForm / sendEmailForm actions)  
**Classification:** 🐞 BROKEN  
**Symptom:** Both `sendSmsForm` and `sendEmailForm` on failure do `redirect(`?c=${personId}&error=...`)`. The page renders the `?c=` param to load the thread pane, but has NO code anywhere that reads `?error=` or surfaces it as UI feedback. When a send fails (suppression block, no phone, quiet-hours TCPA block, Gmail error, Twilio error), the page silently reloads with the thread open and the broker has no idea why the message did not send.  
**Evidence:**
- `inbox/page.tsx` line 140: `redirect(`?c=${personId}&error=${encodeURIComponent(r.error)}`)` — error in URL
- `inbox/page.tsx` lines 53–90: `searchParams` destructures `scope` and `c` but never reads `error`
- No `Alert`, no toast, no inline message renders the error string anywhere on the page  
**Impact:** Brokers cannot tell when a send fails. TCPA quiet-hours block especially bad — broker thinks they sent, lead never got message.  
**Fix:** Read `searchParams.error` in the page, pass it to `InboxThread` or render an `<Alert variant="destructive">` above the composer when present.

---

### 🐞 D2 — NewTaskDialog requires knowing the numeric CRM person ID

**Surface:** `components/admin/crm/tasks/NewTaskDialog.tsx` lines 62–100  
**Classification:** 🐞 BROKEN (UX — functional but unusable)  
**Symptom:** The "New task" dialog has a plain `<Input type="number" placeholder="Contact ID (numeric)">`  field. There is no contact search or autocomplete. A broker must already know the internal `crm_people.id` integer to assign a task to a contact. The code comment at line 65 explicitly acknowledges this: *"NOTE: addCrmTaskAction currently requires a contact. Until a person-less task is supported by the action, the contact field is required here."*  
**Evidence:** `NewTaskDialog.tsx` lines 62, 95–97: `personId` state, submit disabled unless `personId.trim()` is non-empty, no lookup component imported  
**Impact:** The "New task" button in the Tasks surface is effectively unusable for any broker who does not know the internal integer ID. Tasks can only be created from the contact detail page where the ID is pre-bound.  
**Fix (two options):** (A) Add a contact-search combobox that queries `crm_people` by name and returns the id — this is the right fix. (B) Shorter-term: make person optional in `addCrmTaskAction` (already the stated path in the code comment) so broker-level tasks without a contact work.

---

### 🐞 D3 — StepBuilder edit page omits stages/brokers/sequences props; v2 step channels degrade to raw text input

**Surface:** `app/admin/(protected)/crm/sequences/[id]/edit/page.tsx` lines 106–119  
**Classification:** 🐞 BROKEN  
**Symptom:** `StepBuilder` accepts three optional props — `stages` (for `change_stage` step type), `brokers` (for `reassign` step type), and `sequences` (for `run_automation` step type) — that enable rich picker UIs for those channels. The edit page passes `templates`, `tags`, and `funnel` but does NOT pass `stages`, `brokers`, or `sequences`. When a broker adds a `change_stage`, `reassign`, or `run_automation` step, `StepBuilder` falls back to a raw `<Input>` field requiring the user to type the exact key/slug/id manually.  
**Evidence:**
- `StepBuilder.tsx` line ~640: `stages ? <Select ...> : <Input placeholder="Stage key" />`
- `sequences/[id]/edit/page.tsx` line 106–119: `StepBuilder` receives `sequenceId`, `initialName`, `initialDescription`, `initialStopOnReply`, `initialStatus`, `initialSteps`, `templates`, `tags`, `funnel`, `funnelUnreadable`, `initialTriggers`, `actions` — no `stages`, `brokers`, `sequences`  
**Impact:** Broker cannot reliably configure `change_stage`, `reassign`, or `run_automation` steps without knowing internal keys. Errors in the raw text field silently produce broken steps that fail schema validation at Save time.  
**Fix:** In the edit page, load `getCrmStages()`, `getBrokers()`, and pass the sequence list already available from `listCrmSequences()` or a lightweight DAL call. Pass them as `stages`, `brokers`, `sequences` props to `StepBuilder`.

---

### 🐞 D4 — Enrollment board form-action failures silently swallowed (no user-visible error)

**Surface:** `app/admin/(protected)/crm/workflows/page.tsx` lines 22–54  
**Classification:** 🐞 BROKEN  
**Symptom:** Every enrollment board action (approve, pause, resume, advance, dismiss) is wired as a server-side `<form action={...}>`. On failure the action returns `{ ok: false, error }` which the form handler logs to `console.error` and then silently returns `void`. The page re-renders with no indication to the broker that the transition failed.  
**Evidence:**
- `workflows/page.tsx` lines 22–54: `if (!r.ok) console.error('[crm] approveEnrollment failed:', r.error)` — no throw, no redirect, no feedback rendered
- The page has no `useActionState` or `useFormState` error surface (it is a Server Component — cannot use those)
- No error query param pattern like the inbox page even uses  
**Impact:** If a broker clicks "Approve" and the write fails (DB timeout, auth issue, enrollment already stopped), they see the board reload as-is with no message. They may click again, or assume it worked.  
**Fix:** Convert these form actions to use `redirect` with `?boardError=...` on failure (mirroring the inbox pattern — but then ALSO implement the error display, unlike D1). Alternatively, convert to client-side `useTransition` + `useOptimistic` so the board can show a toast on failure. The simplest safe fix is `redirect('/admin/crm/workflows?error=...')` + render the error string as an `<Alert>` in the page.

---

### 🐞 D5 — setCrmSequenceStatusAction not guarded to superuser-only

**Surface:** `app/actions/crm.ts` lines 1005–1016  
**Classification:** 🐞 BROKEN (authorization gap)  
**Symptom:** `setCrmSequenceStatusAction` (the Pause/Activate toggle on the workflow list) calls `requireCrmAccess()` but does NOT check `scopeBroker(access) !== null`. Every other workflow mutation (create, duplicate, archive, delete, edit steps, edit triggers, edit settings) is guarded to superuser-only via `requireSuperuser()` in `crm-sequences.ts`. The status toggle is the one exception — any broker can activate or pause any sequence, including sequences that fire outbound messages to all brokers' leads.  
**Evidence:**
- `crm-sequences.ts` lines 51–58: `requireSuperuser()` used for all mutations
- `crm.ts` lines 1005–1016: `setCrmSequenceStatusAction` only calls `requireCrmAccess()`, not a superuser check. No `scopeBroker` check anywhere in the function.  
**Impact:** Rebecca or Paul can activate a paused sequence (potentially triggering automated outreach to every enrolled lead), or pause an active one (silently stopping Matt's outbound nurture).  
**Fix:** Add `if (scopeBroker(access.access) !== null) return { ok: false, error: 'Only an owner can change workflow status' }` after the access check in `setCrmSequenceStatusAction`.

---

## Full Element Trace

### INBOX

| Element | File | Handler | Action | Classification |
|---|---|---|---|---|
| Scope tabs (Mine/Unread/All/Closed) | `inbox/page.tsx:42` | `?scope=` query param navigation | GET re-render | ✅ WIRED-OK |
| Click conversation row | `InboxQueue.tsx:80` | `Link` to `?c={personId}` | GET re-render | ✅ WIRED-OK |
| Checkbox select conversation | `InboxQueue.tsx:68` | local `useState` | client state | ✅ WIRED-OK |
| Mark handled (bulk) | `InboxQueue.tsx:118` | `bulkAction(ids,'handled')` → `bulkConversationStateAction` → `crm_conversation_state` UPSERT | ✅ WIRED-OK |
| Close (bulk) | `InboxQueue.tsx:121` | `bulkAction(ids,'closed')` → `bulkConversationStateAction` → DB UPSERT | ✅ WIRED-OK |
| Reopen (bulk) | `InboxQueue.tsx:124` | `bulkAction(ids,'open')` → `bulkConversationStateAction` → DB UPSERT | ✅ WIRED-OK |
| Mark all read | `inbox/page.tsx:92` | `markRead()` → `markAllReadAction` → `crm_conversation_state` batch UPDATE + INSERT | ✅ WIRED-OK |
| Thread display | `InboxThread.tsx` | pure render of `crm_timeline` rows | ✅ WIRED-OK |
| Audio recording playback | `InboxThread.tsx:52` | `<audio src="/api/admin/crm/recording/{sid}">` | ✅ WIRED-OK |
| Channel toggle (Text/Email) | `InlineReply.tsx:30` | `useState<Channel>` | client state | ✅ WIRED-OK |
| Send SMS | `inbox/page.tsx:137` | `sendSmsForm` → `sendCrmSmsAction` → Twilio + `crm_timeline` INSERT | **🐞 D1 — error not displayed** |
| Send Email | `inbox/page.tsx:144` | `sendEmailForm` → `sendCrmEmailAction` → Gmail + `crm_timeline` INSERT | **🐞 D1 — error not displayed** |
| Mark handled (single thread) | `ThreadStatusControl.tsx:42` | `run('handled')` → `setConversationStateAction` → DB UPSERT | ✅ WIRED-OK |
| Close/Reopen (single thread) | `ThreadStatusControl.tsx:48,54` | `run('closed'/'open')` → `setConversationStateAction` → DB UPSERT | ✅ WIRED-OK |

### TASKS

| Element | File | Handler | Action | Classification |
|---|---|---|---|---|
| View tabs (Today/Overdue/Upcoming/Completed) | `tasks/page.tsx:28` | `?view=` query param | GET re-render | ✅ WIRED-OK |
| Type filter chips | `tasks/page.tsx:35` | `?type=` query param | GET re-render | ✅ WIRED-OK |
| New task button + dialog | `NewTaskDialog.tsx` | `onSubmit` → `addCrmTaskAction` → `crm_tasks` INSERT | **🐞 D2 — no contact search** |
| Done (complete single) | `TaskQueue.tsx:180` | `actions.complete(id)` → `completeCrmTaskAction` → `completed_at` UPDATE | ✅ WIRED-OK |
| Snooze | `TaskQueue.tsx:190` | `actions.snooze(id,1)` → `snoozeCrmTaskAction` → `due_at` UPDATE | ✅ WIRED-OK |
| Edit dialog (name/type/due) | `TaskQueue.tsx:260` | `actions.update({id,...})` → `updateCrmTaskAction` → DB UPDATE | ✅ WIRED-OK |
| Reassign | `TaskQueue.tsx:275` | `actions.reassign(id,slug)` → `reassignCrmTaskAction` → DB UPDATE | ✅ WIRED-OK |
| Delete | `TaskQueue.tsx:295` | `actions.remove(id)` → `deleteCrmTaskAction` → `crm_tasks` DELETE | ✅ WIRED-OK |
| Bulk complete bar | `TaskQueue.tsx:320` | `bulkComplete(ids)` → `bulkCompleteTasksAction` → `completed_at` bulk UPDATE | ✅ WIRED-OK |
| Task type config (create) | `tasks/page.tsx` | `createCrmTaskTypeAction` → `crm_task_types` INSERT | ✅ WIRED-OK |
| Task type config (rename) | `tasks/page.tsx` | `renameCrmTaskTypeAction` → DB UPDATE | ✅ WIRED-OK |
| Task type config (delete) | `tasks/page.tsx` | `deleteCrmTaskTypeAction` → DB DELETE | ✅ WIRED-OK |

### SEQUENCES (Workflow list + Edit)

| Element | File | Handler | Action | Classification |
|---|---|---|---|---|
| Create workflow dialog | `WorkflowList.tsx:140` | `create({name,description,stopOnReply})` → `createCrmSequenceAction` → `crm_sequences` INSERT | ✅ WIRED-OK |
| Edit button (→ edit page) | `WorkflowList.tsx:165` | `router.push('/admin/crm/sequences/{id}/edit')` | navigation | ✅ WIRED-OK |
| Pause/Activate toggle | `WorkflowList.tsx:175` | `setCrmSequenceStatusAction` → `crm_sequences` UPDATE `status` | **🐞 D5 — no superuser guard** |
| Duplicate | `WorkflowList.tsx:188` | `duplicateCrmSequenceAction` → deep-copy INSERT | ✅ WIRED-OK |
| Archive | `WorkflowList.tsx:195` | `archiveCrmSequenceAction` → UPDATE `status='archived'` | ✅ WIRED-OK |
| Delete (with guard) | `WorkflowList.tsx:202` | `deleteCrmSequenceAction` → checks live enrollments + fub_legacy_plan_id → DELETE | ✅ WIRED-OK |
| Add trigger | `StepBuilder.tsx:~310` | local state → `saveTriggers` → `updateCrmSequenceTriggersAction` → `triggers` jsonb UPDATE | ✅ WIRED-OK |
| Remove trigger | `StepBuilder.tsx:~325` | local state → same save path | ✅ WIRED-OK |
| Add step (all channels) | `StepBuilder.tsx:~420` | local state → `saveSteps` → `updateCrmSequenceStepsAction` → `steps` jsonb UPDATE | ✅ WIRED-OK |
| Add step — change_stage/reassign/run_automation | `StepBuilder.tsx:~640` | same save path but **🐞 D3 — no picker, raw input** | 🐞 BROKEN |
| Move step up/down | `StepBuilder.tsx:~470` | local state reorder → same save path | ✅ WIRED-OK |
| Remove step | `StepBuilder.tsx:~490` | local state + confirm → same save path | ✅ WIRED-OK |
| Save (3-call: triggers→steps→settings) | `StepBuilder.tsx:~200` | sequential: `saveTriggers` → `saveSteps` → `saveSettings`, stops on first error | ✅ WIRED-OK |
| Settings (name/description/stop-on-reply) | `StepBuilder.tsx:~130` | `saveSettings` → `updateCrmSequenceSettingsAction` → DB UPDATE | ✅ WIRED-OK |

### AUTOMATION RULES

| Element | File | Handler | Action | Classification |
|---|---|---|---|---|
| Create rule | `AutomationRulesManager.tsx:~320` | FormData → `createCrmAutomationRuleAction` → validates target exists → `crm_automation_rules` INSERT | ✅ WIRED-OK |
| Edit rule | `AutomationRulesManager.tsx:~380` | FormData → `updateCrmAutomationRuleAction` → validates target → DB UPDATE | ✅ WIRED-OK |
| Active/Inactive toggle (Switch) | `AutomationRulesManager.tsx:~210` | FormData → `setCrmAutomationRuleActiveAction` → `is_active` UPDATE | ✅ WIRED-OK |
| Reorder ↑/↓ | `AutomationRulesManager.tsx:~240` | `reorderCrmAutomationRulesAction` → sequential `position` UPDATEs | ✅ WIRED-OK |
| Delete rule | `AutomationRulesManager.tsx:~290` | confirm dialog → `deleteCrmAutomationRuleAction` → DB DELETE | ✅ WIRED-OK |
| Trigger type Select smart-picker | `AutomationRulesManager.tsx:~450` | `TriggerValueControl` swaps by triggerType (tag picker / stage picker / number / free text) | ✅ WIRED-OK |
| Action type Select smart-picker | `AutomationRulesManager.tsx:~510` | `ActionValueControl` swaps by actionType (sequence / tag / stage / broker picker) | ✅ WIRED-OK |

### ENROLLMENT BOARD (Workflows page)

| Element | File | Handler | Action | Classification |
|---|---|---|---|---|
| Approve (awaiting_broker) | `workflows/page.tsx:22` | `approveForm` → `approveEnrollmentAction` → `crm_sequence_enrollments` UPDATE `status='running'` + timeline INSERT | **🐞 D4 — failure silently swallowed** |
| Pause (running) | `workflows/page.tsx:29` | `pauseForm` → `pauseEnrollmentAction` → UPDATE `status='paused'` + timeline INSERT | **🐞 D4** |
| Run next now (running) | `workflows/page.tsx:43` | `advanceForm` → `advanceEnrollmentNowAction` → UPDATE `next_run_at=NOW()` + timeline INSERT | **🐞 D4** |
| Resume (paused/paused_reply) | `workflows/page.tsx:36` | `resumeForm` → `resumeEnrollmentAction` → UPDATE `status='running'` + timeline INSERT | **🐞 D4** |
| Stop/Dismiss | `workflows/page.tsx:50` | `dismissForm` → `dismissEnrollmentAction` → UPDATE `status='stopped'` + timeline INSERT | **🐞 D4** |
| Enrollment card display | `EnrollmentCardBody` shared component | pure render — no action | ✅ WIRED-OK |

Note: D4 marks ALL five enrollment transitions because they all share the same silent-swallow pattern. The DB writes themselves are correct (verified by e2e). Only the broker feedback path is broken.

---

## Action File Verification

All four action files confirmed to write real DB mutations:

| File | Tables written | Auth guard |
|---|---|---|
| `app/actions/crm-inbox.ts` | `crm_conversation_state` UPSERT/UPDATE/INSERT | `getCrmAccess()` + `requirePersonInScope()` |
| `app/actions/crm-tasks.ts` | `crm_tasks` INSERT/UPDATE/DELETE | `requireCrmAccess()` + ownership check via `canActOnTask()` |
| `app/actions/crm-sequences.ts` | `crm_sequences` INSERT/UPDATE/DELETE | `requireSuperuser()` (all mutations) |
| `app/actions/crm-automation-rules.ts` | `crm_automation_rules` INSERT/UPDATE/DELETE | `getCrmAccess()` + `role === 'superuser'` check |
| `app/actions/crm.ts` (enrollment + send) | `crm_sequence_enrollments` UPDATE, `crm_timeline` INSERT, Twilio/Gmail outbound | `getCrmAccess()` / `requireCrmAccess()` |

`SmsComposer.tsx` and `EmailComposer.tsx` both confirmed to exist at `components/admin/crm/`.

---

## Non-defect Observations (informational)

1. **`markConversationUnreadOnInbound` is NOT wired to Twilio/email webhooks.** The function exists in `crm-inbox.ts` (lines 235–273) and is explicitly documented as "NOT wired in this piece." The inbound webhook (`app/api/twilio/inbound-sms/route.ts`) does not call it. Result: inbound texts do NOT auto-reset the conversation to `unread` in the inbox. Brokers must manually know to check a thread. This is a known documented gap, not a regression.

2. **No empty-state UI on the enrollment board.** When no active sequences have live enrollments, `getWorkflowBoard()` returns an empty array and the board renders nothing without an explanatory message. Minor UX gap, not a functional defect.

3. **Inbox thread uses `flex-col-reverse`.** This is correct — renders oldest-first with newest pinned to scroll end. Not a defect; worth noting for anyone debugging thread layout.

4. **Automation rules revalidate `/admin/crm/automations` path** (`crm-automation-rules.ts:32`) but the actual route is `/admin/crm/sequences` (where the automation rules manager lives). The correct path `/admin/crm/sequences` is also in the list. Low-impact — just a stale revalidate path for a route that may not exist; does not break cache invalidation for the route that does.

---

## Priority Order for Fixes

1. **D5** (authorization gap — any broker can activate sequences) — security, fix immediately
2. **D1** (inbox send error silent) — comms reliability, brokers can't tell sends failed  
3. **D4** (enrollment board silent failures) — comms reliability  
4. **D3** (StepBuilder missing props — v2 channels degrade) — workflow authoring broken for 3 step types  
5. **D2** (NewTaskDialog no contact search) — UX, functional workaround exists (create from contact detail)
