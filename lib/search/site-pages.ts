/**
 * site-pages — static registry of the site's real destination pages for the
 * search-suggestions dropdown (W4.1: static pages join the suggestion scope).
 *
 * The inventory mirrors the KB nav directory (components/site/kb/KbNav.client.tsx
 * MENU_GROUPS) — every entry is a real route. Labels are sentence case per the
 * brand voice rules. Pure module (no DB, no React) so it is testable in
 * isolation and safe to import from server actions and client components alike.
 */

export type SitePageEntry = {
  label: string
  href: string
  /** Extra match terms beyond the label words. */
  keywords: string[]
}

export const SITE_PAGES: SitePageEntry[] = [
  { label: 'Homes for sale', href: '/homes-for-sale', keywords: ['search', 'buy', 'listings', 'browse'] },
  { label: 'Map search', href: '/homes-for-sale?view=map', keywords: ['map'] },
  { label: 'Communities', href: '/communities', keywords: ['community', 'subdivision', 'resort'] },
  { label: 'Cities', href: '/cities', keywords: ['city', 'towns'] },
  { label: 'Open houses', href: '/open-houses', keywords: ['open', 'house', 'tour'] },
  { label: 'Price drops', href: '/price-drops', keywords: ['price', 'drop', 'reduced'] },
  { label: 'Our listings', href: '/our-homes', keywords: ['ryan', 'realty', 'listings'] },
  { label: 'Sell your home', href: '/sell', keywords: ['sell', 'seller', 'listing'] },
  { label: "What's my home worth", href: '/sell/valuation', keywords: ['valuation', 'value', 'worth', 'estimate'] },
  { label: 'Sell on a deadline', href: '/motivated-sellers', keywords: ['deadline', 'fast', 'relocation'] },
  { label: 'Housing market', href: '/housing-market', keywords: ['market', 'stats', 'trends'] },
  { label: 'Market reports', href: '/reports', keywords: ['market', 'report', 'data'] },
  { label: 'Area guides', href: '/area-guides', keywords: ['area', 'guide', 'neighborhood'] },
  { label: 'Guides and blog', href: '/blog', keywords: ['blog', 'articles', 'news'] },
  { label: 'Buyer and seller guides', href: '/blog', keywords: ['guide', 'buyer', 'seller'] },
  { label: 'Schools', href: '/schools', keywords: ['school', 'district', 'education'] },
  { label: 'Parks', href: '/parks', keywords: ['park', 'outdoors'] },
  { label: 'Trails', href: '/central-oregon/trails', keywords: ['trail', 'hike', 'hiking'] },
  { label: 'Golf', href: '/lp/central-oregon-golf', keywords: ['golf', 'course'] },
  { label: 'Events', href: '/central-oregon/events', keywords: ['event', 'calendar', 'weekend'] },
  { label: 'Live music and shows', href: '/central-oregon/venues', keywords: ['music', 'venue', 'show', 'concert'] },
  { label: 'Mortgage calculator', href: '/tools/mortgage-calculator', keywords: ['mortgage', 'calculator', 'payment', 'loan'] },
  { label: 'Reviews', href: '/reviews', keywords: ['review', 'testimonial'] },
  { label: 'About', href: '/about', keywords: ['about', 'brokerage', 'company'] },
  { label: 'Our team', href: '/team', keywords: ['team', 'broker', 'agent'] },
  { label: 'Contact', href: '/contact', keywords: ['contact', 'phone', 'email'] },
  { label: 'Saved homes and searches', href: '/account', keywords: ['account', 'saved', 'favorites', 'alerts'] },
]

/**
 * Prefix-match the query against page labels + keywords.
 * Scoring: whole-label prefix beats label-word prefix beats keyword prefix, so
 * "sell" surfaces "Sell your home" ahead of pages that merely mention selling.
 */
export function searchSitePages(query: string, limit = 5): SitePageEntry[] {
  const q = (query ?? '').trim().toLowerCase()
  if (q.length < 2) return []
  const qTokens = q.split(/[^a-z0-9']+/).filter(Boolean)
  if (qTokens.length === 0) return []

  const scored: Array<{ entry: SitePageEntry; score: number }> = []
  for (const entry of SITE_PAGES) {
    const label = entry.label.toLowerCase()
    const labelWords = label.split(/[^a-z0-9']+/).filter(Boolean)
    let score = 0
    for (const token of qTokens) {
      if (label.startsWith(token)) score += 3
      else if (labelWords.some((w) => w.startsWith(token))) score += 2
      else if (entry.keywords.some((k) => k.startsWith(token))) score += 1
      else {
        score = 0
        break
      }
    }
    if (score > 0) scored.push({ entry, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
    .slice(0, Math.min(Math.max(limit, 1), 10))
    .map((s) => s.entry)
}
