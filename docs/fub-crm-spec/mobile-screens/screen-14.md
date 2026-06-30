<!-- Mobile per-screen appendix. Original: IMG_5835.PNG | id: mob-14 | tiles: mob-tiles/mob-14_{full,t,m,b}.png -->

# mob-14 — fub-ios — Contact Detail / Homes Tab

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app — dark teal/slate header, no URL bar, no Safari chrome, sub-tab strip matches FUB contact detail pattern)
- **module:** Contact Detail (Lead Profile)
- **screen:** Contact Detail → "Homes" sub-tab (property inquiry activity view)
- **how to reach:** People tab → tap a contact row → pushes Contact Detail → tap "Homes" sub-tab
- **iOS status bar:** 4:34 (time, left); signal bars (2 of 4 filled) + WiFi icon + "100" battery indicator with charging bolt (right side)
- **URL:** N/A — native app

---

## Screen Regions (top → bottom, 390×844 pt logical)

| Region | y-band (pt) | Height est. | Background |
|---|---|---|---|
| iOS status bar | 0–47 | 47 pt | Dark teal ~#2D4A57 (same as header, blends in) |
| Nav / back bar | 47–90 | 43 pt | Dark teal ~#2D4A57 |
| Contact hero block | 90–200 | 110 pt | Dark teal ~#2D4A57 |
| Sub-tab strip | 200–240 | 40 pt | Dark teal ~#2D4A57 with active underline |
| Section header bar | 240–270 | 30 pt | Light blue-gray ~#EDF0F5 |
| Scrollable content | 270–760 | 490 pt | Light blue-gray ~#EDF0F5 |
| FAB overlay | 700–780 | — | Transparent; FAB floats bottom-right |
| Bottom (no tab bar visible) | 760–844 | 84 pt | Light blue-gray ~#EDF0F5 (tab bar not rendered in this pushed view or scrolled off) |

---

## Nav / Header Bar (exact)

- **Left control:** Back chevron `<` — thin, white, ~20 pt, tappable area ~44×44 pt. No label. Tapping pops the Contact Detail off the navigation stack, returning to People list.
- **Center:** None (no title text in the nav bar row itself; contact info is rendered below in the hero block, not in a nav title)
- **Right controls:** None visible in the back-bar row

---

## Contact Hero Block (exact)

Sits below the back-bar, still on the dark teal header background.

**Avatar:**
- Shape: circle, ~52 pt diameter
- Color: mauve/dusty rose ~#8B6B6B (auto-generated from contact name initial color)
- Content: initials "JL" in white, semibold, ~18 pt

**Name + metadata (right of avatar, vertically stacked):**
- Primary: "Jim Langevin" — white, bold, ~20 pt
- Secondary: "Last communication May 21" — lighter gray-white ~#B0C4CC, regular, ~13 pt

**Price pill badge (below name row):**
- Text: "$655K"
- Background: medium green ~#3BBF8F (pill/rounded-full shape, ~6 pt radius)
- Text color: white, semibold, ~13 pt
- Meaning: lead's price point / budget tier tag

---

## Sub-Tab Strip (exact)

Single horizontal scrollable tab row, full width, on the dark teal background. Visible tabs left-to-right:

| Position | Label | State |
|---|---|---|
| 1 | Info | Inactive — gray-white ~#8FB0BC |
| 2 | Comms | Inactive — gray-white ~#8FB0BC |
| 3 | **Homes** | **ACTIVE** — white, bold; 3 pt solid blue ~#4DA6E8 underline indicator |
| 4 | Notes | Inactive — gray-white ~#8FB0BC |
| 5 | Calend… | Inactive — gray-white ~#8FB0BC (truncated; "Calendar" cut by right edge) |

- Tab strip is horizontally scrollable (Calendar is partially cut, implying more tabs off-screen to the right — likely "Calendar" fully + possibly "Tasks" or "Deals")
- No badge counts on any tab
- Active indicator: short blue underline bar (full width of the tab label), ~3 pt height, color ~#4DA6E8

---

## Bottom Tab Bar

Not visible in this screenshot. This Contact Detail screen is a pushed navigation controller view on top of the People (or Activity) root tab. The native FUB bottom tab bar (Inbox / Activity / Calendar / People / Deals) is present but lies beneath the navigation stack and is hidden/clipped in this pushed context. No FAB replaces it — the "+" FAB is a content-area action (add a home/property to this lead).

---

## Content — Every Element in Order

### Section Header Row (y ~240–270)
- Left: "ACTIVITY" — all-caps, ~11 pt, medium weight, gray ~#8A9BAB, letter-spacing wide
- Right: "SEE ALL" — ~13 pt, teal-blue link color ~#4DA6E8, tappable → pushes full activity list for this contact's Homes tab

### Property Card (y ~270–520)
Single card, white background ~#FFFFFF, rounded corners ~12 pt radius, soft drop shadow. Card width ~195 pt (roughly half the screen width, grid-style — implies multi-column possible when more cards exist).

**Card anatomy top → bottom:**

1. **Listing photo thumbnail:**
   - Size: full card width × ~130 pt tall
   - Content: exterior photo of a single-family home (gray craftsman, green landscaping, blue sky, tall evergreen trees)
   - Overlay badge (top-left of photo): "Property Inquiry" — black pill ~#1A1A1A background, white text ~12 pt, semibold, ~6 pt radius. This is the activity type label.

2. **Price row:**
   - Left: "$655,000" — bold, ~18 pt, dark charcoal ~#1A1A1A
   - Right: "•••" kebab/overflow menu icon — 3 horizontal dots, gray ~#8A9BAB, ~16 pt, tappable → sheet with actions (Save, Share, Remove, etc.)

3. **Bed/bath row:**
   - "3 bd | 3.0 ba" — regular, ~13 pt, gray ~#6B7A86

4. **Address row:**
   - "63091 Desert Sage St,..." — semibold, ~13 pt, dark ~#1A1A1A (truncated with ellipsis — full address continues off-card)

5. **MLS row:**
   - "MLS #220205615" — regular, ~13 pt, dark ~#1A1A1A

6. **View count row:**
   - Left: eye/view icon (outline circle with pupil, ~14 pt) in gray ~#6B7A86
   - Right of icon: "1 view" — regular, ~13 pt, gray ~#6B7A86

### Empty State (y ~520–760)
Large blank area, light blue-gray background ~#EDF0F5. No text, no illustration. Indicates only one property inquiry exists on this contact. Additional cards would fill in here in a grid or vertical scroll layout.

### FAB (Floating Action Button)
- Position: bottom-right corner, ~24 pt margin from right edge, ~80 pt from bottom
- Shape: circle, ~56 pt diameter
- Color: steel/medium blue ~#5BA8CF
- Icon: white "+" (plus), bold, ~24 pt
- Purpose: [INFERRED] Add a new home/saved search or log a property interaction for this contact

---

## Colors, Type & Iconography

| Element | Value |
|---|---|
| Header/hero bg | Dark teal ~#2D4A57 (FUB brand color — NOT navy #102742) |
| Active tab underline / link color | Blue ~#4DA6E8 |
| FAB color | Steel blue ~#5BA8CF |
| Price pill (budget tag) | Green ~#3BBF8F |
| Card bg | White #FFFFFF |
| Page/content bg | Light blue-gray ~#EDF0F5 |
| Primary text | Dark charcoal ~#1A1A1A |
| Secondary/meta text | Gray ~#6B7A86 |
| Inactive tab labels | Gray-white ~#8FB0BC |
| Section header label | Gray ~#8A9BAB |
| Property inquiry badge bg | Near-black ~#1A1A1A |
| Property inquiry badge text | White #FFFFFF |
| "SEE ALL" / link | Teal blue ~#4DA6E8 |
| Avatar bg | Mauve ~#8B6B6B (auto-generated) |
| Avatar initials | White #FFFFFF |
| Font weight impressions | Name: 700; price: 700; address: 600; secondary/meta: 400 |
| Font size impressions | Name 20 pt; price 18 pt; address/MLS 13 pt; badge 12 pt; section header 11 pt |

FUB accent is a teal-blue — **not** Ryan Realty navy #102742 / cream #faf8f4.

---

## Interactions & Gestures [INFERRED]

| Target | Action |
|---|---|
| Back chevron `<` | Pop Contact Detail from nav stack → returns to People list |
| "Info" tab | Switch to Info sub-tab (contact fields: phone, email, source, stage, assigned agent) |
| "Comms" tab | Switch to Comms sub-tab (SMS / email conversation thread) |
| "Homes" tab (current) | Already active — no-op |
| "Notes" tab | Switch to Notes sub-tab (freeform broker notes) |
| "Calendar" tab | Switch to Calendar sub-tab (appointments for this contact) |
| "SEE ALL" link | Push full Homes/Activity list for this contact |
| Property card tap (anywhere except •••) | Navigate to property detail / listing detail view |
| "•••" kebab on card | Present bottom action sheet: options likely include Save Property, Share, Remove from Homes, View on MLS, etc. |
| FAB "+" | Present bottom sheet or modal to add a saved property / home search to this lead |
| Scroll down in content area | Pull more property cards if list is longer |
| Pull-to-refresh | Reload homes/activity data for this contact |
| Long-press card | [INFERRED] Select mode or quick-action menu |

---

## Build Notes (Component Tree)

```
<MobileShell bg="#EDF0F5">

  {/* iOS status bar — rendered natively; in web use a 47pt spacer */}
  <StatusBar bg="#2D4A57" textColor="white" time="4:34" />

  {/* Sticky top header — does not scroll */}
  <StickyHeader bg="#2D4A57">

    <BackBar>
      <BackChevron onPress={popNav} color="white" />
      {/* no center title, no right controls */}
    </BackBar>

    <ContactHero>
      <Avatar
        initials="JL"
        bg="#8B6B6B"   /* auto-color from name hash */
        size={52}
        shape="circle"
        textColor="white"
        fontSize={18}
      />
      <ContactMeta>
        <ContactName text="Jim Langevin" color="white" fontSize={20} fontWeight={700} />
        <LastComm text="Last communication May 21" color="#B0C4CC" fontSize={13} />
        <BudgetPill text="$655K" bg="#3BBF8F" textColor="white" fontSize={13} fontWeight={600} />
      </ContactMeta>
    </ContactHero>

    <SubTabStrip
      tabs={["Info", "Comms", "Homes", "Notes", "Calendar" /*, possibly more */]}
      activeTab="Homes"
      activeColor="white"
      inactiveColor="#8FB0BC"
      activeIndicatorColor="#4DA6E8"
      indicatorHeight={3}
      scrollable={true}
    />

  </StickyHeader>

  {/* Scrollable content below sticky header */}
  <ScrollView>

    <SectionHeader
      label="ACTIVITY"
      labelColor="#8A9BAB"
      labelSize={11}
      labelCase="uppercase"
      rightLink={{ text: "SEE ALL", color: "#4DA6E8", onPress: pushAllActivity }}
      bg="#EDF0F5"
      px={16}
      py={8}
    />

    {/* Card grid — single column at this width but structured for potential 2-col */}
    <CardGrid columns={1} gap={12} px={16}>

      <PropertyCard
        bg="white"
        borderRadius={12}
        shadow={{ color: "#00000018", offset: { y: 2 }, blur: 8 }}
        width={195}   /* ~half-width card implies potential 2-up grid */
      >
        <CardPhoto
          src={listingPhotoUrl}
          height={130}
          borderTopRadius={12}
          overlay={
            <ActivityTypeBadge
              label="Property Inquiry"
              bg="#1A1A1A"
              textColor="white"
              fontSize={12}
              fontWeight={600}
              borderRadius={6}
              position="top-left"
              margin={8}
            />
          }
        />
        <CardBody px={10} py={8} gap={4}>
          <PriceRow>
            <Price text="$655,000" fontSize={18} fontWeight={700} color="#1A1A1A" />
            <KebabMenu icon="•••" color="#8A9BAB" onPress={showCardActions} />
          </PriceRow>
          <BedBath text="3 bd | 3.0 ba" fontSize={13} color="#6B7A86" />
          <Address text="63091 Desert Sage St,..." fontSize={13} fontWeight={600} color="#1A1A1A" truncate />
          <MLSNumber text="MLS #220205615" fontSize={13} color="#1A1A1A" />
          <ViewCount icon="eye-outline" count={1} label="view" fontSize={13} color="#6B7A86" />
        </CardBody>
      </PropertyCard>

    </CardGrid>

    {/* Empty remainder of scroll area — no explicit empty state copy */}
    <EmptyScrollPad height={240} />

  </ScrollView>

  {/* FAB — fixed overlay, not in scroll flow */}
  <FloatingActionButton
    icon="plus"
    bg="#5BA8CF"
    iconColor="white"
    size={56}
    position={{ bottom: 80, right: 24 }}
    onPress={addHomeToContact}
    shadow={{ color: "#00000033", offset: { y: 4 }, blur: 12 }}
  />

  {/* Bottom tab bar NOT rendered in this pushed-nav context */}

</MobileShell>
```

### Data bindings
| Component | Data source |
|---|---|
| ContactHero | `contact.displayName`, `contact.lastCommunicationAt`, `contact.pricePoint` (budget tag) |
| Avatar | `contact.initials`, `contact.avatarColor` (FUB auto-assigns per name hash) |
| BudgetPill | `contact.priceRange` or custom field — rendered as short form e.g. "$655K" |
| PropertyCard | `home_inquiry` activity record: `listPrice`, `beds`, `baths`, `address`, `mlsNumber`, `viewCount`, `activityType`, `photoUrl` |
| ActivityTypeBadge | `activity.type` → "Property Inquiry" label |
| KebabMenu | Opens action sheet bound to `home_inquiry.id` |
| FAB | `onPress` → navigate to "Add Home" flow with `contactId` pre-filled |
| SEE ALL | `onPress` → navigate to `/contacts/:id/homes/all` |

### Spacing / sizing reference (pt, 390-wide canvas)
- Header total height (back bar + hero + sub-tabs): ~193 pt
- Back bar height: 43 pt
- Hero block height: 110 pt (avatar 52 pt + name stack + pill)
- Sub-tab strip height: 40 pt
- Section header row: 30 pt
- Property card width: ~195 pt (half-width with 16 pt margins — 2-up grid implied)
- Property card photo height: ~130 pt
- Property card body height: ~130 pt
- FAB diameter: 56 pt
- FAB margin from right: 24 pt
- FAB margin from bottom: ~80 pt
