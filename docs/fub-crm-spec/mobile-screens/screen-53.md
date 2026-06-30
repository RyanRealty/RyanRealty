<!-- Mobile per-screen appendix. Original: IMG_6021.PNG | id: mob-53 | tiles: mob-tiles/mob-53_{full,t,m,b}.png -->

# mob-53 — fub-ios — Contact Detail (Info Tab)

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app — dark teal header ~#3D5166, FUB avatar/initials pattern, FUB section layout with ALL-CAPS gray section headers)
- **module:** Contact Detail (Lead Profile)
- **screen:** Contact detail view, "Info" sub-tab active — shows Background, Address, Inquiries, and Custom Fields sections
- **how to reach:** Tap any lead row in People, Activity feed, or Inbox → pushes this Contact Detail view
- **iOS status bar:** 7:44 (time, left), signal bars (2/4 filled) + WiFi icon + battery "16" with yellow low-battery indicator (right)
- **URL bar:** N/A — native iOS app, no Safari chrome

---

## Screen regions (y-bands on 390×844 pt logical screen)

| Region | y-band (approx pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | ~#3D5166 (dark teal, blends into nav) |
| Nav / header bar | 54–100 | 46 pt | ~#3D5166 dark teal |
| Contact identity block | 100–190 | 90 pt | ~#3D5166 dark teal |
| Sub-tab strip | 190–234 | 44 pt | ~#3D5166 dark teal, active indicator blue |
| Scrollable content area | 234–800 | ~566 pt | ~#EEF1F5 (light blue-gray for section bands) / #FFFFFF (row bg) |
| Floating action button (FAB) | ~740–800 | 60 pt | Overlays content |
| Bottom tab bar | ~800–844 | NOT VISIBLE (cropped out of screenshot) | — |

---

## Nav / header bar (exact)

- **Left control:** `<` back chevron, white, ~22 pt, tappable — pops Contact Detail, returns to prior list (People / Activity / search results)
- **Center:** empty (no title text in nav bar itself; the contact name is in the identity block below, not in the nav bar)
- **Right control:** "Edit" — white text button, ~16 pt regular weight — taps into edit mode for all contact fields

---

## Contact identity block (y ≈ 100–190 pt, dark teal bg)

- **Avatar:** Circle, ~52 pt diameter, periwinkle-purple fill ~#7068B0, white initials "MB" in ~18 pt semibold — centered left-ish, ~16 pt from left edge
- **Name:** "Mary Bowman" — white, ~20 pt semibold, to the right of avatar
- **Subtitle:** "Last communication Jun 22" — light muted gray-white ~#A8BDD0, ~13 pt regular, below the name

---

## Sub-tab strip (y ≈ 190–234 pt)

All tabs on the same dark teal background row. Tab labels in ~14 pt, spacing equal.

| Tab | State | Color |
|---|---|---|
| Info | **Active** | White text, 2 pt solid blue underline ~#57B3F1 spanning the word width |
| Comms | Inactive | Muted gray ~#8896A4 |
| Homes | Inactive | Muted gray ~#8896A4 |
| Notes | Inactive | Muted gray ~#8896A4 |
| Cale[ndar] | Inactive, clipped by right edge | Muted gray ~#8896A4 |

Scrollable horizontally — at minimum 5 tabs; "Calendar" is visibly clipped, indicating more tabs exist off-screen to the right.

**Bottom tab bar:** NOT VISIBLE in this screenshot crop. FUB iOS standard bottom bar has: Inbox / Activity / Calendar / People / Deals.

---

## Content — every element, in order (y ≈ 234 pt downward, scrollable)

### Section: BACKGROUND (y ≈ 234–306 pt)

- **Section header band:** ~32 pt tall, bg ~#EEF1F5, text "BACKGROUND" uppercase, ~11 pt semibold, color ~#8896A4, left-padded 16 pt
- **Row:** White bg, full width. Left-aligned placeholder text "Add background" in muted gray ~#B0BECB, ~15 pt regular. Right side: pencil/edit glyph icon in gray ~#B0BECB. Tapping the row opens a text input to add background notes.
- No bottom divider from the next section band — the section band itself acts as separator.

### Section: ADDRESS (y ≈ 306–520 pt)

- **Section header band:** ~32 pt tall, bg ~#EEF1F5, text "ADDRESS" uppercase, ~11 pt semibold, color ~#8896A4

**Row 1 — (home) address:**
- bg: white
- Top-left label: "(home)" in dark gray ~#4A5568, ~14 pt regular
- Below label: "13651 Amberview Pl" on one line, "Eastvale, CA, 92880" on second line — both in teal-blue link color ~#4A90D9, ~15 pt regular (tappable — opens Maps)
- Right side: thin vertical gray separator ~1 pt, then a diamond-shaped turn-arrow navigation icon (~28×28 pt), gray fill ~#9AA8B8 with white arrow, tappable — opens Maps/navigation to that address
- Bottom edge: 1 pt divider line ~#E5E8EC

**Row 2 — (Property) address:**
- Same layout as Row 1
- Label: "(Property)" in dark gray ~#4A5568, ~14 pt regular
- Address lines: "20702 Beaumont Dr" / "Bend, OR, 97701" in teal-blue ~#4A90D9, ~15 pt regular
- Right: vertical separator + diamond turn-arrow navigation icon (same style)
- No bottom divider (section band follows)

### Section: INQUIRIES (y ≈ 520–660 pt)

- **Section header band:** ~32 pt tall, bg ~#EEF1F5, text "INQUIRIES" uppercase, ~11 pt semibold, color ~#8896A4

**Inquiry row — "Seller Inquiry":**
- bg: white
- Left icon: teal-green overlapping speech-bubble icon (~22×22 pt), color ~#3DAF8B — this is FUB's "inquiry/lead" icon indicating a web inquiry lead type
- Primary text: "Seller Inquiry" — dark ~#1A2938, ~17 pt semibold
- Right meta: "Jan 8" in muted gray ~#8896A4, ~14 pt, followed by ">" chevron in light gray — tappable, opens inquiry detail
- Second line: "20702 Beaumont Dr, Bend, Oregon" — dark ~#1A2938, ~15 pt regular (the property address associated with this inquiry)
- Third line: "via: Ryan-Realty.com" — muted gray ~#8896A4, ~14 pt regular (the source website)
- Bottom: 1 pt divider ~#E5E8EC

**Expand link:**
- Full-width tappable row, white bg
- Text: "Show 1 more events" — blue link color ~#4A90D9, ~15 pt regular, left-aligned with 16 pt padding
- Tapping expands the list to show all inquiry events

### Section: CUSTOM FIELDS (y ≈ 660–800+ pt)

- **Section header band:** ~32 pt tall, bg ~#EEF1F5
  - Left: "CUSTOM FIELDS" uppercase, ~11 pt semibold, color ~#8896A4
  - Right: "EDIT ALL..." in blue ~#4A90D9, ~12 pt regular, right-padded 16 pt — tappable, opens bulk-edit modal for all custom fields

**Row — Open House Address:**
- bg: white
- Left label: "Open House Address" in muted gray ~#B0BECB, ~14 pt regular (label column, ~40% width)
- Right value: "13651 Amberview Pl" / "Eastvale, CA, 928..." — dark text ~#1A2938, ~15 pt regular; value is truncated by the FAB overlapping the right side (full value: "Eastvale, CA, 92880")
- No right navigation icon (custom field, not a system address field)

---

## Floating Action Button (FAB)

- **Shape:** Circle, ~56 pt diameter
- **Color:** Blue ~#4A90D9 (matches FUB's primary accent blue)
- **Icon:** White "+" plus symbol, ~24 pt, centered
- **Position:** Bottom-right corner, approximately x 318, y 756 pt (above bottom tab bar)
- **Action [INFERRED]:** Opens a quick-action sheet — options likely include: Add Note, Log Call, Send Email, Send Text, Create Task, Schedule Appointment

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / nav / sub-tab bg | ~#3D5166 (FUB dark teal-navy, distinct from Ryan Realty #102742 navy) |
| Active tab underline | ~#57B3F1 (FUB bright blue) |
| Accent / link blue | ~#4A90D9 |
| Inquiry icon teal | ~#3DAF8B |
| Avatar bg (purple) | ~#7068B0 (periwinkle, generated from contact initials hash) |
| Section band bg | ~#EEF1F5 |
| Row bg | #FFFFFF |
| Primary text | ~#1A2938 (very dark navy) |
| Label / metadata text | ~#8896A4 (medium gray) |
| Placeholder / muted | ~#B0BECB (light gray) |
| Dividers | ~#E5E8EC (1 pt) |
| FAB blue | ~#4A90D9 |
| Navigation icon | ~#9AA8B8 with white arrow on diamond shape |
| Font weight impressions | Name: semibold ~600; section headers: semibold ~600 uppercase; body/rows: regular ~400; "Seller Inquiry" title: semibold ~600 |

---

## Interactions & gestures [INFERRED]

- **Tap `<` back:** Pop view, return to prior list
- **Tap "Edit":** Enter edit mode — all fields become editable inline; "Edit" becomes "Done"/"Cancel"
- **Tap avatar:** [INFERRED] Opens contact photo picker or avatar options
- **Tap "Info" sub-tab:** Already active; no-op
- **Tap "Comms" sub-tab:** Switches to communication timeline (emails, texts, calls)
- **Tap "Homes" sub-tab:** Switches to saved property searches / home matches
- **Tap "Notes" sub-tab:** Switches to note list for this contact
- **Tap "Cale[ndar]" sub-tab:** Switches to calendar/appointments for this contact
- **Horizontal swipe on sub-tab strip:** Reveals additional tabs (the strip is horizontally scrollable)
- **Tap address (blue text):** Opens Apple Maps with that address
- **Tap navigation icon (diamond arrow):** Opens navigation directions in Maps
- **Tap "Seller Inquiry" row / ">" chevron:** Pushes inquiry detail view
- **Tap "Show 1 more events":** Expands the INQUIRIES list inline to reveal the hidden event
- **Tap "EDIT ALL...":** Opens a modal or push view to bulk-edit all custom fields
- **Tap "Open House Address" row:** Inline edit that field's value
- **Tap FAB (+):** Presents bottom action sheet with quick-add options
- **Pull to refresh:** Reloads contact data from FUB server
- **Vertical scroll:** The content area scrolls; header/sub-tabs remain sticky

---

## Build notes (component tree)

```
<MobileShell>
  <StatusBar style="light-content" bg="#3D5166" />

  <ContactDetailHeader bg="#3D5166">
    <NavRow>
      <BackChevron color="white" onPress={popToList} />
      <Spacer />
      <TextButton label="Edit" color="white" onPress={enterEditMode} />
    </NavRow>
    <IdentityBlock>
      <InitialsAvatar
        initials="MB"                    // computed from contact name
        size={52}
        bgColor="#7068B0"               // deterministic from name hash
        textColor="white"
        fontSize={18}
      />
      <VStack>
        <Text style="name">Mary Bowman</Text>
        <Text style="subtitle">Last communication Jun 22</Text>
      </VStack>
    </IdentityBlock>
    <SubTabStrip
      tabs={["Info","Comms","Homes","Notes","Calendar","Tasks","Files"]}
      activeTab="Info"
      activeIndicatorColor="#57B3F1"
      inactiveColor="#8896A4"
      scrollable={true}
    />
  </ContactDetailHeader>

  <ScrollView bg="#EEF1F5">

    {/* BACKGROUND */}
    <SectionHeader label="BACKGROUND" />
    <SectionRow onPress={openBackgroundEdit}>
      <PlaceholderText>Add background</PlaceholderText>
      <PencilIcon color="#B0BECB" />
    </SectionRow>

    {/* ADDRESS */}
    <SectionHeader label="ADDRESS" />
    <AddressRow
      label="(home)"
      line1="13651 Amberview Pl"
      line2="Eastvale, CA, 92880"
      onPressAddress={openMapsAddress}
      onPressNavigate={openMapsNavigation}
    />
    <RowDivider />
    <AddressRow
      label="(Property)"
      line1="20702 Beaumont Dr"
      line2="Bend, OR, 97701"
      onPressAddress={openMapsAddress}
      onPressNavigate={openMapsNavigation}
    />

    {/* INQUIRIES */}
    <SectionHeader label="INQUIRIES" />
    <InquiryRow
      icon={<SellerInquiryIcon color="#3DAF8B" />}
      title="Seller Inquiry"
      date="Jan 8"
      address="20702 Beaumont Dr, Bend, Oregon"
      source="via: Ryan-Realty.com"
      onPress={openInquiryDetail}
    />
    <RowDivider />
    <ExpandLink
      label="Show 1 more events"
      color="#4A90D9"
      onPress={expandInquiries}
    />

    {/* CUSTOM FIELDS */}
    <SectionHeader
      label="CUSTOM FIELDS"
      rightAction={<TextButton label="EDIT ALL..." color="#4A90D9" onPress={openBulkEdit} />}
    />
    <CustomFieldRow
      label="Open House Address"
      value="13651 Amberview Pl\nEastvale, CA, 92880"
      onPress={editField}
    />

  </ScrollView>

  <FAB
    icon="plus"
    bg="#4A90D9"
    size={56}
    position="bottom-right"
    bottom={90}           // clears bottom tab bar
    right={16}
    onPress={openQuickActionSheet}
  />

  {/* Bottom tab bar — present in app but not captured in this screenshot crop */}
  <BottomTabBar
    tabs={[
      { label: "Inbox",    icon: "inbox",    badge: null  },
      { label: "Activity", icon: "activity", badge: null  },
      { label: "Calendar", icon: "calendar", badge: null  },
      { label: "People",   icon: "people",   badge: null  },
      { label: "Deals",    icon: "deals",    badge: null  },
    ]}
    activeTab="People"        // [INFERRED] — reached from People tab
    activeColor="#57B3F1"
    inactiveColor="#8896A4"
    bg="#FFFFFF"
  />
</MobileShell>
```

### Spacing / sizing notes
- Section header band: 32 pt tall, 16 pt left padding, uppercase 11 pt semibold ~600
- Row vertical padding: ~14 pt top + 14 pt bottom (28 pt row content + label)
- Address rows: label line ~14 pt gray, address lines ~15 pt blue, 56 pt min-height
- AddressRow right zone: 1 pt vertical divider + 44 pt tappable nav icon column
- InquiryRow: icon 22 pt, title 17 pt semibold, date right-aligned 14 pt, 3-line row ~72 pt tall
- CustomFieldRow: label column ~40% width, value column ~60% right-aligned
- FAB: 56 pt circle, shadow beneath (FUB style: subtle drop shadow)
- RowDivider: 1 pt, #E5E8EC, full bleed (edge-to-edge, NOT inset)

### Data bindings
- `contact.name` → IdentityBlock name + InitialsAvatar initials
- `contact.lastCommunicationDate` → "Last communication Jun 22"
- `contact.addresses[]` → AddressRow list (type: home/property/mailing, address fields)
- `contact.inquiries[]` → InquiryRow list (type, property address, source URL, date)
- `contact.inquiryCount` → "Show N more events" expand link (hidden count = total − shown)
- `contact.customFields[]` → CustomFieldRow list (key: "Open House Address", value: address string)
- `contact.backgroundNote` → placeholder if empty, text if set
