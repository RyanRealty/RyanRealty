'use client'

/**
 * CmaCard — one CMA as a CARD (never a table row), mobile-first, copying the
 * ProspectCard idiom (components/admin/prospecting/ProspectCard.client.tsx).
 * Identity + recommended-list price + status live stacked; the primary
 * action is a full-width 44px button chosen by status. Secondary actions
 * (Review, Open report) live in an overflow menu so the card never needs a
 * second row of buttons.
 *
 * Pure/presentational: every mutation is a callback prop (onApprove/onSend)
 * — this component never imports a server action or the DAL.
 *
 * 11F: on the LOCKED admin v2 language. Card -> av2-pane, Badge -> the badge
 * recipe via CmaStatusPill, DropdownMenu -> Menu. "Review" keeps a real
 * `href` menu item (native middle-click/⌘-click-to-new-tab intact); "Open
 * report" opens in a NEW TAB in the original (`target="_blank"`), which a v2
 * Menu href item cannot carry (no target passthrough), so it is onSelect +
 * The 'Open report' item carries href + target='_blank', so the v2 Menu renders
 * a real anchor and middle-click, Cmd-click and the right-click menu all keep
 * working. An earlier pass used window.open from onSelect, which only reacts
 * to a left click and silently dropped all three.
 * middle-click/⌘-click and the browser's own "open in new tab" context-menu
 * entry are lost. Same class of trade-off the BPO family recorded for its
 * router.push-driven Menu items, one step further because the original
 * behavior here was new-tab, not same-tab.
 *
 * Gate note: at most one primary-variant Button per file. This file's status
 * ternary carries two Button candidates (Approve, Send) plus two Link-styled
 * actions (Open, Review); Send keeps the primary accent, Approve is quiet —
 * same choice as CmaDetailPanel.client.tsx, for one consistent worklist.
 */

import Link from 'next/link'
import { Loader2, MoreHorizontal } from 'lucide-react'
import { Button, Menu, type AdminMenuItem } from '@/components/admin/v2'
import type { CmaWorklistRow } from './types'
import { CmaStatusPill } from './CmaStatusPill.client'
import { formatDate, formatPrice } from './format'

export function CmaCard({
  row,
  onOpenDetail,
  onApprove,
  onSend,
  pendingApprove,
  pendingSend,
}: {
  row: CmaWorklistRow
  onOpenDetail: (id: string) => void
  onApprove: (slug: string) => void
  onSend: (slug: string) => void
  pendingApprove?: boolean
  pendingSend?: boolean
}) {
  const priceRange =
    row.valueLow != null && row.valueHigh != null ? `${formatPrice(row.valueLow)} – ${formatPrice(row.valueHigh)}` : null

  const menuItems: AdminMenuItem[] = [
    { label: 'Review', href: `/admin/cmas/${row.slug}` },
    ...(row.hasDocument
      ? [{ label: 'Open report', href: `/cma/${row.slug}`, target: '_blank' as const }]
      : []),
    ...(row.status === 'delivered' || row.status === 'archived'
      ? [{ label: 'Send again', onSelect: () => onSend(row.slug) }]
      : []),
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
            {row.subjectAddress}
          </span>
          <span className="w-full truncate" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
            {row.clientName ?? 'No client on file'}
            {row.subjectCity ? ` · ${row.subjectCity}` : ''}
          </span>
        </Button>
        <Menu label="More actions for this CMA" trigger={<MoreHorizontal className="h-4 w-4" aria-hidden />} items={menuItems} />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>Recommended list</span>
        <span className="a-num" style={{ fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text)' }}>
          {formatPrice(row.recommendedList)}
        </span>
      </div>
      {priceRange ? (
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>Range</span>
          <span className="a-num" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            {priceRange}
          </span>
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2">
        <CmaStatusPill status={row.status} needsReview={row.needsReview} published={row.publishedToListing} />
        <span className="a-num shrink-0" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {formatDate(row.createdAt)}
        </span>
      </div>

      <div className="mt-3">
        {row.status === 'draft' ? (
          <Button className="w-full" touch variant="quiet" disabled={pendingApprove} onClick={() => onApprove(row.slug)}>
            {pendingApprove ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Approving…
              </span>
            ) : (
              'Approve'
            )}
          </Button>
        ) : row.status === 'finalized' ? (
          <Button className="w-full" touch disabled={pendingSend} onClick={() => onSend(row.slug)}>
            {pendingSend ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Preparing…
              </span>
            ) : (
              'Send'
            )}
          </Button>
        ) : row.hasDocument ? (
          <Link
            href={`/cma/${row.slug}`}
            target="_blank"
            rel="noreferrer"
            className="av2-btn av2-btn--quiet av2-btn--touch w-full"
            style={{ textDecoration: 'none' }}
          >
            Open
          </Link>
        ) : (
          <Link
            href={`/admin/cmas/${row.slug}`}
            className="av2-btn av2-btn--quiet av2-btn--touch w-full"
            style={{ textDecoration: 'none' }}
          >
            Review
          </Link>
        )}
      </div>

      {row.buildError ? (
        <div className="mt-2" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>
          Build failed. Open Review for detail.
        </div>
      ) : null}
    </div>
  )
}
