# Signer rules per document category

This table is the source of truth for which parties must sign each kind
of document. The X (fully-executed) suffix appears in a filename only
when every required signer for that doc has matched against signature
markers in the PDF text.

Code reference: `REQUIRED_SIGNERS_BY_CATEGORY` in
`scripts/skyslope-forms-document-taxonomy-v2.mjs`.

## Why these rules matter

The cost of getting this wrong is asymmetric:

- A false-positive X (claiming a doc is fully executed when it isn't)
  is a compliance risk. Matt is the principal broker on the license.
- A false-negative X (missing the X on a doc that IS executed) is a
  cosmetic miss that can be fixed in a follow-up pass.

Bias toward false-negative. Require ALL obligated parties to be matched
before awarding the X. If any required signer is missing from the OCR
text, no X.

## The table

| Document category | Required signers | Notes |
|---|---|---|
| `listing_agreement` (OREF 015) | sellers | Seller-only instrument — never reject for missing buyer signatures |
| `buyer_representation_agreement` (OREF 040, 041, 050) | buyers | Buyer-only instrument — never reject for missing seller signatures |
| `agency_disclosure_pamphlet` (OREF 042) | acknowledger | Acknowledger = sellers on a listing folder, buyers on a sale folder. First-contact pamphlet — only one side acknowledges |
| `sale_agreement_or_rsa` (OREF 001) | sellers AND buyers | Both sides must sign for the RSA to bind |
| `buyer_offer_or_package` | buyers | Offer-side document, not yet bound — buyer-only signatures expected |
| `counter_or_counteroffer` (OREF 003) | sellers AND buyers | Mutual instrument once accepted |
| `numbered_counter` (Counteroffer No. N) | sellers AND buyers | Same rule as counter |
| `addendum` (OREF 002 and variants) | sellers AND buyers | Mutual |
| `seller_property_disclosure` (OREF 020 / 022) | sellers AND buyers | Sellers sign as disclosing party; buyers acknowledge receipt |
| `inspection_or_repair` | sellers AND buyers | Mutual repair agreements |
| `amendment_or_notice` | sellers AND buyers | Mutual |
| `termination_or_release` | sellers AND buyers | Mutual |
| `lender_financing` (pre-approval, loan estimate) | any_party | Lender signs and/or buyer initials; any signature block is enough |
| `earnest_or_wire` | any_party | Escrow officer + party receipts; any signature block is enough |
| `title_or_hoa` | any_party | Title officer / HOA delivery acknowledgments; any signature block is enough |
| `closing_adjacent` (walk-through, closing statements) | any_party | Various signers depending on document |
| `other_pdf`, `other` | any_party | Catch-all for non-OREF advisories, advisories, ODS forms, etc. |

## How `any_party` mode decides X

For categories marked `any_party`, the detector doesn't look up specific
folder parties. It scans for signature evidence anywhere in the merged
pdf.js + OCR text:

- **High confidence X**: 4+ signature markers OR 2+ DigiSign Verified
  blocks
- **Medium confidence X**: 2–3 signature markers OR 1 DigiSign Verified
  block
- **No X**: fewer than 2 signature markers AND no DigiSign blocks

The reasoning: most one-sided non-OREF docs are signed by the party they
were issued to. A pre-approval letter has the lender's signature block.
An HOA delivery acknowledgment has the buyer's. A title report has the
title officer's. The presence of ANY signature block in such a doc means
the obligated party (whoever that is) signed.

## Advisory forms specifically

Most OREF advisories (043, 044, 047, 048, 080, 092, 103, 108) are
single-sided. The filename declares the side:

- `Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf` → seller-side
- `Advisory Regarding FIRPTA Tax - Buyer - 092 OREF.pdf` → buyer-side

These currently route through `any_party` mode (because `inferKindV2`
classifies them as `other_pdf`). The any_party heuristic correctly
matches the obligated party because there's exactly one signature
block per advisory.

If a future iteration needs to be stricter — e.g., match the named side
(`- Seller`) against the actual sellers from the folder — add a new
category in `inferKindV2` and a side-specific entry to
`REQUIRED_SIGNERS_BY_CATEGORY`. Don't bolt it on at the orchestrator
layer.

## Acknowledger resolution

For `agency_disclosure_pamphlet` the "acknowledger" role resolves at
runtime:

- Listing folder → sellers (the listing agent gives the pamphlet to the
  seller at first contact)
- Sale folder → buyers (the buyer's agent gives the pamphlet to the
  buyer at first contact), falling back to sellers if buyers aren't on
  the folder

This matches Oregon practice: the 042 is a first-contact-with-an-agent
artifact, one side per copy. Most transactions will have two copies of
the 042 — one in the listing folder (seller-acknowledged) and one in
the sale folder (buyer-acknowledged).
