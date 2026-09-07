/**
 * Market report family doors — one hierarchy for nav + page closings.
 *
 * Buyers were landing on /housing-market, /housing-market/central-oregon,
 * /housing-market/[city], /months-of-supply, and /housing-market/reports with
 * overlapping "market report" labels and no shared map of what each URL is.
 * This module is the map. Copy only. No figures.
 *
 * Hierarchy (SITE_PAGES / PAGE_INVENTORY):
 *   Live hub → city reports + region report
 *   Definition → /months-of-supply
 *   Method → /how-we-get-our-numbers
 *   Closed sales explorer → /housing-market/history
 *   Published weekly/sales → /housing-market/reports
 *   Words → /blog, /faq
 *
 * One stats source on the public market pages: MarketPulse / Oregon Data Share
 * (plus closed-sales marts where a page already says so). Do not invent numbers here.
 */

export type MarketReportDoorId =
  | 'hub'
  | 'region'
  | 'mos'
  | 'method'
  | 'history'
  | 'published'
  | 'blog'
  | 'faq'

export type MarketReportDoor = {
  id: MarketReportDoorId
  href: string
  /** Plain label: what the destination is, not a marketing synonym. */
  label: string
}

/** Ordered Market family. Labels say the job of the page. */
export const MARKET_REPORT_DOORS: readonly MarketReportDoor[] = [
  { id: 'hub', href: '/housing-market', label: 'Live housing market hub' },
  { id: 'region', href: '/housing-market/central-oregon', label: 'Central Oregon region report' },
  { id: 'mos', href: '/months-of-supply', label: 'Months of supply (definition)' },
  { id: 'method', href: '/how-we-get-our-numbers', label: 'How we get our numbers' },
  { id: 'history', href: '/housing-market/history', label: 'Closed sales explorer' },
  { id: 'published', href: '/housing-market/reports', label: 'Published weekly and sales reports' },
  { id: 'blog', href: '/blog', label: 'Blog and guides' },
  { id: 'faq', href: '/faq', label: 'FAQ' },
] as const

const HERE_COPY: Record<MarketReportDoorId, string> = {
  hub: 'You are on the live Central Oregon housing market hub. City rows open each city’s live report. The region report, months of supply, and published weekly reports are separate pages.',
  region:
    'You are on the Central Oregon region report. The live hub and each city report are separate. Months of supply is the definition page.',
  mos: 'You are on the months of supply definition page. Live figures still live on the housing market hub and city reports.',
  method:
    'You are on how we get our numbers. This page has no live figures — it explains the method behind the market pages.',
  history:
    'You are on the closed sales explorer. Live inventory and months of supply live on the housing market hub and city reports.',
  published:
    'You are on published weekly and sales reports. The live housing market hub is the current inventory and pace page.',
  blog: 'You are in guides and blog posts. Live market figures live on the housing market hub and city reports.',
  faq: 'You are on FAQ. Live market figures live on the housing market hub and city reports.',
}

/** Prose “where you are” for the current market page. */
export function marketReportHereBody(here: MarketReportDoorId): string {
  return HERE_COPY[here]
}

/**
 * Quiet link rows for sibling market pages. Drops the page the visitor is on
 * so we never offer a door to “here.”
 */
export function marketReportDoorLinks(
  here: MarketReportDoorId,
  options?: { include?: readonly MarketReportDoorId[] },
): ReadonlyArray<{ label: string; href: string }> {
  const allow = options?.include ? new Set(options.include) : null
  return MARKET_REPORT_DOORS.filter((door) => door.id !== here)
    .filter((door) => (allow ? allow.has(door.id) : true))
    .map((door) => ({ label: door.label, href: door.href }))
}

/** Nav children for Market (desktop panel + Menu+). Same order, same words. */
export function marketNavChildren(): ReadonlyArray<{ label: string; href: string }> {
  return MARKET_REPORT_DOORS.map((door) => ({
    href: door.href,
    label: navLabel(door.id),
  }))
}

function navLabel(id: MarketReportDoorId): string {
  switch (id) {
    case 'hub':
      return 'Live housing market'
    case 'region':
      return 'Central Oregon region report'
    case 'mos':
      return 'Months of supply'
    case 'method':
      return 'How we get our numbers'
    case 'history':
      return 'Closed sales explorer'
    case 'published':
      return 'Published reports'
    case 'blog':
      return 'Blog and guides'
    case 'faq':
      return 'FAQ'
  }
}
