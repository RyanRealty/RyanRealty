import Image from 'next/image'
import { getNeighborhoodHeroUnsplash, resolveUnsplashHeroImage } from '@/lib/hero-media'

export type NeighborhoodHeroProps = {
  name: string
  cityName: string
  citySlug: string
  heroImageUrl: string | null
  activeCount: number
  medianPrice: number | null
  /** Average days on market for active listings (shown when available). */
  avgDom?: number | null
  /** Optional: Share (and future Save) actions rendered in hero top-right (overlay). */
  actions?: React.ReactNode
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function NeighborhoodHero({
  name,
  cityName,
  heroImageUrl,
  activeCount,
  medianPrice,
  avgDom,
  actions,
}: NeighborhoodHeroProps) {
  const src = resolveUnsplashHeroImage(heroImageUrl, getNeighborhoodHeroUnsplash(cityName, name))

  return (
    <section className="relative min-h-[40vh] sm:min-h-[50vh] overflow-hidden w-full" aria-label="Neighborhood hero">
      {actions && (
        <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6" aria-label="Page actions">
          {actions}
        </div>
      )}
      <div className="absolute inset-0">
        <Image
          src={src}
          alt={`${name} neighborhood in ${cityName}`}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/55 to-primary/25" aria-hidden />
      <div className="relative z-10 flex min-h-[320px] sm:min-h-[400px] flex-col justify-end px-4 pt-14 pb-8 md:pt-16 sm:px-6 sm:pb-12">
        <div className="mx-auto w-full max-w-7xl">
          <h1 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl drop-shadow-md">
            {name}
          </h1>
          <p className="mt-1 text-lg text-muted font-sans">{cityName}, Oregon</p>
          <div className="mt-4 flex flex-wrap gap-4 rounded-lg bg-foreground/30 px-4 py-3 text-sm text-primary-foreground font-sans">
            <span>{activeCount} Homes for Sale</span>
            {medianPrice != null && <span>Median {formatPrice(medianPrice)}</span>}
            {avgDom != null && avgDom > 0 && (
              <span>Avg {Math.round(avgDom)} Days on Market</span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
