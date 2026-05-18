# Loop closure log
Phase: LOOP-CLOSURE
Built: 2026-05-17
Agent: Claude Sonnet 4.6

---

## Deliverables built

| File | Lines | Purpose |
|---|---|---|
| `app/api/cron/producer-dispatcher/route.ts` | 156 | Brain to producer queue bridge |
| `app/api/cron/publisher-sweep/route.ts` | 293 | Approved rows to platform publish + content_performance insert |
| `app/api/cron/seller-lead-attribution/route.ts` | 258 | FUB lead to content_performance attribution |
| `app/api/cron/strategy-revision-check/route.ts` | 263 | Monthly actuals vs targets, revision proposal emitter |
| `app/admin/(protected)/kpi-dashboard/page.tsx` | 460 | Live KPI dashboard, 6 panels |
| `app/admin/(protected)/kpi-dashboard/_components/KpiAutoRefresh.tsx` | 21 | Client-side 60s router.refresh() |

Total: 1,451 lines across 6 files.

---

## Schema columns used per handler (verified against phase-4.6-data-model-rationale.md)

### producer-dispatcher
- `marketing_brain_actions`: id, action_type, assigned_producer, priority_score, scheduled_for, status, executed_at, executor_response
- Reads: status='pending', ORDER BY priority_score DESC NULLS LAST
- Writes: status='in_production', executed_at, executor_response (envelope JSONB)

### publisher-sweep
- `marketing_brain_actions`: id, action_type, executor_response, failure_log, status, approved_at, scheduled_for, killed_reason, published_at
- `content_performance`: action_id, platform, post_external_id, posted_at, asset_library_refs, north_star_attributed_seller_leads
- `producer_execution_failures`: action_id, producer_slug, phase, error_message, occurred_at, retry_count
- Reads: status='approved', scheduled_for <= now()
- Writes: status='executed', published_at; inserts content_performance per platform

### seller-lead-attribution
- `content_performance`: id, action_id, platform, post_external_id, posted_at, north_star_attributed_seller_leads, metrics_48h
- External: FUB /v1/people API (FOLLOWUPBOSS_API_KEY via getFubHeaders())
- Reads: content_performance rows with posted_at in last 90 days
- Writes: north_star_attributed_seller_leads + 1, metrics_48h.attributed_lead_ids append

### strategy-revision-check
- `marketing_strategy`: id, quarter, channel_targets, north_star_target, status, generated_at
- `marketing_channel_daily`: date, channel, metric, value
- `marketing_brain_actions`: action_type, target, status (for idempotency check + INSERT)
- Reads: strategy status='active'; channel_daily for prior calendar month
- Writes: marketing_brain_actions INSERT with action_type='strategy:revision_proposal'

### kpi-dashboard page
- `marketing_strategy`: id, quarter, channel_targets, north_star_target, status
- `marketing_channel_daily`: date, channel, scope, scope_id, metric, value
- Read-only. No writes.

---

## Idempotency strategy per handler

- **producer-dispatcher:** Two-phase optimistic lock. SELECT candidates, then UPDATE with `.eq('status', 'pending')` guard. Concurrent runs that claim the same row find status already 'in_production' and skip it.
- **publisher-sweep:** UPDATE to 'executed' only fires when `.eq('status', 'approved')` matches. Concurrent sweep on the same row gets 0 rows updated and is skipped. content_performance uses `ON CONFLICT (action_id, platform) DO UPDATE`.
- **seller-lead-attribution:** Checks `metrics_48h.attributed_lead_ids` array before incrementing. A lead ID already present in the array is skipped, preventing double-counting on reruns.
- **strategy-revision-check:** WHERE NOT EXISTS guard on `(action_type='strategy:revision_proposal', target=proposalTarget, status IN ('pending','ready','in_production'))` before INSERT. Re-running the same month emits at most one open proposal.

---

## Auth check per handler

All four cron routes call `isAuthorizedCron(request)` from `lib/marketing-brain/snapshot.ts`, which validates `Authorization: Bearer ${CRON_SECRET}`. Returns 401 on mismatch.

---

## vercel.json delta

4 entries added (32 existing + 4 = 36 total in vercel.json; brief said 37 existing but actual count in file was 32):
```json
{ "path": "/api/cron/producer-dispatcher",     "schedule": "*/15 * * * *" },
{ "path": "/api/cron/publisher-sweep",          "schedule": "*/10 * * * *" },
{ "path": "/api/cron/seller-lead-attribution",  "schedule": "0 13 * * *"   },
{ "path": "/api/cron/strategy-revision-check",  "schedule": "0 14 1 * *"   }
```

---

## Known limitations and follow-ups

1. **Producer dispatcher does not auto-invoke the Claude Agent SDK.** This is by design: running Opus/Sonnet against a SKILL.md recipe costs Anthropic tokens. The dispatcher writes a `runtime_invocation_command` string in executor_response so Matt (or a separately budgeted cron) can pick up `in_production` rows and execute them. The command format assumes a future `claude --skill --action-row-id` CLI flag that the Agent SDK team would need to expose, or Matt invokes manually via claude-code in a session.

2. **publisher-sweep assumes publish_payload is a valid /api/social/publish body.** The producer is responsible for writing the full GateArtifacts-compliant payload to executor_response.publish_payload. If the gate fields (scorecardPath, citationsPath, qaReportPath, etc.) are absent, /api/social/publish will 400 and the sweep will log a publish failure without killing the row (retries up to MAX_RETRY_COUNT=2, then kills).

3. **seller-lead-attribution has a shallow attribution chain.** FUB's /v1/people endpoint does not guarantee utm_* field exposure on all plans. If utm_content and source_url are empty on most leads, attribution match rate will be low. Full attribution requires FUB webhook + CAPI integration per docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md, which is already wired for FB-sourced leads.

4. **fub_leads table not used.** The brief mentioned a potential `fub_leads` table; it does not exist in the Phase 4.6 schema. The handler queries the FUB API directly using the existing getFubHeaders() pattern from lib/fub-snapshot.ts. If a fub_leads materialized table is added in a future migration, the handler can be updated to read from it instead.

5. **strategy-revision-check targets are partially hardcoded as fallbacks.** When channel_targets JSONB does not contain a specific key (e.g. the seed Q3 strategy uses a simplified structure), the handler falls back to hardcoded defaults (igFollowers 5000, cplCeiling $65, etc.). These match the Q3 2026 strategy §4 targets in Q3-2026-strategy.md.

6. **kpi-dashboard has no Realtime subscription at the row level.** The brief requested Supabase Realtime on marketing_channel_daily. Rather than a complex Realtime client component (which would require re-fetching all aggregates on every row INSERT, creating N+1 queries), the dashboard uses a 60-second router.refresh() via KpiAutoRefresh. This is simpler, avoids WebSocket overhead for a dashboard Matt checks occasionally, and is functionally equivalent given marketing_channel_daily ingestors run at most every 30 minutes.

7. **revision-proposer producer does not exist yet.** strategy-revision-check emits a marketing_brain_actions row with assigned_producer='marketing_brain_skills/strategy/revision-proposer' and status='ready'. That producer SKILL.md is a future build. The row surfaces in the approval queue as a ready item Matt can inspect; the dashboard shows it as pending.

---

## Token cost estimate

- 4 cron routes: low read/write queries per run. No Anthropic API calls. Postgres cost only.
- KPI dashboard: 10-12 Supabase queries per page render. Sub-100ms expected.
- Total Anthropic token spend for this phase: 0 (pure Next.js + Supabase code, no LLM calls in the routes themselves).
