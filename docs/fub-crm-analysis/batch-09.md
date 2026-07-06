# FUB Screen Analysis — Batch 09 (screen-065 through screen-072)

---

## screen-065.png
- **Module / area:** Smart Lists — People list (empty state) with right-panel filter dropdown open
- **Browser tab title / URL path:** Tab reads "Warm/Bi-Weekly · Peopl…" / "Smart Lists Overview - Foll…"; URL: `ryan-realty.followupboss.com/2/people/list/30` (inferred from tab pattern)
- **Purpose:** Displays the "Warm/Bi-Weekly" smart list filter view, which currently returns zero results; the right-side filter/column-picker panel is open showing available filter criteria.
- **Layout regions:**
  - **Global top nav:** Horizontal bar at very top with browser toolbar + FUB app nav icons
  - **Left sidebar:** Smart Lists navigation rail with multiple named smart lists grouped under COLLECTIONS and SMART LISTS headers
  - **Main content area:** Center area showing the people list table (empty — "No people match filters") with toolbar above
  - **Right panel / overlay:** A dropdown/flyout panel open on the right side showing filter field options (two-column layout of filter criteria checkboxes)
- **Global navigation:** People, Inbox (mail icon), Tasks (checkmark icon), Calendar, Deals, Reporting, Admin visible in top nav; search bar in center; notification bell; avatar/profile icon at right.
- **Primary content:**
  - **Smart list active:** "Warm/Bi-Weekly" — shown in header with a small colored dot and "Edit" link
  - **Subtitle/description:** "Contacts in your warm pipeline you should reach out to three times or more times every 14 days. Requires a manual call, text, or email." (approximately — text visible but small)
  - **Table columns visible:** Name, Agent, Created, Stage, Source, Last Visit, Pages Proposed, Properties Proposed, Last Communication?, List Communication (columns appear right-truncated)
  - **Row count:** "No people found: 0" (or similar zero-state)
  - **Empty state graphic:** Illustrated empty-state icon (small figure/icon) with text "No people match filters, try another search"
  - **Toolbar above table:** "+ New Smart Lead" button (blue/primary), Columns icon, "Customize" link or button, "Out Of Date Home Alerts" option visible at right
- **Filters / search / sort:**
  - Left sidebar shows saved smart lists; the current smart list "Warm/Bi-Weekly" is selected/highlighted in blue
  - A right-side filter panel is open; visible filter categories in two columns include:
    - Left column: "Tags exclude any of: completed…", [illegible multi-line tag], "Last Text", "Last Call more than 14 da…", "Stage includes any of: 8 - Warm…" (approximately)
    - Right column (secondary panel): checkboxes/pills for additional filter fields — text too small to read individually
  - The right panel appears to be a "More filters" or "Add filter" dropdown with a list of available filter fields
- **Buttons & actions:**
  - "+ New Smart Lead" (blue button, top right of content) — creates a new lead
  - "Edit" link next to smart list name — edits smart list filter rules
  - "Columns" icon (table icon) — manages visible columns
  - "Customize" — additional customization (inferred)
  - "Out Of Date Home Alerts" — appears to be a column or filter option in the toolbar
- **Statuses / stages / tags / lead score / pills:**
  - Smart list name pill: "Warm/Bi-Weekly" with small colored dot (orange or yellow, inferred for "warm" category)
  - Right panel shows filter pills/tags referencing: "completed" tag exclusion, stage "8 - Warm" (inferred from text fragments)
- **Automation / workflow elements:**
  - The smart list itself is an automated filter that dynamically populates based on criteria (contact stage, recency of communication, call/text history)
  - Filter criteria visible reference "14 days" cadence — implies time-based automation trigger for follow-up reminders
- **Data-model implications:**
  - SmartList entity: { id, name, description, filters[], columns[] }
  - Person fields referenced by filters: tags, last_text_date, last_call_date, stage, last_communication_date
  - Filter operators visible: "exclude any of", "more than X days", "includes any of"
- **Notable details / edge cases / counts / numbers:**
  - Result count = 0; empty state shown
  - URL path includes `/list/30` suggesting smart list ID = 30
  - The right panel appears to be the filter-field selector for building/editing the smart list, not an active filter panel — it shows available columns/fields to add as filters
  - Column count in table: at least 9–10 columns visible, some truncated

---

## screen-066.png
- **Module / area:** Smart Lists — People list (empty state) with right-panel showing full field/column picker (longer list visible)
- **Browser tab title / URL path:** Tab reads "Warm/Bi-Weekly · Peopl…" / "Smart Lists Overview - Foll…"; URL: `ryan-realty.followupboss.com/2/people/list/30` (same smart list as screen-065)
- **Purpose:** Same "Warm/Bi-Weekly" smart list with zero results; the right-side field/column picker panel is now scrolled or expanded to show a more complete list of available filter/column fields.
- **Layout regions:**
  - **Global top nav:** Same as screen-065
  - **Left sidebar:** Same smart list rail as screen-065; "Warm/Bi-Weekly" still selected
  - **Main content area:** Same empty table with 0 results
  - **Right panel:** Filter/column picker flyout panel now showing a taller/more-scrolled list of field names
- **Global navigation:** Same as screen-065 — People, Inbox, Tasks, Calendar, Deals, Reporting, Admin, search, notifications, avatar.
- **Primary content:**
  - Same table headers as screen-065 (Name, Agent, Created, Stage, Source, Last Visit, Pages Proposed, Properties Proposed, Last Communication, List Communication)
  - Empty state: "No people match filters, try another search" with illustration
  - Smart list header: "Warm/Bi-Weekly" with Edit link
- **Filters / search / sort:**
  - Right panel now shows an expanded/scrolled list of filter fields; two columns of field names visible:
    - **Left column items (visible):** Name, First Name, Last Name, Phone, Email, Address, Tags, Source, Created, Contacted, Lists, Last Activity, Last Text, Last Call, Last Communication [approximately — text small]
    - **Right column items (visible):** [illegible — panel column text too small]
  - These appear to be the available fields that can be used as filter criteria or displayed columns
- **Buttons & actions:**
  - Same as screen-065: "+ New Smart Lead", "Edit", Columns icon, "Customize", "Out Of Date Home Alerts"
  - Right panel likely has "Apply" or "Close" button (not clearly visible)
- **Statuses / stages / tags / lead score / pills:**
  - Same smart list badge as screen-065; no person rows shown
- **Automation / workflow elements:**
  - Same smart list automation context as screen-065
- **Data-model implications:**
  - This screen reveals the full list of Person fields available for filtering/display:
    - Name, First Name, Last Name, Phone, Email, Address, Tags, Source, Created (date), Contacted (date), Lists (relationship), Last Activity (date), Last Text (date), Last Call (date), Last Communication (date)
    - Also likely: Stage, Agent, Lead Score, Custom Fields (inferred from FUB's typical field set)
  - Confirms Person entity has all these fields as sortable/filterable columns
- **Notable details / edge cases / counts / numbers:**
  - This screen appears to be a continuation of screen-065 with the same panel in a different scroll position or expanded state
  - The field list suggests FUB's column/filter picker is a scrollable checkbox list
  - Zero results still shown in main content

---

## screen-067.png
- **Module / area:** Smart Lists — People list (empty state) with right-panel showing filter criteria/conditions panel (Stage filter options visible)
- **Browser tab title / URL path:** Tab reads "Warm/Bi-Weekly · Peopl…" / "Smart Lists Overview - Foll…"; URL: `ryan-realty.followupboss.com/2/people/list/30`
- **Purpose:** Same "Warm/Bi-Weekly" smart list with zero results; right panel now shows a specific filter condition editor — specifically a "Stage" filter with radio-button/checkbox options for stage values.
- **Layout regions:**
  - **Global top nav:** Same as previous screens
  - **Left sidebar:** Same smart list rail; "Warm/Bi-Weekly" selected
  - **Main content area:** Same empty table; zero results
  - **Right panel:** Filter editor showing stage filter options — a narrower sub-panel with stage value selections
- **Global navigation:** Same as all previous screens in this batch.
- **Primary content:**
  - Table: same 0-result empty state
  - Right panel filter condition editor:
    - Filter field: "Stage" (inferred from visible options)
    - Filter operator: appears to be "is" or "includes" type
    - Available stage values shown as radio buttons or checkboxes:
      - "is empty" (option)
      - "is not empty" (option)
      - "is" (option — selected, inferred)
      - "0 - empty" or similar (stage value option)
      - [additional stage values — text illegible at this resolution]
- **Filters / search / sort:**
  - The right panel is editing a specific filter condition for the "Stage" field on the smart list
  - Visible filter conditions for the smart list (shown in the top-right area before the panel):
    - "Tags exclude any of: completed…"
    - "Last Text …"
    - "Last Call more than 14 da…"
    - "Stage includes any of: 8 - Warm…"
  - The Stage filter condition editor shows:
    - Radio options: "is empty", "is not empty", "0 - account" or similar stage values
    - Selected stage values visible include options with numeric prefixes (stage numbering scheme)
- **Buttons & actions:**
  - Same main toolbar buttons as previous screens
  - Filter panel likely has "Done" / "Apply" / "Cancel" buttons (not clearly visible)
- **Statuses / stages / tags / lead score / pills:**
  - Stage filter values visible (small text); appear to include: "is empty", "is not empty", and numbered stage options
  - Referenced stage in filter summary: "8 - Warm" (from top-right summary text)
- **Automation / workflow elements:**
  - Filter logic for the smart list is being viewed/edited — this is the smart list rule builder
- **Data-model implications:**
  - Stage field on Person: numbered stages (at least 0 through 8+), with "8 - Warm" being one named stage
  - Filter operators for Stage: "includes any of", "excludes any of", "is empty", "is not empty"
  - Confirms Stage is a select/enum field on Person with named numeric stages
- **Notable details / edge cases / counts / numbers:**
  - The stage value list uses numeric prefixes (e.g. "8 - Warm") suggesting an ordered stage progression system
  - The filter panel is inline/flyout style, not a full modal

---

## screen-068.png
- **Module / area:** Smart Lists — People list ("All Expireds" smart list) with populated results and right-side filter panel open (first column visible)
- **Browser tab title / URL path:** Tab reads "All Expireds · People - Foll…" / "Smart Lists Overview - Foll…"; URL: `ryan-realty.followupboss.com/2/people/list/30` (inferred — may be different list ID)
- **Purpose:** Shows the "All Expireds" smart list with 144 matching contacts displayed in the table; a right-side filter/sort panel is open showing additional column or filter options.
- **Layout regions:**
  - **Global top nav:** Same FUB top nav
  - **Left sidebar:** Smart list navigation rail; "All Expireds" highlighted/selected (visible with "144" count badge in navy/dark pill)
  - **Main content area:** People table with rows of contact data (showing ~15–18 rows visible)
  - **Right panel:** Filter/sort dropdown panel open at the right edge showing sortable field options
- **Global navigation:** People, Inbox, Tasks, Calendar, Deals, Reporting, Admin, search, notifications, avatar — same across all screens.
- **Primary content:**
  - **Smart list header:** "All Expireds" with count badge "144" and "Edit" link
  - **Table columns (visible):** Name, Created (?), Last Visit, Last Communication(?), Last Text Received, [additional columns cut off by right panel]
  - **Table rows (visible data — approximately):**
    1. Glenn Heinonen — Nov 9th — Nov 9th '25 — [comm data]
    2. Lucas Rush — Nov 9th — Dec 27th '25 — [comm data]
    3. Jason Bethren — Nov 9th — Dec 27th '25 — [comm data]
    4. Wilhelmsen Gordon — Nov 13th — Dec 6th '25 — [comm data]
    5. Richard Larraz — Nov 23th — Nov 24th '25 — [comm data]
    6. [name illegible] — Nov 23th — Nov 24th '25 — [comm data] — "4 months ago" badge
    7. [name illegible] — Nov 23th — Nov 24th '25 — [comm data] — "4 months ago" badge
    8. Renita Pompan — Nov 24th — Nov 24th '25 — [comm data]
    9. Charlene Torres / [name] — Nov 24th — Nov 24th '25 — [comm data]
    10. [name] Medina — Nov 24th — Nov 24th '25 — [comm data] — "3 months ago" badge
    11. Stacy Mock-Cross — Nov 24th — Nov 24th '25 — [comm data]
    12. Hennsdale — Nov 24th — Nov 24th '25 — [comm data]
    13. Steven Kinsey — Nov 24th — Nov 24th '25 — [comm data]
    14. Stuart Boulderith — Nov 24th — Nov 24th '25 — [comm data]
    15. Caldwell Ronald G — Nov 24th — Nov 24th '25 — [comm data]
    16. Frank Propandosky — Nov 24th — Nov 24th '25 — [comm data]
    17. [Stacy?] — Nov 24th — Nov 24th '25 — [comm data]
    18. Bill Wilson — Nov 24th — Dec 27th '25 — [comm data]
  - **Pagination/count:** "Showing 56 people" visible in subtitle beneath smart list name; total is 144 (from left sidebar badge)
  - **Agent avatars:** Small circular avatar icons visible in left portion of each row (initials — "LA", "BA", etc.)
  - **Phone numbers:** Right side of table shows phone numbers for many rows: e.g., (541) 604-5011, (541) 388-5877, (541) 915-9560, (541) 548-3490 (approx), (541) 969-8952, (541) 388-8011 (approx), (541) 249-5549 (approx)
  - **Time-relative badges:** "4 months ago" appears on 2 rows; "3 months ago" on 1 row — these indicate last communication recency
- **Filters / search / sort:**
  - Left sidebar shows smart list "All Expireds" selected with count 144
  - Right panel (filter/sort flyout) shows a list of sortable/filterable fields:
    - **Visible field options in right panel:** Create (B), Assigned (D), Tag (B), City (?), Tons (?), [several more illegible items]
    - Panel appears to be a "Sort by" or "Group by" or "Column chooser" panel with checkbox toggles
    - Right panel header possibly reads "Add Filter" or "Sort" (illegible)
- **Buttons & actions:**
  - "+ New Smart Lead" button (blue, top-right of content area)
  - "Edit" link next to smart list name
  - Columns icon (table/grid icon)
  - "Customize" link
  - "Out Of State Home Alerts" or similar filter option
  - Row-level click (inferred): clicking a row opens person detail
- **Statuses / stages / tags / lead score / pills:**
  - Badge on sidebar: "All Expireds — 144" (dark/navy pill)
  - Time-relative recency badges in rows: "4 months ago", "3 months ago"
  - Phone number badges appear on right side (green phone icon)
- **Automation / workflow elements:**
  - Smart list auto-populates based on expiry criteria (inferred — contacts flagged as expired listings)
  - No explicit automation elements visible beyond the smart list filter
- **Data-model implications:**
  - Person entity fields visible: name, created_date, last_visit(?), last_communication, last_text_received, phone numbers (multiple), assigned agent (avatar)
  - SmartList "All Expireds" with count = 144; shows contacts associated with expired listings
  - Date columns use relative display ("Nov 9th", "Dec 27th '25") with year suffix when not current year
  - Multiple phone numbers per person supported (column shows primary phone)
- **Notable details / edge cases / counts / numbers:**
  - 144 total in smart list; "showing 56" visible in header — pagination active, not all loaded
  - Dates cluster around Nov–Dec '25 suggesting this list was built from a bulk import or MLS expiry event in that period
  - Phone numbers all have (541) area code — Central Oregon region, consistent with Ryan Realty geography
  - Right panel appears to have two sections — one for filter conditions (upper) and one for column/sort selection (lower)

---

## screen-069.png
- **Module / area:** Smart Lists — People list ("All Expireds") with right-side filter panel open showing a different/extended set of filter field options
- **Browser tab title / URL path:** Tab reads "All Expireds · People - Foll…" / "Smart Lists Overview - Foll…"; URL: `ryan-realty.followupboss.com/2/people/list/[id]`
- **Purpose:** Same "All Expireds" smart list (144 contacts) with the right-panel filter field picker open; this view shows a different scroll position or expanded section of the available filter fields.
- **Layout regions:** Same as screen-068 — top nav, left sidebar, main table, right panel open.
- **Global navigation:** Same as all previous screens.
- **Primary content:**
  - Table: same rows as screen-068 (same 18 visible rows, same data)
  - Right panel: same filter/column picker but showing different or additional field options than screen-068
  - Visible right-panel field items (second set):
    - Create (B), Assigned (D), Tag (B), [illegible items], Website Activity(?), [illegible], [illegible], Has No Text(?), Has Call(?), Time In First List(?), See Time(?)
    - Additional items continuing downward (text too small to fully read)
- **Filters / search / sort:**
  - Same smart list active ("All Expireds", 144 contacts)
  - Right panel filter options in this view — visible items appear to include communication-related fields and activity-based fields
  - Panel appears to scroll independently to reveal more available filter fields
- **Buttons & actions:** Same as screen-068.
- **Statuses / stages / tags / lead score / pills:** Same as screen-068 — row badges and phone numbers; "4 months ago" / "3 months ago" visible.
- **Automation / workflow elements:** Same smart list context as screen-068.
- **Data-model implications:**
  - Additional Person/filter fields revealed: Website Activity (boolean or date), Has No Text (boolean filter), Has Call (boolean), Time In First List (duration metric), See Time (inferred: time spent viewing)
  - These fields imply FUB tracks: website visit activity, SMS receipt status, call log presence, list membership duration
- **Notable details / edge cases / counts / numbers:**
  - 144 total, "Showing 56" — same pagination state as screen-068
  - This screen likely immediately follows screen-068 as the user scrolls the filter panel or clicks to expand additional filter sections
  - The two right-panel views (screen-068 and screen-069) together reveal the full available filter field set for smart lists

---

## screen-070.png
- **Module / area:** Smart Lists — People list ("All Expireds") with right-side dropdown open showing a "Sort" or "Column arrangement" panel with more detailed options including communication and activity fields
- **Browser tab title / URL path:** Tab reads "All Expireds · People - Foll…" / "Smart Lists Overview - Foll…"; URL: `ryan-realty.followupboss.com/2/people/list/[id]`
- **Purpose:** Same "All Expireds" list; right-side panel now shows what appears to be a more complete filter/sort field list including communication timing fields, with a sub-section or secondary column visible.
- **Layout regions:** Same as screen-068/069 — top nav, left sidebar, main table, right panel.
- **Global navigation:** Same as all screens in batch.
- **Primary content:**
  - Table: same rows visible as screens 068–069
  - Right panel now shows:
    - **Left column of panel** (visible field names, approximately): Create, Last Visit, Last Communication, Last Communication Email, Last Bounced, Tags, Tons(?), Time In First List(?), Phone in group(?), See Time(?)
    - **Right column of panel** (appears to be a secondary set or sub-options): [illegible — text very small]
  - The panel appears to be showing a "Columns" or "Sort" configuration with two sub-columns
- **Filters / search / sort:**
  - Same "All Expireds" smart list active
  - Right panel is showing sort/column selection fields focused on communication timing
  - Visible field items (approximately): Create (date), Last Visit (date), Last Communication (date), Last Communication Email (date — separate from general last comm), Last Bounced (date), Tags, [additional fields]
- **Buttons & actions:** Same as screens 068–069.
- **Statuses / stages / tags / lead score / pills:** Same row data and badges as previous screens.
- **Automation / workflow elements:** Same smart list context.
- **Data-model implications:**
  - Reveals additional Person fields:
    - `last_communication_email` (separate from `last_communication` — implies channel-specific tracking)
    - `last_bounced` (email bounce tracking)
    - `time_in_first_list` (metric for how long a contact has been in the first list they were added to)
  - This confirms FUB tracks multi-channel communication separately: email, text, call, general
  - Email bounce tracking is a first-class field on Person
- **Notable details / edge cases / counts / numbers:**
  - Still showing 56 of 144 contacts
  - "Last Communication Email" as a separate field from "Last Communication" is notable — implies the system tracks per-channel last-contact dates
  - "Last Bounced" implies email bounce history is tracked at the person level

---

## screen-071.png
- **Module / area:** Smart Lists — People list ("All Expireds") with right-side dropdown open showing yet another state of the field/filter picker — now showing fields grouped under what appears to be email/communication category
- **Browser tab title / URL path:** Tab reads "All Expireds · People - Foll…" / "Smart Lists Overview - Foll…"; URL: `ryan-realty.followupboss.com/2/people/list/[id]` (URL shown as `ryan-realty.followupboss.com/2/people/list/37` — partially readable)
- **Purpose:** Same "All Expireds" list; the right panel has scrolled or been navigated to show a different section of available filter fields including email/communication-related options and possibly "Last Email" subcategories.
- **Layout regions:** Same as screens 068–070.
- **Global navigation:** Same as all screens.
- **Primary content:**
  - Table: same rows as previous screens in the All Expireds list
  - Right panel content (this scroll/state):
    - **Visible field names (left portion of panel):** Last Email, Last Bounced Email, Last Received Email, Last Communication (inferred), Last Communication Date(?), [several more illegible]
    - The panel appears focused on email-related date/activity fields
    - A sub-panel or second column may be visible showing subcategory options or value inputs
- **Filters / search / sort:**
  - Same "All Expireds" active filter context
  - Right panel focusing on email activity filter fields
- **Buttons & actions:** Same as screens 068–070.
- **Statuses / stages / tags / lead score / pills:** Same row data; phone numbers visible at right of table rows.
- **Automation / workflow elements:** Same smart list context.
- **Data-model implications:**
  - Additional email-specific Person fields revealed:
    - `last_email_sent` (date)
    - `last_email_received` / `last_received_email` (inbound email tracking)
    - `last_bounced_email` (separate from general bounce tracking)
  - Confirms FUB tracks both outbound and inbound email activity per person
  - Inbound email tracking ("last received") suggests FUB ingests email replies and logs them to the person record
- **Notable details / edge cases / counts / numbers:**
  - The progression of screens 065–071 captures a user browsing through the complete field picker for smart list filters — from overview fields through communication-channel-specific fields
  - URL may show `/list/37` (partially visible) — may be a different list ID than previously assumed
  - Email receive tracking is notable for a real estate CRM — implies two-way email integration (not just send tracking)

---

## screen-072.png
- **Module / area:** Smart Lists — People list ("All Expireds") with right-side dropdown showing "Group by" or top-level sort/column category selection including "Agent" and "Portal" grouping options
- **Browser tab title / URL path:** Tab reads "All Expireds · People - Foll…" / "Smart Lists Overview - Foll…"; URL: `ryan-realty.followupboss.com/2/people/list/[id]`
- **Purpose:** Same "All Expireds" list (144 contacts); the right-side panel now shows what appears to be a top-level category or "Group by" picker with options like Agent, Portal, Connections — used to group or organize the people list view.
- **Layout regions:** Same as all previous "All Expireds" screens (068–071) — top nav, left sidebar, main people table, right panel.
- **Global navigation:** Same as all screens in batch.
- **Primary content:**
  - Table: same "All Expireds" rows as screens 068–071 (same ~18 visible rows with same person names and data)
  - Right panel content (this state):
    - **Visible items in panel (approximately):**
      - "Agent" — with sub-options or count (inferred grouping option)
      - "Portal" — grouping by lead source portal
      - "Connections" — (possibly group by relationship/connection type)
      - Additional items below (illegible)
    - The panel appears to be a "Group by" selector or top-level column-category picker, distinct from the filter-field pickers in screens 068–071
    - A small secondary sub-panel or value list may be visible to the right within the panel
- **Filters / search / sort:**
  - Same "All Expireds" smart list active (144 count)
  - Right panel in this screen focuses on grouping dimensions (Agent, Portal, Connections) rather than individual filter fields
  - This may be the "Columns" panel's category groupings, or a "Group rows by" feature
- **Buttons & actions:** Same as previous screens — "+ New Smart Lead", "Edit", Columns icon, "Customize", export/bulk options in toolbar.
- **Statuses / stages / tags / lead score / pills:**
  - Same row data as screens 068–071
  - Phone numbers visible at far right of table rows: (541) 604-5011, (541) 388-5877, etc.
  - Sidebar badge: "All Expireds — 144"
- **Automation / workflow elements:**
  - "Group by Agent" option implies team-level organization of smart list results — useful for multi-agent brokerages like Ryan Realty (3 brokers)
  - "Group by Portal" implies lead source is a first-class grouping dimension
- **Data-model implications:**
  - Person has a `portal` / `source_portal` field linking to the lead source platform (Zillow, Realtor.com, etc.)
  - Person has an `agent` / `assigned_agent` relationship (already known, confirmed here as a grouping dimension)
  - "Connections" may refer to a relationship-graph feature or co-buyer/co-seller linking
  - Group-by is a display-layer feature on top of the smart list filter — implies the People list supports multi-level organization: Filter → Sort → Group
- **Notable details / edge cases / counts / numbers:**
  - The sequence of right-panel states across screens 068–072 reveals the full capability of the smart list column/filter picker: it supports both individual field filtering AND grouping by entity-level dimensions (Agent, Portal, Connections)
  - The "Portal" grouping is particularly relevant for a real estate brokerage — allows seeing which lead portals are generating the expired-listing contacts
  - 144 total contacts in "All Expireds"; 56 shown per page; implies 3-page pagination (56 + 56 + 32 = 144)

---
