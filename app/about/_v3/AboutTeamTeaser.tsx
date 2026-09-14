/**
 * Short “Who you work with” door. One face row + Meet the team → /team.
 * Not a Card roster, not per-broker CTAs, licenses, bios, or /team/[slug].
 *
 * SITE-90 2026-09-13: the face row is the shadcn AvatarGroup demo as
 * shipped in components/ui/avatar — overlapping Avatars with a cream ring,
 * photo + fallback initials, the demo's trailing AvatarGroupCount disc
 * carrying the door's arrow (no invented "+N") — then the names in one line
 * and the one door.
 *
 * The headshots are 800x1200 alpha PNGs of 1.0–1.6 MB each; a 44px Avatar
 * asks the image optimizer for them (getImageProps → /_next/image srcSet)
 * instead of the originals. The Radix Fallback renders in the server HTML
 * (no delayMs) so the disc carries initials until the photo lands, never an
 * empty circle.
 */

import Link from 'next/link'
import { getImageProps } from 'next/image'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Heading, V3Icon } from '@/components/site/v3'
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

function firstNames(people: readonly AboutTeamTeaserPerson[]): string {
  const names = people.map((p) => p.name.trim().split(/\s+/)[0] ?? p.name)
  if (names.length <= 1) return names.join('')
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
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
      <Link href={teamHref} className="about-teaser__door" aria-describedby="team-teaser-heading">
        <AvatarGroup className="about-teaser__faces">
          {people.map((person) => {
            const { props: img } = getImageProps({
              src: person.src,
              alt: '',
              width: 88,
              height: 132,
              quality: 75,
            })
            return (
              <Avatar key={person.src} size="lg" className="about-teaser__avatar">
                <AvatarImage src={img.src} srcSet={img.srcSet} sizes={img.sizes} alt="" />
                <AvatarFallback className="about-teaser__initials">
                  {faceInitials(person.name)}
                </AvatarFallback>
              </Avatar>
            )
          })}
          {/* The demo's trailing disc. There is no overflow to count — every
              broker is in the stack — so the disc carries the door's arrow
              instead of a fabricated "+N". Decorative: the link text names
              the door. */}
          <AvatarGroupCount className="about-teaser__more" aria-hidden="true">
            <V3Icon name="ArrowRight" size={18} />
          </AvatarGroupCount>
        </AvatarGroup>
        <span className="about-teaser__names">
          {firstNames(people)}
          <span className="about-teaser__count">
            {' '}
            · {people.length} broker{people.length === 1 ? '' : 's'}
          </span>
        </span>
        <span className="about-teaser__cta">Meet the team</span>
      </Link>
    </section>
  )
}
