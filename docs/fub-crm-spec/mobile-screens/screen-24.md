<!-- Mobile per-screen appendix. Original: IMG_5986.PNG | id: mob-24 | tiles: mob-tiles/mob-24_{full,t,m,b}.png -->

# mob-24 — fub-ios — Inbox (My Inbox, Closed sub-tab)

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app)
- **module:** Inbox / Conversations
- **screen:** My Inbox — email conversation list, "Closed" sub-tab active
- **how to reach:** Tap "Inbox" bottom tab (leftmost); sub-tab strip defaults to "Inbox"; tap "Closed" to reach this state
- **iOS status bar:** 8:39 · signal bars · WiFi · battery ~37%
- **URL bar:** n/a (native app)

---

## Screen regions (y-bands, 390×844 pt logical)

| Region | y-band (approx pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | 54 pt | Dark teal/navy (~#1B3A4B) — blends with header |
| Nav / header bar | 54–104 | 50 pt | Dark teal/navy (~#1B3A4B) |
| Sub-tab strip | 104–148 | 44 pt | Dark teal/navy (~#1B3A4B) |
| Section count header | 148–172 | 24 pt | White (#FFFFFF) |
| Scrollable conversation list | 172–780 | 608 pt | White (#FFFFFF) |
| Bottom tab bar | 780–844 | 64 pt | White (#FFFFFF), hairline top border |
| FAB (overlaid) | ~720–766 (right edge) | 46 pt circle | Teal/blue (#2196F3 est.) |

---

## Nav / header bar (exact)

- **Left:** Circular avatar of logged-in user (Matt Ryan's photo, ~32 pt diameter, cropped circle, no border). Tapping opens account/profile settings.
- **Center:** Title text "My Inbox" in white, ~17 pt semibold. Followed immediately by a downward chevron "▾" indicating a dropdown to switch inbox context (e.g., All Inboxes, My Inbox, teammate inboxes).
- **Right (left-to-right):** Bell icon (outline notification bell, ~24 pt, white, no badge visible) · Search icon (magnifying glass, ~24 pt, white). Both are tap targets.

---

## Sub-tab strip (exact) — CRITICAL

Four tabs rendered as a horizontal segmented strip inside the dark header region, plus a trailing filter icon.

| Position | Label | State |
|---|---|---|
| 1 | Inbox | Inactive — white text, no pill |
| 2 | Assigned | Inactive — white text, no pill |
| 3 | Sent | Inactive — white text, no pill |
| 4 | **Closed** | **Active** — white text inside a white-background rounded pill/capsule (~6 pt radius), text becomes dark teal |
| 5 (far right) | Filter/sliders icon | Tap target — opens filter/sort sheet; icon is two horizontal sliders (≡ with circle toggles), ~20 pt, white |

Tab labels: ~13 pt medium. Active pill background: white (~#FFFFFF), label text switches to dark teal (~#1B3A4B). Inactive labels: white ~65% opacity on the dark header bg.

---

## Bottom tab bar (exact)

Five tabs, left to right:

| # | Icon | Label | Badge | State |
|---|---|---|---|---|
| 1 | Chat-bubble / inbox icon | Inbox | Red circle badge "30" (white numeral, ~10 pt, red ~#E53935) | **Active** — dark teal fill ~#1B3A4B |
| 2 | Lightning bolt / activity icon | Activity | None | Inactive — gray |
| 3 | Calendar grid icon | Calendar | None | Inactive — gray |
| 4 | Person / silhouette icon | People | None | Inactive — gray |
| 5 | Handshake / briefcase icon | Deals | None | Inactive — gray |

- **FAB (+):** Teal/blue circle ~46 pt diameter, positioned above the tab bar at the right edge (~x=332, y=732 pt). White "+" glyph ~22 pt. Tapping opens a "New Conversation" or compose action sheet.
- Active tab icon and label color: dark teal (~#1B3A4B). Inactive: mid-gray (~#9E9E9E).
- Badge anchors to top-right of the Inbox icon; red circle with "30".

---

## Content — every element, in order

### Section header
```
30 Unread conversations
```
- Left-aligned, ~13 pt, gray (~#757575), no divider above, hairline below before first row.

### Conversation list rows

Each row is a horizontal strip, ~76–80 pt tall, full width, white background, hairline bottom divider (~#E0E0E0). Tapping pushes into the conversation thread detail view.

**Row anatomy:**
- **Left:** Circular avatar, ~40 pt diameter, initials-based colored circle when no photo. Initials: 1–2 characters, white text ~15 pt semibold. Unread indicator: small filled teal/blue dot ~8 pt on left edge of the row (outside or overlapping the avatar slightly) when conversation has unread messages.
- **Right of avatar (main content area):**
  - Line 1: Contact name (~14 pt semibold, black ~#212121) + message count in parentheses (~13 pt regular, gray) flush left; timestamp (~12 pt regular, gray ~#9E9E9E) flush right.
  - Line 2: Email channel icon (envelope ~12 pt, gray) + subject line (~13 pt regular, dark gray ~#424242), truncated with ellipsis.
  - Line 3: Preview snippet (~12 pt regular, gray ~#9E9E9E), truncated with ellipsis at ~2 lines.
- **Far right:** Paperclip/attachment icon (~14 pt gray) if the conversation has an attachment. No chevron visible on rows.

---

### Rows visible (verbatim transcription, top to bottom):

**Row 1 — Ginny Schider**
- Avatar: "GS" initials, green circle (~#4CAF50)
- Unread dot: teal
- Name: "Ginny Schider" · count: "1" · timestamp: "3d"
- Channel icon: envelope
- Subject: "MMG Weekly from Ginny Schider"
- Snippet: "Provided to you exclusively by Guild Mortgage. Email not displaying correctly? View it in your bro…"

**Row 2 — Ginny Schider (duplicate/another thread)**
- Avatar: "GS" initials, green circle
- Unread dot: teal
- Name: "Ginny Schider" · count: "1" · timestamp: (partially obscured / Jun)
- Channel icon: envelope
- Subject: "MMG Weekly from Ginny Schider"
- Snippet: "Provided to you exclusively by Guild Mortgage. Email not displaying correctly? View it in your bro…"

**Row 3 — Matt Ryan**
- Avatar: "MR" initials, blue-purple circle (~#5C6BC0)
- Unread dot: teal (or none — internal/sent)
- Name: "Matt Ryan" · count: "1" · timestamp: "Jun 19"
- Channel icon: envelope
- Subject: "Untitled document"
- Snippet: "Attached: Untitled document.pdf  Sent using Google Docs https://docs.google.com/"
- Attachment icon: paperclip visible at far right

**Row 4 — Ginny Schider**
- Avatar: "GS" initials, green circle
- Name: "Ginny Schider" · count: "1" · timestamp: "Jun 12"
- Channel icon: envelope
- Subject: "MMG Weekly from Ginny Schider"
- Snippet: "Provided to you exclusively by Guild Mortgage. Email not displaying correctly? View it in your bro…"

**Row 5 — Ginny Schider**
- Avatar: "GS" initials, green circle
- Name: "Ginny Schider" · count: "1" · timestamp: "Jun 5"
- Channel icon: envelope
- Subject: "MMG Weekly from Ginny Schider"
- Snippet: "Provided to you exclusively by Guild Mortgage. Email not displaying correctly? View it in your bro…"

**Row 6 — Jeanette Argyle**
- Avatar: "JA" initials, dark charcoal circle (~#424242)
- Name: "Jeanette Argyle" · count: "1" · timestamp: "Jun 1"
- Channel icon: envelope
- Subject: "Termination Agreement | 20373 Sagh…"
- Snippet: "Hi Jeff,   Attached is the Termination Agreement for Saghali Ct.  Thank you,  [image: https://…"
- Attachment icon: paperclip visible at far right

**Row 7 — Niki Checketts** (partially visible, bottom of scroll area, cropped by FAB)
- Avatar: "NC" or "NK" initials, color unclear (appears mid-tone)
- Name: "Niki Checketts"
- Subject/snippet: "Communication with Frankie" (partial)

---

### Right-edge scroll handle
A thin vertical pill (~4 pt wide, ~80 pt tall, gray ~#BDBDBD) appears on the right edge of the list, indicating scrollable content and current scroll position (mid-list).

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / status bar bg | Dark teal ~#1B3A4B (FUB brand) |
| Active sub-tab pill bg | White #FFFFFF |
| Active sub-tab label | Dark teal ~#1B3A4B |
| Inactive sub-tab label | White ~rgba(255,255,255,0.65) |
| Content bg | White #FFFFFF |
| Row divider | Hairline ~#E0E0E0 |
| Contact name text | Near-black ~#212121, ~14 pt semibold |
| Subject text | Dark gray ~#424242, ~13 pt regular |
| Snippet text | Mid-gray ~#9E9E9E, ~12 pt regular |
| Timestamp text | Mid-gray ~#9E9E9E, ~12 pt regular |
| Message count | Mid-gray ~#757575, ~13 pt regular |
| Section header text | Mid-gray ~#757575, ~13 pt regular |
| Unread dot | Teal ~#00ACC1 or ~#26C6DA, 8 pt filled circle |
| Avatar GS (Ginny Schider) | Green ~#4CAF50 |
| Avatar MR (Matt Ryan) | Blue-purple ~#5C6BC0 |
| Avatar JA (Jeanette Argyle) | Charcoal ~#424242 |
| Badge bg | Red ~#E53935 |
| Badge text | White #FFFFFF, ~10 pt bold |
| FAB bg | Teal/blue ~#2196F3 |
| FAB icon | White "+" ~22 pt |
| Active tab (Inbox) | Dark teal ~#1B3A4B |
| Inactive tab | Gray ~#9E9E9E |
| Font family | SF Pro (iOS system); FUB uses system sans |

---

## Interactions & gestures [INFERRED]

- **Tap avatar (header):** Opens account switcher or profile settings sheet.
- **Tap "My Inbox ▾":** Opens dropdown to switch between "My Inbox", "All Inboxes", teammate inboxes. Sheet presents from center/top.
- **Tap sub-tab (Inbox / Assigned / Sent / Closed):** Switches conversation filter; list refreshes. Active sub-tab gets white pill.
- **Tap filter/sliders icon:** Opens sort + filter bottom sheet (filter by date, label, lead source, etc.).
- **Tap bell icon:** Opens notifications panel.
- **Tap search icon:** Expands search bar inline or pushes to search screen.
- **Tap conversation row:** Pushes to conversation thread detail view (full email/SMS thread with reply composer).
- **Swipe left on row:** Reveals quick actions — likely "Close", "Archive", or "Assign" (colored action buttons). [INFERRED from FUB pattern]
- **Swipe right on row:** May reveal "Mark Unread" or "Star". [INFERRED]
- **Pull to refresh:** Standard iOS pull-to-refresh spinner at top of list reloads conversations.
- **Long press row:** May show context menu (Copy, Forward, etc.). [INFERRED]
- **Tap FAB (+):** Opens compose/new conversation sheet — likely lets user choose contact and channel (email, SMS, call).
- **Tap bottom tab bar tabs:** Switches root-level module (Inbox → Activity → Calendar → People → Deals).
- **Scroll list:** Standard vertical scroll; scroll indicator visible on right edge.

---

## Build notes (component tree)

```
<MobileShell bg="#FFFFFF">

  {/* Fixed top stack */}
  <StatusBar bg="#1B3A4B" style="light-content" time="8:39" battery="37%" />

  <TopBar bg="#1B3A4B" height={50}>
    <UserAvatar src={currentUser.photo} size={32} shape="circle" onTap="openProfile" />
    <InboxSwitcher
      label="My Inbox"
      chevron="▾"
      onTap="openInboxDropdown"
      color="#FFFFFF"
      fontSize={17}
      fontWeight="600"
    />
    <TopBarActions>
      <IconButton icon="bell-outline" size={24} color="#FFFFFF" onTap="openNotifications" />
      <IconButton icon="search" size={24} color="#FFFFFF" onTap="openSearch" />
    </TopBarActions>
  </TopBar>

  <SubTabStrip bg="#1B3A4B" height={44} paddingH={16} gap={8}>
    {/* Each tab: label, isActive drives white pill */}
    <SubTab label="Inbox" isActive={false} />
    <SubTab label="Assigned" isActive={false} />
    <SubTab label="Sent" isActive={false} />
    <SubTab label="Closed" isActive={true} />  {/* white pill bg, dark label */}
    <FilterButton icon="sliders" color="#FFFFFF" onTap="openFilterSheet" />
  </SubTabStrip>

  {/* Scrollable content */}
  <ScrollView flex={1}>

    <SectionHeader
      text="30 Unread conversations"
      fontSize={13}
      color="#757575"
      paddingH={16}
      paddingV={8}
    />

    {conversations.map(conv => (
      <ConversationRow
        key={conv.id}
        onTap={() => navigate('ConversationDetail', { id: conv.id })}
        onSwipeLeft={quickActions}  /* [INFERRED] */
      >
        <AvatarWithUnread
          initials={conv.contactInitials}       /* e.g. "GS" */
          bg={conv.avatarColor}                 /* e.g. "#4CAF50" */
          size={40}
          shape="circle"
          showUnreadDot={conv.hasUnread}        /* teal dot ~8pt left of avatar */
          unreadDotColor="#26C6DA"
        />
        <ConversationContent flex={1} paddingH={12}>
          <Row>
            <ContactName
              text={conv.contactName}           /* "Ginny Schider" */
              fontSize={14}
              fontWeight="600"
              color="#212121"
            />
            <MessageCount
              text={` ${conv.messageCount}`}    /* " 1" */
              fontSize={13}
              color="#757575"
            />
            <Spacer />
            <Timestamp
              text={conv.timestamp}             /* "3d" | "Jun 19" */
              fontSize={12}
              color="#9E9E9E"
            />
          </Row>
          <Row alignItems="center" gap={4}>
            <ChannelIcon type={conv.channel}    /* "email" → envelope icon */
              size={12} color="#9E9E9E"
            />
            <SubjectText
              text={conv.subject}               /* "MMG Weekly from Ginny Schider" */
              fontSize={13}
              color="#424242"
              numberOfLines={1}
            />
          </Row>
          <SnippetText
            text={conv.snippet}
            fontSize={12}
            color="#9E9E9E"
            numberOfLines={2}
          />
        </ConversationContent>
        {conv.hasAttachment && (
          <AttachmentIcon icon="paperclip" size={14} color="#9E9E9E" />
        )}
      </ConversationRow>
    ))}

  </ScrollView>

  {/* Floating action button */}
  <FAB
    icon="plus"
    iconSize={22}
    iconColor="#FFFFFF"
    bg="#2196F3"
    size={46}
    shape="circle"
    position="absolute"
    bottom={80}        /* above tab bar */
    right={16}
    onTap="openNewConversation"
    elevation={4}
  />

  {/* Bottom tab bar */}
  <BottomTabBar bg="#FFFFFF" borderTop="1px solid #E0E0E0" height={64}>
    <Tab icon="inbox" label="Inbox" badge={30} badgeColor="#E53935" isActive={true} activeColor="#1B3A4B" />
    <Tab icon="lightning" label="Activity" isActive={false} inactiveColor="#9E9E9E" />
    <Tab icon="calendar" label="Calendar" isActive={false} inactiveColor="#9E9E9E" />
    <Tab icon="person" label="People" isActive={false} inactiveColor="#9E9E9E" />
    <Tab icon="briefcase" label="Deals" isActive={false} inactiveColor="#9E9E9E" />
  </BottomTabBar>

</MobileShell>
```

### Data bindings
- `conversations[]` — array fetched from FUB `/v2/conversations?status=closed&assignedTo=me` (or equivalent); each item: `{ id, contactName, contactInitials, avatarColor, messageCount, channel, subject, snippet, timestamp, hasUnread, hasAttachment }`
- `sectionCount` — `30` (unread count within the Closed sub-tab)
- `currentUser.photo` — Matt Ryan headshot (from FUB session)

### Spacing / sizing summary
- Row height: ~76–80 pt
- Avatar: 40 pt diameter, 12 pt from left edge
- Content left pad: 12 pt from right edge of avatar
- Content right pad: 16 pt from right edge (or 32 pt when attachment icon present)
- Row divider: 1 pt, left-inset to avatar left edge (~52 pt from left edge of screen)
- Sub-tab strip: 44 pt tall, tabs ~13 pt text
- Header: 50 pt tall
- FAB: 46 pt circle, 16 pt from right, 80 pt from bottom
- Bottom tab bar: 64 pt tall (includes safe area padding on notched iPhones)
