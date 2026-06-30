<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.16.45 AM.png | Sequential id: shot-03 | Tiles: fub-tiles/shot-03_{full,q1,q2,q3,q4}.png -->

# shot-03 — Contact Detail (Person Record) with "Add Relationship" Modal

## Identity

- **Visible URL:** `ryan-realty.followupboss.com/2/people/view/27022/call`
  - Path structure: `/2/people/view/{personId}/call` — the trailing `/call` appears to be a sub-route, but the primary view is the person detail. The "Text" action button is shown as active/selected (purple), yet the URL says `/call`. This likely reflects the last-clicked quick-action tab in the URL routing.
- **Browser tab title:** "Laurie McAdam - Follow Up B…" (truncated)
- **Top-nav active item:** "People" (leftmost nav item, appears slightly highlighted/active)
- **Sub-nav / tab active:** None explicitly selected in the secondary action bar; the "Text" quick-action button in the center column appears highlighted purple, suggesting it was last clicked.
- **Breadcrumbs:** None visible. Navigation context provided by "Person 2 of 9" in the right sidebar header.
- **Logged-in user:** Matt Ryan — a headshot avatar is visible in the top-right of the FUB nav bar (small circular photo). Also confirmed by "Assigned to Matt Ryan" and "Matt Ryan" as sender on all timeline entries.
- **Account / brokerage:** Ryan Realty (visible in browser bookmarks bar as "Ryan Realty" tab bookmark, and confirmed by the source field "Ryan-Realty.Com").

---

## Layout

The page uses a **three-column layout** plus a **modal overlay** that is currently active.

### Overall structure (left → right):

```
[ Left Column ~28% ]  [ Center Column ~40% ]  [ Right Sidebar ~32% ]
                             ↑
                     [ Modal Dialog overlaying center + left bottom ]
```

### Top chrome:
- **Browser chrome** (not FUB): standard Chrome address bar, bookmarks bar. URL bar shows the FUB URL.
- **FUB Top Navigation Bar** (~44px tall, dark charcoal/near-black `#1a2332` or similar): spans full width. Contains left nav items and right utility icons.

### Left Column (fixed, non-scrolling contact info panel, ~280–300px wide):
- Contact header (avatar + name + last communication)
- Phone / email / address fields
- Relationships section (collapsible)
- Details section (collapsible): Stage, Assigned to, Source, Price, Timeframe, Tags
- Financing section (collapsible): Lender
- Custom Fields section (collapsible): 10 custom field labels

### Center Column (scrollable activity/timeline feed):
- Quick-action button row at top: Create Note | Send Email | Text | Log Call
- Activity filter tabs: All | Emails count | Chats count | Calls count | Filters dropdown
- Timeline/activity feed (scrollable list of events ordered newest-first)

### Right Sidebar (~320px wide, fixed):
- "Person 2 of 9" navigation header with prev/next chevrons
- Stack of collapsible sections (all visible, some expanded, some collapsed):
  - Action Plans
  - Activity (with "Seen X days ago" summary)
  - Tasks (with count badge)
  - Appointments
  - AgentFire FUB Widget
  - Deals
  - Automations (with count badge)
  - Files
  - Collaborators
- Keyboard navigation hint at very bottom: "Press [→] to view next lead or [←] to view previous lead"

### Modal overlay:
- Semi-transparent dark scrim covers the full page behind the modal
- White modal card centered horizontally, positioned roughly upper-center of the viewport
- Modal: "Add relationship" form

---

## Every UI Element (Exhaustive)

### FUB Top Navigation Bar

**Left side (nav items):**
| Item | Icon | State |
|---|---|---|
| ☰ (hamburger / collapse sidebar) | Three-line stack icon | clickable |
| 👤 People | Person silhouette icon | Active (current section) |
| Inbox | Inbox tray icon | inactive |
| Tasks | Checklist icon | inactive |
| Calendar | Calendar grid icon | inactive |
| Deals | Tag/briefcase icon | inactive |
| Reporting | Bar chart icon | inactive |
| Admin | Wrench/gear icon | inactive |

**Center:**
- Search bar: rounded pill input, placeholder "Search", with magnifying glass icon. Spans roughly center of nav bar. Light gray background.

**Right side utility icons (left → right):**
1. Email envelope icon (circular teal/blue badge) — opens email compose or inbox
2. Chat/speech bubble icon (circular purple badge) — opens messaging
3. Person-with-plus icon (circular blue-gray badge) — add person or notifications
4. Bell icon with dropdown chevron — notifications; has a badge/indicator
5. Matt Ryan headshot avatar (small circular photo, ~28px) — account menu

### Left Column — Contact Header

- **Avatar:** Dark gray circle (~48px), white initials "LM" (no photo uploaded)
- **Name:** "Laurie McAdam" — bold, ~18px, dark text
- **Subtitle:** "Last Communication 16 days ago" — small gray text below name

### Left Column — Contact Fields

| Icon | Label/Value |
|---|---|
| Phone icon (handset) | (541) 788-0691 (mobile) — clickable link, appears as teal/blue hyperlink |
| Envelope icon | lgmcadam@gmail.com — clickable link, teal/blue |
| House/pin icon | "Add address" — blue link text (no address set) |

### Left Column — Relationships Section

- **Section header:** "Relationships" — bold label, with two icons on the right:
  - Person-with-plus icon (add a related person)
  - Blue circular "+" button
  - "^" chevron (collapse)
- **Content:** "No relationships" — gray placeholder text

### Left Column — Details Section (collapsible, currently expanded)

- **Section header:** "Details" — with "^" collapse chevron on right, and a grid/list icon on left
- **Fields:**

| Field Label | Value |
|---|---|
| Stage | Lead |
| Assigned to | Matt Ryan |
| Source | Ryan-Realty.Com, 17 days ago |
| Price | (empty — no value) |
| Timeframe | (empty — no value) |

- **Tags row:** Label "Tags" on left, then tag chips:
  - `audience:seller` [×] — gray pill with × remove button
  - `broker:matt` [×] — gray pill
  - `Buyer` [×] — gray pill
  - `campaign:concept-m-mountain` [×] — gray pill
  - `channel:fb-ads` [×] — gray pill
  - `4 more` — blue text link indicating 4 additional tags hidden
  - Blue "+" circular button on far right to add tags

### Left Column — Financing Section (collapsible, currently expanded)

- **Section header:** "Financing" — with document/dollar icon on left and "^" chevron on right
- **Fields:**

| Field Label | Value |
|---|---|
| Lender | (empty — no value) |

### Left Column — Custom Fields Section (collapsible, currently expanded)

- **Section header:** "Custom Fields" — with grid/list icon on left and "^" chevron on right
- **Fields (all currently empty — no values):**

| Field Label | Value |
|---|---|
| Recently Divorced | (empty) |
| Recently Moved | (empty) |
| Enrichment Provider | (empty) |
| Phone Type | (empty) |
| Net Worth Range | (empty) |
| Income Range | (empty) |
| Occupation | (empty) |
| Has Children | (empty) |
| Household Size | (empty) |
| Marital Status | (empty) |

### Center Column — Quick-Action Button Row

Four buttons in a horizontal row at the top of the center column:

| Button | Icon | Style |
|---|---|---|
| Create Note | Pencil/edit icon | Ghost/text style, dark text |
| Send Email | Envelope icon | Ghost/text style |
| Text | Speech bubble icon | **Active/selected — purple/filled or highlighted** |
| Log Call | Phone handset icon | Ghost/text style |

### Center Column — Activity Filter Tabs

A horizontal tab/filter row immediately below the quick-action buttons:

| Tab | Icon | Count | State |
|---|---|---|---|
| All | — | — | Selected (underline or bold) |
| Email icon | envelope | 3 | inactive |
| Chat icon | speech bubble | 0 | inactive |
| Phone icon | handset | 0 | inactive |

- **Filters** button with dropdown chevron "▾" on the far right — opens filter panel for the timeline

### Center Column — Activity Timeline Feed

Events displayed newest-first. Each event row contains:
- **Sender avatar** (left): Matt Ryan's photo (orange/warm-toned circular avatar, ~32px)
- **Direction / participants:** "Matt Ryan → Laurie Mc[Adam]" format with "→" arrow between sender and recipient
- **Timestamp + channel:** e.g. "Jun 24 via automation" — gray small text; "via automation" is a gray badge/label
- **Tags/badges** on some events: e.g. "1 open" — small green or colored pill
- **Event body:** text content of the activity
- **Row actions (bottom right of each event):**
  - Reply icon (curved arrow left) with "Reply" text
  - Forward/double-arrow icon (two right-pointing curved arrows)
  - More actions "…" (ellipsis) icon

**Timeline entries visible (top to bottom, newest first):**

---

**Event 1:**
- Avatar: Matt Ryan (orange circle)
- Header: "Matt Ryan → Laurie Mc…" | "Jun 24 via automation" [automation badge]
- Body: "archived"
- Sub-text: `archived (https://ryan-realty.c…` [truncated URL]
- Link: "View campaign email" (blue link)
- Action buttons: Reply | >> | …

---

**Event 2:**
- Avatar: Matt Ryan (orange circle)
- Header: "Matt Ryan → Laurie Mc…" | "Jun 19 via automation" [automation badge]
- Body: "archived"
- Sub-text: `archived (https://ryan-realty.c…` [truncated URL]
- Link: "View campaign email" (blue link)
- Action buttons: Reply | >> | …

---

**Event 3:**
- Avatar: Matt Ryan (orange circle)
- Header: "Matt Ryan → Laurie Mcadam" | "Jun 15 via automation" [automation badge] | "1 open" [green/teal badge pill]
- Body: "archived"
- Sub-text: `archived (https://ryan-realty.com?_pxl=djoxLGM6MDIwOTY5MzYzOTM4NjUsYTox) Matt Ryan Owner & Principal`
- Link: "View campaign email" (blue link)
- Action buttons: Reply | >> | …

---

**Event 4 (email, most detailed):**
- Avatar: Matt Ryan (orange circle)
- Icon indicator: envelope icon in blue/purple (distinct from automation events — direct email)
- Header: "Matt Ryan → Laurie McAdam, ryan.realty@followupboss.me ▾" (dropdown chevron suggesting expand/collapse of recipients)
- Timestamp: "Jun 13"
- Attachment indicator: paperclip icon (📎) — has attachment
- Subject/Title: **"Your home value, 62285 Deer Trail Rd"**
- Body preview:
  ```
  Hi Laurie,
  Thank you for the details on your home. They made a real difference in the analysis. I put together a full comparative market analysis for 62285 Deer Trail Rd and attached it here.
  ```
  (Body text is cut off at bottom due to modal overlay)
- Action buttons: Reply | >> | …

---

### Right Sidebar — Header

- **"Person 2 of 9"** — centered text in the sidebar header
  - Left "‹" chevron: navigate to previous person in the current list/set
  - Right "›" chevron: navigate to next person

### Right Sidebar — Action Plans Section

- **Header:** "▶ Action Plans" — with play button icon, "^" collapse chevron
- **Content:** "No action plans running" — gray placeholder text

### Right Sidebar — Activity Section

- **Header:** "🔔 Activity" — bell/activity icon, right side shows "Seen 17 days ago ▾" with dropdown chevron (to see full activity history)
- **State:** Section is expanded but shows no sub-items directly (activity is displayed in center column timeline)

### Right Sidebar — Tasks Section

- **Header:** "☰ Tasks (1)" — checklist icon, count badge "(1)" in header text
- **Right icons:** Blue lightning bolt (⚡) icon | Blue "+" circular button | "^" collapse chevron
- **Task item visible:**
  - Checkbox: unchecked square (incomplete task)
  - Task title: **"Hot seller LP lead — call within 5 min: Laurie McAdam (62285 Deer Trail Rd, Bend, OR 97701, USA)"**
  - Due date (overdue — shown in red/orange): "Jun 12th 2026 at 6:39 PM"
  - Assigned user icon + "Matt Ryan"

### Right Sidebar — Appointments Section

- **Header:** "📅 Appointments" — calendar icon
- **Right:** Blue "+" circular button | "^" collapse chevron
- **Content:** "No upcoming appointments" — gray placeholder text

### Right Sidebar — AgentFire FUB Widget Section

- **Header:** "📄 AgentFire FUB Widget" — document/page icon
- **State:** Section appears collapsed (no "^" up-chevron visible — only the section label, suggesting it is in collapsed state with a down "˅" chevron)
- **Content:** Not visible (collapsed)

### Right Sidebar — Deals Section

- **Header:** "💼 Deals" — briefcase/tag icon
- **Right:** Blue "+" circular button | "^" collapse chevron
- **Content:** "No deals yet" — gray placeholder text

### Right Sidebar — Automations Section

- **Header:** "▶ Automations (1)" — play icon, count badge "(1)"
- **Right:** Blue "+" circular button | "^" collapse chevron
- **Active automation item:**
  - Name: **"Web Inquiry Option 01"**
  - Sub-label: "Started 3 weeks ago"
  - Status indicator: 🟢 "Running" (green dot + "Running" text)
  - Pause button: "||" (vertical bars icon, to pause the automation)

### Right Sidebar — Files Section

- **Header:** "📎 Files" — paperclip icon
- **Right:** Blue "+" circular button | "^" collapse chevron
- **Content:** "No files yet, drag some here" — gray placeholder text (implies drag-and-drop upload is supported)

### Right Sidebar — Collaborators Section

- **Header:** "👥 Collaborators" — people/group icon
- **Right:** Blue "+" circular button | "^" collapse chevron
- **Content:** "No collaborators" — gray placeholder text

### Right Sidebar — Footer Keyboard Hint

- Text: "Press [→] to view next lead or [←] to view previous lead"
- "[→]" and "[←]" are rendered as keyboard key badges (rounded squares with arrow symbols inside)

---

## "Add Relationship" Modal Dialog

This modal is the primary focus of shot-03, overlaying the contact detail page.

### Modal container:
- White card, ~440px wide, ~auto height
- Moderate border-radius (~8–12px)
- Drop shadow
- Dark semi-transparent scrim behind it

### Modal header:
- **Icon:** Network/nodes icon (two nodes connected by a line, indicating "relationship")
- **Title text:** "Add relationship" — bold, ~16px
- **Close button:** "×" in the top-right corner of the modal

### Modal form fields:

**1. Name row:**
- Label: "Name" (left-aligned label)
- Input 1: Text input, placeholder "First Name"
- Input 2: Text input (adjacent), placeholder "Last Name"
- Both are standard single-line text inputs, side by side

**2. Type row:**
- Label: "Type" (left-aligned label)
- Input: Single-line text input with placeholder "Type e.g. Spouse"
- This is a free-text field (not a select dropdown), used to define the relationship type (e.g., Spouse, Partner, Co-buyer, Parent, etc.)

**3. Phone Number section:**
- Section label: "Phone Number" (left column), "Label" (middle column), "Bad Number" (right column) — three-column sub-header
- Row 1:
  - Phone input: placeholder "555-555-5555" (standard US phone format hint)
  - Label input: pre-populated with "mobile" (text input or select — appears pre-filled/default)
  - Bad Number: unchecked checkbox square
  - Delete row: trash/delete icon on far right
- Below row 1:
  - "+ Add another phone" — blue text link with "+" icon (adds another phone row)

**4. Email section:**
- Section label: "Email" (left-aligned)
- Row 1:
  - Email input: placeholder "example@email.com"
  - Delete row: trash/delete icon on far right
- Below row 1:
  - "+ Add another email" — blue text link with "+" icon (adds another email row)

### Modal footer buttons:
- **"Cancel"** — ghost/text button (no fill, no border — just text), positioned left of primary action
- **"Save relationship"** — blue filled button, rounded corners, white text. Primary CTA.

---

## Colors, Typography & Style

### Color palette:
- **Top nav bar:** Very dark charcoal/navy, approx `#1a2332` or `#1e2d3d`
- **Page background:** Light gray, approx `#f5f6f8` or `#f0f2f5`
- **Left column background:** White `#ffffff`
- **Center column background:** White `#ffffff`
- **Right sidebar background:** Light gray `#f5f6f8` (slightly darker than white)
- **Active/accent color (buttons, links, badges):** Medium blue, approx `#2563eb` or FUB's `#3b82f6` (tailwind blue-500/600 range)
- **"Text" action button (active):** Purple/violet, approx `#7c3aed` or similar
- **Task due date (overdue):** Red-orange, approx `#ef4444` or `#f97316`
- **Automation running indicator:** Green dot `#22c55e`
- **Tag/chip background:** Light gray `#e5e7eb`, dark text
- **Modal background:** White `#ffffff`
- **Modal scrim:** `rgba(0,0,0,0.4)` approximately
- **Link text color:** Teal-blue, approx `#0ea5e9` or `#2563eb`

### Typography:
- **Primary font:** Sans-serif system font (likely Inter or similar, used throughout FUB)
- **Contact name ("Laurie McAdam"):** ~18–20px, font-weight 600–700 (semibold/bold)
- **Section headers:** ~13–14px, font-weight 600, dark gray
- **Field labels:** ~12–13px, font-weight 500–600, medium gray
- **Field values:** ~13–14px, font-weight 400, dark gray/near-black
- **Timeline event content:** ~13px, regular weight
- **Timestamps:** ~12px, light gray

### Button styles:
- **Primary (filled):** Blue background, white text, ~6–8px border radius, ~32–36px height — e.g., "Save relationship"
- **Ghost / text buttons:** No background, no visible border, dark or blue text — e.g., "Cancel", quick-action buttons
- **Circular "+" buttons:** Blue filled circle, white "+" — used throughout the right sidebar for adding items
- **Tag pills:** Small rounded rectangles (~4px radius), light gray background, dark text, small "×" remove button

### Density:
- Moderate density — fields have ~8–12px vertical spacing
- The left column is compact; the right sidebar is also compact with sections stacking tightly
- The modal form is well-spaced for usability

### Iconography:
- Outlined/line-style icons throughout (not filled)
- Consistent size ~16–18px for most icons
- Icons are monochrome (matching text/gray palette) except for colored badges and action buttons

### Bottom progress bar ("Getting Started"):
- Not visible in this shot — the viewport is filled by the contact detail view and modal.

---

## State & Data Shown

### Active record:
- **Person:** Laurie McAdam, person ID 27022
- **Position in set:** Person 2 of 9 (navigating through a filtered list/smart list of 9 people)

### Contact data:
- **Phone:** (541) 788-0691, labeled "mobile"
- **Email:** lgmcadam@gmail.com
- **Address:** None set
- **Stage:** Lead
- **Assigned to:** Matt Ryan
- **Source:** Ryan-Realty.Com (website lead), created 17 days ago from screenshot date
- **Tags visible:** audience:seller, broker:matt, Buyer, campaign:concept-m-mountain, channel:fb-ads (+ 4 more hidden)

### Timeline state:
- **Filter active:** "All" tab selected
- **Email count:** 3
- **Chat count:** 0
- **Call count:** 0
- **Most recent activity:** Jun 24 (automation campaign email, archived)
- **Oldest visible:** Jun 13 (direct email: CMA delivery for 62285 Deer Trail Rd)

### Tasks:
- **1 overdue task:** "Hot seller LP lead — call within 5 min" — due Jun 12th 2026 at 6:39 PM (overdue), assigned to Matt Ryan

### Automations:
- **1 running:** "Web Inquiry Option 01" — started 3 weeks ago, status: Running

### Modal state:
- Modal is open, all fields empty (no relationship data entered yet)
- Phone label default = "mobile"
- Modal triggered by clicking "+" in the Relationships section

---

## Interactions & Behaviors

### Contact header:
- **Phone number** "(541) 788-0691": clicking opens a call initiation panel or triggers the browser's tel: protocol [INFERRED from FUB convention — likely opens a dialer modal or logs a call]
- **Email** "lgmcadam@gmail.com": clicking opens the "Send Email" compose panel [INFERRED]
- **"Add address"**: clicking opens an inline address form or modal [INFERRED]

### Relationships section:
- **Person+ icon:** clicking opens the "Add relationship" modal (this is what triggered the current modal) [CONFIRMED — modal is open]
- **Blue "+" button:** same as person+ icon [INFERRED — may be the actual trigger used]
- **"^" chevron:** collapses/expands the Relationships section [INFERRED]

### Details section:
- **Stage "Lead"**: clicking opens a dropdown/inline select to change the stage [INFERRED from FUB convention]
- **"Assigned to Matt Ryan"**: clicking opens an agent-select dropdown [INFERRED]
- **Tag "×" buttons**: clicking removes that tag from the contact [INFERRED]
- **"4 more" link**: clicking expands to show all tags [INFERRED]
- **Blue "+" tag button**: opens a tag-search/select input to add new tags [INFERRED]

### Quick-action buttons:
- **"Create Note"**: opens an inline note compose area in the center column [INFERRED]
- **"Send Email"**: opens an email compose panel, likely inline below the buttons [INFERRED]
- **"Text"**: opens an SMS/text compose panel inline — currently appears active/purple [INFERRED from URL `/call` sub-route inconsistency — Text button is visually selected]
- **"Log Call"**: opens a call-log form (duration, notes, outcome) [INFERRED]

### Activity timeline:
- **"View campaign email"** links: opens the full campaign email content, possibly in a new tab or modal [INFERRED]
- **"Reply" button**: opens a reply compose panel inline below the event [INFERRED]
- **">>" (forward) button**: forwards the email or logs a forwarding action [INFERRED]
- **"…" (more)** button: shows a dropdown with additional options (delete, archive, mark read, etc.) [INFERRED]
- **Event body**: clicking may expand a collapsed event to show full content [INFERRED]

### Right sidebar:
- **"‹" / "›" Person navigation**: loads the previous/next person record in the current list set [CONFIRMED by "Person 2 of 9" label]
- **Section "^" chevrons**: collapse that sidebar section [INFERRED]
- **Blue "+" buttons** in each section (Tasks, Appointments, Deals, Files, Collaborators, Automations): open a create/add form for that resource type [INFERRED]
- **Lightning bolt ⚡ icon in Tasks**: [INFERRED] may trigger an automation or mark task with priority/urgency
- **Task checkbox**: checking marks the task as complete [INFERRED]
- **"||" pause button on automation**: pauses the running "Web Inquiry Option 01" automation for this contact [INFERRED]
- **"Seen 17 days ago ▾" in Activity**: clicking the chevron shows full activity history or a tooltip with more detail [INFERRED]
- **"AgentFire FUB Widget"**: a third-party widget integration (AgentFire CRM plugin embedded into FUB sidebar) — collapsed state; expanding shows the widget content [INFERRED]
- **Files section drag-drop**: the placeholder "drag some here" confirms drag-and-drop file upload to associate files with this contact [CONFIRMED by text]

### Modal — "Add relationship":
- **"×" close button**: dismisses the modal without saving [INFERRED]
- **"Cancel" button**: same as close — dismisses modal [INFERRED]
- **"+ Add another phone" link**: adds a new phone number row to the form (dynamic row addition) [INFERRED]
- **"+ Add another email" link**: adds a new email row to the form [INFERRED]
- **"Bad Number" checkbox**: marks the phone number as invalid/do-not-call, probably sets a flag on the relationship's phone record [INFERRED]
- **Trash icons on phone/email rows**: removes that specific phone or email row from the form [INFERRED]
- **"Save relationship" button**: submits the form, creates a new relationship entity linking this person (Laurie McAdam) to the new person being defined (by name + type + contact info), then closes modal and updates the Relationships section [INFERRED]
- **"Type" field** free-text: FUB accepts arbitrary relationship type text (Spouse, Co-buyer, Parent, etc.) rather than a fixed enum — confirmed by placeholder "Type e.g. Spouse" which says "e.g." not "select" [CONFIRMED by UI]

### Keyboard shortcuts:
- **→ (right arrow)**: navigate to next person (Person 3 of 9) [CONFIRMED by footer hint]
- **← (left arrow)**: navigate to previous person (Person 1 of 9) [CONFIRMED by footer hint]

---

## Data Model Signals

### Entities revealed:

**Person (contact):**
- `id` (integer): 27022
- `first_name`: "Laurie"
- `last_name`: "McAdam"
- `avatar_initials`: "LM" (derived)
- `has_photo`: false
- `last_communication_at`: ~16 days ago from screenshot date
- `stage`: enum — at least includes "Lead"
- `assigned_agent_id` → Agent
- `source_name`: "Ryan-Realty.Com"
- `source_date` / `created_at`: 17 days ago
- `price`: nullable decimal
- `timeframe`: nullable string
- `lender`: nullable string (financing section)

**Person.phones[]:** (array / related table)
- `number`: "(541) 788-0691"
- `label`: "mobile" (likely enum: mobile, home, work, other)
- `is_bad`: boolean

**Person.emails[]:**
- `address`: "lgmcadam@gmail.com"

**Person.addresses[]:**
- (none set for this contact)

**Person.tags[]:**
- Tag schema uses colon-namespaced format: `namespace:value` (e.g., `audience:seller`, `broker:matt`, `campaign:concept-m-mountain`, `channel:fb-ads`)
- Plain tags also present: `Buyer` (no namespace)

**Relationship:**
- `id`
- `person_id` → Person (the primary contact)
- `related_person_id` → Person (the related contact — potentially a new or existing person)
- `type`: string (e.g., "Spouse", free text)
- Related person has its own: `first_name`, `last_name`, phones[], emails[]

**Activity / Timeline Event:**
- `id`
- `person_id` → Person
- `type`: enum — at least includes: `email`, `automation_email`, `note`, `call`, `text`
- `sender_id` → Agent
- `recipient_id` → Person (and cc: followupboss.me address)
- `occurred_at`: datetime
- `channel`: e.g., "automation"
- `subject`: string (for emails)
- `body`: text
- `has_attachment`: boolean
- `open_count`: integer (e.g., "1 open" badge)
- `status`: e.g., "archived"
- `campaign_email_url`: nullable URL

**Task:**
- `id`
- `person_id` → Person
- `title`: string ("Hot seller LP lead — call within 5 min: …")
- `due_at`: datetime (Jun 12th 2026 at 6:39 PM)
- `is_overdue`: boolean (derived)
- `assigned_agent_id` → Agent
- `completed`: boolean

**Automation enrollment:**
- `id`
- `person_id` → Person
- `automation_name`: "Web Inquiry Option 01"
- `status`: enum — includes "Running", "Paused", "Completed"
- `started_at`: datetime (~3 weeks ago)

**Appointment:**
- `id`
- `person_id` → Person
- `datetime`: datetime
- (empty state: "No upcoming appointments")

**Deal:**
- `id`
- `person_id` → Person
- (empty state: "No deals yet")

**File:**
- `id`
- `person_id` → Person
- `filename`: string
- (empty state: "No files yet, drag some here")

**Collaborator:**
- `person_id` → Person
- `agent_id` → Agent
- (empty state: "No collaborators")

**Agent / User:**
- `id`
- `name`: "Matt Ryan"
- `email`: "matt@ryan-realty.com" (inferred) / "ryan.realty@followupboss.me" (FUB relay)
- `role`: "Owner & Principal"
- `avatar_url`: (photo shown as orange-tinted circular headshot)

**Custom Fields (schema):**
- Fields are defined at the account level, attached to contacts; all text/dropdown types:
  - Recently Divorced, Recently Moved, Enrichment Provider, Phone Type, Net Worth Range, Income Range, Occupation, Has Children, Household Size, Marital Status

**Navigation context:**
- The "Person 2 of 9" header implies the user arrived from a list view (smart list, search result, or filter) containing 9 contacts, and is navigating through them in sequence.

---

## Rebuild Notes

### Component breakdown:

```
<AppShell>
  <TopNavBar>
    <NavBurger />
    <NavItem icon="people" label="People" active />
    <NavItem icon="inbox" label="Inbox" />
    <NavItem icon="tasks" label="Tasks" />
    <NavItem icon="calendar" label="Calendar" />
    <NavItem icon="deals" label="Deals" />
    <NavItem icon="reporting" label="Reporting" />
    <NavItem icon="admin" label="Admin" />
    <GlobalSearch placeholder="Search" />
    <NavIconButton icon="email" />
    <NavIconButton icon="chat" />
    <NavIconButton icon="person-add" />
    <NavNotificationBell />
    <UserAvatar src={mattHeadshot} />
  </TopNavBar>

  <PersonDetailLayout>
    <LeftPanel>
      <ContactHeader
        initials="LM"
        name="Laurie McAdam"
        lastCommunication="16 days ago"
      />
      <ContactFields>
        <PhoneField number="(541) 788-0691" label="mobile" />
        <EmailField address="lgmcadam@gmail.com" />
        <AddressField placeholder="Add address" />
      </ContactFields>

      <CollapsibleSection title="Relationships" icon="people">
        <RelationshipList empty="No relationships" />
        <AddRelationshipButton onClick={openAddRelationshipModal} />
      </CollapsibleSection>

      <CollapsibleSection title="Details" icon="list">
        <DetailField label="Stage" value="Lead" type="select" />
        <DetailField label="Assigned to" value="Matt Ryan" type="agent-select" />
        <DetailField label="Source" value="Ryan-Realty.Com, 17 days ago" type="readonly" />
        <DetailField label="Price" value={null} type="currency" />
        <DetailField label="Timeframe" value={null} type="text" />
        <TagsField tags={["audience:seller","broker:matt","Buyer","campaign:concept-m-mountain","channel:fb-ads"]} overflow={4} />
      </CollapsibleSection>

      <CollapsibleSection title="Financing" icon="document">
        <DetailField label="Lender" value={null} type="text" />
      </CollapsibleSection>

      <CollapsibleSection title="Custom Fields" icon="grid">
        {customFields.map(f => <DetailField key={f.key} label={f.label} value={f.value} />)}
      </CollapsibleSection>
    </LeftPanel>

    <CenterColumn>
      <QuickActionBar>
        <QuickAction icon="note" label="Create Note" />
        <QuickAction icon="email" label="Send Email" />
        <QuickAction icon="text" label="Text" active />
        <QuickAction icon="phone" label="Log Call" />
      </QuickActionBar>

      <ActivityFilterTabs>
        <FilterTab label="All" active />
        <FilterTab icon="email" count={3} />
        <FilterTab icon="chat" count={0} />
        <FilterTab icon="phone" count={0} />
        <FiltersButton />
      </ActivityFilterTabs>

      <ActivityTimeline>
        <TimelineEvent
          type="automation_email"
          sender="Matt Ryan"
          recipient="Laurie McAdam"
          date="Jun 24"
          channel="automation"
          body="archived"
          campaignUrl="https://ryan-realty.c…"
        />
        <TimelineEvent
          type="automation_email"
          sender="Matt Ryan"
          recipient="Laurie McAdam"
          date="Jun 19"
          channel="automation"
          body="archived"
          campaignUrl="https://ryan-realty.c…"
        />
        <TimelineEvent
          type="automation_email"
          sender="Matt Ryan"
          recipient="Laurie McAdam"
          date="Jun 15"
          channel="automation"
          openCount={1}
          body="archived"
          campaignUrl="https://ryan-realty.com?_pxl=djoxLGM6MDIwOTY5MzYzOTM4NjUsYTox"
        />
        <TimelineEvent
          type="email"
          sender="Matt Ryan"
          recipient={["Laurie McAdam","ryan.realty@followupboss.me"]}
          date="Jun 13"
          subject="Your home value, 62285 Deer Trail Rd"
          bodyPreview="Hi Laurie, Thank you for the details on your home…"
          hasAttachment={true}
        />
      </ActivityTimeline>
    </CenterColumn>

    <RightSidebar>
      <PersonNavigator current={2} total={9} />

      <SidebarSection title="Action Plans" icon="play" empty="No action plans running" />

      <SidebarSection title="Activity" icon="bell" meta="Seen 17 days ago" collapsible />

      <SidebarSection title="Tasks" icon="checklist" count={1} addable lightning>
        <TaskItem
          title="Hot seller LP lead — call within 5 min: Laurie McAdam (62285 Deer Trail Rd, Bend, OR 97701, USA)"
          dueAt="Jun 12th 2026 at 6:39 PM"
          isOverdue={true}
          assignedTo="Matt Ryan"
          completed={false}
        />
      </SidebarSection>

      <SidebarSection title="Appointments" icon="calendar" addable empty="No upcoming appointments" />

      <SidebarSection title="AgentFire FUB Widget" icon="document" collapsed />

      <SidebarSection title="Deals" icon="briefcase" addable empty="No deals yet" />

      <SidebarSection title="Automations" icon="play" count={1} addable>
        <AutomationItem
          name="Web Inquiry Option 01"
          startedAt="3 weeks ago"
          status="Running"
          onPause={handlePause}
        />
      </SidebarSection>

      <SidebarSection title="Files" icon="paperclip" addable empty="No files yet, drag some here" dropzone />

      <SidebarSection title="Collaborators" icon="people" addable empty="No collaborators" />

      <KeyboardShortcutHint>
        Press [→] to view next lead or [←] to view previous lead
      </KeyboardShortcutHint>
    </RightSidebar>
  </PersonDetailLayout>

  {/* Modal overlay */}
  <Modal open={true} title="Add relationship" icon="network">
    <AddRelationshipForm>
      <FormRow label="Name">
        <TextInput placeholder="First Name" />
        <TextInput placeholder="Last Name" />
      </FormRow>
      <FormRow label="Type">
        <TextInput placeholder="Type e.g. Spouse" />
      </FormRow>
      <PhoneSection>
        <PhoneRow
          numberPlaceholder="555-555-5555"
          labelDefault="mobile"
          badNumber={false}
        />
        <AddMoreLink label="Add another phone" />
      </PhoneSection>
      <EmailSection>
        <EmailRow placeholder="example@email.com" />
        <AddMoreLink label="Add another email" />
      </EmailSection>
      <ModalFooter>
        <Button variant="ghost" onClick={closeModal}>Cancel</Button>
        <Button variant="primary" onClick={saveRelationship}>Save relationship</Button>
      </ModalFooter>
    </AddRelationshipForm>
  </Modal>
</AppShell>
```

### Non-obvious logic:

1. **"Person 2 of 9" navigation**: FUB maintains a cursor/index into whatever list or filter the agent was navigating from. The person detail view carries this context so agents can move through their pipeline sequentially. The prev/next chevrons AND keyboard arrow keys both trigger navigation. On navigate, the full person record reloads.

2. **URL sub-routing for quick actions**: The URL `/people/view/27022/call` suggests FUB uses sub-routes for the quick-action panel state (e.g., `/call`, `/email`, `/text`, `/note`). This makes deep-linking to a specific compose state possible (e.g., opening a text compose from an external trigger).

3. **"via automation" badge on timeline events**: Events triggered by automations/action plans carry this label. The "archived" body text suggests these are campaign emails that were auto-archived after delivery — FUB shows the automation log as a "sent archived" event rather than a full email thread.

4. **"1 open" badge**: Email open tracking. A tracking pixel in the campaign email was fired once. This is shown as a green pill on the timeline event.

5. **Tag namespacing**: Tags follow `namespace:value` convention for system-managed tags (`audience:seller`, `broker:matt`, `campaign:concept-m-mountain`, `channel:fb-ads`) while user-created plain tags (`Buyer`) have no namespace. This distinction likely affects how tags are created vs assigned.

6. **"4 more" overflow in tags**: Rather than showing all tags inline (which would overflow the sidebar), FUB caps at a visible count and provides a "4 more" link that expands in-place to show all tags.

7. **Relationship modal creates a new person**: The "Add relationship" form creates both a new Person entity (the related person) AND a Relationship entity linking them. The related person gets their own first/last name, phone, and email — meaning they become a first-class person record in FUB potentially, not just a metadata entry.

8. **"Bad Number" checkbox on relationship phone**: When checked, marks this phone number as invalid — useful for do-not-contact compliance. The label field for phone ("mobile", "home", etc.) is presumably either a free-text field or a small dropdown.

9. **Overdue task styling**: Tasks past their due date render the due date in red/orange text, visually flagging urgency. The task itself is not auto-dismissed — it stays in the list until manually completed or deleted.

10. **AgentFire FUB Widget**: A third-party embedded widget (AgentFire is a website/CRM platform). This shows FUB supports iframe or MCP-style widget embedding in the right sidebar for partner integrations.

11. **ryan.realty@followupboss.me**: FUB provides each account a relay email address (`*.followupboss.me`) so that email replies from clients to this address are automatically logged in FUB's timeline. It appears as a CC recipient on outbound emails.

12. **Files section drag-drop**: The "drag some here" empty state confirms the Files section is a native drag-and-drop upload zone — files dropped onto this section are attached to the contact record.
