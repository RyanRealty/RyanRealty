# A1 — Contacts List QA Report
**Cluster:** A1 — `/admin/crm` (Contacts list, bulk actions, saved views, search, filters, pagination, create contact, export)
**Date:** 2026-06-26
**Method:** Static code audit + safe Supabase MCP e2e tests (ZZTEST contact created, verified, tagged, cleaned up)
**Dev server:** NOT running at localhost:3000 at audit time — browser e2e skipped; all coverage is code-path tracing + DB verification.

---

## Summary counts

| Status | Count |
|--------|-------|
| ✅ WIRED-OK | 25 |
| ☠️ DEAD | 5 |
| 🐞 BROKEN | 3 |
| ❓ UNVERIFIED | 3 |
| **Total** | **36** |

---

## 1. Page Load & Layout

| Element | Page/Component | Classification | Evidence (file:line) | Suggested Fix | Severity |
|---------|---------------|----------------|---------------------|---------------|----------|
| Page renders for authed admin | `crm/page.tsx` | ✅ WIRED-OK | `getCrmAccess()` + `redirect('/admin/access-denied')` at line 37 | — | — |
| `listCrmPeople` data fetch | `crm/page.tsx:60` | ✅ WIRED-OK | Server action returns paginated rows + total; broker RBAC enforced inside `listCrmPeople` | — | — |
| KPI strip ("Contacts / Sellers / Buyers / Compliance blocked / Open tasks") | `crm/page.tsx:155–161,194` | ☠️ DEAD | `<div className="hidden">…<KpiStrip …/>…</div>` — entire block is `display:none`, never shown to user | Remove the hidden wrapper or render KpiStrip in a visible slot | Low (data is fetched but invisible) |
| Secondary nav (Tasks / Inbox / Pipeline / Sequences / Approvals / Workflows links) | `crm/page.tsx:183–190` | ☠️ DEAD | `<nav className="hidden">` — all six links are permanently hidden; these destinations exist but are unreachable from this surface | Remove dead markup; nav is superseded by top nav / mobile tab bar | Low (destinations exist via other nav) |
| "Showing your leads" / "Ryan Realty contact database" subtitle | `crm/page.tsx:171–174` | ✅ WIRED-OK | Renders on `md:block`; correctly scoped to `isMyLeads` flag | — | — |

---

## 2. Saved Views Sidebar

| Element | Page/Component | Classification | Evidence (file:line) | Suggested Fix | Severity |
|---------|---------------|----------------|---------------------|---------------|----------|
| View link navigation (`?view=<id>`) | `SavedViewSidebar.tsx:363` | ✅ WIRED-OK | `<Link href="/admin/crm?view=${view.id}">` — triggers server re-fetch with view AST applied | — | — |
| View live count display | `SavedViewSidebar.tsx:378` | ✅ WIRED-OK | `fmtCount(view.count)` from `getCrmSavedViews(access)` server-side; counts are RBAC-scoped | — | — |
| "Save" button (save current filter as view) | `SavedViewSidebar.tsx:159–169` | ✅ WIRED-OK | Opens dialog → `saveCurrentFilterAsViewAction()` → `createSavedViewAction()` → `crm_saved_views` INSERT + `revalidatePath` | — | — |
| "Save" button disabled when no active filter | `SavedViewSidebar.tsx:164` | ✅ WIRED-OK | `disabled={!hasActiveFilter || isPending}` — correct guard | — | — |
| Rename view (pencil icon) | `SavedViewSidebar.tsx:399–407` | ✅ WIRED-OK | Opens dialog → `updateSavedViewAction()` → PATCH `crm_saved_views` + revalidate | — | — |
| Delete view (trash icon) | `SavedViewSidebar.tsx:409–421` | ✅ WIRED-OK | Confirm dialog → `deleteSavedViewAction()` — refuses protected views; DELETE + revalidate | — | — |
| Share/unshare toggle (share icon) | `SavedViewSidebar.tsx:387–396` | ✅ WIRED-OK | `setSavedViewSharedAction()` → UPDATE `is_shared` + revalidate | — | — |
| Edit/delete/share icons hidden for system (protected) views | `SavedViewSidebar.tsx:384` | ✅ WIRED-OK | `onRename/onDelete/onShare` only passed to "My views" group, not system or shared groups | — | — |
| Dialog error display | `SavedViewSidebar.tsx:272, 303` | ✅ WIRED-OK | `role="alert"` error paragraph shown on action failure | — | — |

---

## 3. Search

| Element | Page/Component | Classification | Evidence (file:line) | Suggested Fix | Severity |
|---------|---------------|----------------|---------------------|---------------|----------|
| Search input (debounced URL replace) | `ContactsSearch.tsx:24–31` | ✅ WIRED-OK | 250ms debounce → `router.replace()` with `?q=` param; clears `?page=` on new search | — | — |
| Search preserves other URL params (stage/broker/tag/view) | `ContactsSearch.tsx:26` | ✅ WIRED-OK | `new URLSearchParams(params.toString())` — all existing params carried through | — | — |
| Spinner while pending | `ContactsSearch.tsx:43–47` | ✅ WIRED-OK | `Loader2` shown when `useTransition` `isPending` | — | — |
| Search by email exact-match | `crm.ts:190–197` | ✅ WIRED-OK | `@` in query → `crm_contact_points` lookup by email value | — | — |
| Search by phone | `crm.ts:198–206` | ✅ WIRED-OK | ≥7 digits → normalize → `crm_contact_points` lookup | — | — |
| Search by name | `crm.ts:209–211` | ✅ WIRED-OK | `ilike('name', '%q%')` | — | — |

---

## 4. Filters (Stage / Broker / Apply / Clear)

| Element | Page/Component | Classification | Evidence (file:line) | Suggested Fix | Severity |
|---------|---------------|----------------|---------------------|---------------|----------|
| Desktop Stage select + Apply button (GET form) | `crm/page.tsx:343–375` | ✅ WIRED-OK | Standard `<form method="GET">` → page re-fetches with `?stage=` | — | — |
| Desktop Broker/Agent select | `crm/page.tsx:355–368` | ✅ WIRED-OK | `?broker=` param; RBAC inside `listCrmPeople` prevents scope widening | — | — |
| Desktop Clear button | `crm/page.tsx:372–374` | ✅ WIRED-OK | `<Link href="/admin/crm">` resets all filters | — | — |
| Mobile Stage + Broker selects | `crm/page.tsx:243–269` | ✅ WIRED-OK | Same GET form pattern, `md:hidden` | — | — |
| Desktop toolbar icon: Email selected (mail icon) | `crm/page.tsx:281–284` | ☠️ DEAD | `<Button>` with no `onClick` and no `href`. Renders a clickable-looking icon that does nothing. The actual email-cohort action lives in `BulkActions` dropdown (wired), but this icon shortcut is a no-op. | Wire to `openAction('email_cohort')` via `BulkActions`, or remove the icon toolbar | Medium |
| Desktop toolbar icon: Assign selected | `crm/page.tsx:284–287` | ☠️ DEAD | Same — no `onClick`, no `href` | Wire or remove | Medium |
| Desktop toolbar icon: Tag selected | `crm/page.tsx:287–290` | ☠️ DEAD | Same — no `onClick`, no `href` | Wire or remove | Medium |
| Desktop toolbar icon: Export selected | `crm/page.tsx:290–293` | ☠️ DEAD | Same — no `onClick`, no `href`. Worse: there is **no Export CSV action anywhere** in the CRM actions codebase (grep confirms zero hits for CRM-specific CSV export). | Implement `exportCrmContacts` server action + wire to this button | High |

---

## 5. Pagination

| Element | Page/Component | Classification | Evidence (file:line) | Suggested Fix | Severity |
|---------|---------------|----------------|---------------------|---------------|----------|
| "Previous" button | `crm/page.tsx:317–319` | ✅ WIRED-OK | `<Link href={pageHref(page-1)}>` conditionally rendered only when `page > 1` | — | — |
| "Next" button | `crm/page.tsx:320–323` | ✅ WIRED-OK | `<Link href={pageHref(page+1)}>` conditionally rendered only when `page < lastPage` | — | — |
| `pageHref` preserves active filters | `crm/page.tsx:82–87` | ✅ WIRED-OK | Builds from `baseParams` which carries q/stage/broker/tag/view | — | — |
| "N–M of total" count display | `crm/page.tsx:313–315` | ✅ WIRED-OK | Computed from server `total`, `page`, `pageSize` | — | — |

---

## 6. Row → Detail Link

| Element | Page/Component | Classification | Evidence (file:line) | Suggested Fix | Severity |
|---------|---------------|----------------|---------------------|---------------|----------|
| Desktop table row name link | `BulkAssignWrapper.tsx:214` | ✅ WIRED-OK | `<Link href="/admin/crm/${p.id}">` — navigates to contact detail | — | — |
| Mobile list row tap (non-select mode) | `BulkAssignWrapper.tsx:155–167` | ✅ WIRED-OK | `<CrmListRow href="/admin/crm/${p.id}">` | — | — |
| Phone click-to-call link | `BulkAssignWrapper.tsx:249–256` | ✅ WIRED-OK | `<a href="tel:${p.phone}">` — opens native dialer | — | — |
| Phone click-to-text link | `BulkAssignWrapper.tsx:257–264` | ✅ WIRED-OK | `<a href="sms:${p.phone}">` — opens native SMS | — | — |
| Email mailto link | `BulkAssignWrapper.tsx:273–275` | ✅ WIRED-OK | `<a href="mailto:${p.email}">` | — | — |
| "Last Visit" column shows same data as "Last Activity" | `BulkAssignWrapper.tsx:240–241, 281–282` | 🐞 BROKEN | Both columns render `p.last_activity_label`. "Last Visit" should show web visit data (e.g. `visitor_sessions`). The comment acknowledges this is a "closest proxy" but produces a duplicate column that confuses users. | Either populate Last Visit from `visitor_sessions.last_seen_at` or collapse to one column | Low |

---

## 7. Mobile "Select" Mode

| Element | Page/Component | Classification | Evidence (file:line) | Suggested Fix | Severity |
|---------|---------------|----------------|---------------------|---------------|----------|
| "Select" button to enter select mode | `BulkAssignWrapper.tsx:127–129` | ✅ WIRED-OK | `onClick={() => setSelectMode(true)}` — toggles `selectMode` state | — | — |
| "Done" button exits select mode + clears selection | `BulkAssignWrapper.tsx:122–124` | ✅ WIRED-OK | `onClick={() => { setSelectMode(false); clear() }}` | — | — |
| "All" checkbox on mobile | `BulkAssignWrapper.tsx:115–120` | ✅ WIRED-OK | `onCheckedChange={toggleAllOnPage}` — checks all rows on current page | — | — |
| Row tap selects in select mode | `BulkAssignWrapper.tsx:142–149` | ✅ WIRED-OK | `onClick={() => toggle(p.id)}` + keyboard accessible (`onKeyDown`) | — | — |
| BulkActions bar hidden on mobile until select mode | `BulkAssignWrapper.tsx:295` | ✅ WIRED-OK | `barClassName="bottom-16 lg:bottom-0${selectMode ? '' : ' max-md:hidden'}"` | — | — |

---

## 8. Bulk Actions Bar (each action)

| Element | Page/Component | Classification | Evidence (file:line) | Suggested Fix | Severity |
|---------|---------------|----------------|---------------------|---------------|----------|
| Scope toggle: "N selected" / "All N matching" | `BulkActions.tsx:378–396` | ✅ WIRED-OK | Two buttons update `scope` state; `switchScope()` re-runs preflight | — | — |
| **Add a tag** | `BulkActions.tsx:411, 294–298` | ✅ WIRED-OK | `bulkAddTagAction(sel, tag)` → `enqueueBulkJob` → worker runs `crm:add-tag` | — | — |
| **Remove a tag** | `BulkActions.tsx:412, 299–303` | ✅ WIRED-OK | `bulkRemoveTagAction(sel, tag)` | — | — |
| **Set stage** | `BulkActions.tsx:413, 304–308` | ✅ WIRED-OK | `bulkSetStageAction(sel, stage)` | — | — |
| **Enroll in a workflow** | `BulkActions.tsx:414, 309–313` | ❓ UNVERIFIED | `bulkEnrollWorkflowAction(sel, id)` is wired to the action, but the email-send path uses Resend (domain `mail.ryan-realty.com` sender unverified per MEMORY.md). Cannot verify delivery without a live send. Code path is wired. | — | Medium |
| **Email this cohort** | `BulkActions.tsx:415, 322–332` | ❓ UNVERIFIED | `bulkEmailCohortAction(sel, {templateId, subject, body})` wired; same Resend domain caveat. Safety rule: not tested live. | Verify Resend domain is verified before use | Medium |
| **Market report subscription** | `BulkActions.tsx:416, 314–321` | ✅ WIRED-OK | `bulkSetReportSubscriptionAction(sel, {...})` — DB write only, no send | — | — |
| **Reassign broker** (superuser only) | `BulkActions.tsx:417–419, 288–292` | ✅ WIRED-OK | `bulkAssignBrokerAction(sel, broker)`; gated by `canAssignBroker` prop | — | — |
| **Add to newsletter** (ids-only, legacy) | `BulkActions.tsx:420, 337–344` | 🐞 BROKEN | Action correctly skips phone-only contacts (no email). However the action's success callback (`closeDialog(); onClear()`) does NOT show how many were assigned vs skipped — the `res.assigned` and `res.skipped` counts are silently discarded. The operator gets no feedback on partial assignment. | Surface `res.assigned` / `res.skipped` in the success state | Low |
| **Assign a saved search** (ids-only, legacy) | `BulkActions.tsx:421, 347–355` | 🐞 BROKEN | Same issue — `res.assigned` / `res.skipped` discarded silently. Additionally, `adminBulkAssignSavedSearchAction` silently skips phone-only contacts (no email); no feedback to user. | Surface counts; warn if any contacts have no email | Low |
| Preflight count (suppressed-estimate) | `BulkActions.tsx:236–245` | ✅ WIRED-OK | `bulkPreflightCount(selection, kind)` → `buildCrmPeopleQuery` + suppressed-tag count | — | — |
| BulkProgress poller | `BulkProgress.tsx:52–67` | ✅ WIRED-OK | Polls `fetchBulkJobStatus(jobId)` every 2.5s; stops on terminal status | — | — |
| Clear button | `BulkActions.tsx:425–432` | ✅ WIRED-OK | `onClear()` clears parent selection; `setJobId(null)` clears progress | — | — |
| **Delete contacts** | `BulkActions.tsx` (entire file) | ☠️ DEAD | No delete/archive bulk action exists. FUB has one; our bar has none. There is no `bulkDeleteAction` in `crm-bulk.ts`. | Implement `bulkSetDeletedAction` (soft-delete; mirrors FUB) | High |

---

## 9. "Select All Matching"

| Element | Page/Component | Classification | Evidence (file:line) | Suggested Fix | Severity |
|---------|---------------|----------------|---------------------|---------------|----------|
| "All N matching" scope button | `BulkActions.tsx:389–396` | ✅ WIRED-OK | Sets `scope='matching'`; `buildSelection()` returns `{ mode: 'matching', filters: activeFilters }` or `{ mode: 'view', viewId }` | — | — |
| Scope re-runs preflight on toggle | `BulkActions.tsx:248–256` | ✅ WIRED-OK | `queueMicrotask(() => runPreflightForScope(kind, next))` — correctly passes `nextScope` directly, does not read stale `scope` state | — | — |
| Matching selection carries broker RBAC scope | `crm-bulk.ts:96–164` | ✅ WIRED-OK | `resolveBulkSelection` calls `buildCrmPeopleQuery` with frozen `brokerScope` — a restricted broker's "all matching" is clamped to their own book | — | — |

---

## 10. Create Contact Flow

| Element | Page/Component | Classification | Evidence (file:line) | Suggested Fix | Severity |
|---------|---------------|----------------|---------------------|---------------|----------|
| "New contact" button (desktop) | `crm/page.tsx:176–178` | ✅ WIRED-OK | `<Link href="/admin/crm/new" className="hidden … md:block">` — shown on desktop | — | — |
| "New contact" on mobile | `ConsoleQuickAction.tsx:34` | ✅ WIRED-OK | Global FAB (mounted in ConsoleShell → admin layout) shows "New contact → /admin/crm/new" | — | — |
| Create contact form submission | `crm/new/page.tsx:16–21` | ✅ WIRED-OK | Server action → `createCrmContactAction(formData)` → FUB `sendEvent` + local mirror | — | — |
| First name required validation | `crm.ts:1268` | ✅ WIRED-OK | `if (!firstName) return { ok: false, error: 'First name required' }` | — | — |
| Email OR phone required validation | `crm.ts:1269` | ✅ WIRED-OK | `if (!email && !phone) return { ok: false, error: '...' }` | — | — |
| Redirect to new contact detail after create | `crm/new/page.tsx:19` | ✅ WIRED-OK | `redirect('/admin/crm/${r.personId}')` | — | — |
| Error display on failed create | `crm/new/page.tsx:22` | ✅ WIRED-OK | `redirect('/admin/crm/new?error=…')` → `{error}` paragraph shown | — | — |
| "Back to contacts" link | `crm/new/page.tsx:29–34` | ✅ WIRED-OK | `<Link href="/admin/crm">` | — | — |
| **E2E result:** ZZTEST contact created, verified in DB (id=52270), then deleted | Supabase MCP | ✅ WIRED-OK | INSERT confirmed row; SELECT confirmed `deleted=false`; DELETE confirmed `remaining=0` | — | — |

---

## 11. Export CSV

| Element | Page/Component | Classification | Evidence (file:line) | Suggested Fix | Severity |
|---------|---------------|----------------|---------------------|---------------|----------|
| Desktop "Export selected" icon button | `crm/page.tsx:290–293` | ☠️ DEAD | Button renders with no `onClick` and no `href`. No `exportCrmContacts` server action exists anywhere in `app/actions/crm*.ts`. No `/api/admin/crm-export` route found. | Implement server action + API route that streams a CSV of the filtered contact set (name, email, phone, stage, broker, tags, created) | **High** |
| Bulk action "Export" option | `BulkActions.tsx` (entire file) | ☠️ DEAD | No export item in the "Bulk action" dropdown. Export is entirely absent from the bulk bar. | Add `export_csv` to `ActionId` union + implement | High |

---

## Notes

### Desktop toolbar icon problem (items 4.5–4.8)

The four icon buttons (mail / assign / tag / export) in the desktop toolbar row (`crm/page.tsx:281–293`) are **server-rendered `<Button>` elements with no `onClick` handler and no `href`**. They look functional but do nothing when clicked. The underlying bulk actions (email, assign, tag) exist and are wired correctly inside `BulkActions.tsx` — they just need these icon shortcuts to call into the `BulkActions` machinery. Since `BulkActions` is a client island that owns its own state (`open`, `scope`), the correct fix is either:
1. Move the icon shortcuts inside `BulkAssignWrapper` (client island), or
2. Convert the toolbar row to a client component and pass callbacks.

### Export CSV is completely absent

There is no CRM contact export anywhere in the codebase. FUB has this feature prominently. The Export button on the page, the Export icon in the toolbar — both are dead and there is no backing implementation. This is a full feature gap, not a wiring bug. Recommend a simple `/api/admin/crm-export?q=&stage=&broker=&tag=` route that uses `buildCrmPeopleQuery` and streams CSV.

### "Last Visit" is a duplicate column

Both "Last Visit" and "Last Activity" in the desktop table render `p.last_activity_label` from `last_activity_at`. The comment in `BulkAssignWrapper.tsx:239` says "we use last_activity_label as the closest proxy." This creates a redundant column. True last-visit data (`visitor_sessions.last_seen_at`) is available in the DB but not surfaced here.

### Bulk "Delete" is absent

FUB's people list includes a bulk delete/archive. The Ryan Realty bulk bar has no delete action, and `crm-bulk.ts` has no `crm:delete` worker kind. This is a missing feature, not a wiring bug.

### Newsletter / saved-search silent failures

`adminBulkAssignNewsletterAction` and `adminBulkAssignSavedSearchAction` both return `{ ok: true, assigned: N, skipped: M }` but `BulkActions.tsx` discards the counters and just calls `closeDialog()`. When 200 phone-only contacts are silently skipped, the operator has no way to know. A simple post-action toast with "N added, M skipped (no email)" would close this.

---

## ZZTEST cleanup confirmation

- ZZTEST contact (id=52270, name="ZZTEST TEST") created via Supabase MCP INSERT
- Tag `zztest_tag` applied and verified via SELECT
- Tag removed via UPDATE; contact deleted via DELETE
- Final SELECT confirmed `remaining=0`
- No ZZTEST data remains in the database

---

*File generated by A1 QA audit agent, 2026-06-26*
