/**
 * Plat families — the phases, units, additions and replats the county records
 * separately, grouped under the one name a person actually searches.
 *
 * WHY (Matt 2026-09-23): "When there are multiple phases in a subdivision, we
 * want all those to go into the same main neighborhood page, and then they can
 * jump into the different phases after that. We do that for Tetherow and Broken
 * Top, but sometimes it's not as crystal clear, so we just want to make sure
 * that that grouping is always happening."
 *
 * Tetherow and Broken Top were grouped by hand: each has a registry community
 * with a polygon, and the community page lists the plats inside it
 * (community_subdivisions, majority-overlap containment). Everything else was
 * not grouped at all. Deschutes County records Ridge at Eagle Crest as 56
 * separate plats ("Ridge At Eagle Crest 5" through "59", three roman phases and
 * three replats) and Awbrey Butte Homesites as 34 ("Phase I" through "Phase
 * Thirty-three"); each phase had its own indexable page while the one page a
 * reader means, /subdivisions/ridge-at-eagle-crest, carried noindex because the
 * county never filed a plat under the bare name (SEO-7, visibility audit
 * 2026-09-22).
 *
 * THE RULE, IN ORDER:
 *   1. Strip the recording residue from each county label: document numbers
 *      (711-21-000260-sub, Plld20200979, Pz-20-0569), then everything from the
 *      first recording marker on (Phase, Unit, Stage, Section N, Part N, No. N,
 *      Replat, Amended, Supplemental, Lots/Blocks/Tract codes), the ordinal
 *      "First Addition" phrase wherever it sits, filing tokens (Inc., P.U.D.,
 *      OLU, SFR), and trailing numbers in digits, roman numerals or words.
 *      What is left is the family's base.
 *   2. Group plats by that base AND by city. Two developments can share a
 *      name in two towns; a phase is never grouped with a namesake elsewhere.
 *   3. A group is a family only when it holds two or more recorded plats.
 *   4. The family's name must be a name somebody RECORDED — never an
 *      invention of this module: the county's own label for one of the plats
 *      (Tetherow Crossing is itself a recorded plat), a registry community or
 *      alias (Ridge At Eagle Crest), or an MLS SubdivisionName in the same city
 *      (Awbrey Butte Homesites). A base nobody recorded names no family, and
 *      its plats stay ungrouped rather than filed under a made-up heading.
 *   5. The family's main page is its registry community page when one exists
 *      under that name (/communities/tetherow, /communities/broken-top), and
 *      otherwise /subdivisions/{family-slug}. When that address already belongs
 *      to another recorded place (a namesake plat in another town), the family
 *      is addressed by name and town, /subdivisions/{family-slug}-{town}.
 *
 * THE INVARIANT (locked by lib/market/plat-family.lock.test.ts and
 * scripts/check-plat-families.mjs): every group of two or more recorded plats
 * sharing a base in one town has a family with a main page, except a base that
 * is a city's own name (the townsite plats, whose main page is the city page).
 *
 * WHERE NAMES ALONE ARE AMBIGUOUS the city split in (2) is the geometry check:
 * a plat's city comes from the county boundary tree (the plat polygon's parent
 * chain) before it comes from where its sales were filed, so two namesakes in
 * two towns are two families. The recorded-name rule in (4) is the other half:
 * a base that happens to match nothing on record groups nothing.
 *
 * Pure module: no Supabase, no next/cache. The DAL that feeds it live rows is
 * lib/data/subdivisions/getPlatFamilies.ts.
 */

import { slugify } from '@/lib/slug'
import { publishPlatDisplayName, titleCasePlaceName } from '@/lib/market/publish-plat-display-name'
import { communityPath, resolveDurableCommunitySlug } from '@/lib/communities/community-public-pair'

// ---------------------------------------------------------------------------
// County document tokens — the recorder's file numbers, never part of a name.
// ---------------------------------------------------------------------------

/**
 * The county and city land-use file numbers that ride on the end of recent
 * plat labels. They are how the recorder finds the file, and no reader searches
 * them: "Canyon Ridge, Phase 4 711-18-000032-sub", "Easton Phase I
 * Plld20200979", "Petrosa Phase 5a Pz-20-0235", "Sunset Meadows Phases 1 And 2
 * Sub 22-01".
 */
const DOCUMENT_TOKEN_RES: readonly RegExp[] = [
  // Redmond / Deschutes County land-use numbers: 711-21-000260-sub,
  // 247-22-000182-tp, 711-21-000185-plng-sub, 247-25-00291-tp.
  /\b\d{3}-\d{2}-\d{3,6}(?:-[a-z]+)*\b/gi,
  // City of Bend land-use numbers: Plld20200979, PLLD 20211070.
  /\bplld\s?\d{6,}\b/gi,
  // Pz-20-0235, Pz20-0183, Pz 20-0027.
  /\bpz[-\s]?\d{2}-\d{3,4}\b/gi,
  // Sisters / La Pine file numbers: Sub 22-01, Sub-21-01, Mod 20-02/sub20-01.
  /\bmod\s+\d{2}-\d{2}(?:\/\s*sub\s?\d{2}-\d{2})?/gi,
  /\bsub[-\s]?\d{2}-\d{2}\b/gi,
  // Minor partition numbers: Mp-80-93.
  /\bmp-\d{2}-\d{2,3}\b/gi,
  // County survey cross-references: See Cs06623, Cs06506, Aff Cor.
  /\bsee\s+cs\s*\d+\b/gi,
  /\bcs\s?\d{4,}\b/gi,
  /\baff\.?\s+cor\.?/gi,
  // Plat. No. 2002-61.
  /\bplat\.?\s+no\.?\s+\d{4}-\d+\b/gi,
]

function tidy(value: string): string {
  return value
    .replace(/\s+([,.])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.&/-]+|[\s,&/-]+$/g, '')
    .trim()
}

/** A county label with its land-use file numbers removed, otherwise untouched. */
export function stripCountyDocumentTokens(label: string): string {
  let out = label
  for (const re of DOCUMENT_TOKEN_RES) out = out.replace(re, ' ')
  return tidy(out)
}

// ---------------------------------------------------------------------------
// The base — what is left of a label once the recording residue is gone.
// ---------------------------------------------------------------------------

const UNITS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen',
]
const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const ORDINALS = [
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth',
  'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth',
  'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
]
const SPELLED = `(?:(?:${TENS.join('|')})(?:-(?:${UNITS.slice(0, 9).join('|')}))?|${UNITS.join('|')})`
const ORDINAL = `(?:${ORDINALS.join('|')}|\\d+(?:st|nd|rd|th))`
const ROMAN = '(?:[ivx]{1,6})'
/** One phase designator: 3, 5a, 10d, II, Iv-f, Twenty-two, C1, Rs-1, 1-a. */
const DESIGNATOR = `(?:\\d+[a-z]?(?:-[a-z0-9]+)?|${ROMAN}(?:-[a-z0-9]+)?|${SPELLED}|[a-z]{1,2}-?\\d+[a-z]?|[a-z])`

/**
 * "First Addition", "Eleventh Addition", "2nd Addition" — removed IN PLACE,
 * because the county writes it mid-name: "Rock Ridge Cabin Sites First Addition
 * Of Black Butte Ranch" is an addition to "Rock Ridge Cabin Sites Of Black
 * Butte Ranch", which the county also records.
 */
const ORDINAL_ADDITION_RE = new RegExp(`\\b${ORDINAL}\\s+addition\\b`, 'gi')

/**
 * The first recording marker. Everything from it to the end of the label is
 * residue: which phase, which lots, which replat of which lots.
 */
const TAIL_MARKER_RE = new RegExp(
  [
    '\\b(?:',
    [
      `phases?\\b`,
      `units?\\s+${DESIGNATOR}\\b`,
      `stages?\\s+${DESIGNATOR}\\b`,
      `supp(?:lement(?:al)?)?\\.?(?=[\\s,:/]|$)`,
      `amended\\b`,
      `revised\\b`,
      `corrected\\b`,
      `(?:a\\s+|partial\\s+)?re-?plat\\b`,
      `(?:partial\\s+)?resubdivision\\b`,
      `plat\\.?\\s+(?:no\\b|amendment\\b)`,
      `portion\\s+of\\b`,
      `minor\\s+land\\s+partition\\b`,
      `parcels?\\s+\\d`,
      `lots?\\s+\\d`,
      `blocks?\\s+\\d`,
      `bks?\\s+\\d`,
      `tracts?\\s+(?:\\d+|[a-z](?:-[a-z])?)(?=[\\s,&-]|$)`,
      `section\\s+(?:\\d+|${ROMAN}|${SPELLED})\\b`,
      `part\\s+(?:\\d+|${ROMAN})\\b`,
      `no\\.?\\s*(?:\\d+|${ROMAN})\\b`,
      `number\\s+\\d+\\b`,
    ].join('|'),
    ')',
  ].join(''),
  'i',
)

/** Filing tokens that ride inside a label and are no part of the place's name. */
const FILING_TOKEN_RE = /\b(?:inc\.?|p\.?\s?u\.?\s?d\.?|olu|sfr)(?=\s|$|,)/gi

/** A trailing phase number with nothing after it: "Ridge At Eagle Crest 36", "Eagle Crest III". */
const TRAILING_DESIGNATOR_RE = new RegExp(`[\\s,]+(?:${DESIGNATOR}|and|&)$`, 'i')

/**
 * The family base of one county label, in the county's own casing, or null
 * when nothing of a name survives the strip.
 *
 *   "Ridge At Eagle Crest 36"                        -> "Ridge At Eagle Crest"
 *   "Awbrey Butte Homesites Phase Thirty-two"        -> "Awbrey Butte Homesites"
 *   "Broken Top Phase Ii-c Lots 117 Thru 143"        -> "Broken Top"
 *   "Canyon Ridge, Phase 4 711-18-000032-sub"        -> "Canyon Ridge"
 *   "Tetherow Crossing Phase VII"                    -> "Tetherow Crossing"
 *   "Rock Ridge Cabin Sites First Addition Of Black Butte Ranch Lots 20, 21 And 22"
 *                                                     -> "Rock Ridge Cabin Sites Of Black Butte Ranch"
 */
export function platFamilyBaseName(label: string | null | undefined): string | null {
  let s = (label ?? '').replace(/\([^)]*\)/g, ' ')
  s = stripCountyDocumentTokens(s)
  s = s.replace(ORDINAL_ADDITION_RE, ' ')
  const tail = TAIL_MARKER_RE.exec(s)
  if (tail && tail.index > 0) s = s.slice(0, tail.index)
  s = s.replace(FILING_TOKEN_RE, ' ')
  s = tidy(s)
  // Trailing designators, repeatedly: "Eagle Crest II" -> "Eagle Crest",
  // "Canyon Rim Village , Phase 11" already cut at Phase. A base is never
  // reduced below one word.
  for (let i = 0; i < 4; i += 1) {
    const next = tidy(s.replace(TRAILING_DESIGNATOR_RE, ''))
    if (next === s || next.split(/\s+/).length < 1 || next.length === 0) break
    s = next
  }
  // A dangling connector left at either end by a mid-label removal.
  s = tidy(s.replace(/^(?:of|to|at|the)\s+/i, '').replace(/\s+(?:of|to|at|and|&)$/i, ''))
  return s.length >= 3 ? s : null
}

/**
 * The comparison key for a name: lower case, "&" read as "and", punctuation
 * and the article dropped, whitespace collapsed. Two spellings of one recorded
 * name ("Mt. Bachelor Village" / "Mt Bachelor Village", "Farm (The)" / "The
 * Farm") compare equal; two different names never do.
 */
export function platFamilyKey(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/['’.,]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the\s+|\s+the$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

/** One recorded plat, as the county filed it. */
export type FamilyPlatInput = {
  /** boundaries.geo_slug, geo_type='subdivision'. */
  slug: string
  /** boundaries.geo_label — the county's own label. */
  label: string
  /**
   * The city the plat sits in: the boundary tree's city first, the city its
   * sales were filed under second. Empty when neither answers.
   */
  citySlug: string
  /** Lifetime closed sales on the plat (subdivision_plat_closed_mv), 0 when none. */
  closedCount: number
}

/** A registry community, as data/resort-communities.json records it. */
export type FamilyCommunityInput = {
  slug: string
  label: string
  citySlug: string
  aliases: readonly string[]
  /** Every MLS city spelling the registry says the community's listings file under. */
  mlsCities?: readonly string[]
}

/** One MLS SubdivisionName with the city its listings file under. */
export type FamilyMlsNameInput = { name: string; citySlug: string }

export type PlatFamilyNameSource = 'county' | 'registry' | 'mls'

export type PlatFamilyMember = {
  slug: string
  /** The county label, untouched. */
  label: string
  closedCount: number
}

export type PlatFamily = {
  /** The family's slug — slugify(name). Also its /subdivisions/ URL when it has no community page. */
  slug: string
  /** The recorded name, in the recorder's own words. */
  name: string
  /** Who recorded that name. */
  nameSource: PlatFamilyNameSource
  /** The city every member sits in. */
  citySlug: string
  /** The family's main page: its community page, or its own /subdivisions/ page. */
  mainHref: string
  mainKind: 'community' | 'subdivision'
  /** The registry community that owns the name, when one does. */
  communitySlug: string | null
  /**
   * The registry community this family sits INSIDE, when the registry records
   * the family's name as one of that community's subdivision aliases (Ridge At
   * Eagle Crest inside Eagle Crest, Deer Park inside Sunriver). The family keeps
   * its own main page; the community page links down to it. Null when the
   * family IS the community (communitySlug) or no alias names it.
   */
  parentCommunitySlug: string | null
  /**
   * Every recorded plat in the family, by slug. INCLUDES the head plat when the
   * county recorded the bare name as a plat of its own (Tetherow Crossing).
   */
  members: PlatFamilyMember[]
  /**
   * Sum of the members' lifetime closed counts. An INDEXABILITY input only:
   * a replat's sales are also inside the plat it replats, so this sum can count
   * one sale twice and must never be printed as a figure (§0).
   */
  closedCountSum: number
}

export type DerivePlatFamiliesInput = {
  plats: readonly FamilyPlatInput[]
  communities?: readonly FamilyCommunityInput[]
  mlsNames?: readonly FamilyMlsNameInput[]
  /**
   * Slugs that already name a different kind of place — a city, a registry
   * community, a City-of-Bend neighborhood. A family whose slug is one of them
   * gets no /subdivisions/ page of its own (/subdivisions/bend is not Bend).
   * Community slugs are still honoured as community MAIN pages above.
   */
  reservedSlugs?: ReadonlySet<string>
  /**
   * Area redirects already served in middleware (/subdivisions/{slug} -> path).
   * A family whose slug redirects is owned by that destination when it is a
   * place page, so the family never mints a second page for a name middleware
   * already sends somewhere.
   */
  areaRedirect?: (slug: string) => string | null
}

function familyGroupKey(key: string, citySlug: string): string {
  return `${citySlug}|${key}`
}

/**
 * A family's URL slug, spelled the way the county's own slugs are: "&" reads
 * as "and" (Ridge At Eagle Crest 12 Replat Lots 41-48 & 57-60 is
 * ridge-at-eagle-crest-12-replat-lots-41-48-and-57-60-...) and a slash
 * separates words. So a family slug is always the prefix its phases' slugs
 * already carry.
 */
export function platFamilySlug(name: string): string {
  return slugify(name.replace(/&/g, ' and ').replace(/[/@]/g, ' '))
}

/**
 * The name every member label BEGINS with, in the county's own words, when
 * they all begin with the same one. "Awbrey Butte Homesites Phase I" through
 * "Phase Thirty-three" all begin "Awbrey Butte Homesites": that is not a name
 * this module made up, it is the name the county wrote 34 times and numbered.
 * A base produced by removing words from the MIDDLE of a label is not a common
 * beginning, and names nothing here.
 */
function countyStem(members: readonly { label: string; closedCount: number; baseKey: string }[]): string | null {
  const byDepth = [...members].sort((a, b) => b.closedCount - a.closedCount)
  const lead = byDepth[0]
  if (!lead) return null
  const base = platFamilyBaseName(lead.label)
  if (!base) return null
  const wanted = platFamilyKey(base)
  for (const member of members) {
    const beginning = platFamilyKey(stripCountyDocumentTokens(member.label.replace(/\([^)]*\)/g, ' ')))
    if (beginning !== wanted && !beginning.startsWith(`${wanted} `)) return null
  }
  return base
}

/**
 * Every multi-plat family on record. Deterministic: the same inputs give the
 * same families in the same order (by city, then name).
 */
export function derivePlatFamilies(input: DerivePlatFamiliesInput): PlatFamily[] {
  const reserved = input.reservedSlugs ?? new Set<string>()
  const communities = input.communities ?? []

  // 1. Base + city per plat.
  type Row = FamilyPlatInput & { baseKey: string; labelKey: string }
  const rows: Row[] = []
  for (const plat of input.plats) {
    const slug = (plat.slug ?? '').trim()
    const label = (plat.label ?? '').trim()
    if (!slug || !label) continue
    const base = platFamilyBaseName(label)
    if (!base) continue
    rows.push({
      ...plat,
      slug,
      label,
      citySlug: (plat.citySlug ?? '').trim(),
      closedCount: Number.isFinite(plat.closedCount) ? Math.max(0, plat.closedCount) : 0,
      baseKey: platFamilyKey(base),
      labelKey: platFamilyKey(label),
    })
  }

  // 2. Group by base within a city. A plat with no known city joins its base's
  //    group only when exactly one city holds that base, so an unplaced plat is
  //    never guessed into one of two namesakes. When NO plat of the base has a
  //    city (Imperial Blocks 1-19 and Imperial Blocks 20-43: no boundary-tree
  //    parent, no sale on record), the unplaced plats are one name nowhere
  //    else, and they group with each other under no city; the family's
  //    outline read (0.15-degree coherence guard in subdivision_footprint)
  //    refuses to draw two far-apart namesakes as one place.
  const groups = new Map<string, Row[]>()
  const citiesByBase = new Map<string, Set<string>>()
  for (const row of rows) {
    if (!row.citySlug) continue
    const set = citiesByBase.get(row.baseKey) ?? new Set<string>()
    set.add(row.citySlug)
    citiesByBase.set(row.baseKey, set)
  }
  for (const row of rows) {
    let city = row.citySlug
    if (!city) {
      const cities = citiesByBase.get(row.baseKey)
      if (cities && cities.size > 1) continue
      city = cities && cities.size === 1 ? [...cities][0]! : ''
    }
    const k = familyGroupKey(row.baseKey, city)
    const bucket = groups.get(k) ?? []
    bucket.push({ ...row, citySlug: city })
    groups.set(k, bucket)
  }

  // Recorded names, keyed for comparison.
  const communityByKey = new Map<string, FamilyCommunityInput>()
  const aliasByKey = new Map<string, { name: string; community: FamilyCommunityInput }>()
  for (const c of communities) {
    communityByKey.set(platFamilyKey(c.label), c)
    communityByKey.set(platFamilyKey(c.slug.replace(/-/g, ' ')), c)
    for (const alias of c.aliases) {
      const k = platFamilyKey(alias)
      if (k && !aliasByKey.has(k)) aliasByKey.set(k, { name: alias, community: c })
    }
  }
  const mlsByCityKey = new Map<string, string>()
  for (const m of input.mlsNames ?? []) {
    const k = platFamilyKey(m.name)
    const city = (m.citySlug ?? '').trim()
    if (!k || !city) continue
    const key = familyGroupKey(k, city)
    if (!mlsByCityKey.has(key)) mlsByCityKey.set(key, m.name.trim())
  }

  const out: PlatFamily[] = []
  for (const [groupKey, members] of groups) {
    // 3. Multi-plat only.
    if (members.length < 2) continue
    const [citySlug, baseKey] = groupKey.split('|') as [string, string]

    // 4. A recorded name, or no family.
    const headPlat = members
      .filter((m) => m.labelKey === baseKey)
      .sort((a, b) => b.closedCount - a.closedCount || a.slug.localeCompare(b.slug))[0]
    const community = communityByKey.get(baseKey) ?? null
    const communityInCity =
      community &&
      (community.citySlug === citySlug ||
        (community.mlsCities ?? []).some((c) => slugify(c) === citySlug))
        ? community
        : null
    const alias = aliasByKey.get(baseKey) ?? null
    const aliasInCity =
      alias &&
      (alias.community.citySlug === citySlug ||
        (alias.community.mlsCities ?? []).some((c) => slugify(c) === citySlug))
        ? alias
        : null
    const mlsName = mlsByCityKey.get(groupKey) ?? null

    let name: string | null = null
    let nameSource: PlatFamilyNameSource | null = null
    if (headPlat) {
      name = headPlat.label
      nameSource = 'county'
    } else if (communityInCity) {
      name = communityInCity.label
      nameSource = 'registry'
    } else if (aliasInCity) {
      name = aliasInCity.name
      nameSource = 'registry'
    } else if (mlsName) {
      name = mlsName
      nameSource = 'mls'
    } else {
      const stem = countyStem(members)
      if (stem) {
        name = stem
        nameSource = 'county'
      }
    }
    if (!name || !nameSource) continue

    const slug = platFamilySlug(name)
    if (!slug || slug === 'unknown') continue

    // 5. The main page.
    let mainHref: string
    let mainKind: PlatFamily['mainKind']
    let communitySlug: string | null = null
    const redirect = input.areaRedirect?.(slug) ?? null
    if (communityInCity) {
      communitySlug = communityInCity.slug
      mainHref = communityPath(communityInCity.slug)
      mainKind = 'community'
    } else if (redirect && redirect.startsWith('/communities/')) {
      // The redirect names the PUBLIC door (juniper-preserve); the family keys
      // on the durable registry slug (pronghorn), like the branch above.
      const redirectSlug = redirect.split('/').filter(Boolean).at(-1) ?? null
      communitySlug = redirectSlug ? resolveDurableCommunitySlug(redirectSlug) : null
      mainHref = redirect
      mainKind = 'community'
    } else if (redirect) {
      // Middleware already sends this name to a city neighborhood, another plat
      // or a browse page. Minting a family page under a URL that 308s away
      // would be a page nobody can reach, so the family is not published.
      continue
    } else if (reserved.has(slug)) {
      continue
    } else {
      mainHref = `/subdivisions/${slug}`
      mainKind = 'subdivision'
    }

    const sorted = [...members].sort((a, b) => compareMembers(a.label, b.label))
    out.push({
      slug,
      name,
      nameSource,
      citySlug,
      mainHref,
      mainKind,
      communitySlug,
      parentCommunitySlug:
        mainKind === 'subdivision' && aliasInCity && aliasInCity.community.slug !== communitySlug
          ? aliasInCity.community.slug
          : null,
      members: sorted.map((m) => ({ slug: m.slug, label: m.label, closedCount: m.closedCount })),
      closedCountSum: sorted.reduce((sum, m) => sum + m.closedCount, 0),
    })
  }

  // One URL, one place. A family page may not take a slug another recorded
  // plat already answers to, and two same-named families in two towns may not
  // share one: either would put two places behind one address. The family
  // that owns the slug keeps it (the county recorded the bare name as one of
  // its plats); every other one is addressed by its name AND its town, the way
  // two namesakes are told apart in speech: "Aspen Heights" in Bend (four
  // recorded phases) is /subdivisions/aspen-heights-bend, because
  // /subdivisions/aspen-heights is the recorded Aspen Heights plat in
  // Prineville. The NAME stays the recorded one; only the address carries the
  // town. A family with no town, or whose town-qualified address is itself
  // taken, is left ungrouped rather than guessed into someone else's URL.
  const platSlugs = new Set(rows.map((r) => r.slug))
  const byFamilySlug = new Map<string, PlatFamily[]>()
  for (const family of out) {
    if (family.mainKind !== 'subdivision') continue
    const list = byFamilySlug.get(family.slug) ?? []
    list.push(family)
    byFamilySlug.set(family.slug, list)
  }
  const used = new Set<string>()
  const needsTown: PlatFamily[] = []
  const dropped = new Set<PlatFamily>()
  for (const [slug, list] of byFamilySlug) {
    const owner = list.find((family) => family.members.some((m) => m.slug === slug)) ?? null
    const keeper = owner ?? (list.length === 1 && !platSlugs.has(slug) ? list[0]! : null)
    if (keeper) used.add(slug)
    for (const family of list) if (family !== keeper) needsTown.push(family)
  }
  for (const family of needsTown) {
    const qualified = family.citySlug ? `${family.slug}-${family.citySlug}` : ''
    const free =
      qualified &&
      !platSlugs.has(qualified) &&
      !used.has(qualified) &&
      !reserved.has(qualified) &&
      !(input.areaRedirect?.(qualified) ?? null)
    if (!free) {
      dropped.add(family)
      continue
    }
    used.add(qualified)
    family.slug = qualified
    family.mainHref = `/subdivisions/${qualified}`
  }
  const kept = out.filter((family) => !dropped.has(family))

  kept.sort((a, b) => a.citySlug.localeCompare(b.citySlug) || a.name.localeCompare(b.name, 'en-US'))
  return kept
}

/**
 * The recorded-plat groups the family rule starts from: every set of two or
 * more plats sharing one base in one town (or, all unplaced, in none). Exposed
 * so the lock can prove the invariant Matt set on 2026-09-23 over real county
 * labels: every such group has a family with a main page, unless its base is
 * the name of a city (the Bend, Redmond and La Pine townsite plats, whose main
 * page is the city page itself).
 */
export function platBaseGroups(plats: readonly FamilyPlatInput[]): Array<{ key: string; citySlug: string; slugs: string[] }> {
  const rows = plats
    .map((p) => {
      const base = platFamilyBaseName(p.label)
      return base ? { slug: p.slug.trim(), citySlug: (p.citySlug ?? '').trim(), key: platFamilyKey(base) } : null
    })
    .filter((r): r is { slug: string; citySlug: string; key: string } => r !== null && r.slug.length > 0)
  const citiesByBase = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!r.citySlug) continue
    const set = citiesByBase.get(r.key) ?? new Set<string>()
    set.add(r.citySlug)
    citiesByBase.set(r.key, set)
  }
  const groups = new Map<string, { key: string; citySlug: string; slugs: string[] }>()
  for (const r of rows) {
    let city = r.citySlug
    if (!city) {
      const cities = citiesByBase.get(r.key)
      if (cities && cities.size > 1) continue
      city = cities && cities.size === 1 ? [...cities][0]! : ''
    }
    const k = familyGroupKey(r.key, city)
    const g = groups.get(k) ?? { key: r.key, citySlug: city, slugs: [] }
    g.slugs.push(r.slug)
    groups.set(k, g)
  }
  return [...groups.values()].filter((g) => g.slugs.length >= 2)
}

// ---------------------------------------------------------------------------
// Member order: the order a person reads phases in — Phase 2 before Phase 10,
// Phase II before Phase IX, Phase Nine before Phase Thirty.
// ---------------------------------------------------------------------------

const ROMAN_VALUE: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100 }

function romanToNumber(token: string): number | null {
  if (!/^[ivxlc]+$/i.test(token)) return null
  let total = 0
  const t = token.toLowerCase()
  for (let i = 0; i < t.length; i += 1) {
    const v = ROMAN_VALUE[t[i]]
    const next = ROMAN_VALUE[t[i + 1]] ?? 0
    total += v < next ? -v : v
  }
  return total > 0 ? total : null
}

function spelledToNumber(token: string): number | null {
  const t = token.toLowerCase()
  const unit = UNITS.indexOf(t)
  if (unit >= 0) return unit + 1
  const ord = ORDINALS.indexOf(t)
  if (ord >= 0) return ord + 1
  const [tens, one] = t.split('-')
  const tenIdx = TENS.indexOf(tens)
  if (tenIdx < 0) return null
  const base = (tenIdx + 2) * 10
  if (!one) return base
  const oneIdx = UNITS.indexOf(one)
  return oneIdx >= 0 && oneIdx < 9 ? base + oneIdx + 1 : null
}

/** The first phase number a label carries, in any of the county's spellings. */
export function platPhaseOrdinal(label: string): number | null {
  const tokens = stripCountyDocumentTokens(label).toLowerCase().split(/[\s,&]+/).filter(Boolean)
  for (const token of tokens) {
    const digits = /^(\d+)[a-z]?$/.exec(token)
    if (digits) return Number(digits[1])
    const roman = romanToNumber(token.replace(/-.*$/, ''))
    if (roman != null && token.length <= 6) return roman
    const spelled = spelledToNumber(token)
    if (spelled != null) return spelled
  }
  return null
}

function compareMembers(a: string, b: string): number {
  const na = platPhaseOrdinal(a)
  const nb = platPhaseOrdinal(b)
  if (na != null && nb != null && na !== nb) return na - nb
  if (na == null && nb != null) return -1
  if (na != null && nb == null) return 1
  return a.localeCompare(b, 'en-US')
}

// ---------------------------------------------------------------------------
// Lookups a page makes.
// ---------------------------------------------------------------------------

export type PlatFamilyRole =
  | { role: 'head'; family: PlatFamily }
  | { role: 'member'; family: PlatFamily; member: PlatFamilyMember }

/**
 * Where a /subdivisions/{slug} page sits in the family tree.
 *
 * `head` — this URL IS the family's main page: the page owns the family's name,
 * lists every phase, and is indexable. A family whose main page is a community
 * page has no `/subdivisions/` head.
 * `member` — this plat is one phase of a family, and its page links up to the
 * family's main page. A plat whose own slug is the family slug (the county
 * recorded the bare name as a plat) is the HEAD, never a member of itself.
 */
export function platFamilyRole(
  families: readonly PlatFamily[],
  slug: string | null | undefined,
): PlatFamilyRole | null {
  const key = (slug ?? '').trim().toLowerCase()
  if (!key) return null
  for (const family of families) {
    if (family.mainKind === 'subdivision' && family.slug === key) return { role: 'head', family }
  }
  for (const family of families) {
    const member = family.members.find((m) => m.slug === key)
    if (member && !(family.mainKind === 'subdivision' && family.slug === key)) {
      return { role: 'member', family, member }
    }
  }
  return null
}

/**
 * The families a registry community page links DOWN to, beside its own
 * phases: a family the registry files under the community (Ridge At Eagle
 * Crest in Eagle Crest), and a family any of whose recorded phases the
 * community's outline contains (Painted Ridge At Broken Top in Broken Top).
 * Community -> family -> phase, every step a real link.
 */
export function familiesNestedInCommunity(
  families: readonly PlatFamily[],
  communitySlug: string,
  containedPlatSlugs: ReadonlySet<string>,
): PlatFamily[] {
  return families.filter(
    (family) =>
      family.mainKind === 'subdivision' &&
      (family.parentCommunitySlug === communitySlug ||
        family.members.some((member) => containedPlatSlugs.has(member.slug))),
  )
}

/** The published name of a family, cased the way the site cases every place name. */
export function platFamilyDisplayName(family: Pick<PlatFamily, 'name'>): string {
  return recaseRomanPhases(publishPlatDisplayName(family.name) ?? titleCasePlaceName(family.name))
}

/**
 * A phase's name as a reader should see it in its family's list and in its
 * own title: the county's label without the land-use file numbers, cased the
 * site's way. The legal label itself still prints in the page body.
 *
 * publishPlatDisplayName withholds letter-coded MLS phases ("Phase C1") because
 * on an MLS row they are a filing code; on a COUNTY label they are the
 * recorded phase, so a withheld name falls back to the county's own words,
 * cased, rather than to nothing.
 */
export function platMemberDisplayName(label: string): string {
  const stripped = stripReaderResidue(label)
  return recaseRomanPhases(publishPlatDisplayName(stripped) ?? titleCasePlaceName(stripped))
}

/**
 * County file numbers and filing tokens out ("Inc.", "P.U.D.", "OLU", "SFR"),
 * the words and numbers of the phase kept: "Brooksmill Estates, P.u.d., Phase
 * 2" reads "Brooksmill Estates, Phase 2"; "Deschutes River Recreation
 * Homesites Inc. Blocks 23-31" reads "Deschutes River Recreation Homesites
 * Blocks 23-31" (SEO-7).
 */
function stripReaderResidue(label: string): string {
  const out = stripCountyDocumentTokens(label)
    .replace(FILING_TOKEN_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/,(?:\s*,)+/g, ',')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim()
  return out || label.trim()
}

/** A roman numeral of 2+ letters from I to XXXIX: the county's phase numbers. */
const ROMAN_PHASE_RE = /^(?=[ivx]{2,})x{0,3}(?:ix|iv|v?i{0,3})$/i

/**
 * The county types some roman phase numbers in title case ("Broken Top Phase
 * Ii-c", "Iv-f"). A phase number is a numeral, so it is cased as one: "Phase
 * II-C", "Phase IV-F". Only whole words that ARE a numeral change, so no
 * ordinary word is touched ("Vista", "Civic" and "Ivy" are not numerals).
 */
export function recaseRomanPhases(name: string): string {
  return name
    .split(' ')
    .map((token) => {
      // Trailing punctuation rides outside the numeral: "Xi," is "XI,".
      const [, word = token, trail = ''] = /^(.*?)([,.;:]*)$/.exec(token) ?? []
      const [head, ...rest] = word.split('-')
      if (!head || !ROMAN_PHASE_RE.test(head)) return token
      const suffix = rest.map((part) => (/^[a-z]\d?$/i.test(part) ? part.toUpperCase() : part))
      return [head.toUpperCase(), ...suffix].join('-') + trail
    })
    .join(' ')
}
