#!/usr/bin/env node
/**
 * Parallel runner for the static `ci:gates` chain.
 *
 * Integrity: every gate in `package.json` → `ci:gates:chain` still runs.
 * Same npm scripts, same exit codes. The only change is scheduling.
 *
 * Why: the chain is ~200 `npm run X &&` steps. Most are cheap file scans.
 * Sequential npm overhead dominated the local push. Typecheck (ci:commit-compiles)
 * stays serial — concurrent tsc OOMs this repo.
 *
 *   node scripts/run-ci-gates.mjs           # CI + `npm run ci:gates`
 *   node scripts/run-ci-gates.mjs --list    # print the plan
 *   CI_GATES_SERIAL=1                       # old one-at-a-time order (bisect)
 *   CI_GATES_CONCURRENCY=8                  # override pool size
 */
import { spawn } from 'node:child_process'
import { cpus } from 'node:os'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LIST_ONLY = process.argv.includes('--list')
const SERIAL_MODE = process.env.CI_GATES_SERIAL === '1'

/** One tsc at a time. Concurrent typechecks OOM and report clean. */
const SERIAL_GATES = new Set(['ci:commit-compiles'])

function parseChain(pkg) {
  const raw = pkg.scripts?.['ci:gates:chain']
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('package.json scripts["ci:gates:chain"] is missing — that string is the source of truth for which gates run')
  }
  const tokens = raw
    .split('&&')
    .map((s) => s.trim())
    .filter(Boolean)
  const gates = []
  const seen = new Set()
  for (const tok of tokens) {
    const m = tok.match(/^npm run (ci:[\w:-]+)$/)
    if (!m) {
      throw new Error(`ci:gates:chain token is not \`npm run ci:…\`: ${tok}`)
    }
    const name = m[1]
    if (name === 'ci:gates' || name === 'ci:gates:chain') {
      throw new Error(`${name} cannot appear inside ci:gates:chain (recursion)`)
    }
    if (seen.has(name)) continue
    seen.add(name)
    if (!pkg.scripts?.[name]) {
      throw new Error(`ci:gates:chain names ${name} but that script does not exist`)
    }
    gates.push(name)
  }
  if (gates.length < 150) {
    throw new Error(`ci:gates:chain parsed ${gates.length} gates; expected ≥ 150. Refusing to run a truncated chain.`)
  }
  return gates
}

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
const gates = parseChain(pkg)
const parallel = gates.filter((g) => !SERIAL_GATES.has(g))
const serial = gates.filter((g) => SERIAL_GATES.has(g))
const pool = concurrency()

if (LIST_ONLY) {
  console.log(`ci:gates plan: ${gates.length} unique (${parallel.length} parallel, ${serial.length} serial)`)
  console.log(`concurrency: ${SERIAL_MODE ? 1 : pool}`)
  for (const g of parallel) console.log(`  parallel  ${g}`)
  for (const g of serial) console.log(`  serial    ${g}`)
  process.exit(0)
}

const t0 = Date.now()
console.log(
  SERIAL_MODE
    ? `ci:gates serial · ${gates.length} gates`
    : `ci:gates parallel ×${pool} · ${parallel.length} cheap, then ${serial.join(', ') || 'no serial'}`,
)

const results = SERIAL_MODE
  ? await runSerial(gates)
  : await (async () => {
      const cheap = await runPool(parallel, pool)
      if (cheap.some((r) => r.code !== 0)) return cheap
      return cheap.concat(await runSerial(serial))
    })()

const failed = results.filter((r) => r.code !== 0)
const skipped = gates.length - results.length
console.log(
  `ci:gates ${failed.length ? 'FAILED' : 'OK'} · ${results.length - failed.length}/${gates.length} passed · ${fmtMs(Date.now() - t0)}` +
    (skipped ? ` · ${skipped} skipped after first failure` : ''),
)
if (failed.length) process.exit(1)
