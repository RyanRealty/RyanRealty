# Failure Modes — read before every phase

Five regression classes have surfaced across the 712 SW 1st / 15352 Bear St / 29500 SE Ochoco Way passes. Each one corrupts a downstream phase if it isn't caught at the source phase. Every phase script + every subagent prompt loads this file. Apply the counter-rules below.

---

## 1. Bundle PDFs — one PDF holds two or more OREF forms

**What broke (712 SW 1st):** docId `3a29b3c2` was named "X_043_Advisory Regarding Electronic Funds.pdf" but is actually a 3-page bundle:
- Page 1 = OREF 043 EFA
- Pages 2-3 = OREF 021 LBP with fully-executed buyer cert (Caldwell + Mendoza signed 04/08/2024)

Classifier looked at page 1 only, saw "OREF 043", marked the doc as EFA-only. Downstream:
- Phase 3 signer validation never checked the LBP portion
- Phase 4 dedup never recognized this doc as a candidate for the LBP activity
- A separate sellers-only LBP intermediate (`ef69fb6f`) was flagged as a federal 42 USC 4852d legal_gap because no buyer cert appeared to exist
- The "gap" was illusory — buyer cert was in pages 2-3 of the bundle

**Root cause:** filename trust + page-1-only OCR.

**Counter-rule (Phase 2):**

1. Render EVERY page of EVERY PDF (`scripts/_render-pdf-pages.mjs`).
2. Scan EVERY page for an OREF form header (pattern: `OREF\s*(\d{3}[A-Z]?)\s*\|\s*Released`). The matcher lives in [`bundle-detection.md`](bundle-detection.md).
3. When a PDF contains two or more distinct OREF numbers, mark `is_bundle: true` and emit one constituent-form record per detected OREF# with its page range.
4. Downstream phases (3, 4, 5, 8) iterate over `constituent_forms`, not `documents`. A single docId can produce assignments to multiple checklist activities and multiple dedup groups.

---

## 2. Single_party vs mutual form-class — false `_X` strip

**What broke (Bear St):** a subagent enforcing "both sides must sign" stripped `_X` from OREF 092 (Counter) when only the counter-offering party signed, from OREF 043 (EFA) when only the buyer signed, from OREF 080 (Mutual Termination) when only one party initiated.

These forms are **single_party by design** — they only ever carry one side's sigs. Treating them as mutual marks fully-executed docs as unexecuted, then Phase 5 archives them as superseded, then Phase 8 unassigns them from active activities → audit-defensible record collapses.

**Root cause:** rule applied without form-class lookup.

**Counter-rule (Phase 3):**

Single_party OREF forms (verified against [oref-form-library.md](oref-form-library.md)):

| OREF# | Form name | Signer profile |
|---|---|---|
| 043 | Advisory Regarding Electronic Funds (EFA) | `single_party` — buyer OR seller, not both |
| 047 | FIRPTA Affidavit | `single_party` — seller only (or buyer-side equivalent on buyer transactions) |
| 080 | Mutual Termination Agreement | `single_party` — initiating party only (mutual is implied by acceptance, not signature count) |
| 091 | Notice of Real Estate Compensation | `single_party` — principal broker only |
| 092 | Counter Offer | `single_party` — counter-offering party only |
| 108 | Notice (various) | `single_party` — issuing party only |

For these forms, the signer-validation algorithm checks the relevant SINGLE side's signature block(s), not both. Output `signer_status: fully_executed` when that side's sigs are present.

Mutual OREF forms (signer profile `mutual`): 001 RSA, 002 Addendum, 003 Counter, 020 SPD, 021 LBP, 022A Buyer Repair, 022B Seller Repair, 025 EIFS, 057 Termination, 081 Septic, 082 Well — these require BOTH sides + applicable agents.

When in doubt, look up [oref-form-library.md](oref-form-library.md). If the OREF# isn't in the library, FLAG — don't guess at form class.

---

## 3. Subagent docId fabrication

**What broke (Ochoco Way):** a Phase 2 subagent returned 51 docIds ending `-0000-0000-0000-000000000001`. These weren't in `documents.json` — they were synthesized by the subagent because it didn't have the live document inventory and was filling gaps.

Downstream Phase 5 built a rename plan referencing fake docIds. Phase 7 PATCH calls all returned HTTP 404. Two hours of recovery: re-spawn with corrected prompt + match real docIds back to the subagent's output by short-prefix.

**Root cause:** subagent prompt didn't carry the documents.json contents AND didn't explicitly forbid placeholder generation.

**Counter-rule (every subagent invocation):**

1. The prompt template MUST embed the contents of `documents.json` (or pass it as an attached file the subagent must read first).
2. The prompt MUST contain literally:
   > "Every docId in your output MUST exist verbatim in `documents.json`. Reject any GUID ending `-0000-0000-0000-000000000001` or any GUID you cannot find by `documents.find((d) => d.id.toLowerCase() === yourGuid.toLowerCase())`. If a doc seems to be missing from `documents.json`, output `flag_for_human` with the form name + page evidence. Do not invent a docId."
3. The orchestrator validates every returned docId against `documents.json` before accepting subagent output. Output containing fabricated docIds fails-closed and the subagent is re-spawned with the violation cited.

See [`subagent-prompts/classifier.md`](../subagent-prompts/classifier.md) and [`subagent-prompts/signer-verifier.md`](../subagent-prompts/signer-verifier.md) for the canonical prompt templates.

---

## 4. Same-(sale#, OREF#) dedup not grouped at Phase 0

**What broke (712 SW 1st):** the folder had 3 EFAs, 2 EMRs, 3 Prelim Titles, 2 OREF 002 wood-stove addendums (envelope-identical), 2 OREF 002 Residential Addendums (one superseded sellers-only), 2 OREF 025 EIFS (one superseded), all assigned to the same activities. None of these duplicates were flagged at Phase 0 — they were discovered manually at the end, requiring 23 PDFs to be re-read in a tail-end pass.

**Root cause:** Phase 0 didn't group same-form candidates. Dedup was deferred to a manual sweep instead of being part of the planning pass.

**Counter-rule (Phase 4):**

1. After Phase 3 produces `constituent_forms[]` (each with `oref_number`, `sale_number`, `form_role`, `signer_status`, `docId`), group by `(sale_number, oref_number, form_role)`.
2. Every group with `length >= 2` is a dedup candidate. Apply the canonical-selection rule from [`canonical-selection.md`](canonical-selection.md) to pick the winner.
3. Output `dedup_groups[]` with `canonical` winner + `archive` losers per group. Groups where no clear winner emerges output `flag_for_human` with the ambiguity.
4. Phase 5 emits an `ARCHIVE - <name> - <reason>.pdf` rename for each loser + UNASSIGN from its current activity.

A folder with zero dedup groups passes Phase 4 trivially. A folder with multiple groups produces a deterministic, audit-defensible dedup plan in `tmp/<saleGuid>/phase4.json`.

---

## 5. DigiSign overlay text invisible to pdfjs

**What broke (multiple passes):** pdfjs OCR extracts text content from PDF text streams but DOES NOT see DigiSign envelope overlays (the green/blue stamps with signer name + date stamp that appear on top of signed PDFs). Multiple times, a fully-executed doc looked unsigned to a pdfjs-only verifier.

Vision-LLM page render DOES see the overlay because it processes the rendered raster.

**Root cause:** OCR-only trust.

**Counter-rule (Phase 2 + Phase 3):**

1. The signature presence check uses VISION on the rendered PNG, not pdfjs text extraction.
2. pdfjs is still useful for two things:
   - DigiSign envelope IDs (visible in the PDF metadata stream — pdfjs CAN see these even when overlays aren't rendered into text)
   - Form fields, page headers, sale# extraction (these ARE in the text stream)
3. The signer-verifier subagent (`subagent-prompts/signer-verifier.md`) reads both the rendered PNG (for visible sigs) AND the pdfjs text extraction (for envelope IDs + form metadata). It cross-references the two.

If a signature is visible in the render but no envelope ID matches it, that's still a valid sig (could be a wet signature scan). If an envelope ID exists in metadata but no visible signature renders on the expected page, FLAG for human review (possible orphaned envelope).

---

---

## 6. Direct Anthropic API calls from Bash scripts (double-billing)

**What broke:** the v1 skill ships [`scripts/claude-reader.mjs`](../scripts/claude-reader.mjs) which imports `@anthropic-ai/sdk` and uses `ANTHROPIC_API_KEY` from `.env.local` to make vision-OCR calls against `https://api.anthropic.com/v1/messages`. Every doc it processes is a SEPARATE billing line on Matt's Anthropic API console on top of his Claude Code plan. 40-60 docs per folder = 40-60 metered API calls that should have been zero-additional-cost work inside Claude Code.

**Root cause:** the v1 skill predates `Agent` tool subagents. Anything needing an LLM routed through a direct API call. With Claude Code's `Agent` tool now available, that LLM work belongs inside Claude Code under Matt's plan.

**Counter-rule:**

1. **NEVER call a script that imports `@anthropic-ai/sdk` or hits `api.anthropic.com` directly.** [`scripts/claude-reader.mjs`](../scripts/claude-reader.mjs) is the canonical violator — deprecated.
2. **Phase 2 + Phase 3 use `Agent` tool subagents.** Parallel is fine. Background is fine. Both run under Matt's Claude Code plan.
3. **Bash scripts are still fine** for: SkySlope API auth/fetch/PATCH/POST, pdfjs text extraction, page rendering with napi-canvas, Gmail-API sends, text→PDF conversion. None of those call Anthropic.
4. **Audit every Bash script before invoking** — if it has `import Anthropic from '@anthropic-ai/sdk'` or `ANTHROPIC_API_KEY` references, do not call it.

See [[feedback_no_background_subagents]].

## Pacing

**Velocity is not the goal.** Three files / hour wrong is worse than one file / two hours right. Every false `_X`, missed duplicate, or fabricated docId costs more recovery time than slowing down at Phase 2-3 to verify against `oref-form-library.md` + `documents.json`.

If a constituent form has any ambiguity, FLAG — don't decide. Phase 4's canonical-selection bias is false-negative: when no clear winner, output `flag_for_human` and let Matt resolve before Phase 7.

See related: [`canonical-selection.md`](canonical-selection.md), [`bundle-detection.md`](bundle-detection.md), [`signer-validation.md`](signer-validation.md), [`oref-form-library.md`](oref-form-library.md).
