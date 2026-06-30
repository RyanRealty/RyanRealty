<!-- Mobile per-screen appendix. Original: IMG_5988.PNG | id: mob-26 | tiles: mob-tiles/mob-26_{full,t,m,b}.png -->

# mob-26 — fub-ios — Contact Detail / Info Tab

## Identity

- **app_source:** fub-ios (native Follow Up Boss iPhone app)
- **module:** Contact Detail (Lead Profile)
- **screen:** Info tab of a Contact Detail view for "Derek Winchell"
- **how to reach:** People tab (bottom bar) → tap any contact row → Contact Detail screen pushed; "Info" is the default/first sub-tab
- **iOS status bar:** 8:39 (left); signal bars (3 of 4 filled) + WiFi icon + battery 37% (right). All indicators white on dark teal header.
- **URL bar:** n/a — native iOS app, no browser chrome

---

## Screen regions (top → bottom, ~390×844 pt logical)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–44 | 44 pt | Dark teal ~#266A78 (same as header) |
| Nav bar | 44–88 | 44 pt | Dark teal ~#266A78 |
| Contact identity header | 88–156 | 68 pt | Dark teal ~#266A78 |
| Sub-tab strip | 156–198 | 42 pt | Dark teal ~#266A78, bottom edge fades to content bg |
| Scrollable content | 198–790 | ~592 pt | Light blue-gray ~#EEF1F4 (grouped table bg) |
| FAB | ~728–790 | 56 pt circle | Overlays content, bottom-right |
| Bottom tab bar | not visible | — | Hidden on pushed detail view (iOS hides tab bar on push) |

A dark gray rounded-rectangle collapse handle with a left-pointing chevron "‹" sits on the right edge of the screen at approximately y 290–370 pt. This is the FUB swipe-panel or "quick action drawer" toggle — tapping it reveals a side panel of quick actions (call, text, email, note).

---

## Nav / header bar (exact)

- **Left control:** "‹" back chevron, white, ~20 pt, no label. Tapping pops back to the People list.
- **Center:** Empty (no title text in the nav bar itself; contact identity is in the header block below).
- **Right control:** "Edit" — white text, ~17 pt regular weight. Tapping enters Edit mode for the contact record.

---

## Contact identity header (below nav bar, above sub-tabs)

- **Avatar:** Circular photo, ~52 pt diameter, real headshot of a middle-aged man in a dark suit and tie (Derek Winchell). Circle-clipped. No badge or status ring visible.
- **Name:** "Derek Winchell" — white, ~20–22 pt semibold/bold, left of center.
- **Subtitle:** "No communication yet" — white at ~60% opacity (muted), ~14 pt regular. Indicates no calls, texts, or emails have been logged.
- Layout: avatar left-aligned ~16 pt from left edge; name + subtitle stacked to the right of avatar.

---

## Sub-tab strip (exact)

Horizontally scrollable tab strip. Visible tabs (left to right):

| # | Label | State | Indicator |
|---|---|---|---|
| 1 | **Info** | **Active** | Blue underline bar ~2 pt tall, FUB blue ~#1A7CC4 |
| 2 | Comms | Inactive | No underline |
| 3 | Homes | Inactive | No underline |
| 4 | Notes | Inactive | No underline |
| 5 | Caler… | Inactive, clipped | "Calendar" truncated — strip scrolls right to reveal |

- Active tab text: white, ~15 pt semibold.
- Inactive tab text: white at ~55% opacity, ~15 pt regular.
- Tab strip bg: same dark teal as header.
- Blue underline is FUB brand blue, ~full tab width.

---

## Bottom tab bar

Not visible on this screen. FUB iOS hides the bottom tab bar when a detail view is pushed onto the navigation stack. The standard FUB tab bar (when visible) contains: Inbox / Activity / Calendar / People / Deals.

---

## FAB (Floating Action Button)

- Position: bottom-right, ~16 pt from right edge, ~16 pt above bottom safe area.
- Size: ~56 pt diameter circle.
- Color: steel blue ~#5B9BC8 (lighter than FUB brand blue, muted/desaturated).
- Icon: white "+" (plus), ~24 pt.
- Behavior [INFERRED]: tapping opens an action sheet with quick-add options — New Note, New Task, Log Call, Send Email, Send Text, Add Appointment, etc.

---

## Content — Info tab (every element in scroll order)

All content is in a UITableView grouped style: section headers are uppercase gray on a light gray background; rows are white with 1 pt light gray dividers.

---

### Section 1 — DETAILS

**Section header row:**
- Text: "DETAILS" — uppercase, ~12 pt semibold, gray ~#8A8A8E, on light gray bg ~#EEF1F4, full width, ~32 pt tall.

**Row 1.1 — Collaborators**
- Left label: "Collaborators" — gray ~#9CA3AF, ~16 pt regular.
- Right value: "No collaborators" — dark ~#1C1C1E, ~16 pt regular.
- Right trailing: "›" chevron, gray.
- Tapping: opens Collaborator assignment picker [INFERRED].
- Row height: ~48 pt. White bg. Bottom divider.

---

### Section 2 — FINANCING

**Section header row:**
- Text: "FINANCING" — same uppercase gray style. ~32 pt tall. Light gray bg.

**Row 2.1 — Lender**
- Left label: "Lender" — gray ~#9CA3AF, ~16 pt regular.
- Right value: "TRANSFER TO LENDER ›" — FUB blue ~#1A7CC4, all-caps, ~14 pt semibold + trailing "›" chevron (also blue).
- Tapping: opens a lender transfer flow or lender assignment [INFERRED].
- Row height: ~48 pt. White bg. Bottom divider.

---

### Section 3 — BACKGROUND

**Section header row:**
- Text: "BACKGROUND" — uppercase gray. ~32 pt tall. Light gray bg.

**Row 3.1 — Add background**
- Left label: "Add background" — gray ~#9CA3AF, ~16 pt regular (placeholder/empty-state text).
- Right trailing: "›" chevron, gray.
- Tapping: opens a text editor for free-form background/bio notes on this lead [INFERRED].
- Row height: ~48 pt. White bg. No bottom divider (section end).

---

### Section 4 — INQUIRIES

**Section header row:**
- Text: "INQUIRIES" — uppercase gray. ~32 pt tall. Light gray bg.

**Row 4.1 — Registration inquiry**
- Left icon: two overlapping speech-bubble circles icon, green ~#4CAF50 or #52B788, ~24 pt. FUB "web registration" event icon.
- Primary text: "Registration" — dark ~#1C1C1E, ~16 pt semibold.
- Secondary text (below primary): "via: Ryan-Realty.com" — gray ~#8A8A8E, ~14 pt regular.
- Right meta: "Jun 13" — gray ~#8A8A8E, ~14 pt regular.
- Right trailing: "›" chevron, gray.
- Tapping: opens Inquiry detail — source data, form fields captured at registration [INFERRED].
- Row height: ~60 pt (two-line). White bg. No bottom divider (section end).

---

### Section 5 — CUSTOM FIELDS

**Section header row:**
- Text: "CUSTOM FIELDS" — uppercase gray. ~32 pt tall. Light gray bg.

**Row 5.1 — Add Custom Fields**
- Text: "Add Custom Fields..." — FUB blue ~#1A7CC4, ~16 pt regular. Full-width tappable row.
- No right chevron visible (or may have a subtle one).
- Tapping: navigates to Custom Field management / FUB admin to define custom fields [INFERRED].
- Row height: ~48 pt. White bg.

---

### Below CUSTOM FIELDS — blank content area

~80–100 pt of empty light gray background visible below the last section, before the FAB. This is the end of the scroll content.

---

## Colors, type & iconography

| Element | Color | Notes |
|---|---|---|
| Header / nav / sub-tab bg | ~#266A78 | Dark teal-navy; FUB brand header |
| Active sub-tab underline | ~#1A7CC4 | FUB brand blue |
| Active sub-tab text | #FFFFFF | |
| Inactive sub-tab text | rgba(255,255,255,0.55) | Muted white |
| Nav "Edit" + back chevron | #FFFFFF | |
| Contact name | #FFFFFF | ~21pt semibold |
| Contact subtitle | rgba(255,255,255,0.65) | "No communication yet" |
| Scrollable content bg | ~#EEF1F4 | Light blue-gray grouped table |
| Section header bg | ~#EEF1F4 | Same as content bg |
| Section header text | ~#8A8A8E | Uppercase, 12pt semibold |
| Row bg | #FFFFFF | |
| Row divider | ~#E5E7EB | 1pt horizontal line |
| Row label text | ~#9CA3AF | Gray placeholder/label |
| Row value text | ~#1C1C1E | Near-black for filled values |
| Actionable / blue text | ~#1A7CC4 | "TRANSFER TO LENDER", "Add Custom Fields..." |
| Inquiry icon | ~#52B788 | Green double-speech-bubble |
| FAB bg | ~#5B9BC8 | Steel blue, lighter than brand blue |
| FAB icon | #FFFFFF | "+" 24pt |
| Chevron "›" | ~#C7C7CC | iOS system gray |
| Right-edge collapse handle | ~#555F6B | Dark gray rounded pill, "‹" icon |

**Typography impressions:**
- Contact name: ~21 pt semibold, system font (SF Pro Display or SF Pro Text)
- Sub-tab labels: ~15 pt, regular / semibold
- Section headers: ~12 pt semibold uppercase
- Row labels: ~16 pt regular
- Row values: ~16 pt regular
- Secondary/meta text: ~14 pt regular
- "TRANSFER TO LENDER": ~14 pt semibold, all-caps, blue

**Iconography:**
- Back chevron: standard iOS "‹" glyph
- Inquiry icon: two overlapping circle speech bubbles (web registration source), green fill
- FAB: "+" (SF Symbols or custom, white on blue circle)
- Right-edge panel handle: "‹" chevron on dark rounded rectangle (FUB-specific side-panel toggle)

---

## Interactions & gestures

| Target | Behavior |
|---|---|
| "‹" back (nav bar) | Pop to People list |
| "Edit" (nav bar right) | Push into Edit Contact Detail view |
| Sub-tab: Comms | Switch to Comms tab (call/text/email log + action buttons) |
| Sub-tab: Homes | Switch to Homes tab (saved searches, home matches) |
| Sub-tab: Notes | Switch to Notes tab (agent notes log) |
| Sub-tab: Calen… | Switch to Calendar/Appointments tab |
| Collaborators row | Present collaborator picker sheet [INFERRED] |
| TRANSFER TO LENDER row | Opens lender assignment / transfer-to-lender flow [INFERRED] |
| Add background row | Push text editor for background notes [INFERRED] |
| Registration inquiry row | Push Inquiry Detail — source, captured fields, timestamp [INFERRED] |
| Add Custom Fields... | Navigate to Custom Fields admin (settings) [INFERRED] |
| FAB "+" | Present bottom action sheet: quick-add actions (Note, Task, Call log, Email, Text, Appt) [INFERRED] |
| Right-edge collapse handle "‹" | Toggle a right-side quick-action drawer panel [INFERRED] |
| Pull-to-refresh | Reload contact data from FUB API [INFERRED] |
| Swipe left on row | May reveal delete/archive action for supported rows (e.g. Inquiries) [INFERRED] |
| Sub-tab strip horizontal scroll | Swipe left to reveal clipped "Calendar" tab |

---

## Build notes (component tree)

```
<ContactDetailShell>                        // Full-screen nav push, tab bar hidden
  <IOSStatusBar color="dark" />             // White text on teal bg; 8:39 / signal / wifi / 37%

  <NavBar bg="#266A78">
    <BackChevron color="white" onPress="popToList" />
    <NavTitle>{null}</NavTitle>             // No center title — identity is in header block
    <NavAction label="Edit" color="white" onPress="pushEditView" />
  </NavBar>

  <ContactIdentityHeader bg="#266A78">
    <CircularAvatar
      src={contact.photoUrl}               // Real photo; fallback to initials avatar
      size={52}
      borderColor="none"
    />
    <Stack spacing={2}>
      <Text style="contactName" color="white">{contact.fullName}</Text>
      // "Derek Winchell"
      <Text style="contactSubtitle" color="white/65%">{contact.communicationStatus}</Text>
      // "No communication yet" | or last communication summary
    </Stack>
  </ContactIdentityHeader>

  <SubTabStrip
    bg="#266A78"
    activeColor="white"
    inactiveColor="white/55%"
    activeIndicator={{ color: "#1A7CC4", height: 2 }}
    scrollable={true}
    tabs={["Info", "Comms", "Homes", "Notes", "Calendar"]}
    activeTab="Info"
  />

  <ScrollView bg="#EEF1F4">

    // ---- DETAILS section ----
    <SectionHeader label="DETAILS" />

    <InfoRow
      label="Collaborators"
      value={contact.collaborators.length ? contact.collaborators.map(c=>c.name).join(", ") : "No collaborators"}
      hasChevron={true}
      onPress="openCollaboratorPicker"
    />

    // ---- FINANCING section ----
    <SectionHeader label="FINANCING" />

    <InfoRow
      label="Lender"
      value="TRANSFER TO LENDER"
      valueStyle="actionBlue"            // #1A7CC4, uppercase, semibold
      hasChevron={true}
      chevronColor="#1A7CC4"
      onPress="openLenderTransferFlow"
    />

    // ---- BACKGROUND section ----
    <SectionHeader label="BACKGROUND" />

    <InfoRow
      label="Add background"
      value={null}
      labelStyle="placeholder"           // Gray, full-width tappable
      hasChevron={true}
      onPress="pushBackgroundEditor"
    />

    // ---- INQUIRIES section ----
    <SectionHeader label="INQUIRIES" />

    <InquiryRow
      icon={<WebRegistrationIcon color="#52B788" size={24} />}
      primaryText="Registration"
      secondaryText={`via: ${inquiry.source}`}    // "via: Ryan-Realty.com"
      date="Jun 13"                               // formatted from inquiry.createdAt
      hasChevron={true}
      onPress="pushInquiryDetail"
    />
    // Repeat <InquiryRow /> for each inquiry in contact.inquiries[]

    // ---- CUSTOM FIELDS section ----
    <SectionHeader label="CUSTOM FIELDS" />

    // For each defined custom field: <CustomFieldRow label={field.name} value={field.value} />
    // When no custom fields exist:
    <InfoRow
      label="Add Custom Fields..."
      value={null}
      labelStyle="actionBlue"            // #1A7CC4 tappable
      hasChevron={false}
      onPress="navigateToCustomFieldsAdmin"
    />

    <Spacer height={80} />               // Bottom padding so FAB doesn't overlap last row

  </ScrollView>

  <RightEdgePanelHandle
    // FUB-specific: dark gray pill anchored to right edge, y ~290–370pt
    // "‹" chevron; tapping slides in a quick-action drawer from the right
    position="absolute"
    right={0}
    top={290}
    width={20}
    height={80}
    bg="#555F6B"
    onPress="toggleQuickActionDrawer"
  />

  <FAB
    position="absolute"
    bottom={24}
    right={16}
    size={56}
    bg="#5B9BC8"
    icon="plus"
    iconColor="white"
    onPress="openQuickAddSheet"
    // Sheet options [INFERRED]: Note, Task, Call, Email, Text, Appointment
  />

</ContactDetailShell>
```

### Data bindings

| Component prop | FUB API / data source |
|---|---|
| `contact.fullName` | FUB Person `firstName + lastName` |
| `contact.photoUrl` | FUB Person `photoUrl` |
| `contact.communicationStatus` | Derived: "No communication yet" when `lastCommunicated` is null |
| `contact.collaborators[]` | FUB Person `collaborators` array |
| `contact.inquiries[]` | FUB Inquiry list for person; `type`, `source`, `created` |
| `inquiry.source` | FUB Inquiry `source` field → "Ryan-Realty.com" |
| `inquiry.createdAt` | FUB Inquiry `created` → formatted "Jun 13" |
| custom fields | FUB Custom Fields endpoint for person |

### Spacing / sizing notes

- Section header height: 32 pt; 8 pt top padding; label 12 pt semibold uppercase.
- Standard row height: 48 pt (single-line); 60–64 pt (two-line with secondary text).
- Row horizontal padding: 16 pt left, 16 pt right.
- Row label–value gap: space-between layout.
- Avatar: 52 pt circle; 16 pt from left edge of header.
- Header vertical padding: ~10 pt top, ~10 pt bottom (within 68 pt block).
- Sub-tab strip: 42 pt tall; each tab min 60 pt wide; active underline 2 pt.
- FAB: 56 pt circle; 16 pt from right safe edge; 24 pt above bottom safe area.
- Right-edge handle: ~20 pt wide × 80 pt tall; ~6 pt corner radius; positioned at vertical center of content area.
