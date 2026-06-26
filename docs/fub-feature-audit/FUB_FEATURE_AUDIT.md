# Follow Up Boss — Feature Audit

> **Purpose.** A screen-by-screen, setting-by-setting catalog of every feature in our Follow Up Boss (FUB) instance (`ryan-realty.followupboss.com`). Built by driving the live logged-in account and recording what each screen does. Scope per Matt: **every screen and every setting** — not every individual workflow, template, user, or lead.
>
> **Why this exists.** Reference for the in-house CRM replacement initiative (`docs/CRM_REPLACEMENT_BLUEPRINT.md`) — to know exactly what we rely on and must replicate. Also a plain operating manual for the current tool.
>
> **Captured:** 2026-06-25 · live account · primary broker login (matt@ryan-realty.com).
>
> **Screenshots.** Every screen is captured as a real PNG in [`screenshots/`](screenshots/) and embedded inline below. Captures show the live FUB window (the browser URL bar is intentionally visible so each screen's route is verifiable). The on-screen "Claude started debugging this browser" banner is the automation tool, not a FUB element.

---

## Contents

0. [Global layout & navigation](#0-global-layout--navigation)
1. [Dashboard](#1-dashboard-2) · [1.1 Top-bar tools](#11-top-bar-tools-top-right-icons)
2. [People](#2-people-2people) — list, smart lists, filters, person record
3. [Inbox](#3-inbox-2inbox)
4. [Tasks](#4-tasks-2tasks)
5. [Calendar](#5-calendar-2calendar)
6. [Deals](#6-deals-2deals)
7. [Reporting](#7-reporting-2reporting)
8. [Admin / Settings](#8-admin--settings-2adminoverview) — Lead Flow, Groups, Ponds, Action Plans, Automations, Templates, Team, Import, Custom Fields, Stages, Tags, Appointment types, Phone Numbers, Company, API, Integrations, Business Registration, Billing, Email Domain Auth
9. [My Settings / personal profile](#9-my-settings--personal-profile-2settings)
10. [Summary — replacement implications](#10-summary--what-fub-does-for-us-and-what-the-replacement-must-replicate)
- [Appendix — coverage & method](#appendix--coverage--method)

---

## 0. Global layout & navigation

Every page shares a fixed top bar:

| Element | What it is |
|---|---|
| **Logo (flame icon)** | Returns to the Dashboard (`/2/`). |
| **People** | Contact database — the core of FUB. |
| **Inbox** | Unified activity/message stream (email, text, calls, notifications). |
| **Tasks** | Task list across all contacts. |
| **Calendar** | Appointments / scheduled events. |
| **Deals** | Pipeline / transaction tracking. |
| **Reporting** | Analytics dashboards. |
| **Admin** | All account configuration (the largest area). |
| **Search** | Global search across people, by name / email / phone. |
| **Top-right icons** | Email composer, Texting, New Person, Notifications bell, Profile/account menu. |

The visible top-nav set depends on role/permissions; the primary-broker (owner) login sees all of the above plus full Admin.

---

## 1. Dashboard (`/2/`)

The landing screen after login. A performance snapshot plus a recent-activity feed.

**Top controls (right):**
- **Audience filter** — "Everyone" dropdown (scope the dashboard to a specific user/team or everyone).
- **Date range** — "Last 30 days" dropdown.

**KPI tiles (row of 5):** each shows the metric, a sparkline trend, and a vs-prior delta.
1. **New Leads** — count of new leads in range, with "N unactioned" callout and % vs prior period.
2. **Avg. Contact Attempts** — average outreach attempts per lead, % vs prior.
3. **Speed to Action** — average time to first action on a lead (e.g. "8 days"), vs prior.
4. **Appts Next 30 Days** — upcoming appointment count, with task count.
5. **Deals Next 30 Days** — projected deal value ($) and deal count.

**Recent Activity feed:** a table of the latest contact activity with a **Filter Activity** dropdown. Columns: Name, Email, Phone (with click-to-call and click-to-text icons), Last Activity (e.g. "Viewed <listing>", "Visited Website"), Time, Stage, Assigned (agent). A **View all people** button drops into the People list.

![Dashboard — KPI tiles + recent activity](screenshots/01-dashboard.png)

### 1.1 Top-bar tools (top-right icons)

These five controls are present on every screen:

| Icon | Opens | Contents |
|---|---|---|
| **Email** (envelope) | Quick email composer (slide-up panel) | To / CC / BCC, Subject, rich-text body (bold, italic, underline, bullet + numbered lists, link, image, video embed, emoji, clear formatting, **insert merge field**), **Attachments**, **Templates**, discard, **Send Email** with a **schedule-send** (clock) option. The configured email **signature** auto-inserts (name, title, phone, links to Google reviews + Oregon Initial Agency Disclosure Pamphlet, license/fair-housing footer). |
| **Text** (speech bubble) | Quick text composer | Recipient picker first ("Enter name or phone number") with a recent-contacts list; then a message body. |
| **New Person** (person+) | Add Person modal | First Name, Last Name, Email, Phone, **Select a lead source**, Cancel / Add person. The fast manual lead-entry path. |
| **Notifications** (bell) | Notifications dropdown | Activity notifications feed, **Mark all as read**, and a notifications settings gear. |
| **Profile** (avatar) | Account menu | **My Settings**, **My Devices**, **Billing**, **Power-Ups**, **Product Changes**, **System Status**, **Log Out**. (My Settings, Billing, Power-Ups are detailed under Admin.) |

---

## 2. People (`/2/people/`)

The contact database — the heart of FUB. ~17,000+ people in our instance.

### 2.1 Layout

**Left sidebar — Smart Lists organized into Collections.** A Smart List is a saved, auto-updating filtered view; a Collection is a labeled group of Smart Lists. Our instance has:
- **All People** (top, with total count).
- **Pipeline** collection — Active & Pending Clients, Hot/Weekly, Warm/Bi-Weekly, Past Clients/Sphere: Quarterly, New Leads: No Call Attempt, Cold/Bi-Monthly, Old Leads: No Call Attempt. Each shows a live count.
- **Neighborhoods** collection — Tetherow, Sunriver, Pronghorn, Black Butte Ranch, Northwest Crossing, Vandevert, Crosswater, Caldera Springs, Sunstone Loop, Bend - River West / Awbrey Butte / Summit West / Century West, etc. Each a saved geo-filtered list with a count.
- **Manage** (bottom) — reorder/edit collections and lists.

**Main area — the list table.**
- Heading = current list name; **+ New List** (top-right) saves the current filter set as a new Smart List.
- **"Showing N people"** live count.
- **Mass-action toolbar** (icons, act on selected/all): **Email** (batch email), **Assign** (reassign agent), **Tag** (add/remove tags), **Delete**, **Export** (download CSV).
- **How Smart Lists work** (help link).
- **Columns** — customize visible columns across categories: Details, Assigned, Emails, Calls, Texts, Website activity, Deals, Inbox Apps, Custom Fields. Toggle any field (First/Last Name, Phone, Email, Address, Price, Tags, Stage, Source, Created, Updated, Inactive, etc.).
- **Assignment filter** ("Me" / Everyone / specific agent).
- **Filters** — opens the filter builder (right panel).

### 2.2 Table & per-column controls

Default columns: checkbox select, **Name** (with lead **source** shown beneath, e.g. "Ryan-Realty.com", "Import", "Expired Listing", "expired-listing-cron"), **Lead Score**, **Agent**, **Last Visit**, **Phone** (with click-to-call + click-to-text icons), **Email**, **Last Activity** (e.g. Registration, Inquiry, "Seller - <address>"). Table scrolls horizontally for added columns.

Each **column header** has an inline menu: **Sort** (asc/desc), **Filter** (operators appropriate to the field type — e.g. for a date: is not empty / was less than / was more than / is empty), and **Hide Column**.

### 2.3 Filter builder (the engine behind Smart Lists)

The **Filters** panel adds stackable conditions. Available filter fields are grouped:
- **Details** — Name, First Name, Last Name, Phone, Email, Address, Price, Tags, Stage, Source, Created, Updated, Inactive, My Next Task, Last Activity, Last Communication, Type, etc.
- **Emails** — Last Email, Last Sent/Received Email, Last Sent Batch Email, Last Sent Automation Email, Last Sent Marketing Campaign, Emails Sent, Emails Received, Last Email Activity.
- **Calls** — Last Call, Last Call Made/Received, Calls Made, Calls Received, Time to First Call, Talk Time.
- **Texts** — last/sent/received text metrics.
- **Website activity** — visit recency/counts.
- **Deals** — Deal Stage, Deal Close Date, Deal Price.
- **Inbox Apps** — Last Inbox App Message, Last Sent/Received Inbox App Message, Last Marketing Message Reply, Inbox App Messages Sent/Received.
- **Custom Fields** — every custom field is filterable (e.g. Recently Divorced, Recently Moved, Enrichment Provider, Phone Type, Net Worth Range, Income Range).

A filter set can be saved as a Smart List (and shared with the team). This is how the Pipeline and Neighborhood lists are built.

![People list — smart-list sidebar + table](screenshots/02-people-list.png)

### 2.4 Person record (`/2/people/view/<id>`)

Clicking a person opens a 3-column workspace. Top of the right column shows **"Person N of N"** with prev/next arrows and keyboard nav (← / → to move between leads in the current list).

**Left column — contact data:**
- Avatar, **Name**, communication status ("No communication yet" / last-contact summary).
- **Phone(s)** (typed: mobile, etc.) with click-to-call/text; **Email(s)**; **Add address**.
- **Relationships** — link related people (spouse, partner, agent, referral), with add buttons.
- **Details** — **Stage** (Lead, Active Client, Seller Prospect, etc.), **Assigned to** (agent), **Source** (+ how long ago), **Price**, **Timeframe**, **Tags** (chips; add/remove inline — e.g. `audience:buyer`, `Bounced`, `broker:matt`, `Buyer`, `buyer:nurture`, `source:contact-form`).
- **Financing** — Lender.
- **Custom Fields** — our configured set (extensive): Recently Divorced, Recently Moved, Enrichment Provider, Phone Type, Net Worth Range, Income Range, Occupation, Has Children, Household Size, Marital Status, Gender, Birthday, Owner Age Range, Owner Age, Include In FB CAS, Realtor License Type, Realtor License, Brokerage, Classification, Seller Score Band, Seller Score, Year Built, Lot Acres, Building Sqft, Baths, Bedrooms, Planned Community, Neighborhood, Subdivision (and more). These back the enrichment + audience-targeting data.

**Middle column — communication & timeline:**
- Action bar: **Create Note**, **Send Email**, **Text**, **Log Call** (+ "How it works").
- **Note composer** — free text with **@name team mentions** to notify teammates.
- **Activity timeline** — chronological log of everything: emails (incl. bounce/campaign status), texts, calls, website activity, lead-origin record (source, landing page, "Wants: …"), assignment events, automation/marketing sends. Filterable by type (All, Emails, Texts, Calls, etc.) via per-type tabs + a **Filters** dropdown. Each entry supports **Reply** and overflow actions.

**Right column — engagement & management:**
- **Action Plans** — automated multi-step drip sequences running (or "No action plans running").
- **Activity** — last-seen indicator.
- **Tasks** — upcoming tasks for this person; quick-add (+); lightning = suggested/automated task.
- **Appointments** — scheduled appointments; quick-add.
- **Integration widgets** — e.g. **AgentFire FUB Widget** (per-installed-app panels).
- **Deals** — linked transactions; quick-add.
- **Automations** — running automations (e.g. "Web Inquiry Option 01 · Running" with pause control).
- **Files** — drag-and-drop document storage on the contact.
- **Collaborators** — additional agents/staff with access to this contact.

![Person record — 3-column layout](screenshots/03-person-record.png)

**Inline composers.** Clicking **Send Email** / **Text** / **Log Call** opens the action inline (no page change), pre-addressed to the contact. The email composer adds **quick-template chips** (Introduction, Follow Up, Still Buying, Nurture Lead, Custom) above the body, auto-inserts the signature, and offers Attachments, Templates, and schedule-send — the same composer as the global one but scoped to this person and logged to the timeline on send.

![Person record — inline email composer with template chips](screenshots/53-person-email-composer.png)

---

## 3. Inbox (`/2/inbox/`)

A unified email/messaging client built into the CRM. Threads every message by contact and shows CRM context beside the conversation. 4-pane layout:

**Far-left — folders / scopes:**
- **My Inbox** (unread count) → **Inbox**, **Assigned**, **Drafts**, **Sent**, **Closed**.
- **Company** (count) — the shared team inbox across all brokers.
- **Manage** — inbox/connected-account settings.

**Conversation list:**
- **Select conversations** (bulk mode), **All / Unread** tabs, **Filter** dropdown.
- "N Unread Messages" counter.
- Rows: sender, thread subject, snippet, date, attachment icon, unread dot, and a count badge for thread length.

**Reading pane:**
- Header: linked contact name + the associated **deal/order** subject (e.g. "Order #… - <address>"), an **assignment** dropdown ("Me"), **Close** (resolve thread), overflow menu.
- Full message thread: sender, all recipients, timestamp, inline reply/forward controls, rendered HTML body, **attachments** (downloadable, e.g. PDFs).
- Bottom: **Reply**, **Reply All**, **Forward**, **Add Note** (log a private note on the contact from within the thread).

**Right — contact context panel:**
- Contact mini-card with last-communication time, phone (click-to-call/text), email.
- **Relationships**, **Details** (Stage, Agent, Lender), **Recent Conversations** (other threads with this contact), **Activity**, and integration widgets (AgentFire).

This is where inbound/outbound email and texts are triaged, assigned, and resolved — the day-to-day communication hub. Because it threads by contact, replying here logs to the person's timeline automatically.

![Inbox — folders, conversation list, reading pane, contact panel](screenshots/04-inbox.png)

---

## 4. Tasks (`/2/tasks`)

A consolidated task list across all contacts (tasks also appear on each person record).

**Views (tabs):** **Today's Tasks**, **Overdue** (with count), **Future**.

**Controls:** **How Tasks work** (help), **Filters**, assignment filter ("Me" / others).

**Filters — by task type:** All types, **Follow Up**, **Call**, **Email**, **Text**, **Showing**, **Closing**, **Open House**, **Thank You**, plus a **Show Completed** toggle. (These task types are also what Action Plans generate.)

Tasks are created manually, by Action Plans, or by automations, and each is tied to a person (and optionally a deal). Completing a task is how agents work the daily queue.

![Tasks — Today/Overdue/Future](screenshots/05-tasks.png)

---

## 5. Calendar (`/2/calendar`)

Appointment scheduling tied to contacts.

**Layout:** mini month-picker + agenda sidebar (Schedule / Filters tabs) on the left; main grid with **Day / Week / Month** views, **Today** + prev/next navigation, an **Everyone** (agent) filter, and a **+** create button.

**Create Appointment form:**
- Title; **start/end** date+time; **All day event** toggle; **timezone**.
- **Add location**.
- **Add guests** — link people (the assigned agent is added by default).
- **Type** — configurable appointment types (our set: Buyer consultation, Listing; "No type" default).
- **Outcome** — result tracking (e.g. for reporting on appointment outcomes).
- Rich-text **description**.
- **Send invitation email & text reminder** — notifies the guest automatically.

Appointments appear on the linked person record and feed the dashboard "Appts Next 30 Days" KPI.

![Calendar — day/week/month grid](screenshots/06-calendar.png)

---

## 6. Deals (`/2/deals`)

A Kanban pipeline for tracking transactions from lead to close.

**Pipelines (tabs):** **Buyers**, **Sellers** (+ a **gear** to manage pipelines/stages). Each pipeline is a board of stage columns.

**Buyers pipeline stages:** Start (temp stage) → Buyer Contract → Offer → Pending → Closed → Lost. Each **column header** shows deal **count**, total **$ value**, and **+ add deal**. Deals drag between stages.

**Top controls:** **How Deals work**, **Deal Reporting** (jumps to deal analytics), a **time filter** ("Current deals" / date ranges), and an **agent filter** ("Me" / Everyone).

**Deal card (board):** property address, **price**, **commission** ($), **close date**, linked-contact avatars + assigned-agent avatar.

**Deal record (modal):**
- Pipeline + current **stage** breadcrumb; created date.
- **Price**, **Close Date**.
- Transaction milestone dates: **Earnest Money Due**, **Mutual Acceptance**, **Due Diligence**, **Final Walk Through**, **Possession**.
- **Commission**, **Splits** (agent split + add team split).
- **People** (linked contacts) and **Team** (agents on the deal).
- **Property Address**, **Description**.
- **Custom Fields** ("Show all fields").
- **Files** — upload files or add a link.

Closed deals total drives the dashboard "Deals Next 30 Days" KPI and feeds Reporting. This is FUB's lightweight transaction tracker (distinct from our in-house TC/SkySlope flow).

![Deals — Buyers Kanban board](screenshots/07-deals.png)

The **Sellers** pipeline has its own stage set: Start → **Pre-Listing** → **Listed** → Offer → Pending → Closed → Lost (e.g. 56628 Sunstone Loop, Listed, $2,635,000 / $10,000 commission). Each pipeline's stages are independently configurable via the gear.

![Deals — Sellers pipeline](screenshots/43-deals-sellers.png)

---

## 7. Reporting (`/2/reporting`)

A library of analytics reports. Top tabs: **Overview, Agent Activity, Properties, Lead Sources, Calls, Texts, Batch Emails, Marketing, Deals, Appointments, Agent Goals.** ("Unlock Follow Up Boss Pro" gates a few; "How Reporting works" help.)

**Agents group:**
- **Agent Activity** — leads per agent with follow-up stats.
- **Calls** — calls made, conversations, missed calls, talk time, by agent.
- **Call Logs** — recent inbound/outbound calls (listen to recordings).
- **Texts** — text delivery rates and stats by phone number.
- **Appointments** — list of appointments + outcomes with lead source & agent.
- **Deals** — deals with commissions by deal stage and lead source.
- **Agent Leaderboard** *(Pro)* — ranking by follow-up + appointments.
- **Deals Leaderboard** *(Pro)* — ranking by deals closed.
- **Agent Goals** — annual commission + personal goals per agent.

**Lead Sources group:**
- **Source Report** — top lead providers and sources of appointments.
- **Speed To Lead** — how fast follow-up happens by source/type.
- **Contact Attempts** — average follow-up attempts by source.
- **Closed Deals By Source** — source with most closed deals, commission, conversion %.

**Marketing group:**
- **Batch Emails** — email-campaign results, opens & clicks.
- **Properties** — properties/zipcodes with the most inquiries.
- **Marketing UTM Report** — advanced UTM/campaign metrics with appointments & deals.

Each report has its own date range and agent/source filters. This is the performance + attribution layer (mirrors the dashboard KPIs at depth).

![Reporting — report catalog](screenshots/08-reporting.png)

### 7.1 Each report in detail

Every report opens to a full data view with its own date-range + agent/source filters and a CSV export. What each one actually shows:

**Agent Activity** — a trend chart (lead count vs activity) plus a per-agent metric grid: New Leads, Initially/Currently Assigned, Calls, Emails, Texts, Tasks Completed, Appointments.
![Agent Activity report](screenshots/32-report-agent-activity.png)

**Properties** — which properties / zip codes drew the most inquiries.
![Properties report](screenshots/33-report-properties.png)

**Lead Sources (Source Report)** — trend chart + per-source breakdown (New Leads, Calls, Emails, Texts, Notes, Tasks, Appointments by source). This sub-tab also houses Speed To Lead, Contact Attempts, and Closed Deals By Source.
![Lead Sources report](screenshots/34-report-lead-sources.png)

**Calls** — calls made/received, conversations, missed, talk time, by agent.
![Calls report](screenshots/35-report-calls.png)

**Texts** — text volume + delivery rates by phone number.
![Texts report](screenshots/36-report-texts.png)

**Batch Emails** — per-campaign results: Status, Recipients, Sent, Opens, Clicks, Unsubscribes.
![Batch Emails report](screenshots/37-report-batch-emails.png)

**Marketing (UTM)** — per-platform attribution table (AdWords, Google, Facebook Ads, Other) with Leads, Appointments, Deals Closed, Deal Value.
![Marketing UTM report](screenshots/38-report-marketing-utm.png)

**Deals** — deals with commission by stage and source.
![Deals report](screenshots/39-report-deals.png)

**Call Logs** — every inbound/outbound call (Agent, Type, Person, Time, Duration) with listen/playback.
![Call Logs report](screenshots/40-report-call-logs.png)

**Appointments** — appointment list + outcomes by source and agent.
![Appointments report](screenshots/41-report-appointments.png)

**Agent Goals** — per-agent annual table: Closed Deals, Upcoming Deals, Commission Earned, Commission Goal, Goal Progress (Matt's 2026 goal is $1,000,000; agents can "Set goal").
![Agent Goals report](screenshots/42-report-agent-goals.png)

---

## 8. Admin / Settings (`/2/admin/overview`)

All account configuration. Top tab bar: Overview, Lead Flow, Groups, Team, Action Plans, Automations, Ponds, Email Templates, Text Templates, Import, Custom Fields, Billing, **More** (Stages, Phone Numbers, Tags, Integrations, Company, API, Appointments, Email Domain Authentication). The Overview page groups every settings panel into five sections:

| Section | Panels |
|---|---|
| **Lead Distribution** | Lead Flow · Groups · Ponds |
| **Follow Up** | Action Plans · Automations · Email Templates · Text Templates |
| **Account** | Business Registration · Team · Import · Phone Numbers · Company · Email Domain Authentication |
| **Integrations** | API Keys & Lead Email · Pixel · IDX Integrations · All Integrations |
| **Customize** | Custom Fields · Custom Stages · Tags · Appointment Stages |

![Admin overview — settings catalog](screenshots/09-admin-overview.png)

Each panel is documented below.

### 8.1 Lead Flow (`/2/lead-flow`)

Configures how leads from each **source** are handled on arrival. Each lead flow row (e.g. Ryan-Realty.com, ryanrealty.vercel.app, expired-listing-cron, Expired Listing) shows the source name, lead type (Buyers/Sellers), the receiving integration/agent, last-lead info and total lead count. Per-flow settings:
- **Distribution** — who the lead is assigned to (specific agent default, a Group for round-robin, or a Pond).
- **Lender** — auto-assign a lender to the contact.
- **Automation** — auto-trigger an Automation/Action Plan on arrival.
- **Advanced Settings** + **Advanced Rules** — conditional routing rules (by price, area, tag, etc.).
- **Archive** / **Unarchived** filter, **+ Add Lead Flow**, "Learn about Lead Routing".

This is the front door of the CRM — it turns an inbound lead into an assigned, automated, working contact.

![Lead Flow](screenshots/10-lead-flow.png)

**Advanced Rules** (per flow) is a conditional router, processed top-to-bottom. Each rule = *"Leads who meet [All/Any] of these conditions"* (e.g. **Tags include "Rebecca Ryser Peterson"**) → then sets **Distribution** (agent), **Lender**, **Automation**, and an optional **initial text message**. So the same source can fan leads to different agents/automations by tag, price, area, etc. Rules can be copied from other lead flows.

![Lead Flow — advanced conditional routing rules](screenshots/49-lead-flow-advanced-rules.png)

### 8.2 Groups (`/2/groups`)

Agent pools for distributing new leads. Each group: **Name**, **Distribution Type** (Round Robin or first-to-claim), **Distribution** members (agent avatars), **Type** (Agents), edit/delete. Our groups: Seller Leads, Team Ryan. Lead Flow can assign a source to a group so incoming leads rotate among its members. **+ New Group**.

![Groups](screenshots/11-groups.png)

### 8.3 Ponds (`/2/ponds`)

Shared lead pools with no single owner that assigned agents prospect from / claim. Each pond: **Name**, **Pond Lead** (owner/manager), **Team Members**, edit/delete. Our pond: "Out Of State Home Owners". **+ Add Pond**. Used for nurture/farm pools where any team member can pick up opportunities.

![Ponds](screenshots/12-ponds.png)

### 8.4 Action Plans (`/2/action-plans`)

Drip sequences (timed emails, texts, tasks, stage changes) organized into **folders**: All Action Plans (7), My Action Plans (7), KTS Action Plans, KTS Action Plans - Client to Review for Compliance, Follow Up Boss. **Note:** Action Plans have been migrated into **Automations 2.0** — they now live in a "Migrated Action Plans" folder on the Automations page. Action Plans are the legacy term; Automations is the current engine.

![Action Plans folders](screenshots/13-action-plans.png)

### 8.5 Automations (`/2/automations/v2`)

The follow-up engine — visual, drag-and-drop, multi-step sequences. 38 automations in our instance, organized in folders (My Automations), with a prebuilt **Library** and **+ Create Automation**. The list shows per-automation: Name, Linked Automations, **Steps**, **Started**, **Engaged %**, **Completed**, Created By, **Status** (on/off toggle), Created On. Examples: Buyer/Seller LP Nurture, Nurture Contact, Expired Spring Strategy, Remote Home Owner, New Seller, Open House Follow Up, Post Closing Plan.

![Automations list](screenshots/14-automations.png)

**Builder — Triggers** (what starts an automation; one or many):
- Stage Change · Tag Added · Deal Stage Change · Inquiry (new general inquiry) · Property Saved · Property Viewed · Calendar Date (deal closing or custom date) · Appointment (added to calendar) · Manual (start by hand).

**Builder — Steps:**
- **Controls:** **Conditions** (branching — if/else true/false), **Time Delay** (wait / schedule next step).
- **Actions:** **Send Email**, **Reassign Agent or Lender**, **Add Collaborators**, **Remove Collaborators**, **Add Tags**, **Remove Tags**, **Create Task**, **Change Stage**, **Add Note**, **Pause Action Plans**, **Pause Automations**, **Run Automation** (chain into another).

> Note: there is **no "Send Text" action** — automated texts are not sendable programmatically (FUB blocks API texting). Texts are surfaced as a **Create Task** (type: Text) for an agent to send manually. This is the core constraint our in-house CRM must design around (see `docs/CRM_REPLACEMENT_BLUEPRINT.md`).

![Automation builder — drag-and-drop triggers + steps](screenshots/15-automation-builder.png)

A real built automation (our "Nurture Contact (Generic, Jan-Dec)", 23 steps) reads top-to-bottom on the canvas: **Trigger: Tag Added (Re-engage)** → Send Email → **30-day Time Delay** → Send Email → 30-day delay → Send Email → … Each node is editable; the ACTIVE toggle + Save are top-right. This is the drip pattern every nurture automation follows.

![Automation — real step sequence (trigger → email → delay → repeat)](screenshots/44-automation-detail.png)

### 8.6 Email Templates (`/2/email-templates`) & Text Templates (`/2/text-templates`)

Reusable message templates with **merge fields** (personalization tokens) and performance tracking (opens/clickthrough for email, reply rates for text). Organized into **folders**:
- **Email Templates** — 76 templates. Folders: All Email Templates (76), My Email Templates (76), Used by Action Plans (45), Follow Up Boss.
- **Text Templates** — 37 templates. Folders: All Text Templates (37), My Text Templates (14), Follow Up Boss (19).
- Controls: **+ Email/Text Template**, **+ Folder**, search. Templates are selectable from the email/text composers and inside Automation/Action Plan steps.

Inside a folder, each template row tracks performance: **Automations** + **Action Plans** using it, **Sent / Opens / Clicks / Replies / Unsubscribed / Bounces**.

![Email template list with per-template metrics](screenshots/47-email-template-list.png)

The **editor** has a Title, Subject (with a **Merge Fields** picker), and a rich-text body with its own Merge Fields picker. Bodies use tokens like `%contact_first_name%` and custom-field tokens like `%customBuyerSearchAreas%`. The sender's signature from My Settings is auto-appended; templates can be **shared with everyone** and show **"in use by N automation & N action plan."**

![Email template editor — merge fields + tokens](screenshots/48-email-template-editor.png)

![Email Templates folders](screenshots/16-email-templates.png)
![Text Templates folders](screenshots/17-text-templates.png)

### 8.7 Team (`/2/teams`)

User management. Each member row: **Name**, **Role** (Owner / Admin / Agent), **Phone**, **Connected Email** (with sync status), **Connected MLS**, **Last Seen** (Web + iOS app), **Can Export** (permission toggle), **Pause Leads** (stop new-lead assignment toggle), **Edit/Delete**. Our team: Matt Ryan (Owner), Rebecca Peterson (Admin), Paul Stevenson (Agent). **+ Add Team Members**. Roles govern visibility/permissions; per-user email + MLS connections drive the Inbox sync.

![Team — user/role management](screenshots/18-team.png)

The per-member **Edit** modal sets: First/Last Name, Login Email, Phone, **User Merge Field**, **Role**, **Group** (e.g. Team Ryan + Seller Leads), **Allowed to export leads**, **Notify about all new inquiries**, and **Delete user and reassign contacts**.

![Team member edit — role, group, permissions](screenshots/46-team-member-edit.png)

### 8.8 Import (`/2/import`)

CSV contact-import wizard ("Step 1: Import your contacts"), reversible, plus **View past imports**, or email a CSV to `imports@followupboss.com` for FUB to load. The bulk on-ramp for migrating a database in.

![Import](screenshots/19-import.png)

### 8.9 Custom Fields (`/2/custom-fields`)

Defines the extra fields shown on contacts. **64 custom fields** in our instance. Each row: **Field Name** (drag to reorder), **Type** (Text / Number / Date / select), **People** (count of contacts with a value), **Hide if empty** (toggle), **Read-only** (toggle), edit/delete. **Add Custom Field**. Our set is heavily enrichment-oriented (Enrichment Provider — 5,851 people; Phone Type — 4,843; Include In FB CAS — 7,255; Realtor License/Type/Brokerage — 163; plus Net Worth Range, Income Range, Owner Age, Seller Score, property attributes, etc.). These are the same fields exposed on the person record and in the People filter builder.

![Custom Fields](screenshots/20-custom-fields.png)

The **Add Custom Field** modal offers four field types — **Text, Date, Number, Dropdown** — plus the Hide-if-empty and Read-only flags.

![Add Custom Field — field types](screenshots/45-custom-field-add.png)

### 8.10 Custom Stages (`/2/stages`)

The contact **lifecycle stages**. Reorderable list, each with a **People** count and edit/delete. Our stages: Seller Prospect (7,523), Lead (8,243), A - Hot 1-3 Months, B - Warm 3-6 Months, C - Cold 6+ Months, Renter - future buyer, Active Client, Pending, Past Client, Sphere, Archive, Closed, Trash, Real Estate Agent (2,342), Vendor, Nurture. **Add Stage**. Stage changes are a primary automation trigger and the main pipeline axis on the dashboard/People views.

![Stages](screenshots/21-stages.png)

### 8.11 Tags (`/2/tags`)

Freeform + structured labels on contacts. **1,486 tags** in our instance. Each row: **Name** (sortable), **Used** count, edit / delete; bulk-select + delete; **search**; **Turn on auto-tagging new leads**. Heavily namespaced in our usage (e.g. `audience:buyer`, `audience:seller` (3,508), `area:bend-westside` (7,674), price bands `1M`–`5M+`, `absentee`, `auto:seller-seq:new`, `auto:brand-voice:plain-honest`). Tags drive Smart Lists, automation triggers (Tag Added), and audience segmentation.

![Tags](screenshots/22-tags.png)

### 8.12 Appointment Types & Outcomes (`/2/appointments`)

Configures the Calendar appointment form. **Appointment Types** (reorderable, add/edit/delete): Buyer consultation, Listing. **Appointment Outcomes**: No show, Working with buyers, Listing obtained. These populate the Type + Outcome dropdowns on appointments and the Appointments report.

![Appointment Types & Outcomes](screenshots/23-appointments.png)

### 8.13 Phone Numbers (`/2/phone-numbers`)

Manages the account's virtual telephony. **Number Ports** — port an existing number in (New Port Request; once ported it leaves the old provider). **Number Parking Lot** — Parked / Released tabs for numbers not currently assigned to a user/inbox (parked numbers can't call/text until assigned; released numbers are gone). Link to **Business Registration**.

![Phone Numbers](screenshots/24-phone-numbers.png)

### 8.14 Company (`/2/company-settings`)

Account-wide settings:
- **Identity** — Company name (Ryan Realty), Industry (Real Estate), Franchise, full Address (115 NW Oregon Ave #2, Bend, Oregon 97703), Country, **Time zone** (Pacific GMT-07:00).
- **Virtual Phone** — Manage Settings, **Fallback number** ((541) 213-6706), **Spam-label calling protection** (registered as Ryan Realty LLC), **Call Recording** (enabled for team members), **Legal Disclosure** (auto-play recording disclosure toggle + preview).
- **Office Hours** — days/times the team can receive inbound calls to team inboxes.
- **Subdomain** — `ryan-realty.followupboss.com` (changeable).
- **Business Insights** — **Production Goals 2026** ($1,000,000), **Weekly Report Recipients** (emailed reports).
- **Block List** — block specific emails / phone numbers.

![Company Settings](screenshots/25-company.png)

### 8.15 API Keys & Lead Email (`/2/api`)

Developer/integration access:
- **API Keys** — create/revoke keys (masked). Active keys: Agent Fire, Zapier, RyanRealtyApp, CLAUDE COWORK, Ryan Realty LP - Vercel. Columns: Name, Key, Created, Last Used, edit/delete.
- **Connected OAuth Applications** — OAuth-consented apps (none currently).
- **Lead Email Address** — unique `ryan.realty@followupboss.me` forwarding address for non-Google lead notifications.
- **Lead Processing** — monitors the connected Gmail inbox (`matt@ryan-realty.com`, ON) for new-lead notification emails and auto-creates contacts.
- **API Usage (Last 30 Days)** — per-system call counts (e.g. ryanrealty-web ~62k calls). This is how our website/Vercel app and Claude tooling push leads in.

![API Keys & Lead Email](screenshots/26-api.png)

### 8.16 Integrations (`/2/integrations`) · IDX (`/2/idx`) · Pixel

A marketplace of connectable apps, grouped:
- **Email Marketing** — Mailchimp (newsletters), BombBomb (video), SendGrid (batch email provider).
- **Lead Providers / Conversion / Engagement** — **Facebook** (connected), Zillow Premier Agent, Spacio, Mojo (outbound prospecting), Agent Legend, Aiva, CallAction, RealScout, StreetText, Verify, **Zapier**, and **Pixel by Follow Up Boss**.
- **IDX Integrations** — real-estate website/IDX providers that integrate natively.
- **Pixel** (`✨ Pixel`) — the FUB tracking pixel for website-activity capture + CTA lead capture (feeds the "Website activity" data on contacts).

![Integrations marketplace](screenshots/27-integrations.png)

Opening the **Pixel** integration shows its three config tabs — **Description / Tracking / Call To Action**. Category: Website Tracking. It tracks site visitors (who's on the site, what pages), powers the contact "Website activity" timeline, auto-tags marketing sources, and drives an embeddable mobile **Call To Action** for inbound lead capture.

![Pixel integration — Description / Tracking / Call To Action](screenshots/52-pixel.png)

### 8.17 Business Registration (`/2/company-settings/phone-registration`)

A2P 10DLC carrier registration — required to legally send SMS through US carriers. Status pipeline: **FUB Review → Submitted to carriers → Approved** (ours is **Approved**). Records: Business Legal Name (Ryan Realty LLC), Business Type (LLC), EIN (82-4802553), Business Website (ryan-realty.com), Registered Business Address (115 NW Oregon Ave #2, Bend OR 97703). (Mirrors the A2P work in the Twilio cutover.)

![Business Registration — A2P 10DLC](screenshots/28-business-registration.png)

### 8.18 Billing (`/2/billing`)

Subscription + payment:
- Lifetime usage banner (17,314 people, 33,777 emails tracked; Customer since 2025).
- **Product Plan** — **Grow** at $828/yr × 3 team members = $2,484/yr (Change plan, Edit Team Members; upsell to FUB Pro).
- **Calling Add-on** — optional paid calling (14-day trial offered).
- **Total Annual Payment** — annual discount ($414), credit ($103), next billing 6/30/2026, **net $2,070/yr**, $0 sales tax.
- **Business Location / Billing Address** (115 NW Oregon Ave Suite #2, Bend OR 97703) + **Credit Card** on file.

![Billing](screenshots/29-billing.png)

### 8.19 Email Domain Authentication (`/2/email-domain-authentication`)

Authenticate sending domains (SPF/DKIM DNS records) so bulk/automated email from FUB lands in the inbox, not spam. **Current status: `ryan-realty.com` is UNCLAIMED** (not authenticated) — a **deliverability gap**. Action available: **Claim Domain** (then add the DNS records). ⚠️ Worth fixing — unauthenticated domains increasingly route to spam at Google/Yahoo.

![Email Domain Authentication — UNCLAIMED](screenshots/30-email-domain-auth.png)

---

## 9. My Settings / personal profile (`/2/settings`)

Per-user settings (from the profile-avatar menu). Each team member has their own:
- **Profile** — Name, Phone, Time Zone, Portrait photo, **Login Email** (verified), Reset password.
- **vCard** — public contact card: title (Principal Broker), phones, emails (matt@, team@), address, social URLs (website, Facebook, YouTube, Instagram, LinkedIn, X, Zillow). "Edit Card Details".
- **Email** — **Connected Email** (matt@ryan-realty.com via Google; Disconnect), **Share your emails** + **Share your calendar** toggles (controls team visibility of your messages/calendar; powers the Inbox + Calendar sync).
- **Signature** — rich HTML email signature with live preview + edit (name, title, phone, web, tagline, Google-reviews + Oregon Initial Agency Disclosure links, license/fair-housing footer). This is what auto-inserts into composed emails.
- **MLS Profile Verification** — link MLS membership (MLS Agent ID), "Add a profile".
- **Notifications** — Manage Notification Settings (granular per-event push/email prefs), "Receive daily hot sheet emails" toggle.
- **Other Settings** — additional personal preferences.

**Other profile-menu items:** **My Devices** (logged-in devices / mobile app sessions), **Power-Ups** (add-on features), **Product Changes** (changelog), **System Status** (FUB uptime).

![My Settings — personal profile + vCard](screenshots/31-my-settings.png)

### 9.1 My Devices (`/2/devices`)

Registered mobile devices (iPhone/Android app installs — OS/app version, last active, notifications on/off, **Send test notification**, Remove) and **Active Sessions** (browser + location + IP, revocable). The push-notification + session-management surface.

![My Devices — devices + active sessions](screenshots/50-my-devices.png)

### 9.2 Power-Ups (`/2/powerups`)

Feature flags, split into **User Features** (just you) and **Account Features** (whole team). Notable toggles: **Blur Mode** (hide customer contact info for screen-sharing), **Call recording, transcripts & AI summaries** (ON), **Call Recording Disclosure**, **Disable batch email**, plus Pro-gated ones (Agent-owned lead duplication, Appointment reminders, Lead source lockdown, Agent Action Plans, Assign Smart List Collections). This is where optional behavior is switched on/off.

![Power-Ups — feature toggles](screenshots/51-power-ups.png)

---

## 10. Summary — what FUB does for us, and what the replacement must replicate

**The model in one paragraph.** A lead enters via **Lead Flow** (from a source/integration), gets **assigned** (agent / Group / Pond) and **stage**-stamped, and an **Automation** fires (drip emails + tasks). Agents work the lead from the **Inbox** (unified email/text), **Tasks** queue, and **person record** (timeline + custom fields + tags). Appointments and **Deals** track progression to close. **Reporting** measures source ROI, speed-to-lead, and agent activity. **Admin** configures all of it; **Smart Lists + Tags** segment the database for targeted action.

**The load-bearing pieces our in-house CRM must replicate** (cross-ref `docs/CRM_REPLACEMENT_BLUEPRINT.md`):
1. **Lead intake + routing** (Lead Flow → assignment → automation trigger), incl. round-robin Groups and Ponds.
2. **Person record** with the full custom-field set (64 fields), tags (1,486), stages, relationships, files, collaborators, and the activity timeline.
3. **Unified Inbox** (email + text threaded by contact, assignable, closeable) — the daily driver.
4. **Automations engine** (triggers + conditional steps + delays + actions). Note the texting constraint below.
5. **Tasks** (typed, daily/overdue/future) generated by automations.
6. **Deals pipeline** (Buyers/Sellers stages, milestone dates, commission/splits).
7. **Reporting** (source attribution, speed-to-lead, agent activity, deal/commission).
8. **Templates** (email + text, foldered, merge fields).
9. **Telephony** (virtual numbers, call recording, A2P registration) — already moved to Twilio (see `project_twilio_cutover`).

**Key constraints already known from this audit:**
- **No programmatic texting** — FUB's automation engine has *no Send-Text action*; texts are surfaced as a Create-Task for manual send (the in-house build via Twilio removes this limit).
- **Email domain `ryan-realty.com` is UNCLAIMED** in FUB's Email Domain Authentication — a live deliverability gap.
- **Plan cost** — $2,070/yr for 3 seats on the Grow plan; replacing FUB removes this recurring cost.

---

## Appendix — coverage & method

- **Captured live** on 2026-06-25 from the logged-in primary-broker account by driving the app screen-by-screen.
- **Screenshots:** 53 real PNGs in [`screenshots/`](screenshots/), embedded inline above — every major screen + Admin panel, **plus a deeper sweep**: all 11 individual reports, the Sellers pipeline, a real automation step-flow, the email-template list + editor (merge fields), the Add-Custom-Field modal, the Team-member edit modal, Lead Flow advanced rules, the Pixel integration, the inline person-record email composer, My Devices, and Power-Ups. Captured via `screencapture` of the live FUB browser window.
- **Scope honored:** every screen and every settings panel is documented; per Matt's scope, individual workflows, templates, users, and leads are *not* exhaustively enumerated (representative examples only).
- **Areas intentionally light** (config catalogs, not every row): the 76 email / 37 text templates, all 38 automations, every one of 64 custom fields / 1,486 tags / 16 stages — these are listed structurally with representative examples, not row-by-row.
