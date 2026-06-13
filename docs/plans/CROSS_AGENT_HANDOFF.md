# Cross-Agent Handoff — Current

> **⮕ ACTIVE THREAD (2026-06-13): Homepage rebuild + Brand Voice rework.**
> See [`HANDOFF-homepage-voice-2026-06-13.md`](./HANDOFF-homepage-voice-2026-06-13.md).
> Brand voice was fully reworked into The Five Laws + hard-coded into the CI gate
> (DONE, staged). Homepage is UNRESOLVED — Matt rejected v3/Linear/cinematic, the
> 3D tiles are OUT. Everything staged, draft-first, nothing committed. Read that
> doc before touching the homepage or any public copy.

> **⮕ ACTIVE THREAD (2026-06-13): CMA for Laurie McAdam + valuation-form upgrade + Twilio SMS block.**
> See [`HANDOFF-cma-form-twilio-2026-06-13.md`](./HANDOFF-cma-form-twilio-2026-06-13.md).
> Laurie's CMA (62285 Deer Trail) is a DRAFT awaiting Matt's "ship it" (action row
> `72c4ee55` = ready). Seller valuation form got an optional "About your home" section
> wired into CMA logic (staged, tested). Twilio outbound SMS is BLOCKED on A2P review
> (~2-3 wk, ticket #27497858) — see memory `reference_twilio_a2p_status`. Nothing committed.

**Written:** 2026-06-11 by Cursor (Matt switching off `/loop`, wants a manual starting point). **Branch:** `main`, synced with `origin/main`. **HEAD:** `3a95af7`. **Production:** READY (`npm run deploy:verify` 2026-06-11).

*Convention: the other agent can't read the chat — anything not in `git` + this file + `task-registry.json` + `.auto-memory/` + `~/.claude/projects/-Users-matthewryan-RyanRealty/memory/MEMORY.md` is invisible. Keep this "Current" block accurate; delete stale bullets.*

Pull `main`, read this first, then `docs/DEVELOPMENT_PROCESS.md` (THE LOOP process, but **loops are stopped** — see §0). User: Matt Ryan, principal broker. **North star: 18 seller leads/month.**

---

## 0. Operating mode change (2026-06-11)

**Matt stopped `/loop`.** The five autonomous loop sessions (growth, experience-rollout, tc-builder, crm-e2e, fb-ads) are **idle**. Work resumes as **explicit one-shot sessions** you start with a plain prompt — not self-scheduling wakeups.

| Old trigger | Skill / ledger | Status | Resume with |
|---|---|---|---|
| `/loop /growth-loop` | `.claude/skills/growth-loop/SKILL.md` | **STOPPED** | "Run one growth iteration" or pick a task from §3 |
| `/loop /experience-rollout` | `.claude/skills/experience-rollout/SKILL.md` | **STOPPED** | "Continue experience rollout" or §3 sweep review |
| `/loop /tc-builder` | `.claude/skills/tc-builder/SKILL.md` | **STOPPED** (rung 12 shipped) | "Build TC rung 3" (form field-mapper) |
| `/loop /crm-e2e` | `.claude/skills/crm-e2e/SKILL.md` | **STOPPED** (green last run) | "Verify the CRM" |
| FB ads loop | `.auto-memory/fb-ads-loop-state.json` (iter 14) | **STOPPED** | "Run facebook-seller-growth weekly" |

**Standing directive (still valid):** finish the site-consistency waves, then brain (#19) and hero (#20). Scope expanded 2026-06-10: **full-site unification sweep** (one language everywhere) replaces serial family-by-family rollout — see `docs/EXPERIENCE_SYSTEM.md` §SCOPE CHANGE.

---

## 1. What's live on `main` (since the stale 2026-06-09 handoff)

| Commit | What |
|---|---|
| `832c9cca` | **P0-1** search map: OverlayView pills without Map ID, no degraded dialog |
| `3398ec91` | **P0-4/6** blog local heroes + mobile horizontal scroll fix |
| `b49d85b9` | **P0-3** Central Oregon service-area guard on tile/feed DALs |
| `27dd5a38` | **P0-5** hydration-race fixes (AdSense + ShareButton) |
| `c1c7e7bb` | **TC rung 12** `/admin/financials` P&L |
| (prior) | **TC rungs 1, 2, 11, 15** docs upload, smart required-docs, commissions, deal team |
| `0bc21faa` / `c1b88024` | **CRM** inbox dedupe + assessor send guard |

**P0 audit: DONE and prod-verified** (2026-06-11, Playwright on ryan-realty.com). Map 58/58 pills, blog 0 Unsplash, mobile scrollWidth=390 on price-drops + homes-for-sale.

---

## 2. Draft in working tree (NOT on `main` — do not `git add -A`)

~91 modified files. **Three parallel builders left uncommitted work.** Treat as one **sweep review set**, not separate ships.

| Workstream | Key files | State |
|---|---|---|
| **Wave 3 — site-wide language** | ~50 `app/**/page.tsx`, `components/site/PageBreadcrumb.tsx`, `scripts/check-breadcrumb.mjs` | Amboqia headings + canonical breadcrumbs across consumer pages |
| **Family 4 — cities** | `app/cities/page.tsx`, `app/cities/[slug]/page.tsx` | Rework built, awaiting review (`scratch/family4-rework/`) |
| **P0-5 / Hub — communities** | `app/communities/page.tsx`, `CommunityIndexBrowser.tsx` | Rebuild draft, awaiting review (`scratch/p05-communities-fix/`) |
| **Family 3 — preset depth** | search preset FAQ/intro (4 files per ledger) | Built, awaiting review (`scratch/family3-preset-depth/`) |
| **Homepage v6 Linear** | `design_system/ryan-realty/ui_kits/homepage-v6/` | Concept **LOCKED** (Matt 2026-06-11); production still v3 |

**Forbidden — never commit:** `app/api/cron/loop-health-check/route.ts`, seller LP pages, `data/asset-library/manifest.json`. Commit by **explicit pathspec only**.

---

## 3. Recommended starting point (pick ONE session)

Matt said stop looping. Start the next session with **one** of these — in suggested priority order:

### A. Sweep review (highest leverage, blocks everything else)

Matt reviews the unified system once on a representative set, then one coordinated ship:

1. Open mockups/screenshots: `scratch/family3-preset-depth/`, `scratch/family4-rework/`, `scratch/p05-communities-fix/`
2. Say **"ship the sweep"** or give per-family verdicts
3. Agent runs: `npm run build`, `npm run ci:gates`, pathspec commit, push, `deploy:verify`, desktop + mobile screenshots

**Prompt to paste:** *"I'm doing the one sweep review for site unification. Walk me through the representative pages with screenshots, then ship whatever I approve."*

### B. Wave 3 breadcrumbs + headings (class fix, shippable without full sweep)

If Matt wants incremental progress before the sweep:

**Prompt:** *"Ship Wave 3: PageBreadcrumb + Amboqia display headings. Run ci:gates, build, commit by pathspec, push, deploy verify."*

### C. Homepage v6 production build (after concept approval)

Mockup locked at `ui_kits/homepage-v6/`. Production `app/page.tsx` still rejected v3.

**Prompt:** *"Build homepage v6 Linear finish in React against the mockup. Draft-first — show me localhost screenshots before commit."*

### D. TC rung 3 — form field-mapper

Next ladder item per `docs/TC_SYSTEM.md`. DDL exists (`20260610020000_tc_forms_signing_v1.sql`).

**Prompt:** *"Build TC rung 3: OREF form field-mapper on tc_form_versions. Read tc-builder SKILL first."*

### E. CRM health check (quick, usually green)

**Prompt:** *"Verify the CRM end-to-end."* → runs `node scripts/crm-e2e-verify.mjs`

**Known external blockers (not code):** A2P SMS campaign not VERIFIED; 541.703.3095 port in FUB.

### F. Brain + hero (after waves)

Queued as tasks #19 / #20 in the old wave plan. Do not start until site unification ships or Matt explicitly reprioritizes.

---

## 4. Where Claude Code stores memory (read these, not chat)

| Layer | Path | Purpose |
|---|---|---|
| **This file** | `docs/plans/CROSS_AGENT_HANDOFF.md` | Current block — update before switching tools |
| **Experience ledger** | `docs/EXPERIENCE_SYSTEM.md` §Campaign + §Rollout | Who owns what family, P0 status, Matt verdicts |
| **TC ladder** | `docs/TC_SYSTEM.md` | Rung status, schema, invariants |
| **CRM blueprint** | `docs/CRM_REPLACEMENT_BLUEPRINT.md` | Cutover gate, FUB replacement |
| **Repo auto-memory** | `.auto-memory/*.md` + `fb-ads-loop-state.json` | Durable session notes |
| **Claude Code index** | `~/.claude/projects/-Users-matthewryan-RyanRealty/memory/MEMORY.md` | Links to all `feedback_*.md` / `project_*.md` |
| **Process canon** | `docs/DEVELOPMENT_PROCESS.md` | THE LOOP (process, not autonomous mode) |
| **Task registry** | `docs/plans/task-registry.json` + `npx tsx scripts/orchestrate.ts next` | Stale on waves — trust code + this file over registry status blocks |

---

## 5. Critical operating context (unchanged)

- **Gates not prose.** `npm run ci:gates` before every push.
- **Draft-first** for anything Matt sees (content, layout, consumer-visible). Explicit "ship it" before commit.
- **Single checkout `main`.** No feature branches, no worktrees.
- **Data accuracy §0.** Every stat traces to source before it ships.
- **Git hazards:** autostash unstages; commit by pathspec; clear `.git/index.lock` proactively.

---

## 6. Continue now

1. Matt picks **one prompt from §3** (A–F).
2. Agent reads the matching `SKILL.md` if one exists, then executes **one complete unit** (build → verify → draft or ship per approval).
3. Update **this file's Current block** + relevant ledger section before stopping.
4. Do **not** restart `/loop` or ScheduleWakeup unless Matt explicitly asks.
