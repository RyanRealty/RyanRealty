'use client'

/**
 * shadcn Avatar adapted into AboutFaces (SITE-74).
 *
 * The catalog job is portrait treatment: image with a fallback, not a second
 * face kit. Restyle keeps the alpha-matted cutout (no rounded crop, no ring
 * box behind the PNG). The interaction that remains is the fallback — initials
 * if the cutout fails to load.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

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
  return (
    <Avatar className="about-faces__avatar">
      <AvatarImage
        src={src}
        alt={name}
        className="about-faces__photo"
        fetchPriority={priority ? 'high' : undefined}
      />
      <AvatarFallback className="about-faces__avatar-fallback" delayMs={400}>
        {faceInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
