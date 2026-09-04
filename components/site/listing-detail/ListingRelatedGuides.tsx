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
        <h2 className="sec-title">{city ? `${city} guides` : 'City guides'}</h2>
      </div>
      <ul className="listing-guides__grid">
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/blog/${post.slug}`} className="listing-guides__card">
              {post.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.heroImageUrl} alt="" className="listing-guides__thumb" />
              ) : (
                <span className="listing-guides__thumb listing-guides__thumb--empty" aria-hidden="true" />
              )}
              <span className="listing-guides__copy">
                {post.category ? <span className="listing-guides__kind">{post.category}</span> : null}
                <span className="listing-guides__name">{post.title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
