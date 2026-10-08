/**
 * /tools/seller-net-sheet constants: the route, the links the page may print
 * (each returned 200 on 2026-10-08, brief section 8), and the source tags the
 * calculator rows carry. No figure lives here; figures come from
 * lib/tools/seller-net-sheet.ts and lib/blog/cost-to-sell-inputs.ts.
 */
export const ROUTE_PATH = '/tools/seller-net-sheet'

export const NET_SHEET_LINKS = {
  bendMarket: '/housing-market/bend',
  costToSell: '/blog/cost-to-sell-house-bend-oregon',
  propertyTax: '/blog/property-taxes-deschutes-county',
  hoaGuide: '/blog/hoa-guide-central-oregon',
  withholding: '/blog/oregon-withholding-firpta-home-sellers',
  buyerAgent: '/blog/buyers-agent-bend-buyer-broker-agreement',
  sell: '/sell',
  valuation: '/sell/valuation',
  contact: '/contact?inquiry=Selling',
} as const

/** External sources, listed at the foot of the page. */
export const NET_SHEET_SOURCES = [
  {
    label:
      'Oregon Title Insurance Rating Organization, Oregon Rating Manual, effective Sept. 1, 2025 (Schedule One; section 1.008(A) county lien search table)',
    linkText: 'rating manual PDF',
    href: 'https://wfgunderwriting.com/wp-content/uploads/filebase/oregon/rates/OTIRO%20Rate%20Manual%20effective%20%209-1-2025.pdf',
  },
  {
    label: 'Deschutes County Title, Central Oregon Rates for Deschutes County (rate card, revised 03/2023)',
    linkText: 'rate card PDF',
    href: 'https://deschutescountytitle.com/wp-content/uploads/2023/04/Rate-Cards-Deschutes-County.pdf',
  },
  {
    label: 'Deschutes County Clerk, Notice of Increase in Recording Fees, effective July 1, 2026 (Ordinance 2026-003)',
    linkText: 'recording fee notice PDF',
    href: 'https://www.deschutescounty.gov/DocumentCenter/View/6380/Notice-of-Increased-Fees---2026pdf',
  },
  {
    label: 'AmeriTitle, Closing Costs: Homeowner Manual (Nov. 2019), for who customarily records the deed and the mortgage release',
    linkText: 'homeowner guide',
    href: 'https://www.amerititle.com/2019/11/closing-costs-homeowner-manual/',
  },
  {
    label: 'ORS 306.815, Tax on transfer of real property prohibited; exceptions',
    linkText: 'Oregon Revised Statutes, chapter 306',
    href: 'https://www.oregonlegislature.gov/bills_laws/ors/ors306.html',
  },
] as const

/** Short source tags for the calculator rows (brief section 4c). */
export const NET_SHEET_ROW_SOURCES = {
  listingFee: "Ryan Realty's listing fee",
  buyerAgent: 'Negotiated in each offer',
  title: 'OTIRO filed rate, Sept 1, 2025',
  escrow: '2023 rate card. Confirm a current quote.',
  escrowOverCard: 'Illustrative. Card stops at $1,000,000. Ask escrow for a quote.',
  lienSearch: 'OTIRO manual, Deschutes table',
  recording: 'Deschutes County Clerk, July 1, 2026',
  transferTax: 'ORS 306.815',
  propertyTax: 'Your share through closing day',
  propertyTaxCredit: "The buyer's share, back to you",
} as const
