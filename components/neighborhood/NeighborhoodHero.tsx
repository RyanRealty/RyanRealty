import Image from 'next/image'
import Link from 'next/link'

export type NeighborhoodHeroProps = {
  name: string
  cityName: string
  citySlug: string
  heroImageUrl: string | null
  activeCount: number
  medianPrice: number | null
}

const PLACEHOLDER_HERO =
  'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1920&q=80'

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function NeighborhoodHero({
  name,
  cityName,
  citySlug,
  heroImageUrl,
  activeCount,
  medianPrice,
}: NeighborhoodHeroProps) {
  const src = heroImageUrl ?? PLACEHOLDER_HERO

  return (
    <section className="relative min-h-[280px] sm:min-h-[360px]" aria-label="Neighborhood hero">
      <div className="absolute inset-0">
        <Image
          src={src}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--brand-navy)]/85 via-[var(--brand-navy)]/50 to-[var(--brand-navy)]/30" aria-hidden />
      <div className="relative z-10 flex min-h-[280px] sm:min-h-[360px] flex-col justify-end px-4 pb-8 pt-20 sm:px-6 sm:pb-12">
        <nav className="absolute left-4 top-4 sm:left-6 sm:top-6 text-sm text-white/90" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/cities" className="hover:text-white">Cities</Link>
          <span className="mx-2">/</span>
          <Link href={`/cities/${citySlug}`} className="hover:text-white">{cityName}</Link>
          <span className="mx-2">/</span>
          <span className="text-white">{name}</span>
        </nav>
        <div className="mx-auto w-full max-w-7xl">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {name}
          </h1>
          <p className="mt-1 text-lg text-[var(--brand-cream)]">{cityName}, Oregon</p>
          <div className="mt-4 flex flex-wrap gap-4 rounded-lg bg-black/30 px-4 py-3 text-sm text-white">
            <span>{activeCount} Homes for Sale</span>
            <span>Median {formatPrice(medianPrice)}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
