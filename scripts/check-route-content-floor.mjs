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
 * floors; the diff shows the drop) — including a number under
 * `contentFloor.floors.sectionDepth`, added 2026-09-16 (see below). A class
 * with no contentFloor is reported and counts as a failure when
 * --require-all is passed; otherwise it warns, so a brand-new class can land
 * and be seeded in the next commit.
 *
 * SECTION DEPTH (Matt 2026-09-16, "my community pages are also being
 * stripped"): three commits cut taxlot parcels off the Atlas, trimmed a plat
 * index's provenance, and genericized copy, while every section id stayed on
 * the page — so this gate's ten page-level totals (and ci:page-purpose's
 * section list) both passed. `contentFloor.floors.sectionDepth` (see
 * lib/content-floor.mjs) closes that: it floors ITEMS and WORDS per section
 * id, and flags a floor-held section id that vanished from the page
 * entirely. Older seeds carry no `sectionDepth` key and are unaffected.
 *
 * Usage:
 *   npm run ci:route-content-floor                       # needs a server (BASE)
 *   CONTENT_FLOOR_BASE_URL=http://localhost:3322 npm run ci:route-content-floor
 *   node scripts/check-route-content-floor.mjs --seed https://ryan-realty.com
 *   node scripts/check-route-content-floor.mjs --classes about,team
 *
 *   # Seed ONLY sectionDepth, leaving the ten existing page-level floors (and
 *   # their seededAt) exactly as they are — for landing depth floors on
 *   # classes whose page-level floors are mid-review elsewhere, without
 *   # re-seeding numbers nobody asked to reseed. Requires an EXISTING
 *   # contentFloor (seed the base ten first with a plain --seed).
 *   node scripts/check-route-content-floor.mjs --seed <baseUrl> --classes community --sections-only
 *
 *   # Verify what a seed would write without touching the tracked file:
 *   node scripts/check-route-content-floor.mjs --seed <baseUrl> --classes community --dry-run
 *   # Or write the would-be result to a scratch copy instead of the tracked
 *   # parity.json (exactly one class only):
 *   node scripts/check-route-content-floor.mjs --seed <baseUrl> --classes community --parity-out scratchpad/community-parity-copy.json
 *
 * Runs inside scripts/run-runtime-gates.sh after tap-targets, and in the CI
 * production-server step. A missing server is a failure, never a skip.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'
import { CI_PROBE_HEADERS } from './lib/ci-probe-ua.mjs'
import { floorProblems, isPlainObject, measurePage, seedFloor, seedSectionFloors, spliceContentFloor } from './lib/content-floor.mjs'
import { openGateContext } from './lib/gate-browser.mjs'

const ROOT = process.cwd()
const CLASS_REGISTRY_PATH = 'design_system/public/taste-classes.json'
const UI_KITS = 'design_system/ryan-realty/ui_kits'
const NAV_TIMEOUT_MS = Number(process.env.CONTENT_FLOOR_TIMEOUT_MS ?? 60_000)
const SETTLE_MS = Number(process.env.CONTENT_FLOOR_SETTLE_MS ?? 2_000)
// Bound on waiting for every (now eager) image to finish; see loadEveryImage().
const EAGER_SETTLE_MS = Number(process.env.CONTENT_FLOOR_EAGER_SETTLE_MS ?? 30_000)
// Bound on waiting for a streamed page to finish arriving; see waitForStreamedPage().
const STREAM_SETTLE_MS = Number(process.env.CONTENT_FLOOR_STREAM_SETTLE_MS ?? 30_000)
// A class under its floor is read once more after this wait (0 disables it):
// past lib/site/degraded-isr.ts's 60s lifetime for a degraded render, then
// DEGRADED_REGEN_MS for the regeneration one request starts. See main().
const DEGRADED_RETRY_MS = Number(process.env.CONTENT_FLOOR_DEGRADED_RETRY_MS ?? 62_000)
const DEGRADED_REGEN_MS = Number(process.env.CONTENT_FLOOR_DEGRADED_REGEN_MS ?? 8_000)
// Hydration settle: re-read the per-section map until two consecutive
// readings agree (see measure()).
const STABLE_PASSES = 5
const STABLE_INTERVAL_MS = 1_500
const NAV_ATTEMPTS = 2

const argv = process.argv.slice(2)
const seedIdx = argv.indexOf('--seed')
const SEED_BASE = seedIdx >= 0 ? String(argv[seedIdx + 1] ?? '').replace(/\/+$/, '') : null
const classesIdx = argv.indexOf('--classes')
const ONLY = classesIdx >= 0 ? String(argv[classesIdx + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean) : null
const REQUIRE_ALL = argv.includes('--require-all')
// --sections-only (2026-09-16): re-seeding sectionDepth must not force a
// reseed of the ten page-level floors on a class whose page-level numbers
// are under separate review — see the file header.
const SECTIONS_ONLY = argv.includes('--sections-only')
// --dry-run / --parity-out: verify a seed without touching the tracked
// parity.json. Both only make sense alongside --seed.
const DRY_RUN = argv.includes('--dry-run')
const parityOutIdx = argv.indexOf('--parity-out')
const PARITY_OUT = parityOutIdx >= 0 ? String(argv[parityOutIdx + 1] ?? '').trim() : null

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

/**
 * WAIT FOR THE STREAMED PAGE (2026-09-23). `load` fires on the streamed
 * shell, not the page: on /cities/bend `document.images` held 4 elements at
 * `load` and 776 when the page was read, because the listing ledgers and
 * photo sections stream in behind Suspense after it. The flick below used to
 * run over that short shell, the sections arrived after it, and their lazy
 * images were never scrolled into view. How late they arrive depends on how
 * fast the live database answers, which is why the same build read `images`
 * 62 on one run and 16 on the next. So measurement starts once the network
 * has gone idle AND the document height has held still, both bounded.
 */
async function waitForStreamedPage(page) {
  await page.waitForLoadState('networkidle', { timeout: STREAM_SETTLE_MS }).catch(() => {})
  const deadline = Date.now() + STREAM_SETTLE_MS
  let last = -1
  let still = 0
  while (Date.now() < deadline && still < 3) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    still = height === last ? still + 1 : 0
    last = height
    await page.waitForTimeout(500)
  }
}

/**
 * LOAD EVERY IMAGE THE PAGE CARRIES, THEN COUNT (2026-09-23).
 *
 * `images` is meant to count the large pictures a page carries, not the ones
 * that happened to finish while the gate scrolled past. Once the streamed page
 * has arrived (waitForStreamedPage), every lazy <img> is switched to eager,
 * which starts its fetch at once, and the gate waits for all of them to finish
 * (loaded or errored). On /cities/bend that is 776 images, finished in 4 to 8
 * seconds through remote-media-proxy.mjs, 135 to 144 of them 800px or wider,
 * in both the full browser and the headless shell. A loop, because a section
 * that mounts or re-renders later brings fresh lazy <img>s. Bounded by
 * EAGER_SETTLE_MS so a hung CDN cannot hang the gate.
 */
async function loadEveryImage(page) {
  const deadline = Date.now() + EAGER_SETTLE_MS
  while (Date.now() < deadline) {
    const pending = await page.evaluate(() => {
      let n = 0
      for (const img of document.images) {
        if (img.loading === 'lazy') img.loading = 'eager'
        if (!img.complete) n += 1
      }
      return n
    })
    if (pending === 0) return
    await page.waitForTimeout(500)
  }
}

async function measure(page, url) {
  let lastErr = null
  for (let attempt = 1; attempt <= NAV_ATTEMPTS; attempt += 1) {
    try {
      const res = await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS })
      if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : 'none'}`)
      // Wait for the streamed page, then load every image it carries before
      // anything is counted; see waitForStreamedPage() and loadEveryImage().
      // The loader runs once now and once more after the scroll mounts any
      // IntersectionObserver section.
      await waitForStreamedPage(page)
      await loadEveryImage(page)
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
      await loadEveryImage(page)
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      // The hero measurement only counts images that have FINISHED loading, so
      // a frame still in flight when the page is read hands "widest in-fold
      // image" to whatever small thing had loaded — the 120px chrome logo, a
      // 300px thumbnail. Measured 2026-09-16: /zip/97702 read hero 1072px on
      // one run and 120px on the next of the same build; /compare read
      // heroImageNatural 1536 then 300. Wait for every in-fold image to settle
      // (loaded OR errored — an errored one is simply not counted) before
      // measuring, bounded so a hung CDN cannot hang the gate.
      await page
        .waitForFunction(
          () =>
            Array.from(document.images).every((img) => {
              const top = img.getBoundingClientRect().top + window.scrollY
              return top >= 1200 || img.complete
            }),
          undefined,
          { timeout: 20_000 },
        )
        .catch(() => {})
      await page.waitForTimeout(SETTLE_MS)
      // Client-rendered sections fill in AFTER load: the Atlas's legend and
      // type toggles are list items the browser paints once the island
      // hydrates, and on a cold server the first read of /communities/tetherow
      // measured sections.atlas.items 0 against a floor of 8, then the
      // hydrated count on every warm read of the same build (2026-09-16).
      // SITE-119: that hydrated count used to include four aria-hidden
      // swatch <li>s (9); after the counter skip it is the real rows (5).
      // Read until two consecutive readings agree on the per-section map
      // (bounded), and keep the last.
      // Just before reading: a prompt that opens on its own a second after
      // mount (the sign-in dialog on a session's second page, and every class
      // after the first is one) is not the page's content. Escape closes a
      // Radix overlay and changes nothing else.
      await page.keyboard.press('Escape').catch(() => {})
      let reading = await page.evaluate(`(${measurePage.toString()})()`)
      for (let pass = 0; pass < STABLE_PASSES; pass += 1) {
        await page.waitForTimeout(STABLE_INTERVAL_MS)
        const next = await page.evaluate(`(${measurePage.toString()})()`)
        const settled = JSON.stringify(next.sectionDepth ?? null) === JSON.stringify(reading.sectionDepth ?? null)
        reading = next
        if (settled) break
      }
      return reading
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
  if (PARITY_OUT && classes.length !== 1) {
    console.error(`--parity-out writes one file; select exactly one class with --classes <key> (got ${classes.length}).`)
    process.exit(1)
  }
  if ((SECTIONS_ONLY || DRY_RUN || PARITY_OUT) && !SEED_BASE) {
    console.error('--sections-only / --dry-run / --parity-out only apply alongside --seed <baseUrl>.')
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
  // This gate MEASURES IMAGES, and under --seed it navigates to a live
  // PRODUCTION host over https. scripts/lib/gate-browser.mjs carries both
  // fixes a cloud sandbox needs for that (untrusted proxy CA in Chromium,
  // cross-origin photo CDNs failing to load in-page) so this gate does not
  // wire them by hand. See that file's header for the measured failure.
  const { context: ctx, mediaStats } = await openGateContext(browser, {
    baseUrl: BASE,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    userAgent: CI_PROBE_HEADERS['User-Agent'],
  })
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
      let floor
      if (SECTIONS_ONLY) {
        // Merge sectionDepth into the EXISTING floor rather than reseeding —
        // the ten page-level floors, their `seededAt`, and `note` all stay
        // exactly as they were. Needs an existing contentFloor: there is
        // nothing sensible to merge sectionDepth into otherwise.
        const existing = parity.contentFloor
        if (!isPlainObject(existing)) {
          failures.push(
            `${cls.key}: --sections-only needs an existing contentFloor to merge sectionDepth into. Seed the base ten first: node scripts/check-route-content-floor.mjs --seed ${SEED_BASE} --classes ${cls.key}`,
          )
          continue
        }
        const { observed: depthObserved, floors: depthFloors } = seedSectionFloors(measured.sectionDepth)
        floor = {
          ...existing,
          observed: { ...(isPlainObject(existing.observed) ? existing.observed : {}), sectionDepth: depthObserved },
          floors: { ...(isPlainObject(existing.floors) ? existing.floors : {}), sectionDepth: depthFloors },
          sectionDepthSeededAt: today,
        }
      } else {
        floor = seedFloor(measured, { seededAt: today, seededFrom: SEED_BASE })
        floor.note =
          typeof parity.contentFloor?.note === 'string'
            ? parity.contentFloor.note
            : 'No-regression floor (ci:route-content-floor). A build under any number here fails before the evaluator runs. Lower a number only by hand, in the same commit, with the reason. Section depth (contentFloor.floors.sectionDepth) follows the same rule.'
      }

      const sectionCount = isPlainObject(floor.floors?.sectionDepth) ? Object.keys(floor.floors.sectionDepth).length : 0
      const label = `${cls.key}${SECTIONS_ONLY ? ' (sections only)' : ''}`

      if (DRY_RUN) {
        console.log(`  DRY RUN ${label} — would write:`)
        console.log(`    sections measured: ${JSON.stringify(measured.sectionDepth ?? {})}`)
        console.log(`    contentFloor: ${JSON.stringify(floor)}`)
        seeded += 1
        continue
      }

      const outPath = PARITY_OUT ? join(ROOT, PARITY_OUT) : pPath
      // Splice, do not re-serialize: these files are hand-edited and a
      // stringify round-trip buries the ten-line change in a thousand-line diff.
      const outText = spliceContentFloor(parityText, floor)
      if (PARITY_OUT) mkdirSync(dirname(outPath), { recursive: true })
      writeFileSync(outPath, outText)
      seeded += 1
      console.log(
        `  seeded ${label}${PARITY_OUT ? ` -> ${PARITY_OUT}` : ''}: sections ${sectionCount}, sectionDepth ${JSON.stringify(measured.sectionDepth ?? {})}`,
      )
      continue
    }

    if (!parity.contentFloor) {
      const line = `${cls.key}: parity.json has no contentFloor. Seed it: node scripts/check-route-content-floor.mjs --seed <baseUrl> --classes ${cls.key}`
      if (REQUIRE_ALL) failures.push(line)
      else warnings.push(line)
      continue
    }
    checked += 1
    let problems = floorProblems(measured, parity.contentFloor)
    if (problems.length && DEGRADED_RETRY_MS > 0) {
      // ONE RETRY PAST A DEGRADED RENDER (2026-09-23). When a live read times
      // out, the page renders its fallback and lib/site/degraded-isr.ts ships
      // that copy with a DEGRADED_ISR_REVALIDATE_S (60s) lifetime. CI hit it
      // twice in one afternoon on PR #352: /zip/97702 read words 761 and a
      // 120px hero, /oregon/medford read words 319 and jsonLd 5, each with
      // its listing section and ItemList missing, on code that read 1,136 /
      // 1,112px and 518 / 6 on the runs either side and on a local server.
      // That is database latency, not lost content. So a class under its
      // floor waits out the degraded copy, sends one request to start the
      // regeneration (ISR serves the stale copy once), and is read again. A
      // real regression reads short twice and still fails; only the second
      // reading is reported.
      console.log(
        `  retry ${cls.key}: under its floor on the first read; reading again after ${Math.round(DEGRADED_RETRY_MS / 1000)}s in case it was a degraded render`,
      )
      await page.waitForTimeout(DEGRADED_RETRY_MS)
      await fetch(BASE + cls.url, { headers: { ...CI_PROBE_HEADERS }, signal: AbortSignal.timeout(60_000) }).catch(() => {})
      await page.waitForTimeout(DEGRADED_REGEN_MS)
      try {
        measured = await measure(page, BASE + cls.url)
        problems = floorProblems(measured, parity.contentFloor)
      } catch {
        // Keep the first reading's problems: it did render once, and short.
      }
    }
    if (problems.length) {
      failures.push(`${cls.key} (${cls.url}):\n      ${problems.join('\n      ')}`)
      console.log(`  FAIL ${cls.key}`)
      // What the failing read actually held, so a CI-only failure can be
      // diagnosed from the log instead of reproduced (2026-09-24).
      const failedIds = [...new Set(problems.map((p) => /^sections\.([^.]+)\./.exec(p)?.[1] ?? /^section #(\S+) gone/.exec(p)?.[1]).filter(Boolean))]
      if (failedIds.length) {
        console.log(`    measured sections: ${JSON.stringify(measured?.sectionDepth ?? {})}`)
        for (const id of failedIds) console.log(`    #${id}: ${JSON.stringify(measured?.sectionDiag?.[id] ?? 'absent from the page')}`)
        console.log(`    open dialogs: ${JSON.stringify(measured?.openDialogs ?? [])}`)
      }
    } else {
      const sectionFloors = parity.contentFloor?.floors?.sectionDepth
      const sectionsNote = isPlainObject(sectionFloors) ? `, sections ${Object.keys(sectionFloors).length}/${Object.keys(sectionFloors).length}` : ''
      console.log(
        `  ok   ${cls.key} — words ${measured.words}, images ${measured.images}, hero ${measured.heroImageWidth}px, video ${measured.video}, jsonLd ${measured.jsonLd}${sectionsNote}`,
      )
    }
  }

  await browser.close()
  if (mediaStats.served > 0) {
    console.log(`\n(${mediaStats.served} cross-origin media request(s) fetched through Node — sandbox egress.)`)
  }

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
    console.log(
      '\nThe page carries less than it did when its floor was seeded — including, since 2026-09-16, a section that shrank or vanished (contentFloor.floors.sectionDepth). Put it back, or lower the floor by hand in parity.json in this same commit and say why. The evaluator does not run on a page that lost content.',
    )
    process.exit(1)
  }
  console.log('OK - every seeded class holds its content floor.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err))
  process.exit(1)
})
