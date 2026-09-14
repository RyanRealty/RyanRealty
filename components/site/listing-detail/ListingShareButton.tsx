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
 * on off-market homes too. Opens the installed shadcn Dialog — centered,
 * titled, default close — not a custom lightbox. The URL is the production
 * canonical, never window.location (no localhost leak in shots).
 */
export function ListingShareButton({
  onShare,
  ariaLabel,
  shareUrl,
  shareTitle,
}: {
  onShare?: () => void
  ariaLabel: string
  shareUrl: string
  shareTitle: string
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function openShare() {
    setOpen(true)
    onShare?.()
  }

  async function copyLink() {
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(shareUrl).catch(() => {})
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={openShare} aria-label={ariaLabel}>
        <ActionSwapText value={copied ? 'copied' : 'share'}>{copied ? 'Copied' : 'Share'}</ActionSwapText>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={TRANSITIONS_MODAL_SURFACE}
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
    </>
  )
}
