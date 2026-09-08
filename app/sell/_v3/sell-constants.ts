/**
 * Route-local constants for /sell and /sell/valuation.
 * Split out of the page files so neither crosses the ci:file-size-budget floor.
 */
import type { V3SheetStep } from '@/components/site/v3'

export const ROUTE_PATH = '/sell'
export const VALUATION_ROUTE = '/sell/valuation'
export const FSBO_ROUTE = '/sell/for-sale-by-owner'
export const EXPIRED_ROUTE = '/sell/expired-listings'
export const INHERITED_ROUTE = '/sell/inherited-home'
export const FORM_ANCHOR = '#get-value'
export const VALUATION_FORM_ANCHOR = '#valuation-form'
export const SELL_POSTER = '/images/homepage/tetherow-golf-aerial.jpg'
/** Stage context line. One phrase, not a sentence. */
export const SELL_STAGE_EYEBROW = '3% listing plan'
export const VALUATION_STAGE_EYEBROW = 'Written CMA in 24 hours'
export const FSBO_HEADLINE = 'Selling for sale by owner in Central Oregon'
export const EXPIRED_HEADLINE = 'Expired listings in Central Oregon'

export const FAQ_ITEMS = [
  {
    question: 'Do I need to sign a listing agreement to get the CMA?',
    answer:
      'No. The comparative market analysis is free, and there is no contract to sign to get it. If you read it and decide to list with us, that is a separate agreement we go through together.',
  },
  {
    question: 'What does it cost to list with you?',
    answer:
      'The listing fee is 3% of the sale price, with no add-on fees. That covers the MLS listing, professional photography, video, a 3D tour, the full marketing plan, every showing, and transaction management all the way through closing. Buyer-agent compensation is a separate number, negotiated with each offer, and we walk you through it before you sign anything.',
  },
  {
    question: 'How do you decide on a list price?',
    answer:
      'We start with recent comparable sales and the homes competing with yours right now, the same live market data you see across this site. Then we walk you through the three closed comps and three active comps behind the range, so you understand the number, not just receive it.',
  },
  {
    question: 'How long does it take to get listed?',
    answer:
      'Typically 5 to 7 business days from a signed agreement to live on the MLS. Professional photos happen within 48 hours, and we lock the description and pricing with you the day after the photos come back.',
  },
  {
    question: 'What if my home is in a resort community with very few sales?',
    answer:
      'We know these communities well. For slow-turnover areas like Pronghorn, Crosswater, Black Butte Ranch, or Vandevert Ranch, we widen the comp window to 12 or 24 months and show you exactly which comps we stretched and why.',
  },
  {
    question: 'What areas do you list homes in?',
    answer:
      'All of Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the surrounding communities. We live and work here, and we know these neighborhoods.',
  },
] as const

/** Enhanced-column inclusions. Elite-only items stay off this list (Matt 2026-08-11). */
export const PLAN_GROUPS: { title: string; items: readonly string[] }[] = [
  {
    title: 'Pricing and the transaction',
    items: [
      'Written valuation with the sales behind the price',
      'Independent transaction coordinator through close',
      'A written report every week: showings, traffic, feedback',
      'Post-sale support for your next move',
    ],
  },
  {
    title: 'Where your home shows up',
    items: [
      'Central Oregon MLS',
      'the national listing feeds',
      'Its own page on ryan-realty.com',
      'Vetted lender, title, mover and contractor network',
    ],
  },
  {
    title: 'Photography and media',
    items: [
      'Professional photography',
      '3D walkthrough tour',
      'Yard sign with a QR code to the listing',
      'Aerial drone video',
      'Cinematic video walkthrough',
    ],
  },
  {
    title: 'Getting buyers through the door',
    items: [
      'Staging consult using your own furnishings',
      'Open houses on a set cadence',
      'Broker tour for local agents',
      'Virtual staging for vacant rooms',
    ],
  },
  {
    title: 'Marketing reach',
    items: [
      'Organic posts on @ryanrealtybend',
      'Short-form video on Reels and TikTok',
      'Email to 300 nearby homeowners',
      'Printed mailers to 200 neighbors',
      'Direct outreach to thousands of local agents',
      'Outreach to 50 top agents in Portland, Seattle, LA and SF',
    ],
  },
  {
    title: 'While you are away',
    items: [
      'Remote-owner care: mail, snow, plant watering, security checks',
      'Move-out and deep-cleaning coordination',
    ],
  },
]

export const PLAN_STEPS: readonly V3SheetStep[] = [
  {
    id: 'included',
    label: 'What the 3% includes',
    children: [
      'Everything your home needs to sell well is in the plan: the photography, the drone and cinematic video, the 3D tour, the MLS and the national feeds, the mailers and the open houses, a transaction coordinator, and a written report every week you are on the market. Nothing on the list below is an upgrade or an add-on.',
      'Buyer-agent compensation is a separate number, negotiated with each offer. Before you sign, we sit down with you and go through the settlement statement line by line.',
    ],
    blocks: PLAN_GROUPS.map((group) => ({
      kind: 'points' as const,
      label: group.title,
      items: group.items,
    })),
  },
]

export const VALUE_STEPS = [
  {
    title: 'Local comps',
    body: 'Recent closed sales in your neighborhood and similar subdivisions set the floor and the ceiling.',
  },
  {
    title: 'Active competition',
    body: 'Days on market, sale-to-list ratios, and what is for sale near you now shape the list-price range.',
  },
  {
    title: 'Your home',
    body: 'Square footage, beds and baths, lot size, condition, and upgrades adjust the range for your property.',
  },
] as const

export const FSBO_FAQ_ITEMS = [
  {
    question: 'Can I still try FSBO first?',
    answer:
      'Yes. The comparative market analysis is free and requires no listing agreement. You decide after you see the comps.',
  },
  {
    question: 'Do you provide pricing without a listing agreement?',
    answer:
      'Yes. Three closed comps, three active comps, and the list-price range those six support. No contract to get that number.',
  },
] as const

export const FSBO_SITUATION = {
  term: 'Selling on your own',
  body: 'Price, buyer screening, and repair fights are where FSBO sales usually break. The CMA is free and needs no listing agreement.',
} as const

export const EXPIRED_FAQ_ITEMS = [
  {
    question: 'How quickly can we relist?',
    answer:
      'From a signed agreement to live on MLS is typically 5 to 7 business days. Professional photos within 48 hours.',
  },
  {
    question: 'Can we relist without major renovations?',
    answer:
      'Usually yes. Price, photos, and exposure stall most expired listings, not the house.',
  },
] as const

export const EXPIRED_SITUATION = {
  term: 'If the last listing expired',
  body: 'Price, photos, and exposure stall most expired listings. A written CMA is the first step before a relaunch.',
} as const

export const VALUATION_FAQ_ITEMS = [
  {
    question: "How do I get my home's value in Bend?",
    answer:
      'Use Value my home on this page. A broker who knows your neighborhood prepares a written comparative market analysis from recent closed sales and the current listings near you, and sends it within 24 hours. No listing agreement, and no obligation.',
  },
  {
    question: 'What is in the written CMA?',
    answer:
      'Three closed comps, three active comps, the list-price range those six support, and a broker who will walk you through all of it.',
  },
  {
    question: 'How long does it take?',
    answer: 'A written CMA in 24 hours.',
  },
  {
    question: 'Does this cost anything?',
    answer:
      'No. The comparative market analysis is free, and you are welcome to it whether or not you ever list. If you do list with us later, that is a separate agreement, and the listing fee is 3% of the sale price with nothing added on.',
  },
] as const

export const SELL_REVIEW_AUTHORS = [
  'Audra Hedberg',
  'Douglas Grant',
  'Charise Millard',
  'C Jenkins',
  'Helen Luna Fess',
  'SwankHQ',
] as const

export const BEND_MARKET_TRACE_SCOPE =
  'live MLS through Oregon Data Share, detached single-family homes whose MLS City is Bend, not the city-limits polygon.'

export const TRACK_RECORD_TRACE =
  // The WINDOW is stated (2026-08-27 audit: "16 homes sold" carried a filter
  // trace and no window — career? YTD? — leaving the reader to guess). The
  // read has no date filter: it is every closed Ryan Realty listing since the
  // brokerage opened in June 2023.
  'Central Oregon MLS, every home listed by Ryan Realty and closed since the brokerage opened in June 2023. StandardStatus Closed, ClosePrice.'
