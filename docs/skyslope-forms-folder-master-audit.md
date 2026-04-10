
> nextjs@0.1.0 skyslope:forms-audit
> node scripts/skyslope-forms-master-audit.mjs

# SkySlope Forms file folders master audit

Generated (UTC): 2026-04-10T23:36:56.130Z

This report inventories **every listing file** and **every sale file** returned by the SkySlope **Listings/Sales** API in this account, including checklist activity scaffolding and the flat **Documents** library timeline.

## Important limitations (read this once)

- **"Folders"** here means **SkySlope file folders**: one row per **listingGuid** (listing file) and one row per **saleGuid** (sale file). This is not the separate **SkySlope Forms Partnership** product API.
- **707 documents** existed at generation time across **10** listing files + **10** sale files. Fully OCR-reading every scanned PDF is a batch job; this report uses **API metadata for 100% of documents** and **PDF text extraction for a prioritized subset** (420 PDFs) focused on offers, counters, RSA/sale agreement language, and termination/release patterns.
- **Execution status** is inferred from **SkySlope status fields + checklist activity statuses + PDF text signals**. It is **not** a legal conclusion. When in doubt, open the PDF in SkySlope.
- **PII is redacted** in excerpts (emails/phones). Do not commit live SkySlope session artifacts or presigned URLs.

## Proposed naming convention (do not rename yet)

Use a single sortable prefix and stable tokens so filenames group chronologically and humans can see the story at a glance:

1. **Prefix date**: `YYYY-MM-DD` from **uploadDate** (or **modifiedDate** if upload is missing).
2. **Lane**: `LIST` (listing file) or `SALE` (sale file).
3. **MLS** (if known) as `MLS-{number}` else `MLS-none`.
4. **Doc class** (machine token): examples `OREF-042`, `OREF-015`, `OREF-101`, `OFFER`, `CO-SLR-01`, `CO-BYR-01`, `ADD`, `AMD`, `SPD`, `LENDER`, `TITLE`, `EMD`, `MISC`. Derive OREF numbers from the filename when present.
5. **Round index** (offers only): `R01`, `R02`… increment whenever a new buyer offer package begins (heuristic: new "Offer" PDF with later date).
6. **Execution hint** (suffix, optional): `PARTIAL` vs `EXECUTED` vs `UNKNOWN` based on e-sign markers + whether the doc is a template with blanks vs completed counters (still heuristic).
7. **Original stem preserved** at the end for traceability: `__orig-{sanitized}`.

**Example (illustrative):** `2026-03-17__LIST__MLS-220199105__OREF-015__LISTING-AGREEMENT__EXECUTED__orig-Listing-Agreement-Exclusive-015-OREF.pdf`

## Folder index

| # | Type | Address / label | MLS | SkySlope status | Docs |
|---:|---|---|---|---|---:|
| 1 | listing | 19496 Tumalo Reservoir Rd, Bend, OR 97703 |  | Active | 2 |
| 2 | listing | 20702 Beaumont Drive, Bend, OR 97701 | 220199105 | Transaction | 36 |
| 3 | listing | 2970 NW Lucus Ct, Bend, OR 97703 |  | Canceled/Pend | 4 |
| 4 | listing | 64350 Old Bend Redmond Hwy, Bend, OR 97703 | 220205567 | Transaction | 98 |
| 5 | listing | 1974 NW NW Newport Hills, Bend, OR 97703 | 220194969 | Transaction | 37 |
| 6 | listing | 363 SW Bluff Dr ##208, Bend, OR 97702 | 220204466 | Canceled/App | 9 |
| 7 | listing | 20401 Penhollow Ln, Bend, OR 97702 | 220203839 | Transaction | 36 |
| 8 | listing | 56628 Sunstone Loop, Bend, OR 97707 | 220197955 | Active | 30 |
| 9 | listing | 20473 Jacklight Lane, Bend, OR 97702 | 220198987 | Transaction | 43 |
| 10 | listing | 1234 test street, test, CA 55555 |  | Canceled/App | 0 |
| 11 | sale | 15352 Bear St, La Pine, OR 97739 | 220189471 | Closed | 42 |
| 12 | sale | 218 SW SW 4th St, Redmond, OR 97756 | 220199880 | Canceled/App | 20 |
| 13 | sale | 61271 Kwinnum Drive, Bend, OR 97702 | 220194779 | Expired | 47 |
| 14 | sale | 2732 NW Ordway Avenue, Bend, OR 97703 | 220201089 | Expired | 24 |
| 15 | sale | 534 Crowson Rd, Ashland, OR 97520 | 220201983 | Expired | 32 |
| 16 | sale | 54474 Huntington Road, Bend, OR 97707 | 220185942 | Closed | 91 |
| 17 | sale | 29500 SE Ochoco Way, Prineville, OR 97754 | 220142414 | Expired | 49 |
| 18 | sale | 2129 SW 35th Street, Redmond, OR 97756 | 220203591 | Expired | 32 |
| 19 | sale | 712 SW 1st St, Madras, OR 97741 | 220179688 | Expired | 39 |
| 20 | sale | 20702 Beaumont Drive, Bend, OR 97701 | 220199105 | Pending | 36 |

## Executive summaries (one paragraph per folder)

These paragraphs are **machine-assisted** from SkySlope API fields + filename heuristics + (where available) PDF text signals. They are meant as an **orientation map**, not a substitute for reading the PDFs that matter legally.

- **listing** (19496 Tumalo Reservoir Rd, Bend, OR 97703, MLS **n/a**, SkySlope status **Active**): **2** documents from **2026-04-03** (Initial Agency Disclosure Pamphlet - 042 OREF.pdf, inferred **agency_disclosure_pamphlet**) through **2026-04-03** (Listing Agreement - Exclusive - 015 OREF.pdf, inferred **listing_agreement**). Heuristic counts in this folder: offer-like **0**, counter-like **0**, addendum-like **0**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **1**. Listing status is **Active** (marketing / pre-contract lane as of this snapshot).
- **listing** (20702 Beaumont Drive, Bend, OR 97701, MLS **220199105**, SkySlope status **Transaction**): **36** documents from **2026-03-18** (Initial Agency Disclosure Pamphlet - 042 OREF.pdf, inferred **agency_disclosure_pamphlet**) through **2026-04-09** (Owner Association Addendum.pdf, inferred **addendum**). Heuristic counts in this folder: offer-like **2**, counter-like **3**, addendum-like **3**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **1**. Listing status is **Transaction**, which in SkySlope typically means the listing has moved into the **purchase / escrow workflow** (not merely "active on MLS").
- **listing** (2970 NW Lucus Ct, Bend, OR 97703, MLS **n/a**, SkySlope status **Canceled/Pend**): **4** documents from **2025-07-15** (Listing Agreement - Exclusive - 015 OREF.pdf, inferred **listing_agreement**) through **2025-07-22** (Initial Agency Disclosure Pamphlet - 042 OREF_2.pdf, inferred **agency_disclosure_pamphlet**). Heuristic counts in this folder: offer-like **0**, counter-like **0**, addendum-like **0**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **2**. Listing status includes **Canceled**; treat prior offer PDFs as **historical attempts** unless a sale file shows otherwise.
- **listing** (64350 Old Bend Redmond Hwy, Bend, OR 97703, MLS **220205567**, SkySlope status **Transaction**): **98** documents from **2010-06-08** (2025_Admin, inferred **other**) through **2025-09-25** (Final_Sellers_Statement_IHLA.pdf, inferred **closing_adjacent**). Heuristic counts in this folder: offer-like **5**, counter-like **4**, addendum-like **24**, termination/release-like **2**, RSA/sale-agreement-like **2**, listing-agreement-like **1**. Listing status is **Transaction**, which in SkySlope typically means the listing has moved into the **purchase / escrow workflow** (not merely "active on MLS").
- **listing** (1974 NW NW Newport Hills, Bend, OR 97703, MLS **220194969**, SkySlope status **Transaction**): **37** documents from **2025-07-07** (Initial Agency Disclosure Pamphlet - 042 OREF.pdf, inferred **agency_disclosure_pamphlet**) through **2025-08-14** (FIRPTA_-_Statement_of_Qualified_Substitute_458.pdf, inferred **other_pdf**). Heuristic counts in this folder: offer-like **1**, counter-like **4**, addendum-like **9**, termination/release-like **0**, RSA/sale-agreement-like **1**, listing-agreement-like **1**. Listing status is **Transaction**, which in SkySlope typically means the listing has moved into the **purchase / escrow workflow** (not merely "active on MLS").
- **listing** (363 SW Bluff Dr ##208, Bend, OR 97702, MLS **220204466**, SkySlope status **Canceled/App**): **9** documents from **2025-07-06** (Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf, inferred **other_pdf**) through **2025-09-02** (Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf, inferred **other_pdf**). Heuristic counts in this folder: offer-like **0**, counter-like **0**, addendum-like **0**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **1**. Listing status includes **Canceled**; treat prior offer PDFs as **historical attempts** unless a sale file shows otherwise.
- **listing** (20401 Penhollow Ln, Bend, OR 97702, MLS **220203839**, SkySlope status **Transaction**): **36** documents from **2025-07-05** (Initial Agency Disclosure Pamphlet - 042 OREF.pdf, inferred **agency_disclosure_pamphlet**) through **2025-07-10** (Penhollow Closing Date Addendum.pdf, inferred **addendum**). Heuristic counts in this folder: offer-like **1**, counter-like **0**, addendum-like **2**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **2**. Listing status is **Transaction**, which in SkySlope typically means the listing has moved into the **purchase / escrow workflow** (not merely "active on MLS").
- **listing** (56628 Sunstone Loop, Bend, OR 97707, MLS **220197955**, SkySlope status **Active**): **30** documents from **2025-07-05** (Wood Stove and Wood Burning Fireplace Insert Addendum - 046 OREF.pdf, inferred **addendum**) through **2026-03-26** (Sellers Property Disclosure Statement - 020 OREF_2.pdf, inferred **seller_property_disclosure**). Heuristic counts in this folder: offer-like **1**, counter-like **6**, addendum-like **9**, termination/release-like **0**, RSA/sale-agreement-like **1**, listing-agreement-like **1**. Listing status is **Active** (marketing / pre-contract lane as of this snapshot).
- **listing** (20473 Jacklight Lane, Bend, OR 97702, MLS **220198987**, SkySlope status **Transaction**): **43** documents from **2025-07-05** (Initial Agency Disclosure Pamphlet - 042 OREF.pdf, inferred **agency_disclosure_pamphlet**) through **2025-10-17** (Final_Sellers_Statement_IHLA.pdf, inferred **closing_adjacent**). Heuristic counts in this folder: offer-like **0**, counter-like **9**, addendum-like **9**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **1**. Listing status is **Transaction**, which in SkySlope typically means the listing has moved into the **purchase / escrow workflow** (not merely "active on MLS").
- **listing** (1234 test street, test, CA 55555, MLS **n/a**, SkySlope status **Canceled/App**): **0** documents from **n/a** (n/a, inferred **n/a**) through **n/a** (n/a, inferred **n/a**). Heuristic counts in this folder: offer-like **0**, counter-like **0**, addendum-like **0**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **0**. Listing status includes **Canceled**; treat prior offer PDFs as **historical attempts** unless a sale file shows otherwise.
- **sale** (15352 Bear St, La Pine, OR 97739, MLS **220189471**, SkySlope status **Closed**): **42** documents from **2026-04-09** (Offer 3 - Seller_Contributions_Addendum_1_-_048_OREF.pdf, inferred **addendum**) through **2026-04-09** (FIRPTA - Statement of Qualified Substitute IH.pdf, inferred **other_pdf**). Heuristic counts in this folder: offer-like **9**, counter-like **0**, addendum-like **9**, termination/release-like **2**, RSA/sale-agreement-like **2**, listing-agreement-like **1**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition.
- **sale** (218 SW SW 4th St, Redmond, OR 97756, MLS **220199880**, SkySlope status **Canceled/App**): **20** documents from **2026-04-07** (6_2 Commercial Diligence Document Request Sheet - OR.pdf, inferred **other_pdf**) through **2026-04-07** (218 Southwest 4th Street - Proposal.pdf, inferred **other_pdf**). Heuristic counts in this folder: offer-like **0**, counter-like **1**, addendum-like **5**, termination/release-like **2**, RSA/sale-agreement-like **1**, listing-agreement-like **0**. **Contract acceptance date** is populated; that usually means a **ratified** agreement at some point (still confirm current stage in SkySlope UI).
- **sale** (61271 Kwinnum Drive, Bend, OR 97702, MLS **220194779**, SkySlope status **Expired**): **47** documents from **2026-04-05** (OREF_009_Back_Up_Offer_Addendum_v1_EXECUTED_20250124.pdf, inferred **addendum**) through **2026-04-05** (OREF_001_Residential_Real_Estate_Sale_Agreement_v4_EXECUTED_20250124.pdf, inferred **sale_agreement_or_rsa**). Heuristic counts in this folder: offer-like **3**, counter-like **10**, addendum-like **21**, termination/release-like **0**, RSA/sale-agreement-like **5**, listing-agreement-like **1**. **Contract acceptance date** is populated; that usually means a **ratified** agreement at some point (still confirm current stage in SkySlope UI).
- **sale** (2732 NW Ordway Avenue, Bend, OR 97703, MLS **220201089**, SkySlope status **Expired**): **24** documents from **2026-04-05** (OREF_022A_Buyers_Repair_Addendum_2_EXECUTED_20250508.pdf, inferred **addendum**) through **2026-04-05** (Property_Disclosure_Statement_EXECUTED_20250508.pdf, inferred **seller_property_disclosure**). Heuristic counts in this folder: offer-like **1**, counter-like **2**, addendum-like **14**, termination/release-like **0**, RSA/sale-agreement-like **3**, listing-agreement-like **0**. **Contract acceptance date** is populated; that usually means a **ratified** agreement at some point (still confirm current stage in SkySlope UI).
- **sale** (534 Crowson Rd, Ashland, OR 97520, MLS **220201983**, SkySlope status **Expired**): **32** documents from **2026-04-05** (General_Addendum_to_Sale_Agreement_5_EXECUTED_20250401.pdf, inferred **addendum**) through **2026-04-05** (Metal_Masters_Invoice_1_RECEIVED_20250308.pdf, inferred **other_pdf**). Heuristic counts in this folder: offer-like **1**, counter-like **2**, addendum-like **13**, termination/release-like **0**, RSA/sale-agreement-like **2**, listing-agreement-like **1**. **Contract acceptance date** is populated; that usually means a **ratified** agreement at some point (still confirm current stage in SkySlope UI).
- **sale** (54474 Huntington Road, Bend, OR 97707, MLS **220185942**, SkySlope status **Closed**): **91** documents from **2026-04-05** (Offer 2 - Addendum to Sale Agreement 1 - 002 OREF.pdf, inferred **addendum**) through **2026-04-05** (Offer_3_Addenda_Well_Septic_Woodstove_Bill_of_Sale_EXECUTED_20241001.pdf, inferred **buyer_offer_or_package**). Heuristic counts in this folder: offer-like **13**, counter-like **5**, addendum-like **33**, termination/release-like **2**, RSA/sale-agreement-like **5**, listing-agreement-like **2**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition.
- **sale** (29500 SE Ochoco Way, Prineville, OR 97754, MLS **220142414**, SkySlope status **Expired**): **49** documents from **2026-04-04** (Offer_1_Termination_EXECUTED_20241015.pdf, inferred **termination_or_release**) through **2026-04-04** (SE_Ochoco_Inspection_Report_RECEIVED_20241015.pdf, inferred **inspection_or_repair**). Heuristic counts in this folder: offer-like **12**, counter-like **5**, addendum-like **17**, termination/release-like **1**, RSA/sale-agreement-like **2**, listing-agreement-like **0**. **Contract acceptance date** is populated; that usually means a **ratified** agreement at some point (still confirm current stage in SkySlope UI).
- **sale** (2129 SW 35th Street, Redmond, OR 97756, MLS **220203591**, SkySlope status **Expired**): **32** documents from **2026-04-04** (Offer_1_OREF_080_Advisory_Regarding_Smoke_and_Carbon_Monoxide_Alarms_EXECUTED_20241101.pdf, inferred **buyer_offer_or_package**) through **2026-04-04** (MLSCO_Listing_Agreement_2_EXECUTED_20241101.pdf, inferred **other_pdf**). Heuristic counts in this folder: offer-like **9**, counter-like **2**, addendum-like **9**, termination/release-like **0**, RSA/sale-agreement-like **2**, listing-agreement-like **0**. **Contract acceptance date** is populated; that usually means a **ratified** agreement at some point (still confirm current stage in SkySlope UI).
- **sale** (712 SW 1st St, Madras, OR 97741, MLS **220179688**, SkySlope status **Expired**): **39** documents from **2026-04-04** (Offer_2_OREF_002_Addendum_to_Sale_Agreement_1_EXECUTED_20240401.pdf, inferred **addendum**) through **2026-04-04** (Sellers_Property_Disclosure_Statement_EXECUTED_20240401.pdf, inferred **seller_property_disclosure**). Heuristic counts in this folder: offer-like **5**, counter-like **2**, addendum-like **14**, termination/release-like **0**, RSA/sale-agreement-like **2**, listing-agreement-like **0**. **Contract acceptance date** is populated; that usually means a **ratified** agreement at some point (still confirm current stage in SkySlope UI).
- **sale** (20702 Beaumont Drive, Bend, OR 97701, MLS **220199105**, SkySlope status **Pending**): **36** documents from **2026-03-18** (Initial Agency Disclosure Pamphlet - 042 OREF.pdf, inferred **agency_disclosure_pamphlet**) through **2026-04-09** (Owner Association Addendum.pdf, inferred **addendum**). Heuristic counts in this folder: offer-like **2**, counter-like **3**, addendum-like **3**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **1**. SkySlope **status** suggests **pending / in escrow**; agreement may be ratified even without a populated closing date field. Linked **listingGuid** `ae17cded-5593-40d2-84b9-2102422fca13` (scroll to the listing file section with the same guid to see pre-contract paperwork).

---

## Listing file: 19496 Tumalo Reservoir Rd, Bend, OR 97703

- **Folder id (`listingGuid`)**: `5c2e5879-19a4-4c4a-b38e-fb74dabea838`
- **MLS**: n/a
- **SkySlope status**: Active
- **Listing price (SkySlope)**: 1350000
- **Expiration**: 2026-10-03
- **Checklist type**: Listing 
- **Created on**: 2026-04-03

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure (042 | 10.4) | Listing Documentation | Completed | 2026-04-10 | Initial Agency Disclosure Pamphlet - 042 OREF.pdf |
| 2 | Listing Agreement and SA (015 | 9.3) | Listing Documentation | Completed | 2026-04-10 | Listing Agreement - Exclusive - 015 OREF.pdf |
| 3 | MLS Residential Input Form (ODS) | Listing Documentation | Required | n/a |  |
| 4 | Sellers Property Disclosures | Listing Documentation | Required | n/a |  |
| 5 | Disclosed Limited Agency | Listing Documentation | Optional | n/a |  |
| 6 | Listing Change Forms | Listing Documentation | Optional | n/a |  |
| 7 | Sellers Estimated Net Sheet  | Listing Documentation | Optional | n/a |  |
| 8 | CMA or Comparables  | Listing Documentation | Optional | n/a |  |
| 9 | Cancellation Listing/Expired MLS Page  | Listing Documentation | Optional | n/a |  |
| 10 | Association & CCRs Documents | Listing Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2026-04-03 | 2026-04-10 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 2 | 2026-04-03 | 2026-04-10 | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | pages=6, textLen=32196, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |

### Narrative timeline (best-effort)

- **Forms inventory**: 2 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **Deep read coverage**: 1 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Active**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Listing file: 20702 Beaumont Drive, Bend, OR 97701

- **Folder id (`listingGuid`)**: `ae17cded-5593-40d2-84b9-2102422fca13`
- **MLS**: 220199105
- **SkySlope status**: Transaction
- **Listing price (SkySlope)**: 539000
- **Expiration**: 2026-12-31
- **Checklist type**: Listing 
- **Created on**: 2026-03-18

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure (042 | 10.4) | Listing Documentation | In Review | 2026-03-31 | OREA_Pamphlet.pdf |
| 2 | Listing Agreement and SA (015 | 9.3) | Listing Documentation | In Review | 2026-03-31 | Listing_Contract.pdf |
| 3 | MLS Residential Input Form (ODS) | Listing Documentation | Optional | n/a |  |
| 4 | Sellers Property Disclosures | Listing Documentation | In Review | 2026-04-08 | Property_Disclosures.pdf |
| 5 | Disclosed Limited Agency | Listing Documentation | Optional | n/a |  |
| 6 | Listing Change Forms | Listing Documentation | Optional | n/a |  |
| 7 | Sellers Estimated Net Sheet  | Listing Documentation | Optional | n/a |  |
| 8 | CMA or Comparables  | Listing Documentation | Optional | n/a |  |
| 9 | Cancellation Listing/Expired MLS Page  | Listing Documentation | Optional | n/a |  |
| 10 | Association & CCRs Documents | Listing Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2026-03-18 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 2 | 2026-03-18 | n/a | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | pages=6, textLen=32072, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 3 | 2026-03-18 | n/a | counter_or_counteroffer | Sellers Counteroffer 1 - 003 OREF.pdf | pages=2, textLen=9296, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 4 | 2026-03-18 | n/a | lender_financing | approval letter.pdf | _skipped_ |
| 5 | 2026-03-18 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | pages=1, textLen=5791, signals=e_sign_vendor_markers_present, signature_labels_present |
| 6 | 2026-03-18 | n/a | buyer_offer_or_package | Beaumont Offer 1.pdf | pages=15, textLen=975, signals=e_sign_vendor_markers_present, many_digisign_markers_high_execution_likelihood |
| 7 | 2026-03-19 | n/a | counter_or_counteroffer | counter.pdf | pages=2, textLen=171, signals=e_sign_vendor_markers_present |
| 8 | 2026-03-19 | n/a | counter_or_counteroffer | Sellers Counteroffer 2 - 003 OREF.pdf | pages=2, textLen=9255, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 9 | 2026-03-28 | n/a | buyer_offer_or_package | offer _2_.pdf | pages=15, textLen=1065, signals=e_sign_vendor_markers_present, many_digisign_markers_high_execution_likelihood |
| 10 | 2026-03-28 | n/a | other_pdf | Treadway.pdf | _skipped_ |
| 11 | 2026-03-31 | n/a | other_pdf | Sale_Agreement.pdf | _skipped_ |
| 12 | 2026-03-31 | 2026-03-31 | other_pdf | Listing_Contract.pdf | pages=6, textLen=32072, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 13 | 2026-03-31 | 2026-03-31 | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _skipped_ |
| 14 | 2026-03-31 | n/a | lender_financing | Pre-approval_Letter.pdf | _skipped_ |
| 15 | 2026-04-01 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _skipped_ |
| 16 | 2026-04-01 | n/a | other_pdf | EM_Receipt.pdf | _skipped_ |
| 17 | 2026-04-04 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 18 | 2026-04-04 | n/a | other_pdf | Amendatory Clause.pdf | _skipped_ |
| 19 | 2026-04-04 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _skipped_ |
| 20 | 2026-04-04 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _skipped_ |
| 21 | 2026-04-04 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _skipped_ |
| 22 | 2026-04-04 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _skipped_ |
| 23 | 2026-04-04 | n/a | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - Seller - 080 OREF.pdf | _skipped_ |
| 24 | 2026-04-06 | n/a | other_pdf | Alarm_Advisory.pdf | _skipped_ |
| 25 | 2026-04-06 | n/a | other_pdf | Forms_Advisory.pdf | _skipped_ |
| 26 | 2026-04-06 | n/a | other_pdf | Firpta_Advisory.pdf | _skipped_ |
| 27 | 2026-04-06 | n/a | other_pdf | RE_Compensation_Advisory.pdf | _skipped_ |
| 28 | 2026-04-06 | n/a | other_pdf | Electronic_Funds_Advisory.pdf | _skipped_ |
| 29 | 2026-04-06 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _skipped_ |
| 30 | 2026-04-08 | n/a | seller_property_disclosure | Property Disclosures.pdf | _skipped_ |
| 31 | 2026-04-08 | 2026-04-08 | seller_property_disclosure | Property_Disclosures.pdf | _skipped_ |
| 32 | 2026-04-08 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _skipped_ |
| 33 | 2026-04-08 | n/a | other_pdf | Amendatory_Clause.pdf | _skipped_ |
| 34 | 2026-04-09 | n/a | addendum | Addendum- Insp Ext.pdf | pages=1, textLen=6112, signals=e_sign_vendor_markers_present, signature_labels_present |
| 35 | 2026-04-09 | n/a | other_pdf | Delivery of Assoc Docs.pdf | _skipped_ |
| 36 | 2026-04-09 | 2026-04-09 | addendum | Owner Association Addendum.pdf | pages=2, textLen=10378, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |

### Narrative timeline (best-effort)

- **Forms inventory**: 36 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 2 ("offer" family). **Counter-like**: 3 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **Deep read coverage**: 10 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Transaction**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Listing file: 2970 NW Lucus Ct, Bend, OR 97703

- **Folder id (`listingGuid`)**: `0278bdc2-15f5-4602-aee5-500afca13217`
- **MLS**: n/a
- **SkySlope status**: Canceled/Pend
- **Listing price (SkySlope)**: 1095000
- **Expiration**: 2025-08-31
- **Checklist type**: Listing 
- **Created on**: 2025-07-10

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure (042 | 10.4) | Listing Documentation | In Review | 2025-07-22 | Initial Agency Disclosure Pamphlet - 042 OREF_2.pdf |
| 2 | Listing Agreement and SA (015 | 9.3) | Listing Documentation | In Review | 2025-07-22 | Listing Agreement - Exclusive - 015 OREF_2.pdf |
| 3 | MLS Residential Input Form (ODS) | Listing Documentation | Required | n/a |  |
| 4 | Sellers Property Disclosures | Listing Documentation | Required | n/a |  |
| 5 | Disclosed Limited Agency | Listing Documentation | Optional | n/a |  |
| 6 | Listing Change Forms | Listing Documentation | Optional | n/a |  |
| 7 | Sellers Estimated Net Sheet  | Listing Documentation | Optional | n/a |  |
| 8 | CMA or Comparables  | Listing Documentation | Optional | n/a |  |
| 9 | Cancellation Listing/Expired MLS Page  | Listing Documentation | Optional | n/a |  |
| 10 | Association & CCRs Documents | Listing Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2025-07-15 | n/a | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | pages=5, textLen=28886, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 2 | 2025-07-15 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 3 | 2025-07-22 | 2025-07-22 | listing_agreement | Listing Agreement - Exclusive - 015 OREF_2.pdf | pages=5, textLen=28875, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 4 | 2025-07-22 | 2025-07-22 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF_2.pdf | _skipped_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 4 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **Deep read coverage**: 2 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/Pend**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Listing file: 64350 Old Bend Redmond Hwy, Bend, OR 97703

- **Folder id (`listingGuid`)**: `a28589fc-3915-4a92-86e6-c08355147398`
- **MLS**: 220205567
- **SkySlope status**: Transaction
- **Listing price (SkySlope)**: 1099000
- **Expiration**: 2026-01-07
- **Checklist type**: Listing 
- **Created on**: 2025-07-09

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure (042 | 10.4) | Listing Documentation | Completed | 2025-08-06 | OREA_Pamphlet.pdf |
| 2 | Listing Agreement and SA (015 | 9.3) | Listing Documentation | Completed | 2025-08-06 | Listing_Contract.pdf |
| 3 | MLS Residential Input Form (ODS) | Listing Documentation | Completed | 2025-08-06 | Data_Pages.pdf |
| 4 | Sellers Property Disclosures | Listing Documentation | Completed | 2025-08-07 | Property_Disclosures.pdf; Property_Disclosure_Addendum.pdf |
| 5 | Disclosed Limited Agency | Listing Documentation | Optional | n/a |  |
| 6 | Listing Change Forms | Listing Documentation | Optional | n/a |  |
| 7 | Sellers Estimated Net Sheet  | Listing Documentation | Optional | n/a |  |
| 8 | CMA or Comparables  | Listing Documentation | Optional | n/a |  |
| 9 | Cancellation Listing/Expired MLS Page  | Listing Documentation | Optional | n/a |  |
| 10 | Association & CCRs Documents | Listing Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2010-06-08 | 2015-02-18 | other | 2025_Admin | _skipped_ |
| 2 | 2010-06-08 | n/a | other | 2025_Trash | _skipped_ |
| 3 | 2025-07-09 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _skipped_ |
| 4 | 2025-07-09 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 5 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Fair Housing - Seller - 104 OREF.pdf | _skipped_ |
| 6 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _skipped_ |
| 7 | 2025-07-09 | n/a | title_or_hoa | Advisory Regarding Title Insurance - Seller - 103 OREF.pdf | _skipped_ |
| 8 | 2025-07-09 | n/a | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | pages=5, textLen=28946, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 9 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - Seller - 080 OREF.pdf | _skipped_ |
| 10 | 2025-07-09 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _skipped_ |
| 11 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _skipped_ |
| 12 | 2025-07-09 | n/a | other_pdf | 1d9f4bf5ae604e458b7a4718342463c3_960.pdf | _skipped_ |
| 13 | 2025-07-14 | n/a | other_pdf | ORE Residential Input - ODS.pdf | _skipped_ |
| 14 | 2025-07-15 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _skipped_ |
| 15 | 2025-08-05 | n/a | buyer_offer_or_package | Buyer_Signed_offer_on_OBRH.pdf | pages=17, textLen=34, signals= |
| 16 | 2025-08-05 | n/a | buyer_offer_or_package | Buyer_Signed_offer_on_OBRH_2.pdf | pages=17, textLen=34, signals= |
| 17 | 2025-08-05 | n/a | lender_financing | Offer_1_PreApproval.pdf | pages=2, textLen=4, signals= |
| 18 | 2025-08-05 | n/a | buyer_offer_or_package | Offer_1_Final_Agency_Acknowledgement.pdf | pages=1, textLen=2, signals= |
| 19 | 2025-08-05 | n/a | buyer_offer_or_package | Offer_1_Residential_Real_Estate_Agreement.pdf | pages=10, textLen=20, signals= |
| 20 | 2025-08-05 | n/a | addendum | Offer_1_Well_Addendum.pdf | pages=2, textLen=4, signals= |
| 21 | 2025-08-05 | n/a | buyer_offer_or_package | Offer_1_On_Site_Sewage.pdf | pages=1, textLen=2, signals= |
| 22 | 2025-08-05 | n/a | earnest_or_wire | Offer_1_Wire_Fraud.pdf | pages=1, textLen=2, signals= |
| 23 | 2025-08-06 | n/a | addendum | Addendum- Terms.pdf | pages=1, textLen=6025, signals=e_sign_vendor_markers_present, signature_labels_present |
| 24 | 2025-08-06 | n/a | addendum | Well Addendum.pdf | pages=2, textLen=11016, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 25 | 2025-08-06 | n/a | other_pdf | Proof of Funds.pdf | _skipped_ |
| 26 | 2025-08-06 | n/a | addendum | Septic Addendum.pdf | pages=2, textLen=9324, signals=e_sign_vendor_markers_present, signature_labels_present |
| 27 | 2025-08-06 | n/a | sale_agreement_or_rsa | Sale Agreement.pdf | pages=15, textLen=89473, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 28 | 2025-08-06 | n/a | closing_adjacent | Letter to boardwalk house.pdf | _skipped_ |
| 29 | 2025-08-06 | 2025-08-06 | other_pdf | Listing_Contract.pdf | pages=5, textLen=28946, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 30 | 2025-08-06 | 2025-08-06 | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _skipped_ |
| 31 | 2025-08-06 | 2025-08-06 | other_pdf | Data_Pages.pdf | _skipped_ |
| 32 | 2025-08-06 | n/a | other_pdf | Sale_Agreement.pdf | _skipped_ |
| 33 | 2025-08-06 | n/a | other_pdf | Proof_of_Funds.pdf | _skipped_ |
| 34 | 2025-08-06 | n/a | addendum | Addendum-_AP.pdf | pages=1, textLen=6025, signals=e_sign_vendor_markers_present, signature_labels_present |
| 35 | 2025-08-06 | n/a | other_pdf | Advisory-_Electronic_Funds.pdf | _skipped_ |
| 36 | 2025-08-06 | n/a | other_pdf | Advisory-_RE_Compensation.pdf | _skipped_ |
| 37 | 2025-08-06 | n/a | other_pdf | Advisory-_Firpta.pdf | _skipped_ |
| 38 | 2025-08-06 | n/a | other_pdf | Advisory-_Forms.pdf | _skipped_ |
| 39 | 2025-08-06 | n/a | other_pdf | Advisory-_Alarms.pdf | _skipped_ |
| 40 | 2025-08-06 | n/a | addendum | Well_Addendum.pdf | pages=2, textLen=11016, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 41 | 2025-08-06 | n/a | addendum | Septic_Addendum.pdf | pages=2, textLen=9324, signals=e_sign_vendor_markers_present, signature_labels_present |
| 42 | 2025-08-06 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _skipped_ |
| 43 | 2025-08-06 | n/a | addendum | Septic_Addendum.pdf | pages=2, textLen=9324, signals=e_sign_vendor_markers_present, signature_labels_present |
| 44 | 2025-08-06 | n/a | addendum | Well_Addendum.pdf | pages=2, textLen=11016, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 45 | 2025-08-06 | n/a | other | img_156940d0-9c45-4517-b182-1e155c31281c_395.png | _skipped_ |
| 46 | 2025-08-06 | n/a | other | img_102795a3-efb8-44e4-a58f-653c1bff4fec_120.png | _skipped_ |
| 47 | 2025-08-06 | n/a | other | img_2e65b90d-af86-463a-852b-97a1f645fa04_217.png | _skipped_ |
| 48 | 2025-08-06 | n/a | other | img_736cb534-786b-4a09-af3a-641369977d65_489.png | _skipped_ |
| 49 | 2025-08-06 | n/a | other | img_212beb6b-a937-46c1-95f2-6ad7e6030612_586.png | _skipped_ |
| 50 | 2025-08-06 | n/a | other | img_6ed6b692-2ea7-433a-bbd7-8e42a52f2965_361.png | _skipped_ |
| 51 | 2025-08-07 | n/a | addendum | Sellers Property Disclosure Statement Addendum _1_ - 028 OREF.pdf | pages=1, textLen=5002, signals=e_sign_vendor_markers_present, signature_labels_present |
| 52 | 2025-08-07 | n/a | seller_property_disclosure | Property Disclosures.pdf | _skipped_ |
| 53 | 2025-08-07 | 2025-08-07 | seller_property_disclosure | Property_Disclosures.pdf | _skipped_ |
| 54 | 2025-08-07 | 2025-08-07 | addendum | Property_Disclosure_Addendum.pdf | pages=1, textLen=5002, signals=e_sign_vendor_markers_present, signature_labels_present |
| 55 | 2025-08-07 | n/a | other_pdf | did-you-see-that-comment.pdf | _skipped_ |
| 56 | 2025-08-07 | n/a | other_pdf | did-you-see-that-comment_2.pdf | _skipped_ |
| 57 | 2025-08-11 | n/a | other_pdf | EM_Receipt.pdf | _skipped_ |
| 58 | 2025-08-13 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _skipped_ |
| 59 | 2025-08-13 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | pages=1, textLen=5708, signals=e_sign_vendor_markers_present, signature_labels_present |
| 60 | 2025-08-13 | n/a | other_pdf | Broker_Demand.pdf | _skipped_ |
| 61 | 2025-08-16 | 2025-08-24 | termination_or_release | Termination Agreement.pdf | pages=1, textLen=5883, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 62 | 2025-08-16 | n/a | termination_or_release | Addendum- Termination.pdf | pages=1, textLen=5558, signals=e_sign_vendor_markers_present, signature_labels_present |
| 63 | 2025-08-27 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF _5_.pdf | pages=15, textLen=89116, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 64 | 2025-08-27 | n/a | addendum | Private_Well_Addendum_to_Real_Estate_Sale_Agreement_-_082_OREF _1_.pdf | pages=2, textLen=10946, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 65 | 2025-08-27 | n/a | addendum | Septic_Onsite_Sewage_System_Addendum_-_081_OREF _1_.pdf | pages=2, textLen=9288, signals=e_sign_vendor_markers_present, signature_labels_present |
| 66 | 2025-08-27 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF.pdf | pages=1, textLen=5959, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 67 | 2025-08-27 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF_2.pdf | pages=1, textLen=6033, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 68 | 2025-08-29 | n/a | other_pdf | Sale_Agreement.pdf | _skipped_ |
| 69 | 2025-08-29 | n/a | lender_financing | Pre-approval_Letter.pdf | _skipped_ |
| 70 | 2025-08-29 | n/a | other_pdf | did-you-see-that-comment.pdf | _skipped_ |
| 71 | 2025-08-29 | n/a | other_pdf | did-you-see-that-comment_2.pdf | _skipped_ |
| 72 | 2025-08-29 | n/a | addendum | Well_Addendum.pdf | pages=2, textLen=10868, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 73 | 2025-08-29 | n/a | addendum | Septic_Addendum.pdf | pages=2, textLen=9190, signals=e_sign_vendor_markers_present, signature_labels_present |
| 74 | 2025-08-29 | n/a | counter_or_counteroffer | Counter-_Seller_s.pdf | pages=1, textLen=6201, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 75 | 2025-08-29 | n/a | counter_or_counteroffer | Counter-_Seller_s_2.pdf | pages=1, textLen=6201, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 76 | 2025-08-29 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _skipped_ |
| 77 | 2025-08-29 | n/a | other_pdf | Advisory-_Alarms.pdf | _skipped_ |
| 78 | 2025-08-29 | n/a | other_pdf | Advisory-_Electronic_Funds.pdf | _skipped_ |
| 79 | 2025-08-29 | n/a | other_pdf | Advisory-_Firpta.pdf | _skipped_ |
| 80 | 2025-08-29 | n/a | other_pdf | Advisory-_Forms.pdf | _skipped_ |
| 81 | 2025-08-29 | n/a | other_pdf | Advisory-_RE_Compensation.pdf | _skipped_ |
| 82 | 2025-09-02 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _skipped_ |
| 83 | 2025-09-02 | n/a | addendum | Property_Disclosure_Addendum.pdf | pages=1, textLen=5076, signals=e_sign_vendor_markers_present, signature_labels_present |
| 84 | 2025-09-02 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _skipped_ |
| 85 | 2025-09-08 | n/a | addendum | Buyers_Repair_Addendum_-_022A__1__OREF _16_.pdf | pages=1, textLen=6857, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 86 | 2025-09-08 | n/a | addendum | Sellers Repair Addendum - 022B _1_ OREF.pdf | pages=1, textLen=6060, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 87 | 2025-09-08 | n/a | other_pdf | EM.pdf | _skipped_ |
| 88 | 2025-09-09 | n/a | addendum | Addendum 1- Price.pdf | pages=1, textLen=5380, signals=e_sign_vendor_markers_present, signature_labels_present |
| 89 | 2025-09-09 | n/a | addendum | Repair Addendum- Buyer_s 2.pdf | pages=1, textLen=6423, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 90 | 2025-09-09 | n/a | addendum | Addendum_1-_Price.pdf | pages=1, textLen=5380, signals=e_sign_vendor_markers_present, signature_labels_present |
| 91 | 2025-09-09 | n/a | addendum | Repair_Addendum-_Buyer_s_1.pdf | pages=1, textLen=6914, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 92 | 2025-09-09 | n/a | addendum | Repair_Addendum-_Seller_s.pdf | pages=1, textLen=6200, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 93 | 2025-09-09 | n/a | addendum | Repair_Addendum-_Buyer_s_2.pdf | pages=1, textLen=6423, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 94 | 2025-09-19 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | pages=1, textLen=5731, signals=e_sign_vendor_markers_present, signature_labels_present |
| 95 | 2025-09-19 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF_2.pdf | pages=1, textLen=5732, signals=e_sign_vendor_markers_present, signature_labels_present |
| 96 | 2025-09-25 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF_3.pdf | pages=1, textLen=5732, signals=e_sign_vendor_markers_present, signature_labels_present |
| 97 | 2025-09-25 | n/a | other_pdf | Broker_Demand.pdf | _skipped_ |
| 98 | 2025-09-25 | n/a | closing_adjacent | Final_Sellers_Statement_IHLA.pdf | _skipped_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 98 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 5 ("offer" family). **Counter-like**: 4 (includes OREF counter forms when matched). **Termination/release-like**: 2. **RSA / sale agreement-like**: 2.
- **Deep read coverage**: 45 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Transaction**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Listing file: 1974 NW NW Newport Hills, Bend, OR 97703

- **Folder id (`listingGuid`)**: `a97b0c78-d3e8-4100-a777-3e28cdf6a030`
- **MLS**: 220194969
- **SkySlope status**: Transaction
- **Listing price (SkySlope)**: 1249000
- **Expiration**: 2025-09-30
- **Checklist type**: Listing 
- **Created on**: 2025-07-07

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure (042 | 10.4) | Listing Documentation | Optional | n/a |  |
| 2 | Listing Agreement and SA (015 | 9.3) | Listing Documentation | Completed | 2025-07-08 | Exclusive Listing Agreement - ODS.pdf |
| 3 | MLS Residential Input Form (ODS) | Listing Documentation | Completed | 2025-07-08 | ORE Residential Input - ODS.pdf |
| 4 | Sellers Property Disclosures | Listing Documentation | Optional | n/a |  |
| 5 | Disclosed Limited Agency | Listing Documentation | Completed | 2025-07-15 | Disclosed Limited Agency Agreement for Sellers - 040 OREF.pdf |
| 6 | Listing Change Forms | Listing Documentation | Optional | n/a |  |
| 7 | Sellers Estimated Net Sheet  | Listing Documentation | Optional | n/a |  |
| 8 | CMA or Comparables  | Listing Documentation | Optional | n/a |  |
| 9 | Cancellation Listing/Expired MLS Page  | Listing Documentation | Optional | n/a |  |
| 10 | Association & CCRs Documents | Listing Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2025-07-07 | 2025-07-08 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 2 | 2025-07-07 | 2025-07-08 | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - 080 OREF.pdf | _skipped_ |
| 3 | 2025-07-07 | n/a | counter_or_counteroffer | Buyers_Counter_Offer_1_-_004_OREF _2_.pdf | pages=1, textLen=6372, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 4 | 2025-07-07 | 2025-07-15 | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | pages=1, textLen=4672, signals=e_sign_vendor_markers_present, signature_labels_present |
| 5 | 2025-07-07 | n/a | counter_or_counteroffer | Sellers Counter Offer 2 - 003 OREF.pdf | pages=1, textLen=6049, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 6 | 2025-07-07 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF.pdf | pages=1, textLen=6077, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 7 | 2025-07-07 | n/a | other_pdf | Delivery of Association Documents 1 - 023 OREF.pdf | _skipped_ |
| 8 | 2025-07-07 | 2025-07-15 | other_pdf | Disclosed Limited Agency Agreement for Sellers - 040 OREF.pdf | _skipped_ |
| 9 | 2025-07-07 | 2025-07-08 | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF _2_.pdf | pages=15, textLen=89182, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 10 | 2025-07-07 | 2025-07-15 | other_pdf | Advisory Regarding FIRPTA Tax - 092 OREF.pdf | _skipped_ |
| 11 | 2025-07-07 | 2025-07-08 | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _skipped_ |
| 12 | 2025-07-07 | 2025-07-08 | other_pdf | ORE Residential Input - ODS.pdf | _skipped_ |
| 13 | 2025-07-07 | 2025-07-08 | listing_agreement | Exclusive Listing Agreement - ODS.pdf | pages=4, textLen=23311, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 14 | 2025-07-07 | 2025-07-08 | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _skipped_ |
| 15 | 2025-07-07 | n/a | seller_property_disclosure | Seller_s Property Disclosure Statement _Non-exempt SPDS_.pdf | _skipped_ |
| 16 | 2025-07-07 | 2025-07-15 | addendum | Owner_Association_Addendum_-_024_OREF.pdf | pages=2, textLen=9260, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 17 | 2025-07-07 | n/a | buyer_offer_or_package | Advisory to Buyers and Sellers Regarding Fair Housing - Seller - 104 OREF.pdf | pages=1, textLen=4579, signals=e_sign_vendor_markers_present, signature_labels_present |
| 18 | 2025-07-07 | n/a | addendum | Sellers Property Disclosure Statement Addendum - 028 OREF.pdf | pages=1, textLen=7196, signals=e_sign_vendor_markers_present, signature_labels_present |
| 19 | 2025-07-07 | 2025-07-08 | lender_financing | Preapproval for Andrews.pdf | _skipped_ |
| 20 | 2025-07-07 | 2025-07-08 | other_pdf | Advisory Regarding Electronic Funds - 043 OREF.pdf | _skipped_ |
| 21 | 2025-07-07 | 2025-07-08 | counter_or_counteroffer | Sellers_Counter_Offer_2_-_003_OREF__1__482.pdf | pages=1, textLen=6188, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 22 | 2025-07-08 | n/a | addendum | Buyers_Repair_Addendum_-_022A__1__OREF_276.pdf | pages=1, textLen=6432, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 23 | 2025-07-08 | 2025-07-15 | title_or_hoa | HOA_Document_Delvirables_2025-07-01_15_48_08_430.pdf | _skipped_ |
| 24 | 2025-07-08 | 2025-07-08 | seller_property_disclosure | SPD_s_135.pdf | _skipped_ |
| 25 | 2025-07-08 | 2025-07-10 | addendum | Buyers_Repair_Addendum_1.pdf | pages=1, textLen=6572, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 26 | 2025-07-08 | n/a | addendum | Sellers Repair Addendum - 022B _1_ OREF.pdf | pages=1, textLen=6084, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 27 | 2025-07-08 | 2025-07-08 | other_pdf | EM_777.pdf | _skipped_ |
| 28 | 2025-07-09 | n/a | addendum | Buyers_Repair_Addendum_-_022A__2__OREF_625.pdf | pages=1, textLen=6528, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 29 | 2025-07-09 | 2025-07-10 | addendum | Sellers_Repair_Addendum_1.pdf | pages=1, textLen=6210, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 30 | 2025-07-09 | n/a | other_pdf | First_American_HW_528.pdf | _skipped_ |
| 31 | 2025-07-10 | 2025-07-10 | addendum | Buyers_Repair_Addendum_-_022A__2__OREF.pdf | pages=1, textLen=6667, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 32 | 2025-07-15 | 2025-07-15 | title_or_hoa | PRELIMINARY_REPORT-LINKED-titleLOOK_409.pdf | _skipped_ |
| 33 | 2025-07-15 | 2025-08-14 | title_or_hoa | HOA_Document_Delvirables_2025-07-01_15_48_08_679.pdf | _skipped_ |
| 34 | 2025-07-22 | 2025-08-14 | other_pdf | Receipt_2546_174.pdf | _skipped_ |
| 35 | 2025-08-01 | n/a | addendum | Contingency Removal Addendum 1 - 060 OREF.pdf | pages=1, textLen=4558, signals=e_sign_vendor_markers_present, signature_labels_present |
| 36 | 2025-08-14 | 2025-08-14 | closing_adjacent | Final_Sellers_Statement_IHLA_361.pdf | _skipped_ |
| 37 | 2025-08-14 | 2025-08-14 | other_pdf | FIRPTA_-_Statement_of_Qualified_Substitute_458.pdf | _skipped_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 37 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 4 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 1.
- **Deep read coverage**: 17 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Transaction**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Listing file: 363 SW Bluff Dr ##208, Bend, OR 97702

- **Folder id (`listingGuid`)**: `0d6cc7df-2900-433d-b706-d497170a822f`
- **MLS**: 220204466
- **SkySlope status**: Canceled/App
- **Listing price (SkySlope)**: 899000
- **Expiration**: 2025-09-30
- **Checklist type**: Listing 
- **Created on**: 2025-07-06

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure (042 | 10.4) | Listing Documentation | In Review | 2025-07-06 | Initial Agency Disclosure Pamphlet - 042 OREF.pdf |
| 2 | Listing Agreement and SA (015 | 9.3) | Listing Documentation | In Review | 2025-07-06 | Listing Agreement - Exclusive - 015 OREF.pdf |
| 3 | MLS Residential Input Form (ODS) | Listing Documentation | Required | n/a |  |
| 4 | Sellers Property Disclosures | Listing Documentation | Required | n/a |  |
| 5 | Disclosed Limited Agency | Listing Documentation | Optional | n/a |  |
| 6 | Listing Change Forms | Listing Documentation | Optional | n/a |  |
| 7 | Sellers Estimated Net Sheet  | Listing Documentation | Optional | n/a |  |
| 8 | CMA or Comparables  | Listing Documentation | Optional | n/a |  |
| 9 | Cancellation Listing/Expired MLS Page  | Listing Documentation | Optional | n/a |  |
| 10 | Association & CCRs Documents | Listing Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2025-07-06 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _skipped_ |
| 2 | 2025-07-06 | 2025-07-06 | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | pages=5, textLen=28742, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 3 | 2025-07-06 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _skipped_ |
| 4 | 2025-07-06 | n/a | other_pdf | Advisory Regarding Fair Housing - Seller - 104 OREF.pdf | _skipped_ |
| 5 | 2025-07-06 | n/a | title_or_hoa | Advisory Regarding Title Insurance - Seller - 103 OREF.pdf | _skipped_ |
| 6 | 2025-07-06 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _skipped_ |
| 7 | 2025-07-06 | 2025-07-06 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 8 | 2025-07-06 | n/a | other_pdf | ORE Residential Input - ODS.pdf | _skipped_ |
| 9 | 2025-09-02 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _skipped_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 9 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **Deep read coverage**: 1 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Listing file: 20401 Penhollow Ln, Bend, OR 97702

- **Folder id (`listingGuid`)**: `28343c3a-c683-4b62-bbe4-34180b404db7`
- **MLS**: 220203839
- **SkySlope status**: Transaction
- **Listing price (SkySlope)**: 639000
- **Expiration**: 2025-12-31
- **Checklist type**: Listing 
- **Created on**: 2025-07-05

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure (042 | 10.4) | Listing Documentation | Completed | 2025-07-05 | Initial Agency Disclosure Pamphlet - 042 OREF.pdf |
| 2 | Listing Agreement and SA (015 | 9.3) | Listing Documentation | Completed | 2025-07-05 | Listing Agreement - Exclusive - 015 OREF.pdf |
| 3 | MLS Residential Input Form (ODS) | Listing Documentation | Completed | 2025-07-05 | ORE Residential Input - ODS.pdf |
| 4 | Sellers Property Disclosures | Listing Documentation | Completed | 2025-07-05 | Sellers Property Disclosure Statement - 020 OREF.pdf |
| 5 | Disclosed Limited Agency | Listing Documentation | Optional | n/a |  |
| 6 | Listing Change Forms | Listing Documentation | Optional | n/a |  |
| 7 | Sellers Estimated Net Sheet  | Listing Documentation | Optional | n/a |  |
| 8 | CMA or Comparables  | Listing Documentation | Optional | n/a |  |
| 9 | Cancellation Listing/Expired MLS Page  | Listing Documentation | Optional | n/a |  |
| 10 | Association & CCRs Documents | Listing Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 2 | 2025-07-05 | n/a | buyer_offer_or_package | 20401 Penhollow Purchase Agreement.pdf | pages=15, textLen=79582, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 3 | 2025-07-05 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | pages=1, textLen=6636, signals=e_sign_vendor_markers_present, signature_labels_present |
| 4 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _skipped_ |
| 5 | 2025-07-05 | 2025-07-05 | other_pdf | ORE Residential Input - ODS.pdf | pages=5, textLen=14828, signals=e_sign_vendor_markers_present |
| 6 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | pages=1, textLen=4214, signals=e_sign_vendor_markers_present, signature_labels_present |
| 7 | 2025-07-05 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | pages=1, textLen=4147, signals=e_sign_vendor_markers_present, signature_labels_present |
| 8 | 2025-07-05 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | pages=1, textLen=6432, signals=e_sign_vendor_markers_present, signature_labels_present |
| 9 | 2025-07-05 | n/a | other_pdf | Delivery of Association Documents 1 - 023 OREF.pdf | pages=1, textLen=6396, signals=e_sign_vendor_markers_present, signature_labels_present |
| 10 | 2025-07-05 | n/a | lender_financing | Morse-Pre-Approval Letter.pdf | _skipped_ |
| 11 | 2025-07-05 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | pages=1, textLen=5737, signals=e_sign_vendor_markers_present, signature_labels_present |
| 12 | 2025-07-05 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | pages=1, textLen=5133, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 13 | 2025-07-05 | 2025-07-05 | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | pages=5, textLen=29038, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 14 | 2025-07-05 | n/a | other_pdf | 20401 Penhollow Owners Association.pdf | pages=2, textLen=7911, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 15 | 2025-07-05 | 2025-07-05 | inspection_or_repair | Penhollow Inspection Approval.pdf | _skipped_ |
| 16 | 2025-07-05 | n/a | other_pdf | Advisory_and_Instructions_Regarding_Real_Estate_Purchase_and_Sale_Forms_-_Seller_-_108_OREF.pdf | pages=1, textLen=4214, signals=e_sign_vendor_markers_present, signature_labels_present |
| 17 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial_Agency_Disclosure_Pamphlet_-_042_OREF.pdf | _skipped_ |
| 18 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Penhollow_SPD.pdf | _skipped_ |
| 19 | 2025-07-05 | 2025-07-08 | lender_financing | Morse-Pre-Approval_Letter.pdf | _skipped_ |
| 20 | 2025-07-05 | 2025-07-05 | other_pdf | 20401_Penhollow_Purchase_Agreement.pdf | pages=15, textLen=79582, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 21 | 2025-07-05 | n/a | title_or_hoa | PRELIMINARY_REPORT-LINKED-titleLOOK.pdf | _skipped_ |
| 22 | 2025-07-05 | 2025-07-05 | other_pdf | 20401_Penhollow_Owners_Association.pdf | pages=2, textLen=7911, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 23 | 2025-07-05 | 2025-07-05 | amendment_or_notice | Notice_of_Real_Estate_Compensation_-_091_OREF.pdf | pages=1, textLen=5737, signals=e_sign_vendor_markers_present, signature_labels_present |
| 24 | 2025-07-05 | n/a | listing_agreement | Listing_Agreement_-_Exclusive_-_015_OREF.pdf | _skipped_ |
| 25 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory_Regarding_Real_Estate_Compensation_-_Seller_-_047_OREF.pdf | _skipped_ |
| 26 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory_Regarding_FIRPTA_Tax_-_Seller_-_092_OREF.pdf | _skipped_ |
| 27 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory_Regarding_Electronic_Funds_-_Seller_-_043_OREF.pdf | _skipped_ |
| 28 | 2025-07-05 | 2025-07-05 | earnest_or_wire | Earnest_Money.pdf | _skipped_ |
| 29 | 2025-07-05 | n/a | other_pdf | MLS_Input_Form_2025-06-17_11_44_33.pdf | _skipped_ |
| 30 | 2025-07-05 | n/a | other_pdf | Change_Form_for_Status__Date__Price_and_Other_Miscellaneous_Changes_-_ODS.pdf | _skipped_ |
| 31 | 2025-07-05 | n/a | title_or_hoa | Penhollow_HOA_Docs.zip | _skipped_ |
| 32 | 2025-07-05 | n/a | title_or_hoa | Penhollow_HOA_Docs.zip | _skipped_ |
| 33 | 2025-07-05 | 2025-07-05 | title_or_hoa | PRELIMINARY_REPORT-LINKED_802.pdf | _skipped_ |
| 34 | 2025-07-08 | 2025-07-08 | title_or_hoa | Penhollow_Delivery_of_HOA_Docs_646.pdf | _skipped_ |
| 35 | 2025-07-10 | n/a | addendum | Penhollow_Closing_Date_Addendum_866.pdf | pages=1, textLen=1584, signals=e_sign_vendor_markers_present, signature_labels_present |
| 36 | 2025-07-10 | 2025-07-10 | addendum | Penhollow Closing Date Addendum.pdf | pages=1, textLen=1750, signals=e_sign_vendor_markers_present, signature_labels_present |

### Narrative timeline (best-effort)

- **Forms inventory**: 36 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **Deep read coverage**: 17 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Transaction**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Listing file: 56628 Sunstone Loop, Bend, OR 97707

- **Folder id (`listingGuid`)**: `9d95d06f-8053-4e6f-a939-32caa6da7c5e`
- **MLS**: 220197955
- **SkySlope status**: Active
- **Listing price (SkySlope)**: 2635000
- **Expiration**: 2026-08-31
- **Checklist type**: Listing 
- **Created on**: 2025-07-05

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure (042 | 10.4) | Listing Documentation | Completed | 2025-07-05 | Initial Agency Disclosure Pamphlet - 042 OREF.pdf |
| 2 | Listing Agreement and SA (015 | 9.3) | Listing Documentation | Completed | 2025-07-05 | Exclusive Listing Agreement - ODS.pdf |
| 3 | MLS Residential Input Form (ODS) | Listing Documentation | Completed | 2025-07-05 | ORE Residential Input - ODS.pdf |
| 4 | Sellers Property Disclosures | Listing Documentation | Completed | 2025-07-05 | Sellers Property Disclosure Statement - 020 OREF.pdf |
| 5 | Disclosed Limited Agency | Listing Documentation | Optional | n/a |  |
| 6 | Listing Change Forms | Listing Documentation | Optional | n/a |  |
| 7 | Sellers Estimated Net Sheet  | Listing Documentation | Optional | n/a |  |
| 8 | CMA or Comparables  | Listing Documentation | Optional | n/a |  |
| 9 | Cancellation Listing/Expired MLS Page  | Listing Documentation | Optional | n/a |  |
| 10 | Association & CCRs Documents | Listing Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2025-07-05 | n/a | addendum | Wood Stove and Wood Burning Fireplace Insert Addendum - 046 OREF.pdf | pages=1, textLen=6161, signals=e_sign_vendor_markers_present, signature_labels_present |
| 2 | 2025-07-05 | 2025-07-05 | other_pdf | ORE Residential Input - ODS.pdf | pages=5, textLen=16437, signals=e_sign_vendor_markers_present, signature_labels_present |
| 3 | 2025-07-05 | 2025-07-05 | listing_agreement | Exclusive Listing Agreement - ODS.pdf | pages=4, textLen=23291, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 4 | 2025-07-05 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | pages=1, textLen=4213, signals=e_sign_vendor_markers_present, signature_labels_present |
| 5 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _skipped_ |
| 6 | 2025-07-05 | n/a | seller_property_disclosure | Exterior Siding - Stucco - EIFS Disclosure - 025 OREF.pdf | _skipped_ |
| 7 | 2025-07-05 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | pages=1, textLen=4146, signals=e_sign_vendor_markers_present, signature_labels_present |
| 8 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 9 | 2025-07-05 | n/a | buyer_offer_or_package | Advisory Regarding FIRPTA Tax - Buyer - 092 OREF.pdf | pages=1, textLen=6602, signals=e_sign_vendor_markers_present, signature_labels_present |
| 10 | 2025-10-04 | n/a | counter_or_counteroffer | Sellers Counter0ffer 1 - 003 OREF.pdf | pages=2, textLen=12875, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 11 | 2025-10-04 | n/a | lender_financing | Offer1-Borg Pre-Approval Letter 56628 Sunstone Loop 10-1-25.pdf | pages=1, textLen=2538, signals=e_sign_vendor_markers_present, word_accepted_present, fully_executed_phrase_present |
| 12 | 2025-10-04 | n/a | addendum | Offer1-2_Addendum_to_Sale_Agreement_-_125_ts02404.pdf | pages=1, textLen=2278, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, negative_outcome_word_present, fully_executed_phrase_present, signature_labels_present |
| 13 | 2025-10-04 | n/a | earnest_or_wire | Offer1-Wire_Fraud_Advisory_-_218_ts03966.pdf | pages=1, textLen=3179, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 14 | 2025-10-04 | n/a | sale_agreement_or_rsa | Offer1-Residential_Real_Estate_Sale_Agreement_-_125_ts00841.pdf | pages=15, textLen=80661, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, fully_executed_phrase_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 15 | 2025-10-04 | n/a | addendum | Offer1-Owner_Association_Addendum_-_325_ts02404.pdf | pages=2, textLen=7966, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, negative_outcome_word_present, signature_labels_present |
| 16 | 2025-10-04 | n/a | addendum | Offer1-Addendum_to_Sale_Agreement_-_125_ts02404.pdf | pages=1, textLen=2122, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 17 | 2025-12-14 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _skipped_ |
| 18 | 2025-12-16 | n/a | other_pdf | Residential Real Estate Agreement 147.pdf | _skipped_ |
| 19 | 2025-12-16 | n/a | counter_or_counteroffer | Sellers Counteroffer 1 - 003 OREF.pdf | pages=1, textLen=6241, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 20 | 2025-12-16 | n/a | addendum | Addendum to Sale Agreement 2 - 002 OREF.pdf | pages=1, textLen=5923, signals=e_sign_vendor_markers_present, signature_labels_present |
| 21 | 2025-12-16 | n/a | addendum | Owners Association Addendum 147.pdf | pages=2, textLen=9147, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 22 | 2025-12-16 | n/a | addendum | Addendum A.pdf | pages=1, textLen=5702, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 23 | 2025-12-16 | n/a | lender_financing | FreemanPreapproval.pdf | _skipped_ |
| 24 | 2025-12-17 | n/a | counter_or_counteroffer | Buyer Signed Buyer Counter.pdf | pages=1, textLen=6508, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 25 | 2025-12-17 | n/a | counter_or_counteroffer | Fully Signed Seller Counter.pdf | pages=1, textLen=6389, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 26 | 2025-12-17 | n/a | addendum | Fully Signed Addendum B.pdf | pages=1, textLen=6040, signals=e_sign_vendor_markers_present, signature_labels_present |
| 27 | 2025-12-17 | n/a | counter_or_counteroffer | Sellers Counteroffer 2 - 003 OREF.pdf | pages=1, textLen=6060, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 28 | 2025-12-17 | n/a | counter_or_counteroffer | Buyer Signed Buyer Counter_2.pdf | pages=1, textLen=6705, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 29 | 2026-03-26 | n/a | addendum | Sellers Property Disclosure Statement Addendum _1_ - 028 OREF.pdf | pages=1, textLen=5667, signals=e_sign_vendor_markers_present, signature_labels_present |
| 30 | 2026-03-26 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF_2.pdf | _skipped_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 30 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 6 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 1.
- **Deep read coverage**: 23 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Active**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Listing file: 20473 Jacklight Lane, Bend, OR 97702

- **Folder id (`listingGuid`)**: `c9503d17-c569-42b3-841e-9651e13dec70`
- **MLS**: 220198987
- **SkySlope status**: Transaction
- **Listing price (SkySlope)**: 749000
- **Expiration**: 2025-12-31
- **Checklist type**: Listing 
- **Created on**: 2025-07-05

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure (042 | 10.4) | Listing Documentation | Completed | 2025-07-05 | Initial Agency Disclosure Pamphlet - 042 OREF.pdf |
| 2 | Listing Agreement and SA (015 | 9.3) | Listing Documentation | Completed | 2025-07-05 | Exclusive Listing Agreement - ODS.pdf |
| 3 | MLS Residential Input Form (ODS) | Listing Documentation | Completed | 2025-07-05 | ORE Residential Input - ODS.pdf |
| 4 | Sellers Property Disclosures | Listing Documentation | Completed | 2025-07-05 | Sellers Property Disclosure Statement - 020 OREF.pdf |
| 5 | Disclosed Limited Agency | Listing Documentation | Optional | n/a |  |
| 6 | Listing Change Forms | Listing Documentation | Completed | 2025-07-05 | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf |
| 7 | Sellers Estimated Net Sheet  | Listing Documentation | Optional | n/a |  |
| 8 | CMA or Comparables  | Listing Documentation | Optional | n/a |  |
| 9 | Cancellation Listing/Expired MLS Page  | Listing Documentation | Optional | n/a |  |
| 10 | Association & CCRs Documents | Listing Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 2 | 2025-07-05 | 2025-07-05 | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | pages=1, textLen=5070, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 3 | 2025-07-05 | 2025-07-05 | other_pdf | ORE Residential Input - ODS.pdf | pages=5, textLen=15518, signals=e_sign_vendor_markers_present, signature_labels_present |
| 4 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _skipped_ |
| 5 | 2025-07-05 | 2025-07-05 | listing_agreement | Exclusive Listing Agreement - ODS.pdf | pages=4, textLen=23182, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 6 | 2025-09-03 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_2.pdf | _skipped_ |
| 7 | 2025-09-13 | n/a | counter_or_counteroffer | 2_1 Counteroffer to Real Estate Purchase and Sale Agreement _1_ - OR.pdf | pages=1, textLen=4767, signals=e_sign_vendor_markers_present, signature_labels_present |
| 8 | 2025-09-13 | n/a | earnest_or_wire | 2_DigiSign_10_5_Wire_Fraud_Advisory_-_OR.pdf | _skipped_ |
| 9 | 2025-09-13 | n/a | other_pdf | 3_DigiSign_2_19_FHA___VA_Amendatory_Clause_-_OR.pdf | _skipped_ |
| 10 | 2025-09-13 | n/a | other_pdf | 1_DigiSign_1_1_Oregon_Residential_Real_Estate_Purchase_And_Sale_Agreement_-_OR.pdf | _skipped_ |
| 11 | 2025-09-13 | n/a | addendum | 4_DigiSign_4_4_Association_Addendum_-_OR.pdf | pages=3, textLen=12167, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 12 | 2025-09-14 | n/a | counter_or_counteroffer | 2_1 Counteroffer to Real Estate Purchase and Sale Agreement _1_ - OR_2.pdf | pages=1, textLen=4830, signals=e_sign_vendor_markers_present, signature_labels_present |
| 13 | 2025-09-14 | n/a | counter_or_counteroffer | counter 2.pdf | pages=2, textLen=9764, signals=e_sign_vendor_markers_present, signature_labels_present |
| 14 | 2025-09-14 | n/a | counter_or_counteroffer | signed counters.pdf | pages=3, textLen=14997, signals=e_sign_vendor_markers_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 15 | 2025-09-15 | n/a | other_pdf | Sale_Agreement.pdf | _skipped_ |
| 16 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Buyer_s_3.pdf | pages=1, textLen=4668, signals=e_sign_vendor_markers_present, signature_labels_present |
| 17 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Seller_s_1.pdf | pages=1, textLen=4668, signals=e_sign_vendor_markers_present, signature_labels_present |
| 18 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Seller_s_2.pdf | pages=1, textLen=4806, signals=e_sign_vendor_markers_present, signature_labels_present |
| 19 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Seller_s_2_2.pdf | pages=1, textLen=4806, signals=e_sign_vendor_markers_present, signature_labels_present |
| 20 | 2025-09-15 | n/a | addendum | Association_Addendum.pdf | pages=3, textLen=12167, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 21 | 2025-09-15 | n/a | earnest_or_wire | Wire_Fraud_Advsisory.pdf | _skipped_ |
| 22 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Buyer_s_2.pdf | pages=1, textLen=4880, signals=e_sign_vendor_markers_present, signature_labels_present |
| 23 | 2025-09-15 | n/a | other_pdf | Amendatory_Clause.pdf | _skipped_ |
| 24 | 2025-09-15 | n/a | lender_financing | Pre-approval_Letter.pdf | _skipped_ |
| 25 | 2025-09-17 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | pages=1, textLen=5418, signals=e_sign_vendor_markers_present, signature_labels_present |
| 26 | 2025-09-23 | n/a | other_pdf | Amendatory Clause.pdf | _skipped_ |
| 27 | 2025-09-23 | n/a | other_pdf | Amendatory Clause_2.pdf | _skipped_ |
| 28 | 2025-09-25 | n/a | inspection_or_repair | Brandon Hargous Repairs_2025-09-24 12_24_55.pdf | _skipped_ |
| 29 | 2025-09-25 | n/a | other_pdf | EM_Receipt.pdf | _skipped_ |
| 30 | 2025-09-25 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _skipped_ |
| 31 | 2025-09-25 | n/a | addendum | Rejected_Repair_Addendum.pdf | pages=1, textLen=5436, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 32 | 2025-09-25 | n/a | other_pdf | Amendatory_Clause.pdf | _skipped_ |
| 33 | 2025-10-01 | n/a | other_pdf | New bill of sale.pdf | _skipped_ |
| 34 | 2025-10-01 | n/a | other_pdf | Bill_of_Sale.pdf | _skipped_ |
| 35 | 2025-10-06 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | pages=1, textLen=5722, signals=e_sign_vendor_markers_present, signature_labels_present |
| 36 | 2025-10-06 | n/a | other_pdf | Broker_Demand.pdf | _skipped_ |
| 37 | 2025-10-07 | n/a | addendum | Addendum-_Close_10-10.pdf | pages=1, textLen=1853, signals=e_sign_vendor_markers_present, signature_labels_present |
| 38 | 2025-10-07 | n/a | addendum | Addendum- Close 10-10.pdf | pages=1, textLen=1935, signals=e_sign_vendor_markers_present, signature_labels_present |
| 39 | 2025-10-07 | n/a | addendum | Addendum-_Close_10-10.pdf | pages=1, textLen=1935, signals=e_sign_vendor_markers_present, signature_labels_present |
| 40 | 2025-10-07 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _skipped_ |
| 41 | 2025-10-11 | n/a | addendum | Addendum - Closing Date.pdf | pages=1, textLen=1948, signals=e_sign_vendor_markers_present, signature_labels_present |
| 42 | 2025-10-15 | n/a | addendum | Addendum-_Closing_10-21.pdf | pages=1, textLen=1948, signals=e_sign_vendor_markers_present, signature_labels_present |
| 43 | 2025-10-17 | n/a | closing_adjacent | Final_Sellers_Statement_IHLA.pdf | _skipped_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 43 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 9 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **Deep read coverage**: 22 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Transaction**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Listing file: 1234 test street, test, CA 55555

- **Folder id (`listingGuid`)**: `ab8c9527-3595-49f3-befb-fde63514381d`
- **MLS**: n/a
- **SkySlope status**: Canceled/App
- **Listing price (SkySlope)**: 100000
- **Expiration**: 2025-07-31
- **Checklist type**: Listing 
- **Created on**: 2025-07-03

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure (042 | 10.4) | Listing Documentation | Required | n/a |  |
| 2 | Listing Agreement and SA (015 | 9.3) | Listing Documentation | Required | n/a |  |
| 3 | MLS Residential Input Form (ODS) | Listing Documentation | Required | n/a |  |
| 4 | Sellers Property Disclosures | Listing Documentation | Required | n/a |  |
| 5 | Disclosed Limited Agency | Listing Documentation | Optional | n/a |  |
| 6 | Listing Change Forms | Listing Documentation | Optional | n/a |  |
| 7 | Sellers Estimated Net Sheet  | Listing Documentation | Optional | n/a |  |
| 8 | CMA or Comparables  | Listing Documentation | Optional | n/a |  |
| 9 | Cancellation Listing/Expired MLS Page  | Listing Documentation | Optional | n/a |  |
| 10 | Association & CCRs Documents | Listing Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|

### Narrative timeline (best-effort)

- **Forms inventory**: 0 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **Deep read coverage**: 0 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 15352 Bear St, La Pine, OR 97739

- **Folder id (`saleGuid`)**: `2b9046c3-25aa-4efd-b4b1-bd381d6f2a8d`
- **MLS**: 220189471
- **SkySlope status**: Closed
- **Linked listingGuid**: n/a
- **Sale price / list price**: 98000 / 0
- **Contract acceptance**: 2024-08-21
- **Escrow closing**: 2024-10-22
- **Actual closing**: 2024-10-22
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-04-09

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | Required | n/a |  |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Optional | n/a |  |
| 3 | Counter Offers  | Sales Documentation | Optional | n/a |  |
| 4 | Sale Addendums  | Sales Documentation | Optional | n/a |  |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | Optional | n/a |  |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Required | n/a |  |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | Optional | n/a |  |
| 11 | Contingency Removal Addendum  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy  | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale  | Sales Documentation | Optional | n/a |  |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Optional | n/a |  |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | Required | n/a |  |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | Required | n/a |  |
| 24 | Real Estate Compensation Advisory | Disclosures | Required | n/a |  |
| 25 | FIRPTA Advisory | Disclosures | Required | n/a |  |
| 26 | Real Estate Forms Advisory | Disclosures | Required | n/a |  |
| 27 | Smoke Alarms Advisory | Disclosures | Required | n/a |  |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 35 | Earnest Money Receipt | Closing Documents | Required | n/a |  |
| 36 | Preliminary Title Report | Closing Documents | Required | n/a |  |
| 37 | Final HUD | Closing Documents | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | Required | n/a |  |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Required | n/a |  |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2026-04-09 | n/a | addendum | Offer 3 - Seller_Contributions_Addendum_1_-_048_OREF.pdf | pages=1, textLen=5007, signals=e_sign_vendor_markers_present, signature_labels_present |
| 2 | 2026-04-09 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _skipped_ |
| 3 | 2026-04-09 | n/a | addendum | Offer 3 - Private_Well_Addendum_to_Real_Estate_Sale_Agreement_-_082_OREF.pdf | pages=2, textLen=10754, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 4 | 2026-04-09 | n/a | addendum | Offer 2 - Septic Addendum 1 signature.pdf | pages=2, textLen=9315, signals=e_sign_vendor_markers_present, signature_labels_present |
| 5 | 2026-04-09 | n/a | closing_adjacent | Final Sellers Statement IHLB.pdf | _skipped_ |
| 6 | 2026-04-09 | n/a | listing_agreement | Exclusive Listing Agreement - ODS.pdf | pages=4, textLen=23300, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 7 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 3 - Advisory_Regarding_Electronic_Funds_-_043_OREF _1_.pdf | pages=1, textLen=4785, signals=e_sign_vendor_markers_present, signature_labels_present |
| 8 | 2026-04-09 | n/a | seller_property_disclosure | Exterior Siding - Stucco - EIFS Disclosure - 025 OREF.pdf | _skipped_ |
| 9 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 3 - Advisory_Regarding_FIRPTA_Tax_-_092_OREF.pdf | pages=2, textLen=8185, signals=e_sign_vendor_markers_present, signature_labels_present |
| 10 | 2026-04-09 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | pages=1, textLen=4577, signals=e_sign_vendor_markers_present, signature_labels_present |
| 11 | 2026-04-09 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _skipped_ |
| 12 | 2026-04-09 | n/a | termination_or_release | Offer 1 - Bear Street Termination.pdf | pages=2, textLen=10572, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, negative_outcome_word_present, signature_labels_present |
| 13 | 2026-04-09 | n/a | addendum | Offer 3 - Septic-Onsite_Sewage_System_Addendum_-_081_OREF.pdf | pages=2, textLen=9332, signals=e_sign_vendor_markers_present, signature_labels_present |
| 14 | 2026-04-09 | n/a | other_pdf | Advisory to Seller Regarding Lead-Based Paint- 018 OREF.pdf | _skipped_ |
| 15 | 2026-04-09 | n/a | addendum | Offer 1 - Addendum Extension.pdf | pages=1, textLen=2269, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 16 | 2026-04-09 | n/a | sale_agreement_or_rsa | Offer 3 - Residential_Real_Estate_Sale_Agreement_-_001_OREF _2_.pdf | pages=14, textLen=84579, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 17 | 2026-04-09 | n/a | other_pdf | Disclosed Limited Agency Agreement for Sellers - 040 OREF.pdf | _skipped_ |
| 18 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 1 - 15352 Bear St.pdf | pages=38, textLen=123032, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 19 | 2026-04-09 | n/a | addendum | Lead Based Paint Disclosure Addendum - 021 OREF.pdf | pages=12, textLen=35334, signals=e_sign_vendor_markers_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 20 | 2026-04-09 | n/a | agency_disclosure_pamphlet | Offer 3- Protect_Your_Family_From_Lead_In_Your_Home_Pamphlet_-_EPA.pdf | pages=10, textLen=27118, signals=e_sign_vendor_markers_present, many_digisign_markers_high_execution_likelihood |
| 21 | 2026-04-09 | n/a | other_pdf | ORE Residential Input - ODS.pdf | _skipped_ |
| 22 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 3 - Disclosed_Limited_Agency_Agreement_for_Buyers_-_041_OREF.pdf | pages=1, textLen=4692, signals=e_sign_vendor_markers_present, signature_labels_present |
| 23 | 2026-04-09 | n/a | addendum | Back Up Offer Addendum - 009 OREF.pdf | pages=2, textLen=8075, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 24 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 2 - Bear St - Private Well 1 signature.pdf | pages=2, textLen=10758, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 25 | 2026-04-09 | n/a | addendum | Offer 2 - Sale Price Addendum.pdf | pages=1, textLen=5345, signals=e_sign_vendor_markers_present, signature_labels_present |
| 26 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 3 - Advisory_and_Instructions_Regarding_Real_Estate_Purchase_and_Sale_Forms_-_Buyer_-_108_OREF.pdf | pages=1, textLen=4229, signals=e_sign_vendor_markers_present, signature_labels_present |
| 27 | 2026-04-09 | n/a | agency_disclosure_pamphlet | Protect Your Family From Lead In Your Home Pamphlet - EPA.pdf | _skipped_ |
| 28 | 2026-04-09 | n/a | other_pdf | Advisory Regarding Electronic Funds - 043 OREF.pdf | _skipped_ |
| 29 | 2026-04-09 | n/a | other_pdf | FE - Lead based paint both signatures.pdf | _skipped_ |
| 30 | 2026-04-09 | n/a | agency_disclosure_pamphlet | Offer 3- Oregon_Real_Estate_Agency_Disclosure_Pamphlet_-_042_OREF.pdf | pages=3, textLen=12048, signals=e_sign_vendor_markers_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 31 | 2026-04-09 | n/a | sale_agreement_or_rsa | Offer 2 - Residential Sale Agreement 1 signature.pdf | pages=14, textLen=84718, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 32 | 2026-04-09 | n/a | addendum | Offer 3 - Lead_Based_Paint_Disclosure_Addendum_-_021_OREF.pdf | pages=12, textLen=36212, signals=e_sign_vendor_markers_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 33 | 2026-04-09 | n/a | agency_disclosure_pamphlet | Oregon Real Estate Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 34 | 2026-04-09 | n/a | other_pdf | Removal of Contingencies.pdf | _skipped_ |
| 35 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 2 Hernandez - Proof of funds.pdf | pages=42, textLen=53521, signals=e_sign_vendor_markers_present, many_digisign_markers_high_execution_likelihood |
| 36 | 2026-04-09 | n/a | seller_property_disclosure | FE - SPD both signatures.pdf | _skipped_ |
| 37 | 2026-04-09 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - 092 OREF.pdf | _skipped_ |
| 38 | 2026-04-09 | n/a | other_pdf | EMRR IH.pdf | _skipped_ |
| 39 | 2026-04-09 | n/a | buyer_offer_or_package | 15352 Bear St - Offer 1_2024-09-09 12_11_56.pdf | pages=39, textLen=127518, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 40 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 1.pdf | pages=38, textLen=119740, signals=alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 41 | 2026-04-09 | n/a | termination_or_release | Offer 1 - Bear Street Termination Addendum.pdf | pages=1, textLen=2309, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 42 | 2026-04-09 | n/a | other_pdf | FIRPTA - Statement of Qualified Substitute IH.pdf | _skipped_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 42 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 9 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 2. **RSA / sale agreement-like**: 2.
- **Deep read coverage**: 26 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 218 SW SW 4th St, Redmond, OR 97756

- **Folder id (`saleGuid`)**: `c68aff19-4584-4fd7-8e65-e40409719262`
- **MLS**: 220199880
- **SkySlope status**: Canceled/App
- **Linked listingGuid**: n/a
- **Sale price / list price**: 435000 / 0
- **Contract acceptance**: 2025-04-22
- **Escrow closing**: 2025-07-31
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-04-07

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | Required | n/a |  |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Optional | n/a |  |
| 3 | Counter Offers  | Sales Documentation | Optional | n/a |  |
| 4 | Sale Addendums  | Sales Documentation | Optional | n/a |  |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | Optional | n/a |  |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Required | n/a |  |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | Optional | n/a |  |
| 11 | Contingency Removal Addendum  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy  | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale  | Sales Documentation | Optional | n/a |  |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Optional | n/a |  |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | Required | n/a |  |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | Required | n/a |  |
| 24 | Real Estate Compensation Advisory | Disclosures | Required | n/a |  |
| 25 | FIRPTA Advisory | Disclosures | Required | n/a |  |
| 26 | Real Estate Forms Advisory | Disclosures | Required | n/a |  |
| 27 | Smoke Alarms Advisory | Disclosures | Required | n/a |  |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 35 | Earnest Money Receipt | Closing Documents | Required | n/a |  |
| 36 | Preliminary Title Report | Closing Documents | Required | n/a |  |
| 37 | Final HUD | Closing Documents | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | Required | n/a |  |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Required | n/a |  |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2026-04-07 | n/a | other_pdf | 6_2 Commercial Diligence Document Request Sheet - OR.pdf | _skipped_ |
| 2 | 2026-04-07 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | pages=1, textLen=5685, signals=e_sign_vendor_markers_present, signature_labels_present |
| 3 | 2026-04-07 | n/a | termination_or_release | 5_3 Buyer_s Notice of Termination - OR.pdf | pages=2, textLen=11481, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 4 | 2026-04-07 | n/a | addendum | 2_2 General Addendum To Real Estate Purchase And Sale Agreement _1_ - OR.pdf | pages=1, textLen=3031, signals=e_sign_vendor_markers_present, signature_labels_present |
| 5 | 2026-04-07 | n/a | seller_property_disclosure | 1_Sellers Property Disclosures.pdf | _skipped_ |
| 6 | 2026-04-07 | n/a | addendum | 2_2 General Addendum To Real Estate Purchase And Sale Agreement _1_ - OR_2.pdf | pages=1, textLen=3052, signals=e_sign_vendor_markers_present, signature_labels_present |
| 7 | 2026-04-07 | n/a | termination_or_release | Contingent Right to Purchase - Notice to Seller - 083A OREF.pdf | pages=1, textLen=4672, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 8 | 2026-04-07 | n/a | inspection_or_repair | Repair Request List _2_.pdf | _skipped_ |
| 9 | 2026-04-07 | n/a | addendum | 2_2 General Addendum To Real Estate Purchase And Sale Agreement _1_ - OR_3.pdf | pages=1, textLen=2943, signals=e_sign_vendor_markers_present, signature_labels_present |
| 10 | 2026-04-07 | n/a | addendum | 2_2_General_Addendum_To_Real_Estate_Purchase_And_Sale_Agreement__4__-_OR.pdf | pages=1, textLen=3242, signals=e_sign_vendor_markers_present, signature_labels_present |
| 11 | 2026-04-07 | n/a | other_pdf | PA LETTER-Chester-218 sw 4th RDM - 435k.pdf | _skipped_ |
| 12 | 2026-04-07 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF_2.pdf | pages=1, textLen=5696, signals=e_sign_vendor_markers_present, signature_labels_present |
| 13 | 2026-04-07 | n/a | other_pdf | Answers from Seller regarding Due Diligence.pdf | _skipped_ |
| 14 | 2026-04-07 | n/a | seller_property_disclosure | Sellers Property Disclosures.pdf | _skipped_ |
| 15 | 2026-04-07 | n/a | counter_or_counteroffer | 2_1_Counteroffer_to_Real_Estate_Purchase_and_Sale_Agreement__1__-_OR.pdf | pages=15, textLen=81324, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 16 | 2026-04-07 | n/a | other_pdf | Insurance.pdf | _skipped_ |
| 17 | 2026-04-07 | n/a | sale_agreement_or_rsa | 1_2 Oregon Commercial Real Estate Purchase and Sale Agreement - OR.pdf | pages=11, textLen=68540, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 18 | 2026-04-07 | n/a | other_pdf | RDM Utilities - Google Sheets.pdf | _skipped_ |
| 19 | 2026-04-07 | n/a | addendum | 2_2 General Addendum To Real Estate Purchase And Sale Agreement _3_ - OR.pdf | pages=1, textLen=3112, signals=e_sign_vendor_markers_present, signature_labels_present |
| 20 | 2026-04-07 | n/a | other_pdf | 218 Southwest 4th Street - Proposal.pdf | _skipped_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 20 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 1 (includes OREF counter forms when matched). **Termination/release-like**: 2. **RSA / sale agreement-like**: 1.
- **Deep read coverage**: 11 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 61271 Kwinnum Drive, Bend, OR 97702

- **Folder id (`saleGuid`)**: `b3d7cb82-50c2-4d52-9dbe-31330121abcb`
- **MLS**: 220194779
- **SkySlope status**: Expired
- **Linked listingGuid**: n/a
- **Sale price / list price**: 525000 / 0
- **Contract acceptance**: 2025-01-24
- **Escrow closing**: 2025-02-24
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-04-04

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | In Review | 2026-04-07 | OREF_001_Residential_Real_Estate_Sale_Agreement_v5_EXECUTED_20250124.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | In Review | 2026-04-07 | Proof_of_Funds_RECEIVED_20250124.pdf |
| 3 | Counter Offers  | Sales Documentation | In Review | 2026-04-07 | OREF_003_Sellers_Counter_Offer_1_Seller_Signed_EXECUTED_20250124.pdf |
| 4 | Sale Addendums  | Sales Documentation | In Review | 2026-04-07 | OREF_002_Addendum_to_Sale_Agreement_1_v1_EXECUTED_20250124.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | In Review | 2026-04-07 | OREF_058_Professional_Inspection_Addendum_EXECUTED_20250124.pdf |
| 6 | Repair Addendums  | Sales Documentation | In Review | 2026-04-07 | OREF_022A_Buyers_Repair_Addendum_1_v2_EXECUTED_20250124.pdf |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | In Review | 2026-04-07 | OREF_024_Owner_Association_Addendum_EXECUTED_20250124.pdf |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | In Review | 2026-04-07 | OREF_046_Woodstove_Addendum_EXECUTED_20250124.pdf |
| 11 | Contingency Removal Addendum  | Sales Documentation | In Review | 2026-04-07 | OREF_060_Contingency_Removal_Addendum_1_EXECUTED_20250124.pdf |
| 12 | Agreement to Occupy  | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale  | Sales Documentation | Optional | n/a |  |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Optional | n/a |  |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | In Review | 2026-04-07 | Sellers_Property_Disclosure_Statement_EXECUTED_20250124.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | In Review | 2026-04-07 | OREF_021_Lead_Based_Paint_Disclosure_Addendum_EXECUTED_20250124.pdf |
| 23 | Electronic Funds Advisory | Disclosures | In Review | 2026-04-07 | Advisory_Regarding_Electronic_Funds_EXECUTED_20250124.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | In Review | 2026-04-07 | Advisory_Regarding_Real_Estate_Compensation_Buyer_EXECUTED_20250124.pdf |
| 25 | FIRPTA Advisory | Disclosures | In Review | 2026-04-07 | Advisory_Regarding_FIRPTA_Tax_Buyer_EXECUTED_20250124.pdf |
| 26 | Real Estate Forms Advisory | Disclosures | Required | n/a |  |
| 27 | Smoke Alarms Advisory | Disclosures | Required | n/a |  |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | In Review | 2026-04-07 | OREF_021_Lead_Based_Paint_Addendum_EXECUTED_20250124.pdf |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 35 | Earnest Money Receipt | Closing Documents | In Review | 2026-04-07 | Balance_Letter_RECEIVED_20250123.pdf |
| 36 | Preliminary Title Report | Closing Documents | Required | n/a |  |
| 37 | Final HUD | Closing Documents | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | In Review | 2026-04-07 | OREF_108_Advisory_and_Instructions_Regarding_RE_Forms_Buyer_EXECUTED_20250124.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | In Review | 2026-04-07 | Buyer_Representation_Agreement_Exclusive_EXECUTED_20250124.pdf |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2026-04-05 | 2026-04-10 | addendum | OREF_009_Back_Up_Offer_Addendum_v1_EXECUTED_20250124.pdf | pages=2, textLen=8059, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, negative_outcome_word_present, signature_labels_present |
| 2 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_v1_EXECUTED_20250124.pdf | pages=1, textLen=6418, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 3 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_004_Buyers_Counter_Offer_1_v1_EXECUTED_20250124.pdf | pages=1, textLen=6025, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 4 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v1_EXECUTED_20250124.pdf | pages=15, textLen=87984, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 5 | 2026-04-05 | 2026-04-10 | seller_property_disclosure | Sellers_Property_Disclosure_Statement_EXECUTED_20250124.pdf | _skipped_ |
| 6 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_v1_EXECUTED_20250124.pdf | pages=1, textLen=5287, signals=e_sign_vendor_markers_present, signature_labels_present |
| 7 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_004_Buyers_Counter_Offer_1_v2_EXECUTED_20250124.pdf | pages=1, textLen=6081, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 8 | 2026-04-05 | 2026-04-10 | addendum | OREF_060_Contingency_Removal_Addendum_1_EXECUTED_20250124.pdf | pages=1, textLen=4628, signals=e_sign_vendor_markers_present, signature_labels_present |
| 9 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Real_Estate_Sale_Agreement_EXECUTED_20250124.pdf | pages=1, textLen=1809, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, negative_outcome_word_present, signature_labels_present |
| 10 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_004_Buyers_Counter_Offer_1_v3_EXECUTED_20250124.pdf | pages=1, textLen=6301, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 11 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_3_EXECUTED_20250125.pdf | pages=1, textLen=4520, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 12 | 2026-04-05 | 2026-04-10 | addendum | OREF_022A_Buyers_Repair_Addendum_1_v1_EXECUTED_20250124.pdf | pages=3, textLen=18608, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 13 | 2026-04-05 | 2026-04-10 | other_pdf | Advisory_Regarding_Electronic_Funds_EXECUTED_20250124.pdf | _skipped_ |
| 14 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_2_v1_EXECUTED_20250124.pdf | pages=1, textLen=5952, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 15 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_2_v2_EXECUTED_20250124.pdf | pages=1, textLen=5970, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 16 | 2026-04-05 | 2026-04-10 | listing_agreement | Buyer_Representation_Agreement_Exclusive_EXECUTED_20250124.pdf | _skipped_ |
| 17 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v2_EXECUTED_20250124.pdf | pages=14, textLen=83313, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 18 | 2026-04-05 | 2026-04-10 | addendum | OREF_021_Lead_Based_Paint_Disclosure_Addendum_EXECUTED_20250124.pdf | pages=12, textLen=10765, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 19 | 2026-04-05 | 2026-04-10 | addendum | OREF_046_Woodstove_Addendum_EXECUTED_20250124.pdf | pages=1, textLen=6286, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 20 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_2_EXECUTED_20250124.pdf | pages=1, textLen=4181, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 21 | 2026-04-05 | 2026-04-10 | addendum | OREF_022B_Sellers_Repair_Addendum_EXECUTED_20250125.pdf | pages=1, textLen=4560, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, signature_labels_present |
| 22 | 2026-04-05 | 2026-04-10 | addendum | Addendum_Sales_Price_EXECUTED_20250303.pdf | pages=1, textLen=1812, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, negative_outcome_word_present, signature_labels_present |
| 23 | 2026-04-05 | 2026-04-10 | addendum | OREF_022A_Buyers_Repair_Addendum_1_v2_EXECUTED_20250124.pdf | pages=3, textLen=18837, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 24 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_Seller_Signed_EXECUTED_20250124.pdf | pages=1, textLen=6137, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 25 | 2026-04-05 | 2026-04-10 | addendum | OREF_048_Seller_Contributions_Addendum_1_v1_EXECUTED_20250124.pdf | pages=1, textLen=4804, signals=e_sign_vendor_markers_present, signature_labels_present |
| 26 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_v2_EXECUTED_20250124.pdf | pages=1, textLen=5195, signals=e_sign_vendor_markers_present, signature_labels_present |
| 27 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_2_EXECUTED_20250124.pdf | pages=1, textLen=5328, signals=e_sign_vendor_markers_present, signature_labels_present |
| 28 | 2026-04-05 | 2026-04-10 | addendum | OREF_081_On_Site_Sewage_Addendum_v2_EXECUTED_20250124.pdf | pages=2, textLen=9082, signals=e_sign_vendor_markers_present, signature_labels_present |
| 29 | 2026-04-05 | 2026-04-10 | addendum | OREF_081_On_Site_Sewage_Addendum_v1_EXECUTED_20250124.pdf | pages=2, textLen=9061, signals=e_sign_vendor_markers_present, signature_labels_present |
| 30 | 2026-04-05 | 2026-04-10 | other_pdf | Balance_Letter_RECEIVED_20241230.pdf | _skipped_ |
| 31 | 2026-04-05 | 2026-04-10 | buyer_offer_or_package | Advisory_Regarding_Real_Estate_Compensation_Buyer_EXECUTED_20250124.pdf | pages=1, textLen=6405, signals=e_sign_vendor_markers_present, signature_labels_present |
| 32 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_EXECUTED_20250124.pdf | pages=1, textLen=6105, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 33 | 2026-04-05 | 2026-04-10 | other_pdf | Proof_of_Funds_RECEIVED_20250124.pdf | _skipped_ |
| 34 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v3_EXECUTED_20250124.pdf | pages=14, textLen=83278, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 35 | 2026-04-05 | 2026-04-10 | other_pdf | Balance_Letter_RECEIVED_20250111.pdf | _skipped_ |
| 36 | 2026-04-05 | 2026-04-10 | title_or_hoa | HOA_Townhome_Planned_Community_Documents_RECEIVED_20250124.pdf | _skipped_ |
| 37 | 2026-04-05 | 2026-04-10 | buyer_offer_or_package | Advisory_Regarding_FIRPTA_Tax_Buyer_EXECUTED_20250124.pdf | pages=1, textLen=6609, signals=e_sign_vendor_markers_present, signature_labels_present |
| 38 | 2026-04-05 | 2026-04-10 | addendum | OREF_024_Owner_Association_Addendum_EXECUTED_20250124.pdf | pages=2, textLen=8990, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 39 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v5_EXECUTED_20250124.pdf | pages=18, textLen=100861, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 40 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_3_EXECUTED_20250124.pdf | pages=1, textLen=5331, signals=e_sign_vendor_markers_present, signature_labels_present |
| 41 | 2026-04-05 | 2026-04-10 | addendum | OREF_058_Professional_Inspection_Addendum_EXECUTED_20250124.pdf | pages=1, textLen=7012, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 42 | 2026-04-05 | 2026-04-10 | addendum | OREF_009_Back_Up_Offer_Addendum_v2_EXECUTED_20250124.pdf | pages=2, textLen=8072, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, negative_outcome_word_present, signature_labels_present |
| 43 | 2026-04-05 | 2026-04-10 | addendum | OREF_048_Seller_Contributions_Addendum_1_EXECUTED_20250124.pdf | pages=1, textLen=4807, signals=e_sign_vendor_markers_present, signature_labels_present |
| 44 | 2026-04-05 | 2026-04-10 | buyer_offer_or_package | OREF_108_Advisory_and_Instructions_Regarding_RE_Forms_Buyer_EXECUTED_20250124.pdf | pages=1, textLen=4185, signals=e_sign_vendor_markers_present, signature_labels_present |
| 45 | 2026-04-05 | 2026-04-10 | other_pdf | Balance_Letter_RECEIVED_20250123.pdf | _skipped_ |
| 46 | 2026-04-05 | 2026-04-10 | addendum | OREF_021_Lead_Based_Paint_Addendum_EXECUTED_20250124.pdf | pages=12, textLen=35559, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 47 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v4_EXECUTED_20250124.pdf | pages=15, textLen=87938, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |

### Narrative timeline (best-effort)

- **Forms inventory**: 47 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 3 ("offer" family). **Counter-like**: 10 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 5.
- **Deep read coverage**: 39 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Expired**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 2732 NW Ordway Avenue, Bend, OR 97703

- **Folder id (`saleGuid`)**: `f88642ff-22e6-4618-b9e1-40b168a439e1`
- **MLS**: 220201089
- **SkySlope status**: Expired
- **Linked listingGuid**: n/a
- **Sale price / list price**: 880000 / 0
- **Contract acceptance**: 2025-05-08
- **Escrow closing**: 2025-06-09
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-04-03

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | In Review | 2026-04-07 | OREF_001_Residential_Real_Estate_Sale_Agreement_v1_EXECUTED_20250508.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | In Review | 2026-04-07 | Pre_Approval_Letter_RECEIVED_20250505.pdf |
| 3 | Counter Offers  | Sales Documentation | In Review | 2026-04-07 | OREF_003_Sellers_Counter_Offer_1_EXECUTED_20250508.pdf |
| 4 | Sale Addendums  | Sales Documentation | In Review | 2026-04-07 | OREF_002_Addendum_to_Sale_Agreement_1_v2_EXECUTED_20250508.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | In Review | 2026-04-07 | OREF_022B_Sellers_Repair_Addendum_1_EXECUTED_20250508.pdf |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | In Review | 2026-04-07 | OREF_024_Owner_Association_Addendum_1_EXECUTED_20250508.pdf |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | Optional | n/a |  |
| 11 | Contingency Removal Addendum  | Sales Documentation | In Review | 2026-04-07 | OREF_060_Contingency_Removal_Addendum_2_EXECUTED_20250508.pdf |
| 12 | Agreement to Occupy  | Sales Documentation | In Review | 2026-04-07 | OREF_054_Agreement_to_Occupy_After_Closing_EXECUTED_20250508.pdf |
| 13 | Bill Of Sale  | Sales Documentation | Optional | n/a |  |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Optional | n/a |  |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | In Review | 2026-04-07 | Property_Disclosure_Statement_EXECUTED_20250508.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | Required | n/a |  |
| 24 | Real Estate Compensation Advisory | Disclosures | In Review | 2026-04-07 | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20250508.pdf |
| 25 | FIRPTA Advisory | Disclosures | Required | n/a |  |
| 26 | Real Estate Forms Advisory | Disclosures | Required | n/a |  |
| 27 | Smoke Alarms Advisory | Disclosures | Required | n/a |  |
| 28 | Association Advisory  | Disclosures | In Review | 2026-04-07 | Advisory_to_Buyer_Regarding_Owner_Association_EXECUTED_20250508.pdf |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 35 | Earnest Money Receipt | Closing Documents | Required | n/a |  |
| 36 | Preliminary Title Report | Closing Documents | Required | n/a |  |
| 37 | Final HUD | Closing Documents | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | Required | n/a |  |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Required | n/a |  |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2026-04-05 | 2026-04-10 | addendum | OREF_022A_Buyers_Repair_Addendum_2_EXECUTED_20250508.pdf | pages=2, textLen=12124, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 2 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_EXECUTED_20250508.pdf | pages=1, textLen=6214, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 3 | 2026-04-05 | 2026-04-10 | other_pdf | OREF_054_Agreement_to_Occupy_After_Closing_EXECUTED_20250508.pdf | _skipped_ |
| 4 | 2026-04-05 | 2026-04-10 | addendum | OREF_024_Owner_Association_Addendum_1_EXECUTED_20250508.pdf | pages=2, textLen=8997, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 5 | 2026-04-05 | 2026-04-10 | addendum | OREF_022B_Sellers_Repair_Addendum_1_EXECUTED_20250508.pdf | pages=1, textLen=6434, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 6 | 2026-04-05 | 2026-04-10 | addendum | Seller_Name_Change_Addendum_EXECUTED_20250508.pdf | pages=1, textLen=5442, signals=e_sign_vendor_markers_present, signature_labels_present |
| 7 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_2_EXECUTED_20250508.pdf | pages=1, textLen=5265, signals=e_sign_vendor_markers_present, signature_labels_present |
| 8 | 2026-04-05 | 2026-04-10 | addendum | OREF_060_Contingency_Removal_Addendum_2_EXECUTED_20250508.pdf | pages=1, textLen=4603, signals=e_sign_vendor_markers_present, signature_labels_present |
| 9 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v1_EXECUTED_20250508.pdf | pages=16, textLen=93703, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 10 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_004_Buyers_Counter_Offer_1_EXECUTED_20250508.pdf | pages=1, textLen=6031, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 11 | 2026-04-05 | 2026-04-10 | addendum | OREF_022A_Buyers_Repair_Addendum_1_EXECUTED_20250508.pdf | pages=2, textLen=12535, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 12 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v2_EXECUTED_20250508.pdf | pages=16, textLen=93562, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 13 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Real_Estate_Purchase_and_Sale_EXECUTED_20250508.pdf | pages=1, textLen=3133, signals=e_sign_vendor_markers_present, signature_labels_present |
| 14 | 2026-04-05 | 2026-04-10 | buyer_offer_or_package | Advisory_to_Buyer_Regarding_Owner_Association_EXECUTED_20250508.pdf | pages=2, textLen=10631, signals=e_sign_vendor_markers_present, signature_labels_present |
| 15 | 2026-04-05 | 2026-04-10 | addendum | OREF_060_Contingency_Removal_Addendum_1_EXECUTED_20250508.pdf | pages=1, textLen=4533, signals=e_sign_vendor_markers_present, signature_labels_present |
| 16 | 2026-04-05 | 2026-04-10 | amendment_or_notice | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20250508.pdf | pages=1, textLen=5809, signals=e_sign_vendor_markers_present, signature_labels_present |
| 17 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_v2_EXECUTED_20250508.pdf | pages=1, textLen=5505, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 18 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v3_EXECUTED_20250508.pdf | pages=15, textLen=87905, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 19 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_EXECUTED_20250508.pdf | pages=1, textLen=5395, signals=e_sign_vendor_markers_present, signature_labels_present |
| 20 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_5_EXECUTED_20250508.pdf | pages=1, textLen=5526, signals=e_sign_vendor_markers_present, signature_labels_present |
| 21 | 2026-04-05 | 2026-04-10 | other_pdf | Pre_Approval_Letter_RECEIVED_20250505.pdf | _skipped_ |
| 22 | 2026-04-05 | 2026-04-10 | addendum | OREF_024_Owner_Association_Addendum_2_EXECUTED_20250508.pdf | pages=2, textLen=9130, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 23 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_3_EXECUTED_20250508.pdf | pages=1, textLen=5242, signals=e_sign_vendor_markers_present, signature_labels_present |
| 24 | 2026-04-05 | 2026-04-10 | seller_property_disclosure | Property_Disclosure_Statement_EXECUTED_20250508.pdf | _skipped_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 24 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 2 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 3.
- **Deep read coverage**: 21 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Expired**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 534 Crowson Rd, Ashland, OR 97520

- **Folder id (`saleGuid`)**: `1f4436e6-25b8-4b26-84f2-14f0d9e2b81c`
- **MLS**: 220201983
- **SkySlope status**: Expired
- **Linked listingGuid**: n/a
- **Sale price / list price**: 1020000 / 0
- **Contract acceptance**: 2025-04-01
- **Escrow closing**: 2025-05-16
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-04-03

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | In Review | 2026-04-07 | OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20250401.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | In Review | 2026-04-07 | Offer_2_Pre_Approval_Letter_Updated_RECEIVED_20250401.pdf |
| 3 | Counter Offers  | Sales Documentation | In Review | 2026-04-07 | Counteroffer_to_Real_Estate_Purchase_and_Sale_EXECUTED_20250401.pdf |
| 4 | Sale Addendums  | Sales Documentation | In Review | 2026-04-07 | Offer_2_General_Addendum_to_Sale_Agreement_EXECUTED_20250401.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | In Review | 2026-04-07 | Offer_2_OREF_022A_Buyers_Repair_Addendum_EXECUTED_20250401.pdf |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Required | n/a |  |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | Optional | n/a |  |
| 11 | Contingency Removal Addendum  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy  | Sales Documentation | In Review | 2026-04-07 | Offer_2_Seller_Occupancy_Addendum_EXECUTED_20250401.pdf |
| 13 | Bill Of Sale  | Sales Documentation | In Review | 2026-04-07 | Furniture_Agreement_EXECUTED_20250424.pdf |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Optional | n/a |  |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | In Review | 2026-04-07 | Seller_Property_Disclosure_Statement_EXECUTED_20250401.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | In Review | 2026-04-07 | Wire_Fraud_Advisory_EXECUTED_20250401.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | In Review | 2026-04-07 | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20250401.pdf |
| 25 | FIRPTA Advisory | Disclosures | In Review | 2026-04-07 | FIRPTA_Foreign_Investment_in_Real_Property_Tax_Act_EXECUTED_20250401.pdf |
| 26 | Real Estate Forms Advisory | Disclosures | Required | n/a |  |
| 27 | Smoke Alarms Advisory | Disclosures | Required | n/a |  |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 35 | Earnest Money Receipt | Closing Documents | Required | n/a |  |
| 36 | Preliminary Title Report | Closing Documents | Required | n/a |  |
| 37 | Final HUD | Closing Documents | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | In Review | 2026-04-07 | Initial_Agency_Disclosure_Pamphlet_EXECUTED_20250401.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | In Review | 2026-04-07 | OREF_093_Exclusive_Listing_Agreement_EXECUTED_20250401.pdf |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Sale_Agreement_5_EXECUTED_20250401.pdf | pages=1, textLen=3068, signals=e_sign_vendor_markers_present, signature_labels_present |
| 2 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_EXECUTED_20250401.pdf | pages=1, textLen=6563, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 3 | 2026-04-05 | 2026-04-10 | other_pdf | Crowson_Locks_Photo_RECEIVED_20250401.pdf | _skipped_ |
| 4 | 2026-04-05 | 2026-04-10 | other_pdf | Advisory_Regarding_FIRPTA_Tax_Seller_EXECUTED_20250401.pdf | _skipped_ |
| 5 | 2026-04-05 | 2026-04-10 | addendum | Well_Addendum_EXECUTED_20250401.pdf | pages=2, textLen=8726, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 6 | 2026-04-05 | 2026-04-10 | addendum | Offer_2_OREF_082_Well_Addendum_EXECUTED_20250401.pdf | pages=2, textLen=8766, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 7 | 2026-04-05 | 2026-04-10 | amendment_or_notice | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20250401.pdf | pages=1, textLen=3281, signals=e_sign_vendor_markers_present, signature_labels_present |
| 8 | 2026-04-05 | 2026-04-10 | addendum | OREF_081_On_Site_Sewage_Addendum_EXECUTED_20250401.pdf | pages=1, textLen=6384, signals=e_sign_vendor_markers_present, word_accepted_present |
| 9 | 2026-04-05 | 2026-04-10 | other_pdf | Seller_Advisory_RECEIVED_20250401.pdf | _skipped_ |
| 10 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Sale_Agreement_4_EXECUTED_20250401.pdf | pages=1, textLen=3318, signals=e_sign_vendor_markers_present, signature_labels_present |
| 11 | 2026-04-05 | 2026-04-10 | other_pdf | FIRPTA_Foreign_Investment_in_Real_Property_Tax_Act_EXECUTED_20250401.pdf | _skipped_ |
| 12 | 2026-04-05 | 2026-04-10 | agency_disclosure_pamphlet | Initial_Agency_Disclosure_Pamphlet_EXECUTED_20250401.pdf | _skipped_ |
| 13 | 2026-04-05 | 2026-04-10 | other_pdf | Titan_Heating_Invoice_25_105_RECEIVED_20250401.pdf | _skipped_ |
| 14 | 2026-04-05 | 2026-04-10 | addendum | HVAC_Addendum_EXECUTED_20250401.pdf | pages=1, textLen=3477, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 15 | 2026-04-05 | 2026-04-10 | addendum | Offer_2_OREF_022A_Buyers_Repair_Addendum_EXECUTED_20250401.pdf | pages=1, textLen=5399, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 16 | 2026-04-05 | 2026-04-10 | earnest_or_wire | Wire_Fraud_Advisory_EXECUTED_20250401.pdf | _skipped_ |
| 17 | 2026-04-05 | 2026-04-10 | addendum | Offer_2_Seller_Occupancy_Addendum_EXECUTED_20250401.pdf | pages=3, textLen=17241, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 18 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | Counteroffer_to_Real_Estate_Purchase_and_Sale_EXECUTED_20250401.pdf | pages=3, textLen=15061, signals=e_sign_vendor_markers_present, signature_labels_present |
| 19 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | Offer_2_OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20250401.pdf | pages=12, textLen=76932, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 20 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Sale_Agreement_3_EXECUTED_20250401.pdf | pages=1, textLen=3037, signals=e_sign_vendor_markers_present, signature_labels_present |
| 21 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Sale_Agreement_2_EXECUTED_20250401.pdf | pages=1, textLen=2975, signals=e_sign_vendor_markers_present, signature_labels_present |
| 22 | 2026-04-05 | 2026-04-10 | addendum | Offer_2_General_Addendum_to_Sale_Agreement_EXECUTED_20250401.pdf | pages=1, textLen=3210, signals=e_sign_vendor_markers_present, signature_labels_present |
| 23 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Sale_Agreement_1_EXECUTED_20250401.pdf | pages=1, textLen=3471, signals=e_sign_vendor_markers_present, signature_labels_present |
| 24 | 2026-04-05 | 2026-04-10 | agency_disclosure_pamphlet | Furniture_Agreement_EXECUTED_20250424.pdf | _skipped_ |
| 25 | 2026-04-05 | 2026-04-10 | listing_agreement | OREF_093_Exclusive_Listing_Agreement_EXECUTED_20250401.pdf | _skipped_ |
| 26 | 2026-04-05 | 2026-04-10 | other_pdf | Titan_Heating_Invoice_25_102_RECEIVED_20250401.pdf | _skipped_ |
| 27 | 2026-04-05 | 2026-04-10 | seller_property_disclosure | Seller_Property_Disclosure_Statement_EXECUTED_20250401.pdf | _skipped_ |
| 28 | 2026-04-05 | 2026-04-10 | buyer_offer_or_package | Offer_2_Pre_Approval_Letter_Updated_RECEIVED_20250401.pdf | pages=1, textLen=1544, signals=e_sign_vendor_markers_present, word_accepted_present |
| 29 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20250401.pdf | pages=12, textLen=75955, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 30 | 2026-04-05 | 2026-04-10 | addendum | Offer_2_OREF_081_On_Site_Sewage_Addendum_EXECUTED_20250401.pdf | pages=1, textLen=6515, signals=e_sign_vendor_markers_present, word_accepted_present |
| 31 | 2026-04-05 | 2026-04-10 | other_pdf | Titan_Heating_Letter_RECEIVED_20250401.pdf | _skipped_ |
| 32 | 2026-04-05 | 2026-04-10 | other_pdf | Metal_Masters_Invoice_1_RECEIVED_20250308.pdf | _skipped_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 32 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 2 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 2.
- **Deep read coverage**: 19 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Expired**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 54474 Huntington Road, Bend, OR 97707

- **Folder id (`saleGuid`)**: `13e20213-81eb-4e8f-b7de-534f863af3a2`
- **MLS**: 220185942
- **SkySlope status**: Closed
- **Linked listingGuid**: n/a
- **Sale price / list price**: 583000 / 0
- **Contract acceptance**: 2024-12-01
- **Escrow closing**: 2025-01-08
- **Actual closing**: 2026-04-09
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-04-03

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | In Review | 2026-04-07 | Offer_6_-_Residential_Real_Estate_Sale_Agreement Fully Executed.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | In Review | 2026-04-07 | offer 6 preapproval.pdf |
| 3 | Counter Offers  | Sales Documentation | In Review | 2026-04-07 | Offer 6 - Sellers_Counter_Offer_1 Fully Executed.pdf |
| 4 | Sale Addendums  | Sales Documentation | In Review | 2026-04-07 | Addendum to Sale Agreement 2 - 002 OREF.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | In Review | 2026-04-07 | Sellers Repair Addendum - 022B _1_ OREF.pdf |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Required | n/a |  |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | In Review | 2026-04-07 | OREF_046_Woodstove_Addendum_EXECUTED_20241001.pdf |
| 11 | Contingency Removal Addendum  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy  | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale  | Sales Documentation | In Review | 2026-04-07 | Bill of Sale - 071 OREF.pdf |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Optional | n/a |  |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | In Review | 2026-04-07 | Updated Sellers Disclosures.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | In Review | 2026-04-07 | Advisory Regarding Electronic Funds - 043 OREF.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | In Review | 2026-04-07 | Notice of Real Estate Compensation - 091 OREF.pdf |
| 25 | FIRPTA Advisory | Disclosures | In Review | 2026-04-07 | Advisory Regarding FIRPTA Tax - 092 OREF.pdf |
| 26 | Real Estate Forms Advisory | Disclosures | Required | n/a |  |
| 27 | Smoke Alarms Advisory | Disclosures | Required | n/a |  |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | In Review | 2026-04-07 | Offer 2 - Lead Based Paint Disclosure Addendum - 021 OREF.pdf |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 35 | Earnest Money Receipt | Closing Documents | In Review | 2026-04-07 | Offer 3 - Earnest Money Deposit.pdf |
| 36 | Preliminary Title Report | Closing Documents | Required | n/a |  |
| 37 | Final HUD | Closing Documents | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | In Review | 2026-04-07 | Oregon Real Estate Agency Disclosure Pamphlet - 042 OREF.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | In Review | 2026-04-07 | Offer 3 - Buyers Repair Addendum 2.pdf |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | In Review | 2026-04-07 | Disclosed Limited Agency Agreement for Sellers - 040 OREF.pdf |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2026-04-05 | n/a | addendum | Offer 2 - Addendum to Sale Agreement 1 - 002 OREF.pdf | pages=1, textLen=5075, signals=e_sign_vendor_markers_present, signature_labels_present |
| 2 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 2- Advisory Regarding Electronic Funds - 043 OREF.pdf | pages=1, textLen=4519, signals=e_sign_vendor_markers_present, signature_labels_present |
| 3 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 2- VA_FHA Amendatory Clause and Real Estate Certification - 097 OREF.pdf | pages=1, textLen=5630, signals=e_sign_vendor_markers_present, signature_labels_present |
| 4 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 2 - Advisory Regarding FIRPTA Tax - 092 OREF.pdf | pages=2, textLen=7834, signals=e_sign_vendor_markers_present, signature_labels_present |
| 5 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 2 -Advisory Regarding Smoke and Carbon Monoxide Alarms - 080 OREF.pdf | pages=1, textLen=4695, signals=e_sign_vendor_markers_present, signature_labels_present |
| 6 | 2026-04-05 | n/a | addendum | Offer 2 - Woodstove Wood Burning Fireplace Insert Addendum - 046 OREF.pdf | pages=1, textLen=6104, signals=e_sign_vendor_markers_present, signature_labels_present |
| 7 | 2026-04-05 | n/a | sale_agreement_or_rsa | Offer 2 - Residential Real Estate Sale Agreement - 001 OREF _1_.pdf | pages=14, textLen=78954, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 8 | 2026-04-05 | 2026-04-07 | addendum | Offer 2 - Lead Based Paint Disclosure Addendum - 021 OREF.pdf | pages=2, textLen=7214, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 9 | 2026-04-05 | 2026-04-07 | other_pdf | Bill of Sale - 071 OREF.pdf | _skipped_ |
| 10 | 2026-04-05 | 2026-04-07 | addendum | Addendum to Sale Agreement 2 - 002 OREF.pdf | pages=1, textLen=2277, signals=e_sign_vendor_markers_present, signature_labels_present |
| 11 | 2026-04-05 | n/a | termination_or_release | Offer 3 - Termination Addendum.pdf | pages=1, textLen=1811, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 12 | 2026-04-05 | 2026-04-07 | addendum | Sellers Repair Addendum - 022B _1_ OREF.pdf | pages=1, textLen=6274, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 13 | 2026-04-05 | n/a | addendum | Offer 6 -Seller_Contributions_Addendum_1_-_048_OREF.pdf | pages=1, textLen=4884, signals=e_sign_vendor_markers_present, signature_labels_present |
| 14 | 2026-04-05 | n/a | sale_agreement_or_rsa | Offer 3 - Residential Sale Agreement.pdf | pages=14, textLen=76703, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 15 | 2026-04-05 | n/a | addendum | Offer 2 - Septic Addendum.pdf | pages=2, textLen=9327, signals=e_sign_vendor_markers_present, signature_labels_present |
| 16 | 2026-04-05 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | pages=1, textLen=6403, signals=e_sign_vendor_markers_present, signature_labels_present |
| 17 | 2026-04-05 | n/a | sale_agreement_or_rsa | Offer 6 - Residential_Real_Estate_Sale_Agreement.pdf | pages=14, textLen=84543, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 18 | 2026-04-05 | n/a | addendum | Private Well Addendum to Real Estate Sale Agreement - 082 OREF.pdf | pages=2, textLen=10483, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 19 | 2026-04-05 | n/a | other_pdf | unnamed document.pdf | _skipped_ |
| 20 | 2026-04-05 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF.pdf | pages=1, textLen=6208, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 21 | 2026-04-05 | n/a | sale_agreement_or_rsa | Offer 2 - Residential Sale Agreement.pdf | pages=14, textLen=84897, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 22 | 2026-04-05 | n/a | seller_property_disclosure | Exterior Siding - Stucco - EIFS Disclosure - 025 OREF.pdf | _skipped_ |
| 23 | 2026-04-05 | n/a | addendum | Offer 6 -Private_Well_Addendum_to_Real_Estate_Sale_Agreement_-_082_OREF.pdf | pages=2, textLen=10647, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 24 | 2026-04-05 | n/a | addendum | Offer 6 -Septic-Onsite_Sewage_System_Addendum_-_081_OREF.pdf | pages=2, textLen=9209, signals=e_sign_vendor_markers_present, signature_labels_present |
| 25 | 2026-04-05 | n/a | listing_agreement | Revised Listing Contract.pdf | _skipped_ |
| 26 | 2026-04-05 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _skipped_ |
| 27 | 2026-04-05 | 2026-04-07 | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | pages=1, textLen=4564, signals=e_sign_vendor_markers_present, signature_labels_present |
| 28 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 3 - Signed Well Report.pdf | pages=1, textLen=3599, signals=alt_e_sign_vendor_possible |
| 29 | 2026-04-05 | n/a | addendum | Addendum to Sale Agreement 3 - 002 OREF.pdf | pages=1, textLen=2756, signals=e_sign_vendor_markers_present, signature_labels_present |
| 30 | 2026-04-05 | n/a | addendum | Offer 2 - Well Addendum.pdf | pages=2, textLen=10924, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 31 | 2026-04-05 | n/a | addendum | Sellers Property Disclosure Statement Addendum _1_ - 028 OREF.pdf | pages=1, textLen=5242, signals=e_sign_vendor_markers_present, signature_labels_present |
| 32 | 2026-04-05 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _skipped_ |
| 33 | 2026-04-05 | 2026-04-07 | lender_financing | offer 6 preapproval.pdf | pages=1, textLen=981, signals= |
| 34 | 2026-04-05 | n/a | addendum | Addendum to Sale Agreement 4 - 002 OREF.pdf | pages=1, textLen=2058, signals=e_sign_vendor_markers_present, signature_labels_present |
| 35 | 2026-04-05 | n/a | addendum | Septic-Onsite Sewage System Addendum - 081 OREF.pdf | pages=2, textLen=9018, signals=e_sign_vendor_markers_present, signature_labels_present |
| 36 | 2026-04-05 | n/a | addendum | Sellers Property Disclosure Statement Addendum _1_ - 028 OREF_2.pdf | pages=1, textLen=5474, signals=e_sign_vendor_markers_present, signature_labels_present |
| 37 | 2026-04-05 | n/a | addendum | Private Well Addendum to Real Estate Sale Agreement - 082 OREF_2.pdf | pages=2, textLen=10481, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 38 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 3 - Removal of Contingencies.pdf | pages=1, textLen=2671, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 39 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 1 - Woodstove.pdf | pages=2, textLen=9592, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, signature_labels_present |
| 40 | 2026-04-05 | n/a | addendum | Woodstove Wood Burning Fireplace Insert Addendum - 046 OREF.pdf | pages=1, textLen=6126, signals=e_sign_vendor_markers_present, signature_labels_present |
| 41 | 2026-04-05 | 2026-04-07 | seller_property_disclosure | Updated Sellers Disclosures.pdf | _skipped_ |
| 42 | 2026-04-05 | n/a | termination_or_release | Offer 3 - Termination.pdf | pages=1, textLen=3875, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, negative_outcome_word_present, signature_labels_present |
| 43 | 2026-04-05 | n/a | other_pdf | 2021 Well Log Report.pdf | _skipped_ |
| 44 | 2026-04-05 | n/a | addendum | Offer 3 - Seller Contributions Addendum.pdf | pages=1, textLen=3963, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 45 | 2026-04-05 | 2026-04-07 | earnest_or_wire | Offer 3 - Earnest Money Deposit.pdf | pages=1, textLen=809, signals=e_sign_vendor_markers_present |
| 46 | 2026-04-05 | 2026-04-07 | other_pdf | Disclosed Limited Agency Agreement for Sellers - 040 OREF.pdf | _skipped_ |
| 47 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 6 - Woodstove_Wood_Burning_Fireplace_Insert Fully Executed.pdf | pages=1, textLen=6239, signals=e_sign_vendor_markers_present, signature_labels_present |
| 48 | 2026-04-05 | n/a | addendum | Woodstove Wood Burning Fireplace Insert Addendum - 046 OREF_2.pdf | pages=1, textLen=6132, signals=e_sign_vendor_markers_present, signature_labels_present |
| 49 | 2026-04-05 | n/a | other_pdf | 2021 Well Log Report_2.pdf | _skipped_ |
| 50 | 2026-04-05 | n/a | seller_property_disclosure | Huntington Road Disclosures 3.pdf | _skipped_ |
| 51 | 2026-04-05 | n/a | addendum | Fully Executed Addendum 2 - Personal Property.pdf | pages=1, textLen=6516, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 52 | 2026-04-05 | n/a | addendum | Offer 6 - Addendum to change Broker Commission to Closing Costs_.pdf | pages=1, textLen=5448, signals=e_sign_vendor_markers_present, signature_labels_present |
| 53 | 2026-04-05 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF_2.pdf | _skipped_ |
| 54 | 2026-04-05 | n/a | other_pdf | ORE Residential Input - ODS.pdf | _skipped_ |
| 55 | 2026-04-05 | n/a | lender_financing | Offer 1 - David Hunt Pre approval.pdf | pages=1, textLen=747, signals=e_sign_vendor_markers_present |
| 56 | 2026-04-05 | n/a | other_pdf | 54474 Septic Report.pdf | _skipped_ |
| 57 | 2026-04-05 | n/a | seller_property_disclosure | Huntington Road Disclosures 2.pdf | _skipped_ |
| 58 | 2026-04-05 | 2026-04-07 | other_pdf | Advisory Regarding Electronic Funds - 043 OREF.pdf | _skipped_ |
| 59 | 2026-04-05 | n/a | listing_agreement | MLSCO Listing Contract - ODS.pdf | _skipped_ |
| 60 | 2026-04-05 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF_2.pdf | pages=2, textLen=11724, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 61 | 2026-04-05 | n/a | seller_property_disclosure | Exterior Siding - Stucco - EIFS Disclosure - 025 OREF_2.pdf | _skipped_ |
| 62 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 1 - Seller contributuons.pdf | pages=14, textLen=76814, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 63 | 2026-04-05 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_2.pdf | _skipped_ |
| 64 | 2026-04-05 | 2026-04-07 | counter_or_counteroffer | Offer 6 - Sellers_Counter_Offer_1 Fully Executed.pdf | pages=1, textLen=6341, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 65 | 2026-04-05 | n/a | addendum | Offer 3 - Buyers Repair Addendum 1.pdf | pages=1, textLen=5209, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, signature_labels_present |
| 66 | 2026-04-05 | 2026-04-07 | agency_disclosure_pamphlet | Oregon Real Estate Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 67 | 2026-04-05 | n/a | addendum | Septic-Onsite Sewage System Addendum - 081 OREF_2.pdf | pages=2, textLen=9020, signals=e_sign_vendor_markers_present, signature_labels_present |
| 68 | 2026-04-05 | 2026-04-07 | addendum | Offer 3 - Buyers Repair Addendum 2.pdf | pages=1, textLen=2224, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 69 | 2026-04-05 | n/a | addendum | Offer_6_-Seller_Contributions_Addendum Fully Executed.pdf | pages=1, textLen=4941, signals=e_sign_vendor_markers_present, signature_labels_present |
| 70 | 2026-04-05 | n/a | addendum | Seller Contributions Addendum 1 - 048 OREF.pdf | pages=1, textLen=4757, signals=e_sign_vendor_markers_present, signature_labels_present |
| 71 | 2026-04-05 | n/a | seller_property_disclosure | Offer 3 - Signed Property Disclosures.pdf | pages=1, textLen=6360, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, signature_labels_present |
| 72 | 2026-04-05 | n/a | lender_financing | Updated Pre approval David Hunt.pdf | _skipped_ |
| 73 | 2026-04-05 | n/a | counter_or_counteroffer | Offer 2 - Seller Counter 1.pdf | pages=1, textLen=6069, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 74 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 3 - Advisories.pdf | pages=3, textLen=12447, signals=e_sign_vendor_markers_present, signature_labels_present |
| 75 | 2026-04-05 | 2026-04-07 | other_pdf | Advisory Regarding FIRPTA Tax - 092 OREF.pdf | _skipped_ |
| 76 | 2026-04-05 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF_3.pdf | _skipped_ |
| 77 | 2026-04-05 | n/a | addendum | Woodstove Wood Burning Fireplace Insert Addendum - 046 OREF_3.pdf | pages=1, textLen=6133, signals=e_sign_vendor_markers_present, signature_labels_present |
| 78 | 2026-04-05 | n/a | addendum | Woodstove Wood Burning Fireplace Insert Addendum - 046 OREF_4.pdf | pages=1, textLen=6182, signals=e_sign_vendor_markers_present, signature_labels_present |
| 79 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 3 - Signed Septic-Report.pdf | pages=8, textLen=22284, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 80 | 2026-04-05 | n/a | addendum | Offer_6_-Private_Well_Addendum_to_Real_Estate_Sale_Agreement Fully Executed.pdf | pages=2, textLen=10761, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 81 | 2026-04-05 | n/a | earnest_or_wire | Offer 3 - Extension of Earnest Money.pdf | pages=1, textLen=1767, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 82 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 1 - Septic.pdf | pages=2, textLen=8126, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 83 | 2026-04-05 | 2026-04-07 | sale_agreement_or_rsa | Offer_6_-_Residential_Real_Estate_Sale_Agreement Fully Executed.pdf | pages=14, textLen=85341, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 84 | 2026-04-05 | 2026-04-10 | addendum | OREF_046_Woodstove_Addendum_EXECUTED_20241001.pdf | pages=1, textLen=6227, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 85 | 2026-04-05 | n/a | counter_or_counteroffer | Fully Executed Seller Counter 1.pdf | pages=2, textLen=11977, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 86 | 2026-04-05 | 2026-04-10 | other_pdf | Personal_Inventory_List_RECEIVED_20241001.pdf | _skipped_ |
| 87 | 2026-04-05 | 2026-04-10 | addendum | Offer_6_OREF_081_On_Site_Sewage_Addendum_EXECUTED_20250101.pdf | pages=2, textLen=9323, signals=e_sign_vendor_markers_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 88 | 2026-04-05 | 2026-04-10 | seller_property_disclosure | Offer_6_OREF_025_Exterior_Siding_Disclosure_EXECUTED_20250101.pdf | pages=1, textLen=6092, signals=e_sign_vendor_markers_present, signature_labels_present |
| 89 | 2026-04-05 | 2026-04-10 | seller_property_disclosure | Huntington_Road_Disclosures_Package_1_EXECUTED_20241001.pdf | _skipped_ |
| 90 | 2026-04-05 | 2026-04-10 | seller_property_disclosure | Offer_3_OREF_020_Seller_Property_Disclosure_Statement_EXECUTED_20241001.pdf | pages=7, textLen=36711, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 91 | 2026-04-05 | 2026-04-10 | buyer_offer_or_package | Offer_3_Addenda_Well_Septic_Woodstove_Bill_of_Sale_EXECUTED_20241001.pdf | pages=7, textLen=14, signals= |

### Narrative timeline (best-effort)

- **Forms inventory**: 91 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 13 ("offer" family). **Counter-like**: 5 (includes OREF counter forms when matched). **Termination/release-like**: 2. **RSA / sale agreement-like**: 5.
- **Deep read coverage**: 66 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 29500 SE Ochoco Way, Prineville, OR 97754

- **Folder id (`saleGuid`)**: `eb9a24d6-f766-4fb7-bfca-a9c7e5b83cf5`
- **MLS**: 220142414
- **SkySlope status**: Expired
- **Linked listingGuid**: n/a
- **Sale price / list price**: 360000 / 0
- **Contract acceptance**: 2024-10-15
- **Escrow closing**: 2024-11-22
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-04-03

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | Completed | 2026-04-07 | Offer_2_OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20241015.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Completed | 2026-04-07 | Offer_2_Pre_Approval_Letter_RECEIVED_20240920.pdf |
| 3 | Counter Offers  | Sales Documentation | Completed | 2026-04-07 | 1_DigiSign_Sellers_Counter_Offer_2_-_003_OREF _1_.pdf |
| 4 | Sale Addendums  | Sales Documentation | In Review | 2026-04-07 | Offer_2_OREF_081_Septic_Onsite_Sewage_Addendum_EXECUTED_20241015.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | In Review | 2026-04-07 | Offer_2_Signed_Seller_Repair_Addendum_v2_EXECUTED_20241015.pdf |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Required | n/a |  |
| 9 | Solar Panel Addendum  | Sales Documentation | In Review | 2026-04-07 | Offer_2_OREF_105_Solar_Panel_System_Advisory_and_Addendum_EXECUTED_20241015.pdf |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | In Review | 2026-04-07 | Offer_2_OREF_046_Woodstove_Addendum_EXECUTED_20241015.pdf |
| 11 | Contingency Removal Addendum  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy  | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale  | Sales Documentation | Optional | n/a |  |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | In Review | 2026-04-07 | Offer_2_VA_FHA_Amendatory_Clause_EXECUTED_20241015.pdf |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | In Review | 2026-04-07 | Sellers_Property_Disclosure_Statement_EXECUTED_20241015.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | In Review | 2026-04-07 | Offer_1_OREF_043_Advisory_Regarding_Electronic_Funds_EXECUTED_20241015.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | In Review | 2026-04-07 | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20241015.pdf |
| 25 | FIRPTA Advisory | Disclosures | In Review | 2026-04-07 | OREF_092_Advisory_Regarding_FIRPTA_Tax_EXECUTED_20241015.pdf |
| 26 | Real Estate Forms Advisory | Disclosures | In Review | 2026-04-07 | OREF_104_Advisory_Regarding_Fair_Housing_EXECUTED_20241015.pdf |
| 27 | Smoke Alarms Advisory | Disclosures | In Review | 2026-04-07 | Offer_2_OREF_080_Advisory_Regarding_Smoke_and_Carbon_Monoxide_Alarms_EXECUTED_20241015.pdf |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 35 | Earnest Money Receipt | Closing Documents | Required | n/a |  |
| 36 | Preliminary Title Report | Closing Documents | Required | n/a |  |
| 37 | Final HUD | Closing Documents | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | In Review | 2026-04-07 | Oregon_Real_Estate_Agency_Disclosure_Pamphlet_EXECUTED_20241015.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Completed | 2026-04-07 | MLSCO_Listing_Contract_ODS_EXECUTED_20241015.pdf |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Completed | 2026-04-07 | Disclosed_Limited_Agency_Agreement_for_Sale_EXECUTED_20241015.pdf |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2026-04-04 | 2026-04-10 | termination_or_release | Offer_1_Termination_EXECUTED_20241015.pdf | pages=1, textLen=5768, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 2 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_022A_Buyers_Repair_Addendum_2_EXECUTED_20241015.pdf | pages=1, textLen=6577, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 3 | 2026-04-04 | 2026-04-10 | other_pdf | Greenbar_Excavation_Invoice_TW5630A_RECEIVED_20241015.pdf | _skipped_ |
| 4 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_Fully_Executed_Repair_Addendums_EXECUTED_20241004.pdf | pages=3, textLen=20072, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 5 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_Extension_to_Closing_Date_Addendum_2_EXECUTED_20241015.pdf | pages=1, textLen=2182, signals=e_sign_vendor_markers_present, signature_labels_present |
| 6 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_043_Advisory_Regarding_Electronic_Funds_EXECUTED_20241015.pdf | pages=1, textLen=4549, signals=e_sign_vendor_markers_present, signature_labels_present |
| 7 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_022A_Buyers_Repair_Addendum_1_EXECUTED_20241015.pdf | pages=1, textLen=6577, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 8 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_Extension_to_Closing_Date_Addendum_EXECUTED_20241015.pdf | pages=1, textLen=5322, signals=e_sign_vendor_markers_present, signature_labels_present |
| 9 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_Signed_Seller_Repair_Addendum_v2_EXECUTED_20241015.pdf | pages=2, textLen=13264, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 10 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_OREF_097_VA_FHA_Amendatory_Clause_v1_EXECUTED_20241015.pdf | pages=1, textLen=5790, signals=e_sign_vendor_markers_present, signature_labels_present |
| 11 | 2026-04-04 | 2026-04-10 | sale_agreement_or_rsa | Offer_1_OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20241015.pdf | pages=14, textLen=84591, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 12 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20241015.pdf | pages=1, textLen=4584, signals=e_sign_vendor_markers_present, signature_labels_present |
| 13 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_OREF_059_Receipt_of_Reports_Removal_of_Contingencies_EXECUTED_20241015.pdf | pages=1, textLen=6090, signals=e_sign_vendor_markers_present, signature_labels_present |
| 14 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_097_VA_FHA_Amendatory_Clause_EXECUTED_20241015.pdf | pages=1, textLen=5831, signals=e_sign_vendor_markers_present, signature_labels_present |
| 15 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | Offer_1_OREF_003_Sellers_Counter_Offer_1_v2_EXECUTED_20241015.pdf | pages=1, textLen=5837, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 16 | 2026-04-04 | 2026-04-10 | addendum | Offer_1_OREF_046_Woodstove_Addendum_EXECUTED_20241015.pdf | pages=1, textLen=6316, signals=e_sign_vendor_markers_present, signature_labels_present |
| 17 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_059_Receipt_of_Reports_Removal_of_Contingencies_EXECUTED_20241015.pdf | pages=1, textLen=5856, signals=e_sign_vendor_markers_present, signature_labels_present |
| 18 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_OREF_080_Advisory_Regarding_Smoke_and_Carbon_Monoxide_Alarms_EXECUTED_20241015.pdf | pages=1, textLen=4824, signals=e_sign_vendor_markers_present, signature_labels_present |
| 19 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_048_Seller_Contributions_Addendum_1_v2_EXECUTED_20241015.pdf | pages=1, textLen=4870, signals=e_sign_vendor_markers_present, signature_labels_present |
| 20 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_105_Solar_Panel_System_Advisory_and_Addendum_EXECUTED_20241015.pdf | pages=2, textLen=10231, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 21 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | Offer_2_OREF_003_Sellers_Counter_Offer_2_EXECUTED_20241015.pdf | pages=1, textLen=5903, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 22 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_Henry_Pre_Approval_Letter_RECEIVED_20241015.pdf | pages=2, textLen=3303, signals=e_sign_vendor_markers_present |
| 23 | 2026-04-04 | 2026-04-10 | other_pdf | ORE_Mobile_Home_Input_ODS_EXECUTED_20241015.pdf | _skipped_ |
| 24 | 2026-04-04 | 2026-04-10 | addendum | Offer_1_OREF_081_Septic_Onsite_Sewage_Addendum_EXECUTED_20241015.pdf | pages=2, textLen=9298, signals=e_sign_vendor_markers_present, signature_labels_present |
| 25 | 2026-04-04 | 2026-04-10 | addendum | Offer_1_OREF_048_Seller_Contributions_Addendum_EXECUTED_20241015.pdf | pages=1, textLen=4958, signals=e_sign_vendor_markers_present, signature_labels_present |
| 26 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_048_Seller_Contributions_Addendum_1_EXECUTED_20241015.pdf | pages=1, textLen=4870, signals=e_sign_vendor_markers_present, signature_labels_present |
| 27 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_Signed_Seller_Repair_Addendum_EXECUTED_20241015.pdf | pages=2, textLen=12977, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 28 | 2026-04-04 | 2026-04-10 | amendment_or_notice | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20241015.pdf | pages=1, textLen=4584, signals=e_sign_vendor_markers_present, signature_labels_present |
| 29 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_OREF_092_Advisory_Regarding_FIRPTA_Tax_EXECUTED_20241015.pdf | pages=2, textLen=8051, signals=e_sign_vendor_markers_present, signature_labels_present |
| 30 | 2026-04-04 | 2026-04-10 | other_pdf | MLSCO_Listing_Contract_ODS_EXECUTED_20241015.pdf | pages=3, textLen=14911, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 31 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_081_Septic_Onsite_Sewage_Addendum_EXECUTED_20241015.pdf | pages=2, textLen=9250, signals=e_sign_vendor_markers_present, signature_labels_present |
| 32 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_VA_FHA_Amendatory_Clause_EXECUTED_20241015.pdf | pages=1, textLen=5722, signals=e_sign_vendor_markers_present, signature_labels_present |
| 33 | 2026-04-04 | 2026-04-10 | addendum | OREF_022B_Sellers_Repair_Addendum_1_EXECUTED_20241015.pdf | pages=1, textLen=6283, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 34 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_Advisory_Regarding_Electronic_Funds_EXECUTED_20241015.pdf | pages=1, textLen=4648, signals=e_sign_vendor_markers_present, signature_labels_present |
| 35 | 2026-04-04 | 2026-04-10 | addendum | OREF_048_Seller_Contributions_Addendum_1_EXECUTED_20241015.pdf | pages=1, textLen=4777, signals=e_sign_vendor_markers_present, signature_labels_present |
| 36 | 2026-04-04 | 2026-04-10 | other_pdf | OREF_092_Advisory_Regarding_FIRPTA_Tax_EXECUTED_20241015.pdf | _skipped_ |
| 37 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_046_Woodstove_Addendum_EXECUTED_20241015.pdf | pages=1, textLen=6229, signals=e_sign_vendor_markers_present, signature_labels_present |
| 38 | 2026-04-04 | 2026-04-10 | other_pdf | OREF_104_Advisory_Regarding_Fair_Housing_EXECUTED_20241015.pdf | _skipped_ |
| 39 | 2026-04-04 | 2026-04-07 | counter_or_counteroffer | 1_DigiSign_Sellers_Counter_Offer_2_-_003_OREF _1_.pdf | pages=1, textLen=6050, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 40 | 2026-04-04 | 2026-04-10 | seller_property_disclosure | Sellers_Property_Disclosure_Statement_EXECUTED_20241015.pdf | _skipped_ |
| 41 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_Pre_Approval_Letter_RECEIVED_20240920.pdf | pages=1, textLen=1350, signals=e_sign_vendor_markers_present |
| 42 | 2026-04-04 | 2026-04-10 | earnest_or_wire | Offer_2_MLSCO_Wire_Fraud_Advisory_EXECUTED_20241015.pdf | pages=2, textLen=3019, signals=e_sign_vendor_markers_present, signature_labels_present |
| 43 | 2026-04-04 | 2026-04-10 | sale_agreement_or_rsa | Offer_2_OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20241015.pdf | pages=14, textLen=84431, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 44 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | Offer_2_OREF_003_Sellers_Counter_Offer_1_EXECUTED_20241015.pdf | pages=1, textLen=6050, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 45 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | Offer_1_OREF_003_Sellers_Counter_Offer_1_EXECUTED_20241015.pdf | pages=1, textLen=5992, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 46 | 2026-04-04 | 2026-04-10 | other_pdf | Disclosed_Limited_Agency_Agreement_for_Sale_EXECUTED_20241015.pdf | _skipped_ |
| 47 | 2026-04-04 | 2026-04-10 | agency_disclosure_pamphlet | Oregon_Real_Estate_Agency_Disclosure_Pamphlet_EXECUTED_20241015.pdf | _skipped_ |
| 48 | 2026-04-04 | 2026-04-10 | inspection_or_repair | Ochoco_Repairs_RECEIVED_20241015.pdf | _skipped_ |
| 49 | 2026-04-04 | 2026-04-10 | inspection_or_repair | SE_Ochoco_Inspection_Report_RECEIVED_20241015.pdf | _skipped_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 49 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 12 ("offer" family). **Counter-like**: 5 (includes OREF counter forms when matched). **Termination/release-like**: 1. **RSA / sale agreement-like**: 2.
- **Deep read coverage**: 40 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Expired**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 2129 SW 35th Street, Redmond, OR 97756

- **Folder id (`saleGuid`)**: `a0d269e0-2324-492a-8f5f-dd2385d28bf7`
- **MLS**: 220203591
- **SkySlope status**: Expired
- **Linked listingGuid**: n/a
- **Sale price / list price**: 445000 / 0
- **Contract acceptance**: 2024-11-01
- **Escrow closing**: 2024-12-13
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-04-03

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | In Review | 2026-04-07 | Offer_5_OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20241101.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | In Review | 2026-04-07 | Offer_5_Pre_Approval_Letter_RECEIVED_20241101.pdf |
| 3 | Counter Offers  | Sales Documentation | In Review | 2026-04-07 | OREF_003_Sellers_Counter_Offer_4_EXECUTED_20241101.pdf |
| 4 | Sale Addendums  | Sales Documentation | In Review | 2026-04-07 | OREF_002_Addendum_to_Sale_Agreement_1_EXECUTED_20241101.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | In Review | 2026-04-07 | Offer_1_OREF_058_Professional_Inspection_Addendum_EXECUTED_20241101.pdf |
| 6 | Repair Addendums  | Sales Documentation | In Review | 2026-04-07 | OREF_022B_Sellers_Repair_Addendum_1_EXECUTED_20241101.pdf |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Required | n/a |  |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | Optional | n/a |  |
| 11 | Contingency Removal Addendum  | Sales Documentation | In Review | 2026-04-07 | Offer_5_OREF_060_Removal_of_Contingencies_EXECUTED_20241101.pdf |
| 12 | Agreement to Occupy  | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale  | Sales Documentation | Optional | n/a |  |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Optional | n/a |  |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | In Review | 2026-04-07 | Offer_1_Seller_Property_Disclosure_Statement_EXECUTED_20241101.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | In Review | 2026-04-07 | Advisory_Regarding_Electronic_Funds_EXECUTED_20241101.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | In Review | 2026-04-07 | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20241101.pdf |
| 25 | FIRPTA Advisory | Disclosures | In Review | 2026-04-07 | Offer_1_OREF_092_Advisory_Regarding_FIRPTA_Tax_EXECUTED_20241101.pdf |
| 26 | Real Estate Forms Advisory | Disclosures | In Review | 2026-04-07 | Offer_1_OREF_104_Advisory_Regarding_Fair_Housing_Buyer_EXECUTED_20241101.pdf |
| 27 | Smoke Alarms Advisory | Disclosures | In Review | 2026-04-07 | Offer_1_OREF_080_Advisory_Regarding_Smoke_and_Carbon_Monoxide_Alarms_EXECUTED_20241101.pdf |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 35 | Earnest Money Receipt | Closing Documents | Required | n/a |  |
| 36 | Preliminary Title Report | Closing Documents | Required | n/a |  |
| 37 | Final HUD | Closing Documents | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | In Review | 2026-04-07 | OREF_042_Oregon_Real_Estate_Agency_Disclosure_Pamphlet_EXECUTED_20241101.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | In Review | 2026-04-07 | MLSCO_Listing_Agreement_2_EXECUTED_20241101.pdf |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | In Review | 2026-04-07 | OREF_040_Disclosed_Limited_Agency_Agreement_for_Seller_EXECUTED_20241101.pdf |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_080_Advisory_Regarding_Smoke_and_Carbon_Monoxide_Alarms_EXECUTED_20241101.pdf | pages=1, textLen=4854, signals=e_sign_vendor_markers_present, signature_labels_present |
| 2 | 2026-04-04 | 2026-04-10 | sale_agreement_or_rsa | Offer_1_OREF_001_Residential_Real_Estate_Sale_Agreement_v2_EXECUTED_20241101.pdf | pages=14, textLen=84584, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 3 | 2026-04-04 | 2026-04-10 | addendum | Offer_1_OREF_048_Seller_Contributions_Addendum_1_EXECUTED_20241101.pdf | pages=1, textLen=4849, signals=e_sign_vendor_markers_present, signature_labels_present |
| 4 | 2026-04-04 | 2026-04-10 | addendum | Offer_5_Addendum_1K_Credit_EXECUTED_20241101.pdf | pages=1, textLen=1658, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 5 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_092_Advisory_Regarding_FIRPTA_Tax_EXECUTED_20241101.pdf | pages=2, textLen=8075, signals=e_sign_vendor_markers_present, signature_labels_present |
| 6 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_5_OREF_060_Removal_of_Contingencies_EXECUTED_20241101.pdf | pages=1, textLen=5930, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 7 | 2026-04-04 | 2026-04-10 | addendum | Offer_1_OREF_058_Professional_Inspection_Addendum_EXECUTED_20241101.pdf | pages=1, textLen=7100, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 8 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_5_OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20241101.pdf | pages=1, textLen=4544, signals=e_sign_vendor_markers_present, signature_labels_present |
| 9 | 2026-04-04 | 2026-04-10 | other_pdf | OREF_059_Receipt_of_Reports_Removal_of_Contingencies_EXECUTED_20241101.pdf | _skipped_ |
| 10 | 2026-04-04 | 2026-04-10 | addendum | OREF_048_Seller_Contributions_Addendum_2_EXECUTED_20241101.pdf | pages=1, textLen=4748, signals=e_sign_vendor_markers_present, signature_labels_present |
| 11 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_041_Disclosed_Limited_Agency_Agreement_for_Buyer_EXECUTED_20241101.pdf | pages=1, textLen=4686, signals=e_sign_vendor_markers_present, signature_labels_present |
| 12 | 2026-04-04 | 2026-04-10 | agency_disclosure_pamphlet | Offer_1_OREF_042_Oregon_Real_Estate_Agency_Disclosure_Pamphlet_EXECUTED_20241101.pdf | pages=3, textLen=12048, signals=e_sign_vendor_markers_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 13 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_EXECUTED_20241101.pdf | pages=1, textLen=5887, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 14 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_043_Advisory_Regarding_Electronic_Funds_EXECUTED_20241101.pdf | pages=1, textLen=4679, signals=e_sign_vendor_markers_present, signature_labels_present |
| 15 | 2026-04-04 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_EXECUTED_20241101.pdf | pages=1, textLen=5221, signals=e_sign_vendor_markers_present, signature_labels_present |
| 16 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_5_Pre_Approval_Letter_RECEIVED_20241101.pdf | pages=1, textLen=2374, signals=e_sign_vendor_markers_present |
| 17 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_Gaona_Pre_Approval_Letter_RECEIVED_20241101.pdf | pages=1, textLen=2497, signals=e_sign_vendor_markers_present |
| 18 | 2026-04-04 | 2026-04-10 | addendum | OREF_022B_Sellers_Repair_Addendum_1_EXECUTED_20241101.pdf | pages=1, textLen=6445, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 19 | 2026-04-04 | 2026-04-10 | addendum | Offer_5_OREF_022A_Buyers_Repair_Addendum_1_EXECUTED_20241101.pdf | pages=1, textLen=5069, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, signature_labels_present |
| 20 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_4_EXECUTED_20241101.pdf | pages=1, textLen=5875, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 21 | 2026-04-04 | 2026-04-10 | addendum | OREF_022B_Sellers_Repair_Addendum_1_v2_EXECUTED_20241101.pdf | pages=1, textLen=6530, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, signature_labels_present |
| 22 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_104_Advisory_Regarding_Fair_Housing_Buyer_EXECUTED_20241101.pdf | pages=1, textLen=4594, signals=e_sign_vendor_markers_present, signature_labels_present |
| 23 | 2026-04-04 | 2026-04-10 | addendum | Offer_5_OREF_022A_Buyers_Repair_Addendum_2_EXECUTED_20241101.pdf | pages=1, textLen=4966, signals=alt_e_sign_vendor_possible, word_accepted_present, signature_labels_present |
| 24 | 2026-04-04 | 2026-04-10 | sale_agreement_or_rsa | Offer_5_OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20241101.pdf | pages=29, textLen=125162, signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 25 | 2026-04-04 | 2026-04-10 | other_pdf | Advisory_Regarding_Electronic_Funds_EXECUTED_20241101.pdf | _skipped_ |
| 26 | 2026-04-04 | 2026-04-10 | seller_property_disclosure | Offer_1_Seller_Property_Disclosure_Statement_EXECUTED_20241101.pdf | pages=7, textLen=406, signals=e_sign_vendor_markers_present, many_digisign_markers_high_execution_likelihood |
| 27 | 2026-04-04 | 2026-04-10 | other_pdf | MLSCO_Listing_Agreement_EXECUTED_20241101.pdf | _skipped_ |
| 28 | 2026-04-04 | 2026-04-10 | agency_disclosure_pamphlet | OREF_042_Oregon_Real_Estate_Agency_Disclosure_Pamphlet_EXECUTED_20241101.pdf | _skipped_ |
| 29 | 2026-04-04 | 2026-04-10 | other_pdf | OREF_040_Disclosed_Limited_Agency_Agreement_for_Seller_EXECUTED_20241101.pdf | _skipped_ |
| 30 | 2026-04-04 | 2026-04-10 | amendment_or_notice | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20241101.pdf | pages=1, textLen=2, signals= |
| 31 | 2026-04-04 | 2026-04-10 | other_pdf | MLSCO_MLS_Input_Form_EXECUTED_20241101.pdf | _skipped_ |
| 32 | 2026-04-04 | 2026-04-10 | other_pdf | MLSCO_Listing_Agreement_2_EXECUTED_20241101.pdf | _skipped_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 32 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 9 ("offer" family). **Counter-like**: 2 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 2.
- **Deep read coverage**: 25 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Expired**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 712 SW 1st St, Madras, OR 97741

- **Folder id (`saleGuid`)**: `f50fe2a6-226c-4f81-8a59-9fc9a46ea5df`
- **MLS**: 220179688
- **SkySlope status**: Expired
- **Linked listingGuid**: n/a
- **Sale price / list price**: 305000 / 0
- **Contract acceptance**: 2024-04-01
- **Escrow closing**: 2024-05-09
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-04-03

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | In Review | 2026-04-07 | OREF_003_Sellers_Counter_Offer_1_v2_EXECUTED_20240401.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Optional | n/a |  |
| 3 | Counter Offers  | Sales Documentation | In Review | 2026-04-07 | OREF_003_Sellers_Counter_Offer_1_EXECUTED_20240401.pdf |
| 4 | Sale Addendums  | Sales Documentation | In Review | 2026-04-07 | OREF_002_Addendum_to_Sale_Agreement_1_v2_EXECUTED_20240401.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | In Review | 2026-04-07 | Completed_Sellers_Repair_Addendum_RECEIVED_20240401.pdf |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Required | n/a |  |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | Optional | n/a |  |
| 11 | Contingency Removal Addendum  | Sales Documentation | In Review | 2026-04-07 | OREF_060_Receipt_of_Reports_Removal_of_Contingencies_EXECUTED_20240401.pdf |
| 12 | Agreement to Occupy  | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale  | Sales Documentation | Optional | n/a |  |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Optional | n/a |  |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | In Review | 2026-04-07 | OREF_110_Notice_from_Seller_to_Buyer_1_EXECUTED_20240401.pdf |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | In Review | 2026-04-07 | Sellers_Property_Disclosure_Statement_EXECUTED_20240401.pdf; Sellers_Property_Disclosure_Statement_v2_EXECUTED_20240401.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | In Review | 2026-04-07 | OREF_056_Lead_Based_Paint_Disclosure_Addendum_EXECUTED_20240401.pdf |
| 23 | Electronic Funds Advisory | Disclosures | In Review | 2026-04-07 | Advisory_Regarding_Electronic_Funds_EXECUTED_20240401.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | In Review | 2026-04-07 | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20240401.pdf |
| 25 | FIRPTA Advisory | Disclosures | Required | n/a |  |
| 26 | Real Estate Forms Advisory | Disclosures | Required | n/a |  |
| 27 | Smoke Alarms Advisory | Disclosures | Required | n/a |  |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | In Review | 2026-04-07 | Lead_Paint_Booklet_Protect_Your_Family_RECEIVED_20240401.pdf |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 35 | Earnest Money Receipt | Closing Documents | In Review | 2026-04-07 | Earnest_Money_Receipt_RECEIVED_20240401.pdf |
| 36 | Preliminary Title Report | Closing Documents | Required | n/a |  |
| 37 | Final HUD | Closing Documents | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | In Review | 2026-04-07 | Oregon_Real_Estate_Agency_Disclosure_Pamphlet_RECEIVED_20240401.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Required | n/a |  |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | In Review | 2026-04-07 | OREF_040_Disclosed_Limited_Agency_Agreement_Sellers_EXECUTED_20240401.pdf |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_002_Addendum_to_Sale_Agreement_1_EXECUTED_20240401.pdf | pages=1, textLen=5075, signals=e_sign_vendor_markers_present, signature_labels_present |
| 2 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_VA_FHA_Amendatory_Clause_EXECUTED_20240401.pdf | pages=1, textLen=5630, signals=e_sign_vendor_markers_present, signature_labels_present |
| 3 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_Advisory_Regarding_Smoke_and_Carbon_Monoxide_Alarms_EXECUTED_20240401.pdf | pages=1, textLen=4695, signals=e_sign_vendor_markers_present, signature_labels_present |
| 4 | 2026-04-04 | 2026-04-10 | sale_agreement_or_rsa | Offer_2_OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20240401.pdf | pages=14, textLen=78954, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 5 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_Woodstove_Wood_Burning_Fireplace_Addendum_EXECUTED_20240401.pdf | pages=1, textLen=6104, signals=e_sign_vendor_markers_present, signature_labels_present |
| 6 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_056_Lead_Based_Paint_Disclosure_Addendum_EXECUTED_20240401.pdf | pages=2, textLen=7214, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 7 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_Advisory_Regarding_FIRPTA_Tax_EXECUTED_20240401.pdf | pages=2, textLen=7834, signals=e_sign_vendor_markers_present, signature_labels_present |
| 8 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_Advisory_Regarding_Electronic_Funds_EXECUTED_20240401.pdf | pages=1, textLen=4519, signals=e_sign_vendor_markers_present, signature_labels_present |
| 9 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_v2_EXECUTED_20240401.pdf | pages=1, textLen=5944, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 10 | 2026-04-04 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20240401.pdf | pages=12, textLen=82003, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 11 | 2026-04-04 | 2026-04-10 | other_pdf | Advisory_Regarding_Electronic_Funds_v2_EXECUTED_20240401.pdf | _skipped_ |
| 12 | 2026-04-04 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_3_v2_EXECUTED_20240401.pdf | pages=1, textLen=2314, signals=e_sign_vendor_markers_present, signature_labels_present |
| 13 | 2026-04-04 | 2026-04-10 | other_pdf | Caldwell_Letter_for_1st_Street_2_RECEIVED_20240401.pdf | _skipped_ |
| 14 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | OREF_110_Notice_from_Seller_to_Buyer_1_EXECUTED_20240401.pdf | pages=2, textLen=10621, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 15 | 2026-04-04 | 2026-04-10 | addendum | Exterior_Siding_Stucco_EIFS_Disclosure_Addendum_EXECUTED_20240401.pdf | pages=1, textLen=6025, signals=e_sign_vendor_markers_present, signature_labels_present |
| 16 | 2026-04-04 | 2026-04-10 | earnest_or_wire | Earnest_Money_Receipt_RECEIVED_20240401.pdf | _skipped_ |
| 17 | 2026-04-04 | 2026-04-10 | other_pdf | OREF_060_Receipt_of_Reports_Removal_of_Contingencies_EXECUTED_20240401.pdf | _skipped_ |
| 18 | 2026-04-04 | 2026-04-10 | addendum | OREF_022A_Buyers_Repair_Addendum_1_EXECUTED_20240401.pdf | pages=1, textLen=4884, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 19 | 2026-04-04 | 2026-04-10 | other_pdf | Advisory_Regarding_Electronic_Funds_EXECUTED_20240401.pdf | _skipped_ |
| 20 | 2026-04-04 | 2026-04-10 | inspection_or_repair | Wood_Destroying_Insect_Inspection_Report_RECEIVED_20240401.pdf | _skipped_ |
| 21 | 2026-04-04 | 2026-04-10 | other_pdf | MLSCO_Listing_Contract_ODS_RECEIVED_20240401.pdf | pages=3, textLen=14869, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 22 | 2026-04-04 | 2026-04-10 | addendum | OREF_056_Lead_Based_Paint_Disclosure_Addendum_EXECUTED_20240401.pdf | pages=2, textLen=7266, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 23 | 2026-04-04 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_3_EXECUTED_20240401.pdf | pages=1, textLen=2314, signals=e_sign_vendor_markers_present, signature_labels_present |
| 24 | 2026-04-04 | 2026-04-10 | addendum | Completed_Addendum_RECEIVED_20240401.pdf | pages=1, textLen=1862, signals=e_sign_vendor_markers_present, signature_labels_present |
| 25 | 2026-04-04 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_v2_EXECUTED_20240401.pdf | pages=1, textLen=5472, signals=e_sign_vendor_markers_present, signature_labels_present |
| 26 | 2026-04-04 | 2026-04-10 | inspection_or_repair | Repair_Request_List_RECEIVED_20240401.pdf | _skipped_ |
| 27 | 2026-04-04 | 2026-04-10 | other_pdf | OREF_040_Disclosed_Limited_Agency_Agreement_Sellers_EXECUTED_20240401.pdf | _skipped_ |
| 28 | 2026-04-04 | 2026-04-10 | agency_disclosure_pamphlet | Oregon_Real_Estate_Agency_Disclosure_Pamphlet_RECEIVED_20240401.pdf | _skipped_ |
| 29 | 2026-04-04 | 2026-04-10 | other_pdf | Lead_Paint_Booklet_Protect_Your_Family_RECEIVED_20240401.pdf | _skipped_ |
| 30 | 2026-04-04 | 2026-04-10 | addendum | Completed_Sellers_Repair_Addendum_RECEIVED_20240401.pdf | pages=1, textLen=6371, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 31 | 2026-04-04 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_EXECUTED_20240401.pdf | pages=1, textLen=5339, signals=e_sign_vendor_markers_present, signature_labels_present |
| 32 | 2026-04-04 | 2026-04-10 | seller_property_disclosure | Sellers_Property_Disclosure_Statement_v2_EXECUTED_20240401.pdf | _skipped_ |
| 33 | 2026-04-04 | 2026-04-10 | addendum | Completed_Exterior_Siding_Addendum_RECEIVED_20240401.pdf | pages=1, textLen=6158, signals=e_sign_vendor_markers_present, signature_labels_present |
| 34 | 2026-04-04 | 2026-04-10 | amendment_or_notice | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20240401.pdf | pages=1, textLen=4567, signals=e_sign_vendor_markers_present, signature_labels_present |
| 35 | 2026-04-04 | 2026-04-10 | addendum | OREF_022B_Sellers_Repair_Addendum_1_EXECUTED_20240401.pdf | pages=1, textLen=6235, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 36 | 2026-04-04 | 2026-04-10 | other_pdf | ORE_Residential_Input_ODS_RECEIVED_20240401.pdf | _skipped_ |
| 37 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_EXECUTED_20240401.pdf | pages=1, textLen=6118, signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present |
| 38 | 2026-04-04 | 2026-04-10 | other_pdf | Caldwell_Letter_for_1st_Street_1_RECEIVED_20240401.pdf | _skipped_ |
| 39 | 2026-04-04 | 2026-04-10 | seller_property_disclosure | Sellers_Property_Disclosure_Statement_EXECUTED_20240401.pdf | _skipped_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 39 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 5 ("offer" family). **Counter-like**: 2 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 2.
- **Deep read coverage**: 25 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Expired**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 20702 Beaumont Drive, Bend, OR 97701

- **Folder id (`saleGuid`)**: `f9e68a69-5c3c-4613-a3cf-21e18ab399b5`
- **MLS**: 220199105
- **SkySlope status**: Pending
- **Linked listingGuid**: ae17cded-5593-40d2-84b9-2102422fca13
- **Sale price / list price**: 515000 / 0
- **Contract acceptance**: 2026-03-28
- **Escrow closing**: 2026-04-29
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-03-31

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | In Review | 2026-03-31 | Sale_Agreement.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | In Review | 2026-03-31 | Pre-approval_Letter.pdf |
| 3 | Counter Offers  | Sales Documentation | Optional | n/a |  |
| 4 | Sale Addendums  | Sales Documentation | Optional | n/a |  |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | Optional | n/a |  |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | In Review | 2026-04-09 | Owner Association Addendum.pdf |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | Optional | n/a |  |
| 11 | Contingency Removal Addendum  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy  | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale  | Sales Documentation | Optional | n/a |  |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | In Review | 2026-04-08 | Amendatory_Clause.pdf |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | Required | n/a |  |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | In Review | 2026-04-06 | Electronic_Funds_Advisory.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | In Review | 2026-04-06 | RE_Compensation_Advisory.pdf |
| 25 | FIRPTA Advisory | Disclosures | In Review | 2026-04-06 | Firpta_Advisory.pdf |
| 26 | Real Estate Forms Advisory | Disclosures | In Review | 2026-04-06 | Forms_Advisory.pdf |
| 27 | Smoke Alarms Advisory | Disclosures | In Review | 2026-04-06 | Alarm_Advisory.pdf |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 35 | Earnest Money Receipt | Closing Documents | In Review | 2026-04-01 | EM_Receipt.pdf |
| 36 | Preliminary Title Report | Closing Documents | In Review | 2026-04-01 | Preliminary_Title_Report.pdf |
| 37 | Final HUD | Closing Documents | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | In Review | 2026-04-08 | OREA_Pamphlet.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Optional | n/a |  |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **PDF text signals** when this document was selected for deep read.

| # | Upload | Modified | Inferred class | File name | Deep read |
|---:|---|---|---|---|---|
| 1 | 2026-03-18 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 2 | 2026-03-18 | n/a | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | pages=6, textLen=32072, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 3 | 2026-03-18 | n/a | counter_or_counteroffer | Sellers Counteroffer 1 - 003 OREF.pdf | pages=2, textLen=9296, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 4 | 2026-03-18 | n/a | lender_financing | approval letter.pdf | _skipped_ |
| 5 | 2026-03-18 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | pages=1, textLen=5791, signals=e_sign_vendor_markers_present, signature_labels_present |
| 6 | 2026-03-18 | n/a | buyer_offer_or_package | Beaumont Offer 1.pdf | pages=15, textLen=975, signals=e_sign_vendor_markers_present, many_digisign_markers_high_execution_likelihood |
| 7 | 2026-03-19 | n/a | counter_or_counteroffer | counter.pdf | pages=2, textLen=171, signals=e_sign_vendor_markers_present |
| 8 | 2026-03-19 | n/a | counter_or_counteroffer | Sellers Counteroffer 2 - 003 OREF.pdf | pages=2, textLen=9255, signals=e_sign_vendor_markers_present, word_accepted_present, signature_labels_present |
| 9 | 2026-03-28 | n/a | buyer_offer_or_package | offer _2_.pdf | pages=15, textLen=1065, signals=e_sign_vendor_markers_present, many_digisign_markers_high_execution_likelihood |
| 10 | 2026-03-28 | n/a | other_pdf | Treadway.pdf | _skipped_ |
| 11 | 2026-03-31 | n/a | other_pdf | Sale_Agreement.pdf | _skipped_ |
| 12 | 2026-03-31 | 2026-03-31 | other_pdf | Listing_Contract.pdf | pages=6, textLen=32072, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_high_execution_likelihood |
| 13 | 2026-03-31 | 2026-03-31 | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _skipped_ |
| 14 | 2026-03-31 | n/a | lender_financing | Pre-approval_Letter.pdf | _skipped_ |
| 15 | 2026-04-01 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _skipped_ |
| 16 | 2026-04-01 | n/a | other_pdf | EM_Receipt.pdf | _skipped_ |
| 17 | 2026-04-04 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _skipped_ |
| 18 | 2026-04-04 | n/a | other_pdf | Amendatory Clause.pdf | _skipped_ |
| 19 | 2026-04-04 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _skipped_ |
| 20 | 2026-04-04 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _skipped_ |
| 21 | 2026-04-04 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _skipped_ |
| 22 | 2026-04-04 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _skipped_ |
| 23 | 2026-04-04 | n/a | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - Seller - 080 OREF.pdf | _skipped_ |
| 24 | 2026-04-06 | n/a | other_pdf | Alarm_Advisory.pdf | _skipped_ |
| 25 | 2026-04-06 | n/a | other_pdf | Forms_Advisory.pdf | _skipped_ |
| 26 | 2026-04-06 | n/a | other_pdf | Firpta_Advisory.pdf | _skipped_ |
| 27 | 2026-04-06 | n/a | other_pdf | RE_Compensation_Advisory.pdf | _skipped_ |
| 28 | 2026-04-06 | n/a | other_pdf | Electronic_Funds_Advisory.pdf | _skipped_ |
| 29 | 2026-04-06 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _skipped_ |
| 30 | 2026-04-08 | n/a | seller_property_disclosure | Property Disclosures.pdf | _skipped_ |
| 31 | 2026-04-08 | 2026-04-08 | seller_property_disclosure | Property_Disclosures.pdf | _skipped_ |
| 32 | 2026-04-08 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _skipped_ |
| 33 | 2026-04-08 | n/a | other_pdf | Amendatory_Clause.pdf | _skipped_ |
| 34 | 2026-04-09 | n/a | addendum | Addendum- Insp Ext.pdf | pages=1, textLen=6112, signals=e_sign_vendor_markers_present, signature_labels_present |
| 35 | 2026-04-09 | n/a | other_pdf | Delivery of Assoc Docs.pdf | _skipped_ |
| 36 | 2026-04-09 | 2026-04-09 | addendum | Owner Association Addendum.pdf | pages=2, textLen=10378, signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |

### Narrative timeline (best-effort)

- **Forms inventory**: 36 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 2 ("offer" family). **Counter-like**: 3 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **Deep read coverage**: 10 PDFs in this folder were text-extracted (global cap 420).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Pending**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

## Appendix: deep-read selection stats

- **Queued PDFs**: 697
- **Deep read attempts**: 420
- **pdf-parse installed**: true