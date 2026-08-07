'use client'

/**
 * BpoCard — one broker price opinion as a CARD (never a table row),
 * mobile-first (mirrors ProspectCard). Identity + numbers + status/posture
 * stack vertically; the primary action is a full-width 44px button chosen by
 * the row's status. Secondary actions live in an overflow menu.
 *
 * Pure/presentational: every mutation is a callback prop — this component
 * never imports a server action or the DAL.
 */

import Link from 'next/link'
import { Loader2, MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { BpoWorklistRow } from '@/lib/data/bpo/reads'
import { BpoStatusPill } from './BpoStatusPill.client'
import { formatDate, formatPrice } from './format'

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

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenDetail(row.id)}
          className="h-auto min-w-0 flex-1 flex-col items-start justify-start gap-0 rounded-none p-0 text-left font-normal hover:bg-transparent"
        >
          <span className="w-full truncate text-sm font-semibold text-foreground">{row.subjectAddress ?? row.slug}</span>
          <span className="w-full truncate text-sm text-muted-foreground">
            {row.subjectCity ?? '—'}
            {row.subjectSubdivision ? ` · ${row.subjectSubdivision}` : ''}
          </span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More actions for this opinion">
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/bpo/${row.slug}`}>Open</Link>
            </DropdownMenuItem>
            {!isFinal ? (
              <DropdownMenuItem disabled={pendingFinalize} onSelect={() => onFinalize(row.slug)}>
                Finalize
              </DropdownMenuItem>
            ) : null}
            {crmHref ? (
              <DropdownMenuItem asChild>
                <Link href={crmHref}>Open in CRM</Link>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">Opinion of value</div>
          <div className="text-base font-semibold tabular-nums text-foreground">{formatPrice(row.opinionValue)}</div>
        </div>
        <div className="text-right text-xs tabular-nums text-muted-foreground">
          {formatPrice(row.valueLow)} – {formatPrice(row.valueHigh)}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <BpoStatusPill status={row.status} buildError={row.buildError} />
        {row.posture ? (
          <Badge variant="soft-neutral">{row.posture === 'buyer' ? 'Buyer opinion' : 'Seller opinion'}</Badge>
        ) : null}
        {row.confidence ? <Badge variant="outline">{row.confidence}</Badge> : null}
      </div>

      <p className="mt-2 text-xs tabular-nums text-muted-foreground">Built {formatDate(row.builtAt ?? row.createdAt)}</p>

      <div className="mt-3">
        {isFinal ? (
          <Button
            className="h-11 w-full"
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
          <Button className="h-11 w-full" onClick={() => onOpenDetail(row.id)}>
            Review
          </Button>
        )}
      </div>
      {isFinal && !canSend ? (
        <p className="mt-1.5 text-xs text-muted-foreground">Link a contact on the BPO detail page to send.</p>
      ) : null}
    </Card>
  )
}
