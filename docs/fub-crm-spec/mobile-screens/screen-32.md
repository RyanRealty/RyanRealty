<!-- Mobile per-screen appendix. Original: IMG_5995.PNG | id: mob-32 | tiles: mob-tiles/mob-32_{full,t,m,b}.png -->

# mob-32 — fub-ios — Activity / Emails Sub-Tab

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app)
- **module:** Activity / Leads feed — Emails sub-tab
- **screen:** Activity feed filtered to "Emails" channel, scoped to "Everyone"
- **how to reach:** Tap "Activity" tab (second tab, index 1) in bottom tab bar; then tap "Emails" in the 3-segment sub-tab strip
- **iOS status bar:** Time "8:40" left-aligned; signal bars + WiFi icon + battery "37%" right-aligned; light text on dark teal header
- **URL:** N/A — native iOS app

---

## Screen regions (y-bands on 390×844 pt logical screen)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 | #3d5a6e (dark teal, matches header) |
| Nav / header bar | 54–110 | 56 | #3d5a6e (dark teal/navy-teal) |
| Sub-tab strip | 110–150 | 40 | #3d5a6e (same teal, slightly lighter rule) |
| Sub-tab active underline | 148–150 | 2 | #5ab4e8 (bright sky blue) |
| Scrollable content list | 150–760 | 610 | #f5f5f5 / #ffffff per row |
| FAB (floating) | 680–760 | 80 | overlays content |
| Bottom tab bar | 760–844 | 84 | #ffffff |

---

## Nav / header bar (exact)

- **Left control:** Circular avatar ~36 pt — real headshot photo of Matt Ryan (broker). Tapping opens the account/settings drawer or profile screen.
- **Center:** Text "Everyone" in white, ~17 pt semibold, followed immediately by a downward chevron ▾ (~12 pt, white). This is a dropdown/filter picker for scoping the feed (Everyone / Me / specific agent). Full center hit target is tappable.
- **Right controls (left → right):**
  1. Bell icon (~22 pt, white outline glyph) — notifications. No visible badge in this screenshot.
  2. Magnifying-glass icon (~22 pt, white outline glyph) — opens search overlay.
- **Right edge panel handle:** A small gray rounded-rect pull-tab with a left-facing chevron "<" is pinned to the right edge of the screen at approximately y 290–310 pt, width ~16 pt, height ~50 pt. It reveals a side panel (agent quick-filter or detail pane) when tapped/swiped.

---

## Sub-tab strip (exact)

Three text-only tabs, horizontally distributed, all-caps NOT used — sentence case:

| Position | Label | State |
|---|---|---|
| Left | New Leads | Inactive — white, ~14 pt, opacity ~0.6 |
| Center | Emails | **Active** — white, ~14 pt, full opacity, 2 pt bright-blue (#5ab4e8) underline bar flush to strip bottom |
| Right | Website | Inactive — white, ~14 pt, opacity ~0.6 |

Tab strip background is the same dark teal as the header; hairline separator (~0.5 pt, #4a6e82) divides strip from content.

---

## Bottom tab bar (exact) — CRITICAL

White background (#ffffff), ~84 pt tall including home indicator area. Five tabs:

| Order | Icon glyph | Label | Badge | Active? |
|---|---|---|---|---|
| 1 | Inbox tray / envelope-in-tray outline | Inbox | Red filled circle badge "30" (top-right of icon) | Inactive — gray #8e8e93 |
| 2 | Zigzag line chart / activity pulse line | Activity | None | **ACTIVE — #4a9fd4 (medium blue/teal)** |
| 3 | Calendar grid outline | Calendar | None | Inactive — gray #8e8e93 |
| 4 | Silhouette of person / two people | People | None | Inactive — gray #8e8e93 |
| 5 | Price-tag outline with dollar sign inside | Deals | None | Inactive — gray #8e8e93 |

**FAB:** Circular button ~56 pt diameter, solid blue (#4a9fd4, matches active tab color), white "+" glyph centered (~24 pt). Positioned bottom-right of the content area, approximately x 318–374 pt, y 690–746 pt — floats above the content list but below the tab bar. Tapping creates a new activity/note/task (sheet presented from bottom).

---

## Content — every element, in order

### List structure
Vertically scrolling list. Each row is a contact who has email activity. No section headers visible. No grouping or date-section separators — flat sorted list (most recent first).

### Row anatomy
```
[ Avatar 44pt circle ]  [ Contact name — left, ~17pt medium ]     [ Relative date — right, ~14pt gray ]
```
- Row height: ~72–76 pt
- Left inset: ~16 pt from screen edge to avatar
- Avatar-to-name gap: ~12 pt
- Name left-aligns to ~72 pt from screen edge
- Date right-aligns to ~16 pt from screen right edge
- Hairline divider (~0.5 pt, #e0e0e0) spans full width at row bottom (inset to ~72 pt from left to match name baseline — avatar area is NOT broken by divider)
- The entire row is a tap target → navigates to Contact Detail (Lead Profile) screen for that person
- No swipe-to-delete or swipe actions visible

### Avatar rules
- Shape: Circle, 44 pt diameter
- If contact has a photo uploaded: real photo rendered in circle (anti-aliased mask)
- If no photo: initials-based colored circle. Initials are 1 or 2 characters. Background color appears to be assigned per-contact (not status-based) — olive/yellow-green, steel-teal, red, gray are all visible

### All visible rows (top → bottom, verbatim):

| # | Avatar | Name | Date shown |
|---|---|---|---|
| 1 | Real photo — man in dark suit, gray tones | **Derek Winchell** | 5d |
| 2 | Gray circle, white initials "LM" | **Laurie McAdam** | 5d |
| 3 | Steel-teal circle, white initial "K" | **Kungfumailman** | 6d |
| 4 | Olive/yellow-green circle, white initials "NT" | **Nadean TaberMartinez** | Jun 20 |
| 5 | Red circle, white initials "TW" | **Theresa Wise** | Jun 17 |
| 6 | Olive/yellow-green circle, white initial "S" | **Scdvf** | Jun 17 |
| 7 | Real photo — man, outdoor/casual, Matt Ryan headshot | **Matt Ryan** | Jun 15 (partially obscured by FAB) |

(Row 7 is partially cut off at the screen bottom and its date is hidden behind the FAB.)

### Date format
- Within last 7 days: relative "Nd" (e.g., "5d", "6d")
- Older: "Mon DD" format (e.g., "Jun 20", "Jun 17", "Jun 15")
- Date text color: ~#8e8e93 (muted gray), ~14 pt regular weight

### Empty state
Not visible in this screenshot; standard FUB empty state would be centered icon + "No emails yet" text.

### Pull-to-refresh
[INFERRED] Standard iOS pull-to-refresh at top of scroll view; spinner appears in teal accent color.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / status bar bg | ~#3d5a6e (dark teal — FUB brand, NOT ryan-realty navy #102742) |
| Active tab / FAB / sub-tab underline | ~#4a9fd4 / #5ab4e8 (FUB blue-teal accent) |
| Sub-tab active underline bar | ~#5ab4e8 (brighter sky blue, 2 pt height) |
| Header text ("Everyone") | #ffffff |
| Header icons (bell, search) | #ffffff |
| Inactive sub-tab labels | rgba(255,255,255,0.6) |
| Active sub-tab label | #ffffff, full opacity |
| Content list bg (rows) | #ffffff |
| Content list bg (screen behind rows) | ~#f2f2f7 (standard iOS grouped bg) |
| Row primary text (names) | #1c1c1e (~17 pt, SF Pro Text Medium/Semibold) |
| Row date text | ~#8e8e93 (~14 pt, SF Pro Text Regular) |
| Row divider | ~#e0e0e0, 0.5 pt hairline |
| Bottom tab bar bg | #ffffff |
| Active tab icon + label | ~#4a9fd4 (blue-teal) |
| Inactive tab icon + label | ~#8e8e93 (gray) |
| Inbox badge bg | #ff3b30 (iOS red) |
| Inbox badge text | #ffffff, ~11 pt bold |
| Avatar initials bg — gray | ~#8e9ba8 |
| Avatar initials bg — olive | ~#7a8c1e |
| Avatar initials bg — steel teal | ~#4e7580 |
| Avatar initials bg — red | ~#c0392b |
| Avatar initials text | #ffffff, ~16 pt semibold |
| FAB bg | ~#4a9fd4 |
| FAB icon | #ffffff |
| Right-edge panel handle | ~#c7c7cc, rounded rect |

**Font:** System font is SF Pro Text (iOS native). FUB uses standard iOS text rendering throughout. The agent should use `font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif` in web rebuild.

---

## Interactions & gestures

- **Tap "Everyone" ▾** → Bottom sheet or popover presents agent filter options (Everyone / specific agent names) [INFERRED]
- **Tap bell icon** → Pushes or presents Notifications screen [INFERRED]
- **Tap search icon** → Presents search overlay with text input [INFERRED]
- **Tap "New Leads" sub-tab** → Switches list to show contacts who are new leads (email-based activity changes) [INFERRED]
- **Tap "Emails" sub-tab** → Current view — no-op
- **Tap "Website" sub-tab** → Switches list to website visitor activity [INFERRED]
- **Tap any row** → Pushes Contact Detail (Lead Profile) screen for that contact
- **Swipe row left** [INFERRED] → May reveal quick actions (archive, tag, call — standard FUB pattern)
- **Pull down on list** → Pull-to-refresh [INFERRED]
- **Tap "+" FAB** → Presents bottom sheet for creating new activity / note / task [INFERRED]
- **Tap "<" right-edge handle** → Slides in a right-side panel (quick detail pane or agent list) [INFERRED]
- **Tap "Inbox" tab** → Switches to Inbox screen (badge "30" = 30 unread items)
- **Tap "Activity" tab** → Already active — scrolls to top
- **Tap "Calendar" tab** → Switches to Calendar / Appointments screen
- **Tap "People" tab** → Switches to People / Contacts list
- **Tap "Deals" tab** → Switches to Deals pipeline screen
- **Tap avatar (header)** → Opens account drawer / profile settings [INFERRED]

---

## Build notes (component tree)

```
<MobileShell bg="#f2f2f7">

  <StatusBar style="light-content" bg="#3d5a6e" />

  <TopBar bg="#3d5a6e" height={56}>
    <AvatarButton
      src={currentUser.photoUrl}     // Matt Ryan headshot
      size={36}
      shape="circle"
      onTap="openAccountDrawer"
    />
    <AgentFilterDropdown
      label="Everyone"
      chevron="▾"
      color="#ffffff"
      fontSize={17}
      fontWeight="600"
      onTap="openAgentFilterSheet"
    />
    <IconButton icon="bell-outline" color="#ffffff" size={22} onTap="openNotifications" />
    <IconButton icon="search" color="#ffffff" size={22} onTap="openSearch" />
  </TopBar>

  <SubTabStrip
    bg="#3d5a6e"
    height={40}
    activeColor="#ffffff"
    inactiveColor="rgba(255,255,255,0.6)"
    underlineColor="#5ab4e8"
    underlineHeight={2}
    tabs={["New Leads", "Emails", "Website"]}
    activeIndex={1}
    onTabChange={(i) => setActiveSubTab(i)}
  />

  <ScrollView
    flex={1}
    bg="#f2f2f7"
    refreshControl={<RefreshControl color="#4a9fd4" />}
  >
    {emailActivity.map(contact => (
      <ActivityRow
        key={contact.id}
        avatar={
          contact.photoUrl
            ? <CirclePhoto src={contact.photoUrl} size={44} />
            : <InitialsAvatar
                initials={getInitials(contact.name)}
                size={44}
                bg={contact.avatarColor}   // per-contact assigned color
                color="#ffffff"
                fontSize={16}
                fontWeight="600"
              />
        }
        name={contact.name}              // ~17pt, #1c1c1e, semibold
        date={formatRelativeDate(contact.lastEmailAt)}  // "5d" / "Jun 20"
        dateColor="#8e8e93"
        divider={true}                   // hairline, inset to avatar width + gap
        onTap={() => navigate("ContactDetail", { contactId: contact.id })}
      />
      // Row layout:
      // paddingLeft=16, paddingRight=16, paddingVertical=14
      // avatar: 44pt circle, marginRight=12
      // name: flex=1, fontSize=17, fontWeight="500", color="#1c1c1e"
      // date: fontSize=14, fontWeight="400", color="#8e8e93"
      // Divider: height=0.5, color="#e0e0e0", marginLeft=72 (72 = 16 + 44 + 12)
    ))}
  </ScrollView>

  <FAB
    icon="plus"
    iconColor="#ffffff"
    bg="#4a9fd4"
    size={56}
    position="absolute"
    bottom={84 + 16}        // above tab bar + 16pt padding
    right={16}
    shadow={{ color: "#4a9fd4", opacity: 0.4, radius: 8, offset: [0, 4] }}
    onTap="openCreateActivitySheet"
  />

  <BottomTabBar
    bg="#ffffff"
    height={84}
    borderTop="0.5pt solid #e0e0e0"
    activeColor="#4a9fd4"
    inactiveColor="#8e8e93"
    tabs={[
      { icon: "inbox-tray", label: "Inbox", badge: 30, badgeBg: "#ff3b30" },
      { icon: "activity-line", label: "Activity", active: true },
      { icon: "calendar-grid", label: "Calendar" },
      { icon: "people-silhouette", label: "People" },
      { icon: "price-tag-dollar", label: "Deals" },
    ]}
    onTabChange={(i) => navigateTab(i)}
  />

  <RightEdgePanelHandle
    position="absolute"
    right={0}
    top={290}
    width={16}
    height={50}
    bg="#c7c7cc"
    borderRadius={8}
    icon="chevron-left"
    onTap="openRightPanel"
  />

</MobileShell>
```

### Key data bindings
- `emailActivity[]` — array of contacts with recent email activity, sorted by `lastEmailAt` DESC. Fields needed: `id`, `name`, `photoUrl`, `avatarColor`, `lastEmailAt`
- `currentUser.photoUrl` — broker headshot for header avatar
- `agentFilter` — string "Everyone" or specific agent name; controls `emailActivity` scope
- `unreadInboxCount` — integer (30 shown); drives badge on Inbox tab

### Spacing constants
- Row height: 72–76 pt (auto from content + padding)
- Row paddingVertical: 14 pt each side
- Avatar size: 44 pt
- Avatar left inset: 16 pt
- Avatar-to-name gap: 12 pt
- Name left edge: 72 pt (16 + 44 + 12)
- Row divider left inset: 72 pt (aligns under name, not under avatar)
- Date right inset: 16 pt
- FAB size: 56 pt diameter
- FAB bottom clearance above tab bar: 16 pt
- Sub-tab strip height: 40 pt
- Active underline: 2 pt, flush to bottom of strip

### Responsive web notes
- On screens ≥ 768 px, this view would render in a center column ~390 px wide (phone-width locked)
- The right-edge panel handle likely maps to a collapsible sidebar in the desktop layout
- Bottom tab bar maps to a persistent left-rail sidebar on desktop
- FAB maps to a fixed-position button bottom-right in the mobile web shell
