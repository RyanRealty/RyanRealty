'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { CommunityForIndex } from '@/lib/communities'
import type { CommunityEngagementCounts } from '@/app/actions/community-engagement'
import { Badge } from '@/components/ui/badge'
import { toggleSavedCommunity } from '@/app/actions/saved-communities'
import { toggleCommunityLike, incrementCommunityShare } from '@/app/actions/community-engagement'
import { subdivisionEntityKey } from '@/lib/slug'
import CardActionBar from '@/components/ui/CardActionBar'

type Props = {
  community: CommunityForIndex
  signedIn?: boolean
  saved?: boolean
  liked?: boolean
  engagement?: CommunityEngagementCounts | null
}

/**
 * Compact community card for the city-page CommunitiesBar only.
 * Thumbnail + name + count + share/like/save. Guest like/save click → login.
 */
const RESORT_BADGE_CN = '!text-[9px] !px-1 !py-0'

export default function CommunityBarCard({ community, signedIn = false, saved = false, liked = false, engagement }: Props) {
  const router = useRouter()
  const [savedState, setSavedState] = useState(saved)
  const [likedState, setLikedState] = useState(liked)
  const href = `/communities/${community.slug}`
  const entityKey = subdivisionEntityKey(community.city, community.subdivision)
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${href}` : href
  const viewCount = engagement?.view_count ?? 0
  const likeCount = engagement?.like_count ?? 0
  const saveCount = engagement?.save_count ?? 0
  const shareCount = engagement?.share_count ?? 0
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

  return (
    <div className="flex flex-shrink-0 scroll-snap-align-start min-w-[140px] max-w-[160px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md">
      <Link href={href} className="group block overflow-hidden">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-border">
          {community.heroImageUrl ? (
            <Image
              src={community.heroImageUrl}
              alt={`${community.subdivision} community`}
              fill
              className="object-cover transition group-hover:scale-[1.03]"
              sizes="160px"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-[var(--primary / 0.8)]" />
          )}
          {community.isResort && (
            <div className="absolute right-0.5 top-0.5">
              <Badge variant="secondary" className={RESORT_BADGE_CN}>Resort</Badge>
            </div>
          )}
          <CardActionBar
            position="overlay"
            variant="onDark"
            onClickWrap={(e) => { e.preventDefault(); e.stopPropagation() }}
            viewCount={viewCount}
            share={{
              url: shareUrl,
              title: `${community.subdivision} homes for sale`,
              ariaLabel: 'Share',
              shareCount,
              onShare: () => incrementCommunityShare(entityKey).catch(() => {}),
            }}
            like={signedIn
              ? { active: likedState, count: likeCount, ariaLabel: likedState ? 'Unlike' : 'Like', onToggle: handleLike }
              : { active: false, count: likeCount, ariaLabel: 'Like', onToggle: goToLogin }}
            save={signedIn
              ? { active: savedState, count: saveCount, ariaLabel: savedState ? 'Remove from saved' : 'Save community', onToggle: handleSave }
              : { active: false, count: saveCount, ariaLabel: 'Save community', onToggle: goToLogin }}
            signedIn={signedIn}
            guestCounts={!signedIn ? { viewCount, likeCount, saveCount } : undefined}
          />
        </div>
        <div className="min-w-0 px-2 py-2">
          <p className="font-semibold text-foreground text-xs leading-tight truncate">{community.subdivision}</p>
          <p className="text-[11px] text-muted-foreground truncate">{countLabel}</p>
        </div>
      </Link>
    </div>
  )
}
