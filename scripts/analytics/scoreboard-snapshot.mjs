#!/usr/bin/env node
/**
 * scoreboard-snapshot.mjs — ops scoreboard probe (not Matt-click dependent)
 *
 * Reads first-party + conversion tables via Supabase service role and prints
 * a one-line weekly scoreboard + VERIFY_LOG-ready fields.
 *
 * Usage:
 *   node scripts/analytics/scoreboard-snapshot.mjs
 *   node scripts/analytics/scoreboard-snapshot.mjs --json
 *   node scripts/analytics/scoreboard-snapshot.mjs --append-verify-log
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Engaged definition (product ops): visitor_sessions.engagement_score >= 2
 * in the window (multi-signal sessions; score 1 is often a single hit).
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
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
const appendLog = args.includes('--append-verify-log')

async function count(table, apply) {
  let q = sb.from(table).select('*', { count: 'exact', head: true })
  if (apply) q = apply(q)
  const { count, error } = await q
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

function isoDaysAgo(n) {
  return new Date(Date.now() - n * 864e5).toISOString()
}

const now = new Date()
const d1 = isoDaysAgo(1)
const d7 = isoDaysAgo(7)
const d30 = isoDaysAgo(30)

const [
  sessionsTotal,
  sessions1d,
  sessions7d,
  sessions30d,
  engaged7d,
  engaged30d,
  alertsTotal,
  alertsActive,
  alerts30d,
  savedSearches,
] = await Promise.all([
  count('visitor_sessions'),
  count('visitor_sessions', (q) => q.gte('first_seen_at', d1)),
  count('visitor_sessions', (q) => q.gte('first_seen_at', d7)),
  count('visitor_sessions', (q) => q.gte('first_seen_at', d30)),
  count('visitor_sessions', (q) => q.gte('first_seen_at', d7).gte('engagement_score', 2)),
  count('visitor_sessions', (q) => q.gte('first_seen_at', d30).gte('engagement_score', 2)),
  count('listing_alerts'),
  count('listing_alerts', (q) => q.eq('is_active', true)),
  count('listing_alerts', (q) => q.gte('created_at', d30)),
  count('saved_searches'),
])

let mart2024 = null
{
  const { data, error } = await sb
    .from('analytics_mart_market_annual')
    .select('sold_count,total_volume,type_scope')
    .eq('year', 2024)
    .eq('geo_slug', 'central-oregon')
    .eq('geo_type', 'region')
    .eq('type_scope', 'all')
    .maybeSingle()
  if (!error && data) {
    mart2024 = {
      soldCount: data.sold_count,
      totalVolume: Number(data.total_volume),
      volumeBillions: Number(data.total_volume) / 1e9,
    }
  }
}

const snapshot = {
  date: now.toISOString().slice(0, 10),
  capturedAt: now.toISOString(),
  fp: {
    sessionsTotal,
    sessions1d,
    sessions7d,
    sessions30d,
    engaged7d,
    engaged30d,
    engagedRate7d: sessions7d ? +(engaged7d / sessions7d).toFixed(4) : null,
    engagedRate30d: sessions30d ? +(engaged30d / sessions30d).toFixed(4) : null,
    engagedDefinition: 'engagement_score >= 2',
  },
  conversion: {
    listingAlertsTotal: alertsTotal,
    listingAlertsActive: alertsActive,
    listingAlertsCreated30d: alerts30d,
    savedSearches,
  },
  market: mart2024
    ? {
        coClosed2024: mart2024.soldCount,
        coVolume2024: mart2024.totalVolume,
        coVolume2024B: +mart2024.volumeBillions.toFixed(3),
        source: 'analytics_mart_market_annual',
      }
    : { source: 'mart_unavailable' },
}

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2))
} else {
  const eng7pct = snapshot.fp.engagedRate7d != null ? `${(snapshot.fp.engagedRate7d * 100).toFixed(1)}%` : 'n/a'
  const eng30pct = snapshot.fp.engagedRate30d != null ? `${(snapshot.fp.engagedRate30d * 100).toFixed(1)}%` : 'n/a'
  const martLine = mart2024
    ? `${mart2024.soldCount} / $${mart2024.volumeBillions.toFixed(3)}B`
    : 'n/a'
  console.log(`Week of ${snapshot.date} | FP 1d: ${sessions1d} | FP 7d: ${sessions7d} | FP 30d: ${sessions30d} | FP total: ${sessionsTotal}`)
  console.log(`  Engaged (score≥2) 7d: ${engaged7d} (${eng7pct}) | 30d: ${engaged30d} (${eng30pct})`)
  console.log(`  Alerts: ${alertsTotal} total / ${alertsActive} active / ${alerts30d} created 30d | saved_searches: ${savedSearches}`)
  console.log(`  CO closed 2024 (mart): ${martLine}`)
  console.log('')
  console.log('VERIFY_LOG row fields:')
  console.log(
    `| ${snapshot.date} | — | **${mart2024 ? `${mart2024.soldCount} / $${mart2024.volumeBillions.toFixed(3)}B` : 'n/a'}** | — | total ~${sessionsTotal}; 7d ${sessions7d} (eng ${engaged7d}); 30d ${sessions30d} (eng ${engaged30d}) | **${alertsTotal}** (${alertsActive} active) | scoreboard-snapshot.mjs |`,
  )
}

if (appendLog) {
  const logPath = join(ROOT, 'docs/plans/seo-voice/VERIFY_LOG.md')
  if (!existsSync(logPath)) {
    console.error('VERIFY_LOG.md not found; skip append')
    process.exit(0)
  }
  const eng7pct = snapshot.fp.engagedRate7d != null ? `${(snapshot.fp.engagedRate7d * 100).toFixed(1)}%` : 'n/a'
  const martCell = mart2024
    ? `**${mart2024.soldCount} / $${mart2024.volumeBillions.toFixed(3)}B**`
    : 'n/a'
  const row = `| ${snapshot.date} | — | ${martCell} | — | total ~${sessionsTotal}; 7d ${sessions7d} eng ${engaged7d} (${eng7pct}); 30d ${sessions30d} eng ${engaged30d} | **${alertsTotal}** (${alertsActive} active; +${alerts30d} 30d) | scoreboard-snapshot · saves=${savedSearches} |`
  const text = readFileSync(logPath, 'utf8')
  // Insert after header row of Data probe snapshots table
  const marker = '| Date | Active CO | CO closed 2024 | Mart years | FP sessions | Alerts | Notes |\n|------|-----------|----------------|------------|-------------|--------|-------|\n'
  if (text.includes(marker) && !text.includes(`| ${snapshot.date} |`) ) {
    const next = text.replace(marker, `${marker}${row}\n`)
    writeFileSync(logPath, next)
    console.error(`Appended snapshot row to ${logPath}`)
  } else if (text.includes(`| ${snapshot.date} |`)) {
    console.error(`VERIFY_LOG already has a row for ${snapshot.date}; not duplicating`)
  } else {
    appendFileSync(
      logPath,
      `\n### Scoreboard snapshot ${snapshot.date}\n${row}\n`,
    )
    console.error(`Appended fallback note to ${logPath}`)
  }
}
