import Link from 'next/link'
import Image from 'next/image'
import type { CityForIndex } from '@/lib/cities'
import { getFallbackImage } from '@/lib/fallback-images'

type Props = {
  cities: CityForIndex[]
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function CityTilesGridStatic({ cities }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cities.map((city) => {
        const href = `/cities/${city.slug}`
        const heroSrc = city.heroImageUrl?.trim() || getFallbackImage('city', city.name)
        const countLabel =
          city.activeCount === 0
            ? 'No homes for sale'
            : city.activeCount === 1
              ? '1 home for sale'
              : `${city.activeCount} homes for sale`
        return (
          <Link
            key={city.slug}
            href={href}
            className="group relative flex min-h-[320px] w-full overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition hover:shadow-lg"
          >
            <Image
              src={heroSrc}
              alt={`${city.name}, Oregon — city overview`}
              fill
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, 400px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-primary-foreground">
              <h3 className="text-xl font-bold drop-shadow-md">{city.name}</h3>
              <p className="mt-0.5 text-sm text-primary-foreground/90">{countLabel}</p>
              <p className="mt-0.5 text-xs text-primary-foreground/80">
                Median {formatPrice(city.medianPrice)} · {city.communityCount} communities
              </p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
