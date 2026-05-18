---
name: ops-google-ads
description: >
  Executes Google Ads account changes (budget adjust, pause, resume, keyword swap,
  negative keyword add) on behalf of the marketing brain. Every change requires
  Matt's explicit approval before any Google Ads API call fires. Enforces a
  +-25% daily budget band. Sister producer to ops-meta-ads.
action_types:
  - ops:google_budget
  - ops:google_pause
  - ops:google_resume
  - ops:google_keyword_swap
  - ops:google_negative_add
output_type: operational
output_type: operational
target_platforms: []
asset_destination: marketing_brain_actions row + Google Ads API
auto_inputs: ['google_ads_performance', 'keyword_data']
required_inputs: "['campaign_id', 'action (pause|resume|budget_adjust|keyword_update)']"
optional_inputs: ['new_budget_usd', 'keyword_list', 'bid_strategy']
estimated_runtime_min: 3
cost_usd_estimate: $0 (ad spend separate)
thumbnail_uri: out/proof/2026-05-17/exemplars/ops-google-ads/log.txt
example_outputs: []
    label: Phase 7.5 exemplar placeholder
    surface: google_ads

---

# ops-google-ads: Google Ads Operational Producer

**Scope:** Executes real-world changes to the Ryan Realty Google Ads account via the
Google Ads API. Handles campaign budget adjustment, pause/resume, keyword swap within
an ad group, and negative keyword addition. Surfaces every proposed change to Matt
with current state, proposed state, and a data-backed rationale before making any API
call. Never assumes approval from a passing audit score or prior conversation turn.

Does NOT create net-new campaigns or ad groups (escalate to Matt). Does NOT pull
analytics or generate reports (that is `audit-ads` + `diagnose-performance`). Does NOT
upload ad copy (that is `google-ads-copy` producer). Does NOT modify bidding strategies
unless explicitly in the payload.

**Status:** Canonical
**Locked:** 2026-05-17
**Exemplar output:** Action row status transitions + `executor_response` jsonb in
`marketing_brain_actions`.

---

## 1. Scope

### In scope

- `ops:google_budget`: adjust daily budget on a campaign within the +-25% band
- `ops:google_pause`: pause a campaign or ad group
- `ops:google_resume`: resume a paused campaign or ad group
- `ops:google_keyword_swap`: remove one keyword from an ad group and add a replacement
- `ops:google_negative_add`: add a negative keyword at campaign or account level

### Out of scope

- Creating net-new campaigns, ad groups, or ads (escalate to Matt)
- Uploading ad copy or creative (that is `google-ads-copy` producer)
- Any budget change exceeding +-25% of current daily budget without explicit Matt override
- Bid strategy changes (target CPA, target ROAS) without explicit Matt direction
- Keyword bids beyond what the Google Ads API permits at the keyword level

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `ops:google_budget` | `campaign_resource_name`, `action`, `proposed_daily_budget_micros` | Enforce +-25% band; halt if outside without override |
| `ops:google_pause` | `campaign_resource_name`, `action` | Sets campaign status to PAUSED |
| `ops:google_resume` | `campaign_resource_name`, `action` | Sets campaign status to ENABLED |
| `ops:google_keyword_swap` | `ad_group_resource_name`, `remove_keyword_text`, `add_keyword_text`, `match_type` | Mutate within same ad group |
| `ops:google_negative_add` | `target_level`, `keyword_text`, `match_type`, `campaign_resource_name?` | `target_level`: 'campaign' or 'account' |

### Payload schema

```typescript
interface GoogleAdsOpsPayload {
  action: 'budget_adjust' | 'pause' | 'resume' | 'keyword_swap' | 'negative_add';
  campaign_resource_name: string;      // e.g. 'customers/<cid>/campaigns/<campaign_id>'
  campaign_name: string;               // human-readable; never used as API param
  ad_group_resource_name?: string;     // required for keyword_swap
  proposed_daily_budget_micros?: number; // for budget_adjust; in micros (1 USD = 1_000_000)
  current_daily_budget_micros?: number;  // populated by producer from API read
  remove_keyword_text?: string;        // for keyword_swap
  add_keyword_text?: string;           // for keyword_swap
  match_type?: 'EXACT' | 'PHRASE' | 'BROAD'; // for keyword_swap, negative_add
  target_level?: 'campaign' | 'account'; // for negative_add
  keyword_text?: string;               // for negative_add
  rationale: string;                   // data-backed reason from the brain
  matt_override?: boolean;             // if true, +-25% band check skipped
}
```

---

## 3. Full action row schema

```typescript
interface GoogleAdsActionRow {
  id: string;
  action_type: string;                 // 'ops:google_budget' | 'ops:google_pause' | etc.
  target: string;                      // e.g. 'google_campaign:<campaign_resource_name>'
  assigned_producer: string;           // 'marketing_brain_skills/producers/ops-google-ads'
  payload: GoogleAdsOpsPayload;
  data_evidence: {
    audit_source?: string;             // e.g. 'audit-ads'
    opportunity_area?: string;         // e.g. 'CPL above 2x baseline for 7 days'
    signal_evidence?: string;          // e.g. 'CPL=$92.00 vs baseline $41.00, 7d window'
  };
  generation_reason: string;
  status: 'pending';
}
```

---

## 4. The recipe

**Step 1: Read the action row and claim it**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>' AND status = 'pending';
```

If not `pending`, halt silently. Another agent claimed the row.

**Step 2: Load mandatory references**

- `CLAUDE.md` §0: Data Accuracy (outranks everything)
- `CLAUDE.md` §0.5: Draft-First, Commit-Last (explicit approval required before API call)
- `design_system/ryan-realty/SKILL.md`: brand context (for rationale surface message tone)
- `marketing_brain_skills/brand-voice/voice_guidelines.md`: voice for surface message text
- `marketing_brain_skills/research/tool-inventory.md`: Google Ads API env var status
- `marketing_brain_skills/research/platform-bible.md`: not directly applicable; note for future
- `marketing_brain_skills/research/asset-library-map.md`: not applicable for ops actions
- `marketing_brain_skills/research/bend-market-bible.md`: not directly applicable for budget ops

**Step 3: Check env var availability**

Required env vars per `marketing_brain_skills/research/env-manifest.md`:
- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_CUSTOMER_ID` (the Google Ads customer ID, without hyphens)

If any of these are missing or unset:

```sql
UPDATE marketing_brain_actions
SET status = 'killed',
    executor_response = '{"error": "Missing Google Ads env var(s): <list>. No API call made."}'::jsonb
WHERE id = '<id>';
```

Surface to Matt:

```
BLOCKED: ops-google-ads cannot execute.
Missing env var(s): <list>
Set these in .env.local and Vercel before any Google Ads ops can run.
Action row killed.
```

Per `env-manifest.md`: `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`,
`GOOGLE_ADS_REFRESH_TOKEN`, and `GOOGLE_ADS_DEVELOPER_TOKEN` are likely UNSET
(not found in the env manifest as of 2026-05-17). Surface this clearly. Do not attempt
to call the API with missing credentials.

**Step 4: Read current campaign state via Google Ads API**

Authenticate using the OAuth2 refresh token flow:
```
POST https://oauth2.googleapis.com/token
Body: {
  client_id: GOOGLE_ADS_CLIENT_ID,
  client_secret: GOOGLE_ADS_CLIENT_SECRET,
  refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
  grant_type: 'refresh_token'
}
```

Then query the Google Ads API (v18 or latest stable):
```
POST https://googleads.googleapis.com/v18/customers/<GOOGLE_ADS_CUSTOMER_ID>/googleAds:search
Headers:
  Authorization: Bearer <access_token>
  developer-token: GOOGLE_ADS_DEVELOPER_TOKEN
  login-customer-id: GOOGLE_ADS_CUSTOMER_ID
Body:
  {
    "query": "SELECT campaign.id, campaign.name, campaign.status,
              campaign_budget.amount_micros
              FROM campaign
              WHERE campaign.resource_name = '<campaign_resource_name>'"
  }
```

Store the full response as `payload.current_daily_budget_micros` (from
`campaign_budget.amount_micros`) and `payload.current_state`.

If the API returns a 403 or the campaign is not found in the customer account:
- Set `status='killed'`; surface the error; stop.

**Step 5: Compute proposed change and enforce guardrails**

**Budget adjust guardrail:**
```
current_micros = payload.current_daily_budget_micros
proposed_micros = payload.proposed_daily_budget_micros
delta_pct = (proposed_micros - current_micros) / current_micros

if abs(delta_pct) > 0.25 and NOT payload.matt_override:
  -> HALT. Surface to Matt:
    "Proposed budget change of {delta_pct*100:.1f}% exceeds the +-25% band.
     Current: ${current_micros/1_000_000:.2f}/day
     Proposed: ${proposed_micros/1_000_000:.2f}/day
     Reply 'override' to proceed, or give me a revised budget within the band."
  -> Set status='ready' with executor_response noting the band conflict.
  -> Stop. Do not call the API.
```

**CPL-triggered pause verification:**

If `action='pause'` and `data_evidence.opportunity_area` contains a CPL signal,
verify from `marketing_channel_daily`:

```sql
SELECT
  SUM(spend) / NULLIF(SUM(leads), 0) AS current_cpl,
  AVG(cpl_30d_baseline) AS baseline_cpl
FROM marketing_channel_daily
WHERE channel = 'google_ads'
  AND campaign_id = '<campaign_name_or_id>'
  AND date >= now() - INTERVAL '7 days';
```

If `current_cpl > 2 * baseline_cpl`: pause is data-warranted. Include verification
in the surface message. If fewer than 5 data rows: note the data gap; let Matt decide.

**Step 6: Surface to Matt for explicit approval**

```
Proposed Google Ads change: [action_type] on [campaign_name]

  CURRENT STATE
    Campaign:     [campaign_name]
    Resource:     [campaign_resource_name]
    Status:       [current_status]
    Daily budget: $[current_micros / 1_000_000:.2f]/day

  PROPOSED CHANGE
    [Human-readable description of the exact change]
    [For budget: Current $X/day -> Proposed $Y/day (+/-Z%)]
    [For pause: Setting status PAUSED]
    [For keyword_swap: Removing "[remove_keyword_text]" / Adding "[add_keyword_text]" [match_type]]
    [For negative_add: Adding negative "[keyword_text]" [match_type] at [target_level] level]

  RATIONALE
    [payload.rationale]
    [data_evidence.signal_evidence if present]

  ACTION ROW
    ID: [id]
    Source: [data_evidence.audit_source]

Reply "yes" / "approved" / "go" to execute.
Reply "no" or "kill" to cancel.
Reply "override" to bypass the +-25% band (budget changes only).
```

Set `status='ready'`. Stop. Do not call the Google Ads API. Wait for Matt.

**Step 7: Execute via Google Ads API (post-approval only)**

Only after Matt's explicit "yes," "approved," "go," or "override."

Set `status='approved'`:
```sql
UPDATE marketing_brain_actions
SET status = 'approved', approved_by = 'matt', approved_at = now()
WHERE id = '<id>';
```

**Budget adjust mutation:**
```json
POST /v18/customers/<cid>/campaigns:mutate
{
  "operations": [{
    "update": {
      "resourceName": "<campaign_resource_name>",
      "campaignBudget": {
        "resourceName": "<budget_resource_name>",
        "amountMicros": "<proposed_micros>"
      }
    },
    "updateMask": "campaign_budget.amount_micros"
  }]
}
```

**Pause/resume mutation:**
```json
POST /v18/customers/<cid>/campaigns:mutate
{
  "operations": [{
    "update": {
      "resourceName": "<campaign_resource_name>",
      "status": "PAUSED"   // or "ENABLED" for resume
    },
    "updateMask": "status"
  }]
}
```

**Keyword swap:**
First remove the old keyword, then add the new one:
```json
POST /v18/customers/<cid>/adGroupCriteria:mutate
{
  "operations": [
    { "remove": "<old_keyword_resource_name>" },
    { "create": {
        "adGroup": "<ad_group_resource_name>",
        "type": "KEYWORD",
        "keyword": {
          "text": "<add_keyword_text>",
          "matchType": "<match_type>"
        }
    }}
  ]
}
```

**Negative keyword addition:**
```json
POST /v18/customers/<cid>/campaignCriteria:mutate
{
  "operations": [{
    "create": {
      "campaign": "<campaign_resource_name>",
      "type": "KEYWORD",
      "negative": true,
      "keyword": {
        "text": "<keyword_text>",
        "matchType": "<match_type>"
      }
    }
  }]
}
```

**Step 8: Record API response and update action row**

On success:
```sql
UPDATE marketing_brain_actions
SET status = 'executed',
    executor_response = '{
      "api_response": <full_response>,
      "campaign_resource_name": "<name>",
      "action_executed": "<action>",
      "executed_at": "<ISO>",
      "pre_change_state": <current_state>,
      "post_change_summary": "<human-readable summary>"
    }'::jsonb
WHERE id = '<id>';
```

On API error: set `status='killed'`; include full error in `executor_response`;
surface to Matt with raw error message and suggested remediation.

**Step 9: Confirm to Matt**

```
Executed: [campaign_name]

  [Human-readable summary of what changed]
  API confirmed: [campaign_resource_name]
  Executed at: [ISO timestamp]

Action row [id] -> status: executed.
```

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Google Ads API v18 | Campaign/ad group read + write | `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID` |
| Google OAuth2 token endpoint | Refresh access token | `GOOGLE_ADS_REFRESH_TOKEN` |
| Supabase MCP | Action row updates; CPL verification | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

**Env var status (as of 2026-05-17 per env-manifest.md):** `GOOGLE_ADS_CLIENT_ID`,
`GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, and
`GOOGLE_ADS_DEVELOPER_TOKEN` are LIKELY UNSET. Producer will kill with a missing-var
message until these are provisioned. Matt must set them in `.env.local` and Vercel.

---

## 6. Output format

**No file deliverable.** This producer's output is the API state change + the updated
`marketing_brain_actions` row.

**executor_response schema:**
```json
{
  "api_response": { "results": [...] },
  "campaign_resource_name": "customers/123/campaigns/456",
  "action_executed": "budget_adjust",
  "executed_at": "2026-05-17T14:00:00Z",
  "pre_change_state": { "amountMicros": "3000000", "status": "ENABLED" },
  "post_change_summary": "Daily budget adjusted from $3.00/day to $3.60/day (+20%)"
}
```

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-explicit` | Matt explicitly says "yes," "approved," "go," or "override" | Matt only |

Silence is not approval. A passing audit score is not approval. The explicit word from
Matt is the only gate. This matches the `ops-meta-ads` approval model exactly.

---

## 8. Status flow

```
pending         <- producer reads row here
  |
  v
in_production   <- set immediately; executed_at=now()
  |
  +-- Env vars missing -> killed (with missing-var message)
  +-- Campaign not found -> killed
  +-- Budget band violation -> ready (surface to Matt; wait for override)
  +-- Data gap for auto-pause -> surface with caveat; let Matt decide
  |
  v (surface message sent)
ready           <- set when approval request surfaced to Matt
  |
  v (Matt says "yes" / "approved" / "go")
approved        <- approved_by='matt', approved_at=now()
  |
  v (Google Ads API call completes)
executed        <- executor_response populated
  |
  v (48h: marketing_channel_daily captures post-change CPL)
measured

killed          <- env vars missing, campaign not found,
                   band violation without override, Matt says "no",
                   or API error after 1 retry
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Env vars missing | Any of the 5 required Google Ads vars not in process.env | Kill immediately with named missing vars. Surface to Matt. Per env-manifest.md this is the expected state until credentials are provisioned. |
| OAuth token refresh fails | 400 from `oauth2.googleapis.com/token` | Kill. Surface: "Google Ads OAuth refresh failed. Check GOOGLE_ADS_REFRESH_TOKEN in .env.local." |
| Campaign not found | API query returns 0 rows for `campaign.resource_name` | Kill. Report campaign resource name used. |
| Budget band violation without override | delta_pct > 25% | Set `status='ready'`; surface conflict with override instructions. Do not execute. |
| Insufficient CPL data for auto-pause | Fewer than 5 rows in 7-day window | Note in surface message; let Matt decide with the caveat. Do not auto-reject. |
| Google Ads API 5xx | Server error on mutate request | Retry once after 10 seconds. If second attempt fails, kill with error. |
| `GOOGLE_ADS_CUSTOMER_ID` format error | Customer ID contains hyphens | Strip hyphens before API call. Log the correction. |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0: Data Accuracy
- `CLAUDE.md` §0.5: Draft-First, Commit-Last
- `design_system/ryan-realty/SKILL.md`: brand context for surface message tone
- `marketing_brain_skills/brand-voice/voice_guidelines.md`: voice for surface messages
- `marketing_brain_skills/research/tool-inventory.md`: Google Ads env var status
- `marketing_brain_skills/research/platform-bible.md`: platform compliance cross-reference
- `marketing_brain_skills/research/asset-library-map.md`: not required for budget ops
- `marketing_brain_skills/research/bend-market-bible.md`: context for keyword decisions

**Sister producer:**
- `marketing_brain_skills/producers/ops-meta-ads/SKILL.md`: same approval model for Meta

**Copy producer that feeds this producer:**
- `social_media_skills/google-ads-copy/SKILL.md`: produces the approved copy bundle that ops-google-ads can upload

**Brain components that generate ops:google_* action rows:**
- `marketing_brain_skills/audit-ads/SKILL.md`: CPL anomalies, keyword fatigue
- `marketing_brain_skills/diagnose-performance/SKILL.md`: WoW/MoM channel deltas

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md`: Section D, row `ops-google-ads`

## 12. Tool gap suggestions

What would make this 10x better:

1. **Google Ads API token** (currently unprovided): once the OAuth token is provisioned, migrate from manual Google Ads account edits to programmatic budget and keyword management.
2. **Smart Bidding target CPA**: integrate the Target CPA smart bidding strategy via the API rather than using Manual CPC, reducing CPL without requiring weekly manual bid adjustments.
3. **Negative keyword automation**: after each FUB lead audit, identify common non-converting search terms and auto-add them as negative keywords to prevent budget waste.

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

