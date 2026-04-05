import Image from 'next/image'
import { getCityHeroUnsplash, resolveUnsplashHeroImage } from '@/lib/hero-media'

export type CityHeroProps = {
  name: string
  heroImageUrl: string | null
  activeCount: number
  medianPrice: number | null
  communityCount: number
  /** Optional: Save/Share actions rendered in hero top-right (overlay). */
  actions?: React.ReactNode
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function CityHero({
  name,
  heroImageUrl,
  activeCount,
  medianPrice,
  communityCount,
  actions,
}: CityHeroProps) {
  const src = resolveUnsplashHeroImage(heroImageUrl, getCityHeroUnsplash(name))

  return (
    <section className="relative min-h-[40vh] sm:min-h-[50vh] overflow-hidden w-full" aria-label="City hero">
      {actions && (
        <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6" aria-label="Page actions">
          {actions}
        </div>
      )}
      <div className="absolute inset-0">
        <Image
          src={src}
          alt={`${name}, Oregon — city hero`}
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/55 to-primary/25" aria-hidden />
      <div className="relative z-10 flex min-h-[320px] sm:min-h-[400px] flex-col justify-end px-4 pt-14 pb-8 md:pt-16 sm:px-6 sm:pb-12">
        <div className="mx-auto w-full max-w-7xl">
          <h1 className="text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl drop-shadow-md">
            {name}
          </h1>
          <p className="mt-1 text-lg text-muted font-sans">Oregon</p>
          <div className="mt-4 flex flex-wrap gap-4 rounded-lg bg-foreground/40 px-4 py-3 text-sm text-primary-foreground font-sans">
            <span>{activeCount} Homes for Sale</span>
            <span>Median {formatPrice(medianPrice)}</span>
            <span>{communityCount} Communities</span>
          </div>
        </div>
      </div>
    </section>
  )
}
