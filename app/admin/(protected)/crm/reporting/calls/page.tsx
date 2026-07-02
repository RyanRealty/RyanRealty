// @no-parity — internal admin surface
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronDown, Phone } from 'lucide-react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getCallsReport, type CallsRow, type CallsTotals } from '@/lib/data/crm/getCallsReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import CallsFilters from './CallsFilters'
import { ReportingTabStrip } from '@/components/admin/crm/reporting/ReportingTabStrip'

export const metadata = { title: 'Calls | Reporting | CRM' }
export const dynamic = 'force-dynamic'


// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format seconds as "N min M sec" or "—" when zero. */
function formatDuration(sec: number): string {
  if (sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s} sec`
  return `${m} min ${s} sec`
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────

/**
 * Calls-specific KPI tile.
 *
 * Unlike Agent Activity tiles, these have:
 *   - No sparkline
 *   - No delta vs previous period
 *   - A "N person/people" sub-label instead (when people > 0)
 *   - A plain text value slot for non-count metrics (Talk Time, Answer Time)
 */
function CallsKpiTile({
  label,
  value,
  subLabel,
  valueText,
}: {
  label: string
  /** Numeric count (shown large). Pass null to use valueText instead. */
  value?: number | null
  /** E.g. "1 person", "2 people", "—" */
  subLabel?: string
  /** Alternate display for duration/time metrics instead of a number. */
  valueText?: string
}) {
  return (
    <Card className="min-w-36 shrink-0 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-3xl font-bold leading-none tabular-nums text-foreground">
        {valueText ?? (value != null ? value.toLocaleString('en-US') : '—')}
      </p>
      {subLabel ? (
        <p className="mt-1 text-xs text-muted-foreground">{subLabel}</p>
      ) : (
        <div className="mt-1 h-4" /> /* spacer for height consistency */
      )}
    </Card>
  )
}

// ── Table cell helpers ────────────────────────────────────────────────────────

/**
 * Dual-value cell: primary count + "N person/people" sub-label.
 * Matches FUB's Calls table cell format: "2\n1 person" (stacked).
 */
function DualCell({ count, people }: { count: number; people: number }) {
  if (count === 0) {
    return <span className="tabular-nums text-muted-foreground">0</span>
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="tabular-nums font-medium text-foreground">{count}</span>
      {people > 0 ? (
        <span className="text-xs text-muted-foreground">
          {people} {people === 1 ? 'person' : 'people'}
        </span>
      ) : null}
    </div>
  )
}

/** Duration cell — shows formatted time or "—". */
function DurationCell({ sec }: { sec: number }) {
  if (sec <= 0) {
    return <span className="text-muted-foreground">—</span>
  }
  return <span className="tabular-nums text-foreground">{formatDuration(sec)}</span>
}

// ── Build KPI sub-labels ──────────────────────────────────────────────────────

function peopleLabel(people: number): string {
  if (people === 0) return ''
  return `${people} ${people === 1 ? 'person' : 'people'}`
}

// ── Page params ───────────────────────────────────────────────────────────────

type SearchParams = {
  broker?: string
  date?: string
  t?: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CallsReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope = scopeBroker(access)
  const isSuperuser = access.role === 'superuser'

  const datePreset = (sp.date ?? 'this_month') as string

  let brokerFilter: string | null = null
  if (isSuperuser) {
    brokerFilter = sp.broker && sp.broker !== 'everyone' ? sp.broker : null
  } else {
    brokerFilter = scope
  }

  const currentBroker = sp.broker ?? 'everyone'
  const currentDate = datePreset

  // Fetch report data
  const report = await getCallsReport({
    brokerSlug: brokerFilter,
    datePreset,
  }).catch(() => null)

  const rows: CallsRow[] = report?.rows ?? []
  const totals: CallsTotals = report?.totals ?? {
    callsMade: 0, callsMadePeople: 0,
    connected: 0, connectedPeople: 0,
    conversations: 0, conversationsPeople: 0,
    received: 0, receivedPeople: 0,
    missed: 0, missedPeople: 0,
    talkTimeSec: 0, answerTimeSec: null,
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <ReportingTabStrip active="calls" />

      {/* Header row: "Show me" selector + filter bar */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Show me</span>
          <div className="flex items-center gap-0.5">
            <span className="font-medium text-primary underline underline-offset-2">
              call report
            </span>
            <ChevronDown className="h-4 w-4 text-primary" />
          </div>
        </div>

        {/* Filter controls — agent + date (no lead-type per FUB Calls reference) */}
        {isSuperuser ? (
          <CallsFilters
            currentBroker={currentBroker}
            currentDate={currentDate}
            brokers={CRM_BROKERS.map((slug) => ({
              slug,
              label: CRM_BROKER_DISPLAY[slug],
            }))}
          />
        ) : null}
      </div>

      {/* Cache notice */}
      <p className="mb-6 text-xs text-muted-foreground">
        Reporting results may be cached for up to 10 minutes.{' '}
        <Link
          href={`/admin/crm/reporting/calls?broker=${currentBroker}&date=${currentDate}&t=${Date.now()}`}
          className="text-muted-foreground hover:underline"
        >
          Refresh results.
        </Link>
      </p>

      {/* ── KPI Tile strip ── */}
      {/*
        Order matches FUB Screen 6 exactly:
        CALLS MADE | CONNECTED | CONVERSATIONS | RECEIVED | CALLS MISSED | TALK TIME | ANSWER TIME

        Honest empty states for metrics without a data source:
        - CALLS MADE: 0 (outbound click-to-call not yet implemented)
        - CONNECTED PEOPLE: 0 (requires set-difference join — V1 approximation)
        - ANSWER TIME: "—" (not tracked; Twilio webhook fires before answer)
      */}
      <div className="no-scrollbar mb-6 flex gap-3 overflow-x-auto pb-2">
        <CallsKpiTile
          label="Calls Made"
          value={totals.callsMade}
          subLabel={totals.callsMadePeople > 0 ? peopleLabel(totals.callsMadePeople) : undefined}
        />
        <CallsKpiTile
          label="Connected"
          value={totals.connected}
          subLabel={totals.connectedPeople > 0 ? peopleLabel(totals.connectedPeople) : undefined}
        />
        <CallsKpiTile
          label="Conversations"
          value={totals.conversations}
          subLabel={totals.conversationsPeople > 0 ? peopleLabel(totals.conversationsPeople) : undefined}
        />
        <CallsKpiTile
          label="Received"
          value={totals.received}
          subLabel={totals.receivedPeople > 0 ? peopleLabel(totals.receivedPeople) : undefined}
        />
        <CallsKpiTile
          label="Calls Missed"
          value={totals.missed}
          subLabel={totals.missedPeople > 0 ? peopleLabel(totals.missedPeople) : undefined}
        />
        <CallsKpiTile
          label="Talk Time"
          valueText={totals.talkTimeSec > 0 ? formatDuration(totals.talkTimeSec) : '—'}
        />
        <CallsKpiTile
          label="Answer Time"
          valueText="—"
        />
      </div>

      {/* ── Per-broker breakdown table ── */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-44">Name</TableHead>
              <TableHead className="text-right text-xs">
                Calls Made
              </TableHead>
              <TableHead className="text-right text-xs">
                <span>Connected</span>
                <span className="ml-1 text-muted-foreground opacity-60" title="Answered inbound calls">ⓘ</span>
              </TableHead>
              <TableHead className="text-right text-xs">
                <span>Conversations</span>
                <span className="ml-1 text-muted-foreground opacity-60" title="Calls with recorded talk time">ⓘ</span>
              </TableHead>
              <TableHead className="text-right text-xs">Received</TableHead>
              <TableHead className="text-right text-xs">Calls Missed</TableHead>
              <TableHead className="text-right text-xs whitespace-pre-line">Total Talk{'\n'}Time</TableHead>
              <TableHead className="text-right text-xs">
                <span>Answer Time</span>
                <span className="ml-1 text-muted-foreground opacity-60" title="Not currently tracked">ⓘ</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  No call data for this period.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.brokerSlug} className="hover:bg-muted/40">
                  {/* Agent name + avatar */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {row.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.avatarUrl}
                          alt=""
                          className="h-7 w-7 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {row.brokerName.charAt(0)}
                        </span>
                      )}
                      <span className="text-sm font-medium text-foreground">
                        {row.brokerName}
                      </span>
                    </div>
                  </TableCell>

                  {/* Calls Made — outbound, not yet tracked */}
                  <TableCell className="text-right">
                    <DualCell count={row.callsMade} people={row.callsMadePeople} />
                  </TableCell>

                  {/* Connected — answered inbound calls */}
                  <TableCell className="text-right">
                    <DualCell count={row.connected} people={row.connectedPeople} />
                  </TableCell>

                  {/* Conversations — calls with recordingDurationSec > 0 */}
                  <TableCell className="text-right">
                    <DualCell count={row.conversations} people={row.conversationsPeople} />
                  </TableCell>

                  {/* Received — all inbound calls */}
                  <TableCell className="text-right">
                    <DualCell count={row.received} people={row.receivedPeople} />
                  </TableCell>

                  {/* Calls Missed — went to voicemail */}
                  <TableCell className="text-right">
                    <DualCell count={row.missed} people={row.missedPeople} />
                  </TableCell>

                  {/* Total Talk Time */}
                  <TableCell className="text-right">
                    <DurationCell sec={row.talkTimeSec} />
                  </TableCell>

                  {/* Answer Time — not tracked */}
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ── Call Logs link ── */}
      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Phone className="h-3.5 w-3.5" />
        <span>
          View individual call recordings and transcripts in{' '}
          <Link
            href="/admin/crm?filter=calls"
            className="text-primary hover:underline"
          >
            Call Logs
          </Link>
          .
        </span>
      </div>
    </div>
  )
}
