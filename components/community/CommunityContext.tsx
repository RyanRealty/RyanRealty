import Link from 'next/link'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import CommunityCard from './CommunityCard'

type Props = {
  communityName: string
  city: string
  currentSlug: string
}

export default async function CommunityContext({
  communityName,
  city,
  currentSlug,
}: Props) {
  const all = await getCommunitiesForIndex()
  const sameCity = all.filter(
    (c) => c.city.toLowerCase() === city.toLowerCase() && c.slug !== currentSlug
  )
  const nearby = sameCity.slice(0, 4)

  return (
    <section className="bg-card px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="community-context-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="community-context-heading" className="text-2xl font-bold tracking-tight text-primary">
          About the Area
        </h2>
        <p className="mt-2 text-muted-foreground">
          Located in{' '}
          <Link href={`/homes-for-sale?city=${encodeURIComponent(city)}`} className="font-medium text-accent-foreground hover:underline">
            {city}
          </Link>
        </p>
        {nearby.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-primary">Nearby communities</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {nearby.map((c) => (
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
          </div>
        )}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-primary">
            Schools near {communityName}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            School district and zoning information will be available here. Check back for updates.
          </p>
        </div>
      </div>
    </section>
  )
}
