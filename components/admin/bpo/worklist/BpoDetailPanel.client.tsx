'use client'

/**
 * BpoDetailPanel — the shared review-detail CONTENT (mirrors
 * ProspectDetailPanel). Renders inside both breakpoints of BpoDetailDrawer
 * (mobile Sheet, desktop in-flow aside) so there is exactly one detail tree.
 *
 * Deep edits (rebuild with an opinion-of-value override, broker reassignment,
 * delete) stay on the canonical /admin/bpo/[slug] review page — this panel is
 * the fast read + Finalize/Send loop for the worklist.
 */

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { BpoWorklistRow } from '@/lib/data/bpo/reads'
import { BpoStatusPill } from './BpoStatusPill.client'
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

export function BpoDetailPanel({
  detail,
  onFinalize,
  onOpenSend,
  pendingFinalize,
  pendingSend,
}: {
  detail: BpoWorklistRow
  onFinalize: (slug: string) => void
  onOpenSend: (slug: string) => void
  pendingFinalize?: boolean
  pendingSend?: boolean
}) {
  const isFinal = detail.status === 'final'
  const canSend = isFinal && detail.personId != null
  const crmHref = detail.personId ? `/admin/crm/${detail.personId}` : null

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{detail.subjectAddress ?? detail.slug}</h2>
        <p className="text-sm text-muted-foreground">
          {detail.subjectCity ?? '—'}
          {detail.subjectSubdivision ? ` · ${detail.subjectSubdivision}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <BpoStatusPill status={detail.status} buildError={detail.buildError} />
          {detail.posture ? (
            <Badge variant="soft-neutral">{detail.posture === 'buyer' ? 'Buyer opinion' : 'Seller opinion'}</Badge>
          ) : null}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <SectionLabel>Opinion</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Spec label="Opinion of value" value={formatPrice(detail.opinionValue)} />
          <Spec label="Range" value={`${formatPrice(detail.valueLow)} – ${formatPrice(detail.valueHigh)}`} />
          <Spec label="Confidence" value={detail.confidence ?? '—'} />
          <Spec label="Comps" value={detail.compsCount != null ? String(detail.compsCount) : '—'} />
          <Spec label="Purpose" value={detail.purpose ?? '—'} />
          <Spec label="Listing status" value={detail.subjectStatus ?? '—'} />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <SectionLabel>Timeline</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Spec label="Created" value={formatDate(detail.createdAt)} />
          <Spec label="Finalized" value={formatDate(detail.finalizedAt)} />
          <Spec label="Last sent" value={formatDate(detail.lastSentAt)} />
          <Spec label="Times sent" value={String(detail.sentCount)} />
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap gap-3 text-xs">
        <Link
          href={`/bpo/${detail.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground underline underline-offset-2"
        >
          View public opinion
        </Link>
        <Link href={`/admin/bpo/${detail.slug}`} className="text-muted-foreground underline underline-offset-2">
          Open full review page
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isFinal ? (
          <Button className="h-11 flex-1" disabled={pendingFinalize} onClick={() => onFinalize(detail.slug)}>
            {pendingFinalize ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Finalizing…
              </span>
            ) : (
              'Finalize'
            )}
          </Button>
        ) : (
          <Button
            className="h-11 flex-1"
            disabled={!canSend || pendingSend}
            title={canSend ? undefined : 'Link a contact on the BPO detail page to send.'}
            onClick={() => onOpenSend(detail.slug)}
          >
            {pendingSend ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Preparing…
              </span>
            ) : (
              'Send'
            )}
          </Button>
        )}
        {crmHref ? (
          <Button variant="outline" className="h-11 flex-1" asChild>
            <Link href={crmHref}>Open in CRM</Link>
          </Button>
        ) : null}
      </div>
      {isFinal && !canSend ? (
        <p className="text-xs text-muted-foreground">Link a contact on the BPO detail page to send.</p>
      ) : null}
    </div>
  )
}
