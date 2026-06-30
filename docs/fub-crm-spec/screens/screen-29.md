<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.26.22 AM.png | Sequential id: shot-29 | Tiles: fub-tiles/shot-29_{full,q1,q2,q3,q4}.png -->

# shot-29 — Tasks: Overdue Tab

## Identity

- **Visible URL:** `ryan-realty.followupboss.com/2/tasks/overdue`
- **Browser tab title:** "Overdue Tasks - Follow Up B..." (truncated)
- **Active top-nav item:** Tasks (bold weight, visually distinct from siblings)
- **Active sub-tab:** "Overdue (268)" — underlined in blue, indicating the current view
- **Other sub-tabs visible:** "Today's Tasks" | "Overdue (268)" | "Future"
- **Breadcrumbs:** None; page stands alone under Tasks
- **Logged-in user:** Matt Ryan (headshot avatar, circular, top-right of FUB top bar; dropdown caret beside it)
- **Account/brokerage name:** Ryan Realty (visible in Chrome bookmarks bar as a favicon label; FUB account is "ryan-realty.followupboss.com")

---

## Layout

The screen uses a standard FUB three-zone vertical stack with no right sidebar active:

```
┌──────────────────────────────────────────────────────────────┐
│  Chrome browser chrome (tab bar + address bar + bookmarks)   │
├──────────────────────────────────────────────────────────────┤
│  FUB Top Nav Bar (dark ~#2d3748 / charcoal)                  │
│  [People] [Inbox🔴] [Tasks] [Calendar] [Deals] [Reporting]   │
│  [Admin]                      [Search field]    [icons+avatar]│
├──────────────────────────────────────────────────────────────┤
│  Sub-tab bar (white/light gray)                               │
│  [Today's Tasks] [Overdue (268)▲] [Future]                   │
│                               [How Tasks work] [Filters▾][Me▾]│
├─────────────────────────────────┬────────────────────────────┤
│  LEFT REGION (empty / ~45% wide)│  CENTER-RIGHT TASK LIST    │
│  Gray background (#f3f4f6 approx)│  (~55% wide, white bg)    │
│                                 │  ┌──────────────────────┐  │
│                                 │  │ 🕐 Overdue Tasks      │  │
│                                 │  │ [Clear My Overdue... ]│  │
│                                 │  │ ──────────────────── │  │
│                                 │  │ Date group header    │  │
│                                 │  │ Task row             │  │
│                                 │  │ Task row             │  │
│                                 │  │ ...                  │  │
│                                 │  └──────────────────────┘  │
├─────────────────────────────────┴────────────────────────────┤
│  [?] Help button (floating, bottom-right corner)              │
└──────────────────────────────────────────────────────────────┘
```

**Proportions:**
- Top nav bar: ~48px tall, full width, dark charcoal background
- Sub-tab bar: ~40px tall, white/light background
- Sub-tab toolbar row (right side controls): same horizontal level, right-aligned
- Left region: approximately 40–45% of viewport width, medium gray background, no content visible (this is likely a left panel that would show task details or a people list when a task is selected, currently empty/idle state)
- Task list column: approximately 55–60% of viewport width, white background, scrollable
- The task list is vertically scrollable; the visible portion shows dates from Jun 23 down to at least Jun 15

**Fixed vs scrolling:**
- Top nav bar: fixed (sticky)
- Sub-tab bar + toolbar row: fixed (sticky beneath top nav)
- Task list content area: scrollable vertically
- Left region: fixed (no scroll content visible)

---

## Every UI Element (exhaustive)

### Chrome Browser Chrome
- Address bar: `ryan-realty.followupboss.com/2/tasks/overdue`
- Tab: "Overdue Tasks - Follow Up B..." with FUB favicon (orange/red circle)
- Bookmarks bar (partial): "Son's UH business...", "Claude", "CRM mobile UI redesi...", "Lindsay mail form...", "Application cost an...", then various favicons (grid icon, and many others), "Inbox" favicon label, "CEAR", "Ryan Realty", then overflow ">>" and "All Bookmarks" folder

### FUB Top Navigation Bar (dark charcoal, full width)

**Left side — primary nav items (horizontal, spaced):**
| Item | Icon | State | Badge |
|---|---|---|---|
| People | person/silhouette icon | inactive | none |
| Inbox | speech bubble with notification dot | inactive | red dot (unread count) |
| Tasks | list/checklist icon | **ACTIVE** (bold) | none |
| Calendar | calendar grid icon | inactive | none |
| Deals | handshake or building icon | inactive | none |
| Reporting | bar chart icon | inactive | none |
| Admin | gear/settings icon | inactive | none |

**Center — Search field:**
- Rounded pill input, placeholder text: "Search"
- Light/white background, approximately 200px wide
- Magnifying glass icon on left of field

**Right side — action icons (circular colored buttons):**
- Email envelope icon (teal/blue circle button) — compose email [INFERRED: opens email compose modal]
- Chat bubble icon (teal/blue circle button) — messaging/SMS [INFERRED]
- Person+ icon (teal/blue circle button) — add new lead/contact
- Bell icon (teal/blue circle button) with **red badge showing "1"** — notifications
- User avatar: circular photo of Matt Ryan (headshot, brown-skinned man in professional attire) with a small dropdown caret — user menu

### Sub-tab Bar

**Left side — tab group:**
- `Today's Tasks` — inactive (no underline, normal weight)
- `Overdue (268)` — **ACTIVE** (blue underline, blue text color for "Overdue"; badge "(268)" in blue/same color denotes count of overdue tasks)
- `Future` — inactive

**Right side — toolbar controls (right-aligned, same row or just below):**
- `ⓘ How Tasks work` — ghost/outline button with circle-i icon on left; clicking [INFERRED: opens a help popover or modal explaining the task system]
- `Filters ▾` — outline/ghost button with dropdown caret; clicking [INFERRED: opens a filter panel for task type, date range, contact stage, etc.]
- `Me ▾` — outline/ghost button with dropdown caret; currently scoped to logged-in user's tasks; clicking [INFERRED: opens agent selector dropdown to view tasks for other agents or all agents]

### Overdue Tasks Content Area

**Section header (top of task list):**
- Clock icon (outline, ~16px) + text `Overdue Tasks` — section heading, left-aligned, dark text
- `Clear My Overdue Tasks` — blue hyperlink text, right-aligned at same level — action to bulk-dismiss all overdue tasks for the current user

**Date group headers (dividers between chronological groups):**
Each date group is rendered as a plain text label at the left edge of the task list, using format: `[Day of week], [Month] [DD] ([count])`

Date groups visible (in descending order):
1. `Tuesday, Jun 23 (3)` — 3 tasks on this date
2. `Monday, Jun 22 (1)` — 1 task
3. `Friday, Jun 19 (3)` — 3 tasks
4. `Wednesday, Jun 17 (2)` — 2 tasks
5. `Monday, Jun 15 (2)` — 2 tasks (partially visible, scrolled out of frame at bottom)

**Individual Task Rows:**

Each task row contains the following sub-elements, left to right:

1. **Checkbox** — square unchecked checkbox on the far left; checking it [INFERRED: marks the task as complete and removes it from the overdue list]
2. **Contact avatar** — circular avatar, ~32–36px, showing the contact's initials in a muted blue-gray background (e.g., "MR" for Matthew Ryan / Matt Ryan); non-photo avatars use 2-letter initials. One contact ("Scdvf") has a tan/brown avatar.
3. **Contact name** — blue hyperlink text (e.g., `Matthew Ryan`, `Matt Ryan`, `Scdvf`); clicking navigates to the contact's detail record
4. **Task type icon + description:**
   - Green phone handset icon (indicating this is a **call task**)
   - Task description text: `Lead returned to website. Follow up now.` — this is the task note/title, displayed in dark gray body text
5. **Assigned agent:**
   - Person/silhouette icon (small, ~12px, muted gray) 
   - Text: `Me` — indicating the task is assigned to the logged-in user (Matt Ryan)
6. **Due time:**
   - Clock icon (small, ~12px) — positioned far right
   - Time text in gray: e.g., `12:12pm`, `3:30pm`, `8:26pm`, `6:27am`, `6:55am`, `2:57pm`, `6:15pm`, `9:50am`, `5:20pm`, `11:22am`
7. **Expand/more icon:**
   - Small `»` or double-chevron icon at far right, below the time — [INFERRED: expands inline task details or opens a quick-action menu; may also indicate "more options" for this task]

**Divider lines:**
- Thin horizontal rule (~1px, light gray) between each task row

**Complete list of task rows visible (from top to bottom):**

| Date group | Contact name | Task description | Assigned to | Due time |
|---|---|---|---|---|
| Tue, Jun 23 (3) | Matthew Ryan | Lead returned to website. Follow up now. | Me | 12:12pm |
| Tue, Jun 23 (3) | Matt Ryan | Lead returned to website. Follow up now. | Me | 3:30pm |
| Tue, Jun 23 (3) | Matthew Ryan | Lead returned to website. Follow up now. | Me | 8:26pm |
| Mon, Jun 22 (1) | Matthew Ryan | Lead returned to website. Follow up now. | Me | 6:27am |
| Fri, Jun 19 (3) | Matthew Ryan | Lead returned to website. Follow up now. | Me | 6:55am |
| Fri, Jun 19 (3) | Matthew Ryan | Lead returned to website. Follow up now. | Me | 2:57pm |
| Fri, Jun 19 (3) | Matthew Ryan | Lead returned to website. Follow up now. | Me | 6:15pm |
| Wed, Jun 17 (2) | Matthew Ryan | Lead returned to website. Follow up now. | Me | 9:50am |
| Wed, Jun 17 (2) | Matt Ryan | Lead returned to website. Follow up now. | Me | 5:20pm |
| Mon, Jun 15 (2) | Scdvf | (partially visible, description truncated) | — | 11:22am |

**Note on "Matthew Ryan" vs "Matt Ryan":** These appear to be two separate contact records with similar names — one stored as "Matthew Ryan" and one as "Matt Ryan". Both have "MR" initials and the same gray-blue avatar color. This likely reflects a data quality issue in the CRM (duplicate contacts) rather than different individuals.

**Note on "Scdvf":** This appears to be a garbled/test contact name, visible at the bottom of the scroll with a tan/brown avatar color.

### Right Panel / Right Side
- The right ~40% of the viewport is a uniform medium gray background (`#e5e7eb` or similar) with no content — this region is either a split-panel detail view that is currently empty (no task selected), or a spacer that appears when no right panel is open.

### Floating Help Button
- Bottom-right corner: circle with `?` inside (teal/blue border outline button, ~40px diameter)
- [INFERRED: Opens the FUB help center or in-app support chat]

### Horizontal Scrollbar
- Thin horizontal scrollbar visible at very bottom of the task list content area, indicating the list column can scroll horizontally (or this is the browser scrollbar)

---

## Colors, Typography & Style

**Top nav bar background:** Very dark charcoal, approximately `#2d3748` or `#1a202c`
**Top nav text/icons:** White, inactive items slightly muted (~80% opacity)
**Active nav item:** Bold white text (Tasks)

**Sub-tab bar background:** White or very light gray (`#f8f9fa`)
**Active sub-tab:** Blue underline (~2px) + blue text color, approximately `#3b82f6` or FUB's brand blue `#1890ff` style
**Inactive sub-tabs:** Medium gray text, no underline

**Task list area background:** White (`#ffffff`)
**Left empty region background:** Light gray, approximately `#f3f4f6`

**Date group headers:** Dark gray text, normal weight, small font (~13px), uppercase or title case
**Contact name links:** FUB brand blue (same as active tab blue), ~14px, medium weight
**Task description text:** Dark gray (`#374151` approx), ~13–14px, normal weight
**Assigned-to text ("Me"):** Muted gray, ~12px
**Time text:** Muted gray (`#6b7280`), ~12px
**"Clear My Overdue Tasks" link:** FUB brand blue, ~13–14px, normal weight, no underline by default

**Contact avatars:** 
- Background: muted blue-gray (`#94a3b8` or `#8a9bb5`)
- Text: white initials, ~12–13px, medium weight, centered
- Shape: circle, ~32–36px diameter
- "Scdvf" contact: tan/brown avatar (`#b45309` approximate), suggesting avatar colors are assigned per contact (either randomly or based on a hash of the name)

**Checkboxes:**
- Square, ~14–16px, border: 1–2px solid gray (`#d1d5db`)
- Unchecked state: white fill
- Rounded corners: slight (2–4px)

**Buttons (sub-bar controls):**
- "How Tasks work", "Filters", "Me": ghost/outline style — thin border (~1px, gray `#d1d5db`), white background, dark gray text, rounded corners (~6px), ~32–36px tall, horizontal padding ~12px
- Hover state [INFERRED]: light gray background fill

**Row action icons:** Muted gray, ~12px; phone icon is green (to indicate call type)

**Divider lines between tasks:** 1px solid very light gray (`#f3f4f6`)

**Section heading "Overdue Tasks":** Medium dark text, ~15–16px, semi-bold

**Overall density:** Medium-compact. Each task row is approximately 56–64px tall, accommodating two lines of text (name + description) plus the assigned-to line.

**Iconography style:** Simple outline/line icons, ~14–16px, consistent with a Heroicons or similar icon set

**Bottom progress bar:** Not visible in this shot (no "Getting Started" progress bar present)

---

## State & Data Shown

**Active view:** Tasks > Overdue tab
**Task count badge:** 268 overdue tasks (shown in the "Overdue (268)" sub-tab)
**Current agent filter:** "Me" — showing only tasks assigned to the logged-in user (Matt Ryan)
**Additional filters:** None active (Filters button shows no active state indicator)

**Tasks visible on screen:** ~10 rows across 5 date groups (Jun 15 – Jun 23)

**Predominant task data pattern:**
- Task type: Call (green phone icon)
- Task note/description: "Lead returned to website. Follow up now." — identical across virtually all visible tasks, suggesting these are auto-generated by a FUB Action Plan or automation triggered by a website return visit event
- Assigned agent: "Me" (Matt Ryan) on all visible tasks
- Contact names: Primarily "Matthew Ryan" and "Matt Ryan" (likely test/self-contacts or duplicates), plus one garbled name "Scdvf" near the bottom

**Date range of overdue tasks visible:** Monday Jun 15 through Tuesday Jun 23 (current date at time of screenshot appears to be on or after Jun 23)

**Time formats shown:** 12-hour format with lowercase am/pm — e.g., `12:12pm`, `3:30pm`, `8:26pm`, `6:27am`, `6:55am`, `2:57pm`, `6:15pm`, `9:50am`, `5:20pm`, `11:22am`

---

## Interactions & Behaviors

- **Clicking contact name** (blue link): Navigates to the contact's person record page (`/people/<id>`) [INFERRED from FUB conventions]
- **Clicking checkbox**: Marks the individual task as complete; task is removed from the overdue list; completion may be logged to the contact's activity timeline [INFERRED]
- **Clicking "Clear My Overdue Tasks"** (blue link top-right of content): Bulk action — presents a confirmation modal or immediately marks all 268 of the current user's overdue tasks as complete/dismissed [INFERRED: likely a confirmation modal before bulk action]
- **Clicking "»" expand icon on a task row**: Inline expansion of the task row to show more detail (task notes, due date context, quick-action buttons like Call, Reschedule, etc.) or opens a right-panel detail view [INFERRED]
- **Clicking "Today's Tasks" tab**: Switches view to tasks due today, filtered for current day
- **Clicking "Future" tab**: Switches view to upcoming tasks scheduled beyond today
- **Clicking "Filters ▾"**: Opens a dropdown or modal filter panel with options such as: Task type (call/email/to-do), Date range, Contact stage, Pipeline, Tag filters [INFERRED]
- **Clicking "Me ▾"**: Opens a dropdown to select a different agent or "All" to see team-wide overdue tasks [INFERRED]
- **Clicking "How Tasks work"**: Opens a help overlay or modal explaining the FUB tasks system, likely linking to documentation [INFERRED]
- **Clicking the bell notification icon**: Opens notification panel/drawer on the right, showing recent system alerts (count badge shows 1 unread) [INFERRED]
- **Hovering a task row**: [INFERRED] Row background lightens to a hover state; the checkbox and expand icon may become more prominent; quick action buttons may appear (e.g., "Call Now" CTA)
- **Keyboard shortcut on tasks**: [INFERRED] Space or Enter to complete a focused task; arrow keys to navigate between tasks
- **Scrolling the task list**: Loads more overdue tasks grouped by date, continuing backward in time beyond Jun 15

---

## Data Model Signals

This screen reveals the following entities and fields:

### Task entity
- `id` — unique identifier
- `contact_id` / `person_id` — foreign key to the associated contact/person record
- `assigned_to_user_id` — agent the task is assigned to (shown as "Me" when it matches logged-in user)
- `task_type` — enum: at minimum `call` (green phone icon), presumably also `email`, `todo`, `text`
- `description` / `note` — text: "Lead returned to website. Follow up now."
- `due_at` — datetime: used for both date-grouping and the time display (e.g., "12:12pm")
- `status` — enum: `overdue` (this view), `due_today`, `future`, `completed`
- `created_at` — [INFERRED] for audit trail

### Contact/Person entity (referenced)
- `id`
- `display_name` — e.g., "Matthew Ryan", "Matt Ryan", "Scdvf"
- `initials` — derived: "MR", "S"
- `avatar_color` — assigned per contact (gray-blue for MR contacts, tan/brown for S contact)

### Agent/User entity (referenced)
- `id`
- `display_name` — "Me" when matches logged-in user
- `avatar` — photo or initials

### Automation / Action Plan linkage [INFERRED from identical task descriptions]
- Tasks with identical descriptions ("Lead returned to website. Follow up now.") are very likely auto-generated by a FUB Action Plan step triggered by a "Lead Returned to Website" behavioral event, pointing to a `source_action_plan_id` or `trigger_event_type` field on the task

### Aggregate
- Total overdue task count for current user: **268** (badge on Overdue tab)

### Enumerations observed
- Task status: `overdue`, `today`, `future` (from the 3 tab names)
- Task type: `call` (at minimum, inferred from phone icon)
- Agent filter: `me`, `[other agents]`, `all` (from Me dropdown)

---

## Rebuild Notes

### Component Breakdown

```
<TasksPage>
  <FUBTopNav activeItem="tasks" notificationCount={1} userAvatar={mattHeadshot} />
  
  <TasksSubHeader>
    <TabGroup>
      <Tab href="/tasks/today" active={false}>Today's Tasks</Tab>
      <Tab href="/tasks/overdue" active={true}>Overdue <Badge>268</Badge></Tab>
      <Tab href="/tasks/future" active={false}>Future</Tab>
    </TabGroup>
    <ToolbarRight>
      <HelpButton label="How Tasks work" icon={<InfoCircle />} />
      <FilterDropdown label="Filters" />
      <AgentScopeDropdown label="Me" currentAgent={loggedInUser} />
    </ToolbarRight>
  </TasksSubHeader>

  <TasksLayout>
    <LeftPanel empty={true} />  {/* No task selected; gray background, no content */}

    <TaskListPanel>
      <TaskListHeader>
        <SectionTitle icon={<ClockIcon />}>Overdue Tasks</SectionTitle>
        <ClearOverdueLink onClick={handleClearAll}>Clear My Overdue Tasks</ClearOverdueLink>
      </TaskListHeader>

      {dateGroups.map(group => (
        <DateGroup key={group.date}>
          <DateGroupHeader>
            {/* e.g., "Tuesday, Jun 23 (3)" */}
            {formatDate(group.date)} ({group.tasks.length})
          </DateGroupHeader>

          {group.tasks.map(task => (
            <TaskRow key={task.id}>
              <TaskCheckbox checked={false} onChange={handleComplete(task.id)} />
              <ContactAvatar initials={task.contact.initials} color={task.contact.avatarColor} />
              <TaskBody>
                <ContactNameLink href={`/people/${task.contact.id}`}>
                  {task.contact.displayName}
                </ContactNameLink>
                <TaskDescription>
                  <PhoneIcon color="green" />
                  {task.description}
                </TaskDescription>
                <AssignedTo>
                  <PersonIcon />
                  {task.assignedTo === currentUser ? 'Me' : task.assignedTo.name}
                </AssignedTo>
              </TaskBody>
              <TaskMeta>
                <DueTime icon={<ClockIcon />}>{formatTime(task.dueAt)}</DueTime>
                <ExpandIcon />  {/* » expand/more chevron */}
              </TaskMeta>
            </TaskRow>
          ))}
        </DateGroup>
      ))}
    </TaskListPanel>
  </TasksLayout>

  <HelpFab />  {/* Floating ? button, bottom-right */}
</TasksPage>
```

### Non-Obvious Logic

1. **Date grouping:** Tasks are grouped by their `due_at` date (not by creation date). Groups are ordered in descending date order (most recent overdue first: Jun 23 → Jun 22 → Jun 19 → Jun 17 → Jun 15 → ...). The group header count in parentheses is a count of tasks within that date bucket.

2. **"Me" scope filter:** The page defaults to showing only the logged-in user's tasks. The agent dropdown can expand to team-wide. The badge count "(268)" reflects the currently active agent scope — if you switch to "All", the badge count would change.

3. **Auto-generated tasks:** The near-identical task descriptions ("Lead returned to website. Follow up now.") with timestamps scattered across different dates and times strongly indicate these tasks are generated by a FUB Action Plan automation triggered by a behavioral event ("lead returned to website"). The system creates one call task per trigger event per contact, due at the time of the event or shortly after.

4. **Contact name collision — "Matthew Ryan" vs "Matt Ryan":** Two distinct contact records appear in the system with nearly identical names but different stored display names. Both use initials "MR" and the same avatar color. This is a real CRM data quality issue, not a UI artifact. The system does not deduplicate them automatically at the task list level.

5. **"Clear My Overdue Tasks" bulk action:** This is a potentially destructive action that would mark all 268 overdue tasks as complete without individually reviewing them. It should present a confirmation dialog with a count before executing. After confirmation, all tasks disappear from the Overdue tab; the badge drops to 0.

6. **Expand icon ("»"):** Each task row has a small double-chevron on the far right. This likely opens an inline expansion panel or a right-side drawer with task detail, quick call button, reschedule controls, and task notes.

7. **Left panel (currently empty gray area):** In other FUB task views, the left panel may show a contact list or a selected contact's detail card. In the Overdue view with no task selected, it renders as empty gray. When a task or contact is clicked, this region likely populates with the contact record or a task detail sidebar.

8. **Avatar color assignment:** Different contacts get different avatar background colors. "Matthew Ryan" / "Matt Ryan" get a muted blue-gray; "Scdvf" gets a tan/brown. This is likely a deterministic hash of the contact name or ID mapped to a predefined color palette (similar to Google's approach).

9. **Time display format:** Times are shown without the date (since the date context is provided by the group header). Format is `h:mma` / `h:mmpm` — no leading zero, lowercase am/pm. Example: `6:27am`, `12:12pm`.

10. **Infinite scroll vs pagination:** The task list appears to scroll continuously — no explicit pagination controls are visible. More date groups load as the user scrolls down [INFERRED].
