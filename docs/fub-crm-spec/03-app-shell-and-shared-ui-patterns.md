# 03 — Global UI Shell & Shared Interaction Patterns

**Spec version:** 1.0 · **Date:** 2026-06-30  
**Supersedes:** Prior spec §4 (Global UI shell & shared patterns) — that section had thin behavioral coverage, OCR gaps marked [illegible], and no GIF-derived dynamic behaviors. This document replaces it entirely.  
**Scope:** Every pattern, component, and region that appears across more than one FUB module. Build each item once as a shared component; do not re-implement per-module. In-house implementation uses Ryan Realty design tokens, not FUB's blue/teal palette.  
**Acceptance criteria:** A developer who has never opened FUB can build every element in this section from this document alone, with zero questions about layout, interaction, or state.

---

## 4.1 App Shell Regions

The FUB app shell is a standard web SPA shell with five regions. Every route shows the same top nav and sub-nav; left sidebar and right rail appear only in specific modules.

```
┌──────────────────────────────────────────────────────────────┐
│  TOP NAVIGATION BAR  (~48px, fixed, full viewport width)     │
├──────────────────────────────────────────────────────────────┤
│  MODULE SUB-NAV  (~44px, contextual — varies per module)     │
├──────────────┬───────────────────────────────┬───────────────┤
│              │                               │               │
│  LEFT        │   MAIN CONTENT                │  RIGHT RAIL   │
│  SIDEBAR     │   (flex-fill, scrollable)     │  (Person      │
│  (~215px     │                               │   detail +    │
│   People,    │                               │   Inbox only) │
│   ~160px     │                               │               │
│   Inbox;     │                               │               │
│   absent     │                               │               │
│   elsewhere) │                               │               │
└──────────────┴───────────────────────────────┴───────────────┘
                                     [? floating help button — bottom-right]
```

**Modules with left sidebar:** People, Inbox only.  
**Modules without left sidebar:** Tasks, Calendar, Deals, Reporting, Admin. Content fills the full width below the sub-nav.  
**Right rail:** Present only on Person detail view and Inbox reading pane.

---

## 4.2 Top Navigation Bar

**Container:** Fixed, full viewport width, ~48px tall. Background color: dark charcoal (approx `#2b333e`). White text and icons. Always visible; never hidden during loading.

### Element order (left to right)

| Position | Element | Notes |
|---|---|---|
| Far left | Hamburger/grid icon (3×2 dot grid) | Navigates to the Getting Started / Home onboarding page (§4.12). Not a sidebar toggle. |
| Left group | 7 module nav items | People · Inbox · Tasks · Calendar · Deals · Reporting · Admin. Each has a small icon above and label below. |
| Center | Global search pill | Width ~280px. Placeholder: "Search by name, email, phone, or address". Full-text people search; results appear inline as a dropdown. |
| Right cluster (L→R) | Email compose icon | Open a new email compose modal |
| | Add-person `+` icon | Open Add Person modal |
| | Notification bell | Red badge with unread count |
| | User avatar circle | Photo or initials; opens account menu |

**Active module state:** The active nav item displays with bolder weight plus a small blue filled triangle/caret pointing upward positioned directly below the label text. This is distinct from the sub-nav active indicator (which is an underline). The Inbox chat-bubble icon additionally receives a teal background highlight when Inbox is the active module (feat1 f05–f06).

**In-house mapping:** Top nav bar = `<nav className="bg-primary text-primary-foreground">`. Each module item = `<Button variant="ghost">`. Active triangle = a 6px navy-on-cream caret rendered below the active item. Avatar = `<Avatar>` from `@/components/ui/avatar`.

---

## 4.3 Module Sub-Nav

**Container:** Horizontal tab strip, ~44px tall, white/light background, sits immediately below the top nav bar. Each tab is text-only (no icons). Active tab: blue bottom-border underline + slightly bolder text weight. Inactive tabs: plain gray text. The sub-nav scrolls horizontally on narrow viewports.

**Content per module:**

### People
No dedicated sub-nav strip. The left sidebar (§4.4) IS the navigation surface for People. Sub-nav slot is empty or absent.

### Inbox
The left sidebar (§4.5) is the primary nav. The sub-nav slot is occupied by the "All / Unread" segment control and thread-type filter, which render in the thread-list header rather than a top strip.

### Tasks
```
Today's Tasks  |  Overdue  |  Future
```
Counts appear as `(...)` loading placeholder while data is fetched, then resolve to actual integers (feat1 GIF, Tasks section). Clicking a tab shows the matching task set in the main content area.

### Calendar
```
Today  |  Day  |  Week  |  Month  |  Everyone ▾
```
"Today" is a button (navigates calendar to current date). Day/Week/Month are view-mode tabs. "Everyone ▾" is a dropdown to filter by agent.

### Deals
```
Buyers  |  Sellers  |  ⚙
```
Buyers / Sellers tabs switch the kanban board scope. ⚙ gear icon opens pipeline settings. Additional toolbar items appear to the right: "How Deals work" help link | "Deal Reporting" link | "Current deals ▾" dropdown | "Everyone ▾" agent dropdown.

### Reporting
```
Overview  |  Agent Activity  |  Properties  |  Lead Sources  |  Calls  |  Texts  |  Batch Emails  |  Marketing  |  Deals  |  Appointments  |  Agent Goals
```
Plus a "How Reporting works" help link at the far right. 11 tabs total. Clicking a tab may trigger async data fetch with one of the loading states (§4.11).

### Admin
```
Overview  |  Lead Flow  |  Groups  |  Team  |  Action Plans  |  Automations  |  Ponds  |  Email Templates  |  Text Templates  |  Import  |  Custom Fields  |  More ▾
```
"More ▾" overflow dropdown contains the tabs that don't fit: **Phone Numbers · Company · API · Pixel · Integrations · Stages · Appointments · Email Domain Auth** (feat2 f10, verified from Admin sub-nav observation). Far-right of the sub-nav: a standalone "ⓘ Admin Overview" button (outlined pill, always visible, navigates to the Admin Overview card grid regardless of current Admin tab).

**In-house mapping:** Sub-nav = `<Tabs>` from `@/components/ui/tabs`. Active indicator = blue underline via `data-[state=active]` tab trigger styling. Overflow dropdown = `<DropdownMenu>` from `@/components/ui/dropdown-menu`.

---

## 4.4 Left Sidebar — People Module

**Container:** ~215px wide, white background, full height below the sub-nav, scrollable independently. Always visible when in the People module.

### Structure (top to bottom)

```
"People" heading (small, gray)                    [🔖 bookmark icon]
────────────────────────────────────────────────
All People                               [17K badge]
────────────────────────────────────────────────
COLLECTIONS                              [▾ collapse] [+ add]
  ▼ Pipeline                             [▾]
      🔥 Active & Pending Clients         8
      🔥 Hot/Weekly                       2
         Warm/Bi-Weekly                  (no count)
         Past Clients/Sphere: Quarterly  18
         New Leads: No Call Attempt      (no count)
         Cold/Bi-Monthly                 44
         Old Leads: No Call Attempt      7K
  ▼ Neighborhoods                        [▾]
      Tetherow                           696
      Sunriver                           436
      Pronghorn                          13
      Black Butte Ranch                  4
      Northwest Crossing                 3K
      Vandevert                          18
      Crosswater                         58
      Caldera Springs                    208
      Sunstone Loop — Showing Brokers    (no count)
      Bend-River West                    2K
      Bend-Awbrey Butte                  1K
      Bend-Summit West                   1K
      Bend-Century West                  712
      (+ more neighborhoods)
────────────────────────────────────────────────
SMART LISTS                              [+ add]
  ⚗ [list name]                          count
  (funnel/flask icon per item)
────────────────────────────────────────────────
Manage                                   [link]
```

*(Counts transcribed exactly from people GIF f01 and feat1 f04.)*

### Selection state
Selected item: solid blue background fill, white text. The count badge disappears when the item is selected (it is implicit in the "Showing N" count in the main content header). Clicking a different item immediately replaces the selection highlight.

### Count badge formatting
- Raw integer if < 1,000 (e.g., `8`, `18`, `44`)
- K-suffix when ≥ 1,000 (e.g., `7K`, `3K`, `17K`) — not `1,000`, not `1.0K` for round thousands
- No badge displayed for empty lists (Warm/Bi-Weekly shows no count badge)

### Group collapse behavior
Pipeline and Neighborhoods groups have a ▾ chevron; clicking collapses the group in the sidebar. The group header remains visible. SMART LISTS items are flat (no sub-groups).

### In-house mapping
Sidebar container = `<aside>` with `bg-card` or `bg-background`. Section headers = small-caps label (Geist 500, `text-muted-foreground`, 10–11px, letter-spacing 0.08em). Group items = `<Button variant="ghost" className="w-full justify-between">`. Selected state = `bg-accent text-accent-foreground` or `bg-primary/10 text-primary font-medium`. Count badges = `<Badge variant="secondary">`. Sidebar is NOT resizable (no drag handle observed).

---

## 4.5 Left Sidebar — Inbox Module

**Container:** ~160px wide, white background, full height. Narrower than People sidebar because thread metadata needs more space in the adjacent panel.

### Structure

```
My Inbox (559)                    [▾ collapse]
  📥 Inbox  (selected/bold)
  👤 Assigned
  📄 Drafts
  ✉  Sent
  ⬇  Closed
────────────────────────────────
Company (54)
  [no sub-items visible — likely team-shared inbox threads]
────────────────────────────────
⚙ Manage
```

*(Counts from inbox GIF screen 1: My Inbox 559, Company 54.)*

**"My Inbox (N)"** is the section header and shows the sum of unread messages across its sub-folders. The count auto-decrements as threads are opened/marked-read (optimistic update — no round-trip to server before decrement).

**Sub-folder icons:** Each sub-folder has a small icon (emoji or system icon): 📥 Inbox, 👤 Assigned, 📄 Drafts, ✉ Sent, ⬇ Closed.

**⚙ Manage** link at the bottom navigates to a FULL-PAGE inbox settings view (distinct from a modal): shows Name, Phone Numbers, Connected Email, Team columns with an action column per item. URL pattern: inferred `/inbox/manage`.

**Company (N):** A separate shared inbox visible to all agents. Count badge follows same K-suffix rule.

**In-house mapping:** Same sidebar container pattern as People sidebar. Folder items = `<Button variant="ghost">`. Unread badge = `<Badge variant="destructive">` (matches red-urgent convention) or `<Badge variant="secondary">`. ⚙ Manage = plain text link (small, muted).

---

## 4.6 List / Table Pattern

This pattern appears in: People (All People + smart lists), Tasks, Admin (Tags, Custom Fields, Stages, Team, Ponds, Action Plans, Templates), Reporting (Batch Emails, Agent Goals, Marketing), Deals (Reporting tab), Properties. The anatomy is consistent across all modules.

### 4.6.1 Page header row

```
[Page icon]  [Module title]         [Bulk action icons — appear when rows checked]  [Primary action button]
             Showing 874 people
```

- **Title** is the smart list name (e.g., "🔥 Active & Pending Clients | PIPELINE | Edit") or module name ("All People", "Showing 17,123 people").
- **"Showing N [entities]"** count: inline below or beside the title. Always reflects the filtered result set, not the total database count.
- **Bulk action icons** (appear on row selection): Email (envelope) · Assign (person-arrow) · Tag (tag) · Delete (trash) · Export (arrow-up-box). Appear in a row immediately right of the title; they are hidden when no rows are checked.
- **Primary action button** — top-right corner, blue pill. Content depends on context:
  - **All People view:** `+ New List` button (creates a new smart list from current filter state)
  - **Smart list detail view (editable mode):** `↻ Update List` button (saves filter changes to the list) — same slot, mutually exclusive; `+ New List` is absent
  - **Admin modules:** `+ Add [Entity]` (e.g., "+ Add Stage", "+ Add Custom Field")
  - **Reporting:** may have `+ Add Column` or `Export` variant

### 4.6.2 Toolbar row

Below the header, a single horizontal toolbar:

```
[ⓘ How Smart Lists work]  [active filter chip ▾]  [Me ▾]  [Columns ▾]  [Filters (N)]  [+ extra module buttons]
```

- **"ⓘ How Smart Lists work"** help link: appears on smart list views; navigates to FUB knowledge base. In-house: link styled as `text-muted-foreground underline`.
- **Active filter chips:** Each applied filter renders as a pill with the filter name + value + ▾ chevron. Clicking a chip opens that filter inline or in the filter flyout for editing. Removing a chip removes that filter.
- **"Me ▾" agent filter dropdown:** See §4.9 for the 3-section structure. Controls which agent's contacts are shown.
- **"Columns ▾" pill:** Opens the Columns chooser flyout (§4.10). Shows/hides table columns.
- **"Filters" or "Filters (N)" button:** Opens the filter flyout (§4.10). The `(N)` count badge shows how many filters are currently active. When N = 0, displays as "Filters" with no badge. Badge format: integer only, e.g., `Filters (5)`.
- **Module-specific extras:** Deal Reporting adds date-range dropdown; Agent Goals adds year picker.

### 4.6.3 Table

**Column headers:**
- Sortable: click to toggle ascending/descending; arrow indicator (▲ asc, ▼ desc) appears on the sorted column.
- First column: select-all `<Checkbox>` — checking it selects every visible row and shows the bulk action icons.
- Column widths are fixed (not resizable via drag in observed screens).

**People list columns (shot-50, exact transcription):**

| # | Column | Content |
|---|---|---|
| 1 | Checkbox | Row select |
| 2 | Name | 48px circular avatar (photo or initials) + **Name** bold first line + source/domain second line (smaller gray text) |
| 3 | Lead Score | Integer badge |
| 4 | Agent | Agent name |
| 5 | Last Visit | Clock icon + relative date ("Nov 13th '25", "6 days ago") |
| 6 | Phone | Green SMS bubble icon + blue phone call icon + formatted number |
| 7 | Email | Email address (truncated) |
| 8 | Last Activity | Activity type + property address string |
| 9 | Tags | Comma-separated tag names; overflow shows `+ N more` badge; inline `+` button to add a tag |

**Smart list columns (shot-65, Warm/Bi-Weekly list):**

| # | Column | Content |
|---|---|---|
| 1 | Checkbox | Row select |
| 2 | Name | Avatar + name + source stacked |
| 3 | Agent | |
| 4 | Created | Date |
| 5 | Stage | Stage name |
| 6 | Source | Lead source |
| 7 | Last Visit | |
| 8 | Pages Viewed | Integer |
| 9 | Properties Viewed | Integer |
| 10 | Properties Saved | Integer |
| 11 | Last Communication | |
| 12 | Calls Made | Integer |

*(Column sets vary; the Columns chooser (§4.10) controls which appear.)*

**Row interactions:**
- Click anywhere on row → navigate to the detail view (Person detail, Deal detail, etc.)
- On hover: inline action icons may appear (inferred; not all transcribed — at minimum an edit pencil is present on some modules)
- Kebab/`⋮` menu on rows where multiple secondary actions exist

**Count links:** Numeric counts shown in blue underlined text are clickable and navigate to the filtered list for that entity. Example: clicking a stage's person count in the Stages admin table opens People filtered to that stage.

**Drag handles:** Present where order is meaningful — Stages list (drag handle to reorder pipeline stages), Custom Fields (6-dot handle on each row for drag-to-reorder), Ponds.

**Empty state:** Two overlapping human-silhouette icons (gray, centered) + text: "No people match filters, try another search". In-house: `<div className="text-center text-muted-foreground">` with a placeholder illustration.

**Pagination:** Appears in some contexts as previous/next arrows at bottom-right of the table (shot-65 shows pagination arrows). People list likely uses virtual scroll or server-side pagination for 17K rows.

---

## 4.7 Detail Pattern (3-Column)

The Person detail view and Deal detail view use a 3-column layout. Proportions are approximate percentages of the main content width.

```
┌──────────────────┬──────────────────────────────────┬────────────────────┐
│  LEFT RAIL       │  CENTER — ACTIVITY / TIMELINE    │  RIGHT SIDEBAR     │
│  ~25% (~280px)   │  ~50%                            │  ~25% (~270px)     │
│  scrollable      │  scrollable                      │  scrollable        │
│                  │                                  │  independent       │
└──────────────────┴──────────────────────────────────┴────────────────────┘
```

### 4.7.1 Left rail — Person detail (shot-01)

Top section:
- Large circular avatar (80–90px), centered
- Full name (H2 size, bold)
- Subtitle: primary email or lead source

Identity/contact block:
- Stage pill (editable inline — clicking opens Stage dropdown)
- Assigned agent pill (editable inline)
- Phone numbers: Mobile / Home / Work labels, SMS + call icon buttons per number
- Email addresses: label + address; "add another email" link
- Physical address

Classification block:
- Lead Score (integer badge)
- Tags: comma-separated tag pills. Inline `+` button to add a tag. If overflow: `+ N more` badge that expands on click.
- Relationships section: linked person rows with relationship type label (Spouse/Partner/Co-buyer/Sibling/Child/Parent). `+` button to add.

Extended fields:
- Background / notes: free-text block, inline-editable
- Action Plans section: "No action plans running" (empty state); active action plans show name + status
- Files section: "No files yet, drag some here" (empty state with drop zone); uploaded files show filename + size
- Custom fields: organized under section headers matching the Custom Fields admin configuration (64 defined custom fields — see §5 for full list)
- Lender / financing block (lender name, loan type, pre-approval status)

### 4.7.2 Center — Activity / Timeline (shot-01)

Communication action bar (top of center, pinned):
```
[Create Note]  [Send Email]  [Text]  [Log Call]  [+ More ▾]
```
- "Create Note" button is **disabled** (grayed) until text is entered in the note text area — optimistic guard (people GIF).
- "Send Email" opens inline compose or modal.
- "Text" opens inline text compose.
- "Log Call" logs a call outcome without dialing.
- `+ More ▾` dropdown for additional communication types.

Timeline filter tabs (below the action bar):
```
All  |  Emails  |  Calls  |  Texts  |  Notes  |  Activities
```
Each tab shows a count badge of that type's entries for this person. Clicking a tab filters the timeline below.

Timeline entries (newest first):
- Each entry has: type icon (📧 email, 📞 call, 💬 text, 📝 note, ⚡ activity), agent initials/avatar, timestamp (relative: "6 minutes ago", "Nov 9th '25"), excerpt/subject
- Email entries: show subject line bold + preview snippet
- Call entries: show direction (inbound/outbound) + duration
- Text entries: show message preview
- Note entries: show full text + author name

"No communication yet" subtitle appears below the tab bar when a new/fresh contact has zero timeline entries.

### 4.7.3 Right sidebar (shot-01)

Pinned header:
```
Person N of 17,123    ←  →
```
Navigation arrows allow moving to the previous/next person in the current list context without returning to the list. Keyboard hint displayed: **"Press [→] to view next lead or [←] to view previous lead"**.

Stacked widgets below:
- Lead Score display
- FUB number warming-up banner (if applicable — shows a yellow/orange info banner with text about the phone number being in a warm-up period)
- Action Plans quick-view
- Collaborators (agents with visibility access to this contact)
- Website Activity: pages visited count, properties viewed/saved counts — each count is a blue link navigating to the filtered list
- Properties (proposed, viewed, saved counts + quick links)
- Relationship shortcuts

### In-house mapping
3-column layout: CSS grid `grid-cols-[280px_1fr_270px]` or flex. Each column = `<div className="overflow-y-auto">`. Left and right columns have independent scroll from center. The center uses the action bar + tabs + timeline pattern from `crm_timeline` table (existing schema). Tab counts query `crm_timeline` filtered by `event_type`. The right sidebar "Person N of N" header tracks the list cursor from the originating query.

---

## 4.8 Modal Pattern

**Container:** White card, centered in viewport, with a semi-transparent dark scrim overlay covering the full viewport behind it (`rgba(0,0,0,0.4)` approx). Clicking the scrim MAY close the modal depending on the action type (destructive actions do not close on scrim-click — inferred). Card has rounded corners (~8–10px radius) and a box shadow.

**Standard layout:**
```
┌─────────────────────────────────────────┐
│  [Modal title]                       [×] │
├─────────────────────────────────────────┤
│                                          │
│  [Form body / content]                   │
│                                          │
├─────────────────────────────────────────┤
│  [Cancel / Dismiss]       [Primary CTA]  │
└─────────────────────────────────────────┘
```

- Title: top-left, H3 size, dark text
- `×` close: top-right, icon button
- Form body: variable height; scrollable inside the card if content overflows
- Footer: two-button row. Cancel/Dismiss is secondary (left). Primary action button is right (blue in FUB; navy primary in Ryan Realty).

**Observed modal titles (from prior spec §4.4 + shot analysis):**
Add Person · Export Selected People · Save New Smart List · Move Smart List · Merge Person (sending resolution) · Add Relationship · Edit Phone Numbers · Apply Automation · Collaborators · Edit Team Member · Email Template Preview/Edit · Text Template Preview/Edit

**In-house mapping:** `<Dialog>` from `@/components/ui/dialog`. `<DialogHeader>`, `<DialogContent>`, `<DialogFooter>`. Cancel = `<Button variant="outline">`. Primary = `<Button>` (default, navy).

---

## 4.9 Inline Dropdown Pattern

Field-attached dropdowns open in-place over the page content without a scrim. They dismiss on outside-click or ESC.

### Generic inline dropdowns
- Stage dropdown (on person detail left rail): opens a searchable list of stage names; click selects and dismisses
- Agent / Assigned-to dropdown (on person detail, on thread reading pane): opens an agent picker
- Custom field dropdowns: opens enumerated options

### "Me ▾" agent filter dropdown (People toolbar — people GIF f06)

This is a floating dropdown attached to the "Me" button, positioned below it. It has a search box at the top and exactly **three labeled sections**:

```
[Search box]
─────────────────
Everyone
Me  ✓ (current selection highlighted)
─────────────────
PONDS
  View All Ponds
  Out Of State Home Owners
  [+ other named ponds]
─────────────────
TEAM MEMBERS
  [avatar] Matt Ryan
  [avatar] Paul Stevenson
  [avatar] Rebecca Peterson
```

- Section 1 has no explicit header label — just the two options.
- "PONDS" and "TEAM MEMBERS" are uppercase section labels (small-caps or uppercase, gray, non-clickable headers).
- Each TEAM MEMBERS row shows a circular avatar (photo, ~28px) + agent full name.
- The currently active selection is highlighted (check mark or bold).
- Selecting "Everyone" shows all contacts regardless of assigned agent.
- Selecting an agent filters the list to that agent's contacts.
- Selecting a pond filters to contacts in that pond.

**In-house mapping:** `<DropdownMenu>` from `@/components/ui/dropdown-menu`. Three sections separated by `<DropdownMenuSeparator>`. Section labels = `<DropdownMenuLabel>`. Pond and agent items = `<DropdownMenuRadioItem>` (single-select). Avatar = `<Avatar className="h-7 w-7">` inline.

---

## 4.10 Right-Edge Flyout Pattern

Two distinct flyout panels slide in from the right edge of the viewport and occupy the same horizontal slot (~310px wide). They are mutually exclusive: opening one closes the other. Neither is a modal — the main content area (list, table) remains scrollable behind the panel. The flyout slides over the right side of the table, partially obscuring the rightmost columns.

### 4.10.1 Filter panel

**Trigger:** "Filters" or "Filters (N)" pill in the toolbar.

**Empty state (no filters applied):**
```
         [sliders icon]
     No filters added yet
```
Exact text: "No filters added yet". This appears when the list currently has zero applied filters (e.g., All People view — people GIF f04). The panel is still open; it just shows the empty state rather than filter rows.

**Populated state:**
```
Filters                                [Clear filters]
─────────────────────────────────────────────────────
[🔍 Add a filter...                                  ]
─────────────────────────────────────────────────────
[icon] Tags                                         ▾
       exclude any of: compliance:hard-stop, ...
[icon] Last Text Sent                               ▾
       more than 7 days ago
[icon] Last Sent Email                              ▾
       more than 7 days ago
[icon] Last Call                                    ▾
       more than 7 days ago
[icon] Stage                                        ▾
       includes any of: A - Hot 1-3 Months, ...
─────────────────────────────────────────────────────
                                       [Clear filters]
```

*(5-filter example transcribed exactly from Hot/Weekly smart list, people GIF f02–f03.)*

- **"Add a filter" input** at the top: type to search available filter fields; selecting one adds it to the list.
- **Each filter row:** icon (field-type icon) + field label + current operator + current value (truncated with `...` if long) + ▾ chevron to expand.
- **Expanded filter row:** shows operator radio buttons (e.g., "includes any of" / "excludes any of" / "is blank") + value input (tag pills with `+ Add`, free text, date picker, or select list depending on field type).
- **"Clear filters" link:** bottom of the panel (and optionally top-right of the panel header). Removes all filters and resets the list to unfiltered state.
- **Update List button:** does NOT live in the filter panel itself — it is in the main content header (§4.6.1). Saving filter changes to a smart list requires clicking "Update List" in the header.

### 4.10.2 Columns chooser flyout

**Trigger:** "Columns ▾" pill in the toolbar.

```
Columns
─────────────────────────────────────────────────
[🔍 Search columns...                            ]
─────────────────────────────────────────────────
DETAILS
  [T] Name                              ✓ (checked)
  [T] First Name
  [T] Last Name
  [📞] Phone                            ✓
  [✉] Email                            ✓
  [T] Address
  [○i] Price
  [🏷] Tags                             ✓
  [○] Stage                            ✓  (partially visible)
  ...
COMMUNICATION
  [field type icon] [field label]       [checkbox]
  ...
ACTIVITY
  ...
─────────────────────────────────────────────────
[Reset to defaults]
```

*(Column names and icons from people GIF f07.)*

- Category headers (DETAILS, COMMUNICATION, ACTIVITY, etc.) are uppercase non-clickable labels.
- Each field = checkbox row: checked = column visible in table, unchecked = hidden.
- "Reset to defaults" link at bottom restores the default column set.

**In-house mapping for both flyouts:** `<Sheet side="right">` from `@/components/ui/sheet`. Width = `className="w-[310px]"`. The two flyouts share the same `Sheet` component with conditional content based on which trigger was clicked. Closing either dismisses the sheet.

---

## 4.11 Loading States

FUB uses three distinct loading patterns depending on context. All three share one invariant: **the top nav bar and module sub-nav always remain visible during any loading state**. The nav never disappears or dims.

### Type A — Full-page centered arc spinner

**Visual:** A single CSS arc/ring spinner (~40px), animated (rotating), centered both horizontally and vertically in the main content area. The content area background is white/light. No skeleton structure, no content rows.

**Observed on:** Reporting > Calls tab (feat2 f01), Reporting > Deals tab (feat2 f05), Reporting > Appointments tab (feat2 f07).

**When to use in-house:** Complex data-aggregate reports that require multiple DB queries before any row can render.

**In-house implementation:** `<div className="flex items-center justify-center h-full"><Spinner /></div>`. Use Shadcn `<Loader2 className="animate-spin" />` or a custom arc variant.

### Type B — Single dot / minimal indicator

**Visual:** A single small animated dot (or a very minimal pulsing element) in the content area. The page shows its title and any immediately-available filter controls (e.g., date-range dropdowns) but the data table area is blank, occupied only by the dot.

**Observed on:** Reporting > Marketing tab loading state (feat2 f03 — "a tiny dot center-page, minimal loading indicator — not a spinner"), Reporting > Deals tab (feat2 f05 also described as "tiny loading dot").

**When to use in-house:** Pages where the filter chrome renders immediately from client state but data is async; a heavy spinner would feel disproportionate to the wait time.

**In-house implementation:** A 12px circle with `className="animate-pulse bg-muted-foreground/40 rounded-full"` centered in the content zone.

### Type C — Skeleton rows

**Visual:** The full table structure renders immediately (column headers, row lines, checkbox column) but each data cell is replaced by a gray shimmer bar (`<Skeleton>`). The bars have the approximate width of the column content. After data arrives, skeleton bars are replaced by real content (fade-in or instant swap).

**Observed on:** All People initial page load (people GIF f04 — "table is in LOADING SKELETON state — all rows show gray animated placeholder bars"), Admin > Ponds tab (feat2 GIF — described as skeleton rows for this tab).

**When to use in-house:** List/table views where the column structure is known before data arrives. Preferred over Type A for any paginated list, because it communicates the shape of the data to the user immediately.

**In-house implementation:** Render `N` skeleton rows (N = page size, typically 20–25) using `<TableRow>` with `<TableCell><Skeleton className="h-4 w-full" /></TableCell>` for each column.

### Module-transition blank state (page-level)

**Visual:** A nearly-blank viewport — solid light gray background (`~#eef1f4`), no content visible — with a **thin orange progress bar fixed to the very bottom edge of the viewport** (left-anchored, partial width, animated growing-right). This appears during full module navigation (clicking a top-nav item) as a flash between route unload and route render. Duration is typically < 300ms. (feat1 f03 — "very faint orange loading bar at the very bottom of the viewport (partial, left-anchored).")

Additionally: when navigating to Inbox from People, only the top nav bar renders (no content, no left sidebar, just the dark nav) while the module JS chunk is loading (feat1 f05).

**In-house implementation:** Use the Next.js app-router loading.tsx convention. The orange progress bar = a `<Progress>` component at the very bottom viewport edge (`position: fixed; bottom: 0; left: 0; z-index: 9999`) rendered by the top-level layout while a Suspense boundary is resolving. Show it on `router.events` start / hide on complete.

---

## 4.12 Getting Started / Onboarding Page

**CORRECTION from prior spec:** This is NOT a persistent bottom bar that appears on every screen. It is a full-page route accessible from the **hamburger/grid icon** at the far-left of the top nav bar. Once all onboarding steps are complete, this page presumably disappears from the nav (not confirmed). The main nav's hamburger icon navigates to this page, not to a sidebar drawer.

**URL:** Inferred `/getting-started` or `/home`. (feat1 f02 shows "wait" cursor on the hamburger/grid icon at top-left, implying navigation just occurred.)

**Page layout:**

```
Awesome [FirstName], You're [N] Steps Closer to More Deals!
─────────────────────────────────────────────────
[  VIDEO THUMBNAIL  ]   │  LAUNCH PROGRESS
[  Getting Started  ]   │  [████░░░░] ~20%
[  play button      ]   │
                        │  GET HELP
─────────────────────────  Getting Started Webinars
                           Getting Started Guide
[✅] Setting Up Your Account for Success   Help Center
    ✓ Existing Contacts Imported           Youtube Channel
    ✓ Your Google Account is Connected
    ✓ Success! Mobile App Connected     OUR TEAM IS HERE TO HELP
    ✓ Invitations Successfully Sent     [avatar][avatar][avatar]
                                        (855) 622-5311
[○] Start Driving More Inbound Leads    Contact Support
  ▼ Install Your Pixel                  Schedule a meeting
    [expanded item body: description
     + preview screenshot + CTA button]
```

*(Exact transcription from feat1 f02.)*

**Details:**
- Personalized heading: `"Awesome [FirstName], You're [N] Steps Closer to [goal text]!"`
- Video thumbnail: teal/blue gradient with centered play button icon. Clicking plays an onboarding video (likely modal or fullscreen).
- Two accordion sections:
  - Section 1 (completed): green dot + section title + checked items with ✓ icons
  - Section 2 (in-progress): gray dot + section title + auto-expanded next item showing description body text + a CTA button + a preview screenshot/image
- Right sidebar (within the page, not the shell right rail):
  - "LAUNCH PROGRESS" label + `<Progress>` bar with percentage
  - "GET HELP" section: text links to external knowledge resources
  - "OUR TEAM IS HERE TO HELP": phone `(855) 622-5311` + 3 support agent avatar photos + "Contact Support" link + "Schedule a meeting" link

**In-house equivalent:** A welcome/setup checklist page at `/admin/setup` or `/crm/onboarding`. Not a persistent bar. Drive completion via `crm_onboarding_steps` table (or similar). The phone number `(855) 622-5311` is FUB's support line — replace with Ryan Realty's contact (`541.213.6706`).

---

## 4.13 Floating Help Button

**Visual:** A ~50px circular button, teal/blue background, white `?` text, fixed to the bottom-right corner of the viewport (approximately 20px from right edge, 20px from bottom edge).

**Behavior:** Always visible on every screen including Admin. High z-index (renders on top of all page content). Clicking opens a help/support overlay or knowledge base drawer (the exact overlay content is not captured in the analyzed screens, but the button is confirmed present in every module — shot-33 Admin overview confirms it).

**In-house mapping:** `<Button>` positioned with `className="fixed bottom-5 right-5 rounded-full h-12 w-12 bg-accent text-accent-foreground z-50">`. Render in the root layout so it appears on every page.

---

## 4.14 Design-System Mapping Table

FUB uses a blue/teal primary palette and system sans-serif fonts. The Ryan Realty in-house build copies FUB's **structure and behavior exactly** but uses the Ryan Realty design system for all styling. This table maps every FUB visual element to its Ryan Realty token and component.

| FUB element | FUB visual | Ryan Realty component | Token / class |
|---|---|---|---|
| Primary action buttons ("Save", "+ Add", "Update List") | Blue filled pill | `<Button>` | `variant="default"` → `bg-primary` navy `#102742`, `text-primary-foreground` cream |
| Secondary / cancel buttons | White/outlined | `<Button variant="outline">` | `border-border bg-background` |
| Destructive actions (Delete, Remove) | Red | `<Button variant="destructive">` | `bg-destructive text-destructive-foreground` |
| Top nav bar background | Dark charcoal ~`#2b333e` | `<nav>` | `bg-primary text-primary-foreground` (navy `#102742`) |
| Active nav item triangle | Blue caret below label | Custom `::after` pseudo-element or inline SVG | `bg-accent` (6px caret, cream `#faf8f4` triangle on navy bar) |
| Module sub-nav active tab | Blue bottom-border underline | `<Tabs>` `[data-state=active]` | `border-b-2 border-primary font-medium` |
| Page / app background | Light gray ~`#f1f5f9` | Layout wrapper | `bg-background` → cream `#faf8f4` |
| Card / panel background | White `#ffffff` | `<Card>` | `bg-card` |
| Left sidebar background | White | `<aside>` | `bg-card border-r border-border` |
| Muted / secondary text | Gray ~`#6b7280` | — | `text-muted-foreground` |
| Count badges (blue, numeric) | Blue circle with white number | `<Badge>` | `variant="secondary"` or `variant="default"` |
| Success / active status badges | Green pill | `<Badge>` | `bg-success text-success-foreground` |
| Warning state (⚠️ yellow card, e.g., A2P business registration) | Yellow icon + border | `<Alert variant="warning">` or `<Badge>` | `bg-warning text-warning-foreground` |
| Failure / error state (red status) | Red badge or icon | `<Badge variant="destructive">` | `bg-destructive text-destructive-foreground` |
| Circular avatars (contact, agent, team member) | Photo or initials circle | `<Avatar>` from `@/components/ui/avatar` | `<AvatarImage>` + `<AvatarFallback>` with initials |
| Modal dialog | White card + dimmed scrim | `<Dialog>` from `@/components/ui/dialog` | `<DialogContent>`, `<DialogHeader>`, `<DialogFooter>` |
| Right-edge flyout panels (filter + columns) | Slide-in panel from right, 310px | `<Sheet side="right" className="w-[310px]">` from `@/components/ui/sheet` | — |
| Inline dropdown (stage, agent, Me ▾) | Floating dropdown anchored to trigger | `<DropdownMenu>` from `@/components/ui/dropdown-menu` | `<DropdownMenuContent align="start">` |
| Table (list/table pattern) | Bordered rows, fixed headers | `<Table>` from `@/components/ui/table` | `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableCell>` |
| Select-all checkbox / row checkbox | Square checkbox | `<Checkbox>` from `@/components/ui/checkbox` | — |
| Tabs (sub-nav, timeline filter) | Underline active tab | `<Tabs>` from `@/components/ui/tabs` | `<TabsList>`, `<TabsTrigger>`, `<TabsContent>` |
| Skeleton loading rows | Gray shimmer bars | `<Skeleton>` from `@/components/ui/skeleton` | `className="h-4 w-full animate-pulse"` |
| Toggle switches (Automations on/off) | Blue toggle (on) / gray (off) | `<Switch>` from `@/components/ui/switch` | Optimistic state flip on click; revert on API failure |
| Form text inputs | Outlined input, white bg | `<Input>` from `@/components/ui/input` | — |
| Form select dropdowns | Outlined select | `<Select>` from `@/components/ui/select` | — |
| Form labels | Gray text above input | `<Label>` from `@/components/ui/label` | `text-sm text-muted-foreground` |
| Form textarea | Outlined multi-line | `<Textarea>` from `@/components/ui/textarea` | — |
| Separator / divider lines | Light gray horizontal line | `<Separator>` from `@/components/ui/separator` | `orientation="horizontal"` |
| Accordion (Getting Started, filter row expand) | Chevron expand/collapse | `<Accordion>` from `@/components/ui/accordion` | — |
| Progress bar (Launch Progress, page-transition bar) | Filled green bar | `<Progress>` from `@/components/ui/progress` | — |
| Alert / info banner (FUB number warming-up, A2P banner) | Colored banner with icon | `<Alert>` from `@/components/ui/alert` | `variant="warning"` / `variant="default"` |
| Tooltip (e.g., "Clicked" cursor tooltip, keyboard shortcuts) | Small dark tooltip | `<Tooltip>` from `@/components/ui/tooltip` | — |
| Tag pills | Small rounded pills | `<Badge variant="outline">` or `<Badge variant="secondary">` | Pill shape via `rounded-full` |
| Floating help button | Teal circle, `?`, fixed bottom-right | `<Button className="fixed bottom-5 right-5 rounded-full ...">` | `bg-accent text-accent-foreground` |

### Typography mapping

| Context | FUB font | In-house font | How to apply |
|---|---|---|---|
| Page H1 (module title) | System sans, 20–22px bold | Amboqia Boriango | `<H1>` or `<DisplayHeading>` from `components/site/primitives`; carries `font-display` |
| Section H2 / sub-headings | System sans, 16–18px medium | Amboqia Boriango | `<H2>` primitive |
| All body text, labels, nav items, table content | System sans | Geist 400 | `font-sans` (default) |
| Medium-weight UI labels | System sans medium | Geist 500 | `font-medium` |
| Bold UI labels, column headers | System sans bold | Geist 600–700 | `font-semibold` / `font-bold` |
| Code / API keys (masked `**********+last4`) | Monospace | Geist Mono | `font-mono` |
| All numeric values (counts, prices, dates, lead scores) | System sans | Geist with tabular numerals | `font-variant-numeric: tabular-nums` → `className="tabular-nums"` |

### Date and number formatting (matching FUB exactly)

- **Relative dates:** "6 minutes ago", "Nov 13th '25", "4 months ago". Use `date-fns` `formatDistanceToNow` for < 7 days, `format(date, "MMM do ''yy")` for older dates.
- **Absolute on hover:** Show full ISO timestamp in a `<Tooltip>` on any relative date (inferred from UX convention; not directly observed but standard).
- **Currency:** Integer dollar amounts with commas: `$1,234,567`. No cents. No rounding visible in deal cards.
- **Large counts:** K-suffix at ≥ 1,000 in sidebar badges; full integer in table header "Showing N people".
- **Percentages:** Integer for goal progress (e.g., "0%"); one decimal for YoY changes if applicable.
- **Phone numbers:** FUB formats as `(541) 390-4422` — parenthesized area code, space, 3-digit, dash, 4-digit. Ryan Realty canonical format in marketing copy is `541.213.6706` (dotted); for display in the CRM UI, match the FUB parenthesized format for data consistency with existing records.

---

## Shared Data Surfaces Referenced in This Section

The following Supabase tables (existing `crm_*` schema) are the in-house backing stores for the patterns documented above. Cross-reference §19 for full schema.

| Pattern | Table(s) |
|---|---|
| People list + smart list filters | `crm_people`, `crm_smart_lists`, `crm_smart_list_filters` |
| Person detail — left rail fields | `crm_people`, `crm_phones`, `crm_emails`, `crm_tags`, `crm_custom_field_values` |
| Person detail — center timeline | `crm_timeline` |
| Person detail — action plans | `crm_action_plan_enrollments` |
| Inbox — folder tree + thread list | `crm_inbox_threads`, `crm_inbox_messages` |
| Inbox — right contact panel | `crm_people` (person_id on thread) |
| Agent filter (Me ▾) | `public.brokers` (Matt Ryan, Paul Stevenson, Rebecca Peterson — 3 rows) |
| Ponds | `crm_ponds`, `crm_pond_members` |
| Team members (in dropdown) | `public.brokers` |
| Automation status toggle | `crm_automations` (or `marketing_brain_actions` depending on implementation) |

---

## Acceptance Criteria

Before shipping any module that uses these shared patterns, verify:

- [ ] Top nav bar persists (is never hidden or dimmed) during all three loading types.
- [ ] Active module has triangle caret below label; Inbox module has teal icon highlight.
- [ ] Sub-nav uses underline active indicator (distinct from nav triangle).
- [ ] People sidebar count badges use K-suffix at ≥ 1,000; badge disappears on selection.
- [ ] Filter panel and Columns chooser share one `<Sheet>` slot — opening one closes the other.
- [ ] Filter panel shows "No filters added yet" empty state on lists with zero active filters.
- [ ] `+ New List` button visible on All People; `Update List` button visible on smart list detail — never both simultaneously.
- [ ] "Me ▾" dropdown has exactly 3 sections: Everyone/Me · PONDS · TEAM MEMBERS with avatars.
- [ ] Skeleton rows (`<Skeleton>`) used for list/table loading; arc spinner used for aggregate-report loading.
- [ ] Page-transition blank state uses orange progress bar fixed to viewport bottom.
- [ ] 3-column detail layout has independent scroll per column.
- [ ] "Person N of 17,123" navigation with ← → arrows in right sidebar of Person detail.
- [ ] Keyboard hint "Press [→] to view next lead or [←] to view previous lead" rendered in right sidebar.
- [ ] Create Note button disabled until text is entered in the note field (optimistic guard).
- [ ] "No communication yet" subtitle visible on zero-timeline contacts.
- [ ] Getting Started is a full-page route (not a bottom bar); hamburger icon in top nav navigates to it.
- [ ] Floating `?` help button fixed bottom-right on every page.
- [ ] No raw HTML `<button>`, `<input>`, `<select>`, `<table>`, `<dialog>` — all from `@/components/ui/`.
- [ ] No hex colors or `bg-[#...]` classes — all from design token classes.
- [ ] All numeric surfaces have `tabular-nums`.

---

## Prior-Spec Errors Corrected by This Document

| Prior §4 claim | Correction |
|---|---|
| "Getting-Started bar" (implied persistent bottom bar) | Full-page route, not a bar; navigated via hamburger icon |
| Loading state: single description with no type distinction | Three distinct types (arc spinner / dot / skeleton rows), each used in different contexts |
| Filter flyout and Columns chooser described generically | Both are right-edge flyouts sharing one slot (mutually exclusive); Filter panel has "No filters added yet" empty state |
| No mention of "Update List" vs "+ New List" | Mutually exclusive in same slot; All People shows "+ New List"; smart list edit shows "Update List" |
| "Me ▾" dropdown not described | Exact 3-section structure documented (Everyone/Me · PONDS · TEAM MEMBERS) |
| No mention of page-transition blank state | Orange progress bar at viewport bottom during module navigation |
| Columns chooser described as "dropdown" | It is a right-edge `<Sheet>` flyout, not a floating dropdown |
| [illegible] OCR gaps in nav item labels | Verified exact module names from GIF observation: People, Inbox, Tasks, Calendar, Deals, Reporting, Admin |
| Admin sub-nav "More ▾" items not enumerated | Exact 8 items listed: Phone Numbers · Company · API · Pixel · Integrations · Stages · Appointments · Email Domain Auth |
| "Create Note" button always enabled | Disabled until text entered (optimistic guard — people GIF) |
| No mention of skeleton rows for People list | Type C skeleton confirmed on All People initial load |

---

## Sources

**Static screenshots (shot files):**
- `shot-01.md` — Person detail (Laurie McAdam): 3-column layout, left rail anatomy, action bar, timeline tabs, right sidebar "Person N of N", FUB number banner, keyboard nav hint
- `shot-30.md` — Deals kanban: pipeline sub-bar (Buyers/Sellers/⚙), stage columns with colored accent bars, deal card anatomy
- `shot-33.md` — Admin Overview: no left sidebar, Admin sub-nav (17 tabs + More ▾ + ⓘ Admin Overview), card grid layout, Business Registration warning ⚠️ card, floating ? help button
- `shot-50.md` — All People list: exact column set (Name/Lead Score/Agent/Last Visit/Phone/Email/Last Activity/Tags), toolbar elements, "+ New List" button, "Showing 874 people" count
- `shot-65.md` — Warm/Bi-Weekly smart list (empty) + filter panel open: filter panel anatomy, "Update List" button, smart list title row format, empty-state illustration, all 5 filter rows transcribed, expanded Tags filter

**GIF analyses:**
- `fub-analysis-gif/people.md` — Loading skeleton (Type C), filter panel "No filters added yet", "Me ▾" 3-section dropdown, Columns flyout right panel, "+New List" vs "Update List" mutual exclusion, Create Note disabled state, "No communication yet", list-to-detail navigation
- `fub-analysis-gif/feat1.md` — Module-transition blank state with orange progress bar at viewport bottom, Getting Started full page (frame 02 — personalized heading + accordion + launch progress sidebar), Inbox blank loading state (frame 05), 3-panel inbox layout, Tasks (...) count resolution, Calendar day view
- `fub-analysis-gif/feat2.md` — Type A spinner (Reporting Calls — frame 01), Type B dot (Reporting Marketing — frame 03), Type B dot (Reporting Deals — frame 05), Admin Overview card grid (frame 09), Admin sub-nav "More ▾" contents, Automations toggle, Custom Fields drag handles, Stages system-locked state, Email Domain Auth UNCLAIMED state
- `fub-analysis-gif/inbox.md` — Inbox 4-column layout confirmation, folder tree anatomy (My Inbox/Company/Manage), thread row anatomy, reading pane layout, Filter dropdown (Emails/Texts/Calls checkboxes), All/Unread segment control, inline reply compose, right contact panel structure

**Prior spec:**
- `docs/FUB_CRM_FEATURE_SPEC.md` §4 (lines 131–166) — Structural outline superseded by this document
- `docs/FUB_CRM_FEATURE_SPEC.md` §3 — URL map (cross-reference for route patterns)
- `docs/FUB_CRM_FEATURE_SPEC.md` §5 — Entity data model (cross-reference for field names in left rail)
