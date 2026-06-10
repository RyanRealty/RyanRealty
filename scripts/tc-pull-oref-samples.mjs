#!/usr/bin/env node
/**
 * Pull the public OREF SAMPLE library (watermarked review copies) from
 * orefonline.com/oref-library/ into tmp/form-blanks/OREF-samples/.
 *
 * These are NOT production instruments — they seed tc_form_versions metadata
 * and field-map design. Production blanks come from Matt's paid subscription
 * via SkySlope Forms. Re-run anytime; skips files already present.
 */
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(REPO, 'tmp/form-blanks/OREF-samples')

// Residential library — enumerated from https://orefonline.com/oref-library/ (2026-06-09)
const BASE = 'https://orefonline.com/wp-content/uploads'
const FORMS = [
  ['000', 'Guide to Using OREF Residential Library Forms', '2025/01/SAMPLE_OREF-000-Realtor-Guide-to-OREF-Forms.pdf'],
  ['000A', 'Things to Know Before Signing', '2025/01/SAMPLE_OREF-000A-Things-to-Know-Before-You-Sign.pdf'],
  ['000B', 'Advisory for Buyers and Sellers of Real Estate', '2025/09/SAMPLE_OREF-000B-Advisory-for-Buyers-and-Sellers-of-Real-Estate.pdf'],
  ['000C', 'Real Estate Transaction Terms and Concepts', '2025/12/SAMPLE_OREF-000C-Real-Estate-Transaction-TermsConcepts.pdf'],
  ['001', 'Residential Real Estate Sale Agreement', '2025/01/SAMPLE_OREF-001-Residential-Real-Estate-Sale-Agreement.pdf'],
  ['002', 'Addendum to Sale Agreement', '2025/01/SAMPLE_OREF-002-Addendum-to-Sale-Agreement.pdf'],
  ['002A', 'Addendum to Sale Agreement 2pg', '2025/01/SAMPLE_OREF-002A-Addendum-to-Sale-Agreement-2-page.pdf'],
  ['002B', 'Addendum to Sale Agreement 3pg', '2025/01/SAMPLE_OREF-002B-Addendum-to-Sale-Agreement-3-page.pdf'],
  ['003', 'Sellers Counteroffer', '2025/01/SAMPLE_OREF-003-Sellers-Counteroffer.pdf'],
  ['004', 'Buyers Counteroffer', '2025/01/SAMPLE_OREF-004-Buyers-Counteroffer.pdf'],
  ['005', 'Farms Ranches Acreage Natural Resource Property SA', '2025/01/SAMPLE_OREF-005-Farms-Ranches-AcreageNatural-Resource-Property-SA.pdf'],
  ['006', 'New Residential Construction SA', '2025/01/SAMPLE_OREF-006-New-Residential-Construction-Real-Estate-SA.pdf'],
  ['008', 'Vacant Land SA', '2025/01/SAMPLE_OREF-008-Vacant-Land-Real-Estate-SA.pdf'],
  ['009', 'Back Up Offer Addendum', '2025/01/SAMPLE_OREF-009-Back-up-Offer-Addendum.pdf'],
  ['009A', 'Sellers Notice to Back-up Buyer', '2025/12/SAMPLE_OREF-009A-Sellers-Notice-to-Back-up-Buyer.pdf'],
  ['009B', 'Back-up Buyers Notice to Seller', '2025/12/SAMPLE_OREF-009B-Back-up-Buyers-Notice-to-Seller.pdf'],
  ['010', 'Final Agency Acknowledgment Addendum', '2025/01/SAMPLE_OREF-010-Final-Agency-Acknowledgment-Addendum.pdf'],
  ['011', 'Residential Condominium SA', '2025/01/SAMPLE_OREF-011-Residential-Condominium-Real-Estate-SA.pdf'],
  ['012', 'Manufactured Home SA without land', '2025/01/SAMPLE_OREF-012-Manufactured-Home-SA-without-land.pdf'],
  ['013', 'Assignment and Assumption of Sale Agreement', '2025/01/SAMPLE_OREF-013-Assignment-and-Assuption-of-Sale-Agreement.pdf'],
  ['014', 'Real Estate Team Disclosure', '2025/12/SAMPLE_OREF-014-Real-Estate-Team-Disclosure.pdf'],
  ['015', 'Listing Agreement Exclusive', '2025/05/SAMPLE_OREF-015-Listing-Agreement-Exclusive.pdf'],
  ['016', 'Listing Agreement Addendum', '2025/05/SAMPLE_OREF-016-Listing-Agreement-Addendum.pdf'],
  ['017', 'Listing Agreement Early Termination', '2025/05/SAMPLE_OREF-017-Listing-Agreement-Early-Termination.pdf'],
  ['018', 'Advisory Regarding Lead-Based Paint', '2025/01/SAMPLE_OREF-018-Advisory-to-Seller-Regarding-Lead-Based-Paint.pdf'],
  ['019', 'Vacant Land Disclosure Addendum', '2025/01/SAMPLE_OREF-019-Vacant-Land-Disclosure-Addendum.pdf'],
  ['020', 'Sellers Property Disclosure Statement', '2025/01/SAMPLE_OREF-020-Sellers-Property-Disclosure-Statement.pdf'],
  ['021', 'Lead Based Paint Disclosure Addendum', '2025/01/SAMPLE_OREF-021-Lead-Based-Paint-Addendum.pdf'],
  ['022A', 'Buyers Repair Addendum', '2025/01/SAMPLE_OREF-022A-Buyers-Repair-Addendum.pdf'],
  ['022B', 'Sellers Repair Addendum', '2025/01/SAMPLE_OREF-022B-Sellers-Repair-Addendum.pdf'],
  ['023', 'Delivery of Association Documents', '2025/01/SAMPLE_OREF-023-Delivery-of-Association-Documents.pdf'],
  ['024', 'Owner Association Addendum', '2025/03/SAMPLE_OREF-024-Owner-Association-Addendum.pdf'],
  ['025', 'Exterior Siding Stucco EIFS Disclosure', '2025/01/SAMPLE_OREF-025-Exterior-Siding-Stucco-EIFS-Disclosure.pdf'],
  ['026', 'New Construction Professional Inspection Addendum', '2025/01/SAMPLE_OREF-026-New-Construction-Professional-Inspection-Addendum.pdf'],
  ['027BUY', 'Short Sale Summary for Buyers', '2025/01/SAMPLE_OREF-027BUY-Short-Sale-Summary-for-Buyers.pdf'],
  ['027SEL', 'Short Sale Summary for Sellers', '2025/01/SAMPLE_OREF-027SEL-Short-Sale-Summary-for-Sellers.pdf'],
  ['027A', 'Notice Pursuant to Short Sale Addendum', '2025/01/SAMPLE_OREF-027A-Notice-Pursuant-to-Short-Sale-Addendum.pdf'],
  ['027B', 'Short Sale Addendum', '2025/01/SAMPLE_OREF-027B-Short-Sale-Addendum.pdf'],
  ['028', 'Sellers Property Disclosure Statement Addendum', '2025/01/SAMPLE_OREF-028-Sellers-Property-Disclosure-Statement-Addendum.pdf'],
  ['030', 'Advisory to Buyer Regarding Vacant Land', '2025/01/SAMPLE_OREF-030-Advisory-to-Buyer-Regarding-Vacant-Land.pdf'],
  ['031', 'Advisory to Buyer Regarding Owner Associations', '2025/01/SAMPLE_OREF-031-Advisory-to-Buyer-re-Owner-Associations.pdf'],
  ['032', 'Advisory Regarding Seller-Carried Transactions', '2025/01/SAMPLE_OREF-032-Advisory-Regarding-Seller-Carried-Transactions.pdf'],
  ['033', 'Seller-Carried Transaction Addendum', '2025/01/SAMPLE_OREF-033-Seller-Carried-Transaction-Addendum.pdf'],
  ['034', 'Seller-Carried Deed of Trust', '2025/01/SAMPLE_OREF-034-Seller-Carried-Deed-of-Trust.pdf'],
  ['035', 'Seller-Carried Promissory Note', '2025/01/SAMPLE_OREF-035-Seller-Carried-Promissory-Note.pdf'],
  ['036', 'Seller-Carried Contract of Sale', '2025/01/SAMPLE_OREF-036-Seller-Carried-Contract-of-Sale.pdf'],
  ['037', 'Seller-Carried Memorandum of Contract of Sale', '2025/01/SAMPLE_OREF-037-Seller-Carried-Memorandum-of-Contract-of-Sale.pdf'],
  ['038', 'Seller-Carried Transactions MLO Worksheet', '2025/01/SAMPLE_OREF-038-Seller-Carried-Transactions-MLO-Worksheet.pdf'],
  ['040', 'Disclosed Limited Agency Agreement for Sellers', '2025/01/SAMPLE_OREF-040-Disclosed-Limited-Agency-Agreement-for-Sellers.pdf'],
  ['041', 'Disclosed Limited Agency Agreement for Buyers', '2025/01/SAMPLE_OREF-041-Disclosed-Limited-Agency-Agreement-for-Buyers.pdf'],
  ['042', 'Initial Agency Disclosure Pamphlet', '2025/01/SAMPLE_OREF-042-Initial-Agency-Disclosure-Pamphlet.pdf'],
  ['043', 'Advisory Regarding Electronic Funds', '2025/03/SAMPLE_OREF-043-Advisory-Regarding-Electronic-Funds.pdf'],
  ['045', 'Advisory to Buyer Regarding Historic Property', '2025/01/SAMPLE_OREF-045-Advisory-to-Buyer-Regarding-Historic-Property.pdf'],
  ['045A', 'Historic Property Addendum', '2025/01/SAMPLE_OREF-045A-Historic-Property-Addendum.pdf'],
  ['046', 'Woodstove and Woodburning Fireplace Insert Addendum', '2025/01/SAMPLE_OREF-046-Wood-Stove-Wood-Burning-Fireplace-Insert-Addendum.pdf'],
  ['047', 'Advisory Regarding Real Estate Compensation', '2025/01/SAMPLE_OREF-047-Advisory-Regarding-Real-Estate-Compensation.pdf'],
  ['048', 'Seller Contributions Addendum', '2025/01/SAMPLE_OREF-048-Seller-Contributions-Addendum.pdf'],
  ['050', 'Buyer Representation Agreement Exclusive', '2025/01/SAMPLE_OREF-050-Buyer-Representation-Agreement-Exclusive.pdf'],
  ['050A', 'Buyer Representation Agreement Addendum', '2025/01/SAMPLE_OREF-050A-Buyer-Representation-Agreement-Addendum.pdf'],
  ['050B', 'Buyer Representation Agreement Early Termination', '2025/01/SAMPLE_OREF-050B-Buyer-Representation-Agreement-Early-Termination.pdf'],
  ['052', 'Buyer Representation Agreement Nonexclusive', '2025/03/SAMPLE_OREF-052-Buyer-Representation-Agreement-Nonexclusive.pdf'],
  ['053', 'Agreement to Occupy Before Closing', '2025/01/SAMPLE_OREF-053-Agreement-to-Occupy-Before-Closing.pdf'],
  ['054', 'Agreement to Occupy After Closing', '2025/01/SAMPLE_OREF-054-Agreement-to-Occupy-After-Closing.pdf'],
  ['055', 'Buyers Waiver of Right to Revoke', '2025/01/SAMPLE_OREF-055-Buyers-Waiver-of-Right-to-Revoke.pdf'],
  ['056', 'Buyers Notice of Revocation and Demand for Refund', '2025/01/SAMPLE_OREF-056-Buyers-Notice-RevocationDemand-for-Refund.pdf'],
  ['057', 'Termination Agreement and Deposit Disbursement Instructions', '2025/01/SAMPLE_OREF-057-Termination-Agreement.pdf'],
  ['058', 'Advisory to Buyer Regarding Due Diligence', '2026/01/SAMPLE_OREF-058-Advisory-to-Buyer-Regarding-Due-Diligence.pdf'],
  ['059', 'Delivery Addendum', '2025/01/SAMPLE_OREF-059-Delivery-Addendum.pdf'],
  ['060', 'Contingency Removal Addendum', '2025/03/SAMPLE_OREF-060-Removal-of-Contingencies-Addendum.pdf'],
  ['061', 'Advisory Re Purchase of Bank-Owned Property', '2025/01/SAMPLE_OREF-061-Advis-to-Buyer-Re-Purchase-of-BankOwned-Property.pdf'],
  ['064', 'Notice of Buyers Unconditional Disapproval', '2025/01/SAMPLE_OREF-064-Notice-of-Buyers-Unconditional-Disapproval.pdf'],
  ['065', 'Addendum to Listing Employment Service Contract for Option Agreements', '2025/01/SAMPLE_OREF-065-Adden-to-List-Emplymnt-Svc-Cntrct-for-Optn-Agrmnts.pdf'],
  ['066', 'Buyers Instructions Re Transferring Funds Out of State', '2025/01/SAMPLE_OREF-066-Buyers-Instructions-Re-Transferring-Funds-Out-of-State.pdf'],
  ['070', 'Investment Property Addendum', '2025/01/SAMPLE_OREF-070-Investment-Property-Addendum.pdf'],
  ['071', 'Bill of Sale', '2025/01/SAMPLE_OREF-071-Bill-of-Sale.pdf'],
  ['072', 'Tenant Estoppel Certificate', '2025/01/SAMPLE_OREF-072-Tenant-Estoppel-Certificate.pdf'],
  ['073', 'Assignment and Assumption of Leases', '2025/01/SAMPLE_OREF-073-Assignment-and-Assumption-of-Leases.pdf'],
  ['080', 'Advisory Regarding Smoke and Carbon Monoxide Alarms', '2025/01/SAMPLE_OREF-080-Advisory-Re-SmokeCarbon-Monoxide-Alarms.pdf'],
  ['081', 'Septic Onsite Sewage System Addendum', '2025/01/SAMPLE_OREF-081-Septic-Onsite-Sewage-System-Addendum.pdf'],
  ['082', 'Private Well Addendum', '2025/01/SAMPLE_OREF-082-Private-Well-Addendum.pdf'],
  ['083', 'Buyers Contingent Right to Purchase Addendum', '2025/01/SAMPLE_OREF-083-Buyers-Contingent-Right-to-Purchase-Addendum.pdf'],
  ['083A', 'Contingent Right to Purchase Notice to Seller', '2025/01/SAMPLE_OREF-083A-Contingent-Right-to-Purchase-Notice-to-Seller.pdf'],
  ['083B', 'Contingent Right to Purchase Notice to Buyer', '2025/01/SAMPLE_OREF-083B-Contingent-Right-to-Purchase-Notice-to-Buyer.pdf'],
  ['085', 'Option Agreement', '2025/01/SAMPLE_OREF-085-Option-Agreement.pdf'],
  ['085A', 'Memorandum of Option Agreement', '2025/12/SAMPLE_OREF-085A-Memorandum-of-Option-Agreement.pdf'],
  ['085SUM', 'Advisory Regarding Lease Option', '2025/01/SAMPLE_OREF-085SUM-Advisory-Regarding-Lease-Option.pdf'],
  ['086', 'Notice Demand for Disbursal of Disputed Trust Funds', '2025/01/SAMPLE_OREF-086-Notice-Demand-for-Disbursal-of-Disputed-Trust-Funds-1.pdf'],
  ['092', 'Advisory Regarding FIRPTA Tax', '2025/01/SAMPLE_OREF-092-Advisory-Regarding-FIRPTA.pdf'],
  ['096', 'Extraordinary Event Addendum', '2025/01/SAMPLE_OREF-096-Extraordinary-Event-Addendum.pdf'],
  ['097', 'VA FHA Amendatory Clause and Real Estate Certification', '2025/01/SAMPLE_OREF-097-VA-FHA-Amendatory-ClauseReal-Estate-Cert.pdf'],
  ['098', 'Advisory to Buyer Regarding Waiving Contingencies', '2025/01/SAMPLE_OREF-098-Advisory-to-Buyer-Regarding-Waiving-Contingencies.pdf'],
  ['099', 'Sellers Contingent Obligation to Sell Addendum', '2025/01/SAMPLE_OREF-099-Sellers-Contingent-Obligation-to-Sell-Addendum.pdf'],
  ['100', 'Unrepresented Party Acknowledgement', '2025/01/SAMPLE_OREF-100-Unrepresented-Party-Acknowledgment.pdf'],
  ['101', 'Offer Summary', '2025/01/SAMPLE_OREF-101-Offer-Summary.pdf'],
  ['102', 'Advisory to Buyer Regarding Recording Devices', '2025/01/SAMPLE_OREF-102-Advisory-to-Buyer-Re-Recording-Devices.pdf'],
  ['103', 'Advisory Regarding Title Insurance', '2025/01/SAMPLE_OREF-103-Advisory-Regarding-Title-Insurance.pdf'],
  ['104', 'Advisory Regarding Fair Housing', '2025/01/SAMPLE_OREF-104-Advisory-Regarding-Fair-Housing.pdf'],
  ['105', 'Solar Panel System Addendum', '2025/01/SAMPLE_OREF-105-Solar-Panel-System-Addendum.pdf'],
  ['106', 'Advisory Regarding Tenant-Occupied Property', '2025/01/SAMPLE_OREF-106-Advisory-Re-Tenant-Occupied-Property.pdf'],
  ['107', 'Referral Fee Agreement', '2025/01/SAMPLE_OREF-107-Referral-Fee-Agreement.pdf'],
  ['108', 'Advisory and Instructions Regarding Real Estate Purchase and Sale Forms', '2025/01/SAMPLE_OREF-108-Advis-and-Inst-Re-Real-Estate-Purchase-and-Sale-Forms.pdf'],
  ['109', 'Notice From Buyer To Seller', '2025/01/SAMPLE_OREF-109-Notice-from-Buyer-to-Seller.pdf'],
  ['110', 'Notice From Seller To Buyer', '2025/01/SAMPLE_OREF-110-Notice-from-Seller-to-Buyer.pdf'],
  ['111', 'Advisory Regarding Timber Property', '2025/01/SAMPLE_OREF-111-Advisory-Regarding-Timber-Property.pdf'],
  ['112', 'Translation and Interpretation Services Affidavit', '2025/01/SAMPLE_OREF-112-Translation-and-Interpretation-Service-Affidavit.pdf'],
  ['113', 'Buyers Agent Instructions to Escrow', '2025/05/SAMPLE_OREF-113-Buyers-Agent-Instructions-to-Escrow.pdf'],
  ['114', 'Sellers Agent Instructions to Escrow', '2025/05/SAMPLE_OREF-114-Sellers-Agent-Instructions-to-Escrow.pdf'],
  ['115', 'Advisory Regarding Non-borrowing Co-owners', '2025/05/SAMPLE_OREF-115-Advisory-to-Buyer-Regarding-Non-borrowing-Co-owners.pdf'],
  ['116', 'Advisory Regarding Solar Panels', '2025/09/SAMPLE_OREF-116-Advisory-Regarding-Solar-Panels.pdf'],
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await fs.mkdir(OUT, { recursive: true })
let ok = 0
let skipped = 0
let failed = []
for (const [num, name, rel] of FORMS) {
  const out = path.join(OUT, `OREF-${num}__${name.replace(/[^a-zA-Z0-9 -]/g, '').replace(/\s+/g, '_')}.pdf`)
  if (existsSync(out)) {
    skipped++
    continue
  }
  try {
    const r = await fetch(`${BASE}/${rel}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } })
    if (!r.ok) {
      failed.push([num, r.status])
      continue
    }
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length < 10_000 || !buf.subarray(0, 5).toString().startsWith('%PDF')) {
      failed.push([num, 'not-pdf'])
      continue
    }
    await fs.writeFile(out, buf)
    ok++
    console.log(`ok OREF-${num} ${name} (${Math.round(buf.length / 1024)} KB)`)
  } catch (e) {
    failed.push([num, e?.message])
  }
  await sleep(350)
}
console.log(`\ndownloaded ${ok}, skipped ${skipped} existing, failed ${failed.length}${failed.length ? ': ' + failed.map((f) => f.join(':')).join(', ') : ''}`)
