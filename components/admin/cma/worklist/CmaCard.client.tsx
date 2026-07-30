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
 */

import Link from 'next/link'
import { Loader2, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenDetail(row.id)}
          className="h-auto min-w-0 flex-1 flex-col items-start justify-start gap-0 rounded-none p-0 text-left font-normal hover:bg-transparent"
        >
          <span className="w-full truncate text-sm font-semibold text-foreground">{row.subjectAddress}</span>
          <span className="w-full truncate text-sm text-muted-foreground">
            {row.clientName ?? 'No client on file'}
            {row.subjectCity ? ` · ${row.subjectCity}` : ''}
          </span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More actions for this CMA">
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/cmas/${row.slug}`}>Review</Link>
            </DropdownMenuItem>
            {row.hasDocument ? (
              <DropdownMenuItem asChild>
                <Link href={`/cma/${row.slug}`} target="_blank" rel="noreferrer">
                  Open report
                </Link>
              </DropdownMenuItem>
            ) : null}
            {row.status === 'delivered' || row.status === 'archived' ? (
              <DropdownMenuItem onSelect={() => onSend(row.slug)}>Send again</DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Recommended list</span>
        <span className="font-semibold tabular-nums text-foreground">{formatPrice(row.recommendedList)}</span>
      </div>
      {priceRange ? (
        <div className="mt-1 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <span>Range</span>
          <span className="tabular-nums">{priceRange}</span>
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2">
        <CmaStatusPill status={row.status} needsReview={row.needsReview} published={row.publishedToListing} />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDate(row.createdAt)}</span>
      </div>

      <div className="mt-3">
        {row.status === 'draft' ? (
          <Button className="h-11 w-full" disabled={pendingApprove} onClick={() => onApprove(row.slug)}>
            {pendingApprove ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Approving…
              </span>
            ) : (
              'Approve'
            )}
          </Button>
        ) : row.status === 'finalized' ? (
          <Button className="h-11 w-full" disabled={pendingSend} onClick={() => onSend(row.slug)}>
            {pendingSend ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Preparing…
              </span>
            ) : (
              'Send'
            )}
          </Button>
        ) : row.hasDocument ? (
          <Button variant="outline" className="h-11 w-full" asChild>
            <Link href={`/cma/${row.slug}`} target="_blank" rel="noreferrer">
              Open
            </Link>
          </Button>
        ) : (
          <Button variant="outline" className="h-11 w-full" asChild>
            <Link href={`/admin/cmas/${row.slug}`}>Review</Link>
          </Button>
        )}
      </div>

      {row.buildError ? <div className="mt-2 text-xs text-destructive">Build failed. Open Review for detail.</div> : null}
    </Card>
  )
}
