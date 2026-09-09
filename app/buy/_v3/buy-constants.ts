/**
 * /buy copy and exits. Dual objectives live in the IA lock:
 * visitor = understand how buying works here well enough to take the next step.
 * machine = named buyer lead or listing alert. Capture contract is
 * submitSearchAlertSignup (email + filters.propertyType A + company honeypot).
 */
import { v3Text, type V3LedgerPlainRow, type V3QuietItem } from '@/components/site/v3'
import { REGIONAL_SEARCH_HREF } from '@/lib/search/publish-regional-search-href'

export const OLD_MILL_HERO = '/images/homepage/sisters-downtown-three-peaks.jpg'

export const FAQ_ITEMS = [
  {
    question: 'Do I need to sign a buyer-representation agreement before touring homes?',
    answer:
      'Yes. Under the 2024 NAR settlement rules, a written buyer-broker agreement is required before we tour a home together. We go through it with you before the first showing, so you know exactly what you are signing and why. No surprises.',
  },
  {
    question: 'How much earnest money is typical in Central Oregon?',
    answer:
      'Most accepted offers in the Bend area put 1 to 3 percent of the purchase price in earnest money, and competitive listings can call for more. We set the number with you based on the specific home and what similar homes are closing with.',
  },
  {
    question: 'How do I get matched to listings without signing up for a national portal?',
    answer:
      'Send us what you are looking for through the buyer alert form. A Ryan Realty broker pulls matches straight from the MLS and sends them to you. Nothing on that list is ranked by ad spend, just homes that fit.',
  },
  {
    question: 'What areas do you help buyers in?',
    answer:
      'All of Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the resort and rural communities around them. We live here, and we know these neighborhoods.',
  },
  {
    question: 'What is the typical timeline from offer to closing?',
    answer:
      'A standard residential purchase in Oregon closes 30 to 45 days after acceptance. Cash can close in 10 to 21 days. Resort communities and vacant land often take longer for title and survey work, and we tell you up front when that applies.',
  },
  {
    question: 'How does a buyer broker get paid?',
    answer:
      'Your buyer-broker agreement states the fee before we tour a single home, and in the offer we ask the seller to cover it. Since August 2024 that offer no longer appears in the MLS, so it is negotiated in each contract. Any balance the seller does not cover is yours at closing, and you will have seen that number before you signed anything.',
  },
] as const

export const BUYER_GUIDE_ROWS: V3LedgerPlainRow[] = [
  {
    href: '/buy/first-time-home-buyer',
    what: v3Text('First-time buyer plan'),
    detail: v3Text(
      'Down-payment programs, what to inspect, and a realistic timeline for your first home in Central Oregon, from a broker who has walked plenty of first-time buyers through it.',
    ),
    id: 'first-time',
  },
  {
    href: '/buy/relocation',
    what: v3Text('Relocation'),
    detail: v3Text(
      'Moving to Bend or Central Oregon from out of state? What the market looks like before you arrive, how to tour on a short visit, and what nobody tells you about winter.',
    ),
    id: 'relocation',
  },
  {
    href: '/buy/investment',
    what: v3Text('Investment property'),
    detail: v3Text(
      'Vacation rentals, long-term rentals, and how to underwrite cash flow on a Central Oregon property with real local numbers.',
    ),
    id: 'investment',
  },
]

export const BUY_FACTS: V3QuietItem[] = [
  {
    kind: 'prose',
    term: 'Wells, septic, and HOA history',
    body: 'Ask us about the well and septic on a rural parcel, the HOA in a resort community, or what the last four homes on that street closed for. We know, and if we do not, we find out before you write an offer.',
  },
  {
    kind: 'prose',
    term: 'Listings from the MLS',
    body: 'Save a search, get an alert the day a match hits the market, and book a showing. Nothing on this site is ranked by ad spend.',
  },
  {
    kind: 'prose',
    term: 'The same broker through closing',
    body: 'The broker who tours homes with you writes the offer, negotiates it, and sits with you at closing. You will not be handed off.',
  },
  {
    kind: 'prose',
    term: 'Tell us what you want',
    body: 'Tell us your criteria, the neighborhoods you like, and your budget. We set up an MLS search and send new matches the day they list.',
  },
  {
    kind: 'prose',
    term: 'Tour the home',
    body: 'We walk it with you and point out what the photos leave out: schools, commute, HOA history, and the known issues in that subdivision. Local knowledge is the whole point of having us there.',
  },
  {
    kind: 'prose',
    term: 'Write the offer',
    body: 'We pull recent closed comps for that address, show you sale prices and days on market, and write the offer from those numbers, with a strategy for the seller in front of us.',
  },
  {
    kind: 'prose',
    term: 'Close',
    body: 'From inspection through appraisal to the closing table, the same broker stays with you. Every document gets a careful read before you sign it.',
  },
  ...FAQ_ITEMS.map((item) => ({
    kind: 'prose' as const,
    term: item.question,
    body: item.answer,
  })),
]

export const BUY_EXITS: V3QuietItem[] = [
  { label: 'Search homes', href: REGIONAL_SEARCH_HREF },
  { label: 'Open houses', href: '/open-houses' },
  { label: 'Price drops', href: '/price-drops' },
  { label: 'Talk to a broker', href: '/contact?inquiry=Buying' },
  { label: 'Area guides', href: '/area-guides' },
  { label: 'Longer alert form', href: '/homes-for-sale' },
]
