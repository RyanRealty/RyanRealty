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
 *
 * P11F: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md)
 * and moved into the route's own _components/ (was
 * components/admin/content-library/DeliverableShareBar.tsx). ShareButton stays
 * a mounted legacy island (components/ShareButton.tsx, still shadcn) — out of
 * scope for this unit, same deferred-child pattern used elsewhere in the admin.
 */

import { useState, useCallback } from 'react'
import ShareButton from '@/components/ShareButton'
import { Button } from '@/components/admin/v2'

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
    <div
      style={{
        marginTop: 'var(--a-s3)',
        borderRadius: 'var(--a-r-md)',
        border: '1px solid var(--a-border)',
        background: 'var(--a-inset)',
        padding: 'var(--a-s3)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 'var(--a-text-xs)',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.025em',
          color: 'var(--a-text-2)',
        }}
      >
        Share this {typeLabel}
      </p>
      <p style={{ margin: 'var(--a-s1) 0 0', fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>{caption}</p>
      <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 'var(--a-s2)' }}>
        <Button variant="quiet" onClick={copyCaption}>
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
