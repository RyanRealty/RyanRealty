'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { CommunityForIndex } from '@/lib/communities'
import { Badge } from '@/components/ui/badge'
import { toggleSavedCommunity } from '@/app/actions/saved-communities'
import { toggleCommunityLike } from '@/app/actions/community-engagement'
import { subdivisionEntityKey } from '@/lib/slug'
import ShareButton from '@/components/ShareButton'
import { HeartIcon as ActionHeartIcon, BookmarkIcon as ActionBookmarkIcon } from '@/components/icons/ActionIcons'
import { Button } from "@/components/ui/button"

type Props = {
  community: CommunityForIndex
  signedIn?: boolean
  saved?: boolean
  liked?: boolean
}

/**
 * Compact community card for the city-page CommunitiesBar only.
 * Thumbnail + name + count + share/like/save. Guest like/save click → login.
 */
export default function CommunityBarCard({ community, signedIn = false, saved = false, liked = false }: Props) {
  const router = useRouter()
  const [savedState, setSavedState] = useState(saved)
  const [likedState, setLikedState] = useState(liked)
  const href = `/communities/${community.slug}`
  const entityKey = subdivisionEntityKey(community.city, community.subdivision)
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${href}` : href
  const countLabel =
    community.activeCount === 0
      ? 'No homes for sale'
      : community.activeCount === 1
        ? '1 home for sale'
        : `${community.activeCount} homes for sale`

  function goToLogin(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const returnUrl = typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname + window.location.search) : ''
    router.push(`/login${returnUrl ? `?returnUrl=${returnUrl}` : ''}`)
  }

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn) return goToLogin(e)
    const result = await toggleSavedCommunity(entityKey)
    if (result.error == null) setSavedState(result.saved)
  }

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn) return goToLogin(e)
    const result = await toggleCommunityLike(entityKey)
    if (result.error == null) setLikedState(result.liked)
  }

  const btn = 'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-border bg-muted text-muted-foreground transition hover:bg-border hover:text-foreground'
  const btnLike = likedState ? 'border-destructive/60 text-destructive' : ''
  const btnSave = savedState ? 'border-primary/60 text-primary' : ''

  return (
    <div className="flex flex-shrink-0 scroll-snap-align-start min-w-[140px] max-w-[160px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md">
      <Link href={href} className="group flex flex-1 items-center gap-2 overflow-hidden">
        <div className="relative h-10 w-14 shrink-0 overflow-hidden bg-border">
          {community.heroImageUrl ? (
            <Image
              src={community.heroImageUrl}
              alt={`${community.subdivision} community`}
              fill
              className="object-cover transition group-hover:scale-[1.03]"
              sizes="56px"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-[var(--primary / 0.8)]" />
          )}
          {community.isResort && (
            <div className="absolute right-0.5 top-0.5">
              <Badge variant="secondary" className="!text-[9px] !px-1 !py-0">Resort</Badge>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 py-1 pr-1.5">
          <p className="font-semibold text-foreground text-xs leading-tight truncate">{community.subdivision}</p>
          <p className="text-[11px] text-muted-foreground truncate">{countLabel}</p>
        </div>
      </Link>
      <div className="flex items-center justify-end gap-0.5 border-t border-border px-1 py-1" onClick={(e) => e.stopPropagation()}>
        <ShareButton url={shareUrl} title={`${community.subdivision} homes for sale`} variant="compact" iconClassName="h-3 w-3" className={`${btn} text-foreground`} aria-label="Share" />
        <Button type="button" onClick={handleLike} className={`${btn} ${btnLike}`} aria-label={signedIn ? (likedState ? 'Unlike' : 'Like') : 'Like'}>
          <ActionHeartIcon filled={likedState} className="h-3 w-3" />
        </Button>
        <Button type="button" onClick={handleSave} className={`${btn} ${btnSave}`} aria-label={signedIn ? (savedState ? 'Remove from saved' : 'Save community') : 'Save community'}>
          <ActionBookmarkIcon filled={savedState} className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
