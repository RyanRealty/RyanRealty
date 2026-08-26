#!/usr/bin/env node
/**
 * check-golf-figure-parity.mjs — ci:golf-figure-parity.
 *
 * WHY THIS EXISTS (the class of bug it fixes):
 * A record carries a figure in a STRUCTURED field and repeats it in PROSE beside
 * it. Someone corrects one and not the other, and the page then publishes two
 * different numbers for the same fact. That is not hypothetical here — it happened
 * four times in a single week, three of them found only because someone re-read the
 * page after fixing something else:
 *
 *   - /communities/awbrey-glen said the course plays 7,007 yards in its prose and
 *     7,019 in its amenities block. That is the defect that started the whole audit.
 *   - Black Butte Big Meadow's signature said "7,000+ yards from championship tees"
 *     next to a yardsBackTees of 6,946, immediately after the USGA correction.
 *   - Eagle Crest Resort's signature said 6,673 next to a field reading 6,672.
 *   - William Overdorf's architect bio dated Aspen Lakes' front nine to 1996 while
 *     the course row said 1997 — constructed versus opened for play.
 *
 * CLAUDE.md §6: a rule violated this often becomes a gate, not more prose.
 *
 * WHAT IT CHECKS
 * For every course in data/golf/courses.ts:
 *   1. A yardage in `signature` must equal `yardsBackTees`. "7,000+" is treated as a
 *      claim of at-least-7,000 and fails when the field is below it — the Big Meadow
 *      case, which an equality-only check would have waved through.
 *   2. A "par NN" in `signature` must equal `par`.
 *   3. A four-digit year in an architect bio must appear in one of that architect's
 *      own course rows, OR be listed in KNOWN_NON_COURSE_YEARS below — those are
 *      playing-career dates (Weiskopf's 1973 Open, Fought's 1977 US Amateur) and
 *      staged-build dates the row cannot hold.
 *
 * It reads the DATA, not the rendered page, because that is where the divergence
 * starts. Exit 0 = every prose figure agrees with its field.
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolvingNodeModules } from './lib/resolve-node-modules.mjs'

const ROOT = process.cwd()
// .mjs has no bare `require`; the bundled CJS needs one to evaluate.
const require = createRequire(import.meta.url)

/**
 * Years that legitimately appear in prose without matching a course row.
 * Keep this SMALL and give every entry a reason — it is the escape hatch, so an
 * unexplained addition is how the gate quietly stops working.
 */
const KNOWN_NON_COURSE_YEARS = {
  'John Fought': [
    [1977, 'won the US Amateur'],
    [2012, 'reworked Glaze Meadow — a RENOVATION year; the row carries 1982, when it opened'],
  ],
  'Tom Weiskopf & Jay Morrish': [[1973, 'Weiskopf won the Open Championship']],
  'H. Chandler Egan & Bob Baldock': [[1973, 'Baldock added the front nine at Bend GC; the row carries Egan\'s 1925']],
  'William Overdorf': [
    [1996, 'Aspen Lakes front nine CONSTRUCTED; the row carries 1997, opened for play'],
    [2000, 'Aspen Lakes back nine completed'],
  ],
  'Robert Trent Jones Jr.': [[1981, 'Woodlands — matches the row, listed for clarity']],
}

function load(rel) {
  const esbuild = join(resolvingNodeModules(), '.bin/esbuild')
  if (!existsSync(esbuild)) return { ok: false, error: 'esbuild not installed' }
  const src = join(ROOT, rel)
  if (!existsSync(src)) return { ok: false, error: `${rel} not found` }
  try {
    const code = execFileSync(
      esbuild,
      [src, '--bundle', '--format=cjs', '--platform=node', '--log-level=error'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    )
    const mod = { exports: {} }
    new Function('module', 'exports', 'require', code)(mod, mod.exports, require)
    return { ok: true, mod: mod.exports }
  } catch (err) {
    return { ok: false, error: (err && err.message) || String(err) }
  }
}

const problems = []

const coursesMod = load('data/golf/courses.ts')
if (!coursesMod.ok) {
  console.error(`✗ golf-figure-parity: could not load data/golf/courses.ts — ${coursesMod.error}`)
  process.exit(1)
}
const COURSES = coursesMod.mod.GOLF_COURSES ?? []
if (COURSES.length === 0) problems.push('data/golf/courses.ts exported no courses — the gate would pass vacuously.')

const num = (t) => parseInt(String(t).replace(/,/g, ''), 10)

for (const c of COURSES) {
  const sig = c.signature ?? ''

  // 1. yardage in prose vs the field
  for (const m of sig.matchAll(/\b([\d,]{3,6})(\+?)\s*yards?\b/gi)) {
    const claimed = num(m[1])
    if (!Number.isFinite(claimed) || claimed < 1000) continue // hole-length asides
    const field = c.yardsBackTees
    if (typeof field !== 'number') {
      problems.push(`${c.slug}: signature claims ${m[1]} yards but yardsBackTees is unset.`)
      continue
    }
    if (m[2] === '+') {
      if (field < claimed) {
        problems.push(
          `${c.slug}: signature says "${m[1]}+ yards" but yardsBackTees is ${field} — ${field} is not ${claimed}-or-more.`,
        )
      }
    } else if (claimed !== field) {
      problems.push(`${c.slug}: signature says ${m[1]} yards, yardsBackTees is ${field}.`)
    }
  }

  // 2. par in prose vs the field
  for (const m of sig.matchAll(/\bpar[- ]?(\d{2})\b/gi)) {
    const claimed = parseInt(m[1], 10)
    if (claimed !== c.par) problems.push(`${c.slug}: signature says par ${claimed}, par field is ${c.par}.`)
  }
}

// 3. architect bio years vs their own courses
const archMod = load('data/golf/architects.ts')
if (!archMod.ok) {
  problems.push(`could not load data/golf/architects.ts — ${archMod.error}`)
} else {
  for (const a of archMod.mod.GOLF_ARCHITECTS ?? []) {
    const bio = a.bio ?? ''
    // Join on designerSlug, which is how the app itself groups (coursesByArchitect
    // buckets by c.designerSlug against a.slug). Matching on the display NAME looked
    // right and was wrong: Glaze Meadow's designer reads "John Fought (2012
    // renovation)", so a name join found Fought no courses and the gate reported a
    // false positive on its first run.
    const mine = COURSES.filter((c) => c.designerSlug === a.slug)
      .map((c) => c.yearOpened)
      .filter((y) => typeof y === 'number')
    const allowed = new Set((KNOWN_NON_COURSE_YEARS[a.name] ?? []).map(([y]) => y))
    for (const m of bio.matchAll(/\b(19|20)\d{2}\b/g)) {
      const y = parseInt(m[0], 10)
      if (allowed.has(y) || mine.includes(y)) continue
      problems.push(
        `architect "${a.name}": bio cites ${y}, which matches no course of theirs (${mine.join(', ') || 'none'}) ` +
          `and is not in KNOWN_NON_COURSE_YEARS. Correct it, or add it there WITH a reason.`,
      )
    }
  }
}

console.log('Golf figure parity (ci:golf-figure-parity)')
console.log('==========================================')
if (problems.length === 0) {
  console.log(
    `✓ ${COURSES.length} courses: every yardage and par in prose matches its field, and every architect bio year is accounted for.`,
  )
  process.exit(0)
}
console.error(`\n✗ golf-figure-parity: ${problems.length} problem(s):\n`)
for (const p of problems) console.error(`  • ${p}`)
console.error('\n  One record must not publish two different numbers for the same fact.')
process.exit(1)
