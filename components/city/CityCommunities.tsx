import Link from 'next/link'
import type { CommunityForIndex } from '@/lib/communities'
import CommunityCard from '@/components/community/CommunityCard'

type Props = {
  cityName: string
  communities: CommunityForIndex[]
}

export default function CityCommunities({ cityName, communities }: Props) {
  const resortFirst = [...communities].sort((a, b) => (b.isResort ? 1 : 0) - (a.isResort ? 1 : 0))

  return (
    <section className="bg-card px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="city-communities-heading">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="city-communities-heading" className="text-2xl font-bold tracking-tight text-primary">
            Communities in {cityName}
          </h2>
          <Link
            href="/communities"
            className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground"
          >
            View All Communities
          </Link>
        </div>
        <p className="mt-1 text-muted-foreground">{communities.length} communities</p>
        {communities.length === 0 ? (
          <p className="mt-4 text-muted-foreground">
            No community data for {cityName} yet. Check back soon.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {resortFirst.map((c) => (
              <CommunityCard
                key={c.slug}
                slug={c.slug}
                name={c.subdivision}
                city={c.city}
                activeCount={c.activeCount}
                medianPrice={c.medianPrice}
                heroImageUrl={c.heroImageUrl}
                isResort={c.isResort}
                size="default"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
