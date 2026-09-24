import { describe, expect, it } from 'vitest'
import { agreeReadings } from './agree'
import { planTermsWrite, type CycleTermColumns } from './plan'
import { resolveCycleTerms, surnames, type Instrument } from './resolve'
import { instrumentKindForTitle, normalizeTermsReading, type InstrumentKind, type Term, type TermsReading } from './schema'

const t = <T,>(value: T, page = 1, quote: string | null = null): Term<T> => ({ value, page, quote })

function reading(kind: InstrumentKind, p: Partial<TermsReading> = {}): TermsReading {
  return {
    kind,
    title: kind,
    instanceNumber: null,
    counterBy: null,
    saleAgreementNumber: null,
    propertyAddress: '20702 Beaumont Drive, Bend, OR 97701',
    buyers: [],
    sellers: ['Mary Bowman'],
    lastSignatureDate: null,
    purchasePrice: null,
    earnestMoney: null,
    closingDate: null,
    closingText: null,
    inspectionDays: null,
    financingDays: null,
    financingType: null,
    sellerConcessions: null,
    possession: null,
    escrowCompany: null,
    escrowNumber: null,
    settlementDate: null,
    receivedDate: null,
    changes: [],
    notes: '',
    ...p,
  }
}

let seq = 0
const inst = (verdict: string, r: TermsReading, name?: string): Instrument => ({ documentId: `d${++seq}`, documentName: name ?? `${r.kind}-${seq}.pdf`, verdict, reading: r })

// A Beaumont-shaped file: an earlier buyer's deal that fell through, then the
// Nicoll offer, countered twice, extended by addendum, closed.
const TREADWAY = ['Theresa Treadway', 'Jerey Neinstadt']
const NICOLL = ['Tyler Nicoll']
const FILE: Instrument[] = [
  inst('countered', reading('sale_agreement', { buyers: TREADWAY, purchasePrice: t(505000), earnestMoney: t(10000), closingDate: t('2026-04-24'), inspectionDays: t(10), lastSignatureDate: '2026-03-17' })),
  inst('fully_executed', reading('counteroffer', { buyers: TREADWAY, counterBy: 'seller', instanceNumber: '1', purchasePrice: t(515000), closingDate: t('2026-04-29'), lastSignatureDate: '2026-03-28' })),
  inst('countered', reading('sale_agreement', { buyers: NICOLL, saleAgreementNumber: '2026-114', purchasePrice: t(510000), earnestMoney: t(5000), closingDate: t('2026-06-12'), inspectionDays: t(10), financingDays: t(21), financingType: t('fha' as const), lastSignatureDate: '2026-05-11' }), 'Beaumont Offer 3.pdf'),
  inst('partially_executed', reading('counteroffer', { buyers: NICOLL, saleAgreementNumber: '2026-114', counterBy: 'seller', instanceNumber: '1', purchasePrice: t(525000), lastSignatureDate: '2026-05-12' })),
  inst('fully_executed', reading('counteroffer', { buyers: NICOLL, saleAgreementNumber: '2026-114', counterBy: 'seller', instanceNumber: '2', purchasePrice: t(519000, 1, 'Purchase Price: $519,000'), lastSignatureDate: '2026-05-13' }), 'Sellers Counteroffer 2.pdf'),
  inst('fully_executed', reading('addendum', { buyers: NICOLL, saleAgreementNumber: '2026-114', closingDate: t('2026-06-23'), changes: ['Closing moves to 06/23/2026'], lastSignatureDate: '2026-05-20' }), 'Addendum- Insp Ext.pdf'),
  inst('rejected', reading('addendum', { buyers: NICOLL, saleAgreementNumber: '2026-114', purchasePrice: t(500000), lastSignatureDate: '2026-05-27' }), 'Repair Addendum.pdf'),
  inst('reference', reading('earnest_money_receipt', { earnestMoney: t(5000), receivedDate: t('2026-05-15'), escrowCompany: t('Western Title & Escrow'), escrowNumber: t('WT0286975') })),
  inst('reference', reading('settlement_statement', { purchasePrice: t(519000), settlementDate: t('2026-07-09'), escrowNumber: t('WT0286975') }), 'Final Sellers Statement IHLB.pdf'),
]

describe('instrument kinds', () => {
  it('knows the forms that set terms and ignores the ones that do not', () => {
    expect(instrumentKindForTitle('Residential Real Estate Sale Agreement')).toBe('sale_agreement')
    expect(instrumentKindForTitle('1.1 OREGON RESIDENTIAL REAL ESTATE PURCHASE AND SALE AGREEMENT')).toBe('sale_agreement')
    expect(instrumentKindForTitle('Sellers Counteroffer')).toBe('counteroffer')
    expect(instrumentKindForTitle('2.2 GENERAL ADDENDUM TO REAL ESTATE PURCHASE AND SALE AGREEMENT')).toBe('addendum')
    expect(instrumentKindForTitle('Addendum to Sale Agreement')).toBe('addendum')
    expect(instrumentKindForTitle('Receipt for Incoming Wire/Direct Deposit Confirmation')).toBe('earnest_money_receipt')
    expect(instrumentKindForTitle('Final Sellers Statement')).toBe('settlement_statement')
    for (const none of [
      'Advisory and Instructions Regarding Real Estate Purchase and Sale Forms',
      "SELLER'S PROPERTY DISCLOSURE STATEMENT ADDENDUM",
      '4.4 ASSOCIATION ADDENDUM',
      'FHA AMENDATORY CLAUSE AND REAL ESTATE CERTIFICATION',
      "NOTICE OF BUYER'S UNCONDITIONAL DISAPPROVAL",
      'Initial Agency Disclosure Pamphlet',
    ]) {
      expect(instrumentKindForTitle(none)).toBeNull()
    }
  })

  it('drops values that are not plausible and pages that were not shown', () => {
    const r = normalizeTermsReading(
      {
        unreadablePages: [2, 99],
        instruments: [
          {
            kind: 'sale_agreement',
            purchasePrice: { value: 519000, page: 1, quote: 'Purchase Price: $519,000' },
            earnestMoney: { value: -5, page: 1, quote: null },
            closingDate: { value: '06/23/2026', page: 7, quote: null },
            inspectionDays: { value: 10, page: 42, quote: null },
            buyers: ['Tyler Nicoll', ''],
          },
          { kind: 'not_a_kind' },
        ],
      },
      new Set([1, 2, 3]),
    )
    expect(r.instruments).toHaveLength(1)
    expect(r.instruments[0].purchasePrice).toEqual({ value: 519000, page: 1, quote: 'Purchase Price: $519,000' })
    expect(r.instruments[0].earnestMoney).toBeNull()
    expect(r.instruments[0].closingDate).toBeNull()
    // no quote naming the provision: not kept
    expect(r.instruments[0].inspectionDays).toBeNull()
    expect(r.instruments[0].buyers).toEqual(['Tyler Nicoll'])
    expect(r.unreadablePages).toEqual([2])
  })
})

describe('day counts must name their provision', () => {
  const read = (field: string, quote: string) =>
    normalizeTermsReading({ instruments: [{ kind: 'sale_agreement', [field]: { value: 2, page: 3, quote } }] }, new Set([3])).instruments[0]
  it('rejects the pre-approval deadline read as the financing period (Beaumont 1.1, 2026-09-24)', () => {
    expect(read('financingDays', 'If Buyer did not provide evidence of loan pre-approval with offer, within 2 Business Days').financingDays).toBeNull()
    expect(read('financingDays', 'within 2 Business Days').financingDays).toBeNull()
    expect(read('financingDays', 'Loan Contingency: Buyer has 2 Business Days').financingDays?.value).toBe(2)
    expect(read('inspectionDays', 'Due Diligence Period: 2 Business Days').inspectionDays?.value).toBe(2)
    expect(read('inspectionDays', 'Earnest Money Deposit: Within 2 Business Days').inspectionDays).toBeNull()
  })
})

describe('resolveCycleTerms', () => {
  it('reads the chain in order: offer, counters up to the accepted one, executed addenda, then escrow papers', () => {
    const r = resolveCycleTerms(FILE, { buyers: NICOLL, contractAcceptanceDate: '2026-05-14' })
    expect(r.status).toBe('executed')
    expect(r.salePrice?.value).toBe(519000)
    // the settlement statement agrees, so the accepted counter stays the source
    expect(r.salePrice?.source.documentName).toBe('Sellers Counteroffer 2.pdf')
    expect(r.salePrice?.replaced.map((x) => x.value)).toEqual([510000, 525000])
    expect(r.acceptanceDate?.value).toBe('2026-05-13')
    expect(r.acceptanceDate?.source.documentName).toBe('Sellers Counteroffer 2.pdf')
    expect(r.closingDate?.value).toBe('2026-06-23')
    expect(r.closingDate?.source.documentName).toBe('Addendum- Insp Ext.pdf')
    expect(r.earnestMoney?.value).toBe(5000)
    expect(r.inspectionDays?.value).toBe(10)
    expect(r.financingDays?.value).toBe(21)
    expect(r.financingType?.value).toBe('fha')
    expect(r.escrowCompany?.value).toBe('Western Title & Escrow')
    expect(r.escrowNumber?.value).toBe('WT0286975')
    expect(r.buyers).toEqual(NICOLL)
    // the rejected repair addendum changed nothing
    expect(r.chain.map((c) => c.documentName)).not.toContain('Repair Addendum.pdf')
    expect(r.notes.join(' ')).toMatch(/1 addendum is not signed by both sides/)
  })

  it('lets the settlement statement win over the agreement, and says so', () => {
    const file = FILE.map((i) =>
      i.reading.kind === 'settlement_statement' ? { ...i, reading: { ...i.reading, purchasePrice: t(517500) } } : i,
    )
    const r = resolveCycleTerms(file, { buyers: NICOLL, contractAcceptanceDate: null })
    expect(r.salePrice?.value).toBe(517500)
    expect(r.salePrice?.source.documentName).toBe('Final Sellers Statement IHLB.pdf')
    expect(r.notes.join(' ')).toMatch(/settlement statement's price \(\$517,500\) replaces the agreement's \(\$519,000\)/)
  })

  it('picks the earlier buyer when the cycle is theirs', () => {
    const r = resolveCycleTerms(FILE, { buyers: TREADWAY, contractAcceptanceDate: '2026-03-28' })
    expect(r.status).toBe('executed')
    expect(r.acceptanceDate?.value).toBe('2026-03-28')
    expect(r.closingDate?.value).toBe('2026-04-29')
    expect(r.buyers).toEqual(TREADWAY)
  })

  it('never calls an unaccepted offer executed', () => {
    const offer = [
      inst('countered', reading('sale_agreement', { buyers: NICOLL, purchasePrice: t(510000), lastSignatureDate: '2026-05-11' })),
      inst('partially_executed', reading('counteroffer', { buyers: NICOLL, purchasePrice: t(525000), lastSignatureDate: '2026-05-12' })),
    ]
    const r = resolveCycleTerms(offer, { buyers: NICOLL, contractAcceptanceDate: null })
    expect(r.status).toBe('offer_only')
    expect(r.acceptanceDate).toBeUndefined()
    expect(r.salePrice?.value).toBe(525000)
  })

  it('finds nothing for a cycle whose buyers no agreement names', () => {
    const r = resolveCycleTerms(FILE.slice(0, 2), { buyers: ['Someone Else'], contractAcceptanceDate: null })
    expect(r.status).toBe('none')
    expect(r.notes[0]).toMatch(/No sale agreement here names the buyers on this cycle/)
  })

  it('matches buyers by surname', () => {
    expect([...surnames(['Theresa Treadway', 'Jerey Neinstadt'])]).toEqual(['treadway', 'neinstadt'])
    expect([...surnames(['Mary J. Bowman, Trustee of the Bowman Living Trust'])]).toEqual(['bowman'])
  })
})

describe('agreeReadings (two readers, one answer)', () => {
  const doc = (price: number, days: number | null, kind: InstrumentKind = 'counteroffer') => ({
    unreadablePages: [],
    instruments: [reading(kind, { buyers: NICOLL, purchasePrice: t(price, 1, 'Price $519,000'), inspectionDays: days == null ? null : t(days), lastSignatureDate: '2026-05-13' })],
  })

  it('keeps what both read the same', () => {
    const a = agreeReadings(doc(519000, 10), doc(519000, 10))
    expect(a.disagreements).toEqual([])
    expect(a.reading.instruments[0].purchasePrice?.value).toBe(519000)
    expect(a.formIndexes).toEqual([0])
  })

  it('drops a value the two read differently, or only one found, and lists it for a person', () => {
    const a = agreeReadings(doc(519000, 10), doc(591000, null))
    expect(a.reading.instruments[0].purchasePrice).toBeNull()
    expect(a.reading.instruments[0].inspectionDays).toBeNull()
    expect(a.disagreements.map((d) => [d.field, d.first, d.second])).toEqual([
      ['purchasePrice', 519000, 591000],
      ['inspectionDays', 10, null],
    ])
  })

  it('uses nothing from a form the two readers identified differently', () => {
    const a = agreeReadings(doc(519000, 10, 'counteroffer'), doc(519000, 10, 'addendum'))
    expect(a.reading.instruments).toEqual([])
    expect(a.unmatched).toBe(1)
  })
})

describe('planTermsWrite', () => {
  const empty: CycleTermColumns = {
    sale_price: null,
    earnest_money: null,
    contract_acceptance_date: null,
    escrow_closing_date: null,
    inspection_days: null,
    financing_days: null,
    escrow_company: null,
    escrow_number: null,
    buyers: [],
    sellers: [],
  }
  const terms = resolveCycleTerms(FILE, { buyers: NICOLL, contractAcceptanceDate: null })

  it('fills every empty field from the executed agreement', () => {
    const p = planTermsWrite(terms, empty)
    const by = Object.fromEntries(p.fills.map((f) => [f.column, f.value]))
    expect(by).toMatchObject({
      sale_price: 519000,
      earnest_money: { amount: 5000 },
      contract_acceptance_date: '2026-05-13',
      escrow_closing_date: '2026-06-23',
      inspection_days: 10,
      financing_days: 21,
      escrow_number: 'WT0286975',
      buyers: NICOLL,
      sellers: ['Mary Bowman'],
    })
    expect(p.conflicts).toEqual([])
  })

  it('leaves equal values alone and never overwrites a different one', () => {
    const p = planTermsWrite(terms, { ...empty, sale_price: 519000, escrow_number: 'wt-0286975', contract_acceptance_date: '2026-05-14', buyers: ['Tyler Nicoll'] })
    expect(p.same).toEqual(expect.arrayContaining(['sale_price', 'escrow_number', 'buyers']))
    expect(p.conflicts).toEqual([
      expect.objectContaining({ column: 'contract_acceptance_date', current: '2026-05-14', contract: '2026-05-13' }),
    ])
    expect(p.fills.map((f) => f.column)).not.toContain('contract_acceptance_date')
  })

  it('writes nothing from an offer nobody accepted', () => {
    const offerOnly = resolveCycleTerms([inst('countered', reading('sale_agreement', { buyers: NICOLL, purchasePrice: t(510000) }))], { buyers: NICOLL, contractAcceptanceDate: null })
    expect(planTermsWrite(offerOnly, empty)).toEqual({ fills: [], conflicts: [], same: [] })
  })
})

describe('looseSame (company names, possession wording)', () => {
  it('agrees on the same words transcribed differently, not on a clause that merely mentions the company', async () => {
    const { looseSame } = await import('./agree')
    expect(looseSame('Western Title & Escrow Company', 'Western Title and Escrow')).toBe(true)
    expect(looseSame('by 5:00 p.m. on the date of Closing', 'By 5:00 PM on the date of closing')).toBe(true)
    expect(looseSame('Western Title', 'Bend Premier Real Estate, Ryan Realty LLC and Western Title')).toBe(false)
    expect(looseSame('Amerititle - Jeff Schopfer', 'Western Title and Escrow - Tonya Moore')).toBe(false)
  })
})
