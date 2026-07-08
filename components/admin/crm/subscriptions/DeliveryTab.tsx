'use client'

/**
 * DeliveryTab — the Delivery tab of the Subscriptions hub
 * (/admin/crm/subscriptions). Broker-language delivery observability:
 *
 *   - one card per email stream (listing alerts, market reports, newsletters
 *     when they exist): sends, open rate, clicks, failures, last send;
 *   - a "needs attention" list where every item says what looks wrong and how
 *     to fix it, with a link to the fix;
 *   - a recent-sends table with per-send opened/clicked/bounced status.
 *
 * Data comes from getGlobalDeliverySummaryAction (read-only). The window
 * selector refetches; the initial payload is server-fetched by the page so the
 * tab renders with data immediately, like its sibling tabs.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getGlobalDeliverySummaryAction } from '@/app/actions/subscriptions-admin'
import type { GlobalDeliverySummary } from '@/lib/data/crm/emailDelivery'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { TableSkeleton } from '@/components/admin/crm/subscriptions/subscriptions-shared'
import {
  RelativeTime,
  SendStatusBadge,
  percentLabel,
} from '@/components/admin/crm/subscriptions/delivery-shared'

const WINDOW_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
] as const

export default function DeliveryTab({ initial }: { initial: GlobalDeliverySummary }) {
  const [summary, setSummary] = useState<GlobalDeliverySummary>(initial)
  const [windowDays, setWindowDays] = useState(String(initial.windowDays))
  const [isPending, startTransition] = useTransition()

  const changeWindow = (value: string) => {
    setWindowDays(value)
    startTransition(async () => {
      const res = await getGlobalDeliverySummaryAction(Number(value))
      if (!res.data) {
        toast.error(res.error ?? 'Could not load delivery data')
        return
      }
      setSummary(res.data)
    })
  }

  const totalSends = summary.streams.reduce((n, s) => n + s.sends, 0)

  return (
    <div className="space-y-4">
      {/* Window selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          What went out, who opened it, and what needs a fix.
        </p>
        <Select value={windowDays} onValueChange={changeWindow}>
          <SelectTrigger className="h-9 w-40" aria-label="Time window">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOW_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stream summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.streams.map((s) => (
          <Card key={s.stream}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-foreground">
                  {s.sends.toLocaleString('en-US')}
                </span>
                <span className="text-sm text-muted-foreground">{s.sends === 1 ? 'email sent' : 'emails sent'}</span>
              </div>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Opened</dt>
                  <dd className="tabular-nums text-foreground">
                    {s.opens.toLocaleString('en-US')} ({percentLabel(s.openRate)})
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Clicked</dt>
                  <dd className="tabular-nums text-foreground">{s.clicks.toLocaleString('en-US')}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Failed</dt>
                  <dd className="tabular-nums text-foreground">
                    {s.failures > 0 ? (
                      <span className="text-destructive">{s.failures.toLocaleString('en-US')}</span>
                    ) : (
                      '0'
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Last send</dt>
                  <dd><RelativeTime iso={s.lastSendAtIso} className="whitespace-nowrap text-foreground" /></dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalSends === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No emails went out in this window. Sends appear here automatically:
            listing alerts go out when new listings match someone&apos;s saved search,
            and market reports go out on each subscriber&apos;s cadence
            ({summary.subscriptionCounts.alertsActive.toLocaleString('en-US')} listing
            {summary.subscriptionCounts.alertsActive === 1 ? ' alert is' : ' alerts are'} active and{' '}
            {summary.subscriptionCounts.reportsActive.toLocaleString('en-US')} market report
            {summary.subscriptionCounts.reportsActive === 1 ? ' subscription is' : ' subscriptions are'} active
            right now). Try a longer window, or check back after the next send run.
          </CardContent>
        </Card>
      ) : null}

      {/* Attention list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Needs attention</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.attention.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Nothing needs attention right now. When a subscriber stops getting their
              emails, an address bounces, someone marks a message as spam, or a
              contact never opens anything, it shows up here with a suggested fix.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {summary.attention.map((item, i) => (
                <li key={`${item.kind}-${i}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.severity === 'problem' ? 'destructive' : 'warning'}>
                        {item.severity === 'problem' ? 'Problem' : 'Worth a look'}
                      </Badge>
                      <p className="text-sm font-medium text-foreground">{item.headline}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                    <p className="text-sm text-foreground">
                      <span className="font-medium">Fix:</span> {item.fix}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link href={item.fixHref}>{item.fixLabel}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            Bounces and spam complaints are tracked automatically. An email that fails
            at the moment of sending is not logged per person yet — for market reports
            it shows here as &ldquo;we tried but it didn&apos;t go out&rdquo;; listing alerts have no
            durable send-failure record today.
          </p>
        </CardContent>
      </Card>

      {/* Recent sends */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent sends</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <TableSkeleton rows={6} />
          ) : summary.recentSends.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No sends recorded in this window yet. Every listing alert, market report,
              and tracked email lands here the moment it goes out, with its opens and
              clicks as they happen.
            </p>
          ) : (
            <div className="no-scrollbar overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Stream</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.recentSends.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="max-w-72">
                        <p className="truncate text-sm text-foreground">{row.label}</p>
                      </TableCell>
                      <TableCell className="max-w-56">
                        {row.personId ? (
                          <Link
                            href={`/admin/console/leads/${row.personId}`}
                            className="block truncate text-sm text-foreground underline-offset-2 hover:underline"
                          >
                            {row.recipientEmail ?? 'View contact'}
                          </Link>
                        ) : (
                          <p className="truncate text-sm text-muted-foreground">{row.recipientEmail ?? '—'}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.streamLabel}</TableCell>
                      <TableCell className="text-sm tabular-nums">
                        <RelativeTime iso={row.sentAtIso} />
                      </TableCell>
                      <TableCell><SendStatusBadge status={row.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
