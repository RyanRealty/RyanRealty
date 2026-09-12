/**
 * Short “Who you work with” teasers. Every card goes to /team.
 * Photo + name only — no bios, OREA numbers, Call rows, or per-broker profile doors.
 */

import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Button, V3Heading } from '@/components/site/v3'
import { teamPath } from '@/lib/slug'

export type AboutTeamTeaserPerson = {
  name: string
  src: string
}

export function AboutTeamTeaser({ people }: { people: readonly AboutTeamTeaserPerson[] }) {
  if (people.length === 0) return null
  const teamHref = teamPath()
  return (
    <section
      id="team-teaser"
      className={cn(V3_ROOT_CLASS, 'about-teaser')}
      aria-labelledby="team-teaser-heading"
    >
      <V3Heading level={2} id="team-teaser-heading" className="about-teaser__heading">
        Who you work with
      </V3Heading>
      <ul className="about-teaser__list">
        {people.map((person) => (
          <li key={person.src}>
            <Card className="about-teaser__card">
              <Link href={teamHref} className="about-teaser__link">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={person.src} alt="" width={400} height={600} />
                <CardHeader>
                  <CardTitle>{person.name}</CardTitle>
                </CardHeader>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
      <V3Button variant="text" href={teamHref}>
        Meet the team
      </V3Button>
    </section>
  )
}
