import { getCitiesForIndex } from '@/app/actions/cities'
import { getSavedCitySlugs } from '@/app/actions/saved-cities'
import { getHomePopularCitiesOrdered } from '@/lib/cities'
import PopularCitiesSection from '@/components/home/PopularCitiesSection'
import type { AuthUser } from '@/app/actions/auth'

type Props = { session: { user: AuthUser } | null }

async function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 1500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ])
}

/** Async block: fetches cities + saved slugs so the home page can stream this section. */
export default async function HomeCitiesBlock({ session }: Props) {
  const [allCities, savedCitySlugs] = await Promise.all([
    withTimeout(getCitiesForIndex(), []),
    session?.user ? withTimeout(getSavedCitySlugs().catch(() => []), []) : Promise.resolve([]),
  ])
  const popularCitiesBase = getHomePopularCitiesOrdered(allCities ?? [])
  const popularCities = popularCitiesBase.length > 0 ? popularCitiesBase : (allCities ?? []).slice(0, 8)
  return (
    <PopularCitiesSection
      cities={popularCities}
      savedSlugs={savedCitySlugs}
      signedIn={!!session?.user}
    />
  )
}
