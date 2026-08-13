/**
 * First viewport of /about: the live brokers, cutout PNGs on cream.
 * No card, no wash, no border — the transparent edge is the composition
 * (CLAUDE.md §3). Each face opens that broker's profile.
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow, V3Heading } from '@/components/site/v3'
import type { AboutFace } from './about-faces'
import './about-faces.css'

export function AboutFaces({
  people,
  eyebrow,
  heading,
}: {
  people: readonly AboutFace[]
  eyebrow: string
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
        <V3Eyebrow>{eyebrow}</V3Eyebrow>
        <V3Heading level={1} id="faces-heading" className="about-faces__heading">
          {heading}
        </V3Heading>
      </div>
      <ul className="about-faces__grid">
        {shown.map((person) => (
          <li key={person.href}>
            <Link href={person.href} className="about-faces__person">
              {/* Plain img: owned public/ file, same reason V3Stage states. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="about-faces__photo"
                src={person.src}
                alt=""
                width={800}
                height={1200}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
              <span className="about-faces__name">{person.name}</span>
              <span className="about-faces__title">{person.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
