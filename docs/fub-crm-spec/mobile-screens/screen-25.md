<!-- Mobile per-screen appendix. Original: IMG_5987.PNG | id: mob-25 | tiles: mob-tiles/mob-25_{full,t,m,b}.png -->

# mob-25 — fub-ios — Contact Detail / Info Tab

## Identity

- **app_source:** fub-ios (native Follow Up Boss iPhone app)
- **module:** Contact Detail (Lead Profile)
- **screen:** Info sub-tab of a specific contact — Derek Winchell
- **how to reach:** People tab → tap any contact row → lands on Info sub-tab (or Activity/Inbox item → tap contact name)
- **iOS status bar:** 8:39 (time, left) | signal bars (2/4 filled) | WiFi icon | battery 37% with outline (right)
- **URL bar:** none — native iOS app

---

## Screen regions (top → bottom, y-bands on 390×844 pt logical screen)

| Region | y-band (pt) | Height (approx) | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | Dark slate ~#3d5a6b (matches header) |
| Nav bar | 54–104 | 50 pt | Dark slate ~#3d5a6b |
| Contact hero (avatar + name + subtitle) | 104–172 | 68 pt | Dark slate ~#3d5a6b |
| Sub-tab strip | 172–216 | 44 pt | Dark slate ~#3d5a6b |
| Scrollable content area | 216–844+ | fills remainder | White/light-gray alternating section rows |
| FAB (overlaid, fixed bottom-right) | ~700–756 | 56 pt diameter | Blue circle ~#5b9bc8 |
| Bottom tab bar | off-screen / scrolled under content | ~83 pt | Not visible in crop |

**Right-edge panel peek:** A dark charcoal/dark-gray vertical strip (~32 pt wide) is visible at the far right of the screen in the email row area. This is FUB's collapsed right-side "Quick Access" drawer (collapse/expand handle glyph `<`). It floats over the content.

---

## Nav / header bar (exact)

**Left control:** Back chevron `<` — white, ~20 pt, positioned ~16 pt from left edge. Taps to pop this view and return to the previous list (People list or wherever the user navigated from).

**Center:** Empty (no title text in the nav bar itself — the contact name is in the hero block below, not in the nav bar center).

**Right control:** Text button "Edit" — white, system font medium weight, ~17 pt. Taps to enter edit mode for this contact's fields.

---

## Contact hero block (below nav bar, same dark header bg)

- **Avatar:** Circular photo, ~52 pt diameter, ~16 pt from left edge, vertically centered in hero. Shows a real headshot photo of a man (Derek Winchell) in a suit. Circular crop with no border ring visible.
- **Name:** "Derek Winchell" — white, bold, ~20 pt, positioned to the right of the avatar (~72 pt from left edge). Single line.
- **Subtitle:** "No communication yet" — light gray/muted white ~#aab8c2, ~14 pt regular, on the line directly below the name.

---

## Sub-tab strip (exact)

Single horizontal scrollable tab row, same dark slate background. Tabs are text-only labels, lighter gray when inactive, white when active. Active tab has a solid teal/blue underline indicator (~2 pt high, full tab-label width).

| Position | Label | State |
|---|---|---|
| 1 | **Info** | ACTIVE — white text, blue-teal underline ~#4ab0d0 |
| 2 | Comms | Inactive — muted gray ~#8a9eaa |
| 3 | Homes | Inactive — muted gray |
| 4 | Notes | Inactive — muted gray |
| 5 | Calen(dar) | Inactive — truncated, muted gray (tab strip is scrollable right) |

Tab strip font: ~14–15 pt, system regular for inactive, medium for active. No icons — text only.

---

## Bottom tab bar

Not visible in this screenshot crop (content fills to bottom). Based on FUB iOS app structure, the standard bottom tab bar has: **Inbox | Activity | Calendar | People | Deals** with system icon glyphs. The People tab would be active (since we navigated from People). Unable to confirm from this crop — mark as [INFERRED].

**FAB:** Blue circle button (~56 pt diameter), positioned bottom-right (~334 pt from left, ~700 pt from top, fixed/overlay). Contains a white `+` glyph (~24 pt). Color: medium blue ~#5b9bc8. Tapping opens an action sheet or quick-add dialog (add note, task, appointment, etc.) [INFERRED].

---

## Content — every element, in order (scrollable area)

The content area uses a grouped UITableView-style layout with section headers and rows on white backgrounds, separated by light gray section header bands.

---

### Section: EMAILS

**Section header row:**
- Text: "EMAILS"
- Style: All-caps, small (~12 pt), dark gray ~#888, bold
- Background: Light gray ~#f2f3f5, full width, ~32 pt tall

**Row 1 — email address:**
- Left: "derekwinchell@gmail.com" — dark ~#333, ~16 pt regular
- Right: Circular icon button, ~36 pt diameter, light blue ~#5bb5d5, white envelope glyph inside. This is a "compose email" action button — tapping it opens the native compose flow.
- Far right of content: The dark right-edge drawer handle `<` overlaps this row (not part of the email row itself)
- Row height: ~52 pt
- Divider: hairline gray ~1 pt at bottom

---

### Section: RELATIONSHIPS

**Section header row:**
- Text: "RELATIONSHIPS"
- Style: All-caps, ~12 pt, dark gray ~#888, bold
- Background: Light gray ~#f2f3f5, ~32 pt tall

**Row 1 — add relationship:**
- Text: "Add Relationship..." — teal blue ~#4ab0d0, ~16 pt regular
- No right-side value or chevron
- Tappable: opens a relationship picker/search modal [INFERRED]
- Row height: ~52 pt

---

### Section: DETAILS

**Section header row:**
- Text: "DETAILS"
- Style: All-caps, ~12 pt, dark gray ~#888, bold
- Background: Light gray ~#f2f3f5, ~32 pt tall

**Row 1 — Assigned to:**
- Left label: "Assigned to" — light gray ~#999, ~16 pt regular
- Right value: "Matt Ryan" — dark ~#333, ~16 pt regular
- Right: disclosure chevron `>` — light gray ~#ccc, ~12 pt
- Row height: ~52 pt
- Divider: hairline gray at bottom
- Tappable: navigates to broker/agent picker

**Row 2 — Stage:**
- Left label: "Stage" — light gray ~#999
- Right value: "Lead" — dark ~#333
- Right: disclosure chevron `>`
- Tappable: opens stage picker (pipeline stage selector)

**Row 3 — Source:**
- Left label: "Source" — light gray ~#999
- Right value: "Ryan-Realty.com" — dark ~#333
- Right: disclosure chevron `>`
- Tappable: opens source picker

**Row 4 — Tags:**
- Left label: "Tags" — light gray ~#999
- Right value: "auto:brand-voice:plain-honest, auto:se..." — dark ~#333, truncated with ellipsis (value is too long to fit)
- Right: disclosure chevron `>`
- Tappable: navigates to tag management view where full tag list is shown

**Row 5 — Time frame:**
- Left label: "Time frame" — light gray ~#999
- Right value: (empty — no value set)
- Right: disclosure chevron `>`
- Tappable: opens time frame picker (buying/selling timeline selector)

**Row 6 — Collaborators:**
- Left label: "Collaborators" — light gray ~#999
- Right value: "No collaborators" — dark ~#333
- Right: disclosure chevron `>`
- Tappable: opens collaborator assignment view

---

### Section: FINANCING

**Section header row:**
- Text: "FINANCING"
- Style: All-caps, ~12 pt, dark ~#333 (slightly bolder than other headers), bold
- Background: Light blue-gray ~#eef1f4, ~32 pt tall (slightly different from other section headers — a pale blue tint)

**Row 1 — Lender:**
- Left label: "Lender" — light gray ~#999
- Right value: "TRANSFER TO LENDER" — teal blue ~#4ab0d0, all-caps, ~14 pt medium/semibold (this is a CTA action, not a data value)
- Right: disclosure chevron `>` — gray
- Tappable: initiates a lender referral flow or opens lender contact/assignment

---

## Colors, type & iconography

| Element | Color (hex estimate) |
|---|---|
| Header / nav / hero / sub-tab bg | #3d5a6b (dark slate-teal — FUB brand) |
| Active tab underline indicator | #4ab0d0 (medium teal-blue) |
| Active tab label | #ffffff |
| Inactive tab labels | #8a9eaa |
| Section header bg (standard) | #f2f3f5 |
| Section header bg (FINANCING) | #eef1f4 (pale blue-gray) |
| Section header text | #888888 |
| Row bg | #ffffff |
| Row divider | #e5e5ea (hairline) |
| Label text (left side) | #9b9b9b |
| Value text (right side) | #333333 |
| Disclosure chevron | #c7c7cc |
| Email icon button bg | #5bb5d5 |
| Email icon glyph | #ffffff |
| FAB bg | #5b9bc8 |
| FAB glyph (+) | #ffffff |
| Tappable action text ("Add Relationship...", "TRANSFER TO LENDER") | #4ab0d0 |
| Right-edge drawer handle bg | #4a4a4a (dark charcoal) |
| Right-edge drawer handle glyph `<` | #ffffff or light gray |
| Contact name | #ffffff |
| Contact subtitle ("No communication yet") | #aab8c2 |

**Typography:**
- Nav "Edit" button: SF Pro Display, medium, ~17 pt, white
- Contact name: SF Pro Display, bold, ~20 pt, white
- Subtitle: SF Pro Text, regular, ~14 pt, muted
- Sub-tab labels: SF Pro Text, ~14 pt, regular (inactive) / medium (active)
- Section headers: SF Pro Text, bold, ~12 pt, all-caps, gray
- Row labels (left): SF Pro Text, regular, ~16 pt, gray
- Row values (right): SF Pro Text, regular, ~16 pt, dark
- Action CTAs: SF Pro Text, medium or semibold, ~14–16 pt, teal

**Iconography:**
- Back chevron: SF Symbols chevron.left or native UIKit back indicator
- Email button: envelope.fill (SF Symbols) on circular blue bg
- Disclosure chevrons: chevron.right (SF Symbols), ~12 pt, gray
- FAB: plus (SF Symbols), white on blue circle
- Right drawer handle: chevron.left glyph on dark pill

---

## Interactions & gestures

| Target | Gesture | Behavior |
|---|---|---|
| Back `<` (nav) | Tap | Pop view → returns to People list (or originating list) |
| "Edit" (nav right) | Tap | Switches all rows into edit mode (inline text fields, pickers become active) |
| Avatar photo | Tap [INFERRED] | Opens photo viewer / option to change photo |
| "Info" tab | Tap | Already active — no-op or scrolls to top |
| "Comms" tab | Tap | Pushes/slides to Comms sub-tab (email/text/call history) |
| "Homes" tab | Tap | Pushes to Homes sub-tab (saved searches, property matches) |
| "Notes" tab | Tap | Pushes to Notes sub-tab |
| "Calendar" tab | Tap | Pushes to Calendar sub-tab (appointments for this contact) |
| Email address row | Tap | [INFERRED] Opens full email editor or email options |
| Email icon button (blue circle) | Tap | Opens compose email modal to derekwinchell@gmail.com |
| "Add Relationship..." | Tap | Opens relationship search/picker modal sheet |
| "Assigned to — Matt Ryan" row | Tap | Opens agent/broker picker (list of FUB users) |
| "Stage — Lead" row | Tap | Opens pipeline stage picker sheet |
| "Source — Ryan-Realty.com" row | Tap | Opens source picker sheet |
| "Tags — auto:..." row | Tap | Navigates to tag management view (full tag list + add/remove) |
| "Time frame" row | Tap | Opens time frame dropdown (3–6 months / 6–12 months / etc.) |
| "Collaborators" row | Tap | Opens collaborator picker (FUB user selector) |
| "Lender — TRANSFER TO LENDER" row | Tap | Opens lender referral flow (select/assign lender partner) |
| FAB `+` | Tap | Opens action sheet: Add Note / Add Task / Log Call / Schedule Appointment / etc. [INFERRED] |
| Right-edge `<` handle | Tap | Expands/collapses the right-side Quick Access drawer [INFERRED] |
| Scrollable content area | Swipe up | Reveals more sections below FINANCING (likely BUYER INFO, SELLER INFO, CUSTOM FIELDS) |
| Any detail row | Swipe left [INFERRED] | Reveal contextual quick-action (e.g., clear field) |
| Pull down on content | Pull-to-refresh [INFERRED] | Reloads contact data from FUB server |

---

## Build notes (component tree)

```tsx
<MobileShell safeArea>

  {/* iOS status bar — rendered by OS, styled to match header bg */}
  <StatusBar style="light" backgroundColor="#3d5a6b" />

  {/* Nav bar */}
  <TopBar backgroundColor="#3d5a6b">
    <BackButton icon="chevron-left" color="#ffffff" onPress={popToList} />
    {/* no center title */}
    <TextButton label="Edit" color="#ffffff" onPress={enterEditMode} />
  </TopBar>

  {/* Contact hero */}
  <ContactHero backgroundColor="#3d5a6b" px={16} py={12}>
    <CircularAvatar
      src={contact.photoUrl}
      size={52}
      fallback={initials(contact.name)}
    />
    <Stack ml={12}>
      <Text style="name" color="#ffffff">{contact.name}</Text>
      <Text style="subtitle" color="#aab8c2">{contact.lastContactStatus ?? "No communication yet"}</Text>
    </Stack>
  </ContactHero>

  {/* Sub-tab strip */}
  <SubTabStrip
    backgroundColor="#3d5a6b"
    activeColor="#ffffff"
    inactiveColor="#8a9eaa"
    indicatorColor="#4ab0d0"
    indicatorHeight={2}
    scrollable
  >
    <SubTab label="Info" active />
    <SubTab label="Comms" />
    <SubTab label="Homes" />
    <SubTab label="Notes" />
    <SubTab label="Calendar" />
    {/* additional tabs scrollable */}
  </SubTabStrip>

  {/* Scrollable content — grouped list */}
  <ScrollView flex={1} backgroundColor="#f2f3f5">

    {/* EMAILS section */}
    <SectionHeader label="EMAILS" />
    <SectionBody>
      <DetailRow
        left={<Text>{contact.email}</Text>}
        right={
          <IconActionButton
            icon="envelope"
            bg="#5bb5d5"
            iconColor="#ffffff"
            size={36}
            onPress={() => composeEmail(contact.email)}
          />
        }
      />
    </SectionBody>

    {/* RELATIONSHIPS section */}
    <SectionHeader label="RELATIONSHIPS" />
    <SectionBody>
      <ActionRow
        label="Add Relationship..."
        labelColor="#4ab0d0"
        onPress={openRelationshipPicker}
      />
    </SectionBody>

    {/* DETAILS section */}
    <SectionHeader label="DETAILS" />
    <SectionBody>
      <NavigableDetailRow
        label="Assigned to"
        value={contact.assignedTo}        /* "Matt Ryan" */
        onPress={openAgentPicker}
      />
      <NavigableDetailRow
        label="Stage"
        value={contact.stage}             /* "Lead" */
        onPress={openStagePicker}
      />
      <NavigableDetailRow
        label="Source"
        value={contact.source}            /* "Ryan-Realty.com" */
        onPress={openSourcePicker}
      />
      <NavigableDetailRow
        label="Tags"
        value={contact.tags.join(", ")}   /* truncated */
        truncate
        onPress={openTagManager}
      />
      <NavigableDetailRow
        label="Time frame"
        value={contact.timeFrame ?? ""}
        onPress={openTimeframePicker}
      />
      <NavigableDetailRow
        label="Collaborators"
        value={contact.collaborators.length > 0 ? contact.collaborators.join(", ") : "No collaborators"}
        onPress={openCollaboratorPicker}
      />
    </SectionBody>

    {/* FINANCING section */}
    <SectionHeader
      label="FINANCING"
      backgroundColor="#eef1f4"
      textColor="#333333"
    />
    <SectionBody>
      <NavigableDetailRow
        label="Lender"
        value={<Text style="cta" color="#4ab0d0">TRANSFER TO LENDER</Text>}
        onPress={openLenderReferral}
      />
    </SectionBody>

    {/* Additional sections scroll below (not visible in crop): */}
    {/* BUYER INFO, SELLER INFO, CUSTOM FIELDS, etc. */}

  </ScrollView>

  {/* FAB — fixed overlay bottom-right */}
  <FloatingActionButton
    icon="plus"
    bg="#5b9bc8"
    iconColor="#ffffff"
    size={56}
    position={{ bottom: 96, right: 16 }}  /* above tab bar */
    onPress={openQuickAddSheet}
  />

  {/* Right-edge quick-access drawer handle (FUB-specific) */}
  <RightDrawerHandle
    icon="chevron-left"
    bg="#4a4a4a"
    position={{ right: 0, top: "40%" }}
    onPress={toggleRightDrawer}
  />

  {/* Bottom tab bar — [INFERRED from FUB app structure, not visible in crop] */}
  <BottomTabBar backgroundColor="#ffffff" borderTop="#e5e5ea">
    <Tab icon="chat-bubble" label="Inbox" />
    <Tab icon="activity" label="Activity" />
    <Tab icon="calendar" label="Calendar" />
    <Tab icon="person" label="People" active accentColor="#4ab0d0" />
    <Tab icon="tag" label="Deals" />
  </BottomTabBar>

</MobileShell>
```

### Key data bindings

| Component | Data field |
|---|---|
| `CircularAvatar.src` | `contact.photoUrl` (FUB contact photo URL) |
| `ContactHero` name | `contact.firstName + " " + contact.lastName` → "Derek Winchell" |
| `ContactHero` subtitle | `contact.lastActivityAt` — if null, render "No communication yet" |
| `DetailRow` email | `contact.emails[0].value` → "derekwinchell@gmail.com" |
| `NavigableDetailRow` Assigned to | `contact.assignedTo.name` → "Matt Ryan" |
| `NavigableDetailRow` Stage | `contact.stage` → "Lead" |
| `NavigableDetailRow` Source | `contact.source` → "Ryan-Realty.com" |
| `NavigableDetailRow` Tags | `contact.tags[]` joined by ", " → "auto:brand-voice:plain-honest, auto:se..." |
| `NavigableDetailRow` Time frame | `contact.timeframe` → "" (empty) |
| `NavigableDetailRow` Collaborators | `contact.collaborators[]` or fallback "No collaborators" |

### Spacing & sizing notes

- Row height: 52 pt (standard iOS grouped table row)
- Section header height: 32 pt
- Horizontal content padding: 16 pt left, 16 pt right
- Avatar: 52 pt diameter, circular
- Email action button: 36 pt diameter, circular, bg #5bb5d5
- FAB: 56 pt diameter, circular, bg #5b9bc8, shadow (elevation 4)
- Sub-tab font: ~14 pt, active indicator 2 pt underline
- Contact name font: ~20 pt bold
- Row label font: ~16 pt regular, color #9b9b9b
- Row value font: ~16 pt regular, color #333333
- Disclosure chevron: ~12 pt, #c7c7cc
