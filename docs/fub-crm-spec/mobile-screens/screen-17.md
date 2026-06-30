<!-- Mobile per-screen appendix. Original: IMG_5838.PNG | id: mob-17 | tiles: mob-tiles/mob-17_{full,t,m,b}.png -->

# mob-17 — fub-ios — Contact Detail / Info Tab (Doug Millard)

## Identity

- **app_source:** fub-ios (Follow Up Boss native iOS app — confirmed by dark slate-teal header, FUB sub-tab strip pattern Info/Comms/Homes/Notes/Calendar, teal accent underline, "TRANSFER TO LENDER" FUB-specific action, section-header caps pattern, and teal FAB)
- **module:** Contact Detail (Lead Profile)
- **screen:** Contact detail view, "Info" sub-tab active, showing Details / Financing / Background / Inquiries sections
- **how to reach:** Tap any contact row in the People tab → pushes this detail view onto the navigation stack; bottom tab bar is hidden on this push-level screen (standard FUB iOS behavior)
- **iOS status bar:** Time "4:34" (left), signal bars 2/4 (right), WiFi icon (right), battery "100" with plug icon (right) — white text on dark header bg
- **URL bar:** N/A — native iOS app, no browser chrome

---

## Screen regions (y-bands on 390×844 pt logical screen)

| Region | Approx y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | Dark slate-teal #2e3f50 (inherits header bg) |
| Nav / back bar | 54–100 | 46 pt | Dark slate-teal #2e3f50 |
| Contact identity block | 100–178 | 78 pt | Dark slate-teal #2e3f50 |
| Sub-tab strip | 178–220 | 42 pt | Dark slate-teal #2e3f50, active indicator below |
| Scrollable content area | 220–844+ | fills remainder | White #ffffff / light grey section headers #f0f2f5 |
| FAB (floating) | ~680–740 | 56 pt circle | Teal #42b4e6 circle, overlays content lower-right |
| Bottom tab bar | not visible | — | Hidden on pushed detail screen |

---

## Nav / header bar (exact)

**Background:** Dark slate-teal, approx `#2e3f50` (FUB's characteristic dark header). Spans from status bar through sub-tab strip — all one unified dark block.

**Back bar row (y ~54–100):**
- **Left:** Back chevron `<` — white, ~22 pt, standard iOS navigation back arrow. Tappable; pops this view back to the contact list.
- **Center:** Empty (no title in the back bar — identity is shown in the block below)
- **Right:** Text button **"Edit"** — white, system font ~17 pt regular weight. Tappable; enters edit mode for this contact's fields.

**Contact identity block (y ~100–178):**
- **Avatar:** Circle, ~56 pt diameter, background muted sage-green `#6b8f6e`. White initials **"DM"** centered, ~18 pt bold. No photo — initials fallback.
- **Name:** **"Doug Millard"** — white, ~24 pt, semibold/medium weight, vertically centered right of avatar.
- **Subtitle:** **"Last communication Jan 3"** — light grey `#a8b8c8`, ~13 pt regular, below name.

---

## Sub-tab strip (exact, horizontally scrollable)

Position: immediately below identity block. Dark header background continues. Tabs are left-aligned with some padding; strip scrolls right to reveal more tabs.

| Order | Label | State | Indicator |
|---|---|---|---|
| 1 | **Info** | **Active** | White text; bright blue-teal underline ~3 pt thick `#42b4e6`, full label width |
| 2 | Comms | Inactive | Medium grey text `#7a9ab0` |
| 3 | Homes | Inactive | Medium grey text `#7a9ab0` |
| 4 | Notes | Inactive | Medium grey text `#7a9ab0` |
| 5 | Cale… (Calendar) | Inactive, partially clipped at right edge | Medium grey text, cut off — indicates scrollable strip |

Font: ~15 pt system font regular for inactive, white regular for active. No badge counts visible.

---

## Bottom tab bar

**Not rendered on this screen.** FUB iOS hides the bottom tab bar when a contact detail view is pushed onto the navigation stack. The app's five bottom tabs (Inbox / Activity / Calendar / People / Deals) are present at the root level but do not appear here.

**No FAB on the global tab bar** — there is a contextual FAB within the content (see below).

---

## Content — every element in order (Info tab, y ~220 downward)

### Section: DETAILS (y ~220–520)

**Section header row:**
- Full-width, background light grey `#f0f2f5`, height ~36 pt
- Label: **"DETAILS"** — uppercase, ~12 pt, bold/semibold, grey `#8a9eb0`, left-inset ~16 pt

**Field rows** (each ~52 pt tall, white bg, left-right layout, full-width horizontal divider `#e4e9ee` at bottom):

1. **Assigned to** | value: **"Matt Ryan"** + chevron `>`
   - Label: left-aligned, grey `#8a9eb0`, ~15 pt
   - Value: right-aligned, dark `#2c3e50`, ~15 pt, + grey `>` chevron ~14 pt
   - Tap: opens agent/broker picker

2. **Stage** | value: **"Past Client"** + chevron `>`
   - Same anatomy as above
   - Tap: opens stage picker (pipeline stage selector)

3. **Source** | value: **"Word of Mouth"** + chevron `>`
   - Tap: opens source picker

4. **Tags** | value: **"Client, Phone Import, SOI"** + chevron `>`
   - Value is comma-separated list of tag strings; may truncate if long
   - Tap: opens tags editor/picker

5. **Time frame** | value: [empty] + chevron `>`
   - No value set — right side shows only the chevron
   - Tap: opens time-frame picker (buying/selling horizon)

6. **Collaborators** | value: **"No collaborators"** + chevron `>`
   - Tap: opens collaborators picker to add co-agents

### Section: FINANCING (y ~520–620)

**Section header row:**
- Same style as DETAILS header: full-width light grey, **"FINANCING"** uppercase 12 pt grey

**Field row:**

7. **Lender** | value: **"TRANSFER TO LENDER"** + chevron `>`
   - Label: left-aligned grey `#8a9eb0`
   - Value: **uppercase teal/blue action text** `#42b4e6` — ~15 pt, all caps, semibold. This is a CTA to share the contact with a preferred lender partner, not a plain data value.
   - Tap: triggers lender-transfer flow (opens lender selection or sends referral)

### Section: BACKGROUND (y ~620–700)

**Section header row:**
- Full-width light grey, **"BACKGROUND"** uppercase 12 pt grey

**Field row:**

8. **Add background** | chevron `>`
   - Entire row is grey placeholder text — no label/value split; "Add background" acts as the label/placeholder
   - Right: grey `>` chevron
   - Tap: opens a text editor to add biographical background notes about the contact

### Section: INQUIRIES (y ~700–844+, continues below fold)

**Section header row:**
- Full-width light grey, **"INQUIRIES"** uppercase 12 pt grey, left-aligned
- **FAB overlaps this header at right:** teal circle `#42b4e6`, ~56 pt diameter, white `+` icon centered (~24 pt). Positioned ~right edge –8 pt, vertically centered on this section header row. Tap: adds a new inquiry.

**Inquiry row (partially visible, continues below screen):**
- **Left icon:** Two overlapping speech-bubble circles, green `#4cca7a` or teal, ~24 pt — FUB's "Property Inquiry" icon
- **Primary text:** **"Property Inquiry"** — dark `#2c3e50`, ~15 pt, regular/medium
- **Date (right):** **"Jul 2, 2025"** — grey `#8a9eb0`, ~13 pt, right-aligned
- **Chevron:** `>` grey, right edge
- **Secondary text line 1:** **"64350, ,"** — grey, ~13 pt (appears to be a zip code or MLS# with empty city/state fields)
- **Secondary text line 2:** **"via: \<unspecified\>"** — grey, ~13 pt, cut off at bottom of viewport

**Divider between rows:** 1 pt light grey `#e4e9ee` from left inset ~16 pt to right edge (inset left to clear avatar).

---

## Colors, type & iconography

| Element | Color (hex estimate) |
|---|---|
| Header / status / sub-tab background | `#2e3f50` (dark slate-teal) |
| Active tab underline | `#42b4e6` (FUB teal-blue) |
| Active tab text | `#ffffff` |
| Inactive tab text | `#7a9ab0` |
| Avatar background (DM) | `#6b8f6e` (sage green) |
| Avatar initials text | `#ffffff` |
| Contact name text | `#ffffff` |
| Contact subtitle text | `#a8b8c8` |
| "Edit" button text | `#ffffff` |
| Content area background | `#ffffff` |
| Section header background | `#f0f2f5` |
| Section header text | `#8a9eb0` uppercase ~12 pt semibold |
| Field label text | `#8a9eb0` ~15 pt regular |
| Field value text (populated) | `#2c3e50` ~15 pt regular |
| Field value text (placeholder) | `#8a9eb0` ~15 pt regular italic-ish |
| Chevron `>` | `#b0bec8` ~14 pt |
| Row dividers | `#e4e9ee` 1 pt |
| "TRANSFER TO LENDER" action | `#42b4e6` uppercase semibold |
| FAB background | `#42b4e6` |
| FAB icon `+` | `#ffffff` |
| Inquiry icon (bubbles) | `#4cca7a` (green) |
| Date meta text | `#8a9eb0` ~13 pt |

**Fonts:** System SF Pro — no custom typefaces visible. Weights: regular (labels, values), semibold (section headers, contact name).

**Iconography:**
- Back chevron: standard iOS `<` chevron, ~22 pt, white
- Disclosure chevrons `>`: small grey, right-aligned on every tappable row
- Property Inquiry: double speech-bubble icon, green fill, ~24 pt
- FAB `+`: white plus sign on teal circle

**FUB accent color is a mid blue-teal `#42b4e6`** — not navy `#102742` / cream `#faf8f4`. Confirmed fub-ios, not inhouse-web.

---

## Interactions & gestures

- **Tap back `<`** — pops contact detail, returns to People/contact list [INFERRED]
- **Tap "Edit"** — switches all field rows to editable inline-edit mode; "Edit" becomes "Done" / "Cancel" [INFERRED]
- **Tap any field row (Info section)** — navigates to a dedicated picker or text-input screen for that field [INFERRED]
- **Tap "TRANSFER TO LENDER"** — opens lender-partner selection / referral flow [INFERRED]
- **Tap "Add background"** — pushes a text editor for free-form background notes [INFERRED]
- **Tap sub-tab (Comms / Homes / Notes / Calendar)** — switches tab content in-place; scrolls back to top of new tab content [INFERRED]
- **Horizontal swipe on sub-tab strip** — reveals additional tabs (Calendar is partially clipped) [INFERRED]
- **Tap FAB `+`** in INQUIRIES section — opens new-inquiry creation modal/sheet [INFERRED]
- **Tap inquiry row** — pushes inquiry detail view [INFERRED]
- **Pull-to-refresh on scrollable content** — refreshes contact data from server [INFERRED]
- **Swipe left on inquiry row** — reveals delete action [INFERRED]
- **Scroll down** — reveals more inquiry rows below the fold

---

## Build notes (component tree)

```
<MobileShell bg="#ffffff">

  {/* Unified dark header block */}
  <ContactDetailHeader bg="#2e3f50">
    <StatusBar textColor="white" time="4:34" signal={2} wifi battery={100} />

    <NavBar>
      <BackButton icon="chevron-left" color="#ffffff" onTap={popNav} />
      <Spacer />
      <TextButton label="Edit" color="#ffffff" size={17} onTap={enterEditMode} />
    </NavBar>

    <ContactIdentityBlock>
      <Avatar
        size={56}
        bg="#6b8f6e"
        initials="DM"
        initialsColor="#ffffff"
        initialsSize={18}
        photoUrl={null}
        shape="circle"
      />
      <ContactNameStack>
        <Text size={24} weight="semibold" color="#ffffff">Doug Millard</Text>
        <Text size={13} color="#a8b8c8">Last communication Jan 3</Text>
      </ContactNameStack>
    </ContactIdentityBlock>

    <SubTabStrip
      scrollable={true}
      activeColor="#ffffff"
      activeIndicator={{ color: "#42b4e6", height: 3 }}
      inactiveColor="#7a9ab0"
      tabs={["Info", "Comms", "Homes", "Notes", "Calendar"]}
      activeTab="Info"
    />
  </ContactDetailHeader>

  {/* Scrollable content */}
  <ScrollView>

    <SectionGroup label="DETAILS">
      {/* SectionHeader: bg #f0f2f5, text uppercase 12pt semibold #8a9eb0 */}
      <SectionHeader label="DETAILS" />

      <FieldRow
        label="Assigned to"
        value="Matt Ryan"
        onTap={openAgentPicker}
      />
      <FieldRow
        label="Stage"
        value="Past Client"
        onTap={openStagePicker}
      />
      <FieldRow
        label="Source"
        value="Word of Mouth"
        onTap={openSourcePicker}
      />
      <FieldRow
        label="Tags"
        value="Client, Phone Import, SOI"
        onTap={openTagsPicker}
      />
      <FieldRow
        label="Time frame"
        value={null}
        placeholder=""
        onTap={openTimeframePicker}
      />
      <FieldRow
        label="Collaborators"
        value="No collaborators"
        onTap={openCollaboratorsPicker}
      />
    </SectionGroup>

    <SectionGroup label="FINANCING">
      <SectionHeader label="FINANCING" />
      <FieldRow
        label="Lender"
        value="TRANSFER TO LENDER"
        valueStyle={{ color: "#42b4e6", textTransform: "uppercase", fontWeight: "600" }}
        onTap={openLenderTransferFlow}
      />
    </SectionGroup>

    <SectionGroup label="BACKGROUND">
      <SectionHeader label="BACKGROUND" />
      <FieldRow
        label="Add background"
        labelStyle={{ color: "#8a9eb0" }}
        value={null}
        onTap={openBackgroundEditor}
      />
    </SectionGroup>

    <SectionGroup label="INQUIRIES">
      <SectionHeader label="INQUIRIES" />
      {/* FAB overlaps the header row at right */}
      <InquiryRow
        icon="property-inquiry-bubble"
        iconColor="#4cca7a"
        title="Property Inquiry"
        date="Jul 2, 2025"
        line2="64350, ,"
        line3="via: <unspecified>"
        onTap={openInquiryDetail}
      />
    </SectionGroup>

  </ScrollView>

  {/* Floating action button — fixed to lower-right over scroll content */}
  <FAB
    size={56}
    bg="#42b4e6"
    icon="plus"
    iconColor="#ffffff"
    iconSize={24}
    position={{ bottom: 24, right: 16 }}
    onTap={openNewInquirySheet}
  />

  {/* No BottomTabBar — hidden on pushed detail screen */}

</MobileShell>
```

### FieldRow component anatomy
```
<FieldRow>
  height: 52pt
  bg: #ffffff
  border-bottom: 1pt solid #e4e9ee
  padding: 0 16pt

  <Label>
    color: #8a9eb0
    font-size: 15pt
    font-weight: 400
    flex: 0 0 auto
    margin-right: auto

  <Value>
    color: #2c3e50  (or action color for special rows)
    font-size: 15pt
    font-weight: 400
    text-align: right
    max-width: ~60% of row width
    truncate: ellipsis

  <ChevronIcon>
    glyph: ">"
    color: #b0bec8
    size: 14pt
    margin-left: 6pt
```

### SectionHeader component anatomy
```
<SectionHeader>
  height: 36pt
  bg: #f0f2f5
  padding: 0 16pt
  display: flex
  align-items: center

  <Label>
    text-transform: uppercase
    font-size: 12pt
    font-weight: 600
    color: #8a9eb0
    letter-spacing: 0.04em
```

### InquiryRow component anatomy
```
<InquiryRow>
  height: ~72pt (3 text lines)
  bg: #ffffff
  border-bottom: 1pt solid #e4e9ee
  padding: 12pt 16pt

  <IconBubble>  (double speech-bubble icon)
    size: 24pt
    color: #4cca7a
    margin-right: 10pt
    align-self: flex-start
    margin-top: 2pt

  <TextStack>
    flex: 1

    <PrimaryText>
      font-size: 15pt
      font-weight: 500
      color: #2c3e50
      "Property Inquiry"

    <SecondaryText>
      font-size: 13pt
      color: #8a9eb0
      "64350, ,"

    <TertiaryText>
      font-size: 13pt
      color: #8a9eb0
      "via: <unspecified>"

  <DateText>
    font-size: 13pt
    color: #8a9eb0
    align-self: flex-start
    margin-top: 2pt
    "Jul 2, 2025"

  <Chevron>
    color: #b0bec8
    size: 14pt
    align-self: center
    margin-left: 6pt
```

### Data bindings
- Contact: `{ id, firstName, lastName, initials, avatarColor, lastCommunicationDate, assignedAgent, stage, source, tags[], timeframe, collaborators[], lender, background, inquiries[] }`
- InquiryRow: `{ type: "Property Inquiry", mlsOrZip: "64350", city: "", state: "", via: "<unspecified>", createdAt: "2025-07-02" }`
- SubTab active state: driven by URL param or local React state `activeTab`
- FAB visibility: always visible when on Info tab scroll position overlapping INQUIRIES section

### Responsive notes
- On web rebuild: replace iOS back chevron with a `<Button variant="ghost">` with left-arrow icon
- Sub-tab strip: horizontal `<ScrollArea>` with `overflow-x: auto; scrollbar-width: none`
- Dark header block should be `position: sticky; top: 0; z-index: 50` so it sticks on scroll
- FAB: `position: fixed; bottom: 24px; right: 16px` (or `position: absolute` within a relative scroll container)
- FieldRow tap → on web: cursor pointer, hover bg `#f8fafb`, entire row is `<button>` or `<a>`
