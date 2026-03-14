'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import CardActionBar from '@/components/ui/CardActionBar'
import { subdivisionEntityKey } from '@/lib/slug'
import { toggleSavedCommunity } from '@/app/actions/saved-communities'
import { toggleCommunityLike, incrementCommunityShare } from '@/app/actions/community-engagement'
import type { CommunityEngagementCounts } from '@/app/actions/community-engagement'

export type CommunityCardProps = {
  slug: string
  name: string
  city: string
  activeCount: number
  medianPrice: number | null
  heroImageUrl: string | null
  isResort?: boolean
  /** Optional brief description (e.g. first 100 chars); used on index resort section. */
  description?: string
  /** Size: 'default' (compact) or 'large' (resort section). */
  size?: 'default' | 'large'
  /** When true, show save/like and allow toggle. */
  signedIn?: boolean
  /** Whether this community is saved by the current user. */
  saved?: boolean
  /** Whether this community is liked by the current user. */
  liked?: boolean
  /** Engagement counts (view, like, save, share). */
  engagement?: CommunityEngagementCounts | null
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function CommunityCard({
  slug,
  name,
  city,
  activeCount,
  medianPrice,
  heroImageUrl,
  isResort = false,
  description,
  size = 'default',
  signedIn = false,
  saved = false,
  liked = false,
  engagement,
}: CommunityCardProps) {
  const href = `/communities/${slug}`
  const entityKey = subdivisionEntityKey(city, name)
  const aspectClass = size === 'large' ? 'aspect-[21/9]' : 'aspect-[16/10]'
  const viewCount = engagement?.view_count ?? 0
  const likeCount = engagement?.like_count ?? 0
  const saveCount = engagement?.save_count ?? 0
  const shareCount = engagement?.share_count ?? 0

  const [savedState, setSavedState] = useState(saved)
  const [likedState, setLikedState] = useState(liked)
  const [pending, setPending] = useState(false)
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

  function handleShareClick() {
    incrementCommunityShare(entityKey).catch(() => {})
  }

  return (
    <Card className="overflow-hidden border-border shadow-sm transition hover:shadow-md group">
      <div className={`relative w-full overflow-hidden ${aspectClass}`}>
        <Link href={href} className="absolute inset-0 block">
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              alt={`${name} community in ${city}`}
              fill
              className="object-cover transition group-hover:scale-[1.02]"
              sizes={size === 'large' ? '(max-width: 768px) 100vw, 50vw' : '(max-width: 768px) 50vw, 33vw'}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary to-foreground" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          {isResort && (
            <div className="absolute right-2 top-2">
              <Badge variant="secondary">Resort</Badge>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-bold text-white drop-shadow-md">{name}</h3>
            <p className="mt-0.5 text-sm text-white/90">{city}</p>
            {size === 'large' && (
              <>
                {activeCount > 0 && (
                  <p className="mt-1 text-sm text-white/90">{activeCount} homes for sale</p>
                )}
                {medianPrice != null && (
                  <p className="mt-0.5 text-sm font-medium text-white">
                    Median {formatPrice(medianPrice)}
                  </p>
                )}
              </>
            )}
          </div>
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-end border-t border-border bg-muted/80 px-2 py-1.5">
        <CardActionBar
          position="below"
          variant="onLight"
          onClickWrap={(e) => { e.preventDefault(); e.stopPropagation() }}
          share={{
            url: typeof window !== 'undefined' ? `${window.location.origin}${href}` : undefined!,
            title: `${name} homes for sale in ${city}`,
            ariaLabel: `Share ${name}`,
            shareCount: shareCount > 0 ? shareCount : undefined,
            onShare: handleShareClick,
          }}
          like={signedIn ? {
            active: likedState,
            count: likeCount,
            ariaLabel: likedState ? 'Unlike community' : 'Like community',
            onToggle: handleToggleLike,
            disabled: pending,
          } : undefined}
          save={signedIn ? {
            active: savedState,
            count: saveCount,
            ariaLabel: savedState ? 'Remove from saved communities' : 'Save community',
            onToggle: handleToggleSave,
            disabled: pending,
          } : undefined}
          signedIn={signedIn}
          guestCounts={!signedIn ? { viewCount, likeCount, saveCount } : undefined}
        />
      </div>
      {size === 'large' && description && (
        <div className="p-4">
          <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
        </div>
      )}
      {size === 'default' && (
        <div className="p-3">
          <p className="text-sm text-muted-foreground">
            {activeCount} homes for sale
            {medianPrice != null && ` · ${formatPrice(medianPrice)}`}
          </p>
        </div>
      )}
    </Card>
  )
}
