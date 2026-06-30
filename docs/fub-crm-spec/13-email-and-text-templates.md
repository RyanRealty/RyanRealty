# 13. Module: Email & Text Templates

> **Scope:** Reusable message content for compose, action plans, and automations. Two discrete admin sections sharing a common folder architecture pattern but distinct editor types, table schemas, and performance metrics. URL entry points: `/2/email-templates` and `/2/text-templates`.
>
> **Prior-spec errors corrected here (was §14):** (1) text template table columns were entirely wrong — actual columns are Template | Score | Replies | Opt Outs | Sent | Actions, not the "Folders · Automations · Click-to-Call Goal · Sort · Emails · Clicks · Unsubscribed · Bounces" listed in §14.2; (2) email template "Sort" column does not exist — removed; (3) merge token syntax is `%field_name%` (percent-delimited), not `{firstname}` (curly braces); (4) no "test send" button exists in either modal; (5) text template share label is "Share this text template with everyone" not "Show this text template"; (6) text template table has no Folders, Automations, Click-to-Call Goal, Emails, Clicks, Bounces columns in the list view; (7) email template table has a Replies column (not documented in prior spec); (8) Template Performance Score system (text templates) was entirely absent from prior spec.

---

## 13.1 Email Templates

### 13.1.1 Navigation: two-level folder architecture

Email Templates is a two-level section. The top level shows a folder list; clicking a folder navigates into the template list for that folder.

**Top level — folder list**

URL: `/2/email-templates` (or `/2/email-templates/all`)

Page header: **"3 Email Template Folders"** (Ryan Realty observed count).

Controls (top right of the page, not inside the table): `+ Email Template` (primary action — opens Add Template modal), `+ Folder` (creates a folder), `Search Templates` (search input, plain text filter).

Folder table columns:

| Column | Detail |
|---|---|
| Name | Folder name as a link; clicking navigates into the folder's template list |
| Email Templates | Template count badge (integer) |
| Actions | Edit (pencil) + Delete (trash) icons |

**Ryan Realty observed folders (2026-06-30):**

| Folder Name | Template Count |
|---|---|
| All Email Templates | 76 |
| My Email Templates | 76 |
| Used by Action Plans | 45 |

Note: "All Email Templates" and "My Email Templates" are system-default folders. "Used by Action Plans" is a filtered view, not a folder users can add templates to.

**Second level — template list**

After clicking a folder, the page shows:

- Breadcrumb: `Email Templates / My Email Templates` (folder name)
- Header count: **"76 Email Templates"** (scoped to the selected folder)
- Same top-right controls: `+ Email Template`, `+ Folder`, `Search Templates`

### 13.1.2 Email template table

Column order and schema (observed in shots 47 and admin2 GIF):

| Column | Type | Detail |
|---|---|---|
| [checkbox] | selection | Leftmost column; bulk-select all via header checkbox |
| Template | two-line text | Line 1: template name as a blue link; Line 2: subject line / preview text in muted gray |
| Folders | text list | Comma-separated folder names the template belongs to |
| Automations | count + icon | Integer count of automations referencing this template; eye (👁) icon opens a popover listing each automation by name |
| Action Plans | count + icon | Integer count of action plans referencing this template; eye (👁) icon opens usage list |
| Sent | integer | Total send count across all uses; displays `0` when no sends recorded |
| Opens | metric | Displays `—` when Sent = 0; displays integer once data exists |
| Clicks | metric | Same null pattern as Opens |
| Replies | metric | Same null pattern as Opens |
| Unsubscribed | metric | Same null pattern; count of contacts who unsubscribed via this template |
| Bounces | metric | Count of hard/soft bounces; column header has a `?` help icon linking bounce type documentation |
| Actions | icon button | Pencil icon opens the Edit Email Template modal |

**Observed data pattern:** When `Sent = 0`, all engagement columns (Opens, Clicks, Replies, Unsubscribed, Bounces) display `—`, not `0`. They become integers once send history exists.

**SMS templates in the email list:** Templates named with a `[SMS]` suffix appear inside the Email Templates section alongside standard HTML templates. Example: "BL-S1 Buyer SMS Confirmation [SMS]". These share the email template table schema.

### 13.1.3 Edit Email Template modal

Opened by clicking the pencil (Actions column) or a template name link. Full-width modal, scrollable body.

**Modal header:**
- Icon: envelope (✉)
- Title: **"Edit Email Template"**
- Metadata line: `Created on [Month Dth, YYYY] at [H:MMam/pm] by [Full Name]` (example: "Created on May 4th, 2025 at 9:53am by Matt Ryan")

**Usage notice (conditional):** When the template is referenced by automations or action plans, a notice appears directly below the metadata: `In use by [N] automation & [N] action plan`. This is informational — saving still updates all downstream references. The counts link to the same usage popover as the eye icons in the table.

**Form fields (in order):**

| Field | Type | Notes |
|---|---|---|
| Subject | text input | Email subject line; `Merge Fields ▾` button to the right inserts a token at cursor |
| Preview text | text input | Optional — displayed in inbox preview beneath subject; `Merge Fields ▾` button to the right |
| Body | rich-text editor | Full HTML email body; toolbar described below |
| Share this template with everyone | checkbox | When checked, all team members can see and use this template; creators and Owners/Admins can edit |
| Folders | folder assignment | Shows current folder(s); `+` button to assign additional folders |

**Rich-text editor toolbar (left to right):** Bold, Italic, Underline, Lists (unordered/ordered), Insert Link, Insert Image, Additional options (`...` / kebab). Merge Fields `▾` button in the toolbar inserts tokens at cursor position in the body.

**Signature note (below body editor):** Static informational text: *"The sender's signature from My Settings will automatically be added."* — "My Settings" is a hyperlink to the user's signature settings. Signatures are NOT stored in the template body; they are auto-appended at send time per the sending user's profile.

**Modal footer:** `Cancel` (left) | `Save` (right, primary).

**HTML constraints in template bodies:**
- Inline styles only (`style="..."` attributes). `<style>` blocks are stripped at render time.
- `<iframe>` elements are stripped.
- Attachments cannot be added to email templates. Template-triggered sends (action plans, automations, batch) do not support attachments. Attachments are desktop-only for 1:1 direct compose.

### 13.1.4 Add Email Template modal

Same modal as Edit, without the metadata line and usage notice. Opens from the `+ Email Template` button. All fields are blank. On Save, the template is created in the current folder context (if inside a folder) or in "My Email Templates" by default.

---

## 13.2 Text Templates

### 13.2.1 Navigation: two-level folder architecture

Same pattern as email templates. Top level shows folders; clicking navigates into the template list.

**Top level — folder list**

URL: `/2/text-templates` (or `/2/text-templates/my`)

Page header: **"2 Text Template Folders"** (system-default count).

Controls (top right): `+ Text Template`, `+ Folder`, `Search Templates`.

Folder table columns: Name | Text Templates (count) | Actions.

**System-default folders:**

| Folder Name | Default Count |
|---|---|
| All Text Templates | (total count) |
| My Text Templates | (personal templates) |

**Second level — template list**

After clicking a folder:

- Breadcrumb: `Text Templates / My Text Templates`
- Header count: **"14 Text Templates"** (Ryan Realty observed in shots 45/46)
- Same top-right controls

### 13.2.2 Text template table

Column order (observed in shot-45, confirmed distinct from email templates):

| Column | Type | Detail |
|---|---|---|
| Template | two-line text | Line 1: template name; Line 2: first line of body text (preview) |
| Score | text | Template Performance Score — see §13.2.4 for full spec. Displays `Pending (–)` until 7+ days of send data |
| Replies | metric | Format `– (XX%)`: current user reply rate (null = `–`) + global benchmark in parens |
| Opt Outs | metric | Format `– (XX%)`: current opt-out rate + benchmark |
| Sent | metric | Format `0 (XX)`: recent sends + all-time total in parens |
| Actions | icon buttons | Pencil (edit, opens modal) + Trash (delete, confirmation dialog) |

**No Folders, Automations, Click-to-Call Goal, Emails, Clicks, Bounces, or Unsubscribed columns exist in the text template list view.** (Prior spec §14.2 listed these incorrectly — corrected here.)

**Ryan Realty observed templates (shot-45, partial list):**

| Template Name | Score | Notes |
|---|---|---|
| Crossroads | Pending (–) | Manual-send re-engagement template |
| EXP-TO – Expired listing personal intro (manual send) | Pending (–) | Expired listing outreach |
| FSBO – For Sale By Owner intro (manual send) | Pending (–) | FSBO outreach |
| New Lead – Initial reach out | Pending (–) | Used in lead flow |
| (12+ additional templates) | Pending (–) | Mix of manual and automated |

All 14 templates show "Pending (–)" score at time of observation, indicating < 7 days of send history on each or the scoring window not yet populated.

### 13.2.3 Edit Text Template modal

Two-column layout. Left column (wider): template name + body editor. Right column (narrower): sharing + feature controls.

**Left column fields:**

| Field | Type | Notes |
|---|---|---|
| Template name | text input | Displayed name, e.g. "Crossroads"; used in the template list |
| Body | plain-text textarea | No rich-text formatting. Line breaks render as line breaks in SMS. No HTML. |
| Emoji button | inline toolbar | Opens emoji picker; inserts emoji at cursor |
| Merge Fields ▾ | inline toolbar | Dropdown listing available merge tokens; inserts `%field_name%` at cursor |

**Hint text below body textarea:** `"Remember to keep text messages short"` (static, always visible).

**Right column fields:**

| Control | Type | Notes |
|---|---|---|
| Share this text template with everyone | toggle or checkbox | When enabled, all team members see and can use this template |
| Feature | circular blue icon button | Marks the template as "featured" — appears prominently in the quick-text picker during lead compose |
| Delete | text button (red) | Permanently deletes the template; confirmation required |

**Modal footer:** `Cancel` (left) | `Save` (right, primary).

**Observed template body (shot-46, "Crossroads" template — transcribed verbatim):**

```
Hey %contact_first_name%, it's %agent_first_name% with Ryan Realty in Bend. We
connected a while back about real estate and I wanted to check back in
with you. Are you still thinking about making a move or has that path
shifted for you?
```

This confirms the `%field_name%` merge token format and the plain-text (no HTML) body constraint.

### 13.2.4 Template Performance Score

**What it is:** A percentile-based quality score generated by FUB's platform AI. A score of `90` means the template performs better than 90% of comparable templates globally on the FUB network.

**Calculation window:** FUB shows BOTH a **30-day rolling** benchmark score AND an **all-time lifetime** aggregate, updated in real-time per column (per FUB docs, verified 2026-06-30 — corrected from "not a lifetime aggregate"). The 30-day window is the primary percentile benchmark; lifetime data is always shown alongside it. (7-day minimum data before a score appears.)

**Minimum data requirement:** The score shows `Pending (–)` until the template has at least 7 days of send history with enough volume for statistical significance. "–" is not a zero — it means unscored, not low-performing.

**Four component metrics used to compute the score:**

| Metric | What it measures | Displayed in table as |
|---|---|---|
| Reply rate | Percentage of recipients who replied to a text sent from this template | Replies column: `– (benchmark%)` |
| Opt-out rate | Percentage who opted out (replied STOP) | Opt Outs column: `– (benchmark%)` |
| First-touch compliance | Whether the template includes agent name + company name (required by TCPA/carrier rules in initial lead contact) | Factor in score, not shown as separate column |
| Carrier filtering rate | How often the template triggers carrier spam filters (error 30007) | Factor in score; "Needs Review" badge appears on templates with high filtering rate |

**Score display states:**

| Display | Meaning |
|---|---|
| `Pending (–)` | < 7 days of send data; score not yet computed |
| `[integer] ([percentile]%)` | Scored; shows raw score + percentile |
| Needs Review badge | Template has a high carrier filtering rate; should be rewritten before further use |

---

## 13.3 Merge Field Catalog

Both email and text templates share the same merge field system. Format: **`%field_name%`** (percent sign on both sides, snake_case or camelCase depending on category). The Merge Fields dropdown in the editor groups tokens by category.

### 13.3.1 Standard merge field categories

**CONTACT**

| Token | Resolves to |
|---|---|
| `%contact_first_name%` | Contact's first name |
| `%contact_last_name%` | Contact's last name |
| `%contact_email%` | Contact's primary email |
| `%contact_phone%` | Contact's primary phone |
| `%contact_stage%` | Contact's current stage name |
| `%contact_address_street%` | Street address |
| `%contact_address_city%` | City |
| `%contact_address_state%` | State |
| `%contact_address_zip%` | Zip code |
| `%contact_address_full%` | Full formatted address |

**COMPANY**

| Token | Resolves to |
|---|---|
| `%company_name%` | Company name from contact record |
| `%company_address%` | Company address |

**AGENT** (the assigned agent for the contact)

| Token | Resolves to |
|---|---|
| `%agent_first_name%` | Assigned agent's first name |
| `%agent_last_name%` | Assigned agent's last name |
| `%agent_email%` | Assigned agent's email |
| `%agent_phone%` | Assigned agent's phone |
| `%agent_title%` | Agent's title from profile |
| `%agent_brokerage%` | Agent's brokerage name |
| `%agent_website%` | Agent's website URL |

**LENDER** (the assigned lender, if any)

| Token | Resolves to |
|---|---|
| `%lender_first_name%` | Lender's first name |
| `%lender_last_name%` | Lender's last name |
| `%lender_email%` | Lender's email |
| `%lender_phone%` | Lender's phone |

**SENDER** (the user actually sending the message, which may differ from the assigned agent)

| Token | Resolves to |
|---|---|
| `%sender_first_name%` | Sender's first name |
| `%sender_last_name%` | Sender's last name |
| `%sender_email%` | Sender's email |
| `%sender_phone%` | Sender's phone |

**PROPERTY** (listing context when available)

| Token | Resolves to |
|---|---|
| `%property_address%` | Full listing address |
| `%property_price%` | Listing price |
| `%property_mls_number%` | MLS number |

**LAST VIEWED** (populated from IDX web activity)

| Token | Resolves to |
|---|---|
| `%last_viewed_address%` | Address of the last listing the contact viewed on the site |

**LEAD SOURCE**

| Token | Resolves to |
|---|---|
| `%lead_source_name%` | Lead source name (e.g., "Zillow", "Website") |
| `%lead_source_campaign%` | Campaign name if available |

**OTHER**

| Token | Resolves to |
|---|---|
| `%greeting%` | Time-appropriate salutation: "Good morning", "Good afternoon", or "Good evening" — resolved at send time in the contact's timezone |

### 13.3.2 Custom field merge tokens

Every admin-defined custom field (Admin > Custom Fields, 64 defined for Ryan Realty) is available as a merge token using the format:

```
%customFieldName%
```

where `FieldName` is the custom field's name in camelCase with the `custom` prefix. The FUB admin merges the field name directly, stripping spaces and applying camelCase.

**Observed example from shot-48:** `%customBuyerSearchAreas%` — resolves to the "Buyer Search Areas" custom field value, which stores the geographic areas a buyer contact is searching.

If the field has no value for a given contact, the token resolves to an empty string (not the literal token text).

### 13.3.3 User Merge Field (per-agent personal token)

Each team member can define one personal merge token in Admin > Team > Edit Team Member > **User Merge Field**. This is a freeform text value — typically a Calendly or scheduling link, a direct phone number, or a bio URL.

The token resolves as `%user_[defined_value]%` or via the standard agent merge field chain depending on sender context. The primary use case is inserting a scheduling link unique to each broker without hardcoding URLs into shared templates.

---

## 13.4 Sending Rules and Limits

### 13.4.1 Batch email limits

| Limit | Value | Notes |
|---|---|---|
| Batch emails per user per day | 10,000 | Native FUB limit |
| Raise limit via integration | Yes | SendGrid integration raises the cap; configured in Integrations admin |

### 13.4.2 Action plan email limits

| Limit | Value |
|---|---|
| Max automated emails per contact per day | 4 |

This is a hard platform limit regardless of how many action plans are enrolled simultaneously. Emails beyond 4/contact/day **FAIL TO SEND permanently — they are dropped, NOT queued to the next day**, returning the message "This person has already received the maximum amount of automated emails today." (per FUB help docs, verified 2026-06-30).

### 13.4.3 Unsubscribe behavior

- Unsubscribed contacts show an orange indicator on their email address in the contact record.
- The `unsubscribed` tag is auto-applied to the contact.
- Unsubscribing blocks marketing emails (batch, action plan, automation templates) but NOT 1:1 direct compose emails — an agent can still manually email an unsubscribed contact.
- **Resubscription:** There is no in-app resubscription flow. The contact (or agent on their behalf) must email FUB support. This is a platform constraint, not an in-house build requirement.

### 13.4.4 Bounce behavior

- Hard bounces: email address flagged, shown as BOUNCED indicator in orange on the contact record.
- The system does not automatically remove bounced addresses — agents review and update manually.
- Soft bounces: treated as deliverable for retry; behavior follows FUB's internal delivery logic.

### 13.4.5 Text send limits

| Limit | Value | Notes |
|---|---|---|
| Quiet hours | 9:00 pm – 8:00 am | **Agent's timezone**, not contact's timezone |
| Scheduled text cap | 50 per 24h, team-wide *(UNVERIFIED — could not confirm against live docs; confirm before relying)* | Applies to all schedule-sent texts across the team |
| Simultaneous scheduled texts to same contact | 1 | Cannot queue two scheduled texts to the same person at the same time |
| Scheduling window | Next 24 hours only | Cannot schedule a text more than 24 hours in advance |
| Character limit (recommended) | 320 characters | Initial lead-flow texts: 300 characters/line |

### 13.4.6 A2P 10DLC compliance (SMS pre-condition)

Texting is gated behind A2P 10DLC Business Registration. No outbound SMS — from templates or direct compose — is possible until Business Registration is complete and approved by The Campaign Registry.

**Ryan Realty status (2026-06-30):** A2P verified. 541.703.3095 ported to Twilio and active as the in-house CRM number. No action needed for initial build. See project memory `project_twilio_cutover.md`.

**First-touch compliance:** The first text sent to a new contact from a template MUST include the agent's name and company name. FUB enforces this as part of the Template Performance Score (first-touch compliance metric). Carrier filtering (error 30007) can result when:
- The message contains common spam trigger words
- The message includes a shortened URL (bit.ly, tinyurl.com, etc.)
- The message contains emojis (especially in initial outreach)
- The message body is not carrier-registered

### 13.4.7 Video texting

| Constraint | Value |
|---|---|
| Platform | Mobile only (iOS FUB app + Android FUB app) — NOT available from web |
| File size < 5 MB | Sent as inline MMS |
| File size > 5 MB | FUB generates a redirect link; recipient taps to view video |
| Maximum file size | 500 MB |

Video texting uses a template body with a video attachment rather than a text-only template. In the in-house system, this maps to an MMS send path rather than the standard SMS template renderer.

### 13.4.8 Email HTML constraints

| Constraint | Rule |
|---|---|
| Style blocks | Stripped — use inline `style="..."` attributes only |
| `<iframe>` | Stripped |
| Attachments | Not supported in templates, batch sends, action plans, or automations. Desktop 1:1 direct compose only. |
| Images | Hosted externally (URL reference); FUB does not host image assets |

### 13.4.9 Email domain authentication

For deliverability, the sending domain should have SPF and DKIM records configured. Ryan Realty's sending domain authentication is managed in Admin > Integrations > Email Domain Authentication.

---

## 13.5 Template Data Model

### 13.5.1 `crm_templates` table (single table, polymorphic by type)

```typescript
interface CrmTemplate {
  id: uuid;
  type: 'email' | 'text';

  // Identity
  name: string;                    // Display name (Template column line 1)
  subject?: string;                // Email only — subject line
  preview_text?: string;           // Email only — inbox preview text (separate from body)
  body_html?: string;              // Email only — rich HTML with inline styles
  body_text?: string;              // Text only — plain text, merge tokens, line breaks preserved

  // Organization
  folder_id?: uuid;                // FK → crm_template_folders.id (nullable = unfoldered)
  shared: boolean;                 // true = all team members can see/use

  // Ownership
  created_by: uuid;                // FK → crm_users.id
  created_at: timestamptz;

  // Usage counters (derived from cross-references, or denormalized)
  automation_count: integer;       // Count of automations referencing this template
  action_plan_count: integer;      // Count of action plans referencing this template

  // Email engagement metrics (email type only)
  sent_count: integer;
  open_count: integer;
  click_count: integer;
  reply_count: integer;
  unsubscribed_count: integer;
  bounce_count: integer;

  // Text performance metrics (text type only)
  text_sent_count: integer;        // Recent (30-day) sends
  text_sent_total: integer;        // All-time total sends
  text_reply_count: integer;       // Recent replies
  text_reply_rate?: float;         // Computed: text_reply_count / text_sent_count
  text_opt_out_count: integer;
  text_opt_out_rate?: float;
  text_performance_score?: integer; // 0–100 percentile; null = Pending (< 7 days)
  text_featured: boolean;          // "Feature" toggle = appears prominently in quick-text picker
  text_needs_review: boolean;      // true when carrier filtering rate is high
}
```

### 13.5.2 `crm_template_folders` table

```typescript
interface CrmTemplateFolder {
  id: uuid;
  type: 'email' | 'text';
  name: string;
  is_system: boolean;              // true for "All Email Templates", "My Email Templates", etc.
  created_by: uuid;
  created_at: timestamptz;
}
```

### 13.5.3 `crm_template_folder_memberships` join table

Many-to-many: a template can belong to multiple folders (observed in email templates where a template appears in both "My Email Templates" and "Used by Action Plans").

```typescript
interface CrmTemplateFolderMembership {
  template_id: uuid;               // FK → crm_templates.id
  folder_id: uuid;                 // FK → crm_template_folders.id
}
```

### 13.5.4 Merge field resolution at send time

Merge fields are NOT stored expanded. The template body is stored with raw tokens (`%contact_first_name%`) and the rendering layer substitutes values from the contact record and sender profile at send time.

Token resolution order (when a contact has multiple values or the field is null):
1. Primary contact record (first match)
2. Custom field value (for `%custom*%` tokens)
3. Sending agent's profile (for `%agent_*%` and `%sender_*%` tokens)
4. Empty string (never the literal token text in output)

---

## 13.6 Implementation: Email Templates UI

### 13.6.1 Routes

| Route | Component | Notes |
|---|---|---|
| `/admin/crm/settings/email-templates` | `EmailTemplateFolderList` | Top-level folder list |
| `/admin/crm/settings/email-templates/[folderId]` | `EmailTemplateList` | Template list for a folder |
| `/admin/crm/settings/text-templates` | `TextTemplateFolderList` | Top-level folder list |
| `/admin/crm/settings/text-templates/[folderId]` | `TextTemplateList` | Template list for a folder |

### 13.6.2 Folder list component

```tsx
// EmailTemplateFolderList — same pattern for TextTemplateFolderList
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Page header: "3 Email Template Folders"
// Controls: [Search Templates input] [+ Folder] [+ Email Template]
// Table: Name | Email Templates (count) | Actions
```

Design tokens:
- Background: `bg-background` (`#faf8f4`)
- Page heading: Amboqia Boriango display font via `<H2>` primitive, `text-primary` (`#102742`)
- Table: `<Table>` from `@/components/ui/table`
- Folder name link: `text-primary` underline on hover
- Count badge: `<Badge variant="secondary">`
- Primary button (`+ Email Template`): `<Button>` variant default
- Secondary button (`+ Folder`): `<Button variant="outline">`

### 13.6.3 Template list component — email

```tsx
// EmailTemplateList
// Columns: checkbox | Template (name+subject 2-line) | Folders | Automations (count+eye) |
//          Action Plans (count+eye) | Sent | Opens | Clicks | Replies |
//          Unsubscribed | Bounces (with ? help icon) | Actions (pencil)

// Null display: when Sent = 0, engagement columns render "—" (em-dash as data placeholder,
// allowed exception per CLAUDE.md brand voice rules for tabular null values)

// Automations/Action Plans cell: count as link text + eye (👁) icon button
// Eye click → Tooltip or Popover listing automation/action-plan names that reference this template
```

### 13.6.4 Edit Email Template modal

```tsx
// Uses <Dialog> from @/components/ui/dialog
// Fields:
//   <Input> — Subject (with MergeFieldInserter button)
//   <Input> — Preview text (with MergeFieldInserter button)
//   <RichTextEditor> — Body (custom component wrapping a headless editor; merge field inserter in toolbar)
//   Signature note: static <p> with <a> to /settings/profile#signature
//   <Checkbox> — "Share this template with everyone" (from @/components/ui/checkbox)
//   <Label> from @/components/ui/label
//   Folder assignment: chip list + <Button size="sm"> to open folder picker
// Footer: <Button variant="outline">Cancel</Button> <Button>Save</Button>
```

**MergeFieldInserter component:** A dropdown `<DropdownMenu>` from `@/components/ui/dropdown-menu` grouping merge tokens by category (Contact, Company, Agent, Lender, Sender, Property, Last Viewed, Lead Source, Other, Custom Fields). Clicking a token inserts `%field_name%` at the current cursor position in the adjacent field.

**Usage notice banner:** Conditionally rendered above the Subject field when `automation_count > 0 || action_plan_count > 0`. Uses `<Alert>` from `@/components/ui/alert`, informational variant.

---

## 13.7 Implementation: Text Templates UI

### 13.7.1 Template list component — text

```tsx
// TextTemplateList
// Columns: Template (name+preview 2-line) | Score | Replies | Opt Outs | Sent | Actions (pencil+trash)
// Score cell: renders "Pending (–)" or "[N] ([percentile]%)" or <Badge>Needs Review</Badge>
// Replies: "– (XX%)" — dash = no current-user data; XX% = global benchmark
// Opt Outs: same format
// Sent: "0 (XX)" — 0 = recent; XX = all-time total
// Actions: two icon buttons — pencil (edit) + trash (delete with confirmation <AlertDialog>)
```

### 13.7.2 Edit Text Template modal

```tsx
// Two-column layout using CSS grid (left: ~65%, right: ~35%)
// Left column:
//   <Label>Template name</Label>
//   <Input> — name field
//   <Textarea> from @/components/ui/textarea — plain text body (no rich text)
//   Toolbar row: EmojiPickerButton | MergeFieldDropdown
//   Hint: <p className="text-muted-foreground text-sm">Remember to keep text messages short</p>
// Right column:
//   <Label + Switch or Checkbox> — "Share this text template with everyone"
//   Feature button — circular icon toggle (marks template as featured in quick-text picker)
//   <Button variant="destructive">Delete</Button>
// Footer: <Button variant="outline">Cancel</Button> <Button>Save</Button>

// No test-send button in this modal (none observed in FUB — removed from prior spec)
```

**EmojiPickerButton:** Opens an emoji picker popover. On emoji select, inserts the character at cursor in the textarea. Use `@/components/ui/popover` from the design system for the picker container.

---

## 13.8 Performance Score Display Component

```tsx
interface TemplatePerfScoreProps {
  score: number | null;   // null = Pending
  needsReview: boolean;
}

// Render logic:
// score === null && !needsReview → render "Pending (–)" in text-muted-foreground
// score !== null && !needsReview → render "[score] ([percentile]%)" with color:
//   score ≥ 75: text-success-foreground
//   score 40–74: text-warning-foreground
//   score < 40: text-destructive
// needsReview → render <Badge variant="destructive">Needs Review</Badge>
```

---

## 13.9 Acceptance Criteria

### Email Templates
- [ ] Folder list shows all email template folders with template counts; `+ Folder` and `+ Email Template` buttons functional.
- [ ] Clicking a folder navigates to the template list with breadcrumb and scoped template count.
- [ ] Template table renders all 11 columns in correct order: checkbox, Template (2-line), Folders, Automations (count+eye), Action Plans (count+eye), Sent, Opens, Clicks, Replies, Unsubscribed, Bounces, Actions.
- [ ] When `sent_count = 0`, engagement metric columns render `—` (not `0`).
- [ ] Eye icon on Automations and Action Plans count opens a list of referencing automations/action plans by name.
- [ ] Edit modal shows creation metadata (date + creator name) and conditional usage notice.
- [ ] Subject and Preview text fields each have a functional Merge Field inserter.
- [ ] Rich-text editor toolbar supports Bold, Italic, Underline, lists, link, image, and a Merge Field inserter.
- [ ] Merge field inserter dropdown groups tokens by category (Contact, Company, Agent, Lender, Sender, Property, Last Viewed, Lead Source, Other, Custom Fields).
- [ ] Inserting a merge token produces `%field_name%` (percent-delimited) at cursor position in the field.
- [ ] "Share this template with everyone" checkbox persists the `shared` flag.
- [ ] Signature note renders below body editor with working "My Settings" link.
- [ ] Save persists all fields; Cancel discards without saving.
- [ ] No test-send button is rendered (per FUB parity — test send is not in the template edit modal).

### Text Templates
- [ ] Folder list shows "2 Text Template Folders" with template counts; folder and template create buttons functional.
- [ ] Template table renders exactly 6 columns: Template, Score, Replies, Opt Outs, Sent, Actions.
- [ ] No Folders, Automations, Emails, Clicks, Bounces, or Click-to-Call Goal columns present (prior spec error — these do not exist in the text template list).
- [ ] Score column shows `Pending (–)` when `text_performance_score` is null; shows scored value and color-coded when computed.
- [ ] `Needs Review` badge renders when `text_needs_review = true`.
- [ ] Replies and Opt Outs show `– (XX%)` format with benchmark in parens; Sent shows `N (N)` format.
- [ ] Delete icon triggers confirmation dialog before deleting.
- [ ] Edit modal renders two-column layout with name field, plain-text textarea, emoji picker, and merge field dropdown.
- [ ] Hint text "Remember to keep text messages short" renders below textarea.
- [ ] "Share this text template with everyone" toggle persists the `shared` flag.
- [ ] Feature toggle persists `text_featured` flag; featured templates appear prominently in quick-text compose pickers.
- [ ] Delete button inside modal triggers confirmation and deletes on confirm.
- [ ] Body saves as plain text (no HTML encoding or rich-text markup).

### Merge fields (both types)
- [ ] All standard categories present in the dropdown: Contact, Company, Agent, Lender, Sender, Property, Last Viewed, Lead Source, Other.
- [ ] Custom fields from `crm_custom_fields` appear in a "Custom Fields" category.
- [ ] Token format is `%field_name%` throughout — no curly braces.
- [ ] Tokens with no value for a given contact resolve to empty string (not the literal token text) at send time.

---

## 13.10 Cross-references

- **Action Plans** (`12-action-plans.md`) — action plan email/text steps reference templates by `template_id`; the "In use by N action plan" notice in the email template edit modal links to the action plan usage list.
- **Automations** (`11-automations.md`) — automation "Send Email" steps reference templates; same eye-icon usage popover pattern.
- **Compose modals** (`07c-person-detail-compose-modals-and-right-rail.md`) — email compose and quick-text compose both include a template picker that renders `crm_templates` filtered by `type` and `shared` flag; merge fields resolve against the open contact record.
- **Inbox** (`08-inbox.md`) — reply compose in inbox also supports template insertion.
- **Admin Settings** (`15-admin-settings.md`) — Email Templates and Text Templates appear as sub-nav tabs under Admin; Business Registration (A2P 10DLC) is a sibling admin tile gating all SMS.
- **Team** (`15-admin-settings.md` §15.4) — User Merge Field is set per team member in the Edit Team Member modal; resolves as a personal token in templates sent by that user.

---

## 13.11 Sources

| Source | File |
|---|---|
| Email template table columns + folder list | `fub-analysis-gif/admin2.md` (frames 7–8) |
| Email template list all-view (76 templates, column values, null pattern) | `fub-analysis/shot-47.md` |
| Edit Email Template modal (all fields, merge token format, usage notice, metadata) | `fub-analysis/shot-48.md` |
| Text template list (14 templates, Score/Replies/Opt Outs/Sent columns, all Pending) | `fub-analysis/shot-45.md` |
| Edit Text Template modal ("Crossroads" body, two-column layout, emoji, hint text) | `fub-analysis/shot-46.md` |
| Text template folder list (2 folders, folder-first architecture) | `fub-analysis-gif/admin4.md` (frame 3) |
| Admin sub-nav tab order and Email/Text Templates placement | `fub-analysis-gif/admin1.md` |
| Merge field categories, email send limits, HTML constraints, bounce/unsubscribe behavior, signature auto-add, sharing rules | `fub-docs/emailing.md` |
| Template Performance Score, A2P 10DLC gate, carrier filtering (error 30007), quiet hours, schedule caps, video texting, first-touch compliance | `fub-docs/texting.md` |
| Prior spec (corrected) | `docs/FUB_CRM_FEATURE_SPEC.md` §14 |
