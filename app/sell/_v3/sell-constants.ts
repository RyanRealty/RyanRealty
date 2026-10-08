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

/**
 * The listing terms, spelled once. /sell's FAQ and /about (What Ryan Realty
 * does, the key facts, the FAQ) both read these, so the fee and what it covers
 * cannot drift between the two pages.
 */
export const LISTING_FEE_PERCENT = '3%'
export const LISTING_TERMS = {
  fee: `The listing fee is ${LISTING_FEE_PERCENT} of the sale price, with no add-on fees.`,
  covers:
    'That covers the MLS listing, professional photography, video, a 3D tour, the full marketing plan, every showing, and transaction management all the way through closing.',
  buyerAgent: 'Buyer-agent compensation is a separate number, negotiated with each offer',
} as const

export const FAQ_ITEMS = [
  {
    question: 'Do I need to sign a listing agreement to get the CMA?',
    answer:
      'No. The comparative market analysis is free, and there is no contract to sign to get it. If you read it and decide to list with us, that is a separate agreement we go through together.',
  },
  {
    question: 'What does it cost to list with you?',
    answer: `${LISTING_TERMS.fee} ${LISTING_TERMS.covers} ${LISTING_TERMS.buyerAgent}, and we walk you through it before you sign anything.`,
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

export const TRACK_RECORD_TRACE =
  // The WINDOW is stated (2026-08-27 audit: a count with no window leaves the
  // reader to guess). Matt 2026-10-08: the company dates from 2014 (Ryan
  // Realty LLC); what opened in June 2023 is the Bend office, so say that.
  // Plain words only (AEO brief L6): no MLS field names.
  'Central Oregon MLS, every home listed by Ryan Realty and closed since the Bend office opened June 2023. Homes where we represented the buyer are not counted.'

/**
 * /sell's own four questions (Matt's brief, 2026-09-28: "FAQ of about 4"). The
 * FAQPage JSON-LD on /sell is built from this same array, so the visible
 * answers and the structured data cannot drift. FAQ_ITEMS stays for the
 * expired-listing and for-sale-by-owner pages that still carry it.
 */
export const SELL_FAQ_ITEMS = [
  {
    question: 'Is there a contract to talk with you?',
    answer:
      'No. The conversation and the written valuation are free. There is no listing agreement to sign for either. If you decide to list with us later, that is a separate agreement we walk through together.',
  },
  FAQ_ITEMS[1],
  FAQ_ITEMS[2],
  {
    question: 'My listing just ended with another brokerage. Can we talk?',
    answer:
      'Yes, once that listing agreement has ended. We look at the price, the photos and the showings, tell you plainly what we would change, and you decide. From a signed agreement to live on the MLS is typically 5 to 7 business days.',
  },
] as const

/** The ONE primary action on /sell, on the hero submit and the final ask. */
export const SELL_PRIMARY_LABEL = 'Talk to us about your home'

/** /sell default hero sub: two short sentences (Matt 2026-10-08). The H1 must open "Sell your Central Oregon home" (ci:seo-shell). */
export const SELL_HERO_SUB =
  "We price your home from what nearby homes sold for, market it professionally, and update you every week. Start with your address; there's no contract to talk."

/** Default H1. States what we do for the seller and why us, in one read. */
export const SELL_HERO_HEADLINE =
  'Sell your Central Oregon home with a local broker who prices it right'

/** /sell?from=cma hero (Matt, 2026-09-28). ONLY the hero copy changes. */
export const SELL_CMA_EYEBROW = 'For homeowners whose listing ended'
export const SELL_CMA_HEADLINE = "Your listing ended. Let's talk about what's next."
export const SELL_CMA_SUB =
  "We'll look at the price, the photos and the showings, and tell you plainly what we'd change. No contract, no pressure."

