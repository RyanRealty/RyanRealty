# Section 14 — Admin: Overview Hub, Stages, Tags, Custom Fields, Lead Flow, Groups, Ponds, Appointment Stages

> **Source priority order (highest wins):** Vision-verified screenshot analyses > GIF dynamic-behavior analyses > official FUB help-center docs > prior spec §15. Items that derive from only one source are annotated: `[screenshot]`, `[GIF]`, `[FUB docs]`, `[prior spec]`, `[inferred]`. Items verified by two or more independent sources carry no annotation — they are confirmed.

---

## 14.0 Admin section — global layout rules

### 14.0.1 Full-width horizontal sub-nav

Every Admin page replaces the standard left-sidebar layout with a **full-width horizontal sub-nav tab bar** that spans the entire viewport width. [screenshot]

- Tab bar sits immediately below the global primary nav (the top app bar).
- Tabs observed: Overview · Lead Flow · Groups · Ponds · Action Plans · Automations · Email Templates · Text Templates · Business Registration · Team · Import · Phone Numbers · Company · Email Domain Authentication · API Keys & Lead Email · Pixel · IDX Integrations · All Integrations · Custom Fields · Custom Stages · Tags · Appointment Stages
- When the screen is not wide enough to show all tabs, an overflow "More ▾" control appears at the right end. [GIF admin1]
- Active tab is underlined or otherwise visually distinguished from inactive tabs. [screenshot]
- **There is no left sidebar on any Admin page.** The left sidebar (which contains Smart Lists/Collections) is present only on the People module. [screenshot]

### 14.0.2 Contextual help link

Every admin sub-tab shows a contextual help link in the upper-right corner of the content area. The link text changes per active route, following the pattern "ⓘ How [Feature] works". [screenshot shot-49 confirmed for Ponds; pattern applies to all tabs per FUB docs]

Examples:
- Ponds tab: "ⓘ How Ponds work"
- Lead Flow tab: "ⓘ How Lead Flow works"

### 14.0.3 Page-level loading states (three observed patterns)

| Pattern | Trigger | Visual behavior |
|---|---|---|
| **Spinner** (large, centered) | Large async data load, initial heavy render | Full-area centered spinner while data fetches |
| **Dot loader** (minimal) | Lighter query, faster response expected | Small animated dot/progress element; content loads around it |
| **Skeleton rows** (structure-first) | Ponds tab specifically confirmed | Table structure pre-renders with 3 shimmer/placeholder rows; replaced by real data on resolve |

[GIF feat2 confirmed skeleton pattern for Ponds; spinner and dot patterns observed across other tabs in admin GIF sequences]

### 14.0.4 Ryan Realty design system mapping

| FUB UI element | Ryan Realty equivalent |
|---|---|
| FUB teal/blue primary color (`#0072e5` approx.) | `bg-primary` = navy `#102742` |
| FUB teal pill button ("Add Stage", "+ Add Pond") | `<Button variant="default">` from `@/components/ui/button` |
| FUB card/panel container (Stages ~60% viewport) | `<Card>` from `@/components/ui/card` |
| FUB drag-handle (6-dot 2×3 grid) | 6-dot grip icon, `cursor-grab`, always visible in row |
| FUB table (sortable columns, checkbox select) | `<Table>` from `@/components/ui/table` |
| FUB inline checkbox (Hide if empty, Read-only) | `<Checkbox>` from `@/components/ui/checkbox` |
| FUB avatar stacks (Team Members in Ponds) | `<Avatar>` + `<AvatarGroup>` pattern |
| FUB skeleton shimmer rows | `<Skeleton>` from `@/components/ui/skeleton` |
| FUB section headings | Geist 600, sentence case, `text-foreground` |
| FUB count badges (blue hyperlink when > 0) | `<a className="text-primary underline">` when count > 0; plain text when 0 |
| Page background | `bg-background` = cream `#faf8f4` |

---

## 14.1 Admin Overview — tile hub

**Route:** `/2/overview` (or `/2/admin`, depending on build)
**Prior spec §15.1 correction:** the prior spec grouped cards incorrectly and omitted 9 of the 21 cards. The screenshot analysis is authoritative.

### 14.1.1 Page layout

- Full-width page with the horizontal sub-nav above.
- Below the sub-nav: the tile grid occupies the full content area, divided into **5 named sections**.
- Each section has a bold section heading, followed by a horizontal row of card tiles.
- Tiles are a fixed size with consistent padding; they do not wrap to a second row within a section in the observed state.
- Each tile is a clickable card that navigates to the corresponding admin sub-tab route.

### 14.1.2 Complete 21-card inventory

#### Section 1 — Lead Distribution (3 cards)

| Card title | Icon | Description text (verbatim from screenshot) | Target route |
|---|---|---|---|
| Lead Flow | funnel/arrow icon | Configure how new leads enter and are routed to agents | `/2/lead-flow` |
| Groups | people-group icon | Create named groups of agents for lead distribution | `/2/groups` |
| Ponds | water/pond icon | Create shared lead pools team members can claim from | `/2/ponds` |

#### Section 2 — Follow Up (4 cards)

| Card title | Icon | Description text (verbatim) | Target route |
|---|---|---|---|
| Action Plans | steps/list icon | Create multi-step follow-up sequences for your leads | `/2/action-plans` |
| Automations | lightning-bolt icon | Build automated workflows triggered by lead actions | `/2/automations/2` |
| Email Templates | envelope icon | Create reusable email templates for your team | `/2/email-templates` |
| Text Templates | speech-bubble icon | Create reusable text message templates | `/2/text-templates` |

#### Section 3 — Account (6 cards)

| Card title | Icon | Description text (verbatim) | Warning state | Target route |
|---|---|---|---|---|
| Business Registration | document/shield icon | Register your business for A2P 10DLC text messaging compliance | ⚠️ yellow warning icon (A2P incomplete for this account) | `/2/business-registration` |
| Team | people icon | Manage your team members, roles, and permissions | — | `/2/teams` |
| Import | upload icon | Import contacts from a CSV or other source | — | `/2/import` |
| Phone Numbers | phone icon | Manage your virtual phone numbers for calling and texting | — | `/2/phone-numbers` |
| Company | building icon | Configure your company name, address, and timezone | — | `/2/company-settings` |
| Email Domain Authentication | envelope-check icon | Verify your sending domain for email deliverability | — | `/2/email-domain-authentication` |

> **Note:** Business Registration card has a yellow ⚠️ warning badge/icon on the tile. This is a state — not a static decoration. It appears when A2P 10DLC registration is incomplete. When registration is complete, the warning disappears. [screenshot shot-33 confirmed]

#### Section 4 — Integrations (4 cards)

| Card title | Icon | Description text (verbatim) | Target route |
|---|---|---|---|
| API Keys & Lead Email | key icon | Manage API keys and your FUB lead email address | `/2/api` |
| Pixel | pixel/code icon | Install the FUB Pixel on your website to track visitor activity | `/2/pixel` |
| IDX Integrations | link icon | Connect your IDX or real estate website provider | `/2/idx-integrations` |
| All Integrations | grid/puzzle icon | Connect email marketing, Facebook, Zillow, Dotloop, and more | `/2/all-integrations` |

#### Section 5 — Customize (4 cards)

| Card title | Icon | Description text (verbatim) | Target route |
|---|---|---|---|
| Custom Fields | fields/columns icon | Add custom data fields to contact records | `/2/custom-fields` |
| Custom Stages | stages icon | Create and reorder your lead lifecycle stages | `/2/stages` |
| Tags | tag icon | Manage your contact tags and auto-tagging rules | `/2/tags` |
| Appointment Stages | calendar-check icon | Configure appointment types and outcomes | `/2/appointment-stages` |

### 14.1.3 Admin Overview acceptance criteria

- [ ] All 21 cards render, grouped under their exact 5 section headings, in the order documented above.
- [ ] Each card is clickable and navigates to its target route.
- [ ] Business Registration card displays a yellow ⚠️ warning icon when A2P status is incomplete; icon is absent when complete.
- [ ] Cards use the Ryan Realty `<Card>` component with navy/cream tokens; no FUB teal palette.
- [ ] Section headings are Geist 600, sentence case.
- [ ] Page is read-only navigation (no mutations on this page).

---

## 14.2 Stages

**Route:** `/2/stages` (Admin > Custom Stages)
**Prior spec §15.6 corrections:**
- Prior spec listed "Seller Prospect" as not protected. GIF evidence (feat2, admin4) confirms Seller Prospect **is** system-protected (no edit/delete icons). There are **4** system-protected stages, not 3. (FUB docs officially document only 3 system stages — Lead, Closed, Trash — but the Ryan Realty account has "Seller Prospect" also configured as protected. This may be a custom FUB account configuration or an undocumented 4th protection. The GIF evidence is authoritative for the Ryan Realty build target.)
- Prior spec did not indicate that "People" count is a clickable hyperlink when > 0.

### 14.2.1 Page layout

- Content appears in a **card panel** approximately 60% of the viewport width, left-aligned, with the right side of the page empty. [screenshot shot-38]
- Page heading: "Stages" (Geist 600 or Amboqia display heading)
- Primary action button: **"Add Stage"** — teal pill button (in Ryan Realty build: `<Button variant="default">` navy). Positioned top-right of the card panel.
- Below heading: the stages table.

### 14.2.2 Table columns

| Column | Width | Sortable | Notes |
|---|---|---|---|
| (drag handle) | narrow | — | 6-dot 2×3 grid; always visible; cursor changes to grab on hover |
| Stage Name | flexible | — | Plain text label; editable via pencil icon in Actions |
| People | fixed | — | Blue hyperlink when count > 0 (navigates to filtered People list); plain "0" when zero |
| Actions | fixed | — | Edit (pencil) + Delete (trash) icons; both absent on system-protected rows |

### 14.2.3 Complete Ryan Realty stage inventory (16 stages)

Ordered as observed in the UI (drag-to-reorder by account admin):

| # | Stage Name | People count | System-protected | Notes |
|---|---|---|---|---|
| 1 | Seller Prospect | 7,523 | YES — no edit/delete icons | [GIF feat2 + admin4 confirm; overrides shot-38 which shows edit/delete — GIF is authoritative] |
| 2 | Lead | 8,243 | YES | [FUB docs confirm: all new contacts auto-enter Lead stage] |
| 3 | A - Hot 1-3 Months | 2 | no | Custom stage |
| 4 | B - Warm 3-6 Months | 0 | no | Custom stage |
| 5 | C - Cold 6+ Months | 46 | no | Custom stage |
| 6 | Renter - future buyer | 0 | no | Custom stage |
| 7 | Active Client | 8 | no | Default FUB stage (renamed or adopted) |
| 8 | Pending | 0 | no | Custom stage |
| 9 | Past Client | 21 | no | Default FUB stage |
| 10 | Sphere | 0 | no | Default FUB stage |
| 11 | Archive | 2 | no | Custom stage |
| 12 | Closed | 0 | YES | [FUB docs confirm] |
| 13 | Trash | 47 | YES | [FUB docs confirm; contacts in Trash hidden from smart lists + action plans paused] |
| 14 | Real Estate Agent | 2,342 | no | Custom stage (non-buyer/seller audience) |
| 15 | Vendor | 1 | no | Custom stage |
| 16 | Nurture | 0 | no | Default FUB stage |

> **Seller Prospect discrepancy note:** shot-38 (static screenshot) shows edit/delete icons on the Seller Prospect row, suggesting it was not protected at that capture moment. GIF analyses (feat2.md, admin4.md) show no edit/delete on Seller Prospect across multiple frame captures. Per task instructions, GIF evidence overrides static screenshot for dynamic state. The build spec treats Seller Prospect as system-protected. If this protection can be toggled at the FUB account level (not confirmed by docs), the in-house CRM should expose an `is_system` boolean that is account-owner-settable for non-FUB-native protected stages. [inferred]

### 14.2.4 Add Stage flow

- Clicking "Add Stage": opens a modal or inline form. [inferred from FUB docs — "click Add Stage, enter name, optional description, click Update Stage"]
- Fields: Stage Name (text, required), Description (text, optional).
- On save: new stage appended to end of list with `orderWeight` calculated at `max_existing + 1000`. [FUB docs]
- New stage has no people count (shows "0").
- New stage is not system-protected (edit + delete icons visible).

### 14.2.5 Edit Stage flow

- Pencil icon in Actions column: opens edit form (same fields as Add Stage).
- System-protected stages: pencil icon is absent; no edit path in UI.
- Via API: `PUT /v1/stages/:id` blocked if `isProtected: true` — name field rejected. [FUB docs]

### 14.2.6 Delete Stage flow

- Trash icon in Actions column: initiates deletion.
- **Deletion is blocked if stage has any contacts.** UI requires user to first reassign all contacts to another stage. A modal appears prompting reassignment target selection before deletion can proceed. [FUB docs]
- System-protected stages: trash icon is absent; no delete path in UI.

### 14.2.7 Drag-to-reorder

- Drag handle (6-dot grip) in first column: enables vertical drag-and-drop reordering of non-protected stages.
- `orderWeight` values recalculate to maintain 1000-unit gaps after each reorder. [FUB docs]
- Reorder fires `stageUpdated` webhook event. [FUB docs]

### 14.2.8 Stages — data model (in-house CRM)

Maps to `crm_stages` table. Required fields:

| Field | Type | Notes |
|---|---|---|
| `id` | int / uuid | Primary key |
| `name` | varchar(255) | Display name |
| `description` | text | Optional |
| `order_weight` | int | 1000-unit gaps; recalculated on reorder |
| `is_system` | boolean | `true` → name immutable, no UI delete; seeded for Lead, Closed, Trash, (Seller Prospect in RR account) |
| `is_protected` | boolean | Alias/synonym for `is_system`; `true` blocks PUT name + DELETE via API |
| `people_count` | int | Denormalized count for display; refresh on stage assignment changes |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

System webhook events to emit on config changes: `stageCreated`, `stageUpdated`, `stageDeleted`. [FUB docs]
Person-level event to emit on stage change: `peopleStageUpdated`. [FUB docs]

### 14.2.9 Business logic: Trash stage behavior

When a contact is moved to Trash:
1. Contact is **hidden from all smart list queries** by default (smart lists must exclude `stage = 'Trash'` unless explicitly filtering for it).
2. All **running action plans for that contact are paused** automatically.
3. **Tasks** associated with the contact remain accessible and are NOT hidden or deleted.

When a contact is moved OUT of Trash (un-trashed):
1. Contact re-appears in smart lists per normal filter logic.
2. Previously paused action plans must be manually re-enrolled (they do not auto-resume). [FUB docs]

### 14.2.10 Business logic: all new contacts auto-enter Lead stage

Regardless of source or ingest method, every net-new contact record created in the system enters the `Lead` stage on creation. Stage is then modified by Lead Flow rules, automations, or manual assignment. [FUB docs]

### 14.2.11 Stage change tracking

The Change Log on a contact's profile records stage changes. Fields tracked: Name, Phone Number, Email, Address, Stage, Source, Price, Timeframe, Background. Includes: who changed it and when. [FUB docs]

### 14.2.12 Mass action: stage change

Stage can be changed in bulk via the People screen mass-action tool (select contacts > change stage). Tags and custom fields cannot be bulk-changed via mass actions. [FUB docs]

### 14.2.13 Default Smart Lists that reference stages (build-time awareness)

If the team customizes or renames default FUB stages (e.g., "Hot Prospect"), the following default smart lists may break and require manual update:

| Smart List | Stage(s) referenced |
|---|---|
| Today's Leads | Lead (created today) |
| Clients | Active Client |
| Leads/Daily | Lead (created within 10 days, no contact in 12+ hours) |
| Hot/2xs Week | Hot Prospect (renamed in RR to "A - Hot 1-3 Months" — this smart list needs update) |
| Nurture/monthly | Nurture |
| PC/SOI/quarterly | Past Clients + Sphere |
| Stale Leads | Lead (older than 10 days) |

[FUB docs — smart lists reference stage names by value; builder must map RR custom names to these defaults or rebuild the default smart lists with the correct stage names]

### 14.2.14 Stages acceptance criteria

- [ ] Stages table renders with all 4 columns: drag-handle, Stage Name, People (hyperlink), Actions.
- [ ] All 16 Ryan Realty stages render in documented order with accurate people counts.
- [ ] 4 system-protected stages (Lead, Closed, Trash, Seller Prospect) show no edit or delete icons.
- [ ] 12 non-protected stages show both pencil (edit) and trash (delete) icons.
- [ ] People count > 0 renders as a clickable blue hyperlink to filtered People list.
- [ ] People count = 0 renders as plain text "0" (not a link).
- [ ] Drag-handle on all rows; reorder is blocked for system-protected rows (they cannot be moved). [inferred — system stages likely have fixed positions]
- [ ] "Add Stage" opens modal/form with Name + Description fields; saves to end of list.
- [ ] Delete is blocked with a reassignment prompt when stage has > 0 people.
- [ ] System stages cannot be renamed or deleted via UI or API.
- [ ] Moving a contact to Trash: hides from smart lists, pauses action plans, preserves tasks.
- [ ] All new contacts auto-enter Lead stage on creation.
- [ ] Stage changes emit `peopleStageUpdated` event.
- [ ] Config changes emit `stageCreated` / `stageUpdated` / `stageDeleted` events.
- [ ] `orderWeight` recalculates to 1000-unit gaps after any reorder or insert.

---

## 14.3 Tags

**Route:** `/2/tags` (Admin > Tags)
**Prior spec §15.7 correction:** prior spec described the bulk-delete mechanism vaguely. The screenshot and GIF analyses show a trash icon next to the count/header area for bulk delete.

### 14.3.1 Page layout

- Page heading: **"1,486 Tags"** — count in large heading. Count updates in real time as tags are added/deleted. [screenshot shot-39]
- Next to heading: trash icon for **bulk delete of selected tags**. [screenshot shot-39]
- Below heading / to the right: blue hyperlink **"Turn on auto-tagging new leads"** — opens the auto-tagging configuration panel. [screenshot shot-39]
- Search input: **"Search tags"** placeholder — full-width or prominent search field. Real-time filtering as user types (confirmed: typing "buyer" immediately filters list to tags containing "buyer"). [GIF admin4]
- Below search: the tags table.

### 14.3.2 Table columns

| Column | Width | Notes |
|---|---|---|
| Checkbox | narrow | Select individual tag for bulk operations; header checkbox selects all visible |
| Name ↑ | flexible | Tag name; sorted ascending (A–Z) by default; the ↑ arrow indicates current sort direction |
| Used | fixed | Count of contacts with this tag; clickable hyperlink when > 0 (navigates to filtered People list) |
| Actions | fixed | Edit (pencil) + Delete (trash) per row |

### 14.3.3 Observed tag inventory (verbatim from screenshots + GIFs)

**From screenshot shot-39 (16 rows visible, sorted A–Z at page load):**

| Tag Name | Used count | Notes |
|---|---|---|
| 1M | 1,952 | Price-tier tag |
| 2M | 200 | Price-tier tag |
| 3M | 33 | Price-tier tag |
| 4M | 8 | Price-tier tag |
| 5M+ | 6 | Price-tier tag |
| Absentee Owner | 21 | Audience/behavior tag (Title Case) |
| Active Search | 1 | Behavior tag (Title Case) |
| area:bend-westside | 7,674 | Colon-prefixed geographic tag |
| Area: Redmond | 1 | Alternate colon-prefix format (space after colon, Title Case area name) |
| audience:broker-recruit | 233 | Colon-prefixed audience segment |
| audience:buyer | 42 | Colon-prefixed audience segment |
| audience:seller | 3,508 | Highest-use audience tag |
| auto:brand-voice:plain-honest | 204 | Nested colon-prefixed automation tag |
| auto:seller-seq:new | 60 | Nested colon-prefixed automation tag |
| auto:seller-seq:watch | 144 | Nested colon-prefixed automation tag |
| absentee | 1,809 | Lowercase single-word behavior tag (distinct from "Absentee Owner" above — different tag) |

**Additional tags observed in GIF admin4 (filtered to "buyer" search):**

| Tag Name | Used count (GIF capture) | Notes |
|---|---|---|
| area-bend-westside | 1,874 | Hyphen-separated variant — distinct from `area:bend-westside` (colon) above [GIF admin4] |

> **Tag naming discrepancy note:** `area:bend-westside` (colon, 7,674 used) and `area-bend-westside` (hyphen, 1,874 used) appear to be two different tags that co-exist in the system. The colon variant is the canonical prefix-namespaced format per §14.3.4 below. The hyphen variant may be a legacy or integration-generated alternate. Both exist in the Ryan Realty account. The in-house CRM should display both as entered (no normalization of user-defined tag names).

### 14.3.4 Tag prefix taxonomy (Ryan Realty namespacing convention)

Tags use `prefix:value` namespacing for organization and queryability. This is a convention, not a system-enforced constraint — the colon has no special meaning to FUB; it is purely a display/search convention. [prior spec §17.2 + screenshot confirmation]

| Prefix | Meaning | Examples |
|---|---|---|
| `area:` | Geographic area of interest | `area:bend-westside`, `area:redmond`, `area:sisters` |
| `audience:` | Audience segment | `audience:seller`, `audience:buyer`, `audience:broker-recruit` |
| `auto:` | Applied by automation | `auto:brand-voice:plain-honest`, `auto:seller-seq:new`, `auto:seller-seq:watch` |
| `(price tier)` | Price range (bare number) | `1M`, `2M`, `3M`, `4M`, `5M+` |
| `(behavior)` | Single-word behaviors | `absentee`, `Absentee Owner`, `Active Search` |
| `(compliance)` | Do-not-contact flags | `contact:do-not-text`, `contact:do-not-call`, `compliance:hard-stop` |

Note: nested colons are valid and observed (`auto:brand-voice:plain-honest`, `auto:seller-seq:new`). These should not be split or parsed by the CRM — treat the entire tag name as an opaque string.

### 14.3.5 Total tag count

**1,486 tags** as observed at screenshot capture time. [screenshot shot-39]

### 14.3.6 Auto-tagging configuration

**Trigger:** clicking "Turn on auto-tagging new leads" link (or accessing via a sub-panel).

#### Configurable auto-tag rules (account-level toggle per rule)

| Auto-tag | Trigger event |
|---|---|
| City of inquiry address | Lead arrives with an address; city gets auto-tagged |
| Zip code of inquiry address | Lead arrives with an address; zip gets auto-tagged |
| City of addresses viewed on site | Site visitor views a property listing |
| Zip of addresses viewed on site | Site visitor views a property listing |
| City of saved/favorited addresses | Lead saves/favorites a property on site |
| Zip of saved/favorited addresses | Lead saves/favorites a property on site |

[FUB docs — all 6 are configurable; each has an individual on/off toggle; master toggle "Turn on auto-tagging new leads" enables/disables the feature as a whole]

Configuration save: "Update Auto-tagging" button. [FUB docs]

#### System auto-tags (non-configurable, always on)

| Tag name | Trigger |
|---|---|
| Seller Lead | Lead classified as seller via integration |
| Bounced email | Email to contact bounced |
| Unsubscribed | Contact unsubscribed from emails |
| [Deleted Agent Name] | Agent is deleted from the account; their contacts get tagged with the agent's name |

These tags cannot be disabled regardless of the auto-tagging toggle. "Bounced email" and "Unsubscribed" are compliance-adjacent and must be preserved. [FUB docs]

### 14.3.7 Tag management operations

**Add tag (from admin):** No "Add Tag" button observed on the Admin > Tags page. Tags are created when applied to a contact: Lead Profile > Details > "Add Tag" field. [FUB docs]

**Edit tag name:** Pencil icon in Actions column; change name; save. All contacts with this tag are updated immediately (tag is by reference, not by copy). [FUB docs]

**Delete single tag:** Trash icon in Actions column; confirm. Removes tag from all contacts that had it. A deleted tag becomes non-linkable if all associated contacts are in Trash. [FUB docs]

**Bulk delete:** Select checkboxes on multiple tags > click trash icon next to "Clear Selection" (near the count heading). [screenshot — trash icon visible next to heading; FUB docs confirm bulk delete via checkbox + trash]

**Search:** Real-time filter by tag name. Filters the visible list as user types; no submit required. [GIF admin4]

**Sort:** Default A–Z on Name. The ↑ arrow on the Name column header indicates ascending sort. [screenshot shot-39]

**Hover to see who added a tag:** On a contact's profile, hovering a tag shows who added it and when (for tags added after June 14, 2021). This is a per-contact-profile interaction, not an admin Tags page feature. [FUB docs]

### 14.3.8 Tags — data model (in-house CRM)

Maps to `crm_tags` (tag definitions) and a many-to-many join table `crm_contact_tags`. Required fields:

**`crm_tags` (definitions):**

| Field | Type | Notes |
|---|---|---|
| `id` | int / uuid | Primary key |
| `name` | varchar(64) | Max 64 characters per FUB docs; unique |
| `used_count` | int | Denormalized; refresh on add/remove |
| `is_system` | boolean | `true` for Bounced email, Unsubscribed, Deleted Agent Name tags |
| `created_at` | timestamptz | |

**`crm_contact_tags` (join):**

| Field | Type | Notes |
|---|---|---|
| `contact_id` | fk → crm_people | |
| `tag_id` | fk → crm_tags | |
| `added_by` | fk → users | Who applied this tag to this contact |
| `added_at` | timestamptz | When this tag was applied to this contact (supports hover-reveal) |

**API semantics:**
- Tags on a person are an array of strings in the people object.
- `PUT /v1/people/:id` with `tags: [...]` **overwrites all tags** by default. [FUB docs — critical gotcha]
- `PUT /v1/people/:id?mergeTags=true` **unions** the incoming array with existing tags (does not delete unmentioned tags). [FUB docs]
- `mergeTags` default = `false`. [FUB docs]
- In-house CRM must implement `mergeTags` semantics on the `PATCH /contacts/:id` endpoint to prevent accidental tag erasure by integrations.

Webhook event on tag add: `peopleTagsCreated`. No `peopleTagsDeleted` event is documented. [FUB docs]

### 14.3.9 Tags acceptance criteria

- [ ] Tags page header displays current count ("1,486 Tags" or current live count).
- [ ] Trash icon adjacent to count heading enables bulk delete of selected tags.
- [ ] "Turn on auto-tagging new leads" link opens auto-tagging configuration with 6 configurable rules + master toggle.
- [ ] Auto-tagging configuration has an "Update Auto-tagging" save button.
- [ ] Search input filters the tag list in real time as user types.
- [ ] Table columns: checkbox, Name ↑ (A–Z default sort), Used (hyperlink when > 0), Actions (pencil + trash).
- [ ] Clicking "Used" count navigates to filtered People list showing contacts with that tag.
- [ ] Edit (pencil) renames tag globally across all contacts.
- [ ] Delete (trash) removes tag from all contacts with a confirmation step.
- [ ] Bulk delete: checkbox-select multiple + bulk trash icon removes all selected.
- [ ] 64-character limit enforced on tag name input.
- [ ] System tags (Bounced email, Unsubscribed) are non-deletable (no trash icon). [FUB docs]
- [ ] API: `PUT /contacts/:id` with `tags` array replaces all tags unless `?mergeTags=true` is included.
- [ ] `peopleTagsCreated` webhook event fires on tag application.
- [ ] Tag names preserve exact case and colon/hyphen characters as entered.

---

## 14.4 Custom Fields

**Route:** `/2/custom-fields` (Admin > Custom Fields)
**Prior spec §15.5 correction:** prior spec listed 4 types as "Text/Number/Date/Select"; the correct FUB type name is "Dropdown" (not "Select"). Screenshot column header shows "Type" column with values "Text", "Number", "Date"; "Dropdown" type is documented in FUB docs. The ▾ dropdown indicator on the Custom Fields tab header may indicate a sub-tab switcher between People fields and Deal fields. [GIF admin3]

### 14.4.1 Page layout

- Page heading: **"64 Custom Fields"** — count in large heading. [screenshot shot-44]
- Primary action button: **"Add Custom Field"** — teal pill button (Ryan Realty: `<Button variant="default">`). Top-right of content area. [screenshot shot-44]
- The Custom Fields tab in the sub-nav has a **▾ dropdown indicator**, suggesting it may expand to sub-options (possibly to switch between People custom fields and Deal custom fields). [GIF admin3 — observed but not confirmed to navigate]
- Below heading: the custom fields table.

### 14.4.2 Table columns

| Column | Width | Notes |
|---|---|---|
| (drag handle) | narrow | 6-dot 2×3 grip; vertical reorder |
| Field Name | flexible | Human-readable label |
| Type | fixed | Text / Number / Date / Dropdown |
| People | fixed | Count of contacts with a value in this field; hyperlink when > 0 |
| Hide if empty (?tooltip) | fixed | Inline `<Checkbox>`; auto-saves on toggle; ? icon provides tooltip explanation |
| Read-only (?tooltip) | fixed | Inline `<Checkbox>`; auto-saves on toggle; ? icon provides tooltip explanation |
| Action | fixed | Edit (pencil) + Delete (trash) |

> The `?` icons next to "Hide if empty" and "Read-only" column headers are tooltip triggers. Hovering or clicking shows an explanation. This is the `<Tooltip>` from `@/components/ui/tooltip` in Ryan Realty build. [screenshot shot-44]

### 14.4.3 Complete observed field inventory (18 rows visible in shot-44 mid-scroll view)

All 18 rows from the screenshot, in order:

| # | Field Name | Type | People count | Notes |
|---|---|---|---|---|
| 1 | Recently Divorced | Text | 0 | Demographic enrichment field |
| 2 | Recently Moved | Text | 0 | Demographic enrichment field |
| 3 | Enrichment Provider | Text | 5,851 | High-use; tracks which enrichment service populated data |
| 4 | Phone Type | Text | 4,843 | High-use; cell/landline/etc. |
| 5 | Net Worth Range | Text | 0 | Demographic enrichment |
| 6 | Income Range | Text | 0 | Demographic enrichment |
| 7 | Occupation | Text | 0 | Demographic enrichment |
| 8 | Has Children | Text | 0 | Demographic enrichment |
| 9 | Household Size | Number | 0 | Demographic enrichment |
| 10 | Marital Status | Text | 0 | Demographic enrichment |
| 11 | Gender | Text | 0 | Demographic enrichment |
| 12 | Birthday | Date | 0 | Date type; likely `isRecurring: true` [FUB docs — recurring dates fire annually] |
| 13 | Owner Age Range | Text | 0 | Demographic enrichment |
| 14 | Owner Age | Number | 0 | Demographic enrichment |
| 15 | Include In FB CAS | Text | 7,255 | Highest-use field; Facebook Custom Audience Sync flag |
| 16 | Realtor License Type | Text | 163 | Agent/competitor tracking |
| 17 | Realtor License | Text | 163 | Agent/competitor tracking |
| 18 | Brokerage | Text | 163 | Agent/competitor tracking |

**Additional high-use fields referenced in prior spec (not visible in mid-scroll shot but part of 64 total):**

| Field Name | People count | Notes |
|---|---|---|
| (fields 1–17 above the scroll position) | various | Not captured in shot-44; exist per 64-field total |

### 14.4.4 Field types — spec

Four field types, fixed at creation; type cannot be changed after creation. [FUB docs]

| Type | Accepts | Validation | API `type` value | Notes |
|---|---|---|---|---|
| `text` | Any string | Max 256 characters | `"text"` | Most common type |
| `number` | Whole integers only | No decimals | `"number"` | |
| `date` | Date (MM/DD/YY or MM/DD/YYYY) | Valid date | `"date"` | Has `isRecurring` sub-flag; see below |
| `dropdown` | Values from defined `choices` array only | Only choices values accepted | `"dropdown"` | Choices defined at creation; choices array updatable later via API |

**`isRecurring` flag (date fields only):**

| Value | Behavior | Use case |
|---|---|---|
| `true` | Fires calendar reminders annually on the date's month+day | Birthday, anniversary |
| `false` | Fires once for the specific calendar date | Closing date, contract expiry |

`isRecurring` can be changed post-creation via API (unlike `type`). [FUB docs]

**`dropdownChoiceMap` (dropdown fields only):**
When updating the choices array of a dropdown field after contacts already have values stored, existing values may become orphaned. The `dropdownChoiceMap` array of int32s remaps existing stored values to new choice positions. Must be included when removing or reordering choices. [FUB docs — critical data-integrity detail]

### 14.4.5 Field-level options

| Option | API field | Default | Mutable after creation? | Notes |
|---|---|---|---|---|
| Label (display name) | `label` | required | YES | Rename via UI or API |
| Type | `type` | required | NO — immutable | Cannot be changed after creation; make this clear in UI at creation time |
| Recurring (date only) | `isRecurring` | false | YES (API only) | |
| Dropdown choices | `choices` | n/a | YES | Choices array for dropdown type |
| Hide if empty | `hideIfEmpty` | false | YES | Inline checkbox in table |
| Read-only | `readOnly` | false | YES | Inline checkbox in table |
| Display order | `orderWeight` | auto | YES | Drag-to-reorder; 1000-unit gaps |

**`name` vs `label` distinction (critical API gotcha):** [FUB docs]
- `label` = human-readable display name (e.g., "Include In FB CAS")
- `name` = system-generated API identifier (e.g., `customIncludeInFbCas`)
- When writing values via API (`POST /v1/events`, `PUT /v1/people`), always use `name` (the API identifier), NOT `label`. Using `label` silently fails to write the field.
- `name` is generated from `label` at creation time. If `label` is later renamed, `name` does NOT change. They can diverge.

### 14.4.6 `hideIfEmpty` behavior

When `hideIfEmpty = true`, the field's row in the contact's left sidebar **must be entirely absent** (not just blank) when the field value is null or empty string. It must not render an empty label row. When a value is present, the row appears normally. [FUB docs]

### 14.4.7 `readOnly` behavior

When `readOnly = true`, the field renders as display-only text in the contact sidebar — no input control. The value can only be written by API (system/integration writes), not by users through the UI. [FUB docs]

### 14.4.8 Add Custom Field flow

- Clicking "Add Custom Field": opens a modal or panel.
- Fields in the creation form:
  - Field Name (label) — required; warn against special chars #, $, @, ! [FUB docs]
  - Type — required dropdown (Text / Number / Date / Dropdown); show helper: "Field type cannot be changed after saving."
  - (If Date) Recurring — checkbox "Repeat annually" or similar
  - (If Dropdown) Choices — multi-value input to define the allowed choices
- On save: new field appended to list. `name` identifier generated from `label`.
- Permission: Account Owner and Admin users. [FUB docs]

### 14.4.9 Edit Custom Field flow

- Pencil icon: opens edit form.
- Editable: label (display name), choices (dropdown only), `isRecurring` (date only), `hideIfEmpty`, `readOnly`, display order.
- NOT editable: `type` — UI should show it as read-only text, not an input.

### 14.4.10 Delete Custom Field flow

- Trash icon: confirm; removes field and all stored values on contacts.
- No documented deletion guard (unlike stages, which block deletion until empty). [FUB docs — not mentioned; inferred that field can be deleted with data]

### 14.4.11 Drag-to-reorder

- Drag handle reorders fields; controls the order fields appear in the contact sidebar's "Custom Fields" section.
- `orderWeight` recalculates to 1000-unit gaps after reorder. [FUB docs]

### 14.4.12 Where custom fields appear

1. **Contact (lead) profile left sidebar** — dedicated "Custom Fields" section.
2. **People list view** — can be enabled as sortable/filterable columns.
3. **Calendar** — date-type fields appear under Filters > Custom Dates.
4. **Email/Text template composer** — available as merge fields; blank if field is empty for contact.
5. **Smart list filters** — fields are filterable criteria.

### 14.4.13 Custom Fields — data model (in-house CRM)

Maps to `crm_field_definitions` (definitions) and a values store. Required fields:

**`crm_field_definitions`:**

| Field | Type | Notes |
|---|---|---|
| `id` | int / uuid | Primary key |
| `label` | varchar(255) | Display name (user-visible) |
| `name` | varchar(255) | API identifier; auto-generated from label at creation; immutable |
| `field_type` | enum | `text` / `number` / `date` / `dropdown` |
| `is_recurring` | boolean | Date fields only; default false |
| `choices` | jsonb (array of strings) | Dropdown fields only |
| `hide_if_empty` | boolean | Default false |
| `read_only` | boolean | Default false |
| `order_weight` | int | 1000-unit gaps |
| `entity_type` | enum | `contact` or `deal` (separate namespaces) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Values storage (`crm_contact_field_values`):**

| Field | Type | Notes |
|---|---|---|
| `contact_id` | fk | |
| `field_id` | fk → crm_field_definitions | |
| `value_text` | text | Populated when field_type = text |
| `value_number` | bigint | Populated when field_type = number |
| `value_date` | date | Populated when field_type = date |
| `value_choice` | text | Populated when field_type = dropdown; must be in choices array |
| `updated_at` | timestamptz | |

Webhook events on definition changes: `customFieldsCreated`, `customFieldsUpdated`, `customFieldsDeleted`. [FUB docs]

### 14.4.14 Custom Fields — special characters constraint

Avoid `#`, `$`, `@`, `!` in field labels. Documented to cause system performance issues. [FUB docs]
Enforce at creation: strip these from the label input or show a warning and block save.

### 14.4.15 Custom Fields — mass update constraint

Custom field values cannot be bulk-changed via mass actions. Must be changed individually per contact or via API. [FUB docs]

### 14.4.16 Custom Fields acceptance criteria

- [ ] Custom Fields page header displays current count ("64 Custom Fields" or live count).
- [ ] "Add Custom Field" button opens form with: Name, Type selector (Text/Number/Date/Dropdown), type-conditional extras (isRecurring for Date, choices for Dropdown).
- [ ] Field type shows helper text "Field type cannot be changed after saving" at creation time.
- [ ] Table renders with all 7 columns: drag-handle, Field Name, Type, People, Hide if empty (?), Read-only (?), Action.
- [ ] People count > 0 is a clickable hyperlink to filtered People list.
- [ ] "Hide if empty" and "Read-only" columns are inline checkboxes that auto-save on toggle.
- [ ] ? tooltip icons on "Hide if empty" and "Read-only" column headers explain the behavior.
- [ ] `hideIfEmpty = true`: field row is completely absent (not blank) on contact profile when empty.
- [ ] `readOnly = true`: field renders as display-only text in contact sidebar; no input control.
- [ ] Edit form shows `type` as read-only (not editable); allows label rename and other mutable options.
- [ ] Drag-to-reorder with `orderWeight` gap recalculation.
- [ ] Dropdown type enforces only-choices-array values in contact sidebar input.
- [ ] Date type with `isRecurring = true` fires annual calendar reminders.
- [ ] Dropdown choices update via API includes `dropdownChoiceMap` support for value remapping.
- [ ] API: `name` identifier is auto-generated from `label` at creation; `name` does not change when `label` is renamed.
- [ ] Contact custom fields and deal custom fields are entirely separate namespaces (separate table/endpoint).
- [ ] Special characters `#`, `$`, `@`, `!` in field labels are warned against or blocked.
- [ ] `customFieldsCreated` / `customFieldsUpdated` / `customFieldsDeleted` webhook events fire.

---

## 14.5 Ponds

**Route:** `/2/ponds` (Admin > Ponds)

### 14.5.1 Page layout

- Page heading: **"Lead Ponds"** (H2-style, Geist 600 or Amboqia display). [screenshot shot-49]
- Primary action button: **"+ Add Pond"** — blue pill button. [screenshot shot-49]
- Contextual help link top-right: **"ⓘ How Ponds work"**. [screenshot shot-49]
- Below heading: the ponds table.
- The table is **not full-width**; it occupies the left portion of the content area with a large gray empty space to the right and below (single pond row). [screenshot shot-49]

### 14.5.2 Loading state (skeleton pattern)

On tab click, the ponds table shows **3 skeleton/shimmer rows** (pre-rendered table structure with animated placeholder bars) before real data loads. This is distinct from the spinner pattern used elsewhere. [GIF feat2 — confirmed]

### 14.5.3 Table columns

| Column | Notes |
|---|---|
| Name | Pond name rendered as a **blue hyperlink** (navigates to the pond's detail view or filtered People list) |
| Pond Lead | Single avatar representing the Pond Lead Agent |
| Team Members | Overlapping avatar stack (2+ avatars); all members with pond access |
| Actions | Edit (pencil) + Delete (trash) icons |

### 14.5.4 Ryan Realty pond inventory (1 pond observed)

| Name | Pond Lead | Team Members | People count |
|---|---|---|---|
| Out Of State Home Owners | Single avatar (older male, silver hair — inferred to be Matt Ryan based on account ownership) | 2 overlapping avatars (female + male, inferred Rebecca Peterson + Paul Stevenson) | Not shown in table; visible in People filtered view |

[screenshot shot-49; GIF feat2 confirmed the pond name and avatar configuration]

### 14.5.5 Add Pond flow

Fields (per FUB docs):
1. **Name** (required) — pond display name
2. **Pond Lead Agent** (required) — select from team members; becomes pseudo-agent for the pond
3. **Team Members** (required) — multi-select team members who have access to claim leads from this pond

On save: pond appears in table; immediately available as a distribution target in Lead Flow and manual assignment.

### 14.5.6 Edit Pond flow

- Pencil icon in Actions column: opens edit form with same fields as Add Pond.
- Can rename, change Pond Lead, or change Team Member roster.

### 14.5.7 Delete Pond flow

- Trash icon: initiates deletion.
- **Requires reassigning all leads to another agent or pond first** (deletion blocked if pond has leads). [FUB docs]

### 14.5.8 Pond Lead Agent behavior

The Pond Lead Agent is the pseudo-agent for the entire pond:
- Receives notifications as if personally assigned to every lead in the pond. [FUB docs]
- Used in Action Plan merge fields (emails/texts from the pond use the Pond Lead Agent's name/number). [FUB docs]
- All action plan tasks reassign to the Pond Lead Agent when a lead enters the pond. [FUB docs]

### 14.5.9 Claiming a lead from a pond

**Individual claim:**
- Lead profile > Details > Agent field > edit pencil > select own name > green checkmark. [FUB docs]

**Mass claim:**
- People > All People > filter to pond > select leads > Mass Actions > Assign Agent > own name. [FUB docs]

**What happens on claim:**
- Agent reassignment documented in lead's timeline.
- Running action plans continue; emails now send from the claiming agent.
- Action plan tasks assigned to "Assigned To Agent" (generic role) reassign to claiming agent.
- Tasks directly assigned to a specific named user remain with the original assignee. [FUB docs]

### 14.5.10 Routing leads to a pond (via Lead Flow)

When a Lead Flow source is configured with a pond as the distribution target:
- All incoming leads from that source land in the pond.
- Pond Lead Agent handles notifications.
- Team members with pond access can see and claim. [FUB docs]

### 14.5.11 Automated routing to a pond

Automations can include a "Reassign lead" action targeting a pond. This enables time-based pond placement (e.g., move unresponsive leads to pond after 90 days of no contact). [FUB docs]

### 14.5.12 Pond permissions by role

| Role | Pond access |
|---|---|
| Agent | Assign leads only to ponds they have explicit access to |
| Admin | Full access to all ponds, with edit control |
| Team Leader | Access to their team's ponds only |
| ISA / Account roles | Access to all ponds |
| Lender | Cannot be assigned to ponds (current limitation) [FUB docs] |

### 14.5.13 Ponds — data model (in-house CRM)

Maps to `crm_ponds` + `crm_pond_members`. Existing in-house tables confirmed. [prior spec §19.1]

**`crm_ponds`:**

| Field | Type | Notes |
|---|---|---|
| `id` | int / uuid | Primary key |
| `name` | varchar(255) | Display name; hyperlink in table |
| `pond_lead_agent_id` | fk → users | The pseudo-agent for the pond |
| `created_at` | timestamptz | |

**`crm_pond_members`:**

| Field | Type | Notes |
|---|---|---|
| `pond_id` | fk → crm_ponds | |
| `user_id` | fk → users | Team member with access |
| `added_at` | timestamptz | |

### 14.5.14 Ponds — reporting limitation

**No reporting or quota tracking for pond activity** is available in FUB natively. This is a documented FUB limitation and a build opportunity for the in-house CRM. [FUB docs]

### 14.5.15 Ponds acceptance criteria

- [ ] Ponds page renders heading "Lead Ponds", "+ Add Pond" button, "ⓘ How Ponds work" help link.
- [ ] On tab click: skeleton loading state (3 shimmer rows) before data; NOT a spinner.
- [ ] Table columns: Name (hyperlink), Pond Lead (single avatar), Team Members (overlapping avatar stack), Actions (pencil + trash).
- [ ] "Out Of State Home Owners" pond renders with correct avatar configuration.
- [ ] Add Pond form collects: Name, Pond Lead Agent (single select), Team Members (multi-select).
- [ ] Delete blocked until all leads reassigned; prompt for reassignment target.
- [ ] Pond Lead Agent receives all pond notifications as pseudo-agent.
- [ ] Action plan merge fields use Pond Lead Agent when contact is in pond.
- [ ] On lead claim: action plan "assigned to agent" tasks reassign to claimer; explicit named-agent tasks stay.
- [ ] Lenders cannot be assigned to ponds.
- [ ] Pond available as a distribution target in Lead Flow configuration.
- [ ] Lead timeline entry created when contact enters or leaves a pond.

---

## 14.6 Lead Flow

**Route:** `/2/lead-flow` (Admin > Lead Flow)

### 14.6.1 Page layout — source list view

- Page heading: "Lead Flow" or similar.
- Primary action: **"+ Add Lead Flow"** button (for manually adding a source before first lead arrives).
- Sources appear as rows in a table or card list.
- Each source entry shows:
  - Source name (e.g., "Ryan-Realty.com")
  - Audience/type descriptor
  - Assigned agent or distribution target
  - "(API)" or method label
  - Lead count (e.g., "83 leads")
  - Last lead info (name + date) or "Waiting for first lead"
  - "View Advanced Rules (N)" link when advanced rules are configured
  - Simple inline controls (Distribution dropdown, Lender dropdown, Automation dropdown) when in simple mode
  - "Archive" button per source

[GIF admin1]

### 14.6.2 Ryan Realty lead sources (4 configured)

| Source Name | Lead Count | Last Lead | Display mode | Notes |
|---|---|---|---|---|
| Ryan-Realty.com | 83 leads | Andy Christensen, 11 days ago | Advanced (3 rules) | Primary website source; "View Advanced Rules (3)" |
| ryanrealty.vercel.app | 5 leads | Lead Deleted | Simple | Development/staging URL |
| expired-listing-cron | 12 leads | Anna Kilgore, 19 days ago | Simple/Advanced | Cron-driven expired listing ingest |
| Expired Listing | 0 leads | "Waiting for first lead" | Simple | Manually pre-configured; no leads yet |

[GIF admin1]

### 14.6.3 Simple mode vs. Advanced mode display

**Simple mode:** Source row shows inline dropdown controls:
- Distribution (agent/group/pond selector)
- Lender (optional selector)
- Automation/Action Plan (optional selector)

**Advanced mode:** Source row shows **"View Advanced Rules (N)"** hyperlink instead of inline controls, where N = number of configured rules. Clicking navigates to the Advanced Rules editor (full-page route, not a modal). [GIF admin1]

### 14.6.4 Advanced Rules editor (Ryan-Realty.com source)

**Navigation:** clicking "View Advanced Rules (3)" on the Ryan-Realty.com source navigates to a full-page route (not a modal or flyout). [GIF admin1]

**Page layout:**
- Full-page content area.
- Heading: source name + "Advanced Settings" or "Lead Flow Rules".
- "Copy From Other Lead Flows" button — copies rules from another source. [GIF admin1 observed; FUB docs confirm]
- Rules list (ordered, top to bottom = processing order).
- Each rule can be drag-reordered (first matching rule wins). [FUB docs]
- "+ Add Rule" or similar action to add a new rule.

**Ryan-Realty.com configured rules:**

| Rule # | Condition | Distribution Target | Stats (at GIF capture) | Notes |
|---|---|---|---|---|
| 1 | Tags include "Rebecca Ryser Peterson" | Rebecca Peterson | 5 leads, last = Tilen Godec, Mar 8 2026 | Agent-attribution rule |
| 2 | Tags include "Paul Stevenson" | Paul Stevenson | 0 leads | Agent-attribution rule |
| Default | (no conditions — catches all unmatched leads) | Matt Ryan | 78 leads, last = Andy Christensen, 11 days ago | Required catch-all |

[GIF admin1]

**Per-rule stats display (live):**
- Lead count assigned via this rule
- Last lead name + date assigned via this rule
- "Add initial text message" link (see §14.6.5)
[GIF admin1]

**Default Rule:**
- Cannot be deleted or moved. [FUB docs]
- Has no conditions (no drag-and-drop — position is fixed at bottom). [inferred from FUB docs + GIF]
- "Add initial text message" link available on Default Rule. [FUB docs]
- Must have Distribution configured. [FUB docs]

### 14.6.5 Lead Flow: Initial Text (Auto-Text)

**Navigation:** Advanced Rules editor > "+ Add initial text message" link on any rule (including Default Rule).

**Configuration fields:**

| Field | Constraint | Notes |
|---|---|---|
| Message body | 300 characters max per FUB docs | Merge fields available for personalization |
| Delay | X minutes after lead entry | |
| Sending number | Agent's FUB number > Company fallback > Team Inbox (if selected) | |

**Quiet hours enforcement (hard rule):**
- No texts sent between **9:00 PM and 8:00 AM** in the **assigned agent's local timezone** (not UTC, not account timezone).
- Texts hitting the quiet window are queued and send at 8:00 AM the following morning.
- If any outbound communication (text, email, or call) occurs before 8:00 AM send time, the queued text is **automatically cancelled**.
- Known bug: mobile apps (iOS/Android) display queued texts as already sent. [FUB docs]
- Manual cancellation: click cancel link on the text item in the lead's timeline.
- If lead is reassigned before 8:00 AM, queued text still sends from original agent. [FUB docs]

**Condition requirement:**
- An initial text **cannot be saved** on a rule that has no conditions configured. Exception: the Default Rule can have an initial text without conditions. [FUB docs]
- UI must enforce this: show an error or disable the save if rule has no conditions and is not the Default Rule.

**Lead types that receive auto-text:**
- Leads who registered on the website
- Leads who made property, general, or seller inquiries
- Open-house visitors
[FUB docs]

### 14.6.6 Advanced rule criteria (7 available fields)

| Criterion | Data source priority |
|---|---|
| Tags | Tags already on the lead |
| Price | Property inquiry price |
| City | Property data > lead address > tags |
| State | Property data > lead address > tags |
| ZIP Code | Property data > lead address > tags |
| MLS Number | MLS # from property inquiry |
| Phone Number | Whether phone is present / matches pattern |

[FUB docs]

**Match logic per rule:** "All" (AND) or "Any" (OR) toggle. [FUB docs]
**Processing order:** Top to bottom; first matching rule wins. [FUB docs]
**Default Rule:** Required; catches all leads that don't match any rule. [FUB docs]

### 14.6.7 "Copy From Other Lead Flows" feature

- Copies all rules (conditions + distributions) from another source.
- Avoids re-building duplicate configurations when multiple sources should have identical routing.
[GIF admin1; FUB docs confirm]

### 14.6.8 How new leads enter — three ingest channels

**Channel A: Email parsing (connected inbox)**
- `Admin > API > Lead Processing` toggle ON.
- FUB (in-house CRM) monitors a connected Gmail/M365 inbox.
- Recognized lead notification emails from supported providers are parsed and create/update contacts.
- Account owner: auto-enabled when email is connected. Agents: must manually enable. [FUB docs]

**Channel B: @followupboss.me routing address (or equivalent)**
- Every user has a unique routing email ending in `@crm-domain.com`.
- Lead notification emails sent to this address are parsed and assigned to that user. [FUB docs]
- Ryan Realty's FUB lead email: `ryan.realty@followupboss.me`. [GIF feat2 — confirmed]

**Email parser format levels (3 tiers):**

| Format | Fields |
|---|---|
| Short | Name, Email, Phone |
| Full | Name, Email, Phone, Price, Source, Notes |
| Advanced | Full set including First/Last Name, Source URL, Tags, Lead Stage, Message, Address fields, UTM Campaign tracking (Source/Medium/Term/Content/Campaign), and more |

All fields in the chosen format must be present in the email even if blank — deleting empty fields breaks parsing. [FUB docs — critical gotcha]

**Channel C: API / webhook / direct integrations**
- Native API integrations (~200 providers), custom API, Zapier.
- Pixel (website registration tracking): JS snippet in `<head>` captures form submissions + page views. [FUB docs]

### 14.6.9 Add Lead Flow (manual source creation)

**Fields:**
- Source type: My Website / Facebook / Zapier / Custom API Integration / Real Estate Lead Provider
- Notification delivery: Connected Email OR Lead Email Address
- Distribution (agent/group/pond)
- Action Plan
- Advanced Settings: Lead Type (Buyer/Seller), Delivery method (Email or API)

**Auto-archive rules:**
- Manually created source: auto-archives after **30 days** of inactivity (no leads + no edits). [FUB docs]
- All sources: auto-archive after **90 days** without new leads. [FUB docs]

### 14.6.10 Source archive / unarchive

**Two archive modes:**
1. **Just Archive** — removes from active Lead Flow view. If a new lead arrives, source auto-unarchives and processes using existing rules. [FUB docs]
2. **Archive and Ignore** — removes from view AND prevents future leads from that source from being created. This is not auto-unarchivable. [FUB docs — "irreversible until manually unarchived"]

**Viewing archived sources:** Admin > Lead Flow > Archived (upper-right corner). [FUB docs]

### 14.6.11 Source deletion

**Path:** Reporting > Lead Sources (filter to Everyone / All Leads / All Time) > Delete > select replacement source for existing contacts. [FUB docs]
**Permission:** Owner and Admin only. [FUB docs]
**Background job:** contacts reassigned in background; may take several minutes. [FUB docs]

### 14.6.12 Lead deduplication on ingest

**Automatic dedup matching:**
- Email address matches existing contact, OR
- Phone number AND first + last name match existing contact.

**Merge behavior (additive):**
- No data deleted or overridden.
- Conflicting data appears as notes in timeline.
- Timeline note documents what was merged.

**Returning lead (existing contact with new inquiry):**
- Original lead source NOT changed.
- Lead NOT reassigned.
- Existing profile updated with new inquiry data.
- Assigned agent notified via their notification settings.
- Action plans NOT restarted.
- New inquiry triggers Automations (not Lead Flow — Lead Flow is for new contacts only). [FUB docs]

**Manual merge:**
- Search > select duplicates > confirm "Main Person" > merge.

**Dedup OR logic:** Matches on email OR (phone + full name) — not AND. [FUB docs]

### 14.6.13 Lead assignment — Pause Leads

**Location:** Admin > Team > Pause Leads column checkbox. Admin-only control.

| Distribution Type | Behavior when agent is paused |
|---|---|
| Round Robin group | Leads route to other active members |
| First to Claim group | Paused agent doesn't get notifications and cannot claim; if all members paused, lead goes to group's default user |
| Advanced Lead Flow rule (matched agent) | Leads fall back to Default Rule; if all group members paused, falls back to Default Rule then account owner |

**Exceptions — pause does NOT apply to:**
- Leads arriving via agent's individual email addresses
- Leads from connected Google accounts
- Leads assigned via agent's own API key
- Leads assigned directly via API
[FUB docs]

### 14.6.14 Lead Flow — data model (in-house CRM)

Maps to `crm_assignment_config` + `crm_assignment_rules`. [prior spec §19.1]

**`crm_lead_sources`:**

| Field | Type | Notes |
|---|---|---|
| `id` | int / uuid | |
| `name` | varchar(255) | Source name (e.g., "Ryan-Realty.com") |
| `source_type` | enum | `website` / `facebook` / `zapier` / `api` / `provider` |
| `delivery_method` | enum | `email` / `api` |
| `status` | enum | `active` / `archived` / `archived_ignore` |
| `default_agent_id` | fk → users | Default distribution (used in simple mode) |
| `default_group_id` | fk → crm_groups | |
| `default_pond_id` | fk → crm_ponds | |
| `default_action_plan_id` | fk → crm_sequences | |
| `lead_count` | int | Denormalized |
| `last_lead_at` | timestamptz | For auto-archive timer |
| `last_lead_name` | varchar | Display in UI |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | For manual-source 30-day inactivity timer |

**`crm_assignment_rules`:**

| Field | Type | Notes |
|---|---|---|
| `id` | int / uuid | |
| `source_id` | fk → crm_lead_sources | |
| `order_weight` | int | Processing order; lower = evaluated first |
| `match_mode` | enum | `all` (AND) / `any` (OR) |
| `is_default` | boolean | `true` = Default Rule (no conditions, cannot delete) |
| `agent_id` | fk → users | Distribution target (one of agent/group/pond) |
| `group_id` | fk → crm_groups | |
| `pond_id` | fk → crm_ponds | |
| `lender_id` | fk → users | Optional |
| `action_plan_id` | fk → crm_sequences | Optional |
| `initial_text_body` | text | 300 char max |
| `initial_text_delay_minutes` | int | Delay before send |
| `lead_count` | int | Leads matched by this rule |
| `last_lead_at` | timestamptz | |
| `last_lead_name` | varchar | |

**`crm_assignment_rule_conditions`:**

| Field | Type | Notes |
|---|---|---|
| `id` | int / uuid | |
| `rule_id` | fk → crm_assignment_rules | |
| `criterion` | enum | `tags` / `price` / `city` / `state` / `zip` / `mls_number` / `phone_present` |
| `operator` | enum | `includes` / `excludes` / `equals` / `greater_than` / `less_than` / `present` |
| `value` | text | The condition value |

### 14.6.15 Lead Flow acceptance criteria

- [ ] Lead Flow list view shows all configured sources with: name, lead count, last lead name+date, distribution target, "View Advanced Rules (N)" or inline controls.
- [ ] "+ Add Lead Flow" opens source creation form with: source type, notification delivery, distribution, action plan, lead type, delivery method.
- [ ] Advanced Rules editor is a full-page route (not modal).
- [ ] Advanced Rules editor has: ordered rule list, drag-to-reorder, "Copy From Other Lead Flows" button, per-rule stats, "Add initial text message" link per rule.
- [ ] Ryan-Realty.com source shows 3 rules: Rebecca attribution → Rebecca Peterson, Paul attribution → Paul Stevenson, Default → Matt Ryan.
- [ ] Default Rule has no conditions, no drag handle, no delete icon; always present at bottom.
- [ ] Rule criteria: 7 options (Tags, Price, City, State, ZIP, MLS Number, Phone Number); match mode All/Any per rule.
- [ ] First matching rule wins; rules process top-to-bottom.
- [ ] Initial text: 300-char limit; quiet hours 9 PM–8 AM agent's local timezone; auto-cancel if any outbound comm before send time.
- [ ] Initial text cannot be saved on a rule with no conditions (except Default Rule).
- [ ] Source archive: "Just Archive" vs "Archive and Ignore" as distinct options.
- [ ] Just Archive auto-unarchives on new lead arrival.
- [ ] Auto-archive timers: 30 days (manually created), 90 days (all sources) of inactivity.
- [ ] Lead dedup: match on email OR (phone + full name); update existing contact, notify assigned agent; do not reassign or restart action plans.
- [ ] Returning lead triggers Automations, not Lead Flow.
- [ ] Pause Leads per agent (admin-only); paused agents skip routing with documented fallback behavior.
- [ ] New contacts auto-enter Lead stage on creation.

---

## 14.7 Groups

**Route:** `/2/groups` (Admin > Groups)

### 14.7.1 Page layout

- Page heading: "Groups" or similar.
- Primary action: add group button. [inferred]
- Groups appear in a table.

### 14.7.2 Table columns

| Column | Notes |
|---|---|
| Name ↑ | Group name; ascending sort; column header clickable to sort |
| Distribution Type | "Round Robin" or "First to Claim" |
| Distribution | Avatar chain with → arrows showing the rotation sequence |
| Type | "Agents" (user type in this group) |
| Actions | Edit (pencil) + Delete (trash) |

[GIF admin1]

### 14.7.3 Ryan Realty groups (2 configured)

| Name | Distribution Type | Members (inferred from avatars) | Type |
|---|---|---|---|
| Seller Leads | Round Robin | Avatar chain (all 3 brokers) | Agents |
| Team Ryan | Round Robin | Avatar chain (all 3 brokers) | Agents |

[GIF admin1]

### 14.7.4 Round Robin

- Leads assigned sequentially, cycling through group members.
- A visual indicator (green checkmark in FUB) shows which member is "next in line."
- When a lead is manually reassigned to a Round Robin group (from a contact profile), it goes to the next person in the pointer sequence. [FUB docs]
- **Mass reassignment to groups is not supported.** Individual lead reassignment only. [FUB docs]
- In-house CRM data model: maintain a `next_pointer` (index into the ordered members list) per group in `crm_round_robin_state`. [prior spec §19.1 — `crm_round_robin_state` confirmed existing]

### 14.7.5 First to Claim (FTC)

**Notification mechanism:**
- All group members receive a **mobile push notification** (iOS/Android FUB app). Push must be enabled in app settings.
- No email or SMS notifications for FTC — push only. [FUB docs]
- Apple Watch cannot claim leads (dismiss-only). [FUB docs]

**Claiming process:**
- Agent taps (not swipes) push notification to claim.
- Unclaimed leads also appear on the app's "Recent" screen. [FUB docs]
- First agent to tap becomes the assigned agent (exclusive claim — needs atomic/optimistic locking). [FUB docs]

**Claim window:**
- Configurable by admin; maximum **30 minutes** before fallback triggers. [FUB docs]

**Fallback chain (up to 2 chained fallbacks):**
1. First fallback: another FTC group, a Round Robin group, or an individual agent.
2. Second fallback: same options.
3. Final fallback: account owner receives the lead.
[FUB docs]

**FTC in automations:**
- Subsequent automation steps execute immediately using the CURRENT assignee's data — not the eventual FTC winner.
- Merge fields in steps following "Reassign to FTC group" will use the pre-FTC assignee. [FUB docs — critical gotcha]

**FTC claim timer on manual reassignment:**
- When manually reassigning a contact to a FTC group from the profile, a timer displays showing how many minutes remain before the lead routes to the default FTC fallback. [FUB docs]

### 14.7.6 Add Group flow

Fields:
- Unique name (required)
- User type: Agents OR Lenders (not mixed) [FUB docs]
- Members: multi-select users
- Assignment method: Round Robin or First to Claim
- (If FTC) Claim window duration
- (If FTC) Fallback 1 (agent/group/pond)
- (If FTC) Fallback 2 (agent/group/pond)

### 14.7.7 Groups — data model (in-house CRM)

Maps to `crm_groups` + `crm_group_members` + `crm_round_robin_state`. [prior spec §19.1 — confirmed existing]

**`crm_groups`:**

| Field | Type | Notes |
|---|---|---|
| `id` | int / uuid | |
| `name` | varchar(255) | Unique |
| `distribution_type` | enum | `round_robin` / `first_to_claim` |
| `user_type` | enum | `agents` / `lenders` (not mixed) |
| `ftc_claim_window_minutes` | int | FTC only; max 30 |
| `ftc_fallback_1_id` | fk | Agent/group/pond; nullable |
| `ftc_fallback_1_type` | enum | `user` / `group` / `pond`; nullable |
| `ftc_fallback_2_id` | fk | Same; nullable |
| `ftc_fallback_2_type` | enum | Same; nullable |

**`crm_round_robin_state`:**

| Field | Type | Notes |
|---|---|---|
| `group_id` | fk → crm_groups | |
| `next_member_index` | int | 0-based index into ordered members list |
| `updated_at` | timestamptz | |

### 14.7.8 Groups acceptance criteria

- [ ] Groups table renders with columns: Name ↑, Distribution Type, Distribution (avatar chain), Type, Actions.
- [ ] "Seller Leads" and "Team Ryan" groups render as Round Robin / Agents.
- [ ] Distribution column shows avatar chain with → arrows indicating rotation sequence.
- [ ] Add Group form: Name, User Type (Agents or Lenders, not mixed), Members multi-select, Assignment Method (Round Robin / FTC).
- [ ] FTC configuration: claim window (max 30 min), up to 2 chained fallbacks, final fallback = account owner.
- [ ] Round Robin: maintains `next_pointer`; advances on each assignment; manual reassignment goes to next in line.
- [ ] FTC: push notification to all members; first-to-tap wins; atomic claim (no double-assignment).
- [ ] Mass reassignment to groups NOT supported — enforced error if attempted.
- [ ] Lenders and Agents cannot be in the same group.
- [ ] FTC automation step: subsequent automation actions execute with pre-FTC assignee's merge fields.

---

## 14.8 Appointment Stages (Types and Outcomes)

**Route:** `/2/appointment-stages` (Admin > Appointment Stages)

### 14.8.1 Page layout

- Page contains **two independent sections** on the same page, each with its own sub-heading and action button. [GIF feat2]
- No global "Add" button at the top — each section has its own.
- Both sections use the same table pattern: drag-handle + Name + Actions (edit + delete).

### 14.8.2 Section 1 — Appointment Types

| Sub-heading | "Appointment Types" |
|---|---|
| Action button | "+ Add" (or similar) |
| Drag-to-reorder | Yes — drag handle on all rows |

**Ryan Realty configured types (2):**

| # | Name |
|---|---|
| 1 | Buyer consultation |
| 2 | Listing |

[GIF feat2]

### 14.8.3 Section 2 — Appointment Outcomes

| Sub-heading | "Appointment Outcomes" |
|---|---|
| Action button | "+ Add" (or similar) |
| Drag-to-reorder | Yes — drag handle on all rows |

**Ryan Realty configured outcomes (3):**

| # | Name |
|---|---|
| 1 | No show |
| 2 | Working with buyers |
| 3 | Listing obtained |

[GIF feat2]

### 14.8.4 Type/Outcome data model

Both types and outcomes only have `name` and `orderWeight` properties. [FUB docs]
No other properties (no color, no description, no default flag). [FUB docs]

**API endpoints (account owner only — 403 for non-owner):**
- `POST /v1/appointmentTypes` — create type [FUB docs]
- `PUT /v1/appointmentTypes/:id` — update [FUB docs]
- `DELETE /v1/appointmentTypes/:id` — delete [FUB docs]
- `POST /v1/appointmentOutcomes` — create outcome [FUB docs]
- `PUT /v1/appointmentOutcomes/:id` — update [FUB docs]
- `DELETE /v1/appointmentOutcomes/:id` — delete [FUB docs]

`orderWeight` recalculates to 1000-unit gaps after any change. [FUB docs]

### 14.8.5 Appointment behavior notes

- **Invitation emails:** sent to the primary (first) email on the contact's profile only if multiple exist. [FUB docs]
- **Editing an appointment** auto-sends an update email (can be unchecked per edit). [FUB docs]
- **Calendar sync:** two-way with Google Calendar and Microsoft 365 only. [FUB docs]
- **Time granularity:** 15-minute increments. [FUB docs]
- **Webhooks:** `appointmentsCreated`, `appointmentsUpdated`, `appointmentsDeleted` fire for FUB-originated appointments only. Calendar-synced appointments do NOT fire these events. [FUB docs]

### 14.8.6 Appointment Stages acceptance criteria

- [ ] Page renders two independent sections: "Appointment Types" and "Appointment Outcomes", each with own "+ Add" button.
- [ ] Each section is an independently reorderable list with drag handles.
- [ ] Appointment Types: "Buyer consultation" and "Listing" render in documented order.
- [ ] Appointment Outcomes: "No show", "Working with buyers", "Listing obtained" render in documented order.
- [ ] Add Type / Add Outcome: form with Name field only; `orderWeight` assigned on save.
- [ ] Edit: rename only.
- [ ] Delete: removes type/outcome; appointments already using it may show as "(deleted)" or similar.
- [ ] API endpoints restricted to account owner (403 for Admin and Agent roles).
- [ ] `orderWeight` recalculates to 1000-unit gaps after reorder.
- [ ] `appointmentsCreated` / `appointmentsUpdated` / `appointmentsDeleted` webhooks fire for FUB-originated appointments; NOT for calendar-synced ones.
- [ ] Invitation emails send to primary email only when contact has multiple emails.

---

## 14.9 Cross-references to sibling spec sections

| Topic | Section |
|---|---|
| Stages data model definition | §5.10 |
| Tag many-to-many data model | §5.11 |
| Custom field definition model | §5.12 |
| Appointments + calendar sync | §5.7, §10 |
| Pond entity and routing | §5.17, §17.1 |
| Group entity | §5.18 |
| Lead routing + assignment engine | §17.1 |
| Tag taxonomy + prefixes | §17.2 |
| Custom fields as extensible schema | §17.3 |
| Compliance + suppression | §17.4 |
| Permissions matrix (Owner/Admin/Agent) | §17.7 |
| Team admin surface | §15.4 |
| Company Settings | §15.8 |
| API Keys + Lead Email ingest | §15.9 |
| Action Plans + Automations | §13 |
| Templates (Email + Text) | §14 |
| CRM gap map | §19 |

---

## 14.10 Permissions matrix for Admin features

| Feature | Account Owner | Admin | Agent / Lender |
|---|---|---|---|
| Access Admin > Overview | YES | YES | No |
| Create/rename/delete lead stages | YES | YES | No |
| Create/manage contact custom fields | YES | YES | No |
| Create/manage deal custom fields | YES (only) | No | No |
| Configure auto-tagging rules | YES (only) | No | No |
| Manage tag definitions (edit/delete) | YES | YES | No |
| Add tags to individual contact | YES | YES | YES |
| Create/delete appointment types & outcomes | YES (only) | No | No |
| Manage deal pipelines & stages | YES (only) | No | No |
| Configure Lead Flow sources and rules | YES | YES | No |
| Manage groups (add/edit/delete) | YES | YES | No |
| Manage ponds (add/edit/delete) | YES | YES | No |
| Pause Leads toggle per agent | YES | YES | No |
| Configure initial text messages | YES | YES | No |
| Create/manage webhooks | YES (only) | No | No |
| Delete a lead source | YES | YES | No |
| Enable Lead Source Lockdown (Power-Up) | YES (only) | No | No |
| Manage API keys | YES | YES | No |
| Team > Notify about all new inquiries (per admin) | YES (only, about others) | YES (own) | No |

[FUB docs — permission table synthesized]

---

## 14.11 Ryan Realty account configuration snapshot

This snapshot documents the live Ryan Realty FUB account state at the time of screenshot/GIF capture, for use in seeding the in-house CRM and verifying parity.

### Stages (16)
Seller Prospect (7,523, protected), Lead (8,243, protected), A - Hot 1-3 Months (2), B - Warm 3-6 Months (0), C - Cold 6+ Months (46), Renter - future buyer (0), Active Client (8), Pending (0), Past Client (21), Sphere (0), Archive (2), Closed (0, protected), Trash (47, protected), Real Estate Agent (2,342), Vendor (1), Nurture (0).

### Tags (1,486 total)
High-volume: area:bend-westside (7,674), audience:seller (3,508), Include In FB CAS (7,255 — this is a custom field, not a tag — see §14.4), 1M (1,952), absentee (1,809), audience:broker-recruit (233), auto:brand-voice:plain-honest (204), auto:seller-seq:watch (144), 2M (200), Absentee Owner (21), Past Client family tags, etc.

### Custom Fields (64 total)
High-use: Include In FB CAS (7,255), Enrichment Provider (5,851), Phone Type (4,843), Realtor License Type (163), Realtor License (163), Brokerage (163).

### Ponds (1)
Out Of State Home Owners — Pond Lead: Matt Ryan (inferred), Members: Rebecca Peterson + Paul Stevenson (inferred).

### Lead Sources (4 active)
Ryan-Realty.com (83 leads, 3 advanced rules), ryanrealty.vercel.app (5 leads), expired-listing-cron (12 leads), Expired Listing (0 leads, waiting).

### Groups (2)
Seller Leads (Round Robin, Agents), Team Ryan (Round Robin, Agents).

### Appointment Types (2)
Buyer consultation, Listing.

### Appointment Outcomes (3)
No show, Working with buyers, Listing obtained.

---

## 14.12 Prior spec errors corrected in this section

| Prior spec claim | Correction | Evidence |
|---|---|---|
| Admin Overview has ~12 cards in 2 sections | 21 cards in 5 sections — Lead Distribution, Follow Up, Account, Integrations, Customize | screenshot shot-33 |
| Business Registration card listed under Follow Up | Business Registration card is under Account section | screenshot shot-33 |
| Seller Prospect listed as non-protected (has edit/delete) | Seller Prospect IS system-protected (no edit/delete icons) | GIF feat2 + admin4 override static shot-38 |
| "Seller Lead" is a tag that can be disabled | Seller Lead auto-tag is system-generated and non-disableable | FUB docs |
| Custom field type listed as "Select" | FUB type name is "Dropdown" | FUB docs |
| Tags bulk-delete mechanism not specified | Trash icon next to count heading; select checkboxes + trash = bulk delete | screenshot shot-39 |
| Prior spec did not mention initial text requires conditions to save | Initial text cannot be saved on a rule with no conditions (except Default Rule) | FUB docs |
| Prior spec omitted two-mode archive (Just Archive vs Archive and Ignore) | Two distinct archive modes with different lead-arrival behavior | FUB docs |
| Prior spec omitted auto-archive timers | 30 days (manual sources), 90 days (all sources) | FUB docs |
| Prior spec did not note `mergeTags=false` default danger | `PUT /v1/people` without `mergeTags=true` erases ALL existing tags | FUB docs |
| Prior spec omitted FTC fallback chain and claim window | Up to 2 chained fallbacks; max 30 min claim window; final fallback = account owner | FUB docs |
| Prior spec omitted `isRecurring` on date custom fields | Date fields have `isRecurring` boolean (birthday vs. closing-date behavior) | FUB docs |
| Prior spec omitted `name` vs `label` API distinction | `name` = API identifier; `label` = display name; using `label` in API calls silently fails | FUB docs |
| Prior spec did not note quiet hours for initial texts | 9 PM–8 AM in agent's local timezone; queued messages send at 8 AM | FUB docs |

---

## 14.13 Sources

### Screenshot analyses (vision-verified — highest authority for static layout)
- `shot-33.md` — Admin Overview tile hub: 21 cards, 5 sections, verbatim card descriptions
- `shot-38.md` — Stages: 16 stages with exact names and people counts
- `shot-39.md` — Tags: 1,486 count, 16 visible tag names with Used counts, table columns
- `shot-44.md` — Custom Fields: 64 count, 18 visible field rows, all 7 column headers
- `shot-49.md` — Ponds: "Lead Ponds" heading, "+ Add Pond", "ⓘ How Ponds work", single pond row with avatar configuration

### GIF analyses (vision-verified dynamic behavior — highest authority for interactions and state)
- `feat2.md` — Ponds skeleton loading (3 shimmer rows), complete 16-stage list confirming Seller Prospect as system-protected, Appointment Types (Buyer consultation, Listing), Appointment Outcomes (No show, Working with buyers, Listing obtained)
- `admin1.md` — Lead Flow source list (4 sources with stats), Advanced Rules editor (full-page route, not modal), 3 configured rules for Ryan-Realty.com, Groups table (2 groups, both Round Robin), Team roster
- `admin2.md` — Automations list, Action Plans, Email Templates structure
- `admin3.md` — Custom Fields tab ▾ dropdown indicator, Import page, Company Settings, API usage stats
- `admin4.md` — Tags real-time search ("buyer" filter), Text Templates, Phone Numbers sections, Pixel widget ID (WT-QPDMEALA), Billing (Grow plan $828/yr × 3, CANCELLED)

### Official FUB documentation (behavioral rules, limits, API contracts)
- `stages-tags-fields-config.md` — 22 help articles + 12 API reference pages on stages, tags, custom fields, appointments, deal pipelines, permissions
- `lead-flow-routing.md` — 39 articles on Lead Flow, groups, ponds, dedup, auto-text, quiet hours, FTC, source management, A2P

### Prior spec (reference only — superseded where contradicted by screenshot/GIF/docs)
- `/Users/matthewryan/RyanRealty/docs/FUB_CRM_FEATURE_SPEC.md` §15.1–§15.7, §17.1–§17.2, §17.3, §19.1
