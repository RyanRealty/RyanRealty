#!/usr/bin/env node
/**
 * check-service-client.mjs (ci:service-client) — audit p1.1.
 *
 * The service-role Supabase client must be the memoized singleton from
 * lib/supabase/service.ts (createServiceClient), NOT a fresh inline
 * `createClient(url, SUPABASE_SERVICE_ROLE_KEY)` per file (the audit found 3+
 * inline copies; ~40 files construct their own). Ratchet: existing offenders
 * are baselined; NEW ones fail. Baseline may only shrink.
 *
 * Usage:
 *   node scripts/check-service-client.mjs                  # check
 *   node scripts/check-service-client.mjs --write-baseline # record offenders
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { walkFiles } from './lib/walk.mjs'

const BASELINE = 'scripts/service-client-baseline.json'
const WRITE = process.argv.includes('--write-baseline')

const CANON = 'lib/supabase/service.ts'
const files = [...walkFiles('app'), ...walkFiles('lib'), ...walkFiles('components')].filter(
  (f) => f !== CANON && !/\.test\.(ts|tsx)$/.test(f),
)
// Offender = constructs a client AND references the service-role key.
const offenders = files
  .filter((f) => {
    const s = readFileSync(f, 'utf8')
    return s.includes('SUPABASE_SERVICE_ROLE_KEY') && /createClient\(/.test(s)
  })
  .sort()

if (WRITE) {
  writeFileSync(BASELINE, JSON.stringify({ note: 'Files constructing an inline service-role client — migrate to createServiceClient() from lib/supabase/service.ts. Count may only shrink.', files: offenders }, null, 2) + '\n')
  console.log(`Wrote ${offenders.length} offenders to ${BASELINE}`)
  process.exit(0)
}

const baseline = existsSync(BASELINE) ? new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).files ?? []) : new Set()
const neu = offenders.filter((f) => !baseline.has(f))

console.log('service-client gate (ci:service-client)')
console.log('=======================================')
console.log(`${offenders.length} inline service-role clients (baseline ${baseline.size})`)
if (neu.length) {
  console.error('\nNEW inline service-role client (use createServiceClient() from lib/supabase/service.ts):')
  for (const f of neu) console.error(`  ✗ ${f}`)
  console.error('\nMigrate to the memoized singleton, or `node scripts/check-service-client.mjs --write-baseline` if unavoidable.')
  process.exit(1)
}
console.log('OK — no new inline service-role clients.')
process.exit(0)
