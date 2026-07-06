# Batch 05 — FUB Screen Analysis (screens 033–040)

---

## screen-033.png

- **Module / area:** Admin / Settings — Overview (main Admin hub / dashboard)
- **Browser tab title / URL path:** "Admin Overview - Follow Up..." | `ryan-realty.followupboss.com/2/adminoverview`
- **Purpose:** The top-level Admin settings hub, presenting all administrative configuration categories as a visual tile grid with brief descriptions.
- **Layout regions:**
  - Global top nav bar (top, full width) — app-wide navigation icons and account controls
  - Admin secondary tab bar (below top nav) — horizontal scrolling list of Admin sub-sections
  - Main content area — 3-column grid of labeled tile cards grouped by section (Lead Flow, Follow Up, Integrations, Customize)
- **Global navigation:**
  - Top nav icons visible: People, Inbox, Tasks, Calendar, Deals, Reporting, Admin (active/highlighted), Search
  - Account/avatar controls at top-right (avatar icon visible)
  - "Ask Gemini" button top-right (browser extension artifact)
- **Primary content (tile grid, grouped by section):**

  **Lead Flow section:**
  - **Lead Flow** — "You'll want to check & test a lead before & review how leads flow into the system." (inferred description from tile)
  - **Groups** — "Automatically route automations in different groups"

  **Ponds section:**
  - **Ponds** — "Customize your ponds so people automatically ..." (text truncated)

  **Follow Up section:**
  - **Action Plans** — "Create action plans with email, tasks, calls & more. Manage stages & more."
  - **Automations** — "Create automated action-plans triggered by a stage change or other trigger events."
  - **Email Templates** — "Create and manage email templates with unlimited number of templates."
  - **Text Templates** — "Create text templates to speed up your outreach via text."
  - **Business Registration** — "Register your business to send text messages from your account options."
  - **Team** — "Manage & invite team members to your team. Manage your team & phone numbers."
  - **Import** — "Import data to your CRM with Excel. [illegible remainder]"
  - **Phone Numbers** — "Add and manage the phone numbers this [illegible remainder]"
  - **Company** — "Your company info helps share details about your brokerage guide & more etc."
  - **Email Domain Authentication** — "Verify your email domain to hook up anything..."

  **Integrations section:**
  - **API Keys & Lead Email** — "Access your API keys for integrations & your Follow Up Boss email to forward leads."
  - **Pixel** — "Track your website activity to attribute your Follow Up Boss to the CTA to know interest."
  - **IDX Integrations** — "Get which Real Estate website provider you've integrated with Follow Up Boss integrations."
  - **All Integrations** — "Email Marketing, Facebook, Zillow, Dotloop, Link up all other integrations."

  **Customize section:**
  - **Custom Fields** — "With your website fields you can make custom fields & always [illegible]"
  - **Custom Stages** — "With your custom stages you can always create & always always custom stages [illegible]"
  - **Tags** — "With tags you can group leads & always [illegible]"
  - **Appointment Stages** — "With Appointments Stages you can always [illegible]"

- **Filters / search / sort:** None visible on this overview page.
- **Buttons & actions:**
  - Each tile is clickable and navigates to the respective admin sub-section (inferred)
  - Secondary tab bar includes: Overview (active), Lead Flow, Groups, Team, Action Plans, Automations, Ponds, Email Templates, Text Templates, Import, Custom Fields, Stages, Phone Numbers, Tags, Integrations, Company, API, More (with dropdown arrow)
- **Statuses / stages / tags / lead score / pills:** None visible.
- **Automation / workflow elements:** Tiles for Action Plans and Automations reference automation capabilities (drip, stage-triggered).
- **Data-model implications:** The admin hub reveals core CRM entity types: leads/people, groups, ponds, action plans, automations, email templates, text templates, phone numbers, stages, custom fields, tags, appointment stages, integrations (IDX, Pixel, API, email domain).
- **Notable details / edge cases / counts / numbers:**
  - Secondary tab bar is scrollable/has "More" overflow
  - "Ask Gemini" button visible in top-right is a browser extension, not a FUB native feature
  - The tile grid description text is very small and partially illegible at screenshot resolution
  - Some tile descriptions appear to have placeholder/incomplete text ("always always")

---

## screen-034.png

- **Module / area:** Admin — Automations list
- **Browser tab title / URL path:** "Automations - Follow Up Bo..." | `ryan-realty.followupboss.com/2/automations/2`
- **Purpose:** Lists all saved automations in the account with their name, trigger, completion stats, and enabled/disabled toggle.
- **Layout regions:**
  - Global top nav bar (full width)
  - Admin secondary tab bar (Automations tab active)
  - Main content area — folder/list panel with automation rows in a table
  - Top-right: "Create Automation" button
- **Global navigation:**
  - Top nav: People, Inbox, Tasks, Calendar, Deals, Reporting, Admin (active), Search
  - Admin sub-tabs: Overview, Lead Flow, Groups, Team, Action Plans, Automations (active/highlighted in blue), Ponds, Email Templates, Text Templates, Import, Custom Fields, Stages, Phone Numbers, Tags, Integrations, Company, API, More
- **Primary content (Automations list/table):**
  - **Folder indicator:** "1 Folder" displayed above the table
  - **Folder name:** "My Automations" (with expand/collapse; shows "6 Folders" sub-count — [illegible exact]); "Create Folder" link visible top-right of folder section
  - **Total count:** "36 Automations" shown above the table
  - **Column headers:** Name | [Trigger description — column header unclear, small text] | Enrolled | Completed | [column header illegible] | [column header illegible] | Created By | Status | Created On | Actions
  - **Sort indicator:** Name column appears to have sort applied (arrow visible — "Best LP Nurture > audience-seller [DAILY - DO NOT ENABLE]" sorts to top)

  **Automation rows visible (partial — table appears to have many rows):**
  | Name | Enrolled | Completed | % | [fields] | Status | Created On |
  |---|---|---|---|---|---|---|
  | Best LP Nurture > audience-seller [DAILY - DO NOT ENABLE] | 13 | 5 | 4% | [illegible] | — | [date illegible] |
  | Seller LP Nurture > audience-seller [from...] | 15 | 0 | 4% | [illegible] | Matt Ryan | (toggle) | [date] |
  | Ryan Realty - Nurturing Content Clone | [illegible] | [illegible] | [illegible] | [illegible] | Matt Ryan | (toggle) | [date] |
  | Ryan Realty - Expired Spring Strategy | 52 | 8 | 15%–34% | 134 | Matt Ryan | (toggle) | [date] |
  | Ryan Realty - Remote Home Owner | 0 | 0 | 4% | [illegible] | Matt Ryan | (toggle) | [date] |
  | Ryan Realty - New Seller | 0 | 0 | 4% | [illegible] | Matt Ryan | (toggle) | [date] |
  | Unsubscribe-Matt | [illegible] | [illegible] | [illegible] | [illegible] | [illegible] | (toggle) | [date] |
  | Nurture Long Term Buyer | [listing] | [illegible] | [illegible] | [illegible] | Follow Up B... | (toggle) | [date] |
  | Open House Follow Up | [illegible] | [illegible] | [illegible] | [illegible] | Follow Up B... | (toggle) | [date] |
  | New House Leads | [illegible] | [illegible] | [illegible] | [illegible] | SC: Follow B... | (toggle) | [date] |
  | Start Post-Closing Follow Up | [listing] | [illegible] | [illegible] | [illegible] | [illegible] | (toggle) | [date] |
  | [illegible] | [illegible] | [illegible] | [illegible] | [illegible] | [illegible] | (toggle) | [date] |
  | New Inquiry for an existing lead: FUB | [listing] | 1 | 0 | 1-100% | Follow Up B... | (toggle) | [date] |
  | [more rows below visible fold — table continues] | | | | | | |

- **Filters / search / sort:**
  - Sort applied on name column (arrow visible)
  - No explicit search/filter controls visible at this view
  - Folder navigation (collapse/expand "My Automations" folder)
- **Buttons & actions:**
  - "Create Automation" button (top right, blue/primary)
  - "Create Folder" link
  - Per-row toggle (enable/disable each automation — blue = enabled, gray = disabled)
  - Per-row action icons (edit pencil, duplicate, delete — inferred from other screens)
  - Clicking an automation name opens the automation editor (inferred)
- **Statuses / stages / tags / lead score / pills:**
  - Status column shows toggle states (on/off)
  - Some "Created By" shows "Follow Up B..." (system/default automations) vs. user names (Matt Ryan)
  - "SC:" prefix on some created-by values ([illegible] — possibly "Synced" or another prefix)
- **Automation / workflow elements:**
  - Each row is a full automation with enrolled count, completion count, and percentage
  - "[DAILY - DO NOT ENABLE]" in automation name indicates a production safety flag on certain test automations
  - "[from...]" suffix on some names indicates cloned/imported automations
  - "Clone" in some names indicates duplicated automations
- **Data-model implications:**
  - Automation entity: id, name, trigger, enrolled_count, completed_count, completion_rate_pct, created_by (user or system), status (enabled boolean), created_at, folder_id
  - Folder entity: id, name, automation_ids[]
  - Relation: Automation → created_by → User
- **Notable details / edge cases / counts / numbers:**
  - 36 total automations, organized in folders
  - "1 Folder" at account level; "My Automations" folder contains the visible automations
  - Some automations are system-defaults ("Follow Up B..." = Follow Up Boss system)
  - Automation named "[DAILY - DO NOT ENABLE]" is a critical safety note — naming convention to prevent accidental activation
  - "34%" shown in one row's completion column (highest visible completion rate)
  - Enrolled numbers range from 0 to 134 visible across rows

---

## screen-035.png

- **Module / area:** Admin — Automation editor (step/action flow builder) — editing "Buyer LF Nurture" automation
- **Browser tab title / URL path:** "Editing - Buyer LF Nurture ..." | `ryan-realty.followupboss.com/2/automations/2/edit/110`
- **Purpose:** Visual step-by-step automation flow editor, showing a draft automation (marked DO NOT ENABLE) with a sidebar of available action types and a canvas of chained steps.
- **Layout regions:**
  - Global top nav bar
  - Admin secondary tab bar (Automations highlighted)
  - Left sidebar panel — trigger selection + action palette/toolbox
  - Center canvas — sequential automation flow with step cards
  - Right panel — step detail/configuration pane (appears closed/not expanded in this view)
  - Top breadcrumb: "Back to Automations" link; automation name: "Buyer LF Nurture > automation-buyer [DRAFT - DO NOT ENABLE]"
  - Top-right: "Disabled" toggle (gray/off)
- **Global navigation:** Same as prior screens (People, Inbox, Tasks, Calendar, Deals, Reporting, Admin, Search)
- **Primary content (automation flow canvas):**

  **Left sidebar — Trigger section:**
  - Label: "Drop a Step to the canvas"
  - "Send Email" step type visible in the palette (blue card)
  - A text field with "Q Send Email" (search/filter for step types — inferred)

  **Left sidebar — Controls section:**
  - **Conditions** section (header)
  - **Actions** section header with items:
    - Time Delay
    - Send Email
    - Reassign Agent or Lender
    - Add Collaborators
    - Remove Collaborators
    - Add Tags
    - Remove Tags
    - Create Task
    - Change Stage
    - Add Note

  **Center canvas — automation flow steps (top to bottom):**
  1. **Tag Added** (trigger tile, pink/rose background) — "What tags or audiences" [illegible detail]
  2. **Send Email** (action card, blue) — [illegible email subject/body snippet] — followed by an arrow/connector
  3. **Create Task** (action card, teal/green) — "Do This now! [illegible] after it follows the [illegible]"
  4. **Create Task** (action card, teal/green) — "Do This now! [illegible] — Tuesday..." [illegible]
  5. Arrow connector + count/delay label (appears to be a wait step)
  6. **Send Email** (action card, blue) — "If [illegible] things [illegible] to ..."
  7. Arrow connector
  8. **Send Email** (action card, blue) — [illegible content]
  9. Arrow connector
  10. **Send Email** (action card, blue) — [illegible content]

- **Filters / search / sort:**
  - "Q Send Email" — search box inside the action palette to filter step types (inferred)
- **Buttons & actions:**
  - "Back to Automations" breadcrumb link
  - "Disabled" toggle (currently gray/disabled — automation is in draft)
  - Each step card is clickable/editable (opens right panel with step details — inferred)
  - "+" / "Add step" buttons between steps (inferred from flow builder pattern)
  - Left sidebar action items are drag-and-drop onto canvas (inferred from "Drop a Step to the canvas" label)
- **Statuses / stages / tags / lead score / pills:**
  - Automation status: "Disabled" (toggle shows gray/off)
  - Automation is marked "[DRAFT - DO NOT ENABLE]" in the title
- **Automation / workflow elements:**
  - Trigger: Tag Added (pink trigger card at top)
  - Actions in sequence: Send Email → Create Task → Create Task → [delay] → Send Email → Send Email → Send Email
  - Time-based delays visible between steps (arrows with timing labels — text too small to read)
  - Flow is linear (no visible branching/conditions in this view)
- **Data-model implications:**
  - Automation step types: trigger (TagAdded), action (SendEmail), action (CreateTask), control (TimeDelay), action (ReassignAgent), action (AddCollaborators), action (RemoveCollaborators), action (AddTags), action (RemoveTags), action (ChangeStage), action (AddNote)
  - Automation has: name, status (draft/enabled/disabled), trigger_type, steps[] (ordered)
  - Each step has: type, config (varies by type), position/order
- **Notable details / edge cases / counts / numbers:**
  - "[DRAFT - DO NOT ENABLE]" naming convention is consistent with prior screens — used to prevent production activation of in-development automations
  - The flow shown has at least 7 steps (trigger + 6 actions)
  - Canvas scrolls vertically; only top portion visible

---

## screen-036.png

- **Module / area:** Admin — Automation editor — step detail panel open (Send Email step)
- **Browser tab title / URL path:** "Editing - Buyer LF Nurture ..." | `ryan-realty.followupboss.com/2/automations/2/edit/110`
- **Purpose:** Same automation editor as screen-035, but with the right-side configuration panel expanded, showing the "Send Email" step detail form.
- **Layout regions:**
  - Global top nav bar
  - Admin secondary tab bar
  - Left sidebar (same action palette as screen-035)
  - Center canvas (same flow as screen-035, slightly dimmed/de-emphasized)
  - **Right detail panel (expanded — new in this view):** "Send Email" step configuration
- **Global navigation:** Same as prior screens
- **Primary content (right panel — Send Email step config):**

  **Panel header:** "Send Email"
  - Sub-label: "Name of step" (text field — value: "[illegible/not filled]" or placeholder)

  **From section:**
  - Label: "From"
  - Value: "G: FUB Send Search is set up" (inferred — small text, partially illegible; appears to reference a configured sender/from address)

  **To section:**
  - Label: "To"
  - Value: "Agent assigned to the contact" (dropdown/select — showing current selection)

  **Recipient Preferences section:**
  - Label: "Recipient Preferences"
  - Options (radio buttons or checkboxes):
    - "Send to primary contact only"
    - "Send to contact and all relationships"
    - "Send to assigned agent"

  **Delivery Preferences section:**
  - Label: "Delivery Preferences"
  - Options (radio/checkboxes):
    - "Send Immediately" (selected/checked — bold or highlighted)
    - "Send between 8:00 am and 7:00 pm"
    - "Send during company office hours"
    - "Send at custom time"

  **Bottom:** "Delete" button (visible at bottom of panel — inferred to delete this step)

- **Filters / search / sort:** None in this panel view.
- **Buttons & actions:**
  - Right panel "Delete" button (removes this step from the automation)
  - "Disabled" toggle (top right, same as screen-035 — automation still disabled)
  - Recipient Preferences radio/checkbox options (selectable)
  - Delivery Preferences radio/checkbox options (selectable)
  - "To" dropdown to change recipient
  - "From" field (select sender identity)
- **Statuses / stages / tags / lead score / pills:**
  - Automation status: Disabled
- **Automation / workflow elements:**
  - Send Email step configuration reveals:
    - Sender identity (from address — linked to FUB email send setup)
    - Recipient targeting (primary contact only, all relationships, or assigned agent)
    - Delivery time control (immediate, business hours window 8am–7pm, company office hours, or custom time)
- **Data-model implications:**
  - SendEmail step config: from_address, to (recipient_type enum: primary_contact | all_relationships | assigned_agent), delivery_preference (enum: immediate | time_window_8_7 | office_hours | custom_time), template_id (the email content, referenced but not shown in this panel)
  - Relationship between contact and related people (for "send to all relationships" option)
- **Notable details / edge cases / counts / numbers:**
  - "Send between 8:00 am and 7:00 pm" — likely Pacific time (inferred from company time zone)
  - "Send during company office hours" implies a company-level office hours schedule configuration
  - The "From" field showing "G: FUB Send Search is set up" is partially illegible but indicates the sender is configured via a Google Workspace or FUB email integration

---

## screen-037.png

- **Module / area:** Admin — Automation editor — same Send Email step detail panel (slightly different scroll or interaction state)
- **Browser tab title / URL path:** "Editing - Buyer LF Nurture ..." | `ryan-realty.followupboss.com/2/automations/2/edit/110`
- **Purpose:** Identical to screen-036 — same automation step editor with Send Email right panel open; appears to be a near-duplicate with minor scroll or UI state difference.
- **Layout regions:** Identical to screen-036 (left palette, center canvas, right Send Email config panel).
- **Global navigation:** Same as prior screens.
- **Primary content (right panel — Send Email step config):**

  **Panel header:** "Send Email"
  - Sub-label: "Name of step" (text input)

  **From:**
  - "G: FUB Send Search is set up" (same as screen-036; partially illegible)

  **To:**
  - "Agent assigned to the contact" (dropdown selection)

  **Recipient Preferences:**
  - "Send to primary contact only"
  - "Send to contact and all relationships"
  - "Send to assigned agent"

  **Delivery Preferences:**
  - "Send Immediately" (appears selected)
  - "Send between 8:00 am and 7:00 pm"
  - "Send during company office hours"
  - "Send at custom time"

  **Delete** button at bottom of panel

- **Differences from screen-036:** The right panel content appears identical. The center canvas may be scrolled slightly or the selected step may differ (inferred). The top banner still reads "Buyer LF Nurture > automation-buyer [DRAFT - DO NOT ENABLE]" and toggle is still "Disabled."
- **Filters / search / sort:** None.
- **Buttons & actions:** Same as screen-036.
- **Statuses / stages / tags / lead score / pills:** Automation disabled (draft).
- **Automation / workflow elements:** Same as screen-036.
- **Data-model implications:** Same as screen-036 — no new entities revealed.
- **Notable details / edge cases / counts / numbers:**
  - This screen appears to be a near-duplicate of screen-036, possibly captured at a slightly different moment or scroll state. Both should be considered together for the Send Email step configuration spec.

---

## screen-038.png

- **Module / area:** Admin — Stages management
- **Browser tab title / URL path:** "Stages - Follow Up Boss" | `ryan-realty.followupboss.com/2/stages`
- **Purpose:** Manage all contact lifecycle stages — view stage names, people counts, and perform edit/delete actions; reorder via drag handles.
- **Layout regions:**
  - Global top nav bar
  - Admin secondary tab bar (Stages tab active/underlined)
  - Main content area — "Stages" header + "Add Stage" button + stage list table
  - Help link top-right: "How Stages work"
- **Global navigation:**
  - Top nav: People, Inbox, Tasks, Calendar, Deals, Reporting, Admin (active), Search
  - Admin sub-tabs: Overview, Lead Flow, Groups, Team, Action Plans, Automations, Ponds, Email Templates, Text Templates, Import, Custom Fields, Stages (active), Phone Numbers, Tags, Integrations, Company, API, More
- **Primary content (Stages table):**
  - **Header row:** "Stages" (section title) | "Add Stage" (button, top right, blue)
  - **Column headers:** [drag handle icon] | Stage Name | People | Actions

  **Stage rows (in order as displayed — order is meaningful for pipeline flow):**
  | Stage Name | People | Actions |
  |---|---|---|
  | Seller Prospect | 7,523 | edit icon, delete icon |
  | Lead | 8,243 | edit icon, delete icon |
  | A - Hot 1-3 Months | 2 | edit icon, delete icon |
  | B - Warm 3-6 Months | 0 | edit icon, delete icon |
  | C - Cold 6+ Months | 46 | edit icon, delete icon |
  | Renter - future buyer | 0 | edit icon, delete icon |
  | Active Client | 8 | edit icon, delete icon |
  | Pending | 0 | edit icon, delete icon |
  | Past Client | 21 | edit icon, delete icon |
  | Sphere | 0 | edit icon, delete icon |
  | Archive | 2 | edit icon, delete icon |
  | Closed | 0 | edit icon, delete icon |
  | Trash | 47 | [no edit/delete icons visible — may be system stage] |
  | Real Estate Agent | 2,342 | edit icon, delete icon |
  | Vendor | 1 | edit icon, delete icon |
  | Nurture | 0 | edit icon, delete icon |
  | [scroll continues — additional stages may exist below] | | |

  - **People counts are clickable links** (blue numbers) — navigates to filtered people list for that stage (inferred)
  - **Drag handles** (vertical bar icon, left of each row) — for reordering stages

- **Filters / search / sort:** No filters or search visible. Order is drag-reorderable.
- **Buttons & actions:**
  - "Add Stage" (top right, blue button) — opens create-stage modal (inferred)
  - Per-row edit icon — opens edit form for that stage name
  - Per-row delete icon — deletes stage (with confirmation — inferred)
  - Drag handle (left of row) — drag to reorder stage sequence
  - People count link — opens filtered people list (inferred)
  - "How Stages work" help link (top right)
- **Statuses / stages / tags / lead score / pills:**
  - **Full stage list (this is the canonical Ryan Realty stage taxonomy):**
    - Seller Prospect (7,523 people) — top of funnel, seller-focused
    - Lead (8,243 people) — largest segment, general unqualified leads
    - A - Hot 1-3 Months (2 people) — buyer timeline A
    - B - Warm 3-6 Months (0 people) — buyer timeline B
    - C - Cold 6+ Months (46 people) — buyer timeline C
    - Renter - future buyer (0 people)
    - Active Client (8 people)
    - Pending (0 people)
    - Past Client (21 people)
    - Sphere (0 people)
    - Archive (2 people)
    - Closed (0 people)
    - Trash (47 people) — appears to have no edit/delete icons (system-protected stage)
    - Real Estate Agent (2,342 people) — partner/referral segment
    - Vendor (1 person)
    - Nurture (0 people)
- **Automation / workflow elements:** Stages drive automation triggers (stage-change triggers reference these stage names). Automations from screen-034 reference stage names.
- **Data-model implications:**
  - Stage entity: id, name, people_count (derived), sort_order (drag-reorderable), system_protected (Trash stage appears undeletable)
  - Person entity: stage_id → Stage
  - Total contacts visible across stages: 7,523 + 8,243 + 2 + 0 + 46 + 0 + 8 + 0 + 21 + 0 + 2 + 0 + 47 + 2,342 + 1 + 0 = ~18,235 (consistent with ~18,176 referenced in memory)
- **Notable details / edge cases / counts / numbers:**
  - Trash has 47 people but no edit/delete action icons visible (system-protected)
  - Closed has 0 people (all closed transactions presumably archived or moved)
  - "Real Estate Agent" stage (2,342) is a large segment — likely referral network / broker contacts
  - "Lead" (8,243) and "Seller Prospect" (7,523) are by far the largest segments
  - Total shown: ~18,235 contacts across visible stages
  - Stage names use a lettered sub-classification system for buyer temperature (A/B/C)

---

## screen-039.png

- **Module / area:** Admin — Tags management
- **Browser tab title / URL path:** "Stages - Follow Up Boss" (browser tab title appears cached/stale from prior page) | `ryan-realty.followupboss.com/2/tags`
- **Purpose:** List and manage all tags used across contacts, showing tag names, usage counts, and actions to edit/delete each tag; search tags.
- **Layout regions:**
  - Global top nav bar
  - Admin secondary tab bar (Tags tab active/underlined in blue)
  - Main content area — tags count header, search box, "Turn on auto-tagging new leads" button, and tags table
  - Help link top-right: "How Tags work"
- **Global navigation:** Same as prior screens (People, Inbox, Tasks, Calendar, Deals, Reporting, Admin, Search)
- **Primary content (Tags table):**
  - **"1,486 Tags"** total count shown at top left (with small info icon)
  - **"Turn on auto-tagging new leads"** button (top right of content area, next to search)
  - **Search box:** "Search tags" (placeholder text, right-aligned above table)
  - **Column headers:** Name (sortable — up arrow indicator visible) | Used | Actions

  **Tag rows visible (alphabetical, A-Z sort, partial — page shows first ~20):**
  | Tag Name | Used (count, blue link) | Actions |
  |---|---|---|
  | 1M | 1,052 | edit icon, delete icon |
  | 2M | 200 | edit icon, delete icon |
  | 3M | 33 | edit icon, delete icon |
  | 4M | 8 | edit icon, delete icon |
  | 5M+ | 6 | edit icon, delete icon |
  | absentee | 1,809 | edit icon, delete icon |
  | Absentee Owner | 21 | edit icon, delete icon |
  | Active Search | 1 | edit icon, delete icon |
  | Area: Redmond | 1 | edit icon, delete icon |
  | area:bend-westside | 7,674 | edit icon, delete icon |
  | audience:broker-recruit | 233 | edit icon, delete icon |
  | audience:buyer | 42 | edit icon, delete icon |
  | audience:seller | 3,508 | edit icon, delete icon |
  | auto:brand-voice-plain-honest | 204 | edit icon, delete icon |
  | auto:seller-seq-new | 60 | edit icon, delete icon |
  | auto:seller-seq-multi [illegible — row cut off at bottom] | 144 | edit icon, delete icon |

  - The table continues below the visible fold (1,486 total tags, only ~16 visible)
  - "Used" count values are blue links (clicking navigates to filtered people list for that tag — inferred)

- **Filters / search / sort:**
  - Sort: Name column sorted A→Z (up-arrow visible)
  - Search: "Search tags" text input (free-text filter of tag list)
- **Buttons & actions:**
  - "Turn on auto-tagging new leads" button — enables automatic tag application to incoming leads (inferred)
  - Per-row edit icon (pencil) — rename tag
  - Per-row delete icon (trash) — delete tag (with confirmation — inferred)
  - Used count (blue link) — navigates to people filtered by that tag
  - Name column header — click to sort (currently A→Z, click again for Z→A)
  - "How Tags work" help link
- **Statuses / stages / tags / lead score / pills:**
  - 1,486 total tags in the system
  - **Visible tag taxonomy reveals naming conventions:**
    - **Timeline tags (numeric):** 1M, 2M, 3M, 4M, 5M+ (mortgage/price point — inferred to mean $1M, $2M, $3M, $4M, $5M+ price range targets)
    - **Property ownership:** absentee, Absentee Owner (1,809 + 21 = 1,830 absentee-owner contacts)
    - **Behavior:** Active Search
    - **Geographic (area: prefix):** Area: Redmond, area:bend-westside (7,674 contacts — largest single tag)
    - **Audience segmentation (audience: prefix):** audience:broker-recruit (233), audience:buyer (42), audience:seller (3,508)
    - **Automation-applied tags (auto: prefix):** auto:brand-voice-plain-honest (204), auto:seller-seq-new (60), auto:seller-seq-multi... (144)
- **Automation / workflow elements:**
  - "auto:" prefixed tags are auto-applied by automation runs (system tags)
  - "Turn on auto-tagging new leads" feature would auto-tag incoming leads with source/behavior tags
- **Data-model implications:**
  - Tag entity: id, name, used_count (derived from contact tag associations), created_at
  - Person_Tag join: person_id, tag_id
  - Tag naming conventions: prefix-based namespacing (area:, audience:, auto:) — critical for the rebuild's tag taxonomy
  - "area:bend-westside" (7,674) is the most-used tag visible — indicates geographic segmentation at scale
- **Notable details / edge cases / counts / numbers:**
  - 1,486 total tags — a very large tag set; many likely from automated import/enrichment
  - 1M–5M+ tags (1,052 + 200 + 33 + 8 + 6 = 1,299 people) appear to be price-tier segmentation tags
  - "absentee" (1,809) vs "Absentee Owner" (21) — two overlapping tags for same concept (case/format inconsistency)
  - "area:bend-westside" (7,674) is unusually large — a batch-tagged geographic segment
  - "audience:seller" (3,508) aligns with the 7,523 Seller Prospect stage but is smaller (not all seller prospects have the tag)
  - Tags with `auto:` prefix confirm automated tagging from action plans/automations
  - Table has a horizontal scrollbar at bottom (inferred from scroll indicator at bottom of screenshot)

---

## screen-040.png

- **Module / area:** Admin — Company Settings
- **Browser tab title / URL path:** "ryan-realty.followupboss.com/2/company-settings" (visible in address bar)
- **Purpose:** Company-level account configuration including name, industry, address, time zone, virtual phone settings, call recording, and legal disclosure.
- **Layout regions:**
  - Global top nav bar
  - Admin secondary tab bar (Company tab active/underlined in blue)
  - Main content area — "Company Settings" form card (centered, ~50% width)
  - Help link top-right: "How Company works"
- **Global navigation:** Same as prior screens (People, Inbox, Tasks, Calendar, Deals, Reporting, Admin, Search)
- **Primary content (Company Settings form):**

  **Header:** "Company Settings" | "View Business Registration" link (top right of card, blue text)

  **Form fields:**

  | Field Label | Type | Value / State |
  |---|---|---|
  | Company | Text input | Ryan Realty |
  | Industry | Select dropdown | Real Estate |
  | Franchise | Select dropdown | Other |
  | Address | Text input (line 1) | 115 NW Oregon Ave. |
  | Address (line 2) | Text input | #2 |
  | City | Text input | Bend |
  | State | Text input | Oregon |
  | Zipcode | Text input | 97703 |
  | Country | Select dropdown | United States |
  | Time zone | Select dropdown | Pacific Time (GMT-07:00) |

  **Virtual Phone section (sub-header: "VIRTUAL PHONE"):**
  | Field Label | Type | Value / State |
  |---|---|---|
  | Phone | Icon + "Manage Settings" link | [phone number — icon with edit pencil; "Manage Settings" link below] |
  | Fallback number | Text (display) | (545) 213-6706 [sic — likely 541.213.6706; OCR may have mis-read area code] |
  | Spam label calling protection | Text + link | Ryan Realty LLC (Change) |
  | Call Recording | Toggle (on/off) | "Enable call recording for team members" — toggle appears ON (blue) |
  | (sub-toggle) | Toggle | "Automatically play call recording disclosure for all calls" — appears OFF (gray) |
  | Legal Disclosure | Preview button | "Preview call disclo[sure]..." — [illegible rest] |

- **Filters / search / sort:** None.
- **Buttons & actions:**
  - "View Business Registration" link — navigates to business registration sub-page (required for text messaging per screen-033)
  - "Manage Settings" link (under Phone) — opens phone number management
  - "(Change)" link next to spam label company name — changes company name for spam protection caller ID
  - Call Recording toggle — enable/disable recording for all team members
  - Disclosure auto-play toggle — enable/disable automatic legal disclosure playback
  - "Preview call disclo[sure]" button — auditions the legal disclosure recording
  - Save/submit button (likely below visible fold — form changes need saving — inferred)
- **Statuses / stages / tags / lead score / pills:**
  - Call Recording: ON (blue toggle)
  - Auto-play disclosure: OFF (gray toggle)
- **Automation / workflow elements:**
  - "Enable call recording for team members" — affects all outbound/inbound calls in the system
  - Legal disclosure auto-play — regulatory compliance feature (real estate call disclosure requirements)
- **Data-model implications:**
  - Company entity: id, name ("Ryan Realty"), industry ("Real Estate"), franchise ("Other"), address_line1 ("115 NW Oregon Ave."), address_line2 ("#2"), city ("Bend"), state ("Oregon"), zipcode ("97703"), country ("United States"), timezone ("America/Los_Angeles" / Pacific), virtual_phone_number, fallback_number ("541-213-6706"), spam_protection_label ("Ryan Realty LLC"), call_recording_enabled (bool: true), call_disclosure_autoplay (bool: false)
- **Notable details / edge cases / counts / numbers:**
  - **Fallback number shown as "(545) 213-6706"** — OCR likely misread as 545; canonical is 541.213.6706 (Matt's direct line per CLAUDE.md)
  - Address: 115 NW Oregon Ave., #2, Bend, Oregon 97703 — this is the registered office address
  - Timezone: Pacific Time (GMT-07:00) — currently PDT (summer), will be GMT-08:00 in winter (PST)
  - Industry = "Real Estate", Franchise = "Other" (independent brokerage, not a franchise chain)
  - Call recording is enabled for team members — all calls are recorded (compliance/training use)
  - Legal disclosure auto-play is OFF — meaning brokers must manually trigger disclosure or it plays conditionally
  - "View Business Registration" link connects to A2P/10DLC text messaging business registration (required for texting — see memory reference to Twilio cutover)
  - Spam label protection set to "Ryan Realty LLC" — this is what shows on caller ID for outbound calls from FUB virtual phone

---
