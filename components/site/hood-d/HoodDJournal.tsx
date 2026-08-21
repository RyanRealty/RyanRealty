import Link from 'next/link'
import type { HoodDPost } from './types'

export function HoodDJournal({ posts }: { posts: HoodDPost[] }) {
  const [featured, ...rest] = posts
  if (!featured) return null

  return (
    <section className="hood-d-section" id="journal">
      <div className="hood-d-wrap">
        <span className="hood-d-eyebrow">From the journal</span>
        <div className="hood-d-journal-split">
          <div className="hood-d-journal-feature">
            <h2 className="hood-d-display">{featured.title}</h2>
            {featured.excerpt ? <p className="hood-d-journal-excerpt">{featured.excerpt}</p> : null}
            <Link href={featured.href} className="hood-d-journal-read">
              Read the guide
            </Link>
            <Link href="/blog" className="hood-d-journal-all">
              All writing
            </Link>
          </div>
          {rest.length > 0 ? (
            <ul className="hood-d-journal-index">
              {rest.map((post) => (
                <li key={post.href}>
                  <Link href={post.href}>
                    {post.dateLabel ? <span className="hood-d-journal-date">{post.dateLabel}</span> : null}
                    <span className="hood-d-journal-title">{post.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  )
}
