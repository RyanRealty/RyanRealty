'use client'

/**
 * Official shadcn AvatarGroup on /reviews (SITE-109, SITE-167).
 *
 * Source: https://ui.shadcn.com/docs/components/avatar
 *
 * AvatarGroup
 * ├── Avatar → AvatarImage → AvatarFallback → AvatarBadge
 * └── AvatarGroupCount
 *
 * public.reviews has no photo column. Do not invent a reviewer face.
 * The portraits are the brokers who stand behind the 5.0.
 */

import { useState } from 'react'
import { ExternalLinkIcon, PhoneIcon, UserIcon, UsersIcon } from 'lucide-react'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { brokersForReviews } from './reviews-faces'
import './reviews-faces.css'

export type ReviewsAvatarFace = {
  id: string
  author: string
  pull: string
  attribution: string
  rating: number
}

export function ReviewsAvatarGroup({
  faces,
  remaining,
  sourceHref,
}: {
  faces: readonly ReviewsAvatarFace[]
  remaining: number
  sourceHref: string
  openedId: string | null
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const leadText = faces[0]?.pull ?? ''
  const brokers = brokersForReviews(leadText)

  return (
    <div className="reviews-faces v3-proof__avatar-group">
      <AvatarGroup className="[&_[data-slot=avatar]]:ring-2 [&_[data-slot=avatar]]:ring-background" aria-label="Ryan Realty brokers">
        {brokers.map((broker, i) => {
          const lead = i === 0
          const open = openKey === broker.key
          return (
            <DropdownMenu
              key={broker.key}
              modal={false}
              open={open}
              onOpenChange={(next) => setOpenKey(next ? broker.key : null)}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="v3-proof__avatar-btn reviews-faces__btn rounded-full"
                  aria-label={`Open ${broker.name}'s profile`}
                  aria-pressed={open}
                >
                  <Avatar size="lg" data-lead={lead ? 'true' : undefined} className="reviews-faces__photo">
                    <AvatarImage
                      src={broker.src}
                      alt={broker.name}
                      width={800}
                      height={1200}
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                    />
                    <AvatarFallback delayMs={400}>{broker.initials}</AvatarFallback>
                    {open ? (
                      <AvatarBadge>
                        <UserIcon />
                      </AvatarBadge>
                    ) : null}
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuLabel className="flex items-center gap-2 font-normal">
                  <Avatar size="sm">
                    <AvatarImage src={broker.src} alt="" width={800} height={1200} />
                    <AvatarFallback delayMs={400}>{broker.initials}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{broker.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{broker.title}</span>
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <a href={broker.href}>
                      <UserIcon />
                      Meet {broker.name}
                    </a>
                  </DropdownMenuItem>
                  {broker.tel ? (
                    <DropdownMenuItem asChild>
                      <a href={`tel:${broker.tel}`}>
                        <PhoneIcon />
                        Call {broker.phoneDisplay}
                      </a>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem asChild>
                    <a href={sourceHref} target="_blank" rel="noopener noreferrer">
                      <ExternalLinkIcon />
                      View on Google
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="#reviews">
                      <UsersIcon />
                      All reviews
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        })}
        {remaining > 0 ? (
          <AvatarGroupCount aria-label={`${remaining} more Google reviews`}>+{remaining}</AvatarGroupCount>
        ) : null}
      </AvatarGroup>
      <p className="reviews-faces__note">No reviewer photos from Google. The brokers behind the 5.0.</p>
    </div>
  )
}
