// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/analytics/demographics — who is visiting, how old, where from.
 *
 * Pulls demographics from GA4 Data API (Google Signals must be enabled,
 * which it is per the 2026-05-21 admin config). Returns:
 *   - Age bracket distribution (overall + cross-tabs by page & source)
 *   - Gender split
 *   - Top cities (US-wide + Bend metro drill-down)
 *   - Seller-LP visitor age + geo split (HNW elderly Bend targeting)
 *
 * Built specifically to answer: "which channel + age + geography
 * combination converts on the seller funnel, and where do we lose them?"
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only — the superuser gate (analytics/layout.tsx), the cached GA4
 * read, the BEND_METRO set, the age ordering, every total and percentage, and
 * the ?range/?startDate/?endDate handling are carried over verbatim.
 */
import { Suspense } from 'react'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import { getGA4DemographicsCached as getGA4Demographics } from '@/lib/ga4-cache'
import { DataGrid, GridSkeleton, LaneNote, Stamp, StatePanel, NumberStrip } from '../_components/v2/DataGrid'
import { resolveDateRange } from '../_lib/queries'
import { DateRangePicker } from '../_components/DateRangePicker'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = Record<string, string | string[] | undefined>

function normalizeParams(sp: SearchParams): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) {
    out[k] = Array.isArray(v) ? v[0] : v
  }
  return out
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function formatPct(n: number, total: number): string {
  if (total === 0) return '0%'
  return `${((n / total) * 100).toFixed(1)}%`
}

// Order age buckets canonically. GA4 returns them in arbitrary order.
const AGE_ORDER = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'unknown']
function sortAgeBuckets<T extends { ageBracket: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ai = AGE_ORDER.indexOf(a.ageBracket)
    const bi = AGE_ORDER.indexOf(b.ageBracket)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

// Emphasise the 55+ buckets so Matt can spot HNW-elderly traffic at a glance.
// Weight + accent, never colour alone (WCAG 1.4.1) — the label still reads.
function AgeLabel({ bracket }: { bracket: string }) {
  const senior = bracket === '55-64' || bracket === '65+'
  const mid = bracket === '45-54'
  return (
    <span
      style={{
        fontVariantNumeric: 'tabular-nums',
        fontWeight: senior ? 700 : mid ? 600 : 400,
        color: senior ? 'var(--a-accent)' : 'var(--a-text)',
      }}
    >
      {bracket}
      {senior ? ' ★' : ''}
    </span>
  )
}

// Bend metro split: Bend + Redmond + Sisters + Sunriver + Tumalo + La Pine + Madras + Prineville
const BEND_METRO = new Set(['Bend', 'Redmond', 'Sisters', 'Sunriver', 'Tumalo', 'La Pine', 'Madras', 'Prineville'])

function CityName({ city }: { city: string }) {
  const local = BEND_METRO.has(city)
  return (
    <span style={{ fontWeight: local ? 700 : 500, color: local ? 'var(--a-accent)' : 'var(--a-text)' }}>
      {city}
      {local ? ' ★' : ''}
    </span>
  )
}

async function DemographicsContent({ startDate, endDate }: { startDate: string; endDate: string }) {
  const data = await getGA4Demographics(startDate, endDate)
  if (!data.ok) {
    return (
      <StatePanel tone="error">
        <p style={{ margin: 0 }}>Demographics report unavailable: {data.error}.</p>
        <p style={{ margin: 'var(--a-s2) 0 0' }}>
          If GA4_NOT_CONFIGURED: set GOOGLE_GA4_PROPERTY_ID + service-account env vars. If a runtime error: Google
          Signals may not have synced demographic data for this range yet (24-48h delay after first install).
        </p>
      </StatePanel>
    )
  }

  const ageBuckets = sortAgeBuckets(data.ageBuckets)
  const ageBySource = data.ageBySource
  const sellerLpByAge = sortAgeBuckets(data.sellerLpByAge)
  const sellerLpUsersTotal = sellerLpByAge.reduce((acc, r) => acc + r.users, 0)
  const ageTotal = ageBuckets.reduce((acc, r) => acc + r.users, 0)
  const genderTotal = data.genders.reduce((acc, r) => acc + r.users, 0)

  const bendMetroCities = data.topCities.filter((c) => BEND_METRO.has(c.city))
  const bendMetroUsers = bendMetroCities.reduce((acc, c) => acc + c.users, 0)

  const fiftyFivePlus = ageBuckets.filter((b) => b.ageBracket === '55-64' || b.ageBracket === '65+').reduce((acc, r) => acc + r.users, 0)

  return (
    <>
      <VerdictLine tone={sellerLpUsersTotal > 0 ? 'ok' : 'attention'}>
        <b>
          {formatPct(fiftyFivePlus, ageTotal)} of sampled visitors are 55+
        </b>{' '}
        and {formatPct(bendMetroUsers, data.totalUsers)} sit in the Bend metro.
      </VerdictLine>

      <NumberStrip
        items={[
          { label: 'Total users', value: formatInt(data.totalUsers) },
          { label: 'Bend metro users', value: formatInt(bendMetroUsers), caption: `${formatPct(bendMetroUsers, data.totalUsers)} of all` },
          { label: 'Seller LP visitors', value: formatInt(sellerLpUsersTotal) },
          { label: 'Age 55+ share', value: formatPct(fiftyFivePlus, ageTotal), caption: 'of identified users' },
        ]}
      />

      {/* 1. Age bracket distribution */}
      <section aria-label="Age brackets (all visitors)">
        <SectionHead>Age brackets (all visitors)</SectionHead>
        <DataGrid
          label="Age brackets, all visitors"
          rows={ageBuckets}
          cap={8}
          minWidth={480}
          getRowKey={(b) => b.ageBracket}
          columns={[
            { key: 'age', header: 'Age', width: '120px', cell: (b) => <AgeLabel bracket={b.ageBracket} /> },
            { key: 'users', header: 'Users', numeric: true, cell: (b) => formatInt(b.users) },
            { key: 'sessions', header: 'Sessions', numeric: true, cell: (b) => formatInt(b.sessions) },
            { key: 'share', header: 'Share', numeric: true, cell: (b) => formatPct(b.users, ageTotal) },
          ]}
          empty={
            <>No age-bracket data in this window. Google Signals needs more signed-in-user traffic before it samples demographics.</>
          }
        />
        <Stamp>
          Google Signals samples demographic data from signed-in Google users. Coverage is typically 30-60% of total
          traffic. Unknowns are excluded from percentage math, so percentages sum to 100% across known buckets only.
        </Stamp>
      </section>

      {/* 2. Seller LP age + geo — the HNW targeting report */}
      <section aria-label="Seller LP visitors by age">
        <SectionHead>Seller LP visitors by age</SectionHead>
        <LaneNote>
          /lp/seller-home-value visitors only. Tells you whether your HNW elderly Bend targeting is reaching the right
          age bracket.
        </LaneNote>
        <DataGrid
          label="Seller LP visitors by age"
          rows={sellerLpByAge}
          cap={8}
          minWidth={480}
          getRowKey={(b) => b.ageBracket}
          columns={[
            { key: 'age', header: 'Age', width: '120px', cell: (b) => <AgeLabel bracket={b.ageBracket} /> },
            { key: 'users', header: 'Users', numeric: true, cell: (b) => formatInt(b.users) },
            { key: 'visits', header: 'Visits', numeric: true, cell: (b) => formatInt(b.eventCount) },
            { key: 'share', header: 'Share', numeric: true, cell: (b) => formatPct(b.users, sellerLpUsersTotal) },
          ]}
          empty={
            <>
              No /lp/seller-home-value visitors with demographic data in this window. May need more traffic before Google
              Signals samples enough.
            </>
          }
        />
      </section>

      <section aria-label="Seller LP visitors by city">
        <SectionHead>Seller LP visitors by city</SectionHead>
        <LaneNote>
          Where are they physically. If FB ads are targeted to Bend metro and most seller-LP traffic is elsewhere, the
          targeting is wrong.
        </LaneNote>
        <DataGrid
          label="Seller LP visitors by city"
          rows={data.sellerLpByCity}
          cap={8}
          minWidth={520}
          getRowKey={(c, i) => `${c.city}-${i}`}
          columns={[
            { key: 'city', header: 'City', width: '1.1fr', cell: (c) => <CityName city={c.city} /> },
            { key: 'region', header: 'Region', width: '1fr', cell: (c) => <span style={{ color: 'var(--a-text-2)' }}>{c.region}</span> },
            { key: 'users', header: 'Users', numeric: true, cell: (c) => formatInt(c.users) },
            { key: 'visits', header: 'Visits', numeric: true, cell: (c) => formatInt(c.eventCount) },
          ]}
          empty={<>No /lp/seller-home-value visitors with geo data in this window.</>}
        />
      </section>

      {/* 3. Gender split */}
      <section aria-label="Gender split (all visitors)">
        <SectionHead>Gender split (all visitors)</SectionHead>
        <DataGrid
          label="Gender split, all visitors"
          rows={data.genders}
          cap={8}
          minWidth={480}
          getRowKey={(g) => g.gender}
          columns={[
            { key: 'gender', header: 'Gender', width: '140px', cell: (g) => g.gender },
            { key: 'users', header: 'Users', numeric: true, cell: (g) => formatInt(g.users) },
            { key: 'sessions', header: 'Sessions', numeric: true, cell: (g) => formatInt(g.sessions) },
            { key: 'share', header: 'Share', numeric: true, cell: (g) => formatPct(g.users, genderTotal) },
          ]}
          empty={<>No gender data sampled in this window.</>}
        />
      </section>

      {/* 4. Geography (top cities) */}
      <section aria-label="Top cities">
        <SectionHead>Top cities</SectionHead>
        <DataGrid
          label="Top cities"
          rows={data.topCities}
          cap={10}
          minWidth={620}
          getRowKey={(c, i) => `${c.city}-${i}`}
          columns={[
            { key: 'city', header: 'City', width: '1.1fr', cell: (c) => <CityName city={c.city} /> },
            { key: 'region', header: 'Region', width: '1fr', cell: (c) => <span style={{ color: 'var(--a-text-2)' }}>{c.region}</span> },
            { key: 'country', header: 'Country', width: '1fr', cell: (c) => <span style={{ color: 'var(--a-text-2)' }}>{c.country}</span> },
            { key: 'users', header: 'Users', numeric: true, cell: (c) => formatInt(c.users) },
            { key: 'sessions', header: 'Sessions', numeric: true, cell: (c) => formatInt(c.sessions) },
          ]}
          empty={<>No city-level geo data in this window.</>}
        />
        <Stamp>
          Bend metro cities (Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine, Madras, Prineville) are marked ★.
        </Stamp>
      </section>

      {/* 5. Age x Source — which channel drives which age */}
      <section aria-label="Age by source and medium">
        <SectionHead>Age × source / medium</SectionHead>
        <LaneNote>
          Top combinations by sessions. Use this to see if FB ads are actually pulling the elderly Bend audience or if
          they are pulling 18-34.
        </LaneNote>
        <DataGrid
          label="Age by source and medium"
          rows={ageBySource}
          cap={10}
          minWidth={560}
          getRowKey={(r, i) => `${r.ageBracket}-${r.sourceMedium}-${i}`}
          columns={[
            { key: 'age', header: 'Age', width: '120px', cell: (r) => <AgeLabel bracket={r.ageBracket} /> },
            { key: 'source', header: 'Source / Medium', width: '1.6fr', cell: (r) => r.sourceMedium },
            { key: 'users', header: 'Users', numeric: true, cell: (r) => formatInt(r.users) },
            { key: 'sessions', header: 'Sessions', numeric: true, cell: (r) => formatInt(r.sessions) },
          ]}
          empty={<>No age × source combinations sampled in this window.</>}
        />
      </section>
    </>
  )
}

export default async function DemographicsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = normalizeParams(await searchParams)
  const range = resolveDateRange(sp)

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 var(--a-s5)' }}>
        <DateRangePicker current={sp.range ?? '30d'} currentStart={sp.startDate} currentEnd={sp.endDate} />
      </div>

      <Suspense fallback={<GridSkeleton rows={6} label="Loading demographics" />}>
        <DemographicsContent startDate={range.startDate} endDate={range.endDate} />
      </Suspense>

      <Stamp>
        GA4 Data API with Google Signals. Demographic coverage is typically 30 to 60 percent of total traffic. Range{' '}
        {range.startDate} to {range.endDate}.
      </Stamp>
    </div>
  )
}
