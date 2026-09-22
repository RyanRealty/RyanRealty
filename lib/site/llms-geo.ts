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
 */

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
