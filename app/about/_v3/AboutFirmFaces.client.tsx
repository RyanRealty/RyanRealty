'use client'

/**
 * About opener faces — catalog AvatarGroup at display scale (SITE-163).
 *
 * AvatarGroup → Avatar (image, fallback, badge). Click opens the broker.
 * shadcn Avatar image, fallback, and badge at display scale.
 * 5.0 from 25 stays as the Google record.
 * Not three broker Cards. Not a Meet-the-Team dump. Deep bios stay on /team.
 */

import Link from 'next/link'
import { AvatarGroup } from '@/components/ui/avatar'
import { V3Avatar } from '@/components/site/v3/V3Avatar'
import { faceInitials, type AboutFace } from './about-faces'

export type AboutFirmProof = {
  value: string
  count: number
  href: string
}

export function AboutFirmFaces({
  people,
  proof,
}: {
  people: readonly AboutFace[]
  proof: AboutFirmProof | null
}) {
  if (people.length === 0 && !proof) return null

  return (
    <div className="about-firm__faces-wrap">
      {people.length > 0 ? (
        <AvatarGroup className="about-firm__faces" aria-label="Ryan Realty brokers">
          {people.map((person, index) => (
              <Link
                key={person.href}
                href={person.href}
                className="about-firm__avatar-btn"
                aria-label={person.name}
              >
                <V3Avatar
                  src={person.src}
                  name={person.name}
                  initials={faceInitials(person.name)}
                  badge={index === 0 ? proof?.value : undefined}
                  size="display"
                  priority
                />
              </Link>
            ))}
        </AvatarGroup>
      ) : null}
      {proof ? (
        <p className="about-firm__rating">
          <Link href={proof.href}>
            {proof.value} from {proof.count} Google reviews
          </Link>
        </p>
      ) : null}
    </div>
  )
}
