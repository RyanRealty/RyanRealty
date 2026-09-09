/**
 * How often a CMA request ends with NO number, by lane and by city, and what the
 * engine said when it refused. Off the queue DAL, so it is the same population
 * /admin/cmas shows. Matt 2026-09-09: "Why can\'t we price the homes?"
 *
 *   npx tsx scripts/cma-unpriced-report.ts
 */
import 'dotenv/config'
import path from 'node:path'
import Module from 'node:module'
const STUB = path.resolve(__dirname, '../test/server-only-stub.ts')
const CACHE_STUB = path.resolve(__dirname, '../test/next-cache-cli-stub.ts')
const resolveFilename = (Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string })._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (this: unknown, request: string, ...args: unknown[]) {
  const req = request === 'server-only' || request === 'client-only' ? STUB : request === 'next/cache' ? CACHE_STUB : request
  return resolveFilename.call(this, req, ...args)
}
// How often does a real request end with no number? Off the queue DAL, per lane.
async function main() {
  const { listCmaQueue } = await import('@/lib/data/cma/unified-queue')
  const { rows } = await listCmaQueue({ limit: 500 })
  const byLane = new Map<string, { rows: number; noNumber: number; zeroComps: number; buildError: number }>()
  for (const r of rows) {
    const lane = String(r.origin ?? 'unknown')
    const cur = byLane.get(lane) ?? { rows: 0, noNumber: 0, zeroComps: 0, buildError: 0 }
    cur.rows++
    if (r.valueLow == null) cur.noNumber++
    if ((r.compsCount ?? 0) === 0) cur.zeroComps++
    if (r.buildError) cur.buildError++
    byLane.set(lane, cur)
  }
  const errs = new Map<string, number>()
  for (const r of rows) {
    if (!r.buildError) continue
    const key = String(r.buildError).replace(/\s+/g, ' ').trim().slice(0, 120)
    errs.set(key, (errs.get(key) ?? 0) + 1)
  }
  const unpriced = rows.filter((r) => r.valueLow == null && r.buildError)
  const cities = new Map<string, number>()
  let rural = 0, inTown = 0, noSearch = 0, factsPath = 0, resortCut = 0, bathCut = 0, noMls = 0, customNew = 0
  for (const r of unpriced) {
    const c = String(r.city ?? 'unknown')
    cities.set(c, (cities.get(c) ?? 0) + 1)
    const e = String(r.buildError)
    if (/within 15 mil|any mailing city/.test(e)) rural++
    else if (/within 5 mil|ILIKE/.test(e)) inTown++
    if (/No comparable search could run/.test(e)) noSearch++
    if (/resort community this home is not in/.test(e)) resortCut++
    if (/different bathroom count/.test(e)) bathCut++
    if (/never have been MLS-listed|No listings row matched/.test(e)) noMls++
    if (/Custom\/new stays on facts/.test(e)) customNew++
    if (/facts path/.test(e)) factsPath++
  }
  console.log('--- the homes we could not price ---')
  console.log('total', unpriced.length, '| rural widest tier', rural, '| in-town widest tier', inTown, '| no search ran', noSearch, '| facts path', factsPath)
  console.log('cause words: resort-community cut', resortCut, '| bathroom-count cut', bathCut, '| never MLS-listed', noMls, '| custom/new facts-only', customNew)
  const allByCity = new Map<string, number>()
  for (const r of rows) {
    const c = String(r.city ?? 'unknown')
    allByCity.set(c, (allByCity.get(c) ?? 0) + 1)
  }
  console.log('city            rows  unpriced   rate')
  for (const [c, n] of [...allByCity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    const u = cities.get(c) ?? 0
    console.log(`${c.padEnd(16)}${String(n).padStart(4)}${String(u).padStart(10)}${((u / n) * 100).toFixed(0).padStart(6)}%`)
  }
  console.log()
  console.log('--- why the build produced no number ---')
  for (const [msg, n] of [...errs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(String(n).padStart(4), msg)
  console.log()
  const out = [...byLane.entries()].sort((a, b) => b[1].rows - a[1].rows)
  console.log('lane            rows  no number   0 comps  build err')
  for (const [lane, c] of out) {
    const pct = c.rows ? ((c.noNumber / c.rows) * 100).toFixed(0) : '0'
    console.log(`${lane.padEnd(16)}${String(c.rows).padStart(4)}${String(c.noNumber).padStart(8)} (${pct}%)${String(c.zeroComps).padStart(8)}${String(c.buildError).padStart(10)}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
