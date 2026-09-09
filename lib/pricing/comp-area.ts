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
import { distanceMiles, resolveMarketArea } from '@/lib/cma/market-area'
import { usableSubdivision } from '@/lib/pricing/comp-search'
import { countWord } from '@/lib/pricing/estimate'

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
}

/** One rung of the counted ladder — the shape `compSearch.rungs` already has. */
export type CompAreaRung = { key: string; kept: number; added: number }

/** A sale the document prints. */
export type CompAreaKeptComp = {
  subdivision?: string | null
  selectionTier?: string | null
  latitude?: number | null
  longitude?: number | null
}

export type CompAreaSubject = {
  latitude: number | null
  longitude: number | null
  subdivision?: string | null
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
  return key.startsWith('subdivision-') || key.startsWith('similar-sub')
}

/** Rungs whose membership test IS the GIS boundary the subject sits in. */
function isBoundaryRung(key: string): boolean {
  return key.startsWith('neighborhood-')
}

function clean(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  return t.length > 0 ? t : null
}

/** "one mile" / "two miles" / "2.5 miles" — never "1 mile(s)". */
function milesPhrase(miles: number): string {
  const whole = Number.isInteger(miles)
  const n = whole && miles <= 12 ? countWord(miles) : String(miles)
  return `${n} ${miles === 1 ? 'mile' : 'miles'}`
}

/** "a, b and c" — no Oxford comma. */
function joinNames(parts: readonly string[]): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * The area as a phrase that drops into a longer sentence: "Homes for sale in
 * Old Bend between $X and $Y", "three homes within one mile of your home".
 * The peer and competition sentences both read off this, so the three
 * chapters cannot describe the same geography two different ways.
 */
export function compAreaPhrase(area: CompArea): string {
  switch (area.kind) {
    case 'radius':
      return area.radiusMiles != null
        ? `within ${milesPhrase(area.radiusMiles)} of your home`
        : 'near your home'
    case 'subdivision':
    case 'subdivisions':
    case 'neighborhood':
    case 'community':
    case 'city':
      return joinNames(area.names) || 'your area'
  }
}

function areaSentence(area: Omit<CompArea, 'sentence'>, subjectSubdivision: string | null): string {
  switch (area.kind) {
    case 'subdivision':
      return `${area.names[0]}, your own subdivision.`
    case 'subdivisions': {
      const head = area.names[0]!
      const rest = area.names.length - 1
      // When the subject's own subdivision leads the list, the rest are "next
      // to it" — the seller's own frame. Otherwise name them all; nothing here
      // may imply a relationship the data has not established.
      if (subjectSubdivision && head === subjectSubdivision) {
        return `${head} and the ${countWord(rest)} ${rest === 1 ? 'subdivision' : 'subdivisions'} next to it.`
      }
      return `${joinNames(area.names)}.`
    }
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
 * Derive the one area. Null when the document printed no sale — there is no
 * search to name, and an area on `render_args` would read as one.
 */
export function buildCompArea(input: {
  subject: CompAreaSubject
  rungs: readonly CompAreaRung[]
  keptComps: readonly CompAreaKeptComp[]
}): CompArea | null {
  const kept = input.keptComps
  if (kept.length === 0) return null
  const centre = centreOf(input.subject)
  const subjectSubdivision = usableSubdivision(input.subject.subdivision)

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

  // 1. Every kept sale came from a subdivision rung.
  const allSubdivisionRungs =
    rungKeys.length > 0 && rungKeys.every((k) => isSubdivisionRung(k)) &&
    kept.every((c) => {
      const t = clean(c.selectionTier)
      return t == null || isSubdivisionRung(t)
    })
  if (allSubdivisionRungs) {
    // Union, in the order the printed set carries them, with the subject's own
    // subdivision first when it is in the set.
    const names: string[] = []
    for (const c of kept) {
      const n = usableSubdivision(c.subdivision)
      if (n && !names.includes(n)) names.push(n)
    }
    if (subjectSubdivision && names.includes(subjectSubdivision)) {
      names.splice(names.indexOf(subjectSubdivision), 1)
      names.unshift(subjectSubdivision)
    }
    if (names.length > 0) {
      const kind: CompAreaKind = names.length === 1 ? 'subdivision' : 'subdivisions'
      const base = {
        kind,
        names,
        radiusMiles: null,
        centre,
        source: trace(
          `every printed sale came from a subdivision rung, so the area is the ${
            names.length === 1 ? 'subdivision' : `${names.length} subdivisions`
          } those sales sit in: ${names.join(', ')}`,
        ),
      }
      return { ...base, sentence: areaSentence(base, subjectSubdivision) }
    }
    // The rungs were subdivision rungs but no printed sale carries a usable
    // subdivision name (an MLS placeholder is not a place). Fall through.
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
        `no subdivision or boundary rung bounds the printed set, so the area is the widest distance cap a printed sale came under: ${radiusMiles} miles`,
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
 * Round a measured distance UP to a radius a seller can read. Never down: the
 * circle has to hold every sale the price was built on.
 */
function radiusStep(miles: number): number {
  if (miles <= 1) return 1
  if (miles <= 2) return 2
  return Math.ceil(miles * 2) / 2
}

/**
 * THE COMPETITION AREA. Matt: "we want to limit it to the neighborhood or
 * community. Unless it's not part of that, then we'll have to use a radius."
 *
 * So this is NOT the comp area verbatim: a subject whose sales all came from
 * one subdivision still competes with the whole neighborhood around it. The
 * boundary wins whenever the subject sits in one; otherwise the circle, sized
 * to hold the sales the price was built on. Never the city — a Redmond seller
 * is not competing with a house four miles away on the other side of town.
 */
export function resolveCompetitionArea(input: {
  compArea: CompArea
  subject: { latitude: number | null; longitude: number | null; city: string }
  keptComps: readonly CompAreaKeptComp[]
}): CompArea {
  const centre = centreOf({ ...input.subject, subdivision: null })
  if (!centre) {
    // No coordinates, no circle and no polygon test. Say so rather than draw a
    // radius from a point we do not have.
    return {
      ...input.compArea,
      kind: 'city',
      names: input.subject.city ? [input.subject.city] : input.compArea.names,
      radiusMiles: null,
      centre: null,
      source: `${input.compArea.source}; competition: the subject carries no coordinates, so neither a boundary nor a radius can be drawn`,
      sentence: `${input.subject.city || 'Your city'}.`,
    }
  }

  const slug = resolveMarketArea(centre.lat, centre.lng)
  const kind = marketAreaKind(slug)
  const name = marketAreaLabel(slug)
  if (kind && name) {
    const base = {
      kind: kind as CompAreaKind,
      names: [name],
      radiusMiles: null,
      centre,
      source: `competition: the subject sits inside the ${kind} polygon ${slug}, so only listings inside that boundary count`,
    }
    return { ...base, sentence: areaSentence(base, null) }
  }

  // Outside every mapped boundary. The circle is the widest of: the radius the
  // comp area already names, and the distance to the farthest sale the price
  // was built on. Both are facts about this document, not a default.
  const farthest = input.keptComps
    .map((c) => distanceMiles(centre, { lat: c.latitude ?? null, lng: c.longitude ?? null }))
    .filter((d): d is number => d != null && Number.isFinite(d))
  const measured = farthest.length > 0 ? Math.max(...farthest) : 0
  const radiusMiles = radiusStep(Math.max(input.compArea.radiusMiles ?? 0, measured, 1))
  const base = {
    kind: 'radius' as const,
    names: [],
    radiusMiles,
    centre,
    source: `competition: the subject is outside every mapped neighborhood or community polygon, so the area is a ${radiusMiles}-mile radius — the wider of the comp search's own cap (${
      input.compArea.radiusMiles ?? 'none'
    }) and the ${measured.toFixed(2)}-mile distance to the farthest sale behind the price`,
  }
  return { ...base, sentence: areaSentence(base, null) }
}
