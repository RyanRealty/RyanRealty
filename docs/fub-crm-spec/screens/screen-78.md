<!-- AUTO-GENERATED visual appendix entry. Source of truth: high-res vision analysis of the screenshot. -->
<!-- Original capture: Screenshot 2026-06-30 at 6.37.41 AM.png | Sequential id: shot-78 | Tiles: fub-tiles/shot-78_{full,q1,q2,q3,q4}.png -->

# shot-78 — Add Person Modal (on All People List)

## Identity
- **Visible URL:** `ryan-realty.followupboss.com/2/people?sort=-lastLeadActivity`
- **Browser tab title:** "People – Follow Up Boss"
- **Second browser tab:** "Smart Lists Overview – Follo..." (another FUB tab open, inactive)
- **Top-nav active item:** "People" (leftmost item after the hamburger/logo icon, rendered white/highlighted)
- **Sub-nav / tab active:** None (this is the flat People list view, not a sub-tabbed detail)
- **Breadcrumbs:** None visible — page title "All People" serves as context anchor
- **Left-rail selected item:** "All People" (highlighted with navy/blue background, badge "17K")
- **Logged-in user:** Matt Ryan — avatar photo visible in top-right corner of the top nav bar; email signature in the compose panel (bottom-right quadrant) reads "Matt Ryan / Owner & Principal Broker - Ryan Realty LLC / 541.703.3095 / matt@ryan-realty.com / ryan-realty.com"
- **Account/Brokerage name:** Ryan Realty LLC (visible in Matt's email signature block)
- **Primary interaction:** "Add Person" modal dialog is open and overlays the center/main content area

---

## Layout

The screen has four distinct regions rendered simultaneously:

### 1. Top Navigation Bar (~48px tall, full width, fixed)
Dark charcoal/near-black background. Contains: hamburger/logo icon, primary nav items (People, Inbox, Tasks, Calendar, Deals, Reporting, Admin), a global search bar, and right-side utility icons (SMS/chat, notifications bell, user avatar).

### 2. Left Rail (~215px wide, full height, fixed/scrollable within)
White background. Contains:
- "People" section header with icon and badge (187 — a count of something, partially visible)
- "All People" list item (active, navy highlight, 17K badge)
- **COLLECTIONS** section header
  - "Pipeline" collection (collapsible, currently expanded, showing collapse arrow)
    - Smart list items with colored flame/star icons and numeric badges
  - "Neighborhoods" collection (collapsed, 12K badge, expand arrow)
- **SMART LISTS** section header
  - Multiple smart list items with badges
- "Manage" link at bottom of smart list section

### 3. Center Main Content Area (remaining width ~55% of viewport, scrollable)
White background. Behind the modal it shows:
- Page heading "All People" (with people icon)
- Toolbar row: "Showing 874 people" + icon actions + smart-list context links + column controls + filter chip + filter button
- Contacts table with column headers: Name, Lead Score, Ag[ent], Last Activity (sorted desc), email column, phone column
- Rows of contact records (partially dimmed/blurred behind modal overlay)

### 4. Right Compose Panel (~30% of viewport width, full height, visible behind modal)
Light gray/white background. An email compose interface is open as a right-side panel. Contains: To, Subject fields, rich-text toolbar, email body with Matt Ryan's signature block, bottom action bar (Attachments, Templates, Send Email button).

### 5. Add Person Modal (center overlay, ~480px wide, ~300px tall, floating above all content)
White card with drop shadow. Rendered centered horizontally, roughly upper-center of the viewport. The backdrop (all underlying content) is dimmed with a semi-transparent overlay.

---

## Every UI Element (Exhaustive)

### Top Navigation Bar (dark bar, full width)

**Left side:**
- Hamburger/FUB logo icon — square icon, white glyph on dark background (≈24px), far left; [INFERRED] opens/collapses left rail or main menu
- **"People"** nav item — white text, active/selected state (no underline visible but appears as the active route)
- **"Inbox"** nav item — with a notification bell icon to its left; text label "Inbox"
- **"Tasks"** nav item — with a checklist/checkbox icon
- **"Calendar"** nav item — with a calendar grid icon
- **"Deals"** nav item — with a handshake or dollar-sign icon
- **"Reporting"** nav item — with a bar-chart icon
- **"Admin"** nav item — with a gear/wrench icon

**Center:**
- **Search bar** — rounded pill shape, placeholder "Search", magnifying glass icon on left; spans ~200px width; clicking likely opens a global search overlay [INFERRED]

**Right side (from q2):**
- SMS/chat bubble icon (circular icon, possibly "SMS" or "Conversations")
- Chat/message icon (second icon)
- People/contacts icon (third icon)
- Bell notification icon
- User avatar — circular headshot photo of Matt Ryan

### Left Rail

**Section: People**
- Header: "People" (text label, small, gray/muted)
- **"All People"** — list item, currently active (navy/blue filled background highlight), white text, badge pill showing **"17K"** (total contacts in system) on the right edge

**Section header: COLLECTIONS** (uppercase, small gray label)

**"Pipeline"** — collection group header with folder/collection icon, chevron-down indicating expanded state, no badge on header itself
  - **"Active & Pending Clients"** — 🔥 flame icon (orange/red), badge **"8"**
  - **"Hot/Weekly"** — 🔥 flame icon (orange/red), badge **"2"**
  - **"Warm/Bi-Weekly"** — ☀️ sun or warm icon (yellow/orange), no visible badge (or badge not shown)
  - **"Past Clients/Sphere: Quarterly"** — ⭐ star icon (gold/yellow), badge **"18"**
  - **"New Leads: No Call Attempt"** — icon (appears to be a lightning bolt or person icon), no badge visible
  - **"Cold/Bi-Monthly"** — ❄️ snowflake or cold icon (blue), badge **"44"**
  - **"Old Leads: No Call Attempt"** — 🔥 or similar icon, badge **"7K"**

**"Neighborhoods"** — collection group header with folder icon, badge **"12K"**, chevron-right indicating collapsed state

**Section header: SMART LISTS** (uppercase, small gray label)

- **"All Recent Online Activity"** — funnel/filter icon, badge **"3"**
- **"All Expireds"** — funnel/filter icon, badge **"637"**
- **"Expired No Contact"** — funnel/filter icon, badge **"137"**
- **"Absentee Owners"** — funnel/filter icon, badge **"805"**
- **"Absentee Owners No Contact"** — funnel/filter icon, badge **"550"**
- **"Matts Sphere"** — funnel/filter icon, badge **"1K"**
- **"All Clients"** — funnel/filter icon, badge **"23"**
- **"Realtors"** — funnel/filter icon, no badge visible
- **"Migration Realtors"** — funnel/filter icon, no badge visible
- **"FSBO"** — funnel/filter icon, badge **"16"**
- **"TCPA Litigators — Hard Stop"** — funnel/filter icon, badge **"132"**
- **"Manage"** — gear/settings icon, text link at bottom of smart lists section; [INFERRED] navigates to smart list management screen

### Center Main Content — Toolbar Row

- **"All People"** — page H1 with a people/group icon (two silhouettes) to its left
- **"Showing 874 people"** — plain text count, left-aligned below heading
- **Action icon row** (small icon buttons, right of count label):
  - Envelope icon — [INFERRED] bulk email selected contacts
  - Person-plus icon — add person (same action as the modal currently open)
  - Pin/bookmark icon — [INFERRED] pin/save current view
  - Trash/delete icon — [INFERRED] bulk delete
  - Download/export icon — [INFERRED] export contacts to CSV
- **"How Smart Lists work"** — text link with question-circle icon; [INFERRED] opens help documentation or tooltip
- **"Columns"** button — with a columns/grid icon and dropdown chevron; [INFERRED] opens column picker to show/hide/reorder table columns
- **"Out Of State Home ..."** — filter chip (active, shows a truncated filter name); clicking likely opens filter editor or removes filter [INFERRED]
- **"Filters"** button — with funnel icon; [INFERRED] opens filter sidebar panel
- **"+ New List"** button — blue/primary outlined or filled button, top-right of center content; [INFERRED] creates a new Smart List from current filters

### Center Main Content — Contacts Table

**Column headers (left to right):**
1. Checkbox column (for bulk selection) — unchecked header checkbox
2. **"Name"** — text, no sort indicator visible (or default sort)
3. **"Lead Score"** — text, no sort indicator visible
4. **"Ag..."** — truncated; likely "Agent" or "Assigned Agent" — column too narrow to show full label
5. **"Last Activity"** — text with a sort arrow (↓ down arrow = sorted descending)
6. (Unlabeled) — appears to be email address column
7. (Unlabeled) — appears to be phone number column

**Representative rows visible (sorted by -lastLeadActivity, newest first):**

| # | Avatar | Name | Source Tag | Lead Score | Last Activity | Phone |
|---|--------|------|------------|------------|---------------|-------|
| 1 | TH (teal circle) | Timothy Hull | Import | 2 | (activity text about viewing pages) | — |
| 2 | JM (purple circle) | John Mackay | Import | 4 | (activity text) | — |
| 3 | RF (blue circle) | Ryan Ford | Import | 2 | (activity text) | — |
| 4 | CB (teal circle) | Carole Biau | Import | 4 | — | — |
| 5 | RL (red circle) | Richelle Luther | Farm | 5 | Feb 19th '26 | 📱 (503) 679-9963 |
| 6 | SL (orange circle) | Schiemer Living Trust | Farm | 4 | Feb 9th '26 | 📞 (541) 382-1470 |
| 7 | TC (teal circle) | Timothy Cundari | Farm | 2 | Feb 9th '26 | 📱 (503) 887-5... |
| 8 | A (green circle) | Asevedo | Farm | 5 | Feb 3rd '26 | 📞 (541) 408-6... |
| 9 | C (navy circle) | Crew | Expired Listing | 2 | Dec 27th '25 | 5414806025 |
| 10 | CT (pink circle) | Charissa Toney Living Trust | Expired Listing | 3 | Dec 27th '25 | 📱 (541) 550-S... |
| 11 | LW (teal circle) | Lajuana West | Farm | 2 | Dec 27th '25 | 📞 (541) 382-8... |
| 12 | AJ (orange circle) | Ann Jean | Farm | 1 | Dec 27th '25 | 📞 (541) 490-4... |
| 13 | JB (blue circle) | Jason Bethers | Import | 4 | Dec 27th '25 | 📞 (541) 788-4... |
| 14 | CK (purple circle) | Crosby Kendall | Import | 3 | Dec 27th '25 | 📞 (541) 419-0... |
| 15 | LR (dark blue circle) | Lucas Roth | Import | 4 | Dec 27th '25 | 📞 (503) 510-5... |
| 16 | BW (partial) | Birt Wilder | (partial) | 4 | (partial) | (partial) |

**Avatar style:** Two-letter initials on a colored circle background. Colors appear to be assigned by contact (consistent per contact, not random). Approximately 32–36px diameter circles.

**Source tags:** Rendered as small text labels below the contact name (same row), slightly muted color (gray). Values seen: "Import", "Farm", "Expired Listing".

**Last Activity column:** Shows either a date like "Feb 19th '26" or "Dec 27th '25" (truncated date format: Mon DDth 'YY), OR shows an activity description like "Viewed Central Oregon Real Estate Experts in Ben[d...]" (website page view tracking). The date appears alongside a clock/timer icon (⏱).

**Phone number column:** Each phone has two icon indicators to the left: 
- A green circle with phone handset (📞) indicating landline-callable
- A green circle with mobile/text bubble (📱) indicating cell/SMS-capable
- These two icons appear together before each phone number
- Some rows show a raw number without formatting (e.g., "5414806025" for "Crew")
- Most show formatted: "(503) 679-9963", "(541) 382-1470", etc.

**Email column (partially visible in q4):** Shows email addresses such as:
- ...@wwt.com
- ...lerhull.com
- ...edu
- ...institute.org
- Rluther@columbia.com
- Jaredschiemer@gmail.com
- Timcundari@...
- Tasevedo@ibcloud(?)
- Mach@ibcloud(?)
- Machin@gmail.com
- ...@Gmail.com
- ...@Gmail.com
- ...@Gmail.com

**Row interaction:** [INFERRED] Clicking a row navigates to the contact's detail page. Hovering a row likely reveals inline action icons (call, text, email). No bulk-selection checkboxes visibly checked.

**Pagination / scroll:** No explicit pagination controls visible; list appears to scroll infinitely or use virtual scroll. "Showing 874 people" count at top.

**Sort:** Currently sorted by "Last Activity" descending (↓ arrow on column header). URL param confirms: `?sort=-lastLeadActivity`

### Right Email Compose Panel (visible behind/beside modal)

**Panel location:** Right ~30% of viewport, rendered as a side panel

**Fields:**
- **"To:"** — text/chip input; appears to have recipient(s) entered (text present but obscured by modal)
- **"Subject:"** — text input; value appears empty or contains text not fully readable

**Rich-text toolbar (icon row between subject and body):**
- **B** — Bold
- **/** — Italic or divider
- **I** — Italic
- **U** — Underline
- **+** — Insert element
- Emoji picker icon
- Attachment/paperclip icon
- Additional formatting icons (approximately 10–12 total icon buttons in a row)

**Body area:** Currently shows Matt Ryan's pre-loaded email signature:
- Headshot photo of Matt Ryan (circular or rounded-square crop, professional photo)
- **"Matt Ryan"** (name, bold)
- **"Owner & Principal Broker - Ryan Realty LLC"** (title line)
- **"541.703.3095"** (phone — FUB tracking number)
- **"matt@ryan-realty.com"** (email)
- **"ryan-realty.com"** (website)
- Tagline: "Building community through authentic relationships and exceptional customer service"
- **"Read our Google reviews"** — blue hyperlink
- **"Oregon Annual Income Disclosure Reminder"** — section header or link
- Sub-text: "...a Redfin affiliate under common ownership entities" (partial, a disclosure notice about partnership/affiliation)
- Ryan Realty LLC logo/branding mark (small, visible in signature block)

**Bottom action bar:**
- **"Attachments"** — button or text link with paperclip icon; [INFERRED] opens file picker to attach files
- **"Templates"** — button or text link; [INFERRED] opens email template picker
- **"Send Email"** — primary blue filled button, bottom-right; [INFERRED] sends the email and logs it to the contact's timeline
- **"?"** — circular help button, far bottom-right corner; [INFERRED] opens contextual help

### Add Person Modal (primary focus of this screenshot)

**Modal chrome:**
- White card background
- Rounded corners (~8–12px radius)
- Drop shadow to separate from dimmed backdrop
- Modal approximate width: ~480px
- **"×"** close button — top-right corner, gray text/icon; closes modal without saving [INFERRED]

**Modal header:**
- Person-plus icon (silhouette with + symbol) — ~20px, gray/dark
- **"Add Person"** — header text, ~18px, dark/black, bold or semi-bold
- Both icon and title appear on the same line, left-aligned

**Form fields (top to bottom, left to right):**

**Row 1 — Two-column layout:**
- **"First Name"** — text input, placeholder text "First Name", ~50% width; currently empty
- **"Last Name"** — text input, placeholder text "Last Name", ~50% width; currently empty

**Row 2 — Full width:**
- **"Email"** — text input, placeholder text "Email"; currently empty; type="email" [INFERRED]

**Row 3 — Full width:**
- **"Phone"** — text input, placeholder text "Phone"; currently empty; type="tel" [INFERRED]

**Row 4 — Full width:**
- **"Select a lead source"** — dropdown/select input; placeholder text "Select a lead source"; chevron-down arrow on right; currently no value selected; [INFERRED] options include values like Import, Farm, Zillow, Realtor.com, Website, Manual, Referral, etc. (standard FUB lead sources)

**Modal footer — two buttons:**
- **"Cancel"** — ghost/text button, left-aligned or right-of-center; gray text; clicking closes modal without saving
- **"Add person"** — primary CTA button, blue filled background, white text; appears slightly muted/disabled state (fields are empty so form is not yet valid); clicking (once form is valid) submits the form and creates the new contact [INFERRED]

**Validation:** [INFERRED] At minimum, First Name or Email is likely required before "Add person" button becomes active/enabled. Phone and Lead Source appear optional at creation time.

### Filter Panel (right side, behind modal — "Add a filter" empty state)

- **"Add a filter"** — text link or button at top
- **"No filters added yet"** — empty state text with a small filter/funnel icon above it
- This appears to be a filter sidebar panel that's open, showing no active filters (separate from the "Out Of State Home..." chip filter visible in the toolbar, which may be a collection/smart-list filter rather than an ad-hoc filter)

---

## Colors, Typography & Style

**Top nav bar:** Very dark charcoal, approximately `#1a1a1a` or `#222222`. White text for nav labels.

**Left rail background:** White (`#ffffff`) with light gray borders/dividers.

**Left rail active item (All People):** Navy blue fill, approximately `#2563eb` or FUB's brand navy (`#1E3A5F` or similar). White text.

**Left rail inactive items:** Dark gray text (`#374151` range), no background.

**Collection/Smart List badges:** Rounded pill, gray background (`#e5e7eb` range), dark gray text. Numbers inside.

**Main content background:** White.

**Table header row:** Light gray background or just slightly heavier text weight, no heavy line.

**Table rows:** White background, light gray (`#f9fafb`) alternating possible [INFERRED], thin `1px` gray bottom border per row.

**Avatar circles:** Various hues assigned per contact — teal, purple, blue, red, orange, navy, pink, green. Initials in white text.

**Source tags (below name in row):** Small, muted gray text, 11–12px.

**Lead Score column:** Numeric value, plain text, centered or left-aligned.

**Phone icons:** Green filled circles with white glyph inside — two icons per phone (landline + mobile). Green is approximately `#16a34a` or `#22c55e`.

**Modal background:** Pure white `#ffffff`.

**Modal "Add person" button:** Blue filled, approximately `#2563eb` (FUB brand blue). White text. Slightly reduced opacity when form is invalid/empty (disabled state).

**Modal "Cancel" button:** No background, gray text, ghost style.

**Rich text toolbar icons:** Gray glyphs on white background, small (16–18px each).

**"Send Email" button:** Blue filled, same brand blue as primary buttons, white text.

**Typography:** 
- Nav labels: ~13–14px, medium weight (500), white on dark
- Left rail items: ~13–14px, regular weight (400), dark gray
- Page title "All People": ~20–22px, semi-bold (600)
- Table column headers: ~12–13px, medium weight (500), gray
- Table cell content: ~13–14px, regular (400), dark gray for names, lighter gray for source tags
- Modal header "Add Person": ~16–18px, semi-bold (600)
- Modal input placeholders: ~14px, light/muted gray
- Badges: ~11–12px, medium weight, dark gray text

**Iconography style:** Outline/stroke icons, single color, ~16–20px. Consistent with Lucide or Heroicons style.

**Border radius:**
- Modal: ~8–12px
- Input fields: ~4–6px
- Buttons: ~4–6px
- Avatar circles: 50% (fully circular)
- Badge pills: fully rounded

**Density:** Medium-compact. Table rows approximately 52–56px tall. Modal inputs ~36–40px tall.

**Bottom "Getting Started" green progress bar:** Not visible in this screenshot.

---

## State & Data Shown

**Active list/view:** "All People" — the root/unfiltered view of all contacts in the system
**Active sort:** `sort=-lastLeadActivity` (Last Activity, descending — newest activity first)
**Total count:** 874 people shown ("Showing 874 people")
**Active filter:** "Out Of State Home..." chip is active (a smart list or collection filter is applied that narrows from 17K total to 874; the filter appears to select out-of-state home leads)
**Modal state:** Open (Add Person form), all fields empty, no values entered

**Sample data revealed:**
- Contact names: Timothy Hull, John Mackay, Ryan Ford, Carole Biau, Richelle Luther, Schiemer Living Trust (entity), Timothy Cundari, Asevedo (surname only), Crew (surname only), Charissa Toney Living Trust (entity), Lajuana West, Ann Jean, Jason Bethers, Crosby Kendall, Lucas Roth, Birt Wilder
- Lead sources (enum values): **Import**, **Farm**, **Expired Listing** (visible in this view)
- Lead Score values: 1, 2, 3, 4, 5 (integer scale, appears 1–10 or 1–5)
- Last Activity dates: Feb 19th '26, Feb 9th '26, Feb 3rd '26, Dec 27th '25 (format: "Mon DDth 'YY")
- Last Activity types: "Viewed Central Oregon Real Estate Experts in Bend..." (website page view, tracked via pixel/integration)
- Phone numbers: (503) 679-9963, (541) 382-1470, (503) 887-5..., (541) 408-6..., 5414806025 (unformatted), (541) 550-S..., (541) 382-8..., (541) 490-4..., (541) 788-4..., (541) 419-0..., (503) 510-5...
- Email addresses: ...@wwt.com, Rluther@columbia.com, Jaredschiemer@gmail.com
- Lead phone types: two indicator icons per phone number — green circle with handset (landline/callable) + green circle with speech bubble (mobile/textable)
- Smart lists contain: 17K total all-people, 637 expireds, 805 absentee owners, 132 TCPA Litigators, 1K Matts Sphere, 7K old leads no call attempt

---

## Interactions & Behaviors

**Add Person modal:**
- Triggered by clicking the person-plus icon in the "All People" toolbar (bulk-action area above the table)
- [INFERRED] Also triggerable via a "+ Add Person" button elsewhere (possibly top-right area)
- **First Name / Last Name inputs:** Free text. [INFERRED] At least one of First Name or Email is required; form validation prevents submission if both are empty.
- **Email input:** type="email", validates format on blur [INFERRED]
- **Phone input:** type="tel" or plain text; [INFERRED] formats/validates as US phone on blur
- **"Select a lead source" dropdown:** Clicking opens a popover/dropdown with list of lead source options (Import, Farm, Zillow, Realtor.com, Facebook, Referral, Manual, etc.) [INFERRED from FUB conventions]
- **"Cancel" button:** Closes modal immediately, no changes saved, no confirmation prompt [INFERRED]
- **"Add person" button:** 
  - Disabled (grayed/muted) when required fields are empty [INFERRED]
  - On click with valid data: POSTs to FUB API to create new person record, closes modal, [INFERRED] navigates to the newly created contact's detail page or refreshes the list with new contact
- **"×" close button:** Same behavior as Cancel [INFERRED]
- **Backdrop click:** [INFERRED] May close modal (or may not, requiring explicit Cancel/×)
- **Escape key:** [INFERRED] Closes modal

**People list interactions:**
- **Row click:** [INFERRED] Navigates to contact detail page (`/2/people/<id>`)
- **Column header click:** [INFERRED] Sorts by that column (toggle asc/desc). "Last Activity" currently sorted desc.
- **Bulk action icons** (envelope, person+, pin, trash, export): [INFERRED] Require selecting rows via checkboxes first (except person+ which opens this Add Person modal without needing a selection)
- **"Columns" button:** [INFERRED] Opens a dropdown/popover to show/hide/reorder columns
- **"Filters" button:** [INFERRED] Opens the right-side filter panel (currently showing "No filters added yet" empty state)
- **"Out Of State Home..." chip:** [INFERRED] Click to edit or remove this active filter; the "×" on the chip removes it
- **"+ New List" button:** [INFERRED] Opens a modal or inline form to name and save the current filter combination as a new Smart List
- **Left rail smart list items:** Click to filter the center table to that list's contacts
- **Left rail collection items:** Click to navigate into that collection (Pipeline > Hot/Weekly, etc.)
- **"Manage" link:** [INFERRED] Navigates to smart list management/admin page

**Email compose panel interactions:**
- **"To:" field:** Type name or email to search/add recipients; [INFERRED] autocompletes from contact records
- **"Subject:" field:** Free text
- **Rich text toolbar:** Standard formatting (Bold, Italic, Underline, emoji, attachment, etc.)
- **"Templates" button:** [INFERRED] Opens email template picker modal
- **"Attachments" button:** [INFERRED] Opens file picker
- **"Send Email" button:** [INFERRED] Sends email, logs it to contact timeline, closes compose panel
- **"?" button:** [INFERRED] Opens contextual help

---

## Data Model Signals

**Person entity fields revealed:**
- `firstName` (string)
- `lastName` (string)
- `email` (string, email format)
- `phone` (string, phone format)
- `leadSource` (enum: "Import", "Farm", "Expired Listing", and others via dropdown)
- `leadScore` (integer, range appears 1–5 or 1–10)
- `lastLeadActivity` (timestamp, used as sort key)
- `assignedAgent` (FK to agent/user — "Ag..." column)
- Avatar/initials generated from firstName+lastName

**Phone entity sub-fields:**
- `isLandline` (boolean → green handset icon indicator)
- `isMobile` / `isSmsCapable` (boolean → green speech-bubble/mobile icon indicator)

**Lead Source enum values (confirmed visible):** `Import`, `Farm`, `Expired Listing`
**Lead Source enum values (inferred from dropdown):** `Zillow`, `Realtor.com`, `Facebook`, `Referral`, `Manual`, `Website`, `Google`, `Other`

**Smart List entity:**
- `name` (string)
- `count` (integer — badge displayed)
- `filters` (array of filter conditions)
- `collectionId` (FK to Collection — for Pipeline, Neighborhoods groupings)

**Collection entity:**
- `name` (string: "Pipeline", "Neighborhoods")
- `isExpanded` (boolean UI state)
- `count` (integer — badge on header)

**Activity/Timeline event (implied by "Last Activity" column):**
- `type` (e.g., "page_view")
- `description` (e.g., "Viewed Central Oregon Real Estate Experts in Bend")
- `timestamp`
- `contactId` (FK to Person)

**Phone type indicators suggest a separate phone lookup/validation service** (e.g., Twilio Lookup or similar) enriches phone records with `type: landline|mobile|voip`.

---

## Rebuild Notes

### Component Breakdown

```
<PeoplePage>
  <TopNavBar active="people">
    <NavLogo />
    <NavItem label="People" href="/2/people" active />
    <NavItem label="Inbox" href="/2/inbox" badgeCount={?} />
    <NavItem label="Tasks" href="/2/tasks" />
    <NavItem label="Calendar" href="/2/calendar" />
    <NavItem label="Deals" href="/2/deals" />
    <NavItem label="Reporting" href="/2/reporting" />
    <NavItem label="Admin" href="/2/admin" />
    <GlobalSearch placeholder="Search" />
    <NavIconSMS />
    <NavIconNotifications />
    <UserAvatar name="Matt Ryan" />
  </TopNavBar>

  <LeftRail>
    <LeftRailSection label="People">
      <LeftRailItem label="All People" badge={17000} active href="/2/people" />
    </LeftRailSection>

    <LeftRailSection label="COLLECTIONS">
      <CollectionGroup label="Pipeline" expanded>
        <SmartListItem label="Active & Pending Clients" icon="flame-hot" badge={8} />
        <SmartListItem label="Hot/Weekly" icon="flame-hot" badge={2} />
        <SmartListItem label="Warm/Bi-Weekly" icon="flame-warm" />
        <SmartListItem label="Past Clients/Sphere: Quarterly" icon="star" badge={18} />
        <SmartListItem label="New Leads: No Call Attempt" icon="person" />
        <SmartListItem label="Cold/Bi-Monthly" icon="snowflake" badge={44} />
        <SmartListItem label="Old Leads: No Call Attempt" icon="flame" badge={7000} />
      </CollectionGroup>
      <CollectionGroup label="Neighborhoods" collapsed badge={12000} />
    </LeftRailSection>

    <LeftRailSection label="SMART LISTS">
      <SmartListItem label="All Recent Online Activity" badge={3} />
      <SmartListItem label="All Expireds" badge={637} />
      <SmartListItem label="Expired No Contact" badge={137} />
      <SmartListItem label="Absentee Owners" badge={805} />
      <SmartListItem label="Absentee Owners No Contact" badge={550} />
      <SmartListItem label="Matts Sphere" badge={1000} />
      <SmartListItem label="All Clients" badge={23} />
      <SmartListItem label="Realtors" />
      <SmartListItem label="Migration Realtors" />
      <SmartListItem label="FSBO" badge={16} />
      <SmartListItem label="TCPA Litigators — Hard Stop" badge={132} />
      <SmartListItem label="Manage" icon="gear" />
    </LeftRailSection>
  </LeftRail>

  <MainContent>
    <PeopleListHeader>
      <PageTitle icon="people" label="All People" />
      <PeopleCount count={874} />
      <BulkActionBar>
        <IconButton icon="email" title="Email selected" />
        <IconButton icon="person-plus" title="Add person" onClick={openAddPersonModal} />
        <IconButton icon="pin" title="Pin" />
        <IconButton icon="trash" title="Delete selected" />
        <IconButton icon="export" title="Export" />
      </BulkActionBar>
      <SmartListHelp label="How Smart Lists work" />
      <ColumnsButton />
      <FilterChip label="Out Of State Home ..." onRemove={removeFilter} />
      <FiltersButton />
      <NewListButton label="+ New List" />
    </PeopleListHeader>

    <ContactsTable sortField="lastLeadActivity" sortDirection="desc">
      <TableHeader>
        <Col type="checkbox" />
        <Col label="Name" />
        <Col label="Lead Score" />
        <Col label="Agent" />
        <Col label="Last Activity" sortActive sortDirection="desc" />
        <Col label="" /> {/* email */}
        <Col label="" /> {/* phone */}
      </TableHeader>
      {contacts.map(contact => (
        <ContactRow key={contact.id} contact={contact}>
          <ContactAvatar initials={contact.initials} color={contact.avatarColor} />
          <ContactName name={contact.fullName} />
          <SourceTag label={contact.source} />
          <LeadScore score={contact.leadScore} />
          <AgentBadge agent={contact.assignedAgent} />
          <LastActivityCell date={contact.lastActivity} description={contact.lastActivityDescription} />
          <EmailCell email={contact.email} />
          <PhoneCell phone={contact.phone} isLandline={contact.phoneIsLandline} isMobile={contact.phoneIsMobile} />
        </ContactRow>
      ))}
    </ContactsTable>
  </MainContent>

  <EmailComposePanel open>
    <ComposeField label="To" type="recipient-chips" />
    <ComposeField label="Subject" type="text" />
    <RichTextToolbar />
    <EmailBody>
      <EmailSignature broker="Matt Ryan" />
    </EmailBody>
    <ComposeActions>
      <AttachmentsButton />
      <TemplatesButton />
      <SendEmailButton />
    </ComposeActions>
  </EmailComposePanel>

  <FilterSidePanel>
    <FilterEmptyState label="No filters added yet" />
    <AddFilterButton />
  </FilterSidePanel>

  {/* Modal overlay */}
  <ModalBackdrop dimmed>
    <AddPersonModal onClose={closeModal} onSubmit={createPerson}>
      <ModalHeader icon="person-plus" title="Add Person" />
      <CloseButton />
      <Form>
        <FormRow columns={2}>
          <TextInput name="firstName" placeholder="First Name" />
          <TextInput name="lastName" placeholder="Last Name" />
        </FormRow>
        <TextInput name="email" type="email" placeholder="Email" />
        <TextInput name="phone" type="tel" placeholder="Phone" />
        <SelectInput name="leadSource" placeholder="Select a lead source" options={leadSourceOptions} />
      </Form>
      <ModalFooter>
        <CancelButton onClick={closeModal} label="Cancel" />
        <PrimaryButton type="submit" label="Add person" disabled={!formValid} />
      </ModalFooter>
    </AddPersonModal>
  </ModalBackdrop>
</PeoplePage>
```

### Non-Obvious Logic

1. **"Showing 874 people" vs "17K" badge:** The 17K is the total database count for All People. The 874 is the result of the active "Out Of State Home..." filter chip being applied. The count label below the heading reflects the filtered result, not total.

2. **Add Person modal trigger:** The person-plus icon in the bulk-action toolbar opens this modal WITHOUT requiring any row selection. It's always clickable regardless of selection state.

3. **Lead Source as required-vs-optional:** In this modal, "Select a lead source" has no asterisk/required marker visible, suggesting it's optional at creation. However, in FUB, manually-created contacts typically get assigned "Manual" or "Import" automatically if no source is selected [INFERRED].

4. **Phone type indicators:** The two green circles before each phone number (handset + speech bubble) come from a phone validation enrichment process (likely run async after contact creation). New contacts won't show these until enrichment completes.

5. **Avatar color assignment:** Colors appear deterministic per contact (not random per session). Likely hashed from contact ID or name. At least 8 distinct hues visible.

6. **"TCPA Litigators — Hard Stop"** smart list with 132 contacts: This is a compliance-critical smart list. The "Hard Stop" naming convention indicates contacts in this list should never receive bulk SMS. UI likely applies visual warnings or blocks SMS actions for these contacts.

7. **Email compose panel co-existing with Add Person modal:** The compose panel is a persistent right-side drawer (possibly for composing an email to an existing contact), open alongside the "All People" list. The Add Person modal opens as a centered overlay on top of everything. These are independent UI states.

8. **Sort persistence via URL:** The sort parameter `?sort=-lastLeadActivity` is reflected in the URL, meaning sort state is shareable/bookmarkable.

9. **"Last Activity" activity type:** The description "Viewed Central Oregon Real Estate Experts in Bend" indicates FUB tracks website page views for contacts (via embedded tracking pixel on ryan-realty.com). This populates the lastLeadActivity field and the activity description in the list.

10. **Modal form submit flow:** On successful "Add person" POST → [INFERRED] modal closes → user is navigated to the new contact's detail page automatically, allowing immediate follow-up action (call, text, assign to action plan).
