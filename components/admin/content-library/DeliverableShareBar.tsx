'use client'

/**
 * DeliverableShareBar — the interim share-to-social affordance for a broker
 * deliverable (W10.6). Shows a pre-written, brand-voice caption the broker can
 * copy, plus the standard ShareButton rails.
 *
 * This component is only ever rendered by the content-library page for a
 * deliverable whose type passed isShareableToSocial — a CMA or an internal
 * summary never reaches it. The caption comes from captionFor (qualitative, no
 * numbers), so nothing here fabricates a figure.
 *
 * There is no auto-post: the broker copies the caption and shares manually
 * (publishing to a channel is per-action-approved and broker-initiated). The
 * ShareButton opens native share / platform links; the copy button hands the
 * caption to the clipboard for image posts (IG/FB) that take no URL caption.
 */

import { useState, useCallback } from 'react'
import ShareButton from '@/components/ShareButton'
import { Button } from '@/components/ui/button'

export function DeliverableShareBar({
  caption,
  typeLabel,
  downloadUrl,
}: {
  caption: string
  typeLabel: string
  /** Short-lived signed URL, if the deliverable has a downloadable artifact. */
  downloadUrl: string | null
}) {
  const [copied, setCopied] = useState(false)

  const copyCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }, [caption])

  if (!caption) return null

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Share this {typeLabel}
      </p>
      <p className="mt-1 text-sm text-foreground">{caption}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copyCaption}>
          {copied ? 'Caption copied' : 'Copy caption'}
        </Button>
        <ShareButton
          variant="compact"
          title="Ryan Realty"
          text={caption}
          url={downloadUrl ?? undefined}
          trackContext="content-library-share"
          aria-label={`Share this ${typeLabel}`}
        />
      </div>
    </div>
  )
}
