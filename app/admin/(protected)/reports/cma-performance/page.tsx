// @no-parity — admin-internal reporting surface, no public mockup contract.
/**
 * /admin/reports/cma-performance — how the CMAs, audits and BPOs you send are
 * actually doing (Brain Dump 2, A7).
 *
 * Every signal here already existed and was never surfaced: email opens/clicks
 * (`email_events` keyed `cma:<slug>`), document page views (`visitor_events`,
 * `page_category='client-document'`), and SMS short-link taps (`crm_timeline`).
 * They were aggregated per-document for the prospecting worklist and printed as
 * one line on a card. This is the report.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getCmaPerformance } from '@/lib/data/cma/getCmaPerformance'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatPrice } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'

export const metadata: Metadata = {
  title: 'CMA send performance',
  description: 'Per-document opens, clicks and report views for every CMA, audit and BPO sent.',
}

export const dynamic = 'force-dynamic'

const DOC_TYPES: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'cma', label: 'CMA' },
  { value: 'expired-audit', label: 'Expired audit' },
  { value: 'bpo', label: 'BPO' },
]

/** A rate is only meaningful against a real denominator — never render "0%" off zero. */
function rate(n: number, of: number): string {
  if (of <= 0) return '—'
  return `${Math.round((n / of) * 100)}%`
}

export default async function CmaPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPage('prospecting.view')
  const sp = await searchParams
  const raw = Array.isArray(sp.docType) ? sp.docType[0] : sp.docType
  const docType = DOC_TYPES.some((d) => d.value === raw) ? raw! : 'all'
  const sentOnly = (Array.isArray(sp.sent) ? sp.sent[0] : sp.sent) === '1'

  const { rows, summary } = await getCmaPerformance({ docType, sentOnly, pageSize: 100 })

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-foreground">CMA send performance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Opens, clicks and report views for every document sent. Opens and views are counted only on
          documents that were actually delivered, so each rate shares one denominator.
        </p>
      </header>

      {/* The funnel, one line. Every stage over the same full set. */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
          <span>
            <span className="text-lg font-semibold tabular-nums text-foreground">{summary.built}</span>{' '}
            <span className="text-muted-foreground">built</span>
          </span>
          <span>
            <span className="text-lg font-semibold tabular-nums text-foreground">{summary.sent}</span>{' '}
            <span className="text-muted-foreground">sent ({rate(summary.sent, summary.built)} of built)</span>
          </span>
          <span>
            <span className="text-lg font-semibold tabular-nums text-foreground">{summary.opened}</span>{' '}
            <span className="text-muted-foreground">opened ({rate(summary.opened, summary.sent)} of sent)</span>
          </span>
          <span>
            <span className="text-lg font-semibold tabular-nums text-foreground">{summary.viewed}</span>{' '}
            <span className="text-muted-foreground">viewed the report ({rate(summary.viewed, summary.sent)})</span>
          </span>
          <span>
            <span className="text-lg font-semibold tabular-nums text-foreground">{summary.anyActivity}</span>{' '}
            <span className="text-muted-foreground">any activity ({rate(summary.anyActivity, summary.sent)})</span>
          </span>
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {DOC_TYPES.map((d) => (
          <Link
            key={d.value}
            href={`/admin/reports/cma-performance?docType=${d.value}${sentOnly ? '&sent=1' : ''}`}
            className={`rounded-full px-3 py-1.5 text-sm ${
              docType === d.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
            }`}
          >
            {d.label}
          </Link>
        ))}
        <Link
          href={`/admin/reports/cma-performance?docType=${docType}${sentOnly ? '' : '&sent=1'}`}
          className={`rounded-full px-3 py-1.5 text-sm ${
            sentOnly ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
          }`}
        >
          Sent only
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card className="border border-dashed border-border px-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">No documents match this filter.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {rows.map((r) => (
              <Card key={r.id} className="p-4">
                <Link href={`/cma/${r.slug}`} className="text-sm font-semibold text-foreground hover:underline">
                  {r.subjectAddress}
                </Link>
                <p className="mt-0.5 text-sm text-muted-foreground">{r.clientName ?? 'No client on file'}</p>
                <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                  {r.deliveredAt ? `Sent ${formatDate(r.deliveredAt)}` : 'Not sent'} · {r.engagement.emailOpens} opens ·{' '}
                  {r.engagement.emailClicks} clicks · {r.engagement.reportViews} views
                </p>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-hidden p-0 lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Recommended</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-xs">
                      <Link href={`/cma/${r.slug}`} className="block truncate hover:underline">
                        {r.subjectAddress}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">
                      {r.clientName ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.docType}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {formatPrice(r.recommendedList)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.deliveredAt ? (
                        formatDate(r.deliveredAt)
                      ) : (
                        <span className="text-muted-foreground">Not sent</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.engagement.emailOpens}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.engagement.emailClicks}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.engagement.reportViews}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.engagement.lastActivityAt ? formatDate(r.engagement.lastActivityAt) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}
