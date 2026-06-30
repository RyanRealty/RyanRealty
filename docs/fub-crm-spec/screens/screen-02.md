<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.16.34 AM.png | Sequential id: shot-02 | Tiles: fub-tiles/shot-02_{full,q1,q2,q3,q4}.png -->

# shot-02 — Contact Detail — Person Record with "Merge Existing Person" Modal

## Identity

- **Visible URL:** `ryan-realty.followupboss.com/2/people/view/27022/call`
  - Path segments: `/2/` = account/tenant ID, `/people/view/` = section, `27022` = person record ID, `/call` = sub-tab or context suffix (navigated from call queue or dialer action)
- **Browser tab title:** "Laurie McAdam - Follow Up B…" (truncated "Follow Up Boss")
- **Top-nav active item:** "People" (leftmost nav item, no visible highlight difference but People is the logical active section per URL)
- **Sub-nav/tab active:** The URL suffix `/call` suggests the "Log Call" tab was most recently active, but the modal overlay means the visible sub-navigation (Create Note / Send Email / Text / Log Call) is dimmed behind the modal
- **Breadcrumbs:** None visible; navigation context is provided via "Person 2 of 9" in the right sidebar
- **Logged-in user:** Matt Ryan (avatar visible top-right as a colored circle; name inferred from assigned-to field and activity feed attribution "Matt Ryan Owner & Principal")
- **Account/brokerage name:** Ryan Realty (visible in Source field "Ryan-Realty.com" and activity feed signatures)

---

## Layout

The screen is a **three-column layout** for a contact detail (person) record, with a **modal dialog** overlaying the center of the page. A bottom progress bar runs across the full viewport width.

### Columns (left to right):

1. **Left Rail / Contact Info Panel** (~25% width, ~300px, fixed/scrolling)
   - Contains avatar, contact name, last-communication timestamp, contact fields (phone, email, address), Relationships section, Details section (stage, assigned-to, source, price, timeframe, tags, lender), and Custom Fields section.
   - Scrollable independently.

2. **Center Column / Activity Feed** (~45% width, scrolling)
   - Contains the quick-action toolbar at top (Create Note, Send Email, Text, Log Call), filter/sort bar for the activity feed, and a chronological timeline of activity events (emails sent, automation actions, etc.).
   - This is the primary work area.

3. **Right Sidebar** (~30% width, ~300px, scrollable)
   - Top: "Person X of Y" navigator (← prev | Person 2 of 9 | → next)
   - Stacked collapsible sections: Action Plans, Activity (last-seen timestamp), Tasks, Appointments, AgentFire FUB Widget, Deals, Automations, Files, Collaborators
   - Footer inside sidebar: keyboard navigation hint "Press → to view next lead or ← to view previous lead"

### Modal Overlay:
A **centered dialog** titled "Merge existing person" is displayed over the full page with a semi-transparent dark backdrop. The modal is approximately 420px wide × 280px tall, vertically centered in the viewport, slightly right of center.

### Bottom Bar (full-width, fixed):
A green "Getting Started" progress bar runs at the very bottom of the viewport: "Started steps [progress bar] → Continue Getting Started"

### Floating elements:
- **"?" help button** — circular white button, bottom-right corner of viewport, floats above all content.

---

## Every UI Element (exhaustive)

### Browser Chrome
- **Favicon:** FUB logo (orange/red "F" icon)
- **Tab label:** "Laurie McAdam - Follow Up B…"
- **URL bar:** `ryan-realty.followupboss.com/2/people/view/27022/call`
- **Browser bookmarks bar:** Multiple bookmarks visible (Son's UH business…, Claude, CRM mobile UI redesi…, Lindsay mail form…, Application cost an…) — not part of FUB UI

---

### Top Navigation Bar (full-width, dark navy/black background, ~48px height)

Left side:
- **Hamburger/menu icon** (☰) — leftmost, white icon, likely collapses left rail or opens a global menu
- **"People"** — nav tab, white text, active (URL confirms)
- **"Inbox"** — nav tab with envelope icon (📧), white text
- **"Tasks"** — nav tab with checklist icon (≡☑), white text
- **"Calendar"** — nav tab with calendar icon, white text
- **"Deals"** — nav tab with handshake/pipeline icon, white text
- **"Reporting"** — nav tab with bar-chart icon, white text
- **"Admin"** — nav tab with gear/wrench icon, white text

Right side:
- **Search bar** — rounded rectangle input, placeholder text "Search", magnifying glass icon on left inside, approximately 200px wide
- **Icon cluster (top-right):** Multiple circular avatar/action icons (notification bell, settings, user avatar for Matt Ryan)

---

### Left Rail — Contact Card

**Avatar:**
- Circle avatar, ~64px diameter, lavender/blue-gray background, white initials **"LM"** (Laurie McAdam), no photo

**Name & Timestamp:**
- **"Laurie McAdam"** — large, bold, ~20px, dark text
- **"Last Communication 16 days ago"** — smaller, gray/muted text, directly below name

**Contact Fields (each row has an icon on the left):**

| Icon | Field Value | Notes |
|------|-------------|-------|
| Phone handset icon | **(541) 788-0691** | Blue hyperlink, "(mobile)" label after in gray |
| Envelope icon | **lgmcadam@gmail.com** | Blue hyperlink |
| House/location pin icon | **Add address** | Blue link text, no address currently set |

---

### Left Rail — Relationships Section

- **Section header:** "Relationships" — with two icons to the right: a person-with-plus icon (add relationship) and a chevron-up/down (collapse/expand)
- **Body text:** "No relationships" — gray, muted empty-state text
- The person-with-plus icon opens the Merge/Add Relationship flow [INFERRED]

---

### Left Rail — Details Section

- **Section header:** "Details" — with a list/bullet icon to the left; chevron-up on the right (section is expanded)

**Standard Fields visible:**

| Field Label | Value |
|-------------|-------|
| **Stage** | Lead |
| **Assigned to** | Matt Ryan |
| **Source** | Ryan-Realty.com, 17 days ago |
| **Price** | (empty — no value) |
| **Timeframe** | (empty — no value) |
| **Tags** | `audience:seller` ✕ · `broker:matt` ✕ · `Buyer` ✕ · `campaign-completed-for-education` ✕ · (additional tags truncated, "more" indicator) |
| **Lender** | (empty — no value) |

Tag display: each tag renders as a pill/chip with an "✕" remove button. Tags use colon-namespacing (e.g., `audience:seller`, `broker:matt`) for categorical grouping.

---

### Left Rail — Custom Fields Section

- **Section header:** "Custom Fields" — with collapse chevron

**Custom Fields listed (all appear empty/no value set):**

- Recently Divorced
- Recently Moved
- Enrichment Provider
- Phone Type
- Net Worth Range
- Income Range
- Has Children
- Household Size
- Occupation
- Gender
- Birthday

These are likely a mix of text, select, and boolean field types [INFERRED from field names].

---

### Center Column — Quick Action Toolbar

Horizontal icon-button row directly below contact header (partially obscured by modal):
- **✏ Create Note** — icon + label, ghost/outline style
- **✉ Send Email** — icon + label
- **💬 Text** — icon + label, appears to be the active/highlighted tab (teal/blue accent, slightly different style)
- **📞 Log Call** — icon + label

---

### Center Column — Activity Feed Toolbar

- **Filter tabs:** "All" (active, underlined), numeric badges: "3" (emails?), "0" (calls?), "0" (texts?)
  - Icons with counts: ≡All · 📧3 · 💬0 · 📞0
- **"Filters ▾"** — dropdown button, right-aligned in the toolbar, ghost style

---

### Center Column — Activity Feed (Timeline)

Events are displayed chronologically, newest at top. Each event has:
- Left: colored circle avatar (orange for Matt Ryan with "M" or photo)
- Event description line
- Timestamp
- Action row at bottom: **Reply**, **forward icon** (re-send?), **"…"** (more actions)

**Event 1 (top-most visible):**
- **Actor:** Matt Ryan → Laurie McAdam
- **Timestamp:** Jun 24 via automation
- **Type:** Automation email action — "archived"
- **Body preview:** "archived (https://ryan-realty.c…" (URL truncated)
- **"View campaign email"** link (blue, below body)

**Event 2:**
- **Actor:** Matt Ryan → Laurie McAdam
- **Timestamp:** Jun 24 via automation (similar)
- **Type:** Automation email — "archived"
- **Body preview:** "archived (https://ryan-realty.c…"
- **"View campaign email"** link

**Event 3 (email with subject line):**
- **Actor:** Matt Ryan → Laurie McAdam (lgmcadam@gmail.com)
- **Subject line:** "Your home value, 62285 Deer Trail Rd"
- **Body excerpt:** 
  > "Hi Laurie, Thank you for the details on your home. They made a real difference in the analysis. I put together a full comparative market analysis for 60585 Deer Trail Rd and attached it here."
  > "The short version: based on recent sales of comparable acreage homes in your corridor, plus what you shared (the 3 acres of COID irrigation, roof, and more), the supported value lands near $1,000,000, with a recommended list…"
- **Action row:** Reply | forward | …

**Event 4 (further down, partially visible):**
- Similar automation "archived" entries
- Signatures show: "(par-gu4.3MMvNAVN7LNhcG2OTM4NjUsYTox) Matt Ryan Owner & Principal"
- "(par-gu5MzyZOTM4NjUsYTox) Matt Ryan Owner & Principal"
- **boss.me** dropdown/badge visible (campaign tracking identifier)

---

### Modal Dialog — "Merge Existing Person"

**Overlay:** Semi-transparent dark backdrop covers entire page behind modal.

**Modal container:** White background, rounded corners (~8px radius), drop shadow, ~420px wide × ~280px tall, centered in viewport.

**Header row:**
- **Icon:** Person silhouette icon (single figure with merge/link symbol) — left of title
- **Title:** "Merge existing person" — medium-weight, ~16px, dark text
- **✕ Close button** — top-right corner of modal, gray icon

**Search field:**
- Full-width text input within the modal
- Placeholder text: "Search by name, phone or email"
- Blue search/submit button on the right edge of the input (rounded, blue background, white magnifying glass icon)
- No current search value entered (empty state)

**Empty-state illustration + text (below search field):**
- **Icon:** Large person silhouette with a question mark or merge indicator (~48px), gray color
- **Heading:** "Merge person as a relationship" — bold, dark text
- **Body:** "Search existing people and merge them as a relationship of **Laurie McAdam**." ("Laurie McAdam" appears as a blue link or bold inline reference)
- **"Learn more"** — blue hyperlink below the body text

**Footer buttons (bottom of modal):**
- **"Cancel"** — ghost/outline button, left-aligned, dark text, no fill
- **"Merge"** — filled button, blue/primary color (#4A90D9 or similar CRM blue), white text, right-aligned. Currently in its default (inactive) state because no search result has been selected.

---

### Right Sidebar

**Person Navigator (top of right sidebar):**
- **← (left arrow)** — navigate to previous person in current list/filter context
- **"Person 2 of 9"** — center text label indicating position within a result set (person 2 out of 9 total)
- **→ (right arrow)** — navigate to next person

---

**Section: Action Plans**
- Header: **"Action Plans"** with play-button icon (▶) + chevron-up (expanded)
- **"+"** add button (top-right of section header)
- Body: "No action plans running" — gray empty-state text

---

**Section: Activity**
- Header: **"Activity"** with activity-icon (stacked lines/lightning) + **"Seen 17 days ago ▾"** (muted gray, dropdown arrow to adjust or show detail)
- This section shows last-seen/engagement timestamp at the section header level

---

**Section: Tasks (1)**
- Header: **"Tasks (1)"** — bold, with task-list icon; badge "(1)" indicates 1 open task
- **⚡ (lightning bolt) button** — quick-add or priority action button, blue/teal
- **"+"** add task button
- **"^"** collapse chevron

**Task item:**
- **Task text:** "Hot seller LP lead — call within 5 min: Laurie McAdam (62285 Deer Trail Rd, Bend, OR 97701, USA)"
- **Due date:** "Jun 12th 2026 at 6:39 PM" — displayed in orange/amber color, indicating **overdue**
- **Assigned to:** Matt Ryan (person name below due date)
- Task appears uncompleted (no strikethrough)

---

**Section: Appointments**
- Header: **"Appointments"** with calendar icon + **"+"** add button + **"^"** collapse chevron
- Body: "No upcoming appointments" — gray empty-state text

---

**Section: AgentFire FUB Widget**
- Header: **"AgentFire FUB Widget"** with a custom icon + **"^"** collapse chevron (section is collapsed — no "+" add and no body visible, just collapsed header)
- This is a third-party widget integration from AgentFire (a real estate website platform)

---

**Section: Deals**
- Header: **"Deals"** with handshake/deal icon + **"+"** add button + **"^"** collapse chevron
- Body: "No deals yet" — gray empty-state text

---

**Section: Automations (1)**
- Header: **"Automations (1)"** with robot/automation icon + **"+"** add button + **"^"** collapse chevron
- Badge: "(1)" indicating 1 active automation

**Automation item:**
- **Name:** "Web Inquiry Option 01"
- **Status badge:** "Running" — green dot + "Running" label (green text or green pill)
- **Started:** "Started 3 weeks ago"
- **Icon:** Pause/stop icon (square or grid icon to the right of "Running") [INFERRED: clicking pauses the automation]

---

**Section: Files**
- Header: **"Files"** with paperclip icon + **"+"** add button + **"^"** collapse chevron
- Body: "No files yet, drag some here" — gray empty-state text with drag-drop invitation

---

**Section: Collaborators**
- Header: **"Collaborators"** with people/group icon + **"+"** add button + **"^"** collapse chevron
- Body: "No collaborators" — gray empty-state text

---

**Sidebar Footer (keyboard navigation hint):**
- "Press **→** to view next lead or **←** to view previous lead"
- Gray muted text, centered at the bottom of the right sidebar

---

### Bottom Bar — Getting Started (full-width, fixed)

- **Left text:** "Started steps"
- **Progress bar:** Green filled bar (~30-40% complete), narrow (~8px height)
- **Arrow:** "→"
- **Right text:** "Continue Getting Started" — blue hyperlink/button
- **Background:** White or very light gray bar, approximately 40px height, full viewport width, pinned to very bottom

---

### Floating Help Button

- **"?"** — circular white button with gray border, bottom-right corner, ~44px diameter, floats above all content
- [INFERRED: Opens FUB help center or contextual help panel]

---

## Colors, Typography & Style

### Color Palette
- **Top nav bar:** Dark navy / near-black (`#1a1a2e` or `#2c2c3e` approximately) with white text and icons
- **Page background:** White (`#ffffff`) for the center activity area; very light gray (`#f7f8fa` approximately) for the left and right sidebars
- **Primary action color (buttons, links, tags):** Medium blue (`#4A90D9` or `#3B82F6` approximately) — used on "Merge" button, search button, hyperlinks, active indicators
- **Overdue task timestamp:** Orange/amber (`#F59E0B` approximately) for the Jun 12th overdue date
- **Automation "Running" indicator:** Green dot + green text (`#10B981` approximately)
- **Avatar background (LM):** Blue-lavender (`#7C9CC0` approximately)
- **Activity feed event badges/dots:** Orange circle for Matt Ryan avatar
- **Section dividers:** Light gray horizontal rules (`#E5E7EB` approximately)
- **Modal overlay backdrop:** Semi-transparent dark, approximately `rgba(0,0,0,0.4)`
- **Bottom progress bar:** Green (`#22C55E` approximately)
- **Tag/pill chips:** Light gray background with dark text, small "✕" remove affordance

### Typography
- **Contact name ("Laurie McAdam"):** ~20px, semibold/bold, dark (`#111827`)
- **Section headers:** ~13–14px, medium-weight, dark gray (`#374151`)
- **Field labels:** ~12px, medium, gray (`#6B7280`)
- **Field values:** ~12–13px, regular, dark (`#111827`)
- **Links:** Blue, underline on hover [INFERRED]
- **Empty-state text:** ~13px, light gray (`#9CA3AF`)
- **Activity feed text:** ~13px, regular, dark; timestamps in muted gray
- **Modal title:** ~16px, semibold, dark
- **Modal body text:** ~13–14px, regular, dark

### Style
- **Font family:** System sans-serif (likely Inter or similar modern sans)
- **Border radius on cards/modals:** ~8px
- **Border radius on buttons:** ~6px (slightly rounded)
- **Border radius on tags/pills:** ~4px (slightly rounded rectangle, not full pill)
- **Button styles:**
  - Primary/filled: Blue background, white text (e.g., "Merge" button)
  - Ghost/outline: Border only, dark text (e.g., "Cancel" button)
  - Icon buttons: No border, hover state only [INFERRED]
- **Density:** Medium — fields have reasonable vertical spacing (~24–32px per row), not ultra-compact
- **Iconography style:** Outline/stroke icons (not filled), consistent ~16px size
- **Shadows:** Modal has subtle drop shadow; cards have minimal or no shadow
- **Sidebar sections:** Separated by thin horizontal rules, collapsible with chevron icon in header

---

## State & Data Shown

### Active Record
- **Person:** Laurie McAdam, ID 27022
- **List context:** Person 2 of 9 (navigating through a filtered list or smart list result)

### Contact Data Values
| Field | Value |
|-------|-------|
| Name | Laurie McAdam |
| Phone | (541) 788-0691 (mobile) |
| Email | lgmcadam@gmail.com |
| Address | Not set |
| Stage | Lead |
| Assigned to | Matt Ryan |
| Source | Ryan-Realty.com |
| Source date | 17 days ago (from current date) |
| Price | (empty) |
| Timeframe | (empty) |
| Tags | audience:seller, broker:matt, Buyer, campaign-completed-for-education (+ possibly more) |
| Lender | (empty) |
| Last Communication | 16 days ago |
| Last Seen | 17 days ago |

### Tasks
- 1 open task (overdue since Jun 12th 2026): "Hot seller LP lead — call within 5 min: Laurie McAdam (62285 Deer Trail Rd, Bend, OR 97701, USA)"

### Automations
- 1 running: "Web Inquiry Option 01", started 3 weeks ago, status: Running

### Activity Feed Sample
- Multiple "archived" automation emails sent Jun 24 via campaign (ryan-realty.com campaign tracking URLs visible)
- A personalized CMA email with subject "Your home value, 62285 Deer Trail Rd" — body discusses $1,000,000 supported value for the property, COID irrigation, 3 acres, comparative acreage sales

### Modal State
- Modal is in empty/initial state — no search query entered, no results displayed

---

## Interactions & Behaviors

### Top Navigation
- Clicking any nav tab (People, Inbox, Tasks, Calendar, Deals, Reporting, Admin) navigates to that section [INFERRED]
- Search bar: typing triggers live search across all records [INFERRED]

### Left Rail
- **Phone number** — clicking dials or copies [INFERRED; FUB supports click-to-dial]
- **Email** — clicking opens compose or copies [INFERRED]
- **"Add address"** — clicking opens inline address form or dropdown [INFERRED]
- **Relationships section icons:** Person-with-plus icon → opens the "Merge existing person" modal (this modal IS currently open, confirming this trigger)
- **Tag ✕ buttons** — clicking removes the tag from the contact in real-time [INFERRED]
- **Stage field** — clicking opens a dropdown to change the stage [INFERRED]
- **Assigned to** — clicking opens an agent picker dropdown [INFERRED]
- **Details section chevron** — clicking collapses/expands the Details block
- **Custom Fields section** — individual fields clickable to edit inline [INFERRED]

### Center Column — Quick Actions
- **Create Note** — opens a text area inline or in a panel [INFERRED]
- **Send Email** — opens an email compose drawer/panel [INFERRED]
- **Text** — opens an SMS compose panel [INFERRED]
- **Log Call** — opens a call logging form [INFERRED]; `/call` in the URL may mean this tab was last active

### Activity Feed
- **"Reply"** button on each email event — opens inline reply compose [INFERRED]
- **Forward icon** — opens forward email flow [INFERRED]
- **"…" (ellipsis)** — opens a context menu with actions like Edit, Delete, Pin [INFERRED]
- **"View campaign email"** link — opens the full rendered email in a modal or new tab [INFERRED]
- **Filters ▾** — opens a dropdown to filter the activity feed by type (calls, emails, texts, notes, automations, etc.) [INFERRED]
- **Feed type tabs (All / email count / comment count / call count)** — clicking a tab filters the activity feed to that type only [INFERRED]

### Right Sidebar
- **← / → arrows (Person X of Y)** — navigate to the previous/next person in the current list/filter result set
- **Keyboard shortcut:** ← / → arrow keys do the same navigation (confirmed by footer hint)
- **Section "+" buttons** — add a new item of that type (add task, add deal, add appointment, etc.) [INFERRED]
- **Section "^" chevron** — toggles collapse/expand of that section [INFERRED]
- **Task item** — clicking opens task detail/edit inline or in a modal [INFERRED]
- **"Running" automation** — clicking the pause/grid icon pauses the automation [INFERRED]
- **"Files" section** — supports drag-and-drop file upload directly onto the section [CONFIRMED by "drag some here" text]
- **AgentFire FUB Widget** — third-party widget; expanding may show mortgage calculator or market data from AgentFire [INFERRED]

### Modal — "Merge Existing Person"
- **Search input** — typing triggers a live search across FUB contacts by name, phone, or email [INFERRED]
- **Search results** — appear below the input as a dropdown list when a query returns results [INFERRED]
- **Selecting a result** — enables/activates the "Merge" button [INFERRED; currently disabled/inactive because no result is selected]
- **"Merge" button** — merges the found person record into Laurie McAdam's record as a "relationship" (not a full merge/dedup — this creates a linked relationship entity, per the modal copy "merge them as a relationship of Laurie McAdam")
- **"Cancel" button** — closes the modal without changes
- **✕ button** — same as Cancel
- **"Learn more"** link — opens FUB documentation about the relationship/merge feature [INFERRED]
- The result of this action ADDS a relationship (e.g., spouse, co-buyer, partner) to the contact, it does NOT destructively merge/delete the other record [CONFIRMED by modal body copy: "merge them as a relationship"]

---

## Data Model Signals

### Person / Contact Entity
- `id` — integer (27022 visible in URL)
- `first_name`, `last_name` (stored separately, displayed as full name "Laurie McAdam")
- `avatar` — nullable photo or auto-generated initials + background color
- `phones[]` — array of {number, type: 'mobile'|'home'|'work'|'other'}
- `emails[]` — array of {address, primary: boolean}
- `address` — nullable {street, city, state, zip}
- `stage` — enum: Lead, Prospect, Active, Under Contract, Past Client, etc.
- `assigned_to` — FK to users/agents table
- `source` — string (e.g., "Ryan-Realty.com")
- `source_date` / `created_at` — timestamp
- `price` — nullable integer/decimal (desired/expected price)
- `timeframe` — nullable (buying/selling timeframe)
- `tags[]` — array of strings, supporting namespaced format `category:value`
- `lender` — nullable string or FK
- `last_communication_at` — timestamp (displayed as "16 days ago")
- `last_seen_at` — timestamp (displayed as "17 days ago" in Activity section)
- `custom_fields{}` — key-value store of custom field definitions

### Relationship Entity (revealed by modal)
- `person_a_id` — FK to person
- `person_b_id` — FK to person
- `relationship_type` — string or enum (e.g., spouse, partner, co-buyer)
- Created by the "Merge existing person" / "Merge person as a relationship" flow

### Task Entity
- `id`
- `title` / `description` — text ("Hot seller LP lead — call within 5 min: ...")
- `due_at` — datetime (Jun 12th 2026 at 6:39 PM)
- `assigned_to` — FK to user (Matt Ryan)
- `person_id` — FK to contact (Laurie McAdam)
- `completed` — boolean
- `overdue` — computed (due_at < now() AND NOT completed)

### Automation / Action Plan Enrollment Entity
- `id`
- `name` — "Web Inquiry Option 01"
- `status` — enum: Running | Paused | Completed | etc.
- `started_at` — datetime (3 weeks ago from current date)
- `person_id` — FK to contact

### Activity / Timeline Event Entity
- `id`
- `type` — enum: email_sent | email_received | call_logged | note | text_sent | text_received | automation_action | stage_change | ...
- `actor_id` — FK to user
- `contact_id` — FK to person
- `created_at` — timestamp
- `body` / `content` — text (email body, note text, etc.)
- `subject` — nullable (for emails)
- `direction` — inbound | outbound
- `channel` — email | sms | call | automation | manual
- `campaign_id` / `campaign_url` — nullable (for automation-triggered emails)

### Appointment Entity
- `id`
- `person_id`
- `datetime`
- `type`
- (empty in this record, but section exists)

### Deal Entity
- `id`
- `person_id`
- `status`
- (empty in this record)

### File Entity
- `id`
- `person_id`
- `filename`, `url`, `size`
- (empty in this record)

### Collaborator Entity
- `id`
- `person_id`
- `user_id` — FK to agent/user
- (empty in this record)

### Pagination / List Context
- The person is position 2 in a set of 9, suggesting the user navigated to this contact from a Smart List or search result that has 9 contacts total, and is using the ← → navigation to move through them sequentially.

---

## Rebuild Notes

### Component Breakdown

```
<ContactDetailPage>
  <TopNavBar>
    <HamburgerMenu />
    <NavItem label="People" active />
    <NavItem label="Inbox" icon="inbox" badge={null} />
    <NavItem label="Tasks" icon="tasks" />
    <NavItem label="Calendar" icon="calendar" />
    <NavItem label="Deals" icon="deals" />
    <NavItem label="Reporting" icon="reporting" />
    <NavItem label="Admin" icon="admin" />
    <GlobalSearchBar placeholder="Search" />
    <UserAvatarMenu user="Matt Ryan" />
  </TopNavBar>

  <PageBody layout="three-column">

    <LeftRail>
      <ContactAvatar initials="LM" color="#7C9CC0" size={64} />
      <ContactName name="Laurie McAdam" />
      <LastCommunicationBadge value="16 days ago" />

      <ContactFieldRow icon="phone">
        <ClickablePhone number="(541) 788-0691" type="mobile" />
      </ContactFieldRow>
      <ContactFieldRow icon="email">
        <ClickableEmail address="lgmcadam@gmail.com" />
      </ContactFieldRow>
      <ContactFieldRow icon="address">
        <AddAddressLink />
      </ContactFieldRow>

      <LeftRailSection title="Relationships" collapsible defaultExpanded>
        <RelationshipAddButton onClick={openMergeModal} />
        <EmptyState text="No relationships" />
        {/* When populated: <RelationshipItem person={...} type={...} /> */}
      </LeftRailSection>

      <LeftRailSection title="Details" icon="list" collapsible defaultExpanded>
        <DetailField label="Stage" value="Lead" type="stage-select" />
        <DetailField label="Assigned to" value="Matt Ryan" type="agent-select" />
        <DetailField label="Source" value="Ryan-Realty.com" subtext="17 days ago" type="readonly" />
        <DetailField label="Price" value={null} type="currency" />
        <DetailField label="Timeframe" value={null} type="text" />
        <TagField
          label="Tags"
          tags={["audience:seller", "broker:matt", "Buyer", "campaign-completed-for-education"]}
          onRemove={removeTag}
          onAdd={addTag}
        />
        <DetailField label="Lender" value={null} type="text" />
      </LeftRailSection>

      <LeftRailSection title="Custom Fields" collapsible>
        <CustomField label="Recently Divorced" value={null} />
        <CustomField label="Recently Moved" value={null} />
        <CustomField label="Enrichment Provider" value={null} />
        <CustomField label="Phone Type" value={null} />
        <CustomField label="Net Worth Range" value={null} />
        <CustomField label="Income Range" value={null} />
        <CustomField label="Has Children" value={null} />
        <CustomField label="Household Size" value={null} />
        <CustomField label="Occupation" value={null} />
        <CustomField label="Gender" value={null} />
        <CustomField label="Birthday" value={null} />
      </LeftRailSection>
    </LeftRail>

    <CenterColumn>
      <QuickActionBar>
        <QuickActionButton icon="note" label="Create Note" />
        <QuickActionButton icon="email" label="Send Email" />
        <QuickActionButton icon="sms" label="Text" active />
        <QuickActionButton icon="phone" label="Log Call" />
      </QuickActionBar>

      <ActivityFeedToolbar>
        <FeedTab label="All" active count={null} />
        <FeedTab label="" icon="email" count={3} />
        <FeedTab label="" icon="comment" count={0} />
        <FeedTab label="" icon="phone" count={0} />
        <FiltersDropdown />
      </ActivityFeedToolbar>

      <ActivityFeed>
        <ActivityEvent
          type="automation_email"
          actor="Matt Ryan"
          recipient="Laurie McAdam"
          timestamp="Jun 24 via automation"
          subject="archived"
          body="archived (https://ryan-realty.c…)"
          actions={["Reply", "Forward", "More"]}
          footerLink={{ label: "View campaign email", href: "..." }}
        />
        {/* Additional events... */}
        <ActivityEvent
          type="email_sent"
          actor="Matt Ryan"
          recipient="Laurie McAdam"
          timestamp="..."
          subject="Your home value, 62285 Deer Trail Rd"
          body="Hi Laurie, Thank you for the details on your home..."
          actions={["Reply", "Forward", "More"]}
        />
      </ActivityFeed>
    </CenterColumn>

    <RightSidebar>
      <PersonNavigator current={2} total={9} onPrev={navPrev} onNext={navNext} />

      <SidebarSection title="Action Plans" icon="action-plans" collapsible addable>
        <EmptyState text="No action plans running" />
      </SidebarSection>

      <SidebarSection title="Activity" icon="activity" collapsible>
        <LastSeenBadge value="Seen 17 days ago" />
      </SidebarSection>

      <SidebarSection title="Tasks" icon="tasks" badge={1} collapsible addable quickAddable>
        <TaskItem
          title="Hot seller LP lead — call within 5 min: Laurie McAdam (62285 Deer Trail Rd, Bend, OR 97701, USA)"
          dueAt="Jun 12th 2026 at 6:39 PM"
          assignedTo="Matt Ryan"
          overdue={true}
        />
      </SidebarSection>

      <SidebarSection title="Appointments" icon="calendar" collapsible addable>
        <EmptyState text="No upcoming appointments" />
      </SidebarSection>

      <SidebarSection title="AgentFire FUB Widget" icon="widget" collapsible>
        {/* Third-party widget content */}
      </SidebarSection>

      <SidebarSection title="Deals" icon="deals" collapsible addable>
        <EmptyState text="No deals yet" />
      </SidebarSection>

      <SidebarSection title="Automations" icon="automations" badge={1} collapsible addable>
        <AutomationEnrollment
          name="Web Inquiry Option 01"
          status="Running"
          startedAt="3 weeks ago"
          onPause={pauseAutomation}
        />
      </SidebarSection>

      <SidebarSection title="Files" icon="paperclip" collapsible addable>
        <DropZoneEmptyState text="No files yet, drag some here" />
      </SidebarSection>

      <SidebarSection title="Collaborators" icon="people" collapsible addable>
        <EmptyState text="No collaborators" />
      </SidebarSection>

      <KeyboardNavHint text="Press → to view next lead or ← to view previous lead" />
    </RightSidebar>

  </PageBody>

  {/* Modal overlay */}
  <Modal title="Merge existing person" onClose={closeModal}>
    <PersonSearchInput
      placeholder="Search by name, phone or email"
      onSearch={searchPeople}
    />
    <EmptySearchState
      icon="person-merge"
      heading="Merge person as a relationship"
      body={`Search existing people and merge them as a relationship of ${contact.name}.`}
      learnMoreUrl="..."
    />
    <ModalFooter>
      <Button variant="ghost" onClick={closeModal}>Cancel</Button>
      <Button variant="primary" disabled={!selectedPerson} onClick={mergePerson}>Merge</Button>
    </ModalFooter>
  </Modal>

  <GettingStartedBar progress={0.35} onContinue={openGettingStarted} />
  <HelpButton />
</ContactDetailPage>
```

### Non-Obvious Logic

1. **"Merge existing person" creates a relationship, not a destructive merge:** The modal copy clearly says "merge them as a **relationship** of Laurie McAdam" — this is NOT a deduplication merge that deletes one record. It creates a `relationship` entity linking two person records (useful for couples, business partners, families). The UI reuses the word "merge" but the semantic is relationship-linking.

2. **Person Navigator (X of Y) context:** The "Person 2 of 9" counter implies the user arrived at this detail page from a list view (Smart List, search result, or inbox queue) and is using in-record navigation rather than going back to the list. The ← → navigation and keyboard shortcuts are a power-user feature for bulk record review workflows (call lists, follow-up queues). The number 9 likely reflects the total count of the originating list/filter, not all contacts.

3. **URL structure `/call` suffix:** The URL `/people/view/27022/call` suggests the detail page uses a sub-route or tab state in the URL. Other possible suffixes might be `/email`, `/note`, `/text` corresponding to the Quick Action tabs. This enables deep-linking to a specific action tab and also means the browser back button returns to the list context.

4. **Overdue task styling:** The due date "Jun 12th 2026 at 6:39 PM" is rendered in orange/amber — this color change from gray (future) to orange (overdue) is a computed state based on `dueAt < now()`. The task remains open and appears in the count badge `Tasks (1)`.

5. **Tag namespacing convention:** Tags like `audience:seller`, `broker:matt` use a `category:value` colon-delimited namespace. This is a FUB convention for organizing tags into logical groups. The UI strips the prefix for display or shows it in full — visible here showing full tag text. Tag removal is inline with ✕ buttons.

6. **Activity feed "archived" automation events:** These appear to be emails that were queued in a campaign and then "archived" when the contact no longer qualified (e.g., campaign completed). The `campaign-completed-for-education` tag and the "archived" event bodies (with campaign-tracking URLs) confirm this is a drip/action-plan campaign that has ended.

7. **"Seen 17 days ago" in Activity section:** This is likely a web tracking pixel or visit tracking event — Laurie was seen (visited the linked website or opened a tracked email) 17 days ago. This is separate from "Last Communication 16 days ago" (when the most recent message was sent/received). The dropdown arrow (▾) on "Seen 17 days ago" may allow expanding the full activity log or adjusting the view.

8. **Third-party widget section:** The "AgentFire FUB Widget" section is a FUB integration widget from AgentFire (a real estate website platform). This is added via FUB's widget/plugin system and shows up as a collapsible sidebar section, allowing third-party tools to embed contextual data directly in the contact detail page.

9. **Files section drag-and-drop:** "No files yet, drag some here" indicates the Files section supports HTML5 drag-and-drop uploads directly onto that sidebar section, without needing to click a file picker.

10. **Bottom "Getting Started" bar:** This is a persistent onboarding wizard that appears for new or recently-onboarded accounts. The progress bar shows partial completion. The bar persists across all pages until dismissed or completed. It sits at the very bottom of the viewport, always visible.
