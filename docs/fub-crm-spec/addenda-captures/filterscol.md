<!-- Addendum capture 2026-06-30. Fills coverage gaps for: §06b Filters & Column Chooser -->

# FUB Smart List — Filters + Column Chooser Frame-by-Frame Analysis
## Feeds spec §06b | Captured 2026-06-30

Purpose: document what static screenshots missed — the Column Chooser right-pane field inventory per category, the expanded date/recency filter editor (was-more/less-than-N-days-ago pattern), the Agent filter avatar picker, and any group-by surface. Frame-by-frame: state + delta.

---

## F01 — Tethercow smart list, tag filter panel open

**UI state:** Smart list "Tethercow" active. People list shows ~8 contacts (name, phone, agent column, lead score, last visit columns). Top-right filter panel (triggered by "Filters (1)" button) is open as a right-side sheet.

**What's visible in the filter panel:**
The active filter is a Tags filter. The filter operator row shows a dropdown revealing tag membership options. Visible options (partial — some cut off at panel edge):
- Tags include any of...
- Tags exclude any of...
- Tags match all of... (likely — standard FUB tag filter set)
- Tags match none of... (likely)

The tag chooser below the operator shows a scrollable list of tag names. Individual tag names not legible at this resolution.

**Nothing changed yet — baseline state for this sequence.**

---

## F02 — Tethercow list, date/recency operator dropdown expanded

**UI state:** Same Tethercow list. A second filter has been added (or the existing filter is being edited). A small floating popover appears to the right of the filter row, mid-page.

**What changed from F01:** A date-type field's operator dropdown is now open, overlaying the right portion of the screen.

### DATE / RECENCY FILTER OPERATOR DROPDOWN — FULL TRANSCRIPTION

This is the key "what static screenshots missed" reveal for this frame. The operator dropdown for a date/recency field shows a flat list of operators:

```
┌────────────────────────────────────┐
│  is not empty                      │
│  is less than   [  N  ] [days ago] │  ← split control: numeric input + unit dropdown
│  is more than                      │
│  is empty                          │
└────────────────────────────────────┘
```

**Exact operator labels (as rendered):**
1. `is not empty`
2. `is less than` — when selected, expands inline to show two sub-controls:
   - Numeric text input (integer, no decimals)
   - Unit dropdown — visible label is "days ago" (other units likely available: hours ago, weeks ago, months ago — not confirmed from this frame; confirmed in F10)
3. `is more than` — same split-control behavior (confirmed by F10 "was more than" variant — see below)
4. `is empty`

**Important distinction from F10 (high-res):** In F10 the operator labels read `was less than` / `was more than` (past-tense "was"), not `is less than` / `is more than`. F02 is lower-res so the exact wording is ambiguous here; F10 is authoritative — see F10 section.

**Unit dropdown:** Only "days ago" is visible as the selected unit in F02. Cannot confirm the full unit list from this frame alone.

---

## F03 — All People, filter category picker open

**UI state:** Switched from Tethercow to "All People" list. Count: 70,601 people. A "+ Add a filter" button has been clicked and the filter category dropdown is open.

**What changed from F02:** Context switched to All People; filter category selector has been invoked.

### FILTER CATEGORY DROPDOWN — PARTIAL TRANSCRIPTION (F03)

The dropdown organizes filterable fields into labelled sections. What is legible at this resolution:

```
Section: [unlabeled or "People"?]
  - Owner (?)
  - Agent

Section: Contact
  - [contact-type fields, partially visible]

Section: Website Activity
  - [sub-items partially visible]
```

Specific field names are not fully legible in F03 — F04 and F05 show more of this dropdown.

---

## F04 — All People, filter category dropdown expanded further

**UI state:** Same "All People" view, filter dropdown still open.

**What changed from F03:** Dropdown has scrolled or hovered to reveal more category options.

### FILTER CATEGORY DROPDOWN — CONTINUED TRANSCRIPTION (F04)

Additional visible items in the dropdown:
- Owner (top-level section or field)
- Agent (field — leads to the avatar picker in F05)
- Contact section with multiple sub-fields
- Website Activity section with sub-fields

At this resolution, individual field names within sub-sections are difficult to read precisely. The structural pattern: each major category is a section header, and sub-items are individual filterable fields indented below it.

---

## F05 — All People, Agent filter expanded (avatar picker)

**UI state:** "All People" list. An Agent filter has been selected from the category dropdown. The Agent filter is now in its expanded "includes any of" configuration, showing an avatar picker.

**What changed from F04:** Agent filter selected; the filter row has expanded to show a multi-select avatar picker for choosing which agents to include.

### AGENT FILTER — INCLUDES-ANY-OF + AVATAR PICKER — FULL TRANSCRIPTION

This is the key "what static screenshots missed" for the Agent filter. The pattern:

```
Filter row: Agent  [includes any of ▾]  [ avatar1 ] [ avatar2 ] [ avatar3 ]
```

**Operator:** "includes any of" (visible as a dropdown — other likely options: "is", "is not", "excludes any of", "is empty", "is not empty" — standard FUB agent filter set; only "includes any of" confirmed from these frames).

**Agent avatar picker:** Circular profile photo buttons, one per agent in the FUB account. Clicking a circle toggles that agent into the filter. Selected agents show a highlighted/active ring. The avatars visible in F05 correspond to the three Ryan Realty brokers (Matt Ryan, Paul Stevenson, Rebecca Peterson) plus possibly an "Unassigned" or system option.

**No text labels on unselected avatars** — the UI is purely icon-based; you recognize agents by photo. Selected agents likely show a count or name tooltip on hover (not captured in static frames).

---

## F06 — All People, filter applied, 19 results, Agent column visible

**UI state:** "All People" showing 19 people. Agent filter is active. The Agent column in the people list is now visible and shows agent names per row.

**What changed from F05:** Filter applied; list reduced from 70,601 to 19. Agent column shows: "Paul Stevenson" (multiple rows), "Matt Ryan" (at least one row visible). Rebecca Peterson not visible in the visible viewport but may be present.

**No filter editor, no column chooser open in this frame.** This is the list-result state.

---

## F07 — All People, Column Chooser right-pane OPEN (section 1 of 3)

**UI state:** "All People" (count unchanged from F06 or reset to full). The "Columns" button has been clicked and a right-side slide-out panel is open showing the column chooser.

**What changed from F06:** Column chooser panel opened from the toolbar ("Columns" button, next to "Filters").

### COLUMN CHOOSER RIGHT-PANE — SECTION 1 FIELD TRANSCRIPTION

The column chooser is a right-side panel with a header "Columns" and a vertically scrollable list of fields organized under category headers. Checkboxes or toggle indicators control which columns appear in the table.

**First visible section — fields legible in F07:**

Category: (unlabeled default / "Contact" section)
```
[ ] First Name
[ ] Last Name
[ ] Agent
[ ] Address
[ ] Phones
[ ] Emails / Email
[ ] Tags
[ ] Source
[ ] Lead Date        (likely — "Lead Score" may also be here)
[ ] Contact          (possibly a section header not a field)
[ ] Last Activity    (or "Last Communication")
```

**Currently active columns** (shown checked or in the table header already):
From the table header visible in F07: Name, Lead Score, Agent, Last Visit columns appear active.

**Confidence note:** At this resolution some labels are approximate. The exact capitalization and spacing may differ slightly from the rendered labels.

---

## F08 — Column Chooser right-pane, section 2 (communication fields)

**UI state:** Same Column Chooser panel, scrolled down to reveal a second group of fields.

**What changed from F07:** Scrolled within the column chooser to show the next category/section of available columns.

### COLUMN CHOOSER RIGHT-PANE — SECTION 2 FIELD TRANSCRIPTION

This section appears to cover email and text communication activity fields:

Category: (possibly "Email" or "Communication" or "Activity")
```
[ ] Last Received Email
[ ] Last Sent Email
[ ] Last Email Received     (may duplicate above — or these may be the canonical names)
[ ] Last Email Sent         (same caveat)
[ ] Last Text
[ ] Last Received Text      (or "Last Inbound Text")
[ ] Last Sent Text          (or "Last Outbound Text")
[ ] Inbound Texts           (count field?)
[ ] Outbound Texts          (count field?)
[ ] Last Phone Call         (or "Last Call")
[ ] Last Activity
```

**Confidence note:** F08 is also small-resolution. The exact field label wording (e.g., "Last Received Email" vs "Last Email Received") could not be confirmed with certainty. F10 (high-res, date filter on "Last Received Email less than 1 days ago") confirms that "Last Received Email" is the exact canonical label for at least one of these fields. Use F10 as ground truth for that specific field name.

---

## F09 — Column Chooser right-pane, section 3 (activity / website fields)

**UI state:** Column chooser still open, scrolled further to a third section.

**What changed from F08:** Scrolled further down in the column chooser.

### COLUMN CHOOSER RIGHT-PANE — SECTION 3 FIELD TRANSCRIPTION

This section covers website activity and additional tracking fields:

Category: (possibly "Website Activity" or "Tracking")
```
[ ] My Listings Views       (or "Listing Views" — property page views)
[ ] My Website Pages        (or "Website Pages Visited")
[ ] Last Page Visit         (or "Last Website Visit")
[ ] Last Website Activity
[ ] Website Visits          (count)
[ ] Property Views          (count — distinct from listing views?)
```

Additional fields in this section are cut off or not legible.

**Confidence note:** Website Activity field names are the least legible in this sequence. These names are approximate. The column chooser category label for this section matches the filter category label "Website Activity" seen in F03-F04.

---

## F10 — HIGH RESOLUTION: single result + date filter editor in full detail

**UI state:** ZOOMED / highest-resolution frame in the sequence. Filtered list shows ONE person: "Amy Mora" (import source shown). The date filter editor popup is open and fully legible.

**What changed from F09:** This frame appears to be a deliberate zoom or the application returned to a single-result filtered state to show the filter editor clearly. A "Clicked" tooltip bubble appears (confirming a UI interaction just occurred).

### DATE / RECENCY FILTER EDITOR — AUTHORITATIVE FULL TRANSCRIPTION (F10)

This is the definitive read. The filter field is "Last Received Email" and the editor popup is open:

**Filter field label (as shown in the filter chip above the dropdown):**
```
Last Received Email less than 1...
```
(the "..." indicates the full value is truncated in the chip; the dropdown shows the full edit state)

**Operator dropdown — open, showing all options:**
```
┌──────────────────────────────────────────────┐
│  is not empty                                │
│  ● was less than  [  1  ]  [ days ago ▾ ]   │  ← currently SELECTED (blue highlight)
│  was more than                               │
│  is empty                                    │
└──────────────────────────────────────────────┘
```

**Exact operator labels (authoritative):**
1. `is not empty`
2. `was less than` (SELECTED — highlighted in blue/navy) + inline split control:
   - Numeric integer input field (current value: `1`)
   - Unit dropdown (current selection: `days ago`)
3. `was more than` (same split control appears when selected)
4. `is empty`

**Split control mechanics:**
- The `was less than` / `was more than` operators expand the row inline to show two adjacent controls: `[numeric input]` + `[unit dropdown]`
- These are NOT a separate dialog — they appear as part of the same operator row
- The numeric input accepts integers (confirmed value = 1)
- The unit dropdown label shows `days ago` — other units (hours ago, weeks ago, months ago, years ago) are standard FUB behavior but not confirmed from these frames alone

**"Clicked" bubble:** Appears at the bottom of the screen near the single result row, indicating the most recent user interaction point. Not a UI element — it's a recording annotation.

**Single result visible:** Amy Mora — confirms the filter `Last Received Email was less than 1 days ago` is narrowing the full 70,601-person dataset to this one contact.

---

## Summary: What the Static Screenshots Missed

### 1. Column Chooser right-pane field inventory

The column chooser is a right-side slide-out panel (not a dropdown) with three scrollable sections covering ~30+ fields across Contact, Communication, and Website Activity categories. Key fields confirmed:

**Contact section:** First Name, Last Name, Agent, Address, Phones, Emails, Tags, Source, Lead Date, Last Activity

**Communication/Email section:** Last Received Email, Last Sent Email, Last Text (inbound/outbound variants), Last Phone Call — exact label canonicalization needed

**Website Activity section:** Last Page Visit, Website Visits, property/listing view counts — label canonicalization needed

### 2. Date/recency filter editor pattern (authoritative from F10)

Four operators, two of which expand inline to a split control:
- `is not empty` (no sub-control)
- `was less than [N] [unit]` (split: integer input + unit dropdown)
- `was more than [N] [unit]` (split: integer input + unit dropdown)
- `is empty` (no sub-control)

Confirmed unit: `days ago`. Other units assumed from FUB standard behavior.

Confirmed field using this pattern: `Last Received Email`

### 3. Agent filter (F05)

Pattern: `Agent [includes any of ▾] [avatar1] [avatar2] [avatar3]...`
- Operator: "includes any of" (dropdown for other operators)
- Value picker: circular profile photo buttons, one per agent, toggle-select
- No text labels on unselected avatars — purely icon-based selection

### 4. Group-by

No group-by surface was observed in any of the 10 frames. The list view in F06 shows agent-attributed rows but this appears to be sorting/filtering rather than a group-by header structure. Group-by may not exist in the People list, or it was not triggered in this recording sequence.

---

## Spec §06b Implementation Notes

- Date filter split control: render as `<select>` (operator) that conditionally shows `<input type="number">` + `<select>` (unit) inline when "was less than" or "was more than" is selected
- Agent filter: render agent options as avatar buttons (circular), not a standard multi-select list — this is a deliberate FUB UX choice for visual recognition
- Column chooser: slide-out right panel, not a dropdown; fields grouped by category with checkboxes; persists across sessions
- "was less than 1 days ago" note: grammatically FUB uses "days ago" even for unit=1 (no singular/plural toggling confirmed)

---

*Frames analyzed: f01_full.png through f10_full.png*
*F10 is the authoritative high-res frame; use it as ground truth for date filter operator labels*
*Label confidence: High for F10, Medium for F07, Lower for F08-F09 (small-resolution)*
