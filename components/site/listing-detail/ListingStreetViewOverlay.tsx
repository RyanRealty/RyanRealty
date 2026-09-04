'use client'

import { useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useMediaOverlayHistory } from '@/lib/listing/use-media-overlay-history'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import './listing-detail.css'

/**
 * Fullscreen Street View for a listing that has a point. Same Back / X /
 * history contract as the photo gallery and 3D overlay.
 */

type Props = {
  open: boolean
  lat: number
  lng: number
  title: string
  onClose: () => void
}

export function ListingStreetViewOverlay({ open, lat, lng, title, onClose }: Props) {
  const isOpen = open && Number.isFinite(lat) && Number.isFinite(lng)
  const { dismiss } = useMediaOverlayHistory(isOpen, onClose, 'street')
  const { ready, error } = useGoogleMapsReady()
  const panoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !ready || error || !panoRef.current) return
    const maps = window.google?.maps
    if (!maps?.importLibrary) return
    let cancelled = false
    let pano: google.maps.StreetViewPanorama | null = null
    void maps.importLibrary('streetView').then((lib) => {
      if (cancelled || !panoRef.current) return
      const StreetViewPanorama =
        (lib as { StreetViewPanorama?: typeof google.maps.StreetViewPanorama }).StreetViewPanorama ??
        maps.StreetViewPanorama
      if (!StreetViewPanorama) return
      pano = new StreetViewPanorama(panoRef.current, {
        position: { lat, lng },
        pov: { heading: 0, pitch: 0 },
        visible: true,
        addressControl: false,
        fullscreenControl: true,
        enableCloseButton: false,
      })
    })
    return () => {
      cancelled = true
      pano?.setVisible(false)
    }
  }, [isOpen, ready, error, lat, lng])

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent
        showCloseButton={false}
        aria-label="Street view"
        overlayClassName="listing-gallery__overlay z-[110]"
        className="listing-gallery z-[110] inset-0 top-0 left-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="listing-gallery__bar">
          <div className="listing-gallery__exit">
            <button
              type="button"
              onClick={dismiss}
              className="listing-gallery__back"
              aria-label="Back"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="listing-gallery__close"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <div className="listing-gallery__embed">
          {error ? (
            <p className="p-6" style={{ color: 'var(--v3-cream)' }}>
              Street view is unavailable for this home.
            </p>
          ) : (
            <div ref={panoRef} style={{ position: 'absolute', inset: 0 }} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
