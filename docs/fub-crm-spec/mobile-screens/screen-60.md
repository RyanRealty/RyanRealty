<!-- Mobile per-screen appendix. Original: IMG_6032.PNG | id: mob-60 | tiles: mob-tiles/mob-60_{full,t,m,b}.png -->

# mob-60 — fub-ios — Lead Profile · Info Tab

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app — dark slate/teal header, FUB blue accent, sub-tab strip Info/Comms/Homes/Notes/Calendar, "TRANSFER TO LENDER" action)
- **module:** Contact Detail (Lead Profile)
- **screen:** Lead profile detail view, "Info" sub-tab active
- **how to reach:** People tab → tap a contact row → lands on Info tab by default
- **iOS status bar:** 4:58 · signal (3/4 bars) · WiFi · Battery 100% — all white icons on dark header
- **URL bar:** n/a (native app)

---

## Screen regions (y-bands, 390×844 pt logical screen)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | #3D5166 (dark slate, same as header) |
| Nav / header bar | 54–104 | 50 pt | #3D5166 |
| Contact identity block | 104–196 | 92 pt | #3D5166 |
| Sub-tab strip | 196–240 | 44 pt | #3D5166 with blue underline on active |
| Scrollable content | 240–780 | ~540 pt | #FFFFFF rows / #EEF1F5 section headers |
| FAB | float, ~y 690–750 | 56 pt circle | #5BA5D8 (FUB blue) |
| Bottom tab bar | ~780–844 | ~64 pt | NOT visible in screenshot (cut off / scrolled under FAB) |

---

## Nav / header bar (exact)

- **Left control:** `<` chevron glyph, white, ~18 pt — taps to pop back to People list
- **Center:** empty (no title text; identity is in the block below)
- **Right control:** "Edit" — plain text button, white, ~16 pt medium weight — taps to enter edit mode for this contact record

---

## Contact identity block (y 104–196 pt)

- **Avatar:** circular photo, ~60 pt diameter, real headshot of a middle-aged man in a dark suit with tie — no fallback initials visible (photo present). No ring/border.
- **Name:** "Derek Winchell" — white, ~22 pt, semibold, left of avatar + right column
- **Status line:** "No communication yet" — light gray (#A8B5C2 approx), ~14 pt regular, below name

Layout: avatar floats left (~16 pt inset), name + status stacked to its right, 12 pt gap between avatar and text column.

---

## Sub-tab strip (y 196–240 pt, horizontally scrollable)

Tabs visible (left to right): **Info** · Comms · Homes · Notes · Calen[dar — truncated at right edge]

| Tab | State | Text color | Underline |
|---|---|---|---|
| Info | ACTIVE | White (#FFFFFF), ~15 pt medium | 2 pt solid #5BA5D8 (FUB blue), full tab width |
| Comms | inactive | #7A9BB5 (muted gray-blue) | none |
| Homes | inactive | #7A9BB5 | none |
| Notes | inactive | #7A9BB5 | none |
| Calen… | inactive (clipped) | #7A9BB5 | none |

Tab strip background: matches header #3D5166. Tab padding ~16 pt horizontal each. Scrollable horizontally (Calendar and possibly more tabs off-screen right).

---

## Bottom tab bar — CRITICAL

**Not visible in this screenshot** (content fills to bottom; FAB overlaps the transition zone). Based on FUB standard navigation, the bottom tab bar order is:

| # | Label | Icon | Badge | Active |
|---|---|---|---|---|
| 1 | Inbox | speech-bubble icon | possible count | — |
| 2 | Activity | lightning bolt / list | — | — |
| 3 | Calendar | calendar grid | — | — |
| 4 | People | person silhouette | — | likely active (navigated from here) |
| 5 | Deals | handshake / dollar | — | — |

[INFERRED from FUB app standard navigation — not visible in this screenshot]

**FAB:** Blue circle (+), ~56 pt diameter, white plus glyph. Positioned bottom-right (~x 318, y ~715 pt), floats above content. Taps to add a new action (likely: add note, log call, send email, create task — shows an action sheet). Color #5BA5D8.

---

## Content — every element, top to bottom

### Section: DETAILS
- **Header row:** "DETAILS" — all-caps, ~11 pt, bold, color #6B7E8E, background #EEF1F5, full width, ~36 pt tall, 16 pt left inset

**Row 1 — Tags**
- Label: "Tags" — 16 pt, #8A9EB0 (muted gray), left-aligned, 16 pt inset
- Value: "auto:brand-voice:plain-honest, auto:se..." — 15 pt, #1A2733 (near-black), truncated with ellipsis
- Right: > chevron (#C5CDD4)
- Tap: opens tag editor / tag list screen
- Divider: 1 pt #E8ECF0, inset 16 pt left

**Row 2 — Time frame**
- Label: "Time frame" — 16 pt, #8A9EB0, placeholder/empty state
- Value: (empty)
- Right: > chevron (#C5CDD4)
- Tap: opens time-frame picker (buying/selling timeline selector)
- Divider: 1 pt #E8ECF0

**Row 3 — Collaborators**
- Label: "Collaborators" — 16 pt, #8A9EB0
- Value: "No collaborators" — 15 pt, #1A2733, right-aligned
- Right: > chevron (#C5CDD4)
- Tap: opens collaborator assignment screen
- Divider: 1 pt #E8ECF0

---

### Section: FINANCING
- **Header row:** "FINANCING" — same style as DETAILS header (all-caps, 11 pt bold, #6B7E8E, #EEF1F5 bg)

**Row 1 — Lender**
- Label: "Lender" — 16 pt, #8A9EB0
- Value / action: "TRANSFER TO LENDER" — ALL-CAPS, 13 pt, bold, #5BA5D8 (FUB blue), right-aligned — this is a tappable action link, not a data value
- Right: > chevron (#5BA5D8, same blue)
- Tap: triggers lender-transfer flow (sends lead info to a connected lender)
- Divider: 1 pt #E8ECF0

---

### Section: BACKGROUND
- **Header row:** "BACKGROUND" — same style

**Row 1 — Add background**
- Full-width row: "Add background" — 16 pt, #8A9EB0, placeholder text (no value set)
- Right: > chevron (#C5CDD4)
- Tap: opens free-text background/notes field for this lead

---

### Section: INQUIRIES
- **Header row:** "INQUIRIES" — same style

**Row 1 — Registration inquiry**
- Left icon: two overlapping speech-bubble glyphs, teal/green (~#4CAF82), ~24 pt — represents inquiry/registration source type
- Primary text: "Registration" — 16 pt, #1A2733, semibold
- Secondary text: "via: Ryan-Realty.com" — 13 pt, #8A9EB0, below primary
- Right meta: "Jun 13" — 13 pt, #8A9EB0
- Right: > chevron (#C5CDD4)
- Tap: opens inquiry detail (source, UTM, form fields submitted, timestamp)
- Divider: 1 pt #E8ECF0

---

### Section: CUSTOM FIELDS
- **Header row:** "CUSTOM FIELDS" — same style. FAB overlaps the right side of this header row.

**Row 1 — Add Custom Fields**
- "Add Custom Fields..." — 16 pt, #5BA5D8 (FUB blue), tappable action link, left-aligned
- No chevron
- Tap: opens custom field creation / field selection modal

---

## Colors, type & iconography

| Token | Value | Use |
|---|---|---|
| Header / identity block bg | #3D5166 | Dark slate-teal — FUB brand; status bar + nav bar + identity block + sub-tab strip |
| FUB accent blue | #5BA5D8 | Active tab underline, "TRANSFER TO LENDER", "Add Custom Fields...", FAB button, chevrons on action rows |
| Section header bg | #EEF1F5 | All-caps label rows between content groups |
| Section header text | #6B7E8E | All-caps 11 pt bold labels |
| Row label (empty/placeholder) | #8A9EB0 | "Time frame", "Collaborators", "Lender", "Add background" labels |
| Row value / primary text | #1A2733 | "No collaborators", "Registration", tag values |
| Row secondary / meta | #8A9EB0 | "via: Ryan-Realty.com", "Jun 13", dates |
| Row bg | #FFFFFF | Standard data rows |
| Divider | #E8ECF0 | 1 pt hairline, left-inset 16 pt |
| Chevron | #C5CDD4 | Standard > on non-action rows |
| Inquiry icon | #4CAF82 | Two-bubble glyph for registration/inquiry type |
| FAB | #5BA5D8 | 56 pt circle, white + glyph |
| Name text | #FFFFFF | On dark header |
| Status line text | #A8B5C2 | "No communication yet" — muted white-gray |
| Sub-tab inactive | #7A9BB5 | Muted on dark bg |
| Sub-tab active | #FFFFFF + 2 pt #5BA5D8 underline | |

**Typography:**
- Name: ~22 pt, semibold, SF Pro Display or similar
- Section header labels: 11–12 pt, bold, all-caps, tracking ~0.05em
- Row labels: 16 pt, regular, SF Pro Text
- Row values: 15–16 pt, regular (FUB uses system font throughout)
- Sub-tab labels: ~15 pt, medium
- Action link text ("TRANSFER TO LENDER"): 13 pt, bold, all-caps
- Meta/secondary: 13 pt, regular

**Iconography:** SF Symbols or custom FUB glyphs. Inquiry icon = two overlapping filled speech bubbles. Chevron = standard iOS > at ~12 pt.

---

## Interactions & gestures

| Target | Action |
|---|---|
| `<` back chevron | Pop to People list [tap] |
| "Edit" (top right) | Enter edit mode — fields become editable inline [tap] |
| Avatar | [INFERRED] Tap to view/change contact photo |
| Sub-tab: Info | Already active — no-op or scroll to top |
| Sub-tab: Comms | Push to Comms tab (call log, email thread, SMS history) |
| Sub-tab: Homes | Push to Homes tab (saved searches, viewed listings) |
| Sub-tab: Notes | Push to Notes tab (agent notes list) |
| Sub-tab: Calendar | Push to Calendar tab (appointments for this contact) |
| Tags row | Push to tag editor (chip multi-select) |
| Time frame row | Push to time-frame picker (dropdown or segmented options) |
| Collaborators row | Push to collaborator picker (agent list) |
| Lender / TRANSFER TO LENDER | Trigger lender-transfer action sheet or flow |
| Add background row | Push to free-text background field editor |
| Registration inquiry row | Push to inquiry detail screen (source, form data, timestamp) |
| "Add Custom Fields..." | Push to custom field library / field type picker |
| FAB (+) | Present action sheet: add note / log call / send email / create task / etc. |
| Scroll (content area) | Vertical scroll; header stays fixed; FAB stays fixed bottom-right |
| Pull-to-refresh | [INFERRED] Reload contact data from FUB API |

---

## Build notes (component tree)

```
<MobileShell bg="#FFFFFF">

  {/* FIXED HEADER — does not scroll */}
  <ContactDetailHeader bg="#3D5166">
    <StatusBar time="4:58" signal wifi battery={100} textColor="#FFFFFF" />
    <NavBar>
      <BackChevron color="#FFFFFF" onTap={popToPeopleList} />
      <EditButton color="#FFFFFF" onTap={enterEditMode} />
    </NavBar>
    <ContactIdentity>
      <CircleAvatar
        src={contact.photoUrl}
        size={60}           {/* pt */}
        fallback={<Initials name={contact.name} />}
      />
      <Stack gap={4}>
        <Text size={22} weight="semibold" color="#FFFFFF">{contact.name}</Text>
        <Text size={14} color="#A8B5C2">{contact.lastCommSummary ?? "No communication yet"}</Text>
      </Stack>
    </ContactIdentity>
    <SubTabStrip
      tabs={["Info","Comms","Homes","Notes","Calendar"]}
      activeTab="Info"
      activeColor="#FFFFFF"
      activeUnderline="#5BA5D8"   {/* 2pt full-width */}
      inactiveColor="#7A9BB5"
      bg="#3D5166"
      scrollable   {/* horizontal, shows 4–5 tabs at once */}
      onTabChange={setActiveTab}
    />
  </ContactDetailHeader>

  {/* SCROLLABLE BODY */}
  <ScrollView pt={0} pb={80} {/* leave room for FAB + tab bar */}>

    {/* DETAILS */}
    <SectionHeader label="DETAILS" />
    <InfoRow
      label="Tags"
      value={contact.tags.join(", ")}  {/* truncated */}
      onTap={navToTagEditor}
    />
    <InfoRow
      label="Time frame"
      value={contact.timeFrame}
      placeholder
      onTap={navToTimeFramePicker}
    />
    <InfoRow
      label="Collaborators"
      value={contact.collaborators.length === 0 ? "No collaborators" : contact.collaborators.map(c=>c.name).join(", ")}
      onTap={navToCollaboratorPicker}
    />

    {/* FINANCING */}
    <SectionHeader label="FINANCING" />
    <InfoRow
      label="Lender"
      actionLabel="TRANSFER TO LENDER"   {/* all-caps, #5BA5D8, bold 13pt */}
      actionStyle="link"
      onTap={openLenderTransferFlow}
    />

    {/* BACKGROUND */}
    <SectionHeader label="BACKGROUND" />
    <InfoRow
      label="Add background"
      placeholder
      onTap={navToBackgroundEditor}
    />

    {/* INQUIRIES */}
    <SectionHeader label="INQUIRIES" />
    {contact.inquiries.map(inq => (
      <InquiryRow
        key={inq.id}
        icon={<InquiryTypeIcon type={inq.type} color="#4CAF82" size={24} />}
        primaryText={inq.type}           {/* "Registration" */}
        secondaryText={`via: ${inq.source}`}  {/* "via: Ryan-Realty.com" */}
        date={inq.date}                  {/* "Jun 13" */}
        onTap={() => navToInquiryDetail(inq.id)}
      />
    ))}

    {/* CUSTOM FIELDS */}
    <SectionHeader label="CUSTOM FIELDS" />
    <ActionLinkRow
      label="Add Custom Fields..."
      color="#5BA5D8"
      size={16}
      onTap={navToCustomFieldLibrary}
    />

  </ScrollView>

  {/* FLOATING ACTION BUTTON */}
  <FAB
    icon="plus"
    bg="#5BA5D8"
    iconColor="#FFFFFF"
    size={56}
    position="bottom-right"
    insetRight={16}
    insetBottom={80}   {/* above tab bar */}
    onTap={openAddActionSheet}
  />

  {/* BOTTOM TAB BAR — standard FUB nav */}
  <BottomTabBar
    tabs={[
      { label: "Inbox",    icon: "message-bubble" },
      { label: "Activity", icon: "lightning-bolt"  },
      { label: "Calendar", icon: "calendar-grid"   },
      { label: "People",   icon: "person",          active: true },
      { label: "Deals",    icon: "handshake"        },
    ]}
    activeColor="#5BA5D8"
    inactiveColor="#8A9EB0"
    bg="#FFFFFF"
    borderTop="1pt #E8ECF0"
  />

</MobileShell>
```

### Sub-component specs

**SectionHeader**
- Full-width, height 36 pt
- bg: #EEF1F5
- Text: all-caps, 11 pt, bold, #6B7E8E, 16 pt left inset, vertically centered

**InfoRow** (standard data row)
- Height: 44–52 pt (auto, 1–2 lines)
- bg: #FFFFFF
- Divider: 1 pt #E8ECF0, left-inset 16 pt (no full-bleed divider)
- Label: 16 pt regular #8A9EB0, left at x=16
- Value: 15 pt regular #1A2733, right-aligned, max-width ~55% of row
- Chevron: `>` at x=right-16, #C5CDD4
- "placeholder" variant: label takes the gray #8A9EB0 (no distinct value rendered)
- "actionStyle=link" variant: value replaced by all-caps 13 pt bold #5BA5D8 action label

**InquiryRow**
- Height: 60 pt (two lines of text)
- Left icon: 24×24 pt, positioned at x=16, vertically centered
- Primary text: 16 pt semibold #1A2733, at x=52
- Secondary text: 13 pt regular #8A9EB0, at x=52, below primary, 4 pt gap
- Date: 13 pt regular #8A9EB0, right-aligned at x=right-36
- Chevron: #C5CDD4 at x=right-16

**ActionLinkRow**
- Height: 44 pt
- Text: 16 pt regular #5BA5D8 ("Add Custom Fields...")
- No chevron
- Tap: full-row tappable

**CircleAvatar**
- 60 pt diameter, circular clip (border-radius: 50%)
- No ring/border in resting state
- Fallback: two-letter initials on colored bg

**Data bindings:**
- `contact.name` → Name text
- `contact.photoUrl` → Avatar src
- `contact.lastCommSummary` → subtitle (null → "No communication yet")
- `contact.tags[]` → comma-joined, truncated
- `contact.timeFrame` → time frame value
- `contact.collaborators[]` → collaborator list or "No collaborators"
- `contact.lenderId` → lender value (null → show TRANSFER action)
- `contact.background` → background text (null → placeholder)
- `contact.inquiries[]` → inquiry rows (type, source, date)
- `contact.customFields[]` → custom field rows (not shown, empty here)
