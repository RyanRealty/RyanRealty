'use client'

/**
 * BpoDetailPanel — the shared review-detail CONTENT (mirrors
 * ProspectDetailPanel). Renders inside both breakpoints of BpoDetailDrawer
 * (mobile Sheet, desktop in-flow aside) so there is exactly one detail tree.
 *
 * Deep edits (rebuild with an opinion-of-value override, broker reassignment,
 * delete) stay on the canonical /admin/bpo/[slug] review page — this panel is
 * the fast read + Finalize/Send loop for the worklist.
 *
 * 11F: on the LOCKED admin v2 language. The subject heading was a raw <h2>
 * (ci:admin-ui rule A) and the family's own hard rule bans <h1> here too (this
 * panel mounts inside a Sheet/aside, not a page) — it is now styled text at
 * the same visual weight, not a heading element. Badge -> the badge recipe,
 * Separator -> a hairline div, "Open in CRM" no longer rides a shadcn Button
 * asChild (v2 Button has no asChild) — it is a real <Link> carrying the
 * av2-btn classes directly, same as the entity Links elsewhere in this
 * family (e.g. app/admin/(protected)/prospecting/page.tsx).
 */

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/admin/v2'
import type { BpoWorklistRow } from '@/lib/data/bpo/reads'
import { BpoStatusPill } from './BpoStatusPill.client'
import { formatDate, formatPrice } from './format'

const dividerStyle: CSSProperties = { borderTop: '1px solid var(--a-border)' }
const badgeStyle: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 6px',
}
const quietLinkStyle: CSSProperties = {
  color: 'var(--a-text-2)',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
}

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
  const crmHref = detail.personId ? `/admin/people/${detail.personId}` : null

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p style={{ margin: 0, fontSize: 'var(--a-text-lg)', fontWeight: 600, color: 'var(--a-text)' }}>
          {detail.subjectAddress ?? detail.slug}
        </p>
        <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          {detail.subjectCity ?? '—'}
          {detail.subjectSubdivision ? ` · ${detail.subjectSubdivision}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <BpoStatusPill status={detail.status} buildError={detail.buildError} />
          {detail.posture ? (
            <span style={badgeStyle}>{detail.posture === 'buyer' ? 'Buyer opinion' : 'Seller opinion'}</span>
          ) : null}
        </div>
      </div>

      <div style={dividerStyle} />

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

      <div style={dividerStyle} />

      <div className="space-y-2">
        <SectionLabel>Timeline</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Spec label="Created" value={formatDate(detail.createdAt)} />
          <Spec label="Finalized" value={formatDate(detail.finalizedAt)} />
          <Spec label="Last sent" value={formatDate(detail.lastSentAt)} />
          <Spec label="Times sent" value={String(detail.sentCount)} />
        </div>
      </div>

      <div style={dividerStyle} />

      <div className="flex flex-wrap gap-3" style={{ fontSize: 'var(--a-text-xs)' }}>
        <Link href={`/bpo/${detail.slug}`} target="_blank" rel="noreferrer" style={quietLinkStyle}>
          View public opinion
        </Link>
        <Link href={`/admin/bpo/${detail.slug}`} style={quietLinkStyle}>
          Open full review page
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isFinal ? (
          <Button className="flex-1" touch variant="quiet" disabled={pendingFinalize} onClick={() => onFinalize(detail.slug)}>
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
            className="flex-1"
            touch
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
          <Link
            href={crmHref}
            className="av2-btn av2-btn--quiet av2-btn--touch"
            style={{ flex: 1, textDecoration: 'none' }}
          >
            Open in CRM
          </Link>
        ) : null}
      </div>
      {isFinal && !canSend ? (
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          Link a contact on the BPO detail page to send.
        </p>
      ) : null}
    </div>
  )
}
