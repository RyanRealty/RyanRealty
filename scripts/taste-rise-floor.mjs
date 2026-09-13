#!/usr/bin/env node
/**
 * taste-rise-floor.mjs — how big a rise the judge can tell from its own noise.
 *
 * The accept test says a route's median must RISE over its prior mark. With no
 * floor, pure judge noise passed as progress: two medians-of-3 of the SAME page
 * differ by one or more point a third of the time. This script measures that
 * from the table itself and prints the floor the receipt gate enforces
 * (scripts/lib/taste-receipt.mjs RISE_FLOOR, frozen in
 * design_system/public/taste-rule-freeze.json riseFloorBasis).
 *
 * Method (deterministic, seeded):
 *   1. Residuals: every scoring minus its class median, pooled across the
 *      table (27 classes x 3 scorings = 81 residuals on 2026-09-12).
 *   2. No-change simulation: draw two medians-of-3 from the pooled residuals,
 *      take the difference, repeat N times.
 *   3. The floor is the one-sided 95th percentile of that difference — the
 *      smallest rise that noise alone produces less than 5% of the time.
 *
 * `--pair <other-table.json>` also prints the OBSERVED |Δ median| per class
 * between two table passes on the same shots (a direct repeatability check
 * that needs no distributional assumption).
 *
 *   node scripts/taste-rise-floor.mjs
 *   node scripts/taste-rise-floor.mjs --pair /tmp/taste-table.pass1.json --json
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const TABLE = 'design_system/public/taste-table.json'
const N = 200000
const SEED = 20260912

function parseArgs(argv) {
  const o = { pair: null, json: false, table: TABLE }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--pair') o.pair = argv[++i] ?? null
    else if (a === '--json') o.json = true
    else if (a === '--table') o.table = argv[++i] ?? TABLE
  }
  return o
}

function median3(a) {
  return [...a].sort((x, y) => x - y)[1]
}

function quantile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
}

export function riseFloorBasis(table, { n = N, seed = SEED } = {}) {
  const rows = (table?.rows ?? []).filter((r) => Number.isInteger(r.median) && Array.isArray(r.scores) && r.scores.length === 3)
  const resid = rows.flatMap((r) => r.scores.map((x) => x - r.median))
  if (resid.length < 9) throw new Error(`taste-rise-floor: only ${resid.length} residuals — need a scored table`)
  let s = seed
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  const draw = () => median3([0, 1, 2].map(() => resid[Math.floor(rnd() * resid.length)]))
  const diffs = new Array(n)
  for (let i = 0; i < n; i += 1) diffs[i] = draw() - draw()
  diffs.sort((a, b) => a - b)
  const sd = Math.sqrt(resid.reduce((a, b) => a + b * b, 0) / resid.length)
  const pNoiseRise = (f) => diffs.filter((d) => d >= f).length / n
  const q95 = quantile(diffs, 0.95)
  return {
    method: 'bootstrap: pooled (scoring - class median) residuals; difference of two medians-of-3 under no change; one-sided q95',
    command: 'node scripts/taste-rise-floor.mjs --json',
    table: TABLE,
    tableEvaluatedAt: table.evaluatedAt ?? null,
    evaluatorModel: table.instrument?.evaluatorModel ?? null,
    rubricVersion: table.instrument?.rubricVersion ?? null,
    classes: rows.length,
    residuals: resid.length,
    residualSd: Number(sd.toFixed(2)),
    draws: n,
    seed,
    q90: quantile(diffs, 0.9),
    q95,
    q99: quantile(diffs, 0.99),
    pNoiseRiseAtLeast: { 1: pNoiseRise(1), 3: pNoiseRise(3), [q95]: pNoiseRise(q95) },
  }
}

export function pairedDeltas(tableA, tableB) {
  const byKey = new Map((tableB?.rows ?? []).map((r) => [r.key, r]))
  const pairs = []
  for (const a of tableA?.rows ?? []) {
    const b = byKey.get(a.key)
    if (!Number.isInteger(a.median) || !Number.isInteger(b?.median)) continue
    pairs.push({ key: a.key, a: a.median, b: b.median, delta: b.median - a.median })
  }
  const abs = pairs.map((p) => Math.abs(p.delta)).sort((x, y) => x - y)
  return {
    pairs,
    n: pairs.length,
    medianAbsDelta: abs.length ? abs[Math.floor(abs.length / 2)] : null,
    maxAbsDelta: abs.length ? abs[abs.length - 1] : null,
    atOrAboveFloor: (floor) => pairs.filter((p) => Math.abs(p.delta) >= floor).length,
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())
if (isMain) {
  const opts = parseArgs(process.argv.slice(2))
  const table = JSON.parse(readFileSync(join(ROOT, opts.table), 'utf8'))
  const basis = riseFloorBasis(table)
  let paired = null
  if (opts.pair) {
    const other = JSON.parse(readFileSync(opts.pair.startsWith('/') ? opts.pair : join(ROOT, opts.pair), 'utf8'))
    const p = pairedDeltas(other, table)
    paired = {
      against: opts.pair,
      n: p.n,
      medianAbsDelta: p.medianAbsDelta,
      maxAbsDelta: p.maxAbsDelta,
      classesAtOrAboveFloor: p.atOrAboveFloor(basis.q95),
      pairs: p.pairs,
    }
  }
  if (opts.json) {
    console.log(JSON.stringify({ riseFloor: basis.q95, basis, paired }, null, 2))
  } else {
    console.log(`taste-rise-floor — table ${basis.tableEvaluatedAt} (${basis.evaluatorModel}, ${basis.rubricVersion})`)
    console.log(`  ${basis.classes} classes, ${basis.residuals} residuals, sd ${basis.residualSd}`)
    console.log(`  no-change rise: q90 ${basis.q90} · q95 ${basis.q95} · q99 ${basis.q99}`)
    console.log(`  P(noise rise >= 1) ${(basis.pNoiseRiseAtLeast[1] * 100).toFixed(1)}% · >= ${basis.q95}: ${(basis.pNoiseRiseAtLeast[basis.q95] * 100).toFixed(1)}%`)
    console.log(`\n  RISE FLOOR = ${basis.q95}`)
    if (paired) {
      console.log(`\n  paired re-score vs ${paired.against}: n ${paired.n}, median |Δ| ${paired.medianAbsDelta}, max |Δ| ${paired.maxAbsDelta}, ${paired.classesAtOrAboveFloor} class(es) moved >= the floor with NO page change`)
      for (const p of paired.pairs) console.log(`    ${p.key.padEnd(24)} ${p.a} -> ${p.b} (${p.delta >= 0 ? '+' : ''}${p.delta})`)
    }
  }
}
