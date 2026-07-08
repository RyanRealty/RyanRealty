import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { createServiceClient } from '@/lib/data/client'
import { getAllCitySnapshots } from '@/lib/data'
import { sendMarketStatAlertEmail } from '@/lib/market-stat-alert'

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
 * Alerts Matt by email on any failure; silent when green.
 */

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  if (failures.length > 0) {
    const alert = await sendMarketStatAlertEmail({ failures })
    return NextResponse.json({ ok: false, failures, alerted: alert.ok })
  }
  return NextResponse.json({ ok: true, checked: { cities: pulseRows?.length ?? 0 } })
}
