<!-- Mobile per-screen appendix. Original: IMG_6027.PNG | id: mob-56 | tiles: mob-tiles/mob-56_{full,t,m,b}.png -->

# mob-56 — fub-ios — Contact Address / Property Map Detail

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app — dark teal/slate header, back-chevron nav, no browser chrome, no bottom tab bar visible at this nav depth)
- **module:** Contact Detail (Lead Profile) — property address sub-view
- **screen:** Address / Map detail card pushed from a lead's profile. Shows the geocoded property address on an embedded Google Map, the raw address text, a truncated lead note containing the home-valuation source URL, and a "Directions" CTA.
- **how to reach:** On a lead's profile screen tap the address field / map thumbnail → this full-screen address detail pushes onto the stack. Accessible within any lead that has a property address (here: a Seller Inquiry lead).
- **iOS status bar:** 7:45 (time, white, left) · signal bars (2 of 4 lit, right cluster) · WiFi icon · Battery 16% (yellow/amber low-battery indicator, numeric label visible)
- **URL bar:** N/A — native app, no Safari chrome

---

## Screen regions (y-bands, 390×844 pt logical)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–44 | 44 | Transparent over header (#3d4f63 shows through) |
| Nav / header bar | 44–88 | 44 | Dark teal-slate ~#3d4f63 |
| Google Maps embed | 88–380 | ~292 | Google Maps tile layer (light road map, beige/grey roads) |
| Address + note content | 380–640 | ~260 | White #ffffff |
| Empty whitespace | 640–844 | ~204 | White #ffffff |
| Bottom tab bar | NOT VISIBLE — sub-screen push, tabs hidden by navigation stack depth | — | — |

---

## Nav / header bar (exact)

- **Left control:** Back chevron `<` — plain white, ~18pt, tappable full left quadrant (~44×44 pt hit target), pops this view off the navigation stack back to the lead profile
- **Center:** Title text **"Seller Inquiry"** — white, ~17pt semibold, centered; this is the lead type / source label used as the screen title
- **Right controls:** None visible (no search, bell, kebab, or edit icons in this detail view)

---

## Bottom tab bar (exact)

**Not visible at this nav depth.** This screen is a push navigation child; FUB hides the tab bar when navigating deep into a contact's sub-detail. The parent tab (likely People or Inbox) carries the tab bar but it is not rendered on this pushed screen.

---

## Content — every element, in order

### 1. Google Maps Embed (y ~88–380 pt)

- Full-width interactive Google Maps tile view embedded in the scroll content, pinned at the top of the scroll area
- **Pin:** Single red teardrop marker (standard Google Maps pin) placed on the geocoded address: **20702 Beaumont Dr, Bend, Oregon 97701**
- **Map viewport:** Zoomed to approximately zoom level 14, showing a ~2 km radius around the pin. Visible landmarks and labels on the map:
  - "Covered Bridge" (road label, upper area)
  - "Collective Communities / Juniper Hilltop MHC" (pink label with lodging icon)
  - "Apex Earthworks" (grey POI label with circular icon)
  - "Northpointe Park" (green label with tree icon)
  - "Volvo Cars Bend" (truncated at left edge)
  - US Route 97 shield (highway marker, blue circle with "97")
  - "Best Western Bend North" (pink lodging label, partially visible)
  - "Emery Plum..." (truncated at right edge)
  - "Hunters Cr" (road label)
  - "High Stanlind Dr" (road label)
  - "Wigontre Way" (road label)
  - "Cooley Rd" (road label, appears twice — main road running east-west)
  - "Paramount Dr" (road label, left side)
  - Google Maps wordmark + "Bus 97" transit overlay badge in the bottom-left corner
- **Map interaction:** Tappable — tapping the map likely opens Apple Maps or Google Maps app for full navigation. Pinch-zoom and pan also [INFERRED] functional.
- **Floating action button on map (top-right corner of map, ~y 340, x 350):** Small circular icon, appears to be a message/envelope glyph in white on a dark circular badge — [INFERRED] taps to compose message to the lead

### 2. Address Block (y ~385–445 pt)

- Left-aligned, 16 pt horizontal padding
- **Line 1:** `20702 Beaumont Dr` — dark near-black text (~#1a1a1a), ~20pt, bold/semibold weight
- **Line 2:** `Bend, Oregon 97701` — same dark near-black text, ~16pt, regular weight
- Vertical gap of ~12 pt between map bottom and this block

### 3. Note / Description Block (y ~465–560 pt)

- Left-aligned, 16 pt horizontal padding
- Multi-line truncated text in ~14pt regular weight, dark grey ~#333333:
  - `[HOME VALUATION] Source: https://ryan-` (line 1)
  - `realty.com/free-h ome-valuation/ Address: 20702` (line 2 — note: there is a space mid-URL "free-h ome-valuation" visible, likely a line-wrap artifact in the raw note data)
  - `Beaumont Drive, Bend, Oregon 97701,` (line 3, truncated with trailing comma)
- **"See more" link:** Inline at end of the truncated text on line 3, teal/blue color ~#007AFF (iOS link blue), ~14pt — taps to expand the full note text in a modal or inline expansion
- This block represents the raw lead note FUB received from the home-valuation form submission on ryan-realty.com

### 4. Directions Button (y ~580–620 pt)

- Outlined/ghost-style pill button, ~240 pt wide, ~44 pt tall
- Border: 1pt solid light grey ~#d0d0d0, rounded corners ~8pt radius
- Background: light grey ~#f5f5f5
- **Icon:** Map pin / location glyph (grey, ~16pt) left of label
- **Label:** `Directions` — grey text ~#666666, ~15pt medium weight
- Tap behavior [INFERRED]: Opens Apple Maps (or Google Maps if set as default) with turn-by-turn directions to 20702 Beaumont Dr, Bend, Oregon 97701

### 5. Empty whitespace (y ~640–844 pt)

- Plain white — no content. Either the scrollable view ends here or additional content is above the fold in a longer version.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header background | Dark teal-slate ~#3d4f63 (FUB's standard dark header) |
| Header title text | White #ffffff, SF Pro Display ~17pt semibold |
| Back chevron | White #ffffff, SF Symbols chevron.left |
| Address text (primary) | Near-black ~#1a1a1a, ~20pt semibold |
| Address text (secondary) | Near-black ~#1a1a1a, ~16pt regular |
| Note body text | Dark grey ~#333333, ~14pt regular |
| "See more" link | iOS blue ~#007AFF, ~14pt regular |
| Directions button border | Light grey ~#d0d0d0 |
| Directions button bg | Near-white grey ~#f5f5f5 |
| Directions button text | Medium grey ~#666666, ~15pt medium |
| Directions icon | Grey map pin glyph ~#888888 |
| Page background | White #ffffff |
| Map | Google Maps standard light road style (beige/cream land, grey roads, blue water) |
| Battery indicator | Amber/yellow (low battery <20%) |

**FUB accent color** in this screen is the standard teal header (~#3d4f63); no in-house navy #102742 present — this is definitively the FUB native iOS app.

---

## Interactions & gestures [INFERRED unless noted]

| Target | Action |
|---|---|
| Back chevron `<` | Pop this screen off nav stack → return to lead's full profile |
| Google Maps embed (tap) | Open native Maps app at the pinned address |
| Google Maps embed (pinch/pan) | Zoom/pan the embedded map |
| Floating envelope/message icon (map top-right) | Compose message / email to lead |
| "See more" teal link | Expand truncated note inline or push a full note detail view |
| "Directions" button | Open Maps app with directions to the property address |
| Pull-to-refresh (top) | Reload lead data from FUB servers |
| Swipe right from left edge | Pop nav stack (iOS standard back gesture) |

---

## Build notes (component tree)

```
<MobileShell maxW="390" bg="#ffffff">

  <IOSStatusBar time="7:45" signalBars={2} wifi battery={16} batteryColor="amber" />

  <TopBar bg="#3d4f63" height={44}>
    <BackButton icon="chevron.left" color="#ffffff" onTap={navPop} />
    <Title text="Seller Inquiry" color="#ffffff" size={17} weight="semibold" align="center" />
    {/* no right controls */}
  </TopBar>

  <ScrollView flex={1} bg="#ffffff">

    {/* === MAP SECTION === */}
    <GoogleMapsEmbed
      height={292}
      width="100%"
      center={{ lat: 44.103, lng: -121.305 }}  // approx Beaumont Dr, Bend OR
      zoom={14}
      marker={{ lat: 44.103, lng: -121.305, color: "red" }}
      interactive={true}
      onTap={openNativeMaps}
    />
    {/* Floating action button overlaid on map, top-right */}
    <FloatingMapAction
      position="absolute"
      top={mapBottom - 40}
      right={12}
      icon="envelope"
      bg="#3d4f63"
      color="#ffffff"
      size={36}
      onTap={composeMessage}
    />

    {/* === ADDRESS BLOCK === */}
    <View px={16} pt={16} pb={8}>
      <Text size={20} weight="semibold" color="#1a1a1a">20702 Beaumont Dr</Text>
      <Text size={16} weight="regular" color="#1a1a1a" mt={2}>Bend, Oregon 97701</Text>
    </View>

    {/* === NOTE / DESCRIPTION BLOCK === */}
    <View px={16} pt={12} pb={8}>
      <TruncatedText
        numLines={3}
        size={14}
        weight="regular"
        color="#333333"
        text="[HOME VALUATION] Source: https://ryan-realty.com/free-home-valuation/ Address: 20702 Beaumont Drive, Bend, Oregon 97701, ..."
      />
      <SeeMoreLink
        color="#007AFF"
        size={14}
        inline={true}
        onTap={expandNote}
      />
    </View>

    {/* === DIRECTIONS BUTTON === */}
    <View px={16} pt={20}>
      <OutlinedButton
        width={240}
        height={44}
        borderColor="#d0d0d0"
        borderRadius={8}
        bg="#f5f5f5"
        icon="mappin"
        iconColor="#888888"
        label="Directions"
        labelColor="#666666"
        labelSize={15}
        labelWeight="medium"
        onTap={() => openNativeDirections("20702 Beaumont Dr, Bend, Oregon 97701")}
      />
    </View>

    {/* Empty space — natural scroll bottom */}
    <View height={200} />

  </ScrollView>

  {/* No bottom tab bar at this nav depth */}

</MobileShell>
```

### Data bindings

| Component | Data source |
|---|---|
| TopBar title "Seller Inquiry" | `lead.type` or `lead.source` from FUB contact record |
| Map center + marker | Geocoded from `lead.address` (street + city + state + zip) |
| Address lines | `lead.streetAddress`, `lead.city`, `lead.state`, `lead.zip` |
| Note body | `lead.notes[0].body` (raw FUB note text, may contain structured form submission data) |
| Directions target | Concatenated address string from `lead.address` fields |

### Spacing / sizing notes

- Map embed: full bleed, ~292 pt tall, no border radius (flush to edges)
- Horizontal content padding: 16 pt on both sides
- Address block top padding: 16 pt from map bottom
- Gap between address block and note block: ~12 pt
- Directions button: not full-width — approximately 240 pt wide, left-aligned with 16 pt left pad
- No dividers between sections (clean white bg throughout)
- Font stack: SF Pro (system default on iOS) for all text; no custom fonts visible in this sub-view
