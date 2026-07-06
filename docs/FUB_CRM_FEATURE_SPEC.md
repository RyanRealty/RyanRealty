# Follow Up Boss (FUB) — Complete Feature & UI Specification

> **Purpose.** This is the authoritative, build-ready specification of every feature and UI surface in Follow Up Boss as used by Ryan Realty, reverse-engineered from 79 annotated production screenshots (captured 2026-06-30, stored in `FUB SCREENS`). It is the source of truth for building the Ryan Realty in-house CRM to full FUB parity. Every module, screen, panel, field, column, button, filter, status, modal, and workflow that appears in the screenshots is documented here, with inferred behavior clearly marked. Where the screenshots did not capture a feature directly, the expected behavior is reconstructed from FUB's known product design and is flagged `(inferred)`.
>
> **Scope.** This spec describes FUB *as observed*. It is paired with a FUB→in-house gap map (§13) that reconciles each feature against the CRM already under construction at `app/admin/(protected)/crm/` and the `crm_*` Supabase schema. Build the in-house CRM to satisfy this spec; use the gap map to sequence the work.
>
> **Provenance.** Source screenshots: `screen-001.png` … `screen-079.png` (capture-time order). Per-screen raw analysis: `docs/fub-crm-analysis/batch-01.md` … `batch-10.md`. Screen→feature index: §20.

---

## Table of contents

1. How to use this document
2. Product overview & personas
3. Information architecture & URL map
4. Global UI shell & shared patterns
5. Data model (entities, fields, relationships)
6. Module: People (list, smart lists, collections, bulk actions)
7. Module: Person detail (the contact record)
8. Module: Inbox (unified communications)
9. Module: Tasks
10. Module: Calendar & Appointments
11. Module: Deals (pipelines)
12. Module: Reporting
13. Module: Action Plans & Automations
14. Module: Templates (email & text)
15. Module: Admin / Settings (all configuration surfaces)
16. Account / user menu
17. Cross-cutting systems (routing, tags, custom fields, compliance, comms, enrichment, integrations)
18. End-to-end workflows
19. FUB → Ryan Realty in-house build gap map
20. Appendix A: screen-by-screen index
21. Appendix B: non-functional requirements & build notes

---

## 1. How to use this document

- **Section 5 (data model)** defines the entities. Build the schema first; everything else hangs off it.
- **Sections 6–16** are the module specs. Each follows the same shape: *purpose → layout → every element → actions → states → data touched → acceptance criteria*. Build one module at a time; each section's "Acceptance criteria" is the definition of done.
- **Section 17** documents the systems that cut across modules (lead routing, the tag taxonomy, compliance gating). These are easy to under-build; treat them as first-class.
- **Section 19** maps every FUB feature to the existing Ryan Realty CRM so you build the gap, not the whole thing twice.
- `(inferred)` marks behavior not directly visible in a screenshot. `[illegible]` in the raw analysis means the screenshot text could not be read at capture resolution; those values are reconstructed from FUB norms and should be confirmed against the live account before they gate a build decision.

---

## 2. Product overview & personas

Follow Up Boss is a real-estate team CRM. Its job is to capture every lead, unify every conversation (email, text, call, voicemail, web activity) onto one contact timeline, drive structured follow-up through tasks and automated sequences, track deals through buyer and seller pipelines, and report on agent activity, lead-source ROI, and marketing performance.

**The Ryan Realty account at a glance (from the screenshots):**
- **~18,235 contacts** across 16 lifecycle stages.
- **3 team members:** Matt Ryan (Owner), Rebecca Peterson (Admin), Paul Stevenson (Agent).
- **148 custom smart lists**, organized into collections (Pipeline, Neighborhoods, Smart Loop, …).
- **1,486 tags**, **64 custom fields**, **36 automations**, large email/text template libraries.
- **2 deal pipelines** (Buyers, Sellers) with stage-based Kanban boards.
- Heavy inbound: **559 inbox items, 326 unread, 248 overdue tasks** at capture time.

**Personas:**
- **Owner/Principal (Matt).** Sees everything: all contacts, all deals, all reporting, all admin. Configures stages, tags, automations, routing.
- **Admin (Rebecca).** Near-owner permissions; can manage but not delete the owner.
- **Agent (Paul).** Works assigned leads, own pipeline, own tasks; restricted admin.

Permission tiers (Owner > Admin > Agent) gate visibility (own vs. all records), export rights, and admin access. See §17.7.

---

## 3. Information architecture & URL map

### 3.1 Global primary navigation (persistent top bar, every screen)

| Nav item | Route (FUB) | Purpose |
|---|---|---|
| **People** | `/2/people` | Contact database, smart lists, collections |
| **Inbox** | `/2/inbox-new/0/inbox` | Unified email/text/voicemail conversations |
| **Tasks** | `/2/tasks/overdue` (and `/today`, `/future`) | Follow-up task queue |
| **Calendar** | `/2/calendar` (inferred) | Appointments |
| **Deals** | `/2/deals/1` (Buyers), `/2/deals/2` (Sellers) | Pipelines |
| **Reporting** | `/2/reporting` | Analytics hub |
| **Admin** | `/2/adminoverview` | All configuration |
| **Search** | global | Omni-search across contacts |
| **Account avatar** | top-right menu | My Settings, Pause Drips, Product Changes, System Status, Get Help, Log Out |

The top bar also shows a notification bell and (in this account) a cluster of broker avatars. `Inbox` carries an unread badge.

### 3.2 Full route map (observed)

```
/2/people                         All People list (default)
/2/people?sort=-lastLeadActivity  All People sorted by activity
/2/people/list/activity           "All People" activity view
/2/people/list/{id}               A specific smart list (e.g. /705 Pronghorn, /57 All Expireds, /30 Warm-Bi-Weekly)
/2/people/{id}                    (legacy people index variant)
/2/people/manage-lists            Manage Lists & Collections
/2/people/view/{personId}         Person detail (e.g. /27032, /217023, /819)
/2/people/view/{personId}/call    Person detail, call sub-route

/2/inbox-new/0/inbox              My Inbox
/2/inbox-new/0/assigned           Assigned sub-folder
/2/inbox-new/0/sent/{threadId}    Sent thread
/2/inbox-new/0/closed/{threadId}  Closed thread
/2/inbox-new/{threadId}/{id}      Company inbox thread (voicemail/unknown caller)

/2/tasks/today                    Today's tasks
/2/tasks/overdue                  Overdue tasks
/2/tasks/future                   Future tasks

/2/deals/1                        Buyers pipeline (Kanban)
/2/deals/2                        Sellers pipeline (Kanban)

/2/reporting                      Reporting hub (11 sub-tabs)

/2/adminoverview                  Admin hub
/2/automations/2                  Automations list
/2/automations/2/edit/{id}        Automation visual editor
/2/stages                         Stages management
/2/tags                           Tags management
/2/custom-fields                  Custom fields management
/2/email-templates/{id}/templates Email templates
/2/text-templates/{id}/templates  Text templates
/2/ponds                          Lead ponds
/2/teams                          Team management
/2/company-settings               Company settings
/2/api                            API keys & lead email
```

`/2/` is the account/version segment. The in-house build can drop it; routes are otherwise a faithful guide to the IA.

---

## 4. Global UI shell & shared patterns

These patterns repeat across every module. Build them once as shared components.

### 4.1 App shell
- **Top nav bar** (fixed, full width): primary nav (§3.1), centered global search, notification bell, account avatar menu. Dark background.
- **Module sub-nav** (contextual, below top nav): horizontal tab strip whose items depend on the active module — e.g. Tasks shows `Today's Tasks | Overdue | Future`; Reporting shows 11 report tabs; Admin shows ~18 settings tabs with a `More ▾` overflow; Deals shows `Buyers | Sellers | ⚙`.
- **Left sidebar** (People & Inbox modules): a tree of saved views. People shows Collections → Smart Lists grouped (Pipeline, Neighborhoods, …); Inbox shows folder tree (My Inbox → Inbox/Assigned/Drafts/Sent/Closed, then Company).
- **Main content** (center): the list, board, detail, or form.
- **Right rail** (Person detail & Inbox): stacked action/context widgets.

### 4.2 List/table pattern (People, Tasks, Templates, Stages, Tags, Custom Fields, Team, Ponds, Deals-reporting)
- Header row: list title + count badge (e.g. "Showing 876 people", "144", "64 Custom Fields", "1,486 Tags", "3 team members").
- Toolbar: primary action button (right, e.g. "Add Person", "Add Stage", "Create Automation"), search box, **Columns** chooser, **+ Filter**, sort controls, and a **"How X works"** help link (consistent across modules).
- Selectable rows (checkbox column) → bulk-action bar appears.
- Per-row action affordances: inline icons (edit pencil, delete trash) and/or a kebab/"…" context menu.
- Sort by clicking a column header (arrow indicator). Drag handles where order is meaningful (Stages, Custom Fields, smart-list display order).
- Counts shown as blue links navigate to a filtered list (e.g. clicking a stage's people count opens People filtered to that stage).

### 4.3 Detail pattern (Person, Deal)
- Left meta sidebar (identity + structured fields, inline-editable), center activity/timeline + compose, right rail of widgets.

### 4.4 Modal pattern
- Centered white card over a dimmed scrim, title top-left, × close top-right, form body, footer with secondary (Cancel/Dismiss) left + primary (Save/Apply/confirm) right.
- Observed modals: Merge sending person, Add relationship, Edit Phone Numbers, Apply Automation, Collaborators, Add Person, Export Selected People, Save New Smart List, Move Smart List, Edit Team Member, template preview/edit (email & text).

### 4.5 Inline dropdown/flyout pattern
- Field-attached dropdowns (Stage, Assigned-to, custom-field select, time-range) open in place over content.
- Right-edge flyout panels (smart-list Column Chooser / filter-field picker / group-by) — see §6.4.

### 4.6 Design conventions (for the in-house build, map to Ryan Realty design system)
- FUB uses a blue/teal primary, neutral grays, status pills. **The in-house build does NOT copy FUB's blue** — it uses the locked Ryan Realty system (navy `#102742` on cream `#faf8f4`, Geist body, Amboqia display), shadcn/ui components from `@/components/ui/`. This spec describes *structure and behavior*; styling follows `design_system/ryan-realty/`. (This is an internal admin tool, so the §0.5 brand-voice client-copy rules do not gate it, but design tokens still apply.)
- Avatars: circular, photo or initials.
- Numbers: tabular. Currency rounded to the dollar as shown on deal cards.
- Relative dates everywhere ("6 minutes ago", "Nov 9th '25", "4 months ago"); absolute on hover (inferred).

---

## 5. Data model (entities, fields, relationships)

This is the consolidated entity model implied by all 79 screens. Field types are FUB-observed; map to Postgres in the in-house build. The existing `crm_*` schema (§19) already implements most of this.

### 5.1 Person (contact) — the core entity
The center of the system. One row per contact (individuals **and** company/entity records like "DB Aller LLC" coexist).

**Identity & contact:**
- `id`
- `first_name`, `last_name`, `name` (display)
- `emails[]` — each `{ address, label, is_primary }`; supports multiple ("add another email")
- `phones[]` — each `{ number, label ∈ {Mobile, Home, Work, Other}, is_best }`; exactly one `is_best` (radio enforced)
- `address` (mailing), plus inferred buyer-search location/area
- `avatar` / `picture_url` (photo or initials)

**Classification & ownership:**
- `stage` → Stage (enum/config; 16 defined — §15.6)
- `source` / lead source (free or enumerated; captured at creation)
- `assigned_agent` → User (inline-editable on detail; bulk-editable from lists)
- `lead_score` (integer; shown as a badge)
- `tags[]` → Tag (many-to-many; 1,486 defined; prefixed taxonomy — §17.2)
- `collaborators[]` → User (many-to-many; grants visibility)
- `pond_id` → Pond (nullable; shared-pool membership)
- `groups[]` → Group membership (e.g. distribution groups)

**Relationships:**
- `relationships[]` → Person↔Person typed links (`type` e.g. Spouse/Partner/Co-buyer/Sibling/Child/Parent; plus "merge sending person" resolution flow). Each relationship can carry its own contact info.

**Custom fields (64 defined — §15.5):** typed values keyed by CustomField. Observed types: Text, Number, Date, Select (enumerated). Observed fields include: Year Built, Bedrooms, Bathrooms, Property Value, Net Worth Range, Income Range, Occupation, Household Size, Marital Status, Has Children, Gender, Birthday, Owner Age / Owner Age Range, Phone Type, Enrichment Provider, Recently Divorced, Recently Moved, Include in FB CAS, Realtor License / License Type / Brokerage, price range, budget, down payment, pre-approval, monthly budget, "looking for" criteria.

**Financing block:** lender, loan type/amount, pre-approval status/amount, monthly budget, down payment.

**Background / social:** LinkedIn URL, Google-search shortcut, location, age, gender, free-text background/notes.

**Communication-derived (used heavily as filter/sort fields — §6.4):**
- `created_at`, `contacted_at` (first), `last_activity_at`
- `last_communication_at` (any channel) and channel-specific: `last_email_sent`, `last_email_received`, `last_bounced_email`, `last_text`, `last_text_received`, `last_call`
- `website_activity` (visited/last visit), `pages_proposed`, `properties_proposed`
- `time_in_first_list`, list memberships (`lists[]`)
- `last_inquiry` (address/area string surfaced as a column)
- `portal` / source portal (Zillow, Realtor.com, …) — a group-by dimension

**Lifecycle/automation state:**
- enrolled action plans / automations (see Enrollment)
- lead origin attribution (source, page, campaign slug, UTM, "points"/score, assignment) captured as a system card on the timeline

### 5.2 User (team member / agent)
`id, first_name, last_name, login_email, phone, role ∈ {Owner, Admin, Agent}, avatar/photo, title, brokerage, bio, signature, user_merge_field (template token), groups[], connected_email {bool,address}, connected_mls {bool}, last_seen_web, last_seen_ios, can_export (bool), pause_leads (bool), notify_all_new_inquiries (bool)`. Owner cannot be deleted.

### 5.3 Timeline event (activity) — polymorphic
One unified, chronological feed per Person. `kind ∈ {email_in, email_out, text_in, text_out, call, voicemail, note, web_event, task, stage_change, lead_origin, seller_inquiry, system}`. Fields: `id, person_id, ts, kind, title, body/html, payload (channel-specific), actor (user), tracking_url, status (e.g. archived), dedupe_key`. Email events carry open/click/bounce tracking; web events carry the visited URL and a "follow up now" prompt.

### 5.4 Email message / Text message / Call / Voicemail
Concrete comm records that render in the timeline and Inbox.
- **Email:** `from, to[], cc[], subject, body_html, direction, sent_at, signature_id, template_id?, opens, clicks, bounces, unsubscribed, archived`.
- **Text/SMS:** `from, to, body, direction, sent_at, segments, tracking (clicks)`.
- **Call:** `direction, from, to, duration, recording_url, outcome, assigned_user`.
- **Voicemail:** `from, audio_url, transcript, assigned_user`.

### 5.5 Inbox thread
`id, contact_id (nullable for unknown callers), folder ∈ {Inbox, Assigned, Drafts, Sent, Closed}, scope ∈ {My, Company}, subject, messages[], unread_count, last_message_at, assigned_user`. Unknown inbound (no contact match) appears in Company inbox keyed by raw phone number with an "Add person" quick-create.

### 5.6 Task
`id, person_id, type (e.g. Call/Email/Text/Showing…), description, due_date, due_time, assigned_user, status ∈ {pending, overdue, completed}, origin (manual | automation/action-plan)`. Bucketed Today/Overdue/Future. Can be auto-created by automations (e.g. "Lead returned to website. Follow up now.").

### 5.7 Appointment
`id, title, type → AppointmentType, outcome → AppointmentOutcome, start_at, end_at, all_day, location, description, person_id, guest_person_ids[], assigned_agent, invite_sent, source, gcal_event_id (inferred sync)`. Appointment **stages/types & outcomes** are admin-configurable (§15: "Appointment Stages").

### 5.8 Deal
`id, pipeline_id, stage, name, property_address, price (list/sale), commission_amount, projected_close_date | close_date, status, linked_people[] (buyer/seller/co + agents shown as avatars), lead_source`. Two pipelines observed: **Buyers** (Start → Buyer Contract → Offer → Pending → Closed → Lost) and **Sellers** (Start → Pre-Listing → Listed → Offer → Pending → Closed → Lost/Terminated). Stages are per-pipeline and editable (gear + "Add a stage"). Columns show aggregate count + sum. Commission is a stored amount (rates vary; do not auto-compute as fixed %).

### 5.9 Pipeline
`id, type (Buyers|Sellers), name, stages[] (ordered, per-pipeline)`.

### 5.10 Stage (lifecycle)
`id, name, people_count (derived), sort_order (drag), is_system_protected (e.g. Trash)`. 16 observed — §15.6.

### 5.11 Tag
`id, name, used_count (derived)`. Prefix namespaced (`area:`, `audience:`, `auto:`, plus price tiers `1M`–`5M+`, `absentee`, etc.). 1,486 observed. "Auto-tag new leads" toggle.

### 5.12 Custom field (definition)
`id, name, type ∈ {Text, Number, Date, Select(+options[])}, people_count (derived), hide_if_empty (bool), read_only (bool), sort_order (drag)`. 64 observed.

### 5.13 Action Plan
`id, name, steps[] (ordered)`. A linear (mostly) sequence of touches (e.g. "1 Move Follow Up", "2 Move Follow Up", …). Applied to a Person via the "Apply Automation/Action Plan" flow. Distinct from Automations but overlapping in practice (FUB is migrating Action Plans → Automations).

### 5.14 Automation
`id, name, folder_id, trigger (e.g. Tag Added, Stage Changed, …), steps[] (ordered, drag-built), enrolled_count, completed_count, completion_rate, created_by (User|system), status (enabled bool), created_at`. Step types (from the visual editor palette): **Conditions**, and **Actions**: Time Delay, Send Email, Reassign Agent or Lender, Add/Remove Collaborators, Add/Remove Tags, Create Task, Change Stage, Add Note. 36 observed; folder-organized; naming convention `[DRAFT - DO NOT ENABLE]` / `[DAILY - DO NOT ENABLE]` for safety. Send Email step config: From (sender identity), To (recipient_type: primary contact | contact + all relationships | assigned agent), Delivery (immediate | 8am–7pm window | company office hours | custom time), template reference.

### 5.15 Enrollment (Person ↔ Action Plan / Automation)
`id, person_id, plan_or_automation_id, step_index, status (running|paused|completed|stopped|suppressed), enrolled_at, enrolled_by`. The Person right rail shows running automations (e.g. "Web Inquiry Option 01/#2", with action count and "N running").

### 5.16 Smart List & Collection
- **Smart List:** `id, name, emoji, description (rich text, ~250 char), filter_definition (boolean tree of conditions), columns[], group_by, collection_id, owner_user_id, visibility ∈ {private, shared_all, shared_selected}, shares[] (users), display_order, people_count (cached)`. 148 observed.
- **Collection:** `id, name, display_order`. Observed: Pipeline, Neighborhoods, Smart Loop, New Collection. A smart list belongs to exactly one collection.
- Filter condition operators observed: `includes any of`, `excludes any of`, `is empty`, `is not empty`, `more than N days`, `since date`. Filterable fields = essentially every Person field in §5.1 incl. all communication-derived fields, plus tags, stage, source, agent, custom fields, website activity, list membership, has-call/has-text booleans.

### 5.17 Pond (shared lead pool)
`id, name, pond_lead (assignment method), members[] (users)`. Leads pooled for members to claim. 1 observed ("Out Of State Home Owners").

### 5.18 Group (distribution)
`id, name, distribution_type ∈ {round_robin, first_to_claim}, members[]`. Used for lead routing; team members carry group membership (e.g. "Team Ryan, Seller Leads").

### 5.19 Template (email / text)
- **Email template:** `id, name, subject (merge tokens), body_html (rich text, merge tokens), folder_id, shared (bool), automation_count, action_plan_count, opens, clicks, unsubscribed, bounces`.
- **Text template:** `id, name, body (merge tokens like {firstname}, {price_range}), folder_id, shared, automation_count, sort, emails, clicks, unsubscribed, bounces, click_to_call_goal`.
- **Folder:** `id, name, parent_id` (tree).

### 5.20 Company / Account settings
`company_name, industry, franchise, address (line1/line2/city/state/zip/country), timezone, subdomain, virtual_phone, fallback_number, spam_label_name, call_recording_enabled, call_disclosure_autoplay, office_hours[], production_goal (annual $), weekly_report_recipients[], block_list (emails[], phones[])`.

### 5.21 API key / Integration
- **APIKey:** `id, name, key (masked), created_at, last_used_at`.
- **OAuthApp:** `name, consented_at`.
- **Lead email/processing:** `lead_email_address (@followupboss.me), lead_processing_inbox (provider, e.g. google), lead_processing_enabled`.
- **Integrations:** Pixel (website tracking), IDX, "All Integrations" (Email marketing, Facebook, Zillow, Dotloop, …), Email Domain Authentication. **API usage** tracked per system over 30 days.

### 5.22 Relationship graph summary (cardinalities)
- Person 1—N Email/Text/Call/Voicemail/Note/TimelineEvent/Task/Appointment/Deal-link/File
- Person N—N Tag, User(collaborator), Group, SmartList(membership is computed), ActionPlan/Automation(via Enrollment)
- Person N—N Person (Relationship, typed)
- Person N—1 Stage, User(assigned), Pond(nullable), Source
- Pipeline 1—N Stage(deal) ; Deal N—1 Pipeline, Stage ; Deal N—N Person
- Collection 1—N SmartList ; SmartList N—N User(share)
- Automation 1—N Step ; Automation/ActionPlan 1—N Enrollment ; Template referenced-by Automation/ActionPlan steps
- TemplateFolder 1—N Template (self-nesting)

---

## 6. Module: People

The contact database and its saved views. This is the most-used module.

### 6.1 People — All People list (`/2/people`, `/2/people/list/activity`)
**Purpose:** browse, filter, sort, and act on every contact.

**Layout:** top nav → left sidebar (Collections + Smart Lists tree) → main table → optional right flyout (Column Chooser / filter picker).

**Header & toolbar:**
- Title ("All People") + count badge; subtitle "Showing N people" (e.g. 876).
- Right side: **Add Person** (modal — §6.6), **Import** (→ Admin import), **New Smart List**, **Columns** (chooser flyout), **+ Filter**, sort control, view/grid toggle, "How … work" help.

**Columns (default observed set):** checkbox · Name (avatar + name; stage shown as a small label under name in some views) · Lead Score (numeric badge) · Agent (assigned) · Last Seen / Last Activity (relative date) · Phone (with click-to-call icon) · Email · Created · Last Activity description (e.g. "Inquiry: 12004 Moura Dr 97701", or an email subject like "Coastal Oregon Real Estate Experts…"). Columns are user-configurable via the Column Chooser.

**Row affordances:** click row → Person detail. Per-row quick icons: call, email (inferred SMS). Checkbox → bulk-action bar.

**Sorting:** by any column; `?sort=-lastLeadActivity` etc. The `activity` view (`/list/activity`) is a built-in "sort by most recent activity" view.

**Acceptance criteria:** list renders ≥ the default columns; counts accurate; sort + column-chooser + filter functional; clicking a row opens detail; bulk select shows the action bar.

### 6.2 Left sidebar — Collections & Smart Lists
A tree of saved views. Top-level entries: **All People** (built-in), then **COLLECTIONS** headers each containing smart lists:
- **Pipeline** collection: Active & Pending Clients, HotReady, Warm Ready, Past Clients/Sphere: Quarterly, Idle Monthly, [Cave] Leads: No Call Attempt, Callable Monthly, GIC Leads: No Call Attempt, etc. Each carries a contact count.
- **Neighborhoods** collection: Tetherow (340), Sunriver, Pronghorn (21/29), Black Butte Ranch, Northwest Crossing, Crosswater, Caldera Springs, Bend — River West, Bend — Awbrey Butte, Bend — Summit West, Bend — Century West, Bend — Southern Crossing, etc.
- Other collections: Smart Loop, New Collection.
Clicking a smart list loads it in the main table (`/list/{id}`). Sidebar shows live counts.

### 6.3 Smart List view (`/2/people/list/{id}`)
Same table as All People, pre-filtered by the list's saved filter definition.
- Header: list name (with emoji + colored dot), **N MEMBERS** / count badge, **Edit** (opens filter editor), description subtitle (e.g. "Contacts in your warm pipeline you should reach out to three or more times every 14 days. Requires a manual call, text, or email.").
- **Empty state:** illustration + "No people match filters, try another search." (e.g. Active & Pending Clients = 0; Warm/Bi-Weekly = 0).
- Populated example: All Expireds = 144 (paginated "Showing 56", 3 pages); rows show name, agent avatar, last-communication date, last-received, recency badges ("4 months ago"), phone with status dot.

### 6.4 Column Chooser & filter-field picker (right flyout)
Opened via **Columns**. A right-edge panel with a two-column checkbox list of **every available field** to show as a column and/or filter on:
- Identity/classification: Name, First/Last Name, Phone, Email, Address, Tags, Source, Stage, Agent, Lead Score, Price, Created, Contacted, Lists.
- Communication fields: Last Activity, Last Visit (website), Last Communication, Last Communication Email, Last Email, Last Received Email, Last Bounced (Email), Last Text, Last Text Received, Last Call, Has Call (bool), Has No Text (bool), Website Activity, Time In First List.
- Property/lead: Pages Proposed, Properties Proposed, Home Apps, Settlement Provider, Monthly Disclosure, Household Size, First Touched, Owner fields.
- Custom Fields (expandable group).
- Filter conditions appear as editable chips ("Tags exclude any of: …", "Last Call more than 14 days", "Stage includes any of: 8 - Warm", "Last Communication since {date}"), each with hover/sub-menu to edit/remove, plus **Clear filters**.
- A separate **Group by** picker offers entity dimensions: **Agent, Portal, Connections** (group the result rows).
Parenthetical counts (e.g. "Create (13)", "Tags (2)") indicate active filter-condition counts.

**Acceptance criteria:** the picker exposes the full field set; toggling a field adds/removes the column; filter chips are individually editable; group-by re-groups rows; "Clear filters" resets.

### 6.5 Bulk actions (multi-select + row context menu)
Selecting rows (checkboxes) reveals a bulk-action bar; a per-row kebab/right-click menu exposes the same operations. Observed actions (Pronghorn list):
1. **Update Stage** 2. **Update Agent** (picker lists Matt, Paul, Rebecca; "View Smart List Owners") 3. **Assign Pond** 4. **Update Location** 5. **Merge People** (dedup) 6. **Update Timeframe** 7. **Apply Action Plan** 8. **Delete People**.
Plus **Add Tag / Remove Tags** (tag-condition builder), and **Export** (→ §6.7).

### 6.6 Add Person modal
Fields: First Name, Last Name, Phone, Email, **Select a lead source** (dropdown). Buttons: Cancel | Add Person. Minimal quick-create; richer fields edited later on the detail page. (Source captured at creation; may drive routing/action-plan — inferred.)

### 6.7 Export Selected People modal
"Would you like to export N people?" + **Export all contacts** checkbox (overrides selection to the full list). Buttons: Cancel | **To Last Exporter** (re-uses the last export destination/format — CSV download or an integration). Export payload: name, phone, email, tags, source, agent, lead score (inferred).

### 6.8 Manage Lists & Collections (`/2/people/manage-lists`)
Admin view of all saved views. "Custom Lists: 148" counter, **+ New Collection**, **Actions** dropdown. Sections per collection (Pipeline, Neighborhoods, …) each a table: Name · Description · Total (contact count) · Created (by user) · Actions. Drag-and-drop reorder (persistent `display_order`); sort by Total. Per-row **Edit Smart List** + kebab menu: **Edit / Duplicate / Move to Collection / Delete**.
- **Save New Smart List modal** (also reached via Duplicate): Name (+ emoji picker), Description (rich-text, ~250-char limit), **Share smart list with**: radio "Share with everyone" or per-agent checkboxes (Matt/Paul/Rebecca) + agent search; default "This smart list will be private." Buttons: Dismiss | Save List.
- **Move Smart List modal:** "Move '{list}' to the following collection:" + collection picker (New Collection, Smart Loop, Neighborhoods, …). Dismiss | Move.

**Acceptance criteria for §6:** smart lists are CRUD-able with filter definition, visibility, emoji, description, collection; counts cached and shown; bulk actions operate on selection or whole list; export works; reorder persists.

---

## 7. Module: Person detail (the contact record)

The deepest screen in the product. URL `/2/people/view/{personId}`. Three regions: **left meta sidebar**, **center timeline + compose**, **right action rail**. A "Person N of M" pager navigates within the current list. Keyboard next/prev (inferred).

### 7.1 Left meta sidebar (inline-editable)
- **Header:** avatar (photo/initials), name, "Last contacted N ago" / "Seen N days ago".
- **Contact info:** phones (each with label + best flag; **Edit Phone Numbers** modal — §7.6), emails (multiple; "add another email"), address ("add address").
- **Stage** — inline dropdown (§7.4) listing the 16 stages.
- **Source** — lead source.
- **Assigned to** — inline agent dropdown with search; lists the 3 brokers (+ unassigned, inferred).
- **Relationships** — linked people; **Add relationship** modal (§7.5) and **Merge sending person** modal (§7.7). "No relationships" empty state.
- Collapsible sections: **Details** (property fields: Year Built, Bedrooms, Bathrooms, Property Value, Travel…), **Financing** (lender, loan, pre-approval, down payment, monthly budget), **Lender**, **Custom Fields** (the full configured set incl. Select-type fields via "Select an Option" dropdown — §7.8), **Background** ("Add background"), **Social Profile** (LinkedIn link, Google-search shortcut, age, gender, location), **Groups**.
- All fields inline-editable (click → dropdown/inline input), no page reload.

### 7.2 Center — activity timeline / communication feed
A unified reverse-chronological feed of all timeline events (§5.3): emails (in/out, with "archived" pills + tracking URLs + rendered signatures), texts, calls, voicemails, notes, web-activity events, stage changes, and system cards.
- **LEAD ORIGIN card** (system): Source (e.g. "Seller LP (Home Value)"), Page (e.g. `/lp/seller-home-value`), Campaign slug (e.g. `concept-m-mountain (facebook/paid_social, ad=v13-editorial)`), Wants (e.g. "home valuation for {address}, plans to sell ready to sell now"), Tier (e.g. "hot"), Assigned ("matt — default routing").
- **Seller Inquiry card** (system): address, timeline ("ready-now"), tier, assignment, multi-step funnel progress ("step 2 of 3 completed").
- **Web-activity events:** "Lead viewed/returned to website. Follow up now." with the visited URL (these can auto-spawn call tasks — see Tasks).
- Email cards expand to full HTML body; show open/click tracking; "Reply / Reply All / Forward"; "Share this email with Follow Up Boss staff" link.
- **Activity filter tabs:** All | Email | Text | Calls | Notes (inferred set). Time-range filter dropdown: Recent | Last 3/6/12/24 Months (§7.9).

### 7.3 Center — compose bar (multi-channel)
Top of the center column. **Send Email** and **Send Text** as co-equal actions, plus **Log Call**, **Create Note**, **Add Task / Appointment** (inferred row).
- **Email compose:** To (chip), CC/BCC, Subject (with **Merge Field** inserter), rich-text editor (Bold/Italic/Underline, lists, link, image, attachment, emoji), template inserter, **AI Writing** assist, **Business Card** (inserts the broker's HTML signature block: headshot, name, title "Owner & Principal Broker — Ryan Realty LLC", phone, website, tagline, logo, podcast link), **Follow Up** (schedules a follow-up), **Counter** (real-estate counter-offer action). A **"Continue Sending"** state/banner exists for queued/interrupted/throttled sends. Sending from here auto-logs to the timeline.
- A lead-routing **hover tooltip** surfaces lead origin/campaign/points/assignment near the send/route control.

### 7.4 Stage inline dropdown
Click the Stage field → dropdown of all stages (Nurture, Lead, Seller Prospect, A-Hot, B-Warm, C-Cold, Active Client, Pending, Past Client, Sphere, …). Selecting changes stage (logged to timeline; may fire stage-change automations).

### 7.5 Add relationship modal
Create a NEW linked person: First/Last Name, **Type** (Spouse/Partner/Co-buyer/Sibling/Child/Parent…), Phone (+ label + Best Number), Email (+ "add another email"). Cancel | Save. Creates a Person AND a Relationship link in one action.

### 7.6 Edit Phone Numbers modal
Rows of `Phone Number | Label (Mobile/Home/Work/Other) | Best Number (radio)`; "+ Add another phone"; per-row delete (inferred). Cancel | Save Phone Numbers. Exactly one Best Number.

### 7.7 Merge sending person modal
When an inbound email's address matches an existing contact, prompt: "We matched the email address of this incoming message with an existing person. Merge as a relationship?" Type-ahead person search; Cancel | Merge. Resolves duplicate sender identity.

### 7.8 Custom-field Select dropdown ("Select an Option")
Select-type custom fields render an inline "Select an Option" dropdown of the field's enumerated options.

### 7.9 Activity time-range dropdown
Recent | Last 3 Months | Last 6 Months | Last 12 Months | Last 24 Months — filters the timeline.

### 7.10 Right action rail (stacked widgets)
- **Action Plans** — running/available plans; "N of M" progress; "Start a new…"; **Apply Automation** modal (§13.3) lists configured automations to enroll.
- **Activity** — recent activity summary + "Report".
- **Tasks (N)** — task list with due dates; add task.
- **Appointments** — "No upcoming appointments" / list.
- **AgentFire FUB Widget** — embedded third-party (AgentFire IDX) widget showing the contact's portal/property data.
- **Deals** — linked deals / "No deals yet".
- **Automations** — running automations (e.g. "Web Inquiry Option 01/#2", action count, "N running", last-run time).
- **Web Inquiry Option D1/01/#2** — named web-inquiry automation status with green active indicator.
- **Files** — attachments ("drag some here").
- **Collaborators** — added team members; **Collaborators modal** (search + add Matt/Paul/Rebecca) grants visibility/notifications.

**Acceptance criteria for §7:** every sidebar field is inline-editable and persists; the timeline merges all event kinds chronologically with channel filters + time-range; compose supports email/text/note/call/task with templates, merge fields, signature, AI assist; all modals (relationship, phone, merge, collaborators, apply automation) function; right rail widgets reflect live state.

---

## 8. Module: Inbox (unified communications)

URL `/2/inbox-new/…`. A 2–3 pane email-client-style view unifying email, text, and voicemail.

**Left sidebar — folder tree:**
- **My Inbox (559)** → **Inbox**, **Assigned**, **Drafts**, **Sent**, **Closed**.
- **Company (54)** → shared threads incl. unknown-caller voicemails (e.g. "Company Manager" + raw phone-number threads).
- Aggregate "326 Unread Messages" header.

**Center-left — thread list:** rows of `contact name · subject/preview · timestamp · unread dot`. Filter tabs **All | Unread**, **Filter** dropdown (by agent/source — inferred). Empty state per folder (e.g. "Assigned is empty." with an onboarding video card "How the Inbox helps you never miss important conversations" + "How It Works").

**Center-main — reading pane:** full thread; renders rich HTML emails inline with images (e.g. Guild Mortgage newsletter, listing marketing emails). Thread action bar: mark read / clear / overflow; **Reply | Reply All | Forward**. For voicemail/call threads: voicemail bubbles with audio/transcript, "Unknown — {assigned agent}" label, and a "Write a note or a comment…" internal-note input + Send.

**Right rail — condensed contact card:** name, stage/status, assigned agent, Relationships, Lender, Recent Conversations (list), Activity, AgentFire FUB Widget; links to full Person detail.

**Unknown-caller flow:** inbound from an unmatched number lands in Company inbox keyed by the phone number; right panel shows an **Add person** quick-create (First/Last + submit) to convert the caller into a Person.

**Folder semantics:** message-level state — Inbox (active), Assigned (explicitly routed to an agent), Drafts, Sent, Closed (resolved/archived). My (personal) vs Company (shared) scope.

**Acceptance criteria:** folder tree with live counts; thread list with All/Unread + filter; reading pane renders HTML email + inline media and SMS/voicemail; reply/forward + internal notes; unknown-caller add-person; contact rail links to detail.

---

## 9. Module: Tasks

URL `/2/tasks/{today|overdue|future}`. The follow-up queue.

- **Sub-nav tabs:** Today's Tasks | **Overdue (N)** | Future, with a count badge (Overdue = 248 observed).
- **Toolbar:** "How Tasks work" · **Filters** dropdown (type/contact/source) · **{Agent}** dropdown ("Me" / agent filter) · **Clear My Overdue Tasks** (bulk dismiss, danger style).
- **List:** tasks grouped by date (descending), each group with a count, e.g. "Tuesday, Jun 23 (3)". Each task row: contact avatar + name (link to that Person), **task-type icon** (phone/call, email, text, showing…), **description** (e.g. "Lead returned to website. Follow up now."), **time** due, **assigned-to** ("Me"), and a **complete** affordance (— / checkbox).
- **Auto-generated tasks:** automations create tasks (e.g. website-return → call task), which can produce large backlogs without dedup (248 overdue here, many for one repeatedly-returning lead).

**Acceptance criteria:** Today/Overdue/Future buckets with accurate counts; date-grouped list; per-task complete; agent + type filters; bulk "clear overdue"; tasks link to their contact; automations can create tasks.

---

## 10. Module: Calendar & Appointments

Nav item present (`/2/calendar`, inferred). Appointments surface on the Person detail right rail ("No upcoming appointments") and in Reporting ("Appointments" report: list of appointments & outcomes with lead source + agent). Appointment **types** and **outcomes** are admin-configurable (Admin → "Appointment Stages").

**Model (from §5.7):** title, type, outcome, start/end, all-day, location, description, linked person + guests, assigned agent, invite-sent, source, gcal sync (inferred). 

**Acceptance criteria (build to FUB norm):** month/week/day calendar; create/edit appointment with type + linked contact + agent; outcome capture after the appointment; appears on contact timeline + right rail + Appointments report; optional Google Calendar sync. *(Confirm exact calendar UI against the live account — not directly captured in a screenshot.)*

---

## 11. Module: Deals (pipelines)

URL `/2/deals/{pipelineId}`. Kanban boards, one per pipeline. Sub-nav: **Buyers | Sellers | ⚙ (settings)**. Toolbar: "How Deals work" · **Deal Reporting** · **Current deals** (time filter) · **Everyone** (agent filter).

- **Board:** horizontal stage columns; each column header shows **stage name + deal count + summed value** (e.g. Sellers→Closed "9 deals, $7,934,000"). **+** per column adds a deal to that stage. **"Add a stage"** at the right adds a custom stage. Drag cards between columns to change stage (inferred).
- **Deal card:** property address, price, **commission amount** (arrow + $), projected/actual **close date**, and **linked-people avatars** (2–3: buyer/seller/co + agent). Click → deal detail (inferred).
- **Buyers stages:** Start (temp stage) → Buyer Contract → Offer → Pending → Closed → Lost.
- **Sellers stages:** Start (temp stage) → Pre-Listing → Listed → Offer → Pending → Closed → Lost/Terminated.
- Commission is a **stored amount** (observed rates vary 0.3%–2.5%; represents one side only). Do not auto-compute as a fixed %.
- **Deal Reporting** → Reporting "Deals" report (commissions by stage and lead source).

**Acceptance criteria:** two pipelines with per-pipeline editable stages; Kanban with count+sum per column; deal cards with address/price/commission/close/people; add-deal, add-stage, drag-to-restage; agent + time filters; deal detail; reporting hook. *(Note: Ryan Realty's transaction system of record is Vault; CRM deals are the pre/active pipeline view — reconcile in §19.)*

---

## 12. Module: Reporting

URL `/2/reporting`. A hub of report cards + 11 sub-tabs. Tabs: **Overview · Agent Activity · Properties · Lead Sources · Calls · Texts · Batch Emails · Marketing · Deals · Appointments · Agent Goals.**

**Report cards (13), grouped:**
- **Agents:** Agent Activity (leads per agent + follow-up stats) · Calls (made/conversations/missed/talk time by agent) · Call Logs (listen to recent inbound/outbound calls) · Texts (delivery rates by number) · Appointments (list + outcomes + source + agent) · Deals (commissions by stage + source) · Agent Goals (annual commission & personal goals per agent).
- **Lead Sources:** Source Report (top providers + appointment sources) · Speed To Lead (time-to-first-contact by source + follow-up type) · Contact Attempts (avg follow-ups by source) · Closed Deals By Source (closed count, commission, conversion %).
- **Marketing:** Batch Emails (campaign opens/clicks) · Properties (inquiries by property + zip) · Marketing UTM Report (UTM/campaign metrics through to appointments + deals).

Each card → a dedicated report with its own date-range and filters (inferred). The "How … works" help pattern repeats.

**Acceptance criteria:** the 13 reports compute from real timeline/call/text/email/deal/appointment data with date filters; Agent Goals is editable; UTM attribution flows lead-source → appointment → closed deal.

---

## 13. Module: Action Plans & Automations

The follow-up automation engine. FUB has two overlapping constructs — **Action Plans** (older, linear step sequences) and **Automations** (newer, trigger + visual flow builder). The in-house build should implement one unified **Sequence** engine that covers both (the existing `crm_sequences` does this — §19).

### 13.1 Automations list (`/2/automations/2`)
- Header: "**36 Automations**", **Create Automation**, **Create Folder**. Folder-organized ("My Automations").
- Table columns: Name · Trigger · **Enrolled** · **Completed** · completion % · created-by (User or "Follow Up Boss" system) · **Status toggle** (enabled/disabled) · Created On · Actions (edit/duplicate/delete — inferred).
- Naming safety convention: `[DRAFT - DO NOT ENABLE]`, `[DAILY - DO NOT ENABLE]` prevent accidental activation; `Clone`/`from…` denote copies.
- Real examples: "Best LP Nurture > audience-seller", "Seller LP Nurture > audience-seller", "Ryan Realty - Expired Spring Strategy" (52 enrolled / 8 completed), "Ryan Realty - New Seller", "Ryan Realty - Remote Home Owner", "Nurture Long Term Buyer", "Open House Follow Up", "Start Post-Closing Follow Up", "Unsubscribe-Matt", "New Inquiry for an existing lead: FUB".

### 13.2 Automation visual editor (`/2/automations/2/edit/{id}`)
- **Left palette:** **Trigger** selector + a search-filterable action toolbox. Step types:
  - **Conditions** (branch/gate).
  - **Actions:** Time Delay · Send Email · Reassign Agent or Lender · Add Collaborators · Remove Collaborators · Add Tags · Remove Tags · Create Task · Change Stage · Add Note.
- **Center canvas:** a top **Trigger tile** (e.g. **Tag Added** — "what tags or audiences") followed by chained step cards connected by arrows, with time-delay/wait labels between steps. Drag steps from the palette onto the canvas ("Drop a step to the canvas"). Linear by default; conditions enable branching.
- **Top bar:** Back to Automations, automation name, **Enabled/Disabled** toggle.
- **Right config panel** (per selected step). **Send Email** step config: name of step · **From** (sender identity / configured send address) · **To** (Agent assigned to the contact, etc.) · **Recipient Preferences** (send to primary contact only | contact + all relationships | assigned agent) · **Delivery Preferences** (Send Immediately | between 8:00am–7:00pm | during company office hours | at custom time) · **Delete** step. Other step types have analogous config panels (inferred).

### 13.3 Apply Automation / Action Plan (from a contact or list)
Modal listing configured automations/plans to enroll the contact(s) in (e.g. Stale Lead Engagement, Buyer Long Term Nurture, Open House Follow Up, Open House Lead, Post Closing Flow, Birthday Email, Assign to a lender). Search-filterable; Cancel | Apply. Also available as the **Apply Action Plan** bulk row-action (§6.5).

### 13.4 Action Plan steps (on the contact)
The Person right rail shows enrolled plan steps as an ordered list ("1 Move Follow Up", "2 …", …) with progress; "N of M" complete. Steps map 1:1 to the touches sent (e.g. a 4-action "Web Inquiry Option #2" → 4 emails in the timeline).

### 13.5 Engine behavior (inferred from FUB norms + Ryan Realty config)
- Triggers: Tag Added, Stage Changed, Source is, Inactivity/time-based, manual apply.
- Stop-on-reply: a sequence pauses when the contact replies (the in-house `crm_sequences.stop_on_reply` implements this).
- Send windows respect the 8am–7pm / office-hours / custom delivery preference.
- Suppression: every send path checks the compliance suppression list (§17.4) before sending.
- Enrollment state machine: running → paused (reply) → completed | stopped | suppressed.

**Acceptance criteria:** create/edit automations in a visual builder with the full trigger + action-step set; enable/disable safely; enroll contacts singly + in bulk; track enrolled/completed/% per automation; per-step delivery config; stop-on-reply + suppression honored; folders + safety naming.

---

## 14. Module: Templates (email & text)

Reusable message content for compose, action plans, and automations.

### 14.1 Email Templates (`/2/email-templates/{id}/templates`)
- Left **folder tree** (All Email Templates + sub-folders). Header count, **Add Template**, **Search Templates**.
- Table columns: Template (name/subject) · Folders · **Automations** (usage count) · **Action Plans** (usage count) · Sort · **Opens · Clicks · Unsubscribed · Bounces** (engagement metrics).
- **Edit Email Template modal:** Subject (with **Merge Field** inserter) · rich-text body (Bold/Italic/Underline, lists, link, image; merge tokens like `{first_name}`) · **Share this template with everyone** (team visibility) · test-send · Cancel | Save. Bodies are HTML.

### 14.2 Text Templates (`/2/text-templates/{id}/templates`)
- Left **folder tree** (All Text Templates). **Add Template**, **Search Templates**.
- Table columns: Template · Folders · Automations · **Click-to-Call Goal** · Sort · Emails · Clicks · Unsubscribed · Bounces.
- **Preview/Edit modal:** body with merge tokens (`{firstname}`, `{price_range}`) · "Show this text template with everyone" (share) · test-send · Cancel | Save.

**Merge tokens** resolve at send time from the contact record (and agent/user fields via `user_merge_field`). Templates are private or shared (team-wide) and track engagement natively (so the system sends, not just stores).

**Acceptance criteria:** folder-organized CRUD for email + text templates; merge-field insertion in subject + body; rich HTML email bodies; share scope; engagement metrics; usage counts by automation/action-plan; test send.

---

## 15. Module: Admin / Settings

URL `/2/adminoverview`. The configuration hub. Sub-nav (~18 tabs + `More ▾`): **Overview · Lead Flow · Groups · Team · Action Plans · Automations · Ponds · Email Templates · Text Templates · Import · Custom Fields · Stages · Phone Numbers · Tags · Integrations · Company · API · More.**

### 15.1 Admin Overview (tile hub)
A grid of labeled tiles grouped by section, each linking to a config surface:
- **Lead Flow** section: Lead Flow (test/review how leads enter), Groups (route automations to groups).
- **Ponds** section: Ponds (auto-routing pools).
- **Follow Up** section: Action Plans, Automations, Email Templates, Text Templates, Business Registration (A2P/10DLC for texting), Team, Import, Phone Numbers, Company, Email Domain Authentication.
- **Integrations** section: API Keys & Lead Email, Pixel (website tracking), IDX Integrations, All Integrations (Email marketing, Facebook, Zillow, Dotloop…).
- **Customize** section: Custom Fields, Custom Stages, Tags, Appointment Stages.

### 15.2 Lead Flow & Groups
- **Lead Flow:** configure/test how inbound leads enter and route.
- **Groups:** named distribution groups with `distribution_type` (round-robin | first-to-claim) and members; team members carry group membership (e.g. "Team Ryan, Seller Leads"); groups feed routing.

### 15.3 Ponds (`/2/ponds`)
"Lead Ponds" table: Name (link) · Pond Lead (assignment method) · Team Members (avatars) · Actions (edit/delete). **+ Add Pond**. Shared lead pools members can claim from (1 observed: "Out Of State Home Owners", 3 members).

### 15.4 Team (`/2/teams`)
"3 team members" + **Add Team Members**. Columns: Name (avatar) · Role (Owner/Admin/Agent, dropdown) · Phone · Connected Email (✓ + address) · Connected MLS · Last Seen (Web + iOS) · **Can Export** (checkbox) · **Pause Leads** (checkbox) · Actions (Edit / Delete; Owner has no Delete).
- **Edit Team Member modal:** First/Last Name, Login Email, Phone, **User Merge Field** (template token), **Role**, **Group**, **Notify about all new inquiries** (checkbox). Cancel | Save.
- Roster: Matt Ryan (Owner, 541-213-6706, Can Export ✓), Rebecca Peterson (Admin, 415-308-9087), Paul Stevenson (Agent, 541-977-6841). All "MLS Not connected".

### 15.5 Custom Fields (`/2/custom-fields`)
"**64 Custom Fields**" + **Add Custom Field**. Columns: drag-handle · Field Name · **Type** (Text/Number/Date/Select) · People (populated count) · **Hide if empty** (checkbox) · **Read-only** (checkbox) · Actions (edit/delete). Drag to reorder. High-use fields: Include in FB CAS (7,255 — Facebook Custom Audience Sync flag), Enrichment Provider (5,851), Phone Type (4,843), Realtor License/Type/Brokerage (163 each). Many enrichment/demographic fields defined but empty.

### 15.6 Stages (`/2/stages`)
"Stages" + **Add Stage**. Columns: drag-handle · Stage Name · **People** (count, clickable → filtered list) · Actions (edit/delete). Drag to reorder (order = pipeline meaning). Trash is system-protected (no edit/delete). **The 16 Ryan Realty stages:** Seller Prospect (7,523) · Lead (8,243) · A - Hot 1-3 Months (2) · B - Warm 3-6 Months (0) · C - Cold 6+ Months (46) · Renter - future buyer (0) · Active Client (8) · Pending (0) · Past Client (21) · Sphere (0) · Archive (2) · Closed (0) · Trash (47, protected) · Real Estate Agent (2,342) · Vendor (1) · Nurture (0). Stages drive stage-change automation triggers.

### 15.7 Tags (`/2/tags`)
"**1,486 Tags**" + **Turn on auto-tagging new leads** + Search. Columns: Name (sortable) · **Used** (count, clickable) · Actions (edit/delete). Prefix taxonomy (§17.2): `area:` (area:bend-westside = 7,674), `audience:` (audience:seller = 3,508, audience:buyer, audience:broker-recruit), `auto:` (auto:seller-seq-new, auto:brand-voice-plain-honest), price tiers 1M–5M+, absentee, etc.

### 15.8 Company Settings (`/2/company-settings`)
Form: Company (Ryan Realty) · Industry (Real Estate) · Franchise (Other) · Address (115 NW Oregon Ave. #2, Bend, Oregon 97703) · Country · **Timezone** (Pacific). **Virtual Phone** section: Phone (Manage Settings) · **Fallback number** (541.213.6706) · **Spam label calling protection** (Ryan Realty LLC, Change) · **Call Recording** toggle (ON) · **Legal Disclosure** auto-play toggle (OFF) + "Preview call disclosure" + a legal-requirements callout (all-party consent). **Office Hours** (+ Add). **Subdomain** (ryan-realty.followupboss.com, Change). **Business Insights:** Production Goals 2026 ($1,000,000), Weekly Report Recipients (+ Add Email). **Block List** (emails + phone numbers; Manage). **View Business Registration** link (A2P/10DLC). Save.

### 15.9 API Keys & Lead Email (`/2/api`)
- **API Keys** table: Name · API Key (masked, last-4) · Created · Last Used · Actions (edit/delete). **Create API Key**. Observed: Agent Fire, Zapier, RyanRealtyApp (used 10h ago), CLAUDE COWORK, Ryan Realty LP - Vercel.
- **Connected OAuth Applications** (Name · Consented · Actions) — empty.
- **Lead Email Address:** `ryan.realty@followupboss.me` (+ Copy) — forward-in lead capture for non-Google accounts.
- **Lead Processing:** monitor `matt@ryan-realty.com (google)` inbox for lead notifications (toggle ON) → auto-ingest to FUB.
- **API Usage (30 days, all users):** by system — ryanrealty-web (62,036), Ryan Realty Platform (1,979), ryan realty website (218), ryanrealty (15).

### 15.10 Other admin surfaces
- **Phone Numbers:** add/manage account phone numbers (provisioned virtual numbers for call/text). *(Detail not captured — build to FUB norm: list of numbers, assignment to users, porting/registration status.)*
- **Business Registration:** A2P/10DLC text-messaging brand/campaign registration (gates SMS sending).
- **Email Domain Authentication:** verify sending domain (SPF/DKIM) for deliverability.
- **Pixel:** website tracking script that attributes web activity to contacts (drives web-activity timeline events + return-visit tasks).
- **IDX Integrations / All Integrations:** connect IDX/website provider (AgentFire), Email marketing, Facebook (lead ads + CAS), Zillow, Dotloop, etc.
- **Appointment Stages:** configure appointment types + outcomes (§5.7, §10).
- **Import:** CSV import wizard (upload → map columns → preview/validate → import; history with counts/status). *(Build to the existing in-house import wizard — §19.)*
- **Action Plans / Automations / Email Templates / Text Templates:** covered in §13–14.

**Acceptance criteria for §15:** every config surface is CRUD-complete with the fields above; config tables (stages, tags, custom fields, appointment types) are reorderable and protect system rows; team roles gate permissions; company/comms/legal settings persist and are enforced by send paths; API keys + lead-email + integrations manageable.

---

## 16. Account / user menu

Top-right avatar dropdown: **My Settings · (personal view) · Pause Drips · Product Changes · System Status · Get Help · Log Out.**
- **My Settings:** personal profile, signature, connected email/calendar, notification prefs (inferred).
- **Pause Drips:** global per-user pause of all active drip/automation sequences (high-impact; confirm dialog). 
- **Product Changes / System Status / Get Help:** changelog, status page, help center.

**Acceptance criteria:** account menu with profile/settings, a per-user global drip pause (with confirmation), and help/status links.

---

## 17. Cross-cutting systems

These span modules and are easy to under-build. Treat each as first-class.

### 17.1 Lead routing & assignment
- **Entry points:** Seller/Buyer landing-page form submissions (Seller LP, Home Value), portal leads (Zillow/Realtor.com), the `@followupboss.me` lead-email, Gmail lead-processing ingest, manual Add Person, inbound call/text.
- **On entry:** create/match Person (dedupe by email then phone), write a **LEAD ORIGIN** card (source, page, campaign/UTM, points, tier), assign agent per the routing rule, apply tags, and start the matching automation/action plan.
- **Routing strategies:** default-all-to-one (currently → Matt), round-robin (via Groups), first-to-claim (via Ponds), by-source rules. Per-agent attribution override (e.g. `?agent=rebecca` deep links) is part of the Ryan Realty stack (see CLAUDE.md). 
- **Pause Leads** per agent (Team setting) excludes them from assignment.

### 17.2 Tag taxonomy (prefixed namespacing)
Tags use `prefix:value` namespacing — build the UI to encourage it and the data layer to query it:
- `area:` geographic (area:bend-westside) · `audience:` segment (audience:seller/buyer/broker-recruit) · `auto:` automation-applied (auto:seller-seq-new) · price tiers (1M…5M+) · behavior (absentee, Active Search) · compliance (do-not-text, do-not-call, hard-stop — §17.4).
- "Turn on auto-tagging new leads" applies source/behavior tags on entry.
- Tags are both classification and **filter/segmentation primitives** (smart lists query `tags include/exclude any of`).

### 17.3 Custom fields as a typed, extensible schema
64 fields, types Text/Number/Date/Select, with `hide_if_empty` + `read_only` + display order. They power: detail-sidebar display, smart-list filters/columns, automation conditions, merge tokens, and enrichment writes. The in-house build must keep custom fields **data-driven** (a field-definition registry), not hard-coded.

### 17.4 Compliance & suppression (regulatory — do not under-build)
- **Call recording** + **legal disclosure** (all-party-consent) are account settings enforced on every call.
- **Block list** (emails + phone numbers) blocks inbound/outbound.
- **Compliance tags** (do-not-text, do-not-call, hard-stop) and an explicit **suppression list** must gate **every** send path (email, text, call, bulk, automation). TCPA litigators + DNC are hard-stops (see CLAUDE.md memory `reference_tcpa_litigator_handling`). Unsubscribe + bounce tracking feed suppression.
- **A2P/10DLC business registration** gates SMS; **email domain authentication** gates email deliverability.

### 17.5 Communications layer (multi-channel, two-way)
- **Email:** send from FUB with rendered HTML signature; two-way (sends + ingested replies via Gmail/lead-processing); open/click/bounce/unsubscribe tracking; archived state.
- **Text/SMS:** send from a provisioned number; two-way; "warming up" state for new numbers; segment-aware; click tracking.
- **Calls + voicemail:** click-to-call from rows/detail; inbound routing to assigned agent + Company inbox; recording + transcript; call logs in Reporting.
- All channels write to the **one unified timeline** + the Inbox. Channel-specific last-contact dates are tracked separately (last_email/text/call, last_received_email, last_bounced).

### 17.6 Web activity & attribution (Pixel)
The Pixel attributes site visits to contacts → **web-activity timeline events** ("Lead viewed/returned to website. Follow up now."), which can **auto-create call tasks** and drive engagement scoring. UTM/campaign attribution is captured on the lead-origin card and flows through to the Marketing UTM report (lead-source → appointment → deal). AgentFire IDX widget surfaces portal/property activity on the contact.

### 17.7 Permissions & roles
Owner > Admin > Agent. Gates: record visibility (own vs. all — e.g. "Everyone" vs "Me" filters), `can_export`, admin access, delete rights (Owner undeletable), and notification scope (`notify_all_new_inquiries`). Smart lists have their own visibility (private / shared-all / shared-selected). Collaborators grant per-contact visibility across the own/all boundary.

### 17.8 Enrichment & integrations
Third-party data enrichment populates demographic/property fields (Enrichment Provider field on 5,851 contacts). Integrations: AgentFire (IDX/website), Zapier, Facebook (lead ads + Custom Audience Sync via "Include in FB CAS"), Zillow, Dotloop, plus first-party API keys (RyanRealtyApp, Vercel LP). API usage is metered per system.

---

## 18. End-to-end workflows (acceptance scenarios)

Build the modules so these complete without manual glue.

1. **Seller lead → CMA → nurture.** Seller LP form submit → Person created + matched (dedupe) → LEAD ORIGIN card (source/campaign/tier=hot) → assigned to Matt → tagged `audience:seller` + auto tags → "hot seller LP" call task within 5 min → seller-nurture automation enrolled → agent emails CMA (compose: template + merge + signature + attachment) → timeline logs every touch → stage moves Lead→Active Client → on reply, sequence pauses (stop-on-reply).
2. **Buyer web lead → saved search → drip.** Buyer inquiry → saved-search confirmation email (template) → web-activity events as they browse → return-visit auto-task → "Buyer Long Term Nurture" automation → score rises → agent converts to appointment.
3. **Inbound unknown call.** Call from unmatched number → Company inbox thread (raw number) + voicemail/transcript → assigned agent → "Add person" quick-create → now a routable contact.
4. **Bulk neighborhood farm.** Open a Neighborhood smart list (e.g. Pronghorn) → multi-select → bulk Update Stage / Apply Action Plan / Add Tag / Export → measured in Reporting (Source, Speed-to-Lead, Contact Attempts).
5. **Deal progression.** Create deal in a pipeline → drag Start→Offer→Pending→Closed → commission + close date on the card → Deals report aggregates GCI by stage + source. (Transaction execution lives in Vault — §19.)
6. **Expired-listing campaign.** "All Expireds" smart list (144) → "Ryan Realty - Expired Spring Strategy" automation → tasks + emails/texts → tracked enrolled/completed.
7. **Compliance stop.** A contact tagged do-not-text/hard-stop is automatically excluded from every send (manual, bulk, automation); attempting to text is blocked.

---

## 19. FUB → Ryan Realty in-house build gap map

Ryan Realty already has a substantial in-house CRM under `app/admin/(protected)/crm/` backed by ~30 `crm_*` tables and the `lib/followupboss.ts` integration. This map reconciles each FUB feature against it so the build targets the gap. Status: ✅ covered · 🟡 partial / verify · 🔴 missing.

### 19.1 Data model coverage
| FUB entity (§5) | In-house table | Status |
|---|---|---|
| Person | `crm_people` (+ `crm_contact_points` for phone/email lookup) | ✅ |
| Relationship | `crm_relationships` | ✅ |
| Timeline event | `crm_timeline` (note/email/sms/call/voicemail/web_event/task/stage_change/system) | ✅ |
| Email/Text/Call/Voicemail | folded into `crm_timeline` payloads; Twilio comms layer live | 🟡 verify per-channel fields (opens/clicks/bounces, recording_url) |
| Inbox thread | `crm_conversation_state` (+ timeline) | 🟡 verify folder model (Inbox/Assigned/Drafts/Sent/Closed, My vs Company) |
| Task | `crm_tasks` (+ `crm_task_types`) | ✅ |
| Appointment | `crm_appointments` (+ types/outcomes) | ✅ |
| Deal / Pipeline | `crm_deals` (+ deal-detail columns) | 🟡 two-pipeline Kanban + per-pipeline stages; reconcile vs Vault |
| Stage | `crm_stages` | ✅ |
| Tag | `crm_tags` | ✅ |
| Custom field def | `crm_field_definitions` | ✅ |
| Action Plan / Automation | `crm_sequences` + `crm_sequence_enrollments` + `crm_sequence_triggers` + `crm_automation_rules` | 🟡 unified engine exists; build the **visual editor** + full step palette |
| Template (email/text) | `crm_templates` | ✅ (76 email + 37 SMS imported) |
| Smart List & Collection | `crm_saved_views` (AST filter) | 🟡 has AST; build **collections**, emoji, sharing, column-chooser UI, group-by |
| Pond / Group | `crm_ponds`(+members), `crm_groups`(+members), `crm_assignment_config/rules`, `crm_round_robin_state` | ✅ |
| Suppression / Block | `crm_suppressions`, `crm_blocked_numbers` | ✅ (enforced at send paths) |
| Bulk job / Scheduled send | `crm_bulk_jobs`, `crm_scheduled_sends` | ✅ |
| User / Team | `brokers` (+ crm_active/crm_slug/routing_eligible) | 🟡 build Team admin UI (roles, can_export, pause_leads, last_seen, connected email/MLS) |
| Company/Account settings | — | 🔴 add a settings store (timezone, office hours, virtual phone, call-recording, fallback, production goal, weekly recipients, block list) |
| API key / Integration | — | 🟡 keys live in env; build admin surface only if needed |
| Report subscriptions / Newsletter segments | `crm_report_subscriptions`, `crm_newsletter_segments` | ✅ (beyond FUB) |
| Lead-origin attribution | captured via `crm_timeline` (lead_created kind) + portal intake | 🟡 verify LEAD ORIGIN card parity (campaign/UTM/points/tier) |

### 19.2 UI surface coverage
| FUB screen/module | In-house route | Status |
|---|---|---|
| People list + smart lists | `/admin/crm` | 🟡 build column-chooser, full filter-field picker, group-by, left collections tree, neighborhood lists |
| Person detail | `/admin/crm/[id]` | 🟡 verify all sidebar sections, timeline channel filters + time-range, compose (AI/business-card/counter), full right rail incl. relationships/collaborators/files/action-plan progress |
| Inbox | `/admin/crm/inbox` | 🟡 build folder tree (My/Company, 5 sub-folders), 2-pane reader, unknown-caller add-person, condensed contact rail |
| Tasks | `/admin/crm/tasks` | ✅ (today/overdue/future, types, reminders cron) — verify date-grouping + clear-overdue + agent filter |
| Calendar/Appointments | `/admin/crm/calendar` | 🟡 verify month/week/day + outcomes |
| Deals | `/admin/crm/deals` | 🟡 build Buyers+Sellers Kanban, per-pipeline stages, deal cards (commission/close/people), drag-restage |
| Reporting | (partial: `/admin/crm/health`, broker digest) | 🔴 build the 13 reports (Agent Activity, Calls, Call Logs, Texts, Appointments, Deals, Agent Goals, Source, Speed-to-Lead, Contact Attempts, Closed-by-Source, Batch Emails, Properties, UTM) |
| Action Plans/Automations | `/admin/crm/sequences`, `/sequences/[id]/edit`, `/workflows`, `/approvals` | 🟡 build the **visual flow editor** + full step palette (Time Delay, Send Email, Reassign, Add/Remove Collaborators, Add/Remove Tags, Create Task, Change Stage, Add Note, Conditions); enrolled/completed/% stats; folders + DRAFT safety |
| Email/Text Templates | `/admin/crm/settings` (templates) | 🟡 build folder tree, engagement metric columns, merge-field inserter, share scope, test send |
| Admin Overview hub | `/admin/crm/settings` | 🟡 build tile hub IA |
| Stages / Tags / Custom Fields settings | `/admin/crm/settings/{stages,tags,...}` | ✅ (config tables) — verify drag-reorder + protected rows + people-counts |
| Team settings | `/admin/crm/settings/{brokers,team}` | 🟡 add roles/can_export/pause_leads/edit-modal |
| Ponds / Groups / Lead-flow / Assignment | `/admin/crm/settings/{ponds,groups,lead-flows,assignment}` | ✅ |
| Suppression | `/admin/crm/settings/suppression` | ✅ |
| Areas / Appointment types | `/admin/crm/settings/{areas,appointments}` | ✅ |
| Import wizard | `/admin/crm/import/*` | ✅ (upload → map → preview) |
| Company settings | — | 🔴 add page |
| API/Integrations | — | 🟡 optional admin surface |
| Account menu (Pause Drips, etc.) | — | 🟡 add user menu + global drip pause |

### 19.3 Automation/cron coverage (already live)
`crm-sequence-engine` (5 min), `crm-bulk-worker` (2 min), `crm-auto-enroll` (10 min), `crm-scheduled-sends` (5 min), `crm-market-report-send` (daily), `crm-gmail-sync` (15 min, two-way email), `crm-task-reminders` (hourly), `crm-smart-followups` (daily), `crm-portal-lead-intake` (2 min), `crm-health-check` (daily). These already implement the engine behavior in §13.5 and the comms ingest in §17.5. ✅

### 19.4 Build priority (derived)
1. **🔴 Reporting suite** (§12) — biggest gap; FUB's analytics are central and not yet built.
2. **🟡 Automation visual editor** (§13.2) — engine exists; the builder UI is the gap.
3. **🟡 Deals two-pipeline Kanban** (§11) — reconcile with Vault as system-of-record for executed transactions.
4. **🟡 People power-features** (§6.4) — column chooser, full filter-field picker, group-by, collections tree.
5. **🟡 Inbox folder model + unknown-caller flow** (§8).
6. **🟡 Person-detail parity** (§7) — compose extras, full right rail, all sidebar sections.
7. **🔴 Company settings + 🟡 Team admin + account menu** (§15.4, §15.8, §16).
8. **🟡 Templates folders + metrics + merge UI** (§14).

> **Vault note:** Per Ryan Realty policy, **Vault is the system of record for executed transactions** — the CRM Deals module is the pre-close/active **pipeline** view (lead→contract→pending), not the transaction file. Keep CRM deals lightweight and reconcile closings against Vault, never SkySlope.

---

## 20. Appendix A: screen-by-screen index

Maps each source screenshot to its module/feature. Full per-screen detail: `docs/fub-crm-analysis/batch-NN.md`.

| Screens | Module / feature |
|---|---|
| 001–008 | Person detail — base thread, **Merge sending person**, **Add relationship**, **Stage** dropdown, **Assigned-to** dropdown, **time-range** filter, full custom-field sidebar, **Select-option** custom field |
| 009–016 | Person detail — email/CMA thread, **LEAD ORIGIN** + **Seller Inquiry** cards, action-plan steps, **Apply Automation** modal, compose with branded **signature**, **Continue Sending** state |
| 017–024 | Person detail — compose (Follow Up / AI Writing / Business Card / Counter), **Edit Phone Numbers**, CMA email read, lead-routing tooltip, drip thread, **Collaborators** modal, 2nd contact thread; **Inbox** 2-pane reader |
| 025–032 | **Inbox** Assigned/Sent/Closed/Company (voicemail + add-person); **Tasks** Overdue (248); **Deals** Buyers + Sellers Kanban; **Reporting** hub |
| 033–040 | **Admin** Overview hub, **Automations** list (36), **Automation editor** + Send-Email step config, **Stages** (16), **Tags** (1,486), **Company Settings** |
| 041–048 | Company Settings (phone/office-hours/subdomain/goals/block-list), **API** settings + usage, **Custom Fields** (64), **Text Templates** list + preview, **Email Templates** list + edit |
| 049–056 | **Ponds**, **All People** list (876), empty smart list, Person detail (Grant Hardgrove), **Team** roster + **Edit member** modal, **Pronghorn** smart list + 8 bulk row-actions |
| 057–064 | Pronghorn bulk tag/assign/**Export** modals, **Manage Lists & Collections** (148), row context menu (Edit/Duplicate/Move/Delete), **Save New Smart List** modal, **Move Smart List** modal |
| 065–072 | **Warm/Bi-Weekly** + **All Expireds** smart lists — full **filter-field picker**, **Stage** filter editor, channel-specific comm fields, **Group by** (Agent/Portal/Connections) |
| 073–079 | All Expireds **Column Chooser**, **All People** activity view, agent **profile popover**, **Add Person** modal, **account menu** (My Settings/Pause Drips/Product Changes/System Status/Get Help/Log Out) |

---

## 21. Appendix B: non-functional requirements & build notes

- **Scale:** ~18K+ contacts, 1,486 tags, 148 smart lists, 64 custom fields, high comm volume (62K+ web API calls/30d). Paginate/virtualize all lists; cache smart-list counts; index the communication-derived fields heavily used by filters (last_*_at, stage, tags, source, agent).
- **Smart-list filter engine:** a boolean AST over the full field set with operators `includes/excludes any of`, `is (not) empty`, `more than N days`, `since {date}`. Already modeled in `crm_saved_views.ast`; expose the visual builder (§6.4).
- **Unified timeline** is the spine: every channel + system event writes one `crm_timeline` row with a `dedupe_key`. The Inbox and Person detail are views over it.
- **Compliance is non-negotiable:** every send path (manual, bulk, scheduled, automation) checks suppression + block list + compliance tags first. Call recording + all-party disclosure honored. A2P/10DLC + domain auth gate channels.
- **Config-driven, not hard-coded:** stages, tags, custom fields, task types, appointment types/outcomes, pipelines/stages, automations, templates are all data. No enums in code for these.
- **Permissions:** enforce Owner/Admin/Agent visibility (own vs all), export, delete, admin at the data layer (RLS / scoped queries), not just the UI.
- **Design system:** all UI built from `@/components/ui/` with Ryan Realty tokens (`design_system/ryan-realty/`); this is an internal admin tool (brand-voice client-copy gate does not apply, design-token gate does).
- **Reuse the existing stack:** the `crm_*` schema, DAL (`lib/data/crm`), and crons already implement most of the engine — build UI and the reporting/visual-editor gaps on top; do not re-architect.
- **Confirm `[illegible]` values** (small-text fields in dense screenshots) against the live FUB account before they gate a decision.

---

*End of specification. Source: 79 screenshots (`FUB SCREENS`, 2026-06-30) + per-screen analysis in `docs/fub-crm-analysis/`. Companion: `docs/CRM_REPLACEMENT_BLUEPRINT.md`.*

