'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useMediaOverlayHistory } from '@/lib/listing/use-media-overlay-history'
import { isOffsiteTourHost } from '@/lib/listing/publish-listing-on-site-tour'
import type { VideoEmbed } from '@/lib/data/types/video'
import type { ListingPhoto } from '@/lib/data/types/listing'
import { cn } from '@/lib/utils'
import './listing-detail.css'

const ListingLot3D = dynamic(() => import('./ListingLot3D.client'), { ssr: false, loading: () => null })

type Pane = 'walkthrough' | 'floor' | 'lot'

/**
 * On-site 3D / tour overlay. Matterport and native reels play here.
 * Zillow view-imx and brochure sites do not — leftover floor-plan stills
 * and the lot mesh do.
 */
export function ListingTourOverlay({
  open,
  video,
  floorPlans = [],
  lat,
  lng,
  title,
  onClose,
}: {
  open: boolean
  video: VideoEmbed | null
  floorPlans?: ReadonlyArray<ListingPhoto>
  lat?: number | null
  lng?: number | null
  title: string
  onClose: () => void
}) {
  const framable =
    video != null &&
    (video.embedType === 'iframe' || video.embedType === 'video-tag') &&
    !isOffsiteTourHost(video.url)
  const hasFloor = floorPlans.length > 0
  const hasLot = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
  const isOpen = open && (framable || hasFloor || hasLot)
  const { dismiss } = useMediaOverlayHistory(isOpen, onClose, 'tour')
  const initialPane: Pane = framable ? 'walkthrough' : hasFloor ? 'floor' : 'lot'
  const [pane, setPane] = useState<Pane>(initialPane)
  const [floorIndex, setFloorIndex] = useState(0)
  const active = useMemo(() => {
    if (pane === 'walkthrough' && framable) return 'walkthrough'
    if (pane === 'floor' && hasFloor) return 'floor'
    if (pane === 'lot' && hasLot) return 'lot'
    return initialPane
  }, [pane, framable, hasFloor, hasLot, initialPane])

  if (!isOpen) return null
  const still = floorPlans[Math.max(0, Math.min(floorIndex, floorPlans.length - 1))]

  return (
    <Dialog open={isOpen} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent
        showCloseButton={false}
        aria-label="Listing tour"
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
          <div className="listing-gallery__tabs" role="tablist" aria-label="On-site tour">
            {framable ? (
              <button
                type="button"
                role="tab"
                aria-selected={active === 'walkthrough'}
                className={cn('listing-gallery__tab', active === 'walkthrough' && 'is-on')}
                onClick={() => setPane('walkthrough')}
              >
                3D
              </button>
            ) : null}
            {hasFloor ? (
              <button
                type="button"
                role="tab"
                aria-selected={active === 'floor'}
                className={cn('listing-gallery__tab', active === 'floor' && 'is-on')}
                onClick={() => setPane('floor')}
              >
                Floor plan
              </button>
            ) : null}
            {hasLot ? (
              <button
                type="button"
                role="tab"
                aria-selected={active === 'lot'}
                className={cn('listing-gallery__tab', active === 'lot' && 'is-on')}
                onClick={() => setPane('lot')}
              >
                Lot
              </button>
            ) : null}
          </div>
        </div>
        <div className="listing-gallery__embed">
          {active === 'walkthrough' && framable && video ? (
            video.embedType === 'iframe' ? (
              <iframe
                src={video.url}
                title={title}
                allow={['accelerometer', 'autoplay', 'clipboard-write', 'encrypted-media', 'gyroscope', 'picture-in-picture', 'fullscreen'].join('; ')}
                allowFullScreen
              />
            ) : (
              <video
                src={video.url}
                poster={video.posterUrl}
                controls
                autoPlay
                playsInline
              />
            )
          ) : null}
          {active === 'floor' && still ? (
            <div className="listing-gallery__frame">
              <Image
                src={still.url}
                alt={still.caption ?? 'Floor plan'}
                fill
                sizes="100vw"
                className="object-contain"
              />
              {floorPlans.length > 1 ? (
                <div className="listing-gallery__count">
                  {floorIndex + 1} of {floorPlans.length}
                  <button
                    type="button"
                    className="listing-gallery__tab"
                    onClick={() => setFloorIndex((i) => (i + 1) % floorPlans.length)}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {active === 'lot' && hasLot ? (
            <div className="listing-gallery__frame">
              <ListingLot3D lat={lat!} lng={lng!} label={title} fill />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
