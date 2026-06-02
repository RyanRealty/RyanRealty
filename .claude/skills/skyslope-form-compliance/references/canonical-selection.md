# Canonical Selection — Phase 4 dedup tie-break rule

Phase 4 groups all constituent forms by `(sale_number, oref_number, form_role)`. For each group with two or more candidates, this file defines the order of precedence for picking the canonical winner. Bias: false-negative. When no clear winner emerges, output `flag_for_human` — never guess.

## Precedence ladder (apply top-to-bottom; first decisive rule wins)

### Rule 1 — Bundle wins over standalone

If one candidate is a bundle (`is_bundle: true`) that contains the constituent form AND has `signer_status: fully_executed` for this form, and another candidate is a standalone single-form PDF with `signer_status: partially_executed` or `superseded_intermediate`, **the bundle is canonical.**

**Reasoning:** the bundle was the final closing package that both parties signed. The standalone is the earlier sellers-only or buyers-only intermediate that the bundle superseded. Archive the standalone.

**Example (712 SW 1st OREF 021 LBP):**
- `3a29b3c2` — 3-page bundle (EFA p1 + LBP p2-3), LBP fully executed with envelopes `da899d8f` + `9d91cf79` + `d10ffd9d`
- `ef69fb6f` — 1-page standalone LBP, sellers + Matt-agent only (buyer cert blank)

Verdict: `3a29b3c2` is the canonical LBP. `ef69fb6f` archives.

### Rule 2 — Fully-executed wins over superseded intermediate

If one candidate has `signer_status: fully_executed` and another has `signer_status: superseded_intermediate` (e.g., sellers-only signed an offer, buyers later signed a counter, but the original sellers-only stayed in the folder), **the fully-executed wins.**

**Reasoning:** the superseded intermediate is a workflow artifact, not the final record. The audit-defensible doc is the one with all obligated sigs.

**Example (712 SW 1st OREF 002 Residential Addendum):**
- `720dbeb1` — all 4 sigs (TW + MW sellers + NC + MM buyers)
- `1f0f0dd1` — sellers-only intermediate

Verdict: `720dbeb1` canonical, `1f0f0dd1` archives.

### Rule 3 — Most signers wins over partial

If two candidates have signers that are a strict superset/subset (i.e., one's signer set is a subset of the other's, including the same envelope IDs), **the superset wins.**

**Reasoning:** the superset is a later version where additional signers added their sigs to the same envelope.

### Rule 4 — Same content, newer upload wins

If two candidates have IDENTICAL content (same DigiSign envelope IDs, same signer set, same content hash if computed), **the newer `uploadDate` wins.**

**Reasoning:** the newer upload is typically a re-upload with a cleaner filename or after a metadata fix. Same content, no ambiguity, keep the newer one.

**Example (712 SW 1st Earnest Money Receipt):**
- `2c52ee38` — uploaded `2026-05-11T11:56:33`, named `X_Earnest Money Receipt.pdf`
- `20d1e3eb` — uploaded `2026-04-04T08:46:20.98`, named `X_Receipt For Funds.pdf`
- Both show the same Western Title receipt for the $2,000 Caldwell/Mendoza check #105 dated 04/08/24

Verdict: `2c52ee38` canonical (newer + cleaner filename), `20d1e3eb` archives.

### Rule 5 — Larger/more-complete wins for non-OREF docs

For non-OREF docs where there's no clear "executed" status (Prelim Title, Inspection Report, Tax Records), if one candidate is a strict content superset of another, **the larger version wins.**

**Reasoning:** Title companies often deliver an abridged Prelim first, then a full Prelim with all backing exhibits. The full one is the closing-ready record.

**Example (712 SW 1st Preliminary Title Report):**
- `abe92cee` — 57 pages, 4.5 MB, full Western Title Prelim with LiveLOOK cover + all exhibits (vesting deed, deeds of trust, plat, exception docs)
- `b1e92cee` — 13 pages, 267 KB, abridged Prelim with LiveLOOK cover but no exhibits
- `b2e92cee` — 12 pages, 217 KB, abridged Prelim minus LiveLOOK cover

Verdict: `abe92cee` canonical (most complete), `b1e92cee` + `b2e92cee` archive.

### Rule 6 — Wrong-cycle archives unconditionally

If a candidate has a `sale_number` that doesn't match the active cycle (e.g., a Boynton failed-offer EFA in a Caldwell closing folder), **archive it regardless of signer status** with the rename suffix `wrong cycle <buyer-name>`.

**Example (712 SW 1st OREF 043 EFA):**
- `5c3d1878` — created by "Michael Boynton" (failed Boynton offer), signed by Erik Boynton 04/04 — but the active cycle is `04022024AB` (Caldwell/Mendoza)

Verdict: `5c3d1878` archives as wrong-cycle. Phase 5 rename: `ARCHIVE - X_043_Advisory Regarding Electronic Funds - Boynton failed cycle.pdf`.

### Rule 7 — Flag for human

If none of rules 1-6 produce a clear winner — e.g., two candidates with non-overlapping signer sets, neither being a superset of the other — **output `flag_for_human` with the full ambiguity record:** both signer sets, both envelope IDs, both upload dates, both filenames.

Matt resolves the flag before Phase 7. Common case: two valid versions of the same form for different sub-purposes (rare but real).

## Output schema

Phase 4 emits `tmp/<saleGuid>/phase4.json` with this structure:

```json
{
  "dedup_groups": [
    {
      "group_key": { "sale_number": "04022024AB", "oref_number": "021", "form_role": "LBP" },
      "candidates": [
        { "docId": "3a29b3c2-...", "signer_status": "fully_executed", "is_bundle": true, "uploadDate": "...", "evidence": "..." },
        { "docId": "ef69fb6f-...", "signer_status": "superseded_intermediate", "is_bundle": false, "uploadDate": "...", "evidence": "..." }
      ],
      "verdict": {
        "rule": "Rule 1 — Bundle wins over standalone",
        "canonical": "3a29b3c2-...",
        "archive": ["ef69fb6f-..."],
        "rationale": "3a29b3c2 is a 3-page bundle with fully-executed LBP buyer cert (envelope d10ffd9d). ef69fb6f is a sellers-only intermediate that the bundle superseded."
      }
    }
  ],
  "flags": []
}
```

Flag entries get `"verdict": { "rule": "Rule 7 — Flag for human", "flag_for_human": true, "ambiguity": "..." }`.

Phase 5 reads `phase4.json` and composes the rename + UNASSIGN actions for every `archive` entry, plus the cross-link ASSIGN for any canonical that is a bundle (so the bundle docId attaches to every activity that needs any of its constituent forms).

See [`failure-modes.md`](failure-modes.md) §4 for the underlying problem this rule solves.
