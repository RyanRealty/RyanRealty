# Module: Tasks & Calendar / Appointments

Tasks and Calendar are the two scheduling surfaces that drive daily broker workflow. Tasks are internal action reminders tied to a contact — they live in a structured queue with Today/Overdue/Future buckets and feed the morning Hot Sheet. Calendar / Appointments is the external-facing scheduling surface for meetings with leads and clients; appointments are date-stamped, carry a Type and Outcome, sync bidirectionally with Google and Microsoft 365, appear on the contact timeline and right rail, and drive the Appointments report. The two systems share a single activity-type taxonomy (Follow Up, Call, Email, Text, Showing, Closing, Open House, Thank You), which means task filters and appointment-type selectors draw from the same enum.

---

## Part 1 — Tasks Module

### 1.1 URL and navigation

- Route: `/crm/tasks/{today|overdue|future}`
- Top nav item: **Tasks** (checklist icon; bold when active)
- Default landing: **Overdue** sub-tab if overdue count > 0; otherwise **Today's Tasks**

---

### 1.2 Page layout

```
┌──────────────────────────────────────────────────────────────┐
│  Top Nav Bar (navy #102742, full width, sticky ~48px tall)   │
│  People | Inbox🔴 | Tasks | Calendar | Deals | Reporting      │
│  | Admin                [Search]         [+lead][bell][avatar]│
├──────────────────────────────────────────────────────────────┤
│  Sub-tab bar (cream #faf8f4, sticky ~40px)                    │
│  [Today's Tasks] [Overdue (268)] [Future]                     │
│                   [How Tasks work] [Filters ▾] [Me ▾]         │
├───────────────────────────┬──────────────────────────────────┤
│  LEFT PANEL               │  TASK LIST PANEL                 │
│  (~40–45% width)          │  (~55–60% width, bg: white)      │
│  bg: light gray           │                                  │
│  Empty when no task       │  ┌─────────────────────────────┐ │
│  selected                 │  │ 🕐 Overdue Tasks             │ │
│                           │  │          Clear My Overdue… ↗ │ │
│                           │  │ ─────────────────────────── │ │
│                           │  │ Tuesday, Jun 23 (3)          │ │
│                           │  │  [row] [row] [row]           │ │
│                           │  │ Monday, Jun 22 (1)           │ │
│                           │  │  [row]                       │ │
│                           │  │ Friday, Jun 19 (3)           │ │
│                           │  │  ...                         │ │
│                           │  └─────────────────────────────┘ │
├───────────────────────────┴──────────────────────────────────┤
│  [?] Help FAB (floating, bottom-right, ~40px circle)          │
└──────────────────────────────────────────────────────────────┘
```

**Left panel states:**
- **Idle (no task selected):** uniform light gray background, no content — this is the expected default state when viewing the list without drilling into a task
- **Task selected (inferred):** contact record or task detail card populates this panel

---

### 1.3 Sub-tab bar

Three tabs, rendered as horizontal pill-tabs with an underline indicator on the active tab:

| Tab label | Route segment | Badge | Badge color |
|---|---|---|---|
| Today's Tasks | `/today` | none | — |
| Overdue (268) | `/overdue` | integer count | orange/red (live, decrements in real time) |
| Future | `/future` | none | — |

The badge count "(268)" on the Overdue tab reflects the currently active agent scope filter. Switching the agent scope dropdown updates the count.

**Observed count:** 268 overdue tasks (shot-29, confirmed in GIF frame f02). Prior spec stated "248" — that figure was incorrect; 268 is the accurate value from high-res capture.

---

### 1.4 Toolbar (right-aligned, same row as sub-tabs)

Three controls, rendered as ghost/outline buttons (~32–36px tall, rounded corners ~6px, 1px border in `border-border`, Geist text):

#### 1.4.1 "How Tasks work" button

- Icon: circle-i (info icon), ~14px, left of label
- Label: `How Tasks work`
- Click behavior: opens a centered modal (see §1.9)
- Appears on all three sub-tabs

#### 1.4.2 "Filters ▾" dropdown

- Label: `Filters` + dropdown caret (▾)
- Click: opens a positioned dropdown anchored below the button, no modal backdrop
- **Dropdown contents — exhaustive (from GIF frame f03):**

| Checked by default | Icon | Label | Internal value |
|---|---|---|---|
| ✅ | ≡ list | All types | (meta-toggle) |
| ✅ | 🏳 flag | Follow Up | `follow_up` |
| ✅ | 📞 phone | Call | `call` |
| ✅ | ✉ envelope | Email | `email` |
| ✅ | 💬 chat bubble | Text | `text` |
| ✅ | 🏠 house | Showing | `showing` |
| ✅ | ✓ checkmark | Closing | `closing` |
| ✅ | 🚪 door | Open House | `open_house` |
| ✅ | ❤ heart | Thank You | `thank_you` |
| ☐ | — | Show Completed | (visibility toggle) |

- All 8 task types are checked by default (inclusive filtering)
- "Show Completed" is a separate boolean toggle below a visual separator — it is not a type filter; it controls whether completed tasks appear inline alongside active ones
- Checking a type checkbox re-filters the list live; no submit required
- Checking "Show Completed" inserts completed tasks into the appropriate date groups (they appear with strikethrough or muted styling, inferred)
- Dismissal: click outside the dropdown closes it without navigating

**Note on prior spec:** The prior spec described the Filters dropdown as covering "type/contact/source" — the GIF capture shows it covers only the 8 task types plus Show Completed. No contact-stage or source filter is visible.

#### 1.4.3 Agent scope dropdown ("Me ▾")

- Default label: `Me` (current logged-in user)
- Click: opens a dropdown to select a specific agent or "All"
- Switching agents updates the task list and the Overdue badge count
- Permission rules (per FUB docs): Owners, Admins, ISAs/Account Team Leaders, and Team Leads (limited to their team) can view other users' tasks. Regular team members see only their own.

---

### 1.5 Task list content area

#### 1.5.1 Content header

Renders at the top of the task list panel, above the date groups:

```
🕐  Overdue Tasks                    Clear My Overdue Tasks
```

- Left: clock icon (~16px outline) + section title `Overdue Tasks` (semi-bold, ~15–16px, dark text)
- Right: `Clear My Overdue Tasks` — blue text link (no underline at rest), right-aligned
  - Click behavior: bulk-completes (or deletes) all overdue tasks belonging to the current user
  - Must show a confirmation dialog before executing ("This will clear all 268 of your overdue tasks. Continue?") — action is irreversible
  - After confirmation: all tasks removed from the list; Overdue badge drops to 0
  - **Restriction (per FUB docs):** users can only delete their own tasks — this action never clears another agent's overdue tasks, even if admin has scoped the view to another agent
  - **No equivalent bulk action exists for Today or Future tabs** (per FUB docs; Overdue only)

#### 1.5.2 Date group headers

Tasks are grouped by their `due_at` date in **descending order** (most recent overdue date first). Each group header renders as:

```
Tuesday, Jun 23 (3)
```

Format: `{Day of week}, {Month} {DD} ({task count in group})`

Groups observed (shot-29, GIF f02):
1. `Tuesday, Jun 23 (3)`
2. `Monday, Jun 22 (1)`
3. `Friday, Jun 19 (3)`
4. `Wednesday, Jun 17 (2)`
5. `Monday, Jun 15 (2)` (partially visible — list scrolls further back in time)

Typography: dark gray, normal weight, ~13px, title case.

#### 1.5.3 Individual task row anatomy

Each task row is approximately 56–64px tall and contains the following elements, left to right:

| Position | Element | Detail |
|---|---|---|
| 1 | **Checkbox** | Square, ~14–16px, unchecked state = white fill + gray border. Check → mark complete (see §1.7). Rounded corners ~2–4px. |
| 2 | **Contact avatar** | Circular, ~32–36px. Initials on colored background (color assigned per contact — e.g. gray-blue for "MR", tan for "S"). No photo shown for these contacts. |
| 3 | **Contact name** | Blue hyperlink text, ~14px medium weight. Click → navigate to Person detail page (`/crm/people/{id}`). |
| 4 | **Task type icon** | Small icon, ~14–16px, left of description. Color encodes type: green phone = Call. See icon map in §1.4.2 for all 8 types. |
| 5 | **Task description** | Dark gray body text, ~13–14px normal weight. Example: `Lead returned to website. Follow up now.` May truncate to one line. |
| 6 | **Assignee sub-text** | Below description: person/silhouette icon (~12px muted gray) + agent name. Shows `Me` when assigned to the logged-in user. |
| 7 | **Due time** | Far right, clock icon (~12px) + time in 12-hour format, lowercase am/pm. No leading zero. Examples: `12:12pm`, `6:27am`, `3:30pm`. |
| 8 | **Expand chevron** | Double-chevron `»` icon at far right, below the time. Click → inline expansion or right-panel task detail (inferred; not fully captured). |

Divider: 1px solid very light gray (`#f3f4f6`) between rows.

**Observed task rows (from shot-29 and GIF f02):**

| Date group | Contact | Task description | Assigned | Due time |
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
| Mon, Jun 15 (2) | Scdvf | (truncated at scroll boundary) | — | 11:22am |

---

### 1.6 Task completion UX (observed in GIF)

1. User clicks the checkbox on a task row
2. **Immediate optimistic response:** checkbox fills blue; row text gets strikethrough styling
3. After ~500ms: row fades/slides out; removed from the list
4. **Overdue badge decrements by 1** in the same tick as step 2 (optimistic, before server confirmation)
5. Completion is recorded on the contact's activity timeline (per FUB docs)
6. The `completed_at` timestamp records **when the task was marked complete**, not the original `due_at` (per FUB docs)

Via API: `PATCH /v1/tasks/:id` with `{ "isCompleted": true }` (per FUB docs).

---

### 1.7 Today's Tasks tab

Same layout and row anatomy as Overdue. Date groups are ordered chronologically (ascending — earliest due time first). Section header reads `Today's Tasks`. No "Clear My" bulk action link (bulk clear is Overdue-only per FUB docs).

---

### 1.8 Future Tasks tab — empty state

When no future tasks exist:
- Content area shows a white card
- Center: faint pencil/edit icon (no instructional copy visible in capture)
- Section header reads `Future Tasks`
- **Future Tasks also includes tasks with no due date** (per FUB docs) — tasks without a `due_date` still appear here, not on Today or Overdue

Consider adding a "Create task" CTA to the empty state for better UX (improvement over FUB baseline).

---

### 1.9 "How Tasks Work" modal

Trigger: click "How Tasks work" button in the toolbar.

**Modal anatomy:**
- Centered dialog, white background card, semi-transparent dark overlay behind
- Header: clock/timer icon + `How Tasks Work` (title, ~16px semi-bold)
- X close button (top right)
- Embedded video thumbnail (dark slate background):
  - FUB logo (upward chevrons) centered top
  - Text: `How Tasks help prioritize your day`
  - Blue circular play button — click plays embedded explainer video inline
- Below video: document icon + `Learn more` (blue text link — opens FUB help article in new tab)
- Dismiss: click X or click outside the modal

In-house implementation: replace the FUB video with a Ryan Realty internal training video or link to an internal help article. Low priority.

---

### 1.10 Task creation paths

Four paths to create a task (per FUB docs):

1. **Person detail page** → Tasks section → `+` icon → fill fields → Create Task
2. **Quick Follow-Up Task** (lightning bolt icon on person detail) — streamlined 1-click (see §1.11)
3. **Action Plan step** — creates a task automatically on a given day number (see §1.12)
4. **API** — `POST /v1/tasks`

Result: task appears on (a) the Person detail tasks section, (b) the Tasks Page, and (c) the Calendar (in yellow, if it has a date).

---

### 1.11 Task fields (canonical from API docs)

| Field | Type | Required | Notes |
|---|---|---|---|
| `person_id` | int FK | Yes | Contact the task is linked to |
| `assigned_user_id` | int FK | Conditional | Required if `assigned_to` name is empty |
| `assigned_to` | string | Conditional | Full name of assignee. Required if `assigned_user_id` is empty |
| `name` | string | No | Task description / label |
| `type` | enum | No | See §1.12 for exact values |
| `is_completed` | boolean | No | Default false. Mark complete on create |
| `due_date` | date | No | Date only (YYYY-MM-DD), no time |
| `due_datetime` | timestamptz | No | Full datetime with tz offset: `2004-11-16T03:00:00 -05:00` |
| `remind_seconds_before` | integer | No | Seconds before due time to send a reminder notification. **Only works when a due time is set.** |
| `created_by_id` | int FK | No | Defaults to authenticated user |
| `created_at` | timestamptz | auto | |
| `completed_at` | timestamptz | null | Set when `is_completed` flips to true; records completion time, not due date |

---

### 1.12 Task type enum

The canonical 9 values (per FUB API docs). Store as a type column (string enum), NOT as a foreign key to a types table (unlike appointment types, which are a separate admin-configurable table):

| Enum value | Display label | Icon | Notes |
|---|---|---|---|
| `follow_up` | Follow Up | 🏳 flag | Default generic task type |
| `call` | Call | 📞 phone (green) | Most common auto-generated type |
| `text` | Text | 💬 chat bubble | |
| `email` | Email | ✉ envelope | |
| `appointment` | Appointment | (inferred: calendar) | Exists in API enum but NOT listed as an action plan step option (per docs). Behavior when set via API is undocumented. |
| `showing` | Showing | 🏠 house | |
| `closing` | Closing | ✓ checkmark | |
| `open_house` | Open House | 🚪 door | |
| `thank_you` | Thank You | ❤ heart | |

**Important discrepancy:** The Tasks Filters UI exposes 8 types (excludes `appointment`). The FUB API enum has 9 (includes `appointment`). Action Plans can create 8 types (excludes `appointment`). The `appointment` task type appears only via direct API calls.

---

### 1.13 Task notification rules (per FUB docs)

| Condition | Notifications fire? |
|---|---|
| Task has `due_datetime` (date + time) | Yes — all configured channels |
| Task has `due_date` only (no time) | No — silent; appears on correct day but no notification fires |
| Task created by Action Plan | Never — no notifications regardless of time setting |
| Task appears at ~4 AM | Yes (Action Plan tasks appear ~4 AM on due date; no notification at appearance) |

Configurable channels per user (Bell > Settings Gear > Notification Settings):
1. Notification Bell (in-app, desktop only)
2. Desktop push notifications (browser)
3. Mobile Push (iOS/Android)
4. Text message (from dedicated SMS number)
5. Email (to login email)

Two toggleable triggers: "When assigned a task" and "When a task is due."

---

### 1.14 Quick Follow-Up Task (lightning bolt shortcut)

- Located on the Person detail page (lightning bolt icon)
- Creates a task in a 1-click streamlined flow: tap → select follow-up day option → done
- Auto-assigned to the creator
- **Quick task timing cannot be edited after selection** — this is a deliberate UX constraint, not a bug (per FUB docs)
- Specific day-option presets are account-configurable (inferred)

---

### 1.15 Recurring tasks

FUB has no native recurring task feature. The workaround — replicated in the in-house CRM — is Action Plans:

1. Create an Action Plan with Task steps
2. Set each step's timing: "Run N days after the previous step"
3. **Deselect** "automatically pause this action plan when the lead responds" — otherwise the plan halts after any lead reply
4. Apply the plan to leads as needed

Action plan task step types: 8 types (excludes `appointment`). Same 8 as the Filters dropdown.

---

### 1.16 Viewing completed tasks

- Completed tasks are **hidden by default** everywhere
- View options:
  1. **Person detail page** → "View Completed Task(s)" text link in the Tasks section
  2. **Tasks page** → Filters dropdown → check "Show Completed"
- The `completed_at` timestamp (not `due_at`) shows when the task was marked done

---

### 1.17 Auto-generated tasks and the backlog/dedup problem

The dominant pattern in the Overdue list is auto-generated Call tasks with description `"Lead returned to website. Follow up now."` — identical text, different timestamps. Each website return visit by a contact triggers a new task via automation. With no dedup logic, a single contact visiting the website repeatedly produces N separate overdue tasks, contributing to the 268-task backlog.

**Build implication:** when auto-generating tasks from behavioral triggers (website return, new inquiry, etc.), implement a dedup check: if an active (incomplete) task of the same type for the same contact already exists, do not create a duplicate. Options:
- Skip creation if existing active task with same `type` and `person_id` is within 24 hours (inferred)
- Or mark old task as superseded before creating the new one

This is an improvement over FUB baseline behavior.

---

### 1.18 Daily Hot Sheet (task surface)

Every morning at ~7:00 AM (account timezone), the system sends a Hot Sheet email containing:
- Today's appointments
- Up to **5 pending tasks** (maximum 5 shown; full list requires login)
- New leads (last 7 days)
- Recent activity

The 5-task cap is a hard FUB limit. In-house: match this cap; do not increase it (the cap forces brokers to use the Tasks page, not rely on email).

---

### 1.19 Task data model (tables)

```sql
-- Core task record
CREATE TABLE crm_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     uuid NOT NULL REFERENCES crm_people(id) ON DELETE CASCADE,
  assigned_user_id uuid REFERENCES auth.users(id),
  assigned_to   text,                       -- fallback if no user_id
  name          text,                       -- description / label
  type          text CHECK (type IN (
    'follow_up','call','text','email','appointment',
    'showing','closing','open_house','thank_you'
  )),
  is_completed  boolean NOT NULL DEFAULT false,
  due_date      date,                       -- date only (no time)
  due_datetime  timestamptz,               -- full datetime with tz
  remind_seconds_before int,               -- seconds; requires due_datetime
  source_action_plan_id uuid,              -- FK to crm_sequences if auto-generated
  is_from_action_plan boolean NOT NULL DEFAULT false,  -- suppresses notifications
  created_by_id uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,              -- set when is_completed = true
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_tasks_person_idx ON crm_tasks(person_id);
CREATE INDEX crm_tasks_assigned_user_idx ON crm_tasks(assigned_user_id);
CREATE INDEX crm_tasks_due_datetime_idx ON crm_tasks(due_datetime) WHERE NOT is_completed;
```

**Task view bucketing logic:**

```sql
-- Today
WHERE due_date = CURRENT_DATE
  AND NOT is_completed

-- Overdue
WHERE (
    (due_datetime IS NOT NULL AND due_datetime < now())
    OR (due_date IS NOT NULL AND due_date < CURRENT_DATE AND due_datetime IS NULL)
  )
  AND NOT is_completed

-- Future (includes NULL due_date tasks)
WHERE (
    due_datetime > now()
    OR (due_date > CURRENT_DATE AND due_datetime IS NULL)
    OR (due_date IS NULL AND due_datetime IS NULL)
  )
  AND NOT is_completed
```

---

### 1.20 Tasks API endpoints (to implement)

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/crm/tasks` | List tasks; supports filters below |
| POST | `/api/crm/tasks` | Create task |
| GET | `/api/crm/tasks/:id` | Get single task |
| PUT | `/api/crm/tasks/:id` | Update task |
| DELETE | `/api/crm/tasks/:id` | Delete task (own tasks only) |
| POST | `/api/crm/tasks/clear-overdue` | Bulk clear current user's overdue tasks |

GET filter parameters:
- `person_id` (uuid)
- `assigned_user_id` (uuid)
- `type` (comma-separated enum values)
- `is_completed` (boolean)
- `due` (enum: `today`, `overdue`, `upcoming`)
- `due_start` + `due_end` (datetime range)

---

### 1.21 Tasks module acceptance criteria

1. Three sub-tabs (Today's Tasks / Overdue / Future) render with accurate live counts; Overdue badge is orange/red, persists across sub-tabs.
2. Overdue tab renders tasks in date-descending groups; each group header shows day name + date + count in parentheses.
3. Each task row shows: checkbox, contact avatar with initials + assigned color, contact name as a hyperlink, task-type icon (color-coded), description text, assignee label ("Me" or agent name), due time in 12-hour format, expand chevron.
4. Checking a task checkbox triggers immediate strikethrough + optimistic badge decrement; row removes after ~500ms; completion is recorded with `completed_at` timestamp.
5. Future tab shows tasks with no due date (null `due_date`/`due_datetime`) alongside dated future tasks.
6. Future tab renders an empty state (icon + optional CTA) when no future tasks exist.
7. Filters dropdown opens anchored to button; renders 8 type checkboxes (all checked by default) plus "Show Completed" toggle; filtering applies live without page reload.
8. "Show Completed" toggle surfaces completed tasks inline with visual distinction (strikethrough / muted).
9. Agent scope dropdown ("Me ▾") allows scoping task list to another agent or "All"; permission gate: only Owners/Admins/Team Leads can view other agents' tasks.
10. "Clear My Overdue Tasks" requires a confirmation dialog showing the task count; on confirmation, bulk-deletes only the current user's overdue tasks; badge drops to 0.
11. Task type icons map correctly: flag=Follow Up, phone(green)=Call, envelope=Email, chat=Text, house=Showing, checkmark=Closing, door=Open House, heart=Thank You.
12. Notifications fire only when `due_datetime` is set (not `due_date` alone); Action Plan-generated tasks (`is_from_action_plan = true`) never fire notifications.
13. Quick Follow-Up Task shortcut on Person detail creates a task in 1-click; timing selection is immutable after creation.
14. Completed tasks are hidden by default; visible via "Show Completed" filter or the "View Completed Tasks" link on the Person detail.
15. Recurring tasks are implemented via Action Plan sequences with a "don't pause on reply" flag.
16. Auto-generated tasks from behavioral triggers implement a dedup check before insertion.
17. Daily Hot Sheet email includes up to 5 pending tasks (hard cap) at ~7:00 AM account timezone.

---

## Part 2 — Calendar Module

### 2.1 URL and navigation

- Route: `/crm/calendar`
- Top nav item: **Calendar** (calendar grid icon)
- Default view on open: **Day view** for today's date

---

### 2.2 Page layout (two-column)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Top Nav Bar (sticky)                                                │
├──────────────────┬───────────────────────────────────────────────────┤
│  LEFT SIDEBAR    │  MAIN CALENDAR GRID                               │
│  (~240–280px)    │  (remaining width)                                │
│                  │                                                   │
│  Mini Month Cal  │  Header row:                                      │
│  ─────────────── │  [Day | Week | Month]  [< Today >]  [Everyone ▾] │
│  Schedule|Filters│                                              [+]  │
│  ─────────────── │  ┌────────────────────────────────────────────┐   │
│  Today, Jun 30   │  │ All Day: [Ryan Realty RBN License…] pill   │   │
│  • RBN License.. │  ├────────────────────────────────────────────┤   │
│  Tomorrow, Jul 1 │  │ 7am  ─────────────────────────────────────│   │
│  No events,      │  │ 8am  ─────────────────────────────────────│   │
│  [add appt]      │  │ 9am  ─────────────────────────────────────│   │
│                  │  │ 10am ─────────────────────────────────────│   │
│                  │  │ ...                                        │   │
│                  │  └────────────────────────────────────────────┘   │
└──────────────────┴───────────────────────────────────────────────────┘
```

---

### 2.3 Left sidebar

#### 2.3.1 Mini month calendar

- Shows the current month (e.g., "June 2026") with `<` / `>` navigation arrows
- 7-column grid: Sunday through Saturday headers
- Date numbers; overflow dates from adjacent months shown faded
- Today's date: filled blue circle (strong contrast — e.g., Jun 30 circled blue)
- Click any date: jumps the main calendar grid to that date (in whatever view is active)
- `<` / `>` arrows on mini-cal: advance the mini-cal month only; does not necessarily change the main view date unless a date is clicked

#### 2.3.2 Sidebar tabs: Schedule | Filters

Two tabs below the mini calendar:

**Schedule tab (active by default):**
Shows a text list of upcoming events grouped by date:

```
Today, Jun 30
  [Blue pill] Ryan Realty RBN License Renewal Due

Tomorrow, Jul 1
  No events, [add appointment]
```

- "Today, {date}" and "Tomorrow, {date}" sections always shown
- Events listed as text pills (blue for all-day events)
- Empty day: renders `No events, [add appointment]` where "add appointment" is a blue inline text link
- "add appointment" link → same handler as the `+` button (opens Create Appointment modal)
- Users can mark tasks complete from this widget (per FUB docs)

**Filters tab:**
Presumably shows calendar-specific event type filter (not fully captured in GIF — inferred).

---

### 2.4 Main calendar grid header

| Element | Detail |
|---|---|
| View switcher | Three tab buttons: **Day** \| **Week** \| **Month** (active tab underlined) |
| Navigation | `<` previous, **Today** (button, jumps to today), `>` next |
| Agent filter | **Everyone ▼** dropdown — switches between individual agent calendars or aggregate team view. Permission-gated: Admins/Owners see all agents; team members see own calendar only. |
| Add button | `+` (teal circle, ~36–40px diameter, far right) — opens Create Appointment modal |

---

### 2.5 Calendar views

#### 2.5.1 Day view

- Column header: `{Day name} {DD}` (e.g., `Tuesday 30`)
- **All Day row** pinned at top: all-day events render as full-width blue banner/pill spanning the entire column
  - Example: `Ryan Realty RBN License Renewal Due` renders as a blue banner in the All Day row
- Hourly time grid below: rows at hourly intervals (7am through ~10pm), each row labeled on the left
- Empty time slots: rendered as horizontal ruled lines; clickable to quick-create an appointment (inferred — standard calendar UI pattern)
- Timed appointments render as colored blocks within the appropriate time slot

#### 2.5.2 Week view

- 7-column grid (Sun–Sat), same All Day row + hourly time grid structure as Day view
- Column headers: `{Day abbrev} {DD}` for each day of the week
- Events appear within the correct day column and time slot
- Today's column highlighted with subtle background color (inferred)

#### 2.5.3 Month view

- Standard 7-column (Sun–Sat), 5–6 row grid
- Each cell: date number top-left; events listed as `• HH:mmam Label…` (truncated)
- **Event dot color taxonomy (from GIF month view capture):**

| Color | Event type | Example |
|---|---|---|
| Amber/orange dot | Lead follow-up tasks/events | `Lead retur…` |
| Red/orange dot | Expired listing alerts | `Expired lis…` |
| Blue pill (no dot) | All-day events / reminders | `Ryan Realty RBN Lic…` |
| Blue text (no dot) | Annual calendar reminders | `Oregon LLC Annual …` |
| Plain text (no dot) | Calendar notes | `Review + send the d…` |

**Canonical color mapping for in-house implementation:**

```typescript
const CALENDAR_EVENT_COLORS = {
  appointment:    'blue',     // FUB appointments (blue, per FUB docs)
  task:           'yellow',   // Tasks (yellow, per FUB docs)
  deal_closing:   'orange',   // Deal closings (orange, per FUB docs)
  custom_date:    'purple',   // Custom dates (purple, per FUB docs)
  all_day:        'blue',     // All-day events render as blue banners
  lead_followup:  'amber',    // Auto-generated lead follow-up (observed in month view)
  expired_listing: 'red',     // Expired listing alerts (observed in month view)
}
```

- Today's date: filled blue circle on the date number
- **Overflow:** when a cell has more events than fit (e.g. Jun 9 had 6+), a `2 More` blue text link appears at the bottom of the cell; clicking expands to show all events (day popover or navigate to day view — inferred)
- **Multi-day events:** render as a block stretching across the specified days (per FUB docs)

**Full month event density observed in GIF (June 2026):**

| Date | Events visible |
|---|---|
| Tue Jun 2 | 9:27am Lead retur… / 1:06pm Lead retur… / 7:53pm Lead retur… |
| Wed Jun 3 | 9:53pm Lead retur… |
| Fri Jun 5 | 10:46pm Lead retu… |
| Sat Jun 6 | "Review + send the d…" (plain text) |
| Mon Jun 7 | 8:07am Lead retur… / 9:59pm Lead retur… |
| Tue Jun 8 | 3:29pm Lead retur… |
| Wed Jun 9 | 7:48am Lead retur… / 9:33am Expired lis… / 5:03pm Expired lis… / 5:03pm Expired lis… / 5:55pm Lead retur… / 6:05pm Expired li… + "2 More" overflow |
| Thu Jun 10 | 7:13am Lead retur… / 8:48am Expired lis… / 12:04pm Expired li… / 12:05pm Expired li… / 4:18pm Expired lis… |
| Fri Jun 11 | 12:33am Expired li… / 8:50am Expired li… / 3:19pm Expired list… |
| Sat Jun 12 | 6:39pm Hot seller … |
| Sun Jun 14 | 4:48am Lead retur… |
| Mon Jun 15 | 11:22am Hot seller … / 5:18pm Lead retur… |
| Tue Jun 16 | 12:30pm Academi… |
| Wed Jun 17 | 9:50am Lead retur… / 5:20pm Lead retur… |
| Fri Jun 19 | 6:55am Lead retur… / 2:57pm Lead retur… / 6:15pm Lead retur… |
| Sun Jun 21 | "Oregon LLC Annual …" (blue text, all-day style) |
| Mon Jun 22 | 6:27am Lead retur… / 12pm Meet Tenant… |
| Tue Jun 23 | 12:12pm Lead retu… / 3:30pm Lead retur… / 8:26pm Lead retur… |
| Mon Jun 30 | "Ryan Realty RBN Lic…" (blue pill, all-day) — today, circled |

---

### 2.6 Create Appointment modal

**Trigger:** Click `+` button in the calendar header, or click "add appointment" link in the Schedule sidebar panel.

**Modal type:** Centered dialog with backdrop darkening the calendar behind it. Full-width on the modal container. X button top-right to dismiss without saving.

**Complete field inventory (from GIF frame f09):**

| # | Field | Input type | Default value | Notes |
|---|---|---|---|---|
| 1 | **Title** | Text input, full-width | `Add title` (placeholder) | Free-text appointment name |
| 2 | **Start date** | Date picker | Today (06/30/2026) | Pre-filled with today |
| 3 | **Start time** | Time picker | `8:00 am` | Pre-filled; 30-min increment dropdown; can type manually for 15-min |
| 4 | **End time** | Time picker | `8:30 am` | Pre-filled (+30 min default from start) |
| 5 | **End date** | Date picker | Today (06/30/2026) | Same day default; change for multi-day events |
| 6 | **Timezone** | Dropdown | `Pacific Time (GMT-07:00)` | Pre-fills with user's timezone; stored per appointment |
| 7 | **All day event** | Checkbox | unchecked | When checked: hides time pickers, keeps date fields only |
| 8 | **Location** | Text input | `Add location` (placeholder) | Map pin icon left. Physical address or virtual link |
| 9 | **Add guests** | Text search + avatar chips | — | Search icon; shows avatar list of selected guests below |
| 10 | **Guest pre-populated** | Pill/chip | Matt Ryan (MR avatar) | Current user is auto-added as a guest |
| 11 | **Type** | Dropdown | `Set type` (placeholder) | Left half of a 2-field row; see §2.7 |
| 12 | **Outcome** | Dropdown | `No Outcome` | Right half of same row; see §2.8 |
| 13 | **Notes** | Rich-text editor | (empty) | Toolbar: **B** *I* U bullet-list numbered-list hyperlink strikethrough |
| 14 | **Send invitation** | Checkbox + label | unchecked | `Send invitation email & text reminder` — sends email invite to all invitees + SMS if Power-Up enabled |
| 15 | **Submit** | Primary button | `Create Appointment` | Full-width; teal/blue (design system: `bg-primary`) |
| 16 | **Dismiss** | X icon | — | Top-right of modal; closes without saving |

**Important gotchas (per FUB docs):**
- When **reopening** an existing appointment to edit it, the "Send invitation" checkbox may be unchecked. If you save without re-checking it, **the reminder is silently canceled** — no warning shown. The system must warn the user if editing an appointment that has a pending reminder and the checkbox is unchecked.
- Time selector defaults to 30-minute increments in the dropdown. To use 15-minute increments, the user must type the value manually in the time field.
- `sendInvitation` defaults to `false` on the API (`POST /v1/appointments?sendInvitation=false`) — must be explicitly set to `true` to trigger invite emails.
- Invitation email is sent only to the **primary (first) email** on the contact profile — secondary emails are not notified.

**Dismiss behavior (observed in GIF):** clicking outside the modal (on the calendar area) closes it without saving. Escape key also dismisses. No new appointment is created if the modal is closed without clicking "Create Appointment."

---

### 2.7 Appointment types

- **Admin-configurable:** Owner goes to Admin → Appointments to add/edit types
- NOT a fixed system enum (unlike task types) — account-specific; no default types defined in FUB docs
- **Prior spec error:** Prior spec referred to this as "Appointment Stages" (Admin → "Appointment Stages") — the actual FUB location is **Admin → Appointments** for both types and outcomes
- In-house: the Type dropdown in the Create Appointment modal shows `Set type` as placeholder, then lists the configured types
- The same 8 activity labels visible in the Tasks filter (Follow Up, Call, Email, Text, Showing, Closing, Open House, Thank You) appear as appointment types in the observed UI — **tasks and calendar appointments share a single activity-type taxonomy**
- `orderWeight` (int): used for display ordering; auto-recalculated in 1,000-unit increments after any create (per FUB docs)

**API:**
- `GET /v1/appointmentTypes` — list all types
- `POST /v1/appointmentTypes` — create (Owner-only)
- `PUT /v1/appointmentTypes/:id` — update
- `DELETE /v1/appointmentTypes/:id` — delete

---

### 2.8 Appointment outcomes

- Also admin-configurable via Admin → Appointments
- Default: `No Outcome` (shown in Create modal)
- Can be set **after the fact** by opening the appointment on the contact profile or calendar
- Outcomes tracked in the Appointment Report (§2.14)
- `GET /v1/appointmentOutcomes` — sort options: `id`, `name`, `orderWeight` (default: `orderWeight`); default limit 10, max 100 per page

---

### 2.9 Appointment data model (tables)

```sql
-- Appointment types (admin-managed)
CREATE TABLE crm_appointment_types (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  order_weight  integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Appointment outcomes (admin-managed)
CREATE TABLE crm_appointment_outcomes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  order_weight  integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Core appointment record
CREATE TABLE crm_appointments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  timezone        text,                    -- user's timezone for display
  all_day         boolean NOT NULL DEFAULT false,
  location        text,
  description     text,                    -- rich text (HTML)
  type_id         uuid REFERENCES crm_appointment_types(id),
  outcome_id      uuid REFERENCES crm_appointment_outcomes(id),
  created_by_id   uuid NOT NULL REFERENCES auth.users(id),
  send_invitation boolean NOT NULL DEFAULT false,
  -- External calendar sync tracking
  google_event_id   text,                  -- for dedup on Google Calendar sync
  ms365_event_id    text,                  -- for dedup on MS365 sync
  sync_source       text CHECK (sync_source IN ('fub','google','ms365','showingtime')),
  calendar_sharing_visible boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Appointment invitees (supports both FUB users and external contacts)
CREATE TABLE crm_appointment_invitees (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  uuid NOT NULL REFERENCES crm_appointments(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id),   -- FUB team member
  person_id       uuid REFERENCES crm_people(id),   -- lead/contact
  name            text,
  email           text,                             -- primary email at time of invite
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crm_appointments_start_idx ON crm_appointments(start_at);
CREATE INDEX crm_appointments_created_by_idx ON crm_appointments(created_by_id);
CREATE INDEX crm_appointment_invitees_person_idx ON crm_appointment_invitees(person_id);
CREATE INDEX crm_appointment_invitees_user_idx ON crm_appointment_invitees(user_id);
```

---

### 2.10 Appointment creation paths

1. **Calendar** → `+` button (upper right) → Create Appointment modal
2. **Schedule sidebar** → "add appointment" inline link
3. **Person detail page** → Appointments section (right rail) → blue `+` icon
4. **Mobile** (iPhone/Android) → Calendar tab → plus sign → Schedule Appointment
5. **API** → `POST /v1/appointments`
6. **Synced from Google Calendar** (two-way via OAuth)
7. **Synced from Microsoft 365** (two-way via OAuth)
8. **Calendly passthrough** (shared Google/MS365 calendar; no direct API)
9. **ShowingTime** (RTT / My Agent Tour — requires Zillow two-way integration)

---

### 2.11 Invitation emails and reminders

**Invitation email behavior (per FUB docs):**
- Sent from the **user's connected email address** (not a generic CRM address)
- Sent only to the **primary (first) email** on the contact profile — secondary emails are excluded
- Gmail self-send warning: the agent may see a "looks like it came from and to you" Gmail notice — leads do NOT see this
- Update email (on edit + re-check) has the same format as the initial invitation

**Appointment Reminder Texts (Power-Up):**
- Account-level toggle (Admin → Power-Ups → Appointment Reminders)
- All newly created appointments automatically trigger a text reminder when the Power-Up is enabled
- Timing rules:

| Scenario | Reminder sent when |
|---|---|
| Same-day appointment | Immediately on creation |
| Appointment before 8:30 AM | One hour prior to appointment start |
| Appointment at 8:30 AM or later | 8:30 AM that day |
| All-day event | 12:30 PM the preceding day |

- Timing adjusts to user's timezone
- ISA scheduling: if ISA removes themselves and adds the agent, reminder sends from the **agent's number** but credits the ISA for the appointment
- **Re-edit gotcha:** when reopening an appointment, the reminder checkbox unchecks by default. Saving without re-checking **silently cancels the pending reminder**. Implementation must warn the user if editing would cancel a pending reminder.
- Reminder text appears in the lead's profile timeline (per FUB docs)

---

### 2.12 How appointments appear on the contact record

**Right rail — Appointments section:**
- Shows upcoming and recent appointments linked to this contact
- Empty state: "No upcoming appointments"
- Each appointment shows: title, date/time, type, outcome (if set)
- Click → opens appointment detail/edit modal (inferred)
- `+` icon → opens Create Appointment modal pre-populated with this contact as an invitee

**Activity timeline:**
- Each appointment creation/edit logs an event to the contact's timeline
- Appointment Reminder Text also logs a copy to the timeline

See `07a-person-detail-sidebar-and-inline-edit.md` for the Person detail right rail layout.

---

### 2.13 Google Calendar and Microsoft 365 sync

#### 2.13.1 Google Calendar

**Sync window:** 6 months prior (to connection date) to 2 years future. Every two weeks, an additional two weeks extends the future window automatically. **Disconnecting resets the window** — historical events beyond 6 months will not re-sync.

**FUB → Google (outbound):**
| Item | Syncs? | Notes |
|---|---|---|
| Task with date + time | ✅ | Syncs with contact name, email, FUB profile link |
| Task with date only (no time) | ❌ | Does not sync |
| Appointment | ✅ | Name, date, time, location, invitee emails, description |
| All-day event | ❌ | Does not sync to Google |

**Google → FUB (inbound):**
| Item | Syncs into FUB? |
|---|---|
| Calendar Events | ✅ — shows Google symbol indicator |
| Focus Time | ❌ |
| Out of Office | ❌ |
| Google Tasks | ❌ |
| Appointment Slots | ❌ |

**Privacy:** Google-synced appointments are hidden from other FUB users by default; user can enable visibility in My Settings.

**Lead profile behavior (critical):** Google-synced appointments do NOT appear on the lead's profile page. They DO count for Appointment Reporting. They display as `[hidden for privacy]` in team calendar views.

**Recurring appointments:** Must be created in Google Calendar — FUB cannot create recurring appointments natively.

**Troubleshooting:** Ensure "Follow Up Boss" calendar is toggled ON in Google Calendar view.

**Microsoft 365 sync requirement:** Must connect via OAuth authentication specifically. Standard email connection does not enable calendar sync. My Settings must show "OAuth" next to the connected email.

**MS365-specific:** Tasks sync to a dedicated "Follow Up Boss Tasks" folder in MS365 calendar. Deleted Outlook events that persist in FUB: disconnect and reconnect to force re-sync.

**Calendly:** No direct FUB-Calendly API. Sync only works if Calendly is connected to the exact same Google/MS365 calendar as FUB. No separate integration setup in FUB admin.

---

### 2.14 Appointment Report

**Access:** Reports → Appointments

**Count rule:** An appointment only counts toward the Appointment Report if **at least one contact (person) is listed as an invitee**. Appointments with only FUB users as invitees are excluded.

**Filters:**
- Time Frame (appointments within selected period)
- Users (filter by team member)
- Appointment Type
- Appointment Outcome

**Columns:**
| Column | Notes |
|---|---|
| Title | Appointment name |
| People | Contacts invited (linked) |
| Team | FUB team members invited |
| Created By | Who created the appointment |
| Date/Time | Sortable |
| Type | Appointment type (admin-configured) |
| Outcome | Outcome (admin-configured; settable after the fact) |
| Lead Source | Source of the contact record |
| Marketing Source | UTM/marketing attribution |

**Display limit:** Default 40 rows. Full data requires export.

**Agent Goal Report (Appointments section):**
- Available on Grow, Pro, and Platform plans (in-house: no plan gate needed for single-brokerage)
- Tracks: Appointments Had (count with new leads per agent, current year) + Appointment Outcomes section

---

### 2.15 Team calendar management

- **"Everyone ▼" dropdown** in the calendar header: switches between individual and team aggregate views
- Default for admin/owner: shows all team members' appointments
- Default for team member: own calendar only
- Permission tiers (per FUB docs):
  - Owner + Admins: full view/manage for all teams and users
  - Team Leaders + ISAs: manage direct reports' calendars
  - Team Members: own calendar only
- "Teams within Teams" filtering requires Platform plan (in-house: implement when needed, gate behind a feature flag)

---

### 2.16 Mobile calendar behavior

**iPhone (iOS app):**
- Visual indicators: Tasks = orange checkbox icon, FUB appointments = pink circle, synced external events = green circle
- Create: Plus icon lower-right → select type → fill details
- Also from Lead Profile → Calendar tab → Add Appointment or Task

**Android:**
- Visual indicators: Tasks = checkbox icon, FUB appointments = pink circle, synced = green circle
- Create: Plus sign → Schedule Appointment or Add Task
- Android-specific behavior: **all past appointments show as "overdue" regardless of outcome** — the outcome field does not affect display status on Android. In-house mobile: do NOT replicate this; respect the outcome field.
- Android Admin/Owner: sees all team member tasks but cannot filter (unlike desktop)

---

### 2.17 Calendar + Appointments API endpoints (to implement)

**Appointments:**

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/crm/appointments` | List appointments; filter by person_id, user_id, date range |
| POST | `/api/crm/appointments?sendInvitation=false` | Create appointment |
| GET | `/api/crm/appointments/:id` | Get single appointment |
| PUT | `/api/crm/appointments/:id?sendInvitation=false` | Update appointment |
| DELETE | `/api/crm/appointments/:id` | Delete appointment |

**Appointment types (admin only):**

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/crm/appointment-types` | List types |
| POST | `/api/crm/appointment-types` | Create type (Owner only) |
| PUT | `/api/crm/appointment-types/:id` | Update type |
| DELETE | `/api/crm/appointment-types/:id` | Delete type |

**Appointment outcomes (admin only):**

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/crm/appointment-outcomes` | List outcomes |
| POST | `/api/crm/appointment-outcomes` | Create outcome (Owner only) |
| PUT | `/api/crm/appointment-outcomes/:id` | Update outcome |
| DELETE | `/api/crm/appointment-outcomes/:id` | Delete outcome |

**API scope restriction (match FUB behavior):** `GET /api/crm/appointments` returns only appointments where:
1. The appointment belongs to the authenticated user OR the user has admin/owner permissions
2. For externally-synced appointments: only if the creating user has `calendar_sharing_visible = true`

---

### 2.18 Calendar and Appointments acceptance criteria

1. Calendar opens in Day view by default; Day/Week/Month view switcher functions correctly.
2. Mini-calendar in left sidebar allows date navigation; clicking a date jumps the main grid to that date.
3. Schedule tab in sidebar shows today + tomorrow events as text list; "No events, [add appointment]" inline link on empty days.
4. "Everyone ▼" dropdown lets admin/owner filter the calendar by individual agent or all agents; team members see only their own.
5. Day view: All Day row shows all-day events as full-width blue banners; hourly grid shows timed appointments as colored blocks in correct time slots.
6. Month view: events render with colored dots per taxonomy (appointments=blue, tasks=yellow, closings=orange, custom=purple, plus observed amber for lead follow-up); all-day events render as blue pills/text; overflow cells show "N More" link.
7. Today's date is circled/highlighted in both the mini-calendar and the main calendar grid.
8. Create Appointment modal opens on `+` click or "add appointment" link; all 16 fields present and functional (title, start date, start time, end time, end date, timezone, all-day toggle, location, guest search, pre-populated current user, type dropdown, outcome dropdown, rich text notes, send invitation checkbox, Create button, X dismiss).
9. "All day event" checkbox hides time pickers and keeps only date fields.
10. Guest search finds both contacts (person_id) and team members (user_id); current user is auto-added on modal open.
11. Type dropdown lists admin-configured appointment types; Outcome dropdown lists admin-configured outcomes with "No Outcome" default.
12. Rich text notes editor supports: bold, italic, underline, bullet list, numbered list, hyperlink, strikethrough.
13. "Send invitation email & text reminder" checkbox — when checked on save — sends email to all invitee contacts (primary email only) and SMS (if Power-Up is enabled); checkbox defaults to false.
14. Appointment saves and appears on the calendar in the correct date/time slot with correct color coding.
15. Appointment appears on the linked contact's right rail and activity timeline.
16. Appointment outcome is settable after creation (edit appointment → set outcome).
17. Editing an appointment that has a pending reminder: if the "Send invitation" checkbox is unchecked, the UI warns the user before saving that the reminder will be canceled.
18. Admin CRUD for appointment types: Owner can create, edit, reorder (by order_weight), and delete types via Admin → Appointments.
19. Admin CRUD for appointment outcomes: Owner can create, edit, reorder, and delete outcomes.
20. Appointment Report: shows appointments with at least one contact invitee; filters by time frame, user, type, outcome; columns include title, people, team, created by, date/time (sortable), type, outcome, lead source, marketing source; default 40-row display with export available.
21. Google Calendar two-way sync: FUB-created appointments and tasks (with datetime) push to Google; Google Calendar Events pull into FUB (not Focus Time / OOO / Tasks / Slots); all-day events do not sync out; synced-in appointments do not appear on lead profiles but do count in Appointment Report.
22. Microsoft 365 two-way sync: requires OAuth connection (not standard email); tasks sync to "Follow Up Boss Tasks" folder; appointments sync bidirectionally.
23. Appointment Reminder Text Power-Up: account-level toggle; timing rules correct (same-day=immediate, before 8:30AM=1hr prior, after 8:30AM=8:30AM that day, all-day=12:30PM prior day); reminder text appears in contact timeline.
24. Mobile: task indicators (orange checkbox icon), FUB appointment indicators (pink circle), synced appointment indicators (green circle). Android past-appointment behavior: respect outcome field in in-house build (do not replicate Android "always overdue" bug).

---

## Part 3 — Data model summary

### 3.1 Entity relationships

```
crm_people (1) ────── (N) crm_tasks
crm_people (1) ────── (N) crm_appointment_invitees
crm_appointments (1) ── (N) crm_appointment_invitees
crm_appointments (N) ── (1) crm_appointment_types
crm_appointments (N) ── (1) crm_appointment_outcomes
crm_tasks (N) ──────── (1) auth.users [assigned_user_id]
crm_appointments (N) ── (1) auth.users [created_by_id]
```

### 3.2 Shared activity-type taxonomy

Tasks and Calendar appointment types draw from the same conceptual 8-value set:

```typescript
// Tasks: fixed enum on crm_tasks.type column
type TaskType = 'follow_up' | 'call' | 'text' | 'email' | 'appointment' |
                'showing' | 'closing' | 'open_house' | 'thank_you'

// Appointments: admin-configurable rows in crm_appointment_types table
// Display labels expected to match: Follow Up, Call, Text, Email,
// Showing, Closing, Open House, Thank You
```

The `appointment` task type value exists in the API enum but is absent from action plan step options and the Filters UI.

---

## Prior spec errors corrected

| Location | Prior spec (§9 / §10) | Corrected value |
|---|---|---|
| Overdue badge count | "248 observed" | 268 (confirmed by high-res shot-29 and GIF f02 frame) |
| Filters dropdown contents | "type/contact/source" | 8 task-type checkboxes + "Show Completed" toggle only |
| "Clear My Overdue Tasks" position | Listed in toolbar | Actually in the CONTENT AREA header (right side), not the sub-tab toolbar |
| Calendar coverage | "not directly captured in a screenshot" | Fully captured in GIF: Day view, Month view, Create Appointment modal |
| Admin appointment config location | "Appointment Stages" | **Admin → Appointments** (not "Appointment Stages") |
| Task type count | implied 8 from Filters UI | API enum has 9 (adds `appointment` type) — 8 in Filters, 9 in API |
| Month view event dot colors | not described | Amber = lead follow-up; Red = expired listing; Blue pill = all-day; per GIF |
| Create Appointment modal coverage | "inferred fields only" | Fully transcribed: 16 fields including timezone, all-day toggle, outcome, rich text notes, send invitation checkbox |
| "Appointment Reminder" source | not mentioned | Documented as a Power-Up (Admin → Power-Ups), not standard system behavior |
| Google sync: all-day events | not mentioned | All-day events do NOT sync to Google Calendar (per docs) |
| Invitation email recipients | not mentioned | Sent to primary (first) email only; secondary emails excluded (per docs) |
| Appointment Report row limit | not mentioned | Default 40 rows; full data requires export |

---

## Cross-references

- **Person detail (right rail and tasks section):** `07a-person-detail-sidebar-and-inline-edit.md`
- **Reporting — Appointments report and Agent Goals:** see `12-reporting.md` (when written)
- **Action Plans / Automations (task step creation):** see `13-action-plans-and-automations.md` (when written)
- **Admin — Appointment types + outcomes configuration:** see `15-admin-settings.md` (when written)
- **Notifications (task assignment, task due, reminder texts):** see `17-cross-cutting-systems.md` (when written)
- **Deals — Deal Closing calendar events (orange):** see `11-deals.md` (when written)
- **Twilio / SMS integration (reminder texts via Power-Up):** see `docs/plans/twilio-cutover-2026-06-24.md`

---

## Sources

| Source | Content used |
|---|---|
| `shot-29.md` | Overdue tab layout, task row anatomy (all 10 visible rows), toolbar controls, date group format, badge count (268), left panel empty state, typography/color spec, "Clear My Overdue Tasks" placement |
| `taskscal.md` (GIF analysis) | Task completion animation (strikethrough → badge decrement), Filters dropdown (all 8 types + icons + Show Completed), Future tab empty state, "How Tasks work" modal, Calendar Day view sidebar + Schedule panel, Calendar Month view event grid + dot colors + overflow, Create Appointment modal (all 16 fields transcribed), "Everyone ▼" agent filter confirmation |
| `tasks-calendar.md` (FUB official docs) | Task type API enum (9 values including `appointment`), notification rules (due time required; action plan tasks never notify), Quick Follow-Up timing immutability, completed task behavior + `completed_at` timestamp, bulk clear restriction (own tasks only), recurring tasks via Action Plans with "don't pause on reply" flag, API endpoints + filter params, appointment field schema (`invitees` array structure, `sendInvitation` param), appointment types + outcomes (admin-only CRUD, `orderWeight` auto-recalculation), time picker 30-min default, invitation email to primary email only, Google sync rules (6-month window, Event types only, all-day exclusion, lead profile hidden), MS365 OAuth requirement + "Follow Up Boss Tasks" folder, Calendly passthrough-only, Appointment Report 40-row limit + columns + count rule, Reminder Text Power-Up timing rules + re-edit gotcha, mobile visual indicators, Android past-appointments-as-overdue behavior, Daily Hot Sheet 5-task cap |
| `FUB_CRM_FEATURE_SPEC.md §9 + §10` | Prior spec used as baseline; all errors from prior spec listed in the corrections table above |
