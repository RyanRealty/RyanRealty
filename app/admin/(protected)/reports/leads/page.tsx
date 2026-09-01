// @no-parity — internal admin surface, no public mockup contract.
//
// Lead analytics — real inbound leads captured in the native CRM (crm_people).
//
// Repointed 2026-07-12 off the legacy profiles / user_activities account tables
// (the pre-CRM-cutover site-auth system, disjoint from the CRM) onto
// getLeadIntake, the single source of truth every dashboard now shares.
// "Inbound" excludes the bulk prospecting/import lists (Farm, Import, Sphere,
// Expired) so the numbers reflect marketing performance, not list-building.
//
// 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md)
// through the reporting family's shared presentation kit
// (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: the rolling 7-day window (startIso = now − 7 days,
// endIso = now), the single getLeadIntake read, topChannel's definition
// (the first attributable channel in the DAL's attributable-first,
// count-descending order), all three figures and their captions, the
// attributable-only channel filter, the full byBroker list, the bySource
// slice(0, 10), every count's 'en-US' formatting, all three empty-state
// sentences, and the /admin/analytics back link. No metric, date window, filter
// default, sort order, unit or rounding moved.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the page-title <h1> is gone (the nav names the page), the KPI
// strip became the family's typographic numbers strip (captions folded into the
// labels, same text), and the three shadcn Card lists became the family's grid.
//
// ONE truth correction (§0): an unreadable CRM rendered a full report of zeros
// with "(CRM temporarily unreadable — showing zeros.)" appended to the subhead.
// Zeros next to a caveat still read as "nothing happened this week" to a broker.
// A failed read now leads, and the zeros are labelled as not a measurement.
import Link from 'next/link'
import { getLeadIntake } from '@/lib/data'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import {
  SectionHead,
  VerdictLine,
  ReportGrid,
  ReportNumbers,
  ReportError,
  type ReportColumn,
  type ReportGridRow,
  type ReportNumberItem,
} from '@/components/admin/v2'

/** Admin page — never pre-render; reads the CRM at runtime. */
export const dynamic = 'force-dynamic'

/** The old Top sources card showed the ten biggest. Carried over. */
const SOURCE_CAP = 10

const COUNT_COLUMN: ReportColumn = { key: 'count', label: 'Leads', numeric: true }

export default async function AdminLeadsReportPage() {
  const nowMs = new Date().getTime()
  const startIso = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString()
  const endIso = new Date(nowMs).toISOString()
  const [intake, brokers] = await Promise.all([
    getLeadIntake({ startIso, endIso }),
    getCrmBrokers(),
  ])
  const brokerIdBySlug = new Map(brokers.filter((b) => b.id != null).map((b) => [b.slug, b.id as number]))

  const topChannel = intake.byChannel.find((c) => c.attributable) ?? null
  const unreadable = intake.unreadable

  const figures: ReportNumberItem[] = [
    {
      key: 'inbound',
      label: 'Inbound leads · last 7 days',
      value: intake.inboundLeads.toLocaleString('en-US'),
    },
    {
      key: 'top',
      label: topChannel
        ? `Top channel · ${topChannel.count.toLocaleString('en-US')} leads`
        : 'Top channel · no leads yet',
      value: topChannel ? topChannel.label : 'no data',
    },
    {
      key: 'outreach',
      label: 'Outreach added · prospecting and import lists, not leads',
      value: intake.outreachAdded.toLocaleString('en-US'),
    },
  ]

  const channelRows = intake.byChannel.filter((c) => c.attributable)
  const brokerRows = intake.byBroker
  const sourceRows = intake.bySource.slice(0, SOURCE_CAP)

  const countCell = (n: number) => n.toLocaleString('en-US')

  const channelGrid: ReportGridRow[] = channelRows.map((r) => ({
    key: r.channel,
    cells: [r.label, countCell(r.count)],
  }))

  const brokerGrid: ReportGridRow[] = brokerRows.map((r) => {
    const id = brokerIdBySlug.get(r.broker)
    return {
      key: r.broker,
      cells: [
        id != null ? (
          <Link key="b" href={`/admin/brokers/edit?id=${id}`} style={{ textTransform: 'capitalize', color: 'var(--a-accent)' }}>
            {r.broker}
          </Link>
        ) : (
          <span key="b" style={{ textTransform: 'capitalize' }}>
            {r.broker}
          </span>
        ),
        countCell(r.count),
      ],
    }
  })

  const sourceGrid: ReportGridRow[] = sourceRows.map((r) => ({
    key: r.source,
    cells: [r.source, countCell(r.count)],
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 860, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={unreadable ? 'attention' : 'ok'}>
          {unreadable ? (
            <>
              <b>The CRM could not be read.</b> Every figure below is a zero the page had to
              print, not a measurement.
            </>
          ) : (
            <>
              <b>
                {intake.inboundLeads.toLocaleString('en-US')} inbound{' '}
                {intake.inboundLeads === 1 ? 'lead' : 'leads'} in the last 7 days
              </b>{' '}
              across {channelRows.length} {channelRows.length === 1 ? 'channel' : 'channels'}.
            </>
          )}
        </VerdictLine>
      </div>

      {unreadable ? <ReportError what="Lead intake" href="/admin/reports/leads" /> : null}

      <ReportNumbers items={figures} />

      <SectionHead>Leads by channel</SectionHead>
      <ReportGrid
        label="Inbound leads by channel"
        columns={[{ key: 'channel', label: 'Channel' }, COUNT_COLUMN]}
        template="minmax(160px, 2fr) minmax(80px, 0.7fr)"
        minWidth={320}
        rows={channelGrid}
        empty={<>No inbound leads in the last 7 days.</>}
      />

      <SectionHead>Leads by broker</SectionHead>
      <ReportGrid
        label="Inbound leads by broker"
        columns={[{ key: 'broker', label: 'Broker' }, COUNT_COLUMN]}
        template="minmax(160px, 2fr) minmax(80px, 0.7fr)"
        minWidth={320}
        rows={brokerGrid}
        empty={<>No assigned leads in the last 7 days.</>}
      />

      <SectionHead>Top sources</SectionHead>
      <ReportGrid
        label="Inbound leads by source"
        columns={[{ key: 'source', label: 'Source' }, COUNT_COLUMN]}
        template="minmax(160px, 2fr) minmax(80px, 0.7fr)"
        minWidth={320}
        rows={sourceGrid}
        empty={<>No lead sources in the last 7 days.</>}
      />
      {intake.bySource.length > SOURCE_CAP ? (
        <p
          style={{
            fontSize: 'var(--a-text-xs)',
            color: 'var(--a-text-2)',
            fontVariantNumeric: 'tabular-nums',
            marginTop: 10,
          }}
        >
          Showing {SOURCE_CAP} of {intake.bySource.length}.
        </p>
      ) : null}

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        All three lists are ordered by count, most first. A lead counts when the contact was
        created in the window; rows added from prospecting or import lists are counted as outreach,
        not as leads.{' '}
        <Link href="/admin/analytics" style={{ color: 'var(--a-accent)' }}>
          Back to Performance
        </Link>
      </p>
    </div>
  )
}
