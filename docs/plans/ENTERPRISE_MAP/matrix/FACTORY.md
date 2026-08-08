# Development factory matrix (FAC-001…017)

**Captured:** 2026-08-08T21:30Z · Sources: `inventories/E-github-workflows.txt`, `H-ci-scripts.txt`, `Z-inventory-meta.json`, `K-migration-count.txt`, `L-skills.txt`, `.husky/*`, `package.json`

| ID | Component | What it is here | Evidence notes (2026-08-08) | Efficiency / risk | Status |
|----|-----------|-----------------|----------------------------|-------------------|--------|
| FAC-001 | Git remote | RyanRealty/RyanRealty on GitHub | Production truth = `origin/main` per Agents.md | main = production truth | **VERIFIED** |
| FAC-002 | GitHub Actions | 10 workflows | **Exact list** (`inventories/E-github-workflows.txt`): `ci.yml`, `cleanup-branches.yml`, `dependency-updates.yml`, `e2e-nightly.yml`, `pr-labeler.yml`, `quality.yml`, `release.yml`, `resend-webhook-nightly.yml`, `security.yml`, `smoke-test.yml` | Overlap with local gates = Build cost; gaps = risk if only CI enforces | **VERIFIED list**; health per-run not probed |
| FAC-003 | Local hooks | husky pre-commit, pre-push, commit-msg | **pre-commit:** producer-guard + `ci:brand-voice` + `test:unit` only (int tests deferred). **pre-push:** marker check only (`rr-gates-marker`); heavy gates in `npm run push` / `push-with-gates.sh` to avoid SIGPIPE. **commit-msg:** draft-first for rendered video | quality gates on push path, not long-lived SSH hook | **VERIFIED** present |
| FAC-004 | npm scripts | ~389 total; ~270–271 `ci:*` | `Z-inventory-meta`: `H_scripts_total` **389**, `H_ci` **271**; `H-ci-scripts.txt` enumerates `ci:*` names | Discoverability / legacy surface large | **VERIFIED counts** |
| FAC-005 | Mechanical gates | `ci:gates` + domain gates + meta `ci:gates-wired` | `package.json` `ci:gates` chain authoritative; docs/MECHANICAL_GATES.md | Primary “only path” enforcer | **CANON** |
| FAC-006 | Vercel production | main deploys; vercel.json crons; ignoreCommand | Cron paths inventory **61** scheduled (`Z` C_vercel / C-crons-vercel-full); ignore via `scripts/vercel-ignore-build.mjs` | Build CPU minutes constrained (July 2026 Pro) | **VERIFIED** schedule count; deploy READY not re-probed this pass |
| FAC-007 | Vercel env | sync/merge scripts in repo | Local `.env.local` inventory **117** keys (`D-env-keys`); prod parity still critical | Parity local↔prod critical for BatchData/Meta/etc. | **SEED health** (parity not auto-diffed) |
| FAC-008 | Supabase hosted | project `dwvlophlbvvygjfxcrhm` | Live REST anchors: listings 594623, etc. (`M-live-db-counts.json`) | 461 migrations on disk (`K-migration-count.txt` / Z `K_mig` 461) | **VERIFIED** reachable |
| FAC-009 | Migrations discipline | `supabase/migrations` + `db:push` / `db:guard` | Count **461**; recent include beacon ClosePrice migration in git (hosted apply may lag) | F7 deliberately not in migrations (if still open) | **OPEN** hosted apply for new migrations |
| FAC-010 | Agent: Claude Code | Primary historical process author | Concurrent admin/inbox work possible; map SoR is repo | Sibling dirty-tree contention | **ACTIVE** subject (parallel OK with collision rules) |
| FAC-011 | Agent: Grok Build | Map close passes; memory enabled | This session: INT-001…037 + FAC evidence | Memory assist; map SoR is repo not chat | **ACTIVE** map work |
| FAC-012 | Project rules | Agents.md, Claude.md, .cursor/rules | Loaded into sessions; G44 process canon | Drift risk if rules not gates | **VERIFIED** present |
| FAC-013 | Skills corpus | SKILL.md inventory | `L-skills.txt`: **19** paths under `.claude/skills/` this inventory (repo-wide skills larger; global registry separate) | Process knowledge | **VERIFIED** L-list 19; broader corpus SEED |
| FAC-014 | Worktrees / multi-agent | worktree-hygiene; anti-strand rules | Agents.md worktree rules; `node scripts/worktree-hygiene.mjs` | Sibling contention real | **CANON** rules |
| FAC-015 | Grok memory | ~/.grok/memory + config | Not shared with Claude; CAP-033 external | Cross-agent handoff = `CROSS_AGENT_HANDOFF.md` | **ON** |
| FAC-016 | E2E / LHCI / a11y | `test:e2e`, `ci:lighthouse`, `ci:a11y` | Workflows: `e2e-nightly.yml`, quality/ci include gates | Costly; critical for money pages | **VERIFIED** scripts + workflows exist |
| FAC-017 | Deploy verify | `deploy:verify` → `scripts/check-vercel-deploy.mjs` | package.json script present; required after user-facing push | Required after user-facing push | **CANON** practice |

## Factory efficiency themes (cited)

- Reduce duplicate CI vs pre-push cost without opening holes (FAC-002/003/005) — pre-push already thin (marker); cost lives in `npm run push` + GHA.  
- Keep vercel ignoreCommand honest so docs-only and map-only commits don’t burn builds (FAC-006).  
- Never mix ACTIVE admin dirty tree with map commits without coordination (FAC-010/011 + 03-COORDINATION).  
- Migration apply + snapshot refresh coupled (FAC-008/009).  
- Map + handoff as start ritual (FAC-011/012) so models don’t re-teach.  
- 271 `ci:*` scripts: discoverability debt; meta-gate `ci:gates-wired` prevents orphan checkers growing.

## Inventory cross-walk

| Inventory | Value used |
|-----------|------------|
| E-github-workflows | 10 files |
| H_ci / H_scripts_total | 271 / 389 |
| K_mig | 461 |
| L-skills (.claude) | 19 |
| C_vercel scheduled | 61 |
| D_env | 117 |
