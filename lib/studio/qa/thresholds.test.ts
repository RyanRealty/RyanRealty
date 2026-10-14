import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  EXTRA_BANNED_PHRASES,
  FILM_LEDGER_PATH,
  LEDGER_WINDOW,
  QA_THRESHOLDS,
  REPO_ROOT,
  TECHNIQUE_REGISTRY_PATH,
  VIDEO_TYPES_PATH,
  REQUIRED_TECHNIQUE_CATEGORIES,
  bannedPhrases,
  loadVideoTypes,
  typeRulesFor,
} from './thresholds'

describe('QA_THRESHOLDS', () => {
  it('holds every number in the contract table', () => {
    const t = QA_THRESHOLDS
    expect(t.freezeSeconds).toBe(1.2)
    expect(t.caption.maxWords).toBe(4)
    expect(t.caption.minSeconds).toBe(0.4)
    expect(t.caption.syncSeconds).toBe(0.08)
    expect(t.audio.lufsMin).toBe(-15)
    expect(t.audio.lufsMax).toBe(-13)
    expect(t.audio.truePeakMaxDb).toBe(-1.0)
    expect(t.endcard.ssimMin).toBe(0.92)
    expect(t.loopSsimMin).toBe(0.85)
    expect(t.safeArea).toEqual({ maxX: 960, maxY: 1640 })
    expect(t.durationToleranceSeconds).toBe(0.05)
    expect(t.endcard.wordPopBudgetSeconds).toBe(1.2)
    expect(t.endcard.callHoldMinSeconds).toBe(1.5)
    expect(t.format).toMatchObject({ width: 1080, height: 1920, fps: 30, codec: 'h264', pixFmt: 'yuv420p' })
    expect(t.sceneCutScore).toBe(0.35)
    expect(t.freezeNoise).toBe(0.003)
  })

  it('is frozen so a check cannot change a limit', () => {
    expect(Object.isFrozen(QA_THRESHOLDS)).toBe(true)
    expect(Object.isFrozen(QA_THRESHOLDS.audio)).toBe(true)
    expect(Object.isFrozen(QA_THRESHOLDS.endcard)).toBe(true)
  })

  it('does not copy the type rules that video_types.json owns', () => {
    const keys = JSON.stringify(QA_THRESHOLDS)
    for (const k of ['min_hold_s', 'hook_max_s', 'hard_max_s', 'min_s', 'max_s']) expect(keys).not.toContain(k)
  })

  it('requires a hook, a scene and a type technique, and compares five films', () => {
    expect([...REQUIRED_TECHNIQUE_CATEGORIES]).toEqual(['hook', 'scene', 'type'])
    expect(LEDGER_WINDOW).toBe(5)
  })
})

describe('repo paths', () => {
  it('find the repo root and the three files the checks read', () => {
    expect(existsSync(join(REPO_ROOT, 'package.json'))).toBe(true)
    expect(existsSync(VIDEO_TYPES_PATH)).toBe(true)
    expect(existsSync(TECHNIQUE_REGISTRY_PATH)).toBe(true)
    expect(FILM_LEDGER_PATH).toBe(join(REPO_ROOT, 'data', 'studio', 'film-ledger.jsonl'))
  })
})

describe('type rules', () => {
  it('merges the defaults with the type', () => {
    const file = loadVideoTypes()
    const buyer = typeRulesFor('buyer_ad', file)!
    expect(buyer.hook_max_s).toBe(file.types.buyer_ad.hook_max_s)
    expect(buyer.min_hold_s).toBe(file.defaults.min_hold_s)
    expect(buyer.requires_end_card).toBe(true)
    expect(buyer.requires_voiceover).toBe(true)
    const teaser = typeRulesFor('story_teaser', file)!
    expect(teaser.min_s).toBe(file.types.story_teaser.min_s)
    expect(teaser.hook_max_s).toBe(file.defaults.hook_max_s)
  })

  it('returns null for a type video_types.json does not list', () => {
    expect(typeRulesFor('vlog')).toBeNull()
    expect(typeRulesFor('constructor')).toBeNull()
  })

  describe('with a broken file', () => {
    const dirs: string[] = []
    afterEach(() => {
      while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true })
    })
    const write = (obj: unknown) => {
      const dir = mkdtempSync(join(tmpdir(), 'rr-types-'))
      dirs.push(dir)
      const p = join(dir, 'video_types.json')
      writeFileSync(p, JSON.stringify(obj))
      return p
    }

    it('throws when the file lacks a section', () => {
      expect(() => loadVideoTypes(write({ defaults: {}, types: {} }))).toThrow(/banned_phrases/)
      expect(() => loadVideoTypes(write({ defaults: {}, types: {}, banned_phrases: [] }))).toThrow(/fair_housing_flags/)
    })

    it('throws when a merged rule set lacks a key the check needs', () => {
      const file = loadVideoTypes(write({ defaults: { min_s: 1 }, types: { x: {} }, banned_phrases: [], fair_housing_flags: [] }))
      expect(() => typeRulesFor('x', file)).toThrow(/hook_max_s/)
    })
  })
})

describe('bannedPhrases', () => {
  it('adds the contract phrases once and lowercases everything', () => {
    const list = bannedPhrases()
    for (const p of EXTRA_BANNED_PHRASES) expect(list).toContain(p)
    expect(list.filter((p) => p === 'top team')).toHaveLength(1)
    expect(list).toContain('nestled')
    expect(new Set(list).size).toBe(list.length)
  })
})
