// @no-parity — internal admin surface, no public mockup contract
//
// Listings browser — 11D: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the shared presentation kit
// (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: the superuser guard (it lives in this folder's
// layout.tsx, untouched), `export const dynamic = 'force-dynamic'`, the
// metadata block, every query param and its default (`page` → 0 via
// Math.max(0, parseInt|0), `search` → trimmed-or-undefined, `status` → the
// `status !== 'all' ? status : undefined` rule, `remarks` → the `remarks==='1'
// AND a non-empty search` rule), pageSize 50, both reads
// (searchAdminRemarksPage in remarks mode, getAdminListingsPage otherwise) with
// the same argument order, totalPages / rangeStart / rangeEnd / hasFilters
// arithmetic, the form's `method="get"` field names (search · status · remarks)
// and the value "1", every href (statusHref's param set, pageHref's param set,
// /admin/listings, /admin/sync, /admin/listings/<encodeURIComponent(key)>),
// the private-remarks disclosure sentence, and the ListingsCsvExport island.
// Nothing about WHICH listings are shown or HOW a status is labelled moved:
// the status text is still the raw StandardStatus string, and the photo cell
// is still `row.PhotoURL ? <Image> : —` so owner media suppression keeps
// suppressing upstream in listing_tile_mv.
//
// Shape changed, data did not:
//   1. The page's own <main> is gone (ConsoleShell owns that landmark) and the
//      standalone <h1> is gone (acceptance-bar rule 1 — the nav names it).
//   2. The three shadcn stat cards became the family's typographic numbers
//      strip; the two sub-notes they carried moved to one quiet line with the
//      same strings.
//   3. The four status facet pills became ONE dropdown (rule 2), which builds
//      the identical URLs — see ListingsStatusFilter.
//   4. The md:hidden card list and the hidden md:block shadcn Table wrote the
//      same eight fields twice. One ReportGrid replaces both; sideways overflow
//      now lives inside the grid's own scroll box instead of the page. The
//      separate Photo column folded into the address cell, so the thumbnail and
//      the address are one door (rule 3).
//   5. "Newest first" became "most recently updated first" — both reads order
//      by modified_at DESC (getListingTiles sort:'newest' and remarksSearch),
//      and the grid's last column IS that column. The old words implied newest
//      listing.
//
// FORMATTERS. The local formatPrice was `Intl.NumberFormat(en-US, currency USD,
// maximumFractionDigits 0)`; it is now formatPriceExact from lib/format/money,
// which is that same formatter — verified byte-identical on real list prices
// ($350,000 · $949,808 · $399,995 · $1,295,000 · $259,900) and on null → "—".
// formatPrice (no Exact) was NOT used: it rounds to the nearest $1,000 and
// would print $949,808 as $950,000. The "Updated" cell keeps
// `new Date(x).toLocaleDateString()` unchanged: formatDate pins
// America/Los_Angeles while the bare call resolves the runtime zone, so on a
// timestamp like 2026-08-07T03:00Z the server prints 8/7/2026 and Pacific
// prints 8/6/2026. Swapping it would move a printed calendar day, so it stays
// and the server/client split is reported as a defect, not smuggled in here.
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getAdminListingsPage, searchAdminRemarksPage } from '@/app/actions/admin-listings'
import { formatPriceExact } from '@/lib/format/money'
import {
  Button,
  ReportGrid,
  ReportNumbers,
  SectionHead,
  StateWord,
  VerdictLine,
  TextField,
  type ReportColumn,
  type ReportGridRow,
  type ReportNumberItem,
} from '@/components/admin/v2'
import ListingsCsvExport from './ListingsCsvExport'
import ListingsStatusFilter from './ListingsStatusFilter'

export const metadata: Metadata = {
  title: 'Listings',
  description: 'Manage listings in the admin.',
}

export const dynamic = 'force-dynamic'

type SearchParams = { page?: string; search?: string; status?: string; remarks?: string }

const STATUS_FILTERS = ['Active', 'Pending', 'Closed'] as const

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function daysOnMarket(onMarketDate: string | null | undefined): number | null {
  if (!onMarketDate) return null
  const d = new Date(onMarketDate)
  if (Number.isNaN(d.getTime())) return null
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000))
  return days >= 0 ? days : null
}

/** Active and Pending keep the two lit states the shadcn badge variants gave
 *  them; every other status stays quiet text. The words are unchanged. */
function StatusCell({ status }: { status: string | null | undefined }) {
  if (status === 'Active') return <StateWord state="ok">Active</StateWord>
  if (status === 'Pending') return <StateWord state="waiting">Pending</StateWord>
  return <span style={{ color: 'var(--a-text-2)' }}>{status ?? '—'}</span>
}

function pageHref(page: number, search: string | undefined, status: string | undefined): string {
  const params = new URLSearchParams()
  if (page > 0) params.set('page', String(page))
  if (search) params.set('search', search)
  if (status && status !== 'all') params.set('status', status)
  const qs = params.toString()
  return qs ? `/admin/listings?${qs}` : '/admin/listings'
}

const COLUMNS: ReportColumn[] = [
  { key: 'address', label: 'Address' },
  { key: 'price', label: 'Price', numeric: true },
  { key: 'status', label: 'Status' },
  { key: 'beds', label: 'Beds/Baths', numeric: true },
  { key: 'community', label: 'Community' },
  { key: 'dom', label: 'DOM', numeric: true },
  { key: 'updated', label: 'Updated' },
]

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { page, search, status, remarks } = await searchParams
  const pageNum = Math.max(0, parseInt(String(page), 10) || 0)
  const pageSize = 50
  const activeStatus = status && status !== 'all' ? status : undefined
  // remarks=1: keyword search across public AND private remarks (on-market
  // rows, admin-only service-role read path). Status facets do not apply —
  // the remarks index covers on-market inventory.
  const remarksMode = remarks === '1' && Boolean(search?.trim())
  const { rows, total } = remarksMode
    ? await searchAdminRemarksPage(search!.trim(), pageNum, pageSize)
    : await getAdminListingsPage(pageNum, pageSize, search?.trim() || undefined, activeStatus)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : pageNum * pageSize + 1
  const rangeEnd = pageNum * pageSize + rows.length
  const hasFilters = Boolean(search?.trim() || activeStatus)

  const numbers: ReportNumberItem[] = [
    {
      key: 'total',
      label: `${hasFilters ? 'Matching' : 'Total'} listings`,
      value: formatInt(total),
    },
    { key: 'showing', label: 'Showing', value: formatInt(rows.length) },
    { key: 'page', label: 'Page', value: `${pageNum + 1} of ${formatInt(totalPages)}` },
  ]

  const gridRows: ReportGridRow[] = rows.map((row) => {
    const key = (row.ListingKey ?? row.ListNumber ?? '').toString().trim()
    const address =
      [row.StreetNumber, row.StreetName].filter(Boolean).join(' ').trim() || row.City || key
    const dom = daysOnMarket(row.OnMarketDate)
    const href = `/admin/listings/${encodeURIComponent(key)}`

    return {
      key,
      cells: [
        <Link key="address" href={href} style={{ color: 'var(--a-accent)' }}>
          {/* inline-block + vertical-align:middle, not inline-flex: the cell's
              baseline has to stay the address text's baseline, or the row's
              other columns sit lower than its name. */}
          <span
            aria-hidden={!row.PhotoURL}
            style={{
              display: 'inline-block',
              verticalAlign: 'middle',
              width: 64,
              height: 48,
              marginRight: 8,
              borderRadius: 6,
              overflow: 'hidden',
              background: 'var(--a-inset)',
            }}
          >
            {row.PhotoURL ? (
              <Image
                src={row.PhotoURL}
                alt={`${address} listing photo`}
                width={64}
                height={48}
                style={{ objectFit: 'cover', display: 'block' }}
              />
            ) : null}
          </span>
          <span style={{ verticalAlign: 'middle', overflowWrap: 'anywhere' }}>{address}</span>
        </Link>,
        formatPriceExact(row.ListPrice),
        <StatusCell key="status" status={row.StandardStatus} />,
        `${row.BedroomsTotal ?? '—'} / ${row.BathroomsTotal ?? '—'}`,
        row.SubdivisionName ?? row.City ?? '—',
        dom != null ? dom : '—',
        row.ModificationTimestamp
          ? new Date(row.ModificationTimestamp).toLocaleDateString()
          : '—',
      ],
    }
  })

  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={total === 0 ? 'attention' : 'ok'}>
          {total === 0 ? (
            hasFilters ? (
              <>
                <b>No listings match these filters.</b> Try a different address or status, or clear
                the filters to widen the results.
              </>
            ) : (
              <>
                <b>No listings in the feed.</b> Check the feed status to confirm sync is running.
              </>
            )
          ) : (
            <>
              <b>
                {formatInt(total)} {total === 1 ? 'listing' : 'listings'}.
              </b>{' '}
              Showing {formatInt(rangeStart)}–{formatInt(rangeEnd)}, most recently updated first.
            </>
          )}
        </VerdictLine>
      </div>

      <div className="av2-wordrow" style={{ margin: '0 0 14px' }}>
        <Link href="/admin/sync" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
          Sync status
        </Link>
        {hasFilters ? (
          <Link
            href="/admin/listings"
            className="av2-btn av2-btn--quiet"
            style={{ textDecoration: 'none' }}
          >
            Clear all
          </Link>
        ) : null}
      </div>

      <ReportNumbers items={numbers} />
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '0 0 20px' }}>
        {activeStatus ?? 'all statuses'} ·{' '}
        {total === 0
          ? 'no rows'
          : `${formatInt(rangeStart)}–${formatInt(rangeEnd)} of ${formatInt(total)}`}
      </p>

      <SectionHead>Find a listing</SectionHead>
      <form method="get" className="av2-inline-form" style={{ maxWidth: 760 }}>
        {activeStatus ? <input type="hidden" name="status" value={activeStatus} readOnly /> : null}
        <TextField
          label="Address, MLS number, or listing key"
          type="search"
          name="search"
          defaultValue={search}
          placeholder="123 Main St, 220189422…"
        />
        {/* wrapped so the checkbox field shrinks to its label instead of
            taking av2-inline-form's `flex: 1 1 180px` text-field slot */}
        <div style={{ flex: '0 0 auto' }}>
          <TextField
            label="Search remarks (public + private)"
            type="checkbox"
            name="remarks"
            value="1"
            defaultChecked={remarksMode}
            className=""
            style={{ width: 20, height: 20, accentColor: 'var(--a-accent)' }}
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      <div style={{ maxWidth: 260, margin: '12px 0 0' }}>
        <ListingsStatusFilter status={activeStatus} search={search} options={STATUS_FILTERS} />
      </div>

      {remarksMode ? (
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '12px 0 0' }}>
          Matching listing remarks, including private agent remarks. Private remarks stay on this
          admin surface and never render publicly. On-market listings only.
        </p>
      ) : null}

      <SectionHead>Listings ({formatInt(total)})</SectionHead>
      <ReportGrid
        label="Admin listings"
        columns={COLUMNS}
        template="minmax(210px, 2.2fr) minmax(96px, 0.9fr) minmax(86px, 0.7fr) minmax(84px, 0.7fr) minmax(110px, 1fr) minmax(56px, 0.4fr) minmax(90px, 0.8fr)"
        minWidth={880}
        rows={gridRows}
        empty={
          hasFilters ? (
            <>
              No listings match these filters. Try a different address or status, or{' '}
              <Link href="/admin/listings" style={{ color: 'var(--a-accent)' }}>
                clear all filters
              </Link>
              .
            </>
          ) : (
            <>
              No listings are available right now.{' '}
              <Link href="/admin/sync" style={{ color: 'var(--a-accent)' }}>
                Check sync status
              </Link>{' '}
              to confirm the feed is running.
            </>
          )
        }
      />

      {totalPages > 1 ? (
        <nav
          aria-label="Pages"
          style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0 16px' }}
        >
          {pageNum > 0 ? (
            <Link
              href={pageHref(pageNum - 1, search, activeStatus)}
              className="av2-btn av2-btn--quiet"
              style={{ textDecoration: 'none' }}
            >
              Previous
            </Link>
          ) : null}
          <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            Page {pageNum + 1} of {formatInt(totalPages)}
          </span>
          {pageNum < totalPages - 1 ? (
            <Link
              href={pageHref(pageNum + 1, search, activeStatus)}
              className="av2-btn av2-btn--quiet"
              style={{ textDecoration: 'none' }}
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}

      {/* Advanced query + CSV export (merged from /admin/query-builder, 2026-07-07) */}
      <ListingsCsvExport />
    </div>
  )
}
