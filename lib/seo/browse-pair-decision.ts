/**
 * browse-pair-decision — the ONE decision for a 2-segment
 * /homes-for-sale/{city}/{area} browse URL: does the area exist, what may the
 * page call it, may it be indexed, where does its canonical point, and does it
 * earn a sitemap slot. Pure and synchronous so it is vitest-pinned without any
 * infrastructure; the Supabase-facing assembly is ./getBrowsePairDecision.ts.
 *
 * BOTH consumers read it: app/search/[...slug]/search-metadata.ts (robots +
 * canonical at render) and app/sitemap.ts (which pairs are emitted). A page and
 * the sitemap can therefore never disagree about a pair (visibility audit
 * 2026-09-22, SEO-1 / SEO-6 / EXP-2 / EXP-4).
 *
 * THE DEFECTS IT CLOSES (live 2026-09-23, before this change):
 *   - SEO-1: /homes-for-sale/bend/p1-fixagent-garbage-91 and
 *     /homes-for-sale/prineville/p1-no-such-place both answered 200,
 *     "index, follow", a self canonical and an H1 title-cased from the slug
 *     ("P1 No Such Place homes for sale"). No code path asked whether the area
 *     existed, so the indexable URL space under every city was unbounded and
 *     the page printed invented place names (§0).
 *   - EXP-4 / SEO-6: 662 of the 1,815 sitemapped pairs are the MLS-name twin
 *     of an indexable /subdivisions/{slug} plat page of the same place (same
 *     city; 16 of them only across a word break, Deschutes RiverWoods /
 *     deschutes-river-woods), and 17 more the twin of a /communities page
 *     (live geo.xml and live MVs through this code, 2026-09-23).
 *   - EXP-2: 1,051 of the 1,815 had no listing for sale (646 of the 1,136
 *     that are not twins) and rendered one line of <main> text ("No homes
 *     match this search right now").
 *
 * THE RULE, in precedence order:
 *   1. community twin — the area is a registry resort community of this city:
 *      rel=canonical to /communities/{slug}, indexable, not emitted. (The
 *      legacy map already 301s /homes-for-sale/bend/tetherow and
 *      /homes-for-sale/bend/northwest-crossing the same way.)
 *   2. plat twin — the slug is in the indexable plat set
 *      (getIndexableSubdivisions: GIS polygon + >= 10 lifetime closed sales)
 *      AND it is this pair's place (same city; same slug or the same letters
 *      across a word break: BrowsePairFacts.cityPlat):
 *      rel=canonical to /subdivisions/{plat slug}, indexable, not emitted. A
 *      canonical, not a 301: the two pages are joined differently (MLS name vs
 *      polygon) and the browse page stays useful to a visitor who lands on it.
 *   3. withheld name — the MLS name is an ingest code publishPlatDisplayName
 *      refuses to print (Oww, AspenB, Cascade Vill Mob HP): noindex,follow, not
 *      emitted, and the page never prints the code as a place name.
 *   4. sold history — >= BROWSE_PAIR_MIN_LIFETIME_SALES closed sales under the
 *      name in this city: indexable and emitted. The page always has content:
 *      the listings when there are any, and the sold-history section always.
 *   5. live only — fewer sales on record but homes for sale now: indexable
 *      while it has them, never emitted (the emitted SET is decided on lifetime
 *      depth alone, so it does not flap as listings come and go).
 *   6. thin — neither: noindex,follow, not emitted.
 *   7. unresolved — every source was read and none knows the area: the
 *      refusal page, noindex,follow, no canonical, not emitted.
 *   8. unknown — no source named the area AND the inventory read failed: not
 *      a refusal (§0: unknown is not absent, and a slow query must not refuse
 *      a real place, the stance of app/subdivisions/[slug]'s degraded path),
 *      but nothing vouches for a name either, so the search renders with no
 *      place name printed and stays noindex,follow until a read resolves it.
 *      A failed plat-set read alone withdraws nothing: the pair keeps a self
 *      canonical on the page and its slot in the sitemap, both of which read
 *      the same cached set.
 *
 * GSC EVIDENCE for the rows leaving the index (Search Console API, page
 * dimension, 2026-08-24..09-20, joined to this classification of the live
 * geo.xml and the live MVs on 2026-09-23): thin 179 sitemapped pairs, 9 with
 * any impression, 22 impressions, 0 clicks; withheld 146, 4 with an
 * impression, 12 impressions, 0 clicks. The 1,815 sitemapped pairs together
 * earned 518 impressions and 8 clicks in those 28 days (plat twins 149 and 3,
 * sold-history 304 and 5). Refusals: of the 2-segment service-area URLs
 * Search Console saw, 13 resolve to nothing (20 impressions, 0 clicks); 11 of
 * them are recorded plat slugs the MLS never files a listing under (Bend's
 * south-bend-vacation-plat, 327 closed sales inside the polygon), and the
 * refusal keeps a door to that plat page. The three out-of-area URLs with a
 * click (medford/country-club-park, selma/cedarcrest-est,
 * crescent/ramey-acres-subdivision) each have a home for sale now, so the
 * active-name lookup resolves them (live-only) and they stay indexable. Owner
 * directive MATT 2026-09-23 ("nothing is permanent") covers taking the rest
 * out of the index; none of them is a page that earns clicks, so none needs a
 * 301.
 */

import { SUBDIVISION_INDEX_MIN_LIFETIME_SALES, subdivisionDetailPath } from '@/lib/data/subdivisions/subdivision-index'
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'

/**
 * Closed sales under one MLS name in one city for a browse pair to carry its
 * page on sold history alone, and to earn a sitemap slot. The plat index floor
 * (lib/data/subdivisions/subdivision-index.ts), so a browse page and a plat
 * page need the same sold depth to be submitted.
 */
export const BROWSE_PAIR_MIN_LIFETIME_SALES = SUBDIVISION_INDEX_MIN_LIFETIME_SALES

/** Lifetime counts for one (MLS city, MLS SubdivisionName slug) pair. */
export type BrowsePairInventory = {
  /** MLS SubdivisionName, case preserved (the filter the page runs). */
  mlsName: string
  /** Closed listings filed under the name with this city, every year on file. */
  closedLifetime: number
  /** Active + Active Under Contract now (PUBLIC_ACTIVE_STATUSES), as of the MV refresh. */
  activeNow: number
}

export type BrowsePairFacts = {
  citySlug: string
  areaSlug: string
  /**
   * The subdivision_city_inventory_mv pair, or null when the MV holds none.
   * Meaningful only when `inventoryKnown`.
   */
  inventory: BrowsePairInventory | null
  /** False when the MV read failed (its resilient fallback is an empty set). */
  inventoryKnown: boolean
  /**
   * The name the ACTIVE-listing lookup resolved (getSubdivisionNameFromSlug),
   * which sees a subdivision name that appeared after the MV's nightly refresh.
   */
  activeName: string | null
  /** Registry resort community serving this city, by slug or label slug. */
  community: { publicSlug: string; label: string } | null
  /**
   * The recorded plat this pair's name denotes IN THIS CITY: the plat whose
   * top MLS city (subdivision_plat_closed_mv.top_city_lower) is the pair's
   * city and whose slug is the area slug, or failing that the one plat whose
   * slug differs only in where the hyphens fall (the MLS files "Deschutes
   * RiverWoods", 3,046 closed in Bend, the county recorded
   * deschutes-river-woods). null when none, or when two plats would match.
   *
   * Same city, because a plat slug is county-wide and a browse slug is per
   * city: bend/north-rim (25 closed sales filed "North Rim" in Bend) is not
   * the Redmond plat north-rim. On 2026-09-23, 87 of the 758 exact slug
   * matches were a plat in another city, and 16 more same-city plats matched
   * only across a word break.
   */
  cityPlat: { slug: string; label: string } | null
  /** `cityPlat` is in the indexable plat set. null = the set could not be read. */
  platIndexable: boolean | null
  /**
   * Label of the recorded plat with exactly this slug, in any city: the
   * refusal page's door ("the recorded plat has its own page"), which makes
   * no claim about the city.
   */
  platLabel: string | null
}

export type BrowsePairKind =
  | 'community-twin'
  | 'plat-twin'
  | 'withheld-name'
  | 'sold-history'
  | 'live-only'
  | 'thin'
  | 'unresolved'
  | 'unknown'

export type BrowsePairDecision = {
  kind: BrowsePairKind
  /** robots index (always follow). */
  index: boolean
  /** Submitted in app/sitemap.ts. Implies `index` and a self canonical. */
  emit: boolean
  /** Root-relative rel=canonical target; null = emit no canonical (refusal). */
  canonicalPath: string | null
  /**
   * The place name the page may print. null = print none: the area is
   * unresolved, or its only name is an MLS code.
   */
  publicName: string | null
  /** The name the listings filter runs on (never printed when withheld). */
  filterName: string | null
}

export function browsePairPath(citySlug: string, areaSlug: string): string {
  return `/homes-for-sale/${citySlug}/${areaSlug}`
}

/**
 * The name a visitor may read, or null. publishPlatDisplayName withholds MLS
 * ingest codes; the MLS "Out of area; see remarks" sentinel is not a place
 * either (lib/slug getSubdivisionDisplayName used to print it as "See homes
 * nearby", which is not a name a page can be about).
 */
export function publishBrowsePairName(raw: string | null | undefined): string | null {
  const name = (raw ?? '').trim()
  if (!name || /^out of area\b/i.test(name)) return null
  return publishPlatDisplayName(name)
}

/**
 * The recorded plat that is the same place as this pair (`cityPlat`), or null.
 * The plat-twin canonical and the sold-history plat door both go through it; a
 * plat in another city (or with no city) is a different place that happens to
 * share the words.
 */
export function isSameCityPlat(
  facts: Pick<BrowsePairFacts, 'cityPlat'>,
): facts is Pick<BrowsePairFacts, 'cityPlat'> & { cityPlat: { slug: string; label: string } } {
  return facts.cityPlat != null && facts.cityPlat.slug.trim() !== ''
}

export function decideBrowsePair(facts: BrowsePairFacts): BrowsePairDecision {
  const self = browsePairPath(facts.citySlug, facts.areaSlug)
  const mlsName = facts.inventory?.mlsName ?? facts.activeName ?? null

  if (facts.community) {
    return {
      kind: 'community-twin',
      index: true,
      emit: false,
      canonicalPath: `/communities/${facts.community.publicSlug}`,
      publicName: facts.community.label,
      filterName: mlsName ?? facts.community.label,
    }
  }

  if (mlsName) {
    const published = publishBrowsePairName(mlsName)
    if (isSameCityPlat(facts) && facts.platIndexable === true) {
      return {
        kind: 'plat-twin',
        index: true,
        emit: false,
        canonicalPath: subdivisionDetailPath(facts.cityPlat.slug),
        publicName: published ?? publishBrowsePairName(facts.cityPlat.label),
        filterName: mlsName,
      }
    }
    if (!published) {
      return { kind: 'withheld-name', index: false, emit: false, canonicalPath: self, publicName: null, filterName: mlsName }
    }
    const closed = facts.inventory?.closedLifetime ?? 0
    const active = facts.inventory?.activeNow ?? 0
    if (closed >= BROWSE_PAIR_MIN_LIFETIME_SALES) {
      // platIndexable null (the plat set did not read) lands here too, and is
      // emitted with a self canonical: the render reads the same cached set, so
      // page and sitemap still agree, and that is exactly the pre-2026-09-23
      // state for one cache window rather than ~770 URLs withdrawn for it.
      return { kind: 'sold-history', index: true, emit: true, canonicalPath: self, publicName: published, filterName: mlsName }
    }
    // A name only the active-listing lookup knows is a subdivision that listed
    // after the MV's last refresh: it has homes for sale by construction.
    if (active > 0 || (!facts.inventory && facts.activeName)) {
      return { kind: 'live-only', index: true, emit: false, canonicalPath: self, publicName: published, filterName: mlsName }
    }
    return { kind: 'thin', index: false, emit: false, canonicalPath: self, publicName: published, filterName: mlsName }
  }

  if (!facts.inventoryKnown) {
    // Nothing positively resolved the area and the MV that would have is
    // unreadable. Not a refusal (§0: unknown is not absent, and this state
    // exists only while a cold cache meets a failed read), but nothing vouches
    // for the place either: render the search, print no place name, and keep
    // it out of the index until a read can say what it is.
    return { kind: 'unknown', index: false, emit: false, canonicalPath: self, publicName: null, filterName: null }
  }
  return { kind: 'unresolved', index: false, emit: false, canonicalPath: null, publicName: null, filterName: null }
}

/** The kinds whose page renders the refusal instead of a listings search. */
export function isRefusedBrowsePair(decision: Pick<BrowsePairDecision, 'kind'>): boolean {
  return decision.kind === 'unresolved'
}
