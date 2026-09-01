// @no-parity — admin-internal reporting surface, no public mockup contract.
/**
 * Place popularity — which cities, neighborhoods, communities, and
 * subdivisions visitors actually looked at (Matt 2026-09-01: "what are the
 * popular subdivisions, communities — optimize off our own tracking").
 *
 * Source: first-party visitor_events page views classified by route shape
 * (getPlacePopularity). Every place name doors to its public page; listing
 * views are attributed to the place their URL names. Figures are event and
 * distinct-session counts over the picked window, and the verdict says when
 * the scan cap truncated the window instead of presenting a floor as a total.
 */
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { getPlacePopularity, type PlaceKind, type PlacePopularityRow } from '@/lib/data'
import {
  Button,
  ReportGrid,
  SectionHead,
  SelectField,
  StateWord,
  VerdictLine,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'

export const metadata = { title: 'Place popularity | Reports' }
export const dynamic = 'force-dynamic'

const ROW_CAP = 40

const KIND_LABEL: Record<PlaceKind, string> = {
  city: 'City',
  neighborhood: 'Neighborhood',
  community: 'Community',
  subdivision: 'Subdivision',
}

/** The public door for a place row — where a visitor's view actually landed. */
function placeHref(r: PlacePopularityRow): string {
  switch (r.kind) {
    case 'city':
      return `/cities/${r.slug}`
    case 'neighborhood':
      return `/cities/${r.citySlug}/${r.slug}`
    case 'community':
      return `/communities/${r.slug}`
    case 'subdivision':
      return r.citySlug ? `/homes-for-sale/${r.citySlug}/${r.slug}` : `/subdivisions/${r.slug}`
  }
}

function displayName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function parseWindow(raw: string | undefined): number {
  const n = Number(raw)
  return n === 7 || n === 90 ? n : 30
}

export default async function PlacePopularityPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; kind?: string }>
}) {
  await requireAdminPage('performance.view')
  const sp = await searchParams
  const windowDays = parseWindow(sp.window)
  const kindFilter =
    sp.kind === 'city' || sp.kind === 'neighborhood' || sp.kind === 'community' || sp.kind === 'subdivision'
      ? (sp.kind as PlaceKind)
      : null

  const result = await getPlacePopularity({ windowDays })
  const rows = (kindFilter ? result.rows.filter((r) => r.kind === kindFilter) : result.rows).slice(0, ROW_CAP)

  const columns: ReportColumn[] = [
    { key: 'place', label: 'Place' },
    { key: 'kind', label: 'Kind' },
    { key: 'listing', label: 'Listing views', numeric: true },
    { key: 'page', label: 'Place-page views', numeric: true },
    { key: 'sessions', label: 'Sessions', numeric: true },
  ]

  const gridRows: ReportGridRow[] = rows.map((r) => ({
    key: `${r.kind}:${r.citySlug ?? ''}:${r.slug}`,
    cells: [
      <Link key="p" href={placeHref(r)} style={{ color: 'var(--a-accent)' }}>
        {displayName(r.slug)}
        {r.citySlug ? <span style={{ color: 'var(--a-text-2)' }}> · {displayName(r.citySlug)}</span> : null}
      </Link>,
      <StateWord key="k" state="accent">
        {KIND_LABEL[r.kind]}
      </StateWord>,
      r.listingViews.toLocaleString('en-US'),
      r.placeViews.toLocaleString('en-US'),
      r.sessions.toLocaleString('en-US'),
    ],
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={result.unreadable ? 'attention' : 'ok'}>
          {result.unreadable ? (
            <>
              <b>The visitor-events store could not be read.</b> Nothing below is a measurement.
            </>
          ) : (
            <>
              <b>
                Where visitors looked, last {windowDays} days
              </b>{' '}
              — from {result.scanned.toLocaleString('en-US')} first-party page views
              {result.truncated ? (
                <>
                  {' '}
                  (scan capped — counts are a floor, shorten the window for exact figures)
                </>
              ) : null}
              . Views on a listing count toward the place its URL names.
            </>
          )}
        </VerdictLine>
      </div>

      <form method="get" action="/admin/reports/place-popularity" className="av2-rfilters">
        <div className="av2-inline-form" style={{ maxWidth: 560 }}>
          <SelectField label="Window" name="window" defaultValue={String(windowDays)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </SelectField>
          <SelectField label="Kind" name="kind" defaultValue={kindFilter ?? ''}>
            <option value="">All places</option>
            <option value="city">Cities</option>
            <option value="neighborhood">Neighborhoods</option>
            <option value="community">Communities</option>
            <option value="subdivision">Subdivisions</option>
          </SelectField>
          <Button type="submit" touch style={{ alignSelf: 'flex-end' }}>
            Show
          </Button>
        </div>
      </form>

      <SectionHead>
        Most viewed{kindFilter ? ` — ${KIND_LABEL[kindFilter].toLowerCase()}s` : ''}
      </SectionHead>
      <ReportGrid
        label="Place popularity"
        columns={columns}
        template="minmax(220px, 2fr) minmax(110px, 0.8fr) minmax(100px, 0.7fr) minmax(120px, 0.8fr) minmax(90px, 0.6fr)"
        minWidth={720}
        rows={gridRows}
        empty={<>No place views in this window.</>}
      />
    </div>
  )
}
