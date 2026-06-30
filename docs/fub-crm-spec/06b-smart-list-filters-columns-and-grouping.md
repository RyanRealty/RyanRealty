# 06b — Module: People — Filter Engine, Column Chooser & Group-By

**Scope:** The right-edge filter flyout, the two-pane Column Chooser popover, the column-preset selector, and the Group-By picker on every People list view (All People, Collections, Smart Lists). Covers complete field catalogs, operator tables, boolean-AST filter engine design, GIF-confirmed dynamic behaviors, real Ryan Realty tag examples, and acceptance criteria.

**Cross-references:** `06a-smart-list-overview-and-collections.md` (left rail, list CRUD, Edit modal, sharing), `06c-people-list-table-and-bulk-actions.md` (table rows, sorting, bulk ops), `05-person-detail.md` (detail view).

**Ground-truth sources:** shots 65–75 (production screenshots, 2026-06-30); GIF interaction analyses `fub-analysis-gif/people.md` and `fub-analysis-gif/smartlists.md`; official FUB docs `fub-docs/smart-lists.md` and `fub-docs/people-contacts.md`; prior spec §6.4 (errors corrected below).

---

## Prior-spec errors corrected in this document

The following errors exist in the prior `FUB_CRM_FEATURE_SPEC.md` §6.4 and are superseded here:

1. **Column Chooser architecture was wrong.** Prior spec said "a right-edge panel with a two-column checkbox list." Correct: it is a **two-pane floating popover** anchored below the Columns toolbar button — left pane = 9 category rows with active-count badges, right pane = field checkboxes for the selected category. It is NOT a flat single-column checkbox list.

2. **"Parenthetical counts indicate active filter-condition counts" was wrong.** The `(N)` next to each category in the Columns picker left pane (e.g., "Details (10)", "Assigned (2)") counts **how many columns from that category are currently visible in the table** — not filter conditions. The `Filters (N)` badge on the toolbar button counts active filter rows.

3. **Column Chooser and filter-field picker are separate panels.** Prior spec implied a single combined panel. Correct: the Column Chooser (Columns button) and the filter flyout (Filters button) are independent panels. Opening Columns closes the filter panel and vice versa.

4. **Filter panel is a persistent right sidebar, not a flyout modal.** It slides in from the right edge and stays open while on the list. It does not overlay the full screen.

5. **Communication-derived field names had errors.** "Last Communication Email" (prior spec) is not a real field name. Correct names: "Last Email," "Last Sent Email," "Last Received Email," "Last Sent Batch Email," "Last Sent Action Plan Email," "Last Sent Marketing Campaign," "Last Email Activity." "Has No Text" and "Has Call" (prior spec) are not visible in screenshots; "Last Call is empty" is the equivalent filter operator.

6. **Tag values in the compliance exclusion filter were incomplete.** Prior spec listed generic "…" placeholders. The verified tag values from GIF ground truth are documented exhaustively in §4.3.

7. **"contact:do-not-text" listed in the task prompt does not appear in the Active & Pending Clients compliance exclusion filter.** The confirmed value is **"contact:do-not-email"** in that specific list. Both `contact:do-not-email` and `contact:do-not-text` exist in the Ryan Realty tag namespace; they appear on different smart list filters. See §4.3.

8. **Incomplete/empty-value filter rows are NOT counted in the Filters (N) badge.** Prior spec did not document this rule. A Price filter set to "is between" with empty range inputs does not increment the badge count.

---

## 1. Overview

Every People list view — All People, Collection items, and Smart Lists — shares the same filter and column system. Two independent controls appear in the toolbar:

| Control | Button label | Panel type | Panel slot |
|---|---|---|---|
| Column Chooser | `Columns ▾` | Two-pane floating popover, ~350 px wide | Anchored below the Columns button |
| Filter panel | `Filters (N)` | Persistent right sidebar, ~280 px wide | Right edge of the content area |

A third control — the column-preset selector ("Out Of State Home...") — sits between Columns and Filters in the toolbar and switches named column-visibility presets without opening any panel.

The "Update List" primary CTA button (blue, top-right, present only on Smart Lists) saves the current filter state back to the smart list's saved definition.

---

## 2. Filter panel — full specification

### 2.1 Opening and closing

- **Trigger:** clicking the `Filters (N)` button in the toolbar.
- **Behavior:** slides in from the right edge of the content area, pushing the table narrower (not an overlay). Clicking `Filters` again closes it.
- **Persistence across list navigation:** the panel stays open when switching between smart lists. On each navigation, it repopulates with the new list's saved filter set.
- **All People empty state:** switching to All People (no saved filters) leaves the panel open but shows a centered sliders-icon graphic + "No filters added yet" message. The panel does NOT close.
- **Smart list → smart list:** the panel stays open and transitions directly to the new list's filter rows with no intermediate close/reopen animation.

### 2.2 Panel anatomy

```
┌─────────────────────────────┐
│  [Add a filter]             │  ← search input, typeahead
├─────────────────────────────┤
│  ◉ Tags exclude any of:     │  ← collapsed filter row
│     complianc...         ▾  │
├─────────────────────────────┤
│  ⏱ Last Communication      │
│     more than...         ▾  │
├─────────────────────────────┤
│  ▦  Stage excludes any of: │
│     Active C...          ▾  │
├─────────────────────────────┤
│  ☎ Phone is good         ▾  │
│  ─────────────────────────  │  ← expanded filter row (inline)
│    ◉ is good                │
│    ○ starts with            │
│    ○ is not empty           │
│    ○ is empty               │
│    ○ is bad                 │
│  × (close expanded row)     │
├─────────────────────────────┤
│  ◉ Tags exclude any of:     │
│     Unsubscri...         ▾  │
├─────────────────────────────┤
│  👤 Agent includes any of:  │
│     Matt Ryan            ▾  │
├─────────────────────────────┤
│  ◉ Tags include any of:     │
│     Expired, wi...       ▾  │
├─────────────────────────────┤
│  Clear filters              │  ← gray text link, full-width
└─────────────────────────────┘
```

### 2.3 "Add a filter" typeahead

- A single-line text input at the top of the panel with placeholder "Add a filter."
- Clicking or typing opens a flat dropdown listing all filterable fields, grouped by category (DETAILS, ASSIGNED, EMAILS, CALLS, TEXTS, WEBSITE ACTIVITY, DEALS, INBOX APPS, CUSTOM FIELDS). See §3 for the complete field catalog.
- Typing filters the list in real time (partial-match search on field name).
- Selecting a field adds a new filter row to the panel in an expanded state ready for operator + value selection.

### 2.4 Collapsed filter row

Each filter row in the collapsed state shows:
- **Icon** (left): field-type icon — tag icon for Tags, clock icon for date/recency fields, stage-funnel icon for Stage, phone handset for Phone, person silhouette for Agent
- **Label + value summary** (center): `{field label} {operator}: {value summary}`, truncated with `…` if needed. Examples: "Tags exclude any of: complianc...", "Last Communication more than...", "Phone is good"
- **Chevron** (right): `▾` to expand

### 2.5 Expanded filter row

Clicking a collapsed row expands it **in place** (accordion pattern). Multiple rows can be expanded simultaneously (not exclusive). The expanded state shows:
- An **× close** button in the header to collapse without removing
- A **field-type-specific editor** (see §3 for per-type editors)
- Changes apply immediately (live filter) or require a confirm action (implementation decision — FUB appears to be live)

### 2.6 Removing a filter

- Within an expanded row: a remove/trash icon removes the filter entirely (distinct from the × which only collapses)
- Hovering a collapsed row may reveal a remove icon (inferred from FUB patterns)

### 2.7 "Clear filters" behavior

- Clicking "Clear filters" removes ALL active filter rows from the session view.
- This does **not** modify the smart list's saved definition. The "Filters (N)" badge resets to "Filters."
- To also persist the cleared state, the user must click "Update List."

### 2.8 "Update List" persistence

- The "Update List" button (blue, top-right of the list header; has a ↻ refresh icon) saves the current filter panel state to the smart list's saved definition permanently.
- After saving: the left rail badge count updates; the saved filters become the new base definition.
- Present **only on Smart Lists** (not on All People or static lists like "Active & Pending Clients").
- All People shows a "+ New List" button in the same slot.

### 2.9 Filters (N) badge count rules

- The badge shows the count of **complete, active filter rows** in the panel.
- A filter row is "active" only when it has a valid, non-empty value set. An "is between" row with empty range inputs does NOT increment the count.
- Example: 7 filter rows with values → badge shows `(7)`.
- Example: 5 filter rows + 1 row with empty range inputs → badge shows `(5)`.
- The badge disappears (shows no number) when the panel has 0 active filters.

---

## 3. Filter field catalog (complete)

All People and Smart List views expose the same full set of filterable fields, organized into 9 categories. Every field accessible as a column is also filterable (with appropriate operators for its type).

### 3.1 DETAILS

| Field | Type | Filter operators available |
|---|---|---|
| First Name | Text | is empty / is not empty / contains / does not contain / starts with |
| Last Name | Text | is empty / is not empty / contains / does not contain / starts with |
| Phone | Phone quality | is good / is bad / starts with / is not empty / is empty |
| Email | Email quality | is good / is bad / contains / is not empty / is empty |
| Address | Text | is empty / is not empty |
| Price | Number | is empty / is not empty / is less than / is greater than / is between |
| Tags | Multi-value string | are not empty / include any / include all / exclude any / exclude all / are empty |
| Stage | Enum | includes any of / excludes any of / is empty / is not empty |
| Source | String | includes any of / excludes any of / is empty / is not empty |
| Created | Date | was less than N [units] ago / was more than N [units] ago / is empty / is not empty |
| Updated | Date | was less than N [units] ago / was more than N [units] ago |
| Inactive | Date (broadest activity) | was less than N [units] ago / was more than N [units] ago |
| My Next Task | Task presence | is empty / is not empty |
| Last Activity | Date (lead-side only) | was less than N [units] ago / was more than N [units] ago |
| Last Communication | Date (two-way comms only) | was less than N [units] ago / was more than N [units] ago |
| Timeframe | Enum | includes any of / excludes any of |
| My Agent Status | Zillow status enum | includes any of / excludes any of / is empty / is not empty |

**Critical semantic distinctions (build-required):**

- **Inactive** = broadest: any profile touch (agent or lead, automated or manual, field updates, all comms, marketing emails). Use for "has anything happened on this record?"
- **Last Activity** = lead-side signals only (inquiries, website visits, IDX property views, saves). NOT agent-initiated actions. Use for "did the lead engage on their own?"
- **Last Communication** = two-way direct comms only (call, email, text, Inbox App message). Excludes Action Plan emails, Batch emails, marketing campaigns. This is the standard cadence filter.

**Timeframe enum values:** `0–3 Months`, `3–6 Months`, `6–12 Months`, `12+ Months`, `No Plans` (exactly 5 options).

**My Agent Status values:** `Active & Expiring Soon (within 30 days)`, `Active & Expiring Later (31+ days)`, `Expired`, `Declined`. Requires Zillow Two-Way Integration.

### 3.2 ASSIGNED

| Field | Type | Filter operators |
|---|---|---|
| Agent | User reference | includes any of / excludes any of / is empty / is not empty |
| Pond | Pond reference | includes any of / excludes any of / is empty / is not empty |
| Lender | User reference | includes any of / excludes any of / is empty / is not empty |
| Collaborators | User reference | includes any of / is empty / is not empty |

### 3.3 EMAILS

| Field | What it tracks | Filter operators |
|---|---|---|
| Last Email | Last inbound OR outbound (excl. marketing) | date relative operators |
| Last Sent Email | Last outbound to contact from any team member | date relative operators |
| Last Received Email | Last inbound from contact to any team member | date relative operators |
| Last Sent Batch Email | Last sent batch/blast email | date relative operators |
| Last Sent Automation Email | Last email sent via Action Plan | date relative operators |
| Last Sent Marketing Campaign | Last third-party marketing email (e.g., Mailchimp) | date relative operators |
| Emails Sent | Total count of outbound emails | is less than / is greater than / is between / is empty / is not empty |
| Emails Received | Total count of inbound emails | is less than / is greater than / is between / is empty / is not empty |
| Last Email Activity | Tracks opens and clicks (most recent) | date relative operators |

**Note:** "Last Communication" in DETAILS tracks only manual direct comms. "Last Sent Batch Email" and "Last Sent Automation Email" are separate fields that track automated/bulk sends specifically — important for building the correct query logic.

### 3.4 CALLS

| Field | What it tracks | Filter operators |
|---|---|---|
| Last Call | Last call to OR from any number on the profile | date relative operators / is empty / is not empty |
| Last Call Made | Last outgoing call | date relative operators / is empty / is not empty |
| Last Call Received | Last incoming call | date relative operators |
| Calls Made | Total outgoing call count | numeric range / is empty / is not empty |
| Calls Received | Total incoming call count | numeric range |
| Time to First Call | Elapsed time from creation to first call | numeric range / is empty / is not empty |
| Talk Time | Total cumulative talk time on phone | numeric range / is empty / is not empty |

### 3.5 TEXTS

| Field | What it tracks | Filter operators |
|---|---|---|
| Last Text | Last text sent to OR from any number | date relative operators / is empty / is not empty |
| Last Text Sent | Last outbound text from any team member | date relative operators / is empty / is not empty |
| Last Text Received | Last inbound text from any number | date relative operators |
| Texts Sent | Total outbound text count | numeric range |
| Texts Received | Total inbound text count | numeric range |

### 3.6 WEBSITE ACTIVITY

| Field | What it tracks | Filter operators |
|---|---|---|
| Properties Viewed | Count of listing pages viewed on IDX site | numeric range / is empty / is not empty |
| Properties Saved | Count of listings saved/favorited | numeric range / is empty / is not empty |
| Pages Viewed | Count of non-listing pages viewed (excludes property address pages) | numeric range |
| Last Visit | Date of last website visit (excludes initial lead-creation visit) | date relative operators / is empty / is not empty |
| Visits | Total unique website visit count | numeric range |

**Important:** All website activity fields require IDX integration. Non-integrated sites show empty values.

### 3.7 DEALS

| Field | What it tracks | Filter operators |
|---|---|---|
| Deal Stage | Stage of the deal with the closest upcoming close date matching filters | includes any of / excludes any of |
| Deal Close Date | Close date of the matched deal | date relative operators / sort |
| Deal Price | Price of the matched deal | numeric range / sort |

### 3.8 INBOX APPS

| Field | What it tracks | Filter operators |
|---|---|---|
| Last Inbox App Message | Last sent OR received Inbox App message | date relative operators |
| Last Sent Inbox App Message | Last outbound Inbox App message | date relative operators |
| Last Received Inbox App Message | Last inbound Inbox App message | date relative operators |
| Last Marketing Message Reply | Last reply to a partner integration's marketing text or Inbox App conversation | date relative operators / is empty / is not empty |
| Inbox App Messages Sent | Total outbound Inbox App message count | numeric range |
| Inbox App Messages Received | Total inbound Inbox App message count | numeric range |

### 3.9 CUSTOM FIELDS

All 64 custom fields configured in this Ryan Realty account appear in this category. Filterable based on field type:

| Custom field type | Available filter operators |
|---|---|
| Text (256-char limit) | is empty / is not empty / contains |
| Number (whole numbers only) | is empty / is not empty / is less than / is greater than / is between |
| Date | is empty / is not empty / was less than N days ago / was more than N days ago / upcoming date filters |
| Dropdown | is empty / is not empty / includes specific options / excludes specific options |

**Ryan Realty enrichment fields in Custom Fields** (observed in shot-74, right pane when Custom Fields category is selected):
`Recently Divorced`, `Recently Moved`, `Enrichment Provider`, `Phone Type`, `Net Worth Range`, `Income Range`, `Occupation`, `Has Children`, `Household Size`, `Marital Status`, `Gender`, `Birthday`

These are FUB enrichment fields populated via a third-party enrichment provider. All appear blank on un-enriched contacts.

**Other high-use custom fields in Ryan Realty instance** (from prior spec §15 / Admin > Custom Fields):
`Include in FB CAS` (7,255 contacts), `Realtor License` (163), `Realtor Type` (163), `Realtor Brokerage` (163).

---

## 4. Filter editors by field type

### 4.1 Tags filter editor (ground-truth GIF: Screen 5 + 6)

The Tags filter editor is the most complex and most-used filter in the Ryan Realty instance.

**Operator radio buttons (4 options):**
```
○ are not empty
◉ include any          ← use include or exclude + chip list
○ exclude any
○ are empty
```

When `include any` or `exclude any` is selected, the editor shows:
- Multi-select chip row: each selected tag value renders as a removable chip with `×`
- A `[+]` button to add more values (opens tag search/autocomplete)
- Values can be colon-namespaced (`compliance:hard-stop`) or bare strings (`Bounced`)

**Rendering detail:**
- Each tag chip: rounded pill, ~`bg-muted/40` background, dark text, `×` remove button on right
- The chip row wraps to multiple lines if many tags are selected

**"any" toggle within include/exclude:**
FUB shows "include **any**" and "exclude **any**" — the word "any" is an inline toggle that changes to "all" for `include all` / `exclude all` semantics. This gives 4 distinct tag filter modes total.

### 4.2 Stage filter editor

**Operator radio buttons:**
```
◉ include
○ exclude
```
Selected chips + `[+]` add button for stage values. Stage values are the Ryan Realty stage enum (see §16.2 of the master spec for the full 16-stage list).

### 4.3 Phone filter editor (ground-truth: shot-75, Filter 4 expanded)

**Operator radio buttons (5 options):**
```
◉ is good
○ starts with
○ is not empty
○ is empty
○ is bad
```

"is good" is the canonical FUB phone-quality flag — a validated, callable, non-DNC number. Corresponds to the green phone icon in the table (§6c).

"is bad" = flagged as invalid or disconnected by FUB's phone validation layer.

"starts with" = area code or partial number prefix filter (e.g., starts with "541" for Central Oregon numbers).

### 4.4 Date / recency filter editors

Used for: Created, Updated, Inactive, Last Activity, Last Communication, Last Call, Last Text, Last Email, Last Received Email, Last Visit, and all other date-derived fields.

**Operators:**
```
○ was less than  [N] [minutes/hours/days/weeks/months/years] ago
◉ was more than  [N] [minutes/hours/days/weeks/months/years] ago
○ is empty
○ is not empty
```

The N field is a numeric input; the unit is a dropdown. Real Ryan Realty examples:
- "Last Text Sent more than 7 days ago" (Hot/Weekly)
- "Last Text Sent more than 14 days ago" (Warm/Bi-Weekly)
- "Last Text Sent more than 60 days ago" (Cold/Bi-Monthly)
- "Last Call more than 7 days ago" (Hot/Weekly)
- "Last Call is empty" (No-Call-Attempt lists)
- "Last Communication more than [N] days ago" (All Expireds)
- "Created less than 14 days ago" (New Leads: No Call Attempt)
- "Created more than 14 days ago" (Old Leads: No Call Attempt)

### 4.5 Price / numeric filter editor

**Operators:**
```
○ is not empty
○ is less than     [value]
○ is greater than  [value]
◉ is between       [min value] — [max value]
○ is empty
```

The "is between" operator shows two numeric input fields. When both inputs are empty, the filter row is present in the panel but does NOT count toward the `Filters (N)` badge.

### 4.6 Agent / multi-select filter editor

**Operator:** `includes any of` (single mode — no radio toggle)

Multi-select picker showing all team members with avatars. Real Ryan Realty example: `Agent includes any of: Matt Ryan`.

### 4.7 Source filter editor

**Operators:** `includes any of` / `excludes any of`

Multi-select picker of all lead sources in the account. Real example (New Leads: No Call Attempt): `Source excludes any of: [specific sources]`.

---

## 5. Real Ryan Realty filter examples

### 5.1 Compliance exclusion block (appears on EVERY pipeline smart list)

This is the global compliance gate. It is filter #1 on every pipeline-cadence smart list in the Ryan Realty instance.

**Active & Pending Clients / Hot/Weekly / Warm/Bi-Weekly / Cold/Bi-Monthly / Old Leads (GIF ground truth):**
```
Tags  exclude any of:
  [compliance:hard-stop ×]  [tcpa:litigator ×]  [Bounced ×]
  [contact:do-not-email ×]  [Unsubscribed ×]
  [do_not_text ×]  [NOTEXT ×]
  [+]
```

**Warm/Bi-Weekly additional exclusion tags (from shot-65):**
```
  [Realtor ×]  [audience:broker-recruit ×]
```
(These two tags exclude real estate agents and broker-recruit prospects from the prospect outreach cadence lists.)

**Tag taxonomy reference for the Ryan Realty compliance namespace:**

| Tag value | Namespace | Meaning |
|---|---|---|
| `compliance:hard-stop` | `compliance:` | TCPA or legal hard stop — never contact |
| `tcpa:litigator` | `tcpa:` | Known TCPA litigator |
| `contact:do-not-email` | `contact:` | Opt-out of all email |
| `contact:do-not-text` | `contact:` | Opt-out of all SMS (separate from do-not-email) |
| `Bounced` | bare | Email address has bounced |
| `Unsubscribed` | bare | Unsubscribed from marketing |
| `do_not_text` | bare (underscore) | Legacy DNC-text flag |
| `NOTEXT` | bare (all-caps) | Legacy DNC-text flag (alternate format) |
| `Realtor` | bare | Contact is a real estate agent |
| `audience:broker-recruit` | `audience:` | Broker-recruit prospect — exclude from buyer/seller outreach |

**Note:** `contact:do-not-text` and `contact:do-not-email` are distinct tags. The compliance exclusion filter on some lists includes one, some lists include both.

### 5.2 All Expireds smart list — complete 7-filter definition

```
Filter 1:  Tags exclude any of:  [compliance:hard-stop] [tcpa:litigator]
                                  [Bounced] [contact:do-not-email]
                                  [Unsubscribed] [do_not_text] [NOTEXT]

Filter 2:  Last Communication  more than  [N]  days  ago

Filter 3:  Stage  excludes any of:  [Active Client]

Filter 4:  Phone  is good

Filter 5:  Tags  exclude any of:  [Unsubscribed]
           (Note: Unsubscribed is also in Filter 1 — dual exclusion on
            different filter rows is a user-authored redundancy, not a bug)

Filter 6:  Agent  includes any of:  [Matt Ryan]

Filter 7:  Tags  include any of:  [Expired]  [Withdrawn]
```

Left rail badge (cached): ~431–477 contacts (fluctuates; 10-min polling).
"Showing 24 people": count after all 7 runtime filters applied.

### 5.3 Hot/Weekly — complete 5-filter definition

```
Filter 1:  Tags exclude any of:  [compliance:hard-stop] [tcpa:litigator]
                                  [Bounced] [contact:do-not-email]
                                  [Unsubscribed] [do_not_text] [NOTEXT]

Filter 2:  Last Text Sent  more than  7  days  ago

Filter 3:  Last Sent Email  more than  7  days  ago

Filter 4:  Last Call  more than  7  days  ago

Filter 5:  Stage  includes any of:  [A - Hot 1-3 Months]
```

### 5.4 Standard pipeline filter template

All 6 pipeline cadence lists follow the same pattern (varying only N and stage bucket):

```
1. Tags exclude compliance block
2. Last Text Sent  more than  N  days  ago
3. Last Sent Email  more than  N  days  ago
4. Last Call  more than  N  days  ago
5. Stage  includes any of:  [stage-specific values]
```

Cadences: Hot = 7 days, Warm = 14 days, Cold = 60 days, Past Clients = 90+ days.

No-Call-Attempt lists replace filters 2–4 with:
```
2. Last Call  is empty
3. Phone  is good
4. Created  [less/more than]  14  days  ago
```

---

## 6. Column Chooser — two-pane popover

### 6.1 Architecture

The Column Chooser opens as a **two-pane floating popover** (~350 px wide) anchored below the `Columns ▾` toolbar button. It floats over the table content area and stays open while the user interacts with it. Clicking outside or clicking `Columns` again closes it.

The popover is NOT a right-panel flyout — it is a standalone dropdown-style panel, separate from the filter panel slot.

```
┌──────────────────────────────────────────────────────────────┐
│ LEFT PANE (~160px)          │ RIGHT PANE (~190px)            │
│ ─────────────────           │ ───────────────────            │
│ 🗂  Details      (10)       │ ☐ First Name                   │
│ 👤  Assigned     (2)        │ ☐ Last Name                    │
│ ✉   Emails       (1)        │ ☑ Phone         ▾              │
│ ☎   Calls                   │ ☑ Email                        │
│ 💬  Texts        (1)        │ ☐ Address                      │
│ 🌐  Website activity (5)    │ ☑ Price                        │
│ 🤝  Deals                   │ ☑ Tags          ▾              │
│ 📱  Inbox Apps              │ ☑ Stage         ▾              │
│ ✏️   Custom Fields          │ ☑ Source                       │
│                             │ ☑ Created       ↓              │
│                             │ ☑ Updated                      │
│                             │ ☐ Inactive                     │
│                             │ ☐ My Next Task                 │
│                             │ ☑ Last Activity                │
│                             │ ☑ Last Communication  ▾        │
│                             │ ☐ Timeframe                    │
│                             │ ☐ My Agent Status              │
└──────────────────────────────────────────────────────────────┘
```

*(Right pane shows Details category selected.)*

### 6.2 Left pane — category list

9 categories with icons and active-column counts in parentheses:

| Category | Icon type | Count shown (All Expireds "Out Of State Home..." preset) |
|---|---|---|
| Details | grid/table icon | (10) |
| Assigned | person/user icon | (2) |
| Emails | envelope icon | (1) |
| Calls | phone handset icon | — (no active columns) |
| Texts | speech bubble icon | (1) |
| Website activity | globe/cursor icon | (5) |
| Deals | dollar/handshake icon | — |
| Inbox Apps | grid-of-apps icon | — |
| Custom Fields | pencil/edit icon | — |

**Count semantics:** the `(N)` next to each category = the number of columns from that category that are **currently visible/checked** in the table. Not total available, not filter conditions.

Clicking a category row updates the right pane to show that category's fields.

### 6.3 Right pane — column toggles

Each row in the right pane:
- Checkbox (blue when checked)
- Column name
- Optional sub-icons:
  - `▾` = sub-option available (Phone: choose phone type; Tags: choose display mode; Stage: choose which stage property to display)
  - `↓` or `↑` = current active sort direction on this column

**Interaction:** checking/unchecking a column adds or removes it from the table view. Changes apply immediately (no "Apply" button). Dragging rows reorders column display order (drag handle on left of each row — inferred from FUB conventions).

### 6.4 Complete field lists per category

**Details (17 available fields):**
First Name, Last Name, Phone ▾, Email, Address, Price, Tags ▾, Stage ▾, Source, Created, Updated, Inactive, My Next Task, Last Activity, Last Communication, Timeframe, My Agent Status

**Assigned (4 fields):**
Agent ▾ (with filter funnel icon = this column is filterable inline), Pond, Lender, Collaborators

**Emails (9 fields):**
Last Email, Last Sent Email, Last Received Email, Last Sent Batch Email, Last Sent Automation Email, Last Sent Marketing Campaign, Emails Sent, Emails Received, Last Email Activity

**Calls (7 fields):**
Last Call, Last Call Made, Last Call Received, Calls Made, Calls Received, Time to First Call, Talk Time

**Texts (5 fields — from official docs; "Last Text Received" confirmed in shots):**
Last Text, Last Text Sent, Last Text Received, Texts Sent, Texts Received

**Website activity (5 fields):**
Properties Viewed, Properties Saved, Pages Viewed, Last Visit, Visits

**Deals (3 fields):**
Deal Stage, Deal Close Date, Deal Price

**Inbox Apps (6 fields):**
Last Inbox App Message, Last Sent Inbox App Message, Last Received Inbox App Message, Last Marketing Message Reply, Inbox App Messages Sent, Inbox App Messages Received

**Custom Fields:**
All 64 configured custom fields for the Ryan Realty account. Includes enrichment demographics (Recently Divorced, Recently Moved, Phone Type, Net Worth Range, Income Range, Occupation, Has Children, Household Size, Marital Status, Gender, Birthday, Enrichment Provider) and operational fields (Include in FB CAS, Realtor License/Type/Brokerage).

### 6.5 Column preset / saved view selector

Between the `Columns ▾` button and `Filters (N)` button in the toolbar sits a dropdown chip showing the current column preset name. In the Ryan Realty "All Expireds" list, this shows "Out Of State Home ..." (truncated, full name likely "Out Of State Home Owners" matching the pond name).

**What it is:** a named saved configuration of column visibility and column order, separate from both the Column Chooser active state and the smart list's filter definition. Multiple presets can exist per smart list.

**Interaction:** clicking opens a dropdown of preset names. Selecting one changes which columns are visible without affecting filters or the smart list's saved definition. Selecting a different preset is a view-level change only.

**Implementation note:** presets are stored as ordered arrays of column keys, scoped to a smart list and user (or shared). The currently active preset is shown in the toolbar chip.

---

## 7. Group-By picker

A separate control (distinct from the Column Chooser) that groups the result rows by a shared dimension. Confirmed dimensions from prior spec analysis of shots 65–72:

- **Agent** — groups rows by assigned agent
- **Portal** — groups rows by lead source portal (Zillow, Realtor.com, Ryan-Realty.com, etc.)
- **Connections** — groups rows by relationship / connected contact

When Group-By is active, the table re-renders with sticky group header rows and per-group row counts. The Group-By picker is accessible from the toolbar (exact button label/placement not confirmed in shots 73–75 but documented in shots 65–72 analysis in the prior spec).

---

## 8. Two-layer filtering model

Understanding the relationship between the left rail badge count and "Showing N people":

```
Smart list saved definition
│  (e.g., All Expireds: 7 saved filter conditions)
│
▼
Left rail badge count = total contacts matching saved definition
│  (e.g., 431–477 — cached, updates on 10-min poll or on list click)
│
▼  runtime session filters (same 7 conditions, visible in filter panel)
▼  + any additional runtime filters added this session
│
▼
"Showing N people" = actual displayed count
│  (e.g., 24 — reflects all active filter conditions)
```

The badge can diverge from "Showing N" because:
1. The cache is up to 10 minutes stale (design decision from FUB — not a bug)
2. The user has added runtime filter conditions beyond the saved definition
3. The "Out Of State Home..." column preset does NOT add filter conditions (it only affects column visibility), so it does not explain a count reduction on its own

**Clicking "Update List"** saves the current filter panel state to the smart list's saved definition, re-evaluates, and syncs the badge count.

---

## 9. Boolean-AST filter engine

### 9.1 Semantics

- All filter rows on a smart list are combined with **AND** (a contact must match every condition to appear)
- Within a Tags filter using "include any": `tags OVERLAP [value1, value2, ...]` (OR within the values)
- Within a Tags filter using "include all": `tags CONTAINS ALL [value1, value2, ...]` (AND within the values)
- Within a Tags filter using "exclude any": `NOT (tags OVERLAP [value1, value2, ...])`
- Within a Stage filter using "includes any of": `stage IN [v1, v2, ...]`

### 9.2 Data model

```typescript
interface SmartListFilter {
  id: string;
  field: FilterField;          // enum of all 50+ filterable fields
  operator: FilterOperator;
  values: FilterValue[];       // string[], number[], or date-threshold
  threshold?: {
    value: number;
    unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';
  };
}

type FilterOperator =
  // presence
  | 'is_empty' | 'is_not_empty'
  // string
  | 'contains' | 'does_not_contain' | 'starts_with'
  // phone/email quality
  | 'is_good' | 'is_bad'
  // numeric
  | 'is_less_than' | 'is_greater_than' | 'is_between'
  // date relative
  | 'was_less_than' | 'was_more_than'
  // multi-value inclusion
  | 'includes_any_of' | 'includes_all_of'
  | 'excludes_any_of' | 'excludes_all_of';

interface SmartListDefinition {
  id: string;
  name: string;
  emoji?: string;
  description: string;           // rich text, max 1000 chars
  type: 'static' | 'pipeline';  // controls Update List button visibility
  filters: SmartListFilter[];    // AND-combined
  columns: ColumnConfig[];       // ordered visible columns
  columnPresets: ColumnPreset[]; // named saved column configurations
  groupBy?: 'agent' | 'portal' | 'connections';
  collectionId?: string;
  ownerId: string;
  visibility: 'private' | 'shared_all' | 'shared_selected';
  shareTargetIds: string[];      // user IDs when visibility = shared_selected
  cachedCount: number;
  cachedAt: Date;
}

interface ColumnConfig {
  field: string;
  order: number;
  sortDir?: 'asc' | 'desc';
}

interface ColumnPreset {
  id: string;
  name: string;
  columns: ColumnConfig[];
}
```

### 9.3 Query evaluation

Filters with date-relative operators (`was_more_than`, `was_less_than`) evaluate against `NOW()` at query time — never stored as absolute dates. The computed fields (Last Communication, Last Call, Last Text, Talk Time, Time to First Call) are derived from the `crm_timeline` event log. They must be indexed for filter performance.

```sql
-- Example: "Last Call more than 7 days ago" filter
AND (
  SELECT MAX(occurred_at)
  FROM crm_timeline
  WHERE person_id = p.id
    AND event_type IN ('call_outbound', 'call_inbound')
) < NOW() - INTERVAL '7 days'

-- Example: "Tags exclude any of" filter
AND NOT EXISTS (
  SELECT 1 FROM crm_person_tags pt
  JOIN crm_tags t ON pt.tag_id = t.id
  WHERE pt.person_id = p.id
    AND t.name = ANY(ARRAY['compliance:hard-stop', 'tcpa:litigator', ...])
)
```

### 9.4 Smart list count caching

The sidebar badge count is a cached integer, not a live query:

```typescript
interface SmartListCountCache {
  listId: string;
  count: number;
  computedAt: Date;
  ttl: 600;  // 10 minutes (FUB's documented polling interval)
}
```

Invalidate immediately on: list filter save (Update List), new contact creation, contact stage change. Re-compute in background; do not block the UI.

---

## 10. GIF-confirmed dynamic behaviors

From `fub-analysis-gif/people.md` and `fub-analysis-gif/smartlists.md`:

1. **Filter panel persists across smart list navigation** — the panel stays open and repopulates with the new list's filters when the user clicks a different list in the left rail. No close/reopen animation.

2. **All People clears to empty state** — switching to All People (which has no saved filters) shows "No filters added yet" with a sliders graphic. Panel stays open.

3. **Skeleton loading on list navigation** — when a new list loads, the table immediately shows gray animated placeholder rows at the correct row height while data loads. Not a spinner. Column headers remain visible during skeleton state.

4. **Filter panel is NOT exclusive with the table** — the filter panel is a persistent right sidebar. The table area narrows to accommodate it. Scrolling the table works independently of the panel.

5. **Both filter rows can be expanded simultaneously** — the GIF shows Tags filter and Stage filter both expanded at once. This is NOT an accordion (not one-at-a-time). Multiple rows open at once is allowed.

6. **"Me" dropdown is a floating dropdown (not a right panel)** — clicking `Me` in the toolbar opens a floating dropdown at that button, NOT a slide-in panel. It has three sections:
   - Solo options: `Everyone` / `Me`
   - **PONDS:** `View All Ponds` + named ponds (e.g., "Out Of State Home Owners")
   - **TEAM MEMBERS:** Matt Ryan, Paul Stevenson, Rebecca Peterson (with avatars)

7. **Columns button opens a popover (floating), not a right panel** — despite GIF analysis describing it as a "right-edge panel," static screenshot analysis (shots 73–74) shows it is a two-pane floating popover anchored below the Columns button, overlaying the table. The static screenshots are the higher-fidelity source.

8. **"Update List" appears only on pipeline/dynamic smart lists** — absent on "Active & Pending Clients" (described as "a static list"). Present on Hot/Weekly, Warm/Bi-Weekly, Cold/Bi-Monthly, All Expireds, etc.

9. **Filter badge disappears at zero** — when a list has 0 active filters (or user clears them), the button shows "Filters" with no count badge. Not "Filters (0)."

10. **Filters badge counts filter ROWS, not tag values within a row** — 7 tag values in one "Tags exclude" row = 1 filter row = `Filters (1)`. An "is between" row with empty inputs = 0 counted rows.

11. **Empty state in the table** — "No people found" + "No people match filters, try another search" + illustrated placeholder. Table column headers remain visible above the empty state.

12. **Columns picker shows per-list column configuration** — each smart list has its own saved column set. Switching lists changes the active column set. Per-list column persistence is saved via Update List or via the column preset.

---

## 11. Data model — stored fields required

```sql
-- Extend crm_people / crm_contacts table:
ALTER TABLE crm_people ADD COLUMN IF NOT EXISTS
  last_communication_at   timestamptz,  -- two-way comms only
  last_activity_at        timestamptz,  -- lead-side signals only
  last_email_at           timestamptz,
  last_sent_email_at      timestamptz,
  last_received_email_at  timestamptz,
  last_batch_email_at     timestamptz,
  last_action_plan_email_at timestamptz,
  last_text_at            timestamptz,
  last_text_sent_at       timestamptz,
  last_text_received_at   timestamptz,
  last_call_at            timestamptz,
  last_call_made_at       timestamptz,
  last_call_received_at   timestamptz,
  last_visit_at           timestamptz,  -- website visit (excludes initial)
  last_inbox_app_at       timestamptz,
  last_marketing_text_reply_at timestamptz,
  emails_sent_count       int DEFAULT 0,
  emails_received_count   int DEFAULT 0,
  calls_made_count        int DEFAULT 0,
  calls_received_count    int DEFAULT 0,
  texts_sent_count        int DEFAULT 0,
  texts_received_count    int DEFAULT 0,
  properties_viewed_count int DEFAULT 0,
  properties_saved_count  int DEFAULT 0,
  pages_viewed_count      int DEFAULT 0,
  total_visits_count      int DEFAULT 0,
  inbox_app_sent_count    int DEFAULT 0,
  inbox_app_received_count int DEFAULT 0,
  time_to_first_call_seconds int,       -- seconds from created_at to first call
  talk_time_seconds       int DEFAULT 0,
  inactive_at             timestamptz,  -- broadest: any profile touch
  updated_at              timestamptz,  -- last profile field edit
  phone_quality           text,         -- 'good' | 'bad' | 'unknown'
  email_quality           text;

-- Indexes for filter performance:
CREATE INDEX idx_crm_people_last_communication ON crm_people(last_communication_at);
CREATE INDEX idx_crm_people_last_call ON crm_people(last_call_at);
CREATE INDEX idx_crm_people_last_text ON crm_people(last_text_at);
CREATE INDEX idx_crm_people_stage ON crm_people(stage);
CREATE INDEX idx_crm_people_agent ON crm_people(assigned_agent_id);
CREATE INDEX idx_crm_people_phone_quality ON crm_people(phone_quality);
CREATE INDEX idx_crm_people_created ON crm_people(created_at);
-- GIN index for tags array filtering:
CREATE INDEX idx_crm_person_tags_gin ON crm_person_tags USING gin(tag_names);
```

The computed fields (last_*_at, *_count, talk_time_seconds, time_to_first_call_seconds) are maintained by the timeline event processor — updated whenever a crm_timeline row is inserted or the relevant event type fires. They are **materialized denormalizations** to make filter queries fast; do not compute them live at query time for large result sets.

---

## 12. Ryan Realty design system mapping

The filter and column panels use the Ryan Realty design system (`design_system/ryan-realty/`, `@/components/ui/`) — never FUB's blue/teal palette.

| FUB UI element | Ryan Realty token / component |
|---|---|
| Filter panel background | `bg-card` (`#faf8f4` cream in light mode) |
| Filter panel border (left edge) | `border-border` (navy at `rgba(16,39,66,0.12)`) |
| Filter row dividers | `<Separator>` from `@/components/ui/separator` |
| Tag chips in filter editor | `<Badge variant="secondary">` from `@/components/ui/badge`, pill shape |
| Operator radio buttons | `<RadioGroup>` + `<RadioGroupItem>` from `@/components/ui/` (pending shadcn) or custom with `text-primary` active state |
| Checkbox in column chooser | `<Checkbox>` from `@/components/ui/checkbox`, `accent-primary` when checked |
| "Add a filter" input | `<Input>` from `@/components/ui/input`, `bg-background` |
| "Update List" button | `<Button variant="default">` (navy `bg-primary`, cream text) |
| "Clear filters" link | `<Button variant="ghost" size="sm">` or `<a className="text-muted-foreground">` |
| Filter panel column chooser popover | `<Popover>` from `@/components/ui/popover` |
| Category left pane hover state | `bg-accent` (`rgba(16,39,66,0.08)`) |
| Category active selection | `bg-primary text-primary-foreground` (navy background) |
| Checkbox checked state | `bg-primary` (navy fill) |
| "Filters (N)" badge | `<Badge>` inside `<Button>` or `<Button>` with inline count |
| Filter count badge | `text-xs font-medium` in `()` format inline with button label |
| Panel header "Add a filter" placeholder | `text-muted-foreground` |
| Font (all filter/column panel text) | Geist (`--font-sans`) — NOT Amboqia |

**Color tokens (no raw hex):**
- Navy `#102742` = `bg-primary` / `text-primary`
- Cream `#faf8f4` = `bg-card` / `bg-background`
- Borders = `border-border`
- Muted text = `text-muted-foreground`

**Do NOT use:** `bg-blue-600`, any teal, `#4A90D9`, `#3AAFA9`, or any FUB brand color. All interactive states use navy + cream system tokens.

---

## 13. Component architecture

```tsx
// Filter panel (right sidebar — persistent)
<FilterPanel
  open={filterPanelOpen}
  filters={activeFilters}
  onAddFilter={addFilter}
  onUpdateFilter={updateFilter}
  onRemoveFilter={removeFilter}
  onClearFilters={clearAllFilters}
>
  <AddFilterInput
    onSearch={searchFilterFields}
    onSelect={addFilter}
  />
  {activeFilters.map(filter => (
    <FilterRow
      key={filter.id}
      filter={filter}
      expanded={expandedFilterIds.includes(filter.id)}
      onToggleExpand={() => toggleExpand(filter.id)}
      onRemove={() => removeFilter(filter.id)}
    >
      <FilterEditor
        field={filter.field}
        operator={filter.operator}
        values={filter.values}
        threshold={filter.threshold}
        onChange={updateFilter}
      />
    </FilterRow>
  ))}
  <ClearFiltersButton onClick={clearAllFilters} disabled={activeFilters.length === 0} />
</FilterPanel>

// Column chooser (floating popover)
<Popover open={columnChooserOpen} onOpenChange={setColumnChooserOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline" onClick={() => setColumnChooserOpen(true)}>
      <ColumnsIcon /> Columns
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[350px] p-0" align="start">
    <ColumnChooser
      categories={COLUMN_CATEGORIES}
      activeColumns={activeColumns}
      selectedCategory={selectedCategory}
      onCategorySelect={setSelectedCategory}
      onColumnToggle={toggleColumn}
    >
      <ColumnCategoryList
        categories={COLUMN_CATEGORIES}
        activeCounts={activeColumnCounts}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />
      <ColumnFieldList
        fields={COLUMN_CATEGORIES[selectedCategory].fields}
        activeColumns={activeColumns}
        onToggle={toggleColumn}
        sortedColumn={currentSortColumn}
        sortDir={currentSortDir}
      />
    </ColumnChooser>
  </PopoverContent>
</Popover>

// Column preset selector
<Select
  value={activePresetId}
  onValueChange={setActivePreset}
>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Default columns" />
  </SelectTrigger>
  <SelectContent>
    {columnPresets.map(preset => (
      <SelectItem key={preset.id} value={preset.id}>
        {preset.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

// Filter badge in toolbar
<Button
  variant="outline"
  onClick={toggleFilterPanel}
  data-active={filterPanelOpen}
>
  <FilterIcon />
  Filters
  {activeFilterCount > 0 && (
    <span className="ml-1">({activeFilterCount})</span>
  )}
</Button>

// Tag filter editor
<TagFilterEditor
  mode={filter.operator}  // 'include_any' | 'exclude_any' | 'is_empty' | 'is_not_empty'
  values={filter.values}
  onModeChange={(mode) => updateFilter({ ...filter, operator: mode })}
  onAddValue={(tag) => updateFilter({ ...filter, values: [...filter.values, tag] })}
  onRemoveValue={(tag) => updateFilter({ ...filter, values: filter.values.filter(v => v !== tag) })}
>
  <RadioGroup value={filter.operator} onValueChange={onModeChange}>
    <RadioGroupItem value="is_not_empty" label="are not empty" />
    <RadioGroupItem value="include_any" label="include any" />
    <RadioGroupItem value="exclude_any" label="exclude any" />
    <RadioGroupItem value="is_empty" label="are empty" />
  </RadioGroup>
  {(filter.operator === 'include_any' || filter.operator === 'exclude_any') && (
    <TagChipList
      values={filter.values}
      onRemove={onRemoveValue}
      onAdd={onAddValue}
    />
  )}
</TagFilterEditor>

// Phone filter editor
<PhoneFilterEditor
  value={filter.operator}
  onChange={(op) => updateFilter({ ...filter, operator: op })}
  startsWith={filter.values[0]}
  onStartsWithChange={(v) => updateFilter({ ...filter, values: [v] })}
>
  <RadioGroup value={filter.operator} onValueChange={onChange}>
    <RadioGroupItem value="is_good"      label="is good" />
    <RadioGroupItem value="starts_with"  label="starts with" />
    <RadioGroupItem value="is_not_empty" label="is not empty" />
    <RadioGroupItem value="is_empty"     label="is empty" />
    <RadioGroupItem value="is_bad"       label="is bad" />
  </RadioGroup>
  {filter.operator === 'starts_with' && (
    <Input value={filter.values[0]} onChange={onStartsWithChange} placeholder="e.g. 541" />
  )}
</PhoneFilterEditor>
```

---

## 14. Acceptance criteria

### Filter panel

- [ ] `Filters (N)` button in the toolbar toggles the right-side filter panel open/closed
- [ ] Filter panel slides in without overlaying the header or toolbar; table narrows to accommodate
- [ ] Navigating to a different smart list repopulates the panel with that list's filter set (no close/reopen)
- [ ] Navigating to All People shows "No filters added yet" empty state (panel stays open)
- [ ] "Add a filter" typeahead shows all 50+ filterable fields grouped by the 9 categories; typing filters by partial name
- [ ] Selecting a field from the picker adds a new expanded filter row with operator editor
- [ ] Each filter row is independently expandable; multiple rows can be expanded simultaneously
- [ ] Tags filter renders 4 operator modes (are not empty / include any / exclude any / are empty) with chip editor for include/exclude modes
- [ ] Phone filter renders 5 operator modes (is good / starts with / is not empty / is empty / is bad) as radio buttons
- [ ] Date/recency filter accepts a numeric value + time-unit dropdown for `was_more_than` / `was_less_than` operators
- [ ] Price filter renders 5 operators including "is between" with two range inputs
- [ ] Stage filter renders include/exclude radio + multi-select chip list
- [ ] Agent filter renders multi-select with avatar-preceded user options
- [ ] Tag chip rendering: namespaced tags (`compliance:hard-stop`) render as a single pill; each chip has an × remove button
- [ ] The compliance exclusion block (§5.1) renders correctly for 7 tag values without truncation failure
- [ ] Filter count badge shows `(N)` only when N > 0; hidden at 0
- [ ] An "is between" filter row with empty range inputs does NOT increment the filter count
- [ ] "Clear filters" removes all filter rows; table reverts to the raw smart list membership
- [ ] "Update List" saves current filter state as the smart list's new definition; badge count updates
- [ ] Filter changes apply live (table re-queries on each change) OR via an "Apply" confirmation — must choose and implement consistently

### Column Chooser

- [ ] `Columns ▾` button opens a two-pane floating popover anchored below the button
- [ ] Left pane shows all 9 categories with icons and active-column counts in `(N)` format
- [ ] Clicking a category updates the right pane to show that category's fields
- [ ] Right pane shows checkboxes for each field; checked = column visible in table
- [ ] Checking a field adds the column to the table immediately; unchecking removes it
- [ ] `(N)` count next to each category reflects how many columns from that category are currently visible
- [ ] Phone, Tags, Stage column rows show `▾` sub-option indicator; clicking it opens sub-configuration
- [ ] Currently sorted column shows `↓` or `↑` sort-direction indicator in the right pane
- [ ] Closing the popover (click outside or click Columns again) preserves column state
- [ ] Custom Fields category shows all 64 Ryan Realty custom fields including enrichment demographic fields

### Column preset selector

- [ ] Preset dropdown shows the current active preset name (truncated if needed)
- [ ] Switching presets changes the active column set without affecting saved filter definitions
- [ ] "Out Of State Home Owners" preset loads the correct column configuration for that view

### Group-By

- [ ] Group-By picker exposes at minimum: Agent, Portal, Connections
- [ ] Selecting a Group-By dimension re-renders the table with sticky group header rows and per-group counts
- [ ] Clearing Group-By returns to flat list view

### Filter engine

- [ ] Multiple filters on a list use AND semantics (contact must match all conditions)
- [ ] Tags `include_any` uses OR within values (contact has at least one of the listed tags)
- [ ] Tags `exclude_any` excludes contacts that have ANY of the listed tags
- [ ] Tags `include_all` requires ALL listed tags on the contact
- [ ] Date-relative operators evaluate against server-side `NOW()` at query time (not stored absolute dates)
- [ ] Smart list badge count refreshes on: list click, list filter save, contact creation — and via 10-min background poll
- [ ] Phone `is_good` filter correctly matches contacts where the phone quality flag = 'good'
- [ ] All 17 Details fields, 4 Assigned fields, 9 Email fields, 7 Call fields, 5 Text fields, 5 Website Activity fields, 3 Deal fields, 6 Inbox App fields, and all custom fields are filterable
- [ ] Empty-value filters (Price "is between" with no inputs) do not affect query results or badge count

---

## 15. Sources

| Source | What it added beyond basic UI description |
|---|---|
| **shot-65** (before summary) | Complete 9-tag compliance exclusion filter for Warm/Bi-Weekly including `Realtor` and `audience:broker-recruit`; filter panel open with 5 filters; Tags filter operator radio group with 4 modes |
| **shot-66** (before summary) | "Add a filter" typeahead dropdown open with DETAILS category field list; full Details field names confirmed |
| **shot-67** (before summary) | Price filter "is between" expanded with two empty range inputs; confirmed incomplete filter NOT counted in badge |
| **shot-68** (before summary) | Column Chooser Details category right pane — 12 field rows with check states; filter + sort icons on column names confirmed |
| **shot-69** (before summary) | Extended Details right pane: Price, Tags, Stage, Source, Created, Updated, Inactive, My Next Task, Last Activity, Last Communication, Timeframe, My Agent Status confirmed; category left pane check states |
| **shot-70** (before summary) | Calls category expanded: 7 sub-columns (Last Call, Last Call Made, Last Call Received, Calls Made, Calls Received, Time to First Call, Talk Time) |
| **shot-71** (before summary) | Emails category expanded: 9 sub-columns (Last Email, Last Sent Email, Last Received Email, Last Sent Batch Email, Last Sent Automation Email, Last Sent Marketing Campaign, Emails Sent, Emails Received, Last Email Activity) |
| **shot-72** (before summary) | Assigned category expanded: Agent ▾ (filter icon), Pond, Lender, Collaborators; hover communication preview bubble behavior |
| **shot-73** | Two-pane Column Chooser popover architecture confirmed as floating overlay (not right panel); category count semantics corrected; 7 filter rows for All Expireds enumerated; phone icon dual-state (green = good, purple = mobile/SMS-capable) |
| **shot-74** | Custom Fields category right pane: enrichment demographics (Recently Divorced, Recently Moved, Phone Type, etc.) confirmed; "Out Of State Home..." = column preset (view), not a filter; Left rail badge vs. "Showing N" discrepancy explained |
| **shot-75** | Phone filter expanded: 5 operator radio options confirmed (is good / starts with / is not empty / is empty / is bad); `Last Received Email` column confirmed as separate visible column; secondary sort indicator (Last Communication ↑) observed |
| **GIF people.md** | Panel persistence across list navigation; All People empty state; skeleton loading behavior; Me dropdown three-section structure (Everyone/Me + PONDS + TEAM MEMBERS); both filter rows can expand simultaneously; "Update List" vs "+ New List" mutual exclusivity; template chips in email compose (separate module) |
| **GIF smartlists.md** | Complete Tags filter expanded state with all 7 compliance tag values enumerated; Stage filter include/exclude radio + value chips; Edit Smart List modal fields; static vs. pipeline smart list type distinction; per-list column configuration confirmed; standard pipeline filter template (5-filter pattern); No-Call-Attempt variant filter pattern |
| **fub-docs/smart-lists.md** | Complete operator table (16 operators); full field catalogs for all 9 categories; 10-minute count cache TTL; permission model (agents see own+pond+collab, admin sees all); Mass Actions bypass automations; smart list count update triggers; "Last Communication" excludes automated messages (canonical definition) |
| **fub-docs/people-contacts.md** | 25-phone limit (cross-contact including relationships); Tag 64-char limit; Timeframe 5-value enum; Custom field types (Text/Number/Date/Dropdown); Dropdown option order immutable after creation; Mass Actions do not trigger automations; Phone quality flag is a stored attribute (not just display) |
| **Prior spec §6.4** | Errors corrected (7 total, enumerated at top of this document); Group-By dimensions (Agent/Portal/Connections) carried forward from shots 65–72 analysis |
