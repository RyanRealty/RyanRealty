# Global skills registry

**Purpose:** One index of every `SKILL.md` this machine uses for Cursor agents, Claude Code, and Cowork sessions (plus TC-side skills). **Read this** when choosing which skill to load before substantive work.

**Inventory date:** 2026-04-22  
**Canonical path (Claude ecosystem):** `~/.claude/GLOBAL_SKILLS_REGISTRY.md`  
**Git mirror (Ryan Realty repo):** `docs/plans/GLOBAL_SKILLS_REGISTRY.md` — keep identical when you refresh the inventory.

**Cursor stub:** `~/.cursor/GLOBAL_SKILLS_REGISTRY.md` points here so searches under `~/.cursor` resolve.

---

## How to refresh this list

From a shell:

```bash
find ~/.cursor /Users/matthewryan/RyanRealty/.cursor/skills \
  /Users/matthewryan/Documents/Claude/Projects/TRANSACTION\ COORDINATOR/skills \
  -name SKILL.md -type f 2>/dev/null | grep -v node_modules | sort
```

Then merge new paths into this file under the right heading.

---

## E — Cowork / Claude Desktop (user-mounted skills, not on fixed host paths)

| Name | Typical mount | Notes |
|------|----------------|-------|
| **docx** (Word create/edit/repack) | `/sessions/<session>/mnt/.claude/skills/docx/` | Used by INDEX and TC Cowork for Master Deal File; **mount `TRANSACTION COORDINATOR` so `.claude/skills` is visible**, or copy that skill tree into `~/.claude/skills/docx/` if you want Claude Code CLI to see it. |
| Other feedback / reference markdown | Often `mnt/` or session workspace | See each project’s `CLAUDE.md` and `PARTNER_HANDOFF_*.md`. |

---

## Inventory (112 paths under `~/.cursor` + TC + repo `.cursor/skills`; section **F** lists additional repo video skills)

### A — RyanRealty project (`.cursor/skills`)

- `/Users/matthewryan/RyanRealty/.cursor/skills/oregon-orea-principal-broker/SKILL.md`
- `/Users/matthewryan/RyanRealty/.cursor/skills/oregon-real-estate-oref/SKILL.md`
- `/Users/matthewryan/RyanRealty/.cursor/skills/professional-word-docx/SKILL.md`
- `/Users/matthewryan/RyanRealty/.cursor/skills/skyslope-api/SKILL.md`

### B — TRANSACTION COORDINATOR (mounted TC / other Claude projects)

- `/Users/matthewryan/Documents/Claude/Projects/TRANSACTION COORDINATOR/skills/google-vault/SKILL.md`

### C — Cursor global (`~/.cursor/skills-cursor`)

- `/Users/matthewryan/.cursor/skills-cursor/babysit/SKILL.md`
- `/Users/matthewryan/.cursor/skills-cursor/canvas/SKILL.md`
- `/Users/matthewryan/.cursor/skills-cursor/create-hook/SKILL.md`
- `/Users/matthewryan/.cursor/skills-cursor/create-rule/SKILL.md`
- `/Users/matthewryan/.cursor/skills-cursor/create-skill/SKILL.md`
- `/Users/matthewryan/.cursor/skills-cursor/create-subagent/SKILL.md`
- `/Users/matthewryan/.cursor/skills-cursor/migrate-to-skills/SKILL.md`
- `/Users/matthewryan/.cursor/skills-cursor/shell/SKILL.md`
- `/Users/matthewryan/.cursor/skills-cursor/statusline/SKILL.md`
- `/Users/matthewryan/.cursor/skills-cursor/update-cli-config/SKILL.md`
- `/Users/matthewryan/.cursor/skills-cursor/update-cursor-settings/SKILL.md`

### D — Cursor plugin: cursor-team-kit

- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/cursor-team-kit/7ec1de4230b1f5086daec529363cadb9108df55d/skills/check-compiler-errors/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/cursor-team-kit/7ec1de4230b1f5086daec529363cadb9108df55d/skills/deslop/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/cursor-team-kit/7ec1de4230b1f5086daec529363cadb9108df55d/skills/fix-ci/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/cursor-team-kit/7ec1de4230b1f5086daec529363cadb9108df55d/skills/fix-merge-conflicts/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/cursor-team-kit/7ec1de4230b1f5086daec529363cadb9108df55d/skills/get-pr-comments/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/cursor-team-kit/7ec1de4230b1f5086daec529363cadb9108df55d/skills/loop-on-ci/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/cursor-team-kit/7ec1de4230b1f5086daec529363cadb9108df55d/skills/new-branch-and-pr/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/cursor-team-kit/7ec1de4230b1f5086daec529363cadb9108df55d/skills/pr-review-canvas/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/cursor-team-kit/7ec1de4230b1f5086daec529363cadb9108df55d/skills/review-and-ship/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/cursor-team-kit/7ec1de4230b1f5086daec529363cadb9108df55d/skills/run-smoke-tests/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/cursor-team-kit/7ec1de4230b1f5086daec529363cadb9108df55d/skills/weekly-review/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/cursor-team-kit/7ec1de4230b1f5086daec529363cadb9108df55d/skills/what-did-i-get-done/SKILL.md`

### D — Cursor plugin: figma

- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/figma/9680714bad40503ef37a9f815fd1d2cd15150af4/skills/figma-code-connect/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/figma/9680714bad40503ef37a9f815fd1d2cd15150af4/skills/figma-create-design-system-rules/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/figma/9680714bad40503ef37a9f815fd1d2cd15150af4/skills/figma-create-new-file/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/figma/9680714bad40503ef37a9f815fd1d2cd15150af4/skills/figma-generate-design/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/figma/9680714bad40503ef37a9f815fd1d2cd15150af4/skills/figma-generate-library/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/figma/9680714bad40503ef37a9f815fd1d2cd15150af4/skills/figma-implement-design/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/figma/9680714bad40503ef37a9f815fd1d2cd15150af4/skills/figma-use/SKILL.md`

### D — Cursor plugin: firecrawl

- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/firecrawl/80ce444eb020b5f41b34836c553f162d6113cd6f/skills/firecrawl/SKILL.md`

### D — Cursor plugin: launchdarkly

- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/ai-configs/aiconfig-create/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/ai-configs/aiconfig-online-evals/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/ai-configs/aiconfig-projects/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/ai-configs/aiconfig-targeting/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/ai-configs/aiconfig-tools/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/ai-configs/aiconfig-update/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/ai-configs/aiconfig-variations/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/feature-flags/launchdarkly-flag-cleanup/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/feature-flags/launchdarkly-flag-create/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/feature-flags/launchdarkly-flag-discovery/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/feature-flags/launchdarkly-flag-targeting/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/metrics/launchdarkly-metric-choose/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/metrics/launchdarkly-metric-create/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/launchdarkly/be588594d653c725f9eef69d1f08dbc39c06809f/skills/metrics/launchdarkly-metric-instrument/SKILL.md`

### D — Cursor plugin: parallel

- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/parallel/db86c809e2634744f8d968967449b984a71e2e04/skills/parallel-data-enrichment/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/parallel/db86c809e2634744f8d968967449b984a71e2e04/skills/parallel-deep-research/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/parallel/db86c809e2634744f8d968967449b984a71e2e04/skills/parallel-web-extract/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/parallel/db86c809e2634744f8d968967449b984a71e2e04/skills/parallel-web-search/SKILL.md`

### D — Cursor plugin: supabase

- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/supabase/release_v0.1.4/skills/supabase-postgres-best-practices/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/supabase/release_v0.1.4/skills/supabase/SKILL.md`

### D — Cursor plugin: superpowers

- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/brainstorming/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/dispatching-parallel-agents/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/executing-plans/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/finishing-a-development-branch/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/receiving-code-review/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/requesting-code-review/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/subagent-driven-development/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/systematic-debugging/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/test-driven-development/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/using-git-worktrees/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/using-superpowers/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/verification-before-completion/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/writing-plans/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/superpowers/b7a8f76985f1e93e75dd2f2a3b424dc731bd9d37/skills/writing-skills/SKILL.md`

### D — Cursor plugin: vercel

- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/.claude/skills/benchmark-agents/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/.claude/skills/benchmark-e2e/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/.claude/skills/benchmark-sandbox/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/.claude/skills/benchmark-testing/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/.claude/skills/plugin-audit/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/.claude/skills/release/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/.claude/skills/vercel-plugin-eval/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/ai-gateway/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/ai-sdk/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/ai-sdk/upstream/SKILL.md` *(upstream mirror — prefer sibling non-upstream when both exist)*
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/auth/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/bootstrap/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/chat-sdk/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/chat-sdk/upstream/SKILL.md` *(upstream mirror — prefer sibling non-upstream when both exist)*
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/deployments-cicd/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/env-vars/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/knowledge-update/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/marketplace/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/next-cache-components/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/next-cache-components/upstream/SKILL.md` *(upstream mirror — prefer sibling non-upstream when both exist)*
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/next-forge/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/next-forge/upstream/SKILL.md` *(upstream mirror — prefer sibling non-upstream when both exist)*
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/next-upgrade/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/next-upgrade/upstream/SKILL.md` *(upstream mirror — prefer sibling non-upstream when both exist)*
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/nextjs/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/nextjs/upstream/SKILL.md` *(upstream mirror — prefer sibling non-upstream when both exist)*
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/react-best-practices/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/react-best-practices/upstream/SKILL.md` *(upstream mirror — prefer sibling non-upstream when both exist)*
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/routing-middleware/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/runtime-cache/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/shadcn/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/turbopack/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/vercel-agent/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/vercel-cli/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/vercel-cli/upstream/SKILL.md` *(upstream mirror — prefer sibling non-upstream when both exist)*
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/vercel-functions/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/vercel-sandbox/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/vercel-sandbox/upstream/SKILL.md` *(upstream mirror — prefer sibling non-upstream when both exist)*
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/vercel-storage/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/verification/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/workflow/SKILL.md`
- `/Users/matthewryan/.cursor/plugins/cache/cursor-public/vercel/3d9d9cd0fe5d1bdaedb891135a5c45f19190b83f/skills/workflow/upstream/SKILL.md` *(upstream mirror — prefer sibling non-upstream when both exist)*

---

## F — Repo `video_production_skills` (if present)

- `/Users/matthewryan/RyanRealty/video_production_skills/development-showcase/SKILL.md`
- `/Users/matthewryan/RyanRealty/video_production_skills/lifestyle-community/SKILL.md`
- `/Users/matthewryan/RyanRealty/video_production_skills/listing-tour-video/SKILL.md`
- `/Users/matthewryan/RyanRealty/video_production_skills/market-data-video/SKILL.md`
- `/Users/matthewryan/RyanRealty/video_production_skills/neighborhood-overview/SKILL.md`
- `/Users/matthewryan/RyanRealty/video_production_skills/publisher/SKILL.md`
