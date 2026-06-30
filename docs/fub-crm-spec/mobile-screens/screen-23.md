<!-- Mobile per-screen appendix. Original: IMG_5985.PNG | id: mob-23 | tiles: mob-tiles/mob-23_{full,t,m,b}.png -->

# mob-23 — fub-ios — My Inbox / Sent sub-tab

## Identity
- **app_source:** fub-ios (Follow Up Boss native iPhone app)
- **module:** Inbox / Conversations
- **screen:** "My Inbox" — Sent sub-tab active
- **how to reach:** Tap "Inbox" bottom tab (far left) → default lands on My Inbox → tap "Sent" in the sub-tab segmented control
- **iOS status bar:** 8:39 · signal bars (3-bar, partial) · WiFi · Battery 37%
- **URL bar:** N/A — native app, no browser chrome

---

## Screen regions (y-bands on 390×844 pt logical canvas)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0 – 47 | 47 | #4d606e (dark slate-teal, matches header) |
| Nav / header bar | 47 – 107 | 60 | #4d606e (dark blue-slate) |
| Sub-tab segmented control | 107 – 151 | 44 | #3d5060 (slightly darker than header) |
| Count / context bar | 151 – 181 | 30 | #f0f0f0 (light gray) |
| Scrollable conversation list | 181 – 760 | ~579 | #ffffff (white) |
| Bottom tab bar | 760 – 844 | 84 | #ffffff (white) with hairline top border |
| FAB (floating action button) | overlaps list/tab boundary ~700 – 760 | — | #2196F3 (FUB blue circle) |

---

## Nav / header bar (exact)

- **Left control:** Circular avatar photo of Matt Ryan (~36 pt diameter). Tappable — [INFERRED] opens account/profile sheet or user switcher.
- **Center:** Text "My Inbox" in white, ~17 pt semibold, followed immediately by a downward caret "▾" (chevron-down glyph) indicating a dropdown picker. Tappable — [INFERRED] opens inbox-selector sheet (My Inbox / Team Inbox / etc.).
- **Right controls (L→R):**
  1. Bell icon (notifications, outlined glyph) — no visible badge in this frame. Tappable → notification center.
  2. Magnifying glass / search icon (outlined). Tappable → opens search overlay within inbox.
- **Header bg hex estimate:** #4d606e (dark desaturated teal-slate, characteristic FUB accent).

---

## Sub-tab segmented control (exact)

Horizontal pill-shaped segmented control spanning ~330 pt wide (leaving ~44 pt for the filter icon), height ~36 pt, inside a 44 pt bar.

| Position | Label | State |
|---|---|---|
| 1 | Inbox | Inactive — white text, no pill fill |
| 2 | Assigned | Inactive — white text, no pill fill |
| 3 | **Sent** | **ACTIVE** — white-filled capsule pill behind the label; label text is dark/black (~#1c1c1e) |
| 4 | Closed | Inactive — white text, no pill fill |

- **Filter/sort icon:** Rightmost, outside the segmented pill. Three horizontal lines of decreasing length (funnel/filter glyph), white, ~24 pt. Tappable — [INFERRED] opens filter sheet for conversation filtering.

---

## Count / context bar

Full-width, ~30 pt tall, bg #f0f0f0.

Text: **"30 Unread conversations"** — "30" is bold (~15 pt semibold dark), " Unread conversations" is regular weight dark gray. Left-aligned with ~16 pt left padding.

---

## Bottom tab bar (exact)

Height ~84 pt (includes home indicator zone ~34 pt). White bg. Hairline top border #d1d1d6.

| Order | Icon glyph | Label | Badge | State |
|---|---|---|---|---|
| 1 | Inbox/tray-with-envelope | **Inbox** | Red pill badge "30" (white numerals, ~#FF3B30 bg, ~18 pt diameter) | **ACTIVE** — icon + label both in FUB blue ~#2196F3 |
| 2 | Squiggly line chart (activity/stats) | Activity | None | Inactive — #8E8E93 gray |
| 3 | Calendar grid (month view with squares) | Calendar | None | Inactive — #8E8E93 gray |
| 4 | Two overlapping silhouettes | People | None | Inactive — #8E8E93 gray |
| 5 | Dollar-sign tag / price-tag glyph | Deals | None | Inactive — #8E8E93 gray |

- **FAB (+):** Blue circle (~52 pt diameter) positioned bottom-right of the scrollable list area, ~16 pt from right edge, ~16 pt above the tab bar. White "+" glyph centered. Bg ~#2196F3. [INFERRED] tap → compose new conversation / add new contact action sheet.

---

## Content — scrollable conversation list (every element in order)

### Section header
None visible — list begins immediately after the count bar.

### Row anatomy (applied uniformly to all rows)

```
[unread-dot] [avatar] [name + count-badge]          [time-ago]
             [channel-icon] [status-label]
             [preview-text (truncated)]
```

- **Unread dot:** ~8 pt solid blue circle (#2196F3), left edge ~8 pt from left, vertically centered on row. Visible on ALL rows in this view — all are unread.
- **Avatar:** 42 pt circle, ~16 pt from left edge (after dot). Either a photo (cropped circular) or a monogram (single uppercase initial or two initials) on a colored background. See per-row color table below.
- **Name:** Bold ~15 pt, dark #1c1c1e. Immediately right of avatar, top line. Name is followed by a count badge.
- **Count badge:** Small dark rounded rectangle/capsule with white numeral "1" — appears next to every name. Indicates 1 unread message in this conversation.
- **Time ago:** Right-aligned, ~13 pt, muted gray #8E8E93. Examples: "21h", "2d", "3d", "5d", "4d".
- **Channel icon:** Small envelope glyph (~13 pt), blue-ish, left-aligned below name. Indicates email channel.
- **Status label:** Text "archived" in gray/muted color, ~13 pt regular, immediately right of the envelope icon.
- **Preview text (3rd line):** Truncated URL/body text in light gray, ~12 pt. Content is: `archived (https://ryan-realty.com?_pxl=djoxLGM6NWI4NjlzMzYzOTM3NjYsYTox) Ma...` — FUB email tracking pixel URL pattern. Truncated with ellipsis.
- **Row height:** ~72–76 pt (3 lines of text content).
- **Divider:** 1 px hairline #e5e5ea, inset to avatar left edge (~58 pt from left), full width right.
- **Tap target:** entire row — [INFERRED] pushes to conversation detail view for that contact.
- **Swipe actions:** [INFERRED] left-swipe likely reveals archive/close/delete; right-swipe may reveal mark-as-read or assign action (FUB standard).

### All visible rows (verbatim text)

| # | Avatar | Name | Count | Time | Channel | Status | Preview (truncated) |
|---|---|---|---|---|---|---|---|
| 1 | Initials "NT" on dark olive-green bg (~#5a6e2a) | **Nadean TaberMartinez** | 1 | 21h | envelope | archived | archived (https://ryan-realty.com?_pxl=djoxLGM6NWI4NjlzMzYzOTM3NjYsYTox) Ma... |
| 2 | Photo (Matt Ryan circular crop — man, smiling) | **Matt Ryan** | 1 | (cut off) | envelope | archived | archived (https://ryan-realty.com?_pxl=djoxLGM6YjlhNWNhMzYzOTM3NjlsYTox) Ma... |
| 3 | Initials "BK" on dark teal bg (~#2e6e7a) | **Brian Keith** | 1 | 2d | envelope | archived | archived (https://ryan-realty.com?_pxl=djoxLGM6NGMwMDY0MzYzOTM3NjQsYTox)... |
| 4 | Initial "K" on medium purple bg (~#7b68b5) | **Kungfumailman** | 1 | 2d | envelope | archived | archived (https://ryan-realty.com?_pxl=djoxLGM6ZjA0NTM2MzYzOTM3MzgsYTox)... |
| 5 | Initial "S" on olive/brown bg (~#8a7a40) | **Scdvf** | 1 | 3d | envelope | archived | archived (https://ryan-realty.com?_pxl=djoxLGM6ZDQ0MmI3MzYzOTM5MzEsYTox)... |
| 6 | Photo (Derek Winchell — man in dress suit/tie) | **Derek Winchell** | 1 | 5d | envelope | archived | archived (https://ryan-realty.com?_pxl=djoxLGM6OTM1NTZhMzYzOTM5MzAs...)... |
| 7 | Photo (partially visible, avatar cut off at bottom) | **Laurie McAdam** | 1 | 4d | envelope | archived | (row partially clipped by bottom tab bar) |

Note: "Scdvf" is likely a test/garbage-data contact name. The pixel-tracking URLs in all preview lines confirm these are FUB-generated email tracking pixels for ryan-realty.com campaigns.

### Right-edge scroll affordance
A small gray pull-handle / scroll indicator is visible on the right edge of the list at approximately y=310 pt in the mid tile, indicating the list is scrollable and more content exists below.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / status bar bg | #4d606e (dark blue-slate — FUB brand chrome) |
| Sub-tab bar bg | #3d5060 (slightly darker) |
| Active sub-tab pill bg | #ffffff |
| Active sub-tab text | #1c1c1e (black on white pill) |
| Inactive sub-tab text | #ffffff (white on dark bg) |
| FUB accent / active color | ~#2196F3 (medium blue — FUB brand blue) |
| Unread dot | #2196F3 |
| FAB bg | #2196F3 |
| Active tab bar icon + label | #2196F3 |
| Inactive tab bar icon + label | #8E8E93 (iOS gray) |
| Badge bg | #FF3B30 (iOS system red) |
| Badge text | #ffffff |
| Count bar bg | #f0f0f0 |
| Count bar text ("30") | #1c1c1e bold |
| Count bar text (" Unread…") | #1c1c1e regular |
| Row bg | #ffffff |
| Row divider | #e5e5ea (1 px hairline) |
| Name text | #1c1c1e ~15 pt semibold |
| Time-ago text | #8E8E93 ~13 pt regular |
| Status "archived" text | #8E8E93 ~13 pt regular |
| Preview URL text | #aeaeb2 ~12 pt regular |
| Font | SF Pro (system default iOS), FUB uses system fonts |
| Avatar monogram bg | Per-contact deterministic color (olive-green, teal, purple, brown) |
| Avatar monogram text | #ffffff, ~16 pt semibold |

---

## Interactions & gestures [INFERRED]

- **Tap avatar (header):** Opens account settings or user profile switcher sheet.
- **Tap "My Inbox ▾":** Opens bottom sheet or dropdown to select inbox scope (My Inbox, Team Inbox, Unassigned, etc.).
- **Tap bell icon:** Opens notifications list view pushed or as sheet.
- **Tap search icon:** Presents search bar overlay for filtering conversations.
- **Tap sub-tab (Inbox / Assigned / Sent / Closed):** Switches conversation list to that category; animates segmented pill.
- **Tap filter icon:** Presents bottom sheet with filter options (date, channel, tags, assigned to, etc.).
- **Tap any conversation row:** Navigates (push transition) to conversation detail / thread view showing full message history.
- **Left-swipe on row:** Reveals swipe actions — likely "Archive", "Close", "Delete" (red destructive).
- **Right-swipe on row:** Likely reveals "Mark Read/Unread" or "Assign" quick action.
- **Tap FAB (+):** Presents compose sheet — new email / SMS / call log to a contact, or new contact creation.
- **Pull-to-refresh:** Triggers refresh of conversation list from FUB server.
- **Tap Inbox tab (already active):** Scrolls list back to top.
- **Tap Activity tab:** Navigates to activity feed.
- **Tap Calendar tab:** Navigates to calendar/appointments view.
- **Tap People tab:** Navigates to contacts/leads list.
- **Tap Deals tab:** Navigates to deals pipeline view.

---

## Build notes — component tree

```
<MobileShell bg="#ffffff">

  <IOSStatusBar
    time="8:39"
    signal={3}
    wifi={true}
    battery={37}
    bg="#4d606e"
    textColor="#ffffff"
  />

  <TopBar bg="#4d606e" height={60}>
    <Avatar
      src={mattRyanHeadshot}
      size={36}
      shape="circle"
      onTap="openProfileSheet"
    />
    <InboxSelector
      label="My Inbox"
      caretIcon="chevron-down"
      textColor="#ffffff"
      fontSize={17}
      fontWeight="600"
      onTap="openInboxPickerSheet"
    />
    <TopBarActions>
      <IconButton icon="bell-outline" color="#ffffff" size={24} onTap="openNotifications" />
      <IconButton icon="magnify" color="#ffffff" size={24} onTap="openSearch" />
    </TopBarActions>
  </TopBar>

  <SubTabBar bg="#3d5060" height={44}>
    <SegmentedControl
      tabs={["Inbox", "Assigned", "Sent", "Closed"]}
      activeIndex={2}
      activePillBg="#ffffff"
      activeTextColor="#1c1c1e"
      inactiveTextColor="#ffffff"
      pillRadius={20}
      fontSize={14}
      fontWeight="500"
    />
    <IconButton icon="filter-lines" color="#ffffff" size={22} onTap="openFilterSheet" />
  </SubTabBar>

  <CountBar bg="#f0f0f0" height={30} px={16}>
    <Text>
      <Bold>30</Bold> Unread conversations
    </Text>
  </CountBar>

  <ScrollView flex={1} bg="#ffffff">
    {conversations.map(convo => (
      <ConversationRow
        key={convo.id}
        unread={convo.unread}            /* boolean — drives blue dot */
        avatar={
          convo.photoUrl
            ? <CirclePhoto src={convo.photoUrl} size={42} />
            : <MonogramAvatar initials={convo.initials} bg={convo.avatarColor} size={42} />
        }
        name={convo.contactName}         /* bold 15pt #1c1c1e */
        messageCount={convo.count}       /* small dark badge "1" */
        timeAgo={convo.timeAgo}          /* 13pt #8E8E93, right-aligned */
        channelIcon="envelope"           /* blue envelope glyph */
        statusLabel={convo.status}       /* "archived" — 13pt #8E8E93 */
        preview={convo.previewText}      /* 12pt #aeaeb2, 1 line truncated */
        divider={true}                   /* hairline inset to avatar left */
        onTap={() => push(ConversationDetail, { id: convo.id })}
        swipeLeft={["Archive", "Close"]} /* destructive actions */
        swipeRight={["Mark Unread"]}
        height={74}
        px={16}
      />
    ))}
  </ScrollView>

  <FAB
    icon="plus"
    bg="#2196F3"
    color="#ffffff"
    size={52}
    position="absolute"
    bottom={84 + 16}   /* above tab bar */
    right={16}
    onTap="openComposeSheet"
  />

  <BottomTabBar bg="#ffffff" height={84} borderTop="1px #d1d1d6">
    <Tab icon="tray-envelope" label="Inbox" active={true}  activeColor="#2196F3" badge={30} badgeBg="#FF3B30" />
    <Tab icon="chart-line"    label="Activity"  active={false} inactiveColor="#8E8E93" />
    <Tab icon="calendar-grid" label="Calendar"  active={false} inactiveColor="#8E8E93" />
    <Tab icon="people-two"    label="People"    active={false} inactiveColor="#8E8E93" />
    <Tab icon="price-tag-dollar" label="Deals"  active={false} inactiveColor="#8E8E93" />
  </BottomTabBar>

</MobileShell>
```

### Data bindings
- `conversations[]` — array fetched from FUB API `/inbox` with filter `type=sent`
- Each item: `{ id, contactName, initials, avatarColor, photoUrl, count, timeAgo, status, channelType, previewText, unread }`
- `previewText` contains truncated email body; in this dataset all show FUB pixel-tracking archive notifications
- `avatarColor` is deterministically assigned from contact ID (FUB colors palette: olive-green, teal, purple, brown, orange, etc.)
- Badge "30" on Inbox tab = total unread across the Inbox view (persists across sub-tabs)
- `timeAgo` values observed: "21h", "2d", "3d", "4d", "5d"

### Spacing reference
- Row horizontal padding: 16 pt left + 16 pt right
- Avatar → content gap: 12 pt
- Left edge → unread dot center: 8 pt
- Unread dot → avatar left edge: ~8 pt (dot is outside avatar column)
- Sub-tab segmented control left margin: ~8 pt, right margin to filter icon: ~8 pt
- Count bar left padding: 16 pt

### Key implementation notes
1. The monogram avatar color is deterministic per-contact, not random — use a hash function on contact ID mapped to FUB's color palette.
2. Preview text shows raw tracking pixel URLs because FUB is displaying the email body preview of archived automated emails. In production, this should be replaced with actual message body preview.
3. The `count` badge (showing "1") uses a dark/black rounded rect, NOT the red system badge — it is a secondary badge style (message count per thread).
4. The FAB sits above the tab bar but below any sheet presentations; use `position: fixed` with `bottom: calc(84px + 16px)` in web implementation.
5. Sub-tab active state uses a white filled pill that slides between segments — animate with CSS transition on the pill `transform: translateX()` + `width`.
