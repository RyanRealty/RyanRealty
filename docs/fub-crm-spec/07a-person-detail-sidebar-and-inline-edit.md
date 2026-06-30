# Module 07a — Person Detail: Left Sidebar & Inline Editing

**Scope:** The left meta-sidebar of the Person Detail view (`/crm/people/view/{id}`) — every section, every field, every interactive behavior. This document supersedes §7.1, §7.4, §7.5, §7.6, §7.7, §7.8, and §7.9 of `docs/FUB_CRM_FEATURE_SPEC.md`.

**Sibling spec sections:**
- `07b-person-detail-center-timeline.md` — center column (compose bar + activity timeline)
- `07c-person-detail-right-rail.md` — right action rail (tasks, appointments, automations, files, deals, collaborators)
- `07d-person-list-and-smart-lists.md` — People list view + smart list management

**Design system:** navy `#102742`, cream `#faf8f4`, Geist body, Amboqia Boriango display/headings. All interactive controls from `@/components/ui/` (shadcn/radix). Use `cn()` from `@/lib/utils` for conditional classes.

---

## 1. Overview: Three-Column Layout

The Person Detail screen splits into three independent scroll regions:

| Region | Approximate width | Role |
|---|---|---|
| **Left sidebar** | ~22–25% | Contact identity, structured fields, inline editing |
| **Center column** | ~48–52% | Compose bar (Note / Email / Text / Call) + activity timeline |
| **Right rail** | ~26–30% | CRM widgets: Action Plans, Activity, Tasks, Appointments, Deals, Automations, Files, Collaborators |

The left sidebar is this document's scope. Its sections are: Avatar/Header, Contact Info (phones + emails + address), Relationships, Details (Stage, Assigned to, Source, Price, Timeframe, Tags), Financing (Lender), Custom Fields (12 demographic/enrichment fields), Background, Social Profile, Groups. A "Delete person" link appears at the very bottom.

Every text field and select field in the sidebar uses the same **inline edit pattern**: click the current value (or placeholder) → field enters edit mode showing an input/select + a green ✓ confirm button + a red ✗ cancel button → user modifies → ✓ saves to the server and exits edit mode, ✗ discards changes and exits edit mode. Pressing `Escape` also discards.

---

## 2. Avatar / Header Block

### 2.1 Layout

At the very top of the sidebar, before any sections:

```
┌─────────────────────────────┐
│  [Avatar initials or photo] │
│                             │
│  FirstName LastName         │  ← H2 / display name, Geist 600 ~18px
│  [subtitle line]            │  ← Geist 400 ~13px, muted-foreground color
└─────────────────────────────┘
```

The avatar is a circle, ~60–72px diameter, centered horizontally above the name.

### 2.2 Avatar states

| State | Display |
|---|---|
| No photo | Initials (First + Last initial), navy background `#102742`, white text, Geist 600 |
| Photo available | Circular crop of the contact's profile image |
| Photo auto-fetched | Social enrichment pulls the image when the contact was added via API / email parse / manual entry — NOT via CSV import (per FUB docs) |

**Implementation note:** When the contact is created via import (`source_type = 'import'`), skip the social enrichment job entirely. For all other creation methods, fire an async background job (fire-and-forget) that queries an enrichment provider (name + primary email) and writes back `profile_image_url` and `social_links`. Show initials until the async result arrives.

### 2.3 Subtitle line

Shows the most recent communication summary. States (in priority order):

| Condition | Subtitle text |
|---|---|
| No phones, no emails, no communication | "No communication yet" |
| Has contact info but no logged communication | "No communication yet" |
| Has logged communication | "Last communication X days ago" (relative) |

Observed: "No communication yet" (shot-01 f08 empty contact) — clears once any activity or contact info is added.

### 2.4 Data touched

- `crm_people.first_name`, `crm_people.last_name`
- `crm_people.profile_image_url`
- Computed: last communication timestamp from `crm_timeline` (latest `kind IN ('email_in','email_out','text_in','text_out','call')`)

### 2.5 Acceptance criteria

- AC-AV-1: Avatar circle shows initials if no `profile_image_url`; shows circular-cropped image when URL present.
- AC-AV-2: Initials background is navy `#102742`, text is white.
- AC-AV-3: Subtitle shows "No communication yet" when there are zero timeline entries of kind email/text/call.
- AC-AV-4: Social enrichment async job fires for non-import contacts only; does not block page load.
- AC-AV-5: Profile image async load: page renders initials immediately, replaces with photo when the enrichment job completes (no reload required — update `profile_image_url` in the contact record; the UI can poll or use a realtime subscription).

---

## 3. Contact Info Section

This is the top structured block, immediately below the avatar/header. It holds all communication identifiers. This section is NOT collapsible — it is always visible.

### 3.1 Phone numbers

#### 3.1.1 Display state (read mode)

Each phone number appears as a row:

```
(541) 213-6706  [mobile]  ○ best
```

- Formatted display: `(###) ###-####` for US numbers.
- Label shown as a muted chip or parenthetical: Mobile / Home / Work / Other.
- "Best" radio indicator: one and exactly one phone is flagged as `is_best`. Displayed as a filled radio dot. No other phone has this indicator.
- Multiple phones stack vertically with a divider between them.
- Empty state: shows "Add phone" as a muted placeholder link (observed: f08 empty contact).

#### 3.1.2 Edit Phone Numbers modal (§7.6 replacement)

Clicking any phone row, or clicking "Add phone", opens a **modal** (not inline edit) titled "Edit Phone Numbers."

**Modal layout:**

```
Edit Phone Numbers
─────────────────────────────────────
 Phone Number   Label      Best Number
 ─────────────────────────────────────
 [input      ]  [select▾]  ○
 [   trash   ]
 ─────────────────────────────────────
 [input      ]  [select▾]  ○   ← additional rows
 [   trash   ]
─────────────────────────────────────
 + Add another phone
─────────────────────────────────────
 [Cancel]              [Save Phone Numbers]
```

- **Phone Number:** text input. Format as user types (US: auto-format `(###) ###-####`). Required for the row to be saved.
- **Label:** `<Select>` from `@/components/ui/select`. Options: Mobile (default), Home, Work, Other.
- **Best Number:** radio group (only one can be selected across all rows). If all rows are deleted down to zero, the Best Number state is null.
- **Trash icon:** removes the row. Must have at least zero rows (all phones can be deleted).
- **+ Add another phone:** appends a new empty row.
- Footer: "Cancel" (ghost/outline) | "Save Phone Numbers" (primary navy).

**Limits:**
- Maximum 25 total phone numbers shared across the contact and all linked Relationships (per FUB docs). Enforce this limit across the combined pool.
- Phone entries can have a status: active / unsubscribed / bad / bounced. A "Bad Number" checkbox appears in the **Add relationship** modal (§5.1 below) but NOT in this Edit Phone Numbers modal for the primary contact. (Observed: Bad Number checkbox appears only in the relationship modal — shot-03.)

#### 3.1.3 Data touched

- `crm_people_phones`: `id`, `person_id`, `number` (E.164 stored), `label` (enum), `is_best` (bool, enforce single true), `status` (enum: active/unsubscribed/bad/bounced), `created_at`

#### 3.1.4 Acceptance criteria

- AC-PH-1: Edit Phone Numbers modal opens on click of any phone row or "Add phone" placeholder.
- AC-PH-2: Exactly one Best Number radio is selected at all times when any phone rows exist.
- AC-PH-3: Label select defaults to "Mobile" for new rows.
- AC-PH-4: Save writes all rows atomically (replace the phone set for this person in a single transaction).
- AC-PH-5: Cancel discards all changes with no server write.
- AC-PH-6: Trash icon removes the row from modal state; the change is only committed on Save.
- AC-PH-7: "Add another phone" appends a blank row with Mobile label and no Best selection.
- AC-PH-8: Phone number display in read mode uses `(###) ###-####` US formatting.
- AC-PH-9: Maximum 25 phones enforced across contact + all linked relationships. "Add another phone" is disabled when this total is reached, with a tooltip explaining the limit.

---

### 3.2 Email addresses

#### 3.2.1 Display state (read mode)

Each email appears as a clickable blue link:
```
matt@ryan-realty.com
```

Multiple emails stack vertically. Empty state: "Add email" placeholder link.

Observed: `matt@ryan-realty.com` in f15 (GIF), clickable blue link styling.

#### 3.2.2 Inline edit behavior

Unlike phones (which use a modal), email entries are edited inline within the sidebar:

- Clicking "Add email" or clicking an existing email value enters inline edit mode for that row.
- Shows a text input pre-populated with the current value (or empty for new).
- Green ✓ confirm and red ✗ cancel buttons appear.
- ✓ saves the change, ✗ discards.
- "+ add another email" link appends a new inline input row.

Per-email status (active / unsubscribed / bounced) is system-managed:
- `unsubscribed`: auto-set when contact opts out of an action plan email (per FUB docs). Also auto-tags the contact with `unsubscribed` tag.
- `bounced`: auto-set on email bounce. Also auto-tags with `bounced email` tag. These system tags cannot be disabled.

The UI should surface the status visually (e.g. a warning icon on the email row if bounced/unsubscribed), but does not allow users to manually clear unsubscribed/bounced status in the sidebar.

#### 3.2.3 Data touched

- `crm_people_emails`: `id`, `person_id`, `email`, `status` (enum: active/unsubscribed/bounced), `created_at`

#### 3.2.4 Acceptance criteria

- AC-EM-1: Multiple emails display as stacked rows.
- AC-EM-2: Clicking an email or "Add email" enters inline edit with ✓/✗ controls.
- AC-EM-3: ✓ saves to server; ✗ discards; Escape key discards.
- AC-EM-4: Bounced emails show a visual warning indicator.
- AC-EM-5: Status transitions (active → bounced / active → unsubscribed) are server-side only; users cannot manually clear these statuses from the sidebar.
- AC-EM-6: Auto-tag `bounced email` fires on bounce status set; `unsubscribed` fires on unsubscribe event. These tags cannot be individually disabled per account settings (they are system-generated; per FUB docs, they cannot be turned off unlike city/zip auto-tags).

---

### 3.3 Address

#### 3.3.1 Display state

Single address line shown (or "Add address" placeholder if empty). Multiple addresses can exist.

Observed: "Add address" empty state (f08, f15 GIF); address block below email block.

#### 3.3.2 Inline edit

Inline edit pattern (same as email). Full address fields: Street, City, State, Zip, Country.

#### 3.3.3 Data touched

- `crm_people_addresses`: `id`, `person_id`, `street`, `city`, `state`, `zip`, `country`, `is_primary` (bool), `created_at`
- The first/primary address is used for mailing labels (per FUB docs); relationships cannot have their own addresses — the primary contact's first address is used for mailing label generation.

#### 3.3.4 Acceptance criteria

- AC-AD-1: Empty state shows "Add address" link.
- AC-AD-2: Inline edit with ✓/✗ for address entry.
- AC-AD-3: Multiple addresses supported; first address is the mailing label address.

---

## 4. Relationships Section

Immediately below contact info. Header: "Relationships" (or just a people-silhouette icon row). Two distinct add buttons in the header:

- **People-silhouette icon** (blue): opens "Add relationship" modal (creates a NEW person linked to this contact)
- **Blue + icon**: observed as a second add affordance — likely "Merge existing person" (links an existing person as a relationship without destructive merge)

Empty state text: "No relationships" (observed in shot-01, f08 GIF).

When relationships exist: each shows the related person's name (link to their Person Detail), relationship type label, and phone if present.

### 4.1 "Add relationship" modal

**Triggered by:** clicking the primary add button (people-icon) in the Relationships section header.

**Title:** "Add relationship" with a network/nodes icon.

**Purpose:** Create a NEW Person record AND link it as a relationship to the current person in one action. This is NOT a dedup merge — it creates a distinct contact.

**Modal layout (shot-03):**

```
◎ Add relationship
──────────────────────────────────────────
  First Name [             ]  Last Name [             ]

  Type  [Type e.g. Spouse                             ]
        (free-text input, no fixed enum)

  Phone number
  ┌─────────────────────────────────────────────────────┐
  │  Label: [mobile ▾]   □ Bad Number   [🗑]           │
  │  [phone number input                              ]  │
  └─────────────────────────────────────────────────────┘
  + Add another phone

  Email
  ┌──────────────────────────────┐
  │  [example@email.com        ] │  [🗑]
  └──────────────────────────────┘
  + Add another email

──────────────────────────────────────────
  [Cancel]                  [Save relationship]
```

**Field-by-field spec:**

| Field | Type | Notes |
|---|---|---|
| First Name | Text input | Required |
| Last Name | Text input | Optional |
| Type | Free-text input | Placeholder "Type e.g. Spouse". NOT a fixed enum dropdown. User types any relationship descriptor. FUB docs list examples (Spouse, Wife, Husband, Domestic Partner, Partner, Girlfriend, Boyfriend, Father, Son) but the field is free-form, not constrained. For mailing label relationship name inclusion, the type must exactly match: Spouse, Wife, Husband, Domestic Partner, Partner, Girlfriend, Boyfriend. |
| Phone — Label | Select: Mobile (default) / Home / Work / Other | Default: mobile |
| Phone — Bad Number | Checkbox | Mark phone as bad/invalid without deleting it. Sets `status = 'bad'` on the phone record. |
| Phone — Trash | Icon button | Removes this phone row from the modal |
| + Add another phone | Button | Appends another phone row |
| Email | Text input | Placeholder "example@email.com" |
| Email — Trash | Icon button | Removes this email row |
| + Add another email | Button | Appends another email row |
| Cancel | Ghost button | Discards modal, no server write |
| Save relationship | Primary button (navy) | Creates person + relationship in one transaction |

**CRITICAL spec notes:**
- The Type field is FREE TEXT, not an enum dropdown. Prior spec (§7.5) listed "Spouse/Partner/Co-buyer/Sibling/Child/Parent…" as if these were fixed options — they are not. The user types any value. (Observed: shot-03 shows a plain text input with placeholder "Type e.g. Spouse".)
- "Bad Number" checkbox is a per-phone flag in this modal (not available in the primary contact's Edit Phone Numbers modal). It marks the phone's status as bad without removing it from the record.
- The modal's save operation does two things atomically: (1) creates a new `crm_people` row for the relationship contact, (2) inserts a `crm_people_relationships` row linking the two contacts bidirectionally.
- Maximum 6 relationships importable per contact (per FUB docs). No documented UI-level hard cap on total relationships.

**Data touched:**
- Creates: `crm_people` (new person), `crm_people_phones`, `crm_people_emails`
- Creates: `crm_people_relationships`: `id`, `person_a_id`, `person_b_id`, `relationship_type` (text), `created_at`, `created_by_user_id`

**Acceptance criteria:**
- AC-REL-1: "Add relationship" modal opens from the add button in the Relationships section header.
- AC-REL-2: Type field is a free-text input, not a select. Any string accepted.
- AC-REL-3: Bad Number checkbox available per phone row in this modal. Saving with Bad Number checked sets that phone's `status = 'bad'`.
- AC-REL-4: Save creates both the new Person record and the Relationship link atomically.
- AC-REL-5: Cancel makes no server writes.
- AC-REL-6: Multiple phones and emails can be added within the modal using "+ Add another" links.
- AC-REL-7: Saved relationship appears in the Relationships section without page reload.

---

### 4.2 "Merge existing person" modal (§7.7 replacement)

**Triggered by:** the second add button in the Relationships section header (the blue + icon, inferred to be the "merge existing" trigger; also accessible as a list-level mass action).

**Title:** "Merge existing person" (observed: shot-02).

**Purpose:** Link an EXISTING Person record as a relationship to the current person. This is NOT a full destructive dedup merge. It creates a relationship link between two already-existing contacts. Timeline data merges (per FUB docs: past communication and notes from the merged person move to the primary contact's unified timeline). The merged contact loses standalone status.

**Modal layout (shot-02):**

```
Merge existing person
──────────────────────────────────────────
  [🔍 Search by name, phone or email     ]

  ┌───────────────────────────────────────┐
  │                                       │
  │   Merge person as a relationship of   │
  │          Laurie McAdam                │
  │                                       │
  │          [Learn more]                 │
  └───────────────────────────────────────┘

──────────────────────────────────────────
  [Cancel]               [Merge] (disabled until person selected)
```

**Field-by-field spec:**

| Field | Notes |
|---|---|
| Search input | Full-text search across existing contacts by name, phone, or email. Results appear as a dropdown list below the input. |
| Search results | Shows matching contacts; clicking one selects them and populates a "selected person" preview. |
| Empty state | Text: "Merge person as a relationship of [Current Person's Name]" + "Learn more" link |
| Merge button | Disabled until a person is selected from search. |
| Cancel | Discards modal. |

**CRITICAL spec notes:**
- This is NOT a destructive dedup merge (despite the word "Merge" in the modal title). The FUB docs are explicit: "Merge people as relationships" = create a relationship link, NOT a full data merge where one record is trashed.
- The prior spec (§7.7) described this as a "Merge sending person modal" that fires "when an inbound email's address matches an existing contact." This was an OCR-driven misread. The modal observed in shot-02 is a general "merge any existing person as a relationship" flow, not tied to inbound email matching.
- What DOES happen per FUB docs: past communication and notes from the merged person do move to the primary contact's profile (single unified timeline). This is data migration, not record deletion. The FUB platform then suppresses the merged person from appearing as a standalone contact.
- Unmerging is NOT supported. Once merged as a relationship, the contacts cannot be split via the UI. To un-link: manually create a new contact for the separated person (past conversations will not transfer). Implement an "unmerge is permanent" warning in the modal.
- A Change Log entry is automatically written to the timeline documenting the merge.

**Data touched:**
- Reads: `crm_people` (search)
- Writes: `crm_people_relationships` (new link row)
- Writes: `crm_timeline` entries (migrate from merged person to primary)
- Writes: Change Log entry on primary contact's timeline

**Acceptance criteria:**
- AC-MERG-1: Modal opens from the Relationships section and shows a search input for existing contacts.
- AC-MERG-2: Search covers name, phone, and email.
- AC-MERG-3: Merge button is disabled until a result is selected.
- AC-MERG-4: Merge button triggers: create relationship link + migrate timeline entries from the merged person to primary.
- AC-MERG-5: A "merge is permanent / unmerge not available" warning is shown before confirming.
- AC-MERG-6: Change Log entry is written to the primary contact's timeline on merge.
- AC-MERG-7: After merge, the merged person's record no longer appears in the All People list (it is not deleted, but it is suppressed / its stage is set to Trash).

---

## 5. Details Section (Collapsible)

Collapsible section (chevron toggle: ^ expanded, ▾ collapsed). When expanded, shows structured CRM classification fields. Observed always visible/expanded in the static shots.

Section header: "Details" (Geist 600, small caps or muted label style).

Fields in order (observed across shots):

1. Stage
2. Assigned to
3. Source
4. Price
5. Timeframe
6. Tags
7. Campaigns (read-only — observed in shot-05: "Out Of State Home Owners | 4 more")

---

### 5.1 Stage field (§7.4 replacement)

**Display (read mode):** Current stage value as text (e.g., "Lead", "Seller Prospect").

**Edit interaction:** Click the stage value → inline dropdown opens immediately in place over the content. Green ✓ and red ✗ confirm/cancel appear.

**Observed in shot-04:** Stage dropdown open, showing:
- "Select an Option" (clears/unsets the stage — (inferred))
- "Seller Prospect"
- (scroll implied — only top of list visible in the shot)

**Full stage list (Ryan Realty — 16 stages, from prior spec §15.6):**
1. Seller Prospect (7,523 people)
2. Lead (8,243 people) — **system stage, immutable**
3. A - Hot 1-3 Months (2)
4. B - Warm 3-6 Months (0)
5. C - Cold 6+ Months (46)
6. Renter - future buyer (0)
7. Active Client (8)
8. Pending (0)
9. Past Client (21)
10. Sphere (0)
11. Archive (2)
12. Closed (0) — **system stage, immutable**
13. Trash (47) — **system stage, immutable, protected** (contacts in Trash are hidden from smart lists; action plans auto-pause)
14. Real Estate Agent (2,342)
15. Vendor (1)
16. Nurture (0)

**Behavior rules (per FUB docs):**
- Newly created contacts default to "Lead" stage.
- Moving to "Trash": action plans pause; tasks remain visible in the Tasks tab; contact is hidden from smart lists. Recoverable by changing stage back to any non-Trash stage.
- System stages (Lead, Closed, Trash) cannot be renamed or deleted.
- Stage changes are logged to the timeline as a Change Log entry.
- Stage changes fire stage-change automation triggers (unless the change is made via Mass Actions, which bypasses automations).
- The dropdown should be searchable (search field at top of dropdown, observed in shot-04 area consistent with other field dropdowns having search).

**Data touched:**
- `crm_people.stage_id` → FK to `crm_stages`
- `crm_timeline` (auto-insert Change Log entry on change)
- Automation engine (fire `stage_changed` event — EXCEPT during mass actions)

**Acceptance criteria:**
- AC-STG-1: Clicking the Stage value opens an inline dropdown with all 16 stages in configured order.
- AC-STG-2: Selecting a stage immediately saves when ✓ is clicked; ✗ or Escape cancels.
- AC-STG-3: A Change Log timeline entry is written on stage change.
- AC-STG-4: Stage change fires automation triggers (not bypassed for individual inline edits — only bypassed for mass actions).
- AC-STG-5: Moving a contact to "Trash" stage hides them from smart lists and pauses action plans.
- AC-STG-6: System stages (Lead, Closed, Trash) are not shown as deletable/renameable in Admin.
- AC-STG-7: Stage dropdown has a search/filter input for accounts with many stages.

---

### 5.2 Assigned to field

**Display (read mode):** Assigned agent's full name (e.g., "Matt Ryan").

**Edit interaction:** Click the value → dropdown opens. Observed in shot-05: "Assigned to" dropdown open.

**Dropdown structure (shot-05 + GIF f06):**

```
[🔍 Search...                    ]
────────────────────────────────
  Me                             ← shortcut for the logged-in user
────────────────────────────────
  PONDS
  Seller Leads (Round Robin)
  View All Ponds
  Out Of State Home Owners       ← named pond (GIF f06)
────────────────────────────────
  TEAM MEMBERS
  Matt Ryan      [avatar]
  Paul Stevenson [avatar]
  Rebecca Peterson [avatar]
  Matt Ryan (Round Robin)        ← appears twice in shot-05 (artifact or round-robin option)
```

**Behavior rules:**
- "Me" shortcut assigns to the currently logged-in user without searching.
- PONDS section: selecting a Pond assigns via that pond's routing method (Round Robin = auto-assigned from the pond rotation). In FUB, "First to Claim" and "Round Robin" are the two routing methods. Pond assignments are not available in Mass Actions (per FUB docs); available here for individual record assignment.
- TEAM MEMBERS section: direct assignment to a specific agent.
- Dropdown has a search input at the top for accounts with many team members.
- Green ✓ / red ✗ confirm/cancel buttons visible while the dropdown is open.
- Assignment change is logged to the timeline (Change Log entry).

**Data touched:**
- `crm_people.assigned_agent_id` → FK to `crm_users`
- `crm_people.assigned_pond_id` → FK to `crm_ponds` (if assigned via pond routing)
- `crm_timeline` (Change Log entry on reassignment)

**Acceptance criteria:**
- AC-ASSGN-1: Clicking Assigned to opens an inline dropdown with three sections: shortcut (Me) / PONDS / TEAM MEMBERS.
- AC-ASSGN-2: "Me" assigns to the current user immediately on selection + ✓ click.
- AC-ASSGN-3: Selecting a Pond assigns via pond routing method (round robin or first-to-claim per pond config).
- AC-ASSGN-4: Selecting a TEAM MEMBER directly assigns to that agent.
- AC-ASSGN-5: Dropdown has a search input. Searching filters team members by name.
- AC-ASSGN-6: Assignment change is logged to the timeline.
- AC-ASSGN-7: ✗ or Escape cancels with no save.

---

### 5.3 Source field

**Display (read mode):** Source string + recency (e.g., "Ryan-Realty.com, a month ago"; "Ryan-Realty.com 17 days ago").

**Edit interaction:** Click the value → Source autocomplete dropdown opens. Green ✓ / red ✗ visible.

**Observed in shot-06:** Source dropdown open showing:

```
[🔍                              ]
────────────────────────────────
  Google        [Google logo]
  Zillow        [Zillow logo]
  Realtor.com
  Import
  Referral
────────────────────────────────
  Recent:
  Ryan-Realty.com
  ExclusiveL...
  Realtor.com
```

**Field-by-field spec:**

| Dropdown section | Content |
|---|---|
| Search input | Filters the predefined options and recent values |
| Predefined options | Google, Zillow (with Zillow logo), Realtor.com, Import, Referral (observed). Additional sources exist in the account (e.g., Ryan-Realty.com, ExclusiveListings, etc.) |
| Recent: section | Shows the most recently used sources for this account (contextual, not per-contact) |

**Behavior rules:**
- Source is set on lead creation and can be changed here.
- Source changes are logged to the Change Log (timeline).
- The "recency" suffix ("17 days ago") is the time since the lead's original source event, not a label editable by the user — it is derived from `crm_people.created_at` or `source_event_at`.

**Data touched:**
- `crm_people.source` (string / FK to `crm_lead_sources`)
- `crm_timeline` (Change Log entry on source change)

**Acceptance criteria:**
- AC-SRC-1: Source dropdown opens with predefined options + Recent section.
- AC-SRC-2: Logos shown for sources that have them (Zillow, Google, Realtor.com).
- AC-SRC-3: Search input filters the list.
- AC-SRC-4: Selecting a source + ✓ saves; ✗ cancels.
- AC-SRC-5: Source change is logged to Change Log.
- AC-SRC-6: Display shows source name + time-since recency label (computed from `source_event_at`).

---

### 5.4 Price field

**Display (read mode):** Numeric value formatted as currency (e.g., "$895,000"). Empty state shows blank or a dash.

**Edit interaction:** Click the value → inline text input. Shows ✓/✗. Enter numeric value only; the UI formats on save.

Observed: Green ✓ and red ✗ confirm/cancel visible in shot-07 when the Price field was in edit mode.

**Behavior:** Top-of-price-range (buyer's maximum or seller's expected price). Numeric, no decimals (per FUB docs: "Number — whole numbers only").

**Data touched:**
- `crm_people.price` (integer, stored in cents or raw integer dollars — choose one and be consistent throughout the schema)

**Acceptance criteria:**
- AC-PR-1: Click opens inline numeric input.
- AC-PR-2: ✓ saves formatted value; ✗ cancels.
- AC-PR-3: Display formats as `$X,XXX,XXX` with comma separators and no decimals.
- AC-PR-4: Empty state: field label with a blank value (not hidden).

---

### 5.5 Timeframe field (§7.9 replacement)

**Display (read mode):** Selected timeframe string, or blank if unset.

**Edit interaction:** Click the value → inline dropdown with a search/clear input. Green ✓ / red ✗ visible.

**Observed in shot-08:** Timeframe dropdown open, full option set confirmed:

```
[🔍 ×                            ]   ← search field with gray × clear button
────────────────────────────────
  Select an Option               ← clears/unsets the field
  0-3 Months
  3-6 Months
  6-12 Months
  12+ Months
  No Plans
```

**Enum definition (CONFIRMED from shot-08, supersedes any prior guesses):**

| Value | Stored enum key (inferred) |
|---|---|
| (unset) | `null` |
| 0-3 Months | `0_3_months` |
| 3-6 Months | `3_6_months` |
| 6-12 Months | `6_12_months` |
| 12+ Months | `12_plus_months` |
| No Plans | `no_plans` |

"Select an Option" is not a stored value — it resets the field to null.

The search field has a gray × clear button (observed), which clears the search input (not the field value).

**Data touched:**
- `crm_people.timeframe` (enum column: `null | '0_3_months' | '3_6_months' | '6_12_months' | '12_plus_months' | 'no_plans'`)

**Acceptance criteria:**
- AC-TF-1: Clicking Timeframe opens an inline dropdown with the 5 options (+ "Select an Option" to clear).
- AC-TF-2: The dropdown has a search input with a gray × clear button.
- AC-TF-3: "Select an Option" sets `timeframe = null`.
- AC-TF-4: ✓ saves; ✗ cancels.
- AC-TF-5: Display shows the selected enum label or blank when null.

---

### 5.6 Tags field

**Display (read mode):** Colored removable pill chips inline. Up to ~4–5 chips shown, then overflow link.

**Observed pattern (multiple shots):**
```
[audience:seller ×] [broker:matt ×] [Buyer ×] [campaign:concept-m-mountain ×] [channel:fb-ads ×] [+4 more] [+]
```

- Each chip shows the tag name + an × to remove it.
- When more tags exist than fit in the display area, the overflow is shown as "+ N more" link. Clicking expands ALL tags inline (not a new page/modal).
- Blue "+" button at the end of the chip row opens the tag-add UI.

**Tag taxonomy (Ryan Realty prefix conventions, per prior spec §17.2):**
- `area:` — geographic
- `audience:` — segment (audience:seller, audience:buyer, audience:broker-recruit)
- `auto:` — automation-applied
- `broker:` — broker routing/attribution (broker:matt)
- `campaign:` — campaign identifier
- `channel:` — acquisition channel
- Price tiers, behavioral tags, compliance tags (`contact:do-not-text`, `contact:do-not-call`, `compliance:hard-stop`)

**Adding a tag (blue + button):**
- Opens an inline autocomplete/search input for existing tags.
- Typing a new name shows "Create New Tag: [name]" option.
- Multi-select or single-select from the list.
- Confirmed with a "Save Tags" affordance (or auto-saves on selection, per FUB pattern).

**Removing a tag:** Click × on any chip → removes immediately (optimistic UI; server write in background).

**Attribution:** Hovering over a tag shows who added it and when — only for tags added after 2021-06-14 (per FUB docs). Tags added before that date have no attribution data.

**Limits:**
- 64-character limit per tag name (per FUB docs).
- No documented limit on number of tags per contact.

**Data touched:**
- `crm_people_tags` (junction): `person_id`, `tag_id`, `added_by_user_id`, `added_at`
- `crm_tags`: `id`, `name` (≤64 chars), `created_at`

**Acceptance criteria:**
- AC-TAG-1: Tags render as removable chips with × per chip.
- AC-TAG-2: Overflow shown as "+ N more" link; clicking expands all chips inline (not a modal).
- AC-TAG-3: Blue + button opens tag autocomplete/search.
- AC-TAG-4: Typing a new tag name shows "Create New Tag" option.
- AC-TAG-5: Removing a tag via × fires immediately (optimistic removal; server confirms).
- AC-TAG-6: Tag name limit is 64 characters; enforce on input.
- AC-TAG-7: Hover tooltip on a chip shows added-by and added-at (only for tags with attribution data, i.e., added after 2021-06-14).
- AC-TAG-8: Auto-tags (`bounced email`, `unsubscribed`, city, zip) are applied by the application layer — not user-triggered. City/zip auto-tagging is configurable per account (Admin > Tags toggles); bounced/unsubscribed auto-tags cannot be disabled.

---

### 5.7 Campaigns field (read-only)

**Display:** "Out Of State Home Owners | 4 more" (observed in shot-05). Read-only.

Campaigns are action plans or drip sequences the contact is enrolled in. This is a display-only field in the sidebar; management happens in the right rail (Action Plans section).

**Acceptance criteria:**
- AC-CAMP-1: Campaigns field shows active campaign names (comma-separated or "+ N more").
- AC-CAMP-2: Field is read-only in the left sidebar; editing/enrolling campaigns happens via the right rail Action Plans section.

---

## 6. Financing Section (Collapsible)

**Section header:** "Financing" with a chevron toggle. Observed in shot-01 and GIF f17.

### 6.1 Lender field

**Display (read mode):** Lender name, or blank if unset.

**Edit interaction:** Inline edit with ✓/✗. Free-text input (per FUB docs: "Assigned Lender — Single lender assignment"). In FUB, the lender is a team member with the "Lender" role. In the in-house CRM, this is either a FK to a user or a free-text string depending on whether Ryan Realty manages lenders as users.

**Observed:** "Lender" label with blank value in shot-01.

Also observed in shot-05: separate "Financials" group with "Lender" and "Mortgage Provider" fields.

**Data touched:**
- `crm_people.assigned_lender_id` (FK to `crm_users` where `role = 'lender'`) OR `crm_people.lender_name` (string if lender is external/not a system user)

**Acceptance criteria:**
- AC-FIN-1: Financing section is collapsible with a chevron toggle.
- AC-FIN-2: Lender field shows inline edit with ✓/✗.
- AC-FIN-3: Lender is empty by default on new contacts.

---

## 7. Custom Fields Section (Collapsible) — §7.8 replacement

**Section header:** "Custom Fields" with a chevron toggle.

**Observed field set (shot-01, GIF f17 — 11–12 fields confirmed):**

| # | Field Name | Type (per FUB docs + inferred) | Notes |
|---|---|---|---|
| 1 | Recently Divorced | Dropdown ("Select an Option") | Observed; Select type |
| 2 | Recently Moved | Dropdown ("Select an Option") | Observed; Select type |
| 3 | Enrichment Provider | Text | Observed; auto-populated by enrichment service |
| 4 | Phone Type | Dropdown ("Select an Option") | Observed; Select type |
| 5 | Net Worth Range | Dropdown ("Select an Option") | Observed; Select type |
| 6 | Income Range | Dropdown ("Select an Option") | Observed; Select type |
| 7 | Occupation | Text | Observed |
| 8 | Has Children | Dropdown ("Select an Option") | Observed; Select type |
| 9 | Household Size | Number or Dropdown | Observed |
| 10 | Marital Status | Dropdown ("Select an Option") | Observed; Select type |
| 11 | Gender | Dropdown ("Select an Option") | Observed; Select type |
| 12 | Birthday | Date | Not explicitly confirmed in f17 but listed as a configured custom field in prior spec |

Per prior spec §15.5, Ryan Realty has 64 total custom fields. The 11–12 in the Custom Fields sidebar section are the demographic/enrichment subset. Other custom fields (property-related, transaction-related) appear in other sections (Details sub-group) or are not shown in the sidebar view analyzed here.

### 7.1 Select-type custom field interaction ("Select an Option")

**Observed in shots showing "Select an Option":** Clicking a Select-type custom field → inline dropdown opens showing the field's configured options + "Select an Option" (to clear/unset) at the top.

This is the standard inline edit pattern. Green ✓ / red ✗ appear.

**Critical rules (per FUB docs):**
- Dropdown field choices are created at field-definition time. The order in which choices were entered at creation (or imported via CSV) determines display order — and this order **cannot be changed after creation**.
- Field type (Text/Number/Date/Dropdown) cannot be changed after creation. To change type: delete field + recreate (loses all data).
- Only the account owner can create custom fields (Admin > Custom Fields).
- Custom field names can be edited. Types cannot.
- `hide_if_empty` and `read_only` flags are set per field by the owner.

**Data model:**

```
crm_custom_fields (definition table)
  id, name (string ≤256 chars for label; per docs the 64-char limit is for TAG names — custom field names are documented with the shorter tag limit; implementation should check this), 
  type (enum: text | number | date | dropdown),
  hide_if_empty (bool), 
  read_only (bool), 
  display_order (int),
  created_at, 
  created_by_user_id (owner only)

crm_custom_field_options (for dropdown fields only)
  id, field_id, label, display_order (IMMUTABLE after creation — enforce in UI + API)

crm_people_custom_field_values
  id, person_id, field_id, 
  value_text (for type=text), 
  value_number (for type=number), 
  value_date (for type=date), 
  value_option_id FK crm_custom_field_options (for type=dropdown)
```

**Text type:** Max 256 characters per value (per FUB docs).
**Number type:** Whole numbers only — no decimals, no special characters.
**Date type:** MM/DD/YY or MM/DD/YYYY format in the input; store as `date` column.
**Dropdown type:** Single-select from the field's immutable option list.

### 7.2 "hide_if_empty" behavior

When `hide_if_empty = true`: the field row is not rendered in the sidebar if `value` is null/empty. When `hide_if_empty = false` (default): the field row always shows with a blank value — making it discoverable and fillable.

Observed: All 11 custom fields in f17 GIF show as blank rows (label + empty value) — consistent with `hide_if_empty = false` for this account's configuration.

### 7.3 Read-only custom fields

When `read_only = true`: the field displays its value but does not enter edit mode on click. Used for enrichment-provider-populated fields (e.g., Enrichment Provider, which is written by the background enrichment job, not manually edited by users).

### 7.4 Custom field merge field tokens

Custom fields are available as merge tokens in email/text compose (e.g., `{net_worth_range}`). If the contact has no value, the token resolves to blank (not an error).

**Acceptance criteria:**
- AC-CF-1: Custom Fields section is collapsible.
- AC-CF-2: All 12 demographic/enrichment fields are shown when section is expanded (subject to `hide_if_empty` flag per field).
- AC-CF-3: Select-type fields open an inline dropdown on click, showing "Select an Option" + all configured options. ✓ saves; ✗ cancels.
- AC-CF-4: Text-type fields open an inline text input. ✓ saves; ✗ cancels. Max 256 characters enforced.
- AC-CF-5: Number-type fields accept whole integers only; reject decimals and special characters.
- AC-CF-6: Date-type fields accept MM/DD/YY or MM/DD/YYYY format.
- AC-CF-7: Dropdown field option order matches definition order and cannot be reordered after creation.
- AC-CF-8: `read_only = true` fields render value without an edit affordance (no click-to-edit).
- AC-CF-9: `hide_if_empty = true` fields are not rendered when value is null.
- AC-CF-10: Custom fields are filterable in smart lists and selectable as People list columns.
- AC-CF-11: Only the account owner (`role = 'owner'`) can create, rename, or delete custom field definitions via Admin.
- AC-CF-12: Field type is immutable after creation; the Admin edit form hides the type selector for existing fields.

---

## 8. Background Section (Collapsible)

**Section header:** "Background" with a chevron toggle.

**Display (read mode):** Free-text content, or "Add background" placeholder link (observed in f08).

**Edit interaction:** Inline edit — click the value or "Add background" → multi-line text area expands. ✓ saves; ✗ cancels.

**Purpose (per FUB docs):** "High-level notes that are frequently referenced." Distinct from timeline notes (which are timestamped events). Background is a single persistent free-text field.

**Change Log:** Changes to the Background field ARE tracked in the Change Log (per FUB docs: "Background information" is one of the tracked fields).

**Social media links can be manually added here** (per FUB docs). The Social Profile section (below) handles auto-enriched social links; Background can hold manually entered link text.

**Data touched:**
- `crm_people.background` (text, unbounded)
- `crm_timeline` (Change Log entry on change)

**Acceptance criteria:**
- AC-BG-1: Background section is collapsible.
- AC-BG-2: Empty state: "Add background" placeholder link.
- AC-BG-3: Clicking enters inline multi-line edit mode with ✓/✗.
- AC-BG-4: Changes are written to the Change Log timeline entry.

---

## 9. Social Profile Section (Collapsible)

**Section header:** "Social Profile" with a chevron toggle.

**Observed content (shot-01):** 
- "Google — Search Matthew Ryan" (a Google-search link constructed from the contact's name)
- Auto-enriched social links (Facebook, LinkedIn, Twitter/X) when available

**Auto-enrichment (per FUB docs):**
- Triggered for contacts added via API, email parse, or manual entry ONLY.
- Imported contacts do NOT get social enrichment.
- Uses contact's name + primary email to query enrichment provider.
- Populates: profile image URL, Facebook/LinkedIn/Twitter URLs, Google search link.
- Cannot be manually triggered / refreshed from the UI (no "refresh" button).

**Display:**
- Each social link shows the platform name + profile URL (clickable external link).
- Google link: "Google — Search [Name]" — opens a Google search for the contact's name in a new tab.

**Data touched:**
- `crm_people.social_google_url` (string)
- `crm_people.social_facebook_url` (string)
- `crm_people.social_linkedin_url` (string)
- `crm_people.social_twitter_url` (string)
- `crm_people.profile_image_url` (string — also displayed in Avatar block)

**Acceptance criteria:**
- AC-SOC-1: Social Profile section is collapsible.
- AC-SOC-2: Google search link always present (constructed from `{first_name} {last_name}`).
- AC-SOC-3: Social links (Facebook, LinkedIn, Twitter) show when populated by enrichment job.
- AC-SOC-4: Social enrichment job runs async on creation (non-import contacts only). Does not block page load.
- AC-SOC-5: No manual "refresh enrichment" button shown in the UI (matches FUB behavior).

---

## 10. Groups Section (Collapsible)

**Section header:** "Groups" with a chevron toggle.

Groups in FUB are organizational units for team members (not contacts). In the context of the left sidebar, this section likely shows which group(s) the contact's assigned agent belongs to, or which Smart List Collections the contact appears in.

**Observed:** "Groups" section visible in shot-01 (collapsed). Content not expanded in the analyzed shots.

**Implementation note (inferred):** In Ryan Realty's FUB, Groups are used at the Admin level for team organization. In the sidebar, this section may show the contact's list membership or pond assignment. Build as a collapsible display-only section until the exact data model is confirmed from a deeper screenshot.

**Acceptance criteria:**
- AC-GRP-1: Groups section is collapsible.
- AC-GRP-2: Section shows relevant group membership data when expanded (exact content TBD — requires additional screenshot analysis of the expanded state).

---

## 11. "Delete person" link

At the very bottom of the left sidebar, below all collapsible sections: a red "Delete person" text link.

**Permission gate:** Visible only to account owner and admin users. All other roles see only the option to move to Trash stage.

**Behavior (per FUB docs):**
- **Permanent delete:** Erases all contact information. Removes tasks. Deals lose their link to the person but are not deleted. Contact is permanently removed from all reporting metrics. Cannot be restored.
- Show a confirmation dialog: "Are you sure? This cannot be undone. This contact and all associated data will be permanently deleted. Deals linked to this contact will remain but will no longer be associated with a person."
- Trash stage (available to all users): moves contact to Trash — hides from smart lists, pauses action plans, preserves all data, recoverable.

**Implementation distinction:**
- Non-owner users: clicking a "Move to Trash" affordance changes the contact's stage to "Trash".
- Owner/admin users: the "Delete person" link is additionally shown, triggering permanent deletion after confirmation.

**Data touched (on permanent delete):**
- Deletes: `crm_people`, `crm_people_phones`, `crm_people_emails`, `crm_people_addresses`, `crm_people_tags`, `crm_people_relationships`, `crm_people_custom_field_values`, `crm_timeline`
- Does NOT delete: `crm_deals` (orphaned), `crm_tasks` (removed per FUB docs)

**Acceptance criteria:**
- AC-DEL-1: "Delete person" link visible only to `role IN ('owner', 'admin')`.
- AC-DEL-2: Clicking shows a confirmation modal with permanent-delete warning.
- AC-DEL-3: Confirming deletes the contact and all associated data; redirects to People list.
- AC-DEL-4: Deals linked to the deleted contact remain but lose the `person_id` FK (orphaned).
- AC-DEL-5: Non-owner users have access to a "Move to Trash" affordance (stage change to Trash) but not permanent delete.

---

## 12. Inline Edit Pattern — Canonical Specification

All left-sidebar fields (except phones, which use a modal) use this pattern:

### 12.1 States

| State | Visual |
|---|---|
| **Read** | Static value text (or muted placeholder "Add [field]" link if empty). Cursor: pointer on hover. |
| **Hover** | Light background highlight on the field row to indicate editability. |
| **Edit** | Input/select replaces the static value. Confirm (green ✓) and cancel (red ✗) icon buttons appear to the right of the input. |
| **Saving** | (Optional) Input briefly disabled / shows a spinner after ✓ click while server responds. |
| **Saved** | Returns to read state with the new value. |
| **Error** | Returns to edit state with an inline error message (e.g., "Failed to save — try again"). |

### 12.2 Keyboard behavior

| Key | Action |
|---|---|
| `Enter` | Confirm save (same as ✓). For multi-line text areas (Background), Enter inserts a newline; `Cmd+Enter` or a "Save" button saves. |
| `Escape` | Cancel (same as ✗). Discards unsaved changes. |
| `Tab` | (inferred) Move to the next editable field in tab order. |

### 12.3 Confirm / cancel button styling

- ✓ Confirm: `bg-success text-success-foreground` (green) or `bg-primary` (navy), small icon button, rounded.
- ✗ Cancel: `bg-destructive text-destructive-foreground` (red), small icon button, rounded.
- Both buttons appear inline, to the right of the input, in the same row.

### 12.4 Dropdown fields (Stage, Assigned to, Source, Timeframe, Custom Field selects)

- Dropdown opens inline (positioned below the field row).
- Most dropdowns include a search input at the top.
- The ✓/✗ buttons remain visible while the dropdown is open — clicking ✓ with a selection commits; ✗ closes without saving.
- Dropdown closes on outside click (which also acts as cancel).

### 12.5 Component mapping

```tsx
// Inline edit wrapper
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

// Pattern:
<div className={cn("group relative", isEditing && "bg-muted/30 rounded-md")}>
  {isEditing ? (
    <>
      <Input value={draft} onChange={...} onKeyDown={handleKeyDown} />
      <div className="flex gap-1 mt-1">
        <Button size="icon" variant="success" onClick={handleSave}><Check /></Button>
        <Button size="icon" variant="destructive" onClick={handleCancel}><X /></Button>
      </div>
    </>
  ) : (
    <div className="cursor-pointer hover:bg-muted/20 rounded px-1 py-0.5" onClick={() => setIsEditing(true)}>
      {value || <span className="text-muted-foreground">Add {fieldLabel}</span>}
    </div>
  )}
</div>
```

---

## 13. Sidebar Section Collapsibility

### 13.1 Collapsible sections list

| Section | Collapsible | Default state (inferred) |
|---|---|---|
| Contact info (phones / emails / address) | No — always visible | Expanded |
| Relationships | No | Expanded |
| Details (Stage, Assigned, Source, Price, Timeframe, Tags) | Yes | Expanded |
| Financing | Yes | Expanded |
| Custom Fields | Yes | Collapsed (observed as collapsed in shot-01 — visible as a label, content hidden until expanded) |
| Background | Yes | Expanded |
| Social Profile | Yes | Collapsed (inferred) |
| Groups | Yes | Collapsed (inferred) |

### 13.2 Chevron toggle behavior

- Section header row: label text + chevron icon (right-aligned).
- Collapsed: chevron points down (▾). Section content hidden.
- Expanded: chevron points up (^). Section content visible.
- Toggle is per-section, per-user (each user saves their own collapse state). Store in `localStorage` or in a `user_sidebar_preferences` table.
- Per FUB docs: sections can also be drag-reordered via handle icons on section title headers (per-user customization).

### 13.3 Drag-to-reorder (per FUB docs)

Each collapsible section header has a drag handle (⋮⋮ or ≡ icon). Users can drag sections to rearrange their order in the sidebar. This order is saved per-user.

Implementation: use `@dnd-kit/sortable` or similar. Store `user_sidebar_section_order: string[]` in user preferences (localStorage initially; migrate to server if multi-device sync is needed).

**Acceptance criteria:**
- AC-COLL-1: Each collapsible section has a chevron toggle; clicking expands/collapses.
- AC-COLL-2: Collapse state persists per-user (survives page reload).
- AC-COLL-3: Section headers have drag handles for reordering.
- AC-COLL-4: Section order persists per-user.

---

## 14. Activity Time-Range Dropdown (§7.9 replacement)

The time-range dropdown referenced in the prior spec (§7.9) is located in the **center column** (timeline filter bar), NOT in the left sidebar. It is covered in `07b-person-detail-center-timeline.md`.

For completeness: the observed timeline filter bar (shot-08) shows tabs for All / Email / Note / Call / Pin / Team / Star / Eye with individual counts, plus a "Filters" button. The time-range filter (Recent / Last 3 / 6 / 12 / 24 Months) is a secondary filter on the timeline, not a sidebar field.

---

## 15. Data Touched — Complete Table

| Table | Read | Write | Who writes |
|---|---|---|---|
| `crm_people` | ✓ | Stage, source, price, timeframe, background, assigned_agent_id, assigned_lender_id | User (inline edit) |
| `crm_people_phones` | ✓ | All phone rows (modal save) | User (modal) |
| `crm_people_emails` | ✓ | Individual email rows (inline edit) | User (inline edit) |
| `crm_people_addresses` | ✓ | Address rows (inline edit) | User (inline edit) |
| `crm_people_tags` | ✓ | Add/remove junction rows | User (tag chips) |
| `crm_tags` | ✓ | Insert new tag names (on "Create New Tag") | User |
| `crm_people_relationships` | ✓ | Insert relationship links | User (Add relationship / Merge modals) |
| `crm_people_custom_field_values` | ✓ | Individual field values (inline edit) | User (inline edit) |
| `crm_timeline` | ✓ | Change Log entries | Application (auto on field change) |
| `crm_stages` | ✓ | None (admin-managed) | Admin only (Admin module) |
| `crm_users` | ✓ (Assigned to dropdown) | None | Admin only |
| `crm_ponds` | ✓ (Assigned to dropdown) | None | Admin only |
| `crm_custom_fields` | ✓ | None (admin-managed) | Account owner only (Admin module) |
| `crm_custom_field_options` | ✓ | None (immutable after creation) | Account owner only (Admin module) |

---

## 16. Accepted Corrections to Prior Spec (§7.x)

The following items in the prior spec (`docs/FUB_CRM_FEATURE_SPEC.md`) §7.x are incorrect and superseded by this document:

| Prior spec claim | Correction | Source |
|---|---|---|
| §7.5: Type field in Add relationship modal is an enum (Spouse/Partner/Co-buyer/Sibling/Child/Parent…) | Type is a FREE TEXT input with placeholder "Type e.g. Spouse" — any string accepted | shot-03 |
| §7.7: "Merge sending person" is triggered by inbound email matching an existing contact | The "Merge existing person" modal is a general relationship-linking flow (not email-triggered). Destructive dedup merge is a separate mass action, not this modal. | shot-02 + FUB docs |
| §7.9: Activity time-range dropdown is in the left sidebar | The time-range filter is in the center column's timeline filter bar, not the left sidebar | shot-08 + GIF f16 |
| §7.7: Implies merge is potentially destructive / permanent data loss | "Merge existing person" creates a relationship link; timeline data moves to primary. The merged person's stage is set to Trash. NOT a hard delete. Unmerging is not supported. | FUB docs |
| §7.4: Stage dropdown lists: "Nurture, Lead, Seller Prospect, A-Hot, B-Warm, C-Cold, Active Client, Pending, Past Client, Sphere" | The full verified stage list has 16 stages including Real Estate Agent (2,342 contacts) and Vendor. See §5.1 above for complete list. | prior spec §15.6 |

---

## 17. Sources

1. **shot-01.md** — Person record (Laurie McAdam) showing full sidebar layout, all sections, empty states, and populated fields including Tags (6 visible + overflow) and Custom Fields (12 fields).
2. **shot-02.md** — "Merge existing person" modal — title, search field, empty state copy, Cancel + Merge (disabled) buttons.
3. **shot-03.md** — "Add relationship" modal — First/Last Name, Type (free text "Type e.g. Spouse"), Phone with Label (mobile default) + Bad Number checkbox + trash + "+ Add another phone", Email section, Cancel + "Save relationship".
4. **shot-04.md** — Stage dropdown open (confirmed options: "Select an Option", "Seller Prospect"); inline edit green ✓ / red ✗; Assign dropdown with search; Tags dropdown showing stage-style options "A - Hot 1-3 Months" etc.
5. **shot-05.md** — Assigned-to dropdown open: "Me" / "PONDS" section ("Seller Leads (Round Robin)") / "TEAM MEMBERS" section (Matt Ryan, Paul Stevenson, Rebecca Peterson); Campaigns field "Out Of State Home Owners | 4 more".
6. **shot-06.md** — Source dropdown open: Google / Zillow / Realtor.com / Import / Referral + "Recent:" section; inline edit ✓/✗ on Source field.
7. **shot-07.md** — Price field with inline edit save/cancel; Tags field showing "subtraction-sale-mountain", "farmfin-4" + "4 more".
8. **shot-08.md** — Timeframe dropdown open with CONFIRMED option set: "Select an Option", "0-3 Months", "3-6 Months", "6-12 Months", "12+ Months", "No Plans"; search field with gray × clear button.
9. **fub-analysis-gif/people.md** — GIF interaction-flow analysis. Key dynamics: list navigation, skeleton loading, person detail layout transitions, email compose async signature loading, Text tab provisioning placeholder, Details + Custom Fields expanded state (f17).
10. **fub-docs/people-contacts.md** — Official FUB Help Center documentation research (28 articles). Key rules: 25 phone limit shared with relationships, tag 64-char limit, custom field type immutability, dropdown option order immutable after creation, unmerge not supported, social enrichment skips imports, mass actions bypass automations, Change Log is permanent, collaborator auto-removal on agent promotion.
11. **docs/FUB_CRM_FEATURE_SPEC.md §7.x, §15.5, §15.6, §17.2** — Prior OCR spec (reference for stage list, tag taxonomy, custom field inventory). Corrections documented in §16 above.
