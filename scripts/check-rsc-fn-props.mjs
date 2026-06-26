#!/usr/bin/env node
/**
 * check-rsc-fn-props.mjs (ci:rsc-fn-props)
 *
 * A React Server Component may NOT pass a non-serializable FUNCTION as a prop to
 * a Client Component — Next/Turbopack throws at REQUEST time:
 *   "Functions cannot be passed directly to Client Components unless you
 *    explicitly expose it by marking it with 'use server'."
 *
 * This is a RUNTIME 500 that NO build catches (tsc is happy, `next build`
 * compiles fine). It took down /admin/crm/tasks and /admin/crm/inbox in
 * production: a sync `formatDateTime` was passed as a `formatDue` / `formatTs`
 * prop from the server page into a client list component, and every request to
 * those routes hit the error boundary. The fix is always to import + CALL the
 * formatter inside the client child, never to pass it across the boundary.
 *
 * This gate flags the realistic shape of that bug: a SERVER component (a file
 * under app/ WITHOUT a top `'use client'` directive) using a `format*` helper as
 * a JSX prop VALUE (`someProp={formatXxx}`).
 *
 * Ratchet: existing offenders are baselined; NEW ones fail. Baseline may only
 * shrink. The escape hatch (a genuine server->server pass) is --write-baseline.
 *
 * Usage:
 *   node scripts/check-rsc-fn-props.mjs                  # check
 *   node scripts/check-rsc-fn-props.mjs --write-baseline # record offenders
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { walkFiles } from './lib/walk.mjs'

const BASELINE = 'scripts/rsc-fn-props-baseline.json'
const WRITE = process.argv.includes('--write-baseline')

// VALUE side of a JSX attribute that is a bare `format*` identifier:
//   formatDue={formatDateTime}  ->  captures `formatDateTime`
// A format* helper is sync (returns a string); passing it as a prop is the bug.
const FN_PROP = /=\{(format[A-Z]\w*)\}/g

const files = walkFiles('app').filter((f) => /\.tsx$/.test(f) && !/\.test\.tsx$/.test(f))

const offenders = []
for (const f of files) {
  const s = readFileSync(f, 'utf8')
  // Server component only: a file that opts into the client with 'use client'
  // can pass functions to its client children freely (no RSC boundary crossed).
  const head = s.slice(0, 400)
  if (/['"]use client['"]/.test(head)) continue
  const fns = [...new Set([...s.matchAll(FN_PROP)].map((m) => m[1]))]
  if (fns.length) offenders.push({ file: f, fns })
}
offenders.sort((a, b) => a.file.localeCompare(b.file))

if (WRITE) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note: 'Server components passing a format* function as a JSX prop (likely to a client child) — a runtime 500. Import + call the formatter inside the client component instead. Count may only shrink.',
        files: offenders.map((o) => o.file),
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`Wrote ${offenders.length} offenders to ${BASELINE}`)
  process.exit(0)
}

const baseline = existsSync(BASELINE)
  ? new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).files ?? [])
  : new Set()
const neu = offenders.filter((o) => !baseline.has(o.file))

console.log('rsc-fn-props gate (ci:rsc-fn-props)')
console.log('===================================')
console.log(
  `${offenders.length} server components passing a format* function as a prop (baseline ${baseline.size})`,
)
if (neu.length) {
  console.error('\nNEW: a server component passes a function to a (likely) client component — this 500s at runtime:')
  for (const o of neu) console.error(`  ✗ ${o.file}  (${o.fns.join(', ')})`)
  console.error('\nImport + CALL the formatter inside the client child; never pass it across the RSC boundary.')
  console.error('If this is a genuine server->server pass: node scripts/check-rsc-fn-props.mjs --write-baseline')
  process.exit(1)
}
console.log('OK — no server component passes a format* function as a prop.')
process.exit(0)
