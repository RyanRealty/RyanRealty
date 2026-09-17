/**
 * Overlapping broker Avatars — the shadcn AvatarGroup demo on /team.
 * Each circle is a door to /team/[slug]. Not a second About roster.
 */

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar'
import { faceInitials, type AboutFace } from '@/app/about/_v3/about-faces'

export function TeamTrio({ people }: { people: readonly AboutFace[] }) {
  if (people.length === 0) return null
  return (
    <AvatarGroup className="team-trio" aria-label="Ryan Realty brokers">
      {people.map((person) => (
        <Avatar key={person.href} size="lg">
          <Link href={person.href} className="contents" aria-label={person.name}>
            <AvatarImage src={person.src} alt={person.name} />
            <AvatarFallback delayMs={400}>{faceInitials(person.name)}</AvatarFallback>
          </Link>
        </Avatar>
      ))}
    </AvatarGroup>
  )
}
