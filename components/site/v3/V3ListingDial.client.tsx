'use client'

/**
 * V3ListingDial — one listing large, the rest of the set on a dial beside or
 * under it.
 *
 * Matt 2026-09-23, asked for as an alternative to a carousel: "it would have a
 * primary image and a description, like a primary card. On either the right or
 * left side, there would be a smaller dial with thumbnails of the other photos
 * ... you could go back and forth and scroll up and down. There would be no
 * scrollbars, just the thumbnail ... some kind of indicator of how many total
 * cards are in the dial ... It has to look beautiful and amazing."
 *
 * THE OBJECT. A master-detail gallery, modelled as WAI-ARIA tabs:
 *   - the PRIMARY CARD (role=tabpanel): the lead photograph (SplitCardMedia,
 *     the same media every public listing card uses: badges, in-card tour,
 *     the photo as a door) and the rail card's own copy, printed by
 *     publishListingCardFacts, the one definition HomeRailCardFace prints;
 *   - the DIAL (role=tablist): a thumbnail per listing, with no visible
 *     scrollbar, a navy frame on the one showing, previous/next controls, and
 *     arrow keys, Home and End on a roving tabindex;
 *   - the READOUT: "03 / 12" and a hairline that fills with it, at the head of
 *     the dial.
 *
 * WHERE THE DIAL STANDS (`railPosition`, Matt 2026-09-24). Under the card as a
 * strip (`bottom`, the default), or in a column on the card's `left` or
 * `right`. Matt does not want every dial on the site to turn the same way: a
 * page that stacks several dials gives the i-th one dialRailPositionAt(i)
 * (bottom, left, right, ...), so no two adjacent dials share a position. On a
 * phone every position is a strip under the card. The readout heads the dial
 * in each: over the column, or at the start of the strip.
 *
 * THE RIGHT-HAND COLUMN AND JAX. The site's Jax button (V3DogFloater: fixed,
 * top 50%, right 1rem, 4.25rem wide) passes over a right-hand column wherever
 * the dial runs to the viewport's edge, which is why the left was the only
 * column until 2026-09-24. A right-hand dial measures the button and stops its
 * column short of it (dialEndClearance: the button's width, its offset and a
 * 12px gap), and asks nothing where the dial already ends left of it.
 *
 * The tablist comes before its panels in the DOM, as in the WAI-ARIA tabs
 * pattern, so reading and focus order run dial first, then the card; CSS lays
 * the dial under or right of the card where the position says so.
 *
 * EVERY LISTING IS IN THE SERVED HTML. Every card renders on the server and
 * the ones not showing carry `hidden`, so each listing's <a href> is in the
 * markup a crawler reads, exactly as the ledger rows and the rails left it.
 * A hidden card is served as that door alone (no photograph, no badges, no
 * tour), so the browser fetches no photograph until its card is shown; the
 * two either side of the one showing are warmed in the background so a turn
 * of the dial lands on a loaded photograph.
 *
 * THE CARD'S REEL (Matt 2026-09-24: "have the primary photo come in first;
 * after a second or two, play the video associated with it if there is
 * one"). The photograph shows the moment a card turns up. When the reader
 * rests on it (DIAL_VIDEO_DWELL_MS) with the dial on screen and the tab in
 * front, the dial asks /api/listings/[key]/card-video for that listing's reel
 * (the listing page's own hero reel, never a 3D tour), mounts it muted, inline
 * and looping under the photograph, and fades it in only once it is playing.
 * A turn cancels the wait, the request and the reel at once; a reel that
 * errors or has not started within DIAL_VIDEO_START_TIMEOUT_MS leaves the
 * photograph as it was. One reel plays on the whole page. Reduced motion,
 * Save-Data and 2G never autoplay: the card offers "Play video" instead. A
 * playing reel carries "Pause" (the photograph again) and, for a native
 * <video> only, a sound toggle, as the listing page's hero offers sound only
 * there. The reel is decoration for the tabpanel: aria-hidden and inert, the
 * card's link and copy unchanged. Nothing about it renders on the server.
 *
 * ONE LISTING is the card alone: no dial, no readout, nothing to count.
 *
 * WHAT SITS BESIDE THE DIAL (`onIndexChange`). A figure that belongs to one
 * listing but lives outside its card (a builder's concession, the mark a map
 * rings, the filled rung of a price ladder) follows the dial through the
 * callback, which every turn fires with the new index. Nothing reads the
 * dial's DOM to find out.
 *
 * THE FIRST PAINT (`priority`). A dial that is the page's first large image
 * above the fold (the /price-drops and /open-houses folds) loads its first
 * card's photograph eagerly at high priority; every other dial leaves it lazy,
 * so no dial under a hero competes with the hero's photograph.
 *
 * MOTION. A turn dissolves the outgoing card over the incoming one on the
 * register's entrance duration (--v3-dur-enter, 300ms). Under
 * prefers-reduced-motion the token layer collapses that to nothing and the
 * outgoing card is dropped at once.
 *
 * Every figure is the row's own (CLAUDE.md section 0): the ask and the facts
 * come through the lib publishers, and a row with no ask reads "Price not
 * published", never a seller offer the row does not make. A commercial lease
 * reads its rent with the unit, or "Lease rate not published", under "For
 * lease" (publishListingCardFacts `lease`, dialPriceSlot).
 */
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent,
} from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { SparkSafeImage } from '@/lib/listing/SparkSafeImage'
import {
  LISTING_FIELD_LEAD_PHOTO_SIZE,
  LISTING_ROW_PHOTO_SIZE,
  isSparkListingPhotoUrl,
  listingRowPhotoSrc,
} from '@/lib/listing/row-photo'
import { publishListingCardFacts } from '@/lib/listing/publish-listing-card-facts'
import {
  listingCardVideoCanUnmute,
  listingCardVideoSrc,
  parseListingCardVideo,
  type ListingCardVideo,
} from '@/lib/listing/publish-listing-card-video'
import { propertySubTypeDisplayLabel } from '@/lib/property-type'
import { V3_ROOT_CLASS } from './atoms'
import { V3Icon } from './V3Icon'
import { SplitCardMedia } from './SplitCardMedia'
import type { V3ListingRowData } from './V3ListingRow'
import {
  DIAL_VIDEO_ON_SCREEN_RATIO,
  createDialVideoController,
  createDialVideoCoordinator,
  dialEndClearance,
  dialKeyTarget,
  dialPanelId,
  dialPlayerHandshake,
  dialPlayerSignal,
  dialPlayerSize,
  dialReelAspect,
  dialPosition,
  dialPriceSlot,
  dialRailHorizontal,
  dialRailPosition,
  dialRevealOffset,
  dialStep,
  dialSwipeDelta,
  dialTabId,
  DIAL_THUMB_WHOLE,
  dialThumbCut,
  dialThumbLabel,
  dialVideoAutoplay,
  dialWrap,
  type DialIframeKind,
  type DialRailPosition,
  type DialVideoController,
  type DialVideoEnv,
  type DialVideoState,
} from './V3ListingDial.logic'
import './tokens.css'
import './V3ListingRow.css'
import './V3ListingDial.css'

/**
 * One listing on the dial: the row every listing card prints, plus an
 * optional hint. `hasVideo: false` tells the dial the listing has no reel
 * (its row carries no Videos and no VirtualTours) so it never asks; true or
 * absent, the dial asks when the reader rests on the card.
 */
export type V3ListingDialItem = V3ListingRowData & { hasVideo?: boolean | null }

export type V3ListingDialProps = {
  /** Root id. Tab and card ids derive from it, so it must be unique on the page. */
  id: string
  /** The set's name ("Multifamily homes"). Omit when the enclosing section already names it. */
  heading?: string
  /** 2 for a place page's own inventory, 3 inside a section that already has its h2. */
  headingLevel?: 2 | 3
  /** "3 for sale", under the heading. */
  countLabel?: string | null
  /** The dial's accessible name ("Multifamily homes in River West"). */
  label: string
  listings: readonly V3ListingDialItem[]
  /**
   * Where the thumbnails stand on a wide screen: under the card (`bottom`, the
   * default) or in a column on its `left` or `right`. A page stacking several
   * dials passes dialRailPositionAt(i). A phone always lays a strip under the card.
   */
  railPosition?: DialRailPosition
  /**
   * Called with the new index after every turn (thumbnail, previous/next, an
   * arrow key, Home/End, a swipe), never on mount: the dial always opens on 0.
   * For a figure that belongs to one listing but sits beside the dial rather
   * than in its card (a builder concession, a mark on a map, a price ladder).
   */
  onIndexChange?: (index: number) => void
  /**
   * The first card's photograph loads eagerly at high fetch priority (and is
   * preloaded). Pass it only where this dial is the page's first large image
   * above the fold: the dial is then the page's largest paint, and a lazy
   * photograph there delays it. Anywhere under a hero it would steal the
   * bandwidth the hero's own photograph needs.
   */
  priority?: boolean
  className?: string
}

/** The lead photograph is drawn well past 800px wide on a desktop. */
const LEAD_SIZES = '(max-width: 40rem) 100vw, 58rem'
/** A thumbnail is at most 10rem wide; the 320 bucket is ~2x that. */
const THUMB_SIZES = '(max-width: 40rem) 6rem, 10rem'
/** The outgoing card stays mounted this long: --v3-dur-enter (300ms) plus a frame. */
const LEAVE_MS = 340
const PHONE_QUERY = '(max-width: 40rem)'
const CALM_QUERY = '(prefers-reduced-motion: reduce)'
/** The site's Jax button (V3DogFloater), which a right-hand column must clear. */
const JAX_SELECTOR = '.v3-dog-floater'

function subscribeMedia(query: string) {
  return (onChange: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
    const mq = window.matchMedia(query)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }
}

function readMedia(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false
}

const subscribePhone = subscribeMedia(PHONE_QUERY)
const readPhone = () => readMedia(PHONE_QUERY)
const serverFalse = () => false

type NetworkInformationLike = EventTarget & { saveData?: boolean; effectiveType?: string }

function connectionOf(): NetworkInformationLike | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection ?? null
}

function readVideoEnv(): DialVideoEnv {
  const connection = connectionOf()
  return {
    reducedMotion: readMedia(CALM_QUERY),
    saveData: connection?.saveData ?? null,
    effectiveType: connection?.effectiveType ?? null,
  }
}

/** The page's one reel: every dial on the page shares it (a new reel stops the last). */
const PAGE_REEL = createDialVideoCoordinator()

async function fetchCardReel(key: string, signal: AbortSignal): Promise<ListingCardVideo | null> {
  const res = await fetch(`/api/listings/${encodeURIComponent(key)}/card-video`, { signal })
  // A 503 (a failed read), a 429 (the API limiter) or a 400 is not an answer
  // about the listing: throwing keeps the card on its photograph without the
  // controller recording "no reel", so the next rest asks again.
  if (!res.ok) throw new Error(`card-video ${res.status}`)
  const body = (await res.json()) as { video?: unknown }
  return parseListingCardVideo(body?.video)
}

/** The kind line: an MLS sub type worth naming ("Duplex", "Condominium"). */
function subTypeLabel(raw: string | null): string | null {
  // The default kind ("Single Family Residence") names nothing the section
  // heading has not already said, so it is the one sub type left unprinted.
  if (/^single family residence$/i.test((raw ?? '').trim())) return null
  return propertySubTypeDisplayLabel(raw) || null
}

function thumbSrc(listing: V3ListingRowData): string | null {
  const raw = listing.photoUrl?.trim()
  return raw ? listingRowPhotoSrc(raw, LISTING_ROW_PHOTO_SIZE) : null
}

function leadSrc(listing: V3ListingRowData): string | null {
  const raw = listing.photoUrl?.trim()
  return raw ? listingRowPhotoSrc(raw, LISTING_FIELD_LEAD_PHOTO_SIZE) : null
}

function factsOf(listing: V3ListingRowData) {
  return publishListingCardFacts({
    price: listing.price,
    propertyType: listing.propertyType,
    propertySubType: listing.propertySubType,
    subdivisionName: listing.subdivisionName,
    city: listing.city,
    listNumber: listing.listNumber,
    beds: listing.beds,
    baths: listing.baths,
    sqft: listing.sqft,
    pricePerSqft: listing.pricePerSqft ?? null,
    statusLabel: listing.statusLabel ?? null,
    leaseRateOption: listing.leaseRateOption ?? null,
  })
}

/* Iconoir 7.12.1 (MIT) media marks, drawn as V3Icon draws the house set:
   24 grid, currentColor, stroke 1.5. Only this client island needs them. */
const MEDIA_ICONS = {
  Play: [
    'M6.90588 4.53682C6.50592 4.2998 6 4.58808 6 5.05299V18.947C6 19.4119 6.50592 19.7002 6.90588 19.4632L18.629 12.5162C19.0211 12.2838 19.0211 11.7162 18.629 11.4838L6.90588 4.53682Z',
  ],
  Pause: [
    'M6 18.4V5.6C6 5.26863 6.26863 5 6.6 5H9.4C9.73137 5 10 5.26863 10 5.6V18.4C10 18.7314 9.73137 19 9.4 19H6.6C6.26863 19 6 18.7314 6 18.4Z',
    'M14 18.4V5.6C14 5.26863 14.2686 5 14.6 5H17.4C17.7314 5 18 5.26863 18 5.6V18.4C18 18.7314 17.7314 19 17.4 19H14.6C14.2686 19 14 18.7314 14 18.4Z',
  ],
  SoundHigh: [
    'M1 13.8571V10.1429C1 9.03829 1.89543 8.14286 3 8.14286H5.9C6.09569 8.14286 6.28708 8.08544 6.45046 7.97772L12.4495 4.02228C13.1144 3.5839 14 4.06075 14 4.85714V19.1429C14 19.9392 13.1144 20.4161 12.4495 19.9777L6.45046 16.0223C6.28708 15.9146 6.09569 15.8571 5.9 15.8571H3C1.89543 15.8571 1 14.9617 1 13.8571Z',
    'M17.5 7.5C17.5 7.5 19 9 19 11.5C19 14 17.5 15.5 17.5 15.5',
    'M20.5 4.5C20.5 4.5 23 7 23 11.5C23 16 20.5 18.5 20.5 18.5',
  ],
  SoundOff: [
    'M18 14L20.0005 12M22 10L20.0005 12M20.0005 12L18 10M20.0005 12L22 14',
    'M2 13.8571V10.1429C2 9.03829 2.89543 8.14286 4 8.14286H6.9C7.09569 8.14286 7.28708 8.08544 7.45046 7.97772L13.4495 4.02228C14.1144 3.5839 15 4.06075 15 4.85714V19.1429C15 19.9392 14.1144 20.4161 13.4495 19.9777L7.45046 16.0223C7.28708 15.9146 7.09569 15.8571 6.9 15.8571H4C2.89543 15.8571 2 14.9617 2 13.8571Z',
  ],
} as const

function MediaIcon({ name }: { name: keyof typeof MEDIA_ICONS }) {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden="true" focusable="false">
      {MEDIA_ICONS[name].map((d) => (
        <path key={d} d={d} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

type ReelCallbacks = {
  /** Bound to the reel they were made for: a stale report from an unmounted reel is ignored. */
  onStarted: (video: ListingCardVideo) => void
  onFailed: (video: ListingCardVideo) => void
  /** The browser refused autoplay: offer "Play video" instead of dropping the reel. */
  onBlocked: (video: ListingCardVideo) => void
  /** The player is ready (a hosted player said so; a file has its metadata). */
  onReady: (video: ListingCardVideo) => void
}

/** A progressive file in a native <video>: muted, inline, looping, no controls. */
function ReelFile({
  video,
  muted,
  onStarted,
  onFailed,
  onBlocked,
  onReady,
}: ReelCallbacks & { video: ListingCardVideo; muted: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const src = listingCardVideoSrc(video)

  useEffect(() => {
    const el = ref.current
    if (!el || !src) {
      if (!src) onFailed(video)
      return
    }
    // The cleanup below empties the element to stop its download; an effect
    // that runs again on the same element (React's development double run)
    // puts the source back rather than playing nothing.
    if (el.getAttribute('src') !== src) el.src = src
    // React does not reflect `muted` as an attribute; autoplay needs the property set first.
    el.muted = true
    el.defaultMuted = true
    const attempt = el.play()
    if (attempt) {
      attempt.catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : ''
        // An AbortError is this element being paused or unmounted, not a failure.
        if (name === 'AbortError') return
        // NotAllowedError: the browser will not autoplay here (iOS Low Power
        // Mode refuses even muted video). The reel is fine; the reader can start it.
        if (name === 'NotAllowedError') onBlocked(video)
        else onFailed(video)
      })
    }
    return () => {
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
  }, [src, video, onFailed, onBlocked])

  useEffect(() => {
    if (ref.current) ref.current.muted = muted
  }, [muted])

  if (!src) return null
  return (
    <video
      ref={ref}
      src={src}
      muted
      autoPlay
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      disableRemotePlayback
      tabIndex={-1}
      onLoadedMetadata={() => onReady(video)}
      onPlaying={() => onStarted(video)}
      onError={() => onFailed(video)}
    />
  )
}

/** YouTube, Vimeo or Stream in an iframe, faded in only when the player reports playback. */
function ReelFrame({
  video,
  title,
  onStarted,
  onFailed,
  onReady,
}: ReelCallbacks & { video: ListingCardVideo; title: string }) {
  const ref = useRef<HTMLIFrameElement | null>(null)
  const answered = useRef(false)
  const size = useRef<{ width?: number; height?: number }>({})
  const [aspect, setAspect] = useState(dialReelAspect(null, null))
  const kind = video.kind as DialIframeKind
  const src = useMemo(
    () => (typeof window === 'undefined' ? null : listingCardVideoSrc(video, window.location.origin)),
    [video],
  )
  const origin = useMemo(() => {
    try {
      return src ? new URL(src).origin : null
    } catch {
      return null
    }
  }, [src])

  const post = useCallback(
    (messages: unknown[]) => {
      const target = ref.current?.contentWindow
      if (!target || !origin) return
      for (const message of messages) target.postMessage(message, origin)
    },
    [origin],
  )

  useEffect(() => {
    if (!src) {
      onFailed(video)
      return
    }
    answered.current = false
    const onMessage = (event: MessageEvent) => {
      if (!ref.current || event.source !== ref.current.contentWindow) return
      answered.current = true
      const reported = dialPlayerSize(kind, event.data)
      if (reported) {
        size.current = { ...size.current, ...reported }
        const next = dialReelAspect(size.current.width, size.current.height)
        setAspect((prev) => (Math.abs(prev - next) < 0.001 ? prev : next))
      }
      const signal = dialPlayerSignal(kind, event.data)
      if (signal === 'ready') {
        onReady(video)
        post(dialPlayerHandshake(kind, 'ready'))
      } else if (signal === 'playing') onStarted(video)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [src, kind, video, post, onStarted, onFailed, onReady])

  // YouTube answers only a page that says it is listening, and may not be
  // ready for the first word: repeat it until the player speaks.
  const onLoad = useCallback(() => {
    post(dialPlayerHandshake(kind, 'load'))
    if (kind !== 'youtube') return
    let tries = 0
    const tick = () => {
      if (answered.current || tries >= 12 || !ref.current) return
      tries += 1
      post(dialPlayerHandshake(kind, 'load'))
      window.setTimeout(tick, 250)
    }
    window.setTimeout(tick, 250)
  }, [kind, post])

  if (!src) return null
  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      tabIndex={-1}
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      onLoad={onLoad}
      // The reel's shape, so the stylesheet sizes the frame to cover the
      // photograph's box with the reel (one element on the page, client only).
      style={{ '--v3-dial-reel-ar': aspect } as CSSProperties}
    />
  )
}

type ReelProps = ReelCallbacks & {
  state: DialVideoState<ListingCardVideo>
  addressLine: string
  onPlay: () => void
  onPause: () => void
}

/** The reel under the photograph, and the reader's two controls over it. */
function DialReel({ state, addressLine, onStarted, onFailed, onBlocked, onReady, onPlay, onPause }: ReelProps) {
  const { stage, video } = state
  // Every reel starts silent (the dial keys this component by the reel, so a
  // new reel is a new `muted`): sound is the reader's choice, per reel.
  const [muted, setMuted] = useState(true)
  const mounted = video != null && (stage === 'starting' || stage === 'playing')
  const canUnmute = video != null && listingCardVideoCanUnmute(video)
  const place = addressLine.trim() || 'this home'

  return (
    <>
      {mounted ? (
        <div
          className={cn('v3-dial__reel', stage === 'playing' && 'is-playing')}
          aria-hidden="true"
          inert
          data-reel-kind={video.kind}
        >
          {video.kind === 'file' ? (
            <ReelFile
              video={video}
              muted={muted}
              onStarted={onStarted}
              onFailed={onFailed}
              onBlocked={onBlocked}
              onReady={onReady}
            />
          ) : (
            <ReelFrame
              video={video}
              title={`Video of ${place}`}
              onStarted={onStarted}
              onFailed={onFailed}
              onBlocked={onBlocked}
              onReady={onReady}
            />
          )}
        </div>
      ) : null}
      {stage === 'offer' || stage === 'playing' ? (
        <div className="v3-dial__reel-controls">
          {stage === 'playing' && canUnmute ? (
            <button
              type="button"
              className="v3-dial__reel-btn"
              aria-pressed={!muted}
              aria-label="Sound"
              onClick={() => setMuted((m) => !m)}
            >
              <span className="v3-dial__reel-badge v3-dial__reel-badge--icon">
                <MediaIcon name={muted ? 'SoundOff' : 'SoundHigh'} />
              </span>
            </button>
          ) : null}
          {stage === 'offer' ? (
            <button
              type="button"
              className="v3-dial__reel-btn"
              aria-label={`Play video of ${place}`}
              onClick={onPlay}
            >
              <span className="v3-dial__reel-badge">
                <MediaIcon name="Play" />
                <span>Play video</span>
              </span>
            </button>
          ) : (
            <button type="button" className="v3-dial__reel-btn" aria-label="Pause video" onClick={onPause}>
              <span className="v3-dial__reel-badge">
                <MediaIcon name="Pause" />
                <span>Pause</span>
              </span>
            </button>
          )}
        </div>
      ) : null}
    </>
  )
}

const NO_REEL: DialVideoState<ListingCardVideo> = { key: null, stage: 'photo', video: null }

type CardProps = {
  listing: V3ListingDialItem
  panelId: string
  tabId: string | null
  shown: boolean
  leaving: boolean
  /** The first card of a dial that is the page's first large image: its photograph is not lazy. */
  priority?: boolean
  /** The shown card's reel and its controls; every other card has none. */
  reel?: ReactNode
  /** The shown card hands its media clicks to the dial (the in-card 3D tour takes the media from the reel). */
  onMediaClickCapture?: (event: ReactMouseEvent<HTMLDivElement>) => void
}

/** The primary card: the lead photograph and the rail card's copy. */
const DialCard = memo(function DialCard({
  listing,
  panelId,
  tabId,
  shown,
  leaving,
  priority,
  reel,
  onMediaClickCapture,
}: CardProps) {
  const facts = factsOf(listing)
  const price = dialPriceSlot(facts)
  const photo = listing.photoUrl?.trim() || null
  // A lease leads its kind line with "For lease", where a sale listing has no
  // status word: the label is the lease's, from publishListingCardFacts.
  const kind = [facts.lease?.label, subTypeLabel(listing.propertySubType), facts.kind]
    .filter(Boolean)
    .join(' · ')
  const tags = listing.badges ?? (listing.badge ? [listing.badge] : [])
  const visible = shown || leaving
  const askClass = cn('v3-dial__ask', price.withheld && 'v3-dial__ask--none')
  const meta = facts.meta.length > 0 ? facts.meta.join(' · ') : null
  if (!visible) {
    // A card that is not showing is served as its door alone: the <a href>
    // with the ask, the facts and the street a crawler reads (and the ids the
    // tabs point at). Its photograph, badges and tour mount when it turns up
    // (the neighbours' photographs are warmed into the cache beforehand), so
    // a long dial does not serve a second photograph and a second copy of
    // every URL per listing (2,124 B of HTML per listing before, 2026-09-24).
    return (
      <div id={panelId} role={tabId ? 'tabpanel' : undefined} aria-labelledby={tabId ?? undefined} hidden className="v3-dial__card">
        <Link href={listing.href} className="v3-dial__copy">
          {kind ? <span className="v3-dial__kind">{kind}</span> : null}
          <span className={askClass}>{price.text}</span>
          {meta ? <span className="v3-dial__meta">{meta}</span> : null}
          <span className="v3-dial__addr">{listing.addressLine}</span>
          <span className="v3-dial__city">{listing.cityLine}</span>
        </Link>
      </div>
    )
  }
  return (
    <div
      id={panelId}
      role={tabId ? 'tabpanel' : undefined}
      aria-labelledby={tabId ?? undefined}
      aria-hidden={leaving ? true : undefined}
      inert={leaving || undefined}
      className={cn('v3-dial__card', leaving && 'is-leaving')}
    >
      <div className="v3-dial__media" onClickCapture={onMediaClickCapture}>
        <SplitCardMedia
          urls={photo ? [photo] : []}
          tags={tags}
          hasTour={listing.hasTour ?? Boolean(listing.tourUrl)}
          tourUrl={listing.tourUrl ?? null}
          // The listing's own tour type, in the listing page's words: a
          // walkthrough reel is "Video Tour", a 3D tour is "3D". SplitCardMedia
          // reads it off the tour URL (publishListingTourLabel) unless the row
          // already carries it.
          tourLabel={listing.tourLabel ?? undefined}
          addressLine={listing.addressLine}
          sizes={LEAD_SIZES}
          priority={priority}
          href={listing.href}
        />
        {photo ? null : (
          <Link href={listing.href} className="v3-dial__nophoto" tabIndex={-1} aria-hidden="true">
            No photo published
          </Link>
        )}
        {reel}
      </div>
      <Link href={listing.href} className="v3-dial__copy">
        <span className="v3-dial__figures">
          {kind ? <span className="v3-dial__kind">{kind}</span> : null}
          <span className={askClass}>{price.text}</span>
          {meta ? <span className="v3-dial__meta">{meta}</span> : null}
        </span>
        <span className="v3-dial__where">
          <span className="v3-dial__addr">{listing.addressLine}</span>
          <span className="v3-dial__city">{listing.cityLine}</span>
          <span className="v3-dial__open">
            See this listing
            <V3Icon name="ArrowRight" size={16} className="v3-dial__open-icon" />
          </span>
        </span>
      </Link>
    </div>
  )
})

type ThumbProps = {
  listing: V3ListingDialItem
  index: number
  dialId: string
  selected: boolean
  onSelect: (index: number) => void
  onWarm: (index: number) => void
  setRef: (index: number, el: HTMLButtonElement | null) => void
}

const DialThumb = memo(function DialThumb({
  listing,
  index,
  dialId,
  selected,
  onSelect,
  onWarm,
  setRef,
}: ThumbProps) {
  const price = dialPriceSlot(factsOf(listing))
  const src = thumbSrc(listing)
  return (
    <button
      ref={(el) => setRef(index, el)}
      type="button"
      role="tab"
      id={dialTabId(dialId, index)}
      aria-selected={selected}
      aria-controls={dialPanelId(dialId, index)}
      aria-label={dialThumbLabel(listing.addressLine, price.text)}
      tabIndex={selected ? 0 : -1}
      className="v3-dial__thumb"
      onClick={() => onSelect(index)}
      onPointerEnter={() => onWarm(index)}
      onFocus={() => onWarm(index)}
    >
      <span className="v3-dial__thumb-media">
        {src && isSparkListingPhotoUrl(src) ? (
          // A Spark plate is already the 320 thumbnail and skips the image
          // optimizer either way; a plain <img> sized by the stylesheet saves
          // next/image's inline style on every thumbnail in the served HTML.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="v3-dial__thumb-img" src={src} alt="" loading="lazy" />
        ) : src ? (
          <SparkSafeImage src={src} alt="" fill sizes={THUMB_SIZES} />
        ) : (
          <span className="v3-dial__thumb-none">No photo</span>
        )}
      </span>
      <span className="v3-dial__thumb-cap">
        <span className="v3-dial__thumb-ask">{price.text}</span>
        <span className="v3-dial__thumb-addr">{listing.addressLine}</span>
      </span>
    </button>
  )
})

export function V3ListingDial({
  id,
  heading,
  headingLevel = 2,
  countLabel,
  label,
  listings,
  railPosition,
  onIndexChange,
  priority = false,
  className,
}: V3ListingDialProps) {
  const count = listings.length
  const multi = count > 1
  const rail = dialRailPosition(railPosition)
  const [index, setIndex] = useState(0)
  // The latest callback, read at turn time, so `select` stays stable while a
  // caller passes a fresh function on every render.
  const onIndexChangeRef = useRef(onIndexChange)
  useEffect(() => {
    onIndexChangeRef.current = onIndexChange
  }, [onIndexChange])
  const [leaving, setLeaving] = useState<number | null>(null)
  const [live, setLive] = useState('')
  const [edges, setEdges] = useState({ before: false, after: false })
  const [endClear, setEndClear] = useState(0)
  const [reel, setReel] = useState(NO_REEL)
  const indexRef = useRef(0)
  const leaveTimer = useRef<number | undefined>(undefined)
  const rootRef = useRef<HTMLElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const warmed = useRef(new Set<string>())
  const touch = useRef<{ x: number; y: number } | null>(null)
  const turned = useRef(false)
  const reelCtl = useRef<DialVideoController<ListingCardVideo> | null>(null)
  const phone = useSyncExternalStore(subscribePhone, readPhone, serverFalse)
  const horizontal = dialRailHorizontal(rail, phone)

  const warm = useCallback(
    (at: number) => {
      if (count < 1) return
      const listing = listings[dialWrap(at, count)]
      const src = listing ? leadSrc(listing) : null
      // Only a Spark photo is fetched at exactly this URL by the card (it skips
      // /_next/image); warming any other source would fetch a second copy.
      if (!src || !isSparkListingPhotoUrl(src) || warmed.current.has(src)) return
      warmed.current.add(src)
      const img = new window.Image()
      img.decoding = 'async'
      img.src = src
    },
    [count, listings],
  )

  const select = useCallback(
    (next: number, announce: boolean) => {
      if (count < 2) return
      const target = dialWrap(next, count)
      const current = indexRef.current
      if (target === current) return
      indexRef.current = target
      turned.current = true
      window.clearTimeout(leaveTimer.current)
      if (readMedia(CALM_QUERY)) {
        setLeaving(null)
      } else {
        setLeaving(current)
        leaveTimer.current = window.setTimeout(() => setLeaving(null), LEAVE_MS)
      }
      setIndex(target)
      onIndexChangeRef.current?.(target)
      warm(target + 1)
      warm(target - 1)
      if (announce) {
        const pos = dialPosition(target, count)
        const listing = listings[target]
        if (pos && listing) {
          setLive(
            `${pos.shown} of ${pos.count}. ${dialThumbLabel(listing.addressLine, dialPriceSlot(factsOf(listing)).text)}`,
          )
        }
      }
    },
    // The setters are stable; naming them keeps the hooks linter's compiler pass
    // from reading this memo as unpreservable.
    [count, listings, warm, setIndex, setLeaving, setLive],
  )

  const selectFromThumb = useCallback((at: number) => select(at, false), [select])
  const setTabRef = useCallback((at: number, el: HTMLButtonElement | null) => {
    tabs.current[at] = el
  }, [])

  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])

  // The card's reel: one controller per dial, all of them on the page's one
  // reel, following the reader's reduced-motion and Save-Data settings.
  useEffect(() => {
    const ctl = createDialVideoController<ListingCardVideo>({
      lookup: fetchCardReel,
      coordinator: PAGE_REEL,
      onChange: setReel,
      autoplay: dialVideoAutoplay(readVideoEnv()),
    })
    reelCtl.current = ctl
    const onEnv = () => ctl.setAutoplay(dialVideoAutoplay(readVideoEnv()))
    const calm = typeof window.matchMedia === 'function' ? window.matchMedia(CALM_QUERY) : null
    const connection = connectionOf()
    calm?.addEventListener('change', onEnv)
    connection?.addEventListener?.('change', onEnv)
    return () => {
      calm?.removeEventListener('change', onEnv)
      connection?.removeEventListener?.('change', onEnv)
      ctl.destroy()
      reelCtl.current = null
    }
  }, [])

  // Every turn (thumbnail, step, key, swipe) lands here: the photograph now,
  // the reel only after the dwell.
  const shownKey = listings[dialWrap(index, count)]?.listingKey ?? null
  const shownHint = listings[dialWrap(index, count)]?.hasVideo
  useEffect(() => {
    reelCtl.current?.select(shownKey, shownHint)
  }, [shownKey, shownHint])

  // The reel runs only while the card is on screen and the tab is in front.
  useEffect(() => {
    const stage = stageRef.current
    const ctl = reelCtl.current
    if (!stage || !ctl || typeof IntersectionObserver === 'undefined') return
    let onScreen = false
    const update = () => ctl.setEligible(onScreen && document.visibilityState === 'visible')
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          onScreen = entry.isIntersecting && entry.intersectionRatio >= DIAL_VIDEO_ON_SCREEN_RATIO - 0.001
        }
        update()
      },
      { threshold: [0, DIAL_VIDEO_ON_SCREEN_RATIO, 1] },
    )
    io.observe(stage)
    document.addEventListener('visibilitychange', update)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', update)
      ctl.setEligible(false)
    }
  }, [])

  const onReelStarted = useCallback((video: ListingCardVideo) => {
    const ctl = reelCtl.current
    if (ctl && ctl.state().video === video) ctl.started()
  }, [])
  const onReelFailed = useCallback((video: ListingCardVideo) => {
    const ctl = reelCtl.current
    if (ctl && ctl.state().video === video) ctl.failed()
  }, [])
  const onReelReady = useCallback((video: ListingCardVideo) => {
    const ctl = reelCtl.current
    if (ctl && ctl.state().video === video) ctl.ready()
  }, [])
  const onReelBlocked = useCallback((video: ListingCardVideo) => {
    const ctl = reelCtl.current
    if (ctl && ctl.state().video === video) ctl.blocked()
  }, [])
  const onReelPlay = useCallback(() => reelCtl.current?.play(), [])
  const onReelPause = useCallback(() => reelCtl.current?.pause(), [])
  // The in-card 3D tour takes the card's media: the reel steps aside until the next turn.
  const onMediaClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as Element | null
    if (target?.closest?.('.v3-lrow__tour')) reelCtl.current?.suspend()
  }, [])

  // Warm the neighbours once the dial is near the viewport, not at page load.
  useEffect(() => {
    const root = rootRef.current
    if (!multi || !root || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        warm(indexRef.current + 1)
        warm(indexRef.current - 1)
        io.disconnect()
      },
      { rootMargin: '400px 0px' },
    )
    io.observe(root)
    return () => io.disconnect()
  }, [multi, warm])

  // The Jax button (fixed at the right edge, mid-screen) passes over whatever
  // runs along the dial's right edge as the page scrolls. dialEndClearance
  // measures how far the dial runs under it; the stylesheet keeps every
  // control out of that band: a right-hand column stops short of it, a strip
  // (the bottom rail, and every rail at 375) ends before it, the phone's
  // "01 / 12" stands left of it, and the reel's controls sit inside it.
  // Measured, because where the dial ends depends on the band it sits in.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let frame = 0
    const measure = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const jax = document.querySelector(JAX_SELECTOR)?.getBoundingClientRect()
        const clear = dialEndClearance(
          root.getBoundingClientRect().right,
          jax && jax.width > 0 ? jax.left : null,
        )
        setEndClear((prev) => (prev === clear ? prev : clear))
      })
    }
    measure()
    // The button is a client island of its own and may mount after the dial.
    const late = window.setTimeout(measure, 1200)
    window.addEventListener('resize', measure)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(root)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(late)
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [])

  // Which ends of the rail have more thumbnails past them: the rail has no
  // scrollbar, so a soft fade at that end is the only sign there is more.
  const readEdges = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const pos = horizontal ? el.scrollLeft : el.scrollTop
    const view = horizontal ? el.clientWidth : el.clientHeight
    const size = horizontal ? el.scrollWidth : el.scrollHeight
    const next = { before: pos > 1, after: pos + view < size - 1 }
    setEdges((prev) => (prev.before === next.before && prev.after === next.after ? prev : next))
  }, [horizontal, setEdges])

  useEffect(() => {
    const el = scrollerRef.current
    if (!multi || !el) return
    readEdges()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(readEdges)
    ro.observe(el)
    return () => ro.disconnect()
  }, [multi, readEdges])

  // A thumbnail the rail's edge cuts through keeps its photograph under the
  // fade (the sign there is more) and drops its caption: a price cut off
  // mid-string ("$1.00/" at 375, taste evaluator 2026-09-23) is not a price.
  // The attribute is the observer's alone; React never renders it.
  useEffect(() => {
    const root = scrollerRef.current
    if (!multi || !root || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.toggleAttribute('data-clipped', dialThumbCut(entry.intersectionRatio))
        }
      },
      { root, threshold: [0, DIAL_THUMB_WHOLE, 1] },
    )
    for (const tab of tabs.current.slice(0, count)) if (tab) io.observe(tab)
    return () => io.disconnect()
  }, [multi, count, listings, horizontal])

  // Keep the selected thumbnail whole inside the rail. The rail scrolls on its
  // own; the page never moves because a thumbnail was chosen.
  useEffect(() => {
    if (!turned.current) return
    const el = scrollerRef.current
    const tab = tabs.current[index]
    if (!el || !tab) return
    // A near turn glides; a long jump (End, Home, a wrap from last to first)
    // lands at once rather than spinning the dial past every home between.
    const behaviorFor = (from: number, to: number, view: number): ScrollBehavior =>
      readMedia(CALM_QUERY) || Math.abs(to - from) > view * 2 ? 'auto' : 'smooth'
    if (horizontal) {
      const left = dialRevealOffset(el.scrollLeft, el.clientWidth, tab.offsetLeft, tab.offsetWidth)
      if (left !== el.scrollLeft) {
        el.scrollTo({ left, behavior: behaviorFor(el.scrollLeft, left, el.clientWidth) })
      }
    } else {
      const top = dialRevealOffset(el.scrollTop, el.clientHeight, tab.offsetTop, tab.offsetHeight)
      if (top !== el.scrollTop) {
        el.scrollTo({ top, behavior: behaviorFor(el.scrollTop, top, el.clientHeight) })
      }
    }
  }, [index, horizontal])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = dialKeyTarget(event.key, indexRef.current, count)
    if (target == null) return
    event.preventDefault()
    select(target, false)
    tabs.current[target]?.focus({ preventScroll: true })
  }

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const t = event.changedTouches[0]
    touch.current = t ? { x: t.clientX, y: t.clientY } : null
  }

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touch.current
    touch.current = null
    const t = event.changedTouches[0]
    if (!multi || !start || !t) return
    const delta = dialSwipeDelta(t.clientX - start.x, t.clientY - start.y)
    if (delta !== 0) select(indexRef.current + delta, true)
  }

  const pos = dialPosition(index, count)
  const Heading = headingLevel === 3 ? 'h3' : 'h2'
  const headingId = `${id}-heading`
  const Root = heading ? 'section' : 'div'
  // Where the stylesheet spends the clearance depends on the layout; the
  // measure is the same for all of them.
  const rootStyle = endClear > 0 ? ({ '--v3-dial-end-clear': `${endClear}px` } as CSSProperties) : undefined

  return (
    <Root
      ref={(el: HTMLElement | null) => {
        rootRef.current = el
      }}
      id={id}
      className={cn(
        V3_ROOT_CLASS,
        'v3-dial',
        multi ? 'v3-dial--multi' : 'v3-dial--single',
        multi && `v3-dial--rail-${rail}`,
        className,
      )}
      style={rootStyle}
      aria-labelledby={heading ? headingId : undefined}
      data-rail={multi ? rail : undefined}
    >
      {heading || countLabel || pos ? (
        <div className="v3-dial__head">
          <div className="v3-dial__title">
            {heading ? (
              <Heading id={headingId} className={cn('v3-dial__heading', `v3-dial__heading--${headingLevel}`)}>
                {heading}
              </Heading>
            ) : null}
            {countLabel ? <p className="v3-dial__count">{countLabel}</p> : null}
          </div>
          {pos ? (
            <p className="v3-dial__pos" aria-hidden="true">
              <span className="v3-dial__pos-figure">
                <span className="v3-dial__pos-now">{pos.now}</span>
                <span className="v3-dial__pos-of">{` / ${pos.total}`}</span>
              </span>
              <span
                className="v3-dial__pos-rule"
                style={{ '--v3-dial-p': `${(pos.fraction * 100).toFixed(2)}%` } as CSSProperties}
              />
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="v3-dial__body">
        {/* The dial first, its panels after (the WAI-ARIA tabs order): CSS lays
            it under the card, or in a column on the card's left or right, and
            under the card as a strip on every phone. */}
        {multi ? (
          <div className="v3-dial__rail">
            <div className="v3-dial__rail-frame">
              <button
                type="button"
                className="v3-dial__step v3-dial__step--prev"
                aria-label="Previous listing"
                aria-controls={`${id}-thumbs`}
                onClick={() => select(dialStep(indexRef.current, -1, count), true)}
              >
                <V3Icon name="NavArrowDown" size={20} className="v3-dial__step-icon" />
              </button>
              <div
                ref={scrollerRef}
                id={`${id}-thumbs`}
                className="v3-dial__thumbs"
                role="tablist"
                aria-label={label}
                aria-orientation={horizontal ? 'horizontal' : 'vertical'}
                data-more-before={edges.before ? '' : undefined}
                data-more-after={edges.after ? '' : undefined}
                onKeyDown={onKeyDown}
                onScroll={readEdges}
              >
                {listings.map((listing, i) => (
                  <DialThumb
                    key={listing.listingKey}
                    listing={listing}
                    index={i}
                    dialId={id}
                    selected={i === index}
                    onSelect={selectFromThumb}
                    onWarm={warm}
                    setRef={setTabRef}
                  />
                ))}
              </div>
              <button
                type="button"
                className="v3-dial__step v3-dial__step--next"
                aria-label="Next listing"
                aria-controls={`${id}-thumbs`}
                onClick={() => select(dialStep(indexRef.current, 1, count), true)}
              >
                <V3Icon name="NavArrowDown" size={20} className="v3-dial__step-icon" />
              </button>
            </div>
          </div>
        ) : null}
        <div ref={stageRef} className="v3-dial__stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {listings.map((listing, i) => {
            const shown = i === index
            const own = shown && reel.key === listing.listingKey
            return (
              <DialCard
                key={listing.listingKey}
                listing={listing}
                panelId={dialPanelId(id, i)}
                tabId={multi ? dialTabId(id, i) : null}
                shown={shown}
                leaving={multi && leaving === i && i !== index}
                priority={priority && i === 0}
                reel={
                  own && reel.stage !== 'photo' ? (
                    <DialReel
                      key={`${listing.listingKey}:${reel.video?.url ?? ''}`}
                      state={reel}
                      addressLine={listing.addressLine}
                      onStarted={onReelStarted}
                      onFailed={onReelFailed}
                      onBlocked={onReelBlocked}
                      onReady={onReelReady}
                      onPlay={onReelPlay}
                      onPause={onReelPause}
                    />
                  ) : null
                }
                onMediaClickCapture={shown ? onMediaClickCapture : undefined}
              />
            )
          })}
        </div>
      </div>

      {multi ? (
        <p className="v3-dial__live" aria-live="polite" aria-atomic="true">
          {live}
        </p>
      ) : null}
    </Root>
  )
}
