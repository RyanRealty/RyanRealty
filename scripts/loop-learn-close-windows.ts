/**
 * loop-learn-close-windows — the Learn step runner (THE LOOP v1.4.0).
 *
 * For every expired unlearned site_improvement_ledger row in a domain, compute
 * the actual outcome from the named measurement series, write actual_delta +
 * verdict + a §0 trace into notes, and close the row. A metric whose series
 * has no rows inside the measurement window closes as `inconclusive` with the
 * telemetry gap named — recording that the window went unmeasured IS the
 * lesson (G.2 telemetry freshness), and it unfreezes the domain honestly.
 *
 *   npx tsx scripts/loop-learn-close-windows.ts --domain seo-aeo [--dry-run]
 *
 * Verdict rules (printed with every row so anyone can re-verdict):
 *   no series rows in window            -> inconclusive (gap named)
 *   |delta| >= 0.5|predicted|, same sign -> win
 *   |delta| >= 0.5|predicted|, opposite  -> loss
 *   otherwise                            -> flat
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { isExpiredUnlearned } from '../lib/data/loop/ledger-draft'

config({ path: '.env.local' })

const DRY = process.argv.includes('--dry-run')
const domainArg = process.argv.includes('--domain')
  ? process.argv[process.argv.indexOf('--domain') + 1]
  : null

type LedgerRow = {
  id: string
  domain: string
  change_class: string
  surface: string
  metric: string
  baseline_value: number | null
  predicted_delta: number | null
  window_days: number
  shipped_at: string
  actual_delta: number | null
  notes: string | null
}

type Measured =
  | { ok: true; after: number; rows: number; source: string }
  | { ok: false; gap: string; source: string }

function windowRange(row: LedgerRow): { from: string; to: string } {
  const from = new Date(row.shipped_at)
  const to = new Date(from.getTime() + row.window_days * 24 * 60 * 60 * 1000)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

async function pageSeries(
  sb: SupabaseClient,
  surfaces: string[],
  metric: 'clicks' | 'impressions' | 'ctr',
  from: string,
  to: string,
): Promise<{ rows: Array<{ surface: string; metric: string; value: number }>; err?: string }> {
  const { data, error } = await sb
    .from('site_signal')
    .select('surface,metric,value')
    .eq('scope', 'page')
    .in('metric', metric === 'ctr' ? ['clicks', 'impressions'] : [metric])
    .in('surface', surfaces)
    .gte('date', from)
    .lte('date', to)
  if (error) return { rows: [], err: error.message }
  return { rows: (data ?? []) as Array<{ surface: string; metric: string; value: number }> }
}

async function measure(sb: SupabaseClient, row: LedgerRow): Promise<Measured> {
  const { from, to } = windowRange(row)
  const win = `${from}..${to}`

  if (row.metric === 'gsc_clicks_28d' || row.metric === 'gsc_impressions_28d') {
    const metric = row.metric.startsWith('gsc_clicks') ? 'clicks' : 'impressions'
    const surfaces = row.surface.includes(' + ')
      ? row.surface.split(' + ').map((s) => s.trim())
      : [row.surface]
    const src = `site_signal scope=page metric=${metric} surface in (${surfaces.join(', ')}) date ${win}`
    if (row.surface.includes('legacy market-report archive')) {
      // The archive is 51 URLs never enumerated on the row; GSC page scope is
      // top-25/day, so absence is a fact about the series, not the pages.
      return { ok: false, gap: 'surface is an unenumerated 51-URL set and no page-scope rows exist for it in the window', source: src }
    }
    const { rows, err } = await pageSeries(sb, surfaces, metric as 'clicks' | 'impressions', from, to)
    if (err) return { ok: false, gap: `query error: ${err}`, source: src }
    if (rows.length === 0) return { ok: false, gap: 'no page-scope rows in the window (GSC top-25/day series; snapshots not live for this window)', source: src }
    const after = rows.reduce((a, r) => a + Number(r.value), 0)
    return { ok: true, after, rows: rows.length, source: src }
  }

  if (row.metric === 'gsc_ctr_pct_28d') {
    const src = `site_signal scope=page metrics clicks+impressions surface=${row.surface} date ${win}`
    const { rows, err } = await pageSeries(sb, [row.surface], 'ctr', from, to)
    if (err) return { ok: false, gap: `query error: ${err}`, source: src }
    const clicks = rows.filter((r) => r.metric === 'clicks').reduce((a, r) => a + Number(r.value), 0)
    const imps = rows.filter((r) => r.metric === 'impressions').reduce((a, r) => a + Number(r.value), 0)
    if (imps === 0) return { ok: false, gap: 'no impressions rows in the window (series not live for this window)', source: src }
    return { ok: true, after: (clicks / imps) * 100, rows: rows.length, source: src }
  }

  if (row.metric === 'lcp_p75_ms') {
    const src = `web_vitals metric=LCP path=${row.surface} created_at ${win}`
    const { data, error } = await sb
      .from('web_vitals')
      .select('value')
      .eq('metric', 'LCP')
      .eq('path', row.surface)
      .gte('created_at', from)
      .lte('created_at', `${to}T23:59:59Z`)
    if (error) return { ok: false, gap: `query error: ${error.message}`, source: src }
    const values = (data ?? []).map((r) => Number(r.value)).sort((a, b) => a - b)
    if (values.length === 0) return { ok: false, gap: 'no LCP samples for this path in the window', source: src }
    const p75 = values[Math.min(values.length - 1, Math.floor(values.length * 0.75))]
    return { ok: true, after: p75, rows: values.length, source: src }
  }

  if (row.metric === 'ga4_engagement_rate_28d' || row.metric === 'ai_assistant_sessions_28d') {
    const metric = row.metric === 'ga4_engagement_rate_28d' ? 'engagement_rate' : 'ai_assistant_sessions'
    const src = `site_signal scope=account metric=${metric} date ${win}`
    const { data, error } = await sb
      .from('site_signal')
      .select('value,date')
      .eq('scope', 'account')
      .eq('metric', metric)
      .gte('date', from)
      .lte('date', to)
    if (error) return { ok: false, gap: `query error: ${error.message}`, source: src }
    const values = (data ?? []).map((r) => Number(r.value))
    if (values.length === 0) return { ok: false, gap: 'no account-scope rows in the window (snapshot cron not live then)', source: src }
    const after =
      metric === 'engagement_rate'
        ? values.reduce((a, b) => a + b, 0) / values.length
        : values.reduce((a, b) => a + b, 0)
    return { ok: true, after, rows: values.length, source: src }
  }

  return { ok: false, gap: `no measurement mapping for metric "${row.metric}"`, source: 'unmapped' }
}

function verdictFor(delta: number, predicted: number | null): 'win' | 'loss' | 'flat' {
  if (predicted == null || predicted === 0) return Math.abs(delta) > 0 ? 'win' : 'flat'
  const meaningful = Math.abs(delta) >= 0.5 * Math.abs(predicted)
  if (!meaningful) return 'flat'
  return Math.sign(delta) === Math.sign(predicted) ? 'win' : 'loss'
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  let q = sb
    .from('site_improvement_ledger')
    .select('id,domain,change_class,surface,metric,baseline_value,predicted_delta,window_days,shipped_at,actual_delta,notes')
    .is('actual_delta', null)
  if (domainArg) q = q.eq('domain', domainArg)
  const { data, error } = await q
  if (error) throw new Error(error.message)

  const now = new Date()
  const expired = ((data ?? []) as LedgerRow[]).filter((r) =>
    isExpiredUnlearned({ shippedAt: r.shipped_at, windowDays: r.window_days, actualDelta: r.actual_delta }, now),
  )
  console.log(`expired unlearned rows${domainArg ? ` in ${domainArg}` : ''}: ${expired.length}${DRY ? ' (dry run)' : ''}`)

  for (const row of expired) {
    const m = await measure(sb, row)
    const baseline = Number(row.baseline_value ?? 0)
    let actualDelta: number
    let verdict: 'win' | 'loss' | 'flat' | 'inconclusive'
    let trace: string

    if (m.ok) {
      actualDelta = Number((m.after - baseline).toFixed(4))
      verdict = verdictFor(actualDelta, row.predicted_delta == null ? null : Number(row.predicted_delta))
      trace = `Learn ${now.toISOString().slice(0, 10)}: after=${Number(m.after.toFixed(4))} over ${m.rows} rows — ${m.source}. delta=${actualDelta} vs predicted ${row.predicted_delta}. Verdict rule: |delta|>=0.5|predicted| same-sign=win, opposite=loss, else flat.`
    } else {
      actualDelta = 0
      verdict = 'inconclusive'
      trace = `Learn ${now.toISOString().slice(0, 10)}: INCONCLUSIVE — ${m.gap}. Source checked: ${m.source}. Window went unmeasured; telemetry-freshness (G.2) is the lesson, not the metric.`
    }

    console.log(`- ${row.id.slice(0, 8)} ${row.change_class} [${row.metric}] -> ${verdict} (delta ${actualDelta})`)
    console.log(`    ${trace}`)

    if (!DRY) {
      const notes = row.notes ? `${row.notes}\n${trace}` : trace
      const { error: upErr } = await sb
        .from('site_improvement_ledger')
        .update({ actual_delta: actualDelta, verdict, measured_at: now.toISOString(), notes })
        .eq('id', row.id)
      if (upErr) {
        console.error(`  FAILED to close ${row.id}: ${upErr.message}`)
        process.exitCode = 1
      }
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
