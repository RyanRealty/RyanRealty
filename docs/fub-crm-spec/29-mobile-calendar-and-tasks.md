# Mobile — Calendar & Tasks

The Calendar & Tasks module is the daily workflow surface for brokers in the field. The Calendar screen presents a full-month grid with event-dot density indicators, a date-selectable task/appointment list below, and a FAB for creating new items. The Tasks surface (a dedicated tab-based list) organizes follow-up actions into Today / Overdue / Future buckets with one-tap completion. Contact-level access to both surfaces is exposed from the Person detail screen via a "Calendar" sub-tab, which shows an empty state or populated appointment/task rows scoped to that specific contact. The in-house build preserves FUB's information architecture exactly while applying the Ryan Realty design system (navy `#102742` / cream `#faf8f4`, Geist + Amboqia, shadcn/ui tokens).

---

## Design Token Mapping (FUB iOS → Ryan Realty)

| Element | FUB iOS hex | Ryan Realty token | Rationale |
|---|---|---|---|
| Calendar header / nav bg | `~#364859` dark slate | `bg-primary` (`#102742`) | Navy is the RR primary surface for headers |
| Calendar grid bg | `~#364859` | `bg-primary` | Same header zone extends through grid |
| Active tab icon + underline | `~#29A8E0` FUB teal | `text-accent-foreground` / `bg-accent` | RR accent replaces FUB teal for focus/active |
| Task list background | `#FFFFFF` | `bg-card` | White card background per design system |
| Section header background | `~#EEF0F3` | `bg-muted` | Shadcn muted token |
| Section header text | `~#37474F` | `text-foreground` | Standard foreground |
| Task primary text | `~#263238` | `text-foreground` | Standard foreground |
| Task time / sub-label | `~#90A4AE` | `text-muted-foreground` | Muted secondary text |
| Day-of-week labels | `~#8EAABF` | `text-muted-foreground` on navy | Muted on dark bg |
| Date numbers (normal) | `#FFFFFF` | `#FFFFFF` | White on navy |
| Event dots | `~#8EAABF` | `rgba(255,255,255,0.55)` | Subtle white dot on navy bg |
| Selected date highlight | `~#4A5A6A` | `rgba(250,248,244,0.18)` cream tint | Cream tint overlay on navy |
| Checkbox border (unchecked) | `~#F5A623` orange | `bg-warning` / `hsl(var(--warning))` | Warning token for due-task urgency |
| Activity icon — Call | `~#2AB57D` teal-green | `bg-success` / `hsl(var(--success))` | Success token = "go / call" |
| Activity icon — Follow Up | flag color | `text-muted-foreground` | Subdued for generic type |
| Assignee badge fill | `~#5C6BBF` purple-indigo | Per-user `--user-color` CSS var | Each broker gets a deterministic color |
| Assignee badge text | `#FFFFFF` | `#FFFFFF` | White initials |
| Reminder/all-day dot | `~#4CAF50` green | `bg-success` | Success = confirmed event |
| Row dividers | `~#E8EAED` | `border-border` | Design system border token |
| FAB fill | `~#4AAEE8` medium blue | `bg-primary` (`#102742`) | RR primary for FAB |
| FAB icon | `#FFFFFF` | `#FFFFFF` | |
| Inactive tab icon/label | `~#9E9E9E` | `text-muted-foreground` | |
| Tab bar background | `#FFFFFF` | `bg-card` | |
| Badge fill (inbox) | `~#E53935` red | `bg-destructive` | |
| Contact detail header bg | `~#435a6b` slate | `bg-primary` (`#102742`) | |
| Content area bg (contact detail) | `~#edf0f5` light blue-gray | `bg-muted` | Shadcn muted |
| Add-action row icon + text | `~#5b8ec4` accent blue | `text-primary` / `bg-primary` | Navy in RR |
| Empty state icon | `~#9aabb8` | `text-muted-foreground` | |
| Empty state primary text | `~#6b7d8e` | `text-muted-foreground` | |
| Empty state secondary text | `~#8a9baa` | `text-muted-foreground` opacity 0.75 | |

---

## Broker initials color palette (deterministic per user)

Map each broker to a CSS custom property used for avatar / assignee badges:

```css
:root {
  --user-color-matt:     #102742; /* navy — primary broker */
  --user-color-paul:     #5C6BBF; /* indigo — matches FUB observed */
  --user-color-rebecca:  #2AB57D; /* teal-green */
}
```

Derive from `broker.slug` at render time; fallback to `#5C6BBF`.

---

## Logical screen coordinate reference

All measurements on a **390 × 844 pt** logical screen (iPhone 14 / 15 standard). 1 pt ≈ 2 px at 2x display. Web implementation uses CSS `px` = pt equivalents since viewport `<meta name="viewport" content="width=device-width, initial-scale=1">` maps CSS px to device-independent pt.

---

## Screen A — Calendar Main (Monthly Grid + Task List)

**[OBSERVED — mob-08]**

### A.1 How to reach

Bottom tab bar → "Calendar" (3rd tab). Route: `/crm/mobile/calendar`.

### A.2 Screen regions

| Region | y-band (pt) | Height (pt) | Background token |
|---|---|---|---|
| iOS/browser status bar | 0–47 | 47 | Inherits `bg-primary` |
| Nav / header bar | 47–103 | 56 | `bg-primary` `#102742` |
| Monthly calendar grid | 103–440 | 337 | `bg-primary` `#102742` |
| Scrollable task list | 440–762 | 322 | `bg-card` `#FFFFFF` |
| FAB zone | 700–762 | 62 | Transparent overlay |
| Bottom tab bar | 762–844 | 82 | `bg-card` `#FFFFFF`, top 1pt `border-border` |

### A.3 Nav / header bar — exact elements

| Element | Position | Size | Style | Interaction |
|---|---|---|---|---|
| User avatar photo | Left, x≈12–48, y≈65 (center) | 36 pt circle | Circular crop, `rounded-full` | → account/profile settings |
| Month title "June" | Center | 20pt, `font-semibold`, `#FFFFFF` | SF Pro / Geist 600 | Toggle month/week view |
| Caret "^" (expand indicator) | Right of title, 6pt gap | 14pt, `#FFFFFF` | ChevronUp icon | Same as title tap |
| Bell icon | Right zone, x≈320 | 22pt outlined | `#FFFFFF` | → notifications panel |
| Search icon | Right zone, x≈356 | 22pt outlined | `#FFFFFF` | → full-screen search |

Title + caret form a single tappable `<MonthTitleButton>`. The "^" indicates current expanded (full-month) state. Tapping collapses to week strip or opens a month/year picker sheet.

### A.4 Monthly calendar grid — exact spec

**Day-of-week header row** (y 103–123, height 20 pt):
- Labels: `SUN · MON · TUE · WED · THU · FRI · SAT`
- Style: ALL-CAPS, 11pt, `text-muted-foreground` on navy bg = `rgba(255,255,255,0.55)`
- Equal column width: 390 ÷ 7 = ~55.7 pt each

**Date cells** — 5 rows × 7 columns, each cell ~55.7 × 52 pt:

```
Row 1:  [empty] ·  1  ·  2  ·  3  ·  4  ·  5  ·  6
Row 2:    7    ·  8  ·  9  · 10  · 11  · 12  · 13
Row 3:   14    · 15  · 16  · 17  · 18  · 19  · 20
Row 4:   21    · 22  · 23  · 24  · 25  ·[26] · 27
Row 5:   28    · 29  · 30  ·[  ] ·[  ] ·[  ] ·[  ]
```

**Date number styling:**
- Normal: `#FFFFFF`, 22pt, `font-medium` (Geist 500), centered in cell
- Empty cells (row 1 col 1, row 5 cols 4–7): no render

**Event indicator dot:**
- Size: 5 pt circle
- Position: centered below date number, ~4 pt gap
- Color: `rgba(255,255,255,0.55)` (muted white dot on navy)
- Appears on dates: 2, 3, 5, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 21, 22, 23, 26, 30
- Absent on dates with no scheduled events

**Selected / today cell (June 26 in observed screenshot):**
- Rounded rect behind the numeral: 44 × 44 pt, `border-radius: 8pt`
- Background: `rgba(250,248,244,0.18)` (cream tint overlay on navy = subtle selection ring)
- Date text: `#FFFFFF` (unchanged)
- In production: highlight `today` automatically; tapping any date sets `selectedDate`

**Gestures on grid:**
- **Tap date cell:** Sets `selectedDate`, scrolls task list to that date's section header
- **Swipe left on grid:** Navigate to next month (July)
- **Swipe right on grid:** Navigate to previous month (May)
- **Tap month title / "^":** Toggles full-month ↔ week strip; or opens month/year picker sheet

### A.5 Scrollable task list — section-by-section exact spec

Background: `bg-card` (`#FFFFFF`). Begins at y=440pt.

#### Section header component spec

```
Height: 34pt
Background: bg-muted (~#EEF0F3 → hsl(var(--muted)))
Padding: 16pt left
Text: "{Day name}, {Month} {Ordinal day}"
  Font: 14pt, font-semibold, text-foreground (~#37474F → hsl(var(--foreground)))
Sticky: yes (position: sticky; top: 0) within the scroll container
```

**Observed section headers:**
1. `Monday, June 22nd`
2. `Tuesday, June 23rd`
3. `Tuesday, June 30th`

#### CalendarTaskRow component spec

Each task with an assignable checkbox follows this anatomy:

```
Height: 60pt
Background: bg-card (#FFFFFF)
Horizontal layout (left → right):
  ├─ Left padding: 12pt
  ├─ Checkbox: 18×18pt square, border-radius 3pt, stroke 2pt
  │   Unchecked: border-color = bg-warning (~#F5A623 → hsl(var(--warning)))
  │   Checked: bg-warning fill + white checkmark; then row animates out
  ├─ Gap: 8pt
  ├─ Activity icon: 20pt, glyph depends on task.type (see icon map A.6)
  ├─ Gap: 10pt
  ├─ Text column (flex: 1):
  │   ├─ Primary text: task.description, 15pt, font-normal, text-foreground
  │   │   Truncated with ellipsis at container right edge
  │   └─ Time sub-label: task.dueTime formatted "6:27am", 13pt, font-normal,
  │       text-muted-foreground, immediately below primary text
  └─ Right: assignee badge circle
      Size: 32pt diameter
      Background: var(--user-color-{broker.slug})
      Text: broker initials "MR", 13pt, font-semibold, #FFFFFF
      Right margin: 16pt
Bottom divider: 1pt solid border-border (#E8EAED → hsl(var(--border)))
```

**Observed CalendarTaskRows:**

| Section | Primary text (truncated) | Time | Badge |
|---|---|---|---|
| Monday, June 22nd | "Lead returned to website. Follow up n..." | 6:27am | MR |
| Tuesday, June 23rd | "Lead returned to website. Follow up n..." | 12:12pm | MR |
| Tuesday, June 23rd | "Lead returned to website. Follow up n..." | 3:30pm | MR |
| Tuesday, June 23rd | "Lead returned to website. Follow up n..." | 8:26pm | MR |

All rows: Call type → phone-handset icon, color `bg-success` (`~#2AB57D`).

#### CalendarReminderRow component spec

For calendar events/reminders (not assignable tasks — no checkbox):

```
Height: 50pt
Background: bg-card (#FFFFFF)
Horizontal layout:
  ├─ Left padding: 16pt
  ├─ Status dot: 10pt circle, bg-success (#4CAF50 → hsl(var(--success)))
  ├─ Gap: 12pt
  └─ Primary text: event.title, 15pt, font-normal, text-foreground
      No truncation on single line (title fits)
      No time sub-label
      No assignee badge
Bottom divider: 1pt solid border-border
```

**Observed CalendarReminderRow:**

| Section | Primary text | Dot color |
|---|---|---|
| Tuesday, June 30th | "Ryan Realty RBN License Renewal Due" | `bg-success` green |

#### Task row gestures

| Gesture | Target | Result |
|---|---|---|
| Tap checkbox | Unchecked checkbox | Marks complete: checkbox fills warning color, strikethrough on text, row fades/slides out after 500ms, badge decrements |
| Tap row body | Row (not checkbox) | Navigates to task detail / associated person record |
| Swipe left | Task row | Reveals quick-action buttons: Delete (destructive red), Reschedule (muted), Complete (success) |
| Pull to refresh | Scroll view top | Refetches tasks from `GET /api/crm/tasks` for displayed date range |

### A.6 Activity type → icon map

| Task type enum | Display label | Glyph | Color token |
|---|---|---|---|
| `call` | Call | PhoneHandsetIcon (filled) | `text-success` (`#2AB57D`) |
| `follow_up` | Follow Up | FlagIcon (outlined) | `text-muted-foreground` |
| `email` | Email | EnvelopeIcon (outlined) | `text-primary` |
| `text` | Text | ChatBubbleIcon (filled) | `text-accent` |
| `showing` | Showing | HomeIcon (outlined) | `text-warning` |
| `closing` | Closing | CheckmarkCircleIcon | `text-success` |
| `open_house` | Open House | DoorIcon (outlined) | `text-muted-foreground` |
| `thank_you` | Thank You | HeartIcon (filled) | `text-destructive` |
| `appointment` | Appointment | CalendarIcon | `text-primary` |

### A.7 FAB spec

```
Shape: 56pt circle
Background: bg-primary (#102742) [RR: navy instead of FUB blue]
Shadow: 0 4px 8px rgba(16,39,66,0.30)
Icon: "+" PlusIcon, 24pt, #FFFFFF, stroke 2pt
Position: fixed, bottom: 90pt (82 tab bar + 8 gap), right: 16pt
z-index: 50
Interaction: tap → openCreateEventSheet (bottom sheet, see Screen D)
```

### A.8 Bottom tab bar — exact spec

```
Height: 82pt
Background: bg-card (#FFFFFF)
Top border: 1pt solid border-border
Safe-area padding bottom: env(safe-area-inset-bottom) [for iPhone home indicator]
```

| Position | Icon | Label | Badge | Active color | Inactive color |
|---|---|---|---|---|---|
| 1 | InboxTrayIcon | "Inbox" | Red pill "30", 18pt pill, `bg-destructive` | — | `text-muted-foreground` |
| 2 | TrendLineIcon | "Activity" | None | — | `text-muted-foreground` |
| 3 | CalendarGridIcon | "Calendar" | None | `text-primary` #102742 (filled icon) | `text-muted-foreground` |
| 4 | PeopleGroupIcon | "People" | None | — | `text-muted-foreground` |
| 5 | PriceTagDollarIcon | "Deals" | None | — | `text-muted-foreground` |

Active tab 3 (Calendar): icon is filled variant; label + icon use `text-primary`.
Label typography: 10pt, font-medium, below icon.

### A.9 Component tree

```tsx
<MobileShell statusBarStyle="light" statusBarBg="var(--primary)">

  {/* HEADER — dark navy zone */}
  <CalendarTopBar className="bg-primary h-[56pt] flex items-center px-3">
    <UserAvatarButton
      src={currentUser.avatarUrl}
      size={36}
      className="rounded-full flex-shrink-0"
      onPress={openProfile}
    />
    <MonthTitleButton
      className="flex-1 flex items-center justify-center gap-1"
      onPress={toggleCalendarMode}
    >
      <span className="text-white text-[20px] font-semibold font-sans">
        {format(viewMonth, 'MMMM')}
      </span>
      <ChevronUpIcon className="text-white" size={14} />
    </MonthTitleButton>
    <div className="flex items-center gap-4">
      <NotificationBellButton iconColor="white" size={22} onPress={openNotifications} />
      <SearchButton iconColor="white" size={22} onPress={openSearch} />
    </div>
  </CalendarTopBar>

  {/* MONTHLY GRID — dark navy zone */}
  <MonthCalendarGrid
    month={viewMonth}              // Date object, first day of month
    selectedDate={selectedDate}    // Date | null
    eventDates={eventDateSet}      // Set<number> of days with events
    onDatePress={(day: number) => {
      setSelectedDate(day);
      scrollTaskListToDate(day);
    }}
    onSwipeLeft={() => advanceMonth(1)}
    onSwipeRight={() => advanceMonth(-1)}
    className="bg-primary"
    dayLabelClassName="text-white/55 text-[11px] uppercase tracking-wide"
    dateNumberClassName="text-white text-[22px] font-medium"
    dotClassName="bg-white/55 w-[5px] h-[5px] rounded-full"
    selectedClassName="bg-white/18 rounded-[8px] w-[44px] h-[44px]"
  />

  {/* TASK LIST — white scrollable zone */}
  <ScrollView
    ref={taskListScrollRef}
    className="flex-1 bg-card"
    showsVerticalScrollIndicator={false}
    onRefresh={refetchTasks}
  >
    {groupedTasks.map((group) => (
      <React.Fragment key={group.dateKey}>
        <DateSectionHeader label={group.label} />   {/* "Monday, June 22nd" */}
        {group.items.map((item) =>
          item.kind === 'task' ? (
            <CalendarTaskRow
              key={item.id}
              checked={item.is_completed}
              activityType={item.type}
              primaryText={item.name}
              dueTime={formatTime(item.due_datetime)}
              assigneeInitials={item.assignee.initials}
              assigneeColor={`var(--user-color-${item.assignee.slug})`}
              onCheckboxPress={() => markTaskComplete(item.id)}
              onRowPress={() => navigateToTask(item)}
            />
          ) : (
            <CalendarReminderRow
              key={item.id}
              primaryText={item.title}
              dotColor="hsl(var(--success))"
              onRowPress={() => navigateToEvent(item)}
            />
          )
        )}
      </React.Fragment>
    ))}
    <div className="h-[72pt]" /> {/* FAB clearance */}
  </ScrollView>

  {/* FAB */}
  <Fab
    icon={<PlusIcon size={24} className="text-white" />}
    className="bg-primary shadow-lg fixed bottom-[90pt] right-[16pt] w-[56pt] h-[56pt] rounded-full"
    onPress={openCreateEventSheet}
  />

  {/* BOTTOM TAB BAR */}
  <BottomTabBar
    activeTab="calendar"
    tabs={BOTTOM_TABS}
    inboxBadge={unreadInboxCount}
  />

</MobileShell>
```

### A.10 Data touched

| Data | Source | Fields |
|---|---|---|
| Event dates (dot indicators) | `GET /api/crm/appointments?startDate=&endDate=&scope=month` | `start_at` dates → `Set<number>` |
| Task rows | `GET /api/crm/tasks?due=range&dueStart=&dueEnd=&assigned_user_id=` | `id, name, type, due_datetime, is_completed, assigned_user_id` |
| Calendar reminder rows | `GET /api/crm/calendar-events?startDate=&endDate=` | `id, title, start_at, all_day, category` |
| Assignee badge | Resolved from `assigned_user_id` → `crm_people.brokers` or `auth.users` | `initials, slug` |
| Current user avatar | `currentUser.avatarUrl` | — |
| Inbox badge | `GET /api/crm/inbox/unread-count` | `count` |

### A.11 States

| State | Render |
|---|---|
| Loading (initial) | Skeleton: grid cells shimmer; 5 skeleton task rows in list |
| Loaded, date with tasks | Task rows grouped by date section headers |
| Loaded, date with no tasks | Date section header with "No tasks scheduled" placeholder row (12pt, text-muted-foreground, 40pt tall) |
| Checking a task | Immediate: checkbox fills warning, strikethrough text. After 500ms: row height→0 with slide animation |
| Month change (swipe) | Slide transition; grid re-renders for new month; task list re-fetches |

### A.12 Acceptance criteria

1. Monthly grid renders on a navy (`#102742`) background with white date numbers; today's date has a cream-tinted rounded-rect highlight; tapping any date selects it and scrolls the task list to that date's section.
2. Event dots (5pt circles, white/55% opacity) appear exactly on dates with entries; no dot on empty dates.
3. Day-of-week labels are all-caps, 11pt, white/55% opacity.
4. Swiping left/right on the calendar grid navigates months and resets event dots for the new month.
5. Section headers (34pt, `bg-muted`, 14pt font-semibold) label each date group using the format "Day, Month Ordinalday" (e.g. "Monday, June 22nd"); they are sticky within the scroll view.
6. CalendarTaskRow renders checkbox (18×18pt, `border-warning`, rounded 3pt), activity icon (20pt, type-coded color), description text (15pt, truncated), time sub-label (13pt, `text-muted-foreground`), and assignee badge (32pt circle, broker color, white initials 13pt).
7. Tapping a task row body navigates to the associated person record or task detail; tapping the checkbox marks it complete with optimistic strikethrough → slide-out animation.
8. Swipe-left on a task row reveals Delete / Reschedule / Complete quick-action buttons.
9. CalendarReminderRow (all-day events, reminders) has no checkbox; renders a 10pt `bg-success` dot + title text, 50pt height.
10. FAB is 56pt navy circle, fixed bottom-right (16pt from right, 90pt from bottom), opens the Create bottom sheet.
11. Bottom tab bar: 82pt, white, top border; Calendar tab (3rd) is active (navy, filled icon); Inbox tab shows red badge with count.
12. Pull-to-refresh on the task list re-fetches from the API.

---

## Screen B — Contact Detail / Calendar Tab — Empty State

**[OBSERVED — mob-31]**

### B.1 How to reach

Bottom tab bar → "People" → tap any contact row → "Calendar" sub-tab (3rd of 4). Route: `/crm/mobile/people/{personId}/calendar`. This is a pushed navigation view; the bottom tab bar is suppressed.

### B.2 Screen regions

| Region | y-band (pt) | Height (pt) | Background token |
|---|---|---|---|
| Status bar | 0–50 | 50 | `bg-primary` |
| Nav / back row | 50–90 | 40 | `bg-primary` |
| Contact header (avatar + name) | 90–130 | 40 | `bg-primary` |
| Sub-tab strip | 130–172 | 42 | `bg-primary` |
| Scrollable content area | 172–844 | 672 | `bg-muted` |
| FAB (floating) | ~760–820, right | 56×56 circle | `bg-primary` |

No bottom tab bar — pushed navigation stack.

### B.3 Nav / back row — exact elements

```
Background: transparent over bg-primary
Left: ChevronLeftIcon, 22pt, #FFFFFF, x≈16pt, y≈58pt center
  Interaction: pop navigation stack → contact list
Right: none visible in this state
```

### B.4 Contact header — exact elements

```
y-band: 90–130pt
Background: transparent over bg-primary (continuous navy zone)
Layout: horizontal, padding-left: 16pt

Avatar:
  Size: 52pt circle, border-radius: 50%
  Content: contact photo if available; else initials on colored bg
  Observed: real photo (ocean/surf "RIVERS TO THE SEA" circular badge)
  x: 16pt, y-center: 110pt

Name text (left of avatar):
  "Tide Rivers"
  Font: 20pt, font-semibold (Geist 600), color: #FFFFFF
  x: 80pt (16 avatar-left + 52 avatar + 12 gap), y-baseline: ~107pt

Subtitle text:
  "Last communication Jun 14"
  Font: 13pt, font-normal (Geist 400), color: text-muted-foreground on dark
  = rgba(255,255,255,0.55) ~ #b0bec8
  x: 80pt, y-baseline: ~122pt
```

### B.5 Sub-tab strip — exact elements

```
Height: 42pt
Background: bg-primary (#102742) — continuous with header, no visible seam
Equal-width tabs: 390 ÷ 4 = 97.5pt each

Tab 1: "Homes"      — inactive: 14pt, font-medium, color rgba(255,255,255,0.55)
Tab 2: "Notes"      — inactive: 14pt, font-medium, color rgba(255,255,255,0.55)
Tab 3: "Calendar"   — ACTIVE: 14pt, font-semibold, color #FFFFFF
                      + 2pt solid #FFFFFF underline indicator flush to strip bottom
                        spanning text width
Tab 4: "Automations"— inactive: 14pt, font-medium, color rgba(255,255,255,0.55)

Active indicator: position absolute, bottom: 0, width ≈ text width, height: 2pt, bg: #FFFFFF
```

**In-house sub-tabs for contact Calendar tab:**
The in-house CRM uses equivalent sub-tabs on the Person detail mobile view. The "Automations" tab maps to "Sequences" in-house. Tabs: `Overview | Notes | Calendar | Sequences` (same 4-tab pattern).

### B.6 Content area — empty state — every element

Background: `bg-muted` (`hsl(var(--muted))` ≈ `#edf0f5` lightened).

**1. "Add Appointment or Task" row** (y 172–212pt, first content row):

```
Height: 40pt
Background: transparent over bg-muted
Padding: 14pt vertical, 16pt horizontal
Layout: horizontal, align items center

Left icon:
  Size: 22pt circle
  Background: bg-primary (#102742) at 15% opacity → rgba(16,39,66,0.15)
  Icon: PlusIcon, 14pt, #FFFFFF (white plus on semi-transparent navy circle)
  [FUB used blue-filled circle; RR uses navy at reduced opacity]

Label: "Add Appointment or Task"
  Font: 16pt, font-medium, color: text-primary (#102742)
  Left gap from icon: 12pt

Interaction: tap → openCreateSheet(contactId)
  Opens bottom sheet for create appointment/task, pre-scoped to this contact
```

**2. Right-edge pull handle** (partially off-screen, x≈374–390, y≈280):

```
Appearance: rounded-rect pill, 16pt wide × 48pt tall, border-radius: 8pt
Background: text-muted-foreground at 50% opacity
Icon: ChevronLeftIcon inside, 10pt, white/light
Purpose: reveals a right-side quick-summary drawer (inferred)
Implementation: omit in v1; add as enhancement (low priority)
```

**3. Empty state** (y≈230–390pt, vertically centered in content):

```
Icon: compound glyph — CalendarIcon overlaid bottom-right with ClockIcon
  Composite size: 64pt
  Color: text-muted-foreground opacity 0.6

Primary text: "No Scheduled Appointments"
  Font: 17pt, font-semibold (Geist 600)
  Color: text-muted-foreground
  Alignment: center
  Padding-horizontal: 24pt (each side)

Secondary text: "Tasks and Appointments will show up here"
  Font: 14pt, font-normal (Geist 400)
  Color: text-muted-foreground opacity 0.75
  Alignment: center
  Margin-top: 8pt
```

**4. FAB** (fixed bottom-right):

```
Size: 56pt circle
Background: bg-primary (#102742)
Shadow: 0 4px 8px rgba(16,39,66,0.30)
Icon: PlusIcon, 24pt, #FFFFFF
Position: fixed, bottom: 32pt (above home indicator), right: 24pt
Interaction: same as "Add Appointment or Task" row → openCreateSheet(contactId)
```

### B.7 Component tree

```tsx
<MobileShell statusBarStyle="light" statusBarBg="var(--primary)">

  {/* Full-screen pushed view — no BottomTabBar */}
  <ContactDetailLayout>

    {/* Navy header zone — continuous */}
    <div className="bg-primary">

      {/* Back navigation */}
      <BackRow className="h-[40pt] flex items-center px-4 pt-2">
        <button onClick={navigateBack} className="text-white">
          <ChevronLeftIcon size={22} />
        </button>
      </BackRow>

      {/* Contact identity */}
      <ContactHeader className="flex items-center px-4 pb-3 gap-3">
        <ContactAvatar
          src={contact.avatarUrl}
          initials={contact.initials}
          size={52}
          className="rounded-full flex-shrink-0"
        />
        <div className="flex flex-col">
          <span className="text-white text-[20px] font-semibold leading-tight">
            {contact.name}
          </span>
          <span className="text-white/55 text-[13px] font-normal">
            {contact.lastCommunicationLabel}
            {/* "Last communication Jun 14" */}
          </span>
        </div>
      </ContactHeader>

      {/* Sub-tab strip */}
      <ContactSubTabBar
        tabs={[
          { key: 'overview',   label: 'Overview' },
          { key: 'notes',      label: 'Notes' },
          { key: 'calendar',   label: 'Calendar' },
          { key: 'sequences',  label: 'Sequences' },
        ]}
        activeTab="calendar"
        className="bg-primary h-[42pt]"
        activeTabClassName="text-white font-semibold border-b-2 border-white"
        inactiveTabClassName="text-white/55 font-medium"
      />
    </div>

    {/* Scrollable content — Calendar tab panel */}
    <TabPanel tabKey="calendar" className="bg-muted flex-1 relative">

      {/* Add action row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/80"
        onClick={() => openCreateSheet(contact.id)}
      >
        <div className="w-[22pt] h-[22pt] rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
          <PlusIcon size={14} className="text-primary" />
        </div>
        <span className="text-primary text-[16px] font-medium">
          Add Appointment or Task
        </span>
      </button>

      {/* Empty state */}
      <EmptyState
        className="flex-1 flex flex-col items-center justify-center px-6 py-16"
        icon={
          <div className="relative w-[64pt] h-[64pt] mb-4">
            <CalendarIcon size={64} className="text-muted-foreground/60" />
            <ClockIcon size={24} className="text-muted-foreground/60 absolute bottom-0 right-0" />
          </div>
        }
        title="No Scheduled Appointments"
        titleClassName="text-[17px] font-semibold text-muted-foreground text-center"
        subtitle="Tasks and Appointments will show up here"
        subtitleClassName="text-[14px] text-muted-foreground/75 text-center mt-2"
      />

    </TabPanel>

    {/* FAB */}
    <Fab
      icon={<PlusIcon size={24} className="text-white" />}
      className="bg-primary shadow-lg fixed bottom-8 right-6 w-[56pt] h-[56pt] rounded-full"
      onPress={() => openCreateSheet(contact.id)}
    />

  </ContactDetailLayout>

</MobileShell>
```

### B.8 Data touched

| Data | Source | Fields |
|---|---|---|
| Contact identity | `GET /api/crm/people/{id}` | `name, avatarUrl, initials, lastCommunicationAt` |
| Appointments | `GET /api/crm/appointments?personId={id}` | Empty array → empty state |
| Tasks | `GET /api/crm/tasks?person_id={id}&is_completed=false` | Empty array → empty state |
| `contact.lastCommunicationLabel` | Derived from `lastCommunicationAt` | `format(date, 'MMM d')` |

### B.9 Populated state (contact with appointments/tasks)

**[INFERRED — basis: mob-31 component structure + desktop §09 §2.12 + FUB docs §7.1]**

When `contact.appointments.length > 0` or `contact.tasks.length > 0`:

- Remove `<EmptyState>` component
- Render a chronologically ordered list of `<ContactCalendarEventRow>` entries

```
ContactCalendarEventRow anatomy:
  Height: 64pt
  Background: bg-card (#FFFFFF)
  Border-bottom: 1pt solid border-border

  Left zone (y-center):
    Date block (40pt wide):
      Month abbrev: "JUN", 10pt, ALL-CAPS, text-muted-foreground
      Day number: "22", 20pt, font-bold, text-foreground
      Stack vertically, center-aligned

  Divider: 1pt solid border-border, 32pt tall, y-centered

  Main zone (flex: 1, padding: 0 12pt):
    Title: appointment.title or task.name, 15pt, font-medium, text-foreground
    Sub-label row:
      Type icon (14pt) + type label (13pt, text-muted-foreground)
      Gap: 8pt
      Time: "2:00pm – 3:00pm" or "Due 6:27am", 13pt, text-muted-foreground

  Right zone (24pt):
    If task: CalendarTaskCheckbox (18pt, unchecked state = border-warning)
    If appointment: outcome dot or ChevronRightIcon

Tap row: navigates to appointment detail or task detail
```

Appointment indicator colors (consistent with desktop §09 §2.5.3):
- FUB appointment: blue `bg-primary` left border-left: 3pt strip
- Task: amber/warning `bg-warning` left border-left: 3pt strip
- Synced Google event: green `bg-success` left border-left: 3pt strip

### B.10 Acceptance criteria

1. Contact header shows circular avatar (52pt), name in 20pt white semibold, last-communication subtitle in 13pt white/55% opacity; all on navy (`bg-primary`) background that spans status bar through sub-tab strip with no visible break.
2. Sub-tab strip has 4 equal-width tabs (Overview, Notes, Calendar, Sequences); active "Calendar" tab has white text + 2pt white bottom-border underline; inactive tabs are white/55% opacity.
3. "Add Appointment or Task" row renders at the top of the content area: 22pt circle (navy/15% opacity) with white plus icon + "Add Appointment or Task" in 16pt navy; tapping opens the create bottom sheet pre-scoped to this contact.
4. Empty state shows compound CalendarIcon+ClockIcon (64pt, muted), "No Scheduled Appointments" (17pt semibold muted) + "Tasks and Appointments will show up here" (14pt muted); centered vertically in remaining content area.
5. FAB (56pt, navy, white plus) is fixed bottom-right (32pt from bottom, 24pt from right); triggers the same create sheet as the add-action row.
6. Back chevron (22pt white, top-left) pops navigation stack to contact list.
7. No bottom tab bar visible (pushed navigation stack suppresses it).
8. When appointments/tasks exist: renders chronological `ContactCalendarEventRow` list with date block, title, type, time, and checkbox/chevron right zone; left border strip encodes event type (blue=appointment, amber=task, green=synced).
9. Swipe-left on a populated appointment row reveals Edit / Delete quick actions.
10. Tapping "Sequences" sub-tab navigates to the sequences/action-plans panel for this contact (sibling screen).

---

## Screen C — Dedicated Tasks List (Today / Overdue / Future)

**[INFERRED — basis: desktop §09 §1.2–§1.8, mob-08 task row anatomy, FUB docs §1.5]**

### C.1 How to reach

Bottom tab bar has no dedicated "Tasks" tab in FUB iOS (Tasks are accessed via Calendar tab → task list, or via Person detail). In the in-house mobile build, tasks are surface from:
- Calendar main screen task list (screen A)
- Person detail Calendar sub-tab (screen B)
- Optionally: a "Tasks" shortcut reachable via the Calendar tab header or a FAB long-press menu

For a dedicated Tasks view route: `/crm/mobile/tasks/{today|overdue|future}`.

### C.2 Screen regions

| Region | y-band (pt) | Height (pt) | Background token |
|---|---|---|---|
| Status bar | 0–47 | 47 | `bg-primary` |
| Nav / header bar | 47–95 | 48 | `bg-primary` |
| Sub-tab bar | 95–135 | 40 | `bg-card` with bottom border |
| Content area | 135–762 | 627 | `bg-muted` |
| FAB | fixed bottom-right | 56 circle | `bg-primary` |
| Bottom tab bar | 762–844 | 82 | `bg-card` |

### C.3 Nav / header bar

```
Background: bg-primary (#102742)
Left: BackButton or hamburger (if top-level)
Center: "Tasks" — 18pt, font-semibold (Geist 600), #FFFFFF
Right: FilterButton — SlidersIcon 22pt #FFFFFF, tap → filter bottom sheet
```

### C.4 Sub-tab bar

Three pill-tabs, horizontal scroll if labels overflow:

```
Height: 40pt
Background: bg-card (#FFFFFF)
Border-bottom: 1pt solid border-border
Tab padding: 12pt horizontal each
Active tab: text-primary (#102742), font-semibold, underline indicator 2pt bg-primary
Inactive tab: text-muted-foreground, font-medium
```

| Tab | Label | Badge | When badge shows |
|---|---|---|---|
| 1 | "Today's Tasks" | None | — |
| 2 | "Overdue" | Count integer (e.g. "268"), `bg-destructive` red pill | `overdue_count > 0` |
| 3 | "Future" | None | — |

Default active tab: "Overdue" if `overdue_count > 0`; else "Today's Tasks".

### C.5 Content area — Overdue tab (default)

**Content header row** (inside scroll view, above date groups):

```
Height: 44pt
Background: bg-card (#FFFFFF)
Padding: 0 16pt
Layout: space-between, align-center

Left: ClockIcon (16pt, text-muted-foreground) + " Overdue Tasks" (15pt, font-semibold, text-foreground)
Right: "Clear My Overdue Tasks" (14pt, text-primary, font-medium, no underline at rest)

Interaction (right link):
  → confirmation Alert: "Clear all {count} overdue tasks? This cannot be undone."
  → On confirm: POST /api/crm/tasks/clear-overdue
  → On success: list empties, badge → 0
  → Only clears authenticated user's own tasks
```

**Date group headers:**

```
Format: "{Day name}, {Month abbrev} {DD} ({count in group})"
Examples: "Tuesday, Jun 23 (3)", "Monday, Jun 22 (1)", "Friday, Jun 19 (3)"
Height: 36pt
Background: bg-muted
Padding-left: 16pt
Font: 13pt, font-normal, text-foreground (slightly muted)
Date ordering: DESCENDING (most recent overdue first)
```

**Task row anatomy** (full spec matching desktop and mob-08 observation):

```
Height: 64pt (slightly taller than calendar list row for extra readability)
Background: bg-card (#FFFFFF)
Padding: 12pt horizontal
Border-bottom: 1pt solid border-border
Layout: horizontal, align items flex-start, padding-top: 10pt

Col 1 — Checkbox (flex-shrink: 0):
  Size: 16×16pt
  Shape: square, border-radius: 3pt
  Unchecked: bg-card, border: 1.5pt solid border-warning (hsl(var(--warning)))
  Tap: → mark complete (optimistic)

Col 2 — Contact avatar (flex-shrink: 0, margin-left: 10pt):
  Size: 32pt circle, border-radius: 50%
  Content: initials on bg (e.g. "MR" on --user-color-matt, "S" on #C0A882)
  If photo available: show photo

Col 3 — Main content (flex: 1, margin-left: 10pt):
  Row 1: contact name (14pt, font-medium, text-primary, underlined on hover) — navigates to person detail
  Row 2: task type icon (14pt, type-coded color) + task description (13pt, font-normal, text-foreground, 1-line truncated)
  Row 3: assignee sub-label — PersonIcon (12pt, text-muted-foreground) + " Me" or agent name (12pt, text-muted-foreground)

Col 4 — Right zone (flex-shrink: 0, align items flex-end):
  Due time: ClockIcon (12pt, text-muted-foreground) + "12:12pm" (13pt, text-muted-foreground)
  Expand: ChevronRightIcon (16pt, text-muted-foreground, margin-top: 6pt)
```

**Observed task data (from mob-08 + desktop §09 §1.5.3):**

| Date group | Contact | Task description | Assigned | Due time |
|---|---|---|---|---|
| Tue, Jun 23 (3) | Matthew Ryan | Lead returned to website. Follow up now. | Me | 12:12pm |
| Tue, Jun 23 (3) | Matt Ryan | Lead returned to website. Follow up now. | Me | 3:30pm |
| Tue, Jun 23 (3) | Matthew Ryan | Lead returned to website. Follow up now. | Me | 8:26pm |
| Mon, Jun 22 (1) | Matthew Ryan | Lead returned to website. Follow up now. | Me | 6:27am |
| Fri, Jun 19 (3) | Matthew Ryan | Lead returned to website. Follow up now. | Me | 6:55am |
| Fri, Jun 19 (3) | Matthew Ryan | Lead returned to website. Follow up now. | Me | 2:57pm |
| Fri, Jun 19 (3) | Matthew Ryan | Lead returned to website. Follow up now. | Me | 6:15pm |

All observed tasks: type=`call`, icon=PhoneHandsetIcon (20pt, `text-success`).

### C.6 Content area — Today's Tasks tab

Same layout and row anatomy as Overdue. Differences:
- Content header: "Today's Tasks" (no "Clear My" link — bulk clear is Overdue-only)
- Date ordering: ASCENDING (earliest due time first)
- If empty: empty state card (see C.7)

### C.7 Content area — Future tab + empty state

Same layout. Includes tasks with `due_date IS NULL` (no date set) in a "No date" group at bottom.

Empty state when no future tasks exist:
```
Background: bg-card, centered card in content area, padding: 32pt
Icon: PencilSquareIcon or EditIcon, 48pt, text-muted-foreground/50
Text: "No future tasks" (16pt, font-semibold, text-muted-foreground)
Sub-text: "Create a task to schedule a follow-up" (13pt, text-muted-foreground/75)
CTA button: "+ Create Task" (Button variant="outline", 36pt tall, full-width)
```

### C.8 Task completion UX (mobile)

1. Tap checkbox → **immediate**: checkbox fills `bg-warning`, text gets `line-through` + `text-muted-foreground`, badge decrements by 1
2. After 500ms: row height animates to 0 (slide-up) + fade-out
3. API: `PATCH /api/crm/tasks/{id}` body `{ is_completed: true }` — `completed_at` = now()
4. If API fails: revert optimistic update, show toast "Failed to complete task"

### C.9 Swipe actions on task row

| Direction | Actions revealed |
|---|---|
| Swipe left | "Complete" (success green, CheckIcon) + "Delete" (destructive red, TrashIcon) |
| Swipe right | "Reschedule" (primary navy, CalendarIcon) → opens date picker sheet |

### C.10 Filter bottom sheet (tapping FilterButton in nav)

**[INFERRED — basis: desktop §09 §1.4.2]**

```
Sheet type: bottom sheet, 60% screen height, drag handle at top
Title: "Filters" (16pt, font-semibold)
Sections:

TASK TYPE (multi-select checkboxes, all checked by default):
  ☑ All Types (meta toggle)
  ☑ Follow Up   [FlagIcon, text-muted-foreground]
  ☑ Call        [PhoneHandsetIcon, text-success]
  ☑ Email       [EnvelopeIcon, text-primary]
  ☑ Text        [ChatBubbleIcon, text-accent]
  ☑ Showing     [HomeIcon, text-warning]
  ☑ Closing     [CheckCircleIcon, text-success]
  ☑ Open House  [DoorIcon, text-muted-foreground]
  ☑ Thank You   [HeartIcon, text-destructive]

VISIBILITY (below separator):
  ☐ Show Completed

AGENT SCOPE (only for Owner/Admin/Team Lead roles):
  ● Me (default)
  ○ All
  ○ [list of team members]

Footer:
  [Clear Filters] (ghost button)   [Apply] (bg-primary button)
```

### C.11 Component tree

```tsx
<MobileShell statusBarStyle="light" statusBarBg="var(--primary)">

  <TasksTopBar>
    <BackButton />
    <span className="text-white text-[18px] font-semibold">Tasks</span>
    <FilterButton onPress={openFilterSheet} />
  </TasksTopBar>

  <TasksSubTabBar
    tabs={['Today\'s Tasks', `Overdue (${overdueCount})`, 'Future']}
    activeTab={activeTab}
    onTabChange={setActiveTab}
  />

  {/* Overdue tab content */}
  {activeTab === 'overdue' && (
    <ScrollView className="flex-1 bg-muted">
      <TaskListHeader
        title="Overdue Tasks"
        action={
          <button onClick={confirmClearOverdue} className="text-primary text-[14px]">
            Clear My Overdue Tasks
          </button>
        }
      />
      {groupedOverdueTasks.map((group) => (
        <React.Fragment key={group.dateKey}>
          <TaskDateGroupHeader
            label={group.label}           // "Tuesday, Jun 23 (3)"
            className="bg-muted h-[36pt] flex items-center px-4 text-[13px]"
          />
          {group.tasks.map((task) => (
            <MobileTaskRow
              key={task.id}
              task={task}
              onComplete={() => markComplete(task.id)}
              onPress={() => navigateToTask(task)}
              onSwipeComplete={() => markComplete(task.id)}
              onSwipeDelete={() => confirmDelete(task.id)}
              onSwipeReschedule={() => openReschedulePicker(task)}
            />
          ))}
        </React.Fragment>
      ))}
    </ScrollView>
  )}

  {/* FAB */}
  <Fab
    icon={<PlusIcon size={24} className="text-white" />}
    className="bg-primary fixed bottom-[90pt] right-4 w-[56pt] h-[56pt] rounded-full shadow-lg"
    onPress={() => openCreateTaskSheet()}
  />

  <BottomTabBar activeTab="calendar" tabs={BOTTOM_TABS} inboxBadge={unreadCount} />

  {/* Sheets */}
  <FilterBottomSheet
    open={filterSheetOpen}
    onClose={closeFilterSheet}
    filters={activeFilters}
    onApply={applyFilters}
    showAgentScope={currentUser.role === 'owner' || currentUser.role === 'admin'}
  />

</MobileShell>
```

### C.12 Data touched

| Data | Source | Endpoint |
|---|---|---|
| Overdue tasks | API | `GET /api/crm/tasks?due=overdue&assigned_user_id={}&type={}` |
| Today's tasks | API | `GET /api/crm/tasks?due=today&assigned_user_id={}` |
| Future tasks | API | `GET /api/crm/tasks?due=upcoming&assigned_user_id={}` |
| Overdue count | API | `GET /api/crm/tasks?due=overdue&count=true` |
| Mark complete | API | `PATCH /api/crm/tasks/{id}` `{ is_completed: true }` |
| Clear overdue | API | `POST /api/crm/tasks/clear-overdue` |
| Delete task | API | `DELETE /api/crm/tasks/{id}` (own tasks only) |

### C.13 Acceptance criteria

1. Three sub-tabs (Today's Tasks / Overdue / Future) render; Overdue tab shows live count in `bg-destructive` red badge; default active tab = Overdue if count > 0.
2. Overdue task list renders date groups in descending order (newest overdue first); format "Day, Mon DD (N)".
3. Each task row: checkbox (16×16pt, warning border), contact avatar (32pt circle, initials + broker color), contact name (14pt primary, tappable → person detail), type icon (14pt, type-coded), description (13pt, 1-line truncated), assignee label (12pt muted), due time (13pt muted, right-aligned), expand chevron.
4. Tapping checkbox → immediate strikethrough + warning fill → 500ms slide-out → badge decrements optimistically.
5. Swipe-left reveals Complete (success) + Delete (destructive); swipe-right reveals Reschedule (opens date picker).
6. "Clear My Overdue Tasks" shows a confirmation dialog with count before executing; only clears current user's tasks; badge drops to 0 on success.
7. Future tab includes tasks with null `due_date`; shows "No date" group at bottom.
8. Today's Tasks empty state and Future empty state render appropriate icon + copy + CTA.
9. Filter bottom sheet lists all 9 task types (8 shown; `appointment` type visible), all checked by default, plus "Show Completed" toggle; applying filters re-fetches live.
10. Agent scope filter (admin/owner only): switching to "All" or a specific agent updates the list and badge.
11. Completed tasks hidden by default; "Show Completed" in filter sheet surfaces them with `line-through` + `text-muted-foreground` styling.
12. Notifications: tasks with `due_datetime` (date + time) trigger push notification; tasks with `due_date` only (no time) do not; Action Plan tasks (`is_from_action_plan=true`) never send notifications — these rules enforced server-side and documented in the UI via tooltip on task creation.

---

## Screen D — Create Task / Create Appointment Bottom Sheet

**[INFERRED — basis: desktop §09 §1.10–§1.11, §2.6, mob-31 FAB behavior, FUB docs §2.3, FUB iOS docs §7.1]**

### D.1 Trigger sources

- Screen A FAB → shows a type picker first ("New Task" / "New Appointment")
- Screen B "Add Appointment or Task" row → same type picker, pre-scoped to contact
- Screen C FAB → defaults to "New Task" (from Tasks screen context)

### D.2 Type picker (presented before fields)

```
Sheet type: bottom sheet, drag handle, 220pt height
Title: "What would you like to add?"
Options (each 52pt tall, border-bottom):
  [CalendarIcon 20pt navy] "Appointment"  — full scheduling with date, time, guests
  [CheckSquareIcon 20pt navy] "Task"       — follow-up action item
Cancel: "Cancel" ghost button at bottom
```

### D.3 Create Task sheet

```
Sheet type: bottom sheet, ~85% screen height, drag-dismissable
Title: "New Task" (16pt, font-semibold) | Dismiss X (top-right)

Fields (top to bottom, 16pt horizontal padding):

1. Contact (required if not pre-scoped):
   Label: "Contact" (12pt, font-medium, text-muted-foreground)
   Input: Search field — placeholder "Search contacts...", PersonIcon left
   Value: pre-populated if opened from contact detail
   Shows: avatar (24pt) + full name + remove X

2. Task Type (required):
   Label: "Type" (12pt)
   Input: Select dropdown, full-width, 44pt height
   Placeholder: "Select type"
   Options: Follow Up | Call | Email | Text | Showing | Closing | Open House | Thank You
   Each option shows its icon (left, 16pt, type-coded color)

3. Description:
   Label: "Description" (12pt)
   Input: Textarea, 2 rows min, auto-expand
   Placeholder: "Add a note about this task..."

4. Due Date:
   Label: "Due date" (12pt)
   Input: inline DatePicker (native mobile date wheel on iOS, styled picker web)
   Placeholder: "Select date (optional)"
   Note below field: "⚠ Without a time, no reminder notification will fire" (12pt, text-warning)

5. Due Time (appears when Due Date is set):
   Label: "Due time" (12pt)
   Input: TimePicker, 30-min increment default; manual entry for 15-min
   Placeholder: "Select time (optional)"
   Shows note: "Reminder notification will fire at this time"

6. Assignee:
   Label: "Assigned to" (12pt)
   Input: Select/search, defaults to current user ("Me")
   Options: Matt Ryan | Paul Stevenson | Rebecca Peterson | [other team members]

7. Reminder (appears when due_datetime is set):
   Label: "Reminder" (12pt)
   Toggle: Switch component (shadcn Switch), default OFF
   When ON: Select — "At due time" | "5 min before" | "15 min before" | "30 min before" | "1 hour before" | "1 day before"
   Maps to: remind_seconds_before field

Submit button:
  "Create Task" — bg-primary, text-white, full-width, 48pt height, rounded-lg
  Disabled if: no contact + no task type
  On press: POST /api/crm/tasks, dismiss sheet, show success toast
```

### D.4 Create Appointment sheet

```
Sheet type: bottom sheet, scrollable, ~90% screen height
Title: "New Appointment" (16pt, font-semibold) | Dismiss X

Fields (match desktop §09 §2.6 exactly, adapted for mobile):

1. Title (required):
   Input: TextInput, full-width, 44pt
   Placeholder: "Add title"
   Font: 16pt, Geist 400

2. Date row (horizontal, 2 fields side by side):
   Left (50%): "Start date" DatePicker, today pre-filled (06/30/2026)
   Right (50%): "End date" DatePicker, same day pre-filled

3. Time row (horizontal, 2 fields, hidden when All Day = true):
   Left (50%): "Start time" TimePicker, "8:00 am" default
   Right (50%): "End time" TimePicker, "8:30 am" default (+30 min)

4. All day toggle:
   Row: "All day event" label (14pt) + Switch (right-aligned)
   When ON: hides time row (rows collapse with animation)

5. Timezone:
   Select dropdown, compact, full-width
   Default: user's account timezone ("Pacific Time (GMT-07:00)")
   Label: "Timezone" (12pt, text-muted-foreground)

6. Location:
   Input: TextInput, 44pt, MapPinIcon left (16pt, text-muted-foreground)
   Placeholder: "Add location"

7. Guests:
   Label: "Guests" (12pt)
   Search input: SearchIcon + "Add guests..." placeholder
   Pre-populated chip: current user avatar (24pt circle) + name + X remove
   If opened from contact: contact chip also pre-populated
   Chips display below search field (flex-wrap)

8. Type:
   Select dropdown, full-width, 44pt
   Placeholder: "Set type"
   Options: admin-configured appointment types (from GET /api/crm/appointment-types)

9. Outcome:
   Select dropdown, full-width, 44pt
   Placeholder: "No Outcome" (default)
   Options: admin-configured outcomes (from GET /api/crm/appointment-outcomes)

10. Notes:
    Textarea, 3-row min, auto-expand
    Placeholder: "Add notes..."
    Toolbar: Bold | Italic | Underline | BulletList | NumberedList (5 icons, 20pt each)

11. Send invitation:
    Row: CheckboxIcon (16pt) + "Send invitation email & text reminder" (14pt, text-foreground)
    Default: unchecked
    Note (when checked): "Reminder will be sent to primary email of each contact guest"

Submit:
  "Create Appointment" — bg-primary, text-white, full-width, 48pt, rounded-lg
  Disabled if: no title
  On press: POST /api/crm/appointments?sendInvitation={sendInvitation}, dismiss, toast
```

### D.5 Re-edit warning (appointment)

When opening an existing appointment for editing (not creation):
```
If send_invitation was true on creation AND the checkbox is currently unchecked:
  Show inline warning banner below the checkbox:
  [WarningTriangleIcon orange] "Re-check to keep the scheduled reminder.
   Saving without checking will cancel the pending reminder."
  Background: bg-warning/10, border: 1pt border-warning/30, padding: 10pt, rounded-md
```

### D.6 Component tree (Create Task sheet)

```tsx
<BottomSheet
  open={createSheetOpen}
  onClose={closeSheet}
  snapPoints={['85%']}
  className="bg-card rounded-t-2xl"
>
  <SheetHeader>
    <SheetTitle className="text-[16px] font-semibold">New Task</SheetTitle>
    <Button variant="ghost" size="icon" onClick={closeSheet}>
      <XIcon size={20} />
    </Button>
  </SheetHeader>

  <ScrollView className="px-4 pb-8 gap-4">
    <FormField label="Contact">
      <ContactSearchInput
        value={taskForm.personId}
        onChange={(p) => setTaskForm({...taskForm, personId: p.id, personName: p.name})}
        locked={!!presetContactId}
      />
    </FormField>

    <FormField label="Type">
      <Select value={taskForm.type} onValueChange={(v) => setTaskForm({...taskForm, type: v})}>
        <SelectTrigger className="h-[44pt]">
          <SelectValue placeholder="Select type" />
        </SelectTrigger>
        <SelectContent>
          {TASK_TYPES.map(({value, label, icon, color}) => (
            <SelectItem key={value} value={value}>
              <div className="flex items-center gap-2">
                {icon(color)}
                <span>{label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>

    <FormField label="Description">
      <Textarea
        placeholder="Add a note about this task..."
        value={taskForm.name}
        onChange={(e) => setTaskForm({...taskForm, name: e.target.value})}
        rows={2}
      />
    </FormField>

    <FormField label="Due date">
      <MobileDatePicker
        value={taskForm.dueDate}
        onChange={(d) => setTaskForm({...taskForm, dueDate: d})}
        placeholder="Select date (optional)"
      />
      {taskForm.dueDate && !taskForm.dueTime && (
        <p className="text-[12px] text-warning mt-1">
          Without a time, no reminder notification will fire.
        </p>
      )}
    </FormField>

    {taskForm.dueDate && (
      <FormField label="Due time">
        <MobileTimePicker
          value={taskForm.dueTime}
          onChange={(t) => setTaskForm({...taskForm, dueTime: t})}
          placeholder="Select time (optional)"
          stepMinutes={30}
        />
      </FormField>
    )}

    <FormField label="Assigned to">
      <Select value={taskForm.assignedUserId} onValueChange={(v) => setTaskForm({...taskForm, assignedUserId: v})}>
        <SelectTrigger className="h-[44pt]">
          <SelectValue placeholder="Me" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={currentUser.id}>Me</SelectItem>
          {teamMembers.map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>

    {taskForm.dueTime && (
      <FormField label="Reminder">
        <div className="flex items-center justify-between">
          <span className="text-[14px]">Send reminder</span>
          <Switch
            checked={taskForm.reminderEnabled}
            onCheckedChange={(v) => setTaskForm({...taskForm, reminderEnabled: v})}
          />
        </div>
        {taskForm.reminderEnabled && (
          <Select value={String(taskForm.remindSecondsBefore)} onValueChange={(v) => setTaskForm({...taskForm, remindSecondsBefore: Number(v)})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">At due time</SelectItem>
              <SelectItem value="300">5 minutes before</SelectItem>
              <SelectItem value="900">15 minutes before</SelectItem>
              <SelectItem value="1800">30 minutes before</SelectItem>
              <SelectItem value="3600">1 hour before</SelectItem>
              <SelectItem value="86400">1 day before</SelectItem>
            </SelectContent>
          </Select>
        )}
      </FormField>
    )}

    <Button
      className="w-full h-[48pt] bg-primary text-white rounded-lg mt-4"
      disabled={!taskForm.personId || !taskForm.type}
      onClick={submitTask}
    >
      Create Task
    </Button>
  </ScrollView>
</BottomSheet>
```

### D.7 Data touched

| Data | Source | Fields |
|---|---|---|
| Task creation | `POST /api/crm/tasks` | `person_id, assigned_user_id, name, type, due_date, due_datetime, remind_seconds_before` |
| Appointment creation | `POST /api/crm/appointments?sendInvitation={bool}` | `title, start_at, end_at, all_day, timezone, location, description, type_id, outcome_id, invitees[]` |
| Appointment types | `GET /api/crm/appointment-types` | `id, name, order_weight` |
| Appointment outcomes | `GET /api/crm/appointment-outcomes` | `id, name, order_weight` |
| Contact search | `GET /api/crm/people?q={query}&limit=10` | `id, name, avatarUrl, initials` |
| Team members | `GET /api/crm/users?role=broker` | `id, name, slug, initials` |

### D.8 Acceptance criteria

1. Type picker bottom sheet appears when FAB is tapped from Calendar or contact-less context; "Appointment" and "Task" options each 52pt tall.
2. Create Task sheet: contact search pre-populated when opened from a contact; type selector shows all 8 task types with icon + label; due-date picker optional; time picker appears only after date is selected; warning note shows when date-but-no-time is set; reminder selector appears only when due_datetime is fully set.
3. Assignee select defaults to "Me"; admin/owner can select any team member.
4. "Create Task" button disabled until contact + type are both selected; on submit: `POST /api/crm/tasks` fires, sheet closes, success toast "Task created".
5. Create Appointment sheet: all 16 fields from desktop §09 §2.6 present; current user is auto-added to guests; contact pre-populated when from contact detail.
6. "All day event" switch hides time row with animation; no time fields visible when checked.
7. Send invitation checkbox defaults to unchecked (`sendInvitation=false`); when checked, note about primary email shown.
8. Re-edit warning banner appears if editing an existing appointment that had send_invitation=true and the checkbox is now unchecked.
9. Rich-text notes toolbar (Bold, Italic, Underline, Bullet, Numbered) functional.
10. Appointments with `all_day=true` do NOT sync to Google Calendar (backend enforces; UI shows tooltip if user attempts to sync).
11. Invitation sends only to the primary (first) email on the contact profile; secondary emails excluded (enforced server-side; noted in UI on hover/info icon).

---

## Shared Activity-Type Enum

Tasks and appointment types draw from the same 8-value conceptual set. This enum is used across filter chips, type selectors, icon maps, and calendar event dot colors:

```typescript
// crm_tasks.type — stored as string enum on the task record itself
export const TASK_TYPE_ENUM = [
  'follow_up',   // Follow Up   — FlagIcon, text-muted-foreground
  'call',        // Call        — PhoneHandsetIcon, text-success
  'text',        // Text        — ChatBubbleIcon, text-accent
  'email',       // Email       — EnvelopeIcon, text-primary
  'appointment', // Appointment — CalendarIcon, text-primary (API only; not in Filters UI)
  'showing',     // Showing     — HomeIcon, text-warning
  'closing',     // Closing     — CheckCircleIcon, text-success
  'open_house',  // Open House  — DoorIcon, text-muted-foreground
  'thank_you',   // Thank You   — HeartIcon, text-destructive
] as const;

// crm_appointment_types — admin-configurable rows (display labels expected to match):
// "Follow Up" | "Call" | "Email" | "Text" | "Showing" | "Closing" | "Open House" | "Thank You"

// Calendar event dot colors (mobile)
export const MOBILE_EVENT_DOT_COLORS = {
  appointment:     'bg-primary',    // blue — FUB appointments (pink in FUB iOS)
  task:            'bg-warning',    // amber — tasks (orange/yellow in FUB iOS)
  deal_closing:    'bg-destructive',// red-orange — deal closings
  custom_date:     'bg-accent',     // purple/accent — custom dates
  all_day:         'bg-primary',    // blue — all-day events/reminders
  lead_followup:   'bg-warning',    // amber — auto-generated follow-up tasks
  expired_listing: 'bg-destructive',// red — expired listing alerts
  synced_external: 'bg-success',    // green — Google/MS365 synced events
} as const;
```

**FUB iOS visual indicators (per docs §7.1) → in-house mapping:**
| FUB iOS | Color | In-house web-mobile |
|---|---|---|
| Tasks | orange checkbox icon | CalendarTaskRow with `border-warning` checkbox |
| FUB appointments | pink circle | `bg-primary` left-border strip on row |
| Synced external | green circle | `bg-success` left-border strip on row |

---

## Calendar Sync Notes (Mobile Context)

**[INFERRED — basis: FUB docs §4.1, §4.2, desktop §09 §2.13]**

Items that DO appear on the mobile task/calendar list:
- Tasks with `due_datetime` set (full date + time)
- FUB appointments with at least one invitee
- External calendar events synced from Google (shown with Google indicator icon)
- External events synced from Microsoft 365 (shown with Microsoft indicator icon)

Items that do NOT appear:
- Tasks with only `due_date` (no time component) — appear in task list but not on calendar dot
- All-day events synced to Google Calendar (excluded per Google sync rule)
- Google Focus Time / Out of Office / Tasks / Appointment Slots

**Privacy note:** Google-synced appointments are hidden from other brokers by default. In multi-broker views (if implemented), label them `[hidden for privacy]`.

**Android bug — do NOT replicate:** Android FUB shows all past appointments as "overdue" regardless of outcome. In-house build: respect `outcome_id` field; a completed appointment does not show as overdue.

---

## Cross-References

- **Sibling mobile sections:**
  - §23 Mobile — People List: contacts navigated to from task row contact name
  - §24 Mobile — Person Detail: Calendar sub-tab (Screen B) is part of the Person detail layout documented in §24
  - §25 Mobile — Inbox: unread badge (count "30") on Calendar screen bottom tab derives from §25 inbox count
  - §26 Mobile — Activity Feed: task completion events appear in the activity feed
  - §28 Mobile — Deals: deal closings appear on calendar with orange dot
- **Desktop sections:**
  - `09-tasks-and-calendar.md` — full data model, acceptance criteria, API endpoints, exact field inventory
  - `07a-person-detail-sidebar-and-inline-edit.md` — right rail appointments section (desktop counterpart to Screen B)
  - `07b-person-detail-timeline-and-engagement.md` — task completion events in timeline
- **Implementation files:**
  - `crm_tasks` table: `supabase/migrations/` (schema per desktop §09 §1.19)
  - `crm_appointments` table: `supabase/migrations/` (schema per desktop §09 §2.9)
  - `lib/data/crm-tasks.ts`: DAL functions for tasks (query bucketing, mark complete, clear overdue)
  - `lib/data/crm-appointments.ts`: DAL functions for appointments (by person, by date range)

---

## Sources

| Source | Role | Screens derived |
|---|---|---|
| `mob-08.md` | **OBSERVED** — pixel-perfect analysis of FUB iOS Calendar main screen (monthly grid + task list) | Screen A (all elements) |
| `mob-31.md` | **OBSERVED** — pixel-perfect analysis of FUB iOS Contact Detail / Calendar sub-tab empty state | Screen B (all elements) |
| `09-tasks-and-calendar.md` (desktop spec) | BASIS for inferred screens — data model, field inventory, behavior rules, acceptance criteria | Screens C, D (task list buckets, create sheets, filter behavior, row anatomy) |
| `fub-docs/tasks-calendar.md` (official FUB docs) | BASIS — API field names, notification rules, sync rules, reminder timing, Android gotchas | Screens C, D; all notification + sync behavior; enum values |
| FUB iOS design patterns (mob-08, mob-31) | BASIS — mobile interaction patterns (bottom sheets, swipe actions, FAB behavior, sub-tab strip) | Applied to all inferred screens |

**Inferred screens (no direct screenshot):**
- Screen C (Dedicated Tasks List — Today/Overdue/Future): inferred from desktop §09 layout + mob-08 task row anatomy + FUB docs task views
- Screen D (Create Task / Create Appointment bottom sheets): inferred from desktop §09 §2.6 (16-field appointment modal) + mob-31 FAB behavior + FUB docs API field schemas + general mobile bottom-sheet pattern
- Screen B populated state: inferred from Screen B empty state structure + desktop §09 §2.12 (appointments on contact right rail) + FUB docs appointment row data
