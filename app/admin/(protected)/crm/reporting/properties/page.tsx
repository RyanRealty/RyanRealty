// @no-parity — internal admin surface
//
// Properties report — 11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the reporting family's shared
// presentation kit (../_v2/ReportGrid). Presentation only.
//
// Carried over verbatim: the getCrmAccess guard, `?date=` handling and its
// `this_month` default, datePresetLabel, the getPropertiesReport({ datePreset })
// read and its catch-to-null, the DAL's viewCount-desc rank, the listing
// drill-through hrefs, the map pins, and every figure.
//
// Shape changed, data did not: the 288px-wide inner scroll pane became the
// family's grid (one row per listing, a card stack at 375px), and the map moved
// below it at full width so nothing scrolls sideways. A FAILED read is now its
// own state — it used to render as an innocent "no property inquiries" panel.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getPropertiesReport } from '@/lib/data/crm/getPropertiesReport'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import {
  ReportGrid,
  ReportFreshness,
  ReportError,
  type ReportColumn,
  type ReportGridRow,
} from '../_v2/ReportGrid'
import PropertiesFilters from './PropertiesFilters'
import { PropertiesMap } from './PropertiesMap'
import { ReportingTabStrip } from '@/components/admin/crm/reporting/ReportingTabStrip'

export const metadata = { title: 'Properties | Reporting | CRM' }
export const dynamic = 'force-dynamic'

// ── Search params ─────────────────────────────────────────────────────────────
type SearchParams = {
  date?: string
  t?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function datePresetLabel(preset: string): string {
  switch (preset) {
    case 'today':
      return 'Today'
    case 'this_week':
      return 'This Week'
    case 'this_year':
      return 'This Year'
    default:
      return 'This Month'
  }
}

const COLUMNS: ReportColumn[] = [
  { key: 'address', label: 'Listing' },
  { key: 'place', label: 'City' },
  { key: 'rank', label: 'Rank', numeric: true },
  { key: 'inquiries', label: 'Inquiries', numeric: true },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const datePreset = (sp.date ?? 'this_month') as
    | 'today'
    | 'this_week'
    | 'this_month'
    | 'this_year'

  // Fetch report data — no broker scope (Properties has no agent filter)
  const report = await getPropertiesReport({ datePreset }).catch(() => null)

  const rows = report?.rows ?? []
  const totalViews = report?.totalViews ?? 0
  const uniqueProperties = report?.uniqueProperties ?? 0
  const currentDate = datePreset

  const nowMs = Date.now()
  const refreshHref = `/admin/crm/reporting/properties?date=${currentDate}&t=${nowMs}`

  const gridRows: ReportGridRow[] = rows.map((row, index) => {
    const label = row.streetNumber
      ? `${row.streetNumber} ${row.streetName}`.trim()
      : row.streetName || `Listing #${row.listingMls}`
    return {
      key: row.listingMls,
      cells: [
        row.listingUrl ? (
          <Link key="a" href={row.listingUrl} style={{ color: 'var(--a-accent)' }}>
            {label}
          </Link>
        ) : (
          label
        ),
        <span key="p" style={{ color: 'var(--a-text-2)' }}>
          {[row.city, row.postalCode ? `OR ${row.postalCode}` : 'OR'].filter(Boolean).join(', ')}
        </span>,
        <span key="r" style={{ color: 'var(--a-text-2)' }}>
          {index + 1}
        </span>,
        row.viewCount.toLocaleString('en-US'),
      ],
    }
  })

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <ReportingTabStrip active="properties" />

      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={report === null ? 'attention' : 'ok'}>
          {report === null ? (
            <>
              <b>The property inquiry report could not be read.</b> Nothing below is a measurement.
            </>
          ) : (
            <>
              <b>
                {totalViews.toLocaleString('en-US')} {totalViews === 1 ? 'inquiry' : 'inquiries'} on{' '}
                {uniqueProperties.toLocaleString('en-US')}{' '}
                {uniqueProperties === 1 ? 'property' : 'properties'}.
              </b>{' '}
              {datePresetLabel(currentDate)}, ranked by inquiries. An inquiry is one listing-detail
              page view logged on the site.
            </>
          )}
        </VerdictLine>
      </div>

      {report === null ? <ReportError what="Property inquiries" href={refreshHref} /> : null}

      <div className="av2-rfilters">
        <PropertiesFilters currentDate={currentDate} />
      </div>

      <ReportFreshness href={refreshHref} nowMs={nowMs} />

      <SectionHead>Most-asked-about listings</SectionHead>
      <ReportGrid
        label="Listings ranked by inquiries"
        columns={COLUMNS}
        template="minmax(180px, 2fr) minmax(140px, 1.3fr) minmax(60px, 0.5fr) minmax(90px, 0.8fr)"
        minWidth={620}
        rows={gridRows}
        empty={
          <>
            No listing-detail view was logged for {datePresetLabel(currentDate).toLowerCase()}. An
            inquiry lands here when a site visitor opens a listing page — widen the date range
            above, or check{' '}
            <Link href="/admin/analytics" style={{ color: 'var(--a-accent)' }}>
              site traffic
            </Link>{' '}
            first.
          </>
        }
      />

      {rows.length > 0 ? (
        <>
          <SectionHead>Where they are</SectionHead>
          <div
            style={{
              position: 'relative',
              height: 420,
              border: '1px solid var(--a-border)',
              borderRadius: 'var(--a-r-lg)',
              overflow: 'hidden',
              background: 'var(--a-inset)',
            }}
          >
            <PropertiesMap rows={rows} />
          </div>
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 8 }}>
            One pin per listing that carries coordinates, labelled with its inquiry count. Listings
            without coordinates appear in the list above only.
          </p>
        </>
      ) : null}
    </div>
  )
}
