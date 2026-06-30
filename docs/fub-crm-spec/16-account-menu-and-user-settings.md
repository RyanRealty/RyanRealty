# Account Menu & User Settings

The account menu is a compact avatar-triggered dropdown in the top-right corner of the global navigation bar that gives every logged-in user fast access to their personal settings, connected devices, platform add-ons, product news, and session control. Behind the "My Settings" entry lies the full per-user configuration surface: personal profile, email signature, connected email and calendar accounts, notification preferences across five delivery channels, and calling configuration. The Ryan Realty in-house CRM must replicate all six dropdown items, the complete My Settings panel with every documented sub-section, and the notification matrix exactly — these govern how each broker is reached for new leads, missed calls, and @mentions, which directly affects response times and compliance with TCPA after-hours rules.

Styling maps to the Ryan Realty design system: navy `#102742` / cream `#faf8f4`, Geist for body and UI, Amboqia Boriango for display headings, shadcn/ui `@/components/ui/*` components throughout. FUB's blue/teal/orange palette does not carry over.

---

## 1. Account Avatar Dropdown

### 1.1 Trigger

- **Component:** Circular avatar image of the logged-in user, positioned at the far right of the fixed top navigation bar, immediately after the notification bell icon.
- **Trigger:** Click the avatar image (or a small chevron beside it). A floating dropdown panel opens below the avatar.
- **State when open:** The avatar may show a highlighted ring or pressed state. Clicking outside the panel or pressing Escape closes it.

### 1.2 Dropdown Panel — Exact Items (Shot 79, authoritative)

The panel has a white (`#ffffff`) background, rounded corners (~8px radius), and a drop shadow. It is approximately 180px wide. There are exactly **six** full-width clickable rows, each with a left-aligned line-style icon followed by a text label. No submenus, no destructive red styling, no dividers between items.

| Order | Icon Style | Exact Label | Destination / Action |
|---|---|---|---|
| 1 | Gear / cog outline | **My Settings** | Navigates to the personal settings page (`/settings/me` or equivalent). Full settings panel described in §2. |
| 2 | Phone / device outline | **My Devices** | Navigates to the connected devices panel. Lists registered mobile devices with Send Test Notification and Remove (force-logout) per device. Described in §3. |
| 3 | Lightning bolt outline | **Power-Ups** | Navigates to the Power-Ups management page (account-level feature toggles). Owner-only for most; some admin-enabled. See §4. |
| 4 | Megaphone / speaker outline | **Product Changes** | Opens the FUB changelog / release notes page (external or in-app panel). Read-only. |
| 5 | Info circle (ℹ) outline | **System Status** | Navigates to the external FUB status page (`status.followupboss.com` equivalent). Read-only. Opens in new tab (inferred). |
| 6 | Door / exit outline | **Log Out** | Ends the current session immediately and redirects to the login page. No confirmation dialog. |

> **Prior-spec correction:** The low-res prior spec (§16) listed "Pause Drips", "Get Help", and "(personal view)" as dropdown items. Shot 79 (high-res, authoritative) shows **none of these** are in the dropdown. The correct six items are as listed above. "Pause Drips" is not a top-level avatar dropdown item in FUB; per-contact action plan management is handled on the contact record. "Get Help" does not appear. "My Devices" and "Power-Ups" were entirely absent from the prior spec.

### 1.3 Dropdown States

| State | Behavior |
|---|---|
| Closed (default) | Avatar shows; no dropdown visible. |
| Open | Panel floats below avatar; rest of page is still interactive (no modal backdrop). |
| Item hover | Full-width row receives a light background highlight (inferred: `bg-secondary` / `hover:bg-accent/10`). |
| Loading | If the settings page takes time to load, navigate immediately; show a skeleton loader on the destination page. |

### 1.4 Data Read

- `currentUser.avatarUrl` (or initials fallback) — displayed on the trigger.
- `currentUser.name` — may appear as a header inside the panel (not observed in shot 79 but common pattern; mark inferred).
- `currentUser.role` — used to conditionally display items that require elevated permissions (Power-Ups visibility depends on role; per docs, most Power-Ups are owner-only to enable).

---

## 2. My Settings Panel

### 2.1 Access Path

User avatar dropdown → **My Settings**. Route: `/settings/me` or `/2/account/settings` (inferred from FUB URL conventions; exact route not directly observed).

### 2.2 Layout

Full-page settings view (not a modal). Left rail or tabbed navigation selects the sub-section; main content area shows the form fields for the selected section. All sections listed below.

### 2.3 Sub-sections (per FUB docs §11, authoritative)

#### 2.3.1 Personal Information

| Field | Type | Notes |
|---|---|---|
| Name | Text input | Displayed throughout FUB and used in email/text merge fields (e.g., `{{agent_name}}`). Changing this updates all merge-field renders. |
| Phone (mobile) | Tel input | Personal cell used for: (a) call routing — incoming FUB calls ring this number; (b) SMS notification delivery. Must be a US or Canadian mobile (not VoIP) for calling features. |
| Login email | Email input | Used to log in and receive notification emails, daily hot sheet, and system emails. |
| Time zone | Select dropdown | Agent's local timezone. **Critical:** the after-hours texting quiet window (9 pm – 8 am) is enforced based on **this timezone**, not the account timezone or the lead's timezone (per FUB docs). Enum: standard IANA timezone list. |
| Portrait / avatar image | File upload | Circular crop. Appears in: top-nav avatar, People table Agent column, contact-assigned views, email signatures. |

**Save behavior:** Explicit Save button per section (or auto-save — confirm implementation against FUB behavior; FUB docs note auto-save on the Notifications section specifically).

#### 2.3.2 vCard

| Field | Type | Notes |
|---|---|---|
| vCard preview | Read-only display | Shows the agent's contact card as it appears when shared via text message. |
| Edit vCard | Action button | Opens editor to modify name, phone, email, title, company as they appear in the vCard. Used when agents send their contact info via SMS. |

#### 2.3.3 Email

| Field | Type | Notes |
|---|---|---|
| Connected email account | OAuth connection | Primary email account for two-way sync (sending + receiving tracked emails). Shows provider icon (Google / Microsoft). Status: connected (green) or disconnected (orange). |
| Share Emails toggle | Toggle / Switch | When ON, teammates with appropriate permissions can view emails sent/received on this account for shared leads. |
| Share Calendar toggle | Toggle / Switch | When ON, admins can view this agent's calendar. |
| Email signature | Rich-text editor | HTML email signature appended to all outbound emails. The compose panel (shot 79) pre-populates with this value. |

**Observed signature (Matt Ryan — shot 79, exact transcription):**
- Headshot photo (circular or square, real professional photo)
- **Name:** Matt Ryan
- **Title/Role:** Owner & Principal Broker · Ryan Realty LLC
- **Phone:** 541.703.3095
- **Email:** matt@ryan-realty.com
- **Website:** ryan-realty.com
- **Links:** "Read our Google reviews" · "Oregon Initial Agency Disclosure Pamphlet"
- **Brand statement:** "Building community through authentic relationships and exceptional customer service."
- **Compliance footer (small text):** RMLS membership statement + Equal Housing Opportunity disclosure + boilerplate about solicitation of listings under contract with another broker.

The signature editor must support: inline images (headshot), hyperlinks, multi-column layout, small-text compliance blocks, and HTML passthrough so existing signatures import cleanly.

**Email connection notes (per FUB docs):**
- Lenders may skip email connection for security reasons.
- Disconnecting email stops two-way sync; previously synced emails remain on contact timelines.

#### 2.3.4 Zillow

| Field | Type | Notes |
|---|---|---|
| Zillow profile link | Text input or OAuth | Links the agent's Zillow profile. Availability depends on admin configuration. |

#### 2.3.5 Notifications

This sub-section has two parts: a quick toggle for the Daily Hot Sheet email, and a link/button to the full Notification Settings matrix.

| Field | Type | Notes |
|---|---|---|
| Receive daily hot sheet emails | Checkbox | Opts in/out of the morning digest email. When checked: email sent daily at ~7:00 am in the account's configured timezone (per FUB docs). |
| Manage Notification Settings | Link / Button | Navigates to the full per-event, per-channel notification preferences page (§2.4 below). |

#### 2.3.6 My Number (Calling users only)

Visible only when the FUB Calling add-on is active (included in Pro/Platform plans; $39/user/month add-on on Grow plan per FUB docs).

| Field | Type | Notes |
|---|---|---|
| Personal FUB number | Read-only display | The agent's assigned virtual phone number. Searchable by area code preference during setup. Shown in `(XXX) XXX-XXXX` format. |
| Mute Sound Effects | Toggle | Silences in-browser call sound effects (ringtone, keypad tones). |
| Test Call | Button | Places a test call to verify the agent's setup is working. |

#### 2.3.7 Incoming Calls (Calling users only)

| Field | Type | Notes |
|---|---|---|
| Ring sequence | Radio / Select | Options: "Ring Follow Up Boss only (desktop)", "Ring your number and Follow Up Boss at the same time" (simultaneous), "Ring your number only." |
| Mobile Ring Time | Numeric input or slider | Duration (seconds) before call rolls to voicemail when the agent's mobile is not answered. |
| Voicemail greeting | Audio upload or record | Custom voicemail message played to callers. |

#### 2.3.8 Outgoing Calls (Calling users only)

| Field | Type | Notes |
|---|---|---|
| Outbound number | Select dropdown | Which number displays as caller ID to contacts: personal FUB number or a team inbox number. |
| Calling method | Select dropdown | Desktop browser calling vs. bridged-to-cell-phone method. |

#### 2.3.9 User Merge Field

| Field | Type | Notes |
|---|---|---|
| User merge field | Textarea | Free-form custom text (e.g., personal tagline, secondary contact info) inserted into email/text templates via a merge token (e.g., `{{user_merge_field}}`). Not displayed on the contact profile — for template use only. |

---

### 2.4 Notification Settings (Full Matrix)

**Access path:** My Settings → Notifications → "Manage Notification Settings," OR: Bell icon (upper-right, any page) → Gear icon in notification panel → Notification Settings page.

**Auto-save:** Changes take effect immediately with no Save/Submit button (per FUB docs). Updating one toggle does not reset others.

**Scope:** Per-user only. Changing your settings does not affect any teammate's settings.

#### 2.4.1 Five Delivery Channels

| Channel | Mechanism | Setup required |
|---|---|---|
| **Notification Bell** | In-app bell icon; badge count; blue dot per unread notification | None — always active |
| **Desktop Push** | OS-level browser notification (Chrome/Safari/Firefox) | Must grant browser permission; toggle per event type in settings |
| **Mobile Push** | Native iOS (APNs) or Android (FCM) push notification | FUB mobile app installed + OS-level permission granted |
| **Text (SMS)** | SMS from FUB number `855-672-9077` to agent's personal mobile | Personal mobile phone number must be saved in My Settings → Personal Information |
| **Email** | Sent to the agent's login email address | None — always available for enabled events |

#### 2.4.2 Notification Event Matrix

The Notification Settings page is organized into three sections. Each event row has independent channel checkboxes.

**Section A — Activity** (events for leads assigned to the current user)

| Event | Bell | Desktop Push | Mobile Push | Text | Email |
|---|---|---|---|---|---|
| New lead assigned to you | ✓ | ✓ | ✓ | ✓ | ✓ |
| Lead reassigned to you | ✓ | ✓ | ✓ | ✓ | ✓ |
| Lead inquiry from an existing contact | ✓ | ✓ | ✓ | ✓ | ✓ |
| New text message received | ✓ | ✓ | ✓ | ✓ | ✓ |
| New voicemail received | ✓ | ✓ | ✓ | ✓ | ✓ |
| Missed call (to your FUB number) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Inbox conversation assigned to you | ✓ | ✓ | ✓ | — | — |
| @mention in a note | ✓ | ✓ | ✓ | ✓ | ✓ |
| Lead added to a pond (you are in) | ✓ | ✓ | ✓ | — | ✓ |
| Email opened / clicked by lead | ✓ | ✓ | ✓ | — | — |
| Task assigned to you / task due reminder | ✓ | ✓ | ✓ | — | ✓ |

*Exact default checkmark states per event must be confirmed against the live account. Checkboxes above represent which channels FUB supports per event type — individual user may have some toggled off.*

**Section B — Team Inbox** (events for shared inboxes the user belongs to)

| Event | Bell | Desktop Push | Mobile Push | Text | Email |
|---|---|---|---|---|---|
| New message / voicemail / missed call to team inbox | ✓ | ✓ | ✓ | — | — |
| Team @mention | ✓ | ✓ | ✓ | — | ✓ |
| **Missed call to team inbox → admin email (NON-DISABLEABLE)** | — | — | — | — | **Always fires** |

> **Non-disableable alert (per FUB docs):** When any call to a team inbox is missed, FUB automatically sends an email to all admins on the account AND all inbox users configured to receive calls. This cannot be turned off by any user setting or admin toggle. Implement as a system-level notification outside the preferences matrix — do not route it through the user preference check.

**Section C — Pond**

| Event | Bell | Desktop Push | Mobile Push | Text | Email |
|---|---|---|---|---|---|
| Lead added to a pond | — | — | — | — | ✓ (all agents in pond) |

#### 2.4.3 Desktop Push Technical Notes (per FUB docs)

- Requires the browser to have granted notification permission (Chrome → Allow, Safari → Allow, Firefox → Allow). If not prompted automatically, the user must enable manually via OS System Preferences → Notifications → [browser name].
- **Rate limit:** Desktop push notifications are suppressed for events occurring within **5 seconds** of a prior notification. If two events fire within 5 seconds, only one desktop notification appears. Implement server-side or client-side deduplication with a 5-second window per user.
- No sound: desktop push notifications in FUB have no audio. Notification duration is controlled by browser/OS, not the app.

#### 2.4.4 Daily Hot Sheet Email (per FUB docs)

- Delivery time: approximately **7:00 am** in the account's configured timezone.
- Sent to the agent's login email address.
- Content:
  - Appointments for the day (also syncs to Google Calendar for connected Gmail/Google Workspace users)
  - New leads: up to 5 most recent from the last 7 days, with contact info
  - Recent activity: email opens/clicks, IDX property searches, website registrations, marketing engagement
  - Tasks: up to 5 pending action items
- Toggle at: My Settings → Notifications → "Receive daily hot sheet emails" checkbox.

#### 2.4.5 New Lead Alerts — Admin All-Leads Opt-In

- For **admins only**: an additional opt-in (separate from the matrix above) causes the admin to receive email notifications for every new lead assigned to **any** agent on the account (not just leads assigned to themselves).
- These emails are distinguished by "Assigned to [Agent Name]" in the subject line.
- Configuration: Admin → Team → Edit user → "Notify about all new inquiries in Follow Up Boss" checkbox → Save.
- Store as `notify_all_new_leads: boolean` on the user record; role-gated to Admin and Owner.

---

## 3. My Devices Panel

### 3.1 Purpose

Lists all mobile devices (iPhone and Android) where the user is currently logged into the FUB mobile app. Allows sending test push notifications and revoking mobile sessions remotely.

### 3.2 Layout

Table or card list. Each row represents one registered device.

| Column | Content |
|---|---|
| Device name | iOS device name or Android device name (e.g., "Matt's iPhone 15 Pro") |
| Platform | iOS or Android icon/label |
| Last active | Timestamp of most recent app activity |
| Send Test Notification | Button — fires a test push notification to that device immediately to verify push delivery works |
| Remove | Button — immediately terminates the authenticated session on that device (force-logout). The user must log in again on that device to regain access. |

### 3.3 Force-Logout Behavior (per FUB docs)

- Clicking **Remove** revokes the session on the target mobile device immediately.
- Designed for lost or stolen device scenarios.
- The user's web session and other device sessions remain active.
- After removal, the device shows a "Session expired" or login prompt on next app open.

### 3.4 Empty State

If no mobile devices are registered: "No devices connected. Install the [CRM name] app on your iOS or Android device to get started." With links to App Store and Google Play (inferred).

### 3.5 Data Written

- `device_sessions` table: `user_id`, `device_id` (OS-generated token), `device_name`, `platform` (ios/android), `push_token` (APNs/FCM), `last_active_at`, `created_at`, `revoked_at` (null if active).

---

## 4. Power-Ups (Account Feature Toggles)

### 4.1 Access

User avatar dropdown → **Power-Ups**. Route: `/admin/power-ups` or `/2/admin/power-ups` (inferred). Also accessible at Admin → Power-Ups.

### 4.2 Layout

Grid or list of feature tiles. Each tile shows: power-up name, brief description, enabled/disabled toggle, plan badge (if a higher plan is required). Features requiring the current plan or higher show an active toggle; features above the current plan show a yellow "Upgrade" badge and a disabled toggle.

### 4.3 Power-Up Catalog (per FUB docs — complete list)

| Power-Up | Who Can Enable | Plan Required | Description |
|---|---|---|---|
| Agent Action Plans | Owner / Admin | Any | Agents can create and manage their own action plans (not just use ones the admin created) |
| Agent Automations | Owner / Admin | Any | Agents can build and edit automations |
| Agent Owned Lead Duplication | Owner / Admin | Pro & Platform | Allows agent-owned lead deduplication logic |
| Appointment Reminder Texts | Owner / Admin | Any | Automated appointment reminder SMS to contacts |
| Blur Mode | Owner / Admin | Any | Blurs contact phone/email on screen (privacy in shared spaces) |
| Read Only Stage Management (Beta) | Owner / Admin | Any | Restricts which roles can change a lead's stage |
| Call From | Owner / Admin | Pro & Platform | Controls outbound caller ID options per agent |
| Call Recording Disclosure | Owner / Admin | Any | Plays an automated legal disclosure message before calls connect |
| Call Recording, Transcripts, and Summaries | **Owner only** | Any | Records all calls; generates AI transcripts and summaries. Legal note: "Check which laws apply with your lawyer — some states do not allow call recording." |
| Disable Batch Emailing | Owner / Admin | Any | Prevents agents from sending batch emails to multiple contacts |
| Lead Source Lockdown | **Owner only** | Pro & Platform | Restricts lead source editing to Owner/Admin/ISA only; agents and lenders cannot edit or add lead sources |
| Enforce Google/Microsoft Sign-In | **Owner only** | Pro & Platform | Forces all users (except lenders) to authenticate via Google or Microsoft OAuth; disables username/password login |
| API Key Restrictions | **Owner only** (must contact support to activate) | Any | Disables default API key creation for all users; owner grants/revokes per-user via Admin → Teams |
| Assign Smart List Collections | Owner / Admin | Any | Assign smart list collections to specific users |

### 4.4 Plan Gate

- Features requiring a higher plan display a yellow badge on the tile ("Upgrade required").
- Clicking a gated tile opens a plan upgrade prompt (inferred).
- Owner-only features do not appear as editable to admins or agents (inferred: either hidden or visually locked).

### 4.5 Data Model

Store as a `power_ups` configuration table: `key` (enum), `enabled` (boolean), `plan_required` (enum: any/pro/platform), `enabled_by_role` (enum: owner/admin), `enabled_at`, `enabled_by_user_id`. Do not hardcode power-up behavior in each feature module — check the config table at runtime.

---

## 5. Product Changes

### 5.1 Purpose

Displays the changelog / release notes for the CRM platform. Allows users to see what new features have shipped.

### 5.2 Behavior

- Clicking the **Product Changes** item in the account dropdown opens the changelog (inferred: opens a new browser tab linking to an external changelog page, or opens an in-app feed panel).
- Read-only. No user interaction beyond reading and scrolling.
- An unread badge or red dot on the menu item may appear when new entries have been added since the user last viewed it (inferred, common pattern).

### 5.3 Implementation

For the in-house CRM: implement as a simple `/changelog` page or link to an external hosted changelog. Optionally track `last_viewed_changelog_at` per user to drive an unread indicator dot on the account menu item.

---

## 6. System Status

### 6.1 Purpose

Links to the real-time platform status page where users can verify whether an outage or degraded performance is affecting the CRM (or a connected integration).

### 6.2 Behavior

- Clicking **System Status** navigates to an external status page (e.g., `status.ryan-realty-crm.com` or equivalent) in a new tab (inferred).
- The page shows uptime/incident status per service component (API, email sync, texting, calling, etc.).
- Read-only.

### 6.3 Implementation

Use a hosted status page service (e.g., Statuspage.io, BetterStack) or build a simple uptime page. Link from the account menu as an external URL.

---

## 7. Log Out

### 7.1 Behavior

- Clicking **Log Out** immediately ends the current authenticated session.
- No confirmation dialog (per FUB behavior observed in shot 79 — single click, no modal).
- Redirects to the login page.
- All other sessions (mobile devices) remain active unless explicitly revoked via My Devices.

### 7.2 Implementation

- POST to `/api/auth/logout` (or equivalent) which:
  1. Clears the session cookie / invalidates the JWT.
  2. Redirects to `/login`.
- Do not force-logout mobile sessions on web logout (each device has an independent session).

---

## 8. After-Hours Texting — Impact of My Settings Timezone

The timezone set in My Settings → Personal Information directly governs the quiet-hours window for all automated outbound text messages assigned to that agent (per FUB docs). This is a system-level enforcement:

- **Quiet window:** 9:00 pm – 8:00 am in **the assigned agent's timezone** (not the lead's timezone, not the account timezone).
- Initial/automated text messages triggered during the quiet window are queued and held.
- At 8:00 am in the agent's timezone, queued messages send automatically.
- **Auto-cancel:** If any communication (text, email, or phone call) occurs between the agent and the lead before 8 am, the queued message cancels automatically.
- **Manual cancel:** The queued message appears in the lead's timeline with a cancel link.
- **Exception:** Action plan emails bypass the quiet window entirely — they send immediately regardless of time.
- **Mobile display bug (documented):** FUB mobile apps show queued messages as "already sent." Always check the desktop timeline for accurate queue status.

Build implication: the `users` table must store `timezone` (IANA string, e.g., `America/Los_Angeles`); the SMS dispatch queue must convert all scheduled send times to the assigned agent's timezone for window enforcement.

---

## 9. Data Model — Fields and Tables Touched

### 9.1 `users` table (additions/confirmations)

| Field | Type | Notes |
|---|---|---|
| `name` | text | Display name; merge-field token source |
| `phone_mobile` | text | E.164; required for SMS notifications + calling |
| `email_login` | text | Login email; notification email destination |
| `timezone` | text | IANA timezone string; drives quiet-hours enforcement |
| `avatar_url` | text | S3/CDN URL; falls back to initials |
| `email_connected` | boolean | Whether the user's email account is OAuth-linked |
| `email_provider` | enum | google / microsoft / null |
| `share_emails` | boolean | Team visibility of agent's emails |
| `share_calendar` | boolean | Admin visibility of agent's calendar |
| `email_signature_html` | text | HTML email signature blob |
| `zillow_profile_url` | text | Optional |
| `daily_hot_sheet` | boolean | Hot sheet email opt-in |
| `notify_all_new_leads` | boolean | Admin-only: email on every account lead |
| `user_merge_field` | text | Free-form text for template merge tokens |
| `fub_phone_number` | text | Assigned virtual phone number (calling add-on) |
| `mute_sound_effects` | boolean | In-browser call audio muted |
| `ring_sequence` | enum | desktop_only / simultaneous / mobile_only |
| `mobile_ring_time_seconds` | integer | Seconds before voicemail rollover |
| `voicemail_greeting_url` | text | Stored audio file |
| `outbound_number` | text | FK to phone_numbers |
| `calling_method` | enum | browser / bridged |

### 9.2 `device_sessions` table

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | |
| `device_name` | text | OS-reported device name |
| `platform` | enum | ios / android |
| `push_token` | text | APNs or FCM token |
| `last_active_at` | timestamptz | Updated on each app open |
| `created_at` | timestamptz | |
| `revoked_at` | timestamptz | null = active; set on Remove action |

### 9.3 `user_notification_prefs` table

| Field | Type | Notes |
|---|---|---|
| `user_id` | uuid FK → users | |
| `event_type` | enum | new_lead_assigned / lead_reassigned / existing_lead_inquiry / new_text / new_voicemail / missed_call / inbox_conversation_assigned / note_mention / pond_lead_added / email_opened / task_assigned / team_inbox_message / team_inbox_mention / pond_event |
| `channel` | enum | bell / desktop_push / mobile_push / sms / email |
| `enabled` | boolean | |

Composite PK: `(user_id, event_type, channel)`. Auto-save on every toggle change (no batch save needed).

### 9.4 `power_ups` table

| Field | Type |
|---|---|
| `key` | enum PK |
| `enabled` | boolean |
| `enabled_by_user_id` | uuid FK → users |
| `enabled_at` | timestamptz |
| `plan_required` | enum |
| `role_required` | enum |

---

## 10. Acceptance Criteria

### AC-1 — Account Dropdown

1. Clicking the user avatar in the top navigation bar opens a floating dropdown panel with exactly six items in order: My Settings, My Devices, Power-Ups, Product Changes, System Status, Log Out.
2. Each item has a left-aligned outline icon matching the FUB equivalents: gear, phone/device, lightning bolt, megaphone/speaker, info-circle, door/exit.
3. Clicking outside the panel or pressing Escape closes it without taking any action.
4. Clicking Log Out ends the session and redirects to the login page with no confirmation dialog.
5. The avatar image or initials fallback is visible on the trigger at all times regardless of navigation state.

### AC-2 — My Settings: Personal Information

6. All five personal fields (name, mobile phone, login email, timezone, avatar) are editable.
7. Changes to name propagate to all merge-field renders within the session.
8. Timezone dropdown uses the full IANA timezone list; saving a timezone change immediately affects the agent's after-hours queue calculation.
9. Avatar uploads accept common image formats (JPEG, PNG, WebP), crop to a circle, and appear in the nav avatar immediately after save.

### AC-3 — My Settings: Email & Signature

10. Google and Microsoft OAuth connections are available; connecting an account shows a green "Connected" indicator.
11. Share Emails and Share Calendar toggles save immediately and reflect the current state on reload.
12. The email signature editor supports: rich text (bold, italic, underline, links), inline images, and raw HTML import.
13. The pre-populated signature in the email compose panel matches the signature saved in My Settings exactly.

### AC-4 — My Settings: Notifications

14. The Notification Settings page renders a matrix of events × channels with independently checkable cells.
15. Each toggle saves immediately (no Save button); reloading the page preserves the saved state.
16. Enabling "Desktop Push" for any event prompts the user to grant browser notification permission if not already granted.
17. Enabling "Text" for any event sends SMS to the phone number saved in Personal Information; if no phone is on file, a warning is shown: "Add a mobile phone number in Personal Information to enable SMS notifications."
18. The non-disableable Team Inbox missed-call email fires to all admins regardless of their notification preferences matrix.
19. Desktop push notifications are rate-limited: a second notification within 5 seconds of the first is suppressed server-side per user.

### AC-5 — Daily Hot Sheet

20. When "Receive daily hot sheet emails" is checked, an email job sends at 7:00 am in the account timezone containing: next-day appointments, 5 most recent leads (7-day window), recent email engagement activity, and 5 pending tasks.
21. Unchecking the option stops delivery at the next scheduled run; no retroactive effect.

### AC-6 — My Devices

22. The My Devices panel lists all active mobile sessions for the current user with device name, platform icon (iOS/Android), and last-active timestamp.
23. Clicking "Send Test Notification" dispatches a push notification to that device within 5 seconds and shows a success toast.
24. Clicking "Remove" revokes the device's session token immediately; the device receives a session-expired state on next app open; the web session is unaffected.
25. An empty state message appears when no devices are registered.

### AC-7 — Power-Ups

26. The Power-Ups page lists all power-ups with their current enabled/disabled state.
27. Power-ups requiring a higher plan show a "Upgrade required" badge and a disabled toggle; attempting to enable them opens an upgrade prompt.
28. Owner-only power-ups are not editable by Admin-role users (toggle is either hidden or visually locked).
29. Enabling or disabling a power-up takes effect within one page refresh (or immediately via real-time update).
30. The Call Recording power-up displays the legal note: "Check which laws apply with your lawyer before enabling — some states do not allow call recordings."

### AC-8 — Session Management

31. Log Out clears all session cookies/JWTs for the current web session and redirects to `/login`.
32. Logging out on web does not revoke mobile device sessions.
33. Force-revoking a device from My Devices does not affect the web session or other devices.
34. The 2FA email verification link (for new device/location logins) is single-use and expires in 10 minutes (per FUB docs).

---

## Cross-References

- **§05 — People List:** The People list is the background view behind the open dropdown in shot 79. The account avatar trigger is always present in the global nav described in §04 (Global UI Shell).
- **§11 — Inbox / Email Compose:** The email compose panel visible in shot 79 uses the email signature from My Settings (§2.3.3). Any compose panel implementation must fetch `currentUser.emailSignatureHtml` and prepend it to the empty body on open.
- **§14 — Admin / Team Management:** The `notify_all_new_leads` flag (§2.4.5) and per-user calling, export, call-recording, and pause-leads settings are configured by admins in the Team Management panel (§14), not in My Settings. My Settings covers only what the individual user controls about themselves.
- **§17 — Cross-Cutting: After-Hours Texting:** The timezone in My Settings is the enforcement point for §17's after-hours queue logic.
- **§15 — Power-Ups:** The Power-Ups page in the account dropdown is the per-account activation surface; individual power-up behavior (e.g., call recording, lead source lockdown) is enforced in the relevant feature modules (§15).

---

## Sources

| Source | Coverage |
|---|---|
| **shot-79.md** (high-res tile analysis, authoritative) | Exact dropdown items and order; icon styles; panel dimensions; compose panel signature contents; live data (Matt Ryan, 541.703.3095, matt@ryan-realty.com, ryan-realty.com) |
| **fub-docs/account-team-billing.md** §11 (My Settings) | Full My Settings sub-section list and field inventory |
| **fub-docs/account-team-billing.md** §8 (Power-Ups) | Complete power-up catalog, plan gates, role restrictions |
| **fub-docs/account-team-billing.md** §5 (Security) | 2FA rules, password requirements, force-logout |
| **fub-docs/notifications-mobile.md** §1–9 | Five notification channels, full event matrix, desktop rate-limit, daily hot sheet, @mention rules, non-disableable team inbox email, quiet-hours detail |
| **fub-docs/notifications-mobile.md** §10–13 (Mobile) | My Devices behavior, test notification, force-logout, mobile notification limitations |
| **docs/FUB_CRM_FEATURE_SPEC.md §16** (prior spec, superseded) | Starting reference; four items corrected: "Pause Drips", "Get Help", and "(personal view)" removed; "My Devices" and "Power-Ups" added; all replaced with shot-79 authoritative list |
