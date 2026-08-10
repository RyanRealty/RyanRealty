'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { priceBandAroundListPrice } from '@/lib/search/price-band'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'

const STYLES = [
  { id: 'modern', label: 'Modern' },
  { id: 'warm', label: 'Warm' },
  { id: 'staged', label: 'Staged' },
  { id: 'mountain', label: 'Mountain' },
] as const

export type RestylePhoto = {
  url: string
  caption?: string | null
}

/** Caption/URL hints that usually mean exterior / non-room (skip for restyle default). */
const EXTERIOR_RE =
  /\b(exterior|aerial|drone|street|front\s*yard|back\s*yard|backyard|yard|landscape|facade|façade|curb|lot\b|garage\s*door|driveway|rooftop|roof\b|pool\s*only|map|floor\s*plan|plat|site\s*plan|community\s*map)\b/i

/** Caption/URL hints that usually mean interior rooms. */
const INTERIOR_RE =
  /\b(interior|kitchen|living|great\s*room|family\s*room|bedroom|primary|master|bath|dining|foyer|entry|office|den|loft|laundry|pantry|closet|bonus|media|basement|rec\s*room|nook|hallway|stairs|fireplace|island)\b/i

/**
 * Prefer an interior listing photo over photos[0] (almost always the exterior hero).
 * When captions are empty (common on MLS), fall through to photo index 1+ rather than the hero.
 */
export function pickDefaultInteriorPhotoIndex(photos: RestylePhoto[]): number {
  if (!photos.length) return 0

  let bestInterior = -1
  for (let i = 0; i < photos.length; i++) {
    const hay = `${photos[i].caption ?? ''} ${photos[i].url ?? ''}`
    if (EXTERIOR_RE.test(hay)) continue
    if (INTERIOR_RE.test(hay)) {
      bestInterior = i
      break
    }
  }
  if (bestInterior >= 0) return bestInterior

  // No caption signal: skip likely exterior hero when more photos exist.
  if (photos.length > 1) {
    for (let i = 1; i < photos.length; i++) {
      const hay = `${photos[i].caption ?? ''} ${photos[i].url ?? ''}`
      if (!EXTERIOR_RE.test(hay)) return i
    }
    return 1
  }
  return 0
}

type Props = {
  /** Ordered listing photos (url + optional caption). First is usually exterior. */
  photos: RestylePhoto[]
  listingKey: string
  /** City for post-restyle alert CTA (homes like this). */
  city?: string | null
  listPrice?: number | null
  beds?: number | null
}

export function RoomRestyle({ photos, listingKey, city, listPrice, beds }: Props) {
  const safePhotos = useMemo(
    () => photos.filter((p) => typeof p.url === 'string' && p.url.startsWith('http')).slice(0, 12),
    [photos],
  )
  const defaultIdx = useMemo(() => pickDefaultInteriorPhotoIndex(safePhotos), [safePhotos])
  const [photoIdx, setPhotoIdx] = useState(defaultIdx)
  const [style, setStyle] = useState<(typeof STYLES)[number]['id']>('modern')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [disclaimer, setDisclaimer] = useState('')

  // J3: compact alert capture after success (same listing_alerts path as KB forms)
  const [alertEmail, setAlertEmail] = useState('')
  const [alertCompany, setAlertCompany] = useState('')
  const [alertState, setAlertState] = useState<'idle' | 'done' | 'error'>('idle')
  const [alertError, setAlertError] = useState('')
  const [alertPending, startAlert] = useTransition()

  const photoUrl = safePhotos[photoIdx]?.url ?? safePhotos[0]?.url ?? ''
  if (!photoUrl) return null

  async function run() {
    setLoading(true)
    setError('')
    setResultUrl(null)
    try {
      const res = await fetch('/api/ai/room-restyle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: photoUrl, style, listingKey }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        url?: string | null
        dataUrl?: string | null
        disclaimer?: string
        error?: string
      }
      if (res.status === 429) {
        setError(data.error || 'Rate limit hit. Try again in a minute (AI restyle is capped per IP).')
        return
      }
      if (!res.ok || !data.ok) {
        setError(data.error || 'Could not restyle this photo.')
        return
      }
      setResultUrl(data.url || data.dataUrl || null)
      setDisclaimer(data.disclaimer || '')
    } catch {
      setError('Could not restyle this photo.')
    } finally {
      setLoading(false)
    }
  }

  function onAlertSubmit(event: FormEvent) {
    event.preventDefault()
    if (!city) return
    setAlertState('idle')
    setAlertError('')
    const filters: Record<string, string> = {
      city,
      ...priceBandAroundListPrice(listPrice),
      ...(beds != null && beds > 0 ? { beds: String(beds) } : {}),
    }
    startAlert(async () => {
      const res = await submitSearchAlertSignup({
        email: alertEmail,
        filters,
        company: alertCompany,
      })
      if (res.ok) {
        setAlertState('done')
        fireSearchEvent('alert_create', buildAlertCreatePayload('daily'))
      } else {
        setAlertState('error')
        setAlertError(res.error)
      }
    })
  }

  const contactHref = `/contact?listingKey=${encodeURIComponent(listingKey)}&intent=restyle`
  const pickerPhotos = safePhotos.slice(0, 8)

  return (
    <div className="border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Imagine this room
      </p>
      <p className="mt-1 text-sm text-foreground">
        AI visualization from a listing photo. Prefer interiors. Pick a room below. Not the listed
        condition.
      </p>

      {pickerPhotos.length > 1 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-muted-foreground">Choose a photo</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pickerPhotos.map((p, i) => {
              const selected = i === photoIdx
              return (
                <button
                  key={`${p.url}-${i}`}
                  type="button"
                  onClick={() => {
                    setPhotoIdx(i)
                    setResultUrl(null)
                    setError('')
                  }}
                  className={
                    selected
                      ? 'relative h-14 w-20 shrink-0 overflow-hidden border-2 border-primary'
                      : 'relative h-14 w-20 shrink-0 overflow-hidden border border-border opacity-80 hover:opacity-100'
                  }
                  aria-label={p.caption?.trim() || `Listing photo ${i + 1}`}
                  aria-pressed={selected}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStyle(s.id)}
            className={
              style === s.id
                ? 'border border-primary bg-primary px-3 py-1.5 text-xs text-primary-foreground'
                : 'border border-border px-3 py-1.5 text-xs'
            }
          >
            {s.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="mt-3 border border-primary bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Restyle photo'}
      </button>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Rate limit: AI restyle uses the strict API tier (~10 requests / minute per IP). Costs are
        per generation. Try one style at a time.
      </p>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {resultUrl ? (
        <div className="mt-4 space-y-3">
          <div className="relative aspect-[4/3] w-full overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt="AI restyled room visualization"
              className="h-full w-full object-cover"
            />
          </div>
          <p className="text-xs text-muted-foreground">{disclaimer}</p>

          {/* J3: conversion after successful restyle */}
          <div className="border border-border bg-background p-3">
            <p className="text-sm font-medium text-foreground">Next step</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {city
                ? `Get email when a similar ${city} home lists, or talk to a broker about this one.`
                : 'Talk to a broker about this home, or set a search alert from the form lower on the page.'}
            </p>
            {city ? (
              alertState === 'done' ? (
                <p className="mt-2 text-sm text-foreground">
                  Alert set. New {city} listings near this price band will hit your inbox.
                </p>
              ) : (
                <form onSubmit={onAlertSubmit} className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@email.com"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    className="min-w-0 flex-1 border border-border bg-card px-3 py-2 text-sm"
                    aria-label={`${city} listing alert email`}
                  />
                  {/* honeypot */}
                  <input
                    type="text"
                    name="company"
                    value={alertCompany}
                    onChange={(e) => setAlertCompany(e.target.value)}
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden
                  />
                  <button
                    type="submit"
                    disabled={alertPending}
                    className="border border-primary bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                  >
                    {alertPending ? 'Saving…' : `Alert me: ${city}`}
                  </button>
                </form>
              )
            ) : null}
            {alertState === 'error' && alertError ? (
              <p className="mt-1 text-xs text-destructive">{alertError}</p>
            ) : null}
            <p className="mt-2">
              <Link
                href={contactHref}
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Contact a broker about this home
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden border border-border opacity-80">
          <Image src={photoUrl} alt="Selected listing photo" fill className="object-cover" unoptimized />
        </div>
      )}
    </div>
  )
}
