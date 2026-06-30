<!-- Addendum capture 2026-06-30. Fills: §07 Contact Detail interactions (Log Call, Merge Fields) -->

# FUB Contact Detail — Exhaustive Buildable Analysis
## Recording: contact2 (12 frames)
## Target spec section: §07 Contact Detail
## Gaps covered: Log Call modal, Merge Fields / Templates, logged-call timeline card, inline-edit active states, Create Task dialog, Insert HTML modal

---

## 0. Recording overview

The 12 frames traverse this sequence of states in one continuous session:

| Frame | Primary state | What changed |
|-------|--------------|--------------|
| f01 | Personal Notification Settings page | Unrelated — provides global nav context |
| f02 | All People list | Contact list with 4 rows visible; user about to click Jeanette Argyle |
| f03 | Contact Detail — Create Note tab, data loading | Initial load; phone not yet rendered; Activity/Tasks/Appointments skeletons |
| f04 | Contact Detail — Create Note tab, data settled | Phone "(503) 713-8662 (mobile)" + email appear; timeline loads 57 items; right sidebar data resolved |
| f05 | Contact Detail — **Log Call tab active** | User clicked Log Call; compose area replaced by Log Call panel; outcome buttons visible; click indicator fires |
| f06 | Log Call tab + **Create task modal** open | "Create task" dialog overlaid; Follow Up selected; Matt Ryan assignee |
| f07 | Same as f06, browser "wait" spinner | No state change; transition pause only |
| f08 | Log Call tab; modal dismissed; **"Bad Number" clicked** | Create task modal gone; click indicator on Bad Number button |
| f09 | **Send Email tab active** | Compose area replaced by email composer; To chip pre-filled; signature pre-inserted; Attachments + Templates footer |
| f10 | Send Email tab — **zoomed-out / wider viewport** | Full template quick-pick strip visible (Introduction / Follow Up / Still Buying / Nurture Lead / Custom); full email signature visible |
| f11 | Send Email tab — **Insert HTML modal** | "Insert HTML" dialog overlaid; "Replace current HTML" checkbox; Cancel + Insert HTML buttons |
| f12 | Send Email tab — modal dismissed | Full compose view again; Clicked indicator on signature headshot area |

---

## 1. Global chrome (every Contact Detail frame)

### 1.1 Top navigation bar

```
[hamburger/collapse] [People] [Inbox] [Tasks] [Calendar] [Deals] [Reporting] [Admin]   [Search____]   [email-icon] [chat-bubble-icon] [phone-icon] [bell-icon] [user-avatar]
```

- **People** is the active section (underlined / highlighted).
- Search is a single global search input centered in the bar.
- Right-side icons (top-right cluster, left to right): compose-email icon, chat/message icon, phone icon, notification bell, user avatar (circular, shows logged-in broker photo).
- The bell occasionally shows a numeric badge.

### 1.2 Layout: three-column

```
[LEFT PANEL ~280px] | [CENTER PANE ~flex] | [RIGHT SIDEBAR ~220px]
```

All three are always visible at desktop width. The center pane hosts the compose/action area at top and the activity timeline below. The right sidebar is a persistent widget column.

### 1.3 Person navigator

Top of RIGHT SIDEBAR:
```
                                             Person 1 of 4  [<] [>]
```
- "Person 1 of 4" = current contact position in the active list/filter.
- `[<]` / `[>]` arrows navigate prev/next without leaving the detail page.
- Below the nav bar at the very bottom of the right sidebar a text hint echoes this: "Press → to view next lead or ← to view previous lead" (keyboard shortcut hint).

---

## 2. Left panel — Contact header + fields

### 2.1 Contact avatar + name block

```
[JA]  Jeanette Argyle
      Last Communication 6 days ago
```

- Avatar: large circle (~48px), initials "JA", teal/green background.
- Contact name: large bold text.
- Subtitle: "Last Communication 6 days ago" — a computed relative-time string.

### 2.2 Contact identity fields (below name block)

Order top-to-bottom, with icons:

| Icon | Field | Value in recording | Notes |
|------|-------|--------------------|-------|
| Phone icon | Phone | (503) 713-8662 (mobile) | Clickable; "(mobile)" label in parens |
| Envelope icon | Email | Transactions@bridgetownfiles.com | Clickable link |
| Location/map icon | Address | "Add address" | Placeholder link when empty |

**Empty-state rendering:** When a field has no value, a plain text link like "Add phone", "Add email", "Add address" appears in place of the value. No icon appears until a value exists (or the icon appears greyed). The transition between f03 (no phone) and f04 (phone present) confirms this.

### 2.3 Relationships section

```
Relationships                           [people-icon][+] [^]
  No relationships
```

- Section header with two action buttons: expand-relationships (people/group icon) and add relationship (+).
- Collapse chevron (^/v).
- Empty state text: "No relationships".

### 2.4 Details section

```
Details                                                      [^]
  Stage         Lead
  Assigned to   Matt Ryan   (link/clickable)
  Source        Sphere, 8 months ago
  Price         (blank)
  Timeframe     (blank)
  Tags          [Phone Import ×] [SOI ×] [+]
```

- **Stage** — plain text label ("Lead"). In FUB the stage field is a dropdown; clicking it opens a select.
- **Assigned to** — rendered as a clickable link ("Matt Ryan"). Clicking opens broker assignment.
- **Source** — two-part: source name ("Sphere") + relative age ("8 months ago").
- **Price** — blank; no placeholder text visible.
- **Timeframe** — blank.
- **Tags** — rendered as removable chip tokens with × buttons. "Phone Import" and "SOI" are the current tags. The "+" button adds a tag. Each chip: `[tag label] [×]`. Background: light gray pill; × is small and inline-right.

### 2.5 Financing section

```
Financing                                                    [^]
  Lender        (blank)
```

Collapsible section. Only "Lender" field visible; no value.

### 2.6 Custom Fields section

```
Custom Fields                                                [^]
  Recently Divorced
  Recently Moved
  Enrichment Provider
  Phone Type
  Net Worth Range
  Income Range
  Occupation
  Has Children
  Household Size
  Marital Status
  Gender
  Birthday
  Owner Age Range
```

All 13+ fields are rendered as label-only rows with no values (all blank). The labels are left-aligned, no colons, no value column. Clicking a label presumably activates inline edit. Section is collapsible.

---

## 3. Top center pane — Action tabs

```
[pencil] Create Note  |  [envelope] Send Email  |  [bubble] Text  |  [phone] Log Call
```

Four tabs, always visible. The active tab determines what appears in the compose area below.

- **Create Note** — pencil icon; active by default in f03/f04.
- **Send Email** — envelope icon; active in f09–f12.
- **Text** — speech bubble icon.
- **Log Call** — phone handset icon; active in f05–f08.

Inactive tabs are grey/muted. Active tab: text becomes black/navy, possibly with underline or top border accent.

---

## 4. LOG CALL PANEL — Full specification (f05, f08)

This is the state when "Log Call" tab is active.

### 4.1 Panel layout

```
                                                        [? How it works]

  [Add call notes...                                                    ]
  [                                                                     ]
  [                                                                     ]

  [No Answer]  [Left Voicemail]  [Bad Number]

  [(503) 713-8662 (mobile)  ▾]                           [Log Call]
```

### 4.2 Fields and controls

#### Notes textarea
- Placeholder text: **"Add call notes..."**
- Multi-line, fills most of panel width.
- Background: very light green/mint tint (distinguishes from Create Note area which is cream/white).
- No character limit visible.

#### Outcome selector — button group (NOT a dropdown)
Three pill-shaped toggle buttons, mutually exclusive (radio group behavior):

| Button label | Description |
|---|---|
| **No Answer** | Call placed, no response |
| **Left Voicemail** | Voicemail was left |
| **Bad Number** | Number is wrong/disconnected |

Resting state: light gray background, dark gray text, rounded pill shape.  
Active/selected state: not fully captured (no button appears selected in these frames). Presumably: teal/green background fill or a border highlight.

The three buttons form a horizontal strip below the notes textarea. They are spaced with small gaps between them (not a continuous button bar — each has its own border-radius all around).

**CRITICAL GAP NOTE:** These three are the ONLY outcome options visible in this recording. FUB's full Log Call outcome enum in the API includes additional values (Answered, Left Voicemail, No Answer, Bad Number, Do Not Call, Wrong Number, etc.) but only three are shown in this recording's UI. Build the component with the three confirmed labels above; mark others as TBD pending verification.

#### Duration field
**NOT PRESENT** in the visible panel. No duration field, no timer, no elapsed-time control is shown. Either FUB calculates call duration via phone integration (Twilio/FUB dialer) rather than manual input, or it is hidden in a state not captured.

#### Phone selector
```
(503) 713-8662 (mobile)  ▾
```
- A select/dropdown control, left-aligned below the outcome buttons.
- Shows the contact's phone number + label "(mobile)" in parentheses.
- Chevron ▾ indicates it opens a list of additional phone numbers on the contact (if multiple exist).
- When only one phone is on record, it still renders as a select (not a static label).

#### "How it works" link
- Top-right of the Log Call panel area.
- Small text link with `?` or info icon prefix.
- Opens FUB documentation / an info popover.

#### Log Call button
- **Label:** "Log Call"
- **Style:** teal/green filled rounded-rectangle button.
- **Position:** bottom-right of the panel, aligned with the phone selector row.
- On click: saves the log entry (creates a timeline event) and resets the panel.

### 4.3 Interaction observed (f08)

User clicked **"Bad Number"** outcome button. The "Clicked" badge (recording annotation) appears on the Bad Number button. No visible state change to the button itself is captured (the recording's next state shows the Create task modal instead).

### 4.4 Component tree — Log Call panel

```tsx
<LogCallPanel>
  <PanelHeader>
    <HowItWorksLink />               // "? How it works" — top right
  </PanelHeader>
  <NotesTextarea
    placeholder="Add call notes..."
    rows={3}
    className="bg-mint-50"           // light green/mint tint
  />
  <OutcomeButtonGroup>               // radio group
    <OutcomeButton value="no_answer">No Answer</OutcomeButton>
    <OutcomeButton value="left_voicemail">Left Voicemail</OutcomeButton>
    <OutcomeButton value="bad_number">Bad Number</OutcomeButton>
  </OutcomeButtonGroup>
  <ActionRow>
    <PhoneSelector>                  // <select> or custom dropdown
      <PhoneOption label="(503) 713-8662 (mobile)" value="..." />
      {/* additional phone numbers if present */}
    </PhoneSelector>
    <LogCallButton variant="primary">Log Call</LogCallButton>
  </ActionRow>
</LogCallPanel>
```

**Data emitted on submit:**
```ts
{
  personId: string,
  phoneNumber: string,      // from PhoneSelector
  outcome: "no_answer" | "left_voicemail" | "bad_number",
  note: string,             // from NotesTextarea
  // duration: not captured in UI — possibly computed from system/dialer
}
```

---

## 5. CREATE TASK DIALOG (f06, f07)

This dialog appears overlaid on the contact detail while the Log Call panel is visible in the background. It is triggered from a Tasks-section "+" action or from within the Log Call flow (possibly a post-call task prompt).

### 5.1 Modal anatomy

```
+----------------------------------+
| ≡ Create task               [×]  |
|                                  |
|  [Task Name__________________]  |
|                                  |
|  [Follow Up  ▾] [Matt Ryan  ▾]  |
|                                  |
|  [Date______] [Time_______]     |
|                                  |
|        [Cancel] [Create task]   |
+----------------------------------+
```

### 5.2 Fields

| Field | Control type | Value in recording | Notes |
|-------|-------------|-------------------|-------|
| Task Name | Text input | Empty | Placeholder: "Task Name" |
| Task Type | Dropdown select | "Follow Up" (selected) | See enum below |
| Assignee | Dropdown select | "Matt Ryan" (selected) | Broker name; presumably all brokers available |
| Date | Date input | Empty | Renders a date picker or date text field |
| Time | Time input | Empty | Renders a time picker or time text field |

#### Task Type dropdown enum (confirmed from recording)
- **Follow Up** — selected/default value visible in f06/f07

Additional enum values not visible in this recording (FUB standard): Call, Email, Text, To-Do, Appointment. Mark as TBD for the rebuild spec.

### 5.3 Buttons

| Button | Style | Action |
|--------|-------|--------|
| Cancel | Text/secondary | Dismisses modal without saving |
| Create task | Teal filled pill | Saves task and closes modal |

### 5.4 Modal chrome

- Title bar: task/list icon + "Create task" text + "×" close button (top right).
- Overlay: the background (Log Call panel + timeline) is dimmed but visible.
- Width: approximately 320px centered.

### 5.5 Component tree

```tsx
<Modal>
  <ModalHeader icon={<TaskIcon />} title="Create task" onClose={dismiss} />
  <ModalBody>
    <TextInput name="taskName" placeholder="Task Name" />
    <Row>
      <Select name="taskType" defaultValue="follow_up">
        <Option value="follow_up">Follow Up</Option>
        {/* Call, Email, Text, To-Do, Appointment — TBD */}
      </Select>
      <Select name="assignee" defaultValue="matt_ryan">
        {/* broker list */}
      </Select>
    </Row>
    <Row>
      <DateInput name="date" />
      <TimeInput name="time" />
    </Row>
  </ModalBody>
  <ModalFooter>
    <Button variant="secondary" onClick={dismiss}>Cancel</Button>
    <Button variant="primary" onClick={submit}>Create task</Button>
  </ModalFooter>
</Modal>
```

---

## 6. SEND EMAIL COMPOSE PANEL — Full specification (f09, f10, f11, f12)

### 6.1 Panel layout overview

```
To:    [JA] Jeanette Argyle [×]              CC  BCC
Subject: [_____________________________________________]

[Introduction +] [Follow Up +] [Still Buying +] [Nurture Lead +] [Custom +]

B  I  U  ~~  •—  1—  🔗  🖼  ▶  😊  </>  ⊞  ⋯

[email body / signature area — rich text editor]

📎 Attachments   📄 Templates              [🗑] [Send Email] [⏰]
```

### 6.2 Recipients row

```
To:  [JA] Jeanette Argyle [×]          CC   BCC
```

- "To:" label left-aligned.
- Contact chip: avatar circle ("JA", colored) + name "Jeanette Argyle" + "×" remove button.
- Multiple recipients supported (chip tokens).
- **CC** and **BCC** are text links that expand additional recipient inputs when clicked.

### 6.3 Subject line

```
Subject:  [___________________________________]
```

- Plain text input. Label "Subject:" left-aligned outside the input.
- Empty in recording; no placeholder text visible.

### 6.4 Template quick-pick strip

This strip appears between the Subject line and the rich-text toolbar:

```
[+ Introduction]  [+ Follow Up]  [+ Still Buying]  [+ Nurture Lead]  [+ Custom]
```

Each tab is a pill button with a "+" icon prefix. Clicking one inserts/applies the named template into the editor body. Labels confirmed:

| Position | Label |
|----------|-------|
| 1 | Introduction |
| 2 | Follow Up |
| 3 | Still Buying |
| 4 | Nurture Lead |
| 5 | Custom |

These are user-defined or FUB-default email templates. The "Custom" tab likely opens a template picker or creates a new one. The strip is horizontally scrollable if more templates exist (only 5 visible here, strip clips at right edge).

**These quick-pick tabs are NOT merge fields.** They are full template insertion buttons.

### 6.5 Rich text editor toolbar

From left to right (confirmed icons, f09_q1, f10_q1):

| Position | Icon | Function |
|----------|------|----------|
| 1 | **B** | Bold |
| 2 | **I** | Italic |
| 3 | **U** (underlined) | Underline |
| 4 | S or ~~ | Strikethrough |
| 5 | Bullet list | Unordered list |
| 6 | Numbered list | Ordered list |
| 7 | Chain link | Insert hyperlink |
| 8 | Mountain/landscape | Insert image |
| 9 | Play triangle | Insert video |
| 10 | Smiley face | Insert emoji |
| 11 | `</>` or `{}` | Insert HTML / code |
| 12 | Grid/table | Insert table |
| 13+ | Additional icons | (not fully resolved at this zoom) |

The toolbar is a horizontal strip with small icon buttons, no labels, separated by visual groups (possible thin dividers between formatting group, list group, insert group).

**NOTE on Merge Fields:** A dedicated "merge fields" dropdown button was NOT observed as a separate toolbar icon or named control in these frames. The merge field insertion in FUB email compose may be accessed via:
(a) a toolbar icon that wasn't captured at sufficient resolution, or
(b) the `{` shortcut in the body triggering an inline picker, or
(c) the "Templates" footer button + template editor.
This is an OPEN GAP in this recording — merge field dropdown categories are not visible.

### 6.6 Signature (pre-inserted into body)

The email body loads with the broker's signature pre-populated. From f10_q1:

```
[Matt Ryan headshot photo — left-aligned]

Matt Ryan
Owner & Principal Broker · Ryan Realty LLC
541.703.3095
matt@ryan-realty.com
ryan-realty.com

Building community through authentic relationships and exceptional customer service.

[Ryan Realty logo image]
Read our Google reviews · Oregon Initial Agency Disclosure Pamphlet

Ryan Realty LLC · Oregon Principal Broker #201206613 · Equal Housing Opportunity · Not a solicitation of listings under contract with another broker.
```

- Headshot: ~80×80px or larger, left-float.
- Name: bold, larger text.
- Title/company: one line, lighter text, middle dot separator.
- Contact details: individual lines, plain text.
- Tagline: italic or lighter weight.
- Logo: image block below the text block.
- Legal footer: smaller text, multiple disclaimer items linked with middle dots or on separate lines.
- The signature appears to be auto-injected when the Send Email tab activates.

### 6.7 Footer action row

```
📎 Attachments    📄 Templates              [🗑] [Send Email] [⏰]
```

| Control | Icon | Action |
|---------|------|--------|
| Attachments | Paperclip | Opens file picker to attach files |
| Templates | Document/page | Opens template browser panel |
| Delete (trash) | 🗑 | Discards the draft |
| Send Email | Teal button | Sends the email immediately |
| Schedule (clock) | ⏰ | Opens send-time scheduling picker |

The "Send Email" button is the primary CTA — teal/green filled rounded-rectangle. The schedule clock icon is directly adjacent to the right of Send Email, suggesting it is a sub-control of that action (schedule vs. send now).

---

## 7. INSERT HTML MODAL (f11)

Accessed via the `</>` or table icon in the rich text toolbar (user clicked something in the toolbar that opened this).

### 7.1 Modal anatomy

```
+---------------------------------------+
| 📄 Insert HTML                   [×]  |
|                                       |
|  Add your HTML code below:           |
|  +-----------------------------------+|
|  |                                   ||
|  |   [text cursor visible]           ||
|  |                                   ||
|  |                                   ||
|  +-----------------------------------+|
|                                       |
|  ☐ Replace current HTML             |
|                                       |
|          [Cancel]  [Insert HTML]      |
+---------------------------------------+
```

### 7.2 Fields and controls

| Control | Type | Default | Notes |
|---------|------|---------|-------|
| HTML textarea | Multi-line text input | Empty | Accepts raw HTML; text cursor visible; no placeholder text observed |
| "Replace current HTML" | Checkbox | **Unchecked** | If checked, replaces entire email body HTML; if unchecked, inserts at cursor position |
| Cancel | Text/secondary button | — | Dismisses without insert |
| Insert HTML | Teal filled button | — | Injects HTML into editor |

### 7.3 Modal chrome

- Title: document icon + "Insert HTML" + "×" close button.
- The modal title instruction line: "Add your HTML code below:" — plain text label between title bar and textarea.
- Modal width: ~420px.
- Background overlay dims the email compose panel.

### 7.4 Component tree

```tsx
<Modal>
  <ModalHeader icon={<DocumentIcon />} title="Insert HTML" onClose={dismiss} />
  <ModalBody>
    <BodyLabel>Add your HTML code below:</BodyLabel>
    <Textarea
      name="htmlCode"
      rows={6}
      // no placeholder observed
    />
    <CheckboxRow>
      <Checkbox name="replaceCurrent" defaultChecked={false} />
      <label>Replace current HTML</label>
    </CheckboxRow>
  </ModalBody>
  <ModalFooter>
    <Button variant="secondary" onClick={dismiss}>Cancel</Button>
    <Button variant="primary" onClick={insertHtml}>Insert HTML</Button>
  </ModalFooter>
</Modal>
```

---

## 8. ACTIVITY TIMELINE (all frames)

### 8.1 Filter strip (above timeline)

```
[All]  [📧 57]  [💬 0]  [📞 0]  [⇄ 0]  [💌 0]  [⭐ 0]  [📌 3]    [Filters ▾]
```

Confirmed icons and counts from f04/f05 (the highest-data frames):

| Tab | Icon | Count | Likely type |
|-----|------|-------|-------------|
| All | (none) | (total) | All timeline events |
| Emails | Envelope | 57 | Inbound/outbound emails |
| Notes | Comment bubble | 0 | Manual notes |
| Calls | Phone handset | 0 | Logged calls |
| Unknown | Arrow/share | 0 | Possibly texts or automations |
| Unknown | Bubble/message | 0 | Possibly texts |
| Stars | Star | 0 | Starred/important |
| Unknown | Pinned/notes | 3 | Pinned items or tasks |

**CRITICAL GAP:** The phone-call tab shows 0, confirming **no logged calls exist in this contact's timeline**. Therefore a logged-call timeline card anatomy is **NOT directly observable** in this recording. See Section 9 for the inferred spec.

**Filters button:** right-aligned, chevron ▾, opens a filter panel to narrow by date range or event type.

### 8.2 Email timeline card — full anatomy (WTE Distribution email)

This is the primary example of a timeline card structure:

```
[WD]  WTE Distribution  > Jeane..., Clark..., Edgerl..., Matt R..., Ward,..., Zoo    Jun 24
      Order #WT0286975 - 20702 Beaumont Drive, Bend OR 97701

      [Western Title & Escrow logo]

      Your Title Documents are attached.

      Please note this email address is not monitored.

      For any Title related questions please contact Title Officer Support at titleofficersupport@westerntitle.com.
      For any Escrow related questions please contact your Escrow Officer by locating their contact information
      on your attached Report.

      Western Title & Escrow Company greatly appreciates your business.

      Thank you,
      The Distribution Team
      www.westerntitle.com

[📎 reply]  [↩]  [···]
```

Card elements:

| Element | Detail |
|---------|--------|
| Sender avatar | "WD" initials circle, teal background |
| Sender name | "WTE Distribution" — bold |
| Recipient list | Truncated with "..." e.g. "Jeane..., Clark..., Edgerl..., Matt R..., Ward..., Zoo" |
| Date | "Jun 24" — right-aligned |
| Subject | "Order #WT0286975 - 20702 Beaumont Drive, Bend OR 97701" — below sender row |
| Body | Full email body rendered inline (collapsed/expanded toggle not directly observed) |
| Inline images | Western Title & Escrow logo renders inline |
| Action buttons (bottom of card) | Reply icon | Forward icon | "···" more options |

**Reply row** (from f04_q2): Reply icon | forward/share icon | "···" (three-dot overflow menu).

---

## 9. LOGGED-CALL TIMELINE CARD — Inferred specification

**No logged-call card is present** in this contact's timeline (phone tab count = 0). Based on the Log Call panel fields (Section 4), the expected card structure when a call IS logged:

```
[MR]  Matt Ryan logged a call           [timestamp]
      Outcome: Bad Number
      Note: [whatever was typed in notes field]
      Phone: (503) 713-8662 (mobile)

[···]
```

Expected anatomy (inferred from FUB patterns + Log Call fields):

| Element | Value source |
|---------|-------------|
| Actor avatar | Logged-in broker initials circle |
| Actor + action | "[Broker Name] logged a call" |
| Timestamp | Right-aligned; relative ("6 days ago") or absolute date |
| Outcome pill | One of: No Answer / Left Voicemail / Bad Number (colored pill) |
| Note text | Content from "Add call notes..." textarea |
| Phone label | The selected phone number + label |
| Action row | "···" overflow menu (possibly edit/delete) |

**This spec is INFERRED, not directly observed. Must be verified against a contact that has logged calls.**

---

## 10. INLINE EDIT ACTIVE STATES (✓/✗)

**Not directly captured** in this 12-frame recording. The recording does not show a user clicking on any contact field to trigger the inline edit mode.

### What can be inferred from the UI structure

Fields that support inline edit (observable as clickable in the Details section):
- Stage (dropdown)
- Assigned to (broker picker)
- Price (free text or currency input)
- Timeframe (free text or date picker)
- Tags (chip adder)
- All Custom Fields (mixed types by field definition)

The standard FUB inline edit pattern (from documentation + general FUB knowledge):
1. User clicks on a field label or its current value.
2. Field transitions to an editable input (text input, select, date picker).
3. Two control buttons appear inline: **✓ (confirm/save)** and **✗ (cancel/discard)**.
4. ✓ saves and collapses back to read mode; ✗ discards and collapses.

**These active states are NOT directly observed in this recording.** Must capture a separate recording where a user clicks into a Details field.

---

## 11. RIGHT SIDEBAR — All sections

From f04/f05/f08 (fully resolved states):

```
Person 1 of 4                                        [<] [>]
─────────────────────────────────────────────────────────────
▶ Action Plans                                           [˅]
─────────────────────────────────────────────────────────────
▼ Activity                                               [˄]
  No website activity yet
─────────────────────────────────────────────────────────────
▼ Tasks                              [⚡ lightning] [+] [˄]
  No upcoming tasks
─────────────────────────────────────────────────────────────
▼ Appointments                                      [+] [˄]
  No upcoming appointments
─────────────────────────────────────────────────────────────
▶ AgentFire FUB Widget                                   [˅]
─────────────────────────────────────────────────────────────
▼ Deals                                             [+] [˄]
  No deals yet
─────────────────────────────────────────────────────────────
▼ Automations                                       [+] [˄]
  No automations running
─────────────────────────────────────────────────────────────
▼ Files                                             [+] [˄]
  No files yet, drag some here
─────────────────────────────────────────────────────────────
▼ Collaborators                                     [+] [˄]
─────────────────────────────────────────────────────────────
  Press → to view next lead or ← to view previous lead
```

### Section-by-section

| Section | Default state | Header icons | Empty state text |
|---------|--------------|--------------|-----------------|
| Action Plans | Collapsed (▶) | — | — |
| Activity | Expanded (▼) | — | "No website activity yet" |
| Tasks | Expanded (▼) | ⚡ (AI/auto task) + (+) + collapse | "No upcoming tasks" |
| Appointments | Expanded (▼) | (+) + collapse | "No upcoming appointments" |
| AgentFire FUB Widget | Collapsed (▶) | — | — |
| Deals | Expanded (▼) | (+) + collapse | "No deals yet" |
| Automations | Expanded (▼) | (+) + collapse | "No automations running" |
| Files | Expanded (▼) | (+) + collapse | "No files yet, drag some here" |
| Collaborators | Expanded (▼) | (+) + collapse | (empty, no text) |

**Tasks section special icon:** The Tasks header has a **lightning bolt icon** (⚡) in addition to the (+) add button. This is likely "Auto Task" or "Quick Task" (creates a task from an AI suggestion or preset). It is teal/green, circle badge style.

---

## 12. ALL PEOPLE LIST (f02) — Supporting context

The list view before navigating to the contact:

### List columns
- Name (with avatar + source tag below)
- Lead Score (numeric)
- Agent (broker name)
- Last Visit (date)
- Phone (with call icon + message icon inline)
- Email (with email address)
- Add a filter (column)

### Contacts visible
| Name | Source tag | Agent | Phone | Email |
|------|-----------|-------|-------|-------|
| Jeanette Argyle | Sphere | Matt Ryan | (503) 713-8662 | Transactions@bridgetownfiles.com |
| Ginny Scheider | Sphere | Matt Ryan | (503) 319-3646 | gschleider@guidedmortgage.net |
| Jarred Scotton | Import | Matt Ryan | (541) 240-5838 | jerred@scatteronsrealty.com |
| Amy Mora | Import | Matt Ryan | (541) 390-4422 | amy.mora@theaspincyre.com |

### Left sidebar (Smart Lists / Collections)

**Pipeline** section:
- Active & Pending Clients
- Hot/Weekly: 2
- Warm/Bi-Weekly
- Past Clients/Sphere: Quarterly: 10
- New Leads: No Call Attempt
- Cold/Bi-Monthly: 44
- Old Leads: No Call Attempt: 2k

**Neighborhoods** section:
- Tetherow: 896
- Sunriver: 436
- Pronghorn: 13
- Black Butte Ranch: 6
- Northwest Crossing: 38
- Vandevert: 16
- Crosswater: 54
- Caldera Springs: 209
- Sunstone Loop — Showing Brokers
- Bend - River West: 2k
- Bend - Awbrey Butte: 16
- Bend - Summit West: 16
- Bend - Century West: 110
- Manage

---

## 13. NOTIFICATION SETTINGS PAGE (f01) — Supporting context

Not part of the Contact Detail spec but provides global context.

Event notification types (partial list from f01):
- You receive a new lead
- You are assigned an existing lead
- An inquiry is received from an existing lead
- You receive a new text message, voicemail, or missed call
- You receive a new message from an Inbox App
- You are assigned an inbox conversation
- You are @mentioned in a note or a reply
- One of your teams is @mentioned in a note
- One of your ponds is @mentioned in a note
- You are added as a collaborator
- You are assigned a task, or you have an upcoming task due
- An email sent to a lead was opened or a link was clicked
- A team member reacts with an emoji
- A team member replies to your note or reply
- Your lead gets pre-approved by Zillow Home Loans
- You / An Agent relationship is submitted...

Channel columns (checkboxes): push notification | email | (2 others — possibly in-app bell and mobile push)

---

## 14. COMPONENT TREE — Contact Detail page (responsive web rebuild)

```tsx
<ContactDetailPage>

  {/* Top navigation */}
  <GlobalNav>
    <CollapseButton />
    <NavLinks>People | Inbox | Tasks | Calendar | Deals | Reporting | Admin</NavLinks>
    <GlobalSearch />
    <NavIconCluster>
      <ComposeEmailIcon />
      <ChatIcon />
      <PhoneIcon />
      <NotificationBell badge={number} />
      <UserAvatar />
    </NavIconCluster>
  </GlobalNav>

  <ThreeColumnLayout>

    {/* LEFT PANEL */}
    <LeftPanel width={280}>
      <ContactAvatar initials="JA" color="teal" size={48} />
      <ContactName>Jeanette Argyle</ContactName>
      <LastContactedLabel>Last Communication 6 days ago</LastContactedLabel>

      <ContactIdentityFields>
        <PhoneField
          value="(503) 713-8662"
          label="mobile"
          emptyState={<AddLink>Add phone</AddLink>}
        />
        <EmailField
          value="Transactions@bridgetownfiles.com"
          emptyState={<AddLink>Add email</AddLink>}
        />
        <AddressField
          emptyState={<AddLink>Add address</AddLink>}
        />
      </ContactIdentityFields>

      <CollapsibleSection title="Relationships" headerAction={[<PeopleIcon />, <PlusIcon />]}>
        <EmptyState>No relationships</EmptyState>
      </CollapsibleSection>

      <CollapsibleSection title="Details">
        <FieldRow label="Stage"><StageDropdown value="Lead" /></FieldRow>
        <FieldRow label="Assigned to"><BrokerLink>Matt Ryan</BrokerLink></FieldRow>
        <FieldRow label="Source"><span>Sphere, 8 months ago</span></FieldRow>
        <FieldRow label="Price"><InlineEditField /></FieldRow>
        <FieldRow label="Timeframe"><InlineEditField /></FieldRow>
        <FieldRow label="Tags">
          <TagChipList>
            <TagChip label="Phone Import" onRemove={...} />
            <TagChip label="SOI" onRemove={...} />
            <AddTagButton />
          </TagChipList>
        </FieldRow>
      </CollapsibleSection>

      <CollapsibleSection title="Financing">
        <FieldRow label="Lender"><InlineEditField /></FieldRow>
      </CollapsibleSection>

      <CollapsibleSection title="Custom Fields">
        {customFields.map(f => (
          <FieldRow key={f.id} label={f.label}><InlineEditField type={f.type} /></FieldRow>
        ))}
        {/* Fields: Recently Divorced, Recently Moved, Enrichment Provider,
            Phone Type, Net Worth Range, Income Range, Occupation,
            Has Children, Household Size, Marital Status, Gender,
            Birthday, Owner Age Range */}
      </CollapsibleSection>
    </LeftPanel>

    {/* CENTER PANE */}
    <CenterPane>

      {/* Action tabs */}
      <ActionTabBar>
        <Tab icon={<PencilIcon />} label="Create Note" />
        <Tab icon={<EnvelopeIcon />} label="Send Email" />
        <Tab icon={<BubbleIcon />} label="Text" />
        <Tab icon={<PhoneIcon />} label="Log Call" />
      </ActionTabBar>

      {/* Compose area — conditional on active tab */}
      {activeTab === 'create_note' && (
        <CreateNotePanel>
          <Textarea placeholder="Add notes or type @name to notify" />
          <TeamMentionsHint />
          <SubmitButton>Create Note</SubmitButton>
        </CreateNotePanel>
      )}

      {activeTab === 'log_call' && (
        <LogCallPanel>
          <HowItWorksLink />
          <NotesTextarea placeholder="Add call notes..." className="bg-mint" />
          <OutcomeButtonGroup>
            <OutcomeButton value="no_answer">No Answer</OutcomeButton>
            <OutcomeButton value="left_voicemail">Left Voicemail</OutcomeButton>
            <OutcomeButton value="bad_number">Bad Number</OutcomeButton>
          </OutcomeButtonGroup>
          <ActionRow>
            <PhoneSelect options={contact.phones} />
            <PrimaryButton onClick={logCall}>Log Call</PrimaryButton>
          </ActionRow>
        </LogCallPanel>
      )}

      {activeTab === 'send_email' && (
        <EmailComposePanel>
          <RecipientRow>
            <Label>To:</Label>
            <RecipientChipInput defaultChips={[contact]} />
            <CCLink /> <BCCLink />
          </RecipientRow>
          <SubjectRow>
            <Label>Subject:</Label>
            <TextInput name="subject" />
          </SubjectRow>
          <TemplateQuickPick>
            {/* Rendered as pill buttons with + prefix */}
            <TemplatePill>Introduction</TemplatePill>
            <TemplatePill>Follow Up</TemplatePill>
            <TemplatePill>Still Buying</TemplatePill>
            <TemplatePill>Nurture Lead</TemplatePill>
            <TemplatePill>Custom</TemplatePill>
          </TemplateQuickPick>
          <RichTextToolbar>
            {/* Bold, Italic, Underline, Strikethrough */}
            {/* Bullet list, Numbered list */}
            {/* Link, Image, Video, Emoji, Insert HTML, Table */}
          </RichTextToolbar>
          <RichTextEditor defaultContent={<BrokerSignature broker={assignedBroker} />} />
          <ComposeFooter>
            <AttachmentsButton />
            <TemplatesButton />
            <Spacer />
            <DeleteDraftButton />
            <SendButton>Send Email</SendButton>
            <ScheduleButton />
          </ComposeFooter>
        </EmailComposePanel>
      )}

      {/* Activity timeline */}
      <ActivityTimeline>
        <TimelineFilterBar>
          <FilterTab label="All" count={total} active />
          <FilterTab icon={<EmailIcon />} count={57} />
          <FilterTab icon={<NoteIcon />} count={0} />
          <FilterTab icon={<CallIcon />} count={0} />
          <FilterTab icon={<TextIcon />} count={0} />
          <FilterTab icon={<AutomationIcon />} count={0} />
          <FilterTab icon={<StarIcon />} count={0} />
          <FilterTab icon={<PinnedIcon />} count={3} />
          <FiltersButton />
        </TimelineFilterBar>

        <TimelineItems>
          {items.map(item => (
            <TimelineCard key={item.id} type={item.type}>
              {item.type === 'email' && (
                <EmailTimelineCard>
                  <SenderAvatar initials={item.senderInitials} />
                  <SenderName>{item.senderName}</SenderName>
                  <RecipientList truncated>{item.recipients}</RecipientList>
                  <Timestamp>{item.date}</Timestamp>
                  <Subject>{item.subject}</Subject>
                  <EmailBodyPreview html={item.bodyHtml} />
                  <CardActions>
                    <ReplyButton />
                    <ForwardButton />
                    <MoreOptionsButton />
                  </CardActions>
                </EmailTimelineCard>
              )}
              {item.type === 'call' && (
                <CallTimelineCard>
                  {/* See Section 9 for inferred spec */}
                  <ActorAvatar />
                  <ActorAction>{item.brokerName} logged a call</ActorAction>
                  <Timestamp />
                  <OutcomePill>{item.outcome}</OutcomePill>
                  <NoteText>{item.note}</NoteText>
                  <PhoneLabel>{item.phone}</PhoneLabel>
                  <MoreOptionsButton />
                </CallTimelineCard>
              )}
            </TimelineCard>
          ))}
        </TimelineItems>
      </ActivityTimeline>
    </CenterPane>

    {/* RIGHT SIDEBAR */}
    <RightSidebar width={220}>
      <PersonNavigator current={1} total={4} />

      <SidebarSection title="Action Plans" collapsible defaultCollapsed />

      <SidebarSection title="Activity" collapsible defaultOpen>
        <WebsiteActivity />  {/* "No website activity yet" */}
      </SidebarSection>

      <SidebarSection title="Tasks" collapsible defaultOpen
        headerActions={[<AutoTaskButton />, <AddButton />]}>
        <TaskList />  {/* "No upcoming tasks" */}
      </SidebarSection>

      <SidebarSection title="Appointments" collapsible defaultOpen
        headerActions={[<AddButton />]}>
        <AppointmentList />
      </SidebarSection>

      <SidebarSection title="AgentFire FUB Widget" collapsible defaultCollapsed />

      <SidebarSection title="Deals" collapsible defaultOpen
        headerActions={[<AddButton />]}>
        <DealList />
      </SidebarSection>

      <SidebarSection title="Automations" collapsible defaultOpen
        headerActions={[<AddButton />]}>
        <AutomationList />
      </SidebarSection>

      <SidebarSection title="Files" collapsible defaultOpen
        headerActions={[<AddButton />]}>
        <FileDropZone />  {/* "No files yet, drag some here" */}
      </SidebarSection>

      <SidebarSection title="Collaborators" collapsible defaultOpen
        headerActions={[<AddButton />]} />

      <KeyboardHint>
        Press → to view next lead or ← to view previous lead
      </KeyboardHint>
    </RightSidebar>

  </ThreeColumnLayout>

  {/* Modals (conditionally rendered) */}
  {showCreateTask && <CreateTaskModal onClose={...} onSubmit={...} />}
  {showInsertHtml && <InsertHtmlModal onClose={...} onInsert={...} />}

  {/* Trial upgrade banner (bottom of screen) */}
  <TrialBanner>
    You have 14 days left on your trial.
    <UpgradeButton>Upgrade Now</UpgradeButton>
  </TrialBanner>
</ContactDetailPage>
```

---

## 15. Exact text transcriptions

### Contact header
- "Jeanette Argyle"
- "Last Communication 6 days ago"

### Phone
- "(503) 713-8662 (mobile)"

### Email
- "Transactions@bridgetownfiles.com"

### Tags
- "Phone Import" (removable chip)
- "SOI" (removable chip)

### Details fields (labels only, blank values)
- Stage: Lead
- Assigned to: Matt Ryan
- Source: Sphere, 8 months ago
- Price
- Timeframe

### Log Call panel
- Placeholder: "Add call notes..."
- Buttons: "No Answer" | "Left Voicemail" | "Bad Number"
- Phone dropdown: "(503) 713-8662 (mobile)"
- Action: "Log Call"
- Help link: "How it works"

### Create task modal
- Title: "Create task"
- Field placeholder: "Task Name"
- Dropdown default: "Follow Up"
- Assignee default: "Matt Ryan"
- Field labels: "Date" | "Time"
- Buttons: "Cancel" | "Create task"

### Email compose
- Recipient label: "To:"
- Template tabs: "Introduction" | "Follow Up" | "Still Buying" | "Nurture Lead" | "Custom"
- Footer: "Attachments" | "Templates" | "Send Email"
- CC/BCC links: "CC" | "BCC"
- "Subject:" label

### Broker signature (Matt Ryan)
- "Matt Ryan"
- "Owner & Principal Broker · Ryan Realty LLC"
- "541.703.3095"
- "matt@ryan-realty.com"
- "ryan-realty.com"
- "Building community through authentic relationships and exceptional customer service."
- "Read our Google reviews · Oregon Initial Agency Disclosure Pamphlet"
- "Ryan Realty LLC · Oregon Principal Broker #201206613 · Equal Housing Opportunity · Not a solicitation of listings under contract with another broker."

### Insert HTML modal
- Title: "Insert HTML"
- Instruction: "Add your HTML code below:"
- Checkbox label: "Replace current HTML"
- Buttons: "Cancel" | "Insert HTML"

### Timeline email card
- Sender: "WTE Distribution"
- Subject: "Order #WT0286975 - 20702 Beaumont Drive, Bend OR 97701"
- Date: "Jun 24"
- Recipients (truncated): "Jeane..., Clark..., Edgerl..., Matt R..., Ward,..., Zoo"
- Email body (full text in Section 8.2)

### Trial banner
- "You have 14 days left on your trial."
- "Upgrade Now"

### Person navigator
- "Person 1 of 4"
- Keyboard hint: "Press → to view next lead or ← to view previous lead"

---

## 16. Open gaps / must-capture in follow-up recording

| Gap | Why not covered | What to record |
|-----|----------------|----------------|
| Logged-call timeline card anatomy | Contact has 0 logged calls in this session | Open a contact with prior calls; observe timeline card structure |
| Inline edit active states (✓/✗) | No field edits performed in recording | Click Stage, Price, or any Custom Field; observe save/cancel controls |
| Merge Fields dropdown categories | Not opened in recording; toolbar access not fully resolved | In Send Email compose, locate merge field button and open dropdown; capture all category headers + field names |
| Log Call outcome selected state | No outcome button was selected to final state | Click one outcome button and observe selected/active styling |
| Log Call duration field | Not present in visible panel | Verify whether FUB shows elapsed time or duration input anywhere in Log Call |
| Task type dropdown full enum | Only "Follow Up" visible | Open the task type dropdown in Create task modal; capture full list |
| Inline-added phone (f03→f04 transition) | Possibly an inline add-phone flow | Record clicking "Add phone" and completing the add-phone form |
| CC/BCC expanded state in email compose | CC/BCC links visible but not clicked | Click CC or BCC; capture additional To-style inputs expanding |
| Templates panel (full list) | "Templates" footer button not clicked | Click Templates button; capture template picker UI |
| Text tab compose panel | Text tab not activated | Click Text tab; capture SMS compose UI |

---

*Analysis compiled from 12 frames + 40 quadrant tiles. Frame-accurate. All text transcriptions verified against quadrant tiles at 2× zoom. Generated 2026-06-30.*
