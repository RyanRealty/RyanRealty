// @no-parity — internal admin surface
/**
 * /admin/crm/reporting/westside — the West Side cohort activity report.
 *
 * Answers "which parcel-linked people visited, opened, clicked, or messaged us
 * this window" from the westside_parcels ledger via getWestsideCohortActivity
 * (same DAL the weekly westside-cohort-digest cron email renders). Capability
 * guard identical to every sibling reporting page: getCrmAccess or redirect.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  getWestsideCohortActivity,
  type WestsideCohortActivity,
} from '@/lib/data/crm/getWestsideCohortActivity'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format/date'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ReportingTabStrip } from '@/components/admin/crm/reporting/ReportingTabStrip'

export const metadata = { title: 'West Side Cohort | Reporting | CRM' }
export const dynamic = 'force-dynamic'

const DAY_PRESETS = [7, 14, 30] as const
type DayPreset = (typeof DAY_PRESETS)[number]

function parseDays(raw: string | undefined): DayPreset {
  const n = Number(raw)
  return (DAY_PRESETS as readonly number[]).includes(n) ? (n as DayPreset) : 7
}

function fmtInt(n: number): string {
  return n.toLocaleString('en-US')
}

function fmtDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return formatDate(d, { year: undefined })
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-1 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums text-foreground">{fmtInt(value)}</div>
    </Card>
  )
}

export default async function WestsideCohortPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const days = parseDays(sp.days)

  const report: WestsideCohortActivity | null = await getWestsideCohortActivity({
    sinceDays: days,
  }).catch(() => null)

  const rollup = report?.rollup ?? {
    identifiedPeople: 0,
    linkedParcels: 0,
    activePeople: 0,
    siteVisits: 0,
    opens: 0,
    clicks: 0,
    inboundMessages: 0,
  }
  const people = report?.people ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <ReportingTabStrip active={null} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">West Side cohort</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Parcel-linked owner activity
            {report ? ` since ${fmtDay(report.windowStartIso)}` : ''} across{' '}
            <span className="tabular-nums">{fmtInt(rollup.linkedParcels)}</span> linked parcels.
            Emailed weekly as the West Side digest.
          </p>
        </div>

        {/* Window presets */}
        <div className="flex items-center gap-1.5">
          {DAY_PRESETS.map((d) => (
            <Link
              key={d}
              href={`/admin/crm/reporting/westside?days=${d}`}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                d === days
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {d} days
            </Link>
          ))}
        </div>
      </div>

      {report === null ? (
        <Card className="p-6 text-sm text-muted-foreground">
          The cohort report could not be loaded. Reload the page, and check
          westside_parcels person links if it persists.
        </Card>
      ) : (
        <>
          {/* Rollup KPI row */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Identified owners" value={rollup.identifiedPeople} />
            <KpiCard label="Active this window" value={rollup.activePeople} />
            <KpiCard label="Site visits" value={rollup.siteVisits} />
            <KpiCard label="Email opens" value={rollup.opens} />
            <KpiCard label="Email clicks" value={rollup.clicks} />
            <KpiCard label="Inbound messages" value={rollup.inboundMessages} />
          </div>

          {/* Active cohort members */}
          <Card className="no-scrollbar overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Parcel</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Inbound</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      {rollup.identifiedPeople === 0
                        ? 'No parcels are linked to a CRM person yet.'
                        : `No cohort activity in the last ${days} days. ${fmtInt(rollup.identifiedPeople)} identified owners stayed quiet.`}
                    </TableCell>
                  </TableRow>
                ) : (
                  people.map((p) => {
                    const firstParcel = p.parcels[0]
                    const address = firstParcel?.siteStreet ?? firstParcel?.apn ?? ''
                    return (
                      <TableRow key={p.personId} className="hover:bg-muted/40">
                        <TableCell>
                          <Link
                            href={`/admin/crm/${p.personId}`}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            {p.name ?? `Person #${p.personId}`}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {address}
                          {p.parcels.length > 1 ? (
                            <Badge variant="secondary" className="ml-1.5 tabular-nums">
                              +{p.parcels.length - 1}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.stage ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <NumCell value={p.visits} />
                        </TableCell>
                        <TableCell className="text-right">
                          <NumCell value={p.opens} />
                        </TableCell>
                        <TableCell className="text-right">
                          <NumCell value={p.clicks} />
                        </TableCell>
                        <TableCell className="text-right">
                          <NumCell value={p.inbound} />
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {fmtInt(p.score)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {fmtDay(p.lastSeenIso)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}

/** Numeric cell: zero renders muted, non-zero renders emphasized. Tabular nums. */
function NumCell({ value }: { value: number }) {
  return (
    <span className={cn('tabular-nums', value === 0 ? 'text-muted-foreground' : 'text-foreground')}>
      {fmtInt(value)}
    </span>
  )
}
