'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useMediaOverlayHistory } from '@/lib/listing/use-media-overlay-history'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import './listing-detail.css'

/**
 * Fullscreen Street View for a listing that has a point. Same Back / X /
 * history contract as the photo gallery and 3D overlay.
 *
 * Do not construct StreetViewPanorama on the exact lat/lng and hope: many
 * homes sit off the road and Google returns an empty pano. Look up the
 * nearest outdoor panorama (50–120m) after the dialog mounts the target div.
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
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setUnavailable(false)
      return
    }
    if (!ready || error) return
    const maps = window.google?.maps
    if (!maps?.importLibrary) return

    let cancelled = false
    let pano: google.maps.StreetViewPanorama | null = null
    let tries = 0

    const start = () => {
      if (cancelled) return
      const el = panoRef.current
      if (!el) {
        if (tries++ < 30) requestAnimationFrame(start)
        return
      }
      void maps.importLibrary('streetView').then((lib) => {
        if (cancelled || !panoRef.current) return
        const StreetViewPanorama =
          (lib as { StreetViewPanorama?: typeof google.maps.StreetViewPanorama }).StreetViewPanorama ??
          maps.StreetViewPanorama
        const StreetViewService =
          (lib as { StreetViewService?: typeof google.maps.StreetViewService }).StreetViewService ??
          maps.StreetViewService
        if (!StreetViewPanorama || !StreetViewService) {
          setUnavailable(true)
          return
        }
        const service = new StreetViewService()
        service.getPanorama(
          {
            location: { lat, lng },
            radius: 120,
            source: maps.StreetViewSource?.OUTDOOR ?? 'outdoor',
          },
          (data, status) => {
            if (cancelled || !panoRef.current) return
            if (status !== 'OK' || !data?.location?.pano) {
              setUnavailable(true)
              return
            }
            pano = new StreetViewPanorama(panoRef.current, {
              pano: data.location.pano,
              pov: { heading: 0, pitch: 0 },
              visible: true,
              addressControl: false,
              fullscreenControl: true,
              enableCloseButton: false,
            })
          },
        )
      })
    }
    start()
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
          {error || unavailable ? (
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
