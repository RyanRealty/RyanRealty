# FUB Screen Analysis — Batch 06 (screens 041–048)

---

## screen-041.png

- **Module / area:** Admin / Settings — Company Settings (Phone & Office Hours sub-section)
- **Browser tab title / URL path:** "Company Settings - Follow U..." | `ryan-realty.followupboss.com/2/company-settings`
- **Purpose:** Configure company-level phone calling options, legal disclosure, office hours, subdomain, business insights goals, block list, and weekly report recipients.
- **Layout regions:**
  - Global top nav bar (browser bookmarks bar visible above FUB chrome)
  - FUB top navigation rail — People, Inbox, Tasks, Calendar, Deals, Reporting, Admin (active)
  - Admin sub-navigation tab bar — Overview, Lead Flow, Groups, Team, Action Plans, Automations, Ponds, Email Templates, Text Templates, Import, Custom Fields, Stages, Phone Numbers, Tags, Integrations, Company, API, More (visible, partially clipped)
  - Main content area — a scrollable settings form, centered, ~630px wide card, white background
  - Bottom-right Save button
  - Bottom-right corner help bubble (?)
- **Global navigation:**
  - People | Inbox | Tasks | Calendar | Deals | Reporting | Admin (active)
  - Top-right: avatar group (multiple broker avatars), notification bell, settings-like icons
  - Search bar in top nav
- **Primary content (form fields visible):**

  **PHONE section (section header implied, fields grouped)**
  - **Phone** — label with info (?) tooltip; value area blank/empty; link "Manage Settings" (blue)
  - **Fallback number** — label with (?) tooltip; value: `(541) 213-6706`
  - **Spam label calling protection** — label with (?) tooltip; value: `Ryan Realty LLC` with `[Change]` link (blue, parenthetical)
  - **Call Recording** — label with (?) tooltip; toggle switch: ON (green/teal) — label text: "Enable call recording for team members"
  - **Legal Disclosure** — label with (?) tooltip; toggle switch: OFF (gray) — label text: "Automatically play call recording disclosure for all calls"
    - Below toggle: button/link "▶ Preview call disclosure" (play icon + text)
    - Expanded informational callout box (light gray background, titled **"Legal Requirements for call disclosure"**):
      > "In some states and jurisdictions it is legally required to obtain the consent of all parties involved in a conversation before a recording is made. Consent may be obtained by notifying all parties at the beginning of the call that it will be recorded. When this feature is disabled, the notification that the call is being recorded will not be played automatically at the beginning of a call."

  **OFFICE HOURS section header**
  - **"Specify the days and times your team can receive incoming calls to your team inboxes"** — descriptive label (left column)
  - Action link: `+ Add office hours` (blue, right side)

  **SUBDOMAIN section header**
  - **"Change the subdomain of your account"** — descriptive label
  - Value: `ryan-realty.followupboss.com` with `[Change]` link (blue, parenthetical)

  **BUSINESS INSIGHTS section header**
  - **Production Goals 2026** — value: `$1,000,000` (blue link, presumably editable)
  - **Weekly Report Recipients** — label with (?) tooltip; action link: `+ Add Email` (blue)

  **BLOCK LIST section header**
  - **"Set which emails and phone numbers you want to block"** — descriptive label
  - Action link: `Manage block list settings` (blue)

- **Buttons & actions:**
  - `Manage Settings` — navigates to phone settings
  - `[Change]` on Spam label calling protection — opens change dialog (inferred)
  - Call Recording toggle — enables/disables call recording
  - Legal Disclosure toggle — enables/disables auto-disclosure playback
  - `▶ Preview call disclosure` — plays audio preview of disclosure message (inferred)
  - `+ Add office hours` — adds an office hours schedule entry (inferred)
  - `[Change]` on subdomain — opens subdomain change dialog (inferred)
  - Production Goals `$1,000,000` — opens edit for annual production goal
  - `+ Add Email` — adds a weekly report email recipient
  - `Manage block list settings` — navigates to block list management page
  - `Save` button (bottom-right, blue) — saves all changes on this settings page
- **Statuses / stages / tags / lead score / pills:**
  - Call Recording toggle: ON (green)
  - Legal Disclosure toggle: OFF (gray)
- **Automation / workflow elements:**
  - Call recording is a team-wide automation setting (all team members)
  - Legal disclosure auto-play is a compliance automation (off)
  - Office hours control when inbound calls route to team inboxes
  - Lead Processing (not visible in this scroll but present in screen-042) monitors email inbox for new leads
- **Data-model implications:**
  - Company/Account entity has fields: `phone`, `fallback_number`, `spam_label_calling_protection_name`, `call_recording_enabled` (bool), `legal_disclosure_enabled` (bool), `subdomain`, `production_goal_annual` (currency), `weekly_report_recipients[]` (emails), block list (emails[], phone_numbers[])
  - Office hours linked to account: `office_hours[]` with days + time ranges
- **Notable details / edge cases / counts / numbers:**
  - Fallback number: `(541) 213-6706` — Ryan Realty's direct line
  - Spam calling protection entity name shown: `Ryan Realty LLC`
  - Production Goals set for 2026: `$1,000,000`
  - Page scrolled partway — top sections (company name, address, etc.) are above the visible fold
  - The legal disclosure callout is a static explanatory box, not a dialog
  - `Save` button is always visible at bottom-right of the card (inferred sticky footer)

---

## screen-042.png

- **Module / area:** Admin / Settings — API Settings (full view, upper portion)
- **Browser tab title / URL path:** "API Key - Follow Up Boss" | `ryan-realty.followupboss.com/2/api`
- **Purpose:** Manage API keys for third-party integrations, view connected OAuth applications, configure lead email processing, and monitor API usage.
- **Layout regions:**
  - Global browser chrome (tab, address bar, bookmarks bar)
  - FUB top nav rail — People, Inbox (with red badge "1"), Tasks, Calendar, Deals, Reporting, Admin (active)
  - Admin sub-nav tabs — Overview, Lead Flow, Groups, Team, Action Plans, Automations, Ponds, Email Templates, Text Templates, Import, Custom Fields, Stages, Phone Numbers, Tags, Integrations, Company, API (active), More
  - Top-right: avatar group (4 broker avatars), notification icons
  - Main content area — "API Settings" heading, multiple sections in a white card
  - Bottom-right help bubble (?)
- **Global navigation:**
  - People | Inbox | Tasks | Calendar | Deals | Reporting | Admin (active, highlighted)
  - Search bar (top-center)
  - Right side: broker avatar cluster, notification bell, other icon controls
- **Primary content:**

  **API Settings heading** with "🔑 API Settings" header

  **API Keys section:**
  - Header: "API Keys" — Instruction text: "To connect a new integration, create a new API key →"
  - Button: `Create API Key` (blue, top-right of section)
  - Table columns: **Name** | **API Key** | **Created** | **Last Used** | **Actions**
  - Sort indicator (↑) on Created column
  - Rows:
    | Name | API Key | Created | Last Used | Actions |
    |------|---------|---------|-----------|---------|
    | Agent Fire | `••••••••••v7lp` | a year ago | a month ago | edit (pencil) + delete (trash) |
    | Zapier | `••••••••••HJF6` | 7 months ago | a month ago | edit + delete |
    | RyanRealtyApp | `••••••••••T1t1` | 4 months ago | 10 hours ago | edit + delete |
    | CLAUDE COWORK | `••••••••••5dAb` | 3 months ago | 3 months ago | edit + delete |
    | Ryan Realty LP - Vercel | `••••••••••p1sH` | 2 months ago | 2 months ago | edit + delete |
  - 5 API keys total shown
  - API keys are masked with bullet characters, showing last 4 characters only

  **Connected OAuth Applications section:**
  - Table columns: **Name** | **Consented** | **Actions**
  - Body: "No OAuth applications have been connected yet."

  **Lead Email Address section:**
  - Label: "Lead Email Address"
  - Value: `ryan.realty@followupboss.me`
  - Button: `Copy` (blue link, inline)
  - Sub-link: "View all 2 team members" (blue)
  - Explanatory text: "If you are using a non-Google account you can have your lead notifications sent to your unique @followupboss.me email address listed above. Learn More"

  **Lead Processing section:**
  - Label: "Lead Processing"
  - Value: `matt@ryan-realty.com (google)` — toggle switch: ON (green/teal)
  - Explanatory text: "We will monitor your email inbox for new lead notifications and put them in Follow Up Boss automatically."

  **API Usage Last 30 Days (all users) section:**
  - Table columns: **System** | **API Calls** (with sort ↓ indicator)
  - Rows visible:
    | System | API Calls |
    |--------|-----------|
    | ryanrealty-web | 62036 |
    | Ryan Realty Platform | 1979 (partially visible, confirmed in screen-043) |

- **Filters / search / sort:**
  - Created column has sort indicator (↑ ascending)
  - API Usage sort indicator (↓ descending by API Calls, inferred)
- **Buttons & actions:**
  - `Create API Key` — opens modal/form to create a new named API key
  - Pencil icon (per row) — edit API key name (inferred)
  - Trash icon (per row) — delete/revoke API key (inferred)
  - `Copy` — copies lead email address to clipboard
  - "View all 2 team members" — expands or navigates to team member list
  - "Learn More" — external link or in-app help for non-Google email processing
  - Lead Processing toggle — enable/disable automatic lead inbox monitoring
- **Statuses / stages / tags / lead score / pills:**
  - Lead Processing toggle: ON (green)
  - No OAuth apps connected
- **Automation / workflow elements:**
  - Lead Processing is an automation: FUB monitors `matt@ryan-realty.com` Google inbox for lead email notifications and auto-ingests them into FUB — this is the Zapier/email-parse style lead routing
  - The `@followupboss.me` email address is an alternative lead routing mechanism for non-Google accounts
- **Data-model implications:**
  - APIKey entity: `id`, `name`, `key_masked` (last 4 shown), `created_at`, `last_used_at`, `revoked` (bool)
  - OAuthApp entity: `name`, `consented_at`, `actions[]`
  - Account: `lead_email_forwarding_address` (followupboss.me), `lead_processing_email`, `lead_processing_provider` (google), `lead_processing_enabled` (bool)
  - APIUsage: `system_name`, `call_count`, `period` (30 days)
  - Team members: 2 (link "View all 2 team members")
- **Notable details / edge cases / counts / numbers:**
  - 5 API keys active: Agent Fire (1y old), Zapier (7mo), RyanRealtyApp (4mo, used 10h ago — most recent), CLAUDE COWORK (3mo), Ryan Realty LP - Vercel (2mo)
  - RyanRealtyApp used 10 hours ago — most recently active key
  - No OAuth apps connected — OAuth section is empty
  - Lead email: `ryan.realty@followupboss.me`
  - Lead processing via Google/Gmail (matt@ryan-realty.com)
  - API usage: ryanrealty-web dominates with 62,036 calls in 30 days

---

## screen-043.png

- **Module / area:** Admin / Settings — API Settings (scrolled down, showing full API usage table)
- **Browser tab title / URL path:** "API Key - Follow Up Boss" | `ryan-realty.followupboss.com/2/api`
- **Purpose:** Same API settings page as screen-042, scrolled to reveal the complete API usage breakdown and lower portion of the page.
- **Layout regions:**
  - Global browser chrome
  - FUB nav not visible (scrolled below fixed nav, or nav hidden in this scroll state — no top nav visible)
  - Main content only — the card/panel content continuing from screen-042
  - Bottom-right help bubble (?)
- **Global navigation:** Not visible in this scroll state (scrolled past fixed nav, or this portion of the page is below the nav bar's coverage)
- **Primary content (continuation from screen-042):**

  **API Keys section (top of visible area):**
  - "To connect a new integration, create a new API key →" instruction
  - `Create API Key` button (blue, top-right)
  - Table columns: **Name** | **API Key** | **Created** | **Last Used** | **Actions**
  - Rows (same as screen-042, now full view):
    | Name | API Key | Created | Last Used | Actions |
    |------|---------|---------|-----------|---------|
    | Agent Fire | `••••••••••v7lp` | a year ago | a month ago | ✎ 🗑 |
    | Zapier | `••••••••••HJF6` | 7 months ago | a month ago | ✎ 🗑 |
    | RyanRealtyApp | `••••••••••T1t1` | 4 months ago | 10 hours ago | ✎ 🗑 |
    | CLAUDE COWORK | `••••••••••5dAb` | 3 months ago | 3 months ago | ✎ 🗑 |
    | Ryan Realty LP - Vercel | `••••••••••p1sH` | 2 months ago | 2 months ago | ✎ 🗑 |

  **Connected OAuth Applications section:**
  - Columns: **Name** | **Consented** | **Actions**
  - Empty state: "No OAuth applications have been connected yet."

  **Lead Email Address section:**
  - `ryan.realty@followupboss.me` + `Copy` button
  - "View all 2 team members" link
  - Non-Google account explanation text

  **Lead Processing section:**
  - `matt@ryan-realty.com (google)` + toggle ON (green)
  - Monitoring text

  **API Usage Last 30 Days (all users) — FULL TABLE now visible:**
  - Columns: **System** | **API Calls** (↓ sort)
  - Complete rows:
    | System | API Calls |
    |--------|-----------|
    | ryanrealty-web | 62036 |
    | Ryan Realty Platform | 1979 |
    | ryan realty website | 218 |
    | ryanrealty | 15 |
  - 4 systems total
  - Total not summed on screen, but: 62036 + 1979 + 218 + 15 = 64,248 API calls in 30 days

- **Filters / search / sort:** Same as screen-042; API Calls column sorted descending (ryanrealty-web highest)
- **Buttons & actions:** Same as screen-042; no new buttons visible in this scroll region
- **Statuses / stages / tags / lead score / pills:** Same as screen-042
- **Automation / workflow elements:** Same as screen-042
- **Data-model implications:**
  - Confirms 4 distinct "system" identities making API calls: `ryanrealty-web`, `Ryan Realty Platform`, `ryan realty website`, `ryanrealty` — likely different API key name groups
  - The table does not have pagination, implying all systems fit on one page
- **Notable details / edge cases / counts / numbers:**
  - `ryanrealty-web`: 62,036 calls — primary API consumer (the live website)
  - `Ryan Realty Platform`: 1,979 calls
  - `ryan realty website`: 218 calls
  - `ryanrealty`: 15 calls
  - Combined total: ~64,248 API calls over 30 days
  - The "ryanrealty" entry with only 15 calls may be a legacy or test key
  - This screen is a zoomed/scrolled continuation of screen-042, confirming the same URL

---

## screen-044.png

- **Module / area:** Admin / Settings — Custom Fields (management view)
- **Browser tab title / URL path:** "Manage Custom Fields - Foll..." | `ryan-realty.followupboss.com/2/custom-fields`
- **Purpose:** View, manage, reorder, and configure all custom contact fields defined for the FUB account.
- **Layout regions:**
  - Global browser chrome (tab, address bar, bookmarks)
  - FUB top navigation rail — People, Inbox, Tasks, Calendar, Deals, Reporting, Admin (active)
  - Admin sub-nav tabs — Overview, Lead Flow, Groups, Team, Action Plans, Automations, Ponds, Email Templates, Text Templates, Import, Custom Fields (active), Stages, Phone Numbers, Tags, Integrations, Company, API, More
  - Info link: "❓ How Custom Fields work" (top-right of content, blue)
  - Main content area — heading + full-width table listing custom fields
  - Bottom-right help bubble (?)
- **Global navigation:**
  - People | Inbox | Tasks | Calendar | Deals | Reporting | Admin (active)
  - Search bar (top-center)
  - Right: broker avatar cluster (4 avatars), notification icons
- **Primary content:**

  **Heading:** "64 Custom Fields" (with count)
  **Button:** `Add Custom Field` (blue, top-right)

  **Table columns:** **Field Name** | **Type** | **People** | **Hide if empty** (?) | **Read-only** (?) | **Action**

  **Rows visible (scroll position shows fields from approximately the middle of the list; drag handle icon ⋮⋮ on left of each row for reordering):**

  | # | Field Name | Type | People | Hide if empty | Read-only | Action |
  |---|-----------|------|--------|---------------|-----------|--------|
  | — | Recently Divorced | Text | 0 | — | — | ✎ 🗑 |
  | — | Recently Moved | Text | 0 | — | — | ✎ 🗑 |
  | — | Enrichment Provider | Text | 5851 | — | — | ✎ 🗑 |
  | — | Phone Type | Text | 4843 | — | — | ✎ 🗑 |
  | — | Net Worth Range | Text | 0 | — | — | ✎ 🗑 |
  | — | Income Range | Text | 0 | — | — | ✎ 🗑 |
  | — | Occupation | Text | 0 | — | — | ✎ 🗑 |
  | — | Has Children | Text | 0 | — | — | ✎ 🗑 |
  | — | Household Size | Number | 0 | — | — | ✎ 🗑 |
  | — | Marital Status | Text | 0 | — | — | ✎ 🗑 |
  | — | Gender | Text | 0 | — | — | ✎ 🗑 |
  | — | Birthday | Date | 0 | — | — | ✎ 🗑 |
  | — | Owner Age Range | Text | 0 | — | — | ✎ 🗑 |
  | — | Owner Age | Number | 0 | — | — | ✎ 🗑 |
  | — | Include in FB CAS | Text | 7255 | — | — | ✎ 🗑 |
  | — | Realtor License Type | Text | 163 | — | — | ✎ 🗑 |
  | — | Realtor License | Text | 163 | — | — | ✎ 🗑 |
  | — | Brokerage | Text | 163 | — | — | ✎ 🗑 |
  | — | [partially cut off row below fold] | — | — | — | — | — |

  - Visible types: Text, Number, Date
  - "People" column shows count of contacts with this field populated
  - "Hide if empty" — checkbox column (all visible rows show unchecked/dash)
  - "Read-only" — checkbox column (all visible rows show unchecked/dash)
  - Drag handle (⋮⋮ dots) on left side of each row — for drag-to-reorder

- **Filters / search / sort:**
  - No visible search/filter on this page
  - No sort indicators on columns
  - Fields appear in a fixed custom order (reorderable via drag handle)
- **Buttons & actions:**
  - `Add Custom Field` (blue, top-right) — opens modal/form to create a new custom field
  - Pencil icon (per row) — edit field name/type/settings
  - Trash icon (per row) — delete custom field (likely with confirmation)
  - Drag handle (⋮⋮) — drag-to-reorder fields in the list
  - "❓ How Custom Fields work" — opens help article or tooltip
- **Statuses / stages / tags / lead score / pills:**
  - No statuses per se; "People" count acts as a utilization metric
  - High-usage fields: Include in FB CAS (7255), Enrichment Provider (5851), Phone Type (4843)
  - Broker-relevant fields: Realtor License Type (163), Realtor License (163), Brokerage (163)
- **Automation / workflow elements:**
  - Custom fields feed into: smart lists, action plan conditions, lead routing rules, tags, FUB automations
  - "Include in FB CAS" (7255 people) — "FB CAS" likely means Facebook Custom Audience Sync; this field controls which contacts sync to Meta/Facebook custom audiences
- **Data-model implications:**
  - CustomField entity: `id`, `name`, `type` (Text | Number | Date | [others not visible]), `people_count`, `hide_if_empty` (bool), `read_only` (bool), `sort_order` (int, drag-reorderable)
  - Total: 64 custom fields defined on this account
  - Field types confirmed visible: Text, Number, Date
  - People are associated with custom field values (count shown)
  - Enrichment fields (Enrichment Provider, Phone Type, Net Worth Range, Income Range, Occupation, Has Children, Household Size, Marital Status, Gender, Birthday, Owner Age Range, Owner Age) suggest 3rd-party data enrichment is configured
  - Recently Divorced, Recently Moved — likely life-event triggers for prospecting
  - Realtor License Type, Realtor License, Brokerage — B2B/agent-tracking fields (163 people = agents in the system)
- **Notable details / edge cases / counts / numbers:**
  - 64 total custom fields (account-level count shown in heading)
  - "Include in FB CAS" = 7,255 people — largest populated field; suggests Meta Custom Audience integration for 7,255 contacts
  - "Enrichment Provider" = 5,851 — large batch enrichment has been run
  - "Phone Type" = 4,843 — enriched phone type data for ~4,843 contacts
  - Most demographic enrichment fields (Net Worth Range, Income Range, etc.) = 0 people — fields created but not yet populated
  - "Realtor License Type/License/Brokerage" all at 163 — consistent count suggesting 163 realtor contacts are tracked
  - Page is scrolled; top fields in the list (fields 1 through ~15) are not visible

---

## screen-045.png

- **Module / area:** Admin / Settings — Text Templates (list view)
- **Browser tab title / URL path:** "Text Template Folders - Fol..." | `ryan-realty.followupboss.com/2/text-templates/py/templates`
- **Purpose:** Browse, search, and manage all SMS/text message templates organized in folders for use in conversations and action plans.
- **Layout regions:**
  - Global browser chrome
  - FUB top navigation rail — People, Inbox, Tasks, Calendar, Deals, Reporting, Admin (active)
  - Admin sub-nav tabs — Overview, Lead Flow, Groups, Team, Action Plans, Automations, Ponds, Email Templates, Text Templates (active), Import, Custom Fields, Stages, Phone Numbers, Tags, Integrations, Company, API, More
  - Left sidebar — folder tree (narrow, left side)
  - Main content area — template list table (wide, center-right)
  - Right side — column headers and data
  - Bottom-right help bubble (?)
- **Global navigation:**
  - People | Inbox | Tasks | Calendar | Deals | Reporting | Admin (active)
  - Search bar (top-center, appears to have content or placeholder)
  - Right: broker avatar cluster, notification icons
- **Primary content:**

  **Left sidebar — Folders:**
  - "All Text Templates" — folder (selected/active, shown in left rail)
  - Folder count shown: appears to be several folders but text is very small / [illegible at this zoom]

  **Main table — Text Templates list:**
  - Table header: **Template** (col 1, wide) | **Folders** | **Automations** | **Click-to-Call Goal** | **Sort** | **Emails** | **Clicks** | **Unsubscribed** | **Bounces** | **Action**
  - "Add Template" button (blue, top-right)
  - Search Templates input (top-right area)

  **Rows visible (text is small, many rows; reading what's legible):**
  The table has many rows of text templates. Due to image resolution/zoom level, specific template names are mostly [illegible], but the following structural elements are clear:
  - Each row has: template name/subject (left, wider column), folder assignment, automation count, metric columns (numeric values)
  - Automation count column shows values like: [illegible numbers]
  - Sort/Emails/Clicks/Unsubscribed/Bounces columns show numeric values per template
  - Rows appear to have a checkbox (far left, for bulk selection)
  - Action column (rightmost) — likely edit/delete icons

  Partially readable template names (top rows):
  1. [Row 1] — template name [illegible due to resolution] | Folder: "Incoming" | Automations: 1 | [metrics]
  2. [Row 2 onward] — template names [illegible at this zoom]

  The list appears to have approximately 20-30+ rows visible, many more scrolled below.

- **Filters / search / sort:**
  - "Search Templates" input field (top-right)
  - No visible active filter controls beyond search
  - Folder tree on left acts as a filter (clicking a folder filters the list)
- **Buttons & actions:**
  - `Add Template` (blue, top-right) — opens create text template form/modal
  - "Search Templates" field — filters template list by name
  - Folder items in left sidebar — filter list to that folder's templates
  - Row-level action icons (edit/delete, inferred)
- **Statuses / stages / tags / lead score / pills:**
  - Automation count per template — shows how many automations reference each template
  - Metrics: Sort, Emails, Clicks, Unsubscribed, Bounces — performance metrics per template
- **Automation / workflow elements:**
  - Text templates are used in Action Plans and Automations — the "Automations" column count per template shows this linkage
  - Templates with `Automations: 0` are manual-only
- **Data-model implications:**
  - TextTemplate entity: `id`, `name`, `body`, `folder_id`, `automation_count`, metrics: `sort_count`, `email_count`, `click_count`, `unsubscribed_count`, `bounce_count`
  - TextTemplateFolder entity: `id`, `name`, `parent_id` (tree structure)
  - Relationship: TextTemplate belongs_to TextTemplateFolder; referenced_by Automations[] and ActionPlanSteps[]
- **Notable details / edge cases / counts / numbers:**
  - Page URL path `/2/text-templates/py/templates` — "py" may be a folder ID or user-scoped path segment
  - Column set (Sort, Emails, Clicks, Unsubscribed, Bounces) suggests templates can include links and FUB tracks engagement metrics even on SMS (possibly via trackable links in texts)
  - "Click-to-Call Goal" column — unusual; suggests some text templates are designed to prompt a callback and FUB tracks whether a call goal was achieved after the text was sent
  - Large number of rows indicates a substantial template library

---

## screen-046.png

- **Module / area:** Admin / Settings — Text Templates (preview modal overlay)
- **Browser tab title / URL path:** "Text Template Folders - Fol..." | `ryan-realty.followupboss.com/2/text-templates/py/templates`
- **Purpose:** Preview an existing text message template ("Initial Text") showing its full content, with options to send a test or save.
- **Layout regions:**
  - Same base page as screen-045 (Text Templates list, visible in background, dimmed)
  - Modal overlay — centered, white card, ~500px wide, title at top
  - Modal has header, body content, test-send option, and action buttons
  - Background dimmed (overlay scrim)
- **Global navigation:** Same as screen-045 (background, partially visible through scrim)
- **Primary content (modal):**

  **Modal title:** "[text template name — partially visible/illegible at top, likely template title]"
  
  **Subject field (labeled at top):** Appears to have a label like "Connected" or similar [partially illegible]
  
  **Template body text (readable):**
  > "Hi {firstname}, I work with Ryan Realty in Bend. I'm helping a certain couple find a home in Cascades with primary listing on the main floor. Inventory is really limited right now and we haven't found something that's a good fit for this couple. I wanted to reach out to see if you have any interest in selling in the near future. With recent sales showing homes {price_range}, it's looking like buying a home from Bend will cost them either $1M-$2M and $2M for it to be perfect. The buying is amazing with lower than what the numbers might lead. If the buying partner can get from Bend and 2nd one if you'd like to get [illegible] I'm hoping you or someone you know who is looking at making a move in the near future would be interested. If you're looking for a specific home in Bend and or another broker or at all, just doing some homework to help our client out."

  (Note: Template uses merge fields like `{firstname}`, `{price_range}`)

  **"Show this text template with everyone"** — checkbox or toggle option (label partially visible at bottom of body)
  
  **Test send section:**
  - Label: "Send this text template with everyone" or similar [partially illegible]
  - A small icon/button area below the body

  **Action buttons at bottom of modal:**
  - `Cancel` (gray/outline button, left)
  - `Save` (blue button, right)

- **Filters / search / sort:** N/A (modal)
- **Buttons & actions:**
  - `Cancel` — closes modal without saving
  - `Save` — saves changes to the template
  - Checkbox/toggle for "Show this text template with everyone" — controls team-wide visibility (inferred)
- **Statuses / stages / tags / lead score / pills:** None visible in modal
- **Automation / workflow elements:**
  - Text template contains merge fields: `{firstname}`, `{price_range}` — personalization tokens
  - Template purpose: prospecting outreach — asking homeowners about selling interest for a buyer client
- **Data-model implications:**
  - TextTemplate: `body` (with merge field tokens like `{firstname}`, `{price_range}`), `shared` (bool — "show with everyone"), `name`/`subject`
  - Merge field tokens used: `{firstname}`, `{price_range}` — system resolves these at send time from contact record
- **Notable details / edge cases / counts / numbers:**
  - Template body is a prospecting/buyer-search text — not a standard drip follow-up; it's a bespoke buyer-needs-a-home outreach message
  - The body is relatively long for a text message (likely 3-4 SMS segments when sent)
  - Merge fields visible: `{firstname}`, `{price_range}` — partially dynamic
  - The template body has some garbled/unclear phrasing that may be placeholder text, a draft, or AI-generated content that wasn't fully edited (e.g., "The buying is amazing with lower than what the numbers might lead")
  - This may be a preview-only modal (read view), not the edit modal — the `Save` button may save a test send configuration rather than editing the body

---

## screen-047.png

- **Module / area:** Admin / Settings — Email Templates (list view)
- **Browser tab title / URL path:** "Email Template Folders - Fo..." | `ryan-realty.followupboss.com/2/email-templates/[id]/templates`
- **Purpose:** Browse and manage all email templates, organized into folders, with performance metrics and automation linkage counts.
- **Layout regions:**
  - Global browser chrome
  - FUB top navigation rail — People, Inbox, Tasks, Calendar, Deals, Reporting, Admin (active)
  - Admin sub-nav tabs — Overview, Lead Flow, Groups, Team, Action Plans, Automations, Ponds, Email Templates (active), Text Templates, Import, Custom Fields, Stages, Phone Numbers, Tags, Integrations, Company, API, More
  - Left sidebar — folder tree
  - Main content — email template table
  - Top-right: "Add Template" button and search field
  - Bottom-right help bubble (?)
- **Global navigation:**
  - People | Inbox | Tasks | Calendar | Deals | Reporting | Admin (active)
  - Search bar
  - Broker avatar cluster (right)
- **Primary content:**

  **Left sidebar — Folders:**
  - "All Email Templates" — root folder / "All" view (selected)
  - Sub-folders listed below (names [illegible at this zoom but several items visible])
  - Folder count appears to be 6-10 folders

  **Main table — Email Templates:**
  - Table heading/counter: appears to be "X Email Templates" [count illegible]
  - Button: `Add Template` (blue, top-right)
  - Search input: "Search Templates" (top-right area)
  
  **Table columns:**
  - **Template** (col 1, wide — template name/subject)
  - **Folders**
  - **Automations**
  - **Action Plans**
  - **Sort** (numeric column)
  - **Opens** (numeric)
  - **Clicks** (numeric)
  - **Unsubscribed** (numeric)
  - **Bounces** (numeric)
  - **Action** (icons)

  **Rows visible (zoomed out; many rows, most text [illegible] at this resolution):**
  - Multiple rows visible, approximately 20-30+ rows
  - Row structure: template name | folder badge | automation count | action plan count | metric values
  - Some rows appear to have blue folder badges or tags
  - Action column has icon buttons (pencil/trash, inferred)
  - Several rows show a value of "1" or "0" in Automations column
  - Opens column shows various numbers (range appears to be 0 to hundreds)
  - Some template names partially readable at top of list:
    1. [Row 1] — "[illegible]" 
    2. [Row 2] — appears to include text about "All Things Real Estate..."
    3. Additional rows with [illegible] names

- **Filters / search / sort:**
  - Folder sidebar — click to filter by folder
  - "Search Templates" input — text search
  - Column headers may be sortable (inferred)
- **Buttons & actions:**
  - `Add Template` — opens email template creation form/modal
  - "Search Templates" — filters list
  - Folder sidebar items — filter to folder
  - Row-level edit/delete icons (inferred)
- **Statuses / stages / tags / lead score / pills:**
  - Automations count and Action Plans count per template
  - Performance metrics: Opens, Clicks, Unsubscribed, Bounces
- **Automation / workflow elements:**
  - Email templates referenced in Action Plans and Automations — columns show counts
  - Templates with Action Plans > 0 are embedded in automated drip sequences
- **Data-model implications:**
  - EmailTemplate entity: `id`, `name`, `subject`, `body_html`, `folder_id`, `automation_count`, `action_plan_count`, metrics: `opens`, `clicks`, `unsubscribed`, `bounces`
  - EmailTemplateFolder entity: `id`, `name`, `parent_id`
  - Relationship: EmailTemplate belongs_to Folder; referenced_by Automations[] and ActionPlanSteps[]
  - Templates have richer metrics than text templates (Opens + Clicks vs text's simple Clicks)
- **Notable details / edge cases / counts / numbers:**
  - Separate "Action Plans" column exists here that was not visible in text templates — email templates track both Automation and Action Plan usage separately
  - Performance metrics (Opens, Clicks, Unsubscribed, Bounces) — FUB tracks email engagement natively, implying FUB sends emails directly (not just as a template library)
  - Many rows visible suggests a large template library

---

## screen-048.png

- **Module / area:** Admin / Settings — Email Templates (edit/preview modal overlay)
- **Browser tab title / URL path:** "Email Template Folders - Fo..." | `ryan-realty.followupboss.com/2/email-templates/[id]/templates`
- **Purpose:** Edit or preview an email template, showing subject line, rich body with formatting toolbar, a test-send option, and save/cancel controls.
- **Layout regions:**
  - Base page: same Email Templates list (screen-047 background, visible dimmed)
  - Modal overlay: "Edit Email Template" — centered, larger modal (~600px wide), with header/title, subject field, rich text editor, test-send section, and bottom action buttons
  - Overlay scrim dims background
- **Global navigation:** Same as screen-047 (background only, not interactable)
- **Primary content (modal):**

  **Modal title / header:** "Edit Email Template"
  
  **Subject field:**
  - Label: "Subject"
  - Value: "All Of Your Bend search is set up" (or similar — partially readable)
  - Below subject line: "Your Bend search is set up" (possibly a second line or preview)
  - Subject appears editable (text input field, inferred)
  - "Merge Field..." dropdown button visible to the right of the subject line (blue link/button) — for inserting merge tokens

  **Body / rich text editor:**
  - Formatting toolbar visible at top of body area with icons for: Bold (B), Italic (I), Underline (U), [additional formatting options — partially visible, icons include alignment, list, link, image, etc.]
  - Body text (readable):
    > "Hi {first_name},
    >
    > Thanks for the saved searches! I know your criteria are set for {[merge field — illegible]}. These matching listings will be in your inbox within the next few days. They come from the MLS in real time, so prices are accurate and current.
    >
    > One question that helps me sharpen what you see: What does your ideal home look like beyond the basics? Even a few sentences — when you look at the houses that come to the top of the listings you can't wait to walk in — what do you look forward to in the listing?"

  (Note: Template uses merge fields visible as `{first_name}` and at least one other `{[illegible]}`)

  **"Share this template with everyone"** — checkbox/toggle option near bottom of body (partially visible)
  
  **Test send section:**
  - Label / icon visible below body: a phone/email icon and send option for testing the template [partially illegible]

  **Bottom action buttons:**
  - `Cancel` (left, gray/outline button)
  - `Save` (right, blue button)

- **Filters / search / sort:** N/A (modal)
- **Buttons & actions:**
  - "Merge Field..." dropdown (subject line area) — inserts a merge field token into the subject
  - Formatting toolbar (body area) — Bold, Italic, Underline, and other rich text formatting controls
  - "Share this template with everyone" checkbox — makes template visible to all team members
  - Test send option — sends a preview of the email to a test address (inferred)
  - `Cancel` — closes modal without saving
  - `Save` — saves email template changes
- **Statuses / stages / tags / lead score / pills:** None in modal
- **Automation / workflow elements:**
  - This template appears to be a "saved search confirmation" email — sent after a contact's home search alerts are set up in the MLS/portal
  - The body references MLS listings and saved searches — this is part of a new-lead nurture flow
  - Merge fields: `{first_name}`, `{[saved search criteria — illegible]}` — personalized per contact
- **Data-model implications:**
  - EmailTemplate: `subject` (with merge tokens), `body_html` (rich text, with merge tokens), `shared` (bool), `name`
  - Merge tokens in subject and body: `{first_name}` confirmed; additional contact/search fields
  - Rich text editor implies `body_html` stores HTML, not plain text
  - "Share with everyone" → team-level template visibility control (`shared_with_team` bool field)
- **Notable details / edge cases / counts / numbers:**
  - Template appears to be a "Saved Search Confirmation" drip email — a common real estate nurture touch after IDX/portal search setup
  - Body is conversational and question-based (asking what the ideal home looks like beyond basics) — not a hard-sell, aligns with Ryan Realty's direct/consultative voice
  - Merge field dropdown is available for both subject and body — confirms dynamic personalization at two levels
  - The formatting toolbar confirms rich HTML email capability (not plain text)
  - Modal header says "Edit Email Template" — this is the edit view, not just preview
  - The "Share this template with everyone" option implies templates can be private (per-user) or shared (team-wide) — data model needs a visibility/scope field

---
