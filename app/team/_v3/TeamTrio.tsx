/**
 * Overlapping broker Avatars at display scale — the shadcn AvatarGroup demo
 * on /team (SITE-166). Each circle is a door to /team/[slug].
 * Not a 32px kicker. Not a second About roster. Not a rectangular box.
 */

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar'
import { faceInitials, type AboutFace } from '@/app/about/_v3/about-faces'
import './team-trio.css'

export function TeamTrio({ people }: { people: readonly AboutFace[] }) {
  if (people.length === 0) return null
  return (
    <AvatarGroup className="team-trio" aria-label="Ryan Realty brokers">
      {people.map((person, index) => (
        <Link
          key={person.href}
          href={person.href}
          className="team-trio__link"
          aria-label={person.name}
        >
          <Avatar size="lg" className="team-trio__avatar team-trio__avatar--display">
            <AvatarImage
              src={person.src}
              alt={person.name}
              width={800}
              height={1200}
              loading="eager"
              fetchPriority={index === 0 ? 'high' : 'auto'}
              decoding="async"
            />
            <AvatarFallback delayMs={400}>{faceInitials(person.name)}</AvatarFallback>
          </Avatar>
        </Link>
      ))}
    </AvatarGroup>
  )
}
