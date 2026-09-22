'use client'

/**
 * v3 AVATAR — catalog Avatar at house scale.
 *
 * Wraps the installed shadcn Avatar (`components/ui/avatar.tsx`):
 * Avatar → AvatarImage → AvatarFallback → AvatarBadge.
 * Display scale is a token size, not a KPI tile and not a rectangular box
 * behind a portrait. Public paint stays tokens.css.
 */

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import './tokens.css'
import './V3Avatar.css'

export type V3AvatarSize = 'display' | 'companion'

export type V3AvatarProps = {
  src: string
  name: string
  initials: string
  /** Optional badge, e.g. the firm's sourced 5.0. Never invented. */
  badge?: string
  size?: V3AvatarSize
  priority?: boolean
  className?: string
}

export function V3Avatar({
  src,
  name,
  initials,
  badge,
  size = 'display',
  priority = false,
  className,
}: V3AvatarProps) {
  return (
    <Avatar
      size="lg"
      data-v3-size={size}
      className={cn('v3-avatar', `v3-avatar--${size}`, className)}
    >
      <AvatarImage
        src={src}
        alt={name}
        width={800}
        height={1200}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
      />
      <AvatarFallback delayMs={600}>{initials}</AvatarFallback>
      {badge ? <AvatarBadge className="v3-avatar__badge">{badge}</AvatarBadge> : null}
    </Avatar>
  )
}
