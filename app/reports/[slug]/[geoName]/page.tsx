import { permanentRedirect } from 'next/navigation'
import { slugify } from '@/lib/slug'

/**
 * Legacy per-geo market report. It read the `reporting_cache` table, which has
 * been DROPPED, so every metric resolved to null while the page still printed a
 * confident market-condition verdict — an unsourced verdict in front of a lead
 * (CLAUDE.md §0 data accuracy, a brokerage-license risk). It also duplicated the
 * canonical, live-data market page.
 *
 * Consolidate to ONE market surface instead of patching a dead duplicate:
 * permanently redirect to /housing-market/<city> (the getMarketPulse-backed
 * page). Reached today via the /housing-market/reports/<slug>/<geoName>
 * re-export, so this redirect covers that URL too.
 */
type PageProps = { params: Promise<{ slug: string; geoName: string }> }

export default async function LegacyReportGeoRedirect({ params }: PageProps) {
  const { slug, geoName } = await params
  const name = decodeURIComponent(geoName).trim()
  if (slug === 'city' && name) {
    permanentRedirect(`/housing-market/${slugify(name)}`)
  }
  // Community/other geos can't be mapped to the canonical /housing-market/<city>/
  // <community> URL without the parent city — send them to the live reports hub.
  permanentRedirect('/housing-market/reports')
}
