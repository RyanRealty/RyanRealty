# Broker Notes generation (per unique sale agreement number per folder)

When to read: a folder is missing a Broker Notes attachment; a folder
contains documents from multiple sale agreement cycles and may need
multiple Broker Notes PDFs; you are extending v5-namer or
`process-document.mjs` to capture additional fields per form type; you
are building a transaction-summary PDF; you need to know what each
OREF form contributes to the narrative.

## Purpose

Every SkySlope transaction folder must have a "Broker Notes" checklist
activity attachment that gives Matt (principal broker) and any future
auditor a one-page synthesis of what happened in that deal cycle. The
narrative is what a regulator, attorney, or successor broker reads
first; it is the file's executive summary.

## Multiple Broker Notes in one folder

A single SkySlope sale folder can hold documents from **multiple sale
agreement cycles** when an earlier cycle dies and a new one replaces
it on the same property. Example from the Nordic pass: the Closed
folder contains both `RP08242025_*` docs (the successful Halpin close)
AND `RRP04212025_*` docs (the earlier Uchikawa cycle that fell out).
Each sale agreement number needs its OWN Broker Notes summary — the
RP08242025 one cannot stand in for RRP04212025 and vice versa. Audit
trail clarity requires per-cycle narrative.

## Discovery rule

To find which sale agreement numbers exist in a folder, scan the
`fileName` field of every document for the prefix pattern
`^[A-Z]{1,4}\d{8}_` (after stripping any leading `ARCHIVE - `). Sale
agreement numbers in this brokerage follow the convention
`<broker-initials><MMDDYYYY>`:

- `RP08242025` = Rebecca Peterson, August 24, 2025
- `RRP04212025` = Rebecca Ryser-Peterson, April 21, 2025
- `MR05072025` = Matt Ryan, May 7, 2025

Deduplicate the captures across all docs in the folder.

For each unique sale agreement number found, check whether a Broker
Notes PDF with that prefix is attached to the folder's `Broker Notes`
checklist activity. Pattern: filename matching
`/^<saleNumber>_X_Broker Notes - Transaction Summary(\s.*)?\.pdf$/i`
where `<saleNumber>` is the sale agreement number. Missing per-sale-#
Broker Notes is a compliance gap.

## Naming convention (v5)

- **Primary** (successful or active cycle):
  `<saleNumber>_X_Broker Notes - Transaction Summary.pdf`
- **Earlier failed cycle** sitting in a folder with a later successful
  cycle (compliance footnote):
  `<saleNumber>_X_Broker Notes - Transaction Summary - Failed Cycle.pdf`
- **Revision** (superseding prior version):
  rename the prior to
  `ARCHIVE - <saleNumber>_Broker Notes - Transaction Summary - superseded.pdf`
  and assign the new one to the activity (see post-rename UNASSIGN
  workflow in [archive-and-trash-workflows.md](archive-and-trash-workflows.md)).

## Content checklist (per sale agreement number)

1. **Sale agreement header** — `<saleNumber>`, signing broker, signing
   date, listing agent + firm, buyer agent + firm, MLS#, escrow#,
   escrow officer + company.
2. **Parties** — sellers (with name spelling matched against the Sale
   Agreement page 1 + any disclosure forms), buyers (same).
3. **Money** — original list, final list, contract sale price, MLS
   close price (if closed), earnest money amount + receipt date +
   issuing officer, commission % + gross + splits, seller credits or
   buyer concessions and which form documented them.
4. **Timeline** — offer date, acceptance date, contingency removal
   date(s), close-of-escrow date (target + actual), termination date
   if canceled, key counter-offer cycle if material.
5. **Disposition** — Closed (with MLS close), Canceled (with the
   specific contingency that triggered termination + which 057
   Termination Agreement or which form documented it), Pending (with
   current activity status).
6. **Cross-cycle context** — if this is a failed cycle in a folder
   that also contains a later successful cycle (or vice versa), name
   the other cycle and the date it superseded this one. Example:
   "RRP04212025 contingency failed 2025-MM-DD; property re-listed and
   accepted offer from Halpin under RP08242025 on 2025-08-24."
7. **File gaps** — any required activity that's missing its doc, any
   doc in Trash/Admin folder, any unresolved compliance flag.

## Data primacy (PDF first, API/Supabase secondary)

The Broker Notes narrative is **assembled from data extracted from
the PDFs themselves during the same Phase 6 OCR scan** that v5-namer
uses to classify and validate forms — NOT primarily from API metadata.
[scripts/process-document.mjs](../scripts/process-document.mjs)
already calls `extractSaleAgreementNumber(ocrText)`; the extraction
contract below extends that pattern to all Broker-Notes-feeding
fields.

API + Supabase data is used to **cross-validate** what the PDFs say
(e.g. SkySlope `sale.salePrice` vs OREF 001 contract sale price), to
**fill gaps** when the PDF doesn't carry a field (e.g. MLS subdivision
name), and to **flag discrepancies**. The PDFs are primary; the API
is secondary; Supabase is tertiary. Whenever they disagree, state
both values + the reason.

## Per-form extraction contract

Each form class contributes specific fields during the OCR scan. Add
new entries as new form classes get exercised.

| Form class (per `oref-form-library.md`) | Extract | OCR anchor | Feeds Broker Notes field |
|---|---|---|---|
| OREF 001 (Residential Sale Agreement) | sale agreement # | "Sale Agreement #" / "Sale Agreement Number" header (top-right or top-left page 1) | sale# header |
| OREF 001 | sellers (full names, capitalization) | "Seller(s):" block page 1 | parties.sellers |
| OREF 001 | buyers (full names) | "Buyer(s):" block page 1 | parties.buyers |
| OREF 001 | contract sale price | "Purchase Price" / "$________" page 1 | money.contractSalePrice |
| OREF 001 | acceptance date | "Acceptance Date" page 1 or last-signed signature block | timeline.acceptanceDate |
| OREF 001 | target COE | "Closing Date" page 1 | timeline.targetCloseDate |
| OREF 001 | contingencies declared | "Contingencies" / "Subject to" sections | timeline.contingencies (list) |
| OREF 002 / Sale Addendum | sale# (from header) + addendum subject (1-line summary) | "Addendum #" + body text first paragraph | timeline.addendums |
| OREF 003 / Counter-offer | counter# (1, 2, 3...) + price counter + last-signed date | "Counter Offer No." header + price field | timeline.counterOffers (sequenced) |
| OREF 022A / Repair Addendum | repair credit amount or scope | "Repair" + dollar amount | money.repairCredit |
| OREF 057 / Termination Agreement | termination date + reason | "Terminated" / "Cancel" + signed date | disposition (when canceled) |
| OREF 083 / Contingent Right to Purchase | contingency type (sale of buyer's home, etc.) + deadline | "Contingent upon" + date | timeline.contingencies |
| Earnest Money Receipt | EM amount, receipt date, issuing officer name, escrow file # | "FUNDS IN THE AMOUNT OF: $", "FILE NO.:" | money.earnestMoney, header.escrowNumber, header.escrowOfficer |
| Preliminary Title Report | escrow file # (cross-check vs EM Receipt), title officer name | "Order No:" / "File No:" | header.escrowNumber (cross-check) |
| ALTA / Final Settlement Statement | actual sale price, actual COE date, seller credits, commission | "Total Sales Price", "Settlement Date", "Seller Credit" | money.actualSalePrice, timeline.actualCloseDate, money.sellerCredits |
| OREF 020 / Seller's Property Disclosure | year built, square footage (declared) | "Year built", structural / mechanical sections | header context (cross-check vs MLS) |
| OREF 042 / Initial Agency Disclosure | which broker side (listing vs buyer rep) + date acknowledged | "Listing Broker" / "Buyer's Broker" + signature date | parties.agencyChain |
| OREF 050 / Buyer Rep Agreement | buyer rep firm + agent + expiration | "Buyer's Broker:" + termination clause | parties.buyerSideAgent |
| Broker Notes (prior version) | full content for the diff — when superseding, capture what changed | entire body | revisionHistory note |

## Capture surface (extending report.jsonl)

Every per-document scan writes an `extractions` object into the
per-folder report
(`tmp/skyslope-form-compliance-<date>/<guid>-report.jsonl`). Each line
currently carries `docId`, `formId`, `saleNumber`, `isCanonical`,
`archiveReason`, `proposedName`. Extend the entry shape to:

```jsonc
{
  "docId": "...",
  "formId": "oref-001-rsa",
  "saleNumber": "RRP04212025",
  "extractions": {
    "buyers": ["Elsa Uchikawa", "Hirosaku Uchikawa"],
    "sellers": ["Douglas Halpin", "Masayo Halpin"],
    "contractSalePrice": 1395000,
    "acceptanceDate": "2025-04-21",
    "targetCloseDate": "2025-07-14",
    "contingencies": ["inspection", "financing", "contingent on buyer sale (OREF 083)"]
  }
}
```

Each form's extraction populates only the fields it can speak
authoritatively to.

## Conflict handling

When two docs with the same saleNumber disagree (e.g. OREF 001 lists
two buyers but OREF 042 lists three), surface as
`extractions._conflicts` in the report — Broker Notes generation flags
those for human resolution rather than silently picking one.

## Aggregation at Broker Notes generation

For each unique saleNumber in a folder, the producer
([scripts/_nordic-build-summaries.mjs](../../../../scripts/_nordic-build-summaries.mjs)
to be extended) reads the entire report.jsonl, filters entries by
`saleNumber === <sn>`, and rolls up the `extractions` objects into one
narrative dataset. Then it weaves in API metadata (escrow, lender,
commission from `/api/files/sales/{guid}`) and Supabase MLS data —
but the PDF-derived facts always come first in the narrative.

**This means every Broker Notes generation is downstream of a fresh
OCR pass.** Stale reports = stale Broker Notes. If a folder hasn't
been v5-named since a doc was uploaded, scan first, then generate.

## Sale-price reconciliation

When the OREF 001 contract sale price disagrees with the ALTA
Settlement actual sale price or the MLS ClosePrice, the Broker Notes
must state all three values + the reason for any delta (typically
seller credit toward buyer closing costs). Never adopt one source
silently.

## Ingest gotchas (locked 2026-05-25 from 712 SW 1st St pass)

**SkySlope email ingest normalizes filenames:** spaces in attachment
filenames become underscores AND a random `_NNN` suffix is appended.
So a sent attachment `04022024AB_X_Broker Notes - Transaction Summary.pdf`
arrives as `04022024AB_X_Broker_Notes_-_Transaction_Summary_715.pdf`.
The post-ingest matcher MUST use a regex that splits the expected
baseName on `[\s_-]+` runs and rejoins with a flexible `[\s_-]+`
character class — see
[scripts/_712-broker-notes-finalize.mjs](../../../../scripts/_712-broker-notes-finalize.mjs)
for the canonical pattern.

**Ingest can take 10-25 min, not 1-5:** the prior estimate of "1–5 min"
in earlier lessons was wrong for closed-status folders. Plan polling
windows for at least 25 min; consider firing the email and decoupling
the ingest/PATCH/assign step into a separate finalize script that
holds open the poll.

**Multiple sends → multiple ingests:** sending the same baseName twice
(e.g. you fixed a bug and re-sent) results in 2 different ingested
docs with the same prefix but different `_NNN` suffix. The finalize
script should keep the **newest by `uploadDate`** as canonical and
rename the older(s) to
`ARCHIVE - <baseName> - superseded.pdf` (per the post-rename UNASSIGN
+ ARCHIVE workflow). The 712 pass had 5 ingests for 2 baseNames after
a Spark-correction resend; the dedup pass handled all 5 correctly.

## Generation flow

Operationalized in
[scripts/_nordic-closed-finalize.mjs](../../../../scripts/_nordic-closed-finalize.mjs)
for the single-PDF case:

1. Build the `.txt` summary per sale-#. Existing producer:
   [scripts/_nordic-build-summaries.mjs](../../../../scripts/_nordic-build-summaries.mjs)
   — extend with per-sale-# grouping when a folder has multiple cycles.
2. Convert `.txt` → PDF (use `pdfkit` or `puppeteer`; the prior pass
   used a simple monospace layout — readability over polish since this
   is an internal compliance doc).
3. Email the PDF to the folder's `portalEmail` field
   (`sale.portalEmail`, format like `<StreetName><Number>@skyslope.com`)
   from `matt@ryan-realty.com` via the existing Gmail service-account
   DWD impersonation. Subject:
   `[<address> <status> forward] Broker Notes - Transaction Summary (<saleNumber>)`.
   SkySlope ingests within 1–5 min.
4. PATCH the new doc to the v5 filename
   (`<saleNumber>_X_Broker Notes - Transaction Summary.pdf`).
5. Assign the new doc to the folder's `Broker Notes` checklist activity
   via `POST /api/files/sales/{guid}/checklist-items/{activityId}`
   with body `{ documentGuid: <newDocId> }`.
6. If superseding an existing Broker Notes: rename the prior version
   to
   `ARCHIVE - <saleNumber>_Broker Notes - Transaction Summary - superseded.pdf`
   AND unassign it from the activity (post-rename UNASSIGN workflow in
   [archive-and-trash-workflows.md](archive-and-trash-workflows.md)).

## Compliance gap report

Every audit pass (including
[scripts/skyslope-forms-folder-gap-report.mjs](../../../../scripts/skyslope-forms-folder-gap-report.mjs))
should flag any folder where the unique sale agreement numbers ≠ the
unique Broker Notes per-sale-# coverage. Example detector logic:

```js
// For each folder
const docs = await getDocs(folderGuid)
const saleNumbers = new Set(
  docs.map((d) => (d.fileName || '').replace(/^ARCHIVE\s*-\s*/i, '').match(/^([A-Z]{1,4}\d{8})_/)?.[1])
       .filter(Boolean)
)
const brokerNotesPerSale = {}
for (const d of docs) {
  if (/^ARCHIVE/i.test(d.fileName)) continue
  const m = d.fileName.match(/^([A-Z]{1,4}\d{8})_X_Broker Notes - Transaction Summary/i)
  if (m) brokerNotesPerSale[m[1]] = d.fileName
}
for (const sn of saleNumbers) {
  if (!brokerNotesPerSale[sn]) flag(`Missing Broker Notes for ${sn} in ${folder.label}`)
}
```

## Per-folder, not per-sale-#

Broker Notes is a folder-level compliance artifact, not a
sale-#-level one. The same RRP04212025 sale that died in Closed
Nordic, Canceled-A, and Canceled-B should have a folder-tailored
Broker Notes in each location it surfaces. Three different audiences
(closed file auditor, buyer-side broker review, seller-side broker
review), three different narratives, one common sale#. Don't try to
deduplicate across folders.
