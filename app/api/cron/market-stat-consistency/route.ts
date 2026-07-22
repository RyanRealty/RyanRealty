import { NextResponse, type NextRequest } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { createServiceClient } from '@/lib/data/client'
import { getAllCitySnapshots } from '@/lib/data'
import { getCityReportSnapshot } from '@/lib/data/market/getCityReportSnapshot'
import { getReportMetrics } from '@/app/actions/reports'
import { sendMarketStatAlertEmail } from '@/lib/market-stat-alert'
import {
  VERDICT_CITIES,
  compareCityCrossPath,
  crossPathFailureLines,
  type CrossPathDelta,
} from './compare'

export const dynamic = 'force-dynamic'

/**
 * market-stat-consistency — the drift gate for the §0 one-number rule.
 *
 * The 2026-07-07 design audit found identical-looking "N active · $X median"
 * ledgers fed by different sources: Bend was 788 on the homepage and 500 on
 * /housing-market, and geo_snapshot_mv's community medians were contaminated
 * by land lots (Pronghorn "median" $194K vs the true SFR $1,595,000). The fix
 * made market_pulse_live canonical for city stats (DAL override) and
 * SFR-scoped the MV medians. This cron keeps both repairs honest:
 *
 *  1. CONTRACT — every city snapshot the DAL returns must equal its pulse row
 *     (count + pending). A mismatch means the override regressed.
 *  2. FRESHNESS — the pulse must have updated within 2 hours (the refresh
 *     runs every 10-15 min; stale pulse = stale numbers site-wide).
 *  3. SENTINEL — bend:pronghorn's MV median must stay SFR-scale (> $500K)
 *     while it has active SFR inventory. If a future MV rewrite drops the
 *     PropertyType filter again, this canary fires the next morning.
 *
 *  5. CROSS-PATH (§0 four-paths consolidation, 2026-07-22) — for each of the
 *     7 verdict cities, compare median close price + active count + months of
 *     supply from (a) the get_city_period_metrics RPC path (the /reports
 *     range-filtered table) and (b) the market_stats_cache / market_pulse_live
 *     cache path (the KB city pages + the /reports hub cards, via
 *     getCityReportSnapshot). Per-figure deltas are logged on every run;
 *     |delta| > 1% (the §0 reconciliation tolerance) alerts. The RPC is pinned
 *     to the cache row's OWN rolling_365d window and default (SFR-intent)
 *     filters so the comparison is apples-to-apples; the known divergence
 *     sources the deltas quantify are documented in ./compare.ts — they are
 *     the remaining consolidation targets, not false positives.
 *
 * Alerts Matt by email on any failure; silent when green.
 */

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const failures: string[] = []
  const sb = createServiceClient()

  // 1 + 2 — pulse rows + freshness
  const { data: pulseRows, error: pulseError } = await sb
    .from('market_pulse_live')
    .select('geo_slug, geo_label, active_count, pending_count, updated_at')
    .eq('geo_type', 'city')
  if (pulseError || !pulseRows?.length) {
    failures.push(`market_pulse_live unreadable or empty (${pulseError?.message ?? 'no rows'})`)
  } else {
    const newest = Math.max(...pulseRows.map((r) => new Date(r.updated_at).getTime()))
    const ageMin = Math.round((Date.now() - newest) / 60000)
    if (ageMin > 120) {
      failures.push(`pulse stale: newest city row is ${ageMin} minutes old (refresh_market_pulse may be down)`)
    }

    const snapshots = await getAllCitySnapshots()
    const snapByKey = new Map(snapshots.map((s) => [s.geoKey, s]))
    for (const p of pulseRows) {
      const snap = snapByKey.get(p.geo_slug.toLowerCase()) ?? snapByKey.get(p.geo_label.toLowerCase())
      if (!snap) continue // city absent from the MV top-50 — nothing rendered to disagree
      if (snap.activeSfrCount !== p.active_count) {
        failures.push(
          `${p.geo_label}: DAL city snapshot says ${snap.activeSfrCount} active but the canonical pulse says ${p.active_count} — the getGeoSnapshot pulse override is not applying`,
        )
      }
    }
  }

  // 4 — weekly market report freshness (conversion-audit 2026-07-15 #6). The
  // Sunday generator covers the week ending the prior Saturday, so a healthy
  // pipeline never lets the newest period_end age past 8 days. Older = a
  // missed firing or a silent generator failure (the 2026-07 mode: the stale
  // listing_tile_mv produced a report nobody knew was blank — and before
  // today's fix, a SATURDAY schedule published every report seven days late).
  const { data: newestReport } = await sb
    .from('market_reports')
    .select('slug, period_end')
    .eq('period_type', 'weekly')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!newestReport) {
    failures.push('market_reports has no weekly rows at all — the generator has never run')
  } else {
    const endMs = new Date(`${newestReport.period_end}T23:59:59Z`).getTime()
    const ageDays = Math.floor((Date.now() - endMs) / 86_400_000)
    if (ageDays > 8) {
      failures.push(
        `weekly market report stale: newest report (${newestReport.slug}) covers a period ending ${newestReport.period_end}, ${ageDays} days ago — /api/cron/market-report missed a firing or failed silently`,
      )
    }
  }

  // 3 — SFR-median sentinel
  const { data: sentinel } = await sb
    .from('geo_snapshot_mv')
    .select('active_sfr_count, median_list_price')
    .eq('geo_type', 'community')
    .eq('geo_key', 'bend:pronghorn')
    .maybeSingle()
  if (sentinel && sentinel.active_sfr_count > 0 && sentinel.median_list_price != null && Number(sentinel.median_list_price) < 500_000) {
    failures.push(
      `geo_snapshot_mv sentinel: bend:pronghorn median $${Math.round(Number(sentinel.median_list_price)).toLocaleString()} with ${sentinel.active_sfr_count} active SFRs — land lots are contaminating community medians again (PropertyType filter lost?)`,
    )
  }

  // 5 — CROSS-PATH (§0 four-paths consolidation). Compare the RPC path against
  // the cache path for the 7 verdict cities. The cache side reads through
  // getCityReportSnapshot — literally the same DAL the /reports hub cards and
  // the KB city pages consume — so an alert here means a visitor could see two
  // different numbers for the same city. The RPC side is called with the cache
  // row's own rolling_365d period bounds and default filters, matching windows.
  const crossPathDeltas: CrossPathDelta[] = []
  await Promise.all(
    VERDICT_CITIES.map(async (city) => {
      try {
        const snapshot = await getCityReportSnapshot(city)
        if (!snapshot || (!snapshot.live && !snapshot.trailing12mo)) {
          failures.push(
            `${city}: no cache-path data at all (no market_pulse_live row AND no market_stats_cache rolling_365d row) — the hub cards and city page are stat-dead for a verdict city`,
          )
          return
        }
        const periodStart = snapshot.trailing12mo?.periodStart ?? null
        const periodEnd = snapshot.trailing12mo?.periodEnd ?? null
        if (!periodStart || !periodEnd) {
          failures.push(
            `${city}: market_stats_cache rolling_365d row missing period bounds — cross-path median comparison has no window to pin the RPC to`,
          )
          return
        }
        // Default filters (all false) = the RPC's SFR-intent baseline, the
        // closest available match to the cache's PropertyType='A' scope.
        const rpcRes = await getReportMetrics(city, periodStart, periodEnd)
        if (!rpcRes.data) {
          failures.push(
            `${city}: get_city_period_metrics RPC failed for ${periodStart}..${periodEnd} (${rpcRes.error ?? 'no data'}) — the /reports RPC path is dark for a verdict city`,
          )
          return
        }
        crossPathDeltas.push(
          ...compareCityCrossPath(
            city,
            {
              median_price: rpcRes.data.median_price,
              current_listings: rpcRes.data.current_listings,
              inventory_months: rpcRes.data.inventory_months,
            },
            {
              medianSalePrice: snapshot.trailing12mo?.medianSalePrice ?? null,
              activeCount: snapshot.live?.activeCount ?? null,
              monthsOfSupply: snapshot.live?.monthsOfSupply ?? null,
            },
          ),
        )
      } catch (err) {
        failures.push(
          `${city}: cross-path check crashed (${err instanceof Error ? err.message : String(err)})`,
        )
      }
    }),
  )
  // Log EVERY per-figure delta (not just breaches) so the drift trend is
  // auditable from cron logs run over run.
  console.log('[market-stat-consistency] cross-path deltas', JSON.stringify(crossPathDeltas))
  failures.push(...crossPathFailureLines(crossPathDeltas))

  if (failures.length > 0) {
    const alert = await sendMarketStatAlertEmail({ failures })
    return NextResponse.json({ ok: false, failures, crossPath: crossPathDeltas, alerted: alert.ok })
  }
  return NextResponse.json({
    ok: true,
    checked: { cities: pulseRows?.length ?? 0, crossPathCities: VERDICT_CITIES.length },
    crossPath: crossPathDeltas,
  })
}
