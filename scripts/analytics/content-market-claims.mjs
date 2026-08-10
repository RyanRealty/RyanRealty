#!/usr/bin/env node
/**
 * content-market-claims.mjs — cube-backed annual size/composition for content (M2)
 *
 * Content engine / market-report-blog / video market claims for **annual volume
 * and composition** must come from analytics_mart_market_annual (same path as
 * getCoMarketAnnual), not invented prose and not raw listings OLAP in skills.
 *
 * Monthly pulse medians/DOM still use market_pulse_live / market_stats_cache
 * (see social_media_skills/market-report-blog/SKILL.md Step 4).
 *
 * Usage:
 *   node scripts/analytics/content-market-claims.mjs
 *   node scripts/analytics/content-market-claims.mjs --year=2024 --type=all
 *   node scripts/analytics/content-market-claims.mjs --json
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
config({ path: join(ROOT, '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })
const args = process.argv.slice(2)
const asJson = args.includes('--json')
const yearArg = args.find((a) => a.startsWith('--year='))
const typeArg = args.find((a) => a.startsWith('--type='))
const year = yearArg ? Number(yearArg.split('=')[1]) : 2024
const typeScope = typeArg ? typeArg.split('=')[1] : 'all'

if (!Number.isFinite(year) || year < 2010 || year > 2100) {
  console.error('Invalid --year=')
  process.exit(1)
}

const { data, error } = await sb
  .from('analytics_mart_market_annual')
  .select(
    'year,type_scope,sold_count,total_volume,median_close,mean_close,property_type_breakdown,methodology,computed_at',
  )
  .eq('geo_type', 'region')
  .eq('geo_slug', 'central-oregon')
  .eq('year', year)
  .eq('type_scope', typeScope)
  .maybeSingle()

if (error) {
  console.error(`Mart query failed: ${error.message}`)
  process.exit(1)
}

if (!data) {
  const payload = {
    ok: false,
    year,
    typeScope,
    error: 'no_mart_row',
    hint: 'Run rebuild-analytics-marts.mjs, then retry. Do not invent volume/composition.',
  }
  if (asJson) console.log(JSON.stringify(payload, null, 2))
  else {
    console.error(`No analytics_mart_market_annual row for ${year} type_scope=${typeScope}`)
    console.error(payload.hint)
  }
  process.exit(2)
}

const claims = {
  ok: true,
  year: data.year,
  typeScope: data.type_scope,
  soldCount: data.sold_count,
  totalVolume: Number(data.total_volume),
  medianClose: data.median_close != null ? Number(data.median_close) : null,
  meanClose: data.mean_close != null ? Number(data.mean_close) : null,
  propertyTypeBreakdown: data.property_type_breakdown ?? {},
  methodology: data.methodology,
  computedAt: data.computed_at,
  source: 'mart',
  /** §0 citation string for content producers */
  citation: `analytics_mart_market_annual region=central-oregon year=${year} type_scope=${typeScope}`,
  /** DAL twin used by public site */
  dal: 'getCoMarketAnnual({ year, typeScope })',
  rules: [
    'Annual sold count / total volume / type mix MUST use this cube (or getCoMarketAnnual).',
    'Do not hand-SQL raw listings for annual volume in content skills.',
    'Monthly medians/DOM/inventory still from market_pulse_live / market_stats_cache.',
    'If ok=false or exit 2, omit the annual claim — never invent.',
  ],
}

if (asJson) {
  console.log(JSON.stringify(claims, null, 2))
} else {
  console.log(`CO market claims ${year} (${typeScope})`)
  console.log(`  sold:   ${claims.soldCount.toLocaleString()}`)
  console.log(
    `  volume: $${claims.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
  )
  if (claims.medianClose != null) {
    console.log(
      `  median: $${claims.medianClose.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    )
  }
  console.log(`  cite:   ${claims.citation}`)
  console.log(`  dal:    ${claims.dal}`)
}
