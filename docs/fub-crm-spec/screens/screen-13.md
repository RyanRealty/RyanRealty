<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.19.46 AM.png | Sequential id: shot-13 | Tiles: fub-tiles/shot-13_{full,q1,q2,q3,q4}.png -->

# shot-13 — Apply Automation Modal (Contact Detail — Person Record)

## Identity
- **Visible URL:** `ryan-realty.followupboss.com/2/people/view/27022`
- **Browser tab title:** "Laurie McAdam - Follow Up B…" (truncated by Chrome tab width)
- **Page underneath modal:** Contact Detail / Person Record for "Laurie McAdam" (person ID 27022)
- **Top-nav active item:** People / Contacts (inferred from URL `/people/view/`)
- **Sub-nav/tab active:** Not visible — obscured by modal overlay
- **Breadcrumbs:** None visible
- **Logged-in user:** "MR" avatar visible bottom-right of the right sidebar (Matt Ryan — Ryan Realty account), consistent with the brokerage name "Ryan Realty" visible in the Chrome bookmarks bar
- **Account/Brokerage:** ryan-realty (FUB subdomain: `ryan-realty.followupboss.com`)
- **Modal trigger context:** User clicked "Apply Automation" from somewhere on the person record (likely an action button in the contact header or action bar)

---

## Layout

### Overall Structure
The screen is a standard Contact Detail / Person Record page with a **centered modal dialog** overlaid on top. The underlying page is dimmed (dark semi-transparent scrim covers the full viewport) so the modal draws all focus.

### Top-level layout regions (background page, visible through scrim):
1. **Top navigation bar** — full-width, fixed, very dark (near-black / dark navy), ~48px tall. Contains FUB logo area on left, nav items, search bar, user avatar/controls on right. Spans full width.
2. **Chrome bookmarks bar** — browser-native, shows bookmarks including "Son's UH business...", "Claude", "CRM mobile UI redesi...", "Lindsay mail form...", "Application cost an..." and more.
3. **Left contact info sidebar** — approximately 25–30% of viewport width, left-anchored. Contains contact avatar/name, contact fields (phone, email, address, stage, source, tags, etc.). Appears dimmed.
4. **Center main column / Activity Timeline** — approximately 50–55% of viewport width, center. Contains the chronological activity/timeline feed for this contact. Visible through the scrim showing blurred timeline events.
5. **Right action sidebar / icon rail** — approximately 5–8% of viewport width, right edge. A narrow vertical strip with icon buttons for quick actions (log call, send email, send text, create task, etc.). Shows colored circular icons and status dots.
6. **Far-right FUB panel (collapsed)** — the rightmost ~20px shows FUB's collapsible side panel with activity icons (lightning bolt, bookmark/pin, etc.) in a narrow dark vertical strip.

### Modal Dialog (primary focus):
- **Position:** Centered horizontally and approximately vertically-centered in the viewport, slightly above center.
- **Approximate dimensions:** ~210px wide × ~290px tall (based on proportions in the full screenshot; approximately 28% of viewport width, 65% of viewport height).
- **Z-index:** Elevated above the dark scrim which covers the background page.
- **Background:** Pure white (`#FFFFFF`).
- **Shadow:** Drop shadow suggesting elevation (modal card style).
- **Border radius:** ~8px corners.

---

## Every UI Element (Exhaustive)

### Background Page Elements (visible through scrim, partially legible)

#### Top Navigation Bar (dark bar, ~48px, full-width, fixed)
- FUB logo/wordmark on far left (not legible through scrim)
- Navigation items (blurred, not legible — standard FUB nav: Inbox, People, Deals, Tasks, Calendar, Reports, Admin)
- Search bar: centered/right-of-center in the nav bar — appears as a rounded input, currently empty or not focused
- Right side of top nav: colored avatar circles (user avatars for agents), icon buttons
  - Visible avatar colors: blue circle, red/orange circle, and possibly teal — these are likely agent presence/avatar indicators
  - Far right: user account controls

#### Contact Header Area (top of center column, visible through scrim)
- Contact name: "Laurie McAdam" (legible in browser tab title; blurred in page body)
- A teal/blue filled button visible — likely "Send Email" or a primary action button in the contact header
- Additional action buttons adjacent

#### Activity / Timeline Feed (center column, visible through scrim)
- Multiple timeline event rows visible, each showing:
  - Left: avatar circle (blue circle with white icon, suggesting FUB system event; or colored agent avatar)
  - Event title text (blurred/not legible)
  - Timestamp text
  - Expand/action controls on right
- Approximately 5–8 timeline events visible through the scrim

#### Right Icon Rail (narrow strip, ~40px wide)
- Series of icon buttons stacked vertically, with colored dots/indicators:
  - Filled blue circle (•) — likely "Email" action
  - Filled blue circle (•)
  - Orange/amber triangle warning icon (⚠) — likely a compliance alert or "do not contact" warning
  - Empty circle (○)
  - Filled grey/dark circle (•)
  - Empty circle (○)
  - Orange/amber triangle warning icon (⚠)
  - Empty circle (○)
  - Filled blue circle (•)
  - Purple/blue icon that looks like a merge/fork symbol (⤸ or similar) — likely "Linked deal" or "Merge" indicator
  - Filled blue dot (•) — solid blue
  - Empty circle (○)
  - Empty circle (○) — possibly more
  - Another merge/fork icon (purple) lower down
- Near the bottom right: "MR" avatar (Matt Ryan — the logged-in user)
- Below that: a thumbnail image (appears to be an aerial/landscape photo — bottom-right corner of viewport)

---

### Modal Dialog — "Apply Automation" (primary focus)

#### Modal Header
- **Title text:** "Apply Automation"
  - Font: Bold, approximately 18–20px, dark near-black text (`#1a1a1a` or similar)
  - Position: Top-left of modal, with standard padding (~16–20px from top and left edges)
- **Close button (×):**
  - Position: Top-right corner of modal header
  - Glyph: "×" (times/close character)
  - Style: Small, grey text/icon, no border — clicking dismisses the modal without applying
  - Approximate size: 16px, color ~`#666` or `#999`

#### Search Field
- **Placeholder text:** "Search automations..."
- **Type:** Text input, single-line
- **Position:** Below the title, spanning nearly full modal width with ~12px left/right padding
- **Style:**
  - Left icon: Magnifying glass / search icon (🔍 glyph, ~14px, grey) positioned inside the left of the input
  - Input border: Light grey, approximately 1px solid, border radius ~4–6px
  - Active/focused state: Blue/teal left border highlight or bottom border (the q1 tile shows a teal/blue left border highlight indicating this input may be auto-focused on modal open)
  - Background: White
  - Placeholder text color: Light grey (~`#aaa` or `#bbb`)
- **Function:** Filters the list of automations below in real-time as the user types [INFERRED: client-side filtering of the list]

#### Automation List (scrollable)
- **Container:** Scrollable list below the search field
- **Scroll state:** A scrollbar is visible on the right edge of the list (thin, dark/grey scroll thumb), indicating there are more items below the visible area (the list is partially scrolled or has more items than fit)
- **Each list item layout:**
  - Left: Radio button (circle) — unselected state = hollow grey ring (~14–16px diameter). No item is pre-selected (all show as empty/unselected circles).
  - Right of radio: Automation name text — medium weight, ~14px, dark text
  - Height per row: approximately 36–40px
  - Separator: Very subtle horizontal divider line between rows (1px, light grey ~`#eee` or `#f0f0f0`) OR just whitespace padding
  - Hover state: [INFERRED] row background lightens or shows subtle highlight on hover
- **Selection behavior:** Single-select radio group — only one automation can be selected at a time [INFERRED from radio button UI]

#### Automation List Items (in order, top to bottom):
1. `○` **Stale Lead Engagement**
2. `○` **Buyer Long Term Nurture**
3. `○` **Open House Follow Up**
4. `○` **Open House Leads**
5. `○` **Post Closing Plan**
6. `○` **Unconverted and active now. Call!**
7. `○` **Birthday Email - Start by Automations**
8. `○` **Assign to a lender**

- **Note:** The scrollbar is visible, implying there may be additional automation entries below "Assign to a lender" that require scrolling to see. The list shows 8 items in the visible area.
- **Note on naming conventions visible:** Automation names use natural language titles. Some use sentence case, some use title case. The name "Unconverted and active now. Call!" includes punctuation (period and exclamation). "Birthday Email - Start by Automations" uses a dash separator. These are user-defined automation names configured in the FUB admin.

#### Modal Footer / Action Buttons
- **Position:** Bottom of the modal, right-aligned button group
- **Left button — "Cancel":**
  - Text: "Cancel"
  - Style: Ghost/text button — no background fill, no visible border (or very subtle border). Text color: medium grey (~`#555` or `#666`).
  - Font: Regular weight, ~14px
  - Function: Dismisses the modal without applying any automation
- **Right button — "Apply":**
  - Text: "Apply"
  - Style: Filled/solid button — background color: teal/blue (~`#1aa3c9` or `#17a2c8` or similar FUB brand blue-teal). Text color: white (`#FFFFFF`). Border radius: ~20px (pill shape, very rounded).
  - Font: Medium/semibold weight, ~14px
  - State: Appears active/enabled (not disabled), suggesting either no item needs to be selected first, or the button becomes enabled only after a selection [INFERRED: likely disabled until a radio item is selected, but may appear enabled in screenshot before selection]
  - Function: Applies the selected automation to the current contact (Laurie McAdam, person ID 27022) and closes the modal

#### Modal Scrim / Overlay
- **Style:** Semi-transparent dark overlay covering the entire page behind the modal
- **Color:** Dark, approximately `rgba(0, 0, 0, 0.5)` or `rgba(10, 20, 40, 0.6)` — creating a strong dimming effect that greys out the underlying contact page
- **Interaction:** [INFERRED] Clicking on the scrim outside the modal may dismiss it (same as Cancel), or may require clicking the Cancel/× button explicitly

---

## Colors, Typography & Style

### Modal Colors
- **Modal background:** Pure white `#FFFFFF`
- **Modal border/shadow:** Drop shadow (no visible border-line), shadow color approximately `rgba(0,0,0,0.15)` with ~8px blur
- **Modal border radius:** ~8px
- **Title text color:** Near-black `#1a1a1a` or `#222222`
- **List item text color:** Dark grey `#333333` or `#444444`
- **Radio button (unselected):** Grey ring `#cccccc` or `#dddddd`
- **Search input border:** Light grey `#e0e0e0` or `#dddddd`; focused highlight teal/blue ~`#1aa3c9`
- **Search icon color:** Grey ~`#999999`
- **Placeholder text color:** Light grey ~`#aaaaaa`
- **Scrollbar thumb:** Dark grey ~`#999999` or auto-system
- **Apply button background:** FUB brand teal-blue `#1a9dc9` or similar (`#17a2c8` / `#0d9fc0`)
- **Apply button text:** White `#FFFFFF`
- **Cancel button text:** Grey `#555555` or `#666666`
- **Divider lines between list items:** Very light `#f0f0f0` or `#eeeeee`

### Background Page Colors (through scrim)
- **Top nav bar:** Very dark navy / near-black `#1a1d21` or `#0f1117`
- **Page body background:** White or very light grey (standard FUB page background), now appearing dark due to scrim overlay

### Typography
- **Modal title:** Bold, approximately 18–20px, sans-serif (FUB uses a system sans — likely Inter or similar)
- **List item text:** Regular/Medium, ~14px, sans-serif
- **Button text:** Medium/Semibold, ~14px, sans-serif
- **Search placeholder:** Regular, ~14px, sans-serif

### Iconography
- Search input icon: Magnifying glass, line-style, ~14px
- Close button: × character or SVG icon, ~14px
- Radio buttons: Hollow circles ~14–16px, standard HTML radio button style (or custom CSS circles)

### Bottom "Getting Started" Progress Bar
- Not visible in this screenshot (modal is covering the page and the bottom bar is not present or not visible)

---

## State & Data Shown

### Active Record
- **Contact:** Laurie McAdam, person ID `27022` at `ryan-realty.followupboss.com/2/people/view/27022`

### Modal State
- **Open:** "Apply Automation" modal is displayed
- **Search field:** Empty (no query typed) — showing all available automations
- **Selected automation:** None (all radio buttons are in unselected/hollow state)
- **Scroll position:** List appears to be at the top (first item "Stale Lead Engagement" is visible at top)
- **Scrollbar visible:** Yes — indicating 8+ automation items exist and/or the list container has a max-height

### Available Automations (complete visible list):
1. Stale Lead Engagement
2. Buyer Long Term Nurture
3. Open House Follow Up
4. Open House Leads
5. Post Closing Plan
6. Unconverted and active now. Call!
7. Birthday Email - Start by Automations
8. Assign to a lender
(Additional items may exist below — scroll required)

### Account-level automations
These 8 visible items represent the Action Plans / Automations configured in this Ryan Realty FUB account. They reveal the business workflows in use:
- Follow-up for stale/inactive leads
- Long-term buyer nurture drip
- Open house follow-up sequences (two separate: follow-up communications + lead pipeline)
- Post-closing relationship maintenance
- Urgency re-engagement ("Unconverted and active now. Call!")
- Birthday email automation
- Lender assignment workflow

---

## Interactions & Behaviors

### Opening the Modal
- [INFERRED] User clicked an "Apply Automation" or "Start Automation" button from the contact detail page (likely in the contact header action bar, or from a right-click / kebab menu on the contact)
- The modal opens with an animation [INFERRED: fade-in or scale-in transition] and the page behind dims

### Search Field
- Auto-focused on modal open [likely — the teal left-border highlight on q1 suggests it may be focused]
- As user types in "Search automations...", the list filters in real-time to show only matching automation names [INFERRED: client-side substring match on automation name]
- Clearing the search restores the full list

### Selecting an Automation
- User clicks on a radio button circle OR clicks anywhere on the row [INFERRED: entire row is clickable, not just the radio circle]
- The clicked radio button fills/selects (solid circle or checked state)
- Only one automation can be selected at a time (single-select radio group)
- [INFERRED] The "Apply" button may become more visually prominent (full opacity) only after a selection is made — or it may always appear active and show a validation message if clicked without a selection

### "Apply" Button
- Clicking "Apply" with a selected automation:
  1. Sends a POST/PUT request to the FUB API to enroll the contact in the selected automation [INFERRED]
  2. The automation's first action plan step is queued or immediately executed
  3. [INFERRED] A success notification or toast appears ("Automation applied" or similar)
  4. Modal closes
  5. The contact's timeline/activity feed likely shows a new event: "Automation started: [Name]" [INFERRED]
- Clicking "Apply" with NO selection: [INFERRED] Either shows validation error or is disabled

### "Cancel" Button
- Closes the modal without applying any automation
- Returns user to the contact detail page (no change to contact record)

### "×" Close Button (top-right)
- Same behavior as "Cancel" — dismisses modal without applying

### Scrim Click
- [INFERRED] May dismiss modal (common UX pattern) OR may require explicit Cancel/× click

### Scroll within List
- The thin scrollbar on the right of the list allows scrolling to see additional automations below "Assign to a lender"
- Mouse wheel / touch scroll within the list container scrolls the list [INFERRED]

---

## Data Model Signals

### Entities Revealed
- **Person** (`people` table): ID `27022`, Name "Laurie McAdam" — the contact this automation is being applied to
- **Automation / Action Plan** entity: Has at minimum:
  - `id` (internal identifier)
  - `name` (string — the visible label, e.g. "Stale Lead Engagement")
  - `type` or `category` (buyer/seller/open house/post-close — implied by names)
  - Belongs to an **Account** (ryan-realty — tenant-scoped)
- **Enrollment / Automation Assignment** (join entity): Created when Apply is clicked:
  - `person_id` → references person (27022)
  - `automation_id` → references the selected automation
  - `enrolled_at` (timestamp)
  - `enrolled_by` (user who applied it — Matt Ryan in this case)
  - `status` (active/paused/completed/stopped) [INFERRED]

### Enum Values (Automation Names as configured in this account)
- "Stale Lead Engagement" — re-engagement drip for inactive leads
- "Buyer Long Term Nurture" — long-duration buyer nurture sequence
- "Open House Follow Up" — post-open-house communication sequence
- "Open House Leads" — pipeline/intake automation for open house leads
- "Post Closing Plan" — post-transaction relationship sequence
- "Unconverted and active now. Call!" — urgency/re-engagement with call task
- "Birthday Email - Start by Automations" — birthday recognition email triggered by the automation engine
- "Assign to a lender" — workflow to route lead to a lender partner

### Relationships
- A Person can be enrolled in one or more Automations (applying a new one does not necessarily cancel existing ones — [INFERRED])
- Automations belong to an Account (tenant), not to an individual agent
- An Automation enrollment is associated with the agent who applied it (audit trail)

---

## Rebuild Notes

### Component Breakdown

```tsx
// Page-level — the background contact detail page with scrim
<ContactDetailPage personId={27022}>
  <Scrim isVisible={isModalOpen} />  {/* dark semi-transparent overlay */}
  <ApplyAutomationModal
    isOpen={isModalOpen}
    personId={27022}
    onClose={() => setIsModalOpen(false)}
    onApply={(automationId) => applyAutomation(personId, automationId)}
  />
</ContactDetailPage>

// Modal component
<ApplyAutomationModal>
  <ModalHeader>
    <ModalTitle>Apply Automation</ModalTitle>
    <CloseButton onClick={onClose}>×</CloseButton>
  </ModalHeader>

  <ModalBody>
    <SearchInput
      placeholder="Search automations..."
      icon={<SearchIcon />}
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      autoFocus
    />

    <AutomationList>
      {filteredAutomations.map((automation) => (
        <AutomationListItem
          key={automation.id}
          selected={selectedId === automation.id}
          onClick={() => setSelectedId(automation.id)}
        >
          <RadioCircle selected={selectedId === automation.id} />
          <AutomationName>{automation.name}</AutomationName>
        </AutomationListItem>
      ))}
    </AutomationList>
    {/* Scrollbar appears when list height exceeds ~280px container */}
  </ModalBody>

  <ModalFooter>
    <CancelButton variant="ghost" onClick={onClose}>Cancel</CancelButton>
    <ApplyButton
      variant="filled"
      color="teal"
      disabled={!selectedId}
      onClick={() => onApply(selectedId)}
    >
      Apply
    </ApplyButton>
  </ModalFooter>
</ApplyAutomationModal>
```

### Key Implementation Details

1. **Modal width:** Approximately 210px actual (or ~380–420px if the full viewport scale is considered; the modal appears to be about 28% of the ~760px viewport). More likely the modal is ~380px wide based on typical FUB modal sizing.

2. **Search filtering:** Client-side — filter `automations` array by `name.toLowerCase().includes(query.toLowerCase())`. No debounce needed for small lists.

3. **Automation list scroll container:**
   - `max-height: ~240–260px` (showing ~7–8 items at ~36px each)
   - `overflow-y: auto` or `overflow-y: scroll`
   - The visible scrollbar suggests `overflow-y: scroll` is always shown, or the list has more items than fit

4. **Radio button styling:** Custom CSS circles — not native `<input type="radio">`. Unselected = `border: 2px solid #ccc; border-radius: 50%; width: 16px; height: 16px`. Selected = filled circle with teal/blue fill.

5. **Apply button — pill shape:** `border-radius: 20px` (or `border-radius: 9999px`), background `#1aa3c9` (FUB brand teal), white text.

6. **Modal entry animation:** [INFERRED] `transform: scale(0.95) → scale(1)` with `opacity: 0 → 1`, duration ~150–200ms.

7. **API call on Apply:** POST to FUB API — something like:
   - `POST /api/v1/actionPlans/enrollments` with body `{ personId: 27022, actionPlanId: <selectedId> }`
   - Or via FUB's internal endpoint pattern

8. **Automations data source:** Fetched from FUB API on modal open (or pre-loaded):
   - `GET /api/v1/actionPlans` returns the list of all configured automations for the account
   - Response includes `id`, `name`, possibly `description`, `stepCount`, `isActive`

9. **Empty state:** [INFERRED] If search query matches no automations, show "No automations found" text in the list area.

10. **Scrim z-index layering:**
    - Base page: z-index 0–10
    - FUB right panel icons: z-index ~100
    - Modal scrim: z-index ~1000
    - Modal dialog: z-index ~1001

11. **Keyboard behavior:** [INFERRED]
    - `Escape` key → close modal (Cancel behavior)
    - `Enter` key → Apply if selection made
    - `Tab` → cycle through: search input → list items → Cancel → Apply
    - Arrow keys within list → navigate radio options

12. **Accessibility:** Radio group should have `role="radiogroup"` with `aria-label="Select an automation"`. Each item `role="radio"` with `aria-checked`. Modal should have `role="dialog"` with `aria-modal="true"` and `aria-labelledby` pointing to the title.
