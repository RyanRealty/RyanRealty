// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/analytics/city-segments — one city's REGISTRY sale segments from
 * Market Truth (market_metric mt-v1). Internal only. Not office share.
 * Public /cities stays detached. Neighborhood MOS is not on this page.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { Button, SectionHead, SelectField } from '@/components/admin/v2'
import {
  getCitySegmentBoard,
  SALE_SEGMENTS,
  type CitySegmentRow,
} from '@/lib/data/market-truth/city-segments'
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { DataList, Loading, Trouble } from '../_components/v2/kit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEFAULT_CITY = 'bend'

/** market_service_area city slugs (compute grain). Hyphen form. */
const CITY_BOARD_SLUGS = [
  'bend',
  'black-butte-ranch',
  'camp-sherman',
  'crooked-river-ranch',
  'culver',
  'la-pine',
  'madras',
  'metolius',
  'powell-butte',
  'prineville',
  'redmond',
  'sisters',
  'sunriver',
  'terrebonne',
  'tumalo',
  'warm-springs',
] as const

const SEGMENT_LABELS: Record<string, string> = {
  detached: 'Detached',
  condo: 'Condo',
  townhome: 'Townhome',
  manufactured_land: 'Manufactured on land',
  manufactured_park: 'Manufactured in park',
  multifamily_2_4: 'Multifamily 2-4',
  land: 'Land',
  farm: 'Farm',
  commercial_sale: 'Commercial sale',
  business: 'Business',
  all_residential: 'All residential',
}

function cityLabel(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function hyphenSlug(raw: string | undefined): string {
  const slug = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || DEFAULT_CITY
}

function parseCityParam(sp: Record<string, string | string[] | undefined>): string {
  const raw = Array.isArray(sp.city) ? sp.city[0] : sp.city
  return hyphenSlug(raw)
}

function formatActive(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '-'
  return new Intl.NumberFormat('en-US').format(n)
}

function formatMos(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '-'
  return `${formatMonthsOfSupply(n)} mo`
}

function formatVerdict(v: string | null): string {
  if (v === 'seller') return "seller's"
  if (v === 'buyer') return "buyer's"
  if (v === 'balanced') return 'balanced'
  return '-'
}

function formatSample(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '-'
  return String(n)
}

type DisplayRow = CitySegmentRow & {
  label: string
  activeDisplay: string
  medianDisplay: string
  mosDisplay: string
  verdictDisplay: string
  sampleDisplay: string
}

function toDisplay(row: CitySegmentRow): DisplayRow {
  return {
    ...row,
    label: SEGMENT_LABELS[row.segment] ?? row.segment,
    activeDisplay: formatActive(row.activeCount),
    medianDisplay:
      row.medianList == null || !Number.isFinite(row.medianList) ? '-' : formatPriceExact(row.medianList),
    mosDisplay: formatMos(row.monthsOfSupply),
    verdictDisplay: formatVerdict(row.verdict),
    sampleDisplay: formatSample(row.sampleN),
  }
}

function hasAnyCell(row: CitySegmentRow): boolean {
  return (
    row.activeCount != null ||
    row.medianList != null ||
    row.monthsOfSupply != null ||
    row.verdict != null
  )
}

async function SegmentBoard({ citySlug }: { citySlug: string }) {
  let rows: CitySegmentRow[]
  try {
    rows = await getCitySegmentBoard(citySlug)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    return (
      <Trouble>
        Could not load city segments: {message}. Nothing on this page is
        trustworthy until the <code>market_metric</code> read succeeds.
      </Trouble>
    )
  }

  const shown = rows.filter(hasAnyCell).length === 0 ? [] : rows.map(toDisplay)

  return (
    <section aria-label={`${cityLabel(citySlug)} sale segments`}>
      <SectionHead>Sale segments</SectionHead>
      <p className="av2-note">
        One row per REGISTRY sale segment. A miss is not zero. MOS uses the
        6-month house window when that cell is publishable.
      </p>
      <DataList
        label={`${cityLabel(citySlug)} sale segments`}
        rows={shown}
        cap={SALE_SEGMENTS.length}
        rowKey={(r) => r.segment}
        columns={[
          {
            key: 'segment',
            header: 'Segment',
            lead: true,
            cell: (r) => r.label,
          },
          {
            key: 'active',
            header: 'Active',
            num: true,
            cell: (r) => r.activeDisplay,
          },
          {
            key: 'median',
            header: 'Median list',
            num: true,
            cell: (r) => r.medianDisplay,
          },
          {
            key: 'mos',
            header: 'Months of supply',
            num: true,
            cell: (r) => r.mosDisplay,
          },
          {
            key: 'verdict',
            header: 'Verdict',
            cell: (r) => r.verdictDisplay,
          },
          {
            key: 'n',
            header: 'Sample n',
            num: true,
            cell: (r) => r.sampleDisplay,
          },
        ]}
        empty={
          <>
            No publishable Market Truth cells for {cityLabel(citySlug)} yet.
            This board reads <code>market_metric</code> (mt-v1) with{' '}
            <code>is_publishable</code>. A miss is not zero.
          </>
        }
      />
    </section>
  )
}

export default async function CitySegmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const citySlug = parseCityParam(await searchParams)
  const options = CITY_BOARD_SLUGS.includes(citySlug as (typeof CITY_BOARD_SLUGS)[number])
    ? CITY_BOARD_SLUGS
    : [...CITY_BOARD_SLUGS, citySlug]

  return (
    <div className="av2-scope" style={{ maxWidth: 1120, margin: '0 auto', padding: 16 }}>
      <p className="av2-note">
        Internal Market Truth (<code>market_metric</code> mt-v1) for one city,
        every sale segment. Not office share, not the public condo HUD.{' '}
        <Link href={`/cities/${citySlug}`} style={{ color: 'var(--a-accent)' }}>
          {cityLabel(citySlug)}
        </Link>{' '}
        opens the public city page. Detached city ranks live on{' '}
        <Link href="/admin/analytics/city-leaderboard" style={{ color: 'var(--a-accent)' }}>
          City market ranks
        </Link>
        .
      </p>
      <form method="get" action="/admin/analytics/city-segments" className="av2-rfilters">
        <div className="av2-inline-form" style={{ maxWidth: 420 }}>
          <SelectField label="City" name="city" defaultValue={citySlug}>
            {options.map((slug) => (
              <option key={slug} value={slug}>
                {cityLabel(slug)}
              </option>
            ))}
          </SelectField>
          <Button type="submit">Show</Button>
        </div>
      </form>
      <Suspense fallback={<Loading what="city segments" />}>
        <SegmentBoard citySlug={citySlug} />
      </Suspense>
    </div>
  )
}
