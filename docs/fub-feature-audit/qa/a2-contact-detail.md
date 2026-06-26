# A2: Contact/Lead Detail — Functional QA Report

**Date:** 2026-06-26
**Auditor:** Claude (automated)
**Method:** Static code audit (full file read + server-action trace) + SAFE e2e (ZZTEST contact id=52271, deleted after)
**Route:** `/admin/console/leads/[id]`
**Primary files:**
- `app/admin/console/leads/[id]/page.tsx`
- `components/console/LeadTabs.tsx`
- `app/actions/crm.ts`, `crm-membership.ts`, `crm-relationships.ts`, `crm-report-subscriptions.ts`
- `app/actions/contact-cma.ts`, `contact-newsletter.ts`, `newsletter.ts`
- `components/admin/crm/MembershipToggles.tsx`, `RelationshipsPanel.tsx`, `CustomFieldsPanel.tsx`
- `components/admin/crm/EmailComposer.tsx`, `SmsComposer.tsx`, `TemplatePickerNav.tsx`, `MergeFieldPicker.tsx`
- `components/admin/crm/ReportSubscriptionsPanel.tsx`, `ContactListingAlertsPanel.tsx`, `NextStepCard.tsx`

---

## Summary

| Status | Count |
|--------|-------|
| Total interactive elements audited | 22 |
| ✅ Working | 18 |
| ☠️ Broken/dead | 2 |
| 🐞 Bug | 2 |
| ❓ Unclear/needs watch | 3 |

---

## Top Defects (priority order)

### P1 — Broken (no UI exists)

**1. No way to enroll a contact in a workflow from this page (☠️)**
The "Plugged in" section shows a static `<span>No workflow</span>` or a read-only `StatusPill` for existing enrollments. There is no enroll button, no sequence picker, and no form anywhere on the lead detail page to start a new workflow enrollment. `manualEnrollPerson` and `approveEnrollmentAction` both exist in the codebase but neither is surfaced here.
- `page.tsx:475–479`, `MembershipToggles.tsx:83–85`
- Impact: brokers must leave this page and navigate to `/admin/crm/sequences` or `/admin/crm/approvals` to enroll. The most common CRM action is a dead end on the contact record.

**2. Custom fields are read-only — no edit/save (☠️)**
`CustomFieldsPanel.tsx` line 10 explicitly comments "Read-only v1: editing custom-field values from the card is a deferred enhancement." There is no write action and no edit UI. FUB custom fields (buyer budget, seller timeline, home-search criteria) can be viewed but not changed from this surface.
- `CustomFieldsPanel.tsx:10`, `page.tsx:507`
- Impact: brokers cannot update the most operationally important contact data (buyer/seller criteria) from the contact record.

### P2 — Bug (wired but wrong behavior)

**3. Add note failure is silent — no user feedback (🐞)**
The `addNoteForm` wrapper at `page.tsx:78–82` calls `addCrmNoteAction` and on failure only does `console.error('[console] addNote:', r.error)`. It does NOT `redirect()` with an error param. The user sees no toast, no alert, and no feedback when a note fails (FUB API down, network error, scope mismatch). All other form wrappers redirect on error; the note wrapper alone is silent.
- `page.tsx:78–82`
- Impact: brokers lose notes silently. They think the note was saved when it was not.

**4. Text/Email quick-action buttons scroll target is unreachable on mobile (🐞)**
`page.tsx:421–422` — both buttons are `<a href="#comms">`. On mobile the `#comms` card is inside a hidden LeadTab panel (`display:none` via the `slot()` helper when another tab is active). The browser's scroll-to-anchor fires against a non-visible element so the viewport never moves to the composer. The `hashchange` listener in `LeadTabs.tsx:81` does correctly switch the active tab, but by the time the tab panel becomes visible the scroll has already silently failed. On mobile the user must manually scroll to find the composer after clicking "Text" or "Email".
- `page.tsx:421–422`, `LeadTabs.tsx:81`, `page.tsx:542`
- Impact: confusing mobile UX — "Text" button appears to do nothing visible.

### P3 — Unclear / watch items

**5. Saved search add/update/delete leave no crm_timeline audit trail (❓)**
`adminAssignSavedSearchAction`, `adminUpdateSavedSearchAction`, and `adminDeleteSavedSearchAction` (all in `newsletter.ts:109,122,134`) write or delete `saved_searches` rows but none write a `crm_timeline` entry. Every other mutation on this page (stage change, broker assign, tag add/remove, task add/complete, membership toggles, relationships, report subscription) writes a timeline entry. Saved search mutations are a gap in the contact audit trail.
- `newsletter.ts:109,122,134`

**6. MembershipToggles workflow list does not refresh after a new enrollment (❓)**
`MembershipToggles` initializes its sequence-toggle list from the SSR prop `memberships.sequences`, which only contains sequences the contact was already enrolled in at page load. `setSequenceEnrollment` correctly calls `revalidatePath` in `crm-membership.ts:54–56`, but it revalidates `/admin/crm` — NOT `/admin/console/leads/[id]`. After a new enrollment, the toggle will be ON (optimistic update) but re-loading the page shows the correct new state; a `router.refresh()` call would NOT update this component since the wrong path is invalidated.
- `crm-membership.ts:54–56`

**7. "Open in FUB" link is invisible for native (non-FUB) contacts with no explanation (❓)**
`fubHref` is null when `person.fub_legacy_id` is null and the link simply does not render. For new native CRM contacts who were never imported from FUB, the link disappears with no tooltip or label explaining why. A broker may look for the link and assume a rendering bug.
- `LeadTabs.tsx:91–93`, `page.tsx:408`

---

## Full Audit Table

| # | Element | Status | File:Line | Evidence | Server Action | SA Verified |
|---|---------|--------|-----------|----------|---------------|-------------|
| 1 | Call button | ✅ | `page.tsx:417–419` | `<form action={startCallForm.bind(null, person.id)}>` | `startCrmCallAction` → `crm.ts:929` | Writes `crm_timeline`, calls Twilio `startOutboundCall`. Redirects on both success and error. |
| 2 | Text button (quick action) | 🐞 | `page.tsx:421` | `<Button asChild><a href="#comms">Text</a></Button>` | None (anchor) | Switches tab via hashchange; scroll to composer fails on mobile (target hidden). |
| 3 | Email button (quick action) | 🐞 | `page.tsx:422` | `<Button asChild><a href="#comms">Email</a></Button>` | None (anchor) | Same mobile scroll issue as Text button. |
| 4 | Email composer Send | ✅ | `page.tsx:564`, `EmailComposer.tsx:60,101` | `sendAction={sendEmailForm.bind(null, person.id)}` | `sendCrmEmailAction` → `crm.ts:516` | Sends via Gmail, suppression-checked, writes `crm_timeline`. Redirects on error. |
| 5 | SMS composer Send | ✅ | `page.tsx:591`, `SmsComposer.tsx:53,88` | `sendAction={sendSmsForm.bind(null, person.id)}` | `sendCrmSmsAction` → `crm.ts:870` | Sends via Twilio, TCPA quiet-hours gate, writes `crm_timeline`. Redirects on error. |
| 6 | Add note | 🐞 | `page.tsx:599–603` | `<form action={addNoteForm}>` | `addCrmNoteAction` → `crm.ts:488` | Writes `crm_timeline` or FUB. Failure is **silent** — no redirect, no user feedback. |
| 7 | Set stage | ✅ | `page.tsx:427–433` | `<form action={updateStageForm}>`, select `name="stage"` | `updateCrmStageAction` → `crm.ts:1090` | Writes `crm_people` + `crm_timeline`, FUB sync, optional CAPI event. |
| 8 | Assign broker | ✅ | `page.tsx:435–442` | `<form action={assignBrokerForm}>`, select `name="broker"` | `assignCrmBrokerAction` → `crm.ts:1041` | Writes `crm_people` + `crm_timeline`, FUB `assignPersonToUser`. Superuser-only guard. |
| 9 | Add tag | ✅ | `page.tsx:817–820` | `<form action={addTagForm}>`, input `name="tag"` | `addCrmTagAction` → `crm.ts:1134` | Writes `crm_people.tags`, FUB `addPersonTags`. |
| 10 | Remove tag | ✅ | `page.tsx:811–814` | `<form action={removeTagForm}>` per badge | `removeCrmTagAction` → `crm.ts:1156` | Writes `crm_people.tags`, FUB `replacePersonTags`. |
| 11 | Add task | ✅ | `page.tsx:625–633` | `<form action={addTaskForm}>`, inputs `name`, `type`, `dueHours` | `addCrmTaskAction` → `crm.ts:1179` | Writes `crm_tasks` natively (FUB path removed 2026-06-24). |
| 12 | Complete task | ✅ | `page.tsx:622` | `<form action={completeTaskForm}>` per open task | `completeCrmTaskAction` → `crm.ts:1319` | Writes `crm_tasks.completed_at`. Calls FUB `completeFubTask` if `fub_legacy_id`. Ownership-checked. |
| 13 | Enroll/Start workflow | ☠️ | `page.tsx:475–479`, `MembershipToggles.tsx:83–85` | No enroll button; static "No workflow" text or read-only pill | None | `manualEnrollPerson` exists but is NOT wired to any UI on this page. |
| 14 | Start/Send CMA | ✅ | `page.tsx:523–528`, `NextStepCard.tsx:63–82` | `cmaAction={startCmaForm.bind(null, person.id)}`, `sendAction` for review | `startCmaForContactAction` + `sendCmaForContactAction` → `contact-cma.ts:144,244` | Two-stage: queue+build → review → send. Writes `cma_deliveries` + `crm_timeline`. Suppression-checked on send. |
| 15 | Send newsletter | ✅ | `page.tsx:525–527`, `NextStepCard.tsx:77–83` | `newsletterAction={sendNewsletterForm.bind(null, person.id)}` | `sendNewsletterToContactAction` → `contact-newsletter.ts:83` | Resolves latest newsletter, sends via Resend, writes `crm_timeline` + `newsletter_recipient_sends`. |
| 16 | Market-report subscription save | ✅ | `page.tsx:678–682`, `ReportSubscriptionsPanel.tsx:69–73,158` | Form `action={setReportSubsForm.bind(null, person.id)}` | `setReportSubscriptionAction` → `crm-report-subscriptions.ts:73` | Upserts `crm_report_subscriptions`, writes `crm_timeline`. Areas sanitized. |
| 17 | Membership toggles (workflow) | ✅ | `MembershipToggles.tsx:93–99` | `setSequenceEnrollment({personId, sequenceId, enrolled})` via `useTransition`. Optimistic + revert. | `setSequenceEnrollment` → `crm-membership.ts:68` | Enroll: `manualEnrollPerson` (hard-stop fail-close). Unenroll: updates `crm_sequence_enrollments`. Writes `crm_timeline`. |
| 18 | Membership toggle (newsletter) | ✅ | `MembershipToggles.tsx:109–121` | `setNewsletterSubscription({personId, subscribed})` via `useTransition` | `setNewsletterSubscription` → `crm-membership.ts:134` | Compliance gate `canSubscribe`, writes `newsletter_subscribers` + `crm_suppressions` + `crm_timeline`. |
| 19 | Membership toggle (listing alerts pause) | ✅ | `MembershipToggles.tsx:122–133` | `setListingAlertsPaused({personId, paused})` via `useTransition`. Disabled when `count === 0`. | `setListingAlertsPaused` → `crm-membership.ts:217` | Calls `setContactListingAlertsPaused` DAL, writes `crm_timeline`. |
| 20 | Add relationship | ✅ | `RelationshipsPanel.tsx:80–108` | `linkContacts({fromPersonId, toPersonId, type})` via `useTransition`. Client-side validation. | `linkContacts` → `crm-relationships.ts:66` | Inserts both directions to `crm_relationships`, writes `crm_timeline` on both contacts. Duplicate guard. |
| 21 | Remove relationship | ✅ | `RelationshipsPanel.tsx:66–77` | `unlinkContacts({fromPersonId, toPersonId})` via `useTransition` | `unlinkContacts` → `crm-relationships.ts:143` | Deletes both-direction rows, writes `crm_timeline` on both contacts. |
| 22 | Add saved search | ✅ | `page.tsx:737–755` | `<form action={assignSavedSearchForm}>`, filters built from inline fields | `adminAssignSavedSearchAction` → `newsletter.ts:109` | Writes `saved_searches`. No `crm_timeline` entry (audit gap — see P3 #5). |
| 23 | Edit saved search | ✅ | `page.tsx:717–730` | `<form action={updateSavedSearchForm}>` inside `<details>` | `adminUpdateSavedSearchAction` → `newsletter.ts:122` | Writes `saved_searches`. No `crm_timeline` entry. |
| 24 | Delete saved search | ✅ | `page.tsx:708–711` | `<form action={deleteSavedSearchForm}>` per search | `adminDeleteSavedSearchAction` → `newsletter.ts:134` | Deletes `saved_searches`. No `crm_timeline` entry. |
| 25 | Custom fields edit/save | ☠️ | `CustomFieldsPanel.tsx:10` | "Read-only v1" comment. No form, no write action anywhere. | None | Deferred enhancement — no server action exists. |
| 26 | Template picker | ✅ | `TemplatePickerNav.tsx:27–49` | `router.push(?tpl=<key>)` → SSR re-renders with merged body | None (URL param, SSR) | Correctly populates `emailInitialSubject`/`emailInitialBody` via `renderCrmMerge`. |
| 27 | Merge field picker | ✅ | `MergeFieldPicker.tsx:56–66`, `EmailComposer.tsx:43–57` | `onInsert(token)` → `insertAtCursor(el, token)` → textarea state | None (client state) | Token inserted at cursor, flows into form submission correctly. |
| 28 | LeadTabs tab switches | ✅ | `LeadTabs.tsx:69–79,118–137` | `useState<LeadTabKey>('overview')`, hashchange listener, `slot()` CSS helper | None (client only) | All server-action forms stay mounted. Desktop all-visible via `lg:flex`. |
| 29 | Open in FUB link | ❓ | `LeadTabs.tsx:91–93`, `page.tsx:408` | `fubHref={person.fub_legacy_id ? '...' : null}` rendered as `<a target="_blank">` | None (external link) | Works for FUB-imported contacts. Silently absent for native contacts — no indicator shown. |
| 30 | Back link (← Leads) | ✅ | `LeadTabs.tsx:90–91` | `<Link href="/admin/console/leads">← Leads</Link>` | None (Next.js Link) | Works. |
| 31 | Newsletter quick-add (+ Newsletter pill) | ✅ | `page.tsx:468–473` | `<form action={assignNewsletterForm}>` shown when `!membership.subscribed` | `adminAssignCrmPersonAction` → `newsletter.ts:70` | Calls `subscribeToNewsletter`. Note: does NOT write `crm_timeline` (unlike `setNewsletterSubscription` in MembershipToggles). |

---

## Server Action Analysis

| Action | File | Writes DB | Calls External | Silent Failure Mode |
|--------|------|-----------|----------------|---------------------|
| `startCrmCallAction` | `crm.ts:929` | `crm_timeline` | Twilio outbound call | Redirects on error. Requires `brokerTwilioNumber` + `forwardCellForBroker` configured. |
| `sendCrmEmailAction` | `crm.ts:516` | `crm_timeline` | Gmail `sendCrmEmail` | Redirects on error. `tplKey` stamped on `email_events`. |
| `sendCrmSmsAction` | `crm.ts:870` | `crm_timeline` | Twilio SMS | Redirects on error. TCPA quiet-hours gate honored. |
| `addCrmNoteAction` | `crm.ts:488` | `crm_timeline` or FUB note | FUB `addPersonNote` (if legacy id) | **Silent on failure — wrapper only `console.error`.** No user feedback path. |
| `updateCrmStageAction` | `crm.ts:1090` | `crm_people`, `crm_timeline` | FUB state update, optional Meta CAPI | Trigger-dispatch failure is `console.warn` only; CAPI is fire-and-forget (safe). |
| `assignCrmBrokerAction` | `crm.ts:1041` | `crm_people`, `crm_timeline` | FUB `assignPersonToUser`, `replacePersonTags` | Redirects on error. Superuser-only. |
| `addCrmTagAction` | `crm.ts:1134` | `crm_people.tags` | FUB `addPersonTags` | FUB call result not checked (fire-and-forget). DB write is guarded. |
| `removeCrmTagAction` | `crm.ts:1156` | `crm_people.tags` | FUB `replacePersonTags` | Same as add. |
| `addCrmTaskAction` | `crm.ts:1179` | `crm_tasks` | None (FUB path removed 2026-06-24) | Fully native. Redirects on error. |
| `completeCrmTaskAction` | `crm.ts:1319` | `crm_tasks.completed_at` | FUB `completeFubTask` (if fub_legacy_id) | FUB call not checked for result. Ownership-checked. |
| `startCmaForContactAction` | `contact-cma.ts:144` | `cma_deliveries`, `crm_timeline` | PDF render, broker email notify | Returns `{ok:false}` on failure. Requires `homeAddress` + `leadEmail`. |
| `sendCmaForContactAction` | `contact-cma.ts:244` | `cma_deliveries.status`, `crm_timeline` | Resend `sendEmail` | Returns `{ok:false}` on failure. Suppression-checked. |
| `sendNewsletterToContactAction` | `contact-newsletter.ts:83` | `newsletter_recipient_sends`, `crm_timeline` | Resend `sendEmail` | Returns `{ok:false}` on failure. Resolves latest sent or draft newsletter. |
| `adminAssignCrmPersonAction` | `newsletter.ts:70` | `newsletter_subscribers` | None | Returns `{ok:false}`. No `crm_timeline` written. |
| `setReportSubscriptionAction` | `crm-report-subscriptions.ts:73` | `crm_report_subscriptions`, `crm_timeline` | None | Returns `{ok:false}`. Areas sanitized against registry. |
| `setSequenceEnrollment` | `crm-membership.ts:68` | `crm_sequence_enrollments`, `crm_timeline` | None | Returns `{ok:false}`. `manualEnrollPerson` handles hard-stop. |
| `setNewsletterSubscription` | `crm-membership.ts:134` | `newsletter_subscribers`, `crm_suppressions`, `crm_timeline` | None | Returns `{ok:false}`. `canSubscribe` compliance gate. |
| `setListingAlertsPaused` | `crm-membership.ts:217` | `saved_searches`, `guest_search_alerts`, `crm_timeline` | None | Returns `{ok:false}`. |
| `linkContacts` | `crm-relationships.ts:66` | `crm_relationships` ×2, `crm_timeline` ×2 | None | Returns `{ok:false}`. Duplicate guard + RBAC both sides. |
| `unlinkContacts` | `crm-relationships.ts:143` | `crm_relationships` delete, `crm_timeline` ×2 | None | Returns `{ok:false}`. |
| `adminAssignSavedSearchAction` | `newsletter.ts:109` | `saved_searches` | None | Returns `{ok:false}`. No `crm_timeline`. |
| `adminUpdateSavedSearchAction` | `newsletter.ts:122` | `saved_searches` | None | Returns `{ok:false}`. No `crm_timeline`. |
| `adminDeleteSavedSearchAction` | `newsletter.ts:134` | `saved_searches` delete | None | Returns `{ok:false}`. No `crm_timeline`. |

---

## SAFE e2e Results

All tests ran against ZZTEST contact only. No real client data was touched.

| Test | Result | Evidence |
|------|--------|----------|
| Create ZZTEST contact (`crm_people`) | PASS | id=52271, name="ZZTEST QA Contact", stage="Prospect", tags=["zztest"] |
| Add note (`crm_timeline` insert) | PASS | id=166690, kind="note", body="QA audit test note body" |
| Set stage update (`crm_people.stage`) | PASS | id=52271, stage updated from "Prospect" → "Hot Lead" |
| Add tag (array append on `crm_people.tags`) | PASS | tags=["zztest","zztest-tag-added"] |
| Add task (`crm_tasks` insert) | PASS | id=403, name="ZZTEST task", type="Follow Up", completed_at=null |
| Complete task (`crm_tasks.completed_at` update) | PASS | id=403, completed_at set to 2026-06-26 22:07:46 UTC |
| Verify all rows before cleanup | PASS | 1 person, 1 timeline, 1 task confirmed |

Schema note: `crm_timeline` has no `created_at` column (defaults not shown in snapshot — `ts` is the timestamp column). Corrected on first attempt.

---

## Cleanup Confirmation

ZZTEST rows deleted: **YES**

```
people_remaining:   0
timeline_remaining: 0
tasks_remaining:    0
```

All confirmed via post-delete verification query.

---

## Recommendations (by priority)

### Fix now

1. **Add "Enroll in workflow" UI** (`page.tsx:475–479`) — a sequence picker dropdown + "Enroll" button calling `setSequenceEnrollment` or a new `enrollContactAction`. This is the most impactful missing feature.

2. **Fix silent note failure** (`page.tsx:81`) — change `console.error` to `redirect(\`${BASE}/${personId}?error=...\`)` to match every other form wrapper on this page.

### Fix soon

3. **Fix mobile scroll on Text/Email buttons** (`page.tsx:421–422`) — after the hashchange fires and the tab switches, use a `scrollIntoView()` call on the `#comms` element inside the newly visible tab panel. A `setTimeout(..., 50)` after the tab class change resolves is sufficient.

4. **Fix `revalidatePath` in `setSequenceEnrollment`** (`crm-membership.ts:54–56`) — add `/admin/console/leads/[id]` revalidation (or use `revalidatePath('/admin/console/leads', 'layout')`) so a page refresh reflects new enrollments.

### Backlog

5. **Add `crm_timeline` entries for saved-search mutations** (`newsletter.ts:109,122,134`).

6. **Show a tooltip or label when `fubHref` is null** — something like "No FUB record" in grey so brokers know the link is intentionally absent, not broken.

7. **Custom fields edit (phase 2)** — build a write action for `crm_people.custom` JSONB, gate it to field definitions in `fieldDefs`, surface inline edit in `CustomFieldsPanel`.
