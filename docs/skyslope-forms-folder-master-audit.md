# SkySlope Forms file folders master audit

Generated (UTC): 2026-04-11T01:21:34.336Z

This report inventories **every listing file** and **every sale file** returned by the SkySlope **Listings/Sales** API in this account, including checklist activity scaffolding and the flat **Documents** library timeline.
For **Oregon regulatory** completeness (principal broker supervision, records, agency, trust-account themes), reviewers should use the **`oregon-orea-principal-broker`** Cursor skill (OREA + OAR 863 lens) alongside **`oregon-real-estate-oref`** for OREF form questions—not this script’s heuristics alone.

## Important limitations (read this once)

- **Product scope:** This report uses the **SkySlope Forms** transaction **Files** API on `api-latest.skyslope.com` (`GET /api/files/listings`, `GET /api/files/sales`, etc.), i.e. listing/sale **file cabinets** tied to brokerage forms. It does **not** pull from **SkySlope Suite** (a different SkySlope application). It is also **not** the OAuth **Forms Partnership** developer API at `forms.skyslope.com`.
- **"Folders"** here means **SkySlope file folders**: one row per **listingGuid** (listing file) and one row per **saleGuid** (sale file).
- **Archived files:** Rows are **dropped** when status/stage text matches archive heuristics (or `isArchived` / `archived` is true). Set `SKYSLOPE_INCLUDE_ARCHIVED=1` to include them. Note: `GET /api/files` (unified search) supports an `archived` **status** filter but, in practice, can **omit** active under-contract listings (e.g. **Transaction**); this script keeps using **`/api/files/listings`** and **`/api/files/sales`** so the inventory matches SkySlope Forms file folders.
- **Pagination (API contract):** Folder lists use `earliestDate` / `latestDate` (**Unix seconds**), `pageNumber` (1-based), and return **10 rows per page** per SkySlope swagger. Query params like `fromDate` / `page` / `pageSize` are not documented for these endpoints and will **under-fetch** (often stopping after the first page).
- **1837 documents** existed at generation time across **13** listing files + **34** sale files. Fully reading every page of every PDF is a batch job; this report uses **API metadata for 100% of documents** and the **dual PDF pipeline** (pdf.js text layer plus mandatory OCR in the same read window, up to **12** pages per file) for a **prioritized subset** (420 PDFs) focused on offers, counters, RSA/sale agreement language, and termination/release patterns.

### What “fully executed” means here (Ryan Realty standard)

A document is **fully executed** only when a **qualified human reviewer** (transaction coordinator, principal broker, or compliance) confirms **all** of the following for that specific instrument and property. **First classify the document**: listing agreements need **seller** (and firm/agent per form) signatures, not buyers; buyer agreements need **buyer** (and firm per form) signatures, not sellers; **mutual** instruments (RSA and many addenda/counters) need **both sides** signed where the form requires it—then judge completeness against **that** obligation pattern.

1. **Correct obligated parties** — The parties who **should** sign this document type are identified and match the deal, property, and (for mutual docs) the offer/counter context.
2. **Complete signing for that pattern** — Every required signature, initial, and date for **sellers only**, **buyers only**, or **both** (as the form requires) is present—not placeholders or wrong signers.
3. **OREF / Oregon / brokerage completeness** — Statutory and contractual requirements for this transaction are satisfied: required advisories, addenda referenced by the RSA, disclosures, and any brokerage-specific checklist items are present and the **correct OREF versions** are used where version matters.
4. **SkySlope file alignment** — Checklist activities and uploaded PDFs match what escrow and the brokerage expect for this stage.

**This script does not perform (1)–(4).** The **PDF dual pipeline clues** column reports **merged machine text plus OCR hints** (e.g. e-sign vendor strings). Those hints are **not** evidence of full execution and are **not** an OREF compliance audit.
- **PII is redacted** in excerpts (emails/phones). Do not commit live SkySlope session artifacts or presigned URLs.

## Proposed naming convention (do not rename yet)

Use a single sortable prefix and stable tokens so filenames group chronologically and humans can see the story at a glance:

1. **Prefix date**: `YYYY-MM-DD` from **uploadDate** (or **modifiedDate** if upload is missing).
2. **Lane**: `LIST` (listing file) or `SALE` (sale file).
3. **MLS** (if known) as `MLS-{number}` else `MLS-none`.
4. **Doc class** (machine token): examples `OREF-042`, `OREF-015`, `OREF-101`, `OFFER`, `CO-SLR-01`, `CO-BYR-01`, `ADD`, `AMD`, `SPD`, `LENDER`, `TITLE`, `EMD`, `MISC`. Derive OREF numbers from the filename when present.
5. **Round index** (offers only): `R01`, `R02`… increment whenever a new buyer offer package begins (heuristic: new "Offer" PDF with later date).
6. **Human review token** (suffix, optional): use `TC-PENDING`, `TC-OK`, or `UNKNOWN` **only** after a human applies the “fully executed” standard above. **Do not** derive `TC-OK` from e-sign marker counts.
7. **Original stem preserved** at the end for traceability: `__orig-{sanitized}`.

**Example (illustrative):** `2026-03-17__LIST__MLS-220199105__OREF-015__LISTING-AGREEMENT__TC-OK__orig-Listing-Agreement-Exclusive-015-OREF.pdf` (TC-OK only if a reviewer signed off).

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
| 11 | listing | 1050 NE Butler Market Rd #2, Bend, OR 97701 | 220196853 | Transaction | 27 |
| 12 | listing | 2354 NW NW Drouillard Ave, Bend, OR 97703 | 220200647 | Transaction | 74 |
| 13 | listing | 17130 Mayfield Drive, Bend, OR 97707 | 220205364 | Transaction | 42 |
| 14 | sale | 15352 Bear St, La Pine, OR 97739 | 220189471 | Closed | 42 |
| 15 | sale | 218 SW SW 4th St, Redmond, OR 97756 | 220199880 | Canceled/App | 20 |
| 16 | sale | 61271 Kwinnum Drive, Bend, OR 97702 | 220194779 | Expired | 47 |
| 17 | sale | 2732 NW Ordway Avenue, Bend, OR 97703 | 220201089 | Expired | 24 |
| 18 | sale | 534 Crowson Rd, Ashland, OR 97520 | 220201983 | Expired | 32 |
| 19 | sale | 54474 Huntington Road, Bend, OR 97707 | 220185942 | Closed | 91 |
| 20 | sale | 29500 SE Ochoco Way, Prineville, OR 97754 | 220142414 | Expired | 49 |
| 21 | sale | 2129 SW 35th Street, Redmond, OR 97756 | 220203591 | Expired | 32 |
| 22 | sale | 712 SW 1st St, Madras, OR 97741 | 220179688 | Expired | 39 |
| 23 | sale | 20702 Beaumont Drive, Bend, OR 97701 | 220199105 | Pending | 36 |
| 24 | sale | 56111 School House Rd, Bend, OR 97707 |  | Pending | 63 |
| 25 | sale | 19571 SW Simpson Ave, Bend, OR 97702 |  | Closed | 43 |
| 26 | sale | 19571 SW Simpson Ave, Bend, OR 97702 | 220202576 | Pre-Contract | 24 |
| 27 | sale | 19571 SW Simpson Ave, Bend, OR 97702 |  | Canceled/App | 24 |
| 28 | sale | 17130 Mayfield Drive, Bend, OR 97707 | 220205364 | Closed | 42 |
| 29 | sale | 20473 Jacklight Lane, Bend, OR 97702 | 220198987 | Closed | 43 |
| 30 | sale | 2354 NW NW Drouillard Ave, Bend, OR 97703 | 220200647 | Closed | 74 |
| 31 | sale | 2680 NW Nordic Avenue, Bend, OR 97703 | 220184043 | Closed | 104 |
| 32 | sale | 64350 Old Bend Redmond Hwy, Bend, OR 97703 | 220205567 | Closed | 129 |
| 33 | sale | 64350 Old Bend Redmond Hwy, Bend, OR 97703 | 220205567 | Canceled/App | 64 |
| 34 | sale | 820 NW 12th Street, Bend, OR 97703 | 220205649 | Canceled/App | 12 |
| 35 | sale | 820 NW 12th Street, Bend, OR 97703 | 220205649 | Canceled/App | 8 |
| 36 | sale | 122 SW 10th Street, Redmond, OR 97756 | 220197389 | Canceled/App | 7 |
| 37 | sale | 703 SW 7th Street, Redmond, OR 97756 | 220202806 | Closed | 59 |
| 38 | sale | 820 NW 12th Street, Bend, OR 97703 | 220205649 | Canceled/App | 8 |
| 39 | sale | 218 SW 4th St, Redmond, OR 97756 | 220199880 | Canceled/App | 20 |
| 40 | sale | 1974 NW NW Newport Hills, Bend, OR 97703 | 220194969 | Closed | 37 |
| 41 | sale | 2680 NW Nordic Avenue, Bend, OR 97703 | 220184043 | Canceled/App | 40 |
| 42 | sale | 2680 NW Nordic Avenue, Bend, OR 97703 |  | Canceled/App | 24 |
| 43 | sale | 3480 SW 45th Street, Redmond, OR 97756 | 220200502 | Closed | 31 |
| 44 | sale |  , ,  |  | Canceled/App | 4 |
| 45 | sale | 1050 NE Butler Market Rd #2, Bend, OR 97701 | 220196853 | Closed | 27 |
| 46 | sale | 3235 NW Cedar Ave, Redmond, OR 97756 | 827967 | Closed | 64 |
| 47 | sale | 20401 Penhollow Ln, Bend, OR 97702 | 220203839 | Closed | 36 |

## Executive summaries (one paragraph per folder)

These paragraphs are **machine-assisted** from SkySlope API fields + filename heuristics + (where available) **dual pipeline PDF clues** (not full execution review). They are an **orientation map** only; OREF completeness and signatory correctness require a **human expert**.

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
- **listing** (1050 NE Butler Market Rd #2, Bend, OR 97701, MLS **220196853**, SkySlope status **Transaction**): **27** documents from **2025-07-03** (Exclusive Listing Agreement - ODS.pdf, inferred **listing_agreement**) through **2025-07-05** (Offer_1050_NE_Butler_Market__2.pdf, inferred **buyer_offer_or_package**). Heuristic counts in this folder: offer-like **4**, counter-like **3**, addendum-like **1**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **2**. Listing status is **Transaction**, which in SkySlope typically means the listing has moved into the **purchase / escrow workflow** (not merely "active on MLS").
- **listing** (2354 NW NW Drouillard Ave, Bend, OR 97703, MLS **220200647**, SkySlope status **Transaction**): **74** documents from **2025-07-03** (9_2 Disclosed Limited Agency Agreement - OR.pdf, inferred **other_pdf**) through **2025-10-14** (Final_Seller_s_Statement.pdf, inferred **closing_adjacent**). Heuristic counts in this folder: offer-like **0**, counter-like **6**, addendum-like **24**, termination/release-like **0**, RSA/sale-agreement-like **3**, listing-agreement-like **1**. Listing status is **Transaction**, which in SkySlope typically means the listing has moved into the **purchase / escrow workflow** (not merely "active on MLS").
- **listing** (17130 Mayfield Drive, Bend, OR 97707, MLS **220205364**, SkySlope status **Transaction**): **42** documents from **2025-07-03** (Addendum to Sale Agreement 1 - 002 OREF.pdf, inferred **addendum**) through **2025-10-29** (Final_Sellers_Statement_IHLA.pdf, inferred **closing_adjacent**). Heuristic counts in this folder: offer-like **1**, counter-like **6**, addendum-like **13**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **1**. Listing status is **Transaction**, which in SkySlope typically means the listing has moved into the **purchase / escrow workflow** (not merely "active on MLS").
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
- **sale** (56111 School House Rd, Bend, OR 97707, MLS **n/a**, SkySlope status **Pending**): **63** documents from **2026-03-27** (Disclosed Limited Agency Agreement for Buyers - 041 OREF.pdf, inferred **buyer_offer_or_package**) through **2026-04-09** (Buyers Repair Addendum - 022A _1_ OREF.pdf, inferred **addendum**). Heuristic counts in this folder: offer-like **7**, counter-like **0**, addendum-like **16**, termination/release-like **0**, RSA/sale-agreement-like **1**, listing-agreement-like **2**. SkySlope **status** suggests **pending / in escrow**; agreement may be ratified even without a populated closing date field.
- **sale** (19571 SW Simpson Ave, Bend, OR 97702, MLS **n/a**, SkySlope status **Closed**): **43** documents from **2026-02-07** (Initial Agency Disclosure Pamphlet - 042 OREF.pdf, inferred **agency_disclosure_pamphlet**) through **2026-03-16** (ALTA_Settlement_Buyer.pdf, inferred **buyer_offer_or_package**). Heuristic counts in this folder: offer-like **10**, counter-like **0**, addendum-like **9**, termination/release-like **0**, RSA/sale-agreement-like **1**, listing-agreement-like **1**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition.
- **sale** (19571 SW Simpson Ave, Bend, OR 97702, MLS **220202576**, SkySlope status **Pre-Contract**): **24** documents from **2026-02-03** (OREF_000A_Things_to_Know_Before_Signing_EXECUTED_20260203.pdf, inferred **closing_adjacent**) through **2026-03-13** (Notice_Completion_of_Repairs_RECEIVED_20260313.pdf, inferred **inspection_or_repair**). Heuristic counts in this folder: offer-like **9**, counter-like **0**, addendum-like **4**, termination/release-like **0**, RSA/sale-agreement-like **1**, listing-agreement-like **0**. **No strong closing signal** from acceptance/closing fields; rely on checklist + document review.
- **sale** (19571 SW Simpson Ave, Bend, OR 97702, MLS **n/a**, SkySlope status **Canceled/App**): **24** documents from **2026-02-03** (Things to Know Before Signing - 000A OREF.pdf, inferred **closing_adjacent**) through **2026-03-13** (Notice- Completion of Repairs.pdf, inferred **inspection_or_repair**). Heuristic counts in this folder: offer-like **10**, counter-like **0**, addendum-like **4**, termination/release-like **0**, RSA/sale-agreement-like **1**, listing-agreement-like **0**. **No strong closing signal** from acceptance/closing fields; rely on checklist + document review.
- **sale** (17130 Mayfield Drive, Bend, OR 97707, MLS **220205364**, SkySlope status **Closed**): **42** documents from **2025-07-03** (Addendum to Sale Agreement 1 - 002 OREF.pdf, inferred **addendum**) through **2025-10-29** (Final_Sellers_Statement_IHLA.pdf, inferred **closing_adjacent**). Heuristic counts in this folder: offer-like **1**, counter-like **6**, addendum-like **13**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **1**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition. Linked **listingGuid** `212a55e0-c450-41ce-97b9-b3162db6a554` (scroll to the listing file section with the same guid to see pre-contract paperwork).
- **sale** (20473 Jacklight Lane, Bend, OR 97702, MLS **220198987**, SkySlope status **Closed**): **43** documents from **2025-07-05** (Initial Agency Disclosure Pamphlet - 042 OREF.pdf, inferred **agency_disclosure_pamphlet**) through **2025-10-17** (Final_Sellers_Statement_IHLA.pdf, inferred **closing_adjacent**). Heuristic counts in this folder: offer-like **0**, counter-like **9**, addendum-like **9**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **1**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition. Linked **listingGuid** `c9503d17-c569-42b3-841e-9651e13dec70` (scroll to the listing file section with the same guid to see pre-contract paperwork).
- **sale** (2354 NW NW Drouillard Ave, Bend, OR 97703, MLS **220200647**, SkySlope status **Closed**): **74** documents from **2025-07-03** (9_2 Disclosed Limited Agency Agreement - OR.pdf, inferred **other_pdf**) through **2025-10-14** (Final_Seller_s_Statement.pdf, inferred **closing_adjacent**). Heuristic counts in this folder: offer-like **0**, counter-like **6**, addendum-like **24**, termination/release-like **0**, RSA/sale-agreement-like **3**, listing-agreement-like **1**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition. Linked **listingGuid** `dbf8e511-fc61-4caa-b5ea-e9ba9c7c8ff7` (scroll to the listing file section with the same guid to see pre-contract paperwork).
- **sale** (2680 NW Nordic Avenue, Bend, OR 97703, MLS **220184043**, SkySlope status **Closed**): **104** documents from **2025-09-05** (Addendum to Sale Agreement 4 - 002 OREF.pdf, inferred **addendum**) through **2025-10-10** (ALTA_Settlement_Buyer.pdf, inferred **buyer_offer_or_package**). Heuristic counts in this folder: offer-like **16**, counter-like **13**, addendum-like **29**, termination/release-like **2**, RSA/sale-agreement-like **4**, listing-agreement-like **2**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition.
- **sale** (64350 Old Bend Redmond Hwy, Bend, OR 97703, MLS **220205567**, SkySlope status **Closed**): **129** documents from **2010-06-08** (2025_Admin, inferred **other**) through **2025-09-25** (Final_Sellers_Statement_IHLA.pdf, inferred **closing_adjacent**). Heuristic counts in this folder: offer-like **5**, counter-like **6**, addendum-like **35**, termination/release-like **2**, RSA/sale-agreement-like **2**, listing-agreement-like **1**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition. Linked **listingGuid** `a28589fc-3915-4a92-86e6-c08355147398` (scroll to the listing file section with the same guid to see pre-contract paperwork).
- **sale** (64350 Old Bend Redmond Hwy, Bend, OR 97703, MLS **220205567**, SkySlope status **Canceled/App**): **64** documents from **2025-07-09** (Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf, inferred **other_pdf**) through **2025-08-27** (Sellers Counter Offer 1 - 003 OREF_2.pdf, inferred **counter_or_counteroffer**). Heuristic counts in this folder: offer-like **4**, counter-like **2**, addendum-like **13**, termination/release-like **2**, RSA/sale-agreement-like **2**, listing-agreement-like **1**. **Contract acceptance date** is populated; that usually means a **ratified** agreement at some point (still confirm current stage in SkySlope UI). Linked **listingGuid** `a28589fc-3915-4a92-86e6-c08355147398` (scroll to the listing file section with the same guid to see pre-contract paperwork).
- **sale** (820 NW 12th Street, Bend, OR 97703, MLS **220205649**, SkySlope status **Canceled/App**): **12** documents from **2025-08-05** (1_1 Oregon Residential Real Estate Purchase And Sale Agreement - OR.pdf, inferred **sale_agreement_or_rsa**) through **2025-08-05** (Sale_Addendum_1__Change_in_purchase_price_795__2025-08-04_11_31_37__1___1__2.pdf, inferred **addendum**). Heuristic counts in this folder: offer-like **1**, counter-like **0**, addendum-like **2**, termination/release-like **0**, RSA/sale-agreement-like **2**, listing-agreement-like **0**. **Contract acceptance date** is populated; that usually means a **ratified** agreement at some point (still confirm current stage in SkySlope UI).
- **sale** (820 NW 12th Street, Bend, OR 97703, MLS **220205649**, SkySlope status **Canceled/App**): **8** documents from **2025-08-05** (firpta 820.pdf, inferred **other_pdf**) through **2025-08-05** (1_1 Oregon Residential Real Estate Purchase And Sale Agreement - OR_2.pdf, inferred **sale_agreement_or_rsa**). Heuristic counts in this folder: offer-like **1**, counter-like **0**, addendum-like **0**, termination/release-like **0**, RSA/sale-agreement-like **2**, listing-agreement-like **0**. **No strong closing signal** from acceptance/closing fields; rely on checklist + document review.
- **sale** (122 SW 10th Street, Redmond, OR 97756, MLS **220197389**, SkySlope status **Canceled/App**): **7** documents from **2025-08-05** (Residential Real Estate Sale Agreement - 001 OREF.pdf, inferred **sale_agreement_or_rsa**) through **2025-08-05** (10th_Street_Sellers_Counteroffer___1_25__10__2.pdf, inferred **counter_or_counteroffer**). Heuristic counts in this folder: offer-like **0**, counter-like **2**, addendum-like **0**, termination/release-like **0**, RSA/sale-agreement-like **3**, listing-agreement-like **0**. **Contract acceptance date** is populated; that usually means a **ratified** agreement at some point (still confirm current stage in SkySlope UI).
- **sale** (703 SW 7th Street, Redmond, OR 97756, MLS **220202806**, SkySlope status **Closed**): **59** documents from **2025-08-05** (Residential Real Estate Sale Agreement - 001 OREF.pdf, inferred **sale_agreement_or_rsa**) through **2026-04-07** (Advisory Regarding Real Estate Compensation - Buyer - 047 OREF.pdf, inferred **buyer_offer_or_package**). Heuristic counts in this folder: offer-like **6**, counter-like **5**, addendum-like **14**, termination/release-like **0**, RSA/sale-agreement-like **9**, listing-agreement-like **0**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition.
- **sale** (820 NW 12th Street, Bend, OR 97703, MLS **220205649**, SkySlope status **Canceled/App**): **8** documents from **2025-08-05** (firpta 820.pdf, inferred **other_pdf**) through **2025-08-05** (820 SPDs.pdf, inferred **seller_property_disclosure**). Heuristic counts in this folder: offer-like **1**, counter-like **0**, addendum-like **0**, termination/release-like **0**, RSA/sale-agreement-like **2**, listing-agreement-like **0**. **No strong closing signal** from acceptance/closing fields; rely on checklist + document review.
- **sale** (218 SW 4th St, Redmond, OR 97756, MLS **220199880**, SkySlope status **Canceled/App**): **20** documents from **2025-07-08** (Sellers Property Disclosures.pdf, inferred **seller_property_disclosure**) through **2025-07-08** (218 Southwest 4th Street - Proposal.pdf, inferred **other_pdf**). Heuristic counts in this folder: offer-like **0**, counter-like **1**, addendum-like **5**, termination/release-like **2**, RSA/sale-agreement-like **1**, listing-agreement-like **0**. **Contract acceptance date** is populated; that usually means a **ratified** agreement at some point (still confirm current stage in SkySlope UI).
- **sale** (1974 NW NW Newport Hills, Bend, OR 97703, MLS **220194969**, SkySlope status **Closed**): **37** documents from **2025-07-07** (Initial Agency Disclosure Pamphlet - 042 OREF.pdf, inferred **agency_disclosure_pamphlet**) through **2025-08-14** (FIRPTA_-_Statement_of_Qualified_Substitute_458.pdf, inferred **other_pdf**). Heuristic counts in this folder: offer-like **1**, counter-like **4**, addendum-like **9**, termination/release-like **0**, RSA/sale-agreement-like **1**, listing-agreement-like **1**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition. Linked **listingGuid** `a97b0c78-d3e8-4100-a777-3e28cdf6a030` (scroll to the listing file section with the same guid to see pre-contract paperwork).
- **sale** (2680 NW Nordic Avenue, Bend, OR 97703, MLS **220184043**, SkySlope status **Canceled/App**): **40** documents from **2025-07-06** (Buyer Representation Agreement - Exclusive - 050 OREF.pdf, inferred **listing_agreement**) through **2025-07-16** (Termination_2025-07-15_16_57_05__1_.pdf, inferred **termination_or_release**). Heuristic counts in this folder: offer-like **4**, counter-like **8**, addendum-like **13**, termination/release-like **2**, RSA/sale-agreement-like **3**, listing-agreement-like **2**. **Contract acceptance date** is populated; that usually means a **ratified** agreement at some point (still confirm current stage in SkySlope UI).
- **sale** (2680 NW Nordic Avenue, Bend, OR 97703, MLS **n/a**, SkySlope status **Canceled/App**): **24** documents from **2025-07-06** (Initial Agency Disclosure Pamphlet - 042 OREF.pdf, inferred **agency_disclosure_pamphlet**) through **2025-07-06** (Buyers Counter Offer 1 - 004 OREF.pdf, inferred **counter_or_counteroffer**). Heuristic counts in this folder: offer-like **4**, counter-like **5**, addendum-like **10**, termination/release-like **0**, RSA/sale-agreement-like **1**, listing-agreement-like **2**. **No strong closing signal** from acceptance/closing fields; rely on checklist + document review.
- **sale** (3480 SW 45th Street, Redmond, OR 97756, MLS **220200502**, SkySlope status **Closed**): **31** documents from **2025-07-06** (Residential Real Estate Sale Agreement - 001 OREF.pdf, inferred **sale_agreement_or_rsa**) through **2025-08-15** (Agreement to Occupy After Closing - 054 OREF.pdf, inferred **other_pdf**). Heuristic counts in this folder: offer-like **4**, counter-like **3**, addendum-like **2**, termination/release-like **0**, RSA/sale-agreement-like **3**, listing-agreement-like **1**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition.
- **sale** ( , , , MLS **n/a**, SkySlope status **Canceled/App**): **4** documents from **2025-07-05** (Initial Agency Disclosure Pamphlet - 042 OREF.pdf, inferred **agency_disclosure_pamphlet**) through **2025-07-05** (Initial Agency Disclosure Pamphlet - 042 OREF_2.pdf, inferred **agency_disclosure_pamphlet**). Heuristic counts in this folder: offer-like **0**, counter-like **0**, addendum-like **0**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **2**. **No strong closing signal** from acceptance/closing fields; rely on checklist + document review.
- **sale** (1050 NE Butler Market Rd #2, Bend, OR 97701, MLS **220196853**, SkySlope status **Closed**): **27** documents from **2025-07-03** (Exclusive Listing Agreement - ODS.pdf, inferred **listing_agreement**) through **2025-07-05** (Offer_1050_NE_Butler_Market__2.pdf, inferred **buyer_offer_or_package**). Heuristic counts in this folder: offer-like **4**, counter-like **3**, addendum-like **1**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **2**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition. Linked **listingGuid** `8195a9a9-73cd-4d90-938e-05cdbc6639a8` (scroll to the listing file section with the same guid to see pre-contract paperwork).
- **sale** (3235 NW Cedar Ave, Redmond, OR 97756, MLS **827967**, SkySlope status **Closed**): **64** documents from **2025-07-05** (Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Buyer - 108 OREF.pdf, inferred **buyer_offer_or_package**) through **2025-07-18** (FIRPTA_-_Statement_of_Qualified_Substitute_722.pdf, inferred **other_pdf**). Heuristic counts in this folder: offer-like **8**, counter-like **4**, addendum-like **13**, termination/release-like **0**, RSA/sale-agreement-like **5**, listing-agreement-like **1**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition.
- **sale** (20401 Penhollow Ln, Bend, OR 97702, MLS **220203839**, SkySlope status **Closed**): **36** documents from **2025-07-05** (Initial Agency Disclosure Pamphlet - 042 OREF.pdf, inferred **agency_disclosure_pamphlet**) through **2025-07-10** (Penhollow Closing Date Addendum.pdf, inferred **addendum**). Heuristic counts in this folder: offer-like **1**, counter-like **0**, addendum-like **2**, termination/release-like **0**, RSA/sale-agreement-like **0**, listing-agreement-like **2**. API includes an **actual closing date**; treat as a **closed** path unless your office uses a different definition. Linked **listingGuid** `28343c3a-c683-4b62-bbe4-34180b404db7` (scroll to the listing file section with the same guid to see pre-contract paperwork).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-04-03 | 2026-04-10 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-04-03 | 2026-04-10 | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 2 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 0 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-03-18 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-03-18 | n/a | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2026-03-18 | n/a | counter_or_counteroffer | Sellers Counteroffer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 4 | 2026-03-18 | n/a | lender_financing | approval letter.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-03-18 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | error: not_pdf_bytes |
| 6 | 2026-03-18 | n/a | buyer_offer_or_package | Beaumont Offer 1.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-03-19 | n/a | counter_or_counteroffer | counter.pdf | error: not_pdf_bytes |
| 8 | 2026-03-19 | n/a | counter_or_counteroffer | Sellers Counteroffer 2 - 003 OREF.pdf | error: not_pdf_bytes |
| 9 | 2026-03-28 | n/a | buyer_offer_or_package | offer _2_.pdf | _not in prioritized subset for this run_ |
| 10 | 2026-03-28 | n/a | other_pdf | Treadway.pdf | _not in prioritized subset for this run_ |
| 11 | 2026-03-31 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 12 | 2026-03-31 | 2026-03-31 | other_pdf | Listing_Contract.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-03-31 | 2026-03-31 | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 14 | 2026-03-31 | n/a | lender_financing | Pre-approval_Letter.pdf | _not in prioritized subset for this run_ |
| 15 | 2026-04-01 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 16 | 2026-04-01 | n/a | other_pdf | EM_Receipt.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-04-04 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-04-04 | n/a | other_pdf | Amendatory Clause.pdf | _not in prioritized subset for this run_ |
| 19 | 2026-04-04 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-04-04 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 21 | 2026-04-04 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 22 | 2026-04-04 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-04-04 | n/a | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - Seller - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-04-06 | n/a | other_pdf | Alarm_Advisory.pdf | _not in prioritized subset for this run_ |
| 25 | 2026-04-06 | n/a | other_pdf | Forms_Advisory.pdf | _not in prioritized subset for this run_ |
| 26 | 2026-04-06 | n/a | other_pdf | Firpta_Advisory.pdf | _not in prioritized subset for this run_ |
| 27 | 2026-04-06 | n/a | other_pdf | RE_Compensation_Advisory.pdf | _not in prioritized subset for this run_ |
| 28 | 2026-04-06 | n/a | other_pdf | Electronic_Funds_Advisory.pdf | _not in prioritized subset for this run_ |
| 29 | 2026-04-06 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 30 | 2026-04-08 | n/a | seller_property_disclosure | Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 31 | 2026-04-08 | 2026-04-08 | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 32 | 2026-04-08 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 33 | 2026-04-08 | n/a | other_pdf | Amendatory_Clause.pdf | _not in prioritized subset for this run_ |
| 34 | 2026-04-09 | n/a | addendum | Addendum- Insp Ext.pdf | _not in prioritized subset for this run_ |
| 35 | 2026-04-09 | n/a | other_pdf | Delivery of Assoc Docs.pdf | _not in prioritized subset for this run_ |
| 36 | 2026-04-09 | 2026-04-09 | addendum | Owner Association Addendum.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 36 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 2 ("offer" family). **Counter-like**: 3 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 4 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-15 | n/a | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-15 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-22 | 2025-07-22 | listing_agreement | Listing Agreement - Exclusive - 015 OREF_2.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-22 | 2025-07-22 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF_2.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 4 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 0 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2010-06-08 | 2015-02-18 | other | 2025_Admin | _not in prioritized subset for this run_ |
| 2 | 2010-06-08 | n/a | other | 2025_Trash | _not in prioritized subset for this run_ |
| 3 | 2025-07-09 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-09 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Fair Housing - Seller - 104 OREF.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-07-09 | n/a | title_or_hoa | Advisory Regarding Title Insurance - Seller - 103 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-09 | n/a | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - Seller - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-09 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-07-09 | n/a | other_pdf | 1d9f4bf5ae604e458b7a4718342463c3_960.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-07-14 | n/a | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-07-15 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-08-05 | n/a | buyer_offer_or_package | Buyer_Signed_offer_on_OBRH.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-08-05 | n/a | buyer_offer_or_package | Buyer_Signed_offer_on_OBRH_2.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-08-05 | n/a | lender_financing | Offer_1_PreApproval.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-08-05 | n/a | buyer_offer_or_package | Offer_1_Final_Agency_Acknowledgement.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-08-05 | n/a | buyer_offer_or_package | Offer_1_Residential_Real_Estate_Agreement.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-08-05 | n/a | addendum | Offer_1_Well_Addendum.pdf | error: not_pdf_bytes |
| 21 | 2025-08-05 | n/a | buyer_offer_or_package | Offer_1_On_Site_Sewage.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-08-05 | n/a | earnest_or_wire | Offer_1_Wire_Fraud.pdf | _not in prioritized subset for this run_ |
| 23 | 2025-08-06 | n/a | addendum | Addendum- Terms.pdf | error: not_pdf_bytes |
| 24 | 2025-08-06 | n/a | addendum | Well Addendum.pdf | error: not_pdf_bytes |
| 25 | 2025-08-06 | n/a | other_pdf | Proof of Funds.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-08-06 | n/a | addendum | Septic Addendum.pdf | error: not_pdf_bytes |
| 27 | 2025-08-06 | n/a | sale_agreement_or_rsa | Sale Agreement.pdf | pages=15, read=12, textLen=136863, 15 pg · read 12 · rich · Digi×24 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 28 | 2025-08-06 | n/a | closing_adjacent | Letter to boardwalk house.pdf | _not in prioritized subset for this run_ |
| 29 | 2025-08-06 | 2025-08-06 | other_pdf | Listing_Contract.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-08-06 | 2025-08-06 | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-08-06 | 2025-08-06 | other_pdf | Data_Pages.pdf | _not in prioritized subset for this run_ |
| 32 | 2025-08-06 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 33 | 2025-08-06 | n/a | other_pdf | Proof_of_Funds.pdf | _not in prioritized subset for this run_ |
| 34 | 2025-08-06 | n/a | addendum | Addendum-_AP.pdf | error: not_pdf_bytes |
| 35 | 2025-08-06 | n/a | other_pdf | Advisory-_Electronic_Funds.pdf | _not in prioritized subset for this run_ |
| 36 | 2025-08-06 | n/a | other_pdf | Advisory-_RE_Compensation.pdf | _not in prioritized subset for this run_ |
| 37 | 2025-08-06 | n/a | other_pdf | Advisory-_Firpta.pdf | _not in prioritized subset for this run_ |
| 38 | 2025-08-06 | n/a | other_pdf | Advisory-_Forms.pdf | _not in prioritized subset for this run_ |
| 39 | 2025-08-06 | n/a | other_pdf | Advisory-_Alarms.pdf | _not in prioritized subset for this run_ |
| 40 | 2025-08-06 | n/a | addendum | Well_Addendum.pdf | error: not_pdf_bytes |
| 41 | 2025-08-06 | n/a | addendum | Septic_Addendum.pdf | error: not_pdf_bytes |
| 42 | 2025-08-06 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 43 | 2025-08-06 | n/a | addendum | Septic_Addendum.pdf | error: not_pdf_bytes |
| 44 | 2025-08-06 | n/a | addendum | Well_Addendum.pdf | error: not_pdf_bytes |
| 45 | 2025-08-06 | n/a | other | img_156940d0-9c45-4517-b182-1e155c31281c_395.png | _not in prioritized subset for this run_ |
| 46 | 2025-08-06 | n/a | other | img_102795a3-efb8-44e4-a58f-653c1bff4fec_120.png | _not in prioritized subset for this run_ |
| 47 | 2025-08-06 | n/a | other | img_2e65b90d-af86-463a-852b-97a1f645fa04_217.png | _not in prioritized subset for this run_ |
| 48 | 2025-08-06 | n/a | other | img_736cb534-786b-4a09-af3a-641369977d65_489.png | _not in prioritized subset for this run_ |
| 49 | 2025-08-06 | n/a | other | img_212beb6b-a937-46c1-95f2-6ad7e6030612_586.png | _not in prioritized subset for this run_ |
| 50 | 2025-08-06 | n/a | other | img_6ed6b692-2ea7-433a-bbd7-8e42a52f2965_361.png | _not in prioritized subset for this run_ |
| 51 | 2025-08-07 | n/a | addendum | Sellers Property Disclosure Statement Addendum _1_ - 028 OREF.pdf | error: not_pdf_bytes |
| 52 | 2025-08-07 | n/a | seller_property_disclosure | Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 53 | 2025-08-07 | 2025-08-07 | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 54 | 2025-08-07 | 2025-08-07 | addendum | Property_Disclosure_Addendum.pdf | error: not_pdf_bytes |
| 55 | 2025-08-07 | n/a | other_pdf | did-you-see-that-comment.pdf | _not in prioritized subset for this run_ |
| 56 | 2025-08-07 | n/a | other_pdf | did-you-see-that-comment_2.pdf | _not in prioritized subset for this run_ |
| 57 | 2025-08-11 | n/a | other_pdf | EM_Receipt.pdf | _not in prioritized subset for this run_ |
| 58 | 2025-08-13 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 59 | 2025-08-13 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 60 | 2025-08-13 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 61 | 2025-08-16 | 2025-08-24 | termination_or_release | Termination Agreement.pdf | pages=1, read=1, textLen=6047, 1 pg · rich · Digi×2 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 62 | 2025-08-16 | n/a | termination_or_release | Addendum- Termination.pdf | pages=1, read=1, textLen=5652, 1 pg · rich · Digi×2 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 63 | 2025-08-27 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF _5_.pdf | _not in prioritized subset for this run_ |
| 64 | 2025-08-27 | n/a | addendum | Private_Well_Addendum_to_Real_Estate_Sale_Agreement_-_082_OREF _1_.pdf | error: not_pdf_bytes |
| 65 | 2025-08-27 | n/a | addendum | Septic_Onsite_Sewage_System_Addendum_-_081_OREF _1_.pdf | error: not_pdf_bytes |
| 66 | 2025-08-27 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 67 | 2025-08-27 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF_2.pdf | error: not_pdf_bytes |
| 68 | 2025-08-29 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 69 | 2025-08-29 | n/a | lender_financing | Pre-approval_Letter.pdf | _not in prioritized subset for this run_ |
| 70 | 2025-08-29 | n/a | other_pdf | did-you-see-that-comment.pdf | _not in prioritized subset for this run_ |
| 71 | 2025-08-29 | n/a | other_pdf | did-you-see-that-comment_2.pdf | _not in prioritized subset for this run_ |
| 72 | 2025-08-29 | n/a | addendum | Well_Addendum.pdf | error: not_pdf_bytes |
| 73 | 2025-08-29 | n/a | addendum | Septic_Addendum.pdf | error: not_pdf_bytes |
| 74 | 2025-08-29 | n/a | counter_or_counteroffer | Counter-_Seller_s.pdf | error: not_pdf_bytes |
| 75 | 2025-08-29 | n/a | counter_or_counteroffer | Counter-_Seller_s_2.pdf | error: not_pdf_bytes |
| 76 | 2025-08-29 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 77 | 2025-08-29 | n/a | other_pdf | Advisory-_Alarms.pdf | _not in prioritized subset for this run_ |
| 78 | 2025-08-29 | n/a | other_pdf | Advisory-_Electronic_Funds.pdf | _not in prioritized subset for this run_ |
| 79 | 2025-08-29 | n/a | other_pdf | Advisory-_Firpta.pdf | _not in prioritized subset for this run_ |
| 80 | 2025-08-29 | n/a | other_pdf | Advisory-_Forms.pdf | _not in prioritized subset for this run_ |
| 81 | 2025-08-29 | n/a | other_pdf | Advisory-_RE_Compensation.pdf | _not in prioritized subset for this run_ |
| 82 | 2025-09-02 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 83 | 2025-09-02 | n/a | addendum | Property_Disclosure_Addendum.pdf | error: not_pdf_bytes |
| 84 | 2025-09-02 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 85 | 2025-09-08 | n/a | addendum | Buyers_Repair_Addendum_-_022A__1__OREF _16_.pdf | error: not_pdf_bytes |
| 86 | 2025-09-08 | n/a | addendum | Sellers Repair Addendum - 022B _1_ OREF.pdf | error: not_pdf_bytes |
| 87 | 2025-09-08 | n/a | other_pdf | EM.pdf | _not in prioritized subset for this run_ |
| 88 | 2025-09-09 | n/a | addendum | Addendum 1- Price.pdf | error: not_pdf_bytes |
| 89 | 2025-09-09 | n/a | addendum | Repair Addendum- Buyer_s 2.pdf | error: not_pdf_bytes |
| 90 | 2025-09-09 | n/a | addendum | Addendum_1-_Price.pdf | error: not_pdf_bytes |
| 91 | 2025-09-09 | n/a | addendum | Repair_Addendum-_Buyer_s_1.pdf | error: not_pdf_bytes |
| 92 | 2025-09-09 | n/a | addendum | Repair_Addendum-_Seller_s.pdf | error: not_pdf_bytes |
| 93 | 2025-09-09 | n/a | addendum | Repair_Addendum-_Buyer_s_2.pdf | error: not_pdf_bytes |
| 94 | 2025-09-19 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 95 | 2025-09-19 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF_2.pdf | _not in prioritized subset for this run_ |
| 96 | 2025-09-25 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF_3.pdf | _not in prioritized subset for this run_ |
| 97 | 2025-09-25 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 98 | 2025-09-25 | n/a | closing_adjacent | Final_Sellers_Statement_IHLA.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 98 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 5 ("offer" family). **Counter-like**: 4 (includes OREF counter forms when matched). **Termination/release-like**: 2. **RSA / sale agreement-like**: 2.
- **PDF dual pipeline coverage**: 31 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-07 | 2025-07-08 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-07 | 2025-07-08 | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-07 | n/a | counter_or_counteroffer | Buyers_Counter_Offer_1_-_004_OREF _2_.pdf | error: not_pdf_bytes |
| 4 | 2025-07-07 | 2025-07-15 | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-07 | n/a | counter_or_counteroffer | Sellers Counter Offer 2 - 003 OREF.pdf | error: not_pdf_bytes |
| 6 | 2025-07-07 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 7 | 2025-07-07 | n/a | other_pdf | Delivery of Association Documents 1 - 023 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-07 | 2025-07-15 | other_pdf | Disclosed Limited Agency Agreement for Sellers - 040 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-07 | 2025-07-08 | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF _2_.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-07 | 2025-07-15 | other_pdf | Advisory Regarding FIRPTA Tax - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-07-07 | 2025-07-08 | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-07-07 | 2025-07-08 | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-07-07 | 2025-07-08 | listing_agreement | Exclusive Listing Agreement - ODS.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-07-07 | 2025-07-08 | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-07-07 | n/a | seller_property_disclosure | Seller_s Property Disclosure Statement _Non-exempt SPDS_.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-07-07 | 2025-07-15 | addendum | Owner_Association_Addendum_-_024_OREF.pdf | error: not_pdf_bytes |
| 17 | 2025-07-07 | n/a | buyer_offer_or_package | Advisory to Buyers and Sellers Regarding Fair Housing - Seller - 104 OREF.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-07-07 | n/a | addendum | Sellers Property Disclosure Statement Addendum - 028 OREF.pdf | error: not_pdf_bytes |
| 19 | 2025-07-07 | 2025-07-08 | lender_financing | Preapproval for Andrews.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-07-07 | 2025-07-08 | other_pdf | Advisory Regarding Electronic Funds - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 21 | 2025-07-07 | 2025-07-08 | counter_or_counteroffer | Sellers_Counter_Offer_2_-_003_OREF__1__482.pdf | error: not_pdf_bytes |
| 22 | 2025-07-08 | n/a | addendum | Buyers_Repair_Addendum_-_022A__1__OREF_276.pdf | error: not_pdf_bytes |
| 23 | 2025-07-08 | 2025-07-15 | title_or_hoa | HOA_Document_Delvirables_2025-07-01_15_48_08_430.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-07-08 | 2025-07-08 | seller_property_disclosure | SPD_s_135.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-07-08 | 2025-07-10 | addendum | Buyers_Repair_Addendum_1.pdf | error: not_pdf_bytes |
| 26 | 2025-07-08 | n/a | addendum | Sellers Repair Addendum - 022B _1_ OREF.pdf | error: not_pdf_bytes |
| 27 | 2025-07-08 | 2025-07-08 | other_pdf | EM_777.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-07-09 | n/a | addendum | Buyers_Repair_Addendum_-_022A__2__OREF_625.pdf | error: not_pdf_bytes |
| 29 | 2025-07-09 | 2025-07-10 | addendum | Sellers_Repair_Addendum_1.pdf | error: not_pdf_bytes |
| 30 | 2025-07-09 | n/a | other_pdf | First_American_HW_528.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-07-10 | 2025-07-10 | addendum | Buyers_Repair_Addendum_-_022A__2__OREF.pdf | error: not_pdf_bytes |
| 32 | 2025-07-15 | 2025-07-15 | title_or_hoa | PRELIMINARY_REPORT-LINKED-titleLOOK_409.pdf | _not in prioritized subset for this run_ |
| 33 | 2025-07-15 | 2025-08-14 | title_or_hoa | HOA_Document_Delvirables_2025-07-01_15_48_08_679.pdf | _not in prioritized subset for this run_ |
| 34 | 2025-07-22 | 2025-08-14 | other_pdf | Receipt_2546_174.pdf | _not in prioritized subset for this run_ |
| 35 | 2025-08-01 | n/a | addendum | Contingency Removal Addendum 1 - 060 OREF.pdf | error: not_pdf_bytes |
| 36 | 2025-08-14 | 2025-08-14 | closing_adjacent | Final_Sellers_Statement_IHLA_361.pdf | _not in prioritized subset for this run_ |
| 37 | 2025-08-14 | 2025-08-14 | other_pdf | FIRPTA_-_Statement_of_Qualified_Substitute_458.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 37 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 4 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 1.
- **PDF dual pipeline coverage**: 13 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-06 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-06 | 2025-07-06 | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-06 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-06 | n/a | other_pdf | Advisory Regarding Fair Housing - Seller - 104 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-06 | n/a | title_or_hoa | Advisory Regarding Title Insurance - Seller - 103 OREF.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-07-06 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-07-06 | 2025-07-06 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-06 | n/a | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-09-02 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 9 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 0 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-05 | n/a | buyer_offer_or_package | 20401 Penhollow Purchase Agreement.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-05 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-05 | 2025-07-05 | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-07-05 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-05 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-05 | n/a | other_pdf | Delivery of Association Documents 1 - 023 OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-05 | n/a | lender_financing | Morse-Pre-Approval Letter.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-07-05 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-07-05 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-07-05 | 2025-07-05 | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-07-05 | n/a | other_pdf | 20401 Penhollow Owners Association.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-07-05 | 2025-07-05 | inspection_or_repair | Penhollow Inspection Approval.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-07-05 | n/a | other_pdf | Advisory_and_Instructions_Regarding_Real_Estate_Purchase_and_Sale_Forms_-_Seller_-_108_OREF.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial_Agency_Disclosure_Pamphlet_-_042_OREF.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Penhollow_SPD.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-07-05 | 2025-07-08 | lender_financing | Morse-Pre-Approval_Letter.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-07-05 | 2025-07-05 | other_pdf | 20401_Penhollow_Purchase_Agreement.pdf | _not in prioritized subset for this run_ |
| 21 | 2025-07-05 | n/a | title_or_hoa | PRELIMINARY_REPORT-LINKED-titleLOOK.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-07-05 | 2025-07-05 | other_pdf | 20401_Penhollow_Owners_Association.pdf | _not in prioritized subset for this run_ |
| 23 | 2025-07-05 | 2025-07-05 | amendment_or_notice | Notice_of_Real_Estate_Compensation_-_091_OREF.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-07-05 | n/a | listing_agreement | Listing_Agreement_-_Exclusive_-_015_OREF.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory_Regarding_Real_Estate_Compensation_-_Seller_-_047_OREF.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory_Regarding_FIRPTA_Tax_-_Seller_-_092_OREF.pdf | _not in prioritized subset for this run_ |
| 27 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory_Regarding_Electronic_Funds_-_Seller_-_043_OREF.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-07-05 | 2025-07-05 | earnest_or_wire | Earnest_Money.pdf | _not in prioritized subset for this run_ |
| 29 | 2025-07-05 | n/a | other_pdf | MLS_Input_Form_2025-06-17_11_44_33.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-07-05 | n/a | other_pdf | Change_Form_for_Status__Date__Price_and_Other_Miscellaneous_Changes_-_ODS.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-07-05 | n/a | title_or_hoa | Penhollow_HOA_Docs.zip | _not in prioritized subset for this run_ |
| 32 | 2025-07-05 | n/a | title_or_hoa | Penhollow_HOA_Docs.zip | _not in prioritized subset for this run_ |
| 33 | 2025-07-05 | 2025-07-05 | title_or_hoa | PRELIMINARY_REPORT-LINKED_802.pdf | _not in prioritized subset for this run_ |
| 34 | 2025-07-08 | 2025-07-08 | title_or_hoa | Penhollow_Delivery_of_HOA_Docs_646.pdf | _not in prioritized subset for this run_ |
| 35 | 2025-07-10 | n/a | addendum | Penhollow_Closing_Date_Addendum_866.pdf | error: not_pdf_bytes |
| 36 | 2025-07-10 | 2025-07-10 | addendum | Penhollow Closing Date Addendum.pdf | error: not_pdf_bytes |

### Narrative timeline (best-effort)

- **Forms inventory**: 36 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 2 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-05 | n/a | addendum | Wood Stove and Wood Burning Fireplace Insert Addendum - 046 OREF.pdf | error: not_pdf_bytes |
| 2 | 2025-07-05 | 2025-07-05 | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-05 | 2025-07-05 | listing_agreement | Exclusive Listing Agreement - ODS.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-05 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-07-05 | n/a | seller_property_disclosure | Exterior Siding - Stucco - EIFS Disclosure - 025 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-07-05 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-05 | n/a | buyer_offer_or_package | Advisory Regarding FIRPTA Tax - Buyer - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-10-04 | n/a | counter_or_counteroffer | Sellers Counter0ffer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 11 | 2025-10-04 | n/a | lender_financing | Offer1-Borg Pre-Approval Letter 56628 Sunstone Loop 10-1-25.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-10-04 | n/a | addendum | Offer1-2_Addendum_to_Sale_Agreement_-_125_ts02404.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-10-04 | n/a | earnest_or_wire | Offer1-Wire_Fraud_Advisory_-_218_ts03966.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-10-04 | n/a | sale_agreement_or_rsa | Offer1-Residential_Real_Estate_Sale_Agreement_-_125_ts00841.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-10-04 | n/a | addendum | Offer1-Owner_Association_Addendum_-_325_ts02404.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-10-04 | n/a | addendum | Offer1-Addendum_to_Sale_Agreement_-_125_ts02404.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-12-14 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-12-16 | n/a | other_pdf | Residential Real Estate Agreement 147.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-12-16 | n/a | counter_or_counteroffer | Sellers Counteroffer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 20 | 2025-12-16 | n/a | addendum | Addendum to Sale Agreement 2 - 002 OREF.pdf | error: not_pdf_bytes |
| 21 | 2025-12-16 | n/a | addendum | Owners Association Addendum 147.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-12-16 | n/a | addendum | Addendum A.pdf | _not in prioritized subset for this run_ |
| 23 | 2025-12-16 | n/a | lender_financing | FreemanPreapproval.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-12-17 | n/a | counter_or_counteroffer | Buyer Signed Buyer Counter.pdf | error: not_pdf_bytes |
| 25 | 2025-12-17 | n/a | counter_or_counteroffer | Fully Signed Seller Counter.pdf | error: not_pdf_bytes |
| 26 | 2025-12-17 | n/a | addendum | Fully Signed Addendum B.pdf | _not in prioritized subset for this run_ |
| 27 | 2025-12-17 | n/a | counter_or_counteroffer | Sellers Counteroffer 2 - 003 OREF.pdf | error: not_pdf_bytes |
| 28 | 2025-12-17 | n/a | counter_or_counteroffer | Buyer Signed Buyer Counter_2.pdf | error: not_pdf_bytes |
| 29 | 2026-03-26 | n/a | addendum | Sellers Property Disclosure Statement Addendum _1_ - 028 OREF.pdf | _not in prioritized subset for this run_ |
| 30 | 2026-03-26 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF_2.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 30 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 6 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 1.
- **PDF dual pipeline coverage**: 8 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-05 | 2025-07-05 | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-05 | 2025-07-05 | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-05 | 2025-07-05 | listing_agreement | Exclusive Listing Agreement - ODS.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-09-03 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_2.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-09-13 | n/a | counter_or_counteroffer | 2_1 Counteroffer to Real Estate Purchase and Sale Agreement _1_ - OR.pdf | error: not_pdf_bytes |
| 8 | 2025-09-13 | n/a | earnest_or_wire | 2_DigiSign_10_5_Wire_Fraud_Advisory_-_OR.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-09-13 | n/a | other_pdf | 3_DigiSign_2_19_FHA___VA_Amendatory_Clause_-_OR.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-09-13 | n/a | other_pdf | 1_DigiSign_1_1_Oregon_Residential_Real_Estate_Purchase_And_Sale_Agreement_-_OR.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-09-13 | n/a | addendum | 4_DigiSign_4_4_Association_Addendum_-_OR.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-09-14 | n/a | counter_or_counteroffer | 2_1 Counteroffer to Real Estate Purchase and Sale Agreement _1_ - OR_2.pdf | error: not_pdf_bytes |
| 13 | 2025-09-14 | n/a | counter_or_counteroffer | counter 2.pdf | error: not_pdf_bytes |
| 14 | 2025-09-14 | n/a | counter_or_counteroffer | signed counters.pdf | error: not_pdf_bytes |
| 15 | 2025-09-15 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Buyer_s_3.pdf | error: not_pdf_bytes |
| 17 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Seller_s_1.pdf | error: not_pdf_bytes |
| 18 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Seller_s_2.pdf | error: not_pdf_bytes |
| 19 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Seller_s_2_2.pdf | error: not_pdf_bytes |
| 20 | 2025-09-15 | n/a | addendum | Association_Addendum.pdf | _not in prioritized subset for this run_ |
| 21 | 2025-09-15 | n/a | earnest_or_wire | Wire_Fraud_Advsisory.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Buyer_s_2.pdf | error: not_pdf_bytes |
| 23 | 2025-09-15 | n/a | other_pdf | Amendatory_Clause.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-09-15 | n/a | lender_financing | Pre-approval_Letter.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-09-17 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | error: not_pdf_bytes |
| 26 | 2025-09-23 | n/a | other_pdf | Amendatory Clause.pdf | _not in prioritized subset for this run_ |
| 27 | 2025-09-23 | n/a | other_pdf | Amendatory Clause_2.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-09-25 | n/a | inspection_or_repair | Brandon Hargous Repairs_2025-09-24 12_24_55.pdf | _not in prioritized subset for this run_ |
| 29 | 2025-09-25 | n/a | other_pdf | EM_Receipt.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-09-25 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-09-25 | n/a | addendum | Rejected_Repair_Addendum.pdf | _not in prioritized subset for this run_ |
| 32 | 2025-09-25 | n/a | other_pdf | Amendatory_Clause.pdf | _not in prioritized subset for this run_ |
| 33 | 2025-10-01 | n/a | other_pdf | New bill of sale.pdf | _not in prioritized subset for this run_ |
| 34 | 2025-10-01 | n/a | other_pdf | Bill_of_Sale.pdf | _not in prioritized subset for this run_ |
| 35 | 2025-10-06 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 36 | 2025-10-06 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 37 | 2025-10-07 | n/a | addendum | Addendum-_Close_10-10.pdf | _not in prioritized subset for this run_ |
| 38 | 2025-10-07 | n/a | addendum | Addendum- Close 10-10.pdf | _not in prioritized subset for this run_ |
| 39 | 2025-10-07 | n/a | addendum | Addendum-_Close_10-10.pdf | _not in prioritized subset for this run_ |
| 40 | 2025-10-07 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 41 | 2025-10-11 | n/a | addendum | Addendum - Closing Date.pdf | _not in prioritized subset for this run_ |
| 42 | 2025-10-15 | n/a | addendum | Addendum-_Closing_10-21.pdf | _not in prioritized subset for this run_ |
| 43 | 2025-10-17 | n/a | closing_adjacent | Final_Sellers_Statement_IHLA.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 43 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 9 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 10 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|

### Narrative timeline (best-effort)

- **Forms inventory**: 0 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 0 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Listing file: 1050 NE Butler Market Rd #2, Bend, OR 97701

- **Folder id (`listingGuid`)**: `8195a9a9-73cd-4d90-938e-05cdbc6639a8`
- **MLS**: 220196853
- **SkySlope status**: Transaction
- **Listing price (SkySlope)**: 335000
- **Expiration**: 2025-08-31
- **Checklist type**: Listing 
- **Created on**: 2025-07-03

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure (042 | 10.4) | Listing Documentation | In Review | 2025-07-03 | Initial Agency Disclosure Pamphlet - 042 OREF.pdf |
| 2 | Listing Agreement and SA (015 | 9.3) | Listing Documentation | In Review | 2025-07-03 | Exclusive Listing Agreement - ODS.pdf |
| 3 | MLS Residential Input Form (ODS) | Listing Documentation | In Review | 2025-07-03 | ORE Residential Input - ODS.pdf |
| 4 | Sellers Property Disclosures | Listing Documentation | Optional | n/a |  |
| 5 | Disclosed Limited Agency | Listing Documentation | Optional | n/a |  |
| 6 | Listing Change Forms | Listing Documentation | Optional | n/a |  |
| 7 | Sellers Estimated Net Sheet  | Listing Documentation | Optional | n/a |  |
| 8 | CMA or Comparables  | Listing Documentation | Optional | n/a |  |
| 9 | Cancellation Listing/Expired MLS Page  | Listing Documentation | Optional | n/a |  |
| 10 | Association & CCRs Documents | Listing Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-03 | 2025-07-03 | listing_agreement | Exclusive Listing Agreement - ODS.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-03 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 3 | 2025-07-03 | 2025-07-03 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-03 | n/a | addendum | Addendum_to_Sale_Agreement_1_-_002_OREF _2_.pdf | error: not_pdf_bytes |
| 5 | 2025-07-03 | 2025-07-05 | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-07-03 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-07-03 | 2025-07-03 | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-03 | n/a | buyer_offer_or_package | Advisory Regarding FIRPTA Tax - Buyer - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-03 | 2025-07-03 | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-03 | 2025-07-05 | buyer_offer_or_package | Offer 1050 NE Butler Market _2.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-07-05 | n/a | agency_disclosure_pamphlet | Initial_Agency_Disclosure_Pamphlet_-_042_OREF.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-07-05 | 2025-07-05 | counter_or_counteroffer | Addendum_to_extend_counter_expiration_2025-06-10_05_36_21.pdf | error: not_pdf_bytes |
| 13 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial_Agency_Disclosure_Pamphlet_-_042_OREF_2.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-07-05 | 2025-07-05 | amendment_or_notice | Notice_of_Real_Estate_Compensation_-_091_OREF__4_.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-07-05 | n/a | other | Timeline_for_Butler_Market__2.eml | _not in prioritized subset for this run_ |
| 16 | 2025-07-05 | 2025-07-05 | other_pdf | FIRPTA-Qualified_Substitute_Statement.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-07-05 | n/a | seller_property_disclosure | 1_Sellers_Property_Disclosure_Statement_-_020_OREF.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-07-05 | n/a | title_or_hoa | _OR__Preliminary_Title_Report_-N.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-07-05 | n/a | counter_or_counteroffer | Sellers_Counter_Offer_1_-_003_OREF.pdf | error: not_pdf_bytes |
| 20 | 2025-07-05 | n/a | buyer_offer_or_package | Advisory_Regarding_FIRPTA_Tax_-_Buyer_-_092_OREF.pdf | _not in prioritized subset for this run_ |
| 21 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory_Regarding_Electronic_Funds_-_Seller_-_043_OREF.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-07-05 | n/a | seller_property_disclosure | Sellers_Property_Disclosures_2025-06-09_Butler_Market__2.pdf | _not in prioritized subset for this run_ |
| 23 | 2025-07-05 | n/a | other_pdf | ALTA_Settlement_Seller.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-07-05 | n/a | other_pdf | Residential_Input_Form_2025-06-10_05_43_37.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Sellers_Property_Disclosures_2025-06-09_Butler_Market__2_2.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-07-05 | n/a | listing_agreement | Exclusive_Listing_Agreement_-_ODS.pdf | _not in prioritized subset for this run_ |
| 27 | 2025-07-05 | n/a | buyer_offer_or_package | Offer_1050_NE_Butler_Market__2.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 27 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 4 ("offer" family). **Counter-like**: 3 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 4 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Transaction**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Listing file: 2354 NW NW Drouillard Ave, Bend, OR 97703

- **Folder id (`listingGuid`)**: `dbf8e511-fc61-4caa-b5ea-e9ba9c7c8ff7`
- **MLS**: 220200647
- **SkySlope status**: Transaction
- **Listing price (SkySlope)**: 1750000
- **Expiration**: 2025-09-30
- **Checklist type**: Listing 
- **Created on**: 2025-07-03

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure (042 | 10.4) | Listing Documentation | Completed | 2025-07-08 | 10_4 Initial Agency Disclosure Pamphlet _Seller_ - OR.pdf |
| 2 | Listing Agreement and SA (015 | 9.3) | Listing Documentation | Completed | 2025-07-08 | 9_3 Exclusive Listing Agreement - OR.pdf |
| 3 | MLS Residential Input Form (ODS) | Listing Documentation | Completed | 2025-07-08 | ORE Residential Input - ODS.pdf |
| 4 | Sellers Property Disclosures | Listing Documentation | Completed | 2025-07-31 | 3_1 Seller Property Disclosure Statement - OR.pdf |
| 5 | Disclosed Limited Agency | Listing Documentation | Optional | n/a |  |
| 6 | Listing Change Forms | Listing Documentation | Completed | 2025-07-31 | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_2.pdf; Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf |
| 7 | Sellers Estimated Net Sheet  | Listing Documentation | Optional | n/a |  |
| 8 | CMA or Comparables  | Listing Documentation | Optional | n/a |  |
| 9 | Cancellation Listing/Expired MLS Page  | Listing Documentation | Optional | n/a |  |
| 10 | Association & CCRs Documents | Listing Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-03 | n/a | other_pdf | 9_2 Disclosed Limited Agency Agreement - OR.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-03 | n/a | counter_or_counteroffer | seller counter 2 Drouillard.pdf | error: not_pdf_bytes |
| 3 | 2025-07-03 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 4 | 2025-07-03 | n/a | counter_or_counteroffer | Sellers Counter Offer 3 - 003 OREF.pdf | error: not_pdf_bytes |
| 5 | 2025-07-03 | n/a | counter_or_counteroffer | Sellers Counter Offer 2 - 003 OREF.pdf | error: not_pdf_bytes |
| 6 | 2025-07-03 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 1_25.pdf | pages=15, read=12, textLen=133409, 15 pg · read 12 · rich · Digi×12 Docu×24 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 7 | 2025-07-03 | 2025-07-08 | agency_disclosure_pamphlet | 10_4 Initial Agency Disclosure Pamphlet _Seller_ - OR.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-03 | n/a | other_pdf | membership-change-form-10_22_24.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-03 | 2025-07-08 | listing_agreement | 9_3 Exclusive Listing Agreement - OR.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-03 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF_2.pdf | error: not_pdf_bytes |
| 11 | 2025-07-03 | 2025-07-31 | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-07-03 | n/a | counter_or_counteroffer | Buyers Counteroffer.pdf | error: not_pdf_bytes |
| 13 | 2025-07-03 | 2025-07-08 | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-07-03 | n/a | other_pdf | Vitzthum-2354_NW_Drouillard_Ave_pdf copy.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-07-10 | 2025-07-31 | seller_property_disclosure | 3_1 Seller Property Disclosure Statement - OR.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-07-31 | 2025-07-31 | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_2.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-08-22 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_3.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-08-27 | n/a | earnest_or_wire | MLSCO_Wire_Fraud_Advisory_-_ODS.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-08-27 | n/a | lender_financing | Preapproval  for 1_7.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-08-27 | n/a | addendum | Addendum_to_Sale_Agreement_1_-_002_OREF.pdf | error: not_pdf_bytes |
| 21 | 2025-08-27 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-08-27 | n/a | addendum | Drouillard_Addendum_to_Sale_Agreement_1_-_002_OREF_936.pdf | error: not_pdf_bytes |
| 23 | 2025-08-27 | n/a | earnest_or_wire | MLSCO_Wire_Fraud_Advisory_-_ODS_231.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-08-27 | n/a | lender_financing | Preapproval__for_1_7_504.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-08-27 | n/a | sale_agreement_or_rsa | Drouillard_Residential_Real_Estate_Sale_Agreement_-_001_OREF_952.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-08-29 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_4.pdf | _not in prioritized subset for this run_ |
| 27 | 2025-08-29 | n/a | seller_property_disclosure | Drouillard Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-08-29 | n/a | addendum | 9_9 Addendum for Agent Documents - OR.pdf | error: not_pdf_bytes |
| 29 | 2025-09-05 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-09-05 | n/a | lender_financing | Pre-approval_Letter.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-09-05 | n/a | addendum | Addendum_A-_SF.pdf | error: not_pdf_bytes |
| 32 | 2025-09-05 | n/a | addendum | Addendum to Sale Agreement 2 - 002 OREF.pdf | error: not_pdf_bytes |
| 33 | 2025-09-05 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | error: not_pdf_bytes |
| 34 | 2025-09-05 | n/a | addendum | Sellers Repair Addendum - 022B _1_ OREF.pdf | error: not_pdf_bytes |
| 35 | 2025-09-06 | n/a | agency_disclosure_pamphlet | Initial_Agency_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 36 | 2025-09-06 | n/a | earnest_or_wire | Wire_Fraud_Advisory.pdf | _not in prioritized subset for this run_ |
| 37 | 2025-09-06 | n/a | other_pdf | did-you-see-that-comment.pdf | _not in prioritized subset for this run_ |
| 38 | 2025-09-06 | n/a | other_pdf | did-you-see-that-comment_2.pdf | _not in prioritized subset for this run_ |
| 39 | 2025-09-06 | n/a | other_pdf | Advisory_Real_Estate_Comp.pdf | _not in prioritized subset for this run_ |
| 40 | 2025-09-08 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 41 | 2025-09-08 | n/a | other_pdf | EM_Reciept.pdf | _not in prioritized subset for this run_ |
| 42 | 2025-09-08 | n/a | addendum | Buyers_Repair_Addendum_-_022A__1__OREF.pdf | error: not_pdf_bytes |
| 43 | 2025-09-09 | n/a | addendum | Addendum- Credit.pdf | error: not_pdf_bytes |
| 44 | 2025-09-09 | n/a | addendum | Repair Addendum- Buyer_s.pdf | error: not_pdf_bytes |
| 45 | 2025-09-09 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF_2025-09-09 09_13_16.pdf | error: not_pdf_bytes |
| 46 | 2025-09-09 | n/a | addendum | Addendum to Sale Agreement 3 - 002 OREF_2025-09-09 09_12_33.pdf | error: not_pdf_bytes |
| 47 | 2025-09-09 | n/a | addendum | Sellers Repair Addendum - 022B _1_ OREF_2.pdf | _not in prioritized subset for this run_ |
| 48 | 2025-09-10 | n/a | addendum | Addendum- Credit_2.pdf | _not in prioritized subset for this run_ |
| 49 | 2025-09-12 | n/a | addendum | Addendum-_Credit.pdf | _not in prioritized subset for this run_ |
| 50 | 2025-09-12 | n/a | addendum | Addendum_B-_Bidet.pdf | _not in prioritized subset for this run_ |
| 51 | 2025-09-12 | n/a | addendum | Repair_Addendum-_Buyer_s.pdf | _not in prioritized subset for this run_ |
| 52 | 2025-09-12 | n/a | addendum | Repair_Addendum-_Seller_s.pdf | _not in prioritized subset for this run_ |
| 53 | 2025-09-15 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 54 | 2025-09-15 | n/a | addendum | Addendum-_SPD.pdf | _not in prioritized subset for this run_ |
| 55 | 2025-09-19 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 56 | 2025-09-19 | n/a | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - Seller - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 57 | 2025-09-19 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 58 | 2025-09-19 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 59 | 2025-09-19 | n/a | other_pdf | Alarm_Advisory.pdf | _not in prioritized subset for this run_ |
| 60 | 2025-09-19 | n/a | other_pdf | Compensation_Advisory.pdf | _not in prioritized subset for this run_ |
| 61 | 2025-09-19 | n/a | other_pdf | FIRPTA_Advisory.pdf | _not in prioritized subset for this run_ |
| 62 | 2025-09-19 | n/a | other_pdf | Forms_Advisory.pdf | _not in prioritized subset for this run_ |
| 63 | 2025-09-30 | n/a | addendum | Addendum to Sale Agreement 5 - 002 OREF.pdf | error: not_pdf_bytes |
| 64 | 2025-10-02 | n/a | addendum | Addendum to Sale Agreement 4 - 002 OREF.pdf | error: not_pdf_bytes |
| 65 | 2025-10-02 | n/a | addendum | Addendum to Sale Agreement 6 - 002 OREF.pdf | error: not_pdf_bytes |
| 66 | 2025-10-03 | n/a | addendum | Addendum-_Personal_Property.pdf | _not in prioritized subset for this run_ |
| 67 | 2025-10-03 | n/a | addendum | Addendum-_Voided_Credit.pdf | _not in prioritized subset for this run_ |
| 68 | 2025-10-03 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 69 | 2025-10-03 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 70 | 2025-10-03 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF_2.pdf | _not in prioritized subset for this run_ |
| 71 | 2025-10-06 | n/a | other_pdf | Plumbing_Service_Report.pdf | _not in prioritized subset for this run_ |
| 72 | 2025-10-06 | n/a | other_pdf | Plumbing_Service_Report_196.pdf | _not in prioritized subset for this run_ |
| 73 | 2025-10-07 | n/a | other_pdf | Broker_Demand-_Revised.pdf | _not in prioritized subset for this run_ |
| 74 | 2025-10-14 | n/a | closing_adjacent | Final_Seller_s_Statement.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 74 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 6 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 3.
- **PDF dual pipeline coverage**: 22 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Transaction**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Listing file: 17130 Mayfield Drive, Bend, OR 97707

- **Folder id (`listingGuid`)**: `212a55e0-c450-41ce-97b9-b3162db6a554`
- **MLS**: 220205364
- **SkySlope status**: Transaction
- **Listing price (SkySlope)**: 839000
- **Expiration**: 2025-12-31
- **Checklist type**: Listing 
- **Created on**: 2025-07-03

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure (042 | 10.4) | Listing Documentation | Completed | 2025-07-05 | Initial Agency Disclosure Pamphlet - 042 OREF.pdf |
| 2 | Listing Agreement and SA (015 | 9.3) | Listing Documentation | Completed | 2025-07-05 | Listing Agreement - Exclusive - 015 OREF.pdf |
| 3 | MLS Residential Input Form (ODS) | Listing Documentation | Completed | 2025-07-14 | ORE Residential Input - ODS.pdf |
| 4 | Sellers Property Disclosures | Listing Documentation | Completed | 2025-07-05 | Hedberg_Disclosures_17130Mayfield_803.pdf |
| 5 | Disclosed Limited Agency | Listing Documentation | Optional | n/a |  |
| 6 | Listing Change Forms | Listing Documentation | Completed | 2025-07-14 | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf |
| 7 | Sellers Estimated Net Sheet  | Listing Documentation | Optional | n/a |  |
| 8 | CMA or Comparables  | Listing Documentation | Optional | n/a |  |
| 9 | Cancellation Listing/Expired MLS Page  | Listing Documentation | Optional | n/a |  |
| 10 | Association & CCRs Documents | Listing Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-03 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | pages=1, read=1, textLen=5628, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 2 | 2025-07-03 | 2025-07-05 | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-03 | 2025-07-05 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-03 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-03 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-07-03 | n/a | other_pdf | Advisory Regarding Fair Housing - Seller - 104 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-07-03 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-03 | n/a | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - Seller - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Hedberg_Disclosures_17130Mayfield_803.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-14 | 2025-07-14 | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-07-14 | 2025-07-14 | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-08-01 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_2.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-09-21 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF_2.pdf | error: not_pdf_bytes |
| 14 | 2025-09-21 | n/a | counter_or_counteroffer | Sellers Counter0ffer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 15 | 2025-09-21 | n/a | buyer_offer_or_package | Offer.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-09-22 | n/a | counter_or_counteroffer | Sellers Counteroffer 2 - 003 OREF.pdf | error: not_pdf_bytes |
| 17 | 2025-09-22 | n/a | counter_or_counteroffer | Sellers_Counter0ffer_1_-_003_OREF.pdf | error: not_pdf_bytes |
| 18 | 2025-09-22 | n/a | other_pdf | BCO1.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-09-22 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-09-22 | n/a | counter_or_counteroffer | Counter-_Buyer_s_1.pdf | error: not_pdf_bytes |
| 21 | 2025-09-22 | n/a | counter_or_counteroffer | Counter-_Seller_s_2.pdf | error: not_pdf_bytes |
| 22 | 2025-09-22 | n/a | counter_or_counteroffer | Counter-_Seller_s_1.pdf | error: not_pdf_bytes |
| 23 | 2025-09-22 | n/a | addendum | Septic_Addendum.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-09-22 | n/a | addendum | Well_Addendum.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-09-22 | n/a | addendum | Addendum-_Walk_Through.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-09-22 | n/a | lender_financing | Pre-Approval_Letter.pdf | _not in prioritized subset for this run_ |
| 27 | 2025-09-22 | n/a | addendum | Sellers Property Disclosure Statement Addendum _1_ - 028 OREF.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-09-22 | n/a | seller_property_disclosure | Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 29 | 2025-09-23 | n/a | addendum | Property Disclosure Addendum.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-09-23 | n/a | seller_property_disclosure | Property Disclosures_2.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-09-23 | n/a | other_pdf | EM_Receipt.pdf | _not in prioritized subset for this run_ |
| 32 | 2025-09-26 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 33 | 2025-10-02 | n/a | addendum | Addendum to Sale Agreement 2 - 002 OREF.pdf | error: not_pdf_bytes |
| 34 | 2025-10-02 | n/a | addendum | Sellers Repair Addendum - 022B _1_ OREF.pdf | _not in prioritized subset for this run_ |
| 35 | 2025-10-02 | n/a | addendum | Buyers_Repair_Addendum___1_25.pdf | _not in prioritized subset for this run_ |
| 36 | 2025-10-06 | n/a | addendum | Addendum-_Credit.pdf | _not in prioritized subset for this run_ |
| 37 | 2025-10-13 | n/a | addendum | Repair_Addendum-_Buyer_s.pdf | _not in prioritized subset for this run_ |
| 38 | 2025-10-13 | n/a | addendum | Repair_Addendum-_Seller_s.pdf | _not in prioritized subset for this run_ |
| 39 | 2025-10-15 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 40 | 2025-10-17 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 41 | 2025-10-17 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 42 | 2025-10-29 | n/a | closing_adjacent | Final_Sellers_Statement_IHLA.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 42 documents. Checklist activities: 10.
- **Listing file interpretation**: listing-side PDFs often include **multiple negotiation rounds** even before a sale file exists; use upload ordering + filenames like "Offer", "counter", and OREF counter forms.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 6 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 9 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This listing file for **[address]** (MLS **[mls]**) shows SkySlope status **Transaction**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-04-09 | n/a | addendum | Offer 3 - Seller_Contributions_Addendum_1_-_048_OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-04-09 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2026-04-09 | n/a | addendum | Offer 3 - Private_Well_Addendum_to_Real_Estate_Sale_Agreement_-_082_OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2026-04-09 | n/a | addendum | Offer 2 - Septic Addendum 1 signature.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-04-09 | n/a | closing_adjacent | Final Sellers Statement IHLB.pdf | _not in prioritized subset for this run_ |
| 6 | 2026-04-09 | n/a | listing_agreement | Exclusive Listing Agreement - ODS.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 3 - Advisory_Regarding_Electronic_Funds_-_043_OREF _1_.pdf | _not in prioritized subset for this run_ |
| 8 | 2026-04-09 | n/a | seller_property_disclosure | Exterior Siding - Stucco - EIFS Disclosure - 025 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 3 - Advisory_Regarding_FIRPTA_Tax_-_092_OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2026-04-09 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 11 | 2026-04-09 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 12 | 2026-04-09 | n/a | termination_or_release | Offer 1 - Bear Street Termination.pdf | pages=2, read=2, textLen=21534, 2 pg · rich · Digi×2 Docu×4 SignedBy×1 · dual pipeline 2 pg · tesseract.js (pdf.js render) · nonempty OCR 2/2 engine page(s)., signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, negative_outcome_word_present, signature_labels_present |
| 13 | 2026-04-09 | n/a | addendum | Offer 3 - Septic-Onsite_Sewage_System_Addendum_-_081_OREF.pdf | _not in prioritized subset for this run_ |
| 14 | 2026-04-09 | n/a | other_pdf | Advisory to Seller Regarding Lead-Based Paint- 018 OREF.pdf | _not in prioritized subset for this run_ |
| 15 | 2026-04-09 | n/a | addendum | Offer 1 - Addendum Extension.pdf | _not in prioritized subset for this run_ |
| 16 | 2026-04-09 | n/a | sale_agreement_or_rsa | Offer 3 - Residential_Real_Estate_Sale_Agreement_-_001_OREF _2_.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-04-09 | n/a | other_pdf | Disclosed Limited Agency Agreement for Sellers - 040 OREF.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 1 - 15352 Bear St.pdf | _not in prioritized subset for this run_ |
| 19 | 2026-04-09 | n/a | addendum | Lead Based Paint Disclosure Addendum - 021 OREF.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-04-09 | n/a | agency_disclosure_pamphlet | Offer 3- Protect_Your_Family_From_Lead_In_Your_Home_Pamphlet_-_EPA.pdf | _not in prioritized subset for this run_ |
| 21 | 2026-04-09 | n/a | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 22 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 3 - Disclosed_Limited_Agency_Agreement_for_Buyers_-_041_OREF.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-04-09 | n/a | addendum | Back Up Offer Addendum - 009 OREF.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 2 - Bear St - Private Well 1 signature.pdf | _not in prioritized subset for this run_ |
| 25 | 2026-04-09 | n/a | addendum | Offer 2 - Sale Price Addendum.pdf | _not in prioritized subset for this run_ |
| 26 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 3 - Advisory_and_Instructions_Regarding_Real_Estate_Purchase_and_Sale_Forms_-_Buyer_-_108_OREF.pdf | _not in prioritized subset for this run_ |
| 27 | 2026-04-09 | n/a | agency_disclosure_pamphlet | Protect Your Family From Lead In Your Home Pamphlet - EPA.pdf | _not in prioritized subset for this run_ |
| 28 | 2026-04-09 | n/a | other_pdf | Advisory Regarding Electronic Funds - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 29 | 2026-04-09 | n/a | other_pdf | FE - Lead based paint both signatures.pdf | _not in prioritized subset for this run_ |
| 30 | 2026-04-09 | n/a | agency_disclosure_pamphlet | Offer 3- Oregon_Real_Estate_Agency_Disclosure_Pamphlet_-_042_OREF.pdf | _not in prioritized subset for this run_ |
| 31 | 2026-04-09 | n/a | sale_agreement_or_rsa | Offer 2 - Residential Sale Agreement 1 signature.pdf | error: not_pdf_bytes |
| 32 | 2026-04-09 | n/a | addendum | Offer 3 - Lead_Based_Paint_Disclosure_Addendum_-_021_OREF.pdf | _not in prioritized subset for this run_ |
| 33 | 2026-04-09 | n/a | agency_disclosure_pamphlet | Oregon Real Estate Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 34 | 2026-04-09 | n/a | other_pdf | Removal of Contingencies.pdf | _not in prioritized subset for this run_ |
| 35 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 2 Hernandez - Proof of funds.pdf | _not in prioritized subset for this run_ |
| 36 | 2026-04-09 | n/a | seller_property_disclosure | FE - SPD both signatures.pdf | _not in prioritized subset for this run_ |
| 37 | 2026-04-09 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 38 | 2026-04-09 | n/a | other_pdf | EMRR IH.pdf | _not in prioritized subset for this run_ |
| 39 | 2026-04-09 | n/a | buyer_offer_or_package | 15352 Bear St - Offer 1_2024-09-09 12_11_56.pdf | _not in prioritized subset for this run_ |
| 40 | 2026-04-09 | n/a | buyer_offer_or_package | Offer 1.pdf | _not in prioritized subset for this run_ |
| 41 | 2026-04-09 | n/a | termination_or_release | Offer 1 - Bear Street Termination Addendum.pdf | pages=1, read=1, textLen=4618, 1 pg · rich · Digi×1 Docu×2 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 42 | 2026-04-09 | n/a | other_pdf | FIRPTA - Statement of Qualified Substitute IH.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 42 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 9 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 2. **RSA / sale agreement-like**: 2.
- **PDF dual pipeline coverage**: 3 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-04-07 | n/a | other_pdf | 6_2 Commercial Diligence Document Request Sheet - OR.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-04-07 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2026-04-07 | n/a | termination_or_release | 5_3 Buyer_s Notice of Termination - OR.pdf | pages=2, read=2, textLen=20263, 2 pg · rich · Digi×2 · dual pipeline 2 pg · tesseract.js (pdf.js render) · nonempty OCR 2/2 engine page(s)., signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 4 | 2026-04-07 | n/a | addendum | 2_2 General Addendum To Real Estate Purchase And Sale Agreement _1_ - OR.pdf | error: not_pdf_bytes |
| 5 | 2026-04-07 | n/a | seller_property_disclosure | 1_Sellers Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 6 | 2026-04-07 | n/a | addendum | 2_2 General Addendum To Real Estate Purchase And Sale Agreement _1_ - OR_2.pdf | error: not_pdf_bytes |
| 7 | 2026-04-07 | n/a | termination_or_release | Contingent Right to Purchase - Notice to Seller - 083A OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2026-04-07 | n/a | inspection_or_repair | Repair Request List _2_.pdf | _not in prioritized subset for this run_ |
| 9 | 2026-04-07 | n/a | addendum | 2_2 General Addendum To Real Estate Purchase And Sale Agreement _1_ - OR_3.pdf | error: not_pdf_bytes |
| 10 | 2026-04-07 | n/a | addendum | 2_2_General_Addendum_To_Real_Estate_Purchase_And_Sale_Agreement__4__-_OR.pdf | _not in prioritized subset for this run_ |
| 11 | 2026-04-07 | n/a | other_pdf | PA LETTER-Chester-218 sw 4th RDM - 435k.pdf | _not in prioritized subset for this run_ |
| 12 | 2026-04-07 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF_2.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-04-07 | n/a | other_pdf | Answers from Seller regarding Due Diligence.pdf | _not in prioritized subset for this run_ |
| 14 | 2026-04-07 | n/a | seller_property_disclosure | Sellers Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 15 | 2026-04-07 | n/a | counter_or_counteroffer | 2_1_Counteroffer_to_Real_Estate_Purchase_and_Sale_Agreement__1__-_OR.pdf | error: not_pdf_bytes |
| 16 | 2026-04-07 | n/a | other_pdf | Insurance.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-04-07 | n/a | sale_agreement_or_rsa | 1_2 Oregon Commercial Real Estate Purchase and Sale Agreement - OR.pdf | error: not_pdf_bytes |
| 18 | 2026-04-07 | n/a | other_pdf | RDM Utilities - Google Sheets.pdf | _not in prioritized subset for this run_ |
| 19 | 2026-04-07 | n/a | addendum | 2_2 General Addendum To Real Estate Purchase And Sale Agreement _3_ - OR.pdf | error: not_pdf_bytes |
| 20 | 2026-04-07 | n/a | other_pdf | 218 Southwest 4th Street - Proposal.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 20 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 1 (includes OREF counter forms when matched). **Termination/release-like**: 2. **RSA / sale agreement-like**: 1.
- **PDF dual pipeline coverage**: 7 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-04-05 | 2026-04-10 | addendum | OREF_009_Back_Up_Offer_Addendum_v1_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_v1_EXECUTED_20250124.pdf | error: not_pdf_bytes |
| 3 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_004_Buyers_Counter_Offer_1_v1_EXECUTED_20250124.pdf | error: not_pdf_bytes |
| 4 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v1_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-04-05 | 2026-04-10 | seller_property_disclosure | Sellers_Property_Disclosure_Statement_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 6 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_v1_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_004_Buyers_Counter_Offer_1_v2_EXECUTED_20250124.pdf | error: not_pdf_bytes |
| 8 | 2026-04-05 | 2026-04-10 | addendum | OREF_060_Contingency_Removal_Addendum_1_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 9 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Real_Estate_Sale_Agreement_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 10 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_004_Buyers_Counter_Offer_1_v3_EXECUTED_20250124.pdf | error: not_pdf_bytes |
| 11 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_3_EXECUTED_20250125.pdf | error: not_pdf_bytes |
| 12 | 2026-04-05 | 2026-04-10 | addendum | OREF_022A_Buyers_Repair_Addendum_1_v1_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-04-05 | 2026-04-10 | other_pdf | Advisory_Regarding_Electronic_Funds_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 14 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_2_v1_EXECUTED_20250124.pdf | error: not_pdf_bytes |
| 15 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_2_v2_EXECUTED_20250124.pdf | error: not_pdf_bytes |
| 16 | 2026-04-05 | 2026-04-10 | listing_agreement | Buyer_Representation_Agreement_Exclusive_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v2_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-04-05 | 2026-04-10 | addendum | OREF_021_Lead_Based_Paint_Disclosure_Addendum_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 19 | 2026-04-05 | 2026-04-10 | addendum | OREF_046_Woodstove_Addendum_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_2_EXECUTED_20250124.pdf | error: not_pdf_bytes |
| 21 | 2026-04-05 | 2026-04-10 | addendum | OREF_022B_Sellers_Repair_Addendum_EXECUTED_20250125.pdf | _not in prioritized subset for this run_ |
| 22 | 2026-04-05 | 2026-04-10 | addendum | Addendum_Sales_Price_EXECUTED_20250303.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-04-05 | 2026-04-10 | addendum | OREF_022A_Buyers_Repair_Addendum_1_v2_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_Seller_Signed_EXECUTED_20250124.pdf | error: not_pdf_bytes |
| 25 | 2026-04-05 | 2026-04-10 | addendum | OREF_048_Seller_Contributions_Addendum_1_v1_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 26 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_v2_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 27 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_2_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 28 | 2026-04-05 | 2026-04-10 | addendum | OREF_081_On_Site_Sewage_Addendum_v2_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 29 | 2026-04-05 | 2026-04-10 | addendum | OREF_081_On_Site_Sewage_Addendum_v1_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 30 | 2026-04-05 | 2026-04-10 | other_pdf | Balance_Letter_RECEIVED_20241230.pdf | _not in prioritized subset for this run_ |
| 31 | 2026-04-05 | 2026-04-10 | buyer_offer_or_package | Advisory_Regarding_Real_Estate_Compensation_Buyer_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 32 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_EXECUTED_20250124.pdf | error: not_pdf_bytes |
| 33 | 2026-04-05 | 2026-04-10 | other_pdf | Proof_of_Funds_RECEIVED_20250124.pdf | _not in prioritized subset for this run_ |
| 34 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v3_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 35 | 2026-04-05 | 2026-04-10 | other_pdf | Balance_Letter_RECEIVED_20250111.pdf | _not in prioritized subset for this run_ |
| 36 | 2026-04-05 | 2026-04-10 | title_or_hoa | HOA_Townhome_Planned_Community_Documents_RECEIVED_20250124.pdf | _not in prioritized subset for this run_ |
| 37 | 2026-04-05 | 2026-04-10 | buyer_offer_or_package | Advisory_Regarding_FIRPTA_Tax_Buyer_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 38 | 2026-04-05 | 2026-04-10 | addendum | OREF_024_Owner_Association_Addendum_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 39 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v5_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 40 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_3_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 41 | 2026-04-05 | 2026-04-10 | addendum | OREF_058_Professional_Inspection_Addendum_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 42 | 2026-04-05 | 2026-04-10 | addendum | OREF_009_Back_Up_Offer_Addendum_v2_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 43 | 2026-04-05 | 2026-04-10 | addendum | OREF_048_Seller_Contributions_Addendum_1_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 44 | 2026-04-05 | 2026-04-10 | buyer_offer_or_package | OREF_108_Advisory_and_Instructions_Regarding_RE_Forms_Buyer_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 45 | 2026-04-05 | 2026-04-10 | other_pdf | Balance_Letter_RECEIVED_20250123.pdf | _not in prioritized subset for this run_ |
| 46 | 2026-04-05 | 2026-04-10 | addendum | OREF_021_Lead_Based_Paint_Addendum_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |
| 47 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v4_EXECUTED_20250124.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 47 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 3 ("offer" family). **Counter-like**: 10 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 5.
- **PDF dual pipeline coverage**: 10 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-04-05 | 2026-04-10 | addendum | OREF_022A_Buyers_Repair_Addendum_2_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_EXECUTED_20250508.pdf | error: not_pdf_bytes |
| 3 | 2026-04-05 | 2026-04-10 | other_pdf | OREF_054_Agreement_to_Occupy_After_Closing_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 4 | 2026-04-05 | 2026-04-10 | addendum | OREF_024_Owner_Association_Addendum_1_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-04-05 | 2026-04-10 | addendum | OREF_022B_Sellers_Repair_Addendum_1_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 6 | 2026-04-05 | 2026-04-10 | addendum | Seller_Name_Change_Addendum_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_2_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 8 | 2026-04-05 | 2026-04-10 | addendum | OREF_060_Contingency_Removal_Addendum_2_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 9 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v1_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 10 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_004_Buyers_Counter_Offer_1_EXECUTED_20250508.pdf | error: not_pdf_bytes |
| 11 | 2026-04-05 | 2026-04-10 | addendum | OREF_022A_Buyers_Repair_Addendum_1_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 12 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v2_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Real_Estate_Purchase_and_Sale_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 14 | 2026-04-05 | 2026-04-10 | buyer_offer_or_package | Advisory_to_Buyer_Regarding_Owner_Association_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 15 | 2026-04-05 | 2026-04-10 | addendum | OREF_060_Contingency_Removal_Addendum_1_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 16 | 2026-04-05 | 2026-04-10 | amendment_or_notice | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_v2_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_v3_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 19 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_5_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 21 | 2026-04-05 | 2026-04-10 | other_pdf | Pre_Approval_Letter_RECEIVED_20250505.pdf | _not in prioritized subset for this run_ |
| 22 | 2026-04-05 | 2026-04-10 | addendum | OREF_024_Owner_Association_Addendum_2_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-04-05 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_3_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-04-05 | 2026-04-10 | seller_property_disclosure | Property_Disclosure_Statement_EXECUTED_20250508.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 24 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 2 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 3.
- **PDF dual pipeline coverage**: 2 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Sale_Agreement_5_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_EXECUTED_20250401.pdf | error: not_pdf_bytes |
| 3 | 2026-04-05 | 2026-04-10 | other_pdf | Crowson_Locks_Photo_RECEIVED_20250401.pdf | _not in prioritized subset for this run_ |
| 4 | 2026-04-05 | 2026-04-10 | other_pdf | Advisory_Regarding_FIRPTA_Tax_Seller_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-04-05 | 2026-04-10 | addendum | Well_Addendum_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 6 | 2026-04-05 | 2026-04-10 | addendum | Offer_2_OREF_082_Well_Addendum_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-04-05 | 2026-04-10 | amendment_or_notice | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 8 | 2026-04-05 | 2026-04-10 | addendum | OREF_081_On_Site_Sewage_Addendum_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 9 | 2026-04-05 | 2026-04-10 | other_pdf | Seller_Advisory_RECEIVED_20250401.pdf | _not in prioritized subset for this run_ |
| 10 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Sale_Agreement_4_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 11 | 2026-04-05 | 2026-04-10 | other_pdf | FIRPTA_Foreign_Investment_in_Real_Property_Tax_Act_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 12 | 2026-04-05 | 2026-04-10 | agency_disclosure_pamphlet | Initial_Agency_Disclosure_Pamphlet_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-04-05 | 2026-04-10 | other_pdf | Titan_Heating_Invoice_25_105_RECEIVED_20250401.pdf | _not in prioritized subset for this run_ |
| 14 | 2026-04-05 | 2026-04-10 | addendum | HVAC_Addendum_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 15 | 2026-04-05 | 2026-04-10 | addendum | Offer_2_OREF_022A_Buyers_Repair_Addendum_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 16 | 2026-04-05 | 2026-04-10 | earnest_or_wire | Wire_Fraud_Advisory_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-04-05 | 2026-04-10 | addendum | Offer_2_Seller_Occupancy_Addendum_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-04-05 | 2026-04-10 | counter_or_counteroffer | Counteroffer_to_Real_Estate_Purchase_and_Sale_EXECUTED_20250401.pdf | error: not_pdf_bytes |
| 19 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | Offer_2_OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Sale_Agreement_3_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 21 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Sale_Agreement_2_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 22 | 2026-04-05 | 2026-04-10 | addendum | Offer_2_General_Addendum_to_Sale_Agreement_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-04-05 | 2026-04-10 | addendum | General_Addendum_to_Sale_Agreement_1_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-04-05 | 2026-04-10 | agency_disclosure_pamphlet | Furniture_Agreement_EXECUTED_20250424.pdf | _not in prioritized subset for this run_ |
| 25 | 2026-04-05 | 2026-04-10 | listing_agreement | OREF_093_Exclusive_Listing_Agreement_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 26 | 2026-04-05 | 2026-04-10 | other_pdf | Titan_Heating_Invoice_25_102_RECEIVED_20250401.pdf | _not in prioritized subset for this run_ |
| 27 | 2026-04-05 | 2026-04-10 | seller_property_disclosure | Seller_Property_Disclosure_Statement_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 28 | 2026-04-05 | 2026-04-10 | buyer_offer_or_package | Offer_2_Pre_Approval_Letter_Updated_RECEIVED_20250401.pdf | _not in prioritized subset for this run_ |
| 29 | 2026-04-05 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 30 | 2026-04-05 | 2026-04-10 | addendum | Offer_2_OREF_081_On_Site_Sewage_Addendum_EXECUTED_20250401.pdf | _not in prioritized subset for this run_ |
| 31 | 2026-04-05 | 2026-04-10 | other_pdf | Titan_Heating_Letter_RECEIVED_20250401.pdf | _not in prioritized subset for this run_ |
| 32 | 2026-04-05 | 2026-04-10 | other_pdf | Metal_Masters_Invoice_1_RECEIVED_20250308.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 32 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 2 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 2.
- **PDF dual pipeline coverage**: 2 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-04-05 | n/a | addendum | Offer 2 - Addendum to Sale Agreement 1 - 002 OREF.pdf | error: not_pdf_bytes |
| 2 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 2- Advisory Regarding Electronic Funds - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 2- VA_FHA Amendatory Clause and Real Estate Certification - 097 OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 2 - Advisory Regarding FIRPTA Tax - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 2 -Advisory Regarding Smoke and Carbon Monoxide Alarms - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 6 | 2026-04-05 | n/a | addendum | Offer 2 - Woodstove Wood Burning Fireplace Insert Addendum - 046 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-04-05 | n/a | sale_agreement_or_rsa | Offer 2 - Residential Real Estate Sale Agreement - 001 OREF _1_.pdf | error: not_pdf_bytes |
| 8 | 2026-04-05 | 2026-04-07 | addendum | Offer 2 - Lead Based Paint Disclosure Addendum - 021 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2026-04-05 | 2026-04-07 | other_pdf | Bill of Sale - 071 OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2026-04-05 | 2026-04-07 | addendum | Addendum to Sale Agreement 2 - 002 OREF.pdf | error: not_pdf_bytes |
| 11 | 2026-04-05 | n/a | termination_or_release | Offer 3 - Termination Addendum.pdf | pages=1, read=1, textLen=3528, 1 pg · rich · Digi×1 Docu×2 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 12 | 2026-04-05 | 2026-04-07 | addendum | Sellers Repair Addendum - 022B _1_ OREF.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-04-05 | n/a | addendum | Offer 6 -Seller_Contributions_Addendum_1_-_048_OREF.pdf | _not in prioritized subset for this run_ |
| 14 | 2026-04-05 | n/a | sale_agreement_or_rsa | Offer 3 - Residential Sale Agreement.pdf | error: not_pdf_bytes |
| 15 | 2026-04-05 | n/a | addendum | Offer 2 - Septic Addendum.pdf | _not in prioritized subset for this run_ |
| 16 | 2026-04-05 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | error: not_pdf_bytes |
| 17 | 2026-04-05 | n/a | sale_agreement_or_rsa | Offer 6 - Residential_Real_Estate_Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-04-05 | n/a | addendum | Private Well Addendum to Real Estate Sale Agreement - 082 OREF.pdf | error: not_pdf_bytes |
| 19 | 2026-04-05 | n/a | other_pdf | unnamed document.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-04-05 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 21 | 2026-04-05 | n/a | sale_agreement_or_rsa | Offer 2 - Residential Sale Agreement.pdf | error: not_pdf_bytes |
| 22 | 2026-04-05 | n/a | seller_property_disclosure | Exterior Siding - Stucco - EIFS Disclosure - 025 OREF.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-04-05 | n/a | addendum | Offer 6 -Private_Well_Addendum_to_Real_Estate_Sale_Agreement_-_082_OREF.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-04-05 | n/a | addendum | Offer 6 -Septic-Onsite_Sewage_System_Addendum_-_081_OREF.pdf | _not in prioritized subset for this run_ |
| 25 | 2026-04-05 | n/a | listing_agreement | Revised Listing Contract.pdf | _not in prioritized subset for this run_ |
| 26 | 2026-04-05 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 27 | 2026-04-05 | 2026-04-07 | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 28 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 3 - Signed Well Report.pdf | _not in prioritized subset for this run_ |
| 29 | 2026-04-05 | n/a | addendum | Addendum to Sale Agreement 3 - 002 OREF.pdf | error: not_pdf_bytes |
| 30 | 2026-04-05 | n/a | addendum | Offer 2 - Well Addendum.pdf | _not in prioritized subset for this run_ |
| 31 | 2026-04-05 | n/a | addendum | Sellers Property Disclosure Statement Addendum _1_ - 028 OREF.pdf | _not in prioritized subset for this run_ |
| 32 | 2026-04-05 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _not in prioritized subset for this run_ |
| 33 | 2026-04-05 | 2026-04-07 | lender_financing | offer 6 preapproval.pdf | _not in prioritized subset for this run_ |
| 34 | 2026-04-05 | n/a | addendum | Addendum to Sale Agreement 4 - 002 OREF.pdf | error: not_pdf_bytes |
| 35 | 2026-04-05 | n/a | addendum | Septic-Onsite Sewage System Addendum - 081 OREF.pdf | _not in prioritized subset for this run_ |
| 36 | 2026-04-05 | n/a | addendum | Sellers Property Disclosure Statement Addendum _1_ - 028 OREF_2.pdf | _not in prioritized subset for this run_ |
| 37 | 2026-04-05 | n/a | addendum | Private Well Addendum to Real Estate Sale Agreement - 082 OREF_2.pdf | error: not_pdf_bytes |
| 38 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 3 - Removal of Contingencies.pdf | _not in prioritized subset for this run_ |
| 39 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 1 - Woodstove.pdf | _not in prioritized subset for this run_ |
| 40 | 2026-04-05 | n/a | addendum | Woodstove Wood Burning Fireplace Insert Addendum - 046 OREF.pdf | _not in prioritized subset for this run_ |
| 41 | 2026-04-05 | 2026-04-07 | seller_property_disclosure | Updated Sellers Disclosures.pdf | _not in prioritized subset for this run_ |
| 42 | 2026-04-05 | n/a | termination_or_release | Offer 3 - Termination.pdf | pages=1, read=1, textLen=7619, 1 pg · rich · Digi×1 Docu×2 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, negative_outcome_word_present, signature_labels_present |
| 43 | 2026-04-05 | n/a | other_pdf | 2021 Well Log Report.pdf | _not in prioritized subset for this run_ |
| 44 | 2026-04-05 | n/a | addendum | Offer 3 - Seller Contributions Addendum.pdf | _not in prioritized subset for this run_ |
| 45 | 2026-04-05 | 2026-04-07 | earnest_or_wire | Offer 3 - Earnest Money Deposit.pdf | _not in prioritized subset for this run_ |
| 46 | 2026-04-05 | 2026-04-07 | other_pdf | Disclosed Limited Agency Agreement for Sellers - 040 OREF.pdf | _not in prioritized subset for this run_ |
| 47 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 6 - Woodstove_Wood_Burning_Fireplace_Insert Fully Executed.pdf | _not in prioritized subset for this run_ |
| 48 | 2026-04-05 | n/a | addendum | Woodstove Wood Burning Fireplace Insert Addendum - 046 OREF_2.pdf | _not in prioritized subset for this run_ |
| 49 | 2026-04-05 | n/a | other_pdf | 2021 Well Log Report_2.pdf | _not in prioritized subset for this run_ |
| 50 | 2026-04-05 | n/a | seller_property_disclosure | Huntington Road Disclosures 3.pdf | _not in prioritized subset for this run_ |
| 51 | 2026-04-05 | n/a | addendum | Fully Executed Addendum 2 - Personal Property.pdf | _not in prioritized subset for this run_ |
| 52 | 2026-04-05 | n/a | addendum | Offer 6 - Addendum to change Broker Commission to Closing Costs_.pdf | _not in prioritized subset for this run_ |
| 53 | 2026-04-05 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF_2.pdf | _not in prioritized subset for this run_ |
| 54 | 2026-04-05 | n/a | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 55 | 2026-04-05 | n/a | lender_financing | Offer 1 - David Hunt Pre approval.pdf | _not in prioritized subset for this run_ |
| 56 | 2026-04-05 | n/a | other_pdf | 54474 Septic Report.pdf | _not in prioritized subset for this run_ |
| 57 | 2026-04-05 | n/a | seller_property_disclosure | Huntington Road Disclosures 2.pdf | _not in prioritized subset for this run_ |
| 58 | 2026-04-05 | 2026-04-07 | other_pdf | Advisory Regarding Electronic Funds - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 59 | 2026-04-05 | n/a | listing_agreement | MLSCO Listing Contract - ODS.pdf | _not in prioritized subset for this run_ |
| 60 | 2026-04-05 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF_2.pdf | error: not_pdf_bytes |
| 61 | 2026-04-05 | n/a | seller_property_disclosure | Exterior Siding - Stucco - EIFS Disclosure - 025 OREF_2.pdf | _not in prioritized subset for this run_ |
| 62 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 1 - Seller contributuons.pdf | _not in prioritized subset for this run_ |
| 63 | 2026-04-05 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_2.pdf | _not in prioritized subset for this run_ |
| 64 | 2026-04-05 | 2026-04-07 | counter_or_counteroffer | Offer 6 - Sellers_Counter_Offer_1 Fully Executed.pdf | error: not_pdf_bytes |
| 65 | 2026-04-05 | n/a | addendum | Offer 3 - Buyers Repair Addendum 1.pdf | _not in prioritized subset for this run_ |
| 66 | 2026-04-05 | 2026-04-07 | agency_disclosure_pamphlet | Oregon Real Estate Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 67 | 2026-04-05 | n/a | addendum | Septic-Onsite Sewage System Addendum - 081 OREF_2.pdf | _not in prioritized subset for this run_ |
| 68 | 2026-04-05 | 2026-04-07 | addendum | Offer 3 - Buyers Repair Addendum 2.pdf | _not in prioritized subset for this run_ |
| 69 | 2026-04-05 | n/a | addendum | Offer_6_-Seller_Contributions_Addendum Fully Executed.pdf | _not in prioritized subset for this run_ |
| 70 | 2026-04-05 | n/a | addendum | Seller Contributions Addendum 1 - 048 OREF.pdf | _not in prioritized subset for this run_ |
| 71 | 2026-04-05 | n/a | seller_property_disclosure | Offer 3 - Signed Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 72 | 2026-04-05 | n/a | lender_financing | Updated Pre approval David Hunt.pdf | _not in prioritized subset for this run_ |
| 73 | 2026-04-05 | n/a | counter_or_counteroffer | Offer 2 - Seller Counter 1.pdf | error: not_pdf_bytes |
| 74 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 3 - Advisories.pdf | _not in prioritized subset for this run_ |
| 75 | 2026-04-05 | 2026-04-07 | other_pdf | Advisory Regarding FIRPTA Tax - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 76 | 2026-04-05 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF_3.pdf | _not in prioritized subset for this run_ |
| 77 | 2026-04-05 | n/a | addendum | Woodstove Wood Burning Fireplace Insert Addendum - 046 OREF_3.pdf | _not in prioritized subset for this run_ |
| 78 | 2026-04-05 | n/a | addendum | Woodstove Wood Burning Fireplace Insert Addendum - 046 OREF_4.pdf | _not in prioritized subset for this run_ |
| 79 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 3 - Signed Septic-Report.pdf | _not in prioritized subset for this run_ |
| 80 | 2026-04-05 | n/a | addendum | Offer_6_-Private_Well_Addendum_to_Real_Estate_Sale_Agreement Fully Executed.pdf | _not in prioritized subset for this run_ |
| 81 | 2026-04-05 | n/a | earnest_or_wire | Offer 3 - Extension of Earnest Money.pdf | _not in prioritized subset for this run_ |
| 82 | 2026-04-05 | n/a | buyer_offer_or_package | Offer 1 - Septic.pdf | _not in prioritized subset for this run_ |
| 83 | 2026-04-05 | 2026-04-07 | sale_agreement_or_rsa | Offer_6_-_Residential_Real_Estate_Sale_Agreement Fully Executed.pdf | _not in prioritized subset for this run_ |
| 84 | 2026-04-05 | 2026-04-10 | addendum | OREF_046_Woodstove_Addendum_EXECUTED_20241001.pdf | _not in prioritized subset for this run_ |
| 85 | 2026-04-05 | n/a | counter_or_counteroffer | Fully Executed Seller Counter 1.pdf | error: not_pdf_bytes |
| 86 | 2026-04-05 | 2026-04-10 | other_pdf | Personal_Inventory_List_RECEIVED_20241001.pdf | _not in prioritized subset for this run_ |
| 87 | 2026-04-05 | 2026-04-10 | addendum | Offer_6_OREF_081_On_Site_Sewage_Addendum_EXECUTED_20250101.pdf | _not in prioritized subset for this run_ |
| 88 | 2026-04-05 | 2026-04-10 | seller_property_disclosure | Offer_6_OREF_025_Exterior_Siding_Disclosure_EXECUTED_20250101.pdf | _not in prioritized subset for this run_ |
| 89 | 2026-04-05 | 2026-04-10 | seller_property_disclosure | Huntington_Road_Disclosures_Package_1_EXECUTED_20241001.pdf | _not in prioritized subset for this run_ |
| 90 | 2026-04-05 | 2026-04-10 | seller_property_disclosure | Offer_3_OREF_020_Seller_Property_Disclosure_Statement_EXECUTED_20241001.pdf | _not in prioritized subset for this run_ |
| 91 | 2026-04-05 | 2026-04-10 | buyer_offer_or_package | Offer_3_Addenda_Well_Septic_Woodstove_Bill_of_Sale_EXECUTED_20241001.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 91 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 13 ("offer" family). **Counter-like**: 5 (includes OREF counter forms when matched). **Termination/release-like**: 2. **RSA / sale agreement-like**: 5.
- **PDF dual pipeline coverage**: 17 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-04-04 | 2026-04-10 | termination_or_release | Offer_1_Termination_EXECUTED_20241015.pdf | pages=1, read=1, textLen=5997, 1 pg · rich · Digi×2 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 2 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_022A_Buyers_Repair_Addendum_2_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 3 | 2026-04-04 | 2026-04-10 | other_pdf | Greenbar_Excavation_Invoice_TW5630A_RECEIVED_20241015.pdf | _not in prioritized subset for this run_ |
| 4 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_Fully_Executed_Repair_Addendums_EXECUTED_20241004.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_Extension_to_Closing_Date_Addendum_2_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 6 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_043_Advisory_Regarding_Electronic_Funds_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_022A_Buyers_Repair_Addendum_1_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 8 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_Extension_to_Closing_Date_Addendum_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 9 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_Signed_Seller_Repair_Addendum_v2_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 10 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_OREF_097_VA_FHA_Amendatory_Clause_v1_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 11 | 2026-04-04 | 2026-04-10 | sale_agreement_or_rsa | Offer_1_OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 12 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_OREF_059_Receipt_of_Reports_Removal_of_Contingencies_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 14 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_097_VA_FHA_Amendatory_Clause_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 15 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | Offer_1_OREF_003_Sellers_Counter_Offer_1_v2_EXECUTED_20241015.pdf | error: not_pdf_bytes |
| 16 | 2026-04-04 | 2026-04-10 | addendum | Offer_1_OREF_046_Woodstove_Addendum_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_059_Receipt_of_Reports_Removal_of_Contingencies_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_OREF_080_Advisory_Regarding_Smoke_and_Carbon_Monoxide_Alarms_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 19 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_048_Seller_Contributions_Addendum_1_v2_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_105_Solar_Panel_System_Advisory_and_Addendum_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 21 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | Offer_2_OREF_003_Sellers_Counter_Offer_2_EXECUTED_20241015.pdf | error: not_pdf_bytes |
| 22 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_Henry_Pre_Approval_Letter_RECEIVED_20241015.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-04-04 | 2026-04-10 | other_pdf | ORE_Mobile_Home_Input_ODS_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-04-04 | 2026-04-10 | addendum | Offer_1_OREF_081_Septic_Onsite_Sewage_Addendum_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 25 | 2026-04-04 | 2026-04-10 | addendum | Offer_1_OREF_048_Seller_Contributions_Addendum_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 26 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_048_Seller_Contributions_Addendum_1_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 27 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_Signed_Seller_Repair_Addendum_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 28 | 2026-04-04 | 2026-04-10 | amendment_or_notice | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 29 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_OREF_092_Advisory_Regarding_FIRPTA_Tax_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 30 | 2026-04-04 | 2026-04-10 | other_pdf | MLSCO_Listing_Contract_ODS_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 31 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_081_Septic_Onsite_Sewage_Addendum_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 32 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_VA_FHA_Amendatory_Clause_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 33 | 2026-04-04 | 2026-04-10 | addendum | OREF_022B_Sellers_Repair_Addendum_1_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 34 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_Advisory_Regarding_Electronic_Funds_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 35 | 2026-04-04 | 2026-04-10 | addendum | OREF_048_Seller_Contributions_Addendum_1_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 36 | 2026-04-04 | 2026-04-10 | other_pdf | OREF_092_Advisory_Regarding_FIRPTA_Tax_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 37 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_046_Woodstove_Addendum_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 38 | 2026-04-04 | 2026-04-10 | other_pdf | OREF_104_Advisory_Regarding_Fair_Housing_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 39 | 2026-04-04 | 2026-04-07 | counter_or_counteroffer | 1_DigiSign_Sellers_Counter_Offer_2_-_003_OREF _1_.pdf | error: not_pdf_bytes |
| 40 | 2026-04-04 | 2026-04-10 | seller_property_disclosure | Sellers_Property_Disclosure_Statement_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 41 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_Pre_Approval_Letter_RECEIVED_20240920.pdf | _not in prioritized subset for this run_ |
| 42 | 2026-04-04 | 2026-04-10 | earnest_or_wire | Offer_2_MLSCO_Wire_Fraud_Advisory_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 43 | 2026-04-04 | 2026-04-10 | sale_agreement_or_rsa | Offer_2_OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 44 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | Offer_2_OREF_003_Sellers_Counter_Offer_1_EXECUTED_20241015.pdf | error: not_pdf_bytes |
| 45 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | Offer_1_OREF_003_Sellers_Counter_Offer_1_EXECUTED_20241015.pdf | error: not_pdf_bytes |
| 46 | 2026-04-04 | 2026-04-10 | other_pdf | Disclosed_Limited_Agency_Agreement_for_Sale_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 47 | 2026-04-04 | 2026-04-10 | agency_disclosure_pamphlet | Oregon_Real_Estate_Agency_Disclosure_Pamphlet_EXECUTED_20241015.pdf | _not in prioritized subset for this run_ |
| 48 | 2026-04-04 | 2026-04-10 | inspection_or_repair | Ochoco_Repairs_RECEIVED_20241015.pdf | _not in prioritized subset for this run_ |
| 49 | 2026-04-04 | 2026-04-10 | inspection_or_repair | SE_Ochoco_Inspection_Report_RECEIVED_20241015.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 49 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 12 ("offer" family). **Counter-like**: 5 (includes OREF counter forms when matched). **Termination/release-like**: 1. **RSA / sale agreement-like**: 2.
- **PDF dual pipeline coverage**: 6 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_080_Advisory_Regarding_Smoke_and_Carbon_Monoxide_Alarms_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-04-04 | 2026-04-10 | sale_agreement_or_rsa | Offer_1_OREF_001_Residential_Real_Estate_Sale_Agreement_v2_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 3 | 2026-04-04 | 2026-04-10 | addendum | Offer_1_OREF_048_Seller_Contributions_Addendum_1_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 4 | 2026-04-04 | 2026-04-10 | addendum | Offer_5_Addendum_1K_Credit_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_092_Advisory_Regarding_FIRPTA_Tax_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 6 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_5_OREF_060_Removal_of_Contingencies_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-04-04 | 2026-04-10 | addendum | Offer_1_OREF_058_Professional_Inspection_Addendum_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 8 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_5_OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 9 | 2026-04-04 | 2026-04-10 | other_pdf | OREF_059_Receipt_of_Reports_Removal_of_Contingencies_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 10 | 2026-04-04 | 2026-04-10 | addendum | OREF_048_Seller_Contributions_Addendum_2_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 11 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_041_Disclosed_Limited_Agency_Agreement_for_Buyer_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 12 | 2026-04-04 | 2026-04-10 | agency_disclosure_pamphlet | Offer_1_OREF_042_Oregon_Real_Estate_Agency_Disclosure_Pamphlet_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_EXECUTED_20241101.pdf | error: not_pdf_bytes |
| 14 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_043_Advisory_Regarding_Electronic_Funds_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 15 | 2026-04-04 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 16 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_5_Pre_Approval_Letter_RECEIVED_20241101.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_Gaona_Pre_Approval_Letter_RECEIVED_20241101.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-04-04 | 2026-04-10 | addendum | OREF_022B_Sellers_Repair_Addendum_1_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 19 | 2026-04-04 | 2026-04-10 | addendum | Offer_5_OREF_022A_Buyers_Repair_Addendum_1_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_4_EXECUTED_20241101.pdf | error: not_pdf_bytes |
| 21 | 2026-04-04 | 2026-04-10 | addendum | OREF_022B_Sellers_Repair_Addendum_1_v2_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 22 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_1_OREF_104_Advisory_Regarding_Fair_Housing_Buyer_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-04-04 | 2026-04-10 | addendum | Offer_5_OREF_022A_Buyers_Repair_Addendum_2_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-04-04 | 2026-04-10 | sale_agreement_or_rsa | Offer_5_OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 25 | 2026-04-04 | 2026-04-10 | other_pdf | Advisory_Regarding_Electronic_Funds_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 26 | 2026-04-04 | 2026-04-10 | seller_property_disclosure | Offer_1_Seller_Property_Disclosure_Statement_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 27 | 2026-04-04 | 2026-04-10 | other_pdf | MLSCO_Listing_Agreement_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 28 | 2026-04-04 | 2026-04-10 | agency_disclosure_pamphlet | OREF_042_Oregon_Real_Estate_Agency_Disclosure_Pamphlet_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 29 | 2026-04-04 | 2026-04-10 | other_pdf | OREF_040_Disclosed_Limited_Agency_Agreement_for_Seller_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 30 | 2026-04-04 | 2026-04-10 | amendment_or_notice | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 31 | 2026-04-04 | 2026-04-10 | other_pdf | MLSCO_MLS_Input_Form_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |
| 32 | 2026-04-04 | 2026-04-10 | other_pdf | MLSCO_Listing_Agreement_2_EXECUTED_20241101.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 32 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 9 ("offer" family). **Counter-like**: 2 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 2.
- **PDF dual pipeline coverage**: 2 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_002_Addendum_to_Sale_Agreement_1_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_VA_FHA_Amendatory_Clause_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 3 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_Advisory_Regarding_Smoke_and_Carbon_Monoxide_Alarms_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 4 | 2026-04-04 | 2026-04-10 | sale_agreement_or_rsa | Offer_2_OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_Woodstove_Wood_Burning_Fireplace_Addendum_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 6 | 2026-04-04 | 2026-04-10 | addendum | Offer_2_OREF_056_Lead_Based_Paint_Disclosure_Addendum_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_Advisory_Regarding_FIRPTA_Tax_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 8 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | Offer_2_Advisory_Regarding_Electronic_Funds_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 9 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_v2_EXECUTED_20240401.pdf | error: not_pdf_bytes |
| 10 | 2026-04-04 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 11 | 2026-04-04 | 2026-04-10 | other_pdf | Advisory_Regarding_Electronic_Funds_v2_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 12 | 2026-04-04 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_3_v2_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-04-04 | 2026-04-10 | other_pdf | Caldwell_Letter_for_1st_Street_2_RECEIVED_20240401.pdf | _not in prioritized subset for this run_ |
| 14 | 2026-04-04 | 2026-04-10 | buyer_offer_or_package | OREF_110_Notice_from_Seller_to_Buyer_1_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 15 | 2026-04-04 | 2026-04-10 | addendum | Exterior_Siding_Stucco_EIFS_Disclosure_Addendum_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 16 | 2026-04-04 | 2026-04-10 | earnest_or_wire | Earnest_Money_Receipt_RECEIVED_20240401.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-04-04 | 2026-04-10 | other_pdf | OREF_060_Receipt_of_Reports_Removal_of_Contingencies_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-04-04 | 2026-04-10 | addendum | OREF_022A_Buyers_Repair_Addendum_1_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 19 | 2026-04-04 | 2026-04-10 | other_pdf | Advisory_Regarding_Electronic_Funds_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-04-04 | 2026-04-10 | inspection_or_repair | Wood_Destroying_Insect_Inspection_Report_RECEIVED_20240401.pdf | _not in prioritized subset for this run_ |
| 21 | 2026-04-04 | 2026-04-10 | other_pdf | MLSCO_Listing_Contract_ODS_RECEIVED_20240401.pdf | _not in prioritized subset for this run_ |
| 22 | 2026-04-04 | 2026-04-10 | addendum | OREF_056_Lead_Based_Paint_Disclosure_Addendum_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-04-04 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_3_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-04-04 | 2026-04-10 | addendum | Completed_Addendum_RECEIVED_20240401.pdf | _not in prioritized subset for this run_ |
| 25 | 2026-04-04 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_v2_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 26 | 2026-04-04 | 2026-04-10 | inspection_or_repair | Repair_Request_List_RECEIVED_20240401.pdf | _not in prioritized subset for this run_ |
| 27 | 2026-04-04 | 2026-04-10 | other_pdf | OREF_040_Disclosed_Limited_Agency_Agreement_Sellers_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 28 | 2026-04-04 | 2026-04-10 | agency_disclosure_pamphlet | Oregon_Real_Estate_Agency_Disclosure_Pamphlet_RECEIVED_20240401.pdf | _not in prioritized subset for this run_ |
| 29 | 2026-04-04 | 2026-04-10 | other_pdf | Lead_Paint_Booklet_Protect_Your_Family_RECEIVED_20240401.pdf | _not in prioritized subset for this run_ |
| 30 | 2026-04-04 | 2026-04-10 | addendum | Completed_Sellers_Repair_Addendum_RECEIVED_20240401.pdf | _not in prioritized subset for this run_ |
| 31 | 2026-04-04 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 32 | 2026-04-04 | 2026-04-10 | seller_property_disclosure | Sellers_Property_Disclosure_Statement_v2_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 33 | 2026-04-04 | 2026-04-10 | addendum | Completed_Exterior_Siding_Addendum_RECEIVED_20240401.pdf | _not in prioritized subset for this run_ |
| 34 | 2026-04-04 | 2026-04-10 | amendment_or_notice | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 35 | 2026-04-04 | 2026-04-10 | addendum | OREF_022B_Sellers_Repair_Addendum_1_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |
| 36 | 2026-04-04 | 2026-04-10 | other_pdf | ORE_Residential_Input_ODS_RECEIVED_20240401.pdf | _not in prioritized subset for this run_ |
| 37 | 2026-04-04 | 2026-04-10 | counter_or_counteroffer | OREF_003_Sellers_Counter_Offer_1_EXECUTED_20240401.pdf | error: not_pdf_bytes |
| 38 | 2026-04-04 | 2026-04-10 | other_pdf | Caldwell_Letter_for_1st_Street_1_RECEIVED_20240401.pdf | _not in prioritized subset for this run_ |
| 39 | 2026-04-04 | 2026-04-10 | seller_property_disclosure | Sellers_Property_Disclosure_Statement_EXECUTED_20240401.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 39 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 5 ("offer" family). **Counter-like**: 2 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 2.
- **PDF dual pipeline coverage**: 2 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-03-18 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-03-18 | n/a | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2026-03-18 | n/a | counter_or_counteroffer | Sellers Counteroffer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 4 | 2026-03-18 | n/a | lender_financing | approval letter.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-03-18 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | error: not_pdf_bytes |
| 6 | 2026-03-18 | n/a | buyer_offer_or_package | Beaumont Offer 1.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-03-19 | n/a | counter_or_counteroffer | counter.pdf | error: not_pdf_bytes |
| 8 | 2026-03-19 | n/a | counter_or_counteroffer | Sellers Counteroffer 2 - 003 OREF.pdf | error: not_pdf_bytes |
| 9 | 2026-03-28 | n/a | buyer_offer_or_package | offer _2_.pdf | _not in prioritized subset for this run_ |
| 10 | 2026-03-28 | n/a | other_pdf | Treadway.pdf | _not in prioritized subset for this run_ |
| 11 | 2026-03-31 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 12 | 2026-03-31 | 2026-03-31 | other_pdf | Listing_Contract.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-03-31 | 2026-03-31 | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 14 | 2026-03-31 | n/a | lender_financing | Pre-approval_Letter.pdf | _not in prioritized subset for this run_ |
| 15 | 2026-04-01 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 16 | 2026-04-01 | n/a | other_pdf | EM_Receipt.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-04-04 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-04-04 | n/a | other_pdf | Amendatory Clause.pdf | _not in prioritized subset for this run_ |
| 19 | 2026-04-04 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-04-04 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 21 | 2026-04-04 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 22 | 2026-04-04 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-04-04 | n/a | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - Seller - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-04-06 | n/a | other_pdf | Alarm_Advisory.pdf | _not in prioritized subset for this run_ |
| 25 | 2026-04-06 | n/a | other_pdf | Forms_Advisory.pdf | _not in prioritized subset for this run_ |
| 26 | 2026-04-06 | n/a | other_pdf | Firpta_Advisory.pdf | _not in prioritized subset for this run_ |
| 27 | 2026-04-06 | n/a | other_pdf | RE_Compensation_Advisory.pdf | _not in prioritized subset for this run_ |
| 28 | 2026-04-06 | n/a | other_pdf | Electronic_Funds_Advisory.pdf | _not in prioritized subset for this run_ |
| 29 | 2026-04-06 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 30 | 2026-04-08 | n/a | seller_property_disclosure | Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 31 | 2026-04-08 | 2026-04-08 | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 32 | 2026-04-08 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 33 | 2026-04-08 | n/a | other_pdf | Amendatory_Clause.pdf | _not in prioritized subset for this run_ |
| 34 | 2026-04-09 | n/a | addendum | Addendum- Insp Ext.pdf | _not in prioritized subset for this run_ |
| 35 | 2026-04-09 | n/a | other_pdf | Delivery of Assoc Docs.pdf | _not in prioritized subset for this run_ |
| 36 | 2026-04-09 | 2026-04-09 | addendum | Owner Association Addendum.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 36 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 2 ("offer" family). **Counter-like**: 3 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 4 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Pending**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 56111 School House Rd, Bend, OR 97707

- **Folder id (`saleGuid`)**: `32c42212-1097-4a16-ba5d-24ebae2acebb`
- **MLS**: n/a
- **SkySlope status**: Pending
- **Linked listingGuid**: n/a
- **Sale price / list price**: 3025000 / 0
- **Contract acceptance**: 2026-03-26
- **Escrow closing**: 2026-05-15
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-03-27

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | In Review | 2026-03-27 | Sale_Agreement.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Optional | n/a |  |
| 3 | Counter Offers  | Sales Documentation | Optional | n/a |  |
| 4 | Sale Addendums  | Sales Documentation | In Review | 2026-03-27 | Addendum-_Personal_Property.pdf; Addendum-_Offer_Exp.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | Optional | n/a |  |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | In Review | 2026-03-27 | Owner_Association_Addendum.pdf |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | In Review | 2026-03-27 | Woodstove_Addendum.pdf |
| 11 | Contingency Removal Addendum  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy  | Sales Documentation | In Review | 2026-03-27 | Agreement_to_Occupy.pdf |
| 13 | Bill Of Sale  | Sales Documentation | In Review | 2026-03-27 | Bill_of_Sale.pdf |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Optional | n/a |  |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 18 | Well Addendum | Sales Documentation | In Review | 2026-03-27 | Well_Addendum.pdf |
| 19 | Transaction Timeline | Miscellaneous Documentation | In Review | 2026-04-09 | Summary_Sheet.pdf |
| 19 | Septic Addendum | Sales Documentation | In Review | 2026-03-27 | Septic_Addendum.pdf |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | In Review | 2026-04-09 | Property_Disclosures.pdf; Property_Disclosure_Addendum.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | In Review | 2026-04-09 | Electronic_Funds_Advisory.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | In Review | 2026-04-09 | Compensation_Advisory.pdf |
| 25 | FIRPTA Advisory | Disclosures | In Review | 2026-04-09 | Firpta_Advisory.pdf |
| 26 | Real Estate Forms Advisory | Disclosures | In Review | 2026-04-09 | Forms_Advisory.pdf |
| 27 | Smoke Alarms Advisory | Disclosures | In Review | 2026-04-09 | Alarm_Advisory.pdf |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 35 | Earnest Money Receipt | Closing Documents | In Review | 2026-03-27 | EM_Receipt.pdf |
| 36 | Preliminary Title Report | Closing Documents | In Review | 2026-04-02 | Preliminary_Title_Report.pdf |
| 37 | Final HUD | Closing Documents | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | In Review | 2026-04-02 | OREA_Pamphlet-_Buyer_s.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | In Review | 2026-04-02 | Buyer_Representation_Agreement.pdf |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | In Review | 2026-04-02 | DLA.pdf |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-03-27 | n/a | buyer_offer_or_package | Disclosed Limited Agency Agreement for Buyers - 041 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-03-27 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2026-03-27 | n/a | addendum | Private Well Addendum to Real Estate Sale Agreement - 082 OREF.pdf | error: not_pdf_bytes |
| 4 | 2026-03-27 | n/a | other_pdf | Agreement to Occupy After Closing - 054 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-03-27 | n/a | addendum | Owner Association Addendum - 024 OREF.pdf | _not in prioritized subset for this run_ |
| 6 | 2026-03-27 | n/a | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-03-27 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF.pdf | error: not_pdf_bytes |
| 8 | 2026-03-27 | n/a | addendum | Septic Onsite Sewage System Addendum - 081 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2026-03-27 | n/a | other_pdf | Disclosed Limited Agency Agreement for Sellers - 040 OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2026-03-27 | n/a | listing_agreement | Buyer Representation Agreement - Exclusive - 050 OREF.pdf | _not in prioritized subset for this run_ |
| 11 | 2026-03-27 | n/a | other_pdf | Bill of Sale - 071 OREF.pdf | _not in prioritized subset for this run_ |
| 12 | 2026-03-27 | n/a | addendum | Wood Stove and Wood Burning Fireplace Insert Addendum - 046 OREF.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-03-27 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 14 | 2026-03-27 | n/a | addendum | Owner_Association_Addendum.pdf | _not in prioritized subset for this run_ |
| 15 | 2026-03-27 | n/a | addendum | Woodstove_Addendum.pdf | _not in prioritized subset for this run_ |
| 16 | 2026-03-27 | n/a | other_pdf | EM_Receipt.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-03-27 | n/a | other_pdf | Agreement_to_Occupy.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-03-27 | n/a | other_pdf | Bill_of_Sale.pdf | _not in prioritized subset for this run_ |
| 19 | 2026-03-27 | n/a | addendum | Addendum-_Personal_Property.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-03-27 | n/a | addendum | Well_Addendum.pdf | _not in prioritized subset for this run_ |
| 21 | 2026-03-27 | n/a | addendum | Septic_Addendum.pdf | _not in prioritized subset for this run_ |
| 22 | 2026-03-28 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-03-28 | n/a | addendum | Sellers Property Disclosure Statement Addendum _1_ - 028 OREF.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-03-28 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | error: not_pdf_bytes |
| 25 | 2026-03-31 | n/a | seller_property_disclosure | Sellers_Property_Disclosure_Statement_-_020_OREF.pdf | _not in prioritized subset for this run_ |
| 26 | 2026-03-31 | n/a | addendum | Sellers_Property_Disclosure_Statement_Addendum__1__-_028_OREF.pdf | _not in prioritized subset for this run_ |
| 27 | 2026-03-31 | n/a | addendum | Addendum-_Offer_Exp.pdf | _not in prioritized subset for this run_ |
| 28 | 2026-04-02 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 29 | 2026-04-02 | n/a | buyer_offer_or_package | Buyer_Representation_Agreement.pdf | _not in prioritized subset for this run_ |
| 30 | 2026-04-02 | n/a | other_pdf | DLA.pdf | _not in prioritized subset for this run_ |
| 31 | 2026-04-02 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet-_Buyer_s.pdf | _not in prioritized subset for this run_ |
| 32 | 2026-04-04 | n/a | other | ATT00001_139.htm | _not in prioritized subset for this run_ |
| 33 | 2026-04-04 | n/a | closing_adjacent | 1118_RPRS_FINAL_DRAFT_CON_35__411.pdf | _not in prioritized subset for this run_ |
| 34 | 2026-04-04 | n/a | other_pdf | WORK_AUTHO_-_RPRS_-_SIGNED_30__712.pdf | _not in prioritized subset for this run_ |
| 35 | 2026-04-04 | n/a | other | Vandevert_Ranch_2025_Assessment_133.eml | _not in prioritized subset for this run_ |
| 36 | 2026-04-04 | n/a | other_pdf | 2025_Budget_Recap_-_Owners_180.pdf | _not in prioritized subset for this run_ |
| 37 | 2026-04-04 | n/a | other_pdf | VDR_Reserve_Study_2025_277.pdf | _not in prioritized subset for this run_ |
| 38 | 2026-04-04 | n/a | other | ATT00002_227.htm | _not in prioritized subset for this run_ |
| 39 | 2026-04-04 | n/a | other_pdf | Maintenance_Plan_2025_471.pdf | _not in prioritized subset for this run_ |
| 40 | 2026-04-04 | n/a | other | ATT00003_246.htm | _not in prioritized subset for this run_ |
| 41 | 2026-04-04 | n/a | other_pdf | VDR_Reserve_Study_2025_CF_597.pdf | _not in prioritized subset for this run_ |
| 42 | 2026-04-04 | n/a | other | ATT00004_694.htm | _not in prioritized subset for this run_ |
| 43 | 2026-04-04 | n/a | other_pdf | Reserve_study_-_2025_Intro_468.pdf | _not in prioritized subset for this run_ |
| 44 | 2026-04-04 | n/a | other | ATT00005_741.htm | _not in prioritized subset for this run_ |
| 45 | 2026-04-04 | n/a | other_pdf | INV0242_515.pdf | _not in prioritized subset for this run_ |
| 46 | 2026-04-04 | n/a | other_pdf | Ernie-Proposal-10-28-24---Webfoot-Painting_90__290.pdf | _not in prioritized subset for this run_ |
| 47 | 2026-04-04 | n/a | other | Invoice_from_Webfoot_Home_Improvements_356.eml | _not in prioritized subset for this run_ |
| 48 | 2026-04-08 | n/a | addendum | Property Disclosure Addendum.pdf | _not in prioritized subset for this run_ |
| 49 | 2026-04-08 | n/a | buyer_offer_or_package | Advisory Regarding Real Estate Compensation - Buyer - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 50 | 2026-04-08 | n/a | buyer_offer_or_package | Advisory Regarding Electronic Funds - Buyer - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 51 | 2026-04-08 | n/a | buyer_offer_or_package | Advisory Regarding Smoke and Carbon Monoxide Alarms - Buyer - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 52 | 2026-04-08 | n/a | buyer_offer_or_package | Advisory Regarding FIRPTA Tax - Buyer - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 53 | 2026-04-08 | n/a | seller_property_disclosure | Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 54 | 2026-04-08 | n/a | buyer_offer_or_package | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Buyer - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 55 | 2026-04-09 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 56 | 2026-04-09 | n/a | addendum | Property_Disclosure_Addendum.pdf | _not in prioritized subset for this run_ |
| 57 | 2026-04-09 | n/a | other_pdf | Electronic_Funds_Advisory.pdf | _not in prioritized subset for this run_ |
| 58 | 2026-04-09 | n/a | other_pdf | Compensation_Advisory.pdf | _not in prioritized subset for this run_ |
| 59 | 2026-04-09 | n/a | other_pdf | Firpta_Advisory.pdf | _not in prioritized subset for this run_ |
| 60 | 2026-04-09 | n/a | other_pdf | Forms_Advisory.pdf | _not in prioritized subset for this run_ |
| 61 | 2026-04-09 | n/a | other_pdf | Alarm_Advisory.pdf | _not in prioritized subset for this run_ |
| 62 | 2026-04-09 | n/a | other_pdf | Summary_Sheet.pdf | _not in prioritized subset for this run_ |
| 63 | 2026-04-09 | n/a | addendum | Buyers Repair Addendum - 022A _1_ OREF.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 63 documents. Checklist activities: 44.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 7 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 1.
- **PDF dual pipeline coverage**: 3 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Pending**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 19571 SW Simpson Ave, Bend, OR 97702

- **Folder id (`saleGuid`)**: `f620aee8-2f1a-4025-be18-70a335beeb35`
- **MLS**: n/a
- **SkySlope status**: Closed
- **Linked listingGuid**: n/a
- **Sale price / list price**: 750000 / 0
- **Contract acceptance**: 2026-02-04
- **Escrow closing**: 2026-03-16
- **Actual closing**: 2026-03-16
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-02-07

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | Completed | 2026-02-07 | Sales_Agreement.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Completed | 2026-02-07 | Proof_of_Funds.pdf |
| 3 | Counter Offers  | Sales Documentation | Optional | n/a |  |
| 4 | Sale Addendums  | Sales Documentation | Completed | 2026-02-07 | Addendum-_Terms.pdf; Addendum-_Carpet_Cleaning.pdf; Addendum-_Close_3-16.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | Completed | 2026-02-25 | Repair_Addendum-_Buyer_s.pdf |
| 7 | Delivery Addendum  | Sales Documentation | Completed | 2026-02-16 | Delivery_of_Assoc_Docs.pdf |
| 8 | Owner Association Addendum | Sales Documentation | Completed | 2026-02-07 | Owner_Association_Addendum.pdf |
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
| 21 | Sellers Property Disclosures | Disclosures | Completed | 2026-02-12 | Property_Disclosures.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | Completed | 2026-02-07 | Electronic_Funds_Advisory.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | Completed | 2026-02-07 | RE_Compensation_Advisory.pdf |
| 25 | FIRPTA Advisory | Disclosures | Completed | 2026-02-12 | Firpta_Advisory.pdf |
| 26 | Real Estate Forms Advisory | Disclosures | Completed | 2026-02-07 | Forms_Advisory.pdf |
| 27 | Smoke Alarms Advisory | Disclosures | Completed | 2026-02-07 | Alarm_Advisory.pdf |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Completed | 2026-03-05 | Broker_Demand.pdf |
| 35 | Earnest Money Receipt | Closing Documents | Completed | 2026-02-07 | EM_Receipt.pdf |
| 36 | Preliminary Title Report | Closing Documents | Completed | 2026-02-16 | _OR__Preliminary_Title_Report_-N.pdf |
| 37 | Final HUD | Closing Documents | Completed | 2026-03-16 | ALTA_Settlement_Buyer.pdf |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | Completed | 2026-02-07 | OREA_Pamphlet.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Completed | 2026-02-07 | Buyer_Representation_Agreement.pdf |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-02-07 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-02-07 | n/a | addendum | Owner Association Addendum - 024 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2026-02-07 | n/a | buyer_offer_or_package | Advisory Regarding Electronic Funds - Buyer - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2026-02-07 | n/a | buyer_offer_or_package | Advisory for Buyers and Sellers of Real Estate - 000B - OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-02-07 | n/a | closing_adjacent | Verification of Funds.pdf | _not in prioritized subset for this run_ |
| 6 | 2026-02-07 | n/a | buyer_offer_or_package | Advisory Regarding Smoke and Carbon Monoxide Alarms - Buyer - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-02-07 | n/a | listing_agreement | Buyer Representation Agreement - Exclusive - 050 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2026-02-07 | n/a | buyer_offer_or_package | Advisory to Buyer Regarding Due Diligence - 058 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2026-02-07 | n/a | title_or_hoa | Advisory Regarding Title Insurance - Buyer - 103 OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2026-02-07 | n/a | other_pdf | Real Estate Transaction Terms and Concepts 000C - OREF.pdf | _not in prioritized subset for this run_ |
| 11 | 2026-02-07 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF.pdf | error: not_pdf_bytes |
| 12 | 2026-02-07 | n/a | buyer_offer_or_package | Advisory Regarding Real Estate Compensation - Buyer - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-02-07 | n/a | closing_adjacent | Things to Know Before Signing - 000A OREF.pdf | _not in prioritized subset for this run_ |
| 14 | 2026-02-07 | n/a | buyer_offer_or_package | Advisory Regarding Fair Housing - Buyer - 104 OREF.pdf | _not in prioritized subset for this run_ |
| 15 | 2026-02-07 | n/a | buyer_offer_or_package | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Buyer - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 16 | 2026-02-07 | n/a | other_pdf | Sales_Agreement.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-02-07 | n/a | addendum | Owner_Association_Addendum.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-02-07 | n/a | other_pdf | EM_Receipt.pdf | _not in prioritized subset for this run_ |
| 19 | 2026-02-07 | n/a | other_pdf | Proof_of_Funds.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-02-07 | n/a | addendum | Addendum-_Terms.pdf | _not in prioritized subset for this run_ |
| 21 | 2026-02-07 | n/a | buyer_offer_or_package | Buyer_Representation_Agreement.pdf | _not in prioritized subset for this run_ |
| 22 | 2026-02-07 | n/a | other_pdf | Electronic_Funds_Advisory.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-02-07 | n/a | other_pdf | RE_Compensation_Advisory.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-02-07 | n/a | other_pdf | Forms_Advisory.pdf | _not in prioritized subset for this run_ |
| 25 | 2026-02-07 | n/a | other_pdf | Alarm_Advisory.pdf | _not in prioritized subset for this run_ |
| 26 | 2026-02-07 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 27 | 2026-02-11 | n/a | buyer_offer_or_package | Advisory Regarding FIRPTA Tax - Buyer - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 28 | 2026-02-11 | n/a | seller_property_disclosure | Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 29 | 2026-02-12 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 30 | 2026-02-12 | n/a | other_pdf | Firpta_Advisory.pdf | _not in prioritized subset for this run_ |
| 31 | 2026-02-12 | n/a | addendum | Addendum- Carpet Cleaning.pdf | _not in prioritized subset for this run_ |
| 32 | 2026-02-12 | n/a | other_pdf | Delivery of Assoc Docs.pdf | _not in prioritized subset for this run_ |
| 33 | 2026-02-16 | n/a | addendum | Buyers Repair Addendum - 022A _1_ OREF.pdf | _not in prioritized subset for this run_ |
| 34 | 2026-02-16 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | error: not_pdf_bytes |
| 35 | 2026-02-16 | n/a | title_or_hoa | _OR__Preliminary_Title_Report_-N.pdf | _not in prioritized subset for this run_ |
| 36 | 2026-02-16 | n/a | other_pdf | Delivery_of_Assoc_Docs.pdf | _not in prioritized subset for this run_ |
| 37 | 2026-02-16 | n/a | addendum | Addendum-_Carpet_Cleaning.pdf | _not in prioritized subset for this run_ |
| 38 | 2026-02-25 | n/a | addendum | Repair_Addendum-_Buyer_s.pdf | _not in prioritized subset for this run_ |
| 39 | 2026-02-25 | n/a | addendum | Addendum-_Close_3-16.pdf | _not in prioritized subset for this run_ |
| 40 | 2026-03-03 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 41 | 2026-03-05 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 42 | 2026-03-13 | n/a | inspection_or_repair | Notice- Completion of Repairs.pdf | _not in prioritized subset for this run_ |
| 43 | 2026-03-16 | n/a | buyer_offer_or_package | ALTA_Settlement_Buyer.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 43 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 10 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 1.
- **PDF dual pipeline coverage**: 2 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 19571 SW Simpson Ave, Bend, OR 97702

- **Folder id (`saleGuid`)**: `b25e525e-bf12-422a-83b9-698382e4d286`
- **MLS**: 220202576
- **SkySlope status**: Pre-Contract
- **Linked listingGuid**: n/a
- **Sale price / list price**: 750000 / 0
- **Contract acceptance**: n/a
- **Escrow closing**: 2026-03-19
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-02-03

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-02-03 | 2026-04-10 | closing_adjacent | OREF_000A_Things_to_Know_Before_Signing_EXECUTED_20260203.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-02-03 | 2026-04-10 | other_pdf | OREF_000C_Real_Estate_Transaction_Terms_and_Concepts_EXECUTED_20260203.pdf | _not in prioritized subset for this run_ |
| 3 | 2026-02-03 | 2026-04-10 | buyer_offer_or_package | Advisory_Regarding_Real_Estate_Compensation_Buyer_EXECUTED_20260203.pdf | _not in prioritized subset for this run_ |
| 4 | 2026-02-03 | 2026-04-10 | buyer_offer_or_package | Advisory_for_Buyers_and_Sellers_of_Real_Estate_EXECUTED_20260203.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-02-03 | 2026-04-10 | buyer_offer_or_package | Advisory_Regarding_Electronic_Funds_Buyer_EXECUTED_20260203.pdf | _not in prioritized subset for this run_ |
| 6 | 2026-02-03 | 2026-04-10 | buyer_offer_or_package | Advisory_Regarding_Fair_Housing_Buyer_EXECUTED_20260203.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-02-03 | 2026-04-10 | buyer_offer_or_package | Advisory_to_Buyer_Regarding_Due_Diligence_EXECUTED_20260203.pdf | _not in prioritized subset for this run_ |
| 8 | 2026-02-03 | 2026-04-10 | buyer_offer_or_package | OREF_108_Advisory_and_Instructions_Regarding_Real_Estate_Purchase_and_Sale_Forms_Buyer_EXECUTED_20260203.pdf | _not in prioritized subset for this run_ |
| 9 | 2026-02-03 | 2026-04-10 | title_or_hoa | Advisory_Regarding_Title_Insurance_Buyer_EXECUTED_20260203.pdf | _not in prioritized subset for this run_ |
| 10 | 2026-02-03 | 2026-04-10 | buyer_offer_or_package | Advisory_Regarding_Smoke_and_Carbon_Monoxide_Detectors_Buyer_EXECUTED_20260203.pdf | _not in prioritized subset for this run_ |
| 11 | 2026-02-03 | 2026-04-10 | closing_adjacent | Verification_of_Funds_RECEIVED_20260203.pdf | _not in prioritized subset for this run_ |
| 12 | 2026-02-03 | 2026-04-10 | sale_agreement_or_rsa | OREF_001_Residential_Real_Estate_Sale_Agreement_EXECUTED_20260203.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-02-03 | 2026-04-10 | addendum | OREF_024_Owner_Association_Addendum_EXECUTED_20260203.pdf | _not in prioritized subset for this run_ |
| 14 | 2026-02-07 | 2026-04-10 | closing_adjacent | OREF_000A_Things_to_Know_Before_Signing_EXECUTED_20260206.pdf | _not in prioritized subset for this run_ |
| 15 | 2026-02-07 | 2026-04-10 | buyer_offer_or_package | Advisory_Regarding_Fair_Housing_Buyer_EXECUTED_20260206.pdf | _not in prioritized subset for this run_ |
| 16 | 2026-02-07 | 2026-04-10 | inspection_or_repair | Advisory_and_Instructions_Regarding_Real_Estate_Inspections_EXECUTED_20260206.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-02-11 | 2026-04-10 | buyer_offer_or_package | Advisory_Regarding_FIRPTA_Tax_Buyer_EXECUTED_20260211.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-02-11 | 2026-04-10 | seller_property_disclosure | Property_Disclosure_Statement_EXECUTED_20260211.pdf | _not in prioritized subset for this run_ |
| 19 | 2026-02-12 | 2026-04-10 | addendum | Addendum_Carpet_Cleaning_EXECUTED_20260212.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-02-12 | 2026-04-10 | other_pdf | Delivery_of_Association_Documents_RECEIVED_20260212.pdf | _not in prioritized subset for this run_ |
| 21 | 2026-02-16 | 2026-04-10 | addendum | OREF_002_Addendum_to_Sale_Agreement_1_EXECUTED_20260216.pdf | _not in prioritized subset for this run_ |
| 22 | 2026-02-16 | 2026-04-10 | addendum | OREF_022A_Buyers_Repair_Addendum_EXECUTED_20260216.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-03-03 | 2026-04-10 | amendment_or_notice | OREF_091_Notice_of_Real_Estate_Compensation_EXECUTED_20260303.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-03-13 | 2026-04-10 | inspection_or_repair | Notice_Completion_of_Repairs_RECEIVED_20260313.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 24 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 9 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 1.
- **PDF dual pipeline coverage**: 0 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Pre-Contract**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 19571 SW Simpson Ave, Bend, OR 97702

- **Folder id (`saleGuid`)**: `7075769c-90a6-4b94-a416-b9efa2ef5ddd`
- **MLS**: n/a
- **SkySlope status**: Canceled/App
- **Linked listingGuid**: n/a
- **Sale price / list price**: 750000 / 0
- **Contract acceptance**: n/a
- **Escrow closing**: 2026-03-19
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2026-02-03

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2026-02-03 | n/a | closing_adjacent | Things to Know Before Signing - 000A OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2026-02-03 | n/a | other_pdf | Real Estate Transaction Terms and Concepts 000C - OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2026-02-03 | n/a | buyer_offer_or_package | Advisory for Buyers and Sellers of Real Estate - 000B - OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2026-02-03 | n/a | buyer_offer_or_package | Advisory Regarding Electronic Funds - Buyer - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2026-02-03 | n/a | buyer_offer_or_package | Advisory Regarding Fair Housing - Buyer - 104 OREF.pdf | _not in prioritized subset for this run_ |
| 6 | 2026-02-03 | n/a | buyer_offer_or_package | Advisory Regarding Real Estate Compensation - Buyer - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2026-02-03 | n/a | buyer_offer_or_package | Advisory to Buyer Regarding Due Diligence - 058 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2026-02-03 | n/a | title_or_hoa | Advisory Regarding Title Insurance - Buyer - 103 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2026-02-03 | n/a | buyer_offer_or_package | Advisory Regarding Smoke and Carbon Monoxide Alarms - Buyer - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2026-02-03 | n/a | buyer_offer_or_package | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Buyer - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 11 | 2026-02-03 | n/a | closing_adjacent | Verification of Funds.pdf | _not in prioritized subset for this run_ |
| 12 | 2026-02-03 | n/a | addendum | Owner Association Addendum - 024 OREF.pdf | _not in prioritized subset for this run_ |
| 13 | 2026-02-03 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF.pdf | error: not_pdf_bytes |
| 14 | 2026-02-07 | n/a | closing_adjacent | Things to Know Before Signing - 000A OREF_2.pdf | _not in prioritized subset for this run_ |
| 15 | 2026-02-07 | n/a | buyer_offer_or_package | Advisory Regarding Fair Housing - Buyer - 104 OREF_2.pdf | _not in prioritized subset for this run_ |
| 16 | 2026-02-07 | n/a | buyer_offer_or_package | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Buyer - 108 OREF_2.pdf | _not in prioritized subset for this run_ |
| 17 | 2026-02-11 | n/a | buyer_offer_or_package | Advisory Regarding FIRPTA Tax - Buyer - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 18 | 2026-02-11 | n/a | seller_property_disclosure | Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 19 | 2026-02-12 | n/a | addendum | Addendum- Carpet Cleaning.pdf | _not in prioritized subset for this run_ |
| 20 | 2026-02-12 | n/a | other_pdf | Delivery of Assoc Docs.pdf | _not in prioritized subset for this run_ |
| 21 | 2026-02-16 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | error: not_pdf_bytes |
| 22 | 2026-02-16 | n/a | addendum | Buyers Repair Addendum - 022A _1_ OREF.pdf | _not in prioritized subset for this run_ |
| 23 | 2026-03-03 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 24 | 2026-03-13 | n/a | inspection_or_repair | Notice- Completion of Repairs.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 24 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 10 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 1.
- **PDF dual pipeline coverage**: 2 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 17130 Mayfield Drive, Bend, OR 97707

- **Folder id (`saleGuid`)**: `8b3033bd-59a8-4e67-9f31-b8566641fc07`
- **MLS**: 220205364
- **SkySlope status**: Closed
- **Linked listingGuid**: 212a55e0-c450-41ce-97b9-b3162db6a554
- **Sale price / list price**: 755000 / 0
- **Contract acceptance**: 2025-09-21
- **Escrow closing**: 2025-10-29
- **Actual closing**: 2026-04-04
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-09-22

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | Completed | 2025-09-22 | Sale_Agreement.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Completed | 2025-09-22 | Pre-Approval_Letter.pdf |
| 3 | Counter Offers  | Sales Documentation | Completed | 2025-09-22 | Counter-_Buyer_s_1.pdf; Counter-_Seller_s_2.pdf; Counter-_Seller_s_1.pdf |
| 4 | Sale Addendums  | Sales Documentation | Completed | 2025-09-22 | Septic_Addendum.pdf; Well_Addendum.pdf; Addendum-_Walk_Through.pdf; Addendum-_Credit.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | Completed | 2025-10-13 | Repair_Addendum-_Buyer_s.pdf; Repair_Addendum-_Seller_s.pdf |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Optional | n/a |  |
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
| 21 | Sellers Property Disclosures | Disclosures | Completed | 2025-10-15 | Property_Disclosures.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | Optional | n/a |  |
| 24 | Real Estate Compensation Advisory | Disclosures | Optional | n/a |  |
| 25 | FIRPTA Advisory | Disclosures | Optional | n/a |  |
| 26 | Real Estate Forms Advisory | Disclosures | Optional | n/a |  |
| 27 | Smoke Alarms Advisory | Disclosures | Optional | n/a |  |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Completed | 2025-10-17 | Broker_Demand.pdf |
| 35 | Earnest Money Receipt | Closing Documents | Completed | 2025-09-23 | EM_Receipt.pdf |
| 36 | Preliminary Title Report | Closing Documents | Completed | 2025-09-26 | Preliminary_Title_Report.pdf |
| 37 | Final HUD | Closing Documents | Completed | 2025-10-29 | Final_Sellers_Statement_IHLA.pdf |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | Optional | n/a |  |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Optional | n/a |  |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-03 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | pages=1, read=1, textLen=5628, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 2 | 2025-07-03 | 2025-07-05 | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-03 | 2025-07-05 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-03 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-03 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-07-03 | n/a | other_pdf | Advisory Regarding Fair Housing - Seller - 104 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-07-03 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-03 | n/a | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - Seller - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Hedberg_Disclosures_17130Mayfield_803.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-14 | 2025-07-14 | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-07-14 | 2025-07-14 | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-08-01 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_2.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-09-21 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF_2.pdf | error: not_pdf_bytes |
| 14 | 2025-09-21 | n/a | counter_or_counteroffer | Sellers Counter0ffer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 15 | 2025-09-21 | n/a | buyer_offer_or_package | Offer.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-09-22 | n/a | counter_or_counteroffer | Sellers Counteroffer 2 - 003 OREF.pdf | error: not_pdf_bytes |
| 17 | 2025-09-22 | n/a | counter_or_counteroffer | Sellers_Counter0ffer_1_-_003_OREF.pdf | error: not_pdf_bytes |
| 18 | 2025-09-22 | n/a | other_pdf | BCO1.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-09-22 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-09-22 | n/a | counter_or_counteroffer | Counter-_Buyer_s_1.pdf | error: not_pdf_bytes |
| 21 | 2025-09-22 | n/a | counter_or_counteroffer | Counter-_Seller_s_2.pdf | error: not_pdf_bytes |
| 22 | 2025-09-22 | n/a | counter_or_counteroffer | Counter-_Seller_s_1.pdf | error: not_pdf_bytes |
| 23 | 2025-09-22 | n/a | addendum | Septic_Addendum.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-09-22 | n/a | addendum | Well_Addendum.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-09-22 | n/a | addendum | Addendum-_Walk_Through.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-09-22 | n/a | lender_financing | Pre-Approval_Letter.pdf | _not in prioritized subset for this run_ |
| 27 | 2025-09-22 | n/a | addendum | Sellers Property Disclosure Statement Addendum _1_ - 028 OREF.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-09-22 | n/a | seller_property_disclosure | Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 29 | 2025-09-23 | n/a | addendum | Property Disclosure Addendum.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-09-23 | n/a | seller_property_disclosure | Property Disclosures_2.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-09-23 | n/a | other_pdf | EM_Receipt.pdf | _not in prioritized subset for this run_ |
| 32 | 2025-09-26 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 33 | 2025-10-02 | n/a | addendum | Addendum to Sale Agreement 2 - 002 OREF.pdf | error: not_pdf_bytes |
| 34 | 2025-10-02 | n/a | addendum | Sellers Repair Addendum - 022B _1_ OREF.pdf | _not in prioritized subset for this run_ |
| 35 | 2025-10-02 | n/a | addendum | Buyers_Repair_Addendum___1_25.pdf | _not in prioritized subset for this run_ |
| 36 | 2025-10-06 | n/a | addendum | Addendum-_Credit.pdf | _not in prioritized subset for this run_ |
| 37 | 2025-10-13 | n/a | addendum | Repair_Addendum-_Buyer_s.pdf | _not in prioritized subset for this run_ |
| 38 | 2025-10-13 | n/a | addendum | Repair_Addendum-_Seller_s.pdf | _not in prioritized subset for this run_ |
| 39 | 2025-10-15 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 40 | 2025-10-17 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 41 | 2025-10-17 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 42 | 2025-10-29 | n/a | closing_adjacent | Final_Sellers_Statement_IHLA.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 42 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 6 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 9 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 20473 Jacklight Lane, Bend, OR 97702

- **Folder id (`saleGuid`)**: `69b85dea-e733-4b81-80cc-bf46c0af17cf`
- **MLS**: 220198987
- **SkySlope status**: Closed
- **Linked listingGuid**: c9503d17-c569-42b3-841e-9651e13dec70
- **Sale price / list price**: 661000 / 0
- **Contract acceptance**: 2025-09-14
- **Escrow closing**: 2025-10-21
- **Actual closing**: 2025-10-21
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-09-15

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | Completed | 2025-09-15 | Sale_Agreement.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Completed | 2025-09-15 | Pre-approval_Letter.pdf |
| 3 | Counter Offers  | Sales Documentation | Completed | 2025-09-15 | Counter-_Buyer_s_3.pdf; Counter-_Seller_s_1.pdf; Counter-_Seller_s_2.pdf; Counter-_Seller_s_2_2.pdf; Counter-_Buyer_s_2.pdf |
| 4 | Sale Addendums  | Sales Documentation | Completed | 2025-10-07 | Addendum-_Close_10-10.pdf; Addendum-_Closing_10-21.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | Completed | 2025-09-25 | Rejected_Repair_Addendum.pdf |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Completed | 2025-09-15 | Association_Addendum.pdf |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | Optional | n/a |  |
| 11 | Contingency Removal Addendum  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy  | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale  | Sales Documentation | Completed | 2025-10-01 | Bill_of_Sale.pdf |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Completed | 2025-09-25 | Amendatory_Clause.pdf |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | Completed | 2025-10-07 | Property_Disclosures.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | Completed | 2025-09-15 | Wire_Fraud_Advsisory.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | Optional | n/a |  |
| 25 | FIRPTA Advisory | Disclosures | Optional | n/a |  |
| 26 | Real Estate Forms Advisory | Disclosures | Optional | n/a |  |
| 27 | Smoke Alarms Advisory | Disclosures | Optional | n/a |  |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Completed | 2025-10-06 | Broker_Demand.pdf |
| 35 | Earnest Money Receipt | Closing Documents | Completed | 2025-09-25 | EM_Receipt.pdf |
| 36 | Preliminary Title Report | Closing Documents | Completed | 2025-09-25 | Preliminary_Title_Report.pdf |
| 37 | Final HUD | Closing Documents | Completed | 2025-10-17 | Final_Sellers_Statement_IHLA.pdf |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | Optional | n/a |  |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Optional | n/a |  |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-05 | 2025-07-05 | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-05 | 2025-07-05 | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-05 | 2025-07-05 | listing_agreement | Exclusive Listing Agreement - ODS.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-09-03 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_2.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-09-13 | n/a | counter_or_counteroffer | 2_1 Counteroffer to Real Estate Purchase and Sale Agreement _1_ - OR.pdf | error: not_pdf_bytes |
| 8 | 2025-09-13 | n/a | earnest_or_wire | 2_DigiSign_10_5_Wire_Fraud_Advisory_-_OR.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-09-13 | n/a | other_pdf | 3_DigiSign_2_19_FHA___VA_Amendatory_Clause_-_OR.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-09-13 | n/a | other_pdf | 1_DigiSign_1_1_Oregon_Residential_Real_Estate_Purchase_And_Sale_Agreement_-_OR.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-09-13 | n/a | addendum | 4_DigiSign_4_4_Association_Addendum_-_OR.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-09-14 | n/a | counter_or_counteroffer | 2_1 Counteroffer to Real Estate Purchase and Sale Agreement _1_ - OR_2.pdf | error: not_pdf_bytes |
| 13 | 2025-09-14 | n/a | counter_or_counteroffer | counter 2.pdf | error: not_pdf_bytes |
| 14 | 2025-09-14 | n/a | counter_or_counteroffer | signed counters.pdf | error: not_pdf_bytes |
| 15 | 2025-09-15 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Buyer_s_3.pdf | error: not_pdf_bytes |
| 17 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Seller_s_1.pdf | error: not_pdf_bytes |
| 18 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Seller_s_2.pdf | error: not_pdf_bytes |
| 19 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Seller_s_2_2.pdf | error: not_pdf_bytes |
| 20 | 2025-09-15 | n/a | addendum | Association_Addendum.pdf | _not in prioritized subset for this run_ |
| 21 | 2025-09-15 | n/a | earnest_or_wire | Wire_Fraud_Advsisory.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-09-15 | n/a | counter_or_counteroffer | Counter-_Buyer_s_2.pdf | error: not_pdf_bytes |
| 23 | 2025-09-15 | n/a | other_pdf | Amendatory_Clause.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-09-15 | n/a | lender_financing | Pre-approval_Letter.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-09-17 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | error: not_pdf_bytes |
| 26 | 2025-09-23 | n/a | other_pdf | Amendatory Clause.pdf | _not in prioritized subset for this run_ |
| 27 | 2025-09-23 | n/a | other_pdf | Amendatory Clause_2.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-09-25 | n/a | inspection_or_repair | Brandon Hargous Repairs_2025-09-24 12_24_55.pdf | _not in prioritized subset for this run_ |
| 29 | 2025-09-25 | n/a | other_pdf | EM_Receipt.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-09-25 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-09-25 | n/a | addendum | Rejected_Repair_Addendum.pdf | _not in prioritized subset for this run_ |
| 32 | 2025-09-25 | n/a | other_pdf | Amendatory_Clause.pdf | _not in prioritized subset for this run_ |
| 33 | 2025-10-01 | n/a | other_pdf | New bill of sale.pdf | _not in prioritized subset for this run_ |
| 34 | 2025-10-01 | n/a | other_pdf | Bill_of_Sale.pdf | _not in prioritized subset for this run_ |
| 35 | 2025-10-06 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 36 | 2025-10-06 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 37 | 2025-10-07 | n/a | addendum | Addendum-_Close_10-10.pdf | _not in prioritized subset for this run_ |
| 38 | 2025-10-07 | n/a | addendum | Addendum- Close 10-10.pdf | _not in prioritized subset for this run_ |
| 39 | 2025-10-07 | n/a | addendum | Addendum-_Close_10-10.pdf | _not in prioritized subset for this run_ |
| 40 | 2025-10-07 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 41 | 2025-10-11 | n/a | addendum | Addendum - Closing Date.pdf | _not in prioritized subset for this run_ |
| 42 | 2025-10-15 | n/a | addendum | Addendum-_Closing_10-21.pdf | _not in prioritized subset for this run_ |
| 43 | 2025-10-17 | n/a | closing_adjacent | Final_Sellers_Statement_IHLA.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 43 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 9 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 10 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 2354 NW NW Drouillard Ave, Bend, OR 97703

- **Folder id (`saleGuid`)**: `c9fcc145-311d-4a92-b23e-0ff6e61b126a`
- **MLS**: 220200647
- **SkySlope status**: Closed
- **Linked listingGuid**: dbf8e511-fc61-4caa-b5ea-e9ba9c7c8ff7
- **Sale price / list price**: 1715000 / 0
- **Contract acceptance**: 2025-08-27
- **Escrow closing**: 2025-10-10
- **Actual closing**: 2025-10-27
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-09-05

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | Completed | 2025-09-05 | Sale_Agreement.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Completed | 2025-09-05 | Pre-approval_Letter.pdf |
| 3 | Counter Offers  | Sales Documentation | Optional | n/a |  |
| 4 | Sale Addendums  | Sales Documentation | In Review | 2025-09-05 | Addendum_A-_SF.pdf; Addendum-_Credit.pdf; Addendum_B-_Bidet.pdf; Addendum-_Personal_Property.pdf; Addendum-_Voided_Credit.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | In Review | 2025-09-12 | Repair_Addendum-_Buyer_s.pdf; Repair_Addendum-_Seller_s.pdf |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Completed | 2025-09-06 | did-you-see-that-comment.pdf |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | Optional | n/a |  |
| 11 | Contingency Removal Addendum  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy  | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale  | Sales Documentation | Optional | n/a |  |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Optional | n/a |  |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | In Review | 2025-10-06 | Plumbing_Service_Report.pdf |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | Completed | 2025-09-15 | Property_Disclosures.pdf; Addendum-_SPD.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | Completed | 2025-09-06 | Wire_Fraud_Advisory.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | Completed | 2025-09-19 | Compensation_Advisory.pdf |
| 25 | FIRPTA Advisory | Disclosures | Completed | 2025-09-19 | FIRPTA_Advisory.pdf |
| 26 | Real Estate Forms Advisory | Disclosures | Completed | 2025-09-19 | Forms_Advisory.pdf |
| 27 | Smoke Alarms Advisory | Disclosures | Completed | 2025-09-19 | Alarm_Advisory.pdf |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Completed | 2025-10-03 | Broker_Demand.pdf; Broker_Demand-_Revised.pdf |
| 35 | Earnest Money Receipt | Closing Documents | Completed | 2025-09-08 | EM_Reciept.pdf |
| 36 | Preliminary Title Report | Closing Documents | Completed | 2025-09-08 | Preliminary_Title_Report.pdf |
| 37 | Final HUD | Closing Documents | Completed | 2025-10-14 | Final_Seller_s_Statement.pdf |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | Completed | 2025-09-06 | Initial_Agency_Pamphlet.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Completed | 2025-09-06 | did-you-see-that-comment_2.pdf |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-03 | n/a | other_pdf | 9_2 Disclosed Limited Agency Agreement - OR.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-03 | n/a | counter_or_counteroffer | seller counter 2 Drouillard.pdf | error: not_pdf_bytes |
| 3 | 2025-07-03 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 4 | 2025-07-03 | n/a | counter_or_counteroffer | Sellers Counter Offer 3 - 003 OREF.pdf | error: not_pdf_bytes |
| 5 | 2025-07-03 | n/a | counter_or_counteroffer | Sellers Counter Offer 2 - 003 OREF.pdf | error: not_pdf_bytes |
| 6 | 2025-07-03 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 1_25.pdf | pages=15, read=12, textLen=133409, 15 pg · read 12 · rich · Digi×12 Docu×24 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 7 | 2025-07-03 | 2025-07-08 | agency_disclosure_pamphlet | 10_4 Initial Agency Disclosure Pamphlet _Seller_ - OR.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-03 | n/a | other_pdf | membership-change-form-10_22_24.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-03 | 2025-07-08 | listing_agreement | 9_3 Exclusive Listing Agreement - OR.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-03 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF_2.pdf | error: not_pdf_bytes |
| 11 | 2025-07-03 | 2025-07-31 | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-07-03 | n/a | counter_or_counteroffer | Buyers Counteroffer.pdf | error: not_pdf_bytes |
| 13 | 2025-07-03 | 2025-07-08 | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-07-03 | n/a | other_pdf | Vitzthum-2354_NW_Drouillard_Ave_pdf copy.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-07-10 | 2025-07-31 | seller_property_disclosure | 3_1 Seller Property Disclosure Statement - OR.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-07-31 | 2025-07-31 | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_2.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-08-22 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_3.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-08-27 | n/a | earnest_or_wire | MLSCO_Wire_Fraud_Advisory_-_ODS.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-08-27 | n/a | lender_financing | Preapproval  for 1_7.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-08-27 | n/a | addendum | Addendum_to_Sale_Agreement_1_-_002_OREF.pdf | error: not_pdf_bytes |
| 21 | 2025-08-27 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-08-27 | n/a | addendum | Drouillard_Addendum_to_Sale_Agreement_1_-_002_OREF_936.pdf | error: not_pdf_bytes |
| 23 | 2025-08-27 | n/a | earnest_or_wire | MLSCO_Wire_Fraud_Advisory_-_ODS_231.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-08-27 | n/a | lender_financing | Preapproval__for_1_7_504.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-08-27 | n/a | sale_agreement_or_rsa | Drouillard_Residential_Real_Estate_Sale_Agreement_-_001_OREF_952.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-08-29 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS_4.pdf | _not in prioritized subset for this run_ |
| 27 | 2025-08-29 | n/a | seller_property_disclosure | Drouillard Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-08-29 | n/a | addendum | 9_9 Addendum for Agent Documents - OR.pdf | error: not_pdf_bytes |
| 29 | 2025-09-05 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-09-05 | n/a | lender_financing | Pre-approval_Letter.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-09-05 | n/a | addendum | Addendum_A-_SF.pdf | error: not_pdf_bytes |
| 32 | 2025-09-05 | n/a | addendum | Addendum to Sale Agreement 2 - 002 OREF.pdf | error: not_pdf_bytes |
| 33 | 2025-09-05 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | error: not_pdf_bytes |
| 34 | 2025-09-05 | n/a | addendum | Sellers Repair Addendum - 022B _1_ OREF.pdf | error: not_pdf_bytes |
| 35 | 2025-09-06 | n/a | agency_disclosure_pamphlet | Initial_Agency_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 36 | 2025-09-06 | n/a | earnest_or_wire | Wire_Fraud_Advisory.pdf | _not in prioritized subset for this run_ |
| 37 | 2025-09-06 | n/a | other_pdf | did-you-see-that-comment.pdf | _not in prioritized subset for this run_ |
| 38 | 2025-09-06 | n/a | other_pdf | did-you-see-that-comment_2.pdf | _not in prioritized subset for this run_ |
| 39 | 2025-09-06 | n/a | other_pdf | Advisory_Real_Estate_Comp.pdf | _not in prioritized subset for this run_ |
| 40 | 2025-09-08 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 41 | 2025-09-08 | n/a | other_pdf | EM_Reciept.pdf | _not in prioritized subset for this run_ |
| 42 | 2025-09-08 | n/a | addendum | Buyers_Repair_Addendum_-_022A__1__OREF.pdf | error: not_pdf_bytes |
| 43 | 2025-09-09 | n/a | addendum | Addendum- Credit.pdf | error: not_pdf_bytes |
| 44 | 2025-09-09 | n/a | addendum | Repair Addendum- Buyer_s.pdf | error: not_pdf_bytes |
| 45 | 2025-09-09 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF_2025-09-09 09_13_16.pdf | error: not_pdf_bytes |
| 46 | 2025-09-09 | n/a | addendum | Addendum to Sale Agreement 3 - 002 OREF_2025-09-09 09_12_33.pdf | error: not_pdf_bytes |
| 47 | 2025-09-09 | n/a | addendum | Sellers Repair Addendum - 022B _1_ OREF_2.pdf | _not in prioritized subset for this run_ |
| 48 | 2025-09-10 | n/a | addendum | Addendum- Credit_2.pdf | _not in prioritized subset for this run_ |
| 49 | 2025-09-12 | n/a | addendum | Addendum-_Credit.pdf | _not in prioritized subset for this run_ |
| 50 | 2025-09-12 | n/a | addendum | Addendum_B-_Bidet.pdf | _not in prioritized subset for this run_ |
| 51 | 2025-09-12 | n/a | addendum | Repair_Addendum-_Buyer_s.pdf | _not in prioritized subset for this run_ |
| 52 | 2025-09-12 | n/a | addendum | Repair_Addendum-_Seller_s.pdf | _not in prioritized subset for this run_ |
| 53 | 2025-09-15 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 54 | 2025-09-15 | n/a | addendum | Addendum-_SPD.pdf | _not in prioritized subset for this run_ |
| 55 | 2025-09-19 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 56 | 2025-09-19 | n/a | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - Seller - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 57 | 2025-09-19 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 58 | 2025-09-19 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 59 | 2025-09-19 | n/a | other_pdf | Alarm_Advisory.pdf | _not in prioritized subset for this run_ |
| 60 | 2025-09-19 | n/a | other_pdf | Compensation_Advisory.pdf | _not in prioritized subset for this run_ |
| 61 | 2025-09-19 | n/a | other_pdf | FIRPTA_Advisory.pdf | _not in prioritized subset for this run_ |
| 62 | 2025-09-19 | n/a | other_pdf | Forms_Advisory.pdf | _not in prioritized subset for this run_ |
| 63 | 2025-09-30 | n/a | addendum | Addendum to Sale Agreement 5 - 002 OREF.pdf | error: not_pdf_bytes |
| 64 | 2025-10-02 | n/a | addendum | Addendum to Sale Agreement 4 - 002 OREF.pdf | error: not_pdf_bytes |
| 65 | 2025-10-02 | n/a | addendum | Addendum to Sale Agreement 6 - 002 OREF.pdf | error: not_pdf_bytes |
| 66 | 2025-10-03 | n/a | addendum | Addendum-_Personal_Property.pdf | _not in prioritized subset for this run_ |
| 67 | 2025-10-03 | n/a | addendum | Addendum-_Voided_Credit.pdf | _not in prioritized subset for this run_ |
| 68 | 2025-10-03 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 69 | 2025-10-03 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 70 | 2025-10-03 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF_2.pdf | _not in prioritized subset for this run_ |
| 71 | 2025-10-06 | n/a | other_pdf | Plumbing_Service_Report.pdf | _not in prioritized subset for this run_ |
| 72 | 2025-10-06 | n/a | other_pdf | Plumbing_Service_Report_196.pdf | _not in prioritized subset for this run_ |
| 73 | 2025-10-07 | n/a | other_pdf | Broker_Demand-_Revised.pdf | _not in prioritized subset for this run_ |
| 74 | 2025-10-14 | n/a | closing_adjacent | Final_Seller_s_Statement.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 74 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 6 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 3.
- **PDF dual pipeline coverage**: 22 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 2680 NW Nordic Avenue, Bend, OR 97703

- **Folder id (`saleGuid`)**: `ce3c30de-1b10-4946-bf06-6dbad8e1d53d`
- **MLS**: 220184043
- **SkySlope status**: Closed
- **Linked listingGuid**: n/a
- **Sale price / list price**: 1320000 / 0
- **Contract acceptance**: 2025-08-26
- **Escrow closing**: 2025-10-10
- **Actual closing**: 2025-10-10
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-09-05

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | Completed | 2025-09-05 | Sale_Agreement.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Completed | 2025-09-05 | Pre-approval_Letter.pdf; Approval_Letter__1_.pdf |
| 3 | Counter Offers  | Sales Documentation | Completed | 2025-09-05 | Counter-_Buyer_s_1.pdf; Counter-_Seller_s_1.pdf |
| 4 | Sale Addendums  | Sales Documentation | In Review | 2025-09-19 | Addendum-_Rej_Basement.pdf; Addendum-_Rej_Price.pdf; Addendum-_Updates_1.pdf; Nordic_Pricing_Rationale.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | Optional | n/a |  |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Completed | 2025-09-12 | did-you-see-that-comment.pdf |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | Optional | n/a |  |
| 11 | Contingency Removal Addendum  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy  | Sales Documentation | In Review | 2025-09-19 | Agreement_to_Occupy-_Rejected.pdf |
| 13 | Bill Of Sale  | Sales Documentation | Optional | n/a |  |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Optional | n/a |  |
| 15 | Contingent Right To Purchase  | Sales Documentation | Completed | 2025-09-05 | Contingent_Right_to_Purchase.pdf |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Completed | 2025-09-05 | Notice_to_Seller.pdf |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | In Review | 2025-09-19 | Property_Disclosures.pdf; Property_Disclosure_Addendum.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | In Review | 2025-09-19 | Electronic_Funds_Advisory.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | In Review | 2025-09-05 | Advisory_Real_Estate_Comp.pdf |
| 25 | FIRPTA Advisory | Disclosures | In Review | 2025-09-19 | Firpta_Advisory.pdf |
| 26 | Real Estate Forms Advisory | Disclosures | In Review | 2025-09-19 | Forms_Advisory.pdf |
| 27 | Smoke Alarms Advisory | Disclosures | In Review | 2025-09-19 | Advisory-_Alarm.pdf |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | In Review | 2025-10-03 | Broker_Demand.pdf |
| 35 | Earnest Money Receipt | Closing Documents | Completed | 2025-09-12 | EM_Receipt.pdf |
| 36 | Preliminary Title Report | Closing Documents | Completed | 2025-09-12 | _OR__Preliminary_Title_Report_-N.pdf |
| 37 | Final HUD | Closing Documents | In Review | 2025-10-10 | ALTA_Settlement_Buyer.pdf |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | In Review | 2025-09-19 | OREA_Pamphlet.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Completed | 2025-09-05 | Buyer_Representation_Agreement.pdf |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | In Review | 2025-09-19 | Disclosed_Limited_Agency_2.pdf |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-09-05 | n/a | addendum | Addendum to Sale Agreement 4 - 002 OREF.pdf | pages=1, read=1, textLen=5526, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 2 | 2025-09-05 | n/a | termination_or_release | Termination Agreement - 057 OREF.pdf | pages=1, read=1, textLen=5795, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 3 | 2025-09-05 | n/a | counter_or_counteroffer | Buyers Counter Offer 2 - 004 OREF.pdf | error: not_pdf_bytes |
| 4 | 2025-09-05 | n/a | addendum | Addendum to Sale Agreement - 1_25.pdf | pages=1, read=1, textLen=3964, 1 pg · rich · Digi×1 Docu×2 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 5 | 2025-09-05 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF.pdf | pages=15, read=12, textLen=135778, 15 pg · read 12 · rich · Digi×12 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 6 | 2025-09-05 | n/a | counter_or_counteroffer | Sellers_Counteroffer___1_25 _8_.pdf | error: not_pdf_bytes |
| 7 | 2025-09-05 | n/a | buyer_offer_or_package | MS - Buyers Contingent Right to Purchase - to be rejected _ rewritten.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-09-05 | n/a | addendum | Addendum to Sale Agreement 3 - 002 OREF.pdf | pages=1, read=1, textLen=5527, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 9 | 2025-09-05 | n/a | counter_or_counteroffer | Buyers Counter Offer 1 - 004 OREF.pdf | error: not_pdf_bytes |
| 10 | 2025-09-05 | n/a | buyer_offer_or_package | Buyers Contingent Right to Purchase - 083 OREF.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-09-05 | n/a | counter_or_counteroffer | Buyers Counter Offer 1 - 004 OREF_2.pdf | error: not_pdf_bytes |
| 12 | 2025-09-05 | n/a | buyer_offer_or_package | Advisory Regarding Real Estate Compensation - Buyer - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-09-05 | n/a | counter_or_counteroffer | Sellers Counteroffer - 1_25.pdf | error: not_pdf_bytes |
| 14 | 2025-09-05 | n/a | termination_or_release | Contingent Right to Purchase - Notice to Seller - 083A OREF.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-09-05 | n/a | addendum | Buyers Repair Addendum - 022A _1_ OREF.pdf | error: not_pdf_bytes |
| 16 | 2025-09-05 | n/a | addendum | Addendum_to_Sale_Agreement___1_25 _1_.pdf | error: not_pdf_bytes |
| 17 | 2025-09-05 | n/a | listing_agreement | Buyer Representation Agreement - Exclusive - 050 OREF.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-09-05 | n/a | buyer_offer_or_package | Buyers Contingent Right to Purchase - 083 OREF_2.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-09-05 | n/a | addendum | Sellers_Repair_Addendum___1_25.pdf | error: not_pdf_bytes |
| 20 | 2025-09-05 | n/a | addendum | Nordic Addendum_to_Sale_Agreement_2_-_002_OREF.pdf | error: not_pdf_bytes |
| 21 | 2025-09-05 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF_2.pdf | pages=16, read=12, textLen=135911, 16 pg · read 12 · rich · Digi×12 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 22 | 2025-09-05 | n/a | counter_or_counteroffer | Sellers_Counteroffer___1_25__8_.pdf | error: not_pdf_bytes |
| 23 | 2025-09-05 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-09-05 | n/a | addendum | Addendum to Sale Agreement 2 - 002 OREF.pdf | error: not_pdf_bytes |
| 25 | 2025-09-05 | n/a | counter_or_counteroffer | Sellers Counteroffer - 1_25_2.pdf | error: not_pdf_bytes |
| 26 | 2025-09-05 | n/a | addendum | Contingency_Removal_Addendum___3_25.pdf | error: not_pdf_bytes |
| 27 | 2025-09-05 | n/a | lender_financing | Approval Letter.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-09-05 | n/a | counter_or_counteroffer | FB Sellers_Counteroffer___1_25.pdf | error: not_pdf_bytes |
| 29 | 2025-09-05 | n/a | listing_agreement | Buyer Representation Agreement - Exclusive - 050 OREF_2.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-09-05 | n/a | addendum | Buyers_Contingent_Right_to_Purchase_Addendum__1_25.pdf | error: not_pdf_bytes |
| 31 | 2025-09-05 | n/a | buyer_offer_or_package | Disclosed Limited Agency Agreement for Buyers - 041 OREF.pdf | _not in prioritized subset for this run_ |
| 32 | 2025-09-05 | n/a | addendum | NORDIC Buyers Contingent Right to Purchase Addendum- 1_25.pdf | error: not_pdf_bytes |
| 33 | 2025-09-05 | n/a | counter_or_counteroffer | Buyer Counter - Nordic 2_2025-08-26 19_15_01 _1_.pdf | error: not_pdf_bytes |
| 34 | 2025-09-05 | n/a | buyer_offer_or_package | Buyers_Contingent_Right_to_Purchase_-_083_OREF.pdf | _not in prioritized subset for this run_ |
| 35 | 2025-09-05 | n/a | counter_or_counteroffer | Buyer Counter - Nordic 2_2025-08-26 19_15_01.pdf | error: not_pdf_bytes |
| 36 | 2025-09-05 | n/a | counter_or_counteroffer | Buyer Counter - Nordic 2_2025-08-26 19_15_01_2.pdf | error: not_pdf_bytes |
| 37 | 2025-09-05 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF _1_.pdf | _not in prioritized subset for this run_ |
| 38 | 2025-09-05 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF _1__2.pdf | _not in prioritized subset for this run_ |
| 39 | 2025-09-05 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 40 | 2025-09-05 | n/a | lender_financing | Pre-approval_Letter.pdf | _not in prioritized subset for this run_ |
| 41 | 2025-09-05 | n/a | counter_or_counteroffer | Counter-_Buyer_s_1.pdf | error: not_pdf_bytes |
| 42 | 2025-09-05 | n/a | counter_or_counteroffer | Counter-_Seller_s_1.pdf | error: not_pdf_bytes |
| 43 | 2025-09-05 | n/a | buyer_offer_or_package | Buyer_Representation_Agreement.pdf | _not in prioritized subset for this run_ |
| 44 | 2025-09-05 | n/a | other_pdf | Contingent_Right_to_Purchase.pdf | _not in prioritized subset for this run_ |
| 45 | 2025-09-05 | n/a | other_pdf | Disclosed_Limited_Agency.pdf | _not in prioritized subset for this run_ |
| 46 | 2025-09-05 | n/a | amendment_or_notice | Notice_to_Seller.pdf | _not in prioritized subset for this run_ |
| 47 | 2025-09-05 | n/a | other_pdf | Advisory_Real_Estate_Comp.pdf | _not in prioritized subset for this run_ |
| 48 | 2025-09-12 | n/a | other_pdf | did-you-see-that-comment.pdf | _not in prioritized subset for this run_ |
| 49 | 2025-09-12 | n/a | other_pdf | EM_Receipt.pdf | _not in prioritized subset for this run_ |
| 50 | 2025-09-12 | n/a | title_or_hoa | _OR__Preliminary_Title_Report_-N.pdf | _not in prioritized subset for this run_ |
| 51 | 2025-09-13 | n/a | other_pdf | Approval_Letter__1_.pdf | _not in prioritized subset for this run_ |
| 52 | 2025-09-16 | n/a | buyer_offer_or_package | Notice from Buyer to Seller 2 - 109 OREF.pdf | _not in prioritized subset for this run_ |
| 53 | 2025-09-17 | n/a | addendum | Addendum to Sale Agreement 5 - 002 OREF.pdf | error: not_pdf_bytes |
| 54 | 2025-09-18 | n/a | addendum | Addendum to Sale Agreement 5 - 002 OREF_2.pdf | error: not_pdf_bytes |
| 55 | 2025-09-18 | n/a | other_pdf | Nordic Pricing Rationale.pdf | _not in prioritized subset for this run_ |
| 56 | 2025-09-18 | n/a | addendum | Addendum_to_Sale_Agreement_5_-_002_OREF_257.pdf | _not in prioritized subset for this run_ |
| 57 | 2025-09-18 | n/a | other_pdf | Nordic_Pricing_Rationale_129.pdf | _not in prioritized subset for this run_ |
| 58 | 2025-09-18 | n/a | addendum | _2__Addendum_to_Sale_Agreement_-_1_25_577.pdf | _not in prioritized subset for this run_ |
| 59 | 2025-09-18 | n/a | other | image_351.png | _not in prioritized subset for this run_ |
| 60 | 2025-09-18 | n/a | addendum | Addendum_to_Sale_Agreement_5_-_002_OREF_727.pdf | _not in prioritized subset for this run_ |
| 61 | 2025-09-18 | n/a | other_pdf | Nordic_Pricing_Rationale_677.pdf | _not in prioritized subset for this run_ |
| 62 | 2025-09-18 | n/a | buyer_offer_or_package | 9-17_Buyers_Letter_110.docx | _not in prioritized subset for this run_ |
| 63 | 2025-09-18 | n/a | buyer_offer_or_package | 9-17_Buyers_Letter_928.pdf | _not in prioritized subset for this run_ |
| 64 | 2025-09-18 | n/a | buyer_offer_or_package | Notice_from_Buyer_to_Seller_2_-_109_OREF_278.pdf | _not in prioritized subset for this run_ |
| 65 | 2025-09-18 | n/a | addendum | Addendum to Sale Agreement 6 - 002 OREF.pdf | error: not_pdf_bytes |
| 66 | 2025-09-18 | n/a | other_pdf | Agreement to Occupy Before Closing - 053 OREF.pdf | _not in prioritized subset for this run_ |
| 67 | 2025-09-18 | n/a | addendum | Addendum_to_Sale_Agreement_6_-_002_OREF_638.pdf | _not in prioritized subset for this run_ |
| 68 | 2025-09-18 | n/a | other_pdf | Agreement_to_Occupy_Before_Closing_-_053_OREF_989.pdf | _not in prioritized subset for this run_ |
| 69 | 2025-09-19 | n/a | other_pdf | Agreement_to_Occupy_Before_Closing_-_053_OREF__1__143.pdf | _not in prioritized subset for this run_ |
| 70 | 2025-09-19 | n/a | addendum | Addendum_to_Sale_Agreement_6_-_002_OREF_416.pdf | _not in prioritized subset for this run_ |
| 71 | 2025-09-19 | n/a | other_pdf | _2__Agreement_to_Occupy_Before_Closing___1_25_513.pdf | _not in prioritized subset for this run_ |
| 72 | 2025-09-19 | n/a | addendum | Addendum_to_Sale_Agreement___1_25__10__785.pdf | _not in prioritized subset for this run_ |
| 73 | 2025-09-19 | n/a | seller_property_disclosure | Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 74 | 2025-09-19 | n/a | buyer_offer_or_package | Advisory Regarding FIRPTA Tax - Buyer - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 75 | 2025-09-19 | n/a | buyer_offer_or_package | Advisory Regarding Electronic Funds - Buyer - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 76 | 2025-09-19 | n/a | agency_disclosure_pamphlet | OREA Pamphlet.pdf | _not in prioritized subset for this run_ |
| 77 | 2025-09-19 | n/a | addendum | Property Disclosure Addendum.pdf | _not in prioritized subset for this run_ |
| 78 | 2025-09-19 | n/a | buyer_offer_or_package | Advisory Regarding Smoke and Carbon Monoxide Alarms - Buyer - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 79 | 2025-09-19 | n/a | other_pdf | Disclosed Limited Agency.pdf | _not in prioritized subset for this run_ |
| 80 | 2025-09-19 | n/a | buyer_offer_or_package | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Buyer - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 81 | 2025-09-19 | n/a | other_pdf | Agreement to Occupy.pdf | _not in prioritized subset for this run_ |
| 82 | 2025-09-19 | n/a | addendum | Addendum- Updates 1.pdf | _not in prioritized subset for this run_ |
| 83 | 2025-09-19 | n/a | other_pdf | Firpta_Advisory.pdf | _not in prioritized subset for this run_ |
| 84 | 2025-09-19 | n/a | other_pdf | Forms_Advisory.pdf | _not in prioritized subset for this run_ |
| 85 | 2025-09-19 | n/a | other_pdf | Advisory-_Alarm.pdf | _not in prioritized subset for this run_ |
| 86 | 2025-09-19 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 87 | 2025-09-19 | n/a | other_pdf | Electronic_Funds_Advisory.pdf | _not in prioritized subset for this run_ |
| 88 | 2025-09-19 | n/a | other_pdf | Agreement_to_Occupy-_Rejected.pdf | _not in prioritized subset for this run_ |
| 89 | 2025-09-19 | n/a | other_pdf | Disclosed_Limited_Agency_2.pdf | _not in prioritized subset for this run_ |
| 90 | 2025-09-19 | n/a | addendum | Addendum-_Rej_Basement.pdf | _not in prioritized subset for this run_ |
| 91 | 2025-09-19 | n/a | addendum | Addendum-_Rej_Price.pdf | _not in prioritized subset for this run_ |
| 92 | 2025-09-19 | n/a | addendum | Addendum-_Updates_1.pdf | _not in prioritized subset for this run_ |
| 93 | 2025-09-19 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 94 | 2025-09-19 | n/a | addendum | Property_Disclosure_Addendum.pdf | _not in prioritized subset for this run_ |
| 95 | 2025-09-19 | n/a | other_pdf | Nordic_Pricing_Rationale.pdf | _not in prioritized subset for this run_ |
| 96 | 2025-09-20 | n/a | addendum | Addendum to Sale Agreement 6 - 002 OREF_2.pdf | error: not_pdf_bytes |
| 97 | 2025-09-20 | n/a | other_pdf | Agreement to Occupy Before Closing - 053 OREF_2.pdf | _not in prioritized subset for this run_ |
| 98 | 2025-09-22 | n/a | other_pdf | Release of Funds.pdf | pages=1, read=1, textLen=6676, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present |
| 99 | 2025-09-25 | n/a | addendum | SS_-_SPDs_Addendum__2__346.pdf | _not in prioritized subset for this run_ |
| 100 | 2025-09-25 | n/a | seller_property_disclosure | SS_-_SPDs__5__396.pdf | _not in prioritized subset for this run_ |
| 101 | 2025-09-25 | n/a | addendum | Sellers_Property_Disclosure_Statement_Addendum___1_25_349.pdf | _not in prioritized subset for this run_ |
| 102 | 2025-10-03 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 103 | 2025-10-03 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 104 | 2025-10-10 | n/a | buyer_offer_or_package | ALTA_Settlement_Buyer.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 104 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 16 ("offer" family). **Counter-like**: 13 (includes OREF counter forms when matched). **Termination/release-like**: 2. **RSA / sale agreement-like**: 4.
- **PDF dual pipeline coverage**: 32 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 64350 Old Bend Redmond Hwy, Bend, OR 97703

- **Folder id (`saleGuid`)**: `18380841-dce0-4db4-ad63-74c848020266`
- **MLS**: 220205567
- **SkySlope status**: Closed
- **Linked listingGuid**: a28589fc-3915-4a92-86e6-c08355147398
- **Sale price / list price**: 1030000 / 0
- **Contract acceptance**: 2025-08-27
- **Escrow closing**: 2025-09-25
- **Actual closing**: 2025-09-25
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-08-29

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | Completed | 2025-08-29 | Sale_Agreement.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Completed | 2025-08-29 | Pre-approval_Letter.pdf |
| 3 | Counter Offers  | Sales Documentation | Completed | 2025-08-29 | Counter-_Seller_s.pdf; Counter-_Seller_s_2.pdf |
| 4 | Sale Addendums  | Sales Documentation | Completed | 2025-08-29 | Well_Addendum.pdf; Septic_Addendum.pdf; Addendum_1-_Price.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | Completed | 2025-09-09 | Repair_Addendum-_Buyer_s_1.pdf; Repair_Addendum-_Seller_s.pdf; Repair_Addendum-_Buyer_s_2.pdf |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Completed | 2025-08-29 | did-you-see-that-comment_2.pdf |
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
| 21 | Sellers Property Disclosures | Disclosures | Completed | 2025-09-02 | Property_Disclosures.pdf; Property_Disclosure_Addendum.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | Completed | 2025-08-29 | Advisory-_Electronic_Funds.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | Completed | 2025-08-29 | Advisory-_RE_Compensation.pdf |
| 25 | FIRPTA Advisory | Disclosures | Completed | 2025-08-29 | Advisory-_Firpta.pdf |
| 26 | Real Estate Forms Advisory | Disclosures | Completed | 2025-08-29 | Advisory-_Forms.pdf |
| 27 | Smoke Alarms Advisory | Disclosures | Completed | 2025-08-29 | Advisory-_Alarms.pdf |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Completed | 2025-09-25 | Broker_Demand.pdf |
| 35 | Earnest Money Receipt | Closing Documents | Completed | 2025-09-08 | EM.pdf |
| 36 | Preliminary Title Report | Closing Documents | Completed | 2025-09-02 | Preliminary_Title_Report.pdf |
| 37 | Final HUD | Closing Documents | Completed | 2025-09-25 | Final_Sellers_Statement_IHLA.pdf |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | Completed | 2025-08-29 | OREA_Pamphlet.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Completed | 2025-08-29 | did-you-see-that-comment.pdf |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2010-06-08 | 2015-02-18 | other | 2025_Admin | _not in prioritized subset for this run_ |
| 2 | 2010-06-08 | n/a | other | 2025_Trash | _not in prioritized subset for this run_ |
| 3 | 2025-07-09 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-09 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Fair Housing - Seller - 104 OREF.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-07-09 | n/a | title_or_hoa | Advisory Regarding Title Insurance - Seller - 103 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-09 | n/a | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - Seller - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-09 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-07-09 | n/a | other_pdf | 1d9f4bf5ae604e458b7a4718342463c3_960.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-07-14 | n/a | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-07-15 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-08-05 | n/a | buyer_offer_or_package | Buyer_Signed_offer_on_OBRH.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-08-05 | n/a | buyer_offer_or_package | Buyer_Signed_offer_on_OBRH_2.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-08-05 | n/a | lender_financing | Offer_1_PreApproval.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-08-05 | n/a | buyer_offer_or_package | Offer_1_Final_Agency_Acknowledgement.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-08-05 | n/a | buyer_offer_or_package | Offer_1_Residential_Real_Estate_Agreement.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-08-05 | n/a | addendum | Offer_1_Well_Addendum.pdf | error: not_pdf_bytes |
| 21 | 2025-08-05 | n/a | buyer_offer_or_package | Offer_1_On_Site_Sewage.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-08-05 | n/a | earnest_or_wire | Offer_1_Wire_Fraud.pdf | _not in prioritized subset for this run_ |
| 23 | 2025-08-06 | n/a | addendum | Addendum- Terms.pdf | error: not_pdf_bytes |
| 24 | 2025-08-06 | n/a | addendum | Well Addendum.pdf | error: not_pdf_bytes |
| 25 | 2025-08-06 | n/a | other_pdf | Proof of Funds.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-08-06 | n/a | addendum | Septic Addendum.pdf | error: not_pdf_bytes |
| 27 | 2025-08-06 | n/a | sale_agreement_or_rsa | Sale Agreement.pdf | pages=15, read=12, textLen=136863, 15 pg · read 12 · rich · Digi×24 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 28 | 2025-08-06 | n/a | closing_adjacent | Letter to boardwalk house.pdf | _not in prioritized subset for this run_ |
| 29 | 2025-08-06 | 2025-08-06 | other_pdf | Listing_Contract.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-08-06 | 2025-08-06 | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-08-06 | 2025-08-06 | other_pdf | Data_Pages.pdf | _not in prioritized subset for this run_ |
| 32 | 2025-08-06 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 33 | 2025-08-06 | n/a | other_pdf | Proof_of_Funds.pdf | _not in prioritized subset for this run_ |
| 34 | 2025-08-06 | n/a | addendum | Addendum-_AP.pdf | error: not_pdf_bytes |
| 35 | 2025-08-06 | n/a | other_pdf | Advisory-_Electronic_Funds.pdf | _not in prioritized subset for this run_ |
| 36 | 2025-08-06 | n/a | other_pdf | Advisory-_RE_Compensation.pdf | _not in prioritized subset for this run_ |
| 37 | 2025-08-06 | n/a | other_pdf | Advisory-_Firpta.pdf | _not in prioritized subset for this run_ |
| 38 | 2025-08-06 | n/a | other_pdf | Advisory-_Forms.pdf | _not in prioritized subset for this run_ |
| 39 | 2025-08-06 | n/a | other_pdf | Advisory-_Alarms.pdf | _not in prioritized subset for this run_ |
| 40 | 2025-08-06 | n/a | addendum | Well_Addendum.pdf | error: not_pdf_bytes |
| 41 | 2025-08-06 | n/a | addendum | Septic_Addendum.pdf | error: not_pdf_bytes |
| 42 | 2025-08-06 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 43 | 2025-08-06 | n/a | addendum | Septic_Addendum.pdf | error: not_pdf_bytes |
| 44 | 2025-08-06 | n/a | addendum | Well_Addendum.pdf | error: not_pdf_bytes |
| 45 | 2025-08-06 | n/a | other | img_156940d0-9c45-4517-b182-1e155c31281c_395.png | _not in prioritized subset for this run_ |
| 46 | 2025-08-06 | n/a | other | img_102795a3-efb8-44e4-a58f-653c1bff4fec_120.png | _not in prioritized subset for this run_ |
| 47 | 2025-08-06 | n/a | other | img_2e65b90d-af86-463a-852b-97a1f645fa04_217.png | _not in prioritized subset for this run_ |
| 48 | 2025-08-06 | n/a | other | img_736cb534-786b-4a09-af3a-641369977d65_489.png | _not in prioritized subset for this run_ |
| 49 | 2025-08-06 | n/a | other | img_212beb6b-a937-46c1-95f2-6ad7e6030612_586.png | _not in prioritized subset for this run_ |
| 50 | 2025-08-06 | n/a | other | img_6ed6b692-2ea7-433a-bbd7-8e42a52f2965_361.png | _not in prioritized subset for this run_ |
| 51 | 2025-08-07 | n/a | addendum | Sellers Property Disclosure Statement Addendum _1_ - 028 OREF.pdf | error: not_pdf_bytes |
| 52 | 2025-08-07 | n/a | seller_property_disclosure | Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 53 | 2025-08-07 | 2025-08-07 | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 54 | 2025-08-07 | 2025-08-07 | addendum | Property_Disclosure_Addendum.pdf | error: not_pdf_bytes |
| 55 | 2025-08-07 | n/a | other_pdf | did-you-see-that-comment.pdf | _not in prioritized subset for this run_ |
| 56 | 2025-08-07 | n/a | other_pdf | did-you-see-that-comment_2.pdf | _not in prioritized subset for this run_ |
| 57 | 2025-08-11 | n/a | other_pdf | EM_Receipt.pdf | _not in prioritized subset for this run_ |
| 58 | 2025-08-13 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 59 | 2025-08-13 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 60 | 2025-08-13 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 61 | 2025-08-16 | 2025-08-24 | termination_or_release | Termination Agreement.pdf | pages=1, read=1, textLen=6047, 1 pg · rich · Digi×2 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 62 | 2025-08-16 | n/a | termination_or_release | Addendum- Termination.pdf | pages=1, read=1, textLen=5652, 1 pg · rich · Digi×2 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 63 | 2025-08-27 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF _5_.pdf | _not in prioritized subset for this run_ |
| 64 | 2025-08-27 | n/a | addendum | Private_Well_Addendum_to_Real_Estate_Sale_Agreement_-_082_OREF _1_.pdf | error: not_pdf_bytes |
| 65 | 2025-08-27 | n/a | addendum | Septic_Onsite_Sewage_System_Addendum_-_081_OREF _1_.pdf | error: not_pdf_bytes |
| 66 | 2025-08-27 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 67 | 2025-08-27 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF_2.pdf | error: not_pdf_bytes |
| 68 | 2025-08-29 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 69 | 2025-08-29 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 70 | 2025-08-29 | n/a | lender_financing | Pre-approval_Letter.pdf | _not in prioritized subset for this run_ |
| 71 | 2025-08-29 | n/a | lender_financing | Pre-approval_Letter.pdf | _not in prioritized subset for this run_ |
| 72 | 2025-08-29 | n/a | other_pdf | did-you-see-that-comment.pdf | _not in prioritized subset for this run_ |
| 73 | 2025-08-29 | n/a | other_pdf | did-you-see-that-comment.pdf | _not in prioritized subset for this run_ |
| 74 | 2025-08-29 | n/a | other_pdf | did-you-see-that-comment_2.pdf | _not in prioritized subset for this run_ |
| 75 | 2025-08-29 | n/a | other_pdf | did-you-see-that-comment_2.pdf | _not in prioritized subset for this run_ |
| 76 | 2025-08-29 | n/a | addendum | Well_Addendum.pdf | error: not_pdf_bytes |
| 77 | 2025-08-29 | n/a | addendum | Well_Addendum.pdf | error: not_pdf_bytes |
| 78 | 2025-08-29 | n/a | addendum | Septic_Addendum.pdf | error: not_pdf_bytes |
| 79 | 2025-08-29 | n/a | addendum | Septic_Addendum.pdf | error: not_pdf_bytes |
| 80 | 2025-08-29 | n/a | counter_or_counteroffer | Counter-_Seller_s.pdf | error: not_pdf_bytes |
| 81 | 2025-08-29 | n/a | counter_or_counteroffer | Counter-_Seller_s.pdf | error: not_pdf_bytes |
| 82 | 2025-08-29 | n/a | counter_or_counteroffer | Counter-_Seller_s_2.pdf | error: not_pdf_bytes |
| 83 | 2025-08-29 | n/a | counter_or_counteroffer | Counter-_Seller_s_2.pdf | error: not_pdf_bytes |
| 84 | 2025-08-29 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 85 | 2025-08-29 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 86 | 2025-08-29 | n/a | other_pdf | Advisory-_Alarms.pdf | _not in prioritized subset for this run_ |
| 87 | 2025-08-29 | n/a | other_pdf | Advisory-_Alarms.pdf | _not in prioritized subset for this run_ |
| 88 | 2025-08-29 | n/a | other_pdf | Advisory-_Electronic_Funds.pdf | _not in prioritized subset for this run_ |
| 89 | 2025-08-29 | n/a | other_pdf | Advisory-_Electronic_Funds.pdf | _not in prioritized subset for this run_ |
| 90 | 2025-08-29 | n/a | other_pdf | Advisory-_Firpta.pdf | _not in prioritized subset for this run_ |
| 91 | 2025-08-29 | n/a | other_pdf | Advisory-_Firpta.pdf | _not in prioritized subset for this run_ |
| 92 | 2025-08-29 | n/a | other_pdf | Advisory-_Forms.pdf | _not in prioritized subset for this run_ |
| 93 | 2025-08-29 | n/a | other_pdf | Advisory-_Forms.pdf | _not in prioritized subset for this run_ |
| 94 | 2025-08-29 | n/a | other_pdf | Advisory-_RE_Compensation.pdf | _not in prioritized subset for this run_ |
| 95 | 2025-08-29 | n/a | other_pdf | Advisory-_RE_Compensation.pdf | _not in prioritized subset for this run_ |
| 96 | 2025-09-02 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 97 | 2025-09-02 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 98 | 2025-09-02 | n/a | addendum | Property_Disclosure_Addendum.pdf | error: not_pdf_bytes |
| 99 | 2025-09-02 | n/a | addendum | Property_Disclosure_Addendum.pdf | error: not_pdf_bytes |
| 100 | 2025-09-02 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 101 | 2025-09-02 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 102 | 2025-09-08 | n/a | addendum | Buyers_Repair_Addendum_-_022A__1__OREF _16_.pdf | error: not_pdf_bytes |
| 103 | 2025-09-08 | n/a | addendum | Buyers_Repair_Addendum_-_022A__1__OREF _16_.pdf | error: not_pdf_bytes |
| 104 | 2025-09-08 | n/a | addendum | Sellers Repair Addendum - 022B _1_ OREF.pdf | error: not_pdf_bytes |
| 105 | 2025-09-08 | n/a | addendum | Sellers Repair Addendum - 022B _1_ OREF.pdf | error: not_pdf_bytes |
| 106 | 2025-09-08 | n/a | other_pdf | EM.pdf | _not in prioritized subset for this run_ |
| 107 | 2025-09-08 | n/a | other_pdf | EM.pdf | _not in prioritized subset for this run_ |
| 108 | 2025-09-09 | n/a | addendum | Addendum 1- Price.pdf | error: not_pdf_bytes |
| 109 | 2025-09-09 | n/a | addendum | Addendum 1- Price.pdf | error: not_pdf_bytes |
| 110 | 2025-09-09 | n/a | addendum | Repair Addendum- Buyer_s 2.pdf | error: not_pdf_bytes |
| 111 | 2025-09-09 | n/a | addendum | Repair Addendum- Buyer_s 2.pdf | error: not_pdf_bytes |
| 112 | 2025-09-09 | n/a | addendum | Addendum_1-_Price.pdf | error: not_pdf_bytes |
| 113 | 2025-09-09 | n/a | addendum | Addendum_1-_Price.pdf | error: not_pdf_bytes |
| 114 | 2025-09-09 | n/a | addendum | Repair_Addendum-_Buyer_s_1.pdf | error: not_pdf_bytes |
| 115 | 2025-09-09 | n/a | addendum | Repair_Addendum-_Buyer_s_1.pdf | error: not_pdf_bytes |
| 116 | 2025-09-09 | n/a | addendum | Repair_Addendum-_Seller_s.pdf | error: not_pdf_bytes |
| 117 | 2025-09-09 | n/a | addendum | Repair_Addendum-_Seller_s.pdf | error: not_pdf_bytes |
| 118 | 2025-09-09 | n/a | addendum | Repair_Addendum-_Buyer_s_2.pdf | error: not_pdf_bytes |
| 119 | 2025-09-09 | n/a | addendum | Repair_Addendum-_Buyer_s_2.pdf | error: not_pdf_bytes |
| 120 | 2025-09-19 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 121 | 2025-09-19 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 122 | 2025-09-19 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF_2.pdf | _not in prioritized subset for this run_ |
| 123 | 2025-09-19 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF_2.pdf | _not in prioritized subset for this run_ |
| 124 | 2025-09-25 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF_3.pdf | _not in prioritized subset for this run_ |
| 125 | 2025-09-25 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF_3.pdf | _not in prioritized subset for this run_ |
| 126 | 2025-09-25 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 127 | 2025-09-25 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 128 | 2025-09-25 | n/a | closing_adjacent | Final_Sellers_Statement_IHLA.pdf | _not in prioritized subset for this run_ |
| 129 | 2025-09-25 | n/a | closing_adjacent | Final_Sellers_Statement_IHLA.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 129 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 5 ("offer" family). **Counter-like**: 6 (includes OREF counter forms when matched). **Termination/release-like**: 2. **RSA / sale agreement-like**: 2.
- **PDF dual pipeline coverage**: 44 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 64350 Old Bend Redmond Hwy, Bend, OR 97703

- **Folder id (`saleGuid`)**: `072c1a52-c2a2-4aad-aaf3-bbe7ece8b145`
- **MLS**: 220205567
- **SkySlope status**: Canceled/App
- **Linked listingGuid**: a28589fc-3915-4a92-86e6-c08355147398
- **Sale price / list price**: 1000000 / 1099000
- **Contract acceptance**: 2025-08-06
- **Escrow closing**: 2025-09-05
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-08-06

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | Completed | 2025-08-06 | Sale_Agreement.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Completed | 2025-08-06 | Proof_of_Funds.pdf |
| 3 | Counter Offers  | Sales Documentation | Optional | n/a |  |
| 4 | Sale Addendums  | Sales Documentation | Completed | 2025-08-06 | Addendum-_AP.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | Optional | n/a |  |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Completed | 2025-08-07 | did-you-see-that-comment.pdf |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | Optional | n/a |  |
| 11 | Contingency Removal Addendum  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy  | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale  | Sales Documentation | Optional | n/a |  |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Optional | n/a |  |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Completed | 2025-08-24 | Termination Agreement.pdf |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 18 | Well Addendum | Sales Documentation | Completed | 2025-08-06 | Well_Addendum.pdf |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 19 | Septic Addendum | Sales Documentation | Completed | 2025-08-06 | Septic_Addendum.pdf |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | Required | n/a |  |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | Completed | 2025-08-06 | Advisory-_Electronic_Funds.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | Completed | 2025-08-06 | Advisory-_RE_Compensation.pdf |
| 25 | FIRPTA Advisory | Disclosures | Completed | 2025-08-06 | Advisory-_Firpta.pdf |
| 26 | Real Estate Forms Advisory | Disclosures | Completed | 2025-08-06 | Advisory-_Forms.pdf |
| 27 | Smoke Alarms Advisory | Disclosures | Completed | 2025-08-06 | Advisory-_Alarms.pdf |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Completed | 2025-08-13 | Broker_Demand.pdf |
| 35 | Earnest Money Receipt | Closing Documents | Completed | 2025-08-11 | EM_Receipt.pdf |
| 36 | Preliminary Title Report | Closing Documents | Completed | 2025-08-13 | Preliminary_Title_Report.pdf |
| 37 | Final HUD | Closing Documents | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | Completed | 2025-08-06 | OREA_Pamphlet.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Completed | 2025-08-07 | did-you-see-that-comment_2.pdf |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-09 | n/a | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-09 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Fair Housing - Seller - 104 OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-09 | n/a | title_or_hoa | Advisory Regarding Title Insurance - Seller - 103 OREF.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-07-09 | n/a | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - Seller - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-09 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-09 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-09 | n/a | other_pdf | 1d9f4bf5ae604e458b7a4718342463c3_960.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-07-14 | n/a | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-07-15 | n/a | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-08-05 | n/a | buyer_offer_or_package | Buyer_Signed_offer_on_OBRH.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-08-05 | n/a | lender_financing | Offer_1_PreApproval.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-08-05 | n/a | buyer_offer_or_package | Offer_1_Final_Agency_Acknowledgement.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-08-05 | n/a | buyer_offer_or_package | Offer_1_Residential_Real_Estate_Agreement.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-08-05 | n/a | addendum | Offer_1_Well_Addendum.pdf | error: not_pdf_bytes |
| 18 | 2025-08-05 | n/a | buyer_offer_or_package | Offer_1_On_Site_Sewage.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-08-05 | n/a | earnest_or_wire | Offer_1_Wire_Fraud.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-08-06 | n/a | addendum | Addendum- Terms.pdf | error: not_pdf_bytes |
| 21 | 2025-08-06 | n/a | addendum | Well Addendum.pdf | error: not_pdf_bytes |
| 22 | 2025-08-06 | n/a | other_pdf | Proof of Funds.pdf | _not in prioritized subset for this run_ |
| 23 | 2025-08-06 | n/a | addendum | Septic Addendum.pdf | error: not_pdf_bytes |
| 24 | 2025-08-06 | n/a | sale_agreement_or_rsa | Sale Agreement.pdf | pages=15, read=12, textLen=136863, 15 pg · read 12 · rich · Digi×24 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 25 | 2025-08-06 | n/a | closing_adjacent | Letter to boardwalk house.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-08-06 | 2025-08-06 | other_pdf | Listing_Contract.pdf | _not in prioritized subset for this run_ |
| 27 | 2025-08-06 | 2025-08-06 | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-08-06 | 2025-08-06 | other_pdf | Data_Pages.pdf | _not in prioritized subset for this run_ |
| 29 | 2025-08-06 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-08-06 | n/a | other_pdf | Proof_of_Funds.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-08-06 | n/a | addendum | Addendum-_AP.pdf | error: not_pdf_bytes |
| 32 | 2025-08-06 | n/a | other_pdf | Advisory-_Electronic_Funds.pdf | _not in prioritized subset for this run_ |
| 33 | 2025-08-06 | n/a | other_pdf | Advisory-_RE_Compensation.pdf | _not in prioritized subset for this run_ |
| 34 | 2025-08-06 | n/a | other_pdf | Advisory-_Firpta.pdf | _not in prioritized subset for this run_ |
| 35 | 2025-08-06 | n/a | other_pdf | Advisory-_Forms.pdf | _not in prioritized subset for this run_ |
| 36 | 2025-08-06 | n/a | other_pdf | Advisory-_Alarms.pdf | _not in prioritized subset for this run_ |
| 37 | 2025-08-06 | n/a | addendum | Well_Addendum.pdf | error: not_pdf_bytes |
| 38 | 2025-08-06 | n/a | addendum | Septic_Addendum.pdf | error: not_pdf_bytes |
| 39 | 2025-08-06 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 40 | 2025-08-06 | n/a | addendum | Septic_Addendum.pdf | error: not_pdf_bytes |
| 41 | 2025-08-06 | n/a | addendum | Well_Addendum.pdf | error: not_pdf_bytes |
| 42 | 2025-08-06 | n/a | other | img_156940d0-9c45-4517-b182-1e155c31281c_395.png | _not in prioritized subset for this run_ |
| 43 | 2025-08-06 | n/a | other | img_102795a3-efb8-44e4-a58f-653c1bff4fec_120.png | _not in prioritized subset for this run_ |
| 44 | 2025-08-06 | n/a | other | img_2e65b90d-af86-463a-852b-97a1f645fa04_217.png | _not in prioritized subset for this run_ |
| 45 | 2025-08-06 | n/a | other | img_736cb534-786b-4a09-af3a-641369977d65_489.png | _not in prioritized subset for this run_ |
| 46 | 2025-08-06 | n/a | other | img_212beb6b-a937-46c1-95f2-6ad7e6030612_586.png | _not in prioritized subset for this run_ |
| 47 | 2025-08-06 | n/a | other | img_6ed6b692-2ea7-433a-bbd7-8e42a52f2965_361.png | _not in prioritized subset for this run_ |
| 48 | 2025-08-07 | n/a | addendum | Sellers Property Disclosure Statement Addendum _1_ - 028 OREF.pdf | error: not_pdf_bytes |
| 49 | 2025-08-07 | n/a | seller_property_disclosure | Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 50 | 2025-08-07 | 2025-08-07 | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 51 | 2025-08-07 | 2025-08-07 | addendum | Property_Disclosure_Addendum.pdf | error: not_pdf_bytes |
| 52 | 2025-08-07 | n/a | other_pdf | did-you-see-that-comment.pdf | _not in prioritized subset for this run_ |
| 53 | 2025-08-07 | n/a | other_pdf | did-you-see-that-comment_2.pdf | _not in prioritized subset for this run_ |
| 54 | 2025-08-11 | n/a | other_pdf | EM_Receipt.pdf | _not in prioritized subset for this run_ |
| 55 | 2025-08-13 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 56 | 2025-08-13 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 57 | 2025-08-13 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 58 | 2025-08-16 | 2025-08-24 | termination_or_release | Termination Agreement.pdf | pages=1, read=1, textLen=6047, 1 pg · rich · Digi×2 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 59 | 2025-08-16 | n/a | termination_or_release | Addendum- Termination.pdf | pages=1, read=1, textLen=5652, 1 pg · rich · Digi×2 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 60 | 2025-08-27 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF _5_.pdf | _not in prioritized subset for this run_ |
| 61 | 2025-08-27 | n/a | addendum | Private_Well_Addendum_to_Real_Estate_Sale_Agreement_-_082_OREF _1_.pdf | error: not_pdf_bytes |
| 62 | 2025-08-27 | n/a | addendum | Septic_Onsite_Sewage_System_Addendum_-_081_OREF _1_.pdf | error: not_pdf_bytes |
| 63 | 2025-08-27 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 64 | 2025-08-27 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF_2.pdf | error: not_pdf_bytes |

### Narrative timeline (best-effort)

- **Forms inventory**: 64 documents. Checklist activities: 44.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 4 ("offer" family). **Counter-like**: 2 (includes OREF counter forms when matched). **Termination/release-like**: 2. **RSA / sale agreement-like**: 2.
- **PDF dual pipeline coverage**: 18 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 820 NW 12th Street, Bend, OR 97703

- **Folder id (`saleGuid`)**: `3b58652b-99d8-4316-af5e-27a04f280d44`
- **MLS**: 220205649
- **SkySlope status**: Canceled/App
- **Linked listingGuid**: n/a
- **Sale price / list price**: 795000 / 0
- **Contract acceptance**: 2025-08-04
- **Escrow closing**: 2025-09-15
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-08-05

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | Completed | 2025-08-05 | Sale_Addendum_1__Change_in_purchase_price_795__2025-08-04_11_31_37__1___1_.pdf; 1_1_Oregon_Residential_Real_Estate_Purchase_And_Sale_Agreement_-_OR__1___1_.pdf; 1_1_Oregon_Residential_Real_Estate_Purchase_And_Sale_Agreement_-_OR__1___1__2.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Optional | n/a |  |
| 3 | Counter Offers  | Sales Documentation | Optional | n/a |  |
| 4 | Sale Addendums  | Sales Documentation | Completed | 2025-08-05 | Sale_Addendum_1__Change_in_purchase_price_795__2025-08-04_11_31_37__1___1__2.pdf |
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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-08-05 | n/a | sale_agreement_or_rsa | 1_1 Oregon Residential Real Estate Purchase And Sale Agreement - OR.pdf | pages=11, read=11, textLen=125313, 11 pg · rich · Digi×11 · dual pipeline 11 pg · tesseract.js (pdf.js render) · nonempty OCR 11/11 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 2 | 2025-08-05 | n/a | seller_property_disclosure | 820 SPDs.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-08-05 | n/a | buyer_offer_or_package | 9_4 Buyer Representation Agreement - OR.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-08-05 | n/a | other_pdf | lead paint.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-08-05 | n/a | other_pdf | firpta 820.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-08-05 | n/a | earnest_or_wire | wire fraud.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-08-05 | n/a | sale_agreement_or_rsa | 1_1 Oregon Residential Real Estate Purchase And Sale Agreement - OR_2.pdf | pages=11, read=11, textLen=125312, 11 pg · rich · Digi×11 · dual pipeline 11 pg · tesseract.js (pdf.js render) · nonempty OCR 11/11 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 8 | 2025-08-05 | n/a | other_pdf | HES 820.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-08-05 | n/a | addendum | Sale_Addendum_1__Change_in_purchase_price_795__2025-08-04_11_31_37__1___1_.pdf | error: not_pdf_bytes |
| 10 | 2025-08-05 | n/a | other_pdf | 1_1_Oregon_Residential_Real_Estate_Purchase_And_Sale_Agreement_-_OR__1___1_.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-08-05 | n/a | other_pdf | 1_1_Oregon_Residential_Real_Estate_Purchase_And_Sale_Agreement_-_OR__1___1__2.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-08-05 | n/a | addendum | Sale_Addendum_1__Change_in_purchase_price_795__2025-08-04_11_31_37__1___1__2.pdf | error: not_pdf_bytes |

### Narrative timeline (best-effort)

- **Forms inventory**: 12 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 2.
- **PDF dual pipeline coverage**: 4 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 820 NW 12th Street, Bend, OR 97703

- **Folder id (`saleGuid`)**: `9270c124-86dd-4350-af66-1ab30dd59ea5`
- **MLS**: 220205649
- **SkySlope status**: Canceled/App
- **Linked listingGuid**: n/a
- **Sale price / list price**: 0 / 0
- **Contract acceptance**: n/a
- **Escrow closing**: n/a
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-08-05

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-08-05 | n/a | other_pdf | firpta 820.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-08-05 | n/a | seller_property_disclosure | 820 SPDs.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-08-05 | n/a | other_pdf | HES 820.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-08-05 | n/a | earnest_or_wire | wire fraud.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-08-05 | n/a | sale_agreement_or_rsa | 1_1 Oregon Residential Real Estate Purchase And Sale Agreement - OR.pdf | pages=11, read=11, textLen=125313, 11 pg · rich · Digi×11 · dual pipeline 11 pg · tesseract.js (pdf.js render) · nonempty OCR 11/11 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 6 | 2025-08-05 | n/a | other_pdf | lead paint.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-08-05 | n/a | buyer_offer_or_package | 9_4 Buyer Representation Agreement - OR.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-08-05 | n/a | sale_agreement_or_rsa | 1_1 Oregon Residential Real Estate Purchase And Sale Agreement - OR_2.pdf | pages=11, read=11, textLen=125312, 11 pg · rich · Digi×11 · dual pipeline 11 pg · tesseract.js (pdf.js render) · nonempty OCR 11/11 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |

### Narrative timeline (best-effort)

- **Forms inventory**: 8 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 2.
- **PDF dual pipeline coverage**: 2 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 122 SW 10th Street, Redmond, OR 97756

- **Folder id (`saleGuid`)**: `c1ac8195-9cdf-4184-863a-40c2a83ea51c`
- **MLS**: 220197389
- **SkySlope status**: Canceled/App
- **Linked listingGuid**: n/a
- **Sale price / list price**: 400000 / 0
- **Contract acceptance**: 2025-08-04
- **Escrow closing**: 2025-09-05
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-08-05

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | Completed | 2025-08-05 | 10th_Street_Sellers_Counteroffer___1_25__10_.pdf; Conditional_Pre_Chester_docx.pdf; Residential_Real_Estate_Sale_Agreement_122_SW_10__1_.pdf; Residential_Real_Estate_Sale_Agreement_122_SW_10__1__2.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Completed | 2025-08-05 | Conditional_Pre_Chester_docx_2.pdf |
| 3 | Counter Offers  | Sales Documentation | Completed | 2025-08-05 | 10th_Street_Sellers_Counteroffer___1_25__10__2.pdf |
| 4 | Sale Addendums  | Sales Documentation | Optional | n/a |  |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | Optional | n/a |  |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Optional | n/a |  |
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
| 21 | Sellers Property Disclosures | Disclosures | Optional | n/a |  |
| 22 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 23 | Electronic Funds Advisory | Disclosures | Optional | n/a |  |
| 24 | Real Estate Compensation Advisory | Disclosures | Optional | n/a |  |
| 25 | FIRPTA Advisory | Disclosures | Optional | n/a |  |
| 26 | Real Estate Forms Advisory | Disclosures | Optional | n/a |  |
| 27 | Smoke Alarms Advisory | Disclosures | Optional | n/a |  |
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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-08-05 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF.pdf | pages=15, read=12, textLen=135415, 15 pg · read 12 · rich · Digi×12 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 2 | 2025-08-05 | n/a | counter_or_counteroffer | 10th_Street_Sellers_Counteroffer___1_25__10_.pdf | error: not_pdf_bytes |
| 3 | 2025-08-05 | n/a | other_pdf | Conditional_Pre_Chester_docx.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-08-05 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_122_SW_10__1_.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-08-05 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_122_SW_10__1__2.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-08-05 | n/a | other_pdf | Conditional_Pre_Chester_docx_2.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-08-05 | n/a | counter_or_counteroffer | 10th_Street_Sellers_Counteroffer___1_25__10__2.pdf | error: not_pdf_bytes |

### Narrative timeline (best-effort)

- **Forms inventory**: 7 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 2 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 3.
- **PDF dual pipeline coverage**: 3 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 703 SW 7th Street, Redmond, OR 97756

- **Folder id (`saleGuid`)**: `487fb3bf-1a35-417c-84e1-b803be012aa0`
- **MLS**: 220202806
- **SkySlope status**: Closed
- **Linked listingGuid**: n/a
- **Sale price / list price**: 355000 / 0
- **Contract acceptance**: 2025-08-26
- **Escrow closing**: 2025-09-29
- **Actual closing**: 2025-09-29
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-08-05

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Residential Sale Agreement | Sales Documentation | Completed | 2025-08-27 | Sale_Agreement.pdf |
| 2 | Pre Approval Letter or Proof of Funds  | Sales Documentation | Completed | 2025-08-27 | Pre-approval_Letter.pdf |
| 3 | Counter Offers  | Sales Documentation | Completed | 2025-08-27 | Counter-_Seller_s.pdf |
| 4 | Sale Addendums  | Sales Documentation | Completed | 2025-08-28 | Addendum-_Offer_Ext.pdf; Addendum-_Close_9-29.pdf; Addendum-_Repairs.pdf; Addendum-_Credit.pdf |
| 5 | Professional Inspection Addendum  | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendums  | Sales Documentation | Completed | 2025-09-19 | Repair_Addendum-_Seller_s.pdf; Repair_Addendum-_Buyer_s.pdf |
| 7 | Delivery Addendum  | Sales Documentation | Optional | n/a |  |
| 8 | Owner Association Addendum | Sales Documentation | Completed | 2025-08-29 | did-you-see-that-comment.pdf |
| 9 | Solar Panel Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Wood Stove Fireplace Insert Addendum  | Sales Documentation | Optional | n/a |  |
| 11 | Contingency Removal Addendum  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy  | Sales Documentation | Completed | 2025-09-12 | Agreement_to_Occupy.pdf |
| 13 | Bill Of Sale  | Sales Documentation | Optional | n/a |  |
| 14 | VA/FHA Ammendatory Clause  | Sales Documentation | Optional | n/a |  |
| 15 | Contingent Right To Purchase  | Sales Documentation | Optional | n/a |  |
| 16 | Notice to Buyer | Seller  | Sales Documentation | Optional | n/a |  |
| 17 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 18 | Documentation of Repairs or Maintenance  | Miscellaneous Documentation | Optional | n/a |  |
| 19 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 20 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 21 | Sellers Property Disclosures | Disclosures | Completed | 2025-08-27 | Property_Disclosures.pdf |
| 22 | Lead Based Paint Disclosure  | Disclosures | Completed | 2025-08-29 | LBP_Addendum.pdf |
| 23 | Electronic Funds Advisory | Disclosures | Completed | 2025-09-01 | Electronic_Funds_Advisory.pdf |
| 24 | Real Estate Compensation Advisory | Disclosures | Completed | 2025-09-08 | Compensation_Advisorypdf.pdf |
| 25 | FIRPTA Advisory | Disclosures | Completed | 2025-09-08 | FIRPTA_Advisory.pdf |
| 26 | Real Estate Forms Advisory | Disclosures | Completed | 2025-09-08 | Form_Advisory.pdf |
| 27 | Smoke Alarms Advisory | Disclosures | Completed | 2025-09-08 | Alarm_Advisory.pdf |
| 28 | Association Advisory  | Disclosures | Optional | n/a |  |
| 29 | Lead Based Paint Advisory  | Disclosures | Optional | n/a |  |
| 30 | CCRs  | Reports | Optional | n/a |  |
| 31 | Association Documents  | Reports | Optional | n/a |  |
| 32 | Appraisal  | Reports | Optional | n/a |  |
| 33 | Home Inspection  | Reports | Optional | n/a |  |
| 34 | Broker Commission Demand from Title | Closing Documents | Completed | 2025-09-19 | Broker_Demand.pdf |
| 35 | Earnest Money Receipt | Closing Documents | Completed | 2025-08-28 | EM_Receipt.pdf |
| 36 | Preliminary Title Report | Closing Documents | Completed | 2025-09-03 | Preliminary_Title_Report.pdf |
| 37 | Final HUD | Closing Documents | Completed | 2025-09-29 | Final_BuyerBorrower_Statement.pdf |
| 38 | Initial Agency Disclosure (042 | 10.4) | Closing Documents | Completed | 2025-09-01 | OREA_Pamphlet.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Completed | 2025-09-06 | Buyer_Representation_Agreement.pdf |
| 40 | Disclosed Limited Agency  | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Record of Properties Shown  | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-08-05 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF.pdf | pages=15, read=12, textLen=135415, 15 pg · read 12 · rich · Digi×12 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 2 | 2025-08-05 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF_2.pdf | pages=15, read=12, textLen=135415, 15 pg · read 12 · rich · Digi×12 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 3 | 2025-08-05 | n/a | other_pdf | Conditional_Pre_Chester_docx.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-08-05 | n/a | counter_or_counteroffer | 10th_Street_Sellers_Counteroffer___1_25__10_.pdf | error: not_pdf_bytes |
| 5 | 2025-08-05 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_122_SW_10__1_.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-08-27 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF_3.pdf | pages=15, read=12, textLen=135415, 15 pg · read 12 · rich · Digi×12 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 7 | 2025-08-27 | n/a | other_pdf | Conditional_Pre_Chester_docx_2.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-08-27 | n/a | counter_or_counteroffer | 10th_Street_Sellers_Counteroffer___1_25__10__2.pdf | error: not_pdf_bytes |
| 9 | 2025-08-27 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_122_SW_10 _1_.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-08-27 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF_4.pdf | pages=15, read=12, textLen=135415, 15 pg · read 12 · rich · Digi×12 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 11 | 2025-08-27 | n/a | counter_or_counteroffer | 10th_Street_Sellers_Counteroffer___1_25__10__3.pdf | error: not_pdf_bytes |
| 12 | 2025-08-27 | n/a | other_pdf | Conditional_Pre_Chester_docx_3.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-08-27 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_122_SW_10 _1__2.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-08-27 | n/a | other_pdf | Sale_Agreement.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-08-27 | n/a | lender_financing | Pre-approval_Letter.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-08-27 | n/a | seller_property_disclosure | Property_Disclosures.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-08-27 | n/a | counter_or_counteroffer | Counter-_Seller_s.pdf | error: not_pdf_bytes |
| 18 | 2025-08-28 | n/a | other_pdf | EM_Receipt.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-08-28 | n/a | addendum | Addendum-_Offer_Ext.pdf | error: not_pdf_bytes |
| 20 | 2025-08-29 | n/a | other_pdf | did-you-see-that-comment.pdf | _not in prioritized subset for this run_ |
| 21 | 2025-08-29 | n/a | addendum | LBP_Addendum.pdf | error: not_pdf_bytes |
| 22 | 2025-09-01 | n/a | other_pdf | Electronic_Funds_Advisory.pdf | _not in prioritized subset for this run_ |
| 23 | 2025-09-01 | n/a | agency_disclosure_pamphlet | OREA_Pamphlet.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-09-03 | n/a | title_or_hoa | Preliminary_Title_Report.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-09-06 | n/a | buyer_offer_or_package | Buyer_Representation_Agreement.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-09-06 | n/a | addendum | Addendum-_Close_9-29.pdf | error: not_pdf_bytes |
| 27 | 2025-09-08 | n/a | other_pdf | FIRPTA_Advisory.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-09-08 | n/a | other_pdf | Compensation_Advisorypdf.pdf | _not in prioritized subset for this run_ |
| 29 | 2025-09-08 | n/a | other_pdf | Alarm_Advisory.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-09-08 | n/a | other_pdf | Form_Advisory.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-09-12 | n/a | other_pdf | Agreement_to_Occupy.pdf | _not in prioritized subset for this run_ |
| 32 | 2025-09-19 | n/a | addendum | Repair_Addendum-_Seller_s.pdf | _not in prioritized subset for this run_ |
| 33 | 2025-09-19 | n/a | addendum | Repair_Addendum-_Buyer_s.pdf | _not in prioritized subset for this run_ |
| 34 | 2025-09-19 | n/a | addendum | Addendum-_Repairs.pdf | _not in prioritized subset for this run_ |
| 35 | 2025-09-19 | n/a | addendum | Addendum-_Credit.pdf | _not in prioritized subset for this run_ |
| 36 | 2025-09-19 | n/a | other_pdf | Broker_Demand.pdf | _not in prioritized subset for this run_ |
| 37 | 2025-09-29 | n/a | buyer_offer_or_package | Final_BuyerBorrower_Statement.pdf | _not in prioritized subset for this run_ |
| 38 | 2026-04-07 | n/a | addendum | Addendum to Sale Agreement 2 - 002 OREF.pdf | error: not_pdf_bytes |
| 39 | 2026-04-07 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 40 | 2026-04-07 | n/a | buyer_offer_or_package | Advisory Regarding Smoke and Carbon Monoxide Alarms - Buyer - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 41 | 2026-04-07 | n/a | agency_disclosure_pamphlet | Protect Your Family From Lead In Your Home Pamphlet - EPA.pdf | _not in prioritized subset for this run_ |
| 42 | 2026-04-07 | n/a | other_pdf | Agreement to Occupy After Closing - 054 OREF.pdf | _not in prioritized subset for this run_ |
| 43 | 2026-04-07 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | error: not_pdf_bytes |
| 44 | 2026-04-07 | n/a | addendum | Buyers Repair Addendum - 022A _1_ OREF.pdf | _not in prioritized subset for this run_ |
| 45 | 2026-04-07 | n/a | addendum | Addendum to Sale Agreement 2 - 002 OREF_2.pdf | error: not_pdf_bytes |
| 46 | 2026-04-07 | n/a | seller_property_disclosure | 703 spd.pdf | _not in prioritized subset for this run_ |
| 47 | 2026-04-07 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 48 | 2026-04-07 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF_5.pdf | error: not_pdf_bytes |
| 49 | 2026-04-07 | n/a | buyer_offer_or_package | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Buyer - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 50 | 2026-04-07 | n/a | addendum | 7th St Addendum to Sale Agreement - Seller Response Extension _1_.pdf | error: not_pdf_bytes |
| 51 | 2026-04-07 | n/a | buyer_offer_or_package | Advisory Regarding FIRPTA Tax - Buyer - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 52 | 2026-04-07 | n/a | addendum | Repair Addendum- Seller_s.pdf | _not in prioritized subset for this run_ |
| 53 | 2026-04-07 | n/a | counter_or_counteroffer | 7th St_ Sellers Counteroffer.pdf | error: not_pdf_bytes |
| 54 | 2026-04-07 | n/a | other_pdf | Conditional Pre Chester_docx _1_.pdf | _not in prioritized subset for this run_ |
| 55 | 2026-04-07 | n/a | other_pdf | 703 LBP.pdf | _not in prioritized subset for this run_ |
| 56 | 2026-04-07 | n/a | addendum | Addendum- Close 9-29.pdf | _not in prioritized subset for this run_ |
| 57 | 2026-04-07 | n/a | sale_agreement_or_rsa | 7th St Residential Real Estate Sale Agreement - SIGNED .pdf | error: not_pdf_bytes |
| 58 | 2026-04-07 | n/a | other_pdf | 703 LBP_pdf_2025-08-27 08_46_03.pdf | _not in prioritized subset for this run_ |
| 59 | 2026-04-07 | n/a | buyer_offer_or_package | Advisory Regarding Real Estate Compensation - Buyer - 047 OREF.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 59 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 6 ("offer" family). **Counter-like**: 5 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 9.
- **PDF dual pipeline coverage**: 18 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 820 NW 12th Street, Bend, OR 97703

- **Folder id (`saleGuid`)**: `bdc9d9a6-4241-419e-8072-6cfcdbd1f086`
- **MLS**: 220205649
- **SkySlope status**: Canceled/App
- **Linked listingGuid**: n/a
- **Sale price / list price**: 0 / 0
- **Contract acceptance**: n/a
- **Escrow closing**: n/a
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-08-05

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

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-08-05 | n/a | other_pdf | firpta 820.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-08-05 | n/a | sale_agreement_or_rsa | 1_1 Oregon Residential Real Estate Purchase And Sale Agreement - OR.pdf | pages=11, read=11, textLen=125312, 11 pg · rich · Digi×11 · dual pipeline 11 pg · tesseract.js (pdf.js render) · nonempty OCR 11/11 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 3 | 2025-08-05 | n/a | other_pdf | lead paint.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-08-05 | n/a | other_pdf | HES 820.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-08-05 | n/a | earnest_or_wire | wire fraud.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-08-05 | n/a | buyer_offer_or_package | 9_4 Buyer Representation Agreement - OR.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-08-05 | n/a | sale_agreement_or_rsa | 1_1 Oregon Residential Real Estate Purchase And Sale Agreement - OR_2.pdf | pages=11, read=11, textLen=125313, 11 pg · rich · Digi×11 · dual pipeline 11 pg · tesseract.js (pdf.js render) · nonempty OCR 11/11 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 8 | 2025-08-05 | n/a | seller_property_disclosure | 820 SPDs.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 8 documents. Checklist activities: 42.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 2.
- **PDF dual pipeline coverage**: 2 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 218 SW 4th St, Redmond, OR 97756

- **Folder id (`saleGuid`)**: `6eb83ed3-fbe9-4fad-b356-0bc293f7faf2`
- **MLS**: 220199880
- **SkySlope status**: Canceled/App
- **Linked listingGuid**: n/a
- **Sale price / list price**: 445000 / 0
- **Contract acceptance**: 2025-04-22
- **Escrow closing**: 2025-07-31
- **Actual closing**: n/a
- **Checklist type**: Commercial Sale
- **Created on**: 2025-07-08

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure Pamphlet | Sales Documentation | Required | n/a |  |
| 2 | Residential Purchase Agreement | Sales Documentation | Required | n/a |  |
| 3 | Pre Approval Letter or Proof of Funds | Sales Documentation | Optional | n/a |  |
| 4 | Counter Offers  | Sales Documentation | Optional | n/a |  |
| 5 | Sale Addendums | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendum | Sales Documentation | Optional | n/a |  |
| 7 | Receipt for Documents  | Sales Documentation | Optional | n/a |  |
| 8 | Contingency Removal | Sales Documentation | Optional | n/a |  |
| 9 | Extension of Time Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Notice to Buyer | Seller | Sales Documentation | Optional | n/a |  |
| 11 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale | Sales Documentation | Optional | n/a |  |
| 14 | Sellers Property Disclosures | Disclosures | Required | n/a |  |
| 15 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 16 | Wood Stove | Fireplace Insert Addendum | Disclosures | Optional | n/a |  |
| 17 | Professional Inspection Addendum | Disclosures | Optional | n/a |  |
| 18 | Electronic Funds Advisory | Disclosures | Required | n/a |  |
| 19 | Real Estate Compensation Advisory | Disclosures | Required | n/a |  |
| 20 | FIRPTA Advisory | Disclosures | Required | n/a |  |
| 21 | Real Estate Forms Advisory | Disclosures | Required | n/a |  |
| 22 | Smoke Alarms Advisory | Disclosures | Required | n/a |  |
| 23 | Association Advisory | Disclosures | Optional | n/a |  |
| 24 | Lead Based Paint Advisory | Disclosures | Optional | n/a |  |
| 25 | CCRs | Reports | Optional | n/a |  |
| 26 | Association Documents | Reports | Optional | n/a |  |
| 27 | Appraisal  | Reports | Optional | n/a |  |
| 28 | Home Inspection  | Reports | Optional | n/a |  |
| 29 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 30 | Earnest Money Receipt | Closing Documents | Required | n/a |  |
| 31 | Preliminary Title Report | Closing Documents | Required | n/a |  |
| 32 | Final HUD | Closing Documents | Required | n/a |  |
| 33 | Documentation of Repairs or Maintenance | Miscellaneous Documentation | Optional | n/a |  |
| 34 | Net Sheets | CMAs | Miscellaneous Documentation | Optional | n/a |  |
| 35 | Skyslope Cover Sheet / Deal Memo | Miscellaneous Documentation | Required | n/a |  |
| 36 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 37 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Buyer Agreement Documentation | Required | n/a |  |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Required | n/a |  |
| 40 | Buyer Intake Form | Buyer Agreement Documentation | Required | n/a |  |
| 41 | Pre Approval Letters | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 43 | Disclosed Limited Agency | Buyer Agreement Documentation | Optional | n/a |  |
| 44 | Record of Properties Shown | Buyer Agreement Documentation | Optional | n/a |  |
| 45 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 46 | Copies of Correspondance | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-08 | n/a | seller_property_disclosure | Sellers Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-08 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-08 | n/a | addendum | 2_2 General Addendum To Real Estate Purchase And Sale Agreement _1_ - OR.pdf | pages=1, read=1, textLen=3289, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 4 | 2025-07-08 | n/a | other_pdf | 6_2 Commercial Diligence Document Request Sheet - OR.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-08 | n/a | addendum | 2_2 General Addendum To Real Estate Purchase And Sale Agreement _3_ - OR.pdf | pages=1, read=1, textLen=3478, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 6 | 2025-07-08 | n/a | sale_agreement_or_rsa | 1_2 Oregon Commercial Real Estate Purchase and Sale Agreement - OR.pdf | pages=11, read=11, textLen=121596, 11 pg · rich · Digi×11 · dual pipeline 11 pg · tesseract.js (pdf.js render) · nonempty OCR 11/11 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 7 | 2025-07-08 | n/a | addendum | 2_2 General Addendum To Real Estate Purchase And Sale Agreement _1_ - OR_2.pdf | pages=1, read=1, textLen=3413, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 8 | 2025-07-08 | n/a | other_pdf | Insurance.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-08 | n/a | addendum | 2_2 General Addendum To Real Estate Purchase And Sale Agreement _1_ - OR_3.pdf | pages=1, read=1, textLen=3388, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 10 | 2025-07-08 | n/a | addendum | 2_2_General_Addendum_To_Real_Estate_Purchase_And_Sale_Agreement__4__-_OR.pdf | error: not_pdf_bytes |
| 11 | 2025-07-08 | n/a | other_pdf | PA LETTER-Chester-218 sw 4th RDM - 435k.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-07-08 | n/a | termination_or_release | Contingent Right to Purchase - Notice to Seller - 083A OREF.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-07-08 | n/a | termination_or_release | 5_3 Buyer_s Notice of Termination - OR.pdf | pages=2, read=2, textLen=20263, 2 pg · rich · Digi×2 · dual pipeline 2 pg · tesseract.js (pdf.js render) · nonempty OCR 2/2 engine page(s)., signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 14 | 2025-07-08 | n/a | other_pdf | Answers from Seller regarding Due Diligence.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-07-08 | n/a | inspection_or_repair | Repair Request List _2_.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-07-08 | n/a | counter_or_counteroffer | 2_1_Counteroffer_to_Real_Estate_Purchase_and_Sale_Agreement__1__-_OR.pdf | error: not_pdf_bytes |
| 17 | 2025-07-08 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF_2.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-07-08 | n/a | seller_property_disclosure | 1_Sellers Property Disclosures.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-07-08 | n/a | other_pdf | RDM Utilities - Google Sheets.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-07-08 | n/a | other_pdf | 218 Southwest 4th Street - Proposal.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 20 documents. Checklist activities: 46.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 1 (includes OREF counter forms when matched). **Termination/release-like**: 2. **RSA / sale agreement-like**: 1.
- **PDF dual pipeline coverage**: 8 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 1974 NW NW Newport Hills, Bend, OR 97703

- **Folder id (`saleGuid`)**: `740abefb-b67f-4564-b139-3e9bda1ae29e`
- **MLS**: 220194969
- **SkySlope status**: Closed
- **Linked listingGuid**: a97b0c78-d3e8-4100-a777-3e28cdf6a030
- **Sale price / list price**: 1191000 / 0
- **Contract acceptance**: 2025-07-01
- **Escrow closing**: 2025-08-14
- **Actual closing**: 2025-08-14
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-07-07

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure Pamphlet | Sales Documentation | Completed | 2025-07-08 | Initial Agency Disclosure Pamphlet - 042 OREF.pdf |
| 2 | Residential Purchase Agreement | Sales Documentation | Completed | 2025-07-08 | Residential_Real_Estate_Sale_Agreement_-_001_OREF _2_.pdf |
| 3 | Pre Approval Letter or Proof of Funds | Sales Documentation | Completed | 2025-07-08 | Preapproval for Andrews.pdf |
| 4 | Counter Offers  | Sales Documentation | Completed | 2025-07-08 | Sellers_Counter_Offer_2_-_003_OREF__1__482.pdf |
| 5 | Sale Addendums | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendum | Sales Documentation | Completed | 2025-07-10 | Sellers_Repair_Addendum_1.pdf; Buyers_Repair_Addendum_1.pdf; Buyers_Repair_Addendum_-_022A__2__OREF.pdf |
| 7 | Receipt for Documents  | Sales Documentation | Completed | 2025-07-15 | HOA_Document_Delvirables_2025-07-01_15_48_08_430.pdf |
| 8 | Contingency Removal | Sales Documentation | Optional | n/a |  |
| 9 | Extension of Time Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Notice to Buyer | Seller | Sales Documentation | Optional | n/a |  |
| 11 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale | Sales Documentation | Optional | n/a |  |
| 14 | Sellers Property Disclosures | Disclosures | Completed | 2025-07-08 | SPD_s_135.pdf |
| 14 | Contingent Right To Purchase | Sales Documentation | Optional | n/a |  |
| 15 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 16 | Wood Stove | Fireplace Insert Addendum | Disclosures | Optional | n/a |  |
| 17 | Professional Inspection Addendum | Disclosures | Optional | n/a |  |
| 18 | Electronic Funds Advisory | Disclosures | Completed | 2025-07-08 | Advisory Regarding Electronic Funds - 043 OREF.pdf |
| 19 | Real Estate Compensation Advisory | Disclosures | Completed | 2025-07-08 | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf |
| 20 | FIRPTA Advisory | Disclosures | Completed | 2025-07-15 | Advisory Regarding FIRPTA Tax - 092 OREF.pdf; FIRPTA_-_Statement_of_Qualified_Substitute_458.pdf |
| 21 | Real Estate Forms Advisory | Disclosures | Completed | 2025-07-08 | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf |
| 22 | Smoke Alarms Advisory | Disclosures | Completed | 2025-07-08 | Advisory Regarding Smoke and Carbon Monoxide Alarms - 080 OREF.pdf |
| 23 | Association Advisory | Disclosures | Completed | 2025-07-15 | Owner_Association_Addendum_-_024_OREF.pdf; HOA_Document_Delvirables_2025-07-01_15_48_08_679.pdf |
| 24 | Lead Based Paint Advisory | Disclosures | Optional | n/a |  |
| 25 | CCRs | Reports | Optional | n/a |  |
| 26 | Association Documents | Reports | Optional | n/a |  |
| 27 | Appraisal  | Reports | Optional | n/a |  |
| 28 | Home Inspection  | Reports | Optional | n/a |  |
| 29 | Broker Commission Demand from Title | Closing Documents | Completed | 2025-07-15 | Notice of Real Estate Compensation - 091 OREF.pdf |
| 30 | Earnest Money Receipt | Closing Documents | Completed | 2025-07-08 | EM_777.pdf |
| 31 | Preliminary Title Report | Closing Documents | Completed | 2025-07-15 | PRELIMINARY_REPORT-LINKED-titleLOOK_409.pdf |
| 32 | Final HUD | Closing Documents | Completed | 2025-08-14 | Final_Sellers_Statement_IHLA_361.pdf |
| 33 | Documentation of Repairs or Maintenance | Miscellaneous Documentation | In Review | 2025-08-14 | Receipt_2546_174.pdf |
| 34 | Net Sheets | CMAs | Miscellaneous Documentation | Optional | n/a |  |
| 35 | Skyslope Cover Sheet / Deal Memo | Miscellaneous Documentation | Required | n/a |  |
| 36 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 37 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Buyer Agreement Documentation | Optional | n/a |  |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Optional | n/a |  |
| 40 | Buyer Intake Form | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Pre Approval Letters | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 43 | Disclosed Limited Agency | Buyer Agreement Documentation | Optional | n/a |  |
| 44 | Record of Properties Shown | Buyer Agreement Documentation | Optional | n/a |  |
| 45 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 46 | Copies of Correspondance | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-07 | 2025-07-08 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-07 | 2025-07-08 | other_pdf | Advisory Regarding Smoke and Carbon Monoxide Alarms - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-07 | n/a | counter_or_counteroffer | Buyers_Counter_Offer_1_-_004_OREF _2_.pdf | error: not_pdf_bytes |
| 4 | 2025-07-07 | 2025-07-15 | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-07 | n/a | counter_or_counteroffer | Sellers Counter Offer 2 - 003 OREF.pdf | error: not_pdf_bytes |
| 6 | 2025-07-07 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 7 | 2025-07-07 | n/a | other_pdf | Delivery of Association Documents 1 - 023 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-07 | 2025-07-15 | other_pdf | Disclosed Limited Agency Agreement for Sellers - 040 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-07 | 2025-07-08 | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF _2_.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-07 | 2025-07-15 | other_pdf | Advisory Regarding FIRPTA Tax - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-07-07 | 2025-07-08 | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-07-07 | 2025-07-08 | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-07-07 | 2025-07-08 | listing_agreement | Exclusive Listing Agreement - ODS.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-07-07 | 2025-07-08 | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-07-07 | n/a | seller_property_disclosure | Seller_s Property Disclosure Statement _Non-exempt SPDS_.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-07-07 | 2025-07-15 | addendum | Owner_Association_Addendum_-_024_OREF.pdf | error: not_pdf_bytes |
| 17 | 2025-07-07 | n/a | buyer_offer_or_package | Advisory to Buyers and Sellers Regarding Fair Housing - Seller - 104 OREF.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-07-07 | n/a | addendum | Sellers Property Disclosure Statement Addendum - 028 OREF.pdf | error: not_pdf_bytes |
| 19 | 2025-07-07 | 2025-07-08 | lender_financing | Preapproval for Andrews.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-07-07 | 2025-07-08 | other_pdf | Advisory Regarding Electronic Funds - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 21 | 2025-07-07 | 2025-07-08 | counter_or_counteroffer | Sellers_Counter_Offer_2_-_003_OREF__1__482.pdf | error: not_pdf_bytes |
| 22 | 2025-07-08 | n/a | addendum | Buyers_Repair_Addendum_-_022A__1__OREF_276.pdf | error: not_pdf_bytes |
| 23 | 2025-07-08 | 2025-07-15 | title_or_hoa | HOA_Document_Delvirables_2025-07-01_15_48_08_430.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-07-08 | 2025-07-08 | seller_property_disclosure | SPD_s_135.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-07-08 | 2025-07-10 | addendum | Buyers_Repair_Addendum_1.pdf | error: not_pdf_bytes |
| 26 | 2025-07-08 | n/a | addendum | Sellers Repair Addendum - 022B _1_ OREF.pdf | error: not_pdf_bytes |
| 27 | 2025-07-08 | 2025-07-08 | other_pdf | EM_777.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-07-09 | n/a | addendum | Buyers_Repair_Addendum_-_022A__2__OREF_625.pdf | error: not_pdf_bytes |
| 29 | 2025-07-09 | 2025-07-10 | addendum | Sellers_Repair_Addendum_1.pdf | error: not_pdf_bytes |
| 30 | 2025-07-09 | n/a | other_pdf | First_American_HW_528.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-07-10 | 2025-07-10 | addendum | Buyers_Repair_Addendum_-_022A__2__OREF.pdf | error: not_pdf_bytes |
| 32 | 2025-07-15 | 2025-07-15 | title_or_hoa | PRELIMINARY_REPORT-LINKED-titleLOOK_409.pdf | _not in prioritized subset for this run_ |
| 33 | 2025-07-15 | 2025-08-14 | title_or_hoa | HOA_Document_Delvirables_2025-07-01_15_48_08_679.pdf | _not in prioritized subset for this run_ |
| 34 | 2025-07-22 | 2025-08-14 | other_pdf | Receipt_2546_174.pdf | _not in prioritized subset for this run_ |
| 35 | 2025-08-01 | n/a | addendum | Contingency Removal Addendum 1 - 060 OREF.pdf | error: not_pdf_bytes |
| 36 | 2025-08-14 | 2025-08-14 | closing_adjacent | Final_Sellers_Statement_IHLA_361.pdf | _not in prioritized subset for this run_ |
| 37 | 2025-08-14 | 2025-08-14 | other_pdf | FIRPTA_-_Statement_of_Qualified_Substitute_458.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 37 documents. Checklist activities: 47.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 4 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 1.
- **PDF dual pipeline coverage**: 13 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 2680 NW Nordic Avenue, Bend, OR 97703

- **Folder id (`saleGuid`)**: `6be4810f-eda4-433d-ad6f-f27b80a1c6e0`
- **MLS**: 220184043
- **SkySlope status**: Canceled/App
- **Linked listingGuid**: n/a
- **Sale price / list price**: 1395000 / 0
- **Contract acceptance**: 2025-04-12
- **Escrow closing**: 2025-07-14
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-07-06

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure Pamphlet | Sales Documentation | Optional | n/a |  |
| 2 | Residential Purchase Agreement | Sales Documentation | Completed | 2025-07-07 | Residential_Real_Estate_Sale_Agreement_-_001_OREF__1_.pdf; Residential_Real_Estate_Sale_Agreement_-_001_OREF-2__1_.pdf |
| 3 | Pre Approval Letter or Proof of Funds | Sales Documentation | Completed | 2025-07-15 | 2_DigiSign_Approval_Letter.pdf |
| 4 | Counter Offers  | Sales Documentation | Completed | 2025-07-08 | Sellers Counteroffer - 1_25.pdf; 1_Buyers_Counter_Offer_1_-_004_OREF.pdf; Sellers Counteroffer - 1_25_2.pdf; Buyers_Counter_Offer_2_-_004_OREF__1_.pdf; FB_Sellers_Counteroffer___1_25__1_.pdf |
| 5 | Sale Addendums | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendum | Sales Documentation | Completed | 2025-07-08 | 2_Addendum_to_Sale_Agreement___1_25__1_.pdf |
| 7 | Receipt for Documents  | Sales Documentation | Optional | n/a |  |
| 8 | Contingency Removal | Sales Documentation | Optional | n/a |  |
| 9 | Extension of Time Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Notice to Buyer | Seller | Sales Documentation | Optional | n/a |  |
| 11 | Termination of Contract  | Sales Documentation | Completed | 2025-07-16 | Termination_2025-07-15_16_57_05__1_.pdf |
| 12 | Agreement to Occupy | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale | Sales Documentation | Optional | n/a |  |
| 14 | Sellers Property Disclosures | Disclosures | Completed | 2025-07-08 | SS_-_SPDs_Addendum.pdf; SS_-_SPDs__1_.pdf |
| 14 | Contingent Right To Purchase | Sales Documentation | Completed | 2025-07-08 | Buyers_Contingent_Right_to_Purchase_Addendum__1_25.pdf |
| 15 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 16 | Wood Stove | Fireplace Insert Addendum | Disclosures | Optional | n/a |  |
| 17 | Professional Inspection Addendum | Disclosures | Optional | n/a |  |
| 18 | Electronic Funds Advisory | Disclosures | Required | n/a |  |
| 19 | Real Estate Compensation Advisory | Disclosures | Required | n/a |  |
| 20 | FIRPTA Advisory | Disclosures | Required | n/a |  |
| 21 | Real Estate Forms Advisory | Disclosures | Required | n/a |  |
| 22 | Smoke Alarms Advisory | Disclosures | Required | n/a |  |
| 23 | Association Advisory | Disclosures | Optional | n/a |  |
| 24 | Lead Based Paint Advisory | Disclosures | Optional | n/a |  |
| 25 | CCRs | Reports | Optional | n/a |  |
| 26 | Association Documents | Reports | Optional | n/a |  |
| 27 | Appraisal  | Reports | Optional | n/a |  |
| 28 | Home Inspection  | Reports | Completed | 2025-07-08 | Full_Home_Inspection_2680_NW_Nordic_Ave__Bend__OR_97703_Elsa_Uchikawa_12098_311__1_.pdf; Radon.pdf |
| 29 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 30 | Earnest Money Receipt | Closing Documents | Completed | 2025-07-08 | Deposit_Receipt__1_.pdf |
| 31 | Preliminary Title Report | Closing Documents | Completed | 2025-07-08 | _OR__Preliminary_Title_Report_-N.pdf |
| 32 | Final HUD | Closing Documents | Required | n/a |  |
| 33 | Documentation of Repairs or Maintenance | Miscellaneous Documentation | Optional | n/a |  |
| 34 | Net Sheets | CMAs | Miscellaneous Documentation | Optional | n/a |  |
| 35 | Skyslope Cover Sheet / Deal Memo | Miscellaneous Documentation | Required | n/a |  |
| 36 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 37 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Buyer Agreement Documentation | Completed | 2025-07-07 | Initial Agency Disclosure Pamphlet - 042 OREF.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Completed | 2025-07-07 | Buyer Representation Agreement - Exclusive - 050 OREF.pdf |
| 40 | Buyer Intake Form | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Pre Approval Letters | Buyer Agreement Documentation | Completed | 2025-07-07 | Approval Letter.pdf |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 43 | Disclosed Limited Agency | Buyer Agreement Documentation | Completed | 2025-07-07 | Disclosed Limited Agency Agreement for Buyers - 041 OREF.pdf |
| 44 | Record of Properties Shown | Buyer Agreement Documentation | Optional | n/a |  |
| 45 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 46 | Copies of Correspondance | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-06 | 2025-07-07 | listing_agreement | Buyer Representation Agreement - Exclusive - 050 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-06 | 2025-07-07 | buyer_offer_or_package | Disclosed Limited Agency Agreement for Buyers - 041 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-06 | n/a | addendum | Contingency_Removal_Addendum___3_25.pdf | error: not_pdf_bytes |
| 4 | 2025-07-06 | n/a | addendum | Addendum to Sale Agreement 3 - 002 OREF.pdf | pages=1, read=1, textLen=5527, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 5 | 2025-07-06 | n/a | listing_agreement | Buyer Representation Agreement - Exclusive - 050 OREF_2.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-07-06 | 2025-07-08 | counter_or_counteroffer | Sellers Counteroffer - 1_25.pdf | error: not_pdf_bytes |
| 7 | 2025-07-06 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF.pdf | pages=16, read=12, textLen=135911, 16 pg · read 12 · rich · Digi×12 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 8 | 2025-07-06 | n/a | counter_or_counteroffer | FB Sellers_Counteroffer___1_25.pdf | error: not_pdf_bytes |
| 9 | 2025-07-06 | n/a | counter_or_counteroffer | Buyers Counter Offer 2 - 004 OREF.pdf | error: not_pdf_bytes |
| 10 | 2025-07-06 | n/a | addendum | Buyers Repair Addendum - 022A _1_ OREF.pdf | error: not_pdf_bytes |
| 11 | 2025-07-06 | n/a | addendum | NORDIC Buyers Contingent Right to Purchase Addendum- 1_25.pdf | error: not_pdf_bytes |
| 12 | 2025-07-06 | n/a | addendum | Addendum to Sale Agreement 2 - 002 OREF.pdf | pages=1, read=1, textLen=5373, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 13 | 2025-07-06 | n/a | addendum | Addendum to Sale Agreement - 1_25.pdf | pages=1, read=1, textLen=3964, 1 pg · rich · Digi×1 Docu×2 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 14 | 2025-07-06 | 2025-07-07 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-07-06 | 2025-07-08 | addendum | Buyers_Contingent_Right_to_Purchase_Addendum__1_25.pdf | error: not_pdf_bytes |
| 16 | 2025-07-06 | n/a | buyer_offer_or_package | Advisory Regarding Real Estate Compensation - Buyer - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-07-06 | n/a | addendum | Nordic Addendum_to_Sale_Agreement_2_-_002_OREF.pdf | error: not_pdf_bytes |
| 18 | 2025-07-06 | n/a | addendum | Addendum_to_Sale_Agreement___1_25 _1_.pdf | error: not_pdf_bytes |
| 19 | 2025-07-06 | 2025-07-07 | lender_financing | Approval Letter.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-07-06 | n/a | counter_or_counteroffer | Buyers Counter Offer 1 - 004 OREF.pdf | error: not_pdf_bytes |
| 21 | 2025-07-06 | n/a | buyer_offer_or_package | MS - Buyers Contingent Right to Purchase - to be rejected _ rewritten.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-07-06 | 2025-07-08 | counter_or_counteroffer | Sellers Counteroffer - 1_25_2.pdf | error: not_pdf_bytes |
| 23 | 2025-07-06 | n/a | buyer_offer_or_package | Buyers Contingent Right to Purchase - 083 OREF.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-07-06 | n/a | addendum | Sellers_Repair_Addendum___1_25.pdf | error: not_pdf_bytes |
| 25 | 2025-07-07 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF__1_.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-07-08 | n/a | counter_or_counteroffer | 1_Buyers_Counter_Offer_1_-_004_OREF.pdf | error: not_pdf_bytes |
| 27 | 2025-07-08 | n/a | counter_or_counteroffer | Buyers_Counter_Offer_2_-_004_OREF__1_.pdf | error: not_pdf_bytes |
| 28 | 2025-07-08 | n/a | counter_or_counteroffer | FB_Sellers_Counteroffer___1_25__1_.pdf | error: not_pdf_bytes |
| 29 | 2025-07-08 | n/a | addendum | 2_Addendum_to_Sale_Agreement___1_25__1_.pdf | error: not_pdf_bytes |
| 30 | 2025-07-08 | n/a | addendum | SS_-_SPDs_Addendum.pdf | error: not_pdf_bytes |
| 31 | 2025-07-08 | n/a | seller_property_disclosure | SS_-_SPDs__1_.pdf | _not in prioritized subset for this run_ |
| 32 | 2025-07-08 | n/a | inspection_or_repair | Full_Home_Inspection_2680_NW_Nordic_Ave__Bend__OR_97703_Elsa_Uchikawa_12098_311__1_.pdf | _not in prioritized subset for this run_ |
| 33 | 2025-07-08 | 2025-07-15 | other_pdf | Radon.pdf | _not in prioritized subset for this run_ |
| 34 | 2025-07-08 | n/a | title_or_hoa | _OR__Preliminary_Title_Report_-N.pdf | _not in prioritized subset for this run_ |
| 35 | 2025-07-08 | n/a | earnest_or_wire | Deposit_Receipt__1_.pdf | _not in prioritized subset for this run_ |
| 36 | 2025-07-15 | n/a | other_pdf | 2_DigiSign_Approval_Letter.pdf | _not in prioritized subset for this run_ |
| 37 | 2025-07-15 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF-2__1_.pdf | _not in prioritized subset for this run_ |
| 38 | 2025-07-15 | n/a | addendum | Addendum to Sale Agreement 4 - 002 OREF.pdf | pages=1, read=1, textLen=5526, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 39 | 2025-07-15 | 2025-07-16 | termination_or_release | Termination Agreement - 057 OREF.pdf | pages=1, read=1, textLen=5795, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, negative_outcome_word_present, signature_labels_present |
| 40 | 2025-07-16 | n/a | termination_or_release | Termination_2025-07-15_16_57_05__1_.pdf | pages=1, read=1, textLen=6191, 1 pg · rich · Digi×1 Docu×4 SignedBy×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, negative_outcome_word_present, signature_labels_present |

### Narrative timeline (best-effort)

- **Forms inventory**: 40 documents. Checklist activities: 47.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 4 ("offer" family). **Counter-like**: 8 (includes OREF counter forms when matched). **Termination/release-like**: 2. **RSA / sale agreement-like**: 3.
- **PDF dual pipeline coverage**: 24 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 2680 NW Nordic Avenue, Bend, OR 97703

- **Folder id (`saleGuid`)**: `0ec95d31-1fed-4519-a114-e967513eac33`
- **MLS**: n/a
- **SkySlope status**: Canceled/App
- **Linked listingGuid**: n/a
- **Sale price / list price**: 1249000 / 0
- **Contract acceptance**: n/a
- **Escrow closing**: 2025-07-14
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-07-06

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure Pamphlet | Sales Documentation | Required | n/a |  |
| 2 | Residential Purchase Agreement | Sales Documentation | Required | n/a |  |
| 3 | Pre Approval Letter or Proof of Funds | Sales Documentation | Optional | n/a |  |
| 4 | Counter Offers  | Sales Documentation | Optional | n/a |  |
| 5 | Sale Addendums | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendum | Sales Documentation | Optional | n/a |  |
| 7 | Receipt for Documents  | Sales Documentation | Optional | n/a |  |
| 8 | Contingency Removal | Sales Documentation | Optional | n/a |  |
| 9 | Extension of Time Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Notice to Buyer | Seller | Sales Documentation | Optional | n/a |  |
| 11 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale | Sales Documentation | Optional | n/a |  |
| 14 | Sellers Property Disclosures | Disclosures | Required | n/a |  |
| 14 | Contingent Right To Purchase | Sales Documentation | Optional | n/a |  |
| 15 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 16 | Wood Stove | Fireplace Insert Addendum | Disclosures | Optional | n/a |  |
| 17 | Professional Inspection Addendum | Disclosures | Optional | n/a |  |
| 18 | Electronic Funds Advisory | Disclosures | Required | n/a |  |
| 19 | Real Estate Compensation Advisory | Disclosures | Required | n/a |  |
| 20 | FIRPTA Advisory | Disclosures | Required | n/a |  |
| 21 | Real Estate Forms Advisory | Disclosures | Required | n/a |  |
| 22 | Smoke Alarms Advisory | Disclosures | Required | n/a |  |
| 23 | Association Advisory | Disclosures | Optional | n/a |  |
| 24 | Lead Based Paint Advisory | Disclosures | Optional | n/a |  |
| 25 | CCRs | Reports | Optional | n/a |  |
| 26 | Association Documents | Reports | Optional | n/a |  |
| 27 | Appraisal  | Reports | Optional | n/a |  |
| 28 | Home Inspection  | Reports | Optional | n/a |  |
| 29 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 30 | Earnest Money Receipt | Closing Documents | Required | n/a |  |
| 31 | Preliminary Title Report | Closing Documents | Required | n/a |  |
| 32 | Final HUD | Closing Documents | Required | n/a |  |
| 33 | Documentation of Repairs or Maintenance | Miscellaneous Documentation | Optional | n/a |  |
| 34 | Net Sheets | CMAs | Miscellaneous Documentation | Optional | n/a |  |
| 35 | Skyslope Cover Sheet / Deal Memo | Miscellaneous Documentation | Required | n/a |  |
| 36 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 37 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Buyer Agreement Documentation | Required | n/a |  |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Required | n/a |  |
| 40 | Buyer Intake Form | Buyer Agreement Documentation | Required | n/a |  |
| 41 | Pre Approval Letters | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 43 | Disclosed Limited Agency | Buyer Agreement Documentation | Optional | n/a |  |
| 44 | Record of Properties Shown | Buyer Agreement Documentation | Optional | n/a |  |
| 45 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 46 | Copies of Correspondance | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-06 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-06 | n/a | addendum | Contingency_Removal_Addendum___3_25.pdf | error: not_pdf_bytes |
| 3 | 2025-07-06 | n/a | addendum | Sellers_Repair_Addendum___1_25.pdf | error: not_pdf_bytes |
| 4 | 2025-07-06 | n/a | addendum | Buyers_Contingent_Right_to_Purchase_Addendum__1_25.pdf | error: not_pdf_bytes |
| 5 | 2025-07-06 | n/a | addendum | Buyers Repair Addendum - 022A _1_ OREF.pdf | error: not_pdf_bytes |
| 6 | 2025-07-06 | n/a | buyer_offer_or_package | Buyers Contingent Right to Purchase - 083 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-07-06 | n/a | counter_or_counteroffer | Sellers Counteroffer - 1_25.pdf | error: not_pdf_bytes |
| 8 | 2025-07-06 | n/a | buyer_offer_or_package | MS - Buyers Contingent Right to Purchase - to be rejected _ rewritten.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-06 | n/a | counter_or_counteroffer | FB Sellers_Counteroffer___1_25.pdf | error: not_pdf_bytes |
| 10 | 2025-07-06 | n/a | listing_agreement | Buyer Representation Agreement - Exclusive - 050 OREF.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-07-06 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF.pdf | pages=16, read=12, textLen=135911, 16 pg · read 12 · rich · Digi×12 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 12 | 2025-07-06 | n/a | addendum | Addendum to Sale Agreement 3 - 002 OREF.pdf | pages=1, read=1, textLen=5527, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 13 | 2025-07-06 | n/a | counter_or_counteroffer | Buyers Counter Offer 2 - 004 OREF.pdf | error: not_pdf_bytes |
| 14 | 2025-07-06 | n/a | counter_or_counteroffer | Sellers Counteroffer - 1_25_2.pdf | error: not_pdf_bytes |
| 15 | 2025-07-06 | n/a | buyer_offer_or_package | Disclosed Limited Agency Agreement for Buyers - 041 OREF.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-07-06 | n/a | buyer_offer_or_package | Advisory Regarding Real Estate Compensation - Buyer - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-07-06 | n/a | addendum | NORDIC Buyers Contingent Right to Purchase Addendum- 1_25.pdf | error: not_pdf_bytes |
| 18 | 2025-07-06 | n/a | addendum | Nordic Addendum_to_Sale_Agreement_2_-_002_OREF.pdf | error: not_pdf_bytes |
| 19 | 2025-07-06 | n/a | addendum | Addendum to Sale Agreement - 1_25.pdf | pages=1, read=1, textLen=3964, 1 pg · rich · Digi×1 Docu×2 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, alt_e_sign_vendor_possible, signature_labels_present |
| 20 | 2025-07-06 | n/a | addendum | Addendum_to_Sale_Agreement___1_25 _1_.pdf | error: not_pdf_bytes |
| 21 | 2025-07-06 | n/a | lender_financing | Approval Letter.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-07-06 | n/a | listing_agreement | Buyer Representation Agreement - Exclusive - 050 OREF_2.pdf | _not in prioritized subset for this run_ |
| 23 | 2025-07-06 | n/a | addendum | Addendum to Sale Agreement 2 - 002 OREF.pdf | pages=1, read=1, textLen=5373, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 24 | 2025-07-06 | n/a | counter_or_counteroffer | Buyers Counter Offer 1 - 004 OREF.pdf | error: not_pdf_bytes |

### Narrative timeline (best-effort)

- **Forms inventory**: 24 documents. Checklist activities: 47.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 4 ("offer" family). **Counter-like**: 5 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 1.
- **PDF dual pipeline coverage**: 16 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 3480 SW 45th Street, Redmond, OR 97756

- **Folder id (`saleGuid`)**: `59152e77-3d51-4b97-a06c-e9810c71689a`
- **MLS**: 220200502
- **SkySlope status**: Closed
- **Linked listingGuid**: n/a
- **Sale price / list price**: 650000 / 0
- **Contract acceptance**: 2025-07-06
- **Escrow closing**: 2025-08-14
- **Actual closing**: 2025-08-14
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-07-06

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure Pamphlet | Sales Documentation | Optional | n/a |  |
| 2 | Residential Purchase Agreement | Sales Documentation | Completed | 2025-07-06 | Residential_Real_Estate_Sale_Agreement_-_001_OREF_681_153.pdf |
| 3 | Pre Approval Letter or Proof of Funds | Sales Documentation | Optional | n/a |  |
| 4 | Counter Offers  | Sales Documentation | Completed | 2025-07-06 | Sellers_Counter_Offer_1_-_003_OREF _7_.pdf |
| 5 | Sale Addendums | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendum | Sales Documentation | Optional | n/a |  |
| 7 | Receipt for Documents  | Sales Documentation | Optional | n/a |  |
| 8 | Contingency Removal | Sales Documentation | Optional | n/a |  |
| 9 | Extension of Time Addendum  | Sales Documentation | Completed | 2025-08-14 | SKM_C250i25073111330_848.pdf |
| 10 | Notice to Buyer | Seller | Sales Documentation | Optional | n/a |  |
| 11 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale | Sales Documentation | Optional | n/a |  |
| 14 | Sellers Property Disclosures | Disclosures | Completed | 2025-08-14 | 1d9f4bf5ae604e458b7a4718342463c3_791.pdf |
| 14 | Contingent Right To Purchase | Sales Documentation | Optional | n/a |  |
| 15 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 16 | Wood Stove | Fireplace Insert Addendum | Disclosures | Optional | n/a |  |
| 17 | Professional Inspection Addendum | Disclosures | Optional | n/a |  |
| 18 | Electronic Funds Advisory | Disclosures | Completed | 2025-07-07 | Advisory Regarding Electronic Funds - Buyer - 043 OREF.pdf |
| 19 | Real Estate Compensation Advisory | Disclosures | Completed | 2025-07-07 | Advisory Regarding Real Estate Compensation - Buyer - 047 OREF.pdf |
| 20 | FIRPTA Advisory | Disclosures | Completed | 2025-08-14 | FIRPTA_164.pdf |
| 21 | Real Estate Forms Advisory | Disclosures | Completed | 2025-07-07 | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Buyer - 108 OREF.pdf |
| 22 | Smoke Alarms Advisory | Disclosures | Completed | 2025-07-07 | Advisory Regarding Smoke and Carbon Monoxide Alarms - Buyer - 080 OREF.pdf |
| 23 | Association Advisory | Disclosures | Optional | n/a |  |
| 24 | Lead Based Paint Advisory | Disclosures | Optional | n/a |  |
| 25 | CCRs | Reports | Optional | n/a |  |
| 25 | Advisory Regarding Title Insurance | Disclosures | Completed | 2025-07-07 | Advisory Regarding Title Insurance - Buyer - 103 OREF.pdf |
| 26 | Association Documents | Reports | Optional | n/a |  |
| 27 | Appraisal  | Reports | Optional | n/a |  |
| 28 | Home Inspection  | Reports | Optional | n/a |  |
| 29 | Broker Commission Demand from Title | Closing Documents | Completed | 2025-07-15 | Notice_of_Real_Estate_Compensation_-_091_OREF_580.pdf |
| 30 | Earnest Money Receipt | Closing Documents | Completed | 2025-07-08 | EMR_399.pdf |
| 31 | Preliminary Title Report | Closing Documents | Completed | 2025-07-08 | TM_OR_Prelim_Sale_w_Loan_737.pdf; DE24656_Map_286.pdf |
| 32 | Final HUD | Closing Documents | Completed | 2025-08-14 | Seller_Final_615.pdf |
| 33 | Documentation of Repairs or Maintenance | Miscellaneous Documentation | Optional | n/a |  |
| 34 | Net Sheets | CMAs | Miscellaneous Documentation | Optional | n/a |  |
| 35 | Skyslope Cover Sheet / Deal Memo | Miscellaneous Documentation | Required | n/a |  |
| 36 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 37 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Buyer Agreement Documentation | Completed | 2025-07-06 | Initial_Agency_Disclosure_Pamphlet_-_042_OREF_2025-07-06_12_21_35.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Completed | 2025-07-06 | Buyer_Representation_Agreement_-_Exclusive_-_050_OREF_2025-07-06_12_21_30.pdf |
| 40 | Buyer Intake Form | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Pre Approval Letters | Buyer Agreement Documentation | Completed | 2025-07-08 | Millard_pre-qualification_letter_650K_purchase_with_20__down_670.pdf |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Completed | 2025-07-08 | 3480_Comps.pdf |
| 43 | Disclosed Limited Agency | Buyer Agreement Documentation | Optional | n/a |  |
| 44 | Record of Properties Shown | Buyer Agreement Documentation | Optional | n/a |  |
| 45 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 46 | Copies of Correspondance | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-06 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF.pdf | pages=15, read=12, textLen=135400, 15 pg · read 12 · rich · Digi×12 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 2 | 2025-07-06 | n/a | counter_or_counteroffer | Sellers_Counter_Offer_1_-_003_OREF_105.pdf | error: not_pdf_bytes |
| 3 | 2025-07-06 | 2025-07-06 | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF_681_153.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-06 | 2025-07-06 | agency_disclosure_pamphlet | Initial_Agency_Disclosure_Pamphlet_-_042_OREF_2025-07-06_12_21_35.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-06 | 2025-07-06 | listing_agreement | Buyer_Representation_Agreement_-_Exclusive_-_050_OREF_2025-07-06_12_21_30.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-07-06 | n/a | counter_or_counteroffer | Sellers_Counter_Offer_1_-_003_OREF_635.pdf | error: not_pdf_bytes |
| 7 | 2025-07-06 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF_681_507.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-06 | 2025-07-06 | counter_or_counteroffer | Sellers_Counter_Offer_1_-_003_OREF _7_.pdf | error: not_pdf_bytes |
| 9 | 2025-07-07 | 2025-07-07 | buyer_offer_or_package | Advisory Regarding Real Estate Compensation - Buyer - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-07 | 2025-07-07 | buyer_offer_or_package | Advisory Regarding Electronic Funds - Buyer - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-07-07 | 2025-07-07 | buyer_offer_or_package | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Buyer - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-07-07 | 2025-07-07 | buyer_offer_or_package | Advisory Regarding Smoke and Carbon Monoxide Alarms - Buyer - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-07-07 | 2025-07-07 | title_or_hoa | Advisory Regarding Title Insurance - Buyer - 103 OREF.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-07-08 | 2025-07-08 | lender_financing | TM_OR_Prelim_Sale_w_Loan_737.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-07-08 | 2025-07-08 | other_pdf | DE24656_Map_286.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-07-08 | 2025-07-08 | other_pdf | Millard_pre-qualification_letter_650K_purchase_with_20__down_670.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-07-08 | n/a | other_pdf | 3480_Comps.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-07-08 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | pages=1, read=1, textLen=5254, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 19 | 2025-07-08 | 2025-07-08 | other_pdf | EMR_399.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-07-08 | n/a | other | image004_672.png | _not in prioritized subset for this run_ |
| 21 | 2025-07-08 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-07-08 | 2025-07-15 | amendment_or_notice | Notice_of_Real_Estate_Compensation_-_091_OREF_580.pdf | _not in prioritized subset for this run_ |
| 23 | 2025-07-09 | n/a | other_pdf | 1d9f4bf5ae604e458b7a4718342463c3.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-07-09 | 2025-08-14 | other_pdf | 1d9f4bf5ae604e458b7a4718342463c3_791.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-07-31 | n/a | addendum | Addendum to Sale Agreement 3 - 002 OREF.pdf | pages=1, read=1, textLen=5353, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 26 | 2025-08-14 | 2025-08-14 | closing_adjacent | Seller_Final_615.pdf | _not in prioritized subset for this run_ |
| 27 | 2025-08-14 | 2025-08-14 | other_pdf | FIRPTA_164.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-08-14 | n/a | other | image004_408.png | _not in prioritized subset for this run_ |
| 29 | 2025-08-14 | n/a | other | image005_709.png | _not in prioritized subset for this run_ |
| 30 | 2025-08-14 | n/a | other_pdf | SKM_C250i25073111330_848.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-08-15 | n/a | other_pdf | Agreement to Occupy After Closing - 054 OREF.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 31 documents. Checklist activities: 48.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 4 ("offer" family). **Counter-like**: 3 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 3.
- **PDF dual pipeline coverage**: 6 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file:  , , 

- **Folder id (`saleGuid`)**: `f261f38e-b187-4640-a461-c3c69a189bf5`
- **MLS**: n/a
- **SkySlope status**: Canceled/App
- **Linked listingGuid**: n/a
- **Sale price / list price**: 0 / 0
- **Contract acceptance**: n/a
- **Escrow closing**: n/a
- **Actual closing**: n/a
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-07-05

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure Pamphlet | Sales Documentation | Required | n/a |  |
| 2 | Residential Purchase Agreement | Sales Documentation | Required | n/a |  |
| 3 | Pre Approval Letter or Proof of Funds | Sales Documentation | Optional | n/a |  |
| 4 | Counter Offers  | Sales Documentation | Optional | n/a |  |
| 5 | Sale Addendums | Sales Documentation | Optional | n/a |  |
| 6 | Repair Addendum | Sales Documentation | Optional | n/a |  |
| 7 | Receipt for Documents  | Sales Documentation | Optional | n/a |  |
| 8 | Contingency Removal | Sales Documentation | Optional | n/a |  |
| 9 | Extension of Time Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Notice to Buyer | Seller | Sales Documentation | Optional | n/a |  |
| 11 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale | Sales Documentation | Optional | n/a |  |
| 14 | Sellers Property Disclosures | Disclosures | Required | n/a |  |
| 15 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 16 | Wood Stove | Fireplace Insert Addendum | Disclosures | Optional | n/a |  |
| 17 | Professional Inspection Addendum | Disclosures | Optional | n/a |  |
| 18 | Electronic Funds Advisory | Disclosures | Required | n/a |  |
| 19 | Real Estate Compensation Advisory | Disclosures | Required | n/a |  |
| 20 | FIRPTA Advisory | Disclosures | Required | n/a |  |
| 21 | Real Estate Forms Advisory | Disclosures | Required | n/a |  |
| 22 | Smoke Alarms Advisory | Disclosures | Required | n/a |  |
| 23 | Association Advisory | Disclosures | Optional | n/a |  |
| 24 | Lead Based Paint Advisory | Disclosures | Optional | n/a |  |
| 25 | CCRs | Reports | Optional | n/a |  |
| 26 | Association Documents | Reports | Optional | n/a |  |
| 27 | Appraisal  | Reports | Optional | n/a |  |
| 28 | Home Inspection  | Reports | Optional | n/a |  |
| 29 | Broker Commission Demand from Title | Closing Documents | Required | n/a |  |
| 30 | Earnest Money Receipt | Closing Documents | Required | n/a |  |
| 31 | Preliminary Title Report | Closing Documents | Required | n/a |  |
| 32 | Final HUD | Closing Documents | Required | n/a |  |
| 33 | Documentation of Repairs or Maintenance | Miscellaneous Documentation | Optional | n/a |  |
| 34 | Net Sheets | CMAs | Miscellaneous Documentation | Optional | n/a |  |
| 35 | Skyslope Cover Sheet / Deal Memo | Miscellaneous Documentation | Required | n/a |  |
| 36 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 37 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Buyer Agreement Documentation | Completed | 2025-07-05 | Initial Agency Disclosure Pamphlet - 042 OREF.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Completed | 2025-07-05 | Buyer Representation Agreement - Exclusive - 050 OREF.pdf |
| 40 | Buyer Intake Form | Buyer Agreement Documentation | Required | n/a |  |
| 41 | Pre Approval Letters | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 43 | Disclosed Limited Agency | Buyer Agreement Documentation | Optional | n/a |  |
| 44 | Record of Properties Shown | Buyer Agreement Documentation | Optional | n/a |  |
| 45 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 46 | Copies of Correspondance | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-05 | 2025-07-05 | listing_agreement | Buyer Representation Agreement - Exclusive - 050 OREF.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-05 | n/a | listing_agreement | Buyer Representation Agreement - Exclusive - 050 OREF_2.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-05 | n/a | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF_2.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 4 documents. Checklist activities: 46.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 0 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 0 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Canceled/App**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 1050 NE Butler Market Rd #2, Bend, OR 97701

- **Folder id (`saleGuid`)**: `6ef1013a-3e17-47ce-b8bb-da0289930d17`
- **MLS**: 220196853
- **SkySlope status**: Closed
- **Linked listingGuid**: 8195a9a9-73cd-4d90-938e-05cdbc6639a8
- **Sale price / list price**: 299000 / 0
- **Contract acceptance**: 2025-06-07
- **Escrow closing**: 2025-06-13
- **Actual closing**: 2025-06-06
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-07-05

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure Pamphlet | Sales Documentation | In Review | 2025-07-05 | Initial_Agency_Disclosure_Pamphlet_-_042_OREF.pdf |
| 2 | Residential Purchase Agreement | Sales Documentation | In Review | 2025-07-05 | Offer 1050 NE Butler Market _2.pdf |
| 3 | Pre Approval Letter or Proof of Funds | Sales Documentation | Optional | n/a |  |
| 4 | Counter Offers  | Sales Documentation | In Review | 2025-07-05 | Initial_Agency_Disclosure_Pamphlet_-_042_OREF_2.pdf |
| 5 | Sale Addendums | Sales Documentation | In Review | 2025-07-05 | Addendum_to_extend_counter_expiration_2025-06-10_05_36_21.pdf |
| 6 | Repair Addendum | Sales Documentation | Optional | n/a |  |
| 7 | Receipt for Documents  | Sales Documentation | Optional | n/a |  |
| 8 | Contingency Removal | Sales Documentation | Optional | n/a |  |
| 9 | Extension of Time Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Notice to Buyer | Seller | Sales Documentation | Optional | n/a |  |
| 11 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale | Sales Documentation | Optional | n/a |  |
| 14 | Sellers Property Disclosures | Disclosures | In Review | 2025-07-05 | Sellers_Property_Disclosures_2025-06-09_Butler_Market__2_2.pdf |
| 15 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 16 | Wood Stove | Fireplace Insert Addendum | Disclosures | Optional | n/a |  |
| 17 | Professional Inspection Addendum | Disclosures | Optional | n/a |  |
| 18 | Electronic Funds Advisory | Disclosures | In Review | 2025-07-05 | Advisory_Regarding_Electronic_Funds_-_Seller_-_043_OREF.pdf |
| 19 | Real Estate Compensation Advisory | Disclosures | In Review | 2025-07-05 | Notice of Real Estate Compensation - 091 OREF.pdf |
| 20 | FIRPTA Advisory | Disclosures | In Review | 2025-07-05 | FIRPTA-Qualified_Substitute_Statement.pdf |
| 21 | Real Estate Forms Advisory | Disclosures | Optional | n/a |  |
| 22 | Smoke Alarms Advisory | Disclosures | Optional | n/a |  |
| 23 | Association Advisory | Disclosures | Optional | n/a |  |
| 24 | Lead Based Paint Advisory | Disclosures | Optional | n/a |  |
| 25 | CCRs | Reports | Optional | n/a |  |
| 26 | Association Documents | Reports | Optional | n/a |  |
| 27 | Appraisal  | Reports | Optional | n/a |  |
| 28 | Home Inspection  | Reports | Optional | n/a |  |
| 29 | Broker Commission Demand from Title | Closing Documents | In Review | 2025-07-05 | Notice_of_Real_Estate_Compensation_-_091_OREF__4_.pdf |
| 30 | Earnest Money Receipt | Closing Documents | Required | n/a |  |
| 31 | Preliminary Title Report | Closing Documents | Required | n/a |  |
| 32 | Final HUD | Closing Documents | Required | n/a |  |
| 33 | Documentation of Repairs or Maintenance | Miscellaneous Documentation | Optional | n/a |  |
| 34 | Net Sheets | CMAs | Miscellaneous Documentation | Optional | n/a |  |
| 35 | Skyslope Cover Sheet / Deal Memo | Miscellaneous Documentation | Required | n/a |  |
| 36 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 37 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Buyer Agreement Documentation | Optional | n/a |  |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Optional | n/a |  |
| 40 | Buyer Intake Form | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Pre Approval Letters | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 43 | Disclosed Limited Agency | Buyer Agreement Documentation | Optional | n/a |  |
| 44 | Record of Properties Shown | Buyer Agreement Documentation | Optional | n/a |  |
| 45 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 46 | Copies of Correspondance | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-03 | 2025-07-03 | listing_agreement | Exclusive Listing Agreement - ODS.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-03 | n/a | counter_or_counteroffer | Sellers Counter Offer 1 - 003 OREF.pdf | error: not_pdf_bytes |
| 3 | 2025-07-03 | 2025-07-03 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-03 | n/a | addendum | Addendum_to_Sale_Agreement_1_-_002_OREF _2_.pdf | error: not_pdf_bytes |
| 5 | 2025-07-03 | 2025-07-05 | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-07-03 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-07-03 | 2025-07-03 | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-03 | n/a | buyer_offer_or_package | Advisory Regarding FIRPTA Tax - Buyer - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-03 | 2025-07-03 | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-03 | 2025-07-05 | buyer_offer_or_package | Offer 1050 NE Butler Market _2.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-07-05 | n/a | agency_disclosure_pamphlet | Initial_Agency_Disclosure_Pamphlet_-_042_OREF.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-07-05 | 2025-07-05 | counter_or_counteroffer | Addendum_to_extend_counter_expiration_2025-06-10_05_36_21.pdf | error: not_pdf_bytes |
| 13 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial_Agency_Disclosure_Pamphlet_-_042_OREF_2.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-07-05 | 2025-07-05 | amendment_or_notice | Notice_of_Real_Estate_Compensation_-_091_OREF__4_.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-07-05 | n/a | other | Timeline_for_Butler_Market__2.eml | _not in prioritized subset for this run_ |
| 16 | 2025-07-05 | 2025-07-05 | other_pdf | FIRPTA-Qualified_Substitute_Statement.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-07-05 | n/a | seller_property_disclosure | 1_Sellers_Property_Disclosure_Statement_-_020_OREF.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-07-05 | n/a | title_or_hoa | _OR__Preliminary_Title_Report_-N.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-07-05 | n/a | counter_or_counteroffer | Sellers_Counter_Offer_1_-_003_OREF.pdf | error: not_pdf_bytes |
| 20 | 2025-07-05 | n/a | buyer_offer_or_package | Advisory_Regarding_FIRPTA_Tax_-_Buyer_-_092_OREF.pdf | _not in prioritized subset for this run_ |
| 21 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory_Regarding_Electronic_Funds_-_Seller_-_043_OREF.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-07-05 | n/a | seller_property_disclosure | Sellers_Property_Disclosures_2025-06-09_Butler_Market__2.pdf | _not in prioritized subset for this run_ |
| 23 | 2025-07-05 | n/a | other_pdf | ALTA_Settlement_Seller.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-07-05 | n/a | other_pdf | Residential_Input_Form_2025-06-10_05_43_37.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Sellers_Property_Disclosures_2025-06-09_Butler_Market__2_2.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-07-05 | n/a | listing_agreement | Exclusive_Listing_Agreement_-_ODS.pdf | _not in prioritized subset for this run_ |
| 27 | 2025-07-05 | n/a | buyer_offer_or_package | Offer_1050_NE_Butler_Market__2.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 27 documents. Checklist activities: 46.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 4 ("offer" family). **Counter-like**: 3 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 4 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 3235 NW Cedar Ave, Redmond, OR 97756

- **Folder id (`saleGuid`)**: `45549882-839b-4e36-af31-6078b344bcb5`
- **MLS**: 827967
- **SkySlope status**: Closed
- **Linked listingGuid**: n/a
- **Sale price / list price**: 530000 / 0
- **Contract acceptance**: 2025-06-12
- **Escrow closing**: 2025-07-18
- **Actual closing**: 2025-07-17
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-07-05

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure Pamphlet | Sales Documentation | Optional | n/a |  |
| 2 | Residential Purchase Agreement | Sales Documentation | Completed | 2025-07-05 | Business_Registry_Business_Name_Search.pdf; SPD__2_.pdf; _OR__Preliminary_Title_Report_-N.pdf; Crawley-535000-Preapproval-letter.pdf; unknown; SPD_2.pdf; Residential_Real_Estate_Sale_Agreement_-_001_OREF.pdf; Repair_Request_List.pdf; Business_Registry_Business_Name_Search__1_.pdf; PRELIMINARY_REPORT-LINKED.pdf; EM_Deposit_IH.pdf; Notice_of_Real_Estate_Compensation_-_091_OREF.pdf; PSA_pack_3235_NW_Cedar_Ave.pdf; VA_FHA_Amendatory_Clause_and_Real_Estate_Certification_-_097_OREF.pdf; Contingency_Removal_Addendum_1_-_060_OREF.pdf; Notice_from_Buyer_to_Seller_1_-_109_OREF.pdf; Listing_Photos_Addendum_.pdf; Residential_Real_Estate_Sale_Agreement_-_001_OREF__1_.pdf; 3235_NW_Cedar_Ave___Residential_Inspection_Report_by_Porch_Light_.pdf; PSA_pack_3235_NW_Cedar_Ave_2.pdf |
| 3 | Pre Approval Letter or Proof of Funds | Sales Documentation | Completed | 2025-07-05 | Crawley-535000-Preapproval-letter_2.pdf |
| 4 | Counter Offers  | Sales Documentation | Optional | n/a |  |
| 5 | Sale Addendums | Sales Documentation | Completed | 2025-07-05 | Addm2b_reduction_in_price_538.pdf; Addendum_to_Sale_Agreement_2A_-_002_OREF.pdf; Listing_Photos_Addendum__2.pdf; VA_FHA_Amendatory_Clause_and_Real_Estate_Certification_-_097_OREF_2.pdf |
| 6 | Repair Addendum | Sales Documentation | Optional | n/a |  |
| 7 | Receipt for Documents  | Sales Documentation | Optional | n/a |  |
| 8 | Contingency Removal | Sales Documentation | Completed | 2025-07-05 | Contingency_Removal_Addendum_1_-_060_OREF_2.pdf |
| 9 | Extension of Time Addendum  | Sales Documentation | Completed | 2025-07-15 | Extension_1_686.pdf; extension_2_364.pdf |
| 10 | Notice to Buyer | Seller | Sales Documentation | Optional | n/a |  |
| 11 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale | Sales Documentation | Optional | n/a |  |
| 14 | Sellers Property Disclosures | Disclosures | Completed | 2025-07-05 | SPD__2__2.pdf |
| 15 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 16 | Wood Stove | Fireplace Insert Addendum | Disclosures | Optional | n/a |  |
| 17 | Professional Inspection Addendum | Disclosures | Optional | n/a |  |
| 18 | Electronic Funds Advisory | Disclosures | Completed | 2025-07-05 | Advisory Regarding Electronic Funds - Buyer - 043 OREF.pdf |
| 19 | Real Estate Compensation Advisory | Disclosures | Completed | 2025-07-05 | Advisory Regarding Real Estate Compensation - Buyer - 047 OREF.pdf |
| 20 | FIRPTA Advisory | Disclosures | Optional | n/a |  |
| 21 | Real Estate Forms Advisory | Disclosures | Completed | 2025-07-05 | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Buyer - 108 OREF.pdf |
| 22 | Smoke Alarms Advisory | Disclosures | Completed | 2025-07-05 | Advisory Regarding Smoke and Carbon Monoxide Alarms - Buyer - 080 OREF.pdf |
| 23 | Association Advisory | Disclosures | Optional | n/a |  |
| 24 | Lead Based Paint Advisory | Disclosures | Optional | n/a |  |
| 25 | CCRs | Reports | Optional | n/a |  |
| 26 | Association Documents | Reports | Optional | n/a |  |
| 27 | Appraisal  | Reports | Optional | n/a |  |
| 28 | Home Inspection  | Reports | Completed | 2025-07-05 | Inspection_Report.pdf |
| 29 | Broker Commission Demand from Title | Closing Documents | Completed | 2025-07-05 | Notice_of_Real_Estate_Compensation_-_091_OREF_2.pdf |
| 30 | Earnest Money Receipt | Closing Documents | Completed | 2025-07-05 | EM_Deposit_IH_2.pdf |
| 31 | Preliminary Title Report | Closing Documents | Completed | 2025-07-05 | PRELIMINARY_REPORT-LINKED_2.pdf |
| 32 | Final HUD | Closing Documents | Completed | 2025-07-18 | Final_BuyerBorrower_Statement_IHSA_819.pdf |
| 33 | Documentation of Repairs or Maintenance | Miscellaneous Documentation | In Review | 2025-07-05 | Repair_Request_List_2.pdf |
| 34 | Net Sheets | CMAs | Miscellaneous Documentation | Optional | n/a |  |
| 35 | Skyslope Cover Sheet / Deal Memo | Miscellaneous Documentation | Required | n/a |  |
| 36 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 37 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Buyer Agreement Documentation | Completed | 2025-07-05 | Initial_Agency_Disclosure_Pamphlet_-_042_OREF_2025-05-19_07_05_26.pdf |
| 38 | Dissolution of HOA | Miscellaneous Documentation | In Review | 2025-07-05 | Business_Registry_Business_Name_Search_2.pdf |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Completed | 2025-07-05 | Buyer_Representation_Agreement_-_Exclusive_-_050_OREF_2025-05-19_07_05_11.pdf |
| 40 | Buyer Intake Form | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Pre Approval Letters | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 43 | Disclosed Limited Agency | Buyer Agreement Documentation | Optional | n/a |  |
| 44 | Record of Properties Shown | Buyer Agreement Documentation | Optional | n/a |  |
| 45 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 46 | Copies of Correspondance | Buyer Agreement Documentation | Optional | n/a |  |
| 47 | Notice to Seller | Buyer Agreement Documentation | Completed | 2025-07-05 | Notice_from_Buyer_to_Seller_1_-_109_OREF_2.pdf |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-05 | 2025-07-05 | buyer_offer_or_package | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Buyer - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-05 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF.pdf | pages=1, read=1, textLen=5470, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 3 | 2025-07-05 | n/a | addendum | Contingency Removal Addendum 1 - 060 OREF.pdf | error: not_pdf_bytes |
| 4 | 2025-07-05 | n/a | addendum | Listing Photos Addendum .pdf | error: not_pdf_bytes |
| 5 | 2025-07-05 | n/a | addendum | Addendum to Sale Agreement 1 - 002 OREF_2.pdf | pages=1, read=1, textLen=5258, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 6 | 2025-07-05 | n/a | buyer_offer_or_package | Notice from Buyer to Seller 1 - 109 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-07-05 | n/a | title_or_hoa | Advisory Regarding Title Insurance - Buyer - 103 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-05 | n/a | counter_or_counteroffer | Sellers Counter_2.pdf | error: not_pdf_bytes |
| 9 | 2025-07-05 | n/a | counter_or_counteroffer | Sellers_Counteroffer.pdf | error: not_pdf_bytes |
| 10 | 2025-07-05 | n/a | counter_or_counteroffer | Buyers Counter Offer 2 - 004 OREF.pdf | error: not_pdf_bytes |
| 11 | 2025-07-05 | n/a | counter_or_counteroffer | Buyers Counter Offer 1 - 004 OREF.pdf | error: not_pdf_bytes |
| 12 | 2025-07-05 | 2025-07-05 | buyer_offer_or_package | Advisory Regarding Electronic Funds - Buyer - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-07-05 | n/a | addendum | Addendum to Sale Agreement 2 - 002 OREF.pdf | pages=1, read=1, textLen=5392, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 14 | 2025-07-05 | 2025-07-05 | buyer_offer_or_package | Advisory Regarding Smoke and Carbon Monoxide Alarms - Buyer - 080 OREF.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-07-05 | n/a | sale_agreement_or_rsa | Residential Real Estate Sale Agreement - 001 OREF.pdf | pages=16, read=12, textLen=135921, 16 pg · read 12 · rich · Digi×12 · dual pipeline 12 pg · tesseract.js (pdf.js render) · nonempty OCR 12/12 engine page(s)., signals=e_sign_vendor_markers_present, word_accepted_present, negative_outcome_word_present, signature_labels_present, many_digisign_markers_still_not_proof_of_full_execution |
| 16 | 2025-07-05 | 2025-07-05 | addendum | Addendum_to_Sale_Agreement_2A_-_002_OREF.pdf | error: not_pdf_bytes |
| 17 | 2025-07-05 | 2025-07-05 | buyer_offer_or_package | Advisory Regarding Real Estate Compensation - Buyer - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-07-05 | n/a | seller_property_disclosure | SPD.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-07-05 | n/a | addendum | Addendum_to_Sale_Agreement_2_-_002_OREF _1_.pdf | error: not_pdf_bytes |
| 20 | 2025-07-05 | n/a | agency_disclosure_pamphlet | Initial_Agency_Disclosure_Pamphlet_-_042_OREF_2025-05-19_07_05_26.pdf | _not in prioritized subset for this run_ |
| 21 | 2025-07-05 | n/a | listing_agreement | Buyer_Representation_Agreement_-_Exclusive_-_050_OREF_2025-05-19_07_05_11.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-07-05 | n/a | other_pdf | Business_Registry_Business_Name_Search.pdf | _not in prioritized subset for this run_ |
| 23 | 2025-07-05 | n/a | seller_property_disclosure | SPD__2_.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-07-05 | n/a | title_or_hoa | _OR__Preliminary_Title_Report_-N.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-07-05 | n/a | lender_financing | Crawley-535000-Preapproval-letter.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-07-05 | n/a | other | unknown | _not in prioritized subset for this run_ |
| 27 | 2025-07-05 | n/a | seller_property_disclosure | SPD_2.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-07-05 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF.pdf | _not in prioritized subset for this run_ |
| 29 | 2025-07-05 | n/a | inspection_or_repair | Repair_Request_List.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-07-05 | n/a | other_pdf | Business_Registry_Business_Name_Search__1_.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-07-05 | n/a | title_or_hoa | PRELIMINARY_REPORT-LINKED.pdf | _not in prioritized subset for this run_ |
| 32 | 2025-07-05 | n/a | earnest_or_wire | EM_Deposit_IH.pdf | _not in prioritized subset for this run_ |
| 33 | 2025-07-05 | n/a | amendment_or_notice | Notice_of_Real_Estate_Compensation_-_091_OREF.pdf | _not in prioritized subset for this run_ |
| 34 | 2025-07-05 | n/a | other_pdf | PSA_pack_3235_NW_Cedar_Ave.pdf | _not in prioritized subset for this run_ |
| 35 | 2025-07-05 | n/a | other_pdf | VA_FHA_Amendatory_Clause_and_Real_Estate_Certification_-_097_OREF.pdf | _not in prioritized subset for this run_ |
| 36 | 2025-07-05 | n/a | addendum | Contingency_Removal_Addendum_1_-_060_OREF.pdf | error: not_pdf_bytes |
| 37 | 2025-07-05 | n/a | buyer_offer_or_package | Notice_from_Buyer_to_Seller_1_-_109_OREF.pdf | _not in prioritized subset for this run_ |
| 38 | 2025-07-05 | n/a | addendum | Listing_Photos_Addendum_.pdf | error: not_pdf_bytes |
| 39 | 2025-07-05 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF__1_.pdf | _not in prioritized subset for this run_ |
| 40 | 2025-07-05 | n/a | inspection_or_repair | 3235_NW_Cedar_Ave___Residential_Inspection_Report_by_Porch_Light_.pdf | _not in prioritized subset for this run_ |
| 41 | 2025-07-05 | 2025-07-05 | inspection_or_repair | Repair_Request_List_2.pdf | _not in prioritized subset for this run_ |
| 42 | 2025-07-05 | 2025-07-05 | buyer_offer_or_package | Notice_from_Buyer_to_Seller_1_-_109_OREF_2.pdf | _not in prioritized subset for this run_ |
| 43 | 2025-07-05 | 2025-07-05 | earnest_or_wire | EM_Deposit_IH_2.pdf | _not in prioritized subset for this run_ |
| 44 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | SPD__2__2.pdf | _not in prioritized subset for this run_ |
| 45 | 2025-07-05 | 2025-07-05 | addendum | Contingency_Removal_Addendum_1_-_060_OREF_2.pdf | error: not_pdf_bytes |
| 46 | 2025-07-05 | n/a | title_or_hoa | _OR__Preliminary_Title_Report_-N_2.pdf | _not in prioritized subset for this run_ |
| 47 | 2025-07-05 | 2025-07-05 | title_or_hoa | PRELIMINARY_REPORT-LINKED_2.pdf | _not in prioritized subset for this run_ |
| 48 | 2025-07-05 | n/a | other_pdf | Business_Registry_Business_Name_Search__1__2.pdf | _not in prioritized subset for this run_ |
| 49 | 2025-07-05 | 2025-07-05 | lender_financing | Crawley-535000-Preapproval-letter_2.pdf | _not in prioritized subset for this run_ |
| 50 | 2025-07-05 | 2025-07-05 | other_pdf | VA_FHA_Amendatory_Clause_and_Real_Estate_Certification_-_097_OREF_2.pdf | _not in prioritized subset for this run_ |
| 51 | 2025-07-05 | 2025-07-05 | amendment_or_notice | Notice_of_Real_Estate_Compensation_-_091_OREF_2.pdf | _not in prioritized subset for this run_ |
| 52 | 2025-07-05 | 2025-07-05 | other_pdf | Business_Registry_Business_Name_Search_2.pdf | _not in prioritized subset for this run_ |
| 53 | 2025-07-05 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF_2.pdf | _not in prioritized subset for this run_ |
| 54 | 2025-07-05 | 2025-07-05 | other_pdf | PSA_pack_3235_NW_Cedar_Ave_2.pdf | _not in prioritized subset for this run_ |
| 55 | 2025-07-05 | 2025-07-05 | addendum | Listing_Photos_Addendum__2.pdf | error: not_pdf_bytes |
| 56 | 2025-07-05 | n/a | sale_agreement_or_rsa | Residential_Real_Estate_Sale_Agreement_-_001_OREF__1__2.pdf | _not in prioritized subset for this run_ |
| 57 | 2025-07-05 | 2025-07-05 | inspection_or_repair | Inspection_Report.pdf | _not in prioritized subset for this run_ |
| 58 | 2025-07-05 | 2025-07-05 | other_pdf | Addm2b_reduction_in_price_538.pdf | _not in prioritized subset for this run_ |
| 59 | 2025-07-14 | n/a | addendum | Addendum to Sale Agreement 3 - 002 OREF.pdf | pages=1, read=1, textLen=5259, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 60 | 2025-07-14 | 2025-07-15 | other_pdf | Extension_1_686.pdf | _not in prioritized subset for this run_ |
| 61 | 2025-07-15 | n/a | addendum | Addendum to Sale Agreement 4 - 002 OREF.pdf | pages=1, read=1, textLen=5256, 1 pg · rich · Digi×1 · dual pipeline 1 pg · tesseract.js (pdf.js render) · nonempty OCR 1/1 engine page(s)., signals=e_sign_vendor_markers_present, signature_labels_present |
| 62 | 2025-07-16 | 2025-07-18 | other_pdf | extension_2_364.pdf | _not in prioritized subset for this run_ |
| 63 | 2025-07-18 | 2025-07-18 | buyer_offer_or_package | Final_BuyerBorrower_Statement_IHSA_819.pdf | _not in prioritized subset for this run_ |
| 64 | 2025-07-18 | 2025-07-18 | other_pdf | FIRPTA_-_Statement_of_Qualified_Substitute_722.pdf | _not in prioritized subset for this run_ |

### Narrative timeline (best-effort)

- **Forms inventory**: 64 documents. Checklist activities: 48.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 8 ("offer" family). **Counter-like**: 4 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 5.
- **PDF dual pipeline coverage**: 18 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

---

## Sale file: 20401 Penhollow Ln, Bend, OR 97702

- **Folder id (`saleGuid`)**: `e1892930-09c4-48f6-b327-f901251cae96`
- **MLS**: 220203839
- **SkySlope status**: Closed
- **Linked listingGuid**: 28343c3a-c683-4b62-bbe4-34180b404db7
- **Sale price / list price**: 639000 / 0
- **Contract acceptance**: 2025-06-16
- **Escrow closing**: 2025-07-30
- **Actual closing**: 2025-07-25
- **Checklist type**: Standard Residential Sale
- **Created on**: 2025-07-05

### Checklist activities (SkySlope "sections")

| Order | Activity | Type | Status | Assigned | Attached doc names |
|---:|---|---|---|---|---|
| 1 | Initial Agency Disclosure Pamphlet | Sales Documentation | Completed | 2025-07-05 | Initial_Agency_Disclosure_Pamphlet_-_042_OREF.pdf |
| 2 | Residential Purchase Agreement | Sales Documentation | Completed | 2025-07-05 | 20401_Penhollow_Purchase_Agreement.pdf |
| 3 | Pre Approval Letter or Proof of Funds | Sales Documentation | Completed | 2025-07-08 | Morse-Pre-Approval_Letter.pdf |
| 4 | Counter Offers  | Sales Documentation | Optional | n/a |  |
| 5 | Sale Addendums | Sales Documentation | Completed | 2025-07-10 | Penhollow Closing Date Addendum.pdf |
| 6 | Repair Addendum | Sales Documentation | Optional | n/a |  |
| 7 | Receipt for Documents  | Sales Documentation | Completed | 2025-07-08 | Penhollow_Delivery_of_HOA_Docs_646.pdf |
| 8 | Contingency Removal | Sales Documentation | Completed | 2025-07-05 | Penhollow Inspection Approval.pdf |
| 9 | Extension of Time Addendum  | Sales Documentation | Optional | n/a |  |
| 10 | Notice to Buyer | Seller | Sales Documentation | Optional | n/a |  |
| 11 | Termination of Contract  | Sales Documentation | Optional | n/a |  |
| 12 | Agreement to Occupy | Sales Documentation | Optional | n/a |  |
| 13 | Bill Of Sale | Sales Documentation | Optional | n/a |  |
| 14 | Sellers Property Disclosures | Disclosures | Completed | 2025-07-05 | Penhollow_SPD.pdf |
| 15 | Lead Based Paint Disclosure  | Disclosures | Optional | n/a |  |
| 16 | Wood Stove | Fireplace Insert Addendum | Disclosures | Optional | n/a |  |
| 17 | Professional Inspection Addendum | Disclosures | Optional | n/a |  |
| 18 | Electronic Funds Advisory | Disclosures | Completed | 2025-07-05 | Advisory_Regarding_Electronic_Funds_-_Seller_-_043_OREF.pdf |
| 19 | Real Estate Compensation Advisory | Disclosures | Completed | 2025-07-05 | Advisory_Regarding_Real_Estate_Compensation_-_Seller_-_047_OREF.pdf |
| 20 | FIRPTA Advisory | Disclosures | Completed | 2025-07-05 | Advisory_Regarding_FIRPTA_Tax_-_Seller_-_092_OREF.pdf |
| 21 | Real Estate Forms Advisory | Disclosures | Completed | 2025-07-05 | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf |
| 22 | Smoke Alarms Advisory | Disclosures | Optional | n/a |  |
| 23 | Association Advisory | Disclosures | Completed | 2025-07-05 | 20401_Penhollow_Owners_Association.pdf |
| 24 | Lead Based Paint Advisory | Disclosures | Optional | n/a |  |
| 25 | CCRs | Reports | Optional | n/a |  |
| 26 | Association Documents | Reports | Completed | 2025-07-05 | Penhollow_HOA_Docs.zip |
| 27 | Appraisal  | Reports | Optional | n/a |  |
| 28 | Home Inspection  | Reports | Optional | n/a |  |
| 29 | Broker Commission Demand from Title | Closing Documents | Completed | 2025-07-05 | Notice_of_Real_Estate_Compensation_-_091_OREF.pdf |
| 30 | Earnest Money Receipt | Closing Documents | Completed | 2025-07-05 | Earnest_Money.pdf |
| 31 | Preliminary Title Report | Closing Documents | Completed | 2025-07-05 | PRELIMINARY_REPORT-LINKED_802.pdf |
| 32 | Final HUD | Closing Documents | Required | n/a |  |
| 33 | Documentation of Repairs or Maintenance | Miscellaneous Documentation | Optional | n/a |  |
| 34 | Net Sheets | CMAs | Miscellaneous Documentation | Optional | n/a |  |
| 35 | Skyslope Cover Sheet / Deal Memo | Miscellaneous Documentation | Required | n/a |  |
| 36 | Transaction Timeline | Miscellaneous Documentation | Required | n/a |  |
| 37 | Broker Notes | Miscellaneous Documentation | Required | n/a |  |
| 38 | Initial Agency Disclosure (042 | 10.4) | Buyer Agreement Documentation | Optional | n/a |  |
| 39 | Buyers Rep Agreement | Buyer Agreement Documentation | Optional | n/a |  |
| 40 | Buyer Intake Form | Buyer Agreement Documentation | Optional | n/a |  |
| 41 | Pre Approval Letters | Buyer Agreement Documentation | Optional | n/a |  |
| 42 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 43 | Disclosed Limited Agency | Buyer Agreement Documentation | Optional | n/a |  |
| 44 | Record of Properties Shown | Buyer Agreement Documentation | Optional | n/a |  |
| 45 | CMA or Comparables  | Buyer Agreement Documentation | Optional | n/a |  |
| 46 | Copies of Correspondance | Buyer Agreement Documentation | Optional | n/a |  |

### Documents library (chronological)

Sorted by **uploadDate** (fallback **modifiedDate**). Each row includes an inferred **doc class** from the filename and optional **dual pipeline PDF clues** when this document was selected for analysis (still **not** a full execution review).

| # | Upload | Modified | Inferred class | File name | PDF dual pipeline clues |
|---:|---|---|---|---|---|
| 1 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial Agency Disclosure Pamphlet - 042 OREF.pdf | _not in prioritized subset for this run_ |
| 2 | 2025-07-05 | n/a | buyer_offer_or_package | 20401 Penhollow Purchase Agreement.pdf | _not in prioritized subset for this run_ |
| 3 | 2025-07-05 | n/a | other_pdf | Advisory Regarding FIRPTA Tax - Seller - 092 OREF.pdf | _not in prioritized subset for this run_ |
| 4 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Sellers Property Disclosure Statement - 020 OREF.pdf | _not in prioritized subset for this run_ |
| 5 | 2025-07-05 | 2025-07-05 | other_pdf | ORE Residential Input - ODS.pdf | _not in prioritized subset for this run_ |
| 6 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory and Instructions Regarding Real Estate Purchase and Sale Forms - Seller - 108 OREF.pdf | _not in prioritized subset for this run_ |
| 7 | 2025-07-05 | n/a | other_pdf | Advisory Regarding Electronic Funds - Seller - 043 OREF.pdf | _not in prioritized subset for this run_ |
| 8 | 2025-07-05 | n/a | other_pdf | Advisory Regarding Real Estate Compensation - Seller - 047 OREF.pdf | _not in prioritized subset for this run_ |
| 9 | 2025-07-05 | n/a | other_pdf | Delivery of Association Documents 1 - 023 OREF.pdf | _not in prioritized subset for this run_ |
| 10 | 2025-07-05 | n/a | lender_financing | Morse-Pre-Approval Letter.pdf | _not in prioritized subset for this run_ |
| 11 | 2025-07-05 | n/a | amendment_or_notice | Notice of Real Estate Compensation - 091 OREF.pdf | _not in prioritized subset for this run_ |
| 12 | 2025-07-05 | n/a | other_pdf | Change Form for Status_ Date_ Price and Other Miscellaneous Changes - ODS.pdf | _not in prioritized subset for this run_ |
| 13 | 2025-07-05 | 2025-07-05 | listing_agreement | Listing Agreement - Exclusive - 015 OREF.pdf | _not in prioritized subset for this run_ |
| 14 | 2025-07-05 | n/a | other_pdf | 20401 Penhollow Owners Association.pdf | _not in prioritized subset for this run_ |
| 15 | 2025-07-05 | 2025-07-05 | inspection_or_repair | Penhollow Inspection Approval.pdf | _not in prioritized subset for this run_ |
| 16 | 2025-07-05 | n/a | other_pdf | Advisory_and_Instructions_Regarding_Real_Estate_Purchase_and_Sale_Forms_-_Seller_-_108_OREF.pdf | _not in prioritized subset for this run_ |
| 17 | 2025-07-05 | 2025-07-05 | agency_disclosure_pamphlet | Initial_Agency_Disclosure_Pamphlet_-_042_OREF.pdf | _not in prioritized subset for this run_ |
| 18 | 2025-07-05 | 2025-07-05 | seller_property_disclosure | Penhollow_SPD.pdf | _not in prioritized subset for this run_ |
| 19 | 2025-07-05 | 2025-07-08 | lender_financing | Morse-Pre-Approval_Letter.pdf | _not in prioritized subset for this run_ |
| 20 | 2025-07-05 | 2025-07-05 | other_pdf | 20401_Penhollow_Purchase_Agreement.pdf | _not in prioritized subset for this run_ |
| 21 | 2025-07-05 | n/a | title_or_hoa | PRELIMINARY_REPORT-LINKED-titleLOOK.pdf | _not in prioritized subset for this run_ |
| 22 | 2025-07-05 | 2025-07-05 | other_pdf | 20401_Penhollow_Owners_Association.pdf | _not in prioritized subset for this run_ |
| 23 | 2025-07-05 | 2025-07-05 | amendment_or_notice | Notice_of_Real_Estate_Compensation_-_091_OREF.pdf | _not in prioritized subset for this run_ |
| 24 | 2025-07-05 | n/a | listing_agreement | Listing_Agreement_-_Exclusive_-_015_OREF.pdf | _not in prioritized subset for this run_ |
| 25 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory_Regarding_Real_Estate_Compensation_-_Seller_-_047_OREF.pdf | _not in prioritized subset for this run_ |
| 26 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory_Regarding_FIRPTA_Tax_-_Seller_-_092_OREF.pdf | _not in prioritized subset for this run_ |
| 27 | 2025-07-05 | 2025-07-05 | other_pdf | Advisory_Regarding_Electronic_Funds_-_Seller_-_043_OREF.pdf | _not in prioritized subset for this run_ |
| 28 | 2025-07-05 | 2025-07-05 | earnest_or_wire | Earnest_Money.pdf | _not in prioritized subset for this run_ |
| 29 | 2025-07-05 | n/a | other_pdf | MLS_Input_Form_2025-06-17_11_44_33.pdf | _not in prioritized subset for this run_ |
| 30 | 2025-07-05 | n/a | other_pdf | Change_Form_for_Status__Date__Price_and_Other_Miscellaneous_Changes_-_ODS.pdf | _not in prioritized subset for this run_ |
| 31 | 2025-07-05 | n/a | title_or_hoa | Penhollow_HOA_Docs.zip | _not in prioritized subset for this run_ |
| 32 | 2025-07-05 | n/a | title_or_hoa | Penhollow_HOA_Docs.zip | _not in prioritized subset for this run_ |
| 33 | 2025-07-05 | 2025-07-05 | title_or_hoa | PRELIMINARY_REPORT-LINKED_802.pdf | _not in prioritized subset for this run_ |
| 34 | 2025-07-08 | 2025-07-08 | title_or_hoa | Penhollow_Delivery_of_HOA_Docs_646.pdf | _not in prioritized subset for this run_ |
| 35 | 2025-07-10 | n/a | addendum | Penhollow_Closing_Date_Addendum_866.pdf | error: not_pdf_bytes |
| 36 | 2025-07-10 | 2025-07-10 | addendum | Penhollow Closing Date Addendum.pdf | error: not_pdf_bytes |

### Narrative timeline (best-effort)

- **Forms inventory**: 36 documents. Checklist activities: 46.
- **Sale file interpretation**: treat SkySlope **sale status** + **contract acceptance / closing dates** as the strongest signals for whether a purchase agreement path completed.
- **Offer-like PDFs detected by filename heuristics**: 1 ("offer" family). **Counter-like**: 0 (includes OREF counter forms when matched). **Termination/release-like**: 0. **RSA / sale agreement-like**: 0.
- **PDF dual pipeline coverage**: 2 PDF(s) in this folder were analyzed (global cap 420, up to 12 page(s) per file).

#### Suggested "deal story" paragraph (template)

Fill in the bracketed parts after human review of the PDFs: "This sale file for **[address]** (MLS **[mls]**) shows SkySlope status **Closed**. The document timeline begins **[earliest doc date]** with **[earliest doc class]** and ends **[latest doc date]** with **[latest doc class]**. Negotiation PDFs suggest **[N]** offer-like uploads and **[M]** counter-like uploads; termination/release-like uploads = **[T]**. Based on SkySlope dates/status and closing/acceptance fields, the purchase agreement path looks **[completed vs not completed]** with confidence **[high/med/low]** because **[reason]**."

## Appendix: PDF dual pipeline selection stats

- **Queued PDFs**: 1796
- **PDF text extraction attempts**: 420
- **PDF pipeline**: pdf.js text layer plus mandatory OCR (`scripts/skyslope-pdf-insight.mjs`), `SKYSLOPE_AUDIT_PDF_MAX_PAGES=12`