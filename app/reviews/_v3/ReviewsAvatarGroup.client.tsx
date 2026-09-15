'use client'

/**
 * Official shadcn Avatar catalog (SITE-109).
 *
 * Source: https://ui.shadcn.com/docs/components/avatar
 *
 * AvatarGroup
 * ├── Avatar → AvatarImage → AvatarFallback → AvatarBadge
 * └── AvatarGroupCount
 *
 * Catalog portraits fill AvatarImage (public.reviews has no photo column —
 * do not invent reviewer photos). Fallback initials, alt, and the open
 * menu are the reviewer. avatar-open is the catalog Avatar dropdown
 * (Button ghost icon + Avatar trigger) with reviewer identity — not
 * a SaaS auth menu, and not a cream quote overlay.
 */

import { ExternalLinkIcon, StarIcon, UsersIcon } from 'lucide-react'
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
import { uniqueReviewerInitials } from '@/lib/reviews/reviewer-initials'

/**
 * Official Avatar docs portraits. Remote URLs are the catalog source;
 * local copies are what AvatarImage loads so shots do not depend on github.com.
 */
const CATALOG_PORTRAITS = [
  {
    remote: 'https://github.com/shadcn.png',
    src: '/images/catalog/shadcn-avatar/shadcn.jpg',
  },
  {
    remote: 'https://github.com/leerob.png',
    src: '/images/catalog/shadcn-avatar/leerob.png',
  },
  {
    remote: 'https://github.com/evilrabbit.png',
    src: '/images/catalog/shadcn-avatar/evilrabbit.png',
  },
] as const

export type ReviewsAvatarFace = {
  id: string
  author: string
  pull: string
  attribution: string
  rating: number
  imageSrc?: string | null
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
  const shown = faces.slice(0, CATALOG_PORTRAITS.length).map((face) => {
    const initials = uniqueReviewerInitials(face.author, seen)
    seen.add(initials)
    return { face, initials }
  })

  return (
    <AvatarGroup
      className="v3-proof__avatar-group [&_[data-slot=avatar]]:ring-2 [&_[data-slot=avatar]]:ring-background"
      aria-label="Recent reviewers"
    >
      {shown.map(({ face, initials }, index) => {
        const portrait = CATALOG_PORTRAITS[index]!
        const src = face.imageSrc?.trim() || portrait.src
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
                <Avatar size={open ? 'lg' : 'default'}>
                  <AvatarImage src={src} alt={face.author} />
                  <AvatarFallback delayMs={0}>{initials}</AvatarFallback>
                  <AvatarBadge>
                    {open ? <StarIcon /> : null}
                  </AvatarBadge>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel className="flex items-center gap-2 font-normal">
                <Avatar size="sm">
                  <AvatarImage src={src} alt={face.author} />
                  <AvatarFallback delayMs={0}>{initials}</AvatarFallback>
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
