/**
 * Broker cutouts on cream. No card, no wash, no border — the transparent
 * edge is the composition (CLAUDE.md §3). Name is the door. Title, Call,
 * and Text sit under the portrait.
 *
 * roster: /team (H1) and /about (H2, below Call/Text + firm proof).
 * portrait: /team/[slug] at card-photo scale, not AboutFaces poster size.
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Heading } from '@/components/site/v3'
import type { AboutFace } from './about-faces'
import './about-faces.css'

export function AboutFaces({
  people,
  heading,
  headingLevel = 1,
  size = 'roster',
  reach = true,
}: {
  people: readonly AboutFace[]
  heading: string
  /**
   * 1 on /team, where the faces ARE the page. 2 on /about and the homepage,
   * whose H1 already exists. Default keeps existing callers byte-identical
   * except /about, which now passes 2 so the faces are doors, not the fold.
   *
   * --lead (display-1, chrome top pad) is roster + headingLevel 1 only.
   * portrait never takes --lead or --solo: that pair is the poster.
   */
  headingLevel?: 1 | 2
  size?: 'roster' | 'portrait'
  /** Call / Text / Email on the face row, including /team/[slug] portrait. */
  reach?: boolean
}) {
  const [first, ...rest] = people
  if (!first) return null
  const shown = [first, ...rest]
  const lead = headingLevel === 1 && size === 'roster'
  const reachLinks = (person: AboutFace) =>
    reach ? (
      <div className="about-faces__reach-row" id={size === 'portrait' ? 'contact-broker' : undefined}>
        {person.tel ? (
          <a href={`tel:${person.tel}`} className="about-faces__reach" aria-label={`Call ${person.name}`}>
            Call
          </a>
        ) : null}
        {person.tel ? (
          <a href={`sms:${person.tel}`} className="about-faces__reach" aria-label={`Text ${person.name}`}>
            Text
          </a>
        ) : null}
        {person.email ? (
          <a href={`mailto:${person.email}`} className="about-faces__reach" aria-label={`Email ${person.name}`}>
            Email
          </a>
        ) : null}
      </div>
    ) : null

  if (size === 'portrait') {
    return (
      <section
        id="faces"
        className={cn(V3_ROOT_CLASS, 'about-faces', 'about-faces--portrait')}
        aria-labelledby="faces-heading"
      >
        <Link href={first.href} className="about-faces__photo-link">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="about-faces__photo"
            src={first.src}
            alt={first.name}
            width={800}
            height={1200}
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </Link>
        <div className="about-faces__row">
          <V3Heading level={headingLevel} id="faces-heading" className="about-faces__heading">
            {heading}
          </V3Heading>
          {first.title ? <p className="about-faces__title">{first.title}</p> : null}
          {reachLinks(first)}
        </div>
      </section>
    )
  }

  return (
    <section
      id="faces"
      className={cn(
        V3_ROOT_CLASS,
        'about-faces',
        lead && 'about-faces--lead',
        shown.length === 1 && 'about-faces--solo',
      )}
      aria-labelledby="faces-heading"
    >
      <div className="about-faces__head">
        <V3Heading level={headingLevel} id="faces-heading" className="about-faces__heading">
          {heading}
        </V3Heading>
      </div>
      <ul className="about-faces__grid">
        {shown.map((person, index) => (
          <li key={person.href} className="about-faces__item">
            <Link href={person.href} className="about-faces__photo-link">
              {/* Plain img: owned public/ file, same reason V3Stage states. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="about-faces__photo"
                src={person.src}
                alt={person.name}
                width={800}
                height={1200}
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : undefined}
                decoding="async"
              />
            </Link>
            <div className="about-faces__row">
              <Link href={person.href} className="about-faces__name">
                {person.name}
              </Link>
              {person.title ? <p className="about-faces__title">{person.title}</p> : null}
              {reachLinks(person)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
