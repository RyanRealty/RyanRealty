<!-- Addendum capture 2026-06-30. Fills coverage gaps for: §14/§15 Admin: Phone/Calling/Stages/Appointments -->

# FUB Admin-A Screen Recording — Exhaustive Build Analysis
**Target spec sections:** §14 Phone Numbers Management, §15 Admin: Calling / Stages / Appointment Stages
**Frames:** f01–f08 (8 in order)
**Captured:** 2026-06-30

---

## Frame-by-Frame State Log

### f01 — Context: People / Contact Detail View (pre-Admin)
**What it is:** The user is in the People section, on the contact detail for **Jeanette Argyle**, before navigating to Admin. This is the baseline UI state.

**Top nav bar (full width, dark charcoal #2d3748 approx):**
- Left: compass/home icon | People | Inbox | Tasks | Calendar | Deals | Reporting | Admin
- Center: Search bar (pill, placeholder "Search")
- Right: email icon | chat bubble icon | person-with-checkmark icon | bell icon (notification) | user avatar (Matt Ryan, circular headshot)

**Contact detail — Left panel:**
- Contact initials avatar: "JA" (teal circle)
- Name: **Jeanette Argyle**
- Sub-label: "Last Communication 6 days ago"
- Phone: (503) 713-8662 (mobile)
- Email: Transactions@bridgetownfiles.com
- Address: "Add address" (placeholder link)
- Section: **Relationships** — collapsed, count badge "2" (teal) and "+" add button
- Section: **Details** — expanded:
  - Stage: Lead
  - Assigned to: Matt Ryan
  - Source: Sphere, 8 months ago
  - Price: (empty)
  - Timeframe: (empty)
  - Tags: "Phone Import ×" | "SOI ×" | "+" button (teal)
- Section: **Financing** — visible label, content cut off

**Contact detail — Center panel (active tab: Send Email):**
- Tab bar: "Create Note" | "Send Email" (active, teal underline) | "Text" | "Log Call"
- Right side of tab bar: "How it works" help link (circled i)
- Email compose fields:
  - To: "JA Jeanette Argyle ×" (chip)
  - Subject: (empty field)
  - Template chips: "Introduction" | "Follow Up" | "Still Buying" | "Nurture Lead" | "Custom"
  - Rich-text toolbar: B I U strikethrough | ordered list | unordered list | link | image | emoji | table | source | alignment
  - Body: Shows Matt Ryan email signature block with headshot photo
    - "Matt Ryan — Owner & Principal Broker · Ryan Realty LLC"
    - "541.703.3095"
    - "matt@ryan-realty.com"
    - "Building community through authentic relationships and exceptional customer service."
    - Ryan Realty logo image
    - Links: "Read our Google reviews · Oregon Initial Agency Disclosure Pamphlet"
    - Footer: "Ryan Realty LLC · Oregon Principal Broker #201206613 · Equal Housing Opportunity · Not a solicitation of listings under contract with another broker."
  - CC / BCC links
  - Bottom: "Attachments" | "Templates" icons

**Contact detail — Right panel (sidebar):**
- Navigation: "Person 1 of 4" with left/right arrows
- Section: **Action Plans** (collapsed, chevron)
- Section: **Activity** — expanded
  - "No website activity yet"
- Section: **Tasks** — expanded
  - Lightning bolt icon + "+" button
  - "No upcoming tasks"
- Section: **Appointments** — expanded
  - "+" button
  - "No upcoming appointments"
- Section: **AgentFire FUB Widget** — collapsed
- Section: **Deals** — expanded
  - "+" button
  - "No deals yet"
- Section: **Automations** — partially visible at bottom

---

### f02 — Phone Number Management (fully loaded)
**Navigation:** User clicked Admin in top nav, then selected "Phone Numbers" in the Admin sub-nav.

**Top nav bar:** Same dark bar. "Admin" is highlighted/active.

**Admin sub-nav (white bar, full width):**
Tabs (left to right): Overview | Lead Flow | Groups | Team | Action Plans | Automations | Ponds | Email Templates | Text Templates | Import | Custom Fields | Calling | Stages | **Phone Numbers** (active, teal underline) | More ▾

**Top-right contextual help:** "How Phone Numbers work" — link with circled-i icon

**Top-right secondary action:** "View Business Registration" — teal text link (positioned top-right of page content, above page title)

**Page title:** "Phone Number Management" (H1, dark, left-aligned, ~1.5rem)

---

#### Section A — Number Ports

**Section heading:** "Number Ports" (H2)
**Section description:** "Once your number is ported into Follow Up Boss, it will stop working with your old provider. [Learn more here.]" — "Learn more here." is a teal hyperlink.

**CTA button:** "New Port Request" — pill/rounded, teal background, white text, top-right of this section.

**Info box (light gray border, white bg):**
> "You currently have no active porting requests. To port a number into your account, click **'New Port Request'** above. Need help? [Learn more here.]"

- Text: sentence case
- Bold inline: `"New Port Request"` in double quotes
- Teal link: "Learn more here."

---

#### Section B — Number Parking Lot

**Section heading:** "Number Parking Lot" (H2)
**Section description:** "These numbers will not be able to make or receive calls until assigned to a user or inbox. Once a number is released, you will no longer have access to it."

**Toggle control:** "Parked" | "Released"
- Segmented toggle, two states
- "Released" tab is active/selected (white background, slight elevation)
- "Parked" tab is inactive (gray bg)
- Position: top-right of this section

**Table (Released state — empty):**
| Column | Width |
|--------|-------|
| Phone Number | ~60% |
| Date Released | ~40% |

**Empty state:**
- Magnifying glass icon (small, gray)
- Text: "You have no **released numbers**" — "released numbers" in bold

---

#### Section C — Company

**Section heading:** "Company" (H2)

**Table:**
| Column | Approx width |
|--------|-------------|
| Name | ~40% |
| Phone Number | ~40% |
| Actions | ~20% |

**Row 1 (only row):**
- Name: "Company Number"
- Phone Number: phone handset icon + "(541) 872-3851"
- Actions: "..." (horizontal ellipsis, 3-dot menu)

**Notes:**
- The phone number is formatted with parentheses: `(541) 872-3851`
- The phone handset icon is a small inline SVG, same teal/gray color as the text
- The "..." (kebab-style horizontal ellipsis) is the action trigger; clicking it presumably reveals options (rename, delete, reassign, etc.)

---

### f03 — 404 Error Page
**What it is:** An attempt to navigate to a sub-page that no longer exists or has been moved.

**Content:**
- Warning triangle icon (large, yellow/amber, with exclamation mark)
- Heading: "Oops! We couldn't find the page you're looking for"
- Sub-text: "This page might have been moved, removed or renamed."
- Button: "Go back" (teal, rounded pill)

**Top nav:** Same dark nav. Admin is highlighted.
**Admin sub-nav:** Visible but no tab is underlined/active.

**Trial banner (bottom):** "You have 14 days left on your trial" | "Upgrade Now" button (teal)

---

### f04 — Phone Number Management (returned to same page)
**What it is:** Identical to f02. User navigated back to Phone Numbers after the 404. No state change from f02.

All content identical to f02 analysis above.

---

### f05 — Calling Admin Tab (loading state)
**Navigation event:** User clicked "Calling" in the Admin sub-nav (visible "Clicked" tooltip in top-center of frame).

**Active tab:** "Calling" — teal underline visible in sub-nav

**Admin sub-nav (visible tabs):**
Overview | Lead Flow | Groups | Team | Action Plans | Automations | Ponds | Email Templates | Text Templates | Import | Custom Fields | **Calling** (active) | Stages | Phone Numbers | Tags | More ▾

**Top-right contextual button:** "Admin Overview" (circled-i icon, outlined style)

**Page content:** EMPTY — loading state. Only a tiny diagonal-arrow loading indicator (↗ tick mark style) visible in the center of the content area. Content had not yet rendered when this frame was captured.

**Implication for rebuild:** The Calling admin page exists and is a distinct route. Its content was not captured in a loaded state. Based on FUB's product, this page contains calling settings (e.g., voicemail drop, call recording toggle, caller ID settings, call outcomes, power dialer settings). This page requires a separate recording pass.

---

### f06 — Stages Admin Tab (initial/loading state)
**Navigation event:** User clicked "Stages" in the Admin sub-nav ("Clicked" tooltip visible).

**Active tab:** "Stages" — teal underline

**Top-right contextual link:** "How Stages work" (circled-i icon, teal text)
**Top-right CTA button:** "Add Stage" (teal, rounded pill)

**Page content:** Heading "Stages" (H1, left-aligned) visible. Table/list content not yet rendered (small loading tick in center). No rows visible.

---

### f07 — Stages Admin Tab (fully loaded)
**Navigation event:** Same page as f06, now fully loaded. "Clicked" tooltip still showing (from Calling nav click animation residue).

**Active tab:** "Stages" — teal underline

**Top-right:** "How Stages work" help link | "Add Stage" button (teal pill)

**Page heading:** "Stages" (H1)

**Table structure:**
| Column | Notes |
|--------|-------|
| Stage Name | Left col, ~55% width, with drag handle |
| People | Center col, ~25% width, count as teal linked number |
| Actions | Right col, ~20% width, icon buttons |

**Row anatomy:**
- **Drag handle:** 3×2 grid of dots (⠿ pattern) on the far left of each row — indicates drag-to-reorder is supported
- **Stage Name:** Plain text label
- **People count:** Teal hyperlink number (clicking presumably filters People to that stage)
- **Actions — edit:** Pencil-in-square icon (small, gray, ~16px)
- **Actions — delete:** Trash can icon (small, gray, ~16px)
- Some rows have NO edit/delete icons — these are system-protected stages (see notes below)

**Complete stage list (in display order):**

| # | Stage Name | People Count | Edit | Delete | System-Protected? |
|---|-----------|-------------|------|--------|-------------------|
| 1 | Seller Prospect | 7,523 | yes | yes | no |
| 2 | Lead | 8,243 | no | no | YES — system stage |
| 3 | A - Hot 1-3 Months | 2 | yes | yes | no |
| 4 | B - Warm 3-6 Months | 0 | yes | yes | no |
| 5 | C - Cold 6+ Months | 46 | yes | yes | no |
| 6 | Renter - future buyer | 0 | yes | yes | no |
| 7 | Active Client | 8 | yes | yes | no |
| 8 | Pending | 0 | yes | yes | no |
| 9 | Past Client | 21 | yes | yes | no |
| 10 | Sphere | 0 | yes | yes | no |
| 11 | Archive | 2 | yes | yes | no |
| 12 | Closed | 0 | no | no | YES — system stage |
| 13 | Trash | 47 | no | no | YES — system stage |
| 14 | Real Estate Agent | 2,342 | yes | yes | no |
| 15 | Vendor | 1 | yes | yes | no |
| 16 | Nurture | 0 | yes | yes | no |

**Total stages visible:** 16

**System-protected stages (no edit/delete icons):**
- "Lead" (row 2) — the default intake stage
- "Closed" (row 12) — terminal stage for won/closed contacts
- "Trash" (row 13) — soft-delete holding stage

**People count behavior:**
- Non-zero counts render as teal hyperlinks
- Zero counts render as plain "0" (no link)

**"Add Stage" modal (inferred — not captured in these frames):**
Clicking "Add Stage" presumably opens a modal/sheet with:
- Stage name input
- Color picker (many FUB stages have color-coded dots shown in the People list — the dots are the ⠿ handle color or a separate indicator)

---

### f08 — Appointments Admin Tab (loading state)
**Navigation event:** User clicked into the "Appointments" item (via "More ▾" dropdown or directly). "Clicked" tooltip visible in top-center of frame at approximately where "More ▾" or "Appointments" is located.

**Active tab:** "Appointments ▾" — underlined. Note: this tab has a dropdown chevron (▾), indicating it is a collapsible parent with sub-items. In the nav bar for f08, the visible tabs are:
`Overview | Lead Flow | Groups | Team | Action Plans | Automations | Ponds | Email Templates | Text Templates | Import | Custom Fields | Calling | Stages | Phone Numbers | Tags | Appointments ▾`

The "More ▾" tab that normally occupies that slot has been replaced by "Appointments ▾" — meaning the user accessed it from the "More" dropdown and it is now expanded or promoted to the top-level bar.

**Top-right button:** "Admin Overview" (circled-i icon, outlined style)

**Page content — two section headers visible, both loading:**

#### Section 1: Appointment Types
- Section heading: "Appointment Types" (H2, left-aligned, dark text)
- Content: Loading — small diagonal-tick loading indicator visible, no list rendered

#### Section 2: Appointment Outcomes
- Section heading: "Appointment Outcomes" (H2, left-aligned, dark text)
- Content: Loading — same small diagonal-tick loading indicator, no list rendered

**Implication:** This page has two distinct editors:
1. **Appointment Types** — presumably a list of type labels the user can create/edit/delete (e.g., "Listing Appointment", "Buyer Consult", "Follow-up Call")
2. **Appointment Outcomes** — presumably a list of outcome labels (e.g., "Met", "Set Listing", "No Show", "Rescheduled")

Both sections were still loading when the frame was captured. Actual list content not visible. A separate recording pass is needed to capture the fully-loaded state and any add/edit modals.

---

## Admin Sub-Nav — Complete Tab Inventory

From combining all frames, the full Admin sub-nav contains (left to right):

| Tab | Active in | Notes |
|-----|-----------|-------|
| Overview | (not shown active) | Dashboard |
| Lead Flow | (not shown) | |
| Groups | (not shown) | |
| Team | (not shown) | |
| Action Plans | (not shown) | |
| Automations | (not shown) | |
| Ponds | (not shown) | |
| Email Templates | (not shown) | |
| Text Templates | (not shown) | |
| Import | (not shown) | |
| Custom Fields | (not shown) | |
| Calling | f05 | Content not captured (loading) |
| Stages | f06, f07 | Fully captured |
| Phone Numbers | f02, f04 | Fully captured |
| Tags | (not shown) | Visible in nav |
| More ▾ | — | Dropdown containing at minimum: Appointments |
| Appointments ▾ | f08 | Sub-dropdown; contains Types + Outcomes editors |

**"More ▾" dropdown contents (inferred from f07/f08 nav):**
When "More ▾" is clicked, it reveals additional admin tabs including at least "Appointments". The Appointments item itself has a "▾" chevron indicating it has sub-items (likely "Types" and "Outcomes" as sub-nav items, or they are sections on one page).

**Contextual help links (top-right, per page):**
- Phone Numbers: "How Phone Numbers work" (circled-i)
- Calling: "Admin Overview" (circled-i, outlined button style)
- Stages: "How Stages work" (circled-i)
- Appointments: "Admin Overview" (circled-i, outlined button style)

---

## Global Chrome / Layout

**Top nav bar:**
- Background: dark charcoal (~#2d3748 or similar dark navy)
- Height: ~48px
- Left logo: compass/star icon (FUB brand mark, white)
- Nav items: People, Inbox, Tasks, Calendar, Deals, Reporting, Admin — all white text, no icons except subtle small icons before labels
- Center: Global search bar — pill shape, white bg, magnifying glass icon, placeholder "Search", ~300px wide
- Right cluster (left to right): email/SMS icon | chat bubble icon | team/user icon (with notification dot) | bell icon (notifications, with dot) | user avatar (circular headshot, ~32px)

**Admin sub-nav bar:**
- Background: white
- Border-bottom: 1px light gray
- Height: ~44px
- Tabs: dark text when inactive, teal underline (2–3px) when active
- Tab padding: ~12–16px horizontal
- Font: ~13–14px, medium weight
- Overflow: handled by "More ▾" dropdown for tabs that don't fit the viewport

**Trial banner (bottom of screen, when on trial):**
- Green (#38a169 approx) background, full width, ~44px tall
- Left: × close button
- Text: "You have 14 days left on your trial"
- Right: "Upgrade Now" button (white text, teal pill button)

---

## Component Tree for Rebuild (Phone Number Management)

```
<AdminLayout>
  <TopNav />
  <AdminSubNav activeTab="phoneNumbers" />
  
  <PageContent>
    <PageHeader>
      <h1>Phone Number Management</h1>
      <SecondaryLink href="/admin/business-registration">View Business Registration</SecondaryLink>
    </PageHeader>

    <Section id="number-ports">
      <SectionHeader>
        <h2>Number Ports</h2>
        <Button variant="primary">New Port Request</Button>
      </SectionHeader>
      <p>Once your number is ported into Follow Up Boss, it will stop working with your old provider. <a>Learn more here.</a></p>
      <InfoBox>
        {ports.length === 0
          ? "You currently have no active porting requests. To port a number into your account, click \"New Port Request\" above. Need help? <a>Learn more here.</a>"
          : <PortRequestTable rows={ports} />
        }
      </InfoBox>
    </Section>

    <Section id="number-parking-lot">
      <SectionHeader>
        <h2>Number Parking Lot</h2>
        <SegmentedToggle options={['Parked', 'Released']} value={parkingView} onChange={setParkingView} />
      </SectionHeader>
      <p>These numbers will not be able to make or receive calls until assigned to a user or inbox. Once a number is released, you will no longer have access to it.</p>
      <DataTable
        columns={[
          { key: 'phoneNumber', label: 'Phone Number' },
          { key: 'dateReleased', label: 'Date Released' },
        ]}
        rows={parkingLotNumbers}
        emptyState={<EmptyState icon="search" text="You have no released numbers" />}
      />
    </Section>

    <Section id="company-numbers">
      <SectionHeader>
        <h2>Company</h2>
      </SectionHeader>
      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'phoneNumber', label: 'Phone Number', renderCell: (v) => <><PhoneIcon />{v}</> },
          { key: 'actions', label: 'Actions', renderCell: () => <EllipsisMenu /> },
        ]}
        rows={companyNumbers}
      />
    </Section>

    {/* User Numbers section — not visible in these frames, likely below */}
    {/* Team Inbox Numbers section — not visible in these frames, likely below */}
  </PageContent>
</AdminLayout>
```

---

## Component Tree for Rebuild (Stages)

```
<AdminLayout>
  <TopNav />
  <AdminSubNav activeTab="stages" />

  <PageContent>
    <PageHeader>
      <h1>Stages</h1>
      <Button variant="primary" onClick={openAddStageModal}>Add Stage</Button>
    </PageHeader>

    <DataTable
      draggable           // drag-to-reorder via ⠿ handles
      columns={[
        { key: 'dragHandle', renderCell: () => <DragHandle /> },
        { key: 'name', label: 'Stage Name' },
        { key: 'peopleCount', label: 'People', renderCell: (count, row) =>
            count > 0
              ? <Link to={`/people?stage=${row.id}`}>{count.toLocaleString()}</Link>
              : <span>0</span>
        },
        { key: 'actions', label: 'Actions', renderCell: (_, row) =>
            !row.isSystemProtected
              ? <>
                  <IconButton icon="edit" onClick={() => openEditStageModal(row)} />
                  <IconButton icon="trash" onClick={() => confirmDeleteStage(row)} />
                </>
              : null
        },
      ]}
      rows={stages}
    />
  </PageContent>

  {/* Add/Edit Stage Modal */}
  <Modal isOpen={editModalOpen}>
    <ModalHeader>{ isEditing ? 'Edit Stage' : 'Add Stage' }</ModalHeader>
    <FormField label="Stage Name">
      <TextInput value={stageName} onChange={setStageName} />
    </FormField>
    {/* Color picker likely here — not confirmed from frames */}
    <ModalFooter>
      <Button variant="ghost" onClick={closeModal}>Cancel</Button>
      <Button variant="primary" onClick={saveStage}>Save</Button>
    </ModalFooter>
  </Modal>
</AdminLayout>
```

---

## Component Tree for Rebuild (Appointment Stages)

```
<AdminLayout>
  <TopNav />
  <AdminSubNav activeTab="appointments" />  {/* has dropdown chevron */}

  <PageContent>
    <Section id="appointment-types">
      <SectionHeader>
        <h2>Appointment Types</h2>
        {/* Add button likely here — not confirmed from loading frames */}
      </SectionHeader>
      {/* List of types: label + edit + delete, drag reorder likely */}
      <AppointmentTypeList types={appointmentTypes} />
    </Section>

    <Section id="appointment-outcomes">
      <SectionHeader>
        <h2>Appointment Outcomes</h2>
        {/* Add button likely here — not confirmed */}
      </SectionHeader>
      {/* List of outcomes: label + edit + delete */}
      <AppointmentOutcomeList outcomes={appointmentOutcomes} />
    </Section>
  </PageContent>
</AdminLayout>
```

---

## Exact Text Transcriptions (verbatim)

### Phone Number Management page

**Page H1:** `Phone Number Management`

**Number Ports H2:** `Number Ports`
**Description:** `Once your number is ported into Follow Up Boss, it will stop working with your old provider.`
**Learn more link text:** `Learn more here.`
**Button:** `New Port Request`
**Info box line 1:** `You currently have no active porting requests. To port a number into your account, click "New Port Request" above. Need help?`
**Info box link:** `Learn more here.`

**Number Parking Lot H2:** `Number Parking Lot`
**Description line 1:** `These numbers will not be able to make or receive calls until assigned to a user or inbox.`
**Description line 2:** `Once a number is released, you will no longer have access to it.`
**Toggle option 1:** `Parked`
**Toggle option 2:** `Released`
**Column header 1:** `Phone Number`
**Column header 2:** `Date Released`
**Empty state:** `You have no released numbers`

**Company H2:** `Company`
**Column header 1:** `Name`
**Column header 2:** `Phone Number`
**Column header 3:** `Actions`
**Row 1 Name:** `Company Number`
**Row 1 Phone:** `(541) 872-3851`
**Row 1 Actions:** `...` (horizontal ellipsis)

**Top-right link:** `View Business Registration`
**Help link:** `How Phone Numbers work`

---

### Stages page

**Page H1:** `Stages`
**Button:** `Add Stage`
**Help link:** `How Stages work`

**Column headers:** `Stage Name` | `People` | `Actions`

**Stage names (in order, verbatim):**
1. `Seller Prospect`
2. `Lead`
3. `A - Hot 1-3 Months`
4. `B - Warm 3-6 Months`
5. `C - Cold 6+ Months`
6. `Renter - future buyer`
7. `Active Client`
8. `Pending`
9. `Past Client`
10. `Sphere`
11. `Archive`
12. `Closed`
13. `Trash`
14. `Real Estate Agent`
15. `Vendor`
16. `Nurture`

**People counts (in order):**
7,523 | 8,243 | 2 | 0 | 46 | 0 | 8 | 0 | 21 | 0 | 2 | 0 | 47 | 2,342 | 1 | 0

---

### Appointments page

**Section 1 H2:** `Appointment Types`
**Section 2 H2:** `Appointment Outcomes`
**Help button:** `Admin Overview`
**Tab label:** `Appointments ▾` (with dropdown chevron)

---

### 404 Error page

**Heading:** `Oops! We couldn't find the page you're looking for`
**Sub-text:** `This page might have been moved, removed or renamed.`
**Button:** `Go back`

---

## Key Data Points for §14/§15 Spec

### §14 — Phone Numbers

1. **Company number:** `(541) 872-3851` — single entry, named "Company Number"
2. **Three sections on one page:** Number Ports | Number Parking Lot | Company (User and Team Inbox sections likely follow below, not captured)
3. **Parking Lot toggle states:** Parked | Released (two separate views of the same table)
4. **Port request flow:** "New Port Request" CTA → (modal not captured)
5. **Actions on Company Number:** Ellipsis menu "..." → options not captured (likely: Edit Name, Delete/Release, Assign to User)
6. **Business Registration link** is separate from number management (links to another page)
7. **No User numbers or Team Inbox numbers** visible in these frames (likely appear as additional sections below the Company section, or this account has none provisioned yet beyond the company number)

### §15 — Stages

1. **16 total stages** in Ryan Realty's FUB account
2. **3 system-protected stages** (no edit/delete): Lead, Closed, Trash
3. **13 user-editable stages** (have edit pencil + delete trash icons)
4. **Drag-to-reorder** is supported (⠿ drag handles on every row)
5. **People count hyperlinks:** Non-zero counts are teal links (filter to People with that stage); zero is plain text
6. **"Add Stage" button** always visible top-right

### §15 — Appointments

1. **Two separate editors on one page:** Appointment Types and Appointment Outcomes
2. **Tab has a dropdown chevron** ("Appointments ▾") — may indicate sub-routes or sub-sections
3. **Content not captured** (loading state only) — needs a follow-up recording pass for:
   - The loaded list of Types with their labels and actions
   - The loaded list of Outcomes with their labels and actions
   - The add/edit modal for Types
   - The add/edit modal for Outcomes

### §15 — Calling

1. **Calling tab exists** in Admin sub-nav between Custom Fields and Stages
2. **Content entirely uncaptured** (page was loading when frame was taken)
3. Needs a dedicated follow-up recording to capture all calling settings

---

## Gaps Requiring Follow-Up Recording

| Gap | Priority | Notes |
|-----|----------|-------|
| Calling admin page (fully loaded content) | HIGH | Completely blank in f05; need settings list, form fields, toggles |
| Appointment Types list (loaded) | HIGH | f08 loading only; need actual type entries + add/edit modal |
| Appointment Outcomes list (loaded) | HIGH | f08 loading only; need actual outcome entries + add/edit modal |
| Company Number ellipsis menu options | MEDIUM | The "..." was captured but menu not opened |
| Number Parking Lot — Parked view | MEDIUM | Only "Released" tab was shown; Parked tab content unknown |
| Add Stage modal | MEDIUM | "Add Stage" button captured but modal not opened |
| Edit Stage modal | MEDIUM | Edit icon captured but click not shown |
| User phone numbers section | MEDIUM | Likely a fourth section below Company, not visible |
| Team Inbox numbers section | MEDIUM | Likely a fifth section, not visible |
| Phone Numbers "More" tab dropdown | LOW | Appointments is in there; other items unknown |
| New Port Request modal | LOW | Button captured but modal not opened |
