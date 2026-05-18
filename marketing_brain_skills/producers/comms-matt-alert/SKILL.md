---
name: comms-matt-alert
description: >
  COMMS producer. Routes brain-generated alerts, digests, and status updates to Matt
  (and optionally the broader team) via the correct channel.  iMessage for critical/high
  urgency, email or dashboard card for medium/low/summary. Fires immediately on
  critical and high; queues for daily review on medium, low, and summary.
action_types:
  - comms:matt_alert
  - comms:matt_summary
  - comms:team_update
  - comms:stakeholder_summary
output_type: operational
target_platforms: []
asset_destination: no asset; state mutation only (logged in marketing_decisions)
auto_inputs: ["current campaign/account state"]
required_inputs: ["account_id OR campaign_id"]
optional_inputs: ["budget_delta_pct", "pause_reason"]
estimated_runtime_min: 3
cost_usd_estimate: $0.01-$0.10 per call (mostly API quota; minimal Anthropic)
thumbnail_uri: out/proof/2026-05-17/exemplars/sample.html
example_outputs: []
---

# comms-matt-alert

**Scope:** Translates `marketing_brain_actions` rows of type `comms:*` into delivery-ready
messages and routes them to the correct channel based on urgency. This producer does NOT
draft content, run audits, or make strategic decisions. It receives a fully-formed payload
from the brain, validates the message against Ryan Realty voice rules, formats it per
channel spec, delivers it, and records the outcome.

It does NOT post to any social platform, modify any listing, or touch any campaign setting.
Those are handled by their respective content and ops producers.

**Status:** Canonical
**Locked:** 2026-05-13
**Exemplar output:** delivery confirmation in `executor_response` on the `marketing_brain_actions` row.

---

## 1. Scope

### In scope
- `comms:matt_alert`.  time-sensitive single alert (hot lead, broken campaign, anomaly requiring same-day response)
- `comms:matt_summary`.  daily or weekly digest of brain activity
- `comms:team_update`.  same routing as matt_alert/summary; team list is currently Matt only
- `comms:stakeholder_summary`.  formal investor/partner-facing update; email + dashboard card only

### Out of scope
- Writing the underlying analysis or content that prompted the alert.  that is the job of `analyze-anomaly`, `generate-briefs`, or an audit skill
- Posting content to any social, ad, or CRM platform
- Sending marketing emails to leads.  that is `ops-email-send`
- Drafting review responses.  that is `ops-reputation`

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `comms:matt_alert` | `urgency`, `channel`, `subject`, `body` | `action_required` and `expires_at` optional but recommended for critical |
| `comms:matt_summary` | `urgency='summary'`, `subject`, `body` | Digest format; channel defaults to `email + dashboard_card` |
| `comms:team_update` | `urgency`, `channel`, `subject`, `body` | Routed identically to matt_alert until team roster expands |
| `comms:stakeholder_summary` | `urgency='summary'`, `subject`, `body` | Formal tone; email only + dashboard card; no iMessage |

### Payload schema

```typescript
interface MattAlertPayload {
  urgency: 'critical' | 'high' | 'medium' | 'low' | 'summary';
  channel: 'imessage' | 'email' | 'slack' | 'dashboard_card';
  subject: string;              // Under 60 chars. Fits a phone lock-screen notification.
  body: string;                 // Full message text. Must include the data evidence.
  action_required?: string;     // Specific thing Matt should do, if any.
  related_action_ids?: string[]; // UUIDs from marketing_brain_actions this alert describes.
  expires_at?: string;          // ISO 8601. Alert is stale after this datetime.
}
```

The brain populates `payload` when it writes the action row. For manual invocations,
Matt provides urgency and subject in natural language; this producer parses from context.

---

## 3. Full action row schema

```typescript
interface CommsMattAlertActionRow {
  id: string                 // uuid from marketing_brain_actions
  action_type: string        // 'comms:matt_alert' | 'comms:matt_summary' | etc.
  target: string             // e.g. 'recipient:matt' or 'recipient:stakeholders'
  assigned_producer: string  // 'marketing_brain_skills/producers/comms-matt-alert'
  payload: MattAlertPayload
  data_evidence: {
    audit_source?: string    // which audit skill triggered this (e.g. 'audit-crm')
    trigger_metric?: string  // metric name that tripped the threshold
    trigger_value?: number   // current value
    baseline_value?: number  // normal value for context
  }
  generation_reason: string  // why the brain created this alert
  status: 'pending'
}
```

---

## 4. The recipe

**Step 1.  Read the action row**

Query `marketing_brain_actions` by `id`. Confirm `status='pending'`.
Immediately update to `in_production`:

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

If the row is not in `pending` status, stop. Another producer instance may have claimed it.

**Step 2.  Parse and validate the payload**

Extract `urgency`, `channel`, `subject`, `body`, `action_required`, `expires_at`.

Check `expires_at`: if the current time is past `expires_at`, the alert is stale.
Set `status='killed'` with `executor_response = {"reason": "alert expired before delivery"}`.
Stop.

Check `subject` length: must be under 60 characters. If over, truncate with ellipsis at
the last full word before char 60. Log the truncation in `executor_response.warnings`.

**Step 3.  Voice validation**

Before sending, run the body through the brand-voice checklist from
`marketing_brain_skills/brand-voice/voice_guidelines.md`:

Hard-fail checks (stop delivery and return `killed` if any hit):
- Any banned word (see §6.2 of voice_guidelines.md)
- Any banned phrase (§6.3)
- Em dash, semicolon, or dramatic colon in the body
- "guaranteed" outcome claim
- Fake urgency language ("Act fast", "Don't miss out") unless `urgency='critical'`
  AND the urgency is genuine (hot lead SLA, broken campaign)

Soft-flag check (log in `executor_response.warnings`, proceed):
- Sentence length significantly above corpus average
- First-person "I" in a brand-voice context (allowed in critical personal alerts)

For `urgency='critical'` alerts: the voice validation still runs but the bar is slightly
relaxed for the `action_required` field.  a direct imperative like "Call now" is allowed
in that field only, not in the body.

**Step 4.  Determine delivery channel**

Map `urgency` to delivery channel:

| urgency | primary channel | fallback |
|---|---|---|
| `critical` | iMessage (via `Read_and_Send_iMessages` MCP) | email if iMessage unavailable |
| `high` | iMessage if current time is 07:00-21:00 Pacific; else email | dashboard_card always added |
| `medium` | email + dashboard_card |.  |
| `low` | dashboard_card only |.  |
| `summary` | email + dashboard_card |.  |

For `stakeholder_summary`: always email + dashboard_card. Never iMessage for stakeholder comms.

If the `channel` field in the payload explicitly names a channel, honor it.  the brain
may override the default for a specific situation.

**Step 5.  Format the message per channel**

**iMessage format:**
```
[Subject line, under 160 chars combined with body]

[Body.  plain text only. No markdown, no bullet formatting, no links except a bare URL.
Under 320 chars total for readability on a phone screen.]

[If action_required is set, append on a new line:]
Action needed: [action_required]
```

Emoji are allowed in iMessage at one per message maximum, only if the original payload
includes one. Do not add emoji. Voice guidelines §4.4 rule 3 applies.

**Email format:**
```
Subject: [subject under 60 chars]

[body as plain markdown.  short paragraphs, one blank line between them]

[If action_required:]
What to do: [action_required]

[If related_action_ids:]
Brain action IDs: [comma-separated UUIDs, for audit trail]
```

No HTML templates. No marketing email formatting. Plain text renders in every client.

**Dashboard card format:**

Write a JSON object to the `executor_response` field that the dashboard UI reads:

```json
{
  "card_type": "alert",
  "urgency": "medium",
  "subject": "...",
  "body": "...",
  "action_required": "...",
  "related_action_ids": [],
  "created_at": "ISO",
  "expires_at": "ISO or null"
}
```

The dashboard renders this as a dismissible notification card. The card stays visible
until Matt dismisses it or `expires_at` passes.

**Step 6.  Send**

For iMessage: invoke `Read_and_Send_iMessages` MCP `send_imessage` tool.
Matt's contact is `Matt Ryan`.  resolve to the phone number stored in the system.
If the MCP is unavailable or returns an error, fall through to email immediately.
Log the fallback in `executor_response.warnings`.

For email: use Resend via the existing email infrastructure at `/api/email/send`.
Sender: `brain@ryan-realty.com` (or the configured `RESEND_FROM` address).
Recipient: Matt's email from env `MATT_EMAIL` or hardcoded from config.
If Resend returns an error, log and set `status='killed'` with the error detail.

For dashboard card: write the card JSON to `executor_response` on the action row.
The dashboard polls or reads this field. No external API call needed.

**Step 7.  Record delivery confirmation**

After successful send, update the action row:

```sql
UPDATE marketing_brain_actions
SET status = 'executed',
    executor_response = '{
      "delivery_channel": "imessage",
      "delivered_at": "ISO",
      "subject": "...",
      "body_length": 142,
      "warnings": []
    }'::jsonb
WHERE id = '<action_id>';
```

For failed delivery, set `status='killed'` with `executor_response.error`.

**Step 8.  No approval gate for critical/high**

For `urgency='critical'` and `'high'`: delivery happens in Step 6 with no pause.
The brain selected these urgency levels because Matt's SLA window is active.
Holding for review defeats the purpose.

For `urgency='medium'`, `'low'`, `'summary'`: the message lands in the dashboard card
and optionally email. Matt reviews on his own schedule. No push delivery.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| `Read_and_Send_iMessages` MCP | iMessage delivery for critical/high | MCP server: must be connected; Matt's phone from contacts |
| Resend API | email delivery | `RESEND_API_KEY`, `RESEND_FROM`, `MATT_EMAIL` |
| Supabase MCP | read + update action rows; dashboard card write | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `/api/email/send` | internal Next.js route for Resend | available in production; call via fetch from edge/server context |

iMessage MCP availability check: before dispatching a `critical` alert, check whether
the `Read_and_Send_iMessages` MCP `send_imessage` tool is reachable by invoking it with
a test dry-run parameter if supported, or by checking the MCP tool list. If unavailable,
immediately fall through to email without waiting.

---

## 6. Output format

**Delivery confirmation lands in:** `marketing_brain_actions.executor_response` (jsonb)
**For dashboard display:** `executor_response.card_type = 'alert'` + full card payload

**No file system output.** This producer does not write files to `out/`.

**Surface format when invoked manually by Matt:**

```
Alert delivered: comms-matt-alert.  [subject]

  DELIVERY
    Channel: iMessage (critical)
    Delivered at: 2026-05-13T14:22:01Z
    Subject: Hot seller lead: Jane D., NW Crossing, 90 days
    Body length: 148 chars

  VOICE VALIDATION
    Result: pass
    Warnings: none

  ACTION ROW
    ID: [uuid]
    Status: executed
```

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `none` (critical/high) | Send immediately.  Matt explicitly chose immediate delivery for SLA-sensitive triggers | N/A |
| `none` (medium/low/summary) | Dashboard card is not published content; no approval gate | N/A |

This producer never creates published content. The `none` approval type is appropriate.
If this producer is ever extended to push content to a public channel, that action type
must have its own producer with a `matt-review-draft` gate.

---

## 8. Status flow

```
pending           <- producer reads row here
  |
  v (producer starts)
in_production     <- set immediately; executed_at=now()
  |
  v (message delivered OR dashboard card written)
executed          <- set after successful delivery; executor_response populated
  |
killed            <- set on expired alert, failed delivery after max retries,
                     voice validation hard fail, or missing required env vars
```

No `ready` or `approved` states for this producer. There is no draft phase.

```sql
-- On pickup:
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>' AND status = 'pending';

-- On success:
UPDATE marketing_brain_actions
SET status = 'executed',
    executor_response = '{...delivery confirmation...}'::jsonb
WHERE id = '<id>';

-- On failure:
UPDATE marketing_brain_actions
SET status = 'killed',
    executor_response = '{"error": "...", "failed_at": "ISO"}'::jsonb
WHERE id = '<id>';
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| iMessage MCP unavailable | MCP tool not in tool list or returns connection error | Fall through to email immediately. Log in `executor_response.warnings`. Do not wait or retry iMessage. |
| Email delivery failure | Resend API returns 4xx or 5xx | Retry once after 10 seconds. If second attempt fails, write card to dashboard and set `status='killed'` with the error. Surface to Matt at next manual check. |
| Alert expired | Current time > `expires_at` | Set `status='killed'`, `executor_response.reason='alert expired before delivery'`. Do not send. |
| Voice validation hard fail | Banned word, banned phrase, fake urgency | Do not send. Set `status='killed'`, `executor_response.voice_fail` listing the specific rule citation and the offending text. The brain that generated this alert has a bug.  escalate for review. |
| `subject` missing or empty | Payload validation fails | Set `status='killed'`, `executor_response.error='payload missing required field: subject'`. |
| `MATT_EMAIL` env var missing | Cannot address the email | Surface to Matt via iMessage if available. Set `status='killed'` with the missing-var note after delivery. |

---

## 10. Related skills and references

**Required reading before executing:**
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  voice validation rules (§6 banned list, §4 attributes, §11 per-channel calibration)
- `CLAUDE.md` §0.  Data Accuracy (alerts citing market data must trace to a source)
- `CLAUDE.md` §0.5.  Draft-First rule does NOT apply to critical/high alerts (they ship immediately); it does apply if this producer is ever extended to publish content

**Canonical voice check pairs (§8 of voice_guidelines.md):**
- For market-data alerts: use §8.2 (market data do/don't pairs)
- For lead alerts: use §8.3 (social caption pairs adapted to direct alert tone)
- For email digests: use §8.4 (email subject line pairs)

**iMessage MCP:**
- Server: `Read_and_Send_iMessages`
- Tools: `send_imessage`, `search_contacts`, `get_unread_imessages`
- Load schema via ToolSearch: `select:mcp__Read_and_Send_iMessages__send_imessage`

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md`.  Section E, row `comms-matt-alert`

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md`

---

## Validator stub sections (canonical 11-section structure)

## 11. Tool gap suggestions

Tool gap suggestions: see tool-acquisition-recommendations.md for the aggregated list across all producers.

