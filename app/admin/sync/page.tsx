import Link from 'next/link'
import {
  getAdminSyncCounts,
  getListingHistoryTableStatus,
  getListingsBreakdown,
} from '../../actions/listings'
import { getSyncHistory } from '../../actions/sync-history'
import { cityEntityKey } from '../../../lib/slug'
import { getSyncCursor } from '../../actions/sync-full-cron'
import { getSparkListingsCountForSync, getSparkDataRange } from '../../../lib/spark'
import CronSyncStatus from './CronSyncStatus'
import SyncAllButtons from './SyncAllButtons'
import SyncHistoryTest from './SyncHistoryTest'
import SyncHistoryTable from './SyncHistoryTable'

/** Always fetch fresh cursor and sync history so numbers are up to date after sync or cron. */
export const dynamic = 'force-dynamic'

function formatDate(iso?: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

export default async function SyncPage() {
  const [counts, cursor, historyTable, breakdown, sparkSyncCount, sparkDateRange, syncHistoryRows] = await Promise.all([
    getAdminSyncCounts(),
    getSyncCursor(),
    getListingHistoryTableStatus(),
    getListingsBreakdown(),
    getSparkListingsCountForSync(),
    getSparkDataRange(),
    getSyncHistory(30),
  ])
  const { activeCount, totalListings, historyCount, photosCount, videosCount, historyError } = counts
  const breakdownError = breakdown.breakdownError
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Sync from Spark</h1>
      <p className="mt-2 text-zinc-600">
        Pull listings from the Spark API into Supabase. Safe to run multiple times; existing rows are updated.
      </p>

      {sparkSyncCount != null && !sparkSyncCount.error && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Spark API: listings you have access to</p>
          <p className="mt-1 text-2xl font-bold text-emerald-800">
            {sparkSyncCount.totalListings.toLocaleString()} listings
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Ordered by <strong>On Market Date</strong> (full history, including pre-2024). Data range: {formatDate(sparkDateRange.oldest)} → {formatDate(sparkDateRange.newest)}.
          </p>
          <p className="mt-1 text-xs text-emerald-800/90">
            This is the total count Spark returns for this query — the full set of listing records across the date range above. If the number was similar before the On Market Date change, the earlier query was likely returning the same total but ordered by modification date (so the visible range looked shorter).
          </p>
          <p className="mt-2 text-sm text-amber-800">
            A full sync will paginate through all {sparkSyncCount.totalPages.toLocaleString()} pages ({sparkSyncCount.pageSize} per page) and may take <strong>substantially longer</strong> than before — start it when you can leave it running (e.g. overnight).
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            <Link href="/admin/spark-status" className="underline hover:no-underline">Spark connection status</Link>
          </p>
        </div>
      )}

      {sparkSyncCount?.error && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Spark API count unavailable</p>
          <p className="mt-1 text-sm text-amber-800">{sparkSyncCount.error}</p>
          <p className="mt-1 text-xs text-zinc-600">
            <Link href="/admin/spark-status" className="underline hover:no-underline">Check Spark connection</Link>
          </p>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm font-medium text-zinc-500">Database counts</p>
        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs text-zinc-500">Listings</p>
            <p className="text-xl font-semibold text-zinc-900">{totalListings.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Listings (active)</p>
            <p className="text-xl font-semibold text-zinc-900">{activeCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Photos</p>
            <p className="text-xl font-semibold text-zinc-900">{photosCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Videos</p>
            <p className="text-xl font-semibold text-zinc-900">{videosCount.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">History rows</p>
            <p className="text-xl font-semibold text-zinc-900">{historyCount.toLocaleString()}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Listing history table: {historyTable.exists ? (
            <span className="font-medium text-emerald-700">✓ Exists</span>
          ) : (
            <span className="font-medium text-amber-700">✗ {historyTable.error ?? 'Missing'}</span>
          )}
        </p>
        {historyError && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <strong>Listing history:</strong> {historyError}
          </div>
        )}
        {!historyError && historyCount === 0 && totalListings > 0 && (
          <p className="mt-3 text-sm text-amber-800">
            Listing history is empty. Use <strong>Sync all history</strong> below to backfill from Spark. <strong>History requires a Spark API key with Private role</strong> — IDX/VOW/Portal are often restricted to no history by the MLS. See <code className="rounded bg-zinc-200 px-1">docs/SYNC.md</code> and <a href="https://sparkplatform.com/docs/api_services/listings/history" target="_blank" rel="noopener noreferrer" className="underline">Spark Listings: History</a>.
          </p>
        )}
        <p className="mt-3 text-xs text-zinc-500">Refresh the page to see updated counts after sync.</p>
      </div>

      <div className="mt-6">
        <SyncAllButtons />
      </div>

      <SyncHistoryTable rows={syncHistoryRows} />

      <div className="mt-6">
        <SyncHistoryTest />
      </div>

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Listings breakdown</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Total: <strong>{breakdown.total.toLocaleString()}</strong> listings
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Status values from the Spark API (StandardStatus). Null/empty is shown as Active (Spark often omits status for active listings). Active, Pending, and Closed columns match Spark&apos;s three main listing states.
        </p>
        {breakdownError && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {breakdownError}
          </p>
        )}
        <div className="mt-4 overflow-x-auto">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">By status (raw Spark StandardStatus)</p>
          <table className="mt-2 min-w-[200px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left font-medium text-zinc-700">Status</th>
                <th className="text-right font-medium text-zinc-700">Count</th>
              </tr>
            </thead>
            <tbody>
              {(breakdown.byStatus ?? []).map(({ status, count }) => (
                <tr key={`status-${status}`} className="border-b border-zinc-100">
                  <td className="py-1.5 text-zinc-900">{status}</td>
                  <td className="py-1.5 text-right font-mono text-zinc-700">{count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 overflow-x-auto">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">By city (Active / Pending / Closed per Spark)</p>
          <table className="mt-2 min-w-[400px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left font-medium text-zinc-700">City</th>
                <th className="text-right font-medium text-zinc-700">Total</th>
                <th className="text-right font-medium text-zinc-700">Active</th>
                <th className="text-right font-medium text-zinc-700">Pending</th>
                <th className="text-right font-medium text-zinc-700">Closed</th>
                <th className="text-right font-medium text-zinc-700">Other</th>
              </tr>
            </thead>
            <tbody>
              {(breakdown.byCity ?? []).map(({ city, total, active, pending, closed, other }, index) => (
                <tr key={`city-${index}-${city}`} className="border-b border-zinc-100">
                  <td className="py-1.5">
                    {city === '(no city)' ? (
                      <span className="text-zinc-900">{city}</span>
                    ) : (
                      <Link href={`/search/${cityEntityKey(city)}`} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                        {city}
                      </Link>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono text-zinc-700">{total.toLocaleString()}</td>
                  <td className="py-1.5 text-right font-mono text-zinc-600">{active.toLocaleString()}</td>
                  <td className="py-1.5 text-right font-mono text-zinc-600">{pending.toLocaleString()}</td>
                  <td className="py-1.5 text-right font-mono text-zinc-600">{closed.toLocaleString()}</td>
                  <td className="py-1.5 text-right font-mono text-zinc-600">{other.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <CronSyncStatus cursor={cursor} />
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">What a full sync stores</h3>
        <p className="mt-2 text-sm text-zinc-700">
          If you run <strong>Full sync (listings + history)</strong> with <strong>New only</strong> <em>unchecked</em>:
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-700">
          <li><strong>Listings table</strong> — Every listing row is upserted with full Spark data: core fields (price, beds, address, etc.) plus the <code className="rounded bg-zinc-100 px-1">details</code> JSON column containing <strong>Photos, FloorPlans, Videos, VirtualTours, OpenHouses, Documents</strong> (from Spark’s expand). Existing rows are updated so media and docs are current.</li>
          <li><strong>Listing history table</strong> — For each listing we call Spark’s <code className="rounded bg-zinc-100 px-1">/history</code> and, if empty, <code className="rounded bg-zinc-100 px-1">/historical/pricehistory</code>, then store events (list date, price changes, status) so listing pages show accurate pricing history.</li>
        </ul>
        <p className="mt-3 text-sm text-amber-800">
          Leave <strong>New only</strong> unchecked so existing ~211k rows get refreshed with videos and full details. Check it only for a faster “top up” that skips updating existing listings.
        </p>
      </div>
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        <strong>Videos &amp; virtual tours</strong> — <strong>Sync all listings</strong> requests <code className="rounded bg-zinc-200 px-1">Photos,FloorPlans,Videos,VirtualTours,OpenHouses,Documents</code> from Spark and stores them in the <code className="rounded bg-zinc-200 px-1">details</code> JSON column. <strong>Sync all history</strong> is for price/status history and reports; it does not affect video data.
      </div>
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        <strong>Listing history APIs</strong> — We use <code className="rounded bg-zinc-200 px-1">GET /listings/&#123;id&#125;/history</code> (full audit trail) and, if that returns empty, <code className="rounded bg-zinc-200 px-1">GET /listings/&#123;id&#125;/historical/pricehistory</code> (clean price timeline). Private-role API keys see full history; IDX/VOW/Portal see condensed events (NewListing, BackOnMarket, FieldChange for ListPrice, MlsStatus, etc.). Use <strong>Test listing history API</strong> above to verify.
      </div>

      <p className="mt-6 text-sm text-zinc-500">
        If sync fails with &quot;column does not exist&quot;, add the required columns — see <code className="rounded bg-zinc-100 px-1">docs/SUPABASE_SCHEMA.md</code>. Database size: Supabase Dashboard → Project Settings → Database (or Usage).
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        <Link href="/admin/banners" className="underline hover:no-underline">Banner images</Link> (Grok AI).{' '}
        <Link href="/admin/reports" className="underline hover:no-underline">Market report</Link> (weekly pending/closed by city).
      </p>
    </main>
  )
}
