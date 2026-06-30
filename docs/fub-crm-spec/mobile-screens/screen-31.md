<!-- Mobile per-screen appendix. Original: IMG_5993.PNG | id: mob-31 | tiles: mob-tiles/mob-31_{full,t,m,b}.png -->

# mob-31 — fub-ios — Contact Detail / Calendar Tab (Empty State)

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app)
- **module:** Contact Detail (Lead Profile) — Calendar sub-tab
- **screen:** Calendar tab within a contact record for "Tide Rivers", showing empty state (no appointments or tasks scheduled)
- **how to reach:** People tab → tap any contact row → tap "Calendar" in the sub-tab strip (3rd of 4 tabs)
- **iOS status bar:** Time "8:40" (left), signal bars + WiFi + battery "37%" with outline indicator (right)
- **URL bar:** N/A — native iOS app, no browser chrome

---

## Screen Regions (y-bands, 390×844pt logical screen)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–50 | ~50 | Dark slate/teal ~#435a6b (same as header) |
| Nav/header bar (back + avatar + name) | 50–130 | ~80 | Dark slate ~#435a6b |
| Sub-tab strip | 130–172 | ~42 | Same dark slate ~#435a6b |
| Scrollable content area | 172–844 | ~672 | Very light blue-gray ~#edf0f5 |
| FAB (floating) | ~760–820 (bottom-right) | 56×56 circle | Steel blue ~#6b94bb |

No bottom tab bar is visible — this pushed detail view fills the full screen and the bottom tab bar is covered or suppressed behind the push navigation stack.

---

## Nav / Header Bar (exact)

- **Background:** Dark slate/teal ~#435a6b (uniform across status bar, back row, and avatar/name row)
- **Left control:** Single back chevron `<` glyph, white, ~22pt, positioned top-left below status bar (~y=58, x=16). Tappable — pops back to the contact list or previous screen.
- **Avatar (center-left of name row):** Circular, ~52pt diameter, positioned left of name text. Shows a real photo — ocean/surf scene with text overlay reading "RIVERS TO THE SEA" in a branded circular badge style. No fallback initials visible.
- **Primary name text:** "Tide Rivers" — white, ~20pt, semibold/bold weight, left-aligned next to avatar.
- **Subtitle text:** "Last communication Jun 14" — muted light gray ~#b0bec8, ~13pt, regular weight, directly below the name.
- **Right controls:** None visible on this screen (no search, no bell, no kebab on the detail header in this state).

---

## Sub-Tab Strip (exact)

- **Background:** Same dark slate as header ~#435a6b, no visible divider from header above.
- **Tabs in order (left to right):**
  1. **Homes** — inactive, muted gray-white ~#8fa5b8, ~14pt medium
  2. **Notes** — inactive, muted gray-white ~#8fa5b8, ~14pt medium
  3. **Calendar** — ACTIVE, white #FFFFFF, ~14pt semibold, with a solid white underline indicator ~2pt tall flush to the bottom of the tab strip
  4. **Automations** — inactive, muted gray-white ~#8fa5b8, ~14pt medium
- **Tab spacing:** Equal width distribution across full screen width (~97pt each).
- **Active indicator:** White bottom-border underline under "Calendar" text only, spans roughly the text width.

---

## Bottom Tab Bar

Not visible in this screen — the contact detail view is a pushed navigation controller that covers the main tab bar. The FAB is the only persistent interactive control at the bottom.

---

## Content — Every Element, In Order

### 1. "Add Appointment or Task" Row
- **y-band:** ~172–212pt (first row of content area)
- **Background:** Same light blue-gray as content area ~#edf0f5
- **Left icon:** Filled circle, steel blue ~#5b8ec4, ~22pt diameter, containing a white "+" plus glyph (~14pt)
- **Label text:** "Add Appointment or Task" — steel blue ~#5b8ec4, ~16pt, regular/medium weight
- **Behavior [INFERRED]:** Tap opens a sheet or modal to create a new appointment or task linked to this contact
- **No divider** between this row and the area below; content flows directly into empty state

### 2. Right-edge Pull Handle / Chevron
- **Position:** Right edge of screen, vertically centered in the content area, partially off-screen (~x=374–390, y=~280)
- **Appearance:** Small rounded-rectangle pill/tab, dark gray ~#6b7d8e, containing a left-pointing chevron `<` glyph in white/light gray
- **Purpose [INFERRED]:** Side-panel drag handle or contextual swipe affordance — possibly a right-side drawer or a "collapse" handle for a split-view or swipe-right detail panel

### 3. Empty State — Centered Illustration + Copy
- **y-band:** ~230–390pt (vertically centered in visible content)
- **Icon:** Compound icon — calendar grid glyph (rounded square with 3×3 dot grid) overlaid bottom-right with a clock face glyph. Both in muted blue-gray ~#9aabb8, approximately 64pt composite size.
- **Primary text:** "No Scheduled Appointments" — ~17pt, semibold, color ~#6b7d8e (medium gray), center-aligned
- **Secondary text:** "Tasks and Appointments will show up here" — ~14pt, regular, color ~#8a9baa (lighter muted gray), center-aligned, ~1 line below primary
- **Horizontal padding:** ~24pt each side

### 4. FAB (Floating Action Button)
- **Position:** Bottom-right, ~x=334, y=~768pt (above home indicator zone)
- **Size:** ~56pt diameter circle
- **Color:** Steel blue ~#6b94bb (slightly desaturated, matches FUB accent family)
- **Icon:** White "+" plus glyph, ~24pt, centered
- **Behavior [INFERRED]:** Same as "Add Appointment or Task" row — opens create sheet. Duplicates the inline row action but persists as user scrolls down (if list were populated)

---

## Colors, Type & Iconography

### Colors
| Element | Hex estimate |
|---|---|
| Header / status bar bg | ~#435a6b (dark slate blue-teal) |
| Sub-tab strip bg | ~#435a6b (same) |
| Active tab text | #FFFFFF |
| Active tab underline | #FFFFFF |
| Inactive tab text | ~#8fa5b8 |
| Back chevron | #FFFFFF |
| Contact name | #FFFFFF |
| Last communication subtitle | ~#b0bec8 |
| Content area bg | ~#edf0f5 (very light blue-gray) |
| Add row icon + text | ~#5b8ec4 (FUB accent blue) |
| FAB bg | ~#6b94bb (muted steel blue) |
| FAB icon | #FFFFFF |
| Empty state icon | ~#9aabb8 |
| Empty state primary text | ~#6b7d8e |
| Empty state secondary text | ~#8a9baa |
| Right handle pill | ~#6b7d8e |

### Typography
- Contact name: ~20pt, semibold/bold, white
- Subtitle "Last communication…": ~13pt, regular, muted
- Sub-tab labels: ~14pt, medium (inactive) / semibold (active)
- "Add Appointment or Task": ~16pt, regular/medium, accent blue
- Empty state H1: ~17pt, semibold, medium gray
- Empty state body: ~14pt, regular, lighter gray

### Iconography
- Back chevron: standard iOS SF Symbol `chevron.left` or FUB equivalent, white, ~22pt
- Add row "+" : white on filled blue circle, ~22pt circle
- Empty state: custom compound calendar+clock icon, ~64pt, muted blue-gray
- FAB "+": white on steel blue filled circle, ~56pt

**FUB accent note:** FUB uses a desaturated steel blue (#5b8ec4–#6b94bb range) as its primary accent — confirmed consistent across the "Add" row text, the inline "+" circle, and the FAB. This is NOT the Ryan Realty navy #102742 or cream #faf8f4. This is the native FUB iOS color system.

---

## Interactions & Gestures

| Target | Behavior |
|---|---|
| Back chevron `<` | [CONFIRMED] Pops navigation stack — returns to contact list or previous People screen |
| Avatar (circle photo) | [INFERRED] No action, or tap to view/edit contact photo |
| "Homes" tab | [INFERRED] Switches content to Homes sub-view for this contact (saved searches, property interest) |
| "Notes" tab | [INFERRED] Switches to Notes sub-view (freeform notes on contact) |
| "Calendar" tab | Current active tab — no action |
| "Automations" tab | [INFERRED] Switches to Automations sub-view (action plans, drip sequences assigned to this contact) |
| "Add Appointment or Task" row | [INFERRED] Tapping opens a bottom sheet or push view to create appointment/task |
| Right-edge pull handle `<` | [INFERRED] Swipe or tap to reveal a right-side panel (possibly quick actions or contact summary drawer) |
| FAB "+" | [INFERRED] Same as "Add Appointment or Task" — opens create sheet; fixed position, persists during scroll |
| Scroll down in content area | [INFERRED] Pull-to-refresh at top; content area would show appointment/task rows if populated |
| Long-press on appointment row (if populated) | [INFERRED] Context menu for edit/delete |
| Swipe-right on appointment row (if populated) | [INFERRED] Reveal quick action (e.g., mark complete) |

---

## Build Notes — Component Tree

```
<MobileShell>

  {/* iOS Status Bar */}
  <StatusBar
    time="8:40"
    signal={3}
    wifi={true}
    battery={37}
    style="light"           // white text on dark bg
    bg="#435a6b"
  />

  {/* Navigation stack pushed view — no bottom tab bar */}
  <ContactDetailShell bg="#435a6b">

    {/* Back row */}
    <BackRow
      onBack={navigateBack}
      iconColor="#FFFFFF"
      bg="transparent"
      paddingTop={8}
    />

    {/* Contact identity header */}
    <ContactHeader
      avatarSrc="/contacts/tide-rivers-avatar.jpg"  // real photo, circular crop
      avatarSize={52}                                // pt
      name="Tide Rivers"
      nameStyle={{ fontSize: 20, fontWeight: 600, color: '#FFFFFF' }}
      subtitle="Last communication Jun 14"
      subtitleStyle={{ fontSize: 13, color: '#b0bec8' }}
      bg="transparent"
      paddingHorizontal={16}
      paddingBottom={12}
    />

    {/* Sub-tab strip */}
    <ContactSubTabBar
      tabs={['Homes', 'Notes', 'Calendar', 'Automations']}
      activeTab="Calendar"
      activeColor="#FFFFFF"
      inactiveColor="#8fa5b8"
      indicatorColor="#FFFFFF"
      indicatorHeight={2}
      bg="#435a6b"
      tabFontSize={14}
    />

    {/* Scrollable content — Calendar tab panel */}
    <TabPanel tabKey="Calendar" bg="#edf0f5" flex={1}>

      {/* Add action row */}
      <AddActionRow
        icon="plus-circle"          // filled circle with + glyph
        iconColor="#5b8ec4"
        iconSize={22}
        label="Add Appointment or Task"
        labelColor="#5b8ec4"
        labelSize={16}
        paddingVertical={14}
        paddingHorizontal={16}
        onPress={openCreateSheet}
        bg="#edf0f5"
      />

      {/* Right-edge pull handle */}
      <SidePanelHandle
        side="right"
        chevronDirection="left"
        bg="#6b7d8e"
        handleWidth={16}
        handleHeight={48}
        borderRadius={8}
      />

      {/* Empty state — centered */}
      <EmptyState
        icon={<CalendarClockIcon size={64} color="#9aabb8" />}
        title="No Scheduled Appointments"
        titleStyle={{ fontSize: 17, fontWeight: 600, color: '#6b7d8e' }}
        subtitle="Tasks and Appointments will show up here"
        subtitleStyle={{ fontSize: 14, color: '#8a9baa' }}
        paddingHorizontal={32}
        centered={true}
      />

    </TabPanel>

    {/* FAB — floating, fixed position */}
    <FAB
      icon="plus"
      iconColor="#FFFFFF"
      iconSize={24}
      bg="#6b94bb"
      size={56}
      position={{ bottom: 32, right: 24 }}
      onPress={openCreateSheet}
      shadow={{ color: '#6b94bb', opacity: 0.35, radius: 8, offsetY: 4 }}
    />

  </ContactDetailShell>

</MobileShell>
```

### Data bindings
- `contact.id` — resolves avatar, name, last communication date
- `contact.appointments[]` — array; length === 0 triggers empty state; length > 0 renders `<AppointmentRow>` list
- `contact.tasks[]` — same pattern, co-listed with appointments on this tab
- `openCreateSheet(contactId)` — opens appointment/task creation modal pre-scoped to this contact

### Key spacing/sizing
- Header bg extends from status bar top through sub-tab strip bottom (no visible break)
- Avatar is left-aligned at ~x=16, vertically centered in the name row
- Name + subtitle are left-aligned at ~x=80 (16 + 52 avatar + 12 gap)
- Sub-tabs: equal-width flex distribution, ~97pt each at 390pt screen width
- Add row: ~14pt top/bottom padding, 16pt left padding, aligns icon left edge to ~x=16
- Empty state icon: centered at ~x=195, approximately y=290 from top of content area
- FAB bottom-right: ~24pt from right edge, ~32pt from bottom safe area
- Content area background (#edf0f5) starts immediately below sub-tab strip with no visible card/border transition
