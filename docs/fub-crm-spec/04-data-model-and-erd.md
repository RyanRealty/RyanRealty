# Section 4 — Consolidated Data Model & Entity-Relationship Diagram

> **Sources.** Eight annotated production screenshots (shots 01, 04, 08, 30, 34, 38, 39, 44), two GIF analyses (deals.md, smartlists.md), five official FUB documentation research files (people-contacts.md, deals-pipelines.md, stages-tags-fields-config.md, automations.md, smart-lists.md), and the prior feature spec `docs/FUB_CRM_FEATURE_SPEC.md` §5. Where the prior spec contains errors or gaps these are called out explicitly in §4.8.
>
> **Ryan Realty account at capture time (2026-06-30):** 18,235+ contacts, 16 lifecycle stages, 1,486 tags, 64 custom fields, 38 automations, 2 deal pipelines, 3 brokers.

---

## 4.0 Reading guide

- Postgres column types are target in-house types, not FUB API types.
- `NOT NULL` / `NULL` stated per column.
- **Bold** enum values are observed in production screenshots; `(inferred)` marks values reconstructed from FUB norms.
- FUB API quirks that diverge from what the UI implies are called out as "API gotcha."
- `crm_*` mappings in §4.7 note gaps: columns that belong in the model but are absent from the existing in-house schema.

---

## 4.1 Entity inventory

### 4.1.1 Person (contact) — the central entity

Purpose: one row per human or entity contact (individual buyers, sellers, agents, vendors, past clients, etc.).

**In-house table:** `crm_people`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK, auto |
| `fub_legacy_id` | bigint | NULL | legacy FUB numeric person ID for migration only |
| `created_at` | timestamptz | NOT NULL | default now() |
| `updated_at` | timestamptz | NOT NULL | default now() |
| `fub_created_at` | timestamptz | NULL | original FUB creation timestamp |
| `fub_updated_at` | timestamptz | NULL | last FUB update timestamp |
| `first_name` | text | NULL | |
| `last_name` | text | NULL | |
| `name` | text | NULL | display name (denormalized first+last) |
| `stage` | text | NOT NULL | default `'Lead'`; FK to `crm_stages.key`; 16 values — see §4.3 |
| `source` | text | NULL | lead source string (Zillow, Website, Facebook, API, etc.) |
| `source_url` | text | NULL | URL of originating inquiry page |
| `assigned_broker` | text | NULL | slug FK to `brokers.slug` (matt, paul, rebecca) |
| `assigned_fub_user_id` | integer | NULL | FUB user ID; only for migration; in-house uses `assigned_broker` |
| `assigned_lender_id` | bigint | NULL | **MISSING from existing schema** — add FK to lender person or user |
| `emails` | jsonb | NOT NULL | default `'[]'`; array of `{address, label, is_primary, status}` — see §4.1.2 |
| `phones` | jsonb | NOT NULL | default `'[]'`; array of `{number, label, is_best, status}` — see §4.1.2 |
| `addresses` | jsonb | NOT NULL | default `'[]'`; array of `{street, city, state, zip, label}` |
| `tags` | text[] | NOT NULL | default `'{}'`; denormalized copy of tag names for fast filtering |
| `custom` | jsonb | NOT NULL | default `'{}'`; key=crm_field_definitions.key, value=string |
| `background` | text | NULL | free-text notes; tracked in change log |
| `price` | numeric | NULL | top of buyer price range |
| `timeframe` | text | NULL | **MISSING from existing schema** — enum: `'0-3 Months'`, `'3-6 Months'`, `'6-12 Months'`, `'12+ Months'`, `'No Plans'` |
| `picture_url` | text | NULL | profile photo URL (auto-enriched from Google) |
| `deleted` | boolean | NOT NULL | default false; soft-delete (permanent delete requires owner role) |
| `last_activity_at` | timestamptz | NULL | last lead-initiated action (website visit, inquiry); NOT agent-initiated |
| `last_communication_at` | timestamptz | NULL | **MISSING from existing schema** — two-way comms only (call/email/text); NOT mass/action-plan emails |
| `last_call_at` | timestamptz | NULL | **MISSING** — for Last Call filter |
| `last_text_sent_at` | timestamptz | NULL | **MISSING** — for Last Text Sent filter |
| `last_text_received_at` | timestamptz | NULL | **MISSING** |
| `last_email_sent_at` | timestamptz | NULL | **MISSING** |
| `last_email_received_at` | timestamptz | NULL | **MISSING** |
| `pond_id` | bigint | NULL | FK to `crm_ponds.id`; null = no pond |
| `raw` | jsonb | NULL | full FUB API response at last sync; migration only |
| `lead_score` | integer | NULL | **MISSING** — FUB assigns a numeric score |
| `sms_opt_out` | boolean | NOT NULL | **MISSING** — default false; set true on STOP/CANCEL/QUIT keyword; blocks all outbound texts |
| `email_unsubscribed` | boolean | NOT NULL | **MISSING** — default false; set true on unsubscribe action plan event |
| `email_bounced` | boolean | NOT NULL | **MISSING** — default false; set true on bounce event; triggers `bounced email` auto-tag |
| `enrichment_provider` | text | NULL | filled by social enrichment job; which provider ran |
| `enriched_at` | timestamptz | NULL | when social enrichment last ran |
| `social_links` | jsonb | NULL | `{linkedin, twitter, facebook, google_search}` from enrichment |

**Phone status enum:** `'active'`, `'bad'`, `'unsubscribed'`
**Email status enum:** `'active'`, `'unsubscribed'`, `'bounced'`
**Phone label enum:** `'Mobile'`, `'Home'`, `'Work'`, `'Other'`

**FUB hard limits:**
- Max 25 phone numbers across a contact and all their linked Relationships combined.
- Max 6 phone numbers importable per contact via CSV.
- Max 6 email addresses importable per contact via CSV.
- Max 6 addresses importable per contact via CSV.
- Max 6 relationships importable per contact; max 4 exported (spouses first).

---

### 4.1.2 ContactPoint (normalized phones / emails / addresses)

Purpose: normalized multi-value contact info; mirrors FUB's multi-phone/email model. Coexists with `crm_people.emails/phones/addresses` (JSONB); the JSONB is the fast-read cache; this table is the authoritative write target.

**In-house table:** `crm_contact_points`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `person_id` | bigint | NOT NULL | FK `crm_people.id` |
| `kind` | text | NOT NULL | `'phone'`, `'email'`, `'address'` |
| `value` | text | NOT NULL | the raw value |
| `label` | text | NULL | Mobile / Home / Work / Other (phones); Personal / Work / Other (emails) |
| `is_primary` | boolean | NOT NULL | default false; only one phone is_best, one email is_primary |
| `status` | text | NOT NULL | default `'active'`; `'bad'`, `'unsubscribed'`, `'bounced'` |
| `validated_at` | timestamptz | NULL | **MISSING** — when FUB last validated the value |

---

### 4.1.3 Relationship (Person-to-Person link)

Purpose: typed bidirectional links between contacts (spouse, co-buyer, partner, etc.). Unmerging is not supported in FUB; once merged, the link is permanent.

**In-house table:** `crm_relationships`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `person_id` | bigint | NOT NULL | FK; the primary contact |
| `related_person_id` | bigint | NULL | FK `crm_people.id`; null if the related person has no own profile (inline relationship) |
| `related_name` | text | NULL | name when related_person_id is null |
| `kind` | text | NULL | relationship type (see enum below) |
| `fub_legacy_id` | bigint | NULL | |

**Relationship type enum (from FUB docs — governs mailing label name inclusion):**
`'Spouse'`, `'Wife'`, `'Husband'`, `'Domestic Partner'`, `'Partner'`, `'Girlfriend'`, `'Boyfriend'`, `'Father'`, `'Son'`, `'Family'`, `'Business Partner'`, `'Co-buyer'`, `'Sibling'`, `'Child'`, `'Parent'`, `'Other'`

Mailing labels include relationship name only when kind is one of: Spouse, Wife, Husband, Domestic Partner, Partner, Girlfriend, Boyfriend.

---

### 4.1.4 PersonCollaborator (junction)

Purpose: grants a broker visibility and action rights on a contact without making them the assigned agent.

**In-house table:** `crm_person_collaborators` — **MISSING from existing schema**

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `person_id` | bigint | NOT NULL | FK `crm_people.id` |
| `broker_slug` | text | NOT NULL | FK `brokers.slug` |
| `added_at` | timestamptz | NOT NULL | default now() |
| `added_by` | text | NULL | broker slug of who added the collaborator |

Collaborator is auto-removed when that broker is promoted to assigned agent on the same contact.

---

### 4.1.5 PersonTagAttribution (junction — tag assignment metadata)

Purpose: tracks who added which tag to which contact and when. FUB introduced this 2021-06-14; historical tags have no attribution.

**In-house table:** `crm_person_tags` — **MISSING from existing schema** (crm_people.tags is a denormalized text[]; this table is the authoritative source with attribution)

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `person_id` | bigint | NOT NULL | FK `crm_people.id` |
| `tag_key` | text | NOT NULL | FK `crm_tags.key` |
| `added_by` | text | NULL | broker slug; null for pre-2021-06-14 or system-generated tags |
| `added_at` | timestamptz | NOT NULL | default now() |
| `source` | text | NOT NULL | default `'manual'`; `'auto_city'`, `'auto_zip'`, `'auto_bounce'`, `'auto_unsubscribe'`, `'auto_seller_lead'`, `'auto_deleted_agent'`, `'import'`, `'action_plan'`, `'automation'` |

---

### 4.1.6 Tag (definition)

Purpose: account-level tag registry. 1,486 tags observed in Ryan Realty account.

**In-house table:** `crm_tags`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `key` | text | NOT NULL | unique; the canonical form (stored in crm_people.tags[] and crm_person_tags.tag_key) |
| `label` | text | NOT NULL | display name (may differ from key after a rename) |
| `position` | integer | NOT NULL | default 0; sort order |
| `is_active` | boolean | NOT NULL | default true |
| `is_protected` | boolean | NOT NULL | default false; `bounced email` and `unsubscribed` are system-protected (cannot be disabled) |
| `created_at` | timestamptz | NOT NULL | |
| `updated_at` | timestamptz | NOT NULL | |

**Tag character limit:** 64 characters.

**Observed tag prefix taxonomy (colon-namespace convention):**
- `area:` — geography (area:bend-westside = 7,674; area:redmond = various)
- `audience:` — lead type (audience:seller = 3,508; audience:buyer = 42; audience:broker-recruit = 233)
- `auto:` — system/automation-generated (auto:seller-seq:new = 60; auto:seller-seq:watch = 144+; auto:brand-voice:plain-honest = 204)
- Price tiers: `1M` (1,952), `2M` (200), `3M` (33), `4M` (8), `5M+` (6)
- `absentee` (1,809), `Absentee Owner` (21)
- `contact:` — compliance namespace (contact:do-not-email, contact:do-not-text, contact:do-not-call)
- `compliance:` — compliance namespace (compliance:hard-stop)
- `tcpa:` — compliance namespace (tcpa:litigator)

**Non-configurable system tags (cannot be disabled, applied by application layer):**
`bounced email`, `Unsubscribed`, `Seller Lead`, `[Deleted Agent Name]`

**Auto-configurable tags (toggled at Admin > Tags per account):**
City of inquiry address, zip of inquiry address, city of property viewed, zip of property viewed, city of saved property, zip of saved property.

**Compliance tag set (excluded from all pipeline smart lists in Ryan Realty):**
`compliance:hard-stop`, `tcpa:litigator`, `Bounced`, `contact:do-not-email`, `Unsubscribed`, `do_not_text`, `NOTEXT`

---

### 4.1.7 Stage (lead lifecycle stage)

Purpose: single-select lifecycle classification for contacts. 3 system-protected stages; custom stages editable.

**In-house table:** `crm_stages`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `key` | text | NOT NULL | unique slug (matches crm_people.stage value) |
| `label` | text | NOT NULL | display name |
| `description` | text | NULL | **MISSING from existing schema** — admin-entered stage description |
| `position` | integer | NOT NULL | default 0; drag-reorderable; 1000-unit gaps |
| `is_active` | boolean | NOT NULL | default true |
| `is_protected` | boolean | NOT NULL | default false; Lead / Closed / Trash are protected (cannot rename or delete) |
| `created_at` | timestamptz | NOT NULL | |
| `updated_at` | timestamptz | NOT NULL | |

**Ryan Realty 16 stages (shot-38, authoritative):**

| Stage name | People count | System-protected |
|---|---|---|
| Seller Prospect | 7,523 | no |
| Lead | 8,243 | YES |
| A - Hot 1-3 Months | 2 | no |
| B - Warm 3-6 Months | 0 | no |
| C - Cold 6+ Months | 46 | no |
| Renter - future buyer | 0 | no |
| Active Client | 8 | no |
| Pending | 0 | no |
| Past Client | 21 | no |
| Sphere | 0 | no |
| Archive | 2 | no |
| Closed | 0 | YES |
| Trash | 47 | YES |
| Real Estate Agent | 2,342 | no |
| Vendor | 1 | no |
| Nurture | 0 | no |

FUB ships 9 default stages; Ryan Realty has customized to 16. The three system stages are Lead, Closed, Trash. Deletion of any custom stage is blocked until its contacts are reassigned.

Trash stage behavior: contacts hidden from all smart list queries; action plans paused; tasks preserved.

---

### 4.1.8 CustomFieldDefinition

Purpose: admin-defined typed fields that extend contact profiles. 64 defined in Ryan Realty account.

**In-house table:** `crm_field_definitions`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `key` | text | NOT NULL | unique; system-generated API identifier (e.g. `customClosePrice`); immutable |
| `label` | text | NOT NULL | display name; editable after creation |
| `type` | text | NOT NULL | `'text'`, `'number'`, `'date'`, `'dropdown'` (IMMUTABLE after creation) |
| `options` | jsonb | NOT NULL | default `'[]'`; for dropdown: array of choice strings; order is immutable after creation |
| `position` | integer | NOT NULL | default 0; 1000-unit gap recalculation |
| `hide_if_empty` | boolean | NOT NULL | default false |
| `read_only` | boolean | NOT NULL | default false |
| `is_recurring` | boolean | NOT NULL | **MISSING from existing schema** — default false; date fields only; true = annual recurrence (birthday, anniversary) |
| `field_group` | text | NULL | UI grouping (e.g. `'enrichment'`, `'financing'`, `'demographics'`) |
| `is_protected` | boolean | NOT NULL | default false |
| `created_at` | timestamptz | NOT NULL | |
| `updated_at` | timestamptz | NOT NULL | |

**Type constraints:**
- `text`: max 256 characters; avoid #, $, @, ! in label (performance issue)
- `number`: integers only; no decimals
- `date`: accepts MM/DD/YY or MM/DD/YYYY; `is_recurring` flag for annual dates
- `dropdown`: choices[] array; choices order is immutable after creation

**Type is immutable:** cannot be changed after creation; must delete and recreate to change type.

**API name vs label distinction:** `key` is the API identifier (used in POST /events and PUT /people payloads); `label` is the UI display name. Using `label` in API calls silently fails.

**Observed fields (from shot-44, 64 total):**
Recently Divorced (Text, 0), Recently Moved (Text, 0), Enrichment Provider (Text, 5,851), Phone Type (Text, 4,843), Net Worth Range (Text, 0), Income Range (Text, 0), Occupation (Text, 0), Has Children (Text, 0), Household Size (Number, 0), Marital Status (Text, 0), Gender (Text, 0), Birthday (Date, 0), Owner Age Range (Text, 0), Owner Age (Number, 0), Include In FB CAS (Text, 7,255), Realtor License Type (Text, 163), Realtor License (Text, 163), Brokerage (Text, 163), and 46 more.

Values are stored in `crm_people.custom` JSONB (key = `crm_field_definitions.key`, value = string). No separate `crm_field_values` junction table exists in the current schema; if relational storage is needed, add one.

---

### 4.1.9 DealCustomFieldDefinition

Purpose: deal-specific custom fields, entirely separate namespace from contact custom fields.

**In-house table:** `crm_deal_field_definitions` — **MISSING from existing schema**

Same schema as `crm_field_definitions` with identical column types. Values stored in `crm_deals.custom_fields` JSONB column (add if not present) or a separate `crm_deal_field_values` junction table.

Additional column vs contact fields:
- `is_recurring` applies to date fields in deals also (deal anniversary-style dates)
- Deal custom date fields can trigger Automations (unlike contact custom date fields which only populate the calendar)
- Deal custom dates do NOT sync to connected external calendars (Google/Outlook) — hard documented limit

---

### 4.1.10 User (team member)

Purpose: broker/agent identity and permissions. Ryan Realty has 3 users.

**In-house table:** `brokers` (already exists; `crm_people` FKs to `brokers.slug`)

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `slug` | text | NOT NULL | PK (`'matt'`, `'paul'`, `'rebecca'`) |
| `first_name` | text | NOT NULL | |
| `last_name` | text | NOT NULL | |
| `email` | text | NOT NULL | login email |
| `phone` | text | NULL | |
| `role` | text | NOT NULL | `'owner'`, `'admin'`, `'agent'` |
| `avatar_url` | text | NULL | |
| `title` | text | NULL | |
| `user_merge_field` | text | NULL | per-user template token (Calendly link, Zillow Reviews, etc.) |
| `can_export` | boolean | NOT NULL | default false; owner always can export |
| `pause_leads` | boolean | NOT NULL | default false |
| `notify_all_new_inquiries` | boolean | NOT NULL | default false |
| `connected_email` | text | NULL | connected Gmail/Outlook address |
| `gcal_token_json` | text | NULL | encrypted OAuth token for Google Calendar |
| `fub_user_id` | integer | NULL | migration reference |
| `twilio_number` | text | NULL | assigned A2P SMS number |
| `forward_to_cell` | text | NULL | where calls are forwarded |
| `crm_active` | boolean | NOT NULL | default true |

**Observed roster:** Matt Ryan (Owner, 541-213-6706), Rebecca Peterson (Admin), Paul Stevenson (Agent).

**Role permission matrix:**

| Action | Owner | Admin | Agent |
|---|---|---|---|
| Create/edit automations | YES | YES | NO |
| Create contact custom fields | YES | YES | NO |
| Create deal custom fields | YES | NO | NO |
| Configure auto-tag rules | YES | NO | NO |
| Manage tag definitions | YES | YES | NO |
| Create/delete appointment types | YES | NO | NO |
| Manage deal pipelines & stages | YES | NO | NO |
| Create/manage webhooks | YES | NO | NO |
| View all deals | YES | YES | NO |
| Export contacts | YES | per-grant | NO |
| Permanently delete contacts | YES | YES | NO |

---

### 4.1.11 TimelineEvent (polymorphic activity feed)

Purpose: single unified chronological event log per contact. All communication and system events land here.

**In-house table:** `crm_timeline`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `person_id` | bigint | NOT NULL | FK `crm_people.id` |
| `ts` | timestamptz | NOT NULL | default now(); event timestamp |
| `kind` | text | NOT NULL | discriminator — see enum below |
| `title` | text | NULL | short display title |
| `body` | text | NULL | plain-text body or HTML body |
| `payload` | jsonb | NOT NULL | default `'{}'`; kind-specific structured data |
| `broker` | text | NULL | FK `brokers.slug`; agent who performed the action |
| `source` | text | NOT NULL | default `'app'`; `'fub_sync'`, `'automation'`, `'import'`, `'api'` |
| `fub_legacy_id` | bigint | NULL | |
| `dedupe_key` | text | NULL | prevents duplicate ingest |
| `is_starred` | boolean | NOT NULL | **MISSING** — default false; user can star timeline entries |
| `archived` | boolean | NOT NULL | **MISSING** — default false; for email archive action |
| `opens` | integer | NOT NULL | **MISSING** — default 0; email open count |
| `clicks` | integer | NOT NULL | **MISSING** — default 0; email click count |
| `tracking_pixel_url` | text | NULL | **MISSING** — `_pxl` tracking pixel URL in email |
| `via_automation` | boolean | NOT NULL | **MISSING** — default false; whether sent via action plan/automation |

**Kind enum (complete):**
`'email_in'`, `'email_out'`, `'text_in'`, `'text_out'`, `'call'`, `'voicemail'`, `'note'`, `'web_event'`, `'task_created'`, `'stage_change'`, `'lead_origin'`, `'seller_inquiry'`, `'system'`, `'marketing_email'` (separate cap: 75 most-recent shown)

**Payload shape per kind:**

```
email_in / email_out:
  { from, to, cc, bcc, subject, body_html, direction, opens, clicks, bounced, unsubscribed,
    tracking_pixel_url, campaign_url, via_automation, template_id, signature_id }

text_in / text_out:
  { from, to, body, direction, segments, clicks, via_automation, template_id }

call:
  { direction, from, to, duration_s, recording_url, outcome, connected }

voicemail:
  { from, audio_url, transcript }

note:
  { body, mentions: [broker_slug] }

web_event:
  { url, page_title, event_type: 'viewed'|'saved'|'inquiry', property_id }

stage_change:
  { from_stage, to_stage, changed_by }

lead_origin:
  { source, page, campaign_slug, wants, tier, assignment }
```

**Marketing Emails tab cap:** shows 75 most-recent `marketing_email` kind events only.

---

### 4.1.12 InboxThread

Purpose: conversation container grouping related messages for the Inbox UI. Each thread belongs to a folder/scope.

**In-house table:** `crm_inbox_threads` — **MISSING from existing schema** (covered partially by `crm_conversation_state`)

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `person_id` | bigint | NULL | FK `crm_people.id`; null for unknown-caller voicemails |
| `scope` | text | NOT NULL | `'my'`, `'company'` |
| `folder` | text | NOT NULL | `'inbox'`, `'assigned'`, `'drafts'`, `'sent'`, `'closed'` |
| `assigned_broker` | text | NULL | FK `brokers.slug` |
| `subject` | text | NULL | email subject or call description |
| `channel` | text | NOT NULL | `'email'`, `'text'`, `'voicemail'`, `'call'` |
| `unread_count` | integer | NOT NULL | default 0 |
| `last_message_at` | timestamptz | NULL | |
| `created_at` | timestamptz | NOT NULL | default now() |
| `updated_at` | timestamptz | NOT NULL | default now() |

---

### 4.1.13 Task

Purpose: follow-up action items assigned to a broker for a contact. Auto-generated by automations; manually created.

**In-house table:** `crm_tasks`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `person_id` | bigint | NULL | FK `crm_people.id` |
| `name` | text | NOT NULL | description (e.g. "Lead returned to website. Follow up now.") |
| `type` | text | NULL | FK `crm_task_types.key`; Call / Email / Text / Showing / Other |
| `due_at` | timestamptz | NULL | |
| `completed_at` | timestamptz | NULL | null = incomplete |
| `assigned_broker` | text | NULL | FK `brokers.slug` |
| `origin` | text | NOT NULL | default `'app'`; `'automation'`, `'action_plan'`, `'api'` |
| `fub_legacy_id` | bigint | NULL | |
| `created_at` | timestamptz | NOT NULL | default now() |
| `updated_at` | timestamptz | NOT NULL | default now() |

**Status (derived):** pending (due_at > now, completed_at null), overdue (due_at < now, completed_at null), completed (completed_at not null).

**Task types (`crm_task_types`):**
`'call'`, `'email'`, `'text'`, `'showing'`, `'other'`

Tasks linked to Trash-staged contacts remain visible in the Tasks tab (they are not hidden with the contact).

---

### 4.1.14 Appointment

Purpose: calendar events linked to contacts. Types and outcomes are admin-configurable.

**In-house table:** `crm_appointments`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `title` | text | NOT NULL | |
| `start_at` | timestamptz | NOT NULL | 15-minute granularity |
| `end_at` | timestamptz | NOT NULL | |
| `all_day` | boolean | NOT NULL | default false |
| `location` | text | NULL | |
| `description` | text | NULL | |
| `type_id` | integer | NULL | FK `crm_appointment_types.id` |
| `outcome_id` | integer | NULL | FK `crm_appointment_outcomes.id` |
| `person_id` | bigint | NULL | FK `crm_people.id`; primary contact |
| `broker_slug` | text | NOT NULL | FK `brokers.slug`; assigned broker |
| `guest_person_ids` | bigint[] | NOT NULL | default `'{}'`; additional contacts |
| `invite_sent` | boolean | NOT NULL | default false |
| `gcal_event_id` | text | NULL | Google Calendar two-way sync ID |
| `source` | text | NULL | **MISSING** — source of the appointment creation |
| `created_at` | timestamptz | NOT NULL | default now() |
| `updated_at` | timestamptz | NOT NULL | default now() |

**AppointmentType / AppointmentOutcome:** both have `(id, name, ord, active)`. No FUB-documented defaults; Ryan Realty seeds custom values.

**Calendar sync:** two-way with Google Calendar and Microsoft 365 only. Appointments created in the external calendar and synced in do NOT fire `appointmentsCreated` webhook.

**Invitation email:** sent to the contact's primary (first) email address only when multiple exist.

---

### 4.1.15 Deal

Purpose: opportunity records linking lead source to transaction outcome. Two pipelines (Buyers, Sellers).

**In-house table:** `crm_deals`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `name` | text | NULL | deal display name |
| `description` | text | NULL | free-text notes |
| `pipeline` | text | NULL | `'buyers'` or `'sellers'`; **should be FK to `crm_deal_pipelines.id`** |
| `stage` | text | NULL | current stage name; **should be FK to `crm_deal_stages.id`** |
| `entered_stage_at` | timestamptz | NULL | when current stage was entered; used for time-in-stage metric |
| `value` | numeric | NULL | sale price (integer dollars) |
| `status` | text | NULL | `'active'`, `'archived'`, `'deleted'` — **API quirk: FUB always returns `'active'` for non-deleted deals; true state is the stage** |
| `property_address` | text | NULL | separate from deal name |
| `listing_key` | text | NULL | MLS listing key if linked |
| `assigned_broker` | text | NULL | FK `brokers.slug` |
| `close_date` | date | NULL | `projectedCloseDate` in FUB API; used as actual close date too (FUB has no separate actualCloseDate) |
| `earnest_money_due` | date | NULL | key date: earnest money due |
| `mutual_acceptance` | date | NULL | key date: mutual acceptance |
| `due_diligence` | date | NULL | key date: due diligence deadline |
| `final_walkthrough` | date | NULL | key date: final walk-through |
| `possession` | date | NULL | key date: possession |
| `commission_dollars` | numeric | NULL | gross commission (commissionValue in FUB API) |
| `commission_percent` | numeric | NULL | commission as % of sale price (derived; not stored separately in FUB API) |
| `order_weight` | integer | NULL | **MISSING** — sort position within stage column; 1000-unit gap system |
| `fub_legacy_id` | bigint | NULL | |
| `raw` | jsonb | NULL | |
| `created_at` | timestamptz | NOT NULL | default now() |
| `updated_at` | timestamptz | NOT NULL | default now() |

**API gotcha:** `status` in FUB API always returns `'Active'` (never `'Closed'` or `'Lost'`). The actual won/closed state is determined by the deal's stage having `is_closed_stage = true`. "Lost" = archived best practice. The prior spec §5.8 conflated deal status with stage names.

**Time-to-close computation:** `close_date - MIN(crm_people.created_at)` across all people attached to the deal. Falls back to `crm_deals.created_at` if no people are attached.

---

### 4.1.16 DealPeople (junction)

Purpose: many-to-many between deals and contacts.

**In-house table:** `crm_deal_people` — **MISSING from existing schema** (crm_deals currently has only `person_id` single FK)

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `deal_id` | bigint | NOT NULL | FK `crm_deals.id` |
| `person_id` | bigint | NOT NULL | FK `crm_people.id` |
| `role` | text | NULL | `'buyer'`, `'seller'`, `'co-buyer'`, `'co-seller'` (inferred) |
| `added_at` | timestamptz | NOT NULL | default now() |

When a deal stage change fires an automation, the automation applies to ALL persons in this junction table.

---

### 4.1.17 DealUsers (junction)

Purpose: agents/brokers assigned to a deal.

**In-house table:** `crm_deal_users` — **MISSING from existing schema**

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `deal_id` | bigint | NOT NULL | FK `crm_deals.id` |
| `broker_slug` | text | NOT NULL | FK `brokers.slug` |
| `added_at` | timestamptz | NOT NULL | default now() |

Warning: a deal with no rows in this table is invisible to all agent-role users; only admins/owners retain visibility.

---

### 4.1.18 DealSplit

Purpose: commission splits per deal.

**In-house table:** `crm_deal_splits`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `deal_id` | bigint | NOT NULL | FK `crm_deals.id` |
| `broker_slug` | text | NOT NULL | FK `brokers.slug` |
| `split_pct` | numeric | NOT NULL | default 100; percent when `commission_dollars > 0` |
| `split_dollars` | numeric | NULL | dollar amount when `commission_dollars = 0` or null |
| `notes` | text | NULL | |
| `type` | text | NOT NULL | **MISSING** — `'agent'`, `'team'` (per FUB split types) |
| `created_at` | timestamptz | NOT NULL | default now() |

**Commission split dual-mode:** when `crm_deals.commission_dollars > 0`, splits are percentages; when `commission_dollars` is null or 0, splits are dollar amounts. Changing commission_dollars after entering a dollar split reinterprets the number as a percentage.

---

### 4.1.19 DealStageTransition (audit log)

Purpose: every stage change a deal undergoes, for time-in-stage reporting.

**In-house table:** `crm_deal_stage_transitions` — **MISSING from existing schema**

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `deal_id` | bigint | NOT NULL | FK `crm_deals.id` |
| `from_stage` | text | NULL | null if this is the initial stage on deal creation |
| `to_stage` | text | NOT NULL | |
| `transitioned_at` | timestamptz | NOT NULL | default now() |
| `broker_slug` | text | NULL | who triggered the stage change |

---

### 4.1.20 DealPipeline

Purpose: top-level container for deal stage columns. FUB default: Buyers (id=1) and Sellers (id=2).

**In-house table:** `crm_deal_pipelines` — **MISSING from existing schema**

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `name` | text | NOT NULL | `'Buyers'`, `'Sellers'`, or custom |
| `description` | text | NULL | |
| `order_weight` | integer | NOT NULL | default 1000; 1000-unit gap |
| `created_at` | timestamptz | NOT NULL | default now() |

---

### 4.1.21 DealStage

Purpose: stage column within a pipeline. Color-assigned; at least one must have `is_closed_stage = true` for reporting to function.

**In-house table:** `crm_deal_stages` — **MISSING from existing schema** (`crm_deals.stage` is currently a raw text column)

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `pipeline_id` | bigint | NOT NULL | FK `crm_deal_pipelines.id` |
| `name` | text | NOT NULL | |
| `color` | text | NULL | hex color for Kanban column header |
| `order_weight` | integer | NOT NULL | default 1000; 1000-unit gaps; auto-recalculates on reorder |
| `is_closed_stage` | boolean | NOT NULL | default false; gates leaderboard + commission reporting |
| `created_at` | timestamptz | NOT NULL | default now() |

**Ryan Realty Buyers pipeline stages (shot-30, left to right):**
Start (orange), Buyer Contract (orange), Offer (blue), Pending (yellow), Closed (green, `is_closed_stage=true`), Lost (red)

**Ryan Realty Sellers pipeline stages (inferred from screenshots):**
Start, Pre-Listing, Listed, Offer, Pending, Closed (`is_closed_stage=true`), Lost/Terminated

**FUB default Buyers stages (official docs):** Buyer Contract, Offer, Pending, Closed
**FUB default Sellers stages (official docs):** Listed, Offer, Pending, Closed

Ryan Realty has added Start at the front and Lost at the end of both pipelines as custom stages.

---

### 4.1.22 Automation (Automations 2.0)

Purpose: trigger-based visual workflow. 38 automations in Ryan Realty account (shot-34 shows 38 total; spec §2 noted 36 — 38 is the authoritative count from the screenshot).

**In-house table:** `crm_automation_rules` (v1 simple trigger→action) + `crm_sequences` (multi-step action plan analog). A unified v2 engine table is needed; see notes.

The existing `crm_automation_rules` table represents FUB's v1 (simple, single action per rule). The existing `crm_sequences` table represents FUB's action plans (multi-step). FUB Automations 2.0 merges both into a visual builder. The in-house build should target the 2.0 model.

**Target unified automation table:** `crm_automations` — **MISSING from existing schema**

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `name` | text | NOT NULL | |
| `folder_id` | bigint | NULL | FK `crm_automation_folders.id` |
| `status` | text | NOT NULL | default `'inactive'`; `'active'`, `'inactive'` |
| `triggers` | jsonb | NOT NULL | default `'[]'`; array of trigger objects — see §4.1.23 |
| `steps` | jsonb | NOT NULL | default `'[]'`; array of step objects — see §4.1.23 |
| `run_once_per_person` | boolean | NOT NULL | default true |
| `created_by` | text | NULL | broker_slug; null = system automation (shown as "FU" avatar) |
| `is_system` | boolean | NOT NULL | default false; system automations (FUB-created) cannot be deleted |
| `started_count` | integer | NOT NULL | **MISSING** — default 0; contacts who entered this automation |
| `engaged_count` | integer | NOT NULL | **MISSING** — default 0; contacts who responded to an automation email |
| `completed_count` | integer | NOT NULL | **MISSING** — default 0; contacts who completed all steps |
| `linked_automations_count` | integer | NOT NULL | **MISSING** — derived count of other automations this one references |
| `fub_legacy_id` | integer | NULL | |
| `created_at` | timestamptz | NOT NULL | default now() |
| `updated_at` | timestamptz | NOT NULL | default now() |

---

### 4.1.23 AutomationStep (embedded in JSONB steps array)

The `steps` column in `crm_automations` stores an ordered array. Each element has:

```json
{
  "step_id": "uuid",
  "type": "time_delay | send_email | reassign | add_collaborators | remove_collaborators | add_tags | remove_tags | create_task | change_stage | add_note | pause_action_plans | pause_automations | run_automation | conditions",
  "config": { ... type-specific fields ... },
  "position": 0
}
```

**Step type enum (Automations 2.0):**
`time_delay`, `send_email`, `reassign`, `add_collaborators`, `remove_collaborators`, `add_tags`, `remove_tags`, `create_task`, `change_stage`, `add_note`, `pause_action_plans`, `pause_automations`, `run_automation`, `conditions`

**Trigger type enum:**
`stage_changed`, `tag_added`, `deal_stage_changed`, `property_saved`, `property_viewed`, `new_inquiry`, `calendar_date`, `appointment_created`, `appointment_before`, `appointment_at_time`, `appointment_outcome`, `manual`

Multiple triggers on one automation use OR logic.

**Sending constraints:**
- Day-0 action plan text messages do NOT auto-send when triggered by an automation rule; only fire via Lead Flow path.
- Maximum 4 action plan emails per contact per day (across all running automations).
- Automations do NOT fire for: bulk-imported contacts, manually added contacts, API-created contacts, email-parsed contacts — only fires on existing contacts when trigger event occurs.
- 5-minute duplicate suppression: same (contact, automation) pair cannot re-trigger within 5 minutes.
- Mass Actions bypass the automation engine entirely (by design, not a bug).

---

### 4.1.24 AutomationFolder

Purpose: organizes automations into named folders.

**In-house table:** `crm_automation_folders` — **MISSING from existing schema**

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `name` | text | NOT NULL | e.g. `'My Automations'` |
| `created_at` | timestamptz | NOT NULL | default now() |

Observed: 1 folder ("My Automations" with 6 automations) in Ryan Realty account. Admin/owner only can create folders.

---

### 4.1.25 Enrollment (Person in Automation)

Purpose: tracks each contact's progress through an automation.

**In-house table:** `crm_sequence_enrollments`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `person_id` | bigint | NOT NULL | FK `crm_people.id` |
| `sequence_id` | bigint | NOT NULL | FK `crm_sequences.id` (or `crm_automations.id` in v2) |
| `step_index` | integer | NOT NULL | default 0 |
| `next_run_at` | timestamptz | NULL | when next step fires |
| `status` | text | NOT NULL | default `'running'`; see enum below |
| `enrolled_by` | text | NULL | broker slug or `'system'` |
| `first_touch_override` | text | NULL | for A/B testing |
| `approved_by` | text | NULL | broker slug if enrollment required approval |
| `approved_at` | timestamptz | NULL | |
| `created_at` | timestamptz | NOT NULL | default now() |
| `updated_at` | timestamptz | NOT NULL | default now() |

**Status enum:** `'running'`, `'paused'`, `'completed'`, `'stopped'`, `'suppressed'`

Pause-on-reply: enrollment pauses when contact replies via email, text, or call lasting 2.5+ minutes.

---

### 4.1.26 SmartList (saved view / filter)

Purpose: saved filter predicates that surface dynamic contact lists. 148 saved in Ryan Realty account.

**In-house table:** `crm_saved_views`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `name` | text | NOT NULL | |
| `emoji` | text | NULL | **MISSING from existing schema** — single emoji character |
| `description` | text | NULL | rich-text; 1,000-character limit (docs); ~250 char (prior spec; correct value is 1,000) |
| `filter` | jsonb | NOT NULL | filter predicate tree |
| `ast` | jsonb | NOT NULL | compiled AST version of filter for fast evaluation |
| `sort` | text | NOT NULL | default `'updated_desc'` |
| `columns` | jsonb | NULL | **MISSING** — ordered array of visible column keys |
| `group_by` | text | NULL | **MISSING** — `'agent'`, `'portal'`, `'connections'` |
| `collection_id` | bigint | NULL | **MISSING** — FK `crm_smart_list_collections.id`; null = uncollected |
| `owner` | text | NULL | broker slug or email |
| `owner_email` | text | NULL | |
| `visibility` | text | NOT NULL | **MISSING** — `'private'`, `'shared_all'`, `'shared_selected'` |
| `is_shared` | boolean | NOT NULL | default false (legacy column; superseded by `visibility`) |
| `is_protected` | boolean | NOT NULL | default false; system lists (All People) cannot be deleted |
| `position` | integer | NOT NULL | default 0; drag-reorder within collection |
| `people_count` | integer | NULL | **MISSING** — cached count; stale window up to 10 minutes |
| `count_refreshed_at` | timestamptz | NULL | **MISSING** |
| `shared` | boolean | NOT NULL | default true (legacy; use `visibility` instead) |
| `created_at` | timestamptz | NOT NULL | default now() |
| `updated_at` | timestamptz | NOT NULL | default now() |

**Filter system (from GIF analysis + official docs):**
Filters stored as a JSON predicate array; AND logic between filter objects.

**Filter type enum:** `tags`, `stage`, `source`, `created`, `updated`, `inactive`, `last_communication`, `last_activity`, `last_call`, `last_text`, `last_email`, `email_opens`, `website_activity`, `deal_stage`, `deal_close_date`, `deal_price`, `assigned_agent`, `assigned_pond`, `assigned_lender`, `collaborators`, `price`, `timeframe`, `phone_quality`, `email_quality`, `my_next_task`, `custom_field`, `inbox_app`

**Filter operator enum:** `is_empty`, `is_not_empty`, `contains`, `does_not_contain`, `starts_with`, `is_good`, `is_bad`, `less_than`, `greater_than`, `between`, `include_any`, `include_all`, `exclude_any`, `exclude_all`, `was_less_than`, `was_more_than`

**SmartList count update schedule:** every 10 minutes while People page is open; immediately on click, create, or save.

**Sharing constraint:** smart lists created by Agent role cannot be shared with the team. Only admin-created lists can be shared. Shared list respects each viewer's role-based contact access.

---

### 4.1.27 SmartListShare (junction)

Purpose: tracks which brokers/teams a smart list is shared with.

**In-house table:** `crm_saved_view_shares` — **MISSING from existing schema**

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `saved_view_id` | bigint | NOT NULL | FK `crm_saved_views.id` |
| `broker_slug` | text | NULL | FK `brokers.slug`; null if shared with all |
| `share_type` | text | NOT NULL | `'all'`, `'broker'` |

---

### 4.1.28 Collection

Purpose: named folder grouping related smart lists.

**In-house table:** `crm_smart_list_collections` — **MISSING from existing schema**

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `name` | text | NOT NULL | e.g. `'Pipeline'`, `'Neighborhoods'`, `'Smart Loop'` |
| `emoji` | text | NULL | |
| `position` | integer | NOT NULL | default 0; sidebar order |
| `created_by` | text | NULL | FK `brokers.slug` |
| `created_at` | timestamptz | NOT NULL | default now() |

A smart list belongs to exactly one collection (or none). Collections can be assigned to agents (Pro/Platform plan gate). Deleting a collection does not delete its smart lists.

---

### 4.1.29 Pond (shared lead pool)

Purpose: shared bucket of leads any authorized broker can claim.

**In-house table:** `crm_ponds`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `name` | text | NOT NULL | e.g. `'Out Of State Home Owners'` |
| `pond_lead_slug` | text | NOT NULL | assignment method slug |
| `created_at` | timestamptz | NOT NULL | default now() |
| `updated_at` | timestamptz | NOT NULL | default now() |

**Members:** `crm_pond_members` (pond_id, broker_slug) — present in schema.

---

### 4.1.30 Group (distribution group)

Purpose: named routing groups for lead assignment (round-robin or first-to-claim).

**In-house table:** `crm_groups`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `name` | text | NOT NULL | e.g. `'Team Ryan'`, `'Seller Leads'` |
| `distribution_type` | text | NOT NULL | default `'round_robin'`; `'round_robin'`, `'first_to_claim'` |
| `round_robin_index` | integer | NOT NULL | default -1; tracks next-up broker |
| `created_at` | timestamptz | NOT NULL | default now() |
| `updated_at` | timestamptz | NOT NULL | default now() |

**Members:** `crm_group_members` (group_id, broker_slug, sort_order) — present in schema.

---

### 4.1.31 Template (email and text)

Purpose: reusable message content with merge fields.

**In-house table:** `crm_templates`

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `key` | text | NOT NULL | unique slug |
| `channel` | text | NOT NULL | `'email'`, `'text'` |
| `name` | text | NOT NULL | |
| `subject` | text | NULL | email only; supports merge fields |
| `body` | text | NOT NULL | HTML for email; plain text for SMS; supports `{first_name}`, `{price_range}`, etc. |
| `folder_id` | bigint | NULL | **MISSING** — FK `crm_template_folders.id` |
| `is_shared` | boolean | NOT NULL | **MISSING** — default false; shared = visible to all brokers |
| `category` | text | NULL | |
| `is_active` | boolean | NOT NULL | default true |
| `opens` | integer | NOT NULL | **MISSING** — default 0; aggregate open count |
| `clicks` | integer | NOT NULL | **MISSING** — default 0; aggregate click count |
| `unsubscribed` | integer | NOT NULL | **MISSING** — default 0; unsubscribes from this template |
| `bounces` | integer | NOT NULL | **MISSING** — default 0 |
| `automation_count` | integer | NOT NULL | **MISSING** — how many automations reference this template |
| `action_plan_count` | integer | NOT NULL | **MISSING** — how many action plans reference this template |
| `fub_legacy_id` | integer | NULL | |
| `updated_at` | timestamptz | NOT NULL | default now() |

---

### 4.1.32 TemplateFolder

Purpose: folder tree for organizing email and text templates.

**In-house table:** `crm_template_folders` — **MISSING from existing schema**

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `name` | text | NOT NULL | |
| `channel` | text | NOT NULL | `'email'`, `'text'` |
| `parent_id` | bigint | NULL | self-referential FK for nesting |
| `position` | integer | NOT NULL | default 0 |
| `created_at` | timestamptz | NOT NULL | default now() |

---

### 4.1.33 ChangeLog

Purpose: append-only audit trail for contact field changes. Cannot be deleted; deleted users' names remain.

**In-house table:** `crm_change_log` — **MISSING from existing schema**

| Column | Postgres type | Null | Notes |
|---|---|---|---|
| `id` | bigint | NOT NULL | PK |
| `person_id` | bigint | NOT NULL | FK `crm_people.id` |
| `changed_by` | text | NULL | broker slug or deleted-user name string; preserved after user deletion |
| `changed_at` | timestamptz | NOT NULL | default now() |
| `field_name` | text | NOT NULL | `'stage'`, `'source'`, `'price'`, `'timeframe'`, `'background'`, `'name'`, `'phone'`, `'email'`, `'address'` |
| `old_value` | text | NULL | |
| `new_value` | text | NULL | |

Relationship changes are NOT tracked in this log (per FUB docs: future feature).

---

### 4.1.34 AccountSettings (Company)

Purpose: single-row account configuration.

**In-house table:** `crm_account_settings` (no dedicated table observed; fields live in various config tables and env vars)

Relevant fields from FUB company-settings observed in screenshot:
- `company_name`: `'Ryan Realty'`
- `address`: `'115 NW Oregon Ave. #2, Bend, Oregon 97703'`
- `timezone`: `'Pacific'`
- `fallback_number`: `'541.213.6706'`
- `call_recording_enabled`: true
- `legal_disclosure_autoplay`: false
- `auto_tag_new_leads`: configurable per account
- `production_goal_dollars`: 1,000,000 (annual)
- `fub_lead_email`: `'ryan.realty@followupboss.me'` (forward-in BCC address)
- `subdomain`: `'ryan-realty.followupboss.com'`

---

### 4.1.35 APIKey

Purpose: API authentication tokens for integrations.

**In-house table:** not formalized; tracked in env vars. FUB observed API keys: Agent Fire, Zapier, RyanRealtyApp, CLAUDE COWORK, Ryan Realty LP - Vercel (5 active keys).

---

## 4.2 Cardinality summary

```
Person (1) ——— (N) ContactPoint
Person (1) ——— (N) TimelineEvent
Person (1) ——— (N) Task
Person (1) ——— (N) Appointment (via person_id)
Person (1) ——— (N) PersonTagAttribution (via crm_person_tags)
Person (N) ——— (N) Tag          (via crm_person_tags)
Person (N) ——— (N) User         (via crm_person_collaborators)
Person (N) ——— (N) Deal         (via crm_deal_people)
Person (N) ——— (N) Automation   (via crm_sequence_enrollments)
Person (N) ——— (N) Person       (via crm_relationships, self-join)
Person (N) ——— (1) Stage
Person (N) ——— (1) User [assigned_broker]
Person (N) ——— (1) Pond [nullable]
Person (N) ——— (N) Group        (via crm_group_members on Person's broker)

Deal   (N) ——— (1) DealPipeline
Deal   (N) ——— (1) DealStage
Deal   (1) ——— (N) DealStageTransition
Deal   (N) ——— (N) Person       (via crm_deal_people)
Deal   (N) ——— (N) User         (via crm_deal_users)
Deal   (1) ——— (N) DealSplit
Deal   (1) ——— (N) DealFile

DealPipeline (1) ——— (N) DealStage

SmartList (N) ——— (1) Collection
SmartList (N) ——— (N) User       (via crm_saved_view_shares)

Automation (1) ——— (N) Enrollment
Automation (N) ——— (1) AutomationFolder
Automation (N) ——— (N) Template  (referenced inside steps JSONB)

Template (N) ——— (1) TemplateFolder

Pond   (1) ——— (N) User        (via crm_pond_members)
Group  (1) ——— (N) User        (via crm_group_members)

Appointment (N) ——— (1) AppointmentType
Appointment (N) ——— (1) AppointmentOutcome
Appointment (N) ——— (1) Person
Appointment (N) ——— (N) Person  (via guest_person_ids[])
```

---

## 4.3 Text ERD

```
+------------------+     +------------------+     +-------------------+
|   crm_people     |---->|  crm_stages      |     | crm_field_defs    |
|------------------|     |------------------|     |-------------------|
| id (PK)          |     | key (PK)         |     | id (PK)           |
| stage → key      |     | label            |     | key               |
| assigned_broker  |     | is_protected     |     | type (text/number |
| pond_id          |     | position         |     |   /date/dropdown) |
| timeframe *      |     +------------------+     | is_recurring      |
| tags text[]      |                              | hide_if_empty     |
| custom jsonb     |     +------------------+     +-------------------+
| emails jsonb     |     | crm_contact_     |
| phones jsonb     |---->| points           |
| addresses jsonb  |     |------------------|
+------------------+     | person_id        |
        |                | kind             |
        |                | value            |
        |                | label            |
        |                | is_primary       |
        |                +------------------+
        |
        +---------> +-------------------+
        |           | crm_person_tags   |  (MISSING)
        |           |-------------------|
        |           | person_id         |
        |           | tag_key → crm_tags|
        |           | added_by          |
        |           | added_at          |
        |           +-------------------+
        |
        +---------> +-------------------+
        |           | crm_relationships |
        |           |-------------------|
        |           | person_id         |
        |           | related_person_id |
        |           | kind              |
        |           +-------------------+
        |
        +---------> +---------------------+
        |           |crm_person_collab    |  (MISSING)
        |           |---------------------|
        |           | person_id           |
        |           | broker_slug         |
        |           +---------------------+
        |
        +---------> +-------------------+
        |           | crm_timeline      |
        |           |-------------------|
        |           | person_id         |
        |           | kind              |
        |           | ts                |
        |           | payload jsonb     |
        |           | via_automation    |
        |           +-------------------+
        |
        +---------> +-------------------+
        |           | crm_tasks         |
        |           |------------------- |
        |           | person_id         |
        |           | type              |
        |           | due_at            |
        |           +-------------------+

+------------------+     +-------------------+    +------------------+
| crm_deals        |---->| crm_deal_stages * |    | crm_deal_people *|
|------------------|     |-------------------|    |------------------|
| id (PK)          |     | id (PK)           |    | deal_id          |
| stage (text) *   |     | pipeline_id       |    | person_id        |
| pipeline (text)* |     | name              |    | role             |
| value            |     | is_closed_stage   |    +------------------+
| commission_*     |     | color             |
| close_date       |     | order_weight      |    +------------------+
| earnest_money_*  |     +-------------------+    | crm_deal_users * |
| mutual_accept_*  |                              |------------------|
| due_diligence_*  |     +-------------------+    | deal_id          |
| possession_*     |---->|crm_deal_pipelines*|    | broker_slug      |
+------------------+     |-------------------|    +------------------+
                         | id (PK)           |
                         | name              |    +------------------+
                         | order_weight      |    | crm_deal_splits  |
                         +-------------------+    |------------------|
                                                  | deal_id          |
                                                  | broker_slug      |
                                                  | split_pct / $    |
                                                  | type             |
                                                  +------------------+

+-------------------+     +---------------------+    +------------------+
| crm_automations * |---->|crm_sequence_enroll  |    |crm_auto_folders* |
|-------------------|     |---------------------|    |------------------|
| id (PK)           |     | person_id           |    | id (PK)          |
| triggers jsonb    |     | sequence_id         |    | name             |
| steps jsonb       |     | step_index          |    +------------------+
| status            |     | status              |
| run_once_per_     |     | next_run_at         |
| started_count *   |     | enrolled_by         |
| engaged_count *   |     +---------------------+
| completed_count * |
| folder_id *       |
+-------------------+

+-------------------+     +---------------------+    +------------------+
| crm_saved_views   |---->|crm_smart_list_coll* |    |crm_sv_shares *   |
|-------------------|     |---------------------|    |------------------|
| id (PK)           |     | id (PK)             |    | saved_view_id    |
| name              |     | name                |    | broker_slug      |
| emoji *           |     | emoji               |    | share_type       |
| description       |     | position            |    +------------------+
| filter jsonb      |     +---------------------+
| columns jsonb *   |
| collection_id *   |
| visibility *      |
| people_count *    |
+-------------------+

* = column/table MISSING from existing crm_* schema
```

---

## 4.4 Mapping to existing `crm_*` tables

| FUB entity | In-house table | Status | Key gaps |
|---|---|---|---|
| Person | `crm_people` | Partial | Missing: `timeframe`, `assigned_lender_id`, `lead_score`, `sms_opt_out`, `email_unsubscribed`, `email_bounced`, `last_communication_at`, `last_call_at`, `last_text_*`, `last_email_*` |
| ContactPoint | `crm_contact_points` | Present | Missing `validated_at`; JSONB in crm_people is denormalized duplicate — need sync strategy |
| Relationship | `crm_relationships` | Present | `kind` enum not enforced at DB level |
| PersonCollaborator | (none) | MISSING | Entire table missing |
| PersonTagAttribution | (none) | MISSING | `crm_people.tags text[]` has no attribution; needs junction table |
| Tag | `crm_tags` | Present | `key` vs `label` distinction exists; no join table |
| Stage | `crm_stages` | Present | Missing `description` column |
| CustomFieldDefinition | `crm_field_definitions` | Partial | Missing `is_recurring` |
| DealCustomFieldDef | (none) | MISSING | No deal-specific custom field table |
| User | `brokers` | Present | Missing `assigned_lender_id` cross-ref; `user_merge_field` missing |
| TimelineEvent | `crm_timeline` | Partial | Missing `is_starred`, `archived`, `opens`, `clicks`, `tracking_pixel_url`, `via_automation` |
| InboxThread | `crm_conversation_state` | Partial | Different model; `crm_conversation_state` tracks broker+status, not full thread |
| Task | `crm_tasks` | Present | Complete |
| Appointment | `crm_appointments` | Present | Missing `source` |
| AppointmentType/Outcome | `crm_appointment_types/outcomes` | Present | Complete |
| Deal | `crm_deals` | Partial | `person_id` single FK (needs `crm_deal_people` M:M); `pipeline`/`stage` are raw text (need FK to proper tables); missing `order_weight` |
| DealPeople junction | (none) | MISSING | Entire table missing |
| DealUsers junction | (none) | MISSING | Entire table missing |
| DealSplit | `crm_deal_splits` | Partial | Missing `type` column (agent/team) |
| DealStageTransition | (none) | MISSING | Entire table missing |
| DealPipeline | (none) | MISSING | No pipelines table; pipeline stored as text in crm_deals |
| DealStage | (none) | MISSING | No deal stages table; stage stored as text in crm_deals |
| Automation (v2) | `crm_automation_rules` (v1) + `crm_sequences` | Partial | Neither maps to v2 visual builder; missing folder, stats columns, trigger/step JSONB with full type set |
| AutomationFolder | (none) | MISSING | Entire table missing |
| Enrollment | `crm_sequence_enrollments` | Present | Maps to action plan / sequence enrollments; needs automation_id FK also pointing at crm_automations |
| SmartList | `crm_saved_views` | Partial | Missing: `emoji`, `columns`, `collection_id`, `visibility`, `people_count`, `count_refreshed_at` |
| SmartListShare | (none) | MISSING | Entire table missing |
| Collection | (none) | MISSING | Entire table missing |
| Pond | `crm_ponds` | Present | Complete |
| Group | `crm_groups` | Present | Complete |
| Template | `crm_templates` | Partial | Missing `folder_id`, `is_shared`, `opens`, `clicks`, `unsubscribed`, `bounces`, `automation_count`, `action_plan_count` |
| TemplateFolder | (none) | MISSING | Entire table missing |
| ChangeLog | (none) | MISSING | Entire table missing |
| AccountSettings | (scattered) | Partial | Fields across env vars and various tables |
| APIKey | (env vars) | Not formalized | |

---

## 4.5 Prior spec §5 errors corrected

The following items in `docs/FUB_CRM_FEATURE_SPEC.md` §5 are incorrect or incomplete and are superseded by this section:

**§5.1 Person:**
1. `timeframe` field is listed implicitly but NOT present in `crm_people` — must be added. Enum is exactly: `'0-3 Months'`, `'3-6 Months'`, `'6-12 Months'`, `'12+ Months'`, `'No Plans'` (observed in shot-08).
2. Description says "assigned_lender" but no `assigned_lender_id` column exists in `crm_people`.
3. Custom field type "Select" in §5.12 — the FUB-documented and UI-observed type name is `'dropdown'` not `'select'`.
4. `emails`, `phones`, `addresses` are stored both as JSONB arrays in `crm_people` AND as rows in `crm_contact_points` — this dual-write creates inconsistency. A synchronization strategy is required.

**§5.8 Deal:**
5. The stage lists "Start → Buyer Contract → Offer → Pending → Closed → Lost" — "Start" and "Lost" are Ryan Realty custom additions, not FUB defaults. FUB API docs list default Buyers stages as Buyer Contract, Offer, Pending, Closed.
6. `crm_deals` has only `person_id` (single FK). FUB supports many contacts per deal. A `crm_deal_people` junction table is required.
7. `crm_deals.pipeline` and `crm_deals.stage` are raw text. A proper `crm_deal_pipelines` and `crm_deal_stages` schema is required to support `is_closed_stage` flag (which gates leaderboard and commission reporting). Without this flag, leaderboard returns zero.
8. There is NO "Won" status in FUB API. The API `status` field always returns `'Active'` (confirmed by FUB API docs and deals.md analysis). "Won" = deal in a stage with `is_closed_stage=true`. The prior spec implied a Won/Lost status — this is wrong.

**§5.14 Automation:**
9. `crm_automation_rules` is a v1 simple (trigger → single-action) table. It does not represent FUB Automations 2.0 (visual multi-step builder). The `crm_sequences` table represents multi-step action plans. A unified `crm_automations` table modeling v2 is needed.
10. `crm_sequences` is missing: `folder_id`, `started_count`, `engaged_count`, `completed_count`, `created_by`, `is_system`, `run_once_per_person`.
11. The spec says "36 automations" — the screenshot (shot-34) clearly shows "38 Automations" in the header. Corrected to 38.

**§5.16 SmartList:**
12. `crm_saved_views.description` limit is 1,000 characters (per FUB smart list docs), not "~250 char" as stated in the prior spec.
13. `crm_saved_views` is missing `emoji`, `columns[]`, `collection_id`, `visibility`, `people_count`. There is no `crm_collections` table at all.
14. The prior spec says "148 observed" smart lists — this count is correct.

**§5.12 CustomFieldDefinition:**
15. `is_recurring` boolean is missing from `crm_field_definitions`. This flag distinguishes annual recurring date fields (birthday, anniversary) from one-time date fields (closing date). It is critical for automation calendar-trigger behavior.
16. Dropdown field options order is immutable after creation (per FUB docs). The in-house build must communicate this constraint clearly at field creation time.

**§5.22 Cardinality:**
17. "Deal N—N Person" was listed but not implemented (no junction table). "Deal N—N User" also not implemented.

---

## 4.6 Key design decisions (build notes)

1. **Tags dual-write:** `crm_people.tags text[]` is the fast-filter cache. `crm_person_tags` is the authoritative source with attribution. Any write to tags must update both. The `mergeTags` API parameter (default false = overwrite all tags) must be replicated exactly to match FUB behavior.

2. **Deal pipeline FK migration:** before adding `crm_deal_pipelines` and `crm_deal_stages`, write a migration that seeds both tables from the observed Ryan Realty stage values, then backfills `crm_deals.stage_id` and `crm_deals.pipeline_id` from the existing text columns.

3. **Stage `is_protected` enforcement:** the three protected stages (Lead, Closed, Trash) must be seeded and the API must reject rename/delete attempts. Stage deletion must be blocked until zero contacts are in that stage.

4. **`is_closed_stage` flag:** never use a hardcoded stage name for commission/leaderboard queries. Always join to `crm_deal_stages.is_closed_stage = true`. A pipeline with no stage having this flag set produces zero leaderboard data.

5. **Automation v2 engine:** the existing `crm_automation_rules` (v1) and `crm_sequences` (action plans) should be preserved as-is for backward compatibility. New automations go into `crm_automations`. The enrollment table (`crm_sequence_enrollments`) should accept both `sequence_id` and `automation_id` foreign keys (add nullable `automation_id` column).

6. **Smart list count cache:** cache the count in `crm_saved_views.people_count`. Refresh every 10 minutes via a background job while users are active, and immediately on smart list click, create, or save (matching FUB's observed behavior).

7. **Custom field `key` vs `label`:** `key` is the API identifier generated at field creation from the label (e.g., `customEnrichmentProvider` from label "Enrichment Provider"). After the label is renamed, `key` stays the same. Application layer must use `key` for all writes to `crm_people.custom` JSONB.

8. **Deal `close_date` vs actual:** FUB uses `projectedCloseDate` as both projected and actual close date. The in-house TC build should add `actual_close_date date` to `crm_deals` and auto-populate it when a deal is moved to a closed-flagged stage (if not already set).

9. **Compliance suppression pipeline:** the seven compliance tags (`compliance:hard-stop`, `tcpa:litigator`, `Bounced`, `contact:do-not-email`, `Unsubscribed`, `do_not_text`, `NOTEXT`) must form an EXCLUDE clause in every smart list query by default. The `crm_suppressions` table handles channel-level suppression. Both systems must stay synchronized.

10. **Email/text deduplication in automations:** if two action plans both schedule the same template to the same contact on the same day, send the email once but mark both enrollments as having sent. Store the template+contact+date tuple as a dedupe key.
