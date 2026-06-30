# Mobile — Inbox & Conversation Threads

The mobile Inbox is the primary communications workspace in the Ryan Realty CRM, rendered as a responsive-web experience on phones (≤ 639px viewport). It presents threaded email, SMS, and call/voicemail conversations grouped by contact in a single scrollable list, organized by four sub-tabs (Inbox / Assigned / Sent / Closed). Tapping any thread row drills into the full conversation — either a rendered HTML email view or an SMS bubble thread — with a fixed compose panel at the bottom. The IA and swipe gestures exactly mirror the Follow Up Boss iOS app (the UX reference); all colors, fonts, and components are translated to the Ryan Realty design system (navy `#102742` / cream `#faf8f4`, Geist + Amboqia, shadcn/ui).

---

## Logical Screen Map

| # | Screen / State | Source |
|---|---|---|
| 26-A | My Inbox — Inbox sub-tab (default landing) | **[OBSERVED]** mob-07, mob-21 |
| 26-B | My Inbox — Sent sub-tab | **[OBSERVED]** mob-23 |
| 26-C | My Inbox — Closed sub-tab | **[OBSERVED]** mob-24 |
| 26-D | My Inbox — Assigned sub-tab | **[INFERRED]** — basis: mob-07/21 (tab visible), desktop §3 Assigned folder |
| 26-E | Email Thread Detail | **[OBSERVED]** mob-22 |
| 26-F | SMS Thread — Empty State | **[OBSERVED]** mob-38 |
| 26-G | SMS Thread — Kebab Action Sheet | **[OBSERVED]** mob-42 |
| 26-H | SMS Group Thread (2+ recipients) | **[OBSERVED]** mob-49 |
| 26-I | SMS Thread — Active with Message Bubbles | **[INFERRED]** — basis: mob-49 bubble rendering, desktop §5.3 SMS bubble layout |
| 26-J | Compose New Message sheet | **[INFERRED]** — basis: FAB on mob-07/21, desktop §7 inline compose |
| 26-K | Filter Sheet | **[INFERRED]** — basis: filter icon on mob-07/21/23/24, desktop §4.2 filter controls |
| 26-L | Inbox Scope Picker sheet | **[INFERRED]** — basis: "My Inbox ▾" chevron on all inbox screens, desktop §3.2 dual inbox |
| 26-M | Swipe Actions on row | **[INFERRED]** — basis: FUB docs §5 (swipe left = close, swipe right = assign) |

---

## Screen 26-A: My Inbox — Inbox Sub-Tab **[OBSERVED: mob-07, mob-21]**

### Purpose
Default landing screen on app open. Shows all active, unresolved email and SMS threads assigned to the logged-in broker.

### Screen Regions (390 × 844 pt logical canvas)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| Safe area / status bar | 0–54 | 54 | Transparent over header |
| Nav / header bar | 54–114 | 60 | Navy `#102742` (FUB: `#3D4B5C` dark slate) |
| Sub-tab strip | 114–158 | 44 | Slightly lighter navy `rgba(255,255,255,0.08)` over `#102742` (FUB: `#D8DCE0` light gray) |
| Unread count bar | 158–184 | 26 | `bg-muted` `#F2F2F7` (FUB: same) |
| Scrollable conversation list | 184–760 | 576 | `bg-background` cream `#faf8f4` |
| FAB (floating) | ~700–756 right edge | 56 dia | `bg-primary` navy `#102742` |
| Bottom tab bar | 760–844 | 84 | White `#FFFFFF`, 1pt top border `#E5E5EA` |

### Nav / Header Bar (exact)

| Element | Position | Spec |
|---|---|---|
| Agent avatar | Left, 16pt from left edge | 36pt circle; headshot photo if set, else initials; `border-radius: 50%`; tap → account/profile settings sheet |
| "My Inbox" title + ▾ | Center, horizontally centered | Geist 600 17pt white; chevron-down glyph 12pt white immediately right; entire cluster tappable → opens Inbox Scope Picker sheet (26-L) |
| Bell icon | Right, second from right | Outline bell glyph 22pt white; tap → notifications panel |
| Search icon | Right, rightmost, 16pt from right edge | Outline magnifying glass 22pt white; tap → inline search field replaces sub-tab strip |

### Sub-Tab Strip (exact)

Four tabs in a horizontal segmented control, spanning ~320pt, with filter icon at right.

| Position | Label | Active state | Inactive state |
|---|---|---|---|
| 1 | **Inbox** | White pill bg `#FFFFFF`, dark label `text-foreground` 14pt Geist 500 | No pill, `text-muted-foreground` 14pt |
| 2 | Assigned | No pill, `text-muted-foreground` | — |
| 3 | Sent | No pill, `text-muted-foreground` | — |
| 4 | Closed | No pill, `text-muted-foreground` | — |
| Right (outside pill) | Filter/sliders icon | — | 3-line horizontal sliders glyph, 22pt, `text-muted-foreground`; tap → filter sheet |

Active pill: 8pt vertical padding, 16pt horizontal padding, 8pt corner radius; slides between segments via CSS `transform: translateX()` transition 200ms ease-out.

**Note:** FUB mobile shows only 4 sub-tabs (Inbox / Assigned / Sent / Closed). Drafts is NOT shown as a sub-tab on mobile per FUB docs §22.

### Unread Count Bar

Full-width band, 26pt, `bg-muted` `#F2F2F7`.
- Text: `"30 Unread conversations"` — `"30"` is Geist 700 15pt `text-foreground`; `" Unread conversations"` is Geist 400 15pt `text-foreground`; 16pt left padding.
- No tap action — purely informational.
- Count is the unread thread count for the current scope+folder. Updates in real time.

### Conversation List Row Anatomy **[OBSERVED]**

Row height: ~76–80pt. White/cream `bg-card`. 1pt inset hairline divider `border-border` starting at avatar left edge (~64pt from screen left). Entire row is tappable.

```
[8pt] [unread-dot 8pt] [8pt] [avatar 40pt] [12pt] [content block flex-1] [16pt]

content block:
  ROW 1:  [ContactName Geist 600 16pt text-foreground] [" N" Geist 400 13pt text-muted-foreground]  →  [timestamp Geist 400 12pt text-muted-foreground]
  ROW 2:  [channel-icon 14pt text-primary]  [subject-line Geist 400 14pt text-foreground ellipsis]  [paperclip 12pt text-muted-foreground?]
  ROW 3:  [preview 1-2 lines Geist 400 13pt text-muted-foreground ellipsis]
```

**Element specs:**

| Element | Detail |
|---|---|
| Unread dot | 8pt filled circle `bg-primary` `#102742` (FUB: `#4A90D9`); left 8pt from screen edge; vertically centered on row; absent when thread is read |
| Avatar | 40pt circle; photo if available; else `<InitialsAvatar>` — 2-char initials Geist 700 ~15pt white on deterministic-color bg (see color table below) |
| Contact name | Geist 600 16pt `text-foreground` `#1C1C1E`; truncated 1 line |
| Message count | Geist 400 13pt `text-muted-foreground` `#8E8E93`; rendered inline after name with ~4pt gap; e.g., `" 9"` |
| Timestamp | Geist 400 12pt `text-muted-foreground` right-aligned top of row; 16pt right padding; format: `"Xm"` (minutes), `"Xh"` (hours), `"Xd"` (days) when ≤ 7 days; `"M/DD/YY"` when > 7 days (e.g., `"6/22/26"`) |
| Channel icon | 14pt glyph, `text-primary`; envelope = email; speech-bubble = SMS; phone = call/voicemail |
| Subject line | Geist 400 14pt `text-foreground`; truncated 1 line with ellipsis |
| Paperclip icon | 12pt `text-muted-foreground`; right of subject; present when `hasAttachment = true` |
| Preview text | Geist 400 13pt `text-muted-foreground`; 1–2 lines truncated; shows beginning of message body |
| Reply-sent indicator | Small gray left-arrow overlay on bottom-left of avatar when the broker sent the most recent message [OBSERVED mob-07 row 7] |
| Chevron › | `text-muted-foreground` `#C7C7CC`; right edge; 8pt from content right |

**Avatar color table (deterministic from contact name hash, FUB palette adapted to RR system):**

| Contact | FUB bg | RR mapping |
|---|---|---|
| TC (Tiffany Clark) | `#D95252` red | `hsl(0 63% 58%)` |
| JA (Jeanette Argyle) | `#6B6E7A` dark taupe | `hsl(231 7% 45%)` |
| MR (Matt Ryan) | `#7B6FC4` purple | `hsl(250 42% 60%)` |
| GS (Ginny Schider) | `#4CAF50` green | `hsl(123 43% 49%)` |
| AC (Andy Christensen) | `#C0621A` burnt orange | `hsl(26 77% 42%)` |

Use a deterministic hash function: `avatarColor = PALETTE[crc32(contactId) % PALETTE.length]` where PALETTE = 10+ distinct hues from the design system.

### Verbatim Row Data (mob-21 — Inbox sub-tab)

| Row | Name | Count | Time | Channel | Subject | Preview |
|---|---|---|---|---|---|---|
| 0 (system) | "Welcome to your inbox!" | — | "just now" | — | — | "Emails and text messages show up here. Swipe them when you are done with them." |
| 1 | Tiffany Clark | 1 | "5d" | email | "Order #WT0286975 - 20702 Beaumont Dr..." | "This message was sent securely using Zix® ..." |
| 2 | Jeanette Argyle | 2 | "5d" | email | "Re: Broker Demand | 20702 Beaumont Dr" | "Hi," |
| 3 | Tiffany Clark | 9 | "6d" | email | "Re: Northpointe Homeowners Association" | "Hi Matt," |
| 4 | Matt Ryan | 1 | "6d" | email | "Re:" | "CatherineCreek_53_archery.kmz" |
| 5 | Tiffany Clark | 6 | "6d" | email | "Re: 20702 Beaumont" | "Seventh Mountain Contracting, Ed Tena, 541-280-4528" |
| 6 | Tiffany Clark | 3 | "6/22/26" | email | "Re: ARC Request" | (cut off) |

Row 0 is a system banner (FUB logo icon, not a real conversation). It should render with the app's notification mark icon, not an initials avatar.

### FAB

- 56pt circle, `bg-primary` `#102742` (FUB: `#2E7AF4` blue)
- White `+` glyph 24pt centered
- Position: `position: fixed; bottom: calc(84px + 16px); right: 16px;` — i.e., 16pt above the tab bar, 16pt from right edge
- `box-shadow: 0 4px 12px rgba(16,39,66,0.30)`
- Tap → Compose New Message sheet (26-J)

### Bottom Tab Bar

Height 84pt (includes home indicator safe area ~34pt). White `#FFFFFF`, 1pt top border `#E5E5EA`.

| Order | Icon glyph | Label | Badge | Active state | Inactive |
|---|---|---|---|---|---|
| 1 | Inbox tray (envelope into tray) | **Inbox** | Red pill "30" — `bg-destructive` `#FF3B30`, white text 10pt bold; ~18pt diameter | `text-primary` `#102742` icon + label | `text-muted-foreground` `#8E8E93` |
| 2 | Line chart / zigzag | Activity | None | — | `#8E8E93` |
| 3 | Calendar grid | Calendar | None | — | `#8E8E93` |
| 4 | Two-person silhouette | People | None | — | `#8E8E93` |
| 5 | Dollar-sign tag | Deals | None | — | `#8E8E93` |

Icons: 24pt, label: Geist 400 10pt. Badge anchors top-right of icon.

### Swipe Actions on Rows **[INFERRED — FUB docs §5]**

- **Swipe left** → reveals `Close` action (destructive, `bg-destructive` coral); tapping moves thread to Closed folder
- **Swipe right** → reveals `Assign` action (primary, `bg-primary` navy); tapping opens agent picker sheet to reassign thread
- For rows already in Closed sub-tab: swipe left → `Reopen` action

### Interactions

| Trigger | Action |
|---|---|
| Tap row | Navigate to thread detail (26-E for email, 26-F/26-I for SMS) |
| Tap "My Inbox ▾" | Open inbox scope picker sheet (26-L) |
| Tap agent avatar (header) | Open account/profile settings sheet |
| Tap bell | Open notifications panel (push) |
| Tap search | Replace sub-tab strip with search input + keyboard; search across thread content |
| Tap sub-tab | Reload list for that folder; animate pill to new tab |
| Tap filter icon | Open filter sheet (26-K) |
| Swipe left on row | Reveal Close action button |
| Swipe right on row | Reveal Assign action button |
| Pull to refresh | `RefreshControl` triggers `GET /crm/conversations?inbox=my&folder=inbox` |
| Tap FAB | Open compose sheet (26-J) |
| Tap bottom tab | Switch top-level module |

### Component Tree

```tsx
<MobileShell safeArea>
  <StatusBar style="light" bg="bg-primary" />

  <TopBar bg="bg-primary" height={60} px={16}>
    <AgentAvatar
      src={currentUser.photoUrl}
      size={36}
      initials={currentUser.initials}
      shape="circle"
      onPress={openAccountSheet}
    />
    <InboxScopeButton
      label="My Inbox"
      icon={<ChevronDown size={12} />}
      textColor="white"
      fontSize={17}
      fontWeight={600}
      onPress={openScopePicker}
    />
    <TopBarActions gap={8}>
      <IconButton icon="bell-outline" color="white" size={22} onPress={openNotifications} />
      <IconButton icon="magnifying-glass" color="white" size={22} onPress={activateSearch} />
    </TopBarActions>
  </TopBar>

  <SubTabStrip bg="bg-primary/90" height={44} px={8}>
    <SegmentedPillControl
      tabs={['Inbox','Assigned','Sent','Closed']}
      activeIndex={activeTab}         // 0 = Inbox
      activePillBg="white"
      activeTextColor="text-foreground"
      inactiveTextColor="text-white/60"
      fontSize={14}
      onChange={setActiveTab}
    />
    <IconButton
      icon="sliders-horizontal"
      size={22}
      color="white"
      onPress={openFilterSheet}
    />
  </SubTabStrip>

  <UnreadCountBar bg="bg-muted" height={26} px={16}>
    <Text>
      <Bold className="text-foreground text-sm">{unreadCount}</Bold>
      <Regular className="text-foreground text-sm"> Unread conversations</Regular>
    </Text>
  </UnreadCountBar>

  <ScrollView
    className="flex-1 bg-background"
    refreshControl={<RefreshControl onRefresh={fetchInbox} />}
  >
    {/* System welcome row (if present) */}
    {systemBanner && (
      <InboxSystemBanner
        title={systemBanner.title}
        preview={systemBanner.preview}
        timestamp={systemBanner.relativeTime}
        icon={<AppIcon size={28} />}
      />
    )}

    {conversations.map((conv) => (
      <InboxConversationRow
        key={conv.id}
        unread={conv.unread}
        avatar={
          conv.contact.photoUrl
            ? <Avatar className="w-10 h-10"><AvatarImage src={conv.contact.photoUrl} /></Avatar>
            : <InitialsAvatar initials={conv.contact.initials} bg={conv.contact.avatarColor} size={40} />
        }
        contactName={conv.contact.name}
        messageCount={conv.messageCount}
        timestamp={conv.relativeTime}
        channelType={conv.channel}      // 'email' | 'sms' | 'call'
        subject={conv.subject}
        hasAttachment={conv.hasAttachment}
        previewText={conv.previewText}
        replySentIndicator={conv.lastMessageDirection === 'outbound'}
        onPress={() => navigate(`/crm/inbox/me/${activeFolder}/${conv.id}`)}
        swipeLeftAction={{ label: 'Close', variant: 'destructive', onPress: () => closeThread(conv.id) }}
        swipeRightAction={{ label: 'Assign', variant: 'default', onPress: () => openAssignSheet(conv.id) }}
      />
    ))}

    {conversations.length === 0 && (
      <InboxEmptyState folder={activeFolder} />
    )}
  </ScrollView>

  <FAB
    icon="plus"
    className="bg-primary text-primary-foreground"
    size={56}
    style={{ position: 'fixed', bottom: 'calc(84px + 16px)', right: '16px' }}
    onPress={openComposeSheet}
  />

  <BottomTabBar height={84} borderTop="border-border">
    <Tab icon="tray-inbox" label="Inbox" badge={inboxBadge} active />
    <Tab icon="chart-line" label="Activity" onPress={() => navigate('/crm/activity')} />
    <Tab icon="calendar-grid" label="Calendar" onPress={() => navigate('/crm/calendar')} />
    <Tab icon="people" label="People" onPress={() => navigate('/crm/people')} />
    <Tab icon="tag-dollar" label="Deals" onPress={() => navigate('/crm/deals')} />
  </BottomTabBar>
</MobileShell>
```

### Data Touched

- Entity: `crm_conversations` — fields: `id`, `contact_id`, `scope`, `folder`, `channel`, `subject`, `unread_count`, `last_message_at`, `assigned_user_id`
- Entity: `crm_people` — fields: `id`, `first_name`, `last_name`, `photo_url`, `avatar_color`
- Entity: `crm_messages` — fields: `body` (preview), `direction`, `sent_at`
- Query: `GET /crm/conversations?scope=me&folder=inbox&sort=-last_message_at`

### Acceptance Criteria — 26-A

1. **AC-26A-01** The "My Inbox" header title includes a `▾` chevron and opens an inbox scope picker on tap.
2. **AC-26A-02** The sub-tab strip renders exactly 4 tabs: Inbox, Assigned, Sent, Closed. No Drafts tab on mobile.
3. **AC-26A-03** The active sub-tab has a white filled pill; inactive tabs have no pill; pill animates between tabs.
4. **AC-26A-04** The unread count bar below the sub-tabs shows `"N Unread conversations"` where N matches the server count.
5. **AC-26A-05** Each conversation row renders: unread dot (when unread), 40pt avatar, contact name, message count, relative timestamp, channel icon, subject (1-line truncated), preview (2-line truncated).
6. **AC-26A-06** Timestamp shows `"Xm"` / `"Xh"` / `"Xd"` for ≤ 7 days; `"M/DD/YY"` for older.
7. **AC-26A-07** Paperclip icon appears on rows where `hasAttachment = true`.
8. **AC-26A-08** Swipe left on a row reveals a navy `Close` button; tapping it moves the thread to Closed folder.
9. **AC-26A-09** Swipe right on a row reveals an `Assign` button; tapping opens an agent picker.
10. **AC-26A-10** Pull-to-refresh reloads the conversation list from the server.
11. **AC-26A-11** Inbox tab badge shows the total unread count; badge is red `#FF3B30` with white text.
12. **AC-26A-12** The FAB is fixed above the tab bar (16pt gap) at the bottom-right; tapping opens the compose sheet.
13. **AC-26A-13** Tapping any row navigates to the correct thread detail screen (email → 26-E, SMS → 26-F/26-I).
14. **AC-26A-14** The system welcome banner row renders with the app icon (not an initials avatar) and the exact text: "Welcome to your inbox!" / "Emails and text messages show up here. Swipe them when you are done with them."

---

## Screen 26-B: My Inbox — Sent Sub-Tab **[OBSERVED: mob-23]**

Same shell as 26-A with `activeTab = 2` (Sent). Key differences:

### Content Differences

- **Status label** renders on row line 2 instead of or alongside the subject: text `"archived"` in Geist 400 13pt `text-muted-foreground`, right of the channel icon.
- **Preview text** is the email body preview (often a tracking pixel URL in this dataset): Geist 400 12pt `text-muted` `#aeaeb2`.
- Count badge in each row shows a small dark rounded-rect badge with white numeral `"1"` (the message count per thread) — this is distinct from the red app badge; it uses `bg-foreground/90 text-primary-foreground rounded-full px-1 text-[10pt]`.
- Time format: `"21h"`, `"2d"`, `"3d"`, `"4d"`, `"5d"` observed.
- Photo avatars appear for some contacts (Matt Ryan, Derek Winchell).

### Verbatim Row Data (mob-23)

| # | Avatar | Name | Count | Time | Status |
|---|---|---|---|---|---|
| 1 | "NT" olive-green | Nadean TaberMartinez | 1 | 21h | archived |
| 2 | Photo (Matt Ryan) | Matt Ryan | 1 | — | archived |
| 3 | "BK" dark teal | Brian Keith | 1 | 2d | archived |
| 4 | "K" purple | Kungfumailman | 1 | 2d | archived |
| 5 | "S" olive/brown | Scdvf | 1 | 3d | archived |
| 6 | Photo (Derek Winchell) | Derek Winchell | 1 | 5d | archived |
| 7 | Photo (partial) | Laurie McAdam | 1 | 4d | archived |

### Acceptance Criteria — 26-B

1. **AC-26B-01** Sent sub-tab active pill is in position 3 (index 2).
2. **AC-26B-02** Row line 2 shows the status label `"archived"` for auto-archived sent messages.
3. **AC-26B-03** Preview text on row line 3 shows the message body snippet (truncated 1 line, `text-muted`).
4. **AC-26B-04** Photo avatars render for contacts who have profile photos; initials fallback otherwise.

---

## Screen 26-C: My Inbox — Closed Sub-Tab **[OBSERVED: mob-24]**

Same shell as 26-A with `activeTab = 3` (Closed). Key differences:

- Header bg slightly different shade observed (`#1B3A4B` in mob-24 vs `#3D4B5C` in mob-21) — use `bg-primary` `#102742` uniformly in RR system.
- Active tab pill text becomes dark (`text-foreground`) on white pill.
- Section header row: `"30 Unread conversations"` in Geist 400 13pt `text-muted-foreground`.
- No Status label column on rows (Closed threads don't show "archived" label).
- Timestamps switch to absolute dates for older items: `"3d"`, `"Jun 19"`, `"Jun 12"`, `"Jun 5"`, `"Jun 1"`.

### Verbatim Row Data (mob-24)

| # | Avatar | Name | Count | Time | Subject |
|---|---|---|---|---|---|
| 1 | "GS" green | Ginny Schider | 1 | 3d | "MMG Weekly from Ginny Schider" |
| 2 | "GS" green | Ginny Schider | 1 | Jun | "MMG Weekly from Ginny Schider" |
| 3 | "MR" blue-purple | Matt Ryan | 1 | Jun 19 | "Untitled document" |
| 4 | "GS" green | Ginny Schider | 1 | Jun 12 | "MMG Weekly from Ginny Schider" |
| 5 | "GS" green | Ginny Schider | 1 | Jun 5 | "MMG Weekly from Ginny Schider" |
| 6 | "JA" charcoal | Jeanette Argyle | 1 | Jun 1 | "Termination Agreement | 20373 Sagh…" |
| 7 | — | Niki Checketts | — | — | "Communication with Frankie" |

Row 6 has a paperclip icon (Termination Agreement has an attachment).

### Swipe Direction Reversal for Closed Folder

Per FUB docs §5: swipe left on a **closed** conversation → `Reopen` action (`<Button variant="outline">`). This is the opposite of the Inbox folder where swipe left = Close.

### Acceptance Criteria — 26-C

1. **AC-26C-01** Closed sub-tab shows Reopen action on left-swipe (not Close).
2. **AC-26C-02** Timestamps format: `"Xd"` for ≤ 7 days, `"Mon DD"` for same year older items (e.g., `"Jun 12"`), `"M/DD/YY"` for prior year.
3. **AC-26C-03** Paperclip icon renders on rows with attachments.

---

## Screen 26-D: My Inbox — Assigned Sub-Tab **[INFERRED — basis: mob-07/21 tab strip; desktop §4.3 empty state]**

Same shell as 26-A with `activeTab = 1` (Assigned). Shows conversations that have been explicitly delegated to this agent from a team inbox.

**Empty state (when no assigned conversations):**
- Icon: person silhouette (gray, ~40pt)
- Heading: `"Assigned is empty."` — Geist 600 17pt `text-foreground`
- Onboarding card with video thumbnail placeholder, heading `"Get Started Today"`, subheading `"How the Inbox helps you never miss important conversations"`, button `"How It Works"` (`<Button variant="outline">`)

---

## Screen 26-E: Email Thread Detail **[OBSERVED: mob-22]**

### Purpose
Full-screen pushed view showing the body of a single email within a contact's conversation thread. Reached by tapping an email-channel row in the Inbox list.

### Screen Regions (390 × 844 pt)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| Safe area / status bar | 0–54 | 54 | Over dark header |
| Nav / header bar | 54–104 | 50 | `bg-primary` `#102742` (FUB: `#3a4655`) |
| Email subject block | 104–190 | 86 | `bg-background` white |
| Sender / meta row | 190–244 | 54 | `bg-background` white, 1pt `border-border` below |
| Email body (scrollable) | 244–790 | 546 | `bg-background` white |
| Home indicator safe area | 790–844 | 54 | `bg-muted` `#F2F2F7` |

No bottom tab bar (navigation stack push hides it). No FAB.

### Nav / Header Bar (exact)

| Element | Detail |
|---|---|
| Back chevron `‹` | White, 20pt, 44×44pt tap target; `navigation.goBack()` |
| Contact avatar (center) | 28pt circle; initials "TC" Geist 700 11pt white on `#e05252` coral; flush left of name |
| Contact name (center) | "Tiffany Clark" — Geist 500 17pt white; horizontally centered cluster with avatar |
| `···` kebab (right) | White horizontal ellipsis glyph, 44×44pt; opens action sheet |

Tapping the contact avatar or name navigates to the contact's full lead profile (`/crm/people/{contactId}`).

### Kebab Action Sheet Options **[INFERRED — basis: mob-22 observation + desktop §7 compose]**

Bottom sheet (`<Sheet side="bottom">`), presented from `···` tap:
- `Reply` — opens inline compose
- `Reply All` — opens inline compose with CC field
- `Forward` — opens compose with forwarding quote
- `Mark as Unread` — marks thread unread, returns to list
- `Archive` — closes the conversation (moves to Closed folder)
- `Delete` — confirmation prompt, then deletes

### Content: Email Subject Block (y 104–190 pt)

```tsx
<div className="px-4 py-4 bg-background">
  <h1 className="text-[22px] font-bold text-foreground leading-tight">
    Order #WT0286975 - 20702 Beaumont Drive, Bend OR 97701
  </h1>
</div>
```

- Font: Geist 700 22pt `text-foreground` `#1a1a1a`
- Wraps to 2 lines; padding 16pt horizontal × 16pt vertical
- Content: `email.subject`

### Content: Sender / Meta Row (y 190–244 pt)

```
[avatar 36pt] [name 15pt bold] [timestamp 13pt gray]    [reply-button 36×36pt]
              [thin divider below]
```

| Element | Detail |
|---|---|
| Sender avatar | 36pt circle; initials `"DW"` Geist 700 13pt white on `#3d7a5a` dark green (auto-assigned from sender name hash) |
| Sender name | "WTE Distribution" — Geist 600 15pt `text-foreground` |
| Timestamp | "Wed, 5:04pm" — Geist 400 13pt `text-muted-foreground`; below sender name |
| Reply button | 36×36pt rounded rect (`rounded-lg`), `bg-muted` `#e9e9eb`; curved reply-arrow glyph `text-foreground`; tap → opens inline compose sheet for this email's reply |
| Divider | 1pt `border-border` `#c6c6c8` full-width below the row |

### Content: Email Body (y 244–790 pt)

- 16pt horizontal padding, 20pt top padding
- Body font: Geist 400 15pt `text-foreground` `#1a1a1a`, line-height 1.5 (~22–24pt)
- Hyperlinks: `text-blue-600` `#007AFF` underlined, tappable
- Logo images: preserve via `<img>` tags with `max-width: 100%`
- Paragraph spacing: 16pt `margin-top` between blocks

**Rendering strategy:** Use a sandboxed `<iframe srcdoc={email.bodyHtml}>` with `sandbox="allow-same-origin allow-popups"` OR DOMPurify-sanitized `dangerouslySetInnerHTML`. For simple plain-text emails, render as `<p>` tags. For rich HTML newsletters, iframe is safer.

**Verbatim body observed (mob-22 — Western Title & Escrow email):**
1. Mountain-peak logo mark + "Western Title & Escrow" wordmark
2. "Your Title Documents are attached."
3. "Please note this email address is not monitored."
4. "For any Title related questions please contact Title Officer Support at [titleofficersupport@westerntitle.com](mailto:titleofficersupport@westerntitle.com). For any Escrow related questions please contact your Escrow Officer by locating their contact information on your attached Report."
5. "Western Title & Escrow Company greatly appreciates your business."
6. "Thank you," / "The Distribution Team" / "[www.westerntitle.com](https://www.westerntitle.com)"

### Right-Edge Side Panel Handle **[OBSERVED: mob-22]**

A 6×48pt dark-gray pill (`bg-muted-foreground/60`) anchored to the right edge at ~50% screen height (`position: absolute; right: 0; top: 50%;`). Tapping or swiping from right edge opens a Radix `<Sheet side="right">` contact context drawer showing:
- Contact name, last communication date
- Stage, assigned agent, lender
- Recent conversations list
- Activity feed

This is equivalent to the desktop right sidebar (desktop §6).

### Component Tree

```tsx
<MobileShell bg="bg-background">
  <StatusBar style="light" bg="bg-primary" />

  <TopBar bg="bg-primary" height={50}>
    <BackButton icon="chevron-left" color="white" onPress={navigation.goBack} />
    <ContactIdentityCluster
      onPress={() => navigate(`/crm/people/${contact.id}`)}
      className="flex-1 items-center justify-center flex-row gap-2"
    >
      <Avatar className="w-7 h-7">
        <AvatarFallback style={{ backgroundColor: contact.avatarColor }}>
          <span className="text-white text-[11px] font-bold">{contact.initials}</span>
        </AvatarFallback>
      </Avatar>
      <span className="text-white text-[17px] font-medium">{contact.name}</span>
    </ContactIdentityCluster>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton icon="ellipsis-horizontal" color="white" size={22} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={openReplyCompose}>Reply</DropdownMenuItem>
        <DropdownMenuItem onSelect={openReplyAllCompose}>Reply All</DropdownMenuItem>
        <DropdownMenuItem onSelect={openForwardCompose}>Forward</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={markUnread}>Mark as Unread</DropdownMenuItem>
        <DropdownMenuItem onSelect={archiveThread}>Archive</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onSelect={deleteThread}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </TopBar>

  <ScrollView className="flex-1 bg-background">
    {/* Subject */}
    <div className="px-4 py-4">
      <h1 className="text-[22px] font-bold text-foreground leading-tight">{email.subject}</h1>
    </div>

    {/* Sender row */}
    <div className="flex flex-row items-center px-4 py-3 border-b border-border gap-3">
      <Avatar className="w-9 h-9">
        <AvatarFallback style={{ backgroundColor: senderAvatarColor }}>
          <span className="text-white text-[13px] font-bold">{senderInitials}</span>
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="text-[15px] font-semibold text-foreground">{email.senderName}</p>
        <p className="text-[13px] text-muted-foreground">{formatEmailTimestamp(email.sentAt)}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="w-9 h-9 rounded-lg bg-muted"
        onPress={() => openReplyCompose(email.id)}
      >
        <ReplyArrowIcon className="w-4 h-4 text-foreground" />
      </Button>
    </div>

    {/* Email body */}
    <div className="px-4 pt-5 pb-10">
      <EmailBodyRenderer html={email.bodyHtml} />
    </div>
  </ScrollView>

  {/* Context drawer handle */}
  <Sheet>
    <SheetTrigger asChild>
      <div className="absolute right-0 top-1/2 w-1.5 h-12 bg-muted-foreground/40 rounded-l-md cursor-pointer" />
    </SheetTrigger>
    <SheetContent side="right" className="w-80">
      <ContactContextDrawer contactId={contact.id} />
    </SheetContent>
  </Sheet>
</MobileShell>
```

### Data Touched

- `crm_conversations` — `id`, `contact_id`, `subject`, `folder`
- `crm_messages` — `id`, `conversation_id`, `body` (HTML), `sender_name`, `sender_email`, `sent_at`, `direction`, `attachments`
- `crm_people` — `id`, `first_name`, `last_name`, `avatar_color`, `photo_url`

### Acceptance Criteria — 26-E

1. **AC-26E-01** Nav bar shows back button, contact avatar + name (tappable to profile), and kebab menu.
2. **AC-26E-02** Subject renders at 22pt bold, wrapping to as many lines as needed.
3. **AC-26E-03** Sender row shows 36pt avatar (initials with auto-color), sender name (15pt semibold), timestamp (13pt muted), and reply arrow button (36×36pt bg-muted).
4. **AC-26E-04** Email body renders HTML faithfully — images, links, tables, formatted text.
5. **AC-26E-05** Hyperlinks in email body are tappable (`mailto:` opens compose, `https:` opens in-app browser).
6. **AC-26E-06** Right-edge handle opens a contact context drawer (Sheet side="right") with contact info, recent conversations, and activity.
7. **AC-26E-07** No bottom tab bar visible; this is a pushed navigation view.
8. **AC-26E-08** Kebab menu offers: Reply, Reply All, Forward, Mark as Unread, Archive, Delete.
9. **AC-26E-09** Reply button and Reply kebab item both open an inline compose sheet pre-filled with Re: subject and reply-to address.
10. **AC-26E-10** Tapping the contact name/avatar navigates to `/crm/people/{contactId}`.

---

## Screen 26-F: SMS Thread — Empty State **[OBSERVED: mob-38]**

### Purpose
SMS conversation thread for a contact with no prior messages. Landing state when a new SMS thread is opened for the first time.

### Screen Regions (390 × 844 pt)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| Safe area / status bar | 0–54 | 54 | Over dark header |
| Nav / header bar | 54–110 | 56 | `bg-primary` `#102742` (FUB: `#3A4D5C`) |
| Scrollable message area | 110–746 | 636 | `bg-background` white (empty — no messages) |
| AI suggestion pill strip | 746–796 | 50 | `bg-background` white, `rounded-tl-xl rounded-tr-xl`, subtle top shadow |
| Compose input row | 796–844 | 48 | `bg-background` white |
| Home indicator | 844+ | 34 | `bg-background` |

No bottom tab bar (navigation stack hides it). No FAB.

### Nav / Header Bar (exact)

```
[ ‹ ]   [ AC avatar ]  Andy Christensen  [ › ]   [ phone ]  [ ··· ]
```

| Element | Detail |
|---|---|
| Back chevron `‹` | White, 20pt, `navigation.goBack()` → back to Inbox list |
| Contact avatar (center) | 34pt circle; initials `"AC"` Geist 400 14pt white on `#C0621A` burnt orange |
| Contact name (center) | "Andy Christensen" — Geist 600 17pt white |
| Right-pointing chevron `›` | White, ~10pt, immediately after name; taps → navigate to contact profile |
| Phone handset icon (right) | White filled handset glyph 22pt; tap → initiate outbound call via Twilio |
| `···` kebab (rightmost) | White horizontal ellipsis 22pt; tap → opens action sheet (see 26-G) |

The entire center cluster (avatar + name + `›`) is one tappable target → `/crm/people/{contactId}`.

### Message Area — Empty State

Pure white canvas between header and compose panel. No illustration, no instructional text, no loading spinner. The emptiness is intentional; the user's focus is the compose panel below.

### Compose Panel (fixed bottom)

A white floating card anchored above the keyboard (rises with keyboard). Has `border-top-left-radius: 12pt; border-top-right-radius: 12pt; box-shadow: 0 -1px 4px rgba(0,0,0,0.08)`.

#### Row 1: AI Suggestion Pill Strip (height ~50pt)

Horizontally scrollable row of pill buttons. Padding: 12pt left, 8pt gap between pills.

| Pill | Icon | Label | Style |
|---|---|---|---|
| 1 | ✦ sparkle (4-point star, 12pt) | **Introduction** | Outlined pill: 1pt `border-border` `#2B2B2B`; white fill; Geist 400 14pt `text-foreground`; h 34pt; `rounded-full`; px 16pt |
| 2 | ✦ sparkle | **Follow Up** | Same style |
| 3 | `+` plain plus | **Custom** | Same style |
| 4+ | (additional, off-screen right) | (unknown) | Horizontal scroll reveals more |

Tap "Introduction" → injects AI-drafted introduction SMS into compose field via `GET /crm/ai/sms-suggestion?type=introduction&contactId={id}`.
Tap "Follow Up" → injects follow-up SMS via `GET /crm/ai/sms-suggestion?type=followup&contactId={id}`.
Tap "Custom" → opens AI prompt modal or template picker.

#### Row 2: Compose Input Row (height ~48pt)

Three elements inline with 8pt horizontal padding, 6pt gap.

| Element | Detail |
|---|---|
| Attachment button | 34pt circle; `bg-muted` `#D1D1D6`; white `+` glyph; tap → media picker (`<Sheet>` with Photo Library / Camera / Document options) |
| Text input | Flex-1; `rounded-[18px]`; 1pt `border-border` `#C7C7CC`; `bg-background` white; placeholder `"Text message · SMS"` Geist 400 15pt `text-muted-foreground` `#8E8E93`; multiline; `paddingHorizontal: 14pt; paddingVertical: 8pt`; min-height 34pt |
| Send button | 34pt circle; `bg-primary` `#102742` (FUB: `#4DAFDF` light blue); white upward-arrow `↑` 16pt; disabled style when input empty: `opacity-40`; tap → `POST /crm/conversations/{id}/messages { body: draft, channel: 'sms' }` |

**Channel indicator:** The placeholder `"Text message · SMS"` distinguishes this from email threads. Middle dot `·` (U+00B7) separates the label from the channel type.

### Component Tree

```tsx
<MobileShell>
  <StatusBar style="light" bg="bg-primary" />

  <ConversationTopBar bg="bg-primary" height={56}>
    <BackButton icon="chevron-left" color="white" onPress={navigation.goBack} />
    <Pressable
      onPress={() => navigate(`/crm/people/${contact.id}`)}
      className="flex-1 flex-row items-center justify-center gap-2"
    >
      <InitialsAvatar initials={contact.initials} bg={contact.avatarColor} size={34} />
      <span className="text-white text-[17px] font-semibold">{contact.name}</span>
      <ChevronRight size={10} color="white" />
    </Pressable>
    <IconButton icon="phone" color="white" size={22} onPress={initiateCall} />
    <IconButton icon="ellipsis-horizontal" color="white" size={22} onPress={openKebabSheet} />
  </ConversationTopBar>

  <ScrollView
    className="flex-1 bg-background"
    contentContainerStyle={{ paddingBottom: composeHeight }}
  >
    {/* Empty — no messages yet */}
  </ScrollView>

  <KeyboardAvoidingView behavior="padding">
    <ComposePanel
      className="bg-background rounded-tl-xl rounded-tr-xl"
      style={{ boxShadow: '0 -1px 4px rgba(0,0,0,0.08)' }}
    >
      {/* AI pill strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        className="px-3 py-2 gap-2">
        <AISuggestionPill icon="sparkles" label="Introduction" onPress={injectIntro} />
        <AISuggestionPill icon="sparkles" label="Follow Up" onPress={injectFollowUp} />
        <AISuggestionPill icon="plus" label="Custom" onPress={openCustomPrompt} />
      </ScrollView>

      {/* Compose row */}
      <div className="flex flex-row items-center gap-1.5 px-2 pb-2">
        <Button variant="ghost" size="icon"
          className="w-[34px] h-[34px] rounded-full bg-muted"
          onPress={openMediaPicker}>
          <Plus size={16} className="text-foreground" />
        </Button>
        <Textarea
          className="flex-1 rounded-[18px] border border-border bg-background
                     px-3.5 py-2 text-[15px] min-h-[34px] resize-none"
          placeholder="Text message · SMS"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={1}
        />
        <Button
          className={cn(
            "w-[34px] h-[34px] rounded-full",
            draft.trim() ? "bg-primary" : "bg-muted opacity-40"
          )}
          disabled={!draft.trim()}
          onPress={sendSMS}
        >
          <ArrowUp size={16} className="text-primary-foreground" />
        </Button>
      </div>
    </ComposePanel>
  </KeyboardAvoidingView>
</MobileShell>
```

### Data Touched

- `crm_conversations` — `id`, `contact_id`, `channel` (`'sms'`)
- `crm_messages` — POST `{ conversation_id, body, direction: 'outbound', channel: 'sms', sent_at }`
- `crm_people` — `first_name`, `last_name`, `initials`, `avatar_color`, `phone`
- Twilio: `POST /twilio/send-sms { to: contact.phone, from: broker.twilio_number, body: draft }`

### Acceptance Criteria — 26-F

1. **AC-26F-01** Nav header shows back arrow, 34pt avatar, contact name, `›` link-to-profile chevron, phone icon, and kebab icon.
2. **AC-26F-02** Empty message area renders as a pure white canvas with no illustration or instructional text.
3. **AC-26F-03** AI pill strip is horizontally scrollable; renders Introduction, Follow Up, and Custom pills with sparkle/plus icons.
4. **AC-26F-04** Compose input placeholder reads exactly `"Text message · SMS"` (middle dot, not bullet or dash).
5. **AC-26F-05** Send button is disabled (low opacity) when input is empty; active when input has text.
6. **AC-26F-06** Tapping Introduction/Follow Up pills injects AI-generated SMS draft into the compose field.
7. **AC-26F-07** Attachment button opens a media picker (photo, camera, document).
8. **AC-26F-08** Send button POSTs the message body to the SMS layer (Twilio) and appends a message bubble to the thread.
9. **AC-26F-09** Compose panel floats above the keyboard; the keyboard-avoiding view adjusts layout correctly.
10. **AC-26F-10** A2P registration gate: if Ryan Realty's A2P 10DLC status is not `Fully Registered`, compose panel is replaced with a registration prompt and send is blocked.

---

## Screen 26-G: SMS Thread — Kebab Action Sheet Open **[OBSERVED: mob-42]**

### Purpose
The `···` kebab in the SMS thread header opens a floating popover action sheet with 4 options. This is NOT a full-screen bottom sheet — it is a floating card anchored below the `···` button.

### Action Sheet Anatomy

- **Position:** floating popover; top-right anchor; approximately x 165–385pt, y 108–340pt
- **Style:** white card `bg-card`; `border-radius: 14pt`; `box-shadow: rgba(0,0,0,0.12) 0 4px 16px`; width ~220pt
- **Rows:** 4, separated by 1pt `border-border` `#E5E7EB` hairline dividers
- **Row height:** ~54pt each
- **Row padding:** 16pt left, 16pt right

| Row | Icon (right-aligned) | Label | Text color | Icon color |
|---|---|---|---|---|
| 1 | Phone handset glyph 20pt | **Call** | `text-foreground` `#111827` 17pt | `text-foreground` |
| 2 | Envelope glyph 20pt | **Email** | `text-foreground` 17pt | `text-foreground` |
| 3 | Chat bubble + `+` glyph 20pt | **Start a group message** | `text-foreground` 17pt | `text-foreground` |
| 4 | Phone handset glyph 20pt (red) | **Block (786) 580-8921** | `text-destructive` `#E53E3E` 17pt | `text-destructive` |

Row 4 renders the contact's actual phone number verbatim (from `contact.primaryPhone`) to confirm which number is being blocked. It uses `text-destructive` for both text and icon — the only row with a destructive styling treatment.

**Tap-to-dismiss:** clicking outside the popover closes it without action.

### Action Behaviors

| Row | Action |
|---|---|
| Call | Dismiss sheet → `initiateCall(contact.id)` via Twilio outbound call |
| Email | Dismiss sheet → navigate to email compose for this contact |
| Start a group message | Dismiss sheet → open group SMS composer with this contact pre-added |
| Block (phone) | Dismiss sheet → show confirmation `<AlertDialog>`: "Block this number? They won't be able to reach you via text." → confirm → `PATCH /crm/people/{id} { phone_blocked: true }` |

**Assign Conversation** is reachable via swipe-right on the thread row in the list, NOT from this kebab (confirmed by FUB docs §6 iPhone steps: swipe right = assign). The kebab in-thread covers call, email, group, and block.

### Component Tree

```tsx
{/* Layered over the SMS thread view */}
{kebabOpen && (
  <>
    {/* Tap-to-dismiss overlay */}
    <div
      className="fixed inset-0 z-40"
      onClick={closeKebab}
    />

    {/* Floating action sheet */}
    <div
      className="fixed z-50 bg-card rounded-[14px] shadow-lg overflow-hidden"
      style={{
        top: '108px',   // below header
        right: '16px',
        width: '220px',
      }}
    >
      <ActionSheetRow
        label="Call"
        icon={<PhoneIcon size={20} />}
        onPress={() => { closeKebab(); initiateCall(); }}
      />
      <Separator />
      <ActionSheetRow
        label="Email"
        icon={<EnvelopeIcon size={20} />}
        onPress={() => { closeKebab(); openEmailCompose(); }}
      />
      <Separator />
      <ActionSheetRow
        label="Start a group message"
        icon={<ChatPlusIcon size={20} />}
        onPress={() => { closeKebab(); openGroupSMSComposer(); }}
      />
      <Separator />
      <ActionSheetRow
        label={`Block ${contact.primaryPhoneFormatted}`}
        icon={<PhoneIcon size={20} className="text-destructive" />}
        className="text-destructive"
        onPress={() => { closeKebab(); openBlockConfirmation(); }}
      />
    </div>
  </>
)}
```

### Acceptance Criteria — 26-G

1. **AC-26G-01** Kebab tap opens a floating popover card (NOT a full-screen bottom sheet) anchored top-right below the header.
2. **AC-26G-02** Action sheet contains exactly 4 rows: Call, Email, Start a group message, Block (with phone number).
3. **AC-26G-03** Block row renders in `text-destructive` for both text and icon.
4. **AC-26G-04** Block row label includes the contact's actual phone number verbatim (e.g., `"Block (786) 580-8921"`).
5. **AC-26G-05** Tapping outside the card dismisses it without action.
6. **AC-26G-06** Tapping Block shows a confirmation alert before executing.
7. **AC-26G-07** The AI pill strip and compose bar remain visible behind/below the action sheet.
8. **AC-26G-08** Rows are separated by 1pt `border-border` hairline dividers.

---

## Screen 26-H: SMS Group Thread (2+ Recipients) **[OBSERVED: mob-49]**

### Purpose
SMS conversation thread shared with 2 or more contacts simultaneously. Shows all messages as teal bubbles regardless of direction (FUB's group thread rendering — confirmed by mob-49 observation where all visible messages are broker-sent and render identically).

### Screen Regions (390 × 844 pt)

| Region | y-band (pt) | Height | Background |
|---|---|---|---|
| Safe area / status bar | 0–54 | 54 | Over dark teal header |
| Nav / header bar | 54–108 | 54 | `bg-primary` `#102742` (FUB: `#0d6b78` dark teal) |
| Scrollable message thread | 108–750 | 642 | `bg-muted` `#f2f2f7` light gray |
| Compose bar | 750–800 | 50 | `bg-background` white, 0.5pt top border `border-border` |
| Home indicator | 800–844 | 44 | `bg-background` white |

### Nav / Header Bar (exact — Group Thread Variant)

Two-line center cluster:

| Element | Detail |
|---|---|
| Back chevron `‹` | White, 24pt |
| Group avatar | 40pt circle; `bg-primary/60` (FUB: `#1a8f9b` mid-teal); white group initials `"M YT"` (first letter of each participant name) |
| Title line 1 | `"Mary, Yahson"` — Geist 700 17pt white + `›` chevron 14pt white; tappable → group contact detail |
| Title line 2 | `"2 people"` — Geist 400 13pt white muted; subtitle below name |
| Kebab `···` | White horizontal ellipsis 24pt (right side) |

FUB group thread kebab options **[INFERRED — basis: mob-42 individual SMS + FUB docs group texting]**:
- Call (individual participants listed)
- Email (individual participants)
- Add Note
- View Contacts
- Archive/Close thread

**Key difference from 1:1 thread header:** No phone icon (calls to a group don't make sense as a top-level shortcut); group sub-title `"N people"` replaces the single contact name's direct-link behavior.

### Message Thread Content

Background: `bg-muted` `#f2f2f7` (iOS system light gray).

**Message bubbles (all left-aligned in FUB's group thread rendering):**

```
[bubble bg: bg-primary #102742, FUB: #1a8f9b teal]
[text: text-primary-foreground white, 15pt, line-height 22pt]
[rounded-[18px], mx 12pt, mb 4pt]
```

Both outgoing (broker-sent) and incoming (contact replies) render in the same bubble style in FUB's group thread view. For in-house rebuild, maintain FUB's convention: use a single bubble color for group threads (navy `#102742` with white text), rather than iOS iMessage-style split alignment.

**Date separator:**

```tsx
<div className="text-center text-muted-foreground text-[12px] py-4">
  Jun 10, 2026, 10:13 AM
</div>
```

Centered gray text, 12pt, Geist 400 `text-muted-foreground` `#8e8e93`. Rendered between message groups when calendar date changes.

**URL hyperlinks within bubbles:**

URLs in message bodies render as underlined white text (`text-primary-foreground underline`). Tapping opens in-app browser (`window.open(url)` or `<a target="_blank">`).

### Verbatim Messages Observed (mob-49)

**Message 1 (before first separator):**
> "We quoted the unit that is most comparable to yours, and that is the quote we received. I will let you talk to Donnie about the next steps and whether you want to move forward.
> We need to decide on this soon so we can get it installed before the appraisal. I let them know you're closing on the 23rd and asked if they could explore options for you paying at close of escrow. I'll let you work through those with Mountain View. Let me know if you have any questions. I gave Donnie at Mountain View your phone number, both Jason and you. He will call, and you can answer any questions you have."

**Message 2 (before first separator):**
> "Please let me know if you have any questions. I'm here to take a phone call now if you would like."

**Date separator:** `"Jun 10, 2026, 10:13 AM"`

**Message 3 (after first separator):**
> "Please use this link to pay the painter so we can get your home painted prior to the appraisal.
> https://connect.intuit.com/t/scs-v1-..." (URL renders as tappable white underline)

**Date separator:** `"Jun 12, 2026, 10:00 AM"`

**Message 4 (after second separator):**
> "Good morning Mary and Yahson. Please let me know when you have paid the painter and I will call him to make sure he gets started ASAP. Thank you!"

### Compose Bar (Group Thread)

Same structure as 26-F Row 2 (attachment + input + send), WITHOUT the AI pill strip row (AI suggestions not shown in mob-49 group thread). The compose bar sits directly at the bottom.

| Element | Detail |
|---|---|
| Attachment `+` | 36pt circle, `bg-muted` `#8e8e93`, white `+`; tap → attachment/template picker |
| Text input | Flex-1, `bg-muted` `#f2f2f7`, `rounded-[20px]`; placeholder `"Text message · SMS"` 15pt muted; multiline |
| Send button | 40pt circle, `bg-primary` `#102742` (FUB: `#1a8f9b`); white `↑` arrow; disabled when empty |

**Note on send:** Group SMS sends to all participants via Twilio. Inbound replies from any participant appear in the same thread.

### Component Tree

```tsx
<MobileShell>
  <StatusBar style="light" />

  <TopBar bg="bg-primary" height={54}>
    <BackButton icon="chevron-left" color="white" onPress={navigation.goBack} />
    <Pressable
      onPress={() => navigate(`/crm/conversations/${thread.id}/participants`)}
      className="flex-1 flex-col items-center justify-center"
    >
      <GroupAvatar
        initials={groupInitials}  // "M YT"
        size={40}
        bg="bg-primary/60"
      />
      <div className="flex flex-row items-center gap-1">
        <span className="text-white text-[17px] font-bold">{thread.participantNames}</span>
        <ChevronRight size={14} color="white" />
      </div>
      <span className="text-white/60 text-[13px]">{thread.participantCount} people</span>
    </Pressable>
    <IconButton icon="ellipsis-horizontal" color="white" size={24} onPress={openGroupKebab} />
  </TopBar>

  <ScrollView
    className="flex-1 bg-muted"
    ref={scrollRef}
    onContentSizeChange={scrollToBottom}
  >
    {messages.map((msg, i) => (
      <Fragment key={msg.id}>
        {showDateSeparator(msg, messages[i - 1]) && (
          <div className="text-center text-muted-foreground text-[12px] py-4">
            {formatFullDateTime(msg.sentAt)}
          </div>
        )}
        <MessageBubble
          body={msg.body}
          className="bg-primary text-primary-foreground rounded-[18px] mx-3 mb-1 px-4 py-2"
          style={{ fontSize: '15px', lineHeight: '22px' }}
          hasLinks={containsUrl(msg.body)}
        />
      </Fragment>
    ))}
  </ScrollView>

  <KeyboardAvoidingView behavior="padding">
    <div className="flex flex-row items-center gap-1.5 px-3 py-2 bg-background border-t border-border">
      <Button
        variant="ghost" size="icon"
        className="w-9 h-9 rounded-full bg-muted"
        onPress={openAttachmentPicker}>
        <Plus size={16} />
      </Button>
      <Textarea
        className="flex-1 bg-muted rounded-[20px] px-3.5 py-2 text-[15px] min-h-[40px]"
        placeholder="Text message · SMS"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button
        className={cn("w-10 h-10 rounded-full", draft.trim() ? "bg-primary" : "bg-muted opacity-40")}
        disabled={!draft.trim()}
        onPress={sendGroupSMS}
      >
        <ArrowUp size={16} className="text-primary-foreground" />
      </Button>
    </div>
  </KeyboardAvoidingView>
</MobileShell>
```

### Data Touched

- `crm_conversations` — `id`, `channel: 'sms'`, `is_group: true`, participant count
- `crm_messages` — `body`, `sent_at`, `direction`, `from_broker: bool`
- Twilio group SMS: `POST /twilio/send-sms { to: [phone1, phone2, ...], from: broker.twilio_number, body }`

### Acceptance Criteria — 26-H

1. **AC-26H-01** Group thread header shows group avatar (composed from participant initials), participant names comma-separated, and sub-title `"N people"`.
2. **AC-26H-02** Message bubbles use a single navy style for all messages (no iMessage-style split by direction).
3. **AC-26H-03** Date separators render between messages when the calendar date changes; format: `"Mon DD, YYYY, HH:MM AM/PM"`.
4. **AC-26H-04** URLs within message bodies render as tappable underlined text; tapping opens in-app browser.
5. **AC-26H-05** Compose bar shows attachment button, text input (placeholder `"Text message · SMS"`), and send button.
6. **AC-26H-06** Group SMS limit: blocked if adding a participant would exceed 10 total phone numbers (display error).
7. **AC-26H-07** Compose panel correctly adjusts above the keyboard on input focus.
8. **AC-26H-08** Long-press on a message bubble shows context menu: Copy, Forward, Delete.

---

## Screen 26-I: SMS Thread — Active (Messages Present) **[INFERRED — basis: mob-49 bubble rendering; mob-38 compose; desktop §5.3]**

This screen is the 1:1 equivalent of 26-H but for a single contact. All elements from 26-F apply, plus:

- **Outbound messages:** right-aligned bubbles, `bg-primary` navy, `text-primary-foreground` white
- **Inbound messages:** left-aligned bubbles, `bg-muted` `#f2f2f7`, `text-foreground` dark
- **Timestamp rows:** Geist 400 12pt `text-muted-foreground`, centered, rendered between messages when significant time has passed (> 1 hour gap)
- **Delivery status indicators** (below outbound bubbles):
  - `"Delivered"` — Geist 400 11pt `text-muted-foreground`
  - `"Read"` — same (if read receipts enabled)
  - `"Failed"` — `text-destructive`
  - `"Queued"` — `text-muted-foreground` (quiet hours; shown as `"Delivering at 8:00 AM"`)
  - `"Carrier filtered"` — orange badge `bg-orange-50 text-orange-600` with text: `"The contact's mobile provider filtered your text before it could be delivered."` No auto-retry.

---

## Screen 26-J: Compose New Message Sheet **[INFERRED — basis: FAB on mob-07/21; desktop §7]**

Opened by tapping the FAB on the inbox list. A `<Sheet side="bottom">` expanding to ~65% of screen height.

**Content:**
1. `<Input>` to search/select a contact from `crm_people`
2. Channel selector: Email | SMS (segmented control)
3. If SMS: compose bar identical to 26-F
4. If Email: subject field + rich-text body

---

## Screen 26-K: Filter Sheet **[INFERRED — basis: filter icon on mob-07/21/23/24; desktop §4.2]**

Opened by tapping the filter/sliders icon at the right of the sub-tab strip.

**Sheet content (bottom sheet):**

```
Filter conversations

[✓] Emails
[✓] Texts
[✓] Calls

[Apply]  [Reset]
```

Each checkbox uses `<Checkbox>` from `@/components/ui/checkbox`. Toggling updates the list in real time. Filter state persists during the session. When any filter is non-default, the filter icon shows a small `bg-primary` dot indicator.

---

## Screen 26-L: Inbox Scope Picker Sheet **[INFERRED — basis: "My Inbox ▾" on all inbox screens; desktop §3.2]**

Opened by tapping `"My Inbox ▾"` in the header. A `<Sheet side="bottom">` with list of options:

| Option | Detail |
|---|---|
| **My Inbox** (default) | Conversations assigned to or involving this broker |
| **Company** | Shared team inbox (if broker is a member) |
| + additional team inboxes (if configured) | Each named team inbox the broker belongs to |

Active scope shown with a checkmark. Selecting an option switches the entire inbox view to that scope and dismisses the sheet.

---

## Contact Context Link from Conversations

Every conversation view (26-E email detail, 26-F/26-G/26-H SMS thread) provides a path to the contact's full profile:

| Surface | Contact link |
|---|---|
| Email header | Tap contact name or avatar in the nav bar |
| SMS header | Tap `"Andy Christensen ›"` center cluster in the nav bar |
| Group SMS | Tap `"Mary, Yahson ›"` cluster in the nav bar |

All links navigate to `/crm/people/{contactId}` (the mobile contact profile screen, covered in §23–§25 sibling sections).

---

## Inbox Badge Count

The Inbox bottom-tab badge shows the total unread conversation count across the active scope (My Inbox) and all folders. Badge updates:
- **On mount:** fetch count from `GET /crm/conversations/unread-count?scope=me`
- **Real-time:** WebSocket `conversation:read` and `conversation:new` events decrement/increment the count
- **On thread open:** optimistic decrement by 1 if the thread was unread (auto-read-on-open behavior per desktop §12.1)
- **Badge style:** red circle `bg-destructive` `#FF3B30`, white text 10pt bold, 18pt diameter, anchored top-right of tab icon

---

## Cross-References

- **§08-inbox.md** (desktop) — data model (`crm_conversations`, `crm_messages`), compliance rules (A2P gate, quiet hours, opt-out enforcement), fold behavior, five-folder model, channel filter controls, presence indicator, @mention system
- **§23 (sibling mobile spec)** — Mobile People list (contact search for compose)
- **§24–§25 (sibling mobile specs)** — Contact profile detail (navigation target from conversation headers)
- **§27 (sibling mobile spec)** — Mobile Notifications (bell icon destination)
- **§20-mobile-apps-and-notifications.md** — Mobile push notification behavior

---

## Data Model Summary (Inbox-Relevant Tables)

| Table | Purpose | Key columns used by mobile inbox |
|---|---|---|
| `crm_conversations` | Thread record | `id`, `contact_id`, `scope`, `folder`, `channel`, `subject`, `unread_count`, `last_message_at`, `assigned_user_id` |
| `crm_messages` | Individual messages | `id`, `conversation_id`, `body`, `direction`, `channel`, `sent_at`, `status`, `error_code`, `attachments`, `recording_url`, `recording_duration_sec` |
| `crm_people` | Contact record | `id`, `first_name`, `last_name`, `photo_url`, `avatar_color`, `phone`, `email`, `phone_opt_out` |
| `crm_text_opt_outs` | SMS opt-out tracking | `phone_number`, `opted_out_at` |
| `crm_conversation_viewers` | Presence indicator | `conversation_id`, `user_id`, `last_seen_at` |
| `brokers` | Broker Twilio numbers | `twilio_number`, `forward_to_cell` |

---

## Compliance Gates (Mobile-Specific)

| Gate | Behavior |
|---|---|
| A2P 10DLC not `Fully Registered` | Replace SMS compose panel with registration prompt; block all outbound texts |
| Contact `phone_opt_out = true` | Disable send button; show `"This contact has opted out of text messages"` above compose |
| First-touch SMS (no prior thread) | Auto-append `"Reply STOP to unsubscribe"` or warn if absent; log compliance event |
| Quiet hours (9PM–8AM broker timezone) | Queue message; show `"Delivering at 8:00 AM"` status instead of "Sent"; do NOT show as sent (mobile bug to avoid) |
| Quiet hours auto-cancel | If any inbound contact occurs before 8AM, cancel queued message and remove the queued indicator |
| SMS > 320 chars | Show character counter in red; warning `"Long messages may be split by carriers"` |
| Group SMS > 10 recipients | Block add; show `"Group texts support up to 10 participants"` |
| TCPA consent window expired | Show warning banner in compose panel: `"Consent window may have expired. Verify prior to sending."` |

---

## Sources

| Source | File | Status |
|---|---|---|
| My Inbox — Inbox sub-tab (default) | mob-07, mob-21 | **OBSERVED** |
| My Inbox — Sent sub-tab | mob-23 | **OBSERVED** |
| My Inbox — Closed sub-tab | mob-24 | **OBSERVED** |
| Email thread detail | mob-22 | **OBSERVED** |
| SMS thread — empty state | mob-38 | **OBSERVED** |
| SMS thread — kebab action sheet | mob-42 | **OBSERVED** |
| SMS group thread (2 contacts) | mob-49 | **OBSERVED** |
| My Inbox — Assigned sub-tab | — | **INFERRED** (basis: tab visible in mob-07/21; empty state from desktop §4.3) |
| SMS thread — active with bubbles (1:1) | — | **INFERRED** (basis: mob-49 bubble rendering + desktop §5.3) |
| Compose new message sheet (FAB) | — | **INFERRED** (basis: FAB on mob-07/21; desktop §7) |
| Filter sheet | — | **INFERRED** (basis: filter icon on all inbox screens; desktop §4.2 confirmed channel filters) |
| Inbox scope picker sheet | — | **INFERRED** (basis: "My Inbox ▾" chevron on all screens; desktop §3.2 dual inbox) |
| Five-folder model, four mobile sub-tabs | fub-docs/inbox.md §2, §22 | documentation |
| Swipe gestures (close, assign, reopen) | fub-docs/inbox.md §5, §6 | documentation |
| A2P gate, quiet hours, opt-out rules | fub-docs/texting.md §2, §3; fub-docs/inbox.md §13.3; desktop §15.1–15.7 | documentation |
| Email body rendering, Send & Close | fub-docs/emailing.md; desktop §7, §13.2 | documentation |
| Presence indicator | fub-docs/inbox.md §9; desktop §12.4 | documentation |
| Group SMS limits | fub-docs/texting.md; desktop §13.3 | documentation |
