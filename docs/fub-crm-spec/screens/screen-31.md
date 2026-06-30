<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.26.42 AM.png | Sequential id: shot-31 | Tiles: fub-tiles/shot-31_{full,q1,q2,q3,q4}.png -->

# shot-31 — Deals / Pipeline — Sellers Kanban Board

## Identity

- **Visible URL:** `https://ryan-realty.followupboss.com/2/deals/2`
  - The `/2/` segment is the FUB account/team ID
  - The trailing `/2` is the pipeline ID (Pipeline #2 = Sellers)
- **Browser tab title:** "Deal Tracking"
- **Top-nav active item:** "Deals" (bold, underlined with a short blue bar directly beneath the label)
- **Sub-tab active:** "Sellers" (blue underline beneath it; "Buyers" is the sibling tab, inactive)
- **Breadcrumbs:** None displayed; the nav hierarchy is simply top-nav → Deals → Sellers sub-tab
- **Logged-in user:** Visible as a circular profile-photo avatar in the top-right corner of the nav bar (appears to be a dark-skinned male, matches Matt Ryan's broker headshot profile from the CRM). A small dropdown chevron may be adjacent [INFERRED].
- **Account / brokerage name:** "Ryan Realty" (visible in the Chrome bookmarks bar as a bookmark labeled "Ryan Realty"; no in-app brokerage name is displayed on this screen)

---

## Layout

### Top-to-bottom regions:

1. **Browser chrome** — macOS window controls (red/yellow/green traffic lights), tab strip ("Deal Tracking" tab + "+" new tab), omnibar with URL, and extension icons. Not part of FUB UI.

2. **FUB Global Top Nav Bar** (~48 px tall, dark charcoal/near-black background `#2d3748` or similar dark slate)
   - Full-width, fixed position
   - Left: FUB logo (stacked horizontal-lines icon, ~28 px, white)
   - Center-left: nav items (People, Inbox, Tasks, Calendar, Deals, Reporting, Admin) — equally spaced, white text, icon + label pairs
   - Center-right: Search input (pill-shaped, white fill, "Search" gray placeholder, magnifying-glass icon on left)
   - Far right: Agent avatar bubbles (4–5 colored circular avatars ~28 px) + notification/bell icon + current-user avatar with dropdown

3. **Sub-header / Pipeline Toolbar** (~40 px tall, white background)
   - Left side: pipeline type tabs — "Buyers" | "Sellers" | gear/settings icon (⚙)
   - Right side (pushed to the right edge): "How Deals work" (circle-question icon + text, outlined/ghost button), "Deal Reporting" (bar-chart icon + text, outlined button), "Current deals" dropdown button (with chevron), "Everyone" dropdown button (with chevron)

4. **Kanban Board Canvas** — the remainder of the viewport below the toolbar, horizontally scrollable
   - Contains 7 pipeline stage columns arranged side by side
   - Columns are equal width (~220–240 px each in the viewport, potentially more columns off-screen to the right)
   - Each column is vertically scrollable independently if its card count overflows
   - Background: very light gray `#f5f6f7` or similar
   - Column separators: subtle vertical lines or just column card boundaries

5. **Bottom of viewport** — horizontal scrollbar (visible because columns extend off-screen to the right); no footer bar visible; a floating help button (circle with "?") in the bottom-right corner

---

## Every UI Element (Exhaustive)

### Global Top Nav Bar

| Element | Type | Value / State |
|---|---|---|
| FUB logo | Icon (stacked horizontal bars / hamburger-ish, white) | Links to dashboard [INFERRED] |
| People | Nav link (icon: person silhouette + label) | Inactive |
| Inbox | Nav link (icon: tray/inbox + label) | Inactive; has a small **orange dot** badge (unread notification indicator) |
| Tasks | Nav link (icon: checkbox/checklist + label) | Inactive |
| Calendar | Nav link (icon: calendar grid + label) | Inactive |
| Deals | Nav link (icon: dollar sign or briefcase + label) | **ACTIVE** — bold, short blue underline appears beneath the label |
| Reporting | Nav link (icon: bar chart + label) | Inactive |
| Admin | Nav link (icon: wrench/gear + label) | Inactive |
| Search | Text input, pill shape, white bg | Placeholder text: "Search"; magnifying glass icon on left; no current value |
| Agent avatar cluster (right side) | 4–5 stacked/overlapping circular avatar badges | These represent the team members / agents; clicking likely filters the board by that agent [INFERRED]. Colors visible: teal, salmon/peach, blue-gray, green. At least one is a photo avatar (Matt Ryan). |
| Bell / notifications | Icon button | Bell glyph; no badge count visible |
| User avatar (far right) | Circular photo avatar, ~30 px | Photo of logged-in user; dropdown arrow implied [INFERRED]; clicking opens profile/settings menu |

### Sub-header / Pipeline Toolbar

| Element | Type | Value / State |
|---|---|---|
| "Buyers" tab | Tab button | Inactive (no underline, gray text) |
| "Sellers" tab | Tab button | **ACTIVE** — blue underline beneath text; slightly darker/black text |
| Gear icon (⚙) | Icon button, right of tabs | Opens pipeline settings (rename stages, add stages, configure pipeline) [INFERRED] |
| "How Deals work" | Ghost/outlined button | Circle question-mark icon + label "How Deals work"; opens a help modal or side panel explaining the Deals feature [INFERRED] |
| "Deal Reporting" | Ghost/outlined button | Bar-chart icon + label "Deal Reporting"; navigates to deals reporting/analytics sub-page [INFERRED] |
| "Current deals" | Dropdown button with chevron | Default filter showing only active/current deals vs all-time; options likely: "Current deals", "All deals", "Archived deals" [INFERRED] |
| "Everyone" | Dropdown button with chevron | Agent/user filter; "Everyone" = show all agents' deals; clicking opens list of individual agents to filter by [INFERRED] |

### Kanban Board Columns — Overview

Seven columns are visible (one partially cut off on the right). Each column follows the same anatomy:

**Column anatomy:**
- Top colored accent bar (4–6 px tall, spans full column width, unique color per stage)
- Column header: stage name (bold, ~14 px, dark text) + deal count + total dollar value
- Blue "+" circle button (right side of header, ~24 px, solid blue fill, white "+" glyph) — adds a new deal directly to this stage [INFERRED]
- Card area: white/light background, vertically scrollable; contains deal cards or empty state
- Empty state text: "No deals, add deal" — "add deal" is a blue hyperlink

**Column details:**

#### Column 1 — Start (temp stage)
- **Top accent color:** Gold / amber (~`#f5a623` or similar warm orange-gold)
- **Header:** "Start (temp stage)"
- **Subtitle:** "0 deals  $0"
- **"+" button:** Present (blue circle)
- **Body:** Empty state — "No deals, add deal" (gray text; "add deal" is blue link)

#### Column 2 — Pre-Listing
- **Top accent color:** Medium blue / indigo (~`#5c6bc0` or blue-purple)
- **Header:** "Pre-Listing"
- **Subtitle:** "0 deals  $0"
- **"+" button:** Present (blue circle)
- **Body:** Empty state — "No deals, add deal"

#### Column 3 — Listed
- **Top accent color:** Salmon / coral orange (~`#ef8c6c` or warm orange)
- **Header:** "Listed"
- **Subtitle:** "1 deal  $2,635,000"
- **"+" button:** Present (blue circle)
- **Body:** 1 deal card (see Deal Cards section below)

#### Column 4 — Offer
- **Top accent color:** Purple / lavender (~`#9c6bc0` or medium purple)
- **Header:** "Offer"
- **Subtitle:** "0 deals  $0"
- **"+" button:** Present (blue circle)
- **Body:** Empty state — "No deals, add deal"

#### Column 5 — Pending
- **Top accent color:** Teal / green-blue (~`#26a69a` or muted teal)
- **Header:** "Pending"
- **Subtitle:** "0 deals  $0"
- **"+" button:** Present (blue circle)
- **Body:** Empty state — "No deals, add deal"

#### Column 6 — Closed
- **Top accent color:** Green (~`#66bb6a` or medium green)
- **Header:** "Closed"
- **Subtitle:** "9 deals  $7,934,000  Closed" — note: the word "Closed" appears as a small green pill/badge label appended after the dollar total
- **"+" button:** Present (blue circle)
- **Body:** 9 deal cards (scrollable; 5 are visible in the viewport)
- **Scroll indicator:** Vertical scrollbar on the right edge of this column (thin, gray); this is the only column with visible overflow/scroll

#### Column 7 — Lost / Terminated (partially visible, right edge cut off)
- **Top accent color:** Red / coral (~`#ef5350` or muted red)
- **Header:** "Lost / Terminated" (right portion clipped by viewport edge)
- **Subtitle:** "1 deal  $899,900"
- **"+" button:** Present (blue circle)
- **Body:** 1 deal card (partially visible, right side clipped)

---

### Deal Cards — Full Detail

Each deal card is a white rounded-rectangle card (~200 px wide, variable height) with subtle shadow/border.

**Card anatomy (top to bottom):**
1. **Address** — property street address (bold, dark text, ~14 px)
2. **Price row** — green dollar amount (sale price) + house/building icon + gray dollar amount (commission or GCI)
3. **Close Date row** (only visible on "Closed" deals) — gray text "Close Date: [Month Day Year]"
4. **Avatar row** — a horizontal cluster of circular avatars (~22–26 px) representing the people associated with the deal (buyer/seller contacts + agent). Mix of initials-only badges and actual photo avatars.

**All deal cards transcribed:**

---

**Listed column — Card 1:**
- Address: `56628 Sunstone Loop`
- Price: `$2,635,000` (green) + 🏠 icon + `$10,000` (gray)
- No close date (not yet closed)
- Avatars: `SR` (salmon initials badge) + `SR` (same initials, second person with same initials, also salmon) + photo avatar (dark-skinned male, likely the agent Matt Ryan)

---

**Closed column — Card 1:**
- Address: `20401 Penhollow`
- Price: `$639,000` (green) + 🏠 icon + `$14,378` (gray)
- Close Date: `July 30th 2025`
- Avatars: `TN` (teal/green initials badge) + `GN` (green initials badge) + photo avatar (male, agent)

**Closed column — Card 2:**
- Address: `1050 NE Butler Market #2`
- Price: `$299,000` (green) + 🏠 icon + `$1,000` (gray)
- Close Date: `June 13th 2025`
- Avatars: `TC` (rose/pink initials badge) + photo avatar (male, agent)

**Closed column — Card 3:**
- Address: `54474 Huntington Rd`
- Price: `$580,000` (green) + 🏠 icon + `$10,200` (gray)
- Close Date: `January 8th 2025`
- Avatars: `EF` (olive/sage green initials badge) + `HF` (beige/tan initials badge) + photo avatar (male, agent, appears to be same broker headshot as others)

**Closed column — Card 4:**
- Address: `534 Crowson Rd`
- Price: `$1,050,000` (green) + 🏠 icon + `$10,500` (gray)
- Close Date: `April 30th 2025`
- Avatars: `MH` (slate/blue-gray initials badge) + photo avatar (green-tinted/landscaped, likely a contact photo) + photo avatar (male, agent/broker)

**Closed column — Card 5:**
- Address: `17130 Mayfield Dr`
- Price: `$769,000` (green) + 🏠 icon + `$15,100` (gray)
- Close Date: `October 29th 2025`
- Avatars: 3 photo avatars (male/gray-bearded, female, male/younger-looking — mix of client and agent)

**Lost / Terminated column — Card 1 (partially visible):**
- Address: `363 Sw Bluff Dr #208`
- Price: `$899,900` (green) + 🏠 icon + `$22,4...` (truncated — likely $22,450 or similar)
- Avatars: 2 photo avatars (both male)

---

### Empty State Component

- Text: `No deals, add deal`
- "No deals," in muted gray (~`#9e9e9e`)
- "add deal" in blue (~`#1976d2`), styled as a hyperlink; clicking opens the new deal creation flow [INFERRED]

### Bottom Floating Button

- **Location:** Bottom-right corner of the viewport
- **Appearance:** Circle, white fill, blue border/shadow, "?" glyph (question mark)
- **Function:** Opens the FUB help center or in-app help widget [INFERRED]

### Horizontal Scrollbar

- **Location:** Very bottom of the main content area, full width
- **Appearance:** Thin gray scrollbar track; scroll thumb visible roughly centered-left, indicating the board is scrolled partway right (the "Closed" and "Lost/Terminated" columns are visible, meaning the user scrolled right from the default start)
- **URL tooltip at bottom-left:** `https://ryan-realty.followupboss.com/2/deals/2` (shown in browser status bar on link hover)

---

## Colors, Typography & Style

### Colors

| Element | Color | Approximate Hex |
|---|---|---|
| Top nav background | Dark charcoal/slate | `#2d3748` or `#1a202c` |
| Top nav text (inactive) | Light gray/white | `#e2e8f0` or `#cbd5e0` |
| Top nav text (active — Deals) | White | `#ffffff` |
| Active nav underline | Bright blue | `#3182ce` or `#2196f3` |
| Sub-header background | White | `#ffffff` |
| Sub-header text | Dark gray | `#2d3748` |
| Active tab underline (Sellers) | Blue | `#3182ce` |
| Board canvas background | Very light gray | `#f5f6f7` or `#f0f2f5` |
| Column card background | White | `#ffffff` |
| Column shadow | Subtle gray | `rgba(0,0,0,0.08)` |
| Stage accent — Start (temp) | Gold / amber | `#f5a623` or `#ffa726` |
| Stage accent — Pre-Listing | Blue-purple / indigo | `#5c6bc0` or `#7986cb` |
| Stage accent — Listed | Salmon / coral | `#ef8c6c` or `#ff7043` |
| Stage accent — Offer | Purple / lavender | `#9c6bc0` or `#ab47bc` |
| Stage accent — Pending | Teal / green-blue | `#26a69a` or `#26c6da` |
| Stage accent — Closed | Green | `#66bb6a` or `#43a047` |
| Stage accent — Lost/Terminated | Red / coral-red | `#ef5350` or `#e53935` |
| Deal address text | Dark | `#212121` or `#2d3748` |
| Deal price (sale) | Green | `#43a047` or `#388e3c` |
| Deal commission text | Gray | `#757575` or `#9e9e9e` |
| Deal close date text | Gray | `#9e9e9e` |
| Empty state text | Gray | `#9e9e9e` |
| "add deal" link | Blue | `#1976d2` or `#2196f3` |
| "+" add deal button | Solid blue | `#1976d2` or `#2196f3` |
| Closed badge label | Green | ~`#43a047` |
| Initials badge — SR | Salmon / peach-pink | `#ef9a9a` or `#f48fb1` |
| Initials badge — TN | Teal-green | `#4db6ac` |
| Initials badge — GN | Light green | `#a5d6a7` |
| Initials badge — TC | Rose / mauve | `#f48fb1` or `#ce93d8` |
| Initials badge — EF | Olive / sage | `#a5c4a0` or `#81c784` |
| Initials badge — HF | Beige / tan | `#d7ccc8` or `#bcaaa4` |
| Initials badge — MH | Slate / blue-gray | `#90a4ae` |

### Typography

- **Font family:** System sans-serif / Inter / similar clean sans. FUB uses a geometric sans across the product.
- **Column header (stage name):** ~14 px, font-weight 600–700, dark (`#212121`)
- **Column subtitle (deal count + total):** ~12–13 px, font-weight 400, gray
- **Deal address:** ~13–14 px, font-weight 600, dark
- **Deal price (green):** ~13 px, font-weight 600, green
- **Deal commission:** ~12–13 px, font-weight 400, gray
- **Deal close date:** ~11–12 px, font-weight 400, muted gray
- **Nav items:** ~13 px, font-weight 500
- **Sub-header tabs:** ~13–14 px, font-weight 600 (active) / 400 (inactive)

### Style Details

- **Column card border radius:** ~8 px rounded corners on deal cards
- **Deal card border:** subtle 1 px border `rgba(0,0,0,0.08)` or light gray
- **Density:** Medium — cards have ~12–16 px internal padding
- **Iconography style:** Flat/outlined icons; the commission field uses a house/building glyph (~14 px, gray) before the dollar amount
- **Avatar style:** Circle crop, 22–28 px diameter; initials avatars use 2 uppercase letters in white over a colored background; photo avatars use circular crop with no border
- **"+" button style:** Solid blue filled circle, white "+" glyph, ~22–24 px diameter; no label
- **Button style (toolbar):** Ghost/outlined buttons with icon + text; subtle border, rounded (~4–6 px radius), gray border color
- **Dropdown buttons:** Outlined, light gray border, dark text, chevron "▾" on right
- **No "Getting Started" green progress bar** visible in this screenshot (not present on the Deals screen)

---

## State & Data Shown

### Current View State

- **Pipeline:** Sellers (pipeline ID 2 in the URL `/deals/2`)
- **Filter:** "Current deals" (dropdown shows this label; not "All" or "Archived")
- **Agent filter:** "Everyone" (no agent filter applied; all team members' deals visible)
- **Time/date filter:** None visible (showing all current deals regardless of date)

### Pipeline Summary Stats (from column headers)

| Stage | Deal Count | Total Value |
|---|---|---|
| Start (temp stage) | 0 | $0 |
| Pre-Listing | 0 | $0 |
| Listed | 1 | $2,635,000 |
| Offer | 0 | $0 |
| Pending | 0 | $0 |
| Closed | 9 | $7,934,000 |
| Lost / Terminated | 1 | $899,900 |

**Grand total visible:** 11 deals, ~$11,469,900 across the pipeline

### Sample Real Data Values

**Deal records:**
- `56628 Sunstone Loop` | Sale: $2,635,000 | Commission: $10,000 | Stage: Listed
- `20401 Penhollow` | Sale: $639,000 | Commission: $14,378 | Stage: Closed | Close Date: July 30th 2025
- `1050 NE Butler Market #2` | Sale: $299,000 | Commission: $1,000 | Stage: Closed | Close Date: June 13th 2025
- `54474 Huntington Rd` | Sale: $580,000 | Commission: $10,200 | Stage: Closed | Close Date: January 8th 2025
- `534 Crowson Rd` | Sale: $1,050,000 | Commission: $10,500 | Stage: Closed | Close Date: April 30th 2025
- `17130 Mayfield Dr` | Sale: $769,000 | Commission: $15,100 | Stage: Closed | Close Date: October 29th 2025
- `363 Sw Bluff Dr #208` | Sale: $899,900 | Commission: ~$22,4xx (truncated) | Stage: Lost / Terminated

**People initials visible (contact initials avatars):** SR, SR, TN, GN, TC, EF, HF, MH

**Dates format:** "Month Dth YYYY" e.g., "July 30th 2025", "January 8th 2025" (uses ordinal suffix for day)

### Active Filters/Selections

- No individual deal cards appear selected
- No bulk-action bar visible
- No filter chips displayed below the toolbar
- Inbox badge (orange dot) on the Inbox nav item indicates unread items exist

---

## Interactions & Behaviors

### Clicking a Deal Card
- [INFERRED] Navigates to the deal detail page (e.g., `/deals/2/{dealId}`) which shows the full deal record: all contacts, timeline, documents, notes, financials, tasks, and stage history.

### Clicking the "+" Button on a Column
- [INFERRED] Opens a "New Deal" creation modal or inline form, pre-populated with the stage matching the column where "+" was clicked. Required fields likely include: property address, sale price, closing date (optional), and associated contacts.

### Clicking "add deal" (empty state link)
- [INFERRED] Same as clicking the "+" button — opens new deal creation flow.

### Dragging a Deal Card
- [INFERRED] Cards are drag-and-drop between columns (Kanban standard behavior). Dropping a card in a new column updates the deal's stage. The stage accent color border on the card header may update to reflect the new stage's color.

### Clicking "Buyers" Tab
- Switches the board to show Pipeline #1 (Buyers pipeline) with its own set of stages (likely: New Lead → Connected → Active Buyer → Under Contract → Closed, etc.) [INFERRED]. URL would change to `/deals/1` [INFERRED].

### Clicking "Sellers" Tab (currently active)
- Already active — no change.

### Clicking the Gear Icon (⚙) next to tabs
- [INFERRED] Opens pipeline configuration: rename stages, change stage colors, reorder stages, add/remove stages, configure pipeline-level settings.

### Clicking "How Deals work"
- [INFERRED] Opens a help overlay, tooltip, or modal with a brief explainer of the Deals / pipeline feature — oriented toward first-time users.

### Clicking "Deal Reporting"
- [INFERRED] Navigates to a Deals-specific reporting sub-page showing charts, deal volume trends, GCI metrics, close rates, average days in stage, etc.

### Clicking "Current deals" Dropdown
- [INFERRED] Shows filter options: "Current deals" (active/in-progress), "All deals" (including closed/lost), "Archived deals". Selecting a different option reloads the board with the filtered set.

### Clicking "Everyone" Dropdown
- [INFERRED] Shows list of individual agents/team members. Selecting one agent filters the board to show only that agent's deals. "Everyone" is the default (all agents). Agent names in the list correspond to the avatar bubbles in the top-right.

### Clicking Agent Avatar Bubbles (top-right of nav)
- [INFERRED] Clicking an individual agent's avatar in the cluster filters the board to that agent only. Clicking the same avatar again deselects / returns to "Everyone". The avatars are a quick visual filter toggle.

### Clicking a Contact Avatar on a Deal Card
- [INFERRED] Opens that contact's person record in a drawer or navigates to `/people/{personId}`.

### Horizontal Scroll on the Board
- The board canvas scrolls left-right to reveal additional columns or columns scrolled off screen. A horizontal scrollbar is present at the bottom.

### Column Vertical Scroll
- The "Closed" column has more cards than can fit in the viewport — a vertical scrollbar appears on the right edge of that specific column. Other columns are not scrollable (short or empty).

### Clicking "?" Floating Button (bottom-right)
- [INFERRED] Opens the FUB help widget (Intercom or similar), providing access to chat support, knowledge base articles, and feature tutorials.

### Inbox Badge (orange dot on Inbox nav item)
- Indicates there is at least one unread message or notification in the Inbox section. Clicking navigates to `/inbox`.

---

## Data Model Signals

### Entities Revealed

**Pipeline entity:**
- `id` (integer, in URL: `/deals/2`)
- `name` (string: "Buyers" | "Sellers")
- `type` (enum: buyer | seller)
- Multiple pipelines can coexist; URL-based navigation

**Stage entity:**
- `id`
- `pipeline_id` (FK → pipeline)
- `name` (string: "Start (temp stage)", "Pre-Listing", "Listed", "Offer", "Pending", "Closed", "Lost / Terminated")
- `color` (hex or enum — unique per stage, shown as top accent bar)
- `position` (integer for column order)
- `is_closed` (boolean — "Closed" column has special "Closed" badge label)
- `is_lost` (boolean — "Lost / Terminated" stage behavior)

**Deal entity:**
- `id`
- `pipeline_id` (FK → pipeline)
- `stage_id` (FK → stage)
- `address` (string — property street address, includes unit # for condos: "363 Sw Bluff Dr #208")
- `sale_price` (currency — e.g., $2,635,000; displayed in green)
- `commission` / `gci` (currency — e.g., $10,000; displayed in gray next to house icon)
- `close_date` (date — shown as "Month Dth YYYY" e.g., "July 30th 2025"; only present when stage = Closed)
- `people` (array of FK → person — multiple contacts associated; rendered as avatar cluster)
- `agent` (FK → user/agent — the assigned broker; also rendered as avatar, typically a photo avatar)
- `status` (enum: current | closed | lost | archived — controls filter behavior)

**Person entity (contact):**
- `id`
- `first_name` / `last_name` (initials derived: "SR" = first[0] + last[0])
- `avatar_url` (optional photo; some contacts have photos, others show initials)

**User entity (agent/broker):**
- `id`
- `name`
- `avatar_url` (photo; agents always appear to have photo avatars on cards)

### Enum Values Confirmed

**Pipeline stages (Sellers pipeline):**
`Start (temp stage)` | `Pre-Listing` | `Listed` | `Offer` | `Pending` | `Closed` | `Lost / Terminated`

**Deal filter options [INFERRED]:**
`Current deals` | `All deals` | `Archived deals`

**Agent filter [INFERRED]:**
`Everyone` | `{Agent Name}` (one per team member)

### Relationships

- Pipeline → has many → Stages (ordered)
- Stage → has many → Deals
- Deal → belongs to → Pipeline, Stage
- Deal → has many → People (contacts: buyers/sellers)
- Deal → belongs to → Agent/User (the representing broker)
- Deal card shows: [Contacts initials/photo] + [Agent photo] together in avatar cluster

### Data Format Signals

- **Currency:** No cents for sale prices at this scale (whole numbers: $2,635,000); commission values do show decimals ($14,378, $10,200) — stored as integer cents [INFERRED]
- **Dates:** Stored as ISO date; displayed as "Month Dth YYYY" with ordinal day suffix (human-friendly display format, not machine)
- **Address format:** Street number + name + optional unit/apt (e.g., "#208", "#2") — standard US address, no city/state shown on card (assumed single-market CRM)
- **Initials:** 2-letter uppercase initials from contact name; unique color assigned per contact (color appears consistent — not random per-session)
- **Commission icon:** A small house/building glyph (🏠-like, gray) used to label the commission/GCI field — this is a custom FUB UI icon, not an emoji

---

## Rebuild Notes

### Component Breakdown

```
<DealsPage>
  ├── <GlobalTopNav activeItem="deals" />
  │     ├── <FUBLogo />
  │     ├── <NavItem icon="people" label="People" />
  │     ├── <NavItem icon="inbox" label="Inbox" badge={unreadCount > 0} badgeColor="orange" />
  │     ├── <NavItem icon="tasks" label="Tasks" />
  │     ├── <NavItem icon="calendar" label="Calendar" />
  │     ├── <NavItem icon="deals" label="Deals" active />
  │     ├── <NavItem icon="reporting" label="Reporting" />
  │     ├── <NavItem icon="admin" label="Admin" />
  │     ├── <SearchInput placeholder="Search" />
  │     └── <NavRightCluster>
  │           ├── <AgentAvatarFilter agents={[...]} onSelect={filterByAgent} />
  │           ├── <NotificationBell />
  │           └── <UserAvatarDropdown user={currentUser} />
  │
  ├── <DealsPipelineToolbar>
  │     ├── <PipelineTabs>
  │     │     ├── <PipelineTab label="Buyers" pipelineId={1} active={false} />
  │     │     ├── <PipelineTab label="Sellers" pipelineId={2} active={true} />
  │     │     └── <PipelineSettingsButton icon="gear" />
  │     └── <DealsBoardControls>
  │           ├── <HowDealsWorkButton />
  │           ├── <DealReportingButton />
  │           ├── <DealStatusFilterDropdown value="Current deals" />
  │           └── <AgentFilterDropdown value="Everyone" />
  │
  └── <KanbanBoard pipeline={sellersPipeline} horizontalScroll>
        ├── <KanbanColumn stage={startStage} accentColor="#ffa726">
        │     ├── <ColumnHeader name="Start (temp stage)" dealCount={0} total={0} onAddDeal />
        │     └── <EmptyState onAddDeal />
        ├── <KanbanColumn stage={preListingStage} accentColor="#7986cb">
        │     ├── <ColumnHeader name="Pre-Listing" dealCount={0} total={0} onAddDeal />
        │     └── <EmptyState onAddDeal />
        ├── <KanbanColumn stage={listedStage} accentColor="#ff7043">
        │     ├── <ColumnHeader name="Listed" dealCount={1} total={2635000} onAddDeal />
        │     └── <DealCard deal={sungstoneDeal} onClick={openDeal} />
        ├── <KanbanColumn stage={offerStage} accentColor="#ab47bc">
        │     ├── <ColumnHeader name="Offer" dealCount={0} total={0} onAddDeal />
        │     └── <EmptyState onAddDeal />
        ├── <KanbanColumn stage={pendingStage} accentColor="#26c6da">
        │     ├── <ColumnHeader name="Pending" dealCount={0} total={0} onAddDeal />
        │     └── <EmptyState onAddDeal />
        ├── <KanbanColumn stage={closedStage} accentColor="#43a047" scrollable>
        │     ├── <ColumnHeader name="Closed" dealCount={9} total={7934000} badge="Closed" onAddDeal />
        │     ├── <DealCard deal={penhollow} />
        │     ├── <DealCard deal={butlerMarket} />
        │     ├── <DealCard deal={huntingtonRd} />
        │     ├── <DealCard deal={crowsonRd} />
        │     └── <DealCard deal={mayfieldDr} />
        │     // + 4 more cards below the fold
        └── <KanbanColumn stage={lostStage} accentColor="#e53935">
              ├── <ColumnHeader name="Lost / Terminated" dealCount={1} total={899900} onAddDeal />
              └── <DealCard deal={bluffDr} />
```

### `<DealCard>` Sub-components

```
<DealCard deal={deal} onClick={openDealDetail}>
  <DealCardAddress>{deal.address}</DealCardAddress>
  <DealCardFinancials>
    <SalePrice>${formatCurrency(deal.salePrice)}</SalePrice>
    <CommissionIcon />  {/* house glyph */}
    <CommissionAmount>${formatCurrency(deal.commission)}</CommissionAmount>
  </DealCardFinancials>
  {deal.closeDate && (
    <DealCloseDate>Close Date: {formatOrdinalDate(deal.closeDate)}</DealCloseDate>
  )}
  <DealAvatarCluster>
    {deal.contacts.map(contact =>
      contact.avatarUrl
        ? <PhotoAvatar src={contact.avatarUrl} size={24} />
        : <InitialsAvatar initials={getInitials(contact)} color={getContactColor(contact.id)} size={24} />
    )}
    <PhotoAvatar src={deal.agent.avatarUrl} size={24} />  {/* agent always last */}
  </DealAvatarCluster>
</DealCard>
```

### `<ColumnHeader>` Sub-components

```
<ColumnHeader>
  <AccentBar color={stage.color} />  {/* 4-6px top colored bar */}
  <HeaderRow>
    <StageName>{stage.name}</StageName>
    <AddDealButton onClick={onAddDeal}>+</AddDealButton>
  </HeaderRow>
  <StageStats>
    <DealCount>{dealCount} {dealCount === 1 ? 'deal' : 'deals'}</DealCount>
    <TotalValue>${formatCurrency(total)}</TotalValue>
    {stage.isClosed && <ClosedBadge>Closed</ClosedBadge>}
  </StageStats>
</ColumnHeader>
```

### Non-Obvious Logic

1. **Pipeline ID in URL:** Each pipeline (Buyers, Sellers) has a numeric ID. The URL `/deals/2` identifies pipeline 2 (Sellers). Switching tabs changes the pipeline ID in the URL, enabling direct linking to a specific pipeline view.

2. **"Start (temp stage)" label:** The word "(temp stage)" in parentheses indicates this is a placeholder or default stage that was auto-created by the system, likely when the pipeline was set up. Users are expected to rename or delete it. The gold accent color may be a default assigned to the first user-created or auto-created stage.

3. **Closed stage badge:** The "Closed" badge label appended after the total dollar amount in the Closed column header is a visual indicator that this is the terminal/success stage. It's styled as a small colored text label, not a separate UI pill — it appears inline after `$7,934,000 Closed` in teal/green text, same color as the top accent bar.

4. **Commission value vs sale price visual hierarchy:** The sale price is displayed in green (prominent, primary) while the commission/GCI is displayed in gray with a house icon prefix (secondary). This reinforces the sale price as the headline metric and commission as contextual.

5. **Contact color assignment:** Initials avatars use consistent colors — the same contact always gets the same color across all cards and pages. The color is likely derived deterministically from the contact's ID or name hash (not random per session).

6. **Multiple "SR" avatars:** On the 56628 Sunstone Loop card, two contacts share the initials "SR" (same first and last initial). Both appear with the same salmon color. This is a UX edge case — FUB does not differentiate same-initials contacts by color alone; the user must distinguish by position or by clicking to see the name.

7. **Agent avatar always last in the cluster:** Across all visible cards, the agent/broker (a photo avatar) appears as the last avatar in the cluster. Contacts (initials or photo) appear first, agent last. This is a consistent ordering convention.

8. **Board horizontal scroll with column-level vertical scroll:** The board is a 2D scroll space. The entire board scrolls horizontally (the board canvas) to reveal more columns. Individual columns (only Closed in this view) scroll vertically to reveal more cards. These are two independent scroll contexts.

9. **"Current deals" filter exclusion of Closed/Lost:** When the "Current deals" filter is active, the Closed and Lost columns still appear but show only deals from the current period (or perhaps only the pipeline-active deals). The filter likely controls the time window or "archived" status, not column visibility.

10. **The "Everyone" agent filter + avatar cluster are dual controls:** Both the "Everyone" dropdown in the toolbar and the agent avatar bubbles in the top-right nav appear to control the same agent filter. They may be synchronized UI controls for the same underlying filter state.

11. **Date formatting function:** Dates display as ordinal English: "July 30th 2025", "January 8th 2025", "June 13th 2025", etc. The format is `{MonthName} {D}{ordinalSuffix} {YYYY}` — no comma between day and year (different from standard US format "July 30, 2025"). This requires a custom date formatter.

12. **Drag and drop implementation:** Kanban columns support drag-and-drop card reordering [INFERRED]. Moving a card to "Closed" likely triggers a modal asking for the close date and final sale price. Moving to "Lost / Terminated" may trigger a reason/lost reason dialog [INFERRED].
