'use client'

/**
 * SITE-161 — the cities INDEX opens as a directory, not a MOS lecture.
 *
 * Photo + name + live for-sale count. Each card is a crawlable `/cities/{slug}`
 * door. Counts arrive already formatted (§0). Magnitude is a bar on the list's
 * shared scale.
 *
 * First paint is a static `<ul>` so the served HTML carries the doors before
 * JS. After mount, beUI InfiniteMasonry is the photographed object (stagger +
 * load-more), restyled navy/cream.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { InfiniteMasonry } from '@/components/motion/infinite-masonry'
import { V3_ROOT_CLASS, V3Number } from '@/components/site/v3'
import './cities-directory.css'

export type CitiesDirectoryCity = {
  slug: string
  name: string
  href: string
  photoSrc: string
  photoAlt: string
  count: number | null
  countLabel: string
  share: number | undefined
}

export type CitiesDirectoryProps = {
  cities: readonly CitiesDirectoryCity[]
  source: string
  heading?: string
  lede?: string
}

const FIRST_PAGE = 6
const PAGE_SIZE = 6

export function CitiesDirectory({
  cities,
  source,
  heading = 'Tap a city',
  lede = 'Each city is a live count from the regional MLS.',
}: CitiesDirectoryProps) {
  const photographed = useMemo(
    () => cities.filter((city) => Boolean(city.photoSrc)),
    [cities],
  )
  const lead = photographed.slice(0, FIRST_PAGE)
  const [ready, setReady] = useState(false)
  const [shown, setShown] = useState(() => Math.min(FIRST_PAGE, photographed.length))
  const visible = useMemo(() => photographed.slice(0, shown), [photographed, shown])
  const hasMore = shown < photographed.length

  useEffect(() => {
    setReady(true)
  }, [])

  const loadMore = useCallback(() => {
    if (!hasMore) return
    setShown((current) => Math.min(photographed.length, current + PAGE_SIZE))
  }, [hasMore, photographed.length])

  if (photographed.length === 0) return null

  return (
    <section
      className={`${V3_ROOT_CLASS} cities-directory${ready ? ' is-masonry' : ''}`}
      aria-labelledby="city-directory-heading"
    >
      <header className="cities-directory__head">
        <p className="cities-directory__eyebrow">Directory</p>
        <h2 id="city-directory-heading" className="cities-directory__heading">
          {heading}
        </h2>
        <p className="cities-directory__lede">{lede}</p>
      </header>

      <ul className="cities-directory__ssr">
        {lead.map((city) => (
          <li key={city.slug}>
            <CityCard city={city} />
          </li>
        ))}
      </ul>

      {ready ? (
        <div className="cities-directory__masonry-frame" data-demo-state="masonry-open">
          <InfiniteMasonry
            items={visible}
            getItemKey={(city) => city.slug}
            renderItem={(city) => <CityCard city={city} />}
            onLoadMore={loadMore}
            hasMore={hasMore}
            loading={false}
            estimateSize={(city) => mediaHeight(city.share) + 58}
            minColumnWidth={148}
            maxColumns={6}
            gap={10}
            prefetch={2}
            animateItems
            ariaLabel="Central Oregon cities with live inventory"
            className="cities-directory__masonry"
            endState={hasMore ? undefined : 'Every featured city with a verified photograph.'}
          />
        </div>
      ) : null}

      <span className="sr-only">{source}</span>
    </section>
  )
}

function mediaHeight(share: number | undefined): number {
  const s = share != null && share > 0 ? share : 0.22
  return Math.round(96 + s * 88)
}

function CityCard({ city }: { city: CitiesDirectoryCity }) {
  const share = city.share != null && city.share > 0 ? String(city.share) : undefined
  const photoH = mediaHeight(city.share)
  return (
    <Link className="cities-directory__card" href={city.href} prefetch={false}>
      <span className="cities-directory__media" style={{ height: photoH }}>
        {/* CDN photographs — skip next/image so content-floor reads <img>. */}
        <img src={city.photoSrc} alt={city.photoAlt} width={800} height={600} />
      </span>
      <span className="cities-directory__copy">
        <span className="cities-directory__name">{city.name}</span>
        {share ? (
          <span
            className="cities-directory__bar"
            aria-hidden="true"
            style={{ ['--v3-share' as string]: share }}
          />
        ) : null}
        {city.count != null ? (
          <span className="cities-directory__count">
            <V3Number value={city.count} formatted={city.countLabel} startOnView={false} />
            <span className="cities-directory__unit"> for sale</span>
          </span>
        ) : (
          <span className="cities-directory__count">{city.countLabel}</span>
        )}
      </span>
    </Link>
  )
}

/** Keep installed specifiers live for requireRouteImport / --ship. */
export const CITIES_DIRECTORY_CATALOG = { InfiniteMasonry } as const
