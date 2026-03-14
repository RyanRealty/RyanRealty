'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { CityForIndex } from '@/lib/cities'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'

type Props = {
  cities: CityForIndex[]
  currentCitySlug: string
  /** Optional CTA card at the end of the slider (e.g. "Homes for sale" → /listings). */
  ctaCard?: { name: string; href: string }
}

const PLACEHOLDER_GRADIENT = 'linear-gradient(135deg, var(--primary) 0%, var(--primary / 0.1) 100%)'

/** Ken Burns: slow pan/zoom on the image so the card feels more engaging. */
const CARD_IMAGE_CLASS = 'object-cover transition-transform duration-500 hover:scale-105 animate-hero-ken-burns'

/**
 * City slider for the home page: same TilesSlider as other sections (nav, tile size).
 * Card size matches other tiles via TilesSliderItem. Selecting a city updates map and featured.
 */
export default function CitySlider({ cities, currentCitySlug, ctaCard }: Props) {
  const normalizedCurrent = currentCitySlug.trim().toLowerCase().replace(/\s+/g, '-')
  const hasItems = cities.length > 0 || ctaCard

  if (!hasItems) return null

  return (
    <section
      className="relative bg-muted px-4 py-8 sm:px-6 sm:py-10"
      aria-label="Browse homes by city"
    >
      <div className="mx-auto max-w-7xl">
        <TilesSlider
          title="Explore by city"
          subtitle="Select a city to see listings, featured homes, and popular communities."
          titleId="explore-by-city-heading"
          headerRight={
            ctaCard ? (
              <Link
                href={ctaCard.href}
                className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground"
              >
                {ctaCard.name}
              </Link>
            ) : undefined
          }
        >
          {cities.map((city) => {
            const isActive =
              (city.slug || city.name.toLowerCase().replace(/\s+/g, '-')) === normalizedCurrent
            const href = `/?city=${encodeURIComponent(city.slug || city.name.toLowerCase().replace(/\s+/g, '-'))}`

            return (
              <TilesSliderItem key={city.slug + city.name} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
                <Link
                  href={href}
                  className={`relative flex flex-col justify-end overflow-hidden rounded-lg transition-[box-shadow,transform] duration-300 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                    isActive ? 'ring-2 ring-accent' : 'border border-border'
                  }`}
                  style={{
                    minHeight: TILE_MIN_HEIGHT_PX,
                    boxShadow: isActive ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                  }}
                >
                  {city.heroImageUrl ? (
                    <Image
                      src={city.heroImageUrl}
                      alt={`${city.name}, Oregon`}
                      fill
                      sizes="(max-width: 640px) 85vw, 280px"
                      className={CARD_IMAGE_CLASS}
                    />
                  ) : (
                    <div
                      className="absolute inset-0 bg-gradient-to-br from-primary to-primary/30 opacity-90"
                    />
                  )}
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent"
                    aria-hidden
                  />
                  <div className="relative z-10 px-4 pb-4 pt-8">
                    <span
                      className="block text-xl font-bold tracking-tight text-white drop-shadow-md sm:text-2xl"
                      style={{ fontFamily: 'inherit' }}
                    >
                      {city.name}
                    </span>
                    <span className="mt-0.5 block text-sm font-medium text-white/95">
                      {city.activeCount === 0
                        ? 'No homes for sale'
                        : city.activeCount === 1
                          ? '1 home for sale'
                          : `${city.activeCount.toLocaleString()} homes for sale`}
                    </span>
                  </div>
                </Link>
              </TilesSliderItem>
            )
          })}
          {ctaCard && (
            <TilesSliderItem style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
              <Link
                href={ctaCard.href}
                className="relative flex flex-col justify-end overflow-hidden rounded-lg border border-border bg-primary transition hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                style={{ minHeight: TILE_MIN_HEIGHT_PX, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" aria-hidden />
                <div className="relative z-10 px-4 pb-4 pt-8">
                  <span
                    className="block text-xl font-bold tracking-tight text-white drop-shadow-md sm:text-2xl"
                    style={{ fontFamily: 'inherit' }}
                  >
                    {ctaCard.name}
                  </span>
                  <span className="mt-0.5 block text-sm font-medium text-white/90">
                    Browse all listings
                  </span>
                </div>
              </Link>
            </TilesSliderItem>
          )}
        </TilesSlider>
      </div>
    </section>
  )
}
