/**
 * Weekly market report — geographic scope lock.
 *
 * THE DEFECT (2026-08-19). Seven published weekly reports opened with a
 * Central Oregon claim over a statewide number. `/housing-market/reports/
 * weekly-2026-05-24` stored 38 city sections totalling 274 closed sales;
 * 26 of those cities — Medford 43, Grants Pass 17, Klamath Falls 14,
 * Central Point 13, Ashland, Talent, White City, Albany, Clackamas,
 * Portland, Salem … — are Southern Oregon / Willamette Valley, ~48% of the
 * closings, sitting directly under "Here's what happened in the Central
 * Oregon real estate market last week, by city."
 * Verified live 2026-08-19 (market_reports.content_html, city sections
 * parsed): weekly-2026-03-08 25/15 out-of-area, 03-22 27/20, 03-29 36/24,
 * 04-12 37/27, 05-10 32/20, 05-17 31/21, 05-24 38/26.
 *
 * THE CAUSE. The MLS/Spark feed is statewide and so is `listing_tile_mv`
 * (verified live: 76,925 Medford rows, 40,851 Grants Pass, 34,304 Klamath
 * Falls). The report generator never asserted a geography of its own — it
 * inherited whatever the tile DAL happened to return. `getListingTiles`
 * applies the service-area allowlist ONLY when the caller passes no
 * geographic predicate, so the closed-sales pull is protected today by
 * accident of call shape, and any call that passes listing keys, a city, or
 * a search query is not protected at all. An incidental filter is not a
 * scope.
 *
 * THE RULE. A report that says "Central Oregon" publishes Central Oregon
 * cities and nothing else, at both ends:
 *   • generation — `scopeReportCities` filters the by-city data before the
 *     HTML is built, so no new report can carry an out-of-area city.
 *   • render — `scopeReportHtml` drops out-of-area sections from stored
 *     rows in `getMarketReportBySlug`, so the seven already-published pages
 *     stop making the claim without waiting for a data repair, and every
 *     consumer of that read (page body, KPI headline, section parsers)
 *     sees one scoped document.
 *
 * The geography is `CENTRAL_OREGON_CITY_SLUGS` (lib/central-oregon.ts), the
 * same tri-county definition `lib/data/listings/service-area.ts` derives the
 * DAL allowlist from. There is no second list here on purpose.
 *
 * REMOVAL IS PROOF-ONLY. A section is dropped only when its city parses AND
 * resolves out of area. A section whose city cannot be parsed is KEPT and
 * counted in `unresolvedSections` — an unreadable heading is a parser
 * problem, not evidence that real closings are out of area, and blanking a
 * report on a format change would be its own §0 failure.
 *
 * Gate: `npm run ci:publish-report-city-scope`
 * (scripts/check-publish-report-city-scope.mjs).
 */

import { isCentralOregonCity } from '@/lib/central-oregon'

/** The geography every weekly report claims, in the words the report uses. */
export const REPORT_SCOPE_LABEL = 'Central Oregon'

/** True when a raw MLS city name may appear in a report that claims Central Oregon. */
export function isReportScopeCity(city: string | null | undefined): boolean {
  return isCentralOregonCity(city)
}

/**
 * Drop every by-city row outside the report's geography. Also drops the
 * `Other` bucket the by-city grouper uses for blank `City` values: a section
 * with no city cannot be shown to be in area, and an unattributable heading
 * under a Central Oregon claim is exactly the defect.
 */
export function scopeReportCities<T extends { city: string }>(rows: readonly T[]): T[] {
  return rows.filter((row) => isReportScopeCity(row.city))
}

/** One `<section>…</section>` block; the generator never nests them. */
const SECTION_RE = /<section\b[^>]*>[\s\S]*?<\/section>/g

/** `<h2 …><a …>Bend</a></h2>` and the unlinked `<h2 …>Bend</h2>` variant. */
const SECTION_CITY_RE = /<h2\b[^>]*>\s*(?:<a\b[^>]*>)?\s*([^<]+?)\s*(?:<\/a>\s*)?<\/h2>/

/** Reverse the generator's escapeHtml so `&amp;` compares as `&`. */
function decodeBasicEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

/** The city a report section is about, or null when the heading does not parse. */
export function reportSectionCity(section: string): string | null {
  const match = SECTION_CITY_RE.exec(section)
  if (!match) return null
  const city = decodeBasicEntities(match[1] ?? '').trim()
  return city || null
}

export type ScopedReportHtml = {
  /** The body with every proven out-of-area section removed. */
  html: string
  /** Cities removed, in document order. */
  removedCities: string[]
  /** Cities kept, in document order. */
  keptCities: string[]
  /** Sections whose heading did not parse — kept, never silently dropped. */
  unresolvedSections: number
}

/**
 * Remove the out-of-area city sections from a stored report body.
 * Idempotent: a body that is already in scope comes back byte-identical with
 * `removedCities` empty.
 */
export function scopeReportHtml(html: string | null | undefined): ScopedReportHtml {
  const source = html ?? ''
  const removedCities: string[] = []
  const keptCities: string[] = []
  let unresolvedSections = 0

  const scoped = source.replace(SECTION_RE, (section) => {
    const city = reportSectionCity(section)
    if (city == null) {
      unresolvedSections += 1
      return section
    }
    if (isReportScopeCity(city)) {
      keptCities.push(city)
      return section
    }
    removedCities.push(city)
    return ''
  })

  return {
    html: removedCities.length === 0 ? source : scoped,
    removedCities,
    keptCities,
    unresolvedSections,
  }
}
