import Link from 'next/link'
import type { LifestyleNearItem } from '@/lib/explore/lifestyle-near'
import { lifestyleNearLatLng } from '@/lib/explore/lifestyle-near'
import { getParkBySlug } from '@/data/co-parks'
import { getTrailBySlug } from '@/data/co-trails'
import { getParkBoundaryGeoJSON, getTrailLineGeoJSON } from '@/lib/data'
import { PlaceListThumb } from '@/components/site/PlaceListThumb'

type Props = {
  lat: number | null | undefined
  lng: number | null | undefined
  /** Override precomputed items (e.g. place centroid). */
  items?: LifestyleNearItem[]
  eyebrow?: string
  title?: string
}

function slugFromHref(href: string, prefix: string): string | null {
  if (!href.startsWith(prefix)) return null
  const slug = href.slice(prefix.length).split('/')[0]?.trim()
  return slug || null
}

/**
 * Parks · trails · golf near a point. Park and trail rows always carry a map
 * thumb from existing geo. Detail pages keep the live map.
 */
export async function LifestyleNearSection({
  lat,
  lng,
  items: itemsProp,
  eyebrow = 'Around here',
  title = 'Parks, trails, and golf nearby',
}: Props) {
  const items = itemsProp ?? lifestyleNearLatLng(lat, lng)
  if (items.length === 0) return null

  const thumbs = await Promise.all(
    items.map(async (item) => {
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
      return null
    }),
  )

  return (
    <section className="section" aria-label={title}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sec-title">{title}</h2>
        </div>
        <ul className="place-list place-list--rows">
          {items.map((item, i) => {
            const thumb = thumbs[i]
            const isParkOrTrail = item.kind === 'park' || item.kind === 'trail'
            return (
              <li key={`${item.kind}-${item.href}`}>
                <Link href={item.href} className="place-list__row">
                  {isParkOrTrail ? (
                    <PlaceListThumb lat={thumb?.lat} lng={thumb?.lng} geometry={thumb?.geometry} />
                  ) : null}
                  <span className="place-list__copy">
                    <span className="place-list__kind">{item.kind}</span>
                    <span className="place-list__name">{item.name}</span>
                    {item.meta ? <span className="place-list__meta">{item.meta}</span> : null}
                  </span>
                  <span className="place-list__dist tabular-nums">
                    {item.distanceMiles < 10
                      ? `${item.distanceMiles.toFixed(1)} mi`
                      : `${Math.round(item.distanceMiles)} mi`}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
