'use client'

/**
 * shadcn Avatar catalog demo (SITE-109).
 *
 * Composition from https://ui.shadcn.com/docs/components/avatar :
 *   AvatarGroup → Avatar → AvatarImage → AvatarFallback → AvatarBadge
 *   AvatarGroupCount
 * Open (docs §Dropdown): Avatar is the dropdown trigger. Closed group and
 * open dropdown are different first-viewport objects — avatar-open shots
 * must not match default.
 *
 * public.reviews has no photo column. AvatarImage is in the tree with no
 * invented src; Fallback is the catalog muted disc, not a navy cream box.
 */

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
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
  imageSrc?: string | null
}

export function ReviewsAvatarGroup({
  faces,
  remaining,
  openedId,
  onPick,
  onClose,
}: {
  faces: readonly ReviewsAvatarFace[]
  remaining: number
  openedId: string | null
  onPick: (id: string) => void
  onClose: () => void
}) {
  const seen = new Set<string>()
  const labeled = faces.map((face) => {
    const initials = uniqueReviewerInitials(face.author, seen)
    seen.add(initials)
    return { face, initials }
  })

  return (
    <AvatarGroup
      className="v3-proof__avatar-group [&_[data-slot=avatar]]:ring-2 [&_[data-slot=avatar]]:ring-background"
      aria-label="Recent reviewers"
    >
      {labeled.map(({ face, initials }) => {
        const open = openedId === face.id
        const src = face.imageSrc?.trim() || undefined
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
            <DropdownMenuTrigger
              className="v3-proof__avatar-btn"
              aria-label={`Read ${face.author}'s review`}
              aria-pressed={open}
            >
              <Avatar size={open ? 'lg' : 'default'}>
                <AvatarImage src={src} alt={face.author} />
                <AvatarFallback delayMs={0}>{initials}</AvatarFallback>
                {open ? <AvatarBadge>{face.rating}</AvatarBadge> : null}
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-64 max-w-80">
              <DropdownMenuLabel>{face.author}</DropdownMenuLabel>
              <p className="px-1.5 pb-1.5 text-sm text-muted-foreground">{face.attribution}</p>
              <p className="px-1.5 pb-1.5 text-sm text-foreground">{face.pull}</p>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
      {remaining > 0 ? <AvatarGroupCount>+{remaining}</AvatarGroupCount> : null}
    </AvatarGroup>
  )
}
