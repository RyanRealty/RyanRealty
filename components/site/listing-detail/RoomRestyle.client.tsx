'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import {
  buildGuestWatchFromFilters,
  rememberGuestWatch, // hydration-safe: event/effect storage only
} from '@/lib/alerts/guest-watch-residual'
import { priceBandAroundListPrice } from '@/lib/search/price-band'
import { buildAlertCreatePayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'

/**
 * Style chips: label must stay stable for e2e (Modern, Warm, Staged, Mountain).
 * `hint` is craft-only subcopy under the chip.
 */
const STYLES = [
  { id: 'modern', label: 'Modern', hint: 'Clean, updated, calm' },
  { id: 'warm', label: 'Warm', hint: 'Wood, soft light' },
  { id: 'staged', label: 'Staged', hint: 'Market-ready' },
  { id: 'mountain', label: 'Mountain', hint: 'Central Oregon' },
  { id: 'light', label: 'Light', hint: 'Bright and airy' },
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

/** True when caption/url strongly suggest exterior or non-room (bad restyle input). */
export function isLikelyExteriorPhoto(photo: RestylePhoto | undefined): boolean {
  if (!photo) return false
  const hay = `${photo.caption ?? ''} ${photo.url ?? ''}`
  return EXTERIOR_RE.test(hay)
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

type CompareMode = 'after' | 'before' | 'split'

/**
 * RoomRestyle — thoughtful AI visualization on listing detail.
 *
 * Visual thesis: one navy-bordered cream panel with a clear flow
 * (photo → style → generate → before/after → next step). Not a second hero.
 * Exterior photos are refused with a clear reason. Post-success is a quiet
 * conversion row (alert + broker + tour), not a second full form card.
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
  const [compare, setCompare] = useState<CompareMode>('after')

  // J3: compact alert capture after success (same listing_alerts path as KB forms)
  const [alertEmail, setAlertEmail] = useState('')
  const [alertCompany, setAlertCompany] = useState('')
  const [alertState, setAlertState] = useState<'idle' | 'done' | 'error'>('idle')
  const [alertError, setAlertError] = useState('')
  const [alertPending, startAlert] = useTransition()

  const photoUrl = safePhotos[photoIdx]?.url ?? safePhotos[0]?.url ?? ''
  if (!photoUrl) return null

  const exteriorSelected = isLikelyExteriorPhoto(safePhotos[photoIdx])
  const selectedCaption = safePhotos[photoIdx]?.caption?.trim()
  const styleMeta = STYLES.find((s) => s.id === style) ?? STYLES[0]
  const tourHref = '#listing-act'
  const contactHref = `/contact?listingKey=${encodeURIComponent(listingKey)}&intent=restyle`

  async function run() {
    if (exteriorSelected) {
      setError(
        'This photo looks like an exterior or site view. Pick an interior room (kitchen, living, bedroom) for a useful restyle.',
      )
      return
    }
    setLoading(true)
    setError('')
    setResultUrl(null)
    setCompare('after')
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
        rememberGuestWatch(buildGuestWatchFromFilters(filters)) // hydration-safe: event/effect storage only
        setAlertState('done')
        fireSearchEvent('alert_create', buildAlertCreatePayload('daily'))
      } else {
        setAlertState('error')
        setAlertError(res.error)
      }
    })
  }

  function selectPhoto(i: number) {
    setPhotoIdx(i)
    setResultUrl(null)
    setError('')
    setCompare('after')
  }

  const pickerPhotos = safePhotos.slice(0, 8)

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
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed" style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}>
        See how an interior could feel in a different finish. Architecture stays the same.
        This is a visualization, not the listed condition, and not a renovation quote.
      </p>

      {/* Step 1: photo */}
      {pickerPhotos.length > 1 ? (
        <div className="mt-4">
          <p
            className="mb-2 text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)', letterSpacing: '0.1em' }}
          >
            1 · Choose an interior photo
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {pickerPhotos.map((p, i) => {
              const selected = i === photoIdx
              const exterior = isLikelyExteriorPhoto(p)
              return (
                <button
                  key={`${p.url}-${i}`}
                  type="button"
                  onClick={() => selectPhoto(i)}
                  style={{
                    position: 'relative',
                    height: 56,
                    width: 80,
                    flexShrink: 0,
                    overflow: 'hidden',
                    border: selected ? '3px solid var(--navy)' : '2px solid color-mix(in srgb, var(--v3-navy) 28%, transparent)',
                    opacity: exterior ? 0.55 : selected ? 1 : 0.82,
                    background: 'transparent',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                  aria-label={
                    exterior
                      ? `${p.caption?.trim() || `Listing photo ${i + 1}`} (likely exterior)`
                      : p.caption?.trim() || `Listing photo ${i + 1}`
                  }
                  aria-pressed={selected}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                </button>
              )
            })}
          </div>
          {selectedCaption ? (
            <p className="mt-1.5 text-xs" style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}>
              {selectedCaption}
            </p>
          ) : null}
          {exteriorSelected ? (
            <p className="mt-2 text-sm font-medium" style={{ color: 'var(--navy)' }} role="status">
              Exterior and site photos restyle poorly. Choose a kitchen, living room, or bedroom.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Step 2: style */}
      <div className="mt-4">
        <p
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)', letterSpacing: '0.1em' }}
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
                onClick={() => {
                  setStyle(s.id)
                  setResultUrl(null)
                  setError('')
                }}
                style={{
                  border: '2px solid var(--navy)',
                  background: on ? 'var(--navy)' : 'transparent',
                  color: on ? 'var(--cream)' : 'var(--navy)',
                  padding: '8px 12px',
                  minHeight: 44,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  textAlign: 'left',
                  lineHeight: 1.25,
                }}
                aria-pressed={on}
                title={s.hint}
              >
                <span style={{ display: 'block' }}>{s.label}</span>
                <span
                  aria-hidden
                  style={{
                    display: 'block',
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    opacity: on ? 0.85 : 0.72,
                    marginTop: 2,
                  }}
                >
                  {s.hint}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step 3: generate */}
      <div className="mt-4">
        <p
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)', letterSpacing: '0.1em' }}
        >
          {pickerPhotos.length > 1 ? '3 · Generate' : '2 · Generate'}
        </p>
        <button
          type="button"
          onClick={run}
          disabled={loading || exteriorSelected}
          className="btn alt"
          style={{
            minHeight: 44,
            opacity: loading || exteriorSelected ? 0.55 : 1,
            cursor: loading ? 'wait' : exteriorSelected ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Generating…' : `Restyle photo · ${styleMeta.label}`}
        </button>
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}>
          {loading
            ? 'Keeping the room shape. Applying the finish. Usually under a minute.'
            : 'One style at a time. Capped per visitor so costs stay honest.'}
        </p>
      </div>

      {error ? (
        <p className="mt-3 text-sm font-medium" style={{ color: 'var(--navy)' }} role="alert">
          {error}
        </p>
      ) : null}

      {/* Preview / before-after */}
      {resultUrl ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Compare listing photo and restyle">
            {(
              [
                { id: 'after' as const, label: 'Restyle' },
                { id: 'before' as const, label: 'Original' },
                { id: 'split' as const, label: 'Side by side' },
              ] as const
            ).map((m) => {
              const on = compare === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setCompare(m.id)}
                  style={{
                    border: '2px solid var(--navy)',
                    background: on ? 'var(--navy)' : 'transparent',
                    color: on ? 'var(--cream)' : 'var(--navy)',
                    padding: '6px 12px',
                    minHeight: 40,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  aria-pressed={on}
                >
                  {m.label}
                </button>
              )
            })}
          </div>

          {compare === 'split' ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <figure className="m-0">
                <div
                  className="relative w-full overflow-hidden"
                  style={{ aspectRatio: '4 / 3', border: '2px solid var(--navy)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl} alt="Original listing photo" className="h-full w-full object-cover" />
                </div>
                <figcaption className="mt-1 text-xs font-semibold" style={{ color: 'var(--navy)' }}>
                  As listed
                </figcaption>
              </figure>
              <figure className="m-0">
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
                <figcaption className="mt-1 text-xs font-semibold" style={{ color: 'var(--navy)' }}>
                  {styleMeta.label} visualization
                </figcaption>
              </figure>
            </div>
          ) : (
            <div
              className="relative w-full overflow-hidden"
              style={{ aspectRatio: '4 / 3', border: '2px solid var(--navy)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={compare === 'before' ? photoUrl : resultUrl}
                alt={
                  compare === 'before'
                    ? 'Original listing photo'
                    : 'AI restyled room visualization'
                }
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {disclaimer ? (
            <p className="text-xs leading-relaxed" style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}>
              {disclaimer}
            </p>
          ) : null}

          {/* Post-success: thoughtful next steps, not a second form card */}
          <div
            style={{
              borderTop: '2px solid var(--navy)',
              paddingTop: 14,
            }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>
              What do you want next?
            </p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}>
              {city
                ? `Tour this home, ask a broker how a finish like this would play in ${city}, or get email when a similar home lists.`
                : 'Tour this home, ask a broker about finishes, or set a search alert lower on the page.'}
            </p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                href={tourHref}
                className="btn alt"
                style={{
                  minHeight: 44,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  padding: '10px 16px',
                }}
              >
                Schedule a tour
              </Link>
              <Link
                href={contactHref}
                className="font-semibold underline-offset-2 hover:underline"
                style={{
                  color: 'var(--navy)',
                  minHeight: 44,
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 4px',
                }}
              >
                Ask a broker about finishes
              </Link>
              <button
                type="button"
                onClick={() => {
                  setResultUrl(null)
                  setError('')
                  setCompare('after')
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)',
                  minHeight: 44,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                  padding: '0 4px',
                }}
              >
                Try another style
              </button>
            </div>

            {city ? (
              <div className="mt-4">
                {alertState === 'done' ? (
                  <p className="text-sm" style={{ color: 'var(--navy)' }}>
                    {priceBandAroundListPrice(listPrice).maxPrice
                      ? `Alert set. New ${city} listings near this price band will hit your inbox.`
                      : `Alert set. New ${city} listings will hit your inbox.`}
                  </p>
                ) : (
                  <form
                    onSubmit={onAlertSubmit}
                    className="flex flex-col gap-2 sm:flex-row sm:items-stretch"
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
                )}
                {alertState === 'error' && alertError ? (
                  <p className="mt-1 text-xs" style={{ color: 'var(--navy)' }} role="alert">
                    {alertError}
                  </p>
                ) : null}
                <p className="mt-2">
                  <a
                    href="#listing-like-alerts"
                    className="text-xs underline-offset-2 hover:underline"
                    style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)' }}
                  >
                    Full alert options
                  </a>
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          className="relative mt-5 w-full overflow-hidden"
          style={{
            aspectRatio: '4 / 3',
            border: exteriorSelected
              ? '2px dashed color-mix(in srgb, var(--v3-navy) 40%, transparent)'
              : '2px solid color-mix(in srgb, var(--v3-navy) 28%, transparent)',
          }}
        >
          <Image
            src={photoUrl}
            alt={exteriorSelected ? 'Selected photo (likely exterior)' : 'Selected listing photo'}
            fill
            className="object-cover"
            unoptimized
            style={{ opacity: exteriorSelected ? 0.7 : 1 }}
          />
          {loading ? (
            <div
              className="absolute inset-0 flex items-end p-3"
              style={{ background: 'linear-gradient(transparent 40%, color-mix(in srgb, var(--v3-navy) 72%, transparent))' }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--cream)' }}>
                Restyling as {styleMeta.label}…
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
