# Agent Protocol — Ryan Realty

This document tells AI coding agents (Cursor, Copilot, Windsurf, etc.) how to autonomously pick up, execute, validate, and complete development tasks on this project.

## Execution (non-negotiable)

Run every needed command yourself (`npm run …`, scripts, git, deploy checks, SkySlope generators). **Never** tell the owner to run something in a terminal. The only exception is when something cannot run without secrets or access you do not have, in which case state exactly what is missing.

---

## Claude Code ↔ Cursor (one pipeline)

Matt alternates between **Claude Code** and **Cursor**. Both are the same repo and the same bar: **no divergent rules, no mystery state in the other tool.**

### Start of every session (any tool)

1. `git fetch origin && git pull --rebase origin main` so work always sits on current remote `main`.
2. If you are picking up mid-thread from the other surface, read the newest `~/.claude/plans/HANDOFF-*.md` when one exists (narrative); otherwise **`git log origin/main -5`** is enough.

### Ship discipline (non-negotiable)

1. **No saved-but-unpushed work on `main`.** If you commit, you **push to `origin/main` in the same session** (resolve rebase/stash conflicts yourself). Do not end with `main` ahead of `origin/main` unless the network failed — and then say that explicitly; do not call the work “live.”
2. **Production follows Git.** Pushing `main` triggers Vercel production; “shipped” means remote `main` is updated and, when app code changed, the production deploy is **READY** (see `.cursor/rules/deploy-verify-before-done.mdc`).
3. **No hanging migrations.** New files under `supabase/migrations/` are not real until they run on **hosted** Supabase. Apply them in the **same delivery effort** as the code that needs them — never “commit now, migrate later” (`.cursor/rules/supabase-migrations-auto.mdc`, `.cursor/rules/production-parity.mdc`).
4. **Trunk only — `main` and nothing else.** Do not create local or remote feature branches, release branches, or PR flows for routine work. Do not use **`git worktree`** on this repo (no second checkouts, no parallel trees on disk). One working copy, one branch: **`main`**, always tracking **`origin/main`** after pull/push. If a stray branch or worktree appears, delete it and return to a single clean `main` before doing more work.

### What the other environment should read

| Layer | Source |
|-------|--------|
| What actually shipped | `git log origin/main` |
| Backlog / next task | `docs/plans/task-registry.json` and `npx tsx scripts/orchestrate.ts next` |
| Optional handoff notes | `~/.claude/plans/HANDOFF-*.md` — add or update when switching tools with context the repo does not carry |
| **Cross-agent continuity (required when switching)** | **`docs/plans/CROSS_AGENT_HANDOFF.md`** — update the **Current** table before you stop or when Matt moves to the other tool. The other agent must **read it after `git pull`** before deep work. |
| **Global skill index (Cursor + Claude)** | **`~/.claude/GLOBAL_SKILLS_REGISTRY.md`** — full path list of every `SKILL.md` on this machine (plugins, repo, TC, Cowork notes). **Git mirror:** `docs/plans/GLOBAL_SKILLS_REGISTRY.md`. **Cursor stub:** `~/.cursor/GLOBAL_SKILLS_REGISTRY.md`. |

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
- **Repo `video_production_skills/**/SKILL.md`** when the task is video production
- **Cowork-only skills** (e.g. mounted **docx** under `mnt/.claude/skills/`): see section **E** in the global registry; copy into `~/.claude/skills/` if you need the same skill in Claude Code CLI.

**Heuristic:** Task mentions migrations → read Supabase skill; task mentions ship → read deploy / verification skills; task mentions rules → read `create-rule` skill before authoring rules. When unsure, grep `SKILL.md` titles or ask once; prefer loading an extra skill over skipping.

---

## Quick Start

```bash
# See what needs doing
npx tsx scripts/orchestrate.ts status

# Get the next task with full specification
npx tsx scripts/orchestrate.ts next

# Start working on a task
npx tsx scripts/orchestrate.ts start <taskId>

# When done, validate and complete
npx tsx scripts/orchestrate.ts validate <taskId>
npx tsx scripts/orchestrate.ts complete <taskId>
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
| CRM | Follow Up Boss |
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

1. Run `npx tsx scripts/orchestrate.ts next` to get the next prioritized, unblocked task
2. Read the full task specification output carefully
3. Check the file ownership matrix in `docs/plans/master-plan.md`
4. Run `npx tsx scripts/orchestrate.ts start <taskId>` to mark it in-progress

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
| Shared | `lib/followupboss.ts`, `components/ShareButton.tsx` |

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
18. **Dependency updates** — Weekly (Monday 9am UTC)
19. **Security scan** — Weekly (Tuesday 8am UTC)
20. **Optimization loop** — Weekly (Monday 6am UTC)
21. **Stale branch cleanup** — Monthly (1st of month)
22. **Saved search alerts** — Daily (2pm UTC)
23. **Market report** — Weekly Saturday (2pm UTC)

---

## How to Validate

After implementing a task:

```bash
npx tsx scripts/orchestrate.ts validate <taskId>
```

This runs:
- File existence checks for the task's listed files
- `npm run build`
- `npm run test`
- `npm run lint:design-tokens` (if UI files changed)
- `npm run lint:seo-routes` (if page files changed)

All checks must pass before marking a task complete.

---

## How to Complete

```bash
# After validation passes
npx tsx scripts/orchestrate.ts complete <taskId>

# Commit with conventional format and push to main
git add -A
git commit -m "feat: <short description of what was done>"
git push origin main
```

## CRITICAL: Push to Main (trunk only)

**Always push directly to `main`.** Do NOT create feature branches. Do NOT create pull requests. Do NOT add **`git worktree`** checkouts for this project. Push to `main` and let CI validate. The orchestrator and task registry handle coordination — extra branches or worktrees are forbidden overhead and hide state from the other tool.

```bash
# CORRECT
git push origin main

# WRONG — do not do this
git checkout -b feat/some-branch
git push origin feat/some-branch
gh pr create
git worktree add ../RyanRealty-side feature/foo
```

## Production parity (code + database + Vercel)

**https://ryanrealty.vercel.app** reflects “everything current” only when **`main` is on Vercel production** and **hosted Supabase** has **all migrations applied** that the shipped code needs. SQL under `supabase/migrations/` is not live until it runs against the production database. See `.cursor/rules/production-parity.mdc` and `.cursor/rules/supabase-migrations-auto.mdc`.

The orchestrator automatically:
- Updates the task status in the registry
- Checks if the parent phase is now fully complete
- Updates phase status if all tasks are done

---

## Adding New Work

```bash
# Add a bug
npx tsx scripts/orchestrate.ts add '{"title":"Fix broken avatar on mobile","priority":"high","category":"bug","owner":"engagement","files":["components/Avatar.tsx"],"acceptanceCriteria":["Avatar renders on mobile viewport","No layout shift"]}'

# Add a feature request
npx tsx scripts/orchestrate.ts add '{"title":"Add dark mode toggle","priority":"low","category":"feature","owner":"shared"}'

# Add tech debt
npx tsx scripts/orchestrate.ts add '{"title":"Refactor sync pipeline to use streams","priority":"medium","category":"tech-debt","owner":"reporting"}'
```

---

## Generating Reports

```bash
npx tsx scripts/orchestrate.ts report
```

Generates `docs/plans/continuous-improvement.md` with:
- Overall progress (complete/in-progress/open/blocked)
- Phase-by-phase progress with percentages
- Work breakdown by owner
- Current priorities sorted by urgency
- Blocked task list with reasons
- Backlog by category
- Recommended next actions

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

- **Task Registry**: `docs/plans/task-registry.json` — all tasks and their status
- **Master Plan**: `docs/plans/master-plan.md` — phases, ownership matrix, conflict resolutions
- **Phase Briefs**: `docs/plans/phase-N-brief.md` — detailed specs per phase
- **Features**: `docs/FEATURES.md` — what's currently implemented
- **Design System**: `CLAUDE.md` — component mapping and color tokens
- **Cursor Rules**: `.cursor/rules/` — enforced coding standards
- **Continuous Improvement**: `docs/plans/continuous-improvement.md` — auto-generated progress report
