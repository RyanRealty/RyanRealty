/**
 * First viewport of /about and /team: the live brokers, cutout PNGs on cream
 * at conversation scale. No card, no wash, no border — the transparent edge
 * is the composition (CLAUDE.md §3). The name is the door. Title, Call, and
 * Text sit under the portrait, not jammed on one line.
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
}: {
  people: readonly AboutFace[]
  heading: string
  /**
   * 1 on /about and /team, where the faces ARE the page and the heading is the
   * H1. 2 on the homepage, whose H1 is the Stage — a second H1 on one document
   * is an outline defect, not a style choice. Default keeps both existing
   * callers byte-identical.
   *
   * It is also the only thing that distinguishes the two jobs this section
   * does, so it is where the visual distinction is set (see about-faces.css):
   * level 1 means the section OPENS the page, so it carries the page's title
   * at display-1 and pays the chrome's top spacing instead of the section
   * rhythm; level 2 means it is a section inside a page that already has a
   * title, so it wears the section heading size and the full rhythm.
   */
  headingLevel?: 1 | 2
}) {
  const [first, ...rest] = people
  if (!first) return null
  const shown = [first, ...rest]

  return (
    <section
      id="faces"
      className={cn(
        V3_ROOT_CLASS,
        'about-faces',
        headingLevel === 1 && 'about-faces--lead',
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
              {person.tel ? (
                <div className="about-faces__reach-row">
                  <a
                    href={`tel:${person.tel}`}
                    className="about-faces__reach"
                    aria-label={`Call ${person.name}`}
                  >
                    Call
                  </a>
                  <a
                    href={`sms:${person.tel}`}
                    className="about-faces__reach"
                    aria-label={`Text ${person.name}`}
                  >
                    Text
                  </a>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
