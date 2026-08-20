#!/usr/bin/env node
/**
 * Parallel runner for the static `ci:gates` chain.
 *
 * Same npm scripts, same exit codes. Scheduling only — plus lane selection
 * when `scripts/ci-lanes.json` exists (always ∪ matching path globs).
 * Missing lanes file → the full `ci:gates:chain` list (do not block diet PRs).
 *
 *   node scripts/run-ci-gates.mjs           # CI + `npm run ci:gates`
 *   node scripts/run-ci-gates.mjs --list    # print the plan
 *   CI_GATES_SERIAL=1                       # old one-at-a-time order (bisect)
 *   CI_GATES_CONCURRENCY=8                  # override pool size
 *
 * Typecheck (ci:commit-compiles) starts at t=0 alongside the cheap pool so
 * grep-time is not paid twice. Still one tsc — concurrent typechecks OOM.
 */
import { spawn } from 'node:child_process'
import { cpus } from 'node:os'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parseChain,
  loadLanes,
  listChangedFiles,
  selectGates,
} from './lib/ci-gates-select.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LIST_ONLY = process.argv.includes('--list')
const SERIAL_MODE = process.env.CI_GATES_SERIAL === '1'
const laneArg = process.argv.find((a) => a.startsWith('--lane='))
const LANE_MODE = laneArg ? laneArg.slice('--lane='.length) : 'push'
if (LANE_MODE !== 'push' && LANE_MODE !== 'nightly' && LANE_MODE !== 'cert') {
  console.error(`ci:gates: unknown --lane=${LANE_MODE} (use push, nightly, or cert)`)
  process.exit(2)
}

/** One tsc at a time. Concurrent typechecks OOM and report clean. */
const SERIAL_GATES = new Set(['ci:commit-compiles'])

function concurrency() {
  const forced = Number(process.env.CI_GATES_CONCURRENCY)
  if (Number.isFinite(forced) && forced >= 1) return Math.floor(forced)
  return Math.max(2, Math.min(8, (cpus().length || 4) - 1))
}

function runGate(name) {
  const started = Date.now()
  return new Promise((resolve) => {
    const child = spawn('npm', ['run', name], {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (d) => {
      out += d
    })
    child.stderr.on('data', (d) => {
      out += d
    })
    child.on('error', (err) => {
      resolve({ name, code: 1, ms: Date.now() - started, out: String(err) })
    })
    child.on('close', (code) => {
      resolve({ name, code: code ?? 1, ms: Date.now() - started, out })
    })
  })
}

function fmtMs(ms) {
  return ms >= 10000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

async function runPool(names, limit) {
  const pending = [...names]
  const inflight = new Set()
  const results = []
  let failed = false

  async function pump() {
    while (pending.length && inflight.size < limit && !failed) {
      const name = pending.shift()
      const job = runGate(name).then((r) => {
        inflight.delete(job)
        results.push(r)
        const mark = r.code === 0 ? 'ok' : 'FAIL'
        console.log(`  [${mark} ${fmtMs(r.ms)}] ${r.name}`)
        if (r.code !== 0) {
          failed = true
          pending.length = 0
          console.error(r.out.trimEnd())
        }
      })
      inflight.add(job)
    }
    if (inflight.size) await Promise.race(inflight)
  }

  while (inflight.size || pending.length) await pump()
  await Promise.all(inflight)
  return results
}

async function runSerial(names) {
  const results = []
  for (const name of names) {
    const r = await runGate(name)
    results.push(r)
    const mark = r.code === 0 ? 'ok' : 'FAIL'
    console.log(`  [${mark} ${fmtMs(r.ms)}] ${r.name}`)
    if (r.code !== 0) {
      console.error(r.out.trimEnd())
      break
    }
  }
  return results
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const chain = parseChain(pkg)
const lanes = loadLanes(ROOT)
if ((LANE_MODE === 'nightly' || LANE_MODE === 'cert') && !lanes) {
  console.error(`ci:gates --lane=${LANE_MODE} requires scripts/ci-lanes.json`)
  process.exit(2)
}
const changedFiles =
  lanes && LANE_MODE === 'push' ? listChangedFiles({ cwd: ROOT }) : null
const { selected, skipped } = selectGates({
  chain,
  lanes,
  changedFiles,
  mode: LANE_MODE,
})
const gates = selected
const parallel = gates.filter((g) => !SERIAL_GATES.has(g))
const serial = gates.filter((g) => SERIAL_GATES.has(g))
const pool = concurrency()

function printSelection() {
  console.log(`ci:gates selected ${selected.length}/${chain.length} · skipped ${skipped.length}`)
  console.log(`  selected: ${selected.join(' ') || '(none)'}`)
  console.log(`  skipped: ${skipped.join(' ') || '(none)'}`)
}

if (LIST_ONLY) {
  const reason =
    LANE_MODE === 'nightly' || LANE_MODE === 'cert'
      ? ` · lane=${LANE_MODE}`
      : lanes
        ? ` · ${skipped.length} skipped (nightly/cert/unmatched path)`
        : ' · full chain (no scripts/ci-lanes.json)'
  console.log(
    `ci:gates plan: ${gates.length} unique (${parallel.length} parallel, ${serial.length} serial)` + reason,
  )
  console.log(`concurrency: ${SERIAL_MODE ? 1 : pool}`)
  for (const g of parallel) console.log(`  parallel  ${g}`)
  for (const g of serial) console.log(`  serial    ${g}`)
  for (const g of skipped) console.log(`  skipped   ${g}`)
  process.exit(0)
}

printSelection()

const t0 = Date.now()
console.log(
  SERIAL_MODE
    ? `ci:gates serial · ${gates.length} gates`
    : `ci:gates parallel ×${pool} · ${parallel.length} cheap overlapping ${serial.join(', ') || 'no serial'}`,
)

const results = SERIAL_MODE
  ? await runSerial(gates)
  : await (async () => {
      const serialP = serial.length ? runSerial(serial) : Promise.resolve([])
      const cheap = await runPool(parallel, pool)
      const serialResults = await serialP
      if (cheap.some((r) => r.code !== 0)) return cheap.concat(serialResults)
      return cheap.concat(serialResults)
    })()

const failed = results.filter((r) => r.code !== 0)
const skippedAfterFail = gates.length - results.length
console.log(
  `ci:gates ${failed.length ? 'FAILED' : 'OK'} · ${results.length - failed.length}/${gates.length} passed · ${fmtMs(Date.now() - t0)}` +
    (skippedAfterFail ? ` · ${skippedAfterFail} skipped after first failure` : ''),
)
if (failed.length) process.exit(1)
