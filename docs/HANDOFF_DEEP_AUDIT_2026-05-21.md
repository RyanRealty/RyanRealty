# Handoff — Deep Audit Run · 2026-05-21

**For the next agent.** A `/deep-audit` skill exists at `.claude/skills/deep-audit/SKILL.md` and 5 audit subagents were launched in the previous session. The previous session ran out of context before synthesizing. Your job: pick up the subagent results, synthesize into a single ranked report, surface findings.

---

## What's already running

Five `general-purpose` subagents were dispatched in the previous session. Their findings JSON lands in the agent transcript files. By the time you read this, they may be complete or partially complete. Their assigned passes:

| Subagent | Passes | Scope |
|---|---|---|
| 1 | Pass 1 + Pass 6 | Brain pipeline state (Supabase) + producer registry drift |
| 2 | Pass 2 | Producer-to-action-row wiring across all 72 scripts |
| 3 | Pass 3 + Pass 4 | Cron health + API/token health (every OAuth table) |
| 4 | Pass 5 + Pass 7 | SKILL.md drift + database hygiene + RLS gaps |
| 5 | Pass 8 + Pass 9 + Pass 10 | Tests + code health + rogue outputs (orphan `out/` files) |

If any subagent is still running when you start, wait for `<task-notification>` events. If any was killed, re-dispatch using the prompts inside `.claude/skills/deep-audit/SKILL.md` "The 10 audit passes" section.

---

## Step 1 — Read these first (in this order, do not skip)

1. `.claude/skills/deep-audit/SKILL.md` — the audit spec (defines all 10 passes + output format)
2. `.auto-memory/memory_brain_pipeline_audit_2026-05-21.md` — prior audit's known findings
3. `docs/HANDOFF_BRAIN_PIPELINE_AUDIT_2026-05-21.md` — the brain pipeline gaps doc
4. `~/.claude/projects/-Users-matthewryan-RyanRealty/memory/feedback_brain_pipeline_protocol.md` — the rogue-producer rule (DON'T break it)
5. `CLAUDE.md` § "Marketing Brain Architecture" — the canonical pipeline design

These tell you what's already known so you don't waste passes re-discovering it.

---

## Step 2 — Collect subagent results

The previous session launched five subagents in the background. Their full JSON transcripts are at:

```
/private/tmp/claude-501/-Users-matthewryan-RyanRealty/b987e4bc-1ebd-47a4-9238-b41e6562e288/tasks/a59e551c79e3da615.output
/private/tmp/claude-501/-Users-matthewryan-RyanRealty/b987e4bc-1ebd-47a4-9238-b41e6562e288/tasks/ac2582afd3e2bc64a.output
/private/tmp/claude-501/-Users-matthewryan-RyanRealty/b987e4bc-1ebd-47a4-9238-b41e6562e288/tasks/af9997bd5a3b3d0a3.output
/private/tmp/claude-501/-Users-matthewryan-RyanRealty/b987e4bc-1ebd-47a4-9238-b41e6562e288/tasks/a8c732c5ce4ddddc9.output
/private/tmp/claude-501/-Users-matthewryan-RyanRealty/b987e4bc-1ebd-47a4-9238-b41e6562e288/tasks/acb357e77385940e9.output
```

Note: those tmp paths are session-scoped. If they're gone by the time you read this, **re-run the 5 audit passes** by following the prompts in `.claude/skills/deep-audit/SKILL.md` "The 10 audit passes" — copy each pass's prompt verbatim into a new `general-purpose` Sonnet subagent.

**Better:** ignore the tmp files entirely and just re-run the audit. The skill defines exactly what each pass should do. Re-running gives you fresh data and a clean transcript.

---

## Step 3 — Synthesize into a single ranked report

Output: `out/audits/deep-audit-2026-05-21.md` with this exact structure:

```markdown
# Deep Audit Report — 2026-05-21

## Executive summary
- N critical findings
- N degraded
- N polish
- Top 5 ranked by impact (one-line each)

## Methodology
- 10 passes run as parallel subagents (list the passes)
- Read-only investigation, no mutations
- Companion docs: <link to brain pipeline audit + this handoff>

## 🔴 CRITICAL findings
### Finding 1.1 — <title>
**Evidence:** <SQL count / grep result / specific file paths>
**Affected:** <scope>
**Fix:** <one-line proposed fix>
**Effort:** S / M / L

[repeat for every critical finding from any pass]

## 🟡 DEGRADED findings
[same structure]

## 🟢 POLISH findings
[same structure]

## Recommended fix sequence
1. <highest-leverage critical>
2. <next>
...
10. <last item in the prioritized list>

## What this audit did NOT cover
- <honest list of audit gaps — what would need a separate investigation>
```

Also write a one-line summary to `.auto-memory/memory_last_audit_2026-05-21.md` with the count of findings and the top-1 critical, so future sessions can fast-lookup the audit status.

---

## Step 4 — Surface to Matt

Post in chat:
1. Executive summary (3-line)
2. Top 5 ranked findings (one line each, with severity + title)
3. Path to the full report: `out/audits/deep-audit-2026-05-21.md`
4. Ask: "Want me to start fixing the #1 critical, or do you want to pick from the list?"

Stop after that. Do not start fixing without explicit Matt direction. Per CLAUDE.md draft-first + the rogue-producer rule, no producer runs, no code mutations to "demonstrate" a fix, no batch commits.

---

## What the previous session already knows (so you don't re-discover it)

These findings are CONFIRMED — bake them into the audit as known critical items so you don't waste a pass re-finding them:

🔴 **0 of 72 producer scripts updates `marketing_brain_actions`.** None of them transitions `pending → in_production → ready → executed`. None of them writes `published_posts` to `executor_response`.

🔴 **In all of May 2026: 33 actions created, 2 executed, 0 measured.** Loop never closed once.

🔴 **No `/api/cron/measurement-loop/route.ts`.** Measurement-loop code exists at `lib/marketing-brain/measurement-loop.ts` but no cron route fires it.

🔴 **No dispatcher polls `pending` action rows.** Brain creates briefs and nothing picks them up.

🟡 **Direct producer invocation isn't gated.** Previous sessions ran `python3 scripts/build_X.py` directly without writing action rows. ~30 outputs in `out/` have no `action_id` in their `card.json`.

🟡 **Weekly cycle cron is set (Mondays 02:00 UTC) but only 2 actions ever reached `executed`.** Either the cron silently fails or downstream gaps prevent completion.

🟡 **Measurement loop is Meta-Graph-only (IG + FB).** TikTok / YT / LinkedIn / X / GBP fetchers are TODO inside `measurePlatformPost()`.

The audit's job is to find what's NOT in this list — i.e., everything else that's broken.

---

## What NOT to do

❌ **Do NOT fix anything.** The deep-audit skill is diagnosis-only. Fix step is a separate conversation, gated by Matt picking from the punch list.

❌ **Do NOT run producers.** Not `python3 scripts/build_X.py`, not via the `produce/` skill, not anything. Read-only.

❌ **Do NOT modify Supabase.** Only SELECT queries. No INSERT, UPDATE, DELETE.

❌ **Do NOT render videos.** Inspect existing MP4s only.

❌ **Do NOT push or commit anything until the report is written.** Then a single commit with just the audit report.

❌ **Do NOT mark a finding "complete" because you understand it.** The audit's success is the ranked report landing in Matt's hands, not the diagnostic step.

---

## What the deep-audit skill is for going forward

After this run completes, `/deep-audit` is the single command for any future "what's broken" question. Run it weekly. Use the resulting punch list to drive the cleanup work for the week.

The skill is at `.claude/skills/deep-audit/SKILL.md`. Edit it if you find a pass that should be added or refined.

---

## Repo state at handoff

- Branch: `main`. Latest commit: `0da80ff` (brain pipeline audit handoff)
- 72 producer scripts. 0 close their action rows.
- 5 audit subagents launched. **Pass 1+6 already completed** — JSON captured in Appendix A below. Other 4 still running or completed by now.
- `.claude/skills/deep-audit/SKILL.md` exists and is live (visible as `/deep-audit` in the skill list, force-added to git so it persists).
- `out/audits/` directory exists but is empty — waiting for your report.

---

## Appendix D — Pass 3+4 subagent result (already complete) · CRON + API HEALTH

**Headline:** Multiple OAuth tokens EXPIRED RIGHT NOW. YouTube (32h ago), X (31h ago), GBP (18h ago). TikTok / Pinterest / Threads / Nextdoor never connected. Several crons run but write no evidence (silent failures).

**Correction to prior audit:** `app/api/cron/marketing-measurement-loop/route.ts` EXISTS and is registered in `vercel.json` at `0 15 * * *` (daily 15:00 UTC). My earlier statement in `.auto-memory/memory_brain_pipeline_audit_2026-05-21.md` saying "No cron route fires the measurement loop" was WRONG. Updating the memory file.

```json
{
  "pass_3_findings": [
    {"severity": "CRITICAL", "title": "sync_logs table has zero rows — sync crons write no evidence", "evidence": "sync_logs total=0. Four crons (sync-delta every 10min, sync-history-terminal every 5min, sync-full weekly, sync-parity unregistered) never logged. sync_state DOES show active syncs (last_delta=2026-05-21 15:40), so syncs run but logging is silently broken.", "fix": "Audit each sync cron's route.ts for the sync_logs insert path. Likely schema mismatch swallowed as non-fatal. Fix the insert or surface the error.", "effort": "S"},
    {"severity": "CRITICAL", "title": "detect-expired-listings — table name mismatch (expected expired_listing_intake, actual expired_listings)", "evidence": "CLAUDE.md says public.expired_listing_intake. That table doesn't exist. Actual table public.expired_listings has 0 rows. Cron registered hourly, never wrote a row.", "fix": "Check route for actual table used. Update CLAUDE.md to reflect 'expired_listings' name. Verify Spark API key valid in prod Vercel env.", "effort": "M"},
    {"severity": "CRITICAL", "title": "marketing-weekly-cycle last wrote evidence 8 days ago — missed Monday 2026-05-19 run", "evidence": "marketing_decisions last weekly_cycle = 2026-05-13 21:18 UTC. Schedule is 0 2 * * 1. Today is 2026-05-21 Thursday; Monday 2026-05-19 produced no row. All-time count = only 4 rows.", "fix": "Check Vercel cron logs for 2026-05-19 02:00 UTC. Likely downstream call (Supabase, OpenAI, FUB) failed with 500 and no committed row.", "effort": "S"},
    {"severity": "DEGRADED", "title": "marketing-snapshot-tiktok + marketing-snapshot-gbp stale ~8 days", "evidence": "tiktok last_fetched=2026-05-13 16:56, gbp last_fetched=2026-05-13 16:22. Crons scheduled daily 06:30 UTC. Other 8 channels ran fine on 2026-05-20.", "fix": "TikTok: tiktok_auth has 0 rows — never connected. GBP: token expired 2026-05-20 21:59 UTC (Pass 4). Reconnect TikTok OAuth + refresh GBP token.", "effort": "M"},
    {"severity": "DEGRADED", "title": "market_stats_cache: 5,581 of 6,022 rows (92.7%) stale beyond 13h window", "evidence": "Only 441 of 6,022 rows updated in last 13h. Stale rows range back to 2026-04-25.", "fix": "Audit refresh-market-stats route to confirm intended coverage. Partial refresh may be by-design (lazy refresh of inactive geos) or a regression. Data accuracy risk for market report pages.", "effort": "M"},
    {"severity": "DEGRADED", "title": "seller-workflow-pause: marketing_inbox_events only 8 rows total, last event 6 days ago", "evidence": "8 rows across 6 days from a cron firing every 15min (96×/day). Either lead volume is low OR detection logic never triggered on a real reply.", "fix": "Manual FUB reply test to validate detection path.", "effort": "S"},
    {"severity": "INFO", "title": "6 cron route directories exist with no vercel.json registration (dead code candidates)", "evidence": "gbp-media-refresh, marketing-audit-run, prewarm-search-cache, start-sync, sync-parity, sync-verify-full-history. None in vercel.json crons array.", "fix": "Either register in vercel.json or delete the route files.", "effort": "S"},
    {"severity": "INFO", "title": "CORRECTION: marketing-measurement-loop EXISTS as cron route and IS registered in vercel.json", "evidence": "app/api/cron/marketing-measurement-loop/route.ts exists. vercel.json: schedule 0 15 * * * (daily 15:00 UTC). Prior audit memory said 'no cron' — that's stale and WRONG.", "fix": "Update .auto-memory/memory_brain_pipeline_audit_2026-05-21.md to reflect the cron exists.", "effort": "XS"}
  ],
  "pass_4_findings": [
    {"severity": "CRITICAL", "title": "YouTube OAuth token EXPIRED — publishing + snapshot blocked", "evidence": "youtube_auth.expires_at=2026-05-20 07:30:25 UTC (~32h ago). Token-heartbeat (daily 12pm UTC) + marketing-snapshot-youtube (daily 06:30 UTC) blocked. No youtube rows after 2026-05-20 06:30 in marketing_channel_daily.", "fix": "Trigger refresh at /api/youtube/authorize or refresh endpoint. refresh_token populated → non-interactive refresh should work.", "effort": "S"},
    {"severity": "CRITICAL", "title": "X (Twitter) OAuth token EXPIRED — publishing + snapshot blocked", "evidence": "x_auth.expires_at=2026-05-20 08:30:23 UTC (~31h ago).", "fix": "Trigger X token refresh. If refresh_token itself expired, full re-OAuth required.", "effort": "S to M"},
    {"severity": "CRITICAL", "title": "GBP OAuth token EXPIRED — snapshot + posting blocked (8 days of failures)", "evidence": "google_business_profile_auth.expires_at=2026-05-20 21:59 UTC (~18h ago). marketing_channel_daily shows gbp last_fetched=2026-05-13 — failure started 8 days ago, today's expiry is just the latest indicator.", "fix": "Refresh GBP OAuth token. Audit gbp snapshot route for auto-refresh logic on 401.", "effort": "M"},
    {"severity": "CRITICAL", "title": "TikTok OAuth — never connected (0 rows)", "evidence": "tiktok_auth = 0 rows. Listed as publish target + has marketing-snapshot-tiktok cron registered. Cron runs but produces no data.", "fix": "Complete OAuth at /api/tiktok/authorize. Account @ryanrealtybend per CLAUDE.md.", "effort": "M (first-time OAuth)"},
    {"severity": "CRITICAL", "title": "Pinterest OAuth — never connected (0 rows)", "evidence": "pinterest_auth = 0 rows. No snapshot cron. Schema built out though.", "fix": "Complete Pinterest OAuth if/when activated.", "effort": "M"},
    {"severity": "CRITICAL", "title": "Threads OAuth — never connected (0 rows)", "evidence": "threads_auth = 0 rows. @ryanrealtybend handle per CLAUDE.md.", "fix": "Complete Threads OAuth when ready.", "effort": "M"},
    {"severity": "CRITICAL", "title": "Nextdoor OAuth — never connected (0 rows)", "evidence": "nextdoor_auth = 0 rows. Schema scaffolded.", "fix": "Activate when ready.", "effort": "M"},
    {"severity": "OK", "title": "LinkedIn OAuth — connected and valid", "evidence": "expires_at=2026-07-09 02:26 UTC (49 days remaining).", "fix": "Monitor before 2026-07-09.", "effort": "N/A"}
  ]
}
```

---

## Appendix C — Pass 5+7 subagent result (already complete) · SKILL DRIFT + DB HYGIENE

**Headline:** SKILL.md routing in CLAUDE.md references 4 files that don't exist; `cma_deliveries` PII has RLS disabled; `news-video` vs `news_video` name collision; `pg_stat` statistics are stale (don't trust the row counts).

```json
{
  "pass_5_findings": [
    {"severity": "HIGH", "title": "Duplicate skill name: facebook-seller-growth across two agent environments", "evidence": "Same name: in /Users/matthewryan/RyanRealty/.claude/skills/facebook-seller-growth/ (mod 2026-05-12) AND /Users/matthewryan/RyanRealty/.cursor/skills/facebook-seller-growth/ (mod 2026-05-10). Claude Code + Cursor each load potentially diverged copy.", "fix": "Consolidate to .cursor/skills/ (both read it) and delete other. Diff and merge first.", "effort": "small"},
    {"severity": "HIGH", "title": "CLAUDE.md routes to 4 SKILL.md files that DO NOT EXIST", "evidence": "Format routing table lists: video_production_skills/neighborhood-overview/SKILL.md, weekend-events-video/SKILL.md, lifestyle-community/SKILL.md, development-showcase/SKILL.md. None exist. Only neighborhood_tour/ exists.", "fix": "Create stub SKILL.md files OR update CLAUDE.md routing table to point at existing paths.", "effort": "small"},
    {"severity": "HIGH", "title": "Skill name collision: news-video (ElevenLabs) vs news_video (Synthesia avatar)", "evidence": "Two distinct skills at video_production_skills/news-video/SKILL.md and video_production_skills/news_video/SKILL.md. news_video's own SKILL.md acknowledges ambiguity. Routing by 'news video' phrase loads wrong skill.", "fix": "Rename news_video → avatar_news_video (dir + name: field). Update CLAUDE.md routing + REGISTRY.md.", "effort": "small"},
    {"severity": "MEDIUM", "title": "video_production_skills/CAPTION_AUDIT.md referenced in CLAUDE.md but missing", "evidence": "CLAUDE.md §Captions cites it as 'violation log'. File missing. Other paths in same block all exist.", "fix": "Create stub OR remove reference from CLAUDE.md.", "effort": "small"},
    {"severity": "MEDIUM", "title": "quality_gate/SKILL.md has 6 broken relative links (spaces in paths)", "evidence": "Links like (. /. /design_system/...) with literal spaces. Won't resolve.", "fix": "Fix to ../../design_system/... etc. across 6 instances.", "effort": "small"},
    {"severity": "MEDIUM", "title": "4 SKILL.md files missing frontmatter name: field", "evidence": "pulse-feed-safe-zone/SKILL.md, pulse-feed-integration/SKILL.md, platforms/youtube/SKILL.md, platforms/gbp/SKILL.md. Routers that match on name: skip silently.", "fix": "Add name: to each.", "effort": "trivial"},
    {"severity": "LOW", "title": "pulse-feed-safe-zone/SKILL.md is an orphan (zero external references)", "evidence": "grep across .md/.ts/.tsx/.py/.mjs/.js (no node_modules, worktrees, .next) finds zero references.", "fix": "Add reference from Pulse component OR delete if superseded by safe-zones/SKILL.md.", "effort": "trivial"},
    {"severity": "LOW", "title": "Three .cursor/skills stale since 2026-04-10 (41 days)", "evidence": "oregon-orea-principal-broker, professional-word-docx, skyslope-api — predate v2 design system + brand voice updates.", "fix": "Review at next natural edit. Flag for refresh.", "effort": "small"},
    {"severity": "LOW", "title": "skills/youtube-market-reports/SKILL.md is in top-level skills/ dir not in any registry search path", "evidence": "/Users/matthewryan/RyanRealty/skills/youtube-market-reports/. CLAUDE.md + GLOBAL_SKILLS_REGISTRY.md don't list skills/.", "fix": "Move to video_production_skills/youtube-market-reports/ + update 14 refs.", "effort": "small"}
  ],
  "pass_7_findings": [
    {"severity": "HIGH", "title": "cma_deliveries has RLS disabled and stores lead PII (email, name, phone, address)", "evidence": "Confirmed: cma_deliveries.rls_enabled=false. Stores lead_email, lead_name, lead_phone, raw_address, assigned_broker_email, email_body_html/_text. Active in 5 code files (lib/cma-delivery.ts, app/api/cma-delivery/, etc.). KNOWN ISSUE per DATABASE_FOR_AI_AGENTS.md.", "fix": "Enable RLS. Add (1) service-role full access policy + (2) authenticated broker read on assigned_broker_email = auth.jwt()->>'email'.", "effort": "small"},
    {"severity": "MEDIUM", "title": "pg_stat_user_tables row counts unreliable — listings shows 14 rows vs 589K+ documented", "evidence": "Query 7.A shows listings row_count=14, but DB doc says 589K+. Stats stale. All other 0-row reports are suspect.", "fix": "Run ANALYZE; on public schema. Re-run audit to get accurate counts before treating 0-row tables as DROP candidates. Schedule autovacuum/autoanalyze.", "effort": "trivial"},
    {"severity": "MEDIUM", "title": "Large cohort of actively-referenced tables with 0 rows — producers never ran", "evidence": "brokers (83 code refs, 0 rows), communities (74, 0), neighborhoods (58, 0), cities (100, 0), boundaries (20, 0), content_performance (14, 0), profiles (17, 0). Load-bearing for search/market/site but empty.", "fix": "Seed brokers (3 rows — Matt/Paul/Rebecca), communities + neighborhoods + cities from data/resort-communities.json + DB doc Bend neighborhoods. boundaries needs authoritative GIS source.", "effort": "medium"},
    {"severity": "LOW", "title": "spatial_ref_sys has RLS disabled — expected PostGIS behavior", "evidence": "PostGIS coord reference system catalog; no user data.", "fix": "No action.", "effort": "none"},
    {"severity": "LOW", "title": "expired_listing_intake referenced in CLAUDE.md but absent from DB", "evidence": "CLAUDE.md cites it; doesn't exist. Pass 3+4 found the actual table is expired_listings (also empty).", "fix": "Update CLAUDE.md to use expired_listings, OR migrate expired_listing_intake into DB if that's the intended schema.", "effort": "small"}
  ]
}
```

---

## Appendix B — Pass 2 subagent result (already complete)

**Critical reframe from this pass:** the build scripts (the 72 `scripts/build_*.py` + `build-*.mjs`) are NOT the production execution path. The actual execution runs through `app/api/cron/producer-runtime/route.ts` and `app/api/admin/run-producer/[id]/route.ts`, which load SKILL.md files, call the Anthropic Messages API, and own the `pending → in_production → ready` transitions themselves. The build scripts are a PARALLEL CLI path with no wiring. This means:

- The "0 of 72 producers update marketing_brain_actions" finding from the prior audit is technically correct but the conclusion is WRONG — the wiring lives in `producer-runtime/route.ts`, not in each producer script.
- The real gap is: anyone (any agent) who runs `python3 scripts/build_X.py` directly bypasses the runtime that owns the status machine. This is the rogue-producer rule.
- The OTHER real gap: even when going through producer-runtime, no producer populates `executor_response.published_posts` — so the measurement loop is blind regardless of execution path.

```json
{
  "total_producers": 72,
  "writes_to_marketing_brain_actions": 0,
  "imports_shared_helper": 0,
  "complete_protocol_followed": 0,
  "findings": [
    {
      "severity": "critical",
      "title": "Split-brain execution path — scripts bypass producer-runtime which owns status transitions",
      "evidence": "app/api/cron/producer-runtime/route.ts (line 168) reads SKILL.md, calls Anthropic Messages API, sets status transitions (lines 82, 252, 290). The build_*.py / build-*.mjs scripts are NOT invoked by this pipeline. Any agent running build_*.py directly bypasses the entire status machine.",
      "fix": "Either (a) wire the build scripts to call Supabase themselves (add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY reads to _producer_lib), or (b) document that scripts are local/manual draft generation only and production goes through producer-runtime. Currently neither is documented = ambiguous split-brain.",
      "effort": "S (document) or M (wire scripts)"
    },
    {
      "severity": "critical",
      "title": "published_posts measurement-loop contract is unimplemented across all 72 producers",
      "evidence": "measurement-loop/SKILL.md §3: 'Without this contract, the loop has nothing to measure.' lib/marketing-brain/measurement-loop.ts line 211 reads executor_response.published_posts — currently always null. Zero content producers write platform_post_id after publish.",
      "fix": "For content:* producers that publish to social: after publish step, populate executor_response.published_posts=[{platform, platform_post_id, posted_at, url}] before final status=ready UPDATE. Add to producer-runtime route as write_published_posts(). Non-content (site:*, ops:*, comms:*, analyze:*) exempt.",
      "effort": "M"
    },
    {
      "severity": "degraded",
      "title": "22 .mjs scripts have no shared lib equivalent to _producer_lib.py",
      "evidence": "Only build-fb-ad-payload.mjs imports a producer_lib equivalent. The other 21 .mjs scripts independently handle output, citations, scorecards with no shared primitive.",
      "fix": "Create lib/producer-wiring.mjs with markInProduction(supabase, actionId), markReady(supabase, actionId, executorResponse), markKilled(supabase, actionId, error).",
      "effort": "S"
    },
    {
      "severity": "polish",
      "title": "3 .mjs scripts write status:'ready' to local card.json but never to Supabase",
      "evidence": "build-comms-matt-alert.mjs:285, build-comms-client-update.mjs:294, build-analyze-experiment.mjs:314 — field appears in a card object written to disk. Creates false signal: local card looks ready but Supabase row stays pending.",
      "fix": "Remove the status field from local card.json (it has no consumer) and rely solely on Supabase UPDATE for status tracking. Or add markReady() alongside the local card write.",
      "effort": "S"
    }
  ]
}
```

---

## Appendix A — Pass 1+6 subagent result (already complete)

The Pass 1 (brain pipeline state) + Pass 6 (producer registry drift) subagent returned the JSON below. Bake it directly into your final report. You do NOT need to re-run these passes.

```json
{
  "pass_1_findings": [
    {
      "severity": "critical",
      "title": "Pipeline throughput near zero — only 2 rows ever reached executed, 0 measured",
      "evidence": "1 executed row in May 2026, 0 measured across all time. 2 total executed rows, neither has published_posts in executor_response. Brain generates and dispatches actions but nothing completes the approval → executed → measured arc.",
      "fix": "Audit why content actions aren't advancing past ready/in_production. Check if draft surfaces are being delivered to Matt (contact sheet gate), whether approval events are being written back to the row, and whether the publisher skill is wiring published_posts into executor_response on completion.",
      "effort": "M"
    },
    {
      "severity": "critical",
      "title": "12 rows stuck in_production > 24h including content deliverables",
      "evidence": "comms:matt_summary rows for 2026-05-15..2026-05-20 (25h–85h stuck), content:just_listed_flyer for mls:220189999 at 84h, content:listing_reel for mls:220189422 + legacy:auto at ~85h, content:fb_lead_gen_ad at 85h, analyze:audit_findings at 85h. All transitioned to in_production around 2026-05-18 02:30–03:01 UTC — a batch run that never completed.",
      "fix": "Determine whether the 2026-05-18 02:30 UTC batch timed out or crashed. For listing_reel + just_listed_flyer, check if renders exist in out/. For comms rows, check if iMessages were delivered. Transition confirmed-delivered rows to executed or reset stalled ones to pending for re-dispatch.",
      "effort": "S"
    },
    {
      "severity": "critical",
      "title": "published_posts field missing on all executed rows — publish wiring broken",
      "evidence": "2 executed rows, 0 have executor_response->published_posts. Either (a) publisher skill isn't writing platform post IDs back, or (b) rows manually transitioned to executed without going through publisher.",
      "fix": "Update publisher skill (automation_skills/content_engine or publisher capability) to always JSONB-merge {published_posts: [...]} into executor_response before transitioning to executed. Backfill 2 existing executed rows.",
      "effort": "S"
    },
    {
      "severity": "degraded",
      "title": "Weekly cycle runs healthy (11 in May) but output never graduates",
      "evidence": "11 weekly_cycle entries in marketing_decisions for 2026-05. Brain runs and generates decisions, yet only 2 actions reached executed across all time. Actions stall in in_production or ready.",
      "fix": "Review generate-briefs → content_engine → producer → draft surface → approval loop. Bottleneck likely the draft surfacing step (contact sheet not delivered) or status-transition write-back after approval.",
      "effort": "M"
    },
    {
      "severity": "degraded",
      "title": "comms:matt_summary rows accumulating daily — alert delivery loop broken",
      "evidence": "Daily digest rows for 2026-05-15..2026-05-20 all stuck in_production. Should auto-send (no approval required) and flip to executed. 5 consecutive days of failed delivery means Matt isn't receiving daily digests.",
      "fix": "Check comms-matt-alert producer: confirm iMessage MCP and/or Resend connected, producer writes executed_at + transitions to executed after send, no env var blocking delivery (RESEND_API_KEY, iMessage permissions).",
      "effort": "S"
    },
    {
      "severity": "degraded",
      "title": "ops:gbp_post vs content:gbp_post — action_type namespace collision",
      "evidence": "ops:gbp_post (1 row in_production) appears alongside content:gbp_post (1 row ready). REGISTRY maps ops:gbp_post under ops-reputation; content:gbp_post is not listed as a handled action_type for any producer.",
      "fix": "Canonicalize to ops:gbp_post. Add content:gbp_post as an alias in ops-reputation's action_types, OR kill the content:gbp_post row and re-emit as ops:gbp_post.",
      "effort": "S"
    }
  ],
  "pass_6_findings": [
    {
      "severity": "critical",
      "title": "10 skipE2E Remotion producers registered but zero action_type DB hits — brain never routes to them",
      "evidence": "news_video, listing_reveal, data_viz_video, area_guides, meme_content, tiktok_listing_tour, map_route_video, school_district_overlay, walkability_overlay, youtube_long_form_market_report all have real Remotion comps but their action_types never appear in marketing_brain_actions. The brain's generate-briefs is not emitting these action_types.",
      "fix": "Verify generate-briefs + weekly-cycle include these action_types in their output vocabulary. Confirm run-producer.mjs PRODUCERS map (the routing map referenced by the brain) has entries for content:news_clip, content:market_data_viz, content:area_guide_short, content:meme_video, content:tiktok_listing_tour, content:map_route, content:school_overlay, content:walkability_overlay, content:market_youtube_longform.",
      "effort": "M"
    },
    {
      "severity": "critical",
      "title": "7 REGISTRY Section B/C producers have no build script in producer-inventory.mjs",
      "evidence": "In REGISTRY but missing from inventory: cma-narrative, buyers-guide, listing-alerts, site-neighborhood-page, site-community-page, site-subdivision-page, site-listing-page, site-city-page, analyze-competitor. Marked NEW 2026-05-16/18 in REGISTRY but no corresponding build script.",
      "fix": "Either (a) create the missing build scripts and add to inventory, OR (b) mark as planned/stub in REGISTRY with a 'no-script: true' flag so test-all-producers.mjs doesn't silently skip.",
      "effort": "L"
    },
    {
      "severity": "degraded",
      "title": "floor_plan_render deprecated in inventory but still registered in REGISTRY.md",
      "evidence": "inventory line 23: floor_plan_render marked DEPRECATED 2026-05-20, moved to scripts/_deprecated/. REGISTRY.md Section B still lists it as active with action_type content:floor_plan_render.",
      "fix": "Remove from REGISTRY.md Section B (or move to retired/deprecated section). Add note that real floor plans come from listing photographer per Matt's directive.",
      "effort": "S"
    },
    {
      "severity": "degraded",
      "title": "analyze-anomaly and analyze-competitor missing from inventory",
      "evidence": "REGISTRY Section F lists analyze-anomaly (analyze:drop_investigation, analyze:spike_investigation), analyze-competitor (analyze:competitor_scan) — neither in producer-inventory.mjs. analyze-experiment IS in inventory.",
      "fix": "Add to producer-inventory.mjs with script paths, OR explicitly mark as brain-component (not executable) if they generate decisions rather than deliverables.",
      "effort": "S"
    },
    {
      "severity": "polish",
      "title": "comms-client-update in REGISTRY but not in producer-inventory.mjs",
      "evidence": "REGISTRY Section E lists comms-client-update (comms:client_weekly, comms:client_milestone, comms:past_client_touch, NEW 2026-05-16). No inventory entry. Zero instances in marketing_brain_actions.",
      "fix": "Create scripts/build-comms-client-update.mjs + add to inventory, OR mark as planned in REGISTRY.",
      "effort": "S"
    }
  ]
}
```

---

## Paste-ready starter prompt for the fresh session

```
You are picking up an in-flight deep audit of the Ryan Realty codebase + marketing brain pipeline. Read docs/HANDOFF_DEEP_AUDIT_2026-05-21.md end-to-end before doing anything else.

Five audit subagents were launched in the previous session. Either pick up their output from /private/tmp/claude-501/.../tasks/*.output if those tmp files still exist, OR re-run all 10 audit passes by following the prompts inside .claude/skills/deep-audit/SKILL.md verbatim.

Synthesize findings into out/audits/deep-audit-2026-05-21.md per the format spec in the SKILL.md. Surface executive summary + top 5 findings to Matt in chat. Stop after that. Do not fix anything. Do not run producers. Do not modify Supabase. Read-only investigation, single commit with the report only.

The previous session has already documented the brain pipeline gaps in .auto-memory/memory_brain_pipeline_audit_2026-05-21.md — bake those known criticals into the report so you don't waste a pass re-discovering them. Your job is to find everything else.
```
