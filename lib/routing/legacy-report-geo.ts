/**
 * Legacy per-geo market report → the live market surface, resolved at the edge.
 *
 * THE ROUTES
 *   /reports/<slug>/<geoName>
 *   /housing-market/reports/<slug>/<geoName>   (the same page, re-exported)
 *
 * Both read the DROPPED `reporting_cache` table, so every metric resolved to
 * null while the page still printed a market-condition verdict — an unsourced
 * verdict in front of a lead (CLAUDE.md §0). They were consolidated onto the
 * live pages by a page-body `permanentRedirect()`, which under Next 16 could
 * not write a Location header: the segment's loading.tsx boundary had already
 * flushed the shell. Measured on ryan-realty.com 2026-08-19, browser UA,
 * redirect:manual:
 *
 *   /housing-market/reports/city/Bend  ->  200, Location: null, 0 <h1>
 *   /reports/city/Bend                 ->  308  /housing-market/reports/city/Bend
 *
 * next.config.ts was 308-ing the legacy family straight INTO the blank page. The
 * hop now happens here, before render, in ONE step.
 *
 * DESTINATIONS — identical to what the page body chose:
 *   slug 'city'  ->  /housing-market/<slugified geo>   (the getMarketPulse page)
 *   anything else ->  /housing-market/reports          (the live reports hub)
 */

/**
 * Real 2-segment routes under /housing-market/reports that are NOT the legacy
 * per-geo report and must pass through untouched.
 *   app/housing-market/reports/archive/[city]/page.tsx
 *   app/reports/sales/[city]/[period]/page.tsx  (4 segments; listed for safety)
 */
const RESERVED_FIRST_SEGMENTS = new Set(['archive', 'sales'])

/** Same normalization as `slugify` in lib/slug.ts. */
function slugifyGeo(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'unknown'
  )
}

const LEGACY_REPORT_GEO = /^\/(?:housing-market\/)?reports\/([^/]+)\/([^/]+)\/?$/

/**
 * The canonical destination for a legacy per-geo report URL, or null when the
 * pathname is not one.
 */
export function resolveLegacyReportGeoRedirect(pathname: string): string | null {
  const m = pathname.match(LEGACY_REPORT_GEO)
  if (!m) return null

  let slug = m[1]
  let geoName = m[2]
  try {
    slug = decodeURIComponent(slug)
    geoName = decodeURIComponent(geoName)
  } catch {
    /* malformed escape — fall back to the raw segments */
  }
  if (RESERVED_FIRST_SEGMENTS.has(slug.toLowerCase())) return null

  if (slug.toLowerCase() === 'city') {
    const geo = slugifyGeo(geoName)
    // slugifyGeo never returns '' (it falls back to 'unknown'); an unknown geo
    // is better served by the hub than by a guaranteed 404.
    if (geo && geo !== 'unknown') return `/housing-market/${geo}`
  }
  return '/housing-market/reports'
}
