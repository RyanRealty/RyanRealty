<!-- Mobile per-screen appendix. Original: IMG_5827.PNG | id: mob-07 | tiles: mob-tiles/mob-07_{full,t,m,b}.png -->

# mob-07 — fub-ios — Inbox / Conversations (My Inbox)

## Identity
- **app_source:** fub-ios (native Follow Up Boss iPhone app — dark teal/slate header, FUB logo in welcome row, bottom tab bar Inbox/Activity/Calendar/People/Deals)
- **module:** Inbox / Conversations
- **screen:** "My Inbox" — the primary conversations inbox showing threaded email/SMS conversations grouped by contact
- **how to reach:** Tap "Inbox" (leftmost bottom tab); default landing screen on app open
- **iOS status bar:** 4:33 · 2-bar cellular signal · WiFi (full) · Battery 100% (charging indicator present)
- **URL:** N/A — native iOS app, no browser URL bar

---

## Screen regions (y-bands on 390×844pt logical screen)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| iOS status bar | 0–54 | ~54pt | Transparent over header (#405C70 approx) |
| Nav/header bar | 54–118 | ~64pt | Dark teal-slate #405C70 |
| Sub-tab strip | 118–166 | ~48pt | Dark teal-slate #405C70 (same) |
| Unread count bar | 166–192 | ~26pt | Light gray #F2F2F7 |
| Scrollable conversation list | 192–780 | ~588pt | White #FFFFFF |
| Bottom tab bar | 780–844 | ~64pt | White #FFFFFF, top 1pt border #E0E0E0 |
| FAB (floats above tab bar) | ~710–760 | 50pt circle | Blue #2979FF, overlapping list |

---

## Nav / header bar (exact)

- **Left control:** Circular avatar of the logged-in user (Matt Ryan) — real headshot photo, ~40pt diameter, white 2pt border ring. Tapping opens account/profile settings or agent switcher.
- **Center:** Text "My Inbox" in white, ~18pt semibold, followed immediately by a downward chevron "∨" (▾). The chevron indicates a dropdown to switch inbox scope (My Inbox / Team Inbox / All). This entire element is tappable.
- **Right controls (left to right):**
  1. Bell icon — outline bell glyph, white, ~24pt. Tapping opens notifications panel. No visible badge in this screenshot.
  2. Magnifying glass (Search) icon — outline search glyph, white, ~24pt. Tapping activates an in-list search field.

---

## Sub-tab strip (exact)

Rendered as a horizontal segmented pill control anchored to the bottom of the header bar, spanning ~320pt wide, on the same dark background. A separate filter icon sits to the right outside the pill.

| Position | Label | State |
|---|---|---|
| 1 (leftmost) | Inbox | **Active** — filled pill background (~#5C7A8F or slightly lighter than header), white text, ~14pt medium |
| 2 | Assigned | Inactive — no pill, muted white/light text |
| 3 | Sent | Inactive |
| 4 (rightmost in pill) | Closed | Inactive |

- **Right of pill:** Filter/sort icon — three horizontal lines of decreasing length with vertical adjustment notches (≡ tuning sliders glyph), white, ~22pt. Tapping opens filter/sort sheet.

---

## Bottom tab bar (exact) — CRITICAL

Background: white, 1pt top border #E0E0E0. All icons ~24pt. Active color: teal-blue ~#00A4BD (FUB brand teal). Inactive: gray #8E8E93.

| Order | Icon glyph | Label | Badge | State |
|---|---|---|---|---|
| 1 | Inbox/tray (envelope in tray) | **Inbox** | Red circle "30" (~16pt, positioned top-right of icon) | **Active** — icon + label in FUB teal ~#00A4BD |
| 2 | Line chart / zigzag activity waveform | Activity | None | Inactive gray |
| 3 | Calendar grid (3×2 grid with top bar) | Calendar | None | Inactive gray |
| 4 | Two-person silhouette | People | None | Inactive gray |
| 5 | Dollar-sign tag / price-label outline | Deals | None | Inactive gray |

**FAB:** Circular button, ~50pt diameter, positioned bottom-right (~330pt from left, ~720pt from top), elevated above tab bar. Color: medium blue #2979FF (NOT the FUB teal — a brighter cobalt blue). Icon: white "+" plus sign, ~22pt. Tapping opens a compose/new-conversation sheet.

---

## Content — every element, in order

### Unread count bar
- Full-width band, ~26pt tall, background #F2F2F7 (light gray).
- Text: "**30** Unread conversations" — "30" is bold ~15pt dark (#1C1C1E), " Unread conversations" is regular weight same size, same dark color.
- No tap action (static label).

---

### Conversation list rows

Each row is a tappable cell, white background, separated by 1pt hairline dividers (#E5E5EA) at the left-indented position (starts after avatar). Tapping navigates to the thread detail view.

**Row anatomy:**
```
[unread dot?] [avatar 40pt] [primary text + count]            [timestamp]
              [channel icon] [subject line]        [paperclip?]
              [preview text line 1]
              [preview text line 2, truncated]
```

- **Unread dot:** 8pt filled blue circle (~#007AFF), positioned left of avatar (~12pt from left edge). Present on unread rows; absent on read rows.
- **Avatar:** 40pt circle. Either initials (2 chars, colored background) or a headshot photo. Initials font ~16pt semibold white.
- **Contact name:** ~16pt semibold black/near-black (#1C1C1E), followed by a space and a message-count number in ~15pt regular weight medium-gray (#8E8E93).
- **Timestamp:** ~13pt regular #8E8E93, top-right aligned.
- **Channel icon + subject:** Second line. Channel icon is a small (~14pt) envelope outline in teal-cyan (~#00A4BD for email). Subject text in ~14pt regular #1C1C1E, truncated with ellipsis. Paperclip icon (gray, ~12pt) appears right of subject when attachments present.
- **Preview text:** 1–2 lines of ~13pt regular #8E8E93, truncated. Shows the beginning of the message body.

**Swipe actions:** [INFERRED] Left-swipe reveals action buttons (likely "Done/Closed" green, "Assign" blue, "Delete" red — standard FUB inbox swipe pattern).

---

### Row-by-row data (verbatim)

**Row 1 — System/Welcome message**
- Unread dot: yes (blue)
- Avatar: FUB app logo — stylized chevron/house in red and gold/amber colors (~40pt, no circle background, transparent)
- Name: "Welcome to your inbox!" (bold, primary line only — no contact name format)
- Timestamp: "1m"
- Subject line: none (no channel icon or subject)
- Preview: "Emails and text messages show up here. Swipe them when you are done with them."

**Row 2 — Tiffany Clark (thread 1)**
- Unread dot: yes (blue)
- Avatar: "TC" initials, red/crimson circle (~#C0392B)
- Name: "Tiffany Clark" + count "1"
- Timestamp: "1d"
- Channel icon: email envelope (teal)
- Subject: "Order #WT0286975 - 20702 Beaumo..." (truncated)
- Paperclip: yes (right of subject)
- Preview: "This message was sent securely using Zix® (http://www.zixcorp.com/get-started/) Email  Your Title D..."

**Row 3 — Jeanette Argyle**
- Unread dot: yes (blue)
- Avatar: "JA" initials, slate-teal circle (~#4A6572 or similar)
- Name: "Jeanette Argyle" + count "2"
- Timestamp: "2d"
- Channel icon: email envelope (teal)
- Subject: "Re: Broker Demand | 20202 Beaumon..." (truncated)
- Paperclip: yes
- Preview: "Attached is an updated Broker Demand for Beaumont Dr.  Thank you,  [image: https://airt..."

**Row 4 — Tiffany Clark (thread 2)**
- Unread dot: none visible (read)
- Avatar: "TC" initials, red/crimson circle
- Name: "Tiffany Clark" + count "9"
- Timestamp: "3d"
- Channel icon: email envelope (teal)
- Subject: "Re: Northpointe Homeowners Associa..." (truncated)
- Paperclip: yes
- Preview: "Hi Matt,  The ARC has denied this color request. Please find the denial  letter attached.  Thank y..."

**Row 5 — Matt Ryan (contact thread)**
- Unread dot: yes (blue)
- Avatar: "MR" initials, purple-slate circle (~#7B68EE or #5D6D7E)
- Name: "Matt Ryan" + count "1"
- Timestamp: "3d"
- Channel icon: email envelope (teal)
- Subject: "Re:" (subject line appears mostly empty or truncated immediately)
- Paperclip: none visible
- Preview: "CatherineCreek_53_archery.kmz   Error in local style within a feature. • Feature name: #6 · 83.1 · ..."

**Row 6 — Tiffany Clark (thread 3)**
- Unread dot: yes (blue)
- Avatar: "TC" initials, red/crimson circle
- Name: "Tiffany Clark" + count "6"
- Timestamp: "3d"
- Channel icon: email envelope (teal)
- Subject: "Re: 20702 Beaumont"
- Paperclip: none visible
- Preview: "Seventh Mountain Contracting, Ed Tena, 541-280-4528  Townhouse Painters, Matt Caery,..."

**Row 7 — Tiffany Clark (thread 4, partially visible, bottom of scroll)**
- Unread dot: yes (blue)
- Avatar: "TC" initials, red/crimson circle; small gray left-arrow overlay (reply-sent indicator) on bottom-left of avatar
- Name: "Tiffany Clark" + count "3"
- Timestamp: partially cut off (~"4d")
- Channel icon: email envelope (teal)
- Subject: "Re: ARC Request"
- Preview: "Rachel,  Thank you so much! [image: Matt Ryan]"

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Header / nav bar bg | ~#405C70 (dark teal-slate; FUB brand dark) |
| Sub-tab active pill bg | ~#527082 (slightly lighter than header) |
| Active tab / accent | ~#00A4BD (FUB teal; Inbox tab, channel icons) |
| FAB color | ~#2979FF (cobalt blue, distinct from FUB teal) |
| Unread dot | #007AFF (iOS system blue) |
| Avatar — TC | ~#C0392B (red/crimson) |
| Avatar — JA | ~#4A6572 (dark slate-teal) |
| Avatar — MR (contact) | ~#7B68EE (medium purple-slate) |
| Primary text (names, subjects) | #1C1C1E |
| Secondary text (preview, timestamp, counts) | #8E8E93 |
| Row divider | #E5E5EA (hairline) |
| Count bar bg | #F2F2F7 |
| Tab bar bg | #FFFFFF |
| Tab bar top border | #E0E0E0 |
| Bottom tab inactive | #8E8E93 |
| Badge bg | #FF3B30 (iOS system red) |

**Typography:**
- Header title "My Inbox": ~18pt semibold white
- Sub-tab labels: ~14pt medium, active white, inactive ~#BFCDD6
- Count bar label: ~15pt, "30" bold #1C1C1E, rest regular #1C1C1E
- Contact name: ~16pt semibold #1C1C1E
- Message count after name: ~15pt regular #8E8E93
- Timestamp: ~13pt regular #8E8E93
- Subject line: ~14pt regular #1C1C1E
- Preview text: ~13pt regular #8E8E93
- Tab labels: ~10pt regular

**Iconography (all outline style, iOS SF Symbols or FUB custom):**
- Bell: outline bell glyph (notifications)
- Search: outline magnifying glass
- Filter: 3 horizontal adjustment sliders (≡ with notches)
- Email channel: small envelope outline, teal #00A4BD
- Paperclip: attachment indicator, gray
- FAB "+": bold plus sign, white on blue
- Inbox tab: tray/mailbox with envelope
- Activity tab: zigzag line chart
- Calendar tab: grid calendar
- People tab: dual-person silhouette
- Deals tab: price-tag with dollar sign

---

## Interactions & gestures

- **Tap row:** Pushes to ConversationDetail — full thread view with reply composer at bottom [INFERRED]
- **Tap "My Inbox ▾":** Presents dropdown/action sheet to switch inbox scope (My Inbox / Team Inbox / All Inboxes) [INFERRED]
- **Tap avatar (top-left):** Opens agent profile / account settings / logout [INFERRED]
- **Tap bell:** Pushes or slides in notifications panel [INFERRED]
- **Tap search:** Transitions sub-tab strip to a search field with keyboard [INFERRED]
- **Tap sub-tab (Assigned/Sent/Closed):** Reloads list with filtered conversation set; selected tab gains active pill styling [INFERRED]
- **Tap filter icon (≡ sliders):** Presents bottom sheet with sort/filter options (by agent, date, read status, channel, etc.) [INFERRED]
- **Swipe row left:** Reveals destructive/action buttons — e.g., "Done" (green), "Assign" (blue), "Delete" (red) [INFERRED — standard FUB pattern]
- **Swipe row right:** Possibly marks read/unread [INFERRED]
- **Pull to refresh:** Standard pull-down gesture triggers inbox refresh [INFERRED]
- **Tap FAB (+):** Opens compose sheet — new email/SMS to a contact, new conversation [INFERRED]
- **Tap Inbox tab (already active):** Scrolls list back to top [INFERRED]
- **Tap Activity / Calendar / People / Deals:** Switches to the corresponding module [INFERRED]

---

## Build notes (component tree)

```tsx
<MobileShell safeArea>

  {/* iOS status bar — handled by OS */}
  <StatusBar style="light" />

  {/* Header region — dark teal bg */}
  <TopBar bg="#405C70">
    <AgentAvatar
      src={user.photoUrl}
      size={40}
      borderColor="white"
      borderWidth={2}
      onPress={openAccountSheet}
    />
    <InboxScopeSelector
      label="My Inbox"
      showChevron
      onPress={openScopeDropdown}
      style={{ color: 'white', fontSize: 18, fontWeight: '600' }}
    />
    <IconButton icon="bell-outline" color="white" size={24} onPress={openNotifications} />
    <IconButton icon="search" color="white" size={24} onPress={activateSearch} />
  </TopBar>

  {/* Sub-tab segmented control */}
  <SubTabBar bg="#405C70" paddingBottom={12}>
    <SegmentedControl
      tabs={['Inbox', 'Assigned', 'Sent', 'Closed']}
      activeIndex={0}
      activePillBg="#527082"
      activeTextColor="white"
      inactiveTextColor="#BFCDD6"
      fontSize={14}
    />
    <IconButton icon="sliders-h" color="white" size={22} onPress={openFilterSheet} />
  </SubTabBar>

  {/* Unread count banner */}
  <CountBanner bg="#F2F2F7" px={16} py={6}>
    <Text>
      <Bold color="#1C1C1E" size={15}>{unreadCount}</Bold>
      <Regular color="#1C1C1E" size={15}> Unread conversations</Regular>
    </Text>
  </CountBanner>

  {/* Scrollable conversation list */}
  <FlatList
    data={conversations}
    keyExtractor={c => c.id}
    renderItem={({ item }) => (
      <ConversationRow
        unread={item.unread}               // boolean — shows blue dot
        avatar={
          item.contact.photoUrl
            ? <AvatarPhoto src={item.contact.photoUrl} size={40} />
            : <AvatarInitials
                initials={item.contact.initials}
                bg={item.contact.avatarColor}  // e.g. #C0392B for TC
                size={40}
              />
        }
        contactName={item.contact.name}
        messageCount={item.messageCount}    // number after name
        timestamp={item.relativeTime}       // "1m", "1d", "3d"
        channelIcon={
          item.channelType === 'email'
            ? <EmailIcon color="#00A4BD" size={14} />
            : <SmsIcon color="#00A4BD" size={14} />
        }
        subject={item.subject}              // truncated 1 line
        hasAttachment={item.hasAttachment}  // shows paperclip icon
        previewText={item.previewText}      // 2 lines, truncated
        replySentIndicator={item.replySent} // gray arrow overlay on avatar
        onPress={() => navigateTo('ConversationDetail', { id: item.id })}
        swipeActions={[
          { label: 'Done', color: '#34C759', onPress: () => markDone(item.id) },
          { label: 'Assign', color: '#007AFF', onPress: () => openAssignSheet(item.id) },
        ]}
      />
    )}
    ItemSeparatorComponent={() => (
      <Divider ml={72} height={StyleSheet.hairlineWidth} color="#E5E5EA" />
    )}
    refreshControl={<RefreshControl onRefresh={fetchInbox} />}
  />

  {/* Floating action button */}
  <FAB
    icon="plus"
    color="white"
    bg="#2979FF"
    size={50}
    position="absolute"
    bottom={80}   // above tab bar
    right={20}
    shadow
    onPress={openComposeSheet}
  />

  {/* Bottom tab bar */}
  <BottomTabBar bg="white" borderTopColor="#E0E0E0">
    <Tab
      icon="inbox-tray"
      label="Inbox"
      active
      activeColor="#00A4BD"
      badge={30}
      badgeBg="#FF3B30"
      onPress={() => switchTab('Inbox')}
    />
    <Tab icon="activity-chart" label="Activity" onPress={() => switchTab('Activity')} />
    <Tab icon="calendar-grid" label="Calendar" onPress={() => switchTab('Calendar')} />
    <Tab icon="people" label="People" onPress={() => switchTab('People')} />
    <Tab icon="deals-tag" label="Deals" onPress={() => switchTab('Deals')} />
  </BottomTabBar>

</MobileShell>
```

### Key data bindings
- `conversations[]` — array fetched from FUB `/v1/conversations?inbox=my&status=open&sort=-lastMessageAt`
- Each row needs: `contact.name`, `contact.initials`, `contact.avatarColor`, `contact.photoUrl`, `channelType` (email|sms), `subject`, `previewText`, `messageCount`, `relativeTime`, `unread` (bool), `hasAttachment` (bool), `replySent` (bool)
- `unreadCount` — total "30" from inbox metadata
- `user.photoUrl` — logged-in agent avatar (top-left)

### Spacing/sizing details
- Row height: ~88–96pt (3 text lines + padding)
- Avatar: 40pt circle, left padding 16pt, right margin 12pt
- Unread dot: 8pt, left 8pt from edge, vertically centered
- Subject line indent: same as preview (72pt from left edge = 16 + 40 + 16)
- Paperclip icon: right-aligned, ~12pt, same row as subject
- Timestamp: right-aligned, top of row, 16pt right padding
- Message count: rendered inline after name, ~4pt left gap, #8E8E93 regular weight
- FAB z-index above list, shadow elevation 8
- Sub-tab pill: 6pt vertical padding, 12pt horizontal padding, border-radius 6pt
- Filter icon: 16pt right of pill container right edge
