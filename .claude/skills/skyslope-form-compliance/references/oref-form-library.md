# OREF + Ryan Realty form library (canonical)

This is the source of truth for which form is which, who must sign,
and where the signature blocks live on the page. Every SkySlope doc
operation runs through this library first.

When the matcher hits a form NOT in this library, the doc is flagged
for human review and the rename pipeline DOES NOT touch it. Library
expansion happens in this file, never inline in code.

## How a row works

Each form entry contains:

- **`formId`** — kebab-case stable identifier used internally
- **`name`** — canonical name for the v4 filename `FormName` field
- **`oref`** — OREF form number (informational, NOT used in filename)
- **`category`** — high-level type (sale_agreement, addendum, advisory, etc.)
- **`headerRegex`** — RegExp that hits the form-number stamp on page 1
- **`titleRegex`** — RegExp that hits the form title text on page 1
- **`pages`** — typical page count (range)
- **`signers`** — required signer roles + count
- **`signatureBlocks`** — where on the form the blocks live + role of each
- **`notes`** — important quirks, common substitutions, history

## Required signer roles (vocabulary)

- `seller` — a seller named on the folder
- `buyer` — a buyer named on the folder
- `seller_broker` — listing broker (almost always Matt or Paul/Rebecca via co-listing)
- `buyer_broker` — buyer-side broker
- `acknowledger` — the party first introduced to agency (seller on a listing folder, buyer on a sale folder)
- `lender` — mortgage broker / loan officer
- `escrow_officer` — title company escrow officer
- `title_officer` — title company title officer
- `single_party` — exactly one signature; the form has no role distinction
- `not_applicable` — never executed, e.g. an unsigned reference/template

When a form has MULTIPLE buyers or MULTIPLE sellers, each named party
must have a separate signature block filled. A 2-buyer, 2-seller
transaction needs ALL FOUR blocks filled on the RSA.

---

## OREF 001 — Residential Real Estate Sale Agreement (RSA)

```yaml
formId: oref-001-rsa
name: Residential Real Estate Sale Agreement
oref: 001
category: sale_agreement
headerRegex: /OREF[-\s]*001|Residential\s+Real\s+Estate\s+Sale\s+Agreement|\bRSA\b/i
titleRegex: /residential\s+real\s+estate\s+sale\s+agreement/i
pages: 13-16
signers: [buyer, seller]  # ALL named buyers AND ALL named sellers
signatureBlocks:
  - page: ~14-15 (last 2 pages of base form)
    roles: [buyer, buyer, seller, seller]  # 2x each role typical
notes:
  - The Sale Agreement # field is the canonical sale identifier.
    Extract it for the v4 filename.
  - If an addendum is attached as part of the same PDF, signature
    blocks for the addendum also appear, but they don't substitute
    for the RSA blocks.
  - Watch for OREF-001-LP variant ("Land Patent" rider) — same
    formId for our purposes, different signature page layout.
```

## OREF 002 — Sale Agreement Addendum

```yaml
formId: oref-002-addendum
name: Sale Addendum
oref: 002
category: addendum
headerRegex: /OREF[-\s]*002|Sale\s+Agreement\s+Addendum/i
titleRegex: /sale\s+agreement\s+addendum/i
pages: 2-4
signers: [buyer, seller]
signatureBlocks:
  - page: last page
    roles: [buyer, buyer, seller, seller]
notes:
  - Often filed as "Addendum 1", "Addendum 2", etc. The numbering
    isn't in the filename per v4 — multiple addendums share the same
    FormName and are distinguished by sale agreement number context.
```

## OREF 003 — Counter Offer

```yaml
formId: oref-003-counter
name: Counter Offer
oref: 003
category: counter
headerRegex: /OREF[-\s]*003|Counter\s+Offer/i
titleRegex: /counter\s+offer/i
pages: 2-3
signers: [buyer, seller]
signatureBlocks:
  - page: 2-3
    roles: [buyer, buyer, seller, seller]
notes:
  - Numbered counters ("Counteroffer No. 2") are the same form with
    a sequence number on page 1. Sequence number does not enter the
    filename per v4.
```

## OREF 015 — Listing Agreement (Exclusive Right to Sell)

```yaml
formId: oref-015-listing-agreement
name: Listing Agreement and SA
oref: 015
category: listing_agreement
headerRegex: /OREF[-\s]*015|Exclusive\s+Right\s+to\s+Sell|Listing\s+Agreement/i
titleRegex: /listing\s+agreement|exclusive\s+right\s+to\s+sell/i
pages: 4-7
signers: [seller, seller_broker]  # seller(s) + listing broker
signatureBlocks:
  - page: last page
    roles: [seller, seller, seller_broker]
notes:
  - Seller-only instrument from the buyer's perspective. Never
    require buyer signatures.
  - The listing broker signature also required for execution.
```

## OREF 020 / 022 — Sellers Property Disclosure

```yaml
formId: oref-020-spd
name: Sellers Property Disclosure
oref: 020  # 022 is the alternate revision; same logic
category: spd
headerRegex: /OREF[-\s]*02[02]|Seller'?s?\s+Property\s+Disclosure/i
titleRegex: /seller'?s?\s+property\s+disclosure/i
pages: 5-9
signers: [seller, buyer]
signatureBlocks:
  - page: last page
    roles: [seller, seller]  # disclosing party signs
  - page: very last
    roles: [buyer, buyer]  # acknowledging party signs receipt
notes:
  - Sellers sign as DISCLOSING party; buyers sign as RECEIVING.
  - A doc with only seller signatures is NOT fully executed — the
    buyer acknowledgment is also required.
```

## OREF 040 — Disclosed Limited Agency Agreement for Sellers

```yaml
formId: oref-040-disclosed-limited-agency-sellers
name: Disclosed Limited Agency Agreement for Sellers
oref: 040
category: agency_agreement
headerRegex: /OREF[-\s]*040|Disclosed\s+Limited\s+Agency.*Sellers?|Limited\s+Agency.*Seller/i
titleRegex: /disclosed\s+limited\s+agency.*sellers?|limited\s+agency.*seller/i
pages: 2-4
signers: [seller, seller_broker]
signatureBlocks:
  - page: last page
    roles: [seller, seller, seller_broker]
notes:
  - SELLER-SIDE disclosed-agency instrument. Do NOT confuse with the
    buyer rep (OREF 050) or with the buyer-side disclosed-agency (OREF 041).
  - 712 SW 1st St audit (2026-05-26) surfaced a real misclassification
    where an OREF 040 was attached to the Buyers Rep Agreement activity.
    OREF 040 belongs on a seller-side disclosed-agency activity, never
    on Buyers Rep Agreement.
  - Checklist activity mapping: `Disclosed Limited Agency` (or
    `Disclosed Limited Agency Agreement for Sellers` when the template
    distinguishes).
```

## OREF 041 — Disclosed Limited Agency Agreement for Buyers

```yaml
formId: oref-041-disclosed-limited-agency-buyers
name: Disclosed Limited Agency Agreement for Buyers
oref: 041
category: agency_agreement
headerRegex: /OREF[-\s]*041|Disclosed\s+Limited\s+Agency.*Buyers?|Limited\s+Agency.*Buyer/i
titleRegex: /disclosed\s+limited\s+agency.*buyers?|limited\s+agency.*buyer/i
pages: 2-4
signers: [buyer, buyer_broker]
signatureBlocks:
  - page: last page
    roles: [buyer, buyer, buyer_broker]
notes:
  - BUYER-SIDE disclosed-agency instrument. Distinct from OREF 050
    (the actual buyer representation agreement).
  - Checklist activity mapping: `Disclosed Limited Agency`.
```

## OREF 050 — Residential Buyer Representation Agreement (Exclusive)

```yaml
formId: oref-050-buyer-rep
name: Residential Buyer Representation Agreement - Exclusive
oref: 050
category: buyer_rep
headerRegex: /OREF[-\s]*050|Residential\s+Buyer\s+Representation\s+Agreement|Exclusive\s+Right\s+to\s+Represent/i
titleRegex: /residential\s+buyer\s+representation|exclusive\s+right\s+to\s+represent/i
pages: 3-5
signers: [buyer, buyer_broker]
signatureBlocks:
  - page: last page
    roles: [buyer, buyer, buyer_broker]
notes:
  - This is the actual Buyers Rep Agreement. OREF 040 is NOT a
    buyer rep — do not conflate.
  - Checklist activity mapping: `Buyers Rep Agreement`.
  - Alt names: "Buyer Service Agreement" (older revision label).
```

## OREF 042 — Initial Agency Disclosure Pamphlet

```yaml
formId: oref-042-pamphlet
name: Initial Agency Disclosure
oref: 042
category: agency_disclosure
headerRegex: /OREF[-\s]*042|Initial\s+Agency\s+Disclosure|Disclosure\s+Pamphlet/i
titleRegex: /initial\s+agency\s+disclosure|agency\s+disclosure\s+pamphlet/i
pages: 2-4
signers: [acknowledger]  # one party only
signatureBlocks:
  - page: last page
    roles: [acknowledger]
notes:
  - The 042 is acknowledged at first contact. ONE side per copy.
  - In a listing folder, the acknowledger is the seller.
  - In a sale folder, the acknowledger is the buyer.
  - Most transactions have TWO copies of the 042 — one in each
    folder. Each copy needs only one signature.
```

## OREF 043 / 044 — Electronic Funds / Wire Fraud Advisory

```yaml
formId: oref-043-electronic-funds
name: Electronic Funds Advisory
oref: 043  # 044 is paired buyer/seller variant
category: advisory
headerRegex: /OREF[-\s]*04[34]|Electronic\s+Funds|Wire\s+Fraud/i
titleRegex: /electronic\s+funds|wire\s+fraud\s+advisory/i
pages: 1-2
signers: [single_party]
signatureBlocks:
  - page: last
    roles: [single_party]
notes:
  - One signature block. The filename declares the side:
    "- Seller" vs "- Buyer" — keep that suffix in FormName if present.
```

## OREF 047 / 048 — Real Estate Compensation Advisory

```yaml
formId: oref-047-compensation-advisory
name: Real Estate Compensation Advisory
oref: 047  # 048 is the buyer-side variant
category: advisory
headerRegex: /OREF[-\s]*04[78]|Real\s+Estate\s+Compensation\s+Advisory/i
titleRegex: /real\s+estate\s+compensation\s+advisory/i
pages: 1-2
signers: [single_party]
signatureBlocks:
  - page: last
    roles: [single_party]
notes:
  - Per Oregon 2024 reforms, this is the "before showing/before
    signing buyer rep" advisory. One side per form.
```

## OREF 080 — Smoke Alarms / Carbon Monoxide Advisory

```yaml
formId: oref-080-smoke-alarms
name: Smoke Alarms Advisory
oref: 080
category: advisory
headerRegex: /OREF[-\s]*080|Smoke\s+Alarm|Carbon\s+Monoxide/i
titleRegex: /smoke\s+alarm|carbon\s+monoxide/i
pages: 1-2
signers: [seller]  # listed context; seller acknowledges responsibility
signatureBlocks:
  - page: last
    roles: [seller]
notes:
  - Almost always on the listing side. Single seller signature
    block.
```

## OREF 092 — FIRPTA Advisory

```yaml
formId: oref-092-firpta
name: FIRPTA Advisory
oref: 092
category: advisory
headerRegex: /OREF[-\s]*092|FIRPTA|Foreign\s+Investment\s+in\s+Real\s+Property\s+Tax/i
titleRegex: /firpta\s+advisory|firpta\s+notice/i
pages: 1-2
signers: [single_party]  # side per filename suffix
signatureBlocks:
  - page: last
    roles: [single_party]
notes:
  - Filename usually carries "- Seller" or "- Buyer". Preserve that
    side designation in FormName.
```

## OREF 098 — Notice of Real Estate Compensation (commission demand)

```yaml
formId: oref-098-compensation-notice
name: Notice of Real Estate Compensation
oref: 098
category: compensation_notice
headerRegex: /OREF[-\s]*098|Notice\s+of\s+Real\s+Estate\s+Compensation|Compensation\s+Demand/i
titleRegex: /notice\s+of\s+real\s+estate\s+compensation/i
pages: 1-2
signers: [seller_broker]  # broker outgoing to title
signatureBlocks:
  - page: last
    roles: [seller_broker]
notes:
  - Issued by the LISTING broker (Matt) to title with payee
    instructions. Single broker signature.
```

## OREF 103 / 108 — Real Estate Forms Advisory

```yaml
formId: oref-103-forms-advisory
name: Real Estate Forms Advisory
oref: 103  # 108 is buyer-side
category: advisory
headerRegex: /OREF[-\s]*10[38]|Real\s+Estate\s+Forms\s+Advisory/i
titleRegex: /real\s+estate\s+forms\s+advisory/i
pages: 1-2
signers: [single_party]
signatureBlocks:
  - page: last
    roles: [single_party]
notes: []
```

## OREF 057 — Termination of Contract

```yaml
formId: oref-057-termination
name: Termination of Contract
oref: 057
category: termination
headerRegex: /OREF[-\s]*057|Termination\s+of\s+Contract|Mutual\s+Termination/i
titleRegex: /termination\s+of\s+contract|mutual\s+termination/i
pages: 1-2
signers: [buyer, seller]
signatureBlocks:
  - page: last
    roles: [buyer, buyer, seller, seller]
notes:
  - Mutual instrument. Both sides sign to terminate.
  - Distinct from OREF 059 (Receipt of Reports / Removal of
    Contingencies) — termination ends the contract; 059 keeps it alive
    after contingencies are removed.
  - Checklist activity mapping: `Termination of Contract`.
```

## OREF 059 — Receipt of Reports / Removal of Contingencies Addendum

```yaml
formId: oref-059-receipt-reports-removal-contingencies
name: Receipt of Reports / Removal of Contingencies Addendum
oref: 059
category: contingency_removal
headerRegex: /OREF[-\s]*059|Receipt\s+of\s+Reports|Removal\s+of\s+Contingencies/i
titleRegex: /receipt\s+of\s+reports|removal\s+of\s+contingencies/i
pages: 1-2
signers: [buyer]
signatureBlocks:
  - page: last
    roles: [buyer, buyer]
  - page: last
    roles: [seller, seller]  # optional acknowledgment
notes:
  - Buyer-driven instrument. Buyer signatures REQUIRED for execution.
  - Seller acknowledgment signatures are optional — their absence does
    NOT block execution.
  - Common misroute: don't confuse with OREF 057 Termination of
    Contract. 057 ends the deal; 059 keeps it alive by removing the
    contingencies. Different activity classes.
  - Checklist activity mapping: `Contingency Removal Addendum` (NOT
    Termination of Contract).
  - 712 SW 1st St audit (2026-05-26) surfaced a real misclassification
    where an OREF 059 was attached to Termination of Contract.
```

## OREF 060 — Contingency Removal

```yaml
formId: oref-060-contingency-removal
name: Contingency Removal
oref: 060
category: contingency_removal
headerRegex: /OREF[-\s]*060|Contingency\s+Removal(?!\s+Addendum)/i
titleRegex: /contingency\s+removal(?!\s+addendum)/i
pages: 1
signers: [buyer]
signatureBlocks:
  - page: last
    roles: [buyer, buyer]
notes:
  - Buyer-only-required by spec (removing a contingency is the
    buyer's right). Seller signature optional.
  - Checklist activity mapping: `Contingency Removal Addendum`.
```

## OREF 083 — Buyer's Contingent Right to Purchase Addendum

```yaml
formId: oref-083-buyers-contingent-right-to-purchase-addendum
name: Buyer's Contingent Right to Purchase Addendum
oref: 083
category: addendum
headerRegex: /OREF[-\s]*083|Contingent\s+Right\s+to\s+Purchase/i
titleRegex: /contingent\s+right\s+to\s+purchase/i
pages: 2-3
signers: [buyer, seller]
signatureBlocks:
  - page: last
    roles: [buyer, buyer, seller, seller]
notes:
  - Mutual instrument. Used when buyer's purchase is contingent on
    selling another property.
  - Checklist activity mapping: `Contingent Right To Purchase`.
```

## OREF 109 — Notice from Buyer to Seller

```yaml
formId: oref-109-notice-buyer-to-seller
name: Notice from Buyer to Seller
oref: 109
category: notice
headerRegex: /OREF[-\s]*109|Notice\s+from\s+Buyer\s+to\s+Seller/i
titleRegex: /notice\s+from\s+buyer\s+to\s+seller/i
pages: 1-2
signers: [buyer]
signatureBlocks:
  - page: last
    roles: [buyer, buyer]
notes:
  - Buyer-issued notice. Sister form to OREF 110 (other direction).
  - Checklist activity mapping: `Notice to Buyer | Seller` or
    `Notice from Buyer`.
```

## OREF 110 — Notice from Seller to Buyer

```yaml
formId: oref-110-notice-seller-to-buyer
name: Notice from Seller to Buyer
oref: 110
category: notice
headerRegex: /OREF[-\s]*110|Notice\s+from\s+Seller\s+to\s+Buyer/i
titleRegex: /notice\s+from\s+seller\s+to\s+buyer/i
pages: 1-2
signers: [seller]
signatureBlocks:
  - page: last
    roles: [seller, seller]
notes:
  - Seller-issued notice. Sister form to OREF 109 (other direction).
  - Checklist activity mapping: `Notice to Buyer | Seller`.
  - 712 SW 1st St audit (2026-05-26) surfaced a real misclassification
    where an OREF 110 was attached to Home Inspection. Notice forms
    NEVER go on Home Inspection — that's for inspection reports.
```

---

## Non-OREF document categories

For docs that aren't OREF forms — receipts, photos, lender packages,
title docs, HOA bundles, repair invoices, etc. — there's no form
library entry. They use descriptive FormName labels (see v4-naming.md).

The compliance contract for non-OREF docs:

| Category | FormName pattern | Required signer (if any) |
|---|---|---|
| Earnest Money Receipt | `Earnest Money Receipt` | escrow_officer (one block) |
| Funds-to-Close Receipt | `Funds to Close Receipt` | escrow_officer |
| Preliminary Title Report | `Preliminary Title Report` | title_officer |
| Final Settlement Statement | `Final Settlement Statement` | escrow_officer + parties (variable) |
| Closing Disclosure | `Closing Disclosure` | parties |
| Pre-Approval Letter | `Pre-Approval Letter - <lender>` | lender |
| Proof of Funds | `Proof of Funds` | single_party |
| Inspection Report | `Home Inspection Report - <inspector>` | not_applicable (report) |
| Inspection Receipt | `Inspection Receipt - <inspector>` | inspector |
| Repair Receipt | `Repair Receipt - <vendor>` | vendor |
| Repair Invoice | `Repair Invoice - <vendor>` | vendor |
| HOA Documents | `HOA Documents - <association>` | not_applicable |
| Title Report Pamphlet | `Title Insurance Pamphlet` | not_applicable |
| Property Photo | `Property Photo - <subject>` | not_applicable |

For receipts/invoices/letters with a single signer: the doc is
"executed" when that single signer's block has a signature. NOT when
"any 2 markers" appear.

For pure reports (inspection reports, prelim title reports, HOA
documents): they're never executed by the parties. NO X SUFFIX EVER.
These are reference documents.

---

## Library extension

When a doc surfaces that doesn't match any entry here:

1. The pipeline writes its OCR text and source filename to
   `tmp/skyslope-form-library-needs-review.jsonl`
2. The doc is RENAMED to source filename verbatim (no v4 applied)
3. The doc gets `checklist activity = no_activity_match`
4. This file gets a new entry once Matt confirms the form identity

NEVER bolt new forms into the matcher without adding them here.
NEVER guess a form's signer profile.
