# SkySlope file naming — v4 convention reference

Read this when you need the full set of worked examples, the rules
around receipts and images, or the exact regex behavior for extracting
the sale agreement number from a PDF.

## The canonical filename

```
{SaleAgreementNumber}_{FormName}_X.{ext}
```

**Three fields. Underscores between them. That's the entire spec.**

- No dates in the filename. SkySlope's UI already shows the upload
  date next to the file.
- No OREF or OR form numbers. The form name itself is enough to
  identify it ("Residential Real Estate Sale Agreement", not "001").
  If a TC needs the OREF#, it's printed on the form itself.
- No sequence numbers. Multiple copies of the same form in a folder
  end up with the same filename — SkySlope doesn't enforce uniqueness
  and the doc IDs are distinct. Cosmetic-only concern.

Spaces are allowed inside `FormName`. Underscores are field separators
only — they don't appear inside any field.

## Field-by-field

### 1. `SaleAgreementNumber`

Pulled out of the PDF itself, not synthesized. Every OREF / OR form
that pertains to a specific sale agreement has a top-corner field
labeled `Sale Agreement #` or `SALE AGREEMENT #`. Examples seen in
production:

- `20702Beaumont` — address shorthand typed by the listing agent
- `RRP05132026` — TC initials + date
- `Fernewald072925` — buyer surname + date
- `3.1A`, `2.2`, `5.3` — offer-round style
- `220205567`, `220205567RG` — MLS-derived

Different agents use different conventions. Extract whatever they
typed. **If the field is blank, omit it entirely** — never substitute
MLS, never synthesize from the property address, never use the folder
GUID.

Extraction regex (case-insensitive, against the merged pdf.js + OCR
text):

```
/sale\s+agreement\s*#[\s_]*([A-Za-z0-9][A-Za-z0-9.\-]{1,39})/i
```

Three filters on the captured value:
1. Must contain at least one digit (rejects form-section headers like
   `ADDENDUM` or `RESIDENTIAL` that the regex catches when the field
   was left blank and the underscores bled into the next section)
2. Length 3–40 characters
3. Not one of the documented blank-field words (see
   `extractSaleAgreementNumber` in
   `scripts/skyslope-forms-document-taxonomy-v2.mjs`)

### 2. `FormName`

The form name does two jobs depending on what kind of document it is:

**For OREF / OR forms**, use the canonical title from `OREF_TITLES`
in `scripts/skyslope-forms-document-taxonomy-v2.mjs`. That table is
the source of truth; extending it requires editing the table, not
improvising in the rename pipeline.

| OREF# | Canonical title |
|---|---|
| 001 | Residential Real Estate Sale Agreement |
| 002 | Addendum to Sale Agreement |
| 003 | Counteroffer |
| 015 | Listing Agreement Exclusive |
| 020 / 022 | Sellers Property Disclosure Statement |
| 040 / 050 | Buyer Representation Agreement |
| 042 | Initial Agency Disclosure Pamphlet |
| 080 | Advisory Regarding Smoke and Carbon Monoxide Alarms |
| 092 | Advisory Regarding FIRPTA Tax |
| 103 | Advisory Regarding Title Insurance |
| 108 | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms |

(See the full map in the taxonomy module — only the most common
forms are listed here.)

**For non-OREF documents** — receipts, photos, lender letters, title
docs, HOA bundles, repair invoices, MLS input forms, brokerage
internal forms — the FormName is a **descriptive label** a human can
read and act on without opening the file.

Good labels:

```
Inspection Receipt - Sweep It Clean LLC.pdf
Repair Invoice - Stanford Plumbing.pdf
Pre-Approval Letter - Guild Mortgage.pdf
Preliminary Title Report - Western Title.pdf
Closing Statement - Seller Side.pdf
Property Photo - Master Bedroom.jpg
Septic Inspection Report.pdf
HOA Documents - Sunriver Owners Association.zip
ORE Residential Input - ODS.pdf
```

Bad labels (too generic; Matt will reject):

```
img_156940d0-9c45-4517-b182-1e155c31281c_395.png
Receipt.pdf
Document.pdf
Scan-0042.pdf
file_3845.pdf
```

When the source filename doesn't make the label obvious, OCR the
document or look at the surrounding folder context to figure out
what it is. The label is meant to save Matt from opening the file
just to identify it.

### 3. `_X` — fully-executed suffix

Append `_X` immediately before the extension when every required
signer for the document type has signed. The detection procedure is
in the main `SKILL.md` body; the signer-by-document-type table is in
`oref-signers.md`. Never apply `_X` based on a hunch.

### 4. `.{ext}` — extension

Preserved from the source file byte-for-byte. `.pdf`, `.jpg`, `.png`,
`.zip`, `.eml`, `.docx`, `.htm`. SkySlope rejects PATCHes that
attempt to change the extension with HTTP 422.

## Worked examples

Every line is a real rename from production runs.

**OREF forms tied to a sale agreement, fully executed:**

```
20702Beaumont_Residential Real Estate Sale Agreement_X.pdf
20702Beaumont_Sellers Property Disclosure Statement_X.pdf
20702Beaumont_Addendum to Sale Agreement_X.pdf
RRP05132026_Counteroffer_X.pdf
3.1A_Residential Real Estate Sale Agreement_X.pdf
```

**Sale agreement field blank on the form (filename has no sale#):**

```
Residential Real Estate Sale Agreement_X.pdf
Advisory Regarding FIRPTA Tax.pdf
Preliminary Title Report - Western Title.pdf
```

**Listing-side / pre-contract docs (no sale# applies):**

```
Listing Agreement Exclusive_X.pdf
Initial Agency Disclosure Pamphlet_X.pdf
Buyer Representation Agreement Exclusive.pdf
```

**Non-OREF docs with descriptive labels:**

```
20702Beaumont_Earnest Money Receipt_X.pdf
20702Beaumont_Pre-Approval Letter - Guild Mortgage.pdf
220205567_HOA Documents - Sunriver Owners Association.zip
ORE Residential Input - ODS_X.pdf
```

**Non-PDF extensions preserved:**

```
20702Beaumont_Property Photo - Front Exterior.jpg
20702Beaumont_Inspection Receipt - Sweep It Clean LLC.png
220205567_HOA Documents - Sunriver Owners Association.zip
20702Beaumont_Email Chain - Buyer Counter Discussion.eml
```

## Anti-examples — do NOT produce filenames like these

```
2026-04-03 001 220215931 042 Initial Agency Disclosure Pamphlet.pdf
```
Spaces as separators, date AND sequence both prefixed, X position
wrong. Retired v2.

```
2026-04-03__LIST__MLS-220215931__agency-disclosure-pamphlet__001__Initial-Agency-Disclosure-Pamphlet-042-OREF.pdf
```
Dash-and-double-underscore mess with category slugs. Retired v1.

```
20702Beaumont_2026-03-25_001_Residential Real Estate Sale Agreement_X.pdf
```
Date and OREF# included. Retired v3 — Matt explicitly said the date
doesn't belong in the filename.

```
220199105_Earnest Money Receipt.pdf
```
MLS substituted for a missing PDF sale#. Forbidden — the SKILL says
omit when blank, never substitute.

```
2025-08-06_img 156940d0 - 9c45 - 4517 - b182 - 1e155c31281c 395.png
```
Date prefix + uninformative UUID-name for an image. Matt rejects
this — the FormName field should describe what the image actually
is.

## Handling duplicates within a folder

When two documents in the same folder produce the same v4 filename
(e.g. two pamphlets from offer rounds 1 and 2), SkySlope allows the
duplication. The internal doc IDs differ; only the displayed name
collides. Don't artificially differentiate with `(2)` or `_v2`
suffixes — the source signal (round#, version, date) was deliberately
removed per Matt's directive. If a TC needs to differentiate two
copies of the same form, they can open them and look at signing
dates.

This is a design choice, not a bug.
