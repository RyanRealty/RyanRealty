/**
 * Local accept: Powell Butte month-median publish against live cache.
 *   npx tsx scripts/loop-accept-powell-butte-month.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { publishCompleteMonthMedian } from '../lib/market/publish-complete-month-median'
import { zonedDateKey } from '../lib/format/date'
import { formatPrice } from '../lib/format/money'

config({ path: '.env.local' })

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE')
    process.exit(2)
  }
  const sb = createClient(url, key)
  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const { data: monthlyRows, error } = await sb
    .from('market_stats_cache')
    .select('period_type,period_start,median_sale_price,sold_count')
    .eq('geo_type', 'city')
    .eq('geo_slug', 'powell butte')
    .eq('period_type', 'monthly')
    .order('period_end', { ascending: false })
    .limit(6)
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  const monthly = (monthlyRows ?? [])[0]
  const lastComplete = (monthlyRows ?? []).find(
    (r) => String(r.period_start).slice(0, 7) < currentMonthKey,
  )
  const published = publishCompleteMonthMedian({
    monthly: monthly
      ? { medianSalePrice: monthly.median_sale_price, periodStart: monthly.period_start }
      : null,
    lastComplete: lastComplete
      ? { medianSalePrice: lastComplete.median_sale_price, periodStart: lastComplete.period_start }
      : null,
    currentMonthKey,
  })
  console.log(
    JSON.stringify(
      {
        currentMonthKey,
        monthly,
        lastComplete,
        published,
        formatted: published ? formatPrice(published.value) : null,
      },
      null,
      2,
    ),
  )
  if (!published || published.label === 'this month median sale') {
    console.error('ACCEPT FAIL: expected a named complete-month median for Powell Butte')
    process.exit(1)
  }
  if (published.value !== 1_262_500 || published.label !== 'July median sale') {
    // July is the founding row as of 2026-08-18. If the calendar moved, still
    // require a complete-month grain with a positive median.
    if (published.grain !== 'complete' || published.value <= 0) {
      console.error('ACCEPT FAIL: published grain/value unexpected', published)
      process.exit(1)
    }
  }
  console.log('ACCEPT OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
