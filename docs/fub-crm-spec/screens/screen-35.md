<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.27.26 AM.png | Sequential id: shot-35 | Tiles: fub-tiles/shot-35_{full,q1,q2,q3,q4}.png -->

# shot-35 — Action Plan / Automation Visual Builder (v2 Canvas Editor)

## Identity

- **Visible URL:** `ryan-realty.followupboss.com/2/automations/v2/edit/110`
- **Browser tab title:** "Editing - Buyer LP Nurture -…" (truncated)
- **FUB page title / header:** `/ Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]`
- **Top-nav active item:** Not visible (the full FUB left nav rail is hidden on this screen — the editor takes full width)
- **Sub-nav / tabs active:** "Steps" tab is active in the left panel (the canvas is showing the built step sequence)
- **Breadcrumb:** `← Back to Automations` (top-left of the FUB content area, plain text link with left-arrow)
- **Logged-in user:** A profile avatar is visible in the Chrome browser top-right corner ("Work" profile badge with user avatar thumbnail — this is the Chrome profile indicator, not an explicit FUB user display)
- **Account / brokerage:** Ryan Realty (inferred from bookmark bar item labeled "Ryan Realty" and the domain `ryan-realty.followupboss.com`)

---

## Layout

The screen is the **FUB v2 Automation (Action Plan) visual canvas editor**. It is a full-browser editing interface that suppresses the standard FUB left-rail CRM navigation in favor of a dedicated builder UI.

### Top region — browser chrome
- Standard Chrome top bar (tabs, URL bar, bookmarks)
- Bookmarks bar shows various team tabs: `Ben's UI business…`, `CRM Mobile UI redes…`, `Lindsay mail form…`, `Application cost an…`, plus many browser extension icons (FUB, Superhuman, Skype, Gmail, Notion, Chrome, Google, etc.) and `>> All Bookmarks`

### FUB page structure (top-to-bottom)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Automations   [breadcrumb, left-aligned, ~200px wide zone]       │
│  / Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]   DISABLED ⬛  Save Changes  ⚙  🔗  │
├──────────────────────────┬──────────────────────────────────────────────────┤
│  LEFT PANEL (~22% width) │  CANVAS (~78% width)                             │
│  ─────────────────────   │  ─────────────────────────────────────────────   │
│  [Triggers] [Steps]      │  Light gray dotted-grid background               │
│  🔍 Search               │                                                  │
│  "Drag a Step to the     │  [Trigger card]                                  │
│   canvas"                │       ↕                                          │
│  ┌─────────────────┐     │  [Step card: Send Email]                         │
│  │ ⊞ Send Email   │ ←   │       ↕                                          │
│  └─────────────────┘     │  [Step card: Create Task]                        │
│                          │       ↕  [orange badge: 2 days]                  │
│  Controls                │  [Step card]                                     │
│  ─────────────           │       ↕  [orange badge: 0 days]                  │
│  ⚡ Conditions           │  [Step card: Send Email BL-02]                   │
│  ⏱ Time Delay            │       ↕  [orange badge: 0 days]                  │
│                          │  [Step card: Send Email BL-03]                   │
│  Actions                 │       ↕  [orange badge: 0 days]                  │
│  ─────────────           │  [Step card: Send Email BL-04]                   │
│  📧 Send Email           │       ↕  [orange badge: 0 days]                  │
│  ↩ Reassign Agent…       │  [Step card: Send Email BL-05]                   │
│  👥 Add Collaborators    │                                                  │
│  ✕ Remove Collaborators  │                                                  │
│  🏷 Add Tags             │                                                  │
│  ✕ Remove Tags           ├──────────────────────────────────────────────────┤
│  ✓ Create Task           │  [Canvas bottom toolbar: zoom/pan controls]      │
│  📊 Change Stage         │                                                  │
│  📝 Add Note             │                                                  │
└──────────────────────────┴──────────────────────────────────────────────────┘
```

**Proportions:**
- Left panel: approximately 22% of total content width, fixed, scrollable
- Canvas: approximately 78% of width, scrollable in both axes (pan + zoom)
- Top header strip: ~40px tall, fixed

**Fixed vs scrolling:**
- The header bar with automation title and controls is fixed at top
- The left step palette panel is fixed/scrollable vertically
- The canvas is an infinite/pannable viewport with its own zoom controls

---

## Every UI element (exhaustive)

### Top header bar (fixed)

| Element | Text / Value | Notes |
|---|---|---|
| Breadcrumb link | `← Back to Automations` | Left-arrow + text; navigates to the automations list |
| Automation name | `/ Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]` | Plain text display in the header; not currently editable inline; the `/` separator suggests a path/hierarchy |
| Status label | `DISABLED` | Gray uppercase label to the left of the toggle |
| Enable toggle | Off (gray/left position) | Toggle switch; when on = automation fires; when off = disabled draft state |
| Save Changes button | `Save Changes` | Green/primary filled button, top-right area |
| Settings icon | ⚙ gear icon | Opens automation settings (name, triggers, etc.) [INFERRED] |
| Share/export icon | 🔗 or share icon | Share or export the automation [INFERRED] |

### Left panel — tab strip

Two tabs at the top of the left panel:

| Tab | State |
|---|---|
| `Triggers` | Not active (deselected) |
| `Steps` | Active (currently shown) |

### Left panel — search

- **Search input:** Magnifying glass icon + placeholder text (implied search field; no visible placeholder text shown but a text cursor line is visible)
- Function: filter/search the available step types in the palette below

### Left panel — drag instruction banner

- Text: `Drag a Step to the canvas`
- A draggable step chip is shown mid-drag: `⊞ Send Email` with a drag/move cursor icon overlaid — indicating the drag-and-drop paradigm

### Left panel — Controls section

Section header: **Controls** (bold label)

Description line: "Controls give extra granularity over how the automation flows."

| Step type | Icon | Description text |
|---|---|---|
| Conditions | ⚡ lightning bolt (orange/amber) | "Enter conditions is true to false" |
| Time Delay | ⏱ clock (orange/amber) | "Wait before starting the next step. Set a delay or set a time to run." |

### Left panel — Actions section

Section header: **Actions** (bold label)

Description line: "Decide what should happen when the automation is triggered"

| Step type | Icon | Description text |
|---|---|---|
| Send Email | 📧 envelope | "Send an email" |
| Reassign Agent or Lender | ↩ person-with-arrow | "Reassign the agent or lender" |
| Add Collaborators | 👥 people-plus | "Add Collaborators" |
| Remove Collaborators | ✕ people-minus | "Remove Collaborators" |
| Add Tags | 🏷 tag | "Add Tags" |
| Remove Tags | 🏷✕ tag-with-x | "Remove Tags" |
| Create Task | ✓ checkmark/task | "Create a task" |
| Change Stage | 📊 funnel or flag | "Change a stage" |
| Add Note | 📝 document/pencil | "Add a note" |

Each step type in the palette is a **draggable chip/tile** — the user drags it from the left panel and drops it onto the canvas to insert a step.

### Canvas — background

- Light gray background with a **subtle dot-grid pattern** (evenly spaced small dots, ~20px apart)
- The grid provides spatial reference for positioning/snapping [INFERRED]

### Canvas — Trigger card (topmost)

At the top of the canvas, a **trigger card** is displayed:

| Field | Value |
|---|---|
| Card type label | `Tag Added` |
| Subtitle / condition | `When tag is one of: audience:buyer` |
| Icon | Tag or label icon (blue/accent colored) |
| Border | Blue/primary-color left border or outline distinguishing it as a trigger (not a step) |

Below the trigger card: a **"+" button** (circular add button) to append the first step beneath the trigger.

### Canvas — Step cards (sequential flow, top to bottom)

Each step card is a white rounded-rectangle card with:
- A colored icon on the left (matching the step type icon from the palette)
- **Bold step type label** (e.g., "Send Email", "Create Task")
- Abbreviated **content description** (truncated with ellipsis)
- Connected to adjacent steps by a **vertical line** (connector arrow)
- **Orange/amber oval delay badge** on the connector line below each step (showing the Time Delay configured between this step and the next)

**Step 1 — Send Email (immediately after trigger)**

| Field | Value |
|---|---|
| Type label | `Send Email` |
| Content | `BL-01 Your Bend search is set up - Agent assigned to the contact.` |
| Icon | Envelope (blue or orange accent) |
| Delay below | (not shown / 0 delay implied — goes directly to next step) |

**Step 2 — Create Task**

| Field | Value |
|---|---|
| Type label | `Create Task` |
| Content | `Send First message! Seeing [something] batch to this buyer within 30 min - Follow U...` (truncated) |
| Icon | Checkmark/task icon |
| Delay badge below | `2 days` (orange oval badge on the connector) |

**Step 3 — (intermediate step, partially visible)**

A step card exists between the "2 days" delay badge and the next "0 days" delay. Content is not fully legible in the tiles.

**Step 4 — Send Email**

| Field | Value |
|---|---|
| Type label | `Send Email` |
| Content | `BL-02 Tell Text move buyers ahead - Agent assigned to the...` (truncated) |
| Delay badge below | `0 days` (orange oval) |

**Step 5 — Send Email**

| Field | Value |
|---|---|
| Type label | `Send Email` |
| Content | `BL-03 [something] move buyers ahead - Agent assigned to the...` (truncated; BL-03 prefix visible) |
| Delay badge below | `0 days` |

**Step 6 — Send Email**

| Field | Value |
|---|---|
| Type label | `Send Email` |
| Content | `BL-04 What to know about your top area - Agent assigned to the...` (truncated) |
| Delay badge below | `0 days` |

**Step 7 — Send Email**

| Field | Value |
|---|---|
| Type label | `Send Email` |
| Content | `BL-05 What's moving in your budget range - Agent assigned to the...` (truncated; partially cut off at canvas bottom) |
| Delay badge below | (not visible — bottom of scroll) |

**Total visible steps on canvas:** 1 trigger + at least 7 steps

### Canvas — bottom toolbar

At the very bottom of the canvas area, a **zoom/pan control toolbar** is visible:

| Control | Description |
|---|---|
| `←←` or `|←` button | Pan to start / fit canvas to view [INFERRED] |
| `←` arrow | Pan left or zoom out |
| Percentage readout | `25` (zoom level displayed as a number, likely `25%`) |
| `→` arrow | Pan right or zoom in |
| `→→` or `→|` button | Pan to end / fit canvas [INFERRED] |

The zoom level of `25%` means the canvas is zoomed out significantly, which is why the step cards appear small relative to the viewport. This also explains the dense vertical layout visible in the full screenshot.

---

## Colors, typography & style

### Color palette

| Element | Color / Estimate |
|---|---|
| Page background | White `#ffffff` |
| Canvas background | Very light gray `#f5f5f7` with lighter dot-grid overlay |
| Left panel background | White `#ffffff` with a right-side border `#e5e7eb` |
| Step cards | White `#ffffff` with subtle border `#e5e7eb` and box-shadow |
| Trigger card border/accent | Blue `#3b82f6` or FUB brand blue |
| "DISABLED" label text | Gray `#6b7280` |
| Enable toggle (off state) | Gray `#d1d5db` |
| Save Changes button | Green `#22c55e` or `#16a34a` — filled with white label text |
| Delay badges | Orange/amber `#f97316` or `#f59e0b` — oval pill with white text |
| Controls icons (Conditions, Time Delay) | Orange/amber `#f97316` |
| Section headings in left panel | Dark gray `#111827`, semi-bold |
| Description/helper text in left panel | Light gray `#6b7280`, smaller font |
| Step type labels (in palette) | Dark `#111827`, medium weight |
| Step content text (in cards) | Dark gray `#374151`, regular weight, truncated |
| Breadcrumb link text | Dark `#374151` or primary blue link color |
| Connector lines between cards | Light gray `#d1d5db` |

### Typography

- **Automation name header:** ~16–18px, semi-bold, dark
- **Section headers ("Controls", "Actions"):** ~13px, bold, all-caps or semi-bold uppercase
- **Step type names in palette:** ~14px, medium weight, dark
- **Helper text in palette:** ~12px, regular, gray
- **Step card type label:** ~13px, bold
- **Step card content:** ~12px, regular, gray, truncated
- **Delay badges:** ~11–12px, white on orange, bold
- **"DISABLED" badge:** ~12px, gray, all-caps letter-spacing
- **Tab labels ("Triggers", "Steps"):** ~13–14px, medium weight
- **Button ("Save Changes"):** ~14px, medium weight, white

### Style

- **Density:** Medium — cards have comfortable padding, left panel items are compact but readable
- **Border radius:** Step cards have ~8px radius; delay badges are fully pill-shaped (large radius); buttons ~6px
- **Card depth:** Subtle box-shadow on step cards (1–2px offset, light gray shadow)
- **Canvas grid:** Dot-grid (not line-grid) suggesting a Notion-/Miro-style canvas
- **Iconography:** Rounded, filled or outlined glyphs; consistent sizing ~16px
- **Overall aesthetic:** Clean SaaS, white-dominant, orange/amber accent for automation/action elements, blue accent for triggers

---

## State & data shown

- **Automation name:** `Buyer LP Nurture — audience:buyer`
- **Status:** `DRAFT - DO NOT ENABLE` (appended to the name as a warning label) + `DISABLED` toggle in the header
- **Automation ID:** `110` (from URL `/edit/110`)
- **Trigger type:** `Tag Added`
- **Trigger condition:** `When tag is one of: audience:buyer`
- **Number of configured steps:** At least 7 (possibly more below scroll)
- **Named email templates referenced:**
  - `BL-01` — "Your Bend search is set up"
  - `BL-02` — "Tell Text move buyers ahead" (subject copy obscured)
  - `BL-03` — (subject partially visible)
  - `BL-04` — "What to know about your top area"
  - `BL-05` — "What's moving in your budget range"
- **Agent assignment pattern:** Multiple emails note "Agent assigned to the contact" or "Agent assigned to the..." — indicating these emails use dynamic agent tokens
- **Task content sample:** "Send First message! Seeing [something] batch to this buyer within 30 min - Follow U..." — suggests a speed-to-lead task reminder
- **Delay values visible:** `2 days` (after Create Task), `0 days` (between several subsequent steps)
- **Canvas zoom level:** `25%` (zoomed out to see full sequence)
- **Steps tab active:** The "Steps" tab in the left panel is selected (showing the step type palette)

---

## Interactions & behaviors

### Top header
- **`← Back to Automations`** — navigates to the automations list page (`/2/automations` or `/2/automations/v2`) [INFERRED]
- **DISABLED toggle** — clicking enables the automation; only when enabled does it fire for matching contacts [INFERRED]
- **`Save Changes` button** — persists any unsaved step additions, reorderings, or configuration changes to the automation [INFERRED]; may be grayed-out when no changes pending [INFERRED]
- **⚙ Settings icon** — opens a settings panel or modal to rename the automation, edit its trigger conditions, or configure global settings [INFERRED]
- **Share icon** — may copy a share link or export the automation [INFERRED]

### Left panel tabs
- **Triggers tab** — switches the left panel to show available trigger types (e.g., Lead Created, Tag Added, Stage Changed, New Message, etc.) that can be dragged to configure the automation's entry condition [INFERRED]
- **Steps tab** — shows the current step-type palette (Controls + Actions sections as described above)

### Left panel search
- **Search input** — filters the list of step types in the palette below to match typed text; does not search the canvas steps [INFERRED]

### Dragging a step
- **Drag interaction** — user clicks and holds a step type chip in the left panel, drags it onto the canvas, and drops it at a desired position in the vertical sequence
- The canvas shows a **drop target indicator** (a highlighted gap or insertion zone) where the step will be inserted [INFERRED]
- On drop, a **step configuration drawer/modal opens** (side panel or inline expansion) to configure the step's specific parameters (e.g., which email template to send, task description, tag name) [INFERRED]

### Canvas step cards
- **Click on a step card** — opens a configuration panel (likely a right-side drawer or inline expansion) to edit the step's parameters (email template, task body, tag, delay value, etc.) [INFERRED]
- **Drag to reorder** — steps in the canvas may be reorderable by dragging [INFERRED]
- **Delete icon on card** — each step card likely has a delete/remove icon (X or trash) visible on hover [INFERRED]
- **Delay badge** — clicking the orange delay badge likely opens an inline editor to set the delay duration (number + unit: days, hours, minutes) or set a specific time to run (e.g., "next business day at 9am") [INFERRED based on Time Delay description]

### "+" button (below trigger card)
- Opens a step picker or inserts a blank step at that position [INFERRED]

### Canvas zoom/pan controls (bottom toolbar)
- Zoom in/out changes the percentage readout
- Pan arrows shift the canvas viewport
- Fit-to-view button resets zoom to show all steps [INFERRED]
- The canvas is pannable by click-and-drag on the background [INFERRED]

### Automation enable/disable lifecycle
- While `DISABLED` (draft state), the automation does not fire for any contacts
- Enabling via the toggle activates it for all future matching trigger events
- The `[DRAFT - DO NOT ENABLE]` suffix in the name is a manual naming convention used by the team as an additional safeguard

---

## Data model signals

### Automation entity
```
automation {
  id: 110 (integer, PK)
  name: "Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]"
  status: enum("enabled", "disabled")
  version: "v2"
  trigger: AutomationTrigger
  steps: AutomationStep[]
}
```

### AutomationTrigger entity
```
AutomationTrigger {
  type: enum(
    "tag_added",
    "lead_created",
    "stage_changed",
    "new_message",
    "deal_created",
    ... // other trigger types on the Triggers tab
  )
  conditions: Condition[]
  // for type="tag_added": { field: "tag", operator: "one_of", values: ["audience:buyer"] }
}
```

### AutomationStep entity (polymorphic)
```
AutomationStep {
  id: integer
  automation_id: integer (FK)
  position: integer (ordering)
  type: enum(
    "send_email",
    "create_task",
    "time_delay",
    "conditions",
    "reassign_agent_or_lender",
    "add_collaborators",
    "remove_collaborators",
    "add_tags",
    "remove_tags",
    "change_stage",
    "add_note"
  )
  config: JSONB // type-specific config
  delay_before: DelayConfig // time to wait before executing this step
}

// type-specific config shapes:
SendEmailConfig {
  template_id: integer  // references email template "BL-01", "BL-02", etc.
  send_from: "assigned_agent" | "specific_user"
}

CreateTaskConfig {
  title: string  // e.g., "Send First message! Seeing batch..."
  due_in_minutes: integer
  assign_to: "assigned_agent" | "specific_user"
  description: string
}

TimeDelayConfig {
  delay_value: integer
  delay_unit: enum("minutes", "hours", "days", "weeks")
  or run_at: { time: "HH:MM", timezone: string, day_type: "business_days" | "any" }
}

AddTagsConfig {
  tags: string[]
}

ConditionsConfig {
  conditions: Condition[]
  true_branch: AutomationStep[]
  false_branch: AutomationStep[]
}
```

### EmailTemplate entity (referenced)
```
EmailTemplate {
  id: integer
  internal_name: string  // "BL-01", "BL-02", etc.
  subject: string        // "Your Bend search is set up", "What to know about your top area", etc.
  body: HTML
  uses_dynamic_tokens: boolean  // "Agent assigned to the contact" = agent token
}
```

### Tag entity (referenced as trigger value)
```
tag: "audience:buyer"  // colon-namespaced tag format
```

### Agent token pattern
- Email templates use merge tokens for agent name/info: `{agent_name}`, `{agent_email}`, `{agent_phone}` etc. [INFERRED from "Agent assigned to the contact/..."]

---

## Rebuild notes

### Component breakdown

```tsx
// Top-level page
<AutomationEditorPage>
  <AutomationEditorHeader
    name="Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]"
    status="disabled"
    onToggleEnable={handleToggle}
    onSave={handleSave}
    onSettings={openSettings}
    onShare={openShare}
  />
  <div className="editor-body">
    <AutomationStepPalette>
      <TabStrip tabs={["Triggers", "Steps"]} activeTab="Steps" />
      <SearchInput placeholder="Search..." />
      <DragInstruction text="Drag a Step to the canvas" />
      <DraggableStepChip type="send_email" label="Send Email" beingDragged={true} />
      <PaletteSection title="Controls">
        <DraggableStepChip type="conditions" label="Conditions" icon="lightning" description="Enter conditions is true to false" />
        <DraggableStepChip type="time_delay" label="Time Delay" icon="clock" description="Wait before starting the next step..." />
      </PaletteSection>
      <PaletteSection title="Actions" description="Decide what should happen when the automation is triggered">
        <DraggableStepChip type="send_email" label="Send Email" icon="email" description="Send an email" />
        <DraggableStepChip type="reassign_agent_or_lender" label="Reassign Agent or Lender" icon="reassign" description="Reassign the agent or lender" />
        <DraggableStepChip type="add_collaborators" label="Add Collaborators" icon="people_plus" description="Add Collaborators" />
        <DraggableStepChip type="remove_collaborators" label="Remove Collaborators" icon="people_minus" description="Remove Collaborators" />
        <DraggableStepChip type="add_tags" label="Add Tags" icon="tag" description="Add Tags" />
        <DraggableStepChip type="remove_tags" label="Remove Tags" icon="tag_x" description="Remove Tags" />
        <DraggableStepChip type="create_task" label="Create Task" icon="check" description="Create a task" />
        <DraggableStepChip type="change_stage" label="Change Stage" icon="funnel" description="Change a stage" />
        <DraggableStepChip type="add_note" label="Add Note" icon="document" description="Add a note" />
      </PaletteSection>
    </AutomationStepPalette>

    <AutomationCanvas zoom={25} onZoomChange={setZoom}>
      {/* Dot-grid background */}
      <CanvasGrid />

      {/* Trigger at top */}
      <TriggerCard
        type="tag_added"
        label="Tag Added"
        condition="When tag is one of: audience:buyer"
      />
      <AddStepButton onClick={insertStepAfterTrigger} />

      {/* Step sequence — rendered as vertical flow */}
      <CanvasStepCard
        type="send_email"
        label="Send Email"
        preview="BL-01 Your Bend search is set up - Agent assigned to the contact."
        onEdit={openStepEditor}
        onDelete={deleteStep}
      />

      <DelayBadge value={0} unit="days" onClick={editDelay} />

      <CanvasStepCard
        type="create_task"
        label="Create Task"
        preview="Send First message! Seeing batch to this buyer within 30 min - Follow U..."
        onEdit={openStepEditor}
        onDelete={deleteStep}
      />

      <DelayBadge value={2} unit="days" onClick={editDelay} />

      {/* ... intermediate step ... */}

      <DelayBadge value={0} unit="days" onClick={editDelay} />

      <CanvasStepCard type="send_email" label="Send Email" preview="BL-02 Tell Text move buyers ahead - Agent assigned to the..." />
      <DelayBadge value={0} unit="days" />

      <CanvasStepCard type="send_email" label="Send Email" preview="BL-03 ... - Agent assigned to the..." />
      <DelayBadge value={0} unit="days" />

      <CanvasStepCard type="send_email" label="Send Email" preview="BL-04 What to know about your top area - Agent assigned to the..." />
      <DelayBadge value={0} unit="days" />

      <CanvasStepCard type="send_email" label="Send Email" preview="BL-05 What's moving in your budget range - Agent assigned to the..." />

      {/* Canvas toolbar at bottom */}
      <CanvasZoomControls
        zoom={25}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitView={fitView}
        onPanLeft={panLeft}
        onPanRight={panRight}
      />
    </AutomationCanvas>
  </div>
</AutomationEditorPage>
```

### Non-obvious implementation details

1. **Drag-and-drop from palette to canvas:** Use a library like `react-dnd` or `@dnd-kit/core`. The left panel items are drag sources; the canvas step sequence has a drop target that shows an insertion indicator between existing steps.

2. **Canvas as a panning/zooming viewport:** The canvas is NOT a simple scrollable div. It uses CSS `transform: scale(N) translate(X,Y)` on an inner container, with the outer container capturing pointer events for pan/zoom interactions. Zoom level `25%` = `transform: scale(0.25)`. The dot-grid background is achieved with `background-image: radial-gradient(circle, #ccc 1px, transparent 1px); background-size: 20px 20px;`.

3. **`DISABLED` status + naming convention:** The automation status is a first-class field (enabled/disabled toggle in the DB). The `[DRAFT - DO NOT ENABLE]` suffix is user-applied text in the automation name, NOT a system-generated badge — it's a human safeguard convention.

4. **Delay badges between steps:** These orange oval badges represent the `time_delay` step's configured value but are rendered in a compact "connector" style rather than as full step cards. Alternatively, they may be an inline annotation on the connecting line showing the delay of the NEXT step's `delay_before` config. Either way, clicking them should open an inline popover to edit the delay value and unit.

5. **Email template references:** The `BL-XX` prefixed names (`BL-01`, `BL-02`, etc.) are the internal naming convention for a "Buyer Lead" email nurture sequence. These reference saved email templates in the FUB email templates system.

6. **Agent token in email templates:** "Agent assigned to the contact" is a dynamic merge variable — in FUB, when the email fires, it sends from or references the contact's assigned agent. The template body likely uses tokens like `{{agent.first_name}}`.

7. **Step card content truncation:** Each step card in the canvas shows a ~60–80 character truncated preview of the step's actual content (email subject, task title, etc.). Full content is only visible when the step is opened for editing.

8. **Trigger card visual distinction:** The trigger card has a visually distinct style from action step cards — likely a different border color (blue vs. white/gray border) and a different icon treatment to make clear it's the entry condition, not an action.

9. **Version 2 canvas:** The URL path `/automations/v2/edit/` indicates this is a newer visual builder interface. A v1 version likely existed with a simpler list-based step configuration (not a drag-and-drop canvas). The two-tab layout (Triggers, Steps) and dot-grid canvas suggest this is a deliberate redesign toward a flow-builder metaphor.

10. **"Conditions" step type:** The Conditions step type implies branching logic (if/else) within the automation. This would render as a branching node on the canvas with two outgoing paths (true branch / false branch), each with their own sub-sequence of steps. This is significantly more complex to implement than linear steps.
