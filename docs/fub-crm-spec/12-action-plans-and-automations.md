# 12. Module: Action Plans & Automations (the follow-up engine)

> **Cross-references:** People list bulk actions §05 (Apply Action Plan row action). Contact right rail §07c (Automations tile, Action Plans tile). Templates §14. Gap map §21.

---

## Purpose

This module is the follow-up engine — the system that decides what touch happens next, when, and to whom without an agent having to remember. A developer who has never seen FUB must be able to build a fully equivalent engine from this section alone. The spec covers every UI surface (list pages, visual editor, apply modal, admin overview entry point, action plan detail), the full trigger/condition/action inventory, all execution rules (timing, caps, suppression, deduplication, chaining), the enrollment state machine, the migration from Action Plans v1 to Automations 2.0, and the data schema needed to implement all of the above.

---

## 12.0 Two-system context (required to understand the module)

FUB has three overlapping automation layers that are converging. All three must be understood to build parity.

### 12.0.1 Action Plans (original system, now legacy)

A **scheduled drip sequence** applied to a contact. Steps fire on a day-offset schedule (day 0 = immediately, day N = N calendar days after activation). Action Plans are **not event-driven** — they are started at a moment and then run a clock. FUB's own glossary: "Action Plans automatically do a series of actions with your lead. They're most commonly used to help engage new leads by sending an initial text or a series of drip emails."

Action Plans exist at Admin > Action Plans. After a Ryan Realty account migrates to Automations 2.0 (one-way, irreversible), Action Plans become read-only — you can pause, resume, or delete enrollments but cannot edit plans, create new ones, or start them manually.

### 12.0.2 Automations v1 (event-driven, single-action, now legacy)

An **event → condition → single action** rule. One action per automation rule. Simpler than Action Plans. Lives at Admin > Automations (v1 path). Triggers: Stage Changed, Tag Added, Deal Stage Changed, Property Saved/Viewed, New Inquiry, Calendar Date.

### 12.0.3 Automations 2.0 (current system — primary target for parity)

A **visual workflow builder** that merges and supersedes both. Adds multi-step sequences, granular time delays (days/hours/minutes), new action types (appointment trigger, Run Automation chaining, mass apply), and a dot-grid canvas drag-drop editor. This is what FUB shows at `/2/automations/v2`. Ryan Realty's account as observed has 38 automations in this system.

**Migration is one-way and irreversible.** After migration: Action Plans freeze (read-only), API action plan endpoints redirect to the new automations endpoint, third-party Zapier/Make integrations built on action plan API calls need to be rebuilt using tag-based triggers.

**Build recommendation:** Design the in-house engine around the Automations 2.0 model from day one. Action Plans v1 is a legacy path FUB itself is deprecating. The existing `crm_sequences` schema already aligns to this model.

---

## 12.1 Admin Overview entry point

URL: `/2/adminoverview`, tile hub. The **Follow Up** section contains four cards:

| Card | Admin description text |
|---|---|
| Action Plans | "Send personalized drip emails, setup tasks, change stages & more." |
| Automations | "Trigger action plans & quick actions when a stage changes or other trigger events." |
| Email Templates | (separate §14) |
| Text Templates | (separate §14) |

In the RR design system: render each card as a `<Card>` from `@/components/ui/card` with navy `#102742` card title in Geist 600, muted-foreground description text, and an arrow link. Hover: `--shadow-md`.

---

## 12.2 Automations list page (`/2/automations/v2`)

### 12.2.1 Page header

Left: page title "Automations" (Geist 700, `text-foreground`).
Right: two `<Button>` controls:
- **Create Folder** — ghost/outline variant, opens a Create Folder modal (name input + Save)
- **Create Automation** — filled primary variant (`bg-primary text-primary-foreground`), opens the new-automation name dialog then routes to the visual editor

A search input may appear between the header and the table (not confirmed as always-visible; may be within filter controls).

### 12.2.2 Folder card

Immediately below the header, before the table, a folder summary card is shown. Observed text:

> **My Automations**
> 6 Automations

Render as a `<Card>` with folder icon and count badge. Clicking navigates to the folder-filtered view.

### 12.2.3 Automations table — exact columns

The table has 10 columns in this left-to-right order:

| # | Column header | Type | Notes |
|---|---|---|---|
| 1 | Name | Text (link) | Automation name, clickable → editor. May carry `[DRAFT - DO NOT ENABLE]` suffix as a manual safety naming convention (not a system field — no dedicated UI to set it). Full name shown in hover tooltip if truncated. |
| 2 | Linked Automations | Pill control | Shows "Using: N ▾" where N = count of other automations this one references. Chevron opens a dropdown listing referenced automation names. If N = 0, blank. |
| 3 | Steps | Integer | Count of steps in the workflow (trigger step not counted separately — reflects action/control steps). |
| 4 | Started | Integer (link) | Count of contacts who have entered this automation. Rendered as a blue clickable number (links to filtered People list). |
| 5 | Engaged ⓘ | String "{N}+ {P}%" | N = count of contacts who replied to an automation email; P = percentage of Started. The **+** suffix on N is deliberate — it indicates a floor count, not an exact figure. If 0 engaged: displays "0%". Tooltip on ⓘ explains the metric. |
| 6 | Completed | Integer (link) | Count of contacts who finished all steps. Blue clickable link. |
| 7 | Created By | Avatar + name | Agent avatar (photo) for user-created automations; "FU" system avatar for FUB-provided library automations. "FU" badge is a dark circular avatar with the initials "FU" in white. Matt Ryan's personal automations show his profile photo. |
| 8 | Status | Toggle | Binary enabled/disabled toggle. The toggle switch is the only interactive control in this column. **Optimistic UI**: flip happens immediately in the UI; revert to previous state on API error. Enabled automations execute; disabled automations do not (even if trigger fires). |
| 9 | Created On | Date (sortable) | Shows date. Column header has ↕ sort control. Default sort is Created On descending. |
| 10 | Actions | Icon menu | Three-dot or icon row: Edit (pencil → routes to `/v2/edit/{id}`), Duplicate, Move to Folder, Delete. |

**Column Implementation Notes:**
- Use `<Table>` from `@/components/ui/table` with `tabular-nums` on numeric cells.
- "Started" and "Completed" link to People list filtered to that automation's enrollees (see §05 People list filter).
- The Linked Automations pill "Using: N ▾" is a `<DropdownMenu>` trigger from `@/components/ui/dropdown-menu`, rendered as a pill (`rounded-full bg-secondary text-secondary-foreground text-sm`), opens a menu listing referenced automation names.
- Status toggle: use `<Switch>` from `@/components/ui/switch`. Bind optimistically; catch API error and revert.
- The Engaged column is NOT a simple count — it deliberately uses the "N+" floor format indicating the count may have grown since last cached. Render exactly as "{count}+" with the "+" character, followed by a space, then "{pct}%".

### 12.2.4 Verified 38-automation roster (as observed)

The count "38 Automations" is confirmed across two independent sources (screenshot shot-34 header text + GIF sequence admin2). Below is the full observed list in approximate table order:

| Name | Started | Engaged | Completed | Created By | Status |
|---|---|---|---|---|---|
| Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE] | — | — | — | Matt Ryan | Disabled |
| Seller LP Nurture — audience:seller [DRAFT - DO NOT ENABLE] | — | — | — | Matt Ryan | Disabled |
| Ryan Realty - Nurture Contact (General) | — | — | — | FU system | — |
| Ryan Realty - Expired Spring Strategy | — | 108+ 99% | 1 | Matt Ryan | — |
| Ryan Realty - Remote Home Owner | 82 | 28+ 3% | 724 | Matt Ryan | — |
| Ryan Realty - New Seller | — | — | — | Matt Ryan | — |
| Unsubscribed | — | — | — | Matt Ryan | — |
| Nurture Long Term Buyers | — | — | — | Matt Ryan | — |
| Open House Follow Up | — | — | — | Matt Ryan | — |
| Open House Leads | — | — | — | Matt Ryan | — |
| Start Post Closing Follow Up | — | — | — | Matt Ryan | — |
| Post Closing Plan | — | — | — | Matt Ryan | — |
| New Inquiry for an existing lead: Foll. (name truncated) | — | — | — | FU system | — |
| (25 additional automations filling the 38 total, including FUB library imports and user-created automations observed after library import) | — | — | — | — | — |

The 13 rows above are confirmed by name from screenshots. The remaining 25 were present in the table but not individually captured. Post-library-import count grew from 19 → 38 as user imported automations from the FUB Library — each library import creates a user-owned copy.

**Note on naming convention:** `[DRAFT - DO NOT ENABLE]` and `[DAILY - DO NOT ENABLE]` are **freeform name suffixes only** — no system field, no dedicated UI control, no special status. The automation's Status toggle is the only enable/disable mechanism. The bracket text is a human team safety protocol. Do NOT add a dedicated "draft mode" system field to model this; it is a naming convention. The `<Badge>` display can optionally parse and highlight this suffix in `text-muted-foreground` if desired.

### 12.2.5 Loading states

Three loading patterns observed across the admin area:
- **Pattern A** — full-page spinner (initial page load)
- **Pattern B** — inline dots (list refresh)
- **Pattern C** — table skeleton rows (preferred for table loads): render 6–8 `<Skeleton>` rows from `@/components/ui/skeleton` at table height before data arrives

---

## 12.3 Automations Library (`/admin/automations/library`)

A separate full page (not a modal). Accessed via a "Browse Library" or equivalent link from the Automations list page.

### 12.3.1 Left sidebar

Two top-level tabs:
- **FUB** — pre-built automations from Follow Up Boss
- **Community** — user-contributed automations

Eight sidebar category filters (below the tabs):
1. Lead Assignment
2. Lead Disposition
3. Drip Campaign
4. Lead Management
5. Lead Behavior
6. Transaction Management
7. Internal Operations / Admin
8. Other

### 12.3.2 Library cards

Each card shows:
- Automation name
- **FU** badge (system creator identifier)
- Description text
- Creation date
- "View automation →" link

Loading state: full-page "Please wait..." text while library loads.

### 12.3.3 Import behavior

Clicking a library automation and importing creates a **user-owned copy** in the user's account. The original FUB template is not linked — the copy is independent. This is how Ryan Realty's count grew from 19 → 38 automations after a library browse session.

Imported automations show the "FU" system avatar under Created By in the table, even though they now belong to the user's account (the avatar identifies original authorship, not current ownership).

### 12.3.4 Import All Steps

Separate from the library: inside the visual editor, when creating a new automation, there is an **Import All Steps** option that copies the full step sequence from an **existing active automation in the same account** into the current one. This is a **one-time snapshot copy** at build time — not a live link. The imported steps can then be modified freely.

---

## 12.4 Automation visual editor (`/2/automations/v2/edit/{id}`)

### 12.4.1 Three-column layout

The editor is a full-viewport three-column layout with no outer scrollbar:

```
┌─────────────────────┬──────────────────────────────┬────────────────────────┐
│  Left palette       │  Canvas (dot-grid)           │  Right config panel    │
│  ~22% width         │  ~48% width                  │  ~30% width            │
│  scrollable         │  pannable + zoomable         │  scrollable            │
└─────────────────────┴──────────────────────────────┴────────────────────────┘
```

**Top bar** (above all three columns, full width):
- Left: "← Back to Automations" text link
- Center: Automation name (editable inline text field)
- Right: **Enabled / Disabled** toggle (same `<Switch>` pattern as the list; this is the live publish control — enabling here activates the automation)

### 12.4.2 Left palette — two-tab structure

The left palette has two tabs at the top:

**Tab 1: Triggers**
Lists all trigger types. Clicking a trigger type places it on the canvas as the root node (or configures the existing trigger). Trigger types: Stage Changed, Tag Added, Deal Stage Changed, Property Saved, Property Viewed, New Inquiry, Calendar Date, Appointment (with sub-options), Manual.

**Tab 2: Steps**
Two sections with a section header and drag handles on each tile:

**Controls section:**
- **Conditions** — description: "Either condition is true or false". A filter gate — the contact must meet the condition criteria to continue through this branch. Adds a branch/fork to the canvas.
- **Time Delay** — description: "Wait before starting the next step. Set a delay or pick a time to run." Configurable in days, hours, or minutes. Appears as an orange oval badge on the canvas connector line between the preceding and following step cards.

**Actions section:**
- Send Email
- Reassign Agent or Lender
- Add Collaborators
- Remove Collaborators
- Add Tags
- Remove Tags
- Create Task
- Change Stage
- Add Note
- Pause Action Plans
- Pause Automations
- Run Automation

Each tile has:
- A descriptive icon (left)
- The step name (Geist 500)
- A drag handle (⠿ dots, right) for drag-to-canvas behavior

Drag behavior: when dragging a step tile from the palette onto the canvas, the tile shows a **blue dashed border** during the drag operation (visual affordance for the dragged state). Implementation: use `@dnd-kit/core` or `react-dnd`; the dragged tile clone follows the cursor; valid drop zones highlight on the canvas connector lines.

### 12.4.3 Canvas

**Background:** dot-grid pattern (CSS `radial-gradient` of tiny dots, navy `rgba(16,39,66,0.15)` on cream `#faf8f4` background).

**Content structure** (top to bottom, vertically centered):

1. **Trigger card** — rounded rectangle card at the top. Shows trigger type name and configuration summary. Example: "Tag Added / When tag is one of: audience:buyer". Click to open trigger config in the right panel.

2. **Step cards** — rectangular cards connected by vertical lines. Each card shows:
   - Step type icon (left)
   - Step name (e.g. "Send Email")
   - Template/config summary (e.g. "BL-01 Your Bend search is set up")
   - Click → selects step and populates right config panel

3. **Connector lines** — vertical lines between step cards. When a Time Delay step is configured, an **orange oval badge** appears on the connector line showing the delay duration (e.g. "9 days", "11 days", "2 days"). The orange badge uses `bg-orange-500 text-white rounded-full px-2 py-0.5 text-xs`. Zero-delay steps have no badge (or show "0 days" badge omitted for cleanliness).

4. **Drop zone indicator** — when dragging a step tile, the valid connector lines between existing steps highlight as drop targets (dashed line thickens or changes color).

**Observed step sequence for "Buyer LP Nurture" (automation ID 110):**
```
Trigger: Tag Added / When tag is one of: audience:buyer
  ↓
Send Email: BL-01 Your Bend search is set up (0 days)
  ↓
Create Task (0 days)
  ↓
[orange badge: 9 days]
Send Email: BL-02 (9 days after prev)
  ↓
[orange badge: 11 days]
Send Email: BL-03 (11 days after prev)
  ↓
Send Email: BL-04
  ↓
Send Email: BL-05
  ↓
[further steps]
```

**Canvas zoom controls** (bottom of canvas, right side):
- **+** (zoom in button)
- **–** (zoom out button)
- **Fit to screen** icon — fits the full step sequence into the visible canvas viewport
- **Fullscreen** icon — expands canvas to browser fullscreen

Canvas zoom is implemented via CSS `transform: scale(N)` on the canvas container. At 25% zoom the full sequence is visible in a compact view. The canvas itself is pannable (drag to pan when not dragging a step).

### 12.4.4 Right config panel — per step

When no step is selected, the right panel shows general automation settings or is empty. When a step card is clicked, the right panel populates with that step's configuration form.

**Send Email config panel (fully documented):**

```
[Step label: "Send Email"]

Template
[Searchable picker dropdown]
"BL-01 Your Bend search is set up"

From
[Dropdown with person icon]
"Agent assigned to the contact"

Recipient Preferences
  ● Send to primary contact only        ← default selected
  ○ Send to contact and all relationships
  ○ Send to assigned agent

Delivery Preferences
  ● Send immediately                    ← default selected
  ○ Send between 8:00 am and 7:00 pm
  ○ Send during company office hours    ← GREYED OUT / DISABLED (not available at Ryan Realty plan)
  ○ Send at custom time

[trash icon]  Delete step              ← danger/destructive, red text
```

Field-by-field implementation:

**Template picker:**
- A searchable `<Select>` or combobox. Shows template name in selected state. On open: renders a scrollable list of all email templates in the account, searchable by name/subject. Fetches from `GET /email-templates`.
- Observed template naming convention for Ryan Realty automations: `BL-01` through `BL-06` (Buyer Lead email series), `BL-S1`, `BL-S2` (SMS templates in the email template list with `[SMS]` suffix), `EXP-1` through `EXP-7` (Expired series).
- Templates not found = automation step will fail at send time with "Deleted email template" error.

**From dropdown:**
- Single-select `<Select>`.
- Options include "Agent assigned to the contact" (with person icon, shown as default).
- May include specific team member names and configured email addresses.
- The sender identity resolves at email send time to the agent assigned to the contact at that moment — important after reassignment steps.

**Recipient Preferences (radio group):**
- Three options, radio button UI (`<RadioGroup>` from shadcn/radix).
- Default: "Send to primary contact only" — sends to the primary email address on the contact record.
- "Send to contact and all relationships" — sends to all email addresses on the contact's profile including relationship emails (spouse, co-buyer, etc.).
- "Send to assigned agent" — the email goes to the agent, not the contact. Used for internal notification automations.

**Delivery Preferences (radio group):**
- Four options.
- "Send immediately" — fires as soon as the step executes, regardless of time of day.
- "Send between 8:00 am and 7:00 pm" — queues if the step executes outside this window; sends during the next window. Window is in the assigned agent's local timezone.
- "Send during company office hours" — **disabled/greyed in Ryan Realty's configuration**. This suggests company office hours are not configured, or this feature requires a higher FUB plan tier. Render as `text-muted-foreground cursor-not-allowed opacity-50` with the radio button also disabled.
- "Send at custom time" — opens a time picker to specify an exact clock time.

**Delete step:**
- A text-link or icon button at the bottom of the panel with trash icon. Text: "Delete step" or just the trash icon.
- Color: `text-destructive` (red).
- On click: removes the step from the canvas. No confirmation modal observed — consider adding one ("Remove this step?") to prevent accidental deletion.

**Other step config panels (not fully captured, implement by analogy):**

| Step type | Key config fields |
|---|---|
| Create Task | Task type (Follow Up / Call / Email / Text / Showing / Closing / Open House / Thank You), Note/description, Assignee (default: assigned agent), Due date offset |
| Reassign Agent or Lender | Target: specific agent, group (round-robin or FTC), or pond; optionally remove current lender |
| Add Tags / Remove Tags | Multi-select tag picker (searchable, from account tags) |
| Add Collaborators / Remove Collaborators | Multi-select team member picker |
| Change Stage | Single-select stage picker (account's pipeline stages) |
| Add Note | Textarea for note body; optional notification toggle (notify assigned agent/lenders/collaborators) |
| Time Delay | Number input + unit select (days / hours / minutes) |
| Conditions | Filter builder (same filter system as Smart Lists — see §06b) |
| Pause Action Plans | Toggle: "Pause all action plans" vs "Pause specific action plan" (name picker) |
| Pause Automations | Toggle: "Pause all automations" vs "Pause specific automation" (automation picker) |
| Run Automation | Single-select picker of active automations in the account (only active automations appear) |

---

## 12.5 Action Plans (legacy construct — read-only post-migration)

### 12.5.1 Navigation

URL: `/2/action-plans` (or Admin > Action Plans). Admin-only access. Agents can view but cannot create or edit (unless Agent Action Plans Power-Up is enabled — see §12.10).

### 12.5.2 Migration banner

At the top of the Action Plans page, a dismissible banner reads:

> "Action Plans have been migrated to Automations as part of the Automations 2.0 feature, you can now find all your Action Plans in the 'Migrated Action Plans' folder on the Automations page."

Render as an `<Alert>` from `@/components/ui/alert` with an info icon. Include a dismiss (×) button. Once dismissed, store dismissal in `localStorage` or user preferences to prevent re-display on each page load.

### 12.5.3 Folder structure

The Action Plans page has a left sidebar with folders. Observed at Ryan Realty:

| Folder name | Count | Type | Controls |
|---|---|---|---|
| All Action Plans | 7 | System (read-only) | No drag handle, no edit, no delete |
| My Action Plans | 7 | System (read-only) | No drag handle, no edit, no delete |
| KTS Action Plans | 0 | User folder | Drag handle (⠿), edit icon, delete icon |
| KTS Action Plans - Client to Review for Compliance | 0 | User folder | Drag handle (⠿), edit icon, delete icon |
| Follow Up Boss | 0 | User folder | Drag handle (⠿), edit icon, delete icon |

System folders are pinned at the top and cannot be reordered, renamed, or deleted. User folders support drag-to-reorder, edit (rename), and delete. "All Action Plans" shows all plans in the account regardless of folder. "My Action Plans" shows only plans created by the viewing user.

**Implementation:** render folder list using `<Accordion>` from `@/components/ui/accordion` or a static list; use `@dnd-kit` for user-folder drag-reorder. System folders render with `cursor-default` and no affordance controls.

### 12.5.4 Action Plan list table

Columns (in order):

| Column | Type | Notes |
|---|---|---|
| □ | Checkbox | Multi-select for bulk actions |
| Name ↑ | Text (link) | Plan name, sortable. Arrow ↑ indicates current ascending sort. Clickable → opens plan detail. |
| Active | Integer | Count of contacts currently running this plan |
| Engaged ℹ | String "N · P%" | N = contacts who replied to an action plan email; P = percentage. **Format: middle dot separator (·) between count and percentage — different from the Automations list which uses "N+ P%".** Tooltip on ℹ explains. |
| Complete | Integer | Contacts who finished all steps |
| Category | Text | Action plan category label (if set) |
| Actions | Icon row | Eye icon (preview/view) + trash icon (delete) |

Observed 7 plans in "My Action Plans" (all created by Matt Ryan, all showing 0 stats):

| Name | Steps | Category |
|---|---|---|
| Buyer Lead — Master Workflow | 11 | — |
| Expired Recovery (auto) | 10 | — |
| FSBO Recovery (auto) | 10 | — |
| Neighborhood Resident Nurture | 12 | — |
| Out-of-State Owner Nurture | 4 | — |
| Seller Lead — Master Workflow | 9 | — |
| Sphere Nurture | 6 | — |

Note: the Engaged format "0 · 0%" uses a middle dot (`·` U+00B7) as separator, **not** the "N+" format used in the Automations table. These are two different display formats in two different tables. Implement both exactly as observed.

### 12.5.5 Plan-level settings (at creation/edit time)

When creating or editing an action plan, four plan-wide settings are configurable:

| Setting | UI control | Default | Behavior |
|---|---|---|---|
| Name | `<Input>` | (required) | Identifies the plan in lists and dropdowns |
| Auto-pause on lead response | `<Checkbox>` | Off (unchecked) | When checked: pauses the plan when the contact replies by **email**, **text**, or completes a **phone call exceeding 2.5 minutes** (must be logged via FUB's built-in calling feature — manually logged calls do NOT trigger this). Voicemails and calls under 2.5 min do not trigger pause. |
| Include all email addresses | `<Checkbox>` | Off | When checked: email steps send to all email addresses on the contact's profile, including relationship addresses — not just the primary address. |
| Share with everyone | `<Checkbox>` | Off | Makes the plan visible to all team members under All Action Plans. |

Folder assignment: set at creation or later via the folder sidebar or mass actions.

### 12.5.6 Action Plan step types — complete enumeration

Each step has a **day offset** (integer, 0 = immediate) and one of the following action types:

| Step type | Config fields | Notes |
|---|---|---|
| Send Email | Email template picker (searchable), merge fields auto-resolved | Unsubscribe link appended automatically, cannot be removed. Editing a template affects all future sends of that template across all plans. |
| Create Task | Task type enum (Follow Up / Call / Email / Text / Showing / Closing / Open House / Thank You), description/note, assignee | No notification sent when plan creates a task (unlike manual task assignment). Tasks appear ~4–5 AM on due date. |
| Change Stage | Target stage picker | Stage change posts to contact timeline. |
| Add Note | Textarea body | Notifies assigned agent, lenders, ponds, and collaborators via email + bell notification. |
| Add Tag(s) | Multi-tag picker | Tags added immediately at step execution. Useful for triggering downstream automations (Tag Added trigger). |
| Remove Tag(s) | Multi-tag picker | Removes specified tags. |
| Remove All Tags | No config | Strips all tags from the contact. |
| Add Collaborators | Multi-user picker | Collaborator added; they receive bell + email notification. |
| Remove Collaborators | Multi-user picker | Removes specific collaborators. |
| Remove All Collaborators | No config | Strips all collaborators. |
| Pause All Other Action Plans | No config | Pauses every other currently-running action plan on the contact. |
| Pause Specific Action Plan | Plan name picker | Pauses one named plan currently running on the contact. |

### 12.5.7 Action Plan detail page (step timeline view)

The plan detail page shows a **vertical connector timeline** — a vertical line with step cards hanging off it. Visual encoding:

- **Purple circle** = task step
- **Blue circle** = email step
- **Gray clock icon** = delay / time offset indicator between steps

Each step card shows:
- Day offset (e.g. "Day 0", "Day 3", "Day 7")
- Action type label
- Step content preview (email subject line or task description)
- For email steps: a preview of the full email body including merge field tokens (e.g. `%contact_first_name%`, `%customBuyerSearchAreas%`)

The step timeline is the primary editing surface for Action Plans. Steps can be reordered by drag. New steps added via "+ Add Step" at the bottom or between existing steps.

### 12.5.8 Applying an Action Plan to a contact (pre-migration manual flow)

**Before Automations 2.0 migration:**
- Contact profile → Action Plans tile (right rail) → blue + icon → select plan → "Activate Plan"
- The same plan can be applied to the same contact more than once (creates a new independent enrollment)
- No bulk apply: the UI does not offer mass action plan application to multiple contacts at once

**After Automations 2.0 migration:**
- The "Manually Apply Action Plan" option is removed from the contact profile
- "Create Action Plan" button removed from Admin UI
- Apply Automation modal (§12.6) replaces both

---

## 12.6 Apply Automation modal (from contact detail page)

Triggered from: contact profile page → Automations tile (right rail) → "+" button. Also available as a bulk action on the People list (§05, "Apply Action Plan" row action).

### 12.6.1 Modal anatomy

```
┌────────────────────────────────────┐
│ Apply Automation               [×] │
├────────────────────────────────────┤
│ [🔍 Search automations...]         │
├────────────────────────────────────┤
│ ○ Stale Lead Engagement            │
│ ○ Buyer Long Term Nurture          │
│ ○ Open House Follow Up             │
│ ○ Open House Leads                 │
│ ○ Post Closing Plan                │
│ ○ Unconverted and active now. Call!│
│ ○ Birthday Email - Start by Autom… │
│ ○ Assign to a lender               │
│  ↕ (scrollbar — more items below)  │
├────────────────────────────────────┤
│ [Cancel]              [Apply]      │
└────────────────────────────────────┘
```

**Dimensions:** ~380px wide. Centered in viewport.

**Visual treatment:**
- `bg-card` (white) background
- `--shadow-lg` drop shadow (navy-tinted)
- `border-radius: 8px` (`rounded-xl` / `rounded-lg`)
- `rgba(0,0,0,0.5)` scrim over the full page

**Header:**
- Title: "Apply Automation" in Geist 600
- × close button (top-right)

**Search field:**
- `<Input>` from `@/components/ui/input` with magnifying glass icon prefix
- Placeholder: "Search automations..."
- Auto-focused on modal open
- Filters the list below in real time

**Automation list:**
- Single-select radio group (`<RadioGroup>` from shadcn/radix)
- Each row: radio button + automation name
- Only **active automations with a manual trigger** appear in this list (inactive automations and automations without a manual trigger are excluded)
- List is scrollable when items exceed modal height (scrollbar visible)
- No folder structure in this modal — flat list of eligible automations

**Footer buttons:**
- Left: "Cancel" — ghost/text button variant, closes modal
- Right: "Apply" — filled pill button (`rounded-full`, `bg-primary text-primary-foreground`). Disabled until a selection is made. On click: enrolls the contact in the selected automation, closes modal, updates the Automations tile on the contact profile.

**Observed automation names in the apply list** (from contact Laurie McAdam, person ID 27022):
1. Stale Lead Engagement
2. Buyer Long Term Nurture
3. Open House Follow Up
4. Open House Leads
5. Post Closing Plan
6. Unconverted and active now. Call!
7. Birthday Email - Start by Automations
8. Assign to a lender
(plus additional items below the scroll)

---

## 12.7 Trigger types — complete enumeration

### 12.7.1 All triggers (Automations 2.0)

| Trigger | Configuration | OR logic |
|---|---|---|
| **Stage Changed** | Select target stage(s) from account pipeline | Multiple triggers on one automation = OR gate |
| **Tag Added** | Select specific tag(s) — automation fires when any of the listed tags is added | Same |
| **Deal Stage Changed** | Select deal pipeline stage(s) — fires on transition, NOT on deal creation | Same |
| **Property Saved** | No additional config (requires FUB Pixel) | Same |
| **Property Viewed** | No additional config (requires FUB Pixel) | Same |
| **New Inquiry** | Sub-type: Registration / Inquiry / Seller Inquiry / Property Inquiry / General Inquiry | Same |
| **Calendar Date** | Custom date field picker + day offset (N days before/after) + "Occurs Every Year" annual recurrence toggle. Fires at **8 AM company timezone** | Same |
| **Appointment** | Sub-options: (a) Appointment created, (b) Before appointment time (N days/hours/minutes), (c) At appointment time, (d) Appointment outcome is [specific outcome] | Same |
| **Manual** | No trigger event — required for: (a) manually applying from a contact profile, (b) mass-apply to multiple contacts, (c) Lead Flow source automation assignment | Same |

**OR logic rule:** Multiple trigger types can be added to one automation. The automation fires if **any one** trigger fires and all conditions are met. There is no AND logic between triggers.

### 12.7.2 Calendar Date trigger specifics

- Fires at **8:00 AM in the company's configured timezone** (Pacific Time at Ryan Realty), not per-contact timezone.
- Day offset: N days before (negative offset) or after (positive offset) the custom date field value.
- Annual recurrence: "Occurs Every Year" toggle — when on, the automation re-fires each calendar year that the contact has the date field set. Enables birthday and close anniversary automations.
- Default: fires once per person per automation unless annual recurrence is enabled.

### 12.7.3 Appointment trigger specifics

- "Before appointment time": when this trigger fires, a future job must be scheduled at `(appointment_datetime - offset)`. This requires a job scheduler (BullMQ or pg_cron) — not a simple event bus entry.
- "At appointment time": fire exactly at the appointment's datetime.
- "Appointment outcome is": fires after the appointment is marked with a specific outcome (e.g. "Met", "No Show"). This is an outcome-change event, not a time-based event.

---

## 12.8 Condition system

Conditions add an **AND gate** to the trigger — all conditions must be true at the moment the trigger fires for the automation to proceed. Conditions are optional. Multiple conditions are ANDed together.

The condition filter system is **identical** to the Smart Lists filter system (§06b). Every filter available in Smart Lists is available as a condition. The full list (20+ categories, 60+ individual filters) is specified in §06b and is not repeated here — the implementation should share the same filter component.

**Key condition categories:**
- Contact details (name, phone, email, address, price, tags, stage, source, created/updated dates)
- Activity (inactive since N days, last activity, last communication by type)
- Assigned (agent, pond, lender, collaborators)
- Email metrics (sent/received counts, opens, clicks, last action plan email)
- Call metrics (call counts, duration, time to first call)
- Text metrics (sent/received counts)
- Website activity (properties viewed/saved, pages viewed, visits — requires FUB Pixel)
- Deals (deal stage, close date, price)
- Custom fields (text, date, number, dropdown — each with type-appropriate operators)

---

## 12.9 Execution engine behavior

This section covers every runtime rule that governs how automations and action plans fire. Each rule below is a **hard implementation requirement** — not optional behavior.

### 12.9.1 Who triggers automations (critical boundary)

**Automations fire only for contacts already in the system.** They do NOT fire for:
1. Net-new contacts imported in bulk
2. Contacts manually added to the system
3. New contacts arriving via API (`POST /v1/events` creates the contact and starts Lead Flow, not automations)
4. New contacts arriving via email parsing
5. During mass actions applied outside the automation system

For brand-new incoming contacts, **Lead Flow** (not Automations) is the mechanism. This is the single most common implementation confusion. The in-house system must enforce this boundary: the automation trigger evaluator must check that the contact's record exists and has a non-zero `created_at` before the current event time.

### 12.9.2 Enrollment methods

**Automatic enrollment (event-triggered):**
- The trigger event fires for an existing contact.
- All conditions on the automation are evaluated against live contact data at trigger time (not cached).
- If all conditions pass, the contact is enrolled.
- "Run once per contact" default prevents re-enrollment unless the setting is overridden.

**Manual enrollment (from contact profile):**
- Contact profile → Automations tile → "+" → Apply Automation modal (§12.6) → select automation → Apply.
- Only automations with a **manual trigger** appear in the list.
- Only **active** automations appear.

**Mass enrollment (from People list):**
- People list → apply Smart List or filters → select contacts → Mass Actions > Apply Automation → choose automation → Apply.
- Requires the automation to have a **manual trigger** (automations without it do not appear in the selection list).
- No documented hard cap on contact volume; email sending caps still apply (10,000/day/user for mass operations).

**Lead Flow enrollment (automatic for new contacts from a specific source):**
- Configured per lead source under Lead Flow settings (Admin > Lead Flow).
- Each lead source maps to exactly one automation (must have manual trigger).
- New contacts from that source are auto-enrolled at creation time.
- Only **one automation per lead source** (workaround for needing two: add a tag step in the first automation that triggers a second automation via Tag Added trigger).

### 12.9.3 Enrollment state machine

```
         [trigger fires / manual apply]
                    |
              PENDING (queued)
                    |
             [executor picks up]
                    |
              RUNNING ──────────────────► COMPLETED
                    |                        (all steps executed)
           [reply received]
                    |
              PAUSED ──────────────────► RUNNING (manual resume)
                    |
           [manually stopped or deleted]
                    |
              STOPPED (terminal)

         ─────────────────────────────
         SUPPRESSED (terminal) — set when:
           - contact email is unsubscribed
           - contact SMS opted out (for text steps)
           - hard bounce on file
         ─────────────────────────────
```

**State transitions:**
- `RUNNING → COMPLETED`: all steps in the sequence have executed without error
- `RUNNING → PAUSED`: stop-on-reply triggered (inbound email, inbound text, or call > 2.5 min via system calling)
- `PAUSED → RUNNING`: agent manually resumes from contact profile
- `RUNNING → STOPPED`: agent manually removes the automation from the contact
- Any state → `SUPPRESSED`: compliance block activated (unsubscribe, opt-out, bounce)

**DB columns needed per enrollment row:** `id`, `person_id`, `automation_id`, `status` (enum: running | paused | completed | stopped | suppressed), `started_at`, `paused_at`, `resumed_at`, `completed_at`, `current_step_index` (0-based), `started_by` (enum: automatic | manual | mass_apply | lead_flow), `stopped_by` (nullable user FK or 'system').

### 12.9.4 Stop-on-reply

When "auto-pause on lead response" is enabled (on Action Plans) or when the enrollment's automation has stop-on-reply configured:

**Pause triggers:**
- Inbound email reply (any reply to any email in the thread)
- Inbound text message from the contact
- **Phone call exceeding 2.5 minutes duration** — AND only if the call was logged via FUB's built-in calling feature or mobile app. Manually logged calls (added as notes) do NOT trigger pause.

**Does NOT pause:**
- Contact opens an email without replying
- Contact clicks a link in an email
- Contact views a property (website activity)
- Phone calls under 2.5 minutes
- Voicemails

**Implementation:** listen to the `inbound_email`, `inbound_text`, and `call_completed` events in the event bus. On `call_completed`, check `duration_seconds > 150` AND `source = 'system_call'` (not 'manual'). For matching events, query all RUNNING enrollments for the person and transition them to PAUSED.

### 12.9.5 Email send timing

**Action Plan emails:**

| Step day offset | Send behavior |
|---|---|
| Day 0 | **Immediately** when the plan is applied. No queue, no window restriction. Fires even if applied at midnight. |
| Day 1 (not standard) | Not typically used, but would follow day 2+ rules |
| Day 2+ | Sends in the window **11:30 AM – ~5:00 PM Eastern time** on the scheduled day. If the step comes due outside this window, it queues and sends when the window opens. |

**Non-email action steps (tasks, stage changes, notes, tags, collaborators, pauses):**
- Execute around **5:00 AM in the assigned agent's timezone** on the day they are due (approximately; not exact to the second).
- Task steps specifically: around **4:00–5:00 AM** on the due date.

**Note on timezone:** email steps use Eastern time (11:30 AM–5 PM ET) as a fixed window; non-email steps use the assigned agent's local timezone. These are different systems — implement them separately.

**Automations 2.0 Delivery Preferences overrides:**
- "Send immediately" — bypass all windows, send when the step executes
- "Send between 8:00 am and 7:00 pm" — queue if outside this window, send when window opens (agent's local timezone)
- "Send during company office hours" — queue if outside office hours (requires company hours to be configured)
- "Send at custom time" — send at specified clock time on the scheduled day

### 12.9.6 Daily email cap

**Hard limit: maximum 4 action plan emails to a single contact in one calendar day**, across ALL action plans and automations running on that contact simultaneously.

- If the cap is hit: the email queues with status "Will Be Sent Later" on the contact timeline.
- The queued email attempts again the next day (in the 11:30 AM–5 PM window).
- A 5th email from any plan that day is suppressed.
- **Implementation:** before dispatching each action plan email, query `COUNT(emails_sent_today WHERE person_id = X AND send_date = today AND type = 'action_plan')`. If count >= 4, skip + log "daily_cap_exceeded" status. Decrement is not needed — just count.

**Mass email cap:** 10,000 emails/day per FUB user for mass email operations (separate from action plan cap).

### 12.9.7 Email deduplication across plans

If two different action plans (or automations) both have a Send Email step pointing to the **same email template**, targeting the **same contact**, and **both execute on the same calendar day**:

- **One email is dispatched** (not two)
- **Both plans record the email as "sent"** in their step execution logs
- The contact timeline shows a single message with status "Already Sent Today" on the second plan

**Implementation:** before dispatching, query `SELECT id FROM step_execution_log WHERE person_id = X AND template_id = Y AND send_date = today AND status = 'sent'`. If a row exists, mark the current enrollment's step as "already_sent_today" and credit it as sent without sending another email.

### 12.9.8 Five-minute duplicate suppression

If the same automation would fire for the same contact within **5 minutes** of the previous time it fired (e.g., the same tag is added twice in quick succession), the second firing is **silently suppressed**.

**Implementation:** store `last_fired_at` per `(person_id, automation_id)`. On trigger event: check if `now() - last_fired_at < 5 minutes`. If true, drop the event. If false, proceed and update `last_fired_at = now()`.

### 12.9.9 100-concurrent-trigger buffer

If many contacts trigger the same automation simultaneously (e.g., a mass tag addition affects 500 contacts), the system does not execute all 500 trigger evaluations in parallel. A **100-trigger concurrent buffer** limits simultaneous execution to prevent system overload.

**Implementation:** use a job queue (BullMQ or equivalent) with a concurrency limit of 100 for automation trigger jobs. Additional jobs queue and process as slots free up. Mass actions run through the same queue.

### 12.9.10 SMS / text constraints

FUB's text infrastructure is **not for drip texting or mass texting**. Action plan text steps are individually addressed 1:1 messages to contacts with established opt-in. The following constraints apply:

**After-hours quiet window:**
- Do NOT send text messages between **9:00 PM and 8:00 AM** in the **assigned agent's local timezone** (not company timezone — different from the calendar date trigger which uses company timezone).
- Queued texts auto-send at **8:00 AM** the next morning.
- **Auto-cancel if contact made:** if any communication (email, text, or call) occurs between the agent and contact before 8:00 AM, the queued text is automatically cancelled. This prevents stale messages from firing after the agent has already been in touch.
- After-hours quiet window applies only to **text messages** — action plan **email** steps are NOT subject to this restriction (day-0 emails fire immediately even at midnight).
- If the contact's assigned agent is reassigned overnight, the queued text still fires from the **original agent** at 8 AM (queue is stamped at creation time). This is an edge-case behavior to replicate — the in-house system may improve on this by re-stamping on reassignment, but parity requires the original-agent behavior.

**A2P 10DLC requirement:**
- US carrier regulations (effective December 1, 2024) require A2P 10DLC business registration before any text messages can be sent from action plans or automations.
- Registration covers the entire account (all team members, all numbers added post-registration).
- Without registration: carriers block outbound texts from unregistered numbers.
- Ryan Realty's A2P registration is confirmed (Twilio cutover 2026-06-24 per memory `project_twilio_cutover.md`).

**Initial text suppression when triggered by automation:**
- If an action plan includes a **day-0 text message step**, that text will **NOT auto-send** when the plan is started by an Automation trigger rule.
- The day-0 initial text only fires when the plan is started via **Lead Flow** (new lead entering the system from a configured source).
- This is not visible in the UI — a builder who adds a day-0 text step expecting it to fire via automation trigger will be silently wrong. Document this constraint prominently in the step editor (tooltip/warning).

**SMS opt-out/opt-in keywords (CTIA standard):**
| Direction | Keywords | System action |
|---|---|---|
| Opt out | STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT | Set `sms_opted_out = true` on the phone number; block all future plan texts, manual texts, appointment reminder texts; show orange phone number indicator on contact profile; log to timeline |
| Opt in | START, YES, UNSTOP | Set `sms_opted_out = false`; restore text delivery; show blue phone number indicator |

### 12.9.11 Suppression gate

Before every email or text send, the system must check the compliance suppression list. Block send if any of these are true:

**For email:**
- Contact's email address has `unsubscribed = true` (clicked unsubscribe in any marketing email)
- Email address has a prior hard bounce record
- Email address marked as invalid
- Daily 4-email cap exceeded (see §12.9.6)
- Required email template has been deleted

**For text:**
- Phone number has `sms_opted_out = true`
- No A2P registration active
- Current time is in the 9 PM–8 AM quiet window (queue instead of block; cancel if contact made)

**Unsubscribe behavior:**
- Every action plan email **automatically includes an unsubscribe link** — this is mandatory (CAN-SPAM compliance). Cannot be removed.
- When a contact clicks unsubscribe: mark their email `unsubscribed = true`, apply tag "unsubscribed" to the contact, show orange email address on contact profile with tooltip "Email address unsubscribed", block all future marketing emails (action plans, batch emails). 1:1 directly composed emails can still be sent.
- Resubscribe: requires emailing FUB support (or in-house CRM: requires admin/owner action) — there is NO self-service resubscribe button in the UI.
- Unsubscribe is global for the email address: if the same email address unsubscribed in any other account (even a different FUB customer's account), delivery from Ryan Realty also fails with "Failed to Deliver."

### 12.9.12 Reassignment execution order guarantee

When an automation or action plan has both a **Reassign Agent** step and subsequent steps (Add Note, Send Email, etc.) that use merge fields referring to the assigned agent:

- **Reassignment ALWAYS executes before** the note or email steps in the same sequence
- This ensures merge fields like `%agent_first_name%` resolve to the **new assignee's** name, not the previous agent's
- Exception: with **first-to-claim (FTC)** groups, the action plan starts immediately using the current assignee's merge fields before the new agent claims the lead. This creates a potential merge field mismatch window — document as a known edge case.

**Implementation:** when executing an automation's steps, process any Reassign step first in the batch, commit the reassignment, then execute downstream steps.

### 12.9.13 "Run once per contact" default

Every automation defaults to running **at most once per contact** (not per enrollment, per contact lifetime). If the trigger fires again for the same contact (e.g., the same tag is added a second time), the automation does NOT re-run.

**Override:** a "Run even if already running" or "Run more than once" setting can be toggled on per automation. When off (default): the automation is skipped if the contact has ever previously completed or is currently running this automation. When on: re-runs on each trigger fire, as long as the automation is not currently active on the contact (or can run in parallel, depending on sub-setting).

**Warning for email-based automations:** enabling "run more than once" on an automation that starts an action plan with emails will repeatedly re-launch the drip sequence each time the trigger fires (e.g., every time a tag is added). Use with care.

### 12.9.14 Lead Flow integration with automations

Lead Flow is the new-contact entry point; Automations handles existing contacts. In Automations 2.0, both connect via **Manual trigger** automations assigned to Lead Flow sources.

- Each lead source in Lead Flow can have one automation assigned (must have manual trigger, must be active).
- Automation fires automatically for all new contacts from that source.
- **Lead Flow Delay (Beta):** up to 5-minute routing delay to consolidate multiple simultaneous events for the same lead; optional condition to wait for phone number data before routing.
- **Advanced Lead Flow Rules:** conditional routing based on tags, price range, city, state, zip, MLS number, phone number presence.

### 12.9.15 Automation chaining (Run Automation step)

The **Run Automation** step triggers another automation to run on the same contact.

- At step execution time: enroll the contact in the target automation.
- Target must be **active** at execution time — validate at execution, not at build time. If the target is inactive, log a step failure with reason "target automation inactive."
- There is no documented nesting depth limit, but cycles should be detected and blocked (Automation A → B → A would loop).
- Automation chaining is the mechanism for multi-phase sequences (e.g., nurture → re-engagement → post-closing).

### 12.9.16 Action plan de-duplication at step level

If one contact is enrolled in multiple action plans and two plans share the same underlying email template scheduled for the same day:

- One email is sent.
- Both plan enrollment records show the step as "sent" (status: `already_sent_today`).
- The contact's timeline shows one message entry.

This is not an error — it is intentional FUB behavior to prevent duplicating messages. The in-house system must implement the same deduplication check.

---

## 12.10 Permissions

| Role | Automations | Action Plans |
|---|---|---|
| Account Owner | Full CRUD; initiate migration to 2.0; mass apply; share; folders | Full CRUD (until migration); can browse/copy public library |
| Admin | Full CRUD; mass apply; share; folders | Full CRUD; can browse/copy public library |
| Agent (base) | Read-only; manually apply from own contacts (contact profile only) | Read-only; manually apply from own contacts |
| Agent + Agent Action Plans Power-Up | Read-only on automations; cannot create automations | Can create/edit own action plans; cannot edit admin-created plans; cannot create folders; cannot browse public library |
| Lender | Same as base agent | Same as base agent |

**Agent Action Plans Power-Up:** optional paid add-on enabled per user (Admin > Power-Ups). Grants agents the ability to create new action plans and edit plans they personally created. Does not grant automation creation or editing.

---

## 12.11 Data schema

The following tables are required to implement full parity. These extend the existing `crm_sequences` schema noted in the original spec.

### automations (= Automations 2.0)

```sql
CREATE TABLE automations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'inactive'
                      CHECK (status IN ('active', 'inactive')),
  run_once_per_person BOOLEAN NOT NULL DEFAULT true,
  allow_parallel_run  BOOLEAN NOT NULL DEFAULT false,
  folder_id           UUID REFERENCES automation_folders(id),
  created_by          UUID REFERENCES users(id),
  source              TEXT DEFAULT 'user'
                      CHECK (source IN ('user', 'fub_library', 'community_library')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### automation_triggers

```sql
CREATE TABLE automation_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  trigger_type    TEXT NOT NULL CHECK (trigger_type IN (
    'stage_changed', 'tag_added', 'deal_stage_changed',
    'property_saved', 'property_viewed', 'new_inquiry',
    'calendar_date', 'appointment', 'manual'
  )),
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- config examples:
  -- stage_changed: { "stage_ids": ["uuid1", "uuid2"] }
  -- tag_added: { "tag_names": ["audience:buyer"] }
  -- calendar_date: { "field_id": "uuid", "offset_days": -5, "annual": true }
  -- appointment: { "sub_type": "before", "offset_value": 2, "offset_unit": "days" }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### automation_steps

```sql
CREATE TABLE automation_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  step_order      INTEGER NOT NULL,  -- 0-based, determines execution order
  step_type       TEXT NOT NULL CHECK (step_type IN (
    'trigger', 'condition', 'time_delay',
    'send_email', 'reassign_agent', 'add_collaborators', 'remove_collaborators',
    'add_tags', 'remove_tags', 'create_task', 'change_stage', 'add_note',
    'pause_action_plans', 'pause_automations', 'run_automation'
  )),
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- config examples:
  -- time_delay: { "value": 9, "unit": "days" }
  -- send_email: { "template_id": "uuid", "from": "assigned_agent",
  --               "recipient_pref": "primary_only",
  --               "delivery_pref": "immediate" }
  -- create_task: { "task_type": "Follow Up", "note": "...", "assignee": "assigned_agent" }
  -- run_automation: { "target_automation_id": "uuid" }
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (automation_id, step_order)
);
```

### automation_conditions (conditions on an automation, ANDed)

```sql
CREATE TABLE automation_conditions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  filter_config   JSONB NOT NULL,  -- same schema as smart list filters (§06b)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### automation_enrollments

```sql
CREATE TABLE automation_enrollments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id           UUID NOT NULL REFERENCES crm_people(id),
  automation_id       UUID NOT NULL REFERENCES automations(id),
  status              TEXT NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running', 'paused', 'completed', 'stopped', 'suppressed')),
  current_step_index  INTEGER NOT NULL DEFAULT 0,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_by          TEXT NOT NULL CHECK (started_by IN (
    'automatic', 'manual', 'mass_apply', 'lead_flow'
  )),
  paused_at           TIMESTAMPTZ,
  resumed_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  stopped_at          TIMESTAMPTZ,
  stopped_by          UUID REFERENCES users(id),
  last_fired_at       TIMESTAMPTZ,   -- for 5-minute duplicate suppression check
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### automation_step_executions

```sql
CREATE TABLE automation_step_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   UUID NOT NULL REFERENCES automation_enrollments(id),
  step_id         UUID NOT NULL REFERENCES automation_steps(id),
  scheduled_for   TIMESTAMPTZ NOT NULL,
  executed_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
    'pending', 'sent', 'queued', 'failed', 'skipped',
    'already_sent_today', 'daily_cap_exceeded', 'suppressed'
  )),
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### action_plans (legacy — read-only post-migration)

```sql
CREATE TABLE action_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'deleted', 'locked')),
  -- 'locked' = post-Automations 2.0 migration (read-only)
  auto_pause_on_reply   BOOLEAN NOT NULL DEFAULT false,
  include_all_emails    BOOLEAN NOT NULL DEFAULT false,
  shared_with_team      BOOLEAN NOT NULL DEFAULT false,
  folder_id             UUID REFERENCES action_plan_folders(id),
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### action_plan_steps

```sql
CREATE TABLE action_plan_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id  UUID NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
  step_order      INTEGER NOT NULL,
  day_offset      INTEGER NOT NULL DEFAULT 0,
  action_type     TEXT NOT NULL CHECK (action_type IN (
    'send_email', 'create_task', 'change_stage', 'add_note',
    'add_tag', 'remove_tag', 'remove_all_tags',
    'add_collaborator', 'remove_collaborator', 'remove_all_collaborators',
    'pause_all_plans', 'pause_specific_plan'
  )),
  action_payload  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (action_plan_id, step_order)
);
```

### action_plan_enrollments

```sql
CREATE TABLE action_plan_enrollments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id           UUID NOT NULL REFERENCES crm_people(id),
  action_plan_id      UUID NOT NULL REFERENCES action_plans(id),
  status              TEXT NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running', 'paused', 'completed', 'stopped', 'suppressed')),
  current_step_index  INTEGER NOT NULL DEFAULT 0,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_by          TEXT NOT NULL CHECK (started_by IN (
    'manual', 'automation', 'lead_flow'
  )),
  paused_at           TIMESTAMPTZ,
  resumed_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  stopped_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### automation_folders / action_plan_folders

```sql
CREATE TABLE automation_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT false,  -- system folders cannot be edited/deleted
  folder_order INTEGER,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Seed: insert system folder 'My Automations' with is_system = true

CREATE TABLE action_plan_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  folder_order INTEGER,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Seed: insert system folders 'All Action Plans' and 'My Action Plans' with is_system = true
```

### daily_email_send_count (for cap enforcement)

```sql
CREATE TABLE daily_email_send_count (
  person_id   UUID NOT NULL REFERENCES crm_people(id),
  send_date   DATE NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (person_id, send_date)
);
-- Increment on each action plan / automation email sent.
-- Check before each send: if count >= 4, block + queue.
```

---

## 12.12 Acceptance criteria

A QA checklist against which the implemented module can be verified:

**Automations list:**
- [ ] Displays accurate "N Automations" header count
- [ ] All 10 columns render with correct types and formatting
- [ ] Engaged column shows "{N}+ {P}%" format (with literal + character)
- [ ] Linked Automations pill shows "Using: N ▾" and opens dropdown
- [ ] Status toggle is optimistic (flips immediately, reverts on API error)
- [ ] Created By shows "FU" system avatar for library-sourced automations, agent photo for user-created
- [ ] Full automation name visible on hover tooltip when truncated
- [ ] Create Automation and Create Folder controls in page header
- [ ] Folder card visible above table
- [ ] Row actions: edit, duplicate, move to folder, delete

**Visual editor:**
- [ ] Three-column layout: left palette, canvas, right config panel
- [ ] Left palette has Triggers tab and Steps tab
- [ ] Steps tab has Controls section (Conditions, Time Delay) and Actions section (9+ action types)
- [ ] Drag from left palette onto canvas places a step; blue dashed border on dragged tile
- [ ] Canvas shows dot-grid background
- [ ] Step cards connected by vertical lines with orange delay badges
- [ ] Zero-delay steps have no badge (or omit "0 days" badge)
- [ ] Clicking a step card populates the right config panel
- [ ] Send Email config: Template picker, From dropdown, 3 Recipient Preferences radio options, 4 Delivery Preferences radio options, "Send during company office hours" renders as disabled/greyed, Delete step in danger color
- [ ] Zoom controls: +, –, fit-to-screen, fullscreen
- [ ] Top bar: back link, automation name (editable), Enabled/Disabled toggle
- [ ] Automation can be saved and re-opened with all steps preserved

**Apply Automation modal:**
- [ ] Opens from contact profile Automations tile "+" button
- [ ] Modal is ~380px wide, centered, with scrim
- [ ] Search field auto-focused, filters list in real time
- [ ] Only active automations with manual trigger appear
- [ ] Single-select radio group
- [ ] List is scrollable when items exceed modal height
- [ ] Cancel closes without action; Apply enrolls and closes
- [ ] Apply button disabled until selection made

**Action Plans:**
- [ ] Migration banner visible at top of Action Plans page (dismissible)
- [ ] Folder sidebar: system folders (no controls), user folders (drag handle, edit, delete)
- [ ] Table shows all 7 columns including Engaged in "N · P%" format (middle dot separator)
- [ ] Plan detail page shows vertical step timeline with purple/blue/clock icons
- [ ] Plan-level settings: Name, Auto-pause on reply, Include all emails, Share with everyone

**Engine behavior:**
- [ ] Automations do NOT fire for brand-new contacts (Lead Flow is the mechanism)
- [ ] Stop-on-reply pauses enrollment on inbound email, inbound text, or call > 2.5 min (system call only)
- [ ] Maximum 4 action plan emails sent to one contact per day (hard enforced)
- [ ] Same template to same contact on same day sends once; both plans credit as sent
- [ ] 5-minute duplicate suppression per (person, automation) pair
- [ ] After-hours texts queued 9 PM–8 AM (agent's local timezone), auto-cancel if contact made
- [ ] Day-0 text in action plan does NOT send when started by automation trigger
- [ ] SMS opt-out keywords (STOP etc.) block all future texts
- [ ] Unsubscribe link in every action plan email; click marks address as unsubscribed
- [ ] Reassignment step executes before downstream steps in same sequence
- [ ] "Run once per contact" default prevents re-enrollment
- [ ] Run Automation step enrolls contact in target automation; target must be active
- [ ] Mass apply requires manual trigger on the automation

---

## Corrections to prior spec (§13)

The following errors in the original §13 are corrected in this section:

| Prior spec claim | Correction | Source |
|---|---|---|
| "36 Automations" (header count) | **38 Automations** (verified by screenshot header text AND GIF sequence) | shot-34, admin2 GIF |
| Table columns: "Trigger, Enrolled, completion %" | Columns are: **Name, Linked Automations, Steps, Started, Engaged ⓘ, Completed, Created By, Status, Created On ↕, Actions** — no "Trigger" column, no "completion %" column, "Enrolled" is actually "Started" | shot-34 |
| "Ryan Realty - Expired Spring Strategy (52 enrolled / 8 completed)" | Actual stats: **108+ 99% Engaged, 1 Completed** (Started count not captured) | shot-34 |
| "Best LP Nurture > audience-seller" | Correct name is **"Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]"** | shot-34 |
| URL pattern `/2/automations/2` | Observed URL is `/2/automations/v2` and editor is `/2/automations/v2/edit/{id}` | shot-35 |
| Left palette "Trigger selector + search-filterable action toolbox" (single panel) | Left palette has **two tabs** (Triggers tab, Steps tab) with separate Controls and Actions sub-sections | shot-35, shot-37 |
| Missing step types | Spec omitted: **Pause Action Plans, Pause Automations, Run Automation** (confirmed in official docs) | automations.md §4 |
| Right panel "To" field | There is NO "To" field. The correct UI has **"Recipient Preferences"** with 3 radio button options (not a "To" dropdown) | shot-36 |
| "Send during company office hours" as active option | This option is **disabled/greyed out** in Ryan Realty's configuration | shot-36 |
| Apply modal "Cancel | Apply" (no format detail) | Apply button is a **filled pill** (`rounded-full`), modal is radio-button single-select with search, ~380px wide | shot-13 |
| "Enrolled" stat column | Column header is **"Started"** (not "Enrolled") | shot-34, automations.md §7 |
| §13.1 implied Action Plans folder: 2 system folders | Observed: **5 folders total** — All Action Plans, My Action Plans (system), KTS Action Plans, KTS Action Plans - Client to Review for Compliance, Follow Up Boss (user folders) | admin1 GIF |
| Engaged format same in both tables | Automations table uses **"N+ P%"** (plus sign). Action Plans table uses **"N · P%"** (middle dot). Different formats in different tables. | shot-34 + admin1 GIF |

---

## Sources

### UI observations (verified visual evidence)

- `shot-34.md` — Automations list page: 38 automations, full table structure, row data, Linked Automations pill, Engaged "N+" format, toggle states, "FU" avatar vs Matt Ryan avatar
- `shot-35.md` — Visual editor canvas at 25% zoom: Buyer LP Nurture step sequence, left palette, Controls/Actions sections, orange delay badges, zoom controls
- `shot-36.md` — Visual editor Send Email right config panel: Template picker, From dropdown, Recipient Preferences radio group (3 options), Delivery Preferences radio group (4 options including greyed "company office hours"), Delete step control
- `shot-37.md` — Drag operation in progress: blue dashed border on dragged tile, step delays confirmed, canvas controls confirmed
- `shot-13.md` — Apply Automation modal: full UI structure, radio button list, scrollbar, Cancel + Apply (pill) buttons, scrim

### GIF analyses (dynamic behavior)

- `feat2.md` — Automations status toggle optimistic UI, loading state patterns (A/B/C), Admin Overview card hierarchy and descriptions, feat2 confirms 38 automations
- `admin1.md` — Action Plans folder list (5 folders, 2 system + 3 user), Action Plan list table columns, 7 plan names, Engaged "N · P%" format, migration banner exact text, Advanced Lead Flow Rules editor
- `admin2.md` — Action Plan detail vertical step timeline (purple/blue/clock), Buyer Lead Master Workflow email body with merge fields, Automations Library (separate page, FUB/Community tabs, 8 categories, library card format), count change 19→38 post-import
- `admin3.md`, `admin4.md` — Supporting admin patterns, tags, company settings, FUB Pixel config (corroborating context)

### Official FUB documentation

- `fub-docs/automations.md` — 39-source compilation from help.followupboss.com: all trigger types, all condition categories, all action types, enrollment rules, stats columns, 5-min suppression, 100-trigger buffer, mass action behavior, email caps, SMS compliance, date trigger timing, appointment trigger, Lead Flow integration, sharing/library, permissions, migration
- `fub-docs/action-plans.md` — 38-source compilation: plan-level settings, all step types (12 total), exact step timing (day 0 immediate, day 2+ 11:30 AM–5 PM Eastern), daily 4-email cap, deduplication logic, auto-pause thresholds (2.5 min call), unsubscribe behavior, after-hours text queuing, Lead Flow vs Automations boundary, API endpoints, permissions, Power-Up, migration impact

### Prior spec

- `docs/FUB_CRM_FEATURE_SPEC.md` §13 — original module stub, used as baseline; errors enumerated in §12.13 above
