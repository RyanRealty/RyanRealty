<!-- Mobile per-screen appendix. Original: IMG_5990.PNG | id: mob-28 | tiles: mob-tiles/mob-28_{full,t,m,b}.png -->

# mob-28 — fub-ios — Contact Detail: Homes Tab (Empty State)

## Identity
- **app_source:** fub-ios (Follow Up Boss native iOS app)
- **module:** Contact Detail (Lead Profile)
- **screen:** Contact Detail sub-tab — "Homes" tab, empty state (no saved/viewed properties)
- **how to reach:** Tap any contact row in People list (or Activity/Inbox result) → contact detail pushes → tap "Homes" in the horizontal sub-tab strip
- **iOS status bar:** Time 8:39 | Signal bars (2 of 4 filled) | WiFi icon | Battery 37% (not charging)
- **URL bar:** N/A — native iOS app, no Safari chrome

---

## Screen regions (y-bands on 390×844 pt logical screen)

| Region | y-band (approx pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | Inherits header dark teal, transparent overlay |
| Nav bar (back + empty) | 54–98 | 44 pt | #3e5060 (dark blue-gray/teal — FUB brand) |
| Contact identity block | 98–178 | 80 pt | #3e5060 (continuous with nav bar) |
| Sub-tab strip | 178–218 | 40 pt | #3e5060 (continuous with header) |
| Scrollable content area | 218–844 | ~626 pt | #eef1f5 (very light blue-gray) |
| FAB (floating, overlays content) | ~750–810 | 56 pt circle | Positioned bottom-right of content area |
| Bottom tab bar | Not visible | — | Off-screen or hidden by this detail view |

---

## Nav / header bar (exact)

**Left control:** `<` back chevron, white, ~20 pt, positioned at x≈18, y≈72 (center). Taps to pop contact detail and return to the previous list (People/Activity/Inbox).

**Center:** Empty — no title text in the nav bar row itself.

**Right controls:** None visible.

**Below nav bar — Contact Identity Block (y 98–178):**
- **Avatar:** Circular photo, ~52 pt diameter, positioned at x≈34 (left-aligned with padding). Real headshot of a man in a dark business suit and tie — Derek Winchell. Circle crop, no border ring visible.
- **Primary name:** "Derek Winchell" — white, ~20 pt, semibold/600 weight, left-aligned, vertically centered with avatar.
- **Subtitle:** "No communication yet" — ~13 pt, muted light-gray (#b0bec5 estimate), regular weight, below name.
- **Right side of identity block:** No controls visible (no phone/email quick-action icons in this state).

---

## Sub-tab strip (exact)

Horizontal scrollable tab bar immediately below the identity block. Background continues the same dark header color (#3e5060).

Tabs in order (left to right as visible — may scroll horizontally; right edge is clipped):

| Tab label | State | Indicator |
|---|---|---|
| Info | Inactive | No underline; text ~#9eb5c8 (muted blue-white) |
| Comms | Inactive | No underline; text ~#9eb5c8 |
| **Homes** | **Active** | Solid blue underline bar (~2 pt tall, #4a90d9 / medium blue); text white |
| Notes | Inactive | No underline; text ~#9eb5c8 |
| Calend[ar] | Inactive (clipped at right edge) | No underline; text ~#9eb5c8 |

Tab font: ~14 pt, medium weight. Active tab: white (#ffffff). Inactive tabs: ~#9eb5c8. Active underline: ~#4a90d9 (FUB accent blue), full tab width, 2 pt height, flush to bottom of strip.

The strip is horizontally scrollable — "Calendar" is clipped, implying at least one more tab exists beyond the viewport (e.g., "Files" or similar).

---

## Bottom tab bar

**Not visible** in this screenshot. FUB iOS hides the bottom tab bar when navigating deep into a contact detail view on this particular layout. The standard FUB bottom tabs (Inbox / Activity / Calendar / People / Deals) would normally appear at ~y 793–844, but they are absent here — the screen is entirely the contact detail + content area.

---

## Right-edge panel handle

A small rounded-rectangle element is visible at the right edge of the screen (x≈374–390, y≈220–280 approximately). It is a dark gray rounded pill containing a `<` left-pointing chevron glyph in white/light color. This is the FUB "slide panel" handle — tapping or swiping it reveals a contextual right-side panel (possibly quick-actions, tags, or a mini-timeline). It sits at the right edge, ~40 pt tall, ~16 pt wide, with a dark charcoal (#333d47 estimate) background and rounded left corners.

---

## Content — Homes tab empty state

The scrollable content area is entirely an empty state for the Homes tab:

**Empty state icon:** Outline-style house icon, centered horizontally at x≈195, y≈330 (approx). Icon is ~80 pt wide × 80 pt tall. Color: muted blue-gray (~#9aabb8). Style: line/outline (not filled), showing a simple house silhouette with a small door rectangle at the base center.

**Empty state headline:** "No Home Searches"
- Font: ~18 pt, semibold/600
- Color: ~#6b7a8d (medium gray-blue)
- Alignment: centered
- y-position: ~430 pt

**Empty state body copy:** "When your client views or saves properties, you'll see them here"
- Font: ~14 pt, regular/400
- Color: ~#8a9bac (lighter gray-blue)
- Alignment: centered, wraps to 2 lines
- Max width: ~280 pt
- y-position: ~460–490 pt

**Below empty state:** Completely empty — no list rows, no filter controls, no search bar, no skeleton rows.

---

## Floating Action Button (FAB)

- **Shape:** Circle, ~56 pt diameter
- **Color:** #5b8db8 / desaturated steel blue (FUB accent, slightly muted — not the vivid blue of a primary CTA; matches FUB's contextual add button style)
- **Icon:** White `+` (plus) glyph, ~22 pt, bold weight, centered
- **Position:** Fixed/floating, bottom-right of content area. x≈334 (right edge of button at ~362), y≈775 center. Clear of keyboard and bottom safe area.
- **Shadow:** Subtle drop shadow below
- **Action [INFERRED]:** Taps to open a sheet/modal to manually add a property search / saved listing / home preference for this contact.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / nav / sub-tab bg | #3e5060 (FUB brand dark teal-navy) |
| Content area bg | #eef1f5 (very light blue-gray) |
| Active tab underline | #4a90d9 (FUB medium blue) |
| Active tab label | #ffffff |
| Inactive tab labels | #9eb5c8 |
| Contact name | #ffffff |
| Contact subtitle | #b0bec5 |
| Empty state icon | #9aabb8 |
| Empty state headline | #6b7a8d |
| Empty state body | #8a9bac |
| FAB circle | #5b8db8 |
| FAB icon | #ffffff |
| Right-edge handle bg | #333d47 |
| Right-edge handle icon | #c8d4de |

**Typography impressions:**
- Contact name: ~20 pt, semibold
- Sub-tab labels: ~14 pt, medium
- Empty state headline: ~18 pt, semibold
- Empty state body: ~14 pt, regular
- All fonts: system San Francisco (SF Pro) — native iOS

**FUB accent color confirmed:** #4a90d9 (blue, not navy #102742 — this is FUB, not the Ryan Realty in-house app).

---

## Interactions & gestures [INFERRED]

| Target | Action |
|---|---|
| `<` back chevron | Pop to previous screen (contact list / activity feed) |
| Avatar photo | Possibly opens photo detail or edit avatar sheet |
| "Derek Winchell" name row | No-op or opens edit contact sheet |
| Sub-tab "Info" | Switches content to contact info fields (name, email, phone, stage, source, tags) |
| Sub-tab "Comms" | Switches to communications history (emails, texts, calls, notes timeline) |
| Sub-tab "Homes" | Current — shows saved/viewed property searches (empty) |
| Sub-tab "Notes" | Switches to contact notes list |
| Sub-tab "Calend[ar]" | Switches to appointments/calendar for this contact |
| Right-edge `<` handle | Swipe right-to-left or tap to open a slide-in right panel (quick context/tags/actions) |
| FAB `+` | Opens bottom sheet: "Add Property Search" or "Send Property Search" options |
| Pull-to-refresh on content area | Refreshes Homes data from server |
| Swipe right anywhere on screen | Back navigation (iOS swipe-from-left-edge gesture) |

---

## Build notes (component tree)

```
<MobileShell safeArea={true}>

  {/* iOS Status Bar */}
  <StatusBar time="8:39" signal={2} wifi={true} battery={37} textColor="white" />

  {/* Sticky header group — does not scroll */}
  <ContactDetailHeader bg="#3e5060">

    {/* Nav row */}
    <NavBar>
      <BackButton icon="chevron-left" color="#ffffff" onTap={popScreen} />
      {/* No title, no right controls */}
    </NavBar>

    {/* Identity block */}
    <ContactIdentityBlock>
      <Avatar
        src={contact.photoUrl}        // real photo of Derek Winchell
        size={52}
        shape="circle"
      />
      <ContactMeta>
        <Text style="contact-name">{contact.name}</Text>           {/* "Derek Winchell" */}
        <Text style="contact-subtitle">{contact.lastCommLabel}</Text> {/* "No communication yet" */}
      </ContactMeta>
      {/* No right-side quick-action icons in this state */}
    </ContactIdentityBlock>

    {/* Sub-tab strip */}
    <HorizontalTabStrip
      tabs={["Info", "Comms", "Homes", "Notes", "Calendar"]}
      activeTab="Homes"
      activeColor="#ffffff"
      inactiveColor="#9eb5c8"
      indicatorColor="#4a90d9"
      indicatorHeight={2}
      scrollable={true}
    />

  </ContactDetailHeader>

  {/* Right-edge slide panel handle */}
  <RightEdgePanelHandle
    icon="chevron-left"
    bg="#333d47"
    position={{ right: 0, top: 220, height: 60 }}
    onTap={openRightPanel}
  />

  {/* Scrollable content area */}
  <ScrollView bg="#eef1f5" flex={1}>

    {/* Homes tab — empty state */}
    <EmptyState
      icon={<HouseOutlineIcon size={80} color="#9aabb8" />}
      headline="No Home Searches"
      headlineStyle={{ fontSize: 18, fontWeight: 600, color: "#6b7a8d" }}
      body="When your client views or saves properties, you'll see them here"
      bodyStyle={{ fontSize: 14, fontWeight: 400, color: "#8a9bac", textAlign: "center", maxWidth: 280 }}
    />

    {/* When populated, this area renders: */}
    {/* <HomeSearchRow
          propertyAddress="..."
          status="Viewed | Saved"
          thumbnail={url}
          viewedAt={date}
          onTap={openPropertyDetail}
        /> */}

  </ScrollView>

  {/* Floating Action Button */}
  <FAB
    icon="plus"
    color="#5b8db8"
    iconColor="#ffffff"
    size={56}
    position={{ bottom: 32, right: 24 }}
    onTap={openAddPropertySearchSheet}
    shadow={true}
  />

  {/* No bottom tab bar — hidden on this contact-detail sub-tab view */}

</MobileShell>
```

### Data bindings
- `contact.id` — used to fetch homes/saved-properties from FUB API: `GET /v1/people/{id}/properties` or equivalent
- `contact.name` → "Derek Winchell"
- `contact.photoUrl` → headshot displayed in avatar
- `contact.lastCommLabel` → "No communication yet" (derived: null `last_contacted` timestamp → this label)
- `homesData` → array; length === 0 triggers `<EmptyState />`; length > 0 renders `<HomeSearchRow />` list

### Spacing/sizing details
- Header block total height: ~164 pt (54 status + 44 nav + 80 identity + 40 sub-tabs = 218 pt from top)
- Avatar: 52 pt circle, left margin ~16 pt
- Contact name left margin: ~80 pt (avatar 52 + gap 12 + left 16)
- Sub-tab strip height: 40 pt, horizontal padding ~16 pt from left edge per tab
- FAB bottom offset: ~32 pt from bottom safe area edge
- FAB right offset: ~24 pt from right edge
- Empty state centered vertically in available content area (~y 310–490 pt)

### Notes for web rebuild
- The FUB accent blue (#4a90d9) is used for the active tab indicator, the FAB, and any selected/active interactive elements — NOT the Ryan Realty navy. Do not substitute #102742.
- The header dark teal (#3e5060) is FUB brand, not Ryan Realty navy.
- The sub-tab strip must be horizontally scrollable with at least 5 tabs (Info, Comms, Homes, Notes, Calendar) — possibly more clipped at right.
- The right-edge panel handle is a distinctive FUB UX pattern — a semi-floating rounded pill anchored to the right edge of the header/content boundary.
- No bottom tab bar is rendered on this screen; the parent shell's bottom tabs are suppressed while in the contact-detail hierarchy.
