/**
 * Canonical OREF + Ryan Realty form library.
 *
 * The source of truth for which form is which, who must sign, and where
 * the signature blocks live on the page. Every SkySlope doc op runs
 * through this library first.
 *
 * If a doc doesn't match any entry here, it gets flagged for human
 * review and the rename pipeline does NOT touch it.
 *
 * See references/oref-form-library.md for the full reference.
 */

/** @typedef {'buyer'|'seller'|'seller_broker'|'buyer_broker'|'acknowledger'|'lender'|'escrow_officer'|'title_officer'|'inspector'|'vendor'|'single_party'|'not_applicable'} SignerRole */

/**
 * @typedef {Object} FormEntry
 * @property {string} formId
 * @property {string} name              // canonical FormName for v4
 * @property {string|null} oref         // OREF number, informational
 * @property {string} category          // sale_agreement, addendum, etc.
 * @property {RegExp} headerRegex       // page-1 header stamp
 * @property {RegExp} titleRegex        // form title text
 * @property {[number, number]} pages   // typical page range
 * @property {SignerRole[]} signers
 * @property {Array<{ pages: [number, number]|number, roles: SignerRole[] }>} signatureBlocks
 * @property {string[]} [aliases]       // alternate filename hints (informational)
 * @property {string} [notes]
 */

/** @type {FormEntry[]} */
export const FORM_LIBRARY = [
  {
    formId: 'oref-001-rsa',
    name: 'Residential Real Estate Sale Agreement',
    oref: '001',
    category: 'sale_agreement',
    headerRegex: /OREF[-\s]*001|Residential\s+Real\s+Estate\s+Sale\s+Agreement|\bRSA\b/i,
    titleRegex: /residential\s+real\s+estate\s+sale\s+agreement/i,
    pages: [13, 16],
    signers: ['buyer', 'seller'],
    signatureBlocks: [
      { pages: [13, 16], roles: ['buyer', 'buyer', 'seller', 'seller'] },
    ],
    aliases: ['RSA', 'Sale Agreement', 'Purchase Agreement'],
    notes: 'Sale Agreement # extracted from page 1 top-right is the canonical sale identifier.',
  },
  {
    formId: 'oref-002-addendum',
    name: 'Sale Addendum',
    oref: '002',
    category: 'addendum',
    headerRegex: /OREF[-\s]*002|Sale\s+Agreement\s+Addendum/i,
    titleRegex: /sale\s+agreement\s+addendum/i,
    pages: [2, 4],
    signers: ['buyer', 'seller'],
    signatureBlocks: [
      { pages: -1, roles: ['buyer', 'buyer', 'seller', 'seller'] },
    ],
    aliases: ['Addendum', 'Sale Addendum'],
  },
  {
    formId: 'oref-003-counter',
    name: 'Counter Offer',
    oref: '003',
    category: 'counter',
    headerRegex: /OREF[-\s]*003|Counter\s+Offer/i,
    titleRegex: /counter\s+offer/i,
    pages: [2, 3],
    signers: ['buyer', 'seller'],
    signatureBlocks: [
      { pages: -1, roles: ['buyer', 'buyer', 'seller', 'seller'] },
    ],
    aliases: ['Counter', 'Counter Offer 2', 'Counter Offer No 1'],
  },
  {
    formId: 'oref-015-listing-agreement',
    name: 'Listing Agreement and SA',
    oref: '015',
    category: 'listing_agreement',
    headerRegex: /OREF[-\s]*015|Exclusive\s+Right\s+to\s+Sell|Listing\s+Agreement/i,
    titleRegex: /listing\s+agreement|exclusive\s+right\s+to\s+sell/i,
    pages: [4, 7],
    signers: ['seller', 'seller_broker'],
    signatureBlocks: [
      { pages: -1, roles: ['seller', 'seller', 'seller_broker'] },
    ],
    aliases: ['Listing Agreement', 'Exclusive Right to Sell'],
  },
  {
    formId: 'oref-020-spd',
    name: 'Sellers Property Disclosure',
    oref: '020',
    category: 'spd',
    headerRegex: /OREF[-\s]*02[02]|Seller'?s?\s+Property\s+Disclosure/i,
    titleRegex: /seller'?s?\s+property\s+disclosure/i,
    pages: [5, 9],
    signers: ['seller', 'buyer'],
    signatureBlocks: [
      { pages: -2, roles: ['seller', 'seller'] },
      { pages: -1, roles: ['buyer', 'buyer'] },
    ],
    aliases: ['SPD', 'Property Disclosure'],
    notes: 'Sellers disclose; buyers acknowledge receipt. BOTH sides required for full execution.',
  },
  {
    formId: 'oref-040-buyer-rep',
    name: 'Buyers Rep Agreement',
    oref: '040',
    category: 'buyer_rep',
    headerRegex: /OREF[-\s]*0(?:40|41|50)|Buyer'?s?\s+Service\s+Agreement|Buyer\s+Representation\s+Agreement|Exclusive\s+Right\s+to\s+Represent/i,
    titleRegex: /buyer\s+service\s+agreement|buyer\s+representation|exclusive\s+right\s+to\s+represent/i,
    pages: [3, 5],
    signers: ['buyer', 'buyer_broker'],
    signatureBlocks: [
      { pages: -1, roles: ['buyer', 'buyer', 'buyer_broker'] },
    ],
    aliases: ['Buyer Rep', 'BBC', 'Buyer Service Agreement'],
  },
  {
    formId: 'oref-042-pamphlet',
    name: 'Initial Agency Disclosure',
    oref: '042',
    category: 'agency_disclosure',
    headerRegex: /OREF[-\s]*042|Initial\s+Agency\s+Disclosure|Disclosure\s+Pamphlet/i,
    titleRegex: /initial\s+agency\s+disclosure|agency\s+disclosure\s+pamphlet/i,
    pages: [2, 4],
    signers: ['acknowledger'],
    signatureBlocks: [
      { pages: -1, roles: ['acknowledger'] },
    ],
    aliases: ['Agency Disclosure', '042 Pamphlet'],
    notes: 'Acknowledger = seller on listing folder, buyer on sale folder.',
  },
  {
    formId: 'oref-043-electronic-funds',
    name: 'Electronic Funds Advisory',
    oref: '043',
    category: 'advisory',
    headerRegex: /OREF[-\s]*04[34]|Electronic\s+Funds|Wire\s+Fraud/i,
    titleRegex: /electronic\s+funds|wire\s+fraud\s+advisory/i,
    pages: [1, 2],
    signers: ['single_party'],
    signatureBlocks: [{ pages: -1, roles: ['single_party'] }],
    aliases: ['Wire Fraud Advisory', 'Electronic Funds Transfer Advisory'],
  },
  {
    formId: 'oref-047-compensation-advisory',
    name: 'Real Estate Compensation Advisory',
    oref: '047',
    category: 'advisory',
    headerRegex: /OREF[-\s]*04[78]|Real\s+Estate\s+Compensation\s+Advisory/i,
    titleRegex: /real\s+estate\s+compensation\s+advisory/i,
    pages: [1, 2],
    signers: ['single_party'],
    signatureBlocks: [{ pages: -1, roles: ['single_party'] }],
    aliases: ['Compensation Advisory'],
  },
  // ----- FIRPTA-related forms — order specifically before OREF 092 -----
  // so the more-specific Qualified Substitute regex wins disambiguation.
  {
    formId: 'escrow-agent-qualified-substitute',
    name: 'Statement of Escrow Agent Acting as Qualified Substitute',
    oref: null,
    category: 'firpta_related',
    headerRegex: /STATEMENT\s+OF\s+ESCROW\s+AGENT\s+ACTING\s+AS\s+QUALIFIED\s+SUBSTITUTE|ESCROW\s+AGENT\s+ACTING\s+AS\s+QUALIFIED\s+SUBSTITUTE/i,
    titleRegex: /statement\s+of\s+escrow\s+agent\s+acting\s+as\s+qualified\s+substitute|escrow\s+agent\s+acting\s+as\s+qualified\s+substitute/i,
    pages: [1, 2],
    signers: ['not_applicable'],
    signatureBlocks: [],
    aliases: ['Statement of Escrow Agent Qualified Substitute', 'Qualified Substitute'],
    notes: 'Issued by escrow at closing under FIRPTA — escrow agent certifies they hold funds as qualified substitute under IRS Sec 1445. Title-issued, canonical when present.',
  },
  {
    formId: 'firpta-certificate-non-foreign',
    name: 'FIRPTA Certificate of Non-Foreign Status',
    oref: null,
    category: 'firpta',
    headerRegex: /CERTIFICATION\s+OF\s+NON[\s-]?FOREIGN\s+STATUS|Non[\s-]?Foreign\s+Affidavit|Seller'?s?\s+Affidavit\s+of\s+Non[\s-]?Foreign\s+Status/i,
    titleRegex: /certification?\s+of\s+non[\s-]?foreign\s+status|non[\s-]?foreign\s+affidavit|non[\s-]?foreign\s+person\s+certification/i,
    pages: [1, 3],
    signers: ['seller'],
    signatureBlocks: [{ pages: -1, roles: ['seller'] }],
    aliases: ['Non-Foreign Affidavit', 'FIRPTA Cert', 'Non-Foreign Person Certificate'],
    notes: 'Sellers sign certifying they are not a foreign person under FIRPTA.',
  },
  {
    formId: 'oref-080-smoke-alarms',
    name: 'Smoke Alarms Advisory',
    oref: '080',
    category: 'advisory',
    headerRegex: /OREF[-\s]*080|Smoke\s+Alarm|Carbon\s+Monoxide/i,
    titleRegex: /smoke\s+alarm|carbon\s+monoxide/i,
    pages: [1, 2],
    signers: ['seller'],
    signatureBlocks: [{ pages: -1, roles: ['seller'] }],
    aliases: ['Smoke Detector Advisory', 'CO Advisory'],
  },
  {
    formId: 'oref-092-firpta',
    name: 'FIRPTA Advisory',
    oref: '092',
    category: 'advisory',
    headerRegex: /OREF[-\s]*092|FIRPTA\s+Advisory|Foreign\s+Investment\s+in\s+Real\s+Property\s+Tax\s+Act\s+Advisory/i,
    titleRegex: /firpta\s+advisory|firpta\s+notice/i,
    pages: [1, 2],
    signers: ['single_party'],
    signatureBlocks: [{ pages: -1, roles: ['single_party'] }],
    aliases: ['FIRPTA Notice'],
  },
  {
    formId: 'oref-098-compensation-notice',
    name: 'Notice of Real Estate Compensation',
    oref: '098',
    category: 'compensation_notice',
    headerRegex: /OREF[-\s]*098|Notice\s+of\s+Real\s+Estate\s+Compensation|Compensation\s+Demand/i,
    titleRegex: /notice\s+of\s+real\s+estate\s+compensation/i,
    pages: [1, 2],
    signers: ['seller_broker'],
    signatureBlocks: [{ pages: -1, roles: ['seller_broker'] }],
    aliases: ['Commission Demand', 'Compensation Demand'],
  },
  {
    formId: 'oref-103-forms-advisory',
    name: 'Real Estate Forms Advisory',
    oref: '103',
    category: 'advisory',
    headerRegex: /OREF[-\s]*10[38]|Real\s+Estate\s+Forms\s+Advisory/i,
    titleRegex: /real\s+estate\s+forms\s+advisory/i,
    pages: [1, 2],
    signers: ['single_party'],
    signatureBlocks: [{ pages: -1, roles: ['single_party'] }],
    aliases: ['Forms Advisory'],
  },
  // ----- Non-OREF docs (no headerRegex; identified by title pattern) -----
  {
    formId: 'em-receipt',
    name: 'Earnest Money Receipt',
    oref: null,
    category: 'receipt',
    headerRegex: /^$/i, // no header match — title only
    titleRegex: /(receipt\s+(for\s+)?(earnest\s+money|funds)|earnest\s+money\s+(deposit|receipt|received)|funds\s+received.*earnest|earnet\s+money\s+receipt|escrow\s+has\s+received\s+the\s+buyer'?s?\s+earnest\s+money)/i,
    pages: [1, 2],
    signers: ['not_applicable'],
    signatureBlocks: [],
    aliases: ['EM Receipt', 'EM Deposit Receipt', 'Earnest Money IH'],
    notes: 'Issued by title/escrow. Always canonical when present.',
  },
  {
    formId: 'funds-to-close-receipt',
    name: 'Funds to Close Receipt',
    oref: null,
    category: 'receipt',
    headerRegex: /^$/i,
    titleRegex: /funds\s+to\s+close|received\s+your\s+funds\s+to\s+close/i,
    pages: [1, 2],
    signers: ['not_applicable'],
    signatureBlocks: [],
    aliases: [],
    notes: 'Issued by escrow. Always canonical when present.',
  },
  {
    formId: 'preliminary-title-report',
    name: 'Preliminary Title Report',
    oref: null,
    category: 'title_report',
    headerRegex: /PRELIMINARY\s+(TITLE\s+)?REPORT|PRELIMINARY\s+(REPORT|COMMITMENT)|FIRST\s+AMERICAN\s+TITLE\s+INSURANCE\s+COMPANY/i,
    titleRegex: /preliminary\s+title\s+report|preliminary\s+report\s+for\s+title\s+insurance|title\s+commitment\s+for/i,
    pages: [10, 60],
    signers: ['not_applicable'],
    signatureBlocks: [],
    aliases: ['Prelim', 'Title Report', 'Title Commitment'],
    notes: 'Reference document. Never executed by the parties.',
  },
  {
    formId: 'final-settlement-statement',
    name: 'Final Settlement Statement',
    oref: null,
    category: 'settlement',
    headerRegex: /FINAL\s+BUYER'?S?\s+STATEMENT|FINAL\s+SELLER'?S?\s+STATEMENT|FINAL\s+SETTLEMENT\s+STATEMENT|FINAL\s+BUYER'?S?\/BORROWER'?S?\s+STATEMENT|SETTLEMENT\s+STATEMENT|HUD-1\s+SETTLEMENT/i,
    titleRegex: /final\s+(buyer'?s?|seller'?s?|settlement)\s+statement|final\s+buyer'?s?\/borrower'?s?\s+statement|hud-1\s+settlement\s+statement|final\s+closing\s+statement/i,
    pages: [2, 8],
    signers: ['not_applicable'],
    signatureBlocks: [],
    aliases: ['Final Statement', 'Settlement Statement', 'BuyerBorrower Statement', 'IHSA'],
    notes: 'Issued by title at closing. Title-company-generated, canonical when present.',
  },
  {
    formId: 'closing-disclosure',
    name: 'Closing Disclosure',
    oref: null,
    category: 'settlement',
    headerRegex: /^$/i,
    titleRegex: /closing\s+disclosure|CD\s+form/i,
    pages: [5, 8],
    signers: ['buyer'],
    signatureBlocks: [{ pages: -1, roles: ['buyer'] }],
    aliases: ['CD'],
  },
  {
    formId: 'pre-approval-letter',
    name: 'Pre-Approval Letter',
    oref: null,
    category: 'lender',
    headerRegex: /PRE[-\s]?APPROVAL\s+LETTER|LOAN\s+PRE[-\s]?APPROVAL|MORTGAGE\s+PRE[-\s]?APPROVAL|PROOF\s+OF\s+FUNDS/i,
    titleRegex: /pre[-\s]?approval\s+letter|proof\s+of\s+funds|loan\s+pre[-\s]?approval|mortgage\s+pre[-\s]?approval/i,
    pages: [1, 3],
    signers: ['lender'],
    signatureBlocks: [{ pages: -1, roles: ['lender'] }],
    aliases: ['POF', 'Pre-Qual Letter'],
  },
  {
    formId: 'inspection-report',
    name: 'Home Inspection Report',
    oref: null,
    category: 'inspection',
    headerRegex: /HOME\s+INSPECTION\s+REPORT|PROPERTY\s+INSPECTION\s+REPORT|GENERAL\s+INSPECTION\s+REPORT|INSPECTION\s+SUMMARY\s+REPORT/i,
    titleRegex: /home\s+inspection\s+report|property\s+inspection\s+report|general\s+inspection\s+(summary|report)/i,
    pages: [10, 100],
    signers: ['not_applicable'],
    signatureBlocks: [],
    aliases: [],
    notes: 'Inspector report. Never executed — no X. Headers must explicitly say "Inspection Report" to avoid matching unrelated docs.',
  },
]

/**
 * Identify a form from PAGE 1 of the document's OCR text.
 *
 * Strict identification — match against PAGE 1 ONLY, not the whole
 * document. A form's identity is declared by its title banner on
 * page 1, not by stray keywords scattered through 50 pages of body.
 *
 * Resolution rules:
 *   1. Header regex hit on page 1 → high confidence. Library order
 *      resolves ties.
 *   2. Title regex hit on page 1 → medium confidence. Longest match
 *      wins.
 *   3. No hit → return null with candidates list.
 *
 * @param {string} pdfText  Full OCR text of the document
 * @returns {{ formId: string, confidence: 'high'|'medium', entry: FormEntry } | { formId: null, candidates: string[], reason: string }}
 */
export function identifyForm(pdfText) {
  if (!pdfText || pdfText.length < 50) {
    return { formId: null, candidates: [], reason: 'empty or unreadable PDF text' }
  }
  // Page 1 is roughly the first 5000 chars after page-break markers.
  // OCR text from skyslope-pdf-insight includes "<<< Page N >>>" delimiters.
  const text = String(pdfText)
  let page1 = text
  const page2Marker = text.search(/<<<\s*Page\s+2\s*>>>/i)
  if (page2Marker > 0) page1 = text.slice(0, page2Marker)
  else page1 = text.slice(0, 5000)

  // Header matches on page 1 — these are the most authoritative
  const headerMatches = []
  for (const entry of FORM_LIBRARY) {
    if (entry.headerRegex.source === '^$') continue
    if (entry.headerRegex.test(page1)) {
      headerMatches.push(entry)
    }
  }
  if (headerMatches.length >= 1) {
    return { formId: headerMatches[0].formId, confidence: 'high', entry: headerMatches[0] }
  }

  // Title matches on page 1 — medium confidence fallback
  const titleMatches = []
  for (const entry of FORM_LIBRARY) {
    const m = page1.match(entry.titleRegex)
    if (m) titleMatches.push({ entry, matchLength: m[0].length, matchedText: m[0] })
  }
  if (titleMatches.length === 0) {
    return { formId: null, candidates: [], reason: 'no header or title match on page 1' }
  }
  titleMatches.sort((a, b) => b.matchLength - a.matchLength)
  const top = titleMatches[0]
  return { formId: top.entry.formId, confidence: 'medium', entry: top.entry }
}

/**
 * @param {string} formId
 * @returns {FormEntry | null}
 */
export function getForm(formId) {
  return FORM_LIBRARY.find((f) => f.formId === formId) || null
}
