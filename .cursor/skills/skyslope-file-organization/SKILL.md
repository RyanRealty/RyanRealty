---
name: skyslope-file-organization
description: >-
  Rename, organize, audit, tag, or clean up documents inside SkySlope
  Forms listing or sale file folders. Encodes the LOCKED v4 filename
  convention (sale agreement number from the PDF + descriptive form
  name + `_X` suffix when fully executed — three fields, NO dates, NO
  OREF numbers, NO sequence numbers in the filename), the full-PDF
  OCR signer-match heuristic that decides the X, the checklist
  activity assignment via POST /api/files/{kind}s/{guid}/checklist-items/{activityId},
  and the supporting scripts under scripts/skyslope-forms-*.mjs and
  scripts/skyslope-checklist-*.mjs. Trigger eagerly any time the
  user asks to rename, tag, audit, assign to checklists, or "fix the
  filenames" in SkySlope; mentions OREF form numbers (001 RSA, 002
  addendum, 015 listing agreement, 022 SPD, 040 or 050 buyer rep,
  042 pamphlet, 092 advisory) in any naming or checklist context;
  asks how to detect fully-executed documents; mentions the `_X`
  suffix or the sale agreement number; or is about to edit any
  scripts/skyslope-*.mjs file. Load BEFORE any rename or assignment
  run — the convention here OVERRIDES every prior naming scheme.
---

# SkySlope file organization

The canonical naming convention and procedure for renaming every
document in every SkySlope Forms listing and sale file folder.

This skill exists because two earlier rename runs wasted real money on
the wrong filename convention before the rules were locked. Future runs
follow this byte-for-byte.

## When to use

Use this skill when any of the following is true:

- A user asks to rename, organize, tag, or clean up documents in
  SkySlope Forms file folders.
- A user mentions "the X" (meaning the fully-executed suffix), document
  naming convention, OREF form titles, or sale agreement numbers in the
  context of SkySlope.
- A user wants to audit which docs are fully executed.
- Any non-trivial change to `scripts/skyslope-forms-*.mjs`.
- Any new script or skill that produces SkySlope filenames.

Do NOT use this skill for SkySlope API authentication questions (use
`.cursor/skills/skyslope-api/` instead) or for folder-level metadata
fixes (those need SkySlope UI work — only document filenames are
PATCHable via the API).

## The canonical format

```
{SaleAgreementNumber}_{FormName}_X.{ext}
```

**Three fields. That's it.** Separated by underscores. Spaces are
allowed inside `FormName`. Extension preserved from the source
byte-for-byte. Each field can be omitted independently when it
doesn't apply.

**No dates.** **No OREF or OR form numbers.** **No sequence numbers.**
Matt does not want SkySlope filenames cluttered with that metadata —
the date is already shown in the SkySlope UI, the OREF number is
already implicit in the form name (and discoverable inside the PDF),
and sequence numbers obscure rather than clarify.

**Six examples to anchor the format:**

```
20702Beaumont_Residential Real Estate Sale Agreement_X.pdf
20702Beaumont_Sellers Property Disclosure Statement_X.pdf
20702Beaumont_Earnest Money Receipt.pdf
Listing Agreement Exclusive_X.pdf
Initial Agency Disclosure Pamphlet_X.pdf
20702Beaumont_Inspection Receipt - Sweep It Clean LLC.pdf
```

The last one shows the receipt rule: for receipts, photos, ZIP
bundles, and other non-form documents, **`FormName` becomes a
descriptive label** — short enough to read at a glance but specific
enough that Matt can tell what the doc is without opening it.

For the full convention with worked examples, anti-examples, and the
naming-receipts-and-images decision tree, read
`references/naming-convention.md`.

## What goes in each field

| Field | Source | When to omit |
|---|---|---|
| `SaleAgreementNumber` | The "Sale Agreement #" field at the top of the form, extracted from PDF text via OCR | When the form has no such field or the field is blank |
| `FormName` | Canonical OREF title from the lookup table for OREF forms, OR a short descriptive label for receipts/photos/non-OREF docs | Never — always present |
| `_X` | Fully-executed determination (see below) | When not all required signers have signed |
| `.{ext}` | Source file extension verbatim | Never change |

The sale agreement number is **read out of the PDF**, not synthesized
from MLS or folder metadata. Different agents use different conventions
(`20702Beaumont`, `RRP05132026`, `Fernewald072925`, `3.1A`). Extract
whatever they typed. If the field is blank, omit it — never substitute
MLS.

**Form names for OREF documents** use the canonical title from
`OREF_TITLES` in `scripts/skyslope-forms-document-taxonomy-v2.mjs`.
That table is the source of truth — extending it requires editing the
table, not improvising in the rename pipeline.

**Form names for non-OREF documents** (receipts, photos, lender
letters, title docs, HOA bundles, repair invoices, etc.) MUST be
descriptive labels a human can read and act on. Examples Matt would
accept:

- `Inspection Receipt - Sweep It Clean LLC.pdf`
- `Repair Invoice - Stanford Plumbing.pdf`
- `Pre-Approval Letter - Guild Mortgage.pdf`
- `Preliminary Title Report - Western Title.pdf`
- `Closing Statement - Seller Side.pdf`
- `Property Photo - Master Bedroom.jpg`
- `Septic Inspection Report.pdf`
- `HOA Documents - Sunriver Owners Association.zip`

Examples Matt rejects (too generic):

- `img_156940d0-9c45-4517-b182-1e155c31281c_395.png`
- `Receipt.pdf`
- `Document.pdf`
- `Scan-0042.pdf`

When the source filename or context doesn't make the label obvious,
OCR the document or scan the surrounding folder to figure out what it
is. The label is meant to save Matt from opening the file just to
identify it.

## The X (fully-executed) determination

The X suffix is the highest-priority piece of this skill. A false X is
a compliance risk; a missing X is just a cosmetic miss. Bias toward
false-negative — require every obligated party to be matched before
awarding X.

### Procedure

1. **OCR the full PDF.** Cap at 50 pages — covers every OREF form
   including long RSAs that sign on pages 13–15. Short reads were the
   single biggest cause of false-negative X in the prior run (5.5% X
   rate at 8-page cap vs 54% at 50-page cap).

2. **Identify the obligated signers** for the document's category. The
   full table is in `references/oref-signers.md`. Examples:
   - Listing agreement (OREF 015) → sellers only
   - Buyer rep agreement (OREF 040/050) → buyers only
   - 042 pamphlet → acknowledger (sellers on listing folder, buyers on
     sale folder)
   - RSA / counter / addendum / SPD / amendment → both sellers AND
     buyers
   - Receipts, lender, title, closing, generic advisories → any_party
     mode (any signature block in the doc counts)

3. **Match each obligated party against signature markers in the merged
   pdf.js + tesseract OCR text.** Try in order:
   - Full name within 500 chars of a signature marker (`DigiSign
     Verified`, `Signed by:`, `Electronically signed`, etc.)
   - First + last name (drops middle name/initial)
   - Last name alone if it's 4+ characters
   - Name appears inside a DigiSign Verified block (parse the signer
     name out of the line after the marker)

4. **Decide**:
   - All obligated parties matched → executed=true, confidence=high,
     append `_X`
   - Some matched → executed=false, confidence=medium, no X (log
     missing names for human review)
   - None matched or no PDF text → executed=false, confidence=low

5. **For `any_party` categories** (receipts, lender, title, closing,
   generic): 2+ signature markers OR 1+ DigiSign block in the PDF text
   → executed=true. The reasoning: one-sided docs have exactly one
   signature block, and if it's filled, the obligated party signed it.

The implementation is `detectExecuted()` in
`scripts/skyslope-forms-document-taxonomy-v2.mjs`. Don't reimplement.

## Hard guardrails

These exist because each one was learned from a real failure that cost
either compute or compliance risk. Don't cross them.

### Never PATCH with the new name as a query parameter

SkySlope's PATCH endpoint requires the new filename in the JSON body.
The query-parameter form returns HTTP 500 on every call.

```js
// Correct
fetch(`${BASE}/api/files/listings/${guid}/documents/${docId}`, {
  method: 'PATCH',
  headers: apiHeaders(session),
  body: JSON.stringify({ FileName: newName }),
})

// Wrong — returns 500
fetch(`${BASE}/api/files/listings/${guid}/documents/${docId}?FileName=${encodeURIComponent(newName)}`, {
  method: 'PATCH',
  headers: apiHeaders(session),
})
```

The existing `.cursor/skills/skyslope-api/SKILL.md` shows the wrong
pattern. Probed against the live API on 2026-05-16; JSON body is the
only working form.

### Preserve the source extension byte-for-byte

SkySlope rejects extension changes with HTTP 422 `File Extension can
not be changed` or `File Name is invalid`. Force `.pdf` on a `.jpg`
file and the PATCH fails. The taxonomy passes the source extension
explicitly to `suggestStandardNameV2` for exactly this reason.

### Skip pseudo-rows

`/documents` listings include placeholder rows that aren't real files
— `fileSize: -1`, `pages: null`, names like `2026_Admin`, `2026_Trash`,
`noname_303`, `unknown`. Any PATCH against them returns 422 `Unable to
find document with guid`. The detector `isUnpatchablePseudoDoc()`
catches them at task-enumeration time.

### Documents shared between listing + sale folders need cross-endpoint retry

A single doc can appear in both folders' `/documents` listings under
the same `id`, but SkySlope only allows PATCH from one side. When PATCH
fails with `Unable to find document with guid`, retry against the
sibling folder via `relatedSales` / `listingGuid` lookup. The recovery
script `skyslope-forms-recover-crossendpoint.mjs` handles this.

### Never archive, delete, or merge a folder via API

These operations are irreversible and the Files API as we have it
scoped doesn't expose them anyway. The folder gap report surfaces
folders that need archival or merging — but only for human action in
the SkySlope UI.

### Never apply X without confirmed signatures

The X suffix carries weight. Don't apply it from a hunch, don't apply
it from short PDF reads, don't apply it from non-signature text (form
boilerplate, party names in the body of the doc, etc.). If you can't
confirm the obligated parties signed via OCR text near signature
markers, the doc gets no X.

### Never invent a sale agreement number

When the PDF's `Sale Agreement #` field is blank or not present,
**omit the field entirely**. Don't substitute MLS, don't synthesize a
placeholder from the address, don't use the folder GUID. The folder
gap report flags transactions missing sale#s — that's a workflow gap
for the TC to fix on the form, not something to paper over with
synthesized data.

## The procedure (end-to-end)

For step-by-step commands, read `references/procedure.md`. Quick
summary of the eight scripts and their order:

1. `skyslope-forms-rename-documents-v2.mjs` — full pipeline dry-run
   (enumerate → OCR → detect → emit cache)
2. `skyslope-forms-apply-from-cache.mjs` — JSON-body PATCH from cache
3. `skyslope-forms-recover-failed.mjs` — extension-aware retry
4. `skyslope-forms-recover-crossendpoint.mjs` — sibling-folder retry
5. `skyslope-forms-force-x.mjs` — shared-doc X reconciliation
6. `skyslope-forms-verify.mjs` — post-apply state check
7. `skyslope-forms-folder-gap-report.mjs` — folder-level audit
8. `skyslope-forms-redetect-v3.mjs` — re-OCR + recompute against an
   existing cache (use when iterating on the taxonomy without
   re-enumerating folders)

All eight share auth via `skyslope-files-api.mjs` (HMAC + Session,
credentials in `.env.local`).

For a working knowledge of SkySlope's API quirks (PATCH method,
pseudo-rows, shared docs, rate limits, pagination), read
`references/api-quirks.md`.

## Reference files

- `references/naming-convention.md` — full format spec, regex,
  examples, anti-examples
- `references/oref-signers.md` — who signs each document category
- `references/api-quirks.md` — every SkySlope API gotcha encountered
- `references/procedure.md` — step-by-step pipeline commands

Read whichever is closest to the problem you're solving. The skill
body above carries the high-level rules; the references carry the
detail.

## Version

- **v4 (2026-05-18, locked — current)** — Three fields only:
  `{sale#}_{FormName}_X.{ext}`. NO dates. NO OREF#. NO seq#. Matt
  doesn't want metadata pollution in the filename. Descriptive
  labels for receipts and images.
- v3 (2026-05-17, retired) — included date + OREF#. Matt explicitly
  said the date doesn't belong in the filename.
- v2 (2026-05-16, retired) — space-separated, date+seq prefix.
  Wrong on multiple counts.
- v1 (earlier 2026-05-16, retired) — dash/underscore mess with
  category slugs.
