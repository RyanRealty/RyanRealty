/**
 * HomepageCineGuides — local market intelligence, for SEO authority and to
 * show the brokerage actually knows this market. Real published posts from
 * getRecentBlogPosts (fetched in the page). Hides if fewer than 3 resolve.
 */

import Image from 'next/image'
import Link from 'next/link'
import { H2 } from '@/components/site/primitives'
import type { BlogPostCard } from '@/lib/data/blog/getRecentBlogPosts'

export default function HomepageCineGuides({ posts }: { posts: BlogPostCard[] }) {
  const cards = posts.filter((p) => p.heroImageUrl).slice(0, 3)
  if (cards.length < 3) return null

  return (
    <section className="cine-guides" aria-label="Central Oregon market guides">
      <div className="cine-guides-wrap">
        <div className="cine-collection-head">
          <H2 className="cine-h2">Know the market before you move in it.</H2>
          <Link href="/blog">Read every guide →</Link>
        </div>
        <div className="cine-guides-grid">
          {cards.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="cine-guide">
              <div className="cine-guide-media">
                <Image
                  src={p.heroImageUrl as string}
                  alt={p.title}
                  fill
                  sizes="(max-width: 960px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              {p.category && <div className="cine-guide-cat">{p.category}</div>}
              <div className="cine-guide-title">{p.title}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
