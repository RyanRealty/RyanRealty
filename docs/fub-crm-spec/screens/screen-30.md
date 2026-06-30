<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.26.34 AM.png | Sequential id: shot-30 | Tiles: fub-tiles/shot-30_{full,q1,q2,q3,q4}.png -->

# shot-30 — Deals / Pipeline Kanban Board (Buyers View)

## Identity

- **Visible URL:** `ryan-realty.followupboss.com/2/deals/1`
- **Browser tab title:** "Deal Tracking"
- **Top-nav active item:** "Deals" (shield/tag icon, text underlined or highlighted)
- **Sub-nav active tab:** "Buyers" (underlined in blue, left-most of two tabs)
- **Second sub-nav tab:** "Sellers" (inactive, no underline)
- **Gear/settings icon:** small cog icon immediately to the right of "Sellers" tab — pipeline configuration
- **Breadcrumbs:** None visible; URL path `/2/deals/1` implies pipeline ID = 1
- **Logged-in user:** Visible from avatar cluster in top-right of nav bar — circular photo avatars for multiple team members; account = "Ryan Realty" (visible in bookmark bar)
- **Account/brokerage name:** Ryan Realty (visible in browser bookmark bar as "Ryan Realty" favicon entry)

---

## Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CHROME BROWSER BAR (tab: "Deal Tracking", URL bar)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  TOP NAV BAR (dark charcoal, ~44px tall, fixed)                             │
│  [≡] People  Inbox  Tasks  Calendar  [Deals]  Reporting  Admin  [Search]   │
│                                                          [avatar cluster]    │
├─────────────────────────────────────────────────────────────────────────────┤
│  PIPELINE SUB-BAR (~40px, white/light, fixed)                               │
│  [Buyers (active)]  [Sellers]  [⚙]        [?How Deals work] [Deal         │
│                                            Reporting] [Current deals ▾]    │
│                                            [Everyone ▾]                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  KANBAN BOARD (horizontally scrollable, fills remaining height)             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ...  │
│  │ Start (temp  │ │Buyer Contract│ │    Offer     │ │   Pending    │       │
│  │    stage)    │ │              │ │              │ │              │       │
│  │ [empty]      │ │ [empty]      │ │ [empty]      │ │ [deal card]  │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│  (scroll right →)  Closed column (6 deals), Lost column (2 deals)           │
│                                                                              │
│                                              [+ Add a stage] (far right)    │
├─────────────────────────────────────────────────────────────────────────────┤
│  BOTTOM OF PAGE: horizontal scrollbar (board is wider than viewport)        │
│  Bottom-right: [?] help bubble (teal circle)                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Proportions:**
- Top nav bar: ~44px, full width, fixed, dark background
- Pipeline sub-bar: ~40px, full width, white/light gray background, fixed
- Kanban board: fills 100% remaining height; each column ~195–210px wide; columns are fixed-width, board scrolls horizontally; columns scroll vertically if content overflows
- Column count visible: 6 (Start, Buyer Contract, Offer, Pending, Closed, Lost) + partial "Add a stage" button to the right

**Fixed vs scrolling:**
- Top nav bar: fixed
- Pipeline sub-bar (Buyers/Sellers tabs + toolbar): fixed
- Kanban board: horizontally scrollable as a whole; each column independently vertically scrollable
- "Closed" column has a visible scrollbar (5+ deal cards visible, more below fold per q4 tile showing cards continuing)

---

## Every UI Element (exhaustive)

### Top Navigation Bar (dark charcoal background)

| Element | Type | Value / State |
|---|---|---|
| Hamburger/home icon | icon button | Stacked-lines icon (≡), far left — likely collapses left rail or goes to home |
| People | nav link | "People" with person/silhouette icon; inactive |
| Inbox | nav link | "Inbox" with notification bell or inbox tray icon; has an orange dot/badge (notification indicator) |
| Tasks | nav link | "Tasks" with checklist icon; inactive |
| Calendar | nav link | "Calendar" with calendar icon; inactive |
| Deals | nav link | "Deals" with shield/tag icon; **ACTIVE** (highlighted/underlined in blue-green) |
| Reporting | nav link | "Reporting" with chart/bar icon; inactive |
| Admin | nav link | "Admin" with wrench/settings icon; inactive |
| Search | search input | Placeholder: "Search"; pill-shaped input, light background, ~200px wide |
| Avatar cluster | user avatars | 4–5 circular photo avatars of team members, right-aligned; clicking opens user switcher or profile [INFERRED] |
| Notification bell | icon button | Bell icon, top-right area adjacent to avatars |

### Pipeline Sub-Bar

#### Left side — pipeline tabs

| Element | Type | Value / State |
|---|---|---|
| Buyers | tab | Text "Buyers"; **ACTIVE** — underlined with blue (#1890FF or similar) border-bottom |
| Sellers | tab | Text "Sellers"; inactive — no underline |
| ⚙ (gear icon) | icon button | Small gray cog/gear icon to the right of "Sellers" tab; opens pipeline configuration settings [INFERRED] |

#### Right side — toolbar controls

| Element | Type | Value / State |
|---|---|---|
| ? How Deals work | link/button | Blue question-mark circle icon + text "How Deals work"; light blue/teal pill background; opens an explainer modal or help overlay [INFERRED] |
| Deal Reporting | button | Text "Deal Reporting"; icon (bar chart to the left of text); outlined/ghost style button; navigates to a Deals reporting sub-page [INFERRED] |
| Current deals | dropdown button | Text "Current deals"; chevron-down ▾; blue/teal background with white text; filters the board to show only current (non-archived) deals. Clicking likely reveals options: "Current deals" / "All deals" / "Archived deals" [INFERRED] |
| Everyone | dropdown button | Text "Everyone"; chevron-down ▾; light gray/white background; filters the board by assigned agent. Clicking reveals team member list to scope by agent [INFERRED] |

---

### Kanban Board Columns

Each column has a consistent anatomy:
1. **Colored accent bar** — full-width horizontal bar at the very top of the column (~4–6px tall), color varies by stage
2. **Column header row** — stage name (medium weight, dark gray) + deal count + total value + blue `+` add button
3. **Deal cards** — white rounded-corner cards stacked vertically with ~8px gap
4. **Empty state** — "No deals, add deal" with "add deal" as a blue hyperlink

#### Column 1 — Start (temp stage)

| Field | Value |
|---|---|
| Accent bar color | Orange/amber (~#F6A623) |
| Stage name | "Start (temp stage)" |
| Deal count | "0 deals" |
| Total value | "$0" (green) |
| Add button | Blue circle with white `+`, right of header row |
| Content | Empty state: "No deals, add deal" — "add deal" is a blue hyperlink |

#### Column 2 — Buyer Contract

| Field | Value |
|---|---|
| Accent bar color | Orange/amber (~#F6A623) — same shade as Start |
| Stage name | "Buyer Contract" |
| Deal count | "0 deals" |
| Total value | "$0" (green) |
| Add button | Blue circle with white `+` |
| Content | Empty state: "No deals, add deal" |

#### Column 3 — Offer

| Field | Value |
|---|---|
| Accent bar color | Blue/periwinkle (~#4A90D9) |
| Stage name | "Offer" |
| Deal count | "0 deals" |
| Total value | "$0" (green) |
| Add button | Blue circle with white `+` |
| Content | Empty state: "No deals, add deal" |

#### Column 4 — Pending

| Field | Value |
|---|---|
| Accent bar color | Yellow/gold (~#F5C518 or #F2C94C) |
| Stage name | "Pending" |
| Deal count | "1 deal" |
| Total value | "$735,000" (green) |
| Add button | Blue circle with white `+` |

**Deal card — 19571 SW Simpson Ave:**

| Sub-element | Value |
|---|---|
| Address/title | "19571 SW Simpson Ave" (dark gray, medium weight, ~14px) |
| Sale price | "$735,000" (green, bold) |
| Commission icon | Small gray money/bill icon (looks like stacked bills or a calculator icon) |
| Commission amount | "$9,187" (gray/muted, ~12px) |
| Date label | "Projected Close Date: March 20th 2026" (gray, ~11px) |
| Avatar 1 | Initials circle "TM" — muted salmon/pink fill, white text |
| Avatar 2 | Photo avatar — circular headshot photo (appears to be Rebecca or a female agent) |

#### Column 5 — Closed

| Field | Value |
|---|---|
| Accent bar color | Green (~#4CAF50 or #27AE60) |
| Stage name | "Closed" |
| Deal count | "6 deals" |
| Total value | "$4,515,000" (green) + badge "Closed" (small green text or chip) |
| Add button | Blue circle with white `+` |

**Deal card 1 — 2732 NW Ordway:**

| Sub-element | Value |
|---|---|
| Address | "2732 NW Ordway" |
| Sale price | "$880,000" (green, bold) |
| Commission icon | Small money/bill icon |
| Commission amount | "$22,000" (gray) |
| Date label | "Close Date: June 9th 2025" |
| Avatar 1 | Initials circle "SG" — muted olive/sage green fill |
| Avatar 2 | Photo avatar — circular headshot (male agent, appears to be Matt or Paul) |

**Deal card 2 — 61271 Kwinnum Dr:**

| Sub-element | Value |
|---|---|
| Address | "61271 Kwinnum Dr" |
| Sale price | "$750,000" (green, bold) |
| Commission icon | Money/bill icon |
| Commission amount | "$16,875" (gray) |
| Date label | "Close Date: August 27th 2025" |
| Avatar 1 | Initials circle "LK" — steel/slate gray fill, white text |
| Avatar 2 | Initials circle "KK" — gray fill, white text |
| Avatar 3 | Photo avatar — circular headshot (female) |

**Deal card 3 — 703 SW 7th:**

| Sub-element | Value |
|---|---|
| Address | "703 SW 7th" |
| Sale price | "$355,000" (green, bold) |
| Commission icon | Money/bill icon |
| Commission amount | "$8,875" (gray) |
| Date label | "Close Date: September 30th 2025" |
| Avatar 1 | Initials circle "TC" — muted salmon/coral fill, white text |
| Avatar 2 | Photo avatar — circular headshot (older male agent) |

**Deal card 4 — 2680 Nordic Ave:**

| Sub-element | Value |
|---|---|
| Address | "2680 Nordic Ave" |
| Sale price | "$1,350,000" (green, bold) |
| Commission icon | Money/bill icon |
| Commission amount | "$33,750" (gray) |
| Date label | "Close Date: October 10th 2025" |
| Avatar 1 | Initials circle "EU" — teal/green fill, white text |
| Avatar 2 | Initials circle "SU" — peach/salmon fill, white text |
| Avatar 3 | Photo avatar — circular headshot (female) |

**Deal card 5 — 3235 NW Cedar:**

| Sub-element | Value |
|---|---|
| Address | "3235 NW Cedar" |
| Sale price | "$530,000" (green, bold) |
| Commission icon | Money/bill icon |
| Commission amount | "$13,250" (gray) |
| Date label | "Close Date: July 14th 2025" |
| Avatar 1 | Initials circle "NC" — peach/salmon fill, white text |
| Avatar 2 | Initials circle "WC" — teal/green fill, white text |
| Avatar 3 | Photo avatar — circular headshot (older male agent) |

**Note:** The "Closed" column total shows "6 deals, $4,515,000" but only 5 cards are visible in the tiles — one more deal card exists but is scrolled out of view below fold. The column is independently vertically scrollable.

#### Column 6 — Lost

| Field | Value |
|---|---|
| Accent bar color | Red/coral (~#E53935 or #EB5757) |
| Stage name | "Lost" |
| Deal count | "2 deals" |
| Total value | "$1,925,000" (green) |
| Add button | Blue circle with white `+` |

**Deal card 1 — 2680 Nordic Ave (Lost):**

| Sub-element | Value |
|---|---|
| Address | "2680 Nordic Ave" |
| Sale price | "$1,425,000" (green, bold) |
| Commission icon | Money/bill icon |
| Commission amount | "$35,625" (gray) |
| Avatar 1 | Initials circle "EU" — teal/green fill |
| Avatar 2 | Initials circle "SU" — peach/salmon fill |
| Avatar 3 | Photo avatar — circular headshot (female) |

**Deal card 2 — 61260 Sunflower Ln:**

| Sub-element | Value |
|---|---|
| Address | "61260 Sunflower Ln" |
| Sale price | "$500,000" (green, bold) |
| Date label | "Projected Close Date: February 26th 2026" (gray) |
| Avatar 1 | Initials circle "NC" — peach/salmon fill |
| Avatar 2 | Photo avatar — circular headshot (female) |

**Note:** "2680 Nordic Ave" appears in BOTH the Closed column (at $1,350,000) and the Lost column (at $1,425,000) — these may be the same property at different stages/pipelines, or a duplicate deal, or two separate transactions for the same address.

#### "Add a stage" — rightmost element

- Text link: "Add a sta..." (truncated in viewport) — full text: "Add a stage"
- Blue hyperlink style
- Positioned to the right of the Lost column, outside a column container
- Allows user to add a new pipeline stage/column [INFERRED]

---

### Footer / Bottom Bar

| Element | Value |
|---|---|
| Horizontal scrollbar | Full-width gray scrollbar at very bottom of page — indicates board is wider than viewport |
| Help button | Teal/cyan circle with white `?` (question mark), bottom-right corner, fixed position |
| Getting Started progress bar | NOT visible in this screenshot — may be absent or already completed for this account |

---

## Colors, Typography & Style

### Color palette

| Element | Estimated hex | Notes |
|---|---|---|
| Top nav background | ~#2D3436 or #1E2A38 | Dark charcoal, nearly black |
| Top nav text/icons | #FFFFFF | White |
| Active nav item accent | ~#00BFA5 or #17A2B8 | Teal underline/highlight on "Deals" |
| Page background | ~#F5F6FA or #F0F2F5 | Very light gray/off-white |
| Column background | #FFFFFF | White (slightly off-white column panels) |
| Column border/separator | ~#E8E8E8 or #EDEDED | Very light gray column dividers |
| Kanban board background | ~#F0F2F5 | Light gray gutters between columns |
| Stage accent — Start (temp stage) | ~#F6A623 | Orange/amber |
| Stage accent — Buyer Contract | ~#F6A623 | Orange/amber (same) |
| Stage accent — Offer | ~#4A90D9 | Blue |
| Stage accent — Pending | ~#F5C518 | Yellow/gold |
| Stage accent — Closed | ~#27AE60 or #4CAF50 | Green |
| Stage accent — Lost | ~#EB5757 or #E53935 | Red/coral |
| Deal price (green) | ~#27AE60 | Green — consistent across all cards |
| Commission amount | ~#8E8E8E or #AAAAAA | Gray/muted |
| Date text | ~#999999 | Light gray |
| Address text | ~#2C3E50 or #333333 | Dark gray, not pure black |
| "add deal" link | ~#1890FF | Blue hyperlink |
| "How Deals work" pill bg | ~#E8F4FD | Very light blue |
| "Current deals" button bg | ~#00BFA5 or #17A2B8 | Teal |
| Add (+) button | ~#00BFA5 or #1890FF | Teal/blue circle |
| Avatar initials — TM | salmon/pink fill (~#E07B54) | |
| Avatar initials — SG | olive/sage (~#6B8E6B) | |
| Avatar initials — LK | slate gray (~#7B8D9A) | |
| Avatar initials — KK | gray (~#909090) | |
| Avatar initials — TC | coral/salmon (~#C97B7B) | |
| Avatar initials — EU | teal (~#4A9A8A) | |
| Avatar initials — SU | peach (~#D4956A) | |
| Avatar initials — NC | peach (#D4956A) | |
| Avatar initials — WC | teal (~#4A9A8A) | |
| Help button | #00BFA5 (teal) | Bottom-right circle |

### Typography

- **Nav items:** ~13px, medium weight (500), white on dark
- **Column stage name:** ~14–15px, medium-bold (600), dark gray
- **Deal count + total:** ~12px, regular (400), gray ("0 deals  $0")
- **Deal card address:** ~13–14px, medium (500), dark gray; the primary identity of the card
- **Sale price:** ~13–14px, bold (700), green
- **Commission amount:** ~12px, regular (400), gray; smaller than price
- **Date text:** ~11–12px, regular (400), light gray
- **Empty state text:** ~13px, regular, gray ("No deals, add deal")
- **Tab text (Buyers/Sellers):** ~13–14px, medium (500)
- **Toolbar buttons:** ~13px, regular/medium

### Style

- **Card border radius:** ~6–8px rounded corners on deal cards
- **Card shadow:** Very subtle box-shadow (1–2px, light gray) on deal cards; cards appear slightly elevated above column background
- **Column border:** Very faint 1px border or shadow at column edges
- **Density:** Medium — cards have ~12–16px internal padding; ~8px gap between cards
- **Iconography:** Simple line icons in nav; money/bill icon on cards is a small 2-tone gray glyph (~12px); avatar initials circles ~28–32px diameter
- **No Getting Started progress bar visible** at the bottom of the screen (either completed or not shown on this account)

---

## State & Data Shown

### Active filter state

- **Pipeline view:** "Buyers" pipeline (tab active)
- **Deal filter:** "Current deals" (active, shown in blue dropdown button)
- **Agent filter:** "Everyone" (all agents, not scoped to one broker)

### Counts and totals (column-level aggregates)

| Stage | Deal Count | Total Value | Notes |
|---|---|---|---|
| Start (temp stage) | 0 deals | $0 | Empty |
| Buyer Contract | 0 deals | $0 | Empty |
| Offer | 0 deals | $0 | Empty |
| Pending | 1 deal | $735,000 | One active card |
| Closed | 6 deals | $4,515,000 | "Closed" badge/label in header |
| Lost | 2 deals | $1,925,000 | |

**Grand total (buyer pipeline):** 9 deals, $6,440,000 total value (of which $4,515,000 is closed)

### Sample deal data (exact values from tiles)

| Address | Stage | Sale Price | Commission | Date | Date Type | Avatars |
|---|---|---|---|---|---|---|
| 19571 SW Simpson Ave | Pending | $735,000 | $9,187 | March 20th 2026 | Projected Close Date | TM + photo |
| 2732 NW Ordway | Closed | $880,000 | $22,000 | June 9th 2025 | Close Date | SG + photo |
| 61271 Kwinnum Dr | Closed | $750,000 | $16,875 | August 27th 2025 | Close Date | LK + KK + photo |
| 703 SW 7th | Closed | $355,000 | $8,875 | September 30th 2025 | Close Date | TC + photo |
| 2680 Nordic Ave | Closed | $1,350,000 | $33,750 | October 10th 2025 | Close Date | EU + SU + photo |
| 3235 NW Cedar | Closed | $530,000 | $13,250 | July 14th 2025 | Close Date | NC + WC + photo |
| 2680 Nordic Ave | Lost | $1,425,000 | $35,625 | (none shown) | — | EU + SU + photo |
| 61260 Sunflower Ln | Lost | $500,000 | (not shown) | February 26th 2026 | Projected Close Date | NC + photo |

### Commission pattern

Commission amounts relative to sale price suggest a ~2.5% commission rate:
- $880,000 × 2.5% = $22,000 ✓
- $750,000 × 2.25% = $16,875 ✓
- $1,350,000 × 2.5% = $33,750 ✓
- $530,000 × 2.5% = $13,250 ✓
- $355,000 × 2.5% = $8,875 ✓
- $735,000 × 1.25% = $9,187 (possibly a 1.25% side or split commission)

### Avatar model

Each deal card shows 1–3 avatars:
- **Initials avatars** (first 1–2) = likely the contact(s) / buyer(s) — initials are from people's names (TC = Travis C., LK = Lindsay K., etc.) [INFERRED based on FUB conventions]
- **Photo avatar** (last one, always a headshot) = the assigned agent/broker — always a professional headshot, suggesting it's a team member record [INFERRED]

---

## Interactions & Behaviors

| Element | Behavior |
|---|---|
| `+ (blue circle)` per column | Opens "Add Deal" modal for that specific stage [INFERRED] |
| Deal card (click anywhere) | Opens deal detail view / deal record page [INFERRED] |
| Deal card drag | Drag-and-drop between columns to move deal to a new stage [INFERRED — Kanban standard] |
| "add deal" hyperlink (empty state) | Same as + button — opens Add Deal modal [INFERRED] |
| "Buyers" tab | Switches to the Buyers pipeline; currently active |
| "Sellers" tab | Switches to a Sellers pipeline (separate column configuration) |
| ⚙ gear icon | Opens pipeline settings — configure stages, rename, reorder, add, delete [INFERRED] |
| "How Deals work" | Opens a help modal or tour explaining the Deals feature [INFERRED] |
| "Deal Reporting" | Navigates to a deals reporting / analytics subpage [INFERRED] |
| "Current deals ▾" | Dropdown: filter board to show "Current deals" / "All deals" / possibly "Won" / "Lost" / date range [INFERRED] |
| "Everyone ▾" | Dropdown: filter by specific team member (agent attribution) [INFERRED] |
| "Add a stage" (far right) | Opens a modal or inline form to add a new Kanban stage/column [INFERRED] |
| Column accent bar (colored top bar) | Purely visual stage-status indicator; no interaction [INFERRED] |
| Avatar (initials circle) | [INFERRED] Click opens the associated contact/person record in a new tab or panel |
| Avatar (photo / agent headshot) | [INFERRED] Click opens the agent's profile or filters to their deals |
| Horizontal scrollbar | Scroll the board horizontally to see more columns |
| Column body (vertical) | Each column scrolls independently if deals exceed visible height (Closed column demonstrates this) |
| ? help bubble (bottom-right) | Opens contextual help / support chat [INFERRED] |

---

## Data Model Signals

### Entities

**Deal** (core entity on this screen)
- `id` — internal deal ID
- `pipeline_id` — which pipeline (1 = Buyers in this URL)
- `stage_id` / `stage_name` — e.g. "Start (temp stage)", "Buyer Contract", "Offer", "Pending", "Closed", "Lost"
- `address` — property address string (e.g. "19571 SW Simpson Ave")
- `price` / `sale_price` — integer dollars (e.g. 735000)
- `commission_amount` — integer dollars (e.g. 9187)
- `close_date` — date field; null if not yet closed
- `projected_close_date` — date field; shown on open deals as "Projected Close Date"
- `close_date_type` — enum: "projected" (for pending/lost) vs "actual" (for closed)
- `created_at`, `updated_at` — timestamps
- `is_closed` — boolean or derived from stage
- `is_lost` — boolean or derived from stage

**Pipeline**
- `id` — 1 = Buyers (from URL `/deals/1`)
- `name` — "Buyers" or "Sellers"
- `stage_order` — ordered list of stages

**Stage**
- `id`
- `pipeline_id` — FK to Pipeline
- `name` — text (user-configurable, "(temp stage)" suffix suggests auto-created placeholder name)
- `color` — accent bar color per stage
- `position` — integer for column ordering
- `is_terminal_won` — boolean (Closed stage)
- `is_terminal_lost` — boolean (Lost stage)

**DealContact (junction)**
- `deal_id` — FK to Deal
- `person_id` — FK to Contact/Person (the buyer(s))
- `role` — "buyer", "seller", etc.

**DealAgent (junction)**
- `deal_id` — FK to Deal
- `agent_id` — FK to User/Broker
- `role` — "listing agent", "buyer agent", etc.

**Person / Contact**
- `id`
- `first_name`, `last_name` — used to generate initials (e.g. TC = Travis C., LK = Lindsay K.)
- `avatar_url` — headshot if available (contact avatars = initials circles; agent avatars = photos)

**User / Agent**
- `id`
- `name`
- `avatar_url` — photo headshot (the rightmost avatar on each card)

### Enum values

**Stage names (visible):** "Start (temp stage)", "Buyer Contract", "Offer", "Pending", "Closed", "Lost"

**Date types (visible):** "Projected Close Date", "Close Date"

**Pipeline names (visible):** "Buyers", "Sellers"

**Deal filter options (inferred from dropdown):** "Current deals", "All deals", possibly "Won", "Lost", archived

**Agent filter options (inferred):** "Everyone" (default), individual agent names

### Aggregate fields

- Column-level `deal_count` (integer)
- Column-level `total_value` (sum of `price` for deals in stage)
- "Closed" stage shows a special "Closed" chip/badge next to total value suggesting the label is explicitly rendered for terminal-won stages

---

## Rebuild Notes

### Component Breakdown

```tsx
<DealsPage>
  <TopNavBar activeItem="Deals" />

  <PipelineSubBar>
    <PipelineTabs>
      <PipelineTab id={1} label="Buyers" active={true} />
      <PipelineTab id={2} label="Sellers" active={false} />
      <PipelineSettingsButton />
    </PipelineTabs>
    <PipelineToolbar>
      <HowDealsWorkLink />
      <DealReportingButton />
      <CurrentDealsDropdown value="Current deals" />
      <AgentFilterDropdown value="Everyone" />
    </PipelineToolbar>
  </PipelineSubBar>

  <KanbanBoard pipelineId={1} horizontallyScrollable={true}>
    {stages.map(stage => (
      <KanbanColumn
        key={stage.id}
        stage={stage}
        accentColor={stage.color}     // orange | blue | yellow | green | red
        dealCount={stage.deal_count}
        totalValue={stage.total_value}
        isClosedStage={stage.is_terminal_won}
      >
        {stage.deals.length === 0
          ? <EmptyColumnState onAddDeal={() => openAddDealModal(stage.id)} />
          : stage.deals.map(deal => (
              <DealCard key={deal.id} deal={deal} />
            ))
        }
        <AddDealButton onClick={() => openAddDealModal(stage.id)} />
      </KanbanColumn>
    ))}
    <AddStageButton />
  </KanbanBoard>

  <HelpBubble />
</DealsPage>
```

```tsx
<KanbanColumn>
  {/* Colored accent bar — top of column, full width, ~5px height */}
  <div className="stage-accent-bar" style={{ backgroundColor: accentColor }} />

  {/* Column header */}
  <div className="column-header">
    <div className="stage-info">
      <span className="stage-name">{stage.name}</span>
      <span className="deal-meta">
        {stage.deal_count} {stage.deal_count === 1 ? 'deal' : 'deals'}
        &nbsp;
        <span className="total-value">${stage.total_value.toLocaleString()}</span>
        {stage.is_terminal_won && <span className="closed-badge">Closed</span>}
      </span>
    </div>
    <AddDealButton />
  </div>

  {/* Scrollable deal list */}
  <div className="deal-list">
    {/* deals or empty state */}
  </div>
</KanbanColumn>
```

```tsx
<DealCard deal={deal}>
  <div className="deal-address">{deal.address}</div>
  <div className="deal-financials">
    <span className="sale-price">${deal.price.toLocaleString()}</span>
    <CommissionIcon />
    <span className="commission">${deal.commission_amount.toLocaleString()}</span>
  </div>
  {deal.close_date && (
    <div className="deal-date">
      {deal.is_closed ? 'Close Date:' : 'Projected Close Date:'}
      {' '}{formatDate(deal.close_date)}
    </div>
  )}
  <div className="deal-avatars">
    {deal.contacts.map(c => <InitialsAvatar person={c} />)}
    {deal.agent && <PhotoAvatar user={deal.agent} />}
  </div>
</DealCard>
```

### Non-obvious logic

1. **Two pipelines share one URL pattern:** `/deals/1` = Buyers, `/deals/2` (or similar) = Sellers. The tab switching likely just changes the pipeline_id param without a full page reload.

2. **Stage accent color is per-stage configuration:** Each stage has a user-configurable color stored server-side. The colored bar is purely visual (no hover interaction).

3. **"(temp stage)" suffix:** The "Start (temp stage)" name suggests this is a default/auto-created stage that the user hasn't renamed yet. The system likely creates a default stage on pipeline creation and appends "(temp stage)" until renamed.

4. **Commission amount is separately stored:** It is NOT derived from sale price at render time — the values don't all follow the same percentage, confirming it's a stored field on the Deal record (user-entered or calculated and stored during deal creation).

5. **Avatar ordering convention:** Initials circles appear first (contacts/people), photo headshot appears last (the assigned agent). Multiple initials circles = multiple buyers on the same deal. The photo avatar is always the rightmost circle and always a headshot (distinguishing agents from contacts).

6. **Column total includes ALL deals in stage regardless of filter** — or only currently-filtered deals. "6 deals, $4,515,000" in Closed presumably counts only the 6 shown under the "Current deals + Everyone" filter.

7. **"Closed" badge in Closed column header:** The header renders `$4,515,000 Closed` — the word "Closed" is appended in smaller green text after the total, acting as a stage-type label rather than an action. Only terminal-won stages would show this.

8. **Drag-and-drop:** The Kanban board is almost certainly drag-and-drop enabled. Deal cards would be draggable between columns. Moving a card to "Closed" would set the close date; moving to "Lost" would prompt for a reason [INFERRED].

9. **"Add a stage" position:** This is rendered OUTSIDE and to the right of all column containers, acting as a board-level action rather than a column-level one. It would open a modal to name and configure a new stage.

10. **Horizontal scroll:** The columns are likely rendered in a flex-row with `overflow-x: auto` on the board container. Each column has a fixed min-width (~195–200px) with a small gap between.

11. **Independent column scroll:** Each column body has `overflow-y: auto` with `max-height` tied to the viewport height minus the nav bars. The Closed column is visibly taller than the viewport in the tiles, confirming this.

12. **"Closed" column total label:** The word "Closed" appears to be rendered differently — possibly a special badge/chip rendered inline after the dollar total only for terminal-won stages, or the stage name is appended as a label.

13. **Commission icon:** The glyph used next to commission amounts appears to be a stacked-bills or money-bag icon (~12px). It is not the FUB house icon — likely `💵` styled as an SVG or a font icon from an icon library (Heroicons, Font Awesome, etc.).
