Verification complete. Every claim below was checked against source; the empirical tests were run by moving files off disk, running the gate, and restoring.

---

# DELETION SAFETY MANIFEST
Repo `/Users/matthewryan/RyanRealty` · HEAD `12a409aa` (== `origin/main`) · `ci:gates` = 128 leaf scripts · 618 docs/*.md · 536 SKILL.md · 29 .cursor/rules · 49 Vercel crons

**Baseline established:** all 8 doc-dependent gates pass right now (`ci:process-canon`, `ci:producer-freeze`, `ci:producer-skills`, `ci:design-directives`, `ci:crm-screen-parity`, `ci:migration-drift`, `ci:dal-column-quoting`, `ci:gates-wired`). Any red after a batch is caused by that batch.

---

## 1. GATE BREAKAGE MAP

### 1A. HARD — deletion breaks `npm run ci:gates`

| Gate | npm script | File(s) it actually fs-reads | Failure mode on delete |
|---|---|---|---|
| **G44 process-canon** | `ci:process-canon` | `docs/DEVELOPMENT_PROCESS.md` (`existsSync`→`exit 1`, then `readFileSync`) | Immediate exit 1. Also requires the doc to contain `**Version: X.Y.Z**` (currently **v1.1.0**) |
| G44 (pointer arm) | same | `CLAUDE.md`, `marketing_brain_skills/producers/TEMPLATE.md`, `lib/marketing-brain/producer-output-class.ts` | Each must exist **and** contain the literal `docs/DEVELOPMENT_PROCESS.md` **and** `THE LOOP v1.1.0`. Version must match the canon exactly |
| G44 (rogue-plan arm) | same | `docs/plans/*.md` — **INVERTED** | Every `docs/plans/*.md` basename must appear in the canon. Deleting them *removes* failures. `readdirSync` is in try/catch — **empirically verified: moving `docs/plans/` away entirely → PASS, "plan docs: 0"** |
| **G25 design-directives** | `ci:design-directives` | `docs/DESIGN_DIRECTIVES.md` (`existsSync`→`exit 1`; parses `\| Dnn \|` rows, 0 rows = fail) | Exit 1 |
| G25 (catalog arm) | same | `docs/MECHANICAL_GATES.md` | **Empirically verified: deleting it FAILS the gate.** The `existsSync` guard at line 88 is misleading — every directive naming a gate ID then reports "gate not in catalog". Not soft |
| **migration-drift** | `ci:migration-drift` | `docs/DATABASE_SCHEMA_SNAPSHOT.md` (line 34, **no guard**) | **Empirically verified: uncaught ENOENT, node crash** |
| **dal-column-quoting** | `ci:dal-column-quoting` | `docs/DATABASE_SCHEMA_SNAPSHOT.md` (line 50, **no guard**) | **Empirically verified: uncaught ENOENT, node crash** |
| **crm-screen-parity** | `ci:crm-screen-parity` | `docs/crm-spec/crm-screens.json` (`existsSync`→fail; `JSON.parse`) | Immediate fail |
| crm-screen-parity | same | `docs/crm-spec/_verify/*.png` — 21 files | Per-row `existsSync` for every `status=done` screen → fail |
| **G45 producer-freeze** | `ci:producer-freeze` | `marketing_brain_skills/producers/REGISTRY.md` (line 40, no guard) | Crash. Ratchet counts rows; row count may only **shrink**, so deleting producer *rows* is allowed |
| **G35 producer-skills** | `ci:producer-skills` | Walks `marketing_brain_skills/producers/`, `social_media_skills/`, `video_production_skills/` for `SKILL.md`; delegates to `validate-producer.mjs`, which `readFileSync`s `REGISTRY.md` | Roots are `existsSync`-guarded (**verified: deleting `video_production_skills/` → still PASS**). Deleting `REGISTRY.md` degrades gates 3+8 to warnings but `check-producer-freeze` crashes first |
| resort-definitions | `ci:resort-definitions` | `data/resort-communities.json` | Crash (JSON registry, not prose) |
| mockup-parity / coverage | `ci:mockup-parity`, `ci:mockup-coverage` | `design_system/ryan-realty/ui_kits/**` — 34 kits, 25 `parity.json` + `index.html` | Per-route contract fail |
| gates-wired | `ci:gates-wired` | `package.json`, `.github/workflows/*`, `.husky/*`, `scripts/gates-wired-baseline.json` | Baseline `files` array is currently **empty** (zero orphans). Count may only shrink |

### 1B. THE BIG FALSE ALARM — disproven by direct test

The skills-brain lane claimed: *"all 24 producer SKILL.md files are CI-gated (G35) on containing their literal filenames… renaming or deleting any of these five without also editing 24 files + `scripts/validate-producer.mjs` breaks CI repo-wide."*

**That is wrong in the way that matters.** `scripts/validate-producer.mjs` line 464:

```js
const missingBaseRefs = MANDATORY_REFS_BASE.filter((ref) => !src.includes(ref))
```

`src` is the SKILL.md's own text. This is a **string-includes check on prose**, not a disk check. The only disk check (Gate 8, line 545 `existsSync`) is explicitly demoted:

```js
// Gate 8: … a broken inter-producer reference is a doc bug, not a runtime
// blocker. The brain does not follow these references at runtime.
// Demoting to a WARNING so the producer still validates clean.
```

**Proof A (found, not run):** `ANTI_SLOP_MANIFESTO.md` and `VIRAL_GUARDRAILS.md` — both in `MANDATORY_REFS_CONTENT` — **do not exist anywhere in the repo**. G35 passes today regardless.

**Proof B (run):** I moved `voice_guidelines.md`, `tool-inventory.md`, `platform-bible.md`, `asset-library-map.md`, `bend-market-bible.md`, and `design_system/ryan-realty/SKILL.md` off disk together → `ci:producer-skills`: **`Scanned 53 SKILL.md · PASS 51 · Skipped 2 · FAIL 0`**.

**Consequence:** those six files are **deletable**. What must survive is the literal filename *strings* inside the 53 SKILL.md files. Deleting the files makes the citations dangling prose — which is precisely the rot Matt is removing, so the right fix is to strip the citation block from the SKILL files and drop the names from `MANDATORY_REFS_BASE`/`_CONTENT` in the same commit.

### 1C. SOFT — path appears only in a comment or `console.error` string

Deletion is cosmetic (stale error text, no build impact). ~45 gates, including: `check-access-denied-loop`, `check-admin-endpoint-auth`, `check-admin-role-guard`, `check-auth-redirect`, `check-crm-fail-closed`, `check-sync-cursor` (all cite `docs/audit/REMEDIATION_PROGRESS.md`); `check-dal-boundary`, `check-dal-actions-reads` (`docs/DATA_ACCESS_LAYER.md`); `check-content-{freshness,metadata,schema,uniqueness}` (`docs/CONTENT_ENGINE_SPEC.md` — **verified not read**); `check-crm-lead-integrity` (`docs/CRM_INTEGRATION.md`); `check-kb-single-source`, `check-kb-page-contract` (`components/site/kb/README.md`, `docs/KB_CONVERGENCE_ROADMAP.md` — **verified not read**); `check-sms-consent-compliance` (**verified: reads `components/site/SmsConsentDisclosure.tsx`, NOT `docs/HANDOFF-a2p-sms-consent.md`** — the docs-top lane overclaimed this file); `check-console-kit` (**verified: reads `app/**` route files, not `docs/CONSOLE_KIT.md`**); `check-admin-curation` (**verified: reads `app/admin`, not `docs/ADMIN_DESIGN_STANDARD.md`**); `check-tracking-policy`, `check-seo-authoring`, `check-delta-sync-single-core`, `check-mockup-parity`, `check-page-dal`, `check-static-params`, `lint-design-tokens`.

Nothing reads `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, or any `.cursor/rules/*.mdc` — **grep-verified zero matches across all `scripts/check-*.mjs`**.

### 1D. Commit/push machinery (affects the deletion commits themselves)

- `.husky/commit-msg` → `scripts/check-draft-first.mjs`. `NEVER_USER_FACING` includes `/^docs\//`, `/^scripts\//`, `/^\.cursor\//`, `/^lib\//`, `/^design_system\//`. **Doc-only deletion commits need no `Approved-by:` marker.** Root `CLAUDE.md`/`AGENTS.md` don't match `USER_FACING_PATTERNS` either.
- `.husky/pre-commit` → `check-producer-guard.mjs` + `ci:brand-voice` (scans `app/`+`components/` only) + `npm test` (vitest). **Verified: no vitest test reads a `.md` file.**
- `.husky/pre-push` → marker check only. **Must push via `npm run push`**, never bare `git push`.

---

## 2. RUNTIME BREAKAGE MAP

| Consumer | Reads | When | Behavior if file is gone |
|---|---|---|---|
| **`lib/admin-help.ts`** (`HELP_DIR = docs/admin-help`) | every `*.md` except `README.md` | request time, `react.cache()`, rendered at `/admin/help` + `/admin/help/[slug]` | **HARD — live product surface goes blank.** 22 files on disk (21 articles + README) |
| `app/api/cron/producer-runtime/route.ts:176` → `lib/marketing-brain/producer-output-class.ts:113` | `path.join(cwd, assigned_producer, 'SKILL.md')` | hourly cron `0 * * * *`, gated on `PRODUCER_RUNTIME_ENABLED === 'true'` | **GRACEFUL** — try/catch → `logFailure(…,'skill_load')`, row stays `in_production`, loop continues |
| `app/api/admin/run-producer/[id]/route.ts:107` | same | admin one-shot | **GRACEFUL** — same handler |
| `.github/workflows/release.yml:104` | `CHANGELOG.md` | on merge to main | **GRACEFUL** — `if [ -f CHANGELOG.md ]` … `else echo -e "# Changelog\n\n${NOTES}" > CHANGELOG.md`. **Corrects the governance lane:** deleting it does **not** break the workflow; it silently discards ~1,823 releases of history |

**Pre-existing rot found (not caused by this deletion):** `lib/marketing-brain/generate-briefs.ts` (`FORMAT_ROUTE_MAP`) and `lib/marketing-brain/inbox-producer-registry.ts` route ~25 `content:*` action types to `video_production_skills/<name>` paths. That directory contains **exactly 3 files** — `captions/canonical/{load-amboqia.ts,SingleWordCaption.tsx,safe-zones.ts}` — and **zero SKILL.md**. Those routes already fail `skill_load` on every cron tick today.

Non-doc runtime reads (leave alone): `app/lp/bend/page.tsx`, `app/lp/tetherow/data.ts`, `app/actions/deals.ts`, `lib/cma-pdf.ts`, `lib/resort-community-content.ts`, `lib/asset-library.mjs`, `lib/marketing-brain/inbox-allowlist.ts`, `lib/marketing-brain/audit-run.ts`.

---

## 3. SAFE DELETION ORDER

Run from repo root. **Commit after each batch; push only via `npm run push`.** Gate edits marked ⚠ must land in the *same* commit as their batch.

### Batch 0 — preserve the 33 untracked files (do this FIRST, non-optional)

```bash
cd /Users/matthewryan/RyanRealty
git status --porcelain --untracked-files=all | grep '^??'   # expect 33
git add -f docs/plans/PROGRAM_2026-07-21 scripts/build_3480_*
git commit -m "chore(docs): track in-flight consolidation program + 3480 build scripts before purge"
```

### Batch 1 — pure-history deletes, zero gate interaction

```bash
git rm -r --quiet docs/audits docs/research docs/archive docs/handoffs \
                  docs/marketing-brain docs/avatar-market-channel \
                  docs/site-audit docs/broker-runbooks docs/transaction-coordinator 2>/dev/null
git rm -r --quiet docs/crm-spec/screens docs/crm-spec/mobile-screens \
                  docs/crm-spec/addenda-captures docs/crm-spec/recordings \
                  docs/crm-spec/api-export 2>/dev/null
git rm --quiet 'docs/crm-spec/*.md' 2>/dev/null || git rm --quiet docs/crm-spec/[0-9]*.md docs/crm-spec/README.md docs/crm-spec/VERIFICATION.md docs/crm-spec/CAPTURE-CHECKLIST.md 2>/dev/null
npm run ci:gates && git commit -m "chore(docs): delete audit/research/archive/handoff history + FUB spec prose"
```
`crm-screens.json` and `_verify/*.png` are untouched — parity gate stays green.

### Batch 2 — `docs/plans` (G44-inverted, so it only gets safer)

```bash
git rm -r --quiet docs/plans/ADMIN_REBUILD 2>/dev/null
git rm -r --quiet docs/plans 2>/dev/null
git checkout HEAD -- docs/plans/task-registry.json 2>/dev/null   # scripts/orchestrate.ts REGISTRY_PATH
npm run ci:process-canon && npm run ci:gates \
  && git commit -m "chore(docs): purge docs/plans (G44 rogue-plan registry now empty)"
```
⚠ Only if you also drop `scripts/orchestrate.ts`: then `task-registry.json` goes too.

### Batch 3 — the six "mandatory reference" files + their citation strings (⚠ same commit)

```bash
# 1. strip the now-dangling citations from every producer SKILL.md
grep -rl 'voice_guidelines.md' marketing_brain_skills/producers social_media_skills --include=SKILL.md
#    -> hand-edit the "Required references" block in each hit
# 2. drop the names from the gate
$EDITOR scripts/validate-producer.mjs   # remove from MANDATORY_REFS_BASE + MANDATORY_REFS_CONTENT:
#   'voice_guidelines.md','tool-inventory.md','platform-bible.md',
#   'asset-library-map.md','bend-market-bible.md',
#   'content_engine/SKILL.md','platform-best-practices/SKILL.md',
#   'ANTI_SLOP_MANIFESTO.md','VIRAL_GUARDRAILS.md'   # last two already dead on disk
# 3. now delete
git rm -r --quiet marketing_brain_skills/research marketing_brain_skills/strategy \
                  marketing_brain_skills/tools_registry marketing_brain_skills/platform-playbooks
npm run ci:producer-skills && npm run ci:gates \
  && git commit -m "chore(brain): drop research bibles + tools registry; unwire dead MANDATORY_REFS"
```

### Batch 4 — dead `video_production_skills` routing

```bash
$EDITOR lib/marketing-brain/generate-briefs.ts          # FORMAT_ROUTE_MAP: drop video_production_skills/* rows
$EDITOR lib/marketing-brain/inbox-producer-registry.ts  # same
git rm -r --quiet video_production_skills               # keep captions/canonical/* if any comp imports them:
git grep -l 'video_production_skills/captions' -- video listing_video_v4 || true
npm run ci:gates && git commit -m "chore(brain): remove routing to video_production_skills (0 SKILL.md on disk)"
```

### Batch 5 — CLAUDE.md rewrite into the single canonical document (⚠ G44 in same commit)

```bash
$EDITOR CLAUDE.md
# MUST retain verbatim, or G44 exits 1:
#   the string  docs/DEVELOPMENT_PROCESS.md
#   the string  THE LOOP v1.1.0        <- must equal **Version:** in the canon
# Same two strings must survive in:
#   marketing_brain_skills/producers/TEMPLATE.md
#   lib/marketing-brain/producer-output-class.ts   (line ~142, inside the prompt template)
git rm --quiet AGENTS.md ARCHITECTURE.md
git rm -r --quiet .cursor/rules
npm run ci:process-canon && npm run ci:gates \
  && git commit -m "docs: collapse governance into one canonical CLAUDE.md"
```

### Batch 6 — skills trees, last (highest blast radius)

```bash
git rm -r --quiet .claude/skills/growth-loop .claude/skills/crm-e2e .claude/skills/tc-builder \
                  .claude/skills/experience-rollout .claude/skills/deep-audit 2>/dev/null
rm -rf .claude/skills/crm-e2e .claude/skills/tc-builder   # gitignored — see §5
# social_media_skills: deleting a SKILL.md also requires deleting its REGISTRY.md row
$EDITOR marketing_brain_skills/producers/REGISTRY.md
npm run ci:producer-freeze && npm run ci:producer-skills && npm run ci:gates \
  && git commit -m "chore(skills): retire shelved LOOP skills"
```

### Final

```bash
npm run ci:gates && npm run push
```

---

## 4. MUST-KEEP LIST (code reads it — nothing else qualifies)

| File(s) | Depended on by | Exact mechanism |
|---|---|---|
| `docs/DEVELOPMENT_PROCESS.md` | `scripts/check-process-canon.mjs:34,39` | `existsSync`→exit 1; needs `**Version: 1.1.0**` |
| `CLAUDE.md` | same, line 27 | must contain `docs/DEVELOPMENT_PROCESS.md` + `THE LOOP v1.1.0` |
| `marketing_brain_skills/producers/TEMPLATE.md` | same, line 28 | identical two-string requirement |
| `docs/DESIGN_DIRECTIVES.md` | `check-design-directives.mjs:39,42,48` | `existsSync`→exit 1; `\| Dnn \|` rows parsed |
| `docs/MECHANICAL_GATES.md` | `check-design-directives.mjs:40,88` | **test-confirmed fail on delete** |
| `docs/DATABASE_SCHEMA_SNAPSHOT.md` | `check-migration-drift.mjs:34`, `check-dal-column-quoting.mjs:50` | **unguarded `readFileSync` — test-confirmed crash** |
| `docs/crm-spec/crm-screens.json` | `check-crm-screen-parity.mjs:41,49,56` | `existsSync`+`JSON.parse` |
| `docs/crm-spec/_verify/*.png` (21) | same, line 101-102 | per-`status=done` `existsSync` |
| `marketing_brain_skills/producers/REGISTRY.md` | `check-producer-freeze.mjs:40`, `validate-producer.mjs:28,373` | unguarded `readFileSync`; row-count ratchet |
| `marketing_brain_skills/producers/*/SKILL.md` (24) | `check-producer-skills.mjs` + `producer-runtime` cron | G35 walks them; cron fs-loads by `assigned_producer` |
| `social_media_skills/*/SKILL.md` (29) | same | same |
| `docs/admin-help/*.md` (21 + README) | `lib/admin-help.ts:50` | `readdirSync`+`readFileSync` at request time → `/admin/help` |
| `design_system/ryan-realty/ui_kits/**` (34 kits, 25 `parity.json`) | `check-mockup-parity.mjs:55`, `check-mockup-coverage.mjs:19` | per-route contract |
| `data/resort-communities.json` | `check-resort-definitions.mjs:29,47` | registry integrity |
| `scripts/gates-wired-baseline.json` | `check-gates-wired.mjs:115` | orphan ratchet (currently 0) |
| `docs/plans/task-registry.json` | `scripts/orchestrate.ts` | hardcoded `REGISTRY_PATH` — **only if `orchestrate.ts` survives** |
| `docs/DAL_INDEX.md`, `docs/ROUTE_INVENTORY.md` | `ci:data-access --refresh`, `ci:routes` | regenerable, but `ci:data-access` needs live DB creds — regenerating is not free |

**Explicitly NOT must-keep** (lane agents overclaimed; verified no code reads them): `docs/HANDOFF-a2p-sms-consent.md`, `docs/CONSOLE_KIT.md`, `docs/ADMIN_DESIGN_STANDARD.md`, `docs/CONTENT_ENGINE_SPEC.md`, `docs/CRM_INTEGRATION.md`, `docs/DATA_ACCESS_LAYER.md`, `docs/EXPERIENCE_SYSTEM.md`, `docs/SITE_PAGE_STANDARD.md`, `docs/TC_OREGON_COMPLIANCE.md`, `components/site/kb/README.md`, `marketing_brain_skills/brand-voice/voice_guidelines.md`, the 4 research bibles, `design_system/ryan-realty/SKILL.md`, `AGENTS.md`, all 29 `.cursor/rules/*.mdc`. Keep any of these for *content* reasons if you choose — but not for build safety.

---

## 5. ROLLBACK

**Tracked content** — recoverable indefinitely:
```bash
git checkout HEAD~1 -- docs/            # single batch
git revert <sha>                        # one batch, keeps history
git checkout 12a409aa -- .              # full pre-purge tree
git reset --hard 12a409aa               # nuclear (rewrites local main)
```
`HEAD == origin/main == 12a409aa`, so the pre-purge tree also exists on the remote.

**NOT recoverable — must be handled before any `rm`:**

1. **33 untracked files** (`git status --porcelain -uall | grep '^??'`):
   - `docs/plans/PROGRAM_2026-07-21/` — 5 `.md` + 21 `audits/*.json|md` = **26 files, created today (2026-07-21)**, `git ls-files` returns 0. These are this consolidation program's own working spec. `git rm -r docs/plans` would not touch them, but `rm -rf docs/plans` **destroys them permanently**.
   - `scripts/build_3480_*` — 7 files.
   → Batch 0 above commits both.

2. **Gitignored skill trees** — invisible to git, `rm` is permanent:
   - `.claude/skills/crm-e2e/` and `.claude/skills/tc-builder/` (`git check-ignore` → `.gitignore:64: .claude/skills/*`).
   - Correction to the skills-claude lane: `.cursor/skills/facebook-seller-growth/` is **NOT** ignored, and `growth-loop`, `deep-audit`, `experience-rollout`, `frontend-design`, `hallmark` **are** git-tracked (12 tracked dirs under `.claude/skills/`).
   → `cp -R .claude/skills/{crm-e2e,tc-builder} /tmp/skills-backup/` before removing.

3. **Two live stashes** — `stash@{0}` (SellerLPForm WIP), `stash@{1}` (sell-page WIP). Unrelated to this work but a `git reset --hard` recovery path won't restore them; leave them alone.

---

## 6. RISK REGISTER

1. **Concurrent sessions rewrite the tree mid-purge.** HEAD moved `c20d256c` → `12a409aa` and the 7 untracked `build_3480_*` scripts were committed by a sibling session *during this analysis*. A sibling `git stash` can wipe a half-staged deletion batch. Mitigation: one session only; `git status` immediately before each `git commit`; never chain `stash pop`.
2. **`ci:data-access` is not in the static chain.** It regenerates `DATABASE_SCHEMA_SNAPSHOT.md`/`DAL_INDEX.md` from live Supabase via `_agent_schema_dump()` and needs DB creds. If either file is lost, `ci:gates` breaks and you cannot restore it from a secret-less environment — only from git.
3. **`npm run push` runs the full chain (~10 min) in a detached verify worktree.** A 6-batch purge = 6 chain runs. The marker expires after 240 min. Budget for it, or batch the commits and push once.
4. **G45 producer-freeze ratchets down only.** Once you delete REGISTRY rows the baseline tightens. Re-adding a producer later requires `npm run ci:producer-freeze:baseline`, which CLAUDE.md says needs Matt's explicit approval cited in the commit message.
5. **21 brain-root `SKILL.md` escape G35 entirely** (`PRODUCER_ROOTS` omits bare `marketing_brain_skills/`), including the three registered `analyze-*` producers that the cron *can* dispatch. Deleting them is silent — no gate fires either way. Decide deliberately.
6. **`grep`-based citation stripping in Batch 3 is error-prone.** The strings appear in prose blocks with varying formatting across 53 files. If you drop a name from `MANDATORY_REFS_BASE` but leave a stale prose citation, the gate still passes and the rot survives. Verify with `git grep -c 'voice_guidelines.md'` → 0 after.
7. **Doc rot is worse than the audit assumed.** `ANTI_SLOP_MANIFESTO.md` and `VIRAL_GUARDRAILS.md` are cited as mandatory by the gate and by CLAUDE.md but **exist nowhere in the repo**. `video_production_skills/` holds 3 `.ts` files against 49 CLAUDE.md citations and ~25 live routing-map entries. Treat every "this file is required" claim as unverified until greppedn.
8. **Cron claims in CLAUDE.md contradict `vercel.json` (verified).** producer-dispatcher is **hourly**, not every 15 min; producer-runtime is **hourly**, not every 30 min; publisher-sweep is **every 30 min**, not every 10. `seller-workflow-pause` has **no route and no cron** despite CLAUDE.md asserting a 15-min cadence. `detect-expired-listings`, `daily-broker-digest`, `weekly-pipeline-digest` have routes but **no cron entry** — expired detection actually runs inside `sync-delta`. Fix these in the canonical doc or the new doc inherits the lie.
9. **`marketing-audit-run` cron reads config JSON via `lib/marketing-brain/audit-run.ts:224`**, and `inbox-allowlist.ts:28` reads a config path. Neither is markdown, but both live in the blast zone if you sweep `data/` or `config/` directories. Not covered by the batches above — confirm before touching non-`docs/` data.
10. **`.claude/skills/hallmark/LICENSE`** is vendored MIT. Deleting the tree without the license is an attribution problem, not a build problem. `frontend-design/SKILL.md` dispatches into it by name at run time.