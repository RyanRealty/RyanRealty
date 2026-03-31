import Image from 'next/image'

export type CommunityHeroProps = {
  name: string
  city: string
  state?: string
  heroImageUrl: string | null
  activeCount: number
  medianPrice: number | null
  avgDom: number | null
  isResort?: boolean
  /** Optional: Save/Like/Share actions rendered in hero top-right (overlay). */
  actions?: React.ReactNode
}

const PLACEHOLDER_HERO =
  'https://images.unsplash.com/photo-1552678038-1fb7bb8d29be?w=1920&q=80'

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function CommunityHero({
  name,
  city,
  state = 'Oregon',
  heroImageUrl,
  activeCount,
  medianPrice,
  avgDom,
  isResort,
  actions,
}: CommunityHeroProps) {
  const src = heroImageUrl ?? PLACEHOLDER_HERO

  return (
    <section className="relative min-h-[40vh] sm:min-h-[50vh] overflow-hidden w-full" aria-label="Community hero">
      {actions && (
        <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6" aria-label="Page actions">
          {actions}
        </div>
      )}
      <div className="absolute inset-0">
        <Image
          src={src}
          alt={`${name} community in ${city}, ${state}`}
          fill
          className="object-cover animate-hero-ken-burns"
          sizes="100vw"
          priority
        />
      </div>
      {/* Splash overlay: gradient for readability + one-time light sweep */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/55 to-primary/25" aria-hidden />
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]" aria-hidden>
        <div className="absolute top-0 left-0 h-full w-[60%] bg-gradient-to-r from-transparent via-primary-foreground/20 to-transparent animate-hero-shine" />
      </div>
      <div className="relative z-10 flex min-h-[320px] sm:min-h-[400px] flex-col justify-end px-4 pt-14 pb-8 md:pt-16 sm:px-6 sm:pb-12">
        <div className="mx-auto w-full max-w-7xl">
          {isResort && (
            <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary font-sans">
              Resort & master plan community
            </span>
          )}
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl drop-shadow-md">
            {name}
          </h1>
          <p className="mt-1 text-lg text-muted font-sans">
            {city}, {state}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 rounded-lg bg-foreground/30 px-4 py-3 text-sm text-primary-foreground font-sans">
            <span>{activeCount} Homes for Sale</span>
            {medianPrice != null && (
              <span>Median {formatPrice(medianPrice)}</span>
            )}
            {avgDom != null && avgDom > 0 && (
              <span>Avg {Math.round(avgDom)} Days on Market</span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
