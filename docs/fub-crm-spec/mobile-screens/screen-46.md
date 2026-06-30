<!-- Mobile per-screen appendix. Original: IMG_6014.PNG | id: mob-46 | tiles: mob-tiles/mob-46_{full,t,m,b}.png -->

# mob-46 — inhouse-web — Contact Detail: Custom Fields

## Identity
- **app_source:** inhouse-web
- **module:** Contact Detail (Lead Profile) — Custom Fields sub-section
- **screen:** Custom fields panel within a contact's profile page
- **how to reach:** People tab → tap contact row → scroll to or tap into "Custom fields" section
- **iOS status bar:** 7:39 (left), signal bars (2/4 filled) + WiFi + battery 17% yellow (right)
- **URL bar:** `ryan-realty.com` (centered, plain text in Safari address bar)

---

## Screen regions (y-bands on 390×844pt logical screen)

| Region | y-band (approx pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54pt | #FFFFFF / transparent |
| Safari URL bar | 54–88 | 34pt | #F2F2F7 (system gray) — shows "ryan-realty.com" centered |
| App header / nav bar | 88–148 | 60pt | #FFFFFF with bottom border ~#E5E7EB |
| Scrollable content area | 148–780 | 632pt | #FFFFFF (outer) / #FFFFFF (card) |
| Bottom tab bar | 780–844 | 64pt | #FFFFFF with top border ~#E5E7EB |
| Safari chrome row | 844–890 | ~46pt | #F2F2F7 (system) — back/fwd/share/tabs |

The content area has a visible left-edge vertical line at ~x=46pt that acts as a card inset border (color ~#E5E7EB), suggesting the custom-fields content sits inside a card or indented panel within the wider contact detail page.

---

## Nav / header bar (exact)

**Left:** hamburger / menu icon (≡, three horizontal lines, ~20×16pt, color #1A1A2E / navy), tappable; opens side drawer or nav menu.

**Center:** Ryan Realty wordmark in Amboqia Boriango display font — "Ryan Realty" in navy (#102742), bold/display weight, ~22pt; subtitle "BEND·OREGON" in all-caps tracking underneath, ~9pt, navy, centered. Entire logo is centered in the header.

**Right controls (left to right):**
1. Search icon — inside a rounded-rectangle button (border ~#D1D5DB, bg #FFFFFF, radius ~10pt, ~36×36pt). Magnifying glass glyph, color #6B7280.
2. "M" avatar — circular button (~36×36pt, bg #9CA3AF medium gray), white uppercase letter "M", represents Matt's session account.

---

## Bottom tab bar (exact)

Five tabs, evenly spaced, each with icon (outline glyph ~24pt) above label (~10pt):

| Order | Icon glyph | Label | Badge | Active? |
|---|---|---|---|---|
| 1 | House outline | Home | none | inactive — #9CA3AF |
| 2 | Inbox tray / envelope outline | Inbox | none | inactive — #9CA3AF |
| 3 | Two-person silhouette (group icon) | **People** | none | **ACTIVE** — #102742 navy, label bold |
| 4 | Stacked layers / stack icon | Deals | none | inactive — #9CA3AF |
| 5 | Waveform / pulse line (activity) | Activity | none | inactive — #9CA3AF |

**FAB:** Large circular button (~56pt diameter), bg navy-blue (#1D4ED8 or #2563EB — bright blue, not the brand navy), white "+" icon centered, positioned at bottom-right ~x=340pt, y=720pt (overlapping content above the tab bar). Tapping creates a new contact or action [INFERRED].

---

## Content — every element, in order

### Section heading
- **"Custom fields"** — large text, ~22–24pt, font-weight 700, color #111827 (near-black), left-aligned, ~24pt top padding from header.
- No back button visible in content; navigation back is via iOS swipe-right or Safari back.

---

### Group: ENGAGEMENT (read-only fields)

**Section label:** "ENGAGEMENT" — uppercase, ~11pt, font-weight 600, color #6B7280 (medium gray), left-aligned, ~16pt top margin above it.

Each field row below is structured:
- **Left:** field label text (~15pt, color #6B7280, regular weight)
- **Right:** value — em-dash `—` (~15pt, color #6B7280) for empty/null; NO "Edit" button (these fields are system-computed / read-only)
- **Divider:** thin 1pt line ~#F3F4F6 between rows
- Row height: ~44pt

Fields in ENGAGEMENT group (all show `—`):
1. Lead Score
2. Seller Score
3. Lead Tier
4. Engagement Streak Days
5. Last Active Date
6. Listings Viewed
7. Listings Saved
8. CMA Downloads

---

### Group: BUYER (editable fields)

**Section label:** "BUYER" — same style as ENGAGEMENT header (uppercase, 11pt, #6B7280, font-weight 600).

Each field row:
- **Left:** field label text (~15pt, color #6B7280)
- **Center-right:** value — em-dash `—` for empty
- **Right:** "Edit" text link — ~14pt, color #6B7280, regular weight (tapping opens an inline edit input or modal sheet [INFERRED])
- Row height: ~48pt

Fields in BUYER group (all show `—  Edit`):
1. Buyer Budget Min
2. Buyer Budget Max
3. Buyer Search Areas
4. Preferred Communities
5. Preferred Beds
6. Preferred Baths
7. Preferred Property Type
8. Move Timeline

---

### Group: SELLER (partially visible)

**Section label:** "SELLER" — same uppercase style, visible at very bottom of scroll area before tab bar. Fields are cut off / below viewport. Content continues below.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| App header bg | #FFFFFF |
| Header border | ~#E5E7EB (1pt) |
| Logo / brand text | #102742 (navy) |
| Active tab label + icon | #102742 (navy) |
| Inactive tab label + icon | #9CA3AF (gray-400) |
| Section group headers | #6B7280 (gray-500), uppercase, ~11pt, font-weight 600 |
| Field label text | #6B7280 (gray-500), ~15pt, weight 400 |
| Empty value (em-dash) | #6B7280 (gray-500), ~15pt |
| "Edit" action text | #6B7280 (gray-500), ~14pt, weight 400; tappable |
| Page heading "Custom fields" | #111827 (gray-900), ~22pt, weight 700 |
| Content bg | #FFFFFF |
| Row dividers | ~#F3F4F6 (gray-100), 1pt |
| Card left-border line | ~#E5E7EB, 1pt, at x≈46pt |
| FAB bg | #2563EB (blue-600) |
| FAB icon | #FFFFFF |
| "M" avatar bg | #9CA3AF |
| Search button border | #D1D5DB |
| Battery indicator | Yellow (~17%) |

**Fonts:** Amboqia Boriango for the Ryan Realty wordmark; Geist (or system sans) for all UI/body text.

**Iconography style:** Outline/stroke icons throughout (home, inbox, people, deals, activity). No filled icons in inactive state. Active "People" icon uses the same outline at navy color (#102742).

---

## Interactions & gestures

- **Tap "Edit" (any editable field):** Opens an inline edit input or bottom sheet with a text field / picker for that specific custom field value. Tapping outside or "Save" commits the value. [INFERRED]
- **Tap field row in ENGAGEMENT group:** No action — these are read-only computed fields. [INFERRED from absence of Edit button]
- **Tap "M" avatar (top right):** Opens account/profile settings or broker switcher. [INFERRED]
- **Tap search icon (top right):** Opens global search overlay / modal within the CRM. [INFERRED]
- **Tap hamburger (top left):** Opens side-drawer navigation. [INFERRED]
- **Tap FAB (+):** Creates a new contact (People context — FAB is visible on People tab flows). [INFERRED]
- **Swipe right (iOS):** Navigates back to the contact detail or contact list. [INFERRED]
- **Pull to refresh:** Refreshes custom field values from server. [INFERRED]
- **Scroll up/down in content:** Reveals remaining SELLER group fields and any additional groups below. Vertical scrollbar indicator visible on right edge (~x=385pt).
- **Tap bottom tab (Home/Inbox/Deals/Activity):** Switches to that module root screen.
- **Tap "People" tab (active):** May scroll to top of People list or no-op. [INFERRED]

---

## Build notes (component tree)

```
<MobileShell>

  {/* Safari URL bar — not rendered by app; native Safari chrome */}
  <SafariAddressBar url="ryan-realty.com" />

  <TopBar>
    <HamburgerButton onPress={openDrawer} />         {/* ≡ icon, 20pt, navy */}
    <BrandLogo
      wordmark="Ryan Realty"                          {/* Amboqia, ~22pt, navy */}
      subtitle="BEND·OREGON"                          {/* AzoSans caps, 9pt */}
    />
    <TopBarActions>
      <SearchButton
        icon="magnifier"
        variant="rounded-rect"                        {/* border, white bg, 36×36pt */}
        onPress={openSearch}
      />
      <AvatarButton
        initials="M"
        size={36}
        bg="#9CA3AF"
        onPress={openAccountMenu}
      />
    </TopBarActions>
  </TopBar>

  <ScrollView contentInset={{ bottom: 64 }}>

    <SectionHeading text="Custom fields" />           {/* 22pt, 700, #111827 */}

    {/* ENGAGEMENT group — read-only */}
    <CustomFieldGroup label="ENGAGEMENT">
      <CustomFieldRow
        label="Lead Score"
        value={null}                                   {/* renders — */}
        editable={false}
      />
      <CustomFieldRow label="Seller Score"            value={null} editable={false} />
      <CustomFieldRow label="Lead Tier"               value={null} editable={false} />
      <CustomFieldRow label="Engagement Streak Days"  value={null} editable={false} />
      <CustomFieldRow label="Last Active Date"        value={null} editable={false} />
      <CustomFieldRow label="Listings Viewed"         value={null} editable={false} />
      <CustomFieldRow label="Listings Saved"          value={null} editable={false} />
      <CustomFieldRow label="CMA Downloads"           value={null} editable={false} />
    </CustomFieldGroup>

    {/* BUYER group — editable */}
    <CustomFieldGroup label="BUYER">
      <CustomFieldRow
        label="Buyer Budget Min"
        value={null}
        editable={true}
        onEdit={() => openFieldEditor('buyer_budget_min')}
      />
      <CustomFieldRow label="Buyer Budget Max"         value={null} editable={true} onEdit={...} />
      <CustomFieldRow label="Buyer Search Areas"       value={null} editable={true} onEdit={...} />
      <CustomFieldRow label="Preferred Communities"    value={null} editable={true} onEdit={...} />
      <CustomFieldRow label="Preferred Beds"           value={null} editable={true} onEdit={...} />
      <CustomFieldRow label="Preferred Baths"          value={null} editable={true} onEdit={...} />
      <CustomFieldRow label="Preferred Property Type"  value={null} editable={true} onEdit={...} />
      <CustomFieldRow label="Move Timeline"            value={null} editable={true} onEdit={...} />
    </CustomFieldGroup>

    {/* SELLER group — partially below fold */}
    <CustomFieldGroup label="SELLER">
      {/* fields continue below viewport */}
    </CustomFieldGroup>

  </ScrollView>

  <Fab
    icon="plus"
    bg="#2563EB"
    size={56}
    position="bottom-right"
    offset={{ right: 16, bottom: 72 }}               {/* above tab bar */}
    onPress={createNewContact}
  />

  <BottomTabBar>
    <Tab icon="home-outline"    label="Home"     active={false} />
    <Tab icon="inbox-outline"   label="Inbox"    active={false} />
    <Tab icon="people-outline"  label="People"   active={true}  activeColor="#102742" />
    <Tab icon="layers-outline"  label="Deals"    active={false} />
    <Tab icon="pulse-outline"   label="Activity" active={false} />
  </BottomTabBar>

  {/* Safari chrome — not rendered by app */}
  <SafariChrome />

</MobileShell>
```

### CustomFieldRow component anatomy

```
<CustomFieldRow>
  ┌──────────────────────────────────────────────────────────┐
  │ [label text, left, #6B7280, 15pt, w400]   [—] [Edit?]  │  h=44–48pt
  └──────────────────────────────────────────────────────────┘
  {/* 1pt divider #F3F4F6 below each row */}
```

- `value` prop: string | null. When null, render em-dash `—` in #6B7280.
- `editable` prop: boolean. When true, append `<TextButton label="Edit" onPress={onEdit} />` flush right.
- "Edit" is NOT a styled button — it is a plain text tap target (~44×44pt hit area), color #6B7280, 14pt.

### CustomFieldGroup component anatomy

```
<CustomFieldGroup>
  <GroupLabel text={label} />   {/* ALL CAPS, 11pt, #6B7280, 600, 16pt top margin, 8pt bottom */}
  {children /* CustomFieldRow list */}
</CustomFieldGroup>
```

### Data bindings

```typescript
interface CustomField {
  key: string;           // e.g. "buyer_budget_min"
  label: string;         // e.g. "Buyer Budget Min"
  value: string | null;  // null renders as —
  editable: boolean;     // false for computed/system fields
  group: 'ENGAGEMENT' | 'BUYER' | 'SELLER';  // section grouping
}

interface ContactCustomFieldsProps {
  contactId: string;
  fields: CustomField[];
}
```

### Spacing notes
- Page heading "Custom fields": padding-top 24pt, padding-left 16pt, margin-bottom 20pt
- Group label: margin-top 16pt, margin-bottom 8pt, padding-left 16pt
- Row: padding-left 16pt, padding-right 16pt, min-height 44pt, flex-row between
- Card left inset border: 4pt left border on the entire content container, color #E5E7EB — creates the visual "card within page" feel seen at x≈46pt in the screenshot
- Scroll indicator: native iOS / browser scrollbar on right edge
