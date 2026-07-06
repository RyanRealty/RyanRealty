# Batch 10 — FUB Screen Analysis: screen-073 through screen-079

---

## screen-073.png
- **Module / area:** Smart Lists Overview — People / All Expireds list + Column Chooser dropdown open
- **Browser tab title / URL path:** `All Expireds - People - Follo...` | `ryan-realty.followupboss.com/2/people/list/57`
- **Purpose:** Displays the "All Expireds" smart list of contacts with a Column Chooser panel open on the right, showing all available column options the user can toggle on/off.
- **Layout regions:**
  - **Top browser chrome:** Chrome address bar, tab bar, multiple bookmarks/extensions visible
  - **Global top nav bar:** FUB horizontal nav with icons and text labels, "Ask Demo" button top-right
  - **Left sidebar:** Full sidebar with Smart Lists / Collections tree; "All Expireds" is highlighted/selected (teal/blue)
  - **Main content area:** People list table ("All Expireds", 144 contacts) with columns and rows
  - **Right overlay panel:** Column Chooser dropdown panel floating over the right portion of the main table; shows two columns of toggleable fields
- **Global navigation:** People, Inbox (with notification badge), Tasks, Calendar, Deals, Reporting, Admin; Search bar (magnifier icon); notification bell; avatar/account control top-right; "Ask Demo" button
- **Primary content (TABLE):**
  - **List heading:** "All Expireds" with edit (pencil) icon; count badge showing **144**
  - **Toolbar above table:** "Showing 144 people" text; filter/sort icons (funnel icon, grid icon, columns icon); "New Smart List" link (top right area); "Columns" button; "Out Of State Home..." dropdown (filter indicator); "+ Filter" button
  - **Columns visible in table:**
    1. Checkbox (select all)
    2. Name
    3. Contact (phone/email indicator column)
    4. Last Hit (date)
    5. Agent (assigned agent name)
    6. Last Communication (date/text)
    7. Last Received (date/text)
  - **Sample rows visible (partial, small text):**
    - Row 1: [name illegible] | Contact: 2 | [dates] | Agent: [illegible] | Last Comm: Nov 9th | Last Received: [illegible]
    - Row 2: Lucas Bell | Contact: 2 | [dates] | [agent] | Nov 8th, 20 | [illegible]
    - Row 3: Jason Ballard | [Contact]: 2 | Nov 9th, D0 | Nov 27th, 20 | [illegible]
    - Row 4: Mohammad Qasem | 56 Oct 9th | Nov 13th, D0 | [illegible]
    - Row 5: Michael Lance | 17 Cln 9th | Nov 5th, 20 | [illegible]
    - Row 6: [name] | 11 Oct 8th | Nov 5th, 20 | 7 months ago | In office, need something ...
    - Row 7: Randy Patrone | 15 Ok 8th | Nov 7th, 20 | [illegible]
    - Row 8: Charlene Gomez | 1 Ok 8th | Nov 7th, 20 | 7 months ago | In office, need something ...
    - Row 9: Mary Betch Cox | 1 Ok 8th | Nov 7th, 20 | [illegible]
    - Row 10: Robin Ramirez | 1 Ok 8th | Nov 7th, 20 | [illegible]
    - Row 11: Steven Sherry | 1 Ok 8th | Nov 7th, 20 | [illegible]
    - Row 12: Ali Cha... | 1 Ok 8th | Nov 7th, 20 | [illegible]
    - Row 13: Caitloyn Brandt B... | 1 Ok 8th | Nov 7th, 20 | [illegible]
    - Row 14: Frank Propertino | 1 Ok 8th | Nov 8th, 20 | [illegible]
    - Row 15: Ben Blake | 1 Ok 8th | Nov 9th, 20 | [illegible]
    - Row 16: Mark M Garcia | 1 Ok 8th | [illegible]
  - **Phone numbers column (rightmost visible):** Shows phone numbers with green circle status icons, e.g.:
    - (541) 668-9671
    - (208) 788-5888
    - (541) 880-4947
    - (541) 971-3142
    - (541) 549-2241
    - (541) 280-7491
    - (541) 568-2021
    - (541) 870-5026
    - (541) 540-1484
    - (308) 394-8962
    - (503) 309-4951
    - (503) 303-4041
    - (541) 848-4292
    - (541) 488-8755
    - (541) 554-0897
    - (541) 688-8849
- **Column Chooser panel (right overlay):**
  - **Header:** "Columns" with an X close button
  - **Left column of toggleable options (with checkbox state, checked = ON):**
    - ✓ Create (13)
    - Assigned (2)
    - Last Name
    - Email
    - ✓ Tags (2)
    - ✓ Price (1)
    - Stage (0)
    - ✓ Source (0)
    - Home Apps
    - Custom Fields
  - **Right column of toggleable options:**
    - Tags exclude all of: contains...
    - Last Communications since data...
    - Tags exclude all of: contains-2...
    - Tags exclude all of: Interne[illegible]
    - Is a person [illegible]
    - Clear filters
  - (inferred) Checkboxes toggle columns on/off in the table; checked items are currently displayed columns; numbers in parentheses indicate filter criteria counts
- **Filters / search / sort:**
  - Active filter indicator: "Out Of State Home..." shown as a filter chip/dropdown above the table (inferred: filter by "Out Of State Home" tag or field)
  - "+ Filter" button to add more filters
  - Column chooser allows showing/hiding columns
  - "Showing 144 people" — total count is 144 (no pagination shown, possibly all loaded)
- **Buttons & actions:**
  - Pencil/edit icon next to "All Expireds" list name (edit smart list)
  - Funnel icon (filter)
  - Grid/view icon (change view)
  - "Columns" button (opens Column Chooser — currently open)
  - "Out Of State Home..." dropdown filter chip
  - "+ Filter" button
  - "New Smart List" link (top-right of content area)
  - Column Chooser: checkbox toggles for each field; X to close panel
  - Row checkboxes (bulk select, inferred)
- **Statuses / stages / tags / lead score / pills:**
  - Green circle icons next to phone numbers (inferred: indicates phone is valid/active/DNC status)
  - Count badge "144" on list name
  - Column Chooser shows filter criteria: "Tags exclude all of: contains...", "Tags exclude all of: contains-2...", "Tags exclude all of: Interne[illegible]", "Is a person [illegible]"
- **Automation / workflow elements:** None directly visible; smart list "All Expireds" is a filter-based automated group
- **Data-model implications:**
  - Person entity fields: Name (first/last), Contact count, Last Hit date, Assigned Agent, Last Communication date + preview text, Last Received date, Phone number(s), Tags, Price, Stage, Source, Email, Home Apps, Custom Fields
  - Smart list has saved filter criteria referencing Tags exclude conditions and person type filters
  - Phone numbers stored per person; green status circles indicate call/DNC status
- **Notable details / edge cases / counts / numbers:**
  - Total: **144** people in "All Expireds" smart list
  - Column Chooser numbers in parentheses (e.g., "Create (13)", "Assigned (2)", "Tags (2)", "Price (1)") may indicate filter conditions active or sub-options count
  - "7 months ago" appears in Last Communication for at least two rows, suggesting stale contact
  - Last communication preview text: "In office, need something..." visible for two rows

---

## screen-074.png
- **Module / area:** Smart Lists Overview — People / All Expireds list + Column Chooser dropdown open (extended/scrolled state — showing more filter options)
- **Browser tab title / URL path:** `All Expireds - People - Follo...` | `ryan-realty.followupboss.com/2/people/list/57`
- **Purpose:** Same "All Expireds" smart list view as screen-073 but with the Column Chooser panel showing an expanded or different set of column/filter options — appears to be a continuation or scrolled state of the chooser panel.
- **Layout regions:** Identical to screen-073: top nav, left sidebar (All Expireds selected), main table, right Column Chooser overlay panel
- **Global navigation:** Same as screen-073 — People, Inbox, Tasks, Calendar, Deals, Reporting, Admin, Search, notifications, avatar, "Ask Demo"
- **Primary content (TABLE):**
  - Identical table structure to screen-073 with same columns: checkbox, Name, Contact, Last Hit, Agent, Last Communication, Last Received, Phone
  - Same 144-person count
  - Same rows visible (same data, same scroll position)
  - Phone numbers column same as screen-073
- **Column Chooser panel (right overlay) — DIFFERENT content than screen-073:**
  - **Header:** "Columns" with X close button
  - **Left column options (with state):**
    - Monthly Disassure [illegible — likely "Monthly Disclosure" or similar]
    - Settlement Provider [illegible]
    - Near Month Begin [illegible]
    - First Touched
    - Tags (2)
    - Price
    - ✓ Places (inferred checked)
    - Household Size
    - Section
    - Custom Fields [illegible]
  - **Right column options (filter-type items):**
    - Tags exclude all of: contains...
    - Last Communications since data...
    - Tags exclude all of: contains-2...
    - Tags exclude all of: Internet [illegible]
    - Is a person [illegible]
    - Clear filters [link]
  - (inferred) This is a scrolled-down view of the same Column Chooser panel, revealing additional column options not visible in screen-073
- **Filters / search / sort:** Same as screen-073 — "Out Of State Home..." filter chip, "+ Filter" button, 144 total
- **Buttons & actions:** Same as screen-073
- **Statuses / stages / tags / lead score / pills:** Same as screen-073
- **Automation / workflow elements:** None
- **Data-model implications:**
  - Additional Person fields revealed: Monthly Disassure [illegible], Settlement Provider, Near Month Begin, First Touched, Places, Household Size, Section
  - These appear to be additional column options in the chooser beyond what screen-073 showed, suggesting the chooser panel is scrollable
- **Notable details / edge cases / counts / numbers:**
  - Screen-074 and screen-073 appear very similar; the primary difference is the Column Chooser panel showing a different set of field options — suggesting the panel scrolls or has a second page/section of options
  - "Clear filters" link present in the right column of the chooser (bottom area)

---

## screen-075.png
- **Module / area:** Smart Lists Overview — People / All Expireds list + Column Chooser dropdown (third variation/state)
- **Browser tab title / URL path:** `All Expireds - People - Follo...` | `ryan-realty.followupboss.com/2/people/list/57`
- **Purpose:** Third view of the same "All Expireds" list with the Column Chooser panel open, showing yet another scroll position or state — appears to be capturing the right-side filter/column options area.
- **Layout regions:** Identical to screen-073 and screen-074
- **Global navigation:** Same as prior screens
- **Primary content (TABLE):** Same 144-person table, same rows, same columns, same scroll position as screens 073-074
- **Column Chooser panel (right overlay):**
  - Panel appears to be in a similar state to screen-073/074
  - Left column visible options include (partially):
    - Last Name
    - Email
    - Tags
    - Price
    - Stage
    - Source
    - Home Apps
    - Custom Fields
  - Right column filter items:
    - Tags exclude all of: contains...
    - Last Communications since data...
    - Tags exclude all of: contains-2...
    - Tags exclude all of: Internet [illegible]
    - Is a person [illegible]
    - Clear filters
  - A sub-menu or hover state appears to be active on one of the right-column items, showing an expanded tooltip or dropdown with options:
    - "easily add" [illegible]
    - "last add" [illegible]
    - "Tags exclude all of: Interne [illegible]"
    - "Is a person" [illegible]
    - "Clear Show"
  - (inferred) Right-clicking or hovering a filter item reveals additional options
- **Filters / search / sort:** Same as screen-073
- **Buttons & actions:** Same as screen-073; additionally a sub-menu/context action appears on a filter item in the Column Chooser
- **Statuses / stages / tags / lead score / pills:** Same as screen-073
- **Automation / workflow elements:** None
- **Data-model implications:** Same as screens 073-074; the hover/sub-menu on filter criteria items suggests filter conditions can be individually edited or removed from within the Column Chooser panel
- **Notable details / edge cases / counts / numbers:**
  - The subtle difference across screens 073, 074, 075 seems to be the Column Chooser panel scrolling through its available field list
  - All three show the same underlying "All Expireds" smart list with 144 people and identical table data

---

## screen-076.png
- **Module / area:** People list — "All People" smart list / Activity log view
- **Browser tab title / URL path:** `People - Follow Up Boss` | `ryan-realty.followupboss.com/2/people/list/activity`
- **Purpose:** Displays the "All People" list filtered/sorted by recent activity, showing person records with contact info, assigned agent, phone numbers, email addresses, and a "Last Activity" column with descriptive text.
- **Layout regions:**
  - **Top browser chrome:** Chrome address bar, tab bar
  - **Global top nav bar:** FUB nav with icons
  - **Left sidebar:** Smart Lists / Collections tree; "All People" is selected/highlighted at the top (shown in teal/blue)
  - **Main content area:** People list table — "All People" heading, row count, columns
  - **Right panel:** Narrow contextual panel on far right (appears to be empty or showing placeholder text: "No filters applied" or similar — mostly blank)
- **Global navigation:** People, Inbox, Tasks, Calendar, Deals, Reporting, Admin, Search, notifications, avatar, "Ask Demo"
- **Primary content (TABLE — "All People"):**
  - **List heading:** "All People" with count badge (number partially visible, appears to be a large number — [illegible exact count])
  - **Toolbar:** "Showing [N] people"; filter icon; columns icon; "New Smart List" link; "Columns" button; "+ Filter" button
  - **Columns visible:**
    1. Checkbox (select)
    2. Name
    3. Lead Score (number badge)
    4. Agent (assigned agent abbreviation)
    5. Phone (phone number)
    6. Email address
    7. Last Activity (descriptive text, date/time)
  - **Sample rows (reading left to right):**
    - Row 1: Timothy Hall | Score: 4 | Agent: [initials] | (541) 413-6373 | Timothy@email[illegible].com | 13 Apr 19 | Coastal Oregon Real Estate Experts-h o...
    - Row 2: Jacob Nelson | Score: [illegible] | [agent] | (541) 413-6373 | [email] | 13 Apr 19 | Coastal Oregon Real Estate Experts in o...
    - Row 3: Brent Ford | Score: [illegible] | [agent] | (541) 613-9464 | AppAcademy24.com | 13 Apr 19 | Coastal Oregon Real Estate Experts in o...
    - Row 4: Aaron Ray | Score: [illegible] | [agent] | (541) 613-0989 | DiamondMarsh@edu.com [illegible] | 13 Apr 19 | Coastal Oregon Real Estate Experts in o...
    - Row 5: Rochelle Lubin | Score: [illegible] | [agent] | (541) 619-8983 | BarBorder@sc.com | 13 Fen 69 | Coastal Oregon Real Estate Experts in o...
    - Row 6: Schreiner Living Trust | Score: [illegible] | [agent] | (541) 610-0083 | ThreekLeod@me.com | 11 Feb 89 | Coastal Oregon Real Estate Experts in o...
    - Row 7: Timothy Crozier | Score: [illegible] | [agent] | (541) 680-9541 | ThreekLeod@m.com | 11 Feb 89 | Coastal Oregon Real Estate Experts in o...
    - Row 8: Jeanette | Score: [illegible] | [agent] | (541) 680-[illegible] | [email] | 11 Dec 29 | [illegible]
    - Row 9: Christmas Group Living Trust | Score: [illegible] | [agent] | [phone] | [illegible]@[illegible] | 11 Dec 210 | [illegible]
    - Row 10: Jeatene West | Score: [illegible] | [agent] | (541) 940-362-8617 | BestNewhouse@my.com | 11 Dec 210 | [illegible]
    - Row 11: Adam Ash | Score: [illegible] | [agent] | (541) 789-0888 | [illegible] | 11 Dec 210 | [illegible]
    - Row 12: Jessica Baldwin | Score: [illegible] | [agent] | (541) 560-2218 | [illegible] | 11 Dec 210 | [illegible]
    - Row 13: Frank Provencino | Score: [illegible] | [agent] | (541) 488-8751 | [illegible] | 11 Dec 210 | [illegible]
    - Row 14: Camille Emmett | Score: [illegible] | [agent] | (541) 840-3521 | [illegible] | 11 Dec 210 | [illegible]
    - Row 15: Lucile Rein | Score: [illegible] | [agent] | (541) 984-5289 | [illegible] | 11 Dec 210 | [illegible]
  - **Last Activity column text pattern:** "Coastal Oregon Real Estate Experts-h o..." / "Coastal Oregon Real Estate Experts in o..." — this appears to be the subject line or source name of an email/activity received (inferred: automated email from a competing brokerage, indicating leads came in from Coastal Oregon Real Estate Experts)
- **Right panel (far right):** Appears mostly blank/empty; no detail panel content visible; may show "No person selected" state
- **Filters / search / sort:**
  - "All People" — no active smart list filter (showing all contacts)
  - Activity-based sort (sorted by Last Activity descending — inferred from date order)
  - "+ Filter" button available
  - "Columns" button
- **Buttons & actions:**
  - "+ Filter" button
  - "Columns" button
  - "New Smart List" link
  - Row checkboxes (bulk select, inferred)
  - Each row clickable to open person detail (inferred)
- **Statuses / stages / tags / lead score / pills:**
  - Lead Score numeric badges visible in column (values: 4, and others [illegible])
  - Agent assignment column shows agent abbreviation codes
- **Automation / workflow elements:** Activity column suggests emails or automated touches were received from "Coastal Oregon Real Estate Experts" — these may be leads captured from a competing brokerage's email campaigns
- **Data-model implications:**
  - Person fields: Name, Lead Score (integer), Assigned Agent, Phone(s), Email(s), Last Activity (text + date)
  - Activity is surfaced as a column — last activity can be an email subject line
  - URL path `/list/activity` suggests this is a special built-in view sorted by activity recency
- **Notable details / edge cases / counts / numbers:**
  - Multiple leads showing "Coastal Oregon Real Estate Experts" in Last Activity column — suggests these are leads captured from a competing Bend-area brokerage's marketing (possibly portal leads that cited the competing brokerage)
  - Date display format in this view: "13 Apr 19", "11 Feb 89", "11 Dec 210" — these appear garbled/illegible at screenshot resolution; likely formatted as "13 Apr '19" etc. (year abbreviated)
  - Lead scores visible: at least "4" for Timothy Hall

---

## screen-077.png
- **Module / area:** People list — "All People" activity view + Email/Agent hover tooltip (Matt Ryan's contact card)
- **Browser tab title / URL path:** `People - Follow Up Boss` | `ryan-realty.followupboss.com/2/people/list/activity`
- **Purpose:** Same "All People" activity list as screen-076, but with a hover tooltip/popover open showing Matt Ryan's agent contact card over a row in the list — revealing agent contact details.
- **Layout regions:** Identical to screen-076, with an additional floating tooltip/popover over the main table content area (centered-right)
- **Global navigation:** Same as screen-076
- **Primary content (TABLE):** Identical to screen-076 — same rows, same columns, same data
- **Hover tooltip / Agent card popover:**
  - Triggered by hovering over agent name/icon in a row (inferred)
  - Content visible in the popover:
    - **Avatar:** Photo of Matt Ryan (headshot — man with beard, dark hair)
    - **Name:** Matt Ryan
    - **Title/Role:** [illegible — likely "Principal Broker" or "Owner"]
    - **Brokerage:** Ryan Realty LLC (inferred from context; may read "Ryan Realty")
    - **Phone:** 541.703.3095 (inferred from memory — number visible but small)
    - **Email:** [illegible]
    - **Bio/Description text:** Multiple lines of text describing Matt's background — partially legible:
      - "Building community through authentic relationships and..."
      - "[illegible] management services"
    - **Links/Actions at bottom of card:**
      - "Reply to Google review" (inferred from button label visible)
      - "Email [name]" link or similar action
      - Another action button [illegible]
    - **Additional section:** "Hover to preview photos" or similar prompt [illegible]
  - The card appears to be a rich agent profile popover, not just a simple tooltip
- **Filters / search / sort:** Same as screen-076
- **Buttons & actions:**
  - Same table actions as screen-076
  - Popover appears to contain clickable links/buttons for contacting the agent (email, call)
  - "Send Email" button or similar at bottom of popover [illegible label]
- **Statuses / stages / tags / lead score / pills:** Same as screen-076
- **Automation / workflow elements:** None additional
- **Data-model implications:**
  - Agent (User) entity has: Name, Photo/avatar, Title, Brokerage, Phone, Email, Bio text
  - Hovering agent column value in People list triggers an agent profile popover
  - Agent contact card is surfaced inline without navigating away from the list
- **Notable details / edge cases / counts / numbers:**
  - Matt Ryan's agent card is visible — the popover is a detailed profile card, not just a name tooltip
  - This implies FUB stores rich broker/agent profiles with photos and bio text
  - The popover appears centered over the table, partially overlapping multiple rows

---

## screen-078.png
- **Module / area:** People list — "All People" activity view + "Add Person" modal (new contact creation form)
- **Browser tab title / URL path:** `People - Follow Up Boss` | `ryan-realty.followupboss.com/2/people/list/activity`
- **Purpose:** Shows the "Add Person" modal dialog overlaying the "All People" list, used to manually create a new contact/person record.
- **Layout regions:**
  - **Background:** Same "All People" table (screen-076/077 state), dimmed/overlaid
  - **Modal overlay:** Centered modal dialog for adding a new person
  - **Agent card popover (Matt Ryan):** Still partially visible behind/beside the modal (from screen-077 state), suggesting the modal was opened while the agent popover was still showing, OR this is a different state with both UI elements visible simultaneously
- **Global navigation:** Same as prior screens (partially visible behind overlay)
- **Primary content (FORM / MODAL — "Add Person"):**
  - **Modal header:** "Add Person" (title)
  - **Close button:** X in top-right corner of modal
  - **Form fields:**
    1. **First Name** — text input; placeholder: "First Name"; required (inferred)
    2. **Last Name** — text input; placeholder: "Last Name"
    3. **Phone** — text input; placeholder: "Phone"
    4. **Email** — text input; placeholder: "Email" (inferred — field appears below Phone)
    5. **Select a lead source** — dropdown/select; placeholder: "Select a lead source"; lists available lead sources
  - **Form is empty** — no data pre-filled; all fields blank
  - **Buttons:**
    - **Cancel** — secondary button (left); closes modal without saving
    - **Add Person** (or "Create") — primary action button (right, appears teal/blue); submits form and creates new person record
- **Filters / search / sort:** Background list unchanged
- **Buttons & actions:**
  - X (close modal)
  - Cancel button
  - Add Person / Create button (primary CTA)
  - "Select a lead source" dropdown (opens lead source picker)
- **Statuses / stages / tags / lead score / pills:** None in the modal
- **Automation / workflow elements:**
  - Lead source selection (inferred: may trigger action plan assignment or routing based on source)
  - (inferred) Creating a person may auto-assign to default agent or trigger a welcome action plan
- **Data-model implications:**
  - Person creation requires minimum: First Name, Last Name, Phone, Email, Lead Source
  - Lead Source is a selectable field (dropdown implies a predefined list of sources stored in the system)
  - Person entity minimum fields: firstName, lastName, phone, email, leadSource
- **Notable details / edge cases / counts / numbers:**
  - Modal is minimal — only 4-5 fields for quick creation; additional fields (address, tags, agent assignment, notes) likely available after creation or on the full person detail page
  - "Select a lead source" is the 5th field, suggesting source is captured at creation time
  - The Add Person modal appears to be triggered by a "+ Add Person" button or similar CTA in the People list toolbar

---

## screen-079.png
- **Module / area:** People list — "All People" activity view + User account menu dropdown (top-right avatar menu)
- **Browser tab title / URL path:** `People - Follow Up Boss` | `ryan-realty.followupboss.com/2/people/list/activity`
- **Purpose:** Same "All People" list with a dropdown account/user menu open from the avatar/account control in the top-right of the global nav, showing account management options.
- **Layout regions:**
  - **Background:** Same "All People" table (screen-076 state), not dimmed
  - **Top-right dropdown menu:** Account/user dropdown menu open, floating below the avatar icon
  - **Agent card popover (Matt Ryan):** Visible in the main content area (same as screen-077 state)
- **Global navigation:** Same as prior screens; avatar/account icon in top-right is the trigger for this dropdown
- **Primary content (TABLE):** Same "All People" list, identical to screen-076/077
- **Account dropdown menu (top-right):**
  - **Header/User identity section:**
    - User avatar (circle with initials or photo — small, top of dropdown)
    - Username / display name: [illegible at this resolution — likely "Matt Ryan" or account name]
  - **Menu items visible:**
    1. My Settings
    2. My Skyline (inferred — or similar personal view label) [illegible exact label]
    3. Pause Drips [or "Pause Clips" — illegible]
    4. Product Changes [or "Product Updates"]
    5. System Status
    6. Get Help [or "Help Center"]
    7. Log Out [or "Sign Out"]
  - Each item is a clickable link (inferred)
  - Menu has a clean white dropdown card with subtle border/shadow
- **Filters / search / sort:** Same as screen-076
- **Buttons & actions:**
  - Each dropdown menu item is a navigation action:
    - "My Settings" → opens user profile/settings page (inferred: /settings/profile or similar)
    - "My Skyline" → opens personal pipeline/skyline view [illegible — exact label uncertain]
    - "Pause Drips" → pauses all active drip/action plan sequences for this user [illegible — label uncertain]
    - "Product Changes" → opens product changelog or release notes (inferred)
    - "System Status" → opens system status page (inferred: status.followupboss.com)
    - "Get Help" → opens help center or support chat (inferred)
    - "Log Out" → logs out of FUB session
  - Clicking outside the dropdown closes it (inferred)
- **Statuses / stages / tags / lead score / pills:** None in the dropdown; background table same as screen-076
- **Automation / workflow elements:**
  - "Pause Drips" option (if that is the label) is significant — it is a global pause control that stops all automated drip/action plan sequences for the current user, implying FUB has a way to bulk-pause automations from the account menu
- **Data-model implications:**
  - User/Account entity has: display name, avatar, personal settings, drip/automation state (pauseable)
  - System has a status page (implies SLA awareness)
  - Drip sequences are user-scoped (can be paused per user)
- **Notable details / edge cases / counts / numbers:**
  - The account dropdown is accessed from the avatar icon in the global top-right nav
  - "Pause Drips" (if confirmed) is a high-impact action accessible from a single click in the account menu — significant for a rebuild spec (should have confirmation dialog)
  - Matt Ryan's agent card popover from screen-077 is still visible in the background, suggesting this screenshot was taken while the popover was already open — both UI elements (agent popover + account dropdown) visible simultaneously
  - Dropdown appears to have approximately 6-7 menu items (exact labels partially illegible at screenshot resolution)
