# Admin — Company Settings, Team & Roles

This section specifies the two Admin sub-tabs — **Company Settings** (`/2/company-settings`) and **Team** (`/2/teams`) — plus the complete Roles & Permissions system that governs what every user can see and do throughout the CRM. Together these surfaces form the configuration backbone of the account: Company holds the brokerage identity, calling behaviour, office hours, business insights, and compliance controls; Team governs the broker roster, lead-routing availability, export rights, and group membership; the permission matrix enforces those decisions across every other module. A developer who has never opened FUB must be able to build all three from this section alone.

---

## 0. Admin shell (shared across every Admin sub-tab)

### 0.1 Primary navigation bar (dark charcoal, ~48 px tall, full width, fixed)

| Element | Type | Notes |
|---|---|---|
| Grid/app-switcher icon (far left) | Icon button | 3×3 dot grid glyph |
| People | Nav link + icon | Person silhouette |
| Inbox | Nav link + icon | Envelope; red unread badge (count varies) |
| Tasks | Nav link + icon | Checklist |
| Calendar | Nav link + icon | Calendar grid |
| Deals | Nav link + icon | Handshake/dollar |
| Reporting | Nav link + icon | Bar chart |
| **Admin** | Nav link + icon | Gear/wrench; **active state** = teal text |
| Global search | Text input | Rounded pill, placeholder "Search", ~220 px wide |
| Email icon | Icon button | Right cluster |
| Chat/speech icon | Icon button | Right cluster |
| Team/users icon | Icon button | Right cluster |
| Bell notification | Icon button | Red dot badge |
| User avatar | Circular headshot + caret | Matt Ryan photo; "Ryan Realty" label; opens account menu |

### 0.2 Admin sub-navigation tab bar (~40 px tall, white background, full width)

Horizontal scrollable tab row; active tab has a 2 px solid navy underline; inactive tabs are gray. Tabs in exact order (left → right):

1. Overview
2. Lead Flow
3. Groups
4. **Team**
5. Action Plans
6. Automations
7. Ponds
8. Email Templates
9. Text Templates
10. Import
11. Custom Fields
12. Stages
13. Phone Numbers
14. Tags
15. Integrations
16. **Company**
17. API
18. More ▼ (overflow dropdown; Appointments, Billing, and any additional tabs here)

Far right of tab bar (outside scroll group): **"? How [Section] works"** — ghost button, question-circle icon + blue text; changes label per active tab (e.g. "How Company works", "How Teams work"). Opens a help video modal (title bar + 🔍 icon + × close + inline video; dismissible via × or Escape key).

### 0.3 Loading pattern

Every sub-tab click clears the content area immediately and shows a small animated spinner (~24 px) at center. The tab underline moves optimistically before content loads. No skeleton screens — just spinner + blank. (Inferred: upgrade to skeleton loading in the in-house build for perceived performance.)

---

## 1. Company Settings (`/2/company-settings`)

### 1.1 Purpose

Account-level brokerage identity, virtual phone configuration, office hours, subdomain, business performance goals, and compliance/block-list controls. One admin-only form; changes affect all team members.

### 1.2 Layout

Centered white card (~60 % viewport width, left-weighted), on a light gray background (`#f0f2f5` approx). Two-column form: **labels at left (~30 % of card)**, **inputs at right (~70 % of card)**. Sections divided by all-caps center labels flanked by horizontal rules (e.g. `VIRTUAL PHONE`, `OFFICE HOURS`, `SUBDOMAIN`). Page scrolls vertically; a **Save** button sits at bottom-right of the card.

Card header row:
- **Left:** ⚙ gear icon + "Company Settings" heading (~18 px, semibold, dark)
- **Right:** "View Business Registration" — pill button, light green background, green text; navigates to the A2P/10DLC registration status page (see §1.11)

### 1.3 Form — Section 1: Basic company info

All fields are inline-editable; Save commits the whole form.

| Row | Label | Control type | Ryan Realty value |
|---|---|---|---|
| 1 | Company | Text input | `Ryan Realty` |
| 2 | Industry | Select dropdown | `Real Estate` |
| 3 | Franchise | Select dropdown | `Other` (other options: major franchise networks — KW, RE/MAX, Coldwell Banker, etc.) |
| 4a | Address | Text input (line 1) | `115 NW Oregon Ave.` |
| 4b | (suite/unit) | Text input (line 2) | `#2` |
| 5 | City | Text input | `Bend` |
| 6 | State | Text input | `Oregon` |
| 7 | Zipcode | Text input | `97703` |
| 8 | Country | Select dropdown | `United States` |
| 9 | Time zone | Select dropdown | `Pacific Time (GMT-07:00)` — stored as TZ identifier e.g. `America/Los_Angeles`; GMT offset updates dynamically for DST |

### 1.4 Form — Section 2: VIRTUAL PHONE

Section introduced by the `VIRTUAL PHONE` all-caps horizontal-rule divider.

| Row | Label | Control | Notes |
|---|---|---|---|
| 10 | Phone ⓘ | Pencil/edit icon + "Manage Settings" blue link | Actual number NOT displayed inline; clicking the pencil opens the phone provider editor; "Manage Settings" navigates to the Phone Numbers admin sub-tab or a calling-configuration page |
| 11 | Fallback number ⓘ | Text input | `(541) 213-6706` — the number calls route to when no agent is available; stored as US formatted phone |
| 12 | Spam label calling protection | Plain text + blue "(Change)" inline link | Displays `Ryan Realty LLC`; clicking `(Change)` opens a modal/inline editor to update the legal entity name registered with carriers for STIR/SHAKEN spam protection (per FUB docs: first 15 characters of legal business name from Business Registration; US numbers only; auto-activated once Business Registration is Fully Registered; no extra cost) |
| 13 | Call Recording ⓘ | Toggle switch + label | **ON (green)** — "Enable call recording for team members"; master switch; per-user override available in Edit Team Member (per FUB docs: Team Inbox calls are ALWAYS recorded regardless of per-user setting) |
| 14 | Legal Disclosure ⓘ | Toggle switch + label | **OFF (gray)** — "Automatically play call recording disclosure for all calls"; when ON, an automated audio disclosure plays at call start; Oregon is a two-party consent state — enabling is strongly advised |
| 15 | (Preview call disclosure) | Dark circular play button (▶) + "Preview call disclosure" text label | Sub-element of Legal Disclosure row; plays the audio disclosure recording in-browser via hidden HTML5 `<audio>` element; a thin scrubber bar shows playback position |

**Legal Requirements info box** (below the Legal Disclosure toggle row):
- Blue-bordered, light-blue background info panel
- **Bold heading:** `Legal Requirements for call disclosure`
- **Body text (exact transcription):** "In some states and jurisdictions it is legally required to obtain the consent of all parties involved in a conversation before a recording is made. Consent may be obtained by notifying all parties at the beginning of the call that it will be recorded. When this feature is disabled, the notification that the call is being recorded will not be played automatically at the beginning of a call."
- Static; not interactive

### 1.5 Form — Section 3: OFFICE HOURS

Section header: `OFFICE HOURS` all-caps center label flanked by thin horizontal rules.

| Column | Content |
|---|---|
| Left (description) | "Specify the days and times your team can receive incoming calls to your team inboxes" |
| Right (action) | `+ Add office hours` — blue link; **empty state** (no office hours configured) |

**Empty state:** `+ Add office hours` link only — no rows. Clicking opens an inline form or modal to define one block: day-of-week checkboxes + start-time picker + end-time picker. Multiple blocks can be added (e.g., Mon–Fri 8 am–6 pm, Sat 9 am–12 pm).

**Populated state (inferred):** Each office-hours block renders as a row with day label, time range, and a delete/remove control. Office hours affect **inbound calling routing only** — outbound calling is unaffected (per FUB docs). After-hours options when hours are set: forward to voicemail or forward to a specified external number.

**After-hours text queuing (per FUB docs):** FUB does NOT send initial autoresponder texts between 9 pm – 8 am (agent's local time). Queued messages send at 8 am. Auto-cancelled if any contact event (text/email/call) occurs before 8 am. Manual cancel available from the lead timeline. Action Plan emails bypass this restriction and send immediately; texts do not.

### 1.6 Form — Section 4: SUBDOMAIN

| Column | Content |
|---|---|
| Left | "Change the subdomain of your account" |
| Right | `ryan-realty.followupboss.com` (plain text) followed by `(Change)` blue inline link |

Clicking `(Change)` opens a confirmation modal warning that the subdomain change affects all user login URLs and integrations; requires explicit text input of the new prefix + Confirm. The `/2/` URL path uses a numeric account ID, not the subdomain — only the login URL changes.

### 1.7 Form — Section 5: BUSINESS INSIGHTS

| Row | Label | Control / Value |
|---|---|---|
| Production Goals `{year}` | `Production Goals 2026` | `$1,000,000` displayed in blue link color → click enters inline edit mode (number/currency input + save/cancel); label year is computed from current year at render time |
| Weekly Report Recipients ⓘ | `Weekly Report Recipients` | `+ Add Email` blue link — **empty state** (no recipients); clicking opens inline email input; multiple addresses form a chip list with per-chip × remove; ? tooltip explains the weekly report contents |

### 1.8 Form — Section 6: BLOCK LIST

| Column | Content |
|---|---|
| Left | "Set which emails and phone numbers you want to block" |
| Right | `Manage block list settings` — blue navigation link; goes to a dedicated block-list sub-page where email addresses and phone numbers are added/removed |

Block list entries prevent those addresses/numbers from creating new leads or sending communications in from that source.

### 1.9 Save button

Blue filled pill button (`Save`), bottom-right of the form, ~36 px height. Persists all directly-editable inline fields: address block, fallback number, call recording toggle, legal disclosure toggle, and production goals. Settings that use separate modal/link flows (Office Hours, Subdomain, Spam label, Block List, Weekly Recipients) save through their own flows and are NOT covered by this Save button.

Success state (inferred): a brief toast notification confirms save. No hard page reload required.

### 1.10 "View Business Registration" button

Teal/green outlined pill, top-right of card. Opens the A2P/10DLC registration sub-page. Business Registration is the SMS compliance gateway:

**Registration status values (per FUB docs):**

| Status | Badge color | Meaning |
|---|---|---|
| Not Started | — | Form not yet submitted |
| Submitted to FUB | Yellow | FUB internal review in progress |
| Passed FUB, Under Carrier Review | Yellow | Submitted to US carriers for approval |
| Rejected by FUB | Red | Business info/website needs correction; resubmit |
| Rejected by Carriers | Red | Carrier declined; correct and resubmit |
| Fully Registered | Green | Fully approved; texting enabled |

**Registration requirements (per FUB docs):**
1. Valid EIN (Employer Identification Number from IRS)
2. Legal business name, address, and details matching IRS records exactly
3. Website with opt-in consent language on the primary contact form
4. Privacy policy stating collected phone numbers are not shared for marketing
5. SMS Terms and Conditions covering: appointment confirmations, cancellation (STOP keyword), support (HELP keyword), carrier disclaimers, message rate notices

**Key facts:** One registration per account covers all team members and all phone numbers. Additional numbers added later automatically inherit the existing registration. Review takes approximately 48 hours (longer if info is incomplete). US accounts only (Canadian accounts have a separate process).

### 1.11 Data entities touched

**`company_settings` table (one row per account):**

| Field | Type | Value / Notes |
|---|---|---|
| `company_name` | string | "Ryan Realty" |
| `industry` | enum/select | "Real Estate" |
| `franchise` | enum/select | "Other" |
| `address_line_1` | string | "115 NW Oregon Ave." |
| `address_line_2` | string | "#2" |
| `city` | string | "Bend" |
| `state` | string | "Oregon" |
| `zipcode` | string | "97703" |
| `country` | enum/select | "United States" |
| `time_zone` | string (IANA TZ) | "America/Los_Angeles" |
| `virtual_phone_number` | string/phone | managed via phone provider (not stored inline) |
| `fallback_number` | string/phone | "(541) 213-6706" |
| `spam_label_entity` | string | "Ryan Realty LLC" (legal entity, ≤15 chars used by carriers) |
| `call_recording_enabled` | boolean | true |
| `legal_disclosure_auto_play` | boolean | false |
| `legal_disclosure_audio_url` | string (URL) | pre-recorded disclosure audio |
| `office_hours` | `OfficeHoursBlock[]` | `{ days: DayOfWeek[], start_time: string, end_time: string }` — currently empty |
| `subdomain` | string | "ryan-realty" |
| `production_goal` | number (currency) | 1000000 — annual goal in dollars |
| `production_goal_year` | integer | 2026 (current year) |
| `weekly_report_recipients` | `string[]` (emails) | currently empty |
| `block_list` | managed separately | see block-list sub-page |

**`business_registration` table:**

| Field | Type |
|---|---|
| `status` | enum: not_started / submitted_to_fub / passed_fub_under_carrier_review / rejected_by_fub / rejected_by_carriers / fully_registered |
| `ein` | string |
| `legal_business_name` | string |
| `registered_address` | jsonb |
| `website_url` | string |
| `submitted_at` | timestamp |
| `approved_at` | timestamp |

### 1.12 Acceptance criteria — Company Settings

1. Saving the basic company info fields (name, address, timezone, etc.) persists them and re-displays the updated values without page reload.
2. Fallback number field accepts US-formatted phone `(NNN) NNN-NNNN` and rejects non-phone strings.
3. Call Recording toggle ON/OFF saves and is enforced on the calling layer; per-user call recording overrides remain operative below this master switch; Team Inbox calls always record regardless.
4. Legal Disclosure toggle ON enables autoplay of `legal_disclosure_audio_url` at call start; "Preview call disclosure" plays the same file in-browser.
5. "Manage Settings" link navigates to the Phone Numbers admin sub-tab.
6. Spam label `(Change)` opens an edit modal; the new legal entity name is saved to `spam_label_entity` and truncated to 15 characters for carrier registration.
7. "+ Add office hours" opens a form; saved blocks appear as rows with day/time labels and remove controls; multiple blocks allowed.
8. Subdomain `(Change)` shows a warning modal before saving; changing it does NOT break existing session cookies but does change login URLs for all users.
9. Production Goals value updates inline on click; the year label reflects current year at render time.
10. "+ Add Email" for Weekly Report Recipients creates a chip; each chip has a × remove; chips persist after Save.
11. "Manage block list settings" navigates to a dedicated block-list management page.
12. "View Business Registration" navigates to the registration status page with the correct status badge.
13. All Company Settings are admin/owner-only (Agents and Lenders cannot access this tab).

---

## 2. Team (`/2/teams`)

### 2.1 Purpose

Add, edit, and delete team members; assign roles and groups; control lead-routing availability, export rights, and call-recording permissions per user.

### 2.2 Layout

Centered content container (~700–800 px wide, horizontally centered on a light gray background). No card elevation — content sits directly on the background.

**Content header row:**
- Left: "3 team members" — plain gray text, ~14 px, dynamically reflects current count
- Right: `+ Add Team Members` — filled teal/primary pill button, white text

**Below header:** Team members data table (full container width, no pagination for 3-member roster).

**Bottom of page:** small horizontal scrollbar pill indicating the table can scroll right (rightmost columns Can Export, Pause Leads, Actions are partially clipped at default viewport).

Help link: "? How Teams work" — question-circle icon + blue text, top-right of the admin sub-nav strip.

### 2.3 Table — column specifications

| # | Column header | Rendering | Notes |
|---|---|---|---|
| 1 | Name | Avatar (36 px circle) + **Name** (semibold ~14 px, dark) + email below (gray ~12 px, truncated with ellipsis) | No sort; no filter within table |
| 2 | Role | "Owner" (plain text, no dropdown) OR dropdown select with ▾ caret ("Admin ▾" / "Agent ▾") | Owner role is immutable and shows no dropdown; Admin/Agent roles are inline-editable |
| 3 | Phone | Phone handset icon + `(NNN) NNN-NNNN` formatted number | |
| 4 | Connected Email | Email icon + truncated address + blue ✓ (verified/connected) + teal 🔄 sync icon | ✓ = OAuth authorized; 🔄 = ongoing sync healthy; if sync broken, 🔄 would show in red/error state (inferred) |
| 5 | Connected MLS | "Not connected" (gray) or MLS ID string | All three Ryan Realty brokers show "Not connected" |
| 6 | Last Seen | Two stacked sub-rows: 🌐 Web: [relative time] / 🍎 iOS: [relative time] | Globe icon = browser session; Apple logo = iOS app session; both tracked separately |
| 7 | Can Export | Checkbox (16×16 px) | Owner pre-checked; Admin/Agent default unchecked; inline auto-save on toggle (no Save button) |
| 8 | Pause Leads | Checkbox (16×16 px) | All unchecked (leads flowing); inline auto-save |
| 9 | Actions | "Edit" link [+ "Delete" link for non-Owner] | Both blue text links, no underline at rest |

Column headers: ~12–13 px gray, slightly lighter weight. Some headers wrap to 2 lines (e.g. "Can / Export", "Pause / Leads"). No sort controls or column resize.

Row height: ~56–64 px (avatar + two text lines). Row separators: 1 px `#e2e8f0` light gray. No bulk-select checkboxes.

### 2.4 The three-broker roster (Ryan Realty exact values)

| Field | Matt Ryan | Rebecca Peterson | Paul Stevenson |
|---|---|---|---|
| Display Name | Matt Ryan | Rebecca Peterson | Paul Stevenson |
| Email (truncated) | `matt@ryan-realty...` | `rebeccapeterson...` | `paul@ryan-realty...` |
| Full email (inferred) | `matt@ryan-realty.com` | `rebeccapeterson@ryan-realty.com` | `paul@ryan-realty.com` |
| Role | Owner (no dropdown) | Admin ▾ | Agent ▾ |
| Phone | (541) 213-6706 | (415) 308-9087 | (541) 977-6841 |
| Connected Email | `matt@ryan-r...` ✓ 🔄 | `rebeccapete...` ✓ 🔄 | `paul@ryan-r...` ✓ 🔄 |
| Connected MLS | Not connected | Not connected | Not connected |
| Last Seen Web | ~6 minutes ago | ~4 months ago | ~5 months ago |
| Last Seen iOS | ~an hour ago | ~15 days ago | ~4 months ago |
| Can Export | ✅ checked | ☐ unchecked | ☐ unchecked |
| Pause Leads | ☐ unchecked | ☐ unchecked | ☐ unchecked |
| Actions | Edit | Edit · Delete | Edit · Delete |

### 2.5 Role inline dropdown behavior (Admin ▾ / Agent ▾)

Clicking the ▾ caret on a non-Owner role opens an inline dropdown with available role options. Role change saves immediately on selection (optimistic PATCH, no intermediate Save button). Observed roles: Owner, Admin, Agent (+ Lender available per FUB docs but not shown in this account).

**Owner row:** No ▾ caret. Owner role is immutable from the table. Cannot be changed without an ownership transfer (see §3.6).

### 2.6 Can Export checkbox behavior

- Toggling fires an immediate PATCH to the user record — no separate Save.
- Owner has this checked by default; Admin and Agent are unchecked by default.
- Granting export to a non-Owner means they can download contact data; their scope is limited to records their role permits them to see.
- **Per FUB docs:** Whenever any non-owner exports, the **account owner receives an email notification** with the exporter's name, timestamp, and record count. This must be implemented as an export-audit hook.
- Export = CSV download (60+ columns: name, dates, stage, lead source, 6 email/phone/address fields each, property info, 50 recent calls/texts/notes, custom fields, up to 4 relationships).

### 2.7 Pause Leads checkbox behavior

- Toggling fires an immediate PATCH — no separate Save.
- When checked: the lead-routing engine skips this agent for new lead assignment.
- **Routing fallback when paused (per FUB docs):**
  - Lead Flow Groups → other active group members
  - First-to-Claim groups → paused user gets no notifications, cannot claim
  - Advanced Lead Flow → goes to Default Rule agent; if all agents are paused, goes to account owner
- **Bypass exception:** Leads assigned directly via API are NOT affected by Pause Leads — API assignment overrides all distribution rules.
- Use case: agent is on vacation or temporarily unavailable.

### 2.8 "+ Add Team Members" button

Opens an invite modal (inferred, not directly captured). Fields:
- Name (first + last, or full name)
- Email (used as login email)
- Phone number
- Role (dropdown)

System sends an email invitation to the new member; their row may appear in a "Pending" state until accepted. **Billing impact (per FUB docs):** A pro-rated charge confirmation screen appears before finalizing — each added seat incurs a cost.

**Bulk import option** available for larger teams (not shown in this account's UI flow).

### 2.9 "Delete" action link

Available for non-Owner members only (Rebecca Peterson and Paul Stevenson). Clicking opens a confirmation modal:

**What happens to each data type when a user is deleted (per FUB docs):**

| Data Type | Outcome |
|---|---|
| Leads/Assignments | Immediately reassigned; a tag with the deleted agent's name is auto-applied to those leads |
| Appointments | Remain on lead profiles; new agent NOT auto-added (manual review recommended) |
| Notes, call logs, texts, shared emails | Remain on lead profiles permanently |
| Scheduled emails | Will NOT be sent |
| Email/text templates | **Deleted** — recreate before removing user |
| Deals | Agent removed; deal stays on contact for admin access |
| Tasks (manual + action plan) | Transfer to newly assigned agent |
| FUB phone number | Released; calls/texts route to account owner for **30 days** then number is permanently deleted |
| Shared Smart Lists | Remain if shared before deletion |

Deletion requires: Owner or Admin. Process: Admin > Teams > select user > Delete > choose reassign-to agent > confirm.

**30-day phone grace period** must be implemented as a deferred number-release queue in the in-house build.

### 2.10 "Edit" action link → Edit Team Member modal

Available for all three members including the Owner. Clicking opens a centered white modal overlay (~480 px wide, 6–8 px border radius, full-page semi-transparent gray scrim `rgba(0,0,0,0.4)` behind it).

**Modal header:**
- Icon: person/user-edit silhouette with pencil overlay, ~16 px, dark gray
- Title: "Edit Matt Ryan" (or whichever member) — bold ~18 px
- × close button: top-right corner, gray, dismisses without saving

**Modal body — form fields (top to bottom):**

| Row | Label | Control | Ryan Realty value (Matt Ryan) |
|---|---|---|---|
| 1 | First Name | Text input (~50 % width, left) | `Matt` |
| 1 | Last Name | Text input (~50 % width, right) | `Ryan` |
| 2 | Login Email | Text input (full width) | `matt@ryan-realty.com` |
| 3 | Phone Number | Text input (full width) | `5412136706` — stored as raw digits without formatting (no dashes/dots); display formatting applied in UI layer |
| 4 | User Merge Field ⓘ | Text input (full width) | (empty for Matt Ryan) — optional; a free-form string inserted into email/text templates via `{{agent.merge_field}}` merge tag; ? tooltip explains usage |
| 5 | Role | Select dropdown (~50 % width, left) | `Owner` — for Owner row, this field is functionally read-only (no in-place demotion without ownership transfer); for Admin/Agent rows: editable dropdown with Owner/Admin/Agent options |
| 5 | Group | Multi-select tag/pill input (~50 % width, right) | `Team Ryan, Seller Leads` — rendered as a comma-separated pill or a single group with that exact name; clicking opens a multi-select dropdown of all available groups; user can be added/removed from multiple groups |
| 6 | (checkbox) | Checkbox + label + ⓘ tooltip | "Notify about all new inquiries in Follow Up Boss" — **unchecked** for Matt Ryan; when enabled, this user receives a notification for every new lead/inquiry entering the account regardless of assignment |

**Modal footer:**
- Left: `Cancel` — ghost button (white background, gray border, dark text, ~4–6 px radius)
- Right: `Save` — filled primary pill button (teal/navy, white text, ~20 px radius)

**Clicking outside the modal / scrim:** does NOT dismiss (inferred — FUB prevents accidental abandonment of partially-filled forms). Only × or Cancel dismiss without saving.

**On Save:**
- PATCH to the user record
- Modal dismisses on success; table row reflects updated values
- On validation error: inline error messages below offending fields (inferred)
- Changing Login Email may trigger a re-verification email to the new address

### 2.11 Data entities touched

**`users` / `team_members` table:**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid / integer | internal user ID |
| `account_id` | FK | account 2 = Ryan Realty |
| `first_name` | string | |
| `last_name` | string | |
| `login_email` | string, unique | |
| `phone_number` | string (digits only) | "5412136706" — no formatting stored |
| `user_merge_field` | string, nullable | custom free-form for template merge tags |
| `role` | enum | `owner` \| `admin` \| `agent` \| `lender` |
| `avatar_url` | string (URL) | circular profile photo |
| `can_export` | boolean | default: true for owner, false for others |
| `pause_leads` | boolean | default: false |
| `call_recording_enabled` | boolean | per-user override of account-level recording setting |
| `notify_all_inquiries` | boolean | notify on every new lead regardless of assignment |
| `last_seen_web_at` | timestamp | last browser session |
| `last_seen_ios_at` | timestamp | last mobile app session |
| `connected_email` | string, nullable | the connected Gmail/Outlook address |
| `email_connected` | boolean | OAuth authorized |
| `email_sync_active` | boolean | ongoing sync healthy |
| `connected_mls` | string, nullable | MLS credentials / ID — null = "Not connected" |
| `invite_status` | enum | `active` \| `pending` (invite sent, not yet accepted) |

**`groups` / `routing_groups` table:**

| Field | Type |
|---|---|
| `id` | integer |
| `name` | string ("Team Ryan", "Seller Leads") |
| `distribution_type` | enum: `round_robin` \| `first_to_claim` |
| `member_ids` | FK array → users |
| `type` | "Agents" or "Lenders" |

**Join table:** `user_groups` (user_id, group_id) — many-to-many.

### 2.12 Acceptance criteria — Team

1. Team list renders all team members with all 9 columns; dynamically reflects current count ("N team members").
2. Owner row shows "Owner" as plain text with no dropdown caret; no Delete link.
3. Admin/Agent rows show role as inline dropdown; selecting a new role saves immediately via PATCH; no intermediary Save step.
4. Can Export checkbox saves immediately on toggle; account owner receives an email audit notification when any non-owner exports.
5. Pause Leads checkbox saves immediately; paused agents are excluded from all lead routing with the documented fallback cascade (group → default rule → owner); API-assigned leads bypass pause.
6. Last Seen shows two sub-rows (Web + iOS) with relative timestamps; timestamps are computed client-side from UTC timestamps.
7. "Edit" opens the Edit modal for the correct member; all 8 form fields pre-populated with current values.
8. Editing Login Email requires re-verification at the new address before the change takes effect (inferred).
9. User Merge Field empty string and null both render as an empty input; templates using `{{agent.merge_field}}` for a user with no value render nothing (not an error).
10. Group multi-select shows all available groups; selecting/deselecting saves on modal Save.
11. "Notify about all new inquiries" checkbox saves on modal Save; when enabled, user receives notification for every new account-wide lead.
12. Delete opens a confirmation modal with lead-reassignment options; confirms the outcomes (auto-tag, 30-day phone grace period, template deletion, etc.).
13. "+ Add Team Members" opens an invite flow; sends invitation email; new member appears in "Pending" state until accepted; billing confirmation shown before finalizing.
14. Lender role change requires delete + re-add (no in-place role switch from/to Lender — per FUB docs; implement UI warning if attempted).
15. Table scrolls horizontally when viewport is narrow enough to clip rightmost columns.

---

## 3. Roles & Permissions

### 3.1 Base roles (all plans)

| Role | Quantity constraint | Key characteristics |
|---|---|---|
| **Owner** | Exactly 1 per account | Full billing + billing-only access; can do everything; the sole person who can transfer ownership, cancel, or delete the account; cannot be deleted or demoted without an ownership transfer |
| **Admin** | Unlimited | Full contact access; team management; can delete leads; **cannot** access Billing or Webhooks |
| **Agent** | Unlimited | Assigned leads only; cannot delete leads; limited to own pipeline, tasks, calendar, reporting |
| **Lender** | Unlimited | Assigned leads only; cannot delete leads; limited reassignment (can only change the assigned agent, not the lender); lender activity does NOT appear in reports; optional email connection; cannot access ponds |

### 3.2 Platform-plan-only roles (defer but reserve in schema)

| Role | Scope |
|---|---|
| ISA / Account Team Lead | ALL leads + ponds in the account; can assign leads to groups & ponds; NO admin access |
| Team Lead | All leads assigned to members of THEIR sub-team and those leads' collaborators; cannot assign leads to groups (only to ponds their team members belong to) |
| Account Lender (Platform) | All leads assigned to their lender team members; all deals |

### 3.3 Collaborators (not a role — a per-lead join record)

- Any user can be added as a collaborator on a specific lead (via lead profile or mass actions).
- Collaborators can perform any action an assigned agent/lender can on that lead and can view shared emails.
- Collaborators do **not** receive automatic notifications for lead activity — only notified when: (a) lead contacts them directly, (b) @mentioned in a note, (c) assigned a task.
- Action Plans can auto-assign collaborators to incoming leads.
- When a collaborator becomes the assigned agent, they are automatically removed as a collaborator.
- Implement as a `lead_collaborators` join table (`lead_id`, `user_id`), not as a role change.

### 3.4 Full permissions matrix

| Capability | Owner | Admin | Team Lead (Platform) | ISA / Acct TL (Platform) | Agent | Lender |
|---|---|---|---|---|---|---|
| Billing management | **Owner only** | ✗ | ✗ | ✗ | ✗ | ✗ |
| Export database (enable for others) | **Owner only** | ✗ | ✗ | ✗ | ✗ | ✗ |
| Custom stages / fields | **Owner only** | ✗ | ✗ | ✗ | ✗ | ✗ |
| Appointment types & outcomes | **Owner only** | ✗ | ✗ | ✗ | ✗ | ✗ |
| Power-up activate/deactivate | Owner (most) | Some | ✗ | ✗ | ✗ | ✗ |
| Phone number porting | **Owner only** | ✗ | ✗ | ✗ | ✗ | ✗ |
| Webhooks | **Owner only** | ✗ | ✗ | ✗ | ✗ | ✗ |
| Team management (add / edit / remove users) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Delete leads | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| View/edit ALL contacts | ✓ | ✓ | Team leads only | All leads | Assigned only | Assigned only |
| Import contacts | All contacts | All contacts | Personal only | Personal only | Personal only | Personal only |
| Groups/Ponds (create/edit/delete) | ✓ | ✓ | View assigned | View assigned | View assigned | ✗ (no pond access) |
| Automations (create/edit/delete/share) | ✓ | ✓ | View only | View only | View only | View only |
| Deals | All + pipelines | All | Team deals | All deals | Personal only | Personal only |
| Reporting | All reports | All reports | Team reports | Team reports | Personal only | None |
| Tasks | All team | All team | Team-assigned | All team | Personal only | Personal only |
| Calendar (if shared) | All | All | Team | All | Personal | Personal |
| Create/manage API keys | ✓ | ✓ | Default off | Default off | Default off | Default off |
| Add lead sources | ✓ | ✓ | ✓ (if ISA) | ✓ | ✗ (if lockdown) | ✗ (if lockdown) |
| Phone number management | Full (with add-on) | Full | Personal only | Personal only | Personal only | Personal only |

### 3.5 Lender-specific restrictions (per FUB docs)

- Lenders can only change the **assigned agent** on a lead; they cannot reassign the lead to another lender.
- Lenders' activity does NOT appear in reports.
- Lenders cannot access ponds (first-to-claim distribution unavailable).
- Lenders cannot receive admin privileges even if upgraded to Agent — requires delete + re-add as agent.
- Email connection is optional ("some lenders skip it for security reasons").
- Calling/texting require the calling add-on.
- Enforce Google/Microsoft Sign-In power-up **excludes lenders** — they can still log in via username/password even when the power-up is active.

### 3.6 Changing account owner (per FUB docs)

- Only the **current account owner** may request an ownership transfer.
- Process: current owner emails `support@followupboss.com` requesting the transfer.
- Pre-transfer checklist: update all lead source notification emails to new owner, update API keys associated with the account, verify billing info, verify export permissions.
- Requests from admins, agents, or the incoming owner are not processed.

### 3.7 Security & authentication (per FUB docs)

**Two-factor authentication:**
- 2FA is **mandatory for all accounts** — cannot be disabled.
- Method: location-based email verification ("New Follow Up Boss Login Attempt" email sent to user's registered address).
- Process: login from new device/browser → system sends email → user clicks single-use verification link **from the same device** → selects "Click here to continue" → session established.
- Each verification link is single-use; expired tokens require restarting the login.

**Password requirements:**
- Minimum length: **10 characters**
- Must combine: words, symbols, numbers, uppercase and lowercase letters
- Password reset link validity: **10 minutes** (must restart if expired)

**Login methods:**
- Username/password (email + password)
- Google sign-in (OAuth)
- Microsoft sign-in (OAuth)
- If **Enforce Google/Microsoft Sign-In** Power-Up is active: all users **except lenders** must use Google/Microsoft; username/password login is blocked

**Force logout (remote session revocation):**
- Any user can remotely disconnect their own mobile sessions via: profile image > My Devices > locate device > Remove.
- Takes effect immediately (terminates mobile app session).

**Data security (per FUB docs):**
- All data encrypted in transit (HTTPS/SSL) and at rest (encrypted at write time).
- Backups: continuous (every second) with 35-day retention + weekly database backups kept indefinitely.

### 3.8 Power-Ups (owner/admin-activatable features)

| Power-Up | Who Enables | Plan Required | Effect |
|---|---|---|---|
| Agent Action Plans | Owner/Admin | Standard | Agents can create/manage own action plans |
| Agent Automations | Owner/Admin | Standard | Agents can build automations |
| Agent Owned Lead Duplication | Owner/Admin | Pro & Platform | Agent-owned lead deduplication |
| Appointment Reminder Texts | Owner/Admin | Standard | Automated appointment reminder texts |
| Blur Mode | Owner/Admin | Standard | Blurs contact info on screen |
| Read Only Stage Management (Beta) | Owner/Admin | Standard | Restricts who can change lead stages |
| Call From | Owner/Admin | Pro & Platform | Controls outbound caller ID options |
| Call Recording Disclosure | Owner/Admin | Standard | Plays automated disclosure before calls |
| Call Recording, Transcripts & Summaries | Owner only | Standard | Records calls; generates AI transcripts |
| Disable Batch Emailing | Owner/Admin | Standard | Prevents agents from sending batch emails |
| Lead Source Lockdown | Owner only | Pro & Platform | Restricts lead source editing to Owner/Admin/ISA |
| Enforce Google/Microsoft Sign-In | Owner only | Pro & Platform | Forces OAuth login; disables username/password (except lenders) |
| API Key Restrictions | Owner (contact support to activate) | Standard | Turns off default API key creation for all users; owner grants per-user; revoking deletes all existing user keys immediately |
| Assign Smart List Collections | Owner/Admin | Standard | Assign smart list collections to users |

Power-Ups are managed at: profile image/initials > Power-Ups. Features requiring higher tiers show a yellow plan badge; tiers without the feature cannot enable it.

### 3.9 In-house build implementation notes

**Role system:**
- Implement `role` as an enum on the `users` table: `owner` | `admin` | `agent` | `lender` (+ platform-tier roles: `isa` | `team_lead` | `account_team_lead` | `account_lender` — defer activation behind a feature flag).
- Enforce exactly one `owner` row per account at the database level (unique partial index on `role = 'owner'` per `account_id`).
- Role change from/to `lender` requires delete + re-add semantics; block in-place ALTER with a UI warning.
- Lender exclusion from Enforce SSO must be hardcoded by role check.

**Collaborator:**
- Implement as `lead_collaborators` join table (`lead_id`, `user_id`, `added_at`, `added_by`).
- Trigger: when collaborator's `user_id` is set as the lead's `assigned_agent_id`, auto-delete from `lead_collaborators`.

**Can Export:**
- `can_export` boolean per user row.
- Export scope is role-scoped (agents export only their visible records).
- Audit log: on every export, write `export_audit` row (user_id, timestamp, record_count, export_type) and fire email notification to owner.

**Pause Leads:**
- `leads_paused` boolean per user row.
- Lead distribution routing checks this flag with the documented fallback cascade.
- API-assigned leads must bypass the pause check entirely.

**Call Recording:**
- `call_recording_enabled` boolean per user row (default: false).
- Account-level toggle (`company_settings.call_recording_enabled`) gates whether per-user settings are consulted.
- Team Inbox calls: always record regardless of per-user setting — separate recording flag in the call-routing path.

**After-hours text queuing:**
- Queue table for outbound SMS with `send_at` computed from agent's `time_zone`.
- Window: 9 pm – 8 am agent local time.
- Auto-cancel: monitor for any contact event (text/email/call) before 8 am → cancel queued messages for that lead × agent pair.
- Manual cancel endpoint.
- Action Plan emails: exempt from after-hours queuing; send immediately.

**Security / auth:**
- Mandatory location-based 2FA: email verification link, single-use token, 10-minute TTL.
- Password minimum: 10 characters.
- Password reset link: 10-minute TTL.
- Per-device session tracking for mobile force-logout (`user_sessions` table with `device_id`, `revoked_at`).

**30-day phone grace period after user deletion:**
- Implement a `deferred_phone_releases` table: `user_id`, `phone_number`, `release_at` (now + 30 days).
- A daily cron checks `release_at <= now()` and permanently removes the number.
- During the 30-day window, calls/texts to that number route to the account owner.

---

## 4. Component map (for the in-house build)

All styling follows the Ryan Realty design system (navy `#102742` / cream `#faf8f4`, Geist body, Amboqia display). Use `@/components/ui/*` shadcn/ui components for every element. FUB's blue/teal maps to `bg-primary` / `text-primary-foreground`. This is an internal admin tool; the §0.5 brand-voice client-copy gate does not apply, but design tokens do.

```
<AdminPage>
  <PrimaryNavBar activeItem="admin" />  {/* see §03 spec */}

  <AdminSubNav activeTab="company | team">
    {/* 18 tabs in exact order listed in §0.2 */}
    <HelpContextLink />  {/* "How [Section] works" — changes per active tab */}
  </AdminSubNav>

  {/* ---- COMPANY SETTINGS ---- */}
  <CompanySettingsPage>
    <SettingsCard>
      <CardHeader icon="gear" title="Company Settings">
        <Button variant="success-outline">View Business Registration</Button>
      </CardHeader>

      <TwoColumnForm>
        {/* §1.3 Basic info rows */}
        <FormRow label="Company"><Input /></FormRow>
        <FormRow label="Industry"><Select /></FormRow>
        <FormRow label="Franchise"><Select /></FormRow>
        <FormRow label="Address"><Input /><Input /></FormRow>
        <FormRow label="City"><Input /></FormRow>
        <FormRow label="State"><Input /></FormRow>
        <FormRow label="Zipcode"><Input /></FormRow>
        <FormRow label="Country"><Select /></FormRow>
        <FormRow label="Time zone"><Select /></FormRow>

        <SectionDivider label="VIRTUAL PHONE" />

        <FormRow label={<>Phone <Tooltip /></>}>
          <EditIcon /><Link>Manage Settings</Link>
        </FormRow>
        <FormRow label={<>Fallback number <Tooltip /></>}><Input /></FormRow>
        <FormRow label="Spam label calling protection">
          Ryan Realty LLC <InlineChangeLink />
        </FormRow>
        <FormRow label={<>Call Recording <Tooltip /></>}>
          <Switch /><Label>Enable call recording for team members</Label>
        </FormRow>
        <FormRow label={<>Legal Disclosure <Tooltip /></>}>
          <Switch /><Label>Automatically play call recording disclosure for all calls</Label>
          <AudioPreviewButton label="Preview call disclosure" />
        </FormRow>
        <InfoBox variant="info">
          <strong>Legal Requirements for call disclosure</strong>
          <p>In some states and jurisdictions...</p>
        </InfoBox>

        <SectionDivider label="OFFICE HOURS" />
        <FormRow description="Specify the days and times...">
          <AddLink>+ Add office hours</AddLink>
          {/* populated: OfficeHoursBlock list */}
        </FormRow>

        <SectionDivider label="SUBDOMAIN" />
        <FormRow description="Change the subdomain of your account">
          ryan-realty.followupboss.com <InlineChangeLink />
        </FormRow>

        <SectionDivider label="BUSINESS INSIGHTS" />
        <FormRow label={`Production Goals ${year}`}>
          <EditableValue format="currency" value={1000000} />
        </FormRow>
        <FormRow label={<>Weekly Report Recipients <Tooltip /></>}>
          <AddLink>+ Add Email</AddLink>
          {/* populated: chip list */}
        </FormRow>

        <SectionDivider label="BLOCK LIST" />
        <FormRow description="Set which emails and phone numbers you want to block">
          <NavLink href="/admin/settings/block-list">Manage block list settings</NavLink>
        </FormRow>
      </TwoColumnForm>

      <FormFooter><Button variant="primary">Save</Button></FormFooter>
    </SettingsCard>
  </CompanySettingsPage>

  {/* ---- TEAM ---- */}
  <TeamPage>
    <TeamHeader>
      <span>{count} team members</span>
      <Button variant="primary">+ Add Team Members</Button>
    </TeamHeader>

    <Table>
      <TableHeader>
        <Th>Name</Th><Th>Role</Th><Th>Phone</Th>
        <Th>Connected Email</Th><Th>Connected MLS</Th><Th>Last Seen</Th>
        <Th>Can Export</Th><Th>Pause Leads</Th><Th>Actions</Th>
      </TableHeader>
      <TableBody>
        {members.map(m => <TeamMemberRow member={m} />)}
      </TableBody>
    </Table>

    {editing && (
      <Dialog>
        <DialogHeader>Edit {member.name}</DialogHeader>
        <DialogBody>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>First Name</Label><Input /></div>
            <div><Label>Last Name</Label><Input /></div>
          </div>
          <Label>Login Email</Label><Input type="email" />
          <Label>Phone Number</Label><Input />
          <Label>User Merge Field <Tooltip /></Label><Input />
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Role</Label><Select disabled={isOwner} /></div>
            <div><Label>Group</Label><MultiSelect /></div>
          </div>
          <div className="flex gap-2">
            <Checkbox /><Label>Notify about all new inquiries in Follow Up Boss <Tooltip /></Label>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button variant="primary">Save</Button>
        </DialogFooter>
      </Dialog>
    )}
  </TeamPage>
</AdminPage>
```

---

## 5. Cross-references

- **§03 — App Shell & Shared UI Patterns:** primary nav bar, admin sub-nav, modal pattern, loading states
- **§04 — Data Model:** `users` / `team_members` entity (§5.2), `company` / account entity (§5.9), `groups` entity
- **§17 — Lead Routing:** Pause Leads feeds directly into the routing fallback cascade (§17.1)
- **§21 — Gap Map:** Company settings are `🔴 missing` in-house (needs a settings store); Team admin UI is `🟡 partial` (roles/can_export/pause_leads/edit-modal need build); permissions gate is partially implemented via `brokers` table

---

## Sources

| Source | Coverage |
|---|---|
| shot-40.md (Company Settings, top half) | All §1.3 basic company info fields + virtual phone section fields + exact Ryan Realty values |
| shot-41.md (Company Settings, bottom half) | All §1.5–1.9 sections: office hours / subdomain / business insights / block list / save button + legal requirements callout exact transcription |
| shot-53.md (Team list) | §2.3 column specs, all 3 broker rows, exact phone numbers, Can Export/Pause Leads states, actions per role |
| shot-54.md (Edit Team Member modal) | §2.10 exact modal field labels, Phone Number raw value `5412136706`, Group value "Team Ryan, Seller Leads", Notify checkbox state, modal layout |
| admin1.md (GIF — Admin Overview + Lead Flow + Team) | §2 dynamic behaviors: inline role dropdown ▾, dual Web+iOS Last Seen, Can Export/Pause auto-save, Owner immutability, GIF frame-by-frame verification of all 3 broker rows |
| admin3.md (GIF — Company Settings + API) | §1 confirmed all Virtual Phone fields in motion; Virtual Phone "Manage Settings" link navigation target; Company loading state |
| admin4.md (GIF — Billing + Phone Numbers + more) | §1 office hours interaction confirmed ("+ Add office hours" pattern), subdomain Change flow, admin tab overflow pattern |
| fub-docs/account-team-billing.md | §3 entire roles & permissions matrix, lender restrictions, collaborator semantics, Pause Leads fallback cascade, Can Export audit email, delete-user data outcomes, 30-day phone grace period, 2FA spec, password requirements, Spam Label Protection docs, Business Registration status enum + requirements, Power-Ups table, After-hours text queuing rules, Changing account owner process, API Key Restrictions power-up |
| FUB_CRM_FEATURE_SPEC.md §15.4 (prior spec — Team) | Base roster; corrected: prior spec lacked exact phone raw storage format, Group name, User Merge Field state, dual Last Seen, modal field order |
| FUB_CRM_FEATURE_SPEC.md §15.8 (prior spec — Company) | Base fields confirmed; corrected: prior spec omitted Legal Requirements callout text, legal disclosure audio preview control, block list "Manage" link target, office hours after-hours sub-behavior |
| FUB_CRM_FEATURE_SPEC.md §17.7 (prior spec — Permissions) | One-line summary; fully replaced by §3.4 permission matrix and §3.7–3.9 implementation notes sourced from official docs |
