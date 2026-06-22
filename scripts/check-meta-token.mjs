#!/usr/bin/env node
/**
 * check-meta-token.mjs (ci:meta-token) -- audit p3.3.
 *
 * The Meta page token must be read through getMetaPageToken() (lib/meta-env.ts),
 * which reads META_PAGE_ACCESS_TOKEN ?? META_PAGE_TOKEN, NOT a direct per-file
 * process.env read. The live publishers read only META_PAGE_ACCESS_TOKEN, so a
 * token set under only META_PAGE_TOKEN silently disabled them. Ratchet: existing
 * direct readers are baselined; NEW ones fail. Baseline may only shrink.
 *
 * Usage:
 *   node scripts/check-meta-token.mjs                  # check
 *   node scripts/check-meta-token.mjs --write-baseline # record offenders
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { walkFiles } from './lib/walk.mjs'

const BASELINE = 'scripts/meta-token-baseline.json'
const WRITE = process.argv.includes('--write-baseline')
const DIRECT = /process\.env\.(META_PAGE_ACCESS_TOKEN|META_PAGE_TOKEN)\b/

const CANON = 'lib/meta-env.ts'
const files = [...walkFiles('app'), ...walkFiles('lib'), ...walkFiles('components')].filter(
  (f) => f !== CANON && !/\.test\.(ts|tsx)$/.test(f),
)
const offenders = files.filter((f) => DIRECT.test(readFileSync(f, 'utf8'))).sort()

if (WRITE) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note: 'Files reading the Meta page token directly from process.env -- migrate to getMetaPageToken() from lib/meta-env.ts. Count may only shrink.',
        files: offenders,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`Wrote ${offenders.length} offenders to ${BASELINE}`)
  process.exit(0)
}

const baseline = existsSync(BASELINE) ? new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).files ?? []) : new Set()
const neu = offenders.filter((f) => !baseline.has(f))

console.log('Meta page-token gate (ci:meta-token)')
console.log('====================================')
console.log(`${offenders.length} direct Meta-token readers (baseline ${baseline.size})`)
if (neu.length) {
  console.error('\nNEW direct process.env Meta-token read (use getMetaPageToken() from lib/meta-env.ts):')
  for (const f of neu) console.error(`  x ${f}`)
  console.error('\nMigrate to the accessor, or `node scripts/check-meta-token.mjs --write-baseline` if unavoidable.')
  process.exit(1)
}
console.log('OK - no new direct Meta-token readers.')
process.exit(0)
