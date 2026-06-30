<!-- Mobile per-screen appendix. Original: IMG_5837.PNG | id: mob-16 | tiles: mob-tiles/mob-16_{full,t,m,b}.png -->

# mob-16 — fub-ios — Contact Detail / Info Tab (Doug Millard)

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app — dark slate/teal header, initials avatar, FUB-style section layout with "TEXT ALL..." / "EMAIL ALL..." bulk-action links, purple SMS + green call + sky-blue email FABs)
- **module:** Contact Detail (Lead Profile) — Info tab
- **screen:** Full contact info view for Doug Millard, showing phone numbers, emails, relationships, and detail fields. The "Info" sub-tab is active.
- **how to reach:** Tap any lead row in the People tab (or from Inbox/Activity thread) → push to Contact Detail; defaults to Info tab.
- **iOS status bar:** Time "4:34" left; signal bars (2 of 4 filled), WiFi icon, battery "100" with plug icon — all white on dark header.
- **URL:** N/A (native app, not web).

---

## Screen regions (y-bands, 390×844 pt logical)

| Region | y-band (approx pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–50 | 50 pt | #2d4455 (dark slate/teal) |
| Nav bar (back + Edit) | 50–94 | 44 pt | #2d4455 |
| Contact hero (avatar + name + subtitle) | 94–178 | 84 pt | #2d4455 |
| Sub-tab strip (Info / Comms / Homes / Notes / Calen…) | 178–220 | 42 pt | #2d4455 |
| Scrollable content area | 220–844+ | fills rest | #f5f6f8 (section headers) / #ffffff (rows) |
| PHONE NUMBERS section header | 220–248 | 28 pt | #eef0f4 |
| Phone number rows (×3) | 248–390 | ~48 pt each | #ffffff |
| EMAILS section header | 390–418 | 28 pt | #eef0f4 |
| Email rows (×3) | 418–560 | ~48 pt each | #ffffff |
| RELATIONSHIPS section header | 560–588 | 28 pt | #eef0f4 |
| Relationship row (Charise Millard) | 588–636 | 48 pt | #ffffff |
| DETAILS section header | 636–664 | 28 pt | #eef0f4 |
| Detail rows (Assigned to, Stage) | 664–760 | ~48 pt each | #ffffff |
| FAB (+) | floats at ~y 760, right edge | 56 pt circle | #5b9bd5 (blue) |
| Bottom tab bar | below scroll / ~y 795–844 | ~49 pt | not visible in frame (nav-pushed detail view hides tab bar or is scrolled below) |

---

## Nav / header bar (exact)

- **Background:** #2d4455 (dark desaturated teal/slate — FUB brand navy-teal)
- **Left control:** Back chevron `<` — white, ~22 pt, taps to pop back to People list or previous screen
- **Center:** Empty (no title in the nav bar itself; the contact name appears in the hero block below)
- **Right control:** Text button "Edit" — white, regular weight, ~17 pt; taps to enter edit mode for this contact record

---

## Contact hero block (beneath nav bar, still dark bg)

- **Avatar:** Circle ~52 pt diameter, sage/muted green fill (~#5a8a6a), white initials "DM" bold ~18 pt centered; no photo (initials fallback)
- **Name:** "Doug Millard" — white, ~22 pt, semibold/medium weight; positioned right of avatar
- **Subtitle:** "Last communication Jan 3" — light gray (#a8b8c4), ~14 pt regular; one line below name
- **Layout:** Avatar left-aligned with 16 pt left margin; name + subtitle stack vertically, 12 pt left of avatar right edge

---

## Sub-tab strip (exact)

Still on the dark (#2d4455) header background. Horizontal scrollable strip.

| Order | Label | State |
|---|---|---|
| 1 | Info | **Active** — white text, 2 pt bright cyan/blue underline indicator (~#3dc7e8), full-width under the word |
| 2 | Comms | Inactive — muted gray text (~#7a9ab0) |
| 3 | Homes | Inactive — muted gray |
| 4 | Notes | Inactive — muted gray |
| 5 | Calen… (Calendar) | Inactive — truncated, scrolls right |

- Tab strip height: ~42 pt; labels ~15 pt medium
- Active underline: 2 pt thick, spans ~label width, bright teal-blue ~#3dc7e8
- Horizontally scrollable (more tabs may exist beyond "Calendar")

---

## Bottom tab bar

Not fully visible in this frame. This is a navigation-pushed detail view; in FUB iOS the bottom tab bar persists but may be scrolled out of view or occluded by the FAB. The standard FUB bottom tabs (based on app pattern) are: **Inbox / Activity / Calendar / People / Deals** — with People being the active parent tab from which this detail was pushed.

---

## Content — every element, in order

### PHONE NUMBERS section

**Section header row** (full-width, ~28 pt tall, bg #eef0f4):
- Left: "PHONE NUMBERS" — uppercase, ~11 pt, gray (#8a9db0), letter-spacing wide
- Right: "TEXT ALL..." — ~11 pt, teal/cyan (#3dc7e8), tappable; initiates bulk SMS to all phone numbers

**Phone row 1:**
- Left text: "5413504385" (no dashes) then " — " then "(mobile)" in lighter teal/cyan ~#7ab8c8
- Right: Two icon buttons flush right
  - SMS/chat bubble circle: ~36 pt, purple/periwinkle fill (~#7b7ec8), white speech bubble glyph
  - Phone circle: ~36 pt, green fill (~#3dc896), white phone handset glyph
- Divider: 1 pt #ebebeb hairline, full width, at bottom of row

**Phone row 2:**
- Left text: "541-388-1661 — (mobile)" (same color pattern as row 1)
- Right: same purple SMS + green call buttons
- Divider: 1 pt #ebebeb

**Phone row 3:**
- Left text: "5415985219 — Charise Millard (mo..." (truncated; "(mo..." = "(mobile)" attributed to Charise Millard, a related contact whose number is stored here)
- Right: same purple SMS + green call buttons
- Note: this entry links a phone number owned by a related contact (Charise Millard)

---

### EMAILS section

**Section header row** (bg #eef0f4):
- Left: "EMAILS" — uppercase, ~11 pt, gray (#8a9db0)
- Right: "EMAIL ALL..." — ~11 pt, teal/cyan (#3dc7e8), tappable; opens compose to all email addresses

**Email row 1:**
- Left text: "millarddouglas@gmail.com" — dark charcoal (~#2d3d4e), ~15 pt regular
- Right: Sky-blue circle ~36 pt (#4ab8e8), white envelope/letter glyph
- Divider: 1 pt #ebebeb

**Email row 2:**
- Left text: "Doug.Millard@bendresearch.com" — same style
- Right: Same sky-blue email circle
- Divider: 1 pt #ebebeb

**Email row 3:**
- Left text: "millardcharise@gmail.com — Charise Mill..." (truncated; this email belongs to related contact Charise Millard)
- Right: Same sky-blue email circle

---

### RELATIONSHIPS section

**Section header row** (bg #eef0f4):
- Left: "RELATIONSHIPS" — uppercase, ~11 pt, gray (#8a9db0)
- Right: "+" icon button — teal/blue (~#4ab8e8), ~20 pt; taps to add a new relationship link

**Relationship row:**
- Full-width tappable row (~48 pt tall, bg #ffffff)
- Text: "Charise Millard" — dark charcoal, ~16 pt regular
- Right: Chevron `>` (~#c0c8d0), indicates navigation to Charise Millard's own contact detail
- No divider below (next section header follows)

---

### DETAILS section

**Section header row** (bg #eef0f4):
- Left: "DETAILS" — uppercase, ~11 pt, gray (#8a9db0)
- No right action on this section header

**Detail row 1 — Assigned to:**
- Left label: "Assigned to" — muted gray (#a0b0bc), ~14 pt regular (lighter weight than value)
- Right value: "Matt Ry..." (truncated — "Matt Ryan") — dark charcoal, ~14–15 pt; right chevron `>` follows, indicating tappable/editable
- Divider: 1 pt #ebebeb

**Detail row 2 — Stage:**
- Left label: "Stage" — muted gray (#a0b0bc), ~14 pt regular
- Right value: "Past Client" — dark charcoal, ~14–15 pt; right chevron `>`
- No divider below visible

---

### Floating Action Button (FAB)

- **Shape:** Circle, ~56 pt diameter
- **Color:** Medium blue (#5b9bd5)
- **Icon:** White "+" plus glyph, ~24 pt, centered
- **Position:** Bottom-right of viewport, approximately 16 pt from right edge, 16 pt from bottom of visible content area; floats above scroll content
- **Tap action [INFERRED]:** Opens an action sheet or quick-add menu (add note, add task, log call, send email, etc.)

---

## Colors, type & iconography

| Element | Color (hex estimate) |
|---|---|
| Header / nav / hero / tab strip bg | #2d4455 (dark slate-teal) |
| Active tab underline | #3dc7e8 (bright cyan-teal) |
| "TEXT ALL..." / "EMAIL ALL..." links | #3dc7e8 |
| Relationships "+" button | #4ab8e8 (sky blue) |
| SMS button circle fill | #7b7ec8 (periwinkle/purple) |
| Call button circle fill | #3dc896 (teal-green) |
| Email button circle fill | #4ab8e8 (sky blue) |
| FAB fill | #5b9bd5 (medium blue) |
| Section header bg | #eef0f4 (light blue-gray) |
| Row bg | #ffffff |
| Row dividers | #ebebeb (1 pt hairline) |
| Contact name (white on dark) | #ffffff |
| Last-communication subtitle | #a8b8c4 |
| Phone number text (main number) | #2d3d4e (dark charcoal) |
| Phone type label "(mobile)" | #7ab8c8 (muted teal) |
| Email text | #2d3d4e |
| Section label text | #8a9db0 (medium gray, uppercase) |
| Detail row label ("Assigned to", "Stage") | #a0b0bc (lighter muted gray) |
| Detail row value ("Matt Ryan", "Past Client") | #2d3d4e |
| Chevron `>` | #c0c8d0 |
| Active tab label | #ffffff |
| Inactive tab label | #7a9ab0 |

**Typography impressions:**
- Contact name: ~22 pt, weight 500–600 (semibold), white
- Sub-tab labels: ~15 pt, weight 400 inactive / 600 active
- Section headers: ~11 pt, uppercase, weight 600, wide letter-spacing (~0.08em)
- Row primary text (numbers/emails): ~15 pt, weight 400, #2d3d4e
- Row label text (Details section): ~14 pt, weight 400, muted gray
- "TEXT ALL..." / "EMAIL ALL...": ~11 pt, uppercase, weight 600, teal

**Iconography:**
- SMS icon: filled speech bubble with ellipsis dots inside, white on purple circle
- Call icon: filled phone handset, white on teal-green circle
- Email icon: filled envelope outline, white on sky-blue circle
- Back nav: plain chevron `<`, white
- Chevron `>` rows: system gray disclosure indicator
- FAB: plus `+` cross, white on blue circle

---

## Interactions & gestures [INFERRED]

- **Back chevron tap:** Pop navigation stack → returns to People list (or Inbox thread if entered from there)
- **"Edit" tap:** Transitions detail view to edit mode; fields become editable inputs; button changes to "Done" / "Cancel"
- **Sub-tab tap (Comms, Homes, Notes, Calendar):** Swaps content area to that tab; maintains same dark header + hero block; active underline slides
- **Sub-tab horizontal scroll:** Reveals additional tabs beyond visible viewport
- **"TEXT ALL..." tap:** Opens compose SMS sheet pre-addressed to all phone numbers
- **"EMAIL ALL..." tap:** Opens compose email sheet pre-addressed to all email addresses
- **Purple SMS circle tap (per row):** Opens SMS compose to that specific number
- **Green call circle tap (per row):** Initiates phone call to that number via iOS dialer
- **Sky-blue email circle tap (per row):** Opens email compose to that address
- **Relationship row tap ("Charise Millard"):** Pushes Contact Detail view for Charise Millard
- **RELATIONSHIPS "+" tap:** Presents search/picker sheet to link another contact as a relationship
- **"Assigned to" row tap:** Presents agent/user picker sheet to reassign contact
- **"Stage" row tap:** Presents stage picker sheet (pipeline stage selector)
- **FAB "+" tap:** Presents action sheet with quick-create options (Add Note, Add Task, Log Activity, etc.)
- **Pull-to-refresh:** Refreshes contact data from FUB backend
- **Long-press phone/email rows:** [INFERRED] May reveal copy-to-clipboard option

---

## Build notes (component tree)

```
<MobileShell bg="#2d4455">

  <StatusBar textColor="white" />

  <NavBar bg="#2d4455">
    <BackButton icon="chevron-left" color="#ffffff" onTap={popNav} />
    {/* no center title */}
    <TextButton label="Edit" color="#ffffff" size={17} onTap={enterEditMode} />
  </NavBar>

  <ContactHero bg="#2d4455" px={16} py={12}>
    <Avatar
      size={52}
      bg="#5a8a6a"
      initials="DM"
      initialsColor="#ffffff"
      initialsSize={18}
    />
    <VStack ml={12} gap={4}>
      <Text size={22} weight={600} color="#ffffff">Doug Millard</Text>
      <Text size={14} weight={400} color="#a8b8c4">Last communication Jan 3</Text>
    </VStack>
  </ContactHero>

  <HorizontalTabStrip
    bg="#2d4455"
    activeUnderlineColor="#3dc7e8"
    activeUnderlineHeight={2}
    tabs={[
      { label: "Info", active: true },
      { label: "Comms" },
      { label: "Homes" },
      { label: "Notes" },
      { label: "Calendar" },
      /* additional tabs scrollable */
    ]}
    labelSize={15}
    activeLabelColor="#ffffff"
    inactiveLabelColor="#7a9ab0"
    scrollable={true}
  />

  <ScrollView bg="#f5f6f8">

    {/* PHONE NUMBERS */}
    <SectionHeader
      label="PHONE NUMBERS"
      actionLabel="TEXT ALL..."
      actionColor="#3dc7e8"
      onActionTap={textAll}
      bg="#eef0f4"
    />

    <PhoneRow
      number="5413504385"
      type="mobile"
      typeColor="#7ab8c8"
      onSMS={openSMS}
      onCall={initiateCall}
      smsButtonBg="#7b7ec8"
      callButtonBg="#3dc896"
    />
    <RowDivider />
    <PhoneRow
      number="541-388-1661"
      type="mobile"
      typeColor="#7ab8c8"
      onSMS={openSMS}
      onCall={initiateCall}
      smsButtonBg="#7b7ec8"
      callButtonBg="#3dc896"
    />
    <RowDivider />
    <PhoneRow
      number="5415985219"
      attribution="Charise Millard"
      type="mobile"
      typeColor="#7ab8c8"
      truncateAttribution={true}
      onSMS={openSMS}
      onCall={initiateCall}
      smsButtonBg="#7b7ec8"
      callButtonBg="#3dc896"
    />

    {/* EMAILS */}
    <SectionHeader
      label="EMAILS"
      actionLabel="EMAIL ALL..."
      actionColor="#3dc7e8"
      onActionTap={emailAll}
      bg="#eef0f4"
    />

    <EmailRow
      email="millarddouglas@gmail.com"
      buttonBg="#4ab8e8"
      onCompose={openEmailCompose}
    />
    <RowDivider />
    <EmailRow
      email="Doug.Millard@bendresearch.com"
      buttonBg="#4ab8e8"
      onCompose={openEmailCompose}
    />
    <RowDivider />
    <EmailRow
      email="millardcharise@gmail.com"
      attribution="Charise Mill..."
      buttonBg="#4ab8e8"
      onCompose={openEmailCompose}
    />

    {/* RELATIONSHIPS */}
    <SectionHeader
      label="RELATIONSHIPS"
      actionIcon="plus"
      actionColor="#4ab8e8"
      onActionTap={addRelationship}
      bg="#eef0f4"
    />

    <NavigationRow
      label="Charise Millard"
      chevron={true}
      onTap={() => pushContactDetail("Charise Millard")}
    />

    {/* DETAILS */}
    <SectionHeader
      label="DETAILS"
      bg="#eef0f4"
    />

    <DetailRow
      label="Assigned to"
      labelColor="#a0b0bc"
      value="Matt Ryan"
      valueTruncated={true}
      chevron={true}
      onTap={openAgentPicker}
    />
    <RowDivider />
    <DetailRow
      label="Stage"
      labelColor="#a0b0bc"
      value="Past Client"
      chevron={true}
      onTap={openStagePicker}
    />

  </ScrollView>

  <FAB
    icon="plus"
    bg="#5b9bd5"
    iconColor="#ffffff"
    size={56}
    position="bottom-right"
    margin={16}
    onTap={openQuickAddSheet}
  />

</MobileShell>
```

### Row anatomy specifics

**PhoneRow** (height ~48 pt):
- Left: number string (charcoal, 15 pt, weight 400) + " — " separator + type label (teal-muted, 15 pt, truncated if needed)
- Right: two icon circles, 36 pt diameter each, 8 pt gap between, 12 pt right margin
  - Circle 1: purple (#7b7ec8) with white speech-bubble-dots SVG (SMS)
  - Circle 2: green (#3dc896) with white phone-handset SVG (Call)
- Tappable zone per icon circle: 44 pt minimum touch target
- Row bg: #ffffff
- No left avatar/icon

**EmailRow** (height ~48 pt):
- Left: email address string (charcoal, 15 pt), optional "— Name" suffix in same color if attributed
- Right: single sky-blue circle (36 pt, #4ab8e8) with white envelope icon
- 12 pt right margin

**SectionHeader** (height ~28 pt):
- bg: #eef0f4
- Label: uppercase, 11 pt, weight 600, #8a9db0, left-padded 16 pt
- Action: right-aligned, 11–13 pt, uppercase if text, teal color, 16 pt right margin

**DetailRow** (height ~48 pt):
- Label: left, ~14 pt, weight 400, #a0b0bc (muted gray)
- Value: right of center, ~14–15 pt, weight 400, #2d3d4e
- Chevron: far right, ~#c0c8d0
- Divider: 1 pt #ebebeb, full width, at bottom
- Both label and value are 16 pt from respective edges

**NavigationRow** (height ~48 pt):
- Primary text: left, 16 pt, #2d3d4e
- Chevron: far right
- Full row is tappable

### Data bindings
- `contact.fullName` → hero name + avatar initials
- `contact.lastCommunicationDate` → hero subtitle
- `contact.phoneNumbers[]` → PhoneRow list (number, type, ownerName if relationship)
- `contact.emailAddresses[]` → EmailRow list (address, ownerName if relationship)
- `contact.relationships[]` → NavigationRow list (each pushes to that contact's detail)
- `contact.assignedAgentName` → Detail row value for "Assigned to"
- `contact.stage` → Detail row value for "Stage"
