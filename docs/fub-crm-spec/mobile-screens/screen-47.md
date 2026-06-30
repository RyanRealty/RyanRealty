<!-- Mobile per-screen appendix. Original: IMG_6015.PNG | id: mob-47 | tiles: mob-tiles/mob-47_{full,t,m,b}.png -->

# mob-47 — inhouse-web — Contact Detail: Subscriptions + Relationships (scrolled)

## Identity

- **app_source:** inhouse-web
- **module:** Contact Detail (Lead Profile)
- **screen:** Contact detail page scrolled mid-way, showing the bottom of an Automation/Subscriptions card and a full Relationships card with a "Link a Contact" form beneath it.
- **how to reach:** People tab → tap any contact row → scroll down past the top contact-info / timeline sections until the Automation card and Relationships card come into view.
- **iOS status bar:** 7:39 · signal 2/4 bars · WiFi icon · battery 17% (yellow low-battery indicator)
- **Safari address bar:** `ryan-realty.com` centered in the URL pill; Safari chrome bar visible at bottom (home indicator strip only — forward/back/share chrome is scrolled off or not present in this view)

---

## Screen regions (top → bottom, 390×844 pt logical)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–44 | 44 | #ffffff |
| Safari address bar | 44–88 | 44 | #ffffff, centered "ryan-realty.com" in gray pill |
| App header / nav bar | 88–144 | 56 | #ffffff, bottom 1px border #e5e7eb |
| Scrollable content area | 144–760 | 616 | #f2f2f7 (iOS light gray page bg) |
| FAB overlay | ~680–748 (right edge) | 68 dia | Blue circle floating above tab bar |
| Bottom tab bar | 760–844 | 84 | #ffffff, top 1px border #e5e7eb |
| Safari home indicator strip | 828–844 | 16 | #ffffff |

---

## Nav / header bar (exact)

- **Left:** Hamburger menu icon (three horizontal lines, ~20×14pt, #6b7280 gray), ~16pt from left edge
- **Center:** Ryan Realty wordmark logotype — Amboqia display font, navy #102742, with "BEND · OREGON" sub-label in small caps below; total lockup ~140×36pt
- **Right (left to right):**
  1. Search icon — magnifying glass in a rounded-rect button (~36×36pt, #f3f4f6 bg, #6b7280 icon)
  2. Avatar pill — circle ~32pt, dark navy #102742 bg, white "M" letter label (logged-in user: Matt)
- **Height:** ~56pt
- **Background:** #ffffff

---

## Bottom tab bar (exact) — CRITICAL

5 tabs, equal-width columns, icons ~24pt, labels ~10pt, tab height ~84pt:

| Order | Icon glyph | Label | Badge | State |
|---|---|---|---|---|
| 1 | House outline (home) | Home | none | inactive — #9ca3af icon + label |
| 2 | Inbox tray / envelope-in-tray | Inbox | none | inactive — #9ca3af |
| 3 | Two-person silhouette (filled, both heads visible) | **People** | none | **ACTIVE** — #102742 navy, bold label, filled icon |
| 4 | Stacked layers / deals stack (3 rectangles) | Deals | none | inactive — #9ca3af |
| 5 | Heartbeat / activity waveform | Activity | none | inactive — #9ca3af |

**FAB:** Blue circle (#3b82f6), ~56pt diameter, white "+" icon centered (~20pt), positioned bottom-right at approximately x=334, y=688 pt — floating above tab bar, partially overlapping tab bar top edge. Tapping creates a new contact or action (inferred from People context).

---

## Content — every element, in order (scrolled view)

### Card 1 — Automation / Subscriptions (partially visible; card top is scrolled above viewport)

Card: white #ffffff bg, rounded-xl (~16pt radius), ~16pt horizontal margin each side, subtle shadow or 1px border #e5e7eb.

**Visible rows (top of card is cut off; scrolled past):**

**Row: Seller Lead — Master Workflow**
- Primary text: "Seller Lead — Master Workflow" — ~16pt, semibold, #111827
- Right: iOS-style toggle switch, OFF state (gray #d1d5db track, white thumb)
- No subtitle
- Full-width tappable row, ~52pt height
- Bottom: no divider between this row and the section header

**Section header: NEWSLETTER & ALERTS**
- All-caps label: "NEWSLETTER & ALERTS"
- Font: ~11pt, font-weight 600, color #6b7280 gray
- Padding: ~16pt left, ~8pt top/bottom
- Background: same white card

**Row: Newsletter**
- Primary text: "Newsletter" — ~16pt, semibold, #111827
- Subtitle: "Not subscribed" — ~13pt, #9ca3af gray, below primary text
- Right: toggle switch, OFF state (gray #d1d5db)
- Row height: ~60pt
- Bottom: 1px horizontal divider #e5e7eb (full-width, flush card edges)

**Row: Listing alerts**
- Primary text: "Listing alerts" — ~16pt, semibold, #111827
- Subtitle: "0 saved searches" — ~13pt, #9ca3af gray
- Right: toggle switch, OFF state (gray #d1d5db)
- Row height: ~60pt
- Bottom: card bottom edge (~24pt padding below)

---

### Gap between cards

- ~16pt vertical gap, page background #f2f2f7 shows through

---

### Card 2 — Relationships

Card: white #ffffff bg, rounded-xl (~16pt radius), ~16pt horizontal margin each side, subtle shadow or 1px border #e5e7eb. Full card is visible.

**Section title: "Relationships"**
- Text: "Relationships"
- Font: ~22pt, font-weight 700 (bold), #111827 near-black
- Padding: 20pt top, 16pt left

**Empty state paragraph:**
- Text: "No linked contacts yet. Link a spouse, co-buyer, or referrer below."
- Font: ~15pt, font-weight 400, #6b7280 gray
- Line height: ~22pt
- Padding: 12pt top, 16pt left/right

**Horizontal divider:** 1px, #e5e7eb, full card width, ~20pt below empty state text

**Sub-section header: "LINK A CONTACT"**
- Text: "LINK A CONTACT"
- All-caps, ~11pt, font-weight 600, #6b7280 gray
- Padding: 16pt top, 16pt left

**Field group: Relationship**

- Field label: "Relationship"
  - Font: ~13pt, #6b7280 gray, 4pt below the section header
  - Padding: 8pt top, 16pt left

- Select input:
  - Current value: "Spouse"
  - Font: ~16pt, #111827, font-weight 400
  - Right icon: up-down chevron (⬡ / sort icon) — #6b7280, ~18pt
  - Border: 1px solid #d1d5db, rounded-lg (~10pt radius)
  - Bg: #ffffff
  - Height: ~48pt
  - Horizontal margin: 16pt left/right
  - Options (inferred): Spouse, Co-buyer, Referrer, Other

**Field group: Related contact id**

- Field label: "Related contact id"
  - Font: ~13pt, #6b7280 gray
  - Padding: 12pt top, 16pt left

- Text input:
  - Current value: "0"
  - Font: ~16pt, #111827
  - Border: 1px solid #d1d5db, rounded-lg (~10pt radius)
  - Bg: #ffffff
  - Height: ~48pt
  - Horizontal margin: 16pt left/right
  - Keyboard type: numeric (inferred — contact id is a number)
  - Placeholder (when empty): likely "0" or empty

**Primary action button: "Link"**
- Text: "Link" — ~16pt, font-weight 600, #ffffff white, centered
- Background: #1c1c1c near-black (not navy — distinctly very dark gray/black)
- Border radius: ~10pt
- Height: ~52pt
- Horizontal margin: 16pt left/right
- Full-width within card (stretches edge to edge minus margins)
- Tap: submits the relationship link between current contact and the entered contact id

**Help text (below button):**
- Text: "Use the related contact's id (the number in their profile url). The reverse link is created on both records automatically"
- Font: ~12pt, #9ca3af gray, font-weight 400
- Line height: ~18pt
- Padding: 8pt top, 16pt left/right, 20pt bottom
- Note: text is slightly truncated at the very bottom edge in the screenshot (last word cut off); full text ends: "...automatically."

---

### Below Relationships card (partially visible)

Another card's top edge is visible at the very bottom of the scrollable area (~24pt of white visible), suggesting at least one more section below (possibly a Notes or Additional Info card).

---

## Colors, type & iconography

| Element | Color (hex estimate) |
|---|---|
| Page background | #f2f2f7 |
| Card background | #ffffff |
| Header background | #ffffff |
| Header border | #e5e7eb |
| Ryan Realty wordmark | #102742 navy |
| Active tab (People) icon + label | #102742 navy |
| Inactive tab icon + label | #9ca3af gray |
| FAB background | #3b82f6 blue |
| FAB icon (+) | #ffffff |
| Toggle OFF track | #d1d5db |
| Toggle OFF thumb | #ffffff |
| Section header (caps) | #6b7280 gray |
| Primary text | #111827 |
| Secondary/subtitle text | #6b7280–#9ca3af |
| Input border | #d1d5db |
| Input background | #ffffff |
| "Link" button bg | #1c1c1c near-black |
| "Link" button text | #ffffff |
| Dividers inside cards | #e5e7eb 1px |
| Card border/shadow | ~1px #e5e7eb or box-shadow 0 1px 3px rgba(0,0,0,0.08) |

**Typography:**
- App wordmark: Amboqia Boriango display, navy
- Card section titles (Relationships): ~22pt, bold, system-ui/Geist
- Row primary text: ~16pt, semibold, Geist
- Row subtitle: ~13pt, regular, Geist, gray
- Section sub-headers (all-caps): ~11pt, semibold, Geist, gray
- Field labels: ~13pt, regular, Geist, gray
- Input values: ~16pt, regular, Geist, near-black
- Button text: ~16pt, semibold, Geist, white
- Help text: ~12pt, regular, Geist, light gray

**Iconography:**
- Hamburger: 3-line menu, stroked, 20pt
- Search: magnifying glass, stroked, in rounded-rect chip
- User avatar: circle with letter "M", navy bg
- Toggle: iOS-style pill switch, 51×31pt approximately
- Select arrow: up-down chevron (⬡), 18pt, gray
- FAB: solid blue circle, white "+" plus icon
- Tab icons: stroked line icons (Home, Inbox, Deals, Activity), filled/bold for People (active)

---

## Interactions & gestures [INFERRED]

- **Toggle rows** (Seller Lead / Newsletter / Listing alerts): tap to toggle ON/OFF; calls PATCH `/api/crm/contacts/:id` to update field; toggle animates to ON (colored, likely #102742 navy or #3b82f6 blue)
- **Relationship select ("Spouse"):** tap opens a native `<select>` picker or custom bottom sheet with options: Spouse, Co-buyer, Referrer (and possibly Other); selection updates field value
- **Related contact id input ("0"):** tap opens numeric keyboard; user types the contact's numeric ID (found in `/people/:id` URL)
- **"Link" button:** tap → POST to `/api/crm/contacts/:id/relationships` with `{ relationship: "Spouse", relatedContactId: 0 }` → success empties the empty state and renders a linked-contact row above the divider; failure shows an inline error message
- **FAB (+):** tap → sheet or modal to create new contact or new activity/note (standard People tab FAB behavior)
- **Pull to refresh:** entire page pull-to-refresh on the scrollable area
- **Scroll:** full vertical scroll from the top of the contact profile through all sections; this view is mid-scroll
- **Back navigation:** tap browser back or swipe right to return to People list
- **Bottom tab switch:** tap any tab to switch main section; People is active

---

## Build notes (component tree)

```tsx
<MobileShell bg="#f2f2f7">

  {/* iOS status bar — rendered by OS */}
  <StatusBar time="7:39" battery={17} signal={2} />

  {/* Safari address bar — rendered by browser */}
  <SafariAddressBar url="ryan-realty.com" />

  {/* App nav header */}
  <TopBar bg="#ffffff" borderBottom="1px solid #e5e7eb" height={56}>
    <HamburgerButton icon="menu" color="#6b7280" />
    <BrandLogo src="/design_system/ryan-realty/assets/brand/logo-blue.png" width={140} />
    <SearchButton rounded bg="#f3f4f6" icon="search" color="#6b7280" />
    <AvatarPill initials="M" bg="#102742" color="#ffffff" size={32} />
  </TopBar>

  {/* Scrollable contact detail body */}
  <ScrollView flex={1} px={16} py={12} gap={12}>

    {/* Card 1: Automation + Subscriptions (partially scrolled into view) */}
    <Card bg="#ffffff" radius={16} px={0} py={0}>

      {/* Row: workflow toggle */}
      <ToggleRow
        label="Seller Lead — Master Workflow"
        value={false}
        onChange={(v) => patchContact({ sellerWorkflow: v })}
        height={52}
        px={16}
      />

      {/* Section sub-header */}
      <SectionSubHeader label="NEWSLETTER & ALERTS" px={16} pt={8} pb={4} />

      {/* Row: Newsletter */}
      <ToggleRow
        label="Newsletter"
        subtitle="Not subscribed"
        value={false}
        onChange={(v) => patchContact({ newsletterSubscribed: v })}
        height={60}
        px={16}
        dividerBottom
      />

      {/* Row: Listing alerts */}
      <ToggleRow
        label="Listing alerts"
        subtitle="0 saved searches"
        value={false}
        onChange={(v) => patchContact({ listingAlerts: v })}
        height={60}
        px={16}
      />

    </Card>

    {/* Card 2: Relationships */}
    <Card bg="#ffffff" radius={16} px={16} py={20}>

      {/* Empty state */}
      <SectionTitle text="Relationships" size={22} weight={700} mb={8} />
      <EmptyStateText
        text="No linked contacts yet. Link a spouse, co-buyer, or referrer below."
        color="#6b7280"
        size={15}
        mb={16}
      />

      <Divider color="#e5e7eb" mb={16} />

      {/* Link a Contact sub-form */}
      <SectionSubHeader label="LINK A CONTACT" mb={12} />

      <FieldLabel text="Relationship" />
      <SelectInput
        value="Spouse"
        options={["Spouse", "Co-buyer", "Referrer", "Other"]}
        onChange={(v) => setRelationship(v)}
        height={48}
        border="1px solid #d1d5db"
        radius={10}
        mb={12}
      />

      <FieldLabel text="Related contact id" />
      <TextInput
        value="0"
        onChange={(v) => setRelatedId(v)}
        inputMode="numeric"
        height={48}
        border="1px solid #d1d5db"
        radius={10}
        mb={16}
      />

      <Button
        label="Link"
        onPress={() => linkContact({ relationship, relatedContactId })}
        bg="#1c1c1c"
        color="#ffffff"
        height={52}
        radius={10}
        fullWidth
        mb={10}
      />

      <HelpText
        text="Use the related contact's id (the number in their profile url). The reverse link is created on both records automatically."
        color="#9ca3af"
        size={12}
      />

    </Card>

    {/* Additional card(s) below — partially visible */}
    {/* <Card> ... more sections ... </Card> */}

  </ScrollView>

  {/* FAB */}
  <FAB
    icon="plus"
    bg="#3b82f6"
    color="#ffffff"
    size={56}
    position="absolute"
    bottom={96}
    right={16}
    onPress={() => openNewContactSheet()}
  />

  {/* Bottom tab bar */}
  <BottomTabBar bg="#ffffff" borderTop="1px solid #e5e7eb" height={84}>
    <Tab icon="home-outline"    label="Home"     active={false} color="#9ca3af" activeColor="#102742" />
    <Tab icon="inbox-outline"   label="Inbox"    active={false} color="#9ca3af" activeColor="#102742" />
    <Tab icon="people-filled"   label="People"   active={true}  color="#9ca3af" activeColor="#102742" fontWeight={700} />
    <Tab icon="deals-stack"     label="Deals"    active={false} color="#9ca3af" activeColor="#102742" />
    <Tab icon="activity-wave"   label="Activity" active={false} color="#9ca3af" activeColor="#102742" />
  </BottomTabBar>

</MobileShell>
```

**Key spacing/sizing constants:**
- Card horizontal margin from screen edge: 16pt each side (card width = 390 - 32 = 358pt)
- Card border-radius: 16pt
- Card internal horizontal padding: 16pt
- Toggle row height: 52–60pt (taller when subtitle present)
- Input height: 48pt
- Button height: 52pt
- Button border-radius: 10pt
- FAB size: 56pt diameter, bottom: ~96pt (above tab bar), right: 16pt
- Tab bar height: 84pt (includes safe-area home indicator)
- Gap between cards: 12pt

**Data bindings per component:**
- `ToggleRow.value` ← `contact.sellerWorkflowEnrolled`, `contact.newsletterSubscribed`, `contact.listingAlertsEnabled`
- `ToggleRow.subtitle` ← dynamic: `contact.savedSearchesCount + " saved searches"` for Listing alerts; `contact.newsletterSubscribed ? "Subscribed" : "Not subscribed"` for Newsletter
- `SelectInput.value` ← local state `relationship`, init "Spouse"
- `TextInput.value` ← local state `relatedContactId`, init 0
- `Button.onPress` → POST `/api/crm/contacts/${contactId}/relationships` body `{ type: relationship, relatedId: relatedContactId }`
- Linked contacts list (when non-empty): renders above the divider as `<LinkedContactRow>` items with avatar, name, relationship type chip, and remove (×) button
