<!-- Mobile per-screen appendix. Original: IMG_5823.PNG | id: mob-03 | tiles: mob-tiles/mob-03_{full,t,m,b}.png -->

# mob-03 — fub-ios — Contact Detail: Info Tab (Andy Christensen)

## Identity

- **app_source:** fub-ios (Follow Up Boss native iPhone app — confirmed by dark teal/slate header, "Edit" nav button, sub-tab strip pattern, "TRANSFER TO LENDER" action, and FUB-specific inquiry icon style; no browser chrome present)
- **module:** Contact Detail (Lead Profile)
- **screen:** Info tab of a contact/lead detail view for "Andy Christensen"
- **how to reach:** People tab (bottom tab bar) → tap any contact row → Info tab is the default active tab on push
- **iOS status bar:** time "4:32" left; signal bars (2 of 4 filled) + WiFi icon + battery "100" with charging indicator — all white, on dark header background
- **URL bar:** N/A — native iOS app, no browser

---

## Screen regions (top → bottom, ~390×844pt logical canvas)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–44 | 44 | #354B5E (dark slate-blue, same as header) |
| Nav / header bar | 44–88 | 44 | #354B5E |
| Profile identity block | 88–188 | 100 | #354B5E |
| Sub-tab strip | 188–232 | 44 | #354B5E (bottom border: 1px #2A3E4E) |
| Scrollable content area | 232–812 | 580 | #EEF1F5 (section headers) / #FFFFFF (rows) |
| FAB overlay | — | — | Floating over content, bottom-right |
| Bottom home indicator | 812–844 | 32 | #EEF1F5 (no tab bar visible — detail push hides it) |

---

## Nav / header bar (exact)

- **Left control:** Back chevron `<` — white, ~20pt, standard iOS back chevron glyph, tappable — pops back to People list
- **Center:** empty (no title text in the nav bar itself; identity is in the profile block below)
- **Right control:** "Edit" — white text button, ~17pt regular weight — taps into edit mode for the contact record

---

## Bottom tab bar

**Not visible on this screen.** FUB iOS hides the bottom tab bar on pushed detail views (standard iOS navigation stack behavior). Back navigation uses the `<` chevron in the nav bar. No FAB replaces it — the FAB here is contextual (see below).

---

## Sub-tab strip (exact)

Horizontally scrollable strip of named tabs, sitting directly below the profile identity block, on the same dark (#354B5E) background.

| Position | Label | State | Indicator |
|---|---|---|---|
| 1 | **Info** | ACTIVE | Blue underline bar ~3pt tall, color ~#29A8D8, full label width |
| 2 | Comms | inactive | No underline; muted grey text ~#9AABB8 |
| 3 | Homes | inactive | No underline; muted grey |
| 4 | Notes | inactive | No underline; muted grey |
| 5 | Calen… | inactive (truncated — "Calendar") | No underline; muted grey; partially clipped at right edge |

Active tab label text color: white (#FFFFFF).
Inactive tab label text color: ~#9AABB8 (medium grey, desaturated).
Tab font: ~15pt, regular weight.
No badge counts on any tab.

---

## Profile identity block (exact)

Sits between nav bar and sub-tab strip, on the dark header background.

- **Avatar:** Circle, ~52pt diameter, burnt-orange fill (~#B5651D), white initials "AC" centered, ~20pt bold — initials generated from first+last name
- **Primary name:** "Andy Christensen" — white, ~22pt, semibold, left of avatar (avatar left-aligned ~16pt from screen edge, name to its right)
- **Subtitle:** "No communication yet" — ~14pt, muted grey (~#9AABB8), directly below name; indicates no email/call/text has been logged yet

---

## Floating Action Button (FAB)

- **Shape:** Circle, ~56pt diameter
- **Color:** ~#29A8D8 (FUB teal-blue accent, same as active tab underline and link text)
- **Icon:** White "+" (plus) glyph, centered, ~24pt
- **Position:** Fixed bottom-right of the scrollable content area, ~16pt from right edge, ~16pt from bottom of visible content
- **Action [INFERRED]:** Opens a quick-add sheet — options likely include: Add Note, Log Call, Send Email, Send Text, Schedule, Add Task

---

## Content — every element in order

All content below y≈232pt scrolls vertically. Background rhythm alternates: light-grey section header rows (#EEF1F5) and white content rows (#FFFFFF).

---

### Section 1 — DETAILS

**Section header row:**
- Label: "DETAILS"
- Style: uppercase, ~11pt, semibold, color ~#8A9BAA (medium-dark grey), background #EEF1F5, ~36pt tall, 16pt left padding

**Row 1.1 — Time frame**
- Layout: label left + chevron right
- Left label: "Time frame" — ~16pt, grey placeholder color ~#9AABB8 (no value set)
- Right: ">" chevron — grey, ~14pt
- Background: #FFFFFF
- Height: ~52pt
- Bottom divider: 1px #E8EDF2 (inset ~16pt from left)
- Tap: opens time-frame picker (inferred: sheet or push with options like "Now", "1–3 months", "3–6 months", "6–12 months", "12+ months")

**Row 1.2 — Collaborators**
- Layout: label left + value + chevron right
- Left label: "Collaborators" — ~16pt, grey placeholder ~#9AABB8
- Right value: "No collaborators" — ~16pt, dark/black text (~#1A2B38), bold
- Right: ">" chevron — grey
- Background: #FFFFFF
- Height: ~52pt
- No bottom divider (section ends here, gap before next section)
- Tap: opens collaborators list/picker — add agents to this lead

---

### Section 2 — FINANCING

**Section header row:**
- Label: "FINANCING"
- Style: same as DETAILS header (uppercase, ~11pt, semibold, grey on #EEF1F5)

**Row 2.1 — Lender**
- Layout: label left + action link right
- Left label: "Lender" — ~16pt, grey placeholder ~#9AABB8 (no lender assigned)
- Right: "TRANSFER TO LENDER >" — uppercase, ~13pt, semibold, FUB teal-blue accent ~#29A8D8, followed by ">" chevron in same color
- Background: #FFFFFF
- Height: ~52pt
- Tap: initiates lender referral transfer action (FUB-specific workflow for referring the lead to a lending partner)

---

### Section 3 — BACKGROUND

**Section header row:**
- Label: "BACKGROUND"
- Style: same header pattern

**Row 3.1 — Add background**
- Layout: placeholder prompt full-width + chevron right
- Left: "Add background" — ~16pt, teal-blue accent ~#29A8D8 (acts as a link/empty-state prompt)
- Right: ">" chevron — grey
- Background: #FFFFFF
- Height: ~52pt
- Tap: opens background text input field (free-form notes on the lead's situation)

---

### Section 4 — INQUIRIES

**Section header row:**
- Label: "INQUIRIES"
- Style: same header pattern

**Row 4.1 — General Inquiry**
- Layout: icon left + two-line text block + date + chevron right
- **Left icon:** Two overlapping speech-bubble glyphs, ~24×24pt — larger bubble (right) teal-green (~#4CAF94), smaller bubble (left) lighter green, overlapping — FUB's "general inquiry" / web-form source icon
- **Primary text:** "General Inquiry" — ~16pt, dark (#1A2B38), regular weight
- **Secondary text:** "via: Ryan-Realty.com" — ~13pt, muted grey ~#9AABB8, below primary
- **Right date:** "6/19/26, 10:58am" — ~13pt, grey ~#9AABB8, right-aligned
- **Right chevron:** ">" grey
- Background: #FFFFFF
- Height: ~64pt (two-line row)
- Tap: pushes to inquiry detail view — shows full form submission content

---

### Section 5 — CUSTOM FIELDS

**Section header row:**
- Label: "CUSTOM FIELDS"
- Style: same header pattern

**Row 5.1 — Add Custom Fields...**
- Layout: full-width link text
- Left: "Add Custom Fields..." — ~16pt, teal-blue accent ~#29A8D8 (link/CTA)
- No right chevron
- Background: #FFFFFF
- Height: ~52pt
- Tap: navigates to custom fields configuration or adds a new custom field

**Below this row:** additional light-grey (#EEF1F5) padding/space to the bottom of the screen, ~80pt of empty space before the home indicator area

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / nav / tab strip bg | ~#354B5E (dark slate blue — FUB signature dark teal) |
| Active tab underline | ~#29A8D8 (FUB teal-blue) |
| Active tab label text | #FFFFFF |
| Inactive tab label | ~#9AABB8 |
| Avatar fill (Andy Christensen) | ~#B5651D (burnt orange — auto-generated from name hash) |
| Avatar initials text | #FFFFFF |
| Contact name text | #FFFFFF |
| Contact subtitle text | ~#9AABB8 |
| Section header bg | ~#EEF1F5 |
| Section header text | ~#8A9BAA (uppercase, ~11pt, semibold) |
| Content row bg | #FFFFFF |
| Row divider | ~1px #E8EDF2 (inset 16pt from left) |
| Field label text (no value) | ~#9AABB8 (~16pt, regular) |
| Field value text (set) | ~#1A2B38 (~16pt, regular/bold) |
| Accent / link / action text | ~#29A8D8 (teal-blue — "TRANSFER TO LENDER", "Add background", "Add Custom Fields...") |
| Chevron ">" glyphs | ~#C5CDD5 (light grey) |
| Date/meta text | ~#9AABB8 (~13pt, regular) |
| FAB bg | ~#29A8D8 |
| FAB icon | #FFFFFF |
| Inquiry bubble icon | Teal-green ~#4CAF94 gradient/flat |
| "TRANSFER TO LENDER" text | ~#29A8D8 uppercase semibold |
| Font weight scheme | System San Francisco — 22pt semibold (name), 15pt regular (tabs), 16pt regular (row labels/values), 11pt semibold (section headers), 13pt regular (meta/date) |

**Note:** FUB accent is teal-blue (~#29A8D8), NOT the in-house Ryan Realty navy (#102742) / cream (#faf8f4) system. This is the native FUB iOS app.

---

## Interactions & gestures

- **Tap `<` (back chevron):** Pop detail view, return to People/contacts list [INFERRED]
- **Tap "Edit" (top right):** Switch detail view into edit mode — all field values become editable inputs [INFERRED]
- **Swipe left on any row:** Reveal destructive swipe action (delete/remove) for rows that support it [INFERRED]
- **Scroll vertically:** Entire content area below sub-tab strip scrolls; header identity block + sub-tab strip remain sticky [INFERRED]
- **Tap sub-tab (Comms / Homes / Notes / Calendar):** Swaps content area to that tab's content; pushes no new screen — in-place tab swap [INFERRED]
- **Tap "Time frame" row:** Presents picker sheet (modal bottom sheet with options) [INFERRED]
- **Tap "Collaborators" row:** Pushes collaborator management screen [INFERRED]
- **Tap "TRANSFER TO LENDER":** Opens lender transfer workflow (possibly an action sheet with lender partner options) [INFERRED]
- **Tap "Add background" row:** Pushes or presents text input for background notes [INFERRED]
- **Tap "General Inquiry" row:** Pushes inquiry detail — full form data, timestamp, source URL, IP [INFERRED]
- **Tap "Add Custom Fields...":** Pushes or presents custom field management UI [INFERRED]
- **Tap FAB "+":** Presents bottom action sheet with quick-add options (Note, Call, Email, Text, Task, Appointment) [INFERRED]
- **Pull to refresh:** Reloads contact data from FUB API [INFERRED]
- **Long-press on contact name/avatar:** No standard action in FUB; likely no-op [INFERRED]

---

## Build notes (component tree)

```
<MobileShell>

  <StatusBar
    time="4:32"
    signal={2}
    wifi={true}
    battery={100}
    textColor="white"
    bg="#354B5E"
  />

  <ContactDetailTopBar
    bg="#354B5E"
    leftControl={<BackChevron color="white" onTap={navigateBack} />}
    rightControl={<TextButton label="Edit" color="white" onTap={enterEditMode} />}
  />

  <ContactIdentityBlock
    bg="#354B5E"
    paddingX={16}
    paddingY={12}
  >
    <AvatarCircle
      size={52}
      initials="AC"
      bg="#B5651D"   {/* auto-derive from name hash */}
      textColor="white"
      textSize={20}
    />
    <Stack direction="vertical" gap={4}>
      <Text style="contactName" size={22} weight="semibold" color="white">
        Andy Christensen
      </Text>
      <Text style="contactSubtitle" size={14} weight="regular" color="#9AABB8">
        No communication yet
      </Text>
    </Stack>
  </ContactIdentityBlock>

  <SubTabStrip
    bg="#354B5E"
    activeIndicatorColor="#29A8D8"
    activeIndicatorHeight={3}
    tabs={[
      { label: "Info",     active: true  },
      { label: "Comms",    active: false },
      { label: "Homes",    active: false },
      { label: "Notes",    active: false },
      { label: "Calendar", active: false },
    ]}
    activeTextColor="white"
    inactiveTextColor="#9AABB8"
    textSize={15}
    scrollable={true}
  />

  <ScrollableContent bg="#EEF1F5">

    <SectionGroup>
      <SectionHeader label="DETAILS" />
      <FieldRow
        label="Time frame"
        value={null}
        showChevron={true}
        onTap={openTimeframePicker}
      />
      <FieldRow
        label="Collaborators"
        value="No collaborators"
        valueWeight="bold"
        showChevron={true}
        onTap={openCollaboratorsPicker}
      />
    </SectionGroup>

    <SectionGroup>
      <SectionHeader label="FINANCING" />
      <FieldRow
        label="Lender"
        value={null}
        actionLabel="TRANSFER TO LENDER"
        actionStyle="uppercase-link"
        actionColor="#29A8D8"
        showChevron={true}
        onTap={openLenderTransfer}
      />
    </SectionGroup>

    <SectionGroup>
      <SectionHeader label="BACKGROUND" />
      <FieldRow
        label="Add background"
        labelStyle="link"
        labelColor="#29A8D8"
        showChevron={true}
        onTap={openBackgroundInput}
      />
    </SectionGroup>

    <SectionGroup>
      <SectionHeader label="INQUIRIES" />
      <InquiryRow
        icon={<TwoSpeechBubblesIcon primaryColor="#4CAF94" size={24} />}
        primaryText="General Inquiry"
        secondaryText="via: Ryan-Realty.com"
        date="6/19/26, 10:58am"
        showChevron={true}
        onTap={openInquiryDetail}
      />
    </SectionGroup>

    <SectionGroup>
      <SectionHeader label="CUSTOM FIELDS" />
      <FieldRow
        label="Add Custom Fields..."
        labelStyle="link"
        labelColor="#29A8D8"
        showChevron={false}
        onTap={openCustomFieldsManager}
      />
    </SectionGroup>

    <Spacer height={80} />

  </ScrollableContent>

  <FloatingActionButton
    size={56}
    bg="#29A8D8"
    icon="plus"
    iconColor="white"
    position="bottom-right"
    offsetRight={16}
    offsetBottom={16}
    onTap={openQuickAddSheet}
  />

</MobileShell>
```

### Component sizing details

| Component | Size / Spacing |
|---|---|
| Status bar | 44pt tall |
| Nav bar | 44pt tall |
| Identity block | ~100pt tall (avatar 52pt + 12pt top pad + 12pt bottom pad) |
| Sub-tab strip | 44pt tall (indicator bar at bottom) |
| Section header rows | 36pt tall; text 11pt uppercase semibold; 16pt left pad |
| Standard field rows | 52pt tall; 16pt horizontal padding; label 16pt regular |
| Two-line inquiry row | 64pt tall (primary 16pt + secondary 13pt + 16pt padding) |
| Dividers | 1px, color #E8EDF2, inset 16pt from left |
| Avatar | 52×52pt circle; font 20pt bold |
| FAB | 56×56pt circle; icon ~24pt |

### Data bindings

- `contact.displayName` → name text + initials derivation + avatar color (hash of name → palette)
- `contact.lastCommunicationAt` → subtitle ("No communication yet" if null, else last comms timestamp)
- `contact.timeframe` → Time frame row value
- `contact.collaborators[]` → Collaborators row value ("No collaborators" if empty)
- `contact.lender` → Lender row value (null here)
- `contact.background` → Background row value (null here → shows "Add background")
- `contact.inquiries[]` → Inquiries section rows; each: `{ type, source, createdAt }`
- `contact.customFields[]` → Custom Fields section rows (empty here → shows "Add Custom Fields...")
