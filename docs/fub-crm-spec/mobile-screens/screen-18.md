<!-- Mobile per-screen appendix. Original: IMG_5839.PNG | id: mob-18 | tiles: mob-tiles/mob-18_{full,t,m,b}.png -->

# mob-18 — fub-ios — Contact Detail: Info Tab

## Identity

- **app_source:** fub-ios (native Follow Up Boss iPhone app — dark teal/navy header, green initials avatar, FUB sub-tab navigation, blue FAB, teal action links)
- **module:** Contact Detail (Lead Profile)
- **screen:** Contact Info tab — the "Info" sub-tab of a lead profile, showing Details, Financing, Background, Inquiries, and Custom Fields sections
- **how to reach:** Tap a contact row from the People tab (or from Activity/Inbox feed) → pushes to the contact detail shell; "Info" is the default first sub-tab
- **iOS status bar:** Time 4:34 (left), signal 2/4 bars + WiFi + 100% battery (right) — all white on dark header
- **URL bar:** n/a — native iOS app

---

## Screen regions (top → bottom, approximate y-bands on 390×844pt logical canvas)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–50 | ~50pt | Dark teal-navy ~#2C4355 (inherits header bg) |
| Nav bar (back + Edit) | 50–100 | ~50pt | Dark teal-navy ~#2C4355 |
| Contact identity header (avatar + name + last comm) | 100–178 | ~78pt | Dark teal-navy ~#2C4355 |
| Sub-tab strip (Info / Comms / Homes / Notes / Calen…) | 178–222 | ~44pt | Dark teal-navy ~#2C4355; active tab has blue underline |
| Scrollable content area | 222–844 | fills remainder | Light gray page bg ~#F0F2F5 |
| Floating Action Button (+) | ~760–810 (fixed, bottom-right) | 52pt circle | Blue ~#4A9FD4 |
| Bottom tab bar | NOT VISIBLE in screenshot | — | — (hidden or scrolled away on detail view) |

---

## Nav / header bar (exact)

**Left control:** Back chevron `<` — white, ~22pt, taps to pop back to the contact list (People tab list or prior Activity/Inbox row)

**Center:** Empty (no title text in the nav bar itself; the contact name is in the identity header below, not the UINavigationBar title)

**Right control:** Text button `Edit` — white, regular weight ~17pt — taps to enter edit mode for the contact profile, enabling field mutations

---

## Sub-tab strip (exact)

Horizontal scrollable tab row, all on the dark header background. Tabs in visible order (rightmost is clipped):

| # | Label | State |
|---|---|---|
| 1 | Info | **Active** — white text, ~2pt blue (#4A9FD4) bottom underline bar |
| 2 | Comms | Inactive — medium gray ~#8FA3B1 text |
| 3 | Homes | Inactive — medium gray |
| 4 | Notes | Inactive — medium gray |
| 5 | Calen… | Inactive — medium gray (clipped; full label = "Calendar" or "Calender") |

Tab height ~44pt, label font ~15pt medium. Underline is flush to the bottom edge of the tab strip. The strip is horizontally scrollable to reveal additional tabs beyond the 5 visible.

---

## Contact identity header (exact)

**Avatar:** Circle, ~56pt diameter, filled with medium green ~#5A8A56; white bold initials `DM` (~20pt, 600-weight) centered inside

**Primary text:** `Doug Millard` — white, ~22pt, 500-weight, immediately right of avatar, vertically centered on top half of avatar

**Secondary text:** `Last communication Jan 3` — light gray ~#A0B4C0, ~14pt regular, below the primary name, same right-of-avatar column

Layout: avatar left-aligned with ~16pt left margin; name + subtitle stacked to the right of the avatar with ~12pt gap; entire header block ~78pt tall, vertically padded ~12pt top and bottom.

---

## Bottom tab bar (exact)

Not visible in this screenshot. FUB standard bottom tab bar (Inbox / Activity / Calendar / People / Deals) is absent — the detail view either hides it or the viewport captures it scrolled below frame. No tab bar chrome is rendered in any of the four tiles.

**FAB button:** Blue circle ~52pt diameter, white `+` icon (24pt, 2pt stroke), fixed position bottom-right ~20pt from right edge, ~70pt from bottom of content area. Taps to reveal a quick-add sheet (add note / task / appointment / call log / text / email — standard FUB FAB menu).

---

## Content — every element in scroll order

### Section: DETAILS (y ~222–310pt)

**Section header row:** `DETAILS` — all-caps, ~12pt, 600-weight, dark gray ~#5A6472, left-padded ~16pt, on light gray section-separator background ~#E8ECF0, height ~32pt. 1pt separator line at top edge.

**Row: Collaborators**
- Background: white
- Left label: `Collaborators` — gray ~#6B7A8D, ~16pt regular
- Right value: `No collaborators` — dark ~#1A2836, ~16pt regular; followed by `>` chevron in gray
- Height: ~52pt; 1pt bottom divider ~#E5E7EB; entire row tappable → opens collaborator picker sheet

---

### Section: FINANCING (y ~310–430pt)

**Section header row:** `FINANCING` — same style as DETAILS header, ~32pt, light gray bg

**Row: Lender**
- Background: white
- Left label: `Lender` — gray ~#6B7A8D, ~16pt regular
- Right value: `TRANSFER TO LENDER` — teal-blue ~#3D9FCC, ~14pt 700-weight all-caps bold; followed by `>` chevron in same teal-blue
- Height: ~52pt; 1pt bottom divider; entire row tappable → triggers FUB "Transfer to Lender" workflow (shares lead with a connected lender partner)

---

### Section: BACKGROUND (y ~430–550pt)

**Section header row:** `BACKGROUND` — same header style, ~32pt, light gray bg

**Row: Add background**
- Background: white
- Full-width placeholder text: `Add background` — gray ~#9BAAB8, ~16pt regular (no value set)
- Right: `>` chevron in gray ~#C0C8D0
- Height: ~52pt; 1pt bottom divider; tappable → opens text editor to add background notes about the lead

---

### Section: INQUIRIES (y ~550–720pt)

**Section header row:** `INQUIRIES` — same header style, ~32pt, light gray bg

**Row: Property Inquiry (inquiry record)**
- Background: white
- Left icon: double-chat-bubble icon, ~28pt, filled teal-green ~#3DB89A (two overlapping speech bubbles — FUB property inquiry type indicator)
- Primary text: `Property Inquiry` — dark ~#1A2836, ~16pt 500-weight, right of icon ~8pt gap
- Secondary text line 1: `64350,` — dark ~#1A2836, ~14pt regular, below primary (MLS listing number / property ID, value trailing comma suggests partial data)
- Secondary text line 2: `via: <unspecified>` — light gray ~#9BAAB8, ~13pt regular (lead source channel is unset)
- Right meta: `Jul 2, 2025` — gray ~#9BAAB8, ~13pt regular, right-aligned top of row; followed by `>` chevron in gray
- Row height: ~72pt (3 lines of text); 1pt bottom divider; entire row tappable → pushes to inquiry detail screen

---

### Section: CUSTOM FIELDS (y ~720–790pt)

**Section header row:** `CUSTOM FIELDS` — same header style, ~32pt, light gray bg

**Row: Add Custom Fields…**
- Background: white
- Full-width text: `Add Custom Fields...` — teal-blue ~#3D9FCC, ~16pt regular (actionable link style)
- No chevron visible
- Height: ~48pt; tappable → opens custom fields configuration or picker sheet

---

### Below custom fields

Empty light gray space ~#F0F2F5, ~54pt tall, to the bottom of the scrollable area. No additional content. The FAB overlays this region.

---

## Colors, type & iconography

| Element | Color (hex est.) | Weight / Size |
|---|---|---|
| Header / nav / tab-strip bg | #2C4355 (dark teal-navy) | — |
| Contact name (header) | #FFFFFF | 500 / ~22pt |
| Last communication subtitle | #A0B4C0 | 400 / ~14pt |
| Active tab label | #FFFFFF | 500 / ~15pt |
| Active tab underline | #4A9FD4 (FUB blue) | 2pt bar |
| Inactive tab labels | #8FA3B1 | 400 / ~15pt |
| Nav "Edit" text | #FFFFFF | 400 / ~17pt |
| Back chevron | #FFFFFF | — / ~22pt |
| Avatar fill | #5A8A56 (medium green) | — |
| Avatar initials | #FFFFFF | 700 / ~20pt |
| Section header text | #5A6472 | 700 / ~12pt ALLCAPS |
| Section header bg | #E8ECF0 | — |
| Row label (left) | #6B7A8D | 400 / ~16pt |
| Row value (right) | #1A2836 | 400 / ~16pt |
| "TRANSFER TO LENDER" action | #3D9FCC (teal-blue) | 700 / ~14pt ALLCAPS |
| Placeholder text ("Add background") | #9BAAB8 | 400 / ~16pt |
| Tappable link ("Add Custom Fields...") | #3D9FCC | 400 / ~16pt |
| Date meta text | #9BAAB8 | 400 / ~13pt |
| Row chevrons `>` | #C0C8D0 | — / ~14pt |
| Row dividers | #E5E7EB | 1pt |
| Scrollable content bg | #F0F2F5 | — |
| White row bg | #FFFFFF | — |
| FAB fill | #4A9FD4 (FUB blue) | — |
| FAB `+` icon | #FFFFFF | 24pt / 2pt stroke |
| Inquiry type icon (double chat bubble) | #3DB89A (teal-green) | ~28pt |

**Font:** System San Francisco throughout (native iOS). FUB uses system font stack. No custom web fonts.

**Accent color:** #4A9FD4 (FUB blue) for active states, FAB; #3D9FCC for action links. These are close to the same hue — FUB's brand teal-blue.

---

## Interactions & gestures [INFERRED]

| Target | Gesture | Result |
|---|---|---|
| Back chevron `<` | Tap | Pop navigation → return to contact list or prior feed row |
| `Edit` button | Tap | Switches contact detail to edit mode — fields become inline editable inputs |
| Avatar circle `DM` | Tap | [INFERRED] Opens avatar picker or contact card actions sheet |
| Sub-tab `Comms` | Tap | Switches to Comms tab — shows call log, email, text history |
| Sub-tab `Homes` | Tap | Switches to Homes tab — shows saved/recommended property matches |
| Sub-tab `Notes` | Tap | Switches to Notes tab — shows agent notes timeline |
| Sub-tab `Calen…` | Tap | Switches to Calendar tab — shows appointments for this lead |
| `Collaborators` row | Tap | Pushes to collaborator picker/list sheet |
| `Lender` / TRANSFER TO LENDER row | Tap | Triggers FUB lender-transfer flow — presents lender partner selection sheet |
| `Add background` row | Tap | Pushes to or presents text editor for background notes field |
| `Property Inquiry` row | Tap | Pushes to inquiry detail screen showing full property + source context |
| `Add Custom Fields…` row | Tap | Presents custom field picker/creation sheet |
| FAB `+` | Tap | Presents quick-action sheet: Log Call / Send Text / Send Email / Add Note / Add Task / Schedule Appointment |
| Scroll content area | Swipe up/down | Scrolls through Info tab sections; header may parallax-collapse [INFERRED] |
| Sub-tab strip | Swipe left/right | Scrolls to reveal hidden tabs (Calen… and beyond) |
| Pull to refresh | Pull down from content top | [INFERRED] Refreshes lead data from FUB server |

---

## Build notes (component tree)

```
<MobileShell bg="#F0F2F5">

  <StatusBar style="light" bg="#2C4355" />

  <TopBar bg="#2C4355" height={50}>
    <BackChevron color="#FFFFFF" onTap={popNavigation} />
    {/* No center title — contact name lives in the identity header below */}
    <TextButton label="Edit" color="#FFFFFF" onTap={enterEditMode} />
  </TopBar>

  <ContactIdentityHeader bg="#2C4355" height={78} px={16} py={12}>
    <Avatar
      shape="circle"
      size={56}
      fill="#5A8A56"
      initials="DM"
      initialsColor="#FFFFFF"
      initialsFontSize={20}
      initialsFontWeight={700}
    />
    <Stack ml={12} gap={4}>
      <Text size={22} weight={500} color="#FFFFFF">Doug Millard</Text>
      <Text size={14} weight={400} color="#A0B4C0">Last communication Jan 3</Text>
    </Stack>
  </ContactIdentityHeader>

  <SubTabStrip
    bg="#2C4355"
    height={44}
    activeUnderlineColor="#4A9FD4"
    activeUnderlineHeight={2}
    activeLabelColor="#FFFFFF"
    inactiveLabelColor="#8FA3B1"
    labelSize={15}
    labelWeight={500}
    scrollable={true}
    tabs={["Info", "Comms", "Homes", "Notes", "Calendar", {/* more tabs if any */}]}
    activeTab="Info"
  />

  <ScrollView flex={1}>

    {/* DETAILS SECTION */}
    <SectionHeader label="DETAILS" />
    <InfoRow
      label="Collaborators"
      value="No collaborators"
      showChevron={true}
      onTap={openCollaboratorPicker}
    />

    {/* FINANCING SECTION */}
    <SectionHeader label="FINANCING" />
    <InfoRow
      label="Lender"
      value="TRANSFER TO LENDER"
      valueStyle="action-allcaps"   /* teal-blue #3D9FCC, 700, uppercase */
      showChevron={true}
      chevronColor="#3D9FCC"
      onTap={openLenderTransferFlow}
    />

    {/* BACKGROUND SECTION */}
    <SectionHeader label="BACKGROUND" />
    <InfoRow
      label={null}
      value="Add background"
      valuePlaceholder={true}       /* gray #9BAAB8 placeholder style */
      showChevron={true}
      onTap={openBackgroundEditor}
    />

    {/* INQUIRIES SECTION */}
    <SectionHeader label="INQUIRIES" />
    <InquiryRow
      icon={<DoubleChatBubbleIcon color="#3DB89A" size={28} />}
      primaryText="Property Inquiry"
      line2="64350,"
      line3="via: <unspecified>"
      date="Jul 2, 2025"
      showChevron={true}
      onTap={openInquiryDetail}
    />
    {/* Additional inquiry rows if any — data-driven list */}

    {/* CUSTOM FIELDS SECTION */}
    <SectionHeader label="CUSTOM FIELDS" />
    <InfoRow
      label={null}
      value="Add Custom Fields..."
      valueStyle="link"             /* teal-blue #3D9FCC, 400 */
      showChevron={false}
      onTap={openCustomFieldsPicker}
    />

    <Spacer height={80} /> {/* room for FAB */}

  </ScrollView>

  <FAB
    icon="plus"
    color="#FFFFFF"
    bg="#4A9FD4"
    size={52}
    position="bottom-right"
    bottom={20}
    right={20}
    onTap={openQuickActionSheet}
  />

  {/* Bottom tab bar NOT rendered on this screen in captured state */}

</MobileShell>
```

### Data bindings

| Component | Data source |
|---|---|
| `ContactIdentityHeader` | `contact.firstName`, `contact.lastName`, `contact.lastContactedAt` |
| `Avatar` fill color | Derived from contact ID or name hash (FUB assigns per-contact color) |
| `InfoRow` Collaborators | `contact.collaborators[]` — empty array → "No collaborators" |
| `InfoRow` Lender | `contact.lenderId` — null → CTA "TRANSFER TO LENDER" |
| `InfoRow` Background | `contact.background` — null → placeholder "Add background" |
| `InquiryRow` list | `contact.inquiries[]` — each: `type`, `listingId`, `source`, `createdAt` |
| `CustomFields` | `contact.customFields[]` — empty → "Add Custom Fields..." CTA |

### Spacing & sizing conventions

- Section header height: 32pt, left pad 16pt, text 12pt all-caps 700-weight
- Standard row height: 52pt (single-line label+value), 72pt+ for multi-line (inquiry row)
- Row horizontal padding: 16pt left, 16pt right
- Row divider: 1pt, #E5E7EB, full width flush to row bottom
- Section separator (between sections): same light gray bg as header (~#E8ECF0), visually groups content
- Avatar–to–text gap: 12pt
- Header vertical padding top+bottom: 12pt each side
- Sub-tab underline: 2pt, flush bottom of tab strip, width = label text width + ~8pt padding each side
