import {
  V3Ledger,
  V3Quiet,
  v3Text,
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { dailyLifeRows } from '@/app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-daily-life'
import { CO_PARKS } from '@/data/co-parks'
import { getTrailBySlug } from '@/data/co-trails'
import type { ResortCommunityContent } from '@/lib/resort-community-content'

function leftoverAmenityRows(content: ResortCommunityContent): V3LedgerPlainRow[] {
  const rows: V3LedgerPlainRow[] = []
  const seen = new Set<string>()
  const push = (row: V3LedgerPlainRow) => {
    const id = row.id ?? row.href
    if (seen.has(id)) return
    seen.add(id)
    rows.push(row)
  }
  for (const row of dailyLifeRows(content, content.name)) push(row)
  for (const amenity of content.amenities) {
    const name = amenity.name?.trim()
    if (!name) continue
    const category = amenity.category?.trim()
    if (category === 'Parks') {
      const park = CO_PARKS.find(
        (p) =>
          name.toLowerCase().includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(name.toLowerCase()),
      )
      if (park) {
        push({
          href: `/parks/${park.slug}`,
          when: v3Text('Park'),
          what: v3Text(park.name),
          detail: amenity.access?.trim() ? v3Text(amenity.access.trim()) : undefined,
          id: `park-${park.slug}`,
        })
      }
    }
    if (category === 'Recreation' && /trail/i.test(name)) {
      const trail = getTrailBySlug('deschutes-river-trail-first-street')
      if (trail && /deschutes river trail/i.test(name)) {
        push({
          href: `/central-oregon/trails/${trail.slug}`,
          when: v3Text('Trail'),
          what: v3Text(trail.name),
          id: `trail-${trail.slug}`,
        })
      }
    }
  }
  return rows
}

/**
 * Leftover neighborhood on a listing: authored prose + daily-life doors.
 * Renders nothing when the listing has no neighborhood leftover.
 */
export function ListingNeighborhoodSection({
  name,
  href,
  content,
}: {
  name: string
  href: string
  content: ResortCommunityContent
}) {
  const aboutItems: V3QuietItem[] = content.aboutProse
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((body) => ({ kind: 'prose' as const, body }))

  const daily = leftoverAmenityRows(content)
  const [firstDaily, ...restDaily] = daily

  const driveRows: V3LedgerPlainRow[] = content.driveTimes
    .filter((d) => Number.isFinite(d.minutes) && d.destination.trim())
    .map((d, i) => ({
      href,
      when: v3Text(`${d.minutes} min`),
      what: v3Text(d.destination.trim()),
      detail: d.note?.trim() ? v3Text(d.note.trim()) : undefined,
      id: `drive-${i}-${d.destination.trim()}`,
    }))
  const [firstDrive, ...restDrive] = driveRows

  if (aboutItems.length === 0 && !firstDaily && !firstDrive) return null

  return (
    <>
      {aboutItems.length > 0 ? (
        <V3Quiet
          id="neighborhood"
          eyebrow="Neighborhood"
          heading={`About ${name}`}
          items={[
            ...aboutItems,
            { label: `See ${name}`, href },
          ]}
        />
      ) : null}
      {firstDaily ? (
        <V3Ledger
          heading={v3Text(`In ${name}`)}
          eyebrow={v3Text('Daily life')}
          rows={[firstDaily, ...restDaily]}
        />
      ) : null}
      {firstDrive ? (
        <V3Ledger
          heading={v3Text(`From ${name}`)}
          eyebrow={v3Text('Drive times')}
          rows={[firstDrive, ...restDrive]}
        />
      ) : null}
    </>
  )
}
