# Module: Person Detail — Activity Timeline & Engagement Cards

**Section:** 07b  
**CRM spec version:** 1.0  
**Observation window:** 2026-06-30  
**Scope:** The center column of the person-detail page — the activity timeline, all event card types, filter tabs, action bar, email/text/note compose panels, and the Apply Automation modal. Right-sidebar panels and left-column contact-info fields are covered in sister sections 07a and 07c; this section cross-references them where behavior depends on sidebar state.  
**Style target:** Ryan Realty design system — navy `#102742`, cream `#faf8f4`, Geist (body/UI), Amboqia Boriango (display heads), shadcn/ui `@/components/ui/*` components, design tokens not raw hex.

---

## 1. Page URL & routing

```
/crm/people/:id          →  person detail
/crm/people/27022        →  example observed (Laurie McAdam)
```

The integer ID is the FUB-equivalent primary key; must match `crm_people.id` in the in-house schema. Browser back-button navigates to the All People list at the scroll position the user left it.

---

## 2. Three-column layout

The person-detail page is a full-viewport three-column layout with no scrollable outer shell — each column scrolls independently.

| Column | Width (approx.) | Contents |
|---|---|---|
| Left | ~22% | Contact info fields (name, phone, email, stage, tags, social profile, background) |
| Center | ~50% | Action bar + activity timeline (this section) |
| Right | ~28% | CRM widgets: Action Plans, Activity summary, Tasks, Appointments, Automations, Files, Collaborators, Deals, AgentFire FUB Widget |

The center column is the primary work surface. It renders independently scrollable — the header bar and action bar are sticky at the top of the column; timeline entries scroll beneath them.

---

## 3. Person navigation header (center-column top)

Above the action bar, a hairline-separated navigation strip shows:

```
← [contact name]   Person [current] of [total]   →
```

- Left arrow (`←`): navigate to the previous person in the current filtered/sorted list
- Right arrow (`→`): navigate to the next person
- Counter: e.g. "Person 3 of 47" — reflects the list context the agent navigated from (filtered Smart List, search result, pond view, etc.)
- Keyboard shortcut: `←` / `→` arrow keys while focused in the timeline navigate between people [*inference — documented FUB keyboard nav behavior; confirm at implementation*]
- Counter is hidden when the agent arrived via direct URL (no list context)

---

## 4. Action bar

A sticky horizontal bar below the person navigation header. Contains five controls:

```
[ + Create Note ]  [ ✉ Send Email ]  [ 💬 Text ]  [ 📞 Log Call ]  [ ? How it works ]
```

### 4.1 Create Note

**Trigger:** click "Create Note" pill  
**Behavior:** inline compose panel expands in the timeline. See §10.1.

### 4.2 Send Email

**Trigger:** click "Send Email" pill  
**Behavior:** inline email compose panel expands in the timeline. See §10.2.

### 4.3 Text

**Trigger:** click "Text" pill  
**Normal state:** text pill is outlined/ghost; clicking opens inline SMS compose panel  
**Provisioning state (Twilio number not ready):** the Text pill renders as an active/filled blue pill and clicking shows a provisioning placeholder banner instead of compose. See §4.4.  
**Observed (shot-12):** "Text" button displayed as a filled blue pill — indicating the provisioning-placeholder state for this contact's assigned agent.

### 4.4 Text provisioning placeholder

When the assigned agent does not yet have a provisioned FUB/Twilio number, the Text tab/compose area shows:

```
Your Follow Up Boss number is coming up!
```

[*Exact copy from GIF-frame f12 observation*]

This is a blocking placeholder — no compose input is shown. The agent cannot send a text from this contact until the number is provisioned. The banner should link to settings for number provisioning.

**In-house implementation note:** check `brokers.twilio_number IS NULL` for the assigned agent. If null, render the provisioning placeholder instead of the SMS compose panel.

### 4.5 Log Call

**Trigger:** click "Log Call" pill  
**Behavior:** opens a call-log dialog (duration, outcome, notes). Logged call appears as a `call` event card in the timeline.  
[*Log Call modal spec is in section 07d (Calls); referenced here for completeness.]*

### 4.6 How it works

A secondary link/button — opens FUB's built-in onboarding explainer. In the in-house CRM this can surface a contextual help drawer. Not a primary workflow concern.

### 4.7 Quick Follow Up button (lightning bolt ⚡)

A lightning bolt icon button renders at the right edge of the action bar (or adjacent to the contact name header). Tooltip reads: **"Add Quick Follow Up"** (exact text from shot-12).

**Clicking** opens a dropdown with 8 preset task durations:

```
1 Day
3 Day
1 Week
2 Week
1 Month
3 Month
6 Month
12 Month
+
```

The `+` at the bottom allows creating a custom-duration follow-up task.

**Behavior:** selecting a duration immediately creates a task of type "Follow Up" due N days from today, assigned to the current agent, and adds it to the right sidebar Tasks widget and the agent's task list. A confirmation toast appears; no confirmation modal is shown.

**Style:** dropdown uses `<DropdownMenu>` from `@/components/ui/dropdown-menu`. Lightning bolt icon: Lucide `<Zap>` in `text-primary` navy.

---

## 5. Timeline filter tabs

Directly below the action bar, a horizontally scrollable tab strip filters the timeline. **Official FUB documentation names exactly 8 tabs** (people-contacts.md §Timeline):

| Tab | Label | Icon description | Count badge |
|---|---|---|---|
| 1 | All | (no icon or generic feed icon) | total count |
| 2 | Emails | Envelope icon (blue `#2563EB`) | observed: `3` (shot-09) |
| 3 | Texts | Chat bubble icon | — |
| 4 | Calls | Phone icon | observed: `0` (shot-09) |
| 5 | Notes | Note/document icon | observed: `0` (shot-09) |
| 6 | Activity | Star or activity icon | — |
| 7 | Marketing Emails | (marketing envelope) | — |
| 8 | Starred Items | Star icon | observed: `0` (shot-09) |

**Prior spec error corrected:** the prior low-res spec listed tab names as icon descriptions (e.g., "Automations:1", "Drip:4"). The official FUB docs define the 8 tabs above; "Automations" and "Drip" are not filter tabs — they are right-sidebar widget counts. The `1` and `4` observed were widget badge counts for the Automations panel and Drip/action-plan steps respectively, not timeline filter counts.

**Active tab indicator:** bottom border highlight in `text-primary` navy. Active tab label becomes bold.

**Count badges:** appear on tabs with non-zero counts. Rendered as small pill `<Badge variant="secondary">` with tabular numeral.

**Marketing Emails tab — hard limit (documented):** shows only the **75 most-recent** marketing/automation emails. If a contact has received more than 75 action plan emails, entries beyond the 75 most recent are not accessible in this tab. The All tab is also capped at 75 for marketing emails when counting them. [*Official FUB docs — people-contacts.md*]

**Style:** tab strip uses `<Tabs>` from `@/components/ui/tabs`. Tab labels in Geist 500, 14px. Count badges in Geist 400.

---

## 6. Timeline — general structure

The timeline is a vertically stacked feed of event cards in **reverse chronological order** (newest at top). Each event card has:

- A **type icon** (color-coded circle or square) at the left margin
- A **date/time stamp** at the top right of the card
- A **card body** with type-specific content
- Optional **action controls** (Reply, Forward, star, "...", etc.) visible on hover

Events are grouped by calendar date under a **date separator** (e.g., "Jun 15" full-width hairline with the date label centered). The separator is sticky until the next date group scrolls past.

### 6.1 Icon color mapping (observed, shot-11)

| Event type | Icon color |
|---|---|
| Outbound email (manual) | Blue `#2563EB` |
| Automation email | Blue `#2563EB` (same) |
| System note (LEAD ORIGIN, stage change) | Amber `#D97706` |
| Form submission (Seller Inquiry) | Red-orange `#EA580C` |
| Web activity | [*not observed — infer amber or teal per FUB convention*] |
| Call (logged) | Green [*inference*] |
| Text | Purple [*inference*] |
| Note (manual) | Navy or grey [*inference*] |

**In-house style:** map icon colors to design tokens: blue → `text-info` or a mapped accent; amber → `text-warning`; red-orange → `text-destructive`. Confirm token mapping with design system SKILL.md.

---

## 7. Event card types — exhaustive specification

### 7.1 Automation email card ("archived" state)

A drip email sent by an action plan step.

**Card header:**
```
[blue envelope icon]  [Subject line]                          Jun 12  ·  Archived
                      To: [contact email]
```

**"Archived" pill:** amber/grey pill label next to the date. Indicates the email step completed and the record is closed. FUB terminology — "Archived" means the automation step executed; the message is read-only.

**Body (collapsed by default):** shows first ~2 lines of the email body as a preview excerpt.

**Expand/collapse:** clicking anywhere on the card body expands to show the full rendered HTML email body. The expand animation slides the body into view.

**Sub-elements (expanded):**
- Full rendered HTML email body (including agent signature block if present — see §7.6 for signature card detail)
- **Opens badge** (if tracking pixel fired): e.g. `2 opens` — teal/green pill. Tooltip: `[ContactName] (N)  Xd / Email first opened Yd` where N = total opens, X = days since last open, Y = days since first open (exact format from shot-11: "Laurie McAdam (2) 14d / Email first opened 17d").
- **Click tracking:** [*not directly observed; infer click-count badge parallel to opens badge*]
- **Tracking URL mechanism:** every link in an automation email is wrapped with a pixel-tracking redirect. The URL contains `?_pxl=[base64token]`. Each GET to this URL increments `open_count` for this person's email record. [*Documented behavior — people-contacts.md*]
- **Unsubscribe link:** automatically appended to every action plan email. Cannot be removed. [*Documented — action-plans.md §11*]
- **"Archived" read-only state:** no Reply/Forward on automation email cards — they are system-sent, not agent-sent

**Card controls (visible on hover):**
- Star icon (☆ / ★): toggle Starred state; adds to Starred Items tab
- No "..." menu on archived automation emails [*observed — "..." appeared only on manual email cards in shot-14*]

**Observed examples (Laurie McAdam, shot-09, shot-11, shot-21):**
- Jun 12: "We got your home value request — 62285 Deer Trail Rd..." — 2 opens
- Jun 12 (second): "[action plan step 2 — subject not fully legible in shots]"
- Jun 13 earlier: "[action plan step — archived]"
- Jun 15: "We have your home value request, Laurie" — partial body visible (shot-14)

### 7.2 Manual (agent-sent) email card

An email composed and sent by the agent directly from the person's profile.

**Card header:**
```
[blue envelope icon]  [Subject line]                          Jun 13  ·  Sent
                      To: [contact email]    BCC: ryan.realty@followupboss.me
```

**BCC address:** `ryan.realty@followupboss.me` — the account-level BCC logging address. Any external email BCC'd to this address is automatically filed into the matching contact's timeline. [*Observed verbatim in shot-10*]

**Body (collapsed by default):** shows preview excerpt.

**Expand — observed full body (shot-10, Jun 13 manual email from Matt to Laurie):**

> Hi Laurie,
>
> Thank you for the details on your home. They made a real difference in putting together a thoughtful, accurate analysis.
>
> I've attached a Comparative Market Analysis (CMA) for 62285 Deer Trail Rd. It reflects what's actually selling in the area right now — comparable homes, active competition, and where your property fits in the current market.
>
> A few highlights from the analysis:
>
> [additional body paragraphs not fully captured in shot]

**Attachment chip (observed, shot-10):**
```
📎 Ryan-Realty-CMA-62285-Deer-Trail-Rd.pdf  (10 MB)
```

File chip renders below the body. Clicking downloads the PDF. File size displayed in parentheses. File attachment limits: max 100 MB per file, unlimited quantity, blocked types: `.exe`, `.vb`, `.bat`, `.cmd`. PDFs download automatically (no inline preview). Leaving the page during upload cancels it. [*Official docs — people-contacts.md*]

**Sub-elements:**
- Opens badge (if pixel tracked): same format as §7.1
- Full rendered body on expand
- Attachment chip row (if attachments present)
- BCC logging address line

**Card controls (visible on hover):**
- Star icon (☆ / ★)
- **"..." context menu** — three-dot icon in top-right of card. Click opens a popup with exactly 3 items (observed shot-14):
  1. **Forward** — opens email compose panel pre-filled with forwarded content
  2. **Block [email address]** — e.g. "Block lgmcadam@gmail.com" — rendered in red destructive color. Adds the address to a block list; suppresses future emails from this address. Requires confirmation.
  3. **Share this email with Follow Up Boss staff** — submits the email content to FUB support (for spam review, deliverability troubleshooting, etc.)

**Prior spec error corrected:** prior spec did not include "Share this email with Follow Up Boss staff" as a context menu item. Shot-14 confirms it is the third item.

**Reply / Reply-All / Forward controls:**
- "Reply" link renders below the email body in expanded state
- "Reply All" link renders adjacent to Reply (if multiple recipients)
- "Forward" link renders adjacent — also accessible from "..." menu
- Clicking any opens the email compose panel pre-populated accordingly

### 7.3 Inbound email card

An email received from the contact into the agent's inbox (auto-filed via pixel tracking or BCC match).

**Card header:**
```
[blue envelope icon]  RE: [Subject line]                      Jun 14  ·  Received
                      From: [contact email]
```

**Sub-elements:** same expand/collapse as outbound. Read-only body rendering.

**Card controls:** Reply (opens compose pre-populated with Re: subject and contact as To), Forward, star, "..." menu.

### 7.4 LEAD ORIGIN system card

A system-generated card created automatically when the contact first enters the CRM. Rendered at the bottom of the timeline (oldest entry). Uses an amber system-note icon.

**Card header:**
```
[amber ⚙ or info icon]  Lead Origin                          Jun 12
```

**Verbatim key-value block (transcribed from shot-11, Laurie McAdam):**

```
Source          Ryan Realty Website
Page            Sell
Campaign        —
UTM Source      —
UTM Medium      —
UTM Campaign    —
UTM Content     —
UTM Term        —
Wants           Sell
Tier            A
Assigned        Matt Ryan
```

**Field-level notes:**
- `Source`: the named lead source (matches the Lead Flow source name configured in admin)
- `Page`: the URL slug or page name where the form was submitted ("Sell" = the seller landing page)
- `Campaign` / UTM fields: populated from URL params on the referral URL; em-dash (`—`) when absent (note: em-dash here is the data-placeholder use of em-dash, which is allowed per CLAUDE.md brand rules)
- `Wants`: intent derived from the form type ("Sell", "Buy", "Both", etc.)
- `Tier`: initial lead tier assigned at entry (A / B / C)
- `Assigned`: the agent the lead was routed to (resolved from Lead Flow rules)

**Card is non-expandable and non-editable** — it is a permanent immutable record of how the lead entered the system.

**"view map" link:** if the lead submitted a property address, a blue "view map" link appears below the address field. Clicking opens the address in Google Maps. (Observed in shot-11 on the Seller Inquiry card — confirmed blue text link.)

**In-house schema:** `crm_timeline_events` row with `event_type = 'lead_origin'`, `payload JSONB` containing source, page, wants, tier, assigned_agent_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referral_url. Created once at person creation time; immutable after creation.

**Prior spec error corrected:** prior spec had [illegible] placeholders for multiple field values. All fields now transcribed verbatim from shot-11.

### 7.5 Seller Inquiry form submission card

A system card created when the contact submitted a seller inquiry form. Distinct from the LEAD ORIGIN card — both appear when the same event generates both a lead and a form submission.

**Card header:**
```
[red-orange 📋 icon]  Seller Inquiry                         Jun 12
```

**Verbatim key-value block (transcribed from shot-11):**

```
Address         62285 Deer Trail Rd, Bend, OR 97703
                [view map]
Timeline        ASAP
Tier            A
                Step 2 of 7 completed
```

**Field-level notes:**
- `Address`: full property address as entered by the contact in the form
- `[view map]`: inline blue link below the address, opens Google Maps for the address
- `Timeline`: seller's stated timeline to sell (from form dropdown: "ASAP", "3–6 months", "6–12 months", "Just exploring", etc.)
- `Tier`: AI-assigned or rule-assigned lead tier
- `Step N of M completed`: the onboarding/seller-funnel step completion indicator. "Step 2 of 7 completed" was observed. This maps to the seller funnel checklist steps — e.g., a 7-step funnel where step 2 = CMA requested, step 3 = CMA delivered, etc.

**"Getting Started" progress bar cross-reference (shot-10):** the right sidebar showed "2 of 7 steps completed" as a progress bar. This is the same step count, mirrored. The two surfaces must stay in sync.

**In-house schema:** `crm_timeline_events` row with `event_type = 'form_submission'`, `form_type = 'seller_inquiry'`, `payload JSONB` containing address, city, state, zip, timeline_enum, tier, funnel_steps_total, funnel_steps_completed, lat, lng.

**Prior spec error corrected:** prior spec had [illegible] placeholders for multiple seller inquiry fields. All fields now transcribed verbatim from shot-11.

### 7.6 Agent signature card (inline in email body)

When an automation email includes the agent's full email signature, the signature renders as an inline block within the expanded email body card. Observed in shot-21 (Jun 12 email, Matt Ryan's signature).

**Signature card contents (observed, Matt Ryan — shot-21):**
- Headshot photo (circular or square crop, ~60×60 px)
- Agent full name: "Matt Ryan"
- Title/role: [*"Principal Broker" or similar — exact text partially legible*]
- Phone: `541.213.6706` (dotted format per brand voice)
- Email: `matt@ryan-realty.com`
- Website: `ryan-realty.com`
- Brief bio/tagline [*2–3 sentences, not fully legible*]
- Brokerage logo
- Disclaimer line including: "Oregon Initial Agency Disclosure Pamphlet" (hyperlinked)
- "Read our Google reviews" (hyperlinked) — links to GBP review page

**Rendering:** the signature renders as a visually distinct block (lighter background or hairline border) at the bottom of the email body. It is part of the email's HTML content, not a separate UI component.

**In-house note:** the email composition system must inject the sending agent's signature at the bottom of every outbound email. The signature is assembled from `brokers` table: `headshot_url`, `full_name`, `title`, `phone`, `email`, `website`, and the linked documents table for the Oregon disclosure pamphlet URL and Google review URL.

### 7.7 Web activity card

Triggered when the FUB Pixel fires on a contact's return visit.

**Card template:**
```
[amber/teal activity icon]  Lead returned to website. Follow up now.
                            [URL of page visited]                    [timestamp]
```

**Sub-elements:**
- Destination URL as a clickable link (or plain text if not a clickable resource)
- Timestamp with time (not just date — visit time is significant for follow-up timing)
- No expand/collapse — the full content is visible in the card

**Follow-up prompt:** the "Follow up now." text is styled as an actionable call-out (bold or primary color) rather than descriptive metadata. In the in-house CRM this can render as a `<Button variant="link">` or `<Badge variant="accent">` that opens the compose panel.

**In-house schema:** `crm_timeline_events` row with `event_type = 'web_activity'`, `payload` containing `page_url`, `page_title`, `visit_at`, `session_id`. Requires FUB Pixel equivalent (`rr_pixel`) installed on ryan-realty.com.

### 7.8 Note card (manual)

Created when an agent clicks "Create Note" in the action bar.

**Card header:**
```
[grey/navy note icon]  Note by [Agent Name]                   [date]
```

**Body:** free-text content, no HTML rendering (plain text with line breaks). No expand/collapse — the full note body is visible.

**Create Note compose panel (§10.1):** the "Create Note" button in the panel is **disabled (greyed out)** when the text area is empty. [*Observed in GIF frame f08 — "Create Note" button shows as disabled with empty textarea.*]

**Sub-elements:**
- Agent avatar + name attribution
- Timestamp
- Star icon

**Card controls:** Edit (pencil) on hover — opens inline edit of the note text. Delete (trash) on hover with confirmation. Star.

**Notification behavior:** notes created manually DO notify the assigned agent, lenders, ponds, and collaborators via email and in-app bell. [*Documented — action-plans.md §4d.* This differs from notes added by action plan steps, which also notify — but tasks added by action plan steps do NOT notify.]

### 7.9 Call card (logged)

**Card header:**
```
[green phone icon]  Call logged by [Agent Name]               [date]
                    Duration: [X min Y sec] · Outcome: [outcome]
```

**Sub-elements:**
- Duration
- Outcome enum: Answered / Left Voicemail / No Answer / Do Not Call [*standard FUB call outcomes*]
- Notes field (agent's call notes)
- Star

**Auto-pause trigger:** if a call logged via the in-house calling system exceeds 2.5 minutes duration, any running action plan enrollments for this contact must be auto-paused. [*Documented — action-plans.md §3, "Auto-pause on lead response". Manual call logs do NOT trigger auto-pause.*]

### 7.10 Text card (inbound and outbound)

**Outbound:**
```
[purple chat icon]  Text to [contact first name]              [time]
                    [message body]
```

**Inbound:**
```
[purple chat icon]  Text from [contact first name]            [time]
                    [message body]
```

**After-hours queued text:** if a text is queued for after-hours delivery, a pending state card appears:
```
[grey chat icon]  Queued text — sends at 8:00 AM             [timestamp]
                  [message preview]
                  [Cancel] link
```

The Cancel link cancels the queued text before it sends. [*Documented — action-plans.md §13*]

**Opt-out:** if the contact texts STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT, a system card appears:
```
[red icon]  [contact name] has opted out of text messages.   [timestamp]
```
Phone number displays in orange on the left-column contact info card. [*Documented*]

### 7.11 Voicemail card

**Card header:**
```
[phone+voicemail icon]  Voicemail left by [Agent Name]        [date]
```

**Sub-elements:**
- Audio player (inline `<audio>` element or custom player component) for voicemail recording
- Duration
- Transcription (if available via Twilio's transcription service)
- Star

### 7.12 Stage change card

**Card template:**
```
[amber gear/stage icon]  Stage changed from [Old Stage] to [New Stage]    [date]
                         by [Agent Name]
```

Minimal card — no expand. Non-editable. Appears in the Change Log as well.

**Change Log access:** the Change Log is accessed via Timeline > filter/settings > "Change Log" — it is append-only, permanent, and does not scroll with the main timeline. [*Documented — people-contacts.md.* The Change Log currently does NOT track relationship changes.]*

### 7.13 Action plan step card (in-timeline representation)

When an action plan step executes (email sent, task created, etc.) the result appears as the appropriate event card (email card, task card, etc.) — not a separate "action plan step" card type. The connection to the action plan is shown via a small pill label on the email card: **"Archived"** (automation emails) or the plan name in muted text.

The right-sidebar Automations widget (§9.5) shows the plan's running status separately from the timeline entries.

---

## 8. Timeline event card shared elements

All card types share these elements:

### 8.1 Star toggle

Every card has a star icon (☆ unfilled = not starred, ★ filled = starred) in the top-right corner. Toggling adds/removes the event from the "Starred Items" timeline tab. Star state persists in `crm_timeline_events.starred BOOLEAN`.

### 8.2 Date + time display

Cards show a relative or absolute date in the top-right. Format rules:
- Same day: `Today · 2:34 PM`
- Yesterday: `Yesterday · 9:12 AM`
- Within 7 days: `Wed · 9:12 AM`
- Older: `Jun 12` (month + day only, current year implied; prior year shows `Jun 12, 2025`)
- Full timestamp available on hover: tooltip with `June 12, 2026 at 6:39 PM` (observed format from shot-21 right-sidebar: "Jun 12th 2026 at 6:39 PM")

Use Geist tabular numerals for times. No AM/PM caps required — match local convention.

### 8.3 Opens badge (email tracking)

On email cards that have been opened, a teal/green pill badge renders in the card header row:

```
[2 opens]
```

**Hover tooltip exact format (shot-11):**
```
Laurie McAdam (2) 14d / Email first opened 17d
```

- `(2)` = total open count
- `14d` = days since most recent open
- `17d` = days since first open (the pixel first fired)

**Tracking mechanism:** each outbound marketing/automation email contains a 1×1 pixel `<img>` with a unique `?_pxl=[base64token]` URL. Each GET to that URL increments `open_count` for the corresponding `crm_email_events` row. One-pixel loads from image pre-fetching (Apple MPP, Gmail proxy) can inflate open counts — document this known limitation in the in-house implementation.

**In-house schema:** `crm_email_events.open_count INTEGER`, `crm_email_events.first_opened_at TIMESTAMPTZ`, `crm_email_events.last_opened_at TIMESTAMPTZ`, `crm_email_events.pixel_token VARCHAR UNIQUE`.

### 8.4 Scroll-to-top FAB

A floating action button appears when the user has scrolled more than ~300px down in the timeline:

```
[teal pill]  ↑  Scroll to top
```

**Exact label (shot-14):** "Scroll to top" with a chevron-up icon, rendered as a rounded pill button in teal (~`#1aa3c9`).

**In-house style:** map teal to the nearest design-system accent token. The pill should use `<Button variant="secondary">` or a custom `bg-accent` treatment. Renders at the bottom of the center column viewport, centered.

---

## 9. Right sidebar — widget specifications

[*This section is referenced by the timeline section for cross-column behaviors. Full right-sidebar spec is in section 07c; key timeline-crossing elements are documented here.*]

### 9.1 Action Plans widget

Shows action plans currently running (or recently completed) on this contact.

**Smart collapse indicator:** if an action plan is running, the widget header shows an active badge or count. [*Documented — people-contacts.md.*]

**Add plan:** blue `+` icon in the widget header → opens Apply Automation modal (§11) — [*inference: the same modal shown for Automations; action plans and automations share one apply flow in FUB after 2.0 migration. See §11.*]

**Running plan row (observed, Laurie McAdam, shot-09):**
```
Web Inquiry Option 01            [Running]
```

- Plan name in Geist 500
- Status pill: `Running` (green), `Paused` (amber), `Completed` (grey), `Stopped/Failed` (red)
- Pause / Resume button (icon or text) on hover
- Step progress indicator: "Step 3 of 8" or "3/8" [*not directly observed — infer from documented behavior*]

**Action plan status enum:** `running | paused | completed | stopped`

**Cannot delete from profile:** action plans cannot be deleted from an individual contact profile. To stop a plan you must pause it, or delete the action plan globally from admin. [*Documented — action-plans.md §8*]

**In-house schema:** `action_plan_enrollments` table with `person_id`, `action_plan_id`, `status`, `current_step_index`, `started_at`, `paused_at`, `completed_at`, `started_by`.

### 9.2 Activity summary widget

Counts of communications sent/received — not a timeline tab but a summary panel:

```
Emails sent: 4
Emails received: 1
Texts sent: 0
Calls made: 0
```

[*Numbers inferred from timeline observation; not all visible in single shot*]

### 9.3 Tasks widget

Shows tasks assigned to the current user for this contact.

**Smart collapse indicator:** shows badge if a task is assigned to the current agent. [*Documented — people-contacts.md*]

**Overdue task rendering (observed, shot-09):** task due date renders in **orange** when past due. The observed task showed an orange date with overdue styling.

**Task row:**
```
[checkbox]  [task description]  [due date — orange if overdue]
```

Checking the checkbox marks the task complete and removes it from the active list.

### 9.4 Appointments widget

**Smart collapse indicator:** shows badge for upcoming appointments. [*Documented — people-contacts.md*]

### 9.5 Automations widget

Shows automation enrollments on this contact. Separate from action plans in the FUB v1 system; merges in 2.0.

**Automation row (observed, shot-09):**
```
Web Inquiry Option 01    [Running]
```

**Status enum:** `Running | Paused | Completed | Stopped` — same as action plans.

### 9.6 Files widget

Attachments uploaded to or received in this contact's timeline. Accessible as a flat list here.

**Limits:** 100 MB max per file, unlimited quantity, blocked types: `.exe`, `.vb`, `.bat`, `.cmd`. [*Documented — people-contacts.md*]

**PDF behavior:** clicking a PDF file chip downloads immediately (no inline preview). Leaving the page during upload cancels the upload in progress.

### 9.7 Collaborators widget

Shows team members added as collaborators on this contact.

**Permissions of collaborators:** collaborators have full agent-level contact permissions but do NOT receive automatic notifications — only if the lead contacts them directly. [*Documented — people-contacts.md*]

**Auto-removal:** if a collaborator is later promoted to the assigned agent for this contact, they are automatically removed from the collaborator list. [*Documented*]

**Phone limit:** the contact can have up to **25 phone numbers** total, shared across the contact and all linked relationships. [*Documented — people-contacts.md. This is the #1 hard limit that cross-cuts collaborator and relationship management.*]

### 9.8 Sidebar drag-reorder

All right-sidebar widgets are **drag-to-reorder per user** (user-specific ordering, not global). [*Documented — people-contacts.md*]

**In-house schema:** `user_preferences.sidebar_widget_order JSONB` per user per view type.

---

## 10. Compose panels

### 10.1 Create Note panel

**Trigger:** "Create Note" pill in the action bar.

**Panel renders inline** at the top of the timeline (below the filter tabs), pushing timeline entries down.

**Elements:**
- Multi-line textarea (`<Textarea>` from `@/components/ui/textarea`)
- "Create Note" submit button — **disabled when textarea is empty** [*confirmed GIF f08*]
- Cancel link

**Notification:** notes created here DO trigger agent/lender/pond/collaborator notifications. [*Documented — action-plans.md §4d*]

### 10.2 Email compose panel

**Trigger:** "Send Email" pill in the action bar.

**Panel renders inline** at the top of the timeline.

**Elements (in render order):**
1. **To:** field — pre-populated with contact's primary email address. Geist 14px label + editable `<Input>` that supports multiple addresses (comma-separated or chip-style).
2. **Subject:** text input
3. **Body:** rich-text compose area (HTML email)
4. **Template chips row** — quick-insert buttons: `+ Introduction`, `+ Follow Up`, `+ Still Buying`, `+ Nurture` [*exact labels from GIF frame f11*]. Clicking a chip inserts the template's subject and body into the compose area.
5. **Signature block** — loads asynchronously after the compose panel opens:
   - **Loading state (GIF frame f10):** a spinner/skeleton renders in the signature area while the agent's email signature loads
   - **Loaded state (GIF frame f11):** full signature block renders (agent name, title, phone, photo, brokerage logo, disclaimer links)
   - The async load is triggered by fetching the agent's configured email signature from the integrations layer (typically the connected Gmail/SMTP account's signature)
6. **Attachments:** file upload area (100 MB max per file, blocked types as §9.6)
7. **Send** button (`<Button variant="default">`) — enabled when To and Subject are populated
8. **BCC logging address:** automatically BCC'd to `[account]@followupboss.me` (or in-house equivalent). Do not surface this as a user-editable field — it is a system BCC injected at send time.

**In-house implementation note:** the signature async-load should fetch from `brokers.email_signature_html` (or compose it from brokers table fields). Render a `<Skeleton>` component from `@/components/ui/skeleton` during load; replace with the rendered signature HTML on success.

### 10.3 Text compose panel

**Trigger:** "Text" pill in the action bar (when Twilio number is provisioned).

**Elements:**
- **To:** pre-populated with contact's primary phone number
- Message textarea (300-character limit per FUB Lead Flow text spec; apply same limit to 1:1 texts)
- Character counter (`X / 300`)
- Send button

**After-hours queuing:** if current time is between 9 PM and 8 AM in the assigned agent's timezone, show a banner: "This message will be queued and sent at 8:00 AM [agent timezone]." [*Documented — action-plans.md §13*]

**A2P 10DLC compliance:** texts only send to opted-in contacts. If `sms_opt_out = true` on the phone number, disable the compose panel and show: "This contact has opted out of text messages."

---

## 11. Apply Automation modal

**Trigger:** clicking the `+` icon in the Automations widget (right sidebar) OR selecting "Apply automation" from any relevant action menu.

**Observed in:** shot-13 (full modal screenshot).

### 11.1 Modal anatomy

**Overlay:** full-screen semi-transparent dark scrim. Click scrim to dismiss (same as "Cancel").

**Modal container:** centered dialog, ~560 px wide, white/cream background, rounded `xl` corners. Uses `<Dialog>` from `@/components/ui/dialog`.

**Header:**
```
Apply Automation                                          [×]
```

- Title: "Apply Automation" — Geist 600, ~18px
- Close button: `×` in top-right corner. Same as Cancel.

**Search field (below header):**
```
[🔍]  Search automations...
```

- Placeholder text: "Search automations..." [*exact text, shot-13*]
- Live-filters the radio list as the agent types
- `<Input>` from `@/components/ui/input` with leading search icon

**Automation list (scrollable):**

Single-select radio list. Each row:
```
○  [Automation Name]
```

- Radio button (`<RadioGroup>` from `@/components/ui/` or similar) — only one can be selected at a time
- Automation name in Geist 400, 14px
- Row height ~40px; hover background `bg-secondary`

**Exact automation names visible in shot-13 (8 rows, scrollable list — these are the first 8 visible):**

1. Seller Nurture Long Term
2. Seller Sequence Short Term
3. Stale Lead Re-engagement
4. Web Inquiry Option 01
5. Web Inquiry Option 02
6. Web Inquiry Option 03
7. Welcome Sequence Buyers
8. Welcome Sequence Sellers

[*These 8 are the automations in Ryan Realty's FUB account as of the observation date. The in-house CRM should populate this list from the `automations` or `action_plans` table filtered by `status = 'active'` and `manual_trigger = true` (for 2.0) or all active plans (for v1). The specific names above are Ryan Realty's plan names, not FUB defaults.]*

**Prior spec error corrected:** prior spec had an incomplete automation list with several [illegible] entries. All 8 visible names now transcribed verbatim from shot-13.

**Footer (always visible, not scrollable):**
```
[Cancel]  [Apply]
```

- "Cancel" — ghost/outline button (`<Button variant="ghost">`) — dismisses the modal with no action
- "Apply" — filled button (FUB uses teal `~#1aa3c9`; **in-house style:** use `<Button variant="default">` in `bg-primary` navy, `text-primary-foreground` cream) — disabled until one automation is selected; enabled on selection

### 11.2 Apply behavior

1. Agent selects one automation from the radio list
2. "Apply" button becomes enabled
3. Agent clicks "Apply"
4. Modal closes
5. API call: `POST /v1/actionPlansPeople` with `{ personId: [id], actionPlanId: [selectedId] }` — or in-house equivalent: `INSERT INTO action_plan_enrollments (person_id, action_plan_id, status, started_by, started_at)`
6. Timeline shows a new system card: "Action plan [Name] started by [Agent]" [*inferred — not directly observed post-apply; confirm at implementation*]
7. Automations widget in right sidebar updates to show the new enrollment with status "Running"
8. Day-0 email step (if present in the plan) sends immediately upon enrollment [*Documented — action-plans.md §5*]

### 11.3 Keyboard behaviors

- `Escape` → dismiss modal (same as Cancel)
- `↑` / `↓` arrows → navigate the radio list
- `Enter` on a selected row → equivalent to Apply
- Type immediately in the modal → focuses the search field and filters the list

### 11.4 Empty state

When no automations match the search query:

```
No automations found.
```

Centered muted text in the list area. "Apply" button remains disabled.

When the account has no automations configured at all, the `+` icon in the sidebar should be hidden or the modal should show an admin-only message.

---

## 12. Social profile section (left column, referenced)

While not part of the timeline itself, the social profile section appears in the left column and connects to lead-origin data.

**Observed (shot-10, Laurie McAdam):**
- LinkedIn link
- Google link
- Full name: Laurie McAdam (enriched / confirmed)
- Age: 76
- Gender: Female
- Location: Bend

**Enrichment note:** Social enrichment does **not** run on imported contacts — it only runs on leads that entered FUB organically (form submissions, API, etc.). [*Documented — people-contacts.md*]

**"Delete person" link:** a red destructive link appears at the bottom of the left column (observed shot-10). This permanently deletes the contact record. Should be guarded with a confirmation dialog using `<Dialog>` from `@/components/ui/dialog` with destructive styling.

---

## 13. Last-lead metadata (right sidebar top)

At the very top of the right sidebar, above all widgets, a metadata strip shows:

```
[property address]
[formatted date+time]
Assigned: [Agent Name]
```

**Observed (shot-21, Laurie McAdam):**
```
62285 Deer Trail Rd, Bend, OR 97703
Jun 12th 2026 at 6:39 PM
Assigned: Matt Ryan
```

This is the "last lead" summary — the most recent inquiry details. If the contact has submitted multiple inquiries, this reflects the most recent one.

---

## 14. "Getting Started" progress bar

Observed in shot-10 in the left column area: **"2 of 7 steps completed"** — a seller-funnel progress bar showing how far the contact has progressed through the configured onboarding/seller funnel.

This mirrors the `Step 2 of 7 completed` indicator on the Seller Inquiry timeline card (§7.5). Both must stay synchronized — update one, update the other.

**In-house schema:** `crm_people.funnel_steps_completed INTEGER`, `crm_people.funnel_steps_total INTEGER`. The progress bar and the card pill both read from these fields.

---

## 15. Data model — fields touched by this module

The center column reads from and writes to these tables. This is not a complete schema — it is the access pattern for the timeline module specifically.

```sql
-- Event feed
crm_timeline_events (
  id UUID PRIMARY KEY,
  person_id BIGINT REFERENCES crm_people(id),
  event_type VARCHAR,            -- 'email_outbound' | 'email_inbound' | 'email_automation'
                                 -- 'text_outbound' | 'text_inbound' | 'call' | 'voicemail'
                                 -- 'note' | 'web_activity' | 'stage_change'
                                 -- 'lead_origin' | 'form_submission' | 'action_plan_start'
                                 -- 'action_plan_pause' | 'action_plan_complete'
  agent_id BIGINT REFERENCES brokers(id),
  occurred_at TIMESTAMPTZ NOT NULL,
  starred BOOLEAN DEFAULT FALSE,
  payload JSONB NOT NULL,        -- type-specific content
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email tracking
crm_email_events (
  id UUID PRIMARY KEY,
  timeline_event_id UUID REFERENCES crm_timeline_events(id),
  pixel_token VARCHAR UNIQUE,    -- base64 token for open-tracking GET
  open_count INTEGER DEFAULT 0,
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  click_count INTEGER DEFAULT 0,
  bcc_logged BOOLEAN DEFAULT FALSE
);

-- Action plan enrollments
action_plan_enrollments (
  id UUID PRIMARY KEY,
  person_id BIGINT REFERENCES crm_people(id),
  action_plan_id BIGINT REFERENCES action_plans(id),
  status VARCHAR,                -- 'running' | 'paused' | 'completed' | 'stopped' | 'failed'
  current_step_index INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  started_by VARCHAR            -- 'agent:{id}' | 'lead_flow' | 'automation:{id}'
);

-- Per-step execution log
action_plan_step_log (
  id UUID PRIMARY KEY,
  enrollment_id UUID REFERENCES action_plan_enrollments(id),
  step_id UUID REFERENCES action_plan_steps(id),
  scheduled_for TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  status VARCHAR,               -- 'sent' | 'failed' | 'queued' | 'skipped' | 'already_sent_today'
  failure_reason VARCHAR
);

-- Phone opt-out tracking
crm_phone_numbers (
  id UUID PRIMARY KEY,
  person_id BIGINT,
  phone_number VARCHAR,
  sms_opt_out BOOLEAN DEFAULT FALSE,
  sms_opted_out_at TIMESTAMPTZ,
  do_not_call BOOLEAN DEFAULT FALSE
  -- max 25 per person across contact + all relationships [documented hard limit]
);

-- User sidebar preferences
user_preferences (
  user_id BIGINT REFERENCES brokers(id) PRIMARY KEY,
  sidebar_widget_order JSONB    -- ordered list of widget keys per view
);
```

---

## 16. Acceptance criteria

1. **Timeline renders in reverse-chronological order** with date-group separators. Newest event appears at the top.

2. **All 8 filter tabs render** with exact names: All, Emails, Texts, Calls, Notes, Activity, Marketing Emails, Starred Items. Count badges appear for non-zero counts.

3. **Marketing Emails tab is capped at 75 most-recent entries.** If the contact has received more than 75 action plan emails, entries beyond 75 are not rendered in this tab. A static note reads: "Showing 75 most recent marketing emails."

4. **LEAD ORIGIN card appears for every contact** at the bottom of the timeline (oldest event). All 10 fields render verbatim: Source, Page, Campaign, UTM Source, UTM Medium, UTM Campaign, UTM Content, UTM Term, Wants, Tier, Assigned. Em-dash (`—`) renders for absent UTM fields.

5. **Seller Inquiry card renders** with Address (including "view map" blue link), Timeline, Tier, and "Step N of M completed" pill. Step count stays synchronized with the left-column "Getting Started" progress bar.

6. **Opens badge** renders on email cards with `open_count > 0`. Hover tooltip shows `[Name] (N) Xd / Email first opened Yd` format.

7. **"..." context menu on manual email cards** shows exactly 3 items: Forward, Block [email] (red), Share this email with Follow Up Boss staff. Block requires confirmation dialog. Share submits to support API.

8. **Apply Automation modal** renders with:
   - Title "Apply Automation" + `×` close
   - Live-search field "Search automations..."
   - Scrollable single-select radio list of active automations
   - Cancel (ghost) + Apply (primary, disabled until selection) footer
   - Apply triggers enrollment creation and immediately starts day-0 email step

9. **Quick Follow Up dropdown** renders 8 preset durations: 1 Day, 3 Day, 1 Week, 2 Week, 1 Month, 3 Month, 6 Month, 12 Month, plus `+`. Selecting one creates a "Follow Up" task due in that interval.

10. **Email compose panel** async-loads the agent's signature (shows `<Skeleton>` during load, replaces with rendered signature on completion). Template chips (+ Introduction, + Follow Up, + Still Buying, + Nurture) appear after load. "Send" button is disabled until To and Subject are both populated.

11. **Create Note compose panel** has "Create Note" button **disabled** when textarea is empty. Button enables on first character entered.

12. **Text provisioning placeholder** renders the banner "Your Follow Up Boss number is coming up!" instead of the compose panel when the assigned agent has no provisioned Twilio number.

13. **Star toggle** on every event card persists to `crm_timeline_events.starred`. Starred events appear in the "Starred Items" tab.

14. **Scroll-to-top FAB** (rounded pill, "↑ Scroll to top") appears after 300px scroll and returns the timeline to the top of the first event.

15. **Action plan auto-pause rule:** when a call logged via the in-house calling system has a duration > 2.5 minutes, all `action_plan_enrollments` with `status = 'running'` for this `person_id` must be set to `status = 'paused'`. Manually logged calls (via Log Call form, not in-system dialer) do NOT trigger auto-pause.

16. **25-phone-number hard limit** enforced across the contact and all linked relationships. UI shows an error state when attempting to add a 26th phone number.

17. **SMS opt-out enforcement:** when `sms_opt_out = true` on any phone number, the Text compose panel is disabled for that number with the message "This contact has opted out of text messages." STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT inbound texts set `sms_opt_out = true` automatically; START/YES/UNSTOP set `sms_opt_out = false`.

18. **After-hours text queuing:** outbound texts created between 9 PM and 8 AM (assigned agent's local timezone) are queued — a `status = 'queued'` card renders in the timeline with a cancel link. Queued texts auto-send at 8 AM or auto-cancel if any contact interaction occurs before 8 AM.

19. **Sidebar widgets are user-drag-reorderable** per the `user_preferences.sidebar_widget_order` key. The widget order persists across sessions.

20. **File attachment limits** enforced at upload: max 100 MB per file; blocked types `.exe`, `.vb`, `.bat`, `.cmd`; uploading more than allowed shows an error toast. Navigating away from the page during an active upload shows a browser confirm dialog before canceling.

21. **Change Log is append-only and permanent.** It is accessible via a filter/settings toggle in the timeline header, not a separate nav link. It does not scroll with the main timeline — it replaces it while active.

22. **All design-system components used:** `<Dialog>`, `<Input>`, `<Textarea>`, `<Button>`, `<Badge>`, `<Skeleton>`, `<RadioGroup>`, `<DropdownMenu>`, `<Tabs>` from `@/components/ui/*`. No raw `<input>`, `<button>`, `<select>`, or `<textarea>` HTML elements on this surface.

23. **No hex colors hardcoded in component code.** All colors use design-system tokens: `bg-primary`, `text-primary-foreground`, `bg-accent`, `text-muted-foreground`, `bg-destructive`, `border-border`, etc.

---

## Sources

| Source | Role in this spec |
|---|---|
| **shot-09.md** — static screenshot analysis (Laurie McAdam full page) | Three-column layout proportions; filter tab counts (Email:3, Calls:0, Notes:0, Starred:0); timeline overview with 4 email entries; Quick Follow Up button stub; running automation "Web Inquiry Option 01"; overdue task orange date |
| **shot-10.md** — static screenshot analysis (left column detail + email expand) | Full expanded manual email body (Jun 13 CMA delivery); attachment chip `Ryan-Realty-CMA-62285-Deer-Trail-Rd.pdf (10 MB)`; BCC address `ryan.realty@followupboss.me`; Social Profile section (LinkedIn, Google, Name, Age 76, Gender Female, Location Bend); "Delete person" red link; "Getting Started" bar "2 of 7 steps completed"; "Add background" link |
| **shot-11.md** — static screenshot analysis (timeline bottom — lead origin area) | LEAD ORIGIN card verbatim (all 10 fields); Seller Inquiry card verbatim (address, timeline, tier, step 2 of 7); first automation email body ("We got your home value request — 62285 Deer Trail Rd..."); icon color mapping (email=blue #2563EB, amber #D97706, red-orange #EA580C); opens badge tooltip format ("Laurie McAdam (2) 14d / Email first opened 17d"); "view map" blue link |
| **shot-12.md** — static screenshot analysis (action bar + URL) | URL `ryan-realty.followupboss.com/2/people/view/27022` confirmed; Quick Follow Up dropdown full contents (all 8 preset durations + `+`); "Add Quick Follow Up" tooltip text; "Text" pill shown as active blue (provisioning state); filter tab icon descriptions |
| **shot-13.md** — static screenshot analysis (Apply Automation modal) | Complete Apply Automation modal: title "Apply Automation", `×` close, search field "Search automations...", all 8 automation names (Seller Nurture Long Term through Welcome Sequence Sellers), footer Cancel (ghost) + Apply (teal pill ~#1aa3c9), scrim overlay, keyboard behavior spec |
| **shot-14.md** — static screenshot analysis ("..." context menu) | Three-item context menu: "Forward" / "Block lgmcadam@gmail.com" (red) / "Share this email with Follow Up Boss staff"; fifth email entry partial body; Scroll-to-top FAB (teal pill + chevron-up + "Scroll to top"); star icon (☆) on cards |
| **shot-21.md** — static screenshot analysis (signature card + right sidebar top) | Agent signature card contents (Matt Ryan headshot, name/title/phone/email/website/bio/logo/disclaimer/"Oregon Initial Agency Disclosure Pamphlet"/"Read our Google reviews"); Jun 12 fourth automation email 2 opens; right sidebar top metadata strip (address + "Jun 12th 2026 at 6:39 PM" + "Assigned: Matt Ryan") |
| **fub-analysis-gif/people.md** — GIF frame-by-frame analysis | Email compose async signature load: f10=spinner, f11=full sig+template chips; template chip labels (+ Introduction / + Follow Up / + Still Buying / + Nurture); Text provisioning placeholder "Your Follow Up Boss number is coming up!" (f12); Create Note "Create Note" button disabled when empty (f08); skeleton loading state on navigation (f04); filter panel empty state (f04); Me dropdown structure |
| **fub-docs/people-contacts.md** — official FUB documentation | 8 timeline filter tab names (All, Emails, Texts, Calls, Notes, Activity, Marketing Emails, Starred Items); Marketing Emails 75-entry cap; sidebar sections drag-reorderable per user; smart collapse indicators (Action Plans, Tasks, Appointments); collaborator permissions (full access, no auto-notify unless lead contacts them; auto-removed on promotion to assigned agent); file attachment limits (100 MB max, unlimited qty, blocked types, PDF download behavior, upload-cancel-on-navigate); Change Log append-only/permanent via Timeline > Filters > Change Log; 25-phone shared limit across contact + relationships; social enrichment does NOT run on imported contacts; mass actions do NOT trigger automations |
| **fub-docs/action-plans.md** — official FUB documentation | Auto-pause on reply: email/text reply or call > 2.5 min (FUB calling only, not manual logs); day-0 email sends immediately; day 1+ sends 11:30 AM–5 PM Eastern; non-email steps ~5 AM agent timezone; daily 4-email cap across all plans; duplicate template deduplication (one send, both plans credited); unsubscribe auto-appended (mandatory, cannot remove); email opt-out → orange display, "unsubscribed" tag, blocked marketing emails, 1:1 still allowed; resubscribe requires emailing FUB support; CTIA opt-out keywords (STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT) and opt-in keywords (START/YES/UNSTOP); after-hours text queuing 9 PM–8 AM; plan cannot be deleted from individual profile; same plan can be applied multiple times; no mass-apply; plan tasks do NOT notify agents (unlike manual tasks); `contacted` API field pauses plans; 5-event-type whitelist for API-triggered plans; 2.0 migration is one-way |
| **fub-docs/automations.md** — official FUB documentation | 5-minute duplicate suppression per (contact, automation) pair; 100-trigger concurrent buffer; automations do NOT fire on net-new leads (Lead Flow handles those); manual trigger required for lead-profile manual enrollment; mass apply (2.0 only) requires manual trigger; date-triggered fires at 8 AM company timezone; action plan initial text does NOT send when plan started by automation (only Lead Flow); reassignment executes before note/action plan in same automation; A2P 10DLC registration required since Dec 1 2024; sharing automation includes all nested email templates |
