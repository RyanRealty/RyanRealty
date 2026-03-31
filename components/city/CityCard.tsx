import Link from 'next/link'
import Image from 'next/image'
import { Card } from '@/components/ui/card'

export type CityCardProps = {
  slug: string
  name: string
  activeCount: number
  medianPrice: number | null
  communityCount: number
  heroImageUrl: string | null
  description?: string | null
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function CityCard({
  slug,
  name,
  activeCount,
  medianPrice,
  communityCount,
  heroImageUrl,
  description,
}: CityCardProps) {
  const href = `/cities/${slug}`

  return (
    <Link href={href} className="group block">
      <Card className="overflow-hidden border-border shadow-sm transition hover:shadow-md">
        <div className="relative aspect-[21/9] w-full overflow-hidden">
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              alt={`${name}, Oregon — real estate overview`}
              fill
              className="object-cover transition group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary to-[var(--primary / 0.8)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h2 className="text-2xl font-bold text-primary-foreground drop-shadow-md">{name}</h2>
            <p className="mt-1 text-sm text-primary-foreground/90">
              {activeCount} homes for sale · Median {formatPrice(medianPrice)} · {communityCount} communities
            </p>
          </div>
        </div>
        {description && (
          <div className="p-4">
            <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
          </div>
        )}
      </Card>
    </Link>
  )
}
