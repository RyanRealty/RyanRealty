/**
 * HomepageV6Guides — local market intelligence, Linear finish. Real published
 * posts from getRecentBlogPosts (fetched in the page). Hides if fewer than 3
 * with hero images resolve.
 */

import Image from 'next/image'
import Link from 'next/link'
import type { BlogPostCard } from '@/lib/data/blog/getRecentBlogPosts'

export default function HomepageV6Guides({ posts }: { posts: BlogPostCard[] }) {
  const cards = posts.filter((p) => p.heroImageUrl).slice(0, 3)
  if (cards.length < 3) return null

  return (
    <section className="v6-section" aria-label="Central Oregon market guides">
      <div className="v6-section-wrap">
        <div className="v6-section-head">
          {/* heading-display-ok */}
          <h2>Know the market before you move in it</h2>
          <Link href="/blog">Read every guide →</Link>
        </div>
        <div className="v6-cards">
          {cards.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="v6-guide">
              <div className="v6-guide-media">
                <Image
                  src={p.heroImageUrl as string}
                  alt={p.title}
                  fill
                  sizes="(max-width: 960px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="v6-guide-body">
                {p.category && <div className="v6-guide-cat">{p.category}</div>}
                <div className="v6-guide-title">{p.title}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
