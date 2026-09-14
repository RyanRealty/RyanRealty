'use client'

import { useState } from 'react'
import { V3Button } from '@/components/site/v3'
import { V3ActionSwapText } from '@/components/site/v3/V3ActionSwap'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TRANSITIONS_MODAL_SURFACE } from '@/components/motion/transitions-modal'

/**
 * Share on the listing-detail PriceCtaStrip. Named so ci:mockup-parity can
 * fail if the control disappears (SITE-99 / Matt 2026-09-12). SITE-21: stays
 * on off-market homes too. Opens the installed shadcn Dialog (same source
 * as the photo lightbox) — the catalog demo, not a clipboard-only ghost.
 * Share→Copied is beUI action-swap on the trigger.
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
      <V3Button type="button" variant="ghost" onClick={openShare} ariaLabel={ariaLabel}>
        <V3ActionSwapText value={copied ? 'copied' : 'share'}>{copied ? 'Copied' : 'Share'}</V3ActionSwapText>
      </V3Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={TRANSITIONS_MODAL_SURFACE}
          aria-describedby="listing-share-desc"
        >
          <DialogHeader>
            <DialogTitle>Share this home</DialogTitle>
            <DialogDescription id="listing-share-desc">{shareTitle}</DialogDescription>
          </DialogHeader>
          <p className="break-all text-sm text-muted-foreground">{shareUrl}</p>
          <V3Button type="button" onClick={() => void copyLink()}>
            {copied ? 'Copied' : 'Copy link'}
          </V3Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
