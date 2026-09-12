'use client'

/**
 * shadcn Avatar demo, restyled into AboutFaces (SITE-90).
 *
 * Catalog composition from ui.shadcn.com/docs/components/avatar:
 *   Avatar → AvatarImage → AvatarFallback → AvatarBadge
 * A raw <img> inside Avatar is a cream box. This file is the installed
 * primitive (`@/components/ui/avatar`), not a second face kit.
 */

import { Avatar, AvatarBadge, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { faceInitials } from './about-faces'

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
  return (
    <Avatar className="about-faces__avatar">
      <AvatarImage
        className="about-faces__photo"
        src={src}
        alt={name}
        width={800}
        height={1200}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
      />
      <AvatarFallback className="about-faces__avatar-fallback" delayMs={600}>
        {faceInitials(name)}
      </AvatarFallback>
      {proof ? (
        <AvatarBadge className="about-faces__proof-badge">{proof}</AvatarBadge>
      ) : null}
    </Avatar>
  )
}
