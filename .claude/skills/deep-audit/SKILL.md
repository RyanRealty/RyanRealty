---
name: deep-audit
description: Comprehensive 10-pass audit of the Ryan Realty codebase + marketing brain pipeline. Surfaces every broken loop, stuck row, expired token, stale cron, orphan output, drifted skill, and dead table. Returns a single ranked punch list grouped by severity. Use when Matt says "deep audit", "full audit", "what's broken", "run a review", "check everything", "audit the brain", "/deep-audit", "/audit". NOT a quick lint — runs 10 parallel investigations across pipeline, code, data, and infrastructure.
when_to_use: Fires on "deep audit", "full audit", "deep review", "everything broken", "what needs fixing", "audit the codebase", "audit the pipeline", "audit the brain", "/deep-audit", "/audit". Also use proactively when Matt seems frustrated about going-rogue agents, broken pipelines, or unclear state.
---

# /deep-audit — Ryan Realty Codebase + Brain Pipeline Audit

## Purpose

Single-invocation, comprehensive audit. Returns a ranked punch list grouped by severity:

- 🔴 **CRITICAL** — broken loop, stuck rows, expired auth, data integrity
- 🟡 **DEGRADED** — partial implementation, missing crons, drift between docs and code
- 🟢 **POLISH** — dead code, stale docs, naming inconsistencies

Each finding includes file paths, evidence (counts / SQL query / grep result), and a one-line proposed fix. No work is done in the audit itself — only diagnosis. Matt picks what to fix.

## Companion docs (load these first)

| File | Purpose |
|---|---|
| `.auto-memory/memory_brain_pipeline_audit_2026-05-21.md` | Prior audit findings — start here, don't repeat what's documented |
| `docs/HANDOFF_BRAIN_PIPELINE_AUDIT_2026-05-21.md` | Handoff context |
| `CLAUDE.md` | Master rules + current architecture |
| `marketing_brain_skills/producers/REGISTRY.md` | 73-producer canonical map |
| `scripts/producer-inventory.mjs` | Executable producer list (currently 62 entries) |

## The 10 audit passes

Run these in parallel via subagents. Each subagent returns a structured findings dict. Synthesize into one ranked report at the end.

### Pass 1 — Brain pipeline state (Supabase)

Query `marketing_brain_actions` for:
- Status distribution by action_type over last 90 days
- Rows stuck `pending` (brain created but no dispatcher picked up) older than 7 days
- Rows stuck `in_production` (producer started but never closed) older than 24h
- Rows stuck `ready` (producer done but Matt never reviewed) older than 14 days
- Rows that reached `executed` — count by month. Anything below 5/month signals a broken loop.
- Rows that reached `measured` — count by month. Anything below 5/month signals no feedback signal.
- `executor_response.published_posts` presence per executed row — count rows missing this field
- `marketing_decisions` cycle runs over last 90 days — should be ~13 per quarter

### Pass 2 — Producer-to-action-row wiring

For each of 72 producer scripts:
- Does it accept `action_id` in its payload? (`grep -l "action_id\|payload.id" scripts/build*`)
- Does it `UPDATE marketing_brain_actions SET status` anywhere? (`grep -l "marketing_brain_actions" scripts/build*`)
- Does it write `published_posts` to `executor_response`?
- Does it have an `action_types: [...]` frontmatter in its SKILL.md (per TEMPLATE.md §2)?
- Is its action_type registered in REGISTRY.md?

Output: matrix of producers × wiring-step → ✅/❌. Highlight the 0-row column (likely all 72 fail at "updates status").

### Pass 3 — Cron health

For every route under `app/api/cron/`:
- Last 30 days fire count (query the relevant audit table per cron — e.g. `audit_runs`, `post_sync_pipeline_runs`, `marketing_decisions`)
- Last successful timestamp
- Error rate / silent-failure rate
- Cron schedule in `vercel.json` vs reality (any cron defined but never fires? Any cron not in vercel.json but expected?)

### Pass 4 — API + token health

For every external API used:
- Token expiry timestamp (parse OAuth tables: `tiktok_auth`, `youtube_auth`, `linkedin_auth`, `x_auth`, `pinterest_auth`, `threads_auth`, `google_business_profile_auth`, `nextdoor_auth`)
- Last successful API call (parse `marketing_inbox_events` or equivalent)
- Quota usage where queryable
- Apify Bronze actor rental status

### Pass 5 — Skill / SKILL.md drift

For every SKILL.md in `marketing_brain_skills/`, `automation_skills/`, `video_production_skills/`, `social_media_skills/`, `.claude/skills/`:
- Date last modified vs last referenced by any other file
- Duplicate `name:` frontmatter entries
- Skills referenced in `mandatory references` lists of other skills that don't actually exist
- Skills NOT referenced by anything (orphans)
- Skills referencing dead file paths

### Pass 6 — Producer registry vs inventory drift

- 73 producers in `marketing_brain_skills/producers/REGISTRY.md` Sections A-F
- 62 in `scripts/producer-inventory.mjs`
- Find: registered-but-no-script, script-but-not-registered, skipE2E producers that haven't been manually rendered in 90+ days
- Cross-check against actual `marketing_brain_actions` action_types — which producers have never been invoked even once?

### Pass 7 — Database hygiene

- Tables in `public.*` with 0 rows that are referenced by code (cold)
- Tables in `public.*` with 0 rows that are NOT referenced (dead — candidate for drop)
- Tables with `rls=disabled` on user-data tables (security gap — flag `cma_deliveries` known issue per DB doc)
- Foreign key gaps — any column ending `_id` that should point at a tracked table but doesn't have a FK
- Index gaps — high-traffic tables without indexes on common WHERE columns

### Pass 8 — Test coverage

- `npm test` pass/fail count
- `scripts/test-all-producers.mjs` pass/fail (currently 52/62 with 10 `skipE2E`)
- Untested critical paths: cron routes without test coverage, producer scripts without smoke tests
- Stale test fixtures (older than 90 days)

### Pass 9 — Code health

- TypeScript errors (`tsc --noEmit` across each project)
- Files >500 lines (refactor candidates)
- Dead exports (declared but unused across repo)
- Banned-word leakage in committed prose (run `_producer_lib.has_hard_fail()` across CLAUDE.md, README, SKILL.md files)
- Dependency drift: package.json `^` vs node_modules actual

### Pass 10 — Rogue-output audit

- Files in `out/` for which no `marketing_brain_actions` row exists. These are orphan producer runs (the 2026-05-20/21 rogue sessions Matt called out).
- For each: producer slug + last modified timestamp + has-citations? + has-card.json?
- Recommended action per orphan: backfill an action row OR delete OR escalate to Matt

## Output format

Single markdown report at `out/audits/deep-audit-<YYYY-MM-DD>.md` with:

```markdown
# Deep Audit Report — <date>

## Executive summary
- N critical findings
- N degraded
- N polish
- Top 5 ranked by impact

## 🔴 CRITICAL findings
### Finding 1.1 — <title>
**Evidence:** <SQL count, grep result, etc>
**Affected:** <file paths or table names>
**Fix:** <one-line proposed fix>
**Effort:** S / M / L

...

## 🟡 DEGRADED findings
...

## 🟢 POLISH findings
...

## Recommended fix sequence
1. <highest-leverage critical finding>
2. <next>
...
```

Also write a one-line summary to `.auto-memory/memory_last_audit_<YYYY-MM-DD>.md` for fast lookup in future sessions.

## Workflow when invoked

1. Read the companion docs (don't repeat known findings)
2. Dispatch the 10 passes as parallel subagents (`general-purpose`, model `sonnet` for the bulk passes; `Plan` agent for the cross-cutting synthesis)
3. Each subagent returns structured findings JSON
4. Synthesize into the ranked report
5. Write to `out/audits/` + `.auto-memory/`
6. Surface the executive summary + top-5 to Matt in chat
7. Wait for direction on what to fix first

## What this skill does NOT do

- Fix anything. It diagnoses only.
- Run producers. It only reads their state.
- Mutate Supabase. Only SELECT queries.
- Render videos. Only inspect existing outputs.

The fix step is its own conversation, gated by Matt picking from the punch list.

## Severity grading rubric

- 🔴 **CRITICAL** if: data loss possible, security exposure, broken loop with no manual workaround, expired auth blocking publish, payment/legal compliance gap
- 🟡 **DEGRADED** if: partial functionality, manual workaround exists, missing cron but data won't be lost, drift between docs and code that hasn't yet caused a failure
- 🟢 **POLISH** if: dead code, stale docs, naming inconsistencies, micro-optimizations, things only an engineer notices

## Re-run cadence

Recommended: every Sunday before Matt's weekly review. The audit takes 5-15 minutes; the deliverable (the punch list) drives the week's cleanup.
