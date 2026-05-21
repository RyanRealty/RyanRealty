# Handoff — Brain Pipeline Audit · 2026-05-21

**To the next agent:** Matt called a STOP. Sessions on 2026-05-20 and 2026-05-21 produced lots of producer-script changes but most of them never entered the canonical brain pipeline. **Don't keep building producers. Fix the wiring.** Read this file end-to-end before touching anything.

## Bootstrap reads (in order)

1. `.auto-memory/memory_brain_pipeline_audit_2026-05-21.md` (this audit's findings, persisted across sessions)
2. `CLAUDE.md` § "Marketing Brain Architecture" — the protocol you MUST follow
3. `marketing_brain_skills/run/SKILL.md` and `marketing_brain_skills/produce/SKILL.md` — the only sanctioned entry points
4. `marketing_brain_skills/weekly-cycle/SKILL.md` + `lib/marketing-brain/weekly-cycle.ts` — what already runs
5. `marketing_brain_skills/measurement-loop/SKILL.md` + `lib/marketing-brain/measurement-loop.ts` — what the feedback contract is
6. `marketing_brain_skills/producers/TEMPLATE.md` § Step 7 — what producers are SUPPOSED to do (and don't)
7. `docs/HANDOFF_PRODUCER_REBUILD_2026-05-19.md` — the prior session's directive Matt called rogue
8. This file

## Matt's directive (2026-05-21)

> The whole point of this was to really have a brain that understood, ingested a bunch of information, made marketing decisions on what to produce and where to publish it, then it would publish those. It would go back in, and something would report back on how those posts are doing, how the ads are doing, what's being done correctly, and then that would post somewhere. It would read that information again and continually do its thing, like updating, and we're constantly growing our online presence, constantly growing our exposure, and constantly trying to drive leads.
>
> If the pipeline is broken, you're just like, "Oh, I'm just going to tell this agent to build something," and then nothing knows what's going on. Then what's the point?

## The five-stage loop Matt expects

```
   ┌─────────────────┐
   │ 1. INGEST       │  GA4, Meta Ads, IG, FB, FUB, GSC, YT, LinkedIn, X, TikTok,
   │                 │  GBP, competitor, platform-trends — every channel, every week
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ 2. DECIDE       │  Weekly cycle generates content briefs from diagnostics +
   │                 │  audits, writes rows to marketing_brain_actions
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ 3. PRODUCE      │  Dispatcher picks up status='pending', runs producer,
   │                 │  producer writes executor_response, sets status='ready'
   └────────┬────────┘
            ▼  Matt approves
   ┌─────────────────┐
   │ 4. PUBLISH      │  /api/social/publish ships to all destinations,
   │                 │  writes published_posts to executor_response,
   │                 │  sets status='executed'
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ 5. MEASURE +    │  24h/7d/30d post-publish: pull metrics per platform,
   │    OPTIMIZE     │  write to content_performance, set status='measured',
   │                 │  loop feeds the next ingest stage
   └────────┬────────┘
            │
            └──── back to stage 1, continually growing exposure + leads
```

## What's BUILT vs BROKEN (the seven gaps)

(Full table + evidence in `.auto-memory/memory_brain_pipeline_audit_2026-05-21.md`.)

🔴 **Gap 1 (CRITICAL):** **0 of 72** producer scripts updates `marketing_brain_actions`. They write outputs to disk but never close their row. Result: 26 of 33 May actions stuck `in_production` or `ready`.

🔴 **Gap 2:** No dispatcher polls `pending` rows. The brain creates briefs and nothing picks them up.

🔴 **Gap 3:** Measurement loop has no cron route. `lib/marketing-brain/measurement-loop.ts` exists but nothing fires it on a schedule.

🟡 **Gap 4:** Measurement only works for Meta Graph (IG + FB). TikTok / YT / LinkedIn / X / GBP fetchers are TODO.

🟡 **Gap 5:** No optimization-loop implementation. `optimization_runs` + `audit_winners` tables exist; nothing populates them.

🟡 **Gap 6:** Weekly cycle cron is set (Mondays 02:00 UTC) but only 2 actions reached `executed` in all of May. Cycle either fires + silently fails, or downstream gaps (1-3) prevent it from completing.

🟡 **Gap 7:** Direct producer invocation isn't gated. Any agent can `python3 scripts/build_X.py` and bypass the audit trail entirely (which is what happened in the rogue sessions).

## What the next session SHOULD do (in order)

### Day 1 — Close one loop end-to-end

Pick `content:fb_lead_gen_ad` because everything along its path is the most mature:
- 4 rows already exist in `marketing_brain_actions` (`SELECT * FROM marketing_brain_actions WHERE action_type='content:fb_lead_gen_ad'`)
- Producer script exists at `scripts/build-fb-ad-payload.mjs`
- Publish API live for Meta Page (verified token 2026-05-06)
- `measurePlatformPost('facebook')` implemented

**Step-by-step:**
1. Pick the most recent `status='ready'` row of that type
2. Identify what it would take to mark it `approved` (review surface? Matt UI? command?)
3. Wire the producer to: (a) accept `action_id` in its payload, (b) `UPDATE marketing_brain_actions SET status='in_production'` on pickup, (c) `UPDATE ... SET status='ready', executor_response={...}` on complete
4. Add a shared `close_action_row()` helper in `scripts/_producer_lib.py` (mjs equivalent in `lib/marketing-brain/`)
5. Wire publish: producer's `executor_response` includes the draft path; on Matt approval, fire `/api/social/publish` which writes `published_posts: [{...}]` and sets `status='executed'`
6. Add a cron route `app/api/cron/measurement-loop/route.ts` that runs `measureAllExecuted()` every 6h
7. Verify: take a single fb_lead_gen_ad through every status from `pending` → `measured` and capture every row state in the audit log

### Day 2 — Generalize

Once one type closes, write the pattern. Apply `close_action_row()` to the other 71 producer scripts (mostly mechanical).

### Day 3 — Wire dispatcher + gate direct invocation

- New cron route `app/api/cron/dispatch-pending-actions/route.ts` polls `pending` rows, dispatches the matching producer, atomically transitions to `in_production`
- Add the `require_action_row()` guard to `_producer_lib.py` so direct invocation refuses without `PRODUCER_ALLOW_ROGUE=1`

### Day 4 — Build the dashboard / "brain state" view

So Matt can see at a glance: how many actions are at each status, which are stuck, which producers are healthy, what content_performance is trending.

### Day 5+ — Extend measurement to TikTok / YT / LinkedIn / X / GBP

Implement the 5 missing `measurePlatformPost()` cases. Auth already exists (publish path uses it).

### Beyond — Optimization loop

Extend `generate-briefs` to read `content_performance` last 30/90d, weight format selection by engagement-rate uplift, document in `optimization_runs`.

## What the next session must NOT do

- ❌ Re-run any of the 72 producer scripts via `python3 scripts/build_X.py` directly. That repeats the 2026-05-20/21 mistake.
- ❌ Build new producers. There are already 72; 0 close their loop. Fix what exists.
- ❌ Re-render videos to "make the gallery look better." The MP4s have already been re-rendered this session; the gallery refresh is downstream of fixing the pipeline, not upstream.
- ❌ Mark a task complete because a test passes or a script runs. The bar is "the action row reached the next status correctly."
- ❌ Dispatch parallel subagents to do producer work. Past sessions have shown they go rogue across branches and produce conflicting changes.

## Repo state at handoff (2026-05-21)

- Branch: `main`. Latest commit: `5710008` (gallery refresh after the four re-renders).
- 72 producer scripts. 0 close their action rows.
- 33 actions created in May. 2 executed. 0 measured.
- Weekly cycle cron wired. Measurement cron NOT wired.
- 4 new MP4 renders this session (earth_zoom, flyover, cascade-and-creek, tumalo-life) — they live on disk but have no marketing_brain_actions row.
- 5 design-recon docs authored from existing data — they exist at `out/design-recon/<format>/recon.md`.
- Producers were direct-invoked via `python3 scripts/build_X.py tests/fixtures/producer-payload-tumalo.json` — bypassing the protocol.

## Next-session starter prompt (paste at the top of a fresh session)

```
Read .auto-memory/memory_brain_pipeline_audit_2026-05-21.md FIRST. Then read docs/HANDOFF_BRAIN_PIPELINE_AUDIT_2026-05-21.md. Then read CLAUDE.md § "Marketing Brain Architecture".

You are not building new producers. Your job is to wire the existing 72 producers into the canonical marketing_brain_actions pipeline so the brain → produce → publish → measure → optimize loop actually closes.

Start with `content:fb_lead_gen_ad`. Close ONE loop end-to-end before generalizing. Every action you take must either: (a) write to marketing_brain_actions, (b) modify a producer script to write to marketing_brain_actions, (c) extend a cron route to dispatch / measure, or (d) document a finding to the audit memory file.

If you find yourself running `python3 scripts/build_X.py tests/fixtures/payload.json` directly, you've gone rogue. Stop and use the `marketing_brain_skills/produce/SKILL.md` entry point instead, which writes an action row first.

Report back to Matt after each loop stage closes. Do not batch up "complete" work — surface incrementally so he can verify the row state in Supabase after each step.
```
