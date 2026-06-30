# Module: People — Contact List, Columns, Bulk Actions, Add/Export

> **Purpose:** This section specifies the full People list surface — the primary contact-database view of the in-house CRM. It covers the All People list, Smart List views, the left sidebar hierarchy, all default and configurable columns, the toolbar and right filter panel, every bulk action, the Add Person modal, and the Export Selected People modal. It also corrects several errors in the prior spec (§6.1, §6.5, §6.6, §6.7 of `docs/FUB_CRM_FEATURE_SPEC.md`). A developer who has never seen FUB must be able to build every surface from this document alone.

---

## 1. URL Patterns

| View | FUB URL | In-house route (TBD) |
|------|---------|----------------------|
| All People (default) | `/2/people/pond/1` | `/crm/people` |
| All People activity-sorted | `/2/people?sort=-lastLeadActivity` | `/crm/people?sort=-lastLeadActivity` |
| Smart List (by ID) | `/2/people/list/{smartListId}` | `/crm/people/list/{smartListId}` |
| Pond view | `/2/people/pond/{pondId}` | `/crm/people/pond/{pondId}` |

The `/2/people/pond/1` route is the canonical "All People" entrypoint in FUB (pond ID 1 = the system "All People" pond). In the in-house CRM, implement this as the default `/crm/people` route.

---

## 2. Page Layout: Three-Region Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ TOP NAV (People · Inbox · Tasks · Calendar · Deals · Reporting) │
├──────────────┬──────────────────────────────────┬───────────────┤
│ LEFT SIDEBAR │       MAIN TABLE AREA            │ FILTER PANEL  │
│ (250px)      │                                  │ (280–320px)   │
│              │  ┌─────────────────────────────┐ │               │
│ All People   │  │ Header: "All People"         │ │ [Add a filter]│
│ COLLECTIONS  │  │ Subtitle: "Showing N people" │ │               │
│  Pipeline ▼  │  │                              │ │ (empty state  │
│   - list 1   │  │ [Toolbar row]                │ │  or filter    │
│   - list 2   │  │                              │ │  chips)       │
│  Nbhd ▼      │  │ [Table with rows]            │ │               │
│   - Tetherow │  │                              │ │               │
│   - Sunriver │  │                              │ │               │
│  Manage      │  └─────────────────────────────┘ │               │
└──────────────┴──────────────────────────────────┴───────────────┘
```

**Region sizing:**
- Left sidebar: fixed ~250px, always visible
- Main table: flex, takes remaining width after sidebar and filter panel
- Right filter panel: ~280–320px, persistent (does not close on its own; stays open between list navigations)

**Layout behavior:**
- Filter panel stays OPEN when switching between smart lists. On switching to a filter-having list, the panel repopulates with that list's filters without closing.
- On navigating to All People (no saved filters), the panel stays open but shows the "No filters added yet" empty state — it does NOT close.
- The Column Chooser flyout opens in the same right-panel slot as the filter panel (replacing it). Opening the column chooser closes the filter panel view; closing column chooser restores the filter panel.

---

## 3. Left Sidebar: All People + Collections Hierarchy

### 3.1 Top-level structure

```
People                    [section header + collapse icon]
  All People              17K   [badge: total contact count]
COLLECTIONS               [section header]
  Pipeline                [group header, collapsible ▼]
    🔥 Active & Pending Clients   8
    🔥 Hot/Weekly                 2
       Warm/Bi-Weekly             [no badge when 0]
       Past Clients/Sphere: Quarterly   18
       New Leads: No Call Attempt       [no badge when 0]
    🧊 Cold/Bi-Monthly           44
       Old Leads: No Call Attempt       7K
  Neighborhoods           [group header, collapsible ▼]
       Tetherow                   696
       Sunriver                   436
       Pronghorn                   13
       Black Butte Ranch            4
       Northwest Crossing           3K
       Vandevert                   18
       Crosswater                  58
       Caldera Springs            208
       Sunstone Loop — Showing Brokers   [no badge]
       Bend – River West            2K
       Bend – Awbrey Butte          1K
       Bend – Summit West           1K
       Bend – Century West         712
  ⚙ Manage                [footer link → /crm/people/manage-lists]
```

See cross-reference: `06-smart-lists-and-collections.md` for the full Collections + Manage Lists spec.

### 3.2 Sidebar item anatomy

Each smart list item renders:
- Optional emoji prefix icon (🔥 for hot-cadence, 🧊 for cold-cadence, no icon for others)
- List name (truncated with ellipsis if too long)
- Count badge (small oval chip, right-aligned): count ≥ 1000 abbreviated as `NK` (e.g., `7K`, `17K`, `3K`). Count = 0 renders NO badge (the item appears without a number). Count 1–999 renders as the integer string.
- Active state: navy background `bg-primary/10` or equivalent highlight; the item is visually selected.

### 3.3 Count update rules (from FUB docs)
- Updates every **10 minutes** while the People page is open
- Updates **immediately** on: clicking a specific list, creating a new list, saving filter changes
- Sidebar count may lag in-list count by up to 10 minutes — clicking the list forces an immediate refresh (documented FUB behavior)

### 3.4 Group collapsibility
Both the Pipeline and Neighborhoods groups are collapsible using a chevron (▲/▼) on the group header. Collapse state persists per session (inferred).

---

## 4. Main Table: Header, Subtitle, and Top-Right CTA

### 4.1 "All People" view header

```
All People                              [h1]
Showing 17,123 people                   [subtitle]
                               [+ New List]  [top-right button]
```

- `+ New List` button is positioned top-right of the page header. This is the only CTA in this position for All People. It triggers the "Save New Smart List" modal (see `06-smart-lists-and-collections.md`).
- The `+ New List` button does NOT appear on smart list views; `Update List` appears instead (see §4.2).

### 4.2 Smart List view header

```
🔥 Hot/Weekly  | PIPELINE | Edit          [Update List ↻]
Contacts in your hot stage(s) - this smart list reminds... More
```

- **List name**: displayed with emoji prefix if set
- **Badge**: `PIPELINE` (dark filled pill) or `NEIGHBORHOODS` or other collection type
- **Edit link**: opens the Edit Smart List modal (see §10)
- **Description**: one-line truncated with `More` expand link → `Less` collapse. Full text is a rich-text field (max 1000 characters).
- **Update List button**: appears ONLY on dynamic/pipeline smart lists (those with saved filter criteria that can be re-evaluated). NOT present on static smart lists (Active & Pending Clients is described as "a static list" in FUB and has no Update List button). The button shows a ↻ refresh icon + "Update List" label. Secondary icon button sits next to it (copy/share functionality — inferred).
- **`+ New List` button**: present only on All People view. Smart lists show `Update List` instead.
- These two controls occupy the same top-right slot and are mutually exclusive based on view type.

**PRIOR SPEC ERROR CORRECTED:** §6.1 listed "Add Person, Import, New Smart List, Columns, + Filter, sort control, view/grid toggle, How…work" as the header row. These are incorrect. The actual structure separates: the header area (h1 + subtitle + `+ New List` / `Update List`), the toolbar row (which contains the four elements described in §5 below), and the bulk action icons (which appear adjacent to the subtitle, not in a separate toolbar).

---

## 5. Toolbar Row

The toolbar row sits between the page header and the table. It is consistent across All People and Smart List views. All four elements are always present.

```
[? How Smart Lists work]   [Columns ▾]   [Me ▾]   [Filters (N)]
```

| Control | Behavior |
|---------|----------|
| `? How Smart Lists work` | Blue text link with question-mark icon. Opens help content explaining smart lists. Always present regardless of view. |
| `Columns ▾` | Opens the Column Chooser flyout (right panel — see §8). Per-list saved column configuration. |
| `Me ▾` (agent/pond scope dropdown) | Displays the currently active scope selection. Default: "Me" (contacts assigned to the logged-in user). Opens the agent/pond scope dropdown (see §7). This is NOT a filter in the smart list's saved filter set — it is a view-level scope overlay. |
| `Filters (N)` | Shows `Filters` when 0 active filters, `Filters (N)` when N filters are active. Clicking toggles the right filter panel open/closed. |

**Bulk action icons**: These appear adjacent to the "Showing N people" subtitle area when rows are selected OR as permanently visible icons. From shot-50 observation: `email · import/upload · tag · delete · export` icons are visible above the table when All People is loaded (even before selection). These become active bulk action triggers when contacts are selected.

**PRIOR SPEC ERROR CORRECTED:** The prior spec called the agent scope control an "Everyone dropdown." The observed value shown on the button is **"Me"** (the currently-selected scope), not "Everyone." "Everyone" is one of the options inside the dropdown. The button label reflects the current selection.

---

## 6. Default Columns (All People View)

These are the eight columns shown by default in the All People view. Each can be reordered, hidden, or replaced via the Column Chooser (§8).

| # | Column Header | What It Shows | Format / Notes |
|---|--------------|---------------|----------------|
| 1 | *(checkbox)* | Row selection checkbox | Far-left; selecting activates bulk action bar |
| 2 | **Name** | Contact's full name on line 1. Source/sub-label on line 2 in muted text (e.g., "Import", "Farm", "Expired Listing", "Prospect", "Report", "Ryan-Realty.com"). Followed by contact avatar (initials or photo) at far left of the cell. | Primary sort column. Clicking row → person detail. |
| 3 | **Lead Score** | Integer score (observed range: 1–6 in screenshots; FUB scale is 1–5 or 1–10; exact scale TBD). Displayed as a numeric badge. | (inferred: colored badge by tier) |
| 4 | **Agent** | Assigned agent's avatar + full name (e.g., "Matt Ryan" with avatar circle). | Single-agent assignment. |
| 5 | **Last Visit** | Date of the contact's last website visit. Format: abbreviated month + ordinal day + 2-digit year with apostrophe: `Nov 13th '25`. Relative recency also observed: `6 days ago`, `7 days ago`, `11 days ago`. | Corresponds to the `Last Visit` filter field (excludes the initial lead-creation visit per FUB docs). |
| 6 | **Phone** | Primary phone number. Two icons permanently visible (not hover-only): green circle = SMS/text action; blue circle = call action. | Clicking icons initiates the respective action. |
| 7 | **Email** | Primary email address. | Clickable to compose. |
| 8 | **Last Activity** | Most recent lead-initiated action. Shows an activity-type icon + description. Activity type icons: orange/flame icon = "Viewed [page URL]" (website tracking event); green house icon = "Inquiry - [address]" (property inquiry). Date format same as Last Visit. | This is the `Last Activity` filter field — lead-side signals only (website visits, inquiries, IDX activity). Does NOT update when the agent contacts the lead. |
| 9 | **Tags** | Tags attached to the contact, displayed as colored pills. Overflow shown as `+N more` link. | Tags use colon-namespaced format: `broker:matt`, `neighborhood:pronghorn`, `compliance:hard-stop`. |

**PRIOR SPEC ERROR CORRECTED:** §6.1 listed "Phone, Email, Created, Last Activity description" as separate columns within a single run. The actual default column set is Name (with source sub-label), Lead Score, Agent, Last Visit, Phone, Email, Last Activity, Tags — 8 columns. "Created" is NOT a default column on All People (it appears on some Smart List views per their saved column configuration). The prior spec also listed "Last Seen / Last Activity" as a merged column — these are two distinct concepts: Last Visit (website) and Last Activity (lead-initiated events).

**Activity-sorted view:** The URL `/crm/people?sort=-lastLeadActivity` is the same column set sorted descending by Last Activity. No structural changes to the table — only the sort order changes. This view is reachable from the toolbar by clicking the Last Activity column header or via URL parameter.

---

## 7. Agent/Pond Scope Dropdown ("Me" Control)

Triggered by clicking the `Me ▾` button in the toolbar. Appears as a **floating dropdown** (not a right flyout panel) positioned below the button.

### 7.1 Dropdown structure

```
[Search input box]
────────────────────────
Everyone
Me                    ← current selection (highlighted when "Me" is active)
────────────────────────
PONDS
  View All Ponds
  Out Of State Home Owners
────────────────────────
TEAM MEMBERS
  ◉ Matt Ryan          [avatar]
  ○ Paul Stevenson     [avatar]
  ○ Rebecca Peterson   [avatar]
```

### 7.2 Behavior
- **Search input**: filters the dropdown options in real time
- **"Everyone"**: shows all contacts the user has permission to see (same as FUB's "All People" scope)
- **"Me"**: scopes to contacts assigned to the logged-in user
- **PONDS section**: lists all available ponds. "View All Ponds" navigates to a ponds management view. Individual ponds are selectable (e.g., "Out Of State Home Owners")
- **TEAM MEMBERS section**: shows all three brokers with avatars (Matt Ryan, Paul Stevenson, Rebecca Peterson). Selecting an agent scopes the view to that agent's accessible contacts (assigned + collaborator + pond leads for that agent — NOT just assigned leads; use the Assigned Agent filter for assigned-only)
- Current selection is highlighted/radio-selected. Selecting a new option immediately re-scopes the table and closes the dropdown.
- The toolbar button label updates to reflect the current selection (e.g., clicking "Out Of State Home Owners" changes the button label to "Out Of State Home..." truncated)
- This scope selection does NOT modify the smart list's saved filter set — it is a view-level overlay only

**PRIOR SPEC CLARIFICATION:** The "Out Of State Home..." control observed in shot-50 as what appeared to be an "active filter chip" is actually this dropdown's button showing its currently selected pond value. It is not a filter chip.

---

## 8. Column Chooser Flyout

Triggered by clicking `Columns ▾` in the toolbar. Opens as a **right-panel flyout** (occupies the same slot as the filter panel; the filter panel view is replaced while the column chooser is open).

### 8.1 Column chooser structure

```
[Add a filter]    ← search/filter field at top of panel
────────────────────
DETAILS
  T  Name
  T  First Name
  T  Last Name
  ☎  Phone
  ✉  Email
  T  Address
  ℹ  Price
  🏷  Tags
  ▾  Stage
  [... more fields ...]
```

- Search input at top ("Add a filter" is the placeholder text — confusingly similar to the filter panel, but this panel is for column selection)
- Fields organized under section headers (DETAILS, and presumably additional sections: ASSIGNED, COMMUNICATION, WEBSITE ACTIVITY, DEALS, CUSTOM FIELDS)
- Each field row shows: type icon (T = text, phone icon, email icon, etc.) + field name
- Checking a field adds it as a visible column; unchecking removes it
- Fields can be dragged to reorder (drag handle on left of each row — inferred from FUB docs)
- Column configuration is saved per smart list — each list has its own saved column set (confirmed from GIF analysis: different lists show different columns). "All People" has its own default column set.
- Custom fields are selectable as columns

**Per-list column configuration (confirmed):**
From the GIF analysis, each Pipeline smart list has its own saved column set:
- Active & Pending Clients: Name · Created · Stage · Last Visit
- Hot/Weekly: Name · Created · Stage · Source · Last Visit · Pages Viewed
- Warm/Bi-Weekly: Name · Agent · Created · Stage · Source · Last Visit
- Past Clients/Sphere: Quarterly: Name · Created · Stage · Source
- New Leads: No Call Attempt: Name · Created · Stage · Source · Last Visit
- Cold/Bi-Monthly: Name · Agent · Created · Stage · Source
- Old Leads: No Call Attempt: Name · Agent · Created · Stage · Source
- All People: Name · Lead Score · Agent · Last Visit · Phone · Email · Last Activity · Tags

---

## 9. Right Filter Panel (Persistent)

The filter panel is a **persistent right sidebar** — NOT a flyout or modal. It is always visible when on any People view. It does not close when switching lists.

### 9.1 Empty state (All People / no filters)

```
[Add a filter]          ← search/text input at top

        ⚙               ← sliders/settings icon graphic (centered)
  No filters added yet  ← message text (centered below icon)
```

This empty state appears when the current view (All People) has no saved filters. The panel stays open with this message; it does not auto-close.

### 9.2 Populated state (Smart List with filters)

```
[Add a filter]          ← search/text input triggers filter type picker
────────────────────────────────────────
Tags exclude any of: complianc...    ▼  ← collapsed filter row (click to expand)
Last Text Sent more than 7 day...    ▼
Last Sent Email more than 7 da...    ▼
Last Call more than 7 days ago       ▼
Stage includes any of: A - Hot 1...  ▼
────────────────────────────────────────
Clear filters                           ← link at bottom of filter list
```

### 9.3 Expanded filter row (Tags example)

```
Tags exclude any of: complianc...    ▲  ← chevron flips up when expanded

  ○ are not empty
  ○ include any
  ● exclude any                       ← radio: currently selected mode
    [compliance:hard-stop ×] [tcpa:litigator ×] [Bounced ×]
    [contact:do-not-email ×] [Unsubscribed ×]
    [do_not_text ×] [NOTEXT ×]
    [+] add more values
  ○ are empty
```

Multiple filter rows can be expanded simultaneously (accordion — not mutually exclusive).

### 9.4 Expanded filter row (Stage example)

```
Stage includes any of: Active Clie... ▲

  ● include any                       ← radio
    [Active Client ×] [Pending ×]
    [+] add value
  ○ exclude any
```

### 9.5 Filter types and operators (complete set observed + documented)

| Filter Field | Modes / Operators | Value Types |
|-------------|-------------------|-------------|
| Tags | are not empty / include any / exclude any / are empty | Tag strings (colon-namespaced, e.g. `compliance:hard-stop`) |
| Stage | include any / exclude any | Stage label strings |
| Last Text Sent | more than N days ago | Integer + unit (days) |
| Last Sent Email | more than N days ago | Integer + unit (days) |
| Last Call | more than N days ago / is empty | Integer + unit (days) |
| Phone | is good | Boolean (no value needed) |
| Created | less than N days ago / more than N days ago | Integer + unit (days) |
| Source | excludes any of | Source label strings |

From FUB official docs, the full filter operator set also includes: `contains`, `does not contain`, `starts with`, `is bad`, `is less than`, `is greater than`, `is between`, `include all`, `exclude all`, `was less than [N time-units] ago`, `was more than [N time-units] ago`. Time units: minutes, hours, days, weeks, months, years.

All filter categories from the official docs must be addressable:
**Details:** First Name, Last Name, Phone, Email, Address, Price, Tags, Stage, Source, Created, Updated, Inactive, My Next Task, Last Activity, Last Communication, Timeframe, My Agent Status
**Assigned:** Agent, Pond, Lender, Collaborators
**Emails:** Last Email, Last Sent Email, Last Received Email, Last Sent Batch Email, Last Sent Action Plan Email, Last Sent Marketing Campaign, Emails Sent (count), Emails Received (count), Last Email Activity
**Calls:** Last Call, Last Call Made, Last Call Received, Calls Made (count), Calls Received (count), Time to First Call, Talk Time
**Texts:** Last Text, Last Text Sent, Last Text Received, Texts Sent (count), Texts Received (count)
**Website Activity:** Properties Viewed (count), Properties Saved (count), Pages Viewed (count), Last Visit (date), Visits (count)
**Deals:** Deal Stage, Deal Close Date, Deal Price
**Inbox Apps:** Last Inbox App Message, Last Sent Inbox App Message, Last Received Inbox App Message, Last Marketing Message Reply, Inbox App Messages Sent, Inbox App Messages Received
**Custom Fields:** all four types (Text, Date, Number, Dropdown) with type-appropriate operators

### 9.6 "Clear filters" link

Appears at the bottom of the filter list when any filters are active. Clicking removes all active filters from the current view (does NOT update/save the smart list's definition — it only clears the active view state).

### 9.7 Filter count badge on toolbar

The `Filters` button in the toolbar shows `Filters (N)` when N filters are active. Badge disappears (shows plain "Filters") when no filters are active (All People view).

### 9.8 "Update List" flow

After modifying filters in the panel, the `Update List ↻` button (top-right of the smart list header) becomes the save action. Clicking it commits the current filter state as the smart list's saved definition. This is the only way to persistently change a smart list's filter criteria. Filters modified in the panel but not saved via "Update List" are discarded on navigation.

---

## 10. Smart List Header: Static vs. Dynamic Types

FUB distinguishes between two smart list types:

| Type | Description | "Update List" button | Example |
|------|-------------|---------------------|---------|
| **Static** | "A static list of the clients you are currently working with." Contacts are manually managed. | NOT present | Active & Pending Clients |
| **Dynamic / Pipeline** | Filter-driven; contacts flow in/out as data changes. | PRESENT (↻ icon) | Hot/Weekly, Warm/Bi-Weekly, Cold/Bi-Monthly, Old Leads, New Leads |

Both types have: list name, collection badge (PIPELINE or NEIGHBORHOODS), Edit link, description with More/Less toggle.

**Description expand/collapse:**
- Default: truncated after ~1 line with "More" link
- Clicking "More" expands to full text; link changes to "Less"
- Clicking "Less" collapses back

---

## 11. Edit Smart List Modal

Triggered by clicking the "Edit" text link in any smart list's header.

### 11.1 Modal structure

```
┌──────────────────────────────────────────────────────┐
│  Edit Smart List                                  [×] │
├──────────────────────────────────────────────────────┤
│  [🔥] [🗑] [Active & Pending Clients________]         │
│       ← emoji picker icon; trash icon; name text input │
│                                                      │
│  [B] [I] [U] [•] [1.] [🔗] [😊] [T×]               │
│  ┌────────────────────────────────────────────────┐  │
│  │ A static list of the clients you are          │  │
│  │ currently working with. This smart list       │  │
│  │ displays everyone in current (active/signed)  │  │
│  │ and pending (under contract) stages.          │  │
│  └────────────────────────────────────────────────┘  │
│                                              173/1000 │
│                                                      │
│  Share smart list with:                              │
│  [Search for agents or teams...]                     │
│  ○ Share with everyone                               │
│  AGENTS                                              │
│  ☑ Matt Ryan                 [avatar]                │
│  ☑ Paul Stevenson            [avatar]                │
│  ☑ Rebecca Peterson          [avatar]                │
│  [Deselect all agents and make this smart list private] │
├──────────────────────────────────────────────────────┤
│  🗑 Delete        [Cancel]        [Save List]        │
└──────────────────────────────────────────────────────┘
```

### 11.2 Modal fields

| Field | Type | Constraints |
|-------|------|-------------|
| Emoji picker icon | Button | Opens emoji picker to set/change the list's prefix emoji |
| Trash icon (next to emoji) | Button | Inferred: removes/clears the current emoji from the name field |
| Name | Text input | Required. Pre-filled with current list name. Cursor visible at end. |
| Description | Rich-text editor | Formatting toolbar: Bold · Italic · Underline · Bullet list · Numbered list · Link · Emoji · Clear formatting (T×). Max 1000 characters with live counter (`173/1000`). |
| Share smart list with | Search input | "Search for agents or teams..." placeholder |
| Share with everyone | Radio/checkbox | Shares with all current and future users |
| Agent checkboxes | Checkboxes | One per broker. All three checked by default (Matt Ryan ☑, Paul Stevenson ☑, Rebecca Peterson ☑). Blue checkbox style. |
| Deselect all link | Blue text link | "Deselect all agents and make this smart list private" — removes all agent access, makes the list private to the creator |

### 11.3 Modal actions

| Button | Position | Action |
|--------|----------|--------|
| 🗑 Delete | Footer, left-aligned | Deletes the smart list definition. All contacts remain in CRM. Inferred: confirmation dialog before permanent delete. |
| Cancel | Footer | Closes modal without saving changes. |
| Save List | Footer, primary (navy/primary color) | Saves name, description, sharing settings. Does NOT save filter changes (filters are saved via Update List on the People view). |

### 11.4 Dismissal behavior

Clicking Cancel or the × close button closes the modal immediately with no changes saved. The filter panel remains open in its previous state.

**Permission rules (from FUB docs):**
- Smart lists created by agents/lenders CANNOT be shared with the team. Only admin-created lists are shareable.
- Any admin can edit admin-created shared Smart Lists.
- Sharing a list does NOT share contact access — each viewer sees only the contacts they have permission to see.

---

## 12. Loading and Empty States

### 12.1 Table loading skeleton (observed: GIF f04)

When navigating to a new list, the table immediately renders **skeleton placeholder rows** (gray animated bars) before data arrives. The column headers remain visible and correct. Row count matches the expected number of visible rows. No spinner or blank state — the skeleton is immediate on navigation, providing layout stability.

Implementation: use `<Skeleton>` from `@/components/ui/skeleton` for each cell, matching the actual row height and column widths.

### 12.2 Filter panel empty state (observed: GIF f04)

When switching to All People or any list with no saved filters, the filter panel shows:
- Centered sliders/settings icon graphic
- "No filters added yet" text below the icon
- "Add a filter" search input remains at the top (usable to add ad-hoc filters)

### 12.3 Smart list empty state (no matching contacts)

When a smart list's filters match zero contacts:

```
      [illustrated person-silhouette with × graphic]
          No people found
  No people match filters, try another search
```

The table column headers REMAIN VISIBLE in the empty state (the user can see which columns are configured even when no rows exist). This is by design — do not hide column headers when the result set is empty.

### 12.4 "No filters added yet" (filter panel) vs empty list

These are distinct states:
- "No filters added yet": the FILTER PANEL is empty (no filter criteria configured). The table may still have data.
- "No people found": the LIST has zero matching contacts (filter criteria exist but no contacts match). The table body is empty.

---

## 13. Row Anatomy

Each row in the People table:

```
[☐] [avatar] Name                    [Lead Score] [Agent]  [Last Visit]  [Phone ☎📞] [Email]  [Last Activity 🔥] [Tags]
              Source sub-label
```

- **Checkbox**: far-left. Clicking selects the row and activates the multi-select bar (see §14).
- **Avatar**: contact's photo or initials circle. Left edge of the Name cell.
- **Name cell**: full name on line 1 (bold). Source/sub-label on line 2 in muted smaller text. Sub-label is the contact's lead source string as it appears in the `source` field (e.g., "Import", "Farm", "Expired Listing", "Prospect", "Report", "Ryan-Realty.com", "Zillow", "Google", "Sphere").
- **Phone cell**: primary phone number. Two permanently visible icons (not hover-only): green circle = SMS/text; blue circle = call.
- **Last Activity cell**: shows an activity-type icon + description text + date. Icon types observed: orange/flame for "Viewed [page URL]" (website tracking); green house for "Inquiry - [address]" (property inquiry). Date format: `Nov 13th '25` (abbreviated month + ordinal day + 2-digit year with apostrophe) OR relative: `6 days ago`.
- **Tags cell**: tags as colored removable pills. Overflow: `+N more` link.
- **Row click**: anywhere on the row (except checkbox or action icons) navigates to the Person Detail view (`/crm/people/{personId}`).

---

## 14. Multi-Select and Bulk Action Bar

### 14.1 Activating bulk select

- Clicking any row's checkbox activates that row and shows the bulk action bar.
- A "Select All" checkbox in the column header selects all contacts on the current page (or optionally all contacts in the current list).
- The bar shows: **"Selected N people — Deselect all"** text, a list/grid view toggle (inherited from FUB — purpose: switch between list and grid view while in bulk mode), and the bulk action trigger.

### 14.2 Bulk action trigger

The `...` or action-dropdown button in the multi-select bar opens the **bulk action dropdown**. Additionally, a tag icon in the bar opens the **tag sub-dropdown** (separate from the main dropdown).

### 14.3 Main bulk action dropdown (11 items, exact order from shot-56)

Opened from the `...` icon or caret in the multi-select bar:

| # | Action | Description |
|---|--------|-------------|
| 1 | **Update Stage** | Set stage for all selected contacts at once. Opens a stage picker. |
| 2 | **Update Source** | Change the lead source for all selected contacts simultaneously. |
| 3 | **Assign Agent** | Assign a specific agent to all selected contacts. Shows the 3 broker options. |
| 4 | **Assign Ponds** | Designate contacts to a specific pond. |
| 5 | **Assign Lender** | Assign a lender to all selected contacts. |
| 6 | **Add Collaborators** | Add one or more collaborators to all selected contacts. |
| 7 | **Remove Collaborators** | Remove specified collaborators from all selected contacts. |
| 8 | **Merge People** | Consolidate selected duplicate contacts. Max 10 contacts at once (FUB hard limit). Includes "Merge people as relationships" checkbox option. |
| 9 | **Mailing Label** | Generate mailing labels (Avery 5160 format, 30 per sheet, USPS-compliant). Downloads + emails the file. Format options: main contact only / with relationship names / per unique address. |
| 10 | **Update Timeframe** | Change the Timeframe field for all selected contacts. Options: 0–3 Months, 3–6 Months, 6–12 Months, 12+ Months, No Plans. |
| 11 | **Apply Automation** | Enroll selected contacts in a named automation/action plan. Shows a searchable list of configured automations. |

**PRIOR SPEC ERROR CORRECTED:** §6.5 listed 8 bulk actions as: "Update Stage, Update Agent, Assign Pond, Update Location, Merge People, Update Timeframe, Apply Action Plan, Delete People." This list is wrong in four ways: (1) "Update Agent" should be "Assign Agent"; (2) "Update Location" does not exist in the observed bulk action dropdown; (3) "Apply Action Plan" should be "Apply Automation"; (4) "Delete People" is separate (see §14.4). The correct 11-item list is as documented above.

**Critical behavior:** Mass actions do NOT trigger automations. Stage changes, source changes, agent assignments performed via mass actions bypass the automation engine entirely. This is an explicit architectural decision in FUB and must be replicated. Bulk operations go through a separate code path that skips the automation trigger layer.

Additionally, mass actions cannot: start action plans (use batch email instead), use First to Claim or Round Robin assignment methods, or reassign tasks between team members.

### 14.4 Tag sub-dropdown (2 items, from shot-57)

Opened from the **tag icon** in the multi-select bar (separate from the `...` bulk action trigger):

| # | Action |
|---|--------|
| 1 | **Add Tags** |
| 2 | **Remove Tags** |

Both actions open a tag input/picker where the user specifies which tag(s) to add or remove from all selected contacts.

### 14.5 Additional bulk operations (accessible from the bar icons, not the dropdown)

| Icon | Action |
|------|--------|
| Email icon | **Batch Email** — send a single email to all selected contacts |
| Import/upload icon | **Import** — redirects to Admin > Import (applies to the account, not the selection) |
| Delete icon | **Delete** (owner/admin) or **Move to Trash** (all users) |
| Export/download icon | **Export Selected People** — opens the Export modal (see §15) |

**Permission gating on delete:**
- Any user can move contacts to the Trash stage (reversible — contacts can be recovered by changing their stage)
- Only **Owner and Admin** users can permanently delete contacts
- Permanent deletion removes all profile data, removes associated tasks, orphans deals (deals remain but lose their contact link), and is irreversible

---

## 15. Export Selected People Modal

Triggered by clicking the export/download icon from the bulk action bar when contacts are selected.

### 15.1 Modal structure

```
┌──────────────────────────────────────────────┐
│  Export Selected People               [×]    │
├──────────────────────────────────────────────┤
│                                              │
│  Would you like to export 10 people?         │
│                                              │
│  ☐ Export all columns   [?]                  │
│                                              │
│  This will create an export file of         │
│  your selected people. Once it is ready,    │
│  it will begin downloading automatically    │
│  and you will receive an email with a       │
│  link to the file.                          │
│                                              │
│          [Cancel]   [Yes, export people]     │
└──────────────────────────────────────────────┘
```

### 15.2 Modal fields

| Element | Type | Behavior |
|---------|------|----------|
| Title | "Export Selected People" | Static |
| Body | "Would you like to export N people?" | N = the count of currently selected contacts |
| "Export all columns" checkbox | Checkbox | **Unchecked by default.** When unchecked: exports only the columns currently visible on the People screen. When checked: exports the full data set (see field list below). `[?]` help icon next to the checkbox opens a tooltip explaining the difference. |
| Description paragraph | Static text | "This will create an export file of your selected people. Once it is ready, it will begin downloading automatically and you will receive an email with a link to the file." Confirms async behavior. |
| Cancel button | Ghost/outline button | Closes modal, no action taken |
| "Yes, export people" button | Primary (navy) button | Triggers async export |

**PRIOR SPEC ERROR CORRECTED:** §6.7 described the checkbox as "Export all contacts (overrides selection to the full list)" and the button as "To Last Exporter." Both are wrong. The checkbox is "Export all columns" (controls which FIELDS to export, not which CONTACTS). The button is "Yes, export people." There is no "To Last Exporter" button; export always goes to CSV download + email.

### 15.3 Export behavior (async)

1. User clicks "Yes, export people"
2. Modal closes (inferred)
3. Server generates the CSV file in the background
4. When ready: browser auto-downloads the file
5. User also receives an email with a link to the file
6. The account owner ALWAYS receives an email notification when any user performs an export (cannot be suppressed — documented FUB requirement)

### 15.4 Export field coverage

**Default export (Export all columns unchecked):** Only the columns currently enabled on the People screen. Includes at minimum: Name, First Name, Last Name, Stage, Lead Source, Assigned To, Date Added, Tags.

**Full export (Export all columns checked):**
- Contact basics: name, stage, lead source, assigned agent, date added
- Up to 6 phone numbers (with type labels)
- Up to 6 email addresses (with type labels)
- Up to 6 addresses
- Property data: address, MLS number, price, beds, baths, area, lot size
- Communication history: up to 50 most-recent calls, texts, and notes
- Tags, custom fields, campaign data
- Relationships: up to **4 related contacts** (spouses prioritized in ordering), with first name, phone, email, address per relationship

**NOT exportable:** Email bodies, call recordings.

### 15.5 Export permissions

- Account owner: always has export rights
- Other users (agents, admins): export access is controlled per-user via Admin > Teams > "Can Export" toggle (set by the account owner)
- When any non-owner exports: the account owner receives an email notification with who exported and when. This notification is mandatory and cannot be disabled.

---

## 16. Add Person Modal

Triggered by clicking the person-plus icon in the page header area (always visible, no row selection required).

### 16.1 Modal structure

```
┌────────────────────────────────────────┐
│  👤 Add Person                    [×]  │
├────────────────────────────────────────┤
│  [First Name ________] [Last Name ___] │
│           50%                 50%      │
│                                        │
│  [Email ____________________________]  │
│                                        │
│  [Phone ____________________________]  │
│                                        │
│  [Select a lead source ▾           ]   │
│                                        │
│        [Cancel]    [Add person]        │
└────────────────────────────────────────┘
```

### 16.2 Field specification

| Field | Input type | Layout | Constraints |
|-------|------------|--------|-------------|
| First Name | Text input | 50% width (left half of top row) | Required (button disabled when both name fields empty — inferred) |
| Last Name | Text input | 50% width (right half of top row) | Required |
| Email | Text input | Full width | Optional at creation; validated format on submit |
| Phone | Text input | Full width | Optional at creation |
| Select a lead source | Dropdown | Full width | Options: all configured lead sources in the account. Placeholder text: "Select a lead source". Optional. |

### 16.3 Button states

| Button | Style | Enabled condition |
|--------|-------|-------------------|
| Cancel | Ghost/outline | Always enabled |
| Add person | Primary (navy) | Disabled (muted/greyed) when First Name and Last Name are both empty; enabled once at least name is entered |

### 16.4 Modal header

- Person-plus icon (silhouette with +) in the modal header area
- "Add Person" title
- `×` close button top-right

### 16.5 On submit behavior

Clicking "Add person":
1. Creates the contact record
2. Captures the lead source at creation time (may drive routing and action-plan enrollment — inferred)
3. Navigates to the new contact's Person Detail page (inferred — standard pattern after creation)

This is a **minimal quick-create** modal. All additional fields (stage, agent assignment, tags, address, custom fields, relationships) are edited on the Person Detail page after creation.

**PRIOR SPEC CORRECTION:** §6.6 says the button label is "Add Person" (capital P). The actual label observed is "Add person" (lowercase p). This matters for exact-match button label tests.

---

## 17. Data Model (People List Module)

### 17.1 Tables touched by this surface

| Table | Operation | Notes |
|-------|-----------|-------|
| `crm_people` | SELECT (list), INSERT (Add Person) | Primary contacts table |
| `crm_smart_lists` | SELECT (sidebar), INSERT (+ New List), UPDATE (Update List), DELETE (Delete) | Smart list definitions |
| `crm_smart_list_filters` | SELECT, INSERT, UPDATE, DELETE | Filter criteria for smart lists |
| `crm_smart_list_columns` | SELECT, INSERT, UPDATE | Per-list saved column configuration |
| `crm_smart_list_sharing` | SELECT, INSERT, UPDATE | Sharing settings per list |
| `crm_collections` | SELECT | Collection/folder hierarchy |
| `crm_tags` | SELECT, INSERT, DELETE | Tag master list |
| `crm_contact_tags` | SELECT, INSERT, DELETE | Junction: contacts ↔ tags |
| `crm_contact_stages` | SELECT, UPDATE | Current stage per contact |
| `crm_brokers` | SELECT | Agent/pond assignment options |
| `crm_ponds` | SELECT | Pond definitions |
| `crm_contact_collaborators` | SELECT, INSERT, DELETE | Collaborators junction |
| `crm_exports` | INSERT | Export audit log |
| `crm_change_log` | INSERT | Field change history (Change Log) |

### 17.2 Computed / aggregated fields (required for filtering)

These fields must be maintained as either materialized columns or efficiently computable aggregates:

| Field | Definition | Filter category |
|-------|-----------|----------------|
| `last_visit` | Max `event_at` from `crm_website_events` where `event_type IN ('page_view', 'property_view')` excluding the first ever visit | Website Activity |
| `last_activity` | Max `event_at` from `crm_lead_events` where event was lead-initiated (inquiry, website registration, IDX view/save/favorite) | Details |
| `last_communication` | Max `event_at` from `crm_timeline_events` where `event_type IN ('call', 'email', 'text', 'inbox_app_message')` AND source = 'direct' (excludes batch/action plan/marketing emails) | Details |
| `last_call_made` | Max `called_at` from outbound calls | Calls |
| `last_text_sent` | Max `sent_at` from outbound texts | Texts |
| `last_email_sent` | Max `sent_at` from direct outbound emails (excludes batch/automated) | Emails |
| `time_to_first_call` | `first_call_at - created_at` | Calls |
| `talk_time` | Sum of call durations | Calls |
| `properties_viewed` | Count of property view events | Website Activity |
| `pages_viewed` | Count of non-property page view events | Website Activity |

### 17.3 Stage system

Three immutable system stages (cannot be renamed or deleted):
- `Lead` — default for all newly created contacts
- `Closed` — marks completed deals
- `Trash` — hidden from smart lists; action plans paused; tasks remain visible

Custom stages are fully editable/deletable by account owner (Admin > Stages). When deleting a custom stage, the system requires reassigning all contacts currently in that stage before proceeding.

Contacts in Trash stage: hidden from all smart lists and action plans pause. Recovery: change stage to any non-Trash stage. To find trashed contacts: filter by Stage = Trash.

---

## 18. Filter Panel Architecture (Data Model)

### 18.1 Smart list filter storage

```typescript
interface SmartList {
  id: string;
  name: string;
  emoji?: string;               // e.g. "🔥"
  description: string;          // rich text HTML, max 1000 chars
  type: 'static' | 'dynamic';   // static = no Update List button; dynamic = has it
  collection_id?: string;        // FK to crm_collections
  owner_user_id: string;
  filters: SmartListFilter[];    // ordered array of AND-combined filter conditions
  columns: string[];             // ordered array of field names for column display
  sharing: {
    mode: 'private' | 'everyone' | 'specific';
    user_ids: string[];          // for mode = 'specific'
  };
  count_cached?: number;         // sidebar badge; refreshed per §3.3 rules
  count_updated_at?: string;     // when the cached count was last computed
}

interface SmartListFilter {
  id: string;
  field: string;                 // e.g. 'tags', 'stage', 'lastCall', 'phone', 'createdAt'
  operator: FilterOperator;
  values?: string[];             // for include/exclude modes
  threshold?: {                  // for recency/time-based filters
    value: number;
    unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';
  };
  display_order: number;
}

type FilterOperator =
  | 'is_empty' | 'is_not_empty'
  | 'contains' | 'does_not_contain' | 'starts_with'
  | 'is_good' | 'is_bad'
  | 'is_less_than' | 'is_greater_than' | 'is_between'
  | 'include_any' | 'include_all' | 'exclude_any' | 'exclude_all'
  | 'was_less_than' | 'was_more_than';
```

### 18.2 Compliance tag taxonomy (must be pre-seeded)

The following tags are used in the default compliance-exclusion filter on every Pipeline smart list:

| Tag | Purpose |
|-----|---------|
| `compliance:hard-stop` | Contact flagged as a TCPA litigator or otherwise prohibited |
| `tcpa:litigator` | BatchData-confirmed TCPA litigator |
| `Bounced` | Email bounced (auto-tagged by system) |
| `contact:do-not-email` | Do not email this contact |
| `Unsubscribed` | Contact unsubscribed from action plan emails (auto-tagged) |
| `do_not_text` | Do not text this contact |
| `NOTEXT` | Legacy do-not-text tag (keep for backward compatibility) |

The standard compliance exclusion filter for pipeline smart lists:
```
Tags exclude any of: compliance:hard-stop, tcpa:litigator, Bounced,
                     contact:do-not-email, Unsubscribed, do_not_text, NOTEXT
```

This filter must be pre-configured on all seeded pipeline smart lists and should be the default first filter on any new pipeline list.

See `reference_tcpa_litigator_handling.md` in `.auto-memory/` for the TCPA compliance handling policy.

---

## 19. Default Pipeline Smart Lists (Seed Data)

These must be seeded on account creation. Each uses the standard compliance exclusion filter (tags exclude compliance block) as Filter 1, plus the list-specific filters below.

| List Name | Emoji | Type | Filters (in addition to compliance exclusion) | Cadence description |
|-----------|-------|------|-----------------------------------------------|---------------------|
| Active & Pending Clients | 🔥 | Static | Stage includes any of: Active Client, Pending | "currently working with" |
| Hot/Weekly | 🔥 | Dynamic | Last Text Sent > 7 days ago; Last Sent Email > 7 days ago; Last Call > 7 days ago; Stage includes: A - Hot 1-3 Months | "reach out every 7 days" |
| Warm/Bi-Weekly | (none) | Dynamic | Last Text Sent > 14 days ago; Last Sent Email > 14 days ago; Last Call > 14 days ago; Stage includes: B - Warm | "reach out every 14 days" |
| Past Clients/Sphere: Quarterly | (none) | Dynamic | Stage includes: Past Client, Sphere | "quarterly touch" |
| New Leads: No Call Attempt | (none) | Dynamic | Last Call is empty; Phone is good; Created < 14 days ago; Source excludes [configured]; Stage includes: Lead | "new leads, no call yet" |
| Cold/Bi-Monthly | 🧊 | Dynamic | Last Text Sent > 60 days ago; Last Sent Email > 60 days ago; Last Call > 60 days ago; Stage includes: C - Cold 6+ Months | "reach out every 60 days" |
| Old Leads: No Call Attempt | (none) | Dynamic | Last Call is empty; Phone is good; Created > 14 days ago; Stage includes: Lead | "14+ day old leads, never called" |

### Default Neighborhood Smart Lists (Seed Data)

One smart list per neighborhood, with filter: Tags include: `neighborhood:{neighborhood-slug}`. Seeded neighborhoods (with contact counts as of 2026-06-30):

| List Name | Tag filter | Count |
|-----------|-----------|-------|
| Tetherow | `neighborhood:tetherow` | 696 |
| Sunriver | `neighborhood:sunriver` | 436 |
| Pronghorn | `neighborhood:pronghorn` | 13 |
| Black Butte Ranch | `neighborhood:black-butte-ranch` | 4 |
| Northwest Crossing | `neighborhood:northwest-crossing` | 3K |
| Vandevert | `neighborhood:vandevert` | 18 |
| Crosswater | `neighborhood:crosswater` | 58 |
| Caldera Springs | `neighborhood:caldera-springs` | 208 |
| Sunstone Loop — Showing Brokers | `neighborhood:sunstone-loop` | (no badge) |
| Bend – River West | `neighborhood:bend-river-west` | 2K |
| Bend – Awbrey Butte | `neighborhood:bend-awbrey-butte` | 1K |
| Bend – Summit West | `neighborhood:bend-summit-west` | 1K |
| Bend – Century West | `neighborhood:bend-century-west` | 712 |

### TCPA Litigators Smart List

| List Name | Tag filter | Count (observed) |
|-----------|-----------|-----------------|
| TCPA Litigators — Hard Stop | Tags include: `compliance:hard-stop` OR `tcpa:litigator` | 125–135 |

This list is a critical compliance gate. See `reference_tcpa_litigator_handling.md`.

---

## 20. Ryan Realty Design System Mapping

All UI elements must use `@/components/ui/*` shadcn/ui components. Brand tokens: navy `#102742` (`bg-primary`), cream `#faf8f4` (`bg-background`), Geist (body/UI), Amboqia Boriango (display headings only). This is an internal admin tool — brand-voice client-copy gate does not apply. Design-token rule does apply.

| UI Element | Component |
|------------|-----------|
| Sidebar item | Custom `<SidebarItem>` built on `<Button variant="ghost">` |
| Count badge | `<Badge>` from `@/components/ui/badge` |
| Collection group header | `<Collapsible>` from `@/components/ui/collapsible` |
| Table | `<Table>` from `@/components/ui/table` |
| Row checkbox | `<Checkbox>` from `@/components/ui/checkbox` |
| Toolbar buttons | `<Button variant="outline">` or `<Button variant="ghost">` |
| Agent/pond dropdown | `<DropdownMenu>` from `@/components/ui/dropdown-menu` |
| Filter panel | Custom `<Sheet>` or persistent `<div>` (not closeable) |
| Column chooser | `<Sheet>` from `@/components/ui/sheet` (right side) |
| Filter accordion | `<Accordion>` from `@/components/ui/accordion` |
| Skeleton loading | `<Skeleton>` from `@/components/ui/skeleton` |
| Modal (Edit Smart List, Add Person, Export) | `<Dialog>` from `@/components/ui/dialog` |
| Tag pill | `<Badge variant="secondary">` |
| Empty state illustration | Custom `<div>` with centered icon + text |
| Rich text editor (description) | Third-party (e.g., Tiptap or Quill) wrapped in shadcn container |
| Primary action button | `<Button>` (default = navy `bg-primary`) |
| Ghost/cancel button | `<Button variant="ghost">` |
| Danger action (Delete) | `<Button variant="destructive">` |
| Separator | `<Separator>` from `@/components/ui/separator` |
| Tooltip (? icon) | `<Tooltip>` from `@/components/ui/tooltip` |
| Avatar | `<Avatar>` from `@/components/ui/avatar` |

---

## 21. Acceptance Criteria

### All People list
- [ ] Left sidebar renders All People with correct live count badge (17K format for 17,123)
- [ ] Collections hierarchy renders: Pipeline group (7 lists) + Neighborhoods group (13 lists) + Manage footer link
- [ ] Count badges use K-abbreviation for ≥ 1000; no badge for 0
- [ ] Clicking All People: table loads skeleton immediately → data replaces skeleton when ready
- [ ] Default 8 columns render: checkbox, Name (+ source sub-label), Lead Score, Agent, Last Visit, Phone (with SMS + call icons permanently visible), Email, Last Activity (with type icon + date), Tags
- [ ] Date format: `Nov 13th '25` (abbreviated month, ordinal day, 2-digit year with apostrophe)
- [ ] Clicking a row navigates to Person Detail
- [ ] Row checkbox activates multi-select bar
- [ ] Toolbar row shows: "? How Smart Lists work" | "Columns ▾" | "Me ▾" | "Filters"
- [ ] "Me ▾" button label reflects current scope selection
- [ ] "Filters (N)" badge appears when N > 0 filters active; plain "Filters" when 0

### Agent/pond scope dropdown
- [ ] Search input filters options
- [ ] Three sections: solo options (Everyone, Me) / PONDS (View All Ponds + named ponds) / TEAM MEMBERS (all 3 brokers with avatars)
- [ ] Current selection highlighted
- [ ] Selecting a value updates the table and the button label

### Filter panel
- [ ] Panel is persistent (stays open on list navigation, does not auto-close)
- [ ] Empty state: sliders icon + "No filters added yet" text
- [ ] Populated state: filter rows as collapsed chips with ▼ expand chevron
- [ ] Each filter row expands to show mode radios + value chips + "+" add button
- [ ] Filter rows can be expanded simultaneously (accordion, not mutually exclusive)
- [ ] "Clear filters" link appears when ≥ 1 filter active
- [ ] "Add a filter" input triggers filter type picker
- [ ] Filter count badge on toolbar Filters button updates in real time

### Smart List views
- [ ] Smart list header renders: emoji + name, collection badge pill, Edit link, description (truncated + More/Less toggle)
- [ ] Dynamic lists show "Update List ↻" button (top-right); static lists do not
- [ ] All People shows "+ New List" button; smart lists do not
- [ ] These two buttons are mutually exclusive (never both visible)
- [ ] Empty state: illustrated placeholder + "No people found" + subtitle; column headers visible
- [ ] Clicking "Edit" opens Edit Smart List modal
- [ ] Filter panel repopulates with the list's saved filters on navigation

### Edit Smart List modal
- [ ] Emoji picker icon + trash icon + name text input in header row
- [ ] Rich-text description editor with 7-button toolbar + `N/1000` live character counter
- [ ] Sharing section: search input + "Share with everyone" radio + per-agent checkboxes (Matt Ryan, Paul Stevenson, Rebecca Peterson) + "Deselect all" link
- [ ] Footer: Delete (left, destructive) · Cancel · Save List (primary)
- [ ] Cancel/× dismisses without saving

### Column chooser
- [ ] Opens as right-panel flyout (same slot as filter panel)
- [ ] Search input at top
- [ ] DETAILS section with icon + field name rows
- [ ] Per-list column configuration saved independently per list
- [ ] Column order reflects the saved per-list order

### Bulk actions
- [ ] Multi-select bar shows: "Selected N people — Deselect all" + view toggle + `...` trigger + tag icon
- [ ] Main `...` dropdown renders all 11 actions in order: Update Stage, Update Source, Assign Agent, Assign Ponds, Assign Lender, Add Collaborators, Remove Collaborators, Merge People, Mailing Label, Update Timeframe, Apply Automation
- [ ] Tag icon opens sub-dropdown with exactly 2 items: Add Tags / Remove Tags
- [ ] Separate bulk icons: email, import, delete/trash, export
- [ ] Delete: Owner/Admin → permanent delete; Agent → move to Trash
- [ ] Mass actions do NOT trigger automation rules (bypass automation engine)
- [ ] Merge People: capped at 10 contacts, includes "Merge as relationships" option

### Add Person modal
- [ ] Header: person-plus icon + "Add Person" title + × close
- [ ] First Name (50%) + Last Name (50%) in top row
- [ ] Email (full width) + Phone (full width) below
- [ ] "Select a lead source" dropdown (full width) below
- [ ] "Add person" button (lowercase p) disabled when both name fields empty
- [ ] Cancel button always enabled

### Export modal
- [ ] Title: "Export Selected People"
- [ ] Body: "Would you like to export N people?" (N = selection count)
- [ ] "Export all columns" checkbox unchecked by default + "?" tooltip
- [ ] Async behavior description paragraph visible
- [ ] "Cancel" (ghost) + "Yes, export people" (primary) buttons
- [ ] Export generates CSV → browser auto-download + email link to user
- [ ] Account owner receives email notification on every export (mandatory, not suppressible)

### Loading/empty states
- [ ] Skeleton rows render immediately on list navigation (before data)
- [ ] Column headers visible during skeleton state
- [ ] "No filters added yet" empty state in filter panel when navigating to All People
- [ ] Smart list empty state shows illustrated placeholder + two-line message; column headers visible

---

## 22. Prior Spec Errors Corrected

This section documents every correction to `docs/FUB_CRM_FEATURE_SPEC.md` §§6.1–6.7 made in this specification.

| §Prior Spec | Error | Correction |
|------------|-------|-----------|
| §6.1 Header toolbar | Listed "Add Person, Import, New Smart List, Columns, + Filter, sort control, view/grid toggle, How...work" | Correct toolbar: "? How Smart Lists work | Columns ▾ | Me ▾ | Filters (N)". Add Person is a separate person-plus icon. "+ New List" is a top-right page button, not in the toolbar. |
| §6.1 Default columns | "checkbox · Name · Lead Score · Agent · Last Seen/Last Activity · Phone · Email · Created · Last Activity description" | Correct 8 columns: Name (+source sub-label) · Lead Score · Agent · Last Visit · Phone · Email · Last Activity · Tags. "Created" is not a default column; "Last Seen" and "Last Activity" are two different fields; Tags is a default column. |
| §6.1 Activity-sorted URL | `/2/people/list/activity` | Correct URL: `/2/people?sort=-lastLeadActivity` (query param, not a list ID path) |
| §6.1 Agent scope control | Called "Everyone dropdown" | The button label shows the CURRENT SELECTION ("Me" by default), not a static "Everyone" label. "Everyone" is an option inside the dropdown. |
| §6.5 Bulk actions list | 8 actions: "Update Stage, Update Agent, Assign Pond, Update Location, Merge People, Update Timeframe, Apply Action Plan, Delete People" | Correct 11-action main dropdown: Update Stage, Update Source, Assign Agent, Assign Ponds, Assign Lender, Add Collaborators, Remove Collaborators, Merge People, Mailing Label, Update Timeframe, Apply Automation. "Update Agent" → "Assign Agent". "Update Location" does not exist. "Apply Action Plan" → "Apply Automation". "Delete" is a separate icon, not in the dropdown. Plus separate tag icon sub-dropdown: Add Tags / Remove Tags. |
| §6.6 Button label | "Add Person" (capital P) | Correct: "Add person" (lowercase p) |
| §6.7 Export checkbox | "Export all contacts (overrides selection to the full list)" | Correct: "Export all columns" — this controls which FIELDS to export, not which CONTACTS. The selection always determines which contacts are exported. |
| §6.7 Export button | "To Last Exporter" | Correct: "Yes, export people" |
| §6.7 Export behavior | Implied synchronous (direct download) | Export is async: background generation → auto-download + email notification. |
| §6.2 Smart list names | "HotReady, Warm Ready, Idle Monthly, [Cave] Leads, Callable Monthly, GIC Leads" | Correct observed names: Active & Pending Clients, Hot/Weekly, Warm/Bi-Weekly, Past Clients/Sphere: Quarterly, New Leads: No Call Attempt, Cold/Bi-Monthly, Old Leads: No Call Attempt |

---

## 23. Cross-References

| Related spec section | File |
|---------------------|------|
| Smart List Collections, Manage Lists page | `06-smart-lists-and-collections.md` |
| Person Detail (3-column layout, timeline, compose) | `07-person-detail.md` |
| Stages configuration | `08-admin-stages.md` |
| Custom Fields | `08-admin-custom-fields.md` |
| Tags and auto-tags | `08-admin-tags.md` |
| Import contacts | `08-admin-import.md` |
| Ponds and assignment | `09-ponds-and-assignment.md` |
| Collaborators | `07-person-detail.md` §Collaborators |
| TCPA compliance | `.auto-memory/reference_tcpa_litigator_handling.md` |
| Smart list sharing | `.auto-memory/reference_fub_smart_list_sharing.md` |

---

## 24. Sources

### Static screenshots (primary observation)
- Shot-50: All People list at `/2/people/pond/1` — default columns, left sidebar, row anatomy, bulk action icon set, active filter chip vs. agent/pond dropdown distinction
- Shot-55: Pronghorn Neighborhood smart list with filter panel open — filter panel structure, smart list type badge, Edit link, Update List button purpose, pagination
- Shot-56: Pronghorn with bulk action dropdown open — 11-item main bulk dropdown (full transcription)
- Shot-57: Pronghorn with tag action dropdown open — 2-item tag sub-dropdown (Add Tags / Remove Tags)
- Shot-58: Agent/pond filter dropdown fully open — 3-section dropdown structure (Everyone/Me, PONDS, TEAM MEMBERS)
- Shot-59: Export Selected People modal fully documented — title, body, checkbox label, async description, button labels
- Shot-76: All People activity-sorted view (`?sort=-lastLeadActivity`) — activity icon differentiation (orange/flame vs. green house), TCPA smart list (125 contacts), filter panel empty state
- Shot-77: All People with email compose panel — confirms "Out Of State Home..." is agent/pond dropdown control (column preset), not a filter chip
- Shot-78: Add Person modal — all 4 fields, button labels, header icon, × close

### GIF analyses (dynamic behavior)
- `fub-analysis-gif/people.md` — skeleton loading state, filter panel persistence across navigation, "Me" dropdown 3-section structure, column chooser as right-panel flyout (not dropdown), "Update List" vs "+ New List" slot behavior, person detail 3-column layout, email compose async signature loading, Text tab provisioning placeholder, Tasks auto-generation, custom fields section with 11 demographic fields
- `fub-analysis-gif/smartlists.md` — Edit Smart List modal (full fields), filter panel expand/collapse per-filter states, compliance tag taxonomy (7 tags), static vs. dynamic list type distinction, per-list column configuration confirmed, empty state with column headers visible, count abbreviation rules (K format), sidebar count update polling behavior

### Official FUB documentation (verified 2026-06-30)
- `fub-docs/people-contacts.md` — Lead Profile structure, stages (3 system + custom), custom fields (4 types, 256-char limit), tags (64-char limit, attribution from 2021-06-14), relationships (25-phone limit across contact+relationships, 6 per import, 4 per export), collaborators (auto-remove on promotion), deduplication rules, delete vs. trash permissions, People screen layout, filter definitions (all categories), mass actions (10 types + limitations: no automation trigger, no action plans, no round robin, max 10 merge), export spec (default vs. all-columns field lists), mailing labels (Avery 5160, 30/sheet), file attachments (100MB max, unlimited quantity)
- `fub-docs/smart-lists.md` — Complete filter operator set (16 operators, 6 time units), all 9 filter categories (50+ filterable fields), default smart lists (6 pre-built), best-practice libraries (Gabe Cordova, Ryan Melville, FUB+Ylopo), smart list creation/management/deletion, collections (create/edit/delete/assign), sharing model (agents cannot share; only admins can), count update schedule (10-min polling + immediate triggers), smart list count stale window (up to 10 minutes), export from smart lists, mass action bypass of automations (explicit FUB architectural decision)

### Prior spec (superseded)
- `docs/FUB_CRM_FEATURE_SPEC.md` §6.1 All People, §6.5 bulk actions, §6.6 Add Person, §6.7 Export — reviewed for errors; corrections documented in §22
