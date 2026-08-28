/**
 * Route-local constants for /sell and /sell/valuation.
 * Split out of the page files so neither crosses the ci:file-size-budget floor.
 */
import type { V3SheetStep } from '@/components/site/v3'

export const ROUTE_PATH = '/sell'
export const VALUATION_ROUTE = '/sell/valuation'
export const FORM_ANCHOR = '#get-value'
export const VALUATION_FORM_ANCHOR = '#valuation-form'
export const SELL_POSTER = '/images/homepage/tetherow-golf-aerial.jpg'
/** Stage context line. One phrase, not a sentence. */
export const SELL_STAGE_EYEBROW = '3% listing plan'
export const VALUATION_STAGE_EYEBROW = 'Written CMA in 24 hours'

export const FAQ_ITEMS = [
  {
    question: 'Do I need to sign a listing agreement to get the CMA?',
    answer:
      'No. The comparative market analysis is free and requires no contract. If you decide to list with us after reading it, that is a separate signed agreement.',
  },
  {
    question: 'What does it cost to list with you?',
    answer:
      'The listing fee is 3% of the sale price, with no add-on fees. It covers the MLS listing, professional photography, a 3D tour, the marketing plan, every showing, and transaction management through close. Buyer-agent compensation is a separate number, negotiated per offer under the current rules.',
  },
  {
    question: 'How do you decide on a list price?',
    answer:
      'We use recent comparable sales and current active inventory in your area, the same market data shown across this site. You see the three closed comps and three active comps we base the range on.',
  },
  {
    question: 'How long does it take to get listed?',
    answer:
      'From a signed agreement to live on MLS is typically 5 to 7 business days. Professional photos within 48 hours. MLS description and pricing locked the day after photos return.',
  },
  {
    question: 'What if my home is in a resort community with very few sales?',
    answer:
      'For slow-turnover areas like Pronghorn, Crosswater, Black Butte Ranch, or Vandevert Ranch, we expand the comp window to 12 or 24 months and tell you exactly which comps were stretched and why.',
  },
  {
    question: 'What areas do you list homes in?',
    answer:
      'Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the surrounding communities.',
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
      'Zillow, Redfin, Trulia and the national feeds',
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
      'The photography, the drone and cinematic video, the 3D tour, the MLS and the national feeds, the mailers and the open houses, the transaction coordinator, and a written report every week you are on the market. Nothing on the list below is an upgrade.',
      'Buyer-agent compensation is a separate number, negotiated per offer. Before you sign, we show you the settlement statement.',
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

export const VALUATION_FAQ_ITEMS = [
  {
    question: "How do I get my home's value in Bend?",
    answer:
      'Use Value my home on this page. We send a written comparative market analysis from recent closed sales and current listings near your address. No listing agreement.',
  },
  {
    question: 'What is in the written CMA?',
    answer:
      'Three closed comps, three active comps, and the list-price range those six support.',
  },
  {
    question: 'How long does it take?',
    answer: 'A written CMA in 24 hours.',
  },
  {
    question: 'Does this cost anything?',
    answer:
      'No. The comparative market analysis is free. If you later list with us, that is a separate signed agreement. The listing fee is 3% of the sale price.',
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
