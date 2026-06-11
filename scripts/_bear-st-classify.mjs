#!/usr/bin/env node
/**
 * Classify all 42 Bear St PDFs from their extracted text and emit a
 * report.jsonl in the same shape the Anthropic-API pipeline produces.
 * No API calls — pure text + filename pattern matching from this
 * session.
 *
 * Bear St context (per Matt's confirmation):
 *   - Property: 15352 Bear St, La Pine OR 97739 (rural)
 *   - Listing-side: Matt Ryan (Detweiler trust sellers)
 *   - Buyer-side: Travis Cannon, also Ryan Realty (intracompany dual)
 *   - Buyer entity: Hernandez Framing LLC
 *   - Closed 2024-10-22 at $98,000 (lot/land)
 *   - 3 offer cycles:
 *       Offer 1 (Bear24) — terminated
 *       Offer 2 (Hernandez) — CLOSED
 *       Offer 3 — only Lead-Paint pamphlet found
 *
 * Sale# convention (synthetic since the OREF forms have blank
 * "Sale Agreement #" fields on this older import):
 *   - Offer 1 → "Bear24-Offer1"  (matches "15352Bear24" filename prefix)
 *   - Offer 2 → "Bear24-Offer2"  (the closing cycle)
 *   - Offer 3 → "Bear24-Offer3"
 *
 * Output:
 *   tmp/skyslope-form-compliance-bear-st/2b9046c3-report.jsonl
 *   tmp/skyslope-form-compliance-bear-st/2b9046c3-summary.md
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const GUID = '2b9046c3-25aa-4efd-b4b1-bd381d6f2a8d'
const ROOT = `tmp/skyslope-pdfs/${GUID}`
const TEXTS = `${ROOT}/texts`
const OUT_DIR = `tmp/skyslope-form-compliance-bear-st`
await fs.mkdir(OUT_DIR, { recursive: true })

const CLOSING_SALE = 'Bear24-Offer2'
const FAILED_SALE = 'Bear24-Offer1'
const SELLERS = ['Martha Detweiler', 'David Detweiler']
const BUYERS_CLOSING = ['Hernandez Framing LLC']

// FORM CLASSIFIER — match against OREF library + Ryan Realty form library
const FORM_PATTERNS = [
  { id: 'oref-001-rsa', name: 'Residential Real Estate Sale Agreement', number: '001', category: 'Sales Documentation',
    test: (t) => /RESIDENTIAL\s+REAL\s+ESTATE\s+SALE\s+AGREEMENT/i.test(t) && /OREF\s*001/i.test(t),
    signers: ['buyer', 'seller'] },
  { id: 'oref-002-addendum', name: 'Sale Addendum', number: '002', category: 'Sales Documentation',
    test: (t) => /ADDENDUM\s+TO\s+(REAL\s+ESTATE\s+)?SALE\s+AGREEMENT/i.test(t) && /OREF\s*002/i.test(t),
    signers: ['buyer', 'seller'] },
  { id: 'oref-003-counter', name: "Seller's Counteroffer", number: '003', category: 'Sales Documentation',
    test: (t) => /SELLER.?S?\s+COUNTEROFFER/i.test(t),
    signers: ['buyer', 'seller'] },
  { id: 'oref-004-buyer-counter', name: "Buyer's Counteroffer", number: '004', category: 'Sales Documentation',
    test: (t) => /BUYER.?S?\s+COUNTEROFFER/i.test(t) && !/SELLER/i.test(t.slice(0, 200)),
    signers: ['buyer', 'seller'] },
  { id: 'oref-015-listing-agreement', name: 'Listing Agreement', number: '015', category: 'Sales Documentation',
    test: (t) => /EXCLUSIVE\s+RIGHT\s+TO\s+SELL|EXCLUSIVE\s+LISTING\s+AGREEMENT/i.test(t),
    signers: ['seller', 'seller_broker'] },
  { id: 'oref-020-spd', name: "Seller's Property Disclosure", number: '020', category: 'Disclosures',
    test: (t) => /SELLER.?S?\s+PROPERTY\s+DISCLOSURE\s+STATEMENT/i.test(t) && !/EXEMPTION/i.test(t.slice(0, 500)),
    signers: ['seller', 'buyer'] },
  { id: 'oref-020-spd-exempt', name: "Seller's Property Disclosure Statement Exemption", number: '020', category: 'Disclosures',
    test: (t) => /SELLER.?S?\s+PROPERTY\s+DISCLOSURE\s+STATEMENT\s+EXEMPTION/i.test(t) ||
                 (/SPD\s+EXEMPTION/i.test(t)),
    signers: ['seller', 'buyer'] },
  { id: 'oref-021-lead-paint-disclosure', name: 'Lead-Based Paint Disclosure', number: '021', category: 'Disclosures',
    test: (t) => /LEAD.?BASED\s+PAINT\s+DISCLOSURE/i.test(t) && /BOTH\s+SIG|FE\s*-\s*Lead/i.test(t),
    signers: ['seller', 'buyer'] },
  { id: 'oref-040-disclosed-limited-agency-sellers', name: 'Disclosed Limited Agency Agreement for Sellers', number: '040', category: 'Disclosures',
    test: (t) => /DISCLOSED\s+LIMITED\s+AGENCY.*SELLER/i.test(t) || /OREF\s*040/i.test(t),
    signers: ['seller', 'seller_broker'] },
  { id: 'oref-041-disclosed-limited-agency-buyers', name: 'Disclosed Limited Agency Agreement for Buyers', number: '041', category: 'Disclosures',
    test: (t) => /DISCLOSED\s+LIMITED\s+AGENCY.*BUY/i.test(t) || /OREF\s*041/i.test(t),
    signers: ['buyer', 'buyer_broker'] },
  { id: 'oref-042-pamphlet', name: 'Initial Agency Disclosure Pamphlet', number: '042', category: 'Disclosures',
    test: (t) => /INITIAL\s+AGENCY\s+DISCLOSURE\s+PAMPHLET/i.test(t) || /OREF\s*042/i.test(t),
    signers: ['acknowledger'] },
  { id: 'oref-043-electronic-funds', name: 'Advisory Regarding Electronic Funds', number: '043', category: 'Disclosures',
    test: (t) => /ADVISORY\s+REGARDING\s+ELECTRONIC\s+FUNDS/i.test(t) || /OREF\s*043/i.test(t),
    signers: ['acknowledger'] },
  { id: 'oref-047-compensation-advisory', name: 'Advisory Regarding Real Estate Compensation', number: '047', category: 'Disclosures',
    test: (t) => /ADVISORY\s+REGARDING\s+REAL\s+ESTATE\s+COMPENSATION/i.test(t) || /OREF\s*047/i.test(t),
    signers: ['acknowledger'] },
  { id: 'oref-050-buyer-rep-exclusive', name: 'Residential Buyer Representation Agreement — Exclusive', number: '050', category: 'Buyer Agreement Documentation',
    test: (t) => /BUYER\s+REPRESENTATION\s+AGREEMENT.*EXCLUSIVE/i.test(t) && !/NON\s*EXCLUSIVE/i.test(t),
    signers: ['buyer', 'buyer_broker'] },
  { id: 'rr-bsa', name: 'Buyer Service Agreement', number: null, category: 'Buyer Agreement Documentation',
    test: (t) => /BUYER\s+SERVICE\s+AGREEMENT/i.test(t),
    signers: ['buyer', 'buyer_broker'] },
  { id: 'rr-bra-non-exclusive', name: 'Buyer Representation Agreement (Non Exclusive)', number: null, category: 'Buyer Agreement Documentation',
    test: (t) => /BUYER\s+REPRESENTATION\s+AGREEMENT.*NON\s*EXCLUSIVE/i.test(t),
    signers: ['buyer', 'buyer_broker'] },
  { id: 'oref-057-termination', name: 'Residential Termination Agreement', number: '057', category: 'Sales Documentation',
    test: (t) => /(RESIDENTIAL\s+)?TERMINATION\s+AGREEMENT/i.test(t) || /MUTUAL\s+RELEASE/i.test(t),
    signers: ['buyer', 'seller'] },
  { id: 'oref-059-receipt-reports', name: 'Receipt of Reports / Removal of Contingencies', number: '059', category: 'Sales Documentation',
    test: (t) => /RECEIPT\s+OF\s+REPORTS|REMOVAL\s+OF\s+CONTINGENCIES/i.test(t) || /OREF\s*059/i.test(t),
    signers: ['buyer'] },
  { id: 'oref-080-smoke-co-advisory', name: 'Smoke / CO Alarms Advisory', number: '080', category: 'Disclosures',
    test: (t) => /SMOKE.*(?:CARBON|CO).*ALARM|OREF\s*080/i.test(t),
    signers: ['acknowledger'] },
  { id: 'oref-091-compensation-notice', name: 'Notice of Real Estate Compensation', number: '091', category: 'Sales Documentation',
    test: (t) => /NOTICE\s+OF\s+REAL\s+ESTATE\s+COMPENSATION|OREF\s*091/i.test(t),
    signers: ['buyer', 'seller', 'seller_broker'] },
  { id: 'oref-092-firpta-advisory', name: 'FIRPTA Advisory', number: '092', category: 'Disclosures',
    test: (t) => /ADVISORY\s+REGARDING.*FIRPTA|FOREIGN\s+INVESTMENT.*TAX/i.test(t) || /OREF\s*092/i.test(t),
    signers: ['acknowledger'] },
  { id: 'oref-108-forms-advisory', name: 'Real Estate Forms Advisory', number: '108', category: 'Disclosures',
    test: (t) => /ADVISORY\s+AND\s+INSTRUCTIONS\s+REGARDING\s+REAL\s+ESTATE.*FORMS|OREF\s*108/i.test(t),
    signers: ['acknowledger'] },
  { id: 'oref-109-buyer-notice', name: 'Notice from Buyer to Seller', number: '109', category: 'Sales Documentation',
    test: (t) => /NOTICE\s+FROM\s+BUYER\s+TO\s+SELLER/i.test(t),
    signers: ['buyer'] },
  { id: 'oref-110-seller-notice', name: 'Notice from Seller to Buyer', number: '110', category: 'Sales Documentation',
    test: (t) => /NOTICE\s+FROM\s+SELLER\s+TO\s+BUYER/i.test(t),
    signers: ['seller'] },
  // Rural / on-site utilities
  { id: 'oref-049-private-well-advisory', name: 'Advisory Regarding Septic Wells', number: '049', category: 'Disclosures',
    test: (t) => /ADVISORY\s+REGARDING\s+SEPTIC\s+WELLS?|ADVISORY\s+REGARDING\s+(PRIVATE\s+)?WELL/i.test(t),
    signers: ['acknowledger'] },
  { id: 'private-well-addendum', name: 'Private Well Addendum', number: null, category: 'Disclosures',
    test: (t) => /PRIVATE\s+WELL\s+ADDENDUM/i.test(t),
    signers: ['buyer', 'seller'] },
  { id: 'septic-addendum', name: 'Septic Addendum', number: null, category: 'Disclosures',
    test: (t) => /SEPTIC\s+ADDENDUM/i.test(t),
    signers: ['buyer', 'seller'] },
  // Other listing-side / advisories
  { id: 'rr-survey-advisory', name: 'Advisory Regarding Survey', number: null, category: 'Disclosures',
    test: (t) => /ADVISORY\s+REGARDING\s+SURVEY/i.test(t),
    signers: ['acknowledger'] },
  { id: 'rr-title-advisory', name: 'Advisory to Seller Regarding Title', number: null, category: 'Disclosures',
    test: (t) => /ADVISORY\s+TO\s+SELLER\s+REGARDING\s+TITLE/i.test(t),
    signers: ['seller'] },
  { id: 'rr-lead-paint-seller-advisory', name: 'Advisory to Seller Regarding Lead-Based Paint', number: null, category: 'Disclosures',
    test: (t) => /ADVISORY\s+TO\s+SELLER\s+REGARDING\s+LEAD/i.test(t),
    signers: ['seller'] },
  // Listing-side
  { id: 'mlsco-listing-contract', name: 'MLSCO Listing Contract', number: null, category: 'Sales Documentation',
    test: (t) => /MLSCO|MLS\s+CENTRAL\s+OREGON|ORE\s+RESIDENTIAL\s+INPUT|ORE\s+RESIDENTIAL\s+ODS/i.test(t),
    signers: ['seller'] },
  // Closing-side
  { id: 'em-receipt', name: 'Earnest Money Receipt', number: null, category: 'Closing Documents',
    test: (t) => /EARNEST\s+MONEY\s+(RECEIPT|RELEASE|DEPOSIT)/i.test(t) || /RECEIPT\s+FOR\s+FUNDS/i.test(t) || /EMRR/i.test(t),
    signers: ['escrow_officer'] },
  { id: 'final-settlement-statement', name: 'Final Settlement Statement', number: null, category: 'Closing Documents',
    test: (t) => /FINAL\s+SELLER.?S?\s+STATEMENT|FINAL\s+BUYER.?S?\s+STATEMENT|ALTA\s+SETTLEMENT|SELLER.?S?\s+CLOSING\s+STATEMENT/i.test(t),
    signers: ['escrow_officer'] },
  { id: 'firpta-cert-non-foreign', name: 'FIRPTA Certificate of Non-Foreign Status', number: null, category: 'Disclosures',
    test: (t) => /STATEMENT\s+OF\s+QUALIFIED\s+SUBSTITUTE|FIRPTA.*NON.?FOREIGN|CERTIFICATE.*NON.?FOREIGN/i.test(t),
    signers: ['escrow_officer'] },
  { id: 'lead-paint-pamphlet', name: 'Protect Your Family From Lead in Your Home (EPA pamphlet)', number: null, category: 'Disclosures',
    test: (t) => /PROTECT\s+YOUR\s+FAMILY\s+FROM\s+LEAD/i.test(t),
    signers: [] },
  { id: 'pre-approval-letter', name: 'Pre-Approval Letter / Proof of Funds', number: null, category: 'Sales Documentation',
    test: (t) => /PRE.?APPROVAL\s+LETTER|PROOF\s+OF\s+FUNDS|(?:^|\s)POF(?:\s|$)/i.test(t.slice(0, 500)),
    signers: ['lender'] },
  { id: 'misc-addendum-sale-price', name: 'Sale Price Addendum (custom)', number: null, category: 'Sales Documentation',
    test: (t, fname) => /sale price addendum/i.test(fname || ''),
    signers: ['buyer', 'seller'] },
  { id: 'back-up-offer-addendum', name: 'Back-Up Offer Addendum', number: null, category: 'Sales Documentation',
    test: (t, fname) => /BACK\s*-?\s*UP\s+OFFER\s+ADDENDUM/i.test(t) || /back up offer/i.test(fname || ''),
    signers: ['buyer', 'seller'] },
  // Bear St Termination-specific
  { id: 'rr-termination-correspondence', name: 'Bear Street Termination Correspondence', number: null, category: 'Sales Documentation',
    test: (t, fname) => /Bear Street Termination/i.test(fname || ''),
    signers: ['buyer'] },
]

// Execution signal — checks for signatures or initials on the text
function detectExecution(text, formId, signers) {
  if (!signers || signers.length === 0) {
    return { executed: text.trim().length > 100, reason: 'no signers required (informational)' }
  }
  const t = text || ''
  // Look for DocuSign / DigiSign envelope completion
  const isDocusigned = /DocuSign Envelope ID|DigiSign|Adobe Sign|completed?\s+on|signed\s+on/i.test(t)
  // Count digital signature blocks
  const sigMatches = t.match(/(?:DocuSigned by:|Signed by:|Digitally signed by|Electronically signed by|\/s\/)/gi) || []
  const initialMatches = t.match(/Initials?[:\s]*\S{2}/gi) || []
  const hasBuyerSig = /Hernandez/i.test(t) && (sigMatches.length > 0 || isDocusigned)
  const hasSellerSig = /(Martha|David)\s+Detweiler/i.test(t) && (sigMatches.length > 0 || isDocusigned)
  // Require at least one signature marker
  if (sigMatches.length === 0 && !isDocusigned) {
    return { executed: false, reason: 'no signature markers found', sigCount: 0, isDocusigned: false }
  }
  // Form-specific rules
  if (signers.includes('buyer') && signers.includes('seller')) {
    if (hasBuyerSig && hasSellerSig) return { executed: true, reason: 'buyer + seller markers + sigs found' }
    if (!hasBuyerSig) return { executed: false, reason: 'no buyer signature marker' }
    if (!hasSellerSig) return { executed: false, reason: 'no seller signature marker' }
  }
  if (signers.length === 1) {
    return { executed: sigMatches.length >= 1 || isDocusigned, reason: 'single-signer required' }
  }
  return { executed: sigMatches.length >= 2 || (sigMatches.length >= 1 && isDocusigned), reason: 'multi-signer; bias permissive' }
}

// Sale-# inference from filename + content
function inferSaleNumber(fname, page1) {
  // Filename hints
  if (/Bear24|15352Bear24/i.test(fname)) return FAILED_SALE
  if (/Offer 1\b/i.test(fname)) return FAILED_SALE
  if (/Offer 2\b|Hernandez/i.test(fname)) return CLOSING_SALE
  if (/Offer 3\b/i.test(fname)) return 'Bear24-Offer3'
  // Page-1 sale agreement #
  const m = page1.match(/Sale\s+Agreement\s*(?:Number|#)\s*[:.]?\s*([A-Z0-9\-./]+)/i)
  if (m && m[1] && m[1].length >= 3 && m[1].length < 40) return m[1]
  // Default to closing for cross-cycle reference docs
  return null
}

// MAIN
const files = (await fs.readdir(TEXTS)).filter((f) => f.endsWith('.json'))
const reportLines = []
const summary = { canonical: [], archive: [], unidentified: [] }

for (const file of files) {
  const obj = JSON.parse(await fs.readFile(`${TEXTS}/${file}`, 'utf8'))
  const fname = obj.original
  const docId = obj.docId
  const text = (obj.page1 || '') + '\n' + (obj.lastTwoPages?.map((p) => p.text).join('\n') || '')

  if (!obj.hasText) {
    // Image-only PDF — make best guess from filename
    const guess = FORM_PATTERNS.find((p) => p.test(text, fname)) // most won't match
    const entry = {
      docId,
      currentName: fname,
      pages: obj.totalPages,
      formId: guess?.id || null,
      formName: guess?.name || null,
      orefNumber: guess?.number || null,
      saleNumber: inferSaleNumber(fname, ''),
      executed: false,
      executionReason: 'image-only PDF, no extractable text',
      isCanonical: false,
      archiveReason: 'needs_label',
      proposedName: `ARCHIVE - ${fname.replace(/\.pdf$/i, '')} - needs_label.pdf`,
    }
    reportLines.push(JSON.stringify(entry))
    summary.archive.push(entry)
    continue
  }

  // Match form
  const form = FORM_PATTERNS.find((p) => p.test(text, fname))
  if (!form) {
    const entry = {
      docId,
      currentName: fname,
      pages: obj.totalPages,
      formId: null,
      formName: null,
      orefNumber: null,
      saleNumber: inferSaleNumber(fname, text),
      executed: false,
      executionReason: 'no form library match',
      isCanonical: false,
      archiveReason: 'unidentified',
      proposedName: `ARCHIVE - ${fname.replace(/\.pdf$/i, '')} - unidentified.pdf`,
    }
    reportLines.push(JSON.stringify(entry))
    summary.unidentified.push(entry)
    continue
  }

  const saleNumber = inferSaleNumber(fname, text)
  const exec = detectExecution(text, form.id, form.signers)

  // Build v5 name
  function sanitize(s) {
    return String(s || '')
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/[–—]/g, '-')
      .replace(/…/g, 'etc')
      .replace(/&/g, ' and ')
      .replace(/\s+/g, ' ')
      .replace(/\./g, '-')
      .trim()
  }

  const parts = []
  if (saleNumber) parts.push(sanitize(saleNumber))
  if (exec.executed) parts.push('X')
  if (form.number) parts.push(form.number)
  parts.push(sanitize(form.name))
  const stem = parts.join('_')
  const baseName = `${stem}.pdf`

  // Canonical vs archive
  const isCanonical = exec.executed
  const entry = {
    docId,
    currentName: fname,
    pages: obj.totalPages,
    formId: form.id,
    formName: form.name,
    orefNumber: form.number,
    saleNumber,
    signers: form.signers,
    executed: exec.executed,
    executionReason: exec.reason,
    isCanonical,
    archiveReason: isCanonical ? null : (exec.reason || 'not_executed'),
    proposedName: isCanonical
      ? baseName
      : `ARCHIVE - ${stem.replace(/^X_/, '')} - not_executed.pdf`,
  }
  reportLines.push(JSON.stringify(entry))
  if (isCanonical) summary.canonical.push(entry)
  else summary.archive.push(entry)
}

await fs.writeFile(`${OUT_DIR}/${GUID.slice(0, 8)}-report.jsonl`, reportLines.join('\n') + '\n')

// Build summary markdown
const md = []
md.push(`# Bear St — local classification (no API)`)
md.push(``)
md.push(`Folder GUID: \`${GUID}\``)
md.push(`Docs processed: ${reportLines.length}`)
md.push(`Canonical: ${summary.canonical.length}`)
md.push(`Archive: ${summary.archive.length}`)
md.push(`Unidentified: ${summary.unidentified.length}`)
md.push(``)
md.push(`## Canonical`)
md.push(``)
for (const e of summary.canonical) {
  md.push(`- \`${e.proposedName}\``)
  md.push(`  - was: \`${e.currentName}\``)
  md.push(`  - form: ${e.formId}`)
  md.push(`  - reason: ${e.executionReason}`)
}
md.push(``)
md.push(`## Archive`)
md.push(``)
for (const e of summary.archive) {
  md.push(`- \`${e.proposedName}\`  _(${e.archiveReason})_`)
  md.push(`  - was: \`${e.currentName}\``)
  if (e.formId) md.push(`  - form: ${e.formId}`)
  md.push(`  - reason: ${e.executionReason}`)
}
md.push(``)
md.push(`## Unidentified (needs human review)`)
md.push(``)
for (const e of summary.unidentified) {
  md.push(`- \`${e.currentName}\` (${e.pages} pages)`)
}
await fs.writeFile(`${OUT_DIR}/${GUID.slice(0, 8)}-summary.md`, md.join('\n'))

console.log(`Done.`)
console.log(`  Canonical:    ${summary.canonical.length}`)
console.log(`  Archive:      ${summary.archive.length}`)
console.log(`  Unidentified: ${summary.unidentified.length}`)
console.log(``)
console.log(`Report: ${OUT_DIR}/${GUID.slice(0, 8)}-report.jsonl`)
console.log(`Summary: ${OUT_DIR}/${GUID.slice(0, 8)}-summary.md`)
