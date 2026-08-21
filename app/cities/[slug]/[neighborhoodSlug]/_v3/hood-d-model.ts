/**
 * Pure shaping for the hood-d neighborhood restyle. No fetches. Empty in,
 * empty out. Never invents a district, park, dog park, or count.
 */
import bendMesh from '@/data/bend/bend-neighborhood-polygons.json'
import { CO_PARKS, getParkBySlug, findParksNear } from '@/data/co-parks'
import { CO_EVENTS } from '@/data/co-events'
import { CO_TRAILS } from '@/data/co-trails'
import { CO_VENUES } from '@/data/co-venues'
import { BEND_NEIGHBORHOOD_DISTRICTS } from '@/lib/data/geo/neighborhood-public-inventory'
import { formatPriceExact } from '@/lib/format/money'
import { publishDaysLabel } from '@/lib/market/publish-days-figure'
import { cityHero, communityImage } from '@/lib/geo-images'
import { listingDetailPath, slugify } from '@/lib/slug'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import type {
  HoodDChild,
  HoodDCompareRow,
  HoodDEvent,
  HoodDHome,
  HoodDMapRow,
  HoodDPeer,
  HoodDPlace,
  HoodDPost,
  HoodDSchool,
} from '@/components/site/hood-d/types'

const PARK_IMG: Record<string, string> = {
  'drake-park': '/images/kb/bend-drake-park-aerial.jpg',
  'smith-rock': '/images/kb/smith-rock-terrebonne.jpg',
}

const VENUE_IMG: Record<string, string> = {
  'hayden-homes-amphitheater': '/images/venues/hayden-homes-amphitheater.jpg',
}

const OFFICIAL = new Set(BEND_NEIGHBORHOOD_DISTRICTS.map((d) => d.slug))

type MeshRow = {
  tier: string
  route_slug: string
  name: string
  centroid: { lat: number; lng: number }
}

function miles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 3958.7613
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

function keyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function hoodHomes(
  tiles: Array<{
    listingKey: string | null
    listNumber: string | null
    listPrice: number | null
    beds: number | null
    baths: number | null
    sqft: number | null
    streetNumber: string | null
    streetName: string | null
    streetSuffix?: string | null
    city: string | null
    subdivisionName: string | null
    photoUrl?: string | null
    propertyType?: string | null
    propertySubType?: string | null
  }>,
): HoodDHome[] {
  return [...tiles]
    .filter((t) => Boolean(t.listingKey?.trim()) && Boolean(t.photoUrl?.trim()))
    .sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0))
    .slice(0, 4)
    .flatMap((t) => {
      const key = t.listingKey?.trim()
      const photo = t.photoUrl?.trim()
      if (!key || !photo) return []
      const street = publishStreetLine({
        streetNumber: t.streetNumber,
        streetName: t.streetName,
        streetSuffix: t.streetSuffix,
      })
      const meta = [
        t.beds != null ? `${t.beds} bd` : null,
        t.baths != null ? `${t.baths} ba` : null,
        t.sqft != null && t.sqft > 0 ? `${t.sqft.toLocaleString('en-US')} sf` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      return [
        {
          href: listingDetailPath(
            key,
            { streetNumber: t.streetNumber, streetName: t.streetName, city: t.city },
            { city: t.city, subdivision: t.subdivisionName },
            { mlsNumber: t.listNumber },
          ),
          img: photo,
          priceLabel: (() => {
            const ask = formatPublishedAsk(t.listPrice) ?? 'Price on request'
            const share = publishListingShareKind({
              propertySubType: t.propertySubType,
              subdivisionName: t.subdivisionName,
              city: t.city,
              listNumber: t.listNumber,
            })
            return share ? `${ask} · ${share}` : ask
          })(),
          address: street || t.subdivisionName?.trim() || 'Address withheld',
          meta: meta || null,
        } satisfies HoodDHome,
      ]
    })
}

export function hoodMapRows(
  tiles: Array<{
    listingKey: string | null
    listNumber: string | null
    listPrice: number | null
    beds: number | null
    baths: number | null
    streetNumber: string | null
    streetName: string | null
    streetSuffix?: string | null
    city: string | null
    subdivisionName: string | null
    propertySubType: string | null
    photoUrl: string | null
  }>,
): HoodDMapRow[] {
  return [...tiles]
    .filter((t) => Boolean(t.listingKey?.trim()))
    .sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0))
    .slice(0, 24)
    .flatMap((t) => {
      const key = t.listingKey?.trim()
      if (!key) return []
      const street = publishStreetLine({
        streetNumber: t.streetNumber,
        streetName: t.streetName,
        streetSuffix: t.streetSuffix,
      })
      const subtitle = [
        t.beds != null ? `${t.beds} bd` : null,
        t.baths != null ? `${t.baths} ba` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      return [
        {
          key,
          href: listingDetailPath(
            key,
            { streetNumber: t.streetNumber, streetName: t.streetName, city: t.city },
            { city: t.city, subdivision: t.subdivisionName },
            { mlsNumber: t.listNumber },
          ),
          title: street || t.subdivisionName?.trim() || 'Address withheld',
          subtitle: subtitle || null,
          price: t.listPrice,
          photoUrl: t.photoUrl?.trim() || null,
          propertySubType: t.propertySubType,
          subdivisionName: t.subdivisionName,
          city: t.city,
          listNumber: t.listNumber,
        } satisfies HoodDMapRow,
      ]
    })
}

/** Official place-graph children only. Hide the row when the graph is empty. */
export function hoodChildren(
  rows: Array<{ subdivision: string; slug: string }>,
): HoodDChild[] {
  const seen = new Set<string>()
  const out: HoodDChild[] = []
  for (const row of rows) {
    const name = row.subdivision.trim()
    const slug = (row.slug || slugify(name)).trim()
    if (!name || !slug || seen.has(slug)) continue
    seen.add(slug)
    out.push({ name, href: `/subdivisions/${slug}` })
  }
  return out
}

export function hoodPeers(selfSlug: string): HoodDPeer[] {
  const mesh = (bendMesh as { communities: MeshRow[] }).communities.filter(
    (c) => c.tier === 'city' && OFFICIAL.has(c.route_slug),
  )
  const self = mesh.find((c) => c.route_slug === selfSlug)
  const ranked = mesh
    .filter((c) => c.route_slug !== selfSlug)
    .map((c) => ({
      ...c,
      dist: self ? miles(self.centroid, c.centroid) : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
  return ranked.map((c) => {
    const img =
      communityImage(`bend-${c.route_slug}`) ?? communityImage(c.route_slug) ?? cityHero('bend').src
    return {
      name: c.name,
      href: `/cities/bend/${c.route_slug}`,
      img,
      detail: null,
    }
  })
}

type Amenity = {
  category?: string
  name?: string
  description?: string | null
  access?: string | null
}

function matchByName<T extends { name: string }>(name: string, rows: readonly T[]): T | undefined {
  const key = keyName(name).replace(/ and mirror pond$/, '')
  return rows.find((row) => {
    const pk = keyName(row.name)
    return key === pk || key.includes(pk) || pk.includes(key)
  })
}

function amenityPlaces(amenities: readonly Amenity[]): HoodDPlace[] {
  const out: HoodDPlace[] = []
  for (const a of amenities) {
    const cat = (a.category ?? '').trim()
    if (!/^(Parks|Recreation|Landmark)$/i.test(cat)) continue
    const name = a.name?.trim()
    if (!name) continue
    const park = matchByName(name, CO_PARKS)
    const trail = matchByName(name, CO_TRAILS)
    const venue = matchByName(name, CO_VENUES)
    let href: string | null = null
    let img: string | null = null
    if (park) {
      href = `/parks/${park.slug}`
      img = PARK_IMG[park.slug] ?? null
    } else if (trail) {
      href = `/central-oregon/trails/${trail.slug}`
    } else if (venue) {
      href = `/central-oregon/venues/${venue.slug}`
      img = VENUE_IMG[venue.slug] ?? null
    }
    out.push({
      name,
      href,
      detail: a.access?.trim() || a.description?.trim() || null,
      img,
    })
  }
  return out
}

export function hoodPlaces(
  lat: number | null,
  lng: number | null,
  content: ResortCommunityContent | null,
  neighborhoodSlug: string,
): { photos: HoodDPlace[]; list: HoodDPlace[]; note: string | null } {
  const fromAmenities = amenityPlaces(content?.amenities ?? [])
  const nearby: HoodDPlace[] = []
  if (typeof lat === 'number' && typeof lng === 'number') {
    for (const p of findParksNear(lat, lng, 2.5, 8)) {
      nearby.push({
        name: p.name,
        href: `/parks/${p.slug}`,
        detail: p.acres != null ? `${p.acres.toLocaleString('en-US')} acres` : p.city,
        img: PARK_IMG[p.slug] ?? null,
      })
    }
    for (const t of CO_TRAILS) {
      if (typeof t.lat !== 'number' || typeof t.lng !== 'number') continue
      if (miles({ lat, lng }, { lat: t.lat, lng: t.lng }) > 2.5) continue
      nearby.push({
        name: t.name,
        href: `/central-oregon/trails/${t.slug}`,
        detail: t.lengthMiles != null ? `${t.lengthMiles} miles` : t.city,
        img: null,
      })
    }
    for (const v of CO_VENUES) {
      if (typeof v.lat !== 'number' || typeof v.lng !== 'number') continue
      if (miles({ lat, lng }, { lat: v.lat, lng: v.lng }) > 1.6) continue
      nearby.push({
        name: v.name,
        href: `/central-oregon/venues/${v.slug}`,
        detail: v.address ?? v.city,
        img: VENUE_IMG[v.slug] ?? null,
      })
    }
  }

  const seen = new Set<string>()
  const list: HoodDPlace[] = []
  for (const row of [...fromAmenities, ...nearby]) {
    const k = keyName(row.name).replace(/ and mirror pond$/, '')
    if (!k) continue
    const dup = [...seen].some((s) => s === k || s.includes(k) || k.includes(s))
    if (dup) continue
    seen.add(k)
    list.push(row)
    if (list.length >= 8) break
  }

  const photos = list.filter((p) => p.img && p.href).slice(0, 3)
  const note = leashNote(neighborhoodSlug, list, content)
  return { photos, list, note }
}

function leashNote(
  neighborhoodSlug: string,
  list: HoodDPlace[],
  content: ResortCommunityContent | null,
): string | null {
  const names = `${list.map((p) => p.name).join(' ')} ${(content?.amenities ?? []).map((a) => `${a.name} ${a.description ?? ''}`).join(' ')}`
  const hasOffLeashAmenity = /off-leash|dog park/i.test(names)
  const parts: string[] = []
  const drake = getParkBySlug('drake-park')
  const listsDrake = list.some((p) => /drake park/i.test(p.name))
  if (listsDrake && drake && !drake.amenities.some((a) => /off-leash/i.test(a))) {
    parts.push('Drake Park is on-leash.')
  }
  if (neighborhoodSlug === 'river-west' && !hasOffLeashAmenity) {
    parts.push('There is no official dog park inside River West.')
  }
  return parts.length > 0 ? parts.join(' ') : null
}

export function hoodEvents(lat: number | null, lng: number | null): HoodDEvent[] {
  if (typeof lat !== 'number' || typeof lng !== 'number') return []
  return CO_EVENTS.filter((e) => typeof e.lat === 'number' && typeof e.lng === 'number')
    .map((e) => ({
      name: e.name,
      href: `/central-oregon/events/${e.slug}`,
      detail: e.venue ?? e.city,
      dist: miles({ lat, lng }, { lat: e.lat as number, lng: e.lng as number }),
    }))
    .filter((e) => e.dist <= 8)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 4)
    .map(({ name, href, detail }) => ({ name, href, detail }))
}

export function hoodJournal(
  posts: Array<{ title: string; slug: string; excerpt: string | null; publishedAt: string | null }>,
  formatDate: (iso: string) => string,
): HoodDPost[] {
  return posts.slice(0, 3).map((p) => ({
    title: p.title,
    href: `/blog/${p.slug}`,
    excerpt: p.excerpt,
    dateLabel: p.publishedAt ? formatDate(p.publishedAt) : null,
  }))
}

export function hoodSchools(content: ResortCommunityContent | null): HoodDSchool[] {
  const amenities = content?.amenities ?? []
  const rows: HoodDSchool[] = []
  const seen = new Set<string>()
  for (const a of amenities) {
    if ((a.category ?? '').trim().toLowerCase() !== 'schools') continue
    const name = a.name?.trim()
    if (!name || seen.has(keyName(name))) continue
    seen.add(keyName(name))
    const detail = [a.access?.trim()].filter(Boolean).join(' · ') || null
    rows.push({ name, detail })
    const body = `${a.description ?? ''} ${a.access ?? ''}`
    for (const extra of ['Cascade Middle', 'Summit High', 'Pacific Crest Middle', 'Caldera High']) {
      if (!new RegExp(extra, 'i').test(body)) continue
      if (seen.has(keyName(extra))) continue
      seen.add(keyName(extra))
      rows.push({ name: extra, detail: null })
    }
  }
  return rows
}

export function hoodCompare(input: {
  hereActive: number | null
  hereMedian: number | null
  hereDays: number | null
  cityActive: number | null
  cityMedian: number | null
  cityDays: number | null
}): HoodDCompareRow[] {
  const rows: HoodDCompareRow[] = []
  if (input.hereActive != null || input.cityActive != null) {
    rows.push({
      label: 'Homes',
      here: input.hereActive != null ? input.hereActive.toLocaleString('en-US') : '—',
      city: input.cityActive != null ? input.cityActive.toLocaleString('en-US') : '—',
    })
  }
  if (input.hereMedian != null || input.cityMedian != null) {
    rows.push({
      label: 'Median list',
      here: input.hereMedian != null ? formatPriceExact(input.hereMedian) : '—',
      city: input.cityMedian != null ? formatPriceExact(input.cityMedian) : '—',
    })
  }
  const hereDays = publishDaysLabel(input.hereDays)
  const cityDays = publishDaysLabel(input.cityDays)
  if (hereDays || cityDays) {
    rows.push({
      label: 'Days to pending',
      here: hereDays ?? '—',
      city: cityDays ?? '—',
    })
  }
  return rows
}

export function hoodLead(input: {
  name: string
  cityName: string
  prose: string[]
}): string {
  const first = input.prose[0]?.trim()
  if (first) {
    const sentence = first.split(/(?<=\.)\s/)[0]?.trim()
    if (sentence && sentence.length < 180) return sentence
  }
  return `Single-family homes in ${input.name}, ${input.cityName}. List prices and days on market, pulled live.`
}
