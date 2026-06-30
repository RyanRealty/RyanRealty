# §7c — Module: Person Detail — Multi-Channel Compose, Modals & Right Rail

> **Sources.** Ten vision-verified per-screen shot analyses (shots 15, 16, 17, 18, 19, 20, 22, 23, 52, 60); one GIF interaction-flow analysis (`fub-analysis-gif/people.md`); official FUB Help Center documentation (`fub-docs/emailing.md`, `fub-docs/texting.md`, `fub-docs/people-contacts.md`); prior spec §7.3 compose bar, §7.6 edit phone, §7.10 right rail, §7.5 collaborators.
>
> **Design-token note.** This is an internal admin tool. Behavior and structure are documented faithfully from FUB. All color / font / component references at the end of each section map FUB's visual language to the Ryan Realty design system (navy `#102742` / cream `#faf8f4`, Geist + Amboqia, `@/components/ui/*`). FUB's blue (`#4299e1`) / teal (`#38b2ac`) palette is **not** reproduced.
>
> **Marking conventions.** `(inferred)` = behavior not directly visible in any source but reconstructed from FUB product design norms. `[CORRECTION]` = prior-spec error corrected by this document.

---

## 7c.1 Compose bar — action tab bar

**Location.** Top-of-center-column, above the compose area and above the activity timeline. Full-width of the center column; persists regardless of which contact is open.

**Tab count.** Exactly **four** co-equal tabs. `[CORRECTION: prior spec §7.3 listed "Add Task / Appointment" as a fifth compose-bar action — not observed. Tasks and Appointments are created from the right rail, not the compose bar.]`

| Tab index | Label | Icon | Keyboard shortcut (inferred) |
|---|---|---|---|
| 1 | **Create Note** | Pin / asterisk — amber/gold color when active | — |
| 2 | **Send Email** | Envelope | — |
| 3 | **Text** | Speech bubble | — |
| 4 | **Log Call** | Phone handset | — |

**Active-tab styling.** The active tab receives an underline or heavier border-bottom, slightly lighter background; icon and label in a more saturated / darker color. Inactive tabs are muted gray text.

**"How it works" link.** A fifth element right-aligned in the same tab-bar row — not a tab itself. Renders as small gray text + ⓘ info icon. (inferred) Opens a help tooltip or tour for the compose area. Observed in shots 15, 20, 52, 60 and GIF f08.

**Tab switching.** Optimistic: the tab border updates immediately on click; the compose body transitions to the new mode. For Send Email only, the body enters an async loading state while the email signature is fetched (see §7c.3.2). For Text, the body either shows the compose form or the provisioning placeholder (see §7c.4.3), depending on whether the FUB phone number is live.

---

## 7c.2 Create Note mode

**Compose area layout (top to bottom):**

1. **Textarea.** Multi-line, white background, rounded corners, light 1-px border. Placeholder: `Add notes or type @name to notify`. Empty by default.
2. **"Try Team Mentions" link.** Below the textarea, left-aligned. Text: `👥 Try Team Mentions` or person-group icon + "Try Team Mentions". Blue underline link style. (inferred) Clicks to pre-insert "@" in the textarea, or shows a one-time tooltip explaining the @mention feature.
3. **Submit button.** Right-aligned, bottom of compose area. Label: `Create Note`. Style: pill-shaped, amber/gold fill, white text. **Disabled (muted/greyed) when the textarea is empty.** Becomes active only when text is entered.
4. **Star icon (inferred).** Small star icon left of or near the submit button, allowing the note to be starred/important before saving.

**@mention behavior.** Typing `@` in the textarea triggers a typeahead dropdown of team members (Matt Ryan, Rebecca Peterson, Paul Stevenson, and any other FUB users on the account). Selecting a name notifies that user. FUB calls these "Team Mentions." The @mention appears inline in the note body. (inferred from FUB norms and placeholder text)

**On submit.** Clicking `Create Note` POSTs a note event; a new timeline entry appears in the activity feed with: agent avatar, "Note created by [Agent Name]", timestamp, and full note body. Textarea clears. (inferred)

**Ryan Realty implementation.** Use `<Textarea>` from `@/components/ui/textarea`. Submit with `<Button variant="default">`. Team mention dropdown uses `<Command>` from `@/components/ui/command`. Disable submit via the `disabled` prop.

---

## 7c.3 Send Email mode

### 7c.3.1 Header fields (To / CC / BCC / Subject)

**To field.**
- Pre-populated with the current contact as a removable chip (observed: GIF f10 shows "Matthew Ryan" chip with × to remove).
- Chip style: pill-shaped, contact name, × icon. Clicking × removes the recipient.
- Multiple recipients are supported — type to search and add additional contacts (inferred from FUB batch-email capability).
- A dropdown caret or "+" adjacent to the To field opens a recipient-search typeahead (inferred; consistent with Text compose behavior documented in §7c.4.2).

**CC field.**
- Always visible when email compose is open (observed: shot 16).
- Text input accepting one or more email addresses as chips.
- Appears as a row below the To field, labeled `CC`.

**BCC field.**
- **Hidden by default.** `[CORRECTION: prior spec implied BCC was always shown. From shot-16: BCC is a toggle link — "Add BCC" — that appears at the end of the CC row. Clicking it reveals the BCC input field.]`
- Label: `Add BCC` (link-style, gray/muted). On click: BCC input row appears below CC.

**Subject field.**
- Single-line text input, labeled `Subject:` or unlabeled with placeholder `Subject` (inferred). Required for email sends. Merge-field insertion available (see §7c.3.4).
- A loading spinner appears below the Subject field immediately after the Send Email tab is clicked, while the signature is fetched asynchronously (GIF f10: "Small circular loading/refresh spinner icon below Subject").

### 7c.3.2 Async email signature loading

**Trigger.** Every time the Send Email tab is activated.

**Loading state** (observed: GIF f10).
- The compose body area shows a spinner / loading indicator.
- The To, Subject, CC, BCC fields and the rich-text toolbar are already present and interactive.
- Template chips are NOT yet visible.
- Duration: typically sub-second; the spinner is observable only on a slow connection or first load.

**Loaded state** (observed: GIF f11, shots 15, 16, 19).
- Template chip row appears at the top of the compose body (see §7c.3.3).
- Email signature block auto-inserts at the bottom of the compose body (see §7c.10 for verbatim content).
- Agent may type above the signature; signature remains anchored at the bottom.

**Signature source.** Per-user, configured in FUB My Settings. Fetched via an API call keyed to the logged-in user's FUB user record. Signature HTML is inline-style only (no `<style>` blocks, no `<iframe>`). Images in the signature are hosted as public URLs. (doc: emailing.md §6)

**Implementation note.** Signature load is async — do NOT pre-populate the body synchronously. Show a skeleton/spinner in the body zone, then swap in `signature_html` when the fetch resolves. Template chip row renders after signature loads.

### 7c.3.3 Template chips

**Position.** A horizontal scrollable row at the very top of the compose body, between the rich-text toolbar and the body content area. Appears only after the async signature load completes.

**Chips observed** (GIF f11, shot-16):

| Chip label | Notes |
|---|---|
| `✦ Introduction` | Sparkle/asterisk icon prefix (shot-16 observation); also seen as `+ Introduction` in GIF f11 |
| `✦ Follow Up` | — |
| `✦ Still Buying` | — |
| `✦ Nurture Lead` | Confirmed in prior spec; 4th chip |
| `✦ Custom` | (inferred from prior spec; may be a 5th chip not visible in all shots) |

**Behavior.** Clicking a chip inserts the full body of that named email template into the compose body at the cursor position (or replacing current body content). The signature remains at the bottom. (inferred from FUB template-insert norms)

**Implementation note.** These are Quick-Insert shortcuts for the most-common email templates. They are distinct from the full template picker (see §7c.3.9). Render as `<Badge>` or small pill-shaped `<Button variant="outline">` components. The sparkle/star icon is an SVG inline or a character `✦`.

### 7c.3.4 Rich text editor toolbar

**Observed buttons** (shots 15, 16, 19):

| Button / control | What it does |
|---|---|
| **B** Bold | Toggle bold on selection |
| *I* Italic | Toggle italic |
| _U_ Underline | Toggle underline |
| ~~S~~ Strikethrough | Toggle strikethrough (shot-16: confirmed in toolbar) |
| ≡ ≡ (list icons) | Unordered list / ordered list |
| 🔗 Link | Insert hyperlink — opens URL input dialog |
| 🖼 Image | Insert image — opens file picker or URL input |
| 📹 Video | Insert video — paste YouTube URL; FUB generates clickable thumbnail. BombBomb integration also available. |
| 😊 Emoji | Open emoji picker |
| T (text/HTML) | Insert HTML — inline-styles only; strips `<style>` and `<iframe>` |
| [] Code / other | (inferred: remove formatting) |
| **Merge Fields** dropdown | Upper-right of compose area. Inserts `%field_name%` tokens into Subject or body. Categories: CONTACT, COMPANY, AGENT, LENDER, SENDER, PROPERTY, LAST VIEWED, LEAD SOURCE, OTHER (Greeting Time). Custom fields available if configured. See §7c.3.4.1. |

**Merge Fields — full token list** (doc: emailing.md §5):

| Category | Available tokens |
|---|---|
| CONTACT | `%contact_name%`, `%contact_first_name%`, `%contact_last_name%`, `%contact_and_relationship_first_name%`, `%contact_email%`, `%contact_phone%`, `%contact_address%`, `%contact_street%`, `%contact_city%`, `%contact_state%`, `%contact_zipcode%`, `%contact_country%` |
| COMPANY | `%company_name%`, `%company_phone%` |
| AGENT | `%agent_name%`, `%agent_first_name%`, `%agent_last_name%`, `%agent_email%`, `%agent_phone%`, `%agent_mobile_phone%`, `%agent_merge_field%` |
| LENDER | `%lender_name%`, `%lender_first_name%`, `%lender_last_name%`, `%lender_email%`, `%lender_phone%`, `%lender_mobile_phone%`, `%lender_merge_field%` |
| SENDER | `%sender_name%`, `%sender_first_name%`, `%sender_last_name%`, `%sender_email%`, `%sender_phone%`, `%sender_mobile_phone%`, `%sender_merge_field%` |
| PROPERTY | `%inquiry_address%`, `%inquiry_address_url%`, `%inquiry_address_preview%` |
| LAST VIEWED | `%viewed_address%`, `%viewed_address_url%`, `%viewed_address_preview%`, `%last_5_preview%` |
| LEAD SOURCE | `%lead_source%` |
| OTHER | `%greeting_time%` (resolves to "morning" / "afternoon" / "evening" based on send time) |
| CUSTOM | One token per custom field defined in Admin > Custom Fields; one `%user_merge_field%` per user (Calendly link, Zillow review URL, etc.) |

**Empty-field behavior.** If the source data field is empty, the merge token renders blank — no fallback text. (doc: emailing.md §5)

### 7c.3.5 AI Writing assist

**Observed.** Shot-16, prior spec §7.3. Labeled `AI Writing` or indicated by a sparkle icon `✦` in the compose toolbar.

**Behavior.** Opens an AI text-generation panel or modal within the compose area. Agent enters a prompt or selects a contextual suggestion; AI generates a draft email body. Agent reviews and optionally edits before inserting. (inferred; see texting.md §10 Smart Messages for the text equivalent — same paradigm for email)

**Data sources used (inferred from Smart Messages doc).** Contact timeline (prior emails, notes, calls), agent notes, lead context.

**Gate.** Agent must review and optionally edit before the draft inserts into the compose body. Auto-send of AI-generated content is not permitted. (doc: texting.md §10 "Agent must review and optionally edit before sending")

### 7c.3.6 Business Card inserter

**Observed.** Prior spec §7.3 ("Business Card (inserts the broker's HTML signature block)").

**What it inserts.** The broker's HTML signature card — identical in content to the auto-inserted email signature (see §7c.10) — but inserted **at the cursor position** in the body rather than anchored at the bottom. Useful when an agent wants the signature block mid-email (e.g., introducing themselves in line). `[CORRECTION: prior spec says the Business Card includes a "podcast link" — this is not confirmed in any shot or GIF. Confirmed links are: Google reviews + Oregon Initial Agency Disclosure Pamphlet. Remove "podcast link" from any build.]`

**UI.** A `Business Card` button or icon in the compose toolbar or footer, distinct from the signature auto-insert.

### 7c.3.7 Follow Up scheduler / schedule-send

**Trigger.** Clock icon (🕐) adjacent to the Send button, or a dropdown on the Send button. Observed in shots 15, 19 ("compose strip at top with recipient chip, attach, Reply/Forward/More, Send Email, clock").

**Options** (doc: emailing.md §9):
- Pre-set timeframes: "Next morning," "Next afternoon," etc.
- Custom date and time picker.

**Behavior on schedule.** Email appears at the top of the contact's activity timeline with a "Scheduled" status. Sends automatically at the chosen time. Can be canceled from the contact's timeline ("Cancel Send").

**Reporting.** Scheduled 1:1 emails appear on the contact timeline. (Scheduled batch emails appear in Reporting > Batch Emails.)

### 7c.3.8 Marketing Emails secondary send path

**Observed.** Shot-20: "Marketing Emails tooltip confirms secondary send-path button." `[This element was NOT documented in prior spec §7.3 — it is an addition.]`

**What it is.** A secondary send button or toggle visible in the email compose footer. Distinct from the primary "Send" (which sends a personal 1:1 email). When activated, the email is sent as a marketing/batch email (opt-out link auto-appended; counts against the 10,000/day marketing email quota).

**Key distinction** (doc: emailing.md §12):
- **Personal 1:1 email (primary Send):** Can still be sent even if the contact has unsubscribed from marketing.
- **Marketing Email (secondary path):** Blocked for contacts with `unsubscribed` status. Opt-out link is mandatory and auto-appended. Cannot be removed.

**Implementation.** The compose UI must clearly label these two paths so agents know which path they are sending from. A tooltip or label on hover clarifies the distinction.

### 7c.3.9 Continue Sending state / banner

**Observed.** Prior spec §7.3 mentions "A 'Continue Sending' state/banner exists for queued/interrupted/throttled sends."

**When it appears** (inferred from FUB norms):
- A batch email send was interrupted mid-send and can be resumed.
- A send was queued (paused due to rate limits or the 10,000/day cap) and can be continued.

**Visual.** A banner or inline notice in the compose/timeline area with a "Continue Sending" CTA button. (inferred)

### 7c.3.10 Attachments tab

**Location.** A secondary tab or button in the compose footer, labeled `Attachments`. (observed: shot-15 "Attachments and Templates buttons at bottom of compose area")

**Behavior.** Opens a file picker to attach files to the 1:1 email. Max file size not explicitly documented in the UI but FUB Help Center confirms attachments are supported for 1:1 desktop emails. `[NOTE: Attachments are PROHIBITED for batch / action-plan / marketing emails — enforce in UI. Attachments are NOT available on mobile.]` (doc: emailing.md §20)

### 7c.3.11 Templates tab

**Location.** A secondary tab or button in the compose footer adjacent to Attachments, labeled `Templates`. (observed: shot-15 "Attachments and Templates buttons at bottom of compose area")

**Behavior.** Opens a full template picker (distinct from the quick-insert template chips). Shows the full library of email templates created in Admin > Email Templates. Templates can be shared or personal. Selecting a template inserts its subject + body content into the compose fields.

**Template picker columns** (inferred from FUB norms): Template Name, Preview, (Shared/Personal badge), Performance data (inferred).

### 7c.3.12 Email constraints from official docs

| Constraint | Value | Source |
|---|---|---|
| Max connected emails per user | 1 | emailing.md §1 |
| Supported email providers for 2-way sync | Google Workspace, Microsoft 365 only | emailing.md §2 |
| Batch emails per day (native FUB) | 10,000 per user | emailing.md §7 |
| Action Plan emails per contact per day | 4 max | emailing.md §18 |
| Attachments in batch / action plan emails | Prohibited | emailing.md §20 |
| Email template HTML | Inline styles only; no `<style>`, no `<iframe>` | emailing.md §4 |
| Email signature auto-appended to | All outbound 1:1, Batch, and Action Plan emails | emailing.md §6 |
| Resubscription after unsubscribe | Manual — email support@followupboss.com; no in-app UI | emailing.md §12 |
| Open / click tracking | Small green pill badge on timeline; hover for unique counts | emailing.md §10 |
| Email bounce display | Email address in **orange** on timeline; orange pill marker | emailing.md §11 |
| Email deletion | Admin-only; "no trace" in system after deletion | emailing.md §24 |
| Historical email import on first connect | 90 days back | emailing.md §1 |
| Historical email import on reconnect | 2 days back only (significant data-loss risk) | emailing.md §1 |

---

## 7c.4 Text (SMS) mode

### 7c.4.1 Standard compose state

**Layout (top to bottom):**

1. **To: field.** Chip for the primary contact (pre-populated with the current person's primary phone number). A dropdown caret (▾) on the chip allows selecting a different phone number when the contact has multiple numbers on file.
2. **"+" button** (recipient-search). A `+` icon button at the end of the To: row. Opens the recipient-search dropdown (see §7c.4.2).
3. **Sub-tabs (Intro / Templates).** Two tabs directly below the To: field. `Intro` shows the initial contact template; `Templates` shows the full text template library. (observed: shot-23 "Intro template sub-tab")
4. **Body textarea.** Multi-line. Placeholder text: (inferred) "Type a message…" or similar. Empty by default.
5. **Toolbar (below textarea).** Three or four icon buttons:
   - Template icon — opens template picker overlay.
   - Image/media icon — attach a photo or video (MMS).
   - Emoji picker icon.
   - (inferred) vCard icon — send agent contact card.
6. **Send Text button.** Right-aligned in the compose footer. Label: `Send Text`. **Disabled (muted) when the body textarea is empty.** (observed: shot-23 "Send Text button muted when body empty")
7. **Clock icon** — schedule text send (doc: texting.md §13). Opens a 24-hour window picker.

**Character limit.** 320 characters recommended max (doc: texting.md §3). A character counter (inferred) may appear near the textarea. Emoji characters consume ~80–90 chars each.

**Carrier filtering warning.** If a message body contains known spam-trigger patterns (shortened URLs, urgency words, "$" sign, excessive capitalization), the compose UI may show a warning or the message may be flagged after send with error code 30007 (orange badge, "The contact's mobile provider filtered your text before it could be delivered"). (doc: texting.md §22)

**First-touch compliance.** On first outbound text to a contact with no prior text history, a warning or prompt (inferred) reminds the agent to include: agent name, company name, purpose, and a question. Templates tagged for first-contact automatically include this. (doc: texting.md §17)

### 7c.4.2 Recipient-search dropdown

**Trigger.** Clicking the `+` button at the end of the To: row.

**Dropdown structure** (observed: shot-23 — Dan Corkill text compose view):

```
[search input]
─────────────
Lead            [pill badge]
+ Custom        [pill badge]
─────────────
CONTACTS / RELATIONSHIPS
  [Name of linked relationship 1]
  [Name of linked relationship 2]
  ...
─────────────
USERS
  Matt Ryan
  Rebecca Peterson
  Paul Stevenson
```

**Sections:**
- **Lead / + Custom pills.** Recipient-type selectors at the top. "Lead" = the primary contact; "+ Custom" = enter a raw phone number not in the system.
- **CONTACTS / RELATIONSHIPS.** Lists people linked to the current contact via the Relationships section of the left sidebar. Each row shows the person's name and relationship type (inferred).
- **USERS.** Lists all FUB team members (Matt Ryan, Rebecca Peterson, Paul Stevenson). Adding a user creates a group text that includes that team member's phone.

**Group text rules** (doc: texting.md §6). Max 10 phone numbers total (sender + 9 recipients). All participants see all replies in the thread. Not for mass use — intended for deal-specific coordination (buyer + spouse + agent + lender on an offer, etc.).

**Behavior on selection.** Each selected phone/contact appears as a chip in the To: field, adjacent to the existing chips. Chips are removable (× icon). If 10 chips are present, the "+" button disables.

### 7c.4.3 FUB number warming-up state (provisioning placeholder)

**Trigger.** When the FUB phone number has been provisioned but has not yet completed the carrier warm-up period.

**What is shown** (observed: GIF f12):
- The entire compose body area is replaced by a full-panel informational state — no compose form visible.
- **Heading:** `Your Follow Up Boss number is coming up!`
- **Body copy:** "You can make calls from this number now and it... Please check back tomorrow. While you wait, try out the R..." (truncated in GIF; full text inferred to explain the warm-up period and recommend using calls in the meantime)
- **CTA button:** `Try out texting` (blue/teal fill)

**During warm-up** (doc: texting.md §20):
- Outbound texts to US numbers: **BLOCKED**
- Receiving texts: ALLOWED
- Outbound calls: ALLOWED
- Receiving calls: ALLOWED
- Duration: unspecified; FUB states they are "working with their texting partners to shorten this warm-up period."

**Ryan Realty in-house implementation.** Check `brokers.twilio_number IS NOT NULL` before showing the SMS compose. If `null`, show the provisioning placeholder (but per memory, Ryan Realty's A2P is already verified and 541.703.3095 is ported — so this state should not appear for active brokers).

### 7c.4.4 A2P 10DLC registration gate

**When it fires.** If Business Registration has not been completed (or is not yet `Fully Registered`), clicking the Text tab shows a registration prompt instead of the compose form. `[This is a harder gate than the warm-up state — the compose is entirely replaced.]` (doc: texting.md §2)

**Registration statuses and their UI state:**

| Status | Color | Compose state |
|---|---|---|
| Not Started | Gray | Full registration prompt; compose blocked |
| Under FUB Review | Yellow | Compose blocked with "in review" notice |
| Submitted to Carriers | Yellow (carrier) | Compose blocked with "submitted" notice |
| Rejected by FUB | Red | Compose blocked with error; fix-and-resubmit prompt |
| Rejected by Carriers | Red | Compose blocked with error + carrier rejection guidance |
| Fully Registered | Green | Full compose available |

**Ryan Realty current state.** A2P registration is VERIFIED as of project memory (2026-06-24). This gate does not block Matt's account. Document for future broker onboarding.

### 7c.4.5 Text compliance rules from official docs

| Rule | Value / Detail |
|---|---|
| Opt-out keywords that block future texts | STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT |
| Opt-out visual indicator | Phone number displayed in **orange** on contact profile; opt-out event logged to timeline |
| Quiet hours window | 9pm–8am in the **assigned broker's** local time (not the contact's timezone) |
| Auto-cancel queued text | Any inbound contact (text, email, or call) before 8am auto-cancels the queued text |
| Scheduled text: team-wide cap | 50 per 24-hour window |
| Scheduled text: per-contact cap | 1 scheduled text at a time |
| Scheduled text: window | Next 24 hours only |
| Carrier filtering error code | 30007 — orange badge on message in timeline |
| Max group text participants | 10 phone numbers (sender + 9) |
| Recommended max message length | 320 characters |
| Emoji character weight | ~80–90 characters each |
| TCPA consent windows | 90 days (property inquiry); 18 months (prior client) |
| Initial outreach compliance | Must include: agent name, company name, purpose, a question |
| Shortened URLs | Prohibited in texts (use full URLs) |
| Video: send as MMS vs link | <5MB: inline MMS; >5MB: browser redirect link; max 500MB per video |
| vCard: max per message | 4 vCards |

---

## 7c.5 Log Call mode

**What is shown** (inferred from FUB norm; not directly captured in a dedicated shot):
- **Contact phone selector.** Dropdown listing all phone numbers on the contact record. Pre-selects the best/primary number.
- **Call duration.** Time input (manual entry — for logging a call that already happened externally, not for initiating one). (inferred)
- **Call outcome / disposition.** Dropdown: Left voicemail / Spoke with lead / No answer / Wrong number / Do not contact / Other. (inferred from FUB norms)
- **Notes textarea.** Free text field for call notes.
- **"Log Call" submit button.** Creates a Call event on the timeline with: direction (outbound), outcome, duration, notes, agent, timestamp.

**FUB Dialer vs. manual log.** If the FUB Dialer add-on is active, clicking a phone number on the contact detail page initiates a live call through the dialer and auto-logs it. If Dialer is not active, "Log Call" is a manual entry form only. Ryan Realty uses the dialer (has FUB Phone), so calls initiated from the contact detail may auto-log. (inferred from account context)

---

## 7c.6 Edit Phone Numbers modal

**Trigger.** Clicking the edit / pencil icon adjacent to the phone number section in the left contact sidebar. (observed: shot-18)

**Modal structure:**

```
┌──────────────────────────────────────────────┐
│  Edit Phone Numbers                   [✕]    │
├──────────────────────────────────────────────┤
│  Phone Number      │  Label        │  Bad    │
│                    │               │ Number  │
├──────────────────────────────────────────────┤
│ [_________________]│ [Mobile   ▾]  │  [ ]   │ [🗑]
├──────────────────────────────────────────────┤
│ [_________________]│ [Home     ▾]  │  [ ]   │ [🗑]
├──────────────────────────────────────────────┤
│  + Add another phone                         │
├──────────────────────────────────────────────┤
│              [Cancel]  [Save Phone Numbers]  │
└──────────────────────────────────────────────┘
```

**Column definitions:**

| Column | Type | Options / Notes |
|---|---|---|
| **Phone Number** | Text input | Editable; formatted as entered |
| **Label** | Dropdown select | Options: `Mobile`, `Home`, `Work`, `Other`, `Fax` |
| **Bad Number** | Checkbox | `[CORRECTION: prior spec §7.6 said "Best Number (radio)" — WRONG. Observed column header is "Bad Number" (a checkbox). Checking this marks the number as invalid; it does NOT designate a preferred number. FUB's "Best Number" concept may be elsewhere on the profile.]` |
| (row delete) | Icon button | 🗑 trash icon; removes the row. Per-row. |

**"+ Add another phone" link.** Below the last phone row. Clicking appends a new empty row. (observed: shot-18)

**Max phone numbers.** 25 total across the contact and all their linked Relationships (doc: people-contacts.md §1).

**Footer buttons:**
- `Cancel` — closes modal, discards changes.
- `Save Phone Numbers` — persists changes, closes modal, updates contact profile. (observed: shot-18)

**Ryan Realty implementation.** `<Dialog>` from `@/components/ui/dialog`. `<Table>` from `@/components/ui/table` for the row layout. `<Input>` for phone number. `<Select>` for label. `<Checkbox>` for Bad Number. `<Button variant="outline">` for Cancel; `<Button>` for Save.

---

## 7c.7 Collaborators modal

**Trigger.** Clicking the `+` icon button in the Collaborators section of the right rail. (observed: shot-22)

**Modal structure:**

```
┌──────────────────────────────────────────┐
│  Collaborators                    [✕]   │
├──────────────────────────────────────────┤
│  [🔍 Search for a collaborator      ]   │  ← auto-focused; blue border
│                                          │
│  [ ] Rebecca Peterson                    │
│  [ ] Paul Stevenson                      │
│                                          │
│               [Cancel]  [Save]           │
└──────────────────────────────────────────┘
```

**Search field.** Auto-focused when the modal opens (observed: shot-22 "search field auto-focused with blue border"). Placeholder: `Search for a collaborator`. Live-filters the list as the agent types.

**Collaborator list.** Shows ALL FUB team members **except the currently assigned primary agent for this contact**. In Ryan Realty's 3-broker account:
- If Matt Ryan is the assigned agent: list shows Rebecca Peterson + Paul Stevenson.
- If Rebecca Peterson is assigned: list shows Matt Ryan + Paul Stevenson.
- If Paul Stevenson is assigned: list shows Matt Ryan + Rebecca Peterson.

`[This is the observed behavior from shot-22 (Matt is the viewer/owner, Rebecca + Paul listed). The primary agent is excluded from the collaborator list.]`

**Checkbox behavior.** Multi-select. Previously added collaborators have their checkbox pre-checked when the modal opens. Unchecking removes them. (inferred)

**No documented limit** on number of collaborators per lead. (doc: people-contacts.md §6)

**Footer buttons:**
- `Cancel` — closes modal, discards changes.
- `Save` — persists selections, closes modal, updates Collaborators section in right rail with the selected agents.

**Collaborator permissions** (doc: people-contacts.md §6):
- Can view and edit the contact profile.
- Can send emails, texts, calls to the contact.
- Can view shared emails for that contact.
- Do NOT receive automatic notifications for lead activity — only the assigned agent does.
- Exception: if the lead directly contacts the collaborator's email or FUB number, the collaborator is notified.
- @mentions or task assignments from the assigned agent can also alert collaborators.
- When a collaborator is promoted to the contact's assigned agent, they are **automatically removed from the collaborator list**.

**Ryan Realty implementation.** `<Dialog>` from `@/components/ui/dialog`. `<Input>` for search. `<Checkbox>` with `<Label>` for each broker. Use `brokers` table from Supabase to populate the list; filter out `contact.assigned_broker_id`. Save to `crm_collaborators` junction table.

---

## 7c.8 Right action rail (stacked widgets)

**Location.** Right column of the person-detail three-column layout (~30% width, ~330–360px). Light gray background (`#f7f8fa` in FUB; map to `bg-secondary` or `bg-muted` in the Ryan Realty system). Independently scrollable.

**Reordering.** Sections can be drag-and-dropped into a custom order per user (doc: people-contacts.md §1 "drag-and-drop via the handle icon on section title headers"). Per-user preference, not per-account.

**Collapse/expand.** Each section has a chevron (▴/▾) to collapse or expand. State is persisted per user.

**Smart indicators when collapsed** (doc: people-contacts.md §1):

| Section | Shows indicator when collapsed |
|---|---|
| Action Plans | YES — if a plan is currently running |
| Appointments | YES — upcoming appointment badge |
| Tasks | YES — badge if a task is assigned to the current user |
| All others | No indicator when collapsed |

**Section order as observed** (shots 15, 52, 60; GIF f08–f09):

1. Action Plans
2. Activity
3. Tasks
4. Appointments
5. AgentFire FUB Widget
6. Deals
7. Automations
8. Files
9. Collaborators
10. (Keyboard shortcut hint at bottom — not a collapsible section)

---

### 7c.8.1 Action Plans section

**Header.** Icon: ▶ play triangle (gray). Label: `Action Plans`. Expand chevron on right.

**Running-plan item** (inferred from prior spec §7.10 and shot observation):
```
[▶] Web Inquiry Option 01 / #2
    N of M steps complete · Started X ago
    [‖ Pause]  [■ Stop]
```
- Plan name + automation name.
- Progress indicator: "N of M" steps complete.
- "Started X ago" recency timestamp.
- Pause (‖) and Stop (■) inline action buttons.

**Empty state.** `No action plans running` (gray muted text). Observed: shots 52, 60, GIF f08.

**"+" button.** Opens the Apply Automation modal to enroll the contact in an action plan or automation. (§13.3 of main spec)

---

### 7c.8.2 Activity section

**Header.** Icon: activity / footprints icon (gray). Label: `Activity`. On the right side of the header: `Seen X days/months ago` timestamp text + a dropdown ▾ chevron.

**"Seen X ago" value.** The `last_seen_at` timestamp from website pixel tracking — the most recent website visit recorded for this contact. Examples: "Seen 6 days ago" (shot-60, GIF f09), "Seen 8 months ago" (shot-52).

**Expanded state.** (inferred) Shows a compact activity summary with filter-by-type dropdown. The full activity timeline is in the CENTER column, not here; this right-rail section is a summary widget.

**No "+" add button** on this section (none observed).

---

### 7c.8.3 Tasks section

**Header.** Icon: checklist / grid-dots icon (gray). Label: `Tasks (N)` where N = total open task count shown in parentheses. Example: `Tasks (19)` (shots 60, GIF f09).

**Right-side header controls (three elements):**
1. ⚡ Lightning bolt icon — "quick task" or "smart task" creation shortcut. (inferred) Likely opens a pre-filled task modal with suggested follow-up based on contact activity, or triggers a batch "complete all overdue" action.
2. `+` blue circle — opens a new task creation modal.
3. ▴ chevron — collapse/expand.

**Task item row:**
```
[📞] Task title text here                    [due date blue link]
     Assigned to: [Agent Name]               [avatar icon]
```
- Phone handset icon (green/teal) = task type is "Call."
- Task title (bold, dark).
- Due date as a blue link (clicking opens task detail or edit). **Overdue tasks show date in orange or red** (inferred from FUB norms; confirmed by GIF f09 showing "May 17th 2026" — clearly overdue at capture time June 2026).
- Assigned agent name + avatar.

**Auto-generated tasks observed** (shots 60, GIF f09):
- `Buyer intent page activity. Follow up now.` — triggered by website pixel detecting buyer-intent page visit.
- `Lead returned to website. Follow up now.` — triggered repeatedly by pixel tracking returns.

**Empty state.** `No upcoming tasks` (gray muted text). Observed: shot-52.

---

### 7c.8.4 Appointments section

**Header.** Icon: calendar grid (gray). Label: `Appointments`. `+` blue circle on right.

**"+" behavior.** (inferred) Opens a new appointment creation modal with fields: Date/Time, Type, Linked Contact, Agent, Notes, optional Google Calendar sync.

**Appointment item row** (inferred):
```
[📅] Appointment title          [date/time]
     Type: [Showing / Call / Meeting / …]
```

**Empty state.** `No upcoming appointments` (gray muted text). Observed: shots 52, 60.

---

### 7c.8.5 AgentFire FUB Widget section

**Header.** Icon: document/page icon (gray). Label: `AgentFire FUB Widget`. Chevron on right.

**Default state.** Collapsed by default. (observed: shots 52 — "collapsed"; shots 15 — state not captured)

**Expanded content** (inferred). Shows website behavioral data for the contact from the AgentFire IDX platform: listings viewed, searches run, page visits, saved properties, CMA data. Populated only if the contact has AgentFire website activity. If no activity, likely shows an empty state or placeholder.

**Third-party integration.** AgentFire is Ryan Realty's IDX/website platform. The FUB widget is an embedded iframe or API-rendered data block. Not a native FUB feature.

---

### 7c.8.6 Deals section

**Header.** Icon: briefcase / deal icon (gray). Label: `Deals`. `+` blue circle on right.

**Deal item row** (inferred):
```
[🏷] Deal name / address       [stage pill]
     $X,XXX,XXX               [close date]
```

**Empty state.** `No deals yet` (gray muted text). Observed: shots 52, 60.

**"+" behavior.** Opens a new deal creation form linked to this contact. (inferred)

---

### 7c.8.7 Automations section

**Header.** Icon: ▶ play triangle (gray). Label: `Automations`. `+` blue circle on right.

**Running automation item** (observed: prior spec §7.10 and shot data):
```
[▶] Web Inquiry Option 01 / #2
    [● Running]    Started 3 days ago
    [‖]
```
- Automation name (e.g., `Web Inquiry Option 01 / #2`).
- **Green dot + "Running"** status badge.
- "Started X ago" recency.
- `‖` pause button — pauses the automation for this contact.

**Automation naming pattern.** Names like `Web Inquiry Option D1/01/#2` observed in prior spec — a structured naming convention (channel/sequence/step-within-sequence). `[CORRECTION: prior spec §7.10 listed this as if it were a separate section ("Web Inquiry Option D1/01/#2"). It is an ITEM within the Automations section, not a separate right-rail section.]`

**Empty state.** `No automations running` (gray muted text). Observed: shot-52.

---

### 7c.8.8 Files section

**Header.** Icon: paperclip (gray). Label: `Files`. `+` blue circle on right.

**"+" behavior — unique among sidebar sections** (observed: shot-17): `[ADDITION: not documented in prior spec §7.10. The Files "+" button opens a TWO-OPTION DROPDOWN sub-menu, not a single direct action:]`

```
[+] ▾
    ├── Upload File(s)
    └── Add Link
```

- `Upload File(s)` — opens the OS file picker; supports single or multiple file selection simultaneously. Max 100 MB per file; unlimited quantity; prohibited formats: `.exe`, `.vb`, `.bat`, `.cmd`. `[CRITICAL: leaving the page while a file is uploading cancels the upload. No background/resumable uploads.]` (doc: people-contacts.md §14)
- `Add Link` — opens a small form to enter a URL + custom title. Stores a link entry in the Files section rather than an actual file upload.

**Drag-and-drop.** The Files section also accepts files dragged directly from the desktop. Drag-target activated when a file is dragged anywhere over the right rail. Empty state explicitly calls this out: `No files yet, drag some here` (shot-52, GIF f08).

**File item row** (inferred):
```
[📄] filename.pdf                    [↓] [🗑]
     Uploaded by Matt Ryan · 3 days ago
```
- Filename + extension.
- Download button (↓) and delete button (🗑).
- Hover over the date/time stamp reveals who uploaded. (doc: people-contacts.md §14)
- PDFs download automatically (not in-browser preview). Other formats (images, docs) can be viewed in-browser. (doc: people-contacts.md §14)

**Files vs. email attachments.** Files stored here CANNOT be directly attached to emails from the profile file store. Workflow: download the file first → re-attach via the email composer's attachment button. (doc: people-contacts.md §14)

**Empty state.** `No files yet, drag some here` (shot-52, GIF f08).

---

### 7c.8.9 Collaborators section

**Header.** Icon: person silhouette + group / people icon (gray). Label: `Collaborators`. `+` blue circle on right.

**"+" behavior.** Opens the Collaborators modal (see §7c.7).

**Populated state.** Shows avatar + name of each added collaborator. Hovering over a collaborator shows a trash icon to remove them. (inferred from doc: people-contacts.md §6 "Hover over collaborator name in the Collaborators tile > click the trash icon.")

**Empty state.** (inferred) `No collaborators added` or simply an empty tile.

**Default.** Collapsed by default in shots 52 (observed), expanded in shots 15, 22 (where collaborators modal was active).

---

### 7c.8.10 Keyboard shortcut hint

**Position.** Pinned to the bottom of the right rail, below all collapsible sections. Not a collapsible section itself — always visible.

**Content.** `Press [→] to view next lead or [←] to view previous lead` (observed: shot-52, GIF f08).

**Styling.** Small, muted gray text (~12px). The `[→]` and `[←]` characters are rendered as styled keyboard-key indicators (pill-shaped, light gray border, similar to `<kbd>` HTML elements).

**Behavior.** Keyboard [→] navigates to the next person in the active list/filter. [←] navigates to the previous person. Same as clicking the `›` / `‹` arrows in the Person navigator header.

---

## 7c.9 Person navigator header

**Location.** Pinned at the top of the right rail, above all collapsible sections.

**Content observed** (shots 52, 60, GIF f09):
```
Person 1 of 874      ›
Person 1 of 17,123   ›
```

**Fields:**
- `Person N of M` — N = current contact's position in the active list; M = total contacts in the active smart list or "All People" filter at the time of navigation.
- `›` (right arrow) — navigates to the next person without returning to the list view.
- `‹` (left arrow) — navigates to the previous person (inferred; keyboard equivalent is [←]).

**Context persistence.** The count (M) reflects the currently active list filter. If the user arrived from "Out Of State Home Owners" (874 contacts), M = 874. If from "All People" (17,123 at capture time), M = 17,123.

**Optimistic navigation** (GIF rebuild note). The `›` arrow should prefetch the adjacent person record for near-instant transition. The count (M) does not re-query on each person-to-person navigation — it is cached from the list view.

**Ryan Realty implementation.** Small component in the right rail header. State comes from the navigation context (list ID + ordered record set). On navigation, updates the URL to the new person's route while keeping the list context in state.

---

## 7c.10 Email signature block (verbatim)

**Observed:** GIF f11 (full render), shots 15, 19.

The broker email signature is auto-inserted into every Send Email compose body after the async load. The verbatim content as observed:

```
[HEADSHOT PHOTO — Matt Ryan, left-floated, ~80px × 100px]

Matt Ryan | Owner & Principal Broker · Ryan Realty LLC
541.703.3095
matt@ryan-realty.com
ryan-realty.com

"Building community through authentic, exceptional customer service."

[Ryan Realty logo — navy wordmark]

Read our Google reviews  ·  Oregon Initial Agency Disclosure Pamphlet

─────────────────────────────────────────────────────
Matt Ryan is a licensed Oregon Principal Broker
(License #201206613) with Ryan Realty LLC. This
email and any attachments are for the exclusive and
confidential use of the intended recipient. This
message is subject to Oregon real estate disclosure
requirements (ORS 696.820). Equal Housing Opportunity.
[Equal Housing Opportunity logo]
```

**Key fields:**
- Name: `Matt Ryan`
- Title: `Owner & Principal Broker` (with `·` separator, not `—`) `[CORRECTION: prior spec §7.3 uses em-dash "—"; shot-15 analysis confirmed middle-dot "·" separator]`
- Brokerage: `Ryan Realty LLC`
- Phone: `541.703.3095` (FUB-tracked bio phone, not the direct line)
- Email: `matt@ryan-realty.com`
- Website: `ryan-realty.com`
- Tagline: `Building community through authentic, exceptional customer service.`
- Google reviews link: clickable text
- Oregon Initial Agency Disclosure link: clickable text; cites ORS 696.820 (observed in shot-19)
- Legal disclaimer: includes Oregon Principal Broker License `#201206613`
- Equal Housing Opportunity statement + EHO logo

`[CORRECTION: prior spec §7.3 mentions "podcast link" in the Business Card block — NOT observed in any shot or GIF. The two confirmed footer links are Google reviews and Oregon Agency Disclosure. Remove "podcast link" from all build references.]`

---

## 7c.11 LEAD ORIGIN system-generated note

**What it is.** An auto-created note event on the contact's timeline, generated by the FUB webhook when a new lead enters the system. Appears as the earliest timeline event for contacts that came in via the website / API.

**Visual style.** A standard note event (agent avatar = Matt Ryan if auto-assigned, or the system avatar). Header: `Note Imported By Matt Ryan` or `LEAD ORIGIN` label at the top of the note body.

**Note body structure** (observed: shot-20; structured key:value content auto-created by webhook):

```
LEAD ORIGIN

Source: [lead source name]
URL: [page URL where lead submitted]
Agent: [assigned agent name]
Stage: [initial stage]
Date: [submission timestamp]
IP: [contact's IP address] (inferred)
[Additional webhook payload fields]
```

The exact fields depend on what the incoming webhook sends. For Ryan Realty's seller LP webhook, the note body includes: the property address (if submitted), source identifier (e.g., "seller-lp"), and step completion status (e.g., "Partial lead: address entered, step 2 not yet completed"). (doc: shot-60 timeline showing seller inquiry event)

**Timeline position.** The oldest event — appears at the bottom of the timeline (which is sorted newest-first).

---

## 7c.12 Email tracking & activity badges

### Open / click tracking per email

**Per-email badge** (doc: emailing.md §10):
- **Green pill badge** with open count appears inline on the email event in the timeline.
- Example: `3 opens` (green background, white text).
- Hovering over the badge reveals unique open count.

**Click tracking** (doc: emailing.md §10):
- Separate badge for link clicks, also green.
- Tracking works via link wrapping / redirect URLs on all FUB-sent emails.

**Known false-positive sources:**
- Spam scanners (inflate opens and clicks).
- Privacy-focused Gmail and Outlook apps (block pixel, under-count opens).
- Copy-paste corruption from direct mail platforms.

### Batch email dual-badge

**Observed:** shot-23 (Dan Corkill; batch email tracking). `[ADDITION: not in prior spec.]`

When a contact received a batch (marketing) email, the timeline entry shows TWO badges:
```
[N opens]  [N clicks]
green       blue
```
- `N opens` — green badge.
- `N clicks` — **blue badge** (distinct from green). `[This is a visual distinction — opens = green, clicks = blue — observed from shot-23 but also consistent with FUB tracking UI docs.]`
- These appear as a pair on the email event row in the activity timeline.

### Delivery status indicators

**NOT DELIVERED badge** (observed: shot-52 timeline event):
- Pill-shaped badge, **RED fill**, white text: `NOT DELIVERED`
- `ⓘ` info icon immediately after the badge — clicking shows delivery failure details (inferred: SMTP bounce reason, error code).
- The email address appears in orange when the email bounced.

**"via automation" source label** (inferred from prior spec §7.3 mention of "via automation"):
- For emails sent by an action plan (not the agent directly), a "via automation" sub-label appears below the email event header.
- "View campaign email" link also appears for batch email events. (inferred from shot data)

---

## 7c.13 Activity timeline — tab bar (correction and full spec)

`[CORRECTION: prior spec §7.3 says tabs are "All | Email | Text | Calls | Notes (inferred set)." Official docs reveal 8 tabs.]`

**Complete tab list** (doc: people-contacts.md §1):

| Tab | Filter description |
|---|---|
| **All** | All activity types (default) |
| **Emails** | Email sends, receives, opens, clicks |
| **Texts** | SMS sent and received |
| **Calls** | Call log events |
| **Notes** | Agent-created notes |
| **Activity** | System events (website visits, list assignments, automation events) |
| **Marketing Emails** | Batch email and action-plan email events. **Shows only the 75 most-recent.** |
| **Starred Items** | User-starred timeline entries |

**Filter bar additional controls:**
- **Filters ▾** dropdown (right side of filter bar) — additional filters: Change Log, time-range selector (Recent | Last 3/6/12/24 Months), Reassignments filter. (observed: shots 52, 60; GIF f15)
- **Count badges.** Each tab shows a count of events of that type on this contact. Example from shot-52: email(0), note(1), call(0), sms-out(2), sms-in(2), starred(0). From shot-60: website-activity(22), starred(22).

**"Scroll to top" floating button.** (observed: shot-19 "floating 'Scroll to top' button"). Appears after scrolling down the timeline — floats in the lower-right corner of the center column. Returns the user to the top of the timeline.

---

## 7c.14 Prior spec errors corrected

| § | Prior spec text | Correction |
|---|---|---|
| §7.3 | "Send Email and Send Text as co-equal actions, plus Log Call, Create Note, **Add Task / Appointment** (inferred row)" | There are exactly **4 tabs**: Create Note \| Send Email \| Text \| Log Call. No "Add Task / Appointment" tab. Tasks and Appointments are added from the right rail sections (§7c.8.3, §7c.8.4). |
| §7.3 | Business Card block includes "**podcast link**" | Not observed in any shot or GIF. Confirmed links in the signature: Google reviews + Oregon Initial Agency Disclosure Pamphlet. Remove "podcast link." |
| §7.3 | Separator in broker title: "Owner & Principal Broker **—** Ryan Realty LLC" (em-dash) | Shot-15 analysis confirmed: middle-dot **·** separator, not em-dash. Correct to "Owner & Principal Broker **·** Ryan Realty LLC." |
| §7.6 | Third column of Edit Phone Numbers modal: "**Best Number (radio)**" — exactly one must be selected | `[MAJOR CORRECTION]` Third column is **"Bad Number (checkbox)"** — marks a number as invalid/bad. Not a best-number radio. The two columns in the prior spec description ("Label (Mobile/Home/Work/Other) \| Best Number (radio)") should be: "Label (Mobile/Home/Work/Other/Fax) \| Bad Number (checkbox)." |
| §7.10 | "**Web Inquiry Option D1/01/#2**" listed as a separate right-rail section | This is an **automation item name** within the Automations section, not a separate section. The Automations section shows running automations as item rows. The section count is 9 (not 10 plus this). |
| §7.10 | Files section "+" behavior not described | The Files "+" opens a TWO-ITEM DROPDOWN: "Upload File(s)" or "Add Link" — unique among all sidebar "+" buttons. All other "+" buttons open modals or inline forms directly. |
| §7.3 | Compose bar: "BCC" implied as co-visible with CC | BCC is **hidden by default**. It is revealed by clicking an "Add BCC" link at the end of the CC row. Only then does the BCC input row appear. |
| §7.3 | "Marketing Emails" secondary send path not mentioned | A separate "Marketing Emails" button exists in the email compose footer — distinct from the primary Send. Sends as marketing email (mandatory opt-out link; respects unsubscribe status). |
| §7.3 | Activity timeline tabs: "All \| Email \| Text \| Calls \| Notes (inferred set)" | Full set of 8 tabs: All, Emails, Texts, Calls, Notes, Activity, Marketing Emails, Starred Items. "Marketing Emails" tab capped at 75 most-recent entries. |
| §7.10 | Collaborators: "search + add Matt/Paul/Rebecca" | The Collaborators modal **excludes the currently assigned primary agent**. If Matt is the assigned agent, the list shows only Rebecca Peterson + Paul Stevenson, not Matt. |

---

## 7c.15 Design token mapping (FUB → Ryan Realty system)

| FUB element | FUB visual | Ryan Realty equivalent |
|---|---|---|
| Compose tab bar | White bg, bottom-border active indicator, blue/teal active text | `bg-card`, `border-b-2 border-primary` for active, `text-primary` |
| Create Note submit button | Amber/gold fill `#f6ad55`, white text, pill shape | `<Button variant="default">` (primary navy fill) |
| Template chips | Pill shape, light border, sparkle icon prefix | `<Badge variant="outline">` with `✦` text prefix |
| Rich text toolbar | Icon row, ~20px icons, gray stroke | Tiptap / Quill toolbar; icons from `lucide-react`; `text-muted-foreground` |
| CC/BCC fields | Gray label, text input, chip renders | `<Label>` + `<Input>` + custom chip `<Badge>` |
| "Add BCC" link | Gray muted text, underline on hover | `<Button variant="link" size="sm">` |
| Email signature block | Inline HTML with inline styles | Render via `dangerouslySetInnerHTML` in a sandboxed `<div>`; no CSS injection |
| Send Text disabled state | Muted/gray button | `<Button disabled>` — shadcn handles disabled styling |
| Provisioning placeholder | Blue/teal CTA | `<Button variant="default">` (navy) |
| Modal dialogs (Phone, Collaborators) | White panel, centered overlay, backdrop | `<Dialog>` from `@/components/ui/dialog` |
| Right rail column | Light gray `#f7f8fa` | `bg-muted` or `bg-secondary` |
| Section header | 14px medium, dark text, gray icon | `<p className="text-sm font-semibold">` + `text-muted-foreground` icon |
| Section "+" add button | Small blue circle, white "+" | `<Button variant="default" size="icon" className="rounded-full h-6 w-6">` |
| Empty state text | Gray muted, ~13px | `<p className="text-sm text-muted-foreground">` |
| NOT DELIVERED badge | Red fill, white text, pill | `<Badge variant="destructive">` |
| Open count (email) | Green pill | `<Badge className="bg-success text-success-foreground">` |
| Click count (batch email) | Blue pill | `<Badge variant="secondary">` or custom blue `bg-blue-500` |
| Tasks overdue date | Blue link (FUB); red/orange (overdue) | `text-destructive` for overdue; `<Button variant="link">` style for non-overdue |
| Person navigator | "Person N of M ›" header, right rail top | `<div>` with flex row; `<Button variant="ghost" size="icon">` for arrows |
| Keyboard shortcut pills [→] | Pill-styled key indicators | `<kbd className="...">` styled with border-radius + border |
| Files drag-drop target | Dashed border on drag-over | CSS `border-dashed border-2 border-primary` on drag-enter |

---

## 7c.16 Acceptance criteria

The following must all be true for §7c to be considered complete:

**Compose bar:**
- [ ] Four co-equal tabs render: Create Note, Send Email, Text, Log Call.
- [ ] "How it works" link is right-aligned in the same row.
- [ ] Tab switching is instant / optimistic (border updates immediately).
- [ ] Switching to Send Email triggers an async signature fetch (spinner in body while loading).

**Create Note:**
- [ ] Textarea with correct placeholder renders.
- [ ] "Try Team Mentions" link renders below textarea.
- [ ] "Create Note" button is disabled when textarea is empty; enabled when text is entered.
- [ ] Submitting creates a note timeline event and clears the textarea.
- [ ] @mention typeahead fires on "@" character.

**Send Email:**
- [ ] To field pre-populated with contact chip (removable with ×).
- [ ] CC field visible by default; BCC hidden behind "Add BCC" link.
- [ ] Async signature load: spinner visible → signature auto-inserts → template chips appear.
- [ ] All 4+ template chips render with sparkle icon prefix.
- [ ] Rich text toolbar renders with Bold, Italic, Underline, Strikethrough, lists, link, image, video, emoji, HTML insert, and merge-field picker.
- [ ] Merge-field picker lists all documented token categories with correct tokens.
- [ ] Business Card button inserts signature HTML at cursor position.
- [ ] Follow Up (clock icon) opens date/time picker (presets + custom).
- [ ] Marketing Emails secondary send button is visible and labeled distinctly from primary Send.
- [ ] Attachments tab opens file picker.
- [ ] Templates tab opens full template library.
- [ ] "Marketing Emails" path appends opt-out link; blocked for `unsubscribed` contacts.
- [ ] 1:1 Send is NOT blocked for `unsubscribed` contacts.
- [ ] Email tracking (open/click) events appear on timeline with green/blue badge pairs.
- [ ] Bounced emails render email address in orange on timeline.

**Text (SMS):**
- [ ] To field pre-populated with contact's primary number chip; dropdown caret opens phone-selection for multi-number contacts.
- [ ] "+" button opens recipient-search dropdown with correct sections (relationships, USERS).
- [ ] "Lead" and "+ Custom" type pills render at top of dropdown.
- [ ] Body textarea renders; "Send Text" is disabled when empty.
- [ ] Toolbar renders template/image/emoji icons.
- [ ] Clock icon opens 24-hour schedule-send picker.
- [ ] If `brokers.twilio_number IS NULL` or warm-up not complete, show provisioning placeholder with correct heading and CTA.
- [ ] Opt-out phone numbers show in orange on contact sidebar and are blocked from compose.
- [ ] Character counter visible; warning at/near 320 characters.
- [ ] Quiet-hours queuing: texts triggered 9pm–8am (broker's timezone) are queued, not immediately sent.

**Edit Phone Numbers modal:**
- [ ] Three columns: Phone Number (text input), Label (select: Mobile/Home/Work/Other/Fax), Bad Number (checkbox).
- [ ] Each row has a per-row trash icon.
- [ ] "+ Add another phone" link appends an empty row.
- [ ] Cancel closes without saving; "Save Phone Numbers" persists and closes.

**Collaborators modal:**
- [ ] Search input is auto-focused when modal opens.
- [ ] Broker list shows all team members EXCEPT the currently assigned primary agent.
- [ ] Multi-select checkboxes. Pre-checked for existing collaborators.
- [ ] Cancel closes without saving; Save persists and closes.
- [ ] On save, Collaborators section in right rail updates immediately.
- [ ] When a collaborator is promoted to assigned agent, they auto-remove from the collaborator list.

**Right rail:**
- [ ] Sections render in the documented order (1–9) by default; order is per-user drag-and-drop customizable.
- [ ] Each section has a collapse/expand chevron; state is persisted per user.
- [ ] Smart indicators show on collapsed Action Plans (if plan running), Appointments (if upcoming), Tasks (if task assigned to current user).
- [ ] Files "+" opens TWO-OPTION DROPDOWN (Upload File(s) / Add Link) — not a direct modal.
- [ ] Files section is a drag-and-drop target (entire section).
- [ ] Automations section shows running automations with green dot + "Running" status + pause button.
- [ ] Action Plans section shows plan progress ("N of M steps complete") + pause + stop buttons.
- [ ] Activity section shows "Seen X ago" in the collapsed header.
- [ ] Tasks section shows count badge "(N)" in header; ⚡ lightning icon and "+" both present.
- [ ] Person navigator "Person N of M ›" renders at top of right rail; keyboard [→]/[←] also works.
- [ ] Keyboard shortcut hint renders at bottom of right rail.

**Activity timeline:**
- [ ] All 8 tabs render: All, Emails, Texts, Calls, Notes, Activity, Marketing Emails, Starred Items.
- [ ] Marketing Emails tab shows at most 75 entries.
- [ ] Filters dropdown exposes: Change Log, time-range filter (Recent / Last 3/6/12/24 Months), Reassignments.
- [ ] "Scroll to top" floating button appears after scrolling down.
- [ ] System events (list claims, releases) render as compact, avatar-less rows.
- [ ] LEAD ORIGIN note renders as the earliest timeline event for webhook-entered contacts.
- [ ] Email open/click badge pair renders on batch email timeline entries (green opens, blue clicks).

---

*Section written 2026-06-30. Sources: shots 15, 16, 17, 18, 19, 20, 22, 23, 52, 60; GIF people.md; fub-docs/emailing.md; fub-docs/texting.md; fub-docs/people-contacts.md; prior spec §7.3, §7.6, §7.10.*
