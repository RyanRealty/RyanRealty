<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.27.31 AM.png | Sequential id: shot-36 | Tiles: fub-tiles/shot-36_{full,q1,q2,q3,q4}.png -->

# shot-36 — Action Plan / Automation Step Editor (Send Email Step Config)

## Identity

- **Visible URL:** `ryan-realty.followupboss.com/2/automations/v2/edit/110`
- **Browser tab title:** "Editing - Buyer LP Nurture - …"
- **Page / automation name (header):** `Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]`
- **Top-nav active area:** Automations (inferred from URL path `/2/automations/v2/edit/110`)
- **Sub-nav / tab active:** "Steps" tab is active in the left rail (not "Triggers")
- **Breadcrumb:** `← Back to Automations` link visible in upper-left area
- **Status badge:** `DISABLED` (grey pill label next to a toggle switch that is in the OFF / disabled position)
- **Action button:** `Save Changes` (primary button, top-right of page content area)
- **Logged-in user:** Avatar visible in browser top-right corner (Chrome profile avatar); FUB user identity not fully legible from the screenshot
- **Account / brokerage name:** Ryan Realty (inferred from subdomain `ryan-realty.followupboss.com`)

---

## Layout

The screen uses a **three-column layout** inside the automation editor, filling the full browser viewport below the browser chrome:

### Top bar (automation header)
- Fixed bar across the full width, approximately 48–52 px tall
- Contains: `← Back to Automations` link (left), automation name `Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]` (center-left), `DISABLED` badge + toggle switch + `Save Changes` button (right), and two icon buttons (gear/settings and share) far right

### Left Rail — Step/Action Library (~240–280 px wide, fixed, full height, scrollable)
- Sits flush left below the top bar
- Contains a search field at top (placeholder text not legible but standard search UX)
- Two tabs: **Triggers** | **Steps** — "Steps" is the active tab
- Under Steps, the panel is divided into labeled sections:

  **Controls** section header
  - `Conditions` item — icon + label + subtitle "Either condition is true or false"
  - `Time Delay` item — icon (clock) + label + subtitle "Wait before starting the next step. Set a delay or set a time to run"

  **Actions** section header
  - `Send Email` — envelope icon + subtitle "Send an email"
  - `Reassign Agent or Lender` — person-swap icon + subtitle "Reassign the agent or lender"
  - `Add Collaborators` — person-plus icon + subtitle "Add Collaborators"
  - `Remove Collaborators` — person-minus icon + subtitle "Remove Collaborators"
  - `Add Tags` — tag-plus icon + subtitle "Add Tags"
  - `Remove Tags` — tag-minus icon + subtitle "Remove Tags"
  - `Create Task` — checkbox/task icon + subtitle "Create a task"
  - `Change Stage` — stage-arrow icon + subtitle "Change a stage"
  - `Add Note` — note/pencil icon + subtitle "Add a note"

- A drag instruction is shown near the top of the canvas area: "Drag a Step to the canvas"

### Center Column — Automation Canvas (~60% of remaining width, scrollable vertically)
- Light grey/white background canvas area
- Contains the visual vertical flow of automation steps rendered as cards
- Each step card is a rounded-rectangle box (~300–350 px wide) centered in the canvas column
- Steps are connected top-to-bottom with vertical connector lines and "+" add-step buttons between them
- A mini-map / navigation control bar is at the very bottom of the canvas (arrow controls + zoom)
- Canvas is scrollable; steps extend vertically beyond the viewport

### Right Sidebar — Step Configuration Panel (~320–360 px wide, fixed, full height, scrollable)
- Appears when a step card is selected in the canvas
- White background with a visible left border/divider
- Shows the configuration form for the currently selected step
- At the bottom of the right panel is a `🗑 Delete` action link in red/danger styling

---

## Every UI Element (Exhaustive)

### Top Bar Elements

| Element | Type | Value / State |
|---|---|---|
| `← Back to Automations` | Link / breadcrumb | Navigates back to automations list |
| Automation name | Static text / heading | `Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]` |
| `DISABLED` | Badge/pill | Grey background, uppercase label — automation is not active |
| Toggle switch | Toggle | OFF / disabled state (grey) |
| `Save Changes` | Button (primary, filled) | Blue/primary color; saves current automation edits |
| Gear icon button | Icon button | Settings for the automation [INFERRED] |
| Share icon button | Icon button | Share or export the automation [INFERRED] |

### Left Rail — Steps Tab

**Search field** (at top of left rail):
- Type: text input
- Placeholder: (search/filter steps — text not legible at this zoom)

**Tab row:**
- `Triggers` tab — inactive
- `Steps` tab — **active** (underlined or highlighted)

**Controls section:**

| Item | Icon | Subtitle |
|---|---|---|
| `Conditions` | Diamond/branch icon | "Either condition is true or false" |
| `Time Delay` | Clock icon | "Wait before starting the next step. Set a delay or set a time to run" |

**Actions section:**

| Item | Icon | Subtitle |
|---|---|---|
| `Send Email` | Envelope icon | "Send an email" |
| `Reassign Agent or Lender` | Person-swap icon | "Reassign the agent or lender" |
| `Add Collaborators` | Person-plus icon | "Add Collaborators" |
| `Remove Collaborators` | Person-minus icon | "Remove Collaborators" |
| `Add Tags` | Tag icon | "Add Tags" |
| `Remove Tags` | Tag-minus icon | "Remove Tags" |
| `Create Task` | Checkbox/task icon | "Create a task" |
| `Change Stage` | Arrow/funnel icon | "Change a stage" |
| `Add Note` | Pencil/note icon | "Add a note" |

### Center Canvas — Automation Step Cards (top to bottom)

**Step 1 — Trigger: Tag Added**
- Card type: Trigger (visually distinct — rounded rectangle, possibly different border/background)
- Header text: `Tag Added`
- Body text: "When tag is one of: audience:buyer"
- Contains a `+` button below it to add a step
- Position: top of canvas flow

**Step 2 — Send Email (currently selected / highlighted)**
- Card type: Action step
- Label: `Send Email`
- Body preview: `BL-01 Your Bend search is set up — Agent assigned to the…` (truncated)
- Time indicator: appears at "0 days" delay (immediately after trigger)
- Card is highlighted / selected state (blue border or elevated shadow)
- Has a `+` button below

**Step 3 — Create Task**
- Card type: Action step
- Label: `Create Task`
- Body preview: `Send first meetings belong tasks to this buyer within 30 min - Follow u…` (truncated)
- Has a `+` button below

**Step 4 — Create Task** (second instance)
- Card type: Action step
- Label: `Create Task`
- Body preview: partially visible / truncated
- Has a `+` button below

**Step 5 — Send Email**
- Card type: Action step
- Label: `Send Email`
- Body preview: `BL-02 Two things that will help buyers ahead — Agent assigned to the…`
- Time indicator: `9 days` (delay badge visible below the card or between connector)
- Has a `+` button below

**Step 6 — Send Email**
- Card type: Action step
- Label: `Send Email`
- Body preview: `BL-03 What to know about your tax area — Agent assigned to the…`
- Time indicator: `9 days`
- Has a `+` button below

**Step 7 — Send Email**
- Card type: Action step
- Label: `Send Email`
- Body preview: `BL-04 What's coming in your budget range — Agent assigned to the…`
- Time indicator: visible (value partially cut off at bottom of viewport)
- Canvas continues scrolling below this point

**Canvas bottom controls:**
- Left/right/up/down arrow pan buttons
- Zoom in / zoom out controls
- Fit-to-screen button [INFERRED from FUB conventions]
- Small horizontal drag handle (grey pill) at very bottom center

**Connector lines / delay indicators:**
- Vertical lines connect each step card
- Time delay badges (e.g., `9 days`) appear in the connector line between steps, shown as small pill/badge overlaid on the connector line

### Right Sidebar — "Send Email" Step Configuration Panel

**Panel header:**
- Title: `Send Email` (bold, ~18px)
- Subtitle: `Send an email` (grey, ~13px)

**Field: Template**
- Label: `Template`
- Type: Text input (single-line, possibly autocomplete/picker)
- Current value: `BL-01 Your Bend search is set up`
- Full-width input box with rounded border

**Field: From**
- Label: `From`
- Type: Select / dropdown
- Leading icon: person/silhouette icon inside the dropdown
- Current value: `Agent assigned to the contact`
- Chevron/arrow at right indicating dropdown
- Full-width

**Section: Recipient Preferences**
- Label: `Recipient Preferences` (section subheading, grey, small)
- Radio button group:
  - ● `Send to primary contact only` — **SELECTED** (filled blue radio)
  - ○ `Send to contact and all relationships` — unselected
  - ○ `Send to assigned agent` — unselected

**Section: Delivery Preferences**
- Label: `Delivery Preferences` (section subheading, grey, small)
- Radio button group:
  - ● `Send immediately` — **SELECTED** (filled blue radio)
  - ○ `Send between 8:00 am and 7:00 pm` — unselected
  - ○ `Send during company office hours` — unselected (appears slightly greyed/disabled)
  - ○ `Send at custom time` — unselected

**Panel bottom action:**
- `🗑 Delete` — link/button with trash icon, positioned at the very bottom of the right panel; danger color (likely red or muted red); deletes this step from the automation

---

## Colors, Typography & Style

### Colors
- **Top bar background:** White (`#FFFFFF`) or very light grey
- **Canvas background:** Light grey (`#F4F5F7` or similar — neutral workspace)
- **Left rail background:** White or very light grey, slightly distinguished from canvas
- **Right sidebar background:** White (`#FFFFFF`)
- **Primary button (`Save Changes`):** Blue — FUB brand blue (~`#1B6CF2` or similar)
- **`DISABLED` badge:** Grey pill — `#9CA3AF` background, white or grey text
- **Step cards:** White background with light border (`#E5E7EB` approx), subtle drop shadow
- **Selected step card:** Blue border highlight (accent color ~`#1B6CF2`) or elevated shadow
- **Trigger card:** May have a different accent — possibly purple/violet or a distinct color to differentiate from action steps
- **Time delay badge/pill on connector:** Muted grey or light teal pill background
- **Radio buttons (selected):** Filled blue circle matching primary brand color
- **Delete link:** Red/danger (`#EF4444` or `#DC2626`)
- **Section subheadings in right panel:** Grey (`#6B7280`)
- **Connector lines between steps:** Grey (`#D1D5DB`)

### Typography
- **Automation name in header:** Medium weight, ~15–16px, dark grey/black
- **Step card titles:** ~14px, medium/semibold weight, dark
- **Step card body preview:** ~12–13px, regular weight, muted grey, truncated with ellipsis
- **Right panel section labels:** ~12px, uppercase or small-caps, grey — used as field labels
- **Right panel field values:** ~14px, regular, dark
- **Left rail action labels:** ~13–14px, semibold, dark
- **Left rail action subtitles:** ~12px, regular, muted grey

### Style Details
- **Border radius on step cards:** ~8–12px (moderately rounded)
- **Border radius on right panel inputs:** ~6px
- **Border radius on `DISABLED` badge:** ~4px (pill-shaped)
- **Density:** Medium — generous padding between steps (~16–24px gap), comfortable form field spacing in right panel (~16px between fields)
- **Icon style:** Line/outline icons (not filled), consistent stroke weight ~1.5px
- **Dividers:** Light horizontal rules between sections in the right panel
- **No green "Getting Started" progress bar** visible at the bottom of this screen — this is a deep editor view

---

## State & Data Shown

- **Automation being edited:** `Buyer LP Nurture` — automation ID `110` per URL
- **Audience tag trigger:** `audience:buyer` — this automation fires when this tag is added to a contact
- **Draft status:** `[DRAFT - DO NOT ENABLE]` in the name — automation is disabled (`DISABLED` badge + toggle off)
- **Currently selected/active step:** The first `Send Email` step (Step 2) — its config is shown in the right panel
- **Template name in selected step:** `BL-01 Your Bend search is set up`
- **From sender:** `Agent assigned to the contact` (dynamic — resolves at runtime to the assigned agent)
- **Email sequence visible in canvas:**
  - `BL-01 Your Bend search is set up` — immediately (0 days)
  - `BL-02 Two things that will help buyers ahead` — 9 days later
  - `BL-03 What to know about your tax area` — 9 days later
  - `BL-04 What's coming in your budget range` — 9 days later (likely continues)
- **Tasks in the sequence:**
  - `Create Task`: "Send first meetings belong tasks to this buyer within 30 min - Follow u…"
  - Second `Create Task` (content partially visible)
- **Total steps visible:** At least 7 (1 trigger + 6 action steps), canvas scrollable to reveal more
- **Recipient preference state:** "Send to primary contact only" selected
- **Delivery preference state:** "Send immediately" selected
- **Automation ID:** 110 (from URL)

---

## Interactions & Behaviors

### Canvas Interactions
- **Drag step from left rail to canvas:** Dragging a step item from the left rail onto the canvas inserts it into the flow at the drop position [INFERRED from "Drag a Step to the canvas" instruction text]
- **Click "+" button between steps:** Opens a step-picker or inserts a new step at that position [INFERRED]
- **Click a step card:** Selects it and opens its configuration form in the right sidebar panel
- **Drag step card within canvas:** Reorders steps by dragging [INFERRED from visual flow builder convention]
- **Canvas pan/zoom controls:** Bottom navigation buttons allow panning the canvas and zooming in/out
- **Hover on step card:** Likely reveals action buttons (edit, delete, duplicate) on hover [INFERRED]

### Left Rail Interactions
- **Tabs (Triggers / Steps):** Click to switch between the trigger types list and step/action types list
- **Drag action item:** Drag from left rail to canvas to add a new step [INFERRED from instruction text]
- **Search field:** Filters the list of available steps/triggers as you type [INFERRED]

### Top Bar Interactions
- **`← Back to Automations`:** Navigates back to the automations list page; may prompt to save unsaved changes [INFERRED]
- **Toggle switch (DISABLED):** Click to enable/activate the automation (changes to ENABLED state)
- **`Save Changes` button:** Saves the current state of the automation draft to the server
- **Gear icon:** Opens automation-level settings (name, description, trigger conditions) [INFERRED]
- **Share icon:** Allows sharing or exporting the automation [INFERRED]

### Right Panel Interactions
- **Template field:** Click to open a template picker/search modal where you select from saved email templates [INFERRED — value shown is a template name not free text]
- **From dropdown:** Click to open options for who sends the email (Agent assigned to contact, specific agent, etc.)
- **Recipient Preferences radio group:** Click any radio to switch the recipient target
- **Delivery Preferences radio group:** Click any radio to switch delivery timing
  - "Send during company office hours" option appears slightly disabled/greyed — may require company office hours to be configured in account settings [INFERRED]
  - "Send at custom time" when selected likely reveals a time picker sub-field [INFERRED]
- **`🗑 Delete`:** Removes this step from the automation flow (with confirmation dialog [INFERRED])

### Step Card Actions (on hover or click) [INFERRED]
- Edit (opens right panel — same as click)
- Delete (removes step)
- Duplicate (copies step) — common in flow builders
- Drag handle for reordering

---

## Data Model Signals

### Entities

**Automation**
- `id` (integer, e.g., 110)
- `name` (string, e.g., "Buyer LP Nurture")
- `audience_tag` (string, e.g., "audience:buyer") — derived from trigger
- `status` (enum: `enabled`, `disabled`, `draft`)
- `version` (v2 per URL path `/automations/v2/`)

**AutomationStep** (ordered list within Automation)
- `id`
- `automation_id`
- `step_type` (enum: `send_email`, `create_task`, `time_delay`, `add_tags`, `remove_tags`, `change_stage`, `reassign_agent_or_lender`, `add_collaborators`, `remove_collaborators`, `add_note`, `condition`)
- `position` / `order` (integer for sequencing)
- `delay_value` (integer, e.g., 9)
- `delay_unit` (enum: `minutes`, `hours`, `days`)
- `config` (jsonb — step-type-specific config object)

**SendEmailStepConfig** (config for step_type = send_email)
- `template_id` / `template_name` (e.g., "BL-01 Your Bend search is set up")
- `from` (enum: `agent_assigned_to_contact`, specific agent ID)
- `recipient_preference` (enum: `primary_contact_only`, `contact_and_relationships`, `assigned_agent`)
- `delivery_preference` (enum: `immediately`, `between_8am_7pm`, `company_office_hours`, `custom_time`)
- `custom_time` (nullable time value — used when delivery_preference = custom_time)

**CreateTaskStepConfig**
- `task_description` / `task_body`
- `due_in_minutes` or similar (e.g., "within 30 min")
- `assignee` (agent assignment)

**Trigger**
- `trigger_type` (enum: `tag_added`, `stage_changed`, `new_lead`, etc.)
- `tag_value` (string, e.g., "audience:buyer") — for tag_added trigger type

**EmailTemplate**
- `id`
- `name` (e.g., "BL-01 Your Bend search is set up")
- `subject`
- `body`
- Used by reference in SendEmailStepConfig

### Enum Values Observed
- `step_type`: `send_email`, `create_task`, `time_delay`, `conditions`, `reassign_agent_or_lender`, `add_collaborators`, `remove_collaborators`, `add_tags`, `remove_tags`, `change_stage`, `add_note`
- `trigger_type`: `tag_added`
- `from_options`: `agent_assigned_to_contact` (plus likely specific agent options)
- `recipient_preference`: `primary_contact_only`, `contact_and_relationships`, `assigned_agent`
- `delivery_preference`: `immediately`, `between_8am_and_7pm`, `company_office_hours`, `custom_time`
- `automation_status`: `disabled`, `enabled` (draft implied by name convention)
- `delay_unit`: `days` (9 days observed)

### Relationships
- Automation has many AutomationSteps (ordered)
- AutomationStep has one Trigger (first step) and many Action Steps
- SendEmailStep references an EmailTemplate
- AutomationStep.delay applies between the previous step and this step

---

## Rebuild Notes

### Component Breakdown

```
<AutomationEditorPage>
  <AutomationEditorTopBar>
    <BackLink href="/automations">← Back to Automations</BackLink>
    <AutomationName>Buyer LP Nurture — audience:buyer [DRAFT - DO NOT ENABLE]</AutomationName>
    <StatusControls>
      <DisabledBadge label="DISABLED" />
      <ToggleSwitch enabled={false} onChange={handleToggleEnable} />
      <Button variant="primary" onClick={handleSave}>Save Changes</Button>
      <IconButton icon="settings" />
      <IconButton icon="share" />
    </StatusControls>
  </AutomationEditorTopBar>

  <AutomationEditorBody>
    <StepLibraryRail>
      <SearchInput placeholder="Search steps..." />
      <TabRow>
        <Tab label="Triggers" active={false} />
        <Tab label="Steps" active={true} />
      </TabRow>
      <StepLibrarySection title="Controls">
        <DraggableStepItem type="conditions" label="Conditions" subtitle="Either condition is true or false" icon={<ConditionsIcon />} />
        <DraggableStepItem type="time_delay" label="Time Delay" subtitle="Wait before starting the next step. Set a delay or set a time to run" icon={<ClockIcon />} />
      </StepLibrarySection>
      <StepLibrarySection title="Actions">
        <DraggableStepItem type="send_email" label="Send Email" subtitle="Send an email" icon={<EnvelopeIcon />} />
        <DraggableStepItem type="reassign_agent_or_lender" label="Reassign Agent or Lender" subtitle="Reassign the agent or lender" icon={<PersonSwapIcon />} />
        <DraggableStepItem type="add_collaborators" label="Add Collaborators" subtitle="Add Collaborators" icon={<PersonPlusIcon />} />
        <DraggableStepItem type="remove_collaborators" label="Remove Collaborators" subtitle="Remove Collaborators" icon={<PersonMinusIcon />} />
        <DraggableStepItem type="add_tags" label="Add Tags" subtitle="Add Tags" icon={<TagPlusIcon />} />
        <DraggableStepItem type="remove_tags" label="Remove Tags" subtitle="Remove Tags" icon={<TagMinusIcon />} />
        <DraggableStepItem type="create_task" label="Create Task" subtitle="Create a task" icon={<TaskIcon />} />
        <DraggableStepItem type="change_stage" label="Change Stage" subtitle="Change a stage" icon={<StageIcon />} />
        <DraggableStepItem type="add_note" label="Add Note" subtitle="Add a note" icon={<NoteIcon />} />
      </StepLibrarySection>
    </StepLibraryRail>

    <AutomationCanvas>
      {/* Empty state instruction (shown before any step is dragged) */}
      {/* "Drag a Step to the canvas" — shown as overlay instruction when canvas is empty or no step is dragged yet */}
      
      <StepCard type="trigger" stepType="tag_added" selected={false}>
        <StepCardHeader label="Tag Added" />
        <StepCardBody>When tag is one of: audience:buyer</StepCardBody>
      </StepCard>
      <StepConnector />
      <AddStepButton />
      
      <StepCard type="action" stepType="send_email" selected={true}>
        <StepCardHeader label="Send Email" />
        <StepCardBody preview="BL-01 Your Bend search is set up — Agent assigned to the…" />
      </StepCard>
      <StepConnector />
      <AddStepButton />
      
      <StepCard type="action" stepType="create_task" selected={false}>
        <StepCardHeader label="Create Task" />
        <StepCardBody preview="Send first meetings belong tasks to this buyer within 30 min - Follow u…" />
      </StepCard>
      <StepConnector />
      <AddStepButton />
      
      <StepCard type="action" stepType="create_task" selected={false}>
        <StepCardHeader label="Create Task" />
        <StepCardBody preview="…" />
      </StepCard>
      <DelayBadge value={9} unit="days" />
      <StepConnector />
      <AddStepButton />

      <StepCard type="action" stepType="send_email" selected={false}>
        <StepCardHeader label="Send Email" />
        <StepCardBody preview="BL-02 Two things that will help buyers ahead — Agent assigned to the…" />
      </StepCard>
      <DelayBadge value={9} unit="days" />
      <StepConnector />
      <AddStepButton />

      <StepCard type="action" stepType="send_email" selected={false}>
        <StepCardHeader label="Send Email" />
        <StepCardBody preview="BL-03 What to know about your tax area — Agent assigned to the…" />
      </StepCard>
      <DelayBadge value={9} unit="days" />
      <StepConnector />
      <AddStepButton />

      <StepCard type="action" stepType="send_email" selected={false}>
        <StepCardHeader label="Send Email" />
        <StepCardBody preview="BL-04 What's coming in your budget range — Agent assigned to the…" />
      </StepCard>
      {/* more steps below scroll boundary */}
      
      <CanvasNavigationBar>
        <PanButton direction="left" />
        <PanButton direction="right" />
        <PanButton direction="up" />
        <PanButton direction="down" />
        <ZoomInButton />
        <ZoomOutButton />
        <FitToScreenButton />
      </CanvasNavigationBar>
    </AutomationCanvas>

    <StepConfigPanel>
      {/* Shown when a step is selected */}
      <StepConfigPanelHeader title="Send Email" subtitle="Send an email" />
      
      <FormField label="Template">
        <TemplatePickerInput value="BL-01 Your Bend search is set up" onClick={openTemplatePicker} />
      </FormField>
      
      <FormField label="From">
        <SelectDropdown
          leadingIcon={<PersonIcon />}
          value="Agent assigned to the contact"
          options={[
            "Agent assigned to the contact",
            // specific agents [INFERRED]
          ]}
        />
      </FormField>
      
      <FormSection label="Recipient Preferences">
        <RadioGroup name="recipient_preference" value="primary_contact_only">
          <RadioOption value="primary_contact_only" label="Send to primary contact only" checked={true} />
          <RadioOption value="contact_and_relationships" label="Send to contact and all relationships" checked={false} />
          <RadioOption value="assigned_agent" label="Send to assigned agent" checked={false} />
        </RadioGroup>
      </FormSection>
      
      <FormSection label="Delivery Preferences">
        <RadioGroup name="delivery_preference" value="immediately">
          <RadioOption value="immediately" label="Send immediately" checked={true} />
          <RadioOption value="between_8am_7pm" label="Send between 8:00 am and 7:00 pm" checked={false} />
          <RadioOption value="company_office_hours" label="Send during company office hours" checked={false} disabled={true} />
          {/* disabled likely because office hours not configured in account settings */}
          <RadioOption value="custom_time" label="Send at custom time" checked={false} />
          {/* custom_time reveals a time picker when selected [INFERRED] */}
        </RadioGroup>
      </FormSection>
      
      <StepConfigPanelFooter>
        <DangerButton icon={<TrashIcon />} onClick={handleDeleteStep}>Delete</DangerButton>
      </StepConfigPanelFooter>
    </StepConfigPanel>
  </AutomationEditorBody>
</AutomationEditorPage>
```

### Non-obvious Logic

1. **`DISABLED` toggle + `DRAFT` name convention:** The automation is both named with `[DRAFT - DO NOT ENABLE]` in its actual name string AND is in a disabled state via the toggle. This implies two separate protection layers: the disabled toggle prevents execution, and the name convention is a human-readable warning. Developers should handle that renaming and toggling are independent operations.

2. **Template picker vs. free-text:** The `Template` field in the Send Email config almost certainly opens a modal/search overlay to select from existing saved email templates (the value `BL-01 Your Bend search is set up` looks like a named template code — "BL" prefix may stand for "Buyer LP" or "Buyer Lead"). It is NOT a free-text compose field — it references a pre-existing template by name/ID.

3. **`From` field = dynamic runtime resolution:** "Agent assigned to the contact" is a runtime-evaluated value. The system resolves the actual sender at the moment of execution by looking up the contact's assigned agent. The dropdown likely also allows selecting specific named agents.

4. **Delay positioning:** Time delay badges (e.g., `9 days`) appear to be rendered on the connector line BETWEEN step cards, not as a property inside the step card itself. In the data model, the delay is an attribute of the step (how long to wait before THIS step runs), but visually it's displayed between the previous step and this step.

5. **`Send during company office hours` — disabled state:** This option appears greyed-out in the radio group, likely because the account has not configured company office hours in Admin settings. When clicked, it may redirect to settings or show a tooltip explaining the dependency.

6. **Canvas is a drag-and-drop flow builder (not a form):** The center canvas is not a list — it's an interactive visual builder where:
   - Steps are draggable cards
   - Connector lines show flow direction
   - "+" buttons between steps insert new steps
   - The canvas supports panning and zooming
   - A mini-map or navigation controls sit at the bottom

7. **`v2` in URL path:** The URL contains `/automations/v2/edit/` suggesting FUB has a v1 and v2 automation editor. The v2 editor is the visual canvas builder (this screen); v1 may be a legacy list-based editor.

8. **Automation audience pattern:** The automation name includes `audience:buyer` in the name itself as a human reminder of the trigger tag. The trigger card also shows `When tag is one of: audience:buyer`. Both are user-defined — the tag value `audience:buyer` is a FUB contact tag used as the entry point for this nurture sequence.

9. **Email sequence naming convention:** The `BL-01`, `BL-02`, `BL-03`, `BL-04` prefix in template names is a user-defined naming convention (likely "Buyer LP" sequence emails numbered sequentially). The CRM itself does not enforce this convention — it's the template names chosen by the account admin.

10. **Step card body text truncation:** Step cards show only a short preview/summary of the step configuration, truncated with ellipsis. The full config is only visible in the right panel when selected. Developer must implement text truncation (1–2 lines max) on the card body.
