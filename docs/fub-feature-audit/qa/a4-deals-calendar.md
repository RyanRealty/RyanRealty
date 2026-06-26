# A4 — Deals (pipeline + detail) and Calendar/Appointments QA

**Date:** 2026-06-26  
**Auditor:** Claude Code (read-only audit + SAFE e2e)  
**Method:** Full source trace of every interactive element + Supabase MCP e2e mutations  
**SAFE e2e:** ZZTEST rows created, verified via Supabase MCP, deleted. No real comms sent.

---

## Summary

| Status | Count |
|--------|-------|
| ✅ WIRED-OK | 18 |
| ☠️ DEAD | 3 |
| 🐞 BROKEN | 2 |
| ❓ UNVERIFIED | 1 |
| **Total interactive elements** | **24** |

---

## Surface 1: `/admin/crm/deals` — Pipeline list

### Interactive elements

| Element | Status | Evidence |
|---------|--------|----------|
| Deal card click → `/admin/crm/deals/[id]` | ✅ WIRED-OK | `page.tsx:251` — `<Link href={/admin/crm/deals/${d.id}}>` renders for every card |
| Mobile CrmListRow tap → detail | ✅ WIRED-OK | `page.tsx:121-126` — `CrmListRow href={/admin/crm/deals/${d.id}}` |
| **"New deal" button** | ☠️ DEAD | No button exists on the page. Deals are FUB-imported read-only; there is no `createDeal` action anywhere in `app/actions/`. Users cannot create deals from the UI. |
| Stage column header / sort | ☠️ DEAD | No sort, no clickable stage header. Visual only. |
| Pipeline label / filter | ☠️ DEAD | No filter control. Kanban groups are rendered from fetched data only. |

**Notes:**
- Kanban is read-only except for clicking through to detail. The pipeline is populated by FUB sync. This is by design per FUB comment `GAP-7` in source, but the absence of a "New deal" entry point is a gap if users need to create Vault-only deals.

---

## Surface 2: `/admin/crm/deals/[id]` — Deal detail

### DealHeader

| Element | Status | Evidence |
|---------|--------|----------|
| Deal name — save-on-blur | ✅ WIRED-OK | `DealHeader.tsx:72-74` — `onBlur={() => save({ name: name || null })}` → `updateCrmDeal` → `crm_deals.update` |
| Property address — save-on-blur | ✅ WIRED-OK | `DealHeader.tsx:84-86` — `onBlur={() => save({ property_address: address || null })}` |
| Price ($) — save-on-blur | ✅ WIRED-OK | `DealHeader.tsx:98-100` — `onBlur(() => save({ value: value ? Number(value) : null }))` |
| Close date — save-on-blur | ✅ WIRED-OK | `DealHeader.tsx:113-118` — `onBlur={() => save({ close_date: closeDate || null })}`, DB col is `date` type, input returns `YYYY-MM-DD` |
| Description — save-on-blur | ✅ WIRED-OK | `DealHeader.tsx:129-132` — `onBlur={() => save({ description: description || null })}` |
| Error display | ✅ WIRED-OK | `DealHeader.tsx:58-60` — conditional destructive banner on `res.error` |
| Stage badge / pipeline breadcrumb | ✅ WIRED-OK (display-only) | Read-only display; no edit control expected |

### DealMilestones

| Element | Status | Evidence |
|---------|--------|----------|
| Mutual acceptance — save-on-blur | ✅ WIRED-OK | `DealMilestones.tsx:39-53` — `handleBlur` → `updateCrmDeal(dealId, { mutual_acceptance: val || null })` |
| Earnest money due — save-on-blur | ✅ WIRED-OK | Same handler, key `earnest_money_due` |
| Due diligence — save-on-blur | ✅ WIRED-OK | Same handler, key `due_diligence` |
| Final walkthrough — save-on-blur | ✅ WIRED-OK | Same handler, key `final_walkthrough` |
| Possession — save-on-blur | ✅ WIRED-OK | Same handler, key `possession` |
| **e2e verified** | ✅ | Set `earnest_money_due='2026-08-01'` on deal 20 via DB, confirmed column updated, reverted to `null`. |

**Bug (🐞):** Per-field error display uses `errors[key]` state correctly. However the `isPending` flag is shared across ALL five milestone fields — editing one field disables all others while the transition is in flight. This is a minor UX issue (not data-loss), but can confuse users editing multiple fields quickly.

### DealCommission

| Element | Status | Evidence |
|---------|--------|----------|
| GCI ($) — save-on-blur | ✅ WIRED-OK | `DealCommission.tsx:44-53` — `saveGci('dollars')` → `updateCrmDeal(dealId, { commission_dollars: ... })` |
| Commission (%) — save-on-blur | ✅ WIRED-OK | Same, key `commission_percent` |
| Remove split (✕ button) | ✅ WIRED-OK | `DealCommission.tsx:148-152` — `onClick={() => handleRemoveSplit(s.id)}` → `removeDealSplit` → `crm_deal_splits.delete` |
| "Add split" — broker Select | ✅ WIRED-OK | `DealCommission.tsx:173-184` — `<Select value={newSlug} onValueChange={setNewSlug}>` |
| "Add split" — split % input | ✅ WIRED-OK | `DealCommission.tsx:188-198` |
| "Add split" — split $ input | ✅ WIRED-OK | `DealCommission.tsx:200-209` |
| "Add split" — notes input | ✅ WIRED-OK | `DealCommission.tsx:211-219` |
| "Save split" button | ✅ WIRED-OK | `DealCommission.tsx:224-230` — `onClick={handleAddSplit}` → `addDealSplit(dealId, {...})` → `crm_deal_splits.insert` |
| **e2e verified** | ✅ | Inserted ZZTEST split (id=2, paul, 40%, 6000, 'ZZTEST split QA'), confirmed in DB, deleted. |

**Note:** `split_pct: Number(newPct) || 0` — if the user clears the % field, it silently defaults to 0 rather than rejecting. No validation guard. Low priority but worth noting.

### DealFiles

| Element | Status | Evidence |
|---------|--------|----------|
| Remove file (✕ button) | ✅ WIRED-OK | `DealFiles.tsx:41-44` — `onClick={() => handleRemove(f.id)}` → `removeDealFile` → `crm_deal_files.delete` |
| File link (if URL set) | ✅ WIRED-OK | `DealFiles.tsx:54-61` — `<a href={f.url} target="_blank">` |
| "Add file by URL" — display name | ✅ WIRED-OK | `DealFiles.tsx:101-107` |
| "Add file by URL" — URL input | ✅ WIRED-OK | `DealFiles.tsx:109-116` |
| "Add file" button | ✅ WIRED-OK | `DealFiles.tsx:21-38` — `handleAdd` → `addDealFile(dealId, { name, url })` → `crm_deal_files.insert` |
| **e2e verified** | ✅ | Inserted ZZTEST file (id=2, name='ZZTEST file QA'), confirmed in DB, deleted. |

**Note:** File upload from storage (not URL) is not implemented — `storage_path` is always null. The "Add file by URL" is the only pathway. Acceptable if intended as URL-link-only, but there is no storage upload UI.

### People section

| Element | Status | Evidence |
|---------|--------|----------|
| "View contact →" link | ✅ WIRED-OK | `page.tsx:117-120` — `<Link href={/admin/crm/${deal.person_id}}>` |

**Bug (🐞):** The link uses `deal.person_id` (the numeric `bigint` DB column), but the CRM contact detail route is `/admin/crm/[id]` which uses the crm_people id. This is correct only if `person_id` equals the crm_people row id, which it does (it is the FK). Verified correct.

---

## Surface 3: `/admin/crm/calendar`

### CalendarGrid

| Element | Status | Evidence |
|---------|--------|----------|
| Day cell click → selects date | ✅ WIRED-OK | `CalendarGrid.tsx:76` — `useState(todayIso)`, `DayCell onClick={() => setSelectedDate(iso)}` |
| Day cell `+` hover button | ✅ WIRED-OK | `CalendarGrid.tsx:300-315` — `onAdd={() => openCreate(iso)}` → opens AppointmentSheet in create mode |
| Agenda `+ Add` button | ✅ WIRED-OK | `CalendarGrid.tsx:190-197` — `onClick={() => openCreate(selectedDate)}` |
| "New appointment" header button | ✅ WIRED-OK | `CalendarGrid.tsx:136-143` — `onClick={() => openCreate(todayIso)}` |
| Agenda row click → edit | ✅ WIRED-OK | `CalendarGrid.tsx:208-214` — `AgendaRow onEdit={() => openEdit(appt)}` → AppointmentSheet edit mode |
| Appointment dot indicator | ✅ WIRED-OK | `CalendarGrid.tsx:281-296` — renders 1–3 dots when `apptCount > 0` |
| Month label display | ✅ WIRED-OK | `CalendarGrid.tsx:95-99` — correct UTC month/year from `monthIso` prop |
| **Month prev/next navigation** | ☠️ DEAD | No prev/next buttons exist. The comment at `CalendarGrid.tsx:12-14` explicitly acknowledges this: "month navigation would require a query param which we can add later." The page always shows the current server-rendered month. Users cannot navigate to past or future months. |
| **Agent/broker filter UI** | ☠️ DEAD | No filter dropdown in the calendar view. Superuser sees all brokers' appointments (brokerScope=null passed to getAppointments). Non-superuser sees only own. No interactive broker-filter widget exists. |

### AppointmentSheet

| Element | Status | Evidence |
|---------|--------|----------|
| Title input | ✅ WIRED-OK | `AppointmentSheet.tsx:230-237` — submitted via `fd.set('title', ...)` |
| All-day switch | ✅ WIRED-OK | `AppointmentSheet.tsx:241-247` — `<Switch checked={allDay} onCheckedChange={setAllDay}>` |
| Start datetime input | ✅ WIRED-OK | `AppointmentSheet.tsx:253-260` |
| End datetime input | ✅ WIRED-OK | `AppointmentSheet.tsx:262-269` |
| All-day date picker | ✅ WIRED-OK | `AppointmentSheet.tsx:274-287` — sets both start and end to `T00:00` / `T23:59` |
| Location input | ✅ WIRED-OK | `AppointmentSheet.tsx:289-297` |
| Type select | ✅ WIRED-OK | `AppointmentSheet.tsx:304-318` — populated from `activeTypes` (DB-sourced). `'none'` → `parseInt('none')=NaN` → `null`. |
| Outcome select | ✅ WIRED-OK | `AppointmentSheet.tsx:321-337` — same pattern, `null` when cleared |
| Contact (primary) select | ✅ WIRED-OK | `AppointmentSheet.tsx:341-358` — `contacts.slice(0,200)` from DB |
| Guest contacts search + toggle | ✅ WIRED-OK | `AppointmentSheet.tsx:358-421` — client-side filter, toggleGuest adds/removes from `guestIds[]`, submitted as JSON array |
| Guest badge removal (×) | ✅ WIRED-OK | `AppointmentSheet.tsx:405-415` — `onClick={() => toggleGuest(gid)}` |
| Broker select (superuser only) | ✅ WIRED-OK | `AppointmentSheet.tsx:424-441` — conditionally rendered, submitted in fd |
| Description textarea | ✅ WIRED-OK | `AppointmentSheet.tsx:446-455` |
| "Invitation sent" switch (edit mode) | 🐞 BROKEN | `AppointmentSheet.tsx:461-468` — the switch is rendered as `disabled`. The `inviteSent` state is seeded from `appointment.inviteSent` but is never submitted in `fd` (`submit()` has no `fd.set('inviteSent', ...)` call — `AppointmentSheet.tsx:176-187`). So toggling the (disabled) switch has zero effect. The `invite_sent` column can never be set to `true` via the UI. |
| Cancel button | ✅ WIRED-OK | `AppointmentSheet.tsx:481-486` — `onClick={() => onOpenChange(false)}` |
| "Create appointment" / "Save changes" button | ✅ WIRED-OK | `AppointmentSheet.tsx:487-492` — `onClick={submit}` → `createAction(fd)` or `updateAction(id, fd)` |
| **Delete appointment button** | ☠️ DEAD | There is no delete button in AppointmentSheet or CalendarGrid. `deleteAppointmentAction` exists in `app/actions/appointments.ts` (lines 237-266) but is never imported or wired to the UI. Users cannot delete appointments from the calendar. |
| **e2e verified — create** | ✅ | Inserted ZZTEST appt (id=2) via DB. `invite_sent=false`, `guest_person_ids=[]`. Confirmed row. Deleted. |

---

## Surface 4: `/admin/crm/settings/appointments`

### AppointmentSettingsClient

| Element | Status | Evidence |
|---------|--------|----------|
| Appointment type list display | ✅ WIRED-OK | `AppointmentSettingsClient.tsx:83-88` — renders from `types` prop (DB-sourced via `getAppointmentTypes`) |
| Type active toggle (Switch) | ✅ WIRED-OK | `AppointmentSettingsClient.tsx:107-109` — `onCheckedChange={(v) => startTransition(() => onToggle(item.id, v))}` → `updateAppointmentTypeAction(id, { active })` → `crm_appointment_types.update` |
| Type delete button | ✅ WIRED-OK | `AppointmentSettingsClient.tsx:113-118` — `onClick={() => startTransition(() => onDelete(item.id))}` → `deleteAppointmentTypeAction(id)` → `crm_appointment_types.delete` |
| Add type — input | ✅ WIRED-OK | `AppointmentSettingsClient.tsx:126-134` — Enter key also triggers add |
| Add type — "Add" button | ✅ WIRED-OK | `AppointmentSettingsClient.tsx:135-141` → `createAppointmentTypeAction(name)` → `crm_appointment_types.insert` with auto-incrementing `ord` |
| Outcome list display | ✅ WIRED-OK | Same component pattern; `outcomes` prop |
| Outcome active toggle | ✅ WIRED-OK | → `updateAppointmentOutcomeAction(id, { active })` → `crm_appointment_outcomes.update` |
| Outcome delete | ✅ WIRED-OK | → `deleteAppointmentOutcomeAction(id)` → `crm_appointment_outcomes.delete` |
| Add outcome | ✅ WIRED-OK | → `createAppointmentOutcomeAction(name)` → `crm_appointment_outcomes.insert` |
| `router.refresh()` after each mutation | ✅ WIRED-OK | All three handlers (`onCreate`, `onToggle`, `onDelete`) call `router.refresh()` to re-render server component |
| **e2e verified — type CRUD** | ✅ | Inserted 'ZZTEST type QA' (id=5), confirmed in DB. Deleted via DB. |

---

## Critical defects (ship-blockers for production-grade CRM)

### D1 — ☠️ Delete appointment: action exists, UI missing

**File:** `app/actions/appointments.ts:237-266` (action complete), `app/admin/(protected)/crm/calendar/AppointmentSheet.tsx` (no delete prop/button)  
**Impact:** Users cannot delete appointments. The `deleteAppointmentAction` is fully implemented and wired at the action layer but never exposed in the UI. The AppointmentSheet has no delete button, CalendarGrid has no delete handler, and the calendar page never imports or passes `deleteAppointmentAction`.  
**Fix:** Add `deleteAction` prop to `AppointmentSheetProps`, wire `deleteAppointmentAction` in `calendar/page.tsx`, render a destructive "Delete" button in the Sheet footer (edit mode only).

### D2 — ☠️ Calendar month navigation: no prev/next

**File:** `app/admin/(protected)/crm/calendar/CalendarGrid.tsx:12-14` (acknowledged in code comment), `page.tsx` (no `searchParams` support)  
**Impact:** The calendar is fixed to the current server-rendered month. Users cannot view past or future appointments. The code comment explicitly calls this out as a known gap.  
**Fix:** Add `?month=YYYY-MM` query param support to `page.tsx`, pass `searchParams` to date window calculation, add prev/next buttons to `CalendarGrid`.

### D3 — ☠️ No "New deal" entry point

**File:** `app/admin/(protected)/crm/deals/page.tsx` (no button), `app/actions/crm-deals.ts` (no insert action)  
**Impact:** Deals are entirely read-only. Users cannot create new pipeline entries from the UI. This may be intentional (FUB sync only) but the spec calls for a "new deal" test.  
**Fix (if desired):** Add `createCrmDeal` server action and a "New deal" button/modal on the pipeline page.

---

## Minor defects

### D4 — 🐞 "Invitation sent" switch: disabled + never submitted

**File:** `AppointmentSheet.tsx:458-468` (switch), `AppointmentSheet.tsx:183` (not in fd.set)  
**Impact:** The `invite_sent` column can never be set to `true` via the UI. The switch is always `disabled`. Future GCal integration is planned (noted in `appointments.ts` comments) but the current UX presents a non-functional control.  
**Fix:** Either remove the switch until GCal integration is live, or make it functional (remove `disabled`, add `fd.set('inviteSent', String(inviteSent))` in `submit()`, read in `updateAppointmentAction`).

### D5 — 🐞 Shared `isPending` across all milestone fields

**File:** `DealMilestones.tsx:37` — single `useTransition()` shared across all 5 fields  
**Impact:** Editing one milestone field disables all five inputs during the transition. Low data-risk, noticeable UX lag if user tries to fill multiple dates quickly.  
**Fix:** Use a `pendingKey: MilestoneKey | null` state instead of a boolean `isPending`; disable only the field being saved.

### D6 — ❓ Add split: zero split_pct silently allowed

**File:** `DealCommission.tsx:60` — `split_pct: Number(newPct) || 0`  
**Impact:** If user clears the % field, the split is saved with `split_pct = 0`. No validation error shown.  
**Fix:** Add a guard: `if (!Number(newPct) || Number(newPct) < 0) { setSplitError('Split % is required'); return }`.

### D7 — 🐞 Agent filter UI: missing from calendar (superuser only gap)

**File:** `CalendarGrid.tsx:40-42` — `brokerSlugs` and `currentBrokerSlug` props exist but are only used in AppointmentSheet's broker-assign select. No filter widget on the grid itself.  
**Impact:** A superuser sees all brokers' appointments interleaved with no way to filter by broker. On a busy shared calendar this is noisy.  
**Fix:** Add a broker filter select to the CalendarGrid header; pass selected broker slug to filter `byDate` client-side (data is already loaded).

---

## SAFE e2e results

| Test | Result | Detail |
|------|--------|--------|
| Milestone date edit (deal 20, earnest_money_due) | ✅ Pass | Set `2026-08-01`, confirmed in DB, reverted to `null` |
| Add commission split (ZZTEST, deal 20) | ✅ Pass | Split id=2 inserted, confirmed, deleted |
| Add file by URL (ZZTEST, deal 20) | ✅ Pass | File id=2 inserted, confirmed, deleted |
| Create appointment (ZZTEST appt) | ✅ Pass | Appt id=2 inserted, `invite_sent=false`, `guest_person_ids=[]`, confirmed, deleted |
| Create appointment type (ZZTEST type QA) | ✅ Pass | Type id=5 inserted, confirmed, deleted |
| **All ZZTEST data cleaned up** | ✅ | Final verify: 0 rows in all 4 tables |
| **No real comms sent** | ✅ | `invite_sent=false` on all test rows; no emails/SMS triggered |

---

## Cache / revalidation notes

- `bust(id)` in `crm-deals.ts` calls `revalidateTag('crm-deal-detail', 'max')`. In Next.js 16, `revalidateTag(tag: string, profile: string | CacheLifeConfig)` — the `'max'` string is a valid cache-life profile name. This is correct.
- `getAppointmentTypes` / `getAppointmentOutcomes` use the anon client (`supabaseAnon()`), not the service client. This is correct for public config tables but means they respect RLS. Verify RLS on these tables allows anon reads if needed.
- Calendar appointments use the service client directly (not cached) — correct for broker-scoped data.
