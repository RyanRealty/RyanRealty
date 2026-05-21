# Marketing Brain Pipeline — Audit Findings (2026-05-21)

**Status:** Pipeline is built but NOT WIRED end-to-end. The brain creates briefs but nothing consumes them. Producers don't close their action rows. Direct producer invocation (running `python3 scripts/build_X.py` outside the protocol) bypasses the entire audit trail.

**Source of truth for the whole pipeline:** `marketing_brain_actions` table in Supabase project `dwvlophlbvvygjfxcrhm`. Every producer invocation MUST create / update a row here. **A producer run that doesn't touch this table is rogue.**

---

## Matt's vision (2026-05-21, verbatim)

> The whole point of this was to really have a brain that understood, ingested a bunch of information, made marketing decisions on what to produce and where to publish it, then it would publish those. It would go back in, and something would report back on how those posts are doing, how the ads are doing, what's being done correctly, and then that would post somewhere. It would read that information again and continually do its thing, like updating, and we're constantly growing our online presence, constantly growing our exposure, and constantly trying to drive leads.

The five-stage loop:
1. **Ingest** — pull signals from every channel (GA4, Meta Ads, IG, FB, FUB, GSC, YouTube, LinkedIn, X, TikTok, GBP) + competitor + platform-trends
2. **Decide** — generate content briefs from the diagnosis + audits
3. **Produce** — dispatch each brief to its producer, get a draft
4. **Publish** — ship the approved draft to the right platforms
5. **Measure → Optimize** — 24h/7d/30d metrics back per post, weight future decisions

---

## What's BUILT (architecture is sound)

| Stage | Skill / artifact | Status |
|---|---|---|
| Brain entry | `marketing_brain_skills/run/SKILL.md` (`marketing-brain-run`) | ✅ locked 2026-05-13 |
| Direct produce | `marketing_brain_skills/produce/SKILL.md` (`marketing-brain-produce`) | ✅ locked 2026-05-13 |
| Weekly cycle | `marketing_brain_skills/weekly-cycle/SKILL.md` + `lib/marketing-brain/weekly-cycle.ts` | ✅ exists |
| Weekly cycle cron | `app/api/cron/marketing-weekly-cycle/route.ts` + `vercel.json` `0 2 * * 1` | ✅ wired (Mondays 02:00 UTC) |
| Audits | `audit-website` / `audit-ads` / `audit-crm` + 4 API routes | ✅ exist |
| Brief generation | `generate-briefs/SKILL.md` + `app/api/marketing-brain/generate-briefs/route.ts` | ✅ exists |
| Producer registry | `marketing_brain_skills/producers/REGISTRY.md` | ✅ 73 producers |
| Producer scripts | `scripts/build_*.py` + `scripts/build-*.mjs` | ✅ 72 scripts shipped |
| Content engine bus | `automation_skills/content_engine/SKILL.md` | ✅ locked 2026-05-17 |
| Publish API | `/api/social/publish/route.ts` | ✅ live |
| Per-platform integrations | IG ✅ FB ✅ TikTok ⚠️ (OAuth needed) YT ✅ LinkedIn ✅ X ⚠️ (tier unknown) GBP ✅ | mostly ready |
| Measurement loop code | `lib/marketing-brain/measurement-loop.ts` + `marketing_brain_skills/measurement-loop/SKILL.md` | ⚠️ Meta Graph only (IG + FB); TikTok/YT/LinkedIn/X/GBP are TODO |
| Schema | 22+ tables (`marketing_brain_actions`, `marketing_decisions`, `content_performance`, `content_calendar`, `marketing_strategy`, `marketing_channel_daily`, `marketing_cost_ledger`, `optimization_runs`, `audit_runs`, `audit_winners`, `agent_insights`, `competitor_intel`, etc.) | ✅ ready |

---

## What's BROKEN (the wiring gaps)

### 🔴 Gap 1 (CRITICAL) — Producers don't close their action rows

**Evidence:** `grep -l "UPDATE marketing_brain_actions" scripts/build*.* | wc -l` returns **0**. None of the 72 producer scripts updates `marketing_brain_actions.status` from `pending` → `in_production` → `ready`. None populates `executor_response`.

**Consequence:**
- Action rows pile up at `pending` (brain creates them, nothing picks them up) or `in_production` (something ran but never closed the row)
- May 2026: 33 rows created, **26 stuck** in `in_production` or `ready`, only **2 executed**, **0 measured**
- Measurement loop has nothing to feed on — without `published_posts` in `executor_response`, the loop has no `platform_post_id` to query
- Optimization loop has no data — without `measured` rows in `content_performance`, no weighting signal

**The contract is spelled out** in `marketing_brain_skills/producers/TEMPLATE.md` § 4 Step 7 and `measurement-loop/SKILL.md` "The producer contract" — both REQUIRE producers write `published_posts` to `executor_response`. None do.

**Fix:** every producer needs Steps 1, 7, 8 from TEMPLATE.md. A shared lib function `_producer_lib.close_action_row(action_id, executor_response)` would do this in one line per producer.

### 🔴 Gap 2 — No dispatcher polls `pending` action rows

**Evidence:** weekly cycle generates briefs, writes rows with `status='pending'`, then returns. Nothing reads pending rows and dispatches the matching producer.

**Consequence:** brain output is dead-on-arrival. Matt has to invoke `produce/` skill manually for each row, or run `run/` skill which has its own dispatch but I haven't verified it actually picks up cycle-generated rows.

**Fix:** either:
- A cron route `/api/cron/dispatch-pending-actions` that polls every 5 min and fires the matching producer (write to status='in_production' atomically with `UPDATE ... WHERE status='pending' RETURNING ...`), OR
- The weekly cycle dispatches inline before returning (the `run/SKILL.md` claims this but I haven't traced if it actually happens)

### 🔴 Gap 3 — Measurement loop has no cron

**Evidence:** `app/api/cron/` has no `measurement-loop` route. `lib/marketing-brain/measurement-loop.ts` exists but nothing fires it.

**Consequence:** even if a producer DID populate `executor_response.published_posts`, no scheduler picks up `executed` rows and queries the platform APIs at 24h / 7d / 30d windows.

**Fix:** add a cron route + entry in `vercel.json`. Suggest `0 */6 * * *` so every 6h it sweeps `executed` rows with age windows of 24h/7d/30d and updates `content_performance`.

### 🟡 Gap 4 — Producers other than Meta Graph aren't measurable

**Evidence:** `measurePlatformPost()` in `lib/marketing-brain/measurement-loop.ts` only implements Instagram + Facebook fetches per its own SKILL.md. TikTok / YouTube / LinkedIn / X / GBP are TODO.

**Consequence:** when YT or TikTok posts go up, the loop can't pull their metrics. The brain's feedback signal is biased toward IG/FB.

**Fix:** implement the 5 missing platform fetchers in `measurePlatformPost()` using each platform's existing auth (already wired for publish).

### 🟡 Gap 5 — No optimization-loop implementation

**Evidence:** `optimization_runs` + `audit_winners` tables exist. No script reads `content_performance` and writes optimization decisions to either. `generate-briefs` doesn't weight by historical engagement-rate from `content_performance`.

**Consequence:** even if measurement worked, no feedback into the next brain cycle.

**Fix:** extend `generate-briefs` to read `content_performance` for the last 30/90 days and bias brief generation toward formats / hooks with proven engagement-rate uplift. Document in `optimization_runs` per cycle.

### 🟡 Gap 6 — Weekly cycle never actually closes a loop

**Evidence:** In all of May 2026, only **2 actions reached `executed`** and **0 reached `measured`**. The cron IS wired (Mondays 02:00 UTC) but either:
- The cycle is firing and silently failing (no `marketing_decisions` rows for `weekly_cycle` in the recent window — verify), OR
- The cycle fires, creates rows, but nothing downstream consumes them (per Gap 2)

**Fix:** before any other fix lands, do ONE manual end-to-end pass. Pick a single action_type (`content:cma` since that's the only one ever reaching `executed`), follow the row through every status, identify each handoff that breaks, fix in order.

### 🟡 Gap 7 — Direct producer invocation isn't gated

**Evidence:** Today's session ran `python3 scripts/build_X.py tests/fixtures/payload.json` 30+ times without writing any action rows. Nothing in the producer scripts refuses to run without an action_id.

**Consequence:** any agent (me) can produce outputs that never enter the audit trail. The brain has no idea I made anything. Matt has no canonical record.

**Fix:** add a top-of-file guard in `_producer_lib.py`:
```python
def require_action_row(payload):
    if not payload.get('action_id') and os.environ.get('PRODUCER_ALLOW_ROGUE') != '1':
        raise RuntimeError(
            "Producers must be dispatched via marketing_brain_actions. "
            "No action_id in payload. Set PRODUCER_ALLOW_ROGUE=1 for explicit-test only."
        )
```
Then `produce/` and `run/` skills set `action_id` in the payload; direct CLI invocations refuse.

---

## The action_type ↔ producer linkage gap

`marketing_brain_actions` rows carry `action_type` (e.g. `content:listing_reel`) and `assigned_producer` (path to producer SKILL.md). I haven't verified that the dispatcher actually looks up the SKILL.md, finds the producer's script path, and runs it. The handoff path is undocumented.

`marketing_brain_skills/producers/REGISTRY.md` is supposed to be the lookup table but I haven't traced who reads it at dispatch time.

---

## The minimum viable closed loop (what to build first)

**Pick ONE producer.** Suggest `content:fb_lead_gen_ad` because it's:
- Already an active row type (4 in marketing_brain_actions, one of them reached `ready`)
- Has a working build script (`scripts/build-fb-ad-payload.mjs`)
- Has a working publish path (`/api/social/publish` with Meta Page token live)
- Has a working measurement path (`measurePlatformPost('facebook')` exists)

Walk it through the full loop:
1. Brief generated → row `pending`
2. Dispatcher picks it up → row `in_production`, producer runs
3. Producer writes draft to disk + writes `executor_response={draft_path, scorecard}` + sets `status='ready'`
4. Matt approves in some review surface → sets `status='approved'`
5. Publish step runs `/api/social/publish` → posts to FB → writes `published_posts: [{platform: 'facebook', platform_post_id, url, published_at}]` to `executor_response` + sets `status='executed'`
6. 24h after `published_at`, measurement loop polls Graph API → writes `content_performance` row → sets action `status='measured'`
7. Next weekly cycle's `generate-briefs` reads `content_performance` and weights similar formats

Once that one loop closes, generalize to the other 70 producers.

---

## Anti-patterns to NOT repeat (lessons from 2026-05-20/21 sessions)

1. **DO NOT run `python3 scripts/build_X.py` directly.** That bypasses the entire protocol. Use the `produce/` or `run/` skill, which write the action row first.
2. **DO NOT mark a TaskList item complete** because the script ran or the test passed. The work is complete only when the producer wrote a meaningful `executor_response` AND set `status='ready'` AND the next stage (Matt review) can pick it up.
3. **DO NOT dispatch parallel subagents to "make a card-html mockup that passes the test."** Already a known failure mode; documented in `docs/HANDOFF_PRODUCER_REBUILD_2026-05-19.md`.
4. **DO NOT build new producers** until the existing 72 close their loop. Adding more rogue producers just deepens the hole.

---

## Source files for the next session

| File | Purpose |
|---|---|
| `CLAUDE.md` | Master rules (data accuracy, draft-first, brand voice, Marketing Brain Architecture section) |
| `marketing_brain_skills/run/SKILL.md` | Weekly cycle entry |
| `marketing_brain_skills/produce/SKILL.md` | Direct invocation entry |
| `marketing_brain_skills/weekly-cycle/SKILL.md` | Orchestrator detail |
| `marketing_brain_skills/measurement-loop/SKILL.md` | Feedback contract |
| `marketing_brain_skills/producers/TEMPLATE.md` | Producer authoring template |
| `marketing_brain_skills/producers/REGISTRY.md` | action_type → producer mapping |
| `automation_skills/content_engine/SKILL.md` | Content routing bus |
| `automation_skills/automation/publish/SKILL.md` | Publish contract |
| `lib/marketing-brain/weekly-cycle.ts` | Cycle implementation |
| `lib/marketing-brain/measurement-loop.ts` | Measurement implementation |
| `app/api/cron/marketing-weekly-cycle/route.ts` | Cycle cron route |
| `app/api/social/publish/route.ts` | Publish API route |
| `docs/HANDOFF_BRAIN_PIPELINE_AUDIT_2026-05-21.md` | Full handoff (companion to this memory) |
