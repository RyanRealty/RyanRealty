'use client'

/**
 * CmaDetailPanel — the shared review-detail CONTENT for the `?id=` drawer
 * (copying components/admin/prospecting/ProspectDetailPanel.client.tsx).
 * This single component renders inside both breakpoints CmaBoard mounts
 * (mobile Sheet, desktop in-flow aside) so there is exactly one detail tree.
 */

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { CmaWorklistRow } from './types'
import { CmaStatusPill } from './CmaStatusPill.client'
import { formatDate, formatPrice } from './format'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums text-foreground">{value}</div>
    </div>
  )
}

export function CmaDetailPanel({
  detail,
  onApprove,
  onSend,
  pendingApprove,
  pendingSend,
}: {
  detail: CmaWorklistRow
  onApprove: (slug: string) => void
  onSend: (slug: string) => void
  pendingApprove?: boolean
  pendingSend?: boolean
}) {
  const priceRange =
    detail.valueLow != null && detail.valueHigh != null
      ? `${formatPrice(detail.valueLow)} – ${formatPrice(detail.valueHigh)}`
      : '—'

  return (
    <div className="space-y-5">
      {/* Identity */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{detail.subjectAddress}</h2>
        <p className="text-sm text-muted-foreground">
          {detail.clientName ?? 'No client on file'}
          {detail.subjectCity ? ` · ${detail.subjectCity}` : ''}
        </p>
        {detail.clientEmail ? <p className="text-xs text-muted-foreground">{detail.clientEmail}</p> : null}
      </div>

      <CmaStatusPill status={detail.status} needsReview={detail.needsReview} published={detail.publishedToListing} />

      {detail.publishedToListing ? (
        <p className="text-xs text-muted-foreground">
          The value range is on the public listing page
          {detail.publishedAt ? ` since ${formatDate(detail.publishedAt)}` : ''}. Publish and take down from the
          review page.
        </p>
      ) : null}

      <Separator />

      {/* Pricing */}
      <div className="space-y-2">
        <SectionLabel>Pricing</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Spec label="Recommended list" value={formatPrice(detail.recommendedList)} />
          <Spec label="Value range" value={priceRange} />
          <Spec label="Comps" value={detail.compsCount != null ? String(detail.compsCount) : '—'} />
        </div>
        {detail.subjectSubdivision ? <p className="text-xs text-muted-foreground">{detail.subjectSubdivision}</p> : null}
      </div>

      <Separator />

      {/* Timeline */}
      <div className="space-y-2">
        <SectionLabel>Timeline</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Spec label="Created" value={formatDate(detail.createdAt)} />
          <Spec label="Finalized" value={formatDate(detail.finalizedAt)} />
          <Spec label="Delivered" value={formatDate(detail.deliveredAt)} />
        </div>
      </div>

      {detail.buildError ? (
        <>
          <Separator />
          <p className="text-sm text-destructive">Build failed: {detail.buildError}</p>
        </>
      ) : null}

      <Separator />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {detail.status === 'draft' ? (
          <Button className="h-11 flex-1" disabled={pendingApprove} onClick={() => onApprove(detail.slug)}>
            {pendingApprove ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Approving…
              </span>
            ) : (
              'Approve'
            )}
          </Button>
        ) : detail.status === 'finalized' ? (
          <Button className="h-11 flex-1" disabled={pendingSend} onClick={() => onSend(detail.slug)}>
            {pendingSend ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Preparing…
              </span>
            ) : (
              'Send'
            )}
          </Button>
        ) : detail.status === 'delivered' || detail.status === 'archived' ? (
          <Button variant="outline" className="h-11 flex-1" disabled={pendingSend} onClick={() => onSend(detail.slug)}>
            {pendingSend ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Preparing…
              </span>
            ) : (
              'Send again'
            )}
          </Button>
        ) : null}
        {detail.hasDocument ? (
          <Button variant="outline" className="h-11 flex-1" asChild>
            <Link href={`/cma/${detail.slug}`} target="_blank" rel="noreferrer">
              Open report
            </Link>
          </Button>
        ) : null}
        <Button variant="outline" className="h-11 flex-1" asChild>
          <Link href={`/admin/cmas/${detail.slug}`}>Open in admin</Link>
        </Button>
      </div>
    </div>
  )
}
