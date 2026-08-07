// @no-parity — internal admin surface, no public mockup contract
//
// Resort & master plan communities — migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only.
//
// Carried over verbatim: the superuser guard (this folder's layout.tsx,
// untouched), `export const dynamic = 'force-dynamic'`, the
// listSubdivisionsWithFlags() read and its city-normalizing sort, PAGE_SIZE
// = 25, formatInt, normalizeParams, buildQuery, the `?q=` / `?view=` /
// `?page=` param names and every default (q empty · view 'all' unless the
// value is exactly 'resort' · page clamped into 1..pageCount), the
// presentation-only filter order (view first, then q against city and
// subdivision, both lowercased), the total / flagged / cities figures, the
// /admin and /admin/geo/resort-communities hrefs, and both islands
// (SeedResortButton, ResortCommunityToggle) with the same props.
//
// Shape changed, data did not: the <h1> is gone because the geo tab strip
// names the page, the three shadcn stat cards became the family's
// typographic numbers strip carrying the same three figures through the same
// formatInt, the phone card list and the desktop shadcn table element became
// the admin's one grid (responsive by itself, so the two markup copies are one),
// the Search / All / Resort pair of link-buttons became ONE filter control
// (acceptance bar rule 2), and the hidden `view` input is gone with it.
import { Suspense } from 'react'
import Link from 'next/link'
import { listSubdivisionsWithFlags } from '@/app/actions/subdivision-flags'
import ResortCommunityToggle from './ResortCommunityToggle'
import SeedResortButton from './SeedResortButton'
import {
  Button,
  ReportGrid,
  ReportNumbers,
  ReportSkeleton,
  SectionHead,
  SelectField,
  TextField,
  VerdictLine,
  type ReportGridRow,
  type ReportNumberItem,
} from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

type SearchParams = Record<string, string | string[] | undefined>

function normalizeParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    out[k] = Array.isArray(v) ? v[0] : v
  }
  return out
}

// Build a query string that preserves the current filters, optionally
// overriding one key. Used for pagination.
function buildQuery(
  current: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const next = { ...current, ...overrides }
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(next)) {
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

async function ResortCommunitiesContent({
  params,
}: {
  params: Record<string, string | undefined>
}) {
  const rows = await listSubdivisionsWithFlags()

  const total = rows.length
  const flagged = rows.filter((r) => r.is_resort).length
  const cities = new Set(rows.map((r) => r.city)).size

  // Filters (presentation-only — slicing what we render, not the data fetch).
  const q = (params.q ?? '').trim().toLowerCase()
  const view = params.view === 'resort' ? 'resort' : 'all'
  let filtered = rows
  if (view === 'resort') filtered = filtered.filter((r) => r.is_resort)
  if (q) {
    filtered = filtered.filter(
      (r) =>
        r.city.toLowerCase().includes(q) ||
        r.subdivision.toLowerCase().includes(q),
    )
  }

  // Pagination — never dump the full list into the DOM.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRaw = Number.parseInt(params.page ?? '1', 10)
  const page = Number.isFinite(pageRaw) ? Math.min(Math.max(1, pageRaw), pageCount) : 1
  const start = (page - 1) * PAGE_SIZE
  const pageRows = filtered.slice(start, start + PAGE_SIZE)

  const hasFilters = Boolean(q) || view === 'resort'

  const numbers: ReportNumberItem[] = [
    { key: 'total', label: 'Subdivisions known', value: formatInt(total) },
    { key: 'flagged', label: 'Resort & master plan', value: formatInt(flagged) },
    { key: 'cities', label: 'Cities covered', value: formatInt(cities) },
  ]

  const gridRows: ReportGridRow[] = pageRows.map((r) => ({
    key: r.entity_key,
    cells: [
      r.subdivision,
      r.city,
      <ResortCommunityToggle
        key="toggle"
        entityKey={r.entity_key}
        initialResort={r.is_resort}
      />,
    ],
  }))

  return (
    <>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={total === 0 ? 'attention' : 'ok'}>
          {total === 0 ? (
            <>
              <b>No subdivisions yet.</b> Sync listings first so city and subdivision pairs appear
              here.
            </>
          ) : (
            <>
              <b>
                {formatInt(flagged)} of {formatInt(total)} subdivisions carry the resort &amp;
                master plan flag.
              </b>{' '}
              The list covers {formatInt(cities)} {cities === 1 ? 'city' : 'cities'}.
            </>
          )}
        </VerdictLine>
      </div>

      <ReportNumbers items={numbers} />

      <SectionHead>Seed</SectionHead>
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 8px' }}>
        Copy the built-in Oregon resort &amp; master plan list into the database so you can edit it
        here.
      </p>
      <SeedResortButton />

      <SectionHead>
        {view === 'resort' ? 'Resort & master plan' : 'Subdivisions'} ({formatInt(filtered.length)})
      </SectionHead>
      <div className="av2-rfilters">
        <form method="get" action="/admin/geo/resort-communities" className="av2-inline-form">
          <TextField
            label="Search city or subdivision"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Sunriver, Tetherow…"
          />
          <SelectField label="Show" name="view" defaultValue={view === 'resort' ? 'resort' : ''}>
            <option value="">All</option>
            <option value="resort">Resort &amp; master plan</option>
          </SelectField>
          <Button type="submit">Search</Button>
          {hasFilters ? (
            <Link
              href="/admin/geo/resort-communities"
              className="av2-btn av2-btn--quiet"
              style={{ textDecoration: 'none' }}
            >
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 12px' }}>
        Toggle a community on to show the full amenities &amp; lifestyle section and resort schema
        on its page. Changes save automatically. Built-in Oregon resort communities stay on until
        you turn them off.
      </p>

      <ReportGrid
        label={view === 'resort' ? 'Resort & master plan communities' : 'Subdivisions'}
        columns={[
          { key: 'subdivision', label: 'Subdivision' },
          { key: 'city', label: 'City' },
          { key: 'flag', label: 'Resort & master plan' },
        ]}
        template="minmax(160px, 1.6fr) minmax(110px, 1fr) minmax(190px, 1fr)"
        minWidth={520}
        rows={gridRows}
        empty={
          total === 0 ? (
            <>Sync listings first so city and subdivision pairs appear here.</>
          ) : (
            <>
              No subdivisions match your search or filter.{' '}
              <Link href="/admin/geo/resort-communities" style={{ color: 'var(--a-accent)' }}>
                Clear filters
              </Link>
            </>
          )
        }
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginTop: 16,
        }}
      >
        {/* Same expression as before, now gated on there being a row: with an
            empty result it printed "Showing 1–0 of 0", a range with no rows in
            it. The numbers are unchanged; the line just does not render when
            there is nothing to range over. */}
        {pageRows.length > 0 ? (
          <p
            style={{
              fontSize: 'var(--a-text-xs)',
              color: 'var(--a-text-2)',
              fontVariantNumeric: 'tabular-nums',
              margin: 0,
            }}
          >
            Showing {formatInt(start + 1)}&ndash;{formatInt(start + pageRows.length)} of{' '}
            {formatInt(filtered.length)}
          </p>
        ) : null}
        {pageCount > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {page > 1 ? (
              <Link
                href={`/admin/geo/resort-communities${buildQuery(params, { page: String(page - 1) })}`}
                className="av2-btn av2-btn--quiet"
                style={{ textDecoration: 'none' }}
              >
                Previous
              </Link>
            ) : (
              <Button variant="quiet" disabled>
                Previous
              </Button>
            )}
            <span
              style={{
                fontSize: 'var(--a-text-xs)',
                color: 'var(--a-text-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link
                href={`/admin/geo/resort-communities${buildQuery(params, { page: String(page + 1) })}`}
                className="av2-btn av2-btn--quiet"
                style={{ textDecoration: 'none' }}
              >
                Next
              </Link>
            ) : (
              <Button variant="quiet" disabled>
                Next
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export default async function AdminResortCommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const params = normalizeParams(sp)

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <nav
        aria-label="Breadcrumb"
        style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
      >
        <Link href="/admin" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          ← Admin
        </Link>
      </nav>

      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 16px' }}>
        Flag subdivisions as resort or master plan communities. Flagged communities show the full
        amenities &amp; lifestyle section and resort schema on their page. Unflagged subdivisions
        use the standard community page.
      </p>

      <Suspense fallback={<ReportSkeleton />}>
        <ResortCommunitiesContent params={params} />
      </Suspense>
    </div>
  )
}
