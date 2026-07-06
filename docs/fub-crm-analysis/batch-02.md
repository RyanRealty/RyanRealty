# FUB CRM Screenshot Analysis — Batch 02 (screen-009 through screen-016)

---

## screen-009.png

- **Module / area:** Person detail — Activity feed / Email thread view (with FUB phone number upsell banner)
- **Browser tab title / URL path:** Tab title reads "Laurie McAdam - Follow Up…" | URL: `ryan-realty.followupboss.com/2/people/view/217023` (inferred from URL bar context visible in later screens showing the same contact)
- **Purpose:** Displays the full email conversation thread on a contact's detail page, with an interstitial banner prompting the user to set up a FUB phone number; right rail shows action plan status, tasks, and widgets.
- **Layout regions:**
  - **Top global nav bar:** full-width, pinned at top — FUB logo, primary nav items, search, account controls
  - **Left sidebar (contact meta panel):** narrow left column with contact name, contact info fields, labels/tags, and section headers (Details, Financing, Labels, Custom Fields, Background, Social Profile)
  - **Main content area (center):** full email thread chronology with compose controls at top; a blue interstitial "FUB phone number" upsell banner overlaid near the top of the activity feed
  - **Right rail:** tabbed panel showing Action Plans, Activity, Tasks, Appointments, AgentFire FUB Widget, Deals, Automations, Files, Collaborators — with task list visible

- **Global navigation:** People | Inbox | Tasks | Calendar | Deals | Reporting | Admin | Search (magnifier icon) | Notification bell | Account avatar (top-right). Additional browser-bar bookmarks and extensions visible.

- **Primary content:**
  - **Contact header:** "Laurie McAdam" — name displayed in left panel header; "46 days ago" timestamp (recency indicator of last contact or creation)
  - **FUB Phone Number Upsell Banner (interstitial overlay on main feed):**
    - Headline: "Your Follow Up Boss number is warming up!"
    - Body text: "You can make calls from this number now and it will be ready to text soon! Please check back tomorrow. While you wait, try Follow Up Boss texting features."
    - CTA button: "Try our texting" (blue/primary button)
    - The banner is styled as a blue alert box spanning the full width of the activity/feed column
  - **Email thread entries (activity feed, scrolled to show mid-thread):**
    - Entry 1: **Matt Ryan → Laurie McAdam** | sender avatar (Matt) + recipient avatar (Laurie) | timestamp visible (partially [illegible] — "46 days ago" approx.) | label: **"archived"** (gray pill badge) | body includes a hyperlink URL beginning with `archivrd:[https://ryan-realty.followupboss.com/2/...?jwt=eyJhb...` (tracking/JWT link) | text: "Matt Ryan + Laurie McAdam" followed by "Tool Matt Ryan Owner & Principal" (signature fragment)
    - Entry 2: **Matt Ryan → Laurie McAdam** | same sender/recipient avatar pair | timestamp [illegible] | label: **"archived"** (gray pill badge) | another hyperlink URL with JWT token visible | "Tool Matt Ryan Owner & Principal" (signature fragment)
    - Entry 3: **Matt Ryan → Laurie McAdam** | same format | label: **"archived"** (gray pill badge) | hyperlink with JWT | "Tool Matt Ryan Owner & Principal" signature
    - Entry 4 (bottom, partially visible): **Matt Ryan → Laurie McAdam** | "Your home value: 62285 Deer Trail Rd" — visible as the subject/first line of the message body
  - All email entries show: sender avatar (circular, photo), reply/forward icon button, "archived" status pill, clickable tracking URL, and signature line

- **Filters / search / sort:**
  - Top of main feed area: filter/compose controls including icons for Reply, Forward, and possibly filter toggle (partially visible above the upsell banner)
  - No visible search box in the feed itself

- **Buttons & actions:**
  - "Try our texting" — blue CTA button in upsell banner; (inferred) opens texting setup or texting compose UI
  - Each email entry has a **"Reply"** button (gray, small) on the right edge of the entry
  - Each email entry has an archive/action icon
  - Tracking hyperlinks in email bodies are clickable

- **Statuses / stages / tags / lead score / pills:**
  - **"archived"** — gray pill badge on each email entry (indicates email was archived from inbox)
  - Left sidebar tags/labels: not clearly visible in this crop (sidebar is partially cropped)
  - Right rail Tasks section shows task count badge

- **Automation / workflow elements:**
  - Right rail **Action Plans** section header visible (collapsed or with content below fold)
  - Right rail **Tasks** section: shows task list items including "No name of task — call when it to Laurie McAdam 62285 Deer Trail Rd, Bend, OR 97701, USA." (text partially [illegible] due to small size) | task count badge visible
  - Right rail **Automations** section header visible
  - The FUB phone number upsell banner references texting features being activated

- **Data-model implications:**
  - Person entity: `id=217023`, `name="Laurie McAdam"`, `last_contact_days_ago=46`
  - Email entity fields: `from`, `to`, `subject`, `body`, `status=archived`, `tracking_url` (JWT-signed), `sent_at`, `thread_id`
  - Signature template entity linked to agent (Matt Ryan, Owner & Principal)
  - Phone number entity: FUB-provisioned number with "warming up" state (not yet fully active for texting)
  - Task entity: linked to person, contains address reference (62285 Deer Trail Rd)
  - Action Plan entity: linked to person (visible in right rail)

- **Notable details / edge cases / counts / numbers:**
  - The upsell banner references a FUB-provisioned phone number that is in a "warming up" state — implies FUB assigns dedicated local numbers to agents with a delay before SMS is enabled (voice calls available immediately, texting delayed)
  - All visible emails carry "archived" status — no active/unread emails in this thread view
  - Person URL ID: 217023
  - "Person 2 of 9" indicator visible in top-right of right rail header — implies user is navigating through a list/filter result of 9 people

---

## screen-010.png

- **Module / area:** Person detail — Activity feed / Email thread view (scrolled further down, lower portion of email thread)
- **Browser tab title / URL path:** Tab title "Laurie McAdam - Follow Up…" | URL: `ryan-realty.followupboss.com/2/people/view/217023` (same contact, scrolled)
- **Purpose:** Shows the lower portion of the email activity thread for Laurie McAdam, revealing more email entries including a longer reply email body, and the right rail with Action Plans and widget sections.
- **Layout regions:**
  - **Top global nav bar:** same full-width nav (People, Inbox, Tasks, Calendar, Deals, Reporting, Admin)
  - **Left sidebar:** contact meta panel — same contact Laurie McAdam; shows sections: Details, Financing, Labels, Custom Fields, Background, Social Profile. Fields partially visible: LinkedIn, Loans, Notes, Name (first/last), Gender, Age, [illegible small fields]
  - **Main content area (center):** email thread entries, scrolled to show mid-to-lower content; the FUB upsell banner is no longer visible (scrolled past or dismissed); compose/reply controls at top of feed still visible
  - **Right rail:** Action Plans (collapsed), Activity, Tasks (with items), Appointments, AgentFire FUB Widget, Deals, Automations, Web Inquiry Option 01, Files, Collaborators

- **Global navigation:** Same as screen-009 — People | Inbox | Tasks | Calendar | Deals | Reporting | Admin | Search | Bell | Avatar

- **Primary content:**
  - **Email thread entries (continuing from screen-009):**
    - Entry 1 (top of this view): **Matt Ryan → Laurie McAdam** | archived pill | same JWT tracking URL pattern | "Tool Matt Ryan Owner & Principal" signature fragment
    - Entry 2: **Matt Ryan → Laurie McAdam** | archived pill | JWT tracking URL | "Tool Matt Ryan Owner & Principal"
    - Entry 3: **Matt Ryan → Laurie McAdam** | archived pill | JWT tracking URL | "Tool Matt Ryan Owner & Principal"
    - Entry 4 (longer entry, expanded body): **Matt Ryan → Laurie McAdam** | archived pill | body includes:
      - Subject/first line: "Your home value: 62285 Deer Trail Rd"
      - Full message body visible (approx):
        > "Hi Laurie,
        > Thank you for the details on your home. They made a real difference in the analysis. I put together a full comparative market analysis for 62285 Deer Trail Rd and attached it here.
        > The short version: based on recent sales of comparable average homes in your corridor, plus what you shared (the 3 acres of COID irrigation, the horse barn), the very good condition, the 40-year roof, and more, the supported value lands near $1,580,000, with a recommended list around $1,619,000. The report breaks through it step by step, so feel free to take the time.
        > If you have anything you're questioning, and if it helps, I am happy to come see the home in person and walk through it with you. Just let me know a time that works.
        > Best,
        > Matt
        > Ryan Realty, Bend Oregon
        > 541.213.6706 | matt@ryan-realty.com"
      - Body is displayed in expanded form within the feed card
    - Entry 5 (bottom, partially visible): **Matt Ryan + Laurie McAdam** | archived | next thread entry beginning

- **Filters / search / sort:**
  - Feed compose toolbar visible at top: icons for Bold, Italic, Underline, Link, attachment, and other formatting + reply/compose buttons
  - Activity filter tabs visible (partially): "All" selected (inferred), possibly "Emails", "Notes", "Calls" tabs

- **Buttons & actions:**
  - **"Reply"** button on each email entry (gray pill, right side)
  - Email body links (tracking URLs)
  - Right rail: **"Web Inquiry Option 01"** — labeled item with a green dot indicator and badge count (active automation or widget)
  - Right rail: **Automations** section — has an expand arrow
  - Right rail: each section header has a "+" or expand/collapse control

- **Statuses / stages / tags / lead score / pills:**
  - All emails: **"archived"** gray pill
  - Right rail **Automations** section: shows "Automation 1" with a name "[illegible]" and "4 hours ago" or similar timestamp
  - Right rail **Web Inquiry Option 01**: green active indicator + "4 running" or count badge (inferred — the badge shows a number)

- **Automation / workflow elements:**
  - Right rail **Automations** section: shows at least one automation active ("Automation [name]" — [illegible name] — "5 hours ago" or similar) — implies automation was triggered recently for this contact
  - Right rail **Action Plans** section: collapsed header visible
  - The email body references a CMA (Comparative Market Analysis) being attached and sent — manual outreach workflow for seller lead nurture

- **Data-model implications:**
  - Email entity: has `body` field containing full text of CMA delivery email, `from=matt@ryan-realty.com`, `to=Laurie McAdam's email`, `address_referenced="62285 Deer Trail Rd"`, `estimated_value=$1,580,000`, `recommended_list=$1,619,000`
  - Property features referenced: 3 acres COID irrigation, horse barn, 40-year roof, "very good condition"
  - Automation entity: `name=[illegible]`, `status=active`, `last_triggered=~5 hours ago`
  - Web Inquiry widget: named "Option 01", active state, running count

- **Notable details / edge cases / counts / numbers:**
  - CMA values in email body: supported value ~$1,580,000; recommended list ~$1,619,000 (for 62285 Deer Trail Rd, Bend OR 97701)
  - Matt's direct phone in email signature: 541.213.6706
  - Email address: matt@ryan-realty.com
  - "Person 2 of 9" indicator still visible (same navigation context)
  - The email shows Matt's full signature block with title "Owner & Principal Broker – Ryan Realty LLC"

---

## screen-011.png

- **Module / area:** Person detail — Activity feed (scrolled further, showing an archived email + FUB lead-origin notification card + Seller Inquiry activity card)
- **Browser tab title / URL path:** Tab title "Laurie McAdam - Follow Up…" | URL: `ryan-realty.followupboss.com/2/people/view/217023`
- **Purpose:** Reveals the bottom of the email thread and lead origin data — including a "LEAD ORIGIN" system card showing how this contact entered FUB, and a "Seller Inquiry" activity card with property details and automation assignment; also reveals a new right-rail panel including a Dispatch section.
- **Layout regions:**
  - **Top global nav:** same FUB nav bar
  - **Left sidebar:** contact meta fields visible more clearly: Name fields, Gender, Age, Loans, Notes, LinkedIn; social profile icons (LinkedIn icon visible with "Laurie McAdam"); Location: "Bend, OR, United States" visible
  - **Main content area:** activity feed with lower entries
  - **Right rail:** now shows Dispatch | Custom | [other sections] — slightly different right rail crop/scroll from prior screens

- **Global navigation:** People | Inbox | Tasks | Calendar | Deals | Reporting | Admin | Search | Bell | Avatar (top right, showing "Matt" avatar initials or photo)

- **Primary content:**
  - **Email entry (top of this view):**
    - **Matt Ryan → Laurie McAdam** | archived pill | JWT tracking URL | "Tool Matt Ryan Owner & Principal" — same pattern as prior entries
    - Below that: another email entry with archived pill
  - **"LEAD ORIGIN" system card (FUB auto-generated entry):**
    - Label: **"LEAD ORIGIN"** in all-caps gray/muted header
    - Source: **"Seller LP (Home Value)"** — indicates the lead came from a Seller Landing Page (home value offer page)
    - Attribution: **"Source: Seller LP (Home Value)"**
    - Campaign: **"campaigns.concept-mi-mountain.llead-seller_post-si-m5-dolswab"** (or similar — partially [illegible] URL-style campaign slug)
    - Page URL (or campaign URL visible): includes "ryan-realty.com" domain reference
    - Home location: **"62285 Deer Trail Rd, Bend, OR 97701, USA"** — property address entered by lead
    - Plans to sell: **"plans to sell: sell ready to sell now"** or similar (inferred from truncated text visible)
    - Assigned: **"Assigned: multi (default routing to Matt)"** or similar — (partially [illegible])
  - **"Seller Inquiry" activity card:**
    - Label: **"Seller Inquiry"** in section heading
    - Address: **"62285 Deer Trail Rd, Bend OR 97701"**
    - Website: **"ryan-realty.com"** (referral source)
    - Additional detail row: **"Seller LP Submission: Address: 62285 Deer Trail Rd, Bend, OR 97701, USA. Timeline: ready now. Tier: Assigned: matt"** (partially [illegible], reconstructed from visible fragments)
    - Icon: small form/submission icon next to the card

- **Filters / search / sort:** Same feed controls. Left sidebar now shows more field data.

- **Buttons & actions:**
  - Reply buttons on email entries
  - Right rail "Dispatch" section — new header visible with expand arrow
  - Right rail "Custom" section header visible

- **Statuses / stages / tags / lead score / pills:**
  - "archived" pills on email entries
  - Left sidebar visible: **"Loans"** field (blank or value not visible), **"Notes"** field
  - Left sidebar **Location**: "Bend, OR, United States" — populated field
  - Left sidebar **LinkedIn**: shows "Laurie McAdam" link (blue, clickable)

- **Automation / workflow elements:**
  - LEAD ORIGIN card reveals the automation chain trigger: Seller LP form submission → FUB contact creation → assignment to Matt → action plan start
  - Campaign slug in LEAD ORIGIN card reveals the paid campaign/automation tag: "concept-mi-mountain.llead-seller" pattern — implies this came through a Meta/Facebook lead campaign or automated marketing funnel
  - "Timeline: ready now" — seller urgency flag captured from form submission
  - "Assigned: matt" — auto-routing rule fired on lead entry

- **Data-model implications:**
  - Lead source entity: `type="Seller LP (Home Value)"`, `campaign_slug="[illegible]"`, `source_url="ryan-realty.com"`, `address="62285 Deer Trail Rd, Bend OR 97701"`, `timeline="ready now"`, `assigned_to="matt"`
  - Person fields now visible: `location="Bend, OR, United States"`, `linkedin_url=[Laurie McAdam profile]`
  - The "Seller Inquiry" activity type is a distinct FUB activity type separate from email/call/text
  - Assignment routing: `default_routing="matt"` for this lead type

- **Notable details / edge cases / counts / numbers:**
  - This screen reveals the full lead journey: Seller LP form → LEAD ORIGIN card → Seller Inquiry activity → email nurture thread
  - Campaign naming convention visible: lowercase kebab-case with dots and hyphens
  - Right rail now shows different sections than previous screens (Dispatch, Custom) — likely the rail has been scrolled or the right panel has multiple tab views

---

## screen-012.png

- **Module / area:** Person detail — Activity feed (full-width view, showing email thread with right rail Action Plans panel visible; similar to screen-009 but with slightly different scroll position)
- **Browser tab title / URL path:** `ryan-realty.followupboss.com/2/people/view/217023` (Laurie McAdam, same contact)
- **Purpose:** Another view of the Laurie McAdam contact detail showing the email conversation thread with the FUB phone warming banner visible, and the right rail showing the "Action Plans" section expanded with a tooltip "Try Follow Up..." visible — capturing the moment when the user hovers or has clicked the Action Plans area.
- **Layout regions:**
  - **Top global nav bar:** full FUB nav, People highlighted/active
  - **Left sidebar:** same contact meta panel (Laurie McAdam, 46 days ago); Details, Financing, Labels, Custom Fields, Background, Social Profile sections; "Add note" link visible
  - **Main content area:** email thread feed with the FUB phone upsell banner still visible (same as screen-009 — this may be an earlier or different capture than screen-010/011)
  - **Right rail:** Action Plans section now shows expanded content with labeled action plan items; below that: Activity, Tasks (count badge), Appointments, AgentFire FUB Widget, Deals, Automations, Web Inquiry Option 01, Files, Collaborators

- **Global navigation:** People | Inbox | Tasks | Calendar | Deals | Reporting | Admin | Search | Bell | Account button

- **Primary content:**
  - Same email thread entries as screen-009 (Matt Ryan → Laurie McAdam, archived pills, JWT tracking URLs)
  - **FUB Phone Number upsell banner visible** (same as screen-009 — blue interstitial)
  - **Right rail — Action Plans section (EXPANDED):**
    - Header: "Action Plans" with "Person 2 of 9" pagination indicator in right rail top
    - List of action plan step names visible:
      - "1 Move Follow Up" (or similar — partially [illegible])
      - "2 Move Follow Up" 
      - "3 Move Follow Up"
      - "5 Move Follow Up"
      - Other numbered steps (count [illegible])
    - A tooltip or dropdown is visible over the Action Plans section reading: **"Try Follow Up..."** — truncated (inferred: "Try Follow Up Boss" or a step label)
    - The action plan steps appear to be a linear sequence of "Follow Up" tasks numbered 1–5+
  - **Right rail — Tasks section:** badge count visible (likely "2" tasks)
  - **Right rail — Automations section:** "Automation 01" label with timestamp badge

- **Filters / search / sort:**
  - Same feed compose controls
  - Activity filter row visible at top of feed

- **Buttons & actions:**
  - Right rail Action Plans: each step item is clickable (inferred — to mark complete or view details)
  - "Add note" in left sidebar
  - Reply buttons on emails
  - Right rail "+" icons on section headers (inferred — to add new items)

- **Statuses / stages / tags / lead score / pills:**
  - Email entries: "archived" pill
  - Action Plan steps: numbered, implying ordered sequence
  - Automations section: "Automation 01" active

- **Automation / workflow elements:**
  - **Action Plan steps visible** — multi-step follow-up sequence assigned to this contact, steps labeled "Move Follow Up" 1–5+ (likely "1 Move Follow Up Email", "2 Move Follow Up Call", etc.)
  - This is the key automation data: the contact is enrolled in a multi-step action plan that sends follow-up touches on a schedule
  - "Automation 01" in the Automations rail section — a separate automation (distinct from action plan) also running

- **Data-model implications:**
  - Action Plan entity: has ordered steps (step_number, step_name, step_type); steps include "Move Follow Up" pattern (likely email send steps)
  - Person → Action Plans: one-to-many relationship; multiple plans can run on a person
  - Automation entity: separate from Action Plan — named "Automation 01", has `last_run_at` or `triggered_at` timestamp
  - Tasks linked to person: count = ~2 (badge)

- **Notable details / edge cases / counts / numbers:**
  - "Person 2 of 9" — navigation counter in right rail header
  - Action plan steps use numeric prefix naming convention: "1 Move Follow Up", "2 Move Follow Up", etc.
  - The tooltip "Try Follow Up..." appearing over Action Plans section suggests this may be a UI hint/onboarding prompt for new users

---

## screen-013.png

- **Module / area:** Person detail — "Apply Automation" modal dialog
- **Browser tab title / URL path:** `ryan-realty.followupboss.com/2/people/view/217023` (same Laurie McAdam contact, modal overlay)
- **Purpose:** Shows the modal dialog that appears when the user clicks to apply an automation to a contact — lists all available automations by name for selection.
- **Layout regions:**
  - **Background (dimmed):** the person detail page (Laurie McAdam) is visible but dimmed/overlaid behind the modal
  - **Modal overlay (center):** a white dialog box, centered on screen, titled "Apply Automation" with a searchable list of automation names and Cancel/Apply buttons

- **Global navigation:** same underlying nav (dimmed behind modal)

- **Primary content:**
  - **Modal title:** "Apply Automation"
  - **Search field:** text input at top of modal for filtering automations (placeholder text [illegible] — likely "Search automations" or similar)
  - **Automation list** (scrollable, the following names are visible):
    1. **"Stale Lead Engagement"**
    2. **"Buyer Long Term Nurture"**
    3. **"Open House Follow Up"**
    4. **"Open House Lead"**
    5. **"Post Closing Flow"**
    6. **"Unresponsive and active now. Call"** (full name [illegible] — truncated)
    7. **"Birthday Email / Start by Automation"**
    8. **"Assign to a lender"**
  - The list has a scrollbar (more items below fold, inferred)
  - **Buttons at bottom of modal:**
    - **"Cancel"** — gray/secondary button; dismisses modal without applying
    - **"Apply"** — blue/primary button; applies selected automation to contact

- **Filters / search / sort:**
  - Search/filter input at top of automation list — type-to-filter automations by name (inferred)

- **Buttons & actions:**
  - **"Cancel"** — dismiss modal
  - **"Apply"** — apply selected automation (only enabled after selection, inferred)
  - Each automation list item is clickable/selectable (radio selection or checkbox, inferred)

- **Statuses / stages / tags / lead score / pills:**
  - No status pills visible within the modal
  - Automation names imply lifecycle stages: stale lead, long-term nurture, post-closing, open house follow-up, unresponsive active, birthday, lender handoff

- **Automation / workflow elements:**
  - This modal IS the automation system entry point — it reveals the full set of named automations configured in this FUB account:
    1. **Stale Lead Engagement** — re-engagement for cold leads
    2. **Buyer Long Term Nurture** — drip for buyers not immediately ready
    3. **Open House Follow Up** — post-OHV follow-up sequence
    4. **Open House Lead** — for new leads captured at open house
    5. **Post Closing Flow** — post-transaction relationship nurture
    6. **Unresponsive and active now. Call** — [full name partially illegible; implies call-trigger for unresponsive leads who show renewed activity]
    7. **Birthday Email / Start by Automation** — birthday email automation (triggered by contact birthday date field)
    8. **Assign to a lender** — routes/connects contact to a lender partner

- **Data-model implications:**
  - Automation entity: `id`, `name`, `type` (drip / task / email / call), `trigger_conditions`, `status`
  - Person → Automation: many-to-many (a person can have multiple automations applied)
  - The "Apply Automation" action creates a new Person_Automation join record
  - Automation names suggest email/text drip sequences for each lifecycle stage
  - "Birthday Email" automation implies Person entity has a `birthday` date field used as trigger
  - "Assign to a lender" implies a Lender entity or partner routing rule

- **Notable details / edge cases / counts / numbers:**
  - 8 automations visible in the list; likely more below scroll
  - The "Apply" button implies single-selection (apply one automation at a time) vs batch-apply
  - "Unresponsive and active now. Call" — interesting name that encodes both a condition ("unresponsive") and a behavioral trigger ("active now" — likely site visit or email open) and an action type ("Call") — reveals complex conditional logic encoded in automation names
  - "Post Closing Flow" — confirms FUB is used for past-client relationship management beyond transaction close
  - Modal does NOT show automation details (steps, timing, content) — only names; user must know what each automation does

---

## screen-014.png

- **Module / area:** Person detail — Activity feed (lower scroll, email thread with a long expanded reply visible + right rail with Automations and Web Inquiry widget)
- **Browser tab title / URL path:** `ryan-realty.followupboss.com/2/people/view/217023` (Laurie McAdam)
- **Purpose:** Shows a detailed email reply from Matt to Laurie containing the full CMA valuation text, and reveals the right rail "Web Inquiry Option 01" widget section with a green active indicator — providing confirmation of automation and web inquiry widget data.
- **Layout regions:**
  - **Top global nav:** standard FUB nav
  - **Left sidebar:** Laurie McAdam meta panel; sections visible: Details, Financing, Labels, Custom Fields, Background, Social Profile; lower section shows social profile fields (LinkedIn "Laurie McAdam" clickable link); Location: "Bend, OR, United States"
  - **Main content area:** email thread with one long expanded entry
  - **Right rail:** scrolled to show Automations section, Web Inquiry Option 01, Files, Collaborators sections

- **Global navigation:** People | Inbox | Tasks | Calendar | Deals | Reporting | Admin | Search | Bell | Avatar

- **Primary content:**
  - **Email entry (expanded, main focus):**
    - Sender/recipient: **Matt Ryan → Laurie McAdam** | archived pill
    - Full email body (readable in this screenshot):
      > "Hi Laurie,
      > Thank you for the details on your home. They made a real difference in the analysis. I put together a full comparative market analysis for 62285 Deer Trail Rd and attached it here.
      > The short version: based on recent sales of comparable average homes in your corridor, plus what you shared (the 3 acres of COID irrigation, the horse barn, the very good condition, the 40-year roof, and more, the supported value lands near $1,580,000, with a recommended list around $1,619,000. The report breaks through it step by step, so feel free to take the time.
      > If you have anything you're questioning, and if it helps, I am happy to come see the home in person and walk through it with you. Just let me know a time that works.
      > Best,
      > Matt
      > Ryan Realty, Bend Oregon
      > 541.213.6706 | matt@ryan-realty.com"
    - A hyperlink is visible near the bottom of the email entry area — appears to be a "Share this email with Follow Up Boss stuff" or similar internal sharing link [illegible exact text]
  - **Additional email entry (below):** Matt Ryan + Laurie McAdam | archived | [illegible body — very small]
  - **Right rail — Automations section:**
    - Shows: "Automation 01" with a name [illegible] and timestamp "5 hours ago" (approx)
    - Section has expand icon
  - **Right rail — Web Inquiry Option 01:**
    - Green dot active indicator
    - Label: "Web Inquiry Option 01"
    - Badge: "4 running" or count (inferred — a number badge next to the section)
    - This appears to be a third-party FUB widget (AgentFire or similar CRM widget)
  - **Right rail — Files section:** header visible, no files shown or count [illegible]
  - **Right rail — Collaborators section:** header visible, "No collaborators" text (inferred from small text below)

- **Filters / search / sort:** Standard feed toolbar

- **Buttons & actions:**
  - Reply buttons on email entries
  - "Share this email with Follow Up Boss staff" link (inferred from partially visible link text at bottom of email entry)
  - Right rail expand/collapse arrows on section headers

- **Statuses / stages / tags / lead score / pills:**
  - "archived" pills on all visible emails
  - Web Inquiry Option 01: green active dot
  - Left sidebar: Location = "Bend, OR, United States" (confirmed)

- **Automation / workflow elements:**
  - "Automation 01" in right rail — running, last triggered ~5 hours ago
  - "Web Inquiry Option 01" widget active — likely monitoring this contact's website behavior (page views, portal activity)
  - The CMA email was sent manually by Matt (not automated) — represents human touchpoint within automated sequence

- **Data-model implications:**
  - Email entity: `body` contains CMA summary text; `from="matt@ryan-realty.com"`, `value_estimate=$1,580,000`, `recommended_list=$1,619,000`, `property_address="62285 Deer Trail Rd"`, `status=archived`
  - Web Inquiry widget: tracks person's web activity on ryan-realty.com; `status=active`, `sessions_count=4` (inferred from badge)
  - Collaborators: zero on this contact (solo deal)
  - Files: section exists but no attachments visible in FUB (CMA was sent as email attachment, not stored in FUB Files section)

- **Notable details / edge cases / counts / numbers:**
  - CMA values confirmed: $1,580,000 supported value; $1,619,000 recommended list price
  - Property features referenced in email: 3 acres COID irrigation, horse barn, 40-year roof, "very good condition"
  - Matt's phone/email in signature: 541.213.6706 | matt@ryan-realty.com
  - "Share this email with Follow Up Boss staff" link suggests FUB has an internal support/feedback mechanism for flagging emails

---

## screen-015.png

- **Module / area:** Person detail — Email compose view with broker email signature card expanded; activity feed visible below
- **Browser tab title / URL path:** `ryan-realty.followupboss.com/2/people/view/217023` (Laurie McAdam)
- **Purpose:** Shows the email compose/reply area in expanded state with the broker's email signature rendered as a formatted card — including headshot, contact details, and bio; below that the existing email thread is visible; right rail shows Action Plans and Tasks.
- **Layout regions:**
  - **Top global nav:** standard FUB nav
  - **Left sidebar:** Laurie McAdam meta panel, same sections as prior screens
  - **Main content area:** 
    - Top: **email compose toolbar** with formatting icons (Bold, Italic, Underline, alignment, lists, link, image, etc.) — full rich text editor toolbar visible
    - Below toolbar: compose area with signature block rendered
    - Below compose: existing email thread entries
  - **Right rail:** Action Plans section (expanded, showing step list), Activity, Tasks (badge count)

- **Global navigation:** People | Inbox | Tasks | Calendar | Deals | Reporting | Admin | Search | Bell | Avatar; "Send Email" button visible as a top-level action | "Send Text" button also visible as secondary action

- **Primary content:**
  - **Email compose toolbar (rich text editor):**
    - Icons visible (left to right): [Send/back button], Bold (B), Italic (I), Underline (U), text alignment, ordered list, unordered list, link icon, image/attachment icon, emoji, and additional icons [some illegible]
    - Subject field: visible but content [illegible]
    - "To:" field showing Laurie McAdam as recipient (implied)
  - **Email signature card (rendered in compose body):**
    - **Broker headshot:** Matt Ryan photo (circular or rectangular crop, left side of signature card)
    - **Name:** "Matt Ryan"
    - **Title:** "Owner & Principal Broker – Ryan Realty LLC"
    - **Phone:** "541.213.6706"
    - **Email:** "matt@ryan-realty.com"
    - **Website:** "ryan-realty.com" (clickable link)
    - **Bio text:** "Building community through authentic relationships and exceptional customer service" (small text, partially [illegible])
    - **Ryan Realty logo:** blue logo mark visible in the signature card (left side or below name)
    - Below logo: text [illegible — possibly tagline or address]
    - Links: "Book our favorite Greater Central Oregon Real Estate Podcast" and possibly other links below [partially illegible]
    - The signature card has a clean card layout with a divider/border
  - **"Appointments" tab area:** visible below compose, showing "No upcoming appointments" or similar empty state in right rail
  - **Email thread entries below compose area:** same archived email entries continuing down

- **Filters / search / sort:** Compose toolbar serves as text-formatting controls; no filter UI in compose mode

- **Buttons & actions:**
  - **"Send Email"** — primary CTA in top nav area (blue button)
  - **"Send Text"** — secondary action button near "Send Email"
  - **Rich text editor icons:** Bold, Italic, Underline, Link, Attach, Image, Emoji, etc.
  - **Template selector:** (inferred — likely accessible from compose toolbar for inserting email templates)
  - **"Appointments"** tab or button visible in right rail or below compose (in context of scheduling)
  - Right rail: Action Plans items are clickable

- **Statuses / stages / tags / lead score / pills:**
  - Right rail Action Plans: numbered step items ("1 Move Follow Up", etc.)
  - Right rail Tasks: badge count visible

- **Automation / workflow elements:**
  - The compose view with pre-filled signature represents the manual email workflow within FUB
  - Signature is auto-inserted from broker profile settings (Matt Ryan's configured signature)
  - "Send Email" from FUB (vs external client) keeps the email logged in the contact's activity feed automatically

- **Data-model implications:**
  - Email signature entity: `agent_id=matt`, `name="Matt Ryan"`, `title="Owner & Principal Broker – Ryan Realty LLC"`, `phone="541.213.6706"`, `email="matt@ryan-realty.com"`, `website="ryan-realty.com"`, `bio=[text]`, `logo_url=[Ryan Realty logo]`, `headshot_url=[Matt photo]`
  - Rich text email compose entity: `to=person_id`, `subject`, `body` (HTML), `signature_id`, `sent_via="fub_internal"`
  - Broker profile entity fields implied: name, title, phone, email, website, bio, headshot, logo, podcast link

- **Notable details / edge cases / counts / numbers:**
  - The signature includes a podcast link ("Book our favorite Greater Central Oregon Real Estate Podcast") — marketing asset embedded in signature
  - The signature is fully formatted HTML within the FUB compose editor — rich card with photo and branding
  - "Send Email" and "Send Text" are co-located as top-level actions, confirming both channels operate from the contact detail view
  - Ryan Realty logo visible in signature — navy blue mark (matches brand system)
  - "Person 2 of 9" navigation context persists (same list)

---

## screen-016.png

- **Module / area:** Person detail — Email compose view (same as screen-015 but slightly different scroll/state, showing the signature card and compose area; "Continue Sending" banner visible at bottom)
- **Browser tab title / URL path:** `ryan-realty.followupboss.com/2/people/view/217023` (Laurie McAdam)
- **Purpose:** Very similar to screen-015 — email compose with signature card rendered — but reveals a yellow/amber "Continue Sending" notification banner at the bottom of the viewport, suggesting the user was mid-send workflow or FUB is prompting to continue an interrupted send action; also shows the "Send Email" / "Send Text" buttons and rich text toolbar more clearly.
- **Layout regions:**
  - **Top global nav:** standard FUB nav; "Ask Gemini" button visible in top-right (Chrome browser AI integration, not FUB-native)
  - **Left sidebar:** Laurie McAdam meta panel, same as prior screens; "Add note" link visible
  - **Main content area:** email compose area with signature rendered, email thread below
  - **Right rail:** Action Plans with step list visible; Activity, Tasks with count badge
  - **Bottom banner:** amber/yellow "Continue Sending" notification bar at bottom of viewport

- **Global navigation:** People | Inbox | Tasks | Calendar | Deals | Reporting | Admin | Search | Bell | Avatar | (right side: "Ask Gemini" — Chrome browser extension, not FUB)

- **Primary content:**
  - **Email compose area (same as screen-015):**
    - Rich text editor toolbar fully visible: formatting icons (Bold, Italic, Underline, alignment buttons, lists, link, attachment, emoji, and more)
    - Subject line: partially visible (text [illegible])
    - Compose body: same Matt Ryan signature card rendered
  - **Matt Ryan Signature card (same as screen-015, slightly more detail visible):**
    - Headshot: Matt Ryan photo (left side, clearly a person photo)
    - "Matt Ryan" — name in bold
    - "Owner & Principal Broker – Ryan Realty LLC" — title line
    - "541.213.6706" — phone
    - "matt@ryan-realty.com" — email
    - "ryan-realty.com" — website
    - Bio text below (same as screen-015, [illegible small text])
    - Ryan Realty logo mark — visible navy blue logo
    - A hyperlink row below logo (podcast link or similar [illegible])
  - **"Continue Sending" bottom banner:**
    - Color: amber/yellow/orange warning banner style
    - Text: **"Continue Sending"** — visible in bold; additional context text [illegible] (likely: "You have unsent email drafts" or "Continue where you left off" or a rate-limiting / deliverability notice — inferred from banner color and CTA)
    - Appears at the very bottom of the viewport as a fixed notification bar
  - **Email thread entries (below compose):** same archived thread entries as previous screens
  - **Right rail — Action Plans:**
    - Expanded, showing step list:
      - "1 Move Follow Up" — step item
      - "2 Move Follow Up" — step item
      - "3 Move Follow Up" — step item (and more below, partially visible)
    - No specific "completed" vs "pending" indicators clearly visible at this zoom level
  - **Right rail — Tasks:** badge/count visible
  - **Right rail — Activity section:** header visible

- **Filters / search / sort:** Same compose toolbar; no list filters in this view

- **Buttons & actions:**
  - **"Send Email"** — top action button (blue, primary) — visible in top area near contact name
  - **"Send Text"** — adjacent secondary action button
  - **"Continue Sending"** — CTA in the bottom amber banner (clickable — inferred to resume or confirm sending)
  - Rich text editor buttons: Bold, Italic, Underline, alignment, lists, link, attachment, more
  - Right rail: Action Plan step items are clickable
  - Left sidebar: "Add note" link

- **Statuses / stages / tags / lead score / pills:**
  - Bottom banner: amber/warning style (different from the blue FUB phone banner in screen-009)
  - Right rail Action Plans: steps 1–3+ visible (numbered, sequential)
  - No explicit status change indicators in this view

- **Automation / workflow elements:**
  - The "Continue Sending" banner is the most notable workflow element — implies:
    - A batch send or drip sequence was initiated and is in-progress, OR
    - FUB is prompting the user to continue/confirm an email send that was interrupted, OR
    - A rate-limit or deliverability gate is throttling sends and the user must acknowledge
  - Action Plans steps in right rail represent automated/queued follow-up items
  - The fact that both "Send Email" and "Send Text" are visible as top-level CTAs confirms FUB's dual-channel outreach model from a single contact view

- **Data-model implications:**
  - Email send state: has a concept of "in-progress" or "pending confirmation" state — not just draft vs sent
  - Possible batch/drip send entity: `status=in_progress`, `action=continue_sending`, `contact_id=217023`
  - The amber "Continue Sending" banner implies a notification entity or send-queue entity that can be in a "paused, awaiting confirmation" state
  - The compose view (screen-015/016) plus the right rail action plan shows the workflow: compose manual email → (optionally) send → action plan tracks automated follow-ups alongside manual emails

- **Notable details / edge cases / counts / numbers:**
  - "Ask Gemini" button in Chrome browser bar (top-right) — Chrome browser AI sidebar, NOT part of FUB UI; worth noting to avoid confusing it with a FUB feature in the rebuild spec
  - "Continue Sending" amber banner is a distinct, persistent UI element not seen in prior screens — suggests FUB has a send-queue/batch-send confirmation pattern
  - Signature block fully confirmed: name, title, phone, email, website, bio, logo, external link
  - "Person 2 of 9" context preserved across all screens in this batch — same navigation session through a filtered list of 9 people

---

*End of batch-02.md — all 8 screens (009–016) documented.*
