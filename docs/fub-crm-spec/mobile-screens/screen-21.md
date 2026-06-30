<!-- Mobile per-screen appendix. Original: IMG_5983.PNG | id: mob-21 | tiles: mob-tiles/mob-21_{full,t,m,b}.png -->

# mob-21 — fub-ios — My Inbox (Inbox Sub-Tab)

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app — dark slate/teal header, avatar top-left, FUB blue accent, bottom bar Inbox/Activity/Calendar/People/Deals)
- **module:** Inbox / Conversations
- **screen:** "My Inbox" — Inbox sub-tab active; shows threaded email + SMS conversation list filtered to the signed-in agent's inbox
- **how to reach:** tap "Inbox" tab (leftmost, index 0) in the bottom tab bar from any screen; default landing view after login
- **iOS status bar:** time "8:39" left-aligned, white text; right side: signal bars (3 bars), WiFi icon, battery icon showing "37" (battery percentage), all white — on dark header background
- **URL bar:** N/A (native app, no browser chrome)

---

## Screen regions (y-bands on 390×844 pt logical canvas)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–44 | 44 | Dark slate ~#3D4B5C |
| Nav / header bar | 44–104 | 60 | Dark slate ~#3D4B5C (same as status bar, continuous) |
| Sub-tab strip | 104–148 | 44 | Medium gray ~#D8DCE0 |
| Scrollable content list | 148–760 | 612 | White #FFFFFF |
| FAB (floating, overlays content) | ~680–740 (floating) | 56 dia | Blue ~#2E7AF4 |
| Bottom tab bar | 760–844 | 84 | White #FFFFFF |

---

## Nav / header bar (exact)

- **Background:** continuous with status bar; dark slate ~#3D4B5C (not pure navy, a cooler gray-teal)
- **Left control:** circular avatar photo of the signed-in broker (Matt Ryan headshot), ~36 pt diameter, no border ring; tappable → opens account/profile settings or agent switcher
- **Center:** text "My Inbox" in white, ~17pt semibold; immediately right of text is a downward chevron "▾" in white — indicates a dropdown to switch inbox scope (e.g. My Inbox → Team Inbox → All Inbox); center-aligned horizontally
- **Right controls (left to right):**
  1. Bell icon (outline, white, ~22pt) — notifications; no visible badge in this screenshot
  2. Magnifying glass / search icon (outline, white, ~22pt) — opens in-inbox search

---

## Sub-tab strip (exact)

- **Background:** light gray ~#D8DCE0, full width, height ~44pt
- **Tabs (left to right):**
  1. **Inbox** — ACTIVE: white rounded-rect pill background (#FFFFFF), label "Inbox" in dark text ~#1C1C1E, ~14pt medium/semibold
  2. **Assigned** — inactive: no pill, label "Assigned" in medium gray ~#6B7280, ~14pt regular
  3. **Sent** — inactive: no pill, label "Sent" in medium gray ~#6B7280, ~14pt regular
  4. **Closed** — inactive: no pill, label "Closed" in medium gray ~#6B7280, ~14pt regular
- **Far right icon:** horizontal sliders / filter icon (three horizontal lines with tick marks — like a settings/filter glyph), dark gray, ~22pt — taps to open filter/sort options for the inbox

---

## Bottom tab bar (exact) — CRITICAL

| Order | Icon glyph | Label | Badge | State |
|---|---|---|---|---|
| 1 | Inbox tray (outline rectangle with downward arrow into tray) | Inbox | Red pill "30" white text | **ACTIVE** — blue #2E7AF4 icon + label |
| 2 | Line chart / trending upward (zigzag line graph) | Activity | none | Inactive — gray #8E8E93 |
| 3 | Calendar grid (square with grid lines + top binding bar) | Calendar | none | Inactive — gray #8E8E93 |
| 4 | Two overlapping person silhouettes | People | none | Inactive — gray #8E8E93 |
| 5 | Dollar-sign tag (price tag shape with $ glyph) | Deals | none | Inactive — gray #8E8E93 |

- **Tab bar background:** white #FFFFFF with a very thin top separator line ~#E5E5EA
- **Active color:** FUB blue ~#2E7AF4 (both icon and label)
- **Inactive color:** medium gray ~#8E8E93
- **Badge:** red pill ~#FF3B30, white text "30", positioned top-right of the Inbox icon; approximately 18pt diameter pill for single/double digit counts

**FAB (Floating Action Button):**
- Blue circle ~#2E7AF4, 56pt diameter
- White "+" plus glyph centered, ~24pt, weight bold
- Position: bottom-right of scrollable area, approximately x=334, y=699 (above tab bar, overlapping last list row)
- Taps → compose new message / create new conversation (or new lead intake — inferred from FUB patterns) [INFERRED]

---

## Content — every element, in order

### Row 0 — System / Welcome banner row (not a real conversation)
- **Left side:** two stacked icons, no avatar circle:
  - Small blue filled circle (~8pt) — unread dot indicator
  - FUB stacked-layers logo mark icon (orange/red gradient, ~28pt) — identifies this as a FUB system message
- **Primary text:** "**Welcome to your inbox!**" — bold ~17pt dark #1C1C1E
- **Timestamp:** "just now" — right-aligned, gray ~#8E8E93, ~12pt
- **Body preview:** "Emails and text messages show up here. Swipe them when you are done with them." — two lines, ~14pt, gray ~#8E8E93
- **Behavior:** informational, not tappable to a real conversation; possibly dismissible

---

### Row 1 — Tiffany Clark (thread group, 1 message)
- **Unread indicator:** blue filled dot ~8pt, left margin ~16pt
- **Avatar:** 40pt circle, red background ~#D95252, white "TC" initials, ~15pt bold
- **Primary line:** "**Tiffany Clark**" bold ~17pt + space + "1" (message count, gray small text ~13pt)
- **Timestamp:** "5d" right-aligned, gray ~#8E8E93, ~12pt
- **Subject line:** small envelope/email icon (outline, light blue/gray ~#4A90D9, ~14pt) + "Order #WT0286975 - 20702 Beaumont Dr..." (truncated with ellipsis) + paperclip icon (attachment indicator)
- **Body preview:** "This message was sent securely using Zix® (http://www.zixcorp.com/get-started/) Email  Your Title" — truncated, ~13pt, gray #8E8E93
- **Right edge:** gray chevron "›" — indicates tappable → pushes to thread detail view

---

### Row 2 — Jeanette Argyle (thread group, 2 messages)
- **Unread indicator:** blue filled dot ~8pt
- **Avatar:** 40pt circle, dark brown/gray background ~#6B6E7A, white "JA" initials
- **Primary line:** "**Jeanette Argyle**" bold + "2" count
- **Timestamp:** "5" (partially visible — "5d", cut by tile boundary)
- **Subject line:** envelope icon + "Re: Broker Demand | 20702 Beaumont Dr" + paperclip icon
- **Body preview:** "Hi,"
- **Right edge:** chevron "›"

---

### Row 3 — Tiffany Clark (thread group, 9 messages)
- **Unread indicator:** blue filled dot ~8pt
- **Avatar:** 40pt circle, red ~#D95252, "TC"
- **Primary line:** "**Tiffany Clark**" bold + "9" count
- **Timestamp:** "6d"
- **Subject line:** envelope icon + "Re: Northpointe Homeowners Association" + paperclip icon
- **Body preview:** "Hi Matt,"
- **Right edge:** chevron "›"

---

### Row 4 — Matt Ryan (thread group, 1 message)
- **Unread indicator:** blue filled dot ~8pt
- **Avatar:** 40pt circle, purple/violet background ~#7B6FC4, white "MR" initials
- **Primary line:** "**Matt Ryan**" bold + "1" count
- **Timestamp:** "6d"
- **Subject line:** envelope icon + "Re:"
- **Body preview:** "CatherineCreek_53_archery.kmz" — (filename as body text, no preview)
- **Right edge:** chevron "›"

---

### Row 5 — Tiffany Clark (thread group, 6 messages)
- **Unread indicator:** blue filled dot ~8pt
- **Avatar:** 40pt circle, red ~#D95252, "TC"
- **Primary line:** "**Tiffany Clark**" bold + "6" count
- **Timestamp:** "6d"
- **Subject line:** envelope icon + "Re: 20702 Beaumont"
- **Body preview:** "Seventh Mountain Contracting, Ed Tena, 541-280-4528"
- **Right edge:** chevron "›"

---

### Row 6 — Tiffany Clark (thread group, 3 messages) — partially visible at bottom
- **Avatar:** 40pt circle, red ~#D95252, "TC" (partially cut off)
- **Primary line:** "**Tiffany Clark**" bold + "3" count
- **Timestamp:** "6/22/26" — exact date (older than 7d, switches to M/DD/YY format)
- **Subject line:** envelope icon + "Re: ARC Request"
- **Body preview:** (cut off at screen bottom)

---

### Row anatomy summary

```
[16pt] [blue-dot 8pt] [16pt] [avatar 40pt circle] [12pt] [content block flex-grow] [timestamp 12pt] [8pt] [chevron 16pt] [16pt]

content block:
  line 1: <ContactName bold 17pt> <messageCount gray 13pt>
  line 2: <emailIcon 14pt> <subject 14pt gray-dark> [attachIcon 14pt]
  line 3: <bodyPreview 13pt gray-light #8E8E93> (truncated 1 line)

Row height: ~76pt
Divider: 1pt line #F2F2F2 starting after the avatar (inset divider, not full-bleed)
```

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / status bar bg | ~#3D4B5C (dark cool slate, FUB signature) |
| Sub-tab strip bg | ~#D8DCE0 |
| Active sub-tab pill | #FFFFFF |
| Active tab bar icon + label | ~#2E7AF4 (FUB signature blue) |
| Inactive tab bar | #8E8E93 |
| Unread dot | ~#4A90D9 (slightly softer blue) |
| Avatar red (TC) | ~#D95252 |
| Avatar dark brown (JA) | ~#6B6E7A |
| Avatar purple (MR) | ~#7B6FC4 |
| Row bg | #FFFFFF |
| Row inset divider | ~#F0F0F0 |
| Contact name (primary) | #1C1C1E, 17pt, semibold/bold |
| Message count badge (inline) | #8E8E93, 13pt, regular |
| Subject / email icon line | #3C3C43 (darker gray), 14pt regular |
| Body preview | #8E8E93, 13pt, regular |
| Timestamp | #8E8E93, 12pt, regular |
| Chevron "›" | #C7C7CC |
| FAB bg | ~#2E7AF4 |
| Badge pill bg | #FF3B30 |
| Badge pill text | #FFFFFF, ~11pt bold |
| Email icon glyph | Outline envelope, ~#4A90D9 or similar muted blue |
| Paperclip attachment icon | ~#8E8E93 |

**Font:** SF Pro (system) throughout — standard FUB iOS rendering.
**FUB accent is blue ~#2E7AF4**, not navy. This is NOT the in-house app (which uses navy #102742 / cream #faf8f4).

---

## Interactions & gestures [INFERRED unless stated]

- **Tap any conversation row** → pushes ConversationDetail screen showing full thread (emails + texts) for that contact [INFERRED]
- **Swipe left on a row** → reveals action buttons (likely "Done" / "Archive" / "Snooze" or similar — FUB swipe-to-complete pattern; the welcome banner text says "Swipe them when you are done with them") [INFERRED from banner text]
- **Tap "My Inbox ▾" title** → presents a dropdown/sheet to switch scope: My Inbox / Team Inbox / Assigned to me / All [INFERRED]
- **Tap sub-tab "Assigned"** → reloads list filtered to conversations assigned to agent
- **Tap sub-tab "Sent"** → reloads list showing sent messages
- **Tap sub-tab "Closed"** → reloads list showing closed/resolved conversations
- **Tap sliders icon (sub-tab right)** → opens filter sheet (filter by contact, date, type) [INFERRED]
- **Tap bell icon** → navigates to notifications list [INFERRED]
- **Tap search icon** → opens inline search bar in the header [INFERRED]
- **Tap avatar (top-left)** → opens profile/account settings or agent-switcher sheet [INFERRED]
- **Tap FAB "+"** → opens compose sheet: new email, new text, or select contact to message [INFERRED]
- **Pull-to-refresh** → refreshes inbox list [INFERRED]
- **Tap bottom tabs** → switches top-level modules without animation stack (tab switch, not push) [INFERRED]

---

## Build notes (component tree)

```
<MobileShell bg="#FFFFFF">

  <IOSStatusBar
    time="8:39"
    textColor="#FFFFFF"
    bg="#3D4B5C"
  />

  <TopBar
    bg="#3D4B5C"
    height={60}
    left={
      <AvatarPhoto
        src={brokerHeadshotUrl}
        size={36}
        shape="circle"
        onTap="openAccountSettings"
      />
    }
    center={
      <TitleDropdown
        label="My Inbox"
        hasChevron={true}
        textColor="#FFFFFF"
        fontSize={17}
        fontWeight="600"
        onTap="openInboxScopePicker"
      />
    }
    right={[
      <IconButton icon="bell-outline" color="#FFFFFF" size={22} onTap="openNotifications" />,
      <IconButton icon="magnifying-glass" color="#FFFFFF" size={22} onTap="openSearch" />
    ]}
  />

  <SubTabStrip
    bg="#D8DCE0"
    height={44}
    tabs={["Inbox", "Assigned", "Sent", "Closed"]}
    activeTab="Inbox"
    activePillBg="#FFFFFF"
    activeTextColor="#1C1C1E"
    inactiveTextColor="#6B7280"
    fontSize={14}
    rightAction={
      <IconButton icon="sliders-horizontal" color="#3C3C43" size={22} onTap="openFilterSheet" />
    }
  />

  <ScrollView flex={1} bg="#FFFFFF">

    {/* Row 0 — System welcome banner */}
    <InboxWelcomeBanner
      title="Welcome to your inbox!"
      timestamp="just now"
      body="Emails and text messages show up here. Swipe them when you are done with them."
      leadIcon={<FUBLogoMark size={28} />}
      unreadDot={true}
    />

    {/* Rows 1–N — Conversation thread rows */}
    <InboxConversationRow
      unread={true}                        // boolean → shows blue dot
      avatar={<InitialsAvatar initials="TC" bg="#D95252" size={40} />}
      contactName="Tiffany Clark"
      messageCount={1}
      timestamp="5d"
      messageType="email"                  // → shows envelope icon
      subject="Order #WT0286975 - 20702 Beaumont Dr..."
      hasAttachment={true}                 // → shows paperclip icon
      bodyPreview="This message was sent securely using Zix® ..."
      onTap="pushConversationDetail(contactId)"
      swipeActions={["done", "snooze", "archive"]}
    />

    <InboxConversationRow
      unread={true}
      avatar={<InitialsAvatar initials="JA" bg="#6B6E7A" size={40} />}
      contactName="Jeanette Argyle"
      messageCount={2}
      timestamp="5d"
      messageType="email"
      subject="Re: Broker Demand | 20702 Beaumont Dr"
      hasAttachment={true}
      bodyPreview="Hi,"
      onTap="pushConversationDetail(contactId)"
    />

    <InboxConversationRow
      unread={true}
      avatar={<InitialsAvatar initials="TC" bg="#D95252" size={40} />}
      contactName="Tiffany Clark"
      messageCount={9}
      timestamp="6d"
      messageType="email"
      subject="Re: Northpointe Homeowners Association"
      hasAttachment={true}
      bodyPreview="Hi Matt,"
      onTap="pushConversationDetail(contactId)"
    />

    <InboxConversationRow
      unread={true}
      avatar={<InitialsAvatar initials="MR" bg="#7B6FC4" size={40} />}
      contactName="Matt Ryan"
      messageCount={1}
      timestamp="6d"
      messageType="email"
      subject="Re:"
      hasAttachment={false}
      bodyPreview="CatherineCreek_53_archery.kmz"
      onTap="pushConversationDetail(contactId)"
    />

    <InboxConversationRow
      unread={true}
      avatar={<InitialsAvatar initials="TC" bg="#D95252" size={40} />}
      contactName="Tiffany Clark"
      messageCount={6}
      timestamp="6d"
      messageType="email"
      subject="Re: 20702 Beaumont"
      hasAttachment={false}
      bodyPreview="Seventh Mountain Contracting, Ed Tena, 541-280-4528"
      onTap="pushConversationDetail(contactId)"
    />

    <InboxConversationRow
      unread={false}
      avatar={<InitialsAvatar initials="TC" bg="#D95252" size={40} />}
      contactName="Tiffany Clark"
      messageCount={3}
      timestamp="6/22/26"             // exact date shown when > 7 days old
      messageType="email"
      subject="Re: ARC Request"
      hasAttachment={false}
      bodyPreview="..."
      onTap="pushConversationDetail(contactId)"
    />

  </ScrollView>

  <FAB
    icon="plus"
    bg="#2E7AF4"
    iconColor="#FFFFFF"
    size={56}
    position="bottom-right"
    bottom={96}    // above tab bar
    right={16}
    onTap="openComposeSheet"
  />

  <BottomTabBar
    bg="#FFFFFF"
    height={84}
    borderTop="1px solid #E5E5EA"
    tabs={[
      { icon: "tray-inbox", label: "Inbox",    badge: 30,   active: true,  color: "#2E7AF4" },
      { icon: "chart-line",  label: "Activity", badge: null, active: false, color: "#8E8E93" },
      { icon: "calendar",    label: "Calendar", badge: null, active: false, color: "#8E8E93" },
      { icon: "people",      label: "People",   badge: null, active: false, color: "#8E8E93" },
      { icon: "tag-dollar",  label: "Deals",    badge: null, active: false, color: "#8E8E93" },
    ]}
  />

</MobileShell>
```

### Key data bindings
- `InboxConversationRow.avatar` → derive initials + color from contact name (deterministic color from name hash or FUB's own color assignment)
- `InboxConversationRow.timestamp` → relative format: "Xd" when ≤ 7 days ago; "M/DD/YY" when older
- `InboxConversationRow.messageCount` → inline after contact name, gray weight, e.g. " 9"
- `BottomTabBar.badge` → server-side unread inbox count; updates on focus
- `SubTabStrip` → controls server-side filter param on list endpoint

### Spacing details
- Row height: ~76pt (3 lines of content + padding)
- Avatar left offset: ~64pt from left edge (16pt margin + 8pt dot + 8pt gap + 40pt avatar start)
- Actually: left margin 16pt, then blue-dot 8pt, then 8pt gap, then avatar 40pt, then 12pt gap to content
- Inset row divider: starts at x≈76pt (left edge of avatar right), full width to right edge
- Content block right padding: ~40pt (to accommodate timestamp + chevron)
- Sub-tab strip pill: ~8pt vertical padding, ~16pt horizontal padding, 8pt corner radius, matches text width
- FAB: 56pt diameter, 16pt from right edge, ~12pt above tab bar top edge

### Avatar color scheme (FUB's deterministic color mapping — sample from screen)
- "TC" (Tiffany Clark) → Red ~#D95252
- "JA" (Jeanette Argyle) → Dark taupe ~#6B6E7A
- "MR" (Matt Ryan) → Purple ~#7B6FC4
- (No photo for contacts; photo only for the signed-in broker in top-left)
