// @no-parity — internal admin surface
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getBatchEmailsReport, type BatchEmailRow } from '@/lib/data/crm/getBatchEmailsReport'
import { formatDate } from '@/lib/format/date'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ReportingTabStrip } from '@/components/admin/crm/reporting/ReportingTabStrip'

export const metadata = { title: 'Batch Emails | Reporting | CRM' }
export const dynamic = 'force-dynamic'


// ── Formatters ────────────────────────────────────────────────────────────────

/** Short date like "Apr 9, '26". */
function shortDate(iso: string): string {
  return formatDate(iso, { month: 'short', day: 'numeric', year: '2-digit' })
}

/** Format a rate in [0,1] as e.g. "24.3%". Returns "—" for null (no data). */
function fmtRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(1)}%`
}

/** Subject truncated at ~60 chars for display. */
function subjectDisplay(subject: string | null): string {
  const s = (subject ?? '(No subject)').trim()
  return s.length > 65 ? `${s.slice(0, 62)}…` : s
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ row }: { row: BatchEmailRow }) {
  if (row.status === 'finished') {
    return (
      <span className="text-sm text-muted-foreground">
        Finished{' '}
        <Link
          href={`/admin/crm/emails?campaign=${row.id}`}
          className="text-primary hover:underline"
        >
          (Details)
        </Link>
      </span>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Draft
    </Badge>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type SearchParams = { t?: string }

export default async function BatchEmailsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope = scopeBroker(access)

  // Superusers (Matt) see all campaigns. Scoped brokers see only their own.
  const brokerFilter = access.role === 'superuser' ? null : scope

  const result = await getBatchEmailsReport(brokerFilter).catch(() => null)
  const rows: BatchEmailRow[] = result?.rows ?? []
  const unreadable = result?.unreadable ?? false

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <ReportingTabStrip active="batch-emails" />

      {/* Header row: title + refresh button */}
      <div className="mb-2 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-foreground">Recent Batch Emails</h1>

        {/* Refresh: appends ?t= to bust the 10-min cache */}
        <Button
          variant="outline"
          size="sm"
          asChild
          className="shrink-0 gap-1.5 text-sm"
        >
          <Link href={`/admin/crm/reporting/batch-emails?t=${Date.now()}`}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Link>
        </Button>
      </div>

      {/* Cache notice */}
      <p className="mb-6 text-xs text-muted-foreground">
        Reporting results may be cached for up to 10 minutes.{' '}
        <Link
          href={`/admin/crm/reporting/batch-emails?t=${Date.now()}`}
          className="text-muted-foreground hover:underline"
        >
          Refresh results.
        </Link>
      </p>

      {/* Campaigns table */}
      <Card className="no-scrollbar overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-56">Subject</TableHead>
              <TableHead className="w-36">From</TableHead>
              <TableHead className="w-28">Created</TableHead>
              <TableHead className="w-24 text-right">Recipients</TableHead>
              <TableHead className="w-20 text-right">Sent</TableHead>
              <TableHead className="w-20 text-right">Opens</TableHead>
              <TableHead className="w-20 text-right">Clicks</TableHead>
              <TableHead className="w-24 text-right">Unsubscribes</TableHead>
              <TableHead className="w-40">Status</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {unreadable ? (
              /* DB error — honest error state, never fake data */
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  Could not load email campaign data. Try refreshing.
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              /* No campaigns yet — honest empty state */
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No batch emails found. Campaigns sent from the email admin will
                  appear here.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  {/* Subject */}
                  <TableCell className="font-medium text-foreground">
                    <span title={row.subject ?? undefined}>
                      {subjectDisplay(row.subject)}
                    </span>
                  </TableCell>

                  {/* From */}
                  <TableCell className="text-sm text-muted-foreground">
                    {row.fromBrokerName ?? '—'}
                  </TableCell>

                  {/* Created */}
                  <TableCell className="text-sm text-muted-foreground">
                    {shortDate(row.createdAtIso)}
                  </TableCell>

                  {/* Recipients */}
                  <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                    {row.recipientCount > 0
                      ? row.recipientCount.toLocaleString('en-US')
                      : '—'}
                  </TableCell>

                  {/* Sent */}
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.sent > 0 ? (
                      <span className="text-foreground">
                        {row.sent.toLocaleString('en-US')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Opens: show count + rate */}
                  <TableCell className="text-right text-sm">
                    {row.opens > 0 ? (
                      <span className="tabular-nums text-foreground">
                        {row.opens.toLocaleString('en-US')}
                        {row.openRate !== null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {fmtRate(row.openRate)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="tabular-nums text-muted-foreground">
                        {row.tracked ? '0' : '—'}
                      </span>
                    )}
                  </TableCell>

                  {/* Clicks: show count + rate */}
                  <TableCell className="text-right text-sm">
                    {row.clicks > 0 ? (
                      <span className="tabular-nums text-foreground">
                        {row.clicks.toLocaleString('en-US')}
                        {row.clickRate !== null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {fmtRate(row.clickRate)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="tabular-nums text-muted-foreground">
                        {row.tracked ? '0' : '—'}
                      </span>
                    )}
                  </TableCell>

                  {/* Unsubscribes */}
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.unsubscribes > 0 ? (
                      <span className="text-foreground">
                        {row.unsubscribes.toLocaleString('en-US')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {row.tracked ? '0' : '—'}
                      </span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <StatusBadge row={row} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
