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
