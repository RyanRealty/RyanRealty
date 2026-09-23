/**
 * loop-learn-close-windows — the Learn step runner (THE LOOP v1.4.0), CLI.
 *
 * The rules live in lib/data/loop/learn-close.ts, shared with the Monday cron
 * (app/api/cron/loop-weekly-measure). For every due site_improvement_ledger
 * row: measure the named metric over its window, write actual_delta + verdict
 * + a §0 trace into notes. No data is not zero (visibility audit 2026-09-22,
 * gsc-trend-2): an unmeasurable window keeps actual_delta NULL and names the gap.
 *
 *   npx tsx scripts/loop-learn-close-windows.ts [--domain seo-aeo] [--dry-run]
 *   npx tsx scripts/loop-learn-close-windows.ts --ids <uuid,uuid,...> [--dry-run]
 *
 * --ids re-learns those rows even if an earlier pass closed them (their old
 * notes are kept; the new trace is appended).
 *
 * GSC metrics read the full store (gsc_page_daily) when it spans the window,
 * else a live Search Console pull (service-account env), else the top-25/day
 * site_signal sample only when the page is in it on every day of the window.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { createGscQuery } from '../lib/data/loop/gsc-api'
import { learnDueWindows, liveGscPageTotals } from '../lib/data/loop/learn-close'

config({ path: '.env.local' })

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  const v = i >= 0 ? process.argv[i + 1] : null
  return v && !v.startsWith('--') ? v : null
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const dryRun = process.argv.includes('--dry-run')
  const domain = arg('--domain')
  const ids = arg('--ids')?.split(',').map((s) => s.trim()).filter(Boolean)
  const sb = createClient(url, key)
  const gsc = await createGscQuery()
  if (!gsc) console.error('no GSC service-account env: GSC metrics read the store or site_signal only')

  const res = await learnDueWindows(
    { sb, gscPageTotals: gsc ? liveGscPageTotals(gsc) : null },
    { domain, ids, dryRun, label: ids?.length ? 're-learn' : undefined },
  )
  if (res.error) {
    console.error(res.error)
    process.exit(1)
  }
  console.log(`${ids?.length ? 're-learn rows' : 'due unlearned rows'}${domain ? ` in ${domain}` : ''}: ${res.due}${dryRun ? ' (dry run)' : ''}`)
  for (const o of res.outcomes) {
    console.log(`- ${o.id.slice(0, 8)} ${o.changeClass} [${o.metric}] ${o.window} -> ${o.verdict} (delta ${o.actualDelta ?? 'NULL'})${dryRun ? '' : o.written ? ' written' : ` NOT WRITTEN: ${o.error}`}`)
    console.log(`    ${o.trace}`)
    if (!dryRun && !o.written) process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
