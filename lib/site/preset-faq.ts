// brand-voice:exempt — factual market Q&A generated from verified live data, no marketing prose
import type { SearchPreset } from '@/lib/search-presets'
import { getPresetBySlug, resolvePresetYearBuiltMin } from '@/lib/search-presets'
import { CITY_POPULAR_SEARCHES } from '@/lib/popular-searches'
import { getCityContent } from '@/lib/city-content'
import { homesForSalePath } from '@/lib/slug'
import type { MarketFaqInput, MarketFaqItem } from '@/lib/site/market-faq'
import { publishDaysFigure } from '@/lib/market/publish-days-figure'
import { publishPulseAsOfLabel } from '@/lib/market/publish-pulse-freshness'

/**
 * Preset-scoped editorial depth for the indexable search-preset pages
 * (/homes-for-sale/[city]/[preset]) — modeled closely on lib/site/market-faq.ts.
 *
 * One function produces three surfaces from the SAME inputs so the visible
 * text and the FAQPage JSON-LD can never diverge:
 *
 *   1. a 2-3 sentence honest editorial intro (count + city character + labeled city context)
 *   2. the visible preset FAQ section (rendered by FAQBlock)
 *   3. the FAQPage JSON-LD (FAQBlock emits it from the same items)
 *
 * Data accuracy (CLAUDE.md §0 — ABSOLUTE):
 *   - `totalCount` is the ONLY segment-level figure. It is the exact full_count
 *     of this search, already fetched by the page (zero extra DB calls).
 *   - City-level pulse stats are cited ONLY as labeled city-wide context
 *     ("Across Bend as a whole, the median list price is ...") and the answer
 *     says so explicitly. A per-segment median does not exist in the cache, so
 *     none is ever shown or implied.
 *   - Every pulse figure is null-guarded: a missing stat produces NO sentence
 *     and NO question. Zero-count searches get honest "none on the market
 *     right now" copy, never invented inventory.
 *
 * Sort-only presets (price-low-to-high / price-high-to-low) are pure re-orders
 * of the city page, not market segments — buildPresetFaq returns null for them
 * so they render no depth (and no duplicate-content FAQ).
 */

export type PresetFaqResult = {
  /** 2-3 sentence editorial intro, rendered under the H1. */
  intro: string
  /** Preset-scoped Q&A (2-4 items). Feeds FAQBlock, which emits FAQPage JSON-LD. */
  faqs: MarketFaqItem[]
  /** Sentence-case section title for the FAQ block. */
  faqTitle: string
}

export type PresetCrossLink = { href: string; label: string }

/** A preset whose only param is `sort` re-orders results without segmenting them. */
export function isSortOnlyPreset(preset: SearchPreset): boolean {
  const keys = Object.entries(preset.params)
    .filter(([, v]) => v != null)
    .map(([k]) => k)
  return keys.length > 0 && keys.every((k) => k === 'sort')
}

/**
 * Per-preset noun phrases + count-question wording. Hand-written (not derived
 * from labels) so the prose stays brand-voice clean and grammatical. `clause`
 * defaults to "on the market"; pending sales are "under contract".
 */
type PresetCopy = {
  /** e.g. "homes under $750,000" */
  plural: string
  /** e.g. "home under $750,000" */
  singular: string
  /** Verb clause for count sentences. Default "on the market". */
  clause?: string
  /** Count question override (default "How many {plural} are for sale in {city}?"). */
  countQuestion?: (city: string) => string
  /** Honest, config-derived answer to "What does this search include?" */
  criteria: (city: string) => string
}

const PRICE_FMT = (n: number) => `$${n.toLocaleString('en-US')}`

const underBand = (max: number): PresetCopy => ({
  plural: `homes under ${PRICE_FMT(max)}`,
  singular: `home under ${PRICE_FMT(max)}`,
  criteria: (city) => `Active MLS listings in ${city} priced under ${PRICE_FMT(max)}. The count updates as homes are listed, go pending, or change price.`,
})

const overBand = (min: number): PresetCopy => ({
  plural: `homes priced ${PRICE_FMT(min)} and up`,
  singular: `home priced ${PRICE_FMT(min)} and up`,
  criteria: (city) => `Active MLS listings in ${city} priced ${PRICE_FMT(min)} and up. The count updates as homes are listed, go pending, or change price.`,
})

const keywordCopy = (plural: string, singular: string, phrase: string): PresetCopy => ({
  plural,
  singular,
  criteria: (city) =>
    `Listings in ${city} whose MLS descriptions mention "${phrase}". Listing agents write those descriptions, so coverage depends on how each home was written up.`,
})

const viewCopy = (kind: string, mlsTerm: string): PresetCopy => ({
  plural: `homes with ${kind} views`,
  singular: `home with a ${kind} view`,
  criteria: (city) => `Listings in ${city} whose MLS view field includes "${mlsTerm}", as reported by the listing agent.`,
})

const PRESET_COPY: Record<string, PresetCopy> = {
  // Price tiers
  'under-300k': underBand(300_000),
  'under-400k': underBand(400_000),
  'under-500k': underBand(500_000),
  'under-600k': underBand(600_000),
  'under-750k': underBand(750_000),
  'under-1m': underBand(1_000_000),
  'under-1-5m': underBand(1_500_000),
  luxury: overBand(1_000_000),
  'over-1-5m': overBand(1_500_000),
  'over-2m': overBand(2_000_000),
  // Status / recency
  pending: {
    plural: 'pending sales',
    singular: 'pending sale',
    clause: 'under contract',
    countQuestion: (city) => `How many homes are under contract in ${city}?`,
    criteria: (city) =>
      `Listings in ${city} that have accepted an offer and are under contract. A pending home can return to the market if the sale falls through.`,
  },
  'new-listings': {
    plural: 'homes listed in the last 7 days',
    singular: 'home listed in the last 7 days',
    criteria: (city) => `Homes in ${city} that hit the MLS within the last 7 days.`,
  },
  'new-listings-30': {
    plural: 'homes listed in the last 30 days',
    singular: 'home listed in the last 30 days',
    criteria: (city) => `Homes in ${city} that hit the MLS within the last 30 days.`,
  },
  'open-house': {
    plural: 'homes with an upcoming open house',
    singular: 'home with an upcoming open house',
    criteria: (city) => `Active listings in ${city} with an open house on the calendar, per the MLS open-house feed.`,
  },
  'new-construction': {
    plural: 'newly built homes',
    singular: 'newly built home',
    criteria: (city) => {
      const preset = getPresetBySlug('new-construction')
      const yearMin = preset ? resolvePresetYearBuiltMin(preset) : null
      return yearMin != null
        ? `Homes in ${city} built in ${yearMin} or later, based on the MLS year-built field. The floor moves forward each year so this page stays current.`
        : `Recently built homes in ${city}, based on the MLS year-built field.`
    },
  },
  // Land / lot
  acreage: {
    plural: 'homes on an acre or more',
    singular: 'home on an acre or more',
    criteria: (city) => `Homes in ${city} on lots of 1 acre or more, per the MLS lot-size field.`,
  },
  'acreage-5': {
    plural: 'homes on 5 or more acres',
    singular: 'home on 5 or more acres',
    criteria: (city) => `Homes in ${city} on lots of 5 acres or more, per the MLS lot-size field.`,
  },
  'lots-and-land': {
    plural: 'lots and land listings',
    singular: 'lot or land listing',
    criteria: (city) =>
      `Bare land and residential lots in ${city}, per the MLS property-type field. Before you buy a lot to build on, verify zoning, water (well or municipal), septic or sewer, and access with the county. We can walk you through what to check.`,
  },
  'residential-lots': {
    plural: 'residential lots',
    singular: 'residential lot',
    criteria: (city) =>
      `Bare residential lots in ${city}, per the MLS property subtype. Commercial, agricultural, and recreational land is excluded. Before you buy a lot to build on, verify zoning, water (well or municipal), septic or sewer, and access with the county. We can walk you through what to check.`,
  },
  // Community types
  'gated-community': {
    plural: 'homes in gated communities',
    singular: 'home in a gated community',
    criteria: (city) =>
      `Listings in ${city} whose MLS records list gated access among the community or parking features.`,
  },
  // Property types
  condos: {
    plural: 'condos',
    singular: 'condo',
    criteria: (city) => `Listings in ${city} with a condominium property subtype in the MLS.`,
  },
  townhomes: {
    plural: 'townhomes',
    singular: 'townhome',
    criteria: (city) => `Listings in ${city} with a townhouse property subtype in the MLS.`,
  },
  'multi-family': {
    plural: 'multi-family and income properties',
    singular: 'multi-family or income property',
    criteria: (city) =>
      `Duplexes, triplexes, fourplexes, and other income properties in ${city}, per the MLS multi-family property type. Rent rolls and expenses come from the listing agent, so verify them during due diligence.`,
  },
  duplex: {
    plural: 'duplexes',
    singular: 'duplex',
    criteria: (city) =>
      `Listings in ${city} with a duplex property subtype in the MLS. Rent rolls and expenses come from the listing agent, so verify them during due diligence.`,
  },
  triplex: {
    plural: 'triplexes',
    singular: 'triplex',
    criteria: (city) =>
      `Listings in ${city} with a triplex property subtype in the MLS. Rent rolls and expenses come from the listing agent, so verify them during due diligence.`,
  },
  fourplex: {
    plural: 'fourplexes',
    singular: 'fourplex',
    criteria: (city) =>
      `Listings in ${city} carrying the MLS Quadruplex property subtype, the feed's term for a fourplex. Rent rolls and expenses come from the listing agent, so verify them during due diligence.`,
  },
  manufactured: {
    plural: 'manufactured homes',
    singular: 'manufactured home',
    criteria: (city) =>
      `Listings in ${city} whose MLS property subtype includes manufactured. That covers homes on owned land and homes in parks, so check the land ownership and any space rent on each listing.`,
  },
  // Layout / lifestyle (PublicRemarks keyword match)
  'single-level': keywordCopy('single-level homes', 'single-level home', 'single level'),
  'with-shop': keywordCopy('homes with a shop', 'home with a shop', 'shop'),
  'rv-parking': keywordCopy('homes with RV parking', 'home with RV parking', 'RV'),
  // Features
  'with-pool': {
    plural: 'homes with a pool',
    singular: 'home with a pool',
    criteria: (city) => `Listings in ${city} whose MLS records indicate a pool.`,
  },
  'with-view': {
    plural: 'homes with a view',
    singular: 'home with a view',
    criteria: (city) => `Listings in ${city} whose MLS records indicate a view, as reported by the listing agent.`,
  },
  'with-fireplace': {
    plural: 'homes with a fireplace',
    singular: 'home with a fireplace',
    criteria: (city) => `Listings in ${city} whose MLS records indicate a fireplace.`,
  },
  'on-golf-course': {
    plural: 'golf course homes',
    singular: 'golf course home',
    criteria: (city) =>
      `Listings in ${city} on or fronting a golf course, or in a golf community, based on the MLS view field and listing descriptions.`,
  },
  // View types — the term resolves to the enumerated MLS view values it covers
  // (lib/search-presets.ts).
  'mountain-view': viewCopy('mountain', 'Mountain'),
  // NOT viewCopy: the MLS view field never contains the word "Water" (0 active
  // listings), it names the body of water. Saying otherwise would describe a
  // filter we do not run.
  'water-view': {
    plural: 'homes with water views',
    singular: 'home with a water view',
    criteria: (city) =>
      `Listings in ${city} whose MLS view field names a body of water (lake, river, pond, or creek), as reported by the listing agent.`,
  },
  'river-view': viewCopy('river', 'River'),
  'golf-course-view': viewCopy('golf course', 'Golf Course'),
  'lake-view': viewCopy('lake', 'Lake'),
}

function asOfLabel(refreshedAt: string | null | undefined): string | null {
  return publishPulseAsOfLabel(refreshedAt)
}

/** Currency rounded to the nearest thousand, e.g. 894750 -> "$895,000". */
function roundedThousand(n: number): string {
  const r = Math.round(n / 1000) * 1000
  return `$${r.toLocaleString('en-US')}`
}

/**
 * First sentence of the static city description (lib/city-content.ts) — the
 * "city character" line. Skipped if it carries punctuation the brand voice
 * rules ban in body copy.
 */
function cityCharacterSentence(city: string): string | null {
  const content = getCityContent(city)
  if (!content?.description) return null
  const first = content.description.split(/(?<=\.)\s+/)[0]?.trim()
  if (!first || first.length < 20) return null
  if (/[—–;!]/.test(first)) return null
  return first.endsWith('.') ? first : `${first}.`
}

export function buildPresetFaq(
  city: string,
  preset: SearchPreset,
  totalCount: number,
  cityPulse: MarketFaqInput | null,
  /**
   * W3.2 — the AREA this render is scoped to (subdivision / neighborhood /
   * resort display name) on a 3-segment {city}/{area}/{preset} page. Null on a
   * plain 2-segment city preset page.
   *
   * CLAUDE.md §0, the whole reason this parameter exists: `totalCount` is the
   * count of THIS search, which on a 3-segment page is scoped to the AREA, not
   * the city. Naming the city next to an area-scoped count would put a true
   * number beside the wrong place — the exact narrative-vs-data mismatch §0
   * forbids. Every segment-level sentence below names `place`; the city-level
   * pulse stats stay explicitly labeled as city-wide.
   */
  areaLabel?: string | null,
): PresetFaqResult | null {
  if (isSortOnlyPreset(preset)) return null
  const copy = PRESET_COPY[preset.slug]
  if (!copy) return null

  const clause = copy.clause ?? 'on the market'
  const count = Number.isFinite(totalCount) && totalCount > 0 ? Math.floor(totalCount) : 0
  const label = asOfLabel(cityPulse?.refreshedAt)
  const asOf = label ? ` as of ${label}` : ''

  // The place `totalCount` actually covers. Short form for prose; qualified
  // form ("Tetherow, Bend") for the search-definition answer so an area name
  // is never ambiguous across cities.
  const area = areaLabel?.trim() || null
  const place = area ?? city
  const placeQualified = area ? `${area}, ${city}` : city

  // ── Intro (2-3 sentences) ────────────────────────────────────────────────
  const sentences: string[] = []
  sentences.push(
    count === 0
      ? `No ${copy.plural} are ${clause} in ${place} right now, but inventory changes daily.`
      : `${count.toLocaleString('en-US')} ${count === 1 ? copy.singular : copy.plural} ${count === 1 ? 'is' : 'are'} ${clause} in ${place} right now.`,
  )
  const character = cityCharacterSentence(city)
  if (character) sentences.push(character)
  // Labeled city-wide context — NEVER presented as this segment's own stats.
  const contextParts: string[] = []
  if (cityPulse?.medianListPrice != null && cityPulse.medianListPrice > 0) {
    contextParts.push(`the median list price is ${roundedThousand(cityPulse.medianListPrice)}`)
  }
  const cityDays = publishDaysFigure(cityPulse?.medianDaysToPending)
  if (cityDays) {
    contextParts.push(`homes take a median of ${cityDays} days to go pending`)
  }
  if (contextParts.length > 0) {
    sentences.push(`Across ${city} as a whole, ${contextParts.join(' and ')}${asOf}.`)
  }
  const intro = sentences.slice(0, 3).join(' ')

  // ── FAQ (2-4 questions, every figure null-guarded) ───────────────────────
  const faqs: MarketFaqItem[] = []

  faqs.push({
    question: copy.countQuestion ? copy.countQuestion(place) : `How many ${copy.plural} are for sale in ${place}?`,
    answer:
      count === 0
        ? `None right now. Inventory updates throughout the day, so check back or save this search to get an alert when one hits the market.`
        : `There ${count === 1 ? 'is' : 'are'} ${count.toLocaleString('en-US')} ${count === 1 ? copy.singular : copy.plural} ${clause} in ${place} right now, based on live MLS data.`,
  })

  faqs.push({
    question: 'What does this search include?',
    answer: copy.criteria(placeQualified),
  })

  if (cityPulse?.medianListPrice != null && cityPulse.medianListPrice > 0) {
    faqs.push({
      question: `What do homes cost in ${city} overall?`,
      answer: `Across all of ${city}, the median list price for a single-family home is ${roundedThousand(cityPulse.medianListPrice)}${asOf}, based on live MLS data. That figure covers the whole city, not just the listings in this search.`,
    })
  }

  if (cityDays) {
    faqs.push({
      question: `How fast are homes selling in ${city}?`,
      answer: `City-wide, single-family homes in ${city} take a median of ${cityDays} days to go pending${asOf}. Pace varies by price range and neighborhood.`,
    })
  }

  return {
    intro,
    faqs: faqs.slice(0, 4),
    faqTitle: `Questions about ${copy.plural} in ${place}`,
  }
}

// ── Cross-links ──────────────────────────────────────────────────────────────

/** Price-band presets in ascending order. Adjacent = the neighbors in this ladder. */
const PRICE_BAND_LADDER = [
  'under-300k',
  'under-400k',
  'under-500k',
  'under-600k',
  'under-750k',
  'under-1m',
  'under-1-5m',
  'luxury',
  'over-1-5m',
  'over-2m',
] as const

/**
 * Adjacent price bands in the SAME place (e.g. under-750k -> under-600k +
 * under-1m). Empty for non-price presets.
 *
 * W3.2: on a 3-segment {city}/{area}/{preset} page, pass `area` so the neighbor
 * bands stay INSIDE the subdivision ({city}/{area}/{neighbor}). Dropping the
 * area segment here would bounce a visitor from Tetherow's under-$750K page to
 * all of Bend's, which is a different search than the one they are reading.
 */
export function getAdjacentPriceBandLinks(
  city: string,
  presetSlug: string,
  area?: { slug: string; label: string } | null,
): PresetCrossLink[] {
  const idx = PRICE_BAND_LADDER.indexOf(presetSlug as (typeof PRICE_BAND_LADDER)[number])
  if (idx === -1) return []
  const base = homesForSalePath(city)
  const links: PresetCrossLink[] = []
  for (const neighborIdx of [idx - 1, idx + 1]) {
    const slug = PRICE_BAND_LADDER[neighborIdx]
    if (!slug) continue
    const neighbor = getPresetBySlug(slug)
    if (!neighbor) continue
    links.push({
      href: area ? `${base}/${area.slug}/${neighbor.slug}` : `${base}/${neighbor.slug}`,
      label: `${neighbor.shortLabel} in ${area?.label ?? city}`,
    })
  }
  return links
}

/**
 * The one-step-wider search for a 3-segment area page: the same preset across
 * the whole parent city. Replaces the "same preset in other cities" rail on
 * area pages, where the nearest useful next search is up, not sideways.
 */
export function getParentCityPresetLink(city: string, preset: SearchPreset): PresetCrossLink {
  return {
    href: `${homesForSalePath(city)}/${preset.slug}`,
    label: `${preset.shortLabel} in ${city}`,
  }
}

/**
 * The same preset in other seeded cities — only cities whose data-grounded
 * popular-search list (lib/popular-searches.ts) actually carries this preset,
 * so we never cross-link to an empty-inventory combination.
 */
export function getSamePresetCityLinks(
  preset: SearchPreset,
  currentCitySlug: string,
  limit = 5,
): PresetCrossLink[] {
  return CITY_POPULAR_SEARCHES.filter(
    (c) => c.citySlug !== currentCitySlug && c.presetSlugs.includes(preset.slug),
  )
    .slice(0, limit)
    .map((c) => ({
      href: `${homesForSalePath(c.city)}/${preset.slug}`,
      label: `${preset.shortLabel} in ${c.city}`,
    }))
}
