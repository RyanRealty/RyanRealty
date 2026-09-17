/**
 * Bend new-construction snapshot — researched 2026-09-16 PT.
 *
 * Inventory counts and list-price bands come from the Ryan Realty listings
 * search DAL (`new_construction_yn`, City = Bend, Active). Financing terms
 * are a transcription of public builder pages the same day. This module is
 * the only place those figures may be typed. The page must not invent MOS,
 * rates, APR, deadlines, or prices.
 *
 * Sources (session uploads, 2026-09-16):
 *   - bend-newcon-db.md — Active inventory
 *   - bend-newcon-financing-detail-2026-09-16.md — concession legal detail
 *   - bend-new-con-brief-2026-09-16.md — flags only (UNVERIFIED / STALE / CONFLICT)
 */
import { homesForSalePath, slugify } from '@/lib/slug'

export const BEND_NEW_CONSTRUCTION_PATH = '/new-construction'
export const BEND_NEW_CONSTRUCTION_RESEARCH_DATE = '2026-09-16'
export const BEND_NEW_CONSTRUCTION_RESEARCH_STAMP = '2026-09-16 PT'

export const BEND_NEW_CON_SEARCH_HREF = `${homesForSalePath('Bend')}?newConstruction=1`

export function bendNewConSearchHref(subdivision?: string | null): string {
  const path = subdivision?.trim()
    ? homesForSalePath('Bend', subdivision)
    : homesForSalePath('Bend')
  return `${path}?newConstruction=1`
}

/** Known community pages for Bend-proper names that appear in the snapshot. */
const COMMUNITY_PAGE_BY_SLUG: Record<string, string> = {
  'northwest-crossing': '/communities/northwest-crossing',
  tetherow: '/communities/tetherow',
}

export function bendNewConCommunityHref(subdivision: string): string | null {
  return COMMUNITY_PAGE_BY_SLUG[slugify(subdivision)] ?? null
}

export const BEND_NEW_CONSTRUCTION_TITLE = 'New construction in Bend'
export const BEND_NEW_CONSTRUCTION_DESCRIPTION =
  'Bend new-construction communities, list-price bands, and published builder financing as of 2026-09-16. Not a loan offer. Verify terms with the builder and lender.'

export const BEND_NEW_CONSTRUCTION_KEYWORDS = [
  'Bend new construction',
  'new homes Bend Oregon',
  'builder financing Bend',
  'Pahlisch Easton Petrosa Collier',
  'D.R. Horton Stevens Ranch',
] as const

/** Headline totals — Active Bend proper, 2026-09-16 PT DAL pull. */
export const BEND_NEW_CON_HEADLINE = {
  active: 185,
  subdivisionsIncludingUnspecified: 39,
  namedCommunities: 38,
  unspecifiedActive: 16,
  priceLow: '$185,000',
  priceHigh: '$5,285,000',
  median: '$699,900',
} as const

export type NewConFlag = 'UNVERIFIED' | 'STALE' | 'NOT DISCLOSED' | 'CONFLICT'

export type NewConInventoryRow = {
  name: string
  active: number
  /** Sampled BuilderName from listing details. Null when the sample had none. */
  builders: string | null
  priceBand: string
  /** Median list among valid prices when n≥3. */
  median: string | null
  /** Beds / baths / sqft from the DAL pull. Null when the pull had no usable range. */
  typical: string | null
}

export type NewConSourceLink = {
  label: string
  href: string
}

export type NewConFinancingId =
  | 'pahlisch-golden-key'
  | 'horton-stevens-ranch-flyer'
  | 'lennar-fall-super-sale'
  | 'hayden-summer-savings'
  | 'hayden-zero-down'
  | 'hayden-parkside-10k'
  | 'stone-bridge-35k'
  | 'discovery-west'

export type NewConFinancingOffer = {
  id: NewConFinancingId
  builder: string
  title: string
  flags: readonly NewConFlag[]
  terms: readonly string[]
  sources: readonly NewConSourceLink[]
}

/**
 * Named Bend-proper subdivisions with 2+ Active new-con listings.
 * Unspecified / N/A is not a community — see `BEND_NEW_CON_UNSPECIFIED`.
 * Caldera Springs is Sunriver and is not in this list.
 */
export const BEND_NEW_CON_NAMED: readonly NewConInventoryRow[] = [
  {
    name: 'Easton',
    active: 20,
    builders: 'Pahlisch Homes Inc.',
    priceBand: '$449,900–$849,900',
    median: '$632,400',
    typical: '2–4 beds · 2–3 baths · 1,180–2,590 sqft',
  },
  {
    name: 'Stevens Ranch',
    active: 15,
    builders: 'DR Horton',
    priceBand: '$419,995–$714,900',
    median: '$639,995',
    typical: '2–5 beds · 2–3 baths · 1,335–2,535 sqft',
  },
  {
    name: 'Discovery West Phase 8 & 9',
    active: 14,
    builders: 'MCD HOMES LLC, Salvesen Homes',
    priceBand: '$1,349,900–$2,034,500',
    median: '$1,699,900',
    typical: '3–4 beds · 2–4 baths · 1,614–3,054 sqft',
  },
  {
    name: 'Petrosa',
    active: 14,
    builders: 'Pahlisch Homes, Pahlisch Homes Inc',
    priceBand: '$499,900–$999,900',
    median: '$657,400',
    typical: '3–5 beds · 2–3 baths · 1,450–2,855 sqft',
  },
  {
    name: 'Acadia Pointe Phase 5 and 6',
    active: 11,
    builders: 'Lennar Northwest LLC.',
    priceBand: '$524,900–$681,900',
    median: '$557,900',
    typical: '3–4 beds · 3 baths · 1,876–2,317 sqft',
  },
  {
    name: 'Collier',
    active: 9,
    builders: 'Pahlisch Homes',
    priceBand: '$1,350,000–$1,699,000',
    median: '$1,445,000',
    typical: '3–5 beds · 3–4 baths · 2,248–3,500 sqft',
  },
  {
    name: 'Parkside Place Phase 1',
    active: 8,
    builders: 'Hayden Homes',
    priceBand: '$399,990–$574,990',
    median: '$487,490',
    typical: '2–3 beds · 2–3 baths · 1,268–1,760 sqft',
  },
  {
    name: 'Stone Creek',
    active: 6,
    builders: 'Franklin Brothers LLC',
    priceBand: '$571,990–$624,990',
    median: '$589,490',
    typical: '3–4 beds · 2–3 baths · 1,449–2,160 sqft',
  },
  {
    name: 'Talline Phase 1 & 2',
    active: 6,
    builders: 'Curtis Homes LLC, Structure Development NW LLC',
    priceBand: '$1,599,000–$1,849,000',
    median: '$1,749,000',
    typical: '4–5 beds · 3–5 baths · 2,410–3,372 sqft',
  },
  {
    name: 'Sky Vista Phase 1',
    active: 5,
    builders: 'Stone Bridge Homes NW LLC',
    priceBand: '$624,900–$779,900',
    median: '$679,900',
    typical: '3–4 beds · 3 baths · 2,353–2,878 sqft',
  },
  {
    name: 'Calaveras',
    active: 4,
    builders: null,
    priceBand: '$439,000–$469,000',
    median: '$462,000',
    typical: '3–4 beds · 2–3 baths · 1,464–1,692 sqft',
  },
  {
    name: 'NorthWest Crossing',
    active: 4,
    builders: 'SunWest Builders',
    priceBand: '$439,500–$849,950',
    median: '$607,475',
    typical: '1–2 beds · 1–2 baths · 578–926 sqft',
  },
  {
    name: 'Scalehouse Loop Townhomes',
    active: 4,
    builders: 'Blue Fern, LLC',
    priceBand: '$784,900–$849,900',
    median: '$817,900',
    typical: '3 beds · 3 baths · 1,500–1,622 sqft',
  },
  {
    name: 'Sunset Glen',
    active: 4,
    builders: 'Stone Bridge Homes NW, LLC',
    priceBand: '$634,900–$999,900',
    median: '$782,450',
    typical: '3–4 beds · 2–3 baths · 1,843–2,676 sqft',
  },
  {
    name: 'Thunder Ridge',
    active: 4,
    builders: 'D.R. Horton, Portland, Inc.',
    priceBand: '$379,995–$419,995',
    median: '$399,995',
    typical: '3 beds · 3 baths · 1,413–1,462 sqft',
  },
  {
    name: 'Arrowood Eight',
    active: 3,
    builders: 'Arrowood Development',
    priceBand: '$1,645,000–$3,558,000',
    median: '$2,198,000',
    typical: '4 beds · 4 baths · 2,020–4,610 sqft',
  },
  {
    name: 'Countryside Phase 4',
    active: 3,
    builders: 'Stone Bridge Homes NW LLC',
    priceBand: '$699,900–$845,000',
    median: '$764,900',
    typical: '3–4 beds · 3 baths · 1,500–2,753 sqft',
  },
  {
    name: 'Discovery West Phase 6 & 7',
    active: 3,
    builders: 'Sunwest Builders',
    priceBand: '$1,695,000–$1,825,000',
    median: '$1,799,900',
    typical: '3–4 beds · 3–4 baths · 2,304–2,914 sqft',
  },
  {
    name: 'Lodges at Bachelor V',
    active: 3,
    builders: null,
    priceBand: '$1,024,848–$1,238,136',
    median: '$1,114,629',
    typical: '3–5 beds · 3 baths · 2,299–3,006 sqft',
  },
  {
    name: 'Ponderosa, Phase 1',
    active: 3,
    builders: null,
    priceBand: '$414,995–$419,995',
    median: '$419,995',
    typical: '3 beds · 3 baths · 1,413 sqft',
  },
  {
    name: 'Tetherow',
    active: 3,
    builders: null,
    priceBand: '$759,000–$3,999,000',
    median: '$959,000',
    typical: '2–4 beds · 2–6 baths · 1,047–5,140 sqft',
  },
  {
    name: 'Awbrey Butte',
    active: 2,
    builders: null,
    priceBand: '$1,399,000–$2,100,000',
    median: null,
    typical: '3–4 beds · 3–4 baths · 2,451–3,676 sqft',
  },
  {
    name: 'Daly Estates',
    active: 2,
    builders: null,
    priceBand: '$245,000–$285,000',
    median: null,
    typical: '2–3 beds · 3 baths · 1,085–1,769 sqft',
  },
  {
    name: 'Rosengarth Estates Phase 4',
    active: 2,
    builders: null,
    priceBand: '$635,000–$650,000',
    median: null,
    typical: '3 beds · 2 baths · 1,553–1,701 sqft',
  },
  {
    name: 'Shevlin West',
    active: 2,
    builders: null,
    priceBand: '$1,600,000–$1,985,000',
    median: null,
    typical: '3–4 beds · 4 baths · 2,673–3,495 sqft',
  },
  {
    name: 'Talline Phase 3',
    active: 2,
    builders: null,
    priceBand: '$1,433,500–$1,447,500',
    median: null,
    typical: '4 beds · 3 baths · 2,490–2,606 sqft',
  },
  {
    name: 'Thurston Townhomes',
    active: 2,
    builders: null,
    priceBand: '$595,000–$695,000',
    median: null,
    typical: '2–3 beds · 3–4 baths · 1,314–1,826 sqft',
  },
  {
    name: 'Acadia Pointe Phase 1 and 2',
    active: 1,
    builders: null,
    priceBand: '$583,400',
    median: null,
    typical: '4 beds · 3 baths · 2,304 sqft',
  },
  {
    name: 'Bonne Home',
    active: 1,
    builders: null,
    priceBand: '$1,849,000',
    median: null,
    typical: '5 beds · 5 baths · 3,036 sqft',
  },
  {
    name: 'Countryside Phase 5',
    active: 1,
    builders: null,
    priceBand: '$859,555',
    median: null,
    typical: '4 beds · 3 baths · 2,708 sqft',
  },
  {
    name: 'Discovery West Phase 5',
    active: 1,
    builders: null,
    priceBand: '$1,759,900',
    median: null,
    typical: '5 beds · 4 baths · 2,896 sqft',
  },
  {
    name: 'Hiatus at Ninth Street',
    active: 1,
    builders: null,
    priceBand: '$670,000',
    median: null,
    typical: '2 beds · 3 baths · 675 sqft',
  },
  {
    name: 'Highland',
    active: 1,
    builders: null,
    priceBand: '$1,674,900',
    median: null,
    typical: '4 beds · 3 baths · 1,442 sqft',
  },
  {
    name: 'Lakes At Tanager PUD',
    active: 1,
    builders: null,
    priceBand: '$5,285,000',
    median: null,
    typical: '4 beds · 5 baths · 4,659 sqft',
  },
  {
    name: 'Riley Crossing',
    active: 1,
    builders: null,
    priceBand: '$859,000',
    median: null,
    typical: '2,316 sqft',
  },
  {
    name: 'Rivers Edge Village',
    active: 1,
    builders: null,
    priceBand: '$1,674,000',
    median: null,
    typical: '5 beds · 3 baths · 4,069 sqft',
  },
  {
    name: 'Roosevelt Ridgeline',
    active: 1,
    builders: null,
    priceBand: '$832,500',
    median: null,
    typical: '3 beds · 3 baths · 1,798 sqft',
  },
  {
    name: 'Wiestoria',
    active: 1,
    builders: null,
    priceBand: '$725,000',
    median: null,
    typical: '2 beds · 3 baths · 1,231 sqft',
  },
]

export const BEND_NEW_CON_UNSPECIFIED = {
  active: 16,
  priceBand: '$185,000–$1,899,900',
  median: '$759,900',
  note: '16 Active listings had no SubdivisionName in the 2026-09-16 pull. They are in the 185 total. Not a community.',
} as const

/** Max Active count among named rows — caller uses this for ledger bar weights. */
export const BEND_NEW_CON_MAX_ACTIVE = 20

export function bendNewConWeight(active: number): number {
  return active / BEND_NEW_CON_MAX_ACTIVE
}

export const BEND_NEW_CON_PRIMARY = BEND_NEW_CON_NAMED.filter((row) => row.active >= 2)
export const BEND_NEW_CON_SINGLE = BEND_NEW_CON_NAMED.filter((row) => row.active === 1)

/**
 * Single-family shopping order — lowest SFR list band first.
 *
 * Locked to the 2026-09-16 files. DAL bands for Parkside / Calaveras / Easton /
 * Petrosa / Acadia. Stevens Ranch SF uses the Horton community page that day
 * (`From $579,995`) because the DAL subdivision band mixes in townhomes.
 * Horton townhomes are `BEND_NEW_CON_HORTON_TOWNHOME_NAMES`, not this list.
 */
export const BEND_NEW_CON_SFR_ORDER = [
  'Parkside Place Phase 1',
  'Calaveras',
  'Easton',
  'Petrosa',
  'Acadia Pointe Phase 5 and 6',
  'Stevens Ranch',
] as const

/** First three SFR communities on the photographed shelf. */
export const BEND_NEW_CON_LEAD_NAMES = [
  'Parkside Place Phase 1',
  'Calaveras',
  'Easton',
] as const

export const BEND_NEW_CON_LEDE = 'Single-family starts at $399,990 at Parkside Place'

export const BEND_NEW_CON_STAGE_FALLBACK_POSTER =
  '/images/blog/new-construction-guide-central-oregon.jpg'

/** Horton townhome communities in the DAL pull. Stevens Ranch townhomes share the SF subdivision name. */
export const BEND_NEW_CON_HORTON_TOWNHOME_NAMES = [
  'Thunder Ridge',
  'Ponderosa, Phase 1',
] as const

/** Horton Stevens Ranch single-family — builder page 2026-09-16, not the mixed DAL band. */
export const BEND_NEW_CON_STEVENS_RANCH_SF = {
  priceBand: 'From $579,995',
  qmi: '$579,995–$699,995',
  dalMixedBand: '$419,995–$714,900',
  source:
    'D.R. Horton Stevens Ranch community page, 2026-09-16 PT. DAL mixed band the same day includes townhomes.',
} as const

/** Horton Stevens Ranch townhomes — Express page 2026-09-16. */
export const BEND_NEW_CON_STEVENS_RANCH_TOWNHOMES = {
  name: 'Stevens Ranch townhomes',
  builders: 'DR Horton',
  priceBand: 'From $419,995',
  qmi: '$419,995–$444,995',
  href: 'https://www.drhorton.com/oregon/central-oregon/bend/stevens-ranch-townhomes',
} as const

export const BEND_NEW_CON_HORTON_TOWNHOME_NOTE =
  'D.R. Horton townhomes that day: Thunder Ridge $379,995–$419,995, Ponderosa $414,995–$419,995, and Stevens Ranch from $419,995. Those are not the single-family lead.'

export const BEND_NEW_CON_HORTON_TOWNHOME_SOURCE =
  'Thunder Ridge and Ponderosa bands: Ryan Realty listings search DAL, 2026-09-16 PT. Stevens Ranch townhomes from $419,995: D.R. Horton Express page the same day.'

/** Lennar Brooksmill is on the builder page that day; it is not a named DAL subdivision row. */
export const BEND_NEW_CON_BROOKSMILL_NOTE =
  'Lennar Brooksmill listed $759,900–$957,400 on the builder community page that day. It is not a named row in the DAL pull.'

export function bendNewConPriceFloor(priceBand: string): number {
  const match = priceBand.replace(/,/g, '').match(/\$(\d+)/)
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}

function namedRows(names: readonly string[]): NewConInventoryRow[] {
  return names.flatMap((name) => {
    const row = BEND_NEW_CON_NAMED.find((item) => item.name === name)
    return row ? [row] : []
  })
}

export function bendNewConLeadRows(): NewConInventoryRow[] {
  return namedRows(BEND_NEW_CON_LEAD_NAMES)
}

export function bendNewConHortonTownhomeRows(): NewConInventoryRow[] {
  return namedRows(BEND_NEW_CON_HORTON_TOWNHOME_NAMES)
}

export function bendNewConRestPrimary(): NewConInventoryRow[] {
  const sfr = new Set<string>(BEND_NEW_CON_SFR_ORDER)
  const townhomes = new Set<string>(BEND_NEW_CON_HORTON_TOWNHOME_NAMES)
  const byName = new Map(BEND_NEW_CON_PRIMARY.map((row) => [row.name, row]))
  const afterShelf = BEND_NEW_CON_SFR_ORDER.slice(3).flatMap((name) => {
    const row = byName.get(name)
    return row ? [row] : []
  })
  const higher = BEND_NEW_CON_PRIMARY.filter(
    (row) => !sfr.has(row.name) && !townhomes.has(row.name),
  ).sort((a, b) => bendNewConPriceFloor(a.priceBand) - bendNewConPriceFloor(b.priceBand))
  return [...afterShelf, ...higher]
}

export function financingHighlight(offer: NewConFinancingOffer): { value: string; label: string } {
  switch (offer.id) {
    case 'pahlisch-golden-key':
      return { value: '3% / $20,000', label: 'published credit cap' }
    case 'horton-stevens-ranch-flyer':
      return { value: 'CONFLICT', label: 'flyer vs community page' }
    case 'lennar-fall-super-sale':
      return { value: '09/14–09/20', label: 'sign window' }
    case 'hayden-summer-savings':
      return { value: 'STALE', label: 'treat past 2026-09-15 as stale' }
    case 'hayden-zero-down':
      return { value: '$0 down', label: 'program name, not a quote' }
    case 'hayden-parkside-10k':
      return { value: '$10K', label: 'on listed homesites' }
    case 'stone-bridge-35k':
      return { value: '$35K', label: 'banner only' }
    case 'discovery-west':
      return { value: 'NOT DISCLOSED', label: 'no public concession' }
    default: {
      const _exhaustive: never = offer.id
      return _exhaustive
    }
  }
}

/**
 * Financing / concessions — terms from the 2026-09-16 financing-detail
 * transcription only. Flags named in the research brief are attached here
 * (Pahlisch 4.99% UNVERIFIED; Hayden Summer Savings STALE risk past 9/15;
 * Horton community page vs FlippingBook CONFLICT). Do not merge Horton sources.
 */
export const BEND_NEW_CON_FINANCING: readonly NewConFinancingOffer[] = [
  {
    id: 'pahlisch-golden-key',
    builder: 'Pahlisch Homes',
    title: 'Golden Key moving package',
    flags: ['UNVERIFIED'],
    terms: [
      'Published concession: credit equal to the lesser of 3% of total house sale price or $20,000. It may be used for buyer-incurred moving expenses, closing costs, prepaids, impounds, or as a closing credit if the approved loan type allows.',
      'Rate / APR / product: NOT DISCLOSED. The legal page calls this a credit / moving package, not a buydown. No rate or APR is published there.',
      'UNVERIFIED: homepage and community banners advertise a 4.99% rate on select Pahlisch homes. That rate is not on the Golden Key legal page. Treat it as marketed, not a documented loan offer.',
      'Lender: valid for buyers financed using Hixon Mortgage. The financing page also shows a graphic that says “Receive $5,000 towards your closing costs and/or prepaids,” but the page text does not give that graphic’s eligibility or terms.',
      'Deadline: August 10, 2026 through October 12, 2026.',
      'Eligible homes: select homes / new buyers with a non-contingent offer and accepted purchase agreement. The Golden Key page lists four Bend / Collier move-in-ready homes: Carrington Lot 7 ($1,350,000), Malone Lot 6 ($1,425,000), Bentley Lot 2 ($1,450,000), and Benedict Lot 10 ($1,699,000). Other listed Golden Key homes are outside Bend.',
      'Caveats: offers vary by community; not combinable; no rain checks; credit cannot be used for prior purchases, taxes / government fees, or unrelated expenses. Maximum $20,000 is not guaranteed. Easton, Petrosa, and Collier community pages reviewed that day did not publish a separate numeric rate, APR, or extra concession.',
    ],
    sources: [
      { label: 'Pahlisch Golden Key', href: 'https://pahlischhomes.com/golden-key' },
      { label: 'Pahlisch financing', href: 'https://pahlischhomes.com/financing' },
      { label: 'Easton', href: 'https://pahlischhomes.com/communities/easton/' },
      { label: 'Petrosa', href: 'https://pahlischhomes.com/communities/petrosa/' },
      { label: 'Collier', href: 'https://pahlischhomes.com/communities/collier/' },
    ],
  },
  {
    id: 'horton-stevens-ranch-flyer',
    builder: 'D.R. Horton',
    title: 'Stevens Ranch flyer (dated 09/16/26)',
    flags: ['CONFLICT'],
    terms: [
      'CONFLICT: the Stevens Ranch community page and this FlippingBook flyer publish different rate panels. This page transcribes the flyer only. Do not merge the two. Confirm the written loan agreement for the specific home.',
      'The flyer advertises DHI Mortgage offers for certain D.R. Horton homes / communities. It is not a Stevens-Ranch-only loan commitment.',
      '5/1 FHA ARM (flyer pp. 16–17): 3.875% rate / 5.989% APR.',
      '5/1 VA ARM (pp. 16–17): 3.875% rate / 5.600% APR.',
      '7/6 conventional ARM (pp. 16–17): 4.250% rate / 5.688% APR. The rate is adjustable after the initial fixed period as described in the flyer.',
      'Fixed-rate offers (pp. 18–19): FHA 4.99% / 5.697% APR; conventional 4.99% / 5.364% APR. A separate adjacent panel shows FHA 4.990% / 5.697% APR and conventional 5.500% / 5.890% APR.',
      'Special-interest-rate panel (pp. 20–21): 5.75% / 6.464% APR, tied to certain D.R. Horton homes in select Oregon communities.',
      '$0-down product (pp. 20–21): “DHI Mortgage Home Now Program.” Down-payment assistance is described as a forgivable second mortgage equal to 3.5% of the lesser of purchase price or appraised value. Borrower must occupy the home as a primary residence. Other qualification details are in the flyer fine print.',
      'Main Street Stars panel: $4,000 toward closing costs for qualifying members of the named service professions (the panel references military, law enforcement, firefighters, teachers, and healthcare professionals). The flyer’s eligibility and verification terms apply.',
      'Deadlines on the visible panels: ARM — contract by / on 10/26/26 and close by 10/30/26. Fixed-rate — contract on / after 08/26/26 and close by 10/30/26. Confirm the exact panel. The flyer contains multiple offers.',
      'Lender named: DHI Mortgage. No seller-paid buydown dollar amount is separately published beyond the stated rates. Qualification, credit, loan-program, inventory, funding, and fine-print restrictions apply. Rates and APRs can change and are not a quote for every Stevens Ranch home.',
    ],
    sources: [
      {
        label: 'Stevens Ranch flyer (FlippingBook)',
        href: 'https://online.flippingbook.com/view/306856672/',
      },
      {
        label: 'Stevens Ranch community page (do not merge with flyer)',
        href: 'https://www.drhorton.com/oregon/central-oregon/bend/stevens-ranch',
      },
    ],
  },
  {
    id: 'lennar-fall-super-sale',
    builder: 'Lennar',
    title: 'Fall Super Sale — Acadia Pointe and Brooksmill',
    flags: ['NOT DISCLOSED'],
    terms: [
      'Published offer: Fall Super Sale, described as limited-time deals on top inventory. The linked offer describes a 7/6 adjustable-rate mortgage fixed for the first seven years. It does not publish a numeric note rate or APR in the reviewed page text. It says APR is achieved by Lennar-paid discount points.',
      'Lender: financing through Lennar Mortgage, LLC is required for this offer. Use of Lennar Mortgage is not required to buy a home generally.',
      'Deadline: sign a purchase agreement on a select home in greater Oregon / SW Washington 09/14/26–09/20/26 and close by the date in the purchase agreement.',
      'Eligible homes: select new homes. Acadia Pointe is explicitly included in the offer-page community list. Brooksmill displayed the Fall Super Sale card and had six homes available when reviewed ($759,900–$829,900 for the visible inventory), but the offer page does not identify a Brooksmill homesite-specific amount.',
      'Closing-cost dollars / buydown amount: NOT DISCLOSED as a fixed dollar figure. Discount points are paid by Lennar to achieve the APR.',
      'Caveats: cannot be combined with other promotions; limited funds / rates can change or be unavailable when committed, locked, or closed. Qualification may include minimum 20% down, 740 minimum credit score, and owner occupancy, plus investor / program guidelines. Lennar says incentives, availability, and prices can change or be withdrawn.',
    ],
    sources: [
      { label: 'Lennar Oregon communities', href: 'https://www.lennar.com/new-homes/oregon/' },
      {
        label: 'Acadia Pointe',
        href: 'https://www.lennar.com/new-homes/oregon/central-oregon/bend/acadia-pointe',
      },
      {
        label: 'Brooksmill',
        href: 'https://www.lennar.com/new-homes/oregon/central-oregon/bend/brooksmill',
      },
      {
        label: 'Fall Super Sale',
        href: 'https://www.lennar.com/new-homes/oregon/portland/promo/porlen_limited_time_promotions',
      },
    ],
  },
  {
    id: 'hayden-summer-savings',
    builder: 'Hayden Homes',
    title: 'Summer Home Savings Event',
    flags: ['STALE', 'NOT DISCLOSED'],
    terms: [
      'Hayden says savings may be applied to closing costs, a rate buydown, design options, and more. No dollar amount, rate, APR, product type, or lender is published on the event page.',
      'Deadline / eligible homes: “Limited time,” with no end date stated. The form lists Central Oregon communities including Parkside Place, 121 West, Hearthstone at Redmond Ranch, and Ponderosa Place. Availability and amount require contacting the Community Manager.',
      'STALE risk: researched 2026-09-16. Secondary reports put a mid-September end on this event. Treat anything past 2026-09-15 as possibly stale. Confirm with the Community Manager before relying on it.',
      'Caveat: the marketing / sign-up page is intentionally vague. It does not establish a guaranteed credit or rate.',
    ],
    sources: [
      { label: 'Summer Home Savings Event', href: 'https://www.hayden-homes.com/mlp/savings-event' },
      {
        label: 'Parkside Place',
        href: 'https://www.hayden-homes.com/new-homes/oregon/central-oregon/bend/parkside-place',
      },
    ],
  },
  {
    id: 'hayden-zero-down',
    builder: 'Hayden Homes',
    title: '$0 Down Homebuyer Program',
    flags: ['NOT DISCLOSED'],
    terms: [
      'Concession / product: $0-down payment options; “competitive interest rates”; closing-cost assistance that in many cases could leave little or nothing out of pocket. No numeric rate, APR, or assistance amount is published.',
      'Published qualifications: potentially credit score 580+, stable income / employment, and intending to live in the home rather than rent it out. Hayden says the buyer must consult, get pre-approved, and qualify. No specific lender is named.',
      'Eligible homes: the form includes Parkside Place and multiple Central Oregon communities. The page does not promise the program on every home.',
      'Deadline: NOT DISCLOSED. “Might be eligible” and program / pre-approval restrictions apply. This is not a firm loan approval or a guaranteed $0 cash-to-close quote.',
    ],
    sources: [
      { label: 'Hayden $0 Down', href: 'https://www.hayden-homes.com/mlp/zero-dollars-down' },
    ],
  },
  {
    id: 'hayden-parkside-10k',
    builder: 'Hayden Homes',
    title: 'Parkside Place — save up to $10K on listed homes',
    flags: [],
    terms: [
      'Multiple listed homes show “SAVE UP TO $10K ON THIS HOME!” The page showed this on Darrington homesites 68 and 63, Maple Triplex homesites 13 and 24, Douglas Triplex homesites 12 and 23, Hazelwood Triplex homesite 22, and Middleton homesites 62 and 66. Cascade homesite 67 was shown without that savings label.',
      'No rate, APR, lender requirement, or deadline is stated for the $10K offer.',
      'Payment illustration: the page’s calculator footnote uses a 30-year fixed, 20% down, and 5.25% interest rate, and expressly says it is only a convenience calculation, not an advertised mortgage rate. Taxes and insurance are excluded.',
      'Hayden also says Parkside HOA dues are set below nearby communities. That is an HOA-cost statement, not a financing concession.',
      'Prices, homesite status, and incentive availability can change. Confirm the specific purchase agreement and loan terms.',
    ],
    sources: [
      {
        label: 'Parkside Place',
        href: 'https://www.hayden-homes.com/new-homes/oregon/central-oregon/bend/parkside-place',
      },
    ],
  },
  {
    id: 'stone-bridge-35k',
    builder: 'Stone Bridge Homes NW',
    title: 'Site-wide credit banner',
    flags: ['NOT DISCLOSED'],
    terms: [
      'The site-wide banner says “Get Up to $35K in Credit Toward Your Dream Home.” No rate, APR, product, closing-cost allocation, buydown structure, lender requirement, deadline, or eligibility list is stated in the accessible banner.',
      'Stevens Ranch on the home finder showed Steven’s Ranch, Lot 100, 21424 SE Krakatoa Court, active at $724,900. No Stevens-Ranch-specific financing concession was published in the accessible content.',
      'The financing URL presented a robot / security challenge during review. The $35K line is a headline only. Get the written terms before relying on it.',
    ],
    sources: [{ label: 'Stone Bridge Homes NW', href: 'https://stonebridgehomesnw.com/' }],
  },
  {
    id: 'discovery-west',
    builder: 'Discovery West — MCD Homes and Salvesen Homes',
    title: 'No public concession transcribed',
    flags: ['NOT DISCLOSED'],
    terms: [
      'Discovery West’s public home / neighborhood page describes listings, amenities, and builders. It publishes no rate, APR, closing credit, buydown, lender requirement, or financing deadline.',
      'MCD’s page lists active Discovery West homes (including 3356 NW Celilo Ln Lot 290 and 3369 NW Celilo Ln Lot 281) and says to call for details. It publishes no financing concession or numeric incentive.',
      'Salvesen’s builder page describes custom-home services and contact information. It publishes no financing concession or numeric incentive.',
      'Treat any incentive as unconfirmed until the builder or broker supplies written terms.',
    ],
    sources: [
      { label: 'Discovery West', href: 'https://discoverywestbend.com/' },
      { label: 'MCD Homes — Discovery West', href: 'https://mcdhomesbend.com/discovery-west' },
      {
        label: 'Salvesen Homes — Discovery West',
        href: 'https://discoverywestbend.com/builders/salvesen/',
      },
    ],
  },
]

export const BEND_NEW_CON_DISCLAIMER = {
  title: 'Not a loan offer',
  description: [
    'Researched 2026-09-16 PT. These are published builder and MLS figures from that day, not a quote and not a commitment to lend.',
    'Rates, credits, deadlines, and inventory change. Verify every term with the onsite sales team and the lender named in the purchase agreement before you rely on it.',
  ],
} as const

export const BEND_NEW_CON_INVENTORY_SOURCE =
  'Ryan Realty listings search DAL, 2026-09-16 PT. City = Bend, Active, new_construction_yn. List-price bands ignore ListPrice under $10,000. Builders are from sampled listing details, not every row. Coming Soon is not on the public path.'

export const BEND_NEW_CON_FINANCING_SOURCE =
  'Public builder pages and the D.R. Horton Stevens Ranch flyer, transcribed 2026-09-16 PT. Not a rate sheet and not a loan quote.'

export function flagLabel(flags: readonly NewConFlag[]): string | null {
  if (flags.length === 0) return null
  return flags.join(' · ')
}
