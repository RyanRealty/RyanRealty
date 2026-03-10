'use client'

import Link from 'next/link'
import Image from 'next/image'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'

export type CommunityCardProps = {
  slug: string
  name: string
  city: string
  activeCount: number
  medianPrice: number | null
  heroImageUrl: string | null
  isResort?: boolean
  /** Optional brief description (e.g. first 100 chars); used on index resort section. */
  description?: string
  /** Size: 'default' (compact) or 'large' (resort section). */
  size?: 'default' | 'large'
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function CommunityCard({
  slug,
  name,
  city,
  activeCount,
  medianPrice,
  heroImageUrl,
  isResort = false,
  description,
  size = 'default',
}: CommunityCardProps) {
  const href = `/communities/${slug}`
  const aspectClass = size === 'large' ? 'aspect-[21/9]' : 'aspect-[16/10]'

  return (
    <Link href={href} className="group block">
      <Card className="overflow-hidden border-[var(--gray-border)] shadow-sm transition hover:shadow-md">
        <div className={`relative w-full overflow-hidden ${aspectClass}`}>
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              alt=""
              fill
              className="object-cover transition group-hover:scale-[1.02]"
              sizes={size === 'large' ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 50vw, 33vw'}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[var(--brand-navy)] to-zinc-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          {isResort && (
            <div className="absolute right-2 top-2">
              <Badge variant="trending">Resort</Badge>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-bold text-white drop-shadow-md">{name}</h3>
            <p className="mt-0.5 text-sm text-white/90">{city}</p>
            {size === 'large' && (
              <>
                {activeCount > 0 && (
                  <p className="mt-1 text-sm text-white/90">{activeCount} homes for sale</p>
                )}
                {medianPrice != null && (
                  <p className="mt-0.5 text-sm font-medium text-white">
                    Median {formatPrice(medianPrice)}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        {size === 'large' && description && (
          <div className="p-4">
            <p className="line-clamp-2 text-sm text-[var(--text-secondary)]">{description}</p>
          </div>
        )}
        {size === 'default' && (
          <div className="p-3">
            <p className="text-sm text-[var(--text-secondary)]">
              {activeCount} homes for sale
              {medianPrice != null && ` · ${formatPrice(medianPrice)}`}
            </p>
          </div>
        )}
      </Card>
    </Link>
  )
}
