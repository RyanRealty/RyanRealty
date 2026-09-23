import { V3_ROOT_CLASS, V3Footer, V3_FOOTER_COLUMNS, V3Quiet } from '@/components/site/v3'
import { valuationHref } from '@/lib/site/valuation-href'
import { subdivisionDetailPath } from '@/lib/data/subdivisions/subdivision-index'
import { publishBrowsePairName, type BrowsePairFacts } from '@/lib/seo/browse-pair-decision'
import { homesForSalePath } from '../../../../lib/slug'

/** The recorded plat door for a refused area, when its slug is a printable plat. */
export function refusalPlatDoor(
  facts: Pick<BrowsePairFacts, 'areaSlug' | 'platLabel'> | null | undefined,
): { label: string; href: string } | null {
  const label = publishBrowsePairName(facts?.platLabel)
  return label && facts ? { label, href: subdivisionDetailPath(facts.areaSlug) } : null
}

/**
 * The heading (and page title) of the refusal. A slug that is a recorded plat
 * names a real place with no MLS search behind it, so the page says where that
 * place lives instead of "no area".
 */
export function searchAreaUnavailableHeading(plat: { label: string } | null | undefined): string {
  return plat ? `${plat.label} has its own page` : 'No area at this address'
}

export function searchAreaUnavailableBody(city: string | null, hasPlat: boolean): string {
  const where = city
    ? `The regional MLS has no listing under this name in ${city}, so there is nothing to search here.`
    : 'No home is for sale under this name here, and this search covers the Central Oregon cities we serve.'
  return hasPlat ? `${where} Its recorded plat is below.` : `${where} Here is where to look next.`
}

/**
 * The refusal body for a /homes-for-sale/{city}/{area}[/{preset}] URL whose
 * area segment names no place any source knows (SEO-1, visibility audit
 * 2026-09-22): not a boundary neighborhood, not a subdivision name the MLS has
 * ever filed in that city, not a registry community, not a preset.
 *
 * THE DEFECT IT REPLACES. Live 2026-09-23, /homes-for-sale/bend/p1-fixagent-
 * garbage-91 answered 200, "index, follow", a self canonical, and
 * "P1 Fixagent Garbage 91 homes for sale" as its title and H1, because the
 * route title-cased any unknown segment into a place name. Same mechanism and
 * answer as app/subdivisions/[slug]/SubdivisionUnavailable.tsx: the route
 * cannot answer 404 under app/loading.tsx, so it RENDERS the refusal with a
 * real <h1>, and SEARCH_AREA_UNAVAILABLE_METADATA (search-metadata.ts) keeps
 * the 200 out of the index with noindex,follow and no canonical.
 *
 * WHAT IT MAY CLAIM (§0: a null result is a fact about the reads, so the copy
 * names exactly what was read). `city` is passed only for a service-area city
 * (CENTRAL_OREGON_CITY_SLUGS): for those, the lifetime inventory MV covers
 * every status, so "no listing under this name in {city}" is what the read
 * says. It is NOT a claim about Central Oregon: the same words may name a place
 * in another city (/homes-for-sale/redmond/tetherow). Any other first segment
 * (an out-of-area city, or no city at all: /homes-for-sale/central-oregon/...)
 * was checked against homes for sale now and nothing else, so the copy says
 * only that, and prints no city (the segment may itself be invented).
 * Middleware sends a 1-segment out-of-area /homes-for-sale/{city} to /oregon;
 * the 2-segment shape reaches this route.
 *
 * When the slug is a recorded county plat the MLS never files a listing under
 * (a sub-plat of a resort, say), the plat page is the honest destination and
 * leads the doors.
 */
export function SearchAreaUnavailable({
  city,
  plat,
}: {
  /** A service-area city name, or null (see the note above). */
  city: string | null
  plat?: { label: string; href: string } | null
}) {
  const platDoor = plat ? [{ label: `The recorded plat of ${plat.label}`, href: plat.href }] : []
  const cityDoor = city ? [{ label: `${city} homes for sale`, href: homesForSalePath(city) }] : []
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3Quiet
          id="missing"
          heading={searchAreaUnavailableHeading(plat)}
          headingLevel={1}
          items={[
            { kind: 'prose', body: searchAreaUnavailableBody(city, Boolean(plat)) },
            ...platDoor,
            ...cityDoor,
            { label: 'Every recorded subdivision', href: '/subdivisions' },
            { label: 'Communities', href: '/communities' },
            { label: 'Homes for sale', href: '/homes-for-sale?view=list' },
            { label: 'Value my home', href: valuationHref('/homes-for-sale') },
            { label: 'Talk to a broker', href: '/contact' },
          ]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
