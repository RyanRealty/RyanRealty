/**
 * The rules file, and the proof that every enforced rule refuses at its step.
 *
 * 1. rules.ts is well formed: stable IDs, an enforcer, a fixture and a message
 *    pattern for every enforced rule, a build-order step for every planned one,
 *    and every number the factory holds belongs to a rule (so none can loosen
 *    without the ratchet seeing it).
 * 2. For EVERY enforced rule: its fixture (fixtures/R-xxx.json) breaks that
 *    rule, the step runner runs the steps in order against fakes (test-harness.ts),
 *    every step before the rule's step passes, the rule's step refuses, its
 *    message matches `fixtureMatch`, and the stamp names the rule by ID.
 *    A rule that is only prose cannot be written here: there is no fixture to
 *    point at.
 *
 * The enforcer's export existing in its module is held by scripts/check-content-rules.mjs
 * (ci:content-rules) and its break-tests, which read the TypeScript AST.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REPO_ROOT } from '../../studio/qa/thresholds'
import { ruleFor } from './classify'
import { RULES, UNRATCHETED, type Rule } from './rules'
import { resolveAll, rulesVersion, thresholdData, thresholdsOf } from './rules-version'
import { unownedNumbers } from './threshold-path'
import { runFixture, loadFixture } from './test-harness'

const ID = /^R-\d{3}$/
const enforced = RULES.filter((r) => r.status === 'enforced')
const planned = RULES.filter((r) => r.status === 'planned')

describe('rules.ts is well formed', () => {
  it('has stable, unique, well-formed IDs', () => {
    const ids = RULES.map((r) => r.id)
    expect(ids.every((i) => ID.test(i))).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every rule a plain title, a source, and the deliverables it applies to', () => {
    for (const r of RULES) {
      expect(r.title.trim(), r.id).not.toBe('')
      expect(r.source.trim(), r.id).not.toBe('')
      expect(r.appliesTo.length, r.id).toBeGreaterThan(0)
      // No em or en dash in anything a person reads (Matt 2026-09-20).
      expect(/[–—]/.test(`${r.title} ${r.source} ${r.plannedIn ?? ''}`), `${r.id} has a dash`).toBe(false)
    }
  })

  it('has an enforcer, a fixture and a message pattern on every enforced rule, and a build-order step on every planned one', () => {
    for (const r of enforced) {
      expect(r.enforcer?.module && r.enforcer.export, `${r.id} enforcer`).toBeTruthy()
      expect(r.fixture, `${r.id} fixture`).toBeTruthy()
      expect(r.fixtureMatch, `${r.id} fixtureMatch`).toBeTruthy()
      expect(existsSync(join(REPO_ROOT, r.fixture!)), `${r.id} fixture file`).toBe(true)
      expect(() => new RegExp(r.fixtureMatch!, 'i'), `${r.id} fixtureMatch is a regex`).not.toThrow()
    }
    for (const r of planned) expect(['process core', 'certifier', 'doors', 'judge', 'library'], `${r.id} plannedIn`).toContain(r.plannedIn)
  })

  it('has one fixture file per enforced rule and no stray fixture', () => {
    const files = readdirSync(join(REPO_ROOT, 'lib/content/process/fixtures')).filter((f) => /^R-\d{3}\.json$/.test(f))
    expect(files.sort()).toEqual(enforced.map((r) => `${r.id}.json`).sort())
  })

  it('resolves every threshold a rule holds from where the number lives', () => {
    const data = thresholdData()
    for (const r of RULES) for (const t of thresholdsOf(r)) expect(() => resolveAll(data, [{ ...r, threshold: t }]), `${r.id} ${t.path}`).not.toThrow()
    expect(rulesVersion()).toMatch(/^[0-9a-f]{64}$/)
  })

  it('gives every number the factory holds to a rule, so none can loosen unseen', () => {
    expect(unownedNumbers(thresholdData(), RULES, UNRATCHETED)).toEqual([])
  })

  it('names a number no rule owns', () => {
    const withoutOne = RULES.map((r) => (r.id === 'R-004' ? { ...r, threshold: undefined } : r))
    expect(unownedNumbers(thresholdData(), withoutOne, UNRATCHETED)).toContain('video_types:defaults.hook_max_s')
  })
})

describe('every enforced rule refuses at its step, on its own fixture', () => {
  for (const rule of enforced as Rule[]) {
    it(`${rule.id} refuses at ${rule.step}: ${rule.title}`, async () => {
      const fx = loadFixture(`${rule.id}.json`)
      expect(fx.rule).toBe(rule.id)
      expect(fx.step).toBe(rule.step)
      const { result } = await runFixture(fx)
      expect(result.ok, 'the run must be refused').toBe(false)
      expect(result.refusedAt, `refused at ${result.refusedAt}: ${result.problems.map((p) => p.problem).join(' | ')}`).toBe(rule.step)
      // Every step before it passed: the fixture breaks this rule at its step, not an earlier one.
      const before = result.outcomes.filter((o) => o.action === 'refused' && o.step !== rule.step)
      expect(before, 'an earlier step refused').toEqual([])
      const re = new RegExp(rule.fixtureMatch!, 'i')
      const hit = result.problems.filter((p) => re.test(p.problem))
      expect(hit.length, `no problem matched /${rule.fixtureMatch}/ in:\n${result.problems.map((p) => p.problem).join('\n')}`).toBeGreaterThan(0)
      // The stamp names the rule: the refusal is classified to this rule's ID.
      expect(hit.some((p) => p.rule === rule.id), `matched problems were tagged ${hit.map((p) => p.rule).join(', ')}`).toBe(true)
      expect(ruleFor(hit[0].problem)?.id === undefined).toBe(false)
    })
  }
})
