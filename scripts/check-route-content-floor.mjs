#!/usr/bin/env node
/**
 * check-route-content-floor.mjs — a page may not lose what it carried.
 *
 * Matt 2026-09-12 ("fix it all"): the loop scored pixels and never asked
 * whether the page still had its hero at full width, its office photo at
 * resolution, its video, its sections. Every one of those went missing on a
 * "score rose" pass. This gate runs BEFORE the evaluator is worth asking: it
 * renders each public class from design_system/public/taste-classes.json on
 * a RUNNING server at 1440, scrolls to the bottom so lazy media loads, and
 * compares scripts/lib/content-floor.mjs's ten measurements with the
 * `contentFloor` on the class's ui_kits parity.json.
 *
 * Under the floor is a hard fail. Lowering a floor is done by editing the
 * number in the same commit (`--seed` re-reads every class and rewrites the
 * floors; the diff shows the drop). A class with no contentFloor is reported
 * and counts as a failure when --require-all is passed; otherwise it warns,
 * so a brand-new class can land and be seeded in the next commit.
 *
 * Usage:
 *   npm run ci:route-content-floor                       # needs a server (BASE)
 *   CONTENT_FLOOR_BASE_URL=http://localhost:3322 npm run ci:route-content-floor
 *   node scripts/check-route-content-floor.mjs --seed https://ryan-realty.com
 *   node scripts/check-route-content-floor.mjs --classes about,team
 *
 * Runs inside scripts/run-runtime-gates.sh after tap-targets, and in the CI
 * production-server step. A missing server is a failure, never a skip.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'
import { floorProblems, measurePage, seedFloor, spliceContentFloor } from './lib/content-floor.mjs'

const ROOT = process.cwd()
const CLASS_REGISTRY_PATH = 'design_system/public/taste-classes.json'
const UI_KITS = 'design_system/ryan-realty/ui_kits'
const NAV_TIMEOUT_MS = Number(process.env.CONTENT_FLOOR_TIMEOUT_MS ?? 60_000)
const SETTLE_MS = Number(process.env.CONTENT_FLOOR_SETTLE_MS ?? 2_000)
const NAV_ATTEMPTS = 2

const argv = process.argv.slice(2)
const seedIdx = argv.indexOf('--seed')
const SEED_BASE = seedIdx >= 0 ? String(argv[seedIdx + 1] ?? '').replace(/\/+$/, '') : null
const classesIdx = argv.indexOf('--classes')
const ONLY = classesIdx >= 0 ? String(argv[classesIdx + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean) : null
const REQUIRE_ALL = argv.includes('--require-all')

const BASE = (SEED_BASE ?? process.env.CONTENT_FLOOR_BASE_URL ?? process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '')

function loadClasses() {
  const raw = JSON.parse(readFileSync(join(ROOT, CLASS_REGISTRY_PATH), 'utf8'))
  const list = Array.isArray(raw?.classes) ? raw.classes : []
  return list.filter((c) => c && typeof c.key === 'string' && typeof c.url === 'string' && (!ONLY || ONLY.includes(c.key)))
}

function parityPathFor(key) {
  return join(ROOT, UI_KITS, key, 'parity.json')
}

async function reachable(url) {
  try {
    const res = await fetch(url, { headers: { ...CI_PROBE_HEADERS }, signal: AbortSignal.timeout(10_000) })
    return res.status < 500
  } catch {
    return false
  }
}

async function measure(page, url) {
  let lastErr = null
  for (let attempt = 1; attempt <= NAV_ATTEMPTS; attempt += 1) {
    try {
      const res = await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS })
      if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : 'none'}`)
      // Scroll the whole document so lazy <img loading="lazy"> and IntersectionObserver
      // media actually load; then return to the top so "hero" means the fold.
      await page.evaluate(async () => {
        const step = Math.max(400, Math.floor(window.innerHeight * 0.8))
        const max = () => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
        for (let y = 0; y < max() && y < 60_000; y += step) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 120))
        }
        window.scrollTo(0, 0)
      })
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      await page.waitForTimeout(SETTLE_MS)
      return await page.evaluate(`(${measurePage.toString()})()`)
    } catch (err) {
      lastErr = err
      if (attempt < NAV_ATTEMPTS) await page.waitForTimeout(3_000)
    }
  }
  throw lastErr ?? new Error('unknown navigation failure')
}

async function main() {
  const classes = loadClasses()
  if (classes.length === 0) {
    console.error(`route-content-floor: no classes selected from ${CLASS_REGISTRY_PATH}.`)
    process.exit(1)
  }
  if (!(await reachable(BASE + '/'))) {
    console.error(`No server answering at ${BASE}.`)
    console.error('This gate measures a real rendered page; it does not guess and it does not skip.')
    console.error('  npm run build && npm run ci:runtime-gates')
    console.error('  CONTENT_FLOOR_BASE_URL=http://localhost:3322 npm run ci:route-content-floor')
    process.exit(1)
  }

  console.log(`route content floor (ci:route-content-floor) — ${SEED_BASE ? 'SEEDING from' : 'measuring'} ${BASE}`)
  console.log('==============================================')

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: CI_PROBE_HEADERS['User-Agent'] })
  const page = await ctx.newPage()

  const failures = []
  const warnings = []
  let checked = 0
  let seeded = 0
  const today = new Date().toISOString().slice(0, 10)

  for (const cls of classes) {
    const pPath = parityPathFor(cls.key)
    if (!existsSync(pPath)) {
      warnings.push(`${cls.key}: no ${UI_KITS}/${cls.key}/parity.json — nothing to hold.`)
      continue
    }
    let parity
    let parityText
    try {
      parityText = readFileSync(pPath, 'utf8')
      parity = JSON.parse(parityText)
    } catch (err) {
      failures.push(`${cls.key}: parity.json unreadable — ${err instanceof Error ? err.message : String(err)}`)
      continue
    }
    let measured
    try {
      measured = await measure(page, BASE + cls.url)
    } catch (err) {
      failures.push(`${cls.key} (${cls.url}): did not render — ${String(err?.message ?? err).split('\n')[0]}`)
      continue
    }

    if (SEED_BASE) {
      const floor = seedFloor(measured, { seededAt: today, seededFrom: SEED_BASE })
      floor.note =
        typeof parity.contentFloor?.note === 'string'
          ? parity.contentFloor.note
          : 'No-regression floor (ci:route-content-floor). A build under any number here fails before the evaluator runs. Lower a number only by hand, in the same commit, with the reason.'
      // Splice, do not re-serialize: these files are hand-edited and a
      // stringify round-trip buries the ten-line change in a thousand-line diff.
      writeFileSync(pPath, spliceContentFloor(parityText, floor))
      seeded += 1
      console.log(`  seeded ${cls.key}: ${JSON.stringify(floor.observed)}`)
      continue
    }

    if (!parity.contentFloor) {
      const line = `${cls.key}: parity.json has no contentFloor. Seed it: node scripts/check-route-content-floor.mjs --seed <baseUrl> --classes ${cls.key}`
      if (REQUIRE_ALL) failures.push(line)
      else warnings.push(line)
      continue
    }
    checked += 1
    const problems = floorProblems(measured, parity.contentFloor)
    if (problems.length) {
      failures.push(`${cls.key} (${cls.url}):\n      ${problems.join('\n      ')}`)
      console.log(`  FAIL ${cls.key}`)
    } else {
      console.log(`  ok   ${cls.key} — words ${measured.words}, images ${measured.images}, hero ${measured.heroImageWidth}px, video ${measured.video}, jsonLd ${measured.jsonLd}`)
    }
  }

  await browser.close()

  if (SEED_BASE) {
    console.log(`\nseeded ${seeded} class floor(s) from ${SEED_BASE}.`)
    if (failures.length) {
      console.log(`\n${failures.length} class(es) could not be seeded:`)
      for (const f of failures) console.log(`  - ${f}`)
      process.exit(1)
    }
    process.exit(0)
  }

  console.log(`\n${checked} class floor(s) checked.`)
  for (const w of warnings) console.log(`  warn: ${w}`)
  if (failures.length) {
    console.log(`\n${failures.length} violation(s):`)
    for (const f of failures) console.log(`  - ${f}`)
    console.log('\nThe page carries less than it did when its floor was seeded. Put it back, or lower the floor by hand in parity.json in this same commit and say why. The evaluator does not run on a page that lost content.')
    process.exit(1)
  }
  console.log('OK - every seeded class holds its content floor.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err))
  process.exit(1)
})
