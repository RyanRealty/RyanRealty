<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.30.02 AM.png | Sequential id: shot-48 | Tiles: fub-tiles/shot-48_{full,q1,q2,q3,q4}.png -->

# shot-48 — Email Templates List + Edit Email Template Modal

## Identity

- **Visible URL:** `ryan-realty.followupboss.com/2/email-templates/all`
- **Page title (browser tab):** "Email Template Folders - Fol..."
- **Top-nav active item:** "Email Templates" (highlighted/selected among the secondary nav tabs)
- **Sub-nav / tab active:** None — this is a flat list view; the breadcrumb shows "All Email Templates"
- **Breadcrumbs:** `Email Templates > All Email Templates`
- **Logged-in user (top-right avatar):** Matt Ryan (circular avatar, photo of a man, appears in the top-right corner of the chrome app bar)
- **Account / brokerage name:** Ryan Realty (visible in browser bookmarks bar as "Ryan Realty" shortcut)
- **Modal currently open:** "Edit Email Template" — overlaying the list page

---

## Layout

### Overall structure (background page, dimmed behind modal)

```
┌─────────────────────────────────────────────────────────────┐
│  Chrome browser chrome (tabs, address bar, bookmarks bar)   │
├─────────────────────────────────────────────────────────────┤
│  FUB top application bar (dark navy/charcoal)               │
│  [People] [Inbox] [Tasks] [Calendar] [Deals] [Reporting]    │
│  [Admin]  [Search]                                          │
├─────────────────────────────────────────────────────────────┤
│  Secondary nav (light gray, full-width horizontal):         │
│  Overview | Lead Flow | Groups | Team | Action Plans |      │
│  Automations | Ponds | Email Templates | Text Templates |   │
│  Import | Custom Fields | Stages | Phone Numbers | Tags |   │
│  Integrations | Company | API | More ▾                      │
│  [Right side: Admin Overview button]                        │
├─────────────────────────────────────────────────────────────┤
│  Page header area:                                          │
│  Breadcrumb: Email Templates > All Email Templates          │
│  [Search Templates 🔍]   [+ Email Template] (blue button)   │
├──────────────────────────┬──────────────────────────────────┤
│  LEFT: Template list      │  RIGHT: Stats table columns      │
│  (≈38% of width)          │  (≈62% of width)                 │
│                            │  Sent | Opens | Clicks |         │
│  19 Email Templates  All  │  Replies | Unsubscribed |        │
│                            │  Bounces | ? | Actions           │
│  [scrollable list of      │  [rows with 0 / — values]        │
│   template name + preview  │                                  │
│   text rows]               │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

### Modal dialog (centered, overlays background with dim scrim)

The "Edit Email Template" modal is roughly 50–55% of the viewport width, vertically centered or slightly above center. It has a white background, a header section, scrollable body, and a fixed footer with action buttons.

```
┌──────────────────────────────────────────┐
│  [envelope icon] Edit Email Template  [X]│  ← modal header
│  Created on May 4th, 2025 at 9:53am      │
│  by Matt Ryan                            │
├──────────────────────────────────────────┤
│  [Subject field]          [Merge Fields ▾]│
│  [Preview text field]     [Merge Fields ▾]│
├──────────────────────────────────────────┤
│  [Rich text toolbar: B I U ...]  [Merge Fields ▾]│
│  ┌─────────────────────────────────────┐ │
│  │  Hi %contact_first_name%,           │ │
│  │                                     │ │
│  │  Thanks for the search request...   │ │
│  │                                     │ │
│  │  One question that helps me sharpen │ │
│  │  ...                                │ │
│  │                                     │ │
│  │  Talk soon,                         │ │
│  └─────────────────────────────────────┘ │
│  The sender's signature from [My Settings]│
│  will automatically be added.            │
│  ☑ Share this template with everyone     │
│  Folders:                                │
│  [+]                                     │
│  In use by 1 automation & 1 action plan  │
├──────────────────────────────────────────┤
│                      [Cancel]  [Save]    │  ← modal footer
└──────────────────────────────────────────┘
```

**Fixed vs scrolling:**
- Background template list: scrollable vertically (templates extend below fold)
- Modal body: appears scrollable (scrollbar track visible on right edge of the rich text area)
- Modal header and footer: fixed within the modal

---

## Every UI element (exhaustive)

### Browser chrome

- **Browser tab:** "Email Template Folders - Fol..." (truncated), FUB favicon
- **Address bar:** `ryan-realty.followupboss.com/2/email-templates/all`
- **Bookmarks bar items visible:** "Son's LH business...", "Claude", "CRM mobile UI rede...", "Lindsay mail form...", "Application cost an...", various app icons (Figma, Slack, etc.), "Inbox", "Ryan Realty" shortcut, and others

### FUB top application bar (dark charcoal/navy bar)

- **Left side:** FUB logo (not clearly visible but implied)
- **Nav items (icon + label):**
  - 👤 People
  - 📥 Inbox
  - ✓ Tasks
  - 📅 Calendar
  - 💰 Deals
  - 📊 Reporting
  - ⚙️ Admin
- **Search box:** pill-shaped input, placeholder text "Search" (magnifier icon inside)
- **Right side icons (top-right of app bar):**
  - Chat/message bubble icon
  - Notification bell icon
  - User avatar icon (small circular)
  - Matt Ryan avatar (larger circular photo, rightmost)

### Secondary admin/settings nav (light gray horizontal tab bar, full width)

All items are text links; "Email Templates" is the active/selected tab (appears slightly bolder or underlined):

- Overview
- Lead Flow
- Groups
- Team
- Action Plans
- Automations
- Ponds
- **Email Templates** ← ACTIVE
- Text Templates
- Import
- Custom Fields
- Stages
- Phone Numbers
- Tags
- Integrations
- Company
- API
- More ▾ (dropdown trigger)
- **[Admin Overview]** button — top-right of this bar, small blue text link/button with icon

### Page-level header (above the template list)

- **Breadcrumb:** `Email Templates` (link) `>` `All Email Templates` (current page, not a link)
- **Count badge:** `19 Email Templates` — small text below breadcrumb or inline; followed by badge chip: `All` (likely a filter chip showing all templates are displayed)
- **Top-right controls:**
  - **Search Templates** — text input with 🔍 magnifier icon inside, placeholder text "Search Templates", width ~180px
  - **+ Email Template** — blue filled button with "+" prefix, creates a new email template

### Email template list (left/main column, background, dimmed)

**Column headers (visible in background):**

| Column | Notes |
|--------|-------|
| Template | First column, contains name + preview text |
| Folders | Numeric count column (shows "1" with eye icon for some rows) |
| [eye icon] | Toggle visibility / shared status column |
| Sent | Numeric stat |
| Opens | Numeric stat |
| Clicks | Numeric stat |
| Replies | Numeric stat |
| Unsubscribed | Numeric stat |
| Bounces | Numeric stat |
| ? | Help/info icon column header |
| Actions | Pencil/edit icon per row |

**Template rows visible (name + preview text, from top to bottom):**

1. **BL-01 Your Bend search is set up** / _Your Bend search is set up_
2. **BL-02 Two things that move buyers ahead** / _Two things that move buyers ahead (toward the field of the time in Bend)_
3. **BL-03 What to know about your top areas** / _What to know about your top areas before you tour_
4. **BL-04 What's moving in your budget range** / _What's moving in your budget range right now_
5. **BL-05 Are your search areas still right** / _Are your search areas still right?_
6. **BL-06 Sticking with you for the long game** / _Sticking with you for the long game_
7. **BL-S1 Buyer SMS Confirmation** / _[SMS]_
8. **BL-S2 Buyer SMS Check-in** / _[SMS]_
9. **EXP-1 Expired Five reasons listings stall** / _Five reasons Bend listings stall_
10. **EXP-2 Expired Whats closing in your neighborhood** / _What's actually closing in your neighborhood_
11. **EXP-3 Expired Personal letter intro (under 750K)** / _A note instead of an email_
12. **EXP-4 Expired Whenever youre ready** / _Whenever you're ready_
13. **EXP-5 Expired Mid-quarter market read** / _Bend market, mid-quarter read_
14. **EXP-7 Expired Moving to quarterly list** / _Moving you to the quarterly list_
15. **FSBO-1 Five things FSBOs in Bend miss** / _Five things FSBOs in Bend tend to miss_

(Additional rows likely exist below the fold — list count says 19 total)

**Stats columns for visible rows:** Almost all rows show:
- Folders column: most rows show blank or `1` + 👁 eye icon
- Sent: `0`
- Opens: `—` (em-dash, no data)
- Clicks: `—`
- Replies: `—`
- Unsubscribed: `—`
- Bounces: `—`
- Actions: pencil/edit icon (✏️), muted gray

Rows with Folders value of `1` + eye icon appear for rows in the lower portion of the list (EXP- and FSBO- rows), suggesting they have been added to a folder.

---

### Edit Email Template Modal (foreground, active)

#### Modal header

- **Icon:** Small envelope/email icon (left of title)
- **Title text:** `Edit Email Template`
- **Subtitle / metadata:** `Created on May 4th, 2025 at 9:53am by Matt Ryan` — small gray text below the title
- **Close button:** `X` — circular or plain X icon, top-right corner of modal header

#### Subject field

- **Type:** Single-line text input
- **Label:** Implicit (no visible field label; positioned as the first field in the form)
- **Current value:** `BL-01 Your Bend search is set up`
  - Note: the template name prefix `BL-01` appears to be part of the subject line value
- **Merge Fields button:** Right-aligned to the subject field; reads `Merge Fields` with a small dropdown caret `▾` — opens a picker to insert merge/variable tags into the subject
- **Field styling:** Standard single-line input with border, white background, moderate padding

#### Preview text field

- **Type:** Single-line text input
- **Label:** Implicit (second field in form)
- **Current value:** `Your Bend search is set up`
- **Merge Fields button:** Same as above — `Merge Fields ▾` on the right
- **Purpose:** This is the email preheader/preview text shown in inbox clients below the subject line

#### Rich text editor toolbar

A horizontal toolbar row above the email body textarea, containing formatting controls:

- **B** — Bold
- **I** — Italic
- **U** — Underline (likely)
- **S̶** — Strikethrough (likely)
- **"** or block quote icon
- **List** icon (unordered list)
- **Ordered list** icon (likely)
- **Link** icon (insert hyperlink)
- **Image/photo** icon (insert image)
- **Additional icons** (exact count ~8–10 total in the toolbar)
- **Merge Fields ▾** — rightmost item in the toolbar row, same pattern as subject/preview fields; inserts merge tags into the body at cursor position

#### Email body (rich text area)

A scrollable textarea occupying the bulk of the modal. Vertically resizable (resize handle visible at bottom-right corner of the textarea). A scrollbar is visible on the right edge.

**Exact body text content (as seen in modal):**

```
Hi %contact_first_name%,

Thanks for the search request. I have your criteria set up for %customBuyerSearchAreas% and the first matching listings will be in your inbox within the hour. They come from the live MLS, not Zillow, so prices and statuses are current.

One question that helps me sharpen what you see: What does your ideal home look like beyond the basics? Even a few sentences gives me enough to filter out the listings you don't want to waste time looking at.

Talk soon,
```

- **Merge field tokens used:** `%contact_first_name%`, `%customBuyerSearchAreas%` — shown in the body as plain text tokens; likely rendered with highlight styling in edit mode
- **Closing:** "Talk soon," — no name/signature appended here (handled by the auto-signature note below)

#### Sender signature note

- **Text:** `The sender's signature from My Settings will automatically be added.`
- **Styling:** Light gray/muted italic text
- **`My Settings`** — inline blue hyperlink within the sentence; clicking navigates to the user's personal settings page

#### Share checkbox

- **Control type:** Checkbox (checked state — blue filled checkbox with white checkmark)
- **Label:** `Share this template with everyone`
- **State:** Checked / enabled
- **Purpose:** When checked, makes this template visible and usable by all team members (not just the creator)

#### Folders section

- **Label:** `Folders:` (bold or semi-bold label text)
- **Current folders:** None explicitly named — only the `+` add button is visible (suggesting the template has not yet been added to any folder, or folders are not displayed inline)
- **`+` button:** Small blue circular button with a white `+` icon; clicking opens a folder picker or creates/assigns a folder

#### Usage note (footer of content area)

- **Text:** `In use by 1 automation & 1 action plan`
- **Styling:** Small gray text, informational only
- **Links:** `1 automation` and `1 action plan` may be clickable links [INFERRED — common FUB pattern]
- **Purpose:** Warns the user that editing/saving this template will affect live automations and action plans using it

#### Modal action buttons

Positioned at the bottom-right of the modal footer:

- **Cancel** — text/ghost button, gray; dismisses modal without saving changes
- **Save** — blue filled pill/rounded button; submits the form and saves changes to the template

---

## Colors, typography & style

### Color palette

| Element | Color (estimated hex) |
|---------|----------------------|
| FUB top app bar background | `#1a2233` (dark navy/charcoal) |
| Secondary nav bar background | `#f5f6f7` (very light gray) |
| Active nav item text | `#1a73e8` or `#2563eb` (blue) |
| Page background | `#ffffff` or `#f8f9fa` (white/near-white) |
| Modal background | `#ffffff` |
| Modal overlay/scrim | `rgba(0,0,0,0.4)` (semi-transparent dark) |
| "Save" button background | `#3b82f6` or `#4A90D9` (medium blue) |
| "Save" button text | `#ffffff` |
| "Cancel" text | `#6b7280` (medium gray) |
| Merge Fields button | Light gray background with gray border, blue text |
| Checkbox (checked) | `#3b82f6` (blue fill) |
| Merge tag tokens | Likely `#e8f4fd` background / `#1a73e8` text [INFERRED] |
| Link text (My Settings) | `#2563eb` (blue) |
| Template name text | `#111827` (near-black) |
| Template preview text | `#6b7280` (gray, smaller) |
| Stats table `—` dashes | `#9ca3af` (light gray) |
| Stats table `0` values | `#374151` (dark gray) |
| Pencil/edit icon | `#9ca3af` or `#6b7280` (muted gray) |
| Folders eye icon | Blue accent |

### Typography

- **Template names:** ~14px semi-bold, dark gray/near-black
- **Template preview text:** ~12–13px regular weight, medium gray, single line truncated
- **Modal title:** ~16–18px semi-bold or bold
- **Modal metadata (created date):** ~12px regular, gray
- **Email body text:** ~14px regular, standard body font
- **Merge tag tokens:** likely monospace or slightly different weight/color to stand out
- **Footer note (In use by...):** ~12px regular, gray
- **Button text ("Save", "Cancel"):** ~14px medium weight

### Style / design language

- **Border radius:** Moderate — input fields ~4–6px, modal ~8px, "Save" button ~20px (pill-shaped)
- **Density:** Medium — comfortable padding between elements
- **Iconography:** Outline-style icons, consistent with Material Design or similar system
- **Modal shadow:** Soft drop shadow suggesting elevated surface
- **Input borders:** Light gray (`#d1d5db`), 1px
- **Rich text toolbar:** Separated from the body by a thin border; icons are small (~16px), tight spacing
- **Bottom progress bar:** Not visible in this shot (modal likely obscures it or it is absent on this screen)

---

## State & data shown

- **Active page/route:** `/2/email-templates/all` — the "All" filter is selected for email templates
- **Total template count:** 19 Email Templates
- **Active filter chip:** `All` (shown as a small badge/chip near the count)
- **Modal state:** Open on template `BL-01 Your Bend search is set up`
- **Template being edited:**
  - Name / subject: `BL-01 Your Bend search is set up`
  - Preview text: `Your Bend search is set up`
  - Created: `May 4th, 2025 at 9:53am`
  - Author: `Matt Ryan`
  - Share status: Shared with everyone (checkbox checked)
  - Folders: None assigned (or not shown)
  - In use: 1 automation, 1 action plan
- **Merge fields in body:** `%contact_first_name%`, `%customBuyerSearchAreas%`
- **Stats visible for background rows:** All show `0` sent and `—` for all engagement metrics — these appear to be templates that have never been sent directly (they fire through automations/action plans)
- **Folders column:** Some rows show `1` with an eye icon — indicating those templates belong to 1 folder and are visible/active

### Sample template naming conventions

The template names follow a structured prefix system:
- `BL-01` through `BL-S2` — Buyer Lead series (BL = Buyer Lead, S = SMS)
- `EXP-1` through `EXP-7` — Expired listing outreach series
- `FSBO-1` — For Sale By Owner series

---

## Interactions & behaviors

### Modal open / close
- **Open trigger:** Clicking the pencil/edit icon in the Actions column of a template row opens this modal [INFERRED]
- **Close:** Click `X` button at top-right, or click `Cancel` button, or press `Escape` key [INFERRED — standard modal behavior]
- **Scrim click:** May or may not dismiss the modal [INFERRED]

### Subject field — Merge Fields dropdown
- **Trigger:** Click `Merge Fields ▾` button to the right of the subject field
- **Behavior:** Opens a dropdown/popover listing available merge field variables (e.g., `%contact_first_name%`, `%contact_email%`, custom fields, etc.) [INFERRED]
- **Action:** Clicking a merge field inserts the `%variable_name%` token at the cursor position in the subject input

### Preview text field — Merge Fields dropdown
- Same pattern as subject field [INFERRED]

### Rich text editor
- **Formatting:** Toolbar buttons apply inline formatting (bold, italic, underline, strikethrough, lists, blockquote) to selected text
- **Merge Fields ▾ in toolbar:** Inserts merge tags at cursor position within the body text
- **Link button:** Opens a URL input dialog to insert hyperlinks [INFERRED]
- **Image button:** Opens a file picker or URL dialog to insert images inline [INFERRED]
- **Resize handle:** Drag the bottom-right corner of the textarea to resize vertically

### "Share this template with everyone" checkbox
- **Checked state (current):** Template is visible to all team members in their template pickers
- **Unchecked state [INFERRED]:** Template is private to the creator only
- **Toggle:** Click checkbox to toggle

### Folders `+` button
- **Behavior:** Opens a folder selection popover or inline input to add the template to one or more folders [INFERRED]
- **Folder purpose:** Organizes templates in the Folders column of the list; folders can be used to group templates by campaign or use case [INFERRED]

### Save button
- **Behavior:** PATCH/PUT request to the FUB API saving all field changes (subject, preview, body, share setting, folders) then closes the modal and refreshes the list row
- **Validation [INFERRED]:** Likely requires non-empty subject and body; may warn if usage automations will be affected

### Cancel button
- **Behavior:** Discards all unsaved changes and closes the modal

### "In use by 1 automation & 1 action plan" links
- **Behavior [INFERRED]:** Clicking "1 automation" navigates to or filters the Automations list to show the automation using this template; clicking "1 action plan" navigates to the Action Plans list

### Template list row (background)
- **Hover state [INFERRED]:** Row highlights with light gray background, pencil icon becomes darker/more prominent
- **Pencil icon click:** Opens this Edit Email Template modal for that template
- **Template name click [INFERRED]:** May also open the edit modal or a preview
- **Folders eye icon:** Toggles visibility or navigates to the folder view [INFERRED]

### "Search Templates" input
- **Behavior [INFERRED]:** Live-filters the template list as the user types, matching against template names

### "+ Email Template" button
- **Behavior [INFERRED]:** Opens a "New Email Template" modal (same form as Edit but with empty fields)

---

## Data model signals

### EmailTemplate entity

| Field | Type | Evidence |
|-------|------|----------|
| `id` | UUID/integer | Implied by URL and edit endpoint |
| `name` | string | "BL-01 Your Bend search is set up" |
| `subject` | string | Subject field value |
| `preview_text` | string | Preview text field value |
| `body_html` | rich text / HTML | Rich text editor content |
| `shared` | boolean | "Share this template with everyone" checkbox |
| `created_at` | datetime | "Created on May 4th, 2025 at 9:53am" |
| `created_by` | user ref | "by Matt Ryan" |
| `sent_count` | integer | Sent column (0) |
| `opens_count` | integer | Opens column (—) |
| `clicks_count` | integer | Clicks column (—) |
| `replies_count` | integer | Replies column (—) |
| `unsubscribed_count` | integer | Unsubscribed column (—) |
| `bounces_count` | integer | Bounces column (—) |
| `type` | enum: email/sms | BL-S1 and BL-S2 are marked [SMS] in preview |
| `folders` | array/join | Folders field + folder count column |
| `automation_usage_count` | integer | "In use by 1 automation" |
| `action_plan_usage_count` | integer | "In use by 1 action plan" |

### Merge field / variable tokens

- Format: `%variable_name%` (percent-delimited)
- Known tokens: `%contact_first_name%`, `%customBuyerSearchAreas%`
- System adds sender signature automatically (from user's My Settings)
- Merge fields available via dropdown picker in both subject and body

### Folder entity

| Field | Type | Evidence |
|-------|------|----------|
| `id` | integer/UUID | Implied by folder assignment |
| `name` | string | [INFERRED] |
| `template_ids` | array | Many-to-many with templates |

### Usage / dependency relationships

- EmailTemplate → Automation (many-to-many): a template can be used in multiple automations
- EmailTemplate → ActionPlan (many-to-many): a template can be used in multiple action plan steps
- Usage counts are displayed to warn before editing

### Template naming convention (enum-like pattern)

- Prefix codes observed: `BL` (Buyer Lead), `BL-S` (Buyer Lead SMS), `EXP` (Expired), `FSBO` (For Sale By Owner)
- Sequential numbering: `BL-01` through `BL-06`, `EXP-1` through `EXP-7`, `FSBO-1`
- Implies a campaign/series organizational structure

---

## Rebuild notes

### Component breakdown

```tsx
// Page-level components
<EmailTemplatesPage>
  <SecondaryNav activeItem="email-templates" />
  <PageHeader
    breadcrumb={["Email Templates", "All Email Templates"]}
    count={19}
    filterBadge="All"
  />
  <PageControls>
    <SearchInput placeholder="Search Templates" />
    <Button variant="primary" icon="plus">Email Template</Button>
  </PageControls>
  <EmailTemplateTable
    templates={templates}
    onEdit={(template) => openEditModal(template)}
  />
  <EditEmailTemplateModal
    template={selectedTemplate}
    isOpen={isModalOpen}
    onClose={closeModal}
    onSave={saveTemplate}
  />
</EmailTemplatesPage>

// Table component
<EmailTemplateTable>
  <TableHeader>
    <Col name="template" label="Template" sortable />
    <Col name="folders" label="Folders" />
    <Col name="visibility" icon="eye" />
    <Col name="sent" label="Sent" />
    <Col name="opens" label="Opens" />
    <Col name="clicks" label="Clicks" />
    <Col name="replies" label="Replies" />
    <Col name="unsubscribed" label="Unsubscribed" />
    <Col name="bounces" label="Bounces" />
    <Col name="help" icon="question-circle" />
    <Col name="actions" label="Actions" />
  </TableHeader>
  {templates.map(t => (
    <EmailTemplateRow
      key={t.id}
      template={t}
      onEdit={() => openEditModal(t)}
    />
  ))}
</EmailTemplateTable>

// Table row
<EmailTemplateRow>
  <TemplateNameCell
    name={template.name}
    preview={template.previewText}
    type={template.type} // email | sms
  />
  <FolderCountCell count={template.folderCount} visible={template.visible} />
  <StatCell value={template.sent} emptyDash />
  <StatCell value={template.opens} emptyDash />
  <StatCell value={template.clicks} emptyDash />
  <StatCell value={template.replies} emptyDash />
  <StatCell value={template.unsubscribed} emptyDash />
  <StatCell value={template.bounces} emptyDash />
  <ActionsCell>
    <IconButton icon="pencil" onClick={onEdit} />
  </ActionsCell>
</EmailTemplateRow>

// Modal
<EditEmailTemplateModal>
  <ModalHeader>
    <EnvelopeIcon />
    <h2>Edit Email Template</h2>
    <MetaText>Created on {createdAt} by {createdBy}</MetaText>
    <CloseButton />
  </ModalHeader>
  <ModalBody>
    <MergeFieldInput
      label={null}
      placeholder="Subject"
      value={subject}
      onChange={setSubject}
    />
    <MergeFieldInput
      label={null}
      placeholder="Preview text"
      value={previewText}
      onChange={setPreviewText}
    />
    <RichTextEditor
      value={bodyHtml}
      onChange={setBodyHtml}
      toolbar={['bold','italic','underline','strikethrough','quote','ul','ol','link','image']}
      mergeFieldsButton
    />
    <SignatureNotice settingsLink="/settings/my-settings" />
    <Checkbox
      checked={shareWithEveryone}
      onChange={setShareWithEveryone}
      label="Share this template with everyone"
    />
    <FolderAssignment
      folders={assignedFolders}
      onAdd={openFolderPicker}
    />
    <UsageNotice
      automationCount={1}
      actionPlanCount={1}
    />
  </ModalBody>
  <ModalFooter>
    <Button variant="ghost" onClick={onClose}>Cancel</Button>
    <Button variant="primary" onClick={onSave}>Save</Button>
  </ModalFooter>
</EditEmailTemplateModal>
```

### Non-obvious implementation details

1. **`%variable%` merge field token rendering:** The rich text editor must handle `%merge_field_name%` tokens as atomic, non-editable inline elements (chips/spans) while in edit mode. When the "Merge Fields ▾" dropdown is clicked, a popover appears listing all available merge fields by category (contact fields, custom fields, property fields). Selecting one inserts `%field_name%` at the cursor.

2. **SMS templates mixed in the list:** Templates with `[SMS]` in the preview are text/SMS templates appearing in the email templates list, OR the list includes both types. The `BL-S1` and `BL-S2` entries show `[SMS]` as their preview text — these are likely SMS templates stored in the same data model, differentiated by a `type` field.

3. **Stat column `—` vs `0`:** The `Sent` column shows `0` (actual zero value) while Opens/Clicks/Replies/Unsubscribed/Bounces show `—` (em-dash placeholder meaning "not applicable" or "never sent so no engagement data"). This distinction matters: `0` is a real zero; `—` means null/not measured.

4. **"In use by" warning:** This is a read-only informational field computed server-side by counting references to this template's ID in automations and action plans tables. It should be refreshed on modal open to ensure freshness.

5. **Folder column with eye icon:** The eye icon next to the folder count likely indicates the template has its visibility toggled on (shared/published) within that folder context. Clicking the eye may toggle the shared state.

6. **Signature auto-addition:** The system auto-appends the sending user's signature (from their personal My Settings) at send time, not at template-edit time. The note in the modal makes this explicit.

7. **Shared templates:** When `Share this template with everyone` is checked, all team members can see and use this template in their own action plans and manual emails. The template author retains edit rights [INFERRED].

8. **Modal URL behavior [INFERRED]:** The URL likely does not change when the modal opens (it remains `/email-templates/all`), or it may append `?edit=<templateId>` as a query param for deep-linking.

9. **Template prefix naming system:** The `BL-`, `EXP-`, `FSBO-` prefix codes are user-defined naming conventions (not system-enforced), used to organize templates into logical campaign sequences within the flat list.

10. **Scrollable template body:** The rich text area has a visible scrollbar, meaning the full body content may extend below what is visible. The resize handle (bottom-right corner `⤢` triangle) allows manual vertical resizing.

11. **`%customBuyerSearchAreas%` is a custom merge field** (not a standard FUB field) — identified by the `custom` prefix in the variable name. This is a user-defined custom field that must be populated on the contact record for the merge to resolve correctly at send time.
