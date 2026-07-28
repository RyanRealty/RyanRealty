'use client'

/**
 * ProspectTable — the prospecting worklist as ONE sortable list (Brain Dump 2).
 *
 * Replaces the two-column card grid. Every column Matt named is here and every
 * one of them sorts: thumbnail · owner · address · city · was-listed price ·
 * off-market date · the audit's recommended price · audit state · sent state ·
 * activity · action. Sorting is URL-driven (`?sort=&dir=`) and resolved
 * server-side over the whole ~200-row set, so it orders the WORKLIST, not just
 * the visible page.
 *
 * The address is a real <Link> to the prospect's detail page — not a drawer.
 *
 * Pure/presentational: every mutation is a callback prop.
 */

import Image from 'next/image'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ChevronsUpDown, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { ProspectCard } from './ProspectCard.client'
import { cn } from '@/lib/utils'
import {
  openChannels,
  type ProspectRow,
  type ProspectSortKey,
  type SortDir,
} from '@/lib/data/prospecting/types'
import { formatPrice, formatShortDate } from './format'

type Col = { key: ProspectSortKey; label: string; numeric?: boolean }

const COLUMNS: Col[] = [
  { key: 'owner', label: 'Owner' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'price', label: 'Was listed', numeric: true },
  { key: 'date', label: 'Off market', numeric: true },
  { key: 'recommended', label: 'Recommended', numeric: true },
  { key: 'audit', label: 'Audit' },
]

function SortLink({
  col,
  sort,
  dir,
  hrefFor,
}: {
  col: Col
  sort: ProspectSortKey
  dir: SortDir
  hrefFor: (key: ProspectSortKey, dir: SortDir) => string
}) {
  const active = sort === col.key
  // Text ascends first (A→Z); numbers and dates descend first (biggest/newest
  // first is what a broker actually wants to see at the top).
  const firstDir: SortDir = col.numeric ? 'desc' : 'asc'
  const nextDir: SortDir = active ? (dir === 'asc' ? 'desc' : 'asc') : firstDir
  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown
  return (
    <Link
      href={hrefFor(col.key, nextDir)}
      scroll={false}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-sm text-xs font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {col.label}
      <Icon className={cn('h-3 w-3', active ? 'opacity-100' : 'opacity-40')} aria-hidden />
    </Link>
  )
}

function AuditCell({ row }: { row: ProspectRow }) {
  const d = row.doc
  if (d.state === 'sent') {
    return (
      <div className="flex flex-col gap-0.5">
        <Badge variant="success">Sent</Badge>
        <span className="text-xs text-muted-foreground">{formatShortDate(d.sentAt)}</span>
      </div>
    )
  }
  if (d.state === 'ready') return <Badge variant="secondary">{d.status === 'draft' ? 'Needs approval' : 'Ready'}</Badge>
  if (d.state === 'building') return <Badge variant="warning">Building</Badge>
  if (d.state === 'failed') return <Badge variant="destructive">Failed</Badge>
  return <span className="text-xs text-muted-foreground">None</span>
}

function ActivityCell({ row }: { row: ProspectRow }) {
  const e = row.engagement
  const total = e.reportViews + e.linkTaps + e.emailOpens + e.emailClicks
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className="whitespace-nowrap text-xs tabular-nums text-foreground">
      {e.reportViews} views · {e.emailOpens} opens
    </span>
  )
}

export function ProspectTable({
  rows,
  sort,
  dir,
  hrefFor,
  detailHref,
  onBuild,
  onSend,
  pendingBuildId,
  pendingSendId,
}: {
  rows: ProspectRow[]
  sort: ProspectSortKey
  dir: SortDir
  hrefFor: (key: ProspectSortKey, dir: SortDir) => string
  detailHref: (row: ProspectRow) => string
  onBuild: (id: string) => void
  onSend: (id: string) => void
  pendingBuildId: string | null
  pendingSendId: string | null
}) {
  return (
    <>
      {/* Cards below lg — a 10-column table is unreadable on a phone. */}
      <div className="grid gap-3 lg:hidden">
        {rows.map((row) => (
          <ProspectCard
            key={row.id}
            row={row}
            detailHref={detailHref(row)}
            onBuild={onBuild}
            onSend={onSend}
            pendingBuild={pendingBuildId === row.id}
            pendingSend={pendingSendId === row.id}
          />
        ))}
      </div>

      <Card className="hidden overflow-hidden p-0 lg:block">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14" />
          {COLUMNS.map((c) => (
            <TableHead key={c.key} className={cn(c.numeric && 'text-right')}>
              <SortLink col={c} sort={sort} dir={dir} hrefFor={hrefFor} />
            </TableHead>
          ))}
          <TableHead className="text-xs font-medium text-muted-foreground">Reachable</TableHead>
          <TableHead className="text-xs font-medium text-muted-foreground">Activity</TableHead>
          <TableHead className="w-32" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const open = openChannels(row.compliance)
          const canSend =
            !row.compliance.relisted && !row.compliance.offMarket && !row.compliance.allChannelsBlocked
          const recommended =
            row.doc.state === 'ready' || row.doc.state === 'sent' ? row.doc.recommendedList : null
          const offMarketAt = row.kind === 'expired' ? row.expiredAt : row.detectedAt
          return (
            <TableRow key={row.id}>
              <TableCell>
                {row.photoUrl ? (
                  // Unoptimized: MLS/scrape hosts are not in next.config images
                  // remotePatterns, and an admin worklist thumbnail does not
                  // justify adding every one of them.
                  <Image
                    src={row.photoUrl}
                    alt=""
                    width={48}
                    height={36}
                    unoptimized
                    className="h-9 w-12 rounded-sm object-cover"
                  />
                ) : (
                  <div className="h-9 w-12 rounded-sm bg-secondary" aria-hidden />
                )}
              </TableCell>
              <TableCell className="max-w-[12rem] truncate font-medium">
                {row.ownerName ?? <span className="text-muted-foreground">Owner unknown</span>}
              </TableCell>
              <TableCell className="max-w-[16rem]">
                <Link href={detailHref(row)} className="block truncate underline-offset-2 hover:underline">
                  {row.fullAddress ?? row.streetAddress ?? '—'}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{row.city ?? '—'}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatPrice(row.listPrice)}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                {formatShortDate(offMarketAt)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                {formatPrice(recommended)}
              </TableCell>
              <TableCell>
                <AuditCell row={row} />
              </TableCell>
              <TableCell>
                {row.compliance.allChannelsBlocked ? (
                  <Badge variant="destructive">Do not contact</Badge>
                ) : (
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {open.map((c) => (c === 'sms' ? 'Text' : c === 'email' ? 'Email' : 'Call')).join(' · ')}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <ActivityCell row={row} />
              </TableCell>
              <TableCell className="text-right">
                {row.doc.state === 'none' || row.doc.state === 'failed' ? (
                  <Button
                    size="sm"
                    variant={row.doc.state === 'failed' ? 'outline' : 'default'}
                    disabled={pendingBuildId === row.id}
                    onClick={() => onBuild(row.id)}
                  >
                    {pendingBuildId === row.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : row.doc.state === 'failed' ? (
                      'Retry'
                    ) : (
                      'Build audit'
                    )}
                  </Button>
                ) : row.doc.state === 'ready' && canSend ? (
                  <Button size="sm" disabled={pendingSendId === row.id} onClick={() => onSend(row.id)}>
                    {pendingSendId === row.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      `Send by ${open[0] === 'email' ? 'email' : 'text'}`
                    )}
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={detailHref(row)}>Open</Link>
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
      </Card>
    </>
  )
}
