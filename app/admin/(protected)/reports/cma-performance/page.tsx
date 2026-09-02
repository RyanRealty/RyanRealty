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
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md)
 * through the reporting family's shared presentation kit
 * (@/components/admin/v2). Presentation only.
 *
 * Carried over verbatim: the requireAdminPage('prospecting.view') guard, the
 * DOC_TYPES set, the `docType` parse and its 'all' default, the `sent === '1'`
 * parse, the getCmaPerformance read and its pageSize: 100, the rate() helper
 * (dash on a zero denominator, Math.round to whole percent), all five funnel
 * figures and the denominator each is quoted against, all nine columns and
 * their labels, formatPrice for the recommended list (NOT formatPriceExact —
 * formatPrice is what this column has always used and it rounds to the nearest
 * $1,000; swapping it would move the number), formatDate for both stamps, the
 * /cma/<slug> href on every address, the ?docType= / &sent=1 query contract, and
 * the DAL's created_at-descending order. No metric, date window, filter default,
 * sort order, unit or rounding moved.
 *
 * Shape changed, data did not: the page-title <h1> is gone (the nav names the
 * page), the funnel Card became the family's typographic numbers strip, the
 * shadcn table + its parallel mobile card list became the family's grid (one
 * source of markup, scrolling inside its own box), the doc-type Badge became
 * plain text — a document type is a category, and the admin's color vocabulary
 * is reserved for status (ADMIN_UI §1) — and the row of five filter pills became
 * two dropdowns (ADMIN_UI §3 acceptance bar rule 2 bans chip walls).
 *
 * TWO honesty additions, neither of which moves a figure:
 *   - The read caps at 100 rows and the page said nothing when it truncated.
 *     It now prints "Showing N of M" from the DAL's own total.
 *   - getCmaPerformance returns zeros with no flag when its read fails
 *     (getCmaPerformance.ts:100-105 and the EMPTY_RESULT fallback), so this page
 *     genuinely cannot tell an empty filter from a failed read. It now says so
 *     instead of presenting an all-zero funnel as a measurement (§0). Giving the
 *     DAL a real unreadable flag is the fix, and it is outside this file.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getCmaPerformance } from '@/lib/data/cma/getCmaPerformance'
import { formatPrice } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'
import {
  Button,
  SectionHead,
  SelectField,
  VerdictLine,
  ReportGrid,
  ReportNumbers,
  type ReportColumn,
  type ReportGridRow,
  type ReportNumberItem,
} from '@/components/admin/v2'

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

  const { rows, summary, total } = await getCmaPerformance({ docType, sentOnly, pageSize: 100 })

  const figures: ReportNumberItem[] = [
    { key: 'built', label: 'Built', value: String(summary.built) },
    {
      key: 'sent',
      label: `Sent · ${rate(summary.sent, summary.built)} of built`,
      value: String(summary.sent),
    },
    {
      key: 'opened',
      label: `Opened · ${rate(summary.opened, summary.sent)} of sent`,
      value: String(summary.opened),
    },
    {
      key: 'viewed',
      label: `Viewed the report · ${rate(summary.viewed, summary.sent)} of sent`,
      value: String(summary.viewed),
    },
    {
      key: 'any',
      label: `Any activity · ${rate(summary.anyActivity, summary.sent)} of sent`,
      value: String(summary.anyActivity),
    },
  ]

  const columns: ReportColumn[] = [
    { key: 'address', label: 'Address' },
    { key: 'client', label: 'Client' },
    { key: 'type', label: 'Type' },
    { key: 'rec', label: 'Recommended', numeric: true },
    { key: 'sent', label: 'Sent' },
    { key: 'opens', label: 'Opens', numeric: true },
    { key: 'clicks', label: 'Clicks', numeric: true },
    { key: 'views', label: 'Views', numeric: true },
    { key: 'last', label: 'Last activity' },
  ]

  const muted = { color: 'var(--a-text-2)' }

  const gridRows: ReportGridRow[] = rows.map((r) => ({
    key: r.id,
    cells: [
      <Link key="a" href={`/cma/${r.slug}`} style={{ color: 'var(--a-accent)' }}>
        {r.subjectAddress}
      </Link>,
      r.personId ? (
        <Link key="c" href={`/admin/people/${r.personId}`} style={{ color: 'var(--a-accent)' }}>
          {r.clientName ?? r.clientEmail ?? `Person ${r.personId}`}
        </Link>
      ) : (
        (r.clientName ?? <span key="c" style={muted}>—</span>)
      ),
      r.docType,
      formatPrice(r.recommendedList),
      r.deliveredAt ? (
        formatDate(r.deliveredAt)
      ) : (
        <span key="s" style={muted}>
          Not sent
        </span>
      ),
      r.engagement.emailOpens,
      r.engagement.emailClicks,
      r.engagement.reportViews,
      r.engagement.lastActivityAt ? (
        formatDate(r.engagement.lastActivityAt)
      ) : (
        <span key="l" style={muted}>
          —
        </span>
      ),
    ],
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={summary.built === 0 ? 'attention' : 'ok'}>
          {summary.built === 0 ? (
            <>
              <b>No document matches this filter.</b> This report cannot tell an empty result from
              a failed read, so treat the zeros as unknown rather than as none.
            </>
          ) : (
            <>
              <b>
                {summary.sent} of {summary.built} built{' '}
                {summary.built === 1 ? 'document was' : 'documents were'} sent,{' '}
                {summary.anyActivity} drew any activity.
              </b>{' '}
              Every rate below is quoted against the denominator named beside it.
            </>
          )}
        </VerdictLine>
      </div>

      {/* Filters — one compact control each, same ?docType= / &sent=1 contract. */}
      <form method="get" action="/admin/reports/cma-performance" className="av2-rfilters">
        <div className="av2-inline-form" style={{ maxWidth: 620 }}>
          <SelectField label="Document type" name="docType" defaultValue={docType}>
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Delivery" name="sent" defaultValue={sentOnly ? '1' : ''}>
            <option value="">Built or sent</option>
            <option value="1">Sent only</option>
          </SelectField>
          <Button type="submit">Apply</Button>
        </div>
      </form>

      <ReportNumbers items={figures} />

      <SectionHead>Every document, newest built first</SectionHead>
      <ReportGrid
        label="CMA send performance by document"
        columns={columns}
        template="minmax(180px, 2fr) minmax(120px, 1.2fr) minmax(96px, 0.8fr) minmax(104px, 0.9fr) minmax(104px, 0.9fr) minmax(66px, 0.5fr) minmax(66px, 0.5fr) minmax(66px, 0.5fr) minmax(104px, 0.9fr)"
        minWidth={1020}
        rows={gridRows}
        empty={<>No documents match this filter.</>}
      />

      {total > rows.length ? (
        <p
          style={{
            fontSize: 'var(--a-text-xs)',
            color: 'var(--a-text-2)',
            fontVariantNumeric: 'tabular-nums',
            marginTop: 10,
          }}
        >
          Showing {rows.length} of {total}.
        </p>
      ) : null}

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Opens and views are counted only on documents that were actually delivered, so each rate
        shares one denominator. The funnel is computed over every document matching the filter, not
        just the rows on screen.
      </p>
    </div>
  )
}
