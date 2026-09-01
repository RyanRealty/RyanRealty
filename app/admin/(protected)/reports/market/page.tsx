// @no-parity — internal admin surface, no public mockup contract.
//
// Market report generator — 11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the reporting family's shared
// presentation kit (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: the getReportCities read, the city set and its order
// (getAllCitySnapshots reads geo_snapshot_mv where geo_type='city' and
// active_sfr_count > 0, then getReportCities sorts by geoLabel with
// localeCompare 'en'/base — alphabetical), and every
// /reports/city/<encodeURIComponent(city)> href. No metric, window, filter
// default, sort order, unit or rounding moved — the only figure this page
// renders is the length of that list.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the page-title <h1> and the "Cities" <h2> gave way to the nav
// + SectionHead, and the bullet list became the family's quiet rows.
//
// TWO truth corrections (§0), both in copy, neither touching a number:
//   1. The page claimed the stats are "pre-computed by the
//      reporting/compute-market-stats job (after sync and daily at 2 AM)".
//      No such job exists — no route under app/api, no entry in vercel.json,
//      and no reference anywhere in the repo outside that sentence. An invented
//      schedule is a fabricated number (§0), so it is gone.
//   2. getReportCities returns { cities, error } and the page discarded the
//      error, so a failed snapshot read rendered as "there are no cities".
//      A failed read now says it failed.
//
// P12 (2026-08-09): _fetchAllCitySnapshots no longer caps at 50 — it pages the
// full geo_snapshot_mv city set, so a count of cities here means cities with
// active single-family inventory, not "the first fifty by count".
import Link from 'next/link'
import { getReportCities } from '@/app/actions/reports'
import { SectionHead, VerdictLine, ReportError } from '@/components/admin/v2'

export default async function AdminMarketReportPage() {
  const { cities, error } = await getReportCities()

  return (
    <div className="av2-scope" style={{ maxWidth: 760, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={error ? 'attention' : 'ok'}>
          {error ? (
            <>
              <b>The city list could not be read.</b> Nothing below is a measurement.
            </>
          ) : (
            <>
              <b>
                {cities.length} {cities.length === 1 ? 'city' : 'cities'} to report on.
              </b>{' '}
              Open one for its market report.
            </>
          )}
        </VerdictLine>
      </div>

      {error ? <ReportError what="The city list" href="/admin/reports/market" /> : null}

      <SectionHead>Cities</SectionHead>
      {cities.length === 0 ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: 0 }}>
          No city in geo_snapshot_mv currently carries an active single-family listing. The
          snapshot also falls back to an empty list when its read fails, so an empty list here is
          not proof the market is empty.
        </p>
      ) : (
        <ul className="av2-quietlist">
          {cities.map((city) => (
            <li key={city} className="av2-quiet">
              <Link
                href={`/housing-market/${encodeURIComponent(city.toLowerCase().replace(/\s+/g, '-'))}`}
                className="av2-quiet__name"
                style={{ textDecoration: 'none', color: 'var(--a-accent)' }}
              >
                {city}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Listed alphabetically. The list is the 50 cities with the most active single-family
        listings in geo_snapshot_mv, so it is not every city that has one — a quiet city can be
        absent.{' '}
        <Link href="/admin/analytics" style={{ color: 'var(--a-accent)' }}>
          Back to Performance
        </Link>
      </p>
    </div>
  )
}
