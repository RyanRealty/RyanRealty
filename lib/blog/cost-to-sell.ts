/**
 * /blog/cost-to-sell-house-bend-oregon: the seller cost guide and its worked
 * dollar example (AIV #1, SEO & AEO Desk brief 2026-10-08,
 * /workspace/search-content/brief-cost-to-sell-worked-example-2026-10-08.md).
 *
 * Answer engines already cite this page for the transfer-tax and buyer-agent
 * lines but take their dollar totals from calculators elsewhere, because the
 * page stated no worked total. This module is the page body, with one worked
 * example at Bend's 12-month median sale price.
 *
 * EVERY NUMBER IS COMPUTED HERE FROM A NAMED INPUT, and every input names its
 * source (brief section 0, T0 to T9). Nothing on the page is typed by hand, so a
 * monthly median refresh is a change to COST_TO_SELL_INPUTS (price, as-of day,
 * and the escrow card row for the new price) and the copy follows. The 2.5%
 * buyer's-agent figure and the tax proration are ILLUSTRATIVE and say so on the
 * page; neither is a typical, standard, or average rate. The closing count in
 * the median's window is deliberately not printed (it moves daily).
 *
 * Publishing path is unchanged: scripts/blog-content/aeo-guides-2026-09.ts
 * seeds this into public.blog_posts. Seed this one post only:
 *   npx tsx scripts/seed-blog-posts.ts --only aeo-guides-2026-09 --slug cost-to-sell-house-bend-oregon
 */
import type { BlogFaqItem } from '@/lib/blog/publish-blog-faq'
import {
  COST_TO_SELL_INPUTS,
  otiroStandardOwnersPolicy,
  type CostToSellInputs,
} from '@/lib/blog/cost-to-sell-inputs'

export const COST_TO_SELL_SLUG = 'cost-to-sell-house-bend-oregon'
export const COST_TO_SELL_HREF = `/blog/${COST_TO_SELL_SLUG}` as const

export { COST_TO_SELL_INPUTS, otiroStandardOwnersPolicy, type CostToSellInputs }

export type CostToSellFigures = {
  price: number
  listingFee: number
  buyerAgentIllustrative: number
  ownersTitlePolicy: number
  lienSearch: number
  escrowSellerHalf: number
  escrowSaleTotal: number
  recordingRelease: number
  transferTax: number
  totalWithoutBuyerAgent: number
  totalWithBuyerAgent: number
  /** Title, escrow half, lien search, and recording: the lines that are not commission. */
  fixedCosts: number
  annualTaxIllustrative: number
  prorationIllustrative: number
}

/** The worked example, line by line (brief section 3 formulas). */
export function costToSellFigures(inputs: CostToSellInputs = COST_TO_SELL_INPUTS): CostToSellFigures {
  const price = inputs.medianSalePrice
  const listingFee = Math.round(price * inputs.listingFeeRate)
  const buyerAgentIllustrative = Math.round(price * inputs.illustrativeBuyerAgentRate)
  const ownersTitlePolicy = otiroStandardOwnersPolicy(price)
  const lienSearch = inputs.lienSearchFee
  const escrowSellerHalf = Math.round(inputs.escrowSaleTotalFee / 2)
  const recordingRelease = inputs.recordingFirstPage
  const transferTax = 0
  const fixedCosts = ownersTitlePolicy + lienSearch + escrowSellerHalf + recordingRelease
  const totalWithoutBuyerAgent = listingFee + fixedCosts + transferTax
  const annualTaxIllustrative = Math.round(price * inputs.illustrativeEffectiveTaxRate)
  return {
    price,
    listingFee,
    buyerAgentIllustrative,
    ownersTitlePolicy,
    lienSearch,
    escrowSellerHalf,
    escrowSaleTotal: inputs.escrowSaleTotalFee,
    recordingRelease,
    transferTax,
    totalWithoutBuyerAgent,
    totalWithBuyerAgent: totalWithoutBuyerAgent + buyerAgentIllustrative,
    fixedCosts,
    annualTaxIllustrative,
    prorationIllustrative: Math.round((inputs.illustrativeProrationDays / 365) * annualTaxIllustrative),
  }
}

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`
/** "about $26,200": the answer block rounds to the nearest hundred and says "about". */
const usdHundreds = (n: number): string => usd(Math.round(n / 100) * 100)
const pct = (n: number): string => `${Number((n * 100).toFixed(1))}%`
const share = (part: number, whole: number): string => pct(part / whole)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "Oct 8, 2026" from a YYYY-MM-DD civil day, with no clock and no time zone to shift it. */
export function asOfLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

const F = costToSellFigures()
const I = COST_TO_SELL_INPUTS
const AS_OF = asOfLabel(I.figuresAsOf)
const LISTING = pct(I.listingFeeRate)
const BUYER_AGENT = pct(I.illustrativeBuyerAgentRate)
const SHARE_LOW = share(F.totalWithoutBuyerAgent, F.price)
const SHARE_HIGH = share(F.totalWithBuyerAgent, F.price)

/** Visible FAQ and FAQPage JSON-LD, word for word (brief section 6). Q2, Q3, Q5 are the live copy. */
export const COST_TO_SELL_FAQS: readonly BlogFaqItem[] = [
  {
    question: 'How much does it cost to sell a house in Bend?',
    answer: `On a ${usd(F.price)} home, Bend's median sale price over the last 12 months as of ${AS_OF}, the sale costs about ${usd(F.totalWithoutBuyerAgent)} (${SHARE_LOW}) with our ${LISTING} listing fee if you don't cover the buyer's agent, or about ${usd(F.totalWithBuyerAgent)} (${SHARE_HIGH}) if you agree to cover an illustrative ${BUYER_AGENT}. Title, escrow, the lien search, and recording add about ${usd(F.fixedCosts)} of that. Your loan payoff and prorated property taxes come out of proceeds too, and we itemize all of it on a seller net sheet before you accept an offer.`,
  },
  {
    question: "What does Ryan Realty's 3% listing plan include?",
    answer:
      'The listing fee is 3% of the sale price with no add-on fees. It covers the MLS listing, professional photography, a 3D tour, the marketing plan, every showing, weekly written reports, remote-owner care, and transaction management through close.',
  },
  {
    question: "Who pays the buyer's agent now?",
    answer:
      'The buyer agrees to a fee with their own agent in a written agreement before touring. Whether the seller covers some or all of it is negotiated in each offer. Since August 2024 that offer no longer appears in the MLS, so it is a term of the contract, decided offer by offer.',
  },
  {
    question: 'Does Oregon charge a real estate transfer tax?',
    answer:
      "No, not in Deschutes County. Oregon law (ORS 306.815) bars cities and counties from adding a transfer tax, and the only one in effect is Washington County's, which predates the ban and is $1 per $1,000 of the price.",
  },
  {
    question: 'What other seller costs show up at closing?',
    answer:
      "The owner's title insurance policy, the seller's share of the escrow fee, the recording fee for the release of your mortgage, prorated property taxes through closing day, your loan payoff, HOA transfer fees if the home is in an association, and any credit to the buyer you agreed to in the contract.",
  },
  {
    question: "How much is the owner's title insurance policy when I sell in Bend?",
    answer: `Oregon title premiums are filed rates, so every title company charges the same. A standard owner's policy on a ${usd(F.price)} sale is ${usd(F.ownersTitlePolicy)} under the Oregon Title Insurance Rating Organization manual effective Sept. 1, 2025, and in Central Oregon the seller customarily pays it.`,
  },
  {
    question: 'What does escrow cost a seller in Bend?',
    answer: `Deschutes County Title's published rate card (revised March 2023) lists a ${usd(F.escrowSaleTotal)} sale escrow fee at ${usd(F.price)}. The fee is customarily split 50/50, so the seller's share is about ${usd(F.escrowSellerHalf)}. Ask the escrow company for a current quote, because the contract decides the split.`,
  },
  {
    question: 'Are property taxes part of the cost to sell?',
    answer:
      "Not as a fee. Escrow splits the July-through-June tax year to the closing day, so you pay only for the days you owned the home. If the year's bill is unpaid at closing, your share comes out of proceeds; if you've paid it, the buyer's share comes back to you.",
  },
]

/** Answer-first block (brief section 4). render-blog-post lifts it above the rail. */
export const COST_TO_SELL_ANSWER = `Selling a ${usd(F.price)} home in Bend, which is the city's median sale price over the last 12 months, costs about ${usdHundreds(F.totalWithoutBuyerAgent)} to ${usdHundreds(F.totalWithBuyerAgent)}, or ${SHARE_LOW} to ${SHARE_HIGH} of the price, before your loan payoff and property-tax proration. The low end is our ${LISTING} listing fee plus about ${usdHundreds(F.fixedCosts)} for the owner's title policy, your half of escrow, the lien search, and recording the release of your mortgage. The high end adds ${BUYER_AGENT} if you agree to cover the buyer's agent, an illustrative figure because that fee is negotiated offer by offer, and Deschutes County charges no transfer tax. To the dollar, the table below totals ${usd(F.totalWithoutBuyerAgent)} to ${usd(F.totalWithBuyerAgent)}, including ${usd(F.ownersTitlePolicy)} for the owner's title policy.`

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const row = (label: string, low: string, high: string): string =>
  `<tr><th scope="row">${label}</th><td>${low}</td><td>${high}</td></tr>`

const TABLE = `<table>
<caption>Seller costs on a ${usd(F.price)} Bend sale, as of ${AS_OF}</caption>
<thead><tr><th scope="col">Line</th><th scope="col">If you don't cover the buyer's agent</th><th scope="col">If you cover ${BUYER_AGENT} (illustrative)</th></tr></thead>
<tbody>
${row(`Ryan Realty listing fee, ${LISTING}`, usd(F.listingFee), usd(F.listingFee))}
${row("Buyer's-agent compensation", usd(0), `${usd(F.buyerAgentIllustrative)} (illustrative)`)}
${row("Owner's title policy, standard coverage", usd(F.ownersTitlePolicy), usd(F.ownersTitlePolicy))}
${row('Local government lien search', usd(F.lienSearch), usd(F.lienSearch))}
${row('Escrow fee, your half', usd(F.escrowSellerHalf), usd(F.escrowSellerHalf))}
${row('Recording the release of your mortgage', usd(F.recordingRelease), usd(F.recordingRelease))}
${row('Transfer tax', usd(F.transferTax), usd(F.transferTax))}
</tbody>
<tfoot>
${row('Total cost of the sale', usd(F.totalWithoutBuyerAgent), usd(F.totalWithBuyerAgent))}
${row('Share of price', SHARE_LOW, SHARE_HIGH)}
</tfoot>
</table>`

const QUESTIONS = COST_TO_SELL_FAQS.map(
  (faq) => `<h3>${escapeHtml(faq.question)}</h3>\n<p>${escapeHtml(faq.answer)}</p>`,
).join('\n')

export const COST_TO_SELL_CONTENT = `
<div class="v3-blog-answer" data-figures-as-of="${I.figuresAsOf}">
<p>${COST_TO_SELL_ANSWER}</p>
<p class="v3-blog-answer-source">Median: Ryan Realty, Oregon Data Share MLS, single-family, as of ${AS_OF} (<a href="/housing-market/bend">Bend housing market</a>). Line-item sources are under the table below.</p>
</div>
<p>Sellers compare cost before they compare marketing, and they should. The costs of selling a home in Bend fall into a few buckets, most of them are knowable before you list, and one of them is negotiable in a way it was not a few years ago. Here is each line and who pays it.</p>

<h2>The big buckets</h2>
<ul>
<li>The listing fee you agree to with your broker.</li>
<li>Buyer-agent compensation, if you agree to offer it.</li>
<li>Title insurance, escrow, and recording.</li>
<li>Prorated property taxes, your loan payoff, and any HOA transfer fees.</li>
<li>Prep and repairs, plus anything you agree to credit the buyer after inspection.</li>
</ul>

<h2>A worked example at Bend's median price</h2>
<p>Here is every line on a ${usd(F.price)} sale, Bend's median single-family sale price over the last 12 months in our MLS data, as of ${AS_OF}. The only line that changes much from one sale to the next is the buyer's agent, so we show it both ways.</p>
${TABLE}
<p>Not in the total: your loan payoff, <a href="/blog/property-taxes-deschutes-county">prorated property taxes</a>, any HOA transfer fee, and anything you agree to credit the buyer. On an October 30 closing with the 2026\u201327 tax bill still unpaid, your share of a roughly ${usd(F.annualTaxIllustrative)} annual bill would be about ${usd(F.prorationIllustrative)}. That is illustrative, so use your own bill on DIAL. If you have already paid the year, the buyer's share comes back to you.</p>
<p>Where the numbers come from: the ${LISTING} is our listing fee. The owner's title premium is the rate filed for Oregon by the Oregon Title Insurance Rating Organization (manual effective Sept. 1, 2025), so every title company charges the same premium. The escrow fee is from Deschutes County Title's published rate card (revised March 2023), split 50/50 by local custom, so ask for a current quote. Recording is the Deschutes County Clerk's fee effective July 1, 2026. Oregon law (ORS 306.815) bars new local transfer taxes, and Washington County's is the only one in the state. The ${BUYER_AGENT} is an example, not a standard rate. Commission is negotiable.</p>
<p>Your number depends on whether, and how much, you agree to cover the buyer's agent in the offer you accept.</p>
<p><a href="/tools/seller-net-sheet">Run your own numbers</a> in our seller net sheet, with your price, payoff, and tax bill.</p>

<h2>Listing fee versus buyer-agent compensation</h2>
<p>These used to be one number. They are two now. Our listing fee is 3% of the sale price with no add-on fees, and it covers the MLS listing, professional photography, a 3D tour, the marketing plan, every showing, and transaction management through close. Buyer-agent compensation is separate. Under the rules that took effect in August 2024, offers of compensation to the buyer's agent no longer appear in the MLS, and buyers sign a <a href="/blog/buyers-agent-bend-buyer-broker-agreement">written agreement</a> with their own agent that states what that agent will be paid. Whether you offer to cover some or all of that is a term of each offer, and you decide it offer by offer. We walk you through the trade before the first one arrives. Commission is negotiable and every listing agreement is its own conversation.</p>
<p>More on commission in Bend: <a href="/blog/real-estate-commission-bend-oregon">real estate commission in Bend, Oregon</a>, our fee in dollars and the Oregon rules.</p>

<h2>Title, escrow, and recording</h2>
<p>Oregon has no state real estate transfer tax outside of Washington County, so in Deschutes County that line is zero. Title insurance premiums in Oregon are filed with the state, so the owner's policy is a published figure for the sale price, and in Central Oregon practice the seller customarily pays for it. The escrow fee is customarily split between buyer and seller. Deschutes County charges ${usd(I.recordingFirstPage)} to record the first page of a document, ${usd(I.recordingAdditionalPage)} for each additional page. On the seller's side that's usually the release of your mortgage; the deed itself is normally recorded on the buyer's side. Contract terms control. Your escrow officer quotes each of these from a published schedule before you sign, and they show up as line items on your settlement statement.</p>

<h2>Prorations, payoffs, and the HOA</h2>
<p>Property taxes are prorated to the closing day on Oregon's July-through-June tax year, so you pay your share of the current year. Your mortgage is paid off from the proceeds, along with a small fee to record the release. If the home is in a homeowners association, the association's own fee schedule sets what it charges for the transfer and the document package, and some Bend communities charge a percentage of the sale price. Our <a href="/blog/hoa-guide-central-oregon">HOA guide</a> covers what to ask for.</p>
<p>Oregon withholding applies only to nonresident sellers. It is not a fee; it is a tax prepayment, and Oregon residents are exempt. Our <a href="/blog/oregon-withholding-firpta-home-sellers">withholding guide</a> explains it.</p>

<h2>Prep, marketing, and what is included</h2>
<p>Photography, the 3D tour, the marketing, and the showings are inside the 3% fee. What is not inside it is the work on the house: repairs, cleaning, staging, and anything you decide to fix before listing. We give you a list with what each item is likely to cost and whether it changes the price, and you decide. Our <a href="/blog/preparing-home-for-sale-checklist">pre-listing checklist</a> separates the fixes that matter from the ones that only change the photos.</p>

<h2>What the settlement statement looks like</h2>
<p>Before you accept an offer, we send a seller net sheet: the offered price, the listing fee, any buyer-agent compensation you agreed to, title and escrow, prorations, your payoff, and any credit to the buyer, with the net at the bottom. That is the number to plan around. When the final settlement statement arrives from escrow, it should match the net sheet within the prorations, and we go through it with you line by line.</p>

<h2>Questions</h2>
${QUESTIONS}

<h2>Sources</h2>
<ul>
<li>Ryan Realty, <a href="/housing-market/bend">Bend housing market</a> (Oregon Data Share MLS), as of ${AS_OF}</li>
<li>Oregon Title Insurance Rating Organization, Oregon Rating Manual, effective Sept. 1, 2025 (\u00a71.008(A) county lien search table, ${usd(I.lienSearchFee)} per account in Deschutes; \u00a72.010, \u00a73.002, Schedule One): <a href="https://wfgunderwriting.com/wp-content/uploads/filebase/oregon/rates/OTIRO%20Rate%20Manual%20effective%20%209-1-2025.pdf" target="_blank" rel="noopener nofollow">rating manual PDF</a></li>
<li>Deschutes County Title, Central Oregon Rates for Deschutes County (rate card, revised 03/2023): <a href="https://deschutescountytitle.com/wp-content/uploads/2023/04/Rate-Cards-Deschutes-County.pdf" target="_blank" rel="noopener nofollow">rate card PDF</a></li>
<li>Deschutes County Clerk, Recording Fees, effective July 1, 2026 (Ordinance 2026-003): <a href="https://www.deschutescounty.gov/531/Recording-Fees" target="_blank" rel="noopener nofollow">Recording Fees</a></li>
<li>AmeriTitle, Closing Costs: Homeowner Manual (Nov. 2019), for who customarily records the deed and the mortgage release: <a href="https://www.amerititle.com/2019/11/closing-costs-homeowner-manual/" target="_blank" rel="noopener nofollow">homeowner guide</a></li>
<li>ORS 306.815, Tax on transfer of real property prohibited; exceptions: <a href="https://www.oregonlegislature.gov/bills_laws/ors/ors306.html" target="_blank" rel="noopener nofollow">Oregon Revised Statutes, chapter 306</a></li>
<li>Washington County, Transfer Tax: <a href="https://www.washingtoncountyor.gov/at/recording/transfer-tax-exemption" target="_blank" rel="noopener nofollow">transfer tax</a></li>
<li>Oregon Department of Revenue, FY 2025-26 Oregon Property Tax Statistics Report (via our <a href="/blog/property-taxes-deschutes-county">property-tax guide</a>)</li>
</ul>

<h2>Next step</h2>
<p><a href="/sell">Value my home</a> starts with your address. The <a href="/sell/valuation">written valuation</a> is free and comes with a net sheet at the recommended price.</p>
<p>Buying instead? <a href="/blog/closing-costs-buyers-bend-oregon">Buyer closing costs in Bend</a>.</p>
`

export const COST_TO_SELL_SEO_DESCRIPTION = `Selling a ${usd(F.price)} Bend home costs about ${usdHundreds(F.totalWithoutBuyerAgent)}\u2013${usdHundreds(F.totalWithBuyerAgent)} (${SHARE_LOW}\u2013${SHARE_HIGH}). Every line: listing fee, buyer's agent, title, escrow, recording. No transfer tax.`

/** The blog_posts row this guide seeds (scripts/blog-content/aeo-guides-2026-09.ts). */
export function costToSellSeed() {
  return {
    title: 'What It Costs to Sell a House in Bend (and Oregon)',
    slug: COST_TO_SELL_SLUG,
    category: 'Selling Guides',
    tags: ['cost to sell', 'seller closing costs', 'commission', 'bend', 'oregon'],
    hero_image_url: '/images/blog/cost-to-sell-house-bend-oregon.jpg',
    author_broker_id: '2fda6811-2edf-49e3-b3ca-33e1052f82e6',
    published_at: '2026-09-07T16:00:00Z',
    status: 'published' as const,
    // The live title since supabase/migrations/20261005150000_blog_seo_titles_fit_serp.sql.
    // Re-seeding must not put the old 60+ character title back.
    seo_title: 'Cost to Sell a House in Bend, Oregon',
    seo_description: COST_TO_SELL_SEO_DESCRIPTION,
    excerpt:
      'The listing fee, buyer-agent compensation under the current rules, title and escrow, recording, prorations, and what is included. Oregon has no transfer tax, and we show the net before you accept.',
    content: COST_TO_SELL_CONTENT,
  }
}
