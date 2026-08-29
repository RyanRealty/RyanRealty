import { V3Breadcrumb, type V3Crumb } from '@/components/site/v3'
import { PlaceFaceStrip } from '@/components/place/PlaceFaceStrip'
import type { PlaceFaceStat } from '@/lib/market/publish-place-face'
import '@/components/search/search-ledger.css'

/** Compact place photo with H1 + leftover face on the media. */
export function PlaceAreaHero({
  eyebrow,
  headline,
  posterSrc,
  trail,
  stats,
}: {
  eyebrow: string
  headline: string
  posterSrc: string | null | undefined
  trail: readonly V3Crumb[]
  stats: readonly PlaceFaceStat[]
}) {
  if (!posterSrc) return null
  return (
    <section className="place-hero" aria-labelledby="place-hero-title">
      <div className="place-hero__media" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={posterSrc} alt="" decoding="async" fetchPriority="high" />
      </div>
      <div className="place-hero__scrim" aria-hidden="true" />
      <div className="place-hero__bar">
        <V3Breadcrumb tone="on-media" trail={trail} />
      </div>
      <div className="place-hero__copy">
        <p className="place-hero__eyebrow">{eyebrow}</p>
        <h1 id="place-hero-title" className="place-hero__title">
          {headline}
        </h1>
        <PlaceFaceStrip stats={stats} tone="on-media" />
      </div>
    </section>
  )
}
