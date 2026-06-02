# Signer validation algorithm

The replacement for `detectExecuted()` in
`scripts/skyslope-forms-document-taxonomy-v2.mjs`.

Old detector failed Matt's compliance bar by:
1. Falling back to "2 signature markers = executed" when folder
   party data was missing (line 547 of the old file)
2. Treating receipt/lender/title/closing docs as `any_party` and
   awarding X on 2+ markers even when the obligated party hadn't
   actually signed their block
3. Counting markers globally instead of validating each role's block

This algorithm fixes all three.

## Inputs

```
{
  formId: 'oref-001-rsa',        // from form library matcher
  ocrText: '<all 50 pages>',     // full PDF text via pdfjs + tesseract
  pages: [{ index, text }],      // per-page text array
  folderDetail: {                 // OPTIONAL — for name-based validation
    sellers: [{ name, ... }],
    buyers: [{ name, ... }],
  },
}
```

## Algorithm

For each obligated signer role declared by the form library entry,
attempt to validate. ALL roles must pass for `executed=true`. ANY
miss → `executed=false`.

### Role: `seller` (every named seller must sign)

1. Get the list of seller names from `folderDetail.sellers`.
2. If empty, fall through to structural validation (see below).
3. For each seller name:
   - Build name variants: `Full Name`, `First Last`, `Last` (≥4 chars).
   - Scan the OCR text for ANY variant within 500 chars of a
     signature marker (`DigiSign Verified`, `Signed by:`,
     `Electronically signed`, `Signature:`, `Initials:`, etc.).
   - If matched, that seller is signed. If not, this seller is
     missing.
4. ALL sellers must be signed for the role to pass.

### Role: `buyer` (every named buyer must sign)

Same as `seller`, but using `folderDetail.buyers`.

### Role: `seller_broker` / `buyer_broker`

1. Use the known broker roster: Matt Ryan (`matt@ryan-realty.com`),
   Rebecca Peterson (`rebeccapeterson@ryan-realty.com`), Paul
   Stevenson (`paul@ryan-realty.com`).
2. Match any of the broker's full names within 500 chars of a
   signature marker.
3. If the folder's `listAgentEmail` or `saleAgentEmail` is set, use
   THAT specific broker.

### Role: `acknowledger`

1. If folder is a listing → acknowledger = sellers.
2. If folder is a sale → acknowledger = buyers (fall back to sellers
   if buyers aren't populated).
3. Validate using the seller/buyer algorithm above.

### Role: `lender`, `escrow_officer`, `title_officer`, `inspector`, `vendor`

These don't have folder party data. Use the FORM's signature block
structure to validate:

1. Locate the form's expected signature block in the OCR text using
   the form library's `signatureBlocks` entry.
2. Look for a signature marker (`DigiSign Verified`, `Signed by:`,
   stamp pattern, etc.) within ±300 chars of the block anchor.
3. If found AND the block has a name on the next line (or signer
   role label is filled), executed = true for this role.
4. If no marker found in the block region, executed = false.

### Role: `single_party`

The form has exactly ONE expected signature. Validate:

1. The form's `signatureBlocks[0]` has a signature marker present.
2. The block has a name or initials filled.
3. If both, executed = true. Otherwise false.

DO NOT count markers elsewhere in the doc — only the declared block.

### Role: `not_applicable`

The form is a report or reference. NO X ever. `executed = false`
unconditionally.

## Structural validation (fallback when folder party data missing)

If the form library entry declares signature block ROLES with
positions, use these instead of names:

```yaml
# Example: OREF 001 RSA
signatureBlocks:
  - page: ~14-15
    roles: [buyer, buyer, seller, seller]
```

Procedure:

1. Locate the signature page(s) in the OCR text. Each form's
   library entry tells you which pages.
2. For each declared role slot:
   - Look for a signature marker within the page text.
   - If the role is `buyer` or `seller`, ensure the marker is in a
     block whose label/header text indicates that role (e.g., a line
     like "BUYER" or "BUYER 1" or "SELLER" near the block).
3. Count filled blocks per role.
4. The role passes ONLY IF every declared slot has a filled marker.

This means a 2-buyer / 2-seller RSA needs FOUR filled blocks. Two
buyers + zero sellers = NOT executed.

## Signature markers (the regex)

```js
const SIGNATURE_MARKERS = /
  digisign\s+verified |
  docusign(?:ed)?  |
  electronically\s+signed |
  digitally\s+signed |
  envelope\s+id |
  signed\s+by[\s:] |
  completed\s+by[\s:] |
  \bsignature[\s:] |
  \binitials?[\s:] |
  \[sign(?:ed|ature)? \s*here\] |
  /s/\s+\w+ |        # /s/ Matthew Ryan style stamp
  /gix
```

A "filled" block has at least one of these markers AND a name or
initials in the immediate context (next line or within 100 chars).
Empty `Signature: ______` lines don't count.

## DigiSign block parsing

DigiSign Verified blocks typically render in the OCR text as:

```
DigiSign Verified
Lauren Koehn
Buyer
2025-02-20 14:32:00 PST
```

Parse signer name + role from the lines immediately after the
marker. Use that to attribute the signature to a specific role.

## Confidence levels

- **`high`**: All required roles passed via NAME match in
  `folderDetail`.
- **`medium`**: All required roles passed via STRUCTURAL validation
  but folder party data was missing.
- **`low`**: Some required roles passed, others missing. NOT EXECUTED.
- **`unknown`**: OCR text was empty or unparseable. Skip the doc.

Only `high` and `medium` award X. `low` and `unknown` do not.

## Worked example: OREF 001 RSA, 2 buyers, 2 sellers

Doc: `signed_rsa.pdf`, 14 pages.

`folderDetail`:
```yaml
sellers: [Ryan G Bellinson]
buyers: [Stephen Graham, Nicola Anne Murray]
```

Run:

1. Form library says `signers: [buyer, seller]`. Both roles required.
2. Role `seller`:
   - Find "Ryan G Bellinson" within 500 chars of a marker.
   - Found a DigiSign block on page 14 with the seller's full name. ✅
3. Role `buyer`:
   - Find "Stephen Graham" within 500 chars of a marker. ✅
   - Find "Nicola Anne Murray" within 500 chars of a marker. ✅
4. All roles passed. `executed = true`, confidence `high`.

Result: append `_X` to the filename.

## Worked example: OREF 001 RSA, only buyers signed

Same doc, same folder, but the OCR text shows DigiSign blocks for
Stephen Graham and Nicola Anne Murray on page 14, and the seller
signature line is blank.

Run:

1. Form library says `signers: [buyer, seller]`.
2. Role `seller`:
   - Find "Ryan G Bellinson" within 500 chars of any marker. ❌ NOT FOUND.
   - Seller role FAILED.
3. Role `buyer`: matched both.
4. `executed = false`. Missing: `[Ryan G Bellinson]`.

Result: NO X. The file gets the v4 name WITHOUT the `_X` suffix.
Audit report flags this for follow-up.

This is the case Matt was angry about. Old detector would have
awarded X on "2 DigiSign blocks" (the two buyers) and called it
executed. New detector correctly catches that the seller never
signed.

## Worked example: EM Receipt (single block)

Doc: `EM_Deposit.pdf`, 1 page.

Form library entry: `name: Earnest Money Receipt`,
`signers: [escrow_officer]`,
`signatureBlocks: [{ page: 1, roles: [escrow_officer] }]`.

Run:

1. Form library says `signers: [escrow_officer]`.
2. Locate signature block on page 1.
3. Find marker within ±300 chars of block anchor.
   - Found "Casey.Ake@westerntitle.com" near the bottom of page 1
     with a signature stamp.
4. `executed = true`, confidence `medium`.

Result: append `_X`. Filename:
`WT0274211_Earnest Money Receipt_X.pdf`.

## Worked example: Title Report (never executed)

Doc: `Preliminary_Title_Report.pdf`, 24 pages.

Form library entry: category `non-OREF report`, `signers: [not_applicable]`.

Run:

1. `not_applicable` → `executed = false` unconditionally.
2. NO X.

Result: `WT0274211_Preliminary Title Report.pdf`.

The title officer might have signed the cover page — doesn't matter.
Reports don't get X because there's nothing for the parties to
"execute." They get attached to a checklist as reference material.

## Audit logging

Every validation run writes one row to
`tmp/skyslope-validation-{date}.jsonl`:

```json
{
  "docId": "abc-def",
  "saleGuid": "uuid",
  "fileName": "signed_rsa.pdf",
  "formId": "oref-001-rsa",
  "formConfidence": "high",
  "saleNumber": "20702Beaumont",
  "executed": true,
  "executedConfidence": "high",
  "obligatedRoles": ["buyer", "seller"],
  "matched": ["Stephen Graham", "Nicola Anne Murray", "Ryan G Bellinson"],
  "missing": [],
  "v4Name": "20702Beaumont_Residential Real Estate Sale Agreement_X.pdf",
  "patched": true,
  "patchHttp": 200
}
```

Matt can grep these logs for any false X by filtering on
`executedConfidence < high` or `missing.length > 0 && executed = true`
(which should never happen).
