'use client'

/**
 * ProspectCard — one prospect as a CARD (never a table row), mobile-first
 * (spec 07 §8). Identity + compliance ribbon + doc pill + engagement stack
 * vertically; the primary action is a full-width 44px button chosen by the
 * §5.2 row-action state machine. Secondary actions (Review, Open in CRM) live
 * in an overflow menu so the card never needs a second row of buttons.
 *
 * Pure/presentational: every mutation is a callback prop (onBuild/onSend) —
 * this component never imports a server action or the DAL.
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
import { openChannels, PROSPECT_CHANNELS, type ProspectRow } from '@/lib/data/prospecting/types'
import { ProspectComplianceRibbon } from './ProspectComplianceRibbon.client'
import { ProspectDocPill } from './ProspectDocPill.client'
import { formatPrice, formatShortDate } from './format'

export function ProspectCard({
  row,
  detailHref,
  onBuild,
  onSend,
  pendingBuild,
  pendingSend,
}: {
  row: ProspectRow
  /** The prospect's own page. A real href, so it opens in a tab, shares, and
   *  survives a refresh — the `?id=` drawer this replaces did none of that. */
  detailHref: string
  onBuild: (id: string) => void
  onSend: (id: string) => void
  pendingBuild?: boolean
  pendingSend?: boolean
}) {
  // The ribbon speaks per channel now, so it renders whenever there is anything
  // to say — a closed channel or a market-status caveat. It self-hides when
  // every channel is open and the property is still off market.
  const showRibbon =
    row.compliance.allChannelsBlocked ||
    row.compliance.relisted ||
    row.compliance.offMarket ||
    PROSPECT_CHANNELS.some((c) => row.compliance.channels[c].blocked)

  // A doc-ready row is sendable when ANY outreach channel is still open — not
  // only SMS. `row.sendable` remains the strict SMS-gated flag the send action
  // enforces; blocking the whole CTA on it hid every do-not-call lead that was
  // perfectly emailable (Brain Dump 2, 2026-07-28).
  const canOpenSend = !row.compliance.relisted && !row.compliance.offMarket && !row.compliance.allChannelsBlocked

  const hasEngagement =
    row.engagement.reportViews > 0 ||
    row.engagement.linkTaps > 0 ||
    row.engagement.emailOpens > 0 ||
    row.engagement.emailClicks > 0

  const dateLabel = row.kind === 'expired' ? 'Expired' : 'Detected'
  const dateValue = row.kind === 'expired' ? row.expiredAt : row.detectedAt
  const crmHref = row.personId ? `/admin/crm/${row.personId}` : null

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={detailHref} className="min-w-0 flex-1">
          <span className="block w-full truncate text-sm font-semibold text-foreground">
            {row.ownerName ?? 'Owner unknown'}
          </span>
          <span className="block w-full truncate text-sm text-muted-foreground">
            {row.fullAddress ?? row.streetAddress ?? '—'}
            {row.city ? ` · ${row.city}` : ''}
          </span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More actions for this prospect">
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={detailHref}>Review</Link>
            </DropdownMenuItem>
            {crmHref ? (
              <DropdownMenuItem asChild>
                <Link href={crmHref}>Open in CRM</Link>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
        {row.listPrice != null ? <span>Was {formatPrice(row.listPrice)}</span> : null}
        {dateValue ? (
          <span>
            {dateLabel} {formatShortDate(dateValue)}
          </span>
        ) : null}
      </div>

      {showRibbon ? (
        <div className="mt-2">
          <ProspectComplianceRibbon compliance={row.compliance} />
        </div>
      ) : null}

      <div className="mt-2">
        <ProspectDocPill doc={row.doc} />
      </div>

      {hasEngagement ? (
        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
          {row.engagement.reportViews} views · {row.engagement.linkTaps} taps
          {row.engagement.lastActivityAt ? ` · last ${formatShortDate(row.engagement.lastActivityAt)}` : ''}
        </p>
      ) : null}

      <div className="mt-3">
        {row.doc.state === 'none' ? (
          <Button className="h-11 w-full" disabled={pendingBuild} onClick={() => onBuild(row.id)}>
            {pendingBuild ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Building…
              </span>
            ) : (
              'Build audit'
            )}
          </Button>
        ) : row.doc.state === 'building' ? (
          <Button className="h-11 w-full" disabled aria-busy>
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Building…
            </span>
          </Button>
        ) : row.doc.state === 'failed' ? (
          <Button variant="outline" className="h-11 w-full" disabled={pendingBuild} onClick={() => onBuild(row.id)}>
            {pendingBuild ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Retrying…
              </span>
            ) : (
              'Retry build'
            )}
          </Button>
        ) : row.doc.state === 'ready' && canOpenSend ? (
          <Button className="h-11 w-full" disabled={pendingSend} onClick={() => onSend(row.id)}>
            {pendingSend ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
              </span>
            ) : (
              `Send intro by ${openChannels(row.compliance)[0] === 'email' ? 'email' : 'text'}`
            )}
          </Button>
        ) : row.doc.state === 'sent' ? (
          crmHref ? (
            <Button variant="outline" className="h-11 w-full" asChild>
              <Link href={crmHref}>Open in CRM</Link>
            </Button>
          ) : (
            <Button variant="outline" className="h-11 w-full" disabled>
              Open in CRM
            </Button>
          )
        ) : null}
      </div>
    </Card>
  )
}
