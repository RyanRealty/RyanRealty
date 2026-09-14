'use client'

import { useState } from 'react'
import { ActionSwapText } from '@/components/motion/action-swap'
import { TRANSITIONS_MODAL_SURFACE } from '@/components/motion/transitions-modal'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

/**
 * Share on the listing-detail PriceCtaStrip. Named so ci:mockup-parity can
 * fail if the control disappears (SITE-99 / Matt 2026-09-12). SITE-21: stays
 * on off-market homes too. The trigger is a single Button so it can sit
 * inside a ButtonGroup. The Dialog mounts beside the group, not as a
 * sibling that breaks shared edges. URL is the production canonical, never
 * window.location (no localhost leak in shots).
 */
export function ListingShareButton({
  onShare,
  ariaLabel,
}: {
  onShare?: () => void
  ariaLabel: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="rounded-none first:rounded-l-lg last:rounded-r-lg"
      onClick={onShare}
      aria-label={ariaLabel}
    >
      <ActionSwapText value="share">Share</ActionSwapText>
    </Button>
  )
}

export function ListingShareDialog({
  open,
  onOpenChange,
  shareUrl,
  shareTitle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  shareUrl: string
  shareTitle: string
}) {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(shareUrl).catch(() => {})
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={TRANSITIONS_MODAL_SURFACE}
        overlayClassName="bg-foreground/50"
        aria-describedby="listing-share-desc"
      >
        <DialogHeader>
          <DialogTitle>Share this home</DialogTitle>
          <DialogDescription id="listing-share-desc">{shareTitle}</DialogDescription>
        </DialogHeader>
        <Input readOnly value={shareUrl} aria-label="Listing link" />
        <DialogFooter>
          <Button type="button" onClick={() => void copyLink()}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
