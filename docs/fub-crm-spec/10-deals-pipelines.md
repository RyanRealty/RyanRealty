# Module: Deals — Buyer & Seller Pipelines (Kanban)

The Deals module is a dual-pipeline Kanban board that bridges the CRM's contact/lead tracking with transaction-level financial data. Its purpose is to give brokers a visual, drag-to-stage pipeline for every active buyer and seller opportunity — tracking property address, sale price, gross commission, key real-estate milestone dates, and the people attached to each deal — and to feed those records into commission reporting, agent goal tracking, and the Deals Leaderboard. In Ryan Realty's architecture, **Vault (the in-house TC system) is the system of record for executed transactions**; the CRM Deals module is the pre-close/active pipeline view (lead → contract → pending). Closed deals that have a recorded close date and an `is_closed_stage = true` stage flag drive commission reporting and the leaderboard; the underlying transaction files live in the TC module (see `19-tc-transaction-coordination.md`).

---

## 1. Page Identity & URL Pattern

| Property | Value |
|---|---|
| URL pattern | `/2/deals/{pipelineId}` |
| Buyers pipeline URL | `/2/deals/1` |
| Sellers pipeline URL | `/2/deals/2` |
| Browser tab title | "Deal Tracking" |
| Top-nav active item | "Deals" (shield/tag icon; active state = blue underline beneath label) |

Switching pipeline tabs (Buyers ↔ Sellers) changes only the `pipelineId` in the URL; it does not trigger a full page reload — the board swaps content client-side.

---

## 2. Overall Page Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  GLOBAL TOP NAV BAR  (dark charcoal ~#2d3748, ~48px tall, fixed)         │
│  [≡] People  Inbox  Tasks  Calendar  [Deals]  Reporting  Admin  [Search] │
│                             [agent avatars] [bell] [user avatar▾]         │
├──────────────────────────────────────────────────────────────────────────┤
│  PIPELINE SUB-BAR  (white bg, ~40px tall, fixed)                         │
│  [Buyers] [Sellers] [⚙]         [ℹ How Deals work] [Deal Reporting]     │
│                                 [Current deals ▾] [Everyone ▾]           │
├──────────────────────────────────────────────────────────────────────────┤
│  KANBAN BOARD CANVAS  (light gray bg ~#f5f6f7, fills remaining height)   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ...         │
│  │ Stage col  │ │ Stage col  │ │ Stage col  │ │ Stage col  │             │
│  │ (header)   │ │ (header)   │ │ (header)   │ │ (header)   │             │
│  │ [cards or  │ │ [empty]    │ │ [cards]    │ │ [cards]    │             │
│  │  empty]    │ │            │ │            │ │            │             │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘             │
│  (board scrolls horizontally →)           [+ Add a stage] at far right   │
├──────────────────────────────────────────────────────────────────────────┤
│  HORIZONTAL SCROLLBAR  (full-width, gray track, at very bottom)          │
│  FLOATING HELP BUTTON  (bottom-right, circle "?")                        │
└──────────────────────────────────────────────────────────────────────────┘
```

**Sizing and scroll behavior:**
- Top nav bar: fixed, ~48 px, full width
- Pipeline sub-bar: fixed, ~40 px, full width (does not scroll away)
- Kanban board canvas: fills remaining viewport height; scrolls **horizontally** as a unit; each individual column scrolls **vertically** independently when card count overflows
- Column width: ~195–240 px each, fixed; gap between columns ~8 px; rendered in a flex-row with `overflow-x: auto` on the board container
- No footer bar; no "Getting Started" progress bar visible on this screen

---

## 3. Global Top Nav Bar (dark background)

| Element | Type | State / Value |
|---|---|---|
| ≡ home / hamburger icon | icon button | Far left; likely collapses left rail or navigates home |
| People | nav link | Inactive |
| Inbox | nav link | Inactive; orange dot badge = unread notifications present |
| Tasks | nav link | Inactive |
| Calendar | nav link | Inactive |
| Deals | nav link | **ACTIVE** — bold label, short blue underline beneath; icon: shield or dollar-sign |
| Reporting | nav link | Inactive |
| Admin | nav link | Inactive |
| Search | pill input | Placeholder: "Search"; ~200 px wide; magnifying-glass icon |
| Agent avatar cluster | 4–5 colored circle avatars | Right area of nav; represent team members; clicking an avatar filters the board to that agent (synced with the "Everyone" dropdown) |
| Bell / notifications | icon button | Bell glyph; no badge count visible in observed screens |
| User avatar | circular photo, ~30 px | Logged-in user photo (Matt Ryan headshot observed); dropdown implied |

---

## 4. Pipeline Sub-Bar

### 4.1 Left side — pipeline type tabs

| Element | Type | Active state |
|---|---|---|
| Buyers | tab | Blue underline when active |
| Sellers | tab | Blue underline when active |
| ⚙ (gear icon) | icon button | Small gray cog; immediately right of "Sellers" tab; triggers **full-page navigation to Manage Pipelines settings** (NOT a modal) |

### 4.2 Right side — toolbar controls

| Element | Type | Value / Behavior |
|---|---|---|
| ℹ How Deals work | ghost button | Circle question-mark icon + text "How Deals work"; light blue/teal ghost pill; opens help explainer modal or overlay |
| Deal Reporting | ghost button | Bar-chart icon + text "Deal Reporting"; navigates to Reporting > Deals sub-tab |
| Current deals ▾ | dropdown button | White/teal bg; label shows active filter; options: **Current deals** / **Archived** / **All** (per FUB docs: "Current, Archived, All"); clicking reveals a dropdown menu |
| Everyone ▾ | dropdown button | Light gray bg; label shows "Everyone" (default) or a specific team member name; clicking reveals agent list; synced with the avatar cluster in the top nav |

**Agent visibility rules (per FUB docs):**
- Non-admin agents see only deals where they appear in `userIds` — even with "Everyone" selected, the board scopes to their own deals
- Admins and account owners see all deals and can filter by any user
- "Me ▾" (observed in the GIF) and "Everyone ▾" are the same dropdown — the label changes based on selection

---

## 5. Kanban Board — Buyers Pipeline (`/2/deals/1`)

### 5.1 Stage columns (left to right)

| # | Stage Name | Accent Color | FUB Default Notes |
|---|---|---|---|
| 1 | Start (temp stage) | Orange/amber ~`#f6a623` | Auto-created placeholder; users expected to rename; "(temp stage)" suffix indicates unrenamed default |
| 2 | Buyer Contract | Orange/amber ~`#f6a623` | "when contract signed" |
| 3 | Offer | Blue/periwinkle ~`#4a90d9` | "property offer made" |
| 4 | Pending | Yellow/gold ~`#f5c518` | "offer pending status" |
| 5 | Closed | Green ~`#27ae60` | "property closes"; **`is_closed_stage = true`** flag must be set; triggers leaderboard + commission reporting |
| 6 | Lost | Red/coral ~`#eb5757` | Terminal "lost" stage; no explicit "Lost" flag in API — archiving is the FUB best practice for lost deals; still appears as a named stage in the UI |

**"Add a stage" button:** Rendered to the right of the Lost column, outside any column container; blue hyperlink style, text "Add a stage"; triggers the add-stage flow.

### 5.2 Observed Buyers pipeline data (real Ryan Realty data from shot-30)

| Stage | Deal count | Total value |
|---|---|---|
| Start (temp stage) | 0 deals | $0 |
| Buyer Contract | 0 deals | $0 |
| Offer | 0 deals | $0 |
| Pending | 1 deal | $735,000 |
| Closed | 6 deals | $4,515,000 |
| Lost | 2 deals | $1,925,000 |

**Grand total:** 9 deals, $6,440,000

### 5.3 Observed Buyers deal cards (exact values from tiles)

| Address | Stage | Sale Price | Commission | Date field | Date label | Avatars |
|---|---|---|---|---|---|---|
| 19571 SW Simpson Ave | Pending | $735,000 | $9,187 | March 20th 2026 | Projected Close Date | TM (salmon), photo agent |
| 2732 NW Ordway | Closed | $880,000 | $22,000 | June 9th 2025 | Close Date | SG (olive), photo agent |
| 61271 Kwinnum Dr | Closed | $750,000 | $16,875 | August 27th 2025 | Close Date | LK (slate), KK (gray), photo agent |
| 703 SW 7th | Closed | $355,000 | $8,875 | September 30th 2025 | Close Date | TC (coral), photo agent |
| 2680 Nordic Ave | Closed | $1,350,000 | $33,750 | October 10th 2025 | Close Date | EU (teal), SU (peach), photo agent |
| 3235 NW Cedar | Closed | $530,000 | $13,250 | July 14th 2025 | Close Date | NC (peach), WC (teal), photo agent |
| 3480 SW 45th Street | Closed | $650,000 | $16,300 | August 14th 2025 | Close Date | CM (gray), photo agent (from GIF) |
| 2680 Nordic Ave | Lost | $1,425,000 | $35,625 | (none shown) | — | EU (teal), SU (peach), photo agent |
| 61260 Sunflower Ln | Lost | $500,000 | $0 | February 26th 2026 | Projected Close Date | NC (peach), photo agent |

**Notes:**
- "2680 Nordic Ave" appears in both Closed ($1,350,000) and Lost ($1,425,000) — two separate deals at the same address, different prices; this is valid (one closed earlier, a relisting went lost at a different price)
- The Closed column header renders: `6 deals  $4,515,000  Closed` — the word "Closed" appended in small green text after the dollar total is a visual terminal-stage badge, not a separate UI pill
- The 6th Closed card (3480 SW 45th Street) is scrolled below fold; the column is independently vertically scrollable

---

## 6. Kanban Board — Sellers Pipeline (`/2/deals/2`)

### 6.1 Stage columns (left to right)

| # | Stage Name | Accent Color | FUB Default Notes |
|---|---|---|---|
| 1 | Start (temp stage) | Gold/amber ~`#f5a623` | Same auto-created placeholder as Buyers |
| 2 | Pre-Listing | Blue-purple/indigo ~`#5c6bc0` | Pre-listing activity stage |
| 3 | Listed | Salmon/coral ~`#ef8c6c` | "property listed" |
| 4 | Offer | Purple/lavender ~`#9c6bc0` | "offer received" |
| 5 | Pending | Teal/green-blue ~`#26a69a` | "offer pending" |
| 6 | Closed | Green ~`#66bb6a` | "property closes"; `is_closed_stage = true` |
| 7 | Lost / Terminated | Red/coral-red ~`#ef5350` | Terminal lost/canceled stage; NOT named "Lost" alone — exact label is "Lost / Terminated" |

**Prior spec error corrected:** The prior spec listed this as "Lost/Terminated" (forward-slash no spaces). The exact visible label is **"Lost / Terminated"** (spaces on both sides of slash). This matters for any UI label or DB enum value.

### 6.2 Observed Sellers pipeline data (real Ryan Realty data from shot-31)

| Stage | Deal count | Total value |
|---|---|---|
| Start (temp stage) | 0 deals | $0 |
| Pre-Listing | 0 deals | $0 |
| Listed | 1 deal | $2,635,000 |
| Offer | 0 deals | $0 |
| Pending | 0 deals | $0 |
| Closed | 9 deals | $7,934,000 |
| Lost / Terminated | 1 deal | $899,900 |

**Grand total:** 11 deals, ~$11,469,900

### 6.3 Observed Sellers deal cards (exact values from tiles)

| Address | Stage | Sale Price | Commission | Close Date | Avatars |
|---|---|---|---|---|---|
| 56628 Sunstone Loop | Listed | $2,635,000 | $10,000 | (none — not closed) | SR (salmon), SR (salmon, same initials 2nd person), photo agent |
| 20401 Penhollow | Closed | $639,000 | $14,378 | July 30th 2025 | TN (teal), GN (green), photo agent |
| 1050 NE Butler Market #2 | Closed | $299,000 | $1,000 | June 13th 2025 | TC (rose), photo agent |
| 54474 Huntington Rd | Closed | $580,000 | $10,200 | January 8th 2025 | EF (olive), HF (beige), photo agent |
| 534 Crowson Rd | Closed | $1,050,000 | $10,500 | April 30th 2025 | MH (slate), photo contact, photo agent |
| 17130 Mayfield Dr | Closed | $769,000 | $15,100 | October 29th 2025 | 3 photo avatars (contact + agent) |
| 363 Sw Bluff Dr #208 | Lost / Terminated | $899,900 | ~$22,400+ (truncated) | (none shown) | 2 photo avatars |

**Note on 9 Closed deals:** Only 5 cards were visible above the fold in shot-31; 4 more exist scrolled below the fold (the Closed column's own vertical scrollbar is visible).

**Note on commission icon:** In the **Sellers** pipeline cards, the field prefix icon is a **house/building glyph** (🏠-like, gray ~14 px). In the **Buyers** pipeline cards, the field prefix icon is a **stacked-bills/money icon** (gray ~12 px). The icon is a custom FUB SVG glyph from their icon library — implement as a named SVG icon in `@/components/ui/`.

---

## 7. Column Anatomy (per-stage column — exhaustive)

Every stage column shares this exact structure:

```
┌──────────────────────────────────────────────┐
│ ACCENT BAR  (full-width, ~5px tall, stage color)      │
├──────────────────────────────────────────────┤
│ COLUMN HEADER ROW                            │
│  [Stage Name]        [● blue + circle ~24px] │
│  [N deals  $X,XXX,XXX  (Closed badge?)]      │
├──────────────────────────────────────────────┤
│ CARD AREA  (vertically scrollable if overflow)│
│  [DealCard]                                  │
│  [DealCard]                                  │
│  ...                                         │
│  — OR —                                      │
│  [Empty state: "No deals, add deal"]         │
└──────────────────────────────────────────────┘
```

### Column header fields

| Element | Details |
|---|---|
| Accent bar | 4–6 px horizontal colored bar at very top of column; background color = stage-assigned color; spans full column width; no hover interaction |
| Stage name | Bold, ~14–15 px, dark gray (`#212121`), font-weight 600 |
| Deal count | `{N} deal` (singular) or `{N} deals` (plural), gray, ~12 px |
| Total value | `$X,XXX,XXX` in green (~`#43a047`), bold, inline with deal count; reads as `"6 deals  $4,515,000"` |
| Closed badge | Only on the terminal-won stage (Closed): the word `Closed` appended in small green text after the total dollar value, inline on the same row; e.g. `"9 deals  $7,934,000  Closed"` |
| `+` button | Solid blue circle (~22–24 px diameter, white `+` glyph); right-aligned in the header row; clicking triggers **Add Deal** flow pre-scoped to this stage |

### Empty state

When a stage has 0 deals, the card area shows:
- Gray text: `"No deals,"`
- Immediately followed by teal/blue hyperlink: `"add deal"` (`#1976d2`)
- Full reading: `"No deals, add deal"`
- Clicking `"add deal"` link triggers the same Add Deal flow as the `+` button

---

## 8. Deal Card Anatomy (exhaustive)

Each deal card is a white rounded-rectangle (`border-radius: ~8px`) with a subtle border (`rgba(0,0,0,0.08)`) and slight box-shadow; ~195–220 px wide, variable height; internal padding ~12–16 px; gap between cards ~8 px.

```
┌──────────────────────────────────────────────┐
│  [Property Address / Deal Name]              │
│  $XXX,XXX (green)  [icon]  $XX,XXX (gray)   │
│  Close Date: Month Dth YYYY  (or empty)      │
│  [○ initials] [○ initials] [● photo]         │
└──────────────────────────────────────────────┘
```

### Card field details

| Row | Element | Spec |
|---|---|---|
| Row 1 | Property address / deal name | The primary deal identifier (address string); ~13–14 px; font-weight 600; dark gray (`#2d3748`); text-overflow: ellipsis for long addresses; includes unit suffix if applicable (e.g., `#208`, `#2`) |
| Row 2 | Sale price | Green (`#43a047`), ~13 px, bold (700); format: `$X,XXX,XXX` — whole dollars, no cents, with locale commas |
| Row 2 | Commission icon | Buyers pipeline: stacked-bills/money SVG icon (~12 px, gray); Sellers pipeline: house/building SVG icon (~14 px, gray); sits between price and commission amount |
| Row 2 | Commission amount | Gray (`#757575`), ~12 px, regular weight; format: `$XX,XXX` (whole dollars); this is the **gross commission** (`commissionValue` field), a stored amount, NOT computed from price at render time |
| Row 3 | Date row | Gray (`#9e9e9e`), ~11–12 px; conditionally rendered: hidden if no date set; label prefix changes by deal state: `"Close Date:"` on deals in the Closed stage, `"Projected Close Date:"` on deals in other stages (Pending, Listed, Lost); date format: `Month Dth YYYY` (ordinal suffix, e.g., `"July 30th 2025"`, `"March 20th 2026"` — no comma between day and year) |
| Row 4 | Avatar cluster | Horizontal cluster of circles (~22–28 px each); initials circles appear first (1–3 contacts), photo headshot circle appears last (the assigned agent/broker); agent avatar is always the rightmost |

### Avatar sub-types

| Avatar type | Appearance | Represents |
|---|---|---|
| Initials circle | 2 uppercase letters; unique deterministic background color per contact (hash from contact ID); white text | Contact/person linked to the deal (buyers or sellers) |
| Photo avatar | Circular crop, no border; actual headshot | Assigned broker/agent (always last in cluster) |
| Multiple initials | When 2+ contacts on a deal, all appear left of the agent photo | E.g., co-buyers, husband+wife sellers |

**Color seeding for initials:** Background color is deterministic per contact (not random per session) — derive from a hash of `contact.id`. Same contact always gets the same color across all cards and pages.

**Prior spec error corrected:** The prior spec described commission as "arrow + $". There is **no arrow**. The commission field uses a **house icon (Sellers) or money/bills icon (Buyers)** before the gray dollar amount. No arrows appear on deal cards.

---

## 9. Manage Pipelines Settings Page

**Trigger:** Clicking the ⚙ gear icon in the Deals sub-nav.

**Navigation type:** This is a **full-page navigation** (not a modal) — the Kanban board is replaced entirely by the settings page. The URL likely changes to `/deals/settings/pipelines` or similar.

**Page layout:**

```
Manage Pipelines                              [+ Add Pipeline]
ℹ How Deal Pipelines work

┌───────────────────────────────────────────────────────────────┐
│  Pipeline Name                          Actions               │
│  ⠿  Buyers                             [✏ edit] [🗑 delete]  │
│  ⠿  Sellers                            [✏ edit] [🗑 delete]  │
└───────────────────────────────────────────────────────────────┘
```

### Pipeline settings elements

| Element | Details |
|---|---|
| Page heading | "Manage Pipelines" (H1-level) |
| Info link | "ℹ How Deal Pipelines work" — opens help overlay |
| `+ Add Pipeline` | Blue button, top-right; creates a new pipeline (custom beyond Buyers/Sellers) |
| Drag handle `⠿` | Grip-dots icon left of each pipeline row; drag-to-reorder pipeline tab order |
| Pipeline name | Plain text label ("Buyers", "Sellers") |
| Edit icon (✏) | Pencil icon; opens inline or modal rename UI |
| Delete icon (🗑) | Trash icon; deletes pipeline with confirmation |

**Permission (per FUB docs):** Only the **account owner** can create, rename, reorder, or delete pipelines. Admins cannot perform these operations — even via API.

**Stage management from this screen (per FUB docs):**
- Add new pipeline
- Rename existing pipeline
- Reorder pipelines
- Delete pipeline
- `+ Add Custom Field` for deals (from within the pipeline settings flow)

**How to navigate back:** Clicking a pipeline tab (e.g., "Buyers") in the sub-nav returns to the Kanban board for that pipeline.

---

## 10. Add Stage Flow

**Trigger:** Click "Add a stage" text link at the far right of the Kanban board (outside the last column).

**UI:** Opens an inline form or modal to:
1. Enter stage name (required)
2. Choose accent color from a predefined palette
3. Set `is_closed_stage` checkbox (optional): "Mark deals in this stage as closed for reporting"
4. Save → new column appears at the rightmost position of the board

**Stage management once created (per FUB docs):**
- **Edit stage:** Hover over stage column header → pencil icon appears → click to open edit window (rename, change color, toggle closed flag, or delete)
- **Reorder stages:** Drag-and-drop the column header to a new horizontal position
- **Delete stage:** Via edit window

**Stage `orderWeight` behavior (per FUB docs):** Auto-assigned in 1000-unit gaps; recalculates all weights after any reorder or insert. Never hardcode `orderWeight` in integrations — always read current values before writing.

---

## 11. Deal Detail Modal

**Trigger:** Clicking any deal card on the Kanban board.

**Display type:** Centered **modal overlay** (not a full page, not a drawer). The Kanban board remains visible behind a dark scrim. Modal is a white card, ~600–700 px wide.

**Dismiss:** Click the X button (top-right of modal) or click the scrim background outside the modal.

### Modal header

```
2732 NW Ordway                                           [×]
Created Aug 27, 2025 at 7:39 am
Buyers  >  ● Closed
```

| Element | Details |
|---|---|
| Deal title (H1) | Property address string; large, bold dark text; editable (inferred) |
| Created timestamp | "Created [Month D, YYYY] at [H:MM am/pm]" — small gray text below title |
| Pipeline > Stage breadcrumb | Pipeline name (`"Buyers"`) + right-arrow `">"` + colored dot + stage name (`"Closed"`); colored dot matches the stage's accent color; this is a stage-indicator badge, not an interactive breadcrumb |
| X close button | Top-right of modal header |

### Modal body — two-column field layout

The modal body is split into two equal columns. Fields render as labeled sections; empty fields show a teal-colored `"Add [field name]"` placeholder link (click-to-edit inline). Populated fields show their value as a teal-colored link (click-to-edit).

**Left column fields:**

| Field label | Type | Observed value | Notes |
|---|---|---|---|
| PRICE | currency integer | `$880,000` (teal) | Editable; the deal's `price` field |
| EARNEST MONEY DUE | date | `"Add earnest money due date"` (empty) | `earnest_money_due_date`; click opens date picker |
| DUE DILIGENCE | date | `"Add due diligence date"` (empty) | `due_diligence_date`; click opens date picker |
| POSSESSION | date | `"Add possession date"` (empty) | `possession_date`; click opens date picker |
| COMMISSION | currency integer | `$22,000` (teal) | `commission_value` field; gross commission |
| PEOPLE | avatar list + add button | `SG` initials badge + blue `+` button | Linked FUB contacts (buyers/sellers); `+` opens person-search to link a contact |
| PROPERTY ADDRESS | text | `"Add property address"` (empty) | Free-form address string (separate from the deal name/title) |
| DESCRIPTION | text | `"Add description"` (empty) | Free-form notes about the deal |
| CUSTOM FIELDS | collapsed section | `"Show all fields"` (teal link) | Custom deal fields; collapsed by default; click to expand accordion |
| FILES | file upload | `"Upload file(s) or add a link"` | File attachment or URL link |

**Right column fields:**

| Field label | Type | Observed value | Notes |
|---|---|---|---|
| CLOSE DATE | date | `06/09/2025` (teal) | `projected_close_date` field (FUB docs: no separate actual close date in base model; in-house build should add `actual_close_date`); displayed as MM/DD/YYYY in the modal |
| MUTUAL ACCEPTANCE | date | `"Add mutual acceptance date"` (empty) | `mutual_acceptance_date`; click opens date picker |
| FINAL WALK THROUGH | date | `"Add final walk through date"` (empty) | `final_walk_through_date`; click opens date picker |
| SPLITS | currency + type label | `$22,000 (Agent split)` + `"Add team split"` link | Agent split amount shown with type label in parentheses; "Add team split" teal link adds a secondary split |
| TEAM | avatar list + add button | Broker headshot avatar + blue `+` button | Linked agent/broker users (from `user_ids`); separate from PEOPLE (contacts); `+` opens agent/broker search |

### Empty field UX pattern

Empty fields do NOT render a grayed-out `<input>` box. They render a **teal-colored inline link** styled as `"Add [field label]"`. Clicking the link inline-activates an edit control (date picker, text input, or people-search) for that field. Populated fields render their value as a teal link, also click-to-edit.

### Custom fields accordion

- Label: `"Show all fields"` (teal link)
- Default state: collapsed (hidden)
- Expanded state: renders all custom field definitions for this pipeline (see §14 for custom field types)
- Custom fields appear at the bottom of the left column / below main fields

### Commission split UX (per FUB docs)

The split behavior is dual-mode based on whether `commission_value` is populated:
- If `commission_value > 0`: `agent_commission` and `team_commission` are treated as **percentages** (0–100) of the commission value; UI may show percentage input
- If `commission_value` is empty/0: splits are treated as **raw dollar amounts**
- **Gotcha:** Setting `commission_value` after entering a dollar split will cause the system to reinterpret that number as a percentage — unexpected commission calculations result. The `+ Add Split` button only appears after `commission_value` is populated.

### Modal file upload

- Label: `"Upload file(s) or add a link"`
- Supports: file upload picker (browser file dialog) + URL link entry
- Files appear in the FILES section of the modal

---

## 12. Add Deal Flow

**Two entry points (per FUB docs):**
1. Click `+` button in any stage column header on the Kanban board → pre-populates the selected stage
2. Click the `"add deal"` hyperlink in the empty-state text of a column → same as `+`
3. From a contact/person profile page: click `+` in the "Deals" box on the contact record → the deal is automatically linked to that contact

**Creation form fields (per FUB docs):**
- Deal name (required) — typically the property address
- Stage / pipeline selection (required; `stageId` is mandatory on create)
- Price
- Projected closing date
- Associated contacts (`peopleIds`)
- Commission value + splits
- Team member assignments (`userIds`)

**Auto-population:** When creating a deal from a contact profile page, the team members assigned to that contact are **automatically added** to the deal's `userIds` array.

**API constraint:** Creating a deal with an empty `userIds` array (or no `userIds`) creates a deal visible only to admins/owners — no agent-role user can see it. Always populate `userIds` when creating deals programmatically.

---

## 13. Deal Board Filters

### Status filter ("Current deals ▾")

| Option | Behavior |
|---|---|
| Current deals | Shows deals with `status = 'active'`; default |
| Archived | Shows deals with `status = 'archived'` |
| All | Shows all non-deleted deals (`active` + `archived`) |

Archived deals still appear on the Leaderboard if they have a close date in the selected timeframe and are in a closed stage.

### Agent filter ("Everyone ▾")

| Option | Behavior |
|---|---|
| Everyone | All agents' deals (default; scoped by role — agents only see own deals even on "Everyone") |
| Me | Only the current logged-in user's deals |
| [Agent Name] | Individual team member; admin-only access to filter by any user |

The `Everyone ▾` dropdown and the agent avatar cluster (top-right nav) are **synchronized controls** — selecting an agent in either control updates the same underlying filter state.

### Archiving deals (per FUB docs)

- Hover over the upper-right corner of a deal card → archive option appears
- Use archive (not delete) when a deal is lost — **deleting a deal is a hard-delete** and, if Zillow Two-Way Sync is active, cancels the linked Zillow transaction
- Archived + closed deals remain visible in reporting and the Leaderboard within the selected timeframe

---

## 14. Custom Deal Fields

**Access (per FUB docs):** Deals > ⚙ Settings > `+ Add Custom Field`

**Permission:** Only the account owner can create, modify, or delete deal custom fields.

**Four field types:**

| Type | Input control | API field |
|---|---|---|
| `text` | Text input | `value_text` |
| `date` | Calendar date picker | `value_date`; populates FUB internal calendar (but does NOT sync to external Google/Outlook calendars — hard documented limitation) |
| `number` | Numeric input | `value_number` |
| `dropdown` | Single-select from predefined choices | `value_choice_id`; choices defined in field definition |

**Per-field configuration options:**

| Option | Type | Default | Notes |
|---|---|---|---|
| `hide_if_empty` | boolean | false | Field only renders on deal card/modal when populated; reduces clutter for optional fields |
| `read_only` | boolean | false | Display only; cannot be edited by users |
| `is_recurring` | boolean | false | Date fields only; for recurring annual dates (e.g., closing anniversaries) |
| `choices` | string[] | — | Dropdown only; the option list |
| `order_weight` | integer | auto | Controls display order; auto-recalculates with 1000-unit gaps after reorder |

**Display location:** Bottom of the deal detail modal (left column, beneath DESCRIPTION, collapsed under "Show all fields" expander). Custom deal fields do NOT appear on lead/person profiles, and person-profile custom fields do NOT appear on deals — they are separate namespaces.

**Automation integration:** Custom date fields can trigger automations based on the date value entered.

**Calendar integration:** Date custom fields populate the FUB internal calendar. Navigate to Calendar > Filters > Deal Custom Dates to select which fields appear. These dates do NOT sync to connected external calendars (Google Calendar, Outlook) — this is a permanent documented limitation.

---

## 15. Stage Transition Behavior

**Drag-and-drop:** Deal cards are draggable between stage columns to change stage (standard Kanban DnD). Inferred from FUB documentation; not directly visible in the analyzed GIF frames but confirmed in docs.

**Stage history logging:** FUB records an `entered_stage_at` timestamp whenever a deal moves to a new stage. This powers the "Time in Stage" metric in reporting.

**Deal Stage Changed automation trigger (per FUB docs):**
- Event fires when a deal moves from one stage to another
- Does NOT fire on initial deal creation (only on stage moves)
- Configuration: which pipeline stage(s) activate the automation; execution frequency ("Run once per person" or "Run multiple times")
- Available actions: Reassign contact, Add Note, Start Action Plan
- Scope: action applies to ALL people in `peopleIds` when the deal moves — if a deal has 2 contacts, both receive the action; be aware of duplicate communications on multi-contact deals

---

## 16. Deals Report

**Access:** Click "Deal Reporting" button in the Deals sub-bar OR navigate to Reporting > Deals sub-tab.

**Navigation type:** Full page navigation to Reporting module > Deals sub-tab. The Deals sub-tab is one of 11 tabs in the Reporting module: `Overview · Agent Activity · Properties · Lead Sources · Calls · Texts · Batch Emails · Marketing · **Deals** · Appointments · Agent Goals`.

### 16.1 Deals Report page layout

```
REPORTING MODULE (top nav active = Reporting)
Reporting sub-tabs: Overview | Agent Activity | Properties | Lead Sources | Calls | Texts | Batch Emails | Marketing | [Deals] | Appointments | Agent Goals

──────────────────────────────────────────────────────────────────
Deals Report                         [Add Deal (blue)] [⬇ export]

[Buyers ▾]  [All deals ▾]  [All Sources ▾]  [Everyone ▾]
ℹ How Deals Reporting works

──────────────────────────────────────────────────────────────────
STAGE KPI FUNNEL ROW  (horizontally scrollable)
[☑ Start(temp)] [☑ Buyer Contract] [☑ Offer] [☑ Pending] [☑ Closed] [☑ Lost]
[☑ Closed Deals summary] [☑ Upcoming Deals summary]

──────────────────────────────────────────────────────────────────
DUAL-SERIES LINE CHART                         [All time ▾]
─ Deals (blue/navy line)
─ Price Total (orange line)
X-axis: dates (Jul 2025 → Feb 2026)
Y-axis: $ scale ($770K, $1.5M, etc.)

──────────────────────────────────────────────────────────────────
DEALS TABLE  (sortable, scrollable)
Name | Stage | Status | Entered Stage | Time in Stage | Close Date↓ | Time to Close | Price | Commission
```

### 16.2 Stage KPI funnel tiles

Each stage is a horizontally-scrollable tile with a **blue checkbox** (checked = included in chart series). Unchecking a stage filters it out of the chart.

Each tile shows:
- Stage name
- Deal count
- Total price (`$X.XM` or `$XXX,XXX`)
- Average price (`$XXX avg`)
- Total commission
- Average commission per deal

Observed values from the GIF (Buyers pipeline, All time):

| Stage tile | Count | Total Price | Avg Price | Commission | Avg Commission |
|---|---|---|---|---|---|
| Start (temp stage) | 0 | $0 | $0 avg | $0 | $0 avg |
| Buyer Contract | 0 | $0 | $0 avg | $0 | $0 avg |
| Offer | 0 | $0 | $0 avg | $0 | $0 avg |
| Pending | 1 | $735K | $735K avg | $9.2K | $9.2K avg |
| Closed | 6 | $4.5M | $752.5K avg | $111K | $18.5K avg |
| Lost | 2 | $1.9M | $962K avg | $35.6K | — |
| **Closed Deals (summary)** | **8** | **$5.8M** | **$719.8K avg** | **$120.2K** | **$15K avg** |
| **Upcoming Deals (summary)** | **0** | **$0** | **$0 avg** | **$0** | **$0 avg** |

The "Closed Deals" and "Upcoming Deals" tiles are **summary aggregates** below the per-stage funnel row — not per-stage tiles. "Closed Deals" sums all stages marked `is_closed_stage = true`; "Upcoming Deals" sums Pending + Offer (deals with a future close date, not in closed stage).

### 16.3 Chart

- **Type:** Dual-series line chart
- **Series 1:** `■ Deals` (blue/navy line) — deal count over time
- **Series 2:** `■ Price Total` (orange line) — total dollar volume over time
- **X-axis:** Date range (defaults to "All time" showing Jul 2025 → Feb 2026 for this account)
- **Y-axis:** Dollar scale (right side); count scale (left side implied)
- **Time range dropdown:** `"All time ▾"` — filter chart to selected period (e.g., Last 30 days, This year, All time)
- **Stage filtering:** Unchecking a stage KPI tile removes it from both series

### 16.4 Deals table

**Columns (exact labels from GIF):**

| Column | Data | Sort |
|---|---|---|
| Name | Deal name (address); teal hyperlink → deal detail | Sortable |
| Stage | Current stage name (e.g., "Pending", "Closed", "Lost") | Sortable |
| Status | Always shows "Active" (FUB API artifact — `status` field always returns `'Active'` regardless of stage; stage name is the real truth) | — |
| Entered Stage | Date the deal entered its current stage (`entered_stage_at`) | Sortable |
| Time in Stage | Integer days since `entered_stage_at` (e.g., "306 days", "144 days") | Sortable |
| Close Date | Actual/projected close date; sort indicator `↓` = sorted descending (most recent first) | **Sort default (desc)** |
| Time to Close | Integer days from oldest attached contact's creation date to close date; or from deal's own `created_at` if no contacts attached; blank for open deals | Sortable |
| Price | Sale price ($XXX,XXX or $X.XM abbreviated) | Sortable |
| Commission | Gross commission amount; `$0` or blank for lost/no-commission deals | Sortable |

**Observed table rows (Buyers pipeline, All time, from GIF):**

| Name | Stage | Entered Stage | Time in Stage | Close Date | Time to Close | Price | Commission |
|---|---|---|---|---|---|---|---|
| 19571 SW Simpson Ave | Pending | Feb 5 2026 | 144 days | Mar 20 2026 | 50 days | $735K | $9.2K |
| 61260 Sunflower Ln | Lost | Feb 26 2026 | 123 days | Feb 26 2026 | 38 days | $500K | $0 |
| 2680 Nordic Ave | Closed | Oct 13 2025 | 259 days | Oct 10 2025 | 100 days | $1.4M | $33.8K |
| 703 SW 7th | Closed | Sep 30 2025 | 272 days | Sep 30 2025 | 92 days | $355K | $8.9K |
| 61271 Kwinnum Dr | Closed | Aug 27 2025 | 306 days | Aug 27 2025 | 56 days | $750K | $16.9K |
| 3480 SW 45th Street | Closed | Aug 27 2025 | 307 days | Aug 14 2025 | 43 days | $650K | $16.3K |
| 3235 NW Cedar | Closed | Jul 18 2025 | 346 days | Jul 14 2025 | 14 days | $530K | $13.3K |
| 2732 NW Ordway | Closed | Aug 27 2025 | 306 days | Jun 9 2025 | — | $880K | $22K |
| 2680 Nordic Ave | Lost | Jul 18 2025 | 346 days | — | — | $1.4M | $35.6K |

### 16.5 Report page filters

| Dropdown | Options |
|---|---|
| Pipeline | `Buyers ▾` / `Sellers ▾` / other custom pipelines |
| Deal status | `All deals` / `Current deals` / `Archived` |
| Source | `All Sources` / individual lead sources |
| Agent | `Everyone` / `Me` / individual agent names |
| Time range | `All time ▾` / This Month / This Year / Year To Date / custom |

### 16.6 Page-level actions

| Action | Element | Behavior |
|---|---|---|
| Add Deal | Blue button `"Add Deal"` in page header | Opens the Add Deal form (same flow as Kanban `+` button) |
| Export | Download/arrow icon in page header | Opens the Export column-selector modal |
| Sort table | Click column header | Toggle ascending/descending; `↓` indicator on currently sorted column |
| Open deal | Click deal name (teal link) in table | Navigate to deal detail (likely full-page deal view, not the modal overlay used from Kanban) |

---

## 17. Export Modal

**Trigger:** Click the download/export icon on the Deals Report page.

**Type:** Centered modal overlay; "Export" title + X close button.

**Column selector (all checked by default):**

| # | Column name | Notes |
|---|---|---|
| 1 | ☑ Name | Deal name (address) |
| 2 | ☑ Stage | Current stage name |
| 3 | ☑ Status | Always "Active" (FUB artifact) |
| 4 | ☑ Entered Stage | Date entered current stage |
| 5 | ☑ Time in Stage | Integer days |
| 6 | ☑ Close Date | Actual/projected close date |
| 7 | ☑ Time to Close | Integer days |
| 8 | ☑ Price | Sale price |
| 9 | ☑ Commission | Gross commission (`commission_value`) |
| 10 | ☑ Agent Commission | Agent-split commission (`agent_commission`); separate from gross commission |

**CTA:** `Export to CSV` (blue button at bottom of modal)

**Interaction:** Individual checkboxes are toggleable — user can deselect columns before exporting. Clicking "Export to CSV" downloads a `.csv` file with selected columns for all visible (filtered) deals.

**Note:** "Agent Commission" (column 10) is a separate export column from "Commission" (column 9) — this supports split commission tracking when team splits are configured.

---

## 18. Dynamic Behaviors (from GIF analysis)

| User action | System response |
|---|---|
| Navigate to `/deals` | Loading bar appears (indeterminate, orange, at bottom edge of viewport); gray-blue placeholder bg; then Kanban renders |
| Click `Deals` in top nav | Buyers pipeline Kanban loads by default (first tab auto-selected) |
| Click `Buyers` tab | Switches board to pipeline 1 Kanban; active tab gets blue underline; URL → `/deals/1` |
| Click `Sellers` tab | Switches board to pipeline 2 Kanban; URL → `/deals/2` |
| Click ⚙ gear icon | Full-page navigation to Manage Pipelines settings page (board is replaced) |
| Manage Pipelines: drag ⠿ handle | Drag-to-reorder pipeline rows (reorders tab order) |
| Manage Pipelines: ✏ edit icon | Edit pipeline name inline or via modal |
| Manage Pipelines: 🗑 delete icon | Delete pipeline with confirmation dialog |
| Manage Pipelines: `+ Add Pipeline` | Creates a new custom pipeline |
| Click pipeline tab from settings | Navigate back to that pipeline's Kanban |
| Click `+` button in column | Opens Add Deal form pre-scoped to that stage |
| Click `"add deal"` empty-state link | Same as `+` button |
| Click a deal card | Opens deal detail as a **centered modal overlay** with scrim; Kanban remains visible dimmed behind |
| Click X on deal modal | Closes modal; Kanban restores to full visibility |
| Click outside modal (scrim) | Closes modal; same as X |
| Click `"Add [date]"` link in modal | Opens date picker inline for that field |
| Click `"Show all fields"` | Expands custom fields accordion |
| Click PEOPLE `+` button | Opens people-search dialog to link a FUB contact |
| Click TEAM `+` button | Opens agent/broker search dialog |
| Click `"Add team split"` | Opens split configuration UI |
| Drag deal card to new column | Updates deal stage; records `entered_stage_at` timestamp; fires `deal_stage_changed` event for automations |
| Click `"Deal Reporting"` button | Navigate to Reporting > Deals sub-tab |
| Stage KPI tile checkbox | Toggle that stage's inclusion in the chart series |
| Chart time range dropdown | Filter chart to selected period |
| Pipeline filter on report | Switch report to different pipeline |
| Click deal name in table | Navigate to deal detail (full-page view, not modal) |
| Click column header in table | Sort table ascending/descending by that column |
| Click export icon | Open Export column-selector modal |
| Export modal: uncheck column | Deselect from CSV output |
| Click `Export to CSV` | Download `.csv` file |
| Export modal: X | Dismiss modal; no download |
| Click `Add Deal` on report page | Open Add Deal form (same flow as Kanban `+`) |
| Click agent avatar in top nav | Filter board to that agent's deals (synced with Everyone dropdown) |

---

## 19. Deals Leaderboard

**Access:** Reporting > Leaderboard > Show Me: Deals Leaderboard.

**Ranking:** Individuals ranked by total `price` on qualifying deals (sum of sale prices).

**A deal qualifies if ALL THREE are true:**
1. In a selected pipeline
2. In a stage with `is_closed_stage = true`
3. Deal's `projected_close_date` falls within the chosen timeframe

**Timeframe options:** This Month · This Year · Year To Date · All-Time.

**Exclusion feature:** Remove specific individuals from the ranking (e.g., exclude team leads).

**Fullscreen mode:** Board can be displayed full-screen for office TV display.

**What is excluded:**
- Pending/active deals (not in closed stage)
- Deleted deals
- Deals with close date outside selected timeframe

**What is included:**
- Archived deals (if closed stage + close date in range)

**Setup requirement:** At least one stage per pipeline must have `is_closed_stage = true`. Without this flag on any stage, the Leaderboard shows nothing.

---

## 20. Data Model

### 20.1 `pipelines` table

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | 1 = Buyers, 2 = Sellers (from URL pattern) |
| `name` | text | "Buyers", "Sellers", or custom |
| `description` | text | Optional |
| `order_weight` | integer | Drag-to-reorder pipeline tab order; 1000-unit gaps |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 20.2 `deal_stages` table

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `pipeline_id` | integer FK → pipelines | |
| `name` | text | Stage label (e.g., "Pending", "Closed", "Lost / Terminated") |
| `color` | text | Hex color for accent bar; user-assignable |
| `order_weight` | integer | Column order; 1000-unit gaps; auto-recalculates on reorder |
| `is_closed_stage` | boolean | Default false; must be true on at least one stage per pipeline to gate leaderboard + commission reporting |
| `created_at` | timestamptz | |

### 20.3 `deals` table

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `name` | text | Required; typically property address |
| `description` | text | Free-form deal notes |
| `stage_id` | integer FK → deal_stages | Required on create; determines pipeline membership |
| `price` | integer | Sale price in dollars (int cents possible per FUB API) |
| `projected_close_date` | date | Used as both projected AND actual close date for reporting (FUB baseline model has only one date field); in-house build should add `actual_close_date` (see §20.6) |
| `commission_value` | integer | Gross commission (`commissionValue` in API) |
| `agent_commission` | integer | Agent-split amount OR percentage — see §11 dual-mode semantics |
| `team_commission` | integer | Team-split amount OR percentage |
| `earnest_money_due_date` | date | Key date |
| `mutual_acceptance_date` | date | Key date |
| `due_diligence_date` | date | Key date |
| `final_walk_through_date` | date | Key date |
| `possession_date` | date | Key date |
| `status` | enum | `'active'` / `'archived'` / `'deleted'` |
| `order_weight` | integer | Custom sort within stage |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 20.4 `deal_people` (junction — contacts on a deal)

| Column | Type | Notes |
|---|---|---|
| `deal_id` | integer FK → deals | |
| `person_id` | integer FK → crm_people | Contact/lead associated with the deal |
| `role` | text | (inferred) "buyer", "seller", "co-buyer" — optional label |

### 20.5 `deal_users` (junction — agents/brokers on a deal)

| Column | Type | Notes |
|---|---|---|
| `deal_id` | integer FK → deals | |
| `user_id` | integer FK → brokers/users | Assigned agent or broker |
| `role` | text | (inferred) "listing agent", "buyer agent", "co-agent" |

### 20.6 `deal_stage_transitions` (stage history for time-in-stage)

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `deal_id` | integer FK → deals | |
| `from_stage_id` | integer FK → deal_stages | null for initial stage placement |
| `to_stage_id` | integer FK → deal_stages | |
| `transitioned_at` | timestamptz | Recorded when deal.stage_id changes |

### 20.7 `deal_custom_field_definitions`

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `pipeline_id` | integer FK → pipelines | Custom fields are pipeline-scoped |
| `label` | text | Display label |
| `field_type` | enum | `'text'` / `'date'` / `'number'` / `'dropdown'` |
| `hide_if_empty` | boolean | Default false |
| `read_only` | boolean | Default false |
| `is_recurring` | boolean | Default false; date fields only |
| `order_weight` | integer | 1000-unit gaps |
| `created_at` | timestamptz | |

### 20.8 `deal_custom_field_choices` (dropdown options)

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `field_definition_id` | integer FK → deal_custom_field_definitions | |
| `label` | text | Choice display text |
| `order_weight` | integer | Choice order |

### 20.9 `deal_custom_field_values`

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `deal_id` | integer FK → deals | |
| `field_definition_id` | integer FK → deal_custom_field_definitions | |
| `value_text` | text | For type='text' |
| `value_date` | date | For type='date' |
| `value_number` | numeric | For type='number' |
| `value_choice_id` | integer FK → deal_custom_field_choices | For type='dropdown' |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 20.10 In-house build addition: `actual_close_date`

FUB's base model uses `projected_close_date` as both projected and actual close date — a single field. For Oregon transaction record-keeping, the in-house CRM **must implement a separate `actual_close_date` column** on `deals`. When a deal is moved to a stage with `is_closed_stage = true`, auto-populate `actual_close_date = NOW()` if it is not already set, while leaving `projected_close_date` unchanged. Both dates are available for reporting comparisons.

---

## 21. Commission Split Semantics

The dual-mode split behavior must be implemented exactly as FUB documents:

```
IF commission_value > 0:
  agent_commission = percentage (0–100) of commission_value
  team_commission  = percentage (0–100) of commission_value
  agent_$ = commission_value * agent_commission / 100
  team_$  = commission_value * team_commission / 100

ELSE (commission_value is null or 0):
  agent_commission = dollar amount
  team_commission  = dollar amount
```

**UI consequence:** When `commission_value` is populated, the split fields render as `%` inputs. When empty, they render as `$` inputs. This must be reflected in the deal modal and in the `SPLITS` field display (e.g., observed: `$22,000 (Agent split)` = agent dollar amount when no separate commission_value context).

The `+ Add Split` (or "Add team split") button in the modal only appears after `commission_value` is populated.

---

## 22. Permission / Visibility Rules

| Role | Deal visibility | Pipeline/stage management |
|---|---|---|
| Account Owner (Matt) | All deals, all pipelines | Create/rename/reorder/delete pipelines and stages; manage custom fields |
| Admin | All deals; can filter by any user | Cannot manage pipelines or custom fields |
| Agent/Broker | Only deals where they appear in `deal_users` | Cannot manage pipelines |
| Team Leader | Their team's deals only (not org-wide) | — |
| Lender | No deal visibility in reporting | — |

**Platform plan required** for "Teams within Teams" filtering in deal reports and board.

**Row-level security implementation:**
```sql
-- Agent can only see deals they are part of
SELECT d.* FROM deals d
JOIN deal_users du ON du.deal_id = d.id
WHERE du.user_id = :current_user_id
  AND d.status != 'deleted'
```

---

## 23. Reported Metric Computations

```sql
-- Time in Stage (current, in days)
SELECT EXTRACT(DAY FROM NOW() - dst.transitioned_at) AS time_in_stage
FROM deal_stage_transitions dst
WHERE dst.deal_id = :deal_id
ORDER BY dst.transitioned_at DESC LIMIT 1;

-- Time to Close (days from oldest contact's creation to close date)
SELECT EXTRACT(DAY FROM d.projected_close_date - MIN(p.created_at)) AS time_to_close
FROM deals d
JOIN deal_people dp ON dp.deal_id = d.id
JOIN crm_people p ON p.id = dp.person_id
WHERE d.id = :deal_id
GROUP BY d.id, d.projected_close_date;
-- Fallback if no people: use d.created_at instead of MIN(p.created_at)

-- Commission Earned YTD (Agent Goal Report)
SELECT SUM(d.agent_commission) AS commission_earned
FROM deals d
JOIN deal_stages ds ON d.stage_id = ds.id
JOIN deal_users du ON du.deal_id = d.id
WHERE ds.is_closed_stage = true
  AND d.projected_close_date >= DATE_TRUNC('year', NOW())
  AND d.projected_close_date < DATE_TRUNC('year', NOW()) + INTERVAL '1 year'
  AND du.user_id = :agent_id;

-- Pending Commission (Agent Goal Report)
SELECT SUM(d.agent_commission) AS pending_commission
FROM deals d
JOIN deal_stages ds ON d.stage_id = ds.id
JOIN deal_users du ON du.deal_id = d.id
WHERE ds.is_closed_stage = false
  AND d.projected_close_date > NOW()
  AND du.user_id = :agent_id;

-- Leaderboard ranking
SELECT du.user_id, SUM(d.price) AS total_volume
FROM deals d
JOIN deal_stages ds ON d.stage_id = ds.id
JOIN deal_users du ON du.deal_id = d.id
WHERE ds.is_closed_stage = true
  AND d.projected_close_date BETWEEN :start_date AND :end_date
  AND d.status != 'deleted'
GROUP BY du.user_id
ORDER BY total_volume DESC;
```

---

## 24. Dashboard Widget

A "Deals closing in 30 days" count widget appears on the main dashboard. Implementation:

```sql
SELECT COUNT(*) FROM deals
WHERE projected_close_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
  AND status = 'active';
```

This is a rolling 30-day forecast count across all statuses (not just closed-stage deals).

---

## 25. Webhook / Event Emissions

The in-house system must emit these events:

| Event | Trigger |
|---|---|
| `deals.created` | `INSERT` into `deals` |
| `deals.updated` | `UPDATE` on `deals` |
| `deals.deleted` | `UPDATE status = 'deleted'` on `deals` |
| `deals.stage_changed` | Stage ID changes; payload: `{deal_id, from_stage_id, to_stage_id, people_ids, user_ids}` |
| `deal_custom_fields.created/updated/deleted` | Mutations on `deal_custom_field_definitions` |
| `pipelines.created/updated/deleted` | Mutations on `pipelines` |
| `pipeline_stages.created/updated/deleted` | Mutations on `deal_stages` |

The `deals.stage_changed` event is the automation trigger. The automation engine consumes this event and applies configured actions to each person in `people_ids`.

---

## 26. Prior-Spec Errors Corrected

The following errors in §11 of `docs/FUB_CRM_FEATURE_SPEC.md` are corrected in this spec:

1. **Commission icon: "arrow + $"** → WRONG. No arrow exists. The field uses a **house icon** (Sellers) or **stacked-bills icon** (Buyers) + gray commission amount. The arrow described was an OCR artifact from low-resolution image analysis.

2. **"Lost/Terminated" stage name** → The exact label is **"Lost / Terminated"** (spaces around the slash). The prior spec had `"Lost/Terminated"` (no spaces). This distinction matters for DB enum values and UI labels.

3. **Deal detail is inferred as a page** → The GIF confirms it is a **modal overlay** floating over the Kanban, not a page navigation. The prior spec said "(inferred)" for deal detail without specifying the modal type. The exact two-column field layout, breadcrumb format, and all 13 fields (EARNEST MONEY DUE, MUTUAL ACCEPTANCE, DUE DILIGENCE, FINAL WALK THROUGH, POSSESSION, COMMISSION, PEOPLE, PROPERTY ADDRESS, DESCRIPTION, CUSTOM FIELDS, FILES, CLOSE DATE, SPLITS, TEAM) are documented here for the first time.

4. **Gear icon → settings** → The prior spec implied this opens "pipeline configuration" generically. The GIF confirms it triggers a **full-page navigation** to a "Manage Pipelines" settings page (not a modal), which shows drag-to-reorder pipelines with edit/delete actions per pipeline.

5. **Deals Report** → The prior spec said "Deal Reporting → Reporting 'Deals' report (commissions by stage and lead source)" — minimal. The full report layout is now documented: stage KPI funnel tiles with checkboxes, dual-series line chart (Deals count vs Price Total), 9-column sortable table with computed `time_in_stage` and `time_to_close` metrics, export modal with 10 configurable columns.

6. **Missing: 5 real-estate key date fields** → The prior spec did not mention `earnestMoneyDueDate`, `mutualAcceptanceDate`, `dueDiligenceDate`, `finalWalkThroughDate`, `possessionDate`. These are first-class deal fields (not custom fields) required in the data model.

7. **Missing: is_closed_stage flag** → The prior spec did not mention the per-stage `is_closed_stage` flag that gates leaderboard and commission reporting. This is a critical build requirement — without it, the Leaderboard shows nothing.

8. **Missing: commission split dual-mode semantics** → The prior spec noted commission is a stored amount but did not document the percentage-vs-dollar dual-mode based on whether `commission_value` is populated.

9. **Missing: "Deal Stage Changed" automation trigger** → Not in prior spec.

10. **Missing: custom deal field types and configuration options** → Not in prior spec.

11. **Missing: agent visibility scoping (row-level security)** → Prior spec implied all agents see all deals; per FUB docs agents see only their own deals.

---

## 27. Acceptance Criteria

### AC-1: Dual-pipeline Kanban board

1. Two named pipelines exist: "Buyers" and "Sellers"; URL `/crm/deals/1` and `/crm/deals/2` respectively
2. Switching pipeline tabs switches the Kanban board content without a full page reload
3. Board is horizontally scrollable; each column is independently vertically scrollable when card count overflows
4. Board renders on page load with a loading indicator; blank state shown during JS initialization

### AC-2: Stage columns

5. Buyers pipeline renders exactly 6 default stages in order: Start (temp stage) → Buyer Contract → Offer → Pending → Closed → Lost
6. Sellers pipeline renders exactly 7 default stages in order: Start (temp stage) → Pre-Listing → Listed → Offer → Pending → Closed → Lost / Terminated
7. Each column header shows: stage name, deal count (singular/plural), summed dollar value (green, locale-formatted), Closed badge (only on `is_closed_stage = true` stages)
8. Each column header has a unique-per-stage colored accent bar (4–6 px top border)
9. Each column has a `+` button that opens the Add Deal flow pre-scoped to that stage

### AC-3: Deal cards

10. Each deal card displays: property address (primary), sale price (green, bold), commission icon + commission amount (gray), date field (conditional — "Close Date:" for closed stages, "Projected Close Date:" for others), avatar cluster (contacts first, agent last)
11. Commission amount is a stored field — not computed from price at render time
12. Date format renders as ordinal English: `Month Dth YYYY` (e.g., "July 30th 2025")
13. Avatar initials colors are deterministic per contact (hash from contact ID, not random)
14. Deal cards are drag-and-droppable between stage columns; dropping records `entered_stage_at` timestamp and fires `deals.stage_changed` event
15. Clicking a deal card opens the deal detail modal (centered overlay with scrim)

### AC-4: Empty state

16. When a stage has 0 deals, column body shows: `"No deals, add deal"` where `"add deal"` is a blue/teal hyperlink triggering the same Add Deal flow as the `+` button

### AC-5: Deal detail modal

17. Modal renders as a centered overlay over the Kanban board (Kanban visible but dimmed behind scrim)
18. Modal header shows: deal name (H1), created-at timestamp, pipeline > stage breadcrumb with colored dot
19. Modal body renders all 13 field groups (PRICE, EARNEST MONEY DUE, DUE DILIGENCE, POSSESSION, COMMISSION, PEOPLE, PROPERTY ADDRESS, DESCRIPTION, CUSTOM FIELDS, FILES on left; CLOSE DATE, MUTUAL ACCEPTANCE, FINAL WALK THROUGH, SPLITS, TEAM on right)
20. Empty fields render as teal `"Add [field name]"` placeholder links (not grayed-out inputs)
21. Date fields open a date picker on click
22. PEOPLE section links FUB contacts via person-search; shows initials avatars
23. TEAM section links broker/agent users via agent-search; shows photo avatars
24. SPLITS shows current split with type label (e.g., "(Agent split)"); "Add team split" link adds a second split
25. Custom fields are collapsed by default behind "Show all fields" accordion expander
26. Modal dismisses on X click or scrim click; no data changed by dismissing

### AC-6: Add Deal flow

27. Add Deal form requires: deal name + stage (required); price, projected close date, contacts, commission, team members (optional)
28. Creating a deal from a contact profile auto-populates `userIds` from the contact's assigned agents
29. `stageId` is always set on create — no "unassigned" deals are created

### AC-7: Manage Pipelines settings

30. Gear icon navigates to a full-page Manage Pipelines settings route (not a modal)
31. Settings page lists existing pipelines with drag handles (reorder), edit pencil, and delete trash icons
32. `+ Add Pipeline` button creates a new custom pipeline
33. Only account owner role can access pipeline management (admins get 403 on this route)

### AC-8: Stage management

34. "Add a stage" text link at the far right of the board opens a form to name + color + is_closed_stage toggle a new stage
35. Hovering a stage column header reveals a pencil edit icon; clicking opens stage edit (rename, color, toggle closed flag, delete)
36. Stage columns can be drag-reordered; `order_weight` auto-recalculates with 1000-unit gaps
37. At least one stage per pipeline must have `is_closed_stage = true` for leaderboard and commission reporting to function

### AC-9: Board filters

38. "Current deals ▾" dropdown filters board: Current / Archived / All
39. "Everyone ▾" dropdown filters board by agent; synced with agent avatar cluster in top nav
40. Non-admin agents see only deals where they appear in `deal_users`; admins see all deals

### AC-10: Deals Report

41. "Deal Reporting" button navigates to Reporting > Deals sub-tab
42. Report page shows: stage KPI funnel tiles (with checkbox toggling per stage), dual-series line chart (deal count + price total), 9-column sortable deals table, filter bar (pipeline, status, source, agent, time range), Add Deal button, export icon
43. Stage KPI tiles show: count, total price, avg price, commission, avg commission
44. "Closed Deals" and "Upcoming Deals" summary tiles aggregate across stages
45. Table sorts by Close Date descending by default; all columns sortable
46. Table shows computed `time_in_stage` (days) and `time_to_close` (days) correctly

### AC-11: Export

47. Export icon opens a column-selector modal with 10 checkboxes (Name, Stage, Status, Entered Stage, Time in Stage, Close Date, Time to Close, Price, Commission, Agent Commission)
48. All boxes checked by default; user can deselect
49. "Export to CSV" downloads a `.csv` file with selected columns for all visible (filtered) deals

### AC-12: Custom deal fields

50. Account owner can create custom deal fields of 4 types: text, date, number, dropdown
51. `hide_if_empty`, `read_only`, `is_recurring` (date only) toggles work per field
52. Custom fields appear in the deal detail modal (left column, collapsed under "Show all fields")
53. Custom date fields populate the internal CRM calendar but do NOT sync to Google/Outlook (by design)
54. Custom fields trigger automations when date values are entered

### AC-13: Automations

55. `deals.stage_changed` event fires on every stage ID change (not on initial deal creation)
56. Event payload includes `deal_id`, `from_stage_id`, `to_stage_id`, `people_ids`, `user_ids`
57. Automation engine applies configured actions to each person in `people_ids`

### AC-14: Commission reporting integrity

58. All commission/leaderboard queries join on `deal_stages.is_closed_stage = true` — never on stage name alone
59. Commission Earned YTD uses `agent_commission` field, filtered to closed-stage deals with close date in current calendar year
60. Pending Commission uses deals not in closed stage with future projected close date
61. Leaderboard excludes pending (non-closed-stage) deals regardless of price

### AC-15: Data integrity

62. Archiving a deal (status = 'archived') is the correct way to mark lost deals — hard-delete is reserved for permanent removal
63. `deal_stage_transitions` row is written on every stage change with `transitioned_at = NOW()`
64. `actual_close_date` is auto-populated when deal moves to an `is_closed_stage = true` stage (in-house extension beyond FUB baseline)

---

## 28. Design / Implementation Notes

- **Styling:** Ryan Realty design system (navy `#102742` / cream `#faf8f4`). Stage accent bar colors are user-configurable; use a CSS custom property `--stage-accent` applied to the bar element. All UI components from `@/components/ui/` (shadcn/ui design-system wrappers).
- **Kanban DnD:** Use `dnd-kit` (preferred) or `react-beautiful-dnd` for drag-and-drop between columns and stage reordering.
- **Modal:** Use `<Dialog>` from `@/components/ui/dialog` for the deal detail overlay.
- **Currency formatting:** `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })` — no cents on sale prices; commissions may show cents if non-round.
- **Date formatting:** Custom `formatOrdinalDate(date)` function → `"Month Dth YYYY"` (e.g., `"July 30th 2025"`). Not standard ISO or US comma format.
- **Avatar color seeding:** `hashCode(contact.id.toString()) % PALETTE.length` where `PALETTE` is the set of observed initials-circle colors; same contact always gets same color.
- **Vault reconciliation:** Cross-reference: Deals in `is_closed_stage = true` + `actual_close_date` set should correspond to a completed transaction in the TC module (`tc_transactions`). Discrepancies surface in a broker dashboard reconciliation view (see `19-tc-transaction-coordination.md`).
- **Cross-references:** `09-people-contacts.md` (person records linked via `deal_people`), `12-reporting.md` (Deals Report, Leaderboard, Agent Goals), `13-automations.md` (Deal Stage Changed trigger), `19-tc-transaction-coordination.md` (Vault as system of record).

---

## Sources

| Source | File / Reference |
|---|---|
| Shot-30 static screenshot analysis | `fub-analysis/shot-30.md` — Buyers Kanban, full column details, all card data, typography, color palette |
| Shot-31 static screenshot analysis | `fub-analysis/shot-31.md` — Sellers Kanban, all 7 columns, all visible card data, component breakdown |
| GIF interaction analysis | `fub-analysis-gif/deals.md` — Manage Pipelines page, Deal detail modal (complete field inventory), Deals Report page, Export modal, loading state, all dynamic behaviors |
| FUB official documentation | `fub-docs/deals-pipelines.md` — 15 help articles + API reference: deal fields, pipeline/stage API, custom field types, automation triggers, leaderboard logic, commission split semantics, permission gating, plan gating, calendar sync limitation, Zillow delete gotcha, time-to-close calculation, agent visibility rules |
| Prior spec | `docs/FUB_CRM_FEATURE_SPEC.md` §11 — base stage lists and column names (superseded; errors documented in §26 above) |
