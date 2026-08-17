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
import { formatListingAsk, publishListingAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingRooms } from '@/lib/listing/publish-listing-rooms'
import { MAP_NAVY, MAP_WHITE } from '@/lib/maps/markers'

const CREAM = '#faf8f4'
const BORDER = 'rgba(16,39,66,0.12)'
const TEXT_MID = 'rgba(16,39,66,0.68)'
const CARD_W = 272

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

function PopupCard({ listing, onClose }: { listing: MapListingPopupData; onClose: () => void }) {
  const ask = publishListingAsk(listing.price)
  const rooms = publishListingRooms({ beds: listing.beds, baths: listing.baths, sqft: listing.sqft })
  const stats: string[] = []
  if (rooms.beds != null) stats.push(`${Math.round(rooms.beds)} bd`)
  if (rooms.baths != null) stats.push(`${Math.round(rooms.baths)} ba`)
  if (rooms.sqft != null) stats.push(`${Math.round(rooms.sqft).toLocaleString()} sqft`)

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
          {ask ? formatListingAsk(ask.ask) : '—'}
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

      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -8,
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '9px solid transparent',
          borderRight: '9px solid transparent',
          borderTop: `9px solid ${CREAM}`,
          filter: 'drop-shadow(0 1px 1px rgba(16,39,66,0.12))',
        }}
      />
    </div>
  )
}

/** Mounts a brand popup above `position` on `map`. Unmounts on cleanup. */
export default function MapListingPopup({ map, position, listing, onClose }: Props) {
  const rootRef = useRef<Root | null>(null)
  const onCloseRef = useRef(onClose)
  const listingRef = useRef(listing)
  onCloseRef.current = onClose
  listingRef.current = listing

  // Mount overlay once per map+position; content updates in the second effect.
  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.OverlayView) return

    const host = document.createElement('div')
    host.style.cssText =
      'position:absolute;z-index:1001;transform:translate(-50%,calc(-100% - 14px));pointer-events:auto;'

    const root = createRoot(host)
    rootRef.current = root
    root.render(
      <PopupCard listing={listingRef.current} onClose={() => onCloseRef.current()} />,
    )

    class PopupOverlay extends google.maps.OverlayView {
      onAdd() {
        this.getPanes()?.floatPane.appendChild(host)
      }
      draw() {
        const proj = this.getProjection()
        if (!proj) return
        const point = proj.fromLatLngToDivPixel(new google.maps.LatLng(position.lat, position.lng))
        if (!point) return
        host.style.left = `${point.x}px`
        host.style.top = `${point.y}px`
      }
      onRemove() {
        host.remove()
      }
    }

    const overlay = new PopupOverlay()
    overlay.setMap(map)

    const clickListener = map.addListener('click', () => onCloseRef.current())

    return () => {
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
      <PopupCard listing={listing} onClose={() => onCloseRef.current()} />,
    )
  }, [listing])

  return null
}
