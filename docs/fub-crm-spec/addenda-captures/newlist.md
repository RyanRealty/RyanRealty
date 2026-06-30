<!-- Addendum capture 2026-06-30. Fills coverage gaps for: §06a Smart Lists / new-list flow -->

# FUB New Smart List Creation Flow — Frame-by-Frame Analysis
Feeds spec §06a (Smart List creation) and §07 (Contact record states).
Captured: All People view → Save New Smart List modal → Filter operator dropdown → Contact record → Create Task dialog.

---

## Frame 1 — All People list (base / pre-action state)

**URL context:** People > All People

**Left sidebar — Collections:**
- Header: "People" with collapse/expand toggle
- "All People" row (selected, highlighted blue) — badge: "10K"
- Section header: "COLLECTIONS"
- Sub-section: **Pipeline**
  - Active & Pending Clients — 6
  - Hot/Weekly — 2
  - Warm/Bi-Weekly — (no count visible)
  - Past Clients/Sphere: Quarterly — 15
  - New Leads: No Call Attempt — (no count)
  - Cold/Bi-Monthly — 44
  - Old Leads: No Call Attempt — 7K
- Sub-section: **Neighborhoods**
  - Tetherow — 695
  - Sunriver — 436
  - Pronghorn — 13
  - Black Butte Ranch — 4
  - Northwest Crossing — 3K
  - Vandevert — 18
  - Crosswater — 58
  - Caldera Springs — 208
  - Sunstone Loop — Showing Brokers — (no count)
  - Bend - River West — 2K
  - Bend - Awbrey Butte — 1K
  - Bend - Summit West — 1K
  - Bend - Century West — 712
- "Manage" link at bottom

**Main content area:**
- Page heading: "All People" (with star/bookmark icon prefix)
- Sub-label: "Showing **one** person" — counts bar (icons for grid/list/etc.)
- Toolbar: "How Smart Lists work" link | "Columns ▾" | "Everyone ▾" | "Filters (1)"
- Active filter chip: "Last Received Email less than 1..." (truncated)
- Column headers: Name | Agent | Last Visit | Phone
- "+ Add a filter" placeholder visible in filter bar
- Single visible row: **Amy Mora** (avatar "AM") — Source tag: "Import" — Phone: partially visible
- Top-right corner: "+ New List" button (outlined)

**What's notable:** One person shown (heavy filter applied). Smart list sidebar shows existing collections. The "+ New List" button is the trigger for the next action.

---

## Frame 2 — "Save New Smart List" modal (empty state)

**Trigger:** User clicked an element near the top-right (red "Clicked" tooltip visible adjacent to user avatar area, consistent with clicking "+ New List" button).

**Background:** All People list is dimmed/overlaid.

**Modal — full spec:**

Title: **"Save New Smart List"**
Close button: × (top-right of modal)

### Name field (Required)
- Label: "Name" + "Required" (greyed sub-label)
- Left of text input: emoji picker button — shows 😊 with dropdown caret (▾)
- Text input: empty, cursor blinking (focused state)
- Placeholder: none visible

### Description field
- Label: "Description"
- Rich text editor with toolbar:
  - **B** (Bold) | *I* (Italic) | U (Underline) | • (Unordered list) | 1. (Ordered list) | 🔗 (Link) | 😊 (Emoji) | Tx (Clear formatting)
- Text area: empty
- Character counter (bottom-right of text area): **"0/1000"**

### Share smart list with section
- Label: "Share smart list with"
- Search input with 🔍 icon: placeholder "Search for agents or teams..."
- Checkbox row: ☐ "Share with everyone"
- Section divider: "AGENTS" (grey uppercase label)
- Three agent rows with unchecked checkboxes:
  - ☐ Matt Ryan
  - ☐ Paul Stevenson
  - ☐ Rebecca Peterson
- Privacy status line (below agents): **"This smart list is private"** (grey italic)

### Footer
- Left: "Learn more about filters and smart lists." (blue hyperlink)
- Right: "Cancel" button (outlined) | "Save List" button (greyed out / **disabled** — no name entered)

**State logic:** Save List is disabled until Name field has content. Sharing defaults to private (no agents checked). Emoji picker provides icon prefix for the list name.

---

## Frame 3 — All People list, filter/column state after modal interaction

**What changed from f01:**
- Modal is dismissed (no action taken / Cancel clicked)
- Column layout changed: "Lead Score" column now visible between Name and Agent
- "Agent" column shows "Matt Ryan" populated on Amy Mora's row
- Red "Clicked" tooltip appears in center of the list row area (Amy Mora row, ~Agent column position)
- Filter still active: "Last Received Email less than 1..."
- "Everyone ▾" dropdown still in toolbar

**Inference:** User cancelled the modal, then clicked somewhere on the Amy Mora row (possibly the agent cell or row itself to open contact record). The Lead Score column appearing suggests Columns ▾ was adjusted, or the column set is the same as f01 but scrolled/re-rendered differently.

---

## Frame 4 — Filter operator dropdown (Last Received Email filter)

**Trigger:** User clicked the active filter chip "Last Received Email less than 1..." to edit it. Red "Clicked" tooltip and dropdown state confirms this.

**Browser tab:** Shows "wait" (loading indicator active)

**Dropdown contents — filter operator options for "Last Received Email":**

Current filter expression in the header of the dropdown: "Last Received Email less than 1..."

Operator options listed (vertical list):
1. is not empty
2. **was less than** ← currently selected (blue checkmark ✓)
3. [editable value field showing "1"] [unit field showing "days ago"]
4. was more than
5. is empty

**State:** "was less than 1 days ago" is the active operator/value. This matches why only 1 person shows (Amy Mora received email within the last 1 day).

**Spec note:** Filter operators for date/time fields follow this pattern: {is not empty, was less than [N] [unit], was more than [N] [unit], is empty}. The value and unit ("1" / "days ago") are editable inline.

---

## Frame 5 — Contact record: Amy Mora (full view, email thread active)

**Navigation:** Clicked Amy Mora row → contact detail page

**Left panel — contact identity + details:**
- Avatar: "AM" (initials)
- Name: **Amy Mora**
- Sub-label: "Last Communication [timestamp]" (partially visible)
- Phone: (209) 390-4422 (mobile) — click-to-call icon
- Email: amy.mora@theagencyco.com — click-to-email icon
- "+ Add address" link
- **Relationships** section — icons visible (+ add relationship)
- **Details** section (collapsed/compact):
  - Stage: Real Estate Agent
  - Assigned to: Matt Ryan
  - Source: Import, a year ago
  - Price: (empty)
  - Timeframe: (empty)
  - Tags: compliance:hard-stop (+ others, truncated)
  - Gender: (empty)
- **Custom Fields** section — visible but fields not expanded

**Center panel — communication feed:**
- Top action bar: [Create Note] [Send Email] [Text] [Log Call] | "How it works"
- Active tab showing email thread
- Email visible: From Matt Ryan to Amy Mora — subject contains "Amy Mora, this one really is for you" — Ryan Realty email signature block visible

**Right panel — sidebar widgets:**
- Navigation: "Person 5 of 5"
- Action Plans — (running state)
- Activity — (state not clearly visible)
- Tasks — badge visible
- Appointments — (state not clearly visible)
- AgentFire FUB Widget
- Deals
- Automations
- Files
- (more below fold)

---

## Frame 6 — Contact record: Amy Mora (note/import tab, tags visible)

**What changed from f05:**
- Center panel now shows different content: **"Note Imported By Matt Ryan"** (Nov 7, 2025)
  - Content: "Notes: Location: 255 SW Bluff Ste 210"
  - Source line: "via: fub_contacts.csv on Nov 7th, 9:32:36 am"
- Left panel tags now clearly readable as chips:
  - `compliance:hard-stop` ×
  - `industry:realtor` ×
  - `Phone import` ×
- Red "Clicked" tooltip visible near center panel (user interacted with feed tabs or note)
- Right panel: same sections as f05

**Spec note §07:** The communication feed has tabs (All / Emails / Notes / Calls / Texts / Files / etc.). This frame shows the "All" or "Notes" tab displaying an imported CSV note. The tag chip format is `category:value` with × removal affordance.

---

## Frame 7 — Contact record + "Create task" dialog (empty state)

**Trigger:** User clicked the "+" button on the Tasks section in the right panel. Red "Clicked" tooltip appears near Tasks header.

**Background:** Contact record for Amy Mora visible but dimmed.

**Dialog — "Create task":**

Title: **"Create task"**
Close button: × (top-right)

Fields:
- **Task Name** — text input (empty, no placeholder visible)
- **Task Type dropdown** — currently showing: "Follow Up" (with dropdown caret ▾)
- **Assigned to dropdown** — currently showing: "Matt Ryan" (with dropdown caret ▾)
- **Date** — date picker input (empty)
- **Time** — time picker input (empty)

Footer:
- "Cancel" button (outlined) | "Create task" button (**blue / enabled** — enabled even without a name entered)

---

## Frame 8 — "Create task" dialog with task type dropdown open

**Trigger:** User clicked the "Follow Up" task type dropdown. Red "Clicked" tooltip visible near the dropdown.

**Task type dropdown — full option list:**
1. Follow Up ← (highlighted / currently selected)
2. Call
3. Email
4. Text
5. Showing
6. Closing
7. Open House
8. Thank You

**Spec note §07:** Eight task types available. Default is "Follow Up". No "Other" or free-form option visible.

---

## Frame 9 — Contact record, dialog dismissed, Tasks section clicked

**What changed:**
- "Create task" dialog dismissed (no task saved)
- Red "Clicked" tooltip appears near the **Tasks** section header / "+" button area in the right panel
- "Last Communication 40 minutes ago" now shows in left panel header (timestamp advanced)
- Right panel otherwise same

**Inference:** User closed the dialog (Cancel or ×), then clicked the Tasks section expand button or the "+" again to observe the section state.

---

## Frame 10 — Contact record: Amy Mora (clean / resting state)

**Final state — right panel fully visible and readable:**

Navigation: "Person 5 of 5" (with previous/next arrows)

Right panel sections (all expanded, all empty):
- **Action Plans** — "No action plans running"
- **Activity** — "No website activity yet"
- **Tasks** — "No upcoming tasks" (with + and ↑↓ icons)
- **Appointments** — "No upcoming appointments" (with + icon)
- **AgentFire FUB Widget**
- **Deals** — "No deals yet" (with + icon)
- **Automations** — "No automations running" (with + icon)
- **Files** — "No files yet, drag some here" (with + icon)
- **Collaborators** — (+ and expand icons visible)

Keyboard navigation hint (bottom of right panel):
> "Press [↑] to view next lead or [↓] to view previous lead"

**Left panel — final state:**
- "Last Communication 40 minutes ago"
- Tags (chips): compliance:hard-stop, industry:realtor, Phone import
- All other fields same as f06

---

## Summary for spec §06a / §07

### §06a — Save New Smart List modal

| Field | Type | Required | Constraints |
|---|---|---|---|
| Name | Text input | Yes | Emoji prefix picker (😊 ▾) prepended; free text |
| Description | Rich text editor | No | Max 1000 chars; toolbar: B/I/U/UL/OL/link/emoji/clear |
| Share with | Agent/team search + checkboxes | No | "Search for agents or teams..."; "Share with everyone" checkbox; per-agent checkboxes (Matt Ryan, Paul Stevenson, Rebecca Peterson); defaults to private |
| Privacy status | Read-only label | — | "This smart list is private" when no agents selected |

**Save List button:** Disabled until Name has content. Cancel dismisses without saving. "Learn more about filters and smart lists." help link present.

### §07 — Contact record states observed

| Surface | State observed |
|---|---|
| Left panel tags | Chips format: `category:value` with × removal; e.g. `compliance:hard-stop`, `industry:realtor`, `Phone import` |
| Center feed | Tabs: All / [Emails] / [Notes] / [Calls] / [Texts] / [Files] / [more]; imported CSV notes show "Note Imported By [user]" with source file + timestamp |
| Right panel — Tasks | Empty state: "No upcoming tasks"; "+" opens Create task dialog |
| Right panel — Deals | Empty state: "No deals yet" |
| Right panel — Automations | Empty state: "No automations running" |
| Right panel — Files | Empty state: "No files yet, drag some here" |
| Right panel — Action Plans | Empty state: "No action plans running" |
| Right panel — Activity | Empty state: "No website activity yet" |
| Right panel — Appointments | Empty state: "No upcoming appointments" |
| Create task dialog | Fields: Task Name (text), Type (dropdown: Follow Up/Call/Email/Text/Showing/Closing/Open House/Thank You), Assigned to (agent dropdown), Date, Time; Create task button active even with empty name |
| Filter operators (date field) | is not empty / was less than [N] [unit] / was more than [N] [unit] / is empty |
| Keyboard nav hint | "Press [↑] to view next lead or [↓] to view previous lead" (bottom of right panel) |
| Person position indicator | "Person X of Y" at top of right panel |
| Last Communication | Relative timestamp in left panel header (e.g. "40 minutes ago") |
