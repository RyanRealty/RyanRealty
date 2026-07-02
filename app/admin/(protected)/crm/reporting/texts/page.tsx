// @no-parity — internal admin surface
//
// INFERRED REPORT: no dedicated FUB GIF frame was captured for the Texts tab.
// Layout, KPI strip, and table mirror the Calls report + standard FUB Texts
// reporting conventions (sent / received / conversations / response rate).
// If a reference frame is later captured, align any divergences then.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronDown, MessageSquare } from 'lucide-react'
import { getCrmAccess } from '@/app/actions/crm'
import { scopeBroker } from '@/lib/crm/scope'
import { getTextsReport, type TextsRow, type TextsTotals } from '@/lib/data/crm/getTextsReport'
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
import TextsFilters from './TextsFilters'
import { ReportingTabStrip } from '@/components/admin/crm/reporting/ReportingTabStrip'

export const metadata = { title: 'Texts | Reporting | CRM' }
export const dynamic = 'force-dynamic'


// ── KPI Tile ──────────────────────────────────────────────────────────────────

/**
 * Texts-specific KPI tile.
 * No sparkline, no delta vs previous period — mirrors Calls KPI tile structure.
 * Sub-label shows "N person/people" (count metric) or is omitted (rate metric).
 */
function TextsKpiTile({
  label,
  value,
  subLabel,
  valueText,
}: {
  label: string
  value?: number | null
  subLabel?: string
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
        <div className="mt-1 h-4" />
      )}
    </Card>
  )
}

// ── Table cell helpers ────────────────────────────────────────────────────────

/**
 * Dual-value cell: primary count + "N person/people" sub-label.
 * Mirrors the DualCell component from the Calls report.
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

/** Rate cell — shows "N%" or "—" when null. */
function RateCell({ rate }: { rate: number | null }) {
  if (rate == null) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span className="tabular-nums text-foreground">
      {rate.toLocaleString('en-US', { maximumFractionDigits: 1 })}%
    </span>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

export default async function TextsReportPage({
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
  const report = await getTextsReport({
    brokerSlug: brokerFilter,
    datePreset,
  }).catch(() => null)

  const rows: TextsRow[] = report?.rows ?? []
  const totals: TextsTotals = report?.totals ?? {
    sent: 0,
    sentPeople: 0,
    received: 0,
    receivedPeople: 0,
    conversations: 0,
    responseRate: null,
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <ReportingTabStrip active="texts" />

      {/* Header row: "Show me" selector + filter bar */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Show me</span>
          <div className="flex items-center gap-0.5">
            <span className="font-medium text-primary underline underline-offset-2">
              text report
            </span>
            <ChevronDown className="h-4 w-4 text-primary" />
          </div>
        </div>

        {/* Filter controls — agent + date */}
        {isSuperuser ? (
          <TextsFilters
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
          href={`/admin/crm/reporting/texts?broker=${currentBroker}&date=${currentDate}&t=${Date.now()}`}
          className="text-muted-foreground hover:underline"
        >
          Refresh results.
        </Link>
      </p>

      {/* ── KPI Tile strip ── */}
      {/*
        INFERRED metric order — mirrors standard FUB Texts report layout:
        TEXTS SENT | TEXTS RECEIVED | CONVERSATIONS | RESPONSE RATE

        Honest empty states:
        - RESPONSE RATE: "—" when no texts sent (cannot divide by zero)
          Source: conversations / sentPeople × 100; displayed as "X%"
      */}
      <div className="no-scrollbar mb-6 flex gap-3 overflow-x-auto pb-2">
        <TextsKpiTile
          label="Texts Sent"
          value={totals.sent}
          subLabel={totals.sentPeople > 0 ? peopleLabel(totals.sentPeople) : undefined}
        />
        <TextsKpiTile
          label="Texts Received"
          value={totals.received}
          subLabel={totals.receivedPeople > 0 ? peopleLabel(totals.receivedPeople) : undefined}
        />
        <TextsKpiTile
          label="Conversations"
          value={totals.conversations}
          subLabel={
            totals.conversations > 0 ? `${totals.conversations} ${totals.conversations === 1 ? 'person' : 'people'}` : undefined
          }
        />
        <TextsKpiTile
          label="Response Rate"
          valueText={
            totals.responseRate != null
              ? `${totals.responseRate.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`
              : '—'
          }
        />
      </div>

      {/* ── Per-broker breakdown table ── */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-44">Name</TableHead>
              <TableHead className="text-right text-xs">Texts Sent</TableHead>
              <TableHead className="text-right text-xs">Texts Received</TableHead>
              <TableHead className="text-right text-xs">
                <span>Conversations</span>
                <span
                  className="ml-1 text-muted-foreground opacity-60"
                  title="People who both received and replied to a text"
                >
                  ⓘ
                </span>
              </TableHead>
              <TableHead className="text-right text-xs">
                <span>Response Rate</span>
                <span
                  className="ml-1 text-muted-foreground opacity-60"
                  title="% of texted people who replied back"
                >
                  ⓘ
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No text data for this period.
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

                  {/* Texts Sent */}
                  <TableCell className="text-right">
                    <DualCell count={row.sent} people={row.sentPeople} />
                  </TableCell>

                  {/* Texts Received */}
                  <TableCell className="text-right">
                    <DualCell count={row.received} people={row.receivedPeople} />
                  </TableCell>

                  {/* Conversations — 2-way threads */}
                  <TableCell className="text-right">
                    {row.conversations === 0 ? (
                      <span className="tabular-nums text-muted-foreground">0</span>
                    ) : (
                      <span className="tabular-nums font-medium text-foreground">
                        {row.conversations}
                      </span>
                    )}
                  </TableCell>

                  {/* Response Rate */}
                  <TableCell className="text-right">
                    <RateCell rate={row.responseRate} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ── Texts link ── */}
      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        <span>
          Read and reply to individual text conversations in the{' '}
          <Link href="/admin/crm/inbox" className="text-primary hover:underline">
            Inbox
          </Link>
          .
        </span>
      </div>
    </div>
  )
}
