'use client'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useMediaOverlayHistory } from '@/lib/listing/use-media-overlay-history'
import type { VideoEmbed } from '@/lib/data/types/video'
import './listing-detail.css'

/**
 * Fullscreen video or 3D. Same Back / X / history contract as the photo
 * gallery so browser Back returns to the listing at the same scroll.
 */
export function ListingTourOverlay({
  open,
  video,
  title,
  onClose,
}: {
  open: boolean
  video: VideoEmbed | null
  title: string
  onClose: () => void
}) {
  const isOpen = open && video != null
  const { dismiss } = useMediaOverlayHistory(isOpen, onClose, 'tour')
  if (!isOpen || !video) return null

  return (
    <Dialog open={isOpen} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent
        showCloseButton={false}
        aria-label="Listing tour"
        overlayClassName="listing-gallery__overlay z-[110]"
        className="listing-gallery z-[110]"
      >
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
          {video.embedType === 'iframe' ? (
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
