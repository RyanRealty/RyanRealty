# Handoff — SkySlope form-compliance cleanup (7 remaining "Jeanette" closed deals)

**Created:** 2026-06-04
**Owner:** Matt Ryan (licensed principal broker, Ryan Realty)
**Status:** 1 of 8 deals done (3480 SW 45th). 7 remaining. NOT started in any web/remote session — see "Environment reality" below.
**Branch context:** all SkySlope work is **live SkySlope API writes**, not git commits. Code/scratch live on Matt's Mac. This doc is the only artifact meant to travel between sessions.

---

## 0. READ THIS FIRST — Environment reality (verified 2026-06-04)

This task is **local-only**. It must run in a Claude Code session on **Matt's Mac at `/Users/matthewryan/RyanRealty`**. It cannot run in a Claude Code on the web / remote container. This was directly verified in a remote session on 2026-06-04 — every input the pipeline depends on is absent from a fresh clone:

| Dependency | Where it lives | Present in a fresh remote clone? |
|---|---|---|
| **SkySlope API credentials** (`SKYSLOPE_*` in `.env.local`) | gitignored `.env.local` on the Mac | ❌ No. Hard blocker — every fetch / dry-run / execute step hits the SkySlope API. |
| **Pipeline scripts** (`fetch-folder-pdfs.mjs`, `execute-plan.mjs`) | `.claude/skills/skyslope-form-compliance/scripts/` on the Mac | ❌ Only `references/` ships in the repo; `scripts/` is local. |
| **Scratch scripts** (`scope-8-scan.mjs`, `dump-classify-context.mjs`, `build-phase5-3480.mjs`) | gitignored `tmp/_meta-audit/` on the Mac | ❌ `tmp/` is gitignored (`.gitignore` line 51). |
| **Skill references** (failure-modes, oref-form-library, canonical-selection, bundle-detection, signer-validation, v5-naming) | `.claude/skills/skyslope-form-compliance/references/` on the Mac | ❌ Only `procedure-runbook.md` is committed; the other 6 are local. |
| **Input PDFs + 3480 worked outputs** | gitignored `tmp/skyslope-pdfs/`, `tmp/_meta-audit/fc-3480/` | ❌ Gitignored scratch. |

**Implication for whoever picks this up:** run it on the Mac. If a remote session must ever run it, someone has to (a) commit the 6 missing skill references + the `scripts/` dir, (b) provision `SKYSLOPE_*` secrets into the environment, and (c) confirm the network policy allows reaching the SkySlope API. Credentials and live PDFs are the unavoidable parts.

**Two non-turnkey spots even on the Mac:**
1. The scratch scripts (`dump-classify-context.mjs`, `scope-8-scan.mjs`, `build-phase5-3480.mjs`) are gitignored — if the Mac ever gets a clean clone they're gone. Keep a backup outside `tmp/`.
2. Pipeline step 4 ("generalize `build-phase5-3480.mjs` into a GUID-arg version") is a real code-writing step the agent does *before* the first execute. Deal #1 (Mayfield) is not zero-effort.

---

## 1. Mission

Run the form-compliance pipeline on the **7 remaining closed "Jeanette" deals**:

> classify → signer-validate → dedup → archive duplicates → v5-rename → fix mis-assignments

**Done / out of scope — do NOT touch:**
- **3480 SW 45th** — DONE. It is the **worked template**. Its outputs:
  - `tmp/skyslope-pdfs/59152e77-3d51-4b97-a06c-e9810c71689a/plan.json`
  - `tmp/_meta-audit/fc-3480/phase5-plan.json` + `execution-log.json`
- **Nordic** and the **12 "work set" deals** — DONE.
- **Active / pending files** — out of scope.

**This pass is FORMS only.** Sale metadata (escrow#, dates, prices, commissions, splits, listingPrice/MLS) was reconciled in prior sessions — do not re-touch it. Vault is the source of truth for transaction STATE; never reconcile against SkySlope.

---

## 2. The 7 remaining deals (do smallest-first)

GUIDs + doc counts were verified by the prior session's `tmp/_meta-audit/scope-8-scan.mjs` (runs clean). Re-run it first to confirm GUIDs/counts before starting.

| Order | Deal | saleGuid | Docs | Notes |
|---|---|---|---|---|
| 1 | Mayfield | `8b3033bd-59a8-4e67-9f31-b8566641fc07` | 43 | |
| 2 | Simpson | `f620aee8-2f1a-4025-be18-70a335beeb35` | 44 | Rebecca repped buyer |
| 3 | Jacklight | `69b85dea-e733-4b81-80cc-bf46c0af17cf` | 44 | |
| 4 | 703 SW 7th | `487bf3bf-1a35-417c-84e1-b803be012aa0` | 60 | buyer-side |
| 5 | School House | `32c42212-1097-4a16-ba5d-24ebae2acebb` | 72 | $3M, Both/off-market |
| 6 | Drouillard | `c9fcc145-311d-4a92-b23e-0ff6e61b126a` | 75 | Rebecca |
| 7 | Old Bend | `18380841-dce0-4db4-ad63-74c848020266` | 160 | large — subagent may need to chunk |

---

## 3. Per-deal pipeline (8 steps; 3480 is the proven example)

1. **Fetch PDFs**
   `node --env-file=.env.local .claude/skills/skyslope-form-compliance/scripts/fetch-folder-pdfs.mjs --kind=sale --guid=<GUID>`
2. **Dump context**
   `node --env-file=.env.local tmp/_meta-audit/dump-classify-context.mjs <GUID>`
   Writes `documents.json` (the ONLY valid docIds) + `checklist.json` (current activity assignments + activityIds) into `tmp/skyslope-pdfs/<GUID>/`.
3. **Classify / dedup** — spawn **ONE FOREGROUND** Agent subagent (general-purpose, **model sonnet**) using the subagent prompt in §6. It reads every page of every PDF + the skill refs + `documents.json`/`checklist.json` and writes `plan.json` to `tmp/skyslope-pdfs/<GUID>/`. Runs in ITS context, not the orchestrator's (3480's used ~400k tokens). **NEVER background** — shared rate limits fail opaquely.
4. **Build executor plan** — generalize `tmp/_meta-audit/build-phase5-3480.mjs` into a **GUID-arg version** that reads `plan.json`'s `reassignments` array (do NOT hardcode like the 3480 one did) → writes `tmp/_meta-audit/fc-<deal>/phase5-plan.json` with `{saleGuid, property, summary, renames[], unassigns[], assigns[], cross_links[]}`.
5. **Dry-run**
   `node .claude/skills/skyslope-form-compliance/scripts/execute-plan.mjs tmp/_meta-audit/fc-<deal>`
   Validates every docId vs live state.
6. **Surface a SHORT summary to Matt** — counts (archives, reassignments, flags) + the single most important finding. Matt chose **SUMMARY-LEVEL review**: execute on his "go", don't wait for full-plan sign-off each time.
7. **Execute** — append `--execute`. If any rename 422s, re-run with `--resume --execute` (skips already-2xx actions).
8. **Verify** — pull live; confirm live vs ARCHIVE counts, activities-with-2+-docs dropped, reassignment-target activities now filled, zero fabricated docIds.

---

## 4. Rename-validator rules (hard-won; violating = HTTP 422)

- Every `newName` MUST keep the original file extension (`.pdf` / `.png`). Dropping it → *"File Extension can not be changed."*
- Forbidden filename chars: `, ; < > : " | ? * &` internal-periods en/em-dash. `execute-plan.mjs` `sanitize()` already strips/replaces these (`,` and `;` were added this session) — keep it.
- A bare `X_<descriptive name with no form#>` (e.g. `X_Broker Notes - Transaction Summary`) 422s *"File Name is invalid"* — prefix with the sale# or a descriptive token (e.g. `<Addr>-Closing_X_...`). But `X_042_Initial Agency Disclosure` (`X_` + form#) is accepted.
- **v5 name** = `[sale#_][X_][form#_]FormName.ext`. Include `X` only when `signer_status == fully_executed`. Omit sale#/form# when the form doesn't bear them.

---

## 5. Constraints (non-negotiable)

- **Draft-First / Commit-Last:** surface each deal's plan summary, execute on Matt's explicit go.
- **NO bash script may import `@anthropic-ai/sdk` or hit `api.anthropic.com`.** Phase 2/3 vision = Agent subagents ONLY. Foreground OK; **NEVER background.**
- **docId discipline:** every docId emitted must exist verbatim in `documents.json`; reject any ending `-0000-0000-0000-000000000001`.
- **Read EVERY page of EVERY PDF** (bundles hide on page 2+). Single_party OREF forms (`043, 047, 080, 091, 092, 108`) need only ONE side's sig — don't strip their executed status. Bias **false-negative**: ambiguous → flag, don't guess.
- **Counter Offers** are often a legit SEQUENCE (No.1, No.2) — only archive true duplicates/superseded; keep distinct counters.
- **`image*.png`** files are almost always Outlook email-signature artifacts → archive.
- **Vault is the source of truth** for transaction STATE; this pass is FORMS only (metadata already reconciled — do not re-touch).
- Single checkout `main`. Live SkySlope API writes, not git commits. `tmp/_meta-audit` + `tmp/skyslope-pdfs` are gitignored scratch. Proactively clear `.git/index.lock` if it ever blocks you.

---

## 6. Subagent prompt (spawn one per deal — model sonnet, foreground, ANALYSIS-ONLY, no SkySlope mutations)

```
You are the Phase 2-5 form-compliance analyst for ONE closed SkySlope folder. Matt Ryan = licensed principal broker; every false classification or wrong dedup verdict is a compliance risk under OREA/ORS 696. Bias FALSE-NEGATIVE. ANALYSIS ONLY: make NO SkySlope API calls/mutations, and run NO script that imports @anthropic-ai/sdk.

DEAL: <DEAL LABEL> — saleGuid <GUID>.
READ IN FULL FIRST (absolute paths under /Users/matthewryan/RyanRealty/.claude/skills/skyslope-form-compliance/references/): failure-modes.md, oref-form-library.md, bundle-detection.md, canonical-selection.md, signer-validation.md, v5-naming.md.
THEN read: tmp/skyslope-pdfs/<GUID>/documents.json (the ONLY valid docIds) and tmp/skyslope-pdfs/<GUID>/checklist.json (current activity assignments + activityIds). The fetched PDFs are tmp/skyslope-pdfs/<GUID>/<docIdPrefix>__<filename> — Read EACH one (it renders pages so you SEE DigiSign sig overlays).

TASK: (1) Classify every doc — OREF# or doc-type, form role, sale#, parties, page-evidence; detect BUNDLES (different OREF# on later pages). (2) Signer-validate per signer_profile (single_party vs mutual). (3) Dedup: every (sale#,OREF#,role) group with 2+ candidates AND every checklist activity holding 2+ docs (see checklist.json) → pick ONE canonical + archive losers per canonical-selection.md; counters that are a real sequence are NOT duplicates. (4) Mark image artifacts for archive. (5) Identify mis-assignments (doc in the wrong checklist activity) and the correct target activityId from checklist.json.

HARD RULES: docId discipline (emit only docIds present verbatim in documents.json; never invent; reject -0000-...-001). Read every page. Page-evidence per claim. Ambiguous → flag_for_human.

OUTPUT: write tmp/skyslope-pdfs/<GUID>/plan.json:
{ "deal","saleGuid",
  "classifications":[{docId,filename,is_bundle,constituent_forms:[{oref_number,form_name,form_role,page_range,sale_number,signer_status,evidence}]}],
  "dedup_groups":[{activity_or_group,canonical_docId,archive_docIds:[],rule_applied,reason}],
  "archive_artifacts":[{docId,filename,reason}],
  "reassignments":[{docId,targetActivityId,targetActivityName,reason}],   // mis-filed docs → correct activity
  "flags":[{docId,issue}], "summary":"" }
Validate every docId against documents.json before writing. Return ONLY a short text summary (counts + top finding) — the full JSON is in plan.json.
```

> Note: this subagent prompt was improved over the original 3480 run — it now emits a `reassignments` array so the step-4 plan-builder is **data-driven** instead of hardcoded (the one brittle spot in the 3480 build).

---

## 7. Pipeline phase reference (from the skill's procedure-runbook.md)

The committed `procedure-runbook.md` describes the broader end-to-end audit (enumerate → fetch+OCR → identify → extract sale# → validate execution → emit v5 name → PATCH back → assign to checklist → unassign+archive → broker notes). Key durable facts from it:

- **PATCH back** uses `PATCH /api/files/{kind}s/{guid}/documents/{docId}` with JSON body `{ FileName: newName }`. Never query-param form (HTTP 500). Preserve extension byte-for-byte.
- **Checklist assign:** `POST /api/files/{kind}s/{guid}/checklist-items/{activityId}` with the doc's GUID. Form-to-activity mapping lives in `scripts/_nordic-checklist-assign.mjs` `FORM_TO_ACTIVITY`.
- **OREF 042 + brokerage-internal BBSA pattern:** Form 9.4 Buyer Representation Agreement is brokerage-internal, NOT OREF. When a buyer signs 9.4 via direct email (not a SkySlope envelope), the OREF 042 Initial Agency Disclosure Pamphlet ack is NOT bundled in → real compliance gap (Oregon law requires the pamphlet ack at first substantive contact). The SkySlope envelope that bundles 042 + 050 (sometimes 047) has subject *"Envelope completed: Next steps: Please review & sign your buyer agreement."* If audit finds a 9.4 but no 042 envelope completion → search broker inboxes for a standalone 042; if none, recommend resending a fresh 042 and flag with `askOf: "Matt"`.
- **Broker inbox roster (as of 2026-05-26) is 4 accounts:** `matt@ryan-realty.com`, `rebeccapeterson@ryan-realty.com` (NOT `rebecca@`), `paul@ryan-realty.com` (all Workspace via service-account DWD), plus `matt.lists.homes@gmail.com` (personal Gmail — DWD does NOT work; uses Playwright session from `scripts/_gmail-login-capture.mjs` → `tmp/gmail-session-matt-lists-homes.json`, re-capture ~every 14 days).

---

## 8. When done

- Report per-deal: docs, archives, reassigns, flags.
- Update the prior handoff `docs/HANDOFF_SKYSLOPE_AUDIT_2026-05-29.md` (exists on the Mac; NOT in remote clones) — add a `2026-05-31+` "deal N/8 done" block per deal.
- Append any new validator/dedup learnings to the memory file `~/.claude/projects/-Users-matthewryan-RyanRealty/memory/reference_skyslope_form_compliance_lessons.md`.

---

## 9. Open / unrelated thread — broken listing page

Matt mentioned a property **listing page not working**. That is a **separate problem**: the Next.js property listing route on `ryan-realty.com` (the website in this repo), NOT SkySlope. Unlike the SkySlope work, that one is fully diagnosable in this repo (web or local). To pick it up, the next agent needs: the route/URL and the symptom (404 / blank render / wrong data / build error). No work has been done on it yet.

---

## 10. Ready-to-paste cold-start prompt

A fully self-contained prompt that hands a fresh Mac session everything in §1–§6 is what Matt has been pasting. The canonical copy is this document — §1 through §6 reproduce it verbatim. To cold-start: open a Claude Code session in `/Users/matthewryan/RyanRealty` and paste §1–§6 (or point the agent at this file). Start STEP 0 by invoking the `skyslope-form-compliance` skill and reading its `references/failure-modes.md`, `oref-form-library.md`, `canonical-selection.md`.
