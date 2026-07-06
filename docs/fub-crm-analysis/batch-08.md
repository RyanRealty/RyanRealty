# Batch 08 — screens 057–064

---

## screen-057.png
- **Module / area:** People list — Smart List / Pronghorn collection with bulk-action context menu open
- **Browser tab title / URL path:** "Pronghorn – People – Follow..." | `ryan-realty.followupboss.com/2/people/list/705`
- **Purpose:** Displays the Pronghorn smart list (a neighbourhood-scoped collection) of 21 contacts with a right-click or action context menu open in the top-right of the content area, exposing tagging and collection actions.
- **Layout regions:**
  - **Global top nav** — full-width bar across top with icon links and app switcher
  - **Left sidebar** — Collections tree + Neighborhoods sub-tree; visible and expanded
  - **Main content** — table listing people rows with columns; bulk-action bar visible at top of table
  - **Right panel / context menu** — floating dropdown menu open near top-right of content area listing several bulk/tag actions
- **Global navigation:** People | Inbox | Tasks | Calendar | Deals | Reporting | Admin (inferred standard FUB nav). Top-right shows avatar icons, notification bell, search.
- **Primary content (TABLE):**
  - **List header:** "Pronghorn" with "21" count badge; breadcrumb shows "Smart Lists" > current list
  - **Bulk action bar visible** with "Add Tag" and a "Remove Tags" section (partially visible)
  - **Columns visible (left to right):** checkbox | Name | Lead Score (numeric, e.g. "4") | Agent | Date Added | Phone | Email | Tags/Source label
  - **Rows shown (approx 11–12 visible):**
    1. Carlin Banos — score 4 — Nov 1 (60) — (415) 485-9556 — [email illegible] — Inquiry: ODRNA Mona Muir St 97701
    2. Janine Yosh — score [illegible] — Nov 1 (60) — [phone] — [email] — Inquiry: Saga Canyon St 97701 (inferred)
    3. Pronthorne Hadenon Lip — score [illegible] — Nov 1 (60) — (756) 796-8847 — [email] — Inquiry: NABT Saga Canyon St 97701
    4. Kathleen Miller — score [illegible] — Nov 1 (60) — [phone] — Millaro.x.morathyland@yahoo.com — Inquiry: ODRNA Pronthorne Estates Dr 97701
    5. Jeffrey Moore — score [illegible] — Nov 1 (60) — (736) 503-0035 — cowboyscenterdalignment.com — Inquiry: ODRNA Pronthorne Estates Dr 97701
    6. [illegible name] — Nov 1 (60) — (760) 717-0980 — [email] — [source]
    7. Michael Halverson — score [illegible] — Nov 1 (60) — (676) 548-6738 — MtestData37@gmail.com — Inquiry: Crescent View Loop 97701
    8. DR Ultra LLC — score [illegible] — Nov 1 (60) — (503) 506-8520 — [email] SSBunthland27@yahoo.com — Inquiry: [illegible]
    9. Beverly Simon — score [illegible] — Nov 1 (60) — (546) 048-2445 — Bunks22@ftdown.com — Inquiry: ODRNA Blankney St 97701
    10. Josh Aperson — score [illegible] — Nov 1 (60) — (448) 034-5921 — johnathon@yourpartner.com — Inquiry: ODRNA Pronthorne Estates Dr 97701
  - **Total count:** 21 (shown as badge on the list name)
  - **Pagination:** "Out Of 3 Items Shown" visible near top-right (inferred — text partially cut off; likely "Showing X of 21")
- **Filters / search / sort:** No filter chips visible on this list beyond the smart-list definition itself. Sort by Date Added (descending — newest first).
- **Buttons & actions:**
  - **"Add Tag"** button in bulk-action bar (blue)
  - **"Remove Tags"** — visible as a section header in the bulk bar
  - **Context menu / dropdown (open, top-right)** with options:
    - "Do not contact any of..." (partially visible)
    - "Tag include any of contact..." (partially visible)
    - "Tag include any of completed..." (partially visible)
    - "Tag include any of telephone..." (partially visible; likely "Tag include any of telephone...")
    - [additional items cut off at bottom of menu]
  - Checkboxes on each row (for multi-select)
  - Row click → person detail (inferred)
- **Statuses / stages / tags / lead score / pills:**
  - Lead score numeric badges shown on several rows (value "4" visible on row 1)
  - Source pills: "Inquiry" label with property address and zip code (97701) visible on every visible row
  - No stage badges explicitly visible in this view
- **Automation / workflow elements:** None directly visible; context menu options for tagging suggest bulk-automation capability.
- **Data-model implications:**
  - `people` table: id, name, lead_score (int), assigned_agent, date_added, phone, email, tags[], source_label, source_address
  - `smart_lists` / `collections`: id, name, geo_scope (neighbourhood = "Pronghorn"), people_count
  - Context menu implies bulk-tag operations: `person_tags` junction table with add/remove actions
- **Notable details / edge cases / counts / numbers:**
  - All visible dates are "Nov 1" with "(60)" in parentheses — the 60 is likely days-since-added or a score component
  - The context menu appears to be a custom filter/tag-condition builder (not a simple "add tag X" — it says "Tag include any of..."), suggesting the bulk action creates a filter condition rather than directly tagging
  - Smart list is under "Neighborhoods" > "Pronghorn" in the left sidebar tree
  - URL numeric suffix `/705` identifies this specific smart list

---

## screen-058.png
- **Module / area:** People list — Smart List / Pronghorn collection with agent assignment dropdown open
- **Browser tab title / URL path:** "Pronghorn – People – Follow..." | `ryan-realty.followupboss.com/2/people/list/705`
- **Purpose:** Same Pronghorn smart list as screen-057, but now showing a dropdown for assigning/reassigning the selected contact(s) to a specific agent from the Ryan Realty roster.
- **Layout regions:**
  - **Global top nav** — same as screen-057
  - **Left sidebar** — same Collections + Neighborhoods tree
  - **Main content** — same people table
  - **Floating dropdown (top-right)** — agent-selection picker overlaying the table, listing the three Ryan Realty brokers plus a search/header
- **Global navigation:** Same as screen-057 (People, Inbox, Tasks, Calendar, Deals, Reporting, Admin inferred).
- **Primary content (TABLE):** Identical rows to screen-057 (same Pronghorn list, same 21 contacts, same columns). No new rows visible beyond those in screen-057.
- **Filters / search / sort:** Same as screen-057 — smart-list filter, Date Added sort.
- **Buttons & actions:**
  - **Agent assignment dropdown** open with:
    - Header / search field at top: "Close Air Prom..." (search box for agent name — partially visible; placeholder text "[illegible]")
    - **"View Smart Lists Owners"** option (link/button)
    - Agent rows (each selectable):
      - **Matt Ryan** — avatar with initials "MR" or photo
      - **Paul Stevenson** — avatar
      - **Rebecca Peterson** — avatar (partially visible)
    - Clicking an agent row → assigns selected people to that agent (inferred)
  - All other buttons from screen-057 remain (Add Tag, Remove Tags, checkboxes)
- **Statuses / stages / tags / lead score / pills:** Same as screen-057.
- **Automation / workflow elements:** Agent assignment via this picker may trigger FUB lead-routing automations or action plans (inferred).
- **Data-model implications:**
  - `agents` / `users` table: id, name, avatar; linked to `people.assigned_agent_id`
  - Bulk agent-reassignment operation: `UPDATE people SET agent_id = ? WHERE id IN (?)`
  - "View Smart Lists Owners" implies smart lists can have an owner agent separate from individual contact assignments
- **Notable details / edge cases / counts / numbers:**
  - Only three agents visible — matches the three Ryan Realty brokers (Matt Ryan, Paul Stevenson, Rebecca Peterson)
  - The dropdown appears triggered by a "Reassign" or agent-column click in the bulk-action bar
  - The "View Smart Lists Owners" link is a secondary action suggesting list-level ownership is a distinct concept from contact-level assignment

---

## screen-059.png
- **Module / area:** People list — Smart List / Pronghorn — Export modal dialog open
- **Browser tab title / URL path:** "Pronghorn – People – Follow..." | `ryan-realty.followupboss.com/2/people/list/705`
- **Purpose:** Confirms and initiates a CSV/data export of the Pronghorn smart list's people (21 contacts), with an option to export all or a subset.
- **Layout regions:**
  - **Global top nav** — same as prior screens
  - **Left sidebar** — same Collections/Neighborhoods tree (dimmed behind modal)
  - **Main content** — same people table (dimmed/overlaid)
  - **Modal dialog (center)** — "Export Selected People" confirmation dialog
- **Global navigation:** Same standard FUB nav (dimmed).
- **Primary content (MODAL — "Export Selected People"):**
  - **Title:** "Export Selected People"
  - **Body text:** "Would you like to export 10 people?"
  - **Checkbox option:** "Export all contacts" with an info/help icon (?) next to it
    - Subtext below checkbox (partially visible): explains exporting all vs. selected — [illegible detail text]
  - **Buttons:**
    - **"Cancel"** — secondary/ghost button (left)
    - **"To Last Exporter"** — primary blue button (right); label suggests it sends the export to the most recently used export destination or format
- **Filters / search / sort:** N/A (modal context).
- **Buttons & actions:**
  - "Cancel" → closes modal, no export
  - "To Last Exporter" → executes export using previously configured exporter/format (inferred — could mean CSV download, Google Sheets, Mailchimp integration, etc.)
  - "Export all contacts" checkbox → changes scope from selected 10 to all 21 in the list (inferred)
- **Statuses / stages / tags / lead score / pills:** None in modal.
- **Automation / workflow elements:** Export may feed downstream marketing automation or ad audiences (inferred external use).
- **Data-model implications:**
  - Export operation reads from `people` filtered by smart list id=705
  - Scope: either `selected_ids[]` (10 checked) or `all` (21 in list)
  - "Last Exporter" implies a persisted user preference: `user_settings.last_export_destination` or similar
  - Export likely produces: name, phone, email, tags, source, assigned agent, lead score
- **Notable details / edge cases / counts / numbers:**
  - "10 people" in the modal body — user had 10 of 21 checked when triggering export
  - "Export all contacts" checkbox allows overriding the selection to export the full list
  - Button label "To Last Exporter" is unusual — implies FUB remembers the last export destination (could be CSV, a CRM integration, or a marketing platform)
  - The modal appears as a centered overlay with a white card, gray backdrop, and standard cancel/confirm button layout

---

## screen-060.png
- **Module / area:** Person detail — Matthew Ryan (self/admin account) — Email/activity thread view
- **Browser tab title / URL path:** "Matthew Ryan – Follow Up Bo..." | `ryan-realty.followupboss.com/2/people/view/[id]`
- **Purpose:** Shows the full person detail record for "Matthew Ryan" (the broker/account owner as a contact record), with the email thread tab active displaying a conversation history of automated website-visit notification emails.
- **Layout regions:**
  - **Global top nav** — same standard FUB nav
  - **Left sidebar** — People list sidebar with contact details panel (name, tags, relationship details)
  - **Main content (center)** — Email/activity thread view with multiple email messages
  - **Right rail** — "Action Plans" panel + "Activity" feed
- **Global navigation:** People | Inbox | Tasks | Calendar | Deals | Reporting | Admin visible.
- **Primary content (DETAIL VIEW):**
  - **Contact header (left sidebar top):**
    - Name: **Matthew Ryan**
    - Avatar: blue circle with "MR" initials
    - Sub-details: [illegible — email, phone fields]
    - Tags section visible (no tags shown on this contact)
    - "Relationships" section visible
  - **Left sidebar sections (vertical stack):**
    - Details
    - Financing
    - Lender
    - Custom Fields
    - Background
    - Social Profiles
    - Google: "Search Matthew Ryan"
  - **Center email thread (chronological, oldest at top or newest at top — appears newest first):**
    - Multiple email entries all from **"Matt Ryan"** (outbound automated notifications):
      - Each email body references: "Matt and/or [email] was on your website and is viewing http://[ryan-realty.com URL]" — automated "hot lead alert" style notification
      - Visible URLs include references to: `/Deschutes River Rd 97701`, `Deschutes/Fence/Bend, Oregon/Ryan Realty` [illegible full addresses]
      - One entry shows **"Seller Inquiry"** label as email subject heading in a distinct section
      - Body text for Seller Inquiry: "ryanrealty.com/seller-step2: step 2 out of 3 completed. Address: [illegible] Bel-Air NW Bend OR 97703. Source address by by [sic]..."
      - Dates all appear to be the same date (recently) — visible timestamps partially cut off
    - Email entries are rendered as collapsed/expandable cards with sender name, subject snippet, and timestamp
    - Multiple consecutive "Matt Ryan" entries (automated system-generated alerts, not manually composed)
  - **Right rail — "Action Plans" panel:**
    - Header: "Action Plans" with "Start a new..." button (blue, right-aligned)
    - No active action plans shown for this contact (panel appears empty or loading)
  - **Right rail — "Activity" feed:**
    - Header: "Activity" with "Report ?" link/button
    - Multiple activity items visible (list):
      - "Lead viewed website: Follow up now." — with link — [date]
      - "Lead viewed website: Follow up now." — repeated multiple times with different timestamps
      - "Lead returned to website: Follow up now." — [date]
      - "Next Task:" entries
    - Each activity item links to a URL (ryan-realty.com pages)
    - Activity items have colored left-border indicators (blue/teal for website view events)
- **Filters / search / sort:** Email thread may have sort/filter (not visible); activity feed shows most recent first (inferred).
- **Buttons & actions:**
  - **"Create Note"** (blue, top of center area) — opens note composition
  - **"To [recipient]"** address field visible — email compose area at top of thread
  - **"Start a new [Action Plan]"** — in right rail
  - Row/card expand on each email (inferred click to expand full email body)
  - Activity items are clickable links (inferred)
- **Statuses / stages / tags / lead score / pills:** No explicit stage or score badges visible on this record (Matthew Ryan is the broker, not a lead).
- **Automation / workflow elements:**
  - The email thread is entirely automated website-visit notifications — FUB's "hot lead" alert system fired on the broker's own contact record (likely because Matt's email was captured as a test lead on ryan-realty.com)
  - Action Plans panel ready to receive a plan assignment
  - Activity feed auto-populated by website pixel/integration events
- **Data-model implications:**
  - `people` record: id, name="Matthew Ryan", email, phone, tags=[], custom_fields={}, social_profiles={}
  - `emails` table: id, person_id, direction (inbound/outbound), subject, body, sent_at, read_at
  - `activity_events` table: id, person_id, event_type="website_view", url, occurred_at, follow_up_prompt
  - `action_plan_enrollments` table: person_id, plan_id, started_at, status — currently empty for this record
  - Left sidebar custom sections: Financing, Lender, Custom Fields, Background suggest extensible schema
- **Notable details / edge cases / counts / numbers:**
  - The "Seller Inquiry" email references step 2 of a multi-step seller lead funnel on ryan-realty.com
  - The repeated "Lead viewed website: Follow up now." activity items suggest the website tracking pixel fired multiple times for this person
  - Matthew Ryan appearing as a contact in his own FUB account is typical (CRM captures the broker's own browsing when logged in under their email)
  - "Google: Search Matthew Ryan" in the left sidebar is a quick-search shortcut link (opens Google search for the contact's name — inferred standard FUB feature)

---

## screen-061.png
- **Module / area:** Smart Lists — Manage Lists & Collections (full manage view)
- **Browser tab title / URL path:** "Smart Lists Overview – Follo..." | `ryan-realty.followupboss.com/2/people/manage-lists`
- **Purpose:** Central admin view for managing all Smart Lists and Collections, showing the full inventory of saved filters (Pipeline and Neighborhoods sections) with names, descriptions, contact counts, creation info, and action buttons.
- **Layout regions:**
  - **Global top nav** — standard FUB top bar (People, Inbox, Tasks, Calendar, Deals, Reporting, Admin)
  - **Left sidebar** — same people/collection tree sidebar as prior screens
  - **Main content** — full-width "Manage Lists & Collections" table with two sections: Pipeline and Neighborhoods
  - **Top-right controls** — "Custom Lists: 148" counter and "+ New Collection" button; "Actions" button
- **Global navigation:** People | Inbox | Tasks | Calendar | Deals | Reporting | Admin. Plus search bar centered in top nav.
- **Primary content:**
  - **Page title:** "Manage Lists & Collections"
  - **Top-right stat:** "Custom Lists: 148" (total saved smart lists/filters in the account)
  - **Button:** "+ New Collection" (blue, top-right)
  - **Button:** "Actions" (dropdown, top-right, next to New Collection)
  - **Section 1 — Pipeline** (with "Drag &amp; Drop  Total ▼" sort header):
    - Columns: Name | [Description] | Total | Created | Actions
    - Rows (all show "Matt Ryan" avatar as creator):
      1. **Active & Pending Clients** — "All the clients you are currently working with. This smart list displays everyone in current Not-Contacted and [pending] contact stages." — Total: **4** — Created: Matt Ryan — Actions: [Edit Smart List] [illegible]
      2. **HotReady** — "All the clients that are VERY engaged – this smart list reminds you to reach out to these leads at least twice every 7 days. Requires a manual cal..." — Total: **1** — Created: Matt Ryan — Actions: [Edit Smart List]
      3. **Warm Ready** — "All the clients that are [illegible] – this smart list reminds you to reach out to these leads at least twice [every 7 days]. Requires a manual cal..." — Total: **[illegible]** — Created: Matt Ryan — Actions: [Edit Smart List]
      4. **Past Clients/System Quarterly** — "All past clients where [illegible] — Total: **3[illegible]** — Created: Matt Ryan — Actions: [Edit Smart List]
      5. **Idle Monthly** — "[illegible description]" — Total: **[illegible]** — Created: Matt Ryan — Actions: [Edit Smart List]
      6. **Cave Leads: No Call Attempt** — "Any [illegible] with a cell phone number go to [illegible]" — Total: **41** — Created: Matt Ryan — Actions: [Edit Smart List]
      7. **Callable Monthly** — "[illegible description]" — Total: **[illegible]** — Created: Matt Ryan — Actions: [Edit Smart List]
      8. **GIC Leads: No Call Attempt** — "Any deal [illegible]" — Total: **1,176** — Created: Matt Ryan — Actions: [Edit Smart List]
    - **Section 1 summary row:** "Drag: 8 | Total: [sum]"
  - **Section 2 — Neighborhoods** (with same column structure):
    - Columns: Name | [Description/blank] | Total | Created | Actions
    - Rows:
      1. **Tetherow** — Total: **340** — Created: Matt Ryan — Actions: [Edit Smart List] [Delete]
      2. **Sunriver** — Total: **[illegible]** — Created: Matt Ryan
      3. **Pronghorn** — Total: **21** — Created: Matt Ryan
      4. **Black Butte Ranch** — Total: **[illegible]** — Created: Matt Ryan
      5. **Northwest Crossing** — Total: **[illegible]** — Created: Matt Ryan
- **Filters / search / sort:**
  - "Drag &amp; Drop" reorder capability on rows (drag handles implied)
  - "Total ▼" sort indicator on Total column (descending sort active)
  - No search box visible within the manage page itself
- **Buttons & actions:**
  - **"+ New Collection"** — creates a new collection grouping
  - **"Actions"** dropdown (top-right) — bulk actions on lists (inferred: export, delete, reorder)
  - Per-row: **"Edit Smart List"** link/button (blue text) — opens the smart list filter editor
  - Per-row: **[Delete / secondary action]** — visible on Neighborhoods rows (icon button, red or gray)
  - "Drag &amp; Drop" implies drag handles on left side of each row for reordering
- **Statuses / stages / tags / lead score / pills:** No contact-level statuses; list-level total counts serve as the key metric.
- **Automation / workflow elements:**
  - Smart list descriptions reference automation cadences: "reach out... at least twice every 7 days", "Requires a manual cal[l]..." — suggesting these lists feed reminder/task workflows
  - "GIC Leads: No Call Attempt" with 1,176 contacts is a large unworked lead pool
  - "Cave Leads: No Call Attempt" with 41 contacts — "Cave" likely = a lead source name
- **Data-model implications:**
  - `smart_lists` table: id, name, description, filter_definition (jsonb), collection_id (FK), created_by_agent_id, display_order (int), people_count (cached int)
  - `collections` table: id, name, display_order — "Pipeline" and "Neighborhoods" are the two visible collections
  - `smart_lists.people_count` is cached (updated on refresh, not real-time — inferred)
  - Smart list descriptions stored as plain text in the `description` field
- **Notable details / edge cases / counts / numbers:**
  - Total smart lists in account: **148** (shown in "Custom Lists: 148" badge)
  - Largest list visible: **GIC Leads: No Call Attempt — 1,176 contacts**
  - Tetherow neighborhood list: **340 contacts** (largest neighbourhood list visible)
  - Pronghorn: **21** (matches the list seen in screens 057–059)
  - Active & Pending Clients: only **4** (very small active pipeline)
  - The Pipeline section has 8 lists; Neighborhoods section shows 5 (more may be below the fold)
  - "Drag &amp; Drop" reordering is supported — display_order is a persistent field

---

## screen-062.png
- **Module / area:** Smart Lists — Manage Lists & Collections (same page, action menu open on a row)
- **Browser tab title / URL path:** "Smart Lists Overview – Follo..." | `ryan-realty.followupboss.com/2/people/manage-lists`
- **Purpose:** Same Manage Lists page as screen-061, but with a per-row context/action menu open on one of the Pipeline smart lists, revealing row-level management options.
- **Layout regions:** Identical to screen-061 with the addition of a floating context menu on a row.
- **Global navigation:** Same as screen-061.
- **Primary content:** Same table as screen-061. The same rows are visible. The context menu is open on one of the Pipeline list rows (appears to be on "Active & Pending Clients" or "HotReady" — the row is highlighted).
- **Context / action menu options (floating dropdown):**
  - **"Edit Smart List"** — opens the filter-definition editor for this list
  - **"Duplicate Smart List"** — creates a copy of this smart list
  - **"Move to Collection"** — moves this list to a different collection grouping
  - **"Delete Smart List"** — deletes this smart list (likely with confirmation)
  - (Additional items may be present but cut off)
- **Filters / search / sort:** Same as screen-061.
- **Buttons & actions:**
  - All buttons from screen-061 remain
  - The row-level actions in the dropdown: Edit, Duplicate, Move to Collection, Delete
- **Statuses / stages / tags / lead score / pills:** Same as screen-061.
- **Automation / workflow elements:** Same as screen-061.
- **Data-model implications:**
  - Duplicate Smart List: `INSERT INTO smart_lists SELECT ... WHERE id = ?` (copy filter definition, new name)
  - Move to Collection: `UPDATE smart_lists SET collection_id = ? WHERE id = ?`
  - Delete Smart List: `DELETE FROM smart_lists WHERE id = ?` (with cascade or check for in-use)
- **Notable details / edge cases / counts / numbers:**
  - The context menu appears triggered by a "..." (ellipsis/kebab) icon on the right side of each row under "Actions"
  - Four distinct row-level operations: Edit, Duplicate, Move to Collection, Delete — these map directly to CRUD operations on the smart_lists entity
  - "Move to Collection" implies smart lists belong to exactly one collection (not multi-collection membership)

---

## screen-063.png
- **Module / area:** Smart Lists — "Save New Smart List" modal dialog
- **Browser tab title / URL path:** "Smart Lists Overview – Follo..." | `ryan-realty.followupboss.com/2/people/manage-lists`
- **Purpose:** Modal for creating (or saving) a new smart list with a name, emoji, description, and sharing configuration.
- **Layout regions:**
  - **Global top nav** — standard (dimmed behind modal)
  - **Left sidebar** — same list tree (dimmed)
  - **Main content** — Manage Lists page (dimmed behind modal)
  - **Modal dialog (center)** — "Save New Smart List" form
- **Global navigation:** Same (dimmed).
- **Primary content (MODAL — "Save New Smart List"):**
  - **Title:** "Save New Smart List"
  - **Form fields:**
    1. **Name** (text input, required):
       - Pre-filled value: "Copy Of Active & Pending Clients" — indicates this was triggered via "Duplicate Smart List" on the "Active & Pending Clients" list
       - Emoji picker button to the left of the name field (shows a smiley face / star icon — user can add an emoji prefix)
    2. **Description** (multi-line textarea):
       - Pre-filled with: "A smart list of the clients you are currently working with. This smart list displays everyone in current Not-Contacted and pending contact stages."
       - Formatting toolbar above the textarea with icons for: Bold (B), Italic (I), Underline (U), [other formatting options — illegible], Link icon, [more icons]
       - Character/word count displayed bottom-right of textarea: "0/250" (inferred — partially visible as "[illegible]/250")
    3. **Share smart list with:** (section header)
       - Radio/toggle options:
         - **"Share with everyone"** — radio option (not selected based on visual)
         - Agent checkboxes/rows below: three rows each with an agent avatar + name:
           - **Matt Ryan** — checkbox (checked or available)
           - **Paul Stevenson** — checkbox
           - **Rebecca Peterson** — checkbox
       - Search field at top of sharing section: "Or search agents..." (placeholder, text input)
       - Explanatory text: "This smart list will be private." (shown at bottom of sharing section)
  - **Footer buttons:**
    - **"Dismiss"** — secondary/ghost (left)
    - **"Save List"** — primary blue button (right)
- **Filters / search / sort:** Search field within sharing section for finding agents by name.
- **Buttons & actions:**
  - Emoji picker (left of name) → opens emoji chooser (inferred)
  - Description formatting toolbar icons (Bold, Italic, etc.) → rich text formatting
  - "Share with everyone" radio → sets visibility to all agents
  - Individual agent checkboxes → selective sharing
  - "Dismiss" → closes modal without saving
  - "Save List" → creates the new smart list with the specified name, description, and sharing settings
- **Statuses / stages / tags / lead score / pills:** None — this is a creation form.
- **Automation / workflow elements:** None directly; the saved list could later be used as a trigger condition in automations (inferred).
- **Data-model implications:**
  - `smart_lists` table: id, name (text), emoji (varchar), description (text/html), filter_definition (jsonb, copied from source), created_by_agent_id, visibility enum('private'|'shared_all'|'shared_selected'), display_order
  - `smart_list_shares` junction table: smart_list_id, agent_id — for selective sharing
  - "Share with everyone" → visibility = 'shared_all', no junction rows needed
  - Individual agent rows → visibility = 'shared_selected', junction rows per agent
- **Notable details / edge cases / counts / numbers:**
  - This modal was pre-populated with data from "Copy Of Active & Pending Clients" — confirming the "Duplicate Smart List" flow from screen-062
  - The emoji picker is an unusual UI feature — smart lists support an emoji prefix in their name
  - Rich text formatting (Bold, Italic, etc.) in the description textarea suggests descriptions are stored as HTML or markdown, not plain text
  - "This smart list will be private." note suggests default visibility is private unless sharing is configured
  - The search box within the sharing section ("Or search agents...") suggests the agent roster could be large — but Ryan Realty only has 3, so this is a platform-generic feature
  - Three Ryan Realty agents shown exactly: Matt Ryan, Paul Stevenson, Rebecca Peterson — consistent with all prior screens

---

## screen-064.png
- **Module / area:** Smart Lists — "Move Smart List" modal dialog
- **Browser tab title / URL path:** "Smart Lists Overview – Follo..." | `ryan-realty.followupboss.com/2/people/manage-lists`
- **Purpose:** Modal for moving an existing smart list to a different collection, showing the available collection destinations.
- **Layout regions:**
  - **Global top nav** — standard (dimmed behind modal)
  - **Left sidebar** — same list tree (dimmed)
  - **Main content** — Manage Lists page (dimmed behind modal)
  - **Modal dialog (center)** — "Move Smart List" form/picker
- **Global navigation:** Same (dimmed).
- **Primary content (MODAL — "Move Smart List"):**
  - **Title:** "Move Smart List"
  - **Subtitle/body text:** Move "[Active & Pending Clients]" to the following collection:
    - Full text: `Move "Active & Pending Clients" to the following collection:` (partially visible; list name inferred from screen-061/062 context)
  - **Collection picker (radio list or clickable rows):**
    - **"Select collection..."** — placeholder/prompt at top (greyed, no selection active)
    - Available collections listed below:
      1. **New Collection** — [description or blank]
      2. **Smart Loop** — [description or blank]
      3. **[illegible third option]** — partially visible
      4. **Neighborhoods** — visible as another option
    - Each row appears to be a clickable radio selection (inferred — only one collection can be chosen)
  - **Footer buttons:**
    - **"Dismiss"** — secondary/ghost button (left) — closes without moving
    - **"[Move / Confirm]"** — primary button (right) — executes the move (label partially illegible; likely "Move" or "Save")
- **Filters / search / sort:** No search within the collection picker (inferred — only a few collections exist).
- **Buttons & actions:**
  - Collection rows — clickable to select destination (radio-style)
  - "Dismiss" → close modal, cancel operation
  - Primary confirm button → moves the smart list to the selected collection (`UPDATE smart_lists SET collection_id = ? WHERE id = ?`)
- **Statuses / stages / tags / lead score / pills:** None — this is a management dialog.
- **Automation / workflow elements:** None directly; moving a list between collections is an organizational action only.
- **Data-model implications:**
  - `collections` table: id, name — visible values: "New Collection", "Smart Loop", [illegible], "Neighborhoods"; these are the account's collection categories
  - `smart_lists.collection_id` (FK → collections.id) — updated by this operation
  - The four visible collections suggest the account has: Pipeline (from screen-061), Neighborhoods (from screen-061), New Collection, Smart Loop — at minimum 4 collections total
  - "New Collection" as a listed option is ambiguous — could be an actual collection named "New Collection" or a placeholder for creating one (likely the former, as there's a separate "+ New Collection" button on the main page)
- **Notable details / edge cases / counts / numbers:**
  - The modal shows all existing collections as move targets — the source collection (Pipeline, where "Active & Pending Clients" currently lives) should NOT appear as an option (it would be a no-op move), though this cannot be confirmed from the screenshot
  - The collection list appears short (4 items visible, possibly all) — consistent with the account having a small number of collection groups
  - "Smart Loop" as a collection name is distinctive — suggests a collection specifically for automated/drip-style smart lists
  - The modal pattern (title + description + radio list + Dismiss/Confirm) is consistent with screen-063's modal design — same modal component, different content

---
