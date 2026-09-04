import Link from 'next/link'
import type { LifestyleNearItem } from '@/lib/explore/lifestyle-near'
import { lifestyleNearByKind } from '@/lib/explore/lifestyle-near'
import { getParkBySlug } from '@/data/co-parks'
import { getTrailBySlug } from '@/data/co-trails'
import { getEventBySlug } from '@/data/co-events'
import { GOLF_COURSES } from '@/data/golf/courses'
import { getParkBoundaryGeoJSON, getTrailLineGeoJSON } from '@/lib/data'
import { PlaceListThumb } from '@/components/site/PlaceListThumb'

type Props = {
  lat: number | null | undefined
  lng: number | null | undefined
  /** Override precomputed items (e.g. place centroid). */
  items?: LifestyleNearItem[]
}

type NearThumb = { lat: number; lng: number; geometry: unknown } | null

function slugFromHref(href: string, prefix: string): string | null {
  if (!href.startsWith(prefix)) return null
  const slug = href.slice(prefix.length).split('/')[0]?.trim()
  return slug || null
}

function formatMiles(miles: number): string {
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`
}

async function resolveThumbs(items: LifestyleNearItem[]): Promise<NearThumb[]> {
  return Promise.all(
    items.map(async (item): Promise<NearThumb> => {
      if (item.kind === 'park') {
        const slug = slugFromHref(item.href, '/parks/')
        const park = slug ? getParkBySlug(slug) : undefined
        if (!park) return null
        const geometry = park.hasPolygon
          ? await getParkBoundaryGeoJSON(park.slug).catch(() => null)
          : null
        return { lat: park.lat, lng: park.lng, geometry }
      }
      if (item.kind === 'trail') {
        const slug = slugFromHref(item.href, '/central-oregon/trails/')
        const trail = slug ? getTrailBySlug(slug) : undefined
        if (!trail || trail.lat == null || trail.lng == null) return null
        const geometry = slug ? await getTrailLineGeoJSON(slug).catch(() => null) : null
        return { lat: trail.lat, lng: trail.lng, geometry }
      }
      if (item.kind === 'golf') {
        const slug = slugFromHref(item.href, '/central-oregon/golf/')
        const course = slug ? GOLF_COURSES.find((c) => c.slug === slug) : undefined
        if (!course) return null
        return { lat: course.lat, lng: course.lng, geometry: null }
      }
      if (item.kind === 'event') {
        const slug = slugFromHref(item.href, '/central-oregon/events/')
        const event = slug ? getEventBySlug(slug) : undefined
        if (!event || event.lat == null || event.lng == null) return null
        return { lat: event.lat, lng: event.lng, geometry: null }
      }
      return null
    }),
  )
}

function NearGroup({
  id,
  title,
  items,
  thumbs,
}: {
  id: string
  title: string
  items: LifestyleNearItem[]
  thumbs: NearThumb[]
}) {
  if (items.length === 0) return null
  return (
    <section id={id} className="listing-near" aria-label={title}>
      <div className="listing-near__head">
        <h2 className="listing-near__title">{title}</h2>
      </div>
      <ul className="listing-near__list">
        {items.map((item, i) => {
          const thumb = thumbs[i]
          return (
            <li key={`${item.kind}-${item.href}`}>
              <Link href={item.href} className="listing-near__row">
                {thumb ? (
                  <PlaceListThumb lat={thumb.lat} lng={thumb.lng} geometry={thumb.geometry} />
                ) : (
                  <span className="listing-near__empty" aria-hidden="true" />
                )}
                <span className="listing-near__copy">
                  <span className="listing-near__kind">{item.kind}</span>
                  <span className="listing-near__name">{item.name}</span>
                  {item.meta ? <span className="listing-near__meta">{item.meta}</span> : null}
                  <span className="listing-near__dist tabular-nums">{formatMiles(item.distanceMiles)}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Parks, trails, golf, and events near a point. Each kind is its own section.
 * Park and trail rows always carry a map thumb from existing geo. Event and
 * golf rows use the venue or course point. Detail pages keep the live map.
 */
export async function LifestyleNearSection({ lat, lng, items: itemsProp }: Props) {
  const grouped = itemsProp
    ? {
        parks: itemsProp.filter((item) => item.kind === 'park'),
        trails: itemsProp.filter((item) => item.kind === 'trail'),
        golf: itemsProp.filter((item) => item.kind === 'golf'),
        events: itemsProp.filter((item) => item.kind === 'event'),
      }
    : lifestyleNearByKind(lat, lng)

  if (
    grouped.parks.length + grouped.trails.length + grouped.golf.length + grouped.events.length ===
    0
  ) {
    return null
  }

  const [parkThumbs, trailThumbs, golfThumbs, eventThumbs] = await Promise.all([
    resolveThumbs(grouped.parks),
    resolveThumbs(grouped.trails),
    resolveThumbs(grouped.golf),
    resolveThumbs(grouped.events),
  ])

  return (
    <>
      <NearGroup id="parks-nearby" title="Parks nearby" items={grouped.parks} thumbs={parkThumbs} />
      <NearGroup id="trails-nearby" title="Trails nearby" items={grouped.trails} thumbs={trailThumbs} />
      <NearGroup id="events-nearby" title="Events nearby" items={grouped.events} thumbs={eventThumbs} />
      <NearGroup id="golf-nearby" title="Golf nearby" items={grouped.golf} thumbs={golfThumbs} />
    </>
  )
}
