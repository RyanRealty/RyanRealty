# Agent Protocol — Ryan Realty

This document tells AI coding agents (Cursor, Copilot, Windsurf, etc.) how to autonomously pick up, execute, validate, and complete development tasks on this project.

---

## Active goal (locked 2026-05-22 via Claude Code `/goal`)

**Deliver Ryan Realty website to acceptance-criteria-passing state.** The site must be the best real estate website in Central Oregon, with listing detail pages that beat Zillow Showcase, sub-second LCP on every route, and a canonical Data Access Layer that prevents regression.

Every session — Claude Code, Cursor, or Grok — starts here:

0. **`docs/LEARNINGS.md`** — the one document every agent (Claude Code, Cursor, Grok, Copilot) reads before executing: every rule born from a real mistake, the decision-authority matrix, the stop points. When Matt corrects you, the fix is written there in the same session.
0. **`docs/GROK_BOT_BRAIN.md`** if you are a Grok Bot / Grok Build teammate — map only, then open the one door for this job. Do not load the whole canon.
1. **`docs/plans/CROSS_AGENT_HANDOFF.md` Current block** (≤18 lines) — what the other surface left. Do not read the Prior novel unless you need a named SHA.
2. **`npx tsx scripts/loop-brief.ts`** — durable work graph + ship class. That is next work. Not `orchestrate.ts`. Not `docs/SITE_SPEC.md`.
3. **`docs/DATA_ACCESS_LAYER.md`** when the task touches listings/stats — every page calls `@/lib/data/*`; raw `.from('listings')` outside `lib/data/` is banned.

`docs/EXECUTION_PLAN.md` and `docs/SITE_SPEC.md` are 2026-05-22 fossils (SITE_SPEC still describes an AgentFire WordPress cutover that already shipped). Do not execute them.

**Done = the served ship class is locally accepted, then one `npm run push` + `deploy:verify` when the app changed.**

Out of scope: `marketing_brain_skills/`, `video_production_skills/`, social posting automation, transaction coordination. Only the public LP website and the CI guardrails that protect it.

---

## Execution (non-negotiable)

Run every needed command yourself (`npm run …`, scripts, git, deploy checks, SkySlope generators). **Never** tell the owner to run something in a terminal. The only exception is when something cannot run without secrets or access you do not have, in which case state exactly what is missing.

---

## Claude Code ↔ Cursor (one pipeline)

Matt alternates between **Claude Code** and **Cursor**. Both are the same repo and the same bar: **no divergent rules, no mystery state in the other tool.**

### Start of every session (any tool)

1. `git fetch origin && git pull --rebase origin main` so work always sits on current remote `main`.
2. If you are picking up mid-thread from the other surface, read the newest `~/.claude/plans/HANDOFF-*.md` when one exists (narrative); otherwise **`git log origin/main -5`** is enough.

### Ship discipline (non-negotiable)

1. **Production truth is `origin/main`.** Finished work must land on `main` and be pushed in the same session (resolve rebase/stash conflicts yourself). Do not end with valued work only on a local branch/worktree unless it is recorded in `docs/plans/CROSS_AGENT_HANDOFF.md`. Network failure is the only excuse for “not live yet” — say that explicitly.
2. **Production follows Git.** Pushing `main` triggers Vercel production when the diff affects the Next app; “shipped” means remote `main` is updated and, when app code changed, the production deploy is **READY** (see `.cursor/rules/deploy-verify-before-done.mdc`). Docs/skills/changelog-only pushes are skipped by `scripts/vercel-ignore-build.mjs` (`vercel.json` → `ignoreCommand`).
3. **No hanging migrations.** New files under `supabase/migrations/` are not real until they run on **hosted** Supabase. Apply them in the **same delivery effort** as the code that needs them — never “commit now, migrate later” (`.cursor/rules/supabase-migrations-auto.mdc`, `.cursor/rules/production-parity.mdc`).
4. **Default on `main`; worktrees allowed with anti-strand rules.** Day-to-day edits stay on `main` in the primary checkout. Use linked worktrees for parallel agents, long experiments, or cloud isolation — never as a silent parking lot. Do not open PRs for routine work. See **Worktrees** below.

### Cost-aware push (main + worktrees)

July 2026 Pro spend was dominated by **Build CPU Minutes**, not traffic. Change *when* and *what* you push:

1. **Runtime changes** (`app/`, `components/`, `lib/`, `public/` used by the app, `package.json` / lockfile, `next.config.*`, `vercel.json`, `supabase/migrations/`) → finish the task, **one commit on `main`**, `NODE_OPTIONS=--max-old-space-size=8192 npm run push`, then `npm run deploy:verify` when the user-facing app changed.
2. **Docs / skills / rules / plans / handoffs only** → **batch into one commit**, then push once. Local `npm run push` already skips `next build` for non-buildable diffs; Vercel skips the remote build via `ignoreCommand`. Do not drip many docs commits that each burn local `ci:gates`.
3. **Do not push mid-thought.** Commit locally while iterating if you need a restore point; push when the unit of work is coherent.
4. **Ship class (fleet / loop):** same-category bot findings share one isolated verify + one production deploy. `loop-brief` prints the class. Do not run `npm run push` after each finding.
5. **R-221 — do not poll GitHub Actions.** One `ci:gates` per ship. After a green local stamp + push, stop. Do not `gh run view` in a loop. Do not rematch `origin/main` unless GitHub says CONFLICTING. Live-DB int tests are nightly (`test:int`), not a reason to sit idle.
6. **Release / changelog:** GitHub Releases carry the notes. Do not recreate a `chore: update changelog` commit on `main` — that path burned hundreds of full production builds.
7. **Worktree branches:** keep them **local** until merge time. Pushing `wt/*` to `origin` creates Vercel **preview** builds (extra Build CPU) unless previews are disabled in the project dashboard. Prefer merge → push `main` only.

### Worktrees (allowed — design against stranded work)

**When to stay on `main`:** single-agent bugfix, small feature, docs, anything that should be production within the hour.

**When to use a worktree:** two agents editing disjoint areas; a long experiment that would block `main`; Cursor ↔ Claude Code isolation; cloud agent checkouts.

**Anti-strand rules (mandatory):**

1. Branch name: `wt/<topic>-YYYYMMDD` (or harness names like `claude/…` — still merge or handoff before stop).
2. Path: sibling dir such as `../RyanRealty-wt-<topic>` — not nested inside the primary tree.
3. Session end: **merge/rebase into `main` + `npm run push`**, **or** write branch + absolute path + next step into `docs/plans/CROSS_AGENT_HANDOFF.md` Current block (and push that handoff on `main`).
4. Cleanup when merged: delete branch, `git worktree remove <path>`, `git worktree prune`. Run `node scripts/worktree-hygiene.mjs` at session start/end.
5. Never leave the only copy of valued commits in an unpushed worktree with no handoff line.

### What the other environment should read

| Layer | Source |
|-------|--------|
| What actually shipped | `git log origin/main` |
| Backlog / next task | `npx tsx scripts/loop-brief.ts` (work graph). `task-registry.json` / `orchestrate.ts` are complete (49/49) — do not pick work from them. |
| Optional handoff notes | `~/.claude/plans/HANDOFF-*.md` — add or update when switching tools with context the repo does not carry |
| **Cross-agent continuity (required when switching)** | **`docs/plans/CROSS_AGENT_HANDOFF.md`** — update the **Current** table before you stop or when Matt moves to the other tool. The other agent must **read it after `git pull`** before deep work. |
| **Grok Bot / Grok Build fleet** | **`docs/GROK_BOT_BRAIN.md`** — index. Company dump is `docs/GROK_BOT_COMPANY.md`. Do not paste either into a mega system prompt. |
| **Global skill index (Cursor + Claude)** | **`~/.claude/GLOBAL_SKILLS_REGISTRY.md`** — full path list of every `SKILL.md` on this machine (plugins, repo, TC, Cowork notes). **Git mirror:** `docs/plans/GLOBAL_SKILLS_REGISTRY.md`. **Cursor stub:** `~/.cursor/GLOBAL_SKILLS_REGISTRY.md`. |
| **Database reference (required before ANY SQL or market-report work)** | **[`docs/DATABASE_FOR_AI_AGENTS.md`](docs/DATABASE_FOR_AI_AGENTS.md)** — every table grouped by purpose, the cache model (`market_pulse_live` 10-min freshness, `market_stats_cache` 6-hour freshness), 14 resort communities + 14 Bend neighborhoods + city/region levels, the `listings` 800-field reality with mixed-case quoting rules, methodology versioning, slug formats. Source-of-truth registry: **[`data/resort-communities.json`](data/resort-communities.json)**. Don't aggregate raw `listings` for market reports — use the cache. |

**Cursor:** `.cursor/rules/` as usual. **Claude Code:** `CLAUDE.md` in this repo mirrors ship discipline; stay aligned with this section.

### Cross-agent handoff (mandatory when work spans tools)

1. **Push `main` first** (nothing handoff-worthy should be unpushed).
2. Open **`docs/plans/CROSS_AGENT_HANDOFF.md`** and replace the **Current** block: surface, time, commit SHA, what finished, what is next, blockers, which **`SKILL.md` files you actually read**.
3. Optionally also write narrative under **`~/.claude/plans/HANDOFF-*.md`** for Claude Desktop-only context (paths on disk, local-only experiments)—still assume the other agent only **pulls git** and reads **`CROSS_AGENT_HANDOFF.md`**.

### Skills (load before substantive work)

If a workspace **skill** might apply—even slightly—**read its `SKILL.md` first** (use the Read tool on the full path), then follow it. Do not improvise domain workflows (Supabase, deploy, Oregon brokerage, SkySlope, video skills, etc.) without loading the matching skill.

**Where to look**

- **Master index:** `~/.claude/GLOBAL_SKILLS_REGISTRY.md` or **`docs/plans/GLOBAL_SKILLS_REGISTRY.md`** (same content) — scan here first so you do not miss a plugin or TC-only skill.
- **This repo:** `.cursor/skills/**/SKILL.md` (e.g. Oregon OREF, OREA PB, SkySlope, professional Word, etc.)
- **Cursor-bundled / plugin skills:** paths under `~/.cursor/plugins/.../skills/**/SKILL.md` when the task matches their description (Next.js, Vercel, Supabase, TDD, debugging, etc.)
- **Video:** no producer `SKILL.md` remains. Rules live in `CLAUDE.md` §4. Caption modules only: `video_production_skills/captions/canonical/`.
- **Publishing trigger:** if Matt says "go ahead and publish it" after approving content, load `automation_skills/automation/publish/SKILL.md` (and know the live path is `/api/cron/publisher-sweep` → `/api/social/publish`)
- **Cowork-only skills** (e.g. mounted **docx** under `mnt/.claude/skills/`): see section **E** in the global registry; copy into `~/.claude/skills/` if you need the same skill in Claude Code CLI.
- **Marketing, advertising, paid social, Meta or Facebook or Instagram ads, lead generation, seller acquisition, CPL or CAPI, weekly optimization packets, `agent_insights` marketing rows:** Read **`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`** first (canonical end-to-end system map). For **how each path creates a lead** (webhooks, forms, dedup, sinks), read **`docs/MARKETING_LEAD_FLOW.md`**. Then **`docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md`** for launch checklist and budgets. For the recurring optimization routine load **`.cursor/skills/facebook-seller-growth/SKILL.md`** (and append learnings to **`docs/marketing/facebook-seller-growth-LEARNINGS.md`**). Cursor surfaces **`.cursor/rules/marketing-advertising-workflow.mdc`** when the task matches these topics.

**Heuristic:** Task mentions migrations → read Supabase skill; task mentions ship → read deploy / verification skills; task mentions rules → read `create-rule` skill before authoring rules. When unsure, grep `SKILL.md` titles or ask once; prefer loading an extra skill over skipping.

---

## Quick Start

```bash
# See what the work graph wants next
npx tsx scripts/loop-brief.ts
```

## Sync Status Handoff (Mandatory for sync questions)

When a user asks about sync/backfill status, run this first:

```bash
node scripts/sync-status-report.mjs --json
```

Then use:

- `docs/SYNC_HANDOFF_PLAYBOOK.md` for decision flow and command options
- `/admin/sync` for visual confirmation

### Natural language trigger phrases (treat as equivalent)

If the user says any variation of these, the agent MUST execute the sync-status flow above before asking follow-ups:

- "what's the sync like"
- "what's up with the sync"
- "what is sync status"
- "where are we at on sync"
- "where are we at with the sync"
- "research sync procedures"
- "research sync status"
- "tell me what options I have"
- "what can I run right now"
- "what should I run next"
- "start sync"

Required response format for these prompts:
1. Current snapshot (key counts + cursor state)
2. **Active listing freshness:** Summarize `activeListingFreshness` from the same JSON (`lastDeltaSuccessAt`, `minutesSinceLastDeltaSuccess`, `deltaHealth`, `counts.deltaEligibleListings`, `activityEventsLast24h.byEventType`, and the `pipeline` object). This is how live inventory stays current via `sync-delta`.
3. **Strict verification:** Always summarize the `strictVerification` object from the same JSON report (`counts` for global and terminal-only backlog, `adminDashboardForLiveDeltas` for live activity on `/admin/sync`). This is distinct from terminal finalization remaining (`totals.terminal.remaining`).
4. Full `listingYearsBreakdown` from `node scripts/sync-status-report.mjs --json` (coalesce ListDate or OnMarketDate cohorts), unless the user asks for a short summary only. Also reference `yearsFinalization` or `listingYearsOnMarketBreakdown` (OnMarketDate only)
5. Year finalization status from `yearsFinalization` (DB on-market stats; see `yearsFinalizationNote` in JSON; year-by-year Spark chunk sync was removed)
6. Health callout (moving, stalled, or rate-limited)
7. Top 2-3 commands to run now (from `docs/SYNC_HANDOFF_PLAYBOOK.md`)
8. Wait for user selection ("run option 1/2/3")

For "start sync", do not ask follow-up questions first:
1. Execute: `curl -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/cron/start-sync"`
2. Confirm blockers cleared (`paused=false`, `abort_requested=false`, `cron_enabled=true`)
3. Confirm lane kick responses (`fullChunk`, `terminalChunk`, `deltaChunk`)
4. Report "sync running" confirmation with latest cursor timestamps

### Exact trigger: "Give me a sync status"

When the user says exactly or approximately "Give me a sync status", agents MUST return a detailed operational report, not a short summary.

Required details:
1. Current totals (listings, history rows, terminal remaining, finalized, verified full)
2. Full **`activeListingFreshness`** block (delta cadence, last success time, delta-eligible inventory count, 24h `activity_events` mix, pipeline from live updates through terminal to strict backlog)
3. Full **`strictVerification`** block from the same JSON (all-listing vs terminal-only strict backlog, verified full counts, `adminDashboardForLiveDeltas`; clarify that terminal strict backlog is what `sync-verify-full-history` drains)
4. Complete `listingYearsBreakdown` and, for year-lane alignment, `listingYearsOnMarketBreakdown` or `yearsFinalization` from the status report JSON
5. Year finalization status (`yearsFinalization` finalized/total/remaining; year lane retired so matrix job progress fields are not live)
6. What is running right now (cursor phase, updated timestamps, paused/abort flags if available)
7. Latest lane activity (cursors, delta freshness, `strictVerification.runTelemetry` recent runs)
8. Approximate time to parity (ETA) with a clearly stated method and assumptions
9. 2-3 concrete run options the user can choose immediately

---

## Development Environment

| Tool | Details |
|------|---------|
| Runtime | Node 20, npm |
| Framework | Next.js 16.1.6, React 19, TypeScript 5 |
| Database | Supabase (PostgreSQL), migrations in `supabase/migrations/` |
| Styling | Tailwind v4, shadcn/ui components only |
| Testing | Vitest (unit), Playwright (E2E + visual), Lighthouse CI (perf), pa11y-ci (a11y) |
| Deployment | Vercel |
| CRM | In-house (`public.crm_people`). |
| Data Feed | Spark/MLS API |

### Running Locally

```bash
npm install                  # Install dependencies
npm run dev:unix             # Start dev server (Linux/macOS)
npm run build                # Production build verification
npm run test                 # Run unit tests
npm run test:e2e             # Run E2E tests (requires build first)
npm run test:e2e:ui          # Open Playwright UI mode
npm run lint                 # Run ESLint
npm run lint:design-tokens   # Check for design system violations
npm run lint:seo-routes      # Check SEO route authoring
npm run docs:check           # Check documentation freshness
```

---

## How to Pick Up Work

1. Run `npx tsx scripts/loop-brief.ts` and take the printed ship class (or the named task Matt gave you)
2. Discover the live path from `app/` + `vercel.json`, not from ENTERPRISE_MAP inventories
3. Do not start `orchestrate.ts` or walk `docs/SITE_SPEC.md` checkboxes

### Priority Order

Tasks are prioritized by:
1. Priority field: `high` > `medium` > `low`
2. ID order (earlier phases before later, lower IDs first)
3. Dependency chain (blocked tasks are excluded)

---

## How to Execute

### Rules to Follow

All rules in `.cursor/rules/` are mandatory. Key rules:

| Rule File | What It Covers |
|-----------|---------------|
| `design-system.mdc` | shadcn/ui components only, semantic color tokens only |
| `server-actions.mdc` | `'use server'` header, return `{ data, error }` never throw |
| `error-handling.mdc` | Server: return errors. Client: use sonner toasts. No `alert()` |
| `auth-patterns.mdc` | Use `getSession()`, `normalizeAvatarUrl()`, gate routes at top |
| `supabase-data-layer.mdc` | Use cached stats, correct client for context, never `select(*)` |
| `git-commit.mdc` | Conventional commits: `feat:`, `fix:`, `chore:`, etc. |
| `sliders-no-scrollbars.mdc` | Arrow navigation, no visible scrollbars on carousels |
| `master-plan-protocol.mdc` | File ownership matrix enforcement |

### Design System (Zero Exceptions)

- **Components**: Only use shadcn/ui from `@/components/ui/`. See `CLAUDE.md` for the full mapping.
- **Colors**: Only semantic tokens (`bg-primary`, `text-foreground`, `border-border`). No hex, no `bg-white`, no `bg-gray-*`.
- **Utilities**: Use `cn()` from `@/lib/utils` for conditional classes.
- **Fonts**: Geist Sans (`font-sans`) and Geist Mono (`font-mono`) only.

### Server Actions

```ts
'use server'

export async function doThing(): Promise<{ data: Result | null; error: string | null }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('table').select('col1, col2').eq('id', id)
    if (error) return { data: null, error: error.message }
    return { data, error: null }
  } catch (err) {
    console.error('[doThing]', err)
    return { data: null, error: 'Something went wrong' }
  }
}
```

### File Ownership

The ownership matrix in `docs/plans/master-plan.md` is enforced. Check it before modifying files owned by another workstream:

| Owner | Key Files |
|-------|-----------|
| Reporting | `app/actions/market-stats.ts`, `components/reports/*`, `app/api/cron/sync-full/route.ts` |
| Engagement | `app/search/[...slug]/page.tsx`, `app/page.tsx`, `app/listing/[listingKey]/page.tsx` |
| Monetization | `components/AdUnit.tsx`, `app/layout.tsx` (banner), `app/guides/*`, `app/sitemap.ts` |
| Admin | `app/admin/*` |
| Shared | `lib/crm/send-event.ts`, `components/ShareButton.tsx` |

---

## Quality Gates

Run these before committing:

```bash
# Minimum (always)
npm run test
npm run build

# If you changed UI components
npm run lint:design-tokens

# If you changed routes or pages
npm run lint:seo-routes

# Full gate (recommended)
npm run quality:full
```

### Pre-commit Hook

Runs `npm test` automatically. If tests fail, the commit is blocked.

### Pre-push Hook

Runs `npm run quality:local:strict` (design tokens + test + build). Set `SKIP_LOCAL_GATES=1` to bypass (sparingly).

### CI Pipeline (GitHub Actions)

On PR to `main`:
1. `npm run lint` — ESLint
2. `npm run lint:seo-routes` — SEO route authoring checks
3. `npm run ci:design-tokens` — Design token compliance
4. `npm run test` — Vitest unit tests
5. `npm run build` — Production build
6. Build health metrics recorded
7. `npm run ci:lighthouse` — Lighthouse performance/a11y/SEO scores
8. `npm run ci:a11y` — pa11y accessibility audit
9. Bundle size report posted as PR comment
10. **E2E tests** — Playwright critical flow tests
11. **Visual regression** — Screenshot comparison against baselines
12. **Security scan** — npm audit + secret leak detection
13. **PR auto-labeling** — Labels by area and type
14. **PR metadata labeling** — Labels by area and change type

On merge to `main`:
15. **Automated release** — Changelog generated, version tag created, GitHub Release published
16. **Post-deploy smoke tests** — Key pages tested after Vercel deploy
17. **Preview deploy testing** — Smoke tests on Vercel preview URLs

Scheduled:
18. **Dependency updates** — GHA `dependency-updates.yml` Monday 09:00 UTC
19. **Security scan** — GHA `security.yml` Tuesday 08:00 UTC
20. **Marketing optimization report** — Vercel `/api/cron/marketing-optimization-report` Monday 06:30 UTC (not a GHA “optimization loop”)
21. **Stale branch cleanup** — GHA `cleanup-branches.yml` 1st of month
22. **Saved search alerts** — Vercel `/api/cron/saved-search-alerts` **hourly**, not daily 2pm GHA
23. **Market report** — Vercel `/api/cron/market-report` **Sunday** 14:00 UTC, not Saturday GHA

---

## How to Validate

```bash
npm run ci:gates
npm test
```

If UI or routes changed, the matching `ci:*` members are already in `ci:gates`. Do not invent a second orchestrator validate step.

---

## How to Complete

```bash
NODE_OPTIONS=--max-old-space-size=8192 npm run push   # from main
```

`orchestrate.ts complete` is retired. The work graph updates from loop/sentinel, not from that CLI.

## CRITICAL: Ship on `main` (worktrees are temporary)

**Production deploys from `main` only.** Routine work: commit on `main` and `npm run push`. Worktrees/branches are fine for isolation — merge them before you stop, or hand them off in `CROSS_AGENT_HANDOFF.md`. Do not open PRs for routine work. Do not leave unfinished valued work only on a local branch.

```bash
# DEFAULT
NODE_OPTIONS=--max-old-space-size=8192 npm run push   # from main

# WORKTREE (isolation) — then merge back
git worktree add -b wt/crm-mobile-20260726 ../RyanRealty-wt-crm-mobile main
# …work in the other checkout…
# on main: git merge wt/crm-mobile-20260726 && npm run push
# git worktree remove ../RyanRealty-wt-crm-mobile && git branch -d wt/crm-mobile-20260726

# WRONG — strand work
# push a long-lived feature branch and walk away with no handoff
# open a PR for routine agent work and forget it
```

## Production parity (code + database + Vercel)

**https://ryanrealty.vercel.app** reflects “everything current” only when **`main` is on Vercel production** and **hosted Supabase** has **all migrations applied** that the shipped code needs. SQL under `supabase/migrations/` is not live until it runs against the production database. See `.cursor/rules/production-parity.mdc` and `.cursor/rules/supabase-migrations-auto.mdc`.

---

## Adding New Work

Put it on the work graph (`loop_work_nodes` / `/admin/loop`), not `orchestrate.ts add`. If Matt named the outcome in chat, that is the ticket.

---

## Key Architecture Decisions

1. **Market stats**: Always use `getCachedStats()` and `getLiveMarketPulse()` from `app/actions/market-stats.ts`. Never compute stats on the fly. Stats use `ClosePrice` for sold metrics, `percentile_cont` for true medians, and filter on `StandardStatus` for closed sales only. See `.cursor/rules/data-architecture.mdc`.
2. **Listing URL**: Canonical form is generated by `listingDetailPath()` from `lib/slug.ts`. Target format uses MLS number (ListNumber) + address slug: `/homes-for-sale/{city}/[{neighborhood}/]{community}/{address-slug}-{mlsNumber}`. When community is unavailable: `/homes-for-sale/{city}/{address-slug}-{mlsNumber}`. Fallback when location data is incomplete: `/homes-for-sale/listing/{mlsNumber}`. Old ListingKey-based URLs 301-redirect to canonical. Legacy `/listings` browse URLs redirect to `/homes-for-sale`. See `.cursor/rules/data-architecture.mdc` for the full URL specification.
3. **Team URL**: Canonical form is `/team` and `/team/{slug}`. The `/agents/` route redirects.
4. **Lead capture**: StickyMobileCTA and SiteLeadCaptureBanner must not both be visible simultaneously.
5. **Ad placement order**: existing sections → AreaMarketContext → AdUnit → Similar Listings → ActivityFeedSlider → RecentlySoldRow → Sidebar ad below CTA.
6. **Filter page links**: Browse-by UI links to `/search/{city}/{filter}` routes, not query-param URLs.
7. **Geographic hierarchy**: City > optional Neighborhood > Community. "Community" = MLS SubdivisionName. Neighborhoods are higher-level areas that may contain multiple communities. Not every city has defined neighborhoods. The system gracefully handles both cases.
8. **geo_slug format**: Community-level cache keys use `citySlug:communitySlug` (colon-separated) via `subdivisionEntityKey()`. Never use hyphen-separated format for cache keys.
9. **Data architecture rule**: See `.cursor/rules/data-architecture.mdc` for stats computation, JSONB strategy, query patterns, caching, performance non-negotiables, and scalability design.

---

## Database Migrations

```bash
# Create a new migration
npm run db:migration <name>

# Push migrations to Supabase
npm run db:push

# Check for migration drift (pre-push hook)
npm run db:guard
```

Naming: `YYYYMMDDHHMMSS_description_snake_case.sql`
Always idempotent: use `IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT DO NOTHING`.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm run build` fails with type errors | Check for missing imports, incorrect types. Run `npx tsc --noEmit` for detailed errors. |
| Design token lint fails | Replace hardcoded colors with semantic tokens. See `CLAUDE.md` for the mapping. |
| Pre-push hook fails | Run `npm run quality:local:strict` to see what's failing. Fix or use `SKIP_LOCAL_GATES=1`. |
| Supabase migration drift | Run `npm run db:push` to sync migrations, or `SKIP_DB_GUARD=1` to bypass check. |
| Tests fail on CI but pass locally | Ensure env vars are set in GitHub Secrets. Check if test depends on Supabase connection. |

---

## Reference

- **Next work**: `npx tsx scripts/loop-brief.ts` + `docs/plans/CROSS_AGENT_HANDOFF.md` Current
- **Runtime photograph**: `docs/audits/RUNTIME_CROSSWALK_2026-08-18.md`
- **DAL**: `docs/DATA_ACCESS_LAYER.md` + `docs/DATABASE_FOR_AI_AGENTS.md`
- **Design System**: `CLAUDE.md` + `design_system/ryan-realty/`
- **Cursor Rules**: `.cursor/rules/`
- Fossils (do not execute): `docs/plans/task-registry.json`, `docs/plans/phase-N-brief.md` (deleted), `docs/EXECUTION_PLAN.md`, `docs/SITE_SPEC.md`
