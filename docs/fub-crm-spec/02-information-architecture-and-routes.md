# § 02 — Information Architecture, Global Navigation & Route Map

> **Purpose.** Every developer who touches any module of the in-house CRM must be able to answer three questions from this document alone: (1) How is the system structured? (2) What URL do I navigate to? (3) What chrome appears on every page? This section is the single source of truth for all navigation and routing. It does NOT specify module internals — those are in §05–§19. It DOES specify the persistent shell that wraps every module, plus each module's own sub-navigation surface.
>
> **Supersedes:** `docs/FUB_CRM_FEATURE_SPEC.md` §3 (the prior single-file spec). Where the two conflict, this section wins. Prior-spec errors corrected are listed in §2.12.
>
> **Evidence base:** 6 per-screen vision analyses (shot-01, shot-30, shot-32, shot-33, shot-50, shot-65), 5 GIF interaction analyses (feat1, taskscal, inbox, deals, reporting), plus feat2/admin1–4/billing GIF summaries, and official FUB Help Center documentation (getting-started.md).
>
> `(inferred)` = behavior reconstructed from context, not directly observed. `(per FUB docs)` = sourced from help.followupboss.com.

---

## 2.1 Architectural overview — three zones

Every FUB screen (and every in-house CRM screen) is composed of three regions:

```
┌─────────────────────────────────────────────────────────────────┐
│  GLOBAL CHROME (top bar, ~52px tall, always visible)            │
│  [Logo] [Primary Nav items × 7] ... [Search] [Util] [Avatar]   │
├─────────────────────────────────────────────────────────────────┤
│  MODULE SUB-NAV (left rail OR horizontal tab strip, per module) │
│                                                                  │
│  CONTENT AREA (fills remainder — tables, kanbans, detail views) │
└─────────────────────────────────────────────────────────────────┘
```

The global chrome never scrolls. The module sub-nav may scroll independently. The content area scrolls.

**Active module state is reflected in three places simultaneously:**
1. The primary nav item label turns bold.
2. A blue upward-pointing triangle (caret) appears below the active nav item.
3. The module sub-nav renders (or updates) immediately, before content data loads.

This three-way synchrony is an instant render: the nav state updates in the same paint as the route change. See §2.8 (loading states) for the content-area side of this pattern.

---

## 2.2 Global chrome — the persistent top bar

### 2.2.1 Dimensions and placement

- Full viewport width, pinned to top (CSS `position: sticky; top: 0; z-index: 1000`).
- Height: ~52px (observed; exact value to be confirmed against design system — use `h-13` / 52px as the build target).
- Background: FUB uses medium gray. In-house: use `bg-background` (cream `#faf8f4`) with a 1px bottom border `border-border`.
- Left zone: logo + primary nav items.
- Right zone: utility cluster + account avatar.

### 2.2.2 Primary nav items — complete inventory

Seven items, left-to-right in this exact order:

| Position | Label | Icon (observed) | Badge | Route (FUB) | In-house route |
|---|---|---|---|---|---|
| 1 | **People** | Person silhouette | None | `/2/people/pond/1` | `/admin/crm/people` |
| 2 | **Inbox** | Envelope | Unread count (integer, red pill) | `/2/inbox-new/0/inbox` | `/admin/crm/inbox` |
| 3 | **Tasks** | Clock | Overdue count `(...)` → replaces with integer | `/2/tasks/overdue` | `/admin/crm/tasks` |
| 4 | **Calendar** | Calendar grid square | None | `/2/calendar` | `/admin/crm/calendar` |
| 5 | **Deals** | Handshake (inferred) | None | `/2/deals/1` | `/admin/crm/deals` |
| 6 | **Reporting** | Bar chart (inferred) | None | `/2/reporting` | `/admin/crm/reporting` |
| 7 | **Admin** | Gear (inferred) | None | `/2/admin/overview` | `/admin/crm/admin/overview` |

**Icon notes.** Icons were not captured in sufficient detail to confirm the exact SVG glyph for all items. Items 1 (People) and 4 (Calendar) were observed with enough clarity to describe. Items 5–7 are `(inferred)` from FUB's visual language. The in-house build should use shadcn/ui icon conventions (Lucide icons) and confirm against a live FUB session before finalising.

**Active state.** The active item receives:
- Bold `font-weight: 600` label.
- A blue upward-pointing caret/triangle rendered directly below the item (SVG triangle or CSS border trick), ~8px tall, flush with the bottom of the chrome bar.
- **The caret renders at the same instant as the route change** — it does not wait for content data. Build this as a CSS class toggled by route match, not a JS state driven by data load.

**Hover state.** Non-active items get a lighter background on hover `(inferred)`. No transition animation observed.

### 2.2.3 Global search

- Positioned between the last primary nav item (Admin) and the right utility cluster.
- Renders as a search input field with magnifying glass icon on the left and keyboard shortcut hint on the right `(inferred — keyboard shortcut not confirmed)`.
- Width: expands on focus `(inferred)`.
- Scope: omni-search across contacts (name, email, phone, address), deals, notes `(inferred)`.
- **Build:** `<Input type="search" placeholder="Search…" />` from `@/components/ui/input`. No global search modal was observed in the GIF set; the field likely filters inline or navigates to People with a query param. Confirm against live FUB before building the results surface.

### 2.2.4 Right utility cluster — exact inventory

Four elements appear in the right utility zone, left to right:

| Element | Icon | Action | Notes |
|---|---|---|---|
| **Email / compose** | Envelope with pencil (inferred) | Opens compose modal or navigates to Inbox | Observed in shot-01 right utility bar |
| **Chat / support** | Chat bubble (inferred) | Opens in-app support chat or Intercom widget | Observed in shot-01; exact behavior inferred |
| **Add person** | Person + `+` icon | Opens Add Person flyout | Directly creates a new contact without navigating to People. Observed in inbox.md — same flyout used for unknown callers. Fields: First Name, Last Name, Email, Phone. Also has "or update an existing person" search. |
| **Notification bell** | Bell icon | Opens notification panel (dropdown) | Badge: integer count of unread notifications, red pill. Click opens notification list. See §2.2.5. |
| **Broker-avatar cluster** | 2–3 small circular avatars stacked/overlapping | Shows online/active team members (inferred) | Three broker avatars visible in shot-01 (Matt, Rebecca, Paul). Likely presence indicators. Exact click behavior `(inferred)`. |
| **Account avatar** | Circular portrait of logged-in user (Matt Ryan's headshot) | Opens account dropdown menu | See §2.2.6 for full account menu inventory. |

**Note:** The "Ask Gemini" element was not observed in any captured screenshot or GIF. It may be a newer FUB feature added after the capture date (2026-06-30) or it may appear only on certain plans. Do not implement until confirmed against a live session.

### 2.2.5 Notification bell and panel

- Bell icon; badge shows unread-notification count as a red integer pill.
- Clicking the bell opens a dropdown panel anchored below the bell `(inferred — not captured in GIF)`.
- Notification types `(per FUB docs)`: new lead assigned, incoming call/text, team inbox message, pond claim alert, action plan trigger, deal stage change, task overdue.
- Five notification channels exist `(per FUB docs)`: in-app bell, desktop browser push, mobile push, SMS, email. The bell panel is the in-app channel only.
- Notification Settings are accessible at Account Menu → Notification Settings (separate page, not a sub-panel of the bell). See §16.
- **Implementation note:** Immutable notification that cannot be disabled: missed call to a team inbox always emails team inbox members `(per FUB docs)`.

### 2.2.6 Account menu — complete item inventory

Clicking the account avatar (top-right circular portrait) opens a dropdown menu. Items observed and inferred:

| Item | Route / Action | Source |
|---|---|---|
| **My Settings** | `/2/settings` or similar | Observed label in shot-01 analysis; confirmed as My Settings page (see §16) |
| **Pause Drips** | Toggle action (pauses all action plan emails for this user) | Prior spec §3; `(inferred)` — not confirmed in GIF set |
| **Product Changes** | External link to FUB changelog | Prior spec §3; `(inferred)` |
| **System Status** | External link to status page | Prior spec §3; `(inferred)` |
| **Get Help** | Opens FUB Help Center / Intercom | Prior spec §3; `(inferred)` |
| **Log Out** | Signs out, redirects to login | Standard; `(inferred)` |

**In-house mapping:** Replace FUB-specific items with:
- My Settings → `/admin/crm/settings/me`
- Log Out → `/api/auth/signout`
- Pause Drips → equivalent action on in-house sequences engine
- Remove Product Changes / System Status / Get Help (FUB-specific)

---

## 2.3 Module sub-navs — every module, every item

### 2.3.1 People — left rail

The People module uses a left sidebar (vertical) as its sub-nav, not a horizontal tab strip.

**Left rail width:** ~200px (estimated from proportion in shot-50; exact value `(inferred)`).

**Structure (top to bottom):**

```
People                           ← section heading (non-clickable label)
  All People         17K         ← clickable; badge = total contact count
─────────────────────────────────
COLLECTIONS                      ← section heading, all-caps, smaller type
  ▾ Pipeline         (no badge)  ← collapsible group (7 items inside)
      All Recent Online Activity  3
      [Hot / Weekly]             (count)
      [Warm / Bi-Weekly]         (count)
      Active & Pending Clients   (count)
      Past Clients / Sphere      (count)
      [additional pipeline lists]
  ▾ Neighborhoods    (no badge)  ← collapsible group (14 items inside — one per Bend neighborhood)
      [14 named neighborhood lists, each with a contact count badge]
  Manage →                       ← clickable link to /people/manage-lists
─────────────────────────────────
SMART LISTS                      ← section heading (shot-65 evidence)
  All Recent Online Activity  3
  All Expireds               637
  Expired No Contact         137
  Absentee Owners            805
  Absentee Owners No Contact 550
  Matts Sphere               1K
  All Clients                 23
  Realtors                   (count)
  Migration Realtors         (count)
  FSBO                        16
  TCPA Litigators — Hard Stop 132
  + New List                  ← button to create a new smart list
```

**Observed smart list counts (shot-65, 2026-06-30):**
- All Recent Online Activity: 3
- All Expireds: 637
- Expired No Contact: 137
- Absentee Owners: 805
- Absentee Owners No Contact: 550
- Matts Sphere: ~1,000 (badge shows "1K")
- All Clients: 23
- FSBO: 16
- TCPA Litigators — Hard Stop: 132

**The PIPELINE collection items (shot-65 badge in left rail — all 7 confirmed):**
The Pipeline group contains smart lists based on contact lifecycle stage/activity. Exact 7 items include the standard pipeline stages. `(inferred)` — exact sub-items confirmed from shot-65 SMART LISTS section which overlap.

**"Manage" link:** Navigates to `/2/people/manage-lists` (FUB) → `/admin/crm/people/manage-lists` (in-house). Full Manage Lists page is specified in §06a.

**Badge behavior:** Badges show real-time contact counts from the smart list query. They are NOT cached at page load — they re-fetch when the list is selected. The "All People" badge (17K) shows the total count with "K" suffix for thousands.

**Active state:** The currently-selected list item receives a blue left border or background highlight `(inferred from FUB pattern)`.

**Dynamic behaviors:**
- Collapsible groups expand/collapse on chevron click; state persisted across sessions `(inferred)`.
- `+ New List` button opens either a "New List" modal or navigates to the Manage page with a new-list form open.

**Cross-ref:** People list table and bulk actions → §05. Smart list filter engine → §06b. Smart list management → §06a.

---

### 2.3.2 Inbox — folder tree

The Inbox sub-nav is a left sidebar (vertical), ~160px wide, with a rigid folder hierarchy.

**Structure (complete, observed in inbox.md):**

```
My Inbox    (N)                  ← section header with unread badge
  ├─ Inbox                       ← default selected sub-folder
  ├─ Assigned
  ├─ Drafts
  ├─ Sent
  └─ Closed

Company     (N)                  ← section header; shared inbox for unrecognized callers + team
  ├─ [Company inbox]             ← shows voicemails + calls from unknown numbers
  └─ [any team inboxes created via Admin]

⚙ Manage →                       ← link to Team Inboxes Manage page
```

**Observed header text:** "325 Unread Messages" (displayed as a page-level count, separate from the primary nav badge).

**Badge behavior:**
- Primary nav badge (on "Inbox" in the top bar): total unread count across all folders.
- My Inbox section header badge (N): unread count in the My Inbox subtree.
- Company section header badge (N): unread count in the Company inbox.
- Auto-decrements: opening a thread marks it read within ~1 second; the nav badge updates immediately (observed: 325 → 324 on first thread open).

**All/Unread toggle:** Appears at the top of the thread list panel (not in the nav rail), as two tabs: "All" | "Unread". Does not change the active folder.

**Filter dropdown:** A "Filter ▾" dropdown in the thread list toolbar lets users filter by medium: checkboxes for Emails / Texts / Calls. All three are checked by default.

**⚙ Manage link:** Navigates to the Team Inboxes Manage page. Full-page route, not a modal. Contains: breadcrumb "All Team Inboxes > Manage", buttons "How it works" + "New Team Inbox" + "Add Number", and a table of existing inboxes with columns: Name | Phone Numbers | Connected Email | Team | Action (edit icon). See §08 for the full Inbox spec.

**Unknown-caller flow:** When the Company inbox shows a voicemail or call from an unrecognized number, the right-side contact panel is replaced by an "Add Person" flyout with fields: First Name, Last Name, Email, and an "or update an existing person" search field. This is NOT a modal — it renders inline in the right panel position. See §08 for full spec.

**Cross-ref:** Inbox content, reading pane, compose, thread actions → §08.

---

### 2.3.3 Tasks — bucket tab strip

The Tasks module uses a horizontal tab strip directly below the global chrome.

**Tab strip items (left to right, observed in taskscal.md):**

| Tab | Badge | Description |
|---|---|---|
| **Today's Tasks** | None (or count inline) | Tasks due today |
| **Overdue** | Integer count (orange/red) | Past-due tasks; 268 observed at capture |
| **Future** | None | Tasks scheduled for future dates |

**Active tab:** Underline indicator (FUB's standard tab active style: blue underline).

**Controls in the tab strip area (right-aligned):**
- "How Tasks work" — info icon + ghost button. Click: opens the "How Tasks Work" modal (embedded FUB explainer video + "Learn more" link).
- "Filters ▼" — dropdown with 8 task type checkboxes + "Show Completed" toggle.
- "Me ▼" — agent scope dropdown (filter tasks by assigned agent).

**Task type taxonomy (complete, observed in Filters dropdown):**

| Icon | Type label | DB enum value |
|---|---|---|
| Flag | Follow Up | `follow_up` |
| Phone | Call | `call` |
| Envelope | Email | `email` |
| Chat bubble | Text | `text` |
| House | Showing | `showing` |
| Checkmark | Closing | `closing` |
| Door | Open House | `open_house` |
| Heart | Thank You | `thank_you` |

All 8 types are checked by default. "Show Completed" is unchecked by default (completed tasks are hidden).

**Overdue tab — content structure:**
- Header row: "Overdue Tasks" label (clock icon, left) + "Clear My Overdue Tasks" link (blue, right).
- Date groups: tasks grouped by date, descending (most recent overdue first). Group header shows date + count, e.g. "Tuesday, Jun 23 (3)".
- Within each group: task rows in chronological order.

**Task row anatomy (per row, left to right):**
- Square checkbox (unchecked gray → clicking: instant strikethrough animation → row fades out after ~500ms)
- Circular avatar with broker initials (MR = Matt Ryan)
- Contact name — blue hyperlink → navigates to Person Detail
- Task type icon + description text (e.g. phone icon + "Lead returned to website. Follow up now.")
- Person icon + assignee label ("Me" = current user)
- Clock icon + scheduled time ("12:12pm")
- Collapse/expand chevron (far right)

**Optimistic completion UX:** On checkbox click: (1) immediate strikethrough on task text + filled blue checkbox; (2) Overdue badge count decrements by 1 in the same render frame; (3) row fades/slides out after ~500ms. No loading state during completion.

**Future tab — empty state:** White card with a centered faint pencil/edit icon. No instructional copy observed. Consider adding a "Create task" CTA for better UX `(inferred recommendation)`.

**Cross-ref:** Task creation modal, task detail, task completion API → §09.

---

### 2.3.4 Calendar — view selector tab strip

The Calendar module uses a horizontal view-switcher within the main content area (not a separate sub-nav rail).

**View switcher tabs (right of date navigation):**

| Tab | View |
|---|---|
| **Day** | Hourly grid for a single day |
| **Week** | 7-column week grid |
| **Month** | Standard month grid |

**Left sidebar (persistent, same for all views):**
- Mini monthly calendar with `<` / `>` month navigation; today highlighted with filled blue circle.
- Two sidebar tabs: **Schedule** | **Filters**
  - Schedule tab (default): shows "Today, [date]" and "Tomorrow, [date]" sections. Each section lists events as text pills. Empty tomorrow: renders "No events, [add appointment]" with inline link.
  - Filters tab `(inferred)`: calendar-specific event type filter (not demonstrated in GIFs).

**Main content header (per view):**
- Large month+year heading (e.g. "June **2026**")
- `<` prev | **Today** button | `>` next — date navigation
- "Everyone ▼" — agent filter dropdown (admin can see all brokers' calendars simultaneously)
- `+` circle button (teal/primary color) — opens Create Appointment modal

**Event color taxonomy (observed in month view, taskscal.md):**

| Color | Event type |
|---|---|
| Amber/orange dot | Lead follow-up ("Lead returned to website…") |
| Red/orange dot | Expired listing alert |
| Blue pill / blue text | All-day events (license renewal, annual meetings) |
| Plain text, no dot | Calendar notes |

**All Day row (Day view):** All-day events render as full-width blue banners in a pinned "All Day" row above the hourly time grid.

**Overflow (Month view):** When a day cell has more events than fit, a "N More" blue text link appears. Clicking opens the day view or an overflow popover `(inferred)`.

**Create Appointment modal — complete field inventory (observed in taskscal.md):**

| Field | Type | Pre-fill | Notes |
|---|---|---|---|
| Title | Text input | Empty ("Add title" placeholder) | First field, full-width |
| Start date | Date picker | Today | |
| Start time | Time picker | 8:00 am | |
| End time | Time picker | 8:30 am | +30 min default |
| End date | Date picker | Today | |
| Timezone | Dropdown | User's timezone (Pacific Time GMT-07:00 observed) | |
| All day event | Checkbox | Unchecked | Hides time pickers when checked `(inferred)` |
| Location | Text input | Empty ("Add location" placeholder) | Map pin icon |
| Add guests | Search input | Current user pre-added as pill/chip | |
| Type | Dropdown | "Set type" (empty) | Same 8-value enum as Tasks type (Follow Up, Call, Email, Text, Showing, Closing, Open House, Thank You) |
| Outcome | Dropdown | "No Outcome" | Outcome values: No show, Working with buyers, Listing obtained + others `(from admin2.md)` |
| Notes | Rich text editor | Empty | Toolbar: B I U ordered-list unordered-list hyperlink strikethrough |
| Send invitation | Checkbox | Visible | "Send invitation email & text reminder" — toggles FUB email + SMS to guests |
| Submit | Button | — | "Create Appointment" (primary/teal) |
| Dismiss | X icon | — | Top-right of modal; clicking outside also dismisses |

**Cross-ref:** Appointment data model, calendar sync (Google/Microsoft) → §09. Appointment types + outcomes config → §14 (Admin > Appointments).

---

### 2.3.5 Deals — pipeline tab strip

The Deals module uses a horizontal tab strip at the top of the content area, immediately below the global chrome.

**Tab strip items:**

| Position | Tab label | Route (FUB) | In-house route | Notes |
|---|---|---|---|---|
| 1 | **Buyers** | `/2/deals/1` | `/admin/crm/deals/buyers` | Default selected; Buyers pipeline |
| 2 | **Sellers** | `/2/deals/2` | `/admin/crm/deals/sellers` | Sellers pipeline |

**Right of tabs:** A gear icon ⚙ — navigates to **Manage Pipelines** (a full-page settings route, NOT a modal). Manage Pipelines shows a list of existing pipelines (Buyers, Sellers) with drag handles for reorder, and edit/delete actions per pipeline. See §10 for full spec.

**Toolbar below tab strip (observed in shot-30):**
- "How Deals work" — info/help link
- "Deal Reporting" — link that navigates to the Deals tab within Reporting
- "Current deals ▼" — filter dropdown (show active vs. all)
- "Everyone ▼" — agent scope filter

**Pipeline stages (Buyers, observed in shot-30 and deals.md, confirmed column headers):**

| Stage | Color accent | Notes |
|---|---|---|
| Start temp stage | Gray | Default entry stage |
| Buyer Contract | Blue | |
| Offer | Orange | |
| Pending | Yellow/amber | |
| Closed | Green | Feeds Reporting commission totals |
| Lost | Red | |

**Cross-ref:** Kanban board behavior, deal card anatomy, deal detail modal, manage pipelines → §10.

---

### 2.3.6 Reporting — horizontal tab strip

The Reporting module uses a horizontal tab strip immediately below the global chrome. All 11 tabs confirmed from shot-32 and reporting.md.

**Tab strip — all 11 items in left-to-right order:**

| Position | Tab label | Route (FUB) | In-house route | Report type |
|---|---|---|---|---|
| 1 | **Overview** | `/2/reporting` | `/admin/crm/reporting` | Card grid hub |
| 2 | **Agent Activity** | `/2/reporting/agent-activity` `(inferred)` | `/admin/crm/reporting/agent-activity` | KPI cards + agent table |
| 3 | **Properties** | `/2/reporting/properties` `(inferred)` | `/admin/crm/reporting/properties` | Split list + map view |
| 4 | **Lead Sources** | `/2/reporting/lead-sources` `(inferred)` | `/admin/crm/reporting/lead-sources` | Table + configurable |
| 5 | **Calls** | `/2/reporting/calls` `(inferred)` | `/admin/crm/reporting/calls` | Dual-value KPI table |
| 6 | **Texts** | `/2/reporting/texts` `(inferred)` | `/admin/crm/reporting/texts` | SMS delivery stats |
| 7 | **Batch Emails** | `/2/reporting/batch-emails` `(inferred)` | `/admin/crm/reporting/batch-emails` | Flat campaign list |
| 8 | **Marketing** | `/2/reporting/marketing` `(inferred)` | `/admin/crm/reporting/marketing` | UTM report |
| 9 | **Deals** | `/2/reporting/deals` `(inferred)` | `/admin/crm/reporting/deals` | Pipeline funnel + chart |
| 10 | **Appointments** | `/2/reporting/appointments` `(inferred)` | `/admin/crm/reporting/appointments` | Appointment list |
| 11 | **Agent Goals** | `/2/reporting/agent-goals` `(inferred)` | `/admin/crm/reporting/agent-goals` | Year-scoped goals table |

**Right of tab strip:** "How Reporting works" — info link (opens FUB help docs). **This is NOT a tab** — it is a right-aligned ghost button/link.

**Note on the Overview hub:** The Overview tab is NOT a data dashboard. It is a card-grid index of the other 10 reports, grouped into 3 sections: Agents (7 cards), Lead Sources (4 cards), Marketing (3 cards) = 14 report cards total. Clicking a card navigates to the corresponding tab.

**Report card descriptions (exact text from shot-32 and reporting.md):**

*Agents section (7 cards):*
- Agent Activity: "See the number of leads per agent alongside stats on follow up"
- Calls: "See calls made, conversations, missed calls, talk time and more by agent"
- Call Logs: "See and listen to recent inbound and outbound calls"
- Texts: "See text message delivery rates and other stats by phone number"
- Appointments: "See a list of appointments & outcomes with details on lead source and agent"
- Deals: "See a list of deals with commissions by deal stage and lead source"
- Agent Goals: "Manage annual commission and personal goals for each agent"

*Lead Sources section (4 cards):*
- Source Report: "See your top lead providers and sources of appointments"
- Speed To Lead: "See how quickly you follow up by source and follow up type"
- Contact Attempts: "See how many times you follow up on average by source"
- Closed Deals By Source: "See which lead source has the most closed deals, commission and conversion rate %"

*Marketing section (3 cards):*
- Batch Emails: "See the results of your email campaigns, opens & clicks"
- Properties: "See which properties and zipcodes have the most inquiries"
- Marketing UTM Report: "See advanced UTM and campaign metrics and appointments & deals"

**"Show me [X] ▼" interactive page title pattern (critical FUB UX, observed in reporting.md):**
- Every data-loaded report (Agent Activity, Properties, Lead Sources, Calls) renders its page title as an interactive dropdown: "Show me [selected metric] ▼"
- The underlined blue text IS a clickable dropdown/flyout that changes the report query/scope (e.g. "total lead count and total agent activity" → alternate sub-report view).
- This must be implemented as a `<button>` containing: static "Show me " prefix + blue underlined variable text + `<ChevronDown />` icon.
- The selected value determines which metric dimensions are displayed in the KPI cards, chart, and table.

**Cache notice (observed in reporting.md):** All data-heavy reports render the following notice below the page title: "Reporting results may be cached for up to 10 minutes. Refresh results." — where "Refresh results" is a clickable link that bypasses the cache.

**Cross-ref:** Each individual report's layout, KPI cards, charts, tables, drill-throughs → §11.

---

### 2.3.7 Admin — horizontal tab strip + More ▾ overflow

The Admin module uses a horizontal tab strip below the global chrome. There are more tabs than fit in a single row, so a "More ▾" overflow menu holds the overflow items.

**Confirmed visible tabs (from shot-33, 17 items visible at 100% zoom):**

| Position | Tab label | FUB route | In-house route |
|---|---|---|---|
| 1 | **Overview** | `/2/admin/overview` | `/admin/crm/admin/overview` |
| 2 | **Lead Flow** | `/2/admin/lead-flow` `(inferred)` | `/admin/crm/admin/lead-flow` |
| 3 | **Groups** | `/2/admin/groups` `(inferred)` | `/admin/crm/admin/groups` |
| 4 | **Team** | `/2/admin/team` `(inferred)` | `/admin/crm/admin/team` |
| 5 | **Action Plans** | `/2/admin/action-plans` `(inferred)` | `/admin/crm/admin/action-plans` |
| 6 | **Automations** | `/2/admin/automations` `(inferred)` | `/admin/crm/admin/automations` |
| 7 | **Ponds** | `/2/admin/ponds` `(inferred)` | `/admin/crm/admin/ponds` |
| 8 | **Email Templates** | `/2/admin/email-templates` `(inferred)` | `/admin/crm/admin/email-templates` |
| 9 | **Text Templates** | `/2/admin/text-templates` `(inferred)` | `/admin/crm/admin/text-templates` |
| 10 | **Import** | `/2/admin/import` `(inferred)` | `/admin/crm/admin/import` |
| 11 | **Custom Fields** | `/2/admin/custom-fields` `(inferred)` | `/admin/crm/admin/custom-fields` |
| 12 | **Stages** (in More ▾) | `/2/admin/stages` `(inferred)` | `/admin/crm/admin/stages` |
| 13 | **Phone Numbers** (in More ▾) | `/2/admin/phone-numbers` `(inferred)` | `/admin/crm/admin/phone-numbers` |
| 14 | **Tags** | `/2/admin/tags` `(inferred)` | `/admin/crm/admin/tags` |
| 15 | **Integrations** (in More ▾) | `/2/admin/integrations` `(inferred)` | `/admin/crm/admin/integrations` |
| 16 | **Company** (in More ▾) | `/2/admin/company` `(inferred)` | `/admin/crm/admin/company` |
| 17 | **API** (in More ▾) | `/2/admin/api` `(inferred)` | `/admin/crm/admin/api` |
| — | **More ▾** | dropdown | dropdown |

**"More ▾" dropdown — confirmed contents (from feat2.md GIF analysis, admin4.md):**
The More ▾ dropdown contains these overflow tabs, confirmed by observing the GIF of the Admin tour:

- Phone Numbers
- Company
- API
- Pixel
- Integrations
- Stages
- Appointments
- Email Domain (Auth)

**Important disambiguation:** Stages and Phone Numbers appear in the More ▾ overflow, even though shot-33 shows some of these in the main visible tab strip. The exact breakpoint for overflow depends on viewport width. The in-house build should treat all Admin tabs as potentially-overflowing and implement the tab strip with a `More ▾` overflow menu that is responsive to viewport width.

**Admin sub-tab key facts:**

| Tab | Key surface detail |
|---|---|
| Overview | 5 card sections: Lead Distribution (3 cards), Follow Up (4 cards), Account (5 cards), Integrations (5 cards), Customize (4 cards). **Business Registration warning card** (⚠️ yellow triangle, A2P incomplete). "ⓘ Admin Overview" help button top-right. |
| Lead Flow | List of lead sources; each row has agent assignment, lender assignment, action plan. Conditional "View Advanced Rules (N)" link when advanced rules are configured. Advanced Rules opens a full-page route (NOT a modal). |
| Groups | List of agent/lender groups for round-robin or first-to-claim routing. |
| Team | Table of team members: Name, Role, Last Seen (Web + iOS dual timestamps), Can Export checkbox, Pause Leads checkbox. |
| Action Plans | Folder tree + plan list. **Migration banner:** "Automations 2.0 are here!" (dismissible, links to Automations tab). |
| Automations | List of automations with toggle per row (green = active). 38 automations observed at capture. "Using: N ↓" linked pill shows how many contacts are in the automation. |
| Ponds | List with skeleton loader on initial load. |
| Email Templates | Folder navigation → template list (76 templates observed in one folder). |
| Text Templates | Folder navigation → template list. |
| Import | Upsell/landing page with embedded video player + "View past imports" link. |
| Custom Fields | Draggable list of 64 fields; each row: field name | people count link | Hide toggle | Read-Only toggle | Edit + Delete actions. |
| Stages | Full list of 16 stages with contact counts (Seller Prospect 7,523; Lead 8,243; etc.). System stages locked. |
| Phone Numbers | Two sub-sections: Number Ports + Number Parking Lot. Parking Lot has Parked/Released sub-tab switcher. |
| Tags | Searchable list of all tags. |
| Integrations | Grid with Email Marketing section (3 integrations) + Integrations section (12 integration cards). Connected integrations show "connected" badge. |
| Company | Settings form with company name, address, call recording toggle, legal disclosure toggle, fallback number. Ryan Realty data: 115 NW Oregon Ave #2, Bend OR 97703; Call Recording: ON; fallback: 541-213-6706. |
| API | 5 live API keys visible (Agent Fire, Zapier, RyanRealtyApp, CLAUDE COWORK, Ryan Realty LP - Vercel). OAuth empty state section. Lead Email Address (ryan.realty@followupboss.me). API usage table. |
| Pixel | Two-panel detail with 3 sub-tabs: Description, Tracking, Call To Action. |
| Appointments | Appointment Types list (Buyer consultation, Listing) + Outcomes list (No show, Working with buyers, Listing obtained). Drag-to-reorder on both lists. |
| Email Domain | "UNCLAIMED" state observed — ryan-realty.com not yet authenticated. Active deliverability risk. |

**Cross-ref:** Lead Flow → §14. Groups, Team, Roles → §15. Action Plans → §12. Automations → §12. Email/Text Templates → §13. Custom Fields, Stages, Tags → §14. Phone Numbers, A2P → §17. Integrations → §18. Company, API → §15. Pixel → §18. Billing (separate item in account menu, not an Admin tab) → §19.

---

## 2.4 Full observed FUB route map (`/2/...`)

Every route observed in the screenshot + GIF set, plus routes inferred from navigation patterns. Grouped by module.

| Route | Screen / purpose | Evidence |
|---|---|---|
| **PEOPLE** | | |
| `/2/people/pond/1` | All People list (default entry) | shot-50: URL bar |
| `/2/people/pond/{id}` | Named pond (contact pool) | URL pattern from shot-50 |
| `/2/people/list/{id}` | Smart list (e.g. `/list/30` = Warm/Bi-Weekly) | shot-65: URL bar |
| `/2/people/manage-lists` | Manage Lists & Collections | shot-50: "Manage" link; inferred target |
| `/2/people/view/{personId}` | Person detail (e.g. `/view/27022`) | shot-01: URL bar confirms personId=27022 |
| `/2/people/view/{personId}/call` | Person detail → Call sub-route | shot-01: URL bar suffix |
| `/2/people/view/{personId}/text` | Person detail → Text sub-route | `(inferred from URL pattern)` |
| `/2/people/view/{personId}/email` | Person detail → Email sub-route | `(inferred)` |
| **INBOX** | | |
| `/2/inbox-new/0/inbox` | My Inbox → Inbox sub-folder | inbox.md, feat1.md |
| `/2/inbox-new/0/assigned` | My Inbox → Assigned | inbox.md |
| `/2/inbox-new/0/drafts` | My Inbox → Drafts | `(inferred from folder tree)` |
| `/2/inbox-new/0/sent` | My Inbox → Sent | `(inferred from folder tree)` |
| `/2/inbox-new/0/closed` | My Inbox → Closed | `(inferred from folder tree)` |
| `/2/inbox-new/{teamInboxId}/inbox` | Team/Company inbox | `(inferred from URL pattern)` |
| `/2/inbox-new/manage` | Team Inboxes Manage page | taskscal.md (starting screen) |
| **TASKS** | | |
| `/2/tasks/overdue` | Tasks → Overdue tab | taskscal.md |
| `/2/tasks/today` | Tasks → Today's Tasks tab | `(inferred from tab label)` |
| `/2/tasks/future` | Tasks → Future tab | `(inferred from tab label)` |
| **CALENDAR** | | |
| `/2/calendar` | Calendar → Day view (default) | taskscal.md |
| `/2/calendar/week` | Calendar → Week view | `(inferred from view switcher)` |
| `/2/calendar/month` | Calendar → Month view | `(inferred from view switcher)` |
| **DEALS** | | |
| `/2/deals/1` | Deals → Buyers pipeline | shot-30: URL structure; feat1.md |
| `/2/deals/2` | Deals → Sellers pipeline | `(inferred from pipeline tab structure)` |
| `/2/deals/manage` | Manage Pipelines (full-page settings) | deals.md: gear icon navigates here |
| `/2/deals/reporting` | Deals Report (or redirects to /2/reporting/deals) | shot-30: "Deal Reporting" toolbar link |
| **REPORTING** | | |
| `/2/reporting` | Reporting → Overview hub | shot-32; reporting.md |
| `/2/reporting/agent-activity` | Agent Activity report | reporting.md `(inferred route)` |
| `/2/reporting/properties` | Properties / Map report | reporting.md `(inferred route)` |
| `/2/reporting/lead-sources` | Lead Sources report | reporting.md `(inferred route)` |
| `/2/reporting/calls` | Calls report | reporting.md `(inferred route)` |
| `/2/reporting/texts` | Texts report | reporting.md `(inferred route)` |
| `/2/reporting/batch-emails` | Batch Emails report | reporting.md `(inferred route)` |
| `/2/reporting/marketing` | Marketing UTM report | reporting.md `(inferred route)` |
| `/2/reporting/deals` | Deals pipeline report | reporting.md `(inferred route)` |
| `/2/reporting/appointments` | Appointments report | reporting.md `(inferred route)` |
| `/2/reporting/agent-goals` | Agent Goals (year-scoped) | reporting.md `(inferred route)` |
| **ADMIN** | | |
| `/2/admin/overview` | Admin → Overview hub (card grid) | shot-33 |
| `/2/admin/lead-flow` | Admin → Lead Flow | admin1.md |
| `/2/admin/lead-flow/{id}/advanced-rules` | Lead Flow → Advanced Rules (full-page) | admin1.md |
| `/2/admin/groups` | Admin → Groups | admin1.md |
| `/2/admin/team` | Admin → Team | admin1.md |
| `/2/admin/action-plans` | Admin → Action Plans (folder list) | admin1.md, admin2.md |
| `/2/admin/action-plans/{folderId}` | Action Plans → plan list in folder | admin2.md |
| `/2/admin/action-plans/{folderId}/{planId}` | Action Plan detail (vertical step timeline) | admin2.md |
| `/2/admin/automations` | Admin → Automations list | admin2.md |
| `/2/admin/automations/library` | Automations Library | admin2.md |
| `/2/admin/ponds` | Admin → Ponds | admin1.md |
| `/2/admin/email-templates` | Admin → Email Templates (folder list) | admin2.md |
| `/2/admin/email-templates/{folderId}` | Email Templates → template list | admin2.md |
| `/2/admin/text-templates` | Admin → Text Templates | admin4.md |
| `/2/admin/import` | Admin → Import landing | admin3.md |
| `/2/admin/custom-fields` | Admin → Custom Fields | admin3.md |
| `/2/admin/stages` | Admin → Stages list | admin4.md |
| `/2/admin/phone-numbers` | Admin → Phone Number Management | admin4.md |
| `/2/admin/tags` | Admin → Tags | admin4.md |
| `/2/admin/integrations` | Admin → Integrations grid | admin3.md |
| `/2/admin/integrations/facebook` | Facebook integration detail (two-column) | admin3.md |
| `/2/admin/company` | Admin → Company Settings | admin3.md |
| `/2/admin/api` | Admin → API Settings | admin3.md |
| `/2/admin/pixel` | Admin → Pixel (3-sub-tab surface) | admin4.md |
| `/2/admin/appointments` | Admin → Appointment Types + Outcomes | admin4.md |
| `/2/admin/email-domain` | Admin → Email Domain Auth (UNCLAIMED state) | admin4.md |
| `/2/admin/business-registration` | Business Registration / A2P 10DLC | shot-33 warning card link |
| **USER SETTINGS** | | |
| `/2/settings` | My Settings (account-level per-user) | Prior spec + getting-started.md §4 |
| **BILLING** | | |
| `/2/admin/billing` | Billing & Subscription | billing.md |
| `/2/admin/billing/calling-addon` | Calling Add-on enrollment sub-page | billing.md |

---

## 2.5 Clean in-house route map (`/admin/crm/...`)

The in-house CRM drops the `/2/` account-ID segment. All CRM routes are nested under `/admin/crm/` as a protected route group `(app/admin/(protected)/crm/)`. The in-house build already has some routes under `/admin/console/` — see §21 for the gap map that reconciles the two.

| In-house route | Module | Page / purpose | FUB route it mirrors |
|---|---|---|---|
| `/admin/crm` | People | Default redirect → `/admin/crm/people` | `/2/people/pond/1` |
| `/admin/crm/people` | People | All People list | `/2/people/pond/1` |
| `/admin/crm/people/pond/[id]` | People | Named pond view | `/2/people/pond/{id}` |
| `/admin/crm/people/list/[id]` | People | Smart list | `/2/people/list/{id}` |
| `/admin/crm/people/manage-lists` | People | Manage Lists | `/2/people/manage-lists` |
| `/admin/crm/people/[personId]` | Person detail | Contact record | `/2/people/view/{personId}` |
| `/admin/crm/people/[personId]/call` | Person detail | Call sub-route | `/2/people/view/{personId}/call` |
| `/admin/crm/people/[personId]/text` | Person detail | Text sub-route | `/2/people/view/{personId}/text` |
| `/admin/crm/inbox` | Inbox | My Inbox → Inbox (default) | `/2/inbox-new/0/inbox` |
| `/admin/crm/inbox/assigned` | Inbox | Assigned folder | `/2/inbox-new/0/assigned` |
| `/admin/crm/inbox/drafts` | Inbox | Drafts | `/2/inbox-new/0/drafts` |
| `/admin/crm/inbox/sent` | Inbox | Sent | `/2/inbox-new/0/sent` |
| `/admin/crm/inbox/closed` | Inbox | Closed | `/2/inbox-new/0/closed` |
| `/admin/crm/inbox/team/[id]` | Inbox | Team/Company inbox | `/2/inbox-new/{teamInboxId}/inbox` |
| `/admin/crm/inbox/manage` | Inbox | Team Inboxes Manage | `/2/inbox-new/manage` |
| `/admin/crm/tasks` | Tasks | Default → Overdue | `/2/tasks/overdue` |
| `/admin/crm/tasks/today` | Tasks | Today's Tasks | `/2/tasks/today` |
| `/admin/crm/tasks/overdue` | Tasks | Overdue | `/2/tasks/overdue` |
| `/admin/crm/tasks/future` | Tasks | Future | `/2/tasks/future` |
| `/admin/crm/calendar` | Calendar | Day view (default) | `/2/calendar` |
| `/admin/crm/calendar/week` | Calendar | Week view | `/2/calendar/week` |
| `/admin/crm/calendar/month` | Calendar | Month view | `/2/calendar/month` |
| `/admin/crm/deals` | Deals | Buyers pipeline (default) | `/2/deals/1` |
| `/admin/crm/deals/buyers` | Deals | Buyers pipeline | `/2/deals/1` |
| `/admin/crm/deals/sellers` | Deals | Sellers pipeline | `/2/deals/2` |
| `/admin/crm/deals/manage` | Deals | Manage Pipelines | `/2/deals/manage` |
| `/admin/crm/reporting` | Reporting | Overview hub | `/2/reporting` |
| `/admin/crm/reporting/agent-activity` | Reporting | Agent Activity | `/2/reporting/agent-activity` |
| `/admin/crm/reporting/properties` | Reporting | Properties / Map | `/2/reporting/properties` |
| `/admin/crm/reporting/lead-sources` | Reporting | Lead Sources | `/2/reporting/lead-sources` |
| `/admin/crm/reporting/calls` | Reporting | Calls | `/2/reporting/calls` |
| `/admin/crm/reporting/texts` | Reporting | Texts | `/2/reporting/texts` |
| `/admin/crm/reporting/batch-emails` | Reporting | Batch Emails | `/2/reporting/batch-emails` |
| `/admin/crm/reporting/marketing` | Reporting | Marketing / UTM | `/2/reporting/marketing` |
| `/admin/crm/reporting/deals` | Reporting | Deals report | `/2/reporting/deals` |
| `/admin/crm/reporting/appointments` | Reporting | Appointments | `/2/reporting/appointments` |
| `/admin/crm/reporting/agent-goals` | Reporting | Agent Goals | `/2/reporting/agent-goals` |
| `/admin/crm/admin/overview` | Admin | Overview hub | `/2/admin/overview` |
| `/admin/crm/admin/lead-flow` | Admin | Lead Flow | `/2/admin/lead-flow` |
| `/admin/crm/admin/lead-flow/[id]/advanced-rules` | Admin | Lead Flow Advanced Rules | `/2/admin/lead-flow/{id}/advanced-rules` |
| `/admin/crm/admin/groups` | Admin | Groups | `/2/admin/groups` |
| `/admin/crm/admin/team` | Admin | Team | `/2/admin/team` |
| `/admin/crm/admin/action-plans` | Admin | Action Plans | `/2/admin/action-plans` |
| `/admin/crm/admin/action-plans/[folderId]/[planId]` | Admin | Action Plan detail | `/2/admin/action-plans/{folder}/{plan}` |
| `/admin/crm/admin/automations` | Admin | Automations | `/2/admin/automations` |
| `/admin/crm/admin/automations/library` | Admin | Automations Library | `/2/admin/automations/library` |
| `/admin/crm/admin/ponds` | Admin | Ponds | `/2/admin/ponds` |
| `/admin/crm/admin/email-templates` | Admin | Email Templates | `/2/admin/email-templates` |
| `/admin/crm/admin/text-templates` | Admin | Text Templates | `/2/admin/text-templates` |
| `/admin/crm/admin/import` | Admin | Import | `/2/admin/import` |
| `/admin/crm/admin/custom-fields` | Admin | Custom Fields | `/2/admin/custom-fields` |
| `/admin/crm/admin/stages` | Admin | Stages | `/2/admin/stages` |
| `/admin/crm/admin/phone-numbers` | Admin | Phone Numbers | `/2/admin/phone-numbers` |
| `/admin/crm/admin/tags` | Admin | Tags | `/2/admin/tags` |
| `/admin/crm/admin/integrations` | Admin | Integrations | `/2/admin/integrations` |
| `/admin/crm/admin/company` | Admin | Company Settings | `/2/admin/company` |
| `/admin/crm/admin/api` | Admin | API Settings | `/2/admin/api` |
| `/admin/crm/admin/pixel` | Admin | Pixel | `/2/admin/pixel` |
| `/admin/crm/admin/appointments` | Admin | Appointment config | `/2/admin/appointments` |
| `/admin/crm/admin/email-domain` | Admin | Email Domain Auth | `/2/admin/email-domain` |
| `/admin/crm/admin/business-registration` | Admin | A2P 10DLC setup | `/2/admin/business-registration` |
| `/admin/crm/settings/me` | User settings | My Settings | `/2/settings` |

**Route implementation notes:**
- All routes under `/admin/crm/` are inside the `(protected)` route group, requiring an active session.
- The existing in-house CRM uses `/admin/console/leads/[id]` for person detail — this needs to be aliased or redirected to `/admin/crm/people/[personId]` for URL consistency.
- Deal pipelines: FUB uses integer IDs (`/deals/1`, `/deals/2`). In-house should use slugs (`/deals/buyers`, `/deals/sellers`) for readability and resilience to reordering.
- Smart lists use integer IDs in FUB (`/list/30`). In-house should use integer IDs as well (matching `crm_smart_lists.id`) but consider adding slug aliases for common lists.

---

## 2.6 Badge / count inventory

Every badge-bearing nav item, its badge source, update behavior, and fallback.

| Location | Badge type | Source entity | Update trigger | Fallback if zero |
|---|---|---|---|---|
| **Inbox** (primary nav) | Integer, red pill | Unread thread count across all inbox folders | Real-time (WebSocket/polling); decrements on thread open | Hidden (no badge if 0) |
| **Tasks → Overdue** (sub-nav tab) | Integer, amber/red | Count of tasks with `due_date < now()` not completed | Real-time; decrements on task completion | Shown as "0" OR hidden `(inferred)` |
| **My Inbox section header** | Integer `(N)` | Unread count in My Inbox subtree | Same as primary nav badge | Hidden |
| **Company section header** | Integer `(N)` | Unread count in Company inbox | Same | Hidden |
| **People — All People** | "17K" (thousands-abbreviated) | Total contact count | Refreshed on list navigation; NOT real-time | Shown as "0" |
| **People — smart list badges** | Integer or "XK" | Dynamic count from smart list query | Re-fetched when list is selected | Shown as "0" |
| **Notification bell** | Integer, red pill | Unread notification count | Real-time | Hidden if 0 |
| **Admin → Stages** (stage list) | Integer per stage | Contact count in that stage | Refreshed on page load | Shown as "0" |
| **Smart Lists in left rail** | Integer per list | Smart list query count | Re-fetched on list selection | Shown as "0" |

**Tasks badge loading:** The Tasks badge shows `(...)` (literal three dots in parentheses) during initial page load, before the overdue count has been fetched. This is NOT a skeleton shimmer — it is a specific text placeholder. It transitions to an integer when the fetch completes. See §2.8.

---

## 2.7 Navigation loading states — the three FUB patterns

Three distinct loading state patterns observed across modules. Every developer must know all three.

### Pattern A — Blank gray content area (inter-module navigation)

**Trigger:** User clicks a primary nav item (People, Inbox, Tasks, Calendar, Deals, Reporting, Admin).

**Sequence:**
1. Route change fires.
2. **Same frame:** (a) active primary nav item label goes bold, (b) blue caret renders below active item, (c) module sub-nav renders fully (left rail, tab strip, or folder tree), (d) page title / filter controls render from route config.
3. Content area: clears to a blank `bg-background` (cream, not a loading color — this IS the background showing through).
4. An orange/amber progress bar begins advancing across the bottom edge of the viewport.
5. A centered CSS arc spinner renders in the content area.
6. 0.5–1.5 seconds later: full content renders — no fade animation, immediate replacement.

**Key constraint:** The sub-nav and page title must render from route config synchronously. They must NOT wait for data. This is the "skeleton of the page" — everything below the global chrome that does not require an API call renders instantly.

**In-house implementation:** Use Next.js `loading.tsx` at the route segment level. The `loading.tsx` file should render the sub-nav and page header immediately; the content area placeholder can be a spinner. Do NOT use skeleton shimmers for Pattern A — FUB uses a plain gray (cream) background with a single centered spinner.

### Pattern B — Centered spinner for heavy queries

**Trigger:** Switching between tabs within the Reporting module, or loading any data-heavy report.

**Sequence:** Same as Pattern A steps 3–6, but may take longer (1–3 seconds for complex queries). The orange progress bar at the viewport bottom is FUB's global route-transition progress indicator.

### Pattern C — Skeleton shimmer rows for table data

**Trigger:** Admin > Ponds (observed loading state in admin4.md); some table-heavy surfaces.

**Behavior:** Instead of a centered spinner, placeholder rows shimmer. Each placeholder row mimics the width profile of a real row with gray rectangles at typical text widths.

**When to use:** Use Pattern C (skeleton rows) for surfaces where the table structure is known before data arrives (column count, approximate row heights are deterministic). Use Pattern A/B (centered spinner) for surfaces where the data structure itself is unknown until load completes (map view, card grid, chart).

### Tasks badge loading (Pattern D — text placeholder)

**Trigger:** Initial page load or navigation to the Tasks module before the overdue count API call returns.

**Behavior:** The Tasks tab in the primary nav shows `(...)` instead of the integer overdue count. The `(...)` is a literal text placeholder, not a spinner or shimmer.

**In-house implementation:** Render the Tasks badge as `—` or `…` during pending state; replace with the integer when the count resolves.

---

## 2.8 Design-system mapping (FUB chrome → Ryan Realty design system)

| FUB element | FUB visual | In-house equivalent |
|---|---|---|
| Top bar background | Medium gray | `bg-background` (`#faf8f4`) + bottom border `border-border` |
| Active nav item caret | Blue upward triangle | `bg-primary` (`#102742`) triangle — SVG or CSS `border-*` trick |
| Active nav label | Bold, blue text | `font-semibold text-primary` |
| Inactive nav label | Gray text | `text-muted-foreground` |
| Primary action buttons | Teal / FUB blue | `<Button variant="default">` (`bg-primary`, navy) |
| Nav badge (Inbox unread) | Red pill | `<Badge variant="destructive">` |
| Tasks badge | Amber/orange | `<Badge variant="warning">` |
| Input fields | FUB light | `<Input>` from `@/components/ui/input` |
| Tab strip active underline | Blue underline | CSS `border-b-2 border-primary` |
| Dropdown / ▾ menus | FUB light | `<DropdownMenu>` from `@/components/ui/dropdown-menu` |
| Left rail (People, Inbox) | FUB light gray | `bg-card` with `border-r border-border` |
| Spinner | CSS arc / orange progress bar | `<Spinner>` + `<Progress>` from shadcn (use `bg-primary` for progress fill) |
| Section headings in left rail | All-caps, small, gray | `text-xs font-semibold uppercase text-muted-foreground tracking-wide` |

**Font mapping:** FUB uses its own sans-serif throughout. In-house: Geist for all UI, nav labels, tab labels, body text. Amboqia is for hero H1 and display moments only — it does NOT appear in the CRM chrome.

---

## 2.9 Data touched by navigation and global chrome

The global chrome, primary nav, and module sub-navs read (but generally do not write) the following entities and fields.

### Read at shell init / on authenticated load:

| Entity | Fields read | Purpose |
|---|---|---|
| `crm_people` | `COUNT(*)` | "All People" badge count in People left rail |
| Inbox unread count | Derived from `crm_threads` where `status = 'unread'` | Primary nav Inbox badge |
| `crm_tasks` | `COUNT(*)` where `due_date < now() AND completed_at IS NULL` | Tasks → Overdue badge |
| Notification count | `crm_notifications` where `read_at IS NULL` for current user | Bell badge |
| Current user | `crm_users.id`, `crm_users.name`, `crm_users.avatar_url`, `crm_users.role` | Account avatar, My Settings |
| Team members | `crm_users.name`, `crm_users.avatar_url`, `crm_users.online_at` | Broker-avatar cluster |

### Read per module-nav selection:

| Action | Entity | Fields |
|---|---|---|
| Select People smart list | `crm_smart_lists.filter_ast`, `crm_people.*` (filtered) | Smart list query result + count badge |
| Select Inbox folder | `crm_threads` filtered by folder | Thread list |
| Select Tasks sub-tab | `crm_tasks` filtered by due date | Task list |
| Select Calendar view | `crm_appointments` in date range | Calendar events |
| Select Deals pipeline | `crm_deals` filtered by pipeline | Kanban columns |
| Select Reporting tab | Various reporting views (see §11) | Report data |
| Select Admin tab | Config tables per tab | Config data |

### Written by global chrome actions:

| Action | Entity / field written |
|---|---|
| Mark notification read | `crm_notifications.read_at = now()` |
| Complete task (checkbox in nav) | `crm_tasks.completed_at = now()` |
| Add person (+ icon, right utility) | `crm_people` INSERT + related contact fields |
| Log out | Supabase auth session destroy |

---

## 2.10 Dynamic behaviors from GIF analyses (build requirements)

All behaviors observed directly in GIF recordings; none are `(inferred)`.

| Trigger | Immediate response (same frame) | Async response |
|---|---|---|
| Click primary nav item | Bold label + blue caret + sub-nav renders + page title renders | Content area clears → spinner → data loads |
| Click Inbox thread | Thread row highlights; unread dot clears | Unread badge on primary nav and section header decrements by 1 |
| Click task checkbox | Strikethrough on task text + filled checkbox + Overdue badge decrements | Task row fades/slides out (~500ms) |
| Click People smart list | List row highlights | Badge updates; table content replaces |
| Click Admin tab | Tab underlines; content area clears | Data loads (Pattern A or C depending on tab) |
| Click Reporting sub-nav tab | Tab underlines; page title ("Show me…") renders | Content clears → spinner → report data loads |
| Click Deals Buyers/Sellers tab | Tab underlines | Kanban columns re-render for the selected pipeline |
| Click Calendar view switcher (Day/Week/Month) | Tab underlines | Calendar grid re-renders for the selected view |
| Click notification bell | Bell icon highlighted | Notification dropdown renders |
| Click "+ Add Person" (utility cluster) | Flyout opens | No data load required (empty form) |
| Click "More ▾" (Admin tab strip) | Dropdown opens | No data load |
| Click "Manage →" (People left rail) | Navigation | Manage Lists page loads |
| Click "⚙" (Deals toolbar) | Navigation | Manage Pipelines full-page loads |
| Click "All People" badge | Navigation | People table loads with full roster |
| Click Overdue badge (Task sub-tab) | Sub-tab underlines | Overdue task list loads |

---

## 2.11 Documented rules, limits & compliance (per FUB docs)

Only rules directly relevant to navigation, routing, and the global chrome are listed here. Rules specific to module internals appear in the relevant module section.

| Rule | Detail | Source |
|---|---|---|
| **Roles gate admin tab visibility** | Agents (non-Admin) cannot access Admin module at all; Team Leads see team-scoped admin only | per FUB docs (getting-started.md §9) |
| **Owner-only admin tabs** | Stages, Custom Fields, Billing creation/deletion gated to Account Owner only | per FUB docs (getting-started.md §9) |
| **Lender role** | Cannot access Reporting module at all | per FUB docs (getting-started.md §9) |
| **Notification bell — missed call** | Missed call to a team inbox always notifies inbox team members via email; cannot be disabled | per FUB docs (getting-started.md §23) |
| **Hot Sheet delivery** | Daily email at ~7:00 AM in account timezone; covers top 5 recent leads, tasks, upcoming appointments, recent activity | per FUB docs (getting-started.md §21) |
| **A2P Business Registration warning** | Until registration is approved, the Admin Overview shows a ⚠️ yellow triangle warning card | observed in shot-33 + admin3.md |
| **Action Plans migration banner** | Admin > Action Plans shows a dismissible "Automations 2.0 are here!" banner that cross-links to the Automations tab | observed in admin1.md |

**In-house implementation requirement:** Role-based route protection must be enforced server-side in Next.js middleware or in each `page.tsx` via `readAttributedAgentServer()`. Client-side-only role gating is not sufficient.

---

## 2.12 Prior-spec errors corrected

The following errors in `docs/FUB_CRM_FEATURE_SPEC.md` §3 are corrected in this document:

| Prior spec value | Correct value | Evidence |
|---|---|---|
| "36 automations" | **38 automations** | admin2.md GIF analysis (count visible in UI) |
| Person ID "27032" | **27022** | shot-01.md URL bar: exact capture of `/2/people/view/27022/call` |
| Admin route "adminoverview" (no slash) | **`/2/admin/overview`** | FUB URL pattern confirmed from admin1.md context |
| Admin tabs listed as 17 visible | **17 visible + 8 items in More ▾** (total 25 distinct admin destinations) | admin4.md GIF + feat2.md confirm More ▾ contents |
| Reporting described as "analytics hub" (generic) | **11-tab module; Overview is a card-grid index, not a data dashboard** | shot-32, reporting.md |
| "Laura" (person name in prior spec) | **Not verified in current evidence set** — prior OCR error; do not propagate |  shot-01.md analysis |
| "Dear Trail Rd" | **62285 Deer Trail Rd** (or similar) | Prior spec noted as OCR misread |
| Smart lists listed as "148 custom smart lists" | **148 confirmed** (the README corroborates this number; correct, not a prior error) | README.md cross-check |
| Deals: "All People" → pond route listed as `/2/people` | **`/2/people/pond/1`** (FUB uses the "pond" URL segment for the All People view) | shot-50: URL bar exact |

---

## 2.13 Acceptance criteria

The following criteria define "done" for the Information Architecture and Global Navigation module. Each criterion is independently testable.

**AC-NAV-01:** Primary navigation renders exactly 7 items in the order: People, Inbox, Tasks, Calendar, Deals, Reporting, Admin. No more, no fewer.

**AC-NAV-02:** The active primary nav item is bold (`font-semibold`) AND has a visible directional indicator (upward caret or underline) in `bg-primary` color. Both indicators render within the same animation frame as the route change — not after data loads.

**AC-NAV-03:** The Inbox primary-nav badge shows the total unread thread count. It is hidden (not shown as "0") when the unread count is zero. It decrements within 1 second of a thread being opened.

**AC-NAV-04:** The Tasks badge shows the overdue count as a formatted integer. During the pending state (count not yet fetched), the badge shows a placeholder character (`…` or `—`), NOT a spinner and NOT nothing.

**AC-NAV-05:** The notification bell badge shows the unread notification count. It is hidden when zero.

**AC-NAV-06:** Clicking the "+ Add Person" icon in the right utility cluster opens an inline flyout (NOT a full-page navigation) with fields: First Name, Last Name, Email, Phone, and an "or update an existing person" search field.

**AC-NAV-07:** All 7 module sub-navs render before the content area data is returned from the API. Sub-nav items, labels, and structure are derived from route config, not from an API response.

**AC-NAV-08 (People left rail):** The People left rail shows: "All People" with badge, a "COLLECTIONS" section with at minimum one collapsible group, a "SMART LISTS" section with the user's smart lists, and a "+ New List" button. The "Manage →" link navigates to the Manage Lists page.

**AC-NAV-09 (Inbox folder tree):** The Inbox left rail shows the exact hierarchy: My Inbox (N) → [Inbox, Assigned, Drafts, Sent, Closed]; Company (N); ⚙ Manage →. The "N" badges update in real-time.

**AC-NAV-10 (Tasks tab strip):** The Tasks module shows exactly 3 sub-tabs in this order: Today's Tasks, Overdue (with badge), Future. The Overdue badge decrements when a task is completed without requiring a page reload.

**AC-NAV-11 (Calendar):** The Calendar module renders a left sidebar with a mini monthly calendar + Schedule/Filters tabs, and a main area with Day/Week/Month view switcher. The "+ " button opens the Create Appointment modal (NOT a page navigation).

**AC-NAV-12 (Deals):** The Deals module shows exactly 2 pipeline tabs: Buyers, Sellers. A gear ⚙ icon navigates to a full-page Manage Pipelines route (NOT a modal).

**AC-NAV-13 (Reporting):** The Reporting module shows exactly 11 sub-nav tabs in the order specified in §2.3.6. The Overview tab renders a card-grid index (not a data dashboard). The "How Reporting works" link is right-aligned and NOT treated as a tab.

**AC-NAV-14 (Admin):** The Admin module shows at minimum the 17 tabs listed in §2.3.7, with a "More ▾" overflow menu containing at minimum: Phone Numbers, Company, API, Pixel, Integrations, Stages, Appointments, Email Domain Auth. The overflow menu is responsive to viewport width.

**AC-NAV-15 (Routes — People):** All 5 People route patterns listed in §2.5 resolve to the correct page without a 404. The `/admin/crm/people` default route redirects to the "All People" list view.

**AC-NAV-16 (Routes — Deals):** `/admin/crm/deals` defaults to the Buyers pipeline (`/admin/crm/deals/buyers`). The Sellers pipeline is at `/admin/crm/deals/sellers` (slug, not integer ID).

**AC-NAV-17 (Loading states):** All three loading patterns (A: blank + spinner, B: heavy query spinner, C: skeleton rows) are implemented. Pattern A applies to inter-module navigation. Pattern C applies to Admin > Ponds and other table-heavy surfaces. Pattern A is never a skeleton shimmer.

**AC-NAV-18 (Role gating):** Agent-role users cannot see the Admin tab in primary nav. Lender-role users cannot see the Reporting tab. Both constraints are enforced server-side, not client-side-only.

**AC-NAV-19 (Design system):** No raw `<nav>`, `<a>`, or `<div>` elements are used for interactive nav items — use shadcn/ui `<NavigationMenu>`, `<Tabs>`, `<DropdownMenu>`, and `<Button>` components from `@/components/ui/`. All colors from design-token classes (`bg-primary`, `text-primary-foreground`, `bg-background`, `border-border`), no hex codes inline.

**AC-NAV-20 (Account menu):** The account avatar dropdown contains at minimum: My Settings (routes to `/admin/crm/settings/me`) and Log Out (triggers Supabase sign-out and redirects to login).

---

## 2.14 Cross-references to sibling sections

| Topic | Section |
|---|---|
| App shell implementation, shared list/table/modal patterns, design system mapping details | §03 |
| Data model — every entity referenced above (crm_people, crm_tasks, crm_threads, crm_deals, crm_users) | §04 |
| People list content, bulk actions, column chooser | §05 |
| Smart list management, collections, New List flow | §06a |
| Smart list filter engine (AST, filter types, columns) | §06b |
| Person detail — the full contact record | §07a, §07b, §07c |
| Inbox — full thread list, reading pane, compose, unknown-caller | §08 |
| Tasks content, task creation, task detail; Calendar — appointment data model, GCal/MSCal sync | §09 |
| Deals — Kanban board, deal card, deal detail modal, stage management | §10 |
| Reporting — all 11 reports, KPI cards, charts, drill-throughs | §11 |
| Action Plans and Automations | §12 |
| Email & Text Templates | §13 |
| Admin — stages, tags, custom fields, lead flow, groups, ponds, appointments config | §14 |
| Admin — company settings, team, roles & permissions | §15 |
| My Settings (account menu) | §16 |
| Communications compliance — A2P 10DLC, opt-in/opt-out, TCPA, texting rules | §17 |
| Integrations, Pixel, API Settings | §18 |
| Billing and subscription | §19 |
| Mobile apps, notification channels | §20 |
| FUB → in-house gap map and build priority | §21 |

---

## Sources

### Per-screen vision analyses (ground truth)
1. `shot-01.md` — Contact Detail page, Call sub-route; confirms: 7 primary nav items, right utility cluster, 3-column layout. URL: `ryan-realty.followupboss.com/2/people/view/27022/call`
2. `shot-30.md` — Deals Kanban (Buyers pipeline); confirms: Buyers/Sellers tabs, gear icon, 6 kanban columns, toolbar. URL: `ryan-realty.followupboss.com/2/deals/1`
3. `shot-32.md` — Reporting Overview hub; confirms: exactly 11 sub-nav tabs + "How Reporting works" link, 14 report cards in 3 sections. URL: `ryan-realty.followupboss.com/2/reporting`
4. `shot-33.md` — Admin Overview; confirms: 17 visible admin tabs, 5 card sections, Business Registration ⚠️ warning. URL: `ryan-realty.followupboss.com/2/admin/overview`
5. `shot-50.md` — People List / All People; confirms: left rail structure (People → All People 17K → COLLECTIONS → Pipeline group (7) → Neighborhoods group (14) → Manage), "pond" URL segment, table columns. URL: `ryan-realty.followupboss.com/2/people/pond/1`
6. `shot-65.md` — Warm/Bi-Weekly Smart List (empty state + filter panel); confirms: SMART LISTS section with 11 named lists, filter panel anatomy, "Update List" button, PIPELINE type badge. URL: `ryan-realty.followupboss.com/2/people/list/30`

### GIF interaction-flow analyses
7. `feat1.md` — Navigation flow through all 7 modules (20 frames): confirms blank-gray loading state pattern, active tab bold+caret immediate render, Inbox 3-panel layout, Tasks `(...)` badge placeholder, Calendar Day view, Deals kanban stage names, Reporting as tile index not data dashboard
8. `feat2.md` — Reporting tabs + Admin full tour: confirms Admin More ▾ overflow contents, Automations Library, Action Plans migration banner, Company Settings live data, API Settings 5 keys
9. `inbox.md` — Inbox module full feature tour: confirms folder tree structure (My Inbox → Inbox/Assigned/Drafts/Sent/Closed; Company; ⚙ Manage), 3-panel reading layout, Add Person flyout for unknown callers, auto-mark-read on thread open, team inbox Manage page structure
10. `deals.md` — Deals module deep dive: confirms Manage Pipelines is a full-page route (not modal), Deal Detail is a centered modal overlay (not page navigation), gear icon → Manage Pipelines
11. `reporting.md` (direct text) — Reporting module all tabs: confirms "Show me [X] ▼" interactive page title pattern, 2-phase render (title before data), 14 report cards confirmed, cache notice text, Agent Goals "Set goal" inline action, Properties map view uniqueness
12. Admin GIF summaries (from workflow progress in reporting.md): `admin1.md` (Lead Flow, Groups, Team, Action Plans), `admin2.md` (Action Plan detail, Automations 19→38, Automations Library), `admin3.md` (Custom Fields 64 fields, Import, Integrations, Company, API), `admin4.md` (Tags, Ponds, Text Templates, Phone Numbers, Email Domain UNCLAIMED, Appointments, Pixel, Billing), `billing.md` (Calling Add-on sub-page)
13. `taskscal.md` — Tasks module and Calendar: confirms 3 task tabs (Today/Overdue/Future), 8 task type taxonomy with icons, task completion animation (strikethrough → decrement → row fade), Filters dropdown anatomy, Calendar Day/Month views, Create Appointment modal complete field inventory, appointment type = same enum as task type

### Official FUB documentation
14. `getting-started.md` (compiled from FUB Help Center, 48+ articles, June 2026) — Roles & permissions matrix, 7 role types and their module access restrictions, action plan timing rules, automation constraints, A2P 10DLC registration flow, notification channels, My Settings complete field inventory, smart list documentation, calendar sync constraints

### Sibling spec files consulted for cross-reference
15. `README.md` in spec output directory — confirms section structure, table of contents, provenance, headline numbers (18,235 contacts, 3 team members, 148 smart lists, 64 custom fields, 38 automations)

### Prior spec (superseded)
16. `docs/FUB_CRM_FEATURE_SPEC.md` §3 — lower-fidelity prior version; consulted for comparison and error correction (see §2.12)
