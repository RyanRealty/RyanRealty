/**
 * Market report family doors — one hierarchy for nav + page closings + hub chooser.
 *
 * Five public products (Cos IA package):
 *   1. Live market — /housing-market
 *   2. City pulse — /housing-market/[city] (+ hub #cities)
 *   3. Sales reports — /housing-market/reports (period / PDF cards)
 *   4. Weekly snapshots — /housing-market/reports (dated archive)
 *   5. Market stories — /blog (never titled as the live report)
 *
 * Supporting doors: region deep dive, MOS definition, method, closed-sales explorer, FAQ.
 * /housing-market/explore permanently redirects to the live hub (retired builder).
 *
 * One stats source: MarketPulse / Oregon Data Share. Do not invent numbers here.
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
  label: string
}

export const MARKET_REPORT_DOORS: readonly MarketReportDoor[] = [
  { id: 'hub', href: '/housing-market', label: 'Live market' },
  { id: 'region', href: '/housing-market/central-oregon', label: 'Region deep dive' },
  { id: 'mos', href: '/months-of-supply', label: 'Months of supply' },
  { id: 'method', href: '/how-we-get-our-numbers', label: 'How we get our numbers' },
  { id: 'history', href: '/housing-market/history', label: 'Closed sales explorer' },
  { id: 'published', href: '/housing-market/reports', label: 'Sales and weekly reports' },
  { id: 'blog', href: '/blog', label: 'Market stories' },
  { id: 'faq', href: '/faq', label: 'FAQ' },
] as const

/*
 * The "Where you are" prose row ("You are on the live Central Oregon market…")
 * and its HERE_COPY table were removed on 2026-09-23 (VOICE-6, visibility
 * audit 2026-09-22): each row described the site's own structure rather than
 * the market, read as machine output, and sat directly above the door links
 * that already carry the navigation. The doors below are the one closing.
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

/** Hub entry chooser: Live · By city · Explore · Sales/weekly · MOS. */
export function marketHubChooser(): ReadonlyArray<{ label: string; href: string }> {
  return [
    { label: 'Live market', href: '/housing-market' },
    { label: 'By city', href: '/housing-market#cities' },
    // Reader language, not our IA (evaluator, 2026-09-09: "Explore" names a
    // sitemap entry and "Sales / weekly" reads as a URL path).
    { label: 'Every closed sale', href: '/housing-market/history' },
    { label: 'Weekly snapshots', href: '/housing-market/reports' },
    { label: 'Months of supply', href: '/months-of-supply' },
  ]
}

export function marketNavChildren(): ReadonlyArray<{ label: string; href: string }> {
  return MARKET_REPORT_DOORS.map((door) => ({
    href: door.href,
    label: navLabel(door.id),
  }))
}

function navLabel(id: MarketReportDoorId): string {
  switch (id) {
    case 'hub':
      return 'Live market'
    case 'region':
      return 'Region deep dive'
    case 'mos':
      return 'Months of supply'
    case 'method':
      return 'How we get our numbers'
    case 'history':
      return 'Closed sales explorer'
    case 'published':
      return 'Sales and weekly reports'
    case 'blog':
      return 'Market stories'
    case 'faq':
      return 'FAQ'
  }
}
