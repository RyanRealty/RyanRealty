'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { HotCommunity } from '@/app/actions/listings'
import { cityEntityKey } from '@/lib/slug'
import Card from '@/components/ui/Card'
import { trackEvent } from '@/lib/tracking'

type Props = {
  city: string
  communities: HotCommunity[]
  bannerUrls: (string | null)[]
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function CommunitySpotlights({ city, communities, bannerUrls }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current || !sectionRef.current) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          sentRef.current = true
          trackEvent('community_impression', {})
        }
      },
      { threshold: 0.2 }
    )
    io.observe(sectionRef.current)
    return () => io.disconnect()
  }, [])

  if (communities.length === 0) return null

  const hrefFor = (c: HotCommunity) =>
    `/search/${cityEntityKey(city)}/${encodeURIComponent(c.subdivisionName)}`

  return (
    <section
      ref={sectionRef}
      className="bg-white px-4 py-12 sm:px-6 sm:py-16"
      aria-labelledby="community-spotlights-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="community-spotlights-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
            Explore Communities
          </h2>
          <Link
            href="/search"
            onClick={() => trackEvent('click_cta', { cta_location: 'community_view_all' })}
            className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            View All
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
          {communities.map((c, i) => (
            <Link
              key={c.subdivisionName}
              href={hrefFor(c)}
              onClick={() => trackEvent('click_cta', { cta_location: 'community_card', community: c.subdivisionName })}
              className="group"
            >
              <Card className="overflow-hidden border-[var(--gray-border)] shadow-sm transition hover:shadow-md">
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  {bannerUrls[i] ? (
                    <Image
                      src={bannerUrls[i]!}
                      alt=""
                      fill
                      className="object-cover transition group-hover:scale-[1.02]"
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[var(--brand-navy)] to-zinc-800" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-[var(--brand-navy)]">{c.subdivisionName}</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {(c.forSale ?? 0) + (c.pending ?? 0)} homes for sale
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">
                    Median {formatPrice(c.medianListPrice)}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
