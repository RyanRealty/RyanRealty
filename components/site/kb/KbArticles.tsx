import type { ReactNode } from 'react'

export interface KbArticlePost {
  title: string
  href: string
  excerpt?: string | null
  imageUrl?: string | null
  dateLabel?: string | null
}

export interface KbArticlesProps {
  posts: KbArticlePost[]
  eyebrow: string
  heading: string
  subtitle?: string
}

/**
 * KB Articles — a brutalist editorial set of guide / blog cards. Each card is a
 * hard navy-bordered tile: photo with a hard navy overlay strip carrying the
 * mono dateLabel, the title set in Amboqia display at card scale, and a muted
 * body excerpt. 2-3 across on desktop, stacked on mobile. Each card links to its
 * href. Server component — receives posts as props, renders only what it is
 * given (no fabricated content), and renders null when there are no posts.
 * Motion is CSS-only (image scale + arrow nudge on hover), so it is safe under
 * prefers-reduced-motion via the global kb.css reduce rule.
 */
export function KbArticles({ posts, eyebrow, heading, subtitle }: KbArticlesProps): ReactNode {
  if (!posts || posts.length === 0) return null

  return (
    <section className="section articles" id="articles">
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sec-title display">{heading}</h2>
        </div>
        {subtitle ? <p className="art-sub">{subtitle}</p> : null}
        <div className="art-grid">
          {posts.map((p) => (
            <a key={p.href} className="art-card" href={p.href}>
              <div className="art-media">
                {p.imageUrl ? (
                  <img className="art-img" src={p.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span className="art-noimg" aria-hidden="true" />
                )}
                {p.dateLabel ? (
                  <span className="art-date mono-num">{p.dateLabel}</span>
                ) : null}
              </div>
              <div className="art-body">
                <h3 className="art-title display">{p.title}</h3>
                {p.excerpt ? <p className="art-excerpt">{p.excerpt}</p> : null}
                <span className="art-read">
                  Read the guide <span className="arr">&rarr;</span>
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
