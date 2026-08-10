'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import {
  buildGuestWatchFromFilters,
  rememberGuestWatch,
} from '@/lib/alerts/guest-watch-residual'
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

/**
 * RoomRestyle — contained AI visualization block on listing detail (E4 craft).
 *
 * Visual thesis: one navy-bordered cream panel with a clear 3-step flow
 * (photo → style → generate). Not a second hero. Not a metrics card.
 * Post-success conversion is one quiet row: alert email + broker link,
 * without duplicating the full mid-page alert strip noise.
 */
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
        setError(data.error || 'Rate limit hit. Try again in a minute.')
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
        rememberGuestWatch(buildGuestWatchFromFilters(filters))
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
  const selectedCaption = safePhotos[photoIdx]?.caption?.trim()

  return (
    <section
      aria-labelledby="room-restyle-heading"
      style={{
        border: '3px solid var(--navy)',
        background: 'var(--cream)',
        padding: 'clamp(1rem, 3vw, 1.5rem)',
      }}
    >
      <p
        className="mono-lab"
        style={{
          color: 'var(--navy)',
          fontSize: '0.62rem',
          letterSpacing: '0.14em',
          lineHeight: 1.1,
        }}
      >
        AI visualization
      </p>
      <h2
        id="room-restyle-heading"
        className="display mt-1.5 text-2xl leading-tight tracking-tight"
        style={{ color: 'var(--navy)' }}
      >
        Imagine this room
      </h2>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed" style={{ color: 'rgba(16,39,66,0.72)' }}>
        Pick an interior photo and a style. This is a visualization, not the listed condition.
      </p>

      {/* Step 1: photo */}
      {pickerPhotos.length > 1 ? (
        <div className="mt-4">
          <p
            className="mb-2 text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'rgba(16,39,66,0.72)', letterSpacing: '0.1em' }}
          >
            1 · Choose a photo
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                  style={{
                    position: 'relative',
                    height: 56,
                    width: 80,
                    flexShrink: 0,
                    overflow: 'hidden',
                    border: selected ? '3px solid var(--navy)' : '2px solid rgba(16,39,66,0.28)',
                    opacity: selected ? 1 : 0.82,
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                  aria-label={p.caption?.trim() || `Listing photo ${i + 1}`}
                  aria-pressed={selected}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                </button>
              )
            })}
          </div>
          {selectedCaption ? (
            <p className="mt-1.5 text-xs" style={{ color: 'rgba(16,39,66,0.72)' }}>
              {selectedCaption}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Step 2: style */}
      <div className="mt-4">
        <p
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'rgba(16,39,66,0.72)', letterSpacing: '0.1em' }}
        >
          {pickerPhotos.length > 1 ? '2 · Style' : '1 · Style'}
        </p>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => {
            const on = style === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                style={{
                  border: '2px solid var(--navy)',
                  background: on ? 'var(--navy)' : 'transparent',
                  color: on ? 'var(--cream)' : 'var(--navy)',
                  padding: '8px 14px',
                  minHeight: 40,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                }}
                aria-pressed={on}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Step 3: generate */}
      <div className="mt-4">
        <p
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'rgba(16,39,66,0.72)', letterSpacing: '0.1em' }}
        >
          {pickerPhotos.length > 1 ? '3 · Generate' : '2 · Generate'}
        </p>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="btn alt"
          style={{
            minHeight: 44,
            opacity: loading ? 0.55 : 1,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Generating…' : 'Restyle photo'}
        </button>
        <p className="mt-1.5 text-xs" style={{ color: 'rgba(16,39,66,0.72)' }}>
          One style at a time. Capped per IP.
        </p>
      </div>

      {error ? (
        <p className="mt-3 text-sm font-medium" style={{ color: 'var(--navy)' }} role="alert">
          {error}
        </p>
      ) : null}

      {resultUrl ? (
        <div className="mt-5 space-y-3">
          <div
            className="relative w-full overflow-hidden"
            style={{ aspectRatio: '4 / 3', border: '2px solid var(--navy)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt="AI restyled room visualization"
              className="h-full w-full object-cover"
            />
          </div>
          {disclaimer ? (
            <p className="text-xs" style={{ color: 'rgba(16,39,66,0.72)' }}>
              {disclaimer}
            </p>
          ) : null}

          {/* Post-success conversion: one compact row, not a second full form card */}
          <div
            style={{
              borderTop: '2px solid var(--navy)',
              paddingTop: 14,
            }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>
              Next step
            </p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'rgba(16,39,66,0.72)' }}>
              {city
                ? `Get email when a similar ${city} home lists, or talk to a broker about this one.`
                : 'Talk to a broker about this home, or set a search alert lower on the page.'}
            </p>
            {city ? (
              alertState === 'done' ? (
                <p className="mt-2 text-sm" style={{ color: 'var(--navy)' }}>
                  Alert set. New {city} listings near this price band will hit your inbox.
                </p>
              ) : (
                <form
                  onSubmit={onAlertSubmit}
                  className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch"
                >
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@email.com"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    style={{
                      minWidth: 0,
                      flex: 1,
                      border: '2px solid var(--navy)',
                      background: 'var(--cream)',
                      color: 'var(--navy)',
                      padding: '10px 12px',
                      fontSize: '0.875rem',
                      minHeight: 44,
                    }}
                    aria-label={`${city} listing alert email`}
                  />
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
                    className="btn alt"
                    style={{
                      minHeight: 44,
                      opacity: alertPending ? 0.55 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {alertPending ? 'Saving…' : `Alert me: ${city}`}
                  </button>
                </form>
              )
            ) : null}
            {alertState === 'error' && alertError ? (
              <p className="mt-1 text-xs" style={{ color: 'var(--navy)' }} role="alert">
                {alertError}
              </p>
            ) : null}
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <Link
                href={contactHref}
                className="font-semibold underline-offset-2 hover:underline"
                style={{ color: 'var(--navy)', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
              >
                Contact a broker about this home
              </Link>
              {city ? (
                <>
                  <span aria-hidden style={{ color: 'rgba(16,39,66,0.72)' }}>
                    ·
                  </span>
                  <a
                    href="#listing-like-alerts"
                    className="underline-offset-2 hover:underline"
                    style={{ color: 'rgba(16,39,66,0.72)', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
                  >
                    Full alert options
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="relative mt-5 w-full overflow-hidden"
          style={{ aspectRatio: '4 / 3', border: '2px solid rgba(16,39,66,0.28)' }}
        >
          <Image src={photoUrl} alt="Selected listing photo" fill className="object-cover" unoptimized />
        </div>
      )}
    </section>
  )
}
