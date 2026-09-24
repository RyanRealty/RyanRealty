/**
 * Which terms stand on a cycle, from the instruments the terms reader
 * transcribed. Pure.
 *
 * An Oregon residential deal is a chain: the buyer's sale agreement, then
 * counteroffers back and forth until one is signed by both sides, then any
 * addenda and amendments both sides sign. Each later instrument changes only
 * what it names. So the standing terms are the sale agreement's, overwritten
 * in order by each counter in the chain up to the one that was accepted, then
 * by each fully executed addendum. The escrow papers confirm or complete them:
 * the earnest money receipt and the settlement statement.
 *
 * What counts as executed is the document reader's verdict
 * (lib/tc/doc-read/verdict.ts, held to the printed form), never this module's.
 */
import type { FinancingType, InstrumentKind, Term, TermsReading } from './schema'

export type Instrument = {
  documentId: string
  documentName: string
  /** The document reader's verdict for this form: fully_executed, countered, rejected, partially_executed, ... */
  verdict: string
  reading: TermsReading
}

export type CycleHints = {
  /** Buyers on the cycle (SkySlope or the Vault), used to pick this cycle's offer. */
  buyers: string[]
  contractAcceptanceDate: string | null
}

export type TermSource = {
  documentId: string
  documentName: string
  instrument: string
  kind: InstrumentKind
  page: number | null
  quote: string | null
}

export type ResolvedField<T> = { value: T; source: TermSource; replaced: Array<{ value: T; documentName: string }> }

export type ResolvedTerms = {
  /** executed: a fully executed agreement stands. offer_only: the chain was never accepted. none: nothing to read. */
  status: 'executed' | 'offer_only' | 'none'
  buyers: string[]
  sellers: string[]
  salePrice?: ResolvedField<number>
  earnestMoney?: ResolvedField<number>
  acceptanceDate?: ResolvedField<string>
  closingDate?: ResolvedField<string>
  inspectionDays?: ResolvedField<number>
  financingDays?: ResolvedField<number>
  financingType?: ResolvedField<FinancingType>
  sellerConcessions?: ResolvedField<number>
  possession?: ResolvedField<string>
  escrowCompany?: ResolvedField<string>
  escrowNumber?: ResolvedField<string>
  /** The instruments that made the standing terms, in the order they apply. */
  chain: Array<{ documentId: string; documentName: string; kind: InstrumentKind; title: string; verdict: string; date: string | null; changes: string[] }>
  notes: string[]
}

type FieldKey = 'salePrice' | 'earnestMoney' | 'closingDate' | 'inspectionDays' | 'financingDays' | 'financingType' | 'sellerConcessions' | 'possession' | 'escrowCompany' | 'escrowNumber'

/** Reading key → resolved key. */
const CONTRACT_FIELDS: Array<[keyof TermsReading, FieldKey]> = [
  ['purchasePrice', 'salePrice'],
  ['earnestMoney', 'earnestMoney'],
  ['closingDate', 'closingDate'],
  ['inspectionDays', 'inspectionDays'],
  ['financingDays', 'financingDays'],
  ['financingType', 'financingType'],
  ['sellerConcessions', 'sellerConcessions'],
  ['possession', 'possession'],
  ['escrowCompany', 'escrowCompany'],
  ['escrowNumber', 'escrowNumber'],
]

const STOP = new Set(['and', 'or', 'the', 'trust', 'trustee', 'llc', 'inc', 'jr', 'sr', 'ii', 'iii', 'estate', 'of', 'revocable', 'living'])

/** Last-name tokens of a list of people ("Theresa Treadway", "Jerey Neinstadt" → treadway, neinstadt). */
export function surnames(people: readonly string[]): Set<string> {
  const out = new Set<string>()
  for (const p of people) {
    const parts = p
      .toLowerCase()
      .replace(/[^a-z\s'-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
    if (parts.length) out.add(parts[parts.length - 1])
  }
  return out
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (b.has(x)) return true
  return false
}

const EXECUTED = 'fully_executed'
/** A sale agreement that can start a chain: accepted as written, or answered with a counter. */
const SA_OK = new Set(['fully_executed', 'countered', 'needs_review'])
const VERDICT_RANK: Record<string, number> = { fully_executed: 4, countered: 3, needs_review: 2, partially_executed: 1 }

function dateOf(i: Instrument): string {
  return i.reading.lastSignatureDate ?? ''
}

function instanceOf(i: Instrument): number {
  const n = Number.parseInt(i.reading.instanceNumber ?? '', 10)
  return Number.isFinite(n) ? n : 0
}

function source(i: Instrument, t: Term<unknown>): TermSource {
  return { documentId: i.documentId, documentName: i.documentName, instrument: i.reading.title, kind: i.reading.kind, page: t.page, quote: t.quote }
}

type Offer = { sa: Instrument; buyers: Set<string>; number: string | null; counters: Instrument[]; addenda: Instrument[] }

function sameInstrument(a: Instrument, b: Instrument): boolean {
  return (
    a.reading.kind === b.reading.kind &&
    (a.reading.instanceNumber ?? '') === (b.reading.instanceNumber ?? '') &&
    (a.reading.counterBy ?? '') === (b.reading.counterBy ?? '') &&
    dateOf(a) === dateOf(b) &&
    (a.reading.purchasePrice?.value ?? null) === (b.reading.purchasePrice?.value ?? null)
  )
}

/** Two copies of one instrument (the emailed copy and the SkySlope copy): keep the most executed. */
function dedupe(list: Instrument[]): Instrument[] {
  const out: Instrument[] = []
  for (const i of list) {
    const k = out.findIndex((o) => sameInstrument(o, i))
    if (k < 0) out.push(i)
    else if ((VERDICT_RANK[i.verdict] ?? 0) > (VERDICT_RANK[out[k].verdict] ?? 0)) out[k] = i
  }
  return out
}

function buildOffers(instruments: Instrument[]): Offer[] {
  const sas = dedupe(instruments.filter((i) => i.reading.kind === 'sale_agreement' && SA_OK.has(i.verdict)))
  const offers: Offer[] = sas.map((sa) => ({ sa, buyers: surnames(sa.reading.buyers), number: sa.reading.saleAgreementNumber, counters: [], addenda: [] }))
  const attach = (i: Instrument): Offer | null => {
    if (!offers.length) return null
    const byNumber = i.reading.saleAgreementNumber ? offers.filter((o) => o.number && o.number === i.reading.saleAgreementNumber) : []
    if (byNumber.length === 1) return byNumber[0]
    const who = surnames(i.reading.buyers)
    const byBuyer = who.size ? offers.filter((o) => overlaps(o.buyers, who)) : []
    const pool = byBuyer.length ? byBuyer : offers.length === 1 ? offers : []
    if (!pool.length) return null
    // The latest offer made on or before this instrument.
    const d = dateOf(i)
    const before = pool.filter((o) => !d || !dateOf(o.sa) || dateOf(o.sa) <= d)
    return (before.length ? before : pool).sort((a, b) => dateOf(b.sa).localeCompare(dateOf(a.sa)))[0]
  }
  for (const i of dedupe(instruments.filter((x) => x.reading.kind === 'counteroffer'))) attach(i)?.counters.push(i)
  for (const i of dedupe(instruments.filter((x) => x.reading.kind === 'addendum'))) attach(i)?.addenda.push(i)
  return offers
}

function isBinding(o: Offer): boolean {
  return o.sa.verdict === EXECUTED || o.counters.some((c) => c.verdict === EXECUTED)
}

function bindingDate(o: Offer): string {
  const executed = o.counters.filter((c) => c.verdict === EXECUTED).map(dateOf).sort()
  return executed.length ? executed[executed.length - 1] : dateOf(o.sa)
}

/** The offer that is this cycle: the cycle's buyers when known, a binding one, the latest. */
function pickOffer(offers: Offer[], hints: CycleHints): Offer | null {
  const who = surnames(hints.buyers)
  let pool = who.size ? offers.filter((o) => overlaps(o.buyers, who)) : offers
  if (!pool.length) return null
  const binding = pool.filter(isBinding)
  if (binding.length) pool = binding
  if (hints.contractAcceptanceDate && pool.length > 1) {
    const near = pool.filter((o) => Math.abs(Date.parse(bindingDate(o)) - Date.parse(hints.contractAcceptanceDate!)) <= 4 * 86_400_000)
    if (near.length) pool = near
  }
  return [...pool].sort((a, b) => bindingDate(b).localeCompare(bindingDate(a)))[0]
}

function orderByDate(list: Instrument[]): Instrument[] {
  return [...list].sort((a, b) => dateOf(a).localeCompare(dateOf(b)) || instanceOf(a) - instanceOf(b))
}

export function resolveCycleTerms(instruments: readonly Instrument[], hints: CycleHints): ResolvedTerms {
  const out: ResolvedTerms = { status: 'none', buyers: [], sellers: [], chain: [], notes: [] }
  const offers = buildOffers([...instruments])
  const offer = pickOffer(offers, hints)

  const set = <K extends FieldKey>(key: K, value: NonNullable<ResolvedTerms[K]>['value'], src: TermSource, documentName: string) => {
    const prev = out[key] as ResolvedField<typeof value> | undefined
    if (prev && prev.value === value) return
    const replaced = prev ? [...prev.replaced, { value: prev.value, documentName: prev.source.documentName }] : []
    ;(out as Record<string, unknown>)[key] = { value, source: src, replaced }
    void documentName
  }
  const apply = (i: Instrument) => {
    for (const [from, to] of CONTRACT_FIELDS) {
      const t = i.reading[from] as Term<string | number> | null
      if (t) set(to, t.value as never, source(i, t), i.documentName)
    }
    out.chain.push({ documentId: i.documentId, documentName: i.documentName, kind: i.reading.kind, title: i.reading.title, verdict: i.verdict, date: i.reading.lastSignatureDate, changes: i.reading.changes })
  }

  if (offer) {
    out.status = isBinding(offer) ? 'executed' : 'offer_only'
    out.buyers = offer.sa.reading.buyers
    out.sellers = offer.sa.reading.sellers
    apply(offer.sa)
    // Counters in order, up to and including the last one both sides signed;
    // a rejected counter changed nothing, and one proposed after acceptance
    // was never agreed.
    const counters = orderByDate(offer.counters.filter((c) => c.verdict !== 'rejected'))
    const lastExecuted = counters.map((c) => c.verdict).lastIndexOf(EXECUTED)
    const agreed = out.status === 'executed' ? (lastExecuted >= 0 ? counters.slice(0, lastExecuted + 1) : []) : counters
    for (const c of agreed) apply(c)
    const accepted = lastExecuted >= 0 ? agreed[agreed.length - 1] : offer.sa
    if (out.status === 'executed' && accepted.reading.lastSignatureDate) {
      out.acceptanceDate = {
        value: accepted.reading.lastSignatureDate,
        source: { documentId: accepted.documentId, documentName: accepted.documentName, instrument: accepted.reading.title, kind: accepted.reading.kind, page: null, quote: null },
        replaced: [],
      }
    }
    if (out.status === 'executed') {
      for (const a of orderByDate(offer.addenda.filter((x) => x.verdict === EXECUTED))) apply(a)
    } else {
      out.notes.push('No counteroffer or sale agreement in this chain is signed by both sides yet; these are the terms as offered.')
    }
    const skipped = offer.addenda.filter((x) => x.verdict !== EXECUTED).length
    if (skipped) out.notes.push(`${skipped} addend${skipped === 1 ? 'um is' : 'a are'} not signed by both sides and changed nothing.`)
  } else if (instruments.some((i) => i.reading.kind === 'sale_agreement')) {
    out.notes.push(
      hints.buyers.length
        ? `No sale agreement here names the buyers on this cycle (${hints.buyers.join(', ')}) and is accepted or countered.`
        : 'No sale agreement here is accepted or countered.',
    )
  }

  // Escrow papers: the receipt and the settlement statement.
  const receipts = instruments.filter((i) => i.reading.kind === 'earnest_money_receipt')
  const statements = instruments.filter((i) => i.reading.kind === 'settlement_statement')
  const accepted = out.acceptanceDate?.value ?? null
  const after = (i: Instrument, d: string | null) => !accepted || !d || d >= accepted
  const receipt = [...receipts].filter((r) => after(r, r.reading.receivedDate?.value ?? null)).sort((a, b) => (b.reading.receivedDate?.value ?? '').localeCompare(a.reading.receivedDate?.value ?? ''))[0]
  const statement = [...statements].filter((s) => after(s, s.reading.settlementDate?.value ?? null)).sort((a, b) => (b.reading.settlementDate?.value ?? '').localeCompare(a.reading.settlementDate?.value ?? ''))[0]

  if (receipt) {
    const em = receipt.reading.earnestMoney
    if (em && !out.earnestMoney) set('earnestMoney', em.value, source(receipt, em), receipt.documentName)
    else if (em && out.earnestMoney && out.earnestMoney.value !== em.value) {
      out.notes.push(`The earnest money receipt shows $${em.value.toLocaleString('en-US')}; the agreement says $${out.earnestMoney.value.toLocaleString('en-US')}.`)
    }
  }
  for (const doc of [receipt, statement]) {
    if (!doc) continue
    if (doc.reading.escrowCompany && !out.escrowCompany) set('escrowCompany', doc.reading.escrowCompany.value, source(doc, doc.reading.escrowCompany), doc.documentName)
    if (doc.reading.escrowNumber && !out.escrowNumber) set('escrowNumber', doc.reading.escrowNumber.value, source(doc, doc.reading.escrowNumber), doc.documentName)
  }
  if (statement?.reading.purchasePrice) {
    const p = statement.reading.purchasePrice
    if (!out.salePrice) set('salePrice', p.value, source(statement, p), statement.documentName)
    else if (out.salePrice.value !== p.value) {
      // The settlement statement is what closed; an amendment the reader did
      // not catch is the usual reason they differ. It wins, and says so.
      out.notes.push(`The settlement statement's price ($${p.value.toLocaleString('en-US')}) replaces the agreement's ($${out.salePrice.value.toLocaleString('en-US')}).`)
      set('salePrice', p.value, source(statement, p), statement.documentName)
    }
  }
  if (out.status === 'none' && (receipt || statement)) out.status = 'offer_only'
  return out
}
