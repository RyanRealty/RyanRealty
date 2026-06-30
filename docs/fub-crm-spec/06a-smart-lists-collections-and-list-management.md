# Module: People — Smart Lists, Collections & List Management

Smart Lists are the primary navigation and contact-prioritisation mechanism in the People module. A Smart List is a saved filter query over the contact database that surfaces the contacts who currently match its criteria — the membership updates automatically as contact data changes (per FUB docs). Collections are named folders that group Smart Lists in the left sidebar, giving teams a visual hierarchy of working queues. The Manage Lists & Collections admin screen is where Smart Lists and Collections are created, renamed, described, shared, reordered, moved, duplicated, and deleted. This section covers all three surfaces: the left sidebar tree, the individual Smart List view, and the Manage screen together with its two modals (Save New Smart List and Move Smart List).

---

## 1. Left Sidebar — Collections & Smart Lists Tree

### 1.1 Layout and position

The sidebar is a fixed-width column (~190–200 px) on the left edge of every People-module screen. It is independent-scrollable. The global top nav bar (dark charcoal, ~48 px) sits above it; the sidebar extends to the bottom of the viewport.

The sidebar background in FUB is dark charcoal (approximately `#1F2937` / `#2d2d2d`) when viewing Manage Lists. On the regular list-view screens the rail uses a lighter gray (`#f3f4f6` / `#f7f8fa`). Our implementation maps this to the Ryan Realty design-system navy (`#102742`) sidebar with cream text for the dark variant, and the standard `bg-muted` surface for the light variant — use `@/components/ui/` primitives consistently.

### 1.2 Section: People

```
People   ← small-caps section label, gray, ~11 px
  [group-icon] All People        17K  ← count badge
```

- **"All People"** — always the first item, non-deletable, no emoji, group-silhouette icon. Count badge shows total contacts (`17,123` abbreviates to `17K`).
- Count badge format: integer 1–999 renders as-is; ≥ 1 000 renders as `NK` rounded to the nearest thousand (e.g. 7 000 → `7K`, 17 123 → `17K`); 0 renders as no badge (not "0").
- Clicking "All People" loads the unfiltered contact table (URL `/2/people`). A "+ New List" button appears in the top-right of the main area (only on All People — not on individual smart lists).

### 1.3 Section: COLLECTIONS

```
COLLECTIONS   ← all-caps divider label, muted gray, ~11 px, non-interactive
```

Collections are collapsible folder groups. Each collection header row has:
- Folder icon (open-folder glyph) on the left
- Collection name (bold, ~14 px)
- Expand/collapse chevron on the right (▼ expanded, ▶ collapsed)
- No count badge at the collection level in the sidebar (the collection's aggregate total appears only on the Manage screen — see §3)

When expanded, child Smart List items are indented ~12 px.

#### 1.3.1 Collection: Pipeline (observed, expanded)

| Position | Emoji | Label | Badge count |
|----------|-------|-------|-------------|
| 1 | 😎 | Active & Pending Clients | 8 |
| 2 | 🔥 | Hot/Weekly | 2 |
| 3 | 🌡️ | Warm/Bi-Weekly | (none — 0 members) |
| 4 | 😊 | Past Clients/Sphere: Quarterly | 18 |
| 5 | 🚨 | New Leads: No Call Attempt | (none — 0 members) |
| 6 | ❄️ | Cold/Bi-Monthly | 44 |
| 7 | 😊 | Old Leads: No Call Attempt | 7K |

**Prior-spec error corrected:** The prior spec (§6.2) transcribed corrupted OCR names ("HotReady", "Warm Ready", "Idle Monthly", "[Cave] Leads: No Call Attempt", "Callable Monthly", "GIC Leads: No Call Attempt"). The high-resolution verified values are as tabulated above.

Each Pipeline item uses an **emoji prefix** (not a funnel icon). The emoji is stored per-list and renders inline to the left of the label in the sidebar and in the main-area header.

#### 1.3.2 Collection: Neighborhoods (observed, expanded)

Neighborhood items use a **funnel/filter icon** (▽ outline glyph, ~12 px) as their prefix instead of an emoji, visually indicating they are filter-based geographic lists.

| Label | Badge count |
|-------|-------------|
| Tetherow | 696 |
| Sunriver | 436 |
| Pronghorn | 13 |
| Black Butte Ranch | 4 |
| Northwest Crossing | 3K (3,291 exact) |
| Vandevert | 18 |
| Crosswater | 58 |
| Caldera Springs | 208 |
| Sunstone Loop — Showing Brokers | (none visible) |
| Bend – River West | 2K |
| Bend – Awbrey Butte | 1K |
| Bend – Summit West | 1K |
| Bend – Century West | 712 |
| Bend – Southern Crossing | 444 |

**Prior-spec error corrected:** The prior spec listed Pronghorn as "21/29" — the verified count is 13.

#### 1.3.3 Section: SMART LISTS (standalone — not in a collection)

Below the COLLECTIONS groups, a second divider label appears:

```
SMART LISTS   ← all-caps divider label, muted gray, non-interactive
```

These are Smart Lists that exist outside any named collection. Each uses a funnel icon prefix (▽).

| Icon | Label | Badge count |
|------|-------|-------------|
| ■ (filled square) | All Recent Online Activity | 3 |
| ▽ | All Expireds | 637 |
| ▽ | Expired No Contact | 137 |
| ▽ | Absentee Owners | 805 |
| ▽ | Absentee Owners No Contact | 550 |
| ▽ | Matts Sphere | 1K |
| ▽ | All Clients | 23 |
| ▽ | Realtors | (none) |
| ▽ | Migration Realtors | (none) |
| ▽ | FSBO | 16 |
| ▽ | TCPA Litigators — Hard Stop | 132 |

Note: "All Recent Online Activity" uses a filled square (■) icon rather than the standard funnel, suggesting a distinct list type or custom icon.

### 1.4 Manage link (pinned bottom)

```
⚙ Manage   ← gear icon + label, pinned to bottom of left rail
```

- Always visible, pinned below all scrollable content
- When active (on the Manage Lists screen), renders with solid blue fill background (`#3B82F6`) and white text
- Links to `/2/people/manage-lists`

### 1.5 Active item styling

The currently selected item (Smart List or All People) gets a blue highlight background on its row (`#dbeafe` light blue in FUB's palette). In our implementation, map to `bg-primary/10` with `text-primary` for the label and `font-medium`.

### 1.6 Count badge update behavior (per FUB docs)

- Counts refresh every **10 minutes** while the People page is open (polling, not real-time push)
- Counts refresh **immediately** when the user clicks that specific Smart List
- Counts refresh **immediately** when a Smart List is created or its filters are saved
- A sidebar count can be stale by up to 10 minutes — clicking the list forces a recount
- Sidebar shows abbreviated counts (`K` suffix); the main table shows the precise figure ("Showing 6,646 people")

### 1.7 Sidebar behavior on list navigation

- Clicking a Smart List item: highlights that item, replaces the main table content with the list's filtered results, repopulates the right filter panel with that list's saved filters, and changes the URL to `/2/people/list/{id}`
- The filter panel stays open when switching between Smart Lists (it repopulates rather than closing/reopening)
- Switching to "All People" clears the filter panel to the "No filters added yet" empty state without closing the panel
- Skeleton-row loading state appears immediately on navigation while data loads (no spinner, no blank — gray animated placeholder rows at correct row height)

### 1.8 Acceptance criteria — sidebar

1. All People row is always first, non-deletable, shows deduplicated total contact count
2. Collection groups are collapsible (▼/▶) with state persisted per user session
3. Smart list items show correct emoji prefix (Pipeline) or funnel icon (standalone/Neighborhoods)
4. Count badges: zero → no badge; 1–999 → integer; ≥ 1 000 → `NK` rounded
5. Active item renders with distinct highlight background
6. Clicking any item navigates to the correct URL and loads the correct data
7. Count polling runs every 10 minutes while the People page is open
8. Filter panel repopulates (not closes) when switching lists
9. Skeleton loading appears immediately on click, replaced by data when the query resolves
10. Manage link is always pinned to the bottom, renders active state when on `/manage-lists`

---

## 2. Smart List View (`/2/people/list/{id}`)

### 2.1 URL pattern

`/2/people/list/{id}` — where `{id}` is the integer smart list ID (e.g., `list/25` for Active & Pending Clients).

### 2.2 Layout

Four vertical regions within the main content area:

```
┌─────────────────────────────────────────────────┬──────────────────┐
│  Page Header (emoji + name + PIPELINE badge     │  Right filter    │
│  + Edit link + description)                     │  panel (~200 px) │
├─────────────────────────────────────────────────┤  (persistent,    │
│  Bulk action bar ("N people found" + icon row)  │  not a flyout)   │
├─────────────────────────────────────────────────┤                  │
│  Toolbar ("How Smart Lists work" | Columns |    │                  │
│            Me ▼ | Filters (N))                  │                  │
├─────────────────────────────────────────────────┤                  │
│  Table (scrollable body)                        │                  │
│  — or —                                         │                  │
│  Empty state (centered icon + text)             │                  │
└─────────────────────────────────────────────────┴──────────────────┘
```

**Top-right of the page (above toolbar, right-aligned):**
- "↻ Update List" button — outlined, with a refresh/sync icon; present only on **dynamic/pipeline** Smart Lists; absent on **static** lists (see §2.7)
- Blue square icon button (~32 px) — adjacent to Update List; function is copy/share (inferred)

### 2.3 Page header

```
😎  Active & Pending Clients  [PIPELINE]  Edit
A static list of the clients you are currently working with. This smart list
displays everyone in current (active/signed) and pending (under contract) stages.
                                                                          [More ▼]
```

| Element | Detail |
|---------|--------|
| Emoji | Rendered at ~24 px; prefix to list name; stored per-list |
| List name | Bold, ~22 px, dark text (`#111827`) |
| Type badge | "PIPELINE" — light blue background (`#dbeafe`), dark blue text (`#1d4ed8`), rounded pill, uppercase, ~11 px; non-clickable; indicates this list belongs to the Pipeline collection |
| "Edit" link | Plain text link (blue or gray), small; opens the Edit Smart List modal (same modal as Save New Smart List — see §4) |
| Description text | Gray, ~13 px; truncates after ~1 line with a "More" expand link; "More" expands inline, link changes to "Less" |

**Note on "PIPELINE" badge:** This badge is a collection/type indicator displayed on all lists in the Pipeline collection. Lists in other collections or standalone lists may show a different label or no badge (inferred from observation of only Pipeline-type lists in screenshots).

### 2.4 Bulk action bar

Immediately below the description, above the toolbar:

```
[No people found]  [✉] [👤+] [🏷] [🗑] [⬇]
     ← left-aligned text           ← 5 icon buttons, right-aligned, ~16 px each
```

When contacts are present, the text reads "Showing N people" (e.g. "Showing 6,646 people") and the icon buttons are active. When zero results, text reads "No people found" and the icons are disabled/ghosted.

| Icon | Action |
|------|--------|
| ✉ Envelope | Batch email to all selected contacts |
| 👤+ Person-plus | Bulk assign agent or add to list |
| 🏷 Tag | Bulk add/remove tags |
| 🗑 Trash | Bulk delete (Owner/Admin only) |
| ⬇ Download/arrow | Export to CSV (see §6.7 of sibling spec `06-people.md`) |

**Per FUB docs — 10 Mass Actions** are available when contacts are selected (not all visible as icons; some may be in a dropdown): Update Stage, Update Timeframe, Update Source, Assign Agent, Assign Pond, Assign Lender, Add Collaborators, Remove Collaborators, Merge People, Mailing Label. **Mass Actions do NOT trigger Automations** — this is an explicit architectural rule, not a bug; the bulk path bypasses the automation engine entirely.

### 2.5 Toolbar row

Right-aligned cluster below the bulk action bar:

| Element | Detail |
|---------|--------|
| "ℹ How Smart Lists work" | Text link with info-circle icon; opens FUB help article |
| "Columns ▼" | Outlined button; icon: three horizontal lines (≡); opens the column chooser right flyout (same panel slot as the filter panel — opening Columns closes/replaces the filter panel) |
| Agent scope dropdown | Labeled "Me ▼" by default; opens a floating dropdown (not a right panel) with three sections: standalone options ("Everyone" / "Me"), PONDS section ("View All Ponds" + named ponds — e.g. "Out Of State Home Owners"), TEAM MEMBERS section (Matt Ryan, Paul Stevenson, Rebecca Peterson with avatars); currently selected option is highlighted |
| "Filters (N)" button | Funnel icon + label + count in parentheses (e.g. "Filters (2)", "Filters (5)"); toggles the right filter panel; count reflects number of active filter conditions |

The **Columns chooser** (when opened) is a right-panel flyout showing searchable field list organized by category headers. Observed category: **DETAILS** with fields: Name (T icon), First Name (T icon), Last Name (T icon), Phone (phone icon), Email (email icon), Address (T icon), Price (circle-i icon), Tags (tag icon), Stage (and more below fold). Each field is a checkbox row.

### 2.6 Table

Column headers (observed default for Active & Pending Clients):

| # | Column header | Sort/filter |
|---|---------------|-------------|
| 1 | (checkbox) | Bulk select all |
| 2 | Name | — |
| 3 | Created | — |
| 4 | Stage | ▽ filterable column header |
| 5 | Source | — |
| 6 | Last Visit | — |
| 7 | Pages Viewed | — |
| 8 | Properties Viewed | — |
| 9 | Properties Saved | — |
| 10 | Last Communication | ↓ sorted descending (default) |
| 11 | Texts Sent | — |
| 12 | Calls Made | — |

Column configuration is **per-list saved state** — each Smart List has its own saved column order/visibility (confirmed by GIF: different lists show different column sets). The "Columns" dropdown controls this per-list.

Observed column sets per list:
- Active & Pending Clients: Name · Created · Stage · Last Visit (+ wider set above)
- Hot/Weekly: Name · Created · Stage · Source · Last Visit · Pages Viewed
- Warm/Bi-Weekly: Name · Agent · Created · Stage · Source · Last Visit
- Past Clients/Sphere: Name · Created · Stage · Source
- New Leads: No Call Attempt: Name · Created · Stage · Source · Last Visit
- Cold/Bi-Monthly: Name · Agent · Created · Stage · Source
- Old Leads: No Call Attempt: Name · Agent · Created · Stage · Source
- All People: Name (+ source sub-line) · Lead Score · Agent · Last Visit

Table header row: very light gray (`#f9fafb`), ~12 px, medium weight, gray text (`#6b7280`), uppercase or regular.
Table body: white background, ~40–48 px row height, 1 px bottom border (`#e5e7eb`).

Clicking a row navigates to the Person detail page (`/2/people/{personId}`). The detail header shows "Person N of {listTotal}" with a → arrow to advance to the next person without returning to the list.

### 2.7 Static vs. dynamic list distinction

**Critical architectural distinction observed in GIFs and screen analysis:**

| Type | Description | "Update List" button | Example lists |
|------|-------------|---------------------|---------------|
| Static | Contacts are manually curated; membership does not auto-update from filter rules | Absent | Active & Pending Clients ("A static list of the clients you are currently working with") |
| Dynamic / Pipeline | Filter criteria evaluated live; contacts flow in/out automatically; "Update List" triggers a manual re-evaluation | Present (↻ icon) | Hot/Weekly, Warm/Bi-Weekly, Cold/Bi-Monthly, Old Leads: No Call Attempt, New Leads: No Call Attempt, Past Clients/Sphere: Quarterly, all Neighborhood lists |

The description text for static lists explicitly says "static list." The `type` field (inferred: `static` | `pipeline`) controls whether the "Update List" button renders.

**Per FUB docs:** Smart Lists are described as "saved filter searches" that update automatically. The "Active & Pending Clients" static designation is an edge case — it appears to be a manually managed roster, not a filter-driven list.

### 2.8 Right filter panel (persistent right sidebar)

**The filter panel is a persistent right sidebar (~200 px wide), NOT a modal or flyout.** It is always visible when viewing a Smart List. It does not close when switching between lists — it repopulates with the new list's filters.

```
┌────────────────────────────────┐
│ [Add a filter           🔍]    │  ← search/picker input
│                                │
│ ┌──────────────────────────┐   │
│ │ 🏷 Tags exclude any of:  │   │  ← active filter pill (collapsed)
│ │    complianc...         ▼│   │
│ └──────────────────────────┘   │
│                                │
│ ┌──────────────────────────┐   │
│ │ ≡ Stage includes any of: │   │
│ │    Active Cl...         ▼│   │
│ └──────────────────────────┘   │
│                                │
│          Clear filters         │  ← gray text link
└────────────────────────────────┘
```

**Empty state** (when no filters, e.g. on All People view):
- Sliders/settings icon graphic (centered, ~32 px)
- Text: "No filters added yet" (~14 px, gray)

**"Add a filter" input:** clicking opens a field/attribute picker to add a new filter condition. Available filter fields include all fields documented in the Filter Type Registry (§2.9 below).

**Active filter rows:** each row shows:
- Icon (tag icon 🏷 for Tags, lines icon ≡ for Stage, clock for date fields, etc.)
- Summary text (truncated with "..." if long)
- Expand chevron ▼ (right side)
- Clicking the row or ▼ expands the filter editor in-place

**Expanded Tags filter (fully observed from GIF):**
```
Tags exclude any of: complianc...   ▲
  ○ are not empty
  ○ include any
  ● exclude any              ← selected
    [compliance:hard-stop ×] [tcpa:litigator ×] [Bounced ×]
    [contact:do-not-email ×] [Unsubscribed ×]
    [do_not_text ×] [NOTEXT ×]
    [+] (add more values)
  ○ are empty
```
Tags filter has 4 modes: are not empty / include any / exclude any / are empty.

**Expanded Stage filter (fully observed from GIF):**
```
Stage includes any of: Active Clie...   ▲
  ● include              ← selected radio
    [Active Client ×] [Pending ×]
    [+] add value
  ○ exclude
```

**"Clear filters" link:** plain text, centered, bottom of panel. Removes all active filter conditions.

Multiple filter rows can be expanded simultaneously (accordion, no collapse-on-open restriction).

Filter conditions combine with **AND logic** (all conditions must match simultaneously).

### 2.9 Filter type registry (complete observed set)

| Filter field | Field key | Modes / operators | Value type |
|---|---|---|---|
| Tags | `tags` | are not empty / include any / exclude any / are empty | tag strings (colon-namespaced, e.g. `compliance:hard-stop`) |
| Stage | `stage` | include any of / exclude any of | stage label strings |
| Last Text Sent | `lastTextSent` | more than N days ago | integer (days) |
| Last Sent Email | `lastSentEmail` | more than N days ago | integer (days) |
| Last Call | `lastCall` | more than N days ago / is empty | integer (days) |
| Phone | `phone` | is good (boolean) | n/a |
| Created | `createdAt` | less than N days ago / more than N days ago | integer (days) |
| Source | `source` | excludes any of | source label strings |

**Additional filter fields (per FUB docs — 50+ total filterable fields):**

Details: First Name, Last Name, Phone (good/bad/empty), Email (good/bad/empty), Address, Price, Tags, Stage, Source, Created, Updated, Inactive, My Next Task, Last Activity, Last Communication, Timeframe (0–3 Months / 3–6 Months / 6–12 Months / 12+ Months / No Plans), My Agent Status.

Assigned: Agent, Pond, Lender, Collaborators.

Emails: Last Email, Last Sent Email, Last Received Email, Last Sent Batch Email, Last Sent Action Plan Email, Last Sent Marketing Campaign, Emails Sent, Emails Received, Last Email Activity (opens + clicks).

Calls: Last Call, Last Call Made, Last Call Received, Calls Made, Calls Received, Time to First Call, Talk Time.

Texts: Last Text, Last Text Sent, Last Text Received, Texts Sent, Texts Received.

Website Activity: Properties Viewed, Properties Saved, Pages Viewed (excludes property address pages), Last Visit, Visits.

Deals: Deal Stage, Deal Close Date, Deal Price.

Inbox Apps: Last Inbox App Message, Last Sent Inbox App Message, Last Received Inbox App Message, Last Marketing Message Reply, Inbox App Messages Sent, Inbox App Messages Received.

Custom Fields: filterable by type — text (contains/empty/not empty), date (date range, upcoming), number (< / > / between), dropdown (include/exclude values).

**Critical filter semantics (per FUB docs):**
- **Last Communication** = two-way direct comms only (calls, manual emails, texts, Inbox App). Does NOT include Action Plan emails, Batch emails, or marketing emails.
- **Last Activity** = lead-initiated signals only (site visits, inquiries, IDX activity). Agent actions do NOT update this.
- **Inactive** = broadest: ANY profile touch (agent + lead, automated + manual). Least useful for "did I speak to this person?"
- **Pages Viewed** = site pages only; excludes property address pages.
- **Phone / Email "is good"** = a FUB-internal deliverability/validity flag per number/address, not just a display field — must be queryable.

### 2.10 Empty state

When filter conditions produce zero results:

```
       [⋯ people silhouette icon, gray, ~60 px ⋯]
    No people match filters, try another search
```

- Centered vertically in the table body area
- Table column headers remain visible above the empty state
- "No people found" still shows in the bulk action bar (with ghosted icon buttons)

### 2.11 Per-list filter definitions (Ryan Realty observed lists)

The compliance tag exclusion filter (`Tags exclude any of: compliance:hard-stop, tcpa:litigator, Bounced, contact:do-not-email, Unsubscribed, do_not_text, NOTEXT`) is present as **Filter 1 on every Pipeline smart list** — it is the global compliance gate. All pipeline cadence lists follow a 5-filter pattern:

```
Filter 1: Tags exclude any of: [compliance block tags]
Filter 2: Last Text Sent more than N days ago
Filter 3: Last Sent Email more than N days ago
Filter 4: Last Call more than N days ago
Filter 5: Stage includes any of: [stage values for this tier]
```

The "No Call Attempt" lists replace filters 2–3 with activity-based checks:

```
Filter 2: Last Call is empty  (or: Last Call is empty)
Filter 3: Phone is good
Filter 4: Created less/more than 14 days ago
Filter 5: Stage includes any of: Lead
```

Per-list filter definitions observed:

| List | Filter details |
|------|---------------|
| **Active & Pending Clients** | Tags exclude compliance block tags; Stage includes: Active Client, Pending. (Static list — 2 filters only.) |
| **Hot/Weekly** | Tags exclude compliance; Last Text Sent > 7 days; Last Sent Email > 7 days; Last Call > 7 days; Stage includes: A - Hot 1-3 Months |
| **Warm/Bi-Weekly** | Tags exclude compliance; Last Text Sent > 14 days; Last Sent Email > 14 days; Last Call > 14 days; Stage includes: B - Warm [stage] |
| **Past Clients/Sphere: Quarterly** | Tags exclude compliance; Last Text Sent > 90 days (inferred); Last Sent Email > 90 days (inferred); Last Call > 90 days (inferred); Stage includes: Past Client, Sphere |
| **New Leads: No Call Attempt** | Tags exclude compliance; Source excludes [certain sources]; Last Call is empty; Phone is good; Created less than 14 days ago; Stage includes: Lead |
| **Cold/Bi-Monthly** | Tags exclude compliance; Last Text Sent > 60 days; Last Sent Email > 60 days; Last Call > 60 days; Stage includes: C - Cold 6+ Months |
| **Old Leads: No Call Attempt** | Tags exclude compliance; Last Call is empty; Phone is good; Created more than 14 days ago; Stage includes: Lead |

### 2.12 FUB default Smart List definitions (per FUB docs)

FUB ships every new account with these pre-configured lists:

| List Name | Filter Criteria | Recommended cadence |
|-----------|----------------|---------------------|
| New Leads | Stage = Lead AND Created < 10 days ago AND Last Communication > 12 hours ago | Daily contact; book appointment |
| Hot Leads (Active) | Stage = Hot Prospect AND Last Communication > 3 days ago | Every 2–3 days |
| Nurture | Stage = Nurture AND Last Communication > 3 days ago | Keep top-of-mind |
| Past Clients / SOI | Stage = Past Client OR Sphere AND Last Communication > 90 days ago | Quarterly |
| Old Leads | Stage = Lead AND Created > 10 days ago | Re-categorise into correct stage |
| Hot Leads (Recent Activity) | Recent website activity: new inquiry OR IDX event | Immediate |

### 2.13 Acceptance criteria — Smart List view

1. Header renders emoji, list name, type badge ("PIPELINE"), "Edit" link, and description with More/Less toggle
2. "Update List" button appears only on dynamic lists; absent on static lists
3. Bulk action bar shows precise count ("Showing N people") or "No people found" at 0 results
4. Toolbar renders: "How Smart Lists work" link, Columns dropdown, agent scope ("Me ▼") dropdown, Filters (N) button
5. Filter panel is a persistent right sidebar (not a modal/flyout); repopulates on list switch; stays open; shows empty state on All People
6. Filter panel "Add a filter" opens a field picker; each filter row is individually expandable
7. Tags filter renders 4-mode radio (are not empty / include any / exclude any / are empty) with multi-value tag chips + "+" add + "×" per chip
8. Stage filter renders include/exclude radio + multi-value stage chips
9. "Clear filters" removes all conditions
10. Filters (N) badge count equals the number of active filter conditions
11. Column set is per-list saved state; "Columns" chooser modifies only the current list's columns
12. Table headers remain visible in empty state; empty illustration renders below them
13. Clicking a row navigates to Person detail; detail header shows "Person N of {listTotal}" with → advance
14. Skeleton loading renders immediately on list navigation; replaced by data when resolved

---

## 3. Manage Lists & Collections Page (`/2/people/manage-lists`)

### 3.1 Purpose and navigation

Accessed via the "Manage" link pinned to the bottom of the left rail. This is the admin surface for creating, editing, sharing, ordering, and deleting Smart Lists and Collections. URL: `ryan-realty.followupboss.com/2/people/manage-lists`.

### 3.2 Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Top Nav Bar (full width, dark charcoal, ~48 px, fixed)                   │
├────────────────────┬─────────────────────────────────────────────────────┤
│ Left Rail          │ Main Content Area (scrollable)                       │
│ (~190–200 px)      │                                                      │
│ (same sidebar tree │ [Manage]                                             │
│ as list view;      │ Manage Lists & Collections                           │
│ "Manage" item      │                                                      │
│ active/highlighted │ [Custom Lists (35)] [Best Practice Lists (21)]       │
│ at bottom)         │                                  [Actions ▾]         │
│                    │                          [ⓘ How Collections work]   │
│                    │ ▼ Collections                                        │
│                    │   ┌─ Pipeline ──────────────── [Only Me] [Total 7K] │
│                    │   │ [table rows with drag handles]                   │
│                    │   └──────────────────────────────────────────────── │
│                    │   ┌─ Neighborhoods ────────── [Only Me] [Total 12K] │
│                    │   │ [table rows with drag handles]                   │
│                    │   └──────────────────────────────────────────────── │
└────────────────────┴─────────────────────────────────────────────────────┘
```

Left rail on this screen: same tree structure as list view but with the dark charcoal background (unified with top nav). "Manage" item at the bottom has solid blue fill (`#3B82F6`) + white text (active state).

### 3.3 Page header

```
🔧 Manage                        ← wrench/gear icon + large heading (~24 px, bold)
Manage Lists & Collections       ← subtitle (~20 px, semibold)
```

Top-right of content area (right-aligned, inline with heading):
- **"Custom Lists (35)"** — outlined/ghost pill button, active/selected state
- **"Best Practice Lists (21)"** — outlined/ghost pill button, inactive state
- **"Actions ▾"** — solid blue button, primary CTA, dropdown chevron; opens actions menu

**Prior-spec error corrected:** The prior spec (§6.8) stated "Custom Lists: 148" — this is wrong (low-res OCR artifact). The verified value from high-resolution screenshots is `Custom Lists (35)` (35 custom lists in Ryan Realty's account). The "148" count appears nowhere in the verified screenshots.

### 3.4 Tab toggle

Two mutually exclusive pill buttons:

| Tab | Count | Content |
|-----|-------|---------|
| Custom Lists | 35 | User-created Smart Lists and Collections (current view) |
| Best Practice Lists | 21 | FUB-provided template Smart Lists (read-only catalog; "Add to my lists" per row) |

Active tab: white background, darker text, or underline indicator.
Inactive tab: lighter/gray text.
Switching tabs is client-side (no page reload).

### 3.5 "Actions ▾" dropdown button

Blue filled button with dropdown chevron. When clicked, opens a dropdown with options including (inferred from context and FUB docs):
- Create new list / New Smart List
- Create new collection / New Collection
- (Possibly: Import lists, Assign Collections — per plan)

### 3.6 "ⓘ How Collections work" link

Text link with question-mark/info circle prefix. Opens a help article or explainer modal about Collections. Positioned below the tab toggle, left-aligned relative to the content section.

### 3.7 Collections accordion

A collapsible section labeled "Collections" with a ▼ expand/collapse chevron (currently expanded). Inside are the named collection sub-sections.

### 3.8 Per-collection sub-section

Each named collection (e.g. "Pipeline", "Neighborhoods") renders as a sub-section with:

**Sub-section header bar:**
```
Pipeline                  [👁 Only Me]  [👥 Total]  [7K]  [...]  [^]
```

| Control | Detail |
|---------|--------|
| Collection name | Bold, ~16 px, dark gray |
| "Only Me" toggle | Eye-with-slash icon + "Only Me" text; when active, Totals column shows only contacts assigned to the current user; when inactive (default), shows all contacts |
| "Total [NK]" badge | People icon + "Total" label + circle badge showing deduplicated aggregate contact count across all lists in this collection (7K for Pipeline, 12K for Neighborhoods) |
| "..." overflow menu | Collection-level actions (rename, add list, delete) |
| "^" collapse chevron | Collapses this sub-section independently |

**Collection total note:** The Pipeline total (7K) is NOT the sum of individual list counts (8+2+0+18+0+44+6 714 = 6 786); it is the deduplicated union of unique contacts across all lists. A contact appearing in multiple lists is counted once at the collection level.

### 3.9 Per-collection table

Column headers (same for all collections):

| Column | Alignment | Content |
|--------|-----------|---------|
| (drag handle) | leftmost, no label | ⠿ six-dot grip icon |
| Name | left, widest | List name (bold, ~14 px) + description excerpt on second line (gray, ~13 px, truncated with ellipsis) |
| Totals | center | Circle/oval badge — gray outline border, dark text; no fill. Blank when 0. Comma-formatted integers (6,714; 3,291). |
| Created | left | Creator avatar circle (~24 px) + name text ("Matt Ryan") |
| Shared | left | Blue hyperlink text ("Shared with everyone" or "Shared") — clicking opens sharing modal |
| Actions | right | "⋯" three-dot overflow menu button |

**Pipeline table rows (exact data):**

| # | Emoji | Name | Description excerpt | Totals | Created | Shared |
|---|-------|------|---------------------|--------|---------|--------|
| 1 | 😎 | Active & Pending Clients | "A static list of the clients you are currently working with. This smart list displays everyone in current (active/signed) and pending (under contr..." | 8 | Matt Ryan | Shared with everyone |
| 2 | 🔥 | Hot/Weekly | "Contacts in your hot stage(s) - this smart list reminds you to reach out to these leads at least once every 7 days. Requires a manual call, text,..." | 2 | Matt Ryan | Shared with everyone |
| 3 | 🌡️ | Warm/Bi-Weekly | "Contacts in your warm stage(s) - this smart list reminds you to reach out to these leads at least once every 14 days. Requir..." | (blank — 0) | Matt Ryan | Shared with everyone |
| 4 | 😊 | Past Clients/Sphere: Quarterly | "Contacts in your past client and sphere stages - this smart list reminds you to reach out to these contacts at least once ev..." | 18 | Matt Ryan | Shared with everyone |
| 5 | 🚨 | New Leads: No Call Attempt | "New leads (added to FUB within the past 14 days) with a valid phone number and no logged phone call." | (blank — 0) | Matt Ryan | Shared with everyone |
| 6 | ❄️ | Cold/Bi-Monthly | "Contacts in your cold stage(s) - this smart list reminds you to reach out to these leads at least once every 60 days. Requires a manual call, tex..." | 44 | Matt Ryan | Shared with everyone |
| 7 | 😊 | Old Leads: No Call Attempt | "14+ day-old leads with a valid phone number and no logged phone call." | 6,714 | Matt Ryan | Shared with everyone |

**Sharing status distinction (rows 1–3 vs. 4–7):** Rows 1–3 show "Shared" (sharing limited to specific agents); rows 4–7 show "Shared with everyone" (all team members). Both are blue hyperlink text; "Shared" (without "with everyone") implies partial/specific sharing.

**Neighborhoods table rows (partial — 5 visible, more below fold):**

| # | Name | Totals | Created | Shared |
|---|------|--------|---------|--------|
| 1 | Tetherow | 696 | Matt Ryan | Shared with everyone |
| 2 | Sunriver | 436 | Matt Ryan | Shared with everyone |
| 3 | Pronghorn | 13 | Matt Ryan | Shared with everyone |
| 4 | Black Butte Ranch | 4 | Matt Ryan | Shared with everyone |
| 5 | Northwest Crossing | 3,291 | Matt Ryan | Shared with everyone |

Neighborhood rows do **not** show a description excerpt (description column appears blank for these rows — they were created without free-text descriptions).

### 3.10 Row-level "⋯" actions menu

Clicking the "⋯" on any row opens a floating dropdown (white, rounded ~8 px, subtle drop shadow):

```
✏️  Edit Smart List
⧉   Duplicate Smart List
📁  Move to Collection
🗑   Delete Smart List
```

| Item | Icon | Behavior |
|------|------|----------|
| Edit Smart List | Pencil | Opens the Edit Smart List modal (same as Save New Smart List modal, pre-populated) |
| Duplicate Smart List | Copy/duplicate | Opens the Save New Smart List modal pre-populated with "Copy Of {original name}" and the original description; filter criteria are copied |
| Move to Collection | Folder/arrow | Opens the Move Smart List modal |
| Delete Smart List | Trash | Opens a confirmation dialog; deletes the saved filter only — all contacts remain in the CRM |

The dropdown is absolutely positioned below the "⋯" button, overlapping adjacent cells.

### 3.11 Drag-and-drop reorder

Each table row has a six-dot grip icon (`⠿`, light gray) on the far left. This enables drag-and-drop reordering within a collection. The reorder:
- Is constrained to within the same collection (cross-collection drag is not supported; use Move to Collection instead)
- Persists server-side as a `sort_order` integer on each Smart List record
- Is reflected immediately in the left rail sidebar navigation order
- Cursor changes to grab cursor on hover over the drag handle (inferred)

### 3.12 "Shared with everyone" / "Shared" link

Clicking the blue sharing text in the Shared column opens a sharing/permissions panel or modal where the user can modify visibility:
- **Shared with everyone** → all current and future team members
- **Shared** → specific named agents
- **Only Me** → private, creator-only

### 3.13 Floating help button

Fixed position, bottom-right corner of the viewport: circular blue button (~40 px diameter), white "?" glyph. Opens in-app help widget (support chat or documentation overlay).

### 3.14 "Best Practice Lists" tab (inferred behavior, per FUB docs)

When clicked, shows FUB's 21 pre-built Smart List templates. Each has an "Add to my lists" / "Copy" action per row. Once added, the list moves to Custom Lists and the Custom Lists count increments. Best Practice Lists cannot be directly deleted from this tab — only their copies in Custom Lists can be deleted.

FUB ships three best-practice libraries (per FUB docs): Default Smart Lists (6), Gabe Cordova's Smart Lists (8), Ryan Melville Method (tag-frequency system), and FUB + Ylopo Best Practice Lists (9). Access via People > Manage > Best Practice Lists > Actions > Copy.

### 3.15 Acceptance criteria — Manage Lists & Collections page

1. Page renders at `/2/people/manage-lists` with heading "Manage Lists & Collections"
2. Tab toggle shows "Custom Lists (N)" and "Best Practice Lists (N)" with correct counts
3. "Actions ▾" dropdown opens with create options
4. Collections accordion is expandable/collapsible (entire section)
5. Each collection sub-section renders with: header (name + "Only Me" toggle + Total badge + "..." + "^"), table with columns (drag handle | Name+description | Totals | Created | Shared | Actions)
6. Drag handles enable within-collection reordering; sort_order persists to the server; left rail reflects new order
7. "Only Me" toggle filters Totals column to current-user contacts
8. Collection total badge is deduplicated union count (not raw sum of list totals)
9. "⋯" row menu shows all four actions: Edit Smart List, Duplicate Smart List, Move to Collection, Delete Smart List
10. Clicking "Shared with everyone" / "Shared" opens the sharing modal
11. Clicking a list name navigates to that list's People view
12. Description text in table truncates with ellipsis on a single line
13. Totals badge renders blank (no badge) when count is 0; renders with comma-formatted integer when > 0
14. Left rail counts and Totals column counts match exactly

---

## 4. Save New Smart List Modal

### 4.1 Trigger

This modal opens from:
- "Actions ▾" → "New Smart List" (fields empty)
- "⋯" row menu → "Duplicate Smart List" (fields pre-populated with "Copy Of {original name}" + copied description)
- "Edit" link in the Smart List view header (same modal, titled "Edit Smart List", all fields pre-populated)

URL does not change when the modal opens (it overlays the current page).

### 4.2 Layout

Centered overlay modal (~480 px wide, white background, ~8–10 px border radius, drop shadow). Semi-transparent dark scrim (`rgba(0,0,0,0.5)`) covers the entire page behind the modal.

### 4.3 Modal header

```
Save New Smart List                    ×
```
- Title: left-aligned, ~18–20 px, font-weight 600 (semibold), dark near-black
- Close button (×): top-right corner, ~16 px gray glyph; clicking closes without saving

### 4.4 Name field

```
Name   Required
[🤩] [🗑]  [Copy Of Active & Pending Clients_________________]
```

| Element | Detail |
|---------|--------|
| Label | "Name" — gray, medium weight, ~13–14 px |
| "Required" | Inline text (not a red asterisk) next to the label, lighter gray |
| Emoji picker button | Shows the currently selected emoji (e.g. 🤩 star-eyes); clicking opens an emoji picker panel to choose/change the list's emoji prefix |
| Trash icon button | Adjacent to the emoji picker; clears the selected emoji |
| Text input | Full width (minus the two buttons); current value pre-populated (e.g. "Copy Of Active & Pending Clients"); required field — validation fires on Save if empty |

**Emoji storage:** stored as a prefix character in the list name field or as a separate `emoji` column; renders in the left rail, in the page header, and in the Manage table.

### 4.5 Description field

```
Description
[B] [I] [U] [•] [1.] [🔗] [😊] [T×]    ← rich-text toolbar
┌─────────────────────────────────────────────────┐
│ A static list of the clients you are currently  │
│ working with. This smart list displays everyone │
│ in current (active/signed) and pending (under   │
│ contract) stages.                               │
│                                                 ↘ resize handle
└───────────────────────────────────────────────┘
                                          173/1000
```

| Element | Detail |
|---------|--------|
| Label | "Description" — no required indicator |
| Rich-text toolbar (8 buttons) | B (bold), I (italic), U (underline), • (unordered list), 1. (ordered list), 🔗 (insert link), 😊 (insert emoji), T× (clear formatting) |
| Textarea | Multi-line contenteditable / rich-text area; resizable via drag handle (bottom-right corner) |
| Character counter | `173/1000` — bottom-right below textarea, small gray text (`#9ca3af`); updates on every keypress |
| Max length | **1 000 characters** |

**Prior-spec error corrected:** The prior spec (§6.8 and §5.16) stated the description limit was "~250 char." The exact verified value from the character counter visible in the screenshot is `173/1000` — the limit is **1 000 characters**, not 250.

### 4.6 Share smart list with section

```
Share smart list with
[🔍 Search for agents or teams...                    ]

  ☐  Share with everyone

  AGENTS
  ☐  Matt Ryan
  ☐  Paul Stevenson
  ☐  Rebecca Peterson

  This smart list is private
```

| Element | Detail |
|---------|--------|
| Section label | "Share smart list with" — gray, medium weight |
| Search input | Placeholder "Search for agents or teams..."; magnifying glass icon; full width; filters the agents list in real time; teams would also appear if configured |
| "Share with everyone" checkbox | Unchecked by default; checking shares with all current + future users; likely auto-checks/disables individual agent checkboxes |
| "AGENTS" section header | All-caps, ~11 px, muted gray, light gray background row — separates the "everyone" option from individual agents |
| Agent checkboxes (3 rows) | Matt Ryan / Paul Stevenson / Rebecca Peterson; all unchecked by default; each checkbox toggles visibility for that specific agent |
| Privacy notice | "This smart list is private" — small, muted gray, below the agent list; dynamic: appears when all checkboxes are unchecked; changes when agents are selected |

**In the Edit Smart List modal variant (from GIF):**
When editing an existing list that is already shared, the agent checkboxes are **checked** (blue checkboxes for all 3 brokers). A "Deselect all agents and make this smart list private" link appears as a blue destructive action link below the agent rows.

**Sharing permission rules (per FUB docs):**
- Smart Lists created by Agents cannot be shared with the team — only Admin-created lists can be shared
- Sharing a list does NOT change lead visibility — an agent's existing access level determines which contacts within the list they can see
- Admins see all contacts; Agents see only their assigned/collaborator/pond contacts

### 4.7 Modal footer

```
Learn more about filters and smart lists.          [Cancel]  [Save List]
```

| Element | Detail |
|---------|--------|
| "Learn more about filters and smart lists." | Blue underlined text link, left-aligned; opens FUB help docs |
| "Cancel" button | Outlined / ghost style; pill-shaped (~20 px border radius); white background; closes modal without saving |
| "Save List" button | Solid blue primary button; pill-shaped; creates the new Smart List (or saves edits); validates Name is non-empty first |

**Edit Smart List modal footer variant (from GIF):**
Adds a "🗑 Delete" button on the far left of the footer (danger/destructive action), with "Cancel" and "Save List" on the right.

```
[🗑 Delete]                              [Cancel]  [Save List]
```

### 4.8 Save behavior

On "Save List":
1. Validate: Name must be non-empty (required)
2. Create SmartList record with: name (with emoji prefix), description (rich HTML), sharing settings, creator user ID
3. Filter criteria: for a duplicate, the source list's filter criteria are copied. For a new list, no criteria are set at creation — the user must return to the People view and use the filter panel to define criteria, then save them to the list
4. Modal closes; new list appears in left rail and Manage page

**Architectural note (per FUB docs):** Editing filter criteria for an existing Smart List requires navigating to the People page and using the filter panel — this CANNOT be done from the Manage Lists screen or from this modal. The Edit modal only handles name, emoji, description, and sharing. This is an intentional UX pattern in FUB; our in-house implementation should replicate or explicitly deviate.

### 4.9 Keyboard behavior (inferred)

- `Escape` closes the modal without saving
- `Tab` cycles through fields: Name → Description → Search agents → Checkboxes → Cancel → Save List
- `Enter` in Name field may submit (inferred)

### 4.10 Acceptance criteria — Save New Smart List modal

1. Modal opens centered with dark scrim; closes on × or Cancel without saving
2. Name field is required; "Required" indicator is text (not asterisk); validation fires on Save if empty
3. Emoji picker button opens an emoji chooser; selected emoji renders in the button; trash icon clears it
4. Description textarea supports rich-text via 8-button toolbar; character counter shows `N/1000` updating on each keypress; max 1 000 characters
5. Description textarea is resizable via drag handle
6. "Search for agents or teams..." input filters agent/team list in real time
7. "Share with everyone" checkbox + individual agent checkboxes (Matt Ryan, Paul Stevenson, Rebecca Peterson)
8. Privacy notice "This smart list is private" shows when all agent checkboxes are unchecked; updates dynamically as selection changes
9. Edit variant: all agent checkboxes pre-checked when list is already shared; "Deselect all agents and make this smart list private" link appears
10. Edit variant: Delete button appears at footer left (danger style)
11. "Learn more about filters and smart lists." opens help docs
12. Save creates/updates the Smart List; list appears in left rail and Manage page; modal closes

---

## 5. Move Smart List Modal

### 5.1 Trigger

Opened from the "⋯" row actions menu → "Move to Collection" on any Smart List row in the Manage Lists page.

### 5.2 Layout

Centered overlay modal (~380–420 px wide, white background, ~8–10 px border radius, drop shadow). Same scrim as Save New Smart List modal.

### 5.3 Modal content

```
Move Smart List                        ×

Move "🤩Active & Pending Clients" to the following collection:

[Select collection...              ▾]
  ┌──────────────────────────────────────┐
  │ + New Collection                     │
  │ ≡ Smart Lists                        │
  │ COLLECTIONS                          │
  │   Neighborhoods                      │
  └──────────────────────────────────────┘

                              [Cancel]  [Move]
```

| Element | Detail |
|---------|--------|
| Modal title | "Move Smart List" — left-aligned, ~18 px, bold |
| Body text | `Move "{emoji}{listName}" to the following collection:` — the smart list name is bolded/emphasized within the sentence; the emoji prefix appears as the first character of the quoted name |
| Dropdown trigger | Labeled "Select collection..."; full modal width; chevron ▾ on right; light gray background input |
| "+" New Collection (first dropdown option) | "+" plus icon + label; clicking creates a new collection inline — opens a text input within the modal for the collection name, then moves the list into it in a single action |
| "≡ Smart Lists" (second dropdown option) | Three-line hamburger icon + label; represents the root/uncategorized Smart Lists group; selecting this removes the list from any named collection (`collection_id = null`) |
| "COLLECTIONS" section divider | All-caps, ~11 px, muted gray, non-interactive |
| Named collection options | E.g. "Neighborhoods"; no icon prefix; one per user-created collection |
| Cancel button | Outlined; secondary; closes modal, no change |
| Move button | Solid primary blue; disabled until a collection is selected; executes the move |

**Observed dropdown state:** The dropdown panel was observed in its open/expanded state with: (1) "+ New Collection", (2) "≡ Smart Lists", (3) "COLLECTIONS" header, (4) "Neighborhoods". Only one user-created collection ("Neighborhoods") exists in the observed account, confirming the dropdown always shows + New Collection and Smart Lists as built-in options plus all user-created collections.

**"New Collection" flow:** selecting this option should NOT immediately move the list. It transforms the modal to show a text input for the new collection name. After the user names it and confirms, the system: (1) creates the Collection record, (2) assigns the Smart List to it. This is likely a two-API-call sequence or a single compound endpoint.

**Semantics:** `collection_id = null` on a Smart List means it lives in the root "Smart Lists" group. Moving to "Smart Lists" via this modal sets `collection_id = null`.

**One-collection-per-list rule (per FUB docs):** A Smart List can only belong to one Collection at a time. To place a list in two Collections, it must be duplicated; both copies are maintained separately.

### 5.4 Acceptance criteria — Move Smart List modal

1. Modal opens with the correct list name (including emoji) quoted in the body text
2. Dropdown shows "+ New Collection" first, "≡ Smart Lists" second, then all user-created collections in a "COLLECTIONS" group
3. "+ New Collection" triggers an inline name-entry step; collection is created and list is moved in one operation
4. "Smart Lists" option sets `collection_id = null`; list appears at root level in left rail
5. "Move" button is disabled until a selection is made; active after selection
6. On confirm: list moves to the selected collection; Manage page updates immediately; left rail sidebar reflects new position
7. Cancel and × close without changes
8. Keyboard: arrow keys navigate dropdown; Enter selects; Escape closes dropdown (then modal if dropdown was already closed)

---

## 6. Data Model

### 6.1 Entities and fields

```typescript
interface SmartList {
  id: string;                        // internal ID (e.g., "25" for Active & Pending Clients)
  name: string;                      // includes emoji prefix as first character (e.g., "😎 Active & Pending Clients")
  emoji?: string;                    // emoji prefix stored separately (optional — may be embedded in name)
  description: string;               // rich HTML, max 1,000 characters
  list_type: 'static' | 'pipeline'; // 'static' = manually managed; 'pipeline' = filter-driven
  is_best_practice: boolean;         // true = FUB template (Best Practice Lists tab)
  filter_criteria: SmartListFilter[]; // AND-combined filter predicates
  columns: string[];                 // ordered list of visible column keys for this list
  collection_id: string | null;      // null = root "Smart Lists" group
  created_by_user_id: string;        // FK → User
  sharing_scope: 'private' | 'shared_specific' | 'shared_everyone';
  shared_agent_ids: string[];        // populated when sharing_scope = 'shared_specific'
  sort_order: number;                // for drag-and-drop reorder within collection
  count_cache: number;               // cached member count; stale by up to 10 min
  count_updated_at: Date;
}

interface SmartListFilter {
  type: 'tags' | 'stage' | 'recency' | 'data_quality' | 'source' | 'created' | string;
  field: string;                     // e.g. 'tags', 'stage', 'lastCall', 'phone', 'source'
  mode: 'include_any' | 'include_all' | 'exclude_any' | 'exclude_all' |
        'is_empty' | 'is_not_empty' | 'is_good' | 'is_bad' |
        'less_than' | 'more_than' | 'contains' | 'starts_with' | 'between';
  values?: string[];                 // tag values, stage names, source names
  threshold?: { value: number; unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years' };
}

interface Collection {
  id: string;
  name: string;                      // e.g., "Pipeline", "Neighborhoods"
  emoji?: string;                    // optional emoji in collection name
  sort_order: number;
  created_by_user_id: string;
  total_count_cache: number;         // deduplicated union count across all member lists
  // smart_lists: SmartList[]        // resolved via FK on SmartList.collection_id
}

interface User {
  id: string;
  name: string;                      // "Matt Ryan", "Paul Stevenson", "Rebecca Peterson"
  avatar_url?: string;
  role: 'owner' | 'admin' | 'agent' | 'lender';
}
```

### 6.2 Key relationships

- **Collection → SmartList**: one-to-many (one Collection contains many SmartLists; one SmartList belongs to one Collection or null)
- **SmartList → User (creator)**: many-to-one
- **SmartList ↔ User (sharing)**: many-to-many (a list is shared with multiple agents)
- **SmartList → Contact (membership)**: computed at query time from `filter_criteria` (not a stored join table for dynamic lists; static lists may have an explicit membership table)

### 6.3 Count caching model

Per FUB docs, counts refresh on a 10-minute polling cycle (not real-time). Implementation options:
- **Polling model (FUB parity):** background job recomputes counts every 10 minutes; immediate recompute on list click, create, or filter-save
- **Real-time model (above FUB parity):** WebSocket or SSE push when contact data changes; sidebar count updates immediately. This exceeds FUB's bar — viable but higher infrastructure cost.

In either case, the `count_cache` column on SmartList is the displayed value; queries for display never run live count queries at render time.

### 6.4 Permission-filtered query model (per FUB docs)

The same Smart List must return different contact sets per user role:
- **Owner / Admin**: all contacts in the account that match the filter criteria
- **Agent / Lender**: only contacts where they are the assigned agent, a collaborator, or in a Pond they belong to

This role filter is applied at the DAL layer, never bypassed. The `sharing_scope` controls whether the list appears in a user's sidebar; the role filter controls what they see within it.

---

## 7. Design System Mapping

This is an internal admin tool. All UI maps to the Ryan Realty design system (`navy #102742` / `cream #faf8f4`, Geist + Amboqia, shadcn/ui `@/components/ui/*`). FUB's blue/teal palette (`#3b82f6`) maps to our `--primary` token.

| FUB element | Ryan Realty implementation |
|-------------|---------------------------|
| Dark charcoal left rail | `bg-primary` (`#102742` navy) with `text-primary-foreground` |
| Light gray left rail (list views) | `bg-muted` |
| Active sidebar item (blue highlight) | `bg-primary/10 text-primary font-medium` |
| Blue filled CTA button ("Actions ▾", "Save List") | `<Button variant="default">` from `@/components/ui/button` |
| Outlined/ghost button ("Custom Lists", "Cancel") | `<Button variant="outline">` |
| "Shared with everyone" blue link text | `<a className="text-primary underline-offset-4 hover:underline">` |
| Drag handle (⠿) | `<GripVertical className="text-muted-foreground">` from lucide-react |
| Three-dot menu (⋯) | `<DropdownMenu>` from `@/components/ui/dropdown-menu` |
| Totals circle badge | `<Badge variant="outline">` from `@/components/ui/badge` |
| Filter panel persistent right sidebar | `<Sheet side="right">` or a persistent `<aside>` panel (not a floating sheet if it must stay open) |
| Modal overlay | `<Dialog>` from `@/components/ui/dialog` |
| Checkboxes (agent sharing) | `<Checkbox>` from `@/components/ui/checkbox` |
| Search inputs | `<Input>` from `@/components/ui/input` |
| Rich-text description editor | TipTap or Quill editor component |
| Collection dropdown (Move modal) | `<Select>` from `@/components/ui/select` with grouped options |
| Table | `<Table>` from `@/components/ui/table` |
| Skeleton loading | `<Skeleton>` from `@/components/ui/skeleton` |
| Emoji picker | third-party emoji-picker component (emoji-mart or similar) |

Display headings ("Manage Lists & Collections") use Amboqia via the `<H1>` / `<H2>` primitives in `components/site/primitives`. Body text and table content use Geist.

---

## 8. Cross-References

- **People list view and contact table columns**: `06-people.md` §6.1
- **Column chooser flyout and filter field picker (Columns button)**: `06-people.md` §6.4
- **Bulk actions (mass actions) detail**: `06-people.md` §6.5
- **Export modal**: `06-people.md` §6.7
- **Person detail (contact record)**: `07-person-detail.md`
- **Stage enum values (16 stages)**: `07-person-detail.md` §7.4
- **TCPA compliance tag handling**: `reference_tcpa_litigator_handling.md` (memory) and `06a` §2.11
- **FUB sharing with all brokers (Shared column UI walkthrough)**: `reference_fub_smart_list_sharing.md` (memory)

---

## Sources

| Source | Content used |
|--------|-------------|
| **shot-51.md** | Left rail full hierarchy with all counts, Smart List view header ("Active & Pending Clients"), PIPELINE badge, filter panel with 2 active filters, table columns, empty state, badge count discrepancy (8 in rail vs 0 in view due to segment layer) |
| **shot-61.md** | Manage Lists page full layout, Custom Lists (35) tab, left rail SMART LISTS section with 11 standalone lists, Pipeline table all 7 rows with exact counts and descriptions, Neighborhoods table 5 rows, collection totals (7K / 12K), "Best Practice Lists (21)" tab |
| **shot-62.md** | Manage Lists page second analysis confirming all row data, "⋯" dropdown open on row 1 (4 items: Edit / Duplicate / Move to Collection / Delete), exact Totals badge values, sharing status "Shared" vs "Shared with everyone" distinction, emoji list for Pipeline items |
| **shot-63.md** | Save New Smart List modal — complete transcription: Name field (emoji picker, trash, "Required" text), Description (rich-text 8-button toolbar, exact character count 173/1000, max 1000), Share section (search input, "Share with everyone" checkbox, AGENTS header, 3 agent checkboxes, "This smart list is private" notice), footer (help link, Cancel, Save List buttons), modal triggered by Duplicate action (prefilled "Copy Of Active & Pending Clients") |
| **shot-64.md** | Move Smart List modal — title "Move Smart List", body text with emoji in list name (🤩Active & Pending Clients), Select dropdown in open state showing: + New Collection / ≡ Smart Lists / COLLECTIONS header / Neighborhoods, "Getting Started" bar at bottom of left rail visible |
| **fub-analysis-gif/people.md** | Dynamic behaviors: list switching replaces table + repopulates filter panel, All People clears filter panel to empty state, skeleton loading on navigation, "Me" dropdown full structure (Everyone / Me / PONDS / TEAM MEMBERS sections with avatars), Columns chooser is right-panel flyout (not floating dropdown), "+ New List" appears only on All People, "Update List" appears only on smart lists, filter badge count "(N)" in toolbar button, person detail layout transitions |
| **fub-analysis-gif/smartlists.md** | Complete per-list filter definitions for all 7 Pipeline lists (exact filter labels from filter panel), Edit Smart List modal full transcription (all 3 agent checkboxes checked, "Deselect all agents" link, Delete button in footer), static vs dynamic distinction for Active & Pending Clients, per-list column configuration confirmed, sidebar count rendering rules (0 → no badge), compliance tag taxonomy (compliance:hard-stop / tcpa:litigator / Bounced / contact:do-not-email / Unsubscribed / do_not_text / NOTEXT), filter panel is persistent right sidebar not a flyout |
| **fub-docs/smart-lists.md** | All filter fields and operators (50+ fields across 9 sections), 6 default Smart Lists with exact filter definitions, 3 copyable best-practice libraries (Gabe Cordova / Ryan Melville / Ylopo), Smart List count update schedule (10-min polling), sharing permission model (agent vs admin visibility), Mass Actions 10 operations and bypass-automations rule, export permission model, Collections creation/edit/delete rules, Assign Smart List Collections Power-Up (Pro/Platform only), filter semantic distinctions (Last Communication vs Last Activity vs Inactive), one-collection-per-list rule, sharing gotcha (agents cannot share lists; admin-only), count stale window (10 min by design) |
| **FUB_CRM_FEATURE_SPEC.md §6.2, §6.3, §6.8, §5.16** | Prior spec used as baseline; errors corrected: Pipeline list names (OCR corruption → verified names), description char limit (~250 → 1000), Custom Lists count (148 → 35), Neighborhoods Pronghorn count (21/29 → 13), table columns on Manage page (Description column is second line under Name, not a separate column), "Dismiss" button label → "Cancel" |
