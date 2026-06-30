<!-- Mobile per-screen appendix. Original: IMG_5828.PNG | id: mob-08 | tiles: mob-tiles/mob-08_{full,t,m,b}.png -->

# mob-08 — fub-ios — Calendar (Monthly Grid + Task List)

## Identity

- **app_source:** fub-ios (Follow Up Boss native iPhone app)
- **module:** Calendar / Appointments
- **screen:** Monthly calendar view for June, with a chronologically grouped task/reminder list below the grid showing upcoming items across multiple dates
- **how to reach:** Tap the "Calendar" tab (3rd of 5) in the bottom tab bar from any FUB screen
- **iOS status bar:** 4:33 · 4-bar cellular signal · WiFi · Battery 100 (full, pill outline with "100" label) — white text on dark background (status bar inherits the dark calendar header)
- **URL bar:** N/A — native iOS app, no Safari chrome

---

## Screen regions (y-bands in pt on 390×844pt logical screen)

| Region | y-band (pt) | Height (pt) | Background |
|---|---|---|---|
| iOS status bar | 0–47 | 47 | Inherits dark header (~#364859) |
| Nav / header bar | 47–103 | 56 | Dark slate ~#364859 |
| Monthly calendar grid | 103–440 | 337 | Dark slate ~#364859 |
| Scrollable task list | 440–762 | 322 | White (#FFFFFF) / section headers light gray ~#EEF0F3 |
| FAB zone | 700–762 | 62 | Transparent over list |
| Bottom tab bar | 762–844 | 82 | White (#FFFFFF), top 1pt border ~#E0E0E0 |

---

## Nav / header bar (exact)

- **Left:** Circular user avatar photo (~36pt diameter, circular crop) — shows Matt Ryan's headshot (bald man, light blue shirt). Tappable → opens account/profile settings.
- **Center:** Text "June" (white, ~20pt semibold) + up-caret "^" (~14pt white, indicating the calendar is expanded/full-month; tapping collapses to week view or navigates month). Tappable → toggle between month and week view, or open month picker.
- **Right (left-to-right):** Bell icon (notification/alert, outlined bell glyph, white, ~22pt) — no badge visible. Then search/magnifying-glass icon (outlined, white, ~22pt) — tapping opens a search overlay.

---

## Bottom tab bar (exact) — CRITICAL

Tabs left → right, all labels in sentence case below icon:

| Position | Icon glyph | Label | Badge | State |
|---|---|---|---|---|
| 1 | Inbox tray (document sliding into tray, outlined) | Inbox | Red pill "30" (white text, red ~#E53935, ~18pt pill) | Inactive (gray ~#9E9E9E) |
| 2 | Line-chart / trend (3-node zigzag line, outlined) | Activity | None | Inactive (gray ~#9E9E9E) |
| 3 | Calendar grid (square with date-grid lines, filled/colored) | Calendar | None | **Active** (FUB teal-blue ~#29A8E0, icon filled) |
| 4 | Two-person silhouette (contacts group, outlined) | People | None | Inactive (gray ~#9E9E9E) |
| 5 | Price tag with dollar sign ($, outlined) | Deals | None | Inactive (gray ~#9E9E9E) |

**FAB:** Large circular button (~56pt diameter), positioned bottom-right at approximately x=334pt y=710pt (above tab bar, floats over content). Color: medium blue ~#4AAEE8 (slightly lighter than FUB teal). Icon: white "+" plus sign (~24pt, 2pt stroke). Tapping creates a new appointment or task.

---

## Content — every element, in order

### 1. Monthly calendar grid (dark background section, y 103–440)

**Day-of-week header row:**
- Labels: SUN · MON · TUE · WED · THU · FRI · SAT
- Style: All-caps, ~11pt, gray ~#8EAABF, evenly distributed across full width, ~20pt tall row

**Date cells (5 rows of 7):**
- Row 1: [empty] · 1 · 2 · 3 · 4 · 5 · 6
- Row 2: 7 · 8 · 9 · 10 · 11 · 12 · 13
- Row 3: 14 · 15 · 16 · 17 · 18 · 19 · 20
- Row 4: 21 · 22 · 23 · 24 · 25 · **26** · 27
- Row 5: 28 · 29 · 30 · [empty] · [empty] · [empty] · [empty]

**Date number styling:** white, ~22pt medium weight, centered in cell (~55pt wide × 52pt tall each)

**Event indicator dot:** small gray dot (~5pt) centered below date number. Visible on: 2, 3, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 21, 22, 23, 26, 30. (Dates without events have no dot.)

**Selected / today state — June 26:** Rounded rectangle highlight behind the "26" numeral (~44pt wide × 44pt tall, corner radius ~8pt, background ~#4A5A6A or slightly lighter than the grid bg, white text). This appears to be "today" or the selected/scrolled-to date.

**Tapping any date cell:** scrolls the task list below to that date's section and highlights the tapped date.

---

### 2. Scrollable task list (white background, y 440–762)

The list is a continuous scroll; section headers are sticky or at minimum visually distinct. Items are grouped by date.

---

#### Section header — "Monday, June 22nd"

- Full-width row, height ~34pt
- Background: light gray ~#EEF0F3
- Text: "Monday, June 22nd" — dark gray ~#37474F, ~14pt semibold, left-padded ~16pt
- No interactive elements

---

#### Task row — June 22nd, 6:27am (1 row)

**Anatomy (left → right):**
1. **Checkbox** (~18pt square, orange ~#F5A623 border, ~2pt stroke, rounded-corner ~3pt, unchecked/empty) — left margin ~12pt. Tapping marks task complete.
2. **Activity type icon** — teal/green filled phone-handset glyph (~20pt). Indicates a "phone call" type task.
3. **Primary text** — "Lead returned to website. Follow up n..." — dark gray ~#263238, ~15pt regular, truncated with ellipsis at right edge before the badge. Occupies the main horizontal flex space.
4. **Time** — below primary text: "6:27am" — gray ~#90A4AE, ~13pt regular
5. **Assignee badge** — right edge (~16pt margin from right): circle ~32pt diameter, medium purple/indigo fill ~#5C6BBF, white initials "MR" (~13pt semibold). Indicates assigned to Matt Ryan.

**Row height:** ~60pt. Divider: 1pt hairline ~#E8EAED at bottom, full width (no inset).
**Tapping the row body:** navigates to the task detail / lead record.

---

#### Section header — "Tuesday, June 23rd"

Same style as above.

---

#### Task rows — June 23rd (3 rows)

All three rows are anatomically identical to the June 22nd row:

**Row 1:**
- Checkbox (orange, unchecked)
- Phone handset icon (teal/green)
- Primary: "Lead returned to website. Follow up n..."
- Time: "12:12pm"
- Assignee: "MR" (purple circle)

**Row 2:**
- Checkbox (orange, unchecked)
- Phone handset icon (teal/green)
- Primary: "Lead returned to website. Follow up n..."
- Time: "3:30pm"
- Assignee: "MR" (purple circle)

**Row 3:**
- Checkbox (orange, unchecked)
- Phone handset icon (teal/green)
- Primary: "Lead returned to website. Follow up n..."
- Time: "8:26pm"
- Assignee: "MR" (purple circle)

Dividers between rows: 1pt hairline ~#E8EAED.

---

#### Section header — "Tuesday, June 30th"

Same style.

---

#### Reminder / event row — June 30th (1 row)

This row is a different type from the phone-task rows — it represents a calendar reminder, not an assigned call task:

1. **No checkbox** on left
2. **Status dot** — filled green circle ~10pt (~#4CAF50 or ~#43A047), left-aligned ~16pt from left edge
3. **Primary text** — "Ryan Realty RBN License Renewal Due" — dark gray ~#263238, ~15pt regular, not truncated (fits on one line)
4. **No time sub-label**
5. **No assignee badge**

**Row height:** ~50pt. Divider: 1pt hairline below.

---

#### Below the last visible row

Empty white space before the FAB and tab bar. No "load more" indicator visible; list may continue scrolling upward to earlier dates.

---

## Colors, type & iconography

| Element | Value |
|---|---|
| Calendar header / nav bar bg | Dark slate ~#364859 |
| Calendar grid bg | Same dark slate ~#364859 |
| Date numbers (normal) | White #FFFFFF, ~22pt medium |
| Day-of-week labels | Gray ~#8EAABF, ~11pt, all-caps |
| Event dots | Gray ~#8EAABF, ~5pt circle |
| Selected date highlight | Lighter rounded rect ~#4A5A6A, same text |
| Nav title "June ^" | White #FFFFFF, ~20pt semibold |
| Nav icons (bell, search) | White #FFFFFF, outlined glyphs ~22pt |
| User avatar | Circular photo, ~36pt |
| Task list bg | White #FFFFFF |
| Section header bg | Light gray ~#EEF0F3 |
| Section header text | Dark gray ~#37474F, ~14pt semibold |
| Task primary text | Dark gray ~#263238, ~15pt regular |
| Task time text | Medium gray ~#90A4AE, ~13pt regular |
| Checkbox border | Orange ~#F5A623, ~2pt stroke, ~3pt corner radius |
| Phone handset icon | Teal/green ~#2AB57D (filled) |
| Reminder dot | Green ~#4CAF50 (filled circle) |
| Assignee badge fill | Purple/indigo ~#5C6BBF |
| Assignee badge text | White #FFFFFF, ~13pt semibold |
| Row dividers | Hairline ~#E8EAED |
| Active tab color | FUB teal-blue ~#29A8E0 |
| Inactive tab color | Gray ~#9E9E9E |
| Tab bar bg | White #FFFFFF |
| Inbox badge fill | Red ~#E53935 |
| FAB color | Medium blue ~#4AAEE8 |
| FAB icon | White "+" ~24pt |

**Font impressions:** System font (San Francisco / SF Pro); FUB uses SF Pro throughout. No custom display font. Weights used: regular (task text, time), semibold (section headers, nav title, badge initials), medium (date numbers).

**Accent color:** FUB's characteristic teal-blue ~#29A8E0 — used for active tab icon + label only. NOT the navy #102742 of the in-house app.

---

## Interactions & gestures [INFERRED]

- **Tap date cell in grid:** Selects that date (rounded-rect highlight), scrolls task list to show that date's section at top. [INFERRED]
- **Tap "June ^" / month title:** Collapses full-month grid to a week-strip, or opens a month/year picker sheet. The "^" caret suggests the grid is currently expanded. [INFERRED]
- **Swipe left/right on calendar grid:** Navigates to previous/next month. [INFERRED]
- **Tap checkbox on task row:** Marks task complete; row animates out or shows strikethrough. [INFERRED]
- **Tap task row body:** Pushes detail view for the associated lead/person, or opens the task edit sheet. [INFERRED]
- **Tap "MR" assignee badge:** Possibly opens reassign picker. [INFERRED]
- **Pull-to-refresh on task list:** Refreshes tasks from server. [INFERRED]
- **Swipe left on task row:** Reveals quick-action buttons (Delete, Reschedule, or Complete). [INFERRED]
- **Tap FAB (+):** Presents bottom sheet to create new appointment or task — type, lead, date/time, assignee fields. [INFERRED]
- **Tap bell icon:** Opens notifications panel. [INFERRED]
- **Tap search icon:** Opens full-screen search overlay. [INFERRED]
- **Tap avatar:** Opens profile/account settings drawer. [INFERRED]
- **Tap bottom tab items:** Switches to that module (Inbox, Activity, People, Deals). [INFERRED]

---

## Build notes (component tree)

```
<MobileShell statusBarStyle="light" statusBarBg="#364859">

  <CalendarTopBar>
    <!-- Left -->
    <UserAvatarButton
      src={user.avatarUrl}
      size={36}
      shape="circle"
      onPress={openProfile}
    />
    <!-- Center -->
    <MonthTitleButton onPress={toggleCalendarMode}>
      <Text style={styles.monthTitle}>June</Text>
      <ChevronUpIcon size={14} color="#FFFFFF" />
    </MonthTitleButton>
    <!-- Right -->
    <NotificationBellButton onPress={openNotifications} />  {/* no badge visible */}
    <SearchButton onPress={openSearch} />
  </CalendarTopBar>

  {/* Dark-bg calendar grid — full month */}
  <MonthCalendarGrid
    month={6}
    year={2026}
    selectedDate={26}          {/* today or tapped date */}
    eventDates={[2,3,5,8,9,10,11,12,15,16,17,18,19,21,22,23,26,30]}
    onDatePress={(day) => scrollListToDate(day)}
    bg="#364859"
    dayLabelColor="#8EAABF"
    dateNumberColor="#FFFFFF"
    dotColor="#8EAABF"
    selectedBg="#4A5A6A"
    selectedRadius={8}
  />

  {/* Scrollable task list — white bg */}
  <ScrollView style={{ flex: 1, bg: '#FFFFFF' }}>

    {/* ---- Group 1 ---- */}
    <DateSectionHeader label="Monday, June 22nd" />

    <CalendarTaskRow
      checkbox={{ checked: false, color: '#F5A623' }}
      activityIcon={<PhoneHandsetIcon color="#2AB57D" size={20} />}
      primaryText="Lead returned to website. Follow up n..."
      time="6:27am"
      assigneeBadge={{ initials: 'MR', bg: '#5C6BBF' }}
      onPress={openTaskDetail}
      onCheckboxPress={markComplete}
    />

    {/* ---- Group 2 ---- */}
    <DateSectionHeader label="Tuesday, June 23rd" />

    <CalendarTaskRow
      checkbox={{ checked: false, color: '#F5A623' }}
      activityIcon={<PhoneHandsetIcon color="#2AB57D" size={20} />}
      primaryText="Lead returned to website. Follow up n..."
      time="12:12pm"
      assigneeBadge={{ initials: 'MR', bg: '#5C6BBF' }}
    />
    <CalendarTaskRow
      checkbox={{ checked: false, color: '#F5A623' }}
      activityIcon={<PhoneHandsetIcon color="#2AB57D" size={20} />}
      primaryText="Lead returned to website. Follow up n..."
      time="3:30pm"
      assigneeBadge={{ initials: 'MR', bg: '#5C6BBF' }}
    />
    <CalendarTaskRow
      checkbox={{ checked: false, color: '#F5A623' }}
      activityIcon={<PhoneHandsetIcon color="#2AB57D" size={20} />}
      primaryText="Lead returned to website. Follow up n..."
      time="8:26pm"
      assigneeBadge={{ initials: 'MR', bg: '#5C6BBF' }}
    />

    {/* ---- Group 3 ---- */}
    <DateSectionHeader label="Tuesday, June 30th" />

    <CalendarReminderRow
      dot={{ color: '#4CAF50', size: 10 }}
      primaryText="Ryan Realty RBN License Renewal Due"
      onPress={openReminderDetail}
    />

  </ScrollView>

  {/* Floating action button */}
  <FAB
    icon="plus"
    color="#4AAEE8"
    size={56}
    position={{ bottom: 90, right: 16 }}   {/* above tab bar */}
    onPress={openCreateEventSheet}
  />

  <BottomTabBar
    tabs={[
      { key: 'inbox',    label: 'Inbox',    icon: InboxTrayIcon,    badge: 30 },
      { key: 'activity', label: 'Activity', icon: TrendLineIcon,    badge: null },
      { key: 'calendar', label: 'Calendar', icon: CalendarGridIcon, badge: null, active: true },
      { key: 'people',   label: 'People',   icon: PeopleGroupIcon,  badge: null },
      { key: 'deals',    label: 'Deals',    icon: PriceTagDollarIcon, badge: null },
    ]}
    activeColor="#29A8E0"
    inactiveColor="#9E9E9E"
    badgeColor="#E53935"
    bg="#FFFFFF"
  />

</MobileShell>
```

### Key component specs

**`MonthCalendarGrid`**
- 7-column grid, each cell ~55×52pt
- Dark background (#364859) spans the full header zone from nav bar through grid
- Day labels row: all-caps, 11pt, gray #8EAABF, ~20pt tall
- Date cell: number centered; small dot (5pt circle) below if `eventDates` includes that day
- Selected cell: rounded-rect highlight (44×44pt, r=8, bg #4A5A6A) behind number
- No border/separator between cells

**`DateSectionHeader`**
- Full-width, height 34pt, bg #EEF0F3
- Text: 14pt semibold, color #37474F, left padding 16pt
- Not sticky in the original but [INFERRED] likely sticky on scroll

**`CalendarTaskRow`**
- Height 60pt, bg white
- Left padding 12pt: orange checkbox (18×18pt, r=3, 2pt stroke, #F5A623) — 8pt gap — activity icon (20pt) — 10pt gap — text column
- Text column flex:1: primary text 15pt regular #263238, truncated; time 13pt regular #90A4AE below
- Right: assignee badge circle 32pt, bg #5C6BBF, initials 13pt semibold white; right margin 16pt
- Bottom divider: 1pt #E8EAED

**`CalendarReminderRow`**
- Height 50pt, bg white
- Left padding 16pt: colored dot (10pt circle #4CAF50) — 12pt gap — primary text 15pt regular #263238
- No checkbox, no time sub-label, no assignee badge
- Bottom divider: 1pt #E8EAED

**`FAB`**
- 56pt circle, bg #4AAEE8, shadow (0 4 8 rgba(0,0,0,0.2))
- Plus icon white, 2pt stroke, centered
- Position: fixed bottom-right, 16pt from right edge, 82+8=90pt from bottom (clears tab bar)

### Data bindings

| Component | Data source |
|---|---|
| MonthCalendarGrid.eventDates | `GET /api/v1/appointments?startDate=2026-06-01&endDate=2026-06-30` — extract unique dates with entries |
| Task rows (primary text, time) | `GET /api/v1/tasks?date=2026-06-22` etc — `task.description`, `task.dueTime` |
| Task rows (activityIcon) | `task.type` → icon map (phone call → handset icon) |
| Assignee badge | `task.assignedTo.initials`, `task.assignedTo.color` |
| Reminder row (text) | `event.title` from calendar events (non-task entries, e.g. reminders, due dates) |
| Reminder row (dot color) | `event.category` → color map (green = business/license reminder) |
| Nav avatar | `currentUser.avatarUrl` |
| Inbox badge "30" | `GET /api/v1/inbox/unread-count` |
