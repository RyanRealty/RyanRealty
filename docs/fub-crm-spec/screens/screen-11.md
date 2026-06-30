<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.18.54 AM.png | Sequential id: shot-11 | Tiles: fub-tiles/shot-11_{full,q1,q2,q3,q4}.png -->

# shot-11 — Contact Activity Timeline / Email Thread View (Laurie McAdam)

## Identity

- **Visible URL:** Not captured in tiles (browser chrome cropped)
- **Page title:** Inferred to be a contact detail page for Laurie McAdam [INFERRED from breadcrumb header]
- **Top-nav active item:** Not visible — the left navigation rail is fully cropped out in these tiles; only the activity feed content area and far-right sidebar (Claude AI tool interface, not FUB) are visible
- **Sub-nav / tab active:** Not visible — the contact detail tab row (Activity, Details, Deals, etc.) is cropped above the visible content
- **Breadcrumb / thread header:** "Matt Ryan > Laurie McAdam ▾" — appears as a two-person arrow chain at the top of the first email event; the ">" separates sender from recipient; a downward caret (▾) appears after "Laurie McAdam" suggesting a dropdown to change the recipient or context
- **Logged-in user:** Matt Ryan (shown in avatar alongside outgoing emails; the top-right area is obscured by the Claude tool sidebar)
- **Account / brokerage name:** Ryan Realty (visible in email signature body: "Matt Ryan / Ryan Realty / 541.213.6706 / ryan-realty.com")
- **Note on visible right edge:** The far-right ~140 px of the screenshot is the external Claude Code interface ("Recents" list with items like "FUB app…", "Compar…", "Map FUB…", etc.) rendered on top of or adjacent to the browser. This is NOT part of FUB and is excluded from the analysis below.

---

## Layout

The visible FUB content occupies roughly the left 82% of the total screenshot width. Within that FUB region:

### Regions visible

| Region | Approx position | Scrollable? |
|---|---|---|
| **Activity feed / timeline column** | Full visible width, top to bottom | Yes — vertically scrollable; content is mid-scroll (no top-of-feed visible) |
| **Event type icon gutter** | Left ~48 px strip | Fixed relative to each event row |
| **Avatar column** | ~48 px strip immediately right of icon gutter | Fixed relative to each event row |
| **Event content area** | Remaining width (~85%) | Scrolls with feed |
| **Getting Started progress bar** | Bottom of screen, green horizontal band ~8 px tall | Fixed / sticky |
| **Help widget** | Bottom-center, round "?" button | Fixed / floating |

**No left nav rail**, **no right contact-details sidebar**, and **no top nav bar** are visible — the screenshot is cropped to show only the activity feed content pane. This is consistent with FUB's contact record opened in a widened/focused activity view or the Inbox thread view.

**Overall density:** Medium-low. Each event occupies generous vertical space. Email body is fully expanded inline (no collapsed preview).

---

## Every UI Element (exhaustive)

### Event 1 — Outgoing Email (expanded, full body visible)

**Left gutter icon:**
- Blue circle containing a white envelope/email glyph (~20 px diameter)
- Color: approximately `#2563EB` (FUB brand blue)
- Positioned at the vertical center-left of the event row

**Avatar:**
- Matt Ryan's profile photo — circular crop, approximately 32 px diameter, brown-toned headshot photo

**Event header line:**
- Text: `Matt Ryan  >  Laurie McAdam  ▾`
- "Matt Ryan" appears in a slightly heavier weight (sender)
- ">" is a literal chevron or arrow character separating sender from recipient
- "Laurie McAdam" is the recipient name
- "▾" downward caret at the end — clicking likely opens a dropdown to change or inspect recipient [INFERRED]
- Date stamp: `Jun 12` — right-aligned or immediately after the name group, medium gray text, small font (~12 px)

**Action buttons (top-right of event row):**
- `↩ Reply` — ghost/text button with a curved-arrow-left icon prefix, medium gray label "Reply"
- Forward icon — standalone curved-arrow-right icon (no label), acts as "Forward" [INFERRED]
- `…` — three-dot overflow/more-actions icon button

**Email subject line:**
- Text: `We got your home value request — 62285 Deer Trail Rd, Bend, OR 97701, USA`
- Rendered in **bold**, slightly larger than body text (~14 px bold)
- Appears on its own line below the header

**Email body (expanded inline, white card background):**
```
Hi Laurie,

Thanks for requesting a Comparative Market Analysis for 62285 Deer Trail Rd,
Bend, OR 97701, USA.

Matt from Ryan Realty will pull recent comparable sales, apply the right adjustments
for your property, and email you a personalized analysis within the next business
day.

If you have anything you'd like us to know upfront, like recent improvements, timing,
or specific questions, just reply to this email.

Matt Ryan
Ryan Realty
541.213.6706
ryan-realty.com
```
- "62285 Deer Trail Rd, Bend, OR 97701, USA" is rendered **bold** inside the body text
- The signature block uses plain text formatting, no special styling
- `ryan-realty.com` is a plain-text URL (not a hyperlink in this view, or rendered as unformatted)
- The email body sits inside a white rounded-rectangle card with subtle left/top padding, indented from the full event width

---

### Event 2 — Automation Email (archived, with tooltip visible)

**Left gutter icon:**
- Blue circle (~20 px), slightly different shade or the same blue as Event 1 — contains a numeral or lightning bolt suggesting automation. From q1 it appears as a darker blue circle with a white glyph inside.

**Avatar:**
- Matt Ryan's profile photo (same 32 px circular crop)

**Event header line:**
- Text: `Matt Ryan  >  Laurie McAdam  ▾`
- Sub-label: `Jun 12  via automation` — "via automation" appears in a muted/gray color, smaller size (~12 px)

**Badge — "2 opens":**
- Green pill badge with white text: `2 opens`
- Pill shape (fully rounded ends), approximately `#16A34A` green background
- Positioned inline after "via automation" on the header line
- This indicates the email was opened 2 times by the recipient

**Tooltip (visible, floating):**
- Rectangular tooltip card with white/light background and subtle shadow
- Content:
  ```
  Laurie McAdam (2) 14d
  Email first opened 17d
  ```
- "(2)" = 2 opens count matching the badge
- "14d" = 14 days since most recent open (relative to screenshot date)
- "Email first opened 17d" = email was first opened 17 days ago
- Tooltip appears to trigger on hover of the "2 opens" badge [INFERRED]

**Status label:**
- Text: `archived` — lowercase, muted gray, appears as the first line of the event body

**Event body text (one line):**
```
archived (https://ryan-realty.com?_pxl=djoxLGM6YzRkOWNjMzYzOTM4NjUsYTox) Matt Ryan Owner & Principal
```
- This appears to be the raw/plain text version of the archived email body or a system-generated log of the email's tracking pixel URL being fired
- The URL is a tracking pixel URL with a base64-encoded payload (`_pxl=djoxLGM6YzRkOWNjMzYzOTM4NjUsYTox`)
- "Matt Ryan Owner & Principal" appears to be the sender signature fragment captured in the archive record

**"View campaign email" link:**
- Text: `View campaign email`
- Color: FUB blue (~`#2563EB`), underlined on hover [INFERRED]
- Positioned on its own line below the archived body text
- Clicking presumably opens the full campaign email in a modal or new view [INFERRED]

**Action buttons (top-right of event row):**
- `☆` — star/favorite icon (unfilled = not starred), left of Reply
- `↩ Reply` — same ghost Reply button as Event 1
- Forward icon — curved-arrow-right
- `…` — three-dot overflow

**Separator between Events 1 and 2:**
- Thin horizontal line (`#E5E7EB` or similar light gray) dividing the two event cards

---

### Event 3 — Lead Origin System Note

**Left gutter icon:**
- Orange/amber bookmark or tag icon (~20 px) — color approximately `#D97706` or `#F59E0B`
- Glyph suggests a bookmark, flag, or price-tag shape indicating a system-generated lead annotation

**Avatar:**
- Matt Ryan profile photo (same 32 px circular crop)
- Positioned as the "author" of the system event (the user responsible for the record/automation)

**Event header line:**
- Text: `Matt Ryan`
- Date: `Jun 12`
- No recipient name shown — this is a system note, not a sent message

**Event body — structured key-value block:**
```
LEAD ORIGIN
Source: Seller LP (Home Value)
Page: /lp/seller-home-value
Campaign: concept-m-mountain (facebook/paid_social, ad=v13-editorial)
Wants: home valuation for 62285 Deer Trail Rd, Bend, OR 97701, USA, plans to sell ready to sell now
Tier: hot (move timeline ready to sell now)
Assigned: matt (default routing to Matt)
```
- "LEAD ORIGIN" is the section header — uppercase, bold or semibold, slightly larger
- All key-value pairs are plain left-aligned monospace-like text (not a table)
- "Seller LP (Home Value)" = the lead source label
- "/lp/seller-home-value" = the landing page path
- "concept-m-mountain" = campaign name
- "(facebook/paid_social, ad=v13-editorial)" = channel and ad variant in parentheses
- "Wants: home valuation for 62285 Deer Trail Rd..." = parsed intent from form submission
- "Tier: hot" = lead tier classification; "(move timeline ready to sell now)" = system reason for hot tier
- "Assigned: matt" = broker assignment; "(default routing to Matt)" = routing rule explanation

**No action buttons** visible on this event row — system notes may not support Reply/Forward [INFERRED]

---

### Event 4 — Seller Inquiry Form Submission

**Left gutter icon:**
- Orange/red filled circle (~20 px) containing a white house or form glyph
- Color approximately `#DC2626` or `#EA580C` — distinguishes form submissions from emails and notes

**Event header:**
- Bold label: `Seller Inquiry`
- Date: `Jun 12`
- No avatar visible on this event (or avatar is present but not clearly distinguishable at this crop)

**Event body — structured data:**

Line 1 (address, prominent):
```
62285 Deer Trail Rd, Bend, OR 97701  -  view map
```
- Address rendered in **bold**
- `view map` is a blue hyperlink

Line 2 (attribution):
```
via: Ryan-Realty.com • Buyers • Matt Ryan (API)
```
- "Ryan-Realty.com" is bold or slightly heavier weight
- " • " (middle-dot) used as separator
- "Buyers" = the pipeline/deal type
- "Matt Ryan (API)" = agent assigned via API call

Line 3:
```
Assigned to: Matt Ryan
```

Line 4 (raw submission data / summary):
```
Seller LP submission. Address: 62285 Deer Trail Rd, Bend, OR 97701, USA. Timeline: ready-now. Tier: hot. Assigned: matt.
```
- This is the raw structured output from the lead form/webhook, displayed as a summary string
- Dot-separated key-value pairs: Timeline=ready-now, Tier=hot, Assigned=matt

**No action buttons** visible on this event row

---

### Bottom UI Elements

**Getting Started progress bar:**
- Thin horizontal bar at very bottom of screen
- Color: bright green (`#22C55E` or similar)
- Fixed/sticky to bottom of viewport
- Represents completion of a FUB onboarding checklist [INFERRED from FUB conventions]

**Help widget:**
- Circular button, bottom-center of screen
- Contains "?" glyph in white on dark background
- Fixed floating position
- Opens FUB help documentation or support chat [INFERRED]

---

## Colors, Typography & Style

### Colors

| Element | Approximate hex |
|---|---|
| Page/feed background | `#F9FAFB` (very light gray) |
| Email body card background | `#FFFFFF` (white) |
| Event row hover background | `#F3F4F6` [INFERRED] |
| Email icon circle | `#2563EB` (FUB blue) |
| Lead Origin icon | `#D97706` (amber/orange) |
| Seller Inquiry icon | `#EA580C` or `#DC2626` (red-orange) |
| "2 opens" badge | `#16A34A` (green) |
| Blue link text ("View campaign email", "view map") | `#2563EB` |
| Muted label text ("Jun 12", "via automation", "archived") | `#6B7280` (gray-500) |
| Body text | `#111827` or `#1F2937` (near-black) |
| Bold subject line | `#111827` bold |
| Horizontal separators | `#E5E7EB` (gray-200) |
| Getting Started bar | `#22C55E` (green) |
| Reply / action button text | `#374151` or `#6B7280` |
| Star icon (unfilled) | `#9CA3AF` (gray-400) |

### Typography

- **Event header names:** ~14 px, medium weight (500)
- **Email subject line:** ~14 px, bold (700)
- **Email body text:** ~14 px, regular (400), line-height ~1.5
- **Date stamps / metadata:** ~12 px, regular (400), gray (`#6B7280`)
- **"LEAD ORIGIN" header:** ~13 px, uppercase, semibold (600) or bold
- **Key-value pair labels:** ~13 px, regular, near-black
- **Badge text ("2 opens"):** ~12 px, bold, white on green
- **Font family:** System UI / sans-serif (FUB uses Inter or a similar neutral sans)

### Icon style

- Filled circles with white glyphs for event type indicators (left gutter)
- Thin-line icons for action buttons (Reply arrow, forward arrow, star, overflow)
- Consistent ~20 px diameter for event gutter icons
- All action icons use gray color at rest

### Layout / spacing

- Event rows have ~16 px vertical padding top and bottom
- Left gutter + avatar total: ~80 px before content begins
- Horizontal separator between events: 1 px, full width
- Tooltip card: white background, ~4 px border-radius, subtle drop-shadow, ~200 px wide
- Email body card: left-indented ~16 px from avatar, white background, ~8–12 px padding

---

## State & Data Shown

**Contact being viewed:** Laurie McAdam

**Active thread / filter:** Showing all activity for this contact on Jun 12 (the lead creation date). This appears to be the full chronological sequence of what happened when Laurie submitted the home value form:
1. System received seller LP submission (Seller Inquiry event)
2. System logged LEAD ORIGIN metadata
3. Automation sent an email (via automation — archived)
4. Matt (or automation) sent a confirmation email (manual or auto)

**Timeline order (bottom to top = newest to oldest, OR top to bottom = oldest to newest):**
- The events appear in top-to-bottom order, with Event 1 (email) at top and Event 4 (seller inquiry form submission) at bottom
- This suggests the view is **newest-first** (email at top) or these events overlap in timestamp
- Actually: the Seller Inquiry (form submission) logically happened FIRST, then lead origin was logged, then the automation email fired, then Matt's manual email was sent. But visually Events 1-2 appear above Events 3-4. This may indicate the feed is **chronological descending (newest at top)** and Matt's emails were sent after the system events. [INFERRED]

**Real data values:**
- Contact name: Laurie McAdam
- Property address: 62285 Deer Trail Rd, Bend, OR 97701, USA
- Lead source: Seller LP (Home Value)
- Landing page: /lp/seller-home-value
- Campaign: concept-m-mountain
- Channel: facebook/paid_social
- Ad variant: v13-editorial
- Lead intent: home valuation, plans to sell, timeline "ready-now"
- Lead tier: hot
- Assigned broker: Matt Ryan (matt)
- Email opens: 2 (first opened 17 days ago, last opened 14 days ago relative to screenshot)
- Email subject: "We got your home value request — 62285 Deer Trail Rd, Bend, OR 97701, USA"
- Tracking pixel URL domain: ryan-realty.com with `_pxl` param
- Attribution: via Ryan-Realty.com • Buyers • Matt Ryan (API)
- Sender identity in email: "Matt Ryan / Ryan Realty / 541.213.6706 / ryan-realty.com"

---

## Interactions & Behaviors

### Email event actions

| Control | Behavior |
|---|---|
| `↩ Reply` button | Opens inline reply composer below the email body OR opens a compose panel [INFERRED] |
| Forward icon (curved arrow right) | Opens forward composer with the email pre-filled [INFERRED] |
| `…` three-dot | Opens dropdown with: Delete, Edit, Archive, Mark as unread, Copy link, or similar [INFERRED from FUB conventions] |
| `☆` star/favorite | Toggles star state on the email; starred emails may appear in a separate filtered view [INFERRED] |
| Clicking email subject / body | May toggle expand/collapse of the email body inline [INFERRED]; currently expanded |

### Automation email badge

| Control | Behavior |
|---|---|
| Hover over "2 opens" badge | Shows tooltip: "Laurie McAdam (2) 14d / Email first opened 17d" — confirmed visible in screenshot |
| Click "View campaign email" | Opens the automation campaign email template in a modal or separate view [INFERRED] |

### Lead Origin note

- No interactive controls visible
- Text-only display of structured JSON/webhook data reformatted as a readable list
- [INFERRED] Clicking might expand raw JSON or link to the campaign details

### Seller Inquiry event

| Control | Behavior |
|---|---|
| Click "view map" link | Opens Google Maps (or similar) for the address in a new tab [INFERRED] |
| Click "Ryan-Realty.com" | Possibly opens the site or the submission source URL [INFERRED] |

### Global feed behaviors

- **Infinite scroll:** Older events load as the user scrolls down [INFERRED]
- **Collapsed vs. expanded emails:** Emails can likely be toggled collapsed/expanded by clicking the header row [INFERRED]; currently all visible emails are expanded
- **Automation badge click:** May navigate to the automation/campaign that sent the email [INFERRED]

---

## Data Model Signals

### Entities revealed

**Person (contact):**
- `id` — internal FUB person ID
- `name` — "Laurie McAdam"
- `assigned_agent` — Matt Ryan
- `lead_tier` — "hot"
- `pipeline` — "Buyers" (attributed, though this is a seller lead — may be the default pipeline at creation)
- `source` — "Seller LP (Home Value)"
- `created_at` — Jun 12

**Activity / Timeline Event (polymorphic):**
- `id`
- `type` — enum: `email_sent`, `email_automation`, `system_note`, `form_submission` (or similar; FUB likely uses: `email`, `automation_email`, `note`, `lead_created`)
- `actor_user_id` — Matt Ryan (or system)
- `contact_id` — Laurie McAdam
- `created_at` — Jun 12
- `body` — text/HTML content
- `metadata` — jsonb or structured fields depending on type

**Email Activity:**
- `subject` — "We got your home value request — ..."
- `from_user` — Matt Ryan
- `to_contact` — Laurie McAdam
- `body_html` / `body_text` — full email content
- `is_automation` — boolean
- `open_count` — integer (2)
- `first_opened_at` — relative "17d" ago
- `last_opened_at` — relative "14d" ago
- `tracking_pixel_url` — "https://ryan-realty.com?_pxl=..."
- `campaign_id` — FK to campaign
- `status` — "archived"

**Campaign:**
- `id`
- `name` — "concept-m-mountain"
- `channel` — "facebook/paid_social"
- `ad_variant` — "v13-editorial"
- Can be viewed via "View campaign email" link

**Lead Origin (system note):**
- `source` — "Seller LP (Home Value)"
- `landing_page` — "/lp/seller-home-value"
- `campaign_name` — "concept-m-mountain"
- `wants` — text description of intent
- `timeline` — "ready-now"
- `tier` — "hot"
- `assigned_to` — "matt"
- `routing_rule` — "default routing to Matt"

**Form Submission (Seller Inquiry):**
- `form_type` — "Seller Inquiry" / "Seller LP"
- `address` — "62285 Deer Trail Rd, Bend, OR 97701, USA"
- `source_domain` — "Ryan-Realty.com"
- `pipeline` — "Buyers"
- `assigned_agent` — "Matt Ryan"
- `submission_method` — "API"
- `timeline` — "ready-now"
- `tier` — "hot"
- `assigned` — "matt"

### Relationships

- Person has many Activity Events (1:N)
- Activity Event has one Actor (User) (N:1)
- Email Activity has one Campaign (optional FK)
- Form Submission has one assigned Agent (User)
- Lead Origin references Campaign and Landing Page

### Enum values observed

- **Lead tier:** `hot` (implies: warm, cold, etc.)
- **Timeline:** `ready-now` (implies: 1-3 months, 6+ months, etc.)
- **Email status:** `archived`
- **Form type:** `Seller Inquiry` (implies: Buyer Inquiry, Contact, etc.)
- **Attribution channel:** `facebook/paid_social`
- **Assignment method:** `API`, `default routing`

---

## Rebuild Notes

### Component breakdown

```
<ContactActivityFeed contactId={contact.id}>
  {events.map(event => (
    <ActivityEventRow key={event.id} event={event} />
  ))}
  <GettingStartedBar />
  <HelpWidget />
</ContactActivityFeed>
```

**`<ActivityEventRow>`** — polymorphic dispatcher:
```
<ActivityEventRow event={event}>
  <EventTypeIcon type={event.type} />          // left gutter circle icon
  <AgentAvatar userId={event.actorId} />        // 32px circular photo
  <EventContent>
    {event.type === 'email' && <EmailEvent />}
    {event.type === 'automation_email' && <AutomationEmailEvent />}
    {event.type === 'system_note' && <SystemNoteEvent />}
    {event.type === 'form_submission' && <FormSubmissionEvent />}
  </EventContent>
</ActivityEventRow>
```

**`<EmailEvent>`:**
```
<EmailEventHeader>
  <ThreadParticipants from={event.from} to={event.to} />   // "Matt Ryan > Laurie McAdam ▾"
  <DateStamp date={event.createdAt} />                     // "Jun 12"
  <EmailActions>
    <ReplyButton />
    <ForwardButton />
    <OverflowMenu />
  </EmailActions>
</EmailEventHeader>
<EmailSubject bold>{event.subject}</EmailSubject>
<EmailBodyCard>
  <EmailBody html={event.bodyHtml} />
</EmailBodyCard>
```

**`<AutomationEmailEvent>`:**
```
<AutomationEmailHeader>
  <ThreadParticipants from={event.from} to={event.to} />
  <DateStamp date={event.createdAt} />
  <AutomationLabel text="via automation" />
  <OpensBadge
    count={event.openCount}
    tooltip={`${event.contactName} (${event.openCount}) ${event.lastOpenedAgo}\nEmail first opened ${event.firstOpenedAgo}`}
  />
  <EmailActions starred={event.starred}>
    <StarButton />
    <ReplyButton />
    <ForwardButton />
    <OverflowMenu />
  </EmailActions>
</AutomationEmailHeader>
<ArchivedLabel />
<ArchivedBody url={event.trackingUrl} senderSignature={event.senderSignature} />
<ViewCampaignEmailLink campaignId={event.campaignId} />
```

**`<SystemNoteEvent>` (Lead Origin):**
```
<SystemNoteHeader>
  <AgentAvatar />
  <AgentName>{event.actorName}</AgentName>
  <DateStamp />
</SystemNoteHeader>
<LeadOriginBlock>
  <SectionHeader>LEAD ORIGIN</SectionHeader>
  <KeyValuePair label="Source" value={event.source} />
  <KeyValuePair label="Page" value={event.landingPage} />
  <KeyValuePair label="Campaign" value={event.campaignName} />
  <KeyValuePair label="Wants" value={event.intent} />
  <KeyValuePair label="Tier" value={event.tier} />
  <KeyValuePair label="Assigned" value={event.assignedTo} />
</LeadOriginBlock>
```

**`<FormSubmissionEvent>` (Seller Inquiry):**
```
<FormSubmissionHeader>
  <FormTypeLabel>Seller Inquiry</FormTypeLabel>
  <DateStamp />
</FormSubmissionHeader>
<FormSubmissionBody>
  <AddressLine bold>
    {event.address}
    <MapLink href={googleMapsUrl(event.address)}>view map</MapLink>
  </AddressLine>
  <AttributionLine>
    via: <strong>{event.sourceDomain}</strong> • {event.pipeline} • {event.agentName} (API)
  </AttributionLine>
  <AssignedLine>Assigned to: {event.assignedAgent}</AssignedLine>
  <RawSummary>{event.rawSummaryText}</RawSummary>
</FormSubmissionBody>
```

**`<EventTypeIcon>`** — maps event type to colored circle + glyph:
```
const EVENT_TYPE_ICONS = {
  email:              { bg: '#2563EB', glyph: EnvelopeIcon },
  automation_email:   { bg: '#2563EB', glyph: AutomationIcon },   // lightning or similar
  system_note:        { bg: '#D97706', glyph: BookmarkIcon },
  form_submission:    { bg: '#EA580C', glyph: HouseIcon },
  // additional types: call, text, note, stage_change, task, etc.
}
```

**`<OpensBadge>`** — pill badge with tooltip:
```
<Tooltip content={tooltipContent}>
  <Badge variant="green" pill>{count} opens</Badge>
</Tooltip>
// tooltip content:
// Line 1: "{contactName} ({openCount}) {lastOpenedAgo}"
// Line 2: "Email first opened {firstOpenedAgo}"
```

### Non-obvious logic

1. **Email open tracking:** FUB injects a tracking pixel (`_pxl` query param) into emails sent through the platform. When the pixel fires, FUB increments the open count and records the timestamp. The archived email body text literally contains the tracked URL that was fired when archived.

2. **Lead Origin system note:** When a lead submits a form via the website API integration, FUB automatically creates a system note of type "Lead Origin" containing the structured webhook payload. This is formatted by FUB into a readable key-value list, not stored as raw JSON in the UI.

3. **"via automation" label:** Any email sent through a FUB action plan/automation sequence is tagged with "via automation" in the timeline. The actor is still the assigned agent (Matt Ryan), not "system".

4. **"archived" automation email:** FUB marks automation emails as "archived" after they are sent (meaning they are logged and closed, not that they were soft-deleted). The body shown is a system-generated summary of the archived email record, including the tracking pixel URL.

5. **"2 opens" tooltip timing:** The tooltip shows two distinct timestamps — "14d" (last open) and "17d" (first open) — relative to the current date. This data comes from email_open_events table or similar, joined to the email activity.

6. **"Buyers • Matt Ryan (API)" attribution:** Even though this is a seller inquiry, the pipeline attribution shows "Buyers" — this suggests the default pipeline in FUB for new Ryan Realty leads is "Buyers" (likely a misconfiguration or the landing page sends all leads to the Buyers pipeline). The "(API)" suffix indicates the lead was assigned programmatically via the FUB API, not by a user manually in the UI.

7. **Thread header dropdown (▾ after recipient):** Clicking the dropdown likely shows options to: change the recipient for the reply, view the full thread with this contact, or similar context-switching. [INFERRED]

8. **Feed scroll direction:** The visible events appear newest-at-top (the sent confirmation email is at top, the original form submission is at bottom). This means the feed is reverse-chronological.

9. **Getting Started bar:** The green bar at the very bottom is a persistent onboarding component that FUB shows to users who have not completed their setup checklist. It tracks progress (percentage of setup tasks done) and links to the getting started guide. It is overlaid on top of the main content at the bottom of every page until dismissed or completed.
