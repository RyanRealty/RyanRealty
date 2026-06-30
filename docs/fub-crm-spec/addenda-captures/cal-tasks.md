<!-- Addendum capture 2026-06-30. Fills coverage gaps for: §09 Calendar (week/day) & Tasks -->

# FUB Calendar & Tasks — Exhaustive Buildable Analysis
# Spec §09 — Tasks & Calendar
# Source: 12-frame screen-recording + quadrant tiles (cal-tasks series)
# Compiled: 2026-06-30

---

## Frame Index & State Summary

| Frame | View | State |
|-------|------|-------|
| f01 | Action Plans / Templates (background) | Pre-navigation starting state |
| f02 | Calendar → Day view | Tuesday Jun 30, all-day event visible |
| f03 | Calendar → Week view + Create Appointment modal (open) | Modal in default state, no type set |
| f04 | Calendar → Week view + Create Appointment modal | "Set type" dropdown open |
| f05 | Calendar → Week view | Modal dismissed, week grid visible |
| f06 | Calendar → Week view + Edit Appointment modal (open) | Existing event being edited, detail popup visible behind modal |
| f07 | Calendar → Week view | Identical to f05, no overlay |
| f08 | Tasks → Today's Tasks tab | Empty state ("No tasks found, nice work!") |
| f09 | Tasks → Overdue (267) tab | Overdue task list, multiple date groups |
| f10 | Tasks → Overdue (267) tab | Same list, "Clicked" tooltip on avatar |
| f11 | Tasks → Overdue + "Clear Overdue Tasks" confirmation dialog | Destructive confirmation modal open |
| f12 | Tasks → Overdue (267) tab | Dialog dismissed, list returns |

---

## 1. GLOBAL CHROME (all pages)

### 1.1 Top Navigation Bar
- Dark navy/charcoal background (#1a1c1e approximately)
- Height: ~48px
- Logo: FUB "starburst" icon at far left (white icon inside dark circle or standalone)
- Nav items left-to-right (icon + label, horizontal): **People** | **Inbox** | **Tasks** | **Calendar** | **Deals** | **Reporting** | **Admin**
  - Active item: slightly lighter text or underline indicator
  - Calendar active in f02–f07; Tasks active in f08–f12
- Right cluster (icon buttons, no labels):
  - Square grid / compose icon (email/compose)
  - Chat bubble icon (messages)
  - Person-plus icon (add contact or notifications)
  - Bell icon (notifications)
  - Avatar / profile photo (circular, current user)
- Search bar: center of nav, rounded pill input, placeholder "Search", magnifier icon, medium width
- Trial banner (bottom of page, NOT top nav): orange/teal gradient bar with "You have 14 days left on your trial" + "Upgrade Now" button (visible f02, f03, f04)

### 1.2 Bottom Trial Banner
- Full-width bar, fixed at bottom
- Text: "You have 14 days left on your trial" (left)
- "Upgrade Now" button (right, white text on darker background)
- Present in f02, f03, f04, f08

---

## 2. CALENDAR — DAY VIEW (f02)

### 2.1 Page Layout
Two-panel layout:
- **Left sidebar** (~220px wide, white/light bg)
- **Main calendar area** (flex-grows to fill remaining width)

### 2.2 Left Sidebar

#### Mini-Calendar
- Header row: "**June 2026**" (bold) + left-arrow (◀) + right-arrow (▶) navigation
- Weekday header row: Su  Mo  Tu  We  Th  Fr  Sa (7 columns, abbreviated)
- Date grid: standard month grid, 6 rows × 7 columns
  - Grayed-out dates from previous/next months rendered at lower opacity
  - Dates from current month: normal weight
  - **Today (30)**: filled circle highlight (dark navy/primary color), white text
  - Clickable dates navigate the main view
  - Row example: 28  29  **30**  1  2  3  4 (row containing today)

#### Schedule / Filters Toggle
- Two-tab pill below the mini-calendar: "**Schedule**" (left, default active) | "**Filters**" (right)
- Active tab: white bg with border; inactive: gray text

#### Upcoming Schedule Panel
- Label: "**Today, Jun 30**" (bold, dark)
  - Event chip: "Ryan Realty RBN License Renewal Due" — rendered as a small rounded pill in teal/blue, white text
- Label: "**Tomorrow, Jul 1**" (bold, dark)
  - Text: "No events, " + "add appointment" (hyperlink in teal, underlined)

### 2.3 Main Area Toolbar
- Left: "**June 2026**" (h2 heading, bold)
- Center: View toggle tabs: **Day** | **Week** | **Month** — pill/tab style; active tab has darker fill
- Right cluster:
  - **◀** (prev day) button
  - "**Today**" button (outlined)
  - **▶** (next day) button
  - "**Everyone**" dropdown (agent filter, with chevron ▼) — filters events by assigned agent
  - "**+**" button (teal/blue circle, white plus) — creates new appointment

### 2.4 Day View Grid Structure

#### Date Header Row
- Single column, centered label: "**Tuesday 30**" with a teal underline (current-day indicator)

#### All Day Row
- Fixed row above the time grid
- Left label column: "**All Day**" (small gray label, vertically centered)
- Right event area: spans full width
  - Event chip rendered here for all-day events: full-width blue/teal bar
  - Content: "Ryan Realty RBN License Renewal Due" — white text, solid fill
  - This event has a slightly darker left border (3px accent border)

#### Time Grid
- Left column: time labels, right-aligned, small gray text
  - Labels visible (top to bottom): **7am**, **8am**, **9am**, **10am**, **11am**, **12pm**, **1pm**, **2pm**, **3pm**, **4pm**, **5pm** (can scroll to earlier/later)
  - Each hour gets one row; each row is divided into 30-min slots via a lighter dashed line at :30
- Right column: event area for the selected day
  - No timed events visible on Jun 30 in these frames
  - **Current time indicator**: dashed horizontal line at approximately 4pm (today's current time marker)
- The time label column is fixed-width (~50px); event area fills remaining width

---

## 3. CALENDAR — WEEK VIEW (f05, f07)

### 3.1 Layout Difference from Day View
- Same left sidebar (identical)
- Same toolbar (Week tab active)
- Main area expands to 7 columns

### 3.2 Week Column Headers
One row of day-of-week + date labels:
| Col | Label | Notes |
|-----|-------|-------|
| 1 | Sun 28 | prior month date (grayed) |
| 2 | Mon 29 | prior month date (grayed) |
| 3 | **Tue 30** | **Today** — column has teal/light-blue fill background |
| 4 | Wed 1 | next month |
| 5 | Thu 2 | next month |
| 6 | Fri 3 | next month |
| 7 | Sat 4 | next month |

- Today's column (Tue 30) has a continuous vertical teal background tint extending through the All Day row and time grid
- Day labels: abbreviated day name + date number, centered above each column

### 3.3 All Day Row
- Label column (left, fixed): "**All Day**" in gray
- 7 day columns: only Tue 30 column has an event
  - Event: "Ryan Realty RBN License R..." (truncated) — rendered as a blue/teal chip filling the Tue 30 column width

### 3.4 Time Grid
- Same hour labels as Day view
- 7 sub-columns, one per day
- Grid lines: horizontal (per hour) + vertical (per day column)
- No timed events visible in this week
- Current time dashed line at ~4pm visible across the Tue 30 column

---

## 4. CREATE APPOINTMENT MODAL (f03, f04)

### 4.1 Modal Container
- Triggered by: clicking the "+" button in the toolbar, or clicking "add appointment" in the sidebar, or clicking an empty time slot in the grid
- Modal appears anchored to right side of screen (or center-right), width ~420px, no max-height constraint visible (scrollable if needed)
- Background: white, rounded corners (~8px), drop shadow overlay
- Overlay behind modal: gray semi-transparent backdrop covering the calendar

### 4.2 Modal Header
- "**Create Appointment**" — H2 or H3 bold text, left-aligned
- "**×**" close button — top-right corner (gray ×, no border)

### 4.3 Field: Title
- Row: pencil/edit icon (gray, left) + text input (full width)
- Placeholder: "Add title"
- No label; icon serves as affordance
- Single-line text input

### 4.4 Field: Date & Time
- Row: clock icon (gray, left)
- **Start date** input: "06/30/2026" — date picker (MM/DD/YYYY format)
- **Start time** input: "5:00 pm" — time picker (12-hour format with am/pm)
- "**to**" separator text (gray, between start and end time)
- **End time** input: "5:30 pm" — time picker
- **End date** input: "06/30/2026" — shown in f03_q2 to the right of end time
- **All day event** checkbox:
  - Unchecked state (f03): empty square checkbox + label "All day event"
  - Checked state (f04): blue-filled checkbox with white checkmark + label "All day event"
  - When checked: time pickers collapse (only date fields remain); "All day event" behavior activates
- **Timezone**: dropdown selector (f03_q2) showing "Pacific Time (GMT-07:00)" with down chevron ▼
  - Appears below the date/time inputs, right-aligned

### 4.5 Field: Location
- Row: location-pin icon (gray, left) + text input (full width)
- Placeholder: "Add location"
- Single-line text input

### 4.6 Field: Guests
- Row: person/silhouette icon (gray, left) + text input + search magnifier icon (right)
- Placeholder: "Add guests"
- Supports type-ahead search
- Below input, pre-populated guest chip:
  - **Avatar**: "MR" initials circle (gray background, white text)
  - **Name**: "Matt Ryan" — the logged-in broker is pre-added as attendee/host
  - (No visible remove button in frames, but likely present on hover)

### 4.7 Field: Type (Appointment Type Dropdown)
- Row: tag/label icon (gray, left)
- **Left dropdown**: "Set type" placeholder with chevron ▼
  - **All visible options when open (f04)**:
    1. **No type** (default/clear selection)
    2. **Buyer consultation**
    3. **Listing**
  - Dropdown renders as a white panel overlaid below the trigger
  - Items are plain text, no icons; selected item gets a checkmark or highlight
  - NOTE: This is the COMPLETE list visible — only 3 options shown in the open state

### 4.8 Field: Outcome Dropdown
- **Right dropdown** (on same row as Type): "**No Outcome**" default value with chevron ▼
- In Edit mode this also shows "No Outcome" as default
- The full set of outcome options is NOT visible in any frame (dropdown never opened in these recordings); "No Outcome" is the placeholder/default

### 4.9 Field: Notes / Description (Rich Text Editor)
- Row: info/circle-i icon (gray, left)
- **Toolbar** (horizontal icon row):
  - **B** — Bold
  - **I** — Italic
  - **U** — Underline
  - **•≡** — Unordered / Bullet list
  - **1≡** — Ordered / Numbered list
  - **🔗** — Insert link
  - **⟨/⟩** or similar — second formatting option (appears to be a strikethrough or code/italic variant)
- **Rich text area**: multi-line, blank in Create mode; pre-filled in Edit mode
- Area height: ~5–6 lines visible, likely resizable or scrollable

### 4.10 Field: Send Reminder Checkbox
- Full-width row below notes
- Checkbox (unchecked by default) + label: "**Send invitation email & text reminder**"
- In Edit mode, label changes to: "**Send update email & text reminder**"

### 4.11 Submit Button
- Full-width blue/teal CTA button at modal bottom
- **Create mode label**: "**Create Appointment**"
- **Edit mode label**: "**Save Appointment**"
- Solid fill, white text, slightly rounded corners

### 4.12 Delete Button (Edit mode only)
- Small trash/bin icon at bottom-left of modal footer (to the left of the Save button)
- Only present in Edit Appointment modal, not Create

---

## 5. EDIT APPOINTMENT MODAL (f06)

### 5.1 Trigger
- Click on an existing event in the calendar grid (day or week view)
- First click shows a floating event detail popup; the Edit modal may open directly or via an "Edit" button within the popup

### 5.2 Event Detail Popup (floating card, f06)
A small floating card appears adjacent to the event position on the calendar:
- **Header**: event title (truncated) + Google Calendar sync icon (**G**, the Google colored logo) + **×** close button
- **Body**: first line(s) of notes text visible
- This card is separate from the Edit modal and appears to be the event preview before editing
- Google sync icon indicates this event was synced from/to Google Calendar

### 5.3 Modal Header
- "**Edit Appointment**" title
- "**×**" close button (top-right)

### 5.4 Pre-filled Field Values
All fields mirror the Create modal structure but with existing event data:

| Field | Value |
|-------|-------|
| Title | "Ryan Realty RBN License Renewal Due" |
| Start date | 06/30/2026 |
| End date | 06/30/2026 |
| All day event | ✅ CHECKED (blue checkmark) |
| Timezone | "Select time zone" dropdown (empty/placeholder; different from Create modal which shows detected timezone) |
| Location | "Add location" (empty) |
| Guests | Matt Ryan (pre-populated, portrait photo avatar — actual headshot, not initials) |
| Type | "Set type" (unset/empty) |
| Outcome | "No Outcome" (default) |

### 5.5 Notes Field — Pre-filled Content
Full text (readable from f06_q3 and f06_q4):
> "Ryan Realty LLC Registered Business Name License #201253677 expires. Renew through OREA eLicense portal at https://orea.elicense.micropact.com. This is the brokerage registration, not individual licenses. Must be renewed to continue operating Ryan Realty LLC."

- The URL "https://orea.elicense.micropact.com" appears as a clickable hyperlink (blue underlined text) within the rich text area

### 5.6 Footer
- Left: **trash icon** (delete button) — small, gray
- Right: "**Save Appointment**" button (full-width blue, but constrained to the right portion next to the trash icon)

---

## 6. TASKS — TODAY'S TASKS TAB (f08)

### 6.1 Page Structure
Three-tab sub-navigation row below the main nav bar:
- "**Today's Tasks**" (active) — no badge count; underlined with teal/blue bottom border
- "**Overdue (267)**" — badge "267" in parentheses; gray text when inactive
- "**Future**" — gray text when inactive

Top-right controls (same row as tabs, right-aligned):
- "**How Tasks work**" button — outlined/ghost button with circled-i info icon prefix; links to FUB help
- "**Filters**" dropdown — outlined button with chevron ▼; applies task filters
- "**Me**" dropdown — outlined button with chevron ▼; filters by agent (default: "Me" = current user)

### 6.2 Today's Tasks Empty State
- White card panel, rounded corners
- **Card header**: clock/time icon (teal, outlined) + "**Today's Tasks**" label
- **Empty state content** (centered in card):
  - Clock graphic icon (larger, gray, decorative)
  - Text: "**No tasks found, nice work!**" (gray, centered)

---

## 7. TASKS — OVERDUE TAB (f09, f10, f12)

### 7.1 Tab State
- "**Overdue (267)**" tab active, teal underline
- Badge count "267" appears in parentheses as plain text in the tab label (NOT a separate badge chip)

### 7.2 Section Header
- Full-width row above the task list:
  - Left: clock icon (teal) + "**Overdue Tasks**" heading (bold, dark)
  - Right: "**Clear My Overdue Tasks**" — text link (teal, no button border); destructive action

### 7.3 Date Group Structure
Tasks are grouped by date in **reverse chronological order** (most recent overdue at top):
- **Group header**: "**[Day], [Month] [Date] ([count])**" — e.g. "Tuesday, Jun 23 (2)"
  - Bold date string; count in parentheses shows how many tasks in this group

### 7.4 Individual Task Row Anatomy
Each task row contains (left to right):

```
[ □ ]  [ Avatar ]  [ Task Content Block ]  [ Time ]  [ ·· ]
```

1. **Checkbox** (leftmost): square checkbox, unchecked state; clicking marks task complete
2. **Avatar circle**: initials or contact photo
   - "MR" gray circle = Matt Ryan (assigned to Matt)
   - "S" teal/dark circle = first initial of contact name (e.g. "Scdvf")
   - In f09_q1: "MR" initials are white on gray background
3. **Task Content Block** (3 sub-rows):
   - Row A: **Contact name** (hyperlink, teal/blue, bold or medium weight) — e.g. "Matt Ryan", "Matthew Ryan", "Scdvf"
   - Row B: **Task description** with icon prefix:
     - Phone/receiver icon 📞 = call task
     - Text: "Lead returned to website. Follow up now." (most common)
     - Or: "Hot seller LP lead — call within 5 min: [contact name] ([Address, City, State ZIP, USA])"
   - Row C: **Assigned to** (person silhouette icon + name): "Me" (= current logged-in user)
4. **Time**: clock icon (small) + time string (e.g. "3:30pm", "8:26pm", "6:27am") — displayed at right
5. **·· (ellipsis/more-options)**: two dots ("··") at far right; per-row context menu trigger

### 7.5 Complete Task Interaction
- Clicking the checkbox on a task row marks it complete and removes it from the list
- No confirmation dialog for individual task completion

### 7.6 Full Overdue Task List (all visible date groups)

**Tuesday, Jun 23 (2)**
| # | Avatar | Contact | Description | Assigned | Time |
|---|--------|---------|-------------|----------|------|
| 1 | MR | Matt Ryan | 📞 Lead returned to website. Follow up now. | Me | 3:30pm |
| 2 | MR | Matthew Ryan | 📞 Lead returned to website. Follow up now. | Me | 8:26pm |

**Monday, Jun 22 (1)**
| # | Avatar | Contact | Description | Assigned | Time |
|---|--------|---------|-------------|----------|------|
| 1 | MR | Matthew Ryan | 📞 Lead returned to website. Follow up now. | Me | 6:27am |

**Friday, Jun 19 (3)**
| # | Avatar | Contact | Description | Assigned | Time |
|---|--------|---------|-------------|----------|------|
| 1 | MR | Matthew Ryan | 📞 Lead returned to website. Follow up now. | Me | 6:55am |
| 2 | MR | Matthew Ryan | 📞 Lead returned to website. Follow up now. | Me | 2:57pm |
| 3 | MR | Matthew Ryan | 📞 Lead returned to website. Follow up now. | Me | 6:15pm |

**Wednesday, Jun 17 (2)**
| # | Avatar | Contact | Description | Assigned | Time |
|---|--------|---------|-------------|----------|------|
| 1 | MR | Matthew Ryan | 📞 Lead returned to website. Follow up now. | Me | 9:50am |
| 2 | MR | Matt Ryan | 📞 Lead returned to website. Follow up now. | Me | 5:20pm |

**Monday, Jun 15 (2)** (partially visible)
| # | Avatar | Contact | Description | Assigned | Time |
|---|--------|---------|-------------|----------|------|
| 1 | S | Scdvf | 📞 Hot seller LP lead — call within 5 min: scdvf (Arid Ave, Oregon 97703, USA) | Me | 11:22am |
| 2 | MR | (Matthew Ryan, partially cut off) | 📞 ... | Me | 5:4?pm |

Note: "Matt Ryan" vs "Matthew Ryan" in the contact name column reflects two different contacts in FUB (the broker Matt Ryan and a lead named "Matthew Ryan" or a duplicate).

### 7.7 Auto-Generated Task Types Observed
From the task descriptions:
1. **"Lead returned to website. Follow up now."** — the most common; auto-generated when a known lead returns to the website (website revisit trigger). Task type: phone call.
2. **"Hot seller LP lead — call within 5 min: [contact] ([address])"** — urgent auto-generated task from seller landing page form submission. Task type: phone call, high priority (5-minute SLA).

### 7.8 Task Row Hover / Quick Follow-Up
The "··" (two-dot) element at the far right of each task row is the quick-action / context menu trigger. While no frame shows it opened, based on FUB's standard UX this likely contains:
- Quick Follow-Up option (reschedule/create a follow-up task)
- Edit task
- Reassign
- Delete / Remove

The phone icon prefix on task descriptions signals these are specifically **call tasks** (the most common quick follow-up action type in FUB).

---

## 8. CLEAR OVERDUE TASKS DIALOG (f11)

### 8.1 Trigger
"Clear My Overdue Tasks" text link in the Overdue Tasks section header.

### 8.2 Modal Layout
- Centered modal over the tasks list
- Backdrop: semi-transparent gray overlay (tasks list still partially visible behind)
- Modal width: ~420px; no scroll needed (compact)

### 8.3 Modal Header
- Title: "**Clear Overdue Tasks**" (bold, dark)
- "**×**" close button (top-right)

### 8.4 Modal Body
Text (exact, from f11_q1 and f11_q2):
> "There is no undo, are you sure you want to clear **your** overdue tasks?"

- "your" appears to be emphasized (this is the possessive clarifier — it deletes only the current user's overdue tasks, filtered by the "Me" selector active in the tab toolbar)

### 8.5 Modal Footer — Buttons
- **Cancel** (left): gray text link or outlined button; dismisses dialog without action
- **Yes, delete all tasks** (right): red/orange-red solid button with white text; executes the bulk delete

### 8.6 Behavior
- Destructive and immediate: "There is no undo"
- Scope: deletes overdue tasks belonging to the currently filtered agent ("your" = Me = current user)
- After confirmation: all tasks in the Overdue list for this user are deleted; list returns to empty state

---

## 9. COMPONENT TREE (React / responsive-web rebuild)

### 9.1 Calendar Page

```tsx
<CalendarPage>
  <LeftSidebar>
    <MiniCalendar
      month={6} year={2026}
      selectedDate={30}
      onPrev={() => navigate(-1 month)}
      onNext={() => navigate(+1 month)}
      onDateClick={(date) => setMainViewDate(date)}
    >
      <MonthYearHeader />         // "June 2026" + prev/next arrows
      <WeekdayLabels />           // Su Mo Tu We Th Fr Sa
      <DateGrid>
        <DateCell
          v-for="day in month"
          isToday={day === 30}     // filled circle highlight
          isSelected={day === selectedDay}
          isAdjacentMonth={...}   // lower opacity
        />
      </DateGrid>
    </MiniCalendar>

    <ScheduleFiltersTabs>
      <Tab id="schedule" active>Schedule</Tab>
      <Tab id="filters">Filters</Tab>
    </ScheduleFiltersTabs>

    <UpcomingSchedulePanel>
      <DaySection label="Today, Jun 30">
        <EventChip color="teal">Ryan Realty RBN License Renewal Due</EventChip>
      </DaySection>
      <DaySection label="Tomorrow, Jul 1">
        <NoEventsRow>
          No events, <AddAppointmentLink />
        </NoEventsRow>
      </DaySection>
    </UpcomingSchedulePanel>
  </LeftSidebar>

  <MainCalendarArea>
    <CalendarToolbar>
      <MonthYearHeading>June 2026</MonthYearHeading>
      <ViewToggle value="week">
        <ViewTab value="day">Day</ViewTab>
        <ViewTab value="week">Week</ViewTab>
        <ViewTab value="month">Month</ViewTab>
      </ViewToggle>
      <NavigationRow>
        <PrevButton />
        <TodayButton />
        <NextButton />
      </NavigationRow>
      <AgentFilterDropdown defaultValue="Everyone" />
      <AddButton onClick={openCreateModal} />
    </CalendarToolbar>

    {view === 'day' && (
      <DayViewGrid date={selectedDate}>
        <DayColumnHeader date="Tuesday 30" isToday />
        <AllDayRow>
          <AllDayLabel />
          <AllDayEventArea>
            {allDayEvents.map(e => <AllDayEventChip event={e} />)}
          </AllDayEventArea>
        </AllDayRow>
        <TimeGrid>
          {hours.map(h => (
            <HourRow key={h}>
              <TimeLabel>{h}</TimeLabel>   // "7am", "8am" etc
              <HourEventArea hour={h}>
                {timedEvents.filter(e => e.hour === h).map(e => <EventChip event={e} />)}
              </HourEventArea>
            </HourRow>
          ))}
          <CurrentTimeIndicator style={{ top: calcTopOffset(now) }} />
        </TimeGrid>
      </DayViewGrid>
    )}

    {view === 'week' && (
      <WeekViewGrid weekStart={weekStart}>
        <WeekDayHeaders>
          {weekDays.map(d => (
            <DayHeader
              key={d}
              day={d.shortName}     // "Sun", "Mon" etc
              date={d.date}         // 28, 29, 30 etc
              isToday={d.isToday}   // triggers teal column fill
            />
          ))}
        </WeekDayHeaders>
        <AllDayRow>
          <AllDayLabel />
          {weekDays.map(d => (
            <AllDayEventCell key={d} isToday={d.isToday}>
              {allDayEventsForDay(d).map(e => <AllDayEventChip event={e} />)}
            </AllDayEventCell>
          ))}
        </AllDayRow>
        <TimeGrid>
          {hours.map(h => (
            <HourRow key={h}>
              <TimeLabel>{h}</TimeLabel>
              {weekDays.map(d => (
                <DayHourCell key={d} isToday={d.isToday}>
                  {timedEventsForDayHour(d, h).map(e => <EventChip event={e} />)}
                </DayHourCell>
              ))}
            </HourRow>
          ))}
        </TimeGrid>
      </WeekViewGrid>
    )}
  </MainCalendarArea>

  {createModalOpen && <AppointmentModal mode="create" />}
  {editModalOpen && <AppointmentModal mode="edit" event={selectedEvent} />}
</CalendarPage>
```

### 9.2 Appointment Modal (Create / Edit)

```tsx
<AppointmentModal
  mode="create" | "edit"
  event={existingEvent | undefined}
  onClose={() => setModalOpen(false)}
  onSave={(data) => saveAppointment(data)}
  onDelete={() => deleteAppointment(event.id)}   // edit mode only
>
  <ModalOverlay>
    <ModalPanel width={420}>
      <ModalHeader>
        <ModalTitle>{mode === 'create' ? 'Create Appointment' : 'Edit Appointment'}</ModalTitle>
        <CloseButton />
      </ModalHeader>

      <ModalBody>
        {/* Row 1: Title */}
        <FormRow icon={<PencilIcon />}>
          <TextInput
            placeholder="Add title"
            value={form.title}
            onChange={v => setForm({...form, title: v})}
          />
        </FormRow>

        {/* Row 2: Date & Time */}
        <FormRow icon={<ClockIcon />}>
          <DatePicker
            value={form.startDate}      // MM/DD/YYYY
            onChange={v => setForm({...form, startDate: v})}
          />
          {!form.allDay && (
            <TimePicker
              value={form.startTime}    // "5:00 pm"
              onChange={v => setForm({...form, startTime: v})}
            />
          )}
          <Separator>to</Separator>
          {!form.allDay && (
            <TimePicker
              value={form.endTime}      // "5:30 pm"
              onChange={v => setForm({...form, endTime: v})}
            />
          )}
          <DatePicker
            value={form.endDate}
            onChange={v => setForm({...form, endDate: v})}
          />
          <AllDayCheckbox
            label="All day event"
            checked={form.allDay}
            onChange={v => setForm({...form, allDay: v})}
          />
          <TimezoneSelect
            value={form.timezone}       // "Pacific Time (GMT-07:00)"
            placeholder="Select time zone"
          />
        </FormRow>

        {/* Row 3: Location */}
        <FormRow icon={<LocationPinIcon />}>
          <TextInput
            placeholder="Add location"
            value={form.location}
          />
        </FormRow>

        {/* Row 4: Guests */}
        <FormRow icon={<PersonAddIcon />}>
          <GuestSearchInput
            placeholder="Add guests"
            onSelect={(guest) => addGuest(guest)}
          />
          {form.guests.map(g => (
            <GuestChip key={g.id} avatar={g.initials} name={g.name} />
          ))}
        </FormRow>

        {/* Row 5: Type + Outcome */}
        <FormRow icon={<TagIcon />}>
          <Select
            placeholder="Set type"
            value={form.type}
            options={[
              { value: null, label: 'No type' },
              { value: 'buyer_consultation', label: 'Buyer consultation' },
              { value: 'listing', label: 'Listing' },
            ]}
          />
          <Select
            defaultValue="no_outcome"
            value={form.outcome}
            options={[
              { value: 'no_outcome', label: 'No Outcome' },
              // additional options (not visible in frames)
            ]}
          />
        </FormRow>

        {/* Row 6: Notes (Rich Text) */}
        <FormRow icon={<InfoCircleIcon />}>
          <RichTextEditor
            toolbar={['bold','italic','underline','bulletList','orderedList','link','format']}
            value={form.notes}
            onChange={v => setForm({...form, notes: v})}
          />
        </FormRow>

        {/* Row 7: Send reminder */}
        <CheckboxRow>
          <Checkbox
            checked={form.sendReminder}
            onChange={v => setForm({...form, sendReminder: v})}
          />
          <CheckboxLabel>
            {mode === 'create'
              ? 'Send invitation email & text reminder'
              : 'Send update email & text reminder'}
          </CheckboxLabel>
        </CheckboxRow>
      </ModalBody>

      <ModalFooter>
        {mode === 'edit' && (
          <DeleteIconButton
            icon={<TrashIcon />}
            onClick={() => onDelete()}
          />
        )}
        <PrimaryButton onClick={() => onSave(form)} fullWidth>
          {mode === 'create' ? 'Create Appointment' : 'Save Appointment'}
        </PrimaryButton>
      </ModalFooter>
    </ModalPanel>
  </ModalOverlay>
</AppointmentModal>
```

### 9.3 Tasks Page

```tsx
<TasksPage>
  <TasksSubNav>
    <NavTab id="today" active={tab === 'today'}>Today's Tasks</NavTab>
    <NavTab id="overdue" active={tab === 'overdue'}>Overdue (267)</NavTab>
    <NavTab id="future" active={tab === 'future'}>Future</NavTab>

    <NavControls>
      <HowTasksWorkButton icon={<InfoCircleIcon />}>How Tasks work</HowTasksWorkButton>
      <FiltersDropdown />
      <AgentDropdown defaultValue="Me" />
    </NavControls>
  </TasksSubNav>

  {tab === 'today' && (
    <TodayTasksView>
      <TaskSection>
        <SectionHeader>
          <ClockIcon />
          <span>Today's Tasks</span>
        </SectionHeader>
        {tasks.length === 0 && (
          <EmptyState>
            <ClockIllustration />
            <p>No tasks found, nice work!</p>
          </EmptyState>
        )}
        {tasks.map(t => <TaskRow task={t} />)}
      </TaskSection>
    </TodayTasksView>
  )}

  {tab === 'overdue' && (
    <OverdueTasksView>
      <OverdueSectionHeader>
        <ClockIcon />
        <span>Overdue Tasks</span>
        <ClearOverdueLink onClick={() => setClearDialogOpen(true)}>
          Clear My Overdue Tasks
        </ClearOverdueLink>
      </OverdueSectionHeader>

      {groupedByDate.map(group => (
        <DateGroup key={group.date}>
          <DateGroupHeader>
            {group.label}  {/* "Tuesday, Jun 23 (2)" */}
          </DateGroupHeader>
          {group.tasks.map(t => <TaskRow task={t} />)}
        </DateGroup>
      ))}

      {clearDialogOpen && (
        <ClearOverdueDialog
          onCancel={() => setClearDialogOpen(false)}
          onConfirm={() => { clearAllOverdueTasks(); setClearDialogOpen(false); }}
        />
      )}
    </OverdueTasksView>
  )}

  {tab === 'future' && (
    <FutureTasksView>
      {/* Not captured in frames */}
    </FutureTasksView>
  )}
</TasksPage>

// Individual Task Row
<TaskRow task={task}>
  <Checkbox
    checked={task.completed}
    onChange={() => completeTask(task.id)}
  />
  <ContactAvatar
    initials={task.contact.initials}
    color={task.contact.avatarColor}
  />
  <TaskContent>
    <ContactNameLink href={`/people/${task.contact.id}`}>
      {task.contact.name}
    </ContactNameLink>
    <TaskDescription>
      <TaskTypeIcon type={task.type} />  {/* phone icon for call tasks */}
      {task.description}
    </TaskDescription>
    <AssignedTo>
      <PersonIcon />
      {task.assignedTo === currentUser.id ? 'Me' : task.assignedTo.name}
    </AssignedTo>
  </TaskContent>
  <TaskTime>
    <ClockIcon />
    {task.scheduledTime}  {/* "3:30pm" */}
  </TaskTime>
  <RowActionsMenu trigger="··" />
</TaskRow>

// Clear Overdue Tasks Dialog
<ConfirmDialog>
  <DialogHeader>
    <DialogTitle>Clear Overdue Tasks</DialogTitle>
    <CloseButton />
  </DialogHeader>
  <DialogBody>
    <p>There is no undo, are you sure you want to clear <strong>your</strong> overdue tasks?</p>
  </DialogBody>
  <DialogFooter>
    <GhostButton onClick={onCancel}>Cancel</GhostButton>
    <DangerButton onClick={onConfirm}>Yes, delete all tasks</DangerButton>
  </DialogFooter>
</ConfirmDialog>
```

---

## 10. EXACT TEXT TRANSCRIPTIONS

### All-Day Event Label
`Ryan Realty RBN License Renewal Due`

### Sidebar Schedule Panel
- `Today, Jun 30`
- `Ryan Realty RBN License Renewal Due` (chip)
- `Tomorrow, Jul 1`
- `No events, add appointment`

### Create Appointment Modal — Field Labels
- Title placeholder: `Add title`
- Start date: `06/30/2026`
- Start time: `5:00 pm`
- Separator: `to`
- End time: `5:30 pm`
- End date: `06/30/2026`
- All day label: `All day event`
- Timezone: `Pacific Time (GMT-07:00)`
- Location placeholder: `Add location`
- Guests placeholder: `Add guests`
- Guest chip: `Matt Ryan`
- Type placeholder: `Set type`
- Outcome default: `No Outcome`
- Reminder checkbox: `Send invitation email & text reminder`
- Submit: `Create Appointment`

### Type Dropdown — Full Options List
1. `No type`
2. `Buyer consultation`
3. `Listing`

### Edit Appointment Modal — Field Differences from Create
- Header: `Edit Appointment`
- Title value: `Ryan Realty RBN License Renewal Due`
- All day: checked
- Timezone placeholder: `Select time zone` (instead of showing detected timezone)
- Reminder checkbox: `Send update email & text reminder`
- Submit: `Save Appointment`
- Notes body text (full):
  `Ryan Realty LLC Registered Business Name License #201253677 expires. Renew through OREA eLicense portal at https://orea.elicense.micropact.com. This is the brokerage registration, not individual licenses. Must be renewed to continue operating Ryan Realty LLC.`

### Edit Appointment — Floating Event Popup Header
`[event title truncated]...icense Renewal  [G icon]  [× close]`
(G = Google Calendar sync indicator)

### Tasks Page — Tab Labels
- `Today's Tasks` (no badge)
- `Overdue (267)` (count embedded in label string)
- `Future` (no badge)

### Tasks Toolbar Controls
- `How Tasks work` (with ⓘ icon)
- `Filters` (with ▼)
- `Me` (with ▼)

### Today's Tasks Empty State
- Section heading: `Today's Tasks`
- Empty message: `No tasks found, nice work!`

### Overdue Tasks Section
- Heading: `Overdue Tasks`
- Clear link: `Clear My Overdue Tasks`

### Task Description Text (observed)
1. `Lead returned to website. Follow up now.`
2. `Hot seller LP lead — call within 5 min: scdvf (Arid Ave, Oregon 97703, USA)`

### Clear Overdue Tasks Dialog
- Title: `Clear Overdue Tasks`
- Body: `There is no undo, are you sure you want to clear your overdue tasks?`
- Cancel button: `Cancel`
- Confirm button: `Yes, delete all tasks`

---

## 11. VISUAL DESIGN TOKENS (observed)

| Element | Value |
|---------|-------|
| Primary action color | Teal/blue (~#2196F3 or FUB teal, approximately #35A7BE) |
| Danger button color | Red-orange (~#E53935 or similar) |
| Nav background | Dark charcoal/navy (#1a1c1e area) |
| Sidebar background | White or very light gray |
| Today column tint (week view) | Light teal fill (~rgba(53, 167, 190, 0.08)) |
| Today date circle | Filled primary circle, white text |
| Task description icon | Phone receiver glyph, teal color |
| Avatar: initials bg | Medium gray |
| Avatar: teal contact | Teal/dark, white initial |
| Checkbox: checked | Blue fill (#2196F3 area) + white checkmark |
| Checkbox: unchecked | Empty square border |
| Time display | Gray small text, clock icon prefix |
| Row actions "··" | Gray two-dot ellipsis |
| Section header icon | Teal clock/time icon |
| Empty state icon | Light gray clock illustration |
| Event chip (calendar) | Blue/teal fill, white text, slight darker left border |
| All-day row | Fixed-height band, gray "All Day" label left |
| Current time indicator | Dashed horizontal line across event area |
| Modal overlay | Semi-transparent gray backdrop |
| Modal card | White, rounded corners ~8px, drop shadow |

---

## 12. BEHAVIORAL NOTES & EDGE CASES

### Calendar Navigation
- Clicking a date in the mini-calendar updates the main grid to show that date/week
- "Today" button always returns to current date
- "Everyone" dropdown (agent filter) scopes displayed events to selected broker(s)
- "+" FAB opens Create Appointment modal with date/time pre-filled based on click position in time grid

### All-Day Events
- Rendered in separate band above time grid in both Day and Week views
- Week view: shows only in the column for the applicable day
- Clicking opens the event detail popup, then Edit modal

### All-Day Toggle in Modal
- When "All day event" is checked: time pickers (start time, end time) disappear; only date pickers remain
- End date defaults to same as start date for single-day all-day events

### Timezone Handling
- Create modal: auto-detects and shows "Pacific Time (GMT-07:00)" with a selectable dropdown
- Edit modal: shows "Select time zone" placeholder (existing timezone may be stored separately; the edit form re-prompts)

### Google Calendar Sync
- Events synced from Google Calendar show a Google "G" logo icon in the event detail popup
- Indicates bidirectional sync is active for Matt's calendar

### Task Completion
- Checkbox on left of task row = mark complete
- Single click; no confirm dialog; immediate removal from list
- Count in "Overdue (267)" tab badge decrements accordingly

### Task Row Context Menu ("··")
- Present on every task row (right edge)
- Contents not captured in frames; likely includes: Complete, Reschedule, Reassign, Quick Follow-Up, Delete
- "Quick Follow-Up" selector (per target spec) is inferred to live here — it likely offers task type options (Call, Email, Text) when creating a follow-up from within a task

### Clear Overdue Tasks
- Scoped to "My" (current user's) overdue tasks (confirmed by "your overdue tasks" in dialog body)
- The "Me" filter in the toolbar and the "Clear My Overdue Tasks" label both confirm per-agent scoping
- No undo after confirmation ("There is no undo")
- Destructive button labeled "Yes, delete all tasks" in red/danger color

### Task Auto-Generation
- "Lead returned to website. Follow up now." tasks are auto-created by FUB when a known lead revisits the website
- "Hot seller LP lead — call within 5 min" tasks are auto-created when a seller lead form is submitted (likely from FUB automation or webhook integration)
- Both are call-type tasks (phone icon)

### Agent Attribution in Tasks
- "Me" assignment shown in task rows = current logged-in user (Matt)
- The "Me" dropdown in the toolbar filters the task list to show only tasks assigned to the selected agent
- "MR" avatar in task rows indicates tasks associated with contacts assigned to Matt Ryan

---

## 13. GAPS / NOT VISIBLE IN FRAMES

These items are specified as targets but were not captured in these 12 frames:

| Gap | Status |
|-----|--------|
| Month view grid layout | Not shown (Day and Week only) |
| Week view with timed (non-all-day) events | No timed events exist in this week |
| Outcome dropdown options (full list) | Only "No Outcome" default visible |
| Task row "··" context menu open state | Never opened in frames |
| Quick Follow-Up task selector UI | Not captured (inferred to live in "··" menu) |
| Future tab content | Not navigated to |
| Filters panel (when "Filters" tab active in sidebar) | Not opened |
| Creating a task manually (not auto-generated) | Not shown |
| Task completion animation | Not captured |
| Calendar month view | Not shown |
| Scrolling the time grid to earlier hours | Not shown |
| Clicking a time slot to create appointment | Not shown (only "+" button was used) |
| Outcome dropdown opened | Not shown |
| Guest search / autocomplete in action | Not shown |

---

*End of cal-tasks.md*
