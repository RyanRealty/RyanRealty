# v4 filename convention (locked)

## Format

```
{SaleAgreementNumber}_{FormName}_X.{ext}
```

Three fields. Underscore-separated. Spaces allowed inside `FormName`.
Extension preserved byte-for-byte. Each field omitted when not
applicable. NO dates. NO OREF numbers. NO sequence numbers.

## Field rules

### `SaleAgreementNumber`

- Extracted from the PDF text, specifically the "Sale Agreement #" or
  "Sale Agreement Number" field on page 1 of OREF forms.
- Whatever the broker typed there is the truth. Variants seen:
  `20702Beaumont`, `RRP05132026`, `Fernewald072925`, `3.1A`, `RR12132024-1`.
- Do NOT substitute MLS, do NOT synthesize from address, do NOT use
  the folder GUID.
- If the field is blank or absent, **omit the entire prefix** —
  filename becomes `{FormName}_X.{ext}` with no leading separator.
- Common false positives to reject: `Buyer`, `Seller`, `Residential`,
  `Sale`, `Agreement`, `Number`, `(blank field labels echoed by OCR)`.
- Minimum length: 3 characters. Must contain at least one digit OR
  one alphabetic character.

### `FormName`

- For OREF forms: the canonical `name` from
  [oref-form-library.md](oref-form-library.md).
- For non-OREF docs (receipts, photos, lender letters, title docs,
  HOA bundles, repair invoices, etc.): a descriptive label a human
  can read at a glance. See examples below.
- Always present.
- Spaces allowed. Hyphens allowed. Slashes NOT allowed (SkySlope
  filename rules).

### `_X` (executed suffix)

- Appended ONLY when the executed validator returns `executed = true`
  with confidence `high` or `medium`.
- See [signer-validation.md](signer-validation.md) for the algorithm.
- Never applied based on:
  - Filename hints from the source
  - "Envelope completed" subject line on the original email
  - Page count or signature marker count alone
  - Guessing based on folder closing state

### `.{ext}`

- Source extension preserved verbatim. `.pdf` stays `.pdf`,
  `.jpg` stays `.jpg`, `.zip` stays `.zip`.
- SkySlope rejects extension changes with HTTP 422
  (`File Extension can not be changed`). Don't try.

## Worked examples

### Mutual instrument, fully executed

```
20702Beaumont_Residential Real Estate Sale Agreement_X.pdf
20702Beaumont_Sellers Property Disclosure_X.pdf
20702Beaumont_Counter Offer_X.pdf
20702Beaumont_Sale Addendum_X.pdf
```

### Mutual instrument, NOT executed (only one side signed)

```
20702Beaumont_Residential Real Estate Sale Agreement.pdf       # buyer signed only
20702Beaumont_Sellers Property Disclosure.pdf                  # seller signed only
```

NO `_X` because the other side's signature is missing.

### Receipt (single signer block)

```
20702Beaumont_Earnest Money Receipt_X.pdf
20702Beaumont_Funds to Close Receipt_X.pdf
```

### Title / report (never executed)

```
20702Beaumont_Preliminary Title Report.pdf
20702Beaumont_Final Settlement Statement.pdf
20702Beaumont_Closing Disclosure.pdf
```

The Final Settlement Statement gets an `_X` ONLY when the parties'
acknowledgment blocks are filled (some title companies include
buyer/seller signature lines on the final statement; others don't).
When in doubt, no X.

### Listing-side documents (no sale agreement #)

```
Listing Agreement and SA_X.pdf
Initial Agency Disclosure_X.pdf
Sellers Property Disclosure_X.pdf
```

When the doc lives in a listing folder and the listing agreement
hasn't been associated with a specific sale yet, the sale agreement
number field is absent — leading underscore stripped.

### Receipts and images (descriptive labels)

```
20702Beaumont_Inspection Receipt - Sweep It Clean LLC.pdf
20702Beaumont_Repair Invoice - Stanford Plumbing.pdf
20702Beaumont_Pre-Approval Letter - Guild Mortgage.pdf
20702Beaumont_Preliminary Title Report - Western Title.pdf
20702Beaumont_HOA Documents - Sunriver Owners Association.zip
20702Beaumont_Property Photo - Master Bedroom.jpg
20702Beaumont_Septic Inspection Report.pdf
20702Beaumont_Bacteria Test Report.pdf
20702Beaumont_HVAC Receipt - Titan Heating.pdf
```

### Compensation demand (broker outgoing)

```
20702Beaumont_Notice of Real Estate Compensation_X.pdf
```

Signed by the listing broker (Matt). Single-signer form. _X when the
broker's signature block is filled.

## Anti-examples (DO NOT produce)

### Dates in the filename

```
WRONG: 2025-06-09_20702Beaumont_RSA_X.pdf
WRONG: 20702Beaumont_2025-06-09_RSA.pdf
WRONG: RSA_20702Beaumont_06-09-25_X.pdf
```

Dates live in the SkySlope UI's date column. They do not belong in
the filename. Matt explicitly forbade this twice in 2026-05.

### OREF numbers in the filename

```
WRONG: 20702Beaumont_001_RSA_X.pdf
WRONG: 20702Beaumont_Residential Real Estate Sale Agreement (001).pdf
WRONG: 20702Beaumont_RSA - OREF 001_X.pdf
```

OREF numbers are implicit in the form name and discoverable inside
the PDF. They clutter the filename without adding info.

### Sequence numbers in the filename

```
WRONG: 20702Beaumont_Counter Offer 2_X.pdf
WRONG: 20702Beaumont_Addendum 3_X.pdf
WRONG: 20702Beaumont_RSA-001-2_X.pdf
```

Multiple counters or addendums for the same sale share the same
canonical name. They're distinguished by file date in the UI and by
opening them.

### Synthesized sale agreement numbers

```
WRONG: WT0274211_RSA_X.pdf            # WT0274211 is the escrow#, not the sale#
WRONG: 220201089_RSA_X.pdf            # 220201089 is the MLS, not the sale#
WRONG: f88642ff_RSA_X.pdf             # this is the folder GUID
WRONG: 2732NWOrdway_RSA_X.pdf         # synthesized from address, not extracted from PDF
```

Read the PDF. If the field is blank in the PDF, the field is blank in
the filename. Period.

### Generic non-OREF labels

```
WRONG: 20702Beaumont_Receipt.pdf
WRONG: 20702Beaumont_Document.pdf
WRONG: 20702Beaumont_Scan-0042.pdf
WRONG: 20702Beaumont_img_156940d0-9c45-4517-b182-1e155c31281c_395.png
```

If you can't identify what a non-OREF doc is, READ IT. If you still
can't tell after reading, flag for human review — do NOT rename it
to a generic label.

### False-X on partial signatures

```
WRONG: 20702Beaumont_RSA_X.pdf
        (buyers signed, sellers did not)

WRONG: 20702Beaumont_Counter Offer_X.pdf
        (only listing broker signed)

WRONG: 20702Beaumont_SPD_X.pdf
        (sellers disclosed, buyers haven't acknowledged receipt)
```

These are the compliance risks. The `_X` carries weight. Don't apply
it from a hunch.

## Special cases

### Documents with both an OREF form and a custom addendum bundled

A typical "Offer Package" PDF contains the OREF 001 RSA followed by
the OREF 042 pamphlet followed by a custom addendum. The matcher
should:

1. Identify the PRIMARY form (the one on page 1) — that's what goes
   in the FormName.
2. The signature validator runs against ALL pages for the primary
   form's signers.
3. The bundle's secondary forms don't affect the FormName.

If a bundle truly contains multiple distinct instruments that need
separate identification, the doc should be split. Flag it.

### ZIP bundles (HOA docs, photo packages)

ZIP files are renamed but never X'd. They're collections, not
instruments.

```
20702Beaumont_HOA Documents - Sunriver Owners Association.zip
20702Beaumont_Photo Package - Listing Photos.zip
```

The contents are not unpacked or named individually — that's a
separate workflow.

### Photos (.jpg, .png, .heic)

Photos get descriptive labels but never X'd.

```
20702Beaumont_Property Photo - Master Bedroom.jpg
20702Beaumont_Repair Receipt Photo - Plumbing.jpg
```

If a photo is part of an inspection report bundle, it's labeled with
the inspection context.

### Encrypted / unreadable PDFs

If pdfjs + tesseract return fewer than 5 lines of content, do NOT
rename. The original filename stays. A separate `image-only-flag`
report surfaces these for manual handling.

## Filename character constraints (from SkySlope)

- Max length: 100 characters total (filename + extension)
- Forbidden characters: `/ \ : * ? " < > |`
- Allowed: letters, digits, spaces, dashes, underscores, parentheses,
  periods (in extension only), ampersand (use sparingly)
- Truncation rule: if a descriptive label would push the total over
  100 chars, truncate the FormName field with `...` rather than
  truncating sale# or X.

```
20702Beaumont_Inspection Receipt - Stanford Plumbing & Drain Cleaning Services LLC_X.pdf
                                                                                       ^ this is 98 chars

Truncated to:
20702Beaumont_Inspection Receipt - Stanford Plumbing & Drain Cleaning...._X.pdf
```

## Version history

- **v4 (locked 2026-05-18)** — three fields only:
  `{sale#}_{FormName}_X.{ext}`. No dates, OREF#, or sequence#.
- v3 (retired 2026-05-17) — included date and OREF#. Matt rejected.
- v2 (retired 2026-05-16) — space-separated, date+seq prefix. Wrong.
- v1 (retired earlier 2026-05-16) — dash/underscore mess. Wrong.

## Don't reinvent this

If you find yourself thinking "this is a special case, let me hyphenate
or shorten or add a date" — STOP. Read this doc. The three-field rule
covers every case. Special cases get descriptive labels in FormName,
not new fields.
