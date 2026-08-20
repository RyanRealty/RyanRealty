/**
 * repair-report-city-scope.mts — remove the out-of-area city sections from
 * already-published weekly market reports.
 *
 * THE DEFECT (2026-08-19). Seven rows in `market_reports` store city sections
 * for Southern Oregon and the Willamette Valley under the body's own sentence,
 * "Here's what happened in the Central Oregon real estate market last week, by
 * city." weekly-2026-05-24 stored 38 city sections and 274 closings, 26 of
 * those cities out of area. The generator inherited whatever the statewide MLS
 * feed returned and never asserted a geography; that is fixed in
 * app/actions/market-reports.ts (scopeReportCities) and enforced on the way out
 * in lib/data/market/getMarketReports.ts (scopeReportHtml). This script fixes
 * the stored rows themselves so the database stops holding a Central Oregon
 * report full of Medford.
 *
 * WHAT IT DOES NOT DO. It does not regenerate the affected weeks. The tile MV
 * no longer carries closings that old (verified 2026-08-19: the 2026-03-08,
 * 03-22, 03-29, 04-12 and 05-10 windows return zero rows today), so a
 * regeneration would replace real, verified Central Oregon closings with an
 * empty page. Every figure this script keeps is an MLS row that closed in the
 * window; every figure it removes is out of area. §0.7 — fewer numbers, all
 * of them true.
 *
 * Idempotent: rerunning on a repaired row is a no-op.
 *
 *   npx tsx scripts/repair-report-city-scope.mts            # dry run
 *   npx tsx scripts/repair-report-city-scope.mts --apply    # write
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { scopeReportHtml, REPORT_SCOPE_LABEL } from '../lib/market/report-scope'

const APPLY = process.argv.includes('--apply')

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const envPath = path.join(root, '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const [, key, raw] = m
    if (process.env[key!] !== undefined) continue
    process.env[key!] = raw!.replace(/^["']|["']$/g, '')
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required.')
    process.exit(1)
  }
  const sb = createClient(url, serviceKey)

  const { data, error } = await sb
    .from('market_reports')
    .select('slug, content_html')
    .order('period_start', { ascending: false })
  if (error) throw new Error(error.message)
  const rows = data ?? []
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — scope: ${REPORT_SCOPE_LABEL}`)
  console.log(`market_reports rows: ${rows.length}\n`)

  const backupDir = path.join(root, 'out')
  fs.mkdirSync(backupDir, { recursive: true })
  const backupPath = path.join(backupDir, `market_reports-before-scope-repair-${Date.now()}.json`)

  const touched: Array<{ slug: string; removed: string[]; kept: string[] }> = []
  const backups: Array<{ slug: string; content_html: string | null }> = []

  for (const row of rows) {
    const slug = row.slug as string
    const html = (row.content_html as string | null) ?? null
    const scoped = scopeReportHtml(html)
    if (scoped.unresolvedSections > 0) {
      console.log(`${slug}: ${scoped.unresolvedSections} section(s) with no readable city heading — kept`)
    }
    if (scoped.removedCities.length === 0) {
      console.log(`${slug}: in scope (${scoped.keptCities.length} cities) — no change`)
      continue
    }
    console.log(
      `${slug}: removing ${scoped.removedCities.length} of ${scoped.removedCities.length + scoped.keptCities.length} cities`,
    )
    console.log(`   removed: ${scoped.removedCities.join(', ')}`)
    console.log(`   kept:    ${scoped.keptCities.join(', ')}`)
    touched.push({ slug, removed: scoped.removedCities, kept: scoped.keptCities })
    backups.push({ slug, content_html: html })

    if (APPLY) {
      if (scoped.keptCities.length === 0) {
        console.log(`   SKIPPED — every section is out of area; a blank report is not an improvement.`)
        continue
      }
      const { error: writeErr } = await sb
        .from('market_reports')
        .update({ content_html: scoped.html })
        .eq('slug', slug)
      if (writeErr) throw new Error(`${slug}: ${writeErr.message}`)
      console.log(`   written`)
    }
  }

  if (touched.length > 0) {
    fs.writeFileSync(backupPath, JSON.stringify(backups, null, 2))
    console.log(`\nprevious bodies saved to ${backupPath}`)
  }
  console.log(`\n${touched.length} row(s) ${APPLY ? 'repaired' : 'would be repaired'}.`)
  if (!APPLY && touched.length > 0) console.log('Rerun with --apply to write.')
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
