import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { getRecentBlogPosts } from '@/lib/data/blog/getRecentBlogPosts'
import { LifestyleNearSection } from './LifestyleNearSection'
import { ListingRelatedGuides } from './ListingRelatedGuides'

/** Parks, trails, golf, events, and guides near this listing. */
export async function ListingAroundHere({
  lat,
  lng,
  city,
}: {
  lat: number | null | undefined
  lng: number | null | undefined
  city: string | null | undefined
}) {
  const posts = await withTimeoutFallback(
    getRecentBlogPosts({ limit: 3, cityName: city ?? undefined }),
    [],
    3000,
    'listing:guides',
  )
  return (
    <>
      <LifestyleNearSection lat={lat} lng={lng} />
      <ListingRelatedGuides posts={posts} city={city} />
    </>
  )
}
