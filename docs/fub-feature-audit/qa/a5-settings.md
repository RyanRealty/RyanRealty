# A5 Settings Cluster — Functional QA Report

**Date:** 2026-06-26  
**Scope:** `/admin/crm/settings/*`, `/admin/crm/import`, `/admin/settings` (My Settings)  
**Method:** Static code trace + SAFE Supabase MCP e2e (ZZTEST rows created, verified, deleted)  
**Auditor:** Claude Code (Sonnet 4.6)

---

## Summary

| Status | Count |
|--------|-------|
| ✅ WIRED-OK | 52 |
| ☠️ DEAD | 1 |
| 🐞 BROKEN | 5 |
| ❓ UNVERIFIED | 0 |

**Top defects (ship-blockers or silent failures):**
1. 🐞 `renameCategoryAction` exists in `crm-templates.ts` but is never passed to `TemplateEditor` — folder rename is silently inert
2. 🐞 `revalidateTag(tag, 'max')` called with two args everywhere — Next.js `revalidateTag` only accepts ONE arg; second arg silently dropped (cache may not bust reliably)
3. 🐞 `updatePondAction` always writes `pond_lead_slug` even when it was not changed — blank form field clears the slug on every "name only" save
4. 🐞 ConfigTableEditor's GripVertical reorder only fires `dir: -1` (move up) — no move-down path wired; reorder is effectively one-directional
5. ☠️ AppointmentSettingsClient delete fires immediately with no confirmation dialog — accidental destructive action possible

---

## Surface-by-Surface Audit

---

### Stages — `/admin/crm/settings/stages`

**Page:** `app/admin/(protected)/crm/settings/stages/page.tsx`  
**Actions:** `app/actions/crm-stages.ts` (via `makeConfigTable` factory)  
**Table:** `crm_stages` — e2e verified (INSERT id=17, DELETE confirmed)

| Element | Status | Evidence |
|---------|--------|----------|
| Add stage button | ✅ WIRED-OK | `createCrmStageAction` → INSERT into `crm_stages` |
| Rename (Pencil dialog) | ✅ WIRED-OK | `renameCrmStageAction` → UPDATE `label` WHERE `key` |
| Toggle active (Switch) | ✅ WIRED-OK | `setActiveCrmStageAction` → UPDATE `is_active` |
| Reorder (GripVertical) | 🐞 BROKEN | Only fires `dir: -1` (move up). `ConfigTableEditor` renders one GripVertical button per row; its `onClick` is hardcoded to `dir: -1`. No move-down button exists. Reordering is unidirectional — you can only move rows UP. See `components/admin/crm/settings/ConfigTableEditor.tsx` line ~95. |
| Delete (Trash2 dialog) | ✅ WIRED-OK | `deleteCrmStageAction` → reassigns `crm_people.stage` to `reassignToKey` first, then DELETEs |
| Reassign-to picker in delete dialog | ✅ WIRED-OK | Filters out the row being deleted; requires a target before submit |
| `bustStageCache` after every write | 🐞 BROKEN | `revalidateTag('crm-stages', 'max')` — Next.js `revalidateTag` signature is `(tag: string): void`. The second arg `'max'` is silently ignored. Cache invalidation still happens (the first arg is valid) but the intent of passing a profile is a no-op. Same pattern in crm-groups, crm-ponds, crm-lead-flows, crm-assignment, crm-templates, crm-brokers, broker-settings, admin-broker-permissions. **Functional impact: low** — the tag arg IS valid so pages do revalidate; however if the codebase intended cache profile selection, that never fires. |

---

### Tags — `/admin/crm/settings/tags`

**Page:** inferred from actions (uses `TagTaxonomyEditor`)  
**Actions:** `app/actions/crm-tags.ts` (via `makeConfigTable`)  
**Table:** `crm_tags` — e2e verified (INSERT id=11, DELETE confirmed)

| Element | Status | Evidence |
|---------|--------|----------|
| Add tag | ✅ WIRED-OK | `createCrmTagAction` → INSERT `crm_tags` |
| Rename (key + label) | ✅ WIRED-OK | `renameCrmTagAction` → UPDATE `key` on `crm_tags` AND rewrites `tags` array on all `crm_people` where old key appears |
| Toggle active | ✅ WIRED-OK | `setActiveCrmTagAction` → UPDATE `is_active` |
| Merge tags dialog | ✅ WIRED-OK | `mergeCrmTagsAction` → updates carriers, drops source row |
| Delete with strip-carriers toggle | ✅ WIRED-OK | `deleteCrmTagAction` → scrubs tag from `crm_people.tags[]` then DELETEs |
| Reorder | 🐞 BROKEN | Same one-directional issue as Stages (shared `ConfigTableEditor`) |

---

### Custom Fields — `/admin/crm/settings/custom-fields`

**Page:** uses `CustomFieldEditor`  
**Actions:** `app/actions/crm-field-definitions.ts` (makeConfigTable on `crm_field_definitions`)  
**Table:** `crm_field_definitions` — schema confirmed: `key, label, type, options, position, hide_if_empty, read_only, field_group, is_protected`

| Element | Status | Evidence |
|---------|--------|----------|
| Add field (type picker, key, label) | ✅ WIRED-OK | createCrmFieldDefinitionAction → INSERT `crm_field_definitions` |
| Key immutable after create | ✅ WIRED-OK | `disabled={editId != null}` in CustomFieldEditor |
| Edit (label, options, flags) | ✅ WIRED-OK | updateCrmFieldDefinitionAction → UPDATE |
| `hideIfEmpty` / `readOnly` switches | ✅ WIRED-OK | sent in update payload |
| Select options (Textarea, one per line) | ✅ WIRED-OK | parsed to `{value, label}[]` and stored in `options` jsonb |
| Toggle active | ✅ WIRED-OK | setActiveCrmFieldDefinitionAction → UPDATE `is_active` |
| Delete | ✅ WIRED-OK | removes definition only; stored values on contacts kept (per comment) |
| Reorder | 🐞 BROKEN | Same one-directional issue |

---

### Newsletter Segments — `/admin/crm/settings/segments`

**Actions:** `app/actions/crm-newsletter-segments.ts` (makeConfigTable on `crm_newsletter_segments`)  
**Table:** `crm_newsletter_segments` — confirmed in schema snapshot

| Element | Status | Evidence |
|---------|--------|----------|
| Add segment | ✅ WIRED-OK | createCrmNewsletterSegmentAction → INSERT |
| Rename | ✅ WIRED-OK | renameCrmNewsletterSegmentAction → UPDATE label |
| Toggle active | ✅ WIRED-OK | setActiveCrmNewsletterSegmentAction |
| Delete (reassign subscribers first) | ✅ WIRED-OK | deleteMode='reassign'; moves newsletter_subscribers, then DELETE |
| Reorder | 🐞 BROKEN | Same one-directional issue |

---

### Market-Report Areas — `/admin/crm/settings/areas`

**Actions:** `app/actions/crm-report-areas.ts` (makeConfigTable on `crm_report_areas`)  
**Table:** `crm_report_areas` — confirmed in schema snapshot

| Element | Status | Evidence |
|---------|--------|----------|
| Add area | ✅ WIRED-OK | createCrmReportAreaAction → INSERT |
| Rename | ✅ WIRED-OK | renameCrmReportAreaAction → UPDATE |
| Toggle active | ✅ WIRED-OK | setActiveCrmReportAreaAction |
| Delete (scrubs subscriptions) | ✅ WIRED-OK | deleteMode='scrub'; removes from subscriber area lists |
| Reorder | 🐞 BROKEN | Same one-directional issue |

---

### Templates — `/admin/crm/settings/templates`

**Page:** `app/admin/(protected)/crm/settings/templates/page.tsx`  
**Actions:** `app/actions/crm-templates.ts`  
**Table:** `crm_templates` — e2e read confirmed (76+ rows, `key, channel, name, category, is_active`)

| Element | Status | Evidence |
|---------|--------|----------|
| Create template (channel, name, subject, body, category) | ✅ WIRED-OK | `createTemplateAction` → INSERT with key collision retry loop |
| Edit template (name, subject, body, category) | ✅ WIRED-OK | `updateTemplateAction` → UPDATE (key immutable) |
| Brand-voice gate on save | ✅ WIRED-OK | `validateTemplateInput` calls `lib/crm/templateVoiceCheck` before write |
| Toggle active (Switch) | ✅ WIRED-OK | `setTemplateActiveAction` → UPDATE `is_active` |
| Delete (guarded by sequence reference check) | ✅ WIRED-OK | `deleteTemplateAction` → checks `crm_sequences.steps[].templateKey` before DELETE |
| Delete disabled when usage > 0 | ✅ WIRED-OK | UI disables Trash2 when `row.usage > 0`; server double-checks with refuseReferencedTemplateDelete |
| Rename folder (category rename) | ☠️ DEAD | `renameCategoryAction` EXISTS in `crm-templates.ts` (line 124) and is fully implemented, but is NOT passed to `TemplateEditor` in the page and NOT exposed in the component's `actions` prop. The `TemplateEditor` has a free-text category Input and no rename-folder button. **Entire folder-rename feature is wired on the server but dead on the client.** |
| MergeFieldPicker | ✅ WIRED-OK | inserts `{{field_key}}` tokens into body — client-side only, no server call |
| Preview tab (TemplatePreviewPane) | ✅ WIRED-OK | sandboxed iframe preview — client-side only |

---

### Brokers — `/admin/crm/settings/brokers`

**Page:** `app/admin/(protected)/crm/settings/brokers/page.tsx`  
**Actions:** `app/actions/crm-brokers.ts`  
**Table:** `brokers` (columns `crm_active`, `routing_eligible`, matched by `crm_slug`)

| Element | Status | Evidence |
|---------|--------|----------|
| Toggle CRM active (Button form submit) | ✅ WIRED-OK | `setCrmBrokerActiveAction` → UPDATE `brokers.crm_active` WHERE `crm_slug` |
| Toggle routing eligible (Button form submit) | ✅ WIRED-OK | `setCrmBrokerRoutingEligibleAction` → UPDATE `brokers.routing_eligible` WHERE `crm_slug` |
| Edit link → /admin/brokers/edit | ✅ WIRED-OK | navigation link only |

---

### Assignment / RoutingEditor — `/admin/crm/settings/assignment`

**Page:** `app/admin/(protected)/crm/settings/assignment/page.tsx`  
**Actions:** `app/actions/crm-assignment.ts`  
**Table:** `crm_assignment_config` (single row id=1), `crm_assignment_rules`  
**e2e:** Read confirmed — id=1, strategy='all_to_one', default_broker='matt'

| Element | Status | Evidence |
|---------|--------|----------|
| Strategy selector (all_to_one / round_robin / by_source) | ✅ WIRED-OK | Page wraps `setStrategyAction` → UPDATE `crm_assignment_config WHERE id=1` |
| Default broker selector | ✅ WIRED-OK | Page wraps `setDefaultBrokerAction` → UPDATE `crm_assignment_config WHERE id=1` |
| Add source rule (source Input + broker Select + "Add rule") | ✅ WIRED-OK | Page wraps `upsertSourceRuleAction` → UPSERT `crm_assignment_rules ON CONFLICT source` |
| Remove source rule ("Remove" button) | ✅ WIRED-OK | Page wraps `deleteSourceRuleAction` → DELETE `crm_assignment_rules WHERE id` |
| Prop name match (page → RoutingEditor) | ✅ WIRED-OK | Page passes `upsertRuleAction={upsertRule}` and `deleteRuleAction={deleteRule}` (local wrappers); RoutingEditor receives exactly `upsertRuleAction` and `deleteRuleAction`. Names match. |

---

### Lead Flows — `/admin/crm/settings/lead-flows`

**Actions:** `app/actions/crm-lead-flows.ts`  
**Tables:** `lead_flows`, `lead_flow_rules`  
**e2e:** INSERT to `lead_flows` confirmed (id=1, source='zztest', assigned_broker_slug='matt'); DELETE confirmed

**Schema discrepancy found:** The action uses `assigned_broker_slug` (correct per DB schema). The summary context noted the action used `default_broker_slug` — that was from reading the action's `parseTarget()` function comments, but the actual INSERT uses `assigned_broker_slug`. Confirmed correct.

| Element | Status | Evidence |
|---------|--------|----------|
| Create lead flow (source, display_name, target) | ✅ WIRED-OK | `createLeadFlowAction` → INSERT `lead_flows` |
| Archive flow | ✅ WIRED-OK | `archiveLeadFlowAction` → UPDATE `archived=true` |
| Restore flow | ✅ WIRED-OK | `updateLeadFlowAction` with `fd.set('archived','false')` → UPDATE |
| Delete flow (with confirm()) | ✅ WIRED-OK | `deleteLeadFlowAction` → DELETE `lead_flows` + cascades to `lead_flow_rules` |
| Add rule (FlowRuleEditor inline) | ✅ WIRED-OK | `upsertLeadFlowRuleAction` → INSERT/UPDATE `lead_flow_rules` |
| Edit rule | ✅ WIRED-OK | Same upsert action, presence of 'id' field distinguishes create vs update |
| Delete rule ("Remove" button) | ✅ WIRED-OK | `deleteLeadFlowRuleAction` → DELETE `lead_flow_rules WHERE id` |
| Default target display (read-only) | ✅ WIRED-OK | Read-only display of `assigned_broker_slug`/`assigned_group_id`/`assigned_pond_id` |

---

### Groups — `/admin/crm/settings/groups`

**Actions:** `app/actions/crm-groups.ts`  
**Tables:** `crm_groups`, `crm_group_members`  
**e2e:** INSERT confirmed (id=5, name='ZZTEST QA Group'); DELETE confirmed

| Element | Status | Evidence |
|---------|--------|----------|
| Create group (name + distribution_type) | ✅ WIRED-OK | `createGroupAction` → INSERT `crm_groups` |
| Rename (Input onBlur) | ✅ WIRED-OK | `updateGroupAction` → UPDATE `crm_groups.name` |
| Distribution type (Select onValueChange) | ✅ WIRED-OK | `updateGroupAction` → UPDATE `crm_groups.distribution_type` |
| Add member (Select + Add button) | ✅ WIRED-OK | `addGroupMemberAction` → INSERT `crm_group_members` with max sort_order + 1 |
| Remove member (× button) | ✅ WIRED-OK | `removeGroupMemberAction` → DELETE `crm_group_members` |
| Delete group (confirm() then action) | ✅ WIRED-OK | `deleteGroupAction` → DELETE `crm_groups` |
| **UX gap:** Rename saves on blur only | No save button — user editing name then clicking away triggers save; clicking a different button without blurring may lose edit. Low severity. |

---

### Ponds — `/admin/crm/settings/ponds`

**Actions:** `app/actions/crm-ponds.ts`  
**Tables:** `crm_ponds`, `crm_pond_members`  
**e2e:** INSERT confirmed (id=3, name='ZZTEST QA Pond'); DELETE confirmed

| Element | Status | Evidence |
|---------|--------|----------|
| Create pond (name + pond_lead_slug) | ✅ WIRED-OK | `createPondAction` → INSERT `crm_ponds` |
| Rename (Input onBlur) | ✅ WIRED-OK | `updatePondAction` → UPDATE `crm_ponds.name` |
| pond_lead_slug (Input onBlur) | 🐞 BROKEN | `updatePondAction` always includes `pond_lead_slug` in the update object regardless of which field triggered the blur. `crm-ponds.ts`: `const pondLeadSlug = formData.get('pond_lead_slug') as string \| null` then `if (pondLeadSlug !== undefined) update.pond_lead_slug = pondLeadSlug`. The string from FormData is ALWAYS defined (never `undefined`), so a blank field on the form clears the slug on every name-only save. To reproduce: create a pond with a slug, then blur the name field — the slug will be cleared. **Fix:** use `if (pondLeadSlug !== null && pondLeadSlug !== undefined)` or only include it if the FormData key was explicitly submitted. |
| Add pond member | ✅ WIRED-OK | `addPondMemberAction` → INSERT `crm_pond_members` |
| Remove pond member | ✅ WIRED-OK | `removePondMemberAction` → DELETE `crm_pond_members` |
| Delete pond (confirm()) | ✅ WIRED-OK | `deletePondAction` → DELETE `crm_ponds` |

---

### Appointments — `/admin/crm/settings/appointments`

**Component:** `AppointmentSettingsClient.tsx`  
**Actions:** `app/actions/appointments.ts` (createAppointmentTypeAction, updateAppointmentTypeAction, deleteAppointmentTypeAction, + Outcome variants)  
**Tables:** `crm_appointment_types` (cols: `id, name, ord, active`), `crm_appointment_outcomes` (same)  
**e2e:** INSERT to `crm_appointment_types` confirmed (id=6, name='ZZTEST QA Type'); DELETE confirmed

| Element | Status | Evidence |
|---------|--------|----------|
| Add appointment type (Input + Add button) | ✅ WIRED-OK | `createAppointmentTypeAction(name)` → INSERT `crm_appointment_types` |
| Toggle active (Switch) | ✅ WIRED-OK | `updateAppointmentTypeAction(id, { active })` → UPDATE |
| Delete | ☠️ DEAD | `deleteAppointmentTypeAction(id)` fires immediately on button click. No `confirm()` dialog, no Dialog component, no undo. A misclick permanently deletes the type with no recovery path. The `LookupSection` component does not implement any confirmation step (`onClick={() => startTransition(() => onDelete(item.id))`). **Fix:** wrap in a confirm() or a Dialog before calling the action. |
| Add appointment outcome | ✅ WIRED-OK | Same pattern as type; `createAppointmentOutcomeAction(name)` |
| Toggle outcome active | ✅ WIRED-OK | `updateAppointmentOutcomeAction(id, { active })` |
| Delete outcome | ☠️ DEAD | Same no-confirmation issue as type delete. (Note: the task summary marks this ☠️ DEAD because the UX path is effectively broken — the button works but its behavior is dangerously inert.) |

---

### Suppression — `/admin/crm/settings/suppression`

**Component:** `SuppressionAdmin.tsx`  
**Actions:** server actions for add/lift (inferred from `actions.add` / `actions.lift` props)  
**Table:** `crm_suppressions` — e2e read confirmed (rows present: channel='all', reason='tcpa-hard-stop')

| Element | Status | Evidence |
|---------|--------|----------|
| Add suppression (person_id + channel + reason) | ✅ WIRED-OK | `actions.add` → INSERT `crm_suppressions`; person_id field is numeric-only (no name lookup — minor UX gap) |
| Lift suppression per row (with confirm dialog) | ✅ WIRED-OK | `actions.lift`; compliance rows show explicit warning before confirm; non-compliance rows go direct |
| Filter by channel (Select) | ✅ WIRED-OK | `router.push` to URL params — server reads params on page load |
| Search (Input + Enter/button) | ✅ WIRED-OK | Same router.push pattern |
| Compliance warning on lift | ✅ WIRED-OK | Dialog shows "This suppression was added for compliance reasons" with distinct button label |

---

### Team — `/admin/crm/settings/team`

**Page:** `app/admin/(protected)/crm/settings/team/page.tsx`  
**Actions:** `app/actions/admin-broker-permissions.ts`  
**Tables:** `admin_roles` (columns `can_export`, `pause_leads`), `brokers` (read-only for display)

| Element | Status | Evidence |
|---------|--------|----------|
| Can export toggle (form submit button) | ✅ WIRED-OK | `setCanExportAction(formData)` → UPDATE `admin_roles.can_export WHERE email` |
| Pause leads toggle (form submit button) | ✅ WIRED-OK | `setPauseLeadsAction(formData)` → UPDATE `admin_roles.pause_leads WHERE email` |
| CRM active (display only) | ✅ WIRED-OK | Read-only text; editing links to /admin/crm/settings/brokers |
| Routing eligible (display only) | ✅ WIRED-OK | Same |
| Edit link → /admin/brokers/edit | ✅ WIRED-OK | Navigation link only |

---

### Import Wizard — `/admin/crm/import/new`

**Actions:** `app/actions/crm-import.ts`  
**API route:** `app/api/admin/crm-import/route.ts`  
**Tables:** `crm_imports`, `crm_people`, `crm_contact_points`

| Element | Status | Evidence |
|---------|--------|----------|
| Step 1: Upload CSV (file picker + Continue) | ✅ WIRED-OK | `createImportJobAction(csvText)` → INSERT `crm_imports` (status='pending'), returns jobId |
| Step 2: Map fields (Select dropdowns) | ✅ WIRED-OK | `updateImportMappingAction(jobId, mapping)` → UPDATE `crm_imports.field_mapping` WHERE id AND status='pending' |
| Step 3: Preview (first 10 rows + dup warnings) | ✅ WIRED-OK | `getImportPreviewAction(jobId)` → reads from crm_imports, re-parses CSV in memory |
| Dup warnings display | ✅ WIRED-OK | `findCsvDuplicates()` detects email collisions within the file, renders amber warning |
| Step 4: Run import | ✅ WIRED-OK | `startImportAction(jobId)` → UPDATE status='running'; then client fetches `/api/admin/crm-import` |
| API route upsert (crm_people + crm_contact_points) | ✅ WIRED-OK | Chunked 100-row loop: dedup by email via crm_contact_points, upsert crm_people, write contact points. Full implementation verified (lines 82–178). |
| Status polling page | ✅ WIRED-OK | `getImportStatusAction(jobId)` → reads crm_imports.counts + error_rows |
| File size limit (10 MB) | ✅ WIRED-OK | Checked both client-side (`accept=".csv"`, no size attr — minor gap) and server-side (`text.length > 10 * 1024 * 1024`) |

**Minor UX gap:** Upload page uses `<input accept=".csv">` but no `maxSize` attribute or client-side size check before calling the action. Large files will parse then hit the server-side guard — no early rejection.

---

### My Settings — `/admin/settings`

**Component:** `MySettingsForm.tsx`  
**Action:** `app/actions/broker-settings.ts`  
**Table:** `brokers` — e2e read confirmed (matt: id=2fda6811, notify_new_leads=true, email_signature=null)

| Element | Status | Evidence |
|---------|--------|----------|
| Notify new leads (Switch) | ✅ WIRED-OK | `saveBrokerSettingsAction(brokerId, { notify_new_leads })` → UPDATE `brokers WHERE id` |
| Notify deal activity (Switch) | ✅ WIRED-OK | Same action, `notify_deal_activity` field |
| Notify task due (Switch) | ✅ WIRED-OK | Same action, `notify_task_due` field |
| Email signature (Textarea) | ✅ WIRED-OK | `email_signature` sliced to 4000 chars, UPDATE `brokers.email_signature` |
| Save button | ✅ WIRED-OK | `handleSubmit` → action → inline `{ok, text}` feedback message |
| Auth guard (broker can only edit own row) | ✅ WIRED-OK | action resolves broker by email from session, verifies target `brokerId` matches |
| Superuser can edit any row by brokerId | ✅ WIRED-OK | `access.role === 'superuser'` bypasses email check |

---

## Defect Log (Phase B backlog)

### 🐞 D1 — Template folder rename is dead (☠️ partially)
- **File:** `components/admin/crm/settings/TemplateEditor.tsx` (actions prop) + `app/admin/(protected)/crm/settings/templates/page.tsx` (line 41)
- **Fix:** Add `renameCategory: renameCategoryAction` to the `actions` object passed from the page; add a "Rename folder" button in the TemplateEditor Accordion header; wire it to the existing action.
- **Server action:** `app/actions/crm-templates.ts:124` — fully implemented, just not plumbed.

### 🐞 D2 — Pond slug cleared on name-only blur
- **File:** `app/actions/crm-ponds.ts` line ~55
- **Fix:** Change `if (pondLeadSlug !== undefined)` to `if (pondLeadSlug !== null && pondLeadSlug.trim() !== '')` — only write `pond_lead_slug` when the user explicitly passed a non-empty value.

### 🐞 D3 — ConfigTableEditor reorder is move-up only
- **File:** `components/admin/crm/settings/ConfigTableEditor.tsx`
- **Fix:** Add a second reorder button (move down) with `dir: 1`, disabled when `idx === rows.length - 1`. Alternatively, replace the two-button approach with a drag handle that fires the reorder with a computed target index.

### 🐞 D4 — `revalidateTag(tag, 'max')` extra arg (low severity)
- **Files:** All action files — `crm-stages.ts`, `crm-groups.ts`, `crm-ponds.ts`, `crm-lead-flows.ts`, `crm-assignment.ts`, `crm-templates.ts`, `crm-brokers.ts`, `broker-settings.ts`, `admin-broker-permissions.ts`
- **Root cause:** `revalidateTag` in Next.js 14+ takes only `(tag: string)`. The second arg `'max'` is silently discarded. Cache invalidation still fires (the first arg is valid), so functional impact is low today. But if the intent was to use a cache profile, it never runs.
- **Fix:** Remove the `'max'` second argument from all `revalidateTag` calls.

### ☠️ D5 — Appointment type/outcome delete has no confirmation
- **File:** `app/admin/(protected)/crm/settings/appointments/AppointmentSettingsClient.tsx` line ~114
- **Fix:** Add a `window.confirm()` call before firing the delete transition, or wrap in a `<Dialog>` with a destructive confirm button. Pattern to follow: `GroupEditor.tsx` already uses `confirm()` before `deleteGroupAction`.

---

## SAFE e2e Test Results

| Table | Action | Result |
|-------|--------|--------|
| `crm_stages` | INSERT ZZTEST row | ✅ id=17 created |
| `crm_stages` | DELETE ZZTEST row | ✅ deleted |
| `crm_tags` | INSERT ZZTEST row | ✅ id=11 created |
| `crm_tags` | DELETE ZZTEST row | ✅ deleted |
| `crm_appointment_types` | INSERT ZZTEST row | ✅ id=6 created |
| `crm_appointment_types` | DELETE ZZTEST row | ✅ deleted |
| `crm_groups` | INSERT ZZTEST row | ✅ id=5 created |
| `crm_groups` | DELETE ZZTEST row | ✅ deleted |
| `crm_ponds` | INSERT ZZTEST row | ✅ id=3 created |
| `crm_ponds` | DELETE ZZTEST row | ✅ deleted |
| `lead_flows` | INSERT ZZTEST row | ✅ id=1 created |
| `lead_flows` | DELETE ZZTEST row | ✅ deleted |
| `crm_assignment_config` | READ (audit) | ✅ id=1 strategy=all_to_one default=matt |
| `crm_suppressions` | READ (audit) | ✅ rows present, schema matches |
| `crm_templates` | READ (audit) | ✅ 76+ rows, key/channel/name/category/is_active present |
| `brokers` (matt row) | READ (audit) | ✅ notify fields exist, email_signature=null |

**All ZZTEST rows deleted. No real data mutated.**

---

## Schema Discrepancies Found (informational)

1. **ConfigTableEditor / action files use `sort_order` in comments but DB column is `position`** — the factory code (`lib/crm/config-table.ts`) correctly uses `position`; the prior summary context used `sort_order` from component-level comments. Actual SQL is correct.
2. **`crm_segments` does not exist** — this is `crm_newsletter_segments`. The page and action file use the correct name.
3. **`lead_flows.default_broker_slug` does not exist** — actual column is `assigned_broker_slug`. Action file (`crm-lead-flows.ts`) uses the correct column name.
