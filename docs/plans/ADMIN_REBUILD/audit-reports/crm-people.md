# CRM Contacts Domain Audit — list, person detail, mobile fork

Auditor scope: `/admin/crm` (contacts list), `/admin/crm/new`, `/admin/crm/[id]` (person detail), `/admin/crm/activity`, plus `components/admin/crm/people-list/**`, `components/admin/crm/person-detail/**`, `components/admin/crm/mobile/**`, and the shared contact components (ContactQuickActions, ContactSendCenter, ConversationFeed, SmsComposer, EmailComposer, BulkActions, MergeContactDialog, CustomFieldsPanel, ContactsSearch, saved-view grouping).

Every claim below carries a file path + line numbers. All line numbers refer to the working tree at audit time (2026-07-16, branch `main`).

---

## 0. Executive summary

The contacts domain is the most-built part of the admin and also the clearest demonstration of why Matt calls it unusable. It is a faithful FUB clone assembled screen-by-screen from a spec (`docs/fub-crm-spec/*`), which produced:

1. **Two entirely separate component trees per page** (desktop + mobile) that are BOTH server-rendered on every request and toggled with CSS (`md:hidden` / `hidden md:block`) — double payload, double data mapping, and a feature matrix that diverges wildly (see §8).
2. **A query storm on every page view.** The list page executes roughly `20 + N_savedViews + 8_stages + 5×N_sequences` sequential/parallel Supabase round-trips per request, `force-dynamic`, zero caching. The person page executes ~40–55 queries across four sequential await-stages. This is the primary "slow loads" cause in this domain.
3. **Send flows with no feedback and no double-send protection.** Both composers submit a multi-second server action through a bare `<form action>` with no pending state, no disable-on-submit, and no state reset on success. The sent text stays in the box inviting a duplicate send to a client.
4. **A right-rail/person-page that renders the same concept in 3–5 different widgets** (market reports ×3, saved searches ×3 with two different backing tables, automations ×5 surfaces).
5. **Silent mutation failures everywhere on mobile**: five of the seven page-bound form actions swallow errors into server-side `console.error` and return void — the phone UI refreshes as if the write succeeded.

---

## 1. `/admin/crm` — Contacts list (desktop)

**File:** `app/admin/(protected)/crm/page.tsx` (305 lines, `force-dynamic`)

### 1.1 Data path (end-to-end)

Page load fires this exact sequence:

1. `getCrmAccess()` — 1 query (page.tsx:60).
2. `Promise.all` of **11 readers** (page.tsx:73–85):
   - `getCrmSavedViews(access)` — 1 view-list query **plus one live `COUNT` query per saved view** through `buildCrmPeopleQuery(countOnly)` (`lib/data/crm/getCrmSavedViews.ts:113–118`, `65–84`). Explicitly "NOT cached" (comment at :19–22). System views + Pipeline + Neighborhoods collections mean this is easily 10–25 COUNT queries over the ~20k-row `crm_people` table.
   - `getCrmOverview(scope)` — 1 exact head-count (crm.ts:273–281).
   - `listCrmPeople(...)` — re-runs `getCrmAccess()` internally (crm.ts:169), 1 saved-view fetch when `?view=`, 1 contact-point lookup when `q` is an email/phone, then the main page query (crm.ts:152–260).
   - `getCrmStages()`, `getCrmTags()`, `getCrmReportAreas()`, `getCrmTemplatesAdmin()`, `getCrmPonds()`, `getCrmNeighborhoodOptions()` — 6 more queries, all fetched **whether or not the user ever opens the bulk dialogs that consume them**.
   - `listCrmSequences()` — 1 sequence fetch **plus 5 exact head-counts per sequence** (`crm.ts:1004–1034`, `SEQUENCE_COUNT_STATUSES × sequences`). The list page uses this ONLY to build the bulk "Apply Automation" name picker (`page.tsx:177–179` filters to `id`+`name` of active ones). The 5×N enrollment counts are computed and thrown away. With 10 sequences that is **50 wasted COUNT queries per list page view**.
   - `getCrmStageCounts(access)` — 1 config read + one COUNT per active stage (~8) (`lib/data/crm/getCrmStageCounts.ts:26–37`).
3. `getPeopleListSignals(rowIds)` — 2 more queries (one paged) for Last Visit + Last Activity per row (page.tsx:91, `lib/data/crm/getPeopleListSignals.ts:41–63`). **Serial** — it awaits after the big batch because it needs row ids.

**Total: ~20 fixed queries + N_views + ~8 stages + 5×N_sequences COUNTs, every single request, uncached, `force-dynamic`.** With realistic numbers (15 views, 10 sequences) that is **~85 Supabase round-trips per page view of the contact list.**

### 1.2 The query itself

`listCrmPeople` (crm.ts:152–260) self-scopes broker RBAC (good — the page can't widen a restricted broker), compiles saved-view AST + URL overlays through the single compiler `buildCrmPeopleQuery`, page size 50 (`PAGE_SIZE`, crm.ts:100), exact count on the same query.

**Defect — search contradiction:** the compiler documents invariant #3 "No 200-id contact-point cap. Free-text q searches name + the emails/phones jsonb directly" (`lib/data/crm/buildCrmPeopleQuery.ts:17–19,163–168`). But `listCrmPeople`'s actual free-text path does NOT use the compiler's q field — it does its own thing (crm.ts:227–251): an email-looking q runs an **exact-match** `eq('value', q.toLowerCase())` over `crm_contact_points` with **`.limit(200)`**; a phone-looking q likewise; only bare tokens get `ilike name`. Consequences:
  - Searching a partial email (`bob@gm`) returns **zero rows** (exact match only).
  - Any email/phone shared by >200 contacts silently truncates.
  - The panel filter labels the field "Name contains" (`FilterPanel.tsx:51`) while the code actually branches to email/phone matching — the label lies.

### 1.3 Desktop rendering — `PeopleListView` + `PeopleSidebar` + `FilterPanel`

- `PeopleSidebar` (people-list/PeopleSidebar.tsx): All People count, Stages strip, Collections (Pipeline / Neighborhoods / My views / Shared), Manage footer → `/admin/crm/settings/segments`. Pure navigation, works.
- `PeopleListView` (people-list/PeopleListView.tsx, 793 lines): header (All People vs smart-list header + Edit + Update List), toolbar, always-visible bulk icon strip, table, pagination, right panel slot (FilterPanel or ColumnChooser), and 4 dialogs.

**Defects / findings:**

1. **No search box on desktop.** `ContactsSearch` is rendered ONLY inside the mobile-only wrapper (`page.tsx:222–237`, `searchSlot={<ContactsSearch/>}` inside `md:hidden`). On desktop, finding a contact requires: click **Filters** (1) → click **+ Name** in the panel (2) → type into "Name contains" → press Enter (3). Three interactions and a full page navigation for the single most common CRM job, vs. one always-visible input on the phone. (`FilterPanel.tsx:200–210`.)
2. **Desktop row Text/Call icons bypass the CRM entirely.** The phone column renders `href={`sms:${p.phone}`}` and `href={`tel:${p.phone}`}` (`PeopleListView.tsx:699–716`). These open the OS Messages/dialer — untracked, unlogged, off the compliance-gated Twilio path (quiet hours, suppressions, A2P). Matt's punch-list #4 ("text from my CRM not my messaging app") was fixed on the mobile Info tab (routes to `/admin/crm/inbox?c=<id>&m=sms`, `MobileContactPointsSection.tsx:136–143`) but the desktop list still ships the native links. Email column is a plain `mailto:` (`PeopleListView.tsx:719–721`).
3. **Lead Score is a dead default column.** `DEFAULT_PEOPLE_COLUMNS` starts with `leadScore` (`people-list-utils.ts:88–90`) which renders a permanent em-dash: "No lead-score model yet" (`PeopleListView.tsx:678–680`). The very first data column of the default table is always empty.
4. **Column config is per-browser localStorage keyed by view id** (`PeopleListView.tsx:178–195`, `people-list-utils.ts:93–95`) — not synced across devices or brokers, silently resets in private mode.
5. **Bulk icon strip is duplicated.** The same Batch Email / Import / Tags / Delete / Export icons render twice: above the table always (`PeopleListView.tsx:411–437`) and again in the selection bar (`BulkActions.tsx:566–612`).
6. Row provides **no inline actions** other than navigate: no stage change, no assign, no quick note from the row. Changing one contact's stage from the list = check row (1) → ⋯ menu (2) → Update Stage (3) → pick (4) → Run (5) — five clicks through the bulk-job machinery (enqueue + progress poller) for a single-row edit.
7. Pagination is Previous/Next links only, no page-size control, no jump; at 20k contacts / 50 per page that is 400 pages (`PeopleListView.tsx:486–498`).
8. `deleteCrmPersonAction` redirects to `/admin/crm?flash=…` (`app/actions/crm-person-detail.ts:645`) but the list page's `SearchParams` type has no `flash` and renders nothing for it (`page.tsx:54–57`) — **the delete confirmation message is dead**; the user lands on the list with zero acknowledgment.

### 1.4 Bulk actions (`BulkActions.tsx`, 977 lines + `BulkProgress`)

Architecturally the strongest piece: two selection modes (`ids` vs `matching`/whole-view), server-side preflight count with suppression estimate (`BulkActions.tsx:331–344`), enqueue to a chunked worker job, progress poller. 16 actions.

- **Hidden entirely on mobile**: `barClassName="bottom-16 lg:bottom-0 max-md:hidden"` (`PeopleListView.tsx:528`). Phone users have zero bulk capability.
- Merge People restricted to 2–10 explicit checked ids (`BulkActions.tsx:633–638`).
- Legacy paths (newsletter, merge) act on ids only, inline (not the job framework), with count feedback (`BulkActions.tsx:424–435, 485–496`).

### 1.5 Mobile fork of the list — `MobilePeopleRoot`

The `< md` branch (page.tsx:222–260) renders `MobileCrmHeader` (navy bar, broker avatar, BrokerScopeSheet "Everyone ▾", search toggle) + `MobilePeopleRoot` (directory of smart lists/stages, or a filtered list).

**Mobile is a stripped-down browse-only surface:**
- Row shows avatar · name · `source ?? stage` subtitle · chevron only (`MobilePeopleRoot.tsx:163–172`). No phone, no tags, no last activity, no agent, no quick actions.
- **No bulk actions, no export, no column config, no tag/neighborhood/pond filters, no Add Person** (Add Person lives only in the desktop `PeopleListView` header dialog and the shell FAB). Filters available on phone: smart list, stage, broker scope, text search — that's all.
- Pagination is bare Previous/Next text links (`MobilePeopleRoot.tsx:179–187`).
- The full desktop tree (sidebar + 793-line table view + BulkActions + dialogs) is still **server-rendered and shipped inside `hidden md:flex`** on every phone request (page.tsx:263–301), and vice versa — the mobile tree ships to desktops.
- **All ~85 list-page queries run for the phone view too**, including the sequence/tag/template/area pickers that mobile has no UI for.

### 1.6 Loading / feedback states

- `crm/loading.tsx` renders a good skeleton for the list (headers visible, 12 placeholder rows).
- **The person detail route has no `loading.tsx` of its own** (`app/admin/(protected)/crm/[id]/` contains only `page.tsx`, `mobile-detail.tsx`, `form-actions.ts`) — navigating list → person shows the **people-list table skeleton** while the (slow, §2.1) detail page loads. Wrong-shaped skeleton on the domain's most common transition.

### 1.7 Verdict

Works, but the desktop list is a read-only table with a five-click path to a one-field edit, no search box, dead default column, and native-app text/call links that bypass compliance; the mobile list is a different, radically thinner product; and every render costs ~85 queries.

---

## 2. `/admin/crm/[id]` — Person detail (desktop)

**File:** `app/admin/(protected)/crm/[id]/page.tsx` (709 lines, `force-dynamic`), form wrappers in `[id]/form-actions.ts`.

### 2.1 Data path — four sequential await-stages, ~40–55 queries

- **Stage 1** (page.tsx:124–130): `getCrmAccess` + `getCrmPersonFull(id)` + `getCrmEmailTemplates` + `getCrmSmsTemplates` + `getTwilioSmsStatus` (A2P cached 5 min — the only cache in the whole page, crm.ts:717–724).
  - `getCrmPersonFull` (crm.ts:346–424) alone: person row (`select('*')`) → access check → 8-way parallel batch (contact points, timeline `limit(100)` w/ exact count, tasks, suppressions, enrollments, geo, cma_deliveries, visitor-session count) → then **two more serial queries** to merge visitor events into the timeline (crm.ts:379–410).
- **Stage 2** (page.tsx:157–206): a **28-way `Promise.all`** — savedSearches, viewedListings, memberships, behaviorSummary, relationships, contactAlerts, nextStep, reportSub, reportAreas, fieldDefs, emailEngagement, collaborators, actionPlanProgress, `getPersonDetailExtras`, activeSequences, crmSources, recipientOptions, contactCmas, contactBpos, latestNewsletter, signature, mergeCtx, appointments+types+outcomes, conversation, homeMedia, homeMatches.
  - `getPersonDetailExtras` internally fires **~16 queries** (appointments, deals, files, starred count, marketing count, tags, ponds, 4 activity counts, 5 tab counts) plus a **serial signed-URL loop per stored file** (`lib/data/crm/getPersonDetailExtras.ts:86–124, 133–150`).
- **Stage 3** (page.tsx:223–231): `getLeadSmsRecipients` + `getGroupReplyParticipants` (depends on stage-2 relationships).
- **Stage 4:** render — server actions bound, both mobile AND desktop trees assembled.

Nothing here is cached; the page is `force-dynamic`. Every `router.refresh()` after any inline edit **re-runs the entire pipeline**.

### 2.2 Desktop layout — three columns

`PersonSidebar` (left) · `PersonCenterColumn` (timeline + composers) · `PersonRightRail` (widgets), each independently scrolling inside `h-[calc(100dvh-3.5rem)]` (page.tsx:499).

#### 2.2.1 Left sidebar (`person-detail/PersonSidebar.tsx`, 613 lines)

- Inline-editable: emails (add/edit), address, stage, assigned-to (Me/Ponds/Team), source, price, timeframe, tags, lender, background. Phones edit via `EditPhonesDialog`. Custom fields editable via `CustomFieldsPanel`/`CustomFieldEditor` island.
- **The contact's NAME is not editable on desktop.** `updatePersonNameAction` exists (`crm-person-detail.ts:93–133`) but its only consumer is the mobile `MobileEditSheet`. Desktop renders the name as a static `<h2>` (PersonSidebar.tsx:371). To fix "Lead bob@gmail.com" you must use a phone.
- **Dead sections:** `socialLinks: []` and `groups: []` are hardcoded empty by the page (page.tsx:376–377); the sidebar still renders a "Social Profile" section (whose only content is a Google-search link) and a "Groups" section that always says "No groups" (PersonSidebar.tsx:552–579).
- **Merge affordance is a mystery-meat "+" icon** in the Relationships header labeled `aria-label="Merge existing person"` (PersonSidebar.tsx:427–434) next to a Users icon for add-relationship. Plus for merge is a usability trap.
- **TagChips swallows failures**: `addTag`/`removeTag` call the actions and `router.refresh()` without reading the result (PersonSidebar.tsx:266–287) — a scope rejection or DB error looks identical to success.
- **Collapse-state flash:** every `SidebarSection` initializes `open=defaultOpen` then flips from localStorage in a `useEffect` (PersonSidebar.tsx:110–119) — sections visibly jump on load for any user who collapsed them.

#### 2.2.2 Center column (`PersonCenterColumn.tsx`, 754 lines)

- Compose modes: Note / Email / Text / Log Call as pill toggles; 8 filter tabs with **exact** counts from `getPersonDetailExtras`.
- **Timeline truncation vs. exact counts:** the timeline items are the newest **100** rows (merged with visitor events, re-capped at 100 — crm.ts:365,406–408) with **no pagination or load-more**. Tab counts are exact (e.g. "Texts 342") but clicking the tab filters the in-memory 100 — the tab shows a fraction of what its own badge promises. Mobile's Comms tab got a cursor-paginated `getContactConversation` precisely to fix this (page.tsx:197–200 comment) — **desktop never got it**.
- **"How it works" is dead UI**: a static `<span>` with an Info icon, no handler, no link (PersonCenterColumn.tsx:612–614).
- Notes tab splits human vs automated notes (good). Star toggle is optimistic with revert (the only optimistic mutation in the domain, :303–309). SMS delivery badge with on-demand Twilio reconcile is well built (:197–283).
- `TAB_KINDS` here (:91–97) duplicates `TIMELINE_TAB_KINDS` in `getPersonDetailExtras.ts:66–72` — two hand-synced copies of the tab→kind mapping.

#### 2.2.3 Composers — the critical send-path defects

`SmsComposer.tsx` and `EmailComposer.tsx` are the canonical send surfaces (good consolidation per the 2026-07-15 directive), but:

1. **No pending state on send.** Both submit via bare `<form action={props.sendAction}>` (SmsComposer.tsx:118, EmailComposer.tsx:91). No `useFormStatus`, no transition, no spinner, no disable-while-submitting. `sendCrmSmsAction` performs, per recipient, a sequential chain of `requirePersonInScope` → `getSendTarget` → `isSuppressed` → `buildMergeContext` → `brokerTwilioNumber` → `instrumentSmsLinks` → Twilio API → timeline insert (crm.ts:881–919) — multi-second latency during which the button remains enabled.
2. **No double-send protection.** A second click during the window submits again → duplicate text/email to a client.
3. **Composer state is never cleared on success.** The server action returns void (redirects only on error — `form-actions.ts:60–69`); the client `body`/`subject` state survives the RSC refresh (`key={smsTpl ?? 'blank'}` doesn't change, page.tsx:534,556). After a successful send the message sits in the box looking unsent.
4. **No success confirmation** of any kind (no toast, no flash). The only signal is the timeline eventually re-rendering above.

The quiet-hours override checkbox renders permanently, not just during quiet hours (SmsComposer.tsx:198–204).

#### 2.2.4 Right rail (`PersonRightRail.tsx`, 783 lines)

Widgets: Action Plans · Activity · Tasks · Appointments · Website Activity (slot) · Deals · Automations · Files · Collaborators, plus a keyboard hint.

- **The keyboard hint is a lie.** "Press → to view next lead or ← to view previous lead" (PersonRightRail.tsx:777–780). **No keydown handler exists anywhere in `person-detail/`** (verified by grep — zero matches for ArrowRight/keyboard nav). Dead affordance printed on every lead.
- **"Automations" widget duplicates "Action Plans"** — the code admits it: "merged with action plans post-FUB-2.0; shows the same enrollments" (:718). Same data, two widgets, one interactive, one not.
- Enrollment pause/resume/stop **ignore the action results** (:502, :512, :522 — `(await pauseEnrollmentAction(...), refresh())`), errors vanish.
- Task quick-add is name-only, hardcoded `type='Follow Up'`, `dueHours=24` (:626–633) — no date, no type, no assignee from desktop rail; collapsed vs the mobile task sheet.
- Appointments "+" **navigates away** to `/admin/crm/calendar?person=id` (:650); Deals "+" navigates to the global `/admin/crm/deals` board **not scoped to this person** (:689) — both dead-end context switches; mobile can create an appointment in-place (§3).
- CollaboratorsDialog saves by looping `addCrmCollaboratorAction`/`removeCrmCollaboratorAction` sequentially with **no error handling** (:199–207).
- Files: upload/link/delete work with pending + error text (the best-behaved widget), but per-file serial signed-URL generation on the server (§2.1) and delete has no confirm.

#### 2.2.5 The "Website Activity" slot — the duplication epicenter

Rendered into the rail from page.tsx:616–703:

| Concept | Surface 1 | Surface 2 | Surface 3+ |
|---|---|---|---|
| Market-report subscription | `ContactSendCenter` "Market report" tab (ContactSendCenter.tsx) | `ContactQuickActions` "Market reports" chip → sheet embedding `ReportSubscriptionsPanel` (ContactQuickActions.tsx:217–235) | standalone `ReportSubscriptionsPanel` rendered directly below (page.tsx:652–657) — **three editable copies of the same subscription on one page** |
| Saved searches / listing alerts | `ContactQuickActions` "Saved searches" sheet ← `getListingAlertsForLead` (page.tsx:631) | `ContactListingAlertsPanel` ← `getContactListingAlerts` (page.tsx:658) — **a different table** | inline "Saved searches (N)" block with add/remove forms ← `getListingAlertsForLead` again (page.tsx:660–701) |
| Automations / action plans | Action Plans rail widget | Automations rail widget (dup) | `ContactQuickActions` "Automations" sheet + sidebar "Campaigns" row = **5 surfaces total** (6 counting mobile Details row) |
| CMA / BPO send | `OwnedHomeCard` (generate + send) | `ContactCmaCard` / `ContactBpoCard` | `ContactSendCenter` CMA/BPO tabs |
| Newsletter | `ContactQuickActions` chip/sheet | — | — |

Two different flash channels coexist: URL `?flash=`/`?error=` params (Alert banners, page.tsx:484–495 — which persist in the URL and **re-display on every refresh/bookmark**) and `sonner` toasts (ContactSendCenter.tsx:93–110). Inline mutations (sidebar, rail) show neither.

### 2.3 Mutation wrappers — `[id]/form-actions.ts`

- `addNoteForm`, `sendEmailForm`, `sendSmsForm`, contact-point add: redirect with `?error=`/`?flash=` (visible only in the desktop Alert strip; **mobile never renders `flash`/`error` params at all** — `MobileLeadDetail` receives neither).
- **`updateStageForm`, `addTagForm`, `removeTagForm`, `addTaskForm`, `assignBrokerForm` swallow errors**: `if (!r.ok) console.error(...)` then return void (form-actions.ts:35–54). These are the exact actions bound into the mobile Info tab pickers (mobile-detail.tsx:458–464). On the phone, a failed stage change / tag / broker assign / task **looks identical to success**.
- `addContactPointForm` has no success feedback path at all (form-actions.ts:55–59).

### 2.4 Underlying actions — correctness notes

- `savePhoneNumbersAction` does **delete-then-insert with no transaction** ("Atomic replace" comment notwithstanding, crm-person-detail.ts:167–187): if the insert fails after the delete succeeds, the contact **loses every phone number**; two concurrent saves race.
- **Triple representation of contact points**: `crm_contact_points` rows + `crm_people.phones`/`emails` jsonb mirrors. `savePhoneNumbersAction` and `saveEmailRowAction` mirror to jsonb (crm-person-detail.ts:189–205, 260–279) **but `addCrmContactPointAction` does not** (crm.ts:1228–1251). A phone/email added through the mobile "Add phone/Add email" flow exists only in contact_points → the list page's Phone/Email columns (which read the jsonb, page.tsx:41–45 + `CRM_PEOPLE_SELECT`) won't show it, and `sendCrmEmailAction`'s primary-email pick (crm.ts:498–499, jsonb sort) misses it. `getSendTarget` has a contact-points fallback for phones only (getSendTarget.ts:42–51).
- `assignCrmBrokerAction` also writes a `broker:<slug>` tag into the tags array (crm.ts:1099–1102) — assignment state duplicated into tags.
- `deleteCrmPersonAction` soft-deletes with `redirect()` and **no revalidation of the list** other than the redirect itself; its flash message is unread (§1.3).
- **Collaborators don't grant access.** `isPersonInScope` checks `assigned_broker === slug` only (`lib/crm/scope.ts:48–53`); `getCrmPersonFull` 404s an out-of-scope lead (crm.ts:355–360). Adding Rebecca as a collaborator on Matt's lead gives her **no ability to open or act on it** — the entire Collaborators feature (rail widget, dialog, mobile sheet, bulk add/remove collaborator actions) is decorative for restricted brokers.
- `toggleTimelineStarAction` scope-checks via the owning row (good, crm-person-detail.ts:293–303).
- RBAC on reads is real: `listCrmPeople` self-scopes (crm.ts:162–174); `getCrmPersonFull` self-guards (crm.ts:351–360).

### 2.5 Job cost (clicks)

| Job | Desktop | Mobile |
|---|---|---|
| List → open person → reply to latest text | row click (1) → "Text" pill (2) → type → send (3) | row tap (1) → Comms tab (2 — Info is default) → type → send (3) |
| Change stage | Stage field (1) → pick option (2) → ✓ save (3) | Details row (1) → picker option (2) → "Select" (3) |
| Log a call | "Log Call" pill (1) → outcome/minutes/notes → Log Call (2) | **not possible** (no log-call UI on mobile; only live bridge call) |
| Send a market report | 3 competing widgets; shortest: Send-to-contact (1) → Market tab (2) → area (3) → send (4) | **not possible** |
| Fix a wrong name | **not possible on desktop** | Edit (1) → fields → Save (2) |

### 2.6 Verdict

Feature-dense but structurally bloated: ~50 queries a view, three columns of overlapping widgets, critical send flows with zero feedback, dead affordances shipped in production, and a desktop/mobile capability split that forces device-hopping for basic jobs (rename on phone, log call on desktop, CMA on desktop).

---

## 3. `/admin/crm/[id]` — Mobile person detail

**Files:** `[id]/mobile-detail.tsx` (mapping/assembly, server), `components/admin/crm/mobile/*`.

### 3.1 Architecture

- Always rendered alongside desktop; shown at `< md` via CSS (page.tsx:482). Special `?view=mobile` forces a 390px frame at any width (page.tsx:470–476) — a test affordance living in production routing.
- `MobileContactDetail` — navy header (back, Edit on Info tab, avatar/name/last-comm/price pill) + 6 tabs: Info · Comms · Activity · Homes · Notes · Calendar. Tab switching is client state; the shell FAB deep-links via `#hash` (MobileContactDetail.tsx:138–155). Active tab auto-centers in the strip (:109–116). Comms tab toggles `data-crm-comms` on `<html>` to hide the shell FAB (:123–133).

### 3.2 Tab findings

**Info tab** (`MobileInfoTab.tsx` + `MobileContactPointsSection` + `MobileDetailsSection`):
- Phone rows: SMS circle → **navigates away** to `/admin/crm/inbox?c=<id>&m=sms` (MobileContactPointsSection.tsx:136–143) even though the Comms tab one swipe away has a pinned composer — two different in-app text paths from the same screen. Call circle → S8 sheet (Twilio bridge with honest tel: fallback) — good.
- Email circle → navigates to inbox composer; **no email composing inside the detail** on mobile.
- Hardcoded off-brand hex on the action circles: `#7595e8`, `#4ad09f`, `#4ab8e8` (:141,150,177); same pattern in `CrmActionCircle` (`#6366f1`,`#22c55e`,`#38bdf8`, CrmMobileKit.tsx:225) and `MobileActivityTab` KIND_ICON colors (:23–27) — violates the two-color design-token rule.
- Details rows (Assigned/Stage/Source/Tags/Timeframe/Collaborators/Automations) open canonical sheets. **All writes swallow errors**: `saveField` logs to console then refreshes (MobileDetailsSection.tsx:135–139); pond assign and enrollment likewise (:187–191, :221–225); the stage/tag/assign/collab actions are the void-returning wrappers from §2.3.
- Read-only on mobile: price, lender, background, custom fields ("EDIT ALL was inert — removed rather than lie", MobileInfoTab.tsx:366–368), addresses (maps link), relationships (add is desktop-only, :253–255), inquiries.

**Comms tab** (`MobileCommsTab.tsx` + `ConversationFeed`):
- Full paginated history via `getContactConversation` (50/page cursor) — **better than desktop**.
- **Defect (high): sent/received messages don't appear.** `ConversationFeed` snapshots `events` into `useState` once (ConversationFeed.tsx:98) and never syncs on prop change. The pinned composer's send revalidates and streams a fresh conversation prop, which the feed ignores. The broker sends a text and **the thread doesn't show it** until a hard reload — indistinguishable from a failed send, and combined with the composer's un-cleared body (§2.2.3) actively invites a duplicate send.
- Composer is the same `SmsComposer` bound to the same `sendSmsForm` — same no-pending/no-reset defects. SMS-blocked/no-phone states show honest text (page.tsx:403–420).
- Spam-block button on inbound calls, MMS proxying, recordings inline — solid.

**Activity tab** (`MobileActivityTab.tsx`): desktop Activity-filter kinds, pre-formatted server-side; works; hex-literal icon colors.

**Homes tab** (`MobileHomesTab.tsx`): viewed-listing carousel. **"SEE ALL" is a dead `<span>`** — no handler, no href (:50). Cards aren't links either — nothing on this tab navigates anywhere.

**Notes tab** (`MobileNotesTab.tsx`): add-note sheet (clears + closes on success — one of the few well-behaved mutations), human/system note split, tap-to-expand clamped notes. Notes come from the **100-row-capped timeline** (mobile-detail.tsx:193–202) — older notes silently missing, no pagination.

**Calendar tab** (`MobileCalendarTab.tsx`): appointments + tasks with real create sheets (`AppointmentSheet` shared with the calendar surface). **Mobile can create/edit an appointment in place; desktop cannot** (rail links away, §2.2.4).

**Edit sheet** (`MobileEditSheet.tsx`): name + phones (atomic replace) + emails (explicit per-row diff) with dirty tracking, pending label, error banner — the most complete edit surface in the domain, and it is **mobile-only**.

### 3.3 Verdict

The mobile detail is in places better engineered than desktop (paginated comms, edit sheet, appointment create), but it is a second product: error-blind mutations, an entire capability tier missing (CMA/BPO, market reports, newsletter, saved searches, files, deals, merge, delete, star, log-call, email compose, custom-field editing), a broken live thread after send, and dead affordances of its own.

---

## 4. `/admin/crm/new` — full-page create form

`app/admin/(protected)/crm/new/page.tsx`. Duplicate of `AddPersonDialog` (§1.3) with a **different field set**: page has Broker + Note but no Source; the dialog has Source but no Broker/Note. Both call `createCrmContactAction`. Two create surfaces, neither complete. Page errors round-trip through `?error=` query param. No mobile-specific layout (plain form). The mobile People root has no path to either surface (§1.5).

---

## 5. `/admin/crm/activity` — global activity feed

`app/admin/(protected)/crm/activity/page.tsx` → `GlobalActivityFeed.client` ← `getGlobalActivityFeed` (50/page cursor). Broker-scoped, type chips, owner can widen to Everyone. Mobile gets the navy header; its search icon **links to `/admin/crm`** rather than searching activity (:65, `searchHref="/admin/crm"`). `BROKER_HEADSHOT` map copy-pasted here a third time (:16–20; also crm/page.tsx:48–52, mobile-detail.tsx:65–69). Otherwise functional; not a defect hotspot.

---

## 6. Performance summary (root causes of "slow")

| Surface | Cost per request | Evidence |
|---|---|---|
| `/admin/crm` list | ~20 fixed queries + 1 COUNT/saved-view + ~8 stage COUNTs + **5 COUNTs/sequence** (all discarded) + 2 signal queries; `force-dynamic`, zero cache | page.tsx:73–91; getCrmSavedViews.ts:113–118; getCrmStageCounts.ts:26–37; crm.ts:1004–1034 |
| `/admin/crm/[id]` | 4 sequential await-stages; 5 + (8+2) + 28-way batch (one member = ~16 internal queries + serial signed URLs) + 2; every inline edit `router.refresh()`es the whole thing | page.tsx:124, 157–206, 223–231; crm.ts:346–424; getPersonDetailExtras.ts:86–150 |
| Both pages | Mobile AND desktop trees SSR'd and shipped on every request | page.tsx (list) 222–301; page.tsx (detail) 482–499 |
| Detail nav | No `[id]/loading.tsx` → list skeleton shown during detail load | `ls app/admin/(protected)/crm/[id]/` |
| listCrmSequences on list page | 5×N COUNT queries to render a name-only dropdown | crm.ts:1016–1033 vs page.tsx:177–179 |

---

## 7. Duplication register

1. Market-report subscription editor ×3 on one page (§2.2.5).
2. Saved searches ×3 on one page, backed by **two different tables** (`getListingAlertsForLead` vs `getContactListingAlerts`) that can disagree (§2.2.5).
3. Automations/enrollments visible on 5 desktop surfaces + 1 mobile (§2.2.5).
4. CMA/BPO send ×3 (§2.2.5).
5. Contact-create ×2 with divergent fields (§4).
6. Merge ×2 (sidebar dialog vs bulk 2–10).
7. Bulk icon strip ×2 on the list (§1.3.5).
8. Timeline tab kind maps ×2 (`PersonCenterColumn.TAB_KINDS` vs `getPersonDetailExtras.TIMELINE_TAB_KINDS`).
9. `BROKER_HEADSHOT` literal map ×3 files (§5).
10. Two message-rendering components for the same rows: `EventCard` (desktop timeline) vs `ConversationFeed` (mobile comms/inbox).
11. Contact-point storage ×2 representations (`crm_contact_points` + jsonb mirrors) with 3 writers, only 2 of which mirror (§2.4).
12. Two flash systems (URL params vs sonner toasts) plus a third "no feedback at all" tier (§2.2.5).

---

## 8. Feature-parity matrix

Legend: ✓ works · ✓* works with caveat · ✗ absent · ☠ present but broken/dead.

| Capability | Desktop person detail | Mobile person detail | Desktop list row | Mobile list row |
|---|---|---|---|---|
| Call (tracked bridge) | ✓ LogCall "Call now" (PersonCenterColumn:444–453) | ✓ call circle → S8 sheet (bridge or tel:) | ☠ raw `tel:` untracked (PeopleListView:709) | ✗ |
| Log a call manually | ✓ | ✗ | ✗ | ✗ |
| Text (compliance path) | ✓ composer, group MMS, quiet hours; **no pending/reset** | ✓ Comms composer (same defects); Info SMS circle exits to inbox | ☠ raw `sms:` untracked (PeopleListView:701) | ✗ |
| Email compose | ✓ To/Cc/Bcc, attachments, templates; **no pending/reset** | ✗ (exits to inbox) | ☠ `mailto:` | ✗ |
| Note | ✓ | ✓ | ✗ | ✗ |
| Task create | ✓* name-only quick add + presets | ✓ full sheet (type/date) | ✗ (bulk only via workflows) | ✗ |
| Appointment create | ✗ (links away to calendar) | ✓ in-place AppointmentSheet | ✗ | ✗ |
| Tags add/remove | ✓ autocomplete chips; errors swallowed | ✓ sheet, plain input; errors swallowed | bulk only | ✗ |
| Stage change | ✓ inline select | ✓ picker | bulk only (5 clicks) | ✗ |
| Assign broker/pond | ✓ inline (server enforces superuser) | ✓ AssignToSheet | bulk (superuser) | ✗ |
| Edit name | ✗ | ✓ Edit sheet | ✗ | ✗ |
| Edit phones/emails | ✓ dialog / inline rows | ✓ Edit sheet + add rows | ✗ | ✗ |
| Edit address | ✓ inline | ✗ (view/maps only) | ✗ | ✗ |
| Edit price/lender/background | ✓ inline | ✗ (price shown as pill only) | ✗ | ✗ |
| Custom fields | ✓ editable (non-protected) | ✗ read-only | ✗ | ✗ |
| Source/timeframe | ✓ inline | ✓ pickers | bulk | ✗ |
| Merge | ✓ dialog (odd + icon) | ✗ | bulk 2–10 ids | ✗ |
| Delete | ✓ superuser (flash lost) | ✗ | bulk delete (superuser) | ✗ |
| Send CMA / BPO | ✓ ×3 surfaces | ✗ | ✗ | ✗ |
| Market-report sub | ✓ ×3 surfaces | ✗ | bulk | ✗ |
| Newsletter | ✓ chip/sheet | ✗ | bulk (ids only) | ✗ |
| Saved searches / alerts | ✓ ×3 surfaces (2 tables) | ✗ | bulk assign | ✗ |
| Deals view/add | ✓* view; add links away unscoped | ✗ | ✗ | ✗ |
| Files upload/link | ✓ | ✗ | ✗ | ✗ |
| Collaborators | ✓* (grants no access, §2.4) | ✓* same | bulk | ✗ |
| Automations enroll | ✓ (×3 surfaces) | ✓ Details row picker | bulk | ✗ |
| Timeline star | ✓ optimistic | ✗ | — | — |
| Full comms history | ☠ capped at 100, counts lie | ✓ paginated; ☠ new sends invisible | — | — |
| Activity feed | ✓ tab filter | ✓ Activity tab | last-activity col | ✗ |
| Search contacts | ☠ 3-click filter panel; partial email = 0 results | ✓ header search box | — | — |
| Bulk actions | ✓ 16 actions | ✗ (`max-md:hidden`) | — | — |
| Export / Import | ✓ | ✗ | — | — |
| Add person | ✓ dialog + /new page | ✗ (shell FAB only) | — | — |

**Where the switch happens:** pure CSS breakpoint at `md` (768px). Both trees are separate component families (no shared row/detail components) mounted simultaneously; no state is lost on resize because both instances live, but they hold independent state (desktop compose mode vs mobile tab) and share nothing. `?view=mobile` renders the mobile tree exclusively.

---

## 9. Dead routes / orphans / stubs

- `components/admin/crm/ContactActivityFeed.tsx` — zero importers (grep: only self + a doc-comment in GlobalActivityFeed).
- `components/admin/crm/NextStepCard.tsx` — zero importers; referenced only by a comment in `[id]/page.tsx:241`. The "next step" data (`getContactNextStep`) is still fetched every page view and used only for a boolean (`nextStep.ownsHome`) and CMA-review gating.
- `PersonSidebar` Social Profile + Groups sections — permanently empty (fed `[]`).
- Lead Score column — no model, permanent em-dash, in the default column set.
- "How it works" span (PersonCenterColumn:612), keyboard ←/→ hint (PersonRightRail:777), "SEE ALL" (MobileHomesTab:50) — inert UI text.
- `deleteCrmPersonAction`'s `?flash=` on the list — unread.
- `?view=mobile` — test-harness affordance in production.
- `openTasks = tasks.filter((t) => t)` no-op filter (PersonRightRail:445).

---

## 10. What is genuinely solid (keep in the rebuild)

- `buildCrmPeopleQuery` as the single AST→query compiler with scope clamped inside it (buildCrmPeopleQuery.ts:12–24) — the RBAC posture on reads and writes (self-scoping `listCrmPeople`, `getCrmPersonFull` guard, `requirePersonInScope` on every mutation) is consistent and correct.
- The bulk-job framework: preflight counts, suppression estimates, chunked worker, progress poller, view-scoped audiences.
- `sendCrmSmsAction`'s compliance chain: quiet hours, suppressions fail-closed, group-MMS via Conversations with per-member scope checks, dedupe keys on timeline inserts, click-tracking rewrite (crm.ts:732–938).
- SMS delivery-status reconcile with forward-only state transitions (crm-person-detail.ts:321–365).
- Canonical composer components (one SmsComposer/EmailComposer everywhere) — the right idea; they just need pending/reset/feedback semantics.
- Mobile Edit sheet, mobile picker-sheet pattern, `getContactConversation` cursor pagination, exact head-count discipline.
- `addRelationshipContactAction`'s dedupe-before-create with ambiguity refusal (crm-person-detail.ts:463–491).
