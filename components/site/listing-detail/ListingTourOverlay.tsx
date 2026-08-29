'use client'

import { Dialog, DialogContent, DialogPortal, DialogOverlay } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useMediaOverlayHistory } from '@/lib/listing/use-media-overlay-history'
import type { VideoEmbed } from '@/lib/data/types/video'

/**
 * Fullscreen tour / video. Same Back + history contract as the photo gallery
 * so browser Back returns to the listing at the same scroll.
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
      <DialogPortal>
        <DialogOverlay className="bg-black/95 backdrop-blur-none" />
        <DialogContent
          showCloseButton={false}
          aria-label="Listing tour"
          className="max-w-none sm:max-w-none w-screen h-dvh bg-transparent border-0 p-0 shadow-none rounded-none ring-0 flex flex-col items-stretch justify-between gap-0 translate-x-0 translate-y-0 top-0 left-0"
        >
          <div className="flex shrink-0 items-center justify-between px-4 pt-4 sm:px-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={dismiss}
              className="min-h-11 min-w-11 bg-background/10 text-primary-foreground hover:bg-background/15 hover:text-primary-foreground"
              aria-label="Back"
            >
              Back
            </Button>
          </div>
          <div className="relative min-h-0 flex-1 px-4 pb-4 sm:px-6">
            {video.embedType === 'iframe' ? (
              <iframe
                src={video.url}
                title={title}
                allow={['accelerometer', 'autoplay', 'clipboard-write', 'encrypted-media', 'gyroscope', 'picture-in-picture', 'fullscreen'].join('; ')}
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <video
                src={video.url}
                poster={video.posterUrl}
                controls
                autoPlay
                playsInline
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
