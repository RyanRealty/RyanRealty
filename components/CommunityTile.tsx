"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import type { HotCommunity } from "@/app/actions/listings"
import { subdivisionEntityKey, getSubdivisionDisplayName } from "@/lib/slug"
import { communityPagePath } from "@/lib/community-slug"
import CardActionBar from "@/components/ui/CardActionBar"
import CardBadges from "@/components/ui/CardBadges"
import { toggleSavedCommunity } from "@/app/actions/saved-communities"
import { toggleCommunityLike, incrementCommunityShare } from "@/app/actions/community-engagement"
import type { CommunityEngagementCounts } from "@/app/actions/community-engagement"
import { isResortCommunity } from "@/lib/resort-communities"
import { TILE_MIN_HEIGHT_PX } from "@/lib/tile-constants"

const MIN_LIKES_FOR_FIRE = 3

export type CommunityTileProps = {
  city: string
  community: HotCommunity
  /** Optional banner image URL for the tile */
  bannerUrl?: string | null
  /** When true, show saved/like state and allow toggle (signed-in users). */
  signedIn?: boolean
  /** Whether this community is currently saved by the user */
  saved?: boolean
  /** Whether this community is currently liked by the user */
  liked?: boolean
  /** Engagement counts (view, like, save, share) */
  engagement?: CommunityEngagementCounts | null
}

/**
 * Single community tile. Use the same component anywhere community tiles are displayed (home, search, etc.).
 */
export default function CommunityTile({ city, community, bannerUrl = null, signedIn = false, saved = false, liked = false, engagement }: CommunityTileProps) {
  const href = communityPagePath(city, community.subdivisionName)
  const entityKey = subdivisionEntityKey(city, community.subdivisionName)
  const totalActive = community.forSale + community.pending
  const countLabel = totalActive > 0 ? `${totalActive} home${totalActive === 1 ? '' : 's'} for sale` : 'Limited availability'
  const isResort = isResortCommunity(city, community.subdivisionName)
  const isHot = community.newLast7Days >= 3 || totalActive >= 10
  const isPopular = !isHot && totalActive >= 5
  const displayName = getSubdivisionDisplayName(community.subdivisionName)
  const viewCount = engagement?.view_count ?? 0
  const likeCount = engagement?.like_count ?? 0
  const saveCount = engagement?.save_count ?? 0
  const shareCount = engagement?.share_count ?? 0
  const showFireLikes = likeCount >= MIN_LIKES_FOR_FIRE
  const medianK =
    community.medianListPrice != null && community.medianListPrice > 0
      ? `${Math.round(community.medianListPrice / 1000)}k`
      : null
  const blurb = (() => {
    if (isResort) {
      if (totalActive > 0 && community.newLast7Days > 0) {
        return `${displayName} is a resort & master plan community in ${city} with ${totalActive} active home${totalActive === 1 ? '' : 's'} and ${community.newLast7Days} new this week.`
      }
      if (totalActive > 0) {
        return `${displayName} is a resort & master plan community in ${city} with ${totalActive} home${totalActive === 1 ? '' : 's'} on the market.`
      }
      return `${displayName} is a boutique resort & master plan community in ${city} with low inventory and strong demand.`
    }
    if (totalActive > 0 && medianK) {
      return `${displayName} is a neighborhood in ${city} with ${totalActive} home${totalActive === 1 ? '' : 's'} for sale and a median list price around $${medianK}.`
    }
    if (medianK) {
      return `${displayName} is a quiet neighborhood in ${city} with a typical list price around $${medianK}.`
    }
    return `${displayName} is a residential community in ${city} with a mix of homes and outdoor amenities.`
  })()
  const router = useRouter()
  const [savedState, setSavedState] = useState(saved)
  const [likedState, setLikedState] = useState(liked)
  const [pending, setPending] = useState(false)

  function goToLogin(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const returnUrl = typeof window !== "undefined" ? encodeURIComponent(window.location.pathname + window.location.search) : ""
    router.push(`/login${returnUrl ? `?returnUrl=${returnUrl}` : ""}`)
  }

  useEffect(() => {
    setSavedState(saved)
    setLikedState(liked)
  }, [saved, liked])

  async function handleToggleSave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn || pending) return
    setPending(true)
    const result = await toggleSavedCommunity(entityKey)
    setPending(false)
    if (result.error == null) setSavedState(result.saved)
  }

  async function handleToggleLike(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn || pending) return
    setPending(true)
    const result = await toggleCommunityLike(entityKey)
    setPending(false)
    if (result.error == null) setLikedState(result.liked)
  }

  return (
    <div
      className="relative flex h-full min-h-[200px] w-full flex-col overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition hover:shadow-lg hover:-translate-y-1"
      style={{ minHeight: TILE_MIN_HEIGHT_PX }}
    >
      <div className="relative aspect-[4/3] w-full">
        <Link href={href} className="absolute inset-0 block">
          {bannerUrl ? (
            <Image
              src={bannerUrl}
              alt={`${community.subdivisionName} community in ${city}`}
              fill
              className="object-cover transition hover:scale-[1.02]"
              sizes="300px"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-muted-foreground to-foreground" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <CardBadges
            position="top-left"
            max={3}
            items={[
              ...(isHot ? [{ label: 'Hot market', variant: 'hot' as const, icon: <span aria-hidden>🔥</span> }] : []),
              ...(!isHot && isPopular ? [{ label: 'Popular', variant: 'popular' as const }] : []),
              ...(!isHot && !isPopular && totalActive > 0 ? [{ label: 'Steady', variant: 'steady' as const }] : []),
            ]}
          />
          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
            <span className="block font-semibold drop-shadow">{displayName}</span>
            <span className="mt-0.5 block text-sm text-white/90">{countLabel}</span>
            {medianK && (
              <span className="mt-0.5 block text-xs text-white/80">
                Median around ${medianK}
              </span>
            )}
            <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-white/90">
              {community.newLast7Days > 0 && (
                <span className="rounded bg-black/50 px-1.5 py-0.5">
                  {community.newLast7Days} new this week
                </span>
              )}
              {community.pending > 0 && (
                <span className="rounded bg-black/50 px-1.5 py-0.5">
                  {community.pending} pending
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-end border-t border-border bg-muted/80 px-2 py-1.5">
        <CardActionBar
          position="below"
          variant="onLight"
          onClickWrap={(e) => e.preventDefault()}
          share={{
            url: typeof window !== 'undefined' ? `${window.location.origin}${href}` : undefined!,
            title: `${displayName} homes for sale in ${city}`,
            ariaLabel: `Share ${displayName}`,
            shareCount: shareCount > 0 ? shareCount : undefined,
            onShare: () => incrementCommunityShare(entityKey).catch(() => {}),
          }}
          like={signedIn
            ? { active: likedState, count: likeCount, ariaLabel: likedState ? "Unlike community" : "Like community", onToggle: handleToggleLike, disabled: pending }
            : { active: false, count: likeCount, ariaLabel: "Like community", onToggle: goToLogin }}
          save={signedIn
            ? { active: savedState, count: saveCount, ariaLabel: savedState ? "Remove from saved communities" : "Save community", onToggle: handleToggleSave, disabled: pending }
            : { active: false, count: saveCount, ariaLabel: "Save community", onToggle: goToLogin }}
          signedIn={signedIn}
          guestCounts={!signedIn ? { viewCount, likeCount, saveCount } : undefined}
        />
      </div>
      <div className="flex flex-1 flex-col border-t border-border bg-card px-3 py-3 text-sm text-muted-foreground">
        <p className="line-clamp-3">{blurb}</p>
      </div>
    </div>
  )
}
