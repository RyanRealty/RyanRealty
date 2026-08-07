// @no-parity — internal admin surface, no public mockup contract
/**
 * /admin/sync/spark — the MLS API connection probe. Superuser-gated by the
 * shared sync/layout.tsx.
 *
 * 11C: migrated to the v2 admin language (ADMIN_UI.md). Presentation only — the
 * two reads, their arguments, and the door to /admin/sync are carried over
 * verbatim.
 *
 * MUST NOT BREAK: every figure here is whatever getSparkConnectionStatus() /
 * getSparkDataRange() returned on this request. Nothing is derived, defaulted,
 * or remembered.
 *
 * CUT 2026-08-07 (§0), twice:
 *  - The page-size line read "({totalPages} pages at {pageSize ?? 100} per
 *    page)". Two problems. The `?? 100` printed a number nothing measured
 *    whenever Spark omitted PageSize. And the figures themselves describe THIS
 *    probe's pagination, not the sync's: getSparkConnectionStatus() asks for
 *    limit:1, so Spark answers PageSize 1 and TotalPages = TotalRows. Live, the
 *    line rendered "594,567 pages at 1 per page", which a broker reads as a
 *    sync workload. It measured the probe, so it is gone.
 *  - getSparkDataRange()'s error was swallowed, so a failed range read looked
 *    identical to a feed with no dates. A failed read now says so.
 */
import Link from 'next/link'
import { getSparkConnectionStatus, getSparkDataRange } from '@/lib/spark'
import { formatDate } from '@/lib/format/date'
import { VerdictLine } from '@/components/admin/v2'

export default async function SparkStatusPage() {
  const [status, dateRange] = await Promise.all([
    getSparkConnectionStatus(),
    getSparkDataRange(),
  ])

  const quiet = { fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '0 0 6px' } as const

  return (
    <div className="av2-scope" style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <VerdictLine tone={status.connected ? 'ok' : 'attention'}>
        {status.connected ? (
          <>
            <b>Spark is connected.</b>{' '}
            {status.totalListings != null
              ? `${status.totalListings.toLocaleString('en-US')} listings in the feed.`
              : 'Spark did not return a listing count.'}
          </>
        ) : (
          <>
            <b>Spark is not connected.</b> {status.error ?? 'Unknown error'}
          </>
        )}
      </VerdictLine>

      {status.connected && dateRange.error ? (
        <p style={{ ...quiet, color: 'var(--a-danger)' }}>
          The On Market Date range could not be read: {dateRange.error}
        </p>
      ) : null}

      {status.connected && !dateRange.error && (dateRange.oldest || dateRange.newest) ? (
        <p style={quiet}>
          On Market Date runs {formatDate(dateRange.oldest)} to {formatDate(dateRange.newest)}.
        </p>
      ) : null}

      <div className="av2-wordrow" style={{ marginTop: 14 }}>
        <Link href="/admin/sync" className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
          Sync listings to Supabase
        </Link>
      </div>
    </div>
  )
}
