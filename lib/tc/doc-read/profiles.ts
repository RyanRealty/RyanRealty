/**
 * Who must sign each form, for the document reader.
 *
 * Source: `.claude/skills/skyslope-form-compliance/references/oref-form-library.md`
 * (the canonical library: "NEVER guess a form's signer profile"). The test
 * beside this file parses that markdown and fails when a row here drifts from
 * it. Two places in the old code disagreed with it and are NOT used by the
 * reader: FORM_LIBRARY put both brokers on OREF 001 (the 2025 form has no
 * agent signature lines) and put the seller on 059 / 060 (buyer-driven).
 *
 * OREF has renumbered forms between releases, so a number alone is not an
 * identity: a profile is found by the printed title first and the number
 * second, and a title that contradicts the number is flagged, not trusted.
 */

/** A party whose signature a form can call for. */
export type Party = 'buyer' | 'seller' | 'buyer_agent' | 'seller_agent' | 'escrow' | 'title' | 'lender' | 'vendor'

export type Obligation =
  /** Every named person in every listed party signs (2 buyers = 2 buyer signatures). Agents sign once. */
  | { kind: 'all'; parties: Party[]; optional?: Party[] }
  /** One side's block is the whole execution (advisories, FIRPTA, one-way notices, acknowledgments). */
  | { kind: 'one_side'; parties: Party[] }
  /** Reports and references: never executed by the parties. */
  | { kind: 'reference' }

export type FormProfile = {
  key: string
  name: string
  /** OREF numbers this profile covers, as printed in the footer stamp. */
  oref: string[]
  /** Matches the printed title. */
  title: RegExp
  obligation: Obligation
  /**
   * How the form records its outcome. `seller_response` = OREF 001 section 51
   * (accept / counteroffer / reject). `counter` = a counteroffer accepted by the
   * party it was sent to. Both change what "done" means for the instance.
   */
  outcome?: 'seller_response' | 'counter'
  /** Several of these on one deal are different documents, told apart by their number. */
  numbered?: boolean
  /** Checklist wording that identifies this form's row (see required-documents DOC_RULES). */
  checklistTerms: string[]
}

const BOTH: Party[] = ['buyer', 'seller']

export const FORM_PROFILES: readonly FormProfile[] = [
  { key: 'oref-001-rsa', name: 'Residential Real Estate Sale Agreement', oref: ['001'], title: /residential\s+real\s+estate\s+sale\s+agreement/i, obligation: { kind: 'all', parties: BOTH }, outcome: 'seller_response', checklistTerms: ['sale agreement', 'purchase agreement', 'purchase and sale'] },
  { key: 'oref-002-addendum', name: 'Addendum to Sale Agreement', oref: ['002'], title: /addendum\s+to\s+(?:real\s+estate\s+)?sale\s+agreement|sale\s+agreement\s+addendum/i, obligation: { kind: 'all', parties: BOTH }, numbered: true, checklistTerms: ['addendum', 'addenda'] },
  // OREF 2026 prints the Seller's Counteroffer as 003 and the Buyer's as 004
  // (read off the 01/2025 sale agreement and a 01/2026 counteroffer, 2026-09-23).
  { key: 'oref-003-counter', name: 'Counteroffer', oref: ['003', '004'], title: /counter\s*-?\s*offer/i, obligation: { kind: 'all', parties: BOTH }, outcome: 'counter', numbered: true, checklistTerms: ['counter'] },
  { key: 'oref-015-listing-agreement', name: 'Listing Agreement', oref: ['015'], title: /exclusive\s+right\s+to\s+sell|listing\s+agreement(?!\s+addendum)/i, obligation: { kind: 'all', parties: ['seller', 'seller_agent'] }, checklistTerms: ['listing agreement', 'listing contract'] },
  { key: 'oref-020-spd', name: "Seller's Property Disclosure Statement", oref: ['020', '022'], title: /seller'?s?\s+property\s+disclosure/i, obligation: { kind: 'all', parties: ['seller', 'buyer'] }, checklistTerms: ['property disclosure', 'spds', 'disclosure statement'] },
  { key: 'oref-021-lbp', name: 'Lead-Based Paint Disclosure Addendum', oref: ['021'], title: /lead[-\s]*based\s+paint/i, obligation: { kind: 'all', parties: ['buyer', 'seller', 'seller_agent', 'buyer_agent'] }, checklistTerms: ['lead', 'lbp'] },
  { key: 'oref-022a-buyer-repair', name: 'Buyer Repair Addendum', oref: ['022A'], title: /buyer'?s?\s+repair/i, obligation: { kind: 'all', parties: BOTH }, numbered: true, checklistTerms: ['repair'] },
  { key: 'oref-022b-seller-repair', name: 'Seller Repair Addendum', oref: ['022B'], title: /seller'?s?\s+repair/i, obligation: { kind: 'all', parties: BOTH }, numbered: true, checklistTerms: ['repair'] },
  { key: 'oref-040-dla-sellers', name: 'Disclosed Limited Agency Agreement for Sellers', oref: ['040'], title: /disclosed\s+limited\s+agency.*sellers?/i, obligation: { kind: 'all', parties: ['seller', 'seller_agent'] }, checklistTerms: ['limited agency'] },
  { key: 'oref-041-dla-buyers', name: 'Disclosed Limited Agency Agreement for Buyers', oref: ['041'], title: /disclosed\s+limited\s+agency.*buyers?/i, obligation: { kind: 'all', parties: ['buyer', 'buyer_agent'] }, checklistTerms: ['limited agency'] },
  { key: 'oref-050-buyer-rep', name: 'Buyer Representation Agreement', oref: ['050'], title: /buyer\s+representation\s+agreement|exclusive\s+right\s+to\s+represent|buyer\s+service\s+agreement/i, obligation: { kind: 'all', parties: ['buyer', 'buyer_agent'] }, checklistTerms: ['buyer representation', 'buyer agency', 'buyer service'] },
  { key: 'oref-042-pamphlet', name: 'Initial Agency Disclosure Pamphlet', oref: ['042'], title: /initial\s+agency\s+disclosure|agency\s+disclosure\s+pamphlet/i, obligation: { kind: 'one_side', parties: BOTH }, checklistTerms: ['agency disclosure', 'pamphlet'] },
  { key: 'oref-043-efa', name: 'Advisory Regarding Electronic Funds', oref: ['043', '044'], title: /electronic\s+funds|wire\s+fraud/i, obligation: { kind: 'one_side', parties: BOTH }, checklistTerms: ['electronic funds', 'wire fraud'] },
  { key: 'oref-047-compensation-advisory', name: 'Real Estate Compensation Advisory', oref: ['047', '048'], title: /compensation\s+advisory/i, obligation: { kind: 'one_side', parties: BOTH }, checklistTerms: ['compensation advisory'] },
  { key: 'oref-080-smoke-alarms', name: 'Smoke and Carbon Monoxide Alarm Advisory', oref: ['080'], title: /smoke|carbon\s+monoxide/i, obligation: { kind: 'all', parties: ['seller'] }, checklistTerms: ['smoke', 'carbon monoxide'] },
  { key: 'oref-092-firpta', name: 'FIRPTA Advisory', oref: ['092'], title: /firpta|foreign\s+investment/i, obligation: { kind: 'one_side', parties: BOTH }, checklistTerms: ['firpta'] },
  { key: 'oref-098-compensation-notice', name: 'Notice of Real Estate Compensation', oref: ['098'], title: /notice\s+of\s+real\s+estate\s+compensation/i, obligation: { kind: 'all', parties: ['seller_agent'] }, checklistTerms: ['compensation', 'commission'] },
  { key: 'oref-103-forms-advisory', name: 'Real Estate Forms Advisory', oref: ['103', '108'], title: /forms\s+advisory/i, obligation: { kind: 'one_side', parties: BOTH }, checklistTerms: ['forms advisory'] },
  { key: 'oref-057-termination', name: 'Termination of Contract', oref: ['057'], title: /termination/i, obligation: { kind: 'all', parties: BOTH }, checklistTerms: ['termination'] },
  { key: 'oref-059-contingency-removal-addendum', name: 'Receipt of Reports / Removal of Contingencies Addendum', oref: ['059'], title: /receipt\s+of\s+reports|removal\s+of\s+contingenc/i, obligation: { kind: 'all', parties: ['buyer'], optional: ['seller'] }, numbered: true, checklistTerms: ['contingency removal', 'removal of contingenc'] },
  { key: 'oref-060-contingency-removal', name: 'Contingency Removal', oref: ['060'], title: /contingency\s+removal(?!\s+addendum)/i, obligation: { kind: 'all', parties: ['buyer'], optional: ['seller'] }, numbered: true, checklistTerms: ['contingency removal'] },
  { key: 'oref-083-contingent-right', name: "Buyer's Contingent Right to Purchase Addendum", oref: ['083'], title: /contingent\s+right\s+to\s+purchase/i, obligation: { kind: 'all', parties: BOTH }, checklistTerms: ['contingent right'] },
  { key: 'oref-109-notice-buyer', name: 'Notice from Buyer to Seller', oref: ['109'], title: /notice\s+from\s+buyer/i, obligation: { kind: 'all', parties: ['buyer'] }, numbered: true, checklistTerms: ['notice'] },
  { key: 'oref-110-notice-seller', name: 'Notice from Seller to Buyer', oref: ['110'], title: /notice\s+from\s+seller/i, obligation: { kind: 'all', parties: ['seller'] }, numbered: true, checklistTerms: ['notice'] },
]

/** Non-OREF documents, from the reference's "Non-OREF document categories" table. */
export const OTHER_PROFILES: readonly FormProfile[] = [
  // A deal can take several deposits (initial and additional earnest money), so receipts are numbered-like: two receipts are never one another's copy without a telling detail.
  { key: 'earnest-money-receipt', name: 'Earnest Money Receipt', oref: [], title: /earnest\s+money|receipt\s+(?:for|of)\s+(?:funds|deposit)/i, obligation: { kind: 'all', parties: ['escrow'] }, numbered: true, checklistTerms: ['earnest money', 'em receipt'] },
  { key: 'funds-to-close-receipt', name: 'Funds to Close Receipt', oref: [], title: /funds\s+to\s+close/i, obligation: { kind: 'all', parties: ['escrow'] }, numbered: true, checklistTerms: ['funds to close'] },
  // OREF 000 / 000A-C guides: read and kept, never signed (lib/tc/library-signers-from-name.ts: not_applicable).
  { key: 'oref-000-guide', name: 'Things to Know Before Signing', oref: ['000', '000A', '000B', '000C'], title: /things\s+to\s+know|before\s+signing/i, obligation: { kind: 'reference' }, checklistTerms: ['things to know'] },
  { key: 'preliminary-title-report', name: 'Preliminary Title Report', oref: [], title: /preliminary\s+(?:title\s+)?report|title\s+commitment/i, obligation: { kind: 'reference' }, checklistTerms: ['title report', 'prelim'] },
  { key: 'settlement-statement', name: 'Settlement Statement', oref: [], title: /settlement\s+statement|closing\s+statement|alta\s+settlement/i, obligation: { kind: 'reference' }, checklistTerms: ['settlement statement', 'closing statement', 'alta'] },
  { key: 'closing-disclosure', name: 'Closing Disclosure', oref: [], title: /closing\s+disclosure/i, obligation: { kind: 'reference' }, checklistTerms: ['closing disclosure'] },
  { key: 'pre-approval-letter', name: 'Pre-Approval Letter', oref: [], title: /pre-?approv|pre-?qualif/i, obligation: { kind: 'reference' }, checklistTerms: ['pre-approval', 'preapproval', 'pre-qual'] },
  { key: 'proof-of-funds', name: 'Proof of Funds', oref: [], title: /proof\s+of\s+funds|bank\s+statement/i, obligation: { kind: 'reference' }, checklistTerms: ['proof of funds'] },
  { key: 'inspection-report', name: 'Inspection Report', oref: [], title: /inspection\s+report|home\s+inspection/i, obligation: { kind: 'reference' }, checklistTerms: ['inspection'] },
  // "HOA Documents: not_applicable" in the library covers the association's own records.
  { key: 'hoa-documents', name: 'HOA Documents', oref: [], title: /homeowners?'?\s+association|\bhoa\b|cc&rs?|covenants,?\s+conditions|declaration\s+of\s+(?:covenants|condominium)|bylaws|articles\s+of\s+incorporation|rules\s+and\s+regulations|meeting\s+minutes|board\s+of\s+directors|reserve\s+study/i, obligation: { kind: 'reference' }, checklistTerms: ['hoa', 'association'] },
]

/**
 * Forms from other publishers (a buyer's agent from another brokerage often
 * sends their own "Purchase and Sale Agreement", "Counteroffer" or
 * "Addendum"). The title says what the instrument is, so it gets the mutual
 * profile of that instrument, marked generic so nothing downstream mistakes it
 * for a library match.
 */
const GENERIC: readonly FormProfile[] = [
  { key: 'generic-counter', name: 'Counteroffer', oref: [], title: /counter\s*-?\s*offer/i, obligation: { kind: 'all', parties: BOTH }, outcome: 'counter', numbered: true, checklistTerms: ['counter'] },
  { key: 'generic-addendum', name: 'Addendum', oref: [], title: /addendum|amendment/i, obligation: { kind: 'all', parties: BOTH }, numbered: true, checklistTerms: ['addendum', 'addenda'] },
  { key: 'generic-purchase-agreement', name: 'Purchase and Sale Agreement', oref: [], title: /purchase\s+and\s+sale\s+agreement|sale\s+agreement|purchase\s+agreement/i, obligation: { kind: 'all', parties: BOTH }, checklistTerms: ['sale agreement', 'purchase agreement', 'purchase and sale'] },
]

export type ProfileMatch = {
  profile: FormProfile
  /** library = OREF number and title agree; title = matched on title alone; generic = another publisher's instrument. */
  basis: 'library' | 'title' | 'number' | 'generic'
  /** The printed number points at a different form than the printed title. */
  numberConflict: boolean
}

export function normalizeOref(raw: string | null | undefined): string | null {
  const m = String(raw ?? '').toUpperCase().match(/(\d{3}[A-Z]?)/)
  return m ? m[1] : null
}

/**
 * Title first (titles are unambiguous across releases), number second.
 * The more specific title wins: "Seller Repair Addendum" over "Addendum".
 */
export function profileFor(input: { title: string | null; formNumber: string | null }): ProfileMatch | null {
  const title = (input.title ?? '').trim()
  const num = normalizeOref(input.formNumber)
  const byNumber = num ? [...FORM_PROFILES, ...OTHER_PROFILES].find((p) => p.oref.includes(num)) ?? null : null

  const titleHits = title ? [...FORM_PROFILES, ...OTHER_PROFILES].filter((p) => p.title.test(title)) : []
  // Prefer the hit whose number matches, then the longest title match.
  const ranked = titleHits
    .map((p) => ({ p, len: title.match(p.title)?.[0].length ?? 0, numbered: !!num && p.oref.includes(num) }))
    .sort((a, b) => Number(b.numbered) - Number(a.numbered) || b.len - a.len)
  const byTitle = ranked[0]?.p ?? null

  if (byTitle && byNumber && byTitle.key === byNumber.key) return { profile: byTitle, basis: 'library', numberConflict: false }
  // A printed OREF number the title's profile does not carry (083A under an
  // 083 title match) is a different form until the library says otherwise.
  const orefShaped = /^\s*(?:OREF\s*[-#]?\s*)?\d{3}[A-Z]?\s*$/i.test(input.formNumber ?? '')
  const foreignNumber = !!num && orefShaped && !!byTitle?.oref.length && !byTitle.oref.includes(num)
  if (byTitle) return { profile: byTitle, basis: 'title', numberConflict: (!!byNumber && byNumber.key !== byTitle.key) || foreignNumber }
  if (byNumber) return { profile: byNumber, basis: 'number', numberConflict: false }
  const generic = title ? GENERIC.find((p) => p.title.test(title)) : null
  if (generic) return { profile: generic, basis: 'generic', numberConflict: false }
  return null
}
