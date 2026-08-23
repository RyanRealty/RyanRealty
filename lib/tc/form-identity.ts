/**
 * Identify a form by reading it (page-1 header/title, OREF stamp, filename)
 * and return who must sign. Source: the Oregon form library
 * `.claude/skills/skyslope-form-compliance/references/oref-form-library.md`.
 * Unreadable forms stay unidentified — do not invent parties.
 */
import type { RecipientRole } from './signing'

export type LibrarySigner =
  | 'buyer'
  | 'seller'
  | 'seller_broker'
  | 'buyer_broker'
  | 'acknowledger'
  | 'single_party'
  | 'not_applicable'
  | 'escrow_officer'
  | 'title_officer'
  | 'lender'

export type FormLibraryEntry = {
  formId: string
  name: string
  oref: string | null
  headerRegex: RegExp
  titleRegex: RegExp
  signers: readonly LibrarySigner[]
}

export const FORM_LIBRARY: readonly FormLibraryEntry[] = [
  {
    formId: 'oref-001-rsa',
    name: 'Residential Real Estate Sale Agreement',
    oref: '001',
    headerRegex: /OREF[-\s]*001|Residential\s+Real\s+Estate\s+Sale\s+Agreement/i,
    titleRegex: /residential\s+real\s+estate\s+sale\s+agreement/i,
    signers: ['buyer', 'seller'],
  },
  {
    formId: 'oref-002-addendum',
    name: 'Sale Addendum',
    oref: '002',
    headerRegex: /OREF[-\s]*002|Sale\s+Agreement\s+Addendum/i,
    titleRegex: /sale\s+agreement\s+addendum/i,
    signers: ['buyer', 'seller'],
  },
  {
    formId: 'oref-003-counter',
    name: 'Counter Offer',
    oref: '003',
    headerRegex: /OREF[-\s]*003|Counter\s+Offer/i,
    titleRegex: /counter\s+offer/i,
    signers: ['buyer', 'seller'],
  },
  {
    formId: 'oref-021-lbp',
    name: 'Lead-Based Paint Disclosure Addendum',
    oref: '021',
    headerRegex: /OREF[-\s]*021|Lead[-\s]*Based\s+Paint/i,
    titleRegex: /lead[-\s]*based\s+paint/i,
    signers: ['buyer', 'seller', 'seller_broker', 'buyer_broker'],
  },
  {
    formId: 'oref-015-listing-agreement',
    name: 'Listing Agreement and SA',
    oref: '015',
    headerRegex: /OREF[-\s]*015|Exclusive\s+Right\s+to\s+Sell/i,
    titleRegex: /exclusive\s+right\s+to\s+sell|listing\s+agreement(?!\s+addendum)/i,
    signers: ['seller', 'seller_broker'],
  },
  {
    formId: 'oref-020-spd',
    name: 'Sellers Property Disclosure',
    oref: '020',
    headerRegex: /OREF[-\s]*020|Seller'?s?\s+Property\s+Disclosure/i,
    titleRegex: /seller'?s?\s+property\s+disclosure/i,
    signers: ['seller', 'buyer'],
  },
  {
    formId: 'oref-022-spd',
    name: 'Sellers Property Disclosure',
    oref: '022',
    headerRegex: /OREF[-\s]*022(?![AB])|Seller'?s?\s+Property\s+Disclosure/i,
    titleRegex: /seller'?s?\s+property\s+disclosure/i,
    signers: ['seller', 'buyer'],
  },
  {
    formId: 'oref-022a-buyer-repair',
    name: 'Buyer Repair Addendum',
    oref: '022A',
    headerRegex: /OREF[-\s]*022A/i,
    titleRegex: /buyer\s+repair/i,
    signers: ['buyer', 'seller'],
  },
  {
    formId: 'oref-022b-seller-repair',
    name: 'Seller Repair Addendum',
    oref: '022B',
    headerRegex: /OREF[-\s]*022B/i,
    titleRegex: /seller\s+repair/i,
    signers: ['buyer', 'seller'],
  },
  {
    formId: 'oref-040-disclosed-limited-agency-sellers',
    name: 'Disclosed Limited Agency Agreement for Sellers',
    oref: '040',
    headerRegex: /OREF[-\s]*040|Disclosed\s+Limited\s+Agency.*Sellers?|Limited\s+Agency.*Seller/i,
    titleRegex: /disclosed\s+limited\s+agency.*sellers?|limited\s+agency.*seller/i,
    signers: ['seller', 'seller_broker'],
  },
  {
    formId: 'oref-041-disclosed-limited-agency-buyers',
    name: 'Disclosed Limited Agency Agreement for Buyers',
    oref: '041',
    headerRegex: /OREF[-\s]*041|Disclosed\s+Limited\s+Agency.*Buyers?|Limited\s+Agency.*Buyer/i,
    titleRegex: /disclosed\s+limited\s+agency.*buyers?|limited\s+agency.*buyer/i,
    signers: ['buyer', 'buyer_broker'],
  },
  {
    formId: 'oref-050-buyer-rep',
    name: 'Residential Buyer Representation Agreement - Exclusive',
    oref: '050',
    headerRegex: /OREF[-\s]*050|Residential\s+Buyer\s+Representation\s+Agreement|Exclusive\s+Right\s+to\s+Represent/i,
    titleRegex: /residential\s+buyer\s+representation|exclusive\s+right\s+to\s+represent|buyer\s+service\s+agreement/i,
    signers: ['buyer', 'buyer_broker'],
  },
  {
    formId: 'oref-042-pamphlet',
    name: 'Initial Agency Disclosure',
    oref: '042',
    headerRegex: /OREF[-\s]*042|Initial\s+Agency\s+Disclosure|Disclosure\s+Pamphlet/i,
    titleRegex: /initial\s+agency\s+disclosure|agency\s+disclosure\s+pamphlet/i,
    signers: ['acknowledger'],
  },
  {
    formId: 'oref-043-electronic-funds',
    name: 'Electronic Funds Advisory',
    oref: '043',
    headerRegex: /OREF[-\s]*043|Electronic\s+Funds|Wire\s+Fraud/i,
    titleRegex: /electronic\s+funds|wire\s+fraud\s+advisory/i,
    signers: ['single_party'],
  },
  {
    formId: 'oref-044-electronic-funds',
    name: 'Electronic Funds Advisory',
    oref: '044',
    headerRegex: /OREF[-\s]*044/i,
    titleRegex: /electronic\s+funds|wire\s+fraud\s+advisory/i,
    signers: ['single_party'],
  },
  {
    formId: 'oref-047-compensation-advisory',
    name: 'Real Estate Compensation Advisory',
    oref: '047',
    headerRegex: /OREF[-\s]*047|Real\s+Estate\s+Compensation\s+Advisory/i,
    titleRegex: /real\s+estate\s+compensation\s+advisory/i,
    signers: ['single_party'],
  },
  {
    formId: 'oref-080-smoke-alarms',
    name: 'Smoke Alarms Advisory',
    oref: '080',
    headerRegex: /OREF[-\s]*080|Smoke\s+Alarm|Carbon\s+Monoxide/i,
    titleRegex: /smoke\s+alarm|carbon\s+monoxide/i,
    signers: ['seller'],
  },
  {
    formId: 'oref-092-firpta',
    name: 'FIRPTA Advisory',
    oref: '092',
    headerRegex: /OREF[-\s]*092|FIRPTA\s+Advisory/i,
    titleRegex: /firpta\s+advisory|firpta\s+notice/i,
    signers: ['single_party'],
  },
  {
    formId: 'oref-098-compensation-notice',
    name: 'Notice of Real Estate Compensation',
    oref: '098',
    headerRegex: /OREF[-\s]*098|Notice\s+of\s+Real\s+Estate\s+Compensation|Compensation\s+Demand/i,
    titleRegex: /notice\s+of\s+real\s+estate\s+compensation/i,
    signers: ['seller_broker'],
  },
  {
    formId: 'oref-103-forms-advisory',
    name: 'Real Estate Forms Advisory',
    oref: '103',
    headerRegex: /OREF[-\s]*103|Real\s+Estate\s+Forms\s+Advisory/i,
    titleRegex: /real\s+estate\s+forms\s+advisory/i,
    signers: ['single_party'],
  },
  {
    formId: 'oref-057-termination',
    name: 'Termination of Contract',
    oref: '057',
    headerRegex: /OREF[-\s]*057|Termination\s+of\s+Contract|Mutual\s+Termination/i,
    titleRegex: /termination\s+of\s+contract|mutual\s+termination/i,
    signers: ['buyer', 'seller'],
  },
  {
    formId: 'oref-059-receipt-reports-removal-contingencies',
    name: 'Receipt of Reports / Removal of Contingencies Addendum',
    oref: '059',
    headerRegex: /OREF[-\s]*059|Receipt\s+of\s+Reports|Removal\s+of\s+Contingencies/i,
    titleRegex: /receipt\s+of\s+reports|removal\s+of\s+contingencies/i,
    signers: ['buyer'],
  },
  {
    formId: 'oref-060-contingency-removal',
    name: 'Contingency Removal',
    oref: '060',
    headerRegex: /OREF[-\s]*060|Contingency\s+Removal(?!\s+Addendum)/i,
    titleRegex: /contingency\s+removal(?!\s+addendum)/i,
    signers: ['buyer'],
  },
  {
    formId: 'oref-083-buyers-contingent-right-to-purchase-addendum',
    name: "Buyer's Contingent Right to Purchase Addendum",
    oref: '083',
    headerRegex: /OREF[-\s]*083|Contingent\s+Right\s+to\s+Purchase/i,
    titleRegex: /contingent\s+right\s+to\s+purchase/i,
    signers: ['buyer', 'seller'],
  },
  {
    formId: 'oref-109-notice-buyer-to-seller',
    name: 'Notice from Buyer to Seller',
    oref: '109',
    headerRegex: /OREF[-\s]*109|Notice\s+from\s+Buyer\s+to\s+Seller/i,
    titleRegex: /notice\s+from\s+buyer\s+to\s+seller/i,
    signers: ['buyer'],
  },
  {
    formId: 'oref-110-notice-seller-to-buyer',
    name: 'Notice from Seller to Buyer',
    oref: '110',
    headerRegex: /OREF[-\s]*110|Notice\s+from\s+Seller\s+to\s+Buyer/i,
    titleRegex: /notice\s+from\s+seller\s+to\s+buyer/i,
    signers: ['seller'],
  },
  {
    formId: 'preliminary-title-report',
    name: 'Preliminary Title Report',
    oref: null,
    headerRegex: /PRELIMINARY\s+(TITLE\s+)?REPORT|PRELIMINARY\s+(REPORT|COMMITMENT)/i,
    titleRegex: /preliminary\s+title\s+report|title\s+commitment\s+for/i,
    signers: ['not_applicable'],
  },
  {
    formId: 'inspection-report',
    name: 'Home Inspection Report',
    oref: null,
    headerRegex: /HOME\s+INSPECTION\s+REPORT|PROPERTY\s+INSPECTION\s+REPORT/i,
    titleRegex: /home\s+inspection\s+report|property\s+inspection\s+report/i,
    signers: ['not_applicable'],
  },
  {
    formId: 'em-receipt',
    name: 'Earnest Money Receipt',
    oref: null,
    headerRegex: /^$/i,
    titleRegex: /earnest\s+money\s+(deposit|receipt|received)|receipt\s+(for\s+)?earnest\s+money/i,
    signers: ['escrow_officer'],
  },
]

const BY_NUMBER = new Map<string, FormLibraryEntry>()
for (const entry of FORM_LIBRARY) {
  if (entry.oref) BY_NUMBER.set(entry.oref.toUpperCase(), entry)
}

export function formNumberFromClassification(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const n = (raw as Record<string, unknown>).form_number
  return typeof n === 'string' && n.trim() ? n.trim() : null
}

export function formLibraryEntryByNumber(formNumber: string | null | undefined): FormLibraryEntry | null {
  if (!formNumber?.trim()) return null
  const raw = formNumber.trim().toUpperCase().replace(/^OREF[- ]/, '')
  return BY_NUMBER.get(raw) ?? BY_NUMBER.get(raw.replace(/[A-Z]$/, '')) ?? null
}

export function extractOrefNumbers(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const re = /OREF\s*[-]?\s*(\d{3}[A-Z]?)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const n = m[1].toUpperCase()
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

function firstPage(text: string): string {
  const marker = text.search(/<<<\s*Page\s+2\s*>>>/i)
  if (marker > 0) return text.slice(0, marker)
  return text.slice(0, 8000)
}

/** Page-1 header wins. Then page-1 title. Null if the page was not readable. */
export function identifyFormFromText(text: string | null | undefined): FormLibraryEntry | null {
  if (!text?.trim()) return null
  const page1 = firstPage(text)
  for (const entry of FORM_LIBRARY) {
    if (entry.headerRegex.source === '^$') continue
    if (entry.headerRegex.test(page1)) return entry
  }
  let best: { entry: FormLibraryEntry; len: number } | null = null
  for (const entry of FORM_LIBRARY) {
    const m = page1.match(entry.titleRegex)
    if (!m) continue
    if (!best || m[0].length > best.len) best = { entry, len: m[0].length }
  }
  return best?.entry ?? null
}

export function identifyFormFromName(name: string | null | undefined): FormLibraryEntry | null {
  if (!name?.trim()) return null
  const hay = name.trim()
  const stamped = hay.match(/OREF\s*[-]?\s*(\d{3}[A-Z]?)/i)
  if (stamped) return formLibraryEntryByNumber(stamped[1])
  const underscored = hay.match(/(?:^|[_\s-])(\d{3}[A-Z]?)(?:[_\s-]|$)/i)
  if (underscored) {
    const hit = formLibraryEntryByNumber(underscored[1])
    if (hit) return hit
  }
  return identifyFormFromText(hay)
}

function uniqueRoles(roles: readonly RecipientRole[]): RecipientRole[] {
  const seen = new Set<RecipientRole>()
  const out: RecipientRole[] = []
  for (const r of roles) {
    if (seen.has(r)) continue
    seen.add(r)
    out.push(r)
  }
  return out
}

function sideFromName(name: string | null | undefined): 'Buyer' | 'Seller' | null {
  const s = (name ?? '').toLowerCase()
  const seller = /(?:^|[\s_\-])seller(?:s)?(?:$|[\s_\-])/.test(s)
  const buyer = /(?:^|[\s_\-])buyer(?:s)?(?:$|[\s_\-])/.test(s)
  if (seller && !buyer) return 'Seller'
  if (buyer && !seller) return 'Buyer'
  return null
}

export function librarySignersToRoles(
  signers: readonly LibrarySigner[],
  ctx: { cycleKind?: string | null; documentName?: string | null },
): { roles: RecipientRole[]; signatureForm: boolean } {
  if (signers.includes('not_applicable')) return { roles: [], signatureForm: false }
  const roles: RecipientRole[] = []
  for (const s of signers) {
    if (s === 'buyer') roles.push('Buyer')
    else if (s === 'seller') roles.push('Seller')
    else if (s === 'seller_broker') roles.push('SellerAgent')
    else if (s === 'buyer_broker') roles.push('BuyerAgent')
    else if (s === 'escrow_officer') roles.push('EscrowOfficer')
    else if (s === 'title_officer') roles.push('TitleOfficer')
    else if (s === 'lender') roles.push('LoanOfficer')
    else if (s === 'acknowledger' || s === 'single_party') {
      const fromName = sideFromName(ctx.documentName)
      if (fromName) roles.push(fromName)
      else roles.push(ctx.cycleKind === 'listing' ? 'Seller' : 'Buyer')
    }
  }
  return { roles: uniqueRoles(roles), signatureForm: true }
}

export function entriesFromDocumentText(text: string | null | undefined): FormLibraryEntry[] {
  if (!text?.trim()) return []
  const nums = extractOrefNumbers(text)
  const fromNums = nums.map((n) => formLibraryEntryByNumber(n)).filter((e): e is FormLibraryEntry => !!e)
  if (fromNums.length) {
    const seen = new Set<string>()
    const out: FormLibraryEntry[] = []
    for (const e of fromNums) {
      if (seen.has(e.formId)) continue
      seen.add(e.formId)
      out.push(e)
    }
    return out
  }
  const one = identifyFormFromText(text)
  return one ? [one] : []
}
