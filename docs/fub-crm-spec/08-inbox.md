# Module 08: Inbox — Unified Communications

> **Sources:** Screenshots 24–28 (live FUB account `ryan-realty.followupboss.com`, captured 2026-06-30), GIF interaction-flow analysis `fub-analysis-gif/inbox.md` (18 frames), FUB official docs `fub-docs/inbox.md` (32 articles), `fub-docs/emailing.md` (43 articles), `fub-docs/texting.md` (30+ articles), `fub-docs/calling.md` (32 articles), prior spec `docs/FUB_CRM_FEATURE_SPEC.md` §8 (errors noted inline).
>
> **Prior-spec errors corrected here:** (a) Filter dropdown is channel-based (Emails / Texts / Calls checkboxes), NOT agent/source-based. (b) Company inbox URL is `/inbox-new/1/inbox/{threadId}`, not `/inbox-new/{threadId}/{id}`. (c) Internal-note placeholder is "Write a note or @mention someone", not "Write a note or a comment". (d) "Company Manager" label was a misread — Company threads show a "C" avatar. (e) Prior spec omitted: thread-assignee dropdown, Close/Reopen buttons, quick-tag row in compose, Send & Close compound action, bulk-select mode, Smart Messages, presence indicator, 5-second notification throttle, A2P gate on texting, quiet-hours enforcement, and voicemail transcription access-control. All corrected below.
>
> **Design note:** All colors, tokens, and component names below are mapped to the Ryan Realty design system (navy `#102742` / cream `#faf8f4`, Geist body, Amboqia display, shadcn/ui `@/components/ui/*`). FUB's native teal/blue is not replicated.

---

## 1. Overview

The Inbox is a unified communications hub that presents email, SMS, calls, voicemails, and Inbox App messages in a single email-client-style reader. It is the primary workspace for broker-to-contact conversations.

**Core value proposition:** every channel in one place, no switching between email client, phone log, and text thread.

**URL pattern:**

```
/crm/inbox/[scope]/[folder]/[threadId]
```

| Segment | Values | Notes |
|---|---|---|
| `scope` | `me` (My Inbox) \| `company` (Company / Team Inbox) | FUB uses numeric 0/1; use slugs in our routing |
| `folder` | `inbox` \| `assigned` \| `drafts` \| `sent` \| `closed` | Five folders per scope |
| `threadId` | conversation ID | Optional — omit to show thread list without a selected thread |

FUB live URLs observed:
- `ryan-realty.followupboss.com/2/inbox-new/0/inbox/32903` — My Inbox, Amy Mora email thread
- `ryan-realty.followupboss.com/2/inbox-new/0/assigned` — Assigned (empty state)
- `ryan-realty.followupboss.com/2/inbox-new/0/sent/32902` — Sent, Nadean TaberMartinez
- `ryan-realty.followupboss.com/2/inbox-new/0/closed/32895` — Closed, Ginny Schider
- `ryan-realty.followupboss.com/2/inbox-new/1/inbox/32773` — Company inbox, unknown caller (541) 207-9190

---

## 2. Three-Panel Layout

The Inbox uses a three-column layout. Proportions observed in screenshots:

```
┌─────────────────┬──────────────────────┬──────────────────────────────────┐
│  LEFT PANEL     │  CENTER PANEL        │  RIGHT PANEL                     │
│  Folder Tree    │  Thread List         │  Reading Pane + Contact Sidebar  │
│  ~15% width     │  ~28% width          │  ~57% width                      │
│                 │                      │  (reading pane ~70%, sidebar ~30%)│
└─────────────────┴──────────────────────┴──────────────────────────────────┘
```

**Implementation component:** `<Sheet>` from `@/components/ui/sheet` is NOT correct for this layout — use three `<div>` columns with CSS grid (`grid-cols-[auto,320px,1fr]` or similar responsive widths). The sidebar is collapsible (see §10.5).

---

## 3. Left Panel: Folder Tree

### 3.1 Structure

```
[Compose button — full width]

MY INBOX (559)
  ├── Inbox        [active state — highlighted]
  ├── Assigned
  ├── Drafts
  ├── Sent
  └── Closed

COMPANY (54)
  ├── Inbox
  ├── Assigned
  ├── Drafts
  ├── Sent
  └── Closed

[Header: 326 Unread Messages]  ← or 329, varies per screenshot
```

**Exact labels observed:**
- Section header: `My Inbox` followed by count in parentheses, e.g. `(559)` — this is the total thread count for the My Inbox scope, not just unread
- Second section: `Company` followed by count, e.g. `(54)` or `(99)` — varies
- Global unread header: `326 Unread Messages` (or `329` — count drifts between screenshots as auto-read fires; see §12.1)

**Active folder state:** highlighted with a navy `bg-primary/10` background on the folder row; left border accent `border-l-2 border-primary`.

**Count badges:** `<Badge variant="secondary">` from `@/components/ui/badge`, tabular numerals (`font-variant-numeric: tabular-nums`), right-aligned on each folder row.

**Compose button:** full-width button at top of left panel. Label: `Compose` or `+ Compose`. Maps to `<Button variant="default">` (navy background, cream text).

### 3.2 My Inbox vs. Company / Team Inbox

| Attribute | My Inbox | Company / Team Inbox |
|---|---|---|
| Scope | Per-user; shows only threads assigned to or involving this agent | Shared across all team members (admin-configurable) |
| Who sees it | The logged-in agent | All agents assigned to that Team Inbox |
| Assignment | Threads auto-assign based on contact's assigned agent | Routes per Team Inbox routing rules |
| Unknown callers | Appear in Company inbox only | Yes |
| Admin configuration | User's own settings | Admin-managed in Team Inbox Manage page |

An account can have multiple named Team Inboxes (observed: `Company`). Each Team Inbox has its own phone numbers, connected email, routing members, and voicemail greeting. See §14 (Team Inbox Manage).

### 3.3 Five-Folder Model

| Folder | Semantics | Close/Reopen button state |
|---|---|---|
| **Inbox** | Active, unresolved threads | Shows `Close` (coral/destructive variant) |
| **Assigned** | Explicitly routed to a specific agent | Shows `Close` |
| **Drafts** | Saved unsent draft replies | No Close/Reopen (draft state) |
| **Sent** | Outbound messages sent by the agent | No Close/Reopen (sent state) |
| **Closed** | Resolved / archived conversations | Shows `Reopen` (outlined/secondary variant) |

The folder a thread lives in is not a property of the message itself but of the conversation's current state. Moving a thread between My Inbox and Company scope can be accomplished via the assignment dropdown (see §8).

---

## 4. Center Panel: Thread List

### 4.1 Thread Row Anatomy

Each row in the thread list contains:

```
[unread dot] [contact avatar] [contact name]              [timestamp]
             [subject line or message preview]             [channel badge?]
             [channel type: EMAIL / TEXT / CALL / APP]
```

**Observed fields per row:**
- **Unread dot:** filled circle (navy `bg-primary`) on the left of the row when the thread has unread messages
- **Contact avatar:** circle with initials or photo, 32–40 px
- **Contact name:** `font-medium` Geist, truncated with ellipsis
- **Timestamp:** relative (`16 hours ago`, `Jun 26, 8:56 am`) — right-aligned, `text-muted-foreground text-sm`
- **Subject / preview:** truncated first line of message content, `text-muted-foreground text-sm`
- **Channel indicator:** visible on voicemail/call threads — shows call type + duration (e.g. `00:10`, `00:28`)

For **Company inbox voicemail threads** (shot-28), rows show:
- Phone number as the "contact" name (e.g. `(541) 207-9190`) when no contact is matched
- Duration label (e.g. `00:10`, `00:28`) visible in the row

**Presence indicator (documented behavior, inferred in UI):** A small avatar or dot appears on a thread row when another team member is currently viewing the same thread. Prevents duplicate responses. Confirmed in FUB docs; location within the row is not precisely captured in screenshots — implement as an overlapping avatar in the top-right corner of the row.

### 4.2 Filter Controls

**Observed in GIF (frame sequence — filter dropdown expansion):**

Above the thread list, a filter bar contains:
- **All / Unread toggle tabs** — switches between all threads and unread-only
- **`Filter` button** — opens a dropdown showing channel checkboxes:
  - `[✓] Emails`
  - `[✓] Texts`
  - `[✓] Calls`
  - Each is independently toggleable (multi-select)
  - When any filter is active, the button shows a badge: `Filter (N)` where N = number of active filters

**CORRECTION TO PRIOR SPEC:** The prior spec described this as "Filter dropdown (by agent/source — inferred)." This is incorrect. The filter is channel-based (Emails / Texts / Calls checkboxes), not by agent or source. Agent/source filtering is a People tab concern.

**Design:** `<DropdownMenu>` from `@/components/ui/dropdown-menu` with `<Checkbox>` from `@/components/ui/checkbox` per item. Badge: `<Badge>` overlaid on the Filter button trigger.

### 4.3 Empty States

Each folder has a distinct empty state:

**Assigned — empty state observed (shot-25):**
- Icon: person silhouette (gray)
- Heading: `Assigned is empty.`
- Onboarding card below with:
  - Video thumbnail (placeholder frame)
  - Heading: `Get Started Today`
  - Subheading: `How the Inbox helps you never miss important conversations`
  - Button: `How It Works` (styled as a pill, teal in FUB; map to `<Button variant="outline">`)

Other folders' empty states follow the same pattern with folder-appropriate messaging (inferred).

### 4.4 Bulk Select Mode

**Documented behavior:** A "Select conversations" affordance enables bulk operations:
- Mass mark read / mark unread
- Bulk close
- Bulk reopen
- Bulk assign to agent

Implementation: clicking a "Select" toggle or long-pressing a thread row enters bulk select mode; checkbox appears on each row; bulk action toolbar appears at top of list.

---

## 5. Reading Pane

### 5.1 Thread Header Bar

At the top of the reading pane, a persistent action bar:

```
[Contact Name / Phone Number]                    [Me ▾ | Company ▾]  [Close | Reopen]
[subject line]
```

**Elements:**
- **Contact name or raw phone number** (for unknown callers) — `text-lg font-medium`
- **Assignee dropdown** — shows `Me ▾` (My Inbox) or `Company ▾` (Company inbox). This is a `<Select>` or `<DropdownMenu>` — clicking it opens a list of agents and team inboxes to reassign the conversation. When a thread is reassigned, the assignee receives a push notification. (Documented behavior: triggers push notification to the new assignee.)
- **Close button** (Inbox / Assigned folders): coral or destructive-variant `<Button>`, label `Close`. Moves the thread to the Closed folder.
- **Reopen button** (Closed folder): outlined/secondary `<Button>`, label `Reopen`. Moves thread back to Inbox.
- **Close and Reopen are mutually exclusive** — only one appears at a time based on current folder.

### 5.2 Thread Body — Email Rendering

Full rich HTML emails render inline:
- Images embedded (listing photos, marketing banners, newsletter layouts)
- HTML tables, links, and formatting preserved
- Matt Ryan's full email signature renders at the bottom of sent messages (shot-26) — plain text contact block with name, title, phone, website

**Actions within the email thread (shot-26 and shot-27):**
- `Reply` button
- `Reply All` button
- `Forward` button

These appear below the email body or in the thread action bar. They open the inline compose area (see §7).

### 5.3 Thread Body — SMS / Text Thread

SMS threads render as a conversation bubble layout:
- Outbound messages: right-aligned, navy fill
- Inbound messages: left-aligned, secondary fill
- Timestamps between messages at appropriate intervals

### 5.4 Thread Body — Voicemail / Call Timeline

**Observed in shot-28 (Company inbox, unknown caller, three voicemail entries):**

Each voicemail item in the timeline shows:
```
[type label]    [date + time]    [duration]    [⬇ download]    [▶ play]
```

**Exact entries observed:**
1. `Jun 8, 11:41 am · 00:10` — with download + play controls
2. `Jun 10, 11:34 am · 00:28` — with label `Unknown → Matt Ryan` (routing label showing who call was assigned to), download + play controls
3. `Jun 10, 1:01 pm · 00:06` — with download + play controls

**Type label:** `Voicemail` or `Missed Call` text label preceding the timestamp.

**Controls:**
- `⬇` (download icon): downloads the voicemail audio file
- `▶` (play icon): inline audio player — plays voicemail in-browser without downloading

**Voicemail transcription (documented):**
- Appears below the audio controls when available
- Requires calling add-on
- Access-controlled: visible only to the assigned agent + admins — NOT visible to other Team Inbox members
- Can be searched via the inbox search bar (keyword search across transcriptions + call notes)

**Call entries (non-voicemail):** appear in the same timeline with a phone icon, call direction (inbound/outbound), duration, and play button if recorded.

**"Unknown → {agent name}" routing label:** on voicemail entries, this shows the routing decision: caller was unknown, routed to the named agent's inbox. When the caller is matched to a contact after Add Person (see §9), this label remains as historical context.

### 5.5 Thread Body — Inbox Apps

Third-party platform messages (e.g. Zillow, Realtor.com) appear in the thread with an `APP` badge. **Known behavior documented by FUB:** the preview in the thread list shows the FIRST message in the conversation, NOT the latest message. This is a documented bug/limitation in FUB — implement correctly (show latest message in preview).

### 5.6 "No communication yet" State

When a thread exists but has no messages (e.g. newly created Sent thread stub), the reading pane shows: `No communication yet` centered placeholder text. Observed in shot-26 for the Nadean TaberMartinez Sent thread right sidebar.

---

## 6. Contact Sidebar (Right Rail)

The rightmost portion of the reading pane contains a condensed contact card. It is collapsible (see §10.5).

### 6.1 Sidebar Sections

Observed sections in shot-24 (Amy Mora, email thread, My Inbox):

```
[Contact Name: Amy Mora]
[Last Communication: 16 hours ago]
─────────────────────────────────
RELATIONSHIPS
─────────────────────────────────
DETAILS
  Stage:  Real Estate Agent
  Agent:  Matt Ryan
  Lender: [empty]
─────────────────────────────────
RECENT CONVERSATIONS
─────────────────────────────────
ACTIVITY
─────────────────────────────────
[AgentFire FUB Widget]
```

Additional fields visible in shot-28 (far-right sliver showing full person detail when Add Person flyout is open):

| Section | Fields visible |
|---|---|
| Person fields | Source, Price, Timeframe, Tags |
| Enrichment fields | Net Worth, Income Range, Occupation, Has Children, Household Size, Marital Status, Gender, Birthday |

These enrichment fields come from BatchData or similar data enrichment providers (documented in FUB lead enrichment flow).

### 6.2 DETAILS Section

**Exact field labels observed:**
- `Stage` — text value (e.g. `Real Estate Agent`, `Lead`)
- `Agent` — broker name (e.g. `Matt Ryan`)
- `Lender` — broker name or empty

**Stage** in this context is the contact's pipeline stage (Lead, Active Buyer, Active Seller, etc.), not a deal stage. It maps to `crm_people.stage`.

### 6.3 Contact Phone / Email in Sidebar

Observed in shot-27 (Ginny Schider, Closed folder):
- Phone: `(503) 319-3646` — formatted as `(NXX) NXX-XXXX`
- Email: `gschider@guildmortgage.net`
- Stage: `Lead`
- Timestamp: `Jun 26, 8:56 am`

The phone number and email are clickable links (click-to-call, click-to-compose).

### 6.4 RECENT CONVERSATIONS

List of recent threads with the contact. Each entry shows channel icon + date + preview snippet. Links to that thread.

### 6.5 ACTIVITY

Activity feed of recent events on the contact (stage changes, tasks, automation enrollments, note additions). Mirrors the contact timeline but condensed.

### 6.6 AgentFire FUB Widget

A third-party widget section appearing at the bottom of the sidebar. Shows data from the AgentFire CRM integration. In our in-house build, this section is replaced with any configured CRM widget plugins, or omitted. Rendered via a plugin slot component.

### 6.7 Sidebar Collapse

The contact sidebar can be collapsed to maximize the reading pane width. Toggle: a collapse/expand icon button on the sidebar's left edge. Collapsed state: sidebar width → 0, reading pane expands. Persisted per user in local storage or user preferences.

---

## 7. Inline Reply Compose

**Critical distinction:** the compose area in FUB is NOT a modal. It expands inline below the thread body, within the reading pane. No overlay, no focus trap, no dialog.

### 7.1 Compose Expansion

**Observed in GIF (frame sequence — inline compose):**
1. Agent clicks `Reply` (or `Reply All` or `Forward`)
2. A compose area expands below the thread body — slides in, no modal
3. Compose area contains: the email signature pre-inserted (HTML block), cursor positioned above signature

### 7.2 Compose Toolbar

Rich-text formatting toolbar at top of compose area. Expected controls (standard email compose):
- Bold, Italic, Underline
- Bulleted list, Numbered list
- Link insertion
- Image insertion
- Font controls (size/family — inferred)
- Merge field inserter (see §7.5)
- Template selector (see §7.6)

### 7.3 Quick-Tag Row

**Observed in GIF (frame sequence showing tag pills below compose area):**

A row of quick-tag buttons appears in the compose area (below or above the body field):
- `+ Introduction`
- `+ Follow Up`
- `+ Still Buying`
- `+ Nurture Lead`
- `+ Custom`

Clicking a quick-tag button **adds that tag to the contact** instantly. The `+ Custom` button opens a tag input field for an arbitrary tag. These are contact-tagging shortcuts, not message templates — they fire a tag-add action on the contact profile.

**Design:** `<Badge variant="outline">` with a `+` prefix and hover state. Clicking fires a `tag:add` mutation.

### 7.4 Send Controls

A split-button arrangement at the bottom of the compose area:

```
[📎 Attachments]  [Templates]  [🕐 Schedule]   [🗑 Discard]
                                                [Send ▾] ← split button primary
                                               or [Send and Close]
```

- **Send** — primary action button (`<Button variant="default">`). Sends the reply, keeps thread open (remains in Inbox)
- **Send `▾`** — dropdown arrow on the Send button expands to reveal compound actions:
  - `Send and Close` — sends the reply AND moves thread to Closed folder in one action
  - `Send and Archive` — equivalent to Send and Close; both terms used in documentation
- **`🕐` Schedule** — opens a datetime picker to schedule the message for later delivery (respects quiet hours; see §15.3)
- **`🗑` Discard** — discards the draft. Confirmation prompt if content has been typed.
- **Attachments `📎`** — opens file picker. Attachments supported on 1:1 email sends. **Banned on:** batch emails and mobile compose (documented FUB limit).
- **Templates** — opens the email/text template picker inline. See §7.6.

### 7.5 Email Signature

Matt Ryan's email signature is **auto-inserted** into every new compose/reply in email threads. It renders as an HTML block at the bottom of the compose body, above which the cursor is placed. The signature is configured in user settings (Admin > My Settings > Email Signature).

**Observed signature content (shot-26):**
- Name: `Matt Ryan`
- Title/Role: [broker title]
- Phone and website
- Formatted as a plain-text block (no images in the observed signature, though HTML signatures are supported)

### 7.6 Template Picker

Clicking `Templates` in the compose bar opens an inline panel or dropdown listing saved email/text templates (for email compose = email templates; for SMS compose = text templates). Templates can be searched and previewed. Selecting a template populates the compose body. Merge fields in the template are substituted on send (not on insert into compose).

### 7.7 Smart Messages (AI Reply Suggestions)

**Documented feature (FUB Smart Messages, GIF-referenced, currently labeled closed beta / Smart Summary):**

A Smart Messages button in the compose area generates AI-suggested replies based on:
- Full communication history (texts, calls, emails, Inbox Apps messages)
- Agent notes and activity logs
- Full contact timeline

Agent must review and optionally edit before sending. Auto-send of AI suggestions is prohibited. Custom prompt field available.

**Implementation:** AI suggestion chip(s) above the compose body; clicking a suggestion populates the compose area. Custom prompt: text input "Ask AI to draft a message about..." with a submit button.

---

## 8. Thread Assignment

### 8.1 Assignee Dropdown

**Location:** top-right of the reading pane header (observed `Me ▾` in shot-24, `Company ▾` in shot-28)

**Behavior:**
- `Me ▾` — the thread is currently in My Inbox, assigned to the logged-in agent
- `Company ▾` — the thread is in the Company inbox (shared)
- Opening the dropdown shows a list of agents and team inboxes
- Selecting a target reassigns the conversation

**Effect of reassignment:**
- Thread moves from current inbox/scope to the target's inbox
- Push notification sent to the new assignee
- Thread appears in the target's Inbox folder

**Design:** `<Select>` or custom `<DropdownMenu>` trigger styled as a secondary button with chevron.

### 8.2 My Inbox vs Company Scope Routing

- When a thread is in Company inbox, it has a "C" avatar (circular badge with "C" letter) as the assignee indicator
- When a thread is in My Inbox, it shows the agent's avatar or initials
- Routing from Company → Me: agent "claims" the conversation by reassigning to themselves

---

## 9. Unknown Caller Flow

### 9.1 Trigger

An inbound call or text from a phone number not matched to any contact in the CRM lands in the **Company inbox** (scope = company). The thread is keyed by the raw phone number: `(541) 207-9190`.

### 9.2 Add Person Flyout

**Observed in shot-28 and GIF:**

The right panel of the reading pane shows an **Add Person** flyout/panel with:

**Fields:**
- `First Name` — text input
- `Last Name` — text input
- `Email` — text input (optional)

**Actions:**
- `Add person` — primary submit button; creates a new contact record and links the thread to it
- `or update an existing person` — secondary link/text that expands a search field to find an existing contact by name or number and merge the thread into their record
- `Search Google` — opens a Google search for the phone number in a new tab (manual research shortcut)

**Design:** `<Input>` components from `@/components/ui/input`, `<Button>` for submit, `<Label>` for each field. The flyout is an inline section within the right panel, not a `<Dialog>`.

### 9.3 Post-Add Behavior

After creating or linking the contact:
- The thread in the inbox now shows the contact's name instead of the raw phone number
- The contact card populates in the right sidebar
- Future calls/texts from that number route to this contact's assigned agent

---

## 10. Note Compose (Internal Notes)

### 10.1 Add Note Tray

**Observed in shot-26 (Sent thread, Nadean TaberMartinez):**

At the bottom of the reading pane, a persistent input tray:

```
[Write a note or @mention someone...]              [Create Note]    [N]
```

**CORRECTION TO PRIOR SPEC:** Prior spec described this as `"Write a note or a comment…"`. The exact placeholder text is `"Write a note or @mention someone"`.

**Elements:**
- Placeholder text: `Write a note or @mention someone`
- `Create Note` button — submits the note, visible to all CRM users with access to the contact
- `[N]` — keyboard shortcut badge indicating `N` triggers focus on the note input
- The tray is persistent (not toggled by a button), always visible at the bottom of the reading pane

### 10.2 @Mention System

Typing `@` in the note input opens a mention picker showing agent usernames:
- Shows agents only (not admin-only users per documented FUB behavior)
- Selecting an agent inserts `@username` inline in the note
- On save: the mentioned agent receives an **email notification** containing the full note content
- The mention creates a collaborator relationship — the mentioned agent can now see that contact's shared email thread (if "shared" access is configured)

**Access note:** mentioning an agent as a collaborator does NOT give them standard lead-event notifications. It specifically grants shared-email visibility per FUB docs.

### 10.3 Notes vs Messages

| Dimension | Note | Message |
|---|---|---|
| Visibility | Internal only — not sent to contact | Sent to contact via their channel |
| Recipients | CRM users with contact access, @mentioned agents | The contact |
| Location in timeline | Logged to contact timeline with "Note" type | Logged with channel type (email/text/call) |
| Compose location | Note tray at bottom of reading pane | Inline compose area (§7) |

---

## 11. Voicemail Inbox Behavior

### 11.1 Voicemail Entries

Each voicemail in the inbox thread shows (per shot-28 observation):
- Type label: `Voicemail`
- Date + time: `Jun 8, 11:41 am`
- Duration: `00:10` (MM:SS format)
- Routing label (when routed): `Unknown → {agent name}` (e.g. `Unknown → Matt Ryan`)
- `⬇` download button
- `▶` inline play button

### 11.2 Voicemail Transcription

**Location:** below the voicemail audio controls, in the same timeline entry

**Requires:** Calling add-on enabled on the account

**Access control (documented):**
- Visible to: the assigned agent for the contact + account admins
- NOT visible to: other Team Inbox members who are not the assigned agent

**Searchable:** keyword search in the inbox search bar returns voicemail transcription matches in the third column of the interface.

### 11.3 Missed Calls

Missed calls appear in the inbox alongside voicemails:
- Auto-close rule: **missed calls never auto-close** — must be manually closed
- Answered calls: can be configured to auto-close or remain open (per admin settings)
- Non-disableable behavior: when a call goes unanswered to a Team Inbox, an email notification is sent to all inbox users (except calls received outside business hours)

### 11.4 Call Recording

When call recording is enabled (account-level power-up, owner-only toggle):
- Audio player appears in call timeline entries
- Download button available
- **Deletion is impossible** — recordings cannot be deleted without deleting the entire contact. Hard-block delete endpoint for recording objects.
- Team Inbox transferred calls are recorded even if the individual user has recording excluded at the Teams level
- AI transcripts + summaries generated for calls 15 seconds to 60 minutes; not generated for transferred calls

---

## 12. Dynamic Behaviors (from GIF Analysis)

### 12.1 Auto-Read on Open

**Observed in GIF (frames: counter 325 → 324):**

When a thread is opened and the reading pane loads:
1. The thread's unread state transitions to read **immediately** (optimistic update — no round-trip wait)
2. The global unread count in the left panel header decrements: `325 Unread Messages` → `324 Unread Messages`
3. The unread dot on that thread row disappears

**Implementation:** fire a `PATCH /conversations/{id}/read` (or equivalent) on thread selection; update `useInboxStore.unreadCount` optimistically; rollback on API error.

**Separate count drift:** My Inbox section count `(559)` → `(557)` in GIF — this 2-unit drop suggests two threads were closed or moved during the session, not just read. The section count tracks total active threads, not unread count.

### 12.2 Filter Dropdown Interaction

**From GIF:**
1. Agent clicks `Filter` button in thread list
2. Dropdown expands showing three checkboxes: Emails, Texts, Calls (all checked by default)
3. Unchecking a channel hides matching threads from the list in real time (client-side filter)
4. `Filter (N)` badge appears on button showing number of active (non-default) filter states
5. Closing the dropdown retains filter state

### 12.3 Inline Compose Expansion

**From GIF:**
1. Agent opens a thread
2. Clicks `Reply` or `Reply All`
3. Compose area slides in below the thread body with a smooth expand animation
4. Auto-inserts HTML signature
5. Cursor positioned above signature
6. Quick-tag row appears (+ Introduction, + Follow Up, + Still Buying, + Nurture Lead, + Custom)

### 12.4 Presence Indicator

**Documented (not directly captured in static screenshots):**

A small avatar or "viewing" indicator on thread rows shows when another team member is currently viewing the same thread. Visible in the **thread list**, not inside the thread itself. Purpose: prevent two agents from sending duplicate replies.

**Implementation:** WebSocket or polling `GET /conversations/{id}/viewers` endpoint; render `<Avatar>` components (max 2-3) overlaid on the thread row.

### 12.5 Desktop Notifications

**Documented behavior:**
- Push notifications trigger on new inbound message (email, text, call, voicemail)
- **5-second throttle:** if multiple notifications arrive within 5 seconds, they are batched and shown as a single notification
- Browser permission required; notification shows contact name + message preview
- Badge counter on browser tab / dock icon updates

---

## 13. Sending Channels from the Inbox

### 13.1 Email vs. SMS Context

The compose area adapts based on thread context:
- **Email thread** → compose shows email toolbar (rich-text, HTML signature, cc/bcc, subject)
- **SMS thread** → compose shows SMS toolbar (character counter, emoji, media attach, template picker)
- **Call/voicemail thread** → compose shows note input or SMS option (no email compose for call threads)

### 13.2 Email Sending Rules

From `fub-docs/emailing.md`:

| Rule | Value |
|---|---|
| Login email vs. connected email | Two separate concepts. Login email = FUB account login. Connected email = Gmail/M365 account synced for inbox. Replies go from the connected email, not the login email. |
| Initial Gmail sync | 90 days of history on first connect |
| Reconnect sync | 2 days only |
| Gmail archive sync | Bidirectional — archiving in Gmail archives in FUB and vice versa |
| M365 archive sync | One-way only (FUB → M365; M365 archive does NOT sync back to FUB) |
| Batch email limit | 10,000 per day |
| Mandatory unsubscribe link | Required on all batch/marketing emails |
| Action plan email limit | 4 per contact per day (hard cap) |
| Action plan emails vs. quiet hours | Action plan emails send immediately even during 9PM-8AM; only text autoresponders queue |
| Send on behalf of | Admins can send batch emails on behalf of agents |
| Deduplication | Batch sends deduplicate per contact |
| Inline HTML only | No `<style>` blocks, no `<iframe>` in email templates |
| Unsubscribe block scope | Blocks marketing/batch emails only — does NOT block 1:1 replies |
| Resubscription | Manual only, via FUB support — no self-service UI |

### 13.3 SMS Sending Rules

From `fub-docs/texting.md`:

| Rule | Value |
|---|---|
| A2P 10DLC gate | Business Registration must be `Fully Registered` before ANY text can be sent. Registration prompt replaces compose window for unregistered accounts. For Ryan Realty: **A2P already verified** per project memory. |
| Maximum recommended length | 320 characters |
| Emoji character weight | ~80–90 characters each (affects 320-char limit) |
| Quiet hours | 9PM–8AM in the **assigned agent's** local timezone (NOT the contact's timezone) |
| Queued texts | Initial/autoresponder texts queued during quiet hours; released at 8AM |
| Auto-cancel queued | If any contact (inbound text, email, or call) occurs before 8AM, queued text is auto-canceled |
| Scheduled text window | Next 24 hours only |
| Scheduled text limit | 50 per 24-hour period (team-wide) + 1 per contact at a time |
| Auto-cancel scheduled | If any text or email to/from contact occurs after scheduling, scheduled text is auto-canceled |
| 1:1 only | Scheduled texts are 1:1 only (not group texts) |
| Opt-out keywords | STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT — must be honored immediately |
| Opted-out display | Phone number shown in orange on contact profile |
| First-touch compliance | Initial text must include: agent name, company name, purpose, and "Reply STOP to unsubscribe" |
| Company Number vs. user number | Without Dialer add-on: all texts from Company Number. With Dialer: texts from user's personal FUB number. |
| Number warmup | New FUB numbers cannot text US numbers during warmup period; can receive texts and make calls |
| Carrier filtering error | Code 30007: orange badge on message "The contact's mobile provider filtered your text before it could be delivered." Manual retry required. |
| Video attachment | Mobile only; desktop cannot send video. Under 5MB = inline MMS; over 5MB = browser redirect link |
| Group text limit | Up to 10 phone numbers total (sender + 9 recipients) |
| vCard per message | Up to 4 |
| Mass/drip texting | NOT supported natively. Third-party integration required (SendHub, Slick Text, Textedly, Voizee). |

### 13.4 Calling / Voicemail Rules

From `fub-docs/calling.md`:

| Rule | Value |
|---|---|
| Calling add-on | Required for personal FUB numbers, call lists, warm transfers. Company Number for texting/routing = included in all plans. |
| Outbound calling methods | Internet (VoIP), Mobile (bridge), Ask Each Time — selectable per user in settings |
| Call recording deletion | Impossible — cannot delete recordings without deleting entire lead profile. Hard-block in our system. |
| AI call summary scope | Calls 15 seconds to 60 minutes only. Not for transferred calls. |
| AI summary return time | Within 15 seconds of call end |
| Recording disclosure | Fixed message "This call is being recorded." Non-customizable. Plays before call starts. |
| Team Inbox transfer recording | Always recorded regardless of per-user exclusion |
| Voicemail drops | NOT native — external integrations only (CallAction, Mojo) |
| DNC scrubbing | NOT native — CallAction integration required |
| International | US and Canada only. Puerto Rico NOT supported. |
| Desktop calling hardware | USB headset required. 5/5 Mbps, ≤100ms ping, ≤30ms jitter. Laptop open + on charger. |
| Call list | Desktop only. Requires calling add-on. |
| Warm transfer | Desktop only. Put lead on hold → dial agent → merge or complete. |

---

## 14. Team Inbox Manage Page

### 14.1 Overview

The Team Inbox Manage page is accessed by inbox admins to configure shared inboxes.

**Observed in GIF (Team Inbox Manage page frames):**

**Page header:**
- `Team Inbox` heading + description text
- `New Team Inbox` button (primary, top right)
- `Add Number` button (secondary, top right)
- `How it works` link (info/help)

**Table columns:**
| Column | Content |
|---|---|
| Name | Team inbox display name (e.g. `Company`) |
| Phone Numbers | Assigned phone number(s) |
| Connected Email | Email account linked to this inbox (e.g. Gmail address) |
| Team | Team members assigned to receive calls/texts/emails from this inbox |
| Action | Edit / Delete controls (inferred) |

### 14.2 Team Inbox Configuration

Each Team Inbox configures:
- **Name** — display name shown in left panel
- **Phone Numbers** — one or more FUB phone numbers routed to this inbox
- **Connected Email** — a Gmail or M365 account synced for email receive/send
- **Team members** — which agents receive inbound calls/texts/emails from this inbox
- **Voicemail greeting** — custom audio file for unanswered calls
- **Call routing mode** — ring all members simultaneously, or round-robin
- **"Press 1 to Answer" mode** — available when 2+ mobile numbers are in the inbox (prevents calls from going to personal mobile voicemail instead of FUB voicemail)
- **Office hours / Do Not Disturb** — after-hours forwarding behavior

### 14.3 Non-Disableable Behaviors

When a call goes unanswered to a Team Inbox:
- An email notification is sent to all inbox users + all admins
- This behavior **cannot be disabled** in settings
- Exception: calls received outside configured office hours are excluded from this notification

---

## 15. Compliance, Limits & Guards

### 15.1 A2P Registration Gate

Before any SMS can be sent from the inbox, the account must have a `Fully Registered` A2P 10DLC status. The compose area for SMS threads must check this status and display a registration prompt if not yet approved.

**Registration statuses:** Not Started → Under FUB Review → Submitted to Carriers → Fully Registered (or Rejected at either stage).

**For Ryan Realty:** A2P already verified per project records. Status check can be a background validation.

### 15.2 Opt-Out Enforcement

- Before every outbound SMS send, check the recipient number's `text_opt_out` flag
- If `text_opt_out = true`: block send, show error "This contact has opted out of text messages"
- Opted-out numbers display in orange on the contact sidebar phone field
- Opt-out keywords (STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT): intercept in inbound Twilio webhook, set flag, log opt-out event to contact timeline

### 15.3 Quiet Hours Enforcement

- When agent schedules or triggers an SMS during 9PM–8AM **in the assigned broker's timezone**: queue the message
- Display queued status accurately — do NOT show as "sent" before delivery (this is a known FUB mobile bug we must avoid)
- Release queue at 8AM the next morning
- Auto-cancel queued message if any contact (inbound text, email, or call) occurs before 8AM

### 15.4 Email Unsubscribe

- Marketing/batch emails: include mandatory unsubscribe link
- Unsubscribe action: blocks future batch/marketing emails; does NOT block 1:1 replies from the inbox
- Resubscription: no self-service UI — requires support team intervention
- Display unsubscribed status on contact profile

### 15.5 TCPA Consent Windows

- Property/service inquiry: 90-day consent window
- Prior business relationship (sold/bought a home): 18-month consent window
- Display warning when texting a contact whose consent window has expired

### 15.6 First-Touch Compliance (SMS)

On first text to a contact with no prior text history:
1. Warn if agent name and company name are absent from the message body
2. Optionally auto-append "Reply STOP to unsubscribe" to the message
3. Log as a compliance event on the contact timeline

### 15.7 Carrier Filtering Warning

When a sent SMS receives error code 30007 (carrier filtered):
- Mark the message with an orange badge
- Display: "The contact's mobile provider filtered your text before it could be delivered."
- No auto-retry — agent must manually reword and resend

---

## 16. Merge Fields

Available in both email and SMS templates and compose areas. Syntax: `%field_name%` tokens (SMS/FUB template syntax) or `{field_name}` (email template syntax — per shot observation showing `{first_name}` in template editor).

**Contact fields:**
| Token | Inserts |
|---|---|
| `%contact_name%` | First + last name |
| `%contact_first_name%` | First name only |
| `%contact_last_name%` | Last name only |
| `%contact_email%` | First email on profile |
| `%contact_phone%` | First phone number |
| `%contact_address%` | Full address |
| `%contact_city%` | City |
| `%contact_state%` | State |
| `%contact_zipcode%` | Zip code |

**Agent fields (assigned agent):**
| Token | Inserts |
|---|---|
| `%agent_name%` | Full name |
| `%agent_first_name%` | First name |
| `%agent_email%` | Login email |
| `%agent_phone%` | Personal/dialer number |
| `%agent_mobile_phone%` | Mobile number |
| `%agent_merge_field%` | Customizable personal text |

**Lender fields (assigned lender):**
| Token | Inserts |
|---|---|
| `%lender_name%` | Full name |
| `%lender_first_name%` | First name |
| `%lender_email%` | Login email |
| `%lender_phone%` | Number |
| `%lender_merge_field%` | Customizable personal text |

**Sender fields (person composing):**
| Token | Inserts |
|---|---|
| `%sender_name%` | Full name |
| `%sender_first_name%` | First name |
| `%sender_email%` | Login email |
| `%sender_phone%` | Number |

**Property fields:**
| Token | Inserts |
|---|---|
| `%inquiry_address%` | Street of most recent property inquiry |
| `%inquiry_address_url%` | URL of most recent inquiry property |
| `%inquiry_address_preview%` | Image, address, description |
| `%viewed_address%` | Last viewed property street |
| `%viewed_address_url%` | Last viewed property URL |
| `%last_5_preview%` | Details and images of 5 most recently viewed |

**Other:**
| Token | Inserts |
|---|---|
| `%lead_source%` | Most recent inquiry source |
| `%greeting_time%` | "morning" / "afternoon" / "evening" based on sender timezone |

**Custom merge fields:** based on custom fields created by account owner. Available in template composer dropdown.

---

## 17. Data Model

### 17.1 Entities

**`crm_conversations`** — the Inbox thread record

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `contact_id` | uuid nullable | FK → `crm_people`. Null for unknown callers until Add Person |
| `scope` | `enum('my','company')` | My Inbox vs. Company/Team Inbox |
| `folder` | `enum('inbox','assigned','drafts','sent','closed')` | Current folder state |
| `team_inbox_id` | uuid nullable | FK → `crm_team_inboxes` if scope = company |
| `assigned_user_id` | uuid nullable | FK → `users` — current assignee |
| `subject` | text | Email subject or phone number for call/SMS threads |
| `channel` | `enum('email','sms','call','voicemail','app')` | Primary channel |
| `unread_count` | integer | Unread message count for this thread |
| `last_message_at` | timestamptz | For thread list sorting |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**`crm_messages`** — individual messages within a conversation

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `conversation_id` | uuid | FK → `crm_conversations` |
| `contact_id` | uuid nullable | FK → `crm_people` |
| `user_id` | uuid nullable | FK → `users` (broker who sent, if outbound) |
| `direction` | `enum('inbound','outbound')` | |
| `channel` | `enum('email','sms','call','voicemail','note','app')` | |
| `body` | text | Message body (HTML for email, plaintext for SMS) |
| `subject` | text nullable | Email subject |
| `from_address` | text | Email address or phone number |
| `to_address` | text | Recipient |
| `is_read` | boolean | Per-message read state |
| `sent_at` | timestamptz | |
| `delivered_at` | timestamptz nullable | Populated from Twilio delivery callback |
| `status` | `enum('queued','sent','delivered','failed','carrier_filtered')` | |
| `error_code` | text nullable | e.g. `30007` for carrier filter |
| `is_note` | boolean | True for internal notes |
| `mentioned_user_ids` | uuid[] | @mentioned agents |
| `attachments` | jsonb | Array of `{filename, url, size, content_type}` |
| `recording_url` | text nullable | For call messages |
| `recording_duration_sec` | integer nullable | Call/voicemail duration in seconds |
| `transcription_text` | text nullable | Voicemail/call transcription |
| `ai_summary` | jsonb nullable | AI call summary `{lines: [{text, action_items}]}` |

**`crm_team_inboxes`** — shared Team Inbox configuration

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | Display name (e.g. `Company`) |
| `phone_numbers` | text[] | Assigned FUB/Twilio numbers |
| `connected_email` | text nullable | Gmail/M365 address |
| `voicemail_greeting_url` | text nullable | Audio file for unanswered calls |
| `call_routing_mode` | `enum('simultaneous','round_robin')` | |
| `press_1_to_answer` | boolean | Requires 2+ mobile numbers |
| `office_hours` | jsonb nullable | `{days: [...], start: '09:00', end: '17:00', timezone: '...'}` |
| `member_user_ids` | uuid[] | Routing members |
| `created_at` | timestamptz | |

**`crm_conversation_viewers`** — presence indicator

| Column | Type | Notes |
|---|---|---|
| `conversation_id` | uuid | FK → `crm_conversations` |
| `user_id` | uuid | FK → `users` |
| `last_seen_at` | timestamptz | Updated on each page view; evict after 30s |

**`crm_text_opt_outs`** — SMS opt-out tracking

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `phone_number` | text | E.164 format |
| `opted_out_at` | timestamptz | |
| `keyword_used` | text | STOP / UNSUBSCRIBE / etc. |
| `contact_id` | uuid nullable | FK → `crm_people` if known |

### 17.2 Existing Tables to Leverage

Per the in-house CRM already built:
- `crm_timeline` — universal event log; Inbox messages should write events here with `event_type` matching the channel
- `crm_people` — contact record; `phone_opt_out` flag, `email_unsubscribed` flag
- `brokers` — broker records including `twilio_number` (source of truth per project memory)

---

## 18. Design System Mapping

All components must use `@/components/ui/*` (shadcn/ui re-skinned to Ryan Realty tokens). No raw HTML controls on any inbox surface.

| Inbox element | Component | Token / class |
|---|---|---|
| Thread row | custom `<div>` within a virtualized list | `bg-card hover:bg-accent/5` |
| Unread dot | `<div className="w-2 h-2 rounded-full bg-primary">` | `bg-primary` (navy) |
| Folder active state | custom left-border highlight | `border-l-2 border-primary bg-primary/5` |
| Count badges | `<Badge variant="secondary">` | tabular numerals |
| Close button | `<Button variant="destructive">` | coral/red per shadcn destructive |
| Reopen button | `<Button variant="outline">` | navy outline |
| Assignee dropdown | `<Select>` or `<DropdownMenu>` | secondary style |
| Send button (primary) | `<Button variant="default">` | navy fill |
| Send ▾ split | Custom split with `<Button>` + `<DropdownMenu>` | |
| Discard button | `<Button variant="ghost">` | |
| Quick-tag pills | `<Badge variant="outline">` + click handler | `cursor-pointer hover:bg-accent/10` |
| Note input tray | `<Textarea>` from `@/components/ui/textarea` | |
| Filter dropdown | `<DropdownMenu>` + `<Checkbox>` per item | |
| Add Person form | `<Input>`, `<Label>`, `<Button>` | |
| Contact sidebar | `<Card>` sections with `<Separator>` | `bg-card border-border` |
| Voicemail play button | `<Button variant="ghost" size="icon">` | |
| Character counter (SMS) | `<span className="text-muted-foreground text-xs">` | warning state at >280 chars |
| Presence avatar | `<Avatar className="w-5 h-5">` overlaid on thread row | |
| Carrier filter warning badge | `<Alert variant="warning">` | |
| Opt-out phone display | orange text or `<Badge variant="warning">` | |
| Keyboard shortcut badge [N] | `<kbd>` element styled with `bg-muted rounded` | |

**Typography:**
- Section headings in left panel: Geist `text-xs uppercase tracking-wider text-muted-foreground`
- Contact name in thread list: Geist `font-medium text-sm`
- Timestamp: Geist `text-xs text-muted-foreground`
- Note placeholder: Geist `text-sm text-muted-foreground italic`
- Voicemail duration: Geist `font-mono text-sm` (tabular numerals)

**Colors:**
- Unread dot: `bg-primary` (`#102742`)
- Active folder highlight: `bg-primary/5` with `border-l-2 border-primary`
- Opted-out phone: `text-orange-500` (or `text-warning` if warning token defined)
- Carrier filter badge: `text-orange-500 bg-orange-50`
- Company inbox "C" avatar: `bg-primary text-primary-foreground` (navy with cream letter)

---

## 19. Acceptance Criteria

1. **AC-01 — Three-panel layout:** The inbox renders in three panels (folder tree / thread list / reading pane + contact sidebar) at all viewport sizes ≥ 1024px. Below 1024px, the layout stacks or uses a sheet pattern.

2. **AC-02 — Folder tree with live counts:** Folder tree shows My Inbox with sub-folders (Inbox, Assigned, Drafts, Sent, Closed) and Company inbox with the same five sub-folders. Each folder row shows a live thread count badge. Counts update without full page reload.

3. **AC-03 — Active folder highlight:** The currently selected folder has a left border accent and background highlight. Only one folder is active at a time.

4. **AC-04 — Thread list — All / Unread toggle:** The All/Unread toggle filters the thread list to show all threads or only unread threads. State persists during the session.

5. **AC-05 — Channel filter:** The Filter button opens a dropdown with Emails, Texts, and Calls checkboxes (all enabled by default). Toggling any checkbox filters the thread list in real time. A `Filter (N)` badge appears when any non-default state is active.

6. **AC-06 — Thread row fields:** Each thread row shows: unread dot (when unread), contact avatar, contact name, subject/preview (truncated), and relative timestamp. Phone-number threads (unknown callers) display the raw number as the name.

7. **AC-07 — Auto-read on open:** Opening a thread immediately marks it as read and decrements the global unread count. No manual "mark as read" click required.

8. **AC-08 — HTML email rendering:** Rich HTML emails render inline in the reading pane with images, tables, links, and formatting preserved. An email newsletter (multi-column layout with images) must render without layout breakage.

9. **AC-09 — SMS bubble layout:** SMS threads render as a conversation bubble layout (outbound right-aligned, inbound left-aligned) with timestamps between messages.

10. **AC-10 — Voicemail timeline:** Voicemail entries show type label, date+time (Jun 8, 11:41 am format), duration (MM:SS), download button, and inline play button. Transcription text appears below audio controls when available (for assigned agent + admins only).

11. **AC-11 — Read pane header — Close/Reopen:** Threads in Inbox/Assigned folders show a `Close` button (destructive style). Threads in the Closed folder show a `Reopen` button (outline style). The two buttons never appear simultaneously.

12. **AC-12 — Assignee dropdown:** The assignee dropdown (top-right of reading pane) shows `Me` or `Company` and a chevron. Opening it lists available agents and team inboxes. Selecting a new assignee reassigns the thread.

13. **AC-13 — Inline compose — no modal:** Clicking Reply/Reply All/Forward expands a compose area inline below the thread body. No dialog or modal is used.

14. **AC-14 — Email signature auto-insert:** The compose area pre-populates with the logged-in broker's HTML email signature. The cursor is positioned above the signature.

15. **AC-15 — Quick-tag row:** The compose area shows quick-tag pills: `+ Introduction`, `+ Follow Up`, `+ Still Buying`, `+ Nurture Lead`, `+ Custom`. Clicking a tag adds it to the contact and updates the contact's tag list immediately.

16. **AC-16 — Send & Close compound action:** The Send button's dropdown includes a `Send and Close` option that sends the reply and simultaneously moves the thread to the Closed folder in one action.

17. **AC-17 — Note tray:** The note tray is permanently visible at the bottom of the reading pane. Placeholder: `Write a note or @mention someone`. `Create Note` button submits. `N` keyboard shortcut focuses the note input.

18. **AC-18 — @mention system:** Typing `@` in the note input opens an agent picker. Selecting an agent inserts `@username` inline. On note save, the mentioned agent receives an email notification with the full note content.

19. **AC-19 — Unknown caller — Add Person:** When a Company inbox thread is keyed by a raw phone number (no contact match), the contact sidebar shows an Add Person form with First Name, Last Name, Email inputs, an `Add person` submit button, an `or update an existing person` search option, and a `Search Google` external link.

20. **AC-20 — Post-Add Person:** After creating or linking a contact via Add Person, the thread shows the contact's name (not the phone number), and the contact card populates in the sidebar.

21. **AC-21 — A2P registration gate:** If the account's A2P 10DLC registration is not `Fully Registered`, the SMS compose area is replaced with a registration prompt. No SMS can be sent until registration is approved.

22. **AC-22 — Quiet hours enforcement:** SMS messages attempted between 9PM–8AM in the assigned broker's timezone are queued (not sent immediately). The UI shows the message as "Queued — delivering at 8:00 AM" (not "Sent"). Queued messages are auto-canceled if any contact occurs before 8AM.

23. **AC-23 — Opt-out blocking:** Attempting to send an SMS to a contact whose phone number has `text_opt_out = true` shows an error and blocks send. The phone number displays in orange in the contact sidebar.

24. **AC-24 — Carrier filter display:** A message that receives error 30007 shows an orange indicator with text: "The contact's mobile provider filtered your text before it could be delivered." No auto-retry; agent must manually resend.

25. **AC-25 — Presence indicator:** When another team member is viewing the same thread, a small avatar indicator appears on the thread row in the thread list.

26. **AC-26 — 5-second notification throttle:** Multiple inbound notifications arriving within 5 seconds are batched into a single desktop notification.

27. **AC-27 — Voicemail transcription access control:** Voicemail transcription text is visible only to the contact's assigned broker and account admins. Other Team Inbox members who open the same thread do NOT see transcription text.

28. **AC-28 — Call recording deletion block:** The delete endpoint for call recording objects returns 403. Recordings can only be removed by deleting the entire contact record.

29. **AC-29 — Bulk select mode:** A "Select" toggle enters bulk mode where each thread row shows a checkbox. Bulk actions available: mark read, mark unread, close, reopen, assign.

30. **AC-30 — Empty state per folder:** Each folder shows a folder-appropriate empty state when no threads exist. The Assigned empty state specifically shows: person silhouette icon, `Assigned is empty.` text, and an onboarding card with a video thumbnail and `Get Started Today` / `How It Works` content.

31. **AC-31 — Team Inbox Manage:** The Team Inbox Manage page shows a table of inboxes with columns: Name, Phone Numbers, Connected Email, Team, Action. `New Team Inbox` and `Add Number` buttons are present.

32. **AC-32 — Sidebar collapse:** The contact sidebar (right rail) has a collapse toggle. Collapsed state hides the sidebar entirely, expanding the reading pane. State persists in user preferences.

33. **AC-33 — SMS character counter:** The SMS compose area shows a live character count. Counter color changes to warning state at >280 characters. A carrier-filtering risk warning appears at >320 characters.

34. **AC-34 — Template picker:** Both email and SMS compose areas include a Templates button that opens a searchable template picker. Selecting a template populates the compose body. Merge fields substitute on send.

35. **AC-35 — No modal for unknown-caller Add Person:** The Add Person form is an inline panel within the reading pane, not a Dialog/Sheet.

---

## 20. Sources

| Source | File | Key contribution to this spec |
|---|---|---|
| Screenshot 24 | `fub-analysis/shot-24.md` | Three-panel layout proportions; Amy Mora email thread; right sidebar fields (Stage, Agent, Lender, Last Communication); URL `/inbox-new/0/inbox/32903`; My Inbox (559), Company (14), 329 unread |
| Screenshot 25 | `fub-analysis/shot-25.md` | Assigned folder empty state ("Assigned is empty." + onboarding card + "Get Started Today" + "How It Works" pill); My Inbox (559), Company (54), 326 unread |
| Screenshot 26 | `fub-analysis/shot-26.md` | Sent folder; Matt Ryan's HTML email signature rendered inline; Reply/Reply All/Forward buttons; Note tray exact placeholder text "Write a note or @mention someone"; `[N]` keyboard shortcut badge; URL `/inbox-new/0/sent/32902` |
| Screenshot 27 | `fub-analysis/shot-27.md` | Closed folder; `Reopen` button (not Close); Ginny Schider contact fields ((503) 319-3646, gschider@guildmortgage.net, Stage: Lead); Guild Mortgage newsletter rendered inline; URL `/inbox-new/0/closed/32895` |
| Screenshot 28 | `fub-analysis/shot-28.md` | Company inbox scope 1; unknown caller (541) 207-9190; voicemail timeline (3 entries with exact timestamps + durations + routing label "Unknown → Matt Ryan"); "C" company avatar; `Company ▾` dropdown; Add Person flyout (First/Last/Email/Add person/search/"Search Google"); enrichment fields in far-right sliver; URL `/inbox-new/1/inbox/32773` |
| GIF Analysis | `fub-analysis-gif/inbox.md` | Filter dropdown (Emails/Texts/Calls checkboxes); inline compose expansion; quick-tag row (exact labels: + Introduction / + Follow Up / + Still Buying / + Nurture Lead / + Custom); auto-read decrement 325→324; My Inbox count drift 559→557; Add Person flyout interaction; Team Inbox Manage page (table columns + New Team Inbox + Add Number + How it works buttons) |
| FUB Docs — Inbox | `fub-docs/inbox.md` | Five-folder model; dual inbox types (My vs. Company); 5-second notification throttle; non-disableable missed call email to all admins+routing members; @mention→collaborator behavior; presence indicator in thread list (not inside thread); assignment push notification; auto-close rules (answered optional, missed never); voicemail transcription access control (assigned agent + admins only); call recording immutability; role/permission matrix; bulk select mode; Smart Messages/Smart Summary; Inbox Apps "first message not latest" known bug |
| FUB Docs — Emailing | `fub-docs/emailing.md` | Login email vs. connected email distinction; 90-day initial Gmail import / 2-day reconnect; Gmail bidirectional archive / M365 one-way; merge fields syntax + full field list; batch 10,000/day limit; mandatory unsubscribe on batch; 4 action-plan emails/contact/day hard cap; "Send and Close" compound action; attachments banned on batch + mobile; inline HTML only (no style/iframe); unsubscribe blocks marketing not 1:1; resubscription = manual via FUB support; domain auth via Entri |
| FUB Docs — Texting | `fub-docs/texting.md` | A2P 10DLC hard gate (Fully Registered required before any text); 320-char max; emoji = 80–90 chars each; quiet hours 9PM–8AM using **agent's timezone not contact's**; auto-cancel chain for queued and scheduled texts; 50/day team-wide scheduled limit + 1-per-contact; template performance score (7-day minimum, percentile-based); first-touch compliance as a scored metric; opt-out orange display; carrier filter error code 30007; group text max 10 numbers; vCard max 4; drip/mass texting not native; A2P registration December 2024 hard deadline; API /textMessages is LOG ONLY (does not send SMS) |
| FUB Docs — Calling | `fub-docs/calling.md` | Three calling methods (Internet/Mobile/Ask); voicemail system (no storage limit); transcription access-control; call recording immutable (cannot delete without deleting lead); Team Inbox transfers always recorded; AI summary: 15s–60min scope only, not for transferred calls, 15-second return time; recording disclosure fixed message "This call is being recorded."; call list (desktop only); warm transfer (desktop only); DNC scrubbing not native; desktop hardware requirements (5/5 Mbps, ≤100ms ping, ≤30ms jitter); parking lot 20-day retention; press-1-to-answer requires 2+ mobile numbers |
| Prior spec §8 | `docs/FUB_CRM_FEATURE_SPEC.md` lines 425–444 | Base structure reference; errors corrected: filter type, Company inbox URL, note placeholder text, "Company Manager" label, missing elements listed in header corrections |
