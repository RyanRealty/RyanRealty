/**
 * City-d shaping for the live /cities/[slug] template. Pure. No fetches.
 * Nearby names come from the resort/community graph the city page already
 * reads. Schools come from the CO_SCHOOLS registry. Nothing here invents a
 * city, park, count, or fee.
 */

import { CO_SCHOOLS, getDistrictForCity } from '@/data/co-schools'
import { communityImage } from '@/lib/geo-images'
import { getPlaceLinks } from '@/lib/place-links'
import { CITY_RESORT_LEDGER_IMG } from '@/lib/kb/city-page-config'
import { formatPriceExact } from '@/lib/format/money'
import { publishDaysLabel } from '@/lib/market/publish-days-figure'
import type { CityDFooterLink, CityDMarketKpi, CityDNearbyPlace, CityDSchool } from '@/components/site/city-d/types'

/** Official city-template slugs. Crooked River Ranch is a community URL. */
export const CITY_TEMPLATE_SLUGS: ReadonlySet<string> = new Set([
  'bend',
  'redmond',
  'sisters',
  'sunriver',
  'la-pine',
  'tumalo',
  'terrebonne',
  'prineville',
  'madras',
  'powell-butte',
  'culver',
  'black-butte-ranch',
  'camp-sherman',
  'metolius',
])

export function cityPitchHeading(input: {
  cityName: string
  nearestAirport?: string | null
}): string {
  const airport = input.nearestAirport?.trim() ?? ''
  if (airport && airport.toLowerCase().includes(input.cityName.toLowerCase())) {
    return 'The airport town'
  }
  return input.cityName
}

export function cityDistrictsNote(hasOfficialNeighborhoods: boolean, cityName: string): string | null {
  if (hasOfficialNeighborhoods) return null
  return `${cityName} has no official district set. Named communities sit next door or down the highway, not as a layer on this page.`
}

export function cityHeroLead(input: {
  cityName: string
  activeCount: number | null
  medianListPrice: number | null
  medianDaysToPending: number | null
}): string {
  const parts: string[] = []
  if (input.activeCount != null) {
    const noun = input.activeCount === 1 ? 'home' : 'homes'
    parts.push(
      `${input.activeCount.toLocaleString('en-US')} ${noun} for sale in ${input.cityName}`,
    )
  } else {
    parts.push(`Single-family homes in ${input.cityName}`)
  }
  parts.push('List prices and days on market, pulled live')
  const median = formatPriceExact(input.medianListPrice)
  if (median !== '—') parts.push(`Median list ${median}`)
  const pending = publishDaysLabel(input.medianDaysToPending)
  if (pending) parts.push(`Pending in ${pending}`)
  return `${parts.join('. ')}.`
}

type ResortRow = {
  slug: string
  label: string
  city_slug: string
  city?: string
}

type CommunityRow = {
  slug: string
  subdivision: string
  city?: string | null
  heroImageUrl?: string | null
  activeCount: number
}

export function nearbyPlacesForCity(input: {
  citySlug: string
  cityName: string
  resorts: readonly ResortRow[]
  communities: readonly CommunityRow[]
  resortCounts: ReadonlyMap<string, number>
  ledgerImg?: Readonly<Record<string, string>>
}): CityDNearbyPlace[] {
  const seen = new Set<string>()
  const out: CityDNearbyPlace[] = []

  const rankedResorts = [...input.resorts].sort((a, b) => {
    const ca = input.resortCounts.get(a.slug) ?? 0
    const cb = input.resortCounts.get(b.slug) ?? 0
    return cb - ca || a.label.localeCompare(b.label)
  })

  for (const resort of rankedResorts) {
    const img =
      communityImage(resort.slug) ??
      input.ledgerImg?.[resort.slug] ??
      CITY_RESORT_LEDGER_IMG[resort.slug] ??
      input.communities.find((c) => c.slug === resort.slug || c.subdivision.toLowerCase() === resort.label.toLowerCase())
        ?.heroImageUrl ??
      null
    if (!img) continue
    const href = getPlaceLinks({ type: 'community', slug: resort.slug, citySlug: input.citySlug }).placeUrl
    if (seen.has(href)) continue
    seen.add(href)
    out.push({
      name: resort.label,
      href,
      img,
      town: resort.city?.trim() || input.cityName,
    })
    if (out.length >= 2) return out
  }

  const rankedComms = [...input.communities]
    .filter((c) => (c.heroImageUrl ?? '').trim().length > 0)
    .sort((a, b) => b.activeCount - a.activeCount || a.subdivision.localeCompare(b.subdivision))

  for (const comm of rankedComms) {
    const img = comm.heroImageUrl?.trim()
    if (!img) continue
    const href = getPlaceLinks({
      type: 'community',
      slug: comm.slug,
      citySlug: input.citySlug,
    }).placeUrl
    if (seen.has(href)) continue
    seen.add(href)
    out.push({
      name: comm.subdivision,
      href,
      img,
      town: comm.city?.trim() || input.cityName,
    })
    if (out.length >= 2) break
  }

  return out
}

export function schoolsForCity(cityName: string): { schools: CityDSchool[]; district: string | null } {
  const district = getDistrictForCity(cityName) ?? null
  const schools = CO_SCHOOLS.filter((s) => s.city.toLowerCase() === cityName.toLowerCase()).map((s) => ({
    name: s.name,
    href: `/schools/${s.slug}`,
    level: s.level,
    grades: s.grades ?? null,
    district: s.district,
  }))
  return { schools, district: district?.district ?? null }
}

export function marketKpis(input: {
  medianListPrice: number | null
  activeCount: number | null
  medianDaysToPending: number | null
  daysLabel?: string | null
  hasOfficialNeighborhoods: boolean
}): CityDMarketKpi[] {
  const kpis: CityDMarketKpi[] = []
  const median = formatPriceExact(input.medianListPrice)
  if (median !== '—') kpis.push({ label: 'Median list', value: median })
  if (input.activeCount != null) {
    kpis.push({ label: 'Active', value: input.activeCount.toLocaleString('en-US') })
  }
  const pending = input.daysLabel ?? publishDaysLabel(input.medianDaysToPending)
  if (pending) kpis.push({ label: 'Days to pending', value: pending })
  kpis.push({
    label: 'Grain',
    value: input.hasOfficialNeighborhoods ? 'City with districts' : 'City',
  })
  return kpis
}

export function footerCityLinks(
  snapshots: readonly { geoKey: string; geoLabel: string }[],
): CityDFooterLink[] {
  return snapshots
    .map((s) => {
      const slug = s.geoKey.replace(/\s+/g, '-')
      return { slug, label: s.geoLabel, href: `/cities/${slug}` }
    })
    .filter((row) => CITY_TEMPLATE_SLUGS.has(row.slug) && row.slug !== 'crooked-river-ranch')
    .map((row) => ({ href: row.href, label: row.label }))
}

export function footerCommunityLinks(
  resorts: readonly { slug: string; label: string }[],
): CityDFooterLink[] {
  const seen = new Set<string>()
  const out: CityDFooterLink[] = []
  for (const r of resorts) {
    const href = getPlaceLinks({ type: 'community', slug: r.slug }).placeUrl
    if (seen.has(href)) continue
    seen.add(href)
    out.push({ href, label: r.label })
  }
  return out
}
