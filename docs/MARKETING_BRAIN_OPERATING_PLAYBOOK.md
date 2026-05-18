# Marketing Brain — Operating Playbook

**Audience:** Matt (and any future operator).
**Status:** Locked 2026-05-17.
**Source of truth for build:** `marketing_brain_skills/research/AUTONOMOUS_PIPELINE_BRIEF.md`.
**Companion doc:** `docs/MARKETING_BRAIN_USER_GUIDE.md` (concept reference).

This playbook is the operating manual. It tells you what to do day 1, day 7, day 30, day 90.

---

## Day 1 — Turn on the lights

Before the loop runs autonomously, set these env vars in BOTH `.env.local` AND the Vercel project env.

| Var | Required for | What to set |
|---|---|---|
| `ANTHROPIC_API_KEY` | producer-runtime, brain | your API key, account with credit balance |
| `PRODUCER_RUNTIME_ENABLED` | producer-runtime cron | `true` once you are ready to fire autonomously. Leaves `false` keeps the loop in manual-fire mode (you click "Run producer now" per row in the approval queue). |
| `CRON_SECRET` | every cron handler | random 32+ char string, identical in both .env.local and Vercel |
| `RESEND_API_KEY` + `RESEND_FROM` | newsletter, ops-email-send, comms-client-update | API key already set; FROM must match a verified domain in Resend (verify mail.ryan-realty.com first) |
| `WP_AGENTFIRE_USER` + `WP_AGENTFIRE_APP_PASSWORD` | blog-post, market-report-blog | generate App Password in AgentFire admin |
| `MARKETING_DIGEST_EMAIL` | comms-matt-alert daily digest | your inbox address |
| `MARKETING_DASHBOARD_BASE_URL` | snapshot-channels alias | your production URL e.g. `https://ryanrealty.vercel.app` |

OAuth flows that need walking through once each:

- TikTok: visit `/api/tiktok/authorize/` while signed in as the brand owner. Confirms grant, writes to `tiktok_auth` table.
- Pinterest: create a developer app first, set client credentials, then visit `/api/pinterest/authorize/`.
- GBP Performance API: re-grant with `business.manage` scope. Current 1-row token works for Insights but the Performance API returns 403. Re-grant fixes it.

Apply all 6 migrations under `supabase/migrations/20260516200*.sql` if you haven't already. The auto-pipeline already applied them; verify via Supabase Studio.

Ratify the Q3 2026 strategy (or write your own):
```sql
UPDATE marketing_strategy SET status='active' WHERE quarter='2026Q3';
```
Already done by the pipeline as of 2026-05-18.

---

## Daily ritual — 10 to 20 minutes

### Morning (or whenever you sit down)

1. **Open the KPI dashboard** at `/admin/kpi-dashboard`. Scan the 6 panels (north star, brand position, channel growth, site health, ad health, operational hygiene). Anything red? Ask the brain to investigate (manual: open a Claude Code session and run `/admin/approval-queue` against the analyze-anomaly producer; autonomous: the morning brain digest will already flag this).
2. **Open the approval queue** at `/admin/approval-queue`. Per card:
   - Skim the preview (image/video/blog HTML).
   - Skim the per-platform captions.
   - Click one of: Approve and ship now, Approve and schedule, Request changes, Reject, Duplicate as new variant.
3. **If a card has status `in_production` for more than 60 minutes:** click "Run producer now" to manually fire the runtime against it (only required when `PRODUCER_RUNTIME_ENABLED=false`).
4. **Check the daily digest email** in your inbox (sent at 7am MT by `comms-matt-alert`). Summarizes yesterday's audits + actions + outcomes.

### Cost check (30 seconds)

Query the cost ledger via Supabase Studio:
```sql
SELECT cost_type, sum(amount_usd) AS today
FROM marketing_cost_ledger
WHERE recorded_at >= current_date
GROUP BY cost_type ORDER BY today DESC;
```
If Anthropic spend exceeds $5 in a day without ROI, investigate. Producer-runtime caps at $15 per cron firing and $5 per row, but cumulative is unbounded.

---

## Weekly ritual — Sundays, 30 to 60 minutes

The brain's weekly-cycle cron fires Sunday 7am MT. By Sunday 9am the approval queue should have 8 to 12 new action rows.

1. **Clear the approval queue.** Run through each card.
2. **Read the brain decision log.** In Supabase: `SELECT * FROM marketing_decisions WHERE decision_type='brief_generated' AND created_at >= now() - interval '7 days' ORDER BY created_at DESC;`. Each row shows what the brain saw and why it emitted that brief. If a pattern is wrong, file a producer change request via `/admin/producers/<slug>`.
3. **Check the performance loop output.** Each measurement-loop run writes a digest to `marketing_decisions` with `decision_type='performance_loop_completed'`. Skim the top 3 winners and bottom 3 losers. The brain auto-uses this to bias next cycle, but it's worth eyeballing for misclassifications.
4. **Spot-check three published posts** from earlier in the week. Did they land on the right platform with the right caption? Did the post_external_id flow back to content_performance? Run:
   ```sql
   SELECT mba.action_type, mba.target, mba.executed_at, cp.platform, cp.post_external_id, cp.metrics_48h
   FROM marketing_brain_actions mba
   LEFT JOIN content_performance cp ON cp.action_id = mba.id
   WHERE mba.executed_at >= now() - interval '7 days'
   ORDER BY mba.executed_at DESC LIMIT 10;
   ```

### Weekly cost roll-up

```sql
SELECT cost_type, sum(amount_usd) AS week_total
FROM marketing_cost_ledger
WHERE recorded_at >= now() - interval '7 days'
GROUP BY cost_type ORDER BY week_total DESC;
```

---

## Monthly ritual — first of the month, 60 to 90 minutes

1. **Check the strategy revision proposals.** Strategy-revision-check fires on the 1st. If north-star gap > 20%, it emits a `strategy:revision_proposal` action_row. Open the approval queue, find it, read the gap analysis. Decide: revise strategy doc, or keep targets and adjust execution.
2. **Pull the full performance digest:**
   ```sql
   SELECT data_observed FROM marketing_decisions
   WHERE decision_type='performance_loop_completed'
   AND created_at >= date_trunc('month', current_date)
   ORDER BY created_at DESC LIMIT 1;
   ```
3. **Quarterly OKR check** (every 3 months). Pull the `marketing_strategy` row, check actuals against `channel_targets.north_star.monthly_seller_leads.target=18`. If consistently missing for 2+ months, the strategy needs more than tactical adjustment — re-read the strategy doc and propose a new active row.

---

## When something breaks

| Symptom | First check | Fix |
|---|---|---|
| Approval queue empty all week | `marketing_strategy.status='active'` exists? generate-briefs cron fired? | Set status='active', or manually invoke `curl -H "Authorization: Bearer $CRON_SECRET" https://ryanrealty.vercel.app/api/cron/marketing-weekly-cycle?dryRun=true` |
| Pending rows pile up (>10) | producer-dispatcher cron firing every 15 min? PRODUCER_RUNTIME_ENABLED=true? | Click "Run producer now" on the top-priority rows; or enable autonomous runtime |
| Approved rows pile up (publisher not picking them up) | publisher-sweep cron firing? Each row has `executor_response.publish_payload`? | Check the producer-execution-failures table for `phase='publish_payload_missing'` |
| Post published but no content_performance row | publisher-sweep wrote one? Did publish API return `externalPostId`? | Manually run `curl /api/cron/performance-pull-48h` with bearer token |
| GBP snapshot stale | OAuth scope includes `business.manage`? You are GBP Primary Owner (not just Manager)? | Re-grant OAuth with the Performance API scope |
| TikTok snapshot stale | `tiktok_auth` table has a row? | Walk through `/api/tiktok/authorize/` once |
| Anthropic 429 / credit error | Account balance > $20? | Top up at https://console.anthropic.com/billing; producer-runtime auto-retries up to 2x |
| Brain emits nonsense action_rows | Strategy doc still says the right things? KPI baseline values are real? | Reject the rows (status=killed); revise the strategy doc; cycle next week will be cleaner |

---

## What to NEVER do

1. **Don't `git commit` files with em-dashes** in user-facing content (captions, blog body, email body, listing descriptions). The publish route's `assertNoDashes` guard will reject them at the platform boundary, but commit early and the lint passes anyway. Use the inline strip script at `/tmp/strip_dashes.py` if you spot any.
2. **Don't bypass the approval queue** by setting `status='approved'` directly in Supabase unless you know exactly what you're shipping. The queue is the human-in-the-loop checkpoint.
3. **Don't enable PRODUCER_RUNTIME_ENABLED without first running it in dry-run.** Curl `curl -H "Authorization: Bearer $CRON_SECRET" "https://ryanrealty.vercel.app/api/cron/producer-runtime?dryRun=true"` and read the planned spend. THEN flip the env var.
4. **Don't manually edit `marketing_strategy.channel_targets`** during a quarter. Targets are the brain's optimization function. Mid-quarter changes confuse it. Instead, propose a revision via a new draft row + activate at quarter boundary.
5. **Don't run multiple Claude Code sessions in parallel** on the marketing_brain_skills/ folder. Two agents writing to REGISTRY.md or vercel.json race each other (this happened during the 2026-05-17 build — Cursor and Claude Code overwrote each other's edits). Single-session policy when touching the brain's spec files.

---

## How to add a new producer

1. Copy `marketing_brain_skills/producers/TEMPLATE.md` to a new SKILL.md path.
2. Fill out frontmatter (name, description, action_types, output_type, target_platforms, etc.).
3. Run `node scripts/validate-producer.mjs <path>` to confirm it passes the 10-gate validator.
4. Add a row to `marketing_brain_skills/producers/REGISTRY.md` in the right section (A through F).
5. The brain discovers the producer on next cycle. Test by manually emitting an action_row:
   ```sql
   INSERT INTO marketing_brain_actions (topic, format, hook, target_audience, generated_by, action_type, target, assigned_producer, payload, generation_reason, status)
   VALUES ('test', 'your_format', 'test hook', 'brand_default', 'manual', 'content:your_action', 'topic:test', 'your/skill/path', '{}', 'manual smoke test', 'pending');
   ```
6. Click "Run producer now" in the approval queue once the dispatcher picks it up.

---

## How to spin up a new strategy quarter

End of Q3:
1. Author `marketing_brain_skills/strategy/Q4-2026-strategy.md` (use Q3 as template).
2. Insert a draft row:
   ```sql
   INSERT INTO marketing_strategy (quarter, north_star_target, channel_targets, strategy_doc_path, status, generated_by, notes)
   VALUES ('2026Q4', 22, '{...}'::jsonb, 'marketing_brain_skills/strategy/Q4-2026-strategy.md', 'draft', 'matt', 'Quarterly review per Q3 performance.');
   ```
3. Review draft, then activate:
   ```sql
   UPDATE marketing_strategy SET status='superseded', superseded_by=<new_id> WHERE quarter='2026Q3' AND status='active';
   UPDATE marketing_strategy SET status='active' WHERE quarter='2026Q4' AND status='draft';
   ```
4. The brain reads the new active row on the next weekly cycle.

---

## Cost discipline ceilings

- Producer-runtime: $5 per row max, $15 per cron firing max. Configurable in the route handler.
- Brain weekly-cycle: ~$2 per run (uses Sonnet for synthesis, small token windows).
- Measurement-loop: ~$0 (no LLM calls, just DB writes).
- Performance-pull crons: ~$0 (platform API calls only).
- Strategy-revision-check: ~$0 (DB query + comparison; emits one action_row).

If monthly Anthropic spend exceeds $200, investigate. Look at `marketing_cost_ledger` grouped by `metadata->>'producer_slug'` to find which producer is over-spending.

---

## The phone-tree

Critical incident (production down, lead-gen broken, public post embarrassment):
1. Open `/admin/approval-queue`, kill any in-flight ad campaigns via `ops-meta-ads` action row.
2. SSH or Supabase Studio: `UPDATE marketing_brain_actions SET status='killed' WHERE status IN ('ready','approved','in_production');` to pause the loop.
3. Set `PRODUCER_RUNTIME_ENABLED=false` in Vercel to stop autonomous execution.
4. Investigate, fix, re-enable.

Non-critical (single brief is wrong, one producer broken, one cron flapping):
1. File a producer change request via `/admin/producers/<slug>` Edit panel.
2. Next-cycle the orchestrator drafts a fix.

---

## What you can hand to a new operator

1. This playbook.
2. `docs/MARKETING_BRAIN_USER_GUIDE.md` (concept reference).
3. `out/proof/2026-05-17/pipeline-build-summary.html` (single review surface).
4. `out/proof/2026-05-17/producer-output-catalog.html` (every producer at a glance).
5. `marketing_brain_skills/research/AUTONOMOUS_PIPELINE_BRIEF.md` (the contract the brain was built against).
6. `marketing_brain_skills/strategy/Q3-2026-strategy.md` (what the brain is executing).
7. `marketing_brain_skills/strategy/KPI-dashboard.md` (the 95 metrics).
8. Read-only access to Supabase project `dwvlophlbvvygjfxcrhm`.
9. Vercel project access for env vars + cron logs.
10. Anthropic console access for credit balance.

That's the system. Run it.
