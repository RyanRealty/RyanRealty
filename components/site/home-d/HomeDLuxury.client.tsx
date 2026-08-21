'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import type { HomeDLuxuryItem } from './types'

export function HomeDLuxury({ items }: { items: HomeDLuxuryItem[] }) {
  const shown = useMemo(() => items.filter((it) => it.img && it.price != null).slice(0, 8), [items])
  const [activeHref, setActiveHref] = useState<string | null>(shown[0]?.href ?? null)
  const featured = shown.find((it) => it.href === activeHref) ?? shown[0]
  const rail = shown.filter((it) => it.href !== featured?.href).slice(0, 3)

  if (!featured) return null

  const featuredAsk = formatPublishedAsk(featured.price)
  const place = [featured.address, featured.sub || featured.city].filter(Boolean).join(' · ')

  return (
    <section className="home-d-lux" id="listings">
      <Link
        href={featured.href}
        className="home-d-lux-media"
        aria-label={`${featured.address}${featuredAsk ? `, ${featuredAsk}` : ''}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={featured.img} alt={featured.address} />
        <span className="home-d-lux-scrim" aria-hidden="true" />
        <span className="home-d-lux-meta">
          <span>
            {featuredAsk ? <span className="home-d-lux-price home-d-display">{featuredAsk}</span> : null}
            {place ? <span className="home-d-lux-addr">{place}</span> : null}
          </span>
          {featured.video || featured.tour ? <span className="home-d-lux-play">Play</span> : null}
        </span>
      </Link>
      {rail.length > 0 ? (
        <div className="home-d-lux-rail">
          {rail.map((it) => {
            const ask = formatPublishedAsk(it.price)
            const line = [it.address, it.sub || it.city].filter(Boolean).join(' · ')
            return (
              <Link
                key={it.href}
                href={it.href}
                data-active={it.href === featured.href ? 'true' : 'false'}
                onMouseEnter={() => setActiveHref(it.href)}
                onFocus={() => setActiveHref(it.href)}
              >
                {ask ? <span className="home-d-lux-rail-price home-d-display">{ask}</span> : null}
                {line ? <span className="home-d-lux-rail-addr">{line}</span> : null}
              </Link>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
