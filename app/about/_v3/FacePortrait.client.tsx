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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

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
}: {
  src: string
  name: string
  priority?: boolean
}) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <Avatar className="about-faces__avatar">
        <AvatarFallback className="about-faces__avatar-fallback" delayMs={0}>
          {faceInitials(name)}
        </AvatarFallback>
      </Avatar>
    )
  }
  return (
    // Plain img: owned public/ file, same reason V3Stage states.
    // eslint-disable-next-line @next/next/no-img-element
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
  )
}
