# Agent Handoff — Streamline the Ryan Realty Canon

**Written 2026-07-21. Baseline commit `b0ae587b`. Read this file first and completely.**

You are taking over a consolidation program from a prior session. Everything you need is in this directory. Do not re-derive it.

---

## 1. Mission

Two jobs, in this order.

**Job A — Purge Follow Up Boss.** Matt's directive, verbatim: *"We do not use Follow Up Boss anymore so there should be zero reference to it."*

**Job B — Collapse the governing documentation.** Matt's directive, verbatim: *"One document that is the go-to document."* Then, correcting scope when the prior session over-read it: *"WE NEED TO KEEP MEMORY AND CONTEXT — I just don't want duplicates or conflicting audits, reports, plans."*

**The distinction that governs every decision you make:** deduplicate and de-conflict, do not destroy knowledge. One audit per subject, one plan per initiative, one statement per rule. A file is removed only when its content has demonstrably moved somewhere else, or when it describes something that no longer exists and would mislead a reader.

---

## 2. What is already done

| Done | Commit / location |
|---|---|
| 19-domain audit of the codebase, adversarially verified | `audits/*.json` — 190 requirement rows |
| Program spec restating Matt's requirements | `00-MASTER-SPEC.md` |
| Nine shared primitives, dependency-ordered | `01-PRIMITIVES.md` |
| Loop design — **SHELVED by Matt, do not build** | `02-LOOP-V2.md` |
| Questions asked, answers recorded | `03-DECISIONS.md`, `04-DECISIONS-RECORDED.md` |
| Full-corpus doc classification, ~440K lines read | `audits/CONSOLIDATION-LANES.json` |
| Reconciled rule set — the source for `CANON.md` | `05-RECONCILED-RULES.md` |
| Deletion safety manifest, **empirically tested** | `06-DELETION-MANIFEST.md` |
| Batch 0 — 36 untracked files preserved | commit `b0ae587b` |
| Gitignored skill trees preserved | `preserved-skills/` |

**Do not repeat any of this work.** The audit corpus was written by one agent per domain and then attacked by a second agent instructed to assume the first was wrong. Both read source, not docs. That is why it caught an empty directory cited 49 times and two placeholder stubs.

---

## 3. Decisions already made. Do not re-ask.

| Decision | Matt's answer |
|---|---|
| Loop / continuous-improvement engine | **Shelved.** Not part of this program |
| Autonomy | **Full autonomy, post-hoc review**, for everything reversible. Actions that leave the building — sending email or SMS to real people, publishing posts, ad spend, OAuth grants — stay per-action |
| Brand voice | **Layer Orwell's six rules on top of the existing word list.** Do not remove the list. Collapse its 12 drifted copies into one generated source |
| Automation spend | **No cap yet.** Measured actuals: brain LLM $8.54 lifetime, BatchData ~$10/month, Apify uninstrumented. Instrument first, cap after 30 days |
| Effort units | **Agent-hours and iterations. Never calendar estimates.** Matt rejected these twice |
| FUB | **Zero references** |
| Consolidation scope | **Dedupe, don't delete.** Memory is preserved |

---

## 4. Job A — the FUB purge

**Verified state: FUB is already off the serving path.** `lib/crm/fub-env.ts` `getFubApiKey()` returns `undefined` unconditionally — a deliberate single-point kill switch installed at the 2026-06-24 cutover. All three remaining call sites guard on it and cannot fire:

- `lib/expired-owner-lookup.ts:91` — `if (!key) return null`
- `lib/cma-delivery.ts:632` — `if (!apiKey) return null`
- `lib/crm/mirror.ts:40` — gated on `!!getFubApiKey()`

No FUB traffic can leave the building. This is cleanup, not exposure. Do not treat it as an incident.

**Residue to remove:**

| Item | Count |
|---|---|
| Code references — `app` 842, `lib` 990, `components` 197, `scripts` 580 | 2,662 |
| Database columns named `fub_*` | 15 |
| Env vars, including `FUB_LOGIN_EMAIL` / `FUB_LOGIN_PASSWORD` | 5 |
| Doc files mentioning FUB | 905 |

**Order:**

1. Remove the dead API calls and the three now-pointless guards. Pull the stored credentials from `.env.local` and Vercel.
2. **Migrate the identity readers.** `visitor_sessions` rows are written with the native `crm_people.id` but read by joining on `fub_person_id`. Every contact created since the June cutover renders an empty behavior panel and a broker reads it as "this lead did nothing." Migrate all readers to `crm_person_id` and backfill pre-cutover rows. Divergent readers are enumerated at `01-PRIMITIVES.md` §P1. **This is the highest-value single change in the entire program** — it is simultaneously the FUB purge, the person-identity primitive, and the top user-visible defect.
3. Rename the 15 `fub_*` columns. Expand-contract. **Show Matt the migration before running it.**
4. Docs fold into Job B.

---

## 5. Job B — the consolidation

### 5.1 End state

- **`CANON.md`** — the one document. Built from `05-RECONCILED-RULES.md` (59 verified rules). Each rule stated once, marked either mechanically enforced with its gate name, or prose-only.
- **A consolidated knowledge base** — the memory. One document per subject, absorbing the 156 history files.
- **Machinery** — 47 files running code reads. Kept, stripped of restated rules, pointed at `CANON.md`.
- **`CLAUDE.md`** — reduced to a pointer plus the rules that must sit in an agent's context automatically.

### 5.2 Disposition by verdict

`audits/CONSOLIDATION-LANES.json` carries a verdict per file.

| Verdict | Count | What you do |
|---|---|---|
| `history-delete` | 156 | **KEEP.** Consolidate into one doc per subject. The label is from an earlier, delete-biased instruction Matt has since overridden |
| `duplicate-delete` | 77 | Merge into one statement. Content preserved |
| `dead-delete` | 80 | Delete. Describes things that no longer exist. Misinformation, not memory. All FUB docs are here |
| `canon-rule` | 59 | Into `CANON.md` |
| `machinery` | 47 | Keep as-is |
| `data` | 14 | Convert to JSON registries |

### 5.3 Contradictions you must resolve

Full list in `audits/CONSOLIDATION-LANES.json` under `contradictions_noticed` (~35). The ones that cost something:

1. **Two canonical processes, both `alwaysApply: true`.** `docs/DEVELOPMENT_PROCESS.md` marks `master-plan.md` and the phase briefs superseded; `.cursor/rules/master-plan-protocol.mdc` still directs agents to that superseded system.
2. **Paul and Rebecca have wrong runbooks.** `matt-ryan.md` was corrected 2026-05-22 (the cron auto-enrolls; no manual stage change needed). `paul-stevenson.md` and `rebecca-peterson.md` never got it and still say *"Do not skip the stage change."* All three also cite four crons absent from `vercel.json`. **This is a live operational error affecting real people — fix it early.**
3. **Two opposed locked caption specs.** CLAUDE.md locks single-word Amboqia (2026-05-20). `social_media_skills/platform-best-practices/SKILL.md` locks *"full-sentence… NEVER word-by-word"* (2026-05-07). CLAUDE.md is newer and wins.
4. **Retired brand values in always-apply rules.** `.cursor/rules/design-system.mdc` still carries gold and fir green, both retired by Design System v2. `.cursor/rules/blog-voice.mdc` points at `voice_system_v2.md`, now a retirement stub. `voice_guidelines.md` has two stacked mutually exclusive supersession banners.
5. **ElevenLabs settings.** `docs/research` says 0.50/0.75/0.35; CLAUDE.md says 0.40/0.80/0.50. CLAUDE.md is newer.
6. **CLAUDE.md's own facts are stale.** Producer cron cadences contradict `vercel.json` (dispatcher and runtime are hourly, not 15/30 min; publisher-sweep is 30 min, not 10). "~60 gates" is 126. "7 orphans" is 0. ARCHITECTURE.md says 37 crons; there are 49. **Fix these in `CANON.md` or the new document inherits the lie.**

---

## 6. Hard guardrails

### 6.1 Never lose these — code reads them

Full table at `06-DELETION-MANIFEST.md` §4. The ones that crash the build with no guard:

- `docs/DATABASE_SCHEMA_SNAPSHOT.md` — unguarded `readFileSync` in two gates. **Test-confirmed crash on delete.** Regenerating needs live DB creds via `ci:data-access`, which is not in the static chain. If you lose it you cannot restore it from a secret-less environment, only from git.
- `docs/DEVELOPMENT_PROCESS.md` — G44 `existsSync` → exit 1. Must contain `**Version: 1.1.0**`.
- `CLAUDE.md`, `marketing_brain_skills/producers/TEMPLATE.md`, `lib/marketing-brain/producer-output-class.ts` — each must contain the literal strings `docs/DEVELOPMENT_PROCESS.md` **and** `THE LOOP v1.1.0`, exactly matching the canon's version. **When you rewrite CLAUDE.md, preserve both strings or G44 exits 1.**
- `docs/MECHANICAL_GATES.md` — test-confirmed fail on delete, despite a misleading `existsSync` guard.
- `docs/DESIGN_DIRECTIVES.md` — parses `| Dnn |` rows; zero rows fails.
- `docs/fub-crm-spec/crm-screens.json` + `_verify/*.png` (21 files) — the only survivors of that 112K-line directory.
- `marketing_brain_skills/producers/REGISTRY.md` — unguarded read; row count ratchets **down only**.
- **`docs/admin-help/*.md` (22 files) — a LIVE PRODUCT SURFACE.** `lib/admin-help.ts` reads them at request time for `/admin/help`. Deleting blanks a page brokers use.

### 6.2 Claims the prior session got wrong — do not repeat them

- **"Deleting `voice_guidelines.md` breaks CI repo-wide" is FALSE.** `validate-producer.mjs` does a string-includes check on the SKILL file's own prose, not a disk check. Proof: `ANTI_SLOP_MANIFESTO.md` and `VIRAL_GUARDRAILS.md` are listed as mandatory and exist nowhere in the repo; the gate passes today. Six such files were moved off disk and the gate returned `PASS 51 · FAIL 0`. What must survive is the filename *strings inside* the SKILL files — so strip the citation block and drop the names from `MANDATORY_REFS_BASE`/`_CONTENT` in the same commit.
- **G44's rogue-plan arm is inverted and non-recursive.** Deleting `docs/plans/*.md` removes failures rather than causing them (verified: moving the whole directory away → PASS, "plan docs: 0"). It also never recurses, which is why a 29-file `docs/plans/ADMIN_REBUILD/` package has been completely ungoverned.
- **`video_production_skills/` holds 3 `.ts` files and zero markdown**, against 49 CLAUDE.md citations across 30 distinct paths and ~25 live routing-map entries in `lib/marketing-brain/generate-briefs.ts` and `inbox-producer-registry.ts`. Those routes already fail `skill_load` on every cron tick. Treat every "this file is required" claim as unverified until you grep it.

### 6.3 Irreversible things

- **Two live stashes exist** — `stash@{0}` SellerLPForm WIP, `stash@{1}` sell-page WIP. Unrelated to this work. **Do not touch them.** A `git reset --hard` recovery will not restore them.
- **Concurrent sessions are active.** HEAD moved during the prior analysis and a sibling session committed files mid-run. Run `git status` immediately before every commit. Never chain `stash pop`.
- **Push only via `npm run push`.** Bare `git push` fails the pre-push marker check. The full chain takes ~10 minutes and the marker expires after 240 minutes — batch commits and push once rather than pushing six times.
- **G45 producer-freeze ratchets down only.** Deleting REGISTRY rows tightens the baseline permanently. Re-adding a producer later needs `ci:producer-freeze:baseline`, which requires Matt's explicit approval quoted in the commit message.

---

## 7. Execution order

`06-DELETION-MANIFEST.md` §3 carries tested shell for each batch. Commit after each; gate edits marked ⚠ must land in the *same* commit as their batch.

| Batch | Content | Status |
|---|---|---|
| 0 | Preserve untracked work | **DONE — `b0ae587b`** |
| 1 | Pure-history consolidation, zero gate interaction | Consolidate to one doc per subject first, then remove sources |
| 2 | `docs/plans` — G44-inverted, only gets safer | Keep `task-registry.json` unless `scripts/orchestrate.ts` also goes |
| 3 | The six "mandatory reference" files + their citation strings ⚠ | Verify `git grep -c 'voice_guidelines.md'` → 0 after |
| 4 | Dead `video_production_skills` routing | Check whether any comp imports `captions/canonical/*` before removing |
| 5 | `CLAUDE.md` rewrite into `CANON.md` ⚠ | Preserve the two G44 strings |
| 6 | Skills trees — highest blast radius, do last | Shelved loop skills; `preserved-skills/` already holds the gitignored ones |

Run `npm run ci:gates` after every batch. All 8 doc-dependent gates were green at `b0ae587b`, so any red is caused by your batch.

---

## 8. Done

- Zero references to Follow Up Boss in code, schema, env, or docs — except one historical note explaining what it was and why we left.
- `CANON.md` exists and every rule in it is stated exactly once, with no contradiction, each marked enforced-by-gate or prose-only.
- Every fact in `CANON.md` verified against source. No cron cadence, gate count, file path, or brand value asserted without a check.
- The knowledge base holds one document per subject. No information lost from the 156 history files.
- `npm run ci:gates` green. `npm run push` clean.
- Paul's and Rebecca's runbooks corrected.
- The `visitor_sessions` identity migration shipped, so contact behavior panels populate again.

**Then stop and show Matt.** The schema rename in Job A step 3 is the one thing that must not run without him seeing the migration first.
