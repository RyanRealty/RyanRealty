/**
 * First viewport of /about: the live brokers, cutout PNGs on cream.
 * No card, no wash, no border — the transparent edge is the composition
 * (CLAUDE.md §3). The name is the door. Call and text sit on that row.
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Heading } from '@/components/site/v3'
import type { AboutFace } from './about-faces'
import './about-faces.css'

export function AboutFaces({
  people,
  heading,
}: {
  people: readonly AboutFace[]
  heading: string
}) {
  const [first, ...rest] = people
  if (!first) return null
  const shown = [first, ...rest]

  return (
    <section
      id="faces"
      className={cn(V3_ROOT_CLASS, 'about-faces')}
      aria-labelledby="faces-heading"
    >
      <div className="about-faces__head">
        <V3Heading level={1} id="faces-heading" className="about-faces__heading">
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
              {person.tel ? (
                <>
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
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
