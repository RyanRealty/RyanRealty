/**
 * THE AREA THE COMPS CAME FROM — one object, derived, never re-searched.
 *
 * Matt, 2026-09-08: "when we show expired listings, we want to use the same
 * area that we searched and where we actually retrieved comps. That's going to
 * be the same set where we pull our expireds, withdrawn, or canceled. Same
 * thing with the competition: we want to limit it to the neighborhood or
 * community. Unless it's not part of that, then we'll have to use a radius."
 *
 * Before this, three sections of one document each drew their own geography:
 * the sales came off the pricing ladder (subdivision, then a mile, then the
 * similar subdivisions), the unsold peers came off a CITY-WIDE 12-month pull
 * narrowed to a price band, and the competition came off a CITY-WIDE band read.
 * A seller in Diamond Bar Ranch was shown five sales from their own street, a
 * set of expired listings from anywhere in Redmond, and a competition set from
 * anywhere in Redmond — three different maps under one price.
 *
 * `buildCompArea` derives ONE area from what the search actually kept:
 *
 *   1. every kept sale came from a subdivision rung → the union of their
 *      subdivisions;
 *   2. else a boundary rung supplied a kept sale → the GIS neighborhood or
 *      community polygon the subject sits in;
 *   3. else the radius the widest rung THAT KEPT A SALE used.
 *
 * Nothing here queries anything. It reads `compSearch.rungs` (the counted
 * ladder) and the sales the document prints, so the area can never claim a
 * geography the printed set does not support.
 */

import polygonData from '@/data/bend/bend-neighborhood-polygons.json'
import {
  distanceMiles,
  marketAreaBounds,
  radiusBounds,
  resolveMarketArea,
  type LatLngBounds,
} from '@/lib/cma/market-area'
import { usableSubdivision } from '@/lib/pricing/comp-search'
import { countWord } from '@/lib/pricing/estimate'
import { POCKET_RADIUS_MILES } from '@/lib/pricing/infer-pocket'
import { ownPlatGround, parentOf, platGround, platReach, type PlatGround } from '@/lib/pricing/plat-ground'
import { streetKey } from '@/lib/pricing/price-anchor'

export type CompAreaKind =
  | 'subdivision'
  | 'subdivisions'
  | 'neighborhood'
  | 'community'
  | 'radius'
  | 'city'

export type CompArea = {
  kind: CompAreaKind
  /** Subdivision names, the boundary name, or the city. Empty on a bare radius. */
  names: string[]
  /** Set only on `radius`. Miles from `centre`. */
  radiusMiles: number | null
  /** The subject's coordinates. Null when the MLS row carries none. */
  centre: { lat: number; lng: number } | null
  /** §0 trace: which rungs, how many of the printed sales, and the rule that fired. */
  source: string
  /** The area in seller language, as one sentence. */
  sentence: string
  /**
   * The recorded plat polygons a plat area holds whole: the subject's own
   * plat and every plat a printed sale sits in, except a plat only the
   * subject's own street reached (Matt 2026-10-07, rule 24). A row with a
   * recorded polygon is a member when its plat is one of these, a phase of
   * the same ordinary subdivision, or a family plat inside the subject's
   * neighborhood polygon (platReach, the walks' own ground decision). Absent
   * on an area stored before this landed; the names then decide alone.
   */
  platSlugs?: string[]
  /** Names in the area whose sales carry no recorded polygon. Those are tested by name. */
  namesWithoutPlat?: string[]
  /**
   * A plat only the own-street rung reached is in the area on the subject's
   * street and nowhere else. The street sale does not make its whole
   * subdivision the competition area (3037 Purcell, 2026-10-07).
   */
  street?: { key: string; names: string[]; platSlugs: string[] } | null
}

/** One rung of the counted ladder — the shape `compSearch.rungs` already has. */
export type CompAreaRung = { key: string; kept: number; added: number }

/** A sale the document prints. */
export type CompAreaKeptComp = {
  subdivision?: string | null
  /** The recorded plat polygon the sale sits in, when one holds it. */
  subdivisionSlug?: string | null
  selectionTier?: string | null
  latitude?: number | null
  longitude?: number | null
  /** The selector's own-plat stamp (CmaComp.ownPlat). Absent on rows stored before 2026-10-08. */
  ownPlat?: boolean | null
}

/**
 * A printed sale on the subject's own ground: the selector stamped it own
 * plat, or its recorded plat is the subject's own subdivision by the one
 * ground decision (onOwnPlat in lib/pricing/plat-ground.ts: the plat, a phase
 * of it, an alias sibling, or a recorded addition or phase of its family
 * inside the subject's neighborhood or community polygon, Matt 2026-10-08
 * "Yes, everywhere"). Its MLS spelling does not decide it, and neither does
 * the rung's name alone.
 */
export function keptOnOwnGround(
  subject: OwnPlatAreaSubject,
  c: Pick<CompAreaKeptComp, 'ownPlat' | 'subdivisionSlug'> & Partial<Pick<CompAreaKeptComp, 'latitude' | 'longitude'>>,
): boolean {
  if (c.ownPlat === true) return true
  const subjectSlug = (subject.subdivisionSlug ?? '').trim()
  const saleSlug = (c.subdivisionSlug ?? '').trim()
  return Boolean(subjectSlug && saleSlug && ownPlatOf(subject)(saleSlug, c))
}

type OwnPlatAreaSubject = Pick<CompAreaSubject, 'subdivisionSlug'> &
  Partial<Pick<CompAreaSubject, 'subdivision' | 'latitude' | 'longitude' | 'city'>>

/**
 * The subject's own-subdivision test on a recorded plat (the polygon only,
 * never the MLS name): onOwnPlat's 'plat' or 'family' reach.
 */
function ownPlatOf(
  subject: OwnPlatAreaSubject,
): (slug: string, at?: { latitude?: number | null; longitude?: number | null }) => boolean {
  const subjectSlug = clean(subject.subdivisionSlug)
  if (!subjectSlug) return () => false
  const ground = ownPlatGround({
    subdivisionSlug: subjectSlug,
    subdivision: subject.subdivision ?? null,
    city: subject.city ?? null,
    latitude: subject.latitude ?? null,
    longitude: subject.longitude ?? null,
  })
  return (slug, at) => platReach(ground, slug, { latitude: at?.latitude ?? null, longitude: at?.longitude ?? null }) != null
}

export type CompAreaSubject = {
  latitude: number | null
  longitude: number | null
  subdivision?: string | null
  /** The recorded plat polygon the subject sits in. */
  subdivisionSlug?: string | null
  /** "3037 Purcell": the street a street-only plat is held to. */
  streetAddress?: string | null
  city: string
}

type Community = { slug: string; name: string; tier: string }
const COMMUNITIES = (polygonData as { communities: Community[] }).communities

/**
 * The polygon mesh carries its own grain: `tier: 'city'` rows are the City of
 * Bend GIS neighborhoods, `tier: 'community'` rows are the named resort and
 * destination communities. A seller in Broken Top does not live in a
 * "neighborhood", and the sentence has to say the right word.
 */
export function marketAreaKind(slug: string | null): 'neighborhood' | 'community' | null {
  if (!slug) return null
  const c = COMMUNITIES.find((x) => x.slug === slug)
  if (!c) return null
  return c.tier === 'community' ? 'community' : 'neighborhood'
}

function marketAreaLabel(slug: string | null): string | null {
  if (!slug) return null
  return COMMUNITIES.find((c) => c.slug === slug)?.name ?? null
}

/**
 * The distance cap a rung searched under.
 *
 * Most rung names carry it (`nearby-2mi-6mo`, `city-5mi-9mo`). Four do not:
 * the listings ladder in lib/cma/comp-tiers.ts names `competing-area-12mo`,
 * `citywide-12mo` and the two `rural-county-*` rungs, whose `maxMiles` lives in
 * the tier object; `similar-sub-*` in lib/pricing/ladder.ts is capped at 4.
 * Those four caps are mirrored here rather than guessed, and the ladder tests
 * hold the pairing.
 */
const NAMED_RUNG_MILES: Array<[RegExp, number]> = [
  [/^competing-area-/, 2],
  [/^adjacent-subdivision-/, 2],
  [/^adjacent-sub-/, 2],
  [/^citywide-/, 5],
  [/^rural-county-12mo$/, 10],
  [/^rural-county-24mo$/, 15],
  [/^similar-sub-/, 4],
]

export function rungRadiusMiles(key: string): number | null {
  const m = key.match(/(\d+(?:\.\d+)?)mi/)
  if (m) {
    const n = Number(m[1])
    if (Number.isFinite(n) && n > 0) return n
  }
  for (const [re, miles] of NAMED_RUNG_MILES) {
    if (re.test(key)) return miles
  }
  return null
}

/** Rungs whose membership test IS a subdivision. */
function isSubdivisionRung(key: string): boolean {
  return key.startsWith('subdivision-') || key.startsWith('similar-sub') || key.startsWith('pocket-')
}

/**
 * Rungs whose membership test IS the whole GIS neighborhood or community.
 * A touching plat, and the next row of plats that touch those, are specific
 * subdivisions. They do not open the parent polygon. The parent is the wall,
 * and the map labels it. It is not the search disk.
 */
function isBoundaryRung(key: string): boolean {
  return key.startsWith('neighborhood-')
}

/**
 * Rungs whose membership test IS a distance from the subject: the pricing
 * ladder's quarter-mile steps and its exits (nearby-, beyond-, city-, rural-).
 * A plat, a touching plat, a street, a mapped pocket and the listings
 * ladder's named areas are not.
 */
function isDistanceRung(key: string): boolean {
  if (isSubdivisionRung(key) || key.startsWith('adjacent-sub') || key.startsWith('competing-area')) return false
  return rungRadiusMiles(key) != null
}

function clean(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  return t.length > 0 ? t : null
}

/** "one mile" / "two miles" / "2.5 miles" — never "1 mile(s)". */
export function milesPhrase(miles: number): string {
  const whole = Number.isInteger(miles)
  const n = whole && miles <= 12 ? countWord(miles) : String(miles)
  return `${n} ${miles === 1 ? 'mile' : 'miles'}`
}

/** "a, b and c" — no Oxford comma. A negative sentence joins on "or". */
function joinNames(parts: readonly string[], conjunction: 'and' | 'or' = 'and'): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!
  return `${parts.slice(0, -1).join(', ')} ${conjunction} ${parts[parts.length - 1]}`
}

/**
 * The area as a phrase that drops into a longer sentence: "Homes for sale in
 * Old Bend between $X and $Y", "three homes within one mile of your home".
 * The peer and competition sentences both read off this, so the three
 * chapters cannot describe the same geography two different ways. A negative
 * sentence ("No home in Rooster Rock or Madison Park") joins the names on
 * "or"; a single name and a radius read the same either way.
 */
export function compAreaPhrase(area: CompArea, opts?: { negative?: boolean }): string {
  switch (area.kind) {
    case 'radius':
      return area.radiusMiles != null
        ? `within ${milesPhrase(area.radiusMiles)} of your home`
        : 'near your home'
    case 'subdivision':
    case 'subdivisions': {
      // A plat held to the subject's street is named as that street, never as
      // the whole subdivision (3037 Purcell).
      const streetNames = area.street?.names ?? []
      const parts = area.names.map((n) => (streetNames.includes(n) ? `your street in ${n}` : n))
      return joinNames(parts, opts?.negative ? 'or' : 'and') || 'your area'
    }
    case 'neighborhood':
    case 'community':
    case 'city':
      return joinNames(area.names, opts?.negative ? 'or' : 'and') || 'your area'
  }
}

/**
 * How a plat in the area is related to the subject's home, by the rung that
 * reached it (Matt 2026-10-07, 3037 Purcell: "Silver Sage and the two
 * subdivisions next to it" was false for Holliday Park, which does not touch
 * Silver Sage and came in only through a sale on the subject's street).
 * A plat several rungs reached takes the closest relation.
 */
export type PlatRelation = 'own' | 'adjacent' | 'closer' | 'pocket' | 'ring' | 'other' | 'street'

export type PlacedPlat = { relation: PlatRelation; miles: number | null }

const RELATION_RANK: Record<PlatRelation, number> = {
  own: 0,
  adjacent: 1,
  closer: 2,
  pocket: 3,
  ring: 4,
  other: 5,
  street: 6,
}

export function rungRelation(tier: string | null | undefined): PlacedPlat {
  const t = clean(tier)
  if (!t) return { relation: 'other', miles: null }
  if (t.startsWith('subdivision-')) return { relation: 'own', miles: null }
  if (t.startsWith('own-street-')) return { relation: 'street', miles: null }
  if (t.startsWith('adjacent-sub')) return { relation: 'adjacent', miles: null }
  if (t.startsWith('closer-sub-')) return { relation: 'closer', miles: null }
  if (t.startsWith('pocket-')) return { relation: 'pocket', miles: POCKET_RADIUS_MILES }
  if (t.startsWith('similar-sub') || isDistanceRung(t)) return { relation: 'ring', miles: rungRadiusMiles(t) }
  return { relation: 'other', miles: null }
}

/** Each usable plat name in the printed set, with the closest relation a rung gave it. */
function placeRelations(
  kept: readonly CompAreaKeptComp[],
  subjectSubdivision: string | null,
): Map<string, PlacedPlat> {
  const out = new Map<string, PlacedPlat>()
  for (const c of kept) {
    const n = usableSubdivision(c.subdivision)
    if (!n) continue
    const r: PlacedPlat = n === subjectSubdivision ? { relation: 'own', miles: null } : rungRelation(c.selectionTier)
    const prev = out.get(n)
    if (!prev || RELATION_RANK[r.relation] < RELATION_RANK[prev.relation]) {
      out.set(n, { ...r })
    } else if (prev.relation === r.relation && r.miles != null) {
      prev.miles = Math.max(prev.miles ?? 0, r.miles)
    }
  }
  return out
}

/**
 * A plat area in seller language. Each plat is named with what it is to the
 * subject's home: its own subdivision, next to it (a touching plat), one
 * subdivision further out (a plat touching those), within a distance (a
 * pocket or ring rung), or the homes on the subject's street (a plat only the
 * own-street rung reached). Nothing here may imply a relationship the rungs
 * have not established (CMA rule 17).
 */
function plattedSentence(
  names: readonly string[],
  subjectSubdivision: string | null,
  relations: ReadonlyMap<string, PlacedPlat> | null,
): string {
  const rel = (n: string): PlacedPlat =>
    n === subjectSubdivision ? { relation: 'own', miles: null } : relations?.get(n) ?? { relation: 'other', miles: null }
  const of = (r: PlatRelation) => names.filter((n) => rel(n).relation === r)
  const widest = (group: readonly string[]) => Math.max(...group.map((n) => rel(n).miles ?? 0))
  const own = of('own')
  const clauses: string[] = []
  const adjacent = of('adjacent')
  if (adjacent.length > 0) clauses.push(`${joinNames(adjacent)} next to ${own.length > 0 ? 'it' : 'your subdivision'}`)
  const closer = of('closer')
  if (closer.length > 0) clauses.push(`${joinNames(closer)} one subdivision further out`)
  for (const r of ['pocket', 'ring'] as const) {
    const group = of(r)
    if (group.length === 0) continue
    const miles = widest(group)
    clauses.push(miles > 0 ? `${joinNames(group)} within ${milesPhrase(miles)} of your home` : joinNames(group))
  }
  const other = of('other')
  if (other.length > 0) clauses.push(joinNames(other))
  const street = of('street')
  if (street.length > 0) clauses.push(`the ${joinNames(street)} homes on your street`)
  if (own.length > 0) {
    const lead = `${joinNames(own)}, your own subdivision`
    return clauses.length === 0 ? `${lead}.` : `${lead}, with ${joinNames(clauses)}.`
  }
  const body = joinNames(clauses)
  return body ? `${body.charAt(0).toUpperCase()}${body.slice(1)}.` : 'Your area.'
}

function areaSentence(
  area: Omit<CompArea, 'sentence'>,
  subjectSubdivision: string | null,
  relations: ReadonlyMap<string, PlacedPlat> | null = null,
): string {
  switch (area.kind) {
    case 'subdivision':
    case 'subdivisions':
      return plattedSentence(area.names, subjectSubdivision, relations)
    case 'neighborhood':
      return `${area.names[0]}, the neighborhood around your home.`
    case 'community':
      return `${area.names[0]}, the community your home sits in.`
    case 'radius':
      return area.radiusMiles != null
        ? `Within ${milesPhrase(area.radiusMiles)} of your home.`
        : 'The homes closest to yours.'
    case 'city':
      return `${area.names[0] ?? 'Your city'}.`
  }
}

function centreOf(subject: CompAreaSubject): { lat: number; lng: number } | null {
  const { latitude: lat, longitude: lng } = subject
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/**
 * The plat keys of a plat area (Matt 2026-10-07, rule 24): the subject's own
 * plat always, then each plat a printed sale sits in. A plat only the subject's
 * own street reached is held to that street. The subject's own plat is never
 * a street-only plat.
 */
function platKeys(input: {
  names: readonly string[]
  subjectSubdivision: string | null
  subject: CompAreaSubject
  kept: readonly CompAreaKeptComp[]
  relations: ReadonlyMap<string, PlacedPlat>
}): Pick<CompArea, 'platSlugs' | 'namesWithoutPlat' | 'street'> {
  const subjectSlug = clean(input.subject.subdivisionSlug)
  // The subject's own subdivision is never a street-only plat: its plat, a
  // phase, an alias sibling, or a recorded addition or phase of its family
  // inside its neighborhood (onOwnPlat, Matt 2026-10-08 "Yes, everywhere").
  const ownPlat = ownPlatOf(input.subject)
  const isStreetName = (n: string) => n !== input.subjectSubdivision && input.relations.get(n)?.relation === 'street'
  const whole: string[] = subjectSlug ? [subjectSlug] : []
  const streetSlugs: string[] = []
  const slugged = new Set<string>()
  if (subjectSlug && input.subjectSubdivision) slugged.add(input.subjectSubdivision)
  for (const c of input.kept) {
    const slug = clean(c.subdivisionSlug)
    if (!slug) continue
    const n = usableSubdivision(c.subdivision)
    if (n && !input.names.includes(n)) continue
    if (n) slugged.add(n)
    const streetOnly = n ? isStreetName(n) : rungRelation(c.selectionTier).relation === 'street'
    const bucket = streetOnly && !ownPlat(slug, c) ? streetSlugs : whole
    if (!bucket.includes(slug)) bucket.push(slug)
  }
  const key = streetKey(input.subject.streetAddress)
  const streetNames = input.names.filter(isStreetName)
  const street =
    key && (streetNames.length > 0 || streetSlugs.length > 0)
      ? { key, names: streetNames, platSlugs: streetSlugs }
      : null
  return {
    platSlugs: whole,
    namesWithoutPlat: input.names.filter((n) => !slugged.has(n)),
    street,
  }
}

/** The subject's own subdivision first, always (rule 24: the area includes the subject's plat). */
function subjectFirst(names: readonly string[], subjectSubdivision: string | null): string[] {
  const rest = names.filter((n) => n !== subjectSubdivision)
  return subjectSubdivision ? [subjectSubdivision, ...rest] : rest
}

/**
 * Derive the one area. Null when the document printed no sale — there is no
 * search to name, and an area on `render_args` would read as one.
 */
export function buildCompArea(input: {
  subject: CompAreaSubject
  rungs: readonly CompAreaRung[]
  keptComps: readonly CompAreaKeptComp[]
}): CompArea | null {
  if (input.keptComps.length === 0) return null
  const centre = centreOf(input.subject)
  const subjectSubdivision = usableSubdivision(input.subject.subdivision)
  // A sale on the subject's own ground is named by the subject's subdivision,
  // whatever MLS spelling its row carries (reader review 2026-10-08, 1355
  // Jacksonville: "Northwest Townsite Co 2nd Addt" is the subject's own plat,
  // not a second place beside "Northwest Townsite").
  const kept = input.keptComps.map((c) =>
    subjectSubdivision && keptOnOwnGround(input.subject, c) ? { ...c, subdivision: subjectSubdivision } : c,
  )
  const relations = placeRelations(kept, subjectSubdivision)

  // The rungs THAT KEPT A SALE. A rung that ran and contributed nothing to the
  // printed set describes no part of the area the document is about.
  const keptTiers = new Set(
    kept.map((c) => clean(c.selectionTier)).filter((t): t is string => t != null),
  )
  const keptRungs = input.rungs.filter((r) => r.kept > 0 || keptTiers.has(r.key))
  const rungKeys = keptRungs.length > 0 ? keptRungs.map((r) => r.key) : [...keptTiers]

  // Each rung with the share of the PRINTED set it carried, so the rule below
  // can be checked against the same counts render_args.compSearch prints.
  const keptPerTier = new Map<string, number>()
  for (const c of kept) {
    const t = clean(c.selectionTier)
    if (t) keptPerTier.set(t, (keptPerTier.get(t) ?? 0) + 1)
  }
  const rungTrace = rungKeys
    .map((k) => `${k} (${keptPerTier.get(k) ?? 0} of ${kept.length})`)
    .join(', ')
  const trace = (rule: string) =>
    `compSearch rungs ${rungTrace || 'none recorded'}; ${kept.length} printed ${
      kept.length === 1 ? 'sale' : 'sales'
    }; ${rule}`

  // A plat area: the subject's own plat first, then the plats the printed
  // sales sit in, each named with the rung relation that reached it.
  const platted = (saleNames: readonly string[], rule: string): CompArea => {
    const names = subjectFirst(saleNames, subjectSubdivision)
    const keys = platKeys({ names, subjectSubdivision, subject: input.subject, kept, relations })
    const own = subjectSubdivision && !saleNames.includes(subjectSubdivision)
      ? `; the subject's own subdivision ${subjectSubdivision} is in the area though no printed sale sits there`
      : ''
    const streetTrace = keys.street
      ? `; ${keys.street.names.join(', ') || 'a plat'} reached only by the own-street rung, so it is in the area on the subject's street (${keys.street.key}) only`
      : ''
    const base = {
      kind: (names.length === 1 ? 'subdivision' : 'subdivisions') as CompAreaKind,
      names,
      radiusMiles: null,
      centre,
      source: trace(`${rule}${own}${streetTrace}`),
      ...keys,
    }
    return { ...base, sentence: areaSentence(base, subjectSubdivision, relations) }
  }

  // 1. Every kept sale came from a subdivision rung.
  const allSubdivisionRungs =
    rungKeys.length > 0 && rungKeys.every((k) => isSubdivisionRung(k)) &&
    kept.every((c) => {
      const t = clean(c.selectionTier)
      return t == null || isSubdivisionRung(t)
    })
  if (allSubdivisionRungs) {
    // Union, in the order the printed set carries them, with the subject's own
    // subdivision first.
    const names: string[] = []
    for (const c of kept) {
      const n = usableSubdivision(c.subdivision)
      if (n && !names.includes(n)) names.push(n)
    }
    if (names.length > 0) {
      return platted(
        names,
        `every printed sale came from a subdivision rung, so the area is the ${
          names.length === 1 ? 'subdivision' : `${names.length} subdivisions`
        } those sales sit in: ${names.join(', ')}`,
      )
    }
    // The rungs were subdivision rungs but no printed sale carries a usable
    // subdivision name (an MLS placeholder is not a place). Fall through.
  }

  // Every printed sale is the same subdivision, including a later phase that
  // arrived on the adjacent rung. That phase is still this place. Mixed names
  // fall through to the neighborhood the search stayed inside.
  const oneName: string[] = []
  const oneSubdivision =
    kept.length > 0 &&
    kept.every((c) => {
      const n = usableSubdivision(c.subdivision)
      if (!n) return false
      if (!oneName.includes(n)) oneName.push(n)
      return true
    }) &&
    oneName.length === 1
  if (oneSubdivision) {
    return platted(oneName, `every printed sale is in ${oneName[0]}, so the area is that subdivision`)
  }

  // 2. A boundary rung supplied a kept sale.
  const boundaryKept = keptRungs.some((r) => isBoundaryRung(r.key)) ||
    [...keptTiers].some((t) => isBoundaryRung(t))
  if (boundaryKept && centre) {
    const slug = resolveMarketArea(centre.lat, centre.lng)
    const kind = marketAreaKind(slug)
    const name = marketAreaLabel(slug)
    if (kind && name) {
      const base = {
        kind: kind as CompAreaKind,
        names: [name],
        radiusMiles: null,
        centre,
        source: trace(
          `a boundary rung supplied a printed sale, so the area is the ${kind} polygon the subject sits in (${slug})`,
        ),
      }
      return { ...base, sentence: areaSentence(base, subjectSubdivision) }
    }
  }

  // The printed sales name the place. A street rung or a distance rung does
  // not widen the letter past those subdivisions. A sale with no usable name
  // falls through to the radius below. N/A is not a name.
  const saleNames: string[] = []
  const everySaleNamed = kept.every((c) => {
    const n = usableSubdivision(c.subdivision)
    if (!n) return false
    if (!saleNames.includes(n)) saleNames.push(n)
    return true
  })
  if (everySaleNamed && saleNames.length > 0) {
    const ringNames = saleNames.filter((n) => relations.get(n)?.relation === 'ring')
    const ringMiles = ringNames.length > 0 ? Math.max(...ringNames.map((n) => relations.get(n)?.miles ?? 0)) : 0
    return platted(
      saleNames,
      `every printed sale carries a subdivision name, so the area is ${
        saleNames.length === 1 ? 'that subdivision' : `those ${saleNames.length} subdivisions`
      }: ${saleNames.join(', ')}${
        ringNames.length > 0 ? `; ${ringNames.join(', ')} reached only by a distance rung (${milesPhrase(ringMiles)})` : ''
      }`,
    )
  }

  // 3. The radius the widest kept rung used.
  const miles = rungKeys
    .map(rungRadiusMiles)
    .filter((n): n is number => n != null && n > 0)
  if (miles.length > 0 && centre) {
    const radiusMiles = Math.max(...miles)
    const base = {
      kind: 'radius' as const,
      names: [],
      radiusMiles,
      centre,
      source: trace(
        `no subdivision or boundary rung bounds the printed set, so the area is the widest distance cap a printed sale came under: ${milesPhrase(radiusMiles)}`,
      ),
    }
    return { ...base, sentence: areaSentence(base, subjectSubdivision) }
  }

  const city = clean(input.subject.city)
  const base = {
    kind: 'city' as const,
    names: city ? [city] : [],
    radiusMiles: null,
    centre,
    source: trace(
      centre
        ? 'no rung carried a subdivision, a boundary or a distance cap, so the area is the city'
        : 'the subject carries no coordinates, so no boundary or radius can be drawn and the area is the city',
    ),
  }
  return { ...base, sentence: areaSentence(base, subjectSubdivision) }
}

/**
 * A subdivision, a recorded plat, a neighborhood polygon, or the radius the
 * sales already used. The city is not a boundary.
 */
export function salesAreaIsBounded(area: { kind?: string | null } | null | undefined): boolean {
  const kind = area?.kind
  return (
    kind === 'subdivision' ||
    kind === 'subdivisions' ||
    kind === 'neighborhood' ||
    kind === 'community' ||
    kind === 'radius'
  )
}

/**
 * The sales sit in a named place: a subdivision, a recorded plat, a
 * neighborhood, or a community. A radius and the city are not that place.
 * Citywide charts do not belong on a letter whose sales are already here.
 */
export function namedSalesPlace(area: { kind?: string | null } | null | undefined): boolean {
  const kind = area?.kind
  return (
    kind === 'subdivision' ||
    kind === 'subdivisions' ||
    kind === 'neighborhood' ||
    kind === 'community'
  )
}

/**
 * The neighborhood or community the subject sits in, for the map's parent
 * label and the place-pricing story. It is not a competition ring and not an
 * expired ring (Matt 2026-10-07).
 */
export function parentPlaceArea(input: {
  latitude: number | null
  longitude: number | null
}): CompArea | null {
  const centre = centreOf({ latitude: input.latitude, longitude: input.longitude, city: '' })
  if (!centre) return null
  const slug = resolveMarketArea(centre.lat, centre.lng)
  const kind = marketAreaKind(slug)
  const name = marketAreaLabel(slug)
  if (!kind || !name) return null
  const bare: Omit<CompArea, 'sentence'> = {
    kind,
    names: [name],
    radiusMiles: null,
    centre,
    source: 'parent of a short sales subdivision',
  }
  return { ...bare, sentence: areaSentence(bare, null) }
}

/**
 * Competition and expireds use the sales boundary. One ring, and the same
 * rules the sales passed (lib/cma/same-area-fit.ts).
 *
 * If the sales that set the price sit in a subdivision or a recorded plat,
 * that place is the ring. A radius search keeps that radius. There is no
 * 0.5 / 1 / 2 / 5 mile ladder past it, no parent-neighborhood step, no
 * competitor-plat step, and the city is not a ring. A price-band step inside
 * the ring is the only opening (lib/cma/assemble-competition.ts). Matt
 * 2026-10-07, reversing c72d6f567 and e858fd5e0 for area. `keptComps` stays
 * on the signature so callers do not grow a second ladder.
 */
export function resolveCompetitionArea(input: {
  compArea: CompArea
  subject: { latitude: number | null; longitude: number | null; city: string }
  keptComps: readonly CompAreaKeptComp[]
}): CompArea[] {
  void input.keptComps
  const centre = centreOf({ ...input.subject, subdivision: null })
  if (!centre) return []
  if (!salesAreaIsBounded(input.compArea)) return []
  const withCentre: Omit<CompArea, 'sentence'> = { ...input.compArea, centre: input.compArea.centre ?? centre }
  return [{ ...withCentre, sentence: input.compArea.sentence || areaSentence(withCentre, null) }]
}

/**
 * The area as a phrase that follows a verb: "came off the market in Diamond Bar
 * Ranch", "for sale within one mile of your home". A radius phrase already
 * carries its own preposition; a name does not.
 */
export function compAreaIn(area: CompArea, opts?: { negative?: boolean }): string {
  const phrase = compAreaPhrase(area, opts)
  return area.kind === 'radius' ? phrase : `in ${phrase}`
}

/**
 * The GIS slug this area is bounded by, or null when it is not a boundary.
 * Resolved from the subject's own coordinates — the same call that chose the
 * boundary in the first place — so the name and the polygon can never drift.
 */
export function compAreaSlug(area: CompArea): string | null {
  if (area.kind !== 'neighborhood' && area.kind !== 'community') return null
  if (!area.centre) return null
  return resolveMarketArea(area.centre.lat, area.centre.lng)
}

/**
 * Axis-aligned bounding box for pushing the area INTO a query.
 *
 * A superset of the exact shape, never a subset: the polygon and the circle
 * are re-tested row by row in `compAreaContains`. Null means the area is not
 * geometric — a subdivision list or a city, which scope by column instead.
 */
export function compAreaBounds(area: CompArea): LatLngBounds | null {
  if (area.kind === 'neighborhood' || area.kind === 'community') {
    return marketAreaBounds(compAreaSlug(area))
  }
  if (area.kind === 'radius' && area.centre && area.radiusMiles != null) {
    return radiusBounds({ lat: area.centre.lat, lng: area.centre.lng }, area.radiusMiles)
  }
  return null
}

/** A row a reader is deciding whether to keep. */
export type CompAreaRow = {
  latitude?: number | null
  longitude?: number | null
  subdivision?: string | null
  city?: string | null
  /**
   * The recorded plat polygon the row's point sits in (`assignSubdivisionSlugs`).
   * A slug when one holds it; null when the point was tested and none does;
   * undefined when the caller did not test it. Only a slug is a polygon.
   */
  platSlug?: string | null
  /** "2591 Purcell". Undefined when the caller has none; then the street is not tested. */
  address?: string | null
}

/**
 * The area's recorded plats as a ground (lib/pricing/plat-ground.ts): its
 * whole plats, or the plats only the own-street rung reached, with the
 * neighborhood or community polygon the subject sits in as the family wall.
 */
const areaGrounds = new WeakMap<CompArea, { whole: PlatGround; street: PlatGround }>()

export function areaGround(area: CompArea, which: 'whole' | 'street'): PlatGround {
  let grounds = areaGrounds.get(area)
  if (!grounds) {
    const parent = area.centre ? parentOf(area.centre.lat, area.centre.lng) : null
    grounds = {
      whole: platGround({ platSlugs: area.platSlugs ?? [], parent }),
      street: platGround({ platSlugs: area.street?.platSlugs ?? [], parent }),
    }
    areaGrounds.set(area, grounds)
  }
  return grounds[which]
}

/**
 * A plat area's membership (Matt 2026-10-07, rule 24). The recorded polygon
 * first, when the row has one and the area recorded its plats: the row's plat
 * is the subject's or a sale's plat, a phase of it, or (reader review
 * 2026-10-08, 915 Saginaw) another plat of the same subdivision family inside
 * the subject's neighborhood polygon, whatever MLS spelling the row carries
 * (platReach in lib/pricing/plat-ground.ts, the one ground decision). A plat
 * the own-street rung alone reached holds only the subject's street, and the
 * same plat test runs for it before any family test, so a street-only plat
 * never becomes the whole plat through its family. The MLS name only as the
 * fallback: for a row no polygon holds, for a row nobody tested, and for an
 * area plat with no recorded polygon.
 */
function plattedContains(area: CompArea, row: CompAreaRow): boolean {
  const name = usableSubdivision(row.subdivision)
  const street = area.street ?? null
  const streetNames = street?.names ?? []
  const onStreet = (): boolean => {
    if (!street) return false
    // A caller that carries no address already read the row through a test
    // that did; the read is where the street is decided.
    if (row.address === undefined) return true
    const key = streetKey(row.address)
    return key != null && key === street.key
  }
  const plat = typeof row.platSlug === 'string' && row.platSlug.trim() ? row.platSlug.trim() : null
  const recorded = area.platSlugs ?? []
  if (plat && (recorded.length > 0 || (street?.platSlugs.length ?? 0) > 0)) {
    const at = { latitude: row.latitude ?? null, longitude: row.longitude ?? null }
    const whole = recorded.length > 0 ? platReach(areaGround(area, 'whole'), plat, at) : null
    const held = street && street.platSlugs.length > 0 ? platReach(areaGround(area, 'street'), plat, at) : null
    if (whole === 'plat') return true
    if (held === 'plat') return onStreet()
    if (whole === 'family') return true
    if (held === 'family') return onStreet()
    // The row sits in a recorded plat that is not the area's. Only an area
    // plat with no polygon of its own is still read by its name.
    if (name == null || !(area.namesWithoutPlat ?? []).includes(name)) return false
    return streetNames.includes(name) ? onStreet() : true
  }
  if (name == null || !area.names.includes(name)) return false
  return streetNames.includes(name) ? onStreet() : true
}

/**
 * THE EXACT MEMBERSHIP TEST — one definition, used to narrow every read the
 * document makes. The bounding box above is what the database sees; this is
 * what decides. A boundary area runs the same point-in-polygon
 * `resolveMarketArea` used to place the subject.
 */
export function compAreaContains(area: CompArea, row: CompAreaRow): boolean {
  switch (area.kind) {
    case 'subdivision':
    case 'subdivisions':
      return plattedContains(area, row)
    case 'neighborhood':
    case 'community': {
      const slug = compAreaSlug(area)
      if (!slug) return false
      const lat = row.latitude ?? null
      const lng = row.longitude ?? null
      if (lat == null || lng == null) return false
      return resolveMarketArea(lat, lng) === slug
    }
    case 'radius': {
      if (!area.centre || area.radiusMiles == null) return false
      const d = distanceMiles(area.centre, { lat: row.latitude ?? null, lng: row.longitude ?? null })
      return d != null && d <= area.radiusMiles
    }
    case 'city': {
      const city = clean(row.city)
      return city != null && area.names.some((n) => n.toLowerCase() === city.toLowerCase())
    }
  }
}
