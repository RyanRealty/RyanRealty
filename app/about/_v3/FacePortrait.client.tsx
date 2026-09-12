'use client'

/**
 * shadcn Avatar demo as shipped (SITE-90).
 *
 * Catalog: Avatar → AvatarImage → AvatarFallback → AvatarBadge
 * No house classNames — about-faces.css must not restyle this into a card.
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
  /** SITE-90: the firm's 5.0 lives on the principal AvatarBadge, not a KPI row. */
  proof?: string
}) {
  return (
    <Avatar size="lg">
      <AvatarImage
        src={src}
        alt={name}
        width={800}
        height={1200}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
      />
      <AvatarFallback delayMs={600}>{faceInitials(name)}</AvatarFallback>
      {proof ? <AvatarBadge>{proof}</AvatarBadge> : null}
    </Avatar>
  )
}
