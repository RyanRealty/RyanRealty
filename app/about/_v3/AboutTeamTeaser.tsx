/**
 * Short “Who you work with” door. One face row + Meet the team → /team.
 * Not a Card roster, not per-broker CTAs, licenses, bios, or /team/[slug].
 */

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Heading } from '@/components/site/v3'
import { teamPath } from '@/lib/slug'

export type AboutTeamTeaserPerson = {
  name: string
  src: string
}

function faceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

export function AboutTeamTeaser({
  id = 'team-teaser',
  people,
}: {
  id?: string
  people: readonly AboutTeamTeaserPerson[]
}) {
  if (people.length === 0) return null
  const teamHref = teamPath()
  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'about-teaser')}
      aria-labelledby="team-teaser-heading"
    >
      <V3Heading level={2} id="team-teaser-heading" className="about-teaser__heading">
        Who you work with
      </V3Heading>
      <Link href={teamHref} className="about-teaser__door">
        <ul className="about-teaser__faces">
          {people.map((person) => (
            <li key={person.src} className="about-teaser__face">
              <Avatar size="lg" className="about-teaser__avatar">
                <AvatarImage src={person.src} alt="" />
                <AvatarFallback delayMs={0}>{faceInitials(person.name)}</AvatarFallback>
              </Avatar>
              <span className="about-teaser__name">{person.name}</span>
            </li>
          ))}
        </ul>
        <span className="about-teaser__cta">Meet the team</span>
      </Link>
    </section>
  )
}
