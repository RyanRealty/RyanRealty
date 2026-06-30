<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.27.43 AM.png | Sequential id: shot-37 | Tiles: fub-tiles/shot-37_{full,q1,q2,q3,q4}.png -->

# shot-37 — Action Plan / Automation Builder — Step Configuration (Send Email panel open)

## Identity

- **Visible URL:** `ryan-realty.followupboss.com/2/automations/v2/edit/110`
- **Browser tab title:** "Editing - Buyer LP Nurture - …"
- **Automation name (displayed in top bar):** `Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]`
- **Top-nav active item:** Not directly visible (navigated deep into an edit route); breadcrumb "← Back to Automations" is visible in the upper-left of the left rail
- **Sub-nav / tabs active:** "Steps" tab is active in the left panel (the other tab is "Triggers")
- **Status badge:** `DISABLED` (shown as a gray pill label next to a toggle that is in the OFF position)
- **Account/brokerage name:** "Sun's UI business…" (truncated, shown in browser profile/account chip at top-left of browser chrome)
- **Logged-in user:** Avatar visible top-right of browser chrome (brown/dark avatar icon)
- **Left panel search box:** Placeholder text visible (empty search field for filtering steps)

---

## Layout

The screen is a **full-browser automation flow builder** with three distinct horizontal regions:

### 1. Browser Top Bar (OS/Chrome chrome — ~40 px)
Standard Chrome address bar, tab strip, extension icons. Not part of FUB UI proper. Automation name appears in the tab title.

### 2. FUB Application Top Bar (~48 px tall, full width, white background)
Fixed bar pinned at the top. Contains:
- Left: `← Back to Automations` link
- Center: Automation title text — `Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]`
- Right cluster: `DISABLED` status label + gray toggle switch + `Save Changes` button (blue, filled) + gear/settings icon button + share/export icon button

### 3. Three-Column Body (fills remaining height, scrollable independently per column)

#### Left Rail (~22% width, ~280 px, light gray background `#f5f5f5`)
- Top: Search input (placeholder text, magnifying-glass icon)
- Two tabs: `Triggers` | `Steps` (Steps is active, underlined)
- Instruction text: `Drag a Step to the canvas`
- **Currently dragging:** A `Send Email` step card is highlighted in a blue dashed border, indicating it is being dragged to the canvas (the drag ghost is shown mid-drag in the canvas area)
- Below the dragged item: Two grouped sections — **Controls** and **Actions** — each containing draggable step type tiles

#### Center Canvas (~48% width, dotted/grid gray background)
A free-form visual canvas showing the automation flow as a vertical chain of step cards connected by arrows/lines. The canvas is panned/zoomed. Cards are connected top-to-bottom. A zoom/pan control bar sits at the bottom of the canvas area.

#### Right Configuration Panel (~30% width, white background, with a subtle left border)
A context panel that slides in from the right when a step card is selected. Currently showing the **Send Email** step configuration form. Title: `Send Email` / subtitle: `Send an email`. Contains form fields. A `Delete` button appears at the very bottom.

---

## Every UI Element (exhaustive)

### FUB Application Top Bar

| Element | Type | Value / State |
|---|---|---|
| Back to Automations | Link | `← Back to Automations` — navigates to `/2/automations` |
| Automation title | Static text | `Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]` |
| DISABLED | Status label pill | Gray text `DISABLED`, non-interactive label |
| Status toggle | Toggle switch | OFF state (gray) — automation is currently disabled |
| Save Changes | Button | Filled blue button, text `Save Changes` — saves the current automation edits |
| Settings / gear icon | Icon button | Gear glyph — likely opens automation settings/options modal [INFERRED] |
| Share / export icon | Icon button | Upload/share glyph — likely shares or exports the automation [INFERRED] |

---

### Left Rail

#### Search
- Text input, full width of left rail
- Magnifying glass icon on the left
- Placeholder: (empty, likely "Search…") [INFERRED from FUB conventions]

#### Tabs Row
- `Triggers` tab — inactive
- `Steps` tab — active (underlined or highlighted)

#### Drag Instruction
- Text: `Drag a Step to the canvas`

#### Step Being Dragged (highlighted)
- Blue dashed outline around a white card
- Icon: envelope/email icon (blue)
- Label: `Send Email`
- This card is currently mid-drag onto the canvas

#### Controls Section (header: `Controls`)

**Conditions tile**
- Icon: branching/split icon (gray)
- Label: `Conditions`
- Description: `Either condition is true or false`

**Time Delay tile**
- Icon: clock/timer icon (orange/red)
- Label: `Time Delay`
- Description: `Wait before starting the next step. Set a delay or pick a time to run.`

#### Actions Section (header: `Actions`)

**Send Email tile**
- Icon: envelope icon
- Label: `Send Email`
- Description: `Send an email`

**Reassign Agent or Lender tile**
- Icon: person/reassign icon
- Label: `Reassign Agent or Lender`
- Description: `Reassign the agent or lender`

**Add Collaborators tile**
- Icon: person+ icon
- Label: `Add Collaborators`
- Description: `Add Collaborators`

**Remove Collaborators tile**
- Icon: person– or X icon
- Label: `Remove Collaborators`
- Description: (description present, not fully legible)

**Add Tags tile**
- Icon: tag icon
- Label: `Add Tags`
- Description: `Add Tags`

**Remove Tags tile**
- Icon: tag– or X-tag icon
- Label: `Remove Tags`
- Description: `Remove Tags`

**Create Task tile**
- Icon: checkmark/task icon
- Label: `Create Task`
- Description: `Create a task`

**Change Stage tile**
- Icon: stage/funnel icon
- Label: `Change Stage`
- Description: `Change a stage`

**Add Note tile**
- Icon: note/document icon
- Label: `Add Note`
- Description: (description present, not fully legible — likely "Add a note to the contact")

---

### Center Canvas

The canvas renders the automation as a vertical flow. Each step card is a white rounded-rectangle. Steps are connected by vertical lines with arrows (top-to-bottom flow). The background is a light dotted/grid pattern on gray (`#f0f0f0` or similar).

#### Trigger Card (top of chain)
- Card type: **Trigger** (distinct style from action steps — lighter or different border)
- Label: `Tag Added`
- Sub-label / condition: `When tag audience:buyer`
- No delay indicator (triggers have no delay)
- Plus (`+`) button appears to the right or below the trigger card to add the first step

#### Step Card 1 — Send Email
- Card icon: envelope icon (blue)
- Card label: `Send Email`
- Step detail line 1: `BL-01 Your Bend search is set up`
- Step detail line 2: `Agent assigned to this contact`
- Delay badge: Clock icon + `0 days` (or `0` with a timer glyph)
- This card appears to be **currently selected** (highlighted with blue/active border), which is why the right panel shows its configuration

#### Step Card 2 — Create Task
- Card icon: checkmark/task icon
- Card label: `Create Task`
- Step detail: `Send this Buyer lead Now (Day 0) — use the BL-01 Buyer SMS…` (truncated)
- Delay badge: `0 days`

#### Step Card 3 — Send Email
- Card icon: envelope icon
- Card label: `Send Email`
- Step detail line 1: `BL-02 Two things that move buyers ahead`
- Step detail line 2: `Agent assigned to the…` (truncated)
- Delay badge: `9 days`

#### Step Card 4 — Send Email
- Card icon: envelope icon
- Card label: `Send Email`
- Step detail line 1: `BL-03 What to know about your top areas`
- Step detail line 2: `Agent assigned to the…` (truncated)
- Delay badge: `11 days`

#### Step Card 5 — Send Email
- Card icon: envelope icon
- Card label: `Send Email`
- Step detail line 1: `BL-04 What's moving in your budget area`
- Step detail line 2: (partially visible)
- Delay badge: (partially visible, higher day count)

#### Canvas Bottom Controls Bar
Fixed to the bottom of the canvas pane, a row of small icon buttons for canvas navigation:
- `+` (zoom in)
- `–` (zoom out)
- Fit-to-screen icon (square with arrows or similar)
- Fullscreen/expand icon

---

### Right Panel — Send Email Configuration

**Panel header:**
- Title: `Send Email` (large, bold)
- Subtitle: `Send an email` (smaller, gray)

---

#### Field: Template
- Label: `Template`
- Input type: Text input (single line) or searchable select
- Current value: `BL-01 Your Bend search is set up`
- Full width

#### Field: From
- Label: `From`
- Input type: Dropdown / select
- Icon: Person silhouette icon (gray) on the left inside the field
- Current value: `Agent assigned to the contact`
- Dropdown arrow on the right
- Full width

#### Field group: Recipient Preferences
- Group label: `Recipient Preferences`
- Radio button group (single select):
  - `● Send to primary contact only` — **SELECTED** (filled blue radio)
  - `○ Send to contact and all relationships` — unselected
  - `○ Send to assigned agent` — unselected

#### Field group: Delivery Preferences
- Group label: `Delivery Preferences`
- Radio button group (single select):
  - `● Send immediately` — **SELECTED** (filled blue radio)
  - `○ Send between 8:00 am and 7:00 pm` — unselected
  - `○ Send during company office hours` — unselected
  - `○ Send at custom time` — unselected

#### Delete Button (bottom of panel)
- Separator line above it
- Trash can icon (gray) + text label `Delete`
- Ghost / text-link style (not a filled button)
- Red or destructive styling [INFERRED: likely red text on hover]
- Clicking removes this step from the automation

---

## Colors, Typography & Style

### Colors
- **Top bar background:** White (`#ffffff`)
- **Left rail background:** Light gray (`#f5f5f5` or `#f7f7f7`)
- **Canvas background:** Slightly darker dotted gray (`#eeeeee` or similar with subtle dot grid)
- **Right panel background:** White (`#ffffff`)
- **Primary action color (Save Changes button, radio buttons, active drag highlight):** Blue (~`#1a73e8` or FUB brand blue `#2b6cb0` range)
- **DISABLED status label:** Gray text, likely `#888888` or `#6b7280`
- **Status toggle (off):** Gray (`#d1d5db`)
- **Step card backgrounds:** White with subtle box shadow and rounded corners (~6–8 px radius)
- **Step card border on selected:** Blue accent border (~2 px)
- **Drag ghost / dragging card border:** Blue dashed border (~`#4a90d9`)
- **Time Delay icon:** Orange-red (~`#e67e22` or `#f56565`)
- **Step action icons:** Blue envelope, gray/green task checkmark
- **Delete button text/icon:** Gray, likely turns red on hover [INFERRED]
- **Canvas connector lines:** Light gray vertical lines with small arrowheads pointing downward

### Typography
- Automation name in top bar: ~14–15 px, medium weight, dark gray/near-black
- Right panel title "Send Email": ~18–20 px, bold, black
- Right panel subtitle "Send an email": ~13 px, normal weight, medium gray
- Field labels: ~12–13 px, medium weight, dark gray (`#374151`)
- Field values / input text: ~14 px, normal weight, dark
- Step card primary label (e.g. "Send Email"): ~13 px, medium weight
- Step card detail line: ~12 px, normal weight, gray
- Left rail section headers ("Controls", "Actions"): ~11 px, uppercase, bold, medium gray — OR small-caps style

### Style Details
- **Border radius on cards:** ~8 px
- **Border radius on buttons:** ~4–6 px
- **Input fields:** Standard border (~1 px `#d1d5db`), rounded (~4 px), white background
- **Density:** Medium — comfortable spacing, not cramped
- **Iconography:** Outline-style icons, thin strokes, consistent 16–18 px size
- **Radio buttons:** Standard HTML-styled but with blue fill on selected state
- **No bottom "Getting Started" green progress bar visible** in this screenshot

---

## State & Data Shown

- **Active automation:** ID 110, named `Buyer LP Nurture — audience:buyer`, status = DISABLED (draft, explicitly labeled DO NOT ENABLE)
- **Active step selected:** Step card 1 (Send Email — BL-01 Your Bend search is set up) — right panel is open showing its config
- **Automation trigger:** Tag Added — audience:buyer
- **Step sequence visible:**
  1. Tag Added (trigger) — audience:buyer
  2. Send Email — BL-01, delay: 0 days
  3. Create Task — Day 0 SMS task, delay: 0 days
  4. Send Email — BL-02, delay: 9 days
  5. Send Email — BL-03, delay: 11 days
  6. Send Email — BL-04, delay: (higher, partially visible)
- **Template name in selected step:** `BL-01 Your Bend search is set up`
- **From:** `Agent assigned to the contact`
- **Recipient Preferences selected:** `Send to primary contact only`
- **Delivery Preferences selected:** `Send immediately`
- **Drag operation in progress:** A "Send Email" step tile is being dragged from the left rail onto the canvas (blue dashed drag ghost visible mid-canvas)
- **Unsaved changes:** `Save Changes` button is present and enabled, suggesting pending changes

---

## Interactions & Behaviors

### Left Rail
- **Tabs (Triggers / Steps):** Clicking switches between viewing available trigger types vs. available step types in the panel below
- **Search input:** Filters the list of available step tiles by keyword [INFERRED]
- **Step tiles are draggable:** Drag a tile from the left rail and drop it onto the canvas to insert a new step at that position. The canvas renders a drop zone (highlighted slot) as the user drags over it [INFERRED]
- The currently-dragging tile shows a blue dashed border; the drag ghost follows the cursor on the canvas

### Canvas
- **Click a step card:** Opens its configuration in the right panel. The card gets an active/selected border.
- **Drag to reorder:** Step cards may be draggable to reorder them in the sequence [INFERRED from FUB conventions]
- **`+` button between cards:** Appears on hover between any two connected cards to insert a new step at that position [INFERRED]
- **Canvas pan/zoom:** Mouse scroll to zoom; click-and-drag on blank canvas to pan. Bottom control bar has zoom in/out/fit/fullscreen buttons.
- **Connector lines:** Non-interactive, purely visual; show the sequence flow top-to-bottom

### Right Panel
- **Template field:** Click to open a searchable dropdown/modal listing all available email templates. The current template name is `BL-01 Your Bend search is set up`. [INFERRED: modal or inline dropdown]
- **From dropdown:** Click to select who the email appears to come from. Options likely include: `Agent assigned to the contact`, specific agent names, or the brokerage identity. Currently shows `Agent assigned to the contact`.
- **Recipient Preferences radio buttons:** Mutually exclusive. `Send to primary contact only` is selected.
- **Delivery Preferences radio buttons:** Mutually exclusive. `Send immediately` is selected. If `Send between 8:00 am and 7:00 pm` were selected, presumably time-zone or timezone-aware scheduling would apply. If `Send at custom time` were selected, a time picker would appear [INFERRED].
- **Delete button:** Removes this step from the automation canvas entirely. Likely shows a confirmation prompt [INFERRED].
- **Panel dismissal:** Clicking outside the panel or on another step card would switch the panel to that step's config, or collapse the panel [INFERRED].

### Top Bar
- **Save Changes button:** Persists all canvas changes (step positions, configurations, new steps) to the server. Becomes enabled when there are unsaved edits.
- **DISABLED toggle:** Clicking the toggle enables the automation, changing the status to `ENABLED` (green). The automation would then run when the trigger condition is met for contacts. Since the name says `DO NOT ENABLE`, this is a draft/sandbox automation.
- **Settings icon:** Opens automation-level settings (name, description, re-enrollment rules, etc.) [INFERRED]
- **Share icon:** Copies a link to this automation or exports it [INFERRED]
- **← Back to Automations:** Navigates to the automations list at `/2/automations` without saving [INFERRED: may prompt to save if unsaved changes exist]

---

## Data Model Signals

### Automation entity
- `id`: integer (110)
- `name`: string (`"Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]"`)
- `status`: enum — `DISABLED` | `ENABLED`
- `trigger_type`: enum — at least `tag_added`
- `trigger_value`: string — tag value that fires the trigger (`"audience:buyer"`)
- `steps`: ordered array of step objects

### Step entity
- `type`: enum — `send_email` | `create_task` | `change_stage` | `add_tags` | `remove_tags` | `add_collaborators` | `remove_collaborators` | `reassign_agent_or_lender` | `add_note` | `condition` | `time_delay`
- `delay_days`: integer (0, 9, 11, …)
- `order`: integer (position in the sequence)
- Per-type config fields (jsonb or typed sub-object):

**send_email config:**
- `template_id` / `template_name`: references an email template (`BL-01 Your Bend search is set up`)
- `from`: enum — `agent_assigned` | specific agent ID
- `recipient_preference`: enum — `primary_only` | `contact_and_relationships` | `assigned_agent`
- `delivery_preference`: enum — `immediately` | `business_hours_8_7` | `company_office_hours` | `custom_time`
- `custom_time`: nullable time (only when delivery_preference = `custom_time`)

**create_task config:**
- `task_description`: string
- `due_offset_days`: integer

**time_delay config:**
- `delay_value`: integer
- `delay_unit`: enum — `days` | `hours` | `minutes`
- OR `run_at_time`: datetime/time

### Tag entity
- `name`: string (e.g. `audience:buyer`)
- Tags appear to support colon-separated namespacing (`audience:buyer` implies a namespace `audience` with value `buyer`)

### Email template entity
- `id` / `name`: referenced by send_email steps
- Template names follow a prefix convention: `BL-01`, `BL-02`, `BL-03`, `BL-04` (BL = Buyer Lead nurture sequence)

### Agent / User assignment
- `from` field references `agent_assigned_to_contact` as a dynamic role rather than a hardcoded user ID — meaning the email sender resolves at execution time to whoever is assigned to the contact record

---

## Rebuild Notes

### Component Breakdown

```
<AutomationBuilderPage>
  ├── <AutomationTopBar>
  │     ├── <BackLink href="/automations">← Back to Automations</BackLink>
  │     ├── <AutomationTitle>{name}</AutomationTitle>
  │     ├── <StatusBadge status="DISABLED" />
  │     ├── <StatusToggle enabled={false} onChange={handleToggleStatus} />
  │     ├── <Button variant="primary" onClick={handleSave}>Save Changes</Button>
  │     ├── <IconButton icon={<GearIcon />} onClick={openSettings} />
  │     └── <IconButton icon={<ShareIcon />} onClick={handleShare} />
  │
  ├── <AutomationBuilderBody>
  │
  │   ├── <StepLibraryPanel>  {/* left rail */}
  │   │     ├── <SearchInput placeholder="Search…" />
  │   │     ├── <Tabs>
  │   │     │     ├── <Tab label="Triggers" active={false} />
  │   │     │     └── <Tab label="Steps" active={true} />
  │   │     ├── <DragInstruction>Drag a Step to the canvas</DragInstruction>
  │   │     ├── <StepSection label="Controls">
  │   │     │     ├── <DraggableStepTile type="condition" label="Conditions"
  │   │     │     │     description="Either condition is true or false" icon={<BranchIcon />} />
  │   │     │     └── <DraggableStepTile type="time_delay" label="Time Delay"
  │   │     │           description="Wait before starting the next step…" icon={<ClockIcon />} />
  │   │     └── <StepSection label="Actions">
  │   │           ├── <DraggableStepTile type="send_email" label="Send Email"
  │   │           │     description="Send an email" icon={<EnvelopeIcon />} dragging={true} />
  │   │           ├── <DraggableStepTile type="reassign_agent" label="Reassign Agent or Lender" … />
  │   │           ├── <DraggableStepTile type="add_collaborators" label="Add Collaborators" … />
  │   │           ├── <DraggableStepTile type="remove_collaborators" label="Remove Collaborators" … />
  │   │           ├── <DraggableStepTile type="add_tags" label="Add Tags" … />
  │   │           ├── <DraggableStepTile type="remove_tags" label="Remove Tags" … />
  │   │           ├── <DraggableStepTile type="create_task" label="Create Task" … />
  │   │           ├── <DraggableStepTile type="change_stage" label="Change Stage" … />
  │   │           └── <DraggableStepTile type="add_note" label="Add Note" … />
  │   │
  │   ├── <AutomationCanvas>  {/* center — react-flow or similar */}
  │   │     ├── <TriggerCard trigger={{ type: 'tag_added', value: 'audience:buyer' }} />
  │   │     ├── <ConnectorLine />
  │   │     ├── <StepCard step={steps[0]} selected={true}  {/* Send Email BL-01, 0 days */} />
  │   │     ├── <ConnectorLine />
  │   │     ├── <StepCard step={steps[1]}  {/* Create Task, 0 days */} />
  │   │     ├── <ConnectorLine />
  │   │     ├── <StepCard step={steps[2]}  {/* Send Email BL-02, 9 days */} />
  │   │     ├── <ConnectorLine />
  │   │     ├── <StepCard step={steps[3]}  {/* Send Email BL-03, 11 days */} />
  │   │     ├── <ConnectorLine />
  │   │     ├── <StepCard step={steps[4]}  {/* Send Email BL-04, X days */} />
  │   │     └── <CanvasControls>
  │   │           <ZoomIn /><ZoomOut /><FitToScreen /><Fullscreen />
  │   │         </CanvasControls>
  │   │
  │   └── <StepConfigPanel step={selectedStep}>  {/* right panel — slides in on step selection */}
  │         ├── <PanelHeader title="Send Email" subtitle="Send an email" />
  │         ├── <TemplateField value="BL-01 Your Bend search is set up" />
  │         ├── <FromField value="agent_assigned" options={[…]} />
  │         ├── <RadioGroup label="Recipient Preferences"
  │         │     options={['primary_only','contact_and_relationships','assigned_agent']}
  │         │     value="primary_only" />
  │         ├── <RadioGroup label="Delivery Preferences"
  │         │     options={['immediately','business_hours_8_7','company_office_hours','custom_time']}
  │         │     value="immediately" />
  │         └── <DeleteStepButton />
  │
</AutomationBuilderPage>
```

### Non-Obvious Logic

1. **Drag-and-drop canvas insertion:** When a DraggableStepTile is dragged over the canvas, drop zones appear between existing step cards (likely rendered as highlighted gap slots). On drop, the step is inserted at that position and the StepConfigPanel opens immediately for configuration. Likely implemented with `react-dnd` or `@dnd-kit` plus a custom react-flow node type.

2. **Step card content rendering:** Each step card shows a summary of its key configuration (template name, task name, etc.) as detail lines below the step type label. This means the canvas reads the full step config to render the preview text — the canvas is not just showing step types, it's showing configuration summaries.

3. **Delay badge on step cards:** The delay shown on each step card (e.g. `0 days`, `9 days`) represents the time delay BEFORE that step runs relative to the previous step, not cumulative. The time delay may be configured on the step itself or via a separate Time Delay step card interleaved in the sequence.

4. **Automation status gate:** The `DISABLED` toggle prevents the automation from running even if the trigger fires. The name `[DRAFT - DO NOT ENABLE]` is a convention the user typed — there is no system-enforced "draft" status; the toggle is the mechanism.

5. **`From` field dynamic resolution:** `Agent assigned to the contact` resolves at send time to the specific agent assigned to the contact record, not a hardcoded agent. This means the email appears to come from whoever is currently assigned — important for team scenarios.

6. **Recipient Preferences enum:** Three modes:
   - `primary_only` — sends only to the primary contact email
   - `contact_and_relationships` — sends to the contact AND related contacts (spouse, co-borrower, etc.) on the record
   - `assigned_agent` — sends to the agent, not the contact (useful for internal notification steps)

7. **Delivery Preferences scheduling:** `Send between 8:00 am and 7:00 pm` and `Send during company office hours` implement send-time optimization — if the step triggers at 2 AM, the email queues until the window opens. `Send at custom time` would reveal a time picker (likely a time input with timezone selector) [INFERRED].

8. **Template field:** The template name `BL-01` suggests a naming convention (BL = Buyer Lead, 01 = first in sequence). The field likely opens a searchable modal or inline dropdown listing all templates created in the Email Templates section of FUB.

9. **Canvas vertical scroll:** The canvas scrolls vertically to reveal additional steps below. The entire flow for this automation (at least 5+ steps) extends below the initial viewport, requiring scroll or fit-to-screen to see all steps.

10. **Save Changes behavior:** Changes to step configurations, new steps added, and step reordering all produce an unsaved state. The `Save Changes` button commits all pending changes atomically. Navigating away without saving likely prompts a confirmation dialog [INFERRED].
