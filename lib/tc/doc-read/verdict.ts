/**
 * From a transcription to a verdict: which form, which instance, who must
 * sign, who did, and whether that is fully executed. Pure.
 *
 * The rules (signer-validation.md, carried into code):
 *  - Every named buyer and every named seller signs their own line. Two buyers
 *    named = two buyer signatures; one signature on a two-buyer form is partial.
 *  - A form with several signature sections (OREF 001: Final Agency
 *    Acknowledgment, Offer to Purchase, Seller's Response) needs every section
 *    complete for each obligated party.
 *  - One-side forms (advisories, FIRPTA, notices) are complete when that side
 *    signed. Reports are never executed by the parties.
 *  - A sale agreement is accepted only by the Seller's Response box; a seller
 *    signing the Final Agency Acknowledgment is not acceptance. A counteroffer
 *    is accepted when the party it went to signed it.
 *  - Anything the library does not list gets its signers from the form
 *    registry (law, the kind of instrument, the blocks printed across every
 *    copy). Without a registry row it falls back to the lines on this copy and
 *    is marked so; neither a fallback nor a registry form seen on fewer than
 *    three copies drives an archive alone.
 */
import { profileFor, type FormProfile, type Party } from './profiles'
import type { FormRegistry } from './registry'
import type { FormReading, SignatureLine, SignMethod } from './vision-reading'

export type ExecutionVerdict =
  | 'fully_executed'
  | 'countered'
  | 'rejected'
  | 'partially_executed'
  | 'unsigned'
  | 'blank'
  | 'reference'
  | 'needs_review'

export type SignerStatus = {
  party: Party | 'client'
  /** The named person, when the form names them. */
  name: string | null
  signed: boolean
  signedAs: string | null
  date: string | null
  method: SignMethod | null
  /** Sections this person still has to sign. */
  missingSections: string[]
}

export type FormVerdict = {
  segment: number
  profileKey: string | null
  formName: string
  basis: 'library' | 'title' | 'number' | 'generic' | 'lines' | 'registry'
  numberConflict: boolean
  /** Registry forms: which rule decided who signs (with its citation when it is law). */
  rule: string | null
  /** library = curated; rule = law or the kind of instrument; consensus = blocks agree on 3+ copies; new = not acted on alone. */
  confidence: 'library' | 'rule' | 'consensus' | 'new' | null
  /** A sale agreement or counteroffer: an unaccepted copy is negotiation history. */
  offer: boolean
  instanceNumber: string | null
  counterBy: 'buyer' | 'seller' | null
  saleAgreementNumber: string | null
  verdict: ExecutionVerdict
  outcome: 'accepted' | 'countered' | 'rejected' | null
  signers: SignerStatus[]
  /** Plain sentences a broker reads: why this verdict. */
  reasons: string[]
  /** Lineage identity for this form instance (see lineage.ts). */
  instanceKey: string
  /** The key has nothing that tells two offers or two addenda apart. */
  weakKey: boolean
  /** A deal can hold several of this form (addenda, counteroffers, notices). */
  numbered: boolean
  checklistTerms: string[]
}

const PARTY_LABEL: Record<Party, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  buyer_agent: "Buyer's agent",
  seller_agent: "Seller's agent",
  escrow: 'Escrow',
  title: 'Title',
  lender: 'Lender',
  vendor: 'Vendor',
}

export function partyLabel(p: Party | 'client'): string {
  return p === 'client' ? 'Client' : PARTY_LABEL[p]
}

/** Lower-case letters only, for comparing names written different ways. */
function nameTokens(s: string | null | undefined): string[] {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length >= 2 && !['trustee', 'trust', 'of', 'the', 'and', 'llc', 'inc', 'revocable', 'living', 'family', 'estate'].includes(t))
}

/**
 * How strongly two written names point at one person: shared name tokens,
 * with a surname-length token (4+ letters) needed for any credit at all.
 * "Douglas Halpin" vs "Masayo Halpin" = 1; vs "Douglas Halpin" = 2.
 */
export function nameScore(a: string | null | undefined, b: string | null | undefined): number {
  const ta = [...new Set(nameTokens(a))]
  const tb = new Set(nameTokens(b))
  if (!ta.length || !tb.size) return 0
  const shared = ta.filter((t) => tb.has(t))
  if (!shared.some((t) => t.length >= 4) && shared.length < 2) return 0
  return shared.length
}

/** Same person: share a surname-length token (4+ letters) or two tokens. */
export function sameSigner(a: string | null | undefined, b: string | null | undefined): boolean {
  return nameScore(a, b) > 0
}

function lastName(s: string): string {
  const t = nameTokens(s)
  return t[t.length - 1] ?? ''
}

function lineParty(l: SignatureLine): Party | null {
  switch (l.party) {
    case 'buyer':
    case 'seller':
    case 'buyer_agent':
    case 'seller_agent':
    case 'escrow':
    case 'title':
    case 'lender':
    case 'vendor':
      return l.party
    default:
      return null
  }
}

function sectionKey(l: SignatureLine): string {
  return (l.section || 'signatures').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() || 'signatures'
}

/**
 * On a sale agreement the Final Agency Acknowledgment is signed at offer time
 * by both sides and says so itself: "Seller's signature ... will not
 * constitute acceptance". It still has to be signed; it just is not the
 * acceptance.
 */
function isAcknowledgmentSection(section: string): boolean {
  return /agency\s+acknowledg|acknowledges?\s+receipt/i.test(section)
}

function obligatedParties(profile: FormProfile | null, lines: readonly SignatureLine[]): { all: Party[]; oneSide: Party[] | null; optional: Party[] } {
  if (profile) {
    const o = profile.obligation
    if (o.kind === 'reference') return { all: [], oneSide: null, optional: [] }
    if (o.kind === 'one_side') return { all: [], oneSide: o.parties, optional: [] }
    return { all: o.parties, oneSide: null, optional: o.optional ?? [] }
  }
  // Not in the library: whoever the form prints a line for.
  const present = new Set<Party>()
  for (const l of lines) {
    const p = lineParty(l)
    if (p) present.add(p)
  }
  return { all: [...present], oneSide: null, optional: [] }
}

/**
 * The people a form names for a party. Only the form itself: the deal's
 * people records are not reliable enough to name a signer (a 2026-09-23 dry
 * run had a sale's sellers filed as its buyers).
 */
function namesFor(party: Party, form: FormReading): string[] {
  if (party === 'buyer') return form.buyersNamed
  if (party === 'seller') return form.sellersNamed
  return []
}

const INSTITUTIONAL: ReadonlySet<Party> = new Set(['escrow', 'title', 'lender', 'vendor'])

/**
 * The lines that decide execution. A conditional line nobody signed ("sellers
 * claiming exclusion", "if applicable") is not missing. A line the form
 * labels "Client" belongs to whichever single party the form obligates (an
 * advisory handed to our client), and a title company's "By:" line is the
 * escrow signature on a receipt.
 */
/**
 * A section that acknowledges another party's claim ("Signature(s) of
 * Buyer(s) to acknowledge Seller's claim" under the SPDS exclusion on OREF
 * 020 page 1) is signed only when the claim was made: when no conditional
 * line of the claiming party is signed, its lines are conditional too.
 */
const ACKNOWLEDGES_CLAIM = /acknowledge\s+(?:the\s+)?(?:seller|buyer)'?s?\s+claim/i

function claimAcknowledgmentsConditional(lines: readonly SignatureLine[]): SignatureLine[] {
  const claimMade = lines.some((l) => l.conditional && l.signed)
  if (claimMade) return [...lines]
  return lines.map((l) => (!l.conditional && ACKNOWLEDGES_CLAIM.test(`${l.section} ${l.label}`) ? { ...l, conditional: true } : l))
}

export function effectiveLines(profile: FormProfile | null, lines: readonly SignatureLine[]): SignatureLine[] {
  const kept = claimAcknowledgmentsConditional(lines).filter((l) => l.signed || !l.conditional)
  if (!profile || profile.obligation.kind === 'reference') return kept
  const parties = profile.obligation.parties
  const single = parties.length === 1 ? parties[0] : null
  return kept.map((l) => {
    if (l.party !== 'other') return l
    if (single && INSTITUTIONAL.has(single)) return { ...l, party: single }
    if (single && /client|principal|owner/i.test(l.label)) return { ...l, party: single }
    return l
  })
}

/**
 * Who of `party` signed each section. Each named person must have a signed
 * line in every section the party signs. A signature is credited to the
 * person it names; a signature the reader could not put a name to is credited
 * to the next named person still missing, so a scrawl on the right line
 * counts as that line signed.
 */
function partyStatus(party: Party, lines: readonly SignatureLine[], names: readonly string[]): {
  signers: SignerStatus[]
  sectionsComplete: boolean
  anySigned: boolean
  sections: string[]
} {
  const mine = lines.filter((l) => lineParty(l) === party)
  const sections = [...new Set(mine.map(sectionKey))]
  const people: SignerStatus[] = (names.length ? names : [null]).map((name) => ({
    party,
    name,
    signed: false,
    signedAs: null,
    date: null,
    method: null,
    missingSections: [],
  }))
  const score = (l: SignatureLine, name: string | null) =>
    name ? Math.max(nameScore(l.signedName, name), nameScore(l.printedName, name)) : 0

  for (const sec of sections) {
    const secLines = mine.filter((l) => sectionKey(l) === sec)
    const signed = secLines.filter((l) => l.signed)
    const used = new Set<SignatureLine>()
    const credited = new Set<SignerStatus>()
    const credit = (person: SignerStatus, l: SignatureLine) => {
      used.add(l)
      credited.add(person)
      if (!person.signedAs) {
        person.signedAs = l.signedName ?? l.printedName
        person.date = l.date
        person.method = l.method
      }
    }
    // Best name match first, so "Douglas Halpin" never takes Masayo Halpin's line.
    const pairs = people
      .flatMap((person) => signed.map((l) => ({ person, l, s: score(l, person.name) })))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
    for (const { person, l } of pairs) {
      if (credited.has(person) || used.has(l)) continue
      credit(person, l)
    }
    // A signature the reader could not name fills the next person still missing.
    for (const person of people) {
      if (credited.has(person)) continue
      const anon = signed.find((l) => !used.has(l) && people.every((p) => score(l, p.name) === 0))
      if (anon) credit(person, anon)
      else person.missingSections.push(secLines[0]?.section || 'signature')
    }
  }
  for (const person of people) person.signed = sections.length > 0 && person.missingSections.length === 0
  return {
    signers: people,
    sectionsComplete: sections.length > 0 && people.every((p) => p.signed),
    anySigned: mine.some((l) => l.signed),
    sections,
  }
}

function normKeyPart(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function numberConflictKey(printed: string | null): string {
  return printed ? `f:${normKeyPart(printed)}` : ''
}

function termsKey(excerpt: string | null): string {
  return (excerpt ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(' ')
}

/**
 * `registry` supplies who signs for forms the curated library does not list
 * (or lists under a different number): learned from every copy the Vault has
 * read, by law, the kind of instrument and the printed blocks (registry.ts).
 */
export function verdictFor(form: FormReading, registry?: FormRegistry | null): FormVerdict {
  const match = profileFor({ title: form.title, formNumber: form.formNumber })
  let profile = match?.profile ?? null
  let basis: FormVerdict['basis'] = match?.basis ?? 'lines'
  let numberConflict = !!match?.numberConflict
  let rule: string | null = null
  let confidence: FormVerdict['confidence'] = match && match.basis !== 'generic' && !match.numberConflict ? 'library' : null
  const learned = registry && (!match || match.basis === 'generic' || match.numberConflict) ? registry.lookup(form.title) : null
  if (learned && learned.basis !== 'library') {
    profile = learned.profile
    basis = 'registry'
    numberConflict = false
    rule = learned.rule
    confidence = learned.confidence
  }
  const reasons: string[] = []
  if (numberConflict) reasons.push(`The printed form number ${form.formNumber} belongs to a different form than the title "${form.title}"; identified by title.`)
  if (!profile) reasons.push(`"${form.title || 'Untitled'}" is not in the form library; who must sign is read from the lines printed on it.`)
  if (basis === 'registry' && rule) reasons.push(`Who signs: ${rule}`)

  const lines = effectiveLines(profile, form.signatureLines)
  const { all, oneSide, optional } = obligatedParties(profile, lines)
  const signers: SignerStatus[] = []
  let verdict: ExecutionVerdict
  let outcome: FormVerdict['outcome'] = null

  const statusOf = (p: Party) => partyStatus(p, lines, namesFor(p, form))

  if (profile?.obligation.kind === 'reference') {
    verdict = 'reference'
    reasons.push(`${profile.name} is a report or reference; the parties do not execute it.`)
  } else if ((!profile || basis === 'registry') && !lines.length) {
    // A registry profile says what the form usually carries; a copy with no
    // signature line at all (a guide filed under the same title) is still
    // informational, as it was before the registry.
    verdict = 'reference'
    reasons.push('No signature lines on the pages read: an informational document.')
  } else if (form.blankTemplate && !lines.length) {
    // Nothing to fill in and nothing to sign: a guide or notice, not a blank form.
    verdict = 'reference'
    reasons.push('No fields and no signature lines: an informational document.')
  } else if (form.blankTemplate) {
    verdict = 'blank'
    reasons.push('Nothing is filled in: a blank form.')
  } else if (oneSide) {
    const statuses = oneSide.map((p) => ({ p, s: statusOf(p) }))
    const done = statuses.find((x) => x.s.sectionsComplete)
    for (const x of statuses) if (x.s.sections.length) signers.push(...x.s.signers)
    // Advisories print "Client" lines: our client's signature is the one side.
    const clientLines = lines.filter((l) => l.party === 'other' && /client|principal/i.test(l.label))
    const clientSigned = clientLines.filter((l) => l.signed)
    if (!done && clientSigned.length) {
      for (const l of clientSigned) {
        // The advisory says "Client", not which side: recorded as the client.
        signers.push({ party: 'client', name: l.signedName, signed: true, signedAs: l.signedName ?? l.printedName, date: l.date, method: l.method, missingSections: [] })
      }
    }
    if (done || clientSigned.length) {
      verdict = 'fully_executed'
      reasons.push(`${profile?.name ?? form.title} needs one side; ${done ? `the ${partyLabel(done.p).toLowerCase()} side` : 'the client'} signed.`)
    } else if (statuses.some((x) => x.s.anySigned)) {
      verdict = 'partially_executed'
      reasons.push('Some of the signing side signed, not all of them.')
    } else {
      verdict = 'unsigned'
      reasons.push('No one has signed it.')
    }
  } else {
    const required = all.filter((p) => !optional.includes(p))
    const statuses = required.map((p) => ({ p, s: statusOf(p) }))
    for (const x of statuses) signers.push(...x.s.signers)
    const missingParty = statuses.filter((x) => !x.s.sections.length)
    const incomplete = statuses.filter((x) => x.s.sections.length && !x.s.sectionsComplete)
    const anySigned = statuses.some((x) => x.s.anySigned)
    const complete = required.length > 0 && !missingParty.length && !incomplete.length

    if (profile?.outcome === 'seller_response') {
      const sellerResponseSigned = lines.some((l) => l.party === 'seller' && l.signed && !isAcknowledgmentSection(l.section))
      if (form.response === 'accepted') outcome = 'accepted'
      else if (form.response === 'countered') outcome = 'countered'
      else if (form.response === 'rejected') outcome = 'rejected'
      if (complete && outcome === 'accepted') verdict = 'fully_executed'
      else if (complete && outcome === 'countered') verdict = 'countered'
      else if (outcome === 'rejected' && sellerResponseSigned) verdict = 'rejected'
      else if (sellerResponseSigned && !outcome) {
        verdict = 'needs_review'
        reasons.push("The seller signed the response section but no response box is checked; the form treats that as void.")
      } else verdict = anySigned ? 'partially_executed' : 'unsigned'
      if (verdict === 'countered') reasons.push("Every party signed; the seller answered with a counteroffer, so the contract continues in the counteroffer.")
      if (verdict === 'fully_executed') reasons.push('Every party signed and the seller accepted.')
      if (verdict === 'rejected') reasons.push('The seller rejected this offer.')
    } else if (profile?.outcome === 'counter') {
      const issuer = form.counterBy
      const other: Party | null = issuer === 'seller' ? 'buyer' : issuer === 'buyer' ? 'seller' : null
      const issuerDone = issuer ? statuses.find((x) => x.p === issuer)?.s.sectionsComplete : false
      const otherDone = other ? statuses.find((x) => x.p === other)?.s.sectionsComplete : false
      if (form.response === 'rejected' && otherDone) {
        verdict = 'rejected'
        outcome = 'rejected'
        reasons.push('The other side rejected this counteroffer.')
      } else if (complete) {
        verdict = 'fully_executed'
        outcome = 'accepted'
        reasons.push('Both sides signed: the counteroffer was accepted.')
      } else if (issuerDone) {
        verdict = 'partially_executed'
        reasons.push(`Signed by the ${issuer} who made it; the ${other ?? 'other side'} has not accepted it.`)
      } else verdict = anySigned ? 'partially_executed' : 'unsigned'
    } else if (form.response === 'rejected' && anySigned) {
      verdict = 'rejected'
      outcome = 'rejected'
      reasons.push('Marked rejected on the form.')
    } else if (complete) {
      verdict = 'fully_executed'
      reasons.push('Every required party signed.')
    } else {
      verdict = anySigned ? 'partially_executed' : 'unsigned'
    }

    for (const x of missingParty) {
      if (verdict === 'fully_executed' || verdict === 'countered') verdict = 'needs_review'
      reasons.push(`No ${partyLabel(x.p).toLowerCase()} signature line was found on the pages read.`)
    }
    if (verdict === 'partially_executed' || verdict === 'unsigned') {
      const missing = signers.filter((s) => !s.signed)
      if (missing.length) {
        reasons.push(
          `Waiting on ${missing.map((s) => (s.name ? `${s.name} (${partyLabel(s.party).toLowerCase()})` : partyLabel(s.party).toLowerCase())).join(', ')}.`,
        )
      }
    }
  }

  if (form.watermark && /void|draft|sample/i.test(form.watermark)) {
    reasons.push(`Marked "${form.watermark}".`)
    if (verdict === 'fully_executed') verdict = 'needs_review'
  }
  if ((!profile || confidence === 'new') && (verdict === 'fully_executed' || verdict === 'partially_executed')) {
    // Library-less verdicts are shown, never acted on alone.
    reasons.push('Confirm against the form before relying on this.')
  }

  const buyersKey = [...form.buyersNamed.map(lastName)].filter(Boolean).sort().join('+')
  const numberPart = profile?.numbered ? form.instanceNumber ?? '' : ''
  const termsPart = profile?.numbered && !form.instanceNumber ? termsKey(form.termsExcerpt) : ''
  // The Sale Agreement # separates a deal that fell through from the one that
  // replaced it with the same buyers (Nordic: RRP04212025 in April, RP08242025
  // in August).
  const saleKey = normKeyPart(form.saleAgreementNumber)
  const instanceKey = [
    profile?.key ?? `title:${normKeyPart(form.title)}`,
    numberConflictKey(numberConflict ? form.formNumber : null),
    saleKey ? `sa:${saleKey}` : '',
    numberPart ? `n${normKeyPart(numberPart)}` : '',
    form.counterBy ?? '',
    termsPart ? `t:${termsPart}` : '',
    buyersKey ? `b:${buyersKey}` : '',
  ]
    .filter(Boolean)
    .join('|')
  const weakKey = !buyersKey || (!!profile?.numbered && !numberPart && !termsPart)

  return {
    segment: form.segment,
    profileKey: profile?.key ?? null,
    // A conflicting printed number means the library name may be the wrong form's.
    formName: (numberConflict ? form.title : profile?.name) || form.title || 'Unidentified form',
    basis,
    numberConflict,
    rule,
    confidence,
    offer: !!profile?.offer,
    instanceNumber: form.instanceNumber,
    counterBy: form.counterBy,
    saleAgreementNumber: form.saleAgreementNumber,
    verdict,
    outcome,
    signers,
    reasons,
    instanceKey,
    weakKey,
    numbered: !!profile?.numbered,
    checklistTerms: profile?.checklistTerms ?? [],
  }
}

export type DocumentVerdict = {
  forms: FormVerdict[]
  /** The whole file: fully executed only when every form in it is. */
  verdict: ExecutionVerdict
  summary: string
}

const RANK: Record<ExecutionVerdict, number> = {
  fully_executed: 7,
  countered: 6,
  rejected: 5,
  reference: 4,
  partially_executed: 3,
  unsigned: 2,
  blank: 1,
  needs_review: 0,
}

export function verdictRank(v: ExecutionVerdict): number {
  return RANK[v]
}

export const VERDICT_LABEL: Record<ExecutionVerdict, string> = {
  fully_executed: 'Fully executed',
  countered: 'Signed, countered',
  rejected: 'Rejected',
  partially_executed: 'Partially signed',
  unsigned: 'Unsigned',
  blank: 'Blank form',
  reference: 'Reference',
  needs_review: 'Needs review',
}

export function documentVerdict(forms: readonly FormVerdict[]): DocumentVerdict {
  if (!forms.length) return { forms: [], verdict: 'needs_review', summary: 'The reader found no form in this file.' }
  const signable = forms.filter((f) => f.verdict !== 'reference')
  let verdict: ExecutionVerdict
  if (!signable.length) verdict = 'reference'
  else if (signable.some((f) => f.verdict === 'needs_review')) verdict = 'needs_review'
  else verdict = signable.reduce<ExecutionVerdict>((worst, f) => (RANK[f.verdict] < RANK[worst] ? f.verdict : worst), signable[0].verdict)
  const summary = forms
    .map((f) => `${f.formName}${f.instanceNumber ? ` #${f.instanceNumber}` : ''}: ${VERDICT_LABEL[f.verdict].toLowerCase()}`)
    .join('; ')
  return { forms: [...forms], verdict, summary }
}
