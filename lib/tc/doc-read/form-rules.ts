/**
 * Who must sign a form the curated library does not list, worked out the same
 * way for every release (Matt 2026-09-24: forms change every year; the system
 * keeps up by itself).
 *
 * Three sources, strongest first:
 *   1. Law. A few instruments have their signers fixed by statute or rule, and
 *      a new release cannot change that (LAW_RULES, each with its citation).
 *   2. What kind of instrument it is. An agreement binds the parties who sign
 *      it; a notice is signed by the party giving it; an advisory is
 *      acknowledged by the client; a receipt is signed by whoever received the
 *      money; a report or statement is kept, not executed (categoryOf).
 *   3. The signature blocks the form itself prints, tallied across every copy
 *      the Vault holds (registry.ts), so one copy the reader saw only in part
 *      does not decide the form.
 *
 * Pure: no I/O. The registry feeds it the tally and stores what it returns.
 */
import type { Obligation, Party } from './profiles'

export type FormCategory =
  | 'sale_agreement'
  | 'counteroffer'
  | 'agreement'
  | 'notice'
  | 'advisory'
  | 'agency_agreement'
  | 'compensation_notice'
  | 'escrow_receipt'
  | 'escrow_instruction'
  | 'reference'
  | 'unknown'

export type LawRule = {
  key: string
  title: RegExp
  obligation: Obligation
  /** The citation a reviewer can pull. */
  cite: string
  /** One sentence: what the law says about who signs. */
  summary: string
}

const BOTH: Party[] = ['buyer', 'seller']
const AGENTS: Party[] = ['buyer_agent', 'seller_agent']

/**
 * Researched 2026-09-24 from the primary sources (scratchpad
 * oregon-signature-law.md; docs/TC_DOCUMENT_READER.md "Who signs, by law").
 */
export const LAW_RULES: readonly LawRule[] = [
  {
    key: 'initial-agency-pamphlet',
    title: /initial\s+agency\s+disclosure|agency\s+disclosure\s+pamphlet/i,
    obligation: { kind: 'reference' },
    cite: 'OAR 863-015-0215',
    summary: 'Given to the consumer at first contact; the rule requires delivery, not a signature.',
  },
  {
    key: 'final-agency-acknowledgment',
    title: /final\s+agency\s+acknowledg/i,
    obligation: { kind: 'all', parties: BOTH },
    cite: 'ORS 696.845; OAR 863-015-0200(12)',
    summary: 'The buyer signs with the offer and the seller on accepting or rejecting it.',
  },
  {
    key: 'seller-property-disclosure',
    title: /seller'?s?\s+property\s+disclosure\s+statement(?!\s+addendum)/i,
    obligation: { kind: 'all', parties: ['seller', 'buyer'] },
    cite: 'ORS 105.464; ORS 105.475',
    summary: "The seller signs the disclosure; the statutory form carries the buyer's acknowledgment of receipt, which starts the buyer's revocation period.",
  },
  {
    key: 'lead-based-paint-disclosure',
    title: /lead[-\s]*based\s+(?:paint|hazard)s?\s+(?:disclosure|addendum)|disclosure\s+of\s+information\s+on\s+lead/i,
    obligation: { kind: 'all', parties: [...BOTH, ...AGENTS] },
    cite: '40 CFR 745.113; 24 CFR 35.92',
    summary: 'Sellers, agents and purchasers each sign and date the disclosure; the seller and agents keep it three years.',
  },
  {
    key: 'fha-va-amendatory-clause',
    title: /amendatory\s+clause|real\s+estate\s+certification|escape\s+clause/i,
    obligation: { kind: 'all', parties: BOTH, optional: AGENTS },
    cite: 'HUD Handbook 4000.1; 38 CFR 36.4303(k)',
    summary: 'Borrowers and sellers sign; the agents sign the real estate certification when the purchase agreement does not already carry their signatures.',
  },
  {
    key: 'firpta-qualified-substitute',
    title: /qualified\s+substitute|statement\s+of\s+receipt\s+of\s+seller'?s?\s+certific/i,
    obligation: { kind: 'all', parties: ['escrow'] },
    cite: '26 U.S.C. 1445(b)(9)',
    summary: "The qualified substitute (the escrow or title company) signs the statement under penalty of perjury; the seller's affidavit stays with it.",
  },
]

export function lawRuleFor(title: string | null | undefined): LawRule | null {
  const t = title ?? ''
  return LAW_RULES.find((r) => r.title.test(t)) ?? null
}

/**
 * The kind of instrument, read from its title. Order matters: a counteroffer
 * to a sale agreement is a counteroffer, an addendum to one is an agreement,
 * a notice of compensation is the broker's demand, not a party's notice.
 */
export function categoryOf(title: string | null | undefined): FormCategory {
  const t = (title ?? '').toLowerCase()
  if (!t.trim()) return 'unknown'
  if (/notice\s+of\s+real\s+estate\s+compensation|compensation\s+(?:demand|agreement\s+to\s+escrow)|commission\s+(?:demand|instructions)/.test(t)) return 'compensation_notice'
  if (/agent'?s?\s+instructions\s+to\s+escrow|release\s+of\s+(?:earnest\s+money|funds)|escrow\s+instructions/.test(t)) return 'escrow_instruction'
  if (/counter\s*-?\s*offer/.test(t)) return 'counteroffer'
  if (/earnest\s+money|incoming\s+wire|deposit\s+confirmation|receipt\s+(?:for|of)\s+(?:funds|deposit|wire)|receipt\s+for\s+wire|funds\s+to\s+close/.test(t)) return 'escrow_receipt'
  // Kept, never executed by the parties. Checked before "agreement" so a
  // settlement statement or a report about an agreement stays a record.
  if (
    /\breport\b|\binvoice\b|\bestimate\b|\bproposal\b|\bnewsletter\b|\bnews\b|\bpolicy\b|\bendorsement\b|\bdeed\b|certificate\s+of\s+completion|audit\s+trail|electronic\s+record\s+and\s+signature|privacy\s+(?:notice|statement|policy)|consumer\s+protection\s+notice|settlement\s+statement|(?:seller|buyer)'?s?\s+statement|closing\s+disclosure|balance\s+sheet|\bbudget\b|profit\s*(?:and|&)?\s*loss|a\/?r\s+aging|transaction\s+detail|financial\s+statements?|reserve\s+study|meeting\s+minutes|bylaws|declaration|cc\s*&?\s*rs?|covenants|\bplat\b|\bmap\b|market\s+analysis|\bcma\b|price\s+recommendation|timeline|\bstatement\s+\d|things\s+to\s+know|escrow\s+process|life\s+of\s+an\s+escrow|opening\s+escrow|red\s+flags|pamphlet|protect\s+your\s+family|brochure|\bletter\b|screenshot|bank\s+statement|investment\s+report|tax\s+return|payment\s+voucher|\breceipt\b|work\s+(?:order|authorization)|pre-?approv|pre-?qualif|approval\s+(?:letter|notification)|homebuyer\s+certificate|offer\s+summary|listing\s+information\s+sheet|business\s+name\s+search|summary\s+history|\bphotos?\b/.test(
      t,
    )
  )
    return 'reference'
  if (/residential|commercial|condominium|farm|land|vacant/.test(t) && /(?:sale|purchase)(?:\s+and\s+sale)?\s+agreement/.test(t) && !/addendum|amendment/.test(t)) return 'sale_agreement'
  if (/^(?:oregon\s+)?(?:real\s+estate\s+)?(?:purchase\s+and\s+sale|sale|purchase)\s+agreement\b/.test(t)) return 'sale_agreement'
  if (/advisory/.test(t)) return 'advisory'
  if (/\bnotice\b/.test(t)) return 'notice'
  if (/limited\s+agency|buyer\s+representation|buyer\s+service\s+agreement|exclusive\s+right\s+to\s+(?:sell|represent)|listing\s+(?:agreement|contract)(?!\s+addendum)|addendum\s+for\s+agent\s+documents/.test(t)) return 'agency_agreement'
  if (/addendum|amendment|agreement|disclosure|termination|bill\s+of\s+sale|acknowledg/.test(t)) return 'agreement'
  return 'unknown'
}

/** Which party gives a notice: the one it is from, or the one not addressed. */
export function noticeSender(title: string | null | undefined): Party | null {
  const t = (title ?? '').toLowerCase()
  if (/from\s+buyer|buyer'?s\b(?!\s+agent)|notice\s+to\s+seller/.test(t)) return 'buyer'
  if (/from\s+seller|seller'?s\b(?!\s+agent)|notice\s+to\s+buyer/.test(t)) return 'seller'
  return null
}

export type DerivedProfile = {
  category: FormCategory
  obligation: Obligation
  outcome?: 'seller_response' | 'counter'
  numbered: boolean
  offer: boolean
  /** law = a statute or rule names the signers; category = the kind of instrument does; blocks = the printed blocks across copies. */
  basis: 'law' | 'category' | 'blocks'
  /** Human-readable: which rule decided, with the citation when it is law. */
  rule: string
  /** rule: decided by law or the kind of instrument; consensus: blocks agree across 3+ copies; new: fewer copies, not yet acted on alone. */
  confidence: 'rule' | 'consensus' | 'new'
}

const PRINCIPALS: Party[] = ['buyer', 'seller']
const INSTITUTIONS: Party[] = ['escrow', 'title', 'lender', 'vendor']

/** Parties whose blocks the form prints on at least half the copies read. */
function printedParties(tally: Partial<Record<Party, number>>, copies: number): Party[] {
  const need = Math.max(1, Math.ceil(copies / 2))
  return (Object.keys(tally) as Party[]).filter((p) => (tally[p] ?? 0) >= need)
}

/**
 * The profile for a form outside the curated library. `tally` counts, per
 * party, the copies on which the form printed at least one line for that
 * party; `copies` is how many copies were read.
 */
export function deriveProfile(input: { title: string | null; tally: Partial<Record<Party, number>>; copies: number }): DerivedProfile {
  const { title, tally, copies } = input
  const category = categoryOf(title)
  const law = lawRuleFor(title)
  const numberedKinds: FormCategory[] = ['counteroffer', 'agreement', 'notice', 'escrow_receipt', 'escrow_instruction']
  const numbered = numberedKinds.includes(category)
  const offer = category === 'sale_agreement' || category === 'counteroffer'
  const outcome = category === 'sale_agreement' ? 'seller_response' : category === 'counteroffer' ? 'counter' : undefined
  const base = { category, numbered, offer, outcome } as const

  if (law) return { ...base, obligation: law.obligation, basis: 'law', rule: `${law.cite}: ${law.summary}`, confidence: 'rule' }

  const printed = printedParties(tally, copies)
  const principals = PRINCIPALS.filter((p) => printed.includes(p))
  const agents = AGENTS.filter((p) => printed.includes(p))
  const institutions = INSTITUTIONS.filter((p) => printed.includes(p))
  const consensus = copies >= 3 ? 'consensus' : 'new'

  switch (category) {
    case 'reference':
      return { ...base, obligation: { kind: 'reference' }, basis: 'category', rule: 'A report, statement, record or correspondence: kept on the file, not executed by the parties.', confidence: 'rule' }
    case 'escrow_receipt':
      return { ...base, obligation: { kind: 'all', parties: ['escrow'] }, basis: 'category', rule: 'A receipt is signed by whoever took the money: the escrow or title company.', confidence: 'rule' }
    case 'compensation_notice':
      return {
        ...base,
        obligation: { kind: 'one_side', parties: AGENTS },
        basis: 'category',
        rule: "A compensation notice is the brokerage's instruction to escrow: signed by the principal broker of the firm it pays.",
        confidence: 'rule',
      }
    case 'advisory':
      return {
        ...base,
        obligation: { kind: 'one_side', parties: principals.length ? principals : BOTH },
        basis: 'category',
        rule: 'An advisory is acknowledged by the client it was given to (one side).',
        confidence: 'rule',
      }
    case 'notice': {
      const sender = noticeSender(title) ?? principals[0] ?? null
      if (sender) {
        const other = PRINCIPALS.filter((p) => p !== sender)
        return {
          ...base,
          obligation: { kind: 'all', parties: [sender], optional: other },
          basis: 'category',
          rule: `A notice is signed by the party giving it (the ${sender}); the other side's acknowledgment of receipt is not what makes it effective.`,
          confidence: 'rule',
        }
      }
      break
    }
    case 'escrow_instruction': {
      const parties = [...principals, ...agents].length ? [...principals, ...agents] : BOTH
      return { ...base, obligation: { kind: 'all', parties }, basis: 'blocks', rule: 'An instruction to escrow is signed by everyone it binds, as printed on the form.', confidence: consensus }
    }
    case 'agency_agreement': {
      // The broker is a party to an agency or listing agreement.
      const parties = [...principals, ...agents]
      // A "Client" line does not say which side the client is: without a
      // buyer or seller line the form is decided, but not acted on alone.
      if (parties.length)
        return {
          ...base,
          obligation: { kind: 'all', parties },
          basis: 'blocks',
          rule: 'An agency or listing agreement binds the client and the brokerage: both sign.',
          confidence: principals.length ? consensus : 'new',
        }
      break
    }
    default:
      break
  }

  // Agreements, counteroffers, sale agreements and anything else with blocks:
  // the parties the form prints lines for sign. Agent lines on a party
  // instrument are a delivery or identification record, not the parties'
  // assent, so they are optional.
  if (principals.length) {
    return {
      ...base,
      obligation: { kind: 'all', parties: principals, ...(agents.length ? { optional: agents } : {}) },
      basis: 'blocks',
      rule: `The form prints signature lines for the ${principals.join(' and ')}${copies > 1 ? ` on ${copies} copies` : ''}; each named ${principals.join(' and ')} signs.`,
      confidence: consensus,
    }
  }
  if (institutions.length) return { ...base, obligation: { kind: 'all', parties: institutions }, basis: 'blocks', rule: `Signed by the ${institutions.join(' and ')}, as printed.`, confidence: consensus }
  if (agents.length) return { ...base, obligation: { kind: 'all', parties: agents }, basis: 'blocks', rule: `Signed by the ${agents.map((a) => a.replace('_', ' ')).join(' and ')}, as printed.`, confidence: consensus }
  return { ...base, obligation: { kind: 'reference' }, basis: 'blocks', rule: 'No copy prints a signature line: an informational document.', confidence: copies >= 3 ? 'consensus' : 'new' }
}

/**
 * One registry entry per form, however a release numbers it: the title with
 * form numbers, instance numbers and punctuation taken out.
 */
export function formIdentity(title: string | null | undefined): string | null {
  const t = (title ?? '')
    .toLowerCase()
    .replace(/^\s*(?:form\s*)?\d{1,2}\.\d{1,2}\s+/, '')
    .replace(/^\s*oref\s*\d{3}[a-z]?\s*[-–:]?\s*/, '')
    .replace(/\((?:continued|cont\.?)\)/g, ' ')
    .replace(/\b(?:no\.?|number|#)\s*\d+\b/g, ' ')
    .replace(/#\s*\d+/g, ' ')
    .replace(/[’'`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  return t.length >= 4 ? t.slice(0, 120) : null
}
