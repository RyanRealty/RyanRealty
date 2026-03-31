'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type {
  generateBannerForPage,
  getPlaceBannerOptions,
  setPlaceBannerFromPhoto,
  refreshPlaceBanner,
} from '../app/actions/banners'
import { Button } from "@/components/ui/button"

type BannerOption = { url: string; thumbUrl: string; attribution: string }

type Props = {
  generateAction: typeof generateBannerForPage
  getOptionsAction: typeof getPlaceBannerOptions
  setBannerFromPhotoAction: typeof setPlaceBannerFromPhoto
  refreshBannerAction: typeof refreshPlaceBanner
  searchQuery: string
  entityType: 'city' | 'subdivision'
  entityKey: string
  displayName: string
  city?: string
  hasBanner: boolean
}

export default function BannerActions({
  generateAction,
  getOptionsAction,
  setBannerFromPhotoAction,
  refreshBannerAction,
  searchQuery,
  entityType,
  entityKey,
  displayName,
  city,
  hasBanner,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [options, setOptions] = useState<BannerOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [picking, setPicking] = useState(false)
  const autoStarted = useRef(false)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const result = await generateAction({
        entityType,
        entityKey,
        displayName,
        city: entityType === 'subdivision' ? city : undefined,
      })
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setLoading(true)
    setError(null)
    setShowPicker(false)
    try {
      const result = await refreshBannerAction(entityType, entityKey, searchQuery)
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleOpenPicker() {
    setError(null)
    setShowPicker(true)
    if (options.length > 0) return
    setLoadingOptions(true)
    try {
      const list = await getOptionsAction(searchQuery)
      setOptions(list)
    } finally {
      setLoadingOptions(false)
    }
  }

  async function handleSelectOption(option: BannerOption) {
    setPicking(true)
    setError(null)
    try {
      const result = await setBannerFromPhotoAction(
        entityType,
        entityKey,
        option.url,
        option.attribution
      )
      if (result.ok) {
        setShowPicker(false)
        router.refresh()
      } else {
        setError(result.error)
      }
    } finally {
      setPicking(false)
    }
  }

  // When there's no banner, fetch one automatically on mount
  useEffect(() => {
    if (hasBanner || autoStarted.current) return
    autoStarted.current = true
    handleGenerate()
  }, [hasBanner])

  const btn =
    'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted disabled:opacity-60'

  // No banner: show loading or error
  if (!hasBanner) {
    return (
      <div className="flex flex-col gap-2">
        {loading && <p className="text-sm text-primary-foreground/90 drop-shadow-md">Fetching banner…</p>}
        {error && (
          <>
            <p className="text-sm text-destructive/60 drop-shadow-md">{error}</p>
            <Button type="button" onClick={handleGenerate} disabled={loading} className={btn}>
              Try again
            </Button>
          </>
        )}
      </div>
    )
  }

  // Has banner: Change image (picker) + Refresh image
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleOpenPicker}
          disabled={loadingOptions}
          className={btn}
        >
          {loadingOptions ? 'Loading…' : 'Change image'}
        </Button>
        <Button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className={btn}
        >
          {loading ? 'Refreshing…' : 'Refresh image'}
        </Button>
      </div>
      {showPicker && (
        <div className="mt-2 rounded-lg border border-border bg-card/95 p-3 shadow-md backdrop-blur">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Choose an image</p>
          {loadingOptions ? (
            <p className="text-sm text-muted-foreground">Loading options…</p>
          ) : options.length === 0 ? (
            <p className="text-sm text-muted-foreground">No options found. Try &quot;Refresh image&quot; instead.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {options.map((opt, i) => (
                <Button
                  key={opt.url}
                  type="button"
                  onClick={() => handleSelectOption(opt)}
                  disabled={picking}
                  className="relative aspect-video overflow-hidden rounded-md border-2 border-border hover:border-success focus:border-accent focus:outline-none disabled:opacity-60"
                >
                  <Image
                    src={opt.thumbUrl}
                    alt={`Option ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="120px"
                    unoptimized
                  />
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <p className="text-sm text-destructive/60 drop-shadow-md">{error}</p>}
    </div>
  )
}
