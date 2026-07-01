// @no-parity — internal admin surface; no mockup contract (CRM reporting suite)
/**
 * INFERRED report — no dedicated FUB screen was observed for this view.
 * Built to the described "Call Logs" feature: a chronological, broker-scoped,
 * paginated list of individual inbound calls and voicemails. The Calls report
 * (/admin/crm/reporting/calls) links here as the drill-down for individual
 * recording playback and transcripts.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronDown, PhoneCall, PhoneOff, PhoneMissed, PlayCircle, FileText } from 'lucide-react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getCallLogsReport,
  CALL_LOGS_PAGE_SIZE,
  type CallLogEntry,
  type CallLogOutcome,
} from '@/lib/data/crm/getCallLogsReport'
import { CRM_BROKER_DISPLAY, CRM_BROKERS } from '@/lib/crm/constants'
import { formatDate } from '@/lib/format/date'
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
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import CallsFilters from '../calls/CallsFilters'

export const metadata = { title: 'Call Logs | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Sub-nav tabs ──────────────────────────────────────────────────────────────
// "Call Logs" added between Calls and Texts for this page's tab strip.
// The parallel-build directive means we do not modify other pages' tab lists.
const REPORTING_TABS = [
  { label: 'Overview', href: '/admin/crm/reporting' },
  { label: 'Agent Activity', href: '/admin/crm/reporting/agent-activity' },
  { label: 'Properties', href: '/admin/crm/reporting/properties' },
  { label: 'Lead Sources', href: '/admin/crm/reporting/lead-sources' },
  { label: 'Calls', href: '/admin/crm/reporting/calls' },
  { label: 'Call Logs', href: '/admin/crm/reporting/call-logs', active: true },
  { label: 'Texts', href: '/admin/crm/reporting/texts' },
  { label: 'Batch Emails', href: '/admin/crm/reporting/batch-emails' },
  { label: 'Marketing', href: '/admin/crm/reporting/marketing' },
  { label: 'Deals', href: '/admin/crm/reporting/deals' },
  { label: 'Appointments', href: '/admin/crm/reporting/appointments' },
  { label: 'Agent Goals', href: '/admin/crm/reporting/agent-goals' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format seconds as "Xm Ys" for table cells, or "—" when null/zero. */
function formatDuration(sec: number | null): string {
  if (sec === null || sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}s`
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

/** Format an ISO timestamp as "Jun 25 · 10:48 AM" (Pacific, matching broker timezone). */
function formatCallTime(iso: string): string {
  const date = formatDate(iso, { month: 'short', day: 'numeric' })
  const time = formatDate(iso, { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date} · ${time}`
}

/** Format a E.164 phone number as "(541) 213-6706". */
function formatPhone(raw: string | null): string {
  if (!raw) return '—'
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') {
    const d = digits.slice(1)
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return raw
}

// ── Outcome badge ─────────────────────────────────────────────────────────────

const OUTCOME_LABELS: Record<CallLogOutcome, string> = {
  connected: 'Connected',
  received: 'Received',
  voicemail: 'Voicemail',
}

/** Lucide icon for each outcome — size kept consistent with table typography. */
function OutcomeIcon({ outcome }: { outcome: CallLogOutcome }) {
  if (outcome === 'connected') return <PhoneCall className="h-3.5 w-3.5 text-success" />
  if (outcome === 'voicemail') return <PhoneMissed className="h-3.5 w-3.5 text-warning-foreground" />
  return <PhoneOff className="h-3.5 w-3.5 text-muted-foreground" />
}

/** Outcome badge using semantic color tokens only (no raw Tailwind color-scale classes). */
function OutcomeBadge({ outcome }: { outcome: CallLogOutcome }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'flex w-fit items-center gap-1 text-xs',
        outcome === 'connected' && 'border-success/20 bg-success/10 text-success',
        outcome === 'voicemail' && 'border-warning/30 bg-warning/10 text-warning-foreground',
        outcome === 'received' && 'border-border bg-muted text-muted-foreground',
      )}
    >
      <OutcomeIcon outcome={outcome} />
      {OUTCOME_LABELS[outcome]}
    </Badge>
  )
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

/** Simple count tile — no sparkline (log view, not aggregate). */
function KpiTile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <Card className="min-w-32 shrink-0 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-3xl font-bold leading-none tabular-nums text-foreground">
        {value.toLocaleString('en-US')}
      </p>
      {note ? (
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      ) : (
        <div className="mt-1 h-4" />
      )}
    </Card>
  )
}

// ── Person cell ───────────────────────────────────────────────────────────────

/**
 * Link to the contact timeline. Displays the resolved name when available,
 * otherwise the formatted caller phone number (honest fallback — never hides data).
 */
function PersonCell({ entry }: { entry: CallLogEntry }) {
  const display = entry.personName ?? formatPhone(entry.fromNumber)
  return (
    <Link
      href={`/admin/crm/${entry.personId}`}
      className="text-sm text-primary hover:underline"
    >
      {display}
    </Link>
  )
}

// ── Recording / transcript cell ───────────────────────────────────────────────

/**
 * "Play" link opens the recording MP3 in a new tab (admin proxy route).
 * "Transcript" link navigates to the contact's timeline for inline reading.
 * "—" when neither exists.
 */
function RecordingCell({ entry }: { entry: CallLogEntry }) {
  if (!entry.hasRecording && !entry.hasTranscript) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <div className="flex items-center gap-3">
      {entry.recordingPath ? (
        <a
          href={entry.recordingPath}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
          title="Stream call recording"
        >
          <PlayCircle className="h-3.5 w-3.5" />
          Play
        </a>
      ) : null}
      {entry.hasTranscript ? (
        <Link
          href={`/admin/crm/${entry.personId}?tab=timeline`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          title="View transcript in contact timeline"
        >
          <FileText className="h-3 w-3" />
          Transcript
        </Link>
      ) : null}
    </div>
  )
}

// ── Search params ─────────────────────────────────────────────────────────────

type SearchParams = {
  broker?: string
  date?: string
  page?: string
  t?: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CallLogsPage({
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
  const currentPage = Math.max(0, parseInt(sp.page ?? '0', 10) || 0)

  let brokerFilter: string | null = null
  if (isSuperuser) {
    brokerFilter = sp.broker && sp.broker !== 'everyone' ? sp.broker : null
  } else {
    brokerFilter = scope
  }

  const currentBroker = sp.broker ?? 'everyone'
  const currentDate = datePreset

  // Fetch paginated call log entries
  const report = await getCallLogsReport({
    brokerSlug: brokerFilter,
    datePreset,
    page: currentPage,
  }).catch(() => null)

  const entries: CallLogEntry[] = report?.entries ?? []
  const totalCount = report?.totalCount ?? 0
  const callCount = report?.callCount ?? 0
  const voicemailCount = report?.voicemailCount ?? 0

  // Pagination metadata
  const totalPages = Math.max(1, Math.ceil(totalCount / CALL_LOGS_PAGE_SIZE))
  const showingFrom = totalCount === 0 ? 0 : currentPage * CALL_LOGS_PAGE_SIZE + 1
  const showingTo = Math.min((currentPage + 1) * CALL_LOGS_PAGE_SIZE, totalCount)

  /** Build a URL that preserves broker + date filters and changes only the page. */
  function pageHref(p: number): string {
    const params = new URLSearchParams({
      broker: currentBroker,
      date: currentDate,
      page: String(p),
    })
    return `/admin/crm/reporting/call-logs?${params.toString()}`
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Sub-nav tab strip */}
      <div className="mb-6 flex items-center border-b border-border">
        <div className="no-scrollbar flex items-center gap-0 overflow-x-auto">
          {REPORTING_TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                tab.active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto shrink-0 pb-0.5 pl-4">
          <Badge variant="outline" className="text-muted-foreground">
            ⓘ How Reporting works
          </Badge>
        </div>
      </div>

      {/* Header row: "Show me" selector + filter bar */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Show me</span>
          <div className="flex items-center gap-0.5">
            <span className="font-medium text-primary underline underline-offset-2">
              call log
            </span>
            <ChevronDown className="h-4 w-4 text-primary" />
          </div>
        </div>

        {/* Reuses CallsFilters — identical broker + date filter bar.
            usePathname() inside the component resolves the call-logs URL,
            so navigation updates this page's params correctly. */}
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
          href={`/admin/crm/reporting/call-logs?broker=${currentBroker}&date=${currentDate}&t=${Date.now()}`}
          className="text-muted-foreground hover:underline"
        >
          Refresh results.
        </Link>
      </p>

      {/*
        ── KPI tile strip ──

        Three tiles: Calls (kind='call') · Voicemails (kind='voicemail') · Total.

        V1 note: a dedicated "Connected" tile is intentionally omitted here.
        Connected count requires filtering on a JSONB subkey (payload.recordingSid),
        which needs a raw SQL expression not expressible in a count:'exact' PostgREST
        query. The per-row outcome badge below is the correct place to read connected
        status. The aggregate Connected count lives on the parent Calls report.
      */}
      <div className="no-scrollbar mb-6 flex gap-3 overflow-x-auto pb-2">
        <KpiTile label="Calls" value={callCount} note="all inbound" />
        <KpiTile label="Voicemails" value={voicemailCount} note="missed calls" />
        <KpiTile label="Total" value={totalCount} note="calls + voicemails" />
      </div>

      {/* ── Log table ── */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-44 text-xs">Date / Time</TableHead>
              <TableHead className="w-48 text-xs">Person</TableHead>
              <TableHead className="w-32 text-xs">Agent</TableHead>
              <TableHead className="w-24 text-xs">
                Direction
                <span
                  className="ml-1 text-muted-foreground opacity-60"
                  title="Inbound only in V1 — outbound click-to-call not yet tracked"
                >
                  ⓘ
                </span>
              </TableHead>
              <TableHead className="w-24 text-right text-xs">Duration</TableHead>
              <TableHead className="w-36 text-xs">Outcome</TableHead>
              <TableHead className="text-xs">Recording</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-16 text-center text-sm text-muted-foreground"
                >
                  No calls in this period.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-muted/40">
                  {/* Date / time — Pacific, matches broker timezone */}
                  <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {formatCallTime(entry.ts)}
                  </TableCell>

                  {/* Person — linked; phone fallback for unresolved callers */}
                  <TableCell>
                    <PersonCell entry={entry} />
                  </TableCell>

                  {/* Agent */}
                  <TableCell className="text-sm text-foreground">
                    {entry.brokerName ?? '—'}
                  </TableCell>

                  {/* Direction — always Inbound in V1 */}
                  <TableCell>
                    <span className="text-xs text-muted-foreground">Inbound</span>
                  </TableCell>

                  {/* Duration — "—" for voicemails and unrecorded calls */}
                  <TableCell className="text-right tabular-nums text-sm text-foreground">
                    {formatDuration(entry.durationSec)}
                  </TableCell>

                  {/* Outcome badge */}
                  <TableCell>
                    <OutcomeBadge outcome={entry.outcome} />
                  </TableCell>

                  {/* Play / Transcript links */}
                  <TableCell>
                    <RecordingCell entry={entry} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ── Pagination ── */}
      {totalCount > 0 ? (
        <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <p className="tabular-nums">
            Showing {showingFrom.toLocaleString('en-US')}–{showingTo.toLocaleString('en-US')} of{' '}
            {totalCount.toLocaleString('en-US')}
          </p>

          <div className="flex items-center gap-2">
            {currentPage > 0 ? (
              <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                <Link href={pageHref(currentPage - 1)}>Previous</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled>
                Previous
              </Button>
            )}
            <span className="tabular-nums">
              Page {currentPage + 1} of {totalPages}
            </span>
            {currentPage < totalPages - 1 ? (
              <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                <Link href={pageHref(currentPage + 1)}>Next</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="h-8 text-xs" disabled>
                Next
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {/* Back link */}
      <div className="mt-6 text-xs text-muted-foreground">
        <Link href="/admin/crm/reporting/calls" className="hover:underline">
          ← Back to Calls report
        </Link>
      </div>
    </div>
  )
}
