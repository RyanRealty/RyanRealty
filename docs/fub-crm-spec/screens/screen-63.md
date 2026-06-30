<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.34.28 AM.png | Sequential id: shot-63 | Tiles: fub-tiles/shot-63_{full,q1,q2,q3,q4}.png -->

# shot-63 — Save New Smart List Modal

## Identity

- **Visible URL:** `ryan-realty.followupboss.com/2/people/manage-lists`
- **Page title (background):** "Manage Lists & Collections" (visible behind the modal overlay)
- **Top-nav active item:** People (inferred from the `/people/` URL path; top nav is darkened/blurred behind modal)
- **Sub-nav / tab active:** None visible — modal is in foreground
- **Breadcrumbs:** Not visible (obscured by modal overlay)
- **Logged-in user:** Matt Ryan (Ryan Realty account; inferred from the presence of "Matt Ryan" as the first agent in the sharing list and from prior session context)
- **Account / brokerage name:** Ryan Realty (visible in the Chrome browser bookmarks bar as "Ryan Realty")
- **Modal title:** "Save New Smart List"

---

## Layout

The screen is a **modal dialog** centered over the blurred/dimmed "Manage Lists & Collections" background page.

### Background layer (dimmed, not interactive)
- **Full-width dark top nav bar** (~48 px tall): Follow Up Boss global navigation, fully blurred/darkened
- **Left rail** (~200 px wide): Smart list sidebar, blurred and unreadable
- **Main content area**: Shows the Manage Lists & Collections page body — lists of contacts with avatars visible but text is fully blurred/redacted (privacy overlay applied by screenshot tool)
- **Dim overlay**: Semi-transparent dark scrim (~50–60% opacity gray) covers the entire background page

### Modal (foreground)
- **Position:** Centered horizontally, roughly centered-to-upper-center vertically
- **Width:** ~480 px
- **Background:** White (`#FFFFFF`)
- **Border radius:** ~8–10 px (rounded corners)
- **Drop shadow:** Subtle box shadow
- **Sections top-to-bottom:**
  1. Modal header row ("Save New Smart List" title + X close button)
  2. Name field (label + emoji picker + text input)
  3. Description field (label + rich-text toolbar + textarea + char counter)
  4. Share smart list with (label + search input + "Share with everyone" checkbox + AGENTS section with three agent checkboxes + privacy notice)
  5. Footer row (info link + Cancel button + Save List button)

---

## Every UI Element (Exhaustive)

### Modal Header
- **Title text:** `Save New Smart List` — medium-weight (~600), dark gray/near-black (~`#1a1a1a`), font size ~18–20 px, left-aligned
- **Close button (X):** Top-right corner of the modal; `×` glyph; appears as a small gray icon (~16×16 px); clicking it dismisses the modal without saving

---

### Name Field

- **Label:** `Name` — gray text, medium weight, left-aligned; immediately followed inline by:
- **Required indicator:** `Required` — lighter gray text, same line as the label (not a red asterisk — written out as the word "Required")
- **Emoji picker button:** Small button on the left side of the input row showing a 🤩 (star-eyes) emoji icon — clicking opens an emoji picker to prepend an emoji to the list name
- **Delete/clear icon:** Trash can icon (🗑) immediately to the right of the emoji button — clicking clears the selected emoji
- **Text input:**
  - Type: `text`
  - Current value: `Copy Of Active & Pending Clients`
  - Placeholder: (not visible — field is populated)
  - Width: fills the modal minus the emoji/trash buttons on the left
  - Border: 1 px light gray, slight border-radius
  - The cursor is positioned at the end of the text (text field is active/focused)
  - The value "Copy Of Active & Pending Clients" suggests this modal was opened from an existing smart list named "Active & Pending Clients" using a "Copy" action, which pre-populates the name with "Copy Of " prefix

---

### Description Field

- **Label:** `Description` — gray text, medium weight, left-aligned; no required indicator
- **Rich-text toolbar** (horizontal row of icon buttons, left to right):
  1. **B** — Bold toggle
  2. **I** — Italic toggle (slightly slanted)
  3. **U** — Underline toggle
  4. **Numbered list icon** — ordered list toggle (lines with numbers)
  5. **Bulleted list icon** — unordered list toggle (lines with dots)
  6. **Link icon** — insert hyperlink (chain-link glyph)
  7. **Emoji icon** — insert emoji (smiley face glyph)
  8. **Tx icon** — Clear formatting (T with subscript x, removes inline styles)
  - Toolbar background: white; icons are gray; active states would presumably highlight in blue [INFERRED]
- **Description textarea:**
  - Type: `textarea` (rich-text/contenteditable)
  - Current value (verbatim):
    `A static list of the clients you are currently working with. This smart list displays everyone in current (active/signed) and pending (under contract) stages.`
  - The textarea is a multi-line text area with a visible resize handle in the bottom-right corner (two diagonal lines)
  - Border: 1 px light gray, rounded corners
  - Height: approximately 80–100 px visible
- **Character counter:** `173/1000` — displayed bottom-right below the textarea, in small gray text; format is `{used}/{max}`; max is 1000 characters

---

### Share Smart List With Section

- **Section label:** `Share smart list with` — gray text, medium weight, left-aligned

- **Search input:**
  - Placeholder text: `Search for agents or teams...`
  - Left icon: magnifying glass (🔍) in light gray
  - Type: text search
  - Width: full width of modal
  - Border: 1 px light gray, rounded (pill-like or moderate radius)
  - Empty / no selection made yet

- **"Share with everyone" row:**
  - **Checkbox:** Unchecked (empty square checkbox, not checked) — left-aligned
  - **Label:** `Share with everyone` — gray/dark text next to the checkbox
  - Clicking this would share the list with all agents in the account [INFERRED]

- **AGENTS section header:**
  - Text: `AGENTS` — all-caps, small font (~11–12 px), medium weight, muted gray text
  - Background: Light gray row/banner behind the text (~`#f5f5f5` or `#eeeeee`)
  - Full width separator dividing the "Share with everyone" option from the individual agent list

- **Agent rows** (three rows, each with the same structure):
  - Each row: unchecked checkbox (left) + agent name (right)
  - Row 1: ☐ `Matt Ryan`
  - Row 2: ☐ `Paul Stevenson`
  - Row 3: ☐ `Rebecca Peterson`
  - Checkboxes are all unchecked — list is currently private (not shared with anyone)
  - Rows are separated by thin horizontal lines / consistent row height (~36–40 px)
  - Agent names are in normal weight dark gray text

- **Privacy notice text:** `This smart list is private`
  - Displayed below the agent list, left-aligned, in small muted gray text (~12 px)
  - No checkbox agents are checked → system automatically shows this notice
  - [INFERRED] This text would disappear or change if any agent checkbox were checked

---

### Modal Footer

- **Info link:** `Learn more about filters and smart lists.`
  - Color: blue (standard hyperlink blue, ~`#1a73e8` or FUB blue ~`#3b82f6`)
  - Underlined on hover [INFERRED]
  - Left-aligned in the footer row
  - Opens FUB help documentation about smart lists and filters [INFERRED]

- **Cancel button:**
  - Label: `Cancel`
  - Style: **outlined / ghost** — white background, rounded border (pill-shaped, high border-radius ~20 px), border color matches the button label color (light gray or blue outline)
  - Text color: dark gray or blue
  - Position: right side of footer, left of Save List button
  - Action: closes the modal without saving

- **Save List button:**
  - Label: `Save List`
  - Style: **filled / primary** — solid blue background (~`#3b82f6` or FUB brand blue), white text, pill-shaped (high border-radius ~20 px matching Cancel)
  - Position: rightmost in the footer row
  - Action: validates the form (Name is required), creates the new smart list with the provided name, description, and sharing settings, then closes the modal and navigates to or highlights the new list

---

## Colors, Typography & Style

### Colors
- **Modal background:** `#FFFFFF` (pure white)
- **Page scrim/overlay:** Semi-transparent dark gray, approximately `rgba(0,0,0,0.5)`
- **Top navigation bar (background page):** Dark navy/charcoal (FUB brand dark — approximately `#1a2332` or `#0f172a`)
- **Primary button (Save List):** Solid blue — approximately `#3b82f6` or `#4a9eff` (FUB brand blue)
- **Primary button text:** `#FFFFFF`
- **Cancel button:** White background, gray or blue border
- **Section header (AGENTS):** Light gray background `#f3f4f6` or `#eeeeee`
- **Label text:** Medium gray `#6b7280` or `#9ca3af`
- **Body text / input values:** Dark near-black `#111827` or `#1a1a1a`
- **Info link:** Blue `#3b82f6` or similar
- **Privacy notice text:** Light gray `#9ca3af`
- **Character counter:** Light gray `#9ca3af`
- **Input borders:** Light gray `#d1d5db` or `#e5e7eb`
- **Toolbar icons:** Gray `#6b7280`

### Typography
- **Modal title:** ~18–20 px, font-weight 600 (semibold)
- **Field labels:** ~13–14 px, font-weight 500 (medium), muted gray
- **Input values / textarea body text:** ~14 px, font-weight 400 (regular), dark
- **AGENTS section header:** ~11–12 px, font-weight 600, all-caps, muted gray
- **Agent names:** ~14 px, font-weight 400 (regular)
- **Privacy notice / character counter:** ~12 px, font-weight 400, light gray
- **Button labels:** ~14 px, font-weight 500–600
- **Info link:** ~13 px, blue, font-weight 400

### Style
- **Border radius:** Inputs ~6 px; Buttons ~20 px (pill); Modal ~8–10 px; Agent rows no rounding
- **Density:** Comfortable — fields have ~12–16 px vertical padding each; sections spaced ~16–24 px apart
- **Iconography:** Simple line icons, monochrome gray; emoji picker uses actual emoji glyph; trash icon is simple outline
- **Checkbox style:** Standard square checkboxes, light gray border when unchecked
- **Getting Started progress bar:** Not visible (modal is obstructing the bottom of the page)

---

## State & Data Shown

### Current Modal State
- **Mode:** Creating a new Smart List by copying an existing one ("Copy Of Active & Pending Clients")
- **Name field:** Pre-populated with `Copy Of Active & Pending Clients` (the "Copy Of " prefix is automatically prepended from the original list name "Active & Pending Clients")
- **Description:** Pre-populated with the description copied from the source list: `A static list of the clients you are currently working with. This smart list displays everyone in current (active/signed) and pending (under contract) stages.`
- **Character count:** 173 characters used of 1000 maximum
- **Sharing:** All agent checkboxes unchecked → "This smart list is private" (private to the creating user only)
- **Emoji on name:** 🤩 (star-eyes emoji) is selected/shown in the emoji picker slot next to the name input

### Background Page State (partially visible, blurred)
- **Page:** Manage Lists & Collections (`/people/manage-lists`)
- **Left rail:** Shows existing smart list categories (blurred — cannot read text)
- **Main content:** Shows a list of contacts with avatar circles (blurred — names redacted)

### Data Model Values Revealed
- **Agent roster in this FUB account:**
  - Matt Ryan
  - Paul Stevenson
  - Rebecca Peterson
- **Smart list description mentions stage values:** "current (active/signed)" and "pending (under contract)" — these are stage enum values in the FUB data model
- **Smart list types mentioned:** "static list" (as opposed to dynamic/filter-based)

---

## Interactions & Behaviors

### Opening this modal
- [INFERRED] The user clicked a "Copy" or "Duplicate" action on an existing smart list named "Active & Pending Clients" from the Manage Lists & Collections page. This opens the "Save New Smart List" modal pre-populated with "Copy Of " prepended to the name and the description copied over.
- [INFERRED] The modal can also be opened via a "Create Smart List" or "New Smart List" button on the Manage Lists page, in which case the Name and Description fields would be empty.

### Name field
- Required field — if left blank and user clicks Save List, validation fires showing an error [INFERRED]
- The emoji picker button (🤩) opens an emoji selection panel — once selected, the emoji appears visually to the left of the name in the input
- The trash icon next to the emoji removes the selected emoji from the name

### Description textarea
- Supports rich text via the toolbar (bold, italic, underline, lists, links, emoji)
- Character limit is 1000; counter updates in real-time as user types
- The resize handle in the bottom-right allows the user to drag to resize the textarea vertically [INFERRED]

### Share smart list with — search
- Typing in the search box filters the agents/teams list in real-time [INFERRED]
- Teams (if the account has configured teams) would also appear in search results [INFERRED]

### Share with everyone checkbox
- If checked, the smart list becomes visible to all agents in the account
- Checking it would auto-check or disable the individual agent checkboxes [INFERRED]

### Individual agent checkboxes (Matt Ryan, Paul Stevenson, Rebecca Peterson)
- Each checkbox toggles visibility of the smart list for that specific agent
- When any agent is selected, the "This smart list is private" notice disappears or changes to reflect sharing [INFERRED]
- When all are unchecked (current state), the list is private to the creator

### Privacy notice
- Dynamically updates based on checkbox state:
  - All unchecked → "This smart list is private"
  - Some checked → notice changes to show who it's shared with [INFERRED]
  - "Share with everyone" checked → notice changes to "This smart list is shared with everyone" [INFERRED]

### Cancel button
- Closes the modal without saving; no changes are made; returns to the Manage Lists & Collections page

### Save List button
- Validates Name field (required)
- Creates a new smart list entry in FUB with:
  - The given name
  - The description
  - The sharing permissions (private or shared with specified agents)
  - The emoji if set
  - The filter criteria are NOT set in this modal — they are carried over from the copy source [INFERRED] or set separately after creation [INFERRED]
- On success: closes modal and the new list appears in the left rail and/or the Manage Lists page
- [INFERRED] The new list is a "static" list meaning contacts must be manually added, vs a "smart" list (dynamic, filter-based) — the description text says "static list" explicitly

### Close (X) button
- Same as Cancel — closes modal without saving

### "Learn more about filters and smart lists." link
- Opens FUB help/documentation in a new tab or help panel [INFERRED]

### Keyboard interactions [INFERRED]
- `Escape` closes the modal
- `Tab` moves focus between fields in order: Name → Description → Search agents → Checkboxes → Cancel → Save List
- `Enter` in the Name field may submit the form [INFERRED]

---

## Data Model Signals

### Entities
- **SmartList** — the entity being created:
  - `id` (auto-generated)
  - `name` (string, required, max likely 255 chars)
  - `emoji` (string/emoji character, optional prefix to name)
  - `description` (string, optional, max 1000 chars)
  - `is_private` (boolean, derived from sharing settings)
  - `shared_with` (array of agent IDs or "everyone")
  - `created_by` (agent ID)
  - `created_at` (timestamp)
  - `list_type` (enum: `static` | `smart`/dynamic)
  - `filter_criteria` (jsonb — the actual filter rules, not set in this modal)

- **Agent** (referenced in sharing):
  - `id`
  - `name` (e.g. "Matt Ryan", "Paul Stevenson", "Rebecca Peterson")

- **Team** (referenced in sharing search but none shown):
  - Likely has `id` and `name`

### Enum values (stage names referenced in description)
- "current (active/signed)" — stage/status value indicating an actively signed client
- "pending (under contract)" — stage/status value indicating under-contract status

### Relationships
- SmartList has_many AgentSharePermissions (many-to-many with Agent)
- SmartList belongs_to Agent (creator)
- SmartList optionally belongs_to FilterCriteria (for dynamic lists)

### Form validation rules
- `name`: required, non-empty string
- `description`: optional, max 1000 characters (enforced client-side with counter)
- `sharing`: defaults to private (all unchecked)

---

## Rebuild Notes

### Component Breakdown

```jsx
<ModalOverlay>                          // semi-transparent scrim, closes on outside click [INFERRED]
  <SaveNewSmartListModal>               // white card, ~480px wide, centered
    
    <ModalHeader>
      <h2>Save New Smart List</h2>
      <CloseButton onClick={onClose} /> // × icon, top-right
    </ModalHeader>
    
    <ModalBody>
      
      {/* NAME FIELD */}
      <FormField>
        <FormLabel>
          Name <RequiredBadge text="Required" />
        </FormLabel>
        <NameInputRow>
          <EmojiPickerButton emoji="🤩" onClick={openEmojiPicker} />
          <EmojiClearButton onClick={clearEmoji} />  {/* trash icon */}
          <TextInput
            value="Copy Of Active & Pending Clients"
            onChange={setName}
            required
          />
        </NameInputRow>
      </FormField>
      
      {/* DESCRIPTION FIELD */}
      <FormField>
        <FormLabel>Description</FormLabel>
        <RichTextToolbar>
          <ToolbarButton icon="B" action="bold" />
          <ToolbarButton icon="I" action="italic" />
          <ToolbarButton icon="U" action="underline" />
          <ToolbarButton icon="ordered-list" action="orderedList" />
          <ToolbarButton icon="unordered-list" action="unorderedList" />
          <ToolbarButton icon="link" action="insertLink" />
          <ToolbarButton icon="emoji" action="insertEmoji" />
          <ToolbarButton icon="Tx" action="clearFormatting" />
        </RichTextToolbar>
        <RichTextArea
          value="A static list of the clients you are currently working with. This smart list displays everyone in current (active/signed) and pending (under contract) stages."
          onChange={setDescription}
          maxLength={1000}
          resizable
        />
        <CharacterCounter current={173} max={1000} />
        {/* renders: "173/1000" bottom-right */}
      </FormField>
      
      {/* SHARING SECTION */}
      <FormField>
        <FormLabel>Share smart list with</FormLabel>
        <AgentSearchInput
          placeholder="Search for agents or teams..."
          icon="search"
          onChange={filterAgents}
        />
        <ShareWithEveryoneRow>
          <Checkbox checked={false} onChange={toggleShareAll} />
          <label>Share with everyone</label>
        </ShareWithEveryoneRow>
        <AgentsSectionHeader>AGENTS</AgentsSectionHeader>
        <AgentList>
          {agents.map(agent => (
            <AgentRow key={agent.id}>
              <Checkbox
                checked={sharedAgentIds.includes(agent.id)}
                onChange={() => toggleAgent(agent.id)}
              />
              <AgentName>{agent.name}</AgentName>
            </AgentRow>
          ))}
          {/* Matt Ryan — unchecked */}
          {/* Paul Stevenson — unchecked */}
          {/* Rebecca Peterson — unchecked */}
        </AgentList>
        <PrivacyNotice>
          {/* "This smart list is private" when no agents selected */}
          {sharedAgentIds.length === 0 && !shareWithAll
            ? "This smart list is private"
            : `Shared with ${sharedLabel}`
          }
        </PrivacyNotice>
      </FormField>
      
    </ModalBody>
    
    <ModalFooter>
      <HelpLink href="/help/smart-lists">
        Learn more about filters and smart lists.
      </HelpLink>
      <ButtonGroup>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSave}>Save List</Button>
      </ButtonGroup>
    </ModalFooter>
    
  </SaveNewSmartListModal>
</ModalOverlay>
```

### Non-Obvious Logic

1. **"Copy Of " prefix behavior:** When a user duplicates an existing smart list, the new smart list modal pre-populates the Name field with "Copy Of {original name}" and copies the Description verbatim. The filter criteria of the original list are also copied [INFERRED] but not editable in this modal — they are configured via the filter editor on the list itself after saving.

2. **Static vs dynamic list distinction:** The description text says "A static list" — FUB has both static lists (manually managed membership) and smart/dynamic lists (auto-populated by filter rules). The distinction must be resolved either at creation time (a separate selection) or is inherited from the source list type when copying. This modal does NOT show a "list type" selector, suggesting the type is inherited from the copy or pre-determined by the entry point.

3. **Sharing privacy model:** The default is private (creator-only). The `is_private` flag is derived: if `shareWithAll === false` AND `sharedAgentIds.length === 0`, the list is private. The privacy notice is a computed status display, not an editable field.

4. **"Share with everyone" vs individual agents:** These should be mutually exclusive or at least visually coordinated — checking "Share with everyone" likely auto-checks all individual agent checkboxes and disables them [INFERRED].

5. **Agent list ordering:** Agents are listed in a consistent order (Matt Ryan first, then Paul Stevenson, then Rebecca Peterson) — likely alphabetical by first name or in account registration order.

6. **Emoji association:** The emoji (🤩) is stored as a prefix to the list name OR as a separate metadata field, used for visual identification in the left rail sidebar.

7. **Validation:** Only `Name` is marked Required. The modal enforces this before allowing Save. No other fields have validation errors visible.

8. **Character counter position:** The `173/1000` counter is positioned bottom-right of the textarea, outside the textarea boundary (below the resize handle). It updates on every keypress.

9. **Resize handle:** The textarea description field has a drag-resize handle, allowing the user to expand the textarea vertically within the modal.

10. **Modal entry points:** This modal can be triggered by:
    - Clicking "Copy" / "Duplicate" on an existing smart list → pre-populates name + description
    - Clicking "New Smart List" or "+ Create Smart List" → opens with empty fields
    - (Current screenshot is the "copy" variant based on "Copy Of" prefix)
