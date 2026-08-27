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
      'Under the 2024 NAR settlement rules, a written buyer-broker agreement is required before we tour a home together. We walk through that agreement before the first showing so you know what you are signing and why.',
  },
  {
    question: 'How much earnest money is typical in Central Oregon?',
    answer:
      'Most accepted offers in the Bend area put 1 to 3 percent of the purchase price in earnest money. Competitive listings can require more. We set the number from the specific listing and what similar homes are closing with.',
  },
  {
    question: 'How do I get matched to listings without signing up for a national portal?',
    answer:
      'Send your criteria through our buyer alert form. A Ryan Realty broker pulls matches from the MLS and sends them to you. Nothing on that list is ranked by ad spend.',
  },
  {
    question: 'What areas do you help buyers in?',
    answer:
      'Central Oregon: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the surrounding resort and rural communities.',
  },
  {
    question: 'What is the typical timeline from offer to closing?',
    answer:
      'A standard residential deal in Oregon closes in 30 to 45 days after acceptance. Cash can close in 10 to 21 days. Resort communities and vacant land often take longer for title and survey work.',
  },
  {
    question: 'How does a buyer broker get paid?',
    answer:
      'In most deals the seller offers a buyer-agent commission in the MLS. If the seller offers nothing, the buyer-broker fee is written into your buyer-broker agreement before we tour. You see the number before you sign.',
  },
] as const

export const BUYER_GUIDE_ROWS: V3LedgerPlainRow[] = [
  {
    href: '/buy/first-time-home-buyer',
    when: v3Text('Guide'),
    what: v3Text('First-time buyer plan'),
    detail: v3Text(
      'Down-payment programs, what to inspect, and a realistic timeline for a first home in Central Oregon.',
    ),
    id: 'first-time',
  },
  {
    href: '/buy/relocation',
    when: v3Text('Guide'),
    what: v3Text('Relocation'),
    detail: v3Text(
      'Moving to Bend or Central Oregon from out of state. What the market looks like before you arrive, and how to tour on a short visit.',
    ),
    id: 'relocation',
  },
  {
    href: '/buy/investment',
    when: v3Text('Guide'),
    what: v3Text('Investment property'),
    detail: v3Text(
      'Vacation rentals, long-term rent, and how to underwrite cash flow on a Central Oregon property.',
    ),
    id: 'investment',
  },
]

export const BUY_FACTS: V3QuietItem[] = [
  {
    kind: 'prose',
    term: 'Wells, septic, and HOA history',
    body: 'Ask about the well and septic on a rural parcel, the HOA in a resort community, or what the last four homes on that street closed for.',
  },
  {
    kind: 'prose',
    term: 'Listings from the MLS',
    body: 'Save a search, get an alert the day a match hits, and book a showing. Nothing on this site is ranked by ad spend.',
  },
  {
    kind: 'prose',
    term: 'The same broker through closing',
    body: 'The broker who tours with you writes the offer, negotiates it, and sits at closing.',
  },
  {
    kind: 'prose',
    term: 'Tell us what you want',
    body: 'Share criteria, neighborhoods, and budget. We set an MLS search and send new matches as they list.',
  },
  {
    kind: 'prose',
    term: 'Tour the home',
    body: 'We walk it with you and name what the photos leave out: schools, commute, HOA history, and the known issues in that subdivision.',
  },
  {
    kind: 'prose',
    term: 'Write the offer',
    body: 'We pull recent closed comps for that address, show sale price and days on market, and write the offer from those numbers.',
  },
  {
    kind: 'prose',
    term: 'Close',
    body: 'From inspection through appraisal to the table, the same broker stays with you. Every document gets a read before you sign.',
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
  { label: 'Longer alert form', href: '/lp/buyer-listing-alerts' },
]
