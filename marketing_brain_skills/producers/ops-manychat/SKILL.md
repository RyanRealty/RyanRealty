---
name: ops-manychat
description: >
  Configures ManyChat keyword automation for a Ryan Realty listing's Instagram DM flow. Builds
  the keyword-triggered chat flow that captures qualifying answers (agent representation,
  timeline), name + phone, sends the property landing page link plus the showing scheduler link,
  and pushes the lead into Follow Up Boss via webhook. Default keyword set is
  SHOWING / OPENHOUSE / DETAILS / <STREET_NAME>. Documented uplift from content-matrix research:
  5 showings/month → 23 showings/month per listing after the automation is live. Supports three
  operations — `setup` (build the flow at-Active), `pause` (remove showing triggers at-Sold),
  and `update` (price change, address fix, agent reassignment). Use whenever Matt says "set up
  manychat for <address>", "configure manychat keywords for <MLS#>", "build the manychat
  automation for <listing>", or "manychat for <address>".
when_to_use: |
  Trigger when Matt says any of:
  - "set up manychat for <address>"
  - "configure manychat keywords for <MLS#>"
  - "build the manychat automation for <listing>"
  - "manychat for <address>"
  - "manychat for <MLS#>"
  - "pause manychat for <address>" (action='pause')
  - "update manychat keywords for <address>" (action='update')
  - "tear down manychat for <address>" (action='pause')
action_types:
  - ops:manychat_setup
  - ops:manychat_pause
  - ops:manychat_update
---

# ops-manychat — ManyChat IG DM Automation Producer

**Scope.** Configures a ManyChat keyword-triggered Instagram DM flow per Ryan Realty listing.
Each listing gets its own flow with four default keyword triggers (`SHOWING`, `OPENHOUSE`,
`DETAILS`, and the resolved street name in UPPERCASE). The flow captures qualifying answers,
contact info, delivers the property page + scheduler links, and pushes the lead to Follow Up
Boss via webhook. Owns flow creation, pause, and update. Does NOT own keyword strategy across
listings (that lives in `docs/MARKETING_LEAD_FLOW.md`), nor does it own the FUB-side lead
record (that is `ops-fub-crm`), nor the landing page itself (that is `site-page-create`).

**Status.** Canonical. Locked 2026-05-14.

**Producer category.** Section D — Operational Producer (per `marketing_brain_skills/producers/REGISTRY.md`).

**Exemplar output:** `out/manychat/<slug>/` plus a row mutation in `marketing_brain_actions`
with `executor_response.flow_id` set after a successful ManyChat API call.

---

## 1. Required references

| Reference | Why |
|---|---|
| `CLAUDE.md` §0 — Data Accuracy mandate | Address, MLS ID, agent name, scheduler URL all trace to verified sources. No fabricating. Outranks all. |
| `CLAUDE.md` §0.5 — Draft-First, Commit-Last | Show flow config to Matt before sending to ManyChat API. Wait for explicit approval. Outranks all. |
| `CLAUDE.md` "Voice + content" | Flow messages obey brand voice — no exclamation marks, no banned vocab, "you/your" subject, warm/direct/honest. |
| `design_system/ryan-realty/SKILL.md` | Brand register — message copy reads like Ryan Realty, not generic auto-DM. |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Banned vocab union; voice attributes; phrasing of greetings + closings. |
| `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` | Matt's writing fingerprint — flow copy mirrors this register. |
| `docs/MARKETING_LEAD_FLOW.md` | FUB webhook contract; tag conventions; conditional logic for seller-intent tagging. |
| `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` §2 | Conditional lead-form tag mapping (hot-seller / warm-seller / nurture-only). |
| `marketing_brain_skills/producers/TEMPLATE.md` | Producer skeleton — section order and status flow SQL. |
| `marketing_brain_skills/producers/REGISTRY.md` | Section D row pointer. |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned content gate — applies to flow messages just like captions. |

---

## 2. Action types handled

| action_type | required payload fields | notes |
|---|---|---|
| `ops:manychat_setup` | `mls_id`, optional `keywords` | At-Active. Builds the flow and stores `flow_id`. |
| `ops:manychat_pause` | `mls_id` | At-Sold or at-Pending. Removes showing trigger; flow stays in archive for re-activation. |
| `ops:manychat_update` | `mls_id`, fields to update (e.g. `new_price`, `new_address`, `new_keywords`, `new_list_agent`) | Price change, address fix, agent reassignment. Re-uses the existing `flow_id`. |

### Default keyword set

When `keywords` is not supplied to `setup`, the producer resolves the default list from the
listing record:

```
['SHOWING', 'OPENHOUSE', 'DETAILS', '<StreetName uppercased, spaces removed>']
```

Example for `1234 NW Riverview Drive`: `['SHOWING', 'OPENHOUSE', 'DETAILS', 'RIVERVIEW']`.

If the resolved street name collides with another active flow on the IG account, the producer
falls back to `<StreetNumber + StreetName>` (e.g. `1234RIVERVIEW`) and reports the collision
in the surface message. Never auto-overwrite an existing keyword from another listing.

---

## 3. Payload schema

```typescript
type ManychatAction = 'setup' | 'pause' | 'update';

interface ManychatPayload {
  mls_id: string;                   // required for all actions
  action?: ManychatAction;          // default 'setup'
  keywords?: string[];              // optional override — UPPERCASE, no spaces
  // Update-only fields (action === 'update'):
  new_price?: number;
  new_address?: string;
  new_keywords?: string[];
  new_list_agent?: string;          // email of resolved broker (matt-ryan, paul-stevenson, rebecca-peterson)
  rationale?: string;               // why this op was generated
}

interface ManychatActionRow {
  id: string;                       // uuid from marketing_brain_actions
  action_type:
    | 'ops:manychat_setup'
    | 'ops:manychat_pause'
    | 'ops:manychat_update';
  target: string;                   // e.g. 'mls:220189422'
  assigned_producer: 'marketing_brain_skills/producers/ops-manychat';
  payload: ManychatPayload;
  data_evidence: {
    audit_source?: string;          // e.g. 'audit-listings', 'list-kit'
    opportunity_area?: string;      // e.g. 'at-active showing acceleration'
    signal_evidence?: string;       // e.g. '5 showings/month baseline'
  };
  generation_reason: string;
  status: 'pending';
}
```

Validation: `mls_id` is required for every action. `keywords` (if supplied) must be UPPERCASE,
2–20 chars each, no spaces, no punctuation. `new_*` fields are only honored when
`action === 'update'`.

---

## 4. The recipe

### Step 1 — Read the action row

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

If row is not `status='pending'`, halt silently (another agent already owns it).

### Step 2 — Verify env vars before any work

Required: `MANYCHAT_API_KEY` (Public API, Pro account), `FUB_API_KEY` (used server-side at
the webhook target for signature validation), `FUB_INBOUND_WEBHOOK_URL` (production:
`https://api.ryan-realty.com/api/leads/manychat-inbound`).

If any is missing or blank, halt. Surface the specific var names, set `status='killed'`
with `executor_response.error='env_missing'`. Stop.

### Step 3 — Load mandatory references

- `CLAUDE.md` §0 — Data Accuracy
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `docs/MARKETING_LEAD_FLOW.md` — FUB webhook contract and tagging conventions

### Step 4 — Pull the listing record (Supabase, live)

The flow copy needs verified address, street name, list agent, and the public landing page
URL. Never inherit these from the action row payload — re-pull live.

```sql
SELECT
  "MlsId",
  "StreetNumber",
  "StreetName",
  "City",
  "StandardStatus",
  "ListPrice",
  "ListAgentFullName",
  "ListAgentEmail",
  "PhotoURL"
FROM listings
WHERE "MlsId" = '<mls_id>'
LIMIT 1;
```

If 0 rows: surface to Matt, set `status='killed'`, stop. Listing must exist and be reachable.

Resolve:

- `slug` = `<StreetNumber>-<StreetName slugified>-<City slugified>` (e.g. `1234-nw-riverview-drive-bend`).
- `street_name_upper` = `<StreetName uppercased, spaces + punctuation stripped>`.
- `list_agent_first_name` = first token of `ListAgentFullName`. If empty or null, surface a
  failure (see §9 row "Listing agent first name not resolved").
- `landing_page_url` = `https://ryan-realty.com/listings/<slug>`.
- `scheduler_url` = `https://ryan-realty.com/schedule-showing/<slug>`.

### Step 5 — Resolve keyword list

If `payload.keywords` is supplied, use it verbatim after validation (UPPERCASE, 2–20 chars,
no spaces, no punctuation). Otherwise build the default:

```
['SHOWING', 'OPENHOUSE', 'DETAILS', street_name_upper]
```

Query the ManyChat API for existing flows on this IG account and verify no keyword collision:

```
GET https://api.manychat.com/fb/page/getKeywords
Authorization: Bearer <MANYCHAT_API_KEY>
```

For each keyword in the resolved list, if it is already in use by another active flow:

- If the collided keyword is the street-name token (the 4th), fall back to
  `<StreetNumber><street_name_upper>` (e.g. `1234RIVERVIEW`) and re-check.
- If `SHOWING`, `OPENHOUSE`, or `DETAILS` collides (which should never happen with the
  one-flow-per-listing rule), halt. Surface to Matt with the colliding flow's ID and name.

### Step 6 — Build the flow config JSON

The flow is a 7-step linear graph. The structure of the JSON payload that gets sent to the
ManyChat `/fb/sending/sendFlow` and `/fb/page/createFlow` endpoints is:

```json
{
  "name": "Listing — <Street Number> <Street Name> (<MlsId>)",
  "triggers": [
    {
      "type": "keyword_match",
      "match_mode": "exact_word",
      "case_sensitive": false,
      "keywords": ["SHOWING", "OPENHOUSE", "DETAILS", "<STREET_NAME_UPPER>"]
    }
  ],
  "tags_to_apply": [
    "listing-<mls_id>",
    "source-manychat",
    "intent-showing-inquiry"
  ],
  "steps": [
    {
      "id": "step_1_greeting",
      "type": "text",
      "text": "Hi. Thanks for reaching out about <Street Name>. A few quick questions to make sure you get everything you need."
    },
    {
      "id": "step_2_agent_check",
      "type": "quick_reply",
      "text": "Are you working with a real estate agent already?",
      "options": [
        { "label": "Yes", "next": "step_3_timeline", "tag": "rep-existing-agent" },
        { "label": "No", "next": "step_3_timeline", "tag": "rep-unrepresented" },
        { "label": "I'm an agent", "next": "step_3_timeline", "tag": "rep-agent-to-agent" }
      ]
    },
    {
      "id": "step_3_timeline",
      "type": "quick_reply",
      "text": "What's your timeline?",
      "options": [
        { "label": "This month", "next": "step_4_capture", "tag": "timeline-this-month" },
        { "label": "1–3 months", "next": "step_4_capture", "tag": "timeline-1-3mo" },
        { "label": "3–6 months", "next": "step_4_capture", "tag": "timeline-3-6mo" },
        { "label": "Just looking", "next": "step_4_capture", "tag": "timeline-just-looking" }
      ]
    },
    {
      "id": "step_4_capture",
      "type": "user_input",
      "fields": [
        { "key": "first_name", "prompt": "What's your first name?", "validation": "text" },
        { "key": "phone",      "prompt": "What's the best phone number to reach you?", "validation": "phone" }
      ]
    },
    {
      "id": "step_5_links",
      "type": "text",
      "text": "Here you go.\n\nProperty page: <landing_page_url>\nBook a showing: <scheduler_url>\n\nIf the time you want isn't on the scheduler, just reply here and <list_agent_first_name> will work it out with you."
    },
    {
      "id": "step_6_webhook",
      "type": "external_request",
      "method": "POST",
      "url": "<FUB_INBOUND_WEBHOOK_URL>",
      "headers": {
        "Content-Type": "application/json",
        "X-Source": "manychat"
      },
      "body": {
        "name": "{{first_name}}",
        "phone": "{{phone}}",
        "mls_id": "<mls_id>",
        "address": "<StreetNumber> <StreetName>, <City>",
        "list_agent_email": "<ListAgentEmail>",
        "intent": "showing_inquiry",
        "qualifying_answers": {
          "represented": "{{tag.rep-*}}",
          "timeline":    "{{tag.timeline-*}}"
        },
        "manychat_flow_id": "{{flow.id}}",
        "manychat_subscriber_id": "{{user.id}}"
      },
      "on_failure": "retry_3x_then_log"
    },
    {
      "id": "step_7_closing",
      "type": "text",
      "text": "Thanks. <list_agent_first_name> will follow up shortly.\n\n— Ryan Realty"
    }
  ]
}
```

All placeholder tokens (`<Street Name>`, `<list_agent_first_name>`, `<landing_page_url>`,
`<scheduler_url>`, etc.) are resolved at build time. The JSON sent to ManyChat must contain
no unresolved `<>` placeholders. Run a grep on the serialized JSON for `<` before sending —
zero hits, or halt.

### Step 7 — Voice gate the flow copy

Grep every `text` and `prompt` and `label` and `options[].label` against the banned vocab
union in `marketing_brain_skills/brand-voice/voice_guidelines.md` §6. Also grep for:

- Exclamation marks (banned in flow copy except in user-facing brand assets where also banned).
- Em-dashes (`—`) in body copy. The default flow uses an em-dash in step 7 (`— Ryan Realty`)
  which is allowed ONLY as a signature dash. Body sentences may not contain `—`.
- Semicolons.
- AI filler: "delve," "leverage," "tapestry," "robust," "seamless," etc.
- Banned phrases: "your real estate journey," "we are passionate," "premier brokerage," etc.

Any hit → halt. Re-write the offending copy. Re-validate. Do not relax the gate.

### Step 8 — Write the draft to disk

```
out/manychat/<slug>/
├── flow-config.json          ← the exact JSON that will be sent to ManyChat
├── keywords.txt              ← the resolved keyword list, one per line
├── voice-gate-report.json    ← results of the §7 grep
└── citations.json            ← MLS data trace per CLAUDE.md §0
```

`citations.json` shape — one entry per resolved field used in flow copy (address, list agent,
landing URL, scheduler URL):

```json
{
  "figures": [
    {
      "figure": "1234 NW Riverview Drive",
      "source": "Supabase listings",
      "filter": "MlsId='220189422'",
      "column": "StreetNumber + StreetName",
      "value": "1234 NW Riverview Drive",
      "fetched_at": "2026-05-14T14:32:00Z"
    }
  ]
}
```

### Step 9 — Transition to `ready` and surface to Matt

Transition the row per §8 SQL (`status='ready'`, populate `executor_response` with
`draft_path`, `flow_name`, `keywords`, `flow_id: null`, `voice_gate: 'pass'`). Then surface
the draft per §6. Stop and wait.

### Step 10 — Execute (post-approval only)

After Matt's explicit approval words (`matt-explicit` gate — see §7), transition to
`status='approved'` per §8 SQL, then call the ManyChat API.

**`setup`** — `POST /fb/page/createFlow` with `flow-config.json` as body. Capture `flow_id`
from the 200 response; write to `out/manychat/<slug>/flow-id.txt`. Then `POST
/fb/page/publishFlow` with `{ "flow_id": "<flow_id>" }`. On 4xx/5xx, do not retry blindly —
surface the response body to Matt and halt (see §9).

**`pause`** — Look up the existing `flow_id` from `marketing_brain_actions` history (most
recent `ops:manychat_setup` row for the same `mls_id`, status `executed`). If absent, query
ManyChat for flows tagged `listing-<mls_id>` and pick the one in `status='active'`. If still
ambiguous, surface to Matt. Then `POST /fb/page/updateFlow` with a body that keeps only the
`DETAILS` keyword trigger and rewrites Step 1 greeting to: "Hi. Thanks for the note. This
home went under contract. If you'd like to see similar homes, reply here." Step 5 swaps the
scheduler link for `https://ryan-realty.com/listings/<slug>?status=sold` (similar-home page).

**`update`** — Re-render the flow config JSON with the new fields (price, address, keywords,
agent), then `POST /fb/page/updateFlow` with the existing `flow_id` and the new config body.
Write a `change-log.json` to `out/manychat/<slug>/` showing field-level diffs.

All three operations carry the `Authorization: Bearer <MANYCHAT_API_KEY>` header and
`Content-Type: application/json`.

### Step 11 — Capture results, transition to `executed`

Update the action row per the `executed` transition in §8 — populate `executor_response`
with the resolved `flow_id`, `published: true`, `keywords_deployed`, the raw ManyChat
response, and `executed_at`.

### Step 12 — Confirm to Matt

```
ManyChat executed — <setup | pause | update> · <address>

  Flow ID:  <flow_id>
  Keywords: <comma-separated>
  Webhook:  <FUB_INBOUND_WEBHOOK_URL>
  Status:   active (published)

Action row <action_id> → executed.
```

48 hours after `setup`, `audit-listings` reads the flow stats and writes baseline showing
counts. Performance loop compares to baseline at the 7-day and 30-day marks and writes the
delta to `content_performance`.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| ManyChat Public API | Flow create / update / publish; keyword check | `MANYCHAT_API_KEY` |
| Supabase MCP | Listing lookup + action row transitions | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| FUB inbound webhook | Lead delivery target (not called directly — ManyChat calls it server-side) | `FUB_INBOUND_WEBHOOK_URL`, `FUB_API_KEY` |
| `lib/manychat.ts` (build if absent) | API wrapper for ManyChat REST calls | repo path |
| Voice gate grep | banned vocab + punctuation check | `marketing_brain_skills/brand-voice/voice_guidelines.md` §6 |

---

## 6. Output format

**Draft directory:**

```
out/manychat/<slug>/
├── flow-config.json          ← exact JSON sent to ManyChat
├── flow-id.txt               ← populated after successful create (post-approval)
├── keywords.txt              ← deployed keyword list, one per line
├── voice-gate-report.json    ← banned-vocab grep results
├── change-log.json           ← only for 'update' action
└── citations.json            ← MLS data trace
```

**Surface format (present to Matt exactly like this for `setup`):**

```
ManyChat flow draft — <slug>

  ADDRESS
    <StreetNumber> <StreetName>, <City> (MLS# <mls_id>)
    List agent: <ListAgentFullName>
    Status: <StandardStatus>

  KEYWORDS (case-insensitive, exact word match)
    SHOWING
    OPENHOUSE
    DETAILS
    <STREET_NAME_UPPER>

  FLOW STEPS
    1. Greeting — "Hi. Thanks for reaching out about <Street>..."
    2. Qualifying Q1 — agent representation (Yes / No / I'm an agent)
    3. Qualifying Q2 — timeline (4 options)
    4. Capture — first name + phone
    5. Send links — property page + showing scheduler
    6. Webhook → FUB inbound (<FUB_INBOUND_WEBHOOK_URL>)
    7. Closing — "Thanks. <FirstName> will follow up shortly."

  VOICE GATE: pass (no banned vocab, no exclamation marks, no semicolons)

  FILES
    out/manychat/<slug>/{flow-config.json, keywords.txt, citations.json}

  VERIFICATION TRACE
    - Address — Supabase listings, MlsId='<mls_id>', fetched <iso>
    - List agent — Supabase listings, MlsId='<mls_id>', fetched <iso>
    - Landing page URL — derived from slug; verified live (HEAD 200)
    - Scheduler URL — derived from slug; verified live (HEAD 200)

Reply "set up manychat for <address>" / "approved" / "go" to send to ManyChat and publish.
```

**For `pause`:** same header + ADDRESS block, then list the existing `flow_id`, the trigger
diff (`SHOWING`, `OPENHOUSE`, street-name token to be removed; `DETAILS` retained for
similar-home redirect), the rewritten greeting + Step 5 link swap. Close with: `Reply "pause
manychat for <address>" / "approved" to apply.`

**For `update`:** same header + ADDRESS block, then the existing `flow_id`, a field-by-field
diff (`<field>: "<old>" → "<new>"`), and a `change-log.json` path. Close with: `Reply
"update manychat for <address>" / "approved" to apply.`

Then stop. Do not call the ManyChat API. Wait.

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-explicit` | Matt explicitly names the action and listing verbatim — never inferred from a passing voice gate or a successful draft build | Matt only |

**Approval words:** `"set up manychat for <address>"`, `"approved"`, `"go"`, `"ship it"`,
`"proceed"`. Plain `"yes"` is acceptable only if the immediately preceding turn from this
producer was the surface message for this exact action row.

**Silence is never approval.** A passing voice gate is never approval. A clean `citations.json`
is never approval. Matt has to say it.

---

## 8. Status flow

```
     pending
        │ producer picks up row
        ▼
  in_production   ← executed_at = now()
        │ listing resolved, voice gate passed, draft written
        ▼
      ready        ← executor_response populated with draft_path + voice_gate=pass
        │ Matt says "set up manychat for <address>" / "approved"
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ ManyChat createFlow + publishFlow succeed
        ▼
    executed       ← executor_response.flow_id populated, published=true
        │ 7-day + 30-day post-publish
        ▼
    measured       ← performance_loop writes showing-count delta to content_performance

    killed         ← terminal failure; set if env missing, listing not found, voice gate fails
                     after 2 auto-iterations, keyword collision unresolvable, ManyChat 4xx/5xx,
                     or Matt explicitly cancels
```

SQL transitions:

```sql
-- On pickup
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

-- On draft ready
UPDATE marketing_brain_actions
SET status='ready',
    executor_response=jsonb_build_object(
      'draft_path','out/manychat/<slug>/',
      'flow_name','<name>',
      'keywords',<jsonb array>,
      'flow_id',null,
      'voice_gate','pass'
    )
WHERE id='<id>';

-- On Matt approval
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';

-- On ManyChat API success
UPDATE marketing_brain_actions
SET status='executed',
    executor_response=executor_response || jsonb_build_object(
      'flow_id','<flow_id>',
      'published',true,
      'manychat_response',<jsonb>,
      'executed_at',now()::text
    )
WHERE id='<id>';
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Missing env var | `MANYCHAT_API_KEY`, `FUB_API_KEY`, or `FUB_INBOUND_WEBHOOK_URL` not set or blank | Halt at Step 2. Surface the specific var name. Set `status='killed'`, `executor_response.error='env_missing'`. Do not hard-code. |
| Listing not found or agent unresolved | Supabase returns 0 rows for `MlsId`, or `ListAgentFullName` is null/empty | Halt at Step 4. Surface: "MlsId=<id> not found" or "ListAgentFullName empty — cannot personalize." Set `status='killed'`. Do not infer from another field. |
| Keyword collision | Street-name token collides → auto-fallback to `<StreetNumber+StreetName>` and re-check. `SHOWING`/`OPENHOUSE`/`DETAILS` collision → halt (structural leak, should never happen). | Note fallback in surface message; halt + surface on reserved-token collision or double-fallback collision. |
| Voice gate fails | Banned vocab, exclamation, em-dash in body, semicolon, or banned phrase in any flow text | Halt at Step 7. Rewrite copy, re-validate. Max 2 auto-iterations before surfacing the specific rule + failing line. |
| ManyChat API 4xx | 400 (malformed), 401 (bad token), 403 (no Pro plan), 422 (validation — usually an unresolved placeholder) | Halt. Surface the response body. Do not retry — these are not transient. |
| ManyChat API 5xx | 500/502/503/504 on `createFlow` or `publishFlow` | Exponential backoff (1s, 4s, 16s). After 3 consecutive 5xx, halt and surface. |
| FUB webhook unreachable | `FUB_INBOUND_WEBHOOK_URL` HEAD returns non-200, or ManyChat reports the webhook step failed at publish | Halt. Surface: "Verify the endpoint at `app/api/leads/manychat-inbound/route.ts` is deployed." Set `status='killed'`. |
| Unresolved placeholder | Serialized flow JSON contains a literal `<` after build | Halt. Surface the specific token — almost always a null Supabase column or missing payload field. |
| Pause/update: flow not found | `pause` has no prior executed setup row + no ManyChat-tagged flow for `listing-<mls_id>`; or `update` targets a `flow_id` that returns 404 | Halt. Surface: "No active flow for MlsId=<id>. Re-run as `setup` to rebuild." Set `status='killed'`. |
| ManyChat endpoint shape drift | Public API route names listed here (`createFlow`, `updateFlow`, `publishFlow`, `getKeywords`) may differ in the live API version | On first run, verify endpoints against current ManyChat docs. Surface any 404 immediately — do not retry against a different route silently. |

---

## 10. Related skills and references

**Required reading before executing:**

- `CLAUDE.md` §0 — Data Accuracy mandate (outranks everything)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last (outranks everything)
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — banned vocab union, voice
  attributes
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` — Matt's writing fingerprint
- `docs/MARKETING_LEAD_FLOW.md` — FUB webhook contract, conditional tagging rules
- `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` §2 — seller-intent tag taxonomy

**Capabilities used inside this producer:**

- `lib/manychat.ts` — REST wrapper (build if absent); follows the pattern of
  `lib/followupboss.ts`
- Supabase MCP — listings table read + `marketing_brain_actions` write
- Voice gate grep — checks every flow message against
  `marketing_brain_skills/brand-voice/voice_guidelines.md` §6

**Sister producers commonly chained with this:**

- `marketing_brain_skills/producers/ops-fub-crm` — the inbound webhook lands a row in FUB
  that triggers tag application + sequence enrollment; this producer hands the lead off,
  but the FUB-side handling is owned there
- `marketing_brain_skills/producers/site-page-create` — owns the landing page that the flow
  links to; verify the page exists before publishing the flow
- `social_media_skills/list-kit/SKILL.md` — the at-Active orchestrator that typically
  generates the `ops:manychat_setup` action row alongside video, flyers, carousel, and
  single-post deliverables

**Playbooks and pipeline docs:**

- `automation_skills/content_engine/SKILL.md` — content routing bus (this producer is
  ops, not content, so it does NOT route through here)
- `social_media_skills/platform-best-practices/SKILL.md` — IG DM rules and engagement-bait
  prohibitions

**Banned content gate:**

- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — applies to flow message copy

**Registry entry:**

- `marketing_brain_skills/producers/REGISTRY.md` — Section D, row `ops-manychat`

---

## 11. What not to do

1. **Never publish without Matt's explicit approval naming the listing.** Voice gate pass +
   draft surface ≠ approval. The `matt-explicit` gate is per-action-row.
2. **Never inherit listing data from the action row payload.** Re-pull Supabase per CLAUDE.md §0.
3. **Never use exclamation marks, em-dashes in body, or semicolons in flow copy.** The only
   allowed em-dash is the signature dash in step 7 (`— Ryan Realty`).
4. **Never write "I" as the subject.** Voice is "you/your" + "we/our team." Rewrite "I'll get
   back to you" as "<FirstName> will follow up shortly."
5. **Never strip the qualifying questions to shorten the flow.** Agent-check + timeline drive
   the FUB tag logic that underpins the 5 → 23 showings/month uplift.
6. **Never auto-retry a ManyChat 4xx response.** 400/401/403/422 are signal — surface and
   wait. Only 5xx is retriable.
7. **Never inject hashtags into flow messages.** DMs are a hashtag-stripped surface per the
   CLAUDE.md "Voice + content" rule.
8. **Never hard-code the FUB webhook URL or overwrite another listing's keyword.** Read
   `FUB_INBOUND_WEBHOOK_URL` from env; a `SHOWING`/`OPENHOUSE`/`DETAILS` collision is a
   structural leak — halt, do not resolve silently.
