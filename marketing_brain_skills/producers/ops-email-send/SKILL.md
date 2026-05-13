---
name: ops-email-send
description: >
  Drafts, validates, and sends bulk and transactional emails to FUB segments
  via the Resend API. Validates subject and body against Ryan Realty brand
  voice before surfacing to Matt. Verifies the mail.ryan-realty.com sender
  domain is confirmed in Resend before any send. Every send requires Matt's
  explicit approval. Captures message IDs and delivery status in the action row.
action_types:
  - ops:email_newsletter
  - ops:email_blast
  - ops:email_template_update
---

# ops-email-send — Email Send Operational Producer

**Scope:** Handles the draft, validate, and send pipeline for outbound emails to
Ryan Realty's FUB segments. Produces newsletter sends, one-off blast emails, and
transactional template updates via the Resend API (`mail.ryan-realty.com` sender).
Validates content against voice guidelines before surfacing to Matt. Pulls
recipient count from FUB or Supabase before surfacing. Never sends without Matt's
explicit "yes" / "approved" / "go."

Does NOT generate social posts or video — those go through the content producers.
Does NOT manage FUB email sequences (sequence config changes are owned by
`ops-fub-crm`). Does NOT send through FUB's built-in mailer — Resend is the
canonical transactional email provider for Ryan Realty.

**Status:** Canonical
**Locked:** 2026-05-13
**Exemplar output:** `out/email-drafts/<slug>/` containing `preview.html`,
`preview.txt`, `citations.json`, and the action row's `executor_response`.

---

## 1. Scope

### In scope
- `ops:email_newsletter` — monthly or periodic newsletter to a named segment
- `ops:email_blast` — one-off email to a segment or filter (e.g. announcement,
  market alert, listing drop, event invite)
- `ops:email_template_update` — update a Resend transactional template body or
  subject line; surface the diff for Matt's review before saving

### Out of scope
- FUB action plan / drip sequence emails — handled by `ops-fub-crm`
- Social media DM or comment replies — handled by the `engagement_bot` capability
- Email sequence copy creation — handled by content producers + Matt's approval
- Sending from any domain other than `mail.ryan-realty.com`
- Cold-email outreach to purchased lists — never; FUB segments only

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `ops:email_newsletter` | `recipient_segment`, `subject`, `body_html`, `body_text`, `rationale` | Optional: `preview_text`, `send_at` |
| `ops:email_blast` | `recipient_segment`, `subject`, `body_html`, `body_text`, `rationale` | Same schema; semantically one-off vs recurring |
| `ops:email_template_update` | `template_id`, `subject`, `body_html`, `body_text`, `rationale` | `template_id` is the Resend template ID |

### Payload schema

```typescript
interface EmailSendPayload {
  action: 'newsletter' | 'blast' | 'template_update';
  recipient_segment: string;
  // Named segment: 'past_clients' | 'sphere' | 'cold_seller_leads' |
  // 'hot_seller' | 'warm_seller' | 'nurture_only' | 'all_buyers'
  // — OR — a FUB People API filter object as a JSON string.
  subject: string;               // Email subject line
  preview_text?: string;         // Preheader text (50–90 chars ideal)
  body_html: string;             // Full HTML body
  body_text: string;             // Plain-text version (required; not auto-generated)
  send_at?: string;              // ISO timestamp; send immediately if absent
  rationale: string;             // Why this send was triggered
  template_id?: string;          // Resend template ID (template_update only)
}
```

---

## 3. Full action row schema

```typescript
interface EmailSendActionRow {
  id: string;
  action_type: string;           // 'ops:email_newsletter' | 'ops:email_blast' | etc.
  target: string;                // 'email:segment:<segment_name>'
  assigned_producer: string;     // 'marketing_brain_skills/producers/ops-email-send'
  payload: EmailSendPayload;
  data_evidence: {
    audit_source?: string;       // e.g. 'weekly-cycle' | 'listing_trigger'
    opportunity_area?: string;   // e.g. 'monthly newsletter due'
    signal_evidence?: string;    // e.g. 'last newsletter sent 2026-04-10; 33 days ago'
  };
  generation_reason: string;
  status: 'pending';
}
```

---

## 4. The recipe

### Step 1 — Read the action row

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

If row is not `status='pending'`, halt silently.

### Step 2 — Load mandatory references

- `CLAUDE.md` §0 — Data Accuracy mandate
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice validation rules
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` — Matt's voice
  patterns (warmth, specificity, forward-looking close, first-name usage)

### Step 3 — Verify Resend sender domain

Before doing any other work, confirm `mail.ryan-realty.com` is verified in Resend:

```
GET https://api.resend.com/domains
Authorization: Bearer <RESEND_API_KEY>
```

Parse the response. Find the domain object where `name = 'mail.ryan-realty.com'`.
Check `status` field:

```
if status != 'verified':
  → HALT. Set status='killed'.
  → executor_response = { "error": "domain_not_verified", "domain": "mail.ryan-realty.com",
      "current_status": "<status>", "dns_records_needed": "<from response>" }
  → Surface to Matt:
    "Cannot send — mail.ryan-realty.com is not verified in Resend
     (current status: [status]).
     DNS records needed: [records from API response].
     Action row [id] killed. Re-queue once DNS is confirmed."
  → Stop.
```

This check is mandatory on every run. Token rotation or domain re-verification
can change this state between sessions.

### Step 4 — Pull recipient count

**Named segment:** Query FUB People API with the appropriate tag/stage filter
for the segment name. Map segment names to FUB filters:

| segment | FUB filter |
|---|---|
| `past_clients` | `stage=Past Client` |
| `sphere` | `tag=sphere` |
| `cold_seller_leads` | `tag=nurture-only` or `stage=Nurture` |
| `hot_seller` | `tag=hot-seller` |
| `warm_seller` | `tag=warm-seller` |
| `nurture_only` | `tag=nurture-only` |
| `all_buyers` | `stage=Buyer Lead` or `stage=Active Buyer` |

```
GET https://api.followupboss.com/v1/people
    ?<filter_params>&limit=1&fields=id
Authorization: Basic <base64(FOLLOWUPBOSS_API_KEY:)>
```

Extract `totalCount`. If zero: halt and surface "Segment [name] returned 0
contacts in FUB. Verify the segment name or filter is correct before proceeding."

**Filter string:** Parse the filter JSON and execute the same count query.

### Step 5 — Voice validation

Run the subject line, preview text, and body against the voice validation rules
from `marketing_brain_skills/brand-voice/voice_guidelines.md`. Specifically check:

**Banned in subject lines:**
- Exclamation marks (unless the subject contains a factual number or
  a question — rare exceptions; flag, don't auto-reject)
- Banned vocabulary: stunning, nestled, boasts, charming, pristine, gorgeous,
  breathtaking, must-see, dream home, meticulously maintained, entertainer's
  dream, tucked away, hidden gem, truly, spacious, cozy, luxurious,
  updated throughout
- Meta-tone: passionate, dedicated, premier, luxury, boutique, concierge,
  white-glove
- Hedging: may, could, potentially
- Exclamation marks in body copy (body rule)
- Em-dashes as punctuation (allowed as data placeholder `—`)
- Emoji anywhere

**Required in body:**
- Every market statistic cited with its source
- Numbers rounded per CLAUDE.md ("$895,000" not "$894,750")
- Percents at one decimal, signed arrow ("↑ 2.1% YoY")
- Tabular numerals for every numeric surface
- Days as integer + "days": "38 days"

**Voice pattern check (corpus-based):**
Read 3–5 examples from `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`
and confirm the tone matches: genuine, specific, names a detail, uses first-name
(in personalized sends), forward-looking close ("please don't hesitate to reach
out"), not promotional.

If any validation fails: do NOT surface the draft. Fix the violation and re-validate.
If a violation is ambiguous, surface to Matt with the specific rule cited and
the specific phrase flagged: "Flag: [phrase] may violate [rule]. My suggested
fix: [alternative]. Confirm or override?"

### Step 6 — Render preview

Write two files:

**`out/email-drafts/<slug>/preview.html`**
The full HTML body with realistic placeholder data (or actual personalization
tokens in `{{first_name}}` format if Resend templates are in use).

**`out/email-drafts/<slug>/preview.txt`**
The plain-text version. Required — Resend sends multipart MIME; no text version
means the email may be flagged as spam.

**`out/email-drafts/<slug>/citations.json`**
One entry per market statistic in the body:
```json
[
  {
    "figure": "$694,900",
    "source": "Supabase market_stats_cache",
    "filter": "city='Bend', stat_type='median_close_price', period_end >= '2026-02-11'",
    "value": 694900,
    "fetched_at": "2026-05-13T14:00:00Z"
  }
]
```

Every market stat in the email body must have a citations entry. No trace = no ship.

### Step 7 — Surface to Matt for explicit approval

```
Email draft ready — [action_type] to [segment] ([recipient_count] contacts)

  SUBJECT
    [subject line]

  PREVIEW TEXT
    [preview_text or "(none)"]

  RECIPIENT COUNT
    [recipient_count] contacts in segment '[recipient_segment]'

  SCHEDULED SEND
    [send_at formatted as "YYYY-MM-DD HH:MM UTC" or "Immediate on approval"]

  SENDER
    mail.ryan-realty.com — Resend domain verified ✓

  PREVIEW FILES
    HTML:  out/email-drafts/<slug>/preview.html
    Text:  out/email-drafts/<slug>/preview.txt

  VOICE VALIDATION
    ✓ No banned words
    ✓ No exclamation marks in body
    ✓ All market stats cited
    [or: list any flags with suggested fixes]

  VERIFICATION TRACE
    [one line per figure: source, filter, value, fetched_at]

  citations.json: out/email-drafts/<slug>/citations.json

Reply "ship it" / "approved" / "go" to send via Resend.
Reply "no" or "kill" to cancel.
```

Set `status='ready'` in `marketing_brain_actions`. Stop. Wait for Matt.

### Step 8 — Send via Resend API (post-approval only)

After Matt's explicit approval, set `status='approved'`:

```sql
UPDATE marketing_brain_actions
SET status = 'approved', approved_by = 'matt', approved_at = now()
WHERE id = '<action_id>';
```

**For newsletter / blast:**
The canonical Resend send call. For large segments, batch into groups of 100
using Resend's batch endpoint:

```
POST https://api.resend.com/emails
Authorization: Bearer <RESEND_API_KEY>
Body: {
  "from": "Matt Ryan <matt@mail.ryan-realty.com>",
  "to": [<recipient_email>],
  "subject": <subject>,
  "html": <body_html>,
  "text": <body_text>,
  "scheduled_at": <send_at> // omit for immediate
}
```

For list sends, use `POST https://api.resend.com/emails/batch` with an array
of up to 100 email objects per request.

Collect all returned `id` values (Resend message IDs).

**For template_update:**
```
PATCH https://api.resend.com/templates/<template_id>
Body: { "subject": <subject>, "html": <body_html> }
```

### Step 9 — Update action row with delivery status

```sql
UPDATE marketing_brain_actions
SET status = 'executed',
    executor_response = '{
      "resend_message_ids": [...],
      "recipient_count": <N>,
      "send_status": "sent",
      "sent_at": "<iso>",
      "segment": "<segment>",
      "subject": "<subject>"
    }'::jsonb
WHERE id = '<action_id>';
```

### Step 10 — Confirm to Matt

```
Sent — [action_type] to [segment]

  [recipient_count] emails sent via Resend.
  Subject: [subject]
  Sent at: [iso]
  Message IDs captured in action row [action_id].
```

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Resend API | Email send + template management | `RESEND_API_KEY` |
| FUB REST API v1 | Recipient count by segment | `FOLLOWUPBOSS_API_KEY` |
| Supabase MCP | Action row updates + data verification | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `lib/fub.ts` | `pushToFub` (event log on send) | imported |

---

## 6. Output format

**Draft lands at:** `out/email-drafts/<slug>/`

```
out/email-drafts/<slug>/
├── preview.html
├── preview.txt
└── citations.json
```

Slug format: `<action_type_short>-<segment>-<YYYY-MM-DD>`
Example: `blast-hot-seller-2026-05-13`

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-explicit` | Matt explicitly says "ship it," "approved," "go," or "send" | Matt only |

**This producer uses:** `matt-explicit` — every email send requires one click of
explicit approval per send. Silence is not approval.

---

## 8. Status flow

```
pending         ← producer reads row here
  │
  ▼
in_production   ← set immediately; executed_at = now()
  │
  ▼ (domain verified, count pulled, voice validated, preview written)
ready           ← set when draft surfaced to Matt
  │
  ▼ (Matt says "ship it")
approved        ← approved_by='matt', approved_at=now()
  │
  ▼ (Resend API confirms delivery)
executed        ← message_ids captured; executor_response populated
  │
  ▼ (48–72h open/click rate check)
measured

killed          ← domain unverified, segment empty, voice validation fails
                   after 2 fix attempts, Matt says "no"
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| `mail.ryan-realty.com` unverified | Resend domain status != 'verified' | Halt immediately. Surface DNS records needed. Status='killed'. |
| `RESEND_API_KEY` missing | `process.env.RESEND_API_KEY` undefined | Set status='killed'. "RESEND_API_KEY not set — no email sent." |
| Segment returns 0 contacts | FUB totalCount = 0 | Halt. Surface: "Segment [name] returned 0 contacts. Verify segment name." |
| Voice validation fails (fixable) | Banned word, banned punctuation | Auto-fix and re-validate. Max 2 auto-fix attempts. After 2, surface specific violation to Matt with the rule cited. |
| Voice validation fails (unfixable) | Brand integrity conflict | Surface to Matt without the broken draft. Provide specific rule citation + suggested rewrite. |
| Market stat unverifiable | Supabase query returns 0 rows | Remove the stat from the email and note removal in the surface message. No estimates. |
| Resend rate limit | HTTP 429 | Back off 30s, retry. Log in executor_response. |
| Partial send failure | Some batch emails return errors | Continue remaining batches. Log failures in executor_response. Surface to Matt post-send with the failure count and affected emails. |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 — Data Accuracy mandate (every stat needs a trace)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice enforcement
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` — Matt's voice patterns

**Capabilities used:**
- `lib/fub.ts` — segment count queries via FUB People API
- Resend API (`RESEND_API_KEY`) — send + template management

**Brain components that generate ops:email_* action rows:**
- `marketing_brain_skills/weekly-cycle/` — newsletter trigger on cadence
- `automation_skills/triggers/listing_trigger/` — just-listed email to sphere
- `marketing_brain_skills/generate-briefs/` — blast triggers from signals

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` — Section D, row `ops-email-send`
