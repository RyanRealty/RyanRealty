// brand-voice:exempt — factual market Q&A generated from verified live data, no marketing prose
import type { SearchPreset } from '@/lib/search-presets'
import { getPresetBySlug, resolvePresetYearBuiltMin } from '@/lib/search-presets'
import { CITY_POPULAR_SEARCHES } from '@/lib/popular-searches'
import { getCityContent } from '@/lib/city-content'
import { homesForSalePath } from '@/lib/slug'
import type { MarketFaqInput, MarketFaqItem } from '@/lib/site/market-faq'

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
  // View types (details.View keyword match)
  'mountain-view': viewCopy('mountain', 'Mountain'),
  'water-view': viewCopy('water', 'Water'),
  'river-view': viewCopy('river', 'River'),
  'golf-course-view': viewCopy('golf course', 'Golf Course'),
  'lake-view': viewCopy('lake', 'Lake'),
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function asOfLabel(refreshedAt: string | null | undefined): string | null {
  if (!refreshedAt) return null
  const d = new Date(refreshedAt)
  if (Number.isNaN(d.getTime())) return null
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
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
): PresetFaqResult | null {
  if (isSortOnlyPreset(preset)) return null
  const copy = PRESET_COPY[preset.slug]
  if (!copy) return null

  const clause = copy.clause ?? 'on the market'
  const count = Number.isFinite(totalCount) && totalCount > 0 ? Math.floor(totalCount) : 0
  const label = asOfLabel(cityPulse?.refreshedAt)
  const asOf = label ? ` as of ${label}` : ''

  // ── Intro (2-3 sentences) ────────────────────────────────────────────────
  const sentences: string[] = []
  sentences.push(
    count === 0
      ? `No ${copy.plural} are ${clause} in ${city} right now, but inventory changes daily.`
      : `${count.toLocaleString('en-US')} ${count === 1 ? copy.singular : copy.plural} ${count === 1 ? 'is' : 'are'} ${clause} in ${city} right now.`,
  )
  const character = cityCharacterSentence(city)
  if (character) sentences.push(character)
  // Labeled city-wide context — NEVER presented as this segment's own stats.
  const contextParts: string[] = []
  if (cityPulse?.medianListPrice != null && cityPulse.medianListPrice > 0) {
    contextParts.push(`the median list price is ${roundedThousand(cityPulse.medianListPrice)}`)
  }
  if (cityPulse?.medianDaysToPending != null && cityPulse.medianDaysToPending > 0) {
    contextParts.push(`homes take a median of ${cityPulse.medianDaysToPending} days to go pending`)
  }
  if (contextParts.length > 0) {
    sentences.push(`Across ${city} as a whole, ${contextParts.join(' and ')}${asOf}.`)
  }
  const intro = sentences.slice(0, 3).join(' ')

  // ── FAQ (2-4 questions, every figure null-guarded) ───────────────────────
  const faqs: MarketFaqItem[] = []

  faqs.push({
    question: copy.countQuestion ? copy.countQuestion(city) : `How many ${copy.plural} are for sale in ${city}?`,
    answer:
      count === 0
        ? `None right now. Inventory updates throughout the day, so check back or save this search to get an alert when one hits the market.`
        : `There ${count === 1 ? 'is' : 'are'} ${count.toLocaleString('en-US')} ${count === 1 ? copy.singular : copy.plural} ${clause} in ${city} right now, based on live MLS data.`,
  })

  faqs.push({
    question: 'What does this search include?',
    answer: copy.criteria(city),
  })

  if (cityPulse?.medianListPrice != null && cityPulse.medianListPrice > 0) {
    faqs.push({
      question: `What do homes cost in ${city} overall?`,
      answer: `Across all of ${city}, the median list price for a single-family home is ${roundedThousand(cityPulse.medianListPrice)}${asOf}, based on live MLS data. That figure covers the whole city, not just the listings in this search.`,
    })
  }

  if (cityPulse?.medianDaysToPending != null && cityPulse.medianDaysToPending > 0) {
    faqs.push({
      question: `How fast are homes selling in ${city}?`,
      answer: `City-wide, single-family homes in ${city} take a median of ${cityPulse.medianDaysToPending} days to go pending${asOf}. Pace varies by price range and neighborhood.`,
    })
  }

  return {
    intro,
    faqs: faqs.slice(0, 4),
    faqTitle: `Questions about ${copy.plural} in ${city}`,
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
 * Adjacent price bands in the SAME city (e.g. under-750k -> under-600k +
 * under-1m). Empty for non-price presets.
 */
export function getAdjacentPriceBandLinks(city: string, presetSlug: string): PresetCrossLink[] {
  const idx = PRICE_BAND_LADDER.indexOf(presetSlug as (typeof PRICE_BAND_LADDER)[number])
  if (idx === -1) return []
  const links: PresetCrossLink[] = []
  for (const neighborIdx of [idx - 1, idx + 1]) {
    const slug = PRICE_BAND_LADDER[neighborIdx]
    if (!slug) continue
    const neighbor = getPresetBySlug(slug)
    if (!neighbor) continue
    links.push({
      href: `${homesForSalePath(city)}/${neighbor.slug}`,
      label: `${neighbor.shortLabel} in ${city}`,
    })
  }
  return links
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
