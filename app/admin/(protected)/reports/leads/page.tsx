import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import DashboardSummaryStrip, { type SummaryStat } from '@/components/admin/DashboardSummaryStrip'
import { getLeadIntake } from '@/lib/data'

/** Admin page — never pre-render; reads the CRM at runtime. */
export const dynamic = 'force-dynamic'

/**
 * Lead analytics — real inbound leads captured in the native CRM (crm_people).
 *
 * Repointed 2026-07-12 off the legacy profiles / user_activities account tables
 * (the pre-FUB-cutover site-auth system, disjoint from the CRM) onto getLeadIntake,
 * the single source of truth every dashboard now shares. "Inbound" excludes the
 * bulk prospecting/import lists (Farm, Import, Sphere, Expired) so the numbers
 * reflect marketing performance, not list-building.
 */
export default async function AdminLeadsReportPage() {
  const nowMs = new Date().getTime()
  const startIso = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString()
  const endIso = new Date(nowMs).toISOString()
  const intake = await getLeadIntake({ startIso, endIso })

  const topChannel = intake.byChannel.find((c) => c.attributable) ?? null

  const funnelStats: SummaryStat[] = [
    {
      label: 'Inbound leads',
      value: intake.inboundLeads.toLocaleString('en-US'),
      caption: 'Last 7 days',
    },
    {
      label: 'Top channel',
      value: topChannel ? topChannel.label : 'no data',
      caption: topChannel ? `${topChannel.count.toLocaleString('en-US')} leads` : 'No leads yet',
    },
    {
      label: 'Outreach added',
      value: intake.outreachAdded.toLocaleString('en-US'),
      caption: 'Prospecting / import lists (not leads)',
    },
  ]

  const channelRows = intake.byChannel.filter((c) => c.attributable)
  const brokerRows = intake.byBroker
  const sourceRows = intake.bySource.slice(0, 10)

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Lead analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inbound leads captured in the CRM over the last 7 days, by channel, broker, and source.
          {intake.unreadable ? ' (CRM temporarily unreadable — showing zeros.)' : ''}
        </p>
      </div>

      <DashboardSummaryStrip stats={funnelStats} />

      <Card>
        <CardHeader><CardTitle className="text-base">Leads by channel</CardTitle></CardHeader>
        <CardContent>
          {channelRows.length > 0 ? (
            <ul className="space-y-2">
              {channelRows.map((r) => (
                <li key={r.channel} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">{r.count.toLocaleString('en-US')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No inbound leads in the last 7 days.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Leads by broker</CardTitle></CardHeader>
        <CardContent>
          {brokerRows.length > 0 ? (
            <ul className="space-y-2">
              {brokerRows.map((r) => (
                <li key={r.broker} className="flex items-center justify-between gap-3 text-sm">
                  <span className="capitalize text-muted-foreground">{r.broker}</span>
                  <span className="font-semibold tabular-nums text-foreground">{r.count.toLocaleString('en-US')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No assigned leads in the last 7 days.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Top sources</CardTitle></CardHeader>
        <CardContent>
          {sourceRows.length > 0 ? (
            <ul className="space-y-2">
              {sourceRows.map((r) => (
                <li key={r.source} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{r.source}</span>
                  <span className="font-semibold tabular-nums text-foreground">{r.count.toLocaleString('en-US')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No lead sources in the last 7 days.</p>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        <Link href="/admin/analytics" className="underline hover:no-underline">Back to Performance</Link>
      </p>
    </main>
  )
}
