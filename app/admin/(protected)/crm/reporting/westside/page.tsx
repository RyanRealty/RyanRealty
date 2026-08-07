// @no-parity — internal admin surface
/**
 * /admin/crm/reporting/westside — the West Side cohort activity report.
 *
 * Answers "which parcel-linked people visited, opened, clicked, or messaged us
 * this window" from the westside_parcels ledger via getWestsideCohortActivity
 * (same DAL the weekly westside-cohort-digest cron email renders). Capability
 * guard identical to every sibling reporting page: getCrmAccess or redirect.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md)
 * through the reporting family's shared presentation kit (@/components/admin/v2).
 * Presentation only. Carried over verbatim: the guard, `?days=` parsing
 * (parseDays, with its 7-day fallback for anything off-list), the
 * getWestsideCohortActivity({ sinceDays }) read and its catch-to-null, every
 * rollup and per-person figure, the DAL's score-desc ranking, and the person
 * hrefs. Only the window picker changed shape — three preset links became one
 * dropdown pushing the same `?days=` values, because the acceptance bar wants a
 * filter set as one compact control, not a row of pills.
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  getWestsideCohortActivity,
  type WestsideCohortActivity,
} from '@/lib/data/crm/getWestsideCohortActivity'
import { formatDate } from '@/lib/format/date'
import {
  SectionHead,
  VerdictLine,
  ReportGrid,
  ReportNumbers,
  ReportError,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import WestsideFilters from './WestsideFilters'
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


const COLUMNS: ReportColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'parcel', label: 'Parcel' },
  { key: 'stage', label: 'Stage' },
  { key: 'visits', label: 'Visits', numeric: true },
  { key: 'opens', label: 'Opens', numeric: true },
  { key: 'clicks', label: 'Clicks', numeric: true },
  { key: 'inbound', label: 'Inbound', numeric: true },
  { key: 'score', label: 'Score', numeric: true },
  { key: 'lastSeen', label: 'Last seen', numeric: true },
]

/** Zero reads muted, a real figure reads live — the legacy NumCell rule. */
function num(value: number) {
  return value === 0 ? (
    <span style={{ color: 'var(--a-text-2)' }}>0</span>
  ) : (
    fmtInt(value)
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

  const gridRows: ReportGridRow[] = people.map((p) => {
    const firstParcel = p.parcels[0]
    const address = firstParcel?.siteStreet ?? firstParcel?.apn ?? ''
    return {
      key: String(p.personId),
      cells: [
        <Link key="n" href={`/admin/crm/${p.personId}`} style={{ color: 'var(--a-accent)' }}>
          {p.name ?? `Person #${p.personId}`}
        </Link>,
        <span key="p" style={{ color: 'var(--a-text-2)' }}>
          {address}
          {p.parcels.length > 1 ? ` +${p.parcels.length - 1} more` : ''}
        </span>,
        <span key="s" style={{ color: 'var(--a-text-2)' }}>
          {p.stage ?? '—'}
        </span>,
        num(p.visits),
        num(p.opens),
        num(p.clicks),
        num(p.inbound),
        <span key="sc" style={{ fontWeight: 600 }}>
          {fmtInt(p.score)}
        </span>,
        <span key="ls" style={{ color: 'var(--a-text-2)' }}>
          {fmtDay(p.lastSeenIso)}
        </span>,
      ],
    }
  })

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <ReportingTabStrip active={null} />

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={report === null ? 'attention' : 'ok'}>
          {report === null ? (
            <>
              <b>The cohort report could not be read.</b> Nothing below is a measurement.
            </>
          ) : (
            <>
              <b>
                {fmtInt(rollup.activePeople)} of {fmtInt(rollup.identifiedPeople)} parcel-linked{' '}
                {rollup.identifiedPeople === 1 ? 'owner' : 'owners'} moved since{' '}
                {fmtDay(report.windowStartIso)}.
              </b>{' '}
              Across {fmtInt(rollup.linkedParcels)} linked parcels. This same read goes out weekly
              as the West Side digest.
            </>
          )}
        </VerdictLine>
      </div>

      {report === null ? (
        <ReportError what="The West Side cohort" href={`/admin/crm/reporting/westside?days=${days}`} />
      ) : null}

      <div className="av2-rfilters">
        <WestsideFilters currentDays={days} />
      </div>

      {report ? (
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '0 0 20px' }}>
          Read at {formatDate(report.fetchedAtIso, { hour: 'numeric', minute: '2-digit' })} Pacific, covering{' '}
          {fmtDay(report.windowStartIso)} onward.{' '}
          <Link href={`/admin/crm/reporting/westside?days=${days}`} style={{ color: 'var(--a-accent)' }}>
            Read again
          </Link>
        </p>
      ) : null}

      <ReportNumbers
        items={[
          { key: 'identified', label: 'Identified owners', value: fmtInt(rollup.identifiedPeople) },
          { key: 'active', label: 'Active this window', value: fmtInt(rollup.activePeople) },
          { key: 'visits', label: 'Site visits', value: fmtInt(rollup.siteVisits) },
          { key: 'opens', label: 'Email opens', value: fmtInt(rollup.opens) },
          { key: 'clicks', label: 'Email clicks', value: fmtInt(rollup.clicks) },
          { key: 'inbound', label: 'Inbound messages', value: fmtInt(rollup.inboundMessages) },
        ]}
      />

      <SectionHead>Who moved — the strongest signal sits at the top</SectionHead>
      <ReportGrid
        label="Active West Side cohort members"
        columns={COLUMNS}
        template="minmax(130px, 1.6fr) minmax(130px, 1.5fr) minmax(80px, 0.9fr) repeat(6, minmax(56px, 0.6fr))"
        minWidth={860}
        rows={gridRows}
        empty={
          rollup.identifiedPeople === 0 ? (
            <>
              No parcel is linked to a CRM person yet, so there is no cohort to watch. Link owners
              on the parcel ledger and this fills in.
            </>
          ) : (
            <>
              No cohort activity in the last {days} days — {fmtInt(rollup.identifiedPeople)}{' '}
              identified owners stayed quiet. Widen the window above, or open{' '}
              <Link href="/admin/crm" style={{ color: 'var(--a-accent)' }}>
                the people list
              </Link>
              .
            </>
          )
        }
      />

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Ranked by score, highest first. Score weights an inbound message heaviest, then a site
        visit, then a click, then an open. A person owning several parcels shows the first and a
        count of the rest.
      </p>
    </div>
  )
}
