'use client'

/**
 * CmaDetailPanel — the shared review-detail CONTENT for the `?id=` drawer
 * (copying components/admin/prospecting/ProspectDetailPanel.client.tsx).
 * This single component renders inside both breakpoints CmaBoard mounts
 * (mobile Sheet, desktop in-flow aside) so there is exactly one detail tree.
 *
 * 11F: on the LOCKED admin v2 language. The subject heading was a raw <h2>
 * (ci:admin-ui rule A) — it is now styled text at the same visual weight,
 * not a heading element (this panel mounts inside a Sheet/aside, not a
 * page). Separator -> a hairline div. "Open report"/"Open in admin" no
 * longer ride a shadcn Button asChild (v2 Button has no asChild) — they are
 * real <Link>s carrying the av2-btn classes directly, same idiom as the BPO
 * family's crmHref link.
 *
 * Gate note: at most one primary-variant Button per file. Send keeps the
 * primary accent; Approve and Send-again are quiet — same choice as
 * CmaCard.client.tsx, for one consistent worklist.
 */

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Button } from '@/components/admin/v2'
import { brokerCmaViewHref } from '@/lib/cma/draft-access'
import type { CmaWorklistRow } from './types'
import { CmaStatusPill } from './CmaStatusPill.client'
import { formatDate, formatPrice } from './format'

const dividerStyle: CSSProperties = { borderTop: '1px solid var(--a-border)' }

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 'var(--a-text-xs)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '.05em',
        color: 'var(--a-text-2)',
        margin: 0,
      }}
    >
      {children}
    </h3>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{label}</div>
      <div className="a-num" style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
        {value}
      </div>
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
        <p style={{ margin: 0, fontSize: 'var(--a-text-lg)', fontWeight: 600, color: 'var(--a-text)' }}>
          {detail.subjectAddress}
        </p>
        <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          {detail.clientName ?? 'No client on file'}
          {detail.subjectCity ? ` · ${detail.subjectCity}` : ''}
        </p>
        {detail.clientEmail ? (
          <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{detail.clientEmail}</p>
        ) : null}
      </div>

      <CmaStatusPill status={detail.status} needsReview={detail.needsReview} published={detail.publishedToListing} />

      {detail.publishedToListing ? (
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          The value range is on the public listing page
          {detail.publishedAt ? ` since ${formatDate(detail.publishedAt)}` : ''}. Publish and take down from the
          review page.
        </p>
      ) : null}

      <div style={dividerStyle} />

      {/* Pricing */}
      <div className="space-y-2">
        <SectionLabel>Pricing</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Spec label="Recommended list" value={formatPrice(detail.recommendedList)} />
          <Spec label="Value range" value={priceRange} />
          <Spec label="Comps" value={detail.compsCount != null ? String(detail.compsCount) : '—'} />
        </div>
        {detail.subjectSubdivision ? (
          <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{detail.subjectSubdivision}</p>
        ) : null}
      </div>

      <div style={dividerStyle} />

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
          <div style={dividerStyle} />
          <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>
            Build failed: {detail.buildError}
          </p>
        </>
      ) : null}

      <div style={dividerStyle} />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {detail.status === 'draft' ? (
          <Button className="flex-1" touch variant="quiet" disabled={pendingApprove} onClick={() => onApprove(detail.slug)}>
            {pendingApprove ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Approving…
              </span>
            ) : (
              'Approve'
            )}
          </Button>
        ) : detail.status === 'finalized' ? (
          <Button className="flex-1" touch disabled={pendingSend} onClick={() => onSend(detail.slug)}>
            {pendingSend ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Preparing…
              </span>
            ) : (
              'Send'
            )}
          </Button>
        ) : detail.status === 'delivered' || detail.status === 'archived' ? (
          <Button className="flex-1" touch variant="quiet" disabled={pendingSend} onClick={() => onSend(detail.slug)}>
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
          <a
            href={brokerCmaViewHref(detail.slug)}
            target="_blank"
            rel="noreferrer"
            className="av2-btn av2-btn--quiet av2-btn--touch"
            style={{ flex: 1, textDecoration: 'none' }}
          >
            Open report
          </a>
        ) : null}
        <Link
          href={`/admin/cmas/${detail.slug}`}
          className="av2-btn av2-btn--quiet av2-btn--touch"
          style={{ flex: 1, textDecoration: 'none' }}
        >
          Open in admin
        </Link>
      </div>
    </div>
  )
}
