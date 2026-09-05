/**
 * Route-local constants for /join.
 *
 * Recruiting copy is process facts already stated on /sell, plus verifiable
 * named entities. No closing counts, no invented split, no virtue names.
 * Every listing-support row is a door (V3Ledger requires an href).
 */

export const OLD_MILL_HERO = '/images/office/ryan-realty-bend-office-interior-01.jpg'

export const LISTING_SUPPORT = [
  {
    title: 'Film, 3D, and photos in 48 hours',
    body: 'A listing film, a 3D walkthrough, and professional photography within 48 hours of a signed agreement. Produced by the brokerage on every listing, at every price point. Not a cost you carry.',
    href: '/sell#marketing-plan',
  },
  {
    title: 'CMA from live MLS data',
    body: 'A written CMA with three closed comps, three active comps, and the four levers that move the price, built from live MLS data on ryan-realty.com. Your seller sees every number.',
    href: '/housing-market',
  },
  {
    title: 'Its own page plus full syndication',
    body: 'Every listing gets its own page on ryan-realty.com, MLS syndication across Central Oregon, and posts on @ryanrealtybend across Instagram, Facebook, TikTok, and YouTube.',
    href: '/homes-for-sale',
  },
  {
    title: 'Written seller report every week',
    body: 'Each week a listing is on market, the seller gets a written update: showings, online traffic, where the views came from, and feedback.',
    href: '/sell#marketing-plan',
  },
] as const

export const HOW_IT_WORKS = [
  {
    lead: 'You keep the client, start to finish.',
    body: 'No call center. No shared lead pool you compete inside. No hand-off to a closing coordinator the client never met. The broker who takes the call is the broker at the table.',
  },
  {
    lead: 'A principal broker on every file.',
    body: 'Matt Ryan is the principal broker. A question on a contingency, a contract, or a hard close gets answered by a licensed principal broker, not a queue.',
  },
  {
    lead: 'Central Oregon is the whole map.',
    body: 'Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the resort communities. The market data on ryan-realty.com updates from the MLS daily. That is the same data you price from.',
  },
  {
    lead: 'The split is set with you.',
    body: 'Based on the business you bring and the business you want to build. The first conversation covers the numbers directly. There is no single published split, because there is not one.',
  },
] as const

export const JOIN_FAQ_ITEMS = [
  {
    question: 'Do you work with brokers who are new to the industry?',
    answer:
      'Yes. Whether you have a new license or twenty years in the business, the first conversation is the same: what you want to build and how the brokerage helps you build it. A principal broker supervises every transaction either way.',
  },
  {
    question: 'What happens to my current clients and pipeline?',
    answer:
      'They come with you. You keep the relationship from the first call to the closing table. Nothing in the model puts a call center or another broker between you and your client.',
  },
  {
    question: 'What is the commission split?',
    answer:
      'It is set with you, based on your business. There is no single published split because there is not one. The first conversation covers the numbers directly.',
  },
  {
    question: 'Do I have to produce my own listing marketing?',
    answer:
      'No. The listing film, the 3D walkthrough, the photography, the listing page, the social posts, and the weekly seller report are produced by the brokerage, on every listing.',
  },
  {
    question: 'Where does Ryan Realty work?',
    answer:
      'Central Oregon only: Bend, Redmond, Sisters, Sunriver, La Pine, Tumalo, Prineville, Terrebonne, and the resort communities.',
  },
  {
    question: 'How do I start?',
    answer:
      'Send a note through the contact form or call. The first conversation is with a broker, not a recruiter, and there is no script.',
  },
] as const

export const JOIN_CONTACT_HREF = '/contact?inquiry=Join%20the%20team'

/** Join is off-graph recruiting. The footer must not sell a CMA. */
export function joinFooterColumns<
  T extends {
    heading: string
    links: readonly { href: string; label: string }[]
    groups?: readonly { heading: string; links: readonly { href: string; label: string }[] }[]
  },
>(columns: readonly T[]): T[] {
  const keep = (href: string) => href !== '/sell#get-value'
  return columns
    .map((column) => {
      const links = column.links.filter((link) => keep(link.href))
      const groups = column.groups
        ?.map((group) => ({
          ...group,
          links: group.links.filter((link) => keep(link.href)),
        }))
        .filter((group) => group.links.length > 0)
      return {
        ...column,
        links,
        ...(column.groups ? { groups } : {}),
      }
    })
    .filter((column) => column.links.length > 0)
}
