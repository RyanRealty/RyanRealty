/**
 * Geo families the AI crawler map (/llms.txt) must list beside the sitemap.
 *
 * Cities, communities, neighborhoods, and indexable subdivisions already come
 * from the same sources app/sitemap.ts uses. ZIP pages and city housing-market
 * pages did not — live /llms.txt on 2026-09-22 had zero /zip/* and zero
 * /housing-market/{city} URLs, so ChatGPT/Perplexity could not be handed the
 * citable ZIP or market-report URL from the map.
 *
 * ZIP members must stay byte-identical to CANONICAL_ZIPS + ZIP_AREA in
 * app/zip/[zip]/_v3/zip-constants.ts (parity test).
 *
 * G39 markers: /zip/97703 and /housing-market/bend must stay on the served map.
 *
 * AEO-4 (visibility audit 2026-09-22): the city property-type pages
 * (/cities/{city}/types/{type}) were on no crawler map at all, the plat list
 * (2,642 lines, 91% of the file) moved to its own linked file, and the file
 * listed three pillars twice. The helpers below cover all three.
 */
import { slugify } from '@/lib/slug'
import { PLACE_TYPE_PAGE_SLUGS } from '@/lib/place/publish-place-type-cards'
import { resolvePlaceTypePage } from '@/lib/place/place-type-page'

/** The secondary AI map that holds one line per recorded subdivision page. */
export const LLMS_SUBDIVISIONS_PATH = '/llms-subdivisions.txt'

export const LLMS_ZIPS = [
  { zip: '97701', area: 'Bend NE' },
  { zip: '97702', area: 'Bend SE' },
  { zip: '97703', area: 'Bend West' },
  { zip: '97707', area: 'Sunriver' },
  { zip: '97739', area: 'La Pine' },
  { zip: '97741', area: 'Madras' },
  { zip: '97754', area: 'Prineville' },
  { zip: '97756', area: 'Redmond' },
  { zip: '97759', area: 'Sisters' },
  { zip: '97760', area: 'Terrebonne' },
] as const

export function zipLlmsLines(siteUrl: string): string[] {
  const base = siteUrl.replace(/\/$/, '')
  return LLMS_ZIPS.map((z) => `- ${z.zip} (${z.area}): ${base}/zip/${z.zip}`)
}

export function marketCityLlmsLines(
  siteUrl: string,
  slugs: readonly string[],
  label: (slug: string) => string,
): string[] {
  const base = siteUrl.replace(/\/$/, '')
  return slugs.map((slug) => `- ${label(slug)} housing market: ${base}/housing-market/${slug}`)
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * One line per city property-type page, for every city the type route
 * prerenders (its generateStaticParams: PRIMARY_CITIES x PLACE_TYPE_PAGE_SLUGS),
 * each with a one-line description. No counts: a number here would be a
 * second copy of a live figure with no read behind it (section 0).
 */
export function cityTypeLlmsLines(siteUrl: string, cityNames: readonly string[]): string[] {
  const base = siteUrl.replace(/\/$/, '')
  const out: string[] = []
  for (const city of cityNames) {
    const citySlug = slugify(city)
    for (const typeSlug of PLACE_TYPE_PAGE_SLUGS) {
      const spec = resolvePlaceTypePage(typeSlug)
      if (!spec || !citySlug) continue
      const noun = capitalize(spec.nounMany)
      out.push(
        `- [${noun} in ${city}](${base}/cities/${citySlug}/types/${spec.slug}): ${noun} for sale in ${city}, Oregon, from the regional MLS, with list prices, photos, and a map.`,
      )
    }
  }
  return out
}

/** The first absolute URL on an llms.txt line, without a closing parenthesis. */
export function llmsLineUrl(line: string): string | null {
  const m = line.match(/https?:\/\/[^\s)]+/)
  return m ? m[0] : null
}

/**
 * Drop every line whose URL an earlier line already listed. `seen` is shared
 * across the whole file, so the first section to list a URL keeps it. A line
 * with no URL is kept.
 */
export function dedupeLlmsLines(lines: readonly string[], seen: Set<string>): string[] {
  const kept: string[] = []
  for (const line of lines) {
    const url = llmsLineUrl(line)
    if (url) {
      const key = url.replace(/\/$/, '')
      if (seen.has(key)) continue
      seen.add(key)
    }
    kept.push(line)
  }
  return kept
}
