/**
 * The deal terms reader: what it is asked, the shape of its answer, and the
 * normalizer. Pure. (Matt 2026-09-24: "When they read the actual deal file,
 * any counteroffers, addendums, and all that stuff will be automatically
 * placed into the deal file ... not just 'Okay, now you manually fill it in.'")
 *
 * The document reader (lib/tc/doc-read) identifies each form and who signed
 * it, and deliberately never looks at the pages that carry the terms. This
 * reader looks at every page of the forms that set or change terms (sale
 * agreement, counteroffer, addendum, amendment), and of the escrow papers that
 * confirm them (earnest money receipt, settlement statement), and transcribes
 * each term with the page it is on and the words that state it. It transcribes;
 * which instrument governs is decided in code (./resolve.ts).
 */

export const TERMS_VERSION = 'deal-terms-v1-2026-09-24'

export const INSTRUMENTS = ['sale_agreement', 'counteroffer', 'addendum', 'earnest_money_receipt', 'settlement_statement'] as const
export type InstrumentKind = (typeof INSTRUMENTS)[number]

export const FINANCING = ['cash', 'conventional', 'fha', 'va', 'usda', 'seller', 'other'] as const
export type FinancingType = (typeof FINANCING)[number]

/** One transcribed term: the value, the page it is on, and the words that state it. */
export type Term<T> = { value: T; page: number | null; quote: string | null }

export type TermsReading = {
  kind: InstrumentKind
  title: string
  /** "2" for Seller's Counteroffer No. 2 or Addendum No. 2. */
  instanceNumber: string | null
  counterBy: 'buyer' | 'seller' | null
  saleAgreementNumber: string | null
  propertyAddress: string | null
  buyers: string[]
  sellers: string[]
  /** The latest date written beside a buyer or seller signature on this form (YYYY-MM-DD). */
  lastSignatureDate: string | null
  purchasePrice: Term<number> | null
  earnestMoney: Term<number> | null
  /** Closing / "Closing Deadline" as a calendar date (YYYY-MM-DD). */
  closingDate: Term<string> | null
  /** When the form sets closing relative to something ("within 30 days of acceptance"): the words. */
  closingText: Term<string> | null
  inspectionDays: Term<number> | null
  financingDays: Term<number> | null
  financingType: Term<FinancingType> | null
  sellerConcessions: Term<number> | null
  possession: Term<string> | null
  escrowCompany: Term<string> | null
  escrowNumber: Term<string> | null
  /** Settlement statement: the settlement / disbursement date. */
  settlementDate: Term<string> | null
  /** Earnest money receipt: the date the deposit was received. */
  receivedDate: Term<string> | null
  /** Counteroffer / addendum: each change it makes, in plain words. */
  changes: string[]
  notes: string
}

export type TermsDocumentReading = { instruments: TermsReading[]; unreadablePages: number[] }

const nullableString = { type: ['string', 'null'] }

function term(value: Record<string, unknown>): Record<string, unknown> {
  return {
    type: ['object', 'null'],
    additionalProperties: false,
    required: ['value', 'page', 'quote'],
    properties: { value, page: { type: ['integer', 'null'] }, quote: nullableString },
  }
}

const TERM_KEYS = [
  'purchasePrice',
  'earnestMoney',
  'closingDate',
  'closingText',
  'inspectionDays',
  'financingDays',
  'financingType',
  'sellerConcessions',
  'possession',
  'escrowCompany',
  'escrowNumber',
  'settlementDate',
  'receivedDate',
] as const
export type TermKey = (typeof TERM_KEYS)[number]

export const TERMS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['instruments', 'unreadablePages'],
  properties: {
    unreadablePages: { type: 'array', items: { type: 'integer' } },
    instruments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'kind', 'title', 'instanceNumber', 'counterBy', 'saleAgreementNumber', 'propertyAddress', 'buyers', 'sellers', 'lastSignatureDate',
          ...TERM_KEYS, 'changes', 'notes',
        ],
        properties: {
          kind: { type: 'string', enum: [...INSTRUMENTS] },
          title: { type: 'string' },
          instanceNumber: nullableString,
          counterBy: { type: ['string', 'null'], enum: ['buyer', 'seller', null] },
          saleAgreementNumber: nullableString,
          propertyAddress: nullableString,
          buyers: { type: 'array', items: { type: 'string' } },
          sellers: { type: 'array', items: { type: 'string' } },
          lastSignatureDate: nullableString,
          purchasePrice: term({ type: 'number' }),
          earnestMoney: term({ type: 'number' }),
          closingDate: term({ type: 'string' }),
          closingText: term({ type: 'string' }),
          inspectionDays: term({ type: 'integer' }),
          financingDays: term({ type: 'integer' }),
          financingType: term({ type: 'string', enum: [...FINANCING] }),
          sellerConcessions: term({ type: 'number' }),
          possession: term({ type: 'string' }),
          escrowCompany: term({ type: 'string' }),
          escrowNumber: term({ type: 'string' }),
          settlementDate: term({ type: 'string' }),
          receivedDate: term({ type: 'string' }),
          changes: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
      },
    },
  },
}

export const TERMS_SYSTEM = [
  'You transcribe the deal terms written on Oregon residential real estate transaction forms (OREF and Oregon REALTORS forms, e-signed or wet-signed, sometimes scanned).',
  'Report only what is filled in on the page. Never infer, calculate, or carry a value from one form to another. A blank, unchecked, or struck-through field is null.',
  'For every value give the page number it is on and quote the words that state it, exactly as printed or typed (for example "Purchase Price: $519,000.00").',
  'Money is a plain number of dollars (519000, not "$519,000"). Dates are YYYY-MM-DD; a date written 06/23/2026 is 2026-06-23.',
].join(' ')

export function termsInstruction(input: { kinds: Array<{ kind: InstrumentKind; title: string; pages: number[] }> }): string {
  const lines = input.kinds.map((k) => `- ${k.kind} ("${k.title}") on pages ${k.pages.join(', ')}`)
  return [
    'These pages hold these forms:',
    ...lines,
    '',
    'Return one entry in "instruments" for each form listed, in the order listed.',
    'page: the number in the "Page N:" label shown before that page image (or the page of the PDF when you are given the PDF).',
    'Checkboxes: a choice counts only when its box is checked, filled or marked X. An option merely printed on the form is not chosen. When no box is marked, the value is null.',
    'Printed defaults such as "(ten [10] if not filled in)": use the number written in the blank; if the blank is empty, use the printed default and say so in the quote.',
    'inspectionDays: the buyer\'s inspection or due diligence period in days. financingDays: the days the buyer has to obtain loan approval or remove the loan/financing contingency, NOT the days to apply for a loan, to deliver a pre-approval letter, or to order an appraisal.',
    'For inspectionDays and financingDays the quote MUST include the printed name of the provision the number belongs to (for example "Due Diligence Period: 10 Business Days" or "Loan Contingency ... 21 Business Days"). If you cannot quote that, the value is null.',
    'saleAgreementNumber: the value written after "Sale Agreement #" at the top of the page. instanceNumber: only the number of a counteroffer or addendum ("No. 2").',
    'buyers / sellers: the people named as Buyer and as Seller on the form. Never list a seller as a buyer.',
    'sale_agreement: the offer as written: purchase price, earnest money, closing date (or the words setting it), inspection period in days, financing contingency period in days, financing type, seller-paid concessions, possession, escrow company, buyers, sellers, Sale Agreement number.',
    'counteroffer: ONLY the terms this counteroffer changes (leave every other term null), each change in "changes" in plain words, who is countering, its number, and the Sale Agreement number it answers.',
    'addendum (including amendments, extensions and repair addenda): ONLY the terms it changes, each change in "changes"; an inspection or financing extension that sets a new date goes in "changes" with the date.',
    'On a counteroffer or addendum, escrowCompany is set only when the form names a new escrow or title company for the transaction; a company named in a release, hold-harmless or payment clause is not that.',
    'earnest_money_receipt: the amount received, the date received, the escrow company and escrow/file number.',
    'settlement_statement: the contract sales price, the settlement or disbursement date, the escrow company and escrow/file number.',
    'lastSignatureDate: the latest date written beside a buyer or seller signature on that form, else null.',
    'List any page you cannot read in "unreadablePages".',
  ].join('\n')
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

function asTerm<T>(raw: unknown, check: (v: unknown) => v is T, pages: ReadonlySet<number>): Term<T> | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { value?: unknown; page?: unknown; quote?: unknown }
  if (!check(r.value)) return null
  const page = typeof r.page === 'number' && pages.has(r.page) ? r.page : null
  const quote = typeof r.quote === 'string' && r.quote.trim() ? r.quote.trim().slice(0, 300) : null
  return { value: r.value, page, quote }
}

/**
 * A day count is only as good as the provision it came from. On the 2026 form
 * 1.1 the "2 Business Days" beside the pre-approval deadline was read as the
 * financing period (Beaumont, 2026-09-24). The quote must name the provision,
 * and never a deadline that is not the period itself.
 */
const INSPECTION_WORDS = /inspect|due diligence/i
const FINANCING_WORDS = /loan|financ/i
const NOT_A_PERIOD = /pre-?approval|application|apprais|earnest|deposit/i

function provision<T>(t: Term<T> | null, must: RegExp, mustNot: RegExp): Term<T> | null {
  if (!t) return null
  const q = t.quote ?? ''
  return must.test(q) && !mustNot.test(q) ? t : null
}

const isMoney = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 100_000_000
const isDays = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 120
const isIso = (v: unknown): v is string => typeof v === 'string' && ISO.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isFinancing = (v: unknown): v is FinancingType => typeof v === 'string' && (FINANCING as readonly string[]).includes(v)
const names = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()) : [])

/**
 * Hold the model's answer to the schema and to sense: a value that is not a
 * plausible amount, day count or calendar date is dropped rather than kept,
 * and a page outside the pages shown is not cited.
 */
export function normalizeTermsReading(raw: unknown, pagesShown: ReadonlySet<number>): TermsDocumentReading {
  const r = (raw ?? {}) as { instruments?: unknown; unreadablePages?: unknown }
  const list = Array.isArray(r.instruments) ? r.instruments : []
  const instruments: TermsReading[] = []
  for (const x of list) {
    if (!x || typeof x !== 'object') continue
    const i = x as Record<string, unknown>
    const kind = (INSTRUMENTS as readonly string[]).includes(String(i.kind)) ? (i.kind as InstrumentKind) : null
    if (!kind) continue
    instruments.push({
      kind,
      title: isText(i.title) ? i.title.trim() : kind,
      instanceNumber: isText(i.instanceNumber) ? i.instanceNumber.trim() : null,
      counterBy: i.counterBy === 'buyer' || i.counterBy === 'seller' ? i.counterBy : null,
      saleAgreementNumber: isText(i.saleAgreementNumber) ? i.saleAgreementNumber.trim() : null,
      propertyAddress: isText(i.propertyAddress) ? i.propertyAddress.trim() : null,
      buyers: names(i.buyers),
      sellers: names(i.sellers),
      lastSignatureDate: isIso(i.lastSignatureDate) ? i.lastSignatureDate : null,
      purchasePrice: asTerm(i.purchasePrice, isMoney, pagesShown),
      earnestMoney: asTerm(i.earnestMoney, isMoney, pagesShown),
      closingDate: asTerm(i.closingDate, isIso, pagesShown),
      closingText: asTerm(i.closingText, isText, pagesShown),
      inspectionDays: provision(asTerm(i.inspectionDays, isDays, pagesShown), INSPECTION_WORDS, NOT_A_PERIOD),
      financingDays: provision(asTerm(i.financingDays, isDays, pagesShown), FINANCING_WORDS, NOT_A_PERIOD),
      financingType: asTerm(i.financingType, isFinancing, pagesShown),
      sellerConcessions: asTerm(i.sellerConcessions, isMoney, pagesShown),
      possession: asTerm(i.possession, isText, pagesShown),
      escrowCompany: asTerm(i.escrowCompany, isText, pagesShown),
      escrowNumber: asTerm(i.escrowNumber, isText, pagesShown),
      settlementDate: asTerm(i.settlementDate, isIso, pagesShown),
      receivedDate: asTerm(i.receivedDate, isIso, pagesShown),
      changes: names(i.changes).slice(0, 20),
      notes: isText(i.notes) ? i.notes.trim().slice(0, 500) : '',
    })
  }
  const unreadablePages = Array.isArray(r.unreadablePages) ? r.unreadablePages.filter((n): n is number => typeof n === 'number' && pagesShown.has(n)) : []
  return { instruments, unreadablePages }
}

/**
 * Which instrument a form the document reader identified is, by its title.
 * Null for everything else (advisories, disclosures, notices, the FHA
 * amendatory clause, association addenda): those set no deal terms.
 */
export function instrumentKindForTitle(title: string | null | undefined): InstrumentKind | null {
  const t = (title ?? '').toLowerCase()
  if (!t) return null
  if (/advis|instruction|disclosure|pamphlet|amendatory|lead[- ]based|association addendum|notice|termination|disapproval|release/.test(t)) return null
  if (/counter ?-?offer/.test(t)) return 'counteroffer'
  if (/earnest money|receipt for incoming|deposit (confirmation|receipt)/.test(t)) return 'earnest_money_receipt'
  if (/settlement statement|closing statement|seller'?s (final )?statement|buyer'?s (final )?statement|alta|closing disclosure|hud-?1/.test(t)) return 'settlement_statement'
  if (/addendum|amendment|extension/.test(t)) return 'addendum'
  if (/sale agreement|purchase and sale|sales agreement/.test(t)) return 'sale_agreement'
  return null
}
