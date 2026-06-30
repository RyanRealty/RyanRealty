<!-- Mobile per-screen appendix. Original: IMG_5829.PNG | id: mob-09 | tiles: mob-tiles/mob-09_{full,t,m,b}.png -->

# mob-09 — fub-ios — People / Smart Lists (All Lists tab)

## Identity

- **app_source:** fub-ios (native Follow Up Boss iPhone app)
- **module:** Smart Lists / Filters — the People tab's list-of-lists index screen
- **screen name:** People › All Lists
- **how to reach:** Tap the "People" tab (4th tab in bottom bar) from anywhere; lands on this "All Lists" sub-tab by default
- **iOS status bar:** 4:33 time (left), signal bars + WiFi icon + "100" battery indicator (right); white text on dark header background
- **URL bar:** N/A — native iOS app, no browser chrome

---

## Screen regions (top → bottom, y-bands on 390×844 pt logical canvas)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–47 | 47 | Inherits header bg ~#2e4d5e (dark teal-slate) |
| Nav / header bar | 47–103 | 56 | ~#2e4d5e (dark desaturated teal, FUB brand header) |
| Sub-tab strip | 103–143 | 40 | ~#eef0f2 (very light cool gray) |
| Sub-tab hairline divider | 143–144 | 1 | ~#d0d4d8 |
| Scrollable smart-list content | 144–762 | 618 | #ffffff |
| Bottom tab bar | 762–844 | 82 | ~#f4f5f6 (light gray, elevated surface) |

No safe-area home indicator bar is separately drawn; the bottom tab bar absorbs it.

---

## Nav / header bar (exact)

**Left control:** Circular avatar, ~44×44 pt, white circular border ~2 pt, contains Matt Ryan's headshot photo (bald-headed man, smiling, white shirt). Tappable — opens broker profile / account settings.

**Center:** Plain text label "People", regular-weight, ~17 pt, white (#ffffff). No dropdown chevron; title is non-interactive.

**Right controls (left-to-right):**
1. Bell icon — outline bell glyph, white, ~24 pt hit area. No visible badge in this shot. Tappable — opens notifications panel.
2. Magnifying glass / search icon — outline magnifying glass glyph, white, ~24 pt hit area. Tappable — opens full-screen People search.

Spacing: left avatar is ~14 pt from left edge; bell and search icons are ~8 pt apart, search ~14 pt from right edge.

---

## Sub-tab strip (exact)

Two tabs, full-width split (≈50 % / 50 %), height 40 pt, background ~#eef0f2.

| Tab | Label | State | Indicator |
|---|---|---|---|
| Left | **All Lists** | **ACTIVE** | Dark underline bar ~2 pt, color ~#1a2e3d (near-black navy), text dark ~#1a2e3d, font-weight 600 |
| Right | **Stages** | inactive | No underline, text color ~#9aa5ae (muted gray), font-weight 400 |

Tapping "Stages" switches to the Stages view (pipeline-stage groupings of contacts). No badge counts on either tab.

---

## Bottom tab bar (exact) — CRITICAL

5 tabs, equal width (~78 pt each), height 82 pt (including home-indicator area). Background ~#f4f5f6, hairline top border ~#d8dadc.

| Position | Icon glyph | Label | Badge | Active? |
|---|---|---|---|---|
| 1 | Inbox tray outline (rectangular tray with down-arrow) | **Inbox** | Red filled circle, white text "30", ~18 pt diameter, top-right of icon | No |
| 2 | Line chart / activity sparkline (3-point connected line trending up) | **Activity** | None | No |
| 3 | Calendar grid (rectangle with two top nubs + grid lines) | **Calendar** | None | No |
| 4 | Silhouette of person (head + shoulders, solid filled) | **People** | None | **YES** — icon and label both teal ~#2196b5 |
| 5 | Price tag with dollar sign outline | **Deals** | None | No |

Inactive icon/label color: ~#9aa5ae (medium gray). Active (People) color: ~#2196b5 (FUB teal-blue).

**FAB (Floating Action Button):** Circular, ~56 pt diameter, background ~#4a9fd4 (medium FUB blue, slightly lighter than the teal accent), white "+" glyph centered. Positioned bottom-right, overlapping the content scroll area and partially the bottom tab bar — approximately x=334 pt, y=706 pt (center). Tappable — opens "Add New Person" / quick-create contact sheet.

---

## Content — every element, in order

### Scrollable smart-list rows

Each row is a full-width tap target. Height: ~58 pt per row. Anatomy per row:

```
[ optional emoji icon (28×28 pt) ] [ list name label ] ············ [ count ]
```

- **Left:** Optional emoji icon, displayed as native emoji at ~22 pt, left-aligned at x≈16 pt. Not all rows have an icon — most are text-only starting at x≈16 pt.
- **Center/label:** Smart list name, dark gray text ~#3d4f5c, font size ~16 pt, weight 400 (regular), vertically centered. Left edge at x≈16 pt (or x≈46 pt when emoji icon present).
- **Right:** Contact count, teal text ~#2196b5, font size ~16 pt, weight 400, right-aligned at x≈374 pt. Numbers ≥1000 are abbreviated (e.g. "1.2k").
- **Dividers:** Full-width 1 pt horizontal hairline, color ~#e8eaec, at the bottom of each row. Extends edge-to-edge (no inset).
- **Swipe actions:** [INFERRED] Standard FUB pattern — swipe left to reveal contextual actions (likely "Edit" or "Delete" for user-created lists). Not visible in this state.
- **Chevron:** No right-facing chevron visible — the count number serves as the only right-side element.

### Complete list of rows visible (verbatim, top to bottom):

| # | Icon | List name | Count |
|---|---|---|---|
| 1 | 🖥️ (laptop/computer emoji) | All Recent Online Activity | 11 |
| 2 | (none) | All Expireds | 637 |
| 3 | (none) | Expired No Contact | 138 |
| 4 | (none) | Absentee Owners | 805 |
| 5 | (none) | Absentee Owners No Contact | 550 |
| 6 | (none) | Matts Sphere | 1.2k |
| 7 | (none) | All Clients | 23 |
| 8 | (none) | Realtors | 0 |
| 9 | (none) | Migration Realtors | 0 |
| 10 | 🚨 (rotating light / siren emoji) | New Leads: No Call Attempt | 4 |
| 11 | 🤩 (star-struck / starry-eyes emoji) | Active & Pending Clients | 8 (partially hidden by FAB) |

Row 11 is the last visible row before the FAB and tab bar; the list likely continues below (scrollable).

### Section headers

No section headers are visible on this screen. The "All Lists" view renders all smart lists in a flat, unsectioned list.

### Empty-state (zero-count rows)

Rows with count "0" (Realtors, Migration Realtors) still render normally — same label style, count shown as "0" in the teal accent color. No greyed-out or hidden treatment.

### Pull-to-refresh

[INFERRED] Standard iOS pull-to-refresh spinner will appear above row 1 when user drags down past the top of the scroll area.

---

## Colors, type & iconography

| Element | Color (hex estimate) | Notes |
|---|---|---|
| Header background | #2e4d5e | Dark desaturated teal-slate (FUB brand header) |
| Header text / icons | #ffffff | White |
| Sub-tab strip background | #eef0f2 | Very light cool gray |
| Active tab label + underline | #1a2e3d | Near-black dark navy |
| Inactive tab label | #9aa5ae | Medium muted gray |
| Active tab underline bar | #1a2e3d | 2 pt height, full tab width |
| List background | #ffffff | Pure white |
| Row label text | #3d4f5c | Dark blue-gray |
| Count text (teal accent) | #2196b5 | FUB's signature teal-blue (used for all interactive counts, active tab) |
| Row dividers | #e8eaec | Very light gray hairline |
| FAB background | #4a9fd4 | Medium FUB blue (slightly lighter/brighter than accent teal) |
| FAB icon | #ffffff | White plus glyph |
| Bottom tab bar background | #f4f5f6 | Light gray elevated surface |
| Inactive tab icon + label | #9aa5ae | Medium gray |
| Active tab icon + label (People) | #2196b5 | Matches count teal accent |
| Badge background (Inbox "30") | #e53935 | Red filled circle |
| Badge text | #ffffff | White |

**Typography:**
- Header title "People": SF Pro Display or SF Pro Text, ~17 pt, weight 400 (regular)
- Sub-tab labels: SF Pro Text, ~14 pt, weight 600 (active) / 400 (inactive)
- Row list name: SF Pro Text, ~16 pt, weight 400
- Row count: SF Pro Text, ~16 pt, weight 400
- Bottom tab labels: SF Pro Text, ~10 pt, weight 400

**Iconography style:** All system icons (bell, search, bottom tab icons) appear to be SF Symbols / FUB custom equivalents — line-weight outline style for inactive, filled/solid for active. The "People" tab icon is a solid filled silhouette.

---

## Interactions & gestures

| Gesture / tap target | Behavior |
|---|---|
| Tap avatar (top-left header) | [INFERRED] Opens account profile / broker settings drawer |
| Tap bell (header right) | [INFERRED] Opens notifications panel (slide-in from right or modal sheet) |
| Tap search icon (header right) | [INFERRED] Pushes or presents a full-screen People search view with keyboard up |
| Tap "All Lists" sub-tab | No-op (already active) |
| Tap "Stages" sub-tab | [INFERRED] Switches scrollable content to a Stages-based grouping view (pipeline stages as section headers, contacts nested under) |
| Tap any smart-list row | Pushes to a filtered People list showing only contacts in that smart list; back chevron returns here |
| Swipe left on a row | [INFERRED] Reveals swipe-action buttons: "Edit" (rename/reconfigure list) and/or "Delete" (for user-created lists); FUB system lists may show only "Edit" |
| Tap FAB "+" | [INFERRED] Opens "Add Person" bottom sheet or modal — fields: name, phone, email, source, assign-to |
| Pull-to-refresh | [INFERRED] Refreshes all smart list counts from the FUB API |
| Tap "Inbox" tab | Switches to Inbox screen (message threads) |
| Tap "Activity" tab | Switches to Activity feed |
| Tap "Calendar" tab | Switches to Calendar / Appointments view |
| Tap "Deals" tab | Switches to Deals pipeline view |

---

## Build notes (component tree)

```
<MobileShell safeAreaTop safeAreaBottom>

  {/* iOS Status Bar */}
  <StatusBar time="4:33" battery={100} wifi signal style="light-content" />

  {/* FUB-style Header */}
  <TopBar
    bg="#2e4d5e"
    left={<AvatarButton src={brokerHeadshot} size={44} borderColor="#fff" borderWidth={2} onPress={openProfile} />}
    center={<Text style={styles.headerTitle}>People</Text>}
    right={[
      <IconButton icon="bell-outline" color="#fff" size={24} onPress={openNotifications} />,
      <IconButton icon="search" color="#fff" size={24} onPress={openPeopleSearch} />
    ]}
  />

  {/* Sub-tab Strip */}
  <SubTabBar
    bg="#eef0f2"
    activeColor="#1a2e3d"
    inactiveColor="#9aa5ae"
    indicatorColor="#1a2e3d"
    indicatorHeight={2}
    tabs={[
      { key: "all-lists", label: "All Lists" },
      { key: "stages",    label: "Stages" }
    ]}
    activeTab="all-lists"
    onTabChange={setActiveTab}
  />

  {/* Scrollable Smart List */}
  <ScrollView style={{ flex: 1, backgroundColor: "#fff" }}>
    <FlatList
      data={smartLists}
      keyExtractor={item => item.id}
      ItemSeparatorComponent={() => <Divider color="#e8eaec" height={1} />}
      renderItem={({ item }) => (
        <SmartListRow
          emoji={item.emoji}          // optional native emoji string, undefined for no-icon rows
          label={item.name}           // e.g. "All Recent Online Activity"
          count={item.count}          // number — rendered as formatted string: ≥1000 → "1.2k"
          onPress={() => navigateToPeopleList(item.id)}
          onSwipeLeft={() => showRowActions(item)}
        />
      )}
    />
    {/*
      SmartListRow anatomy:
        height: 58pt
        paddingHorizontal: 16pt
        flexDirection: row, alignItems: center, justifyContent: space-between

        Left side:
          {emoji && <Text style={{ fontSize: 22, marginRight: 8 }}>{emoji}</Text>}
          <Text style={{ fontSize: 16, color: "#3d4f5c", fontWeight: "400" }}>{label}</Text>

        Right side:
          <Text style={{ fontSize: 16, color: "#2196b5", fontWeight: "400" }}>
            {formatCount(count)}  // 1200 → "1.2k"
          </Text>
    */}
  </ScrollView>

  {/* FAB */}
  <FloatingActionButton
    size={56}
    bg="#4a9fd4"
    icon="plus"
    iconColor="#fff"
    position={{ bottom: 90, right: 16 }}  // sits above bottom tab bar
    onPress={openAddPersonSheet}
    zIndex={10}
  />

  {/* Bottom Tab Bar */}
  <BottomTabBar
    bg="#f4f5f6"
    borderTopColor="#d8dadc"
    borderTopWidth={1}
    activeColor="#2196b5"
    inactiveColor="#9aa5ae"
    tabs={[
      { key: "inbox",    icon: "inbox-tray",       label: "Inbox",    badge: 30 },
      { key: "activity", icon: "chart-line-up",     label: "Activity", badge: null },
      { key: "calendar", icon: "calendar-grid",     label: "Calendar", badge: null },
      { key: "people",   icon: "person-silhouette", label: "People",   badge: null },
      { key: "deals",    icon: "price-tag-dollar",  label: "Deals",    badge: null }
    ]}
    activeTab="people"
    onTabPress={switchTab}
  />

</MobileShell>
```

### Data bindings

```typescript
interface SmartList {
  id: string;
  name: string;           // e.g. "All Recent Online Activity"
  emoji?: string;         // native emoji char, e.g. "🖥️", "🚨", "🤩"; undefined = no icon
  count: number;          // contact count
  isSystemList: boolean;  // system lists can be viewed but not deleted
}

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}
```

### Spacing constants (pt)

```
HEADER_HEIGHT = 56
AVATAR_SIZE = 44
AVATAR_BORDER = 2
SUBTAB_HEIGHT = 40
SUBTAB_INDICATOR_HEIGHT = 2
ROW_HEIGHT = 58
ROW_PADDING_H = 16
ROW_EMOJI_MARGIN_RIGHT = 8
DIVIDER_HEIGHT = 1
FAB_SIZE = 56
FAB_BOTTOM_OFFSET = 90
FAB_RIGHT_OFFSET = 16
BOTTOM_TAB_HEIGHT = 82
BOTTOM_TAB_ICON_SIZE = 24
BOTTOM_TAB_LABEL_SIZE = 10
BADGE_SIZE = 18
BADGE_FONT_SIZE = 11
```

### Key implementation notes

1. **Count formatting:** Numbers ≥ 1000 compress to "1.2k" notation (one decimal, trailing ".0" stripped). This is FUB-native; replicate exactly.
2. **Emoji icons:** Some smart lists have a leading native emoji character that the user can assign when creating the list. The emoji renders at ~22 pt left of the label with an 8 pt gap. Lists without an assigned emoji have no leading icon; label starts flush at the left padding.
3. **Zero-count rows:** Display identically to rows with counts. Do not hide or grey out zero-count lists.
4. **FAB overlap:** The FAB visually overlaps the bottom tab bar at ~50 % of its diameter. It must be positioned with a positive z-index above both the scroll content and the tab bar. On long lists, the FAB partially obscures the count on the last visible row (as seen with "Active & Pending Clients" count "8" being covered).
5. **Active tab indicator:** The "All Lists" underline bar spans the full width of the tab button (~195 pt), is 2 pt tall, and sits flush at the bottom edge of the sub-tab strip — no border-radius.
6. **Header avatar:** Must be a circular crop with a 2 pt white border ring (acts as contrast separator against the dark header). Tappable with a large hit area (44×44 pt minimum).
7. **Swipe-to-action:** [INFERRED] iOS native UX — the FUB app uses UITableView-style swipe actions. In a web rebuild, implement via a swipe-gesture library exposing contextual action buttons on swipe-left.
8. **Sub-tab navigation:** Switching to "Stages" tab should animate the indicator sliding right and cross-fade the list content into a stage-grouped view. The indicator transition should be ~200 ms ease-out.
9. **Pull-to-refresh:** Wire to a `GET /smartlists/counts` endpoint that refreshes all count values; show iOS-native-style spinner above row 1.
