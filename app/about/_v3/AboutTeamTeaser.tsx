/**
 * /about who-you-work-with teaser. Photo + name only. One door to /team.
 *
 * Looking brief item 4: not AboutFaces, not three equal broker Cards, not
 * licenses, not Call/Text/Email/Schedule per broker. The roster lives on /team.
 */

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { V3_ROOT_CLASS, V3Heading } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import { teamPath } from '@/lib/slug'
import { faceInitials } from './about-faces'
import './about-fold.css'

export type AboutTeamTeaserPerson = {
  name: string
  src: string
}

export function AboutTeamTeaser({ people }: { people: readonly AboutTeamTeaserPerson[] }) {
  if (people.length === 0) return null

  return (
    <section
      id="who-you-work-with"
      className={cn(V3_ROOT_CLASS, 'about-teaser')}
      aria-labelledby="who-you-work-with-heading"
    >
      <V3Heading level={2} id="who-you-work-with-heading">
        Who you work with
      </V3Heading>
      <p className="about-teaser__claim">The licensed brokers. Profiles, licenses, and how to reach each one live on the team page.</p>
      <Link href={teamPath()} className="about-teaser__door">
        <ul className="about-teaser__row">
          {people.map((person) => (
            <li key={person.name} className="about-teaser__person">
              <Avatar size="lg" className="about-teaser__avatar">
                <AvatarImage src={person.src} alt={person.name} width={800} height={1200} loading="lazy" />
                <AvatarFallback delayMs={0}>{faceInitials(person.name)}</AvatarFallback>
              </Avatar>
              <span className="about-teaser__name">{person.name}</span>
            </li>
          ))}
        </ul>
        <span className="about-teaser__go">Meet the brokers</span>
      </Link>
    </section>
  )
}
