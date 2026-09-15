'use client'

/**
 * Official shadcn AvatarGroup on /reviews (SITE-109).
 *
 * Source: https://ui.shadcn.com/docs/components/avatar
 *
 * AvatarGroup
 * ├── Avatar → AvatarFallback → AvatarBadge
 * └── AvatarGroupCount
 *
 * public.reviews has no photo column — never invent a face. AvatarFallback
 * initials come from the real reviewer name. avatar-open is the Avatar
 * dropdown with reviewer identity (Read this review / View on Google /
 * All reviews) — not a SaaS auth menu, and not catalog dummy portraits.
 */

import { ExternalLinkIcon, StarIcon, UsersIcon } from 'lucide-react'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
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
import { uniqueReviewerInitials } from '@/lib/reviews/reviewer-initials'

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
  openedId,
  onPick,
  onClose,
}: {
  faces: readonly ReviewsAvatarFace[]
  remaining: number
  sourceHref: string
  openedId: string | null
  onPick: (id: string) => void
  onClose: () => void
}) {
  const seen = new Set<string>()
  const shown = faces.slice(0, 3).map((face) => {
    const initials = uniqueReviewerInitials(face.author, seen)
    seen.add(initials)
    return { face, initials }
  })

  return (
    <AvatarGroup
      className="v3-proof__avatar-group [&_[data-slot=avatar]]:ring-2 [&_[data-slot=avatar]]:ring-background"
      aria-label="Recent reviewers"
    >
      {shown.map(({ face, initials }) => {
        const open = openedId === face.id
        return (
          <DropdownMenu
            key={face.id}
            modal={false}
            open={open}
            onOpenChange={(next) => {
              if (next) onPick(face.id)
              else onClose()
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="v3-proof__avatar-btn rounded-full"
                aria-label={`Open ${face.author}'s review`}
                aria-pressed={open}
              >
                <Avatar size={open ? 'lg' : 'default'} data-initials={initials}>
                  <AvatarFallback className="v3-proof__avatar-fallback" delayMs={0}>
                    {initials}
                  </AvatarFallback>
                  <AvatarBadge>{open ? <StarIcon /> : null}</AvatarBadge>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel className="flex items-center gap-2 font-normal">
                <Avatar size="sm" data-initials={initials}>
                  <AvatarFallback className="v3-proof__avatar-fallback" delayMs={0}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{face.author}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {face.attribution}
                  </span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => onPick(face.id)}>
                  <StarIcon />
                  Read this review
                </DropdownMenuItem>
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
      {remaining > 0 ? <AvatarGroupCount>+{remaining}</AvatarGroupCount> : null}
    </AvatarGroup>
  )
}
