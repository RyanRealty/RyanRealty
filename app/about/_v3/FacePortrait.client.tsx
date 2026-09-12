'use client'

/**
 * shadcn Avatar adapted into AboutFaces (SITE-74).
 *
 * The catalog job is portrait treatment: image with a fallback, not a second
 * face kit. The cutout is a plain img so first paint does not wait on the
 * client Avatar (the 1440 shot was capturing initials). AvatarFallback is
 * the interaction that remains — initials if the PNG fails.
 */

import { useState } from 'react'
import { Avatar, AvatarBadge, AvatarFallback } from '@/components/ui/avatar'

export function faceInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export function FacePortrait({
  src,
  name,
  priority = false,
  proof,
}: {
  src: string
  name: string
  priority?: boolean
  /** SITE-90: the firm's 5.0 lives on the principal's face, not a KPI row. */
  proof?: string
}) {
  const [failed, setFailed] = useState(false)
  const badge = proof ? (
    <AvatarBadge className="about-faces__proof-badge" aria-hidden="true">
      {proof}
    </AvatarBadge>
  ) : null
  if (failed) {
    return (
      <Avatar className="about-faces__avatar">
        <AvatarFallback className="about-faces__avatar-fallback" delayMs={0}>
          {faceInitials(name)}
        </AvatarFallback>
        {badge}
      </Avatar>
    )
  }
  return (
    <Avatar className="about-faces__avatar">
      {/* Plain img: owned public/ file, same reason V3Stage states. First
          paint must not wait on AvatarImage or the 1440 shot captures initials. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="about-faces__photo"
        src={src}
        alt={name}
        width={800}
        height={1200}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        onError={() => setFailed(true)}
      />
      {badge}
    </Avatar>
  )
}
