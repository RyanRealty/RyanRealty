# FUB CRM Screenshot Analysis — Batch 01 (screens 001–008)

---

## screen-001.png

- **Module / area:** Person detail — Follow-up / communication thread view (individual contact record, conversation/activity tab active)
- **Browser tab title / URL path:** Tab title: "Laurie McAdam - Follow Up…" | URL: `ryan-realty.followupboss.com/2/people/view/27032/call` (the `/call` segment suggests a call-logging sub-route or the URL is from a post-call state)
- **Purpose:** Display the full communication thread and right-rail action panel for contact Laurie McAdam, showing a sequence of email/text message exchanges between Matt Ryan and Laurie, with the right rail providing quick access to action plans, activity, tasks, appointments, deals, automations, and collaboration.
- **Layout regions:**
  - **Global top nav bar** — full-width, dark/black background, stretches across the very top of the viewport
  - **Left sidebar** — narrow contact-detail left rail; contains contact name, avatar/initials, contact info fields, stage, source, assigned agent, relationships, and an expandable custom-fields section; sits flush left below the top nav
  - **Main content area (center)** — conversation/activity thread; takes up the majority of horizontal space; contains a toolbar row above the thread and the message items themselves
  - **Right detail rail** — fixed-width panel on the far right; contains Action Plans, Activity, Tasks (with count badge), Appointments, AgentFire FUB Widget, Deals, Automations, Web Inquiry Option D1, Files, Collaborators sections
  - **Upsell banner** — centered over the main content area, overlaying the top of the thread; a teal/green promotional banner for "Follow Up Boss number" feature
- **Global navigation:** Top nav visible items (left to right): hamburger/logo icon, **People**, **Inbox**, **Tasks**, **Calendar**, **Deals**, **Reporting**, **Admin** (or Settings gear); right side of nav: search bar (center), notification bell, user avatar/account menu, "Ask Gemini" button (blue, top-right corner)
- **Primary content (conversation thread):**
  - Thread toolbar row: buttons/icons for **All**, **Email** (tab), **Text** (tab), **Call** (tab); compose/reply controls; filter/sort icon
  - **Upsell banner** (overlaying thread top): teal background, text: "Your Follow Up Boss number is warming up! You can make calls from this number once it's all set to be back soon! Please check back tomorrow. While you wait, try out the Follow Up Boss texting experience." — CTA button labeled "Try out texting" (teal/green button)
  - **Message thread items** (3–4 visible, scrollable):
    - **Item 1 (top):** Sender avatar "MR" (Matt Ryan), sender name "Matt Ryan" with "Laura McAdam" shown as recipient context; timestamp not clearly legible; body text contains a URL link (archivd/followupboss tracking URL format: `archivd://app.followupboss.com/...`); a green "archived" pill/badge is visible on this message; Reply count/icon visible
    - **Item 2:** Same sender pattern "Matt Ryan" → "Laura McAdam"; another tracking URL in body; green "archived" badge
    - **Item 3:** Sender "Matt Ryan" with recipient indicator; similar tracking URL structure; "archived" badge visible
    - **Item 4 (bottom, partially visible):** Reply from "Laurie McAdam" (or incoming); text reads: "Hi Laura, Thank you for the details on your home. They made a real difference in the analysis. I put together a full comparative market analysis for $[dollar amount] Dear Trail Rd and attached it here. The short version: based on recent sales of comparable average homes in your corridor, plus what you shared, the 3 acres of COD corridor, the home type, the very good condition, the 30-year roof, and more, the supported value ends near to $[amount], with a" [text truncates — continues below visible area]
  - Thread appears to be email-based (not SMS) given the tracking URL format and message structure
- **Filters / search / sort:** Thread tabs: All | Email | Text | Call (radio-style tabs above thread); a small filter/sort icon visible at the right of the toolbar row
- **Buttons & actions:**
  - "Try out texting" CTA button (teal, in upsell banner)
  - Reply/compose icons on each thread item
  - "All / Email / Text / Call" thread filter tabs
  - Each message has a reply count/expand control and a "…" more-options icon (inferred)
- **Statuses / stages / tags / lead score / pills:**
  - Green "archived" pill/badge visible on at least 2 message items in the thread
  - Left rail: **Stage** field visible (value partially visible — appears to show a stage label)
  - Left rail: **Source** field visible
  - Right rail: **Tasks** section shows a badge count (appears to be "1" or similar numeric indicator)
  - Right rail: **Activity** section shows "About 3 hours ago" or similar relative timestamp for most recent activity
- **Left sidebar detail fields visible:**
  - Contact name: **Laurie McAdam** (large, top of sidebar)
  - Initials avatar: "LM" in a colored circle
  - Phone number(s): partially visible (541-area code likely, [illegible] exact number)
  - Email address: visible but [illegible] at this resolution
  - **Stage:** visible label (value [illegible])
  - **Source:** visible label (value [illegible])
  - **Assigned to:** Matt Ryan (inferred from message sender)
  - **Relationships:** section heading visible, content appears empty or minimal
  - **Details** section (collapsible): visible heading
  - **Custom Fields** section: visible further down sidebar; sub-fields include at minimum: Property Value, Year Built, Bedrooms, Bathrooms — [illegible at this resolution but standard FUB custom field block]
  - **Financing** section heading visible
  - Additional expandable sections visible below scroll
- **Right rail sections (top to bottom):**
  - **Action Plans** — section heading; content area below (appears empty / no active plan shown)
  - **Activity** — section heading; "About 3 hours ago" or similar; most recent activity item listed (text mentions "call" or "email", [illegible])
  - **Tasks (1)** — badge showing count; one task listed (text: "Tell the seller... call — seller I… Laurie McAdam ($289 [or similar])"; due date shown; assignee shown as Matt Ryan)
  - **Appointments** — section heading; "No upcoming appointments"
  - **AgentFire FUB Widget** — third-party widget section; content area visible
  - **Deals** — section heading; appears empty
  - **Automations** — section heading; appears empty
  - **Web Inquiry Option D1** — custom section or widget; content visible but [illegible]
  - **Files** — section heading
  - **Collaborators** — section heading; "No collaborators" or empty
- **Automation / workflow elements:** Right rail "Action Plans" section present (no active plan visible). "Automations" section present (appears inactive). Tasks section shows at least 1 auto-created or manually created task.
- **Data-model implications:**
  - Person entity: `{ id, name (first, last), initials_avatar, phones[], emails[], stage, source, assigned_agent_id, relationships[], custom_fields{}, financing{} }`
  - Communication/thread entity: `{ person_id, type: email|text|call, sender, recipient, body, timestamp, archived: bool, tracking_url }`
  - Right-rail widgets: Action Plans (many-to-one), Tasks (many-to-one), Appointments (many-to-one), Deals (many-to-one), Files (many-to-one), Collaborators (many-to-one), Automations, third-party widget slots
- **Notable details / edge cases / counts / numbers:**
  - The upsell banner for FUB phone number is a prominent UI interruption that overlays the thread — implies this org has not yet activated a FUB-provided phone number
  - The email body references an attached CMA analysis for a property ("Dear Trail Rd") and mentions a dollar-value range — confirms this is an active seller lead with a CMA in progress
  - "Ask Gemini" button in top-right corner of Chrome browser (not FUB UI — this is Google Chrome's built-in AI sidebar button)
  - Person 2 of 5 indicator visible in top-right of right rail (navigation between contacts in a list/smart list)

---

## screen-002.png

- **Module / area:** Person detail — "Merge sending person" modal (overlay on the same Laurie McAdam contact record)
- **Browser tab title / URL path:** Tab title: "Laurie McAdam - Follow Up…" | URL: `ryan-realty.followupboss.com/2/people/view/27032/call` (same as screen-001)
- **Purpose:** Prompt the user to merge a duplicate or related sending-address person record into the current contact as a "relationship," using a type-ahead search modal.
- **Layout regions:**
  - **Underlying page** — same person detail view as screen-001 (dimmed/blurred behind modal)
  - **Modal overlay** — centered dialog box on top of dimmed background; white/light card with rounded corners; close (×) button top-right of modal
- **Global navigation:** Same top nav as screen-001 (dimmed but present): People, Inbox, Tasks, Calendar, Deals, Reporting, Admin; search bar; notification; avatar; "Ask Gemini"
- **Primary content (modal):**
  - **Modal title:** "Merge sending person"
  - **Subtitle / body text:** "Merge person as a relationship" (appears as a descriptor below the title)
  - **Supporting text:** "We matched the email address of this incoming message with an existing person. Would you like to merge [name/email] as a [relationship type] of [current person]?" — [exact wording partially illegible; this is the standard FUB duplicate-merge prompt]
  - **Search / type-ahead field:** A text input near the top of the modal (placeholder text visible: appears to be "First name, last name, phone, email" or similar search prompt); a search/magnify icon inside or adjacent to the field
  - **"Learn more" link:** visible below the descriptive text (inferred — standard FUB pattern for merge modals)
  - **Buttons:**
    - **Cancel** — secondary/outline button, bottom-left of modal
    - **[Confirm/Merge]** — primary blue/navy button, bottom-right of modal (label [illegible] but likely "Merge" or "Save")
- **Filters / search / sort:** The search field within the modal acts as a type-ahead person search to identify the merge target
- **Buttons & actions:**
  - × close button (top-right of modal) — dismisses without merging
  - Search field — type-ahead to find the person to merge as a relationship
  - "Cancel" — dismisses modal
  - "Merge" / primary confirm button — executes merge (inferred label)
  - "Learn more" link — opens FUB help documentation on merging (inferred)
- **Statuses / stages / tags / lead score / pills:** None visible in modal itself; underlying page statuses remain (dimmed)
- **Automation / workflow elements:** None directly visible in modal. The merge action may trigger automation rules (e.g., de-duplicate triggers) — (inferred)
- **Data-model implications:**
  - Merge modal reveals: Person records can be merged into a "relationship" link rather than a hard-delete merge; the system matched an incoming email address to an existing person record; relationship types are supported (e.g., spouse, co-buyer, co-seller)
  - Entities: `Person → Relationship → Person` (bidirectional link, typed)
  - The "sending person" concept implies FUB tracks the email sender identity separately and prompts resolution on first contact match
- **Notable details / edge cases / counts / numbers:**
  - The modal title "Merge sending person" is FUB-specific terminology for resolving an inbound email from a person whose email address matched an existing FUB contact record
  - The modal appears because the current thread view detected the sender matches an existing record — this is FUB's duplicate-resolution UX pattern
  - Person 2 of 5 indicator still visible in top-right (navigation context preserved)
  - Underlying activity thread and right rail are the same as screen-001 but visually obscured by the modal overlay and dimming

---

## screen-003.png

- **Module / area:** Person detail — "Add relationship" modal (overlay on the Laurie McAdam contact record)
- **Browser tab title / URL path:** Tab title: "Laurie McAdam - Follow Up…" | URL: `ryan-realty.followupboss.com/2/people/view/27032/call` (same as screens 001–002)
- **Purpose:** Allow the user to manually add a new related person to the current contact by entering their name, phone, relationship type, and email — creating a linked person entity.
- **Layout regions:**
  - **Underlying page** — same Laurie McAdam person detail (dimmed)
  - **Modal overlay** — centered white card dialog; larger than the merge modal (more fields); close (×) button top-right
- **Global navigation:** Same as screens 001–002 (dimmed behind modal)
- **Primary content (modal form):**
  - **Modal title:** "Add relationship"
  - **Form fields visible:**
    1. **Name row** — two inputs side by side:
       - "First Name" (text input, placeholder "First Name")
       - "Last Name" (text input, placeholder "Last Name")
    2. **Type / Relationship Type** — dropdown or select; label "Type"; placeholder appears to be "Sibling / Spouse / [other]" or similar; value not pre-selected (inferred)
    3. **Phone Number** row — text input labeled "Phone Number"; adjacent "Label" dropdown (e.g., Mobile, Home, Work); "Best Number" checkbox or toggle to the right
    4. **Email** row — text input labeled "Email"; there may be a label dropdown adjacent
    5. **"Add another email"** link — below the email row (expands to add additional email addresses)
  - Appears to be a create-new-person form with relationship context (not a search/merge of an existing person — distinct from screen-002's modal)
  - **Buttons:**
    - **Cancel** — secondary button, bottom-left
    - **Save relationship** — primary blue button, bottom-right (label inferred; may read "Add relationship" or "Save")
- **Filters / search / sort:** No filter controls in modal
- **Buttons & actions:**
  - × close button — dismiss without saving
  - "Add another email" link — expands additional email fields
  - Cancel — dismiss
  - Primary save button — creates the relationship and linked person record
- **Statuses / stages / tags / lead score / pills:** None in modal; relationship type dropdown implies an enumerated set of types (Spouse, Partner, Co-buyer, Sibling, Child, Parent, etc. — inferred from standard FUB relationship types)
- **Automation / workflow elements:** None directly in modal. Adding a relationship may trigger a new-person creation event that could start automation rules on the new record (inferred).
- **Data-model implications:**
  - Relationship entity: `{ from_person_id, to_person_id, relationship_type: enum, label }`
  - Person entity extended: phones have a `label` field (Mobile/Home/Work) and a `best_number: boolean` flag
  - Person entity: `emails[]` is an array (multiple emails supported, "add another" pattern)
  - The modal creates a brand-new Person record with the entered details AND links it to the current Person via a Relationship record — two writes in one action
- **Notable details / edge cases / counts / numbers:**
  - "Best Number" indicator on phone — important data model detail; only one phone can be "best" per person (inferred uniqueness constraint)
  - This modal is distinct from screen-002: screen-002 searched for an existing person to merge as a relationship; screen-003 creates a new person and links them — two separate relationship-management flows
  - Right rail still shows Person 2 of 5 context in background

---

## screen-004.png

- **Module / area:** Person detail — Stage dropdown open (inline stage-change picker on the Laurie McAdam contact record)
- **Browser tab title / URL path:** Tab title: "Laurie McAdam - Follow Up…" | URL: `ryan-realty.followupboss.com/2/people/view/27032/call`
- **Purpose:** Show the inline dropdown allowing the agent to change the contact's pipeline stage directly from the person detail view.
- **Layout regions:**
  - **Left sidebar** — contact detail panel; the stage field in the sidebar has triggered a dropdown that overlays the surrounding content
  - **Dropdown overlay** — appears attached to the Stage field in the left sidebar; floats over the main content area
  - **Main content / right rail** — same as screens 001–003 (conversation thread + right rail visible but partially covered)
- **Global navigation:** Same top nav as prior screens; People, Inbox, Tasks, Calendar, Deals, Reporting, Admin visible
- **Primary content (Stage dropdown):**
  - **Trigger field label:** "Stage" (in left sidebar)
  - **Current stage value:** visible in the sidebar field before clicking (value [illegible] — possibly "Nurture" or similar from prior interaction)
  - **Dropdown options visible (stage list):**
    1. **Nurture**
    2. **[Second option]** — [illegible]
    3. **[Third option]** — [illegible]
    4. **[Fourth option]** — [illegible]
    (The dropdown appears to show 4–6 stage options total; full list [illegible] at this resolution, but the dropdown is clearly multi-option and list-style)
  - The dropdown appears as a white floating panel attached below/beside the Stage field in the left sidebar
- **Filters / search / sort:** No separate filter; the stage dropdown itself is the selection control
- **Buttons & actions:**
  - Clicking a stage option — sets the contact's stage to that value and closes the dropdown (inferred)
  - Clicking outside the dropdown — dismisses without change (inferred)
- **Statuses / stages / tags / lead score / pills:**
  - The stage options in the dropdown represent the pipeline stages available in this FUB account. Visible stage names include at minimum "Nurture" and 3–5 others [illegible]. Standard FUB stages typically include: New, Attempting, Active, Under Contract, Closed, Nurture, Trash — but exact account-specific list [illegible at resolution]
- **Automation / workflow elements:** Changing stage may trigger automation rules tied to stage transitions (e.g., "When stage changes to Under Contract → start Action Plan X") — (inferred FUB behavior)
- **Data-model implications:**
  - Person entity has a `stage` field with an enumerated set of values (account-configurable stages)
  - Stage is a first-class field on the Person record, editable inline from the detail view
  - Stage changes are likely logged to the activity timeline (inferred)
- **Notable details / edge cases / counts / numbers:**
  - The stage dropdown being accessible directly from the contact sidebar (without navigating to a separate pipeline/kanban view) is an important UX detail for rebuild — it is an inline editable field, not a dedicated page action
  - Right rail Tasks section still shows task badge
  - The upsell banner for FUB phone number is still visible in the main thread area (same session state as screen-001)
  - The overall layout confirms the left sidebar fields are inline-editable (not read-only display fields)

---

## screen-005.png

- **Module / area:** Person detail — "Assigned to" / agent assignment dropdown open (Laurie McAdam contact record, left sidebar field interaction)
- **Browser tab title / URL path:** Tab title: "Laurie McAdam - Follow Up…" | URL: `ryan-realty.followupboss.com/2/people/view/27032/call` (same URL throughout this session)
- **Purpose:** Show the inline dropdown for reassigning the contact to a different agent/team member from within the person detail sidebar.
- **Layout regions:**
  - **Left sidebar** — same contact detail panel; the "Assigned to" field has triggered a dropdown
  - **Dropdown overlay** — a floating list panel attached to the "Assigned to" field; overlaps the main content area
  - **Main content + right rail** — same thread + right rail (visible behind dropdown)
- **Global navigation:** Same top nav as all prior screens
- **Primary content (Assigned To dropdown):**
  - **Trigger field label:** "Assigned to" (in left sidebar)
  - **Current value:** "Matt Ryan" (visible in the field before dropdown opened; Matt Ryan is currently assigned)
  - **Dropdown contents — agent list:**
    - Search field at top of dropdown (text input, placeholder likely "Search agents" or "Filter")
    - Agent options visible (list):
      1. **Matt Ryan** (currently selected, likely shown with a checkmark or highlight)
      2. **[Second agent]** — name [illegible] (Rebecca Peterson or Paul Stevenson inferred from known broker roster)
      3. **[Third agent]** — name [illegible]
      (Total agent options: approximately 3, consistent with the three-broker Ryan Realty account)
  - The dropdown may also include a "No agent" / "Unassigned" option at top or bottom of list (inferred FUB pattern)
- **Filters / search / sort:** Search/filter input within the dropdown to narrow agent list
- **Buttons & actions:**
  - Clicking an agent name — reassigns the contact to that agent and closes the dropdown
  - Search field — filters the agent list
  - Clicking outside — dismisses without change (inferred)
- **Statuses / stages / tags / lead score / pills:** No dedicated status pills in dropdown; current assignment (Matt Ryan) distinguishable from alternatives
- **Automation / workflow elements:** Reassigning a contact may trigger round-robin or manual assignment automation rules, and may trigger notifications to the newly assigned agent (inferred FUB behavior). An Action Plan change on reassignment is also possible (inferred).
- **Data-model implications:**
  - Person entity: `assigned_to: agent_id` (foreign key to agents/users table)
  - Agent/User entity: `{ id, name, email, role }` — a small set (3 agents at Ryan Realty)
  - Assignment is inline-editable from person detail view (same pattern as Stage field in screen-004)
- **Notable details / edge cases / counts / numbers:**
  - The small agent list (3 members) is consistent with the Ryan Realty broker count
  - Inline assignment change (no page reload, dropdown interaction) is a key UX pattern to replicate
  - The FUB phone upsell banner remains visible in the main content area, confirming this is the same page session across screens 001–005
  - The left sidebar shows additional fields now visible: "Source", "Relationships" section, "Details" (collapsed), "Custom Fields" (partially expanded), "Financing" section

---

## screen-006.png

- **Module / area:** Person detail — "Recent" / source filter dropdown open in the left sidebar "Source" field area, OR a "Saved searches / smart list" context menu (the left sidebar shows a dropdown with time-based filter options)
- **Browser tab title / URL path:** Tab title: "Laurie McAdam - Follow Up…" | URL: `ryan-realty.followupboss.com/2/people/view/27032/call`
- **Purpose:** Display a time-period filter or "Recent" dropdown (likely attached to the Activity section or a sidebar field) giving the user quick options to filter the activity feed or view by time range; alternatively this is a "Source" field dropdown with date-range context options.
- **Layout regions:**
  - **Left sidebar** — contact detail; a dropdown is open overlaying the lower portion
  - **Dropdown overlay** — a floating white panel with a list of time-range options
  - **Main content + right rail** — visible behind the dropdown; same thread and right rail as prior screens
- **Global navigation:** Same top nav as all prior screens
- **Primary content (dropdown options visible):**
  The dropdown contains time-period filter options. Visible items:
  1. **Recent** (header or currently selected option)
  2. **Last 3 Months**
  3. **Last 6 Months**
  4. **Last 12 Months**
  5. **Last 24 Months** (or "Last 2 Years")
  6. **All Time** (or "All")
  (Exact labels at this resolution: "Recent", "Last 3 Months", "Last 6 Months", "Last 12 Months", "Last 24 Months" — [some labels may be slightly different, partially illegible])
  - This dropdown appears to be attached to either: (a) the Activity section on the right rail to filter the activity timeline by date range, or (b) a price/market data filter on a custom field in the sidebar (the "Market Status" or similar custom field area)
- **Filters / search / sort:** The dropdown itself is the filter control — a date-range picker via preset options (not a calendar picker)
- **Buttons & actions:**
  - Clicking a time-range option — applies that filter to the relevant feed/section
  - Clicking outside — dismisses
- **Statuses / stages / tags / lead score / pills:** None specifically in dropdown; the options represent temporal filter states
- **Automation / workflow elements:** None directly
- **Data-model implications:**
  - Activity/communication timeline supports date-range filtering by preset intervals
  - Or: a custom field (possibly "Market Value Range" or "Net Worth Range") has a time-based qualifier dropdown — the dropdown position in the sidebar suggests it may be attached to a custom field with a time-period qualifier
  - Either pattern implies: Activity entity has a `timestamp` field used for filtering; OR custom fields have a temporal qualifier attribute
- **Notable details / edge cases / counts / numbers:**
  - The presence of a "Recent" preset (separate from "Last 3 Months") implies a short-window default (e.g., last 30 days or last 2 weeks) used as the default view
  - Right rail still shows Tasks badge and Activity section
  - The main thread still shows the FUB phone upsell banner and the same conversation items from screen-001
  - Left sidebar shows additional visible fields: **Net Worth Range**, **Occupation**, **Household Size** (partially visible at bottom of sidebar — these are custom field labels in the sidebar's Custom Fields section)

---

## screen-007.png

- **Module / area:** Person detail — same Laurie McAdam contact record; main view with no overlay/modal (base state, comparable to screen-001 but potentially at a different scroll position or slightly different interaction state)
- **Browser tab title / URL path:** Tab title: "Laurie McAdam - Follow Up…" | URL: `ryan-realty.followupboss.com/2/people/view/27032/call`
- **Purpose:** Display the person detail base state — the contact sidebar, conversation thread, and right action rail — as a reference view without any open dropdown or modal.
- **Layout regions:**
  - **Left sidebar** — contact detail panel; fully visible with no overlapping dropdown; scrolled to show custom fields section
  - **Main content** — conversation thread; FUB phone upsell banner still present
  - **Right detail rail** — all right-rail sections visible
- **Global navigation:** Same top nav: People, Inbox, Tasks, Calendar, Deals, Reporting, Admin; search; avatar; "Ask Gemini"
- **Primary content:**
  - **Left sidebar (comprehensive field list now visible):**
    - Name: **Laurie McAdam**
    - Avatar initials: "LM"
    - Phone: (541) [illegible digits] — likely a cell number
    - Email: [illegible at this resolution]
    - Stage: [value visible, partially illegible — possibly "Nurture" or a custom stage]
    - Source: [value partially visible, possibly "Ryan Realty Website" or a specific source]
    - Assigned to: **Matt Ryan**
    - **Relationships** section: appears empty or shows "No relationships"
    - **Details** section (expandable):
      - Year Built: [visible field label, value [illegible]]
      - Bedrooms: [field label visible]
      - Bathrooms: [field label visible]
      - Property Value: [field label visible]
      - Travel: [field label visible — custom field]
    - **Custom Fields** section:
      - **Environment Provider** — field label visible; value [illegible]
      - **Security Deposit** — field label visible; value [illegible]
      - **Phone Type** — field label visible; value [illegible]
      - **Net Worth Range** — field label visible; value [illegible]
      - **Occupation** — field label visible; value [illegible]
      - **Household Size** — field label visible; value [illegible]
      - **Income Range** — field label visible; value [illegible]
      - **Department** — field label visible; value [illegible]
      - **Has Children** — field label visible; value [illegible] (boolean or dropdown — inferred)
      - **Marital Status** — field label visible; value [illegible]
      - **Birthday** — field label visible; value [illegible] (date field — inferred)
    - **Financing** section: [heading visible; fields below [illegible]]
  - **Conversation thread (main content):**
    - Same 4 message items as screen-001
    - FUB phone upsell banner still present at top of thread
    - Thread filter tabs: All | Email | Text | Call
    - Most recent message (bottom of visible area): Laurie McAdam's email reply, text beginning "Hi Laurie, Thank you for the details on your home…" [same content as screen-001's bottom item]
  - **Right rail (all sections visible):**
    - **Action Plans** — no active plan
    - **Activity** — "About 3 hours ago" (or similar); activity item listed referencing a task/call/note
    - **Tasks (1)** — 1 task badge; task details partially visible
    - **Appointments** — no upcoming appointments
    - **AgentFire FUB Widget** — widget area
    - **Deals** — no deals
    - **Automations** — section present; content [illegible]
    - **Web Inquiry Option D1** — custom section; "# Running automatically" or similar status text visible
    - **Files** — section present
    - **Collaborators** — section present; no collaborators
- **Filters / search / sort:** Thread tabs (All/Email/Text/Call); no other filters active
- **Buttons & actions:**
  - Thread tab filter buttons
  - Reply/compose buttons on each message item
  - Each right-rail section has expand/collapse controls
  - Left sidebar fields are inline-editable (inferred from screens 004–005)
- **Statuses / stages / tags / lead score / pills:**
  - Green "archived" badge on email thread items
  - Right rail Task badge showing "1"
  - "# Running automatically" text in Web Inquiry Option D1 section (implies at least one automation is running)
- **Automation / workflow elements:**
  - Right rail "Web Inquiry Option D1" shows "# Running automatically" — confirms a web inquiry automation/drip is active on this contact
  - "Automations" section in right rail (content present but [illegible])
  - "Action Plans" section present (no active plan currently)
- **Data-model implications:**
  - Full custom field set confirmed on Person entity: Environment Provider, Security Deposit, Phone Type, Net Worth Range, Occupation, Household Size, Income Range, Department, Has Children, Marital Status, Birthday — these are demographics/enrichment fields, suggesting FUB custom field configuration for buyer/seller profiling
  - Details sub-section fields: Year Built, Bedrooms, Bathrooms, Property Value, Travel — these appear to be property/home details custom fields (relevant for seller leads)
  - Financing section implies: Loan type, amount, lender, pre-approval status fields (standard FUB financing block)
  - Web Inquiry automation "Option D1" is a named automation variant — implies multiple web inquiry drip options (D1, D2, etc.) are configured in this account
- **Notable details / edge cases / counts / numbers:**
  - The custom field set is extensive (11+ fields in Custom Fields section alone) — this is a heavily configured FUB instance
  - "Has Children" and "Marital Status" demographic fields indicate buyer/seller persona profiling beyond basic contact info
  - "Birthday" field enables birthday-based automation (e.g., annual birthday outreach drip)
  - The sidebar scroll position in this screen reveals more custom fields than visible in earlier screens (same record, different scroll)

---

## screen-008.png

- **Module / area:** Person detail — "Tasks" or activity/filter dropdown open (a floating dropdown/context menu visible in the main content or sidebar area of the Laurie McAdam record)
- **Browser tab title / URL path:** Tab title: "Laurie McAdam - Follow Up…" | URL: `ryan-realty.followupboss.com/2/people/view/27032/call`
- **Purpose:** Display a dropdown filter or sort control open within the person detail view — specifically appearing to offer a "Select an Option" type dropdown (possibly for a custom field value or for the thread filter), showing a list of selectable values.
- **Layout regions:**
  - **Left sidebar** — contact detail panel
  - **Dropdown overlay** — a floating white panel visible in the left sidebar or straddling sidebar/main content boundary
  - **Main content** — conversation thread (same as prior screens)
  - **Right detail rail** — same right rail
- **Global navigation:** Same top nav as all prior screens
- **Primary content (dropdown):**
  - **Dropdown header / label:** "Select an Option" (visible as the dropdown title or placeholder)
  - **Options visible in dropdown:**
    - The dropdown contains a list of selectable values; at this resolution the individual option labels are [illegible] but the list appears to have 6–10 items
    - Based on context (left sidebar position, prior screens showing Stage and Assigned-to dropdowns), this is likely:
      (a) A custom field dropdown — e.g., "Marital Status" (options: Single, Married, Divorced, Widowed, etc.) or "Phone Type" (options: Mobile, Home, Work, Other) or "Occupation" (enumerated), OR
      (b) A stage or status selection for a different field
    - The "Select an Option" placeholder header strongly implies this is a custom field with a predefined enumerated option set (select/dropdown type custom field)
  - The main thread content is the same (FUB phone upsell banner still visible)
- **Filters / search / sort:** The dropdown itself is the control; no separate search within this dropdown (no search field visible at top — simpler than the agent-assignment dropdown in screen-005)
- **Buttons & actions:**
  - Clicking an option — sets the custom field value and closes dropdown
  - Clicking outside — dismisses without change (inferred)
- **Statuses / stages / tags / lead score / pills:** None in dropdown specifically
- **Automation / workflow elements:** Custom field changes may trigger automation rules if the account has field-change triggers configured (inferred)
- **Data-model implications:**
  - Custom Fields entity: at least some custom fields are of type `select` (single-select from predefined options), not free-text — confirms that the custom field type system supports: text, date, number, select (at minimum)
  - The "Select an Option" placeholder text is likely a generic FUB label for all select-type custom fields when no value is set
  - This confirms the custom fields block in the sidebar contains a mix of field types, including selects with enumerated option sets
- **Notable details / edge cases / counts / numbers:**
  - The "Select an Option" modal/dropdown pattern is the standard FUB UX for select-type custom fields — it appears as an inline floating dropdown attached to the field row in the sidebar
  - Right rail still shows same state (Tasks badge, no Action Plan, Web Inquiry automation running)
  - This is the 8th screen in a sequence all showing the same contact (Laurie McAdam, person ID 27032) — together screens 001–008 provide a comprehensive view of the FUB person detail UX: base state (001), merge modal (002), add-relationship modal (003), stage dropdown (004), assigned-to dropdown (005), time-filter dropdown (006), base state with sidebar fully visible (007), select custom field dropdown (008)
  - Person 2 of 5 navigation context maintained throughout all 8 screens
  - The `/call` URL path suffix persists across all 8 screens despite no active call UI being visible — this may be a lingering route state from a previous call initiation, or it routes to the communication thread with call logging active

---

*End of batch-01.md — 8 screens covered.*
