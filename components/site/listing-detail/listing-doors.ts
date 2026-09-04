/**
 * Long tail of a listing page: two to four doors, each one live fact, never
 * an estimate. Destinations that already exist (place, school, park, plat)
 * leave this page. Payment, rental, and a published CMA stay on-page folds.
 */
import { findSchoolByName } from '@/data/co-schools'
import { findParksNear } from '@/data/co-parks'
import { v3Text, type V3Door } from '@/components/site/v3'

function cleanMls(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.startsWith('***')) return null
  return trimmed
}

export function listingRentalEligible(input: {
  propertyType: string | null
  beds: number | null
  wholePropertyPrice: number | null
}): boolean {
  const price = input.wholePropertyPrice
  if (price == null || price <= 0 || price > 2_000_000) return false
  if (input.beds == null) return false
  const t = (input.propertyType ?? '').trim().toUpperCase()
  if (['D', 'E', 'F', 'G', 'H'].includes(t)) return false
  if (['A', 'B', 'C'].includes(t) || !t) return true
  const lower = t.toLowerCase()
  return !(lower.includes('land') || lower.includes('lot') || lower.includes('commercial') || lower.includes('acreage'))
}

export function buildListingDoors(input: {
  neighborhood?: { href: string; name: string; homesForSale?: number | null }
  elementarySchool?: string | null
  middleSchool?: string | null
  highSchool?: string | null
  schoolDistrict?: string | null
  plat?: { href: string; name: string; documentCount: number }
  lat?: number | null
  lng?: number | null
  paymentHref?: string
  rental?: boolean
  cma?: boolean
  sitsInside?: { href: string; name: string }
}): V3Door[] {
  const doors: V3Door[] = []
  const nabe = input.neighborhood
  if (nabe?.href && nabe.name.trim()) {
    const count = nabe.homesForSale
    doors.push({
      kicker: v3Text('Place'),
      label: v3Text(nabe.name.trim()),
      href: nabe.href,
      fact:
        count != null && count > 0
          ? v3Text(`${count.toLocaleString('en-US')} for sale`)
          : undefined,
    })
  }

  const schoolName =
    cleanMls(input.highSchool) ?? cleanMls(input.middleSchool) ?? cleanMls(input.elementarySchool)
  if (schoolName) {
    const registered = findSchoolByName(schoolName)
    const district = cleanMls(input.schoolDistrict)
    doors.push({
      kicker: v3Text('Schools'),
      label: v3Text(schoolName),
      href: registered ? `/schools/${registered.slug}` : '/schools',
      fact: district ? v3Text(district) : undefined,
    })
  }

  if (input.plat && input.plat.name.trim() && input.plat.documentCount > 0) {
    doors.push({
      kicker: v3Text('Plat'),
      label: v3Text(input.plat.name.trim()),
      href: input.plat.href,
      fact: v3Text(
        `${input.plat.documentCount} recorded ${input.plat.documentCount === 1 ? 'document' : 'documents'}`,
      ),
    })
  }

  if (typeof input.lat === 'number' && typeof input.lng === 'number') {
    const nearest = findParksNear(input.lat, input.lng, 3, 1)[0]
    if (nearest) {
      doors.push({
        kicker: v3Text('Parks'),
        label: v3Text(nearest.name),
        href: `/parks/${nearest.slug}`,
        fact: v3Text(`${nearest.distanceMiles.toFixed(1)} mi`),
      })
    }
  }

  if (input.paymentHref) {
    doors.push({
      kicker: v3Text('Payment'),
      label: v3Text('Monthly payment'),
      href: input.paymentHref,
    })
  }

  if (input.sitsInside?.href && input.sitsInside.name.trim()) {
    doors.push({
      kicker: v3Text('Inside'),
      label: v3Text(input.sitsInside.name.trim()),
      href: input.sitsInside.href,
    })
  }

  if (input.rental) {
    doors.push({
      kicker: v3Text('Rent'),
      label: v3Text('Rental numbers'),
      href: '#rental',
    })
  }

  if (input.cma) {
    doors.push({
      kicker: v3Text('Value'),
      label: v3Text('Our opinion of value'),
      href: '#cma',
    })
  }

  const unique: V3Door[] = []
  const seen = new Set<string>()
  for (const door of doors) {
    if (seen.has(door.href)) continue
    seen.add(door.href)
    unique.push(door)
    if (unique.length === 4) break
  }
  return unique
}

export function listingDoorsOrNull(doors: V3Door[]): readonly [V3Door, V3Door, ...V3Door[]] | null {
  if (doors.length < 2) return null
  const picked = doors.slice(0, 4)
  return [picked[0]!, picked[1]!, ...picked.slice(2)]
}
