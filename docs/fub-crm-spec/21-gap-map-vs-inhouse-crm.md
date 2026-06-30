# FUB → In-House CRM Gap Map & Build Priority

<!-- Section 21 of the FUB CRM spec. Source: live code audit of the in-house CRM (2026-06-30). Supersedes §19 of the prior single-file spec. -->

> **How to use this section.** This is the bridge from the FUB feature spec (sections 02–20) to the in-house CRM that already exists. Each FUB module above maps to a concrete in-house route, table set, and library. Build the gap, not the whole thing twice. Statuses: ✅ built · 🟡 partial · 🔴 missing · ⚪ not applicable. The Build Priority at the end is the recommended cutover sequence. **Canonical person-detail surface is `/admin/console/leads/[id]` (the Lead Command Center), not the `/admin/crm/[id]` redirect shim.**

# FUB → In-House CRM Gap Audit
**Date:** 2026-06-30  
**Source:** Code audit of `app/admin/(protected)/crm/**`, `app/api/cron/crm-*`, `app/api/admin/crm*`, `lib/crm/**`, `lib/data/crm/**`, `docs/DATABASE_SCHEMA_SNAPSHOT.md`, `docs/FUB_CRM_FEATURE_SPEC.md §19`.  
**Method:** Read actual route files, component imports, schema tables, and lib functions. Corrects §19 of `FUB_CRM_FEATURE_SPEC.md` where it is wrong or stale (noted inline).

---

## Feature Area Assessments

---

### 1. People List + Columns + Bulk Actions
**Status:** 🟡 Partial

**Route:** `/admin/crm` → `app/admin/(protected)/crm/page.tsx`  
**Tables:** `crm_people`, `crm_stages`, `crm_tags`, `crm_saved_views`  
**Key lib:** `listCrmPeople()` (in `app/actions/crm`), `buildCrmPeopleQuery.ts`, `bulk-helpers.ts`, `crm-bulk-worker` cron  
**Components:** `BulkAssignWrapper`, `ContactsSearch`, `SavedViewSidebar`, `InstantFilterSelect`, `BrokerScopeSheet`

**What's built:**
- Paginated contacts list (50/page) with search, stage filter, broker filter, tag filter
- Bulk actions via `BulkAssignWrapper`: assign broker, change stage, add/remove tag, enroll in sequence, bulk-email-cohort, set report area, export
- Select-all-matching (server-side resolution via `crm_bulk_jobs`)
- CSV export at `/api/admin/crm/export`
- My-Leads / All-Contacts scope toggle, broker RBAC (superuser sees all, restricted brokers see own)
- KPI overview strip (total, sellers, buyers, hard-stops, open tasks)

**Gap vs FUB:**  
No **column chooser** (FUB lets users add/remove/reorder columns like Last Activity, Source, Stage, Tags, Custom Fields). No **group-by** (group contacts by stage/source/tag). The right-hand filter panel covers stage + agent but not the full FUB filter-field picker (missing: source, last-activity date range, tag multi-select, custom-field conditions, price range). Column count on people table is hardcoded (name, stage, source, email, phone, tags, agent, last activity, created).

**§19 correction:** §19 flags "build column-chooser, full filter-field picker, group-by, left collections tree, neighborhood lists" — still accurate. The collections tree (sidebar) is `SavedViewSidebar` which shows smart lists but not grouped **Collections** like FUB's Pipeline / Neighborhoods / Smart Loop hierarchy.

---

### 2. Smart Lists, Collections, Filter/AST Engine, Column Chooser, Group-By
**Status:** 🟡 Partial

**Route:** `/admin/crm?view=<id>` (inline in people list), sidebar in `SavedViewSidebar`  
**Tables:** `crm_saved_views` (columns: id, name, description, filter, sort, shared, owner, position, created_at, ast, owner_email, is_shared, is_protected, updated_at — 14 cols per schema snapshot)  
**Key lib:** `lib/crm/segment-ast.ts` (AST evaluator), `lib/data/crm/getSavedViewSegment.ts`, `lib/data/crm/getCrmSavedViews.ts`

**What's built:**
- AST-based filter engine in `segment-ast.ts` supporting: stage, tags-any/all/none, broker, source, has_email, has_phone, search-text, custom-field conditions
- `crm_saved_views` table with `ast` jsonb column — the filter is serialized as an AST not raw SQL
- SavedViewSidebar shows smart lists as a flat list with live counts, grouped by system/own/shared
- CRUD for saved views (create from active filter, rename, delete)
- Share/visibility toggle (`is_shared`)

**Gap vs FUB:**
- No **Collections** (FUB organizes smart lists into named, reorderable collection folders — Pipeline, Neighborhoods, Smart Loop, etc.)
- No **column chooser** (which columns appear in the contacts table when a view is active)
- No **group-by** (group rows under stage/source headers)
- No per-view **emoji** (FUB lists show an emoji icon per smart list)
- No **Manage Lists** page (FUB `/2/people/manage-lists` for bulk reordering, moving lists between collections, toggling visibility)

---

### 3. Person Detail (Sidebar, Timeline, Compose, Right Rail, Relationships, Collaborators, Merge/Dedup, Custom Fields)
**Status:** 🟡 Partial

**Route:** `/admin/crm/[id]` → redirects to `/admin/console/leads/[id]` (the Lead Command Center, built 2026-06-15)  
**Route file:** `app/admin/console/leads/[id]/page.tsx`  
**Tables:** `crm_people`, `crm_timeline`, `crm_tasks`, `crm_appointments`, `crm_relationships`, `crm_field_definitions`, `crm_report_subscriptions`, `crm_templates`, `email_events`  
**Key lib:** `getCrmPersonFull()`, `getContactActivityFeed.ts`, `getContactConversation.ts`, `getContactRelationships.ts`, `getContactEmailEngagement.ts`, `getContactBehaviorSummary.ts`, `getContactListingAlerts.ts`, `getContactMemberships.ts`  
**Components:** `ConversationFeed`, `EmailComposer`, `SmsComposer`, `OwnedHomeCard`, `ViewedHomeCard`, `CustomFieldsPanel`, `ReportSubscriptionsPanel`, `RelationshipsPanel`, `ContactListingAlertsPanel`, `ContactEmailEngagement`, `ContactBehaviorPanel`, `ContactQuickActions`

**What's built:**
- Full identity sidebar (name, stage pill, source badge, broker assignment, tags add/remove, background/notes)
- Unified timeline via `crm_timeline` (email in/out, SMS in/out, calls, notes, stage changes, web events, system events)
- Multi-channel compose: `EmailComposer` (template picker, merge, signature) + `SmsComposer` (template picker)
- Click-to-call via `startCrmCallAction`
- Tasks (add, complete inline)
- Relationships panel (`RelationshipsPanel` + `crm_relationships`)
- Custom fields panel (all `crm_field_definitions` rendered with inline edit)
- CMA shortcut: `startCmaForContactAction` / `sendCmaForContactAction`
- Market report subscription: `ReportSubscriptionsPanel`
- Owned home match card (`OwnedHomeCard`), viewed listings (`ViewedHomeCard`)
- Listing alerts panel (`ContactListingAlertsPanel`)
- Email engagement stats (`ContactEmailEngagement` from `email_events`)
- Activity feed (`getContactActivityFeed`)

**Gap vs FUB:**
- No **collaborators** UI (FUB has an Add Collaborators modal; `crm_relationships` exists but no collaborators-grant-visibility feature is wired)
- No **merge/dedup** UI (merge sending person, or dedup two contacts via modal — `renderCrmMerge` is imported but there's no merge trigger UI on the page)
- No **action-plan progress** in the right rail (FUB shows enrolled plan steps "1 of 4 complete" on the person record; `crm_sequence_enrollments` exists but no right-rail widget)
- No **financing block** (lender, loan type, pre-approval, monthly budget — these live as custom fields but FUB surfaces them as a dedicated sidebar section)
- No **files** tab on person (file attachments per person — FUB has per-person file uploads)

**§19 correction:** §19 maps this to `/admin/crm/[id]` — the actual canonical surface is now `/admin/console/leads/[id]`. The old route is a redirect shim. §19's partial status is correct but understates completeness: this is closer to 85% complete.

---

### 4. Inbox (Folders, Thread Reader, Unknown-Caller Add-Person, Team Inbox)
**Status:** 🟡 Partial

**Route:** `/admin/crm/inbox` → `app/admin/(protected)/crm/inbox/page.tsx`  
**Tables:** `crm_conversation_state`, `crm_timeline`, `crm_people`  
**Key lib:** `getInboxQueue.ts`, `getConversationThread()`, `getSendTarget.ts`, `crm-gmail-sync` cron (15-min), `crm_conversation_state` (status: unread/read/closed)  
**Components:** `InboxQueue`, `InboxThread`, `InlineReply`, `ThreadStatusControl`

**What's built:**
- 4-pane desktop layout: folders rail | conversation list | reading pane | contact context panel
- Mobile: full-screen thread or list (back-chevron nav)
- Folder scopes: Mine / Unread / All / Closed (4 tabs in rail)
- "Company / All brokers" link in the folders rail
- Inline reply composer (email + SMS tabs with signature)
- Per-conversation status control (mark read/unread/closed)
- Bulk triage action
- Mark-all-read button
- `crm-gmail-sync` cron writes inbound email to `crm_timeline` and updates `crm_conversation_state`

**Gap vs FUB:**
- No **Assigned** sub-folder (FUB: My Inbox > Inbox / Assigned / Drafts / Sent / Closed — 5 sub-folders; in-house has 4 flat scopes, no Assigned)
- No **Drafts** folder (FUB: can save a compose draft; in-house has no draft state)
- No **Sent** folder (FUB: all sent messages browseable as a folder; in-house shows sent items in the person timeline but not as an inbox folder)
- No **unknown-caller "Add Person" flow** (FUB: an inbound call/text from an unmatched number appears in Company inbox as a raw thread; inline "Add person" quick-creates a contact — this is not wired; inbound Twilio from unknowns does create a lead but the inbox surface doesn't show raw unmatched threads)
- The contact context rail (pane 4) is minimal (name, channels, link to full record) — FUB's pane 4 shows stage, source, tags, last 3 notes, quick-change stage/agent

---

### 5. Tasks (Today/Overdue/Future, Types, Recurring, Reminders)
**Status:** 🟡 Partial

**Route:** `/admin/crm/tasks` → `app/admin/(protected)/crm/tasks/page.tsx`  
**Tables:** `crm_tasks`, `crm_task_types`  
**Key lib:** `getTaskQueue.ts`, `task-lifecycle.ts`, `crm-task-reminders` cron (hourly)  
**Actions:** `addCrmTaskAction`, `completeCrmTaskAction`, `updateCrmTaskAction`, `reassignCrmTaskAction`, `snoozeCrmTaskAction`, `deleteCrmTaskAction`, `bulkCompleteTasksAction`

**What's built:**
- 4 views: today / overdue / upcoming / completed
- Task types (configurable via `crm_task_types`)
- New task dialog with contact search, type, due date, notes
- Complete/snooze/reassign/delete per task
- Bulk complete selected tasks
- Auto-open new-task dialog from query param `?new=1`
- Hourly reminder cron (`crm-task-reminders`)
- Broker scope (agents see own tasks, superuser sees all + agent filter)

**Gap vs FUB:**
- No **recurring tasks** (`crm_tasks` has no recurrence pattern column; FUB supports recurring task creation)
- No explicit **"Clear all overdue"** bulk action (bulk-complete covers it but FUB has this as a dedicated button)
- No date-grouped row separators within upcoming (FUB groups future tasks by date header)

---

### 6. Calendar & Appointments (Calendar UI, Types/Outcomes, Calendar Sync)
**Status:** 🟡 Partial

**Route:** `/admin/crm/calendar` → `app/admin/(protected)/crm/calendar/page.tsx`  
**Tables:** `crm_appointments`, `crm_appointment_types`, `crm_appointment_outcomes`  
**Key lib:** `getAppointments.ts`, `getAppointmentTypes.ts`, `getAppointmentOutcomes.ts`, `lib/google-calendar.ts`  
**Components:** `CalendarGrid`, `AppointmentSheet`

**What's built:**
- Monthly calendar grid (`CalendarGrid`)
- Appointment types + outcomes (configurable, admin settings at `/admin/crm/settings/appointments`)
- Appointment CRUD: create/update/delete via `AppointmentSheet`
- Multi-broker scope (superuser sees all, restricted sees own)
- `gcal_event_id` column in schema + `lib/google-calendar.ts` integration (reads broker GCal events)
- Guest contacts (`guest_person_ids[]`) + invite sent flag

**Gap vs FUB:**
- No **week or day** calendar views (only month)
- **Google Calendar write-sync** (creating an appointment in-house and pushing a GCal event to the broker's calendar): `gcal_event_id` is nullable in schema but `lib/google-calendar.ts` currently only reads events; the write path is not wired

---

### 7. Deals & Pipelines (Buyers/Sellers Kanban, Stages, Deal Detail, Splits, Commission, Reporting)
**Status:** 🟡 Partial

**Routes:** `/admin/crm/deals` (list/board), `/admin/crm/deals/[id]` (detail)  
**Tables:** `crm_deals`, `crm_deal_splits`, `crm_deal_files`  
**Key lib:** `listCrmDeals()`, `getCrmDeal.ts`  
**Components:** `DealHeader`, `DealMilestones`, `DealCommission`, `DealFiles`, `NewDealButton`

**What's built:**
- Static Kanban board rendering (desktop) with deals grouped by pipeline (Buyers/Sellers) and then by stage, colored top-border per stage
- Mobile: flat list of deal rows
- Deal detail: name/address/price/description, milestones (close date, earnest money, mutual acceptance, due diligence, final walkthrough, possession), commission (percent + dollars), splits (`crm_deal_splits`), file attachments (`crm_deal_files`)
- Deal CRUD: `NewDealButton`, `listCrmDeals()`, `getCrmDeal()`
- `crm_deals` has: pipeline, stage, entered_stage_at, value, status, listing_key, close_date, commission_dollars, commission_percent, assigned_broker, property_address

**Gap vs FUB:**
- No **drag-to-restage** (the Kanban board is display-only; FUB drag is the primary stage-change UX)
- No **per-pipeline configurable stages** (stages in `crm_deals` are text strings not joined to `crm_stages`; FUB has separate stage lists per pipeline)
- No **deal reporting** (GCI by stage/source, pipeline velocity — must come from the reporting module, see §8)
- The deals list page (`/admin/crm/deals`) says "Pre-contract pipeline imported from FUB" — signaling it's still a dual-run surface, not fully native yet

**§19 correction:** §19 says "build Buyers+Sellers Kanban, per-pipeline stages, deal cards (commission/close/people), drag-restage." The Kanban and deal detail are built; drag-restage and per-pipeline stages remain.

---

### 8. Reporting (13 FUB Reports + Leaderboard)
**Status:** 🔴 Missing (FUB-specific CRM reports)

**Routes:** `/admin/reports` hub (market + broker tile grid, NOT CRM reporting)  
**What exists:** 
- Market data reports: `/admin/reports/market` (by area), `/admin/reports/custom` (builder), `/admin/reports/brokers` (performance volume), `/admin/reports/leads` (funnel), `/admin/reports/emails` (sent log + open/click/bounce), `/admin/reports/lead-flow`, `/admin/reports/traffic-sources`
- Analytics: `/admin/analytics/*` (funnel, cost-per-lead, listing-performance, ad-ROI, LP-leaderboard, social, meta-health, action-required)
- `/admin/crm/health` (CRM data quality / mirror health, NOT a reporting surface)
- `crm_broker_alerts` table and `getBrokerDigest.ts` / `daily-broker-digest` cron (digest emails)

**Gap vs FUB (all 13 FUB CRM reports are missing):**  
- **Agent Activity** (calls/emails/texts/notes per broker per period)
- **Calls** (call log with duration, outcome, recording)
- **Call Logs** (raw per-call drill-down)
- **Texts** (SMS log per broker)
- **Appointments** (booked/completed/outcomes by broker)
- **Deals** (GCI by stage, pipeline velocity, source-to-deal attribution)
- **Agent Goals** (vs production goal configured in Company Settings)
- **Source** (lead count + deal count by source)
- **Speed-to-Lead** (time from entry to first contact attempt)
- **Contact Attempts** (attempt counts per stage)
- **Closed-by-Source** (revenue by lead source)
- **Batch Emails** (campaign-level open/click/unsubscribe — equivalent in `email_events` but no grouped campaign UI)
- **Properties / UTM / Marketing** (UTM → appointment → deal attribution chain)
- **Leaderboard** (agent ranking by deals/GCI/activity)

**§19 correction:** §19 correctly flags this as 🔴; its "build the 13 reports" priority #1 is still current.

---

### 9. Action Plans / Automations / Sequences (Engine + Editor + Triggers + Enrollment Stats)
**Status:** 🟡 Partial

**Routes:** `/admin/crm/sequences` (list), `/admin/crm/sequences/[id]/edit` (editor), `/admin/crm/workflows` (automation rules), `/admin/crm/approvals`  
**Tables:** `crm_sequences`, `crm_sequence_enrollments`, `crm_automation_rules`  
**Key lib:** `lib/crm/enroll.ts`, `lib/crm/sequence-step-schema.ts`, `lib/crm/conditions-eval.ts`, `getWorkflowAnalytics.ts`, `getWorkflowStepAnalytics()`  
**Crons:** `crm-sequence-engine` (15 min), `crm-auto-enroll` (15 min)  *(corrected 2026-06-30 from vercel.json — both run every 15 min, schedules `13,28,43,58 * * * *` and `4,19,34,49 * * * *`)*  
**Components:** `WorkflowList`, `StepBuilder`, `AutomationRulesManager`

**What's built:**
- `crm_sequences` table: name, status (active/paused), steps (jsonb array), triggers (jsonb array), stop_on_reply, description
- `crm_sequence_enrollments`: per-person enrollment state machine (running/paused/completed/stopped/cancelled/suppressed), step_index, next_run_at, approved_by
- Step types (via `sequence-step-schema.ts`): email, sms, task, delay, add_tag, remove_tag, change_stage, reassign, add_note
- Trigger types: tag_added, stage_changed, source_is, manual
- `StepBuilder` component: ordered step list with per-step config panel (not a visual canvas but a functional builder)
- Trigger configurator in the edit page
- Automation rules (`crm_automation_rules`): simple trigger_type + trigger_value → action_type + action_value (1-step automations, not multi-step sequences)
- Enrollment stats in `getWorkflowAnalytics` / `getWorkflowStepAnalytics` (enrolled total, step funnel counts)
- Approvals queue at `/admin/crm/approvals` (first-touch approval gate before sequence sends)
- Stop-on-reply enforced at engine level
- Suppression gate: every send path checks `crm_suppressions` before executing

**Gap vs FUB:**
- No **visual drag-drop canvas editor** (FUB has a node-graph canvas with a step palette that you drag onto; in-house has a list-based `StepBuilder` which is functional but not the visual flow experience)
- No **branching / condition steps** in the UI (the schema can represent conditions via `AnyStepOrCondition` type but the `StepBuilder` UI doesn't expose branch logic)
- No **folders** for sequences/automations (FUB has "My Automations" folder grouping)
- No explicit **enrolled/completed/% stats column** in the sequences list page (analytics exist in `getWorkflowAnalytics` but are shown per-step in the edit view, not as list-level stats)
- No **delivery preference config per email step** (FUB's Send Email step has: send immediately / 8am–7pm / office hours / custom time — in-house has quiet hours globally but no per-step delivery window)

---

### 10. Email & Text Templates (Folders, Merge Fields, Engagement, Share)
**Status:** 🟡 Partial

**Route:** `/admin/crm/settings/templates`  
**Tables:** `crm_templates` (columns: id, key, channel, name, subject, body, category, is_active, fub_legacy_id, updated_at)  
**Key lib:** `getCrmTemplatesAdmin.ts`, `templateValidation.ts`, `templateVoiceCheck.ts`  
**Components:** `TemplateEditor`

**What's built:**
- CRUD for email + SMS templates (create, edit body, rename, activate/deactivate, delete)
- Category grouping (categories act as loose folders)
- Channel separation (email vs sms tabs)
- Brand-voice gate at save time (`templateVoiceCheck.ts`)
- Usage tracking per template (how many sequences reference it — `usage` field in `getCrmTemplatesAdmin`)
- Engagement metrics present (`perf` field from `email_events` aggregation)

**Gap vs FUB:**
- No **folder tree** (FUB has a proper left folder nav with nested sub-folders; in-house uses flat `category` strings)
- No **merge-field inserter** in the editor UI (FUB has a "+ Merge Field" button that opens a token picker; in-house users must type tokens manually)
- No **share scope toggle** ("Share this template with everyone" — `crm_templates` has no `is_shared` column; all templates visible to superuser only via settings, but no per-template visibility control)
- No **test send** button in template editor
- No **per-template engagement columns** in the list view (opens/clicks/unsubscribes/bounces as columns alongside the template name — data exists in `email_events` but not surfaced in the template list)

---

### 11. Admin Config: Stages, Tags, Custom Fields, Lead Flow, Groups, Ponds, Appointment Stages
**Status:** ✅ Built

**Routes:** `/admin/crm/settings/*` — stages, tags, custom-fields, lead-flows, groups, ponds, appointments, areas  
**Tables:** `crm_stages`, `crm_tags`, `crm_field_definitions`, `crm_assignment_config`, `crm_assignment_rules`, `crm_groups`, `crm_group_members`, `crm_ponds`, `crm_pond_members`, `crm_appointment_types`, `crm_appointment_outcomes`, `crm_report_areas`, `crm_newsletter_segments`  
**Key lib:** DAL functions in `lib/data/crm/getCrmStages.ts`, `getCrmTags.ts`, `getCrmFieldDefinitions.ts`, `getCrmAssignmentConfig.ts`, `getCrmGroups.ts`

**What's built:**
- Stages: full CRUD with drag-reorder (`position`), protected rows (`is_protected`), active/inactive toggle, people-count links
- Tags: CRUD, active/inactive, protected flag (compliance tags immutable), prefix taxonomy enforced
- Custom fields: CRUD, type (text/number/date/select), hide_if_empty, read_only, display order, protected flag, group label
- Lead flows: assignment config (strategy: all_to_one/round_robin), source-based assignment rules
- Groups: round_robin + members, distribution type
- Ponds: CRUD, member management
- Appointment types + outcomes: CRUD with display order
- Newsletter segments + report areas: CRUD

**Gap vs FUB:** Minor. The settings hub at `/admin/crm/settings` tile-links to all sub-pages; FUB's 18-tab admin nav is replicated here. One gap: no **auto-tagging new leads** toggle (FUB has a global switch for applying source/behavior tags on new lead entry — in-house applies tags via `crm-auto-enroll` but has no UI toggle).

---

### 12. Company Settings + Team/Roles/Permissions
**Status:** 🔴 Company settings missing; 🟡 Team partial

**Team route:** `/admin/crm/settings/team`  
**Tables:** `admin_roles` (not a `crm_*` table — columns: id, email, role, broker_id, user_id, created_at, updated_at, can_export, pause_leads, last_seen_at, last_seen_platform), `brokers`  
**Key lib:** `getCrmBrokers.ts`, `setCanExportAction`, `setPauseLeadsAction`

**What's built (team):**
- Team roster from `admin_roles` joined to `brokers`
- Role display (superuser/broker)
- `can_export` toggle (controls whether broker can use CSV export)
- `pause_leads` toggle (excludes broker from lead assignment)
- `last_seen_at` / `last_seen_platform` columns
- Broker profile editing (name, phone, Twilio number) via separate `/admin/crm/settings/brokers` page

**What's missing (team):**
- No **edit-team-member modal** with User Merge Field (FUB's template token for this agent), Group assignment, "Notify about all new inquiries" checkbox
- No **connected email/calendar** status per broker in the team UI
- No **Connected MLS** column
- Role change is not editable from the UI (roles are fixed in `admin_roles`)

**Company settings:** No `crm_company_settings` table exists in the schema. No route. 🔴 Missing entirely. FUB's Company Settings page covers: company name/industry/address/timezone, virtual phone configuration (fallback number, spam protection, call recording toggle, legal disclosure toggle), office hours, subdomain, production goals, weekly report recipients, block list. None of this exists in the in-house system.

**§19 correction:** §19 correctly flags Company settings as 🔴. Team is listed as 🟡 — confirmed.

---

### 13. Communications Layer: Email (Gmail Sync), SMS/Calls (Twilio), Recording, Voicemail
**Status:** ✅ Built (production-verified per MEMORY.md)

**Routes:** `app/api/twilio/voice/route.ts`, `app/api/twilio/inbound-sms/route.ts`, `app/api/twilio/recording/route.ts`, `app/api/twilio/outbound-bridge/route.ts`, `app/api/twilio/voice-complete/route.ts`, `app/api/twilio/status/route.ts`, `app/api/admin/crm/recording/[sid]/route.ts`, `app/api/admin/crm/mms/[messageSid]/[mediaSid]/route.ts`  
**Tables:** `crm_timeline` (email_in/email_out/sms_in/sms_out/call/voicemail kinds), `crm_broker_alerts`, `crm_conversation_state`  
**Key lib:** `lib/crm/gmail.ts`, `lib/crm/twilio.ts`, `lib/crm/twilio-conversations.ts`, `lib/crm/sms-status.ts`  
**Crons:** `crm-gmail-sync` (15 min — ONE-WAY ingest Gmail→`crm_timeline` for all three mailboxes; send-from-CRM is `sendCrmEmail()` in lib/crm/gmail.ts on a separate path, NOT this cron)

**What's built:**
- Gmail: DWD service account, two-way sync for matt@, rebeccapeterson@, paul@ryan-realty.com; inbound email written to `crm_timeline` as email_in, outbound as email_out; signature per mailbox; dedup via `dedupe_key`
- Twilio SMS: inbound via webhook (creates lead if unknown, writes sms_in), outbound via `sendCrmSmsAction`, MMS handling, Twilio Conversations layer (`twilio-conversations.ts`)
- Calls: click-to-call via `startCrmCallAction`, outbound bridge (`outbound-bridge`), recording webhook, call complete webhook writes call/voicemail to `crm_timeline`
- Recording playback at `/api/admin/crm/recording/[sid]`
- Broker alerts via `crm_broker_alerts` + Twilio SMS
- 541.703.3095 ported and A2P verified (per MEMORY.md: "A2P VERIFIED + 541.703.3095 ported")

**Gap vs FUB:**
- **Voicemail transcription** (FUB transcribes voicemails; in-house stores the recording URL in `crm_timeline.payload.recording_url` but transcription is not implemented — the `body` field would be null for voicemails)
- **Call recording consent disclosure** (FUB has a configurable auto-play legal disclosure; in-house has no equivalent UI toggle)

---

### 14. Compliance: Suppression, Block List, Do-Not Tags, A2P/10DLC, Quiet Hours
**Status:** ✅ Built (strongest area of the system)

**Route:** `/admin/crm/settings/suppression`  
**Tables:** `crm_suppressions` (columns: id, person_id, channel, value, reason, source, created_at), `crm_people.tags` (compliance tags stored in-array)  
**Key lib:** `lib/crm/quiet-hours.ts`, `lib/crm/suppression-helpers.ts`, `lib/data/crm/getCrmSuppressions.ts`, `lib/data/crm/getSuppressionSignals.ts`, `lib/data/crm/recordGpcSuppression.ts`

**What's built:**
- `crm_suppressions`: per-channel (email/sms/call) suppression with reason + source; compliance rows (`isCompliance`) are owner-only to lift
- Tag-based suppression: `contact:do-not-text`, `contact:do-not-call`, `compliance:hard-stop` tags gate every send path
- TCPA litigator handling (BatchData `litigator:true` → `compliance:hard-stop` tag — per MEMORY.md)
- GPC (Global Privacy Control) suppression recording
- Quiet hours enforcement (`lib/crm/quiet-hours.ts`) on all outbound SMS
- Suppression admin UI: filter by channel, search by value/person, add/lift with confirm-gate for compliance rows
- Unsubscribe tracking via `resend-webhook.ts` + `email-events.ts` (bounce/unsub events written to `crm_suppressions`)
- A2P/10DLC verified (per MEMORY.md)

**Gap vs FUB:**
- No **block list** as distinct from suppression (FUB has a Company Settings > Block List for raw email addresses and phone numbers that are blocked at account level, separate from per-person suppressions). The in-house system has `crm_suppressions` (person-linked) but no account-level block list table.
- No **call recording toggle** or **legal disclosure** auto-play config (company settings gap — §12)

---

### 15. Integrations + Public API + Pixel/Web-Activity + Enrichment
**Status:** 🟡 Partial

**Routes:** `app/api/visitors/track/route.ts`, `app/api/track/e/click/route.ts`, `app/api/track/e/open/route.ts`  
**Key lib:** `lib/crm/attributed-links.ts`, `lib/crm/portal-lead-parser.ts`, `lib/crm/lead-flow-resolver.ts`  
**Crons:** `crm-portal-lead-intake` (2 min, Meta lead-form + IDX portal intake)

**What's built:**
- Visitor tracking at `/api/visitors/track` — attributes site visits to crm_people by session cookie → writes web_event to `crm_timeline`
- Attributed links (`lib/crm/attributed-links.ts`) — tracked URL generation for email/SMS click attribution
- Open tracking (`/api/track/e/open`) and click tracking (`/api/track/e/click`) for sent emails
- Portal lead intake cron (Meta lead forms, IDX inquiries)
- Agent attribution bridge (`?agent=<slug>` → 90-day cookie → FUB routing override)
- Per-source lead flow resolver (`lib/crm/lead-flow-resolver.ts`)

**Gap vs FUB:**
- No **API key management UI** (FUB has a table of named API keys with create/revoke; in-house keys are env vars)
- No **Integrations settings page** (tile hub linking to Pixel config, IDX, Facebook, Zapier, Dotloop, email-domain auth)
- No **enrichment settings UI** (BatchData writes to `crm_people.custom` jsonb but there is no admin surface for configuring enrichment providers, viewing cost, or triggering re-enrichment)
- No **email domain authentication UI** (SPF/DKIM verification — must be done via Resend dashboard and Cloudflare, not in-app)

---

### 16. Lead Routing/Assignment (Round-Robin, First-to-Claim, Ponds, Source Rules, Portal Intake)
**Status:** ✅ Built

**Route:** `/admin/crm/settings/lead-flows`, `/admin/crm/settings/assignment`, `/admin/crm/settings/groups`, `/admin/crm/settings/ponds`  
**Tables:** `crm_assignment_config`, `crm_assignment_rules`, `crm_round_robin_state`, `crm_groups`, `crm_group_members`, `crm_ponds`, `crm_pond_members`  
**Key lib:** `lib/crm/lead-routing.ts`, `lib/crm/lead-flow-resolver.ts`  
**Crons:** `crm-portal-lead-intake` (2 min)

**What's built:**
- `crm_assignment_config`: strategy (all_to_one / round_robin), default_broker
- `crm_assignment_rules`: per-source overrides (source → broker)
- Round-robin state machine (`crm_round_robin_state`) with lock
- Groups with distribution_type (round_robin) and members
- Ponds (shared lead pools with pond_lead_slug)
- Per-agent attribution override via `?agent=<slug>` URL param
- Pause leads toggle (`admin_roles.pause_leads`) excludes broker from assignment

**Gap vs FUB:** Minor. FUB's "first-to-claim" pond distribution model — where any member can claim a lead from the pond queue — is modeled with `pond_lead_slug` but a full first-to-claim race-condition-safe claim UI is not verified.

---

### 17. Billing/Subscription
**Status:** ⚪ N/A

This is an owned internal tool. No SaaS billing surface needed. FUB charges ~$2,100–2,500/yr for 3 Grow seats; eliminating this is one of the strategic reasons for the replacement. No in-house equivalent to build.

---

### 18. Mobile + Notifications (Broker Alerts, Mobile Parity)
**Status:** 🟡 Partial

**Tables:** `crm_broker_alerts` (columns: id, created_at, broker, to_phone, body, person_id, status, channel, sent_at, error, attempts)  
**Key lib:** `lib/data/crm/getBrokerDigest.ts`  
**Crons:** `daily-broker-digest` (daily, emails + SMS digest to brokers), `crm-task-reminders` (hourly, SMS reminders), `weekly-pipeline-digest`

**What's built:**
- Broker alerts via `crm_broker_alerts` — new-lead SMS to assigned broker's cell via Twilio
- Daily digest email (getBrokerDigest) with pipeline summary
- Weekly pipeline digest cron
- Task reminder SMS (hourly cron fires SMS to broker for overdue tasks)
- The web app is responsive (mobile CSS breakpoints throughout all CRM pages, mobile-optimized layouts e.g. tab bar, sheet components)

**Gap vs FUB:**
- No **native mobile app** (FUB has iOS + Android apps with push notification for new leads and replies)
- No **web push notifications** (no service worker, no Push API, no `Notification` permission flow)
- SMS is the only real-time delivery path for new-lead alerts (FUB push arrives faster and works when the phone is locked)
- No **last-seen (iOS app)** metric (FUB team table shows "Last Seen Web + iOS" per broker — in-house has `last_seen_at` for web but no mobile equivalent)

---

## §19 Correction Summary

The prior §19 gap map in `docs/FUB_CRM_FEATURE_SPEC.md` (captured before 2026-06-30) has these material errors:

| Item | §19 said | Actual (this audit) |
|---|---|---|
| Person detail route | `/admin/crm/[id]` | Route is a redirect shim → canonical is `/admin/console/leads/[id]` (Lead Command Center, built 2026-06-15) |
| Person detail completeness | 🟡 partial | Closer to 85% complete — relationships, custom fields, email engagement, behavior, CMA are all wired |
| Sequence editor | 🟡 "build visual flow editor" | `StepBuilder` (ordered step-list UI) is built; a visual drag-drop canvas is still missing |
| Tasks | ✅ (listed as covered) | Confirmed ✅, but recurring tasks and bulk-clear-overdue are still missing |
| Communications | 🟡 "verify per-channel fields" | Confirmed ✅ production-live; voicemail transcription is the remaining gap |
| Reporting | 🔴 | Still 🔴 — the reporting hub at `/admin/reports` covers market data and some analytics but not the 13 FUB CRM activity reports |
| Deals Kanban | 🟡 "build Kanban" | Kanban is rendered; drag-to-restage is not wired |
| Template sharing | 🟡 | `crm_templates` has no `is_shared` column; team visibility is superuser-only admin surface |

---

## Build Priority

Ordered by business impact on FUB cutover readiness (most blocking first):

### Priority 1 — Reporting suite 🔴
**Gap:** All 13 FUB CRM reports are missing.  
**Build in:** `/admin/crm/reporting` (new route family)  
**Tables:** `crm_timeline`, `crm_tasks`, `crm_appointments`, `crm_deals`, `crm_people`, `email_events`  
**FUB spec:** §12 — Agent Activity, Calls, Texts, Appointments, Deals, Agent Goals, Source, Speed-to-Lead, Contact Attempts, Closed-by-Source, Batch Emails, UTM/Marketing, Leaderboard  
**Why first:** Reporting is the second most-used FUB surface after the contacts list. Matt cannot manage broker performance or prove ROI without it. It's also blocking company settings (production goals) and agent goal tracking.

### Priority 2 — Company Settings page 🔴
**Gap:** No settings store for timezone, office hours, virtual phone, call recording toggle, block list, production goals, weekly digest recipients.  
**Build in:** `/admin/crm/settings/company` (new page + `crm_company_settings` table)  
**FUB spec:** §15.8  
**Why second:** Call recording legal disclosure toggle and quiet-hours office schedule affect compliance. Production goal affects Reporting §1. Block list is a distinct compliance surface (account-level, not per-person suppressions).

### Priority 3 — Deals drag-to-restage + per-pipeline stages 🟡
**Gap:** The Kanban board is display-only. Stage changes require opening deal detail.  
**Build in:** `/admin/crm/deals` — wire drag-and-drop restage + dedicate a stage config per pipeline in `crm_stages` (add `pipeline` column)  
**FUB spec:** §11  
**Why third:** The 20 active deals need a working Kanban to replace the FUB Deals view. Commission tracking and deal reporting flow from this.

### Priority 4 — Automation visual editor (branching + folders) 🟡
**Gap:** `StepBuilder` is a functional list editor but lacks visual canvas, drag-from-palette, and condition/branch steps.  
**Build in:** `/admin/crm/sequences/[id]/edit` — migrate from `StepBuilder` list to a node-canvas (react-flow or equivalent), add Conditions step type  
**FUB spec:** §13.2  
**Why fourth:** The sequence engine is live and running sequences already. The editor gap only matters when agents create or debug complex sequences. Most sequences can be built in the current list UI.

### Priority 5 — Inbox: Assigned folder + unknown-caller add-person 🟡
**Gap:** No Assigned scope, no Drafts, no unknown-caller inline "Add Person."  
**Build in:** `/admin/crm/inbox` — add Assigned as a 5th scope (conversations where `crm_conversation_state.assigned_broker != current_broker`), wire the unknown-caller flow (inbound Twilio from unmatched number → show in a raw-thread state with an "Add person" button)  
**FUB spec:** §8  
**Why fifth:** These are daily-use flows for inbound-heavy operations. The team handles 559 inbox items.

### Priority 6 — Person detail: collaborators + merge/dedup UI + action-plan progress widget 🟡
**Gap:** Collaborators grant (no UI), merge dedup (no modal trigger), sequence progress right-rail widget.  
**Build in:** `/admin/console/leads/[id]` — add Collaborators modal, Merge trigger (search + confirm flow), and an enrollment progress widget reading `crm_sequence_enrollments`  
**FUB spec:** §7.4, §7.5, §13.4  
**Why sixth:** These are power-user features. The base person detail is already strong (85% complete).

### Priority 7 — Template folder tree + merge-field inserter + share scope + test send 🟡
**Gap:** Flat categories vs proper folder tree, no merge-field inserter, no `is_shared` column, no test-send.  
**Build in:** `/admin/crm/settings/templates` — add `folder_id` column to `crm_templates`, build folder nav, add merge-field picker in `TemplateEditor`, add `is_shared` column + toggle, add "Test send" action  
**FUB spec:** §14  
**Why seventh:** Template usability matters but existing CRUD is sufficient for most work.

### Priority 8 — Mobile push notifications 🟡
**Gap:** New-lead alerts arrive via Twilio SMS only; no web push or native app.  
**Build in:** Add service worker + Push API for web push, or explore PWA installation for iOS home-screen  
**FUB spec:** §18 / mobile app  
**Why last:** SMS alerts cover the critical new-lead case. Native app is a larger platform investment.

---

*Audit generated 2026-06-30. All findings are from direct code reads, not inference. Correct §19 of `docs/FUB_CRM_FEATURE_SPEC.md` against this document — it is more current.*
