<!-- Mobile per-screen appendix. Original: IMG_5989.PNG | id: mob-27 | tiles: mob-tiles/mob-27_{full,t,m,b}.png -->

# mob-27 — fub-ios — Contact Detail: Comms Tab (Email History)

## Identity
- **app_source:** fub-ios (Follow Up Boss native iPhone app — dark teal header, FUB sub-tab strip, no Safari chrome, no ryan-realty.com URL bar)
- **module:** Contact Detail (Lead Profile)
- **screen:** Derek Winchell — Comms sub-tab, showing a chronological list of archived outbound email communications with open-tracking data
- **how to reach:** From any bottom tab (Inbox / Activity / People / etc.) → tap a contact row → Contact Detail auto-opens on Info; then tap "Comms" sub-tab
- **iOS status bar:** 8:39 (time, left) · signal bars (2/4 filled) · WiFi icon · 37% battery indicator (right)
- **bottom tab bar:** Not visible — the Contact Detail is a navigation-pushed screen; the tab bar from the originating list is hidden behind this push

---

## Screen regions (top → bottom, ~390×844 pt logical)

| Region | y-band (pt) | Height est. | Background |
|---|---|---|---|
| iOS status bar | 0–47 | 47 pt | Dark teal ~#354a56 (inherits header) |
| Nav / back bar | 47–92 | 45 pt | Dark teal ~#354a56 |
| Contact identity block | 92–170 | 78 pt | Dark teal ~#354a56 |
| Sub-tab strip | 170–210 | 40 pt | Dark teal ~#354a56, white/muted text |
| Scrollable email list | 210–750 | ~540 pt | White #ffffff |
| Empty state / bottom zone | 750–844 | ~94 pt | Light blue-gray ~#edf1f4 |
| FAB (floating, overlays bottom zone) | anchored bottom-right | 56 pt circle | Medium blue ~#5b9bd5 |

---

## Nav / header bar (exact)

**Back control (left):** Single left-pointing chevron `<` in white, ~22 pt, tappable full left quadrant (~44×44 pt tap target). No label text. Pops the contact detail off the nav stack, returning to the originating list.

**Center / identity block (spans full width below chevron):**
- Circular avatar photo: real headshot of Derek Winchell (male, suit, formal photo), ~52 pt diameter, circular crop with no border ring. Left-aligned with ~16 pt leading margin, vertically centered with name block.
- **Primary name:** "Derek Winchell" — white, ~20 pt, semibold/600 weight
- **Subtitle:** "No communication yet" — muted gray-white ~#9db5c0, ~13 pt, regular weight. (Shown here despite the Comms tab showing archived emails — this is the FUB "last conversation" status field, not a real-time count from the Comms list. Render as-is.)

**Right controls:** None visible in this view (no search, no bell, no kebab).

---

## Sub-tab strip (exact)

Five tabs visible (fifth is truncated), rendered as text labels in the dark teal header zone with a blue underline indicator on the active tab:

| Position | Label | State |
|---|---|---|
| 1 | Info | Inactive — muted white/gray ~#9db5c0 |
| 2 | **Comms** | **Active — white text, 2 pt blue underline ~#5b9bd5** |
| 3 | Homes | Inactive — muted white/gray |
| 4 | Notes | Inactive — muted white/gray |
| 5 | Caler… | Inactive, truncated — full label is "Calendar" |

Tab strip height: ~40 pt. Active underline: ~2 pt, full label width, color ~#5b9bd5. The strip is horizontally scrollable to reveal additional tabs (Caler → Calendar, and potentially Tasks, Files beyond).

---

## Bottom tab bar

Not rendered in this pushed view. Parent tab bar (Inbox / Activity / Calendar / People / Deals — standard FUB 5-tab bar) is hidden while Contact Detail is on the navigation stack.

---

## Content — every element, in order

### Email communication list (scrollable, white background)

Each row follows an identical anatomy. 4 rows visible; list may scroll further. Thin horizontal divider (~1 pt, light gray ~#e5e7eb) separates each row. No section headers.

---

**Row anatomy (repeated 4×):**

```
[envelope-icon]  [status-label]            [date-string]
                 [sender-name bold]
                 [subject-line truncated ...]

[open-icon] [N open(s)]  Last opened [date]
```

- **Left icon:** Outlined envelope glyph (~22×18 pt), blue ~#5b9bd5. Fixed left column ~48 pt wide, vertically centered on the 3-line text block.
- **Status label (line 1):** "archived" — small, ~12 pt, gray ~#9aa5ae, regular weight. Right-aligned date string on same row.
- **Sender name (line 2):** "Matt Ryan" — ~15 pt, dark ~#1c2b38, semibold/600. No avatar. This is the FUB broker who sent the email.
- **Subject/preview (line 3):** Truncated with ellipsis. Gray ~#9aa5ae, ~13 pt, regular. The content shown is the tracking pixel URL used for open-tracking, not a real subject line — it reads: `archived (https://ryan-realty.com?_pxl=djoxLGM6...` truncated.
- **Open-tracking row (line 4):** Orange/amber envelope icon (~16 pt, filled style, color ~#e8804a) + bold count ("1 open" or "2 opens", ~13 pt, dark) + gray text "Last opened [date]" (~13 pt, ~#9aa5ae). Left-indented to align with text column (not with the blue icon column).
- **Row padding:** ~12 pt top/bottom, ~16 pt left margin to blue icon.
- **Row height:** ~90–95 pt per row (4-line content).
- **Tappable:** Full row tap → opens the email detail / thread view.
- **Swipe actions:** [INFERRED] FUB typically reveals swipe-left actions (Archive, Delete) and swipe-right (quick reply or mark read) — not directly visible in screenshot.

---

**Row 1 — exact data:**
- Status: `archived`
- Date: `5d` (5 days ago relative)
- Sender: `Matt Ryan`
- Preview: `archived (https://ryan-realty.com?_pxl=djoxLGM6OTM1NTZhMzYzOTM5MzAs...`
- Open info: `1 open  Last opened 5 days ago`

**Row 2 — exact data:**
- Status: `archived`
- Date: `Jun 19`
- Sender: `Matt Ryan`
- Preview: `archived (https://ryan-realty.com?_pxl=djoxLGM6MjliZDM5MzYzOTM5MzAsY...`
- Open info: `1 open  Last opened Jun 20`

**Row 3 — exact data:**
- Status: `archived`
- Date: `Jun 15`
- Sender: `Matt Ryan`
- Preview: `archived (https://ryan-realty.com?_pxl=djoxLGM6MmFhYTk2MzYzOTM5MzA...`
- Open info: `1 open  Last opened Jun 15`

**Row 4 — exact data:**
- Status: `archived`
- Date: `Jun 13`
- Sender: `Matt Ryan`
- Preview: `archived (https://ryan-realty.com?_pxl=djoxLGM6M2FlNjAxMzYzOTM5MzAsY...`
- Open info: `2 opens  Last opened Jun 13`

---

### Empty zone below list

After Row 4 the scroll content ends. A light blue-gray area (~#edf1f4) fills the rest of the screen — this is the scroll view's background showing through after list content exhausted. No empty-state message or illustration; the list simply ends.

---

### FAB (Floating Action Button)

- Position: Bottom-right, ~16 pt from right edge, ~24 pt from bottom of visible area (above the home indicator zone)
- Shape: Circle, ~56 pt diameter
- Color: Medium blue ~#5b9bd5 (matches FUB accent)
- Icon: White `+` (plus), ~22 pt, centered
- Action [INFERRED]: Opens a compose sheet to log or send a new communication (email, text, call, note) to Derek Winchell

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / nav background | Dark teal-gray ~#354a56 (FUB signature dark header) |
| Contact name text | White #ffffff, ~20 pt semibold |
| Contact subtitle text | ~#9db5c0 (muted white-blue), ~13 pt regular |
| Active sub-tab text | White #ffffff |
| Active sub-tab underline | Blue ~#5b9bd5, 2 pt |
| Inactive sub-tab text | ~#8ea8b8 (muted blue-gray) |
| Content background | White #ffffff |
| Row status label ("archived") | ~#9aa5ae, ~12 pt regular |
| Row date string | ~#9aa5ae, ~12 pt regular |
| Row sender name | ~#1c2b38, ~15 pt semibold |
| Row preview text | ~#9aa5ae, ~13 pt regular |
| Left envelope icon (outbound) | Blue ~#5b9bd5, outlined style |
| Open-tracking icon | Orange/amber ~#e8804a, filled envelope |
| Open count text | ~#1c2b38, ~13 pt semibold |
| "Last opened" text | ~#9aa5ae, ~13 pt regular |
| Row divider | ~#e5e7eb, 1 pt |
| FAB background | ~#5b9bd5 |
| FAB icon | White `+` |
| Bottom empty zone | ~#edf1f4 |
| iOS status bar icons | White |

**Font:** FUB uses SF Pro (system). No Amboqia/Geist — this is the native FUB app.

**Accent color:** #5b9bd5 (blue, not teal — FUB's characteristic lighter blue for interactive elements and the active tab underline).

---

## Interactions & gestures (mark [INFERRED])

| Target | Behavior |
|---|---|
| Back chevron `<` | Pop contact detail; return to originating list |
| "Info" sub-tab | Switch to Info tab (contact fields: name, phone, email, source, stage, tags) |
| "Comms" sub-tab | Current screen — no-op |
| "Homes" sub-tab | Switch to Homes tab (saved searches / listing activity) |
| "Notes" sub-tab | Switch to Notes tab (broker notes log) |
| "Caler..." sub-tab | [INFERRED] Switch to Calendar tab (appointments for this contact) |
| Any email row (tap) | [INFERRED] Push email thread/detail view showing full subject, body, open timeline |
| Email row swipe-left | [INFERRED] Reveal destructive actions (Delete, Archive) |
| Email row swipe-right | [INFERRED] Reveal quick-reply or mark-read action |
| FAB `+` | [INFERRED] Present compose action sheet (options: Send Email, Log Call, Send Text, Add Note) |
| Pull-to-refresh on list | [INFERRED] Reload communication history from FUB backend |
| Sub-tab strip horizontal scroll | [INFERRED] Reveal additional tabs beyond "Caler" (e.g. Tasks, Files) |

---

## Build notes (component tree)

```
<ContactDetailShell>                          // full-screen nav-pushed view, no bottom tabs
  <StatusBar light />                         // white icons on dark bg

  <ContactDetailHeader bg="#354a56">
    <BackButton icon="chevron-left" color="#fff" onTap="navigation.pop()" />
    <ContactIdentityBlock>
      <Avatar
        src={contact.photoUrl}
        shape="circle"
        size={52}
        fallback={initials}
      />
      <Stack spacing={2}>
        <Text style="contactName" color="#fff">{contact.fullName}</Text>
        <Text style="contactSubtitle" color="#9db5c0">{contact.lastContactStatus}</Text>
        // "No communication yet" is a computed field from FUB contact record
      </Stack>
    </ContactIdentityBlock>
  </ContactDetailHeader>

  <SubTabStrip
    tabs={["Info", "Comms", "Homes", "Notes", "Calendar", /* ...more */]}
    activeTab="Comms"
    activeColor="#fff"
    inactiveColor="#8ea8b8"
    indicatorColor="#5b9bd5"
    indicatorHeight={2}
    bg="#354a56"
    scrollable={true}
  />

  <ScrollView bg="#fff">
    {emails.map(email => (
      <EmailCommRow
        key={email.id}
        onTap={() => navigation.push('EmailDetail', { emailId: email.id })}
        swipeActions={['archive', 'delete']}
      >
        <LeftIcon>
          <EnvelopeOutlinedIcon size={22} color="#5b9bd5" />
          // Blue outlined envelope = outbound / sent email
        </LeftIcon>
        <EmailRowBody>
          <Row justifyContent="space-between">
            <Text style="statusLabel" color="#9aa5ae">{email.status}</Text>
            // "archived"
            <Text style="dateLabel" color="#9aa5ae">{email.relativeDate}</Text>
            // "5d" or "Jun 19" etc.
          </Row>
          <Text style="senderName" color="#1c2b38" weight={600}>{email.senderName}</Text>
          // "Matt Ryan"
          <Text style="preview" color="#9aa5ae" numberOfLines={2}>{email.subjectOrPreview}</Text>
          // truncated subject/preview (currently showing pixel URL)
        </EmailRowBody>
        <OpenTrackingChip>
          <EnvelopeFilledIcon size={16} color="#e8804a" />
          // Orange = email has been opened
          <Text style="openCount" color="#1c2b38">{email.openCount} open{email.openCount !== 1 ? 's' : ''}</Text>
          <Text style="openDate" color="#9aa5ae">Last opened {email.lastOpenedDate}</Text>
        </OpenTrackingChip>
        <RowDivider color="#e5e7eb" height={1} />
      </EmailCommRow>
    ))}
    <EmptyZone bg="#edf1f4" minHeight={80} />
    // Fills remaining scroll space after list ends
  </ScrollView>

  <FAB
    icon="plus"
    bg="#5b9bd5"
    size={56}
    position="bottom-right"
    offset={{ right: 16, bottom: 24 }}
    onTap="openComposeSheet"
    // Sheet options: Send Email | Log Call | Send Text | Add Note
  />
</ContactDetailShell>
```

### Data bindings

| Field | Source |
|---|---|
| `contact.fullName` | FUB contact record `.name` |
| `contact.photoUrl` | FUB contact record `.avatarUrl` |
| `contact.lastContactStatus` | FUB contact record — "No communication yet" is shown when `lastCommunicationDate === null` |
| `email.status` | FUB email record `.status` — "archived" |
| `email.relativeDate` | Computed from `email.createdAt` (relative if < 7 days, else "Mon DD") |
| `email.senderName` | FUB email record `.senderName` — "Matt Ryan" (the broker) |
| `email.subjectOrPreview` | FUB email record `.subject` or `.bodyPreview` — currently populated with pixel-tracking URL |
| `email.openCount` | FUB email tracking `.opens` count |
| `email.lastOpenedDate` | FUB email tracking `.lastOpenedAt` |

### Key spacing
- Row padding: 12 pt top/bottom, 16 pt leading to blue icon, 12 pt trailing
- Icon column width: 48 pt (icon 22 pt, centered)
- Gap between icon column and text block: 8 pt
- Open-tracking row indent: 48 pt (aligns with text, not icon)
- Sub-tab height: 40 pt; label font ~14 pt medium
- Header identity block height: ~78 pt; avatar 52 pt

### Notes for in-house rebuild
- The "archived" status label + pixel URL preview text is a FUB artifact from automated drip email archiving. In the in-house CRM, surface the actual email subject and a real status badge (e.g. "sent", "opened", "clicked", "bounced").
- Open-tracking count is sourced from email open events stored in `crm_timeline` (type = `email_open`) — count distinct events per email send, attach to the email row.
- The blue outlined envelope icon = outbound email. In-house should also support: inbound email (different glyph/color), SMS (speech bubble icon), call (phone icon), note (pencil icon) — all mixed into the Comms timeline.
- Sub-tab strip should be `overflow-x: auto; scroll-snap-type: x mandatory` on mobile, each tab `scroll-snap-align: start`.
- FAB compose sheet in FUB presents a bottom action sheet with communication type choices — implement as `<Sheet>` from `@/components/ui/sheet`.
