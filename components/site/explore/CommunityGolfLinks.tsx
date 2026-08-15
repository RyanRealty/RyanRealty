import Link from 'next/link'
import { GOLF_COURSES } from '@/data/golf/courses'

type Props = {
  communitySlug: string
  communityName: string
}

/**
 * Reverse edge: community → golf courses that list this communitySlug.
 */
export function CommunityGolfLinks({ communitySlug, communityName }: Props) {
  const courses = GOLF_COURSES.filter((c) => c.communitySlug === communitySlug)
  if (courses.length === 0) return null

  return (
    <section className="section" aria-label={`Golf near ${communityName}`}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{communityName} · Golf</span>
          <h2 className="sec-title display">Play nearby</h2>
        </div>
        <ul
          style={{
            listStyle: 'none',
            margin: '1.5rem 0 0',
            padding: 0,
            borderTop: '1px solid rgba(16,39,66,0.12)',
          }}
        >
          {courses.map((c) => (
            <li
              key={c.slug}
              style={{ borderBottom: '1px solid rgba(16,39,66,0.12)' }}
            >
              <Link
                href={`/central-oregon/golf/${c.slug}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.9rem 0',
                  color: 'var(--navy)',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
                className="hover:opacity-80"
              >
                <span>{c.name}</span>
                <span style={{ fontWeight: 500, fontSize: '0.85rem', color: 'var(--navy-70)' }}>
                  {c.holes} holes · {c.access}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
