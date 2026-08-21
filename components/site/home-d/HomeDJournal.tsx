import Link from 'next/link'
import type { HomeDPost } from './types'

export function HomeDJournal({ posts }: { posts: HomeDPost[] }) {
  const [featured, ...rest] = posts
  if (!featured) return null

  return (
    <section className="home-d-section" id="journal">
      <div className="home-d-wrap">
        <div className="home-d-journal-split">
          <div className="home-d-journal-feature">
            <h2 className="home-d-display">{featured.title}</h2>
            {featured.excerpt ? <p className="home-d-journal-excerpt">{featured.excerpt}</p> : null}
            <Link href={featured.href} className="home-d-journal-read">
              Read
            </Link>
            <Link href="/blog" className="home-d-journal-all">
              All writing
            </Link>
          </div>
          {rest.length > 0 ? (
            <ul className="home-d-journal-index">
              {rest.map((post) => (
                <li key={post.href}>
                  <Link href={post.href}>
                    {post.dateLabel ? <span className="home-d-journal-date">{post.dateLabel}</span> : null}
                    <span className="home-d-journal-title">{post.title}</span>
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
