# Bundle Detection — Phase 2 multi-form PDF detection

A bundle PDF is a single SkySlope document that contains two or more distinct OREF forms. Bundles arise when DigiSign packets bundle multiple forms into one envelope (common for closing packets), or when title companies merge addenda into the Prelim PDF, or when a TC pre-staged a multi-form package.

Bundles silently break the classifier if it only looks at page 1. The form on page 1 gets classified correctly; forms on pages 2+ are invisible. Every downstream phase (signer-validate, dedup, plan, checklist) misses them.

## Detection algorithm

For every PDF in `documents.json`:

1. Render every page to PNG via `scripts/_render-pdf-pages.mjs` at 150 DPI.
2. For each page, extract text via pdfjs. Scan for the OREF header pattern:

   ```regex
   OREF\s*(\d{3}[A-Z]?)\s*\|\s*Released
   ```

   The header appears top-of-page on every OREF form. The capture group is the OREF# (e.g., `043`, `022A`, `001`).

3. Build a `pages_by_oref` map: `{ "043": [1], "021": [2, 3] }` for a 3-page bundle with EFA on page 1 and LBP on pages 2-3.

4. If `Object.keys(pages_by_oref).length > 1`, the PDF is a bundle. Emit one `constituent_form` record per OREF# with its page range.

5. Also detect non-OREF bundles: a Prelim Title with attached exhibits is technically multi-form but the exhibits aren't independent forms — these have `is_bundle: false` and `oref_number: null` for the doc. Use the OREF header presence as the bundle gate: a PDF with one OREF# on page 1 and a different OREF# on page 2 IS a bundle; a PDF with one OREF# on page 1 and no further OREF headers anywhere is NOT a bundle (it's a single form, possibly with exhibits).

## Pseudo-code

```js
// scripts/phase2-bundle-detect.mjs
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const OREF_HEADER = /OREF\s*(\d{3}[A-Z]?)\s*\|\s*Released/

async function detectBundle(pdfPath) {
  const data = new Uint8Array(await fs.readFile(pdfPath))
  const doc = await getDocument({ data, verbosity: 0 }).promise
  const pagesByOref = {}
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const text = (await page.getTextContent()).items.map((x) => x.str).join(' ')
    const m = text.match(OREF_HEADER)
    if (m) {
      const oref = m[1]
      pagesByOref[oref] = pagesByOref[oref] || []
      pagesByOref[oref].push(i)
    }
  }
  const orefs = Object.keys(pagesByOref)
  return {
    is_bundle: orefs.length > 1,
    constituent_forms: orefs.map((oref) => ({
      oref_number: oref,
      page_range: pagesByOref[oref],
    })),
  }
}
```

## What page-1-only OCR missed (712 SW 1st docId `3a29b3c2`)

The actual content:

```
--- PAGE 1 ---
... OREF 043 | Released 01/2024 ... ADVISORY REGARDING ELECTRONIC FUNDS ...
... DigiSign Verified - da899d8f-... Travis White 04/04/2024 ... Misty White 04/05/2024 ...
... DigiSign Verified - 9d91cf79-... Naomi Caldwell 04/08/2024 ... Matthew Mendoza 04/08/2024 ... Amy M Brown 04/08/2024 ...

--- PAGE 2 ---
... OREF 021 | Released 01/2024 ... LEAD-BASED PAINT DISCLOSURE ADDENDUM ...
... DigiSign Verified - da899d8f-... (sellers initials TW MW) ...
... DigiSign Verified - 9d91cf79-... (buyer initials NC MM) ...

--- PAGE 3 ---
... OREF 021 | Released 01/2024 ... Page 2 of 2 ...
... Naomi Caldwell 04/08/2024 ... Matthew Mendoza 04/08/2024 ... Matthew Michael Ryan 04/05/2024 ... Amy M Brown 04/08/2024 ...
... DigiSign Verified - d10ffd9d-...
```

Filename was `X_043_Advisory Regarding Electronic Funds.pdf` — looked like a single-form doc. Page-1-only classification produced:

```json
{ "docId": "3a29b3c2", "oref_number": "043", "form_role": "EFA" }
```

Bundle detection produces:

```json
{
  "docId": "3a29b3c2",
  "is_bundle": true,
  "constituent_forms": [
    { "oref_number": "043", "form_role": "EFA", "page_range": [1] },
    { "oref_number": "021", "form_role": "LBP", "page_range": [2, 3] }
  ]
}
```

Downstream Phase 3 signer-validates both forms. Phase 4 considers this docId for both the EFA and LBP dedup groups. Phase 5 emits cross-link ASSIGN actions to BOTH the "Electronic Funds Advisory" and "Sale Addendums" (or "LBP" if it's a separate activity) checklist activities.

## Cross-link ASSIGN

A bundle docId attaches to multiple activities. SkySlope's checklist data model supports this: one `id` (docId GUID) can appear in `activity.checklistDocs[]` for multiple activities. Phase 8c emits the cross-link ASSIGN actions:

```
POST /api/files/sales/{guid}/checklist-items/{activityId-EFA}     body: { "documentGuid": "3a29b3c2" }
POST /api/files/sales/{guid}/checklist-items/{activityId-LBP}     body: { "documentGuid": "3a29b3c2" }
```

The bundle docId now satisfies BOTH activities. The per-activity audit shows the fully-executed bundle, not the sellers-only intermediates.

## Filename composition for bundles

Bundle docIds keep their primary OREF# in the v5 filename. The Broker Notes summary lists the bundle's constituent forms so the audit record is explicit:

```
04022024AB_X_043_Advisory Regarding Electronic Funds.pdf   ← primary OREF on page 1
                                                            ↓ Broker Notes notes:
"docId 3a29b3c2 is a bundle: pp1 OREF 043 (EFA, fully executed),
 pp2-3 OREF 021 (LBP, fully executed with buyer cert envelope d10ffd9d)"
```

Renaming the bundle to reflect both constituent forms (e.g., `EFA_and_LBP`) breaks the v5 grammar. Better to keep the primary OREF# in the filename and document the bundle in Broker Notes + Phase 5 plan.

See [`failure-modes.md`](failure-modes.md) §1 for the underlying problem. See [`canonical-selection.md`](canonical-selection.md) Rule 1 for how bundles win dedup over their superseded standalone counterparts.
