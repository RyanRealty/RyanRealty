# Vault records audit

**What it is.** `/admin/closings/audit` answers, for every deal, the question an Oregon Real
Estate Agency records inspection asks: does the transaction file hold every record the rules
require? Logic: `lib/tc/audit/records.ts` (pure, tested). Data: `lib/data/tc/deal-audit.ts`.

**What counts.** A record counts only when the document reader identified it. An agreement
counts as executed only when the reader and the check against the printed form agree
(`lib/tc/doc-read/cross-check.ts`, `lib/tc/form-match`). Archived documents are still records.
The Vault's archive keeps the file, and offers are archived as records, never deleted. So
archived documents count for "kept" requirements. For "executed" requirements, a document
counts only while it is the live copy.

## Requirements and sources

Primary sources were fetched 2026-09-24. These are the current texts after the 2026-01-01
amendments (HB 3137 / REA 4-2025).

| Row | Requirement | Source |
|---|---|---|
| listing | Listing agreement, signed (seller side) | OAR 863-015-0250(1)(c) |
| buyer_rep | Buyer representation agreement (buyer side) | ORS 696.810; OAR 863-015-0250(1)(c) |
| pamphlet | Initial agency disclosure pamphlet delivered (delivered, not signed) | OAR 863-015-0215 |
| faa | Final agency acknowledgment signed by both parties (files under contract) | ORS 696.845; OAR 863-015-0250(1)(a)-(b) |
| spds | Seller's property disclosure, or a written exemption; the buyer acknowledges receipt | ORS 105.464-.475; OAR 863-015-0250(1)(f) |
| lbp | Lead-based paint disclosure, homes built before 1978 | 40 CFR 745.113 |
| offers | Every written offer and counteroffer kept, accepted or not, with the date and time of delivery and the response | OAR 863-015-0135(3); OAR 863-015-0250(1) |
| sale_agreement | Fully executed sale agreement | OAR 863-015-0135(4) |
| addenda | Amendments and addenda, dated and signed by buyer and seller | OAR 863-015-0135(9) |
| earnest_money | Earnest money receipt | OAR 863-015-0250(1)(d); OAR 863-015-0135(6)-(7) |
| settlement | Settlement statement (closed files) | OAR 863-015-0250(1)(d),(3) |
| correspondence | Correspondence with the parties | OAR 863-015-0250(1)(f); the Agency's "Records of Professional Real Estate Activity - Sales" names email and texts |
| principal_review | The principal broker's review of each document of agreement, within 7 banking days after it is accepted, rejected or withdrawn. The evidence is an electronic record naming the reviewer and the date. | OAR 863-015-0140(4) |

**Retention.** Files are kept at least six years from the later of closing or failure, in a
form the Commissioner can inspect (ORS 696.280; OAR 863-015-0260).

**Principal broker review.** Matt 2026-09-24: "currently im reviewing there [SkySlope] but will
review here when we cut over."

- **Files that came from SkySlope** are reviewed in SkySlope. SkySlope keeps the reviewer and
  the date. The audit marks the row "SkySlope" and shows the file's SkySlope checklist counts
  (completed, still in review). It does not score the row.
- **Files opened in the Vault** are reviewed on Sign-off (`/admin/sign-off`), which records
  `tc_principal_reviews`.
- **At the cutover,** the rule in `lib/data/tc/deal-audit.ts` (`reviewSystem`) moves every new
  file to the Vault.

## Not covered here

The following have their own rules and are not checked by this audit:

- **Clients' trust account records** (OAR 863-015-0255). Ryan Realty does not hold earnest
  money; escrow does.
- **Broker-to-principal-broker transmittal within 3 banking days** (OAR 863-015-0250(2)).

The Agency's brochure "Principal Brokers' Records" returned 404 on 2026-09-24. It was not used
as a source.
