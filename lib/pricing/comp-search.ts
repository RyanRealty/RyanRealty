/**
 * THE SEARCH STORY, DERIVED FROM THE SEARCH (round four, class E).
 *
 * `describeCompSearch` (lib/pricing/search-story.ts) writes the seller-facing
 * story from the tier NAMES alone: the moment the ladder steps past the
 * subdivision it prints "There were not enough recent sales inside X". On
 * cma-2465-7th-redmond-97756 that sentence ran against its own document —
 * three of the five sales printed ARE Diamond Bar Ranch, six of the eight
 * candidates the ladder held came from in-subdivision rungs, and chapter 5
 * prints four Diamond Bar Ranch sales from the last ten weeks.
 *
 * This is the counted half. It holds what each rung of the ladder returned,
 * how many of the sales the document actually prints came from it, and how
 * those sales fall by subdivision — and it writes one sentence out of those
 * counts. A claim of scarcity is only made where the count IS zero. Nothing
 * here decides anything a renderer could not check against the numbers beside
 * it.
 */

import { countWord } from '@/lib/pricing/estimate'
import { parseTierMonths, parseTierRadiusMiles } from '@/lib/pricing/search-story'

/** One rung of the ladder as the selection recorded it. */
export type CompSearchRungInput = {
  tier: string
  ran: boolean
  monthsBack: number
  compsAdded: number
}

/** A kept sale, as the document prints it. */
export type CompSearchKeptComp = {
  subdivision?: string | null
  selectionTier?: string | null
}

export type CompSearchRung = {
  /** The tier name the selection walked, verbatim. */
  key: string
  /** That rung in the document's own words: "inside Diamond Bar Ranch". */
  label: string
  /** The time window it searched: "the last 3 months". Null on a curated set. */
  window: string | null
  /** Candidates this rung contributed to the pool. */
  added: number
  /** Of the sales the document prints, how many came from this rung. */
  kept: number
}

export type CompSearch = {
  /** The subject's subdivision, when the MLS row carries a usable one. */
  subdivision: string | null
  /** Every rung that RAN, in ladder order. A skipped rung is not a search step. */
  rungs: CompSearchRung[]
  /** Printed sales by subdivision name. Sales with no recorded subdivision are omitted. */
  keptBySubdivision: Record<string, number>
  /** One sentence, generated from the counts above and from nothing else. */
  sentence: string
}

const BROKER_TIER = 'broker-selected'

function clean(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  return t.length > 0 ? t : null
}

/**
 * MLS SUBDIVISION PLACEHOLDERS ARE NOT A PLACE.
 *
 * cma-65365-concorde carries `SubdivisionName = 'N/A'`, and so do five of its
 * six sales, so the first cut of this sentence read "Five of the six sales are
 * in N/A" — a grouping of homes that share the fact that nobody filled the
 * field in. The pattern mirrors `public.pricing_norm_subdivision` (migration
 * 20260814020000), which is what `subdivision_norm` and every subdivision cell
 * in the pricing engine are already built on; this is the same rule at the
 * reader's end of the pipe.
 */
const SUBDIVISION_PLACEHOLDER =
  /^(n\.?\/?a\.?|none|no|null|other|unknown|tbd|not\s+(in\s+)?(a\s+)?(sub)?division|[-.*]+)$/i

export function usableSubdivision(name: string | null | undefined): string | null {
  const t = clean(name)
  if (!t) return null
  return SUBDIVISION_PLACEHOLDER.test(t) ? null : t
}

function isSubdivisionTier(tier: string): boolean {
  return tier.startsWith('subdivision-')
}

function milesPhrase(miles: number): string {
  return miles === 1 ? 'a mile' : `${miles} miles`
}

/** The rung in seller language. Never the tier name, never a map legend. */
export function rungLabel(tier: string, subdivision: string | null): string {
  if (tier === BROKER_TIER) return 'chosen by your broker'
  if (isSubdivisionTier(tier)) {
    const where = subdivision ? `inside ${subdivision}` : 'inside your subdivision'
    return tier.endsWith('-wide') ? `${where}, any floorplan` : where
  }
  if (tier.startsWith('adjacent-sub')) return 'the subdivisions next to yours'
  if (tier.startsWith('beyond-')) {
    const miles = parseTierRadiusMiles(tier)
    return miles != null ? `outside your neighborhood, within ${milesPhrase(miles)}` : 'outside your neighborhood'
  }
  if (tier.startsWith('similar-sub')) return 'subdivisions that price like yours'
  // The listings ladder (lib/cma/comp-tiers.ts) — the path a subject takes
  // when the facts table cannot price it. 1617 NW 8th printed the bare tier
  // name "neighborhood-6mo" at a seller until these landed.
  if (tier.startsWith('neighborhood-')) return 'the neighborhood around your home'
  if (tier.startsWith('competing-area')) return 'the neighboring market area'
  if (tier.startsWith('citywide')) {
    const miles = parseTierRadiusMiles(tier)
    return miles != null ? `the wider city, within ${milesPhrase(miles)}` : 'the wider city'
  }
  if (tier.startsWith('rural-county')) return 'rural sales in the county'
  if (tier === 'gla-bracket') return 'a sale on each side of your square footage'
  if (tier.startsWith('city-')) {
    const miles = parseTierRadiusMiles(tier)
    return miles != null ? `the wider city, within ${milesPhrase(miles)}` : 'the wider city'
  }
  if (tier.startsWith('rural-')) {
    const miles = parseTierRadiusMiles(tier)
    return miles != null ? `rural sales within ${milesPhrase(miles)}` : 'rural sales further out'
  }
  if (tier.startsWith('nearby-')) {
    const miles = parseTierRadiusMiles(tier)
    return miles != null ? `within ${milesPhrase(miles)} at your size` : 'close to your home at your size'
  }
  return tier
}

function windowPhrase(tier: string, monthsBack: number): string | null {
  if (tier === BROKER_TIER) return null
  const months = monthsBack > 0 ? monthsBack : (parseTierMonths(tier) ?? 0)
  if (months <= 0) return null
  return months === 1 ? 'the last month' : `the last ${months} months`
}

/** "a, b and c". Never an Oxford comma, never a bare list of two joined by a comma. */
function joinPhrases(parts: string[]): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]!
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * Build the counted search record. Returns null when no rung ran — there is no
 * search to describe, and an empty object on `render_args` would read as one.
 */
export function buildCompSearch(input: {
  subdivision: string | null | undefined
  ladder: readonly CompSearchRungInput[]
  keptComps: readonly CompSearchKeptComp[]
}): CompSearch | null {
  const subdivision = usableSubdivision(input.subdivision)
  const ran = input.ladder.filter((r) => r.ran && clean(r.tier))
  if (ran.length === 0) return null

  const keptByTier = new Map<string, number>()
  for (const c of input.keptComps) {
    const tier = clean(c.selectionTier)
    if (!tier) continue
    keptByTier.set(tier, (keptByTier.get(tier) ?? 0) + 1)
  }

  const rungs: CompSearchRung[] = ran.map((r) => ({
    key: r.tier,
    label: rungLabel(r.tier, subdivision),
    window: windowPhrase(r.tier, r.monthsBack),
    added: Math.max(0, r.compsAdded),
    kept: keptByTier.get(r.tier) ?? 0,
  }))

  const keptBySubdivision: Record<string, number> = {}
  for (const c of input.keptComps) {
    const name = usableSubdivision(c.subdivision)
    if (!name) continue
    keptBySubdivision[name] = (keptBySubdivision[name] ?? 0) + 1
  }

  const total = input.keptComps.length
  const inside = subdivision
    ? input.keptComps.filter((c) => usableSubdivision(c.subdivision) === subdivision)
    : []
  const inSubdivision = inside.length

  // ONE ARITHMETIC. The rungs named beside "two more were added from" are the
  // rungs THOSE TWO SALES came from — resolved off the same array the count
  // is, never off the tier list separately. Splitting the two is how the first
  // cut of this sentence said "One more was added from" and then named three
  // rungs.
  //
  // Where no sale carries its tier — a caller with counts but no attribution —
  // fall back to the rungs that contributed candidates, which is still a
  // count, never a guess from the tier name.
  const labelFor = new Map(rungs.map((r) => [r.key, r.label]))
  const outsideKeys = new Set(
    input.keptComps
      .filter((c) => !subdivision || usableSubdivision(c.subdivision) !== subdivision)
      .map((c) => clean(c.selectionTier))
      .filter((k): k is string => k != null && labelFor.has(k)),
  )
  const attributed = outsideKeys.size > 0
  // Named in LADDER order — tightest rung first — not in whatever order the
  // sales happen to sit in the grid.
  const outsideLabels = joinPhrases([
    ...new Set(
      rungs
        .filter((r) =>
          attributed
            ? outsideKeys.has(r.key)
            : r.added > 0 && !isSubdivisionTier(r.key) && r.key !== BROKER_TIER,
        )
        .map((r) => r.label),
    ),
  ])

  const sentence = writeSentence({
    subdivision,
    total,
    inSubdivision,
    outsideLabels,
    brokerOnly: ran.every((r) => r.tier === BROKER_TIER),
  })

  return { subdivision, rungs, keptBySubdivision, sentence }
}

function writeSentence(args: {
  subdivision: string | null
  total: number
  inSubdivision: number
  outsideLabels: string
  brokerOnly: boolean
}): string {
  const { subdivision, total, inSubdivision, outsideLabels, brokerOnly } = args
  const n = countWord(total)
  if (brokerOnly) {
    return total === 1
      ? 'This sale was chosen by your broker.'
      : `These ${n} sales were chosen by your broker.`
  }
  if (total === 0) {
    return outsideLabels
      ? `The search ran ${outsideLabels} and no sale survived it.`
      : 'No sale survived the search.'
  }
  if (!subdivision) {
    return outsideLabels
      ? `The ${n} sales come from ${outsideLabels}.`
      : `The ${n} sales are the closest recent sales to your home.`
  }
  if (inSubdivision === 0) {
    return outsideLabels
      ? `No recent sale inside ${subdivision} matched your home, so the search opened to ${outsideLabels}.`
      : `No recent sale inside ${subdivision} matched your home.`
  }
  if (inSubdivision >= total) {
    return total === 1
      ? `The one sale behind this price is in ${subdivision}.`
      : `All ${n} sales are in ${subdivision}.`
  }
  const rest = total - inSubdivision
  const head = `${countWord(inSubdivision, true)} of the ${n} sales ${inSubdivision === 1 ? 'is' : 'are'} in ${subdivision}.`
  if (!outsideLabels) return head
  return `${head} ${countWord(rest, true)} more ${rest === 1 ? 'was' : 'were'} added from ${outsideLabels}.`
}
