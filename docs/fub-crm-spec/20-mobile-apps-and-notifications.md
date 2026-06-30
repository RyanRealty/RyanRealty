# Mobile Apps & Notifications

The mobile and notification system is the real-time connective tissue of the CRM: it puts the broker's full lead context on their phone, lets them call, text, email, log notes, and manage tasks without opening a laptop, and ensures that every high-priority event — a new lead, a text reply, a missed call, an @mention — reaches the right person within seconds across five distinct delivery channels. No screenshot session captured these surfaces because they live in native iOS/Android apps and in browser-push notification flows; every requirement in this section is sourced from the complete 50-article official FUB documentation set (Notifications: 7 articles; iPhone App: 23 articles; Android App: 20 articles) and from the Ryan Realty in-house mobile parity document at `docs/MOBILE_CRM_FUB_PARITY.md`. All requirements are marked "(per FUB docs)" when sourced from official documentation or "(per repo)" when from the existing codebase. Items that are clearly implied but not explicitly documented are marked "(inferred)".

---

## 20.1 Notification Architecture — Five Delivery Channels

### 20.1.1 Channel Matrix (per FUB docs)

FUB delivers notifications across exactly **five** independently-configurable channels. The in-house CRM must implement all five.

| # | Channel | Mechanism | Configurable per event | Notes |
|---|---|---|---|---|
| 1 | **In-App Bell** | Badge count + notification panel (web & mobile) | Yes | Blue dot per unread; disappears on click |
| 2 | **Desktop Push** | Browser-level OS notification via Web Push API | Yes | Requires explicit browser permission; 5-second rate limit |
| 3 | **Mobile Push** | APNs (iOS) / FCM (Android) native push | Yes | Requires in-app permission enable + OS-level permission |
| 4 | **Text (SMS)** | SMS sent from FUB number `855-672-9077` | Yes | Requires personal cell number saved in user settings |
| 5 | **Email** | Sent to the user's login email address | Yes | Also delivers the daily Hot Sheet digest |

**Access path (per FUB docs):** Bell Icon (top-right) → Settings Gear → Notification Settings page. Changes are **auto-saved** — no Save button. Settings are **per-user** — changing your settings does not affect teammates.

> **Prior-spec correction:** The prior spec (§16) listed "notification prefs (inferred)" as a single undifferentiated field in My Settings. The correct architecture is a full per-event × per-channel matrix (see §20.2) auto-saved on the Notification Settings page, accessible from the bell icon, not only from My Settings.

---

## 20.2 Notification Settings UI

### 20.2.1 Layout

Full-page settings view, **not** a modal. Three collapsible sections, each listing events in rows. Each event row has five channel toggle checkboxes reading left to right: Bell | Desktop Push | Mobile Push | Text | Email. All toggles are independent. No global "all on" / "all off" button observed (inferred: possible via individual section collapse/expand controls).

### 20.2.2 Section A — Activity

Events relating to leads assigned to the current user. All five channel toggles available per event (per FUB docs):

| Event Label (exact) | Notes |
|---|---|
| New lead assigned to you | All channels available |
| Lead reassigned to you | All channels available |
| Lead inquiry from an existing contact | All channels available |
| New text message received | All channels available |
| New voicemail received | All channels available |
| Missed call (to your FUB number) | All channels available |
| Inbox conversation assigned to you | All channels available |
| @mention in a note | All channels available |
| Lead added to a pond (you are in) | All channels available |
| Email opened / clicked by lead | All channels available |
| Task assigned to you / task due reminder | All channels available |

### 20.2.3 Section B — Team Inbox

Events for shared inboxes the user belongs to (per FUB docs):

| Event Label (exact) | Channels available |
|---|---|
| New message / voicemail / missed call to a team inbox | Bell + Desktop Push + Mobile Push |
| Team @mention | Bell + Desktop Push + Mobile Push + Email |

**Non-disableable rule (per FUB docs):** When any call to a team inbox is missed, FUB automatically sends an email to **all admins** on the account AND all inbox users configured to receive calls. This cannot be turned off by any user or admin and must be implemented as a system-level notification outside the preference matrix.

### 20.2.4 Section C — Pond

| Event Label (exact) | Channels available |
|---|---|
| Lead added to a pond | Email only |

Notification goes to all agents in that pond (per FUB docs).

### 20.2.5 Data Model — Notification Preferences

```ts
interface NotificationPreference {
  user_id: number               // FK users
  event_type: NotificationEvent // enum, see §20.2.2–20.2.4
  channel: NotificationChannel  // 'bell' | 'desktop_push' | 'mobile_push' | 'text' | 'email'
  enabled: boolean
  updated_at: Date
}

type NotificationEvent =
  | 'new_lead_assigned'
  | 'lead_reassigned'
  | 'existing_lead_inquiry'
  | 'new_text_received'
  | 'new_voicemail'
  | 'missed_call'
  | 'inbox_conversation_assigned'
  | 'at_mention'
  | 'lead_added_to_pond'
  | 'email_opened_clicked'
  | 'task_assigned'
  | 'task_due'
  | 'team_inbox_new_message'
  | 'team_inbox_voicemail'
  | 'team_inbox_missed_call'
  | 'team_mention'
  | 'pond_lead_added'

type NotificationChannel = 'bell' | 'desktop_push' | 'mobile_push' | 'text' | 'email'
```

**Acceptance criteria — Notification Settings:**
1. Settings page is reachable from bell icon → gear AND from My Settings → Notification Settings link.
2. Changing any toggle auto-saves within 300 ms (no explicit Save action).
3. Changing one user's settings has zero effect on any other user's preferences.
4. The team inbox missed-call email fires regardless of the user's email preference toggle state.
5. All five channels are independently toggleable per event.
6. The preference matrix persists across sessions (stored in DB, not localStorage).

---

## 20.3 Desktop Notification Center (Bell Icon — Web App)

### 20.3.1 Trigger & Access

- **Component:** Bell icon, top-right corner of the fixed global navigation bar. Always visible on every page. Carries a badge count when unread notifications exist (red or navy badge with white numeral, per Ryan Realty design system — not FUB's orange).
- **Click action:** Opens a floating notification panel, approximately 360px wide, positioned anchored below the bell.

### 20.3.2 Panel Layout (per FUB docs)

```
┌─────────────────────────────────────────────┐
│  Notifications                 [Mark All As Read]  ⚙ │
├─────────────────────────────────────────────┤
│  ● [avatar] Contact made a property inquiry  │
│    "123 Main St — just now"                  │
│  ● [avatar] @mention in note on Jane Smith   │
│    "Matt — can you handle this?" — 2 min ago │
│  ● [avatar] New lead: Travis Anderson        │
│    From Zillow · 4 min ago                   │
│  …                                           │
└─────────────────────────────────────────────┘
```

- **Unread indicator:** Blue dot to the left of each unread notification item.
- **Dismiss individual:** Hover the blue dot → an "×" appears → click to mark read without navigating (per FUB docs).
- **Dismiss all:** "Mark All As Read" button, top-right of the panel, clears all blue dots.
- **Navigation:** Clicking any notification row navigates directly to the associated lead/deal/inbox item and marks it read.
- **Gear icon:** Top-right of panel → links directly to the full Notification Settings page (§20.2).
- **Notification types shown in bell panel (per FUB docs):** property inquiries, new registrations, @mentions (with note preview), lead activity updates, email opens/clicks, missed calls/voicemails, task assignments.

### 20.3.3 States

| State | Behavior |
|---|---|
| Zero unread | No badge on bell; panel shows "You're all caught up" or empty state (inferred) |
| 1–99 unread | Badge shows count |
| 100+ unread | Badge shows "99+" (inferred) |
| Panel open | Floating over content; clicking outside or pressing Esc closes |
| Loading | Skeleton rows while fetching |

### 20.3.4 Data Model — Notification Records

```ts
interface Notification {
  id: string
  user_id: number               // recipient
  event_type: NotificationEvent
  entity_type: 'person' | 'deal' | 'inbox_thread' | 'task'
  entity_id: string             // FK to the related record
  title: string                 // e.g. "New lead assigned: Jane Smith"
  preview: string               // short body text, max 140 chars
  channel: NotificationChannel
  delivery_status: 'queued' | 'sent' | 'delivered' | 'failed'
  read_at: Date | null          // null = unread
  created_at: Date
}
```

**Acceptance criteria — Desktop Notification Center:**
1. Bell icon shows badge with accurate unread count; updates in real-time (WebSocket or polling ≤ 30 s).
2. Clicking a notification navigates to the associated record and sets `read_at`.
3. Hover on unread dot shows × dismiss affordance; clicking marks read without navigation.
4. "Mark All As Read" sets `read_at` for all user's unread notifications in one action.
5. Gear icon in panel navigates to Notification Settings.
6. Panel renders notification types: new lead, inquiry, @mention, voicemail, missed call, email open/click, task assigned.

---

## 20.4 Desktop Browser Push Notifications

### 20.4.1 Enable Flow (per FUB docs — 4 steps)

1. Click bell icon → Settings Gear (navigates to Notification Settings).
2. Toggle on "Desktop notifications" for desired event types (Section A or B rows).
3. Browser prompts for OS-level notification permission (Chrome / Safari / Firefox). User must click "Allow."
4. If the browser prompt does not appear: user navigates manually to OS System Preferences → Notifications → [browser name] → Allow.

**In-house build:** implement via the Web Push API (VAPID key pair). Store the `PushSubscription` object per user per browser in a `push_subscriptions` table. Service worker must be registered at `/sw.js`.

### 20.4.2 Behavior Rules (per FUB docs)

- **Triggers:** New lead, existing-lead inquiry, new text/voicemail/missed call, inbox conversation assignment, @mention, contact joins pond.
- **Rate limit (hard rule, per FUB docs):** Desktop push notifications are suppressed for any event occurring within **5 seconds** of a prior notification for the same user. Only one desktop push fires within any 5-second window. Implement server-side deduplication with a `last_desktop_push_at` timestamp per user.
- **No audio:** Desktop push notifications have no sound. Duration is controlled by browser/OS settings, not the CRM.
- **Troubleshooting note for in-house build:** If a user enables desktop push but notifications don't appear, the cause is always OS-level permission for the browser process. Surface a help tooltip linking to OS settings.

**Acceptance criteria — Desktop Push:**
1. Service worker registered; VAPID subscription stored per user-browser pair.
2. Server-side rate limiter suppresses a second push within 5 seconds of the first for the same user.
3. Push payload includes: notification title, body, `entity_type`, `entity_id`, click-through URL.
4. Clicking the OS notification navigates to the correct record in the web app.
5. Revoking browser permission gracefully removes the subscription and falls back to bell-only.

---

## 20.5 Quiet Hours — Automated Outbound Text Rules (per FUB docs)

### 20.5.1 Window & Scope

- **Quiet window:** 9:00 pm – 8:00 am **(per FUB docs).**
- **Timezone basis:** The **assigned agent's** timezone — not the lead's timezone and not the account's global timezone (per FUB docs). Store `timezone` on the user/broker record (e.g. `America/Los_Angeles`).
- **Scope:** Applies only to initial and automated outbound text messages triggered by action plans or automations. Does **not** apply to action plan emails (emails send immediately regardless of the hour, per FUB docs).
- **Manual texts:** A broker sending a manual text from the UI or mobile app is not blocked by quiet hours (inferred; quiet hours only affect automated/initial sends).

### 20.5.2 Queue Behavior (per FUB docs)

- Messages triggered during the quiet window are **held** in a `queued_messages` table with a `scheduled_send_at` timestamp of 8:00 am in the assigned agent's timezone.
- A background job runs at or just after 8:00 am per timezone to dispatch the queue.

### 20.5.3 Auto-Cancel Rule (per FUB docs)

If the broker communicates with the lead (text, email, or logged phone call) before 8:00 am, the queued message **cancels automatically** to prevent duplicate outreach. Implement as a trigger or post-save hook on the `crm_timeline` table: when a new outbound event is logged for a lead, check `queued_messages` for that lead and cancel any pending entries.

### 20.5.4 Reassignment Edge Case (per FUB docs)

If a lead is reassigned to a different agent while a queued text is pending (between 9 pm and 8 am), the **original agent's** scheduled message remains in the queue. It does NOT automatically transfer to the new agent. Manual cancellation by the original agent (or an admin) is required. Surface this as a visible warning in the lead timeline.

### 20.5.5 Mobile Display Bug (per FUB docs — known limitation)

The FUB mobile apps display queued messages with inaccurate status. The desktop lead timeline shows the correct queue state. **For the in-house CRM:** implement accurate queue status on both mobile and desktop (this is an explicit improvement opportunity over FUB, per `docs/MOBILE_CRM_FUB_PARITY.md`).

### 20.5.6 Manual Cancel UI

Display queued messages in the lead's activity timeline as a distinct entry (e.g., "Text queued for 8:00 am · [Cancel]"). The "Cancel" link deletes the `queued_messages` row and logs a system timeline event.

### 20.5.7 Data Model

```ts
interface QueuedMessage {
  id: string
  person_id: number             // FK crm_people
  assigned_agent_id: number     // agent whose timezone governs delivery
  message_type: 'text'          // only texts are queued (emails bypass)
  body: string
  from_number: string           // Twilio number
  to_number: string             // recipient phone
  via_automation_id?: string    // if triggered by action plan
  scheduled_send_at: Date       // 8:00 am in assigned agent's timezone
  status: 'queued' | 'sent' | 'cancelled' | 'auto_cancelled'
  created_at: Date
  sent_at?: Date
  cancelled_at?: Date
  cancel_reason?: 'manual' | 'auto_communication' | 'reassignment'
}
```

**Acceptance criteria — Quiet Hours:**
1. Automated text triggered between 9 pm and 8 am inserts a `queued_messages` row rather than calling Twilio immediately.
2. Scheduled delivery time is computed using the **assigned agent's** timezone (IANA format).
3. Background job sends queued messages at or within 60 seconds of 8:00 am agent local time.
4. Any logged outbound communication (text, email, or call) to the same lead before 8 am auto-cancels pending queued messages and logs the cancellation reason.
5. The lead timeline shows queued messages with a "Cancel" affordance.
6. Action plan emails bypass the queue entirely and send immediately.
7. Reassignment does NOT reassign the queued message; a warning is shown in the new agent's lead view.

---

## 20.6 Daily Hot Sheet Email (per FUB docs)

### 20.6.1 Delivery

- **Schedule:** Every morning at approximately **7:00 am** in the account's configured timezone (per FUB docs).
- **Recipient:** Each user's login email address.
- **Toggle:** My Settings → Notifications section → "Receive daily hot sheet emails" checkbox. Unchecking and saving disables future deliveries.

### 20.6.2 Content (per FUB docs — exact sections)

| Section | Content |
|---|---|
| Appointments | Today's appointments; also syncs to Google Calendar for connected accounts |
| New Leads | Up to **5** most recent new leads from the last **7 days**, with contact info |
| Recent Activity | Email opens/clicks, IDX property searches, website registrations, marketing engagement |
| Tasks | Up to **5** pending action items (overdue or due today) |

### 20.6.3 Build Implementation

Implement as a scheduled email job (cron: daily at 7:00 am account timezone, per user with the hot sheet enabled). Pull data at generation time (not pre-cached) to guarantee freshness. Use Resend (the in-house email provider at `mail.ryan-realty.com`) as the sending service.

**Acceptance criteria — Daily Hot Sheet:**
1. Email fires at or within 5 minutes of 7:00 am in the account's configured timezone.
2. Fires for every user with the "Receive daily hot sheet emails" setting enabled.
3. Content contains: appointments (today), up to 5 new leads (last 7 days), recent email/web activity, up to 5 pending tasks.
4. Unchecking the toggle in My Settings stops future hot sheets for that user.
5. Email passes DKIM/SPF from `mail.ryan-realty.com`.

---

## 20.7 New Lead Alerts (per FUB docs)

### 20.7.1 Per-Assigned-Agent Alerts

When a lead is assigned to an agent, the following fires automatically (per FUB docs):

| Channel | Behavior |
|---|---|
| Email | Automatic; no setup required |
| Text (SMS) | Requires personal phone number in My Settings; can be disabled via notification prefs |
| Mobile Push | Available 24/7; configure OS-level Do Not Disturb to limit hours |
| Desktop Push | Must be manually enabled by the agent (per §20.4) |

### 20.7.2 Admin: Notify All New Leads (per FUB docs)

- **Location:** Admin → Team → Edit user → checkbox "Notify about all new inquiries in Follow Up Boss" → Save.
- **Scope:** Admin-only opt-in. When enabled, the admin receives email notifications for leads assigned to **any** agent on the account.
- **Email subject format (exact, per FUB docs):** "Assigned to [Agent Name]" — this distinguishes these emails from the admin's own lead assignments.
- **Channels:** Email only (not push/text for all-lead alerts).
- **Data model:** Store as `notify_all_new_leads: boolean` on the user record.

**Acceptance criteria — New Lead Alerts:**
1. Lead assignment fires email notification to assigned agent immediately.
2. SMS fires if agent has personal phone number configured and text channel is enabled for `new_lead_assigned`.
3. Mobile push fires if mobile push is enabled and the device is registered.
4. Admin users with `notify_all_new_leads = true` receive email for every lead assigned to any agent, with "Assigned to [Agent Name]" in the subject.
5. Admin "notify all leads" toggle is only visible to admins; agents cannot see or set it.

---

## 20.8 Team @Mentions (per FUB docs)

### 20.8.1 Mention Types & Behavior

@mentions are available in any note field — on a lead profile or inside a Team Inbox thread. Syntax: type `@` followed by a user name, team name, or pond name.

| Mention target | Result (per FUB docs) |
|---|---|
| Individual agent | Recipient added as **collaborator** on the lead AND receives email notification with contact details + note content |
| Admin user | Admin receives email notification but is **NOT** added as collaborator (already has full access) |
| Team name | Only the **team leader** receives notification — not all team members |
| Pond name | Notification goes to pond members (inferred per pond notification rules) |

**Access restriction (per FUB docs):** Users can only @mention teams they belong to. Attempting to @mention a team the user is not a member of must be blocked at input time with an inline error.

### 20.8.2 Implementation Requirements

- Autocomplete dropdown on `@` keystroke: list of users (name + avatar), teams, ponds — filtered by membership.
- On save: server-side resolution of each @mention handle → fire notification to resolved recipients.
- Collaborator addition is automatic for agent @mentions (do not prompt; just add).
- Notification email body includes: the note content (verbatim), the lead's name + contact info, a link to the lead record.

**Acceptance criteria — @Mentions:**
1. Typing `@` in any note field shows an autocomplete list of users/teams/ponds the author belongs to.
2. Selecting an agent @mention adds them as collaborator and fires a notification email.
3. Selecting an admin @mention fires notification but does NOT add a collaborator entry.
4. Selecting a team @mention notifies only the team leader.
5. @mentioning a team the user is not in is rejected with an inline error before save.
6. Mobile app note compose supports the same @mention syntax (see §20.9.3.5 — iPhone Notes tab).

---

## 20.9 iPhone App

### 20.9.1 System Requirements & Availability (per FUB docs)

- **iOS version:** iOS 17+ required for calling features; lower versions may use the app with limited functionality.
- **Download:** App Store.
- **iPad:** No native iPad app. Use full desktop web app in Google Chrome on iPad (bookmark to home screen for quick access).

### 20.9.2 Global Navigation — Bottom Tab Bar (per FUB docs)

Five persistent tabs, always visible at the bottom of the screen:

| Tab | Icon type | Content |
|---|---|---|
| **Inbox** | Envelope / chat bubble | Unified email, text, call conversations |
| **Activity** | Lightning bolt / list | New leads, email opens, website activity |
| **Calendar** | Calendar grid | Tasks + appointments (FUB + external) |
| **People** | Person / contact card | All Lists, Stages, search |
| **Deals** | Deal card / Kanban | Pipelines, stages, deal cards |

**Additional global controls:**
- **Quick Actions "+" button** — blue floating action button, accessible from every tab. Expands to: Add Person, Send Text, Make a Call, Send Email, Schedule Appointment, Add Task.
- **Notification Bell** — upper-right corner; badge count for unread notifications; see §20.9.8.
- **Settings** — user initials/avatar, upper-left; navigates to app-level settings.

> **In-house CRM mapping (per repo docs):** The in-house CRM implements an equivalent bottom tab bar via `CrmMobileTabBar` in `ConsoleShell` (phone-only, `lg:hidden`): Home · Inbox · People · Deals · Tasks. The "+" FAB is implemented as `ConsoleQuickAction`. The in-house build must maintain this parity contract and extend it with mobile-exclusive improvements (live engagement score in activity feed, context-aware FAB pre-targeting the lead, etc.).

### 20.9.3 iPhone Inbox (per FUB docs)

#### Layout

Full-width conversation list. No persistent sidebar on mobile.

#### Views — Four Tabs (exact labels)

| Tab | Contents |
|---|---|
| **Inbox** | Open, unassigned or assigned-to-me conversations |
| **Assigned** | Conversations explicitly assigned to a team member |
| **Sent** | Outbound messages initiated by the current user |
| **Closed** | Conversations marked closed |

#### Toggle

Top of screen: **My Inbox** / **Team Inboxes** segmented control (per FUB docs).

#### Filter (Three-line menu)

Filter conversation list by type: Emails / Texts / Calls / Inbox App Messages. "APP" badge appears on inbox app messages (integrations).

#### Conversation List Item

Each row shows: contact avatar + name, preview of last message, relative timestamp, unread indicator.

#### Actions

| Action | Method |
|---|---|
| Open thread | Tap conversation row → opens full thread, inline reply |
| Add note with @mention | From within open conversation → note compose |
| Note indicator | Notes in inbox list show a push-pin icon |
| Assign to teammate | Swipe right → assign dialog |
| Close conversation | Swipe left on open conversation |
| Reopen conversation | Swipe left on closed conversation |

### 20.9.4 iPhone Calling (per FUB docs)

#### Setup Requirements (4 steps)

1. Personal US/Canadian cell phone number (not VoIP) added to My Settings.
2. Incoming call routing set to "Ring your number and Follow Up Boss at the same time."
3. Enable Calling toggle in app Settings.
4. Optionally enable Caller ID.

#### Outbound Call Flow

- From lead profile → tap green call button → a bridge number briefly displays (internal logging only) → contact's phone rings showing the agent's **FUB number** as caller ID (not personal cell).
- From Quick Actions → "+" → "Make a Call" → dial pad opens.

#### Incoming Call Flow

- Routes to agent's personal mobile per device settings.
- With Caller ID enabled: caller displays as lead's name.
- Call waiting options: "Send to voicemail" / "End and accept" / "Hold and accept."

#### Call Logging (per FUB docs)

| Event | Auto-log behavior |
|---|---|
| Outbound call | Auto-logs after completion; triggers post-call note prompt |
| Inbound call | Auto-routes and auto-logs |
| Calls under 5 seconds | **Do NOT trigger the post-call logging prompt** (5-second minimum threshold, per FUB docs) |
| Missed call | Push notification + logged as missed call event |
| Voicemail left | Push notification + logged with recording URL |

- Post-call prompt allows adding notes immediately after hanging up.
- Manual logging: Lead Profile → "+" button → "Log Call" → enter notes. Logged calls appear on the lead's Communications tab.
- Call recording: optional; must be enabled by account owner at the account level.

#### 3-Way Calling (iPhone, per FUB docs)

1. Initiate first call via FUB app (contact A is live).
2. Return to app → dial second contact B (contact A is placed on hold automatically by iOS; B sees FUB number as caller ID).
3. Tap "Merge Calls."
4. Call logs on **both** contact A's and contact B's profiles (per FUB docs — iPhone-specific behavior).

**Limitation:** 3-way calls do not support automatic post-call note logging.

#### Calling Add-On / Plan Dependency (per FUB docs)

FUB Calling (individual agent numbers, inbound + outbound) is included in Pro and Platform plans; requires add-on purchase on Grow plans. Without the add-on, tracked outbound calling is not available and manual call log is the only path.

**Acceptance criteria — iPhone Calling:**
1. Outbound call from lead profile shows agent's FUB number to recipient.
2. Calls over 5 seconds trigger the post-call note prompt; calls under 5 seconds do not.
3. 3-way calling merges two calls and logs on both contact profiles.
4. Missed calls and voicemails generate push notifications and timeline entries.
5. Manual "Log Call" from lead profile creates a `crm_timeline` call record with notes.

### 20.9.5 iPhone Caller ID (per FUB docs)

#### Setup (3 steps)

1. App Settings → "Turn on Caller ID" → "Open Settings" (takes user to iOS Settings).
2. iPhone Settings → Phone → Call Blocking & Identification → toggle on "Follow Up Boss."
3. Settings → General → Background App Refresh → enable for Follow Up Boss.

#### Sync Cadence (per FUB docs — exact timing values)

| Sync event | Timing |
|---|---|
| New number added from within the app | **Immediately** |
| Active foreground sync (app open) | Every **15 minutes** |
| Full re-sync of all contact numbers | Once **daily** |
| Low Power Mode | Disables background sync; only foreground sync occurs |

**Priority conflict (per FUB docs):** If a phone number is already saved in the iPhone's native Contacts app, Apple's system shows the native Contacts name and **ignores** FUB's Caller ID. FUB Caller ID only fires for numbers NOT already in native Contacts.

#### Gotchas (per FUB docs)

- "Silence Unknown Callers" (iOS setting): if enabled, all inbound FUB calls from leads not in native Contacts are silently blocked. This is a frequent undocumented cause of missed calls.
- Focus Mode (iOS): FUB must be explicitly added to allowed apps in any active Focus Mode; otherwise call notifications are silenced.
- Third-party call-blocking apps (Scam Shield, ActiveArmor, Robokiller): can intercept and block FUB calls before the phone rings.
- Team inbox with 2+ users: mobile Caller ID shows the **team inbox number** (not contact name/number); agents should save the team inbox number in native Contacts to prevent silencing.

**Acceptance criteria — Caller ID:**
1. Caller ID API endpoint returns all active contact phone numbers for the authenticated agent.
2. New numbers added in-app trigger an immediate sync push to the device.
3. Full refresh runs once daily.
4. The in-house build's Caller ID endpoint is documented so agents can configure it in iOS Settings.

### 20.9.6 iPhone Texting (per FUB docs)

#### A2P Business Registration Gate (per FUB docs — hard requirement)

**Business Registration (A2P 10DLC) must be approved before any texts can be sent via the FUB number.** Without approval, texts silently redirect to iMessage using the agent's personal cell number — untracked, not logged in CRM. This is the same gate implemented in the in-house Twilio comms layer.

> **In-house CRM alignment (per repo docs `project_twilio_cutover.md`):** A2P VERIFIED + 541.703.3095 ported. The texting UI must check account registration status at compose time.

#### "Always Text in App" Toggle (per FUB docs)

- **ON:** All texts use the FUB/Twilio number; tracked and logged.
- **OFF:** A chooser modal appears on each text initiation prompting agent to select: "Cell number (untracked)" or "FUB number (tracked)." Agents may inadvertently choose cell (untracked), creating a data gap.

**Implementation:** Store `always_text_in_app: boolean` on the user record. When OFF, surface the chooser modal and log the channel chosen.

#### Supported Media (per FUB docs)

- Photos (from library or new capture)
- Videos (from library or new recording)
- vCard contact sharing

#### Limitations (per FUB docs)

- Landline numbers cannot receive texts; show error at send time.
- File attachments (PDFs, documents) not supported in FUB mobile. **The in-house CRM should implement file attachment support — this is a documented gap and improvement opportunity.**

#### Group Texting (per FUB docs)

- Tap "+" in the To field to add multiple recipients.
- Remove a recipient by tapping their name → "Remove Contact."
- Reply to group thread from: Inbox / Contact Profile Communications tab / push notification tap.

#### Templates

Pre-written message templates available at compose time (pull from `crm_templates` where `type = 'text'`).

**Acceptance criteria — iPhone Texting:**
1. Compose screen is gated behind A2P registration check; unregistered state shows clear error/status message.
2. "Always Text in App" toggle stores preference and controls whether chooser modal appears.
3. Sent texts log to `crm_timeline` with `type = 'text'`, `direction = 'outbound'`.
4. Photos and videos attach via picker or camera capture.
5. Group text creates a single thread with all recipients; replies appear in the same thread.
6. Landline numbers display an error and do not send.

### 20.9.7 iPhone Emailing (per FUB docs)

#### Compose Paths (2 entry points)

1. Inbox → select email thread → reply arrow (upper-right) → reply compose opens.
2. Lead Profile → email icon → new compose opens.

#### Compose Fields

| Field | Type | Notes |
|---|---|---|
| To | Auto-populated from lead | Pre-filled; editable |
| CC | Optional text input | — |
| BCC | Optional text input | — |
| Subject | Text input | — |
| Body | Rich text | Bold, italic, underline formatting supported |
| Template | Picker | Pre-written templates from `crm_templates` |

**Documented limitation (per FUB docs):** Email attachments are **not supported** in the iPhone app. **The in-house CRM should implement attachment support — this is a documented FUB gap and an explicit improvement opportunity.**

### 20.9.8 iPhone Activity Tab (per FUB docs)

Three filter segments (exact labels):

| Segment | Content |
|---|---|
| **New Leads** | Most recently acquired leads |
| **Emails** | Contacts who opened or clicked email messages |
| **Website** | Recent website engagement (property views, saved listings) |

**In-house improvement (per repo docs):** The in-house activity feed should surface live engagement scores and hot/active badges alongside these segments, leveraging `fetchLiveVisitors` / `fetchLiveSummary` signals that FUB does not have.

### 20.9.9 iPhone Calendar Tab (per FUB docs)

#### Visual Indicators (exact icons)

| Item | Icon | Color |
|---|---|---|
| Tasks | Checkbox / orange checkbox icon | Orange |
| FUB-created appointments | Circle | Pink |
| Synced external appointments (Google/Microsoft) | Circle | Green |

#### Create Events

- From calendar view: "+" button → create appointment or task.
- From lead profile: Calendar section → "+" button.

#### Sync

Integrates with connected Google or Microsoft calendar accounts. FUB-created appointments also sync to Google Calendar for connected accounts.

**Documented limitation (per FUB docs):** "Filtering to view team member's appointments and tasks is coming soon" — admin cannot filter calendar by individual team member on mobile (unlike desktop).

### 20.9.10 iPhone People Tab (per FUB docs)

**Two sub-tabs:**
1. **All Lists** — Collections and Smart Lists created on desktop. Read-accessible from mobile; contacts can be worked (called, texted, emailed, reassigned, action plans applied).
2. **Stages** — Contacts organized by pipeline stage with count per stage.

**Search:** Magnifying glass icon; search by name or select from recently accessed leads.

**Admin-only filter:** Toggle "Everyone" vs. individual agent.

**Ponds on mobile (per FUB docs — gotcha):** Ponds do not appear as a direct navigation item in the People tab. To access pond contacts on mobile, an agent must first create a Smart List filtered to that pond on desktop. The smart list then appears in the People → All Lists section.

**Actions from People:** Add contact, reassign contact, assign action plans.

### 20.9.11 iPhone Deals Tab (per FUB docs)

- View, create, and edit deals.
- **Filter menu:** Deal Status (Current / Archived / All), Team or User, Deal Pipeline (tabbed at top), Deal Stage (tap a stage).
- **Create:** Navigate to desired pipeline → stage → fill deal info.
- **Edit:** Open existing deal → modify → save, archive, or delete.

### 20.9.12 iPhone Lead Profile (per FUB docs)

Horizontal tab bar; swipe left to reveal all tabs.

| Tab | Contents |
|---|---|
| **Information** | Recent messages, phone/email, relationships, assignment, source, stage, tags, lender, collaborators, background info, address (tap for directions), website inquiries, custom fields |
| **Communication** | All calls, emails, texts with this lead; inline reply |
| **Homes** | Website property activity (listings viewed, saved) |
| **Notes** | View/add notes; react (emoji) and reply to individual notes |
| **Calendar** | Tasks and appointments for this lead only |
| **Plans** | View, add, and pause action plans |

**Quick actions ("+" button, lower-right):** Send text / Send email / Call / Log Call / Add note / Schedule appointment / Add task.

> **In-house CRM mapping (per repo docs):** The in-house lead detail implements equivalent tabs via `LeadTabs` component: Overview · Comms · Tasks · Watching · Workflow · Activity. The "Log Call" action and inline reply are implemented in the Comms tab backed by `crm_timeline`.

### 20.9.13 iPhone Quick Actions ("+" Button, per FUB docs)

Available from every tab (Inbox, Activity, Calendar, People, Deals). Exact actions (per FUB docs):

1. Add a Person
2. Send Text (by name or number)
3. Make a Call (dial pad)
4. Send Email (with template support, CC/BCC)
5. Schedule Appointment (auto-populates Calendar + Lead Profile)
6. Add Task (auto-populates Calendar + Lead Profile)

**In-house improvement (per repo docs):** The in-house "+" FAB (`ConsoleQuickAction`) is context-aware: when accessed from a lead detail, it pre-fills that lead's information. It also surfaces the recommended next action at the top and adds "Enroll in workflow" and "Start a CMA" — capabilities FUB lacks.

### 20.9.14 iPhone In-App Notification Center (Bell, per FUB docs)

- **Bell icon:** Upper-right corner of the app; accessible from any tab; badge count when unread.
- **Actions:**
  - Tap notification row → marks as read → navigates to associated item.
  - "Mark all as read" (button, per FUB docs) clears all unread in one tap.
- **Documented limitations (per FUB docs — FUB's own known gaps):**
  - No unread count displayed in the notification list itself.
  - No filtering or grouping of notifications.
  - Cannot mark individual notifications as read without navigating to them.
  - **In-house improvement opportunity:** Add unread count, filtering, and mark-individual-read without navigation.

**Notification types displayed in mobile bell (per FUB docs):**
- New leads / lead assignments
- Note @mentions / assigned conversations
- Text messages received
- Missed calls / voicemails
- Email opens and clicks
- Task assignments and due reminders

### 20.9.15 iPhone Dictation (per FUB docs)

- Available in every text input field across the app wherever the iOS keyboard appears.
- Uses native iOS speech-to-text; no FUB-specific configuration.
- In-house build: no special implementation needed on the server side; native iOS handles it on the client.

---

## 20.10 Android App

### 20.10.1 System Requirements (per FUB docs)

- **Android version:** Android 9 (Pie) or newer for the app; Android 10+ for Caller ID.
- **Download:** Google Play Store.

### 20.10.2 Global Navigation — Bottom Tab Bar (per FUB docs)

Five persistent tabs, same labels as iPhone:

| Tab | Label |
|---|---|
| Inbox | Inbox |
| Activity (Recent) | Activity |
| Calendar | Calendar |
| People | People |
| Deals | Deals |

**Additional global controls:** Quick Actions "+" button (blue); Notification Bell (upper-right); Settings (user initials/avatar, upper-left).

### 20.10.3 Android Inbox (per FUB docs)

Same four views as iPhone: **Inbox / Assigned / Sent / Closed.** Toggle: **My Inbox / Team Inboxes.**

Filter (three horizontal lines, upper-left): emails / texts / calls / inbox app messages.

**Actions differ from iPhone:**

| Action | Android method (vs. iPhone) |
|---|---|
| Close conversation | Swipe left **or** right (iPhone: swipe left only) |
| Reopen / reassign | Three-dot menu upper-right on closed conversation (iPhone: swipe left to reopen) |
| Add note | Tap conversation → upper-right icon → add note |

### 20.10.4 Android Calling (per FUB docs)

**Setup:** Same prerequisites as iPhone but requires additional permission grants: Microphone, Music and Audio, Phone permissions (Android system dialog).

**3-Way Calling (per FUB docs — differs from iPhone):**

1. Call contact A via FUB app.
2. Tap "More" → "Add Call" → dial contact B (A is placed on hold; **B sees the agent's personal cell phone number**, not the FUB number — unlike iPhone).
3. When B connects → "More" → "Merge." Displays as "Conference Call."
4. Call logs on **initial contact A's profile only** — NOT on contact B's profile (per FUB docs). This differs from iPhone behavior where the call logs on both profiles.

> **In-house CRM improvement:** Normalize 3-way call logging to both profiles on all platforms (per build implication §20.14, item 15).

**Android-specific call log note (per FUB docs):** The agent's cell phone call log shows outbound calls from "[FUB number] + two tracking digits" at the end of the number.

**Google privacy restriction (per FUB docs, Android v2.2.0+):** Personal phone call activity cannot be auto-tracked. Manual logging is required for calls made outside the FUB app.

### 20.10.5 Android Caller ID (per FUB docs)

**Requirements:** Android 10+; Calling must be enabled first.

**Setup (4 steps):**
1. App Settings → check "Calling" box.
2. Check "Caller ID" box → Continue.
3. Set FUB as default Caller ID app in device settings.
4. If permissions not auto-granted: Settings → Apps → Follow Up Boss → Permissions → enable Phone and Notifications.

**Behavior:**
- Identifies incoming calls from CRM contacts.
- Settings apply per device, not account-wide.
- Both incoming and outgoing calls appear in native Android call history.

**Custom notification tones (per FUB docs):** Available on Google Pixel devices via Settings → Apps → Follow Up Boss → Notifications → Sounds. (Not available on all Android devices.)

### 20.10.6 Android Texting (per FUB docs)

Same A2P gate as iPhone. Without approval: texts redirect to Google Messages using personal cell (untracked).

Same "Always Text in App" toggle. Supported media: photos and videos. Templates available.

**"Text All" button:** Available on a contact with multiple phone numbers — sends to all numbers simultaneously.

**Limitation (per FUB docs):** File attachments not supported.

### 20.10.7 Android Emailing (per FUB docs)

Same compose paths as iPhone. **Difference:** reply arrow is in the **lower-right** (vs. upper-right on iPhone). CC/BCC, subject, body, templates. **Attachments not supported** (same documented limitation as iPhone).

### 20.10.8 Android Calendar (per FUB docs)

Same visual indicators as iPhone (tasks = checkbox, FUB appointments = pink circle, synced = green circle).

**Additional documented limitation (per FUB docs — Android-specific):** Historical appointments display as "overdue" regardless of actual completion status. (Not observed on iPhone.)

### 20.10.9 Android People Tab (per FUB docs)

Same two sub-tabs: **All Lists** / **Stages**.

**Admin filter (per FUB docs):** Toggle "Everyone" vs. individual agent(s) → Save. (Same as iPhone but with explicit Save button.)

Ponds: same gotcha as iPhone — must create a smart list on desktop first.

### 20.10.10 Android Recent (Activity) Tab (per FUB docs)

Displays a list of new/recently acquired contacts.

Admin capability: toggle between "Everyone" and individual "Agent(s)" → Save to filter by agent's new leads.

### 20.10.11 Android Deals Tab (per FUB docs)

Pipelines displayed as tabbed columns (Buyers, Sellers, Recruiting, custom). Stages below each tab; tap stage to see deals.

Deal card shows: close date, total deal value, commission value. Total value per stage displayed.

Filter menu (upper-left): Status (Current / Archived / All), User, Team.

**Documented limitation (per FUB docs):** "Deals are not visible on the lead profile within the Android app." Must use the Deals tab. **In-house CRM improvement:** Show deals on the lead profile on all platforms.

### 20.10.12 Android Lead Profile (per FUB docs)

| Tab | Contents |
|---|---|
| **Details** | Recent messages, contact info, address, relationships, assignment, source, stage, lender, collaborators, background info, activity, action plans, tags |
| **Communication** | Calls, emails, texts — view and reply |
| **Homes** | Website property activity |
| **Notes** | View, compose, react to notes |
| **Calendar** | Tasks and appointments for this lead |
| **Plans** | View, add, pause action plans |

Quick actions from Lead Profile: "+" button, lower-right.

### 20.10.13 Android In-App Notification Center (Bell, per FUB docs)

Same types as iPhone. Tap → marks read + navigates. "Mark all as read." **Documented limitation (per FUB docs):** Notification settings can only be modified on desktop — the Android notification center does not allow preference changes within the app.

### 20.10.14 Android Quick Actions ("+" Button, per FUB docs)

Exact actions (same 6 as iPhone, in slightly different order per docs):
1. Send Text
2. Make a Call (dial pad)
3. Send Email (templates, CC/BCC)
4. Add Person
5. Schedule Appointment
6. Add a Task

---

## 20.11 Caller ID — Cross-Platform Overview (per FUB docs)

| Scenario | Desktop display | Mobile display |
|---|---|---|
| Inbound from saved contact (1 inbox user) | Name only | Name and FUB number |
| Inbound from unknown number (1 inbox user) | Number only | Number only |
| Inbound to team inbox (2+ users) | Contact name/number + Team Inbox name | **Team inbox number only** |
| Outbound (any) | FUB number shown to recipient | FUB number shown to recipient |

**Spam protection (per FUB docs):** FUB Dialer includes spam label calling protection.

**In-house CRM:** Twilio handles the carrier-side caller ID for outbound calls (shows `541.703.3095` to recipients). For inbound identification in the web/mobile UI, the in-house Caller ID API endpoint returns the contact's name based on the calling number matched against `crm_people.phones[]`.

---

## 20.12 Phone Number System — Account Tiers (per FUB docs)

**Relevance:** The in-house CRM uses Twilio and the ported `541.703.3095` number instead of FUB's proprietary phone system. The feature parity targets are:

| FUB Capability | In-house equivalent |
|---|---|
| Company Number (inbound + two-way texting) | `541.703.3095` via Twilio |
| Agent individual numbers | Additional Twilio numbers per broker (if needed) |
| Agent numbers searchable by area code | Twilio number search API |
| Number portability on leaving | Twilio number owned by Ryan Realty LLC (already ported) |
| Outbound caller ID = FUB number | Outbound caller ID = `541.703.3095` |
| Call routing: desktop only / mobile only / both / voicemail | Configure Twilio call-forwarding webhook per user setting |

**Calling add-on equivalent:** The in-house system has no plan-tier gate; all brokers (Matt, Rebecca, Paul) have full calling/texting access via the shared Twilio account.

---

## 20.13 My Devices Panel (per FUB docs)

Accessible from: User avatar → "My Devices."

Displays a list of registered mobile devices (iOS and Android) for the logged-in user. Each device row:

| Field | Value |
|---|---|
| Device name | e.g. "Matt's iPhone 15 Pro" |
| Platform | iOS / Android |
| Last seen | Relative timestamp |
| Actions | "Send Test Notification" (fires a test push to that device) + "Remove" (force-logs out that device / removes push subscription) |

**In-house implementation:** The `push_subscriptions` table tracks per-device subscriptions. The "Send Test Notification" action sends a test push via APNs/FCM. "Remove" deletes the push subscription record and optionally invalidates the device token.

**Acceptance criteria — My Devices:**
1. Every mobile device that has enabled push notifications appears in the list.
2. "Send Test Notification" delivers a push to the device within 10 seconds.
3. "Remove" deletes the push subscription and the device disappears from the list.

---

## 20.14 Build Implications Summary — In-House CRM

The following numbered items are the actionable build requirements derived from FUB docs, mapped to the in-house CRM's existing architecture. Items are grouped by work surface.

### Notification Infrastructure

1. **Five-channel delivery system:** Implement in-app bell (badge + panel + mark-read), browser push (Web Push API / VAPID), mobile push (APNs + FCM), SMS (Twilio, already wired), and email (Resend, already wired). All five must be independently toggleable per user per event.
2. **Per-event × per-channel preference matrix:** `notification_preferences` table with `(user_id, event_type, channel, enabled)` unique key. Auto-save on toggle (no Submit). UI renders as a grid: event rows × 5 channel columns.
3. **Non-disableable team inbox missed-call email:** Implement as a system event outside the preference matrix that fires unconditionally to all account admins + inbox users.
4. **Notification data model:** `notifications` table with fields: `id, user_id, event_type, entity_type, entity_id, title, preview, channel, delivery_status, read_at, created_at`. Source of truth for badge counts and panel list.
5. **Desktop push 5-second rate limit:** Server-side: track `last_desktop_push_at` per user; skip dispatch if another push was sent within 5 seconds.

### Quiet Hours

6. **Timezone per broker:** `timezone` (IANA string) on the users/brokers table. Quiet hours computed in the assigned broker's local time.
7. **`queued_messages` table:** Fields per §20.5.7. Background job dispatches at 8:00 am agent local time (cron or Vercel scheduled function).
8. **Auto-cancel hook:** `crm_timeline` post-insert trigger checks `queued_messages` for the same `person_id`; cancels pending rows with `cancel_reason = 'auto_communication'`.
9. **Manual cancel UI:** Queued messages appear in the lead timeline with a "Cancel" link.
10. **Action plan emails bypass quiet hours:** The sequence engine must send action plan emails immediately, skipping the `queued_messages` table.

### Mobile App

11. **Caller ID API endpoint:** `GET /api/crm/caller-id` returns all active contact phone numbers for the authenticated user. iOS app polls this every 15 minutes (background) and immediately on new contact add. Response: `[{ phone: string, name: string, person_id: number }]`.
12. **A2P registration gate at compose:** Text compose screen checks Twilio A2P registration status. Unregistered state shows: "Business Registration required to send tracked texts. [Learn more]" — does not silently fall back to native SMS.
13. **"Always Text in App" toggle:** `always_text_in_app: boolean` on user record. When false, a chooser modal ("Use FUB number [tracked]" / "Use personal cell [untracked]") appears before each text send initiation.
14. **Mobile bell notification center:** Paginated `/api/crm/notifications` endpoint (read/unread state, `read_at`). Client: badge count on bell, tap-to-read, mark-all-read. **Improvement over FUB:** add filtering by type and mark-individual-read without navigation.
15. **3-way call logging normalization:** Log on both contact profiles for all platforms (unlike FUB's Android-only-logs-on-first-contact behavior). This is an explicit improvement.
16. **Deals on lead profile (Android gap fix):** The in-house lead detail must show associated deals on the lead profile on all platforms. Do not replicate FUB's Android gap.
17. **Email attachments:** Implement file attachment support in mobile email compose. FUB documents this as an explicit gap on both platforms; it is a confirmed improvement.
18. **Call auto-log minimum:** Apply 5-second minimum call duration filter before triggering the post-call note prompt on mobile (prevent prompt on hangups).
19. **Manual call log:** "Log Call" action from lead profile creates a `crm_timeline` record with `type = 'call'`, `call_outcome = 'manual_log'`, no telephony event.
20. **Admin-only mobile filters:** People tab "Filter by agent" and Calendar "view all team members" gated to `role = 'admin'` or `role = 'owner'` in the API layer.
21. **Android personal call tracking:** Cannot auto-track personal phone calls (Google privacy restriction). Manual "Log Call" is the only path; inform users in onboarding.
22. **Notification settings in mobile:** FUB requires desktop to change notification prefs. **Improvement:** expose the preference matrix in the mobile app's Settings section.
23. **Daily Hot Sheet job:** Scheduled email (cron: 7:00 am account timezone) per user with `hot_sheet_enabled = true`. Data: next 5 appointments, 5 newest leads (last 7 days), recent email open/click/web activity, 5 pending tasks. Send via Resend.
24. **Admin "notify all new leads" flag:** `notify_all_new_leads: boolean` on the user record. When true, system sends email on every new `crm_people` record creation with "Assigned to [Agent Name]" in subject. Visible and editable only by admin/owner.
25. **Team @mention logic:** @mentioning a team name notifies only the team leader. @mentioning a user adds that user as collaborator (not applicable to admins). @mentioning a team the author doesn't belong to is rejected at input.
26. **iOS Focus Mode / Silence Unknown Callers guidance:** In-app onboarding for notifications (shown once on first login from a mobile device) links to instructions for adding the CRM to Focus Mode allowed apps and disabling "Silence Unknown Callers."
27. **iPad:** No native iPad app. The full web CRM is the iPad solution. Add a banner prompt to install via Chrome as a PWA when the user accesses on an iPad user agent.
28. **Mobile queued message display:** Show accurate queue status in the mobile lead timeline (unlike FUB, which displays inaccurate status — a documented bug not to replicate).

---

## 20.15 Data Touched

**Entities read/written by this section:**

| Entity | Table | Fields |
|---|---|---|
| User notification prefs | `notification_preferences` (new) | user_id, event_type, channel, enabled |
| Notification records | `notifications` (new) | id, user_id, event_type, entity_type, entity_id, title, preview, channel, delivery_status, read_at, created_at |
| Queued messages | `queued_messages` (new) | id, person_id, assigned_agent_id, message_type, body, from_number, to_number, via_automation_id, scheduled_send_at, status, created_at, sent_at, cancelled_at, cancel_reason |
| Push subscriptions | `push_subscriptions` (new) | id, user_id, device_name, platform, endpoint, p256dh, auth, created_at, last_seen_at |
| User / broker settings | `brokers` (existing) | timezone, notify_all_new_leads, always_text_in_app, hot_sheet_enabled, personal_phone, calling_enabled |
| Timeline events | `crm_timeline` (existing) | type, direction, from_user_id, call_duration_seconds, call_outcome, recording_url |
| People / contacts | `crm_people` (existing) | phones[], stage, assigned_agent_id |
| Templates | `crm_templates` (existing) | type ('text' | 'email'), body |
| Deals | `tc_cycles` or `crm_deals` (existing) | Surfaced in lead profile on all platforms |

---

## 20.16 Acceptance Criteria (Master List)

### Notification Settings
1. Five-channel preference matrix auto-saves on toggle with zero latency for the user.
2. Settings changes affect only the current user's preferences.
3. Team inbox missed-call email fires regardless of preference settings.
4. Notification Settings page reachable from bell → gear AND from My Settings.

### Desktop Notification Center (Bell)
5. Badge count updates in real-time (within 30 seconds of event).
6. Clicking a notification navigates to the entity and marks it read.
7. Hover on blue dot shows × dismiss; clicking marks read without navigation.
8. "Mark All As Read" clears all unread in a single action.

### Desktop Browser Push
9. Web Push API / VAPID implemented; subscription stored per user per browser.
10. 5-second server-side rate limit suppresses rapid successive pushes.
11. Push payload carries click-through URL; clicking opens the correct record.

### Quiet Hours
12. Automated texts triggered 9 pm–8 am local agent time are queued, not sent.
13. Queue dispatches within 60 seconds of 8:00 am agent local time.
14. Any logged outbound communication auto-cancels pending queued messages for the same lead.
15. Action plan emails bypass the queue entirely.
16. Manual cancel from the lead timeline updates queue status immediately.

### Daily Hot Sheet
17. Email fires at or within 5 minutes of 7:00 am account timezone daily.
18. Content includes: appointments, up to 5 new leads (7-day window), recent activity, up to 5 tasks.
19. Opt-out toggle stops future deliveries for that user.

### New Lead Alerts
20. Lead assignment triggers immediate email to assigned agent.
21. SMS fires if agent has personal phone and text channel is enabled.
22. Admin `notify_all_new_leads` flag triggers email for all lead assignments with correct subject format.

### @Mentions
23. @mention autocomplete shows only users/teams/ponds the author belongs to.
24. Agent @mention adds collaborator AND sends notification email.
25. Team @mention notifies team leader only.
26. @mention a non-member team is rejected at input.

### iPhone / Android Calling
27. Outbound calls show agent's Twilio number to recipient.
28. Calls > 5 seconds trigger post-call note prompt; calls ≤ 5 seconds do not.
29. 3-way call logs on both contact profiles (all platforms).
30. Manual "Log Call" creates timeline entry without telephony event.

### iPhone / Android Texting
31. A2P registration status checked at compose; unregistered shows clear error.
32. Sent texts log to `crm_timeline`.
33. "Always Text in App" preference controls chooser modal behavior.

### iPhone / Android Email
34. Email compose fields: To, CC, BCC, Subject, Body (rich text), Template picker.
35. File attachments supported (improvement over FUB's documented limitation).

### Mobile Lead Profile
36. All tabs accessible on mobile: equivalent of Information, Communication, Homes, Notes, Calendar, Plans.
37. Deals visible on lead profile on all platforms (improvement over Android gap).

### Caller ID
38. Caller ID API endpoint returns full contact phone → name mapping for authenticated user.
39. New contacts trigger immediate endpoint refresh.
40. Team inbox inbound shows team inbox number (not contact name) on mobile display.

### My Devices
41. Registered devices listed with name, platform, last seen.
42. "Send Test Notification" delivers a push within 10 seconds.
43. "Remove" deletes subscription; device disappears from list.

---

## Sources

- **Official FUB documentation research file:** `/private/tmp/claude-501/-Users-matthewryan-RyanRealty/88224b2d-0fe3-4101-b4d4-1a010b28d992/scratchpad/fub-docs/notifications-mobile.md` (all 50 articles: 7 Notifications + 23 iPhone + 20 Android, researched 2026-06-30)
- **Prior spec:** `/Users/matthewryan/RyanRealty/docs/FUB_CRM_FEATURE_SPEC.md` — §4 (global UI shell), §16 (account menu / My Settings), §17 (cross-cutting systems — comms and compliance), §19 (gap map)
- **Repository mobile parity document:** `/Users/matthewryan/RyanRealty/docs/MOBILE_CRM_FUB_PARITY.md` (Matt directive 2026-06-16, updated 2026-06-26)
- **Repository memory files:** `project_twilio_cutover.md` (A2P + number port), `reference_fub_texting_phone_sent.md` (FUB texting API behavior)
- **Sibling spec sections cross-referenced:**
  - `17-communications-and-compliance.md` — unified timeline data model, `crm_timeline` schema, Twilio SMS/calling architecture
  - `16-account-menu-and-user-settings.md` — My Settings layout, My Devices panel, Power-Ups
  - `08-inbox.md` — Inbox folder model (My/Company), thread data model
  - `12-action-plans-and-automations.md` — action plan email bypass of quiet hours
  - `15-admin-company-team-and-roles.md` — admin role gates, team membership, pond configuration
- **No screenshots or GIF analyses available for this section** — all requirements sourced from official FUB documentation and repo docs.

### Prior-spec errors corrected by this section

1. **Notification architecture:** Prior spec described notifications as a single "notification prefs (inferred)" field in My Settings. Corrected to: a dedicated Notification Settings page with a full per-event × 5-channel matrix, auto-saved, accessed from the bell icon gear.
2. **Team inbox missed-call email:** Prior spec did not document this non-disableable email. Added as a hard system requirement.
3. **Quiet hours timezone basis:** Prior spec did not mention quiet hours at all. Documented as assigned-agent's timezone (not lead's timezone, not account timezone) — a critical compliance distinction.
4. **5-second desktop push rate limit:** Undocumented in the prior spec. Added as a hard implementation requirement.
5. **Caller ID sync cadence:** Not documented in prior spec. Added exact timing: immediate on new number, 15 min foreground, daily full sync.
6. **A2P gate behavior:** Prior spec mentioned A2P as a gate but not the silent-fallback-to-native-SMS failure mode. Added explicit error UI requirement.
7. **3-way call logging difference between platforms:** Not documented. Added: iPhone logs both profiles; Android logs first profile only; in-house CRM normalizes to both.
8. **Android deals-not-in-lead-profile gap:** Not documented in prior spec. Added as explicit improvement requirement.
9. **Email attachment limitation:** Not documented in prior spec. Added as an improvement opportunity (both platforms currently lack this in FUB).
10. **iOS Caller ID conflicts:** "Silence Unknown Callers" and Focus Mode suppression not documented. Added as onboarding/troubleshooting requirements.
11. **Daily Hot Sheet exact content:** Prior spec did not document the hot sheet at all. Added: 7 am delivery, 5 leads / 7-day window, 5 tasks, appointment sync.
12. **Admin "notify all new leads" exact email subject format:** Prior spec mentioned `notify_all_new_inquiries` field but not the "Assigned to [Agent Name]" subject-line format.
