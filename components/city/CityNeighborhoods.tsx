import Link from 'next/link'
import { Card } from '@/components/ui/card'

type Neighborhood = {
  slug: string
  name: string
  listingCount: number
  medianPrice: number | null
}

type Props = {
  cityName: string
  citySlug: string
  neighborhoods: Neighborhood[]
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function CityNeighborhoods({ cityName, citySlug, neighborhoods }: Props) {
  if (neighborhoods.length === 0) return null

  return (
    <section className="bg-muted px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="city-neighborhoods-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="city-neighborhoods-heading" className="text-2xl font-bold tracking-tight text-primary">
          Neighborhoods in {cityName}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {neighborhoods.map((n) => (
            <Link key={n.slug} href={`/cities/${citySlug}/${n.slug}`}>
              <Card className="p-4 transition hover:shadow-md">
                <h3 className="font-bold text-primary">{n.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {n.listingCount} for sale
                  {n.medianPrice != null && ` · ${formatPrice(n.medianPrice)}`}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
