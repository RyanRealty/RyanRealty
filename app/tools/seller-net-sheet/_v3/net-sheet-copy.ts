/**
 * The crawlable copy on /tools/seller-net-sheet (SEO & AEO Desk brief
 * 2026-10-08, sections 3, 5, and 7), built from one worked example so every
 * figure in the answer, the table, the notes, and the FAQ is the same number.
 * Pure: the page passes the example in; nothing here reads data or the clock.
 *
 * Commission is never called typical, standard, or average. The 2.5% column,
 * the property-tax line, and an escrow row above the rate card say
 * "illustrative".
 */
import { formatPriceExact } from '@/lib/format/money'
import { NET_SHEET_RATES, parseCivilDay, type NetSheetExample } from '@/lib/tools/seller-net-sheet'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const usd = (n: number): string => formatPriceExact(Math.round(n))
/** A deduction: U+2212 minus before the dollar sign. Zero prints plain. */
export const minus = (n: number): string => (Math.round(n) === 0 ? usd(0) : `\u2212${usd(n)}`)
const pct1 = (share: number): string => `${(Math.round(share * 1000) / 10).toFixed(1)}%`
const ratePct = (rate: number): string => `${Number((rate * 100).toFixed(3))}%`

/** "Oct 8, 2026" */
export function dayLabel(ymd: string): string {
  const d = parseCivilDay(ymd)
  return d ? `${MONTHS[d.m - 1]} ${d.d}, ${d.y}` : ymd
}

/** "Oct 30" */
function monthDay(ymd: string): string {
  const d = parseCivilDay(ymd)
  return d ? `${MONTHS[d.m - 1]} ${d.d}` : ymd
}

/** "an Oct 30", "a Nov 30": the article the spoken month takes. */
function withArticle(label: string): string {
  return /^(Apr|Aug|Oct)\b/.test(label) ? `an ${label}` : `a ${label}`
}

/** "a $765,000", "an $800,000": the article the spoken amount takes. */
function priceWithArticle(price: number): string {
  const digits = String(Math.round(price))
  const millions = Math.floor(price / 1_000_000)
  const vowel = digits.startsWith('8') || millions === 11 || millions === 18
  return `${vowel ? 'an' : 'a'} ${usd(price)}`
}

export type NetSheetCopy = {
  asOfLabel: string
  closingLabel: string
  answer: string
  intro: string
  caption: string
  lowHeader: string
  highHeader: string
  rows: NetSheetRow[]
  taxNote: string
  whereFrom: string
  faqs: { question: string; answer: string }[]
  metaDescription: string
}

export type NetSheetRow = {
  line: string
  low: string
  high: string
  /** Bold rows: the cost of the sale and the net. */
  total?: boolean
  /** One cell across both columns (the payoff row). */
  span?: boolean
}

export function netSheetCopy(ex: NetSheetExample): NetSheetCopy {
  const { low, high } = ex
  const P = usd(low.price)
  const asOfLabel = dayLabel(ex.asOf)
  const closingLabel = dayLabel(ex.closingDate)
  const closingShort = monthDay(ex.closingDate)
  const listingPct = `${Number((NET_SHEET_RATES.listingFeeRate * 100).toFixed(2))}%`
  const agentPct = `${Number((NET_SHEET_RATES.illustrativeBuyerAgentRate * 100).toFixed(2))}%`
  const taxStartYear = low.taxShare ? Number(low.taxShare.taxYearStart.slice(0, 4)) : null
  const taxYear = taxStartYear ? `${taxStartYear}\u2013${String((taxStartYear + 1) % 100).padStart(2, '0')}` : 'current'
  const share = low.taxShare

  const answer =
    `On ${priceWithArticle(low.price)} Bend home, the city's median sale price over the last 12 months, you'd walk away with about ${usd(low.netBeforePayoff)} before paying off your mortgage, ` +
    `or about ${usd(high.netBeforePayoff)} if you agree to cover an illustrative ${agentPct} for the buyer's agent. ` +
    `That's the price minus our ${listingPct} listing fee (${usd(low.listingFee)}), about ${usd(ex.fixedCosts)} for the owner's title policy, your half of escrow, the lien search, and recording your mortgage release, ` +
    `and an illustrative ${usd(low.taxDebit)} property-tax share for ${withArticle(closingShort)} closing, and Deschutes County charges no transfer tax.`

  const intro =
    `Here is the net sheet for ${priceWithArticle(low.price)} sale, Bend's median single-family sale price over the last 12 months in Oregon Data Share MLS data as of ${asOfLabel}, ` +
    `closing ${closingLabel}, with one mortgage to release and the ${taxYear} tax bill not yet paid. ` +
    `The buyer's-agent line is shown both ways because it's negotiated offer by offer.`

  const caption = `Seller net sheet on ${priceWithArticle(low.price)} Bend sale, as of ${asOfLabel}`

  const escrowCell = (n: number) => (low.escrowIllustrative ? `${minus(n)} (illustrative)` : minus(n))
  const taxRange = share ? `Jul 1\u2013${closingShort}` : 'through closing'
  const rows: NetSheetRow[] = [
    { line: 'Sale price', low: P, high: P },
    { line: `Ryan Realty listing fee, ${listingPct}`, low: minus(low.listingFee), high: minus(high.listingFee) },
    { line: "Buyer's-agent compensation", low: usd(0), high: `${minus(high.buyerAgent)} (illustrative)` },
    { line: "Owner's title policy, standard coverage", low: minus(low.ownersTitlePolicy), high: minus(high.ownersTitlePolicy) },
    { line: 'Escrow fee, your half (2023 rate card, ask for a current quote)', low: escrowCell(low.escrowSeller), high: escrowCell(high.escrowSeller) },
    { line: 'Local government lien search', low: minus(low.lienSearch), high: minus(high.lienSearch) },
    { line: 'Recording your mortgage release (1 page)', low: minus(low.recording), high: minus(high.recording) },
    { line: 'Transfer tax', low: usd(low.transferTax), high: usd(high.transferTax) },
    {
      line: 'Cost of the sale',
      low: `${minus(low.costOfSale)} (${pct1(low.costShare)})`,
      high: `${minus(high.costOfSale)} (${pct1(high.costShare)})`,
      total: true,
    },
    { line: `Property tax, your share ${taxRange} (illustrative)`, low: minus(low.taxDebit), high: minus(high.taxDebit) },
    { line: 'Net before your loan payoff', low: usd(low.netBeforePayoff), high: usd(high.netBeforePayoff), total: true },
    { line: 'Loan payoff', low: "From your lender's payoff statement", high: '', span: true },
  ]

  const taxNote =
    `The property-tax line is illustrative. It assumes a ${usd(ex.annualTax)} annual bill, which is the ${P} price at Deschutes County's ${ratePct(NET_SHEET_RATES.effectiveTaxRate)} average effective rate, ` +
    `and ${share?.sellerDays ?? 0} of ${share?.taxYearDays ?? 365} days in the July-through-June tax year. Use your own bill from DIAL. ` +
    `If you've already paid the year in full, the buyer's share comes back to you as a credit instead. ` +
    `HOA transfer fees, credits to the buyer, and repairs come out too, if you agree to them. ` +
    `Oregon withholding for nonresident sellers is a tax prepayment, not a cost.`

  const whereFrom =
    `Where the numbers come from: the ${listingPct} is our listing fee. The owner's title premium is the rate filed for Oregon by the Oregon Title Insurance Rating Organization (effective Sept. 1, 2025), so every title company charges the same premium. ` +
    `The escrow fee is from Deschutes County Title's published rate card (revised March 2023), split 50/50 by local custom, so ask for a current quote. ` +
    `Recording is the Deschutes County Clerk's fee effective July 1, 2026. Oregon law (ORS 306.815) bars new local transfer taxes. ` +
    `The ${agentPct} is an example, not a standard rate. Commission is negotiable.`

  const faqs = [
    {
      question: 'How much will I net if I sell my house in Bend?',
      answer:
        `On ${priceWithArticle(low.price)} home, Bend's median sale price over the last 12 months as of ${asOfLabel}, you'd net about ${usd(low.netBeforePayoff)} before your loan payoff if you don't cover the buyer's agent, ` +
        `or about ${usd(high.netBeforePayoff)} if you agree to cover an illustrative ${agentPct}. ` +
        `That's after our ${listingPct} listing fee, about ${usd(ex.fixedCosts)} in title, escrow, lien search, and recording, and an illustrative ${usd(low.taxDebit)} property-tax share on ${withArticle(closingShort)} closing. ` +
        `Enter your own price, payoff, and tax bill above for your number.`,
    },
    {
      question: 'What comes out of my proceeds when I sell in Bend?',
      answer:
        "The listing fee, any buyer's-agent compensation you agreed to in the offer, the owner's title insurance policy, your half of the escrow fee, the lien search, the fee to record the release of your mortgage, your share of the property taxes, any HOA transfer fees, any credits to the buyer, and your loan payoff. Deschutes County has no transfer tax.",
    },
    {
      question: "How much is owner's title insurance on a Bend sale?",
      answer: `Oregon title premiums are filed rates, so every title company charges the same. A standard owner's policy on ${priceWithArticle(low.price)} sale is ${usd(low.ownersTitlePolicy)} under the Oregon Title Insurance Rating Organization manual effective Sept. 1, 2025, and in Central Oregon the seller customarily pays it.`,
    },
    {
      question: 'Is there a transfer tax when I sell a house in Deschutes County?',
      answer:
        "No. Oregon law (ORS 306.815) bars cities and counties from adding a real estate transfer tax, and the only one in effect in Oregon is Washington County's, which predates the ban.",
    },
    {
      question: 'How accurate is this net sheet?',
      answer:
        "It's an estimate. The title premium and recording fee are published rates, the escrow fee comes from a 2023 rate card, and the property-tax default is an average, so swap in your own tax bill and get an escrow quote. Before you accept an offer, we send a net sheet built on that offer's actual terms.",
    },
  ]

  const metaDescription = `What you'd net selling a Bend home: ${priceWithArticle(low.price)} sale nets about ${usd(low.netBeforePayoff)} before your loan payoff. Title, escrow, recording, and our ${listingPct} fee, itemized.`

  return {
    asOfLabel,
    closingLabel,
    answer,
    intro,
    caption,
    lowHeader: "You don't cover the buyer's agent",
    highHeader: `You cover ${agentPct} (illustrative)`,
    rows, taxNote, whereFrom, faqs, metaDescription }
}
