<!-- Mobile per-screen appendix. Original: IMG_6020.PNG | id: mob-52 | tiles: mob-tiles/mob-52_{full,t,m,b}.png -->

# mob-52 — fub-ios — Contact Detail / Lead Profile (Info tab)

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app)
- **module:** Contact Detail (Lead Profile)
- **screen:** Lead Profile — Info sub-tab for contact "Mary Bowman"
- **how to reach:** Tap any contact row in People tab (or a lead row in Activity/Inbox) → pushes this detail screen
- **iOS status bar:** 7:44 · signal 2/4 bars · WiFi · battery 16% (yellow warning icon)
- **URL bar:** N/A — native app, no browser chrome

---

## Screen regions (top → bottom, y-bands on 390×844 pt logical screen)

| Region | Approx y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–44 | 44 pt | Dark teal ~`#3a4f5e` (blends into header) |
| Nav bar | 44–88 | 44 pt | Dark teal ~`#3a4f5e` |
| Contact identity header | 88–168 | ~80 pt | Dark teal ~`#3a4f5e` |
| Sub-tab strip | 168–212 | ~44 pt | Dark teal ~`#3a4f5e` (active indicator below) |
| Scrollable content | 212–810 | ~598 pt | White `#ffffff` with section-header separators ~`#f0f2f5` |
| FAB (floating) | ~720–776 (fixed) | 56 pt | Blue ~`#4a9fd4` circle, bottom-right overlay |
| Bottom tab bar | ~810–844 | Not visible in screenshot (hidden or below crop) | — |

---

## Nav / header bar (exact)

**Background:** Dark teal/slate ~`#3a4f5e` spanning status bar + nav bar + identity header + sub-tab strip as one unified surface.

**Nav bar row (y ~44–88):**
- **Left:** `<` back chevron glyph — white, ~17pt, approximately 20 pt tap width; tapping pops back to the contact list
- **Center:** empty (no title text in the nav bar itself — the contact name lives in the identity header below)
- **Right:** "Edit" — plain white text button, ~16pt medium weight; tapping enters edit mode for the contact record

**Contact identity header (y ~88–168):**
- **Avatar:** Circle ~48 pt diameter; background color mid purple-slate ~`#6272a4` (auto-generated from initials); white initials "MB" in ~16pt semibold centered; no border ring
- **Name:** "Mary Bowman" — white, ~20pt bold/semibold, left-aligned to avatar's right
- **Subtitle:** "Last communication Jun 22" — muted grey ~`#b0bec5`, ~13pt regular, below the name

**Sub-tab strip (y ~168–212):**
Horizontally scrollable tab list. Tabs visible left-to-right:
1. **Info** — white text, ~14pt medium, **active**: solid blue underline indicator ~3 pt tall, bright blue ~`#4a9fd4`
2. **Comms** — muted grey ~`#8fa8b8`, ~14pt regular, inactive
3. **Homes** — muted grey, ~14pt regular, inactive
4. **Notes** — muted grey, ~14pt regular, inactive
5. **Calen...** — truncated (full label "Calendar"), muted grey, inactive; more tabs likely scroll right (Tasks, Files, etc.)

Tab strip background matches the dark teal header. No divider between strip and content — a sharp color break transitions to white content.

---

## Bottom tab bar (exact)

**NOT visible in this screenshot.** The screenshot crops at the ADDRESS section content. In FUB iOS, the standard bottom tab bar contains (left to right): **Inbox · Activity · Calendar · People · Deals**. On the Contact Detail screen the tab bar may be hidden to maximize content vertical space, or the screenshot simply cuts it off before the home indicator / tab bar region.

**FAB (Floating Action Button):**
- Blue circle ~56 pt, color ~`#4a9fd4` (same blue as active tab indicator)
- White `+` (plus) icon centered, ~24 pt
- Position: fixed bottom-right of the content area, approximately x=318 y=720 (above any tab bar)
- Tapping opens an action sheet / modal to add: Note, Task, Email, Text, Call, Appointment, etc.

---

## Content — every element, in order

All content is in a vertically scrollable white region below the tab strip. Section headers are all-caps bold on a light grey separator band. Detail rows are white with hairline grey dividers (~`#e5e8ec`, 1px).

---

### Section: DETAILS

**Section header:** "DETAILS" — all caps, ~11pt bold, dark grey ~`#6b7280`, background ~`#f0f2f5`, height ~32 pt, left-padded ~16 pt.

**Row — Stage:**
- Left label: "Stage" — grey ~`#8fa8b8`, ~15pt regular
- Right value: "Active Client" — dark ~`#2c3e50`, ~15pt regular
- Right: `>` chevron, grey
- Tap: opens stage picker modal (pipeline stages list)
- Hairline divider below

**Row — Source:**
- Left label: "Source" — grey
- Right value: "Import" — dark
- Right: `>` chevron
- Tap: opens source picker

**Row — Tags:**
- Left label: "Tags" — grey
- Right value: "audience:buyer, Bend, Buyer, city:ben..." — dark, truncated with ellipsis because value exceeds available width
  - Full tag list would be: audience:buyer, Bend, Buyer, city:bend (or city:bend... longer value)
- Right: `>` chevron
- Tap: opens tag editor

**Row — Time frame:**
- Left label: "Time frame" — grey
- Right value: (empty — no value set)
- Right: `>` chevron
- Tap: opens time frame picker (buying/selling timeline options)

**Row — Collaborators:**
- Left label: "Collaborators" — grey
- Right value: "No collaborators" — dark
- Right: `>` chevron
- Tap: opens collaborator assignment screen

---

### Section: FINANCING

**Section header:** "FINANCING" — same all-caps style as DETAILS, grey bg band ~`#f0f2f5`.

**Row — Lender:**
- Left label: "Lender" — grey
- Right value: "TRANSFER TO LENDER" — ALL CAPS, bright blue ~`#4a9fd4`, bold ~14pt; this is an actionable CTA, not a static value
- Right: `>` chevron (blue tinted, matches CTA color)
- Tap: navigates to lender referral / transfer flow within FUB

---

### Section: BACKGROUND

**Section header:** "BACKGROUND" — all-caps, grey bg band.

**Row — Add background:**
- Full-width row: "Add background" — placeholder grey text ~`#8fa8b8`, ~15pt
- Right: `>` chevron
- Tap: opens text entry or notes field for background info about the contact
- No existing value set

---

### Section: ADDRESS

**Section header:** "ADDRESS" — all-caps, grey bg band.

**Address entry 1 — (home):**
- Type label: "(home)" — dark text ~`#2c3e50`, ~14pt regular, top line
- Address line 1: "13651 Amberview Pl" — blue link text ~`#4a9fd4`, ~14pt (tappable — opens Maps)
- Address line 2: "Eastvale, CA, 92880" — blue link text ~`#4a9fd4`, ~14pt
- Right side: no icon visible (FAB overlaps this area)
- Tap: opens native iOS Maps with address pre-filled
- Hairline divider below

**Address entry 2 — (Property):**
- Type label: "(Property)" — dark text ~`#2c3e50`, ~14pt regular
- Address line 1: "20702 Beaumont Dr" — blue link text ~`#4a9fd4` (full city/state not visible; screen cuts off)
- Right side: grey diamond navigation/directions icon (~20 pt) — tapping this opens turn-by-turn directions or Maps
- This row is partially cut off at the bottom of the screenshot

*Additional content likely scrolls below: more address lines, phone numbers, email addresses, notes, custom fields, etc.*

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / nav bg | Dark teal ~`#3a4f5e` |
| Active tab underline / FAB / CTA / address links | Bright blue ~`#4a9fd4` |
| Active tab text | White `#ffffff` |
| Inactive tab text | Muted grey ~`#8fa8b8` |
| Contact name (header) | White `#ffffff` |
| Last communication subtitle | Light grey ~`#b0bec5` |
| Avatar bg (initials, auto) | Purple-slate ~`#6272a4` |
| Avatar initials text | White `#ffffff` |
| Section header bg | Light grey ~`#f0f2f5` |
| Section header text | Dark grey ~`#6b7280`, all-caps, ~11pt bold |
| Row label text | Muted grey ~`#8fa8b8`, ~15pt regular |
| Row value text (standard) | Dark ~`#2c3e50`, ~15pt regular |
| Row value text (empty/placeholder) | Muted grey ~`#8fa8b8` |
| Row divider | Hairline ~`#e5e8ec`, 1 pt |
| Chevron `>` | Grey ~`#c0cad4` |
| "TRANSFER TO LENDER" CTA | Blue ~`#4a9fd4`, all-caps bold |
| FAB circle | Blue ~`#4a9fd4` |
| FAB icon | White `+` |
| Address navigation icon | Grey ~`#b0bec5` diamond/arrow glyph |
| Battery warning | Yellow `#f5a623` (at 16%) |

**Typography impressions:**
- Nav "Edit": ~16pt medium, white
- Contact name: ~20pt semibold, white
- Sub-tab labels: ~14pt medium (active) / regular (inactive)
- Section headers: ~11pt bold uppercase
- Row labels: ~15pt regular
- Row values: ~15pt regular
- Address lines: ~14pt regular

**Iconography:**
- Back chevron: standard iOS `<` shape, white
- `>` chevron on rows: SF Symbols `chevron.right`, grey
- FAB `+`: SF Symbols `plus`, white in circle
- Address navigation: diamond/turn-arrow glyph, grey (~`#b0bec5`)

---

## Interactions & gestures (mark [INFERRED])

- **Tap back chevron** → pops to previous list (People list / Activity feed / wherever navigation came from)
- **Tap "Edit"** → transitions to edit mode; all row fields become editable inline or push edit screens [INFERRED]
- **Tap avatar** → [INFERRED] opens avatar picker or contact photo options
- **Tap sub-tab (Comms / Homes / Notes / Calendar...)** → swaps the scrollable content region to that tab's content; same header stays fixed
- **Swipe left/right on content** → [INFERRED] switches between sub-tabs (horizontal swipe gesture)
- **Tap Stage row** → opens pipeline stage picker sheet
- **Tap Source row** → opens source picker sheet
- **Tap Tags row** → opens tag editor (add/remove tags)
- **Tap Time frame row** → opens time frame picker
- **Tap Collaborators row** → opens broker/team member picker
- **Tap "TRANSFER TO LENDER"** → opens lender transfer workflow (email/assign to lender partner)
- **Tap "Add background"** → opens text editor for background notes
- **Tap address lines (blue)** → opens Apple Maps with address; triggers iOS Maps app
- **Tap address navigation icon** → [INFERRED] opens turn-by-turn directions
- **Tap FAB `+`** → presents action sheet bottom-up with options: Add Note, Add Task, Log Call, Send Email, Send Text, Schedule Appointment, etc.
- **Pull to refresh** → [INFERRED] re-fetches contact data from FUB API
- **Long press on row** → [INFERRED] no standard FUB long-press behavior; rows are tap-only
- **Scroll down** → reveals more fields below (phone, email, custom fields, relationships, etc.)

---

## Build notes (component tree)

```
<ContactDetailShell>                          // full-screen container, dark teal bg for header area

  <IOSStatusBar time="7:44" signal=2 wifi battery=16 />

  <ContactDetailHeader bg="#3a4f5e">
    <NavBar>
      <BackButton icon="chevron.left" color="#ffffff" onTap={popNavigation} />
      <EditButton label="Edit" color="#ffffff" onTap={enterEditMode} />
    </NavBar>

    <ContactIdentity>
      <InitialsAvatar
        initials="MB"
        size={48}
        bgColor="#6272a4"           // auto-computed from name hash
        textColor="#ffffff"
        fontSize={16}
      />
      <ContactName text="Mary Bowman" color="#ffffff" fontSize={20} weight="semibold" />
      <LastCommLabel text="Last communication Jun 22" color="#b0bec5" fontSize={13} />
    </ContactIdentity>

    <SubTabStrip
      activeTab="Info"
      tabs={["Info","Comms","Homes","Notes","Calendar","Tasks","Files"]}
      activeColor="#4a9fd4"
      inactiveColor="#8fa8b8"
      indicatorStyle="underline"    // 3pt bottom border on active tab
      scrollable={true}
    />
  </ContactDetailHeader>

  <ScrollableContent bg="#ffffff">

    <SectionGroup label="DETAILS">
      <DetailRow
        label="Stage"
        value="Active Client"
        hasChevron={true}
        onTap={() => openStagePicker()}
      />
      <DetailRow
        label="Source"
        value="Import"
        hasChevron={true}
        onTap={() => openSourcePicker()}
      />
      <DetailRow
        label="Tags"
        value="audience:buyer, Bend, Buyer, city:ben..."
        valueTruncated={true}
        hasChevron={true}
        onTap={() => openTagEditor()}
      />
      <DetailRow
        label="Time frame"
        value={null}                 // empty
        hasChevron={true}
        onTap={() => openTimeframePicker()}
      />
      <DetailRow
        label="Collaborators"
        value="No collaborators"
        hasChevron={true}
        onTap={() => openCollaboratorPicker()}
      />
    </SectionGroup>

    <SectionGroup label="FINANCING">
      <DetailRow
        label="Lender"
        valueNode={
          <CTAText text="TRANSFER TO LENDER" color="#4a9fd4" allCaps bold />
        }
        hasChevron={true}
        chevronColor="#4a9fd4"
        onTap={() => openLenderTransferFlow()}
      />
    </SectionGroup>

    <SectionGroup label="BACKGROUND">
      <DetailRow
        label={null}
        placeholderText="Add background"
        value={null}
        hasChevron={true}
        onTap={() => openBackgroundEditor()}
      />
    </SectionGroup>

    <SectionGroup label="ADDRESS">
      <AddressRow
        type="home"
        line1="13651 Amberview Pl"
        line2="Eastvale, CA, 92880"
        linkColor="#4a9fd4"
        onTapAddress={() => openMaps("13651 Amberview Pl, Eastvale, CA 92880")}
      />
      <AddressRow
        type="Property"
        line1="20702 Beaumont Dr"
        line2="..."                 // city/state not visible
        linkColor="#4a9fd4"
        showNavIcon={true}          // grey diamond turn-by-turn icon
        onTapAddress={() => openMaps("20702 Beaumont Dr")}
        onTapNav={() => openDirections("20702 Beaumont Dr")}
      />
      {/* More address rows may appear below */}
    </SectionGroup>

  </ScrollableContent>

  <FAB
    icon="plus"
    bgColor="#4a9fd4"
    iconColor="#ffffff"
    size={56}
    position="bottom-right"
    offset={{ bottom: 24, right: 16 }}
    onTap={() => openActivityActionSheet()}
  />

</ContactDetailShell>
```

**Spacing/sizing notes:**
- Row height: ~52 pt (label + value single line), ~64–72 pt for multi-line address rows
- Row horizontal padding: 16 pt left, 16 pt right
- Section header height: ~32 pt, same 16 pt left padding
- Dividers: 1 pt hairline at `#e5e8ec`, full bleed left to right (no left inset)
- Avatar: 48 pt circle, 12 pt gap to name column
- Nav bar: 44 pt height; "Edit" right-padded 16 pt
- FAB: 56 pt circle, z-index above scroll content, semi-overlaps last visible row
- Sub-tab strip height: ~44 pt; tab label min-width ensures equal spacing or left-align with 16 pt first-tab left padding

**Data bindings:**
- `contact.firstName + contact.lastName` → name + initials
- `contact.lastCommunicationAt` → "Last communication Jun 22"
- `contact.stage` → Stage value
- `contact.source` → Source value
- `contact.tags[]` → Tags (comma-joined, truncated)
- `contact.timeframe` → Time frame value
- `contact.collaborators[]` → "No collaborators" if empty
- `contact.lender` → Lender (null triggers "TRANSFER TO LENDER" CTA)
- `contact.background` → Background (null triggers placeholder)
- `contact.addresses[]` → Address rows (type, line1, line2)
