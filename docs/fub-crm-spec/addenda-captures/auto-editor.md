<!-- Addendum capture 2026-06-30. Fills coverage gaps for: §12 Automation visual editor -->

# FUB Automation Visual Editor — Exhaustive Buildable Analysis
# Source: 7-frame screen recording (auto-editor GIF)
# Feeds: spec §12 Automations
# Date: 2026-06-30

---

## SECTION 0 — FRAME INVENTORY

| Frame | Screen | Key State |
|-------|--------|-----------|
| f01 | Reporting > Agent Goals | Context / pre-navigation; NOT the automation editor |
| f02 | Admin > Automations list (collapsed) | First view: 1 folder + 1 visible row |
| f03 | Admin > Automations list (expanded) | Row context menu open (Edit / Delete / Duplicate / Share) |
| f04 | Admin > Automations list | "Linked Automations" tooltip popup visible |
| f05 | Automation Editor — Steps palette | Canvas visible; Step drag-and-drop; no right panel open |
| f06 | Automation Editor — Time Delay config | Right panel: "Wait, then run" config panel open |
| f07 | Automation Editor — Triggers palette + Tag Added config | Triggers tab active; right panel: "Tag Added" trigger config |

---

## SECTION 1 — GLOBAL NAVIGATION CHROME

### Top Nav Bar (persistent, dark teal background)
```
[FUB logo/star icon]  People  Inbox  Tasks  Calendar  Deals  Reporting  Admin  [Search box]  [email icon]  [chat icon]  [user+icon]  [bell icon]  [avatar]
```
- All items are text links with icons
- Search box: center-positioned, full text input
- Right icons (L→R): email/compose, chat bubble, user-switch, notifications bell, user avatar with dropdown chevron
- "wait" orange badge appears on the FUB logo in several frames (pending notification or loading indicator)

### Admin Sub-Nav (second row, light gray background, active tab underlined in teal)
```
Overview | Lead Flow | Groups | Team | Action Plans | Automations (active) | Ponds | Email Templates | Text Templates | Import | Custom Fields | Calling | Stages | Phone Numbers | Tags | More ∨
```
- Active tab = "Automations" (blue underline, bold)
- "Admin Overview" button at far right (outlined, with info icon)

---

## SECTION 2 — AUTOMATIONS LIST PAGE

### Page Header
```
Automations                   [Search... field]  [Library]  [+ Create Automation]
```
- "Automations" — H1, dark text, ~22px
- Search field: left-icon magnifier, placeholder "Search..."
- "Library" button: outline style, with book icon, medium weight
- "+ Create Automation" button: solid blue/teal, bold, plus icon prefix

### Folder Section
```
1 Folder                                                    [Create Folder]
┌─────────────────────────────────────┐
│ [folder-icon]  My Automations       │
│                6 Automations        │
└─────────────────────────────────────┘
```
- Section label: "1 Folder" (bold)
- "Create Folder" link: teal text, top-right
- Folder card: white background with border radius, folder icon (orange), folder name bold, subtitle in gray ("6 Automations")

### Automations Table

**Section label:** "38 Automations" (bold)

**Column headers:**
| Column | Sortable | Notes |
|--------|----------|-------|
| Name | — | Left-aligned text |
| Linked Automations | — | Shows "None" or a badge pill "1 ∨" |
| Steps | — | Integer count |
| Started | — | Integer count |
| Engaged (ⓘ) | — | Percentage string e.g. "0%" or "108- 99%" |
| Completed | — | Integer count |
| Created By | — | Avatar + name |
| Status | — | Toggle switch (on=teal, off=gray) |
| Created On (⇅) | Sortable | Date "M/D/YYYY" format |
| Actions | — | "..." three-dot menu |

**Complete row inventory (from f03 quadrant tiles):**
| # | Name | Linked | Steps | Started | Engaged | Completed | Created By | Status | Created On |
|---|------|--------|-------|---------|---------|-----------|------------|--------|------------|
| 1 | Buyer LP Nurture — audience:buyer [D...] | None | 15 | 0 | 0% | 0 | Matt Ryan | OFF | 5/29/2026 |
| 2 | Seller LP Nurture — audience:seller [...] | None | 13 | 0 | 0% | 0 | Matt Ryan | OFF | 5/29/2026 |
| 3 | Ryan Realty - Nurture Contact (Gene...) | None | 23 | 0 | 0% | 0 | Matt Ryan | OFF | 12/30/2025 |
| 4 | Ryan Realty - Expired Spring Strategy | None | 10 | 0 | 108-99% | 1 | Matt Ryan | OFF | 12/29/2025 |
| 5 | Ryan Realty - Remote Home Owner | None | 19 | 82 | 28-3% | 724 | Matt Ryan | OFF | 12/29/2025 |
| 6 | Ryan Realty - New Seller | None | 59 | 0 | 0% | 0 | Matt Ryan | OFF | 12/5/2025 |
| 7 | Unsubscribed | None | 1 | 0 | 0% | 0 | Follow Up Bo... | ON | 9/25/2025 |
| 8 | Nurture Long Term Buyers | Using: [1 ∨] | 1 | 0 | 0% | 0 | Follow Up Bo... | OFF | 6/30/2025 |
| 9 | Open House Follow Up | Using: [1 ∨] | 1 | 0 | 0% | 0 | Follow Up Bo... | ON | 6/30/2025 |
| 10 | Open House Leads | None | 7 | 0 | 0% | 0 | Follow Up Bo... | ON | 6/30/2025 |
| 11 | Start Post Closing Follow Up | Using: [1 ∨] | 1 | 0 | 0% | 0 | Follow Up Bo... | ON | 6/30/2025 |
| 12 | Post Closing Plan | None | 16 | 0 | 0% | 0 | Follow Up Bo... | OFF | 6/30/2025 |
| 13 | New Inquiry for an existing lead: Fol... | Using: [1 ∨] | 1 | 0 | 2-100% | 0 | Follow Up Bo... | OFF | 6/30/2025 |

**Note on Created By:** Matt Ryan rows have a human avatar (dark skin, bald). "Follow Up Bo..." rows have a green "FU" circle badge — these are FUB built-in system automations.

**Engaged column format:** Renders as "X- Y%" where X = started count and Y = completion percentage. E.g., "108- 99%" means 108 started, 99% completed.

### Row Actions — Three-Dot Context Menu
Clicking "..." on any row opens a dropdown menu:
```
┌────────────────┐
│ ✏ Edit         │
│ 🗑 Delete       │
│ ⧉ Duplicate    │
│ ↗ Share        │
└────────────────┘
```
- Each option has a left icon
- "Edit" — opens the automation editor
- "Delete" — deletes the automation
- "Duplicate" — creates a copy
- "Share" — sharing/export option

### Linked Automations Tooltip (f04)
Clicking the "1 ∨" badge in the Linked Automations column for "Nurture Long Term Buyers" opens a small popup:
```
┌──────────────────────────────────┐
│ AUTOMATION                       │
│ Buyer Long Term Nurture          │
└──────────────────────────────────┘
```
- Section header "AUTOMATION" in small caps/gray
- Lists the name of each linked automation as a text link
- Indicates that automations can be chained/linked to one another

---

## SECTION 3 — AUTOMATION EDITOR — OVERALL LAYOUT

The editor uses a three-column layout:

```
┌─────────────────┬──────────────────────────────────┬─────────────────────┐
│  LEFT PANEL     │          CANVAS                  │   RIGHT PANEL       │
│  (Step Palette) │    (scrollable, dot-grid bg)     │   (Config Panel)    │
│  ~240px wide    │         flex-grow                │   ~320px wide       │
└─────────────────┴──────────────────────────────────┴─────────────────────┘
```

### Top Bar (above all three columns)
```
← Back to Automations    [pencil] Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]    DISABLED [toggle]    [Save Changes]    [⚙ settings]    [share icon]
```
- "← Back to Automations" — text link, top-left
- Automation title: editable (pencil icon prefix), shows full name with status tag in brackets
- Status area: "DISABLED" text label + toggle switch (gray = off)
- "Save Changes" button: gray/disabled when no unsaved changes, turns blue when changes exist
- Settings gear icon: circular button
- Share icon: circular button

---

## SECTION 4 — LEFT PANEL: STEP PALETTE

### Panel Header
- Search input at top: full-width, placeholder presumably "Search..."
- Two tabs: **Triggers** | **Steps**

### Tab: Steps (f05 state)

**Instructional header:**
```
Drag a Step to the canvas
```
Gray subtext. Steps are dragged from this palette onto the canvas.

**Drag UI:** When a step is being dragged, it shows with a dashed blue border around its card.

#### Controls Section

```
Controls
Controls give extra granularity over how the automation is triggered.

[clock icon] Time Delay
             Wait before starting the next step. Set a delay or pick a time to run.

[branch icon] Conditions
              Either condition is true or false
```

**Step types in Controls:**

| Step | Icon | Description text |
|------|------|-----------------|
| Time Delay | clock/timer icon | "Wait before starting the next step. Set a delay or pick a time to run." |
| Conditions | branch/fork icon | "Either condition is true or false" |

#### Actions Section

```
Actions
Decide what should happen when the automation is triggered.

[email icon]  Send Email
              Send an email

[person icon] Reassign Agent or Lender
              Reassign the agent or lender

[person+ icon] Add Collaborators
               Add Collaborators

[person- icon] Remove Collaborators
               Remove Collaborators

[tag icon]    Add Tags
              Add Tags

[tag-x icon]  Remove Tags
              Remove Tags

[check icon]  Create Task
              Create a task

[stage icon]  Change Stage
              Change a stage

[note icon]   Add Note
              Add a note
```

**Complete step palette inventory — Actions:**

| # | Step Name | Description text |
|---|-----------|-----------------|
| 1 | Send Email | "Send an email" |
| 2 | Reassign Agent or Lender | "Reassign the agent or lender" |
| 3 | Add Collaborators | "Add Collaborators" |
| 4 | Remove Collaborators | "Remove Collaborators" |
| 5 | Add Tags | "Add Tags" |
| 6 | Remove Tags | "Remove Tags" |
| 7 | Create Task | "Create a task" |
| 8 | Change Stage | "Change a stage" |
| 9 | Add Note | "Add a note" |

**Total step types = 2 controls + 9 actions = 11 step types**

---

### Tab: Triggers (f07 state)

When the Triggers tab is active, the instructional header changes to:
```
Start by dragging a Trigger to the canvas
```

**Complete trigger palette inventory:**

| # | Trigger Name | Description text |
|---|-------------|-----------------|
| 1 | Stage Change | "Start an automation when the stage changes" |
| 2 | Deal Stage Change | "Start an automation when the deal stage is changed." |
| 3 | Inquiry | "Start an automation when there is a general inquiry" |
| 4 | Property Saved | "Start an automation when a property is saved" |
| 5 | Property Viewed | "Start an automation when a property is viewed" |
| 6 | Calendar Date | "Start an automation on a deal closing date or custom date" |
| 7 | Appointment | "Start an automation when an appointment is added to your calendar." |
| 8 | Manual | "Start the automation by hand" |

**From right panel (f07): "Tag Added" is also a confirmed trigger type** (currently used as the trigger in the live canvas, its config is showing in the right panel).

**Complete trigger type list (confirmed):**
1. Tag Added
2. Stage Change
3. Deal Stage Change
4. Inquiry
5. Property Saved
6. Property Viewed
7. Calendar Date
8. Appointment
9. Manual

**Note:** Tag Added is NOT visible in the palette list in f07 because it is already placed on the canvas. FUB likely removes it from the available palette once one is placed (triggers are singular per automation), OR the palette was scrolled down past it.

---

## SECTION 5 — CANVAS

### Background
- Dot-grid pattern (small gray dots on white/near-white background)
- Scrollable in both axes
- Canvas navigation controls at bottom: zoom +/−, directional pan buttons

### Canvas Node Types

#### Trigger Tile (top of chain)
```
┌─────────────────────────────────────────┐
│  Tag Added                              │  ← teal/blue left border accent
│  tag is one of: audience:buyer          │
└─────────────────────────────────────────┘
                    │
                   [+]   ← add step button (circle with plus)
                    │
```
- Appears at the very top of the canvas
- Has a distinct styling: teal/blue left-border or colored header
- Shows trigger name (bold) + configured value summary
- "+" button below it to insert the first step

#### Step Card (actions and controls)
```
┌─────────────────────────────────────────┐
│  [icon]  Send Email                     │  ← step type (bold)
│          Your Bend search is set up •   │  ← preview text (gray, 1-2 lines)
│          Agent assigned to the contact  │
└─────────────────────────────────────────┘
                    │
                (connector line, vertical)
                    │
```
- White card with subtle border/shadow
- Left icon (step type icon)
- Step type name in bold
- Preview/description of configured values in gray subtext (truncated with "...")
- Connected vertically with a line to the next element

#### Wait Label (Time Delay between steps)
```
    ⏰ 2 days
```
- Small pill/badge format
- Orange clock icon (⏰) on the left
- Text: "[N] days" (or hours, or minutes)
- Positioned on the connector line between two step cards
- When selected/hovered: gains an × close button (top-right of the pill) to delete it
- Color: orange/warm tone for the icon, gray text

#### Add Step Button
```
    [+]
```
- Circular button with "+" 
- Appears on connector lines between steps
- Clicking it opens the step palette or inserts a step

### Full Canvas Chain (f05/f06 composite — "Buyer LP Nurture — audience:buyer"):

```
1. [TRIGGER] Tag Added
             "tag is one of: audience:buyer"
                     │
                    [+]
                     │
2. [STEP] Send Email
          "BL-01 Your Bend search is set up • Agent assigned to the contact"
                     │
3. [STEP] Create Task
          "Text this buyer lead now (day 0) — use the BL-S1 Buyer SMS..."
                     │
4. [STEP] Create Task
          "Send first matched-listings batch to this buyer within 30 min • Follow U..."
                     │
              ⏰ 2 days
                     │
5. [STEP] Send Email
          "BL-02 Two things that move buyers ahead • Agent assigned to the..."
                     │
              ⏰ 8 days
                     │
6. [STEP] Send Email
          "BL-03 What to know about your top areas • Agent assigned to the..."
                     │
              ⏰ 11 days
                     │
7. [STEP] Send Email
          "BL-04 What's moving in your budget range • Agent assigned to the..."
                     │
              (continues below visible area)
```

**Step preview text conventions observed:**
- Email steps show: "Subject line • Agent assigned to the contact" (dot separator between subject and from-field)
- Task steps show: task note preview text
- Wait labels show: "[N] days" between step cards

---

## SECTION 6 — RIGHT PANEL: STEP CONFIGURATION

The right panel slides in when a step card or wait label is clicked on the canvas.

### 6.1 — Time Delay Config Panel (f06)

**Trigger:** Click the "⏰ N days" wait label on the canvas.

**Panel structure:**
```
Wait, then run
Wait a set amount of time before the next action runs.

Type of Delay
  ● Wait, then run
  ○ Wait, then run at a specific time

Days
  [  2  ]   ← numeric input

Hours
  [  0  ]   ← numeric input

Minutes
  [  0  ]   ← numeric input


[🗑 Delete]   ← bottom of panel, destructive action
```

**Exact field labels and controls:**
| Field | Type | Observed value |
|-------|------|---------------|
| Title | Static text | "Wait, then run" |
| Subtitle | Static text | "Wait a set amount of time before the next action runs." |
| Type of Delay | Radio group | Options: "Wait, then run" / "Wait, then run at a specific time" |
| Days | Number input | 2 |
| Hours | Number input | 0 |
| Minutes | Number input | 0 |
| Delete | Button (destructive, bottom) | Trash icon + "Delete" text |

**Radio option "Wait, then run"** — selected by default. Sets a relative delay from the previous step.
**Radio option "Wait, then run at a specific time"** — likely opens a time-picker (not visible in frames; speculate: allows scheduling to a specific clock time, e.g. "9:00 AM").

---

### 6.2 — Tag Added Trigger Config Panel (f07)

**Trigger:** Click the "Tag Added" trigger tile on the canvas, OR place a new Tag Added trigger.

**Panel structure:**
```
Tag Added
Start an automation when there is a tag added

[dropdown]  Tag Added ∨
            Start an automation when there is a tag added

Tags
  ⟳ Loading tags...   ← loading state placeholder
```

**Exact field labels and controls:**
| Field | Type | Observed value / state |
|-------|------|----------------------|
| Title | Static text | "Tag Added" |
| Subtitle | Static text | "Start an automation when there is a tag added" |
| Trigger type dropdown | Select/dropdown | Shows "Tag Added" with chevron; the dropdown text is "Start an automation when there is a tag added" |
| Tags | Multi-select or tag-picker | Loading state: spinner + "Loading tags..." |

**Trigger type dropdown behavior:** The dropdown at top of the panel allows switching the trigger type (e.g., from "Tag Added" to another trigger type). The current selection is shown with its description. This means a trigger can be changed after placement without deleting and re-adding it from the palette.

**Tags field:** Asynchronously loads the list of available tags from the FUB account. Once loaded, expected to be a searchable multi-select allowing the user to pick one or more tags that will fire the trigger.

**Configured value (shown on canvas tile):** "tag is one of: audience:buyer" — confirming the Tags field accepts multiple values with an "is one of" operator, and the canvas tile preview renders the selected tag value(s).

---

### 6.3 — Inferred Config Panels (not directly visible in frames)

Based on the step palette names, these config panels must exist. Based on FUB UX patterns observed, inferred structures:

#### Send Email
```
Send Email
Send an email

Email Template
  [dropdown — select email template]

From Agent
  [dropdown — Agent assigned to the contact / specific agent]

[🗑 Delete]
```
Evidence from canvas preview text: "BL-01 Your Bend search is set up • Agent assigned to the contact" — the "•" separator confirms two fields: subject/template name + from-agent setting.

#### Create Task
```
Create Task
Create a task

Task Note / Description
  [text area]

Assign To
  [dropdown — agent]

Due Date
  [relative date picker]

[🗑 Delete]
```
Evidence from canvas preview: "Text this buyer lead now (day 0) — use the BL-S1 Buyer SMS..." — task note text is stored.

#### Reassign Agent or Lender
```
Reassign Agent or Lender
Reassign the agent or lender

Reassign
  ● Agent
  ○ Lender

Agent
  [dropdown — select agent]

[🗑 Delete]
```

#### Add Tags / Remove Tags
```
Add Tags / Remove Tags

Tags
  [multi-select tag picker — same as trigger Tags field]

[🗑 Delete]
```

#### Add Collaborators / Remove Collaborators
```
Add Collaborators / Remove Collaborators

Collaborators
  [agent multi-select]

[🗑 Delete]
```

#### Change Stage
```
Change Stage
Change a stage

Stage
  [dropdown — pipeline stage selector]

[🗑 Delete]
```

#### Add Note
```
Add Note
Add a note

Note
  [text area]

[🗑 Delete]
```

#### Conditions
```
Conditions

Condition [dropdown — field selector]
  [operator dropdown]  [value input]

[+ Add Condition]
All / Any  (AND/OR logic)

[🗑 Delete]
```

---

## SECTION 7 — CANVAS INTERACTION MODEL

### Drag and Drop
- Steps are dragged from the left palette onto the canvas
- A dashed blue border outline appears on the step being dragged
- Steps snap to the vertical chain (linear flow, not branching)

### Selected State
- Clicking a step card or wait label: right panel slides open with config
- Selected wait label: gains × (close/delete) button in the top-right corner of the pill

### Delete Flow
- Delete button at bottom of right panel removes the selected step
- The × on a selected wait label also deletes it
- Keyboard shortcut likely exists (not confirmed from frames)

### Canvas Navigation
- Bottom-center of canvas: pan/zoom controls (+ and − buttons, directional arrows)
- Canvas is scrollable when the chain is longer than the visible area

### "+" Insert Button
- Appears between steps on connector lines
- Clicking it likely opens a mini step-type picker or focuses the step palette

---

## SECTION 8 — COMPONENT TREE (Responsive Web Rebuild)

```
<AutomationEditorPage>
  <TopBar>
    <BackLink href="/admin/automations">← Back to Automations</BackLink>
    <TitleEditor value={automation.name} />
    <StatusSection>
      <StatusLabel>{automation.enabled ? 'ENABLED' : 'DISABLED'}</StatusLabel>
      <ToggleSwitch checked={automation.enabled} onChange={handleToggle} />
    </StatusSection>
    <SaveChangesButton disabled={!hasUnsavedChanges} />
    <IconButton icon="settings" />
    <IconButton icon="share" />
  </TopBar>

  <EditorLayout>
    <LeftPanel width="240px">
      <SearchInput placeholder="Search..." />
      <TabBar>
        <Tab label="Triggers" active={activeTab === 'triggers'} />
        <Tab label="Steps" active={activeTab === 'steps'} />
      </TabBar>

      {activeTab === 'triggers' && (
        <TriggerPalette>
          <PaletteInstructions>Start by dragging a Trigger to the canvas</PaletteInstructions>
          {TRIGGER_TYPES.map(t => (
            <DraggablePaletteItem key={t.type} draggable onDragStart={...}>
              <ItemIcon type={t.type} />
              <ItemContent>
                <ItemName>{t.name}</ItemName>
                <ItemDescription>{t.description}</ItemDescription>
              </ItemContent>
            </DraggablePaletteItem>
          ))}
        </TriggerPalette>
      )}

      {activeTab === 'steps' && (
        <StepPalette>
          <PaletteInstructions>Drag a Step to the canvas</PaletteInstructions>

          <PaletteSection>
            <SectionLabel>Controls</SectionLabel>
            <SectionDescription>Controls give extra granularity over how the automation is triggered.</SectionDescription>
            {CONTROL_STEP_TYPES.map(s => (
              <DraggablePaletteItem key={s.type} draggable onDragStart={...}>
                <ItemIcon type={s.type} />
                <ItemContent>
                  <ItemName>{s.name}</ItemName>
                  <ItemDescription>{s.description}</ItemDescription>
                </ItemContent>
              </DraggablePaletteItem>
            ))}
          </PaletteSection>

          <PaletteSection>
            <SectionLabel>Actions</SectionLabel>
            <SectionDescription>Decide what should happen when the automation is triggered.</SectionDescription>
            {ACTION_STEP_TYPES.map(s => (
              <DraggablePaletteItem key={s.type} draggable onDragStart={...}>
                ...
              </DraggablePaletteItem>
            ))}
          </PaletteSection>
        </StepPalette>
      )}
    </LeftPanel>

    <Canvas
      ref={canvasRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <CanvasBackground dotGrid />
      <AutomationChain>
        <TriggerTile
          triggerType={trigger.type}
          config={trigger.config}
          onClick={() => setSelectedNode(trigger)}
          selected={selectedNode?.id === trigger.id}
        />
        <AddStepButton position="after-trigger" onClick={...} />
        {steps.map((step, index) => (
          <Fragment key={step.id}>
            <ConnectorLine />
            {step.waitDelay && (
              <WaitLabel
                delay={step.waitDelay}
                selected={selectedNode?.id === step.id + '_wait'}
                onClick={() => setSelectedNode(step.waitDelay)}
                onDelete={() => removeWaitDelay(step.id)}
              />
            )}
            <StepCard
              stepType={step.type}
              config={step.config}
              previewText={getPreviewText(step)}
              selected={selectedNode?.id === step.id}
              onClick={() => setSelectedNode(step)}
            />
            <AddStepButton position={index} onClick={...} />
          </Fragment>
        ))}
      </AutomationChain>
      <CanvasNavControls>
        <ZoomIn />
        <ZoomOut />
        <PanButtons directions={['up','down','left','right']} />
      </CanvasNavControls>
    </Canvas>

    {selectedNode && (
      <RightPanel width="320px">
        {selectedNode.nodeType === 'trigger' && (
          <TriggerConfigPanel
            trigger={selectedNode}
            onDelete={() => deleteTrigger(selectedNode.id)}
          />
        )}
        {selectedNode.nodeType === 'time_delay' && (
          <TimeDelayConfigPanel
            delay={selectedNode}
            onDelete={() => deleteWaitDelay(selectedNode.id)}
          />
        )}
        {selectedNode.nodeType === 'step' && (
          <StepConfigPanel
            step={selectedNode}
            onDelete={() => deleteStep(selectedNode.id)}
          />
        )}
      </RightPanel>
    )}
  </EditorLayout>
</AutomationEditorPage>
```

---

## SECTION 9 — DATA MODELS

### Automation Object
```typescript
interface Automation {
  id: string
  name: string                    // e.g. "Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]"
  enabled: boolean                // drives "DISABLED" / "ENABLED" label + toggle
  trigger: AutomationTrigger
  steps: AutomationStep[]
  linkedAutomations: string[]     // array of automation IDs; shown as "1 ∨" badge
  stepCount: number
  startedCount: number
  engagedPercent: number
  completedCount: number
  createdBy: { id: string; name: string; avatarUrl?: string; isSystem?: boolean }
  createdOn: string               // ISO date
  folderId?: string
}
```

### Trigger Types Enum
```typescript
type TriggerType =
  | 'tag_added'
  | 'stage_change'
  | 'deal_stage_change'
  | 'inquiry'
  | 'property_saved'
  | 'property_viewed'
  | 'calendar_date'
  | 'appointment'
  | 'manual'
```

### Trigger Config by Type
```typescript
interface TagAddedTriggerConfig {
  type: 'tag_added'
  tags: string[]          // "tag is one of: <tag>" → array of tag names/IDs
}

interface StageChangeTriggerConfig {
  type: 'stage_change'
  // stage selector (inferred)
  stages?: string[]
}

interface CalendarDateTriggerConfig {
  type: 'calendar_date'
  // deal closing date or custom date (inferred from description)
  dateField: 'closing_date' | 'custom'
  offset?: { days: number; direction: 'before' | 'after' }
}

interface AppointmentTriggerConfig {
  type: 'appointment'
}

interface ManualTriggerConfig {
  type: 'manual'
}
```

### Step Types Enum
```typescript
type StepType =
  // Controls
  | 'time_delay'
  | 'conditions'
  // Actions
  | 'send_email'
  | 'reassign_agent_or_lender'
  | 'add_collaborators'
  | 'remove_collaborators'
  | 'add_tags'
  | 'remove_tags'
  | 'create_task'
  | 'change_stage'
  | 'add_note'
```

### Step Configs
```typescript
interface TimeDelayConfig {
  type: 'time_delay'
  delayType: 'wait_then_run' | 'wait_then_run_at_specific_time'
  days: number        // confirmed: numeric input, default 2
  hours: number       // confirmed: numeric input, default 0
  minutes: number     // confirmed: numeric input, default 0
  // if delayType === 'wait_then_run_at_specific_time': time: string (HH:MM)
}

interface SendEmailConfig {
  type: 'send_email'
  emailTemplateId: string     // confirmed from preview: shows template name
  fromAgent: string           // confirmed: "Agent assigned to the contact" or specific agent
}

interface CreateTaskConfig {
  type: 'create_task'
  note: string               // task body text
  assignTo?: string          // agent
  dueDateOffset?: number     // days from trigger (inferred from "day 0")
}

interface ReassignAgentOrLenderConfig {
  type: 'reassign_agent_or_lender'
  reassignType: 'agent' | 'lender'
  agentId?: string
  lenderId?: string
}

interface AddRemoveTagsConfig {
  type: 'add_tags' | 'remove_tags'
  tags: string[]
}

interface AddRemoveCollaboratorsConfig {
  type: 'add_collaborators' | 'remove_collaborators'
  collaborators: string[]    // agent IDs
}

interface ChangeStageConfig {
  type: 'change_stage'
  stageId: string
}

interface AddNoteConfig {
  type: 'add_note'
  note: string
}

interface ConditionsConfig {
  type: 'conditions'
  logic: 'all' | 'any'      // AND / OR
  conditions: {
    field: string
    operator: string
    value: string
  }[]
}
```

### Wait Label (Time Delay between steps)
```typescript
interface WaitDelay {
  days: number
  hours: number
  minutes: number
  delayType: 'wait_then_run' | 'wait_then_run_at_specific_time'
}
```
The wait delay is stored on the NEXT step (i.e., "wait N days before running this step") or as a standalone node between steps. Canvas renders it as the "⏰ N days" pill between cards.

---

## SECTION 10 — EXACT UI TEXT TRANSCRIPTIONS

### Left Panel — Steps Tab

**Controls section header:**
> Controls
> Controls give extra granularity over how the automation is triggered.

**Time Delay item:**
> Time Delay
> Wait before starting the next step. Set a delay or pick a time to run.

**Conditions item:**
> Conditions
> Either condition is true or false

**Actions section header:**
> Actions
> Decide what should happen when the automation is triggered.

**Send Email item:**
> Send Email
> Send an email

**Reassign Agent or Lender item:**
> Reassign Agent or Lender
> Reassign the agent or lender

**Add Collaborators item:**
> Add Collaborators
> Add Collaborators

**Remove Collaborators item:**
> Remove Collaborators
> Remove Collaborators

**Add Tags item:**
> Add Tags
> Add Tags

**Remove Tags item:**
> Remove Tags
> Remove Tags

**Create Task item:**
> Create Task
> Create a task

**Change Stage item:**
> Change Stage
> Change a stage

**Add Note item:**
> Add Note
> Add a note

---

### Left Panel — Triggers Tab

**Header:**
> Start by dragging a Trigger to the canvas

**Stage Change item:**
> Stage Change
> Start an automation when the stage changes

**Deal Stage Change item:**
> Deal Stage Change
> Start an automation when the deal stage is changed.

**Inquiry item:**
> Inquiry
> Start an automation when there is a general inquiry

**Property Saved item:**
> Property Saved
> Start an automation when a property is saved

**Property Viewed item:**
> Property Viewed
> Start an automation when a property is viewed

**Calendar Date item:**
> Calendar Date
> Start an automation on a deal closing date or custom date

**Appointment item:**
> Appointment
> Start an automation when an appointment is added to your calendar.

**Manual item:**
> Manual
> Start the automation by hand

---

### Time Delay Right Panel (f06)

**Panel title:**
> Wait, then run

**Panel subtitle:**
> Wait a set amount of time before the next action runs.

**Radio option 1 (selected):**
> Wait, then run

**Radio option 2:**
> Wait, then run at a specific time

**Field label 1:**
> Days

**Field label 2:**
> Hours

**Field label 3:**
> Minutes

**Delete button:**
> Delete (with trash icon)

---

### Tag Added Trigger Right Panel (f07)

**Panel title:**
> Tag Added

**Panel subtitle:**
> Start an automation when there is a tag added

**Dropdown current value:**
> Tag Added
> Start an automation when there is a tag added

**Tags field label:**
> Tags

**Tags loading state:**
> ⟳ Loading tags...

---

### Canvas — Step Card Preview Texts (confirmed exact from quadrant tiles)

**Trigger tile:**
> Tag Added
> tag is one of: audience:buyer

**Step 1 — Send Email:**
> Send Email
> BL-01 Your Bend search is set up • Agent assigned to the contact

**Step 2 — Create Task:**
> Create Task
> Text this buyer lead now (day 0) — use the BL-S1 Buyer SMS...

**Step 3 — Create Task:**
> Create Task
> Send first matched-listings batch to this buyer within 30 min • Follow U...

**Wait label 1:**
> ⏰ 2 days

**Step 4 — Send Email:**
> Send Email
> BL-02 Two things that move buyers ahead • Agent assigned to the...

**Wait label 2:**
> ⏰ 8 days

**Step 5 — Send Email:**
> Send Email
> BL-03 What to know about your top areas • Agent assigned to the...

**Wait label 3:**
> ⏰ 11 days

**Step 6 — Send Email:**
> Send Email
> BL-04 What's moving in your budget range • Agent assigned to the...

---

### Automations List — Row Context Menu

```
✏ Edit
🗑 Delete
⧉ Duplicate
↗ Share
```

---

### Linked Automations Tooltip (f04)

**Section header:**
> AUTOMATION

**Linked automation name:**
> Buyer Long Term Nurture

---

## SECTION 11 — VISUAL DESIGN TOKENS

### Colors
| Element | Color |
|---------|-------|
| Top nav background | Dark teal (#1e6a6a range, or similar dark green-blue) |
| Active tab underline | Teal/blue (#0ea5e9 range) |
| Primary button (Create Automation) | Teal blue (solid fill) |
| Library button | White bg, teal border + text |
| Toggle ON | Teal green |
| Toggle OFF | Gray |
| Trigger tile accent | Teal/blue left border |
| Step card border | Light gray, subtle shadow |
| Wait label icon | Orange clock |
| Wait label pill | White bg with orange icon, light gray text |
| Wait label selected | Gains × button |
| Canvas background | White/near-white with small gray dot grid |
| Context menu | White card, left icons in gray |
| Folder card | White with border radius |
| Folder icon | Orange/amber |
| "Follow Up Bo..." avatar | Green circle with "FU" white initials |
| Delete button in right panel | Gray text with trash icon, destructive |
| Loading spinner | Teal/blue spinning circle |

### Typography
| Element | Style |
|---------|-------|
| Page title "Automations" | ~22px, semi-bold, dark |
| Table column headers | ~12px, medium weight, gray |
| Table row name | ~14px, semi-bold, dark (teal for primary link) |
| Step palette item name | ~13-14px, medium weight |
| Step palette item description | ~12px, light, gray |
| Panel title (right panel) | ~18px, semi-bold |
| Panel subtitle | ~13px, gray |
| Field label | ~12px, medium, dark |
| Canvas step type label | ~13px, bold |
| Canvas preview text | ~12px, gray |
| Wait label text | ~12px, gray |

### Layout
| Element | Dimension |
|---------|-----------|
| Left palette panel | ~240px wide |
| Right config panel | ~320px wide |
| Canvas | flex-grow, remaining width |
| Step card width | ~140-150px (canvas card appears narrow) |
| Wait label pill | ~80-100px wide |
| Top bar height | ~44-48px |
| Sub-nav height | ~40px |

---

## SECTION 12 — AUTOMATION STATUS STATES

### Automation-level status (list page)
- **Enabled (ON):** Toggle is teal/green
- **Disabled (OFF):** Toggle is gray

### Editor status states
- **DISABLED:** Shown in top bar as text label + gray toggle
- **ENABLED:** Would show as teal toggle (not observed in these frames)
- **DRAFT:** Indicated in the automation name bracket "[DRAFT - DO NOT ENABLE]" — user-defined naming convention, not a system status field
- **Save Changes button:** Grayed when no changes; becomes active (blue) when changes exist

---

## SECTION 13 — ENGAGED COLUMN FORMAT

The "Engaged" column in the table shows combined statistics in a compressed format:
- Format: "X- Y%" where X = number of contacts who started, Y = completion percentage
- Examples seen:
  - "0%" — zero started
  - "108- 99%" — 108 started, 99% completed
  - "28- 3%" — 28 started, 3% completed (low completion, many drops)
  - "2- 100%" — 2 started, 100% completed

This appears to be a two-stat compressed display in a single column. In rebuild, render as two separate values or a tooltip.

---

## SECTION 14 — NAVIGATION FLOW

```
Admin > Automations list
  → Click automation name or "Edit" from ... menu
    → Opens Automation Editor (full-page replace, not modal)
      → Left panel: Triggers / Steps tabs
      → Canvas: linear chain of trigger + steps
      → Click step/trigger/wait → right panel config slides open
      → Drag from palette → drops into chain
      → "Save Changes" → commits all pending edits
      → "← Back to Automations" → returns to list
```

---

## SECTION 15 — GAPS AND INFERENCES (not directly observed)

1. **Conditions config panel** — not shown in any frame. Based on palette description "Either condition is true or false" — likely an IF/ELSE branch or a filter that conditionally executes subsequent steps.

2. **"Wait, then run at a specific time"** — the second radio option in Time Delay. Not expanded in frames. Likely reveals a clock/time picker for scheduling at a specific time of day.

3. **Send Email config panel** — not opened in frames. Inferred: email template selector + from-agent selector.

4. **Create Task config panel** — not opened. Inferred: note text area + assign + due date.

5. **Trigger type switching** — the right panel for Tag Added shows a dropdown with the trigger type. Possibly allows switching from one trigger type to another without delete/re-drag.

6. **Conditions branching** — may create a fork in the otherwise linear chain (not visible from frames — all chains seen are linear).

7. **Tag Added trigger: full tag list** — shown in loading state. Once loaded, expected to show all account tags as searchable multi-select.

8. **Automation total count: 38** — but only ~13 rows appear in f03. The remaining ~25 rows are scrolled below what is visible.

9. **"My Automations" folder (6 Automations)** — separate from the 38 listed. The folder appears to contain a subset. Clicking the folder card likely filters the list.

10. **Library button** — opens a pre-built automation template library. Not explored in these frames.

---

## SECTION 16 — BUILD SPECIFICATION SUMMARY (§12 Automations)

For the in-house TC/CRM automation builder to achieve FUB parity on the visual editor:

### Required UI surfaces
1. Automations list page with folder + flat list, table columns as specified
2. Full-page editor (not a modal)
3. Three-column layout: left palette | canvas | right config panel
4. Top bar with title editor + enabled toggle + save button

### Required step types (11 total)
Controls: Time Delay, Conditions
Actions: Send Email, Reassign Agent or Lender, Add Collaborators, Remove Collaborators, Add Tags, Remove Tags, Create Task, Change Stage, Add Note

### Required trigger types (9 confirmed)
Tag Added, Stage Change, Deal Stage Change, Inquiry, Property Saved, Property Viewed, Calendar Date, Appointment, Manual

### Required canvas elements
- Trigger tile (distinct styling, top of chain)
- Step cards (icon + name + preview text)
- Wait label pills (clock icon + "N days")
- Connector lines
- Add step (+) buttons between steps
- Dot-grid background

### Required right panel configs
- Time Delay: radio (relative vs specific time) + days/hours/minutes inputs + Delete
- Tag Added trigger: trigger-type dropdown + tags multi-select
- At minimum inferred: Send Email (template + from-agent), Create Task (note + assign), all other step types

### Row context menu
Edit | Delete | Duplicate | Share

### Status model
Automation-level enabled/disabled toggle (list + editor)
