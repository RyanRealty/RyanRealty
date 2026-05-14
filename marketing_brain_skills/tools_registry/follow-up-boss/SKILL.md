---
name: tools_registry-follow-up-boss
description: Use this skill when a task involves "FUB", "Follow Up Boss", "CRM", "qualified seller leads", "north-star metric", "lead response time", "SLA compliance", "FUB tag", "CRM tagging drift", "pipeline health", "lead routing", "ops:fub_tag_fix", "ops:fub_task_create", "ops:fub_sequence_change", "ops:fub_routing", "fub-snapshot", "audit-crm", or any read or write operation against the Follow Up Boss API. Follow Up Boss is Ryan Realty's CRM. Covers authentication, critical gotchas, endpoint patterns, the north-star metric definition, SLA thresholds, cost model, and failure modes.
---

# Follow Up Boss Tool Skill

## Canonical references

This is a capability skill used by the marketing brain's CRM layer. Every task that invokes this skill also loads:

- `CLAUDE.md` §0 — Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `lib/marketing-brain/audit-crm.ts` — analytics layer (reads FUB data from Supabase)
- `marketing_brain_skills/producers/ops-fub-crm/SKILL.md` — write-back producer (mutates FUB via API)

---

## Scope

Follow Up Boss (FUB) is Ryan Realty's CRM. Every lead Ryan Realty generates lands in FUB before any human touches it.

**The brain READS FUB indirectly** — the daily ingestor at `app/api/cron/marketing-snapshot-fub/route.ts` pulls from the FUB v1 API and writes rows to `public.marketing_channel_daily` (channel `'fub'`). The audit-crm layer reads exclusively from Supabase, never from FUB directly at audit time.

**The brain WRITES to FUB directly** — the `ops-fub-crm` producer calls the FUB API for: tag apply/remove, sequence enrollment/stop, task creation, and agent routing changes. These are ops-tier actions requiring Matt's explicit approval for bulk operations.

### Lead intake sources flowing into FUB

| source | how leads arrive |
|---|---|
| Facebook lead-gen ads | FUB webhook from Meta lead form (CAPI route in `app/api/facebook/`) |
| Web form submissions | `pushToFub()` from `lib/fub.ts` via API routes |
| IDX inquiries | FUB webhook via IDX provider |
| Zillow leads | FUB Zillow integration |
| Manual entries | Direct FUB UI input by broker |

### What the brain uses FUB for

| use case | layer |
|---|---|
| North-star metric (`qualified_seller_leads`) | ingestor → Supabase → audit-crm |
| Response-time SLA tracking | ingestor → Supabase → audit-crm |
| Source quality scoring | ingestor → Supabase → audit-crm |
| Pipeline health (stalled stages) | ingestor → Supabase → audit-crm |
| Tagging discipline (`tagging_drift`) | ingestor → Supabase → audit-crm |
| Tag fixes, sequence changes, task creation, routing | ops-fub-crm → FUB API directly |

### Do NOT use this tool for

| need | use instead |
|---|---|
| Creating new lead records | webhook ingest routes in `app/api/` |
| Sending email to leads | `ops-email-send` producer + Resend |
| Exporting leads for Meta custom audiences | `scripts/export-fub-custom-audience.mjs` |
| Deleting lead records | Manual action in FUB UI — never automated |
| Supabase analytics queries against `marketing_channel_daily` | Supabase tool skill directly |

---

## Authentication

**Auth type:** HTTP Basic — API key as the username, empty string as the password.

| env var | purpose | where to get it |
|---|---|---|
| `FOLLOWUPBOSS_API_KEY` | Primary API key — all v1 API calls | FUB Admin → Integrations → API |
| `FUB_API_KEY` | Script-side alias (same key, different name convention) | Same key; `lib/fub-client.mjs` accepts both |
| `FOLLOWUPBOSS_SYSTEM` | Optional X-System header (identifies the integration in FUB) | Set to `'ryan-realty-platform'` |
| `FOLLOWUPBOSS_SYSTEM_KEY` | Optional X-System-Key header (system-level auth in FUB) | Provided by FUB support if required |

```ts
// Canonical auth helper — lib/fub-snapshot.ts (used by the ingestor)
export function getFubHeaders(): HeadersInit | null {
  const apiKey = process.env.FOLLOWUPBOSS_API_KEY?.trim()
  if (!apiKey) return null
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
  }
  const system = process.env.FOLLOWUPBOSS_SYSTEM?.trim()
  const systemKey = process.env.FOLLOWUPBOSS_SYSTEM_KEY?.trim()
  if (system) headers['X-System'] = system
  if (systemKey) headers['X-System-Key'] = systemKey
  return headers
}
```

**Never use `Authorization: Bearer ...`** — FUB v1 uses Basic auth (base64 of `apiKey:`). Bearer auth returns 401.

Stored in:
- `.env.local` (local dev)
- Vercel → Project Settings → Environment Variables → Production + Preview + Development

---

## CRITICAL gotcha #1 — Case-insensitive AND multi-form tag matching

**Do not simplify the tag matching set.** The playbook documents tags in kebab-case (`hot-seller`, `warm-seller`, `seller`, `seller-lead`) but actual production data uses at least three more forms: Title Case from the webhook (`Seller Lead`, `Seller Intent`, `Hot Seller`, `Warm Seller`), landing-page form tags (`LP-Home-Value`), and automation tags fired by the FUB workflow engine (`auto:seller-seq:new`).

The canonical set (from `app/api/cron/marketing-snapshot-fub/route.ts`, verified 2026-05-12 against live FUB inspection):

```ts
const SELLER_LEAD_TAGS = new Set<string>([
  // Playbook kebab-case (docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md §2)
  'hot-seller',
  'warm-seller',
  'seller',
  'seller-lead',
  // Webhook Title Case (actual production tags as of 2026-05-12)
  'seller lead',
  'seller intent',
  'hot seller',
  'warm seller',
  // Landing-page seller-intent tag
  'lp-home-value',
  // Automation tag (fired when website lead is classified seller-intent)
  'auto:seller-seq:new',
])

function isSellerLead(tags: string[] | null | undefined): boolean {
  if (!Array.isArray(tags)) return false
  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    if (SELLER_LEAD_TAGS.has(raw.toLowerCase().trim())) return true
  }
  return false
}
```

**Comparison is case-insensitive** (`raw.toLowerCase().trim()`). Never remove the case-insensitive step — a tag arriving as `Seller Lead` from the webhook would silently miss a case-sensitive `has()` check and drop qualified leads from the north-star count.

**`nurture-only` is excluded by design** — those leads are not yet qualified.

---

## CRITICAL gotcha #2 — /v1/people does NOT accept createdAfter / createdBefore

The FUB v1 `/people` endpoint returns HTTP 400 if you pass `createdAfter` or `createdBefore` as query parameters. The documented workaround is to paginate using `sort=-created` (newest first) and stop when the oldest item on a page falls before the window start.

The canonical implementation is `fetchInDateWindow()` in `app/api/cron/marketing-snapshot-fub/route.ts`:

```ts
async function fetchInDateWindow<T extends { created?: string | null; createdAt?: string | null }>(
  endpoint: string,
  startDateISO: string,  // e.g. '2026-05-01T00:00:00Z'
  endDateISO: string,    // e.g. '2026-05-08T00:00:00Z'
  headers: HeadersInit,
  pageSize = 100,
  hardCapPages = 200,    // safety: never scan more than 200 pages (~20k leads)
): Promise<T[]>
```

Key behaviors:
- Sorts by `-created` (newest first) so most windows terminate early.
- Stops as soon as the newest item on a page is older than `startDateISO`.
- Hard-caps at 200 pages to prevent infinite loops on large databases.
- Works for `/people`, `/events`, and `/deals` — all three endpoints share the same missing-date-filter behavior.

**Do not attempt `?createdAfter=...` or `?createdBefore=...`** — it fails with 400. Do not use `fetchAllPages()` for date-windowed pulls — it will scan the entire lead database.

---

## Endpoint patterns

Base URL: `https://api.followupboss.com/v1`

All endpoints use Basic auth (see Authentication section).

### Reads (ingestor + audit)

| endpoint | method | purpose | gotchas |
|---|---|---|---|
| `/people` | GET | Lead list — paginated | No date-filter params (see gotcha #2). Use `sort=-created` + client-side filter. Paginate with `limit` + `offset`. Response key is `people` (plural). |
| `/people/{id}` | GET | Single lead detail | Returns full person object including tags, stage, source, assigned agent |
| `/events` | GET | Activity events (calls, emails, notes, appointments) | Same no-date-filter gotcha as /people |
| `/deals` | GET | Deal pipeline — all deals | Accepts full-table fetch (no date filter needed for pipeline snapshot). Response key is `deals`. |
| `/users` | GET | Broker roster | Use to resolve agent IDs before routing operations. Returns all FUB users for the account. |

### Pagination pattern (fetchAllPages)

```ts
// For endpoints where date filtering is not needed (e.g. full pipeline snapshot)
const q = new URLSearchParams({ limit: '100', offset: String(offset) })
const res = await fetch(`${FUB_BASE}/${endpoint}?${q}`, { headers })
const data = await res.json()
// FUB returns the collection under its plural resource name (people, deals, events)
const key = Object.keys(data).find(k => Array.isArray(data[k]) && k !== 'metadata')
const items = key ? data[key] : []
if (items.length < pageSize) break   // last page
offset += pageSize
```

### Writes (ops-fub-crm producer)

| endpoint | method | purpose | key behavior |
|---|---|---|---|
| `/people/{id}` | PUT | Update tags, stage, assigned agent | Tags are a full replacement array — always merge with existing tags before writing |
| `/tasks` | POST | Create a task for a broker | Requires explicit `personId`, `type`, `dueDate`, `assignedUserId` |
| `/actionPlans/subscriptions` | POST | Enroll a lead in a sequence | Requires `personId`, `actionPlanId`, `assignedUserId` |
| `/actionPlans/subscriptions/{id}` | DELETE | Stop an active sequence | Must first fetch active subscription ID for the person + sequence pair |

**Tag write rule (enforced in ops-fub-crm):** FUB's PUT `/people/{id}` sets the full tags array. Always fetch current tags before writing, then compute `[...currentTags, ...tagsToAdd]` or `currentTags.filter(t => !tagsToRemove.includes(t))`. Never overwrite the full tag list without a merge step.

---

## North-star metric: qualified_seller_leads

**Definition:** count of leads meeting ALL of the following conditions, aggregated daily by the FUB ingestor:
1. Created in the window
2. `isSellerLead(person.tags) === true` (see gotcha #1 for the full tag set)
3. Stage is NOT `'Trash'` and NOT `'Closed Lost'` (these are terminal states excluded from the count)

**Where it lives:** `public.marketing_channel_daily` in Supabase, where:
- `channel = 'fub'`
- `scope = 'account'`
- `scope_id = ''`
- `metric = 'qualified_seller_leads'`
- `date = 'YYYY-MM-DD'` (one row per day)

**WoW / MoM tracking:** `lib/marketing-brain/audit-crm.ts` → `analyzeNorthStar()` computes current 7d vs prior 7d (WoW) and current 30d vs prior 30d (MoM), plus a 4-week trailing baseline mean.

**Trigger:** a WoW drop of more than 20% triggers a `north_star` high-severity opportunity in the audit-crm report, which causes `generate-briefs.ts` to emit an `analyze:anomaly` action row for Matt's review.

---

## Metrics ingested by the FUB ingestor

The `marketing-snapshot-fub` cron runs daily at 06:30 UTC (Vercel cron). It writes these metrics to `marketing_channel_daily`:

| metric | scope | scope_id | description |
|---|---|---|---|
| `new_leads` | `account` | `''` | Count of people created on the day |
| `new_leads` | `source` | lead source string | Per-source breakdown of new leads |
| `qualified_seller_leads` | `account` | `''` | North-star (see above) |
| `avg_response_time_minutes` | `account` | `''` | Mean of `firstAgentResponseTime` (ms → minutes) for new leads; omitted when no measurable data |
| `appointments_booked` | `account` | `''` | Events of type `Appointment` on the day |
| `deals_created` | `account` | `''` | Deals created on the day |
| `deals_closed_won` | `account` | `''` | Deals whose `stageUpdatedAt` or `updatedAt` fell in the day window AND status = `'closed won'` |
| `deals_lost` | `account` | `''` | Same, status = `'closed lost'` |
| `pipeline_count` | `campaign` | `'stage:<name>'` | Per-stage deal count (current-state snapshot) |
| `pipeline_value` | `campaign` | `'stage:<name>'` | Per-stage deal value in dollars |

**Note on `deals_closed_won` / `deals_lost`:** FUB does not expose a point-in-time pipeline snapshot via query params. The ingestor uses `stageUpdatedAt ?? updatedAt` as the transition-date proxy. This is documented in the row's `metadata.approximation` field. Do not treat these figures as precise transitions without acknowledging the approximation.

---

## Response-time SLA thresholds

Defined in `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` and locked in `lib/marketing-brain/audit-crm.ts`:

| lead tier | SLA | tag |
|---|---|---|
| Hot | 5 minutes | `hot-seller` / `Hot Seller` |
| Warm | 30 minutes | `warm-seller` / `Warm Seller` |

**Compliance computation:** `audit-crm.ts` uses `avg_response_time_minutes` at account scope as the proxy. Compliance per day = `avg <= 5 minutes`. Overall compliance % = compliant_days / data_days × 100.

**Audit-crm opportunity thresholds (from `findOpportunities()`):**

| compliance % | severity | generates |
|---|---|---|
| < 50% | high | `ops:fub_task_create` action row — broker task flagging the breach |
| 50–80% | medium | `ops:fub_sequence_change` action row — tighten auto-followup sequence |
| worsening trend (>= 80% but trending up) | low | alert only; no action row |
| no data | medium | `check_tracking` alert — FUB may not be surfacing `firstAgentResponseTime` |

---

## Source quality scoring

`analyzeSourceQuality()` in `audit-crm.ts` computes a 0–100 weighted composite per lead source over the window:

```
quality_score = (qualified_lead_ratio × 0.50)
              + (deal_closed_won_ratio × 0.30)
              + (avg_deal_value_score × 0.20)
```

Where `qualified_lead_ratio = qualified_seller_leads / new_leads` and `avg_deal_value_score` is each source's average deal value normalised to [0,1] relative to the peer maximum.

**Current limitation:** the ingestor does not break down `qualified_seller_leads` or `deals_closed_won` by source in Supabase — only `new_leads` is tracked at `scope='source'`. Source quality ratios are allocated proportionally from account-level totals. This is documented in the code as an approximation and should be flagged as such in any deliverable citing source quality scores.

---

## Pipeline stage funnel

FUB stage names vary across account configurations. The canonical funnel in `audit-crm.ts` uses fuzzy matching against these canonical stages (in order):

`new` → `hot` → `warm` → `nurture` → `contract`

A pipeline stall is flagged when a stage's count grew over the window but `contract` stage count did NOT increase (proxy: no funnel advancement). Stalled stages surface as a `pipeline_health` high-severity opportunity.

---

## Cost model

FUB charges a flat SaaS subscription — the REST API is included at no additional cost per call. No per-request quota to manage at Ryan Realty's volume (hundreds of leads/week, well below any documented rate limit).

**Rate limit:** FUB v1 enforces approximately 50 requests/second for reads and approximately 100 requests/10 seconds for writes. The ingestor serializes all calls sequentially within a single cron execution. The ops-fub-crm producer batches write operations with 10s back-off on 429.

---

## Failure modes

| failure | symptom | resolution |
|---|---|---|
| `FOLLOWUPBOSS_API_KEY` not set | `getFubHeaders()` returns null; route returns 500 | Add key to `.env.local` and Vercel env; confirm with `process.env.FOLLOWUPBOSS_API_KEY` in a test route |
| Wrong auth scheme (Bearer instead of Basic) | HTTP 401 on every call | Switch to `Authorization: Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` |
| Date-filter params on `/people` (gotcha #2) | HTTP 400 with no useful error body | Remove `createdAfter`/`createdBefore`; switch to `fetchInDateWindow()` pattern |
| Tag matching case mismatch (gotcha #1) | `qualified_seller_leads` silently returns 0; north-star metric shows 0 when real leads exist | Add all Title Case and automation tag forms to `SELLER_LEAD_TAGS`; ensure `raw.toLowerCase().trim()` in the comparison |
| Stage names changed in FUB admin | `analyzePipelineHealth()` produces null conversions; stall detection breaks silently | Audit FUB pipeline stages in admin; update `matchCanonicalStage()` fuzzy-match rules |
| Tag write stomps existing tags | Lead loses prior tags after ops-fub-crm runs | Always fetch `/people/{id}` to get current tags before PUT; never send a tags array without merging |
| FUB rate limit (429) on bulk write | HTTP 429 during `ops-fub-crm` execute step | Back off 10s; retry up to 3 times; if 3 consecutive 429s, pause 60s and retry once; log in executor_response |
| `firstAgentResponseTime` not present | `avg_response_time_minutes` rows absent from Supabase | FUB account configuration may not expose this field on the API response; fall back to computing `respondedAt - createdAt` if both fields are present; skip the metric row entirely if neither path yields a value (no zero-filling) |
| Sequence ID not found | FUB returns 404 on `actionPlans/subscriptions` POST | Halt sequence op; surface to Matt with the sequence ID; verify the sequence exists in FUB admin |
| Hard cap on `fetchInDateWindow` (200 pages) | Window fetch stops at 20k leads | For a date range returning >20k leads (backfill), split the range into smaller sub-ranges and call the ingestor in parallel batches |

---

## Ingestor cron schedule and invocation

**Default (Vercel cron):** Daily at 06:30 UTC. Pulls yesterday's data only.

**Backfill:** `GET /api/cron/marketing-snapshot-fub?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` — iterates day-by-day within the range and writes one metric set per day. Requires `Authorization: Bearer $CRON_SECRET`.

**Entry point:** `app/api/cron/marketing-snapshot-fub/route.ts`

**Fetch strategy:** The ingestor fetches the full date-window ONCE per endpoint (people, events, deals) rather than one query per day. It then partitions results client-side by `created.slice(0, 10)`. This avoids 90+ API calls for a 30-day backfill AND works around the no-date-filter gotcha.

---

## Consumers of this tool

| consumer | what it does |
|---|---|
| `app/api/cron/marketing-snapshot-fub/route.ts` | Daily FUB snapshot ingestor; writes to `marketing_channel_daily` |
| `lib/marketing-brain/audit-crm.ts` | CRM analytics — response_time, source_quality, pipeline_health, tagging_drift, north_star; reads from Supabase only |
| `lib/marketing-brain/generate-briefs.ts` | Emits `ops:fub_tag_fix`, `ops:fub_sequence_change`, `ops:fub_task_create`, `ops:fub_routing` action rows from audit-crm opportunities |
| `marketing_brain_skills/producers/ops-fub-crm/SKILL.md` | Executes FUB mutations post-Matt-approval; enforces count guardrail before bulk ops |
| `lib/fub.ts` | `pushToFub()` — direct event push for lead intake from web forms and IDX |
| `lib/fub-client.mjs` | Script-side FUB client (people lookup, note create, people list) |
| `lib/fub-snapshot.ts` | `getFubHeaders()` — canonical auth helper used by the ingestor |

---

## Related skills and references

| resource | purpose |
|---|---|
| `lib/marketing-brain/audit-crm.ts` | Full CRM analytics implementation; all threshold constants; opportunity-surfacing logic |
| `app/api/cron/marketing-snapshot-fub/route.ts` | Ingestor source of truth; `isSellerLead` helper; `fetchInDateWindow` pattern |
| `marketing_brain_skills/producers/ops-fub-crm/SKILL.md` | Write-back producer; approval gate; per-op FUB API call patterns |
| `docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md` §2 | Seller lead tag definitions; SLA thresholds; conditional tagging rules |
| `docs/MARKETING_LEAD_FLOW.md` | End-to-end lead flow from ad click to FUB record; webhook + dedup detail |
| `lib/fub-snapshot.ts` | Auth helper — canonical pattern for `getFubHeaders()` |
| `lib/fub.ts` | Event push for web-form lead intake |
| `lib/fub-client.mjs` | Script-side people lookup and note creation |
| https://docs.followupboss.com/reference | FUB v1 API reference — endpoint schemas, filter params, response shapes |
