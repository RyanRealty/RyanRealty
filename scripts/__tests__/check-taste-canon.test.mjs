import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { shotsHashFor } from '../lib/taste-receipt.mjs'

/**
 * Break-tests for ci:taste-canon (scripts/check-taste-canon.mjs).
 *
 * The 2026-09-08 arm: a receipt evaluated on or after that date must record the
 * INSTRUMENT that produced its number — evaluator and builder models, rubric
 * version, what was shot, a hash over the shots, three scorings behind the
 * median, named defects, and which prior mark it was compared to. Two marks are
 * comparable only when evaluatorModel, rubricVersion and shotsHash all match;
 * otherwise the item re-baselines instead of stalling on a human.
 *
 * Each case builds a disposable repo outside the checked-out tree and runs the
 * real gate against it with cwd set there.
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(REPO, 'scripts/check-taste-canon.mjs')

// The gates suite runs from a pre-commit hook, where git exports GIT_* vars.
// Strip them before spawning (reference_git_fixture_env_leak.md).
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')))

const SANDBOX = join(tmpdir(), `rr-taste-canon-sandbox-${process.pid}-${Math.random().toString(16).slice(2)}`)

const KIT = 'design_system/ryan-realty/ui_kits/testroute'
const CANON = 'design_system/public/TASTE.md'
const POINTERS = ['CLAUDE.md', 'AGENTS.md', '.claude/skills/frontend-design/SKILL.md']
const SHOTS = { desktop: `${KIT}/shots/desktop.png`, mobile375: `${KIT}/shots/mobile375.png` }

function write(rel, contents) {
  const dest = join(SANDBOX, rel)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, contents)
}

function writeJson(rel, value) {
  write(rel, `${JSON.stringify(value, null, 2)}\n`)
}

function scaffold() {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(SANDBOX, { recursive: true })
  write(CANON, '# TASTE\n\nRubric version: `v1-2026-09-08`.\n')
  for (const p of POINTERS) write(p, `read ${CANON} first\n`)
  write('app/testroute/page.tsx', 'export default function Page() { return null }\n')
  write(SHOTS.desktop, 'desktop-png-bytes')
  write(SHOTS.mobile375, 'mobile-png-bytes')
  writeJson('scripts/taste-review-baseline.json', { routes: [] })
  writeJson('scripts/taste-review-shots-baseline.json', { routes: [] })
  writeJson('scripts/taste-tells-baseline.json', { files: [] })
  writeJson('scripts/taste-receipt-v2-baseline.json', { routes: [] })
}

function hash() {
  return shotsHashFor(SANDBOX, SHOTS)
}

/** A receipt that satisfies every rule — each case breaks exactly one field. */
function baseReceipt(over = {}) {
  return {
    evaluatedAt: '2026-09-08',
    rubricVersion: 'v1-2026-09-08',
    evaluator: 'separate session opus-eval (session_test), scored from the lane dev server',
    evaluatorModel: 'claude-opus-4-1',
    builderModel: 'claude-sonnet-4-5',
    shotSpec: { routes: ['/testroute'], viewports: [1440, 375], states: ['default'] },
    shots: { ...SHOTS },
    shotsHash: hash(),
    scores: [81, 84, 82],
    score: 82,
    beats: 'the portal place page on depth, interaction and a broker one tap away',
    defects: [{ section: '#rails', severity: 'taste', finding: 'three consecutive sections share one form' }],
    comparedToPrior: 'first',
    ...over,
  }
}

function writeReceipt(tasteReview) {
  writeJson(`${KIT}/parity.json`, { route: 'app/testroute/page.tsx', requiredComponents: [], tasteReview })
}

function run() {
  const r = spawnSync('node', [GATE], { cwd: SANDBOX, encoding: 'utf8', env: cleanEnv })
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}

describe('check-taste-canon — instrument receipt (2026-09-08)', () => {
  afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

  it('passes a complete post-cutoff receipt, and counts it as a full instrument receipt', () => {
    scaffold()
    writeReceipt(baseReceipt())
    const r = run()
    expect(r.out).toContain('taste-canon OK')
    // Proves the route was actually graded by the new arm, not skipped.
    expect(r.out).toContain('1 with a full instrument receipt')
    expect(r.code).toBe(0)
  })

  it('fails when evaluatorModel is prose instead of a model string', () => {
    scaffold()
    writeReceipt(baseReceipt({ evaluatorModel: 'a separate evaluator agent run on a different model' }))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('evaluatorModel must be the model string')
  })

  it('fails when the evaluator ran on the builder’s own model', () => {
    scaffold()
    writeReceipt(baseReceipt({ evaluatorModel: 'claude-sonnet-4-5', builderModel: 'claude-sonnet-4-5' }))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('DIFFERENT model from the builder')
  })

  it('fails when rubricVersion is not recorded in TASTE.md', () => {
    scaffold()
    writeReceipt(baseReceipt({ rubricVersion: 'v9-2026-12-01' }))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('appears nowhere in design_system/public/TASTE.md')
  })

  it('fails when shotSpec omits the 375 viewport', () => {
    scaffold()
    writeReceipt(baseReceipt({ shotSpec: { routes: ['/testroute'], viewports: [1440], states: ['default'] } }))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('shotSpec.viewports must include 375')
  })

  it('fails when shotSpec is missing entirely', () => {
    scaffold()
    const tr = baseReceipt()
    delete tr.shotSpec
    writeReceipt(tr)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('shotSpec is missing')
  })

  it('fails when the shots changed after the score was given', () => {
    scaffold()
    writeReceipt(baseReceipt())
    write(SHOTS.desktop, 're-captured-after-scoring')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('does not match the shots on disk')
  })

  it('fails when score is not the median of the three scorings', () => {
    scaffold()
    writeReceipt(baseReceipt({ scores: [81, 84, 82], score: 84 }))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('is not the median of scores')
  })

  it('fails when only one scoring is recorded', () => {
    scaffold()
    writeReceipt(baseReceipt({ scores: [82] }))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('scores must be three integers')
  })

  it('fails when defects are missing', () => {
    scaffold()
    const tr = baseReceipt()
    delete tr.defects
    writeReceipt(tr)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('defects must be an array')
  })

  it('fails on an empty defect list below 95', () => {
    scaffold()
    writeReceipt(baseReceipt({ defects: [] }))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('defects is empty at score 82')
  })

  it('fails when a mark claims a rise over a prior mark from another model', () => {
    scaffold()
    writeReceipt(
      baseReceipt({
        comparedToPrior: 'rose',
        priorMark: {
          evaluatedAt: '2026-09-06',
          score: 60,
          evaluatorModel: 'grok-4.6',
          rubricVersion: 'v1-2026-09-08',
          shotsHash: hash(),
        },
      }),
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('differs on evaluatorModel')
    expect(r.out).toContain('rebaselined')
  })

  it('fails when the instrument matches and the score did not rise', () => {
    scaffold()
    writeReceipt(
      baseReceipt({
        comparedToPrior: 'rose',
        priorMark: {
          evaluatedAt: '2026-09-08',
          score: 88,
          evaluatorModel: 'claude-opus-4-1',
          rubricVersion: 'v1-2026-09-08',
          shotsHash: hash(),
        },
      }),
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('did not rise above the prior mark 88')
  })

  it('passes a rise over the same instrument', () => {
    scaffold()
    writeReceipt(
      baseReceipt({
        comparedToPrior: 'rose',
        priorMark: {
          evaluatedAt: '2026-09-08',
          score: 74,
          evaluatorModel: 'claude-opus-4-1',
          rubricVersion: 'v1-2026-09-08',
          shotsHash: hash(),
        },
      }),
    )
    const r = run()
    expect(r.out).toContain('taste-canon OK')
    expect(r.out).toContain('1 with a full instrument receipt')
    expect(r.code).toBe(0)
  })

  it('fails a re-baseline claim when the prior mark IS comparable', () => {
    scaffold()
    writeReceipt(
      baseReceipt({
        comparedToPrior: 'rebaselined',
        rebaselineReason: 'shotsHash changed',
        priorMark: {
          evaluatedAt: '2026-09-08',
          score: 88,
          evaluatorModel: 'claude-opus-4-1',
          rubricVersion: 'v1-2026-09-08',
          shotsHash: hash(),
        },
      }),
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('it IS comparable')
  })

  it('passes a re-baseline over an incomparable prior mark, no rise required (the SITE-M1 case)', () => {
    scaffold()
    writeReceipt(
      baseReceipt({
        comparedToPrior: 'rebaselined',
        rebaselineReason:
          'evaluatorModel and shotsHash both differ: the 88 came from another evaluator against shots that no longer exist',
        priorMark: {
          evaluatedAt: '2026-09-06',
          score: 88,
          evaluatorModel: 'public-look',
          rubricVersion: 'v1-2026-09-08',
          shotsHash: 'sha256:' + '0'.repeat(64),
        },
      }),
    )
    const r = run()
    expect(r.out).toContain('taste-canon OK')
    expect(r.out).toContain('1 with a full instrument receipt')
    expect(r.code).toBe(0)
  })

  it('fails a re-baseline whose reason does not name a differing key', () => {
    scaffold()
    writeReceipt(
      baseReceipt({
        comparedToPrior: 'rebaselined',
        rebaselineReason: 'the old number was not fair',
        priorMark: {
          evaluatedAt: '2026-09-06',
          score: 88,
          evaluatorModel: 'public-look',
          rubricVersion: 'v1-2026-09-08',
          shotsHash: hash(),
        },
      }),
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('rebaselineReason must name the key(s) that differ')
  })

  it('fails when comparedToPrior is absent', () => {
    scaffold()
    const tr = baseReceipt()
    delete tr.comparedToPrior
    writeReceipt(tr)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('comparedToPrior must be')
  })

  it('leaves a pre-2026-09-08 receipt alone — none of the new fields required', () => {
    scaffold()
    writeReceipt({
      evaluatedAt: '2026-09-07',
      score: 59,
      beats: 'the resort site on numbers and the portal on depth of closed sales',
      evaluator: 'separate grok-4.6 evaluator, place-pages pass',
      shots: { ...SHOTS },
    })
    const r = run()
    expect(r.out).toContain('taste-canon OK')
    // Counted as a complete review, never sent through the v2 arm.
    expect(r.out).toContain('1 complete review(s) with PNGs')
    expect(r.out).toContain('0 with a full instrument receipt')
    expect(r.code).toBe(0)
  })

  it('lets a post-cutoff receipt that predates the rule sit in the shrink-only baseline', () => {
    scaffold()
    writeReceipt({
      evaluatedAt: '2026-09-08',
      score: 77,
      beats: 'the portal home on reach: three brokers, call, text and book at zero clicks',
      evaluator: 'separate Opus evaluator, SITE-M1 homepage pass',
      shots: { ...SHOTS },
    })
    writeJson('scripts/taste-receipt-v2-baseline.json', { routes: [`${KIT}/parity.json`] })
    const r = run()
    expect(r.out).toContain('taste-canon OK')
    expect(r.out).toContain('1 legacy receipt(s) (baseline)')
    expect(r.code).toBe(0)
  })
})

describe('check-taste-canon — the committed receipt is a prior mark', () => {
  /** Commit a receipt at HEAD so the working tree has something to compare to. */
  function commitReceipt(tasteReview) {
    const git = (args) => {
      const r = spawnSync('git', args, { cwd: SANDBOX, encoding: 'utf8', env: cleanEnv })
      if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed:\n${r.stdout}${r.stderr}`)
    }
    git(['init', '-q'])
    git(['config', 'user.email', 'test@test.invalid'])
    git(['config', 'user.name', 'test'])
    writeReceipt(tasteReview)
    git(['add', '-A'])
    git(['commit', '-qm', 'seed'])
  }

  const committed = () =>
    baseReceipt({
      evaluatedAt: '2026-09-08',
      scores: [74, 76, 75],
      score: 75,
      defects: [{ section: '#hero', severity: 'taste', finding: 'centered hero with no reason to scroll' }],
    })

  it('refuses "first" when the route already carries a scored receipt at HEAD', () => {
    scaffold()
    commitReceipt(committed())
    writeReceipt(baseReceipt({ comparedToPrior: 'first' }))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('already scored 75')
    expect(r.out).toContain('not an exit from the rise rule')
  })

  it('accepts a rise that names the committed mark', () => {
    scaffold()
    commitReceipt(committed())
    writeReceipt(
      baseReceipt({
        comparedToPrior: 'rose',
        priorMark: {
          evaluatedAt: '2026-09-08',
          score: 75,
          evaluatorModel: 'claude-opus-4-1',
          rubricVersion: 'v1-2026-09-08',
          shotsHash: hash(),
        },
      }),
    )
    const r = run()
    expect(r.out).toContain('taste-canon OK')
    expect(r.code).toBe(0)
  })

  it('stays green re-running against the receipt that is already committed', () => {
    scaffold()
    commitReceipt(baseReceipt())
    const r = run()
    expect(r.out).toContain('taste-canon OK')
    expect(r.out).toContain('1 with a full instrument receipt')
    expect(r.code).toBe(0)
  })
})

describe('check-taste-canon — the rules that were already there', () => {
  it('still fails a receipt whose PNGs are not on disk', () => {
    scaffold()
    const tr = baseReceipt({ shots: { desktop: `${KIT}/shots/gone.png`, mobile375: SHOTS.mobile375 } })
    writeReceipt(tr)
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('no on-disk desktop + 375 PNGs')
  })

  it('still fails an evaluator that is "pending"', () => {
    scaffold()
    writeReceipt(baseReceipt({ evaluator: 'pending — structure pass only, no rendered shots yet' }))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('evaluator is still "pending"')
  })

  it('still fails a public route with no tasteReview at all', () => {
    scaffold()
    writeJson(`${KIT}/parity.json`, { route: 'app/testroute/page.tsx', requiredComponents: [] })
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('has no tasteReview JSON')
  })

  it('still fails when a pointer file stops citing the canon', () => {
    scaffold()
    writeReceipt(baseReceipt())
    write('AGENTS.md', 'nothing about taste here\n')
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toContain('no longer cites design_system/public/TASTE.md')
  })
})
