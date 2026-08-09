'use client'

/**
 * BpoCard — one broker price opinion as a CARD (never a table row),
 * mobile-first (mirrors ProspectCard). Identity + numbers + status/posture
 * stack vertically; the primary action is a full-width 44px button chosen by
 * the row's status. Secondary actions live in an overflow menu.
 *
 * Pure/presentational: every mutation is a callback prop — this component
 * never imports a server action or the DAL.
 *
 * 11F: on the LOCKED admin v2 language. Card -> av2-pane, Badge -> the badge
 * recipe, DropdownMenu -> Menu. Navigating items carry `href`, so the v2 Menu
 * renders a real <a> and middle-click / Cmd-click still open a new tab — the
 * first migration routed them through router.push() and silently lost that.
 * (superseded note) Menu items were onSelect-driven (a v2 Menu had
 * no href-based item), so "Open" and "Open in CRM" — real <Link>s wrapped by
 * DropdownMenuItem asChild before — now navigate via router.push(). This
 * loses native middle-click/⌘-click-to-new-tab on those two items; it is the
 * same, already-established trade-off the sequences family recorded for its
 * router.push-driven Menu items (crm/sequences/_components/
 * automations-list-bits.tsx).
 */

import type { CSSProperties } from 'react'
import { Loader2, MoreHorizontal } from 'lucide-react'
import { Button, Menu, type AdminMenuItem } from '@/components/admin/v2'
import type { BpoWorklistRow } from '@/lib/data/bpo/reads'
import { BpoStatusPill } from './BpoStatusPill.client'
import { formatDate, formatPrice } from './format'

const badgeStyle: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 6px',
}

export function BpoCard({
  row,
  onOpenDetail,
  onSend,
  onFinalize,
  pendingSend,
  pendingFinalize,
}: {
  row: BpoWorklistRow
  onOpenDetail: (id: string) => void
  onSend: (slug: string) => void
  onFinalize: (slug: string) => void
  pendingSend?: boolean
  pendingFinalize?: boolean
}) {
  const isFinal = row.status === 'final'
  const canSend = isFinal && row.personId != null
  const crmHref = row.personId ? `/admin/people/${row.personId}` : null

  const menuItems: AdminMenuItem[] = [
    { label: 'Open', href: `/admin/bpo/${row.slug}` },
    ...(!isFinal
      ? [{ label: 'Finalize', disabled: pendingFinalize, onSelect: () => onFinalize(row.slug) }]
      : []),
    ...(crmHref ? [{ label: 'Open in CRM', href: crmHref }] : []),
  ]

  return (
    <div className="av2-pane">
      <div className="flex items-start justify-between gap-3">
        <Button
          type="button"
          variant="quiet"
          onClick={() => onOpenDetail(row.id)}
          className="h-auto min-w-0 flex-1 flex-col items-start justify-start gap-0 text-left"
          style={{ background: 'none', border: 'none', padding: 0, minHeight: 0, borderRadius: 0, fontWeight: 400 }}
        >
          <span className="w-full truncate" style={{ fontSize: 'var(--a-text-md)', fontWeight: 600, color: 'var(--a-text)' }}>
            {row.subjectAddress ?? row.slug}
          </span>
          <span className="w-full truncate" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
            {row.subjectCity ?? '—'}
            {row.subjectSubdivision ? ` · ${row.subjectSubdivision}` : ''}
          </span>
        </Button>
        <Menu
          label="More actions for this opinion"
          trigger={<MoreHorizontal className="h-4 w-4" aria-hidden />}
          items={menuItems}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div>
          <div style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>Opinion of value</div>
          <div className="a-num" style={{ fontSize: 'var(--a-text-lg)', fontWeight: 600, color: 'var(--a-text)' }}>
            {formatPrice(row.opinionValue)}
          </div>
        </div>
        <div className="a-num text-right" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {formatPrice(row.valueLow)} – {formatPrice(row.valueHigh)}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <BpoStatusPill status={row.status} buildError={row.buildError} />
        {row.posture ? (
          <span style={badgeStyle}>{row.posture === 'buyer' ? 'Buyer opinion' : 'Seller opinion'}</span>
        ) : null}
        {row.confidence ? <span style={badgeStyle}>{row.confidence}</span> : null}
      </div>

      <p className="a-num mt-2" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '8px 0 0' }}>
        Built {formatDate(row.builtAt ?? row.createdAt)}
      </p>

      <div className="mt-3">
        {isFinal ? (
          <Button
            className="w-full"
            touch
            disabled={!canSend || pendingSend}
            title={canSend ? undefined : 'Link a contact on the BPO detail page to send.'}
            onClick={() => onSend(row.slug)}
          >
            {pendingSend ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Preparing…
              </span>
            ) : (
              'Send'
            )}
          </Button>
        ) : (
          <Button className="w-full" touch variant="quiet" onClick={() => onOpenDetail(row.id)}>
            Review
          </Button>
        )}
      </div>
      {isFinal && !canSend ? (
        <p style={{ marginTop: 6, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          Link a contact on the BPO detail page to send.
        </p>
      ) : null}
    </div>
  )
}
