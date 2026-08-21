import resortCommunitiesData from '@/data/resort-communities.json'
import { slugify } from '@/lib/slug'
import { resolveSubdivisionAreaRedirect } from '@/lib/subdivision-area-redirects'
import { PRIMARY_CITIES } from '@/lib/data/geo/report-cities'
import { BEND_NEIGHBORHOOD_DISTRICTS } from '@/lib/data/geo/neighborhood-public-inventory'
import { getIndexableOutOfAreaCities } from '@/lib/data/geo/getOutOfAreaCities'

type ResortEntry = { slug: string; subdivision_aliases: string[] }

/**
 * Every geo page that no longer prerenders at build (G70, ci:ssg-budget) or
 * whose heavy rails skip their fetch during SSG and refill on first
 * revalidation. The warm-geo-pages cron walks this list once per deployment so
 * the first real visitor — usually Googlebot — never eats a cold render.
 *
 * Derivations mirror the routes' own registries: subdivisions from
 * resort-communities.json aliases exactly as the route's old
 * generateStaticParams did; oregon from the same indexable top set the page
 * uses at render time.
 */
export async function buildWarmPaths(): Promise<string[]> {
  const communities = (resortCommunitiesData as { communities: ResortEntry[] }).communities

  const subdivisionSlugs = new Set<string>()
  for (const entry of communities) {
    for (const alias of entry.subdivision_aliases) {
      const slug = slugify(alias)
      if (!resolveSubdivisionAreaRedirect(slug)) subdivisionSlugs.add(slug)
    }
  }

  let oregonSlugs: string[] = []
  try {
    oregonSlugs = (await getIndexableOutOfAreaCities()).map((c) => c.slug)
  } catch {
    // Out-of-area pages warm on demand if the index read fails — the warmer
    // must never fail the whole run over its least important tier.
  }

  return [
    ...[...subdivisionSlugs].map((s) => `/subdivisions/${s}`),
    ...communities.map((c) => `/communities/${c.slug}`),
    ...PRIMARY_CITIES.map((c) => `/cities/${slugify(c)}`),
    ...BEND_NEIGHBORHOOD_DISTRICTS.map((d) => `/cities/bend/${d.slug}`),
    ...oregonSlugs.map((s) => `/oregon/${s}`),
  ]
}
