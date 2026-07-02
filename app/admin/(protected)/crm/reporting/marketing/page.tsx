// @no-parity — internal admin surface
//
// §11.15 Marketing (UTM) Report. Plain title (no "Show me" selector per spec),
// subtitle with a cross-link to the Lead Sources tab, date filter, and a
// Platform / Leads / Appointments / Deals Closed / Deal Value table computed
// from real visitor_sessions UTM capture + contact-attributed outcomes.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getMarketingUtmReport } from '@/lib/data/crm/getMarketingUtmReport'
import type { DatePreset } from '@/lib/data/crm/getAgentActivityReport'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import MarketingFilters from './MarketingFilters'
import { ReportingTabStrip } from '@/components/admin/crm/reporting/ReportingTabStrip'

export const metadata = { title: 'Marketing | Reporting | CRM' }
export const dynamic = 'force-dynamic'


function NumCell({ value }: { value: number }) {
  return (
    <span
      className={cn(
        'tabular-nums',
        value > 0 ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {value.toLocaleString('en-US')}
    </span>
  )
}

export default async function MarketingReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const datePreset = (sp.date ?? 'this_month') as DatePreset

  const report = await getMarketingUtmReport(datePreset).catch(() => null)
  const rows = report?.rows ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <ReportingTabStrip active="marketing" />

      {/* Header: plain title + subtitle with cross-link (§11.15) */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Marketing Report</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Report based on UTM parameters, view the{' '}
            <Link
              href="/admin/crm/reporting/lead-sources"
              className="text-primary hover:underline"
            >
              Lead Source report
            </Link>{' '}
            for all sources.
          </p>
        </div>
        <MarketingFilters currentDate={datePreset} />
      </div>

      {/* Cache notice */}
      <p className="mb-6 text-xs text-muted-foreground">
        Reporting results may be cached for up to 10 minutes.{' '}
        <Link
          href={`/admin/crm/reporting/marketing?date=${datePreset}&t=${Date.now()}`}
          className="text-muted-foreground hover:underline"
        >
          Refresh results.
        </Link>
      </p>

      {/* UTM breakdown table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Platform</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Appointments</TableHead>
              <TableHead className="text-right">Deals Closed</TableHead>
              <TableHead className="text-right">Deal Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No sessions with UTM parameters in this period.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.platform} className="hover:bg-muted/40">
                  <TableCell className="text-sm font-medium text-foreground">
                    {row.platform}
                  </TableCell>
                  <TableCell className="text-right">
                    <NumCell value={row.sessions} />
                  </TableCell>
                  <TableCell className="text-right">
                    <NumCell value={row.leads} />
                  </TableCell>
                  <TableCell className="text-right">
                    <NumCell value={row.appointments} />
                  </TableCell>
                  <TableCell className="text-right">
                    <NumCell value={row.dealsClosed} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums',
                      row.dealValue > 0 ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    ${Math.round(row.dealValue).toLocaleString('en-US')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Platform = utm_source captured on website sessions. Leads = identified CRM
          contacts among those sessions. Appointments and closed deals are
          contact-attributed.
        </p>
      </Card>

      {/* Mobile note — table is horizontally scrollable on small screens */}
      <div className="mt-4 md:hidden">
        <p className="text-xs text-muted-foreground">
          Rotate or widen the screen to see all columns.
        </p>
      </div>
    </div>
  )
}
