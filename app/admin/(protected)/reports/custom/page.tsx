// @no-parity — internal admin surface, no public mockup contract.
//
// Custom report builder — 11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md) through the reporting family's shared
// presentation kit (@/components/admin/v2). Presentation only.
//
// Carried over verbatim: the getReportCities read, the `cities` prop handed to
// CustomReportBuilder (same array, same order), and the /admin/analytics back
// link. CustomReportBuilder itself is untouched — every control, date default
// and query it issues is exactly what it was.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), and the page-title <h1> plus the "Performance / Custom report
// builder" breadcrumb are gone — the nav names the page (ADMIN_UI §3 rule 1).
//
// ONE truth correction (§0): getReportCities returns { cities, error } and the
// page discarded the error, so a failed snapshot read handed the builder an
// empty city list that read as "there are no cities to report on". A failed
// read now says it failed.
import Link from 'next/link'
import { getReportCities } from '@/app/actions/reports'
import { VerdictLine, ReportError } from '@/components/admin/v2'
import CustomReportBuilder from './CustomReportBuilder'

export default async function AdminCustomReportPage() {
  const { cities, error } = await getReportCities()

  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={error ? 'attention' : 'ok'}>
          {error ? (
            <>
              <b>The city list could not be read.</b> The builder below has nothing to select
              from.
            </>
          ) : (
            <>
              <b>Any location, any date range.</b> Pick a city, an optional subdivision, and exact
              start and end dates — there are no presets.
            </>
          )}
        </VerdictLine>
      </div>

      {error ? <ReportError what="The city list" href="/admin/reports/custom" /> : null}

      <CustomReportBuilder cities={cities} />

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 24 }}>
        A report can include summary metrics, price bands, time series, and pending or closed
        sales.{' '}
        <Link href="/admin/analytics" style={{ color: 'var(--a-accent)' }}>
          Back to Performance
        </Link>
      </p>
    </div>
  )
}
