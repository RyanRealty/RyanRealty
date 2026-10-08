/**
 * Seller net sheet math (brief 2026-10-08 section 9, accept test 4). Every
 * expected value is the brief's, checked against the Deschutes County Title
 * card's Basic Rate and Sale (Total Fee) columns, and the worked example must
 * equal the cost-to-sell guide's figures to the dollar.
 */
import { describe, expect, it } from 'vitest'
import { COST_TO_SELL_INPUTS, costToSellFigures, otiroStandardOwnersPolicy } from '@/lib/blog/cost-to-sell'
import {
  addDays,
  escrowSeller,
  escrowTotal,
  exampleClosingDate,
  netSheet,
  netSheetExample,
  otiroBasic,
  recordingReleases,
  taxBillCanBePaid,
  taxProration,
  taxYearShare,
  validateNetSheet,
  type NetSheetInput,
} from './seller-net-sheet'

const BASE: NetSheetInput = {
  price: 765_000,
  buyerAgent: { mode: 'pct', value: 0 },
  loans: 1,
  pagesPerRelease: 1,
  payoff: null,
  closingDate: '2026-10-30',
  annualTax: 5_340,
  paidInFull: false,
  hoaFees: 0,
  otherCosts: 0,
}

describe('otiroBasic (OTIRO Schedule One)', () => {
  it.each([
    [25_000, 200],
    [250_000, 825],
    [400_000, 1_150],
    [500_000, 1_350],
    [765_000, 1_748],
    [1_000_000, 2_100],
  ])('%i -> %i', (price, rate) => {
    expect(otiroBasic(price)).toBe(rate)
  })

  it('charges each $1,000 and fraction, and rounds half up', () => {
    expect(otiroBasic(25_001)).toBe(204)
    expect(otiroBasic(765_000)).toBe(1_748) // 1,747.50
    expect(otiroBasic(10_000_000)).toBe(15_600)
    expect(otiroBasic(10_000_001)).toBe(15_601) // 15,601.25
  })

  it("matches the cost-to-sell guide's bracket everywhere it is defined", () => {
    for (let p = 500_001; p <= 2_000_000; p += 7_919) {
      expect(otiroBasic(p)).toBe(otiroStandardOwnersPolicy(p))
    }
  })
})

describe('escrow (Deschutes County Title, Sale Total Fee)', () => {
  it.each([
    [95_000, 800],
    [100_000, 850],
    [300_000, 1_400],
    [765_000, 2_679],
    [1_000_000, 3_325],
  ])('total at %i -> %i', (price, fee) => {
    expect(escrowTotal(price)).toBe(fee)
  })

  it('reads the card row at or above the price', () => {
    expect(escrowTotal(761_000)).toBe(escrowTotal(765_000))
  })

  it("seller's half at 765,000 -> 1,340", () => {
    expect(escrowSeller(765_000)).toBe(1_340)
  })

  it('matches the escrow total the guide pins', () => {
    expect(escrowTotal(COST_TO_SELL_INPUTS.medianSalePrice)).toBe(COST_TO_SELL_INPUTS.escrowSaleTotalFee)
  })
})

describe('recording', () => {
  it('one loan, one page -> 102; two loans, two pages -> 214; no loan -> 0', () => {
    expect(recordingReleases(1, 1)).toBe(102)
    expect(recordingReleases(2, 2)).toBe(214)
    expect(recordingReleases(0, 3)).toBe(0)
  })
})

describe('property-tax proration', () => {
  it('5,340 unpaid, closing 2026-10-30 -> 1,785 (122 of 365 days)', () => {
    const p = taxProration(5_340, '2026-10-30', false)!
    expect(p.debit).toBe(1_785)
    expect(p.share).toEqual({ taxYearStart: '2026-07-01', taxYearDays: 365, sellerDays: 122 })
  })

  it('paid in full credits the buyer share back', () => {
    const p = taxProration(5_340, '2026-10-30', true)!
    expect(p.debit).toBe(0)
    expect(p.credit).toBe(Math.round((5_340 * 243) / 365))
  })

  it('uses the tax year that holds the closing, with 366 days when it holds a Feb 29', () => {
    expect(taxYearShare('2027-03-15')).toEqual({ taxYearStart: '2026-07-01', taxYearDays: 365, sellerDays: 258 })
    expect(taxYearShare('2028-01-01')!.taxYearDays).toBe(366)
    expect(taxYearShare('2026-07-01')!.sellerDays).toBe(1)
  })

  it('a bill cannot be paid before late October', () => {
    expect(taxBillCanBePaid('2026-07-01')).toBe(false)
    expect(taxBillCanBePaid('2026-10-24')).toBe(false)
    expect(taxBillCanBePaid('2026-10-25')).toBe(true)
    expect(taxBillCanBePaid('2027-03-01')).toBe(true)
  })
})

describe('net', () => {
  it('765,000 at 0% -> 737,050; at 2.5% -> 717,925', () => {
    expect(netSheet(BASE).netBeforePayoff).toBe(737_050)
    expect(netSheet({ ...BASE, buyerAgent: { mode: 'pct', value: 2.5 } }).netBeforePayoff).toBe(717_925)
  })

  it('cost of the sale 26,165 (3.4%) and 45,290 (5.9%)', () => {
    const low = netSheet(BASE)
    const high = netSheet({ ...BASE, buyerAgent: { mode: 'pct', value: 2.5 } })
    expect(low.costOfSale).toBe(26_165)
    expect(high.costOfSale).toBe(45_290)
    expect((Math.round(low.costShare * 1000) / 10).toFixed(1)).toBe('3.4')
    expect((Math.round(high.costShare * 1000) / 10).toFixed(1)).toBe('5.9')
  })

  it('subtracts the payoff, HOA fees, and credits, and takes buyer-agent dollars', () => {
    const s = netSheet({ ...BASE, payoff: 400_000, hoaFees: 500, otherCosts: 2_000, buyerAgent: { mode: 'usd', value: 10_000 } })
    expect(s.buyerAgent).toBe(10_000)
    expect(s.netBeforePayoff).toBe(737_050 - 10_000 - 500 - 2_000)
    expect(s.net).toBe(s.netBeforePayoff - 400_000)
  })

  it('flags escrow above the card as illustrative', () => {
    expect(netSheet({ ...BASE, price: 1_000_000 }).escrowIllustrative).toBe(false)
    expect(netSheet({ ...BASE, price: 1_250_000 }).escrowIllustrative).toBe(true)
  })
})

describe('validation', () => {
  it('passes the default sheet', () => {
    expect(validateNetSheet(BASE)).toEqual({})
  })

  it('reports out-of-range inputs instead of computing NaN', () => {
    const e = validateNetSheet({
      ...BASE,
      price: 10_000,
      buyerAgent: { mode: 'pct', value: 7 },
      loans: 3,
      pagesPerRelease: 0,
      payoff: Number.NaN,
      closingDate: '2026-02-30',
      annualTax: -1,
      hoaFees: Number.NaN,
      otherCosts: -5,
    })
    expect(Object.keys(e).sort()).toEqual(
      ['annualTax', 'buyerAgent', 'closingDate', 'hoaFees', 'loans', 'otherCosts', 'pagesPerRelease', 'payoff', 'price'].sort(),
    )
    for (const msg of Object.values(e)) expect(msg).not.toMatch(/NaN|undefined/)
  })
})

describe('dates', () => {
  it('an Oct 8 example closes Oct 30; late in a month rolls to the next 30th; February ends the month', () => {
    expect(exampleClosingDate('2026-10-08')).toBe('2026-10-30')
    expect(exampleClosingDate('2026-10-31')).toBe('2026-11-30')
    expect(exampleClosingDate('2027-02-03')).toBe('2027-02-28')
    expect(exampleClosingDate('2028-02-03')).toBe('2028-02-29')
    expect(exampleClosingDate('2026-12-30')).toBe('2027-01-30')
  })

  it('adds days across months and years', () => {
    expect(addDays('2026-10-08', 30)).toBe('2026-11-07')
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('worked example', () => {
  it("equals the cost-to-sell guide's figures to the dollar", () => {
    const ex = netSheetExample(COST_TO_SELL_INPUTS.medianSalePrice, COST_TO_SELL_INPUTS.figuresAsOf)!
    const guide = costToSellFigures()
    expect(ex.closingDate).toBe('2026-10-30')
    expect(ex.low.price).toBe(guide.price)
    expect(ex.low.listingFee).toBe(guide.listingFee)
    expect(ex.high.buyerAgent).toBe(guide.buyerAgentIllustrative)
    expect(ex.low.ownersTitlePolicy).toBe(guide.ownersTitlePolicy)
    expect(ex.low.escrowSeller).toBe(guide.escrowSellerHalf)
    expect(ex.low.lienSearch).toBe(guide.lienSearch)
    expect(ex.low.recording).toBe(guide.recordingRelease)
    expect(ex.low.costOfSale).toBe(guide.totalWithoutBuyerAgent)
    expect(ex.high.costOfSale).toBe(guide.totalWithBuyerAgent)
    expect(ex.fixedCosts).toBe(guide.fixedCosts)
    expect(ex.annualTax).toBe(guide.annualTaxIllustrative)
    expect(ex.low.taxDebit).toBe(guide.prorationIllustrative)
    expect(ex.low.netBeforePayoff).toBe(737_050)
    expect(ex.high.netBeforePayoff).toBe(717_925)
  })

  it('recomputes every figure at a different median', () => {
    const ex = netSheetExample(780_000, '2026-11-05')!
    expect(ex.closingDate).toBe('2026-11-30')
    expect(ex.low.ownersTitlePolicy).toBe(otiroBasic(780_000))
    expect(ex.low.escrowSeller).toBe(escrowSeller(780_000))
    expect(ex.low.netBeforePayoff).toBe(780_000 - ex.low.costOfSale - ex.low.taxDebit)
  })
})
