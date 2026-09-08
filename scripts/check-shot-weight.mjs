#!/usr/bin/env node
/**
 * check-shot-weight.mjs (G74) — a review screenshot may not be a 10 MB blob.
 *
 * THE INCIDENT. Forensic audit of the site queue's first day (Matt 2026-09-08):
 * in one 6h37m window, 76 PNG file-changes wrote 105.78 MB (110,920,715 bytes)
 * of new blob content into permanent git history and grew the working tree
 * +51.23 MB net. Seven commits each wrote more than 5 MB of new PNG.
 * `ui_kits/neighborhood/shots/desktop.png` went 1,147,456 -> 4,298,049 ->
 * 10,619,761 bytes (9.25x) across commits 9fbd1638 and 1f60f8d7;
 * `city/shots/desktop.png` hit 11,346,285 in a single commit. Git history is
 * append-only, so every one of those bytes is re-paid on every cloud-agent
 * clone and in every Vercel build context, forever, for a picture nobody will
 * open again after the review it was taken for.
 *
 * The mechanism was `fullPage: true` at `deviceScaleFactor: 2` — a 16,300 CSS
 * px place page becomes a 2880 x 32,600 raw PNG. Resolution was not the problem
 * and is not what this gate takes away.
 *
 * THE CAP: 1,048,576 bytes (1 MiB) per PNG under `design_system/**\/shots/**`.
 *
 * Chosen from the measured distribution, not from taste. Across the 82 shot
 * PNGs on disk 2026-09-08 (76.05 MB total): median 238,485 · p75 667,031 · p90
 * 1,478,031 · max 11,346,285. Re-encoding the heaviest correctly-shaped shot
 * in the tree — `sell/shots/sell-1440.png`, a photo-wall hero already captured
 * at 1440x900 scale 1 — through the pipeline `take-route-shots.mjs` now uses
 * (palette-quantized, no dither) takes it from 1,583,714 to 545,567 bytes.
 * That is the worst realistic well-captured case, so the cap sits at ~1.9x it.
 * It clears every viewport shot with room to spare, sits just above p75, and
 * fails all seven of the 1.2-11.3 MB full-page 2x stitches this gate exists
 * for. 17 of the 82 files exceed it today; those are the baseline.
 *
 * THE BASELINE is shrink-only, the same posture as
 * `scripts/gates-wired-baseline.json`: today's oversized files are recorded
 * with the size they are at, and the list may only get shorter. Three ways to
 * go red, so a baseline cannot quietly become a licence:
 *
 *   1. An oversized PNG that is not in the baseline           — the new offender
 *   2. A baselined PNG that is now UNDER the cap              — it must leave
 *   3. A baselined PNG that has GROWN past its recorded size  — 1.1 -> 4.3 ->
 *      10.6 MB is exactly how the neighborhood shot got where it is, and each
 *      of those steps was individually "already oversized anyway"
 *
 * A baseline entry whose file no longer exists also fails: a baseline that
 * outlives its subject is a gate green for the wrong reason.
 *
 * FIX WHEN IT FIRES. Re-capture with the one tool:
 *   node scripts/take-route-shots.mjs <route-key> http://localhost:3199
 * It captures the first viewport at 1440x900 and 375x812, scale 1, and
 * quantizes the PNG. For a section further down the page use `--states`
 * rather than a full-page stitch.
 *
 * CANNOT SEE: PNGs outside `shots/`, non-PNG media, or bytes already in
 * history (this gate stops the next one, it does not rewrite the last).
 *
 * CLI:
 *   node scripts/check-shot-weight.mjs                    # pass/fail
 *   node scripts/check-shot-weight.mjs --report           # human, exit 0
 *   node scripts/check-shot-weight.mjs --json             # machine-readable
 *   node scripts/check-shot-weight.mjs --write-baseline   # re-record (shrink only)
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

/** Per-file ceiling for a committed review shot. See the header for the derivation. */
export const SHOT_BYTE_CAP = 1_048_576

export const ROOT_DIR = 'design_system'
export const BASELINE_PATH = 'scripts/shot-weight-baseline.json'

const BASELINE_NOTE =
  'PNGs under design_system/**/shots/** already over the ci:shot-weight cap when G74 landed (2026-09-08). ' +
  'SHRINK-ONLY: a file leaves by being re-captured with scripts/take-route-shots.mjs, and may never grow past ' +
  'the size recorded here. No file may be added. Regenerate with `node scripts/check-shot-weight.mjs --write-baseline`.'

const fmt = (n) => `${n.toLocaleString('en-US')} bytes`

/** Every PNG under a `shots/` directory anywhere in `dir`. Paths are POSIX-relative to cwd. */
export function findShotPngs(dir = ROOT_DIR) {
  const out = []
  const walk = (current) => {
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
        const rel = relative(process.cwd(), resolve(full)).split(sep).join('/')
        if (rel.split('/').includes('shots')) out.push(rel)
      }
    }
  }
  walk(dir)
  return out.sort()
}

/**
 * Pure evaluation, so the break-tests can drive it without a filesystem.
 * @param {{path: string, bytes: number}[]} files
 * @param {Record<string, number>} baseline  path -> recorded size
 */
export function evaluate(files, baseline = {}, cap = SHOT_BYTE_CAP) {
  const sizes = new Map(files.map((f) => [f.path, f.bytes]))

  const newOversize = files
    .filter((f) => f.bytes > cap && !(f.path in baseline))
    .map((f) => ({ path: f.path, bytes: f.bytes }))

  const grown = []
  const nowUnderCap = []
  const missing = []
  for (const [path, recorded] of Object.entries(baseline)) {
    if (!sizes.has(path)) {
      missing.push({ path, recorded })
      continue
    }
    const bytes = sizes.get(path)
    if (bytes <= cap) nowUnderCap.push({ path, bytes, recorded })
    else if (bytes > recorded) grown.push({ path, bytes, recorded })
  }

  return {
    cap,
    scanned: files.length,
    totalBytes: files.reduce((sum, f) => sum + f.bytes, 0),
    newOversize,
    grown,
    nowUnderCap,
    missing,
    failed:
      newOversize.length > 0 || grown.length > 0 || nowUnderCap.length > 0 || missing.length > 0,
  }
}

function readBaseline(path = BASELINE_PATH) {
  if (!existsSync(path)) return {}
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  const files = parsed.files ?? {}
  // Tolerate the plain-array form (gates-wired's shape) by treating an entry
  // with no recorded size as "may not grow at all past the cap".
  if (Array.isArray(files)) return Object.fromEntries(files.map((f) => [f, SHOT_BYTE_CAP]))
  return files
}

function collect(rootDir) {
  return findShotPngs(rootDir).map((path) => ({ path, bytes: statSync(path).size }))
}

function main() {
  const argv = process.argv.slice(2)
  const asJson = argv.includes('--json')
  const report = argv.includes('--report')
  const write = argv.includes('--write-baseline')
  const rootArg = argv.find((a) => a.startsWith('--root='))
  const rootDir = rootArg ? rootArg.slice('--root='.length) : ROOT_DIR
  const baselineArg = argv.find((a) => a.startsWith('--baseline='))
  const baselinePath = baselineArg ? baselineArg.slice('--baseline='.length) : BASELINE_PATH

  const files = collect(rootDir)

  if (write) {
    const oversized = files.filter((f) => f.bytes > SHOT_BYTE_CAP).sort((a, b) => b.bytes - a.bytes)
    const seeding = !existsSync(baselinePath)
    const previous = readBaseline(baselinePath)
    const added = seeding ? [] : oversized.filter((f) => !(f.path in previous)).map((f) => f.path)
    writeFileSync(
      baselinePath,
      JSON.stringify(
        {
          note: BASELINE_NOTE,
          generated_by: 'check-shot-weight.mjs --write-baseline',
          cap_bytes: SHOT_BYTE_CAP,
          files: Object.fromEntries(oversized.map((f) => [f.path, f.bytes])),
        },
        null,
        2,
      ) + '\n',
    )
    console.log(`Wrote ${oversized.length} oversized shot(s) to ${baselinePath}`)
    if (added.length) {
      console.log('NOTE — these were NOT in the previous baseline. A shrink-only list is not the place to park a new offender:')
      for (const p of added) console.log(`  + ${p}`)
    }
    process.exit(0)
  }

  const baseline = readBaseline(baselinePath)
  const result = evaluate(files, baseline)

  if (asJson) {
    console.log(JSON.stringify(result, null, 2))
    process.exit(report || !result.failed ? 0 : 1)
  }

  console.log('Shot weight')
  console.log('===========\n')
  console.log(
    `${result.scanned} PNG(s) under ${rootDir}/**/shots/** · ${fmt(result.totalBytes)} total · cap ${fmt(result.cap)} each · ${Object.keys(baseline).length} baselined`,
  )

  if (!result.failed) {
    console.log('\nEvery shot is under the cap or inside the shrink-only baseline at its recorded size.')
    process.exit(0)
  }

  if (result.newOversize.length) {
    console.error(`\nOVER THE CAP (${result.newOversize.length}) — these cannot enter history:`)
    for (const f of result.newOversize) {
      console.error(`  ${f.path}`)
      console.error(`    ${fmt(f.bytes)} · cap ${fmt(result.cap)} · ${(f.bytes / result.cap).toFixed(1)}x over`)
    }
    console.error('\n  Fix: re-capture it with the one tool, which shoots the first viewport at')
    console.error('  1440x900 and 375x812, scale 1, and quantizes the PNG:')
    console.error('\n    node scripts/take-route-shots.mjs <route-key> http://localhost:3199')
    console.error('\n  For a section further down the page use --states, never a full-page stitch.')
  }

  if (result.grown.length) {
    console.error(`\nBASELINED BUT GROWING (${result.grown.length}) — an oversized shot may not get heavier:`)
    for (const f of result.grown) {
      console.error(`  ${f.path}`)
      console.error(`    ${fmt(f.bytes)}, was ${fmt(f.recorded)} (+${fmt(f.bytes - f.recorded)})`)
    }
    console.error('\n  Re-capture with scripts/take-route-shots.mjs. Do not re-record the baseline.')
  }

  if (result.nowUnderCap.length) {
    console.error(`\nBASELINE IS STALE (${result.nowUnderCap.length}) — now under the cap, so it must leave the list:`)
    for (const f of result.nowUnderCap) console.error(`  ${f.path} — ${fmt(f.bytes)}`)
    console.error('\n  Fix: node scripts/check-shot-weight.mjs --write-baseline')
  }

  if (result.missing.length) {
    console.error(`\nBASELINE ENTRY WITH NO FILE (${result.missing.length}) — a baseline outliving its subject is a green for the wrong reason:`)
    for (const f of result.missing) console.error(`  ${f.path}`)
    console.error('\n  Fix: node scripts/check-shot-weight.mjs --write-baseline')
  }

  if (report) {
    console.log('\n(--report: findings only, exit 0)')
    process.exit(0)
  }
  console.error('\nci:shot-weight FAILED.')
  process.exit(1)
}

const invokedDirectly = (() => {
  try {
    return Boolean(process.argv[1]) && process.argv[1].endsWith('check-shot-weight.mjs')
  } catch {
    return false
  }
})()
if (invokedDirectly) main()
