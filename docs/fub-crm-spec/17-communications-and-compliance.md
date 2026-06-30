# Cross-Cutting: Communications Layer & Compliance

This section specifies the complete multi-channel two-way communications layer and the non-negotiable compliance system that gates every send path. These systems are cross-cutting: they underpin the Person detail timeline (§07b), the Inbox (§08), Reporting (§11), Action Plans / Automations (§13), bulk operations (§05), and every outbound message fired by the sequence engine. A developer who has never seen Follow Up Boss must be able to build the entire layer from this section alone.

All design maps to the Ryan Realty design system: navy `#102742` / cream `#faf8f4`, Geist for body/UI, Amboqia Boriango for display headings, shadcn/ui `@/components/ui/*` components, `bg-primary` / `text-primary-foreground` tokens throughout. FUB's teal/blue chrome does not carry over; only the functional behavior is reproduced.

---

## 17.1 Unified Timeline — The Single Canonical Write Target

Every communication event across every channel writes one record to the unified `crm_timeline` table before any channel-specific store. This is the source of truth that all inbox threads, contact feeds, and filters read from.

### Data structure per event
```ts
interface TimelineEvent {
  id: string
  person_id: number                    // FK crm_people
  type: TimelineEventType              // see enum below
  direction: 'inbound' | 'outbound'
  from_user_id?: number                // broker who sent (outbound)
  from_address?: string                // email or phone
  to_address: string                   // recipient email or phone
  subject?: string                     // email only
  body_preview?: string                // first 200 chars of body
  body_html?: string                   // full HTML (email)
  body_text?: string                   // SMS body
  via_automation?: boolean             // sent by sequence engine
  via_batch?: boolean                  // sent as batch
  batch_job_id?: string
  has_attachment?: boolean
  attachment_urls?: string[]
  open_count?: number                  // email open tracking
  click_count?: number                 // email click tracking
  is_bounced?: boolean
  is_unsubscribed?: boolean
  carrier_filtered?: boolean           // SMS 30007 error
  recording_url?: string               // call/voicemail
  transcription_text?: string          // call/voicemail
  ai_summary?: string                  // call AI summary
  call_duration_seconds?: number
  call_outcome?: CallOutcome
  tracking_pixel_url?: string          // _pxl= URL for opens
  starred?: boolean
  created_at: Date
  updated_at: Date
}

type TimelineEventType =
  | 'email'
  | 'text'
  | 'call'
  | 'voicemail'
  | 'note'
  | 'task'
  | 'appointment'
  | 'stage_change'
  | 'automation'
  | 'web_activity'
  | 'deal_change'
  | 'person_change'
  | 'system'

type CallOutcome =
  | 'connected'        // > 60 seconds
  | 'conversation'     // > 120 seconds
  | 'no_answer'
  | 'left_voicemail'
  | 'voicemail'        // inbound voicemail left
  | 'busy'
  | 'failed'
  | 'missed'
```

### Timeline filter tabs (Person detail center column)
Observed in shot-01 and shot-15. Horizontal tab bar pinned above the feed:

| Tab icon | Label | Count badge source |
|---|---|---|
| `≡` list icon | All | (no count; shows everything) |
| Envelope icon | (email filter) | `email` type events |
| Speech-bubble small | (note filter) | `note` type events |
| Phone handset | (call filter) | `call` + `voicemail` type events |
| Pin/thumbtack | (task filter) | `task` type events |
| Person silhouette | (person filter) | `person_change` + relationship events |
| Automation/hand icon | (automation filter) | `automation` type events |
| Star icon | (starred filter) | `starred = true` events |

`Filters` dropdown button (right-aligned, chevron `↓`): opens additional filter options (date range, sending agent). Clicking any filter tab re-renders the feed showing only that event type.

### Timeline feed item anatomy (all channels)
Each item row (variable height):
- **Left column:** Colored filled circle avatar (initial or photo of sending broker), ~36px
- **Header line:** `[Sender Name] → [Recipient Name]` with `↓` dropdown to expand full headers/recipients
- **Meta line:** `[Date string]` · `via automation` green pill (if `via_automation = true`) · `via batch email` (if `via_batch = true`) · open/click count badges (green pills) · attachment paperclip icon `📎` (if `has_attachment = true`)
- **Subject/action line (bold):** email subject, call outcome label, or SMS preview
- **Body preview:** first ~100 chars of body text
- **Action row (right side, on hover or always):** `Reply` (with reply-arrow icon) | forward icon `↩↩` | `···` three-dot more menu; star `☆` icon for bookmarking
- **"View campaign email" link:** blue teal link shown below body preview when `via_automation = true` — opens the original campaign email template in a modal/preview panel

Unread state: left border accent (2px `bg-primary` navy) + sender name bold weight.
Read state: no border, regular weight.

---

## 17.2 Email Channel

### 17.2.1 Email identity concepts (two distinct concepts — both must be modeled)

| Concept | Field | Used for | Requirement |
|---|---|---|---|
| **Login email** | `brokers.email` | FUB system notifications, `%agent_email%` merge field, sends Action Plan emails when no connected email configured | Any valid email |
| **Connected email** | `broker_email_connections.address` | Two-way sync, 1:1 send, Batch email send, removes "sent via" attribution | Google Workspace or Microsoft 365 only (per FUB docs) |

**Critical (per FUB docs):** When the login email and connected email are different addresses, Action Plan emails send from the login email and 1:1/Batch emails send from the connected email. This creates two separate sending identities with potentially different reputations. Our build should warn when these differ and recommend matching them.

**Hard limit:** One connected email per user. No aliases — primary address only (per FUB docs).

### 17.2.2 Email connection setup
Settings path: `My Settings > Email > Sign in with Google / Sign in with Microsoft`

OAuth flow → store per-user access/refresh token in `broker_email_connections`:
```ts
interface BrokerEmailConnection {
  id: string
  broker_id: number
  provider: 'google' | 'microsoft'
  address: string
  access_token: string         // encrypted at rest
  refresh_token: string        // encrypted at rest
  token_expires_at: Date
  connected_at: Date
  disconnected_at?: Date
  hazard_indicator: boolean    // true when OAuth token invalid (show warning icon in UI)
  share_with_team: boolean     // all team members can see this broker's emails
}
```

Connection indicator in settings: hazard symbol `⚠` (amber, `text-warning`) when `hazard_indicator = true`. Triggered by: password change, server update, OAuth token revocation.

**Historical email import (per FUB docs):**
- New connection: import emails from preceding 90 days
- Re-connection after disconnect: import only past 2 days (data integrity risk — surface warning to user during reconnect)

**Gmail-specific requirements to enforce (per FUB docs):**
- Max 15 simultaneous IMAP connections (across all devices + apps) — if exceeded, surface specific error: "Gmail IMAP connection limit reached (15 connections). Please disconnect other devices or apps before syncing."
- "All Mail" label must be enabled in Gmail Settings > Labels > Show in IMAP
- Gmail account language must be set to "English (US)"
- Aliases cannot be connected — requires primary address
- Admin must have "Gmail service ON for everyone" in Google Workspace Admin Console

### 17.2.3 Two-way email sync engine

Sync scope: emails where a contact's email address appears in To/From/CC/BCC. Internal broker-to-broker emails are excluded unless a contact is also in the thread.

Sync behavior by provider:
- **Google:** bidirectional; closing a conversation in CRM archives it in Gmail
- **Microsoft 365:** bidirectional; no auto-archive on close

Sync cron: `crm-gmail-sync` (already live, runs every 15 minutes per §19.3)

On inbound email ingestion:
1. Match sender email to `crm_people.contact_points` (email lookup)
2. If matched: write timeline event to that person's record, update `last_email_received_at`
3. If unmatched: surface in inbox without a person card (show "Add Person" flyout — see §17.2.9)
4. Decrement unread count in inbox

### 17.2.4 Compose email — 1:1

**Access paths:**
1. Person detail view center column → `Send Email` action button (envelope icon)
2. Inbox reading pane → `Reply` / `Reply All` / `Forward` buttons (inline below thread, not modal)
3. Quick email → blue envelope icon top-right of any page

**Compose panel layout (Person detail, shot-15):**

Opens inline below the action bar in the center column (not a full-page route). Takes ~55% of center column height.

Top-right meta links:
- `CC` — teal text link; reveals CC: field below To:
- `BCC` — teal text link; reveals BCC: field below To:
- `How it works` — ⓘ info icon + teal link

**Fields (top to bottom):**

| Field | Element | Behavior |
|---|---|---|
| `To:` | `<Input>` with recipient chip(s) | Pre-populated from lead profile email. Chip shows colored initials avatar + name + `×` remove. Typing searches contacts. |
| `CC:` | `<Input>` (hidden by default) | Revealed on CC click |
| `BCC:` | `<Input>` (hidden by default) | Revealed on BCC click |
| `Subject:` | `<Input>` text field | Empty by default |

**Template quick-access row** (below Subject, horizontal pill buttons):
- `+ Introduction` — teal/primary filled pill
- `+ Follow Up` — teal/primary filled pill
- `+ Still Buying` — teal/primary filled pill
- `+ Nurture Lead` — teal/primary filled pill
- `+ Custom` — outlined/ghost pill — opens full template library picker

Clicking any template pill: inserts the pre-written template body (and optionally pre-fills subject line) into the body editor. Does not replace existing body text if user has typed anything (confirm-replace dialog).

**Rich-text toolbar** (icon buttons, ~16px, outline style):
`B` Bold | `I` Italic | `U` Underline | `≡` Ordered list | `⊟` Unordered list | `🔗` Insert link | `🖼` Insert image | `▶` Insert video | `☺` Insert emoji | `Ω` Merge field inserter (dropdown) | `⊞` Insert table/divider

Supported video embed: YouTube URL paste generates clickable thumbnail. BombBomb video: direct integration available.

**Merge field dropdown** (via `Ω` toolbar button or dedicated "Merge Fields" dropdown in compose):
Categories and fields (per FUB docs — exact taxonomy):

| Category | Fields |
|---|---|
| CONTACT | Contact Name · First Name · Last Name · Contact and Relationship First Name · Email · Phone · Address · Street · City · State · Zipcode · Country |
| COMPANY | Company Name · Company Phone |
| AGENT | Agent Name · First Name · Last Name · Email · Phone · Mobile Phone · Agent Merge Field |
| LENDER | Lender Name · First Name · Last Name · Email · Phone · Mobile Phone · Lender Merge Field |
| SENDER | Sender Name · First Name · Last Name · Email · Phone · Mobile Phone · Sender Merge Field |
| PROPERTY | Inquiry Address · Inquiry Address URL · Inquiry Address Preview |
| LAST VIEWED | Viewed Address · Viewed Address URL · Viewed Address Preview · Last 5 Preview |
| LEAD SOURCE | Lead Source |
| OTHER | Greeting Time (resolves to "morning" / "afternoon" / "evening" based on send timezone) |
| CUSTOM | One token per admin-defined custom field; one `Agent Merge Field` per user (set in My Settings > Other Settings) |

Token format: `%field_name%`. If source field is empty, token renders blank (no fallback/default value).

**Body editor:** WYSIWYG rich text. Pre-populated with HTML signature block auto-inserted below cursor.

**Email signature block (auto-inserted in compose body, confirmed shot-15 + inbox GIF):**
Full HTML block, injected below the body cursor area:
```
[Broker headshot photo — circular, ~80×100px]
Matt Ryan
Owner & Principal Broker · Ryan Realty LLC
541.703.3095
matt@ryan-realty.com
ryan-realty.com
"Building community through authentic relationships and exceptional customer service."
[Ryan Realty wordmark logo image — ~80px wide]
Read our Google reviews · Oregon Initial Agency Disclosure Pamphlet
Ryan Realty LLC · Oregon Principal Broker #201206613 · Equal Housing Opportunity · Not a solicitation of listings under contract with another broker.
```

Signature is stored per-user in `My Settings > Signature`. HTML (inline styles only — no `<style>` blocks, no `<iframe>`). Import from connected email via "Import Signature" button.

**Compose footer controls:**
- `Attachments` tab — paperclip icon; opens file picker. File type/size limits: not documented by FUB; enforce reasonable limits (e.g. 25 MB)
- `Templates` tab — document icon; opens full template library (all shared + own templates)
- `🗑` trash/discard icon — discards draft, closes compose panel
- `Send Email` — primary `<Button variant="default">` (navy background, cream text)
- Clock `🕐` icon immediately right of Send — schedule-send picker (see §17.2.5)

**Send behavior:**
1. Pre-send: run suppression check (§17.6 — blocks if do-not-email, hard-stop, bounced, unsubscribed from marketing on batch/action plan sends)
2. Send via connected email OAuth (or fallback server with "sent via" attribution if no connection)
3. Wrap all links with tracking redirect (for click tracking)
4. Inject 1×1 tracking pixel in HTML body (for open tracking)
5. Write timeline event to `crm_timeline` (type: `email`, direction: `outbound`)
6. Update `people.last_email_sent_at`
7. Show entry in inbox Sent folder

**BCC logging behavior (observed shot-01):** The Jun 13 manual email shows `To: Laurie McAdam, ryan.realty@followupboss.me` — FUB's BCC-to-CRM address. In our build this maps to the `crm-gmail-sync` cron which auto-ingests emails from connected Gmail. Agents using an external email client can BCC a per-user `@<yourdomain>` inbound address to log emails sent outside the CRM compose UI.

### 17.2.5 Scheduled email send (1:1)

Clock icon `🕐` beside Send button → opens date/time picker:
- Pre-set options: "Next morning," "Next afternoon," etc.
- Custom: date + time picker (`<Popover>` with `<Calendar>` + time input)

Scheduled email: stored in `crm_scheduled_sends`, shown at top of contact timeline as pending entry with "Cancel" link. On cancel: soft-delete, remove from timeline. Only original sender can cancel (per FUB docs).

### 17.2.6 Email templates

**Access:** Admin > Email Templates > `+ Email Template` (top-right, `<Button variant="default">`)

Template fields:
- `Template Name` — `<Input>` (required, unique per user)
- `Subject` — `<Input>` (optional; pre-fills Subject field when template is inserted)
- `Body` — same rich-text editor as compose
- `Share this template with my team` — `<Checkbox>` — makes template visible to all brokers
- `Folder` — optional folder assignment for organization

**Role access:**
- All roles can create templates
- Agents/Lenders: can only edit templates they personally created
- Admins/Owners: can edit all templates (edit icon in Actions column)

**HTML restriction (per FUB docs):** Insert HTML via dedicated icon. Inline styles only — `<style>` blocks and `<iframe>` are stripped on save. Canva HTML (uses iframes) is incompatible. Mailchimp HTML exports paste-in directly.

**Unsaved-change guard:** Modal confirmation before navigating away with unsaved template changes ("Unsaved changes — do you want to leave?").

**Template library picker (modal):** Opened from compose footer "Templates" tab or from `+ Custom` pill button. Shows: all own templates + all shared templates in a searchable, folder-browsable list.

### 17.2.7 Batch (mass) email

**Access:** People list → select contacts (checkboxes) → `Batch Email` action button

**Compose UI (batch-specific additions vs 1:1):**
- `Sender` dropdown (admins only): "Me" or any active broker — to send on behalf of assigned agent
- `Include All Email Addresses` checkbox: when checked, also sends to relationship contacts' email addresses. Default: unchecked (primary contact only)
- Preview button before send
- Schedule option (same `🕐` clock mechanism)

**Batch limits (per FUB docs — hard limits to enforce):**
- **10,000 emails per day per user** (native). Enforce hard cap; show error: "Daily batch email limit reached (10,000/day). Contact will try again tomorrow, or upgrade to SendGrid to exceed this limit."
- Batch email report limited to 100 most recent sends

**Deduplication:** One message per unique email address — if the same address appears multiple times in the selection, only one email sent.

**Mandatory unsubscribe footer (cannot be removed, per FUB docs):**
Every batch email gets an auto-appended footer with:
- Unsubscribe link (unique token per contact + send)
- Company information (configurable in Admin > Company settings)

**Send on behalf of agent (admin feature, per FUB docs):**
- Admin selects "Assigned Agent" as sender in batch compose → email sent with agent's name in From
- Replies route to the assigned agent (not the admin who created the batch)
- Batch Email Report attributes send to the creating admin; individual contact timelines attribute to the agent

**Batch email report (Reporting > Batch Emails):**
Table columns per send:

| Column | Description |
|---|---|
| Subject | Subject line + sender name |
| Created | When sent / scheduled |
| Status | Sending / Finished / Failure / Scheduled |
| Recipients | Total unique email addresses targeted |
| Sent | Successfully delivered (excludes failures, unsubscribes, bounces) |
| Opens | Open count + % of recipients |
| Clicks | Link click count + % |
| Unsubscribes | Count + % |
| Bounces | Count + % |

Report shows 100 most recent batch emails only. Clicking a column total opens associated contacts in People list. Scheduled emails have "Cancel" action in Status column.

### 17.2.8 Open and click tracking

**Implementation:**
- **Opens:** Inject 1×1 transparent PNG tracking pixel (`?_pxl=<encoded_token>`) in HTML email body. When recipient's email client loads the image, a request hits our tracking endpoint → increment `timeline_event.open_count`, store timestamp.
- **Clicks:** Wrap all links in email HTML with redirect URL (`?_redirect=<token>&url=<encoded_dest>`). Click on link → tracking endpoint records click → increment `timeline_event.click_count` → redirect to original URL.

**Known accuracy issues (document in UI, do not hide, per FUB docs):**
- Spam scanner pre-fetches trigger false-positive opens
- Privacy-focused Gmail/Outlook modes block tracking pixels → no open data
- Security services scan links → false-positive clicks
- Browser extensions may also interfere

**UI display:**
- Timeline entry meta line: green filled pills — `N opens` and `N clicks`
- Hovering over the count reveals unique opens vs total opens breakdown
- `via automation` green badge when `via_automation = true`
- `View campaign email` teal link when `via_automation = true` → opens original campaign email template in a modal preview

Tracking pixel URL format observed in shot-01: `https://ryan-realty.com?_pxl=djoxLGM6OTRiMjE3MzYzOTM4NjUsYTox` (base64-encoded token appended to site URL).

### 17.2.9 Bounces

Bounce event sources: mail server delivery status notification (DSN), SendGrid webhook.

On bounce:
1. Mark timeline event `is_bounced = true`
2. Display email address in **orange** (`text-warning` token) on contact's Left Rail
3. Orange pill marker next to the email address
4. Add `bounced` status indicator to that specific email address in `contact_points`
5. Block that address from future automated sends (Action Plan, Batch) — include in suppression check

Note: FUB makes no UI distinction between hard bounce (permanent) and soft bounce (temporary). Our system should track `bounce_type: 'hard' | 'soft'` internally for retry logic, but surface a unified BOUNCED indicator to the user.

**Soft bounce causes to handle gracefully (per FUB docs):** unauthenticated domain, disconnected email account, server downtime, DMARC blocking, oversized attachment, full recipient inbox, spam filter rejection, signature issues with large images.

Google-connected emails may not always generate bounce notifications for all bounce types.

### 17.2.10 Unsubscribes

**Triggered by:** Contact clicking the mandatory unsubscribe link appended to every Batch or Action Plan email.

**System changes on unsubscribe (per FUB docs):**
1. Mark email address: `contact_point.unsubscribed = true`, `contact_point.unsubscribed_at = now()`
2. Display email address in **orange** (`text-warning`) on contact Left Rail
3. Orange pill marker next to the affected email address
4. Hover shows status: "Unsubscribed from marketing emails"
5. Auto-apply tag: `unsubscribed` on the contact record

**What unsubscribing blocks:**
- Action Plan emails: BLOCKED
- Batch emails: BLOCKED
- 1:1 manual direct emails: ALLOWED (personal correspondence, not marketing)

**Cross-account scope (per FUB docs):** An unsubscribe may also affect delivery from other accounts using the same email infrastructure. Model this as a system-level suppression flag.

**Resubscription process (per FUB docs — no self-service UI):**
- Must email support (our equivalent: submit an admin action request)
- Requires explicit consent from the contact before resubscribing
- Build an admin-facing "Resubscription Request" queue — not an agent-accessible self-service button
- No agent can resubscribe a contact without admin approval + confirmed consent

### 17.2.11 Domain authentication (SPF/DKIM/DMARC)

**Access:** Admin > Domain Authentication

**Why required (per FUB docs):** Google, Microsoft, and Yahoo implemented stricter third-party sending standards effective February 1, 2024. Without authentication, batch and Action Plan emails have higher spam risk. Domain auth unlocks best deliverability for up to 10,000 marketing emails/day.

**Implementation using Entri (or equivalent DNS automation):**
1. Admin clicks "Claim Domain" → logs in to DNS provider via Entri integration
2. Entri auto-creates SPF, DKIM, and DMARC records (no manual DNS entry required)
3. Confetti animation confirms success (UX detail from FUB docs)

**Supported DNS providers (per FUB docs):** GoDaddy, Namecheap, Cloudflare, Amazon Route 53, Digital Ocean, Linode, Bluehost, DreamHost, SiteGround, 40+ others.

**Delegation option:** "Forward login to someone else" — sends a link to IT team to complete auth.

**Requirements:**
- Must have a custom domain (not `@gmail.com`, `@yahoo.com`)
- DNS provider must be on supported list (else: manual SPF/DKIM record instructions)

**Store per-account:**
```ts
interface DomainAuthentication {
  account_id: string
  domain: string
  spf_record: string
  dkim_record: string
  dmarc_policy: string
  authenticated_at: Date
  last_verified_at: Date
  status: 'not_started' | 'pending' | 'authenticated' | 'failed'
}
```

Authentication status gates batch email deliverability — surface prominently in Admin dashboard when not authenticated.

### 17.2.12 @<domain> lead email address (inbound lead parsing)

Each user gets a unique inbound email address for lead parsing (FUB's `@followupboss.me` equivalent).

**Our implementation:** Each broker has a unique inbound address (e.g. `matt.lead@crm.<yourdomain>.com` or per the in-house architecture).

**Lead notification sources:** Portal lead notification emails (Zillow, Realtor.com), AgentFire form submissions, third-party lead sources that send notification emails.

**Parsing behavior:**
- Inbound email to user's lead address → `crm-portal-lead-intake` cron parses it
- FUB supports three email parser formats: Short, Full, Advanced (FUB Email Parser article 360015370573)
- On successful parse: create/match Person record, assign to broker whose address received it, log LEAD ORIGIN timeline event

**Admin visibility:** Admin can view all team members' lead routing addresses (Admin > API section equivalent).

**Important distinction (per FUB docs):** Team inbox email addresses do NOT process lead notification emails — only individual user addresses do.

### 17.2.13 Team inbox email

**What it is:** A shared email address (`info@ryan-realty.com`) managed by multiple brokers. All inbound emails to that address appear in the Company inbox.

**Requirements (per FUB docs):**
- Only admin users can create and edit team inboxes
- Team must have more than one user for Team Inbox to appear
- Email must not already be connected to a user account
- Only Google Workspace and Microsoft 365 are supported
- Email host of team inbox must match the owner's connected email host

**Not supported for team inboxes (per FUB docs):** Lead notification email syncing, calendar synchronization.

**Manage page** (observed inbox GIF, Screen 16): Route "All Team Inboxes > Manage"
Table columns: Name | Phone Numbers | Connected Email | Team | Action (edit icon)
Top-right actions: `⓪ How it works` | `New Team Inbox` (primary button) | `Add Number` (primary button)

**Personalization:** Set a "reply-from" name or select "Personalise with Agent Name" to personalize which agent's name appears.

### 17.2.14 Email deletion

- **Admin-only** (per FUB docs)
- From timeline three-dot `···` menu → "Delete" → confirmation dialog
- On confirm: removes from `crm_timeline` with no recoverable trace
- Option: simultaneously trash in connected email provider (checkbox)
- If connected email is Google: email also archived/trashed in Gmail when CRM delete checkbox is checked

### 17.2.15 Email sharing

Toggle per user: `My Settings > Share your emails with your team`
- On: all sent/received emails visible to team members with appropriate access
- Off: emails private to that user
- No selective sharing — all-or-nothing toggle
- Access control when shared: Brokers/Admins see all contacts' emails; Agents see only emails on contacts they are assigned to or collaborating on

---

## 17.3 Text / SMS Channel

### 17.3.1 Phone number architecture (two-tier system, per FUB docs)

| Number type | What it is | Who has it | Primary use |
|---|---|---|---|
| **Company Number** | Shared team number, one per account | All accounts (free) | Outbound texts (default), inbound call forwarding, 2-way text when no Dialer |
| **User Virtual Number** | Per-broker dedicated number | Requires FUB Phone / Calling add-on | Outbound calls + texts for Dialer-enabled brokers |
| **Team Inbox Number** | Shared inbound number for a team | Requires calling add-on | Max answer rate for team calls |

**Routing logic for Company Number:**
- Inbound from known contact → routes to assigned broker's number
- Inbound from unknown number → routes per Team Inbox settings
- Outbound: when Dialer add-on is enabled for a user, their texts use their personal FUB number; without Dialer, all texts come from Company Number

**Database table:**
```ts
interface PhoneNumber {
  id: string
  number: string                                    // E.164 format
  type: 'company' | 'user' | 'team_inbox'
  assigned_to_broker_id?: number
  assigned_to_inbox_id?: string
  status: 'active' | 'warming_up' | 'parked' | 'released'
  twilio_sid: string
  a2p_registered: boolean
  spam_protection_registered: boolean
  parked_at?: Date
  release_at?: Date                                 // parked_at + 20 days
  label?: string                                    // internal label only
  created_at: Date
}
```

**Ryan Realty context:** Twilio is the underlying SMS provider (A2P verified, 541.703.3095 ported — per project memory). All outbound SMS must use Twilio directly; the FUB API `/v1/textMessages` endpoint is LOG-ONLY (see §17.3.11).

### 17.3.2 Phone number warming up

When a new FUB phone number is provisioned, it enters an activation/warm-up period required by US mobile carriers.

**UI state shown in shot-01 (center column banner when Text tab active + number in warm-up):**

> **Banner headline (bold):** "Your Follow Up Boss number is warming up!"
> **Body:** "You can make calls from this number now and it will be ready to text soon! Please check back tomorrow. While you wait, try out the Follow Up Boss texting experience."
> **Button:** `Try out texting` (primary filled button, navy `bg-primary`, cream text)
> **Top-right link:** `How it works` (ⓘ info icon + teal link text)

**During warm-up (per FUB docs):**
- Outbound texts to US numbers: BLOCKED
- Receiving texts: ALLOWED
- Outbound calls: ALLOWED
- Receiving calls: ALLOWED

**Prerequisite:** Business Registration (A2P 10DLC) must be fully approved before a number can advance past warm-up to active texting.

**Status field:** `phone_numbers.status = 'warming_up'`. The Text compose panel checks this status and shows the warm-up banner instead of the compose interface.

### 17.3.3 A2P 10DLC Business Registration (mandatory hard gate)

**Business Registration must be approved before any outbound SMS can be sent.** This is a carrier-mandated legal requirement, not a FUB product decision. (Per FUB docs: carriers began blocking unregistered numbers on December 1, 2024.)

**What it is:** US carrier identity verification for business-to-person messaging. The Campaign Registry (TCR) is the clearinghouse. All phone numbers in the account are registered under the approved business profile.

**Status states and colors:**

| Status | Display color | Meaning | Agent action |
|---|---|---|---|
| Not Started | Gray | Not submitted | Submit registration |
| Under FUB Review | Yellow (`text-warning`) | Internal team reviewing | Wait |
| Submitted to Carriers | Green (FUB) + Yellow (carriers) | Passed internal review, carriers reviewing | Wait |
| Rejected by FUB | Red (`text-destructive`) | Website changes or info needed | Fix and resubmit |
| Rejected by Carriers | Red | Major carriers declined | Fix per rejection notes and resubmit |
| Fully Registered | Green (`text-success`) | Final approval — texting enabled | None |

**Review timeline:** ~48 hours for TCR review; may be longer with follow-up questions.

**Registration required inputs (Admin > Business Registration > Get Started, per FUB docs):**
1. Business country
2. EIN status (US) or Business Number/BN (Canada)
3. Legal business name — must match IRS/tax records exactly
4. Business type
5. EIN (US) or BN (Canada) — exact match required
6. Registered business address — must match EIN/BN records
7. Complete website URL
8. Privacy policy confirmation (8 required elements — see §17.6.2)
9. Opt-in consent verification (8 required form elements — see §17.6.2)

**For Ryan Realty:** A2P already verified (per project memory). Business Registration status = Fully Registered.

### 17.3.4 Composing and sending text messages (desktop)

**Access paths:**
1. Person detail center column → `Text` action button (speech bubble/chat icon)
2. Quick Text → purple button upper-right corner (searches contacts by name or accepts raw phone numbers)
3. Inbox → open a text thread → compose area

**Text compose form (observed shot-23 + inbox GIF):**

**Tab bar (four tabs, identical to email compose):**

| Tab | Icon | State when text active |
|---|---|---|
| Create Note | pencil/note icon | Inactive (gray, ghost) |
| Send Email | envelope icon | Inactive (gray, ghost) |
| Text | speech-bubble/chat icon | **ACTIVE** (blue underline + label in `text-primary`) |
| Log Call | phone icon | Inactive (gray, ghost) |

`How it works` — small blue link text with circled `i` info icon, top-right of compose area.

**To: field (recipient row):**
- Label `To:` (gray label)
- Recipient pill/chip: colored circle with contact initials + contact name + phone number + `↓` dropdown caret to expand phone number options for multi-phone contacts
- `+` blue circle button to the right — opens recipient search dropdown

**Recipient search dropdown (floating, overlaying compose body — observed shot-23):**
Structure:
```
[ Search input: "Enter name or phone number"       ]
[ Contact relationships (orange/coral circle icons):         ]
  Sales (work) (855) 888-9769
  Support (work) (855) 622-5311
[ USERS section header (gray uppercase label):               ]
  [Matt Ryan avatar] Matt Ryan (541) 213-6706
```
- Dropdown queries: the contact's own relationships' phone numbers + current logged-in user's own phone (for self-test sends) + other users in the system
- Live search filters contacts and users simultaneously
- Clicking a result adds them as an additional recipient (group text if multiple added)

**Recipient type pills (below To: row):**
- `Lead` — outlined ghost pill: sets message recipient context to the primary contact
- `+ Custom` — outlined ghost pill with `+` prefix: add a free-form phone number not in the system

**Template selection (within compose):**
- `Intro` tab — default tab showing preset introduction messages
- Templates icon `📄` in toolbar — opens full text template picker

**Message body:**
- `<Textarea>` with placeholder "Write your message..."
- Disabled/muted state (button desaturated) when body is empty

**Compose toolbar (bottom of compose area):**
- Template icon (stacked lines with brackets) — inserts a text template
- Image/media icon (picture frame) — attaches image or media (MMS)
- Emoji icon (smiley face) — opens emoji picker

**Send controls:**
- `Send Text` — filled primary button (navy `bg-primary`); disabled when body is empty
- Clock `🕐` icon immediately to the right of Send Text — schedule text for future delivery (§17.3.7)

**Character limit display:** Show character counter below body textarea: `[N]/320 characters`. At >320 chars: show warning in `text-warning` amber: "Messages over 320 characters may be filtered by carriers." (Per FUB docs: emojis count as ~80–90 characters each.)

**Suppression check before send:** See §17.6. If contact's phone has `text_opt_out = true` or `do_not_text` tag or `hard_stop` tag: block send and show error: "This contact has opted out of text messages." Non-dismissible.

### 17.3.5 Text message delivery and tracking

**Outbound send flow:**
1. Check suppression (§17.6) — block if `text_opt_out`, `do_not_text`, `hard_stop`, or warm-up state
2. Check quiet hours (§17.3.6) — queue if within 9pm–8am window
3. Send via Twilio API (using assigned broker's Twilio number or company number)
4. Store Twilio `MessageSid` in timeline event
5. Write timeline event to `crm_timeline` (type: `text`, direction: `outbound`)
6. Implement Twilio StatusCallback webhook → update delivery status on the timeline event

**Delivery status enum:**
```ts
type SmsDeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'undelivered'
  | 'carrier_filtered'  // error code 30007
```

**Carrier filtering (error code 30007, per FUB docs):**
When a message is carrier-filtered:
- Set `timeline_event.carrier_filtered = true`
- Display orange badge on the message: "The contact's mobile provider filtered your text before it could be delivered."
- Show guidance: link to carrier filtering best practices
- No automatic retry — agent must reword and resend manually

**Content-based carrier filter triggers (per FUB docs — warn or block):**
- Messages over 320 characters
- Spam words: "100% free", "risk-free", "no fees", "guaranteed", "act fast", "exclusive deal"
- Spammy capitalization: "FREE", "CALL NOW"
- Financial/legal terminology: "loans", "mortgage rates", "pre-approved", "credit score", "$" (context-dependent)
- Emojis in initial contact messages
- Text signatures (email-style signature blocks)
- Attachments (pictures, videos, links) in first contact with a new contact
- Shortened URLs (bit.ly, Google Drive links) — use full URLs only
- Same message sent rapidly to multiple contacts
- Two unanswered messages to the same contact (behavioral signal)

**Implement client-side warnings** for shortened URLs and message length > 320 chars before sending.

### 17.3.6 Quiet hours

**Window:** 9pm – 8am **in the assigned broker's local time** (not the contact's timezone — per FUB docs).

**What gets queued:**
- Initial/autoresponder texts triggered by lead entry
- Manual texts sent during quiet hours (queue, do not send immediately)

**Queue behavior:**
- Delivery: at 8am in the assigned broker's timezone the following morning
- Display status: `queued` (not `sent`) — display in timeline as pending with timestamp of when it will fire
- **Known FUB mobile app bug (per FUB docs):** iOS and Android apps show queued texts as already sent during quiet hours. Our build must NOT replicate this bug — always show accurate queued status on all surfaces.

**Auto-cancel trigger:** If any communication occurs between the contact and the broker (inbound text, inbound email, or any call) before 8am, the queued text is automatically cancelled to prevent duplicate outreach. Remove from timeline. Show brief "Cancelled: contact reached out first" notification.

**Manual cancel:** Link on the queued message in timeline → confirmation → cancel.

### 17.3.7 Scheduled text messages

**Access:** Text compose → type message → `🕐` clock icon next to Send Text

**Constraints (per FUB docs — hard limits to enforce):**
- **Schedule window:** Within the next 24 hours only (time selector dropdown)
- **Team-wide cap:** 50 scheduled text messages per 24-hour period (across all brokers combined) *(UNVERIFIED vs public docs — could not confirm; confirm against live before relying)*
- **Per-contact limit:** Only 1 scheduled text per contact at a time; additional texts to same contact send immediately
- **1:1 only:** Group texts cannot be scheduled
- **Phone requirement:** Contact must have a phone number saved on their profile

**Auto-cancel:** If any text or email is sent to or received from the contact after scheduling, the scheduled text is automatically cancelled.

**Manual cancel:** Contact profile → "Cancel" link on the pending message → "Yes, Cancel Message" confirmation.

**Enforcement at send time:**
```ts
async function scheduleText(brokerDealId: string, body: string, sendAt: Date): Promise<void> {
  const now = new Date()
  const twentyFourHoursFromNow = addHours(now, 24)
  if (sendAt > twentyFourHoursFromNow) throw new Error('Can only schedule within 24 hours')
  
  const teamScheduledCount = await countTeamScheduledTextsInWindow(now, twentyFourHoursFromNow)
  if (teamScheduledCount >= 50) throw new Error('Team daily scheduled text limit reached (50/day)')
  
  const existingScheduled = await getScheduledTextForContact(contactId)
  if (existingScheduled) {
    // send immediately, do not schedule
    return sendNow(body)
  }
  
  // store in crm_scheduled_sends, fire via crm-scheduled-sends cron
}
```

### 17.3.8 Text templates

**Access:** Admin > Text Templates > `+ Text Template` (top-right, `<Button>`)

**Template fields:**
- `Template Name` — `<Input>` (required, internal identifier)
- `Text Content` — `<Textarea>` (message body with merge field support)
- `Share with team` — `<Checkbox>` — visible to all brokers when checked
- `Folder` — dropdown; optional organization category

**Folder management:** `+ Folder` button creates folder category. Templates assigned to folders via "Add Folder" per template.

**Usage locations:** Lead Flow initial text, Person detail text compose, Quick Text compose, Inbox compose.

**Template Performance Score (per FUB docs):**
Displayed as percentile score per template (e.g., `90` = ranked higher than 90% of all templates account-wide or globally):

| Metric | Weight |
|---|---|
| Reply rate (vs. benchmark) | Rolling 30-day window |
| Opt-out rate (vs. benchmark) | Lower is better |
| First-touch compliance | Must include agent name + company name |
| Carrier filtering rate | Lower is better |

Status states:
- `Pending (---)`: < 7 days of data (new templates show this)
- Numeric score (0–100): 7+ days of data available
- `Needs Review` badge: template has been carrier-filtered

Score visible in: template list table, template picker dropdown during compose, beside template title when composing.

**First-touch compliance check:** When a template is used as the first text to a contact (no prior text history with that contact), system verifies template body includes agent name AND company name. If missing: show warning banner "This template may not be compliant for first contact — it should include your name and company name."

**All initial/Lead Flow text messages:** Stored in auto-created "Initial Text Messages — Lead Flow" folder.

### 17.3.9 Group texting

**Participant limit:** Up to 10 phone numbers total (sender counts in the 10, so up to 9 external recipients) — per FUB docs.

**Who can be added:** Contacts in CRM, team inbox numbers, or free-form phone numbers.

**Reply behavior:** All participants see all replies in the same thread. Recipients see each other's names if they have the sender saved; otherwise see phone numbers.

**Desktop access:** Person detail > Text > click `+` button (observed in shot-23 recipient search dropdown) OR Quick Text > search and add multiple contacts.

**Not for mass use:** Intended for deal-specific coordination (buyer + spouse + agent + lender on an offer). Not a marketing channel.

**Data model:**
```ts
interface TextConversation {
  id: string
  type: 'individual' | 'group'
  participants: string[]      // phone numbers
  person_ids: number[]        // linked CRM people
  created_by_broker_id: number
  created_at: Date
}
```

### 17.3.10 MMS / Media attachments

**Images:** Desktop text compose → image/media icon → file picker. Also supported on mobile (iPhone: Photo Library or camera; Android: gallery or camera).

**Video texting (mobile only, per FUB docs):**
- Desktop cannot send video attachments
- Under 5 MB: sent inline as MMS with video embedded
- Over 5 MB: delivered as a redirect link that opens in recipient's browser
- Maximum file size: 500 MB per video
- One video per message (send separately for multiple videos)
- Read receipts available (shows when recipient views the video)
- Cannot recall/delete after sending (can only delete during preview before send)

**vCard (contact info sharing via text):**
- Sends: Name, FUB number, cell phone, email, avatar photo, company address
- Up to 4 team member vCards per single message
- Desktop: text compose > "Attach vCard" button > select brokers
- Mobile: `+` icon in editor > "Send vCard" > select broker
- Customization: Settings > VCARD; each broker can hide specific fields using eye icon

### 17.3.11 Text message API behavior (critical gotcha)

**Per FUB docs — `POST /v1/textMessages` is LOG-ONLY. No actual SMS is sent.**

This is the single most important API detail for the in-house build:
- `POST /api/v1/textMessages` → only creates an audit/timeline record on the contact's timeline
- Does NOT send an SMS through any carrier infrastructure
- To actually send SMS, our system uses Twilio directly (not via FUB)
- Authentication for the log endpoint: `X-System` + `X-System-Key` headers (registered system required)

**Request parameters for timeline log:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| personId | int32 | Yes | CRM contact ID |
| message | string | Yes | Text body |
| toNumber | string | Yes | Recipient phone |
| fromNumber | string | Yes | Sender phone |
| isIncoming | boolean | No | Direction flag (default false = outbound) |
| externalLabel | string | No | Descriptive text for the timeline byline |
| externalUrl | string | No | Link displayed in the timeline byline |

### 17.3.12 Opt-in / opt-out handling

**Opt-out keywords recognized (CTIA standard, per FUB docs):**
`STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`

**On opt-out keyword received via Twilio inbound webhook:**
1. Match inbound phone to contact's `contact_points`
2. Set `contact_point.text_opt_out = true`, `text_opt_out_at = now()`
3. Log opt-out timeline event (type: `system`, body: "Contact replied STOP — texting blocked")
4. Display phone number in **orange** (`text-warning`) on Left Rail of contact record
5. Add orange pill marker next to the phone number
6. Block all future outbound texts to this number (suppression check gate)
7. Respond to contact with CTIA-mandated confirmation: "You have been unsubscribed. Reply START to resubscribe."

**Opt-back-in:** Contact texts `START` (or any keyword indicating consent) → clear `text_opt_out` flag → log resubscribe event → notify assigned broker.

**TCPA consent windows (per FUB docs):**
- Property/service inquiry: 90-day consent window
- Prior business relationship (sold/bought a home): 18-month consent window
- Beyond these windows: contact requires explicit fresh consent before texting

**Required first-message compliance (per FUB docs):**
All initial text outreach must include:
1. Agent name
2. Company name
3. Purpose of contact
4. A question to initiate conversation

First text should also include: "Reply STOP to unsubscribe."

### 17.3.13 Text reporting

**Access:** Reporting > Texts

**Table columns:**

| Metric | Description | Display format |
|---|---|---|
| Texts Sent | Total outbound texts | Black = total, blue = unique contacts |
| Texts Received | Total inbound texts | Same |
| Delivery Rate | Percentage delivered successfully | Tiered label: Excellent 97–100% / Good 95–96% / Low 90–94% / Very Low ≤89% |
| Opt-Outs | Contacts who replied STOP | Count |
| Carrier Filtered | Messages blocked as spam | Count + link to affected contacts |
| Other Errors | Invalid phone numbers, landlines | Count |

All columns sortable ascending/descending. Clicking a column total opens associated contacts in People list.

Filters: time frame selector (custom date ranges). Export to CSV.

**Access control:** Admins see all broker numbers. Individual brokers see only their own number's report.

### 17.3.14 Lead Flow initial text

**Configuration:** Admin > Lead Flow > [select source] > Advanced Settings > `+ Add Initial Text Message`

**Configurable fields:**
- Delay: X minutes after lead enters CRM
- Message body (with merge field support, 300 chars/line limit)
- Enable/disable toggle per source

**Behavior:**
- Respects quiet hours (queues if triggered during 9pm–8am in assigned broker's timezone)
- Auto-cancels if contact reaches out before queued text fires (inbound text, email, or call)
- Action Plan emails bypass quiet hours; only text autoresponders queue

**Disable per source:** Navigate to source's Advanced Settings > scroll to initial text > trash icon > save.

### 17.3.15 Appointment reminder texts (Power-Up)

**Enable:** My Settings or Power-Ups > toggle "Appointment Reminders"

**Fires automatically** for every appointment created in CRM.

**Sender:** The assigned broker's outbound FUB/Twilio number.

**Timing rules (per FUB docs):**

| Appointment type | When reminder sends |
|---|---|
| Same-day appointment | Immediately when created |
| Appointment before 8:30am that day | One hour prior to appointment |
| Appointment after 8:30am that day | At 8:30am that day |
| All-day event | 12:30pm the previous day |

Timezone: broker's configured timezone (or explicitly specified appointment timezone if set).

When ISA (another broker) creates appointment then removes themselves and invites the lead broker, reminder sends from the lead broker's number.

If "Send invitation email & text reminder" is checked during appointment edit, contact receives updated notification.

---

## 17.4 Calls and Voicemail

### 17.4.1 Calling architecture

Three outbound calling methods per broker (My Settings > Outgoing Calls > Calling Method, per FUB docs):

| Method | Behavior |
|---|---|
| Always Use Internet | VoIP through desktop browser |
| Always Use Mobile Phone | Call bridges through broker's cell phone |
| Ask Me Each Time | Prompts at each call; quick-dial from top-right always defaults to Internet even with this setting |

**Key behavior:** The contact always sees the FUB outbound number on caller ID regardless of method chosen.

**Mobile bridge:** Outbound mobile calls use Twilio call-bridge pattern — agent's device dials a bridge number with tracking digits; lead sees the FUB virtual number on their caller ID.

**Hardware requirements for desktop calling (per FUB docs):**
- USB headset plugged directly in (recommended); Bluetooth headset (must be charged + paired)
- 3.5mm headphones and computer speakers: NOT recommended
- Laptop must be open and plugged into charger (docked/closed laptop blocks calling)
- Browser microphone permission must be granted
- Minimum internet: 5 Mbps down / 5 Mbps up / ≤100ms ping / ≤30ms jitter; wired Ethernet preferred

### 17.4.2 Click-to-call

**From Person detail Left Rail:** Click the phone number `(541) 788-0691` → action menu: "Call via Internet" | "Call via Mobile"

**From Person detail action bar:** `Log Call` tab (observed shot-01; URL path is `/call`)

**Quick call (top-right icon):** Click call icon → search contact by name or enter phone number → call initiates.

**Inbound call on desktop:** Appears at top of FUB interface. Click green phone icon to accept. Click red phone icon to end.

**Call waiting (desktop):** Second inbound call during active call → options: "End & Accept" (ends current, takes new) | "Decline" (sends to voicemail).

### 17.4.3 Inbound call routing

Priority-ordered routing decision tree (per FUB docs):

**Calls to a User's Personal FUB Number:**
1. Ring broker's desktop (if desktop calling enabled)
2. And/or forward to cell phone number in their settings
3. Configurable: ring desktop then forward, or ring both simultaneously
4. `mobile_ring_time`: configurable seconds before FUB voicemail picks up (setting must be short enough to prevent calls hitting personal carrier voicemail)

**Calls to Company Number:**
- Caller is known contact → route to **assigned broker's** configured destination
- Caller is unknown → route per **team inbox settings** (designated receiving members)

**Calls to Team Inbox Number:**
- Ring Call Routing Team Members defined in inbox settings
- Exception: Company Number called by known contact → bypasses team queue, goes directly to assigned broker
- "Press 1 to Answer" mode: available only when 2+ mobile numbers are in the inbox; prevents calls going to personal voicemail
- Up to 10 agents' cell phones ring without key press when transferring to a team inbox

**When nobody answers (configurable):**
- Route to inbox voicemail
- Do Not Disturb mode (all to voicemail or forwarding number)
- Outside Office Hours forwarding
- No Answer forwarding (to voicemail or external number)

### 17.4.4 Call transfers (desktop only, per FUB docs)

**Warm transfer process:**
1. During active call, click transfer button
2. Select team member or team inbox to transfer to
3. Lead placed on hold; new team member's cell is dialed (shows FUB number as caller ID)
4. Options at this point:
   - `Cancel transfer` — returns to lead immediately
   - `Merge` — three-way call; lead taken off hold, original agent introduces new agent and stays on
   - `Complete transfer` — connects new agent directly to lead; original agent drops

**Notes:**
- Calls transferred within Team Inbox are always recorded even if individual user has recording disabled
- Call transcript/summary is NOT generated for transferred calls (per FUB docs — scope restriction)
- Cold/blind transfers not in FUB; only warm transfers documented

### 17.4.5 Call lists (desktop only, per FUB docs)

**Requirements:** Calling add-on; desktop only.

**Creating:** People list → filter to desired contacts → phone icon `Calling List` → "Create new call list."

**During session:**
- System auto-dials first contact, displays their profile
- First valid phone number on profile auto-called
- Contacts with multiple phones: first valid number auto-dials; broker can manually click other numbers
- Controls: dialpad, contact list view, call transfer, mute, hang up, "Next"
- Between calls: take notes, send follow-up texts, pause session

**Auto-resume:** Navigating away or page refresh → FUB automatically resumes the call list. Server-side session state required.

**DNC limitation (per FUB docs):** CRM does NOT natively scrub against DNC lists. Our build should document the CallAction integration path for DNC compliance.

**Inbound calls during call list:** Go directly to voicemail; missed calls appear in inbox.

### 17.4.6 Voicemail

**Personal voicemail greeting:** Brokers with calling add-on can record a custom greeting. If none recorded, system default voicemail plays.
**Access:** My Settings > Voicemail section.

**FUB voicemail vs. personal carrier voicemail:**
- FUB voicemails stored in inbox with no storage limit
- If mobile ring time is too long, call hits agent's carrier voicemail instead of CRM voicemail
- Fix: shorten `mobile_ring_time` setting

**Inbox display (observed inbox GIF, Screen 15 — Company inbox with voicemail threads):**
Thread list shows phone-number-named entries for unknown callers:
```
(541) 207-9190 · 3 · Jun 10 · 📞 Voicemail (00:06)
(541) 569-0408 · 1 · Jun 10 · 📞 Incoming call
(541) 200-7756 · 2 · Jun 9  · 📞 Voicemail (00:04) · "To opt out."
```

Reading pane for a voicemail thread — conversation timeline with each entry:
- Entry type label: "Voicemail" or "Incoming call" or "Unknown → Matt Ryan" + ✏️ edit icon
- Date + time + duration (MM:SS)
- `⬇` download button
- `▶` play button (inline audio player)

Thread toolbar (Company inbox threads): `Company ▾` assignee dropdown (instead of `Me ▾`) | `Close` | `⋮` kebab

**Unknown caller "Add Person" flyout (observed inbox GIF, Screen 15):**
When an unrecognized phone number thread is selected, the right contact panel is REPLACED with:
- Header: "Add person"
- Sub-label: "[phone number] · Search Google" (Google search link)
- Form fields: `First Name` `<Input>` | `Last Name` `<Input>` | `Email` `<Input>`
- Primary CTA: `Add person` `<Button variant="default">` (creates new CRM contact linked to that phone number)
- Secondary CTA: "or update an existing person"
- Search field below secondary CTA — searches existing contacts to merge the phone thread to

**Team inbox voicemail notifications:** Email notification sent to inbox members when a call goes unanswered (except calls received outside configured business hours).

### 17.4.7 Call recording

**Default state:** Disabled.

**Enable (account owner only):**
- My Settings > Power-Ups > "Call Recording, Transcripts, and Summaries" toggle
- Or: Admin > Company > enable

**Disable per broker:**
- Admin > Teams > uncheck "Recorded Calls" checkbox for specific brokers

**What gets recorded:**
- Calls via FUB/Twilio numbers (outbound and inbound)
- Calls forwarded to cell phones
- Team Inbox transferred calls — recorded regardless of per-user exclusion setting
- **NOT recorded:** Calls initiated outside the CRM app on a personal cell phone

**Accessing recordings:**
- Person detail or Inbox → click play icon to right of logged call
- Three-dot menu `···` → download option

**Deletion policy (per FUB docs — hard rule):**
Call recordings **cannot be deleted** after creation even if recording is disabled. The only way to remove a recording is to delete the entire contact profile. Our build must hard-block the recording delete endpoint. Only lead profile deletion clears recordings.

**Storage:** Recording URLs stored in `crm_timeline.recording_url` (Twilio recording storage URL or our own object storage).

### 17.4.8 Call recording disclosure (all-party consent)

A separate Power-Up (separate from recording itself).

**Enable (account owner only):** My Settings > Power-Ups > "Call Recording Disclosure" or Admin > Company.

**Behavior:** When a call is made or received on a CRM phone number, a pre-recorded message automatically plays for the non-CRM party (the contact) **before recording begins**.

**Fixed disclosure message (not customizable, per FUB docs):**
> "This call is being recorded."

**Implementation (Twilio TwiML):**
```xml
<Response>
  <Say voice="alice">This call is being recorded.</Say>
  <Record />
</Response>
```

**Legal responsibility (per FUB docs):** Legal compliance is the user's responsibility. Some US states are two-party consent states — attorney consultation recommended. Our build should surface a legal disclaimer when enabling this power-up.

**Oregon law context:** Oregon is a one-party consent state (ORS 165.540) — recording is permitted when one party to the call consents (which the broker does by using the system). However, the disclosure message is best practice and is required in certain scenarios.

### 17.4.9 Voicemail transcription

**Requires:** Calling add-on.

**What it does:** Automatically transcribes voicemails left on CRM phone numbers.

**Where it appears:**
- In the Inbox alongside the recorded voicemail
- On the lead profile beneath the recorded voicemail
- Searchable via keyword search (third column of interface shows results)

**Access control:** Only brokers assigned to the lead (plus admins) can view voicemail transcriptions.

**Implementation options:** Twilio's native transcription (basic) or Deepgram/AssemblyAI for higher accuracy. FUB uses an unnamed third-party transcription service.

### 17.4.10 AI call summaries and transcripts

**Requires:** Call recording enabled (enabling recording automatically enables transcripts + summaries — treat as one Power-Up).

**Processing pipeline (per FUB docs):**
1. Call recorded via Twilio
2. Third-party transcription service generates full transcript
3. LLM generates summary with key action items (FUB uses Zillow-hosted LLM; our build uses Claude Sonnet)
4. Results stored within **15 seconds** of call completion

**Scope limits (hard filters, per FUB docs):**
- Only for calls lasting **longer than 15 seconds AND shorter than 60 minutes**
- NOT generated for calls transferred within the CRM (Twilio Conference transfers)
- English language only

**Where results appear:**
- Person detail inline with call log entry in timeline
- Right-hand sidebar task section of person detail
- Web and mobile apps via call log in inbox or lead profile Comms section

**Editing:**
- Hover over any summary line → edit icon appears → inline text edit
- Delete individual summary lines
- Create task directly from a suggested action item: click action item → select task type + assignee + schedule → confirm

**Data model:**
```ts
interface CallRecord {
  timeline_event_id: string
  recording_url: string
  transcript_text: string
  ai_summary: string
  action_items: ActionItem[]
  duration_seconds: number
  generated_at: Date
}

interface ActionItem {
  id: string
  text: string
  task_type?: string
  assignee_broker_id?: number
  due_at?: Date
  converted_to_task_id?: string
}
```

### 17.4.11 Caller ID

**Outbound (what the contact sees):**
- FUB/Twilio number on caller ID by default
- If contact has saved the FUB number in their contacts, broker's name displays

**Inbound to personal FUB number (what broker sees):**
- Desktop: "Name Only" for known contacts; "Number Only" for unknown callers
- Mobile: depends on routing destination and whether number is saved

**Inbound to Team Inbox (what broker sees):**
- Desktop: "Contact Number/Name + Team Inbox Name" when 1+ users receive calls
- Mobile with 2+ team members: shows the team inbox number
- Mobile with single user: shows the contact number

**Mobile Caller ID enablement:**
- iOS: Settings > Phone > Call Blocking and Identification > toggle ON app
- Android: Settings > "Caller ID" > Default Caller ID & Spam App > select app

### 17.4.12 Spam label protection

**What it does (per FUB docs):** Registers CRM phone numbers with major carriers via Neustar (Know Your Customer compliance) to prevent legitimate calls from being flagged as spam.

**Activation:** Automatic once Business Registration is fully approved. Applies to all calling numbers in the account.

**Registration data used:** First 15 characters of the legal business name from Business Registration.

**Spam appeal:** If a number gets mislabeled, an automatic appeal is sent to the carrier. No user action required; system monitors number reputation continuously.

**Geographic scope:** Not available ON Canadian numbers (a Canadian number → Canadian number), BUT a **Canadian account calling US numbers CAN apply it** (per FUB docs, verified 2026-06-30 — corrected from a flat "Canadian numbers excluded"). Effectively available whenever calling US numbers.

**Configuration:** Admin > Company > Virtual Phone > Spam Label Calling Protection.

### 17.4.13 Manual call logging

**When needed:** Call made from non-CRM number, CRM calling not available, face-to-face conversations, inbound calls to personal mobile without CRM calling enabled.

**Desktop process:** Person detail → `Log Call` button → notes field → `Log Call`.

**Quick-log buttons (observed in FUB docs):** `No Answer` and `Left Voicemail` — create one-click call log entries with pre-set outcome labels.

**Manual logs are factored into:** Reporting, Smart List recency calculations, last-contacted timestamps.

### 17.4.14 Call reporting

**Access:** Reporting > Calls

**Two views:**

**Call Report (aggregate metrics):**
| Metric | Definition |
|---|---|
| Calls Made | Total outbound calls (connected + non-connected) |
| Connected | Calls exceeding 1 minute |
| Conversations | Calls lasting 2+ minutes |
| Received | Inbound calls including voicemails |
| Calls Missed | Unanswered incoming calls without voicemail |
| Total Talk Time | Cumulative duration including voicemails |
| Answer Time | Average response time for desktop-answered inbound calls |

**Call Logs (per-call row table):**
| Column | Contents |
|---|---|
| Agent/Inbox | Which broker or inbox handled the call |
| Type | Icon: inbound/outbound × answered/missed/voicemail |
| Person | Contact name (or unknown number) |
| Time | When the call occurred (hover for exact timestamp) |
| Duration | How long the call lasted |
| Inbox | Which CRM number was used |

Display: Black numbers = team totals; blue numbers = unique contact counts. All columns sortable. Date range filter. Export to CSV. Keyword search retrieves matching call notes and voicemail transcriptions.

**Access control:** Individual brokers see own calls only. Owners/Admins see all team data.

### 17.4.15 Block list

**Per-message block (desktop):** Inbox > select message > `···` > Block

**Per-message block (mobile):** Inbox or Lead Profile > open call or text > three-dot menu > Block

**Mass block (admin only):** Admin > Company > Block List > Manage Block List Settings > enter comma-separated emails or phone numbers > Block Emails/Numbers

**Unblock:** Admin > Company > Block List > find contact > Unblock

**Effect:** Blocks communication from entering CRM. Does NOT affect the broker's personal email account.

**Data model:** `crm_blocked_numbers` table with `value` (email or phone) and `blocked_at` timestamp.

### 17.4.16 Phone number lifecycle management

**Number parking lot (Admin > Phone Numbers > Parked tab):**
- Parked tab: numbers in account but unassigned; includes released numbers held 20 days + transferred numbers
- Released tab: numbers fully released from CRM — cannot be retrieved
- Actions: Keep (re-assign) | Move (to inbox) | Release (immediate)
- **Retention:** 20 days in Parked before permanent release (Note: "30 days" appears in the Edit Inbox Numbers article — 20 days is canonical per Admin > Phone Numbers article)
- Once parked: calls/texts to that number not received (inactive)

**Number actions:**
- `Change Number`: old number moves to Parked for 20 days; new number becomes active
- `Swap Number`: atomic exchange between two assignments (no number lost)
- `Move Number`: relocate to different Team Inbox
- `Edit Label`: internal identification label only (not shown to contacts)

**Adding numbers:** Search available by area code (up to 6 digits). Popular area codes may be unavailable.

**Porting in (US standard numbers only, per FUB docs):**
- Underlying provider: Twilio
- Timeline: 3–7 days on average
- Cannot port: toll-free numbers or Canadian numbers
- No porting fees
- Required from current carrier: carrier name, account number, port-away PIN, last 30-day bill (PDF/JPEG), account owner details, account type (residential/business)
- Must sign Letter of Authorization (LOA) emailed by Twilio

---

## 17.5 Inbox (Unified Multi-Channel)

See §08 for the full Inbox specification. This section covers the cross-cutting elements.

### 17.5.1 Folder structure (observed inbox GIF)

**Left nav folder tree:**
```
My Inbox (N)  ← total count across all My Inbox subfolders; decrements on read/close
  📥 Inbox
  👤 Assigned
  📄 Drafts
  ✉  Sent
  ⬇  Closed

Company (N)   ← team inbox count
  [Team inbox name]

⚙ Manage     ← navigates to full-page Team Inbox management
```

**Count behavior (confirmed inbox GIF):** Count in left nav next to "My Inbox (N)" decrements live as threads are read or closed (started at 559, dropped to 557 after two threads interacted with). Counts are optimistic (no spinner, immediate decrement on thread open).

### 17.5.2 Thread list anatomy (per inbox GIF)

Row structure:
```
[Sender Name | bold-if-unread]  [Count Badge: blue circle + number]  [Date: right-aligned]
[📧/💬/📞 type icon]  [● blue dot: unread indicator]  [Subject truncated]
[Preview snippet truncated]  [⊕ attachment icon if applicable]
```

- Unread rows: sender name bold, blue left-border 2px accent (`border-l-2 border-primary`), blue dot indicator
- Read rows: regular weight, no dot, no left border
- Selected row: blue left-border highlight, light background tint (`bg-primary/5`)
- Type icons: 📧 email, 💬 text/SMS, 📞 call/voicemail

**Thread list header controls:**
- "Select conversations" text above tabs (enables bulk-select mode — shows "Cancel" button)
- `All` / `Unread` pill segment control (one active at a time)
- `Filter ▾` dropdown button → opens filter panel with: `☑ Emails` / `☑ Texts` / `☑ Calls` checkboxes (observed inbox GIF Screen 3)
- Filter badge: `Filter (N)` when any type is deselected (N = number of active types)
- Count header: "325 Unread Messages" (folder-specific unread count)

### 17.5.3 Reading pane anatomy (inbox GIF)

**Thread toolbar (above email content):**
- Left: Contact name (hyperlinked to person record) | thread subject truncated
- Center: `[Assignee] ▾` dropdown — "Me" when assigned to current user, "Company ▾" for team inbox threads
- Right: `Reopen` or `Close` button (mutually exclusive; reflects current folder state) | `⋮` kebab menu

**Close behavior:** Thread moves to Closed folder; removed from current folder view optimistically.

**`Add Note [N]` bar:** Pinned at very bottom of reading pane (below email footer buttons). Keyboard shortcut `N` triggers add-note.

**Reply compose (inline, not modal — confirmed inbox GIF):**
Clicking `Reply` → compose area slides open **inline below the email thread content** in the reading pane. Does not navigate to a new page.

Structure (per inbox GIF Screen 8–9):
1. `← [Recipient Name]` header (To: field pre-populated from thread)
2. Quick-tag row: `+ Introduction` | `+ Follow Up` | `+ Still Buying` | `+ Nurture Lead` | `+ Custom` — applies CRM stage/tag to the contact inline without leaving compose
3. Rich-text editor with full toolbar (B/I/U/S̶ strikethrough / ordered list / unordered list / link / image / video / emoji / font-size / table)
4. HTML signature block (broker's full signature auto-inserted)
5. Attachment link, Templates link
6. `🗑` discard | `Send` | `Send & ▾` split button | `🕐` schedule

**`Send & ▾` split button (observed inbox GIF):** Secondary options likely include "Send & Close" (sends + moves thread to Closed folder) — not fully expanded in GIF.

---

## 17.6 Compliance System (Non-Negotiable)

### 17.6.1 Compliance tag taxonomy

The following tags in the CRM tag taxonomy (`crm_tags`) function as **compliance hard-stops**. They must be checked on EVERY send path — manual, bulk, automation, and sequence engine.

| Tag | Meaning | Effect on outbound comms |
|---|---|---|
| `contact:do-not-text` | Contact has explicitly opted out of SMS or is on DNC | Block ALL outbound texts (manual + automated) |
| `contact:do-not-call` | Contact is on DNC or has asked not to be called | Block ALL outbound calls |
| `contact:do-not-email` | Contact has opted out of all email (inferred) | Block ALL outbound email |
| `compliance:hard-stop` | TCPA litigator, DNC complainant, or compliance escalation | Block ALL outbound communications on ALL channels |
| `unsubscribed` | Auto-applied on email unsubscribe | Block batch/action plan emails; allow 1:1 direct emails |

These tags are cross-referenced against every smart list's exclude group to auto-skip bulk blasts (per CLAUDE.md memory `reference_tcpa_litigator_handling`).

### 17.6.2 Suppression check (precedes every send)

This function MUST be called before any outbound communication is initiated:

```ts
interface SuppressionCheckResult {
  blocked: boolean
  reason?: string
  channel: 'email' | 'text' | 'call'
}

async function checkSuppression(
  personId: number,
  channel: 'email' | 'text' | 'call',
  sendType: 'direct' | 'batch' | 'automation'
): Promise<SuppressionCheckResult> {
  const person = await getPerson(personId)
  const phone = channel === 'text' || channel === 'call' 
    ? await getContactPoint(personId, 'phone') 
    : null
  const email = channel === 'email' 
    ? await getContactPoint(personId, 'email') 
    : null

  // Hard-stop: blocks everything
  if (person.tags.includes('compliance:hard-stop')) {
    return { blocked: true, reason: 'Contact flagged as hard-stop (compliance hold — all channels blocked)', channel }
  }

  // Channel-specific checks
  if (channel === 'text') {
    if (person.tags.includes('contact:do-not-text')) 
      return { blocked: true, reason: 'Contact tagged do-not-text', channel }
    if (phone?.text_opt_out) 
      return { blocked: true, reason: 'Contact has opted out of text messages (replied STOP)', channel }
    if (!phone_numbers.a2p_registered)
      return { blocked: true, reason: 'A2P Business Registration not approved — texting blocked', channel }
    if (phone_numbers.status === 'warming_up')
      return { blocked: true, reason: 'Phone number is warming up — texting not yet available', channel }
  }

  if (channel === 'call') {
    if (person.tags.includes('contact:do-not-call'))
      return { blocked: true, reason: 'Contact tagged do-not-call', channel }
  }

  if (channel === 'email') {
    if (person.tags.includes('contact:do-not-email'))
      return { blocked: true, reason: 'Contact tagged do-not-email', channel }
    if (sendType !== 'direct') {
      // Batch and automation emails also blocked by:
      if (email?.unsubscribed) 
        return { blocked: true, reason: 'Contact has unsubscribed from marketing emails', channel }
      if (email?.is_bounced)
        return { blocked: true, reason: 'Email address previously bounced', channel }
    }
  }

  // Also check crm_suppressions table (admin block list)
  const blocked_number = channel === 'text' || channel === 'call'
    ? await findInBlockList(phone?.value)
    : await findInBlockList(email?.value)
  if (blocked_number)
    return { blocked: true, reason: 'Number/email is in the block list', channel }

  return { blocked: false, channel }
}
```

**Suppression UI behavior when blocked:**
- Attempt to send → before any API call: run suppression check
- If blocked: show non-dismissible inline error banner in the compose area:
  > "This contact cannot be reached via [channel]. Reason: [reason]."
- `<Button>` disabled state on Send/Call button
- Log the suppression attempt to `crm_timeline` with `type: 'system'`, body: "Blocked outbound [channel] — [reason]"

**Action Plan / Sequence engine suppression:**
The sequence engine (`crm-sequence-engine`) must call `checkSuppression()` for each step before executing. On block:
- Skip that step with logged reason
- Continue remaining steps that are not blocked (suppression is per-channel, not per-contact)
- Exception: `hard-stop` blocks ALL steps on ALL channels

### 17.6.3 A2P 10DLC and website compliance requirements (per FUB docs)

**Business Registration required website elements:**

**Privacy policy must include all of:**
1. "Data will not be sold or shared with third parties for marketing or promotional purposes"
2. Opt-out instructions: "Text STOP to unsubscribe"
3. Support contact: "Reply HELP for assistance"
4. Carrier liability disclaimer for message delivery
5. Message and data rate disclosures
6. Link to full privacy policy from the contact form
7. (A reCAPTCHA privacy policy alone is NOT sufficient)

**Website contact form must include all 8 elements:**
1. Consent statement: "I agree to be contacted by [Business Name]..."
2. Opt-out instructions: "Reply STOP to unsubscribe. Reply HELP for assistance."
3. Privacy Policy link
4. Business name identification
5. "Msg/data rates may apply"
6. "Message frequency varies" (or specific frequency)
7. Communication purpose (e.g., "for real estate services")
8. Phone number field: SMS opt-in CANNOT be required to submit the form (must be optional)

**Compliant opt-in language example (from FUB docs):**
> "I agree to be contacted by [Business Name] via call, email, and text for real estate services. To opt out, you can reply 'stop' at any time or reply 'help' for assistance. You can also click the unsubscribe link in the emails. Message and data rates may apply. Message frequency may vary. [Link to Privacy Policy]."

### 17.6.4 TCPA compliance rules

**Consent requirements (per FUB docs and CLAUDE.md memory):**
- All contacts must give consent before being texted for the first time (unless established business relationship)
- Consent window for property/service inquiry: 90 days
- Consent window for prior business relationship (sold/bought a home): 18 months
- Beyond these windows: fresh explicit consent required before texting

**Opt-out rules:**
- Recognized opt-out keywords: `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`
- Must honor opt-out immediately upon receipt
- Non-responses after 2–3 messages should be treated as behavioral opt-out: switch to calls or email only

**DNC Registry:**
- Contacts on the National DNC Registry must not be called or texted
- CRM does not natively scrub against DNC lists — document CallAction integration path for DNC compliance
- Map BatchData `dnc.tcpa: true` or `litigator: true` → automatically apply `contact:do-not-text` + `contact:do-not-call` + `compliance:hard-stop` tags (per CLAUDE.md memory `reference_tcpa_litigator_handling`)

**TCPA financial risk:** $500–$1,500 per violation, real lawsuit risk. `compliance:hard-stop` tag is in every smart list's exclude group and skips all blasts automatically.

**FUB Terms of Service restrictions (documented, per FUB docs):**
- CRM numbers are NOT intended for cold calling, cold prospecting, or cold texting
- Mass texting, drip texting, and cold outreach violate FUB ToS
- Our build should implement rate limiting and monitor for patterns that indicate prohibited use

### 17.6.5 Email domain authentication and deliverability gates

**Domain authentication (SPF/DKIM/DMARC) status gates batch email deliverability:**

| Authentication status | Batch email behavior |
|---|---|
| Not authenticated | Batch emails have higher spam risk; show warning in compose UI |
| Authenticated | Best deliverability; up to 10,000/day |
| No custom domain (free email) | Cannot authenticate; batch deliverability degraded (per FUB docs) |

Surface authentication status prominently in Admin > Domain Authentication with clear CTA to complete setup.

**Action Plan email sender identity gate:**
- If login email = connected email: Action Plan emails send from connected email (best deliverability)
- If login email ≠ connected email: Action Plan emails send from login email (potentially free provider, degraded deliverability)
- Surface mismatch warning in My Settings: "Your login email differs from your connected email. Action Plan emails will be sent from [login email], which may affect deliverability. We recommend using the same address for both."

### 17.6.6 Quiet hours enforcement for compliance

Quiet hours prevent automated outreach during sleeping hours (legal and ethical requirement, per TCPA best practices):

- **Window:** 9pm – 8am **in the assigned broker's local timezone** (not the contact's timezone)
- **What queues:** Initial/autoresponder texts, scheduled texts triggered in window
- **What is NOT affected:** Action Plan emails (send immediately regardless)
- **Display:** Show queued texts with accurate "Sends at 8am" status (never show as "Sent" before delivery)
- **Auto-cancel:** Any inbound contact before 8am cancels queued text automatically

### 17.6.7 SMS carrier compliance content rules

**Pre-send content checks to implement (block or warn before sending):**

| Check | Severity | Message |
|---|---|---|
| Message > 320 characters | Warning | "Messages over 320 characters may be filtered by carriers. Shorten to improve delivery." |
| Contains shortened URL (bit.ly, tinyurl, goo.gl, etc.) | Warning | "Shortened URLs are frequently carrier-filtered. Use the full URL." |
| Contains known spam phrases | Warning | "This message contains language that may trigger carrier filtering." |
| SMS opt-in not confirmed | Warning for first-touch | "No SMS consent confirmed for this contact. Only contact if you have established consent." |
| Emoji detected in first text | Warning | "Emojis count as ~80–90 characters each and may increase filtering risk on first contact." |

**Text signature in SMS:** Warn if a broker tries to add an email-style signature block to a text message (carrier filtering trigger).

**First-touch compliance:** When sending a text to a contact with zero prior text history, check that message body includes broker name AND company name. Show warning if absent.

---

## 17.7 Batch Channel-Level Limits Summary Table

| Channel | Limit | Enforcement |
|---|---|---|
| Batch emails per user per day | 10,000 | Hard block at send time with error message |
| Action Plan emails per contact per day | 4 | Hard block; fail step with reason code |
| Scheduled texts per 24-hour team window | 50 | Hard block at schedule time |
| Scheduled texts per contact simultaneously | 1 | Auto-send immediately instead of schedule |
| Scheduled text window | Next 24 hours only | Restrict time picker |
| SMS character recommendation | 320 chars | Client-side warning (not hard block) |
| Group text participants | 10 total (including sender) | Hard limit on recipient count |
| vCards per text message | 4 | Hard limit at compose time |
| Batch email report history | 100 most recent | Pagination capped at 100 |
| Batch email deduplication | 1 email per unique address | Auto-deduplicate before send |
| Email scheduled send cancellation | Original sender only | Permission check in cancel endpoint |
| Video text file size | 500 MB max | File size validation before upload |
| Resubscription to email marketing | Admin queue required | No self-service agent UI |
| Call recording deletion | Impossible | Hard block on delete endpoint |
| AI summary scope | 15 sec – 60 min calls, no transfers | Filter in processing pipeline |
| Outbound call/text geography | US and Canada only (no Puerto Rico) | Block at number entry |

---

## 17.8 Data Touched

### Entities read or written by this layer

| Entity / Table | Fields used |
|---|---|
| `crm_people` | `id`, `tags[]`, `last_email_sent_at`, `last_email_received_at`, `last_text_sent_at`, `last_call_at`, `assigned_broker_id` |
| `crm_timeline` | All fields; primary write target for every comm event |
| `crm_contact_points` | `value` (email/phone), `type`, `unsubscribed`, `unsubscribed_at`, `is_bounced`, `text_opt_out`, `text_opt_out_at` |
| `crm_suppressions` | `value` (email/phone), `blocked_at`, `reason` |
| `crm_blocked_numbers` | `value`, `blocked_at` |
| `crm_scheduled_sends` | `id`, `person_id`, `channel`, `body`, `scheduled_at`, `status`, `cancelled_at` |
| `crm_templates` | `id`, `name`, `subject`, `body_html`, `body_text`, `channel`, `shared`, `folder_id` |
| `crm_bulk_jobs` | `id`, `type`, `sender_broker_id`, `status`, `recipient_count`, `sent_count`, `open_count`, `click_count`, `unsubscribe_count`, `bounce_count` |
| `broker_email_connections` | `broker_id`, `provider`, `address`, `access_token`, `refresh_token`, `hazard_indicator`, `share_with_team` |
| `phone_numbers` | `id`, `number`, `type`, `status`, `a2p_registered`, `spam_protection_registered`, `assigned_to_broker_id` |
| `brokers` | `twilio_number`, `forward_to_cell`, `calling_method`, `mobile_ring_time`, `timezone` |
| `crm_tags` | `name` (for compliance tag lookups) |
| `domain_authentication` | `domain`, `status`, `authenticated_at` |

---

## 17.9 Acceptance Criteria

### Email

1. A broker can connect their Google Workspace or Microsoft 365 email via OAuth. After connecting, inbound and outbound emails between their address and any CRM contact's email appear on the contact's timeline within 15 minutes (next `crm-gmail-sync` run). Disconnection shows a `⚠` hazard indicator in My Settings.

2. Composing a 1:1 email from a contact's profile pre-populates the `To:` chip, auto-inserts the HTML signature block, and renders the five quick-template pill buttons. Clicking `+ Introduction` inserts the Introduction template body. The `Send Email` button is disabled until a subject or body is entered.

3. Clicking the `🕐` clock icon opens a schedule-send picker. The scheduled email appears on the contact's timeline as a pending entry. Clicking "Cancel" on the pending entry removes it. Only the original sender can cancel (tested with a second broker account — Cancel is not visible to others).

4. A batch email sent to 50 contacts: each contact receives exactly one email (duplicates deduplicated). Every email has an auto-appended unsubscribe footer that cannot be suppressed. Each contact's timeline shows the email with `via batch email` badge and open/click counts when applicable.

5. When a contact clicks the unsubscribe link: their email displays in orange on the Left Rail, the `unsubscribed` tag is auto-applied, future batch/automation emails are blocked, and 1:1 direct emails remain sendable.

6. An email to a bounced address: the email displays in orange on the contact's timeline with a BOUNCED indicator. The address is excluded from future batch and automation sends.

7. After domain authentication: the Batch Email compose UI removes any "sent via" attribution warning. The daily batch limit remains 10,000/user.

8. When a broker composes 10,001 batch emails in a calendar day, the 10,001st is blocked with error: "Daily batch email limit reached (10,000/day)."

9. Action Plan emails respect the 4-emails/contact/day limit. The 5th attempt that day fails with reason code logged on the contact's timeline: "Daily automated email limit exceeded."

10. Open tracking: every email sent from the CRM compose window contains a `?_pxl=<token>` tracking pixel URL. When the pixel is loaded, `timeline_event.open_count` increments. Click tracking: all links are wrapped; clicks increment `timeline_event.click_count`.

### SMS / Text

11. When a new Twilio phone number is provisioned, the Text compose tab shows the warming-up banner ("Your Follow Up Boss number is warming up!") with the `Try out texting` button. Outbound texts are blocked until `phone_numbers.status = 'active'` and `a2p_registered = true`.

12. Sending an SMS to a contact with `contact:do-not-text` tag: compose area shows a non-dismissible red error banner. The `Send Text` button is disabled. No Twilio API call is made.

13. An inbound `STOP` keyword from a contact: `contact_point.text_opt_out = true` is set, the phone displays in orange on the Left Rail, a system timeline event is logged, and the CRM responds with the CTIA opt-out confirmation message.

14. A scheduled text to a contact: after scheduling, if any inbound or outbound text or email occurs before the scheduled time, the scheduled text is automatically cancelled. Manual cancellation via the timeline entry "Cancel" link also works.

15. Team-wide scheduled text cap *(UNVERIFIED — the exact 50/24h figure could not be confirmed against public docs; confirm against live)*: when the daily team cap is reached, the next scheduling attempt is rejected with a "limit reached" message.

16. A text message over 320 characters: show `text-warning` amber character counter warning below the textarea. Do not hard-block send — show the warning, allow broker to send if they choose.

17. First text to a new contact without agent name + company name: show warning banner "This template may not be compliant for first contact — it should include your name and company name."

18. Group text to 10 participants sends successfully; attempt to add an 11th recipient is blocked with "Group text maximum is 10 participants."

19. Carrier filtering (Twilio StatusCallback delivers error code 30007): the timeline message shows an orange badge "Carrier filtered — not delivered" with guidance to reword and resend.

20. Text reporting at Reporting > Texts shows delivery rate with tier labels (Excellent/Good/Low/Very Low), opt-out count, carrier-filtered count, and per-broker breakdown for admins.

### Calls and Voicemail

21. Click-to-call from a contact's phone number on the Left Rail initiates a call via the broker's configured calling method (Internet/Mobile/Ask). The contact always sees the CRM phone number on their caller ID.

22. An inbound call from an unknown phone number routes to the Company inbox. The right panel shows the "Add Person" flyout form (First Name / Last Name / Email / `Add person` button / "or update an existing person" search). Completing the form creates a new contact linked to that phone number.

23. With call recording enabled: every call via a CRM number is recorded. The recording URL is stored in `crm_timeline.recording_url`. The recording cannot be deleted via any UI or API endpoint short of deleting the entire contact record.

24. With Call Recording Disclosure enabled: a pre-call message "This call is being recorded." plays to the non-CRM party (via Twilio TwiML `<Say>`) before recording begins.

25. An AI summary is generated for all calls lasting 15 seconds to 60 minutes within 15 seconds of call completion. Calls shorter than 15 seconds or longer than 60 minutes show no summary. Transferred calls show no summary.

26. Brokers can hover over any AI summary line to edit or delete it. Clicking an action item creates a task directly from the summary with pre-filled task type, assignee, and due date.

27. Voicemail left by a contact: appears in the Inbox with play `▶` and download `⬇` buttons and transcription text below. Keyword search in the call log finds transcription text.

28. Blocking a phone number via Inbox `···` menu: future inbound calls/texts from that number do not appear in the Inbox. Admin block list allows bulk entry.

### Compliance

29. A contact with `compliance:hard-stop` tag: attempting to send ANY communication (email compose, text compose, Log Call, any bulk action, any automation step) is blocked at the suppression check. The error message clearly states "compliance:hard-stop — all channels blocked."

30. The suppression check runs before every send path: manual compose (email, text), bulk batch, action plan step, scheduled send cron. A suppressed contact cannot slip through any path.

31. The block list (Admin > Company > Block List) accepts comma-separated emails or phone numbers. Blocked entries prevent inbound communication from entering the CRM. Admins can unblock.

32. A2P Business Registration status is displayed in Admin with clear status indicators. When status is not "Fully Registered," the text compose UI displays: "Texting is unavailable until Business Registration is complete" with a link to Admin > Business Registration.

33. Email domain authentication status is displayed in Admin. Unauthenticated accounts see a warning in the Batch Email compose UI. The mandatory unsubscribe footer cannot be removed from batch/automation emails.

34. An admin who sends a batch email on behalf of an agent: replies from contacts route to the agent, not the admin. The Batch Email Report shows the admin as the creator; individual contact timelines show the agent's name.

35. Quiet hours: a text queued at 11pm fires at 8am in the assigned broker's timezone. If the contact sends an inbound text at 7am, the queued text auto-cancels. The timeline shows accurate "Queued — will send at 8am [date]" status (never shows "Sent" before delivery).

---

## Sources

### Vision-verified screenshots
- **shot-01:** Contact detail, Text tab active with warming-up banner; timeline with 4 email entries (open counts, via-automation badges, BCC to ryan.realty@followupboss.me, Jun 13 CMA email with attachment); tag taxonomy visible; FUB number warm-up state; overdue task orange styling
- **shot-15:** Contact detail, Send Email compose open; full email compose UI (To: chip, CC/BCC toggles, subject, template pills, rich-text toolbar, HTML signature block with legal footer, Attachments/Templates tabs, Send + schedule icon, trash discard); timeline filter counts (emails:3, texts:1); email enriched social profile
- **shot-23:** Contact detail, Text compose open with recipient search dropdown; group text recipient picker showing Contacts + USERS sections; batch email timeline items with "1 open/6 clicks" and "via batch email" badges; activity filter bar counts (emails:40)

### GIF interaction analyses
- **inbox.md:** Folder tree (My Inbox / Company, 5 sub-folders), thread list anatomy and unread count live decrement, filter dropdown (Emails/Texts/Calls checkboxes with Filter(N) badge), reply compose inline expansion with quick-tag row and full HTML signature, unknown-caller Add Person flyout, Company inbox voicemail thread with inline audio player, Team Inbox Manage page (table columns + New Team Inbox / Add Number actions), auto-read on thread open, bulk-select "Cancel" button, Close/Reopen thread behavior

### Official FUB documentation
- **fub-docs/emailing.md:** Connected email limits (1/user, Google/Microsoft only), 10,000 batch/day limit, 4 Action Plan emails/contact/day limit, resubscription requires emailing FUB support (no self-service UI), unsubscribe blocks only marketing (not direct 1:1), domain authentication via Entri, mandatory unsubscribe footer, HTML inline-styles-only restriction, "All Mail" IMAP label requirement, login email vs. connected email duality, historical import 90-day / reconnect 2-day window, Gmail 15-connection limit, batch report 100-send cap, admin-only email deletion, send-on-behalf reporting attribution
- **fub-docs/texting.md:** A2P 10DLC mandatory before any texting, 8-element website form + privacy policy requirements, 320-character recommendation, emoji = 80–90 chars, quiet hours (9pm–8am assigned agent's timezone), auto-cancel chain for queued texts, 50 scheduled texts/day team-wide cap + 1-per-contact limit, 24-hour schedule window only, group text cap = 10 total, vCard limit = 4, Template Performance Score mechanics (7-day minimum), carrier filtering error code 30007, API /v1/textMessages is LOG-ONLY (no SMS sent), CTIA opt-out keywords, TCPA consent windows (90-day inquiry / 18-month prior relationship), first-touch compliance requirement (name + company + question), video texting mobile-only + 5MB threshold, Puerto Rico not supported
- **fub-docs/calling.md:** Three calling methods (Internet/Mobile/Ask), mobile bridge pattern (lead sees FUB number), hardware/internet requirements (5Mbps/5Mbps/100ms/30ms), inbound routing priority tree, warm transfer (Cancel/Merge/Complete), call lists (desktop only, auto-resume), call recording cannot be deleted, call recording disclosure fixed text "This call is being recorded.", AI summary pipeline (transcript → LLM → 15-second return), scope 15s–60min / no transfers, spam label protection via Neustar tied to Business Registration, DNC not native (CallAction integration), phone parking lot 20-day retention, porting: US standard only (no toll-free, no Canadian), cold calling/mass texting violates ToS

### Prior spec sections superseded
- §17.4 (Compliance & suppression) — superseded by §17.6 (this file); prior version was 4 bullet points; this version expands to full suppression check pseudocode, compliance tag taxonomy, A2P requirements, TCPA rules, email domain auth gates, quiet hours, and content-level SMS guardrails
- §17.5 (Communications layer) — superseded by §17.2–17.5 (this file); prior version was 4 bullet points; this version expands to full channel-by-channel specifications with all limits, states, data models, and acceptance criteria
- Prior spec §17.4 and §17.5 had no mention of: 4 Action Plan emails/contact/day limit, 10,000 batch/day limit, A2P 10DLC 8-element website form requirements, quiet hours timezone being assigned AGENT's (not lead's), 50/day scheduled text team cap, API /v1/textMessages being log-only, resubscription requiring manual support request (no UI), call recording being permanently undeletable, AI summary scope restriction (15s–60min, no transfers), carrier filtering error code 30007, emoji character weight (80–90 chars), warm transfer mechanics, parking lot 20-day retention window, or the warm-up state blocking texts-but-not-calls distinction
