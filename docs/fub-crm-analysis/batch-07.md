# FUB Screen Analysis — Batch 07 (screen-049 through screen-056)

---

## screen-049.png

- **Module / area:** Admin — Ponds
- **Browser tab title / URL path:** "Ponds - Follow Up Boss" / `ryan-realty.followupboss.com/2/ponds`
- **Purpose:** Lists all Lead Ponds (shared lead pools that team members can pull from) defined in the account; one pond exists.
- **Layout regions:**
  - Global top nav bar (full width, top)
  - Admin sub-nav tabs (horizontal tab row beneath main nav)
  - Main content area: page header + table listing ponds
  - No right rail, no modal
- **Global navigation:**
  - Left icon rail (home/dashboard icon)
  - Top nav items: People, Inbox, Tasks, Calendar, Deals, Reporting, **Admin** (active/selected)
  - Search box (center, placeholder "Search")
  - Right side: notification bell, avatar cluster (3 small avatars visible), profile/account controls
- **Primary content:**
  - Page header: **"Lead Ponds"** (H1, left-aligned)
  - Table columns:
    1. **Name** — pond name as a hyperlink
    2. **Pond Lead** — (column header visible, no value shown — appears to indicate the lead assignment method)
    3. **Team Members** — avatar images showing which team members belong to the pond
    4. **Actions** — pencil (edit) icon + trash (delete) icon
  - One row of data:
    - **Name:** "Out Of State Home Owners" (blue hyperlink)
    - **Pond Lead:** (empty / no value visible)
    - **Team Members:** 3 avatar thumbnails (headshots visible, identities [illegible] at this size)
    - **Actions:** pencil icon (edit), trash icon (delete)
  - No pagination shown; only 1 pond exists
- **Filters / search / sort:** None visible on this page; no filter controls above the table
- **Buttons & actions:**
  - **"+ Add Pond"** button (top-right, teal/blue fill) — creates a new pond (inferred)
  - **"How Ponds work"** link (top-right, near Add Pond, small text) — opens help/documentation (inferred)
  - Pencil icon (edit) per row — opens pond edit form (inferred)
  - Trash icon (delete) per row — deletes pond with confirmation (inferred)
  - Pond name is a clickable hyperlink — navigates to pond detail (inferred)
- **Statuses / stages / tags / lead score / pills:** None visible
- **Automation / workflow elements:**
  - Ponds are a lead-routing mechanism: leads are placed in a pond and team members (assigned as pond members) can claim/pull leads from the shared pool
  - 3 team members are associated with the "Out Of State Home Owners" pond
- **Data-model implications:**
  - Entity: **Pond** with fields: `name` (string), `pond_lead` (assignment method or designated lead agent — exact meaning unclear from this view), `team_members` (array of user refs)
  - Ponds are a sub-entity under Admin configuration; separate from Smart Lists
  - Many-to-many between Ponds and Team Members
- **Notable details / edge cases / counts / numbers:**
  - Only 1 pond exists in this account: "Out Of State Home Owners"
  - Admin sub-nav visible tabs (left to right): Overview, Lead Flow, Groups, **Team**, Action Plans, Automations, **Ponds** (active), Email Templates, Text Templates, Import, Custom Fields, Stages, Phone Numbers, Tags, Integrations, Company, API, More ▾
  - The "Pond Lead" column header exists but its value is blank for the one visible row — possibly not configured or column indicates something else

---

## screen-050.png

- **Module / area:** People — All People list view
- **Browser tab title / URL path:** "People - Follow Up Boss" / `ryan-realty.followupboss.com/2/people?n=0`
- **Purpose:** Main contacts/leads list showing all people in the CRM with columns for contact info, stage, last activity, agent assignment, and quick-action links.
- **Layout regions:**
  - Global top nav bar
  - Left sidebar: People navigation with Collections, Smart Lists grouped by neighborhoods/areas
  - Main content area: table of contacts with column headers and rows
  - Right edge: partially visible action links per row
- **Global navigation:**
  - Left icon rail (dashboard icon)
  - Top nav items: **People** (active), Inbox, Tasks, Calendar, Deals, Reporting, Admin
  - Search box (center)
  - Right side: avatar cluster, notification controls
- **Primary content (table):**
  - Table header shows: **Showing 876 people** (count visible top-left of table area)
  - Sort/view controls visible: arrow icons, list-view icon
  - Column headers (left to right):
    1. **Name** (with avatar/photo)
    2. **Stage** (small label below name in some rows)
    3. **Lead Score** (numeric, column header label [illegible] at this zoom but values visible as single digits)
    4. **Agent** (assigned agent name)
    5. **Last Seen** (date)
    6. **Phone** (phone number with icons)
    7. **Email** (email address)
    8. **Create** / **Created** (date column — rightmost visible before actions)
    9. Action links (far right, partially cut off): text "Inquir: [city/area]..." — appears to be the last activity / inquiry label
  - Row data visible (approximately 15 rows, reading top to bottom):
    - Row 1: **[Name illegible at this zoom]** — Stage: [illegible] — Agent: [illegible] — Last: [illegible] — Phone: [illegible] — Email: [illegible]
    - Rows contain avatar photos, stage pills, phone numbers with dial icons, email addresses
    - Far-right action column shows text beginning with "Inquir:" followed by address or area text (inferred = last inquiry location)
  - **Showing 876 people** total
  - Pagination controls: page navigation arrows visible at bottom (inferred)
- **Left sidebar content:**
  - **People** (section header)
  - Sub-items: All People (active, shown in main content)
  - **COLLECTIONS** section:
    - Arrival & Pending Clients
    - [several more collection items, labels partially legible]
    - Past Clients/Sphere: Que...
    - Past Clients: No Call Attempt
    - [illegible items]
    - GW Leads: No Call Attempt
  - **Neighborhoods** section with area/neighborhood smart lists:
    - Tetherow
    - Sunriver
    - Pronghorn
    - Black Butte Ranch
    - Northwest Crossing
    - [illegible]
    - Crosswater
    - Caldera Springs
    - Sunriver Loop — Shooting Bro...
    - Bend — River West
    - Bend — Awbrey Butte
    - Bend — Summit West
    - Bend — Century West
    - Bend — Southern Crossing [cnt]
    - Miscellaneous [?]
  - Each neighborhood item shows a count number (e.g., Tetherow: [number], Sunriver: [number])
- **Filters / search / sort:**
  - Search box in top nav
  - Filter controls above table (arrow/sort icons, column selector)
  - Smart list sidebar acts as pre-set filter (clicking a neighborhood filters to that group)
  - "Add Smart List View" link or similar at bottom of sidebar (inferred)
- **Buttons & actions:**
  - Column selector button (top-right of table area, "Columns" label)
  - Sort arrows on column headers (inferred clickable)
  - Per-row: phone icon (click to call), email icon (click to email), possibly SMS icon
  - "How All People work" help link (inferred top-right)
- **Statuses / stages / tags / lead score / pills:**
  - Stage pills visible per row (colors vary — green, gray, orange inferred)
  - Lead score numeric values visible (single/double digit numbers in a dedicated column)
  - Last Seen timestamps per row
- **Automation / workflow elements:** None directly visible on this list view
- **Data-model implications:**
  - Person entity fields visible: name, avatar, stage, lead_score, assigned_agent, last_seen (datetime), phone, email, created_date, last_inquiry_location
  - Smart Lists organized by neighborhood/community area for geographic filtering
  - Collections appear to be curated groups (action-plan-driven or tag-driven)
- **Notable details / edge cases / counts / numbers:**
  - Total contact count: **876 people**
  - The right column shows recent inquiry descriptions (address + city text) — suggests last property inquiry or listing inquiry is stored per contact
  - Sidebar neighborhood list contains 10+ named subdivisions/areas beyond the neighborhood section header

---

## screen-051.png

- **Module / area:** People — Smart List view ("Active & Pending Clients")
- **Browser tab title / URL path:** `ryan-realty.followupboss.com/2/people/25` (smart list ID 25)
- **Purpose:** Displays a filtered Smart List called "Active & Pending Clients" which is currently returning zero results (empty state).
- **Layout regions:**
  - Global top nav bar
  - Left sidebar (same People nav + Collections + Neighborhoods as screen-050)
  - Main content area: smart list header + filter description banner + empty state graphic + error/action suggestions
  - Small floating panel on right edge with checkboxes (tag suggestions panel)
- **Global navigation:** Same as screen-050 (People active)
- **Primary content:**
  - Smart list name: **"Active & Pending Clients"** (H1, with emoji rocket icon "🚀" preceding the name)
  - Count badge: **"1 MEMBER"** (teal badge next to the name — indicates 1 person manages this list, or 1 person qualifies but filters out)
  - Sub-header description (blue banner): "A smart list of all clients you're actively working with. This smart list will display contacts in current active/pending and upcoming contract stages." (approximately)
  - Table column headers visible (same columns as All People): Name, Contact, Stage, Source, Last Use [?], Region/Season [?], Proposed, Proposed [another column], Last [date], Task Set [?], Last Activity [?]
  - **Empty state:** Large illustration (person with binoculars) + text: **"No people match filters, try another search."**
  - **"No people found"** state is shown — 0 results
- **Right floating panel (tag suggestions):**
  - Checkbox list with two items visible:
    - "Tags include any of: [illegible]..."
    - "Tags include any of: Active Cl..." (Active Clients inferred)
  - This appears to be a filter-builder or tag-filter suggestion panel
- **Filters / search / sort:**
  - Filter bar above table (condensed, showing active filter criteria)
  - "Add Smart List View" or "New Smart List View" button (top-right of main content)
  - Columns button (top-right)
  - The smart list has pre-configured filters that are currently matching 0 people
- **Buttons & actions:**
  - "New Smart List View" button or similar (top-right, teal)
  - Columns selector
  - Filter edit controls (pencil icon on the smart list filter bar, inferred)
- **Statuses / stages / tags / lead score / pills:**
  - "1 MEMBER" badge on smart list name
  - The list is configured to filter by stage (active/pending contract stages)
- **Automation / workflow elements:** None directly visible
- **Data-model implications:**
  - Smart Lists are named, saved filter sets with descriptions
  - Smart lists can have member counts (agents who use the list)
  - Smart list filters can include stage conditions and tag conditions
  - Smart list description is stored as free-text metadata
- **Notable details / edge cases / counts / numbers:**
  - Zero contacts currently match the "Active & Pending Clients" criteria
  - Smart list description mentions "active/pending and upcoming contract stages" — implies FUB stages include "Active," "Pending," "Upcoming Contract" or similar
  - The right panel appears to suggest tag-based filter additions

---

## screen-052.png

- **Module / area:** Person detail view — Contact record for Grant Hardgrove
- **Browser tab title / URL path:** `ryan-realty.followupboss.com/2/people/819` (person ID 819)
- **Purpose:** Full detail view of a single contact (Grant Hardgrove) showing communication history, contact fields, relationships, and right-rail action widgets.
- **Layout regions:**
  - Global top nav bar
  - Left sidebar (People nav + Smart Lists, same as prior screens but collapsed/minimized)
  - Main detail area (center): contact header + communication timeline/feed
  - Right rail: action widgets panel (Action Plans, Activity, Tasks, Appointments, AgentFire FUB Widget, Automations, Files, Collaborators)
- **Global navigation:** Same as screen-050 (People active)
- **Primary content (Person detail):**
  - **Contact name:** Grant Hardgrove (H1, top of main area)
  - **Stage indicator:** (visible near name — label [illegible] at this zoom, likely "Lead" or a pipeline stage)
  - **Contact header sub-fields visible:**
    - Phone(s): one or more phone numbers listed
    - Email(s): one or more email addresses
    - Tags: visible tag pills (content [illegible])
  - **"+ Create Note"** button or quick-action bar visible below header
  - **Add note / to-do / appointment controls** (row of buttons: Add note, to do text field, possibly "Add Task")
  - **Communication timeline (center feed):**
    - Multiple email/message entries visible, shown as cards in chronological order
    - Entry 1 (oldest visible): From **Rebecca Peterson** to "Out Of State Home Owners Stagers" (inferred group name) — email body text visible, lengthy paragraph about Bend Oregon real estate market, mentions "Central Oregon," "low barrier negotiating," "full transparency"
    - Entry 2: From **Rebecca Peterson** — another email in the "Out Of State Home Owners" thread, body visible, discusses local market
    - Entry 3: From **Matt Ryan** — email reply, body text visible (content [illegible] at this zoom)
    - Each entry shows: sender name + avatar, timestamp, preview of body text, email subject implied
    - Labels on entries: "Received to Out Of State Home Owners Stagers by Rebecca Peterson" (inferred label format)
    - "Note Imported by Matt Ryan" label visible on at least one entry
  - **Left side of detail area (contact fields panel):**
    - Section: **Relationships** with sub-items (P icon + entry visible)
    - Section: **Groups** (visible label)
    - Section: **Financials** (visible label, partially obscured)
    - Section: **Custom Fields** (visible label with expand arrow)
    - Fields visible under a section:
      - PRICE RANGE: C[illegible] (likely "$XXX,XXX–$YYY,YYY")
      - BUDGET: "$475K–$750K" (approximately, [illegible])
      - Price range label: "2 bd · [sqft]..." (minimum size/criteria)
      - Section with "LOOKING FOR": residential/area criteria text
    - **CONTACT** section:
      - Address: "22 My Drive St, Bend, 97702" (approximately [illegible] — shown as mailing address)
      - Alt address field
    - **Leader** section (visible label — may refer to assigned lead agent)
    - **Financials** with fields:
      - DOWN PAYMENT: $[illegible]
      - Pre-approval amount visible
      - Monthly budget visible
    - **In-side details** (timestamp):
      - in-side: Bend, OR
      - Last contacted date visible
- **Right rail widgets (vertical stack):**
  - **Action Plans** widget (collapsed, header visible)
  - **Activity** widget — shows "Save 6 months 14 days" or similar activity summary
  - **Tasks** widget (collapsed)
  - **Appointments** widget (collapsed) — "No upcoming appointments"
  - **AgentFire FUB Widget** (collapsed — third-party integration widget)
  - **Automations** widget (collapsed)
  - **Files** widget (collapsed)
  - **Collaborators** widget (collapsed)
- **Filters / search / sort:** None on this view; timeline is chronological
- **Buttons & actions:**
  - **"+ Create Note"** — opens note compose (inferred)
  - Add note / to-do / appointment row (text input + buttons)
  - **"Send"** button (blue, bottom of compose area — to send email/message)
  - Email compose area visible with "Add To" field showing "Out Of State Home Owners Stagers" as recipient
  - Each timeline entry has reply/forward icons (inferred)
  - Edit contact info (pencil icon on fields, inferred)
- **Statuses / stages / tags / lead score / pills:**
  - Tags visible in header area (content [illegible])
  - Stage pill visible (content [illegible])
  - Lead score or priority indicator (inferred from right rail)
- **Automation / workflow elements:**
  - "AgentFire FUB Widget" in right rail = third-party AgentFire integration displayed inline
  - Automations widget collapsed in right rail
  - Action Plans widget collapsed in right rail (can add/view action plans for this contact)
- **Data-model implications:**
  - Person entity has: name, stage, phones[], emails[], tags[], relationships[], groups[], price_range (custom field), budget (custom field), looking_for criteria, address, down_payment, pre_approval, monthly_budget, assigned_agent (leader)
  - Communication timeline merges emails sent/received + notes + imports into one feed
  - Groups membership visible on person record
  - "Out Of State Home Owners" group/pond connects to this person
  - Custom fields support financial data (budget, down payment, pre-approval)
- **Notable details / edge cases / counts / numbers:**
  - Person ID: 819
  - Contact is linked to "Out Of State Home Owners" group — pond member
  - Multiple brokers (Rebecca Peterson + Matt Ryan) have communicated with this contact
  - Email content visible discussing Bend OR real estate market with transparency/negotiation focus
  - Right rail has 8 distinct widget sections (Action Plans, Activity, Tasks, Appointments, AgentFire FUB Widget, Automations, Files, Collaborators)

---

## screen-053.png

- **Module / area:** Admin — Team management
- **Browser tab title / URL path:** "Team - Follow Up Boss" / `ryan-realty.followupboss.com/2/teams`
- **Purpose:** Lists all team members in the FUB account with their roles, contact info, connected apps, last activity, and permission settings.
- **Layout regions:**
  - Global top nav bar
  - Admin sub-nav tabs (same as screen-049)
  - Main content area: page header + team member table
  - No sidebar, no right rail, no modal
- **Global navigation:** Same as screen-049 (Admin active), **Team** tab active in Admin sub-nav
- **Primary content (table):**
  - Page header: **"3 team members"** (count shown)
  - **"+ Add Team Members"** button (top-right, teal/blue)
  - Column headers:
    1. **Name** (with avatar photo)
    2. **Role**
    3. **Phone**
    4. **Connected Email**
    5. **Connected MLS**
    6. **Last Seen** (split into Web + iOS sub-rows)
    7. **Can Export** (checkbox column)
    8. **Pause Leads** (checkbox column)
    9. **Actions** (Edit / Delete links)
  - Row 1 — **Matt Ryan:**
    - Avatar: photo (headshot)
    - Name: Matt Ryan
    - Sub-label: `mattdryan.realty...` (email domain prefix, truncated)
    - Role: **Owner**
    - Phone: **(541) 213-6706**
    - Connected Email: `matt@ryan-r...` (truncated) + checkmark icon + [icon]
    - Connected MLS: "Not connected"
    - Last Seen: Web: 6 minutes ago / iOS: an hour ago
    - Can Export: checkbox (checked, blue checkmark)
    - Pause Leads: (no checkmark — not paused)
    - Actions: **Edit** (link, no Delete for Owner)
  - Row 2 — **Rebecca Peterson:**
    - Avatar: photo (headshot)
    - Name: Rebecca Peterson
    - Sub-label: `rebeccapeter...` (truncated)
    - Role: **Admin** ▾ (dropdown indicator)
    - Phone: **(415) 308-9087**
    - Connected Email: `rebeccape...` (truncated) + checkmark + [icon]
    - Connected MLS: "Not connected"
    - Last Seen: Web: 4 months ago / iOS: 15 days ago
    - Can Export: (no checkmark visible)
    - Pause Leads: (no checkmark visible)
    - Actions: **Edit** | **Delete**
  - Row 3 — **Paul Stevenson:**
    - Avatar: photo (headshot)
    - Name: Paul Stevenson
    - Sub-label: `pauldryan-re...` (truncated)
    - Role: **Agent** ▾ (dropdown indicator)
    - Phone: **(541) 977-6841**
    - Connected Email: `paul@ryan-re...` (truncated) + checkmark + [icon]
    - Connected MLS: "Not connected"
    - Last Seen: Web: 5 months ago / iOS: 4 months ago
    - Can Export: (no checkmark visible)
    - Pause Leads: (no checkmark visible)
    - Actions: **Edit** | **Delete**
- **Filters / search / sort:** None visible
- **Buttons & actions:**
  - **"+ Add Team Members"** (top-right) — opens add member flow (inferred)
  - **Edit** per row — opens edit member modal (inferred, confirmed by screen-054)
  - **Delete** per row (not available for Owner role) — removes team member (inferred)
  - Role dropdown (▾ on Admin and Agent rows) — change role inline (inferred)
- **Statuses / stages / tags / lead score / pills:**
  - Role badges: **Owner**, **Admin**, **Agent** (text labels, no color differentiation visible)
  - **Can Export** checkbox: checked for Matt Ryan only
  - **Pause Leads**: none checked (all team members are actively receiving leads)
  - Last Seen splits: Web + iOS sub-rows per member
- **Automation / workflow elements:**
  - "Pause Leads" column = toggle to pause new lead assignments to a specific agent
  - Connected Email status (checkmark) = email sync active
  - Connected MLS = "Not connected" for all three
- **Data-model implications:**
  - TeamMember entity: `name`, `email`, `phone`, `role` (Owner | Admin | Agent), `connected_email` (boolean + address), `connected_mls` (boolean), `last_seen_web` (datetime), `last_seen_ios` (datetime), `can_export` (boolean), `pause_leads` (boolean)
  - Roles hierarchy: Owner > Admin > Agent
  - Owner cannot be deleted (no Delete action)
  - Only Owner has Can Export checked
  - Phone numbers: Matt 541-213-6706, Rebecca 415-308-9087, Paul 541-977-6841
- **Notable details / edge cases / counts / numbers:**
  - Exactly **3 team members** total
  - All three have "Not connected" MLS
  - Matt last seen: Web 6 min ago, iOS 1 hour ago (most recently active)
  - Rebecca: Web 4 months ago, iOS 15 days ago
  - Paul: Web 5 months ago, iOS 4 months ago
  - Connected Email shows checkmark (green/teal) for all three — email sync is active
  - How Teams work help link (top-right, small text): "How Teams work"

---

## screen-054.png

- **Module / area:** Admin — Team — Edit Member modal (for Matt Ryan)
- **Browser tab title / URL path:** "Team - Follow Up Boss" / `ryan-realty.followupboss.com/2/teams` (modal overlaid on team page)
- **Purpose:** Modal dialog to edit a team member's profile fields, role, group membership, and notification preferences.
- **Layout regions:**
  - Background: dimmed team list (screen-053)
  - Foreground modal: centered dialog titled "Edit Matt Ryan"
  - Modal has header, body form fields, and footer buttons
- **Global navigation:** Same as screen-053 (dimmed in background)
- **Primary content (modal form):**
  - **Modal title:** "Edit Matt Ryan" (with pencil/edit icon prefix)
  - **Form fields:**
    1. **First Name** (text input) — value: "Matt"
    2. **Last Name** (text input) — value: "Ryan"
    3. **Login Email** (text input, full row width) — value: "matt@ryan-realty.com"
    4. **Phone Number** (text input, full row width) — value: "5412136706" (no formatting shown)
    5. **User Merge Field** (label with ❓ help icon, no input visible or it is empty/read-only) — a merge variable identifier for use in templates
    6. **Role** (select dropdown) — value: "Owner" (selected)
    7. **Group** (select dropdown, right of Role) — value: "Team Ryan, Seller Leads" (selected — shows two groups or a combined group name)
    8. **Notify about all new inquiries in Follow Up Boss** (checkbox with ❓ help icon) — state: [not clearly checked or unchecked at this zoom, inferred unchecked]
  - Footer buttons:
    - **Cancel** (text button, gray) — closes modal without saving
    - **Save** (button, teal/blue fill) — saves changes
- **Filters / search / sort:** N/A (modal)
- **Buttons & actions:**
  - **Cancel** — dismisses modal
  - **Save** — submits form and updates team member record
  - Role dropdown — change role (Owner, Admin, Agent options inferred)
  - Group dropdown — change group assignment
  - Help icons (❓) on User Merge Field and Notify checkbox — open tooltip/help
  - Close (×) icon top-right of modal
- **Statuses / stages / tags / lead score / pills:**
  - Role: "Owner" (current)
  - Group: "Team Ryan, Seller Leads" — Matt is in at least two groups or one group named "Team Ryan, Seller Leads"
- **Automation / workflow elements:**
  - "Notify about all new inquiries in Follow Up Boss" checkbox = global lead notification toggle for this user
  - Group membership affects lead routing (inferred)
- **Data-model implications:**
  - TeamMember editable fields: `first_name`, `last_name`, `login_email`, `phone_number`, `user_merge_field` (template variable), `role`, `group[]` (many groups possible), `notify_all_inquiries` (boolean)
  - Groups entity: named groups ("Team Ryan", "Seller Leads" appear to be separate group names displayed together, or one compound group)
  - User Merge Field likely maps to a token like `{{agent.name}}` or `{{merge_field}}` in email/text templates
- **Notable details / edge cases / counts / numbers:**
  - Matt's login email confirmed: `matt@ryan-realty.com`
  - Phone field shows raw digits: `5412136706` (no dashes/dots)
  - Group field shows: "Team Ryan, Seller Leads" — comma-separated suggests multiple group memberships displayed in one field
  - Modal width: approximately 500px centered (inferred)
  - The "User Merge Field" label has a help icon but no value filled in — this field may be for a custom merge code used in templates to reference the agent

---

## screen-055.png

- **Module / area:** People — Smart List view ("Pronghorn")
- **Browser tab title / URL path:** `ryan-realty.followupboss.com/2/people/100` (smart list ID 100)
- **Purpose:** Displays the "Pronghorn" neighborhood/community smart list filtered contacts with a people table and a context dropdown menu open showing row actions.
- **Layout regions:**
  - Global top nav bar
  - Left sidebar (People nav + Collections + Neighborhoods — "Pronghorn" highlighted/active in sidebar)
  - Main content area: smart list header + table of contacts + open context-menu/dropdown
  - Right side: floating tag/filter suggestion panel (same as screen-051)
- **Global navigation:** Same as screen-050 (People active)
- **Primary content:**
  - Smart list name: **"Pronghorn"** (H1)
  - **"24 MEMBERS"** (or similar count — badge next to name, teal, inferred exact number from context)
  - Table column headers (same as All People view):
    1. Name (with avatar)
    2. Stage (small label)
    3. Lead Score
    4. Agent
    5. Last Text
    6. Phone
    7. Email
    8. Last Activity (description)
  - Showing approximately 15 rows visible; total count badge: **"Showing 24 results"** (inferred — "24 MEMBERS" badge)
  - Sidebar shows "Pronghorn" with count **29** (number next to Pronghorn in sidebar)
  - Row data visible (names partially legible):
    - **Curtis Barrus** — Stage: [illegible] — Agent: [illegible] — Phone: (541) 682-1928 — Email: [illegible] — Last: Nov '24 [date] — Last Activity: "Inquir[y]: 12004 Moura Dr, [illegible] [?] #7740" (inferred)
    - **Brian Trick** — Phone: (541) 760-8827 — Last: Nov '24
    - **Bartholomew Crabtree** (or similar) — Nickname: [illegible] — Stage: [illegible]
    - **Jessica Meyers** (approximately) — Phone: (614) [illegible]
    - **Jeffrey Broyles** — Phone: (775) 562-5686
    - **Steven Costa** — Phone: (541) 611-9988
    - **David Cortez** — Phone: (408) [illegible]
    - More rows below, names [illegible] at this zoom
    - **DB Aller LLC** — appears to be a company/entity record rather than an individual person
    - **Shaun Brady** — Phone: (541) [illegible]
    - **Josh Barson** (or similar) — Phone: [illegible]
  - **Open context menu/dropdown** visible on one row (right side of a row):
    - Menu options visible:
      1. **Update Stage**
      2. **Update Agent**
      3. **Assign Pond**
      4. **Update Location**
      5. **Merge People**
      6. **Adding Timeframe** (or "Update Timeframe")
      7. **Apply Action Plan**
      8. **Delete People** (or "Delete Person")
    - Dropdown appears to be a right-click or "..." (ellipsis) menu on a row
- **Right floating panel:**
  - Same tag/filter suggestion checkboxes as screen-051 (2 checkbox options visible)
- **Filters / search / sort:**
  - Filter bar above table
  - Sort indicators on columns
  - Smart list is pre-filtered by neighborhood/community tag or source (Pronghorn)
- **Buttons & actions:**
  - **"New Smart List View"** or similar (top-right)
  - **Columns** selector (top-right)
  - Row ellipsis/right-click menu with 7-8 actions (listed above)
  - Per-row: phone dial icon, email icon
- **Statuses / stages / tags / lead score / pills:**
  - Stage labels visible per row (specific values [illegible])
  - Lead scores visible (numbers in dedicated column)
  - Source labels: some rows show "Inquir[y]:" prefix in last-activity column
  - Last text date columns show "Nov '24", "Nov '24" etc.
- **Automation / workflow elements:**
  - Context menu includes "Apply Action Plan" — can bulk or per-person assign action plans from the list view
  - "Assign Pond" in context menu — can assign a person to a pond from the list
- **Data-model implications:**
  - Row-level context menu actions: `update_stage`, `update_agent`, `assign_pond`, `update_location`, `merge_people`, `update_timeframe`, `apply_action_plan`, `delete_person`
  - Smart lists can contain company/entity records (e.g., "DB Aller LLC")
  - Pronghorn smart list links to 29 contacts (sidebar count) but table shows "24 members" (possible mismatch or pagination)
- **Notable details / edge cases / counts / numbers:**
  - Sidebar count for Pronghorn: **29**
  - Table header or badge count: approximately **24** (inferred from "MEMBERS" badge)
  - Context menu has 8 distinct bulk/per-person action options
  - "DB Aller LLC" entry indicates FUB can store company entities mixed with individual person records
  - Phone area codes span 541, 614, 775, 408 — contacts are from multiple states (Oregon, Ohio, Nevada, California) — consistent with "Out Of State" focus of this brokerage

---

## screen-056.png

- **Module / area:** People — Smart List view ("Pronghorn") with row-level context menu open on a specific contact
- **Browser tab title / URL path:** `ryan-realty.followupboss.com/2/people/100` (same Pronghorn smart list as screen-055)
- **Purpose:** Shows the Pronghorn smart list with an expanded context/action dropdown menu open on a specific row, revealing the full set of per-person bulk-action options.
- **Layout regions:**
  - Global top nav bar
  - Left sidebar (same as screen-055, Pronghorn highlighted)
  - Main content area: table + open dropdown menu (larger, more items visible than screen-055)
  - Right side: tag/filter suggestion panel
- **Global navigation:** Same as screen-050 (People active)
- **Primary content:**
  - Smart list: **"Pronghorn"** — same table layout as screen-055
  - Same approximately 15 rows visible
  - **Open dropdown menu** (expanded, now showing more/all options, positioned on the right side of a specific row):
    - Menu options (reading top to bottom):
      1. **Update Stage**
      2. **Update Agent**
      3. **Assign Pond**
      4. **Update Location**
      5. **Merge People**
      6. **Adding Timeframe** (or "Update Timeframe")
      7. **Apply Action Plan**
      8. **Delete People**
    - This is the same context menu as screen-055, possibly fully expanded or from a different row
  - The dropdown appears slightly repositioned or triggered from a different row than screen-055; possible the screenshot captures a hover state
  - Row data matches screen-055 (same contacts visible):
    - Curtis Barrus, Brian Trick, [Bartholomew] Crabtree [or similar], Jessica [Meyers], Jeffrey Broyles, Steven Costa, David Cortez, DB Aller LLC, Shaun Brady, Josh [Barson], additional rows
  - Last Activity column shows inquiry descriptions: "Inquir[y]: [address] [city] Dr, [zip] #XXXX"
- **Right floating panel:** Same tag-filter suggestion checkboxes (2 items)
- **Filters / search / sort:** Same as screen-055
- **Buttons & actions:**
  - Full context menu with 8 actions (same list as screen-055):
    1. Update Stage
    2. Update Agent
    3. Assign Pond
    4. Update Location
    5. Merge People
    6. Adding/Update Timeframe
    7. Apply Action Plan
    8. Delete People
  - Clicking any menu item opens the relevant sub-action form/modal (inferred)
- **Statuses / stages / tags / lead score / pills:**
  - Same stage, lead score, last-text-date columns as screen-055
  - Stage pill values partially legible per row
- **Automation / workflow elements:**
  - "Apply Action Plan" is accessible directly from the list-view context menu without opening the person detail
  - "Assign Pond" allows moving a person from smart list context without entering their record
- **Data-model implications:**
  - The context menu represents person-record mutation operations available at the list level
  - "Merge People" implies duplicate detection / merge capability — person records can be merged (deduplication)
  - "Update Timeframe" implies Person has a `timeframe` field (buying/selling timeframe, e.g., "0–3 months," "3–6 months," "6–12 months")
  - "Update Location" implies Person has a `location` (preferred location/area interest) that can be updated
  - Delete operates at the person level from the list (with confirmation, inferred)
- **Notable details / edge cases / counts / numbers:**
  - Screen-055 and screen-056 appear to be near-identical states of the same Pronghorn list view with the context menu open — screen-055 may show the menu appearing and screen-056 shows the same or a second menu trigger
  - The 8 context menu actions are confirmed across both screens: Update Stage, Update Agent, Assign Pond, Update Location, Merge People, Adding/Update Timeframe, Apply Action Plan, Delete People
  - Last Activity descriptions in rightmost column show "Inquir[y]: [street address] [city], [ST] [zip] #NNNN" format — the inquiry reference number (#XXXX) suggests a listing or property reference ID
  - "DB Aller LLC" appears in both screens in the same position — confirms a company/entity can be a contact in FUB people lists
