/**
 * criteria-sentence — pure plain-English sentence builders for the reusable
 * criteria editors (AlertCriteriaEditor + ReportCriteriaEditor).
 *
 * No React, no I/O, no server imports. Everything here is unit-testable
 * (criteria-sentence.test.ts) and safe to import from both server and client
 * code. The editors render these sentences live as the broker edits, so the
 * wording follows brand voice: plain English, sentence case, no jargon.
 */

import { normalizeSavedSearchFilters, type SavedSearchFilters } from '@/lib/search-filters'
import { BEND_DISTRICTS, labelForNeighborhoodSlug } from '@/lib/neighborhood-areas'
import { getPropertyTypeLabel } from '@/lib/property-type-labels'
import resortCommunities from '@/data/resort-communities.json'

/** Alert cadences the alert cron honors (mirrors lib/saved-search-cadence). */
export type AlertFrequency = 'instant' | 'daily' | 'weekly'

/**
 * Market report cadences (mirrors ReportFrequency in
 * lib/data/crm/getContactReportSubscriptions — kept as a local union so this
 * module never imports server code).
 */
export type ReportFrequency = 'weekly' | 'monthly' | 'quarterly'

/** A selectable geography option: a canonical slug + display label. */
export type GeoOption = { slug: string; label: string }

/** "$800K", "$1.2M", "$950" — compact price for inline sentence text. */
export function formatPriceShort(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '$0'
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    const rounded = Math.round(millions * 10) / 10
    return `$${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}M`
  }
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value).toLocaleString('en-US')}`
}

/** "Bend", "Bend and Redmond", "Bend, Redmond and Sisters". */
export function joinWithAnd(items: string[]): string {
  const clean = items.map((s) => s.trim()).filter(Boolean)
  if (clean.length === 0) return ''
  if (clean.length === 1) return clean[0]
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`
  return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`
}

/** The mid-sentence phrase for an alert cadence: "Email me [once a day] ...". */
export function alertFrequencyPhrase(frequency: AlertFrequency): string {
  if (frequency === 'instant') return 'as new homes hit the market'
  if (frequency === 'weekly') return 'once a week'
  return 'once a day'
}

/** The mid-sentence noun for the property type: "... with [residential listings] ...". */
export function propertyTypePhrase(propertyType: string | undefined): string {
  const raw = (propertyType ?? '').trim()
  if (!raw) return 'new listings'
  const label = getPropertyTypeLabel(raw)
  if (!label || label === '—') return 'new listings'
  return `${label.toLowerCase()} listings`
}

/**
 * The "in [place]" phrase from normalized filters. Neighborhood beats
 * community beats city; multiple cities join with "and"; no geography reads
 * as the whole service area.
 */
export function placePhrase(filters: SavedSearchFilters): string {
  const normalized = normalizeSavedSearchFilters(filters)
  const neighborhoodSlug = typeof normalized.neighborhoodSlug === 'string' ? normalized.neighborhoodSlug : ''
  const subdivision = typeof normalized.subdivision === 'string' ? normalized.subdivision : ''
  const city = typeof normalized.city === 'string' ? normalized.city : ''
  const cities = Array.isArray(normalized.cities)
    ? (normalized.cities as string[]).filter((c) => typeof c === 'string' && c.trim())
    : []

  if (neighborhoodSlug) return `in ${labelForNeighborhoodSlug(neighborhoodSlug)}`
  if (subdivision && city) return `in ${subdivision}, ${city}`
  if (subdivision) return `in ${subdivision}`
  const allCities = [...(city ? [city] : []), ...cities.filter((c) => c !== city)]
  if (allCities.length > 0) return `in ${joinWithAnd(allCities)}`
  return 'in Central Oregon'
}

/** "between $500K and $800K", "under $800K", "over $500K", or null when open. */
export function pricePhrase(minPrice: number | undefined, maxPrice: number | undefined): string | null {
  const min = Number.isFinite(minPrice) ? minPrice : undefined
  const max = Number.isFinite(maxPrice) ? maxPrice : undefined
  if (min !== undefined && max !== undefined) return `between ${formatPriceShort(min)} and ${formatPriceShort(max)}`
  if (max !== undefined) return `under ${formatPriceShort(max)}`
  if (min !== undefined) return `over ${formatPriceShort(min)}`
  return null
}

/**
 * Filter keys the alert sentence spells out in words. Everything else that
 * survives normalization counts toward the "plus N more filters" tail.
 * sort/view/statusFilter are presentation keys, not criteria, so they are
 * excluded from the tail too.
 */
const SENTENCE_COVERED_KEYS: ReadonlySet<string> = new Set([
  'city', 'cities', 'subdivision', 'neighborhoodSlug',
  'minPrice', 'maxPrice', 'beds', 'baths', 'propertyType',
  'sort', 'view', 'statusFilter',
])

/** How many normalized filter keys the sentence does NOT spell out. */
export function extraFilterCount(filters: SavedSearchFilters): number {
  const normalized = normalizeSavedSearchFilters(filters)
  return Object.keys(normalized).filter((key) => !SENTENCE_COVERED_KEYS.has(key)).length
}

/**
 * The full alert sentence, e.g.
 * "Email me once a day with residential listings in Bend under $800K with
 *  3+ beds and 2+ baths, plus 2 more filters."
 */
export function alertCriteriaSentence(
  filters: SavedSearchFilters,
  frequency: AlertFrequency = 'daily',
): string {
  const normalized = normalizeSavedSearchFilters(filters)
  const beds = typeof normalized.beds === 'number' && normalized.beds > 0 ? normalized.beds : undefined
  const baths = typeof normalized.baths === 'number' && normalized.baths > 0 ? normalized.baths : undefined
  const minPrice = typeof normalized.minPrice === 'number' ? normalized.minPrice : undefined
  const maxPrice = typeof normalized.maxPrice === 'number' ? normalized.maxPrice : undefined
  const propertyType = typeof normalized.propertyType === 'string' ? normalized.propertyType : undefined

  const parts: string[] = [
    `Email me ${alertFrequencyPhrase(frequency)}`,
    `with ${propertyTypePhrase(propertyType)}`,
    placePhrase(normalized),
  ]

  const price = pricePhrase(minPrice, maxPrice)
  if (price) parts.push(price)

  if (beds !== undefined && baths !== undefined) parts.push(`with ${beds}+ beds and ${baths}+ baths`)
  else if (beds !== undefined) parts.push(`with ${beds}+ beds`)
  else if (baths !== undefined) parts.push(`with ${baths}+ baths`)

  let sentence = parts.join(' ')
  const extras = extraFilterCount(normalized)
  if (extras > 0) sentence += `, plus ${extras} more ${extras === 1 ? 'filter' : 'filters'}`
  return `${sentence}.`
}

/** Sentence-position cadence word for reports: "Send a [monthly] market report ...". */
export function reportFrequencyWord(frequency: ReportFrequency): string {
  if (frequency === 'weekly') return 'weekly'
  if (frequency === 'quarterly') return 'quarterly'
  return 'monthly'
}

/** Area slugs to display labels; unknown slugs fall back to the shared neighborhood label helper. */
export function resolveAreaLabels(areas: string[], options: readonly GeoOption[]): string[] {
  const bySlug = new Map(options.map((o) => [o.slug, o.label]))
  return areas
    .map((slug) => slug.trim())
    .filter(Boolean)
    .map((slug) => bySlug.get(slug) ?? labelForNeighborhoodSlug(slug))
}

/**
 * The full report sentence, e.g.
 * "Send a monthly market report for Bend and Tetherow."
 * With no areas chosen the sentence stays honest about the gap.
 */
export function reportCriteriaSentence(
  areas: string[],
  frequency: ReportFrequency,
  options: readonly GeoOption[],
): string {
  const labels = resolveAreaLabels(areas, options)
  if (labels.length === 0) return `Send a ${reportFrequencyWord(frequency)} market report. No areas chosen yet.`
  return `Send a ${reportFrequencyWord(frequency)} market report for ${joinWithAnd(labels)}.`
}

/**
 * Compact label for the areas trigger button: "Choose areas", "Bend",
 * "Bend and Tetherow", "Bend, Redmond and 3 more".
 */
export function summarizeAreaLabels(labels: string[]): string {
  const clean = labels.map((s) => s.trim()).filter(Boolean)
  if (clean.length === 0) return 'Choose areas'
  if (clean.length <= 2) return joinWithAnd(clean)
  return `${clean[0]}, ${clean[1]} and ${clean.length - 2} more`
}

type RegistryCommunity = { slug?: unknown; label?: unknown }

/**
 * Default neighborhood/community options for the alert editor place picker:
 * the 13 Bend districts + every resort/area community from the registry,
 * de-duped by slug and sorted by label. Client-safe (static JSON, same import
 * lib/neighborhood-areas already makes).
 */
export function listNeighborhoodOptions(): GeoOption[] {
  const bySlug = new Map<string, GeoOption>()
  for (const d of BEND_DISTRICTS) bySlug.set(d.slug, { slug: d.slug, label: d.label })
  const communities = Array.isArray((resortCommunities as { communities?: unknown }).communities)
    ? ((resortCommunities as { communities: RegistryCommunity[] }).communities)
    : []
  for (const c of communities) {
    const slug = typeof c.slug === 'string' ? c.slug : null
    const label = typeof c.label === 'string' ? c.label : null
    if (!slug || !label || bySlug.has(slug)) continue
    bySlug.set(slug, { slug, label })
  }
  return [...bySlug.values()].sort((a, b) => a.label.localeCompare(b.label))
}
