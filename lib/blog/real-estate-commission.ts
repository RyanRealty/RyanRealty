/**
 * /blog/real-estate-commission-bend-oregon: what a Bend seller pays in
 * commission (AIV c2, SEO & AEO Desk brief 2026-10-09,
 * /workspace/search-content/brief-real-estate-commission-bend-2026-10-09.md).
 *
 * EVERY DOLLAR FIGURE IS COMPUTED from the cost-to-sell guide's traced inputs
 * (lib/blog/cost-to-sell-inputs.ts): the same Bend 12-month median, the same
 * as-of day, the same 3% listing fee, and the same title, escrow, lien search
 * and recording lines. When that guide's median is refreshed, this page
 * follows it, so the two guides cannot print different medians or a
 * different $3,215.
 *
 * NO TYPICAL RATE. No "typical", "standard", "average" or "usual" Bend
 * commission rate appears on the page (brief section 2: no named, dated Bend
 * source exists). The only rates are our 3% and a half-point shown as
 * arithmetic.
 *
 * Publishing path: scripts/blog-content/aeo-guides-2026-09.ts seeds this into
 * public.blog_posts, and supabase/migrations/20261009150000_blog_real_estate_commission_bend.sql
 * inserts the same row. Seed this one post only:
 *   npx tsx scripts/seed-blog-posts.ts --only aeo-guides-2026-09 --slug real-estate-commission-bend-oregon
 */
import type { BlogFaqItem } from '@/lib/blog/publish-blog-faq'
import { COST_TO_SELL_HREF, COST_TO_SELL_INPUTS, asOfLabel, costToSellFigures } from '@/lib/blog/cost-to-sell'

export const COMMISSION_SLUG = 'real-estate-commission-bend-oregon'
export const COMMISSION_HREF = `/blog/${COMMISSION_SLUG}` as const

/** The arithmetic example's step: "every half-point you agree to". Not a rate recommendation. */
export const COMMISSION_HALF_POINT = 0.005

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

export type CommissionFigures = {
  price: number
  listingFee: number
  halfPoint: number
  fixedCosts: number
  fixedShare: string
  asOf: string
  asOfIso: string
}

export function commissionFigures(): CommissionFigures {
  const F = costToSellFigures()
  return {
    price: F.price,
    listingFee: F.listingFee,
    halfPoint: Math.round(F.price * COMMISSION_HALF_POINT),
    fixedCosts: F.fixedCosts,
    fixedShare: `${((F.fixedCosts / F.price) * 100).toFixed(2)}%`,
    asOf: asOfLabel(COST_TO_SELL_INPUTS.figuresAsOf),
    asOfIso: COST_TO_SELL_INPUTS.figuresAsOf,
  }
}

const C = commissionFigures()
const PRICE = usd(C.price)
const FEE = usd(C.listingFee)
const HALF = usd(C.halfPoint)
const FIXED = usd(C.fixedCosts)

export const COMMISSION_TITLE = 'Real Estate Commission in Bend, Oregon'
/** Fits TITLE_BUDGET (46) before the layout's " | Ryan Realty" suffix. */
export const COMMISSION_SEO_TITLE = 'Bend Real Estate Commission: What Sellers Pay'
export const COMMISSION_SEO_DESCRIPTION = `Ryan Realty's listing fee is 3% (${FEE} on a ${PRICE} Bend home). Buyer's-agent pay is negotiated per offer since Aug 2024. Oregon rules explained.`
export const COMMISSION_EXCERPT =
  "What our listing fee is, how the buyer's agent gets paid since the 2024 rule changes, what Oregon law requires in writing, and what you pay besides commission."

/** Answer-first block (brief section 5). render-blog-post lifts it above the rail. */
export const COMMISSION_ANSWER = `Ryan Realty's listing fee is 3% of the sale price with no add-on fees, which comes to ${FEE} on a ${PRICE} home, Bend's median sale price over the last 12 months. What the buyer's agent is paid is a separate number. Since the August 17, 2024 practice changes from the National Association of REALTORS\u00ae settlement, it has been negotiated offer by offer instead of being posted in the MLS, and since January 1, 2025, Oregon law (ORS 696.810) has required the buyer's agent to have a written agreement with the buyer that explains how that agent is paid. No law sets either fee, and both are negotiable.`

/** Visible FAQ and FAQPage JSON-LD, word for word (brief section 7). */
export const COMMISSION_FAQS: readonly BlogFaqItem[] = [
  {
    question: 'What is the real estate commission in Bend, Oregon?',
    answer: `It depends on the brokerage, because no law sets it. Ryan Realty's listing fee is 3% of the sale price with no add-on fees, or ${FEE} on a ${PRICE} home, Bend's 12-month median sale price as of ${C.asOf}. What the buyer's agent is paid is a separate amount, negotiated offer by offer.`,
  },
  {
    question: "Who pays the buyer's agent in Oregon now?",
    answer:
      "The buyer agrees to their agent's fee in a written agreement. A seller can agree to cover some or all of it as a term of the offer, but since August 17, 2024 that offer can't be posted in the MLS, so it's decided offer by offer.",
  },
  {
    question: 'Does Oregon require a written buyer agreement?',
    answer:
      "Yes. Since January 1, 2025, ORS 696.810 has required a broker representing a buyer of residential property to work under a written representation agreement, signed before or as soon as reasonably practicable after the broker starts helping. It must explain how the buyer's agent may be paid and can't run longer than 24 months. MLS rules require it before the first tour.",
  },
  {
    question: 'Is real estate commission negotiable in Oregon?',
    answer:
      'Yes. Commissions are not set by law. Under the 2024 settlement rules, written buyer agreements must say so conspicuously, and every listing agreement is its own negotiation.',
  },
  {
    question: "What does Ryan Realty's 3% listing fee include?",
    answer:
      'The MLS listing, professional photography, video, a 3D tour, the full marketing plan, every showing, weekly written reports, and transaction management through closing. There are no add-on fees.',
  },
  {
    question: 'Is commission part of seller closing costs?',
    answer: `It's paid at closing from your proceeds, but it's usually listed separately. On a ${PRICE} Bend sale, title, escrow, the lien search, and recording the release of your mortgage add about ${FIXED}, and Deschutes County charges no transfer tax.`,
  },
  {
    question: "Do I have to pay the buyer's agent if I sell my Bend home?",
    answer:
      "No. Covering the buyer's agent is your choice in each offer. Some buyers will ask for it as part of their offer, and you can accept, decline, or counter, the same as with price.",
  },
]

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const QUESTIONS = COMMISSION_FAQS.map(
  (faq) => `<h3>${escapeHtml(faq.question)}</h3>\n<p>${escapeHtml(faq.answer)}</p>`,
).join('\n')

const ext = (href: string, label: string): string =>
  `<a href="${href}" target="_blank" rel="noopener">${label}</a>`

export const COMMISSION_CONTENT = `
<div class="v3-blog-answer" data-figures-as-of="${C.asOfIso}">
<p>${COMMISSION_ANSWER}</p>
<p class="v3-blog-answer-source">Median: Ryan Realty, Oregon Data Share MLS, single-family, as of ${C.asOf} (<a href="/housing-market/bend">Bend housing market</a>). Rule sources are listed at the bottom of this page.</p>
</div>

<h2>Our listing fee, in dollars</h2>
<p>Our fee is 3% of the sale price, with no add-on fees. It covers the MLS listing, professional photography, video, a 3D tour, the full marketing plan, every showing, weekly written reports, and transaction management through closing. On a ${PRICE} sale, which is Bend's median over the last 12 months as of ${C.asOf}, that's ${FEE}. It's taken from your proceeds at closing, not paid up front. It's written into the listing agreement, and Oregon requires that agreement in writing before a broker markets your home.</p>

<h2>Who pays the buyer's agent now</h2>
<p>Until August 2024, the listing side usually posted an offer to pay the buyer's agent in the MLS. Under the practice changes from the National Association of REALTORS\u00ae settlement, which took effect on August 17, 2024, that offer can't appear in the MLS. Buyers working with an agent sign a written agreement before touring, and the agreement states what their agent will be paid.</p>
<p>As a seller, you can still agree to cover some or all of that fee, but it's now a term of each offer rather than an assumption. Some buyers ask for it, some don't, and you can say yes, no, or part. The math is simple: on a ${PRICE} sale, every half-point you agree to is ${HALF}. That's arithmetic, not a recommendation. We show you each offer's net after any buyer's-agent fee on a <a href="/tools/seller-net-sheet">seller net sheet</a> before you answer.</p>

<h2>What Oregon law requires in writing</h2>
<p><strong>For buyers:</strong> Oregon's House Bill 4058, passed in 2024 and in effect since January 1, 2025, requires a broker who represents a buyer of a home, residential land, or a one-to-four-unit property to work under a written representation agreement (ORS 696.810). It has to be signed before, or as soon as reasonably practicable after, the broker starts helping the buyer, and it can't run longer than 24 months with renewals. Oregon Real Estate Agency rules require it to explain how the buyer's agent may be paid, along with the term, termination rights, and whether it's exclusive. MLS rules are stricter on timing: the agreement has to be signed before the first tour.</p>
<p><strong>For sellers:</strong> your listing agreement has to be in writing before your broker markets the home, and it can't run longer than 24 months either. It states the listing fee and whether you've authorized any offer to the buyer's agent.</p>
<p>More on the buyer side: <a href="/blog/buyers-agent-bend-buyer-broker-agreement">Working with a buyer's agent in Bend</a>.</p>

<h2>What you pay besides commission</h2>
<p>Commission is the biggest line, but it isn't the only one. On a ${PRICE} Bend sale, the owner's title policy, your half of escrow, the lien search, and recording the release of your mortgage come to about ${FIXED}, or ${C.fixedShare} of the price. Deschutes County charges no transfer tax. Your loan payoff and the property-tax proration come out of proceeds too. Every line, with its source: <a href="${COST_TO_SELL_HREF}">What it costs to sell a house in Bend</a>.</p>

<h2>How to compare agents on fees</h2>
<p>You'll see Bend commission rates quoted online. We haven't found a published, dated measure of what Bend sellers actually paid, so we don't quote one. Ask every agent you interview the same three things in writing: the listing fee as a percent and in dollars at your likely price, what that fee includes, and how they'll handle a buyer's request for agent compensation. Ours are above and on our <a href="/about">about page</a>.</p>
<p>Want the numbers for your home? Ask for a <a href="/sell/valuation">written valuation</a>, or see <a href="/sell">how we sell</a>.</p>

<h2>Questions</h2>
${QUESTIONS}

<h2>Sources</h2>
<ul>
<li>Ryan Realty, <a href="/housing-market/bend">Bend housing market</a> (Oregon Data Share MLS), as of ${C.asOf}</li>
<li>National Association of REALTORS\u00ae, ${ext('https://www.nar.realtor/the-facts/what-the-nar-settlement-means-for-home-buyers-and-sellers', 'What the NAR Settlement Means for Home Buyers and Sellers')} (updated May 24, 2024; practice changes effective Aug 17, 2024)</li>
<li>National Association of REALTORS\u00ae, ${ext('https://www.nar.realtor/the-facts/written-buyer-agreements-101', 'Written Buyer Agreements 101')} and ${ext('https://www.nar.realtor/handbook-on-multiple-listing-policy/no-compensation-offers-in-mls-section-4-written-buyer-agreements-required-policy-statement-8-13', 'MLS Policy Statement 8.13')}</li>
<li>${ext('https://www.oregonlegislature.gov/bills_laws/ors/ors696.html', 'ORS 696.810')}, Real estate licensee as buyer's agent; obligations (2025 edition)</li>
<li>${ext('https://www.oregonlegislature.gov/bills_laws/lawsstatutes/2024orLaw0003.pdf', 'Oregon Laws 2024, chapter 3 (House Bill 4058)')}</li>
<li>Oregon Real Estate Agency, ${ext('https://www.oregon.gov/rea/newsroom/Pages/2024-OREN-J/Buyer-Agreements-Listing-Agreements-Law-Rule-Overview.aspx', 'Buyer Agreements and Listing Agreements: A Law and Rule Overview')} (Dec 2024), and ${ext('https://oregon.legal/oregon-laws/oar-863-015-0133/', 'OAR 863-015-0133')}</li>
<li>Ryan Realty, <a href="${COST_TO_SELL_HREF}">What it costs to sell a house in Bend</a> (figures as of ${C.asOf})</li>
</ul>
`

/** The blog_posts row this guide seeds (scripts/blog-content/aeo-guides-2026-09.ts). */
export function commissionSeed() {
  return {
    title: COMMISSION_TITLE,
    slug: COMMISSION_SLUG,
    category: 'Selling Guides',
    tags: ['commission', "buyer's agent", 'nar settlement', 'oregon', 'bend'],
    // No dedicated hero yet; the selling guide's image stands in (no new binary in this PR).
    hero_image_url: '/images/blog/how-to-sell-your-home-bend.jpg',
    author_broker_id: '2fda6811-2edf-49e3-b3ca-33e1052f82e6',
    published_at: '2026-10-09T14:00:00Z',
    status: 'published' as const,
    seo_title: COMMISSION_SEO_TITLE,
    seo_description: COMMISSION_SEO_DESCRIPTION,
    excerpt: COMMISSION_EXCERPT,
    content: COMMISSION_CONTENT,
  }
}
