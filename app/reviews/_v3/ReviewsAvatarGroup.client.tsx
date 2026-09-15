'use client'

/**
 * Official shadcn Avatar catalog (SITE-109).
 *
 * Source: https://ui.shadcn.com/docs/components/avatar
 * Dropdown: apps/v4/examples/base/dropdown-menu-avatar.tsx
 *
 * AvatarGroup
 * ├── Avatar → AvatarImage → AvatarFallback → AvatarBadge
 * └── AvatarGroupCount
 *
 * avatar-open is the catalog dropdown (Button ghost icon + Avatar trigger,
 * DropdownMenuGroup Account / Billing / Notifications, Separator, Sign Out).
 * Not a cream quote overlay on letter discs.
 */

import { BadgeCheckIcon, BellIcon, CreditCardIcon, LogOutIcon } from 'lucide-react'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Official Avatar docs portraits. Remote URLs are the catalog source;
 * local copies are what AvatarImage loads so shots do not depend on github.com.
 */
const CATALOG_PORTRAITS = [
  {
    remote: 'https://github.com/shadcn.png',
    src: '/images/catalog/shadcn-avatar/shadcn.jpg',
    alt: 'shadcn',
    initials: 'CN',
  },
  {
    remote: 'https://github.com/leerob.png',
    src: '/images/catalog/shadcn-avatar/leerob.png',
    alt: 'leerob',
    initials: 'LR',
  },
  {
    remote: 'https://github.com/evilrabbit.png',
    src: '/images/catalog/shadcn-avatar/evilrabbit.png',
    alt: 'evilrabbit',
    initials: 'ER',
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
  const shown = faces.slice(0, CATALOG_PORTRAITS.length)

  return (
    <AvatarGroup
      className="v3-proof__avatar-group [&_[data-slot=avatar]]:ring-2 [&_[data-slot=avatar]]:ring-background"
      aria-label="Recent reviewers"
    >
      {shown.map((face, index) => {
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
                aria-label={`Open ${portrait.alt} menu`}
                aria-pressed={open}
              >
                <Avatar>
                  <AvatarImage src={src} alt={portrait.alt} />
                  <AvatarFallback delayMs={0}>{portrait.initials}</AvatarFallback>
                  <AvatarBadge />
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <BadgeCheckIcon />
                  Account
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CreditCardIcon />
                  Billing
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <BellIcon />
                  Notifications
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOutIcon />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
      {remaining > 0 ? <AvatarGroupCount>+{remaining}</AvatarGroupCount> : null}
    </AvatarGroup>
  )
}
