'use client'

/**
 * V3ListingDial — one listing large, the rest of the set on a dial to its left.
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
 *   - the DIAL (role=tablist): a thumbnail per listing, stacked in a column on
 *     the LEFT of the card on a wide screen and laid in a strip under it on a
 *     phone, with no visible scrollbar, a navy frame on the one showing,
 *     previous/next controls, and arrow keys, Home and End on a roving
 *     tabindex;
 *   - the READOUT: "03 / 12" and a hairline that fills with it, at the head of
 *     the dial's column on a wide screen and beside the heading on a phone.
 *
 * WHY THE LEFT (Matt 2026-09-23, either side allowed). The site's Jax button
 * (V3DogFloater: fixed, top 50%, right 1rem) sat over a right-hand rail
 * wherever the dial runs to the viewport's edge (the neighborhood band at
 * 1440, the plat inventory at laptop widths), so at almost every scroll
 * position through the dial a thumbnail or a control was under it. A column
 * of thumbnails on the left of the lead photograph is also the familiar
 * product-gallery arrangement. The tablist comes before its panels in the
 * DOM, as in the WAI-ARIA tabs pattern, so reading and focus order run
 * dial first, then the card, the order a wide screen shows them; on a phone
 * the strip is laid under the card by CSS and keeps that same order.
 *
 * EVERY LISTING IS IN THE SERVED HTML. Every card renders on the server and
 * the ones not showing carry `hidden`, so each listing's <a href> is in the
 * markup a crawler reads, exactly as the ledger rows and the rails left it.
 * A hidden card's photograph is lazy, so the browser fetches none of them
 * until that card is shown; the two either side of the one showing are warmed
 * in the background so a turn of the dial lands on a loaded photograph.
 *
 * ONE LISTING is the card alone: no dial, no readout, nothing to count.
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
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
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
import { propertySubTypeDisplayLabel } from '@/lib/property-type'
import { V3_ROOT_CLASS } from './atoms'
import { V3Icon } from './V3Icon'
import { SplitCardMedia } from './SplitCardMedia'
import type { V3ListingRowData } from './V3ListingRow'
import {
  dialKeyTarget,
  dialPanelId,
  dialPosition,
  dialPriceSlot,
  dialRevealOffset,
  dialStep,
  dialSwipeDelta,
  dialTabId,
  DIAL_THUMB_WHOLE,
  dialThumbCut,
  dialThumbLabel,
  dialWrap,
} from './V3ListingDial.logic'
import './tokens.css'
import './V3ListingRow.css'
import './V3ListingDial.css'

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
  listings: readonly V3ListingRowData[]
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

type CardProps = {
  listing: V3ListingRowData
  panelId: string
  tabId: string | null
  shown: boolean
  leaving: boolean
}

/** The primary card: the lead photograph and the rail card's copy. */
const DialCard = memo(function DialCard({ listing, panelId, tabId, shown, leaving }: CardProps) {
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
  return (
    <div
      id={panelId}
      role={tabId ? 'tabpanel' : undefined}
      aria-labelledby={tabId ?? undefined}
      aria-hidden={leaving ? true : undefined}
      inert={leaving || undefined}
      hidden={!visible}
      className={cn('v3-dial__card', leaving && 'is-leaving')}
    >
      <div className="v3-dial__media">
        <SplitCardMedia
          urls={photo ? [photo] : []}
          tags={tags}
          hasTour={listing.hasTour ?? Boolean(listing.tourUrl)}
          tourUrl={listing.tourUrl ?? null}
          addressLine={listing.addressLine}
          sizes={LEAD_SIZES}
          href={listing.href}
        />
        {photo ? null : (
          <Link href={listing.href} className="v3-dial__nophoto" tabIndex={-1} aria-hidden="true">
            No photo published
          </Link>
        )}
      </div>
      <Link href={listing.href} className="v3-dial__copy">
        <span className="v3-dial__figures">
          {kind ? <span className="v3-dial__kind">{kind}</span> : null}
          <span className={cn('v3-dial__ask', price.withheld && 'v3-dial__ask--none')}>{price.text}</span>
          {facts.meta.length > 0 ? <span className="v3-dial__meta">{facts.meta.join(' · ')}</span> : null}
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
  listing: V3ListingRowData
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
        {src ? (
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
  className,
}: V3ListingDialProps) {
  const count = listings.length
  const multi = count > 1
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState<number | null>(null)
  const [live, setLive] = useState('')
  const [edges, setEdges] = useState({ before: false, after: false })
  const indexRef = useRef(0)
  const leaveTimer = useRef<number | undefined>(undefined)
  const rootRef = useRef<HTMLElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const warmed = useRef(new Set<string>())
  const touch = useRef<{ x: number; y: number } | null>(null)
  const turned = useRef(false)
  const phone = useSyncExternalStore(subscribePhone, readPhone, serverFalse)

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
    [count, listings, warm],
  )

  const selectFromThumb = useCallback((at: number) => select(at, false), [select])
  const setTabRef = useCallback((at: number, el: HTMLButtonElement | null) => {
    tabs.current[at] = el
  }, [])

  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])

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

  // Which ends of the rail have more thumbnails past them: the rail has no
  // scrollbar, so a soft fade at that end is the only sign there is more.
  const readEdges = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const pos = phone ? el.scrollLeft : el.scrollTop
    const view = phone ? el.clientWidth : el.clientHeight
    const size = phone ? el.scrollWidth : el.scrollHeight
    const next = { before: pos > 1, after: pos + view < size - 1 }
    setEdges((prev) => (prev.before === next.before && prev.after === next.after ? prev : next))
  }, [phone])

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
  }, [multi, count, listings])

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
    if (phone) {
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
  }, [index, phone])

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

  return (
    <Root
      ref={(el: HTMLElement | null) => {
        rootRef.current = el
      }}
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-dial', multi ? 'v3-dial--multi' : 'v3-dial--single', className)}
      aria-labelledby={heading ? headingId : undefined}
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
        {/* The dial first, its panels after (the WAI-ARIA tabs order): on a wide
            screen it stands on the left of the card, on a phone CSS lays it
            under the card as a strip. */}
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
                aria-orientation={phone ? 'horizontal' : 'vertical'}
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
        <div className="v3-dial__stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {listings.map((listing, i) => (
            <DialCard
              key={listing.listingKey}
              listing={listing}
              panelId={dialPanelId(id, i)}
              tabId={multi ? dialTabId(id, i) : null}
              shown={i === index}
              leaving={multi && leaving === i && i !== index}
            />
          ))}
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
