'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { CityForIndex } from '@/lib/cities'
import CardActionBar from '@/components/ui/CardActionBar'
import { toggleSavedCity } from '@/app/actions/saved-cities'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export type CityTileProps = {
  city: CityForIndex
  /** When true, show save state and allow toggle (signed-in users). */
  signedIn?: boolean
  /** Whether this city is currently saved by the user */
  saved?: boolean
  /** Engagement counts for display (views, likes, etc.) */
  engagement?: { view_count?: number; like_count?: number; save_count?: number; share_count?: number }
}

/**
 * Single city tile: same size and behavior as ListingTile/CommunityTile (image, share, save).
 * Use everywhere we show a city card (cities page, Browse by city, sliders).
 */
export default function CityTile({ city, signedIn = false, saved = false, engagement }: CityTileProps) {
  const router = useRouter()
  const href = `/cities/${city.slug}`
  const countLabel =
    city.activeCount === 0
      ? 'No homes for sale'
      : city.activeCount === 1
        ? '1 home for sale'
        : `${city.activeCount} homes for sale`
  const [savedState, setSavedState] = useState(saved)
  const [pending, setPending] = useState(false)
  const viewCount = engagement?.view_count ?? 0
  const likeCount = engagement?.like_count ?? 0
  const saveCount = engagement?.save_count ?? 0
  const shareCount = engagement?.share_count ?? 0

  useEffect(() => {
    setSavedState(saved)
  }, [saved])

  function goToLogin(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const returnUrl = typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname + window.location.search) : ''
    router.push(`/login${returnUrl ? `?returnUrl=${returnUrl}` : ''}`)
  }

  async function handleToggleSave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn || pending) return
    setPending(true)
    const result = await toggleSavedCity(city.slug)
    setPending(false)
    if (result.error == null) setSavedState(result.saved)
  }

  return (
    <div
      className="relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition hover:shadow-lg hover:-translate-y-1"
      style={{ minHeight: TILE_MIN_HEIGHT_PX }}
    >
      <div className="relative aspect-[4/3] w-full">
        <Link href={href} className="absolute inset-0 block">
          {city.heroImageUrl ? (
            <Image
              src={city.heroImageUrl}
              alt={`${city.name}, Oregon — city overview`}
              fill
              className="object-cover transition hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, 400px"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary to-foreground" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 text-primary-foreground">
            <h3 className="text-xl font-bold drop-shadow-md">{city.name}</h3>
            <p className="mt-0.5 text-sm text-primary-foreground/90">{countLabel}</p>
            <p className="mt-0.5 text-xs text-primary-foreground/80">
              Median {formatPrice(city.medianPrice)} · {city.communityCount} communities
            </p>
          </div>
        </Link>
        <CardActionBar
          position="overlay"
          variant="onDark"
          onClickWrap={(e) => { e.preventDefault(); e.stopPropagation() }}
          viewCount={viewCount}
          share={{
            url: typeof window !== 'undefined' ? `${window.location.origin}${href}` : undefined!,
            title: `Homes for sale in ${city.name}`,
            ariaLabel: `Share ${city.name}`,
            shareCount,
          }}
          like={signedIn
            ? { active: false, count: likeCount, ariaLabel: 'Like city', onToggle: () => {}, disabled: true }
            : { active: false, count: likeCount, ariaLabel: 'Like city', onToggle: goToLogin }}
          save={signedIn
            ? { active: savedState, count: saveCount, ariaLabel: savedState ? 'Remove from saved cities' : 'Save city', onToggle: handleToggleSave, disabled: pending }
            : { active: false, count: saveCount, ariaLabel: 'Save city', onToggle: goToLogin }}
          signedIn={signedIn}
          guestCounts={!signedIn ? { viewCount, likeCount, saveCount } : undefined}
        />
      </div>
    </div>
  )
}
