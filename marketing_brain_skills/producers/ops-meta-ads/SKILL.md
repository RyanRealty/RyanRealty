---
name: ops-meta-ads
description: >
  Executes Meta Ads account changes (budget adjust, pause, resume, audience update,
  creative swap) on behalf of the marketing brain. Every change requires Matt's
  explicit approval before any Graph API call fires. Operates within the ±25% budget
  band defined in docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md unless Matt provides an explicit
  override. Updates the action row at every status transition.
action_types:
  - ops:meta_budget
  - ops:meta_pause
  - ops:meta_resume
  - ops:meta_audience
  - ops:meta_creative_swap
---

# ops-meta-ads — Meta Ads Operational Producer

**Scope:** Executes real-world changes to the Ryan Realty Meta Ads account via the
Marketing Graph API. Handles campaign budget adjustment, pause/resume, audience
modification, and creative swap. Surfaces every proposed change to Matt with current
state, proposed state, and a data-backed rationale before making any API call.
Never assumes approval from a passing audit score or prior conversation.

Does NOT create new campaigns (that is `ops:meta_ads_new_campaign` — a separate,
unbuilt producer). Does NOT post organic content to Facebook or Instagram (that is
the publisher capability). Does NOT pull analytics or generate reports (that is
audit-ads + diagnose-performance).

**Status:** Canonical
**Locked:** 2026-05-13
**Exemplar output:** Action row status transitions + `executor_response` jsonb in
`marketing_brain_actions`.

---

## 1. Scope

### In scope
- `ops:meta_budget` — adjust daily budget on an ad set or campaign within ±25% band
- `ops:meta_pause` — pause a campaign or ad set
- `ops:meta_resume` — resume a paused campaign or ad set
- `ops:meta_audience` — modify targeting (location radius, age, interests, custom audiences)
- `ops:meta_creative_swap` — swap the creative on an active ad set to a new image or video

### Out of scope
- Creating net-new campaigns — handled by `ops:meta_ads_new_campaign` (pending build)
- Reading analytics or surfacing insights — handled by `audit-ads` + `diagnose-performance`
- Publishing organic FB/IG posts — handled by the `publisher` capability
- Any budget change exceeding ±25% of current daily budget without an explicit
  Matt override in the action row payload

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `ops:meta_budget` | `campaign_id`, `action`, `proposed_state.daily_budget` | Enforce ±25% band; halt if outside band without override |
| `ops:meta_pause` | `campaign_id`, `action` | Auto-allowed when CPL > 2× baseline, but still requires Matt confirmation |
| `ops:meta_resume` | `campaign_id`, `action` | Resume sets status to ACTIVE |
| `ops:meta_audience` | `campaign_id`, `action`, `proposed_state.targeting` | Full targeting spec in proposed_state |
| `ops:meta_creative_swap` | `campaign_id`, `action`, `proposed_state.creative_id` or `proposed_state.asset_url` | New creative must be pre-uploaded or referenced by existing creative_id |

### Payload schema

```typescript
interface MetaAdsOpsPayload {
  action: 'budget_adjust' | 'pause' | 'resume' | 'audience_update' | 'creative_swap';
  campaign_id: string;           // Meta campaign ID (numeric string)
  adset_id?: string;             // Required for adset-level ops (budget, audience, creative)
  campaign_name: string;         // Human-readable; never used as API param
  current_state: Record<string, unknown>;   // Captured before change; populated by producer
  proposed_state: Record<string, unknown>;  // The change to make
  rationale: string;             // Data-backed reason (CPL, creative fatigue score, etc.)
  matt_override?: boolean;       // If true, ±25% band check is skipped (must be explicit)
}
```

---

## 3. Full action row schema

```typescript
interface MetaAdsActionRow {
  id: string;                    // uuid from marketing_brain_actions
  action_type: string;           // 'ops:meta_budget' | 'ops:meta_pause' | etc.
  target: string;                // 'meta_campaign:<campaign_id>'
  assigned_producer: string;     // 'marketing_brain_skills/producers/ops-meta-ads'
  payload: MetaAdsOpsPayload;
  data_evidence: {
    audit_source?: string;       // e.g. 'audit-ads'
    opportunity_area?: string;   // e.g. 'CPL above 2x baseline'
    signal_evidence?: string;    // e.g. 'CPL=$82.40 vs baseline $38.10, 7d window'
  };
  generation_reason: string;
  status: 'pending';             // always pending when producer first reads
}
```

---

## 4. The recipe

### Step 1 — Read the action row

Query `marketing_brain_actions` by `id`. Confirm `status='pending'`.
Immediately transition to `in_production`:

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<action_id>' AND status = 'pending';
```

If row is not `status='pending'` (another agent picked it up), halt silently.

### Step 2 — Load mandatory references

Before any API call:
- `CLAUDE.md` §0 — Data Accuracy mandate (outranks everything)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last (explicit approval required)
- `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` §1 — 3-campaign architecture + budget bands
- `marketing_brain_skills/audit-ads/SKILL.md` — to understand how CPL baselines are set

### Step 3 — Verify campaign exists in the configured ad account

Env vars required:
- `META_PAGE_ACCESS_TOKEN` — long-lived page token
- `META_AD_ACCOUNT_ID` — format `act_<numeric>` (e.g. `act_123456789`)

```
GET https://graph.facebook.com/v25.0/<campaign_id>
    ?fields=id,name,status,daily_budget,effective_status
    &access_token=<META_PAGE_ACCESS_TOKEN>
```

If the API returns a 404 or the `account_id` field does not match `META_AD_ACCOUNT_ID`:
- Set `status='killed'` with `executor_response = {"error": "campaign not found in configured ad account", "campaign_id": "..."}`
- Surface to Matt: "Campaign `<campaign_id>` not found in ad account `<META_AD_ACCOUNT_ID>`. Action row killed."
- Stop.

### Step 4 — Capture current state via Graph API

Pull the current campaign/ad set state into `payload.current_state`. For budget ops:

```
GET https://graph.facebook.com/v25.0/<adset_id>
    ?fields=id,name,status,daily_budget,targeting,effective_status
    &access_token=<META_PAGE_ACCESS_TOKEN>
```

For creative swap:
```
GET https://graph.facebook.com/v25.0/<adset_id>
    ?fields=id,name,status,creative{id,name,body}
    &access_token=<META_PAGE_ACCESS_TOKEN>
```

Store the full API response as `payload.current_state`. This is the rollback baseline.

### Step 5 — Compute proposed change and enforce guardrails

#### Budget adjust guardrail
```
current_budget = payload.current_state.daily_budget (in cents from Meta API)
proposed_budget = payload.proposed_state.daily_budget (in cents)
delta_pct = (proposed_budget - current_budget) / current_budget

if abs(delta_pct) > 0.25 and NOT payload.matt_override:
  → HALT. Surface to Matt:
    "Proposed budget change of {delta_pct*100:.1f}% exceeds the ±25% band.
     Current: ${current_budget/100:.2f}/day → Proposed: ${proposed_budget/100:.2f}/day.
     Reply 'override' to proceed, or give me a revised budget within the band."
  → Set status='ready' with executor_response noting the band conflict.
  → Stop. Do not call Graph API.
```

#### CPL auto-pause condition
If `action='pause'` and `data_evidence.opportunity_area` contains "CPL" evidence,
verify the CPL figure from `marketing_channel_daily` before surfacing. Never trust
the action row's number alone:

```sql
SELECT
  SUM(spend) / NULLIF(SUM(leads), 0) AS current_cpl,
  AVG(cpl_30d_baseline) AS baseline_cpl
FROM marketing_channel_daily
WHERE channel = 'meta_ads'
  AND campaign_id = '<campaign_id>'
  AND date >= now() - INTERVAL '7 days';
```

If `current_cpl > 2 * baseline_cpl`: confirm auto-pause is warranted. Include the
verification in the surface message.
If data is insufficient (< 5 rows): note in the surface message that the pause is
brain-triggered but CPL verification was inconclusive; Matt decides.

### Step 6 — Surface to Matt for explicit approval

Format the approval request:

```
Proposed Meta Ads change — [action_type] on [campaign_name]

  CURRENT STATE
    Campaign:    [campaign_name] (ID: [campaign_id])
    Status:      [current_state.status]
    Daily budget:[current_state.daily_budget / 100 formatted as $XX.00/day]
    [other relevant current fields]

  PROPOSED CHANGE
    [Human-readable description of the change]
    [For budget: Current $X/day → Proposed $Y/day (+/-Z%)]
    [For pause: Setting status PAUSED]
    [For audience: Current targeting → Proposed targeting diff]
    [For creative: Swapping creative ID A → ID B]

  RATIONALE
    [payload.rationale]
    [data_evidence.signal_evidence if present]

  ACTION ROW
    ID: [action_id]
    Source: [data_evidence.audit_source]

Reply "yes" / "approved" / "go" to execute. Reply "no" or "kill" to cancel.
Reply "override" to bypass the ±25% band (budget changes only).
```

Then stop. Set `status='ready'` in `marketing_brain_actions`. Do NOT call the
Graph API. Wait for Matt's explicit reply.

### Step 7 — Execute via Graph API (post-approval only)

Only after Matt's explicit "yes" / "approved" / "go" / "override":

Set `status='approved'`:
```sql
UPDATE marketing_brain_actions
SET status = 'approved', approved_by = 'matt', approved_at = now()
WHERE id = '<action_id>';
```

Execute the appropriate API call:

**Budget adjust:**
```
POST https://graph.facebook.com/v25.0/<adset_id>
Body: { "daily_budget": <proposed_budget_cents>, "access_token": "..." }
```

**Pause:**
```
POST https://graph.facebook.com/v25.0/<campaign_id>
Body: { "status": "PAUSED", "access_token": "..." }
```

**Resume:**
```
POST https://graph.facebook.com/v25.0/<campaign_id>
Body: { "status": "ACTIVE", "access_token": "..." }
```

**Audience update:**
```
POST https://graph.facebook.com/v25.0/<adset_id>
Body: { "targeting": <proposed_state.targeting>, "access_token": "..." }
```

**Creative swap:**
```
POST https://graph.facebook.com/v25.0/<adset_id>
Body: { "creative": { "creative_id": "<new_creative_id>" }, "access_token": "..." }
```

### Step 8 — Capture API response, update action row

Capture the full API response. On success:

```sql
UPDATE marketing_brain_actions
SET status = 'executed',
    executor_response = '{
      "api_response": <full_response>,
      "campaign_id": "<id>",
      "adset_id": "<id>",
      "action_executed": "<action>",
      "executed_at": "<iso>",
      "pre_change_state": <current_state>,
      "post_change_requested": <proposed_state>
    }'::jsonb
WHERE id = '<action_id>';
```

On API error: set `status='killed'`, include full error in `executor_response`,
surface to Matt with the raw error message and suggested remediation.

### Step 9 — Confirm to Matt

After successful execution, confirm:

```
Executed — [campaign_name]

  [Human-readable summary of what changed]
  API confirmed: [campaign_id / adset_id]
  Executed at: [iso timestamp]

Action row [action_id] → status: executed.
```

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Meta Marketing Graph API v25.0 | Campaign/ad set read + write | `META_PAGE_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` |
| Supabase MCP | Action row updates + CPL verification | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `lib/meta-graph.ts` | Shared Graph API helpers (`MetaGraphError`, `getJson`, `postJson`) | imported |

---

## 6. Output format

**No file deliverable** — this producer's output is the API state change + the
updated `marketing_brain_actions` row.

**executor_response schema:**
```json
{
  "api_response": { "id": "...", "success": true },
  "campaign_id": "1234567890",
  "adset_id": "0987654321",
  "action_executed": "budget_adjust",
  "executed_at": "2026-05-13T14:00:00Z",
  "pre_change_state": { "daily_budget": "3000", "status": "ACTIVE" },
  "post_change_requested": { "daily_budget": "3600" }
}
```

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-explicit` | Matt explicitly says "yes," "approved," "go," or "override" in the conversation | Matt only |

**This producer uses:** `matt-explicit`

Silence is not approval. A successful audit score is not approval. A brain-generated
action row is not approval. The explicit word from Matt is the only gate.

---

## 8. Status flow

```
pending         ← producer reads row here
  │
  ▼ (producer picks up row)
in_production   ← set immediately; executed_at = now()
  │
  ▼ (current state captured, guardrails computed, surface message ready)
ready           ← set when approval request is surfaced to Matt
  │
  ▼ (Matt says "yes" / "approved" / "go")
approved        ← set after Matt's explicit word; approved_by='matt', approved_at=now()
  │
  ▼ (Graph API call completes successfully)
executed        ← set after API response captured; executor_response populated
  │
  ▼ (48h post-execution performance check by audit-ads)
measured        ← set by performance_loop after CPL / delivery delta captured

killed          ← terminal; campaign not found, band violation without override,
                   Matt says "no" / "kill", or API error after 1 retry
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Token expired (`#190` OAuthException) | Graph API returns `{"error":{"code":190,...}}` | Set `status='killed'`. Surface: "Meta access token expired. Re-auth required at `/api/meta/authorize/`. Action row killed." |
| Campaign not found | Graph API 404, or `account_id` mismatch | Set `status='killed'`. Report exact campaign_id and ad account. |
| Budget band violation | delta_pct > 25% without `matt_override` | Set `status='ready'`. Surface the conflict with override instruction. Do NOT execute. |
| Insufficient CPL data for auto-pause | < 5 rows in 7-day window | Note in surface message; let Matt decide with the caveat. Do not auto-reject. |
| Graph API 5xx | Server error on POST | Retry once after 10s. If second attempt fails, set `status='killed'` with error. |
| `META_AD_ACCOUNT_ID` or `META_PAGE_ACCESS_TOKEN` missing | `process.env` undefined | Set `status='killed'`. Surface: "Missing env var: [var name]. No API call made." |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 — Data Accuracy mandate
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last (explicit approval gate)
- `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` — 3-campaign architecture, budget bands, CPL baselines
- `docs/MARKETING_LEAD_FLOW.md` — lead flow context; understand what the campaign is driving

**Capabilities used:**
- `lib/meta-graph.ts` — `MetaGraphError`, `getJson`, `postJson` helpers
- `marketing_brain_skills/audit-ads/SKILL.md` — CPL baseline methodology

**Brain components that generate ops:meta_* action rows:**
- `marketing_brain_skills/audit-ads/` — surfaces CPL anomalies, creative fatigue, budget drift
- `marketing_brain_skills/diagnose-performance/` — WoW/MoM deltas that trigger budget changes

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` — Section D, row `ops-meta-ads`
