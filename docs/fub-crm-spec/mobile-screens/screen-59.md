<!-- Mobile per-screen appendix. Original: IMG_6031.PNG | id: mob-59 | tiles: mob-tiles/mob-59_{full,t,m,b}.png -->

# mob-59 — fub-ios — Contact Detail (Info Tab)

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app — dark teal/slate header, FUB blue accent, no Safari chrome)
- **module:** Contact Detail (Lead Profile) — Info sub-tab
- **screen:** Derek Winchell's contact detail card, Info tab active
- **how to reach:** People tab → tap any contact row → pushes this detail view
- **iOS status bar:** 4:58 (time, left) · signal bars (3/4 filled) · WiFi icon · battery 100% (right)
- **URL:** N/A (native app)

---

## Screen regions (y-bands on 390×844 pt logical screen)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–47 | 47 | #3D5467 (dark teal, same as header) |
| Nav / header bar | 47–100 | 53 | #3D5467 |
| Contact hero (avatar + name) | 100–185 | 85 | #3D5467 |
| Sub-tab strip | 185–228 | 43 | #3D5467 |
| Active tab indicator bar | 228–231 | 3 | #4A9FD8 (FUB blue) |
| Scrollable content area | 231–844 | 613 | #FFFFFF (rows) / #F2F4F7 (section headers) |
| FAB (floating, overlaid) | ~720–780 | 58 | #4A9FD8 circle, bottom-right |
| Bottom tab bar | not visible (hidden on push, or scrolled off) | — | — |

---

## Nav / header bar (exact)

- **Left control:** Back chevron `<` — white, ~22pt — taps to pop back to People list
- **Center:** (empty — no title text in nav bar; identity lives in the hero block below)
- **Right control:** text button **"Edit"** — white, ~17pt regular weight — taps to enter edit mode for this contact

### Contact hero block (below nav bar, within header bg)
- **Avatar:** circular photo, ~72pt diameter, real headshot of Derek Winchell (man in dark suit, dark background); positioned ~16pt from left edge, vertically centered in hero block
- **Primary name:** "Derek Winchell" — white, ~22pt, semibold, positioned right of avatar
- **Subtitle:** "No communication yet" — ~#9EB0C0 (muted blue-gray), ~14pt regular, below name

---

## Sub-tab strip (exact)

All tabs sit on the same #3D5467 header background. Active tab text is white; inactive tabs are #8A9BB0 (muted gray-blue). A 3pt blue underline (#4A9FD8) spans the width of the active tab label.

| Order | Label | State |
|---|---|---|
| 1 | Info | **Active** (white text, blue underline) |
| 2 | Comms | Inactive (gray) |
| 3 | Homes | Inactive (gray) |
| 4 | Notes | Inactive (gray) |
| 5 | Calen… | Inactive (gray, truncated — scrollable strip, more tabs off-screen right) |

Strip scrolls horizontally. Additional tabs likely include "Tasks", "Files", etc. (FUB standard tab set).

---

## Bottom tab bar (exact)

**Not visible in this screenshot.** The contact detail view is a pushed navigation stack from the People tab. The bottom tab bar (standard FUB 5-tab bar: Inbox / Activity / Calendar / People / Deals) is either hidden on push or scrolled below the visible capture area. The originating active tab is **People**.

### FAB
- **Position:** fixed, bottom-right corner of the scrollable content area, ~24pt from right edge, ~80pt from bottom of screen
- **Shape:** circle, ~58pt diameter
- **Color:** #4A9FD8 (FUB blue)
- **Icon:** white "+" (plus sign), ~24pt, centered
- **Function [INFERRED]:** Quick-add action — opens a sheet to add a note, task, appointment, or log a call for this contact

---

## Content — every element in order

### Section: EMAILS (y ~231–330)

**Section header row**
- Background: #F2F4F7 (light gray)
- Label: "EMAILS" — uppercase, ~11pt, #8A9BB0, font-weight 600, 16pt left padding, 10pt vertical padding

**Email row**
- Background: #FFFFFF
- Left: "derekwinchell@gmail.com" — ~16pt, #1A2332 (dark near-black), regular weight, 16pt left padding, vertically centered ~52pt tall row
- Right: circular icon button — #4A9FD8 fill, ~34pt diameter, white envelope/mail icon (~18pt), 16pt right padding
- Tap left text: [INFERRED] copies email or opens compose sheet
- Tap icon: opens compose email sheet pre-addressed to derekwinchell@gmail.com
- Bottom divider: 1pt #E8ECF0

---

### Section: RELATIONSHIPS (y ~330–440)

**Section header row**
- Background: #F2F4F7
- Label: "RELATIONSHIPS" — same style as EMAILS header

**Add row**
- Background: #FFFFFF
- Text: "Add Relationship..." — #4A9FD8 (FUB blue link color), ~16pt regular, 16pt left padding, ~48pt row height
- No right-side element
- Tap: [INFERRED] opens a search/picker sheet to link this contact to another contact as a relationship (spouse, co-borrower, referral, etc.)
- No divider visible below (section gap used instead)

---

### Section: DETAILS (y ~440–780+)

**Section header row**
- Background: #F2F4F7
- Label: "DETAILS"

Each detail row follows the same anatomy:
- Row height: ~52pt
- Background: #FFFFFF
- Left: field label — ~15pt, #9EB0C0 (light blue-gray), regular weight, 16pt left padding
- Right: value text + chevron `>` — value ~15–16pt, #1A2332, right-aligned; chevron ~#B0BCC8, 16pt right padding
- Exception: action-colored values use #4A9FD8 (blue) instead of #1A2332
- Bottom: 1pt hairline divider #E8ECF0 (full width)

**Rows in order (verbatim text):**

| # | Label | Value | Value color | Tappable |
|---|---|---|---|---|
| 1 | Assigned to | Matt Ryan | #1A2332 | Yes → broker picker sheet |
| 2 | Stage | Lead | #1A2332 | Yes → stage picker |
| 3 | Source | Ryan-Realty.com | #1A2332 | Yes → source picker |
| 4 | My Agent status | Send Invite | #4A9FD8 (blue action) | Yes → sends FUB agent invite to contact |
| 5 | Tags | auto:brand-voice:plain-honest, auto:se… | #1A2332 (truncated with ellipsis) | Yes → tag manager sheet |
| 6 | Time frame | (empty — no value) | — | Yes → time-frame picker |
| 7 | Collaborators | No collabora… (truncated, FAB overlaps) | #1A2332 | Yes → collaborator picker |

---

### Section: FINANCING (y ~800+, partially visible)

**Section header row** (just visible at bottom of screen)
- Background: #F2F4F7
- Label: "FINANCING" — same style as above sections
- Content rows scroll into view below (not visible in capture)

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / nav / sub-tab bg | ~#3D5467 (dark teal-slate) |
| Active tab text | #FFFFFF |
| Active tab underline | #4A9FD8 (FUB teal-blue) |
| Inactive tab text | #8A9BB0 |
| Contact name (hero) | #FFFFFF |
| Contact subtitle (hero) | ~#9EB0C0 |
| Section header bg | ~#F2F4F7 |
| Section header text | ~#8A9BB0, uppercase, ~11pt, weight 600 |
| Field label text | ~#9EB0C0, ~15pt, regular |
| Field value text (default) | ~#1A2332, ~15–16pt, regular |
| Field value (action/link) | #4A9FD8 |
| Row divider | ~#E8ECF0, 1pt |
| Chevron `>` | ~#B0BCC8 |
| FAB bg | #4A9FD8 |
| FAB icon | #FFFFFF |
| Email action icon bg | #4A9FD8 |
| Email action icon glyph | #FFFFFF envelope |
| Content area bg | #FFFFFF |
| Font family | SF Pro (iOS system) |
| Hero name size | ~22pt semibold |
| Field label/value size | ~15–16pt regular |
| Section header size | ~11pt semibold uppercase |

---

## Interactions & gestures [INFERRED unless stated]

| Gesture / Target | Action |
|---|---|
| Tap back chevron `<` | Pop nav stack → return to People list |
| Tap "Edit" (top right) | Enter edit mode: fields become editable inputs; "Edit" becomes "Done" / "Cancel" |
| Tap email row (text area) | Copy email to clipboard OR open action sheet (Copy / Send Email / Cancel) |
| Tap email envelope icon | Open compose-email sheet pre-filled with this contact's email |
| Tap "Add Relationship..." | Open search sheet to link a related contact |
| Tap any DETAILS row | Open picker/editor sheet for that field (stage, source, assigned agent, tags, time frame, collaborators) |
| Tap "Send Invite" (My Agent status) | [INFERRED] triggers FUB agent app invitation to contact's email |
| Tap "Tags" row | Open tag picker / tag input sheet; shows full tag list (truncated in row) |
| Tap sub-tab (Comms / Homes / Notes / Calen…) | Switch content pane to that tab without re-pushing |
| Swipe left on content rows | [INFERRED] may expose swipe actions (e.g., delete, edit) — standard iOS pattern |
| Pull to refresh (content area) | [INFERRED] re-fetches contact data from FUB API |
| Tap FAB `+` | Open quick-action sheet (options: Log Call, Send Email, Send Text, Add Task, Add Note, Add Appointment — typical FUB quick-add) |
| Scroll content area | Reveals more DETAILS rows + FINANCING section + any sections below |
| Horizontal scroll on sub-tab strip | Reveals additional tabs (Tasks, Files, etc.) |

---

## Build notes (component tree)

```
<MobileShell bg="#3D5467">

  <StatusBar time="4:58" textColor="white" bgColor="#3D5467" />

  <TopBar bgColor="#3D5467">
    <BackButton icon="chevron-left" color="white" onTap={popNavStack} />
    <Spacer />
    <TextButton label="Edit" color="white" size={17} onTap={enterEditMode} />
  </TopBar>

  <ContactHero bgColor="#3D5467" px={16} py={12}>
    <Avatar
      src={contact.photoUrl}
      size={72}
      shape="circle"
      fallback={initials}
    />
    <VStack ml={14} justify="center">
      <Text style="hero-name" color="white" size={22} weight={600}>
        Derek Winchell
      </Text>
      <Text style="hero-subtitle" color="#9EB0C0" size={14}>
        No communication yet
      </Text>
    </VStack>
  </ContactHero>

  <SubTabStrip
    bgColor="#3D5467"
    activeColor="white"
    inactiveColor="#8A9BB0"
    indicatorColor="#4A9FD8"
    indicatorHeight={3}
    scrollable
    tabs={["Info", "Comms", "Homes", "Notes", "Calendar", "Tasks", "Files"]}
    activeTab="Info"
    onTabChange={switchTab}
  />

  <ScrollView flex={1} bgColor="#F2F4F7">

    {/* EMAILS SECTION */}
    <SectionHeader label="EMAILS" />
    <DetailSection bgColor="white">
      <EmailRow
        email="derekwinchell@gmail.com"
        onTapText={copyOrComposeEmail}
        onTapIcon={openComposeSheet}
        iconBg="#4A9FD8"
        iconGlyph="envelope"
      />
    </DetailSection>

    {/* RELATIONSHIPS SECTION */}
    <SectionHeader label="RELATIONSHIPS" />
    <DetailSection bgColor="white">
      <LinkRow
        label="Add Relationship..."
        color="#4A9FD8"
        onTap={openRelationshipSearch}
      />
    </DetailSection>

    {/* DETAILS SECTION */}
    <SectionHeader label="DETAILS" />
    <DetailSection bgColor="white">
      <DetailRow
        label="Assigned to"
        value="Matt Ryan"
        onTap={() => openPicker("assigned_to")}
      />
      <DetailRow
        label="Stage"
        value="Lead"
        onTap={() => openPicker("stage")}
      />
      <DetailRow
        label="Source"
        value="Ryan-Realty.com"
        onTap={() => openPicker("source")}
      />
      <DetailRow
        label="My Agent status"
        value="Send Invite"
        valueColor="#4A9FD8"
        onTap={sendAgentInvite}
      />
      <DetailRow
        label="Tags"
        value="auto:brand-voice:plain-honest, auto:se…"
        truncate
        onTap={openTagSheet}
      />
      <DetailRow
        label="Time frame"
        value=""
        onTap={() => openPicker("time_frame")}
      />
      <DetailRow
        label="Collaborators"
        value="No collaborators"
        truncate
        onTap={() => openPicker("collaborators")}
        isLast
      />
    </DetailSection>

    {/* FINANCING SECTION — partially visible, more rows below */}
    <SectionHeader label="FINANCING" />
    {/* financing rows scroll into view */}

  </ScrollView>

  <FAB
    icon="plus"
    bgColor="#4A9FD8"
    iconColor="white"
    size={58}
    position="bottom-right"
    bottom={24}
    right={16}
    onTap={openQuickActionSheet}
  />

</MobileShell>
```

### Component specs

**`<SectionHeader>`**
- Height: ~36pt
- bg: #F2F4F7
- Text: uppercase, 11pt, weight 600, color #8A9BB0
- Padding: 16pt left, 10pt top/bottom

**`<DetailRow>`**
- Height: ~52pt
- bg: #FFFFFF
- Label: 15pt regular #9EB0C0, left-aligned, 16pt left padding
- Value: 15pt regular #1A2332 (or #4A9FD8 for action values), right-aligned, 16pt right padding
- Chevron: `>` glyph, ~12pt, #B0BCC8, 8pt left of right padding
- Bottom divider: 1pt #E8ECF0 (omit on `isLast`)
- Full row is tappable (tap target covers entire row)

**`<EmailRow>`**
- Height: ~52pt
- Email text: 16pt regular #1A2332, 16pt left
- Right icon: 34pt circle, bg #4A9FD8, envelope icon white 18pt; 16pt right edge

**`<LinkRow>`**
- Height: ~48pt
- Text: 16pt #4A9FD8, 16pt left padding
- No chevron

**`<SubTabStrip>` data binding:**
```ts
interface SubTab {
  id: string;        // "info" | "comms" | "homes" | "notes" | "calendar" | ...
  label: string;     // display label
  active: boolean;
}
```

**Data bindings for `<DetailRow>` values:**
```ts
contact.assignedAgent.name       // "Matt Ryan"
contact.stage                    // "Lead"
contact.source                   // "Ryan-Realty.com"
contact.agentPortalStatus        // "Send Invite" / "Accepted" / etc.
contact.tags.join(", ")         // "auto:brand-voice:plain-honest, auto:se..."
contact.timeFrame                // "" (empty)
contact.collaborators            // []  → "No collaborators"
```
