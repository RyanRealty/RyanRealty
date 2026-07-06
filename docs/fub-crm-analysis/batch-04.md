# FUB Screenshot Analysis — Batch 04 (screen-025 through screen-032)

---

## screen-025.png

- **Module / area:** Inbox — Assigned sub-folder (empty state)
- **Browser tab title / URL path:** Tab title partially visible ("My Inbox (559) - Follow Up ..."); URL: `ryan-realty.followupboss.com/2/inbox-new/0/assigned`
- **Purpose:** Shows the "Assigned" sub-bucket of My Inbox in an empty state, prompting the user to get started with Inbox via an onboarding video card.
- **Layout regions:**
  - **Left sidebar** (fixed, ~300px wide): hierarchical inbox folder tree under "My Inbox" and "Company"
  - **Center/main panel** (narrow list column ~300px): "326 Unread Messages" count header with All / Unread filter tabs; main area shows avatar + "Assigned is empty." empty state text
  - **Right main area** (~60% width): large dark onboarding video card with "Get Started Today" call-to-action
  - **Global top nav bar**: standard FUB nav
- **Global navigation:** People | Inbox (active/highlighted) | Tasks | Calendar | Deals | Reporting | Admin | Search bar | Notification bell | Avatar cluster (top right)
- **Primary content:**
  - Left sidebar folder tree:
    - **My Inbox (559)** — expand arrow
      - Inbox
      - **Assigned** (currently selected, highlighted in blue)
      - Drafts
      - Sent
      - Closed
    - **Company (54)** — collapsed, expand arrow
  - Center list column:
    - "326 Unread Messages" — count badge/label above filter tabs
    - Filter tabs: **All** | **Unread** (Unread appears active/selected based on the 326 label context)
    - **Filter** button (right side of tab row, dropdown arrow)
    - Main empty-state: gray avatar icon + "Assigned is empty." text
  - Right panel (onboarding video card):
    - Dark teal/navy background card with FUB logo (stacked chevrons icon)
    - Headline text: "How the Inbox helps you never miss important conversations"
    - Play button overlay (video thumbnail)
    - Below card: **"Get Started Today"** heading
    - Subtext: "Inbox shows you all emails & texts with your contacts inside Follow Up Boss."
    - **"How It Works"** button (blue/teal pill button)
- **Filters / search / sort:** "All" and "Unread" tab filters on the message list; "Filter" dropdown button (filter by agent, source, etc. — inferred)
- **Buttons & actions:**
  - All / Unread tabs — toggle message view
  - Filter (dropdown) — filter messages (inferred: by agent, source)
  - How It Works (button) — opens/plays inbox tutorial video (inferred)
  - Play button on video thumbnail — plays embedded video
  - Manage (link at bottom-left of sidebar, partially visible)
- **Statuses / stages / tags / lead score / pills:**
  - My Inbox badge: **(559)** unread/total count
  - Company badge: **(54)**
  - "326 Unread Messages" — aggregate unread count displayed in center header
- **Automation / workflow elements:** None visible on this screen; Inbox itself is the communication aggregation layer for emails and texts.
- **Data-model implications:**
  - Inbox is segmented into: My Inbox (personal) vs Company (shared)
  - Sub-folders: Inbox (all), Assigned, Drafts, Sent, Closed — suggests message-level status field with values: assigned, draft, sent, closed
  - Message count badges on folder nodes (My Inbox: 559, Company: 54)
  - "Unread" concept is separate from folder assignment
- **Notable details / edge cases / counts / numbers:**
  - "Assigned" folder is empty — meaning no messages have been explicitly assigned to this agent
  - 326 Unread Messages shown at top of center column (possibly total across all inbox, not just Assigned)
  - The onboarding card appears because the Assigned view is empty (empty-state experience, not permanent UI)
  - URL path uses `/inbox-new/0/assigned` — the `0` may indicate a filter ID or default view index

---

## screen-026.png

- **Module / area:** Inbox — Sent sub-folder (message list + email detail + right contact rail)
- **Browser tab title / URL path:** Tab title "My Inbox (559) - Follow Up B..."; URL: `ryan-realty.followupboss.com/2/inbox-new/0/sent/[thread-id]` (thread ID partially visible: `/302832`)
- **Purpose:** Displays a sent email from Matt Ryan to "Naidson TaborMartinez" with the email thread detail in center and a right-side contact summary rail.
- **Layout regions:**
  - **Left sidebar** (~220px): inbox folder tree (same structure as screen-025)
  - **Center-left list panel** (~280px): scrollable list of sent message threads, one highlighted/selected
  - **Center-main content** (~500px): open email thread view
  - **Right detail rail** (~250px): contact summary card for the selected contact
- **Global navigation:** People | Inbox (active) | Tasks | Calendar | Deals | Reporting | Admin | Search bar | Avatar/notification cluster
- **Primary content:**
  - **Left sidebar:**
    - My Inbox (559): Inbox, Assigned, Drafts, **Sent** (currently selected/active), Closed
    - Company (54): collapsed
  - **Center-left message list** (Sent folder):
    - Row entries visible (each shows sender name, snippet, timestamp):
      - **Naidson TaborMartinez** — "at/Archived" — [date ~Jun 24]
      - **Brian Gohr** — "[illegible snippet]" — [date]
      - **KungKathlean** (or similar) — "[illegible snippet]"
      - **Susie** — "[illegible snippet]"
      - **Grace Mitchell** — "[illegible snippet]"
      - **Laurie Mullinax** — "[illegible snippet]"
      - **Tiffany Chen** — "[illegible snippet]"
      - **transactiondelightedgentofbec.com** — "[illegible snippet]" — Jun 13
      - **Rachel Starling** — "[illegible snippet]" (partially visible at bottom)
    - Timestamps visible (all appear to be June dates)
    - Currently selected row: **Naidson TaborMartinez** (highlighted in blue/active state)
  - **Center email thread (Naidson TaborMartinez selected):**
    - Thread header: "Naidson TaborMartinez" with "1 | Clear | ..." action controls (top right of thread)
    - Email body displayed:
      - **From:** Matt Ryan — headshot/avatar visible (Matt Ryan's professional headshot)
      - **Signature block:** "Matt Ryan / Owner & Principal Broker — Ryan Realty LLC" + contact details (email, phone — [illegible at this resolution])
      - Body text snippet visible: "...through authentic relationships and exceptional customer service." (signature tagline)
      - **Email action buttons** at bottom of email card: **Reply** | **Reply All** | **Forward**
    - Below the email: shows Ryan Realty logo (blue stacked-chevrons) inline — this appears to be the email signature logo
    - Subject / preview text: [illegible at this zoom level]
    - Date/time stamp: Jun 24 [illegible time]
  - **Right contact detail rail (Naidson TaborMartinez):**
    - Contact name: **Naidson TaborMartinez** (header)
    - Sub-label: "at/Archived" (stage or status — possibly "Archived" stage)
    - Sections visible:
      - **Relationships** (section header with icon)
      - **Details** (section header)
      - Agent: "Matt Ryan" (inferred from label)
      - Lead Plans (label visible)
      - **Recent Conversations** (section header)
        - List of 5+ conversation items (dates/snippets — [illegible at this resolution], all appear as links)
      - **Activity** (section header)
      - **AgentFire FUB Widget** (section header) — third-party integration widget embedded in the rail
- **Filters / search / sort:** "All" | "Unread" filter tabs on left list panel; Filter dropdown button visible
- **Buttons & actions:**
  - Reply | Reply All | Forward — email thread actions
  - "1 | Clear | ..." — thread action controls (mark read, clear, more options — inferred)
  - Contact name in right rail (link to full contact record — inferred)
  - Conversation items in Recent Conversations (clickable to open thread — inferred)
- **Statuses / stages / tags / lead score / pills:**
  - Contact stage/status: "at/Archived" displayed under contact name in right rail (likely "Archived" stage)
  - My Inbox badge: (559); Company: (54)
- **Automation / workflow elements:**
  - **AgentFire FUB Widget** section in right rail — third-party integration from AgentFire (real estate website platform) embedded as a widget showing property/lead data from the AgentFire system
- **Data-model implications:**
  - Thread entity: has sender, recipient, date, body, subject, reply/forward actions
  - Contact entity (right rail): name, stage/status ("Archived"), assigned agent, relationships, lead plans, recent conversations[], activity log, third-party widget data
  - Inbox messages link to contact records (contact lookup by email — inferred)
  - "Relationships" section implies Person may have linked/related Person records
- **Notable details / edge cases / counts / numbers:**
  - Matt Ryan's email signature is embedded in the thread view (headshot + title + company logo)
  - AgentFire FUB Widget is a real third-party integration — suggests FUB supports widget/iframe embeds in the right contact rail
  - Thread shows "1" in header — possibly 1 message in thread / 1 participant
  - The contact is in "Archived" stage — shows archived contacts still appear in Inbox history

---

## screen-027.png

- **Module / area:** Inbox — Closed sub-folder (message list + email/newsletter detail with rich HTML content)
- **Browser tab title / URL path:** Tab title visible: "My Inbox (559) - Follow Up B..." partial; URL: `ryan-realty.followupboss.com/2/inbox-new/0/closed/[thread-id]` (thread ID: `/332880` — partially visible)
- **Purpose:** Shows the Closed inbox folder with a selected inbound marketing email (Guild Mortgage "Mortgage Market Guide weekly" newsletter) displayed in the center email viewer.
- **Layout regions:**
  - **Left sidebar** (~220px): inbox folder tree
  - **Center-left list panel** (~280px): list of closed message threads, one selected
  - **Center-main email viewer** (~500px+): rich HTML email body rendering
  - **Right contact rail** (~250px): contact summary for "Ginny Schriber"
- **Global navigation:** People | Inbox (active) | Tasks | Calendar | Deals | Reporting | Admin | Search | Avatar cluster
- **Primary content:**
  - **Left sidebar:**
    - My Inbox (559): Inbox, Assigned, Drafts, Sent, **Closed** (active/selected)
    - Company (54): collapsed
  - **Center-left thread list (Closed folder):**
    - Selected contact at top: **Ginny Schriber** (name visible, highlighted)
    - Additional thread rows below (names partially visible):
      - **Ginny Schriber** — multiple entries (same contact, multiple threads) — timestamps around Jun [illegible]
      - **Matthew Ryan** — [snippet illegible]
      - **Jeanette Argen** — [illegible]
      - **HM Closmarks** — [illegible]
      - **Jeanette Argen** — [illegible] — Jun 25
      - **Jeanette Argen** — [illegible] — Jun 25
      - **Matthew Ryan** — [illegible] — Jun 26
      - **Ginny Schriber** — [illegible] — Jun 25
      - Several more rows partially visible (names cut off)
    - Filter tabs: All | Unread; Filter button
  - **Center email viewer (selected thread — Ginny Schriber):**
    - Thread header: "Ginny Schriber" + "1 | Clear | ..." action bar (top right of thread)
    - The email displayed is an **inbound marketing email from Guild Mortgage**:
      - **Sender:** Guild (logo visible — blue/teal Guild Mortgage branding)
      - **Subject/heading:** "Mortgage Market Guide — weekly" with subtitle "For the week of June 26, 2026 — Vol. 24, Issue 26"
      - **Content section heading:** "A look into the markets"
      - **Body text (partial):** "Mortgage rates touched their lowest levels since mid-May this week, marking a significant development for borrowers. The question is simple: What changed? Let's look at what's currently driving rates lower and what lies ahead in the coming weeks."
      - **Second content section:** "A case of $70" — with a stock/oil photo (barrels/industrial image) visible
      - **First body paragraph continued:** "One of the biggest stories impacting rates has been the steady decline in oil prices. After fears of supply disruptions pushed oil prices higher this spring, the opposite has happened. Oil has continued to ease and crude oil has fallen back toward the $70 per [barrel mark]..." (text cuts off)
    - The email is a full rich-HTML newsletter with branded header, section dividers, imagery
  - **Right contact rail (Ginny Schriber):**
    - Contact name: **Ginny Schriber** (header)
    - Sub-label: "Lead" or stage label (partially visible — "[illegible]")
    - **Relationships** section (icon + header)
    - **Details** section
    - **Agent** field: "Matt Ryan" (inferred — standard assignment)
    - **Lead Plans** label visible
    - **Recent Conversations** section — list of conversation links (4-5 items, [illegible])
    - **Activity** section header
    - **AgentFire FUB Widget** section header (same third-party widget as other screens)
- **Filters / search / sort:** All / Unread tabs; Filter button
- **Buttons & actions:**
  - Thread action bar: "1 | Clear | ..." (mark read, clear thread, overflow menu)
  - Contact rail links (Recent Conversations, etc.)
  - Reply/Reply All/Forward buttons (inferred — below email body, not visible in current scroll)
- **Statuses / stages / tags / lead score / pills:**
  - Folder: Closed (thread is in Closed state)
  - My Inbox: (559); Company: (54)
  - Contact stage: [illegible] for Ginny Schriber
- **Automation / workflow elements:**
  - AgentFire FUB Widget present in right rail (same integration as screen-026)
  - Closed inbox bucket suggests a workflow action "close thread" exists to move messages from active/sent to Closed
- **Data-model implications:**
  - Thread entity has a status/folder value: Inbox | Assigned | Drafts | Sent | Closed
  - Emails are rendered as full HTML in the viewer (no plain-text stripping)
  - Inbound marketing emails from third parties (Guild Mortgage) appear in the contact's inbox thread — FUB captures all email communication to/from the contact's email address
  - Multiple threads visible with same contact (Ginny Schriber appears multiple times in list) — supports multiple concurrent threads per contact
  - Thread count header "1" visible — thread contains 1 message
- **Notable details / edge cases / counts / numbers:**
  - This is a forwarded/received marketing newsletter (Guild Mortgage "Mortgage Market Guide"), not a direct CRM message — suggests FUB captures ALL inbound email to the broker, including mass-market newsletters from contacts
  - Date on newsletter: "For the week of June 26, 2026 — Vol. 24, Issue 26" — confirms current date context (2026-06-30 session)
  - The rich HTML rendering in the email viewer is a notable technical requirement for the rebuild

---

## screen-028.png

- **Module / area:** Inbox — Company sub-folder / Voicemail / Unassigned phone inbox
- **Browser tab title / URL path:** Tab title: "Company DMs - Follow Up B..." (partially visible); URL: `ryan-realty.followupboss.com/2/inbox-new/[thread-id]/322773`
- **Purpose:** Shows an inbound phone call / voicemail thread from an unknown number in the Company inbox, with an "Add person" panel on the right for creating a new contact record from the unknown caller.
- **Layout regions:**
  - **Left sidebar** (~220px): inbox folder tree
  - **Center-left list panel** (~300px): list of Company inbox threads (phone/voicemail entries)
  - **Center-main thread viewer** (~400px): open voicemail/call thread from "(541) 207-9190"
  - **Right panel** (~220px): "Add person" form / contact creation panel
- **Global navigation:** People | Inbox (active) | Tasks | Calendar | Deals | Reporting | Admin | Search | Avatar cluster
- **Primary content:**
  - **Left sidebar:**
    - My Inbox (559): sub-folders (Inbox, Assigned, Drafts, Sent, Closed)
    - **Company (54):** selected/expanded — shows sub-items:
      - **Company Manager** (visible)
      - Sub-entries listed below (phone numbers or contacts):
        - **(541) 207-5190** — [snippet/timestamp]
        - **(541) 204-3344** — [snippet]
        - **(541) 203-6459** — [snippet]
        - **(541) 203-6744** — [snippet] — Jun 26
        - **(541) 270-7964** — [snippet]
        - **(541) 248-4407** — "Received 1/20/26" (snippet)
        - **(541) 364-5447** — [snippet]
        - **(541) 391-4447** — [snippet]
        - **(541) 410-5791** — "Received 1/20/26" — Jun 26
        - More entries below (cut off)
    - Listed items appear to be phone-number-identified callers without matched contacts
  - **Center thread viewer (selected: "(541) 207-9190"):**
    - Thread header: **(541) 207-9190**
    - Message entries in thread:
      - **Voicemail** bubble (labeled "Voicemail") — with audio player or transcript area
      - **Unknown — Matt Ryan** — label showing the call was routed to Matt Ryan
      - A second entry: **Voicemail** (another voicemail in thread)
      - Timestamp: Jun [date illegible]
    - Call/voicemail metadata visible: phone number, direction (inbound — inferred)
    - Text input bar at bottom: "Write a note or a comment..." placeholder text; **Send** button (blue)
  - **Right "Add person" panel:**
    - Panel title: **"Add person"**
    - Sub-label: "Create Contact / Contact Charge" (or similar — [illegible at this resolution])
    - Fields visible (all appear empty):
      - First name field (text input — empty)
      - Last name field (text input — empty)
      - [Additional fields — illegible]
      - **Submit/Add** button (blue, at bottom of visible form area — inferred)
    - The panel appears to be a quick-create form for adding a new Person record from an unrecognized phone number
- **Filters / search / sort:** Company inbox sub-list shows phone-number entries; no explicit filter controls visible on this screen (Filter tab implied but not clearly visible)
- **Buttons & actions:**
  - "Write a note or a comment..." input + Send button — add internal note to thread
  - "Add person" form fields + submit — create new contact from unknown phone number
  - Each phone number row in sidebar (clickable to open thread — inferred)
- **Statuses / stages / tags / lead score / pills:**
  - Company inbox count: (54) shown in sidebar
  - Thread entries labeled as "Voicemail" — message type indicator
  - Caller identity: "Unknown — Matt Ryan" — shows FUB could not match the number to an existing contact, assigned to Matt Ryan by default
- **Automation / workflow elements:**
  - Inbound calls to the company number are routed to brokers (Matt Ryan in this case) and logged as threads in the Company inbox
  - Voicemail transcription / audio recording captured as thread messages
  - "Add person" flow — converts an anonymous caller into a named contact record (manual step, not automated)
- **Data-model implications:**
  - Thread entity can represent: email, text, voicemail, call — polymorphic communication types
  - When a caller's phone number doesn't match any Person record, the thread appears in Company inbox labeled with the raw phone number
  - The "Add person" panel links phone number → new Person record (first/last name at minimum)
  - Call routing: inbound calls logged with assigned agent (Matt Ryan)
  - Company inbox is a shared bucket (vs My Inbox which is personal to the logged-in user)
- **Notable details / edge cases / counts / numbers:**
  - All 10+ visible entries in Company inbox are identified by phone number only (541 area code = Central Oregon/Bend area) — none matched to named contacts
  - This reveals a gap-detection flow: unmatched inbound callers appear in Company inbox awaiting contact creation
  - "Write a note or a comment..." input in thread view suggests notes/comments can be added to any communication thread (not just contact records)
  - The "(541) 207-9190" number has 2 voicemail messages in its thread

---

## screen-029.png

- **Module / area:** Tasks — Overdue view
- **Browser tab title / URL path:** Tab title: "Overdue Tasks - Follow Up B..."; URL: `ryan-realty.followupboss.com/2/tasks/overdue`
- **Purpose:** Shows all overdue tasks assigned to "Me" (Matt Ryan), grouped by date, with task descriptions, assigned contacts, and timestamps.
- **Layout regions:**
  - **Top nav bar** (global): standard FUB nav
  - **Sub-nav tabs** (below global nav): Today's Tasks | **Overdue (248)** (active) | Future
  - **Main content panel** (full width): scrollable list of overdue tasks grouped by date
  - **Top-right controls**: "How Tasks work" info button | **Filters** dropdown | **Me** dropdown (agent filter)
- **Global navigation:** People | Inbox | **Tasks** (active) | Calendar | Deals | Reporting | Admin | Search | Avatar cluster
- **Primary content:**
  - **Sub-nav tabs:**
    - Today's Tasks
    - **Overdue (248)** — currently active, count badge shows 248 overdue tasks
    - Future
  - **Page header:** "Overdue Tasks" with icon; **"Clear My Overdue Tasks"** action button (top right, red/orange link)
  - **Task list (grouped by date, newest overdue first):**

    **Tuesday, Jun 23 (3)**
    - Task 1: Assigned to **Matthew Ryan** | Type icon: phone/call | Description: "Lead returned to website. Follow up now." | Time: 12:12pm | Assigned to: **Me**
    - Task 2: Assigned to **Matt Ryan** | Type icon: phone/call | Description: "Lead returned to website. Follow up now." | Time: 3:30pm | Assigned to: **Me**
    - Task 3: Assigned to **Matthew Ryan** | Type icon: phone/call | Description: "Lead returned to website. Follow up now." | Time: 8:26pm | Assigned to: **Me**

    **Monday, Jun 22 (1)**
    - Task 1: Assigned to **Matthew Ryan** | Type icon: phone/call | Description: "Lead returned to website. Follow up now." | Time: 6:27am | Assigned to: **Me**

    **Friday, Jun 19 (3)**
    - Task 1: Assigned to **Matthew Ryan** | Type icon: phone/call | Description: "Lead returned to website. Follow up now." | Time: 6:55am | Assigned to: **Me**
    - Task 2: Assigned to **Matthew Ryan** | Type icon: phone/call | Description: "Lead returned to website. Follow up now." | Time: 2:57pm | Assigned to: **Me**
    - Task 3: Assigned to **Matthew Ryan** | Type icon: phone/call | Description: "Lead returned to website. Follow up now." | Time: 6:15pm | Assigned to: **Me**

    **Wednesday, Jun 17 (2)**
    - Task 1: Assigned to **Matthew Ryan** | Type icon: phone/call | Description: "Lead returned to website. Follow up now." | Time: 9:50am | Assigned to: **Me**
    - Task 2: Assigned to **Matt Ryan** | Type icon: phone/call | Description: "Lead returned to website. Follow up now." | Time: 5:20pm | Assigned to: **Me**

    **Monday, Jun 15 (2)**
    - Task 1 (partially visible): Assigned to **Scot/** [cut off at bottom] | Time: 11:22am
    - (Additional tasks cut off below fold)

  - Each task row shows:
    - **Contact avatar** (circular, initials "MR" — Matthew Ryan initials in teal/blue)
    - **Contact name** (link — "Matthew Ryan" or "Matt Ryan") — NOTE: the contact IS "Matthew Ryan" (a lead), not the agent
    - **Task type icon** (phone receiver icon visible on every row — call task)
    - **Task description** — all visible tasks share identical description: "Lead returned to website. Follow up now."
    - **Timestamp** (time of day task was due)
    - **Dash/complete button** (—) at far right (mark as done — inferred)
    - **Assigned to:** "Me" label with person icon
- **Filters / search / sort:**
  - **Filters** dropdown (top right) — filter tasks by type, contact, source, etc. (inferred)
  - **Me** dropdown (top right) — agent filter (showing only tasks assigned to "Me")
  - Date grouping: tasks grouped by calendar date, descending (most recent overdue first)
- **Buttons & actions:**
  - **Clear My Overdue Tasks** — bulk-clear/dismiss all overdue tasks (top of task list, red/orange text link)
  - Each task row **dash (—)** — mark individual task complete (inferred from "—" visible at row right)
  - Today's Tasks / Overdue / Future tabs — navigate task views
  - Filters dropdown — filter task list
  - Me dropdown — switch agent view
  - "How Tasks work" — info/help tooltip or modal
- **Statuses / stages / tags / lead score / pills:**
  - **Overdue (248)** — sub-nav badge showing 248 total overdue tasks
  - Date group counts in parentheses: Jun 23 (3), Jun 22 (1), Jun 19 (3), Jun 17 (2), Jun 15 (2) — partial
  - All visible tasks are phone/call type (phone icon)
  - Task description uniform: "Lead returned to website. Follow up now." — suggests these were auto-generated by a website return trigger / action plan
- **Automation / workflow elements:**
  - All 248 overdue tasks share the same description ("Lead returned to website. Follow up now.") — these were clearly auto-generated by an automation/action plan triggered when a lead (contact named "Matthew Ryan") returned to the website
  - The contact named "Matthew Ryan" is a lead (not the agent) — coincidental name match; multiple tasks tied to this same lead
  - Task creation automation: website revisit event → FUB action plan → auto-creates call task with standard description
  - "Clear My Overdue Tasks" is a bulk action specific to overdue tasks (not just complete — likely dismisses without marking done)
- **Data-model implications:**
  - Task entity fields: contact (linked Person), task_type (call, email, etc.), description (text), due_date, due_time, assigned_agent, status (overdue/pending/done)
  - Tasks grouped by date in UI — due_date is a first-class field
  - Tasks can be auto-created by action plans / automations (not just manually)
  - "Me" agent filter implies tasks have an assigned_agent FK to the agents/users table
  - Sub-nav badge (248) shows count of overdue tasks for the current agent filter
- **Notable details / edge cases / counts / numbers:**
  - **248 total overdue tasks** for Matt (agent filter "Me") — significant backlog
  - All overdue tasks are for a contact named **"Matthew Ryan"** (a lead) who repeatedly returned to the website — suggests an action plan creates a new call task each time a specific lead revisits the site, without de-duplication
  - Two name variants appear ("Matthew Ryan" and "Matt Ryan") — both have teal "MR" avatar — this could be the same contact with slightly different name formatting, or two different contacts with similar names
  - The "Scot/" entry at bottom (Jun 15) represents a different contact — suggests not ALL overdue tasks are for Matthew Ryan
  - "Clear My Overdue Tasks" button in red/danger style implies destructive/bulk action

---

## screen-030.png

- **Module / area:** Deals / Pipeline — Buyers pipeline (Kanban board view)
- **Browser tab title / URL path:** Tab title: "Deal Tracking"; URL: `ryan-realty.followupboss.com/2/deals/1`
- **Purpose:** Shows the Buyers side of the deal pipeline in a Kanban-style board with stages as columns, deal cards in each column, and aggregate totals per stage.
- **Layout regions:**
  - **Global top nav**: standard FUB nav, Deals highlighted
  - **Sub-nav / pipeline toggle** (below global nav): **Buyers** (active, underlined) | **Sellers** | Settings icon (gear)
  - **Top-right controls**: "How Deals work" info | **Deal Reporting** button | **Current deals** dropdown | **Everyone** dropdown (agent filter)
  - **Main content** (full width): horizontal scrolling Kanban board with stage columns
- **Global navigation:** People | Inbox | Tasks | Calendar | **Deals** (active) | Reporting | Admin | Search | Avatar cluster
- **Primary content:**
  - **Pipeline toggle:** Buyers | Sellers | [gear/settings]
  - **Kanban board — Buyers pipeline columns (left to right):**

    **Column 1: Start (temp stage)**
    - Header: "Start (temp stage)"
    - 0 deals, $0
    - No deal cards: "No deals, add deal" placeholder text
    - **+** button (add deal to this stage)

    **Column 2: Buyer Contract**
    - Header: "Buyer Contract"
    - 0 deals, $0
    - "No deals, add deal" placeholder
    - **+** button

    **Column 3: Offer**
    - Header: "Offer"
    - 0 deals, $0
    - "No deals, add deal" placeholder
    - **+** button

    **Column 4: Pending**
    - Header: "Pending"
    - **1 deal, $735,000**
    - Deal card:
      - Address: **19571 SW Simpson Ave**
      - Price: **$735,000** → commission: **$9,187** (shown with arrow/commission icon)
      - "Projected Close Date: March 20th 2026"
      - **2 avatar circles** (agent/contact avatars — 2 people linked to deal)

    **Column 5: Closed**
    - Header: "Closed"
    - **6 deals, $4,515,000 Closed**
    - Deal cards (scrollable — 5+ visible):
      1. Address: **2732 NW Ordway** | Price: **$880,000** → commission **$22,000** | Close Date: June 9th 2025 | 2 avatars
      2. Address: **61271 Kwinnum Dr** | Price: **$750,000** → commission **$16,875** | Close Date: August 27th 2025 | 3 avatars
      3. Address: **703 SW 7th** | Price: **$355,000** → commission **$8,875** | Close Date: September 30th 2025 | 2 avatars
      4. Address: **2680 Nordic Ave** | Price: **$1,350,000** → commission **$33,750** | Close Date: October 10th 2025 | 3 avatars
      5. Address: **3235 NW Cedar** | Price: **$530,000** → commission **$13,250** | Close Date: July 16th 2025 | 3 avatars
      - (Additional cards below visible area)

    **Column 6: Lost**
    - Header: "Lost"
    - **2 deals, $1,925,000**
    - Deal cards:
      1. Address: **2680 Nordic Ave** | Price: **$1,425,000** → **$35,625** commission | Projected Close Date: February 26th 2026 | 2 avatars
      2. Address: **61260 Sunflower Ln** | Price: **$500,000** | Projected Close Date: February 26th 2026 | 2 avatars
    - Partially cut off at right: **"Add a sta[ge]"** button visible (add custom stage to pipeline)

- **Filters / search / sort:**
  - **Current deals** dropdown — filter by deal time period (e.g., all time, current year, etc.)
  - **Everyone** dropdown — filter by agent
  - Buyers / Sellers toggle — switch between pipeline types
- **Buttons & actions:**
  - **+** (plus) button on each column header — add new deal to that stage
  - **Deal cards** — clickable to open deal detail (inferred)
  - **Deal Reporting** button — navigate to deals reporting view
  - **"How Deals work"** — help/info
  - **"Add a sta[ge]"** (partially visible) — add a new pipeline stage column
  - Gear/settings icon — pipeline configuration
- **Statuses / stages / tags / lead score / pills:**
  - **Buyers pipeline stages (left to right):** Start (temp stage) | Buyer Contract | Offer | Pending | Closed | Lost
  - Column aggregate badges:
    - Start: 0 deals, $0
    - Buyer Contract: 0 deals, $0
    - Offer: 0 deals, $0
    - Pending: 1 deal, $735,000
    - Closed: 6 deals, $4,515,000 (labeled "Closed" in green)
    - Lost: 2 deals, $1,925,000
  - Commission values shown on each deal card (→ symbol + dollar amount)
  - Close dates on each card (actual for Closed, projected for Pending/Lost)
- **Automation / workflow elements:**
  - Stage-based pipeline — moving a deal card between columns changes deal stage (drag-and-drop — inferred)
  - Commission auto-calculated from deal price (inferred — consistent percentage visible across cards: ~2.5%)
- **Data-model implications:**
  - Deal entity fields: address (property address), list_price / sale_price, commission_amount, close_date (or projected), stage, pipeline_type (Buyers/Sellers), linked agents/contacts (avatars)
  - Two pipeline types: Buyers and Sellers (separate boards)
  - Stages are customizable (gear icon + "Add a stage" button)
  - Deals can have multiple associated people (2-3 avatars per card — buyer + agent, or buyer + co-buyer + agent)
  - Commission is calculated as a derived field (price × rate — rate appears ~2.5%)
  - Closed total: $4,515,000 GCI context for Buyers in 2025
- **Notable details / edge cases / counts / numbers:**
  - Pipeline URL ends in `/1` — suggests Buyers is pipeline ID 1, Sellers is pipeline ID 2 (confirmed by screen-031 URL `/2`)
  - "Start (temp stage)" label — this is a default/placeholder stage FUB creates; the "(temp stage)" suffix suggests it's a system default that should be renamed by the user
  - 2680 Nordic Ave appears in BOTH Closed ($1,350,000, Oct 2025) AND Lost ($1,425,000, Feb 2026) — likely the same property at different list prices, representing a lost deal and a separate (possibly different) closed transaction, or a re-listed property
  - Closed column shows 6 deals totaling $4,515,000 — sum check: $880K + $750K + $355K + $1,350K + $530K = $3,865K (only 5 cards visible; 6th card is below fold and makes up the difference)
  - Commission values visible: $22,000 / $880K ≈ 2.5%; $16,875 / $750K = 2.25%; $8,875 / $355K ≈ 2.5%; $33,750 / $1,350K = 2.5%; $13,250 / $530K ≈ 2.5% — consistent ~2.5% rate
  - Pending deal projected close was March 20th 2026 — now overdue (current date Jun 30, 2026)

---

## screen-031.png

- **Module / area:** Deals / Pipeline — Sellers pipeline (Kanban board view)
- **Browser tab title / URL path:** Tab title: "Deal Tracking"; URL: `ryan-realty.followupboss.com/2/deals/2`
- **Purpose:** Shows the Sellers side of the deal pipeline in Kanban view, with stages specific to the listing/seller transaction flow.
- **Layout regions:**
  - **Global top nav**: standard FUB nav, Deals highlighted
  - **Sub-nav pipeline toggle**: Buyers | **Sellers** (active, underlined) | gear icon
  - **Top-right controls**: "How Deals work" | **Deal Reporting** | **Current deals** dropdown | **Everyone** dropdown
  - **Main content**: horizontal Kanban board (seller-specific stages)
- **Global navigation:** People | Inbox | Tasks | Calendar | **Deals** (active) | Reporting | Admin | Search | Avatar cluster
- **Primary content:**
  - **Pipeline toggle:** Buyers | **Sellers** | [gear]
  - **Kanban board — Sellers pipeline columns (left to right):**

    **Column 1: Start (temp stage)**
    - 0 deals, $0
    - "No deals, add deal"
    - **+** button

    **Column 2: Pre-Listing**
    - Header: "Pre-Listing"
    - 0 deals, $0
    - "No deals, add deal"
    - **+** button

    **Column 3: Listed**
    - Header: "Listed"
    - **1 deal, $2,935,000**
    - Deal card:
      - Address: **56628 Sunstone Loop**
      - Price: **$2,935,000** → commission: **$10,000** (shown with arrow icon)
      - 3 avatar circles (3 people linked to deal)

    **Column 4: Offer**
    - Header: "Offer"
    - 0 deals, $0
    - "No deals, add deal"
    - **+** button

    **Column 5: Pending**
    - Header: "Pending"
    - 0 deals, $0
    - "No deals, add deal"
    - **+** button

    **Column 6: Closed**
    - Header: "Closed"
    - **9 deals, $7,934,000 Closed**
    - Deal cards (scrollable — 5 visible):
      1. Address: **20401 Penhollow** | Price: **$630,000** → commission **$14,378** | Close Date: June 29th 2025 | 3 avatars (teal, salmon, dark)
      2. Address: **1050 NE Butler Market #2** | Price: **$299,000** → commission **$1,000** | Close Date: June 13th 2025 | 2 avatars
      3. Address: **54474 Huntington Rd** | Price: **$580,000** → commission **$10,200** | Close Date: January 8th 2025 | 3 avatars (teal, salmon/orange, dark)
      4. Address: **534 Crowson Rd** | Price: **$1,050,000** → commission **$10,500** | Close Date: April 30th 2025 | 3 avatars (navy/purple, teal, dark)
      5. Address: **17130 Mayfield Dr** | Price: **$765,000** → commission **$15,100** | Close Date: January 28th 2025 | 3 avatars
      - (More cards below visible area)

    **Column 7: Lost / Terminate[d]**
    - Header: "Lost / Terminate[d]" (partially cut off at right edge)
    - **1 deal, $899,900**
    - Deal card:
      - Address: **363 Sw Bluff Dr #208** (or similar — [illegible precision])
      - Price: **$899,900** → commission **$22,[illegible]**
      - 2 avatars

- **Filters / search / sort:**
  - **Current deals** dropdown (top right)
  - **Everyone** dropdown (agent filter)
  - Buyers / Sellers pipeline toggle
- **Buttons & actions:**
  - **+** per column — add deal
  - Deal cards — clickable to detail view (inferred)
  - Deal Reporting — reporting view
  - How Deals work — help
  - Gear — pipeline settings
- **Statuses / stages / tags / lead score / pills:**
  - **Sellers pipeline stages:** Start (temp stage) | Pre-Listing | Listed | Offer | Pending | Closed | Lost / Terminated
  - Column aggregates:
    - Start: 0 deals, $0
    - Pre-Listing: 0 deals, $0
    - Listed: 1 deal, $2,935,000
    - Offer: 0 deals, $0
    - Pending: 0 deals, $0
    - Closed: 9 deals, $7,934,000 (labeled "Closed" — green text)
    - Lost / Terminated: 1 deal, $899,900
  - Commission values on deal cards (variable rates this time — see Notable details)
- **Automation / workflow elements:**
  - Stage pipeline for seller transactions — Pre-Listing → Listed → Offer → Pending → Closed
  - "Lost / Terminated" stage distinct from "Lost" on Buyers pipeline — sellers pipeline accounts for terminated listings (not just lost deals)
- **Data-model implications:**
  - Sellers pipeline has different stages than Buyers (Pre-Listing, Listed stages vs Buyer Contract)
  - Pipeline stages are pipeline-type-specific (each pipeline has its own stage definitions)
  - Deal cards on Sellers pipeline show same fields as Buyers: address, price, commission, close_date, linked people (avatars)
  - Multiple avatar colors correspond to different brokers (teal = Matt Ryan based on other screens, others = Paul/Rebecca or contacts)
  - Commission amounts on Sellers deals are less consistent in percentage (see Notable details)
- **Notable details / edge cases / counts / numbers:**
  - Sellers Closed: **9 deals totaling $7,934,000** — larger total than Buyers ($4,515,000 / 6 deals)
  - Commission rate analysis on Sellers:
    - 20401 Penhollow: $14,378 / $630,000 ≈ 2.28% — non-standard rate
    - 1050 NE Butler Market #2: $1,000 / $299,000 ≈ 0.33% — very low (flat fee or referral only?)
    - 54474 Huntington Rd: $10,200 / $580,000 ≈ 1.76%
    - 534 Crowson Rd: $10,500 / $1,050,000 = 1.0% — listing-side only?
    - 17130 Mayfield Dr: $15,100 / $765,000 ≈ 1.97%
  - Commission rates vary significantly on Sellers — suggests these are the listing-side (seller-side) commission only, not total transaction commission
  - 56628 Sunstone Loop at $2,935,000 in "Listed" stage — highest active listing in the system; commission shows only $10,000 (very low rate ~0.34% — possibly a referral or reduced-commission arrangement)
  - "Lost / Terminated" stage name uses a slash — may be a combined stage for both buyer-lost and listing-terminated scenarios in the Sellers pipeline
  - URL `/2` confirms Sellers is pipeline ID 2

---

## screen-032.png

- **Module / area:** Reporting — Report index / hub page
- **Browser tab title / URL path:** Tab title: "Reporting - Follow Up B..." (inferred from nav); URL: not fully visible but inferred `ryan-realty.followupboss.com/2/reporting` or similar
- **Purpose:** Displays the Reporting module's main index page with categorized report cards linking to individual report views.
- **Layout regions:**
  - **Global top nav** (standard FUB nav, Reporting active)
  - **Sub-nav tabs** (below global nav): Overview | Agent Activity | Properties | Lead Sources | Calls | Texts | Batch Emails | Marketing | Deals | Appointments | Agent Goals
  - **Main content area**: three grouped sections of report card tiles, each card with icon, title, and description
  - **Top-right**: "How Reporting works" info button
- **Global navigation:** People | Inbox | Tasks | Calendar | Deals | **Reporting** (active) | Admin | Search | Avatar cluster
- **Primary content:**
  - **Sub-nav tabs (full list):**
    - Overview (active / default)
    - Agent Activity
    - Properties
    - Lead Sources
    - Calls
    - Texts
    - Batch Emails
    - Marketing
    - Deals
    - Appointments
    - Agent Goals

  - **Section 1: Agents**
    Report cards:
    1. **Agent Activity** (icon: chart/activity) — "See the number of leads per agent alongside stats on follow up."
    2. **Calls** (icon: phone) — "See calls made, conversations, missed calls, talk time and more by agent."
    3. **Call Logs** (icon: list/log) — "See and listen to recent inbound and outbound calls."
    4. **Texts** (icon: speech bubble) — "See text message delivery rates and other stats by phone number."
    5. **Appointments** (icon: calendar check) — "See a list of appointments & outcomes with details on lead source and agent."
    6. **Deals** (icon: money/dollar) — "See a list of deals with commissions by deal stage and lead source."
    7. **Agent Goals** (icon: target/goal) — "Manage annual commission and personal goals for each agent."

  - **Section 2: Lead Sources**
    Report cards:
    1. **Source Report** (icon: pie/source) — "See your top lead providers and sources of appointments."
    2. **Speed To Lead** (icon: lightning/speed) — "See how quickly you follow up by source and follow up type."
    3. **Contact Attempts** (icon: phone/attempt) — "See how many times you follow up on average by source."
    4. **Closed Deals By Source** (icon: smiley/closed) — "See which lead source has the most closed deals, commission and conversion rate %."

  - **Section 3: Marketing**
    Report cards:
    1. **Batch Emails** (icon: envelope/email) — "See the results of your email campaigns, opens & clicks."
    2. **Properties** (icon: house) — "See which properties and zipcodes have the most inquiries."
    3. **Marketing UTM Report** (icon: target/UTM) — "See advanced UTM and campaign metrics and appointments & deals."

- **Filters / search / sort:** No filters visible on this overview page; individual report pages would have their own filters
- **Buttons & actions:**
  - Each report card is clickable — navigates to that specific report (inferred)
  - Sub-nav tabs — navigate to specific report sections
  - "How Reporting works" — help/info modal or link
- **Statuses / stages / tags / lead score / pills:** None on this index page
- **Automation / workflow elements:** None directly; reports reflect automated data collection from calls, texts, emails, deals, appointments
- **Data-model implications:**
  - Reporting module covers 11 distinct report types across 3 categories (Agents, Lead Sources, Marketing)
  - **Agents section** implies data model tracks: leads per agent, call stats (made/missed/talk time), call recordings (inbound + outbound), text delivery rates, appointments + outcomes, deals + commissions, agent goals (commission targets)
  - **Lead Sources section** implies: source attribution on every contact, speed-to-first-contact measurement, contact attempt count per contact, closed deal → source attribution for conversion rate
  - **Marketing section** implies: batch email campaigns with open/click tracking, property inquiry tracking by address + zipcode, UTM parameter capture on inbound leads with attribution through to appointments + deals
  - "Speed To Lead" report — tracks time from lead creation to first contact attempt, broken down by source and follow-up type
  - "Contact Attempts" report — tracks follow-up frequency/count by source
  - "Closed Deals By Source" — full funnel attribution: lead source → closed deal + commission + conversion rate
  - "Marketing UTM Report" — suggests FUB captures UTM parameters on inbound leads (utm_source, utm_medium, utm_campaign), tracks through to appointments and closed deals
- **Notable details / edge cases / counts / numbers:**
  - **11 sub-nav tabs** — each is a report category (Overview shows all; individual tabs show one category)
  - **13 individual report types** visible across 3 sections
  - "Agent Goals" report — allows setting commission goals per agent, implies a goals table with agent + annual commission target
  - "Properties" report tracks zipcodes — suggests property_zipcode is captured and used as an analytics dimension
  - "Call Logs" is separate from "Calls" — Calls = aggregate stats, Call Logs = individual call records + recordings
  - "Batch Emails" is in the Marketing section (not Agent Emails) — confirms batch/campaign emails are a distinct entity from individual inbox emails
  - No date filter visible at the overview level — individual report pages likely have date range selectors
  - "How Reporting works" button uses same pattern as "How Deals work" and "How Tasks work" seen on other screens — consistent help pattern across FUB modules

---
