<!-- Mobile per-screen appendix. Original: IMG_5991.PNG | id: mob-29 | tiles: mob-tiles/mob-29_{full,t,m,b}.png -->

# mob-29 — fub-ios — Contact Detail / Homes Tab

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app — confirmed by dark slate-teal header, circular avatar in nav bar, "Last communication" subtitle, horizontally scrollable sub-tab strip Info/Comms/Homes/Notes/Calendar, and FUB's characteristic property card design)
- **module:** Contact Detail (Lead Profile) — Homes sub-tab
- **screen:** Contact detail view for lead "Tide Rivers", currently showing the Homes tab with a property inquiry card under an "ACTIVITY" section header
- **how to reach:** From any lead list (Inbox, People, Activity feed) → tap a lead row → lands on Info tab → tap "Homes" sub-tab
- **iOS status bar:** Time "8:40" (left, white), signal bars + WiFi icon + "37" battery indicator with border (right, white) — all white on the dark teal header
- **URL bar:** N/A — native iOS app, no browser chrome

---

## Screen regions (y-bands, 390×844 pt logical)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–47 | 47 | Dark slate-teal (same as header, transparent blend) |
| Nav / header bar (back + avatar + name + subtitle) | 47–130 | 83 | Dark slate-teal ~#3D5568 |
| Sub-tab strip (Info / Comms / Homes / Notes / Calend…) | 130–172 | 42 | Same dark slate-teal ~#3D5568 |
| Scrollable content area | 172–800 | 628 | Light blue-gray ~#EBF0F5 |
| FAB (+) button | floating at ~y=750 x=338 | — | Muted steel-blue circle |
| Bottom edge / home indicator zone | 800–844 | 44 | Same light blue-gray |

No visible bottom tab bar in this view — FUB's contact detail screen displaces the global tab bar in favor of the sub-tab strip.

---

## Nav / header bar (exact)

**Left control:** Back chevron `‹` — white, ~22pt, positioned ~x=16. Taps to navigate back to the lead list (People tab or wherever this contact was opened from).

**Center/Left block (avatar + name + subtitle):**
- Circular avatar, ~52×52 pt, positioned immediately right of the back chevron (~x=40). Contains a photo — appears to be a book cover image ("Rivers to the Sea" with ocean/wave imagery). Border: none visible. Background: the image fills the circle.
- **Contact name:** "Tide Rivers" — white text, ~19pt, semibold (SF Pro Semibold equivalent). Positioned to the right of the avatar.
- **Subtitle:** "Last communication Jun 14" — white text, ~13pt, regular weight, muted white (~rgba(255,255,255,0.70)). Below the name.

**Right controls:** None visible in this header (no search, bell, or kebab icons).

---

## Sub-tab strip (exact)

Horizontal scrollable strip, same dark teal background as header, tabs separated by equal spacing. No visible divider line between header and sub-tabs — they share the same bg.

Tabs in order (left to right, with rightmost truncated due to screen width):

| Tab label | State | Text color | Indicator |
|---|---|---|---|
| Info | inactive | White ~60% opacity (~#FFFFFF99) | none |
| Comms | inactive | White ~60% opacity | none |
| **Homes** | **ACTIVE** | **White 100%** | 2–3 pt bright teal-blue underline ~#4BA3E3, full tab width |
| Notes | inactive | White ~60% opacity | none |
| Calend… | inactive (truncated) | White ~60% opacity | none — "ar" is cut off |

Tab font: ~14pt, regular weight. Active tab is white + has the solid underline indicator. The strip is horizontally scrollable to reveal additional tabs (Calendar at minimum; possibly Tasks, Deals beyond).

---

## Bottom tab bar

**Not visible** in this screen. FUB's contact detail view occupies the full viewport height and suppresses the global bottom tab bar (Inbox / Activity / Calendar / People / Deals). The FAB (+) appears in its place at the bottom-right corner.

---

## Floating Action Button (FAB)

- **Shape:** Circle, ~56 pt diameter
- **Color:** Muted steel-blue ~#6B93C4 (desaturated, not the bright FUB teal — blends with the light bg)
- **Icon:** White "+" (plus sign), ~22 pt, centered
- **Position:** Bottom-right corner, ~x=338, y=750 (above home indicator zone)
- **Action [INFERRED]:** Opens a bottom sheet or modal to add a new home/property inquiry to this contact (Add Property, Add Inquiry, or Link Listing)

---

## Right-edge panel handle

At approximately x=375–390, y=360–430, there is a partially visible gray rounded-rectangle pull handle with a left-pointing chevron `‹` (white). This is a collapsed side panel — likely a "next/prev contact" navigation drawer or a property detail peek panel. Background ~#B0B8C4 (medium gray). Width ~18 pt, height ~70 pt, rounded-left corners.

---

## Content — every element, in order

### Section header: ACTIVITY

- y ~180–206 pt
- Left label: "ACTIVITY" — all-caps, ~12pt, letter-spaced, medium gray ~#8A9BAD (muted secondary text)
- Right label: "SEE ALL" — same size, bright teal-blue ~#4BA3E3, tappable link → [INFERRED] opens full activity/history list for this contact's homes/property inquiries
- Background: same light blue-gray as content area
- Horizontal padding: 16 pt each side

### Property inquiry card

- y ~210–460 pt (approx 250 pt tall)
- **Container:** White #FFFFFF, rounded corners ~12 pt, subtle box shadow (~0 2px 8px rgba(0,0,0,0.08)), 16 pt horizontal margin on left (right side partially cut off — card extends ~230 pt wide and the next card begins off-screen to the right, indicating this is a horizontal carousel/scroll)
- **Internal layout (top to bottom):**

  **Card image zone** (top ~120 pt of card):
  - Light blue-gray background ~#EBF0F5 (placeholder — no listing photo loaded)
  - Centered house icon glyph (~40×40 pt), medium gray ~#9AACBA (FUB's default empty-listing placeholder icon — a solid filled house/home silhouette)
  - **Pill badge (top-left of image zone):** Black background #1A1A1A, white text "Seller Inquiry", ~11pt semibold, horizontal padding ~8pt, vertical padding ~4pt, border-radius ~12pt (pill). Positioned ~8 pt from top-left corner of image zone.

  **Card body** (bottom ~130 pt):
  - Top row: "Price unavailable" (left, ~14pt, dark gray ~#2C3E50, semibold) + "•••" kebab menu (right, ~16pt, dark gray, tappable → property action menu)
  - Second row: "20889 SE Caldera Dr, B…" — address, ~13pt, dark gray ~#4A5568, truncated with ellipsis (full address likely "20889 SE Caldera Dr, Bend, OR" or "Brothers, OR")
  - Third row: "MLS ID unavailable" — ~12pt, medium gray ~#8A9BAD
  - Fourth row: Eye icon (outline, ~14pt, medium gray) + "1 view" (~12pt, medium gray ~#8A9BAD) — view count for this listing

- **Card horizontal scroll context [INFERRED]:** This is the first card in a horizontally-scrollable carousel of property inquiry cards for this contact. The right edge is clipped, suggesting at least a second card exists off-screen.

### Empty area below cards

- y ~470–790 pt
- Completely empty, same light blue-gray ~#EBF0F5 background
- No further content, empty states, or pagination indicators visible

---

## Colors, type & iconography

| Element | Color | Notes |
|---|---|---|
| Header / sub-tab bg | ~#3D5568 (dark slate-teal) | FUB's characteristic dark nav bar |
| Sub-tab active underline | ~#4BA3E3 (bright teal-blue) | FUB accent color |
| "SEE ALL" link | ~#4BA3E3 | Same FUB accent |
| Content bg | ~#EBF0F5 (light blue-gray) | FUB's standard content area bg |
| Card bg | #FFFFFF | Pure white |
| Card shadow | rgba(0,0,0,0.08) | Subtle |
| "Seller Inquiry" pill bg | #1A1A1A (near-black) | Black pill, white text |
| Price / address text (primary) | ~#2C3E50 (dark slate) | Semibold ~14pt |
| Secondary text (MLS, views) | ~#8A9BAD (medium gray) | Regular ~12pt |
| House placeholder icon | ~#9AACBA (muted blue-gray) | Filled house glyph |
| FAB bg | ~#6B93C4 (muted steel-blue) | 56 pt circle |
| Right handle | ~#B0B8C4 (medium gray) | Collapsed panel pull handle |
| Status bar / nav text | #FFFFFF | White on dark header |
| Active tab label | #FFFFFF | Full opacity |
| Inactive tab label | rgba(255,255,255,0.60) | Dimmed white |

**Font impressions:** SF Pro (system font for FUB iOS). Contact name ~19pt semibold. Subtitle ~13pt regular. Sub-tab labels ~14pt regular/medium. Card primary text ~14pt semibold. Card secondary ~12–13pt regular. Section header "ACTIVITY" ~11–12pt medium, all-caps, letter-spaced.

**Icons:** All use SF Symbols or FUB's custom glyph set. House = filled home silhouette. Eye = outline eye (view count). Kebab = three horizontal dots. Back = left-pointing chevron.

---

## Interactions & gestures

- **Tap back chevron** → pops back to the lead list or previous screen [INFERRED]
- **Tap avatar** → [INFERRED] opens contact photo viewer or edit-contact flow
- **Tap "SEE ALL"** → pushes full activity/property history list for this contact
- **Horizontal swipe on card carousel** → scrolls to next/previous property inquiry cards [INFERRED from carousel layout]
- **Tap property card body** → [INFERRED] opens property detail/inquiry detail screen
- **Tap "•••" kebab on card** → opens action sheet with options (Edit, Archive, Delete, Share inquiry) [INFERRED]
- **Tap FAB (+)** → opens bottom sheet to add new property interest / inquiry to this contact [INFERRED]
- **Tap sub-tabs** → switches between Info / Comms / Homes / Notes / Calendar sections without navigation push (in-place content swap)
- **Tap right-edge panel handle** → expands or reveals a side panel (next/prev contact navigation or property peek) [INFERRED]
- **Pull-to-refresh on content area** → refreshes homes/activity data [INFERRED]
- **Swipe card left** → [INFERRED] may reveal quick-action buttons (Archive, Delete) per FUB card conventions

---

## Build notes (component tree)

```tsx
<MobileShell bg="#EBF0F5">

  {/* iOS status bar — native, no rebuild needed */}
  <StatusBar style="light" bg="#3D5568" />

  {/* Header: back + contact identity */}
  <ContactDetailHeader bg="#3D5568">
    <BackButton icon="chevron-left" color="#FFFFFF" onTap={goBack} />
    <ContactAvatar
      src={contact.photoUrl}       // "Tide Rivers" book-cover image
      size={52}
      shape="circle"
    />
    <ContactIdentityBlock>
      <ContactName
        text="Tide Rivers"
        style={{ color: "#FFF", fontSize: 19, fontWeight: "600" }}
      />
      <LastCommsLabel
        text="Last communication Jun 14"
        style={{ color: "rgba(255,255,255,0.70)", fontSize: 13 }}
      />
    </ContactIdentityBlock>
    {/* No right-side controls on this screen */}
  </ContactDetailHeader>

  {/* Sub-tab strip — horizontally scrollable */}
  <SubTabStrip bg="#3D5568" activeColor="#FFF" inactiveColor="rgba(255,255,255,0.60)" indicatorColor="#4BA3E3">
    <SubTab label="Info" active={false} onTap={() => setTab("info")} />
    <SubTab label="Comms" active={false} onTap={() => setTab("comms")} />
    <SubTab label="Homes" active={true} onTap={() => setTab("homes")} />
    <SubTab label="Notes" active={false} onTap={() => setTab("notes")} />
    <SubTab label="Calendar" active={false} onTap={() => setTab("calendar")} />
    {/* Additional tabs may exist beyond screen width */}
  </SubTabStrip>

  {/* Scrollable content area */}
  <ScrollView flex={1} bg="#EBF0F5" px={0}>

    {/* Section header row */}
    <SectionHeader
      label="ACTIVITY"
      labelStyle={{ color: "#8A9BAD", fontSize: 12, letterSpacing: 0.8, fontWeight: "500", textTransform: "uppercase" }}
      rightAction={{ label: "SEE ALL", color: "#4BA3E3", onTap: openFullActivity }}
      px={16}
      py={12}
    />

    {/* Horizontal carousel of property inquiry cards */}
    <HorizontalScrollView px={16} gap={12}>
      <PropertyInquiryCard
        /* Card container */
        bg="#FFFFFF"
        borderRadius={12}
        shadow="0 2px 8px rgba(0,0,0,0.08)"
        width={214}   // approximate — clips to show next card exists

        /* Image zone (top) */
        imageZoneBg="#EBF0F5"
        imageZoneHeight={120}
        imageSrc={null}  // no photo — shows placeholder
        placeholderIcon="house.fill"   // SF Symbol home glyph
        placeholderIconColor="#9AACBA"
        placeholderIconSize={40}

        /* Inquiry type pill (overlaid top-left of image zone) */
        badgeLabel="Seller Inquiry"
        badgeBg="#1A1A1A"
        badgeTextColor="#FFFFFF"
        badgeFontSize={11}
        badgePadding="4px 8px"
        badgeBorderRadius={12}

        /* Card body */
        priceLabel="Price unavailable"
        priceLabelStyle={{ fontSize: 14, fontWeight: "600", color: "#2C3E50" }}
        kebabMenu={true}   // "•••" opens action sheet

        addressLine="20889 SE Caldera Dr, B…"
        addressStyle={{ fontSize: 13, color: "#4A5568" }}

        mlsLine="MLS ID unavailable"
        mlsStyle={{ fontSize: 12, color: "#8A9BAD" }}

        viewCount={1}
        viewIcon="eye"   // outline eye glyph
        viewStyle={{ fontSize: 12, color: "#8A9BAD" }}

        onTap={openPropertyDetail}
      />
      {/* Additional cards scrollable off right edge */}
    </HorizontalScrollView>

    {/* Empty area — no more content */}
    <Spacer flex={1} />

  </ScrollView>

  {/* Collapsed side-panel handle (right edge) */}
  <PanelHandle
    side="right"
    bg="#B0B8C4"
    icon="chevron-left"
    iconColor="#FFFFFF"
    width={18}
    height={70}
    borderRadius="8px 0 0 8px"
    position="absolute"
    top={360}
    right={0}
    onTap={expandSidePanel}
  />

  {/* FAB — Add property inquiry */}
  <FAB
    icon="plus"
    bg="#6B93C4"
    iconColor="#FFFFFF"
    size={56}
    position="absolute"
    bottom={56}
    right={20}
    onTap={openAddPropertySheet}
  />

</MobileShell>
```

### Data bindings
- `contact.id` → drives all sub-tab content queries
- `contact.name` → "Tide Rivers"
- `contact.photoUrl` → avatar image (book cover)
- `contact.lastCommunicationDate` → "Jun 14" (formatted from ISO date)
- `contact.propertyInquiries[]` → array driving the horizontal carousel; each item: `{ inquiryType, price, address, mlsId, viewCount, imageUrl }`
- `inquiryType` → pill badge text ("Seller Inquiry", "Buyer Inquiry", etc.)

### Key spacing/sizing
- Header total height (nav + sub-tabs): ~130 pt
- Sub-tab strip height: 42 pt (including ~3 pt underline indicator at bottom)
- Section header row height: ~44 pt
- Property card width: ~214 pt (leaves ~16 pt peek of next card at right edge when 16 pt left-padded)
- Property card total height: ~250 pt (120 pt image zone + ~130 pt body)
- Card body internal vertical padding: 12 pt top/bottom, 12 pt horizontal
- FAB diameter: 56 pt, bottom-right with 56 pt bottom clearance and 20 pt right clearance
- Content area horizontal padding: 16 pt (applied to section header; cards start at 16 pt from left)
