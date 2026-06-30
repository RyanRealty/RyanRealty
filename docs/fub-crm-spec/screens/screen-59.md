<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.32.59 AM.png | Sequential id: shot-59 | Tiles: fub-tiles/shot-59_{full,q1,q2,q3,q4}.png -->

# shot-59 — People List (Smart List: Pronghorn) — Export Selected People Modal

## Identity

- **Visible URL:** `ryan-realty.followupboss.com/2/people/list/100`
- **Browser tab title:** "Pronghorn · People - Follo..." (truncated)
- **Active top-nav item:** People (leftmost nav pill, appears selected)
- **Active sub-nav / list:** "Pronghorn" — a Neighborhood smart list under the COLLECTIONS group in the left rail
- **Breadcrumb context:** COLLECTIONS > Pronghorn
- **Logged-in user (top-right):** Avatar visible (circular photo, appears to be Matt Ryan's headshot — dark-haired male); additional icon buttons to the left of the avatar (message bubble, bell/notification)
- **Account / brokerage name:** Ryan Realty (visible in browser bookmarks bar: "Ryan Realty")
- **Modal state:** A blocking modal dialog "Export Selected People" is open, overlaying the underlying People list

---

## Layout

### Top-level structure (full screen)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FUB Top Navigation Bar (dark/navy, ~40px tall)                             │
├──────────────────────┬──────────────────────────────────┬───────────────────┤
│  Left Rail           │  Main Content (People Table)     │  Right Filter     │
│  (~200px wide,       │  (center, ~55% of width,        │  Panel            │
│  full height,        │  scrollable)                    │  (~280px wide,    │
│  scrollable)         │                                  │  fixed/sticky)    │
└──────────────────────┴──────────────────────────────────┴───────────────────┘
│  (Horizontal scrollbar at bottom of table)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Modal overlay:** A centered white dialog with a semi-transparent dark backdrop covers the entire page. Approximately 400–440px wide, ~220px tall, centered horizontally and vertically.

### Regions

1. **FUB Top Navigation Bar** — Fixed, dark (near-black / very dark navy) background, spans full width, ~40px tall. Contains: app logo (top-left), People nav item, tab items (Tables, Calendar, Goals, Reporting, Actions, Admin), global search icon, notification/message icons, user avatar (top-right).

2. **Left Rail / Smart Lists Sidebar** — Fixed left, white/light-gray background, ~200px wide, full-height scrollable. Contains People header, section groups (COLLECTIONS, Neighborhoods), individual smart list items with contact count badges. "Manage" link at very bottom.

3. **People List Sub-header Bar** — Directly below the top nav, above the table. Shows: current list name "Pronghorn" with edit icon, bulk-action toolbar (since 10 items are selected: "Selected 10 people — Deselect all" + action icons), and right-side controls: "How Smart Lists work" help link, "Columns" dropdown button, filter chip "Out Of State Home...", "Filters (4)" button, "Update List" blue button, refresh icon.

4. **Main Contact Table** — Scrollable center column. All 10 rows are checked (blue checkboxes). Columns: checkbox, avatar/initials, Name + source tag, [Lead Score numeric column], Last Activity (timestamp), Phone (with call/text icons), Email (with icon), Last Activity detail (Inquiry + address string).

5. **Right Filter Panel** — Sticky right sidebar, light/white background with subtle border. Shows current active filters as chips with remove controls, plus "Add a filter" at top and "Clear filters" at bottom.

6. **Modal Dialog ("Export Selected People")** — Centered overlay. White card with rounded corners (~8px radius), drop shadow. Contains: title, question text, checkbox option, description paragraph, Cancel + confirm buttons.

7. **Horizontal Scrollbar** — At the very bottom of the table region, indicating more columns are available to the right (not visible in viewport).

8. **Help Button** — Floating "?" circle button, bottom-right corner of the page.

---

## Every UI Element (Exhaustive)

### FUB Top Navigation Bar

- **FUB Logo / App Icon:** Top-left, small square icon (FUB brand mark in white/orange)
- **Nav pills (left to right):**
  - **People** (active — appears highlighted or underlined)
  - **Tables**
  - **Calendar**
  - **Goals**
  - **Reporting**
  - **Actions**
  - **Admin**
- **Top-right icon cluster (left to right):**
  - Chat/message bubble icon (teal/green circle with white speech bubble glyph) — likely opens internal messaging or FUB inbox
  - Purple/violet circle icon — possibly activity feed or notifications
  - Person/silhouette icon (gray) — possibly team or contacts
  - Bell icon — notifications
  - User avatar (circular headshot photo, ~28px) — account menu [INFERRED: opens profile/logout dropdown]

### Left Rail — People Smart Lists Sidebar

**Header:**
- Section label: **"People"** (bold, larger font)

**Top-level item:**
- **"All People"** — no badge count visible, link to full unfiltered contact list

**COLLECTIONS section header** (small caps label "COLLECTIONS" with a collapse arrow/chevron)

**COLLECTIONS items (smart list rows — each has: icon + name + badge count):**
- Pipeline group (or sub-label "Pipeline"):
  - **"Active & Pending Claims"** — funnel/triangle icon
  - **"Hot/Weekly"** — funnel icon
  - **"Warmth-Weekly"** — funnel icon
  - **"Past Clients/Sphere: Suar..."** (truncated) — funnel icon
  - **"New Leads: No Call Attempt"** — funnel icon
  - **"Cold&i Monthly"** — funnel icon (note: appears to read "Cold&i" — may be "Cold/i" or similar)
  - **"Old Leads: No Call Attempt"** — badge count: **7k**
- Additional collection items visible with badge **44** next to one item that may read "Cold/Bi-Monthly"

**Neighborhoods section header** (label "Neighborhoods" with collapse arrow)

**Neighborhoods items:**
| Name | Badge Count |
|---|---|
| Tetherow | 696 |
| Sunriver | 436 |
| **Pronghorn** | **13** (highlighted / active — blue or darker background highlight) |
| Black Butte Ranch | 4 |
| Northwest Crossing | 3k |
| Vandevert | 18 |
| Crosswater | 58 |
| Caldera Springs | 208 |
| Sunstone Loop — Showing Brok... (truncated) | (count truncated) |
| Bend - River West | 2k |
| Bend - Awbrey Butte | 1k |
| Bend - Summit West | 1k |
| Bend - Century West | 712 |
| Bend - Southern Crossing | 444 |

**Each smart list row:** Small funnel/triangle icon (orange or gray), list name text, right-aligned count badge (gray pill or plain number).

**Bottom of left rail:**
- **"Manage"** text link (with a settings/gear icon or similar glyph) — [INFERRED: opens smart list management UI]

### People List Sub-header Bar

**Left side (bulk selection active state):**
- **Checkbox** (checked, blue) — master select/deselect
- Text: **"Selected 10 people"** — indicates 10 of 13 total Pronghorn contacts are checked
- **"— Deselect all"** — inline link to clear selection
- **Action icons** (appear as icon buttons in a row — exact glyphs partially obscured by modal, but likely): Send email, Send text, Assign, Add to action plan, Export, Delete/archive

**Right side (list controls):**
- **"How Smart Lists work"** — small blue/teal text link with a "?" or info icon — opens help documentation [INFERRED]
- **"Columns"** — gray/outline button with a columns-grid icon — opens column picker dropdown [INFERRED]
- **"Out Of State Home..."** — filter chip (gray/light blue pill with truncated label "Out Of State Home...") — indicates an active column-based filter or saved filter preset
- **"Filters (4)"** — button with funnel icon and "(4)" count badge — opens/shows the filter panel (already open to the right)
- **"Update List"** — blue filled button — saves any changes to the smart list definition [INFERRED]
- **Refresh/gear icon** — small icon button next to "Update List" (circular arrows or gear) — possibly force-refresh the list or open list settings

### Main Contact Table

**Column Headers (left to right, as visible):**
1. **Checkbox column** (no label) — bulk select; all 10 rows checked
2. **Name** — contact name + source tag beneath it
3. **[Lead Score / number column]** — shows integer values (2 or 4 in all visible rows); no visible header label in the cropped view; likely "Lead Score" or a prioritization column
4. **Last Activity** — timestamp of most recent CRM activity (format: "Nov 13th '25")
5. **[Phone column]** — phone number with call icon (green phone handset) and text icon (green chat bubble) as inline action buttons
6. **[Email column]** — email address with email envelope icon
7. **Last Activity [detail]** — long text field showing "Inquiry - [address]" format — the specific activity description

**Note:** A horizontal scrollbar exists at the bottom indicating additional columns are off-screen to the right (e.g., Stage, Assigned Agent, Tags, etc. — [INFERRED from FUB convention])

**Visible Rows (all checked, top to bottom):**

| # | Avatar | Name | Source Tag | Score | Last Activity Date | Phone | Email | Activity Detail |
|---|---|---|---|---|---|---|---|---|
| 1 | CB (initials) | Curtis Berry | Import | 4 | Nov 13th '25 | — | Aileen.c.murphy@gmail.com | Inquiry - 1813 NW Hartford Ave 97703 |
| 2 | BT (initials) | Baker Trust | Import | — | — | — | — | — |
| 3 | AI (initials) | Anastasia Iglesia Lo... | Import | — | — | — | — | — |
| 4 | BB (initials) | Bradley Biber | Import | — | — | — | — | — |
| 5 | RR (initials) | Rodney Ritter | Import | 4 | Nov 13th '25 | (801) 209-4509 | Aileen.c.murphy@gmail.com | Inquiry - 1813 NW Hartford Ave 97703 |
| 6 | JM (initials) | James Mcgaw | Import | 4 | Nov 13th '25 | (770) 365-0916 | Loveburgerlive@gmail.com | Inquiry - 65880 Pronghorn Estates Dr 97701 |
| 7 | JC (initials) | Jack Crosley | Import | 4 | Nov 13th '25 | (760) 777-7883 | — | Inquiry - 23097 Watercourse Way 97701 |
| 8 | WH (initials) | William Hawken | Import | 4 | Nov 13th '25 | (615) 448-8241 | Misterdan2017@gmail.com | Inquiry - 22923 Canyon View Loop 97701 |
| 9 | Z8 (initials/logo) | Z8 Villa LLC | Expired Listing | 4 | Nov 13th '25 | (541) 306-4535 | Z8style@verdoorns.net | Inquiry - 65670 Swallows Nest Ln 97701 |
| 10 | SE (initials) | Steven Emery | Expired Listing | 2 | Nov 13th '25 | (541) 546-2464 | Semery9394@aol.com | Inquiry - 65883 Bearing Dr 97701 |
| 11 | JG (initials) | John Giannini | Farm | 2 | Nov 13th '25 | (408) 656-1052 | johng@saratoga-springs.com | Inquiry - 65845 Pronghorn Estates Dr 97701 |

**Row anatomy:**
- **Checkbox** (blue filled square with white checkmark = selected; empty square = not selected)
- **Avatar** (circular, ~32px): If contact has a photo, shows photo; otherwise shows 2-letter initials on a colored background (colors vary per contact — appears auto-assigned)
- **Name** (bold, primary text): Full contact name
- **Source tag** (below name, smaller text, gray/muted): "Import", "Expired Listing", "Farm" — represents how this lead entered the system
- **Score column**: Integer (2 or 4 visible) — likely an auto-calculated engagement/lead score
- **Last Activity timestamp** (clock icon + "Nov 13th '25"): Relative date of last logged activity
- **Phone cell**: Shows phone number; inline green phone icon (click to call) and green speech-bubble icon (click to text); if WhatsApp connected, may show WA icon
- **Email cell**: Shows email address; email envelope icon (teal/blue) inline
- **Activity detail cell**: Shows most recent activity type + associated address/property string, e.g. "Inquiry - 65880 Pronghorn Estates Dr 97701"; prefixed with a speech-bubble/comment icon

**Row interactions [INFERRED]:**
- Click anywhere on row (except checkbox/icons) → opens Contact Detail / Person Record for that contact
- Hover → row highlights with light background
- Phone icon click → initiates call via FUB dialer
- Text icon click → opens SMS compose panel
- Email icon click → opens email compose panel

**Pagination / count:**
- "Selected 10 people" shown in sub-header — implying all 10 visible are selected
- The Pronghorn list badge shows 13 contacts total — so 13 total rows, with some possibly off-screen or partially visible
- Pagination controls (< >) appear at the bottom-right of the table (visible in q4), indicating multi-page results or column scrolling controls

### Right Filter Panel

**Header:**
- **"Add a filter"** — blue text link with a "+" icon at top — [INFERRED: opens filter builder dropdown to add a new condition]

**Active filter chips (stacked, each with remove "×" and expand "∨" controls):**

1. **"Tags exclude any of: do_not_te..."** (truncated)
   - Icon: tag icon (orange/amber)
   - Filter type: Tags
   - Operator: exclude any of
   - Value: "do_not_te..." (likely "do_not_text" or "do_not_contact" tag)
   - Right side: expand arrow "∨" to edit

2. **"Stage excludes any of: Real Est..."** (truncated)
   - Icon: stage/pipeline icon
   - Filter type: Stage
   - Operator: excludes any of
   - Value: "Real Est..." (likely "Real Estate Attorney" or "Real Estate Agent" — a stage name)
   - Right side: expand arrow "∨"

3. **"Tags exclude any of: complianc..."** (truncated)
   - Icon: tag icon (orange/amber)
   - Filter type: Tags
   - Operator: exclude any of
   - Value: "complianc..." (likely "compliance" or "compliance:hard-stop" tag)
   - Right side: expand arrow "∨"

4. **"Tags include any of: neighborh..."** (truncated)
   - Icon: tag icon (orange/amber)
   - Filter type: Tags
   - Operator: include any of
   - Value: "neighborh..." (likely "neighborhood:pronghorn" or similar geo tag)
   - Right side: expand arrow "∨"

**Footer:**
- **"Clear filters"** — blue text link at the bottom — removes all active filters

**Total filter count:** 4 (matching the "Filters (4)" badge in the sub-header)

### Export Selected People Modal Dialog

**Backdrop:** Semi-transparent dark overlay (rgba black ~50–60% opacity) covers the entire page behind the modal.

**Modal card:** White background, rounded corners (~8–10px), drop shadow, approximately 420px × 220px. Positioned center of viewport.

**Modal header:**
- **Title text:** **"Export Selected People"** — bold, ~16–18px, dark text, left-aligned
- **Close button "×"** — top-right corner of the modal header area (gray "×" glyph, ~20px)

**Modal body:**

- **Question text:** **"Would you like to export 10 people?"** — medium weight, ~14–15px, dark text

- **"Export all columns" checkbox option:**
  - Unchecked checkbox (square, empty/gray)
  - Label: **"Export all columns"**
  - **"?" info/help icon** — small circular question mark icon immediately to the right of the label (teal/blue) — [INFERRED: hovering shows tooltip explaining what "all columns" means vs. default column export]

- **Description paragraph (gray/muted text, ~13px):**
  > "You can continue using Follow Up Boss once your export starts. When the export is complete it will automatically start downloading and we will also send you an email."

**Modal footer (button row, right-aligned):**
- **"Cancel"** — outline/ghost button (white background, gray border, dark text) — closes the modal without exporting [INFERRED]
- **"Yes, export people"** — filled blue button (primary action, blue background, white text) — confirms and begins the CSV export

---

## Colors, Typography & Style

### Colors

| Element | Color Description | Approximate Hex |
|---|---|---|
| FUB Top Nav bar | Very dark navy / near-black | ~#1a1f2e or #0f1422 |
| Page background | Light gray / off-white | ~#f5f6f8 |
| Left rail background | White | #ffffff |
| Left rail active item | Light blue highlight | ~#e8f0fe or #eff4ff |
| Primary blue buttons ("Update List", "Yes, export people") | Medium blue | ~#3b82f6 or #2563eb |
| Checkbox checked state | Blue | ~#3b82f6 |
| Filter chip background | Very light blue-gray | ~#f0f4ff |
| Tag icon color | Orange / amber | ~#f59e0b |
| Contact avatar backgrounds | Varied per contact (auto-assigned) | Multiple |
| Phone call icon | Green | ~#22c55e |
| Phone text/SMS icon | Green (slightly different shade) | ~#16a34a |
| Email envelope icon | Teal / blue-green | ~#0ea5e9 |
| Activity detail icon | Gray / muted | ~#6b7280 |
| Modal backdrop | Semi-transparent dark | rgba(0,0,0,0.5) |
| Modal card | White | #ffffff |
| Modal title text | Dark charcoal | ~#111827 |
| Modal description text | Muted gray | ~#6b7280 |
| Cancel button border | Light gray | ~#d1d5db |
| "Clear filters" link | Blue | ~#3b82f6 |
| "Add a filter" text | Blue | ~#3b82f6 |
| Smart list count badges | Gray text, no pill background | ~#6b7280 |
| Source tag text (Import, Expired Listing, Farm) | Small, gray/muted | ~#6b7280 |

### Typography

- **Nav items:** ~13–14px, medium weight, white text on dark nav
- **List names (left rail):** ~13–14px, regular weight, dark gray
- **Active list name:** ~13–14px, medium/semi-bold, darker
- **Table column headers:** ~12–13px, semi-bold or all-caps, muted gray
- **Contact names:** ~14px, semi-bold, dark charcoal
- **Source tags:** ~11–12px, regular, gray (displayed below contact name)
- **Phone / email in table:** ~13px, regular, dark
- **Activity text:** ~12–13px, regular, muted
- **Modal title:** ~16px, semi-bold or bold
- **Modal body text:** ~13–14px, regular
- **Buttons:** ~13–14px, medium weight

### Style

- **Border radius:** Buttons ~6px, modal ~8–10px, avatars fully round (50%), filter chips ~4–6px, checkboxes ~3px
- **Density:** Medium — rows are ~44–48px tall with comfortable padding; left rail items ~32–36px tall
- **Iconography style:** Line icons / flat SVG, 16–18px, consistent stroke weight; colored only for functional states (green for call/text, teal for email, orange/amber for tags)
- **Shadow on modal:** Soft multi-layer box-shadow (standard elevated card pattern)
- **Table:** No visible outer border; rows separated by subtle 1px light-gray horizontal rules
- **No "Getting Started" green progress bar** is visible in this shot (it has been completed or dismissed)

---

## State & Data Shown

### Active list
- **Smart list:** "Pronghorn" (Neighborhood type), URL `/2/people/list/100`
- **Total contacts in list:** 13 (from badge in left rail)
- **Currently selected:** 10 of 13 contacts (all visible rows are checked)

### Active filters (4 total)
1. Tags exclude any of: `do_not_te...` (compliance exclusion tag)
2. Stage excludes any of: `Real Est...` (agent/attorney exclusion)
3. Tags exclude any of: `complianc...` (compliance tag exclusion)
4. Tags include any of: `neighborh...` (neighborhood inclusion tag — drives the Pronghorn smart list membership)

### Column filter chip
- "Out Of State Home..." — an additional filter visible as a chip in the sub-header (distinct from the 4 panel filters — may be a column-based filter or a saved view preset)

### Modal state
- Export dialog is open
- Exporting **10 people** (the currently selected contacts)
- "Export all columns" checkbox is **unchecked** (default = export standard/default columns only)

### Sample data values visible (real data — reveals data model)

**Contact names:** Curtis Berry, Baker Trust, Anastasia Iglesia Lo[renzo?], Bradley Biber, Rodney Ritter, James Mcgaw, Jack Crosley, William Hawken, Z8 Villa LLC, Steven Emery, John Giannini

**Source/Lead source values:**
- `Import` — bulk-imported leads
- `Expired Listing` — sourced from expired MLS listings
- `Farm` — geographic farming campaign

**Lead Score values:** 2, 4 (integer scale, likely 1–10 or 1–5)

**Last Activity date format:** "Nov 13th '25" (Month Day(th) 'YY abbreviated)

**Phone numbers (US format with area codes):**
- (801) 209-4509 (Utah)
- (770) 365-0916 (Georgia)
- (760) 777-7883 (California/desert)
- (615) 448-8241 (Tennessee)
- (541) 306-4535 (Oregon — Bend area)
- (541) 546-2464 (Oregon — Bend area)
- (408) 656-1052 (California — Bay Area)

**Email addresses:**
- Aileen.c.murphy@gmail.com
- Loveburgerlive@gmail.com
- Misterdan2017@gmail.com
- Z8style@verdoorns.net
- Semery9394@aol.com
- johng@saratoga-springs.com

**Activity detail strings (format: "Inquiry - [address]"):**
- Inquiry - 22904 Moss Rock Dr 97701
- Inquiry - 22953 Canyon View Loop 97701
- Inquiry - 65867 Sage Canyon Ct 97701
- Inquiry - 1813 NW Hartford Ave 97703
- Inquiry - 65880 Pronghorn Estates Dr 97701
- Inquiry - 23097 Watercourse Way 97701
- Inquiry - 22923 Canyon View Loop 97701
- Inquiry - 65670 Swallows Nest Ln 97701
- Inquiry - 65883 Bearing Dr 97701
- Inquiry - 65845 Pronghorn Estates Dr 97701

**ZIP codes visible:** 97701 (Bend, OR), 97703 (Bend West/NW)

**Address patterns:** Pronghorn-area streets — "Pronghorn Estates Dr", "Watercourse Way", "Swallows Nest Ln", "Canyon View Loop", "Sage Canyon Ct", "Moss Rock Dr", "Bearing Dr"

---

## Interactions & Behaviors

### Modal: Export Selected People

- **Open trigger:** User clicked an "Export" action button (likely a download/export icon in the bulk-action toolbar after selecting contacts) [INFERRED]
- **"Export all columns" checkbox:**
  - Unchecked (default): exports only standard/default columns (Name, Phone, Email, Stage, Source, Last Activity, etc.)
  - Checked: exports every available field/column for each contact
  - [INFERRED: "?" tooltip explains which columns are included in each mode]
- **Cancel button:** Closes the modal, no action taken, selection remains
- **"Yes, export people" button:** Initiates a CSV file download; FUB begins generating the export in the background; download auto-starts when ready; user also receives an email notification with the file; user can continue using FUB immediately without waiting
- **"×" close button (top-right):** Same as Cancel [INFERRED]
- **Clicking backdrop:** May or may not close the modal [INFERRED — FUB typically requires explicit Cancel/close]

### People List Table

- **Row click:** Opens the Contact Detail (Person Record) page for that contact [INFERRED]
- **Checkbox click:** Selects/deselects that individual row; updates "Selected N people" count
- **Master checkbox (sub-header):** Selects all rows on current page; "Deselect all" link clears selection
- **Phone call icon (green handset):** Initiates an outbound call via FUB dialer [INFERRED]
- **Phone text icon (green bubble):** Opens SMS/text message compose panel [INFERRED]
- **Email icon (teal envelope):** Opens email compose panel [INFERRED]
- **"Deselect all" link:** Clears all row selections
- **Bulk action toolbar (with 10 selected):** Offers actions: email all, text all, assign, add to action plan, export, possibly delete/archive [INFERRED from FUB convention]

### Filter Panel

- **"Add a filter" link:** Opens a filter picker (dropdown or inline builder) to add a new filter condition [INFERRED]
- **Filter chip expand "∨" arrow:** Expands the chip inline to reveal and edit the filter values [INFERRED]
- **"Clear filters" link:** Removes all 4 active filters at once, showing full Pronghorn list without exclusions [INFERRED]

### Smart List Sidebar

- **Smart list row click:** Loads that list in the main content area, updates URL to /2/people/list/[id] [INFERRED]
- **Pronghorn (active):** Currently loaded, highlighted in blue
- **"Manage" link:** Opens smart list management interface [INFERRED]
- **Section collapse arrows:** Collapse/expand the COLLECTIONS or Neighborhoods group [INFERRED]

### Sub-header Controls

- **"Columns" button:** Opens a column picker modal or dropdown to show/hide table columns [INFERRED]
- **"Update List" button:** Saves changes to the smart list filter definition [INFERRED]
- **Refresh icon (next to Update List):** Force-refreshes the contact list / recalculates membership [INFERRED]
- **"How Smart Lists work" link:** Opens FUB help documentation about smart lists in a new tab [INFERRED]
- **"Out Of State Home..." chip:** Click to remove or edit this filter [INFERRED]
- **"Filters (4)" button:** Toggles or focuses the right filter panel [INFERRED]

---

## Data Model Signals

### Entities

- **Person / Contact** (`people` table): id, name (full name), avatar/initials, source (enum), lead_score (integer), last_activity_at (timestamp), phone (string), email (string), last_activity_detail (string — activity type + property address)
- **Smart List / People List** (`people_lists` table): id (100 in URL), name ("Pronghorn"), type (Neighborhood), count (13), filter_definition (JSON — array of filter conditions)
- **Filter Condition** (embedded in smart list): field (Tags, Stage), operator (exclude any of, include any of), values (array of tag names or stage names)
- **Tag** (`tags` table or enum): string values like "do_not_text", "compliance:hard-stop", "neighborhood:pronghorn" etc.
- **Stage** (`stages` table or enum): "Real Est..." — likely "Real Estate Attorney" or similar exclusion stage
- **Lead Source** (enum on Person): "Import", "Expired Listing", "Farm" — indicates lead origin
- **Activity** (`activities` or `timeline_events` table): type (Inquiry), detail (address string), timestamp

### Field / Enum Values Observed

- **Lead Source values:** `Import`, `Expired Listing`, `Farm`
- **Lead Score:** Integer (2, 4 seen — implies scale, likely 1–10)
- **Activity type in detail:** `Inquiry` (followed by property address)
- **Address format in activity:** "{number} {street} {city/zip}" — e.g. "65880 Pronghorn Estates Dr 97701"
- **Date format in Last Activity:** "Nov 13th '25" — abbreviated month, ordinal day, 2-digit year
- **Tag naming convention:** snake_case with colon namespace seen: "do_not_te[xt]", "complianc[e...]", "neighborh[ood:...]"
- **Stage naming convention:** Title case phrase — "Real Est[ate...]"

### Relationships

- Person has many Tags (many-to-many)
- Person has one Stage (current pipeline stage)
- Person has many Activities/Timeline Events
- Smart List has many Filter Conditions
- Smart List belongs to a Collection group (e.g., "Neighborhoods")
- Person has one primary Source

---

## Rebuild Notes

### Component Breakdown

```tsx
<PeoplePage>
  <FUBTopNav activeItem="people" userAvatar={...} />

  <div className="people-layout">
    <SmartListsSidebar>
      <AllPeopleLink />
      <CollectionsSection collapsible>
        <SmartListItem name="Active & Pending Claims" icon="funnel" />
        <SmartListItem name="Hot/Weekly" icon="funnel" />
        {/* ... more items */}
        <SmartListItem name="Old Leads: No Call Attempt" icon="funnel" badge="7k" />
      </CollectionsSection>
      <NeighborhoodsSection collapsible>
        <SmartListItem name="Tetherow" badge="696" />
        <SmartListItem name="Sunriver" badge="436" />
        <SmartListItem name="Pronghorn" badge="13" active={true} />
        {/* ... more neighborhoods */}
        <SmartListItem name="Bend - Southern Crossing" badge="444" />
      </NeighborhoodsSection>
      <ManageLink />
    </SmartListsSidebar>

    <main>
      <PeopleListSubHeader
        listName="Pronghorn"
        selectionCount={10}
        totalCount={13}
        onDeselect={...}
        bulkActions={['email', 'text', 'assign', 'actionPlan', 'export']}
        columnFilter="Out Of State Home..."
        filterCount={4}
        onUpdateList={...}
      />

      <div className="people-content">
        <PeopleTable
          rows={contacts}
          selectedIds={selectedIds}
          onSelectRow={...}
          onSelectAll={...}
          columns={['name', 'score', 'lastActivity', 'phone', 'email', 'activityDetail']}
        >
          {contacts.map(contact => (
            <PeopleTableRow
              key={contact.id}
              checked={selectedIds.includes(contact.id)}
              avatar={<ContactAvatar name={contact.name} photo={contact.photoUrl} />}
              name={contact.name}
              sourceTag={contact.source}   // "Import" | "Expired Listing" | "Farm"
              score={contact.leadScore}
              lastActivityAt={contact.lastActivityAt}
              phone={contact.phone}
              email={contact.email}
              activityDetail={contact.lastActivityDetail}
              onCallClick={...}
              onTextClick={...}
              onEmailClick={...}
              onRowClick={() => navigate(`/people/${contact.id}`)}
            />
          ))}
        </PeopleTable>
        <TableScrollbar horizontal />
      </div>
    </main>

    <FilterPanel
      filters={[
        { field: 'tags', operator: 'exclude_any', values: ['do_not_text'] },
        { field: 'stage', operator: 'exclude_any', values: ['Real Estate Attorney'] },
        { field: 'tags', operator: 'exclude_any', values: ['compliance:hard-stop'] },
        { field: 'tags', operator: 'include_any', values: ['neighborhood:pronghorn'] },
      ]}
      onAddFilter={...}
      onRemoveFilter={...}
      onClearAll={...}
    />
  </div>

  {/* Modal overlay */}
  <ModalBackdrop>
    <ExportPeopleModal
      selectedCount={10}
      onCancel={closeModal}
      onConfirm={startExport}
      exportAllColumns={false}
      onToggleExportAllColumns={...}
    />
  </ModalBackdrop>

  <FloatingHelpButton />
</PeoplePage>
```

### ExportPeopleModal Implementation Notes

```tsx
<dialog className="export-modal" role="dialog" aria-modal="true">
  <header>
    <h2>Export Selected People</h2>
    <button aria-label="Close" onClick={onCancel}>×</button>
  </header>
  <div className="modal-body">
    <p>Would you like to export {selectedCount} people?</p>
    <label className="checkbox-row">
      <input type="checkbox" checked={exportAllColumns} onChange={onToggleExportAllColumns} />
      <span>Export all columns</span>
      <Tooltip content="Exports every available field...">
        <InfoIcon />
      </Tooltip>
    </label>
    <p className="help-text">
      You can continue using Follow Up Boss once your export starts. 
      When the export is complete it will automatically start downloading 
      and we will also send you an email.
    </p>
  </div>
  <footer>
    <Button variant="outline" onClick={onCancel}>Cancel</Button>
    <Button variant="primary" onClick={onConfirm}>Yes, export people</Button>
  </footer>
</dialog>
```

### Non-Obvious Logic

1. **Export flow is async:** FUB does NOT block the UI waiting for CSV generation. The server generates the file in the background, then both (a) auto-downloads in the browser when ready, and (b) emails the file link to the logged-in user. This is important for large exports.

2. **"Export all columns" vs default:** Default export likely includes ~10–15 standard columns (name, phone, email, stage, source, assigned agent, tags, last activity). "Export all columns" likely includes every custom field, all tags, all historical data fields — could be 50+ columns.

3. **Smart list count (13) vs visible rows (~11):** The badge says 13 but only ~10–11 rows are visible/selected. This may be because some rows are off-screen (scrolled below), or because some contacts in the list are filtered out by the 4 active filters in the filter panel.

4. **"Out Of State Home..." chip in sub-header vs "Filters (4)" panel:** The sub-header chip may represent a column-based filter (filtering the table view) separate from the smart list's defining filters shown in the right panel. The right panel filters define MEMBERSHIP in the smart list; the sub-header chip may filter the current VIEW of list members.

5. **Contact avatar color assignment:** [INFERRED] Colors are deterministically assigned from the contact's name hash — same contact always gets same color. Typically 6–8 brand colors in a palette.

6. **Source tag display:** The source shown below the contact name (Import, Expired Listing, Farm) is the `source` field on the Person record — likely an enum with ~20 possible values in FUB.

7. **All visible contacts share "Nov 13th '25" as Last Activity:** This suggests a bulk import or re-sync happened on that date — or these leads all had an inquiry activity triggered on the same day (possibly from a Zillow/realtor.com IDX inquiry batch).

8. **Phone numbers from varied area codes (Utah, Georgia, California, Oregon):** Confirms these are "Pronghorn" neighborhood leads — real estate inquiries about the Pronghorn resort community in Bend, OR from out-of-state buyers. Aligns with "Out Of State Home..." filter chip.

9. **Bulk selection state:** When 10+ contacts are selected, FUB shows a contextual toolbar replacing or augmenting the sub-header with bulk action buttons. The modal is triggered from one of those bulk actions (Export).

10. **"Deselect all" clears the export:** After export starts, the selection is cleared [INFERRED]. The modal close does NOT deselect.

11. **List URL structure:** `/2/people/list/100` — the `2` is a workspace/account ID segment; `100` is the smart list ID. This is a standard FUB URL pattern for saved lists.
