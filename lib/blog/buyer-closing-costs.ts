/**
 * SITE-124 — buyer closing-costs page contract.
 *
 * Slug `/blog/closing-costs-buyers-bend-oregon` was 404 / OMIT on SITE-123.
 * Body and figures are the Sep 7 AEO guide (docs/plans/PUBLIC_PRODUCT/AEO_GUIDES_2026-09.md
 * §0 ledger, brief 7). Do not invent a percent-of-price total.
 */
import type { BlogFaqItem } from '@/lib/blog/publish-blog-faq'

export const BUYER_CLOSING_COSTS_SLUG = 'closing-costs-buyers-bend-oregon'
export const BUYER_CLOSING_COSTS_HREF = `/blog/${BUYER_CLOSING_COSTS_SLUG}` as const
export const BUYER_CLOSING_COSTS_LEGACY_SLUG = 'understanding-closing-costs-oregon'
export const BUYER_CLOSING_COSTS_TITLE = 'Closing Costs for Home Buyers in Bend, Oregon'
export const BUYER_CLOSING_COSTS_H1 = BUYER_CLOSING_COSTS_TITLE

export const BUYER_CLOSING_COSTS_AUTHOR_BROKER_ID = '2fda6811-2edf-49e3-b3ca-33e1052f82e6'
export const BUYER_CLOSING_COSTS_STABLE_ID = 'b1240000-c105-4e09-9c05-0000b1240c05'

/** §0 ledger — every $ / program % that may appear on the page. */
export const BUYER_CLOSING_COSTS_SOURCED_FIGURES = [
  {
    figure: '$102',
    source: 'Deschutes County clerk recording fee schedule, first page, effective 2026-07-01',
  },
  {
    figure: '$5',
    source: 'Deschutes County clerk recording fee schedule, each additional page, effective 2026-07-01',
  },
  {
    figure: '$850',
    source: 'VA appraisal fee table, Oregon single-family, effective 2026-05-01',
  },
  {
    figure: '1.75%',
    source: 'HUD mortgagee letter 2023-05, FHA upfront MIP',
  },
  {
    figure: '0.55%',
    source: 'HUD mortgagee letter 2023-05, FHA annual MIP (30-year, under 5% down, at or under base limit)',
  },
  {
    figure: '2.15%',
    source: 'VA funding fee, first use, less than 5% down',
  },
  {
    figure: '3.3%',
    source: 'VA funding fee, subsequent use, less than 5% down',
  },
  {
    figure: '1.5%',
    source: 'VA funding fee, 5% or more down',
  },
  {
    figure: '1.25%',
    source: 'VA funding fee, 10% or more down',
  },
  {
    figure: '10%',
    source: 'CFPB TRID, cumulative tolerance class for certain third-party charges',
  },
  {
    figure: '5%',
    source: 'FHA / VA down-payment thresholds named with the program fee, not a closing-cost total',
  },
] as const

export const BUYER_CLOSING_COSTS_FAQS: readonly BlogFaqItem[] = [
  {
    question: 'How much are closing costs for buyers in Bend?',
    answer:
      "Lender fees, the lender's title policy, the buyer's share of escrow, a county recording fee of $102 for the first page, and prepaid insurance, interest, and prorated taxes. There is no transfer tax in Deschutes County. The exact total for your loan is on the Loan Estimate, and we go through it with you.",
  },
  {
    question: 'Can the seller pay some of my closing costs?',
    answer:
      'Yes. A seller credit toward closing costs is negotiated in the offer, and it has become common in Bend sales. Your loan program limits how large the credit can be, so we check the cap with your lender before writing the request.',
  },
  {
    question: 'What is earnest money, and is it part of closing costs?',
    answer:
      'Earnest money is a deposit you make when the seller accepts your offer, held in escrow. It is not a fee. At closing it is applied to your down payment and closing costs. Earnest money in Oregon covers how much is typical and when it is refundable.',
  },
  {
    question: 'When do I see the final numbers?',
    answer:
      'On the Closing Disclosure, which federal law requires you to receive at least three business days before you sign. It follows the Loan Estimate you got when you applied, and lender fees cannot increase between the two.',
  },
  {
    question: 'Do cash buyers still pay closing costs?',
    answer:
      'Yes, fewer of them. A cash buyer pays no lender fees and no lender\'s title policy, but still pays the escrow fee, the recording fee, prorated property taxes, and the first year of insurance if they choose to carry it.',
  },
]

export const BUYER_CLOSING_COSTS_CONTENT = `
<p>The sale price is not the check. A buyer in Bend brings the down payment plus closing costs plus prepaid items to the table, and most of those costs are more knowable than people expect, because Oregon regulates some of them and federal law caps how far the rest can move. Here is what a buyer pays at an Oregon closing, line by line.</p>

<h2>Closing costs versus down payment</h2>
<p>The down payment is the part of the price you are not borrowing. Closing costs are the fees to make the loan and the sale, paid on top of it. Prepaids are the first year of homeowners insurance, interest from the closing date to the end of the month, and a share of property taxes, collected at closing. Your cash to close is all three added together, and it is on the Closing Disclosure your lender is required to give you at least three business days before you sign.</p>

<h2>Typical buyer line items</h2>
<p><strong>Lender charges.</strong> Origination, underwriting, and the appraisal. These vary by lender, which is why you compare Loan Estimates. Under the federal TRID rules the lender's own fees carry zero tolerance, so they cannot go up between the Loan Estimate and closing, and certain third-party charges cannot rise more than 10% in total. As one published anchor, the VA's appraisal fee schedule effective May 1, 2026 sets a single-family appraisal in Oregon at $850, and conventional appraisals in Central Oregon price in the same territory.</p>
<p><strong>Title and escrow.</strong> The lender's title policy protects the loan, and the buyer usually pays for it. In Central Oregon practice the seller customarily pays for the owner's policy, and the escrow fee is customarily split. Both are contract terms and an offer can allocate them differently.</p>
<p><strong>Recording.</strong> Deschutes County charges $102 to record the first page of a deed or mortgage and $5 for each additional page, per the county clerk's fee schedule effective July 1, 2026.</p>
<p><strong>Prepaids.</strong> The first year of homeowners insurance, prepaid interest, and prorated property taxes. Oregon's property tax year runs July 1 through June 30, and escrow splits the current year to the day of closing.</p>
<p><strong>Transfer tax.</strong> None. Oregon has no state real estate transfer tax, and Deschutes County has none. Washington County, near Portland, is the one Oregon county that charges one.</p>

<h2>Loan program fees</h2>
<p><strong>FHA.</strong> The upfront mortgage insurance premium is 1.75% of the base loan amount, and it can be financed into the loan. The annual premium on a 30-year loan with less than 5% down and a loan amount at or under the FHA base limit is 0.55% of the loan per year, collected monthly, per HUD's current mortgagee letter.</p>
<p><strong>VA.</strong> The funding fee for a purchase is 2.15% of the loan on first use with less than 5% down, 3.3% on later use, 1.5% with 5% or more down, and 1.25% with 10% or more down. Veterans receiving VA compensation for a service-connected disability are exempt, and some Central Oregon veterans qualify without knowing it. Ask your lender to check.</p>

<h2>Seller credits and rate buydowns</h2>
<p>A seller credit toward closing costs lowers your cash to close without changing the price. A rate buydown funded by the seller lowers the payment. Both have become common in Bend closings as inventory grew, and both are asked for in the offer. Our <a href="/blog/bend-buyers-market-shift-2026">report on Bend's shift toward buyers</a> shows how often sellers have been giving them, from closed MLS data. Your loan program caps how large a seller credit can be, so ask the lender for the limit before you write the request.</p>

<h2>Timeline to the Closing Disclosure</h2>
<p>You get a Loan Estimate within three business days of applying. You get the Closing Disclosure at least three business days before signing, and it must match the Loan Estimate within the tolerance rules. Compare the two side by side. If a lender fee moved, ask why before you sign. Our guide to <a href="/blog/what-happens-between-offer-accepted-and-closing">what happens between acceptance and closing</a> covers the rest of the calendar.</p>

<h2>Questions</h2>
<h3>How much are closing costs for buyers in Bend?</h3>
<p>Lender fees, the lender's title policy, the buyer's share of escrow, a county recording fee of $102 for the first page, and prepaid insurance, interest, and prorated taxes. There is no transfer tax in Deschutes County. The exact total for your loan is on the Loan Estimate, and we go through it with you.</p>
<h3>Can the seller pay some of my closing costs?</h3>
<p>Yes. A seller credit toward closing costs is negotiated in the offer, and it has become common in Bend sales. Your loan program limits how large the credit can be, so we check the cap with your lender before writing the request.</p>
<h3>What is earnest money, and is it part of closing costs?</h3>
<p>Earnest money is a deposit you make when the seller accepts your offer, held in escrow. It is not a fee. At closing it is applied to your down payment and closing costs. <a href="/blog/understanding-earnest-money-oregon">Earnest money in Oregon</a> covers how much is typical and when it is refundable.</p>
<h3>When do I see the final numbers?</h3>
<p>On the Closing Disclosure, which federal law requires you to receive at least three business days before you sign. It follows the Loan Estimate you got when you applied, and lender fees cannot increase between the two.</p>
<h3>Do cash buyers still pay closing costs?</h3>
<p>Yes, fewer of them. A cash buyer pays no lender fees and no lender's title policy, but still pays the escrow fee, the recording fee, prorated property taxes, and the first year of insurance if they choose to carry it.</p>

<h2>Next step</h2>
<p><a href="/homes-for-sale">Get listing alerts</a> for the homes in your price band, or <a href="/book">book a call</a> and we will connect you with a local lender for a Loan Estimate on a real address.</p>
`

export const BUYER_CLOSING_COSTS_POST = {
  title: BUYER_CLOSING_COSTS_TITLE,
  slug: BUYER_CLOSING_COSTS_SLUG,
  category: 'Buying Guides',
  tags: ['closing costs', 'bend', 'oregon', 'buying guide', 'title and escrow'],
  heroImageUrl: '/images/blog/what-happens-between-offer-accepted-and-closing.jpg',
  authorBrokerId: BUYER_CLOSING_COSTS_AUTHOR_BROKER_ID,
  publishedAt: '2026-09-19T16:00:00Z',
  status: 'published' as const,
  seoTitle: 'Closing Costs for Buyers in Bend, Oregon (2026)',
  seoDescription:
    'What Bend buyers pay at closing: lender fees under TRID, title and escrow, the county recording fee, prepaids, FHA and VA fees, and how seller credits help.',
  excerpt:
    'Lender fees, title and escrow, the county recording fee, prepaids, FHA and VA program fees, and no transfer tax. Plus how a seller credit changes the cash you bring.',
  content: BUYER_CLOSING_COSTS_CONTENT,
}

export function buyerClosingCostsSeed() {
  return {
    title: BUYER_CLOSING_COSTS_POST.title,
    slug: BUYER_CLOSING_COSTS_POST.slug,
    category: BUYER_CLOSING_COSTS_POST.category,
    tags: BUYER_CLOSING_COSTS_POST.tags,
    hero_image_url: BUYER_CLOSING_COSTS_POST.heroImageUrl,
    author_broker_id: BUYER_CLOSING_COSTS_POST.authorBrokerId,
    published_at: BUYER_CLOSING_COSTS_POST.publishedAt,
    status: BUYER_CLOSING_COSTS_POST.status,
    seo_title: BUYER_CLOSING_COSTS_POST.seoTitle,
    seo_description: BUYER_CLOSING_COSTS_POST.seoDescription,
    excerpt: BUYER_CLOSING_COSTS_POST.excerpt,
    content: BUYER_CLOSING_COSTS_POST.content,
  }
}

const DOLLAR_RE = /\$\d+(?:\.\d+)?/g
const PERCENT_RE = /\d+(?:\.\d+)?%/g
const INVENTED_TOTAL_RE =
  /\d+\s*[–-]\s*\d+\s*%\s*of\s+(?:the\s+)?(?:purchase|sale|home)\s+price/i

export function buyerClosingCostsDollarFigures(html: string = BUYER_CLOSING_COSTS_CONTENT): string[] {
  return html.match(DOLLAR_RE) ?? []
}

export function buyerClosingCostsPercentFigures(html: string = BUYER_CLOSING_COSTS_CONTENT): string[] {
  return html.match(PERCENT_RE) ?? []
}

export function buyerClosingCostsInventedTotal(html: string = BUYER_CLOSING_COSTS_CONTENT): boolean {
  return INVENTED_TOTAL_RE.test(html)
}

export function buyerClosingCostsSourcedAllowlist(): Set<string> {
  return new Set(BUYER_CLOSING_COSTS_SOURCED_FIGURES.map((row) => row.figure))
}
