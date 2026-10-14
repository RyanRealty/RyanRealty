// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/analytics/demographics — who is visiting, how old, where from.
 *
 * Pulls demographics from GA4 Data API (Google Signals must be enabled).
 * Signals is ON: it was turned off on 2026-10-08 and back on the same
 * evening at Matt's call (GOOGLE_SIGNALS_ENABLED). Returns:
 *   - Age bracket distribution (overall + cross-tabs by page & source)
 *   - Gender split
 *   - Top cities (US-wide + Bend metro drill-down)
 *   - Seller-LP visitor age + geo split (HNW elderly Bend targeting)
 *
 * Built specifically to answer: "which channel + age + geography
 * combination converts on the seller funnel, and where do we lose them?"
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 *
 * 2026-10-14: each report renders on its own state
 * (lib/analytics/ga4-demographic-sections.ts). Google withholds age and gender
 * when a group has too few users; a withheld section says so and never shows
 * as 0% or an error. Shares are of KNOWN brackets (GA4's `unknown` is left out
 * of the base, as the stamp has always said). A failed report shows its own
 * error and the rest of the page still renders. Bend metro users is its own
 * exact GA4 count, no longer a sum of the top-25 city rows.
 */
import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { SectionHead, VerdictLine } from '@/components/admin/v2'
import { getGA4DemographicsCached as getGA4Demographics } from '@/lib/ga4-cache'
import {
  BEND_METRO_CITIES,
  isKnownBucket,
  knownShare,
  sectionRows,
  sortAgeSection,
  type Ga4Section,
} from '@/lib/analytics/ga4-demographic-sections'
import { DataGrid, GridSkeleton, LaneNote, Stamp, StatePanel, NumberStrip, type GridColumn } from '../_components/v2/DataGrid'
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

/** A share of a known base; null (Google did not say) never prints as 0%. */
function formatShare(share: number | null): string {
  return share === null ? '—' : `${(share * 100).toFixed(1)}%`
}

const isSenior = (bracket: string) => bracket === '55-64' || bracket === '65+'

// Emphasise the 55+ buckets so Matt can spot HNW-elderly traffic at a glance.
// Weight + accent, never colour alone (WCAG 1.4.1) — the label still reads.
function AgeLabel({ bracket }: { bracket: string }) {
  const senior = isSenior(bracket)
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

function CityName({ city }: { city: string }) {
  const local = BEND_METRO_CITIES.has(city)
  return (
    <span style={{ fontWeight: local ? 700 : 500, color: local ? 'var(--a-accent)' : 'var(--a-text)' }}>
      {city}
      {local ? ' ★' : ''}
    </span>
  )
}

/**
 * One GA4 report on its own state: the grid when Google returned rows, a
 * "withheld" panel when its privacy thresholds removed every group, the
 * report's own empty note, or that report's error.
 */
function ReportSection<T>({
  section,
  empty,
  ...grid
}: {
  section: Ga4Section<T>
  label: string
  columns: GridColumn<T>[]
  getRowKey: (row: T, index: number) => string | number
  cap?: number
  minWidth?: number
  empty: ReactNode
}) {
  if (section.state === 'error') {
    return <StatePanel tone="error">Google Analytics did not return this report: {section.error}</StatePanel>
  }
  if (section.state === 'withheld') {
    return (
      <StatePanel>
        <b>Withheld by Google for privacy.</b> Google Analytics hides any group with too few visitors in it, and in this
        range it hid every group in this report. That is not zero visitors. A longer date range may clear the threshold.
      </StatePanel>
    )
  }
  return (
    <>
      <DataGrid {...grid} rows={sectionRows(section)} empty={empty} />
      {section.state === 'ok' && section.partial ? (
        <Stamp>Google may have withheld small groups here for privacy, so shares are of the groups it reported.</Stamp>
      ) : null}
    </>
  )
}

async function DemographicsContent({ startDate, endDate }: { startDate: string; endDate: string }) {
  const data = await getGA4Demographics(startDate, endDate)
  if (!data.ok) {
    return (
      <StatePanel tone="error">
        <p style={{ margin: 0 }}>Google Analytics did not return the audience reports for this range: {data.error}.</p>
        <p style={{ margin: 'var(--a-s2) 0 0' }}>
          GA4_NOT_CONFIGURED means the property ID or service-account environment variables are missing. Anything else
          is Google refusing every report, usually access or quota. For where visitors are, use the{' '}
          <Link href="/admin/analytics" style={{ color: 'var(--a-accent)' }}>
            Website page
          </Link>
          , which reads our own visit log.
        </p>
      </StatePanel>
    )
  }

  const ageSection = sortAgeSection(data.ageBuckets)
  const lpAgeSection = sortAgeSection(data.sellerLpByAge)

  const age55 = knownShare(sectionRows(ageSection), (r) => r.ageBracket, isSenior)
  const lpAgeBase = knownShare(sectionRows(lpAgeSection), (r) => r.ageBracket, () => true).base
  const genderBase = knownShare(sectionRows(data.genders), (r) => r.gender, () => true).base

  const bendMetroUsers = data.bendMetroUsers
  const bendShare = bendMetroUsers !== null && data.totalUsers ? bendMetroUsers / data.totalUsers : null

  // No seller-page events is "not tracked in this range", not zero visitors:
  // the event has fired on /sell only since 2026-10-14 (see the lane note).
  const lpUsers = data.sellerLpTotals.state === 'ok' ? (data.sellerLpTotals.rows[0]?.users ?? null) : null

  const ageWithheld = ageSection.state === 'withheld'
  const ageValue = age55.share !== null ? formatShare(age55.share) : ageWithheld ? 'Withheld' : null

  return (
    <>
      <VerdictLine tone={lpUsers ? 'ok' : 'attention'}>
        {age55.share !== null ? (
          <>
            <b>{formatShare(age55.share)} of visitors Google could age are 55+</b>
          </>
        ) : ageWithheld ? (
          <>
            <b>Google withheld visitor ages for privacy</b> in this range
          </>
        ) : (
          <>
            <b>No visitor ages</b> in this range
          </>
        )}
        {bendShare !== null ? <> and {formatShare(bendShare)} of visitors sit in the Bend metro.</> : '.'}
      </VerdictLine>

      <NumberStrip
        items={[
          { label: 'Total users', value: data.totalUsers === null ? null : formatInt(data.totalUsers) },
          {
            label: 'Bend metro users',
            value: bendMetroUsers === null ? null : formatInt(bendMetroUsers),
            caption: bendShare === null ? null : `${formatShare(bendShare)} of all`,
          },
          {
            label: 'Seller LP visitors',
            value: lpUsers === null ? null : formatInt(lpUsers),
            caption: data.sellerLpTotals.state === 'empty' ? 'no seller page events in range' : null,
          },
          {
            label: 'Age 55+ share',
            value: ageValue,
            caption: ageValue === 'Withheld' ? 'by Google, for privacy' : 'of users with a known age',
          },
        ]}
      />

      {/* 1. Age bracket distribution */}
      <section aria-label="Age brackets (all visitors)">
        <SectionHead>Age brackets (all visitors)</SectionHead>
        <ReportSection
          section={ageSection}
          label="Age brackets, all visitors"
          cap={8}
          minWidth={480}
          getRowKey={(b) => b.ageBracket}
          columns={[
            { key: 'age', header: 'Age', width: '120px', cell: (b) => <AgeLabel bracket={b.ageBracket} /> },
            { key: 'users', header: 'Users', numeric: true, cell: (b) => formatInt(b.users) },
            { key: 'sessions', header: 'Sessions', numeric: true, cell: (b) => formatInt(b.sessions) },
            {
              key: 'share',
              header: 'Share',
              numeric: true,
              cell: (b) => (isKnownBucket(b.ageBracket) && age55.base > 0 ? formatShare(b.users / age55.base) : '—'),
            },
          ]}
          empty={<>No age data in this window. Google Signals needs more signed-in traffic before it reports ages.</>}
        />
        <Stamp>
          Google Signals takes age and gender from signed-in Google users. Unknown is left out of the share math, so
          shares add to 100% across known brackets.
        </Stamp>
      </section>

      {/* 2. Seller LP age + geo — the HNW targeting report */}
      <section aria-label="Seller LP visitors by age">
        <SectionHead>Seller LP visitors by age</SectionHead>
        <LaneNote>
          Seller page visitors only: the view_landing_page event with variant seller-home-value, which /sell and
          /sell/valuation send. That event has fired there only since 2026-10-14, so an earlier range reads empty even
          when /sell had visitors. Tells you whether your HNW elderly Bend targeting is reaching the right age bracket.
        </LaneNote>
        <ReportSection
          section={lpAgeSection}
          label="Seller LP visitors by age"
          cap={8}
          minWidth={480}
          getRowKey={(b) => b.ageBracket}
          columns={[
            { key: 'age', header: 'Age', width: '120px', cell: (b) => <AgeLabel bracket={b.ageBracket} /> },
            { key: 'users', header: 'Users', numeric: true, cell: (b) => formatInt(b.users) },
            { key: 'visits', header: 'Visits', numeric: true, cell: (b) => formatInt(b.eventCount) },
            {
              key: 'share',
              header: 'Share',
              numeric: true,
              cell: (b) => (isKnownBucket(b.ageBracket) && lpAgeBase > 0 ? formatShare(b.users / lpAgeBase) : '—'),
            },
          ]}
          empty={<>No seller page events with age data in this window.</>}
        />
      </section>

      <section aria-label="Seller LP visitors by city">
        <SectionHead>Seller LP visitors by city</SectionHead>
        <LaneNote>
          Where are they physically. If FB ads are targeted to Bend metro and most seller-LP traffic is elsewhere, the
          targeting is wrong.
        </LaneNote>
        <ReportSection
          section={data.sellerLpByCity}
          label="Seller LP visitors by city"
          cap={8}
          minWidth={520}
          getRowKey={(c, i) => `${c.city}-${i}`}
          columns={[
            { key: 'city', header: 'City', width: '1.1fr', cell: (c) => <CityName city={c.city} /> },
            { key: 'region', header: 'Region', width: '1fr', cell: (c) => <span style={{ color: 'var(--a-text-2)' }}>{c.region}</span> },
            { key: 'users', header: 'Users', numeric: true, cell: (c) => formatInt(c.users) },
            { key: 'visits', header: 'Visits', numeric: true, cell: (c) => formatInt(c.eventCount) },
          ]}
          empty={<>No seller page events with city data in this window.</>}
        />
      </section>

      {/* 3. Gender split */}
      <section aria-label="Gender split (all visitors)">
        <SectionHead>Gender split (all visitors)</SectionHead>
        <ReportSection
          section={data.genders}
          label="Gender split, all visitors"
          cap={8}
          minWidth={480}
          getRowKey={(g) => g.gender}
          columns={[
            { key: 'gender', header: 'Gender', width: '140px', cell: (g) => g.gender },
            { key: 'users', header: 'Users', numeric: true, cell: (g) => formatInt(g.users) },
            { key: 'sessions', header: 'Sessions', numeric: true, cell: (g) => formatInt(g.sessions) },
            {
              key: 'share',
              header: 'Share',
              numeric: true,
              cell: (g) => (isKnownBucket(g.gender) && genderBase > 0 ? formatShare(g.users / genderBase) : '—'),
            },
          ]}
          empty={<>No gender data in this window.</>}
        />
      </section>

      {/* 4. Geography (top cities) */}
      <section aria-label="Top cities">
        <SectionHead>Top cities</SectionHead>
        <LaneNote>
          Google Analytics only sees visitors who allow analytics cookies, and before Oct 9, 2026 the extra page views our
          server sent it carried no visitor location, so city counts that include those days undercount real places. For
          locations from our own visit log, use Where visitors are on the{' '}
          <Link href="/admin/analytics" style={{ color: 'var(--a-accent)' }}>
            Website page
          </Link>
          .
        </LaneNote>
        <ReportSection
          section={data.topCities}
          label="Top cities"
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

      {/* 5. Age x channel — which channel drives which age */}
      <section aria-label="Age by channel">
        <SectionHead>Age × channel</SectionHead>
        <LaneNote>
          Top combinations by sessions, by Google&apos;s default channel (Paid Social, Organic Search and so on). Use this
          to see if FB ads are actually pulling the elderly Bend audience or if they are pulling 18-34.
        </LaneNote>
        <ReportSection
          section={data.ageByChannel}
          label="Age by channel"
          cap={10}
          minWidth={560}
          getRowKey={(r, i) => `${r.ageBracket}-${r.channel}-${i}`}
          columns={[
            { key: 'age', header: 'Age', width: '120px', cell: (r) => <AgeLabel bracket={r.ageBracket} /> },
            { key: 'channel', header: 'Channel', width: '1.6fr', cell: (r) => r.channel },
            { key: 'users', header: 'Users', numeric: true, cell: (r) => formatInt(r.users) },
            { key: 'sessions', header: 'Sessions', numeric: true, cell: (r) => formatInt(r.sessions) },
          ]}
          empty={<>No age and channel combinations in this window.</>}
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
        GA4 Data API with Google Signals (on; briefly off on 2026-10-08, back on that evening, so that day may show
        gaps). Google withholds age and gender groups that are too small, so those sections can read as withheld.
        Range {range.startDate} to {range.endDate}.
      </Stamp>
    </div>
  )
}
