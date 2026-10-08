/**
 * ON THE SUBJECT'S GROUND: ONE DECISION FOR EVERY READ.
 *
 * Reader review 2026-10-08. The letters asked "is this home in the subject's
 * own subdivision, or in the area the letter names" in five places, and each
 * place answered with an exact match: the MLS SubdivisionName typed on the
 * row, or one recorded plat slug. One plat has several MLS spellings and the
 * county records one subdivision as several plats, so homes on the subject's
 * own ground were missed:
 *
 *   - 1355 Jacksonville sits in the recorded plat Northwest Townsite Second
 *     Addition. The MLS spells that plat "Northwest Townsite" and "Northwest
 *     Townsite Co 2nd Addt". The comp search asked SubdivisionName ILIKE
 *     'Northwest Townsite' and never saw 1367 Milwaukee (same plat, "Co 2nd
 *     Addt", closed Mar 31 2025 at $645,000), the place block counted five
 *     sales where the plat holds about twenty-five, and the came-off read
 *     never saw 1425 Fresno.
 *   - 915 Saginaw's competition area lists the plats Kenwood and West Hills
 *     Fifth Addition. 733 Saginaw (MLS "Kenwood") sits in Kenwood First
 *     Addition and 1340 Trenton (MLS "West Hills") in West Hills, so both
 *     under-contract homes were dropped and the letter said none was.
 *
 * THE DECISION, in order (one function, `platGroundReach`):
 *
 *   1. A row a recorded plat polygon holds is on the ground when that plat is
 *      one of the ground's plats, a phase of the same ordinary subdivision
 *      (`samePlat`, Matt 2026-10-06), or a sibling plat the reviewed MLS alias
 *      map files under the same MLS name (data/subdivision-alias-plats.json,
 *      geometry verified). Every MLS spelling of those plats is accepted,
 *      because the polygon decides, not the typed name (rule 24, Matt
 *      2026-10-07: "Plat membership is the recorded polygon the home sits
 *      in, and the MLS subdivision name only when no polygon holds it").
 *   2. Otherwise it is on the ground when its plat is in the same subdivision
 *      FAMILY as one of the ground's plats (the site's own family rule,
 *      `sameSubdivisionFamily` in lib/pricing/price-anchor.ts, the
 *      ci:plat-families grouping: Kenwood and Kenwood First Addition, West
 *      Hills and its five additions, Holliday Park and its additions) AND the
 *      row sits inside the same City of Bend neighborhood or community
 *      polygon as the ground. The family is grouped by name and town, so a
 *      namesake across town is not this ground: Northwest Townsite First
 *      Addition is in Larkspur, Park Place Phase I in Southwest Bend. Off the
 *      mesh the read's own city bound is the limit, as before.
 *   3. A row no polygon holds (or one nobody tested) is on the ground by its
 *      MLS name only: one of the ground's names, or the MLS name the alias map
 *      files the ground's plats under.
 *
 * A ground with no recorded plat (a home no polygon holds) decides by name
 * alone, exactly as every read did before.
 *
 * Pure: no I/O. The reads that need rows inside the ground's outline before
 * this test can run them get the outline from lib/data/cma/platGroundBounds.ts.
 */

import { ALIAS_PLAT_ENTRIES } from '@/lib/market/alias-plat-graph'
import { ordinaryPhaseFamilyKey } from '@/lib/cma/community-location'
import { resolveMarketArea } from '@/lib/cma/market-area'
import { citySlug, normSubdivision } from '@/lib/pricing/classes'
import { subdivisionFamilyKey } from '@/lib/pricing/price-anchor'

export type PlatGround = {
  /** The recorded plats the ground is, with their alias-map siblings. Lower case, unique. */
  platSlugs: readonly string[]
  /** MLS names (normSubdivision keys) that name the ground for a row no polygon holds. */
  names: readonly string[]
  /**
   * MLS names (normSubdivision keys) of places in the ground that carry no
   * polygon of their own. A row inside some other polygon still counts by one
   * of these names (the comp area's `namesWithoutPlat`).
   */
  unplattedNames: readonly string[]
  /**
   * The City of Bend neighborhood or community polygon the ground sits in
   * (resolveMarketArea). A plat that is only a family member counts inside it
   * and nowhere else. Null when the ground sits in no polygon.
   */
  parent: string | null
  /**
   * The town the ground is in (citySlug), when the caller named one. A family
   * plat on a row that names another town is never this ground, so a namesake
   * in another town stays out; off the mesh (no parent) this is the family's
   * only wall. Absent, or a row with no town: no town test.
   */
  town?: string | null
}

export type PlatGroundInput = {
  platSlugs?: ReadonlyArray<string | null | undefined> | null
  names?: ReadonlyArray<string | null | undefined> | null
  unplattedNames?: ReadonlyArray<string | null | undefined> | null
  /** The town the ground is in. The alias map is filed by town; a name in another town is not expanded. */
  city?: string | null
  /** The neighborhood or community polygon slug. Pass `parentOf(lat, lng)` for the subject. */
  parent?: string | null
}

/** How a row reached the ground. */
export type PlatGroundReach = 'plat' | 'family' | 'name'

/** A row as the decision reads it. */
export type PlatGroundRow = {
  /**
   * The recorded plat polygon the row's point sits in. A slug when one holds
   * it; null when the point was tested and none does; undefined when nobody
   * tested it. Only a slug is a polygon.
   */
  platSlug?: string | null
  /** MLS SubdivisionName, as typed. */
  subdivision?: string | null
  latitude?: number | null
  longitude?: number | null
  /**
   * The neighborhood or community polygon the row's point sits in, when the
   * caller already resolved it (parentOf, as the facts pool stamps
   * `marketArea`). Absent: resolved from the point.
   */
  marketArea?: string | null
  /** The row's town. Off the mesh a family plat in another town is not the ground. Absent: no town test. */
  city?: string | null
}

function slugKey(slug: string | null | undefined): string | null {
  const s = (slug ?? '').trim().toLowerCase()
  return s ? s : null
}

function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)]
}

/** The neighborhood or community polygon a point sits in, or null. */
export function parentOf(latitude: number | null | undefined, longitude: number | null | undefined): string | null {
  return resolveMarketArea(latitude ?? null, longitude ?? null)
}

/**
 * Build a ground. Seeds are the plats and names the caller knows; the
 * reviewed alias map adds the sibling plats and the MLS name of any entry a
 * seed plat or a seed name belongs to, in the same town.
 */
export function platGround(input: PlatGroundInput): PlatGround {
  const plats = new Set<string>()
  for (const s of input.platSlugs ?? []) {
    const k = slugKey(s)
    if (k) plats.add(k)
  }
  const names = new Set<string>()
  for (const n of input.names ?? []) {
    const k = normSubdivision(n)
    if (k) names.add(k)
  }
  const town = input.city?.trim() ? citySlug(input.city) : null
  const seeds = new Set(plats)
  const seedNames = new Set(names)
  for (const entry of ALIAS_PLAT_ENTRIES) {
    const members = entry.memberPlats.map((m) => m.slug)
    const byPlat = members.some((m) => seeds.has(m))
    const entryName = normSubdivision(entry.mlsName)
    const sameTown = town == null || citySlug(entry.city) === town
    const byName = sameTown && entryName != null && seedNames.has(entryName)
    if (!byPlat && !byName) continue
    for (const m of members) plats.add(m)
    if (entryName) names.add(entryName)
  }
  const unplatted = new Set<string>()
  for (const n of input.unplattedNames ?? []) {
    const k = normSubdivision(n)
    if (k) unplatted.add(k)
  }
  return {
    platSlugs: unique(plats),
    names: unique(names),
    unplattedNames: unique(unplatted),
    parent: slugKey(input.parent),
    town,
  }
}

type PlatGroundPoint = Pick<PlatGroundRow, 'latitude' | 'longitude' | 'marketArea' | 'city'>

/**
 * Where a family plat may count: in the ground's own town when both towns are
 * known (the family is grouped by name and town, and the reads' own city
 * bound is made explicit so a stamp read off any rung holds it too), and
 * inside the ground's parent polygon when it has one.
 */
function familyWallAdmits(ground: PlatGround, row: PlatGroundPoint): boolean {
  const town = ground.town ?? null
  if (town && row.city?.trim() && citySlug(row.city) !== town) return false
  if (!ground.parent) return true
  const here = row.marketArea !== undefined ? slugKey(row.marketArea) : parentOf(row.latitude, row.longitude)
  return here != null && here === ground.parent
}

/**
 * How one recorded plat relates to a ground's plats, ignoring where the row
 * sits: 'plat' is `samePlat` against one of them (the plat itself or a phase
 * of the same ordinary subdivision), 'family' is `sameSubdivisionFamily`
 * against one of them and not 'plat'. Read off the two keys those tests
 * compare (ordinaryPhaseFamilyKey, subdivisionFamilyKey), precomputed once per
 * ground and once per plat, so a read can ask it for every recorded plat in
 * the county without rebuilding a family test per pair. Held equal to the
 * pairwise tests by lib/pricing/plat-ground.test.ts.
 */
type PlatMatcher = (plat: string) => 'plat' | 'family' | null

const matchers = new WeakMap<PlatGround, PlatMatcher>()

function matcherOf(ground: PlatGround): PlatMatcher {
  const known = matchers.get(ground)
  if (known) return known
  const exact = new Set(ground.platSlugs)
  const phaseKeys = new Set<string>()
  const familyKeys = new Set<string>()
  for (const g of ground.platSlugs) {
    const phase = ordinaryPhaseFamilyKey(g)
    if (phase) phaseKeys.add(phase)
    const family = subdivisionFamilyKey(g)
    if (family) familyKeys.add(family)
  }
  const memo = new Map<string, 'plat' | 'family' | null>()
  const match: PlatMatcher = (plat) => {
    const seen = memo.get(plat)
    if (seen !== undefined) return seen
    let out: 'plat' | 'family' | null = null
    if (exact.has(plat)) out = 'plat'
    else {
      const phase = ordinaryPhaseFamilyKey(plat)
      if (phase && phaseKeys.has(phase)) out = 'plat'
      else {
        const family = subdivisionFamilyKey(plat)
        if (family && familyKeys.has(family)) out = 'family'
      }
    }
    memo.set(plat, out)
    return out
  }
  matchers.set(ground, match)
  return match
}

/**
 * How a recorded plat relates to the ground: the same plat (or a phase, or an
 * alias sibling), a family member inside the ground's parent polygon, or
 * neither. The point is read only for the family test.
 */
export function platReach(
  ground: PlatGround,
  platSlug: string | null | undefined,
  at: PlatGroundPoint = {},
): 'plat' | 'family' | null {
  const plat = slugKey(platSlug)
  if (!plat || ground.platSlugs.length === 0) return null
  const relation = matcherOf(ground)(plat)
  if (relation === 'family') return familyWallAdmits(ground, at) ? 'family' : null
  return relation
}

/**
 * The recorded plats of a list (the county's, say) that relate to the ground,
 * split by relation, with no point read: 'plat' plats are the ground wherever
 * they sit, 'family' plats only inside the ground's parent polygon. The
 * outline read (lib/data/cma/platGroundBounds.ts) draws its box from these.
 */
export function relatedPlats(
  ground: PlatGround,
  platSlugs: Iterable<string>,
): { plat: string[]; family: string[] } {
  const out = { plat: [] as string[], family: [] as string[] }
  if (ground.platSlugs.length === 0) return out
  const match = matcherOf(ground)
  for (const s of platSlugs) {
    const plat = slugKey(s)
    if (!plat) continue
    const relation = match(plat)
    if (relation === 'plat') out.plat.push(plat)
    else if (relation === 'family') out.family.push(plat)
  }
  return { plat: unique(out.plat), family: unique(out.family) }
}

/**
 * THE DECISION. How a row reached the ground, or null when it is not on it.
 * The polygon first when the ground has recorded plats and the row sits in
 * one; the MLS name only for a row no polygon holds, or a ground with no
 * recorded plat.
 */
export function platGroundReach(ground: PlatGround, row: PlatGroundRow): PlatGroundReach | null {
  const name = normSubdivision(row.subdivision ?? null)
  const plat = slugKey(row.platSlug)
  if (plat && ground.platSlugs.length > 0) {
    const reach = platReach(ground, plat, row)
    if (reach) return reach
    return name != null && ground.unplattedNames.includes(name) ? 'name' : null
  }
  return name != null && ground.names.includes(name) ? 'name' : null
}

/** True when the row is on the ground (platGroundReach). */
export function onPlatGround(ground: PlatGround, row: PlatGroundRow): boolean {
  return platGroundReach(ground, row) != null
}

/**
 * The subject's own ground: the recorded plat its point sits in (the
 * selector's `subdivisionSlug`), its MLS name, its town, and the neighborhood
 * or community polygon around it.
 */
export function subjectPlatGround(subject: {
  subdivision?: string | null
  subdivisionSlug?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
}): PlatGround {
  return platGround({
    platSlugs: [subject.subdivisionSlug],
    names: [subject.subdivision],
    city: subject.city ?? null,
    parent: parentOf(subject.latitude, subject.longitude),
  })
}

/**
 * THE SUBJECT'S OWN SUBDIVISION, FOR EVERY RULE THAT ASKS (Matt 2026-10-08,
 * "Yes, everywhere"): a recorded addition or phase of the subject's
 * subdivision that sits in the same neighborhood counts as the subject's own
 * subdivision in the comp search (both ladders' own-plat rungs), the pricing
 * weights (same subdivision, weight 3), the price-line exemption, the room
 * rule's own ground (rule 4), the pocket rules (rule 5), the price anchor's
 * plat level, the own-ground date gate, the review, and the competition and
 * came-off homes. One decision, `platGroundReach` on the subject's ground:
 * the recorded polygon first (the plat, a phase of it, an alias sibling, or a
 * family plat inside the subject's neighborhood or community polygon), the
 * MLS name only for a row no polygon holds. Before this ruling the facts
 * ladder asked `samePlat` (the plat or a phase of it) while the listings
 * ladder asked this, so for a Kenwood subject a Kenwood First Addition sale
 * weighed 3 on one ladder and 2 on the other.
 *
 * A superset of `samePlat`: every pair samePlat calls own plat stays own
 * plat, except that a subject the alias map gives recorded plats by name
 * decides by polygon, as the listings ladder does.
 */
export type OwnPlatSubject = {
  subdivision?: string | null
  /** normSubdivision of the MLS name (or an inferred pocket's), preferred over `subdivision` when present. */
  subdivisionNorm?: string | null
  /** The recorded plat the subject's point sits in. */
  subdivisionSlug?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  /** The subject's neighborhood or community polygon, when already resolved; read from the point when absent. */
  marketArea?: string | null
}

export type OwnPlatSale = {
  /** The recorded plat the sale's point sits in: a slug, null when none holds it, undefined when untested. */
  subdivisionSlug?: string | null
  subdivision?: string | null
  subdivisionNorm?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  /** The sale's neighborhood or community polygon, when already resolved; read from the point when absent. */
  marketArea?: string | null
}

const ownGrounds = new WeakMap<object, { key: string; ground: PlatGround }>()

function ownNameOf(x: { subdivisionNorm?: string | null; subdivision?: string | null }): string | null {
  return x.subdivisionNorm ?? x.subdivision ?? null
}

/**
 * The subject's own ground (subjectPlatGround), built once per subject object
 * and rebuilt when a field it reads changes, so a walk can ask it per sale.
 */
export function ownPlatGround(subject: OwnPlatSubject): PlatGround {
  const name = ownNameOf(subject)
  // A resolved polygon is taken as given; a blank one is read from the point
  // (parentOf returns null off the mesh, so the answer is the same).
  const area = subject.marketArea?.trim() || null
  const where = area ? `area:${area}` : `at:${subject.latitude ?? ''},${subject.longitude ?? ''}`
  const key = `${subject.subdivisionSlug ?? ''}|${name ?? ''}|${subject.city ?? ''}|${where}`
  const known = ownGrounds.get(subject)
  if (known && known.key === key) return known.ground
  const ground = platGround({
    platSlugs: [subject.subdivisionSlug],
    names: [name],
    city: subject.city ?? null,
    parent: area ?? parentOf(subject.latitude, subject.longitude),
  })
  ownGrounds.set(subject, { key, ground })
  return ground
}

/** How a sale reached the subject's own subdivision ('plat', 'family' or 'name'), or null when it is not in it. */
export function ownPlatReach(subject: OwnPlatSubject, sale: OwnPlatSale): PlatGroundReach | null {
  const area = sale.marketArea?.trim() || null
  return platGroundReach(ownPlatGround(subject), {
    platSlug: sale.subdivisionSlug,
    subdivision: ownNameOf(sale),
    latitude: sale.latitude ?? null,
    longitude: sale.longitude ?? null,
    ...(area ? { marketArea: area } : {}),
    city: sale.city ?? null,
  })
}

/** True when the sale is in the subject's own subdivision (ownPlatReach). */
export function onOwnPlat(subject: OwnPlatSubject, sale: OwnPlatSale): boolean {
  return ownPlatReach(subject, sale) != null
}

/**
 * How a subdivision read was scoped, for its §0 source line. The MLS name
 * alone when the ground has no recorded plat; otherwise the plats (any MLS
 * spelling), the family wall, and the name for rows no polygon holds.
 */
export function subdivisionScopeTrace(subdivision: string, ground: PlatGround): string {
  if (ground.platSlugs.length === 0) return `SubdivisionName='${subdivision}'`
  const family = ground.parent
    ? `plats of its subdivision family inside ${ground.parent}`
    : 'plats of its subdivision family in the same city'
  return `inside the recorded plat ${ground.platSlugs.join(', ')} under any MLS spelling, or ${family}, or SubdivisionName='${subdivision}' where no polygon holds the row`
}

/**
 * The ground's plats in words, for a §0 trace: "the recorded plat
 * northwest-townsite-second-addition (any MLS spelling), its subdivision
 * family inside bend-river-west".
 */
export function platGroundTrace(ground: PlatGround): string {
  if (ground.platSlugs.length === 0) {
    return ground.names.length > 0 ? `SubdivisionName IN (${ground.names.map((n) => `'${n}'`).join(', ')})` : 'no ground'
  }
  const plats = ground.platSlugs.join(', ')
  const family = ground.parent ? `its subdivision family inside ${ground.parent}` : 'its subdivision family in the same city'
  const names = ground.names.length > 0 ? `; the MLS name (${ground.names.join(', ')}) only where no polygon holds the row` : ''
  return `the recorded plat polygon (${plats}, any MLS spelling), ${family}${names}`
}
