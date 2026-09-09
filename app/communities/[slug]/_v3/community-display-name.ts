/**
 * Route-local: what a /communities/<slug> page is allowed to CALL the place it
 * is about — or, when nothing honest resolves, the decision to refuse.
 *
 * THE DEFECT (SITE-28, verified live 2026-09-08, browser UA):
 *
 *   /communities/prineville-oll      <title> "Oll Homes for Sale | Prineville, OR …"   H1 "Oll homes for sale"
 *   /communities/madras-parkpl       <title> "ParkPL Homes for Sale | Madras, OR …"    H1 "ParkPL homes for sale"
 *   /communities/prineville-pleasvh  <title> "PleasVH Homes for Sale | Prineville, OR" H1 "PleasVH homes for sale"
 *
 * All three 200, 1,000+ words, under a licensed principal broker's name. "Oll",
 * "ParkPL" and "PleasVH" are MLS SubdivisionName ingest tokens; none is an
 * Oregon place name. A fabricated place name is the same §0 defect class as a
 * fabricated number, so the page either says a real name or it says nothing.
 *
 * IT IS THE NAME THAT IS WRONG, NOT THE ROUTE. Both of the other diagnoses were
 * refuted before this was built: the 365 compound URLs average GSC position
 * 19.82 against the class's own 19.82 and produce 22 of its 43 clicks, so this
 * is not a traffic defect; middleware already hard-404s slugs that are neither
 * city-prefixed nor registry and already 308s compound slugs naming a
 * registered community, so it is not a routing defect. And a blanket 404 would
 * delete pages ranking at position 1.0 (/communities/la-pine-ponderosa-park-phase-1,
 * /communities/redmond-odin-crest-estate). Fix the name, leave the route.
 *
 * WHAT COUNTS AS A REAL NAME — four sources, all recorded, none inferred:
 *
 *   1. The name is not an abbreviation at all. publishPlatDisplayName is the
 *      ONE definition of that test in this repo (lib/market/publish-plat-display-name.ts);
 *      it is what /subdivisions already uses, and it also title-cases
 *      ("Ridge At Eagle Crest" -> "Ridge at Eagle Crest"). Reused, not copied.
 *   2. A RECORDED expansion of the token, which that same module owns
 *      (Triple -> Triple Knot, "Farm (the)" -> The Farm).
 *   3. The REVIEWED alias map, data/subdivision-alias-plats.json — a human
 *      decided each row from geometry evidence and committed it.
 *   4. The county recorded-plat set: an EXACT geo_slug hit in public.boundaries
 *      yields that plat's own geo_label (getRecordedPlatLabel).
 *
 * Nothing else. In particular a geometry majority vote is NOT a source: measured
 * 2026-09-08, aspenb falls in 3 Aspen Heights phase plats, stoneth in 2
 * unrelated plats, clab in 28, so the vote would publish an arbitrary phase or
 * an unrelated plat as the page's name. The trace lives in
 * lib/data/subdivisions/getRecordedPlatLabel.ts.
 *
 * SCOPE. Only NON-canonical (compound) slugs are resolved. The 14 registry
 * communities carry curated labels from data/resort-communities.json and are
 * structurally incapable of this defect; leaving them alone also keeps
 * /communities/tetherow and /communities/brasada-ranch byte-identical.
 *
 * ROBOTS IS NOT TOUCHED. A refusing compound slug keeps the exact robots value
 * it already had ("noindex, follow", set by communityMetadataInput from
 * isCanonicalCommunitySlug). Refusal changes what the page SAYS, not whether it
 * is crawled — that half was already correct.
 */

import aliasPlats from '@/data/subdivision-alias-plats.json'
import { slugify } from '@/lib/slug'
import { publishPlatDisplayName, titleCasePlaceName } from '@/lib/market/publish-plat-display-name'

/**
 * The reviewed MLS-alias map, keyed by alias slug. Each row is a human decision
 * recorded in data/subdivision-alias-plats.json with its evidence; `mlsName` is
 * the visitor-facing spelling that file already publishes elsewhere
 * (lib/listing/listing-alias-plat-trail.ts reads the same rows).
 */
const REVIEWED_ALIAS_NAME: ReadonlyMap<string, string> = new Map(
  ((aliasPlats as { entries?: Array<{ aliasSlug?: string; mlsName?: string }> }).entries ?? [])
    .map((e) => [(e.aliasSlug ?? '').trim().toLowerCase(), (e.mlsName ?? '').trim()] as const)
    .filter(([k, v]) => Boolean(k) && Boolean(v)),
)

export type CommunityNameSource =
  | 'canonical-registry'
  | 'publishable-name'
  | 'reviewed-alias'
  | 'recorded-plat'

export type CommunityNameResolution =
  | { kind: 'publish'; name: string; source: CommunityNameSource }
  /** `withheld` is the raw token, for the trace only — it is never rendered. */
  | { kind: 'refuse'; withheld: string }

/**
 * Resolve, or refuse. `readRecordedPlatLabel` is injected so the unit test can
 * drive every branch without a database, the same shape walkPlatBoundaryCity
 * uses.
 */
export async function resolveCommunityDisplayName(input: {
  /** The raw name the page would otherwise publish (registry label, DB community name, or slug title-case). */
  rawName: string
  /**
   * The MLS SubdivisionName AS THE MLS SPELLS IT, when we hold it —
   * geo_snapshot_mv.geo_label at this community's geo_key.
   *
   * THIS FIELD IS WHY THE FIX COVERS THE CLASS AND NOT THREE URLS. The name a
   * compound slug otherwise carries has been through slugToTitle
   * (lib/community-slug.ts), which lowercases everything after the first
   * letter — and interior capitals are most of what makes an MLS token
   * recognisable. Measured on the first cut of this fix, 2026-09-08:
   * /communities/madras-parkpl refused (its DB community row spells it
   * "ParkPL") while /communities/bend-aspenb still published "Aspenb", because
   * slugToTitle had already destroyed the B. Same token, same defect, opposite
   * outcome — the test was reading evidence the URL had erased. The MV keeps
   * the MLS spelling exactly: AspenB, CLAS, ConifA, ParkPL, PleasVH, StoneTH,
   * and "Petrosa" for the real place, verified 2026-09-08. It is a read the
   * community page already makes and caches, so this costs nothing.
   *
   * Null when we hold no snapshot for the slug — then the URL-derived name is
   * all there is, and it is tested as-is ("Oll" still fails on its own).
   */
  mlsName?: string | null
  /** True for the 14 registry communities — their labels are curated, leave them alone. */
  isCanonicalSlug: boolean
  readRecordedPlatLabel: (slug: string) => Promise<string | null>
}): Promise<CommunityNameResolution> {
  const raw = (input.rawName ?? '').trim()
  if (input.isCanonicalSlug) {
    return { kind: 'publish', name: raw, source: 'canonical-registry' }
  }

  // The MLS spelling is the honest input to the abbreviation test. Fall back to
  // the URL-derived name only when we hold no MLS spelling at all.
  const token = (input.mlsName ?? '').trim() || raw

  // 1 + 2. Not an abbreviation, or a recorded expansion of one. Title-cased by
  // the same publisher /subdivisions uses, so the two routes cannot disagree.
  const publishable = publishPlatDisplayName(token)
  if (publishable) return { kind: 'publish', name: publishable, source: 'publishable-name' }

  // Withheld. The only remaining honest names are recorded ones, looked up on
  // the token's own slug — exactly, never by prefix (C-21).
  const key = slugify(token)
  if (!key) return { kind: 'refuse', withheld: token }

  // 3. The reviewed alias map (committed human decision + evidence).
  const reviewed = REVIEWED_ALIAS_NAME.get(key)
  if (reviewed) return { kind: 'publish', name: reviewed, source: 'reviewed-alias' }

  // 4. The county recorded-plat set. A read that fails answers null, and null
  // refuses — a degraded read must never become a published name (§0).
  const platLabel = (await input.readRecordedPlatLabel(key))?.trim()
  if (platLabel) {
    return { kind: 'publish', name: titleCasePlaceName(platLabel), source: 'recorded-plat' }
  }

  return { kind: 'refuse', withheld: token }
}
