import Link from 'next/link'
import type { BlogPostCard } from '@/lib/data/blog/getRecentBlogPosts'

/**
 * Guides rail on listing detail. Same `getRecentBlogPosts` source the city
 * pages use. Layout only — no invented titles or excerpts.
 */
export function ListingRelatedGuides({
  posts,
  city,
}: {
  posts: ReadonlyArray<BlogPostCard>
  city?: string | null
}) {
  if (posts.length === 0) return null
  return (
    <section id="guides" className="listing-guides">
      <div className="sec-head">
        <h2 className="sec-title">{city ? `${city} guides` : 'Guides'}</h2>
      </div>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/blog/${post.slug}`}>{post.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
