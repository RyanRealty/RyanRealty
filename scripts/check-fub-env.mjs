#!/usr/bin/env node
/**
 * check-fub-env.mjs (ci:fub-env) — audit p1.2.
 *
 * The FollowUpBoss API key must be read through getFubApiKey() (lib/crm/fub-env.ts),
 * which reads FOLLOWUPBOSS_API_KEY ?? FUB_API_KEY — NOT a direct
 * `process.env.FOLLOWUPBOSS_API_KEY` / `process.env.FUB_API_KEY` per file (a key
 * set under only one name silently disabled half the system). Ratchet: existing
 * direct readers are baselined; NEW ones fail. Baseline may only shrink.
 *
 * Usage:
 *   node scripts/check-fub-env.mjs                  # check
 *   node scripts/check-fub-env.mjs --write-baseline # record offenders
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'

const BASELINE = 'scripts/fub-env-baseline.json'
const WRITE = process.argv.includes('--write-baseline')
const DIRECT = /process\.env\.(FOLLOWUPBOSS_API_KEY|FUB_API_KEY)\b/

function walk(dir, acc = []) {
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) { if (!/(^|\/)(node_modules|\.next|\.git)(\/|$)/.test(p)) walk(p, acc) }
    else if (/\.(ts|tsx|mjs)$/.test(e.name)) acc.push(p)
  }
  return acc
}

const CANON = 'lib/crm/fub-env.ts'
const files = [...walk('app'), ...walk('lib'), ...walk('components')].filter(
  (f) => f !== CANON && !/\.test\.(ts|tsx)$/.test(f),
)
const offenders = files.filter((f) => DIRECT.test(readFileSync(f, 'utf8'))).sort()

if (WRITE) {
  writeFileSync(BASELINE, JSON.stringify({ note: 'Files reading the FUB API key directly from process.env — migrate to getFubApiKey() from lib/crm/fub-env.ts. Count may only shrink.', files: offenders }, null, 2) + '\n')
  console.log(`Wrote ${offenders.length} offenders to ${BASELINE}`)
  process.exit(0)
}

const baseline = existsSync(BASELINE) ? new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).files ?? []) : new Set()
const neu = offenders.filter((f) => !baseline.has(f))

console.log('FUB env-key gate (ci:fub-env)')
console.log('=============================')
console.log(`${offenders.length} direct FUB-key readers (baseline ${baseline.size})`)
if (neu.length) {
  console.error('\nNEW direct process.env FUB-key read (use getFubApiKey() from lib/crm/fub-env.ts):')
  for (const f of neu) console.error(`  ✗ ${f}`)
  console.error('\nMigrate to the accessor, or `node scripts/check-fub-env.mjs --write-baseline` if unavoidable.')
  process.exit(1)
}
console.log('OK — no new direct FUB-key readers.')
process.exit(0)
