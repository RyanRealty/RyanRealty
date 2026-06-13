/**
 * HomepageCineHero — cinematic arrival over a LIVE photoreal 3D Bend
 * (Matt directive 2026-06-12: bring the 3D tiles back; one-shot the competition).
 *
 * Layering (back to front):
 *   1. Poster (bend-3d-poster.jpg) — the F1 frame of the 3D scene, server-
 *      rendered <Image priority>. This is the LCP and the no-JS fallback. The
 *      poster matches the 3D camera so the live fade is seamless (the Old Mill
 *      street-level master would jump-cut against an aerial tile scene).
 *   2. Live 3D city — HomepageCineCityTiles, Google Photorealistic 3D Tiles,
 *      slow cinematic drift, fades in once real imagery streams. Desktop only,
 *      idle-loaded, reduced-motion + save-data aware. The differentiator no
 *      Central Oregon competitor has.
 *   3. Navy scrim for legibility.
 *   4. Content — Amboqia H1, live market line (getRegionPulse, never hard-coded),
 *      ask bar into search, a LIVE badge announcing the 3D city.
 */

import Image from 'next/image'
import Link from 'next/link'
import { DisplayHeading } from '@/components/site/primitives'
import HomepageCineSearch from './HomepageCineSearch.client'
import HomepageCineCityTiles from './HomepageCineCityTiles.client'

type Props = {
  activeCount: number | null
  medianListPrice: number | null
  freshnessLabel: string | null
}

function fmtPrice(n: number): string {
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}

export default function HomepageCineHero({ activeCount, medianListPrice, freshnessLabel }: Props) {
  const liveParts: string[] = []
  if (activeCount != null) liveParts.push(`${activeCount.toLocaleString('en-US')} homes on the market`)
  if (medianListPrice != null) liveParts.push(`median ${fmtPrice(medianListPrice)}`)
  if (freshnessLabel) liveParts.push(`updated ${freshnessLabel}`)

  return (
    <section className="cine-hero">
      <div className="cine-hero-media" aria-hidden="true">
        <Image
          src="/images/hero/bend-3d-poster.jpg"
          alt="Aerial view of Bend, Oregon rendered from photoreal 3D map tiles"
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <HomepageCineCityTiles apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null} />
      <div className="cine-hero-scrim" aria-hidden="true" />

      <div className="cine-hero-content">
        <span className="cine-live-badge cine-rise">
          <span className="cine-livedot" aria-hidden="true" />
          Live 3D · Bend, Oregon
        </span>
        <DisplayHeading as="h1" className="cine-hero-h1 cine-rise cine-rise-2">
          This is Central Oregon.
        </DisplayHeading>
        {liveParts.length > 0 && (
          <p className="cine-hero-live cine-rise cine-rise-3">
            <span className="cine-dot" aria-hidden="true" />
            {liveParts.join(' · ')}
          </p>
        )}
        <HomepageCineSearch />
        <div className="cine-hero-links cine-rise cine-rise-5">
          <Link href="/homes-for-sale">Browse every listing</Link>
          <Link href="/lp/seller-home-value">What is your home worth?</Link>
        </div>
      </div>
    </section>
  )
}
