'use client'

/**
 * MapListingPopup — brand-native listing card over the search map.
 *
 * Replaces the stock Google Maps InfoWindow (white balloon chrome, auto scroll
 * bars, system close glyph). Renders our own card in the map float pane via
 * OverlayView so pan/zoom keep it pinned to the listing, with no Google chrome.
 */

import { useEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import Link from 'next/link'
import { formatPriceExact } from '@/lib/format/money'
import { MAP_NAVY, MAP_WHITE } from '@/lib/maps/markers'

const CREAM = '#faf8f4'
const BORDER = 'rgba(16,39,66,0.12)'
const TEXT_MID = 'rgba(16,39,66,0.68)'
const CARD_W = 272
/** Gap between the pin and the card edge, in px. */
const PIN_GAP = 14
/** Keep the card this far inside the map canvas when clamping horizontally. */
const EDGE_PAD = 8

/** Which side of the pin the card sits on. */
type Placement = 'above' | 'below'

export type MapListingPopupData = {
  price: number | null
  photoURL: string | null
  streetLine: string
  cityLine: string
  beds: number | null
  baths: number | null
  sqft: number | null
  href: string
  isSaved?: boolean
}

type Props = {
  map: google.maps.Map
  position: { lat: number; lng: number }
  listing: MapListingPopupData
  onClose: () => void
}

function PopupCard({
  listing,
  onClose,
  placement = 'above',
}: {
  listing: MapListingPopupData
  onClose: () => void
  placement?: Placement
}) {
  const stats: string[] = []
  if (listing.beds != null) stats.push(`${Math.round(listing.beds)} bd`)
  if (listing.baths != null) stats.push(`${Math.round(listing.baths)} ba`)
  if (listing.sqft != null) stats.push(`${Math.round(listing.sqft).toLocaleString()} sqft`)

  return (
    <div
      role="dialog"
      aria-label={listing.streetLine || 'Listing preview'}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'relative',
        width: CARD_W,
        background: CREAM,
        borderRadius: 14,
        border: `1px solid ${BORDER}`,
        boxShadow: '0 12px 32px rgba(16,39,66,0.22), 0 2px 8px rgba(16,39,66,0.10)',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        color: MAP_NAVY,
        maxHeight: 360,
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close listing preview"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          width: 28,
          height: 28,
          borderRadius: 999,
          border: 'none',
          background: 'rgba(16,39,66,0.72)',
          color: MAP_WHITE,
          fontSize: 16,
          lineHeight: 1,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ×
      </button>

      {listing.photoURL ? (
        <div style={{ width: '100%', height: 148, background: 'rgba(16,39,66,0.08)', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- map overlay isolation */}
          <img
            src={listing.photoURL}
            alt={listing.streetLine || 'Listing photo'}
            width={CARD_W}
            height={148}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            draggable={false}
          />
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            height: 72,
            background: 'linear-gradient(135deg, rgba(16,39,66,0.08), rgba(16,39,66,0.16))',
          }}
        />
      )}

      <div style={{ padding: '12px 14px 14px' }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: '-0.015em',
            fontVariantNumeric: 'tabular-nums',
            color: MAP_NAVY,
          }}
        >
          {formatPriceExact(listing.price)}
          {listing.isSaved ? (
            <span style={{ marginLeft: 6, color: '#dc2626', fontSize: 14 }} aria-hidden>
              ♥
            </span>
          ) : null}
        </div>

        {listing.streetLine ? (
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3, color: MAP_NAVY }}>{listing.streetLine}</div>
        ) : null}
        {listing.cityLine ? (
          <div style={{ fontSize: 12, marginTop: 1, color: TEXT_MID }}>{listing.cityLine}</div>
        ) : null}

        {stats.length > 0 ? (
          <div
            style={{
              fontSize: 12,
              color: TEXT_MID,
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px solid ${BORDER}`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {stats.join(' · ')}
          </div>
        ) : null}

        <Link
          href={listing.href}
          style={{
            display: 'block',
            marginTop: 12,
            padding: '10px 0',
            borderRadius: 8,
            background: MAP_NAVY,
            color: MAP_WHITE,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            textAlign: 'center',
            letterSpacing: '0.01em',
          }}
        >
          View listing →
        </Link>
      </div>

      {/* Caret points AT the pin, so it flips with the card. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          ...(placement === 'above' ? { bottom: -8 } : { top: -8 }),
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '9px solid transparent',
          borderRight: '9px solid transparent',
          ...(placement === 'above'
            ? { borderTop: `9px solid ${CREAM}` }
            : { borderBottom: `9px solid ${CREAM}` }),
          filter: 'drop-shadow(0 1px 1px rgba(16,39,66,0.12))',
        }}
      />
    </div>
  )
}

/**
 * Mounts a brand popup next to `position` on `map`. Unmounts on cleanup.
 *
 * The card is anchored ABOVE the pin when there is room and flips BELOW when
 * there isn't, and it is clamped horizontally inside the map canvas. Without
 * that, a pin in the upper band of the map put a ~310px-tall card off the top
 * of the canvas — and SearchMapClustered's wrapper is `overflow: hidden`, so
 * the card was clipped away entirely. The pin turned white (selected) and no
 * card was ever visible: the /homes-for-sale?view=map "marker click does
 * nothing" bug, reproduced 2026-08-18 (card in the DOM at y 36–348 while the
 * map canvas started at y 296).
 */
export default function MapListingPopup({ map, position, listing, onClose }: Props) {
  const rootRef = useRef<Root | null>(null)
  const onCloseRef = useRef(onClose)
  const listingRef = useRef(listing)
  const placementRef = useRef<Placement>('above')
  onCloseRef.current = onClose
  listingRef.current = listing

  // Mount overlay once per map+position; content updates in the second effect.
  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.OverlayView) return

    const host = document.createElement('div')
    host.style.cssText =
      `position:absolute;z-index:1001;transform:translate(-50%,calc(-100% - ${PIN_GAP}px));pointer-events:auto;`

    const root = createRoot(host)
    rootRef.current = root
    const paint = () =>
      root.render(
        <PopupCard
          listing={listingRef.current}
          onClose={() => onCloseRef.current()}
          placement={placementRef.current}
        />,
      )
    paint()

    class PopupOverlay extends google.maps.OverlayView {
      onAdd() {
        this.getPanes()?.floatPane.appendChild(host)
      }
      draw() {
        const proj = this.getProjection()
        if (!proj) return
        const latLng = new google.maps.LatLng(position.lat, position.lng)
        const point = proj.fromLatLngToDivPixel(latLng)
        if (!point) return

        // Container pixels are measured from the map canvas's own top-left, so
        // they are the frame the card has to fit inside. Div pixels (used for
        // left/top) are a different origin and cannot answer "does it fit".
        const anchor = proj.fromLatLngToContainerPixel(latLng)
        const canvas = map.getDiv()
        const canvasW = canvas?.clientWidth ?? 0
        const canvasH = canvas?.clientHeight ?? 0
        // offsetHeight is 0 until React has painted the card; the first draw
        // then keeps the default 'above' and a later draw corrects it.
        const cardH = host.offsetHeight

        let placement: Placement = 'above'
        let shiftX = 0
        let shiftY = 0
        if (anchor && canvasW > 0 && canvasH > 0) {
          if (cardH > 0) {
            const roomAbove = anchor.y - PIN_GAP
            const roomBelow = canvasH - anchor.y - PIN_GAP
            if (roomAbove < cardH && roomBelow > roomAbove) placement = 'below'
            // Vertical clamp: on a short canvas (the mobile listing-detail
            // map, pin centered) NEITHER side has room for the full card, so
            // the flip alone still leaves the card's top clipped away by the
            // map frame's overflow:hidden. Slide the card just far enough to
            // sit fully inside the canvas — covering the pin is the lesser
            // evil than an amputated photo strip.
            const top =
              placement === 'above' ? anchor.y - PIN_GAP - cardH : anchor.y + PIN_GAP
            const bottom = top + cardH
            if (top < EDGE_PAD) shiftY = EDGE_PAD - top
            else if (bottom > canvasH - EDGE_PAD) shiftY = canvasH - EDGE_PAD - bottom
          }
          const left = anchor.x - CARD_W / 2
          const right = anchor.x + CARD_W / 2
          if (left < EDGE_PAD) shiftX = EDGE_PAD - left
          else if (right > canvasW - EDGE_PAD) shiftX = canvasW - EDGE_PAD - right
        }

        host.style.left = `${point.x}px`
        host.style.top = `${point.y}px`
        host.style.transform =
          placement === 'above'
            ? `translate(calc(-50% + ${shiftX}px), calc(-100% - ${PIN_GAP - shiftY}px))`
            : `translate(calc(-50% + ${shiftX}px), ${PIN_GAP + shiftY}px)`

        if (placement !== placementRef.current) {
          placementRef.current = placement
          paint()
        }
      }
      onRemove() {
        host.remove()
      }
    }

    const overlay = new PopupOverlay()
    overlay.setMap(map)

    // The card's height decides above-vs-below, and React paints it a frame or
    // two AFTER the overlay's first draw() — at which point the map is idle and
    // Maps has no reason to draw again. Without this the very first draw (card
    // height 0) is the only one that ever runs and the placement stays 'above'
    // even when there is no room, which is the bug this component is fixing.
    const resize = new ResizeObserver(() => overlay.draw())
    resize.observe(host)

    const clickListener = map.addListener('click', () => onCloseRef.current())

    return () => {
      resize.disconnect()
      google.maps.event.removeListener(clickListener)
      overlay.setMap(null)
      queueMicrotask(() => {
        try {
          root.unmount()
        } catch {
          /* already gone */
        }
        if (rootRef.current === root) rootRef.current = null
      })
    }
  }, [map, position.lat, position.lng])

  useEffect(() => {
    rootRef.current?.render(
      <PopupCard
        listing={listing}
        onClose={() => onCloseRef.current()}
        placement={placementRef.current}
      />,
    )
  }, [listing])

  return null
}
