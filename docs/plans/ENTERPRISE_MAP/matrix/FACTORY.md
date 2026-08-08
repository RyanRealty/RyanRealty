# Development factory matrix (SEED)

| ID | Component | What it is here | Efficiency / risk notes | Status SEED |
|----|-----------|-----------------|-------------------------|-------------|
| FAC-001 | Git remote | RyanRealty/RyanRealty on GitHub | main = production truth | VERIFIED name |
| FAC-002 | GitHub Actions | 10 workflows: ci, quality, security, release, smoke, e2e-nightly, deps, cleanup, pr-labeler, resend-webhook-nightly | Overlap with local gates = cost; gaps = risk | SEED health |
| FAC-003 | Local hooks | pre-commit, pre-push, commit-msg | quality:local:strict on push | SEED |
| FAC-004 | npm scripts | ~388 total; 270 ci:* | Discoverability / legacy surface large | SEED |
| FAC-005 | Mechanical gates | ci:gates + domain gates | Primary “only path” enforcer | CANON pattern |
| FAC-006 | Vercel production | main deploys; vercel.json crons; ignoreCommand | Build CPU minutes constrained | SEED |
| FAC-007 | Vercel env | sync/merge scripts in repo | Parity local↔prod critical | SEED |
| FAC-008 | Supabase hosted | dwvlophlbvvygjfxcrhm | 460 migrations; production parity rule | SEED |
| FAC-009 | Migrations discipline | supabase/migrations + db:push/guard | F7 deliberately not in migrations | OPEN F7 |
| FAC-010 | Agent: Claude Code | Primary historical process author | ACTIVE on crm/inbox now | ACTIVE subject |
| FAC-011 | Agent: Grok Build | This session; memory enabled | Memory assist; map SoR is repo | ACTIVE map work |
| FAC-012 | Project rules | Agents.md, Claude.md, .cursor/rules | Loaded into sessions | VERIFIED present |
| FAC-013 | Skills corpus | 119 SKILL.md | Process knowledge | SEED inventory |
| FAC-014 | Worktrees / multi-agent | worktree-hygiene; anti-strand rules | Sibling contention real | CANON rules |
| FAC-015 | Grok memory | ~/.grok/memory + config enabled | Not shared with Claude | ON |
| FAC-016 | E2E / LHCI / a11y | test:e2e, ci:lighthouse, ci:a11y | Costly; critical for money pages | SEED |
| FAC-017 | Deploy verify | deploy:verify scripts | Required after user-facing push | CANON practice |

## Factory efficiency themes (for later cited plan only)

- Reduce duplicate CI vs pre-push cost without opening holes (FAC-002/003/005).  
- Keep vercel ignoreCommand honest so docs-only and map-only commits don’t burn builds (FAC-006).  
- Never mix ACTIVE admin dirty tree with map commits (FAC-010/011 + 03-COORDINATION).  
- Migration apply + snapshot refresh coupled (FAC-008/009).  
- Map + handoff as start ritual (FAC-011/012) so models don’t re-teach.
