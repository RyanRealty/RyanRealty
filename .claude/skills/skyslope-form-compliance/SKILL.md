---
name: skyslope-form-compliance
description: Process a closed SkySlope real-estate transaction folder end-to-end through a 10-phase audit-classify-rename-checklist-archive pipeline. Pulls sale-detail + documents from the SkySlope API, renders every page of every PDF, classifies each form against the canonical OREF library, detects multi-form bundles (one PDF holding two or more OREF forms), validates signatures per the form's signer profile (single_party vs mutual), groups same-(sale#, OREF#) candidates for dedup, generates Broker Notes, executes renames + UNASSIGN/ASSIGN + archive-folder moves against SkySlope. Use this skill whenever the user mentions a closed SkySlope folder, a property address that needs compliance cleanup, OREF form classification or renaming, broker notes generation, checklist purity, the `_X_` executed marker, duplicate-doc cleanup, archive folder moves, transaction summary generation, or any phrase about real-estate transaction file cleanup — even loose triggers like "process the next closed folder", "what's left on `<address>`", "audit this listing", "clean up SkySlope for X", "run the compliance pipeline", or specific OREF form numbers (001 RSA, 002 Addendum, 015 listing, 020 SPD, 022A/B Repair Addendum, 025 EIFS, 042 Initial Agency, 043 EFA, 047 FIRPTA, 050 Buyer Rep, 057 Termination, 080 Mutual Termination, 081 Septic, 082 Well, 091 Comp Notice, 092 Counter, 108 Notice, 110 Notice from Seller). This skill is non-optional for any document operation against SkySlope because Matt is the licensed principal broker on the Ryan Realty license — misclassification produces compliance risk under Oregon Real Estate Agency (OREA / ORS 696) rules, not a cosmetic miss. Trigger this skill BEFORE any one-off PATCH against `/api/files/{kind}s/{guid}/documents`, BEFORE driving the SkySlope UI via Playwright, BEFORE writing any ad-hoc `_bear-st-*` / `_ochoco-*` / `_712-*` script. If the user is in the middle of one of those ad-hoc scripts, surface this skill as the canonical path and consolidate the work into the pipeline.
---

# SkySlope Form Compliance

This skill walks one closed SkySlope real-estate transaction folder through a 10-phase pipeline. Matt is the principal broker on the Ryan Realty license — every false `_X` mark, missed duplicate, or mis-assigned checklist item is a compliance risk under OREA / ORS 696, not a cosmetic miss. The pipeline is the audit-defensible record that proves due diligence on every closed file.

> **→ For the exact commands to run on a folder, jump to [Running the pipeline — THE CANONICAL PER-FOLDER RUNBOOK](#running-the-pipeline--the-canonical-per-folder-runbook-tested-2026-06-use-this-every-time).** It is the tested 6-step process (proven on 25+ folders, June 2026) — use it every time so every folder gets the identical treatment. The phase descriptions below are the conceptual model; the runbook is what you run.

## Execution model — Claude Code only

Phase 2 (vision classify) and Phase 3 (signer validate) run as **`Agent` tool subagents inside Claude Code** (background or foreground — either is fine, both are under Matt's plan, no extra metering). Phases 0, 1, 4, 5, 6, 7, 8, 9 run as Bash scripts or in the main session — none of them need an LLM call.

**Forbidden:** any Bash script that imports `@anthropic-ai/sdk` or calls `api.anthropic.com` with `ANTHROPIC_API_KEY`. Those bill Matt's Anthropic API console SEPARATELY from his Claude Code plan. The legacy [`scripts/claude-reader.mjs`](scripts/claude-reader.mjs) is the canonical violator — do not call it; vision OCR goes through Agent tool subagents instead.

See [references/failure-modes.md](references/failure-modes.md) §6.

## Read [references/failure-modes.md](references/failure-modes.md) FIRST

Five regression classes have surfaced across the 712 SW 1st / 15352 Bear St / 29500 SE Ochoco Way passes. Each one corrupts a downstream phase if it isn't caught at the source phase. Every phase script + every subagent prompt loads `failure-modes.md` before running. Quick summary:

1. **Bundle PDFs** — one PDF can hold two or more OREF forms. Classifier seeing only page 1 produces wrong form-class verdicts.
2. **Single_party vs mutual form-class** — OREF 043, 047, 080, 091, 092, 108 require ONE side's sigs (not both). Treating them as mutual strips `_X` from forms that ARE fully executed.
3. **Subagent docId fabrication** — subagents have invented placeholder GUIDs ending `-0000-0000-0000-000000000001`. Every subagent prompt rejects any output containing a docId not in the live `documents.json`.
4. **Same-(sale#, OREF#) dedup not grouped at Phase 0** — three EFAs, two EMRs, three Prelim Titles on one activity have all gone undetected until manual tail-end passes.
5. **DigiSign overlay text invisible to pdfjs** — pure pdfjs OCR misses the signature overlay layer. Vision (LLM page render) sees it. Phase 2 uses vision, not pdfjs alone.

Full root-cause + counter-rule per mode in `references/failure-modes.md`.

## The 10-phase pipeline

Hard gate: Phase N+1 refuses to run unless Phase N's output JSON exists and validates. Every phase writes `tmp/<saleGuid>/phaseN.json`.

| # | Name | What it does | Hard gate on success |
|---|---|---|---|
| 0 | Audit | Auth, pull `sale-detail.json` + `documents.json`, identify side (sales/listing) + checklist template + activity-to-doc map | `documents.length > 0`, `sale.checklistType` non-null |
| 1 | Fetch + render | Download every PDF binary; render every page to PNG via `scripts/_render-pdf-pages.mjs` at 150 DPI | Every doc has rendered pages; no S3 fetch failures |
| 2 | Classify | Vision-OCR every page; identify OREF# per page; detect bundles (different OREF# on page 2+ vs page 1); extract sale# from each constituent form | Every constituent form has `oref_number` + `sale_number` (or explicit `null` if blank field) + `page_range` |
| 3 | Signer validate | Per constituent form, look up `signer_profile` in [references/oref-form-library.md](references/oref-form-library.md); validate found sigs against profile; produce `signer_status: fully_executed \| partially_executed \| unexecuted \| superseded_intermediate` | Every constituent form has a status verdict |
| 4 | Dedup detect | Group all constituent forms by `(sale#, OREF#, form_role)`; for each group with 2+ candidates, apply canonical-selection rule from [references/canonical-selection.md](references/canonical-selection.md) | Every dedup group has a `canonical` winner + `archive` losers OR `flag_for_human` |
| 5 | Build plan | Compose rename plan (Phase 7) + checklist plan (Phase 8) + Broker Notes inputs (Phase 6) + archive plan + cross-link plan | Every action references a docId in `documents.json` |
| 6 | Broker Notes | Generate `transaction-summary.txt` from Phase 0+5 outputs per [references/broker-notes-generation.md](references/broker-notes-generation.md); convert to PDF | PDF exists, ≥ 1 page, signed broker name visible |
| 7 | PATCH renames | Apply Phase 5 rename plan via `PATCH /api/files/sales/{guid}/documents/{docId}` | All PATCH HTTP 200 or explicit Matt-approved skip |
| 8a/b/c | UNASSIGN / archive folder / ASSIGN | Apply Phase 5 checklist plan: UNASSIGN losers, move ARCHIVE-prefixed docs to UI Archive folder via Playwright, ASSIGN canonical docs (including cross-links for bundles) | Activity-to-doc map matches plan |
| 9 | Send Broker Notes | Gmail-send PDF to `sale.portalEmail` via service account DWD impersonation; poll for ingest; PATCH name + ASSIGN to Broker Notes activity | PDF visible in `documents.json` + assigned to Broker Notes activity |

Phases 7–9 are LIVE mutations. They never run without Matt's explicit approval of the Phase 5 plan output. Default invocation = dry-run.

## Phase 2 + Phase 3 — Agent tool subagent prompts

Phase 2 and Phase 3 spawn `Agent` tool subagents (parallel OK). Each subagent loads its prompt template at invocation:

- [subagent-prompts/form-compliance-classifier.md](subagent-prompts/form-compliance-classifier.md) — **the canonical whole-folder classifier (Step 3 of the runbook)** — use this
- [subagent-prompts/contamination-scan.md](subagent-prompts/contamination-scan.md) — focused property-check for the contamination audit
- [subagent-prompts/classifier.md](subagent-prompts/classifier.md) — legacy per-doc Phase 2 classifier (superseded by form-compliance-classifier.md)
- [subagent-prompts/signer-verifier.md](subagent-prompts/signer-verifier.md) — legacy Phase 3 signer validator

Both templates carry three non-negotiable rules:

1. **Every docId in your output MUST exist verbatim in `documents.json`.** Reject any GUID ending `-0000-0000-0000-000000000001` or any GUID you can't find by `documents.find((d) => d.id.toLowerCase() === yourGuid.toLowerCase())`.
2. **Cite page evidence.** Every classification quotes the OREF# header location + page number. Every signer verdict quotes the signer name + date stamp + DigiSign envelope ID (visible in pdfjs metadata, not the overlay).
3. **Bias false-negative.** If uncertain, output `flag_for_human` with the specific ambiguity. Never guess.

The orchestrator re-spawns any subagent whose output violates rule 1, 2, or 3, with the violation cited in the re-spawn prompt.

## Running the pipeline — THE CANONICAL PER-FOLDER RUNBOOK (tested 2026-06; use this EVERY time)

There is no single `run-pipeline.mjs` — the pipeline is driven from the main Claude Code session because Phase 2-3 (classify + signer-validate) MUST run as an `Agent` subagent (LLM vision under Matt's Claude Code plan, never a metered `api.anthropic.com` call). Run these 6 steps per folder. The working directory for every step is `tmp/skyslope-pdfs/<saleGuid>/` — **one folder per deal** (fetch output, documents.json, checklist.json, plan.json, phase5-plan.json, execution-log.json all live there).

```bash
# 1. FETCH — download every PDF + manifest.json (Bash, no LLM)
node --env-file=.env.local .claude/skills/skyslope-form-compliance/scripts/fetch-folder-pdfs.mjs --kind=sale --guid=<GUID>

# 2. CONTEXT — write documents.json (the valid docIds) + checklist.json (current activity assignments + numeric activityIds)
node --env-file=.env.local .claude/skills/skyslope-form-compliance/scripts/dump-classify-context.mjs <GUID>
```

3. **CLASSIFY — spawn ONE foreground `Agent` subagent (model `sonnet`)** using the prompt template [`subagent-prompts/form-compliance-classifier.md`](subagent-prompts/form-compliance-classifier.md). Fill the placeholders (GUID, property, side, doc count, the 2+-doc activities); include the ALREADY-PROCESSED block when re-running a folder that already has "ARCHIVE…"-named docs. It reads every page of every PDF + the references and writes `plan.json` into the deal folder. It runs in its OWN context — keeps the main session clean. For a 150+ doc folder, tell it to read-extract-move-on; if it socket-errors mid-run, just re-spawn (reads are reproducible).

```bash
# 4. BUILD the executor plan from plan.json (schema-tolerant — consumes documents[]/dedup_groups/misassignments/mislabeled_filenames/cross_links)
node .claude/skills/skyslope-form-compliance/scripts/build-phase5.mjs <GUID> <label> "<property>"
#    add --incremental when RE-running an already-processed folder (applies only net-new changes; never re-derives names)

# 5. EXECUTE — dry-run, REVIEW WITH MATT, then --execute. The workspace IS the deal folder.
node .claude/skills/skyslope-form-compliance/scripts/execute-plan.mjs tmp/skyslope-pdfs/<GUID>              # dry-run (validates every docId vs live)
#    --> surface the plan to Matt; wait for "go"/"approved"; then:
node .claude/skills/skyslope-form-compliance/scripts/execute-plan.mjs tmp/skyslope-pdfs/<GUID> --execute    # live (add --resume to retry only the failed actions)

# 6. VERIFY — live/archive counts, activities-with-2+-docs (should be only legit sequences), 0 fabricated docIds
node .claude/skills/skyslope-form-compliance/scripts/verify-fc.mjs <GUID>
```

**Step 5 (execute) is a LIVE mutation. It never runs without Matt's explicit approval of the dry-run plan. Silence is not approval. A successful build is not approval. See CLAUDE.md §0.5 Draft-First-Commit-Last.**

### Hard-won executor rules (every one was a live 422 — see [references/sanitize-fixes.md](references/sanitize-fixes.md))
- **Keep the file extension.** Pull the real ext from `manifest.json` (the SkySlope `name` field drops it; `.htm`/`.eml`/`.docx` matter). A doc absent from the manifest = a SkySlope system marker with no binary → can't rename, skip it.
- **`sanitize()` strips** `# , ; % { } / \ < > : " | ? *`, internal periods, `&`, en/em-dash. Stem length cap ~92 chars or "File Name is invalid".
- **A bare `X_<descriptive>` stem 422s** when no form# follows it; `X_042_<name>` (X_ + form#) is accepted. Non-OREF executed docs need a sale# or `<Addr>-Closing_X_` prefix.
- **Listing-side folders** carry linked LISTING-folder docs (`sale.listingGuid`) that appear in the sale doc list but 422 "Unable to find document" on the sale rename endpoint — expected, not a failure; the UNASSIGN still works.
- **`--incremental` (re-runs):** a re-run subagent invents WORSE names (bogus sale# prefix, misnumbered form). Never re-derive — only archive net-new dupes (prefix the EXISTING name), skip already-"ARCHIVE"-named docs, rename only genuine mislabels.
- **Read the doc before acting on a "wrong-cycle/wrong-property" verdict** — subagents have mislabeled a folder's OWN doc as foreign. Grep the doc's actual property/sale# first.

### Built-in safety + the contamination audit
- `build-phase5.mjs` protects dedup canonicals (won't archive a group's canonical unless its own action says archive — the wrong-cycle case), auto-backfills any activity that archiving would empty, and infers bundle cross-links from archive reasons.
- **Periodic cross-folder contamination audit** (does any folder hold another deal's files): [`subagent-prompts/contamination-scan.md`](subagent-prompts/contamination-scan.md) + `scripts/audit-*.mjs`. See [references/contamination-audit.md](references/contamination-audit.md).

## When phases flag for human

The pipeline biases false-negative. Flags surface in `tmp/<saleGuid>/FLAGS.md`. Common flag triggers:

- **Phase 2:** OREF# can't be identified with confidence (vision uncertain, hybrid form, scanned image with unreadable header)
- **Phase 3:** signer profile says `mutual` but only one side has sigs AND no superseding version exists in the folder → potential legal_gap. Triage via [references/compliance-vs-policy-gaps.md](references/compliance-vs-policy-gaps.md)
- **Phase 4:** dedup group has 3+ candidates and canonical-selection produces no clear winner (no envelope match, no signer-superset, similar timestamps)
- **Phase 6:** Broker Notes inputs missing (sale price, MLS, closing date, party names) — check Vault before flagging
- **Phase 7:** PATCH HTTP 4xx from SkySlope filename validator → consult [references/sanitize-fixes.md](references/sanitize-fixes.md) (forbidden chars, internal periods, `$`, etc.)
- **Phase 8b:** UI lock-store bug blocks the archive-folder move → fallback to filename ARCHIVE prefix (visual grouping); see [references/archive-and-trash-workflows.md](references/archive-and-trash-workflows.md)

Flags are reviewed before Matt approves Phase 7-9. A flag with `severity: legal_gap` blocks execution unconditionally until resolved.

## v5 filename convention (locked 2026-05-20)

```
{SaleAgreementNumber}_{X}_{Form#}_{FormName}.{ext}
```

- `SaleAgreementNumber` — extracted from PDF top-corner. Empty in listing folders.
- `X` — present only when `signer_status == fully_executed` per Phase 3.
- `Form#` — OREF number (`001`, `015`, `092`, etc.). Omitted for non-OREF docs.
- `FormName` — canonical title from `references/oref-form-library.md`.

Empty fields collapse the underscore. Examples in [references/v5-naming.md](references/v5-naming.md). Sanitization rules (forbidden chars, periods, special chars) in [references/sanitize-fixes.md](references/sanitize-fixes.md).

## Folder-vs-property policy (locked 2026-05-21)

One SkySlope folder per **property**, not per sale agreement. A property with three offer iterations (different sale#s) lives in ONE folder. v5 naming + Phase 6 `transaction-summary.txt` disambiguate which docs belong to which cycle.

## Cross-cutting principles

- **Read every page of every PDF.** Filenames lie. OCR-only trust fails on DigiSign overlays. Vision (LLM page render) is the source of truth. See [references/failure-modes.md](references/failure-modes.md) §1.
- **Verify against the form library.** Every OREF# resolves to a profile in [references/oref-form-library.md](references/oref-form-library.md). If lookup fails, FLAG — don't guess.
- **Vault is the source of truth for transaction state.** SkySlope is a workflow tool, not a system of record. Cross-check sale price, MLS, closing date against Vault per CLAUDE.md Work Standards.
- **Full company scope.** Audits run across all brokers + all mailboxes + max date range by default. Per-broker scoping requires explicit ask.
- **Velocity is not the goal.** Three files / hour wrong is worse than one file / two hours right. See [references/failure-modes.md](references/failure-modes.md) §"Pacing".

## References

| File | When to read |
|---|---|
| [references/failure-modes.md](references/failure-modes.md) | **Every phase, every subagent invocation** |
| [references/oref-form-library.md](references/oref-form-library.md) | Phase 2 + Phase 3 (form profile lookup) |
| [references/signer-validation.md](references/signer-validation.md) | Phase 3 algorithm |
| [references/bundle-detection.md](references/bundle-detection.md) | Phase 2 multi-form bundle detection |
| [references/canonical-selection.md](references/canonical-selection.md) | Phase 4 dedup tie-break rule |
| [references/v5-naming.md](references/v5-naming.md) | Phase 5 filename composition |
| [references/v4-naming.md](references/v4-naming.md) | Legacy reference (v4 is superseded by v5) |
| [references/skyslope-api-quirks.md](references/skyslope-api-quirks.md) | Phase 7-9 API gotchas (mailbox naming, filename validator, lock-store bug) |
| [references/archive-and-trash-workflows.md](references/archive-and-trash-workflows.md) | Phase 8b UI archive move |
| [references/sanitize-fixes.md](references/sanitize-fixes.md) | Phase 7 PATCH validator workarounds |
| [references/broker-notes-generation.md](references/broker-notes-generation.md) | Phase 6 spec |
| [references/transaction-summary-data-sources.md](references/transaction-summary-data-sources.md) | Phase 6 inputs (Vault, MLS, etc.) |
| [references/procedure-runbook.md](references/procedure-runbook.md) | Phase-by-phase command reference |
| [references/contamination-audit.md](references/contamination-audit.md) | The periodic cross-folder contamination audit (does a folder hold another deal's files) |
| [references/compliance-vs-policy-gaps.md](references/compliance-vs-policy-gaps.md) | Flag triage taxonomy |

## Subagent prompts

| File | When to use |
|---|---|
| [subagent-prompts/form-compliance-classifier.md](subagent-prompts/form-compliance-classifier.md) | **Step 3 of the runbook — the whole-folder classifier (USE THIS)** |
| [subagent-prompts/contamination-scan.md](subagent-prompts/contamination-scan.md) | Contamination audit — focused property check |
| [subagent-prompts/classifier.md](subagent-prompts/classifier.md) | Legacy per-doc classifier (superseded) |
| [subagent-prompts/signer-verifier.md](subagent-prompts/signer-verifier.md) | Legacy per-doc signer validator (superseded) |

## Scripts inventory

All scripts here are pure Node — none call the Anthropic API. Phase 2 + Phase 3 LLM work happens via `Agent` tool subagents using the prompts in `subagent-prompts/`.

**The 6 the runbook uses, in order:**

| Script | Step | Purpose |
|---|---|---|
| `scripts/fetch-folder-pdfs.mjs` | 1 | Download every doc binary + `manifest.json` (real extensions) into `tmp/skyslope-pdfs/<guid>/` |
| `scripts/dump-classify-context.mjs` | 2 | Write `documents.json` (valid docIds) + `checklist.json` (current activity assignments + numeric activityIds) |
| *(Agent subagent)* | 3 | Classify/dedup → `plan.json` — uses `subagent-prompts/form-compliance-classifier.md` |
| `scripts/build-phase5.mjs` | 4 | Schema-tolerant: turn `plan.json` → `phase5-plan.json` {renames,unassigns,assigns,cross_links}. `--incremental` for re-runs. Protects canonicals, backfills emptied activities, infers bundle cross-links |
| `scripts/execute-plan.mjs` | 5 | Apply the plan (PATCH renames / UNASSIGN / ASSIGN). Dry-run by default; `--execute` after approval; `--resume` retries failures. `sanitize()` carries every forbidden-char rule |
| `scripts/verify-fc.mjs` | 6 | Post-execute: live/archive counts, activities-with-2+-docs, 0 fabricated docIds |

**Supporting / on-call:**

| Script | Purpose |
|---|---|
| `scripts/pdf-text.mjs` | pdfjs text extraction (per page) — for read-before-archiving address checks |
| `scripts/form-library.mjs`, `sale-number-extractor.mjs`, `validator.mjs`, `cross-ref.mjs`, `v5-namer.mjs` | OREF lookup, sale#-extraction, signer algorithm, sale#-less cross-ref, v5 name composition (used by the subagent / as helpers) |
| `scripts/audit-coverage.mjs`, `audit-contamination.mjs`, `audit-verify-and-sources.mjs`, `fix-audit-gaps.mjs` | The periodic cross-folder **contamination audit** — see [references/contamination-audit.md](references/contamination-audit.md) |

**Deprecated and removed (2026-05-27 audit):**
- `claude-reader.mjs` — direct Anthropic API call from Bash (cost leak — see [failure-modes.md §6](references/failure-modes.md))
- `test-claude-reader.mjs` — tests the deprecated thing
- `process-folder.mjs` — v1 orchestrator that imported `claude-reader.mjs`
- `process-document.mjs` — v1 per-doc orchestrator
- `process-all-documents.mjs` — v1 batch orchestrator
- `v4-namer.mjs` — superseded by `v5-namer.mjs` (v4 reference doc kept for historical context)

The v2 pipeline replaces all v1 orchestrators with: Bash for SkySlope-only work + `Agent` tool subagents for Phase 2/3 LLM work + main session for Phase 4/5 plan composition + `execute-plan.mjs` for Phase 7-8 mutations.

## Test fixtures + evals

Test prompts in `evals/evals.json` run against frozen folder snapshots in `evals/fixtures/`:

- `evals/fixtures/712-sw-1st/` — Caldwell/Mendoza closing (April 2024) with 3 EFAs (1 canonical bundle, 1 sellers-only, 1 wrong cycle), 3 Prelim Titles (1 full, 2 abridged), 2 EMRs (identical receipts), 2 OREF 002 wood-stove addendums (envelope match), and ef69fb6f sellers-only LBP superseded by 3a29b3c2 bundle
- `evals/fixtures/bear-st/` — Hernandez closing requiring `_X` preserved on single_party OREF 043 / 092 / 080
- `evals/fixtures/ochoco-way/` — Stradford closing where prior subagent fabricated 51 placeholder docIds

Each fixture has `documents.json`, `sale-detail.json`, `binaries/*.pdf`, and `gold.json` (the hand-verified Phase 4 + Phase 5 output). The eval grades against `gold.json` for: (a) correct canonical winners, (b) zero fabricated docIds, (c) all single_party forms retain `_X`, (d) all bundles detected.

## Master inventory + deal dashboard toolchain (added 2026-06-09)

Cross-folder, read-only tooling that feeds the `/admin/deals` dashboard and the master transaction file. None of these mutate SkySlope.

| Script | Purpose |
|---|---|
| `scripts/skyslope-master-inventory.mjs` | Enumerate EVERY folder (sales + listings, archived included, 1990–2037 window, all brokers); save per-folder `detail.json` + `documents.json` under `tmp/skyslope-master/` |
| `scripts/skyslope-master-analyze.mjs` | Local re-derive of per-folder summaries (correct field names: `actualClosingDate`, `escrowClosingDate`, `contractAcceptanceDate`, `deadDate`, activity `status` ∈ Required/Optional/In Review/Completed) |
| `scripts/skyslope-master-file.mjs` | Property-centric merge → `tmp/skyslope-master/master.json` + `MASTER_TRANSACTIONS.md` (groups offer-cycle folders per property, carries BN review + doc-gap findings) |
| `scripts/skyslope-fetch-broker-notes.mjs` | Download + pdfjs-extract every live Broker Notes PDF for review (re-fetches doc lists live — saved `doc.url` S3 links expire in 5 min) |
| `scripts/skyslope-sync-dashboard.mjs` | Upsert master.json → Supabase `skyslope_transactions` + `skyslope_dashboard_meta` (service role) for `/admin/deals` |
| `scripts/skyslope-dashboard-refresh.mjs` | One command: inventory → analyze → master → sync |

Key facts the toolchain encodes (verified 2026-06-09): checklist activities carry NO `required` boolean — the per-activity `status` field IS the state machine; `GET /{kind}/{guid}/documents` returns mirror duplicates (dedup by docId); saved pre-signed S3 `doc.url`s expire in ~5 minutes; agentGuid map Matt `41c18058`, Rebecca `512ee312`, Paul `1f5cb058`.
