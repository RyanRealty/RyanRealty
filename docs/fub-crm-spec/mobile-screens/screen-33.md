<!-- Mobile per-screen appendix. Original: IMG_5997.PNG | id: mob-33 | tiles: mob-tiles/mob-33_{full,t,m,b}.png -->

# mob-33 — fub-ios — Contact Detail · Homes Tab

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app)
- **module:** Contact Detail (Lead Profile)
- **screen:** Contact Detail — "Homes" sub-tab, showing saved-search / property-view activity
- **how to reach:** People tab → tap any contact row → tap the "Homes" sub-tab in the detail header strip
- **iOS status bar:** 8:44 (time, left), signal bars (2 of 4 filled) + WiFi icon + battery 37% (right)
- **URL bar:** none (native iOS app, not web)

---

## Screen regions (y-bands on 390×844 pt logical screen)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–47 | 47 | #3A4451 (dark slate, continuous with header) |
| Nav / header bar | 47–120 | ~73 | #3A4451 dark slate/charcoal |
| Contact identity row | 120–188 | ~68 | #3A4451 (same, part of header block) |
| Sub-tab strip | 188–228 | ~40 | #3A4451 fading to lighter, or same dark |
| Section header ("ACTIVITY / SEE ALL") | 228–258 | ~30 | #EEF0F4 light blue-gray |
| Horizontal property card scroll | 258–510 | ~252 | #EEF0F4 |
| Empty content area | 510–844 | ~334 | #EEF0F4 |
| FAB (floating, not a region per se) | ~760–820 (bottom-right) | 56 dia. | #6B8DB8 steel-blue circle |

No bottom tab bar is visible in this screenshot — FUB iOS hides the tab bar when pushed into a contact detail view on this version.

---

## Nav / header bar (exact)

**Left control:** Back chevron `<` — white, ~22pt, tap navigates back to the People list (or prior screen).

**Center / identity block (below chevron, occupying full header width):**
- Avatar: filled circle ~50 pt diameter, purple/violet bg ~#7B68B0, white initials **"MR"** (Montserrat/SF-Pro-Rounded bold, ~18pt)
- Primary name: **"Matthew Ryan"** — white, bold, ~18pt
- Sub-label: **"No communication yet"** — medium-gray ~#9EA8B8, ~13pt, below name

**Right controls:** none visible in the header bar row.

**Sub-tab strip** (immediately below identity block, same dark-bg zone):
- Tabs in order: **Info** · **Comms** · **Homes** · **Notes** · **Calend** (truncated — "Calendar" continues off-screen right)
- All tab labels ~13pt, inactive = medium-gray ~#8A95A3
- Active tab = **Homes** — white text + solid teal/blue underline indicator bar ~2 pt, color ~#2B8CC4
- Strip scrollable horizontally to reveal "Calendar" (and possibly more tabs)

---

## Bottom tab bar
**Not visible in this screenshot.** FUB iOS suppresses the tab bar on pushed contact-detail screens. When navigated back to the People list the standard 5-tab bar (Inbox / Activity / Calendar / People / Deals) re-appears.

**FAB (Floating Action Button):**
- Position: fixed, bottom-right of viewport, ~16 pt from right edge, ~80 pt from bottom
- Shape: circle, ~56 pt diameter
- Color: steel-blue ~#6B8DB8 (softer/lighter than accent teal)
- Icon: white **+** (plus), ~24 pt
- Action [INFERRED]: opens a contextual action sheet — likely "Add Note / Log Call / Send Email / Add Task / Schedule Showing" for this contact

---

## Content — every element, in order

### Section header row (y ~228–258)
- Left: **"ACTIVITY"** — all-caps, letter-spaced, ~11pt, medium-gray ~#8A9BB0 (muted label)
- Right: **"SEE ALL"** — teal ~#2B8CC4, ~13pt, tappable → pushes to full property activity list for this contact
- Divider: none explicit; section bg is #EEF0F4 contrasting with card area

### Horizontal property card scroll (y ~258–510)
Horizontally scrollable 2-up grid of property cards. A right-pointing chevron `>` is partially visible at the right edge (~375pt x) in a light pill, indicating more cards beyond the visible 2.

**Scroll container:** horizontal `ScrollView` (or `FlatList horizontal`), padding ~12pt left, card gap ~10pt. Cards do NOT fill the full width — each card is ~170 pt wide × ~210 pt tall (estimated), with bottom white-card body below the photo.

---

#### Property Card 1
**Photo area** (~170×110 pt):
- Landscape aerial/drone photo: wide meadow with mountain range in background, blue sky, green trees — Oregon/Bend-area scenery
- **"Viewed" badge:** top-left of photo, small rounded pill, black bg ~#1A1A1A, white text "Viewed", ~10pt, ~4pt corner radius
- **Price overlay banner:** bottom of photo, semi-transparent gold/amber band, text ~"$6,999,000" — but this price is shown from MLS metadata on the photo; in the card body it reads "Price unavailable" (MLS resolution failure)
- Faint address text in the photo overlay (illegible at this resolution — appears to be street address snippet)

**Card body** (white bg, ~170×100 pt, rounded-bottom ~8pt):
- Row 1: **"Price unavailable"** — dark gray ~#2D3748, ~13pt semibold + **"•••"** right-aligned (3-dot overflow/kebab menu, teal ~#2B8CC4)
- Row 2: **"67480 Cloverdale, Ben..."** — truncated with ellipsis, ~12pt, gray ~#5A6473
- Row 3: **"MLS ID unavailable"** — ~11pt, muted gray ~#8A95A3
- Row 4: Eye icon (outline, ~12pt) + **"1 view"** — gray ~#8A95A3, ~11pt

---

#### Property Card 2
**Photo area** (~170×110 pt):
- Aerial/drone photo: dense evergreen forest with river/creek winding through, lush green, Pacific Northwest scene
- **"Viewed" badge:** top-left, identical pill styling to Card 1 — black bg, white "Viewed"
- **Price overlay banner:** bottom of photo, similar gold/amber band, text appears ~"$11,900,000" or "$1,500,000" (partially legible) — raw MLS price metadata
- Faint address text in photo overlay

**Card body** (white bg, same dimensions):
- Row 1: **"Price unavailable"** + **"•••"** (kebab, teal)
- Row 2: **"65255 Swalley, Bend,..."** — truncated
- Row 3: **"MLS #220207865"** — ~11pt, muted gray (MLS number successfully resolved, unlike Card 1)
- Row 4: Eye icon + **"5 views"**

---

#### Right-edge scroll indicator
- A `<` chevron in a light rounded rectangle pill is visible partially cropped at the right viewport edge (~375pt x, vertically centered in the card row ~y 380)
- Color: light gray bg, dark gray chevron
- Tap: [INFERRED] advances carousel by one card

---

### Empty content area (y ~510–760)
- Background: #EEF0F4 (same as content zone)
- No content — this contact has only 2 viewed properties in their activity feed
- No empty-state illustration or message visible within this region

---

## Colors, type & iconography

| Element | Color | Notes |
|---|---|---|
| Header / nav bg | ~#3A4451 | Dark slate — FUB's standard dark teal-gray header |
| Avatar bg | ~#7B68B0 | Purple/violet — auto-assigned color for "M" initials |
| Avatar initials | #FFFFFF | "MR" |
| Active tab text | #FFFFFF | "Homes" |
| Active tab underline | ~#2B8CC4 | FUB brand teal/blue |
| Inactive tab text | ~#8A9BB0 | Muted gray |
| Contact name | #FFFFFF | Bold ~18pt |
| Contact sub-label | ~#9EA8B8 | "No communication yet" |
| Content area bg | ~#EEF0F4 | Very light blue-gray |
| Card bg | #FFFFFF | White with rounded corners ~8pt |
| "ACTIVITY" label | ~#8A9BB0 | All-caps muted label |
| "SEE ALL" | ~#2B8CC4 | FUB accent teal |
| Card primary text | ~#2D3748 | "Price unavailable" |
| Card secondary text | ~#5A6473 | Address line |
| Card tertiary text | ~#8A95A3 | MLS line, view count |
| "•••" kebab | ~#2B8CC4 | Teal, tappable |
| "Viewed" badge bg | ~#1A1A1A | Near-black pill |
| "Viewed" badge text | #FFFFFF | ~10pt |
| Price overlay band | ~#D4AF37 / amber | Bottom of listing photo |
| Eye icon | ~#8A95A3 | Outline glyph |
| FAB bg | ~#6B8DB8 | Steel-blue (lighter than accent) |
| FAB icon | #FFFFFF | Plus glyph |
| Back chevron | #FFFFFF | ~22pt |

**Typography impressions:**
- Contact name: SF Pro Display or Semibold, ~18pt, white
- Sub-tabs: SF Pro Text regular ~13pt, active = white, inactive = gray
- Section label ("ACTIVITY"): SF Pro Text, all-caps, tracked, ~11pt, muted
- Card price line: SF Pro Text semibold ~13pt
- Card address/MLS: SF Pro Text regular ~12–11pt

**FUB accent color: ~#2B8CC4 (blue-teal)** — confirmed on active tab underline and "SEE ALL" + "•••" buttons.
In-house app uses navy #102742 / cream #faf8f4 — this is NOT that; this is the FUB native app.

---

## Interactions & gestures

| Target | Action |
|---|---|
| `<` back chevron | Pop navigation stack → return to People list |
| Avatar circle | [INFERRED] No tap action on detail screen; possibly opens photo picker |
| "Info" sub-tab | Switches to Info panel (contact fields: phone, email, source, tags, pipeline stage) |
| "Comms" sub-tab | Switches to Comms panel (message thread / email history) |
| "Homes" sub-tab | Currently active — property activity feed |
| "Notes" sub-tab | Switches to Notes panel |
| "Calend(ar)" sub-tab | Switches to Calendar panel (showings, appointments) |
| "SEE ALL" | Pushes full property activity list for this contact |
| Property card tap | [INFERRED] Pushes listing detail view (full MLS detail for that property) |
| "•••" kebab on card | [INFERRED] Presents bottom action sheet — options like "Remove from Homes", "Share", "Mark as Favorite" |
| Eye icon / view count row | [INFERRED] No separate tap; part of card tap |
| Carousel right chevron `>` | [INFERRED] Scrolls/advances to next property card(s) |
| Horizontal swipe on card row | Scrolls carousel horizontally to reveal more Viewed properties |
| FAB `+` | [INFERRED] Presents bottom action sheet — "Add Note / Log Call / Send Text / Send Email / Create Task / Schedule Appointment" |
| Pull-to-refresh on content area | [INFERRED] Refreshes Homes activity feed from FUB |

---

## Build notes (component tree)

```
<MobileShell bg="#EEF0F4">

  {/* iOS Status Bar — handled by system */}
  <StatusBar style="light" />

  {/* Header Block — dark slate, contains nav + identity + sub-tabs */}
  <ContactDetailHeader bg="#3A4451">

    <NavRow>
      <BackChevron onPress={goBack} color="#FFF" size={22} />
    </NavRow>

    <IdentityRow pt={8} pb={12} px={16}>
      <Avatar
        initials="MR"
        bg="#7B68B0"
        size={50}
        textColor="#FFF"
        textSize={18}
      />
      <VStack ml={12}>
        <Text style={styles.contactName}>Matthew Ryan</Text>
        <Text style={styles.contactSubLabel}>No communication yet</Text>
      </VStack>
    </IdentityRow>

    <SubTabStrip
      tabs={["Info", "Comms", "Homes", "Notes", "Calendar"]}
      activeTab="Homes"
      activeColor="#2B8CC4"
      inactiveColor="#8A9BB0"
      activeTextColor="#FFFFFF"
      inactiveTextColor="#8A9BB0"
      indicatorHeight={2}
      scrollable={true}
    />

  </ContactDetailHeader>

  {/* Scrollable Content */}
  <ScrollView>

    {/* Activity Section */}
    <SectionHeaderRow px={16} py={10}>
      <Text style={styles.sectionLabel}>ACTIVITY</Text>
      <TouchableOpacity onPress={navigateToAllActivity}>
        <Text style={styles.seeAll}>SEE ALL</Text>
      </TouchableOpacity>
    </SectionHeaderRow>

    {/* Horizontal Property Card Carousel */}
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingLeft: 12, gap: 10 }}
      data={homesActivity}   // array of { status, photo, price, address, mlsId, viewCount }
      renderItem={({ item }) => (
        <PropertyActivityCard
          width={170}
          onPress={() => navigateToListing(item.mlsId)}
        >
          <CardPhoto
            uri={item.photoUrl}
            height={110}
            borderRadiusTop={8}
          >
            <ViewedBadge label={item.status} />   {/* "Viewed" black pill, top-left */}
            <PriceOverlayBand price={item.rawPrice} />  {/* amber band, bottom of photo */}
          </CardPhoto>

          <CardBody bg="#FFF" borderRadiusBottom={8} px={10} py={8}>
            <Row justifyContent="space-between">
              <Text style={styles.priceText}>
                {item.price ?? "Price unavailable"}
              </Text>
              <KebabMenu color="#2B8CC4" onPress={() => openCardMenu(item)} />
            </Row>
            <Text style={styles.addressText} numberOfLines={1}>
              {item.address}
            </Text>
            <Text style={styles.mlsText}>
              {item.mlsId ? `MLS #${item.mlsId}` : "MLS ID unavailable"}
            </Text>
            <Row mt={4} gap={4}>
              <EyeIcon size={12} color="#8A95A3" />
              <Text style={styles.viewCount}>{item.viewCount} view{item.viewCount !== 1 ? 's' : ''}</Text>
            </Row>
          </CardBody>

        </PropertyActivityCard>
      )}
      keyExtractor={(item) => item.mlsId ?? item.address}
    />

    {/* Carousel right-edge affordance — semi-transparent chevron pill */}
    <CarouselNextPill onPress={scrollCarouselRight} />

    {/* Empty space — no more content for this contact */}
    <Spacer height={300} />

  </ScrollView>

  {/* FAB — fixed position, bottom-right */}
  <FAB
    icon="plus"
    bg="#6B8DB8"
    iconColor="#FFFFFF"
    size={56}
    position="absolute"
    bottom={80}
    right={16}
    onPress={openContactActionSheet}
  />

</MobileShell>
```

### Data bindings
| Field | Source | Notes |
|---|---|---|
| Contact name | `people.name` | "Matthew Ryan" |
| Contact initials | Derived from `people.name` | "MR" |
| Avatar color | Auto-assigned per FUB's initial-color palette | Purple ~#7B68B0 |
| Sub-label | Derived from `people.lastContacted` | null → "No communication yet" |
| `homesActivity[]` | `people/{id}/homes` FUB endpoint | Array of saved/viewed properties |
| `item.status` | Activity type | "Viewed" |
| `item.photoUrl` | MLS photo URL from saved search | May be Spark/Bridge API photo |
| `item.rawPrice` | MLS `ListPrice` at time of view | Shown in photo overlay |
| `item.price` | Resolved current price | null → "Price unavailable" (MLS resolution failure) |
| `item.address` | MLS `UnparsedAddress` | "67480 Cloverdale, Ben..." (truncated) |
| `item.mlsId` | MLS listing key | null → "MLS ID unavailable"; "220207865" |
| `item.viewCount` | Count from FUB homes tracking | 1, 5 |

### Spacing / sizing notes
- Header block total height: ~181 pt (47 status + 44 nav + 68 identity + 40 sub-tabs — approximate; FUB uses a large header pattern)
- Card width: ~170 pt; card height: ~215 pt (110 photo + ~105 body)
- Card gap: ~10 pt; left padding: ~12 pt
- "ACTIVITY" / "SEE ALL" row: 30 pt tall, 16 pt horizontal padding
- FAB: 56 pt diameter, positioned ~80 pt from bottom, 16 pt from right
- Sub-tab strip: ~40 pt tall, each tab ~65–75 pt wide (scrollable)
